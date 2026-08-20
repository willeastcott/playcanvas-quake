import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { BspMap } from '../src/formats/bsp';
import { parseQuakeDemo, type QuakeDemoMessage } from '../src/formats/dem';
import { PakArchive } from '../src/formats/pak';
import { QuakeProgram } from '../src/formats/progs';
import { WorldCollision } from '../src/game/collision';
import { QuakeDemoClient, type QuakeDemoFrameEvents } from '../src/game/demo-client';
import {
    QUAKE_DEFAULT_DEMOS,
    QUAKE_MAX_DEMOS,
    parseQuakeDemoLoopState,
    quakeDemoLoopNames,
    quakeNextDemo,
    serializeQuakeDemoLoopState
} from '../src/game/demo-loop';
import {
    QuakeDemoPlayback,
    QuakeTimeDemoCounter,
    quakeTimeDemoReport
} from '../src/game/demo-playback';
import { quakeDemoPath } from '../src/game/quake-app';
import { QuakeVirtualMachine } from '../src/game/quake-vm';
import { QuakeWorldRuntime } from '../src/game/quake-world';
import { quakeExternalBrushModelPath } from '../src/render/world-brush-entity-renderer';

const writeInt16 = (bytes: number[], value: number): void => {
    bytes.push(value & 255, (value >> 8) & 255);
};

const writeCoordinate = (bytes: number[], value: number): void => {
    writeInt16(bytes, Math.trunc(value * 8));
};

const message = (data: number[]): QuakeDemoMessage => ({
    data: Uint8Array.from(data),
    fileOffset: 0,
    viewAngles: [10, 20, 30]
});

const framedDemo = (
    forcedTrack: string,
    records: Array<{ angles: readonly [number, number, number]; data: number[] }>
): Uint8Array => {
    const header = new TextEncoder().encode(`${forcedTrack}\n`);
    const length = header.length + records.reduce((sum, record) => sum + 16 + record.data.length, 0);
    const bytes = new Uint8Array(length);
    bytes.set(header);
    const view = new DataView(bytes.buffer);
    let offset = header.length;
    for (const record of records) {
        view.setInt32(offset, record.data.length, true);
        for (let axis = 0; axis < 3; axis++) {
            view.setFloat32(offset + 4 + axis * 4, record.angles[axis], true);
        }
        bytes.set(record.data, offset + 16);
        offset += 16 + record.data.length;
    }
    return bytes;
};

describe('Quake demo framing', () => {
    it('normalizes safe console and URL demo names', () => {
        expect(quakeDemoPath('DEMO1')).toBe('demo1.dem');
        expect(quakeDemoPath('demo2.dem')).toBe('demo2.dem');
        expect(quakeDemoPath('../demo1')).toBeUndefined();
        expect(quakeDemoPath('maps/demo1')).toBeUndefined();
        expect(quakeDemoPath(null)).toBeUndefined();
    });

    it('reads the forced track, view angles, and bounded server messages', () => {
        const demo = parseQuakeDemo(framedDemo('-1', [
            { angles: [1.5, -2, 360], data: [1, 2, 3] },
            { angles: [4, 5, 6], data: [7] }
        ]));

        expect(demo.forcedTrack).toBe(-1);
        expect(demo.messages).toHaveLength(2);
        expect(demo.messages[0].fileOffset).toBe(3);
        expect(demo.messages[0].viewAngles).toEqual([1.5, -2, 360]);
        expect([...demo.messages[0].data]).toEqual([1, 2, 3]);
        expect(demo.messages[1].viewAngles).toEqual([4, 5, 6]);
    });

    it('rejects malformed headers, oversized messages, and truncated records', () => {
        expect(() => parseQuakeDemo(Uint8Array.from([49, 50]))).toThrow(/terminator/u);
        expect(() => parseQuakeDemo(framedDemo('track', []))).toThrow(/forced track/u);

        const oversized = framedDemo('0', [{ angles: [0, 0, 0], data: [] }]);
        new DataView(oversized.buffer).setInt32(2, 8_001, true);
        expect(() => parseQuakeDemo(oversized)).toThrow(/invalid length 8001/u);

        const truncated = framedDemo('0', [{ angles: [0, 0, 0], data: [1] }]);
        expect(() => parseQuakeDemo(truncated.subarray(0, -1))).toThrow(/outside the file/u);
    });
});

