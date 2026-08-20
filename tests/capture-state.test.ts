import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { BspMap } from '../src/formats/bsp';
import { PakArchive } from '../src/formats/pak';
import { QuakeProgram } from '../src/formats/progs';
import {
    QUAKE_DOG_LEAP_CAPTURE_FRAMES,
    QUAKE_DOG_DEATH_CAPTURE_FRAMES,
    QUAKE_DROWNING_BUBBLE_CAPTURE_FRAMES,
    QUAKE_DROWNING_BUBBLE_SPLIT_CAPTURE_FRAMES,
    QUAKE_EXPLOBOX_CAPTURE_FRAMES,
    QUAKE_BUTTON_DOOR_CAPTURE_FRAMES,
    QUAKE_GRENADE_CAPTURE_FRAMES,
    QUAKE_KNIGHT_MELEE_CAPTURE_FRAMES,
    QUAKE_KNIGHT_MELEE_CAPTURE_WARMUP_FRAMES,
    QUAKE_LIGHT_DOOR_CAPTURE_FRAMES,
    QUAKE_NAILGUN_CAPTURE_FRAMES,
    QUAKE_OGRE_GRENADE_CAPTURE_FRAMES,
    QUAKE_OGRE_GRENADE_CAPTURE_PREPARE_FRAMES,
    QUAKE_PLATFORM_CAPTURE_FRAMES,
    QUAKE_SHAMBLER_LIGHTNING_CAPTURE_WARMUP_FRAMES,
    QUAKE_WIZARD_TRACER_CAPTURE_FRAMES,
    QUAKE_SOLDIER_DEATH_CAPTURE_FRAMES,
    QUAKE_SOLDIER_GIB_CAPTURE_FRAMES,
    QUAKE_TELEPORT_CAPTURE_TIME,
    QUAKE_TOUCH_TRIGGER_DOOR_CAPTURE_FRAMES,
    advanceQuakeGrenadeCapture,
    advanceQuakeDogDeathCapture,
    advanceQuakeExploboxCapture,
    advanceQuakeNailgunCapture,
    advanceQuakeOgreGrenadeCapture,
    advanceQuakePlatformCapture,
    advanceQuakeRocketCapture,
    advanceQuakeSoldierDeathCapture,
    advanceQuakeSoldierGibCapture,
    advanceQuakeWizardTracerCapture,
    prepareQuakeButtonDoorCapture,
    prepareQuakeAxeHitCapture,
    prepareQuakeDogLeapCapture,
    prepareQuakeDogDeathCapture,
    prepareQuakeDrowningBubbleCapture,
    prepareQuakeExploboxCapture,
    prepareQuakeGrenadeCapture,
    prepareQuakeLightningCapture,
    prepareQuakeKnightMeleeCapture,
    prepareQuakeLightDoorCapture,
    prepareQuakeNailgunCapture,
    prepareQuakeOgreGrenadeCapture,
    prepareQuakePaletteCapture,
    prepareQuakePatrolCapture,
    prepareQuakePlatformCapture,
    prepareQuakeRocketCapture,
    prepareQuakeShamblerLightningCapture,
    prepareQuakeSecretDoorShotCapture,
    prepareQuakeShootableTriggerDoorCapture,
    prepareQuakeSilverKeyDoorCapture,
    prepareQuakeTriggeredSecretDoorCapture,
    prepareQuakeSoldierDeathCapture,
    prepareQuakeSoldierGibCapture,
    prepareQuakeTeleportCapture,
    prepareQuakeTouchTriggerDoorCapture,
    prepareQuakeTutorialMessageCapture,
    prepareQuakeWeaponPickupCapture,
    prepareQuakeWizardTracerCapture,
    setQuakePaletteCaptureTime,
    settleQuakePausedCapturePalette
} from '../src/game/capture-state';
import { WorldCollision } from '../src/game/collision';
import { QuakeVirtualMachine } from '../src/game/quake-vm';
import {
    QuakeWorldRuntime,
    type QuakePlayerState
} from '../src/game/quake-world';

const pakPath = path.resolve('.quake-data/id1/pak0.pak');
const describeWithPak = fs.existsSync(pakPath) ? describe : describe.skip;
const captureOrigin = [592, 90.666667, 80] as const;
const captureAngles = [0, 0, 0] as const;

