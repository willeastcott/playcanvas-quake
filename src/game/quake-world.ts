import type { HullTrace, WorldCollision } from './collision';
import type { QuakeDemoFrameEvents, QuakeDemoTemporaryEntityEvent } from './demo-client';
import type { QuakeDemoPlayback } from './demo-playback';
import {
    QUAKE_SPAWN_PARAMETER_COUNT,
    type QuakeLevelTransitionState
} from './level-transition';
import { QuakeModelBoundsCache } from './model-bounds';
import {
    quakeStringToFloat,
    registerQuakeBuiltins,
    type QuakeAmbientSound,
    type QuakeParticleEvent,
    type QuakeSoundCommand,
    type QuakeSoundEvent,
    type QuakeStoppedSoundEvent
} from './quake-builtins';
import { quakeAngleMod, quakeHostFrameTime } from './quake-math';
import {
    quakeProtocolAngle,
    quakeProtocolByte,
    quakeProtocolCoordinate,
    quakeProtocolMessageNumber
} from './quake-protocol';
import type { QuakeVirtualMachine, QuakeVmSaveState } from './quake-vm';
import { CONTENTS, type BspMap, type Vec3 } from '../formats/bsp';
import type { PakArchive } from '../formats/pak';

const NOT_EASY_SKILL = 256;
const NOT_MEDIUM_SKILL = 512;
const NOT_HARD_SKILL = 1_024;
const NOT_DEATHMATCH = 2_048;
const FL_ITEM = 256;
const FL_ONGROUND = 512;
const FL_FLY = 1;
const FL_SWIM = 2;
const FL_MONSTER = 32;
const FL_GODMODE = 64;
const FL_NOTARGET = 128;
const FL_PARTIALGROUND = 1_024;
const FL_WATERJUMP = 2_048;
const FL_JUMPRELEASED = 4_096;
const IT_SHOTGUN = 1;
const MOVETYPE_NONE = 0;
const MOVETYPE_WALK = 3;
const MOVETYPE_PUSH = 7;
const MOVETYPE_NOCLIP = 8;
const MOVETYPE_STEP = 4;
const MOVETYPE_FLY = 5;
const MOVETYPE_TOSS = 6;
const MOVETYPE_FLYMISSILE = 9;
const MOVETYPE_BOUNCE = 10;
const SOLID_NOT = 0;
const SOLID_BSP = 4;
const SOLID_BBOX = 2;
const SOLID_SLIDEBOX = 3;
const SOLID_TRIGGER = 1;
const EF_BRIGHTFIELD = 1;
const EF_MUZZLEFLASH = 2;
const EF_BRIGHTLIGHT = 4;
const EF_DIMLIGHT = 8;
const MAX_BEAMS = 24;
const MAX_CLIP_PLANES = 5;

const TEMPORARY_BEAM_MODELS = new Map<number, string>([
    [5, 'progs/bolt.mdl'],
    [6, 'progs/bolt2.mdl'],
    [9, 'progs/bolt3.mdl'],
    [13, 'progs/beam.mdl']
]);

const TOSS_MOVE_TYPES = new Set([
    MOVETYPE_FLY, MOVETYPE_TOSS, MOVETYPE_FLYMISSILE, MOVETYPE_BOUNCE
]);
const MOVING_ENTITY_TYPES = new Set([
    MOVETYPE_STEP, MOVETYPE_NOCLIP, ...TOSS_MOVE_TYPES
]);

const dot = (left: Vec3, right: Vec3): number => left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
const copyVector = (value: readonly number[]): Vec3 => [...value] as Vec3;
const zeroVector = (): Vec3 => [0, 0, 0];

const clipVelocity = (velocity: Vec3, normal: Vec3, overbounce: number): Vec3 => {
    const backoff = dot(velocity, normal) * overbounce;
    return velocity.map((component, axis) => {
        const result = component - normal[axis] * backoff;
        return Math.abs(result) < 0.1 ? 0 : result;
    }) as Vec3;
};

export interface QuakePlayerState {
    angularVelocity?: Vec3;
    angles: Vec3;
    attack: boolean;
    entityAngles?: Vec3;
    groundModelIndex?: number;
    jump: boolean;
    jumped?: boolean;
    onGround: boolean;
    oldOrigin?: Vec3;
    origin: Vec3;
    touchEntityReferences?: readonly number[];
    touchModelIndices?: readonly number[];
    velocity: Vec3;
    waterJump?: boolean;
    waterJumpDirection?: Vec3;
    waterLevel?: number;
    waterType?: number;
}

export interface QuakePlayerResult {
    angularVelocity: Vec3;
    angles: Vec3;
    backwardMoveBlocked: boolean;
    damagePitch: number;
    damageRoll: number;
    dead: boolean;
    entityAngles: Vec3;
    fixAngle: boolean;
    groundModelIndex?: number;
    idealPitch: number;
    moveType: number;
    onGround: boolean;
    oldOrigin: Vec3;
    origin: Vec3;
    punchAngle: Vec3;
    velocity: Vec3;
    viewHeight: number;
    waterJump: boolean;
    waterJumpDirection: Vec3;
    waterJumpTime: number;
}

export type QuakePlayerMover = (state: QuakePlayerResult) => QuakePlayerState;

export interface QuakePlayerMovementTrace {
    entity: number;
    solid: number;
    trace: HullTrace;
}

interface EntityBounds {
    maximum: Vec3;
    minimum: Vec3;
}

interface TemporaryEntityMessage {
    bytes: number[];
    coordinates: number[];
    entity?: number;
    type?: number;
    waitingForType: boolean;
}

type PendingClientMessage =
    { event: QuakeParticleEvent; kind: 'particle' } |
    { kind: 'temporary'; message: TemporaryEntityMessage };

interface QuakeNotifyLine {
    expiresAt: number;
    text: string;
}

export interface QuakeDynamicLight {
    decay: number;
    die: number;
    key: number;
    minimumLight: number;
    origin: Vec3;
    radius: number;
}

export interface QuakeBeam {
    end: Vec3;
    endTime: number;
    entity: number;
    model: string;
    start: Vec3;
}

export interface QuakeStaticEntity {
    angles: Vec3;
    classname: string;
    colormap: number;
    frame: number;
    id: number;
    model: string;
    origin: Vec3;
    skin: number;
}

export interface QuakeViewBlend {
    amount: number;
    color: Vec3;
}

export interface QuakeViewColorShift {
    color: Vec3;
    percent: number;
}

export interface QuakeWorldSaveState {
    clientSpawnParameters: number[];
    cvars: Record<string, string>;
    entityReferenceGenerations: Array<number | null>;
    entityReferences: Array<number | null>;
    gameplayRandomState: number;
    inlineModelReferences: Array<readonly [number, number]>;
    lightStyles: Array<readonly [number, string]>;
    mapName: string;
    time: number;
    version: 1;
    vm: QuakeVmSaveState;
}

export interface QuakeClientData {
    activeWeapon: number;
    ammo: number;
    ammoCells: number;
    ammoNails: number;
    ammoRockets: number;
    ammoShells: number;
    armor: number;
    health: number;
    idealPitch: number;
    items: number;
    weaponFrame: number;
    weaponModel: string;
}

export const quakeEntityInhibited = (
    spawnFlags: number,
    skill: number,
    deathmatch: boolean
): boolean => {
    const flags = Math.trunc(spawnFlags);
    if (deathmatch) return (flags & NOT_DEATHMATCH) !== 0;
    if (skill <= 0) return (flags & NOT_EASY_SKILL) !== 0;
    if (skill === 1) return (flags & NOT_MEDIUM_SKILL) !== 0;
    return (flags & NOT_HARD_SKILL) !== 0;
};

export const quakeIdealPitchFromHeights = (
    heights: readonly number[],
    currentIdealPitch: number,
    scale: number
): number => {
    let direction = 0;
    let steps = 0;
    for (let index = 1; index < heights.length; index++) {
        const step = heights[index] - heights[index - 1];
        if (step > -0.1 && step < 0.1) {
            continue;
        }
        if (direction !== 0 && Math.abs(step - direction) > 0.1) {
            return currentIdealPitch;
        }
        steps++;
        direction = step;
    }
    if (direction === 0) {
        return 0;
    }
    return steps < 2 ? currentIdealPitch : -direction * scale;
};

export class QuakeWorldRuntime {
    readonly vm: QuakeVirtualMachine;
    readonly map: BspMap;
    readonly mapName: string;
    readonly collision: WorldCollision;
    readonly consoleLines: string[] = [];
    readonly ambientSounds: QuakeAmbientSound[] = [];
    readonly beams = new Map<number, QuakeBeam>();
    readonly dynamicLights = new Map<number, QuakeDynamicLight>();
    readonly entityReferences: Array<number | null>;
    readonly inlineModelReferences = new Map<number, number>();
    readonly itemGetTimes = new Array<number>(32).fill(0);
    readonly lightStyles = new Map<number, string>();
    readonly particleEvents: QuakeParticleEvent[] = [];
    readonly pendingClientMessages: PendingClientMessage[] = [];
    readonly notifyLines: QuakeNotifyLine[] = [];
    readonly playerReference: number;
    readonly soundEvents: QuakeSoundEvent[] = [];
    readonly soundCommands: QuakeSoundCommand[] = [];
    private deferClientMessages = false;
    readonly stoppedSoundEvents: QuakeStoppedSoundEvent[] = [];
    readonly staticEntities: QuakeStaticEntity[] = [];
    readonly temporaryMessages = new Map<number, TemporaryEntityMessage>();
    private readonly entityReferenceGenerations: Array<number | null>;
    private readonly linkedBrushModels = new Map<number, number>();
    private clientSpawnParameters = new Array<number>(
        QUAKE_SPAWN_PARAMETER_COUNT
    ).fill(0);
    private pendingLocalCommandText = '';
    private pendingLevelName?: string;
    private pendingRestart = false;
    private readonly cvars = new Map<string, string>([
        ['coop', '0'],
        ['deathmatch', '0'],
        ['developer', '0'],
        ['edgefriction', '2'],
        ['fraglimit', '0'],
        ['hostname', 'UNNAMED'],
        ['noexit', '0'],
        ['registered', '0'],
        ['samelevel', '0'],
        ['skill', '1'],
        ['sv_accelerate', '10'],
        ['sv_aim', '0.93'],
        ['sv_friction', '4'],
        ['sv_gravity', '800'],
        ['sv_idealpitchscale', '0.8'],
        ['sv_maxspeed', '320'],
        ['sv_maxvelocity', '2000'],
        ['sv_nostep', '0'],
        ['sv_stopspeed', '100'],
        ['teamplay', '0'],
        ['temp1', '0'],
        ['timelimit', '0']
    ]);
    bonusShift = 0;
    centerMessage = '';
    centerMessageDuration = 2;
    centerMessageRemaining = 0;
    completedTime = 0;
    damageShift = 0;
    damageShiftColor: Vec3 = [255, 0, 0];
    damageKickPitch = 0;
    damageKickRoll = 0;
    damageKickTime = 0;
    faceAnimationUntil = 0;
    gameplayRandomState = 0x1234abcd;
    intermission = 0;
    previousArmor = 0;
    previousHealth = 100;
    previousItems = 0;
    pendingNotifyText = '';
    temporaryRandomState = 0x13579bdf;
    temporaryLightSequence = 0;
    viewKickPitch = 0.6;
    viewKickRoll = 0.6;
    viewKickTime = 0.5;
    time = 1;
    private physicsFrameStart = 1;
    private checkClientInitialized = false;
    private particleConsumer?: (event: QuakeParticleEvent) => void;
    private checkClientLastTime = 0;
    private checkClientReference = 0;
    private checkClientVisibility: Uint8Array<ArrayBufferLike> = new Uint8Array();
    private entityVisibility: Uint8Array<ArrayBufferLike> = new Uint8Array();
    private entityVisibilityOrigin?: Vec3;
    private demoMode = false;
    private demoViewAngles?: Vec3;

    constructor(
        vm: QuakeVirtualMachine,
        map: BspMap,
        collision: WorldCollision,
        mapName = 'e1m1',
        transitionState?: QuakeLevelTransitionState,
        pak?: PakArchive,
        initialCvars?: Readonly<Record<string, string>>,
        playerName = 'player'
    ) {
        this.vm = vm;
        this.map = map;
        this.mapName = mapName;
        this.collision = collision;
        this.entityReferences = new Array(map.entities.length).fill(null);
        this.entityReferenceGenerations = new Array(map.entities.length).fill(null);
        this.playerReference = vm.allocateEdict();
        // Brush submodels are only solid after their QuakeC spawn function
        // links them. Some entities, notably func_episodegate, deliberately
        // return without setmodel when their gate should not exist.
        for (const collider of collision.brushColliders) {
            collision.setBrushState(collider.modelIndex, collider.origin, false);
        }
        if (transitionState) {
            for (const [name, value] of Object.entries(transitionState.cvars)) {
                if (this.cvars.has(name)) this.cvars.set(name, value);
            }
        }
        if (initialCvars) {
            for (const [name, value] of Object.entries(initialCvars)) {
                if (this.cvars.has(name)) this.cvars.set(name, value);
            }
        }
        if (this.cvarValue('coop') !== 0) this.cvars.set('deathmatch', '0');
        const skill = Math.max(
            0,
            Math.min(3, Math.trunc(this.cvarValue('skill') + 0.5))
        );
        this.cvars.set('skill', String(skill));
        const modelBounds = pak ? new QuakeModelBoundsCache(pak) : undefined;
        registerQuakeBuiltins(vm, collision, {
            ambientSound: event => this.queueAmbientSound(event),
            aim: (entity, missileSpeed) => this.aim(entity, missileSpeed),
            changeLevel: nextMap => this.requestLevelTransition(nextMap),
            changeYaw: entity => this.changeYaw(entity),
            checkBottom: entity => this.checkBottom(entity),
            checkClient: () => this.checkClient(),
            cvarValue: name => this.cvarValue(name),
            dropToFloor: entity => this.dropToFloor(entity),
            lightStyle: (style, pattern) => this.lightStyles.set(style, pattern),
            linkEntity: entity => this.linkEntity(entity),
            localCommand: (command) => {
                this.pendingLocalCommandText += command;
            },
            makeStatic: entity => this.makeStatic(entity),
            modelBounds: path => modelBounds?.get(path),
            moveStep: (entity, movement) => this.moveStep(entity, movement),
            moveToGoal: (entity, distance) => this.moveToGoal(entity, distance),
            particle: event => this.queueClientMessage({ event, kind: 'particle' }),
            print: (entity, message, centered) => this.receivePrint(entity, message, centered),
            random: () => this.gameplayRandomInteger() / 0x7fff,
            removeEntity: entity => this.removeEntity(entity),
            sound: event => this.queueSound(event),
            setCvar: (name, value) => this.setCvar(name, value),
            setSpawnParameters: entity => this.setSpawnParameters(entity),
            stuffCommand: (entity, command) => {
                if (entity === this.playerReference && command.trim() === 'bf') {
                    this.bonusShift = 50;
                }
            },
            traceLine: (start, end, noMonsters, ignore) => this.traceLine(start, end, noMonsters, ignore),
            writeMessage: (destination, kind, value) => this.writeMessage(destination, kind, value),
            worldModelPath: `maps/${mapName}.bsp`
        });
        vm.setGlobalFloat('deathmatch', this.cvarValue('deathmatch'));
        vm.setGlobalFloat('coop', this.cvarValue('coop'));
        vm.setGlobalFloat('skill', this.cvarValue('skill'));
        vm.setGlobalFloat('serverflags', transitionState?.serverFlags ?? 0);
        vm.setGlobalFloat('time', this.time);
        vm.setServerTime(this.time);
        vm.setGlobalString('mapname', mapName);
        vm.setEntityString(0, 'model', `maps/${mapName}.bsp`);
        vm.setEntityFloat(0, 'modelindex', 1);
        vm.setEntityFloat(0, 'solid', SOLID_BSP);
        vm.setEntityFloat(0, 'movetype', MOVETYPE_PUSH);
        this.spawnEntities();
        vm.setServerActive();
        this.spawnPlayer(transitionState?.spawnParameters, playerName);
        this.previousArmor = vm.getEntityFloat(this.playerReference, 'armorvalue');
        this.previousHealth = vm.getEntityFloat(this.playerReference, 'health');
        this.previousItems = Math.trunc(vm.getEntityFloat(this.playerReference, 'items'));
    }