describe('Quake demo protocol', () => {
    it('preserves interleaved sound and stop-sound command order', () => {
        const packedChannel = (2 << 3) | 3;
        const bytes = [6, 0];
        writeInt16(bytes, packedChannel);
        bytes.push(0);
        writeCoordinate(bytes, 1);
        writeCoordinate(bytes, 2);
        writeCoordinate(bytes, 3);
        bytes.push(16);
        writeInt16(bytes, packedChannel);

        const events = new QuakeDemoClient().parseMessage(message(bytes));

        expect(events.commands.map(command => command.kind)).toEqual([
            'sound', 'stopSound'
        ]);
        expect(events.soundCommands.map(command => command.kind)).toEqual([
            'start', 'stop'
        ]);
        expect(events.soundCommands.map(command => command.event)).toEqual([
            expect.objectContaining({ channel: 3, entity: 2 }),
            { channel: 3, entity: 2 }
        ]);
    });

    it('decodes source-ordered static sounds and beam temporary entities', () => {
        const bytes: number[] = [29];
        writeCoordinate(bytes, 1);
        writeCoordinate(bytes, -2);
        writeCoordinate(bytes, 3.5);
        bytes.push(4, 200, 64, 23, 5);
        writeInt16(bytes, 42);
        for (const value of [10, 20, 30, 40, 50, 60]) writeCoordinate(bytes, value);

        const client = new QuakeDemoClient();
        const events = client.parseMessage(message(bytes));

        expect(client.staticSounds).toEqual([{
            attenuation: 64,
            origin: [1, -2, 3.5],
            sample: undefined,
            soundIndex: 4,
            volume: 200
        }]);
        expect(events.temporaryEntities).toEqual([{
            end: [40, 50, 60],
            entity: 42,
            origin: [10, 20, 30],
            type: 5
        }]);
        expect(events.commands.map(command => command.kind)).toEqual([
            'spawnStaticSound', 'temporaryEntity'
        ]);
    });

    it('rejects truncated and illegible server commands', () => {
        const client = new QuakeDemoClient();
        expect(() => client.parseMessage(message([7, 0]))).toThrow(/Truncated/u);
        expect(() => client.parseMessage(message([35]))).toThrow(/Illegible/u);
    });

    it('retains consecutive server velocities for client interpolation', () => {
        const clientData = (velocity: readonly [number, number, number]): number[] => [
            15,
            0b1110_0000, 0,
            ...velocity.map(component => component / 16 & 255),
            0, 0, 0, 0,
            100, 0,
            25, 25, 0, 0, 0, 1
        ];
        const client = new QuakeDemoClient();

        client.parseMessage(message(clientData([16, 32, 48])));
        client.parseMessage(message(clientData([-16, 0, 64])));

        expect(client.previousVelocity).toEqual([16, 32, 48]);
        expect(client.velocity).toEqual([-16, 0, 64]);
    });
});