describeWithPak('real E1M1 palette capture states', () => {
    const createWorld = (
        initialCvars: Readonly<Record<string, string>> = {},
        mapName = 'e1m1'
    ): QuakeWorldRuntime => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const map = new BspMap(pak.get(`maps/${mapName}.bsp`));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        return new QuakeWorldRuntime(
            vm,
            map,
            new WorldCollision(map),
            mapName,
            undefined,
            pak,
            initialCvars
        );
    };

    it('uses the original armor pickup for the bonus shift', () => {
        const world = createWorld();
        prepareQuakePaletteCapture(world, 'bonus', [...captureOrigin], [...captureAngles]);
        expect(world.bonusShift).toBe(49);
        expect(world.clientData()).toMatchObject({ armor: 100 });
    });

    it('uses the active single-player E1M1 super shotgun pickup', () => {
        const world = createWorld();
        prepareQuakeWeaponPickupCapture(
            world,
            [-360, 2912, -79.968_75],
            [0, 90, 0]
        );

        expect(world.clientData()).toMatchObject({
            activeWeapon: 2,
            ammo: 30,
            ammoShells: 30,
            weaponModel: 'progs/v_shot2.mdl'
        });
        expect(world.bonusShift).toBe(0);
        expect(world.time).toBeCloseTo(1.51);
        expect(world.time - world.itemGetTimes[1]).toBeCloseTo(0.5);
        expect(world.visibleNotifyLines()).not.toContain(
            'You got the Double-barrelled Shotgun'
        );
        expect(world.playerResult(false).origin).toEqual([
            -360, 2912, -79.968_75
        ]);
        expect(world.soundEvents.some(
            event => event.sample === 'weapons/pkup.wav'
        )).toBe(true);
    });

    it('freezes an authored E1M1 dog in its real airborne leap state', () => {
        const world = createWorld();
        const capture = prepareQuakeDogLeapCapture(
            world,
            [88, 1360, -199.968_75],
            [0, 90, 0]
        );
        const dogOrigin = world.vm.getEntityVector(capture.dogReference, 'origin');
        const dogVelocity = world.vm.getEntityVector(capture.dogReference, 'velocity');
        const touchFunction = world.vm.getEntityWord(capture.dogReference, 'touch');
        const touch = world.vm.program.functions[touchFunction];

        expect(QUAKE_DOG_LEAP_CAPTURE_FRAMES).toBe(7);
        expect(capture.initialDogOrigin).toEqual([88, 1520, -199.968_75]);
        expect(dogOrigin[1]).toBeLessThanOrEqual(capture.initialDogOrigin[1] - 60);
        expect(dogVelocity[1]).toBeLessThan(-250);
        expect(world.vm.getEntityFloat(capture.dogReference, 'frame')).toBe(62);
        expect(touch.name).toBe('Dog_JumpTouch');
        expect(world.clientData().health).toBe(100);
        expect(world.playerResult(false).origin).toEqual([88, 1360, -199.968_75]);
    });

    it('captures the original drowning bubble at the matched native server time', () => {
        const world = createWorld();
        const bubble = prepareQuakeDrowningBubbleCapture(
            world,
            [587, 1_007, -344],
            [-66.093_75, 0, 0]
        );

        expect(QUAKE_DROWNING_BUBBLE_CAPTURE_FRAMES).toBe(12);
        expect(world.time).toBeCloseTo(2.2);
        expect(world.vm.getEntityFloat(world.playerReference, 'health')).toBe(90);
        expect(world.vm.getEntityString(bubble, 'model')).toBe('progs/s_bubble.spr');
        expect(world.vm.getEntityVector(bubble, 'origin')).toEqual([587, 1_007, -318.5]);
        expect(world.vm.getEntityVector(bubble, 'velocity')).toEqual([0, 0, 15]);
        expect(world.vm.getEntityFloat(bubble, 'nextthink')).toBeCloseTo(2.7);
        expect(world.damageShift).toBe(0);
        expect(world.playerResult(false).damagePitch).toBe(0);
        expect(world.soundEvents.some(event => (
            event.entity === world.playerReference && /^player\/drown[12]\.wav$/u.test(event.sample)
        ))).toBe(true);
    });

    it('reaches sprite frame one through the original bubble_split think path', () => {
        const world = createWorld();
        const bubble = prepareQuakeDrowningBubbleCapture(
            world,
            [587, 1_007, -344],
            [-66.093_75, 0, 0],
            1
        );

        expect(QUAKE_DROWNING_BUBBLE_SPLIT_CAPTURE_FRAMES).toBe(10);
        expect(world.time).toBeCloseTo(3.2);
        expect({
            damage: world.vm.getEntityFloat(world.playerReference, 'dmg'),
            frame: world.vm.getEntityFloat(world.playerReference, 'frame'),
            health: world.vm.getEntityFloat(world.playerReference, 'health'),
            think: world.vm.program.functions[
            world.vm.getEntityWord(world.playerReference, 'think')
            ].name
        }).toEqual({
            damage: 8,
            frame: 35,
            health: 82,
            think: 'player_pain2'
        });
        expect(world.vm.getEntityFloat(world.playerReference, 'nextthink')).toBeCloseTo(3.2);
        expect(world.vm.getEntityFloat(world.playerReference, 'pain_finished')).toBeCloseTo(4.1);
        expect(world.vm.getEntityString(bubble, 'model')).toBe('progs/s_bubble.spr');
        expect(world.vm.getEntityFloat(bubble, 'frame')).toBe(1);
        expect(world.vm.getEntityFloat(bubble, 'cnt')).toBe(10);
        expect(world.vm.getEntityFloat(bubble, 'nextthink')).toBeCloseTo(3.6);
        expect(world.vm.getEntityVector(bubble, 'velocity')[2]).toBeGreaterThanOrEqual(15);
        expect(world.damageShift).toBe(0);
        expect(world.playerResult(false).damagePitch).toBe(0);
    });

    it('captures the first authored E1M2 ogre grenade through flight and impact', () => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const map = new BspMap(pak.get('maps/e1m2.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m2', undefined, pak
        );
        const capture = prepareQuakeOgreGrenadeCapture(
            world,
            [762, -190, 320],
            [-10, -5, 0]
        );

        expect(QUAKE_OGRE_GRENADE_CAPTURE_PREPARE_FRAMES).toBe(39);
        expect(world.time).toBeCloseTo(2.95);
        const prelaunchOrigin = vm.getEntityVector(capture.ogreReference, 'origin');
        expect(prelaunchOrigin[0]).toBeCloseTo(912.329_285);
        expect(prelaunchOrigin[1]).toBeCloseTo(-199.991_364);
        expect(prelaunchOrigin[2]).toBeCloseTo(320.031_25);
        expect(vm.getEntityWord(capture.ogreReference, 'enemy')).toBe(
            world.playerReference
        );
        expect(vm.program.functions[
        vm.getEntityWord(capture.ogreReference, 'think')
        ].name).toBe('ogre_nail4');

        expect(QUAKE_OGRE_GRENADE_CAPTURE_FRAMES.flight).toBe(3);
        for (let frame = 0; frame < QUAKE_OGRE_GRENADE_CAPTURE_FRAMES.flight; frame++) {
            advanceQuakeOgreGrenadeCapture(
                world,
                capture,
                frame === QUAKE_OGRE_GRENADE_CAPTURE_FRAMES.flight - 1 ?
                    'flight' : undefined
            );
        }
        expect(world.time).toBeCloseTo(3.1);
        const flightOrigin = vm.getEntityVector(capture.grenadeReference, 'origin');
        expect(flightOrigin[0]).toBeCloseTo(822.527_405);
        expect(flightOrigin[1]).toBeCloseTo(-194.022_901);
        expect(flightOrigin[2]).toBeCloseTo(338.031_25);
        expect(vm.getEntityFloat(world.playerReference, 'health')).toBe(100);
        expect(world.soundEvents.some(event => (
            event.entity === capture.ogreReference && event.sample === 'weapons/grenade.wav'
        ))).toBe(true);

        expect(QUAKE_OGRE_GRENADE_CAPTURE_FRAMES.impact).toBe(5);
        for (let frame = QUAKE_OGRE_GRENADE_CAPTURE_FRAMES.flight;
            frame < QUAKE_OGRE_GRENADE_CAPTURE_FRAMES.impact; frame++) {
            advanceQuakeOgreGrenadeCapture(
                world,
                capture,
                frame === QUAKE_OGRE_GRENADE_CAPTURE_FRAMES.impact - 1 ?
                    'impact' : undefined
            );
        }
        expect(world.time).toBeCloseTo(3.2);
        expect(vm.getEntityFloat(world.playerReference, 'health')).toBe(71);
        expect(world.damageShift).toBe(35);
        expect(world.damageShiftColor).toEqual([255, 0, 0]);
        expect(vm.getEntityFloat(capture.ogreReference, 'frame')).toBe(65);
        expect(capture.explosionEmitted).toBe(true);
    });

    it('captures the first authored E1M2 knight melee impact', () => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const map = new BspMap(pak.get('maps/e1m2.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m2', undefined, pak
        );
        const knight = prepareQuakeKnightMeleeCapture(
            world,
            [-578, -702, 480],
            [-10, 90, 0]
        );

        expect(QUAKE_KNIGHT_MELEE_CAPTURE_WARMUP_FRAMES).toBe(15);
        expect(QUAKE_KNIGHT_MELEE_CAPTURE_FRAMES).toBe(13);
        expect(world.time).toBeCloseTo(2.4);
        expect(vm.getEntityWord(knight, 'enemy')).toBe(world.playerReference);
        expect(vm.program.functions[vm.getEntityWord(knight, 'think')].name).toBe(
            'knight_atk7'
        );
        expect(vm.getEntityFloat(knight, 'frame')).toBe(48);
        expect(vm.getEntityVector(knight, 'origin')).toEqual([
            -578, -647, 480.03125
        ]);
        expect(vm.getEntityFloat(world.playerReference, 'health')).toBe(99);
        expect(world.damageShift).toBe(22);
        expect(world.damageShiftColor).toEqual([255, 0, 0]);
        expect(world.soundEvents.some(event => (
            event.entity === knight && event.sample === 'knight/sword1.wav'
        ))).toBe(true);
        expect(world.soundEvents.some(event => (
            event.entity === world.playerReference && event.sample === 'player/pain4.wav'
        ))).toBe(true);
    });

    it('shoots an E1M1 dog into its ordinary non-gib death sequence', () => {
        const world = createWorld();
        const capture = prepareQuakeDogDeathCapture(
            world,
            [480, -352, 88],
            [0, 90, 0]
        );

        expect(world.vm.getEntityFloat(capture.dogReference, 'health')).toBeLessThanOrEqual(0);
        expect(world.vm.getEntityFloat(capture.dogReference, 'health')).toBeGreaterThan(-35);
        expect(world.vm.getEntityFloat(capture.dogReference, 'solid')).toBe(0);
        expect(world.vm.getEntityFloat(capture.dogReference, 'takedamage')).toBe(0);
        expect(world.vm.program.functions[
        world.vm.getEntityWord(capture.dogReference, 'think')
        ].name).toMatch(/^dog_dieb?\d+$/);
        expect(world.soundEvents.some(event => (
            event.entity === capture.dogReference && event.sample === 'dog/ddeath.wav'
        ))).toBe(true);

        expect(QUAKE_DOG_DEATH_CAPTURE_FRAMES).toBe(6);
        for (let frame = 0; frame < QUAKE_DOG_DEATH_CAPTURE_FRAMES; frame++) {
            advanceQuakeDogDeathCapture(world, capture);
        }
        expect(world.time).toBeCloseTo(2.35, 7);
        expect(world.vm.getEntityFloat(capture.dogReference, 'frame')).toBe(20);
        expect(world.vm.program.functions[
        world.vm.getEntityWord(capture.dogReference, 'think')
        ].name).toBe('dog_dieb5');
        expect(world.vm.getEntityFloat(world.playerReference, 'weaponframe')).toBe(4);
        expect(world.vm.entity(capture.dogReference).free).toBe(false);
        expect(world.vm.getEntityString(capture.dogReference, 'model')).toBe('progs/dog.mdl');
        expect(world.playerResult(false).origin).toEqual([480, -352, 88]);
    });

    it('uses the original Quad pickup for the powerup shift', () => {
        const world = createWorld();
        prepareQuakePaletteCapture(world, 'quad', [...captureOrigin], [...captureAngles]);
        expect(world.clientData().items & (1 << 22)).not.toBe(0);
        expect(world.bonusShift).toBe(44);
        expect(Math.trunc(world.vm.getEntityFloat(world.playerReference, 'effects')) & 8).not.toBe(0);
        expect(world.dynamicLights.has(world.playerReference)).toBe(true);
        setQuakePaletteCaptureTime(world, 'quad', 1.5);
        expect(world.dynamicLights.get(world.playerReference)?.die).toBeGreaterThan(1.5);
        expect(world.viewPaletteShifts().at(-1)).toEqual({
            color: [0, 0, 255],
            percent: 30
        });
    });

    it('uses the original Biosuit pickup for protection and the green shift', () => {
        const world = createWorld();
        prepareQuakePaletteCapture(world, 'suit', [...captureOrigin], [...captureAngles]);
        const player = world.playerReference;

        expect(world.clientData().items & (1 << 21)).not.toBe(0);
        expect(world.bonusShift).toBe(44);
        expect(world.vm.getEntityFloat(player, 'radsuit_finished') - world.time)
        .toBeCloseTo(29.94);
        expect(world.soundEvents.some(event => event.sample === 'items/suit.wav')).toBe(true);
        expect(world.dynamicLights.has(player)).toBe(false);
        expect(world.viewPaletteShifts().at(-1)).toEqual({
            color: [0, 255, 0],
            percent: 20
        });

        world.update(0.1, {
            angles: [...captureAngles],
            attack: false,
            jump: false,
            onGround: false,
            origin: [...captureOrigin],
            velocity: [0, 0, 0],
            waterLevel: 3,
            waterType: -4
        });
        expect(world.clientData().health).toBe(100);
    });

    it('uses the original Pentagram pickup for protection, light, and yellow shift', () => {
        const world = createWorld({ deathmatch: '1' });
        prepareQuakePaletteCapture(
            world,
            'invulnerability',
            [...captureOrigin],
            [...captureAngles]
        );
        const player = world.playerReference;

        expect(world.clientData().items & (1 << 20)).not.toBe(0);
        expect(world.bonusShift).toBe(44);
        expect(world.vm.getEntityFloat(player, 'invincible_finished') - world.time)
        .toBeCloseTo(29.94);
        expect(Math.trunc(world.vm.getEntityFloat(player, 'effects')) & 8).toBe(8);
        expect(world.soundEvents.some(event => event.sample === 'items/protect.wav')).toBe(true);
        expect(world.dynamicLights.has(player)).toBe(true);
        setQuakePaletteCaptureTime(world, 'invulnerability', 1.5);
        expect(world.dynamicLights.get(player)?.die).toBeGreaterThan(1.5);
        expect(world.viewPaletteShifts().at(-1)).toEqual({
            color: [255, 255, 0],
            percent: 30
        });

        world.update(0.1, {
            angles: [...captureAngles],
            attack: false,
            jump: false,
            onGround: false,
            origin: [...captureOrigin],
            velocity: [0, 0, 0],
            waterLevel: 3,
            waterType: -4
        });
        expect(world.clientData().health).toBe(100);
        expect(world.soundEvents.some(event => event.sample === 'items/protect3.wav')).toBe(true);
    });

    it('uses E1M3\'s original Ring of Shadows pickup and eyes-only state', () => {
        const world = createWorld({}, 'e1m3');
        const player = world.playerReference;
        const pose = world.playerResult(false);
        prepareQuakePaletteCapture(world, 'invisibility', pose.origin, pose.angles);

        expect(world.clientData().items & (1 << 19)).not.toBe(0);
        expect(world.bonusShift).toBe(44);
        expect(world.vm.getEntityFloat(player, 'invisible_finished') - world.time)
        .toBeCloseTo(29.94);
        expect(world.vm.getEntityFloat(player, 'modelindex')).toBe(
            world.vm.getGlobalFloat('modelindex_eyes')
        );
        expect(world.soundEvents.some(event => event.sample === 'items/inv1.wav')).toBe(true);
        expect(world.viewPaletteShifts().at(-1)).toEqual({
            color: [100, 100, 100],
            percent: 100
        });
    });

    it.each([
        ['quad', 1 << 22, 'super_damage_finished', 'items/damage2.wav'],
        ['invisibility', 1 << 19, 'invisible_finished', 'items/inv2.wav'],
        ['invulnerability', 1 << 20, 'invincible_finished', 'items/protect2.wav'],
        ['suit', 1 << 21, 'radsuit_finished', 'items/suit2.wav']
    ] as const)('expires the original %s timer and item bit', (
        mode,
        item,
        finishedField,
        warningSample
    ) => {
        const world = createWorld(
            mode === 'invulnerability' ? { deathmatch: '1' } : {},
            mode === 'invisibility' ? 'e1m3' : 'e1m1'
        );
        const pose = world.playerResult(false);
        prepareQuakePaletteCapture(world, mode, pose.origin, pose.angles);
        const player = world.playerReference;
        const finished = world.vm.getEntityFloat(player, finishedField);
        world.soundEvents.length = 0;
        const state: QuakePlayerState = {
            angles: [...captureAngles],
            attack: false,
            jump: false,
            onGround: true,
            origin: [...captureOrigin],
            velocity: [0, 0, 0]
        };
        while (world.time <= finished + 0.1) world.update(0.1, state);
        world.update(0.1, state);

        expect(world.clientData().items & item).toBe(0);
        expect(world.vm.getEntityFloat(player, finishedField)).toBe(0);
        expect(world.soundEvents.some(event => event.sample === warningSample)).toBe(true);
        expect(world.dynamicLights.has(player)).toBe(false);
        if (mode === 'invisibility') {
            expect(world.vm.getEntityFloat(player, 'modelindex')).toBe(
                world.vm.getGlobalFloat('modelindex_player')
            );
        }
    });

    it('uses original QuakeC slime damage for the damage shift', () => {
        const world = createWorld();
        prepareQuakePaletteCapture(world, 'damage', [...captureOrigin], [...captureAngles]);
        expect(world.clientData().health).toBe(88);
        expect(world.damageShift).toBe(28);
        expect(world.damageShiftColor).toEqual([255, 0, 0]);
    });

    it('decays client color shifts while server simulation remains paused', () => {
        const world = createWorld();
        const serverTime = world.time;
        world.damageShift = 30;
        world.bonusShift = 20;
        world.damageKickPitch = 6;
        world.damageKickTime = 0.5;

        world.advanceClientViewEffects(0.05);

        expect(world.damageShift).toBe(22);
        expect(world.bonusShift).toBe(15);
        expect(world.playerResult(false).damagePitch).toBeCloseTo(5.4);
        expect(world.time).toBe(serverTime);
    });
});