    update(
        deltaTime: number,
        playerState?: QuakePlayerState,
        movePlayer?: QuakePlayerMover
    ): QuakePlayerResult {
        this.deferClientMessages = true;
        const frameTime = quakeHostFrameTime(deltaTime);
        const clientFrameTime = Math.max(0, Math.min(deltaTime, 0.1));
        this.physicsFrameStart = this.time;
        this.vm.setServerTime(this.physicsFrameStart);
        this.time += frameTime;
        this.damageKickTime = Math.max(0, this.damageKickTime - clientFrameTime);
        this.vm.setGlobalFloat('frametime', frameTime);
        this.vm.setGlobalFloat('time', this.physicsFrameStart);
        if (playerState) {
            this.synchronizePlayer(playerState);
        }
        this.decayPunchAngle(frameTime);
        this.vm.setGlobalWord('self', 0);
        this.vm.setGlobalWord('other', 0);
        this.vm.execute('StartFrame');
        this.updateDynamicLights(frameTime);
        if (this.vm.getGlobalFloat('force_retouch') > 0) {
            this.touchTriggers(this.playerReference);
        }
        this.executePlayerFunction('PlayerPreThink');
        this.checkVelocity(this.playerReference);
        this.runScheduledThink(this.playerReference);
        const playerMoveType = this.vm.getEntityFloat(this.playerReference, 'movetype');
        if (playerMoveType === MOVETYPE_TOSS || playerMoveType === MOVETYPE_BOUNCE) {
            this.checkVelocity(this.playerReference);
        }
        const movedPlayerState = playerState && movePlayer ?
            movePlayer(this.playerResult(false)) : playerState;
        if (movedPlayerState && movePlayer) {
            this.synchronizePlayer(movedPlayerState);
            this.checkVelocity(this.playerReference);
        }
        if (movedPlayerState?.jumped) {
            this.queueSound({
                attenuation: 1,
                channel: 4,
                entity: this.playerReference,
                origin: this.entitySoundOrigin(this.playerReference),
                sample: 'player/plyrjmp8.wav',
                volume: 1
            });
        }
        for (const modelIndex of movedPlayerState?.touchModelIndices ?? []) {
            const reference = this.inlineModelReferences.get(modelIndex);
            if (reference !== undefined && !this.vm.entity(reference).free) {
                this.impact(this.playerReference, reference);
            }
        }
        for (const reference of new Set(movedPlayerState?.touchEntityReferences ?? [])) {
            if (!Number.isInteger(reference) || reference <= 0 ||
                reference >= this.vm.edicts.length || this.vm.entity(reference).free) {
                continue;
            }
            const solid = this.vm.getEntityFloat(reference, 'solid');
            if (solid === SOLID_BBOX || solid === SOLID_SLIDEBOX) {
                this.impact(this.playerReference, reference);
            }
        }
        this.touchTriggers(this.playerReference);
        if ((playerMoveType === MOVETYPE_TOSS || playerMoveType === MOVETYPE_BOUNCE) &&
            ((movedPlayerState?.touchModelIndices?.length ?? 0) > 0 ||
                (movedPlayerState?.touchEntityReferences?.length ?? 0) > 0)) {
            this.checkWaterTransition(this.playerReference);
        }
        this.vm.setGlobalFloat('time', this.physicsFrameStart);
        this.executePlayerFunction('PlayerPostThink');
        for (let reference = 2; reference < this.vm.edicts.length; reference++) {
            if (this.vm.entity(reference).free) continue;
            if (this.vm.getGlobalFloat('force_retouch') > 0) {
                this.touchTriggers(reference);
                if (this.vm.entity(reference).free) continue;
            }
            const moveType = this.vm.getEntityFloat(reference, 'movetype');
            if (moveType === MOVETYPE_PUSH) {
                this.updatePusher(reference, frameTime);
            } else if (MOVING_ENTITY_TYPES.has(moveType)) {
                this.updateMovingEntity(reference, frameTime);
                if (moveType === MOVETYPE_STEP && !this.vm.entity(reference).free) {
                    this.runScheduledThink(reference);
                    if (!this.vm.entity(reference).free) this.checkWaterTransition(reference);
                }
            } else {
                this.runScheduledThink(reference);
            }
        }
        const forceRetouch = this.vm.getGlobalFloat('force_retouch');
        if (forceRetouch > 0) this.vm.setGlobalFloat('force_retouch', forceRetouch - 1);
        this.collectItemPickups();
        this.deferClientMessages = false;
        this.flushPendingClientMessages();
        this.collectEntityEffects();
        this.collectPlayerDamage();
        this.setIdealPitch();
        this.advanceClientColorShifts(clientFrameTime);
        return this.playerResult();
    }

    advanceClientColorShifts(deltaTime: number): void {
        const frameTime = Math.max(0, Math.min(deltaTime, 0.1));
        this.damageShift = Math.max(0, Math.trunc(
            this.damageShift - frameTime * 150
        ));
        this.bonusShift = Math.max(0, Math.trunc(
            this.bonusShift - frameTime * 100
        ));
    }

    advanceClientViewEffects(deltaTime: number): void {
        const frameTime = Math.max(0, Math.min(deltaTime, 0.1));
        this.damageKickTime = Math.max(0, this.damageKickTime - frameTime);
        this.advanceClientColorShifts(frameTime);
    }

    playerResult(consumeFixAngle = true): QuakePlayerResult {
        const damageScale = this.damageKickTime > 0 && this.viewKickTime > 0 ?
            this.damageKickTime / this.viewKickTime : 0;
        const fixAngle = this.demoMode ||
            this.vm.getEntityFloat(this.playerReference, 'fixangle') !== 0;
        const serverAngles = this.vm.getEntityVector(this.playerReference, 'angles');
        const flags = Math.trunc(this.vm.getEntityFloat(this.playerReference, 'flags'));
        const onGround = (flags & FL_ONGROUND) !== 0;
        const groundEntity = onGround ?
            this.vm.getEntityWord(this.playerReference, 'groundentity') : 0;
        const groundModelIndex = groundEntity === 0 ? undefined :
            [...this.inlineModelReferences].find(([, reference]) => (
                reference === groundEntity
            ))?.[0];
        const result = {
            angularVelocity: this.vm.getEntityVector(this.playerReference, 'avelocity'),
            angles: this.demoViewAngles ?? (fixAngle ?
                serverAngles.map(quakeProtocolAngle) as Vec3 : serverAngles),
            backwardMoveBlocked: this.time <
                this.vm.getEntityFloat(this.playerReference, 'teleport_time'),
            damagePitch: damageScale * this.damageKickPitch,
            damageRoll: damageScale * this.damageKickRoll,
            dead: this.vm.getEntityFloat(this.playerReference, 'health') <= 0,
            entityAngles: serverAngles,
            fixAngle,
            groundModelIndex,
            idealPitch: quakeProtocolMessageNumber(
                'char', this.vm.getEntityFloat(this.playerReference, 'idealpitch')
            ),
            moveType: Math.trunc(this.vm.getEntityFloat(this.playerReference, 'movetype')),
            onGround,
            oldOrigin: this.vm.getEntityVector(this.playerReference, 'oldorigin'),
            origin: this.vm.getEntityVector(this.playerReference, 'origin'),
            punchAngle: this.vm.getEntityVector(this.playerReference, 'punchangle').map(
                component => quakeProtocolMessageNumber('char', component)
            ) as Vec3,
            velocity: this.vm.getEntityVector(this.playerReference, 'velocity'),
            viewHeight: quakeProtocolMessageNumber(
                'char', this.vm.getEntityVector(this.playerReference, 'view_ofs')[2]
            ),
            waterJump: (flags & FL_WATERJUMP) !== 0,
            waterJumpDirection: this.vm.getEntityVector(this.playerReference, 'movedir'),
            waterJumpTime: this.vm.getEntityFloat(
                this.playerReference, 'teleport_time'
            ) - this.time
        };
        if (result.fixAngle && consumeFixAngle) {
            this.vm.setEntityFloat(this.playerReference, 'fixangle', 0);
        }
        return result;
    }

    clientData(): QuakeClientData {
        const player = this.playerReference;
        let items = Math.trunc(this.vm.getEntityFloat(player, 'items'));
        const items2 = this.vm.program.fieldsByName.get('items2');
        if (items2) {
            items |= Math.trunc(this.vm.entity(player).values[items2.offset]) << 23;
        } else {
            items |= Math.trunc(this.vm.getGlobalFloat('serverflags')) << 28;
        }
        return {
            activeWeapon: quakeProtocolByte(this.vm.getEntityFloat(player, 'weapon')),
            ammo: quakeProtocolByte(this.vm.getEntityFloat(player, 'currentammo')),
            ammoCells: quakeProtocolByte(this.vm.getEntityFloat(player, 'ammo_cells')),
            ammoNails: quakeProtocolByte(this.vm.getEntityFloat(player, 'ammo_nails')),
            ammoRockets: quakeProtocolByte(this.vm.getEntityFloat(player, 'ammo_rockets')),
            ammoShells: quakeProtocolByte(this.vm.getEntityFloat(player, 'ammo_shells')),
            armor: quakeProtocolByte(this.vm.getEntityFloat(player, 'armorvalue')),
            health: quakeProtocolMessageNumber(
                'short', this.vm.getEntityFloat(player, 'health')
            ),
            idealPitch: quakeProtocolMessageNumber(
                'char', this.vm.getEntityFloat(player, 'idealpitch')
            ),
            items: quakeProtocolMessageNumber('long', items),
            weaponFrame: quakeProtocolByte(this.vm.getEntityFloat(player, 'weaponframe')),
            weaponModel: this.vm.getEntityString(player, 'weaponmodel')
        };
    }

    setIdealPitch(): void {
        const player = this.playerReference;
        const flags = Math.trunc(this.vm.getEntityFloat(player, 'flags'));
        if ((flags & FL_ONGROUND) === 0) {
            return;
        }
        const origin = this.vm.getEntityVector(player, 'origin');
        const viewHeight = this.vm.getEntityVector(player, 'view_ofs')[2];
        const yaw = this.vm.getEntityVector(player, 'angles')[1] * Math.PI * 2 / 360;
        const sineYaw = Math.sin(yaw);
        const cosineYaw = Math.cos(yaw);
        const heights: number[] = [];
        for (let index = 0; index < 6; index++) {
            const top: Vec3 = [
                origin[0] + cosineYaw * (index + 3) * 12,
                origin[1] + sineYaw * (index + 3) * 12,
                origin[2] + viewHeight
            ];
            const bottom: Vec3 = [top[0], top[1], top[2] - 160];
            const trace = this.traceLine(top, bottom, true, player).trace;
            if (trace.allSolid || trace.fraction === 1) {
                return;
            }
            heights.push(trace.endPosition[2]);
        }

        this.vm.setEntityFloat(player, 'idealpitch', quakeIdealPitchFromHeights(
            heights,
            this.vm.getEntityFloat(player, 'idealpitch'),
            this.cvarValue('sv_idealpitchscale')
        ));
    }

    drainParticleEvents(): QuakeParticleEvent[] {
        return this.particleEvents.splice(0);
    }

    setParticleConsumer(consumer: (event: QuakeParticleEvent) => void): void {
        this.particleConsumer = consumer;
        for (const event of this.particleEvents) consumer(event);
    }

    emitParticleEvent(event: QuakeParticleEvent): void {
        this.particleEvents.push(event);
        this.particleConsumer?.(event);
    }

    drainSoundEvents(): QuakeSoundEvent[] {
        const events = this.soundEvents.splice(0);
        const retainedCommands = this.soundCommands.filter(command => command.kind !== 'start');
        this.soundCommands.splice(0, this.soundCommands.length, ...retainedCommands);
        return events;
    }

    drainSoundCommands(): QuakeSoundCommand[] {
        const commands = this.soundCommands.splice(0);
        this.soundEvents.length = 0;
        this.stoppedSoundEvents.length = 0;
        return commands;
    }

    clearSoundEvents(): void {
        this.soundCommands.length = 0;
        this.soundEvents.length = 0;
        this.stoppedSoundEvents.length = 0;
    }

    drainStoppedSoundEvents(): QuakeStoppedSoundEvent[] {
        const events = this.stoppedSoundEvents.splice(0);
        const retainedCommands = this.soundCommands.filter(command => command.kind !== 'stop');
        this.soundCommands.splice(0, this.soundCommands.length, ...retainedCommands);
        return events;
    }