describe('Quake demo playback timing', () => {
    it('consumes every signon message immediately like CL_GetMessage', () => {
        const playback = new QuakeDemoPlayback({
            forcedTrack: -1,
            messages: [
                message([25, 1]),
                message([25, 2]),
                message([25, 3]),
                message([128, 1])
            ]
        });

        const result = playback.start();

        expect(playback.client.signon).toBe(4);
        expect(result.messageIndex).toBe(4);
        expect(result.events).toHaveLength(4);
    });

    it('clamps message time and interpolates wrapped angles, origins, and velocity', () => {
        const playback = new QuakeDemoPlayback({ forcedTrack: -1, messages: [] });
        playback.client.previousTime = 1.9;
        playback.client.time = 2;
        playback.client.previousMessageViewAngles = [350, 20, 30];
        playback.client.messageViewAngles = [10, 40, -30];
        playback.client.previousVelocity = [0, 100, -100];
        playback.client.velocity = [100, 200, 100];
        playback.clientTime = 1.95;
        playback.client.entities.set(7, {
            angles: [10, 40, -30],
            colormap: 0,
            effects: 0,
            entity: 7,
            forceLink: false,
            frame: 1,
            messageTime: 2,
            modelIndex: 3,
            noLerp: false,
            origin: [10, 20, 30],
            previousAngles: [350, 20, 30],
            previousOrigin: [0, 10, 20],
            skin: 0
        });

        expect(playback.interpolationFraction()).toBeCloseTo(0.5);
        expect(playback.viewAngles()[0]).toBeCloseTo(360);
        expect(playback.viewAngles()[1]).toBeCloseTo(30);
        expect(playback.viewAngles()[2]).toBeCloseTo(0);
        expect(playback.velocity()[0]).toBeCloseTo(50);
        expect(playback.velocity()[1]).toBeCloseTo(150);
        expect(playback.velocity()[2]).toBeCloseTo(0);
        expect(playback.entityState(7)?.origin[0]).toBeCloseTo(5);
        expect(playback.entityState(7)?.origin[1]).toBeCloseTo(15);
        expect(playback.entityState(7)?.origin[2]).toBeCloseTo(25);
        expect(playback.entityState(7)?.angles[0]).toBeCloseTo(360);
        expect(playback.entityState(7)?.angles[1]).toBeCloseTo(30);
        expect(playback.entityState(7)?.angles[2]).toBeCloseTo(0);

        playback.clientTime = 4;
        expect(playback.interpolationFraction()).toBe(1);
        expect(playback.clientTime).toBe(2);
    });

    it('caps dropped-message interpolation to 100 ms and snaps teleports', () => {
        const playback = new QuakeDemoPlayback({ forcedTrack: -1, messages: [] });
        playback.client.previousTime = 1;
        playback.client.time = 2;
        playback.clientTime = 1.95;
        playback.client.entities.set(7, {
            angles: [90, 180, 270],
            colormap: 0,
            effects: 0,
            entity: 7,
            forceLink: false,
            frame: 1,
            messageTime: 2,
            modelIndex: 3,
            noLerp: false,
            origin: [101, 20, 30],
            previousAngles: [0, 0, 0],
            previousOrigin: [0, 10, 20],
            skin: 0
        });
        playback.client.entities.set(8, {
            angles: [0, 0, 0],
            colormap: 0,
            effects: 0,
            entity: 8,
            forceLink: false,
            frame: 1,
            messageTime: 2,
            modelIndex: 3,
            noLerp: false,
            origin: [100, 20, 30],
            previousAngles: [0, 0, 0],
            previousOrigin: [0, 10, 20],
            skin: 0
        });

        expect(playback.interpolationFraction()).toBeCloseTo(0.5);
        expect(playback.client.previousTime).toBe(1.9);
        expect(playback.entityState(7)?.origin).toEqual([101, 20, 30]);
        expect(playback.entityState(7)?.angles).toEqual([90, 180, -90]);
        expect(playback.entityState(8)?.origin[0]).toBeCloseTo(50);
    });

    it('closes an active playback exactly once and stops consuming records', () => {
        const playback = new QuakeDemoPlayback({
            forcedTrack: -1,
            messages: [
                message([25, 1]),
                message([25, 2]),
                message([25, 3]),
                message([128, 1]),
                message([1])
            ]
        });
        playback.start();
        const messageIndex = playback.messageIndex;
        const clientTime = playback.clientTime;

        expect(playback.active).toBe(true);
        expect(playback.stop()).toBe(true);
        expect(playback.active).toBe(false);
        expect(playback.finished).toBe(true);
        expect(playback.stop()).toBe(false);
        expect(playback.advance(1)).toEqual({
            events: [],
            finished: true,
            messageIndex
        });
        expect(playback.clientTime).toBe(clientTime);
    });

    it('reads exactly one signed-on message per timedemo render frame', () => {
        const timeMessage = (time: number): QuakeDemoMessage => {
            const bytes = new Uint8Array(5);
            bytes[0] = 7;
            new DataView(bytes.buffer).setFloat32(1, time, true);
            return message([...bytes]);
        };
        const playback = new QuakeDemoPlayback({
            forcedTrack: -1,
            messages: [
                message([25, 1]),
                message([25, 2]),
                message([25, 3]),
                message([128, 1]),
                timeMessage(10),
                timeMessage(20)
            ]
        }, true);
        playback.start();

        expect(playback.advance(100).messageIndex).toBe(5);
        expect(playback.clientTime).toBe(10);
        expect(playback.interpolationFraction()).toBe(1);
        expect(playback.advance(100).messageIndex).toBe(6);
        expect(playback.clientTime).toBe(20);
    });

    it('excludes the first timedemo frame and formats the source report', () => {
        const counter = new QuakeTimeDemoCounter();
        counter.beginFrame(1_000);
        counter.beginFrame(1_010);
        counter.beginFrame(1_020);

        const result = counter.finish(1_030);
        expect(result).toEqual({
            frames: 2,
            framesPerSecond: 100,
            seconds: 0.02
        });
        expect(quakeTimeDemoReport(result)).toBe(
            '2 frames   0.0 seconds 100.0 fps\n'
        );
    });
});

