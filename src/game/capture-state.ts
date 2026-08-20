import type { CameraController } from './camera-controller';
import type { QuakePaletteCaptureMode } from './capture-pose';
import { quakeProtocolAngle } from './quake-protocol';
import type {
    QuakePlayerResult,
    QuakePlayerState,
    QuakeWorldRuntime
} from './quake-world';
import { CONTENTS, type Vec3 } from '../formats/bsp';

const FL_NOTARGET = 128;
const IT_AXE = 1 << 12;
const IT_CELLS = 1 << 11;
const IT_INVULNERABILITY = 1 << 20;
const IT_KEY1 = 1 << 17;
const IT_LIGHTNING = 1 << 6;
const IT_NAILGUN = 1 << 2;
const IT_QUAD = 1 << 22;
const IT_ROCKETS = 1 << 10;
const IT_GRENADE_LAUNCHER = 1 << 4;
const IT_ROCKET_LAUNCHER = 1 << 5;
const IT_SUPER_SHOTGUN = 1 << 1;
const IT_SUIT = 1 << 21;
const QUAKE_WEAPON_CAPTURE_WARMUP_FRAMES = 20;
// A loaded native save spends its first two `wait` commands completing signon,
// before server physics resumes. The projectile reference scripts therefore
// execute 18 server warmup frames during their authored `wait10; wait10`.
const QUAKE_PROJECTILE_CAPTURE_WARMUP_FRAMES = 18;
const QUAKE_NATIVE_DEATH_CAPTURE_RANDOM_ADVANCES = 4;
const QUAKE_NATIVE_KNIGHT_CAPTURE_RANDOM_ADVANCES = 4;
const QUAKE_TUTORIAL_CAPTURE_FRAMES = 11;

export const QUAKE_DOG_LEAP_CAPTURE_FRAMES = 7;
export const QUAKE_DOG_DEATH_CAPTURE_FRAMES = 6;
export const QUAKE_DROWNING_BUBBLE_CAPTURE_FRAMES = 12;
export const QUAKE_DROWNING_BUBBLE_SPLIT_CAPTURE_FRAMES = 10;
export const QUAKE_EXPLOBOX_CAPTURE_FRAMES = 2;
export const QUAKE_KNIGHT_MELEE_CAPTURE_FRAMES = 13;
export const QUAKE_KNIGHT_MELEE_CAPTURE_WARMUP_FRAMES = 15;
export const QUAKE_NAILGUN_CAPTURE_FRAMES = 1;
export const QUAKE_OGRE_GRENADE_CAPTURE_PREPARE_FRAMES = 39;
export const QUAKE_PLATFORM_CAPTURE_FRAMES = 10;
export const QUAKE_PLAYER_DEATH_CAPTURE_FRAMES = 8;
export const QUAKE_SHAMBLER_LIGHTNING_CAPTURE_WARMUP_FRAMES = 15;
export const QUAKE_WIZARD_TRACER_CAPTURE_FRAMES = 1;
export const QUAKE_WIZARD_TRACER_CAPTURE_WARMUP_FRAMES = 15;
export const QUAKE_BUTTON_DOOR_CAPTURE_FRAMES = 20;
export const QUAKE_SOLDIER_DEATH_CAPTURE_FRAMES = 8;
export const QUAKE_START_STAIRS_CAPTURE_WARMUP_FRAMES = 137;
export const QUAKE_START_STAIRS_CAPTURE_FRAMES = 200;

export type QuakeGrenadeCapturePhase = 'bounce' | 'explosion' | 'flight';

export type QuakeOgreGrenadeCapturePhase = 'flight' | 'impact';

export const QUAKE_OGRE_GRENADE_CAPTURE_FRAMES: Readonly<
    Record<QuakeOgreGrenadeCapturePhase, number>
> = {
    flight: 3,
    impact: 5
};

export const QUAKE_GRENADE_CAPTURE_FRAMES: Readonly<
    Record<QuakeGrenadeCapturePhase, number>
> = {
    bounce: 14,
    explosion: 50,
    flight: 8
};

export type QuakeSoldierGibCapturePhase = 'impact' | 'trail';

export const QUAKE_SOLDIER_GIB_CAPTURE_FRAMES: Readonly<
    Record<QuakeSoldierGibCapturePhase, number>
> = {
    impact: 3,
    trail: 6
};

export const QUAKE_TELEPORT_CAPTURE_TIME = 2.09;
export const QUAKE_LIGHT_DOOR_CAPTURE_FRAMES = 10;
export const QUAKE_TOUCH_TRIGGER_DOOR_CAPTURE_FRAMES = 10;

const QUAKE_SOLDIER_GIB_MODELS = [
    'progs/h_guard.mdl',
    'progs/gib1.mdl',
    'progs/gib2.mdl',
    'progs/gib3.mdl'
] as const;

export interface QuakeGrenadeCaptureState {
    explosionEmitted: boolean;
    grenadeReference: number;
    playerState: QuakePlayerState;
}

export interface QuakeOgreGrenadeCaptureState {
    explosionEmitted: boolean;
    grenadeReference: number;
    ogreReference: number;
    playerState: QuakePlayerState;
}

export interface QuakeExploboxCaptureState {
    barrelReference: number;
    playerState: QuakePlayerState;
}

export interface QuakeDogLeapCaptureState {
    dogReference: number;
    initialDogOrigin: Vec3;
    playerState: QuakePlayerState;
}

export interface QuakeDogDeathCaptureState {
    dogReference: number;
    playerState: QuakePlayerState;
}

export interface QuakeButtonDoorCaptureState {
    buttonModelIndex: number;
    buttonReference: number;
    doorModelIndex: number;
    doorReference: number;
    initialButtonOrigin: Vec3;
    initialDoorOrigin: Vec3;
    playerState: QuakePlayerState;
}

export interface QuakeSilverKeyDoorCaptureState {
    doorModelIndices: [number, number];
    doorReferences: [number, number];
    keyReference: number;
    playerState: QuakePlayerState;
}

export interface QuakeRocketCaptureState {
    playerState: QuakePlayerState;
    rocketReference: number;
}

export interface QuakeNailgunCaptureState {
    playerState: QuakePlayerState;
    spikeReference: number;
}

export interface QuakePatrolCaptureState {
    firstCornerReference: number;
    nextCornerReference: number;
    soldierReference: number;
}

export interface QuakePlatformCaptureState {
    initialPlatformOrigin: Vec3;
    platformModelIndex: number;
    platformReference: number;
    playerState: QuakePlayerState;
}

export interface QuakeSecretDoorCaptureState {
    doorReference: number;
    initialDoorOrigin: Vec3;
    playerState: QuakePlayerState;
}

export interface QuakeTriggeredSecretDoorCaptureState {
    doorModelIndex: number;
    doorReference: number;
    initialDoorOrigin: Vec3;
    playerState: QuakePlayerState;
    triggerReference: number;
}

export interface QuakeLightDoorCaptureState {
    doorModelIndex: number;
    doorReference: number;
    initialDoorOrigin: Vec3;
    lightReference: number;
    lightStyle: number;
    playerState: QuakePlayerState;
    triggerReference: number;
}

export interface QuakeTutorialMessageCaptureState {
    playerState: QuakePlayerState;
    triggerReference: number;
}

export type QuakeTutorialMessageTarget = 't31' | 't32';

export interface QuakeSoldierGibCaptureState extends QuakeRocketCaptureState {
    gibOrigins: Vec3[];
    gibReferences: number[];
    soldierReference: number;
}

export interface QuakeSoldierDeathCaptureState {
    playerState: QuakePlayerState;
    soldierReference: number;
}

export interface QuakeAxeHitCaptureState {
    initialHealth: number;
    playerState: QuakePlayerState;
    soldierReference: number;
}

export interface QuakeShootableTriggerDoorCaptureState {
    doorReference: number;
    initialDoorOrigin: Vec3;
    playerState: QuakePlayerState;
    triggerReference: number;
}

export interface QuakeStartStairsCaptureState {
    movementStates: readonly QuakePlayerResult[];
    maximumHeight: number;
    playerState: QuakePlayerState;
}

export interface QuakePlayerDeathCaptureState {
    bubbleReferences: number[];
    playerState: QuakePlayerState;
}

export interface QuakeShamblerLightningCaptureState {
    playerState: QuakePlayerState;
    shamblerReference: number;
}

export interface QuakeWizardTracerCaptureState {
    initialWizardOrigin: Vec3;
    playerState: QuakePlayerState;
    projectileReference: number;
    wizardReference: number;
}

export const settleQuakePausedCapturePalette = (
    world: QuakeWorldRuntime,
    frameCount = 100,
    frameTime = 0.05
): void => {
    for (let frame = 0; frame < frameCount; frame++) {
        world.advanceClientViewEffects(frameTime);
    }
};

const capturePlayerState = (origin: Vec3, angles: Vec3): QuakePlayerState => ({
    angles,
    attack: false,
    jump: false,
    onGround: true,
    origin,
    velocity: [0, 0, 0]
});

const restoreProjectileCaptureServerPose = (
    world: QuakeWorldRuntime,
    state: QuakePlayerState
): void => {
    world.setPlayerPose(
        state.origin,
        state.angles.map(quakeProtocolAngle) as Vec3
    );
    // The native saved fixangle is consumed during signon. Subsequent packets
    // retain the decoded server angle without requesting another client setangle.
    world.vm.setEntityFloat(world.playerReference, 'fixangle', 0);
};

const suppressCaptureTargets = (world: QuakeWorldRuntime): void => {
    const player = world.playerReference;
    world.vm.setEntityFloat(
        player,
        'flags',
        Math.trunc(world.vm.getEntityFloat(player, 'flags')) | FL_NOTARGET
    );
};

export const prepareQuakeStartStairsCapture = (
    world: QuakeWorldRuntime,
    controller: CameraController,
    origin: Vec3,
    angles: Vec3
): QuakeStartStairsCaptureState => {
    if (world.mapName !== 'start') {
        throw new Error('Start-stairs capture requires map=start');
    }
    world.setPlayerPose(origin, angles);
    controller.applyServerState(world.playerResult(false), false);
    const advanceFrame = (): QuakePlayerResult => {
        controller.beginFrame(0.01);
        const state = world.update(
            0.01,
            controller.playerState(),
            (preMoveState) => {
                controller.applyServerState(preMoveState, false);
                controller.finishFrame(false);
                return controller.playerState();
            }
        );
        controller.applyServerState(state, false);
        return state;
    };
    let maximumHeight = controller.origin[2];
    const movementStates: QuakePlayerResult[] = [];
    controller.setButtonState('+mlook', 'capture:start-stairs', true);
    try {
        for (let frame = 0; frame < QUAKE_START_STAIRS_CAPTURE_WARMUP_FRAMES; frame++) {
            advanceFrame();
        }
        controller.setButtonState('+forward', 'capture:start-stairs', true);
        try {
            for (let frame = 0; frame < QUAKE_START_STAIRS_CAPTURE_FRAMES; frame++) {
                const state = advanceFrame();
                movementStates.push(state);
                maximumHeight = Math.max(maximumHeight, state.origin[2]);
            }
        } finally {
            controller.setButtonState('+forward', 'capture:start-stairs', false);
        }
    } finally {
        controller.setButtonState('+mlook', 'capture:start-stairs', false);
    }
    return {
        movementStates,
        maximumHeight,
        playerState: controller.playerState()
    };
};

export const prepareQuakeDrowningBubbleCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3,
    captureFrame: 0 | 1 = 0
): number => {
    suppressCaptureTargets(world);
    world.setPlayerPose(origin, angles);
    const player = world.playerReference;
    const state: QuakePlayerState = {
        ...capturePlayerState(origin, angles),
        onGround: false,
        waterLevel: 3,
        waterType: CONTENTS.WATER
    };
    world.vm.setEntityFloat(player, 'air_finished', 0);
    world.vm.setEntityFloat(player, 'pain_finished', 0);
    world.vm.setEntityFloat(player, 'dmg', 2);
    const initialHealth = world.vm.getEntityFloat(player, 'health');
    for (let frame = 0; frame < QUAKE_DROWNING_BUBBLE_CAPTURE_FRAMES; frame++) {
        world.update(0.1, state);
    }
    let bubble = world.vm.edicts.findIndex((edict, reference) => (
        reference > player && !edict.free &&
        world.vm.getEntityString(reference, 'classname') === 'bubble' &&
        world.vm.getEntityString(reference, 'model') === 'progs/s_bubble.spr'
    ));
    if (bubble <= player || world.vm.getEntityFloat(player, 'health') >= initialHealth ||
        !world.soundEvents.some(event => (
            event.entity === player && /^player\/drown[12]\.wav$/u.test(event.sample)
        ))) {
        throw new Error('E1M1 drowning capture did not create the supplied bubble sprite');
    }
    if (captureFrame === 1) {
        for (let frame = 0; frame < QUAKE_DROWNING_BUBBLE_SPLIT_CAPTURE_FRAMES; frame++) {
            world.update(0.1, state);
        }
        bubble = world.vm.edicts.findIndex((edict, reference) => (
            reference > player && !edict.free &&
            world.vm.getEntityString(reference, 'classname') === 'bubble' &&
            world.vm.getEntityString(reference, 'model') === 'progs/s_bubble.spr' &&
            world.vm.getEntityFloat(reference, 'frame') === 1
        ));
        if (bubble <= player) {
            throw new Error('E1M1 drowning capture did not split the supplied bubble sprite');
        }
    }
    settleQuakePausedCapturePalette(world);
    world.setPlayerPose(origin, angles);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    return bubble;
};