    applyDemoPlayback(
        playback: QuakeDemoPlayback,
        frameEvents: readonly QuakeDemoFrameEvents[],
        frameTime: number
    ): void {
        const client = playback.client;
        const models = client.serverInfo?.models ?? [''];
        this.demoMode = true;
        this.demoViewAngles = playback.viewAngles();
        this.time = playback.clientTime;
        this.intermission = client.intermission;
        this.completedTime = client.completedTime;
        this.itemGetTimes.splice(0, this.itemGetTimes.length, ...client.itemGetTimes);
        this.lightStyles.clear();
        for (const [style, pattern] of client.lightStyles) {
            this.lightStyles.set(style, pattern);
        }

        const highestEntity = Math.max(this.playerReference, ...client.entities.keys());
        while (this.vm.edicts.length <= highestEntity) this.vm.allocateEdict();
        for (let reference = 1; reference < this.vm.edicts.length; reference++) {
            this.vm.entity(reference).free = true;
        }
        this.inlineModelReferences.clear();
        for (const entityNumber of client.entities.keys()) {
            const state = playback.entityState(entityNumber);
            if (!state) continue;
            const edict = this.vm.entity(entityNumber);
            edict.free = false;
            const model = models[state.modelIndex] ?? '';
            this.vm.setEntityString(entityNumber, 'classname', 'demo_entity');
            this.vm.setEntityString(entityNumber, 'model', model);
            this.vm.setEntityFloat(entityNumber, 'modelindex', state.modelIndex);
            this.vm.setEntityFloat(entityNumber, 'frame', state.frame);
            this.vm.setEntityFloat(entityNumber, 'colormap', state.colormap);
            this.vm.setEntityFloat(entityNumber, 'skin', state.skin);
            this.vm.setEntityFloat(entityNumber, 'effects', state.effects);
            this.vm.setEntityVector(entityNumber, 'origin', state.origin);
            this.vm.setEntityVector(entityNumber, 'angles', state.angles);
            this.vm.setEntityVector(entityNumber, 'mins', [-16, -16, -16]);
            this.vm.setEntityVector(entityNumber, 'maxs', [16, 16, 16]);
            this.vm.setEntityVector(entityNumber, 'absmin', state.origin.map(
                component => component - 16
            ) as Vec3);
            this.vm.setEntityVector(entityNumber, 'absmax', state.origin.map(
                component => component + 16
            ) as Vec3);
            const inlineModelMatch = /^\*(\d+)$/u.exec(model);
            const inlineModelIndex = inlineModelMatch ? Number(inlineModelMatch[1]) : 0;
            if (inlineModelIndex > 0 && this.map.models[inlineModelIndex]) {
                this.inlineModelReferences.set(inlineModelIndex, entityNumber);
            }
        }

        const player = this.playerReference;
        const playerEdict = this.vm.entity(player);
        playerEdict.free = false;
        this.vm.setEntityFloat(player, 'health', client.stats[0]);
        this.vm.setEntityFloat(player, 'weaponframe', client.stats[5]);
        this.vm.setEntityFloat(player, 'armorvalue', client.stats[4]);
        this.vm.setEntityFloat(player, 'currentammo', client.stats[3]);
        this.vm.setEntityFloat(player, 'ammo_shells', client.stats[6]);
        this.vm.setEntityFloat(player, 'ammo_nails', client.stats[7]);
        this.vm.setEntityFloat(player, 'ammo_rockets', client.stats[8]);
        this.vm.setEntityFloat(player, 'ammo_cells', client.stats[9]);
        this.vm.setEntityFloat(player, 'weapon', client.stats[10]);
        this.vm.setEntityFloat(player, 'items', client.items);
        this.vm.setEntityFloat(player, 'idealpitch', client.idealPitch);
        this.vm.setEntityFloat(player, 'movetype', MOVETYPE_WALK);
        this.vm.setEntityFloat(player, 'flags', client.onGround ? FL_ONGROUND : 0);
        this.vm.setEntityString(player, 'weaponmodel', models[client.stats[2]] ?? '');
        this.vm.setEntityVector(player, 'punchangle', client.punchAngles);
        this.vm.setEntityVector(player, 'velocity', playback.velocity());
        this.vm.setEntityVector(player, 'view_ofs', [0, 0, client.viewHeight]);
        this.vm.setGlobalFloat('total_secrets', client.stats[11]);
        this.vm.setGlobalFloat('total_monsters', client.stats[12]);
        this.vm.setGlobalFloat('found_secrets', client.stats[13]);
        this.vm.setGlobalFloat('killed_monsters', client.stats[14]);
        this.vm.setEntityString(0, 'message', client.serverInfo?.levelName ?? '');

        this.staticEntities.splice(0, this.staticEntities.length,
            ...client.staticEntities.flatMap((entity, id) => {
                const model = models[entity.modelIndex];
                return model ? [{
                    angles: copyVector(entity.angles),
                    classname: 'demo_static',
                    colormap: entity.colormap,
                    frame: entity.frame,
                    id,
                    model,
                    origin: copyVector(entity.origin),
                    skin: entity.skin
                }] : [];
            })
        );
        this.ambientSounds.splice(0, this.ambientSounds.length,
            ...client.staticSounds.flatMap((sound) => {
                if (!sound.sample) return [];
                return [{
                    attenuation: sound.attenuation / 64,
                    origin: copyVector(sound.origin),
                    sample: sound.sample,
                    volume: sound.volume / 255
                }];
            })
        );

        this.advanceClientViewEffects(frameTime);
        this.updateDynamicLights(frameTime);
        for (const events of frameEvents) {
            this.applyDemoEvents(events);
        }
        this.collectEntityEffects();
    }

    private applyDemoEvents(events: QuakeDemoFrameEvents): void {
        for (const message of events.prints) {
            this.printToConsole(message);
        }
        for (const message of events.centerPrints) {
            this.receivePrint(this.playerReference, message, true);
        }
        for (const command of events.soundCommands) {
            if (command.kind === 'stop') {
                this.queueStoppedSound(command.event);
                continue;
            }
            const sound = command.event;
            if (!sound.sample) continue;
            this.queueSound({
                attenuation: sound.attenuation,
                channel: sound.channel,
                entity: sound.entity,
                origin: copyVector(sound.origin),
                sample: sound.sample,
                volume: sound.volume / 255
            });
        }
        for (const particle of events.particles) {
            this.emitParticleEvent({
                color: particle.color,
                count: particle.count,
                direction: copyVector(particle.direction),
                origin: copyVector(particle.origin)
            });
        }
        for (const damage of events.damages) {
            this.applyDemoDamage(damage.armor, damage.blood, damage.origin);
        }
        for (const temporaryEntity of events.temporaryEntities) {
            this.applyDemoTemporaryEntity(temporaryEntity);
        }
    }

    private applyDemoTemporaryEntity(event: QuakeDemoTemporaryEntityEvent): void {
        const coordinates = [...event.origin, ...(event.end ?? [])];
        this.finishTemporaryEntity({
            bytes: event.type === 12 ? [event.colorStart ?? 0, event.colorLength ?? 0] : [],
            coordinates,
            entity: event.entity,
            type: event.type,
            waitingForType: false
        });
    }

    private applyDemoDamage(armor: number, blood: number, source: Vec3): void {
        const count = Math.max(10, (blood + armor) * 0.5);
        this.damageShift = Math.min(150, Math.trunc(this.damageShift + 3 * count));
        this.damageShiftColor = armor > blood ? [200, 100, 100] :
            armor > 0 ? [220, 50, 50] : [255, 0, 0];
        this.faceAnimationUntil = this.time + 0.2;
        const playerOrigin = this.vm.getEntityVector(this.playerReference, 'origin');
        const from = source.map((component, axis) => component - playerOrigin[axis]) as Vec3;
        const magnitude = Math.hypot(...from);
        if (magnitude > 0) {
            for (let axis = 0; axis < 3; axis++) from[axis] /= magnitude;
        }
        const angles = this.demoViewAngles ?? zeroVector();
        const pitch = angles[0] * Math.PI / 180;
        const yaw = angles[1] * Math.PI / 180;
        const forward: Vec3 = [
            Math.cos(pitch) * Math.cos(yaw),
            Math.cos(pitch) * Math.sin(yaw),
            -Math.sin(pitch)
        ];
        const right: Vec3 = [Math.sin(yaw), -Math.cos(yaw), 0];
        this.damageKickRoll = count * dot(from, right) * this.viewKickRoll;
        this.damageKickPitch = count * dot(from, forward) * this.viewKickPitch;
        this.damageKickTime = this.viewKickTime;
    }

    private queueAmbientSound(event: QuakeAmbientSound): void {
        this.ambientSounds.push({
            ...event,
            attenuation: Math.trunc(event.attenuation * 64) / 64,
            origin: event.origin.map(quakeProtocolCoordinate) as Vec3,
            volume: Math.trunc(event.volume * 255) / 255
        });
    }

    private queueSound(event: QuakeSoundEvent): void {
        const queued = {
            ...event,
            attenuation: Math.trunc(event.attenuation * 64) / 64,
            origin: event.origin.map(quakeProtocolCoordinate) as Vec3,
            volume: Math.trunc(event.volume * 255) / 255
        };
        this.soundEvents.push(queued);
        this.soundCommands.push({ event: queued, kind: 'start' });
    }

    private queueStoppedSound(event: QuakeStoppedSoundEvent): void {
        this.stoppedSoundEvents.push(event);
        this.soundCommands.push({ event, kind: 'stop' });
    }

    cvarValue(name: string): number {
        return quakeStringToFloat(this.cvars.get(name) ?? '');
    }

    cvarString(name: string): string | undefined {
        return this.cvars.get(name);
    }

    serverGravity(): number {
        return this.cvarValue('sv_gravity');
    }

    serverMaximumVelocity(): number {
        return this.cvarValue('sv_maxvelocity');
    }

    setCvar(name: string, value: string): void {
        if (!this.cvars.has(name)) {
            this.printToConsole(`Cvar_Set: variable ${name} not found\n`);
            return;
        }
        this.cvars.set(name, value);
    }

    activeDynamicLights(): QuakeDynamicLight[] {
        return [...this.dynamicLights.values()].filter(light => light.die >= this.time && light.radius > light.minimumLight
        );
    }

    activeBeams(): QuakeBeam[] {
        for (const [entity, beam] of this.beams) {
            if (beam.endTime < this.time) {
                this.beams.delete(entity);
            } else if (beam.entity === this.playerReference) {
                beam.start = this.vm.getEntityVector(this.playerReference, 'origin').map(
                    quakeProtocolCoordinate
                ) as Vec3;
            }
        }
        return [...this.beams.values()];
    }

    makeStatic(reference: number): void {
        if (this.staticEntities.length >= 128) {
            throw new Error('Too many Quake static entities');
        }
        this.staticEntities.push({
            angles: this.vm.getEntityVector(reference, 'angles').map(
                quakeProtocolAngle
            ) as Vec3,
            classname: this.vm.getEntityString(reference, 'classname'),
            colormap: quakeProtocolByte(this.vm.getEntityFloat(reference, 'colormap')),
            frame: quakeProtocolByte(this.vm.getEntityFloat(reference, 'frame')),
            id: this.staticEntities.length,
            model: this.vm.getEntityString(reference, 'model'),
            origin: this.vm.getEntityVector(reference, 'origin').map(
                quakeProtocolCoordinate
            ) as Vec3,
            skin: quakeProtocolByte(this.vm.getEntityFloat(reference, 'skin'))
        });
        this.removeEntity(reference);
    }

    removeEntity(reference: number): void {
        const generation = this.vm.entity(reference).generation;
        for (let index = 0; index < this.entityReferences.length; index++) {
            if (this.entityReferences[index] === reference &&
                this.entityReferenceGenerations[index] === generation) {
                this.entityReferences[index] = null;
                this.entityReferenceGenerations[index] = null;
            }
        }
        this.vm.freeEdict(reference);
        this.updateBrushCollision(reference);
    }

    nextTemporaryEntityRoll(): number {
        return this.temporaryRandom() % 360;
    }

    visibleCenterMessage(): string {
        return this.centerMessageRemaining > 0 ? this.centerMessage : '';
    }

    advanceCenterMessage(frameTime: number): void {
        if (Number.isFinite(this.centerMessageRemaining)) {
            this.centerMessageRemaining = Math.max(
                0,
                this.centerMessageRemaining - frameTime
            );
        }
    }

    visibleNotifyLines(): string[] {
        const visible = this.notifyLines.filter(line => line.expiresAt >= this.time).slice(-4)
        .map(line => line.text);
        if (this.pendingNotifyText) {
            visible.push(this.pendingNotifyText);
        }
        return visible.slice(-4);
    }

    visibleConsoleLines(): string[] {
        return this.pendingNotifyText ?
            [...this.consoleLines, this.pendingNotifyText] : [...this.consoleLines];
    }

    entityVisible(reference: number): boolean {
        if (reference === this.playerReference) return true;
        if (this.vm.entity(reference).free ||
            this.vm.getEntityFloat(reference, 'modelindex') === 0 ||
            !this.vm.getEntityString(reference, 'model')) {
            return false;
        }
        if (this.demoMode) return true;
        const visibility = this.playerFatVisibility();
        const minimum = this.vm.getEntityVector(reference, 'absmin');
        const maximum = this.vm.getEntityVector(reference, 'absmax');
        return this.map.touchedLeafs(minimum, maximum, 16).some(
            leafIndex => this.map.visibilityContainsLeaf(visibility, leafIndex)
        );
    }

    boundsVisibleToPlayer(minimum: Vec3, maximum: Vec3): boolean {
        const viewLeaf = this.map.findLeaf(this.playerViewOrigin());
        const visibility = this.map.visibleLeafs(viewLeaf);
        return this.map.touchedLeafs(minimum, maximum).some(
            candidateLeaf => candidateLeaf === viewLeaf ||
                this.map.visibilityContainsLeaf(visibility, candidateLeaf)
        );
    }

    printToConsole(message: string): void {
        this.receivePrint(0, message, false);
    }

    clearConsole(): void {
        this.consoleLines.length = 0;
        this.notifyLines.length = 0;
        this.pendingNotifyText = '';
    }

    createSaveState(): QuakeWorldSaveState {
        if (this.intermission !== 0) {
            throw new Error('Can\'t save in intermission.');
        }
        if (this.vm.getEntityFloat(this.playerReference, 'health') <= 0) {
            throw new Error('Can\'t savegame with a dead player');
        }
        return {
            clientSpawnParameters: [...this.clientSpawnParameters],
            cvars: Object.fromEntries(this.cvars),
            entityReferenceGenerations: [...this.entityReferenceGenerations],
            entityReferences: [...this.entityReferences],
            gameplayRandomState: this.gameplayRandomState,
            inlineModelReferences: [...this.inlineModelReferences],
            lightStyles: [...this.lightStyles],
            mapName: this.mapName,
            time: this.time,
            version: 1,
            vm: this.vm.createSaveState()
        };
    }

    restoreSaveState(state: QuakeWorldSaveState): void {
        if (state.version !== 1 || state.mapName !== this.mapName ||
            !Number.isFinite(state.time) || state.time < 0) {
            throw new Error('Savegame does not match the requested map');
        }
        if (!Array.isArray(state.clientSpawnParameters) ||
            state.clientSpawnParameters.length !== QUAKE_SPAWN_PARAMETER_COUNT ||
            state.clientSpawnParameters.some(value => !Number.isFinite(value))) {
            throw new Error('Savegame has invalid spawn parameters');
        }
        if (!Array.isArray(state.entityReferences) ||
            !Array.isArray(state.entityReferenceGenerations) ||
            state.entityReferences.length !== this.map.entities.length ||
            state.entityReferenceGenerations.length !== this.map.entities.length) {
            throw new Error('Savegame has invalid map entity references');
        }
        if (!Number.isInteger(state.gameplayRandomState)) {
            throw new Error('Savegame has invalid random state');
        }
        this.vm.restoreSaveState(state.vm);
        if (this.vm.edicts.length <= this.playerReference ||
            this.vm.entity(this.playerReference).free) {
            throw new Error('Savegame has no active single-player client');
        }
        const validReference = (reference: number | null): boolean => reference === null ||
            Number.isInteger(reference) && reference >= 0 && reference < this.vm.edicts.length;
        if (!state.entityReferences.every(validReference) ||
            !state.entityReferenceGenerations.every(generation => generation === null ||
                Number.isInteger(generation) && generation >= 1)) {
            throw new Error('Savegame contains an invalid map entity reference');
        }
        for (let index = 0; index < state.entityReferences.length; index++) {
            const reference = state.entityReferences[index];
            const generation = state.entityReferenceGenerations[index];
            if (reference !== null && generation !== this.vm.entity(reference).generation) {
                throw new Error('Savegame contains a stale map entity reference');
            }
        }
        if (!Array.isArray(state.inlineModelReferences) ||
            state.inlineModelReferences.some(entry => !Array.isArray(entry) ||
                entry.length !== 2 || !Number.isInteger(entry[0]) || entry[0] <= 0 ||
                entry[0] >= this.map.models.length || !validReference(entry[1]) ||
                entry[1] === null)) {
            throw new Error('Savegame contains an invalid inline model reference');
        }
        if (!state.cvars || typeof state.cvars !== 'object' || Array.isArray(state.cvars)) {
            throw new Error('Savegame server cvars are missing');
        }
        for (const [name, value] of Object.entries(state.cvars)) {
            if (this.cvars.has(name) && typeof value === 'string') this.cvars.set(name, value);
        }
        if (!Array.isArray(state.lightStyles) || state.lightStyles.some(entry => (
            !Array.isArray(entry) || entry.length !== 2 ||
            !Number.isInteger(entry[0]) || entry[0] < 0 || entry[0] >= 256 ||
            typeof entry[1] !== 'string'
        ))) {
            throw new Error('Savegame has invalid lightstyles');
        }
        this.entityReferences.splice(0, this.entityReferences.length, ...state.entityReferences);
        this.entityReferenceGenerations.splice(
            0,
            this.entityReferenceGenerations.length,
            ...state.entityReferenceGenerations
        );
        this.clientSpawnParameters = [...state.clientSpawnParameters];
        this.gameplayRandomState = state.gameplayRandomState;
        this.lightStyles.clear();
        for (const [style, pattern] of state.lightStyles) this.lightStyles.set(style, pattern);
        this.time = state.time;
        this.physicsFrameStart = state.time;
        this.vm.setGlobalFloat('time', state.time);
        this.vm.setServerTime(state.time);
        this.inlineModelReferences.clear();
        for (const [modelIndex, reference] of state.inlineModelReferences) {
            this.inlineModelReferences.set(modelIndex, reference);
        }
        this.linkedBrushModels.clear();
        for (const collider of this.collision.brushColliders) {
            this.collision.setBrushState(collider.modelIndex, collider.origin, false);
        }
        for (let reference = 1; reference < this.vm.edicts.length; reference++) {
            if (!this.vm.entity(reference).free) this.linkEntity(reference);
        }
        this.beams.clear();
        this.dynamicLights.clear();
        this.particleEvents.length = 0;
        this.pendingClientMessages.length = 0;
        this.clearSoundEvents();
        this.temporaryMessages.clear();
        this.itemGetTimes.fill(0);
        this.consoleLines.length = 0;
        this.notifyLines.length = 0;
        this.pendingLocalCommandText = '';
        this.pendingLevelName = undefined;
        this.pendingRestart = false;
        this.pendingNotifyText = '';
        this.centerMessage = '';
        this.centerMessageRemaining = 0;
        this.completedTime = 0;
        this.intermission = 0;
        this.damageShift = 0;
        this.bonusShift = 0;
        this.damageKickTime = 0;
        this.faceAnimationUntil = 0;
        this.previousArmor = this.vm.getEntityFloat(this.playerReference, 'armorvalue');
        this.previousHealth = this.vm.getEntityFloat(this.playerReference, 'health');
        this.previousItems = Math.trunc(this.vm.getEntityFloat(this.playerReference, 'items'));
        this.checkClientInitialized = false;
        this.entityVisibilityOrigin = undefined;
    }