describeWithPak('real E1M2 key-door capture state', () => {
    it('uses the authored silver key and freezes both paired leaves open', () => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const map = new BspMap(pak.get('maps/e1m2.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m2', undefined, pak
        );
        const capture = prepareQuakeSilverKeyDoorCapture(
            world,
            [272, -400, 328],
            [0, 90, 0]
        );

        expect(world.time).toBeCloseTo(6);
        expect(vm.getEntityString(capture.keyReference, 'model')).toBe('');
        expect(vm.getEntityFloat(capture.keyReference, 'solid')).toBe(0);
        expect(Math.trunc(vm.getEntityFloat(world.playerReference, 'items')) & 131_072)
        .toBe(0);
        expect(capture.doorReferences.map(
            reference => vm.getEntityVector(reference, 'origin')
        )).toEqual(capture.doorReferences.map(
            reference => vm.getEntityVector(reference, 'pos2')
        ));
        expect(capture.doorReferences.every(reference => (
            vm.program.functions[vm.getEntityWord(reference, 'touch')]?.name === 'SUB_Null'
        ))).toBe(true);
        expect(capture.doorModelIndices.map(modelIndex => (
            world.collision.brushColliders.find(
                collider => collider.modelIndex === modelIndex
            )?.origin
        ))).toEqual(capture.doorReferences.map(
            reference => vm.getEntityVector(reference, 'origin')
        ));
        expect(world.playerResult(false).origin).toEqual([272, -400, 328]);
        expect(world.visibleNotifyLines()).toEqual([]);
        expect(world.visibleCenterMessage()).toBe('');
    });
});