export const prepareQuakePlayerDeathCapture = (
    world: QuakeWorldRuntime,
    controller: CameraController,
    origin: Vec3,
    angles: Vec3
): QuakePlayerDeathCaptureState => {
    if (world.mapName !== 'e1m1') {
        throw new Error('Player-death capture requires map=e1m1');
    }
    suppressCaptureTargets(world);
    world.setPlayerPose(origin, angles);
    controller.applyServerState(world.playerResult(false), false);
    const player = world.playerReference;
    world.setCvar('temp1', '1');
    world.vm.setEntityFloat(player, 'health', 1);
    world.previousHealth = 1;
    world.vm.setEntityFloat(player, 'air_finished', 0);
    world.vm.setEntityFloat(player, 'pain_finished', 0);
    world.vm.setEntityFloat(player, 'dmg', 2);
    world.clearConsole();
    world.clearSoundEvents();
    const existingBubbles = new Set(world.vm.edicts.flatMap((edict, reference) => (
        !edict.free && world.vm.getEntityString(reference, 'classname') === 'bubble' ?
            [reference] : []
    )));

    for (let frame = 0; frame < QUAKE_PLAYER_DEATH_CAPTURE_FRAMES; frame++) {
        controller.beginFrame(0.1);
        const result = world.update(
            0.1,
            controller.playerState(),
            (preMoveState) => {
                controller.applyServerState(preMoveState, false);
                controller.finishFrame(false);
                return controller.playerState();
            }
        );
        controller.applyServerState(result, false);
    }

    const bubbleReferences = world.vm.edicts.flatMap((edict, reference) => (
        reference > player && !edict.free && !existingBubbles.has(reference) &&
        world.vm.getEntityString(reference, 'classname') === 'bubble' &&
        world.vm.getEntityString(reference, 'model') === 'progs/s_bubble.spr' &&
        world.vm.getEntityFloat(reference, 'cnt') === 0 &&
        world.vm.getEntityVector(reference, 'velocity').every(
            (component, axis) => component === [0, 0, 15][axis]
        ) ?
            [reference] : []
    ));
    const deathSoundPlayed = world.soundEvents.some(event => (
        event.entity === player && event.sample === 'player/h2odeath.wav'
    ));
    if (world.vm.getEntityFloat(player, 'health') > 0 || world.damageShift !== 0 ||
        world.vm.getEntityFloat(player, 'deadflag') !== 1 ||
        world.vm.getEntityFloat(player, 'movetype') !== 6 ||
        world.vm.getEntityVector(player, 'view_ofs')[2] !== -8 ||
        bubbleReferences.length === 0 || !deathSoundPlayed) {
        throw new Error('E1M1 player-death capture did not follow the drowning death path');
    }
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    return {
        bubbleReferences,
        playerState: controller.playerState()
    };
};

export const prepareQuakeOgreGrenadeCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeOgreGrenadeCaptureState => {
    const expectedOrigin: Vec3 = [762, -190, 320];
    if (world.mapName !== 'e1m2' || origin.some((component, axis) => (
        Math.abs(component - expectedOrigin[axis]) > 0.01
    ))) {
        throw new Error(
            'E1M2 ogre-grenade capture requires map=e1m2 and ' +
            `captureOrigin=${expectedOrigin.join(',')}`
        );
    }
    const ogreIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'monster_ogre' && entity.origin === '1018 -126 320'
    ));
    const ogreReference = world.entityReferences[ogreIndex];
    if (ogreReference === null || ogreReference === undefined ||
        world.vm.entity(ogreReference).free ||
        world.vm.getEntityString(ogreReference, 'model') !== 'progs/ogre.mdl' ||
        !world.vm.getEntityVector(ogreReference, 'origin').every(
            (component, axis) => component === [1_018, -126, 320][axis]
        )) {
        throw new Error('E1M2 ogre-grenade capture requires its first authored ogre');
    }
    const player = world.playerReference;
    const occupancy = world.collision.traceBox(
        origin,
        origin,
        world.vm.getEntityVector(player, 'mins'),
        world.vm.getEntityVector(player, 'maxs')
    );
    world.setPlayerPose(origin, angles);
    if (occupancy.startSolid || occupancy.allSolid || world.traceLine(
        [1_018, -126, 344],
        [origin[0], origin[1], origin[2] + 22],
        false,
        ogreReference
    ).entity !== player) {
        throw new Error('E1M2 ogre-grenade capture carrier lacks clear authored sight');
    }
    const playerState: QuakePlayerState = {
        ...capturePlayerState(origin, angles),
        onGround: true
    };
    for (let frame = 0; frame < QUAKE_OGRE_GRENADE_CAPTURE_PREPARE_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    const think = world.vm.program.functions[
    world.vm.getEntityWord(ogreReference, 'think')
    ]?.name;
    const grenadeReference = world.vm.edicts.findIndex((edict, reference) => (
        reference > player && !edict.free &&
        world.vm.getEntityString(reference, 'model') === 'progs/grenade.mdl' &&
        world.vm.getEntityWord(reference, 'owner') === ogreReference
    ));
    if (world.vm.getEntityWord(ogreReference, 'enemy') !== player ||
        think !== 'ogre_nail4' || grenadeReference > player ||
        world.vm.getEntityFloat(player, 'health') !== 100) {
        throw new Error(
            `E1M2 ogre did not reach its authored pre-launch attack state: ${JSON.stringify({
                enemy: world.vm.getEntityWord(ogreReference, 'enemy'),
                frame: world.vm.getEntityFloat(ogreReference, 'frame'),
                grenadeReference,
                health: world.vm.getEntityFloat(player, 'health'),
                origin: world.vm.getEntityVector(ogreReference, 'origin'),
                think
            })}`
        );
    }
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    world.clearSoundEvents();
    world.particleEvents.length = 0;
    return {
        explosionEmitted: false,
        grenadeReference: -1,
        ogreReference,
        playerState
    };
};

export const advanceQuakeOgreGrenadeCapture = (
    world: QuakeWorldRuntime,
    capture: QuakeOgreGrenadeCaptureState,
    phase?: QuakeOgreGrenadeCapturePhase
): void => {
    world.update(0.05, capture.playerState);
    const player = world.playerReference;
    const activeGrenade = world.vm.edicts.findIndex((edict, reference) => (
        reference > player && !edict.free &&
        world.vm.getEntityString(reference, 'model') === 'progs/grenade.mdl' &&
        world.vm.getEntityWord(reference, 'owner') === capture.ogreReference
    ));
    if (activeGrenade > player) capture.grenadeReference = activeGrenade;
    capture.explosionEmitted ||= world.particleEvents.some(event => (
        event.kind === 'explosion' && event.count === 1_024
    ));
    if (phase === 'flight' && (
        capture.grenadeReference <= player ||
        world.vm.entity(capture.grenadeReference).free ||
        world.vm.getEntityFloat(capture.grenadeReference, 'movetype') !== 10 ||
        world.vm.program.functions[
        world.vm.getEntityWord(capture.grenadeReference, 'touch')
        ]?.name !== 'OgreGrenadeTouch' || capture.explosionEmitted
    )) {
        throw new Error('E1M2 ogre grenade did not preserve its authored flight state');
    }
    if (phase === 'impact' && (
        capture.grenadeReference <= player ||
        world.vm.entity(capture.grenadeReference).free ||
        world.vm.getEntityString(capture.grenadeReference, 'model') !==
            'progs/s_explod.spr' ||
        world.vm.getEntityFloat(player, 'health') !== 71 ||
        !capture.explosionEmitted || !world.soundEvents.some(event => (
            event.sample === 'weapons/r_exp3.wav'
        ))
    )) {
        throw new Error('E1M2 ogre grenade did not reach its authored impact state');
    }
};

export const prepareQuakeKnightMeleeCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): number => {
    const expectedOrigin: Vec3 = [-578, -702, 480];
    if (world.mapName !== 'e1m2' || origin.some((component, axis) => (
        Math.abs(component - expectedOrigin[axis]) > 0.01
    ))) {
        throw new Error(
            'E1M2 knight-melee capture requires map=e1m2 and ' +
            `captureOrigin=${expectedOrigin.join(',')}`
        );
    }
    const knightIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'monster_knight' && entity.origin === '-578 -654 480'
    ));
    const knightReference = world.entityReferences[knightIndex];
    if (knightReference === null || knightReference === undefined ||
        world.vm.entity(knightReference).free ||
        world.vm.getEntityString(knightReference, 'model') !== 'progs/knight.mdl' ||
        !world.vm.getEntityVector(knightReference, 'origin').every(
            (component, axis) => component === [-578, -654, 480][axis]
        )) {
        throw new Error('E1M2 knight-melee capture requires its first authored knight');
    }

    // Reach the ordinary 1.75-second patrol state used by the native carrier
    // save before moving the client into sight. This also finishes the startup
    // think that would otherwise overwrite an immediately acquired target.
    for (let frame = 0; frame < QUAKE_KNIGHT_MELEE_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05);
    }
    const player = world.playerReference;
    const occupancy = world.collision.traceBox(
        origin,
        origin,
        world.vm.getEntityVector(player, 'mins'),
        world.vm.getEntityVector(player, 'maxs')
    );
    world.setPlayerPose(origin, angles);
    if (occupancy.startSolid || occupancy.allSolid || world.traceLine(
        [-578, -654, 500.03125],
        [origin[0], origin[1], origin[2] + 22],
        false,
        knightReference
    ).entity !== player) {
        throw new Error('E1M2 knight-melee capture carrier lacks clear authored sight');
    }
    const playerState: QuakePlayerState = {
        ...capturePlayerState(origin, angles),
        onGround: true
    };
    // The C and JavaScript runtimes begin from different random streams. Select
    // the same one-point sword-damage branch as the native evidence without
    // affecting normal gameplay.
    world.advanceGameplayRandom(QUAKE_NATIVE_KNIGHT_CAPTURE_RANDOM_ADVANCES);
    world.clearSoundEvents();
    for (let frame = 0; frame < QUAKE_KNIGHT_MELEE_CAPTURE_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    world.setPlayerPose(origin, angles);
    const think = world.vm.program.functions[
    world.vm.getEntityWord(knightReference, 'think')
    ]?.name;
    const knightOrigin = world.vm.getEntityVector(knightReference, 'origin');
    if (world.vm.getEntityWord(knightReference, 'enemy') !== player ||
        think !== 'knight_atk7' ||
        world.vm.getEntityFloat(knightReference, 'frame') !== 48 ||
        Math.abs(knightOrigin[0] + 578) > 0.01 ||
        Math.abs(knightOrigin[1] + 647) > 0.01 ||
        Math.abs(knightOrigin[2] - 480.03125) > 0.01 ||
        world.vm.getEntityFloat(player, 'health') !== 99 ||
        world.damageShift !== 22 ||
        !world.soundEvents.some(event => (
            event.entity === knightReference && event.sample === 'knight/sword1.wav'
        )) || !world.soundEvents.some(event => event.entity === player &&
            event.sample === 'player/pain4.wav')) {
        throw new Error(
            `E1M2 knight did not reach its authored melee impact state: ${JSON.stringify({
                damageShift: world.damageShift,
                enemy: world.vm.getEntityWord(knightReference, 'enemy'),
                frame: world.vm.getEntityFloat(knightReference, 'frame'),
                health: world.vm.getEntityFloat(player, 'health'),
                origin: knightOrigin,
                sounds: world.soundEvents.map(event => event.sample),
                think
            })}`
        );
    }
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    return knightReference;
};

export const prepareQuakeShamblerLightningCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeShamblerLightningCaptureState => {
    const expectedOrigin: Vec3 = [1_864, 0, 24];
    if (world.mapName !== 'e1m7' || origin.some((component, axis) => (
        Math.abs(component - expectedOrigin[axis]) > 0.01
    ))) {
        throw new Error(
            'E1M7 shambler-lightning capture requires map=e1m7 and ' +
            `captureOrigin=${expectedOrigin.join(',')}`
        );
    }
    const shamblerIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'monster_shambler' && entity.origin === '1848 224 24'
    ));
    const shamblerReference = world.entityReferences[shamblerIndex];
    if (shamblerReference === null || shamblerReference === undefined ||
        world.vm.entity(shamblerReference).free ||
        world.vm.getEntityString(shamblerReference, 'model') !== 'progs/shambler.mdl') {
        throw new Error('E1M7 shambler-lightning capture requires its authored Shambler');
    }
    for (let frame = 0; frame < QUAKE_SHAMBLER_LIGHTNING_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05);
    }
    const player = world.playerReference;
    const occupancy = world.collision.traceBox(
        origin,
        origin,
        world.vm.getEntityVector(player, 'mins'),
        world.vm.getEntityVector(player, 'maxs')
    );
    world.setPlayerPose(origin, angles);
    if (occupancy.startSolid || occupancy.allSolid || world.traceLine(
        [1_848, 224, 64.03125],
        [origin[0], origin[1], origin[2] + 22],
        false,
        shamblerReference
    ).entity !== player) {
        throw new Error('E1M7 shambler-lightning capture carrier lacks clear authored sight');
    }
    const playerState: QuakePlayerState = {
        ...capturePlayerState(origin, angles),
        onGround: true
    };
    world.vm.setEntityFloat(player, 'takedamage', 0);
    world.clearSoundEvents();
    for (let frame = 0; frame < 160 && !world.activeBeams().some(beam => (
        beam.entity === shamblerReference && beam.model === 'progs/bolt.mdl'
    )); frame++) {
        world.update(0.05, playerState);
    }
    world.setPlayerPose(origin, angles);
    const think = world.vm.program.functions[
    world.vm.getEntityWord(shamblerReference, 'think')
    ]?.name;
    const beam = world.activeBeams().find(active => (
        active.entity === shamblerReference && active.model === 'progs/bolt.mdl'
    ));
    if (world.vm.getEntityWord(shamblerReference, 'enemy') !== player || !beam ||
        world.vm.getEntityFloat(player, 'health') !== 100 || world.damageShift !== 0 ||
        !world.soundEvents.some(event => (
            event.entity === shamblerReference && event.sample === 'shambler/sattck1.wav'
        ))) {
        throw new Error(
            `E1M7 Shambler did not reach its authored lightning state: ${JSON.stringify({
                beam,
                enemy: world.vm.getEntityWord(shamblerReference, 'enemy'),
                frame: world.vm.getEntityFloat(shamblerReference, 'frame'),
                health: world.vm.getEntityFloat(player, 'health'),
                origin: world.vm.getEntityVector(shamblerReference, 'origin'),
                sounds: world.soundEvents.map(event => event.sample),
                think,
                time: world.time
            })}`
        );
    }
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    return { playerState, shamblerReference };
};

export const prepareQuakeWizardTracerCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeWizardTracerCaptureState => {
    const expectedOrigin: Vec3 = [-256, 2_272, 1_240];
    if (world.mapName !== 'e1m4' || origin.some((component, axis) => (
        Math.abs(component - expectedOrigin[axis]) > 0.01
    ))) {
        throw new Error(
            'E1M4 wizard-tracer capture requires map=e1m4 and ' +
            `captureOrigin=${expectedOrigin.join(',')}`
        );
    }
    const wizardIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'monster_wizard' && entity.origin === '80 864 968'
    ));
    const wizardReference = world.entityReferences[wizardIndex];
    if (wizardReference === null || wizardReference === undefined ||
        world.vm.entity(wizardReference).free ||
        world.vm.getEntityString(wizardReference, 'model') !== 'progs/wizard.mdl') {
        throw new Error('E1M4 wizard-tracer capture requires its authored Wizard');
    }
    for (let frame = 0; frame < QUAKE_WIZARD_TRACER_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05);
    }
    const player = world.playerReference;
    const directions = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [Math.SQRT1_2, Math.SQRT1_2],
        [-Math.SQRT1_2, Math.SQRT1_2],
        [Math.SQRT1_2, -Math.SQRT1_2],
        [-Math.SQRT1_2, -Math.SQRT1_2]
    ] as const;
    let wizardCaptureOrigin: Vec3 | undefined;
    for (const distance of [192, 160, 224]) {
        for (const direction of directions) {
            const candidate: Vec3 = [
                origin[0] + direction[0] * distance,
                origin[1] + direction[1] * distance,
                origin[2]
            ];
            const occupancy = world.collision.traceBox(
                candidate,
                candidate,
                world.vm.getEntityVector(wizardReference, 'mins'),
                world.vm.getEntityVector(wizardReference, 'maxs')
            );
            if (occupancy.startSolid || occupancy.allSolid) continue;
            world.setPlayerPose(origin, angles);
            if (world.traceLine(
                [candidate[0], candidate[1], candidate[2] + 16],
                [origin[0], origin[1], origin[2] + 16],
                false,
                wizardReference
            ).entity === player) {
                wizardCaptureOrigin = candidate;
                break;
            }
        }
        if (wizardCaptureOrigin) break;
    }
    if (!wizardCaptureOrigin) {
        throw new Error('E1M4 wizard-tracer capture has no clear Wizard position');
    }
    const setOrigin = world.vm.builtins.get(2);
    if (!setOrigin) throw new Error('E1M4 wizard-tracer capture requires setorigin');
    world.vm.words[4] = wizardReference;
    world.vm.values.set(wizardCaptureOrigin, 7);
    setOrigin(world.vm, 2);
    world.vm.setEntityVector(wizardReference, 'angles', [0, 180, 0]);
    world.vm.setEntityFloat(wizardReference, 'ideal_yaw', 180);
    world.vm.setEntityWord(wizardReference, 'enemy', player);
    world.vm.setEntityFloat(wizardReference, 'attack_finished', 0);
    const occupancy = world.collision.traceBox(
        origin,
        origin,
        world.vm.getEntityVector(player, 'mins'),
        world.vm.getEntityVector(player, 'maxs')
    );
    world.setPlayerPose(origin, angles);
    if (occupancy.startSolid || occupancy.allSolid || world.traceLine(
        [wizardCaptureOrigin[0], wizardCaptureOrigin[1], wizardCaptureOrigin[2] + 16],
        [origin[0], origin[1], origin[2] + 22],
        false,
        wizardReference
    ).entity !== player) {
        throw new Error('E1M4 wizard-tracer capture carrier lacks clear authored sight');
    }
    const playerState: QuakePlayerState = {
        ...capturePlayerState(origin, angles),
        onGround: true
    };
    world.vm.setEntityFloat(player, 'takedamage', 0);
    world.clearSoundEvents();
    world.vm.setGlobalWord('self', wizardReference);
    world.vm.execute('Wiz_Missile');
    let projectileReference = -1;
    for (let frame = 0; frame < 160 && projectileReference <= player; frame++) {
        world.update(0.05, playerState);
        projectileReference = world.vm.edicts.findIndex((edict, reference) => (
            reference > player && !edict.free &&
            world.vm.getEntityWord(reference, 'owner') === wizardReference &&
            world.vm.getEntityString(reference, 'model') === 'progs/w_spike.mdl'
        ));
    }
    world.setPlayerPose(origin, angles);
    if (world.vm.getEntityWord(wizardReference, 'enemy') !== player ||
        projectileReference <= player ||
        world.vm.program.functions[
        world.vm.getEntityWord(projectileReference, 'touch')
        ]?.name !== 'spike_touch' || !world.soundEvents.some(event => (
        event.entity === wizardReference && event.sample === 'wizard/wattack.wav'
    ))) {
        throw new Error('E1M4 Wizard did not launch its authored tracer projectile');
    }
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    return {
        initialWizardOrigin: [...wizardCaptureOrigin],
        playerState,
        projectileReference,
        wizardReference
    };
};

export const advanceQuakeWizardTracerCapture = (
    world: QuakeWorldRuntime,
    capture: QuakeWizardTracerCaptureState
): void => {
    const initialOrigin = world.vm.getEntityVector(capture.projectileReference, 'origin');
    world.update(0.05, capture.playerState);
    world.setPlayerPose(capture.playerState.origin, capture.playerState.angles);
    if (world.vm.entity(capture.projectileReference).free ||
        world.vm.getEntityString(capture.projectileReference, 'model') !==
            'progs/w_spike.mdl' || Math.hypot(...world.vm.getEntityVector(
        capture.projectileReference,
        'origin'
    ).map((component, axis) => component - initialOrigin[axis])) <= 0) {
        throw new Error(`E1M4 Wizard tracer did not preserve its authored flight state: ${
            JSON.stringify({
                free: world.vm.entity(capture.projectileReference).free,
                model: world.vm.getEntityString(capture.projectileReference, 'model'),
                origin: world.vm.getEntityVector(capture.projectileReference, 'origin'),
                wizardOrigin: world.vm.getEntityVector(capture.wizardReference, 'origin'),
                think: world.vm.program.functions[
                world.vm.getEntityWord(capture.projectileReference, 'think')
                ]?.name,
                time: world.time,
                velocity: world.vm.getEntityVector(capture.projectileReference, 'velocity')
            })
        }`);
    }
};

export const prepareQuakePatrolCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakePatrolCaptureState => {
    suppressCaptureTargets(world);
    world.setPlayerPose(origin, angles);
    const soldierIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'monster_army' && entity.target === 't16'
    ));
    const firstCornerIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'path_corner' && entity.targetname === 't16'
    ));
    const nextCornerIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'path_corner' && entity.targetname === 't17'
    ));
    const soldierReference = world.entityReferences[soldierIndex];
    const firstCornerReference = world.entityReferences[firstCornerIndex];
    const nextCornerReference = world.entityReferences[nextCornerIndex];
    if (soldierReference === null || firstCornerReference === null ||
        nextCornerReference === null || soldierReference === undefined ||
        firstCornerReference === undefined || nextCornerReference === undefined) {
        throw new Error('E1M1 patrol capture requires the authored t16/t17 route');
    }
    for (let frame = 0; frame < 10 && world.vm.getEntityWord(
        soldierReference, 'movetarget'
    ) !== firstCornerReference; frame++) {
        world.update(0.05);
    }
    if (world.vm.getEntityWord(soldierReference, 'movetarget') !== firstCornerReference) {
        throw new Error('E1M1 patrol soldier did not acquire t16');
    }
    for (let frame = 0; frame < 200 && world.vm.getEntityWord(
        soldierReference, 'movetarget'
    ) !== nextCornerReference; frame++) {
        world.update(0.05);
    }
    if (world.vm.getEntityWord(soldierReference, 'movetarget') !== nextCornerReference ||
        world.vm.getEntityWord(soldierReference, 'goalentity') !== nextCornerReference) {
        throw new Error('E1M1 patrol soldier did not hand off from t16 to t17');
    }
    for (let frame = 0; frame < 8; frame++) world.update(0.05);
    world.setPlayerPose(origin, angles);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    return { firstCornerReference, nextCornerReference, soldierReference };
};

export const prepareQuakePlatformCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakePlatformCaptureState => {
    suppressCaptureTargets(world);
    const platformIndex = world.map.entities.findIndex(
        entity => entity.classname === 'func_plat'
    );
    const platformReference = world.entityReferences[platformIndex];
    if (platformReference === null || platformReference === undefined ||
        world.vm.entity(platformReference).free) {
        throw new Error('E1M1 platform capture requires an active func_plat');
    }
    const triggerReference = world.vm.edicts.findIndex((edict, reference) => {
        if (reference <= world.playerReference || edict.free ||
            world.vm.getEntityWord(reference, 'enemy') !== platformReference) {
            return false;
        }
        const touch = world.vm.getEntityWord(reference, 'touch');
        return touch !== 0 &&
            world.vm.program.functions[touch]?.name === 'plat_center_touch';
    });
    if (triggerReference < 0) {
        throw new Error('E1M1 platform capture requires its authored center trigger');
    }
    const initialPlatformOrigin = world.vm.getEntityVector(platformReference, 'origin');
    const platformMins = world.vm.getEntityVector(platformReference, 'mins');
    const platformMaxs = world.vm.getEntityVector(platformReference, 'maxs');
    const playerMins = world.vm.getEntityVector(world.playerReference, 'mins');
    const expectedOrigin: Vec3 = [
        initialPlatformOrigin[0] + (platformMins[0] + platformMaxs[0]) / 2,
        initialPlatformOrigin[1] + (platformMins[1] + platformMaxs[1]) / 2,
        initialPlatformOrigin[2] + platformMaxs[2] - playerMins[2]
    ];
    if (origin.some((component, axis) => Math.abs(component - expectedOrigin[axis]) > 0.01)) {
        throw new Error(
            `E1M1 platform capture requires captureOrigin=${expectedOrigin.join(',')}`
        );
    }
    if (world.vm.getEntityFloat(platformReference, 'state') !== 1 ||
        initialPlatformOrigin.some((component, axis) => Math.abs(
            component - world.vm.getEntityVector(platformReference, 'pos2')[axis]
        ) > 0.01)) {
        throw new Error('E1M1 platform capture requires the authored bottom state');
    }
    const platformModelIndex = Number(
        world.vm.getEntityString(platformReference, 'model').slice(1)
    );
    if (!Number.isInteger(platformModelIndex) || platformModelIndex <= 0) {
        throw new Error('E1M1 platform capture has an invalid inline model');
    }
    world.setSnapshotTime(1);
    world.setPlayerPose(origin, angles);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    return {
        initialPlatformOrigin,
        platformModelIndex,
        platformReference,
        playerState: {
            ...capturePlayerState(origin, angles),
            groundModelIndex: platformModelIndex
        }
    };
};