    setEntityOrigin(reference: number, origin: Vec3): void {
        if (reference < 0 || reference >= this.vm.edicts.length ||
            this.vm.entity(reference).free) {
            throw new Error(`Cannot position inactive edict ${reference}`);
        }
        this.vm.setEntityVector(reference, 'origin', origin);
        this.updateLinkedBounds(reference);
        this.entityVisibilityOrigin = undefined;
        this.checkClientInitialized = false;
    }

    setPlayerPose(origin: Vec3, angles: Vec3): void {
        this.vm.setEntityVector(this.playerReference, 'origin', origin);
        this.vm.setEntityVector(this.playerReference, 'oldorigin', origin);
        this.vm.setEntityVector(this.playerReference, 'velocity', [0, 0, 0]);
        this.vm.setEntityVector(this.playerReference, 'angles', angles);
        this.vm.setEntityVector(this.playerReference, 'v_angle', angles);
        this.vm.setEntityFloat(this.playerReference, 'fixangle', 1);
        this.updateLinkedBounds(this.playerReference);
        this.entityVisibilityOrigin = undefined;
        this.checkClientInitialized = false;
    }

    setPlayerImpulse(impulse: number): void {
        this.vm.setEntityFloat(this.playerReference, 'impulse', quakeProtocolByte(impulse));
    }

    advanceGameplayRandom(count: number): void {
        if (!Number.isInteger(count) || count < 0) {
            throw new Error('Gameplay random advance count must be a non-negative integer');
        }
        for (let index = 0; index < count; index++) this.gameplayRandomInteger();
    }

    killPlayer(): void {
        if (this.vm.getEntityFloat(this.playerReference, 'health') <= 0) {
            this.receivePrint(
                this.playerReference,
                'Can\'t suicide -- allready dead!\n',
                false
            );
            return;
        }
        this.vm.setGlobalFloat('time', this.time);
        this.vm.setGlobalWord('self', this.playerReference);
        this.vm.execute('ClientKill');
    }

    toggleGodMode(): boolean | undefined {
        if (this.cvarValue('deathmatch') !== 0) return undefined;
        const flags = Math.trunc(this.vm.getEntityFloat(this.playerReference, 'flags')) ^
            FL_GODMODE;
        this.vm.setEntityFloat(this.playerReference, 'flags', flags);
        const enabled = (flags & FL_GODMODE) !== 0;
        this.receivePrint(
            this.playerReference, `godmode ${enabled ? 'ON' : 'OFF'}\n`, false
        );
        return enabled;
    }

    toggleNoTarget(): boolean | undefined {
        if (this.cvarValue('deathmatch') !== 0) return undefined;
        const flags = Math.trunc(this.vm.getEntityFloat(this.playerReference, 'flags')) ^
            FL_NOTARGET;
        this.vm.setEntityFloat(this.playerReference, 'flags', flags);
        const enabled = (flags & FL_NOTARGET) !== 0;
        this.receivePrint(
            this.playerReference, `notarget ${enabled ? 'ON' : 'OFF'}\n`, false
        );
        this.checkClientInitialized = false;
        return enabled;
    }

    toggleNoclip(): boolean | undefined {
        if (this.cvarValue('deathmatch') !== 0) return undefined;
        const enabled = this.vm.getEntityFloat(
            this.playerReference, 'movetype'
        ) !== MOVETYPE_NOCLIP;
        this.vm.setEntityFloat(
            this.playerReference, 'movetype', enabled ? MOVETYPE_NOCLIP : MOVETYPE_WALK
        );
        this.receivePrint(
            this.playerReference, `noclip ${enabled ? 'ON' : 'OFF'}\n`, false
        );
        return enabled;
    }

    toggleFly(): boolean | undefined {
        if (this.cvarValue('deathmatch') !== 0) return undefined;
        const enabled = this.vm.getEntityFloat(
            this.playerReference, 'movetype'
        ) !== MOVETYPE_FLY;
        this.vm.setEntityFloat(
            this.playerReference, 'movetype', enabled ? MOVETYPE_FLY : MOVETYPE_WALK
        );
        this.receivePrint(
            this.playerReference, `flymode ${enabled ? 'ON' : 'OFF'}\n`, false
        );
        return enabled;
    }

    givePlayer(selector: string, value: number): boolean | undefined {
        if (this.cvarValue('deathmatch') !== 0) return undefined;
        const code = selector[0] ?? '';
        const amount = Number.isFinite(value) ? Math.trunc(value) : 0;
        if (code >= '0' && code <= '9') {
            if (code >= '2') {
                const weaponBit = IT_SHOTGUN << (code.charCodeAt(0) - 50);
                const items = Math.trunc(this.vm.getEntityFloat(
                    this.playerReference, 'items'
                ));
                this.vm.setEntityFloat(this.playerReference, 'items', items | weaponBit);
            }
            return true;
        }
        const field = code === 's' ? 'ammo_shells' :
            code === 'n' ? 'ammo_nails' :
                code === 'r' ? 'ammo_rockets' :
                    code === 'c' ? 'ammo_cells' :
                        code === 'h' ? 'health' : undefined;
        if (field) this.vm.setEntityFloat(this.playerReference, field, amount);
        return true;
    }

    requestLevelTransition(mapName: string): void {
        if (!this.pendingLevelName) this.pendingLevelName = mapName;
    }

    requestRestart(): void {
        if (!this.pendingLevelName) this.pendingRestart = true;
    }

    takePendingLocalCommandText(): string {
        const text = this.pendingLocalCommandText;
        this.pendingLocalCommandText = '';
        return text;
    }

    takePendingLevelTransition(): QuakeLevelTransitionState | undefined {
        const restarting = this.pendingRestart;
        const mapName = restarting ? this.mapName : this.pendingLevelName;
        if (!mapName) return undefined;
        this.pendingRestart = false;
        this.pendingLevelName = undefined;
        const serverFlags = this.vm.getGlobalFloat('serverflags');
        if (!restarting) {
            this.vm.setGlobalWord('self', this.playerReference);
            this.vm.execute('SetChangeParms');
            this.clientSpawnParameters = Array.from(
                { length: QUAKE_SPAWN_PARAMETER_COUNT },
                (_, index) => this.vm.getGlobalFloat(`parm${index + 1}`)
            );
        }
        return {
            cvars: Object.fromEntries(this.cvars),
            mapName,
            serverFlags,
            spawnParameters: [...this.clientSpawnParameters]
        };
    }

    createNewGameTransition(mapName = 'start'): QuakeLevelTransitionState {
        const oldSelf = this.vm.getGlobalWord('self');
        const oldParameters = Array.from(
            { length: QUAKE_SPAWN_PARAMETER_COUNT },
            (_, index) => this.vm.getGlobalFloat(`parm${index + 1}`)
        );
        this.vm.setGlobalWord('self', this.playerReference);
        this.vm.execute('SetNewParms');
        const spawnParameters = Array.from(
            { length: QUAKE_SPAWN_PARAMETER_COUNT },
            (_, index) => this.vm.getGlobalFloat(`parm${index + 1}`)
        );
        this.vm.setGlobalWord('self', oldSelf);
        for (let index = 0; index < QUAKE_SPAWN_PARAMETER_COUNT; index++) {
            this.vm.setGlobalFloat(`parm${index + 1}`, oldParameters[index]);
        }
        return {
            cvars: {
                ...Object.fromEntries(this.cvars),
                coop: '0',
                deathmatch: '0'
            },
            mapName,
            serverFlags: 0,
            spawnParameters
        };
    }

    setSnapshotTime(time: number): void {
        if (!Number.isFinite(time) || time < 0) {
            throw new Error('Snapshot time must be a non-negative finite number');
        }
        this.time = time;
        this.physicsFrameStart = time;
        this.vm.setGlobalFloat('time', time);
        this.vm.setServerTime(time);
    }

    private playerFatVisibility(): Uint8Array<ArrayBufferLike> {
        const viewOrigin = this.playerViewOrigin();
        if (!this.entityVisibilityOrigin || this.entityVisibilityOrigin.some(
            (component, axis) => component !== viewOrigin[axis]
        )) {
            this.entityVisibilityOrigin = viewOrigin;
            this.entityVisibility = this.map.fatVisibleLeafs(viewOrigin);
        }
        return this.entityVisibility;
    }

    private playerViewOrigin(): Vec3 {
        const playerOrigin = this.vm.getEntityVector(this.playerReference, 'origin');
        const viewOffset = this.vm.getEntityVector(this.playerReference, 'view_ofs');
        return playerOrigin.map(
            (component, axis) => component + viewOffset[axis]
        ) as Vec3;
    }

    private checkClient(): number {
        if (!this.checkClientInitialized || this.time - this.checkClientLastTime >= 0.1) {
            this.checkClientInitialized = true;
            this.checkClientLastTime = this.time;
            const playerFlags = Math.trunc(
                this.vm.getEntityFloat(this.playerReference, 'flags')
            );
            this.checkClientReference = !this.vm.entity(this.playerReference).free &&
                this.vm.getEntityFloat(this.playerReference, 'health') > 0 &&
                (playerFlags & FL_NOTARGET) === 0 ? this.playerReference : 0;
            if (this.checkClientReference !== 0) {
                const playerOrigin = this.vm.getEntityVector(this.playerReference, 'origin');
                const playerViewOffset = this.vm.getEntityVector(
                    this.playerReference, 'view_ofs'
                );
                const playerView = playerOrigin.map(
                    (component, axis) => component + playerViewOffset[axis]
                ) as Vec3;
                this.checkClientVisibility = this.map.visibleLeafs(
                    this.map.findLeaf(playerView)
                );
            } else {
                this.checkClientVisibility = new Uint8Array();
            }
        }

        if (this.checkClientReference === 0 ||
            this.vm.entity(this.checkClientReference).free ||
            this.vm.getEntityFloat(this.checkClientReference, 'health') <= 0) {
            return 0;
        }
        const self = this.vm.getGlobalWord('self');
        if (self < 0 || self >= this.vm.edicts.length || this.vm.entity(self).free) {
            return 0;
        }
        const origin = this.vm.getEntityVector(self, 'origin');
        const viewOffset = this.vm.getEntityVector(self, 'view_ofs');
        const view = origin.map(
            (component, axis) => component + viewOffset[axis]
        ) as Vec3;
        const leaf = this.map.findLeaf(view);
        const bitIndex = leaf - 1;
        return bitIndex >= 0 &&
            (this.checkClientVisibility[bitIndex >> 3] & (1 << (bitIndex & 7))) !== 0 ?
            this.checkClientReference : 0;
    }

    viewPaletteShifts(renderedViewOrigin?: Vec3): QuakeViewColorShift[] {
        let viewOrigin = renderedViewOrigin;
        if (!viewOrigin) {
            const playerOrigin = this.vm.getEntityVector(this.playerReference, 'origin');
            const viewOffset = this.vm.getEntityVector(this.playerReference, 'view_ofs');
            viewOrigin = playerOrigin.map(
                (component, axis) => component + viewOffset[axis]
            ) as Vec3;
        }
        const contents = this.collision.pointContents(viewOrigin);
        const shifts: QuakeViewColorShift[] = [];
        if (contents === -5) {
            shifts.push({ color: [255, 80, 0], percent: 150 });
        } else if (contents === -4) {
            shifts.push({ color: [0, 25, 5], percent: 150 });
        } else if (contents === -3) {
            shifts.push({ color: [130, 80, 50], percent: 128 });
        }
        shifts.push({ color: this.damageShiftColor, percent: this.damageShift });
        shifts.push({ color: [215, 186, 69], percent: this.bonusShift });
        const items = this.clientData().items;
        if ((items & (1 << 22)) !== 0) {
            shifts.push({ color: [0, 0, 255], percent: 30 });
        } else if ((items & (1 << 21)) !== 0) {
            shifts.push({ color: [0, 255, 0], percent: 20 });
        } else if ((items & (1 << 19)) !== 0) {
            shifts.push({ color: [100, 100, 100], percent: 100 });
        } else if ((items & (1 << 20)) !== 0) {
            shifts.push({ color: [255, 255, 0], percent: 30 });
        }
        return shifts;
    }

    viewBlend(renderedViewOrigin?: Vec3): QuakeViewBlend {
        const shifts = this.viewPaletteShifts(renderedViewOrigin);

        let amount = 0;
        let color: Vec3 = [0, 0, 0];
        for (const shift of shifts) {
            const sourceAmount = shift.percent / 255;
            if (sourceAmount <= 0) {
                continue;
            }
            amount += sourceAmount * (1 - amount);
            const blend = sourceAmount / amount;
            color = color.map(
                (component, axis) => component * (1 - blend) + shift.color[axis] * blend
            ) as Vec3;
        }
        return {
            amount: Math.max(0, Math.min(1, amount)),
            color: color.map(component => component / 255) as Vec3
        };
    }