describeWithPak('real E1M7 Shambler lightning capture state', () => {
    it('uses an authored Shambler and preserves its TE_LIGHTNING1 beam', () => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const map = new BspMap(pak.get('maps/e1m7.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m7', undefined, pak
        );

        const capture = prepareQuakeShamblerLightningCapture(
            world,
            [1_864, 0, 24],
            [0, 94, 0]
        );
        const beam = world.activeBeams().find(active => (
            active.entity === capture.shamblerReference
        ));

        expect(QUAKE_SHAMBLER_LIGHTNING_CAPTURE_WARMUP_FRAMES).toBe(15);
        expect(world.time).toBeCloseTo(3.8);
        expect(vm.getEntityFloat(world.playerReference, 'health')).toBe(100);
        expect(world.damageShift).toBe(0);
        expect(vm.program.functions[
        vm.getEntityWord(capture.shamblerReference, 'think')
        ]?.name).toBe('sham_magic9');
        expect(vm.getEntityFloat(capture.shamblerReference, 'frame')).toBe(70);
        expect(vm.getEntityWord(capture.shamblerReference, 'enemy')).toBe(
            world.playerReference
        );
        expect(beam).toMatchObject({
            entity: capture.shamblerReference,
            model: 'progs/bolt.mdl'
        });
        expect(Math.hypot(...beam!.end.map(
            (component, axis) => component - beam!.start[axis]
        ))).toBeGreaterThan(100);
        expect(world.soundEvents.some(event => (
            event.entity === capture.shamblerReference &&
            event.sample === 'shambler/sattck1.wav'
        ))).toBe(true);
    });
});

describeWithPak('real E1M4 Wizard tracer capture state', () => {
    it('uses an authored Wizard and preserves its EF_TRACER projectile flight', () => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const map = new BspMap(pak.get('maps/e1m4.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m4', undefined, pak
        );

        const capture = prepareQuakeWizardTracerCapture(
            world,
            [-256, 2_272, 1_240],
            [0, 270, 0]
        );
        const initialOrigin = vm.getEntityVector(capture.projectileReference, 'origin');
        for (let frame = 0; frame < QUAKE_WIZARD_TRACER_CAPTURE_FRAMES; frame++) {
            advanceQuakeWizardTracerCapture(world, capture);
        }

        expect(vm.getEntityWord(capture.wizardReference, 'enemy')).toBe(
            world.playerReference
        );
        expect(Math.hypot(...capture.initialWizardOrigin.map(
            (component, axis) => component - capture.playerState.origin[axis]
        ))).toBeGreaterThanOrEqual(192);
        expect(vm.getEntityString(capture.projectileReference, 'model')).toBe(
            'progs/w_spike.mdl'
        );
        expect(vm.getEntityWord(capture.projectileReference, 'owner')).toBe(
            capture.wizardReference
        );
        expect(Math.hypot(...vm.getEntityVector(capture.projectileReference, 'origin').map(
            (component, axis) => component - initialOrigin[axis]
        ))).toBeGreaterThan(20);
        expect(world.vm.getEntityFloat(world.playerReference, 'health')).toBe(100);
    });
});