export const advanceQuakePlatformCapture = (
    world: QuakeWorldRuntime,
    capture: QuakePlatformCaptureState
): void => {
    const result = world.update(0.05, capture.playerState);
    capture.playerState = {
        ...capture.playerState,
        onGround: result.onGround,
        origin: result.origin,
        velocity: result.velocity
    };
    world.setPlayerPose(result.origin, capture.playerState.angles);
    const platformOrigin = world.vm.getEntityVector(capture.platformReference, 'origin');
    if (world.vm.getEntityFloat(capture.platformReference, 'state') !== 2 ||
        world.vm.getEntityVector(capture.platformReference, 'velocity')[2] !== 150 ||
        platformOrigin[2] <= capture.initialPlatformOrigin[2] || !result.onGround ||
        world.vm.getEntityWord(world.playerReference, 'groundentity') !==
            capture.platformReference) {
        throw new Error('E1M1 platform capture did not preserve the authored upward ride');
    }
};

export const prepareQuakeSecretDoorShotCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeSecretDoorCaptureState => {
    suppressCaptureTargets(world);
    const expectedOrigin: Vec3 = [688, 23, 79];
    if (origin.some((component, axis) => Math.abs(
        component - expectedOrigin[axis]
    ) > 0.01)) {
        throw new Error(
            `E1M1 secret-door capture requires captureOrigin=${expectedOrigin.join(',')}`
        );
    }
    const doorIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'func_door_secret' &&
        entity.message === 'Shoot this secret door...'
    ));
    const doorReference = world.entityReferences[doorIndex];
    if (doorReference === null || doorReference === undefined ||
        world.vm.entity(doorReference).free ||
        world.vm.getEntityString(doorReference, 'model') !== '*43' ||
        world.vm.getEntityFloat(doorReference, 'solid') !== 4 ||
        world.vm.getEntityFloat(doorReference, 'takedamage') !== 1 ||
        world.vm.program.functions[
        world.vm.getEntityWord(doorReference, 'th_pain')
        ]?.name !== 'fd_secret_use') {
        throw new Error('E1M1 secret-door capture requires its authored shootable brush');
    }
    const minimum = world.vm.getEntityVector(doorReference, 'absmin');
    const maximum = world.vm.getEntityVector(doorReference, 'absmax');
    if (minimum.some((component, axis) => component !== [655, 47, 47][axis]) ||
        maximum.some((component, axis) => component !== [721, 65, 113][axis])) {
        throw new Error('E1M1 secret-door capture has unexpected expanded brush bounds');
    }
    const playerState: QuakePlayerState = {
        ...capturePlayerState(
            origin,
            angles.map(quakeProtocolAngle) as Vec3
        ),
        onGround: false
    };
    world.setPlayerPose(origin, angles);
    for (let frame = 0; frame < QUAKE_WEAPON_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    const player = world.playerReference;
    world.vm.setEntityFloat(player, 'ammo_shells', 25);
    world.vm.setEntityFloat(player, 'currentammo', 25);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    world.clearSoundEvents();
    world.particleEvents.length = 0;
    const initialDoorOrigin = world.vm.getEntityVector(doorReference, 'origin');
    const initialAmmo = world.vm.getEntityFloat(player, 'currentammo');

    world.update(0.05, { ...playerState, attack: true });
    world.setPlayerPose(origin, angles);

    const doorOrigin = world.vm.getEntityVector(doorReference, 'origin');
    const doorSound = world.vm.getEntityString(doorReference, 'noise2');
    const collider = world.collision.brushColliders.find(
        candidate => candidate.modelIndex === 43
    );
    const doorMoved = doorOrigin.some(
        (component, axis) => component !== initialDoorOrigin[axis]
    );
    const colliderMatches = collider !== undefined && collider.origin.every(
        (component, axis) => component === doorOrigin[axis]
    );
    const doorSoundStarted = world.soundEvents.some(event => (
        event.entity === doorReference && event.sample === doorSound
    ));
    if (world.vm.getEntityFloat(player, 'currentammo') !== initialAmmo - 1 ||
        world.vm.getEntityFloat(doorReference, 'takedamage') !== 0 ||
        world.vm.getEntityString(doorReference, 'message') !== '' ||
        !world.vm.getEntityVector(doorReference, 'velocity').some(
            component => component !== 0
        ) || !doorMoved || !colliderMatches || !doorSoundStarted) {
        throw new Error('E1M1 secret door did not enter its authored shot-open state');
    }
    return { doorReference, initialDoorOrigin, playerState };
};

export const prepareQuakeTriggeredSecretDoorCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeTriggeredSecretDoorCaptureState => {
    suppressCaptureTargets(world);
    const expectedOrigin: Vec3 = [32, 2_352, 56];
    if (world.mapName !== 'e1m1' || origin.some((component, axis) => Math.abs(
        component - expectedOrigin[axis]
    ) > 0.01)) {
        throw new Error(
            'E1M1 triggered-secret-door capture requires map=e1m1 and ' +
            `captureOrigin=${expectedOrigin.join(',')}`
        );
    }
    const triggerIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'trigger_once' && entity.model === '*11' &&
        entity.target === 't3'
    ));
    const doorIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'func_door_secret' && entity.model === '*10' &&
        entity.targetname === 't3'
    ));
    const triggerReference = world.entityReferences[triggerIndex];
    const doorReference = world.entityReferences[doorIndex];
    if (triggerReference === null || triggerReference === undefined ||
        doorReference === null || doorReference === undefined) {
        throw new Error('E1M1 triggered-secret-door capture requires its authored t3 chain');
    }
    const doorModelIndex = 10;
    const playerState: QuakePlayerState = {
        ...capturePlayerState(origin, angles),
        onGround: false
    };
    world.setSnapshotTime(1);
    world.setPlayerPose(origin, angles);
    for (let frame = 0; frame < QUAKE_WEAPON_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    world.clearConsole();
    world.clearSoundEvents();
    const initialDoorOrigin = world.vm.getEntityVector(doorReference, 'origin');
    const initialLightStyle = world.lightStyles.get(32);
    const triggerContactOrigin: Vec3 = [64, 2_352, 56];
    const triggerMinimum = world.vm.getEntityVector(triggerReference, 'absmin');
    const triggerMaximum = world.vm.getEntityVector(triggerReference, 'absmax');
    const playerMinimum: Vec3 = [
        triggerContactOrigin[0] - 17,
        triggerContactOrigin[1] - 17,
        triggerContactOrigin[2] - 25
    ];
    const playerMaximum: Vec3 = [
        triggerContactOrigin[0] + 17,
        triggerContactOrigin[1] + 17,
        triggerContactOrigin[2] + 33
    ];
    if (triggerMinimum.some((component, axis) => (
        playerMaximum[axis] < component || playerMinimum[axis] > triggerMaximum[axis]
    ))) {
        throw new Error('E1M1 t3 capture contact does not overlap the authored trigger');
    }
    world.update(0.05, { ...playerState, origin: triggerContactOrigin });
    while (world.time < 5.999) world.update(0.05, playerState);
    world.setPlayerPose(origin, angles);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    world.clearSoundEvents();
    const doorOrigin = world.vm.getEntityVector(doorReference, 'origin');
    const doorDestination = world.vm.getEntityVector(doorReference, 'dest2');
    const colliderOrigin = world.collision.brushColliders.find(
        collider => collider.modelIndex === doorModelIndex
    )?.origin;
    if (doorOrigin.every((component, axis) => component === initialDoorOrigin[axis]) ||
        !doorOrigin.every((component, axis) => (
            Math.abs(component - doorDestination[axis]) < 0.001
        )) || world.vm.getEntityVector(doorReference, 'velocity').some(
        component => component !== 0
    ) || !colliderOrigin?.every((component, axis) => (
        Math.abs(component - doorOrigin[axis]) < 0.001
    )) || world.lightStyles.get(32) === initialLightStyle ||
        world.vm.program.functions[
        world.vm.getEntityWord(triggerReference, 'touch')
        ]?.name !== 'SUB_Null') {
        throw new Error(
            `E1M1 triggered-secret-door capture did not reach its open state: ${JSON.stringify({
                colliderOrigin,
                doorDestination,
                doorOrigin,
                lightStyle: world.lightStyles.get(32),
                initialLightStyle,
                nextThink: world.vm.getEntityFloat(doorReference, 'nextthink'),
                think: world.vm.program.functions[
                world.vm.getEntityWord(doorReference, 'think')
                ]?.name,
                time: world.time,
                touch: world.vm.program.functions[
                world.vm.getEntityWord(triggerReference, 'touch')
                ]?.name,
                velocity: world.vm.getEntityVector(doorReference, 'velocity')
            })}`
        );
    }
    return {
        doorModelIndex,
        doorReference,
        initialDoorOrigin,
        playerState,
        triggerReference
    };
};

export const prepareQuakeTouchTriggerDoorCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeTriggeredSecretDoorCaptureState => {
    suppressCaptureTargets(world);
    const expectedOrigin: Vec3 = [-368, 2_896, -44];
    if (world.mapName !== 'e1m1' || origin.some((component, axis) => Math.abs(
        component - expectedOrigin[axis]
    ) > 0.01)) {
        throw new Error(
            'E1M1 touch-trigger-door capture requires map=e1m1 and ' +
            `captureOrigin=${expectedOrigin.join(',')}`
        );
    }
    const triggerIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'trigger_multiple' && entity.model === '*42' &&
        entity.target === 't18'
    ));
    const doorIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'func_door_secret' && entity.model === '*41' &&
        entity.targetname === 't18'
    ));
    const triggerReference = world.entityReferences[triggerIndex];
    const doorReference = world.entityReferences[doorIndex];
    if (triggerReference === null || triggerReference === undefined ||
        doorReference === null || doorReference === undefined) {
        throw new Error('E1M1 touch-trigger-door capture requires its authored t18 chain');
    }
    const doorModelIndex = 41;
    const playerState: QuakePlayerState = {
        ...capturePlayerState(origin, angles),
        onGround: false
    };
    const player = world.playerReference;
    world.setSnapshotTime(1);
    world.vm.setEntityFloat(player, 'movetype', 8);
    world.vm.setEntityFloat(player, 'solid', 3);
    world.setPlayerPose(origin, angles);
    world.clearConsole();
    world.clearSoundEvents();
    const initialDoorOrigin = world.vm.getEntityVector(doorReference, 'origin');
    for (let frame = 0; frame < QUAKE_TOUCH_TRIGGER_DOOR_CAPTURE_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    // This carrier also overlaps the authored super-shotgun pickup. Chocolate
    // Quake's paused screenshot cleanup advances client-only palette effects,
    // so decay the pickup flash without advancing the captured server state.
    settleQuakePausedCapturePalette(world);
    // The paused native client keeps the first/fifth (identical) pickup icon
    // while the palette flash decays independently.
    world.itemGetTimes[1] = world.time;
    world.setPlayerPose(origin, angles);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    const doorOrigin = world.vm.getEntityVector(doorReference, 'origin');
    const colliderOrigin = world.collision.brushColliders.find(
        collider => collider.modelIndex === doorModelIndex
    )?.origin;
    if (world.vm.getEntityWord(triggerReference, 'enemy') !== player ||
        doorOrigin.every((component, axis) => component === initialDoorOrigin[axis]) ||
        world.vm.getEntityVector(doorReference, 'velocity').some(
            component => component !== 0
        ) || !colliderOrigin?.every((component, axis) => (
        Math.abs(component - doorOrigin[axis]) < 0.001
    )) || !world.soundEvents.some(event => (
        event.entity === doorReference &&
        event.sample === world.vm.getEntityString(doorReference, 'noise2')
    ))) {
        throw new Error(
            `E1M1 t18 touch trigger did not move its secret door: ${JSON.stringify({
                colliderOrigin,
                doorOrigin,
                enemy: world.vm.getEntityWord(triggerReference, 'enemy'),
                initialDoorOrigin,
                sounds: world.soundEvents.map(event => event.sample),
                time: world.time,
                velocity: world.vm.getEntityVector(doorReference, 'velocity')
            })}`
        );
    }
    return {
        doorModelIndex,
        doorReference,
        initialDoorOrigin,
        playerState,
        triggerReference
    };
};

export const prepareQuakeLightDoorCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeLightDoorCaptureState => {
    suppressCaptureTargets(world);
    const expectedOrigin: Vec3 = [800, 2_384, -80];
    if (world.mapName !== 'e1m1' || origin.some((component, axis) => Math.abs(
        component - expectedOrigin[axis]
    ) > 0.01)) {
        throw new Error(
            'E1M1 light-door capture requires map=e1m1 and ' +
            `captureOrigin=${expectedOrigin.join(',')}`
        );
    }
    const triggerIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'trigger_once' && entity.model === '*30' &&
        entity.target === 't11'
    ));
    const doorIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'func_door' && entity.model === '*34' &&
        entity.targetname === 't11'
    ));
    const lightIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'light' && entity.targetname === 't11' &&
        entity.style === '33'
    ));
    const triggerReference = world.entityReferences[triggerIndex];
    const doorReference = world.entityReferences[doorIndex];
    const lightReference = world.entityReferences[lightIndex];
    if (triggerReference === null || triggerReference === undefined ||
        doorReference === null || doorReference === undefined ||
        lightReference === null || lightReference === undefined) {
        throw new Error('E1M1 light-door capture requires its authored t11 chain');
    }
    const doorModelIndex = 34;
    const lightStyle = 33;
    const playerState: QuakePlayerState = {
        ...capturePlayerState(origin, angles),
        onGround: false
    };
    const player = world.playerReference;
    // Ordinary func_door entities defer LinkDoors by 0.1 seconds. The native
    // time-1 carrier has already run that think; do the same before placing
    // the capture player inside the later t11 trigger.
    const initialPlayer = world.playerResult(false);
    world.update(0.1, capturePlayerState(
        initialPlayer.origin,
        initialPlayer.angles
    ));
    world.setSnapshotTime(1);
    world.vm.setEntityFloat(player, 'movetype', 8);
    world.vm.setEntityFloat(player, 'solid', 3);
    world.setPlayerPose(origin, angles);
    world.clearConsole();
    world.clearSoundEvents();
    const initialDoorOrigin = world.vm.getEntityVector(doorReference, 'origin');
    const initialLightStyle = world.lightStyles.get(lightStyle);
    for (let frame = 0; frame < QUAKE_LIGHT_DOOR_CAPTURE_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    world.setPlayerPose(origin, angles);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    const doorOrigin = world.vm.getEntityVector(doorReference, 'origin');
    const colliderOrigin = world.collision.brushColliders.find(
        collider => collider.modelIndex === doorModelIndex
    )?.origin;
    if (!world.vm.entity(triggerReference).free ||
        initialLightStyle !== 'a' || world.lightStyles.get(lightStyle) !== 'm' ||
        doorOrigin.every((component, axis) => component === initialDoorOrigin[axis]) ||
        world.vm.getEntityVector(doorReference, 'velocity').some(
            component => component !== 0
        ) || !colliderOrigin?.every((component, axis) => (
        Math.abs(component - doorOrigin[axis]) < 0.001
    )) || !world.soundEvents.some(event => (
        event.entity === doorReference &&
        event.sample === world.vm.getEntityString(doorReference, 'noise2')
    ))) {
        throw new Error(
            `E1M1 t11 trigger did not reach its light-door state: ${JSON.stringify({
                colliderOrigin,
                doorOrigin,
                initialDoorOrigin,
                initialLightStyle,
                lightStyle: world.lightStyles.get(lightStyle),
                time: world.time,
                triggerFree: world.vm.entity(triggerReference).free,
                velocity: world.vm.getEntityVector(doorReference, 'velocity')
            })}`
        );
    }
    return {
        doorModelIndex,
        doorReference,
        initialDoorOrigin,
        lightReference,
        lightStyle,
        playerState,
        triggerReference
    };
};

export const prepareQuakeTutorialMessageCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3,
    targetname: QuakeTutorialMessageTarget = 't31'
): QuakeTutorialMessageCaptureState => {
    suppressCaptureTargets(world);
    const message = targetname === 't31' ?
        'You can jump up here...' : 'You can jump across...';
    const triggerIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'trigger_multiple' &&
        entity.targetname === targetname &&
        entity.message === message
    ));
    const triggerReference = world.entityReferences[triggerIndex];
    const triggerSounds = triggerReference === null || triggerReference === undefined ?
        0 : world.vm.getEntityFloat(triggerReference, 'sounds');
    const triggerTouch = triggerReference === null || triggerReference === undefined ?
        '' : world.vm.program.functions[
        world.vm.getEntityWord(triggerReference, 'touch')
        ]?.name;
    if (triggerReference === null || triggerReference === undefined ||
        world.vm.entity(triggerReference).free ||
        triggerSounds !== 2 || triggerTouch !== 'multi_touch') {
        throw new Error(
            'E1M1 tutorial capture requires the authored message trigger ' +
            `(${targetname}, ` +
            `sounds=${triggerSounds}, touch=${triggerTouch ?? ''})`
        );
    }
    const triggerOrigin = world.vm.getEntityVector(triggerReference, 'origin');
    const triggerMins = world.vm.getEntityVector(triggerReference, 'mins');
    const triggerMaxs = world.vm.getEntityVector(triggerReference, 'maxs');
    const triggerCenter = triggerOrigin.map(
        (component, axis) => component + (triggerMins[axis] + triggerMaxs[axis]) / 2
    ) as Vec3;
    // The t32 volume is eight units above its authored floor. Native gravity
    // settles the review carrier at the usual 1/32-unit hull clearance.
    const expectedOrigin: Vec3 = targetname === 't32' ?
        [triggerCenter[0], triggerCenter[1], triggerCenter[2] - 7.96875] :
        triggerCenter;
    if (origin.some((component, axis) => Math.abs(
        component - expectedOrigin[axis]
    ) > 0.01)) {
        throw new Error(
            `E1M1 tutorial capture requires captureOrigin=${expectedOrigin.join(',')}`
        );
    }
    const playerState = capturePlayerState(origin, angles);
    world.setSnapshotTime(1);
    world.setPlayerPose(origin, angles);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    world.clearSoundEvents();
    for (let frame = 0; frame < QUAKE_TUTORIAL_CAPTURE_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    world.setPlayerPose(origin, angles);
    if (world.visibleCenterMessage() !== message ||
        !world.soundEvents.some(event => (
            event.entity === triggerReference &&
            event.channel === 2 &&
            event.sample === 'misc/talk.wav'
        ))) {
        throw new Error('E1M1 tutorial trigger did not enter its authored message state');
    }
    return { playerState, triggerReference };
};

export const prepareQuakeButtonDoorCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeButtonDoorCaptureState => {
    suppressCaptureTargets(world);
    const expectedOrigin: Vec3 = [40, 576, 56];
    if (origin.some((component, axis) => Math.abs(
        component - expectedOrigin[axis]
    ) > 0.01)) {
        throw new Error(
            `E1M1 button-door capture requires captureOrigin=${expectedOrigin.join(',')}`
        );
    }
    const buttonIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'func_button' && entity.model === '*4' &&
        entity.target === 't1'
    ));
    const doorIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'func_door' && entity.model === '*3' &&
        entity.targetname === 't1'
    ));
    const buttonReference = world.entityReferences[buttonIndex];
    const doorReference = world.entityReferences[doorIndex];
    if (buttonReference === null || buttonReference === undefined ||
        doorReference === null || doorReference === undefined ||
        world.vm.entity(buttonReference).free || world.vm.entity(doorReference).free) {
        throw new Error('E1M1 button-door capture requires the authored t1 chain');
    }
    const buttonModelIndex = Number(
        world.vm.getEntityString(buttonReference, 'model').slice(1)
    );
    const doorModelIndex = Number(
        world.vm.getEntityString(doorReference, 'model').slice(1)
    );
    if (buttonModelIndex !== 4 || doorModelIndex !== 3 ||
        world.vm.program.functions[
        world.vm.getEntityWord(buttonReference, 'touch')
        ]?.name !== 'button_touch') {
        throw new Error('E1M1 button-door capture has unexpected brush state');
    }
    const buttonContactOrigin: Vec3 = [-40, 576, 56];
    const buttonTrace = world.tracePlayerMovement(buttonContactOrigin, [
        buttonContactOrigin[0] - 16,
        buttonContactOrigin[1],
        buttonContactOrigin[2]
    ]);
    if (buttonTrace.entity !== buttonReference || buttonTrace.trace.fraction === 1) {
        throw new Error('E1M1 button-door capture pose does not contact the authored button');
    }
    const playerState: QuakePlayerState = {
        ...capturePlayerState(origin, angles),
        onGround: false
    };
    world.setSnapshotTime(1);
    world.setPlayerPose(origin, angles);
    for (let frame = 0; frame < QUAKE_WEAPON_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    world.clearSoundEvents();
    const initialButtonOrigin = world.vm.getEntityVector(buttonReference, 'origin');
    const initialDoorOrigin = world.vm.getEntityVector(doorReference, 'origin');
    world.update(0.05, {
        ...playerState,
        origin: buttonContactOrigin,
        touchModelIndices: [buttonModelIndex]
    });
    for (let frame = 1; frame < QUAKE_BUTTON_DOOR_CAPTURE_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    world.setPlayerPose(origin, angles);
    const buttonOrigin = world.vm.getEntityVector(buttonReference, 'origin');
    const doorOrigin = world.vm.getEntityVector(doorReference, 'origin');
    const buttonCollider = world.collision.brushColliders.find(
        collider => collider.modelIndex === buttonModelIndex
    );
    const doorCollider = world.collision.brushColliders.find(
        collider => collider.modelIndex === doorModelIndex
    );
    const buttonColliderMatches = buttonCollider !== undefined &&
        buttonCollider.origin.every(
            (component, axis) => component === buttonOrigin[axis]
        );
    const doorColliderMatches = doorCollider !== undefined &&
        doorCollider.origin.every(
            (component, axis) => component === doorOrigin[axis]
        );
    if (world.vm.getEntityFloat(buttonReference, 'state') !== 0 ||
        world.vm.getEntityFloat(buttonReference, 'frame') !== 1 ||
        buttonOrigin.every((component, axis) => component === initialButtonOrigin[axis]) ||
        world.vm.getEntityFloat(doorReference, 'state') !== 2 ||
        doorOrigin.every((component, axis) => component === initialDoorOrigin[axis]) ||
        !world.vm.getEntityVector(doorReference, 'velocity').some(
            component => component !== 0
        ) || !buttonColliderMatches || !doorColliderMatches) {
        throw new Error(
            `E1M1 button-door capture did not preserve the authored moving state: ${
                JSON.stringify({
                    buttonFrame: world.vm.getEntityFloat(buttonReference, 'frame'),
                    buttonColliderOrigin: buttonCollider?.origin,
                    buttonOrigin,
                    buttonState: world.vm.getEntityFloat(buttonReference, 'state'),
                    doorOrigin,
                    doorColliderOrigin: doorCollider?.origin,
                    doorState: world.vm.getEntityFloat(doorReference, 'state'),
                    doorVelocity: world.vm.getEntityVector(doorReference, 'velocity')
                })}`
        );
    }
    return {
        buttonModelIndex,
        buttonReference,
        doorModelIndex,
        doorReference,
        initialButtonOrigin,
        initialDoorOrigin,
        playerState
    };
};

export const prepareQuakeSilverKeyDoorCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeSilverKeyDoorCaptureState => {
    suppressCaptureTargets(world);
    const expectedOrigin: Vec3 = [272, -400, 328];
    if (world.mapName !== 'e1m2' || origin.some((component, axis) => Math.abs(
        component - expectedOrigin[axis]
    ) > 0.01)) {
        throw new Error(
            'E1M2 silver-key-door capture requires map=e1m2 and ' +
            `captureOrigin=${expectedOrigin.join(',')}`
        );
    }
    const keyIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'item_key1' && entity.origin === '880 -300 464'
    ));
    const doorModelIndices: [number, number] = [39, 40];
    const doorIndices = doorModelIndices.map(modelIndex => (
        world.map.entities.findIndex(entity => (
            entity.classname === 'func_door' && entity.model === `*${modelIndex}`
        ))
    ));
    const keyReference = world.entityReferences[keyIndex];
    const doorReferences = doorIndices.map(
        index => world.entityReferences[index]
    );
    if (keyReference === null || keyReference === undefined || doorReferences.some(
        reference => reference === null || reference === undefined
    )) {
        throw new Error('E1M2 silver-key-door capture requires its authored key chain');
    }
    const pairedDoors = doorReferences as [number, number];
    const playerState: QuakePlayerState = {
        ...capturePlayerState(origin, angles),
        onGround: false
    };
    world.setSnapshotTime(1);
    world.setPlayerPose(origin, angles);
    for (let frame = 0; frame < QUAKE_WEAPON_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    const keyOrigin = world.vm.getEntityVector(keyReference, 'origin');
    world.update(0.05, { ...playerState, origin: keyOrigin });
    if (world.vm.getEntityString(keyReference, 'model') !== '' ||
        (Math.trunc(world.vm.getEntityFloat(world.playerReference, 'items')) & IT_KEY1) === 0) {
        throw new Error('E1M2 silver-key-door capture did not pick up the authored key');
    }
    world.update(0.05, {
        ...playerState,
        origin: [272, -266, 328],
        touchModelIndices: [doorModelIndices[0]]
    });
    for (let frame = 0; frame < 20 && pairedDoors.some(
        reference => world.vm.getEntityFloat(reference, 'state') !== 0
    ); frame++) {
        world.update(0.05, playerState);
    }
    while (world.time < 5.999) world.update(0.05, playerState);
    world.setPlayerPose(origin, angles);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    world.clearSoundEvents();
    const doorsMatch = pairedDoors.every((reference, index) => {
        const doorOrigin = world.vm.getEntityVector(reference, 'origin');
        const modelIndex = doorModelIndices[index];
        return world.vm.getEntityFloat(reference, 'state') === 0 &&
            doorOrigin.every((component, axis) => (
                Math.abs(component - world.vm.getEntityVector(reference, 'pos2')[axis]) < 0.001
            )) && world.collision.brushColliders.find(
            collider => collider.modelIndex === modelIndex
        )?.origin.every((component, axis) => (
            Math.abs(component - doorOrigin[axis]) < 0.001
        ));
    });
    if (!doorsMatch ||
        (Math.trunc(world.vm.getEntityFloat(world.playerReference, 'items')) & IT_KEY1) !== 0 ||
        pairedDoors.some(reference => (
            world.vm.program.functions[
            world.vm.getEntityWord(reference, 'touch')
            ]?.name !== 'SUB_Null'
        ))) {
        throw new Error('E1M2 silver-key-door capture did not preserve its open state');
    }
    return {
        doorModelIndices,
        doorReferences: pairedDoors,
        keyReference,
        playerState
    };
};

export const prepareQuakeDogLeapCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeDogLeapCaptureState => {
    suppressCaptureTargets(world);
    const playerState = capturePlayerState(origin, angles);
    world.setPlayerPose(origin, angles);
    for (let frame = 0; frame < 10; frame++) world.update(0.1, playerState);
    const dogIndex = world.map.entities.findIndex((entity, index) => {
        const reference = world.entityReferences[index];
        return entity.classname === 'monster_dog' && reference !== null &&
            reference !== undefined && !world.vm.entity(reference).free &&
            world.vm.getEntityString(reference, 'model') === 'progs/dog.mdl';
    });
    const dogReference = world.entityReferences[dogIndex];
    const jumpTouch = world.vm.program.functionsByName.get('Dog_JumpTouch');
    const leap = world.vm.program.functionsByName.get('dog_leap1');
    if (dogReference === null || dogReference === undefined || !jumpTouch || !leap) {
        throw new Error('E1M1 dog-leap capture requires an active dog');
    }
    const initialDogOrigin = world.vm.getEntityVector(dogReference, 'origin');
    const expectedPlayerOrigin: Vec3 = [
        initialDogOrigin[0],
        initialDogOrigin[1] - 160,
        initialDogOrigin[2]
    ];
    if (origin.some(
        (component, axis) => Math.abs(component - expectedPlayerOrigin[axis]) > 0.01
    )) {
        throw new Error(
            `E1M1 dog-leap capture requires captureOrigin=${expectedPlayerOrigin.join(',')}`
        );
    }
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    world.vm.setEntityVector(dogReference, 'angles', [0, 270, 0]);
    world.vm.setEntityFloat(dogReference, 'ideal_yaw', 270);
    world.vm.setEntityWord(dogReference, 'enemy', world.playerReference);
    world.setSnapshotTime(1);
    world.vm.setEntityWord(dogReference, 'think', leap.index);
    world.vm.setEntityFloat(dogReference, 'nextthink', world.time + 0.05);
    for (let frame = 0; frame < QUAKE_DOG_LEAP_CAPTURE_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    const dogOrigin = world.vm.getEntityVector(dogReference, 'origin');
    const dogVelocity = world.vm.getEntityVector(dogReference, 'velocity');
    if (world.vm.getEntityWord(dogReference, 'touch') !== jumpTouch.index ||
        dogOrigin[1] > initialDogOrigin[1] - 60 || dogVelocity[1] >= -250 ||
        world.vm.getEntityFloat(dogReference, 'frame') !== 62 ||
        world.vm.getEntityFloat(world.playerReference, 'health') !== 100) {
        throw new Error(
            `E1M1 dog-leap capture did not reach its airborne frame: origin ${
                dogOrigin.join(',')}, velocity ${dogVelocity.join(',')}, health ${
                world.vm.getEntityFloat(world.playerReference, 'health')}, frame ${
                world.vm.getEntityFloat(dogReference, 'frame')}`
        );
    }
    world.setPlayerPose(origin, angles);
    return { dogReference, initialDogOrigin, playerState };
};

export const prepareQuakeDogDeathCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeDogDeathCaptureState => {
    suppressCaptureTargets(world);
    world.setPlayerPose(origin, angles);
    const playerState = capturePlayerState(origin, angles);
    for (let frame = 0; frame < QUAKE_WEAPON_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    const dogReference = world.entityReferences.find((reference, index) => (
        world.map.entities[index].classname === 'monster_dog' && reference !== null &&
        !world.vm.entity(reference).free &&
        world.vm.getEntityString(reference, 'model') === 'progs/dog.mdl'
    ));
    if (dogReference === null || dogReference === undefined) {
        throw new Error('E1M1 dog death capture requires an active monster_dog');
    }
    const yaw = angles[1] * Math.PI / 180;
    const targetOrigin: Vec3 = [
        origin[0] + Math.cos(yaw) * 96,
        origin[1] + Math.sin(yaw) * 96,
        origin[2]
    ];
    world.setEntityOrigin(dogReference, targetOrigin);
    world.vm.setEntityVector(dogReference, 'oldorigin', targetOrigin);
    world.vm.setEntityVector(dogReference, 'velocity', [0, 0, 0]);
    const facingYaw = quakeProtocolAngle(angles[1] + 180);
    world.vm.setEntityVector(dogReference, 'angles', [0, facingYaw, 0]);
    world.vm.setEntityFloat(dogReference, 'ideal_yaw', facingYaw);
    world.vm.setEntityFloat(dogReference, 'health', 1);
    world.vm.setEntityFloat(dogReference, 'pausetime', 100_000_000);
    world.vm.setEntityWord(dogReference, 'enemy', 0);
    // Native carriers reach these supplied death branches after front-end host
    // rand() calls that the browser capture does not execute. Advance only the
    // deterministic capture stream so both renderers exercise the same real branch.
    world.advanceGameplayRandom(QUAKE_NATIVE_DEATH_CAPTURE_RANDOM_ADVANCES);
    world.clearSoundEvents();
    world.update(0.05, { ...playerState, attack: true });
    world.setPlayerPose(origin, angles);
    const deathThink = world.vm.program.functions[
    world.vm.getEntityWord(dogReference, 'think')
    ].name;
    if (world.vm.getEntityFloat(dogReference, 'health') > 0 ||
        world.vm.getEntityFloat(dogReference, 'health') <= -35 ||
        world.vm.getEntityFloat(dogReference, 'takedamage') !== 0 ||
        world.vm.getEntityFloat(dogReference, 'solid') !== 0 ||
        !/^dog_dieb?\d+$/.test(deathThink) ||
        !world.soundEvents.some(event => (
            event.entity === dogReference && event.sample === 'dog/ddeath.wav'
        ))) {
        throw new Error('Starting shotgun did not enter the ordinary dog death sequence');
    }
    return { dogReference, playerState };
};

export const advanceQuakeDogDeathCapture = (
    world: QuakeWorldRuntime,
    capture: QuakeDogDeathCaptureState
): void => {
    world.update(0.05, capture.playerState);
    world.setPlayerPose(capture.playerState.origin, capture.playerState.angles);
    const deathThink = world.vm.program.functions[
    world.vm.getEntityWord(capture.dogReference, 'think')
    ].name;
    if (world.vm.entity(capture.dogReference).free ||
        world.vm.getEntityString(capture.dogReference, 'model') !== 'progs/dog.mdl' ||
        world.vm.getEntityFloat(capture.dogReference, 'takedamage') !== 0 ||
        world.vm.getEntityFloat(capture.dogReference, 'solid') !== 0 ||
        !/^dog_dieb?\d+$/.test(deathThink)) {
        throw new Error('Dog death capture did not preserve the ordinary corpse');
    }
};

const touchCaptureItem = (
    world: QuakeWorldRuntime,
    classname: string,
    state: QuakePlayerState,
    clearBeforeTouch = false
): Vec3 => {
    for (let frame = 0; frame < 5; frame++) {
        world.update(0.05, state);
    }
    const mapIndex = world.map.entities.findIndex((entity, index) => {
        const reference = world.entityReferences[index];
        return entity.classname === classname && reference !== null &&
            reference !== undefined && !world.vm.entity(reference).free &&
            world.vm.getEntityFloat(reference, 'solid') === 1;
    });
    const reference = world.entityReferences[mapIndex];
    if (reference === null || reference === undefined || world.vm.entity(reference).free) {
        throw new Error(`E1M1 capture requires an active ${classname}`);
    }
    if (clearBeforeTouch) {
        world.clearConsole();
        world.centerMessage = '';
        world.centerMessageRemaining = 0;
    }
    const itemOrigin = world.vm.getEntityVector(reference, 'origin');
    world.update(0.01, {
        ...state,
        origin: itemOrigin
    });
    return itemOrigin;
};

export const prepareQuakePaletteCapture = (
    world: QuakeWorldRuntime,
    mode: QuakePaletteCaptureMode,
    origin: Vec3,
    angles: Vec3
): void => {
    const player = world.playerReference;
    suppressCaptureTargets(world);
    const state = capturePlayerState(origin, angles);
    const initialHealth = world.vm.getEntityFloat(player, 'health');

    if (mode === 'bonus') {
        touchCaptureItem(world, 'item_armor1', state);
        if (world.bonusShift <= 0 || world.vm.getEntityFloat(player, 'armorvalue') <= 0) {
            throw new Error('E1M1 armor pickup did not create the bonus palette state');
        }
    } else if (mode === 'quad' || mode === 'invisibility' ||
        mode === 'invulnerability' || mode === 'suit') {
        const powerup = mode === 'quad' ? {
            classname: 'item_artifact_super_damage',
            item: IT_QUAD,
            name: 'Quad'
        } : mode === 'invisibility' ? {
            classname: 'item_artifact_invisibility',
            item: 1 << 19,
            name: 'Ring of Shadows'
        } : mode === 'invulnerability' ? {
            classname: 'item_artifact_invulnerability',
            item: IT_INVULNERABILITY,
            name: 'Pentagram'
        } : {
            classname: 'item_artifact_envirosuit',
            item: IT_SUIT,
            name: 'Biosuit'
        };
        touchCaptureItem(world, powerup.classname, state);
        world.update(0.05, state);
        if ((Math.trunc(world.vm.getEntityFloat(player, 'items')) & powerup.item) === 0) {
            throw new Error(
                `E1M1 ${powerup.name} pickup did not create the powerup palette state`
            );
        }
    } else {
        world.update(0.01, {
            ...state,
            onGround: false,
            waterLevel: 3,
            waterType: CONTENTS.SLIME
        });
        if (world.damageShift <= 0 || world.vm.getEntityFloat(player, 'health') >= initialHealth) {
            throw new Error('QuakeC slime damage did not create the damage palette state');
        }
        world.damageKickPitch = 0;
        world.damageKickRoll = 0;
        world.damageKickTime = 0;
    }

    world.setPlayerPose(origin, angles);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
};

export const prepareQuakeWeaponPickupCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): void => {
    suppressCaptureTargets(world);
    const initialPlayer = world.playerResult(false);
    const warmupState = capturePlayerState(initialPlayer.origin, initialPlayer.angles);
    world.setPlayerPose(initialPlayer.origin, initialPlayer.angles);
    const itemOrigin = touchCaptureItem(
        world,
        'weapon_supershotgun',
        warmupState,
        true
    );
    const clientData = world.clientData();
    if (clientData.activeWeapon !== IT_SUPER_SHOTGUN ||
        clientData.weaponModel !== 'progs/v_shot2.mdl' ||
        clientData.ammoShells !== 30 || world.bonusShift <= 0 ||
        world.itemGetTimes[1] !== world.time) {
        throw new Error('E1M1 weapon pickup capture did not run weapon_touch');
    }
    if (origin.some((component, axis) => Math.abs(component - itemOrigin[axis]) > 0.01)) {
        throw new Error(
            `E1M1 weapon pickup capture requires captureOrigin=${itemOrigin.join(',')}`
        );
    }
    world.setSnapshotTime(1.01);
    world.itemGetTimes[1] = world.time;
    const pickupState = capturePlayerState(itemOrigin, angles);
    world.clearConsole();
    for (let frame = 0; frame < 10; frame++) world.update(0.05, pickupState);
    if (world.bonusShift !== 0 ||
        world.time - world.itemGetTimes[1] < 0.49 ||
        world.time - world.itemGetTimes[1] > 0.51) {
        throw new Error('E1M1 weapon pickup capture did not reach the native review frame');
    }
    world.setPlayerPose(itemOrigin, angles);
};

export const prepareQuakeTeleportCapture = (
    world: QuakeWorldRuntime
): QuakePlayerResult => {
    suppressCaptureTargets(world);
    const initial = world.playerResult(false);
    const warmupState = capturePlayerState(initial.origin, initial.angles);
    for (let frame = 0; frame < 20; frame++) {
        world.update(0.05, warmupState);
    }

    const teleportIndex = world.map.entities.findIndex((entity, index) => {
        const reference = world.entityReferences[index];
        return entity.classname === 'trigger_teleport' && reference !== null &&
            reference !== undefined && !world.vm.entity(reference).free &&
            world.vm.getEntityWord(reference, 'touch') !== 0;
    });
    const teleport = world.entityReferences[teleportIndex];
    if (teleport === null || teleport === undefined) {
        throw new Error('E1M1 teleport capture requires an active trigger_teleport');
    }
    const triggerOrigin = world.vm.getEntityVector(teleport, 'origin');
    const triggerMins = world.vm.getEntityVector(teleport, 'mins');
    const triggerMaxs = world.vm.getEntityVector(teleport, 'maxs');
    const triggerCenter = triggerOrigin.map(
        (component, axis) => component + (triggerMins[axis] + triggerMaxs[axis]) / 2
    ) as Vec3;
    const result = world.update(0.01, capturePlayerState(triggerCenter, [0, 0, 0]));
    if (!result.fixAngle || !result.backwardMoveBlocked ||
        !world.particleEvents.some(event => event.kind === 'teleport')) {
        throw new Error('E1M1 trigger did not create the teleport destination state');
    }

    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    return result;
};

export const prepareQuakeLightningCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): void => {
    suppressCaptureTargets(world);
    const state = capturePlayerState(origin, angles);
    world.setPlayerPose(origin, angles);
    const player = world.playerReference;
    const items = Math.trunc(world.vm.getEntityFloat(player, 'items'));
    world.vm.setEntityFloat(player, 'items', items | IT_LIGHTNING | IT_CELLS);
    world.vm.setEntityFloat(player, 'ammo_cells', 30);
    for (let frame = 0; frame < QUAKE_WEAPON_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05, state);
    }

    world.vm.setEntityFloat(player, 'impulse', 8);
    world.update(0.05, state);
    if (world.clientData().activeWeapon !== IT_LIGHTNING ||
        world.clientData().weaponModel !== 'progs/v_light.mdl') {
        throw new Error('QuakeC did not switch the capture player to the lightning gun');
    }

    world.update(0.05, { ...state, attack: true });
    if (!world.activeBeams().some(beam => beam.model === 'progs/bolt2.mdl')) {
        throw new Error('QuakeC lightning attack did not create a TE_LIGHTNING2 beam');
    }
    world.setPlayerPose(origin, angles);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
};