    traceLine(
        start: Vec3,
        end: Vec3,
        noMonsters: boolean,
        ignore: number,
        ignoreAlso = 0,
        missile = false
    ): { entity: number; trace: ReturnType<WorldCollision['tracePoint']> } {
        let entity = 0;
        let trace = this.collision.tracePoint(start, end);
        if (trace.modelIndex !== undefined) {
            entity = this.inlineModelReferences.get(trace.modelIndex) ?? 0;
        }
        if (noMonsters) {
            return { entity, trace };
        }
        const ignoreMins = this.vm.getEntityVector(ignore, 'mins');
        const ignoreMaxs = this.vm.getEntityVector(ignore, 'maxs');
        const ignoreHasSize = ignoreMins[0] !== ignoreMaxs[0];
        for (let reference = 1; reference < this.vm.edicts.length; reference++) {
            if (reference === ignore || reference === ignoreAlso || this.vm.entity(reference).free) {
                continue;
            }
            if (this.vm.getEntityWord(reference, 'owner') === ignore ||
                this.vm.getEntityWord(ignore, 'owner') === reference) {
                continue;
            }
            const solid = this.vm.getEntityFloat(reference, 'solid');
            if (solid !== SOLID_BBOX && solid !== SOLID_SLIDEBOX) {
                continue;
            }
            const candidateMins = this.vm.getEntityVector(reference, 'mins');
            const candidateMaxs = this.vm.getEntityVector(reference, 'maxs');
            if (ignoreHasSize && candidateMins[0] === candidateMaxs[0]) {
                continue;
            }
            const bounds = this.entityCollisionBounds(reference);
            const flags = Math.trunc(this.vm.getEntityFloat(reference, 'flags'));
            const traceBounds = missile && (flags & FL_MONSTER) !== 0 ? {
                maximum: bounds.maximum.map(component => component + 15) as Vec3,
                minimum: bounds.minimum.map(component => component - 15) as Vec3
            } : bounds;
            const candidate = this.traceBoundingBox(start, end, traceBounds);
            if (candidate && candidate.fraction < trace.fraction) {
                entity = reference;
                trace = candidate;
            }
        }
        return { entity, trace };
    }

    tracePlayerMovement(start: Vec3, end: Vec3): QuakePlayerMovementTrace {
        const result = this.traceMovingBox(
            start,
            end,
            this.vm.getEntityVector(this.playerReference, 'mins'),
            this.vm.getEntityVector(this.playerReference, 'maxs'),
            this.playerReference
        );
        return {
            ...result,
            solid: result.entity === 0 ? SOLID_BSP :
                this.vm.getEntityFloat(result.entity, 'solid')
        };
    }

    aim(reference: number, _missileSpeed: number): Vec3 {
        const forward = this.vm.getGlobalVector('v_forward');
        const origin = this.vm.getEntityVector(reference, 'origin');
        const teamplay = this.cvarValue('teamplay') !== 0;
        const team = this.vm.getEntityFloat(reference, 'team');
        const isTeammate = (candidate: number): boolean => teamplay && team > 0 &&
            team === this.vm.getEntityFloat(candidate, 'team');
        const start: Vec3 = [origin[0], origin[1], origin[2] + 20];
        const directEnd = start.map(
            (component, axis) => component + forward[axis] * 2_048
        ) as Vec3;
        const directEntity = this.traceLine(start, directEnd, false, reference).entity;
        if (directEntity !== 0 &&
            this.vm.getEntityFloat(directEntity, 'takedamage') === 2 &&
            !isTeammate(directEntity)) {
            return forward;
        }

        let bestDirection = forward;
        let bestDot = this.cvarValue('sv_aim');
        let bestEntity = 0;
        for (let candidate = 1; candidate < this.vm.edicts.length; candidate++) {
            if (candidate === reference || this.vm.entity(candidate).free ||
                this.vm.getEntityFloat(candidate, 'takedamage') !== 2 ||
                isTeammate(candidate)) {
                continue;
            }
            const candidateOrigin = this.vm.getEntityVector(candidate, 'origin');
            const mins = this.vm.getEntityVector(candidate, 'mins');
            const maxs = this.vm.getEntityVector(candidate, 'maxs');
            const center = candidateOrigin.map(
                (component, axis) => component + (mins[axis] + maxs[axis]) * 0.5
            ) as Vec3;
            const direction = center.map(
                (component, axis) => component - start[axis]
            ) as Vec3;
            const length = Math.hypot(...direction);
            if (length === 0) continue;
            const normalized = direction.map(component => component / length) as Vec3;
            const candidateDot = dot(normalized, forward);
            if (candidateDot < bestDot ||
                this.traceLine(start, center, false, reference).entity !== candidate) {
                continue;
            }
            bestDot = candidateDot;
            bestDirection = normalized;
            bestEntity = candidate;
        }
        if (bestEntity === 0) return bestDirection;

        const targetDirection = this.vm.getEntityVector(bestEntity, 'origin').map(
            (component, axis) => component - origin[axis]
        ) as Vec3;
        const forwardDistance = dot(targetDirection, forward);
        const aimedDirection: Vec3 = [
            forward[0] * forwardDistance,
            forward[1] * forwardDistance,
            targetDirection[2]
        ];
        const aimedLength = Math.hypot(...aimedDirection);
        return aimedLength === 0 ? forward :
            aimedDirection.map(component => component / aimedLength) as Vec3;
    }

    moveStep(reference: number, movement: Vec3, relink = true): boolean {
        const flags = Math.trunc(this.vm.getEntityFloat(reference, 'flags'));
        if ((flags & (FL_ONGROUND | FL_FLY | FL_SWIM)) === 0) {
            return false;
        }
        const origin = this.vm.getEntityVector(reference, 'origin');
        const mins = this.vm.getEntityVector(reference, 'mins');
        const maxs = this.vm.getEntityVector(reference, 'maxs');
        const wishedOrigin = origin.map(
            (component, axis) => component + movement[axis]
        ) as Vec3;
        if ((flags & (FL_FLY | FL_SWIM)) !== 0) {
            const enemy = this.vm.getEntityWord(reference, 'enemy');
            for (let attempt = 0; attempt < 2; attempt++) {
                const end = [...wishedOrigin] as Vec3;
                if (attempt === 0 && enemy !== 0 && !this.vm.entity(enemy).free) {
                    const verticalDistance = origin[2] - this.vm.getEntityVector(enemy, 'origin')[2];
                    if (verticalDistance > 40) end[2] -= 8;
                    if (verticalDistance < 30) end[2] += 8;
                }
                const { trace } = this.traceMovingBox(origin, end, mins, maxs, reference);
                if (trace.fraction === 1 &&
                    ((flags & FL_SWIM) === 0 ||
                        this.collision.pointContents(trace.endPosition) !== -1)) {
                    this.vm.setEntityVector(reference, 'origin', trace.endPosition);
                    if (relink) this.touchTriggers(reference);
                    return true;
                }
                if (enemy === 0 || this.vm.entity(enemy).free) break;
            }
            return false;
        }

        let stepStart: Vec3 = [wishedOrigin[0], wishedOrigin[1], wishedOrigin[2] + 18];
        const stepEnd: Vec3 = [stepStart[0], stepStart[1], stepStart[2] - 36];
        let traceResult = this.traceMovingBox(stepStart, stepEnd, mins, maxs, reference);
        let { trace } = traceResult;
        if (trace.allSolid) {
            return false;
        }
        if (trace.startSolid) {
            stepStart = [wishedOrigin[0], wishedOrigin[1], wishedOrigin[2]];
            traceResult = this.traceMovingBox(stepStart, stepEnd, mins, maxs, reference);
            trace = traceResult.trace;
            if (trace.allSolid || trace.startSolid) {
                return false;
            }
        }
        if (trace.fraction === 1) {
            if ((flags & FL_PARTIALGROUND) === 0) {
                return false;
            }
            this.vm.setEntityVector(reference, 'origin', wishedOrigin);
            this.vm.setEntityFloat(reference, 'flags', flags & ~FL_ONGROUND);
            if (relink) this.touchTriggers(reference);
            return true;
        }
        this.vm.setEntityVector(reference, 'origin', trace.endPosition);
        if (!this.checkBottom(reference)) {
            if ((flags & FL_PARTIALGROUND) !== 0) {
                if (relink) this.touchTriggers(reference);
                return true;
            }
            this.vm.setEntityVector(reference, 'origin', origin);
            return false;
        }
        this.vm.setEntityWord(reference, 'groundentity', traceResult.entity);
        this.vm.setEntityFloat(reference, 'flags', (flags | FL_ONGROUND) & ~FL_PARTIALGROUND);
        if (relink) this.touchTriggers(reference);
        return true;
    }

    checkBottom(reference: number): boolean {
        const bounds = this.entityCollisionBounds(reference);
        const corner: Vec3 = [0, 0, bounds.minimum[2] - 1];
        let allCornersSolid = true;
        for (const x of [bounds.minimum[0], bounds.maximum[0]]) {
            for (const y of [bounds.minimum[1], bounds.maximum[1]]) {
                corner[0] = x;
                corner[1] = y;
                if (this.collision.pointContents(corner) !== -2) {
                    allCornersSolid = false;
                    break;
                }
            }
            if (!allCornersSolid) break;
        }
        if (allCornersSolid) {
            return true;
        }

        const middle: Vec3 = [
            (bounds.minimum[0] + bounds.maximum[0]) * 0.5,
            (bounds.minimum[1] + bounds.maximum[1]) * 0.5,
            bounds.minimum[2]
        ];
        const stop: Vec3 = [middle[0], middle[1], middle[2] - 36];
        const middleTrace = this.traceLine(middle, stop, true, reference).trace;
        if (middleTrace.fraction === 1) {
            return false;
        }
        const middleBottom = middleTrace.endPosition[2];
        for (const x of [bounds.minimum[0], bounds.maximum[0]]) {
            for (const y of [bounds.minimum[1], bounds.maximum[1]]) {
                const start: Vec3 = [x, y, bounds.minimum[2]];
                const trace = this.traceLine(start, [x, y, stop[2]], true, reference).trace;
                if (trace.fraction === 1 || middleBottom - trace.endPosition[2] > 18) {
                    return false;
                }
            }
        }
        return true;
    }

    dropToFloor(reference: number): boolean {
        const origin = this.vm.getEntityVector(reference, 'origin');
        const end: Vec3 = [origin[0], origin[1], origin[2] - 256];
        const result = this.traceMovingBox(
            origin,
            end,
            this.vm.getEntityVector(reference, 'mins'),
            this.vm.getEntityVector(reference, 'maxs'),
            reference
        );
        if (result.trace.fraction === 1 || result.trace.allSolid) {
            return false;
        }
        this.vm.setEntityVector(reference, 'origin', result.trace.endPosition);
        const flags = Math.trunc(this.vm.getEntityFloat(reference, 'flags'));
        this.vm.setEntityFloat(reference, 'flags', flags | FL_ONGROUND);
        this.vm.setEntityWord(reference, 'groundentity', result.entity);
        this.updateLinkedBounds(reference);
        return true;
    }

    moveToGoal(reference: number, distance: number): void {
        const flags = Math.trunc(this.vm.getEntityFloat(reference, 'flags'));
        if ((flags & (FL_ONGROUND | FL_FLY | FL_SWIM)) === 0) {
            return;
        }
        const goal = this.vm.getEntityWord(reference, 'goalentity');
        if (goal === 0 || this.vm.entity(goal).free) return;
        const actorBounds: EntityBounds = {
            maximum: this.vm.getEntityVector(reference, 'absmax'),
            minimum: this.vm.getEntityVector(reference, 'absmin')
        };
        const goalBounds: EntityBounds = {
            maximum: this.vm.getEntityVector(goal, 'absmax'),
            minimum: this.vm.getEntityVector(goal, 'absmin')
        };
        const enemy = this.vm.getEntityWord(reference, 'enemy');
        if (enemy !== 0 && actorBounds.minimum.every(
            (minimum, axis) => minimum <= goalBounds.maximum[axis] + distance &&
            actorBounds.maximum[axis] >= goalBounds.minimum[axis] - distance
        )) {
            return;
        }
        if ((this.gameplayRandomInteger() & 3) === 1 || !this.stepDirection(
            reference, this.vm.getEntityFloat(reference, 'ideal_yaw'), distance
        )) {
            this.newChaseDirection(reference, goal, distance);
        }
    }

    private newChaseDirection(reference: number, goal: number, distance: number): void {
        const actorOrigin = this.vm.getEntityVector(reference, 'origin');
        const goalOrigin = this.vm.getEntityVector(goal, 'origin');
        const oldDirection = quakeAngleMod(
            Math.trunc(this.vm.getEntityFloat(reference, 'ideal_yaw') / 45) * 45
        );
        const turnaround = quakeAngleMod(oldDirection - 180);
        const deltaX = goalOrigin[0] - actorOrigin[0];
        const deltaY = goalOrigin[1] - actorOrigin[1];
        const directions = [
            deltaX > 10 ? 0 : deltaX < -10 ? 180 : -1,
            deltaY < -10 ? 270 : deltaY > 10 ? 90 : -1
        ];

        if (directions[0] !== -1 && directions[1] !== -1) {
            const diagonal = directions[0] === 0 ?
                (directions[1] === 90 ? 45 : 315) :
                (directions[1] === 90 ? 135 : 215);
            if (diagonal !== turnaround && this.stepDirection(reference, diagonal, distance)) {
                return;
            }
        }
        if (((this.gameplayRandomInteger() & 3) & 1) !== 0 ||
            Math.abs(deltaY) > Math.abs(deltaX)) {
            directions.reverse();
        }
        for (const direction of directions) {
            if (direction !== -1 && direction !== turnaround &&
                this.stepDirection(reference, direction, distance)) {
                return;
            }
        }
        if (this.stepDirection(reference, oldDirection, distance)) return;

        const searchDirections = this.gameplayRandomInteger() & 1 ?
            [0, 45, 90, 135, 180, 225, 270, 315] :
            [315, 270, 225, 180, 135, 90, 45, 0];
        for (const direction of searchDirections) {
            if (direction !== turnaround && this.stepDirection(reference, direction, distance)) {
                return;
            }
        }
        if (this.stepDirection(reference, turnaround, distance)) return;
        this.vm.setEntityFloat(reference, 'ideal_yaw', oldDirection);
        if (!this.checkBottom(reference)) {
            const flags = Math.trunc(this.vm.getEntityFloat(reference, 'flags'));
            this.vm.setEntityFloat(reference, 'flags', flags | FL_PARTIALGROUND);
        }
    }

    private stepDirection(reference: number, yaw: number, distance: number): boolean {
        this.vm.setEntityFloat(reference, 'ideal_yaw', yaw);
        this.changeYaw(reference);
        const radians = yaw * Math.PI / 180;
        const origin = this.vm.getEntityVector(reference, 'origin');
        const moved = this.moveStep(reference, [
            Math.cos(radians) * distance,
            Math.sin(radians) * distance,
            0
        ], false);
        if (moved) {
            const delta = this.vm.getEntityVector(reference, 'angles')[1] -
                this.vm.getEntityFloat(reference, 'ideal_yaw');
            if (delta > 45 && delta < 315) {
                this.vm.setEntityVector(reference, 'origin', origin);
            }
        }
        this.touchTriggers(reference);
        return moved;
    }

    private changeYaw(reference: number): void {
        let current = quakeAngleMod(this.vm.getEntityVector(reference, 'angles')[1]);
        const ideal = this.vm.getEntityFloat(reference, 'ideal_yaw');
        const speed = this.vm.getEntityFloat(reference, 'yaw_speed');
        if (current === ideal) return;
        let move = ideal - current;
        if (ideal > current ? move >= 180 : move <= -180) {
            move += ideal > current ? -360 : 360;
        }
        move = Math.max(-speed, Math.min(speed, move));
        current = quakeAngleMod(current + move);
        const angles = this.vm.getEntityVector(reference, 'angles');
        angles[1] = current;
        this.vm.setEntityVector(reference, 'angles', angles);
    }