describeWithPak('real E1M1 effect capture states', () => {
    const createEffectWorld = (): QuakeWorldRuntime => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        return new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m1', undefined, pak
        );
    };

    it('fires the original QuakeC lightning gun and preserves its beam frame', () => {
        const world = createEffectWorld();

        prepareQuakeLightningCapture(world, [480, -352, 88], [0, 60, 0]);

        expect(world.time).toBeCloseTo(2.1);
        expect(world.time - world.itemGetTimes[6]).toBeGreaterThan(0.5);
        expect(world.clientData()).toMatchObject({
            activeWeapon: 64,
            ammo: 29,
            ammoCells: 29,
            weaponFrame: 1,
            weaponModel: 'progs/v_light.mdl'
        });
        expect(world.activeBeams()).toEqual([
            expect.objectContaining({
                entity: world.playerReference,
                model: 'progs/bolt2.mdl',
                start: [480, -352, 88]
            })
        ]);
        expect(world.dynamicLights.has(world.playerReference)).toBe(true);
        expect(world.soundEvents.some(event => event.sample === 'weapons/lstart.wav')).toBe(true);
    });

    it('picks up E1M1\'s authored nailgun and preserves its spike flight', () => {
        const world = createEffectWorld();
        const capture = prepareQuakeNailgunCapture(
            world,
            [480, -352, 88],
            [0, 90, 0]
        );

        expect(world.clientData()).toMatchObject({
            activeWeapon: 4,
            ammo: 29,
            ammoNails: 29,
            weaponFrame: 1,
            weaponModel: 'progs/v_nail.mdl'
        });
        expect(world.vm.getEntityString(capture.spikeReference, 'model')).toBe(
            'progs/spike.mdl'
        );
        expect(world.vm.getEntityWord(capture.spikeReference, 'owner')).toBe(
            world.playerReference
        );
        expect(world.vm.program.functions[
        world.vm.getEntityWord(capture.spikeReference, 'touch')
        ].name).toBe('spike_touch');
        expect(world.soundEvents.some(
            event => event.sample === 'weapons/pkup.wav'
        )).toBe(true);
        expect(world.soundEvents.some(
            event => event.sample === 'weapons/rocket1i.wav'
        )).toBe(true);
        const initialOrigin = world.vm.getEntityVector(capture.spikeReference, 'origin');

        for (let frame = 0; frame < QUAKE_NAILGUN_CAPTURE_FRAMES; frame++) {
            advanceQuakeNailgunCapture(world, capture);
        }

        expect(world.time).toBeCloseTo(2.15);
        expect(Math.hypot(...world.vm.getEntityVector(capture.spikeReference, 'origin').map(
            (component, axis) => component - initialOrigin[axis]
        ))).toBeGreaterThan(40);
        expect(world.vm.getEntityString(capture.spikeReference, 'model')).toBe(
            'progs/spike.mdl'
        );
        expect(world.playerResult(false).origin).toEqual([480, -352, 88]);
    });

    it('activates and rides E1M1\'s authored platform at the native midpoint', () => {
        const world = createEffectWorld();
        const capture = prepareQuakePlatformCapture(
            world,
            [-544, 2656, -96],
            [0, 90, 0]
        );

        expect(capture.initialPlatformOrigin).toEqual([0, 0, -152]);
        expect(world.vm.getEntityFloat(capture.platformReference, 'state')).toBe(1);
        expect(world.vm.getEntityVector(capture.platformReference, 'pos2')).toEqual(
            [0, 0, -152]
        );

        for (let frame = 0; frame < QUAKE_PLATFORM_CAPTURE_FRAMES; frame++) {
            advanceQuakePlatformCapture(world, capture);
        }

        expect(world.time).toBeCloseTo(1.5);
        expect(world.vm.getEntityFloat(capture.platformReference, 'state')).toBe(2);
        expect(world.vm.getEntityVector(capture.platformReference, 'origin')).toEqual(
            [0, 0, -77]
        );
        expect(world.playerResult(false).origin).toEqual([-544, 2656, -21]);
        expect(world.vm.getEntityWord(world.playerReference, 'groundentity')).toBe(
            capture.platformReference
        );
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === capture.platformModelIndex
        )?.origin).toEqual([0, 0, -77]);
        expect(world.soundEvents.some(
            event => event.entity === capture.platformReference &&
                event.sample === 'plats/plat1.wav'
        )).toBe(true);
    });

    it('presses E1M1\'s first button and preserves its moving door state', () => {
        const world = createEffectWorld();
        const capture = prepareQuakeButtonDoorCapture(
            world,
            [40, 576, 56],
            [20, 180, 0]
        );

        expect(QUAKE_BUTTON_DOOR_CAPTURE_FRAMES).toBe(20);
        expect(world.time).toBeCloseTo(3);
        expect(world.vm.getEntityVector(capture.buttonReference, 'origin')).toEqual(
            world.vm.getEntityVector(capture.buttonReference, 'pos2')
        );
        expect(world.vm.getEntityFloat(capture.buttonReference, 'state')).toBe(0);
        expect(world.vm.getEntityFloat(capture.buttonReference, 'frame')).toBe(1);
        expect(world.vm.getEntityFloat(capture.doorReference, 'state')).toBe(2);
        expect(world.vm.getEntityVector(capture.doorReference, 'origin')[2])
        .toBeCloseTo(-90);
        expect(world.vm.getEntityVector(capture.doorReference, 'velocity')[2])
        .toBeCloseTo(-100);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === capture.buttonModelIndex
        )?.origin).toEqual(world.vm.getEntityVector(capture.buttonReference, 'origin'));
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === capture.doorModelIndex
        )?.origin).toEqual(world.vm.getEntityVector(capture.doorReference, 'origin'));
        expect(world.soundEvents.some(event => (
            event.entity === capture.buttonReference ||
            event.entity === capture.doorReference
        ))).toBe(true);
    });

    it('shoots E1M1\'s authored secret door at the native screenshot frame', () => {
        const world = createEffectWorld();
        const capture = prepareQuakeSecretDoorShotCapture(
            world,
            [688, 23, 79],
            [48, 127, 0]
        );

        expect(world.time).toBeCloseTo(2.05);
        expect(world.clientData()).toMatchObject({
            activeWeapon: 1,
            ammo: 24,
            ammoShells: 24,
            weaponFrame: 1,
            weaponModel: 'progs/v_shot.mdl'
        });
        expect(world.vm.getEntityString(capture.doorReference, 'model')).toBe('*43');
        expect(world.vm.getEntityFloat(capture.doorReference, 'takedamage')).toBe(0);
        expect(world.vm.getEntityString(capture.doorReference, 'message')).toBe('');
        expect(world.vm.getEntityVector(capture.doorReference, 'origin')).not.toEqual(
            capture.initialDoorOrigin
        );
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === 43
        )?.origin).toEqual(world.vm.getEntityVector(capture.doorReference, 'origin'));
        expect(world.soundEvents.some(event => (
            event.entity === capture.doorReference &&
            event.sample === world.vm.getEntityString(capture.doorReference, 'noise2')
        ))).toBe(true);
    });

    it('opens E1M1\'s authored t3 trigger secret and switches its lights', () => {
        const world = createEffectWorld();
        const initialLightStyle = world.lightStyles.get(32);
        const capture = prepareQuakeTriggeredSecretDoorCapture(
            world,
            [32, 2_352, 56],
            [0, 0, 0]
        );

        expect(world.time).toBeCloseTo(6);
        expect(world.vm.getEntityVector(capture.doorReference, 'origin')).toEqual(
            world.vm.getEntityVector(capture.doorReference, 'dest2')
        );
        expect(world.vm.getEntityVector(capture.doorReference, 'origin')).not.toEqual(
            capture.initialDoorOrigin
        );
        expect(world.vm.getEntityVector(capture.doorReference, 'velocity')).toEqual(
            [0, 0, 0]
        );
        expect(world.vm.program.functions[
        world.vm.getEntityWord(capture.triggerReference, 'touch')
        ]?.name).toBe('SUB_Null');
        expect(world.lightStyles.get(32)).not.toBe(initialLightStyle);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === capture.doorModelIndex
        )?.origin).toEqual(world.vm.getEntityVector(capture.doorReference, 'origin'));
        expect(world.clientData()).toMatchObject({
            activeWeapon: 4,
            ammo: 30,
            ammoNails: 30,
            ammoShells: 25,
            weaponModel: 'progs/v_nail.mdl'
        });
        expect(world.playerResult(false).origin).toEqual([32, 2_352, 56]);
    });

    it('opens E1M1\'s authored t18 secret door through its touch trigger', () => {
        expect(QUAKE_TOUCH_TRIGGER_DOOR_CAPTURE_FRAMES).toBe(10);
        const world = createEffectWorld();
        const capture = prepareQuakeTouchTriggerDoorCapture(
            world,
            [-368, 2_896, -44],
            [0, 0, 0]
        );

        expect(world.time).toBeCloseTo(1.5);
        expect(world.vm.getEntityString(capture.doorReference, 'model')).toBe('*41');
        expect(world.vm.getEntityString(capture.triggerReference, 'model')).toBe('');
        expect(world.vm.getEntityWord(capture.triggerReference, 'enemy')).toBe(
            world.playerReference
        );
        expect(world.vm.getEntityVector(capture.doorReference, 'origin')).not.toEqual(
            capture.initialDoorOrigin
        );
        expect(world.vm.getEntityVector(capture.doorReference, 'velocity')).toEqual([0, 0, 0]);
        expect(world.bonusShift).toBe(0);
        expect(world.itemGetTimes[1]).toBe(world.time);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === capture.doorModelIndex
        )?.origin).toEqual(world.vm.getEntityVector(capture.doorReference, 'origin'));
        expect(world.playerResult(false)).toMatchObject({
            moveType: 8,
            origin: [-368, 2_896, -44]
        });
    });

    it('fires E1M1\'s authored t11 light-and-door chain for capture', () => {
        expect(QUAKE_LIGHT_DOOR_CAPTURE_FRAMES).toBe(10);
        const world = createEffectWorld();
        const capture = prepareQuakeLightDoorCapture(
            world,
            [800, 2_384, -80],
            [12, 262, 0]
        );

        expect(world.time).toBeCloseTo(1.5);
        expect(world.vm.entity(capture.triggerReference).free).toBe(true);
        expect(world.lightStyles.get(capture.lightStyle)).toBe('m');
        expect(world.vm.program.functions[
        world.vm.getEntityWord(capture.lightReference, 'use')
        ]?.name).toBe('light_use');
        expect(world.vm.getEntityString(capture.doorReference, 'model')).toBe('*34');
        expect(world.vm.getEntityVector(capture.doorReference, 'origin')).not.toEqual(
            capture.initialDoorOrigin
        );
        expect(world.vm.getEntityVector(capture.doorReference, 'velocity')).toEqual([0, 0, 0]);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === capture.doorModelIndex
        )?.origin).toEqual(world.vm.getEntityVector(capture.doorReference, 'origin'));
        expect(world.playerResult(false)).toMatchObject({
            moveType: 8,
            origin: [800, 2_384, -80]
        });
    });

    it.each([
        ['t31', [616, 192, 40], 'You can jump up here...'],
        ['t32', [348, 480, 56.03125], 'You can jump across...']
    ] as const)('touches E1M1\'s authored %s tutorial volume for capture', (
        targetname,
        origin,
        message
    ) => {
        const world = createEffectWorld();
        const capture = prepareQuakeTutorialMessageCapture(
            world,
            [...origin],
            [0, 90, 0],
            targetname
        );

        expect(world.time).toBeCloseTo(1.55);
        expect(world.visibleCenterMessage()).toBe(message);
        expect(world.vm.getEntityString(capture.triggerReference, 'model')).toBe('');
        expect(world.vm.getEntityFloat(capture.triggerReference, 'modelindex')).toBe(0);
        if (targetname === 't31') {
            expect(world.vm.getEntityVector(capture.triggerReference, 'mins')).toEqual(
                [592, 64, 16]
            );
            expect(world.vm.getEntityVector(capture.triggerReference, 'maxs')).toEqual(
                [640, 320, 64]
            );
        }
        expect(world.vm.getEntityFloat(capture.triggerReference, 'nextthink')).toBeCloseTo(
            6
        );
        expect(world.soundEvents.some(event => (
            event.entity === capture.triggerReference &&
            event.channel === 2 &&
            event.sample === 'misc/talk.wav'
        ))).toBe(true);
        expect(world.playerResult(false).origin).toEqual(origin);
    });

    it('preserves the original QuakeC rocket flight and impact frames', () => {
        const world = createEffectWorld();
        const capture = prepareQuakeRocketCapture(world, [480, -352, 88], [0, 60, 0]);

        expect(world.time).toBeCloseTo(2);
        expect(world.time - world.itemGetTimes[5]).toBeGreaterThan(0.5);
        expect(world.clientData()).toMatchObject({
            activeWeapon: 32,
            ammo: 29,
            ammoRockets: 29,
            weaponModel: 'progs/v_rock2.mdl'
        });
        expect(world.vm.getEntityString(capture.rocketReference, 'model')).toBe(
            'progs/missile.mdl'
        );
        expect(world.vm.getEntityWord(capture.rocketReference, 'owner')).toBe(
            world.playerReference
        );
        expect(world.soundEvents.some(event => event.sample === 'weapons/sgun1.wav')).toBe(true);
        const initialOrigin = world.vm.getEntityVector(capture.rocketReference, 'origin');
        advanceQuakeRocketCapture(world, capture, 'flight');
        expect(world.vm.getEntityVector(world.playerReference, 'v_angle')).toEqual([
            0, 57.65625, 0
        ]);
        expect(Math.hypot(...world.vm.getEntityVector(capture.rocketReference, 'origin').map(
            (component, axis) => component - initialOrigin[axis]
        ))).toBeGreaterThan(40);

        advanceQuakeRocketCapture(world, capture, 'impact');
        expect(world.time).toBeCloseTo(2.1);
        expect(world.vm.getEntityVector(capture.rocketReference, 'origin')).toEqual([
            556.7553100585938, -230.7900848388672, 104
        ]);
        expect(world.vm.getEntityFloat(capture.rocketReference, 'nextthink')).toBeCloseTo(
            2.15
        );
        expect(world.clientData().weaponFrame).toBe(2);
        expect(world.vm.getEntityString(capture.rocketReference, 'model')).toBe(
            'progs/s_explod.spr'
        );
        expect(world.activeDynamicLights().some(light => light.radius >= 300)).toBe(true);
        expect(world.soundEvents.some(event => event.sample === 'weapons/r_exp3.wav')).toBe(true);
        expect(world.particleEvents).toContainEqual(expect.objectContaining({
            count: 1_024,
            kind: 'explosion'
        }));
        expect(world.damageShift).toBeGreaterThan(0);
        const impactTime = world.time;
        settleQuakePausedCapturePalette(world);
        expect(world.damageShift).toBe(0);
        expect(world.bonusShift).toBe(0);
        expect(world.time).toBe(impactTime);
    });

    it('shoots E1M1\'s authored explosive box into its original sprite sequence', () => {
        const world = createEffectWorld();
        const capture = prepareQuakeExploboxCapture(
            world,
            [216, 2072, -199.96875],
            [0, 180, 0]
        );

        expect(world.time).toBeCloseTo(2.05);
        expect(world.vm.getEntityString(capture.barrelReference, 'classname')).toBe(
            'explo_box'
        );
        expect(world.vm.getEntityString(capture.barrelReference, 'model')).toBe(
            'progs/s_explod.spr'
        );
        expect(world.vm.getEntityFloat(capture.barrelReference, 'frame')).toBe(0);
        expect(world.clientData()).toMatchObject({
            ammo: 24,
            ammoShells: 24,
            health: 12,
            weaponModel: 'progs/v_shot.mdl'
        });
        expect(world.soundEvents.some(event => (
            event.entity === capture.barrelReference &&
            event.sample === 'weapons/r_exp3.wav'
        ))).toBe(true);
        expect(world.particleEvents.some(event => event.kind === 'explosion')).toBe(false);

        for (let frame = 0; frame < QUAKE_EXPLOBOX_CAPTURE_FRAMES; frame++) {
            advanceQuakeExploboxCapture(world, capture);
        }
        expect(world.time).toBeCloseTo(2.15);
        expect(world.vm.getEntityFloat(capture.barrelReference, 'frame')).toBe(1);
        expect(world.vm.program.functions[
        world.vm.getEntityWord(capture.barrelReference, 'think')
        ].name).toBe('s_explode3');
        expect(world.playerResult(false).origin).toEqual([216, 2072, -199.96875]);
    });

    it('fires and advances the original QuakeC bouncing grenade', () => {
        const world = createEffectWorld();
        const capture = prepareQuakeGrenadeCapture(world, [480, 200, 88], [0, 90, 0]);

        expect(world.time).toBeCloseTo(2);
        expect(world.time - world.itemGetTimes[4]).toBeGreaterThan(0.5);
        expect(world.clientData()).toMatchObject({
            activeWeapon: 16,
            ammo: 29,
            ammoRockets: 29,
            weaponModel: 'progs/v_rock.mdl'
        });
        expect(world.vm.getEntityString(capture.grenadeReference, 'model')).toBe(
            'progs/grenade.mdl'
        );
        expect(world.vm.getEntityWord(capture.grenadeReference, 'owner')).toBe(
            world.playerReference
        );
        expect(world.soundEvents.some(event => event.sample === 'weapons/grenade.wav')).toBe(true);

        const initialOrigin = world.vm.getEntityVector(capture.grenadeReference, 'origin');
        for (let frame = 1; frame <= QUAKE_GRENADE_CAPTURE_FRAMES.flight; frame++) {
            advanceQuakeGrenadeCapture(
                world,
                capture,
                frame === QUAKE_GRENADE_CAPTURE_FRAMES.flight ? 'flight' : undefined
            );
        }
        expect(Math.hypot(...world.vm.getEntityVector(capture.grenadeReference, 'origin').map(
            (component, axis) => component - initialOrigin[axis]
        ))).toBeGreaterThan(25);
        expect(world.vm.getEntityVector(capture.grenadeReference, 'origin').map(
            Math.round
        )).toEqual([480, 470, 88]);
        expect(world.time).toBeCloseTo(2.4);
        expect(world.clientData().weaponFrame).toBe(5);
        expect(world.vm.getEntityFloat(capture.grenadeReference, 'nextthink')).toBeCloseTo(
            4.45
        );

        for (let frame = QUAKE_GRENADE_CAPTURE_FRAMES.flight + 1;
            frame <= QUAKE_GRENADE_CAPTURE_FRAMES.bounce; frame++) {
            advanceQuakeGrenadeCapture(
                world,
                capture,
                frame === QUAKE_GRENADE_CAPTURE_FRAMES.bounce ? 'bounce' : undefined
            );
        }
        expect(world.soundEvents.some(event => event.sample === 'weapons/bounce.wav')).toBe(true);
        expect(world.vm.getEntityVector(capture.grenadeReference, 'origin').map(
            Math.round
        )).toEqual([480, 647, 0]);
        expect(world.time).toBeCloseTo(2.7);
        expect(world.clientData().weaponFrame).toBe(0);

        for (let frame = QUAKE_GRENADE_CAPTURE_FRAMES.bounce + 1;
            frame <= QUAKE_GRENADE_CAPTURE_FRAMES.explosion; frame++) {
            advanceQuakeGrenadeCapture(
                world,
                capture,
                frame === QUAKE_GRENADE_CAPTURE_FRAMES.explosion ?
                    'explosion' : undefined
            );
        }
        expect(world.vm.getEntityString(capture.grenadeReference, 'model')).toBe(
            'progs/s_explod.spr'
        );
        expect(world.activeDynamicLights().some(light => light.radius >= 300)).toBe(true);
        expect(world.vm.getEntityVector(capture.grenadeReference, 'origin').map(
            Math.round
        )).toEqual([480, 648, 0]);
        expect(world.time).toBeCloseTo(4.5);
        expect(capture.explosionEmitted).toBe(true);
        expect(world.clientData().weaponFrame).toBe(0);
        expect(world.soundEvents.some(event => event.sample === 'weapons/r_exp3.wav')).toBe(true);
        expect(world.particleEvents).toContainEqual(expect.objectContaining({
            count: 1_024,
            kind: 'explosion'
        }));
    });

    it('gibs a real E1M1 soldier with the original rocket damage path', () => {
        const world = createEffectWorld();
        const capture = prepareQuakeSoldierGibCapture(
            world,
            [480, -352, 88],
            [0, 90, 0]
        );

        expect(world.vm.getEntityVector(capture.soldierReference, 'origin').map(
            Math.round
        )).toEqual([480, -152, 88]);
        for (let frame = 1; frame <= QUAKE_SOLDIER_GIB_CAPTURE_FRAMES.impact; frame++) {
            advanceQuakeSoldierGibCapture(
                world,
                capture,
                frame === QUAKE_SOLDIER_GIB_CAPTURE_FRAMES.impact ?
                    'impact' : undefined
            );
        }

        expect(world.time).toBeCloseTo(2.15);
        expect(world.vm.getGlobalFloat('killed_monsters')).toBe(1);
        expect(world.vm.getEntityFloat(capture.soldierReference, 'health')).toBeLessThan(-35);
        expect(capture.gibReferences.map(
            reference => world.vm.getEntityString(reference, 'model')
        ).sort()).toEqual([
            'progs/gib1.mdl',
            'progs/gib2.mdl',
            'progs/gib3.mdl',
            'progs/h_guard.mdl'
        ]);
        expect(world.soundEvents.some(event => event.sample === 'player/udeath.wav')).toBe(true);
        expect(world.soundEvents.some(event => event.sample === 'weapons/r_exp3.wav')).toBe(true);
        expect(world.activeDynamicLights().some(light => light.radius >= 300)).toBe(true);

        const impactOrigins = capture.gibReferences.map(
            reference => world.vm.getEntityVector(reference, 'origin')
        );
        for (let frame = QUAKE_SOLDIER_GIB_CAPTURE_FRAMES.impact + 1;
            frame <= QUAKE_SOLDIER_GIB_CAPTURE_FRAMES.trail; frame++) {
            advanceQuakeSoldierGibCapture(
                world,
                capture,
                frame === QUAKE_SOLDIER_GIB_CAPTURE_FRAMES.trail ? 'trail' : undefined
            );
        }
        expect(world.time).toBeCloseTo(2.3);
        expect(capture.gibReferences.some((reference, index) => (
            world.vm.getEntityVector(reference, 'origin').some(
                (component, axis) => component !== impactOrigins[index][axis]
            )
        ))).toBe(true);
    });

    it('freezes an ordinary soldier corpse produced by the starting shotgun', () => {
        const world = createEffectWorld();
        const capture = prepareQuakeSoldierDeathCapture(
            world,
            [480, -352, 88],
            [0, 90, 0]
        );

        expect(world.time).toBeCloseTo(2.05);
        expect(world.vm.getEntityVector(capture.soldierReference, 'origin').map(
            Math.round
        )).toEqual([480, -256, 88]);
        expect(world.vm.getEntityFloat(capture.soldierReference, 'health')).toBeGreaterThan(-35);
        expect(world.vm.getEntityFloat(capture.soldierReference, 'health')).toBeLessThanOrEqual(0);
        expect(world.vm.getEntityFloat(capture.soldierReference, 'solid')).toBe(3);
        expect(world.soundEvents.some(
            event => event.sample === 'soldier/death1.wav'
        )).toBe(true);
        expect(world.vm.edicts.some((edict, reference) => (
            !edict.free && ['progs/h_guard.mdl', 'progs/gib1.mdl',
                'progs/gib2.mdl', 'progs/gib3.mdl'].includes(
                world.vm.getEntityString(reference, 'model')
            )
        ))).toBe(false);

        for (let frame = 0; frame < QUAKE_SOLDIER_DEATH_CAPTURE_FRAMES; frame++) {
            advanceQuakeSoldierDeathCapture(world, capture);
        }

        const corpseThinkIndex = world.vm.getEntityWord(capture.soldierReference, 'think');
        const corpseThink = world.vm.program.functions[corpseThinkIndex].name;
        expect(world.time).toBeCloseTo(2.45);
        expect(world.vm.getEntityFloat(capture.soldierReference, 'solid')).toBe(0);
        expect(world.vm.getEntityFloat(capture.soldierReference, 'frame')).toBe(12);
        expect(corpseThink).toBe('army_die6');
        expect(world.vm.getEntityFloat(world.playerReference, 'weaponframe')).toBe(5);
        expect(world.vm.getGlobalFloat('killed_monsters')).toBe(1);
    });

    it('hits an authored E1M1 soldier through the original axe attack', () => {
        const world = createEffectWorld();
        const capture = prepareQuakeAxeHitCapture(
            world,
            [480, -352, 88],
            [0, 90, 0]
        );

        expect(world.time).toBeCloseTo(2.3);
        expect(world.vm.getEntityVector(capture.soldierReference, 'origin').map(
            Math.round
        )).toEqual([480, -304, 88]);
        expect(world.vm.getEntityFloat(capture.soldierReference, 'health')).toBe(
            capture.initialHealth - 20
        );
        expect({
            frame: world.vm.getEntityFloat(capture.soldierReference, 'frame'),
            think: world.vm.program.functions[
            world.vm.getEntityWord(capture.soldierReference, 'think')
            ]?.name
        }).toEqual({ frame: 60, think: 'army_painc2' });
        expect(world.clientData()).toMatchObject({
            activeWeapon: 0,
            ammo: 0,
            ammoShells: 25,
            weaponModel: 'progs/v_axe.mdl'
        });
        expect(world.particleEvents).toContainEqual(expect.objectContaining({
            color: 73,
            count: 40
        }));
        expect(world.soundEvents.some(
            event => event.sample === 'weapons/ax1.wav'
        )).toBe(true);
        expect(world.soundEvents.some(
            event => /^soldier\/pain[12]\.wav$/u.test(event.sample)
        )).toBe(true);
    });

    it('opens E1M1\'s authored t4 door through its shootable trigger', () => {
        const world = createEffectWorld();
        const capture = prepareQuakeShootableTriggerDoorCapture(
            world,
            [448, 1956, -104],
            [0, 86.18592516570965, 0]
        );

        expect(world.time).toBeCloseTo(2.3);
        expect(world.vm.getEntityFloat(capture.triggerReference, 'health')).toBeLessThanOrEqual(
            0
        );
        expect(world.vm.getEntityFloat(capture.triggerReference, 'takedamage')).toBe(0);
        expect(world.vm.getEntityFloat(capture.doorReference, 'state')).toBe(2);
        expect(world.vm.getEntityVector(capture.doorReference, 'origin')).not.toEqual(
            capture.initialDoorOrigin
        );
        expect(world.vm.getEntityString(capture.doorReference, 'model')).toBe('*15');
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === 15
        )?.origin).toEqual(world.vm.getEntityVector(capture.doorReference, 'origin'));
    });

    it('uses the active QuakeC teleporter and preserves its immediate fog frame', () => {
        expect(QUAKE_TELEPORT_CAPTURE_TIME).toBe(2.09);
        const world = createEffectWorld();

        const result = prepareQuakeTeleportCapture(world);

        expect(result).toMatchObject({
            angles: [0, 0, 0],
            backwardMoveBlocked: true,
            fixAngle: true,
            onGround: false,
            origin: [-32, 1800, -29]
        });
        expect(result.velocity[0]).toBe(300);
        expect(Math.hypot(result.velocity[1], result.velocity[2])).toBe(0);
        expect(world.particleEvents.filter(event => event.kind === 'teleport')).toEqual([
            expect.objectContaining({ count: 896, origin: [1312, 1088, -368] }),
            expect.objectContaining({ count: 896, origin: [0, 1800, -29] })
        ]);
        expect(world.bonusShift).toBe(0);
        expect(world.clientData().armor).toBe(0);
        expect(world.viewPaletteShifts().at(-1)).toEqual({
            color: [215, 186, 69],
            percent: 0
        });
    });

    it('advances the authored t16/t17 soldier patrol through its first handoff', () => {
        const world = createEffectWorld();
        const capture = prepareQuakePatrolCapture(
            world,
            [1_056, 1_856, -120],
            [0, 90, 0]
        );

        expect(world.vm.getEntityWord(capture.soldierReference, 'enemy')).toBe(0);
        expect(world.vm.getEntityWord(capture.soldierReference, 'movetarget')).toBe(
            capture.nextCornerReference
        );
        expect(world.vm.getEntityWord(capture.soldierReference, 'goalentity')).toBe(
            capture.nextCornerReference
        );
        expect(world.vm.getEntityVector(capture.soldierReference, 'origin')[0]).toBeLessThan(
            world.vm.getEntityVector(capture.firstCornerReference, 'origin')[0]
        );
        expect(world.playerResult().origin).toEqual([1_056, 1_856, -120]);
    });
});