describe('Quake demo loop', () => {
    it('normalizes and caps the source eight-slot startdemos list', () => {
        expect(quakeDemoLoopNames([
            'DEMO1.dem', 'demo2', '../bad', 'demo3', 'four', 'five',
            'six', 'seven', 'eight', 'ninth'
        ])).toEqual([
            'demo1', 'demo2', 'demo3', 'four', 'five', 'six', 'seven'
        ]);
        expect(QUAKE_MAX_DEMOS).toBe(8);
    });

    it('advances, wraps, and serializes CL_NextDemo state', () => {
        const first = quakeNextDemo({ demos: [...QUAKE_DEFAULT_DEMOS], nextIndex: 0 });
        expect(first).toEqual({
            demo: 'demo1',
            state: { demos: ['demo1', 'demo2', 'demo3'], nextIndex: 1 }
        });
        expect(quakeNextDemo({ demos: [...QUAKE_DEFAULT_DEMOS], nextIndex: 3 })?.demo)
        .toBe('demo1');
        expect(quakeNextDemo({ demos: [], nextIndex: 0 })).toBeUndefined();

        const serialized = serializeQuakeDemoLoopState({
            demos: ['DEMO1.dem', 'demo2'],
            nextIndex: -1
        });
        expect(parseQuakeDemoLoopState(serialized)).toEqual({
            demos: ['demo1', 'demo2'],
            nextIndex: -1
        });
        expect(parseQuakeDemoLoopState('{bad')).toBeUndefined();
        expect(parseQuakeDemoLoopState('{"demos":[],"nextIndex":0}')).toBeUndefined();
    });
});

const pakPath = path.resolve('.quake-data/id1/pak0.pak');
const describeWithPak = fs.existsSync(pakPath) ? describe : describe.skip;