    private gameplayRandomInteger(): number {
        this.gameplayRandomState = (
            Math.imul(this.gameplayRandomState, 1_103_515_245) + 12_345
        ) & 0x7fffffff;
        return this.gameplayRandomState & 0x7fff;
    }

    private updateDynamicLights(frameTime: number): void {
        for (const [key, light] of this.dynamicLights) {
            light.radius -= light.decay * frameTime;
            if (light.die < this.time || light.radius <= light.minimumLight) {
                this.dynamicLights.delete(key);
            }
        }
    }

    private entityCollisionBounds(reference: number): EntityBounds {
        const origin = this.vm.getEntityVector(reference, 'origin');
        return {
            maximum: this.vm.getEntityVector(reference, 'maxs').map(
                (component, axis) => component + origin[axis]
            ) as Vec3,
            minimum: this.vm.getEntityVector(reference, 'mins').map(
                (component, axis) => component + origin[axis]
            ) as Vec3
        };
    }

    private traceBoundingBox(
        start: Vec3,
        end: Vec3,
        bounds: EntityBounds
    ): ReturnType<WorldCollision['tracePoint']> | null {
        let entryFraction = Number.NEGATIVE_INFINITY;
        let exitFraction = Number.POSITIVE_INFINITY;
        let hitNormal: Vec3 = [0, 0, 0];
        const startsInside = start.every(
            (component, axis) => component > bounds.minimum[axis] &&
                component < bounds.maximum[axis]
        );
        for (let axis = 0; axis < 3; axis++) {
            const direction = end[axis] - start[axis];
            if (Math.abs(direction) < 1e-8) {
                if (start[axis] < bounds.minimum[axis] || start[axis] > bounds.maximum[axis]) {
                    return null;
                }
                continue;
            }
            let near = (bounds.minimum[axis] - start[axis]) / direction;
            let far = (bounds.maximum[axis] - start[axis]) / direction;
            let normalDirection = -1;
            if (near > far) {
                [near, far] = [far, near];
                normalDirection = 1;
            }
            if (near > entryFraction) {
                entryFraction = near;
                hitNormal = [0, 0, 0];
                hitNormal[axis] = normalDirection;
            }
            exitFraction = Math.min(exitFraction, far);
            if (entryFraction > exitFraction) {
                return null;
            }
        }
        if (startsInside) {
            entryFraction = 0;
        } else if (entryFraction < 0) {
            // A point resting on a box face and moving away or parallel is not
            // entering the box. Treating it as start-solid prevents sliding.
            return null;
        }
        if (entryFraction > 1 || exitFraction < 0) {
            return null;
        }
        const endPosition = start.map(
            (component, axis) => component + (end[axis] - component) * entryFraction
        ) as Vec3;
        return {
            allSolid: startsInside && exitFraction > 1,
            endPosition,
            fraction: entryFraction,
            inOpen: true,
            inWater: false,
            plane: {
                distance: hitNormal.reduce(
                    (sum, component, axis) => sum + component * endPosition[axis], 0
                ),
                normal: hitNormal
            },
            startSolid: startsInside
        };
    }

    private traceMovingBox(
        start: Vec3,
        end: Vec3,
        mins: Vec3,
        maxs: Vec3,
        ignore: number,
        ignoreAlso = 0,
        noMonsters = false
    ): { entity: number; trace: HullTrace } {
        let trace = this.collision.traceBox(start, end, mins, maxs);
        let entity = trace.modelIndex === undefined ? 0 :
            this.inlineModelReferences.get(trace.modelIndex) ?? 0;
        if (noMonsters) return { entity, trace };
        const moverHasSize = mins[0] !== maxs[0];
        for (let reference = 1; reference < this.vm.edicts.length; reference++) {
            if (reference === ignore || reference === ignoreAlso || this.vm.entity(reference).free) {
                continue;
            }
            if (this.vm.getEntityWord(reference, 'owner') === ignore ||
                this.vm.getEntityWord(ignore, 'owner') === reference) {
                continue;
            }
            const solid = this.vm.getEntityFloat(reference, 'solid');
            if (solid !== SOLID_BBOX && solid !== SOLID_SLIDEBOX) continue;
            const candidateMins = this.vm.getEntityVector(reference, 'mins');
            const candidateMaxs = this.vm.getEntityVector(reference, 'maxs');
            if (moverHasSize && candidateMins[0] === candidateMaxs[0]) {
                continue;
            }
            const bounds = this.entityCollisionBounds(reference);
            const expandedBounds: EntityBounds = {
                maximum: bounds.maximum.map(
                    (component, axis) => component - mins[axis]
                ) as Vec3,
                minimum: bounds.minimum.map(
                    (component, axis) => component - maxs[axis]
                ) as Vec3
            };
            const candidate = this.traceBoundingBox(start, end, expandedBounds);
            if (candidate && (candidate.allSolid || candidate.startSolid ||
                candidate.fraction < trace.fraction)) {
                if (trace.startSolid) candidate.startSolid = true;
                entity = reference;
                trace = candidate;
            }
        }
        return { entity, trace };
    }

    private writeMessage(
        destination: number,
        kind: 'angle' | 'byte' | 'char' | 'coord' | 'entity' | 'long' | 'short' | 'string',
        value: number | string
    ): void {
        if (typeof value === 'number' && kind !== 'string') {
            value = quakeProtocolMessageNumber(kind, value);
        }
        const hasTemporaryMessage = this.temporaryMessages.has(destination);
        if (!hasTemporaryMessage && kind === 'byte' && value === 30) {
            this.intermission = 1;
            this.completedTime = this.time;
            return;
        }
        if (!hasTemporaryMessage && kind === 'byte' && (value === 31 || value === 34)) {
            this.intermission = value === 31 ? 2 : 3;
            this.completedTime = this.time;
            return;
        }
        if (kind === 'string' && this.intermission >= 2 && typeof value === 'string') {
            this.centerMessage = value.slice(0, 1_023);
            this.centerMessageRemaining = Number.POSITIVE_INFINITY;
            return;
        }
        if (kind === 'byte' && value === 23) {
            this.temporaryMessages.set(destination, {
                bytes: [],
                coordinates: [],
                waitingForType: true
            });
            return;
        }
        const message = this.temporaryMessages.get(destination);
        if (!message || typeof value !== 'number') {
            return;
        }
        if (message.waitingForType && kind === 'byte') {
            message.type = Math.trunc(value);
            message.waitingForType = false;
            return;
        }
        if (kind === 'coord') {
            message.coordinates.push(value);
        } else if (kind === 'entity') {
            message.entity = Math.trunc(value);
        } else if (kind === 'byte') {
            message.bytes.push(Math.trunc(value));
        }
        const beam = message.type === 5 || message.type === 6 ||
            message.type === 9 || message.type === 13;
        const payloadComplete = beam ? message.entity !== undefined &&
            message.coordinates.length >= 6 :
            message.coordinates.length >= 3 &&
            (message.type !== 12 || message.bytes.length >= 2);
        if (payloadComplete) {
            this.queueClientMessage({
                kind: 'temporary',
                message: {
                    bytes: [...message.bytes],
                    coordinates: [...message.coordinates],
                    entity: message.entity,
                    type: message.type,
                    waitingForType: false
                }
            });
            this.temporaryMessages.delete(destination);
        }
    }

    private queueClientMessage(message: PendingClientMessage): void {
        if (this.deferClientMessages) {
            this.pendingClientMessages.push(message);
        } else if (message.kind === 'particle') {
            this.emitParticleEvent(message.event);
        } else {
            this.finishTemporaryEntity(message.message);
        }
    }

    private flushPendingClientMessages(): void {
        for (const message of this.pendingClientMessages.splice(0)) {
            if (message.kind === 'particle') {
                this.emitParticleEvent(message.event);
            } else {
                this.finishTemporaryEntity(message.message);
            }
        }
    }

    private finishTemporaryEntity(message: TemporaryEntityMessage): void {
        if (message.type === undefined || message.coordinates.length < 3) {
            return;
        }
        const origin = message.coordinates.slice(0, 3) as Vec3;
        const effect = (color: number, count: number): void => {
            this.emitParticleEvent({
                color,
                count,
                direction: [0, 0, 0],
                kind: 'effect',
                origin
            });
        };
        switch (message.type) {
            case 5:
            case 6:
            case 9:
            case 13:
                this.addBeam(message);
                break;
            case 0:
                effect(0, 10);
                this.addSpikeImpactSound(origin);
                break;
            case 1:
                effect(0, 20);
                this.addSpikeImpactSound(origin);
                break;
            case 2:
                effect(0, 20);
                break;
            case 3:
                this.emitParticleEvent({
                    color: 0,
                    count: 1_024,
                    direction: [0, 0, 0],
                    kind: 'explosion',
                    origin
                });
                this.addExplosionLight(origin);
                this.addTemporarySound(origin, 'weapons/r_exp3.wav');
                break;
            case 4:
                this.emitParticleEvent({
                    color: 0,
                    count: 1_024,
                    direction: [0, 0, 0],
                    kind: 'blob',
                    origin
                });
                this.addTemporarySound(origin, 'weapons/r_exp3.wav');
                break;
            case 7:
                effect(20, 30);
                this.addTemporarySound(origin, 'wizard/hit.wav');
                break;
            case 8:
                effect(226, 20);
                this.addTemporarySound(origin, 'hknight/hit.wav');
                break;
            case 10:
                this.emitParticleEvent({
                    color: 224,
                    count: 1_024,
                    direction: [0, 0, 0],
                    kind: 'lava',
                    origin
                });
                break;
            case 11:
                this.emitParticleEvent({
                    color: 7,
                    count: 896,
                    direction: [0, 0, 0],
                    kind: 'teleport',
                    origin
                });
                break;
            case 12:
                this.emitParticleEvent({
                    color: message.bytes[0],
                    colorLength: message.bytes[1],
                    count: 512,
                    direction: [0, 0, 0],
                    kind: 'explosion2',
                    origin
                });
                this.addExplosionLight(origin);
                this.addTemporarySound(origin, 'weapons/r_exp3.wav');
                break;
            default:
                break;
        }
    }

    private addBeam(message: TemporaryEntityMessage): void {
        const model = TEMPORARY_BEAM_MODELS.get(message.type ?? -1);
        if (model === undefined || message.entity === undefined ||
            message.coordinates.length < 6) {
            return;
        }
        const beam: QuakeBeam = {
            end: message.coordinates.slice(3, 6) as Vec3,
            endTime: this.time + 0.2,
            entity: message.entity,
            model,
            start: message.coordinates.slice(0, 3) as Vec3
        };
        if (this.beams.has(message.entity)) {
            this.beams.set(message.entity, beam);
            return;
        }
        for (const [entity, existing] of this.beams) {
            if (existing.endTime < this.time) {
                this.beams.delete(entity);
                this.beams.set(message.entity, beam);
                return;
            }
        }
        if (this.beams.size >= MAX_BEAMS) {
            this.printToConsole('beam list overflow!\n');
            return;
        }
        this.beams.set(message.entity, beam);
    }

    private addExplosionLight(origin: Vec3): void {
        const key = -(++this.temporaryLightSequence);
        this.dynamicLights.set(key, {
            decay: 300,
            die: this.time + 0.5,
            key,
            minimumLight: 0,
            origin,
            radius: 350
        });
    }

    private addSpikeImpactSound(origin: Vec3): void {
        let sample = 'weapons/tink1.wav';
        if (this.temporaryRandom() % 5 === 0) {
            const ricochet = this.temporaryRandom() & 3;
            sample = ricochet === 1 ? 'weapons/ric1.wav' :
                ricochet === 2 ? 'weapons/ric2.wav' : 'weapons/ric3.wav';
        }
        this.addTemporarySound(origin, sample);
    }

    private temporaryRandom(): number {
        this.temporaryRandomState = (
            Math.imul(this.temporaryRandomState, 1_103_515_245) + 12_345
        ) & 0x7fffffff;
        return this.temporaryRandomState;
    }

    private addTemporarySound(origin: Vec3, sample: string): void {
        this.queueSound({
            attenuation: 1,
            channel: 0,
            entity: -1,
            origin,
            sample,
            volume: 1
        });
    }

    private collectEntityEffects(): void {
        for (let reference = 1; reference < this.vm.edicts.length; reference++) {
            if (this.vm.entity(reference).free) {
                continue;
            }
            const effects = Math.trunc(this.vm.getEntityFloat(reference, 'effects'));
            const visible = this.entityVisible(reference);
            const origin = this.vm.getEntityVector(reference, 'origin').map(
                quakeProtocolCoordinate
            ) as Vec3;
            if (visible && (effects & EF_BRIGHTFIELD) !== 0) {
                this.emitParticleEvent({
                    color: 0x6f,
                    count: 162,
                    direction: [0, 0, 0],
                    kind: 'entity',
                    origin
                });
            }
            if ((effects & EF_MUZZLEFLASH) !== 0) {
                if (visible) {
                    const angles = this.vm.getEntityVector(reference, 'angles').map(
                        quakeProtocolAngle
                    ) as Vec3;
                    const pitch = angles[0] * Math.PI / 180;
                    const yaw = angles[1] * Math.PI / 180;
                    const forward: Vec3 = [
                        Math.cos(pitch) * Math.cos(yaw),
                        Math.cos(pitch) * Math.sin(yaw),
                        -Math.sin(pitch)
                    ];
                    this.dynamicLights.set(reference, {
                        decay: 0,
                        die: this.time + 0.1,
                        key: reference,
                        minimumLight: 32,
                        origin: [
                            origin[0] + forward[0] * 18,
                            origin[1] + forward[1] * 18,
                            origin[2] + 16 + forward[2] * 18
                        ],
                        radius: 200 + (this.temporaryRandom() & 31)
                    });
                }
                this.vm.setEntityFloat(reference, 'effects', effects & ~EF_MUZZLEFLASH);
            }
            if (visible && (effects & EF_BRIGHTLIGHT) !== 0) {
                this.dynamicLights.set(reference, {
                    decay: 0,
                    die: this.time + 0.001,
                    key: reference,
                    minimumLight: 0,
                    origin: [origin[0], origin[1], origin[2] + 16],
                    radius: 400 + (this.temporaryRandom() & 31)
                });
            } else if (visible && (effects & EF_DIMLIGHT) !== 0) {
                this.dynamicLights.set(reference, {
                    decay: 0,
                    die: this.time + 0.001,
                    key: reference,
                    minimumLight: 0,
                    origin,
                    radius: 200 + (this.temporaryRandom() & 31)
                });
            }
        }
    }