export const prepareQuakeExploboxCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeExploboxCaptureState => {
    suppressCaptureTargets(world);
    const playerState = capturePlayerState(origin, angles);
    world.setPlayerPose(origin, angles);
    for (let frame = 0; frame < QUAKE_WEAPON_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05, playerState);
    }

    const barrelReference = world.entityReferences.find((reference, index) => (
        world.map.entities[index].classname === 'misc_explobox' && reference !== null &&
        !world.vm.entity(reference).free &&
        world.vm.getEntityString(reference, 'model') === 'maps/b_explob.bsp'
    ));
    if (barrelReference === null || barrelReference === undefined) {
        throw new Error('E1M1 explosive-box capture requires the authored misc_explobox');
    }
    const barrelOrigin = world.vm.getEntityVector(barrelReference, 'origin');
    const barrelMins = world.vm.getEntityVector(barrelReference, 'mins');
    const barrelMaxs = world.vm.getEntityVector(barrelReference, 'maxs');
    const barrelCenter = barrelOrigin.map(
        (component, axis) => component + (barrelMins[axis] + barrelMaxs[axis]) / 2
    ) as Vec3;
    const eye = origin.map((component, axis) => (
        component + world.vm.getEntityVector(world.playerReference, 'view_ofs')[axis]
    )) as Vec3;
    if (world.traceLine(eye, barrelCenter, false, world.playerReference).entity !==
        barrelReference) {
        throw new Error('E1M1 explosive-box capture pose does not have a clear barrel shot');
    }

    world.update(0.05, { ...playerState, attack: true });
    world.setPlayerPose(origin, angles);
    if (world.vm.getEntityString(barrelReference, 'classname') !== 'explo_box' ||
        world.vm.getEntityString(barrelReference, 'model') !== 'progs/s_explod.spr' ||
        !world.soundEvents.some(event => (
            event.entity === barrelReference && event.sample === 'weapons/r_exp3.wav'
        )) || world.particleEvents.some(event => event.kind === 'explosion')) {
        throw new Error('Starting shotgun did not enter the original barrel explosion sequence');
    }
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    return { barrelReference, playerState };
};

export const advanceQuakeExploboxCapture = (
    world: QuakeWorldRuntime,
    capture: QuakeExploboxCaptureState
): void => {
    world.update(0.05, capture.playerState);
    world.setPlayerPose(capture.playerState.origin, capture.playerState.angles);
    if (world.vm.entity(capture.barrelReference).free ||
        world.vm.getEntityString(capture.barrelReference, 'model') !== 'progs/s_explod.spr') {
        throw new Error('Explosive-box capture did not preserve the explosion sprite');
    }
};

export const prepareQuakeNailgunCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeNailgunCaptureState => {
    suppressCaptureTargets(world);
    const initialPlayer = world.playerResult(false);
    const initialState = capturePlayerState(initialPlayer.origin, initialPlayer.angles);
    world.setPlayerPose(initialPlayer.origin, initialPlayer.angles);
    touchCaptureItem(world, 'weapon_nailgun', initialState, true);
    const player = world.playerReference;
    const pickedUp = world.clientData();
    if (pickedUp.activeWeapon !== IT_NAILGUN ||
        pickedUp.weaponModel !== 'progs/v_nail.mdl' || pickedUp.ammoNails !== 30 ||
        world.itemGetTimes[2] !== world.time) {
        throw new Error('E1M1 nailgun capture did not run the authored weapon_touch');
    }

    world.setSnapshotTime(1);
    world.itemGetTimes[2] = world.time;
    const playerState = capturePlayerState(origin, angles);
    world.setPlayerPose(origin, angles);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    for (let frame = 0; frame < QUAKE_WEAPON_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    world.setPlayerImpulse(4);
    world.update(0.05, playerState);
    world.update(0.05, { ...playerState, attack: true });
    const spikeReference = world.vm.edicts.findIndex((edict, reference) => (
        reference > world.playerReference && !edict.free &&
        world.vm.getEntityString(reference, 'model') === 'progs/spike.mdl' &&
        world.vm.getEntityWord(reference, 'owner') === player
    ));
    if (spikeReference < 0 || world.clientData().ammoNails !== 29) {
        throw new Error('QuakeC nailgun attack did not create progs/spike.mdl');
    }
    world.setPlayerPose(origin, angles);
    return { playerState, spikeReference };
};

export const prepareQuakeRocketCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeRocketCaptureState => {
    suppressCaptureTargets(world);
    // The native carrier's saved fixangle is packet-decoded once by the client,
    // then encoded again in its first user command before QuakeC sees it.
    const playerState = capturePlayerState(
        origin,
        angles.map(quakeProtocolAngle) as Vec3
    );
    world.setPlayerPose(origin, angles);
    const player = world.playerReference;
    const items = Math.trunc(world.vm.getEntityFloat(player, 'items'));
    world.vm.setEntityFloat(player, 'items', items | IT_ROCKET_LAUNCHER | IT_ROCKETS);
    world.vm.setEntityFloat(player, 'ammo_rockets', 30);
    for (let frame = 0; frame < QUAKE_PROJECTILE_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05, playerState);
    }

    world.vm.setEntityFloat(player, 'impulse', 7);
    world.update(0.05, playerState);
    if (world.clientData().activeWeapon !== IT_ROCKET_LAUNCHER ||
        world.clientData().weaponModel !== 'progs/v_rock2.mdl') {
        throw new Error('QuakeC did not switch the capture player to the rocket launcher');
    }

    world.update(0.05, { ...playerState, attack: true });
    const rocketReference = world.vm.edicts.findIndex((edict, reference) => (
        reference > world.playerReference && !edict.free &&
        world.vm.getEntityString(reference, 'model') === 'progs/missile.mdl' &&
        world.vm.getEntityWord(reference, 'owner') === player
    ));
    if (rocketReference < 0) {
        throw new Error('QuakeC rocket attack did not create progs/missile.mdl');
    }
    restoreProjectileCaptureServerPose(world, playerState);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    return { playerState, rocketReference };
};

export const prepareQuakeGrenadeCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeGrenadeCaptureState => {
    suppressCaptureTargets(world);
    const playerState = capturePlayerState(
        origin,
        angles.map(quakeProtocolAngle) as Vec3
    );
    world.setPlayerPose(origin, angles);
    const player = world.playerReference;
    const items = Math.trunc(world.vm.getEntityFloat(player, 'items'));
    world.vm.setEntityFloat(player, 'items', items | IT_GRENADE_LAUNCHER | IT_ROCKETS);
    world.vm.setEntityFloat(player, 'ammo_rockets', 30);
    for (let frame = 0; frame < QUAKE_PROJECTILE_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05, playerState);
    }

    world.vm.setEntityFloat(player, 'impulse', 6);
    world.update(0.05, playerState);
    if (world.clientData().activeWeapon !== IT_GRENADE_LAUNCHER ||
        world.clientData().weaponModel !== 'progs/v_rock.mdl') {
        throw new Error('QuakeC did not switch the capture player to the grenade launcher');
    }

    world.update(0.05, { ...playerState, attack: true });
    const grenadeReference = world.vm.edicts.findIndex((edict, reference) => (
        reference > world.playerReference && !edict.free &&
        world.vm.getEntityString(reference, 'model') === 'progs/grenade.mdl' &&
        world.vm.getEntityWord(reference, 'owner') === player
    ));
    if (grenadeReference < 0) {
        throw new Error('QuakeC grenade attack did not create progs/grenade.mdl');
    }
    restoreProjectileCaptureServerPose(world, playerState);
    world.clearConsole();
    world.centerMessage = '';
    world.centerMessageRemaining = 0;
    return { explosionEmitted: false, grenadeReference, playerState };
};

export const advanceQuakeGrenadeCapture = (
    world: QuakeWorldRuntime,
    capture: QuakeGrenadeCaptureState,
    phase?: QuakeGrenadeCapturePhase
): void => {
    world.update(0.05, capture.playerState);
    restoreProjectileCaptureServerPose(world, capture.playerState);
    if (world.particleEvents.some(
        event => event.kind === 'explosion' && event.count === 1_024
    )) {
        capture.explosionEmitted = true;
    }
    const model = world.vm.getEntityString(capture.grenadeReference, 'model');
    if ((phase === 'flight' || phase === 'bounce') && model !== 'progs/grenade.mdl') {
        throw new Error('Grenade capture did not preserve the in-flight grenade model');
    }
    if (phase === 'bounce' && !world.soundEvents.some(
        event => event.sample === 'weapons/bounce.wav'
    )) {
        throw new Error('Grenade capture did not reach the original bounce sound');
    }
    if (phase === 'explosion' && model !== 'progs/s_explod.spr') {
        throw new Error('Grenade capture did not reach the original explosion sprite');
    }
    if (phase === 'explosion' && !capture.explosionEmitted) {
        throw new Error('Grenade explosion did not create the original TE_EXPLOSION particles');
    }
};

export const advanceQuakeRocketCapture = (
    world: QuakeWorldRuntime,
    capture: QuakeRocketCaptureState,
    phase: 'flight' | 'impact'
): void => {
    world.update(0.05, capture.playerState);
    restoreProjectileCaptureServerPose(world, capture.playerState);
    const model = world.vm.getEntityString(capture.rocketReference, 'model');
    if (phase === 'flight' && model !== 'progs/missile.mdl') {
        throw new Error('Rocket capture did not preserve the in-flight missile frame');
    }
    if (phase === 'impact' && model !== 'progs/s_explod.spr') {
        throw new Error('Rocket capture did not reach the original explosion sprite');
    }
    if (phase === 'impact' && !world.particleEvents.some(
        event => event.kind === 'explosion' && event.count === 1_024
    )) {
        throw new Error('Rocket impact did not create the original TE_EXPLOSION particles');
    }
};

export const advanceQuakeNailgunCapture = (
    world: QuakeWorldRuntime,
    capture: QuakeNailgunCaptureState
): void => {
    world.update(0.05, capture.playerState);
    world.setPlayerPose(capture.playerState.origin, capture.playerState.angles);
    if (world.vm.entity(capture.spikeReference).free ||
        world.vm.getEntityString(capture.spikeReference, 'model') !== 'progs/spike.mdl') {
        throw new Error('Nailgun capture did not preserve the in-flight spike model');
    }
};

export const prepareQuakeSoldierDeathCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeSoldierDeathCaptureState => {
    suppressCaptureTargets(world);
    world.setPlayerPose(origin, angles);
    const playerState = capturePlayerState(origin, angles);
    for (let frame = 0; frame < QUAKE_WEAPON_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    const soldierReference = world.entityReferences.find((reference, index) => (
        world.map.entities[index].classname === 'monster_army' && reference !== null &&
        !world.vm.entity(reference).free &&
        world.vm.getEntityString(reference, 'model') === 'progs/soldier.mdl'
    ));
    if (soldierReference === null || soldierReference === undefined) {
        throw new Error('E1M1 soldier death capture requires an active monster_army');
    }
    const yaw = angles[1] * Math.PI / 180;
    const targetOrigin: Vec3 = [
        origin[0] + Math.cos(yaw) * 96,
        origin[1] + Math.sin(yaw) * 96,
        origin[2]
    ];
    world.setEntityOrigin(soldierReference, targetOrigin);
    world.vm.setEntityVector(soldierReference, 'oldorigin', targetOrigin);
    world.vm.setEntityVector(soldierReference, 'velocity', [0, 0, 0]);
    const facingYaw = quakeProtocolAngle(angles[1] + 180);
    world.vm.setEntityVector(soldierReference, 'angles', [0, facingYaw, 0]);
    world.vm.setEntityFloat(soldierReference, 'ideal_yaw', facingYaw);
    world.vm.setEntityFloat(soldierReference, 'health', 1);
    world.vm.setEntityFloat(soldierReference, 'pausetime', 100_000_000);
    world.vm.setEntityWord(soldierReference, 'enemy', 0);
    world.advanceGameplayRandom(QUAKE_NATIVE_DEATH_CAPTURE_RANDOM_ADVANCES);
    world.update(0.05, { ...playerState, attack: true });
    world.setPlayerPose(origin, angles);
    const deathThinkIndex = world.vm.getEntityWord(soldierReference, 'think');
    const deathThink = world.vm.program.functions[deathThinkIndex].name;
    if (world.vm.getEntityFloat(soldierReference, 'health') > 0 ||
        world.vm.getEntityFloat(soldierReference, 'health') <= -35 ||
        world.vm.getEntityFloat(soldierReference, 'takedamage') !== 0 ||
        !/^army_c?die\d+$/.test(deathThink)) {
        throw new Error('Starting shotgun did not enter the ordinary soldier death sequence');
    }
    return { playerState, soldierReference };
};

export const prepareQuakeAxeHitCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeAxeHitCaptureState => {
    suppressCaptureTargets(world);
    const player = world.playerReference;
    const playerState = capturePlayerState(origin, angles);
    world.setPlayerPose(origin, angles);
    for (let frame = 0; frame < QUAKE_WEAPON_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    const soldierReference = world.entityReferences.find((reference, index) => (
        world.map.entities[index].classname === 'monster_army' && reference !== null &&
        !world.vm.entity(reference).free &&
        world.vm.getEntityString(reference, 'model') === 'progs/soldier.mdl'
    ));
    if (soldierReference === null || soldierReference === undefined) {
        throw new Error('E1M1 axe capture requires an active monster_army');
    }
    const yaw = angles[1] * Math.PI / 180;
    const targetOrigin: Vec3 = [
        origin[0] + Math.cos(yaw) * 48,
        origin[1] + Math.sin(yaw) * 48,
        origin[2]
    ];
    world.setEntityOrigin(soldierReference, targetOrigin);
    world.vm.setEntityVector(soldierReference, 'oldorigin', targetOrigin);
    world.vm.setEntityVector(soldierReference, 'velocity', [0, 0, 0]);
    const facingYaw = quakeProtocolAngle(angles[1] + 180);
    world.vm.setEntityVector(soldierReference, 'angles', [0, facingYaw, 0]);
    world.vm.setEntityFloat(soldierReference, 'ideal_yaw', facingYaw);
    world.vm.setEntityFloat(soldierReference, 'health', 100);
    world.vm.setEntityFloat(soldierReference, 'pausetime', 100_000_000);
    world.vm.setEntityWord(soldierReference, 'enemy', 0);
    world.advanceGameplayRandom(QUAKE_NATIVE_DEATH_CAPTURE_RANDOM_ADVANCES);
    world.clearConsole();
    world.clearSoundEvents();
    world.setPlayerImpulse(1);
    world.update(0.05, playerState);
    const axeClientData = world.clientData();
    if ((axeClientData.items & IT_AXE) === 0 || axeClientData.activeWeapon !== 0 ||
        axeClientData.weaponModel !== 'progs/v_axe.mdl') {
        throw new Error(
            `QuakeC did not switch the capture player to the axe: ${JSON.stringify(
                axeClientData
            )}`
        );
    }
    const initialHealth = world.vm.getEntityFloat(soldierReference, 'health');
    world.update(0.05, { ...playerState, attack: true });
    for (let frame = 0; frame < 4; frame++) world.update(0.05, playerState);
    world.setPlayerPose(origin, angles);
    const finalHealth = world.vm.getEntityFloat(soldierReference, 'health');
    if (finalHealth !== initialHealth - 20 ||
        !world.particleEvents.some(event => event.color === 73 && event.count === 40) ||
        !world.soundEvents.some(event => event.sample === 'weapons/ax1.wav') ||
        !world.soundEvents.some(event => /^soldier\/pain[12]\.wav$/u.test(event.sample))) {
        throw new Error(
            `Original W_FireAxe did not damage the E1M1 soldier: ${JSON.stringify({
                finalHealth,
                particleEvents: world.particleEvents,
                playerThink: world.vm.program.functions[
                world.vm.getEntityWord(player, 'think')
                ]?.name,
                sounds: world.soundEvents.map(event => event.sample),
                time: world.time,
                weaponFrame: world.clientData().weaponFrame
            })}`
        );
    }
    return { initialHealth, playerState, soldierReference };
};

export const prepareQuakeShootableTriggerDoorCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeShootableTriggerDoorCaptureState => {
    suppressCaptureTargets(world);
    const triggerIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'trigger_multiple' && entity.target === 't4' &&
        entity.health === '1'
    ));
    const doorIndex = world.map.entities.findIndex(entity => (
        entity.classname === 'func_door' && entity.targetname === 't4'
    ));
    const triggerReference = world.entityReferences[triggerIndex];
    const doorReference = world.entityReferences[doorIndex];
    if (triggerReference === null || triggerReference === undefined ||
        doorReference === null || doorReference === undefined) {
        throw new Error('E1M1 shootable-trigger capture requires the authored t4 chain');
    }
    const playerState = capturePlayerState(origin, angles);
    world.setPlayerPose(origin, angles);
    for (let frame = 0; frame < QUAKE_WEAPON_CAPTURE_WARMUP_FRAMES; frame++) {
        world.update(0.05, playerState);
    }
    world.setPlayerPose(origin, angles);
    const initialDoorOrigin = world.vm.getEntityVector(doorReference, 'origin');
    world.setPlayerImpulse(1);
    world.update(0.05, playerState);
    if (world.clientData().weaponModel !== 'progs/v_axe.mdl') {
        throw new Error('QuakeC did not select the axe for the t4 trigger capture');
    }
    world.clearConsole();
    world.clearSoundEvents();
    world.update(0.05, { ...playerState, attack: true });
    for (let frame = 0; frame < 4; frame++) world.update(0.05, playerState);
    world.setPlayerPose(origin, angles);
    if (world.vm.getEntityFloat(triggerReference, 'health') > 0 ||
        world.vm.getEntityFloat(triggerReference, 'takedamage') !== 0 ||
        world.vm.getEntityFloat(doorReference, 'state') !== 2 ||
        world.vm.getEntityVector(doorReference, 'origin').every(
            (component, axis) => component === initialDoorOrigin[axis]
        ) || !world.soundEvents.some(event => event.sample === 'weapons/ax1.wav') ||
        !world.soundEvents.some(event => (
            event.entity === doorReference &&
            event.sample === world.vm.getEntityString(doorReference, 'noise2')
        ))) {
        throw new Error('Original axe damage did not activate E1M1\'s t4 door');
    }
    return { doorReference, initialDoorOrigin, playerState, triggerReference };
};

export const advanceQuakeSoldierDeathCapture = (
    world: QuakeWorldRuntime,
    capture: QuakeSoldierDeathCaptureState
): void => {
    world.update(0.05, capture.playerState);
    world.setPlayerPose(capture.playerState.origin, capture.playerState.angles);
    if (world.vm.entity(capture.soldierReference).free ||
        world.vm.getEntityString(capture.soldierReference, 'model') !==
            'progs/soldier.mdl' ||
        world.vm.getEntityFloat(capture.soldierReference, 'takedamage') !== 0) {
        throw new Error('Soldier death capture did not preserve the ordinary corpse');
    }
};

export const prepareQuakeSoldierGibCapture = (
    world: QuakeWorldRuntime,
    origin: Vec3,
    angles: Vec3
): QuakeSoldierGibCaptureState => {
    const rocket = prepareQuakeRocketCapture(world, origin, angles);
    const soldierReference = world.entityReferences.find((reference, index) => (
        world.map.entities[index].classname === 'monster_army' && reference !== null &&
        !world.vm.entity(reference).free &&
        world.vm.getEntityString(reference, 'model') === 'progs/soldier.mdl'
    ));
    if (soldierReference === null || soldierReference === undefined) {
        throw new Error('E1M1 soldier gib capture requires an active monster_army');
    }
    const yaw = angles[1] * Math.PI / 180;
    const targetOrigin: Vec3 = [
        origin[0] + Math.cos(yaw) * 200,
        origin[1] + Math.sin(yaw) * 200,
        origin[2]
    ];
    world.setEntityOrigin(soldierReference, targetOrigin);
    world.vm.setEntityVector(soldierReference, 'oldorigin', targetOrigin);
    world.vm.setEntityVector(soldierReference, 'velocity', [0, 0, 0]);
    const facingYaw = (angles[1] + 180) % 360;
    world.vm.setEntityVector(soldierReference, 'angles', [0, facingYaw, 0]);
    world.vm.setEntityFloat(soldierReference, 'ideal_yaw', facingYaw);
    world.vm.setEntityFloat(soldierReference, 'pausetime', 100_000_000);
    world.vm.setEntityWord(soldierReference, 'enemy', 0);
    return {
        ...rocket,
        gibOrigins: [],
        gibReferences: [],
        soldierReference
    };
};

export const advanceQuakeSoldierGibCapture = (
    world: QuakeWorldRuntime,
    capture: QuakeSoldierGibCaptureState,
    phase?: QuakeSoldierGibCapturePhase
): void => {
    world.update(0.05, capture.playerState);
    restoreProjectileCaptureServerPose(world, capture.playerState);
    const activeGibs = world.vm.edicts.flatMap((edict, reference) => {
        if (edict.free) return [];
        const model = world.vm.getEntityString(reference, 'model');
        return QUAKE_SOLDIER_GIB_MODELS.includes(
            model as typeof QUAKE_SOLDIER_GIB_MODELS[number]
        ) ? [reference] : [];
    });
    if (capture.gibReferences.length === 0 && activeGibs.length === 4) {
        capture.gibReferences.push(...activeGibs);
        capture.gibOrigins.push(...activeGibs.map(
            reference => world.vm.getEntityVector(reference, 'origin')
        ));
    }
    if (!phase) return;
    if (world.vm.getEntityString(capture.rocketReference, 'model') !==
        'progs/s_explod.spr') {
        throw new Error('Soldier gib capture did not reach the rocket explosion');
    }
    if (world.vm.getEntityFloat(capture.soldierReference, 'health') >= -35 ||
        world.vm.getEntityFloat(capture.soldierReference, 'takedamage') !== 0) {
        throw new Error('Original rocket damage did not gib the E1M1 soldier');
    }
    if (capture.gibReferences.length !== QUAKE_SOLDIER_GIB_MODELS.length) {
        throw new Error('Soldier gib capture did not spawn the head and three gib models');
    }
    if (phase === 'impact' && !world.particleEvents.some(
        event => event.kind === 'explosion' && event.count === 1_024
    )) {
        throw new Error('Soldier gib impact did not create TE_EXPLOSION particles');
    }
    if (phase === 'trail' && capture.gibReferences.every((reference, index) => (
        world.vm.getEntityVector(reference, 'origin').every(
            (component, axis) => component === capture.gibOrigins[index][axis]
        )
    ))) {
        throw new Error('Soldier gib trail capture did not advance the gib entities');
    }
};

export const setQuakePaletteCaptureTime = (
    world: QuakeWorldRuntime,
    mode: QuakePaletteCaptureMode,
    time: number
): void => {
    world.setSnapshotTime(time);
    if (mode === 'quad' || mode === 'invulnerability') {
        const light = world.dynamicLights.get(world.playerReference);
        if (!light) {
            throw new Error(`${mode} palette capture requires the player dynamic light`);
        }
        light.die = time + 0.001;
    }
};