describeWithPak('verified shareware demos', () => {
    it('contains the complete default quake.rc attract loop', () => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        expect(QUAKE_DEFAULT_DEMOS.map(name => `${name}.dem`).every(
            demoPath => pak.has(demoPath)
        )).toBe(true);
        expect(new TextDecoder('windows-1252').decode(pak.get('quake.rc')))
        .toContain('startdemos demo1 demo2 demo3');
    });

    it('adapts recorded view, HUD, static, and entity state into the real E1M3 runtime', () => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const playback = new QuakeDemoPlayback(parseQuakeDemo(pak.get('demo1.dem')));
        const startup = playback.start();
        const map = new BspMap(pak.get('maps/e1m3.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m3', undefined, pak
        );
        playback.client.previousTime = playback.client.time - 0.1;
        playback.clientTime = playback.client.time - 0.05;
        playback.client.previousVelocity = [0, 100, -100];
        playback.client.velocity = [100, 200, 100];

        world.applyDemoPlayback(playback, startup.events, 0);

        expect(world.time).toBe(playback.clientTime);
        expect(world.playerResult(false).angles).toEqual(playback.viewAngles());
        expect(world.playerResult(false).fixAngle).toBe(true);
        expect(vm.getEntityVector(world.playerReference, 'velocity')[0]).toBeCloseTo(50);
        expect(vm.getEntityVector(world.playerReference, 'velocity')[1]).toBeCloseTo(150);
        expect(vm.getEntityVector(world.playerReference, 'velocity')[2]).toBeCloseTo(0);
        expect(world.clientData().health).toBe(playback.client.stats[0]);
        expect(world.clientData().items).toBe(playback.client.items);
        expect(vm.getEntityString(0, 'message')).toBe('the Necropolis');
        expect(world.staticEntities).toHaveLength(playback.client.staticEntities.length);
        expect(world.ambientSounds).toHaveLength(playback.client.staticSounds.length);
        expect([...world.lightStyles]).toEqual([...playback.client.lightStyles]);
    });

    it('replaces local brush ownership with the supplied demo1 double-door snapshot', () => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const playback = new QuakeDemoPlayback(parseQuakeDemo(pak.get('demo1.dem')));
        const startup = playback.start();
        const map = new BspMap(pak.get('maps/e1m3.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m3', undefined, pak
        );
        expect(vm.getEntityString(0, 'model')).toBe('maps/e1m3.bsp');
        expect(quakeExternalBrushModelPath(0, vm.getEntityString(0, 'model'))).toBe(false);
        expect(quakeExternalBrushModelPath(2, 'progs/bolt.bsp')).toBe(true);
        world.inlineModelReferences.set(11, world.playerReference);
        world.inlineModelReferences.set(12, world.playerReference);
        world.applyDemoPlayback(playback, startup.events, 0);

        const doorOrigins = new Map<number, readonly number[]>();
        const recordedDoorReferences = new Map<number, number>();
        while (!playback.finished && (doorOrigins.size < 2 ||
            [...doorOrigins.values()].some(origin => Math.abs(origin[1] ?? 0) < 79))) {
            const step = playback.advance(0.05);
            world.applyDemoPlayback(playback, step.events, 0.05);
            for (const [entityNumber] of playback.client.entities) {
                const state = playback.entityState(entityNumber);
                const model = state ? playback.client.serverInfo?.models[state.modelIndex] : '';
                const match = /^\*(\d+)$/u.exec(model ?? '');
                if (!match) continue;
                const modelIndex = Number(match[1]);
                expect(world.inlineModelReferences.get(modelIndex)).toBe(entityNumber);
                if ((modelIndex === 11 || modelIndex === 12) && state) {
                    doorOrigins.set(modelIndex, state.origin);
                    recordedDoorReferences.set(modelIndex, entityNumber);
                }
            }
        }

        expect(playback.client.stats[14]).toBe(5);
        expect(recordedDoorReferences.get(11)).toBe(25);
        expect(recordedDoorReferences.get(12)).toBe(26);
        expect(doorOrigins.get(11)?.[1]).toBeCloseTo(80);
        expect(doorOrigins.get(12)?.[1]).toBeCloseTo(-80);
    });

    it('retains demo sound-command order through the world adapter', () => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const playback = new QuakeDemoPlayback(parseQuakeDemo(pak.get('demo1.dem')));
        playback.start();
        const map = new BspMap(pak.get('maps/e1m3.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m3', undefined, pak
        );
        const sound = {
            attenuation: 1,
            channel: 3,
            entity: 2,
            origin: [1, 2, 3] as [number, number, number],
            sample: 'weapons/rocket1i.wav',
            soundIndex: 1,
            volume: 255
        };
        const stoppedSound = { channel: 3, entity: 2 };
        const events: QuakeDemoFrameEvents = {
            centerPrints: [],
            commands: [],
            damages: [],
            particles: [],
            prints: [],
            soundCommands: [
                { event: sound, kind: 'start' },
                { event: stoppedSound, kind: 'stop' },
                { event: stoppedSound, kind: 'stop' },
                { event: sound, kind: 'start' }
            ],
            sounds: [sound, sound],
            stoppedSounds: [stoppedSound, stoppedSound],
            stuffText: [],
            temporaryEntities: []
        };

        world.applyDemoPlayback(playback, [events], 0);

        expect(world.drainSoundCommands().map(command => command.kind)).toEqual([
            'start', 'stop', 'stop', 'start'
        ]);
    });

    it.each([
        ['demo1.dem', 2, 975, 'the Necropolis', 'maps/e1m3.bsp'],
        ['demo2.dem', -1, 991, 'the Grisly Grotto', 'maps/e1m4.bsp'],
        ['demo3.dem', -1, 1_096, 'The Door To Chthon', 'maps/e1m6.bsp']
    ])('decodes every framed protocol message in %s', (
        demoPath,
        forcedTrack,
        messageCount,
        levelName,
        worldModel
    ) => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const demo = parseQuakeDemo(pak.get(demoPath));
        const client = new QuakeDemoClient();
        for (const record of demo.messages) client.parseMessage(record);

        expect(demo.forcedTrack).toBe(forcedTrack);
        expect(demo.messages).toHaveLength(messageCount);
        expect(client.serverInfo?.levelName).toBe(levelName);
        expect(client.serverInfo?.models[1]).toBe(worldModel);
        expect(client.serverInfo?.protocol).toBe(15);
        expect(client.signon).toBe(4);
        expect(client.disconnected).toBe(true);
        expect(client.commandCounts.get('fastUpdate')).toBeGreaterThan(1_000);
        expect(client.commandCounts.get('clientData')).toBeGreaterThan(100);
        expect(client.staticEntities.length).toBeGreaterThan(0);
        expect(client.staticSounds.length).toBeGreaterThan(0);

        const playback = new QuakeDemoPlayback(demo);
        playback.start();
        for (let frame = 0; frame < 10_000 && !playback.finished; frame++) {
            playback.advance(0.05);
        }
        expect(playback.finished).toBe(true);
        expect(playback.active).toBe(true);
        expect(playback.messageIndex).toBe(messageCount);
        expect(playback.stop()).toBe(true);
        expect(playback.active).toBe(false);
    });
});