    private collectPlayerDamage(): void {
        const health = this.vm.getEntityFloat(this.playerReference, 'health');
        const armor = this.vm.getEntityFloat(this.playerReference, 'armorvalue');
        const blood = Math.trunc(Math.max(
            0, this.vm.getEntityFloat(this.playerReference, 'dmg_take')
        )) & 255;
        const armorDamage = Math.trunc(Math.max(
            0, this.vm.getEntityFloat(this.playerReference, 'dmg_save')
        )) & 255;
        if (blood > 0 || armorDamage > 0) {
            const count = Math.max(10, (blood + armorDamage) * 0.5);
            this.damageShift = Math.min(150, Math.trunc(
                this.damageShift + 3 * count
            ));
            this.damageShiftColor = armorDamage > blood ? [200, 100, 100] :
                armorDamage > 0 ? [220, 50, 50] : [255, 0, 0];
            this.faceAnimationUntil = this.time + 0.2;
            const playerOrigin = this.vm.getEntityVector(this.playerReference, 'origin');
            const inflictor = this.vm.getEntityWord(this.playerReference, 'dmg_inflictor');
            const sourceOrigin = (inflictor > 0 && inflictor < this.vm.edicts.length &&
                !this.vm.entity(inflictor).free ?
                this.entitySoundOrigin(inflictor) : [0, 0, 0] as Vec3
            ).map(quakeProtocolCoordinate) as Vec3;
            const from = sourceOrigin.map(
                (component, axis) => component - playerOrigin[axis]
            ) as Vec3;
            const magnitude = Math.hypot(...from);
            if (magnitude > 0) {
                for (let axis = 0; axis < 3; axis++) from[axis] /= magnitude;
            }
            const angles = this.vm.getEntityVector(this.playerReference, 'angles');
            const pitch = angles[0] * Math.PI / 180;
            const yaw = angles[1] * Math.PI / 180;
            const forward: Vec3 = [
                Math.cos(pitch) * Math.cos(yaw),
                Math.cos(pitch) * Math.sin(yaw),
                -Math.sin(pitch)
            ];
            const right: Vec3 = [Math.sin(yaw), -Math.cos(yaw), 0];
            this.damageKickRoll = count * dot(from, right) * this.viewKickRoll;
            this.damageKickPitch = count * dot(from, forward) * this.viewKickPitch;
            this.damageKickTime = this.viewKickTime;
        }
        this.vm.setEntityFloat(this.playerReference, 'dmg_take', 0);
        this.vm.setEntityFloat(this.playerReference, 'dmg_save', 0);
        this.previousHealth = health;
        this.previousArmor = armor;
    }

    private collectItemPickups(): void {
        const items = Math.trunc(this.vm.getEntityFloat(this.playerReference, 'items'));
        const acquired = items & ~this.previousItems;
        for (let bit = 0; bit < 32; bit++) {
            if ((acquired & (1 << bit)) !== 0) {
                this.itemGetTimes[bit] = this.time;
            }
        }
        this.previousItems = items;
    }

    private decayPunchAngle(frameTime: number): void {
        const punchAngle = this.vm.getEntityVector(this.playerReference, 'punchangle');
        const magnitude = Math.hypot(...punchAngle);
        if (magnitude === 0) {
            return;
        }
        const newMagnitude = Math.max(0, magnitude - 10 * frameTime);
        this.vm.setEntityVector(this.playerReference, 'punchangle', punchAngle.map(
            component => component * newMagnitude / magnitude
        ) as Vec3);
    }

    private receivePrint(entity: number, message: string, centered: boolean): void {
        if (entity !== 0 && entity !== this.playerReference) {
            return;
        }
        if (centered) {
            this.centerMessage = message.slice(0, 1_023);
            this.centerMessageRemaining = this.centerMessageDuration;
            return;
        }
        for (const character of message) {
            if (character === '\n' || this.pendingNotifyText.length >= 38) {
                const text = this.pendingNotifyText;
                this.consoleLines.push(text);
                this.notifyLines.push({ expiresAt: this.time + 3, text });
                this.pendingNotifyText = '';
                if (character === '\n') {
                    continue;
                }
            }
            if (character !== '\r') {
                this.pendingNotifyText += character;
            }
        }
        this.consoleLines.splice(0, Math.max(0, this.consoleLines.length - 1_024));
        this.notifyLines.splice(0, Math.max(0, this.notifyLines.length - 16));
    }

    private setSpawnParameters(entity: number): void {
        if (entity !== this.playerReference) {
            throw new Error('QuakeC error: Entity is not a client');
        }
        for (let index = 0; index < QUAKE_SPAWN_PARAMETER_COUNT; index++) {
            this.vm.setGlobalFloat(`parm${index + 1}`, this.clientSpawnParameters[index]);
        }
    }

    private spawnPlayer(spawnParameters?: readonly number[], playerName = 'player'): void {
        this.vm.setGlobalWord('self', this.playerReference);
        this.vm.setEntityString(this.playerReference, 'netname', playerName.slice(0, 15));
        if (spawnParameters) {
            if (spawnParameters.length !== QUAKE_SPAWN_PARAMETER_COUNT ||
                spawnParameters.some(value => !Number.isFinite(value))) {
                throw new Error('Quake level transition has invalid spawn parameters');
            }
            this.clientSpawnParameters = [...spawnParameters];
            this.setSpawnParameters(this.playerReference);
        } else {
            this.vm.execute('SetNewParms');
            this.clientSpawnParameters = Array.from(
                { length: QUAKE_SPAWN_PARAMETER_COUNT },
                (_, index) => this.vm.getGlobalFloat(`parm${index + 1}`)
            );
        }
        this.vm.execute('ClientConnect');
        this.vm.execute('PutClientInServer');
        this.updateLinkedBounds(this.playerReference);
    }

    private synchronizePlayer(state: QuakePlayerState): void {
        const viewAngles = state.angles.map(quakeProtocolAngle) as Vec3;
        this.vm.setEntityVector(this.playerReference, 'origin', state.origin);
        if (state.oldOrigin) {
            this.vm.setEntityVector(this.playerReference, 'oldorigin', state.oldOrigin);
        }
        this.vm.setEntityVector(this.playerReference, 'velocity', state.velocity);
        this.vm.setEntityVector(
            this.playerReference,
            'angles',
            state.entityAngles ?? viewAngles
        );
        if (state.angularVelocity) {
            this.vm.setEntityVector(this.playerReference, 'avelocity', state.angularVelocity);
        }
        this.vm.setEntityVector(this.playerReference, 'v_angle', viewAngles);
        this.vm.setEntityFloat(this.playerReference, 'button0', state.attack ? 1 : 0);
        this.vm.setEntityFloat(this.playerReference, 'button2', state.jump ? 1 : 0);
        const moveType = Math.trunc(this.vm.getEntityFloat(this.playerReference, 'movetype'));
        if (moveType === MOVETYPE_WALK && state.waterLevel !== undefined) {
            this.vm.setEntityFloat(this.playerReference, 'waterlevel', state.waterLevel);
        }
        if (moveType === MOVETYPE_WALK && state.waterType !== undefined) {
            this.vm.setEntityFloat(this.playerReference, 'watertype', state.waterType);
        }
        const currentFlags = Math.trunc(this.vm.getEntityFloat(this.playerReference, 'flags'));
        let flags = state.jumped ? currentFlags & ~FL_JUMPRELEASED : currentFlags;
        if (state.waterJump !== undefined) {
            if (state.waterJump) {
                flags |= FL_WATERJUMP;
            } else if ((flags & FL_WATERJUMP) !== 0) {
                flags &= ~FL_WATERJUMP;
                this.vm.setEntityFloat(this.playerReference, 'teleport_time', 0);
            }
        }
        if (state.waterJumpDirection) {
            this.vm.setEntityVector(
                this.playerReference, 'movedir', state.waterJumpDirection
            );
        }
        this.vm.setEntityFloat(this.playerReference, 'flags', state.onGround ?
            flags | FL_ONGROUND : flags & ~FL_ONGROUND
        );
        this.vm.setEntityWord(this.playerReference, 'groundentity', state.onGround &&
            state.groundModelIndex !== undefined ?
            this.inlineModelReferences.get(state.groundModelIndex) ?? 0 : 0
        );
        this.updateLinkedBounds(this.playerReference);
    }

    private executePlayerFunction(functionName: string): void {
        this.vm.setGlobalWord('self', this.playerReference);
        this.vm.setGlobalWord('other', 0);
        this.vm.execute(functionName);
    }

    private updatePusher(reference: number, frameTime: number): void {
        const oldLocalTime = this.vm.getEntityFloat(reference, 'ltime');
        const thinkTime = this.vm.getEntityFloat(reference, 'nextthink');
        const moveTime = thinkTime < oldLocalTime + frameTime ?
            Math.max(0, thinkTime - oldLocalTime) : frameTime;
        if (moveTime > 0) {
            this.pushMove(reference, moveTime);
        }
        const localTime = this.vm.getEntityFloat(reference, 'ltime');
        if (thinkTime > oldLocalTime && thinkTime <= localTime) {
            this.vm.setEntityFloat(reference, 'nextthink', 0);
            this.vm.setGlobalFloat('time', this.physicsFrameStart);
            this.executeEntityFunction(reference, 'think', 0);
            this.updateBrushCollision(reference);
        }
    }

    private pushMove(reference: number, moveTime: number): void {
        const origin = this.vm.getEntityVector(reference, 'origin');
        const velocity = this.vm.getEntityVector(reference, 'velocity');
        const movement = velocity.map(component => component * moveTime) as Vec3;
        const oldLocalTime = this.vm.getEntityFloat(reference, 'ltime');
        const destination = origin.map(
            (component, axis) => component + movement[axis]
        ) as Vec3;
        this.vm.setEntityVector(reference, 'origin', destination);
        const linkedDestination = this.vm.getEntityVector(reference, 'origin');
        this.vm.setEntityFloat(reference, 'ltime', oldLocalTime + moveTime);
        this.updateBrushCollision(reference);
        if (movement.every(component => component === 0)) {
            return;
        }

        const moved = new Map<number, Vec3>();
        const pusherBounds = this.entityBounds(reference);
        for (let check = 1; check < this.vm.edicts.length; check++) {
            if (check === reference || this.vm.entity(check).free) {
                continue;
            }
            const moveType = this.vm.getEntityFloat(check, 'movetype');
            if (moveType === MOVETYPE_PUSH || moveType === MOVETYPE_NONE ||
                moveType === MOVETYPE_NOCLIP) {
                continue;
            }
            const flags = Math.trunc(this.vm.getEntityFloat(check, 'flags'));
            const ridingPusher = (flags & FL_ONGROUND) !== 0 &&
                this.vm.getEntityWord(check, 'groundentity') === reference;
            if (!ridingPusher && (!this.boundsIntersect(this.entityBounds(check), pusherBounds) ||
                this.testEntityPosition(check, reference) === null)) {
                continue;
            }
            if (moveType !== MOVETYPE_WALK) {
                this.vm.setEntityFloat(check, 'flags', flags & ~FL_ONGROUND);
            }
            const oldOrigin = this.vm.getEntityVector(check, 'origin');
            moved.set(check, oldOrigin);
            const modelPath = this.vm.getEntityString(reference, 'model');
            const modelIndex = modelPath.startsWith('*') ? Number(modelPath.slice(1)) : -1;
            if (modelIndex >= 0) {
                this.collision.setBrushState(modelIndex, linkedDestination, false);
            }
            const end = oldOrigin.map(
                (component, axis) => component + movement[axis]
            ) as Vec3;
            const { entity, trace } = this.traceMovingBox(
                oldOrigin,
                end,
                this.vm.getEntityVector(check, 'mins'),
                this.vm.getEntityVector(check, 'maxs'),
                check,
                reference
            );
            this.vm.setEntityVector(check, 'origin', trace.endPosition);
            if (modelIndex >= 0) {
                this.collision.setBrushState(modelIndex, linkedDestination, true);
            }
            this.touchTriggers(check);
            if (trace.fraction < 1) this.impact(check, entity);
            if (this.vm.entity(check).free) continue;
            if (this.testEntityPosition(check, reference) === null) {
                continue;
            }
            const minimum = this.vm.getEntityVector(check, 'mins');
            const maximum = this.vm.getEntityVector(check, 'maxs');
            const solid = this.vm.getEntityFloat(check, 'solid');
            if (minimum[0] === maximum[0]) {
                continue;
            }
            if (solid === 0 || solid === SOLID_TRIGGER) {
                this.vm.setEntityVector(check, 'mins', [0, 0, minimum[2]]);
                this.vm.setEntityVector(check, 'maxs', [0, 0, minimum[2]]);
                continue;
            }

            this.vm.setEntityVector(check, 'origin', oldOrigin);
            this.updateLinkedBounds(check);
            this.vm.setEntityVector(reference, 'origin', origin);
            this.vm.setEntityFloat(reference, 'ltime', oldLocalTime);
            this.updateBrushCollision(reference);
            this.updateLinkedBounds(reference);
            this.executeEntityFunction(reference, 'blocked', check);
            for (const [movedReference, movedOrigin] of moved) {
                this.vm.setEntityVector(movedReference, 'origin', movedOrigin);
                this.updateLinkedBounds(movedReference);
            }
            return;
        }
    }

    private testEntityPosition(reference: number, ignore = 0): number | null {
        const origin = this.vm.getEntityVector(reference, 'origin');
        const trace = this.collision.traceBox(
            origin,
            origin,
            this.vm.getEntityVector(reference, 'mins'),
            this.vm.getEntityVector(reference, 'maxs')
        );
        if (trace.startSolid || trace.allSolid) {
            return trace.modelIndex === undefined ? 0 :
                this.inlineModelReferences.get(trace.modelIndex) ?? 0;
        }
        const bounds = this.entityCollisionBounds(reference);
        for (let candidate = 1; candidate < this.vm.edicts.length; candidate++) {
            if (candidate === reference || candidate === ignore || this.vm.entity(candidate).free) {
                continue;
            }
            const solid = this.vm.getEntityFloat(candidate, 'solid');
            if ((solid === SOLID_BBOX || solid === SOLID_SLIDEBOX) &&
                this.boundsIntersect(bounds, this.entityCollisionBounds(candidate))) {
                return candidate;
            }
        }
        return null;
    }

    private flyMoveEntity(reference: number, frameTime: number): number {
        let blocked = 0;
        let timeLeft = frameTime;
        let velocity = this.vm.getEntityVector(reference, 'velocity');
        let originalVelocity: Vec3 = [...velocity];
        const primalVelocity: Vec3 = [...velocity];
        const planes: Vec3[] = [];
        const mins = this.vm.getEntityVector(reference, 'mins');
        const maxs = this.vm.getEntityVector(reference, 'maxs');
        const owner = this.vm.getEntityWord(reference, 'owner');
        for (let bump = 0; bump < 4; bump++) {
            if (velocity.every(component => component === 0)) {
                break;
            }
            const origin = this.vm.getEntityVector(reference, 'origin');
            const end: Vec3 = [
                origin[0] + velocity[0] * timeLeft,
                origin[1] + velocity[1] * timeLeft,
                origin[2] + velocity[2] * timeLeft
            ];
            const { entity, trace } = this.traceMovingBox(
                origin, end, mins, maxs, reference, owner
            );
            if (trace.allSolid) {
                this.vm.setEntityVector(reference, 'velocity', [0, 0, 0]);
                return 3;
            }
            if (trace.fraction > 0) {
                this.vm.setEntityVector(reference, 'origin', trace.endPosition);
                originalVelocity = [...velocity];
                planes.length = 0;
            }
            if (trace.fraction === 1) {
                break;
            }
            if (trace.plane.normal[2] > 0.7) {
                blocked |= 1;
                const hitSolid = entity === 0 ? SOLID_BSP :
                    this.vm.getEntityFloat(entity, 'solid');
                if (hitSolid === SOLID_BSP) {
                    const flags = Math.trunc(this.vm.getEntityFloat(reference, 'flags'));
                    this.vm.setEntityFloat(reference, 'flags', flags | FL_ONGROUND);
                    this.vm.setEntityWord(reference, 'groundentity', entity);
                }
            }
            if (trace.plane.normal[2] === 0) {
                blocked |= 2;
            }
            this.impact(reference, entity);
            if (this.vm.entity(reference).free) {
                break;
            }
            timeLeft -= timeLeft * trace.fraction;
            if (planes.length >= MAX_CLIP_PLANES) {
                this.vm.setEntityVector(reference, 'velocity', [0, 0, 0]);
                return 3;
            }
            planes.push([...trace.plane.normal]);
            let clippedVelocity: Vec3 | undefined;
            for (let planeIndex = 0; planeIndex < planes.length; planeIndex++) {
                const candidate = clipVelocity(originalVelocity, planes[planeIndex], 1);
                if (planes.every((plane, index) => index === planeIndex ||
                    dot(candidate, plane) >= 0)) {
                    clippedVelocity = candidate;
                    break;
                }
            }
            if (!clippedVelocity) {
                if (planes.length !== 2) {
                    this.vm.setEntityVector(reference, 'velocity', [0, 0, 0]);
                    return 7;
                }
                const direction: Vec3 = [
                    planes[0][1] * planes[1][2] - planes[0][2] * planes[1][1],
                    planes[0][2] * planes[1][0] - planes[0][0] * planes[1][2],
                    planes[0][0] * planes[1][1] - planes[0][1] * planes[1][0]
                ];
                const creaseSpeed = dot(direction, velocity);
                clippedVelocity = direction.map(
                    component => component * creaseSpeed
                ) as Vec3;
            }
            velocity = clippedVelocity;
            if (dot(velocity, primalVelocity) <= 0) {
                velocity = [0, 0, 0];
                this.vm.setEntityVector(reference, 'velocity', velocity);
                return blocked;
            }
            this.vm.setEntityVector(reference, 'velocity', velocity);
        }
        this.vm.setEntityVector(reference, 'velocity', velocity);
        return blocked;
    }

    private updateMovingEntity(reference: number, frameTime: number): void {
        let moveType = this.vm.getEntityFloat(reference, 'movetype');
        if (moveType !== MOVETYPE_STEP && !this.runScheduledThink(reference)) return;
        moveType = this.vm.getEntityFloat(reference, 'movetype');
        if (!MOVING_ENTITY_TYPES.has(moveType)) return;
        let velocity = this.vm.getEntityVector(reference, 'velocity');
        const flags = Math.trunc(this.vm.getEntityFloat(reference, 'flags'));
        const gravityField = this.vm.program.fieldsByName.get('gravity');
        const gravityScale = gravityField ?
            this.vm.entity(reference).values[gravityField.offset] || 1 : 1;
        const gravity = gravityScale * this.serverGravity();
        if (moveType === MOVETYPE_NOCLIP) {
            const angles = this.vm.getEntityVector(reference, 'angles');
            const angularVelocity = this.vm.getEntityVector(reference, 'avelocity');
            const origin = this.vm.getEntityVector(reference, 'origin');
            this.vm.setEntityVector(reference, 'angles', angles.map(
                (component, axis) => component + angularVelocity[axis] * frameTime
            ) as Vec3);
            this.vm.setEntityVector(reference, 'origin', origin.map(
                (component, axis) => component + velocity[axis] * frameTime
            ) as Vec3);
            this.updateLinkedBounds(reference);
            return;
        }
        if (moveType === MOVETYPE_STEP) {
            if ((flags & (FL_ONGROUND | FL_FLY | FL_SWIM)) !== 0) return;
            const playLandingSound = velocity[2] < gravity * -0.1;
            velocity[2] -= gravity * frameTime;
            this.vm.setEntityVector(reference, 'velocity', velocity);
            this.checkVelocity(reference);
            this.flyMoveEntity(reference, frameTime);
            if (this.vm.entity(reference).free) return;
            this.touchTriggers(reference);
            if (playLandingSound &&
                (Math.trunc(this.vm.getEntityFloat(reference, 'flags')) & FL_ONGROUND) !== 0) {
                this.queueSound({
                    attenuation: 1,
                    channel: 0,
                    entity: reference,
                    origin: this.entitySoundOrigin(reference),
                    sample: 'demon/dland2.wav',
                    volume: 1
                });
            }
            return;
        }
        if ((flags & FL_ONGROUND) !== 0) return;
        this.checkVelocity(reference);
        velocity = this.vm.getEntityVector(reference, 'velocity');
        if (moveType === MOVETYPE_TOSS || moveType === MOVETYPE_BOUNCE) {
            velocity[2] -= gravity * frameTime;
            this.vm.setEntityVector(reference, 'velocity', velocity);
        }
        if (TOSS_MOVE_TYPES.has(moveType)) {
            const angles = this.vm.getEntityVector(reference, 'angles');
            const angularVelocity = this.vm.getEntityVector(reference, 'avelocity');
            this.vm.setEntityVector(reference, 'angles', angles.map(
                (component, axis) => component + angularVelocity[axis] * frameTime
            ) as Vec3);
        }
        const origin = this.vm.getEntityVector(reference, 'origin');
        const end = origin.map(
            (component, axis) => component + velocity[axis] * frameTime
        ) as Vec3;
        const mins = this.vm.getEntityVector(reference, 'mins');
        const maxs = this.vm.getEntityVector(reference, 'maxs');
        const owner = this.vm.getEntityWord(reference, 'owner');
        const solid = this.vm.getEntityFloat(reference, 'solid');
        const noMonsters = solid === SOLID_NOT || solid === SOLID_TRIGGER;
        const pointSized = mins.every((component, axis) => component === maxs[axis]);
        const lineResult = pointSized ?
            this.traceLine(
                origin,
                end,
                noMonsters,
                reference,
                owner,
                moveType === MOVETYPE_FLYMISSILE
            ) : null;
        const boxResult = pointSized ? null :
            this.traceMovingBox(origin, end, mins, maxs, reference, owner, noMonsters);
        const trace = lineResult?.trace ?? boxResult?.trace;
        if (!trace) return;
        this.vm.setEntityVector(reference, 'origin', trace.endPosition);
        this.touchTriggers(reference);
        if (trace.fraction === 1) return;
        const other = lineResult?.entity ?? boxResult?.entity ??
            (trace.modelIndex === undefined ? 0 :
                this.inlineModelReferences.get(trace.modelIndex) ?? 0);
        this.impact(reference, other);
        if (this.vm.entity(reference).free) return;
        moveType = this.vm.getEntityFloat(reference, 'movetype');
        velocity = clipVelocity(
            this.vm.getEntityVector(reference, 'velocity'),
            trace.plane.normal,
            moveType === MOVETYPE_BOUNCE ? 1.5 : 1
        );
        if (trace.plane.normal[2] > 0.7 &&
            (moveType !== MOVETYPE_BOUNCE || velocity[2] < 60)) {
            const landingFlags = Math.trunc(this.vm.getEntityFloat(reference, 'flags'));
            this.vm.setEntityFloat(reference, 'flags', landingFlags | FL_ONGROUND);
            this.vm.setEntityWord(reference, 'groundentity', other);
            velocity = [0, 0, 0];
            this.vm.setEntityVector(reference, 'avelocity', [0, 0, 0]);
        }
        this.vm.setEntityVector(reference, 'velocity', velocity);
        this.checkWaterTransition(reference);
    }

    private checkVelocity(reference: number): void {
        const classname = this.vm.getEntityString(reference, 'classname');
        const maximum = this.serverMaximumVelocity();
        const origin = this.vm.getEntityVector(reference, 'origin');
        const velocity = this.vm.getEntityVector(reference, 'velocity');
        for (let axis = 0; axis < 3; axis++) {
            if (!Number.isFinite(velocity[axis])) {
                this.printToConsole(`Got a NaN velocity on ${classname}\n`);
                velocity[axis] = 0;
            }
            if (!Number.isFinite(origin[axis])) {
                this.printToConsole(`Got a NaN origin on ${classname}\n`);
                origin[axis] = 0;
            }
            if (velocity[axis] > maximum) {
                velocity[axis] = maximum;
            } else if (velocity[axis] < -maximum) {
                velocity[axis] = -maximum;
            }
        }
        this.vm.setEntityVector(reference, 'origin', origin);
        this.vm.setEntityVector(reference, 'velocity', velocity);
    }

    private checkWaterTransition(reference: number): void {
        const origin = this.vm.getEntityVector(reference, 'origin');
        const contents = this.collision.pointContents(origin);
        const previousType = this.vm.getEntityFloat(reference, 'watertype');
        if (previousType === 0) {
            this.vm.setEntityFloat(reference, 'watertype', contents);
            this.vm.setEntityFloat(reference, 'waterlevel', 1);
            return;
        }
        const inLiquid = contents <= CONTENTS.WATER;
        if ((inLiquid && previousType === CONTENTS.EMPTY) ||
            (!inLiquid && previousType !== CONTENTS.EMPTY)) {
            this.queueSound({
                attenuation: 1,
                channel: 0,
                entity: reference,
                origin: this.entitySoundOrigin(reference),
                sample: 'misc/h2ohit1.wav',
                volume: 1
            });
        }
        this.vm.setEntityFloat(reference, 'watertype', inLiquid ? contents : CONTENTS.EMPTY);
        this.vm.setEntityFloat(reference, 'waterlevel', inLiquid ? 1 : contents);
    }

    private runScheduledThink(reference: number): boolean {
        const nextThink = this.vm.getEntityFloat(reference, 'nextthink');
        if (nextThink <= 0 || nextThink > this.time) {
            return !this.vm.entity(reference).free;
        }
        this.vm.setEntityFloat(reference, 'nextthink', 0);
        this.vm.setGlobalFloat('time', Math.max(nextThink, this.physicsFrameStart));
        this.executeEntityFunction(reference, 'think', 0);
        return !this.vm.entity(reference).free;
    }

    private impact(reference: number, other: number): void {
        this.vm.setGlobalFloat('time', this.physicsFrameStart);
        if (this.vm.getEntityFloat(reference, 'solid') !== SOLID_NOT) {
            this.executeEntityFunction(reference, 'touch', other);
        }
        if (this.vm.getEntityFloat(other, 'solid') !== SOLID_NOT) {
            this.executeEntityFunction(other, 'touch', reference);
        }
    }

    private updateBrushCollision(reference: number): void {
        const modelPath = this.vm.getEntityString(reference, 'model');
        const previousModelIndex = this.linkedBrushModels.get(reference);
        const modelIndex = modelPath.startsWith('*') ? Number(modelPath.slice(1)) : undefined;
        if (previousModelIndex !== undefined && previousModelIndex !== modelIndex) {
            this.collision.setBrushState(
                previousModelIndex,
                this.vm.getEntityVector(reference, 'origin'),
                false
            );
        }
        if (modelIndex === undefined || !Number.isFinite(modelIndex)) {
            this.linkedBrushModels.delete(reference);
            return;
        }
        this.linkedBrushModels.set(reference, modelIndex);
        this.inlineModelReferences.set(modelIndex, reference);
        this.collision.setBrushState(modelIndex, this.vm.getEntityVector(reference, 'origin'),
            !this.vm.entity(reference).free &&
            this.vm.getEntityFloat(reference, 'solid') === SOLID_BSP
        );
    }

    private entitySoundOrigin(reference: number): Vec3 {
        const origin = this.vm.getEntityVector(reference, 'origin');
        const minimum = this.vm.getEntityVector(reference, 'mins');
        const maximum = this.vm.getEntityVector(reference, 'maxs');
        return origin.map(
            (component, axis) => component + 0.5 * (minimum[axis] + maximum[axis])
        ) as Vec3;
    }

    private touchTriggers(reference: number): void {
        if (this.vm.entity(reference).free ||
            this.vm.getEntityFloat(reference, 'solid') === SOLID_NOT) {
            return;
        }
        const initialBounds = this.entityBounds(reference);
        for (let trigger = 1; trigger < this.vm.edicts.length; trigger++) {
            const triggerBounds = this.entityBounds(trigger);
            if (trigger === reference || this.vm.entity(trigger).free ||
                this.vm.getEntityFloat(trigger, 'solid') !== SOLID_TRIGGER ||
                this.vm.getEntityWord(trigger, 'touch') === 0 ||
                !this.boundsOverlap(initialBounds, triggerBounds) ||
                !this.boundsOverlap(this.entityBounds(reference), triggerBounds)) {
                continue;
            }
            this.vm.setGlobalFloat('time', this.physicsFrameStart);
            this.executeEntityFunction(trigger, 'touch', reference);
        }
    }

    private entityBounds(reference: number): EntityBounds {
        const origin = this.vm.getEntityVector(reference, 'origin');
        const minimum = this.vm.getEntityVector(reference, 'mins').map(
            (component, axis) => component + origin[axis]
        ) as Vec3;
        const maximum = this.vm.getEntityVector(reference, 'maxs').map(
            (component, axis) => component + origin[axis]
        ) as Vec3;
        if ((Math.trunc(this.vm.getEntityFloat(reference, 'flags')) & FL_ITEM) !== 0) {
            minimum[0] -= 15;
            minimum[1] -= 15;
            maximum[0] += 15;
            maximum[1] += 15;
        } else {
            for (let axis = 0; axis < 3; axis++) {
                minimum[axis]--;
                maximum[axis]++;
            }
        }
        this.vm.setEntityVector(reference, 'absmin', minimum);
        this.vm.setEntityVector(reference, 'absmax', maximum);
        return { maximum, minimum };
    }

    private updateLinkedBounds(reference: number): void {
        this.entityBounds(reference);
    }

    private linkEntity(reference: number): void {
        this.updateLinkedBounds(reference);
        this.updateBrushCollision(reference);
    }

    private boundsOverlap(left: EntityBounds, right: EntityBounds): boolean {
        return left.minimum.every((minimum, axis) => minimum <= right.maximum[axis] && left.maximum[axis] >= right.minimum[axis]
        );
    }

    private boundsIntersect(left: EntityBounds, right: EntityBounds): boolean {
        return left.minimum.every((minimum, axis) => minimum < right.maximum[axis] && left.maximum[axis] > right.minimum[axis]
        );
    }

    private executeEntityFunction(reference: number, fieldName: string, other: number): void {
        const quakeFunction = this.vm.getEntityWord(reference, fieldName);
        if (quakeFunction === 0) {
            return;
        }
        const oldSelf = this.vm.getGlobalWord('self');
        const oldOther = this.vm.getGlobalWord('other');
        this.vm.setGlobalWord('self', reference);
        this.vm.setGlobalWord('other', other);
        try {
            this.vm.execute(quakeFunction);
        } finally {
            this.vm.setGlobalWord('self', oldSelf);
            this.vm.setGlobalWord('other', oldOther);
        }
    }

    private spawnEntities(): void {
        for (const [index, properties] of this.map.entities.entries()) {
            const reference = this.vm.loadEdict(properties, index === 0 ? 0 : undefined);
            const generation = this.vm.entity(reference).generation;
            this.entityReferences[index] = reference;
            this.entityReferenceGenerations[index] = generation;
            if (properties.model?.startsWith('*')) {
                this.inlineModelReferences.set(Number(properties.model.slice(1)), reference);
            }
            if (quakeEntityInhibited(
                Number(properties.spawnflags ?? 0),
                this.cvarValue('skill'),
                this.cvarValue('deathmatch') !== 0
            )) {
                this.removeEntity(reference);
                continue;
            }
            const quakeFunction = this.vm.program.functionsByName.get(properties.classname);
            if (!quakeFunction) {
                this.removeEntity(reference);
                continue;
            }
            this.vm.setGlobalWord('self', reference);
            this.vm.execute(quakeFunction.index);
            const edict = this.vm.entity(reference);
            if (edict.free || edict.generation !== generation) {
                this.entityReferences[index] = null;
                this.entityReferenceGenerations[index] = null;
            } else {
                this.updateLinkedBounds(reference);
            }
        }
    }
}
