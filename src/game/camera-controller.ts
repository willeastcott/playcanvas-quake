import { Vec3, type AppBase, type Entity } from 'playcanvas';

import { WorldCollision, type HullTrace } from './collision';
import { quakeAngleMod, quakeHostFrameTime } from './quake-math';
import {
    quakeProtocolAngle,
    quakeProtocolCoordinate,
    quakeProtocolMessageNumber
} from './quake-protocol';
import type {
    QuakePlayerMovementTrace,
    QuakePlayerResult,
    QuakePlayerState
} from './quake-world';
import { CONTENTS, type BspMap, type Vec3 as QuakeVector } from '../formats/bsp';
import { parseVector } from '../formats/entities';
import { quakeToPlayCanvas } from '../render/world-renderer';

const MAX_SPEED = 320;
const ACCELERATE = 10;
const FRICTION = 4;
const EDGE_FRICTION = 2;
const STOP_SPEED = 100;
const JUMP_SPEED = 270;
const STEP_SIZE = 18;
const VIEW_HEIGHT = 22;
const MAX_CLIP_PLANES = 5;
const SOLID_BSP = 4;
const MOVETYPE_NONE = 0;
const MOVETYPE_WALK = 3;
const MOVETYPE_FLY = 5;
const MOVETYPE_TOSS = 6;
const MOVETYPE_NOCLIP = 8;
const MOVETYPE_BOUNCE = 10;

const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value));

const dot = (left: QuakeVector, right: QuakeVector): number => left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

export const calculateQuakeViewBob = (
    horizontalSpeed: number,
    time: number,
    bobAmount = 0.02,
    bobCycle = 0.6,
    bobUp = 0.5
): number => {
    let cycle = (time % bobCycle) / bobCycle;
    cycle = cycle < bobUp ?
        Math.PI * cycle / bobUp : Math.PI + Math.PI * (cycle - bobUp) / (1 - bobUp);
    const bob = horizontalSpeed * bobAmount;
    return clamp(bob * 0.3 + bob * 0.7 * Math.sin(cycle), -7, 4);
};

export const quakeClientVelocityComponent = (velocity: number): number => {
    return quakeProtocolMessageNumber('char', velocity / 16) * 16;
};

export const quakeTossAngles = (
    angles: QuakeVector,
    angularVelocity: QuakeVector,
    frameTime: number
): QuakeVector => angles.map(
    (component, axis) => component + angularVelocity[axis] * frameTime
) as QuakeVector;

export const quakeWaterJumpVelocity = (
    velocity: QuakeVector,
    direction: QuakeVector
): QuakeVector => [direction[0], direction[1], velocity[2]];

export const quakeUnstuckOrigin = (
    origin: QuakeVector,
    oldOrigin: QuakeVector,
    blocked: (candidate: QuakeVector) => boolean
): { oldOrigin: QuakeVector; origin: QuakeVector } => {
    if (!blocked(origin)) {
        return { oldOrigin: [...origin], origin: [...origin] };
    }
    if (!blocked(oldOrigin)) {
        return { oldOrigin: [...oldOrigin], origin: [...oldOrigin] };
    }
    for (let z = 0; z < 18; z++) {
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                const candidate: QuakeVector = [
                    origin[0] + x, origin[1] + y, origin[2] + z
                ];
                if (!blocked(candidate)) {
                    return { oldOrigin: [...oldOrigin], origin: candidate };
                }
            }
        }
    }
    return { oldOrigin: [...oldOrigin], origin: [...origin] };
};

export const calculateQuakeViewRoll = (
    yaw: number,
    velocity: QuakeVector,
    rollAngle = 2,
    rollSpeed = 200
): number => {
    const yawRadians = yaw * Math.PI / 180;
    const right: QuakeVector = [Math.sin(yawRadians), -Math.cos(yawRadians), 0];
    const side = dot(velocity, right);
    const magnitude = Math.abs(side);
    return (side < 0 ? -1 : 1) * (
        magnitude < rollSpeed ? magnitude * rollAngle / rollSpeed : rollAngle
    );
};

export interface QuakeIdleViewCvars {
    pitchCycle?: number;
    pitchLevel?: number;
    rollCycle?: number;
    rollLevel?: number;
    scale?: number;
    yawCycle?: number;
    yawLevel?: number;
}

export const quakeIdleViewAngles = (
    angles: QuakeVector,
    time: number,
    {
        pitchCycle = 1,
        pitchLevel = 0.3,
        rollCycle = 0.5,
        rollLevel = 0.1,
        scale = 0,
        yawCycle = 2,
        yawLevel = 0.3
    }: QuakeIdleViewCvars = {}
): QuakeVector => [
    angles[0] + scale * Math.sin(time * pitchCycle) * pitchLevel,
    angles[1] + scale * Math.sin(time * yawCycle) * yawLevel,
    angles[2] + scale * Math.sin(time * rollCycle) * rollLevel
];

export const quakeIntermissionIdleAngles = (
    angles: QuakeVector,
    time: number,
    cvars: Omit<QuakeIdleViewCvars, 'scale'> = {}
): QuakeVector => quakeIdleViewAngles(angles, time, { ...cvars, scale: 1 });

export const quakeViewModelAngles = (
    viewAngles: QuakeVector,
    damagePitch: number,
    time: number,
    cvars: QuakeIdleViewCvars = {}
): QuakeVector => {
    const idle = quakeIdleViewAngles([0, 0, 0], time, cvars);
    const referencePitch = viewAngles[0] + damagePitch + idle[0];
    const referenceYaw = viewAngles[1] + idle[1];
    // WinQuake's CalcGunAngle lag deltas cancel to zero; these idle terms and
    // the alias-model pitch convention are the observable remainder.
    return [
        -referencePitch - idle[0],
        referenceYaw - idle[1],
        viewAngles[2] - idle[2]
    ];
};

export const quakeScreenViewOffset = (
    angles: QuakeVector,
    offsets: QuakeVector
): QuakeVector => {
    const pitch = angles[0] * Math.PI / 180;
    const yaw = angles[1] * Math.PI / 180;
    const roll = angles[2] * Math.PI / 180;
    const sinePitch = Math.sin(pitch);
    const cosinePitch = Math.cos(pitch);
    const sineYaw = Math.sin(yaw);
    const cosineYaw = Math.cos(yaw);
    const sineRoll = Math.sin(roll);
    const cosineRoll = Math.cos(roll);
    const forward: QuakeVector = [
        cosinePitch * cosineYaw,
        cosinePitch * sineYaw,
        -sinePitch
    ];
    const right: QuakeVector = [
        -sineRoll * sinePitch * cosineYaw + cosineRoll * sineYaw,
        -sineRoll * sinePitch * sineYaw - cosineRoll * cosineYaw,
        -sineRoll * cosinePitch
    ];
    const up: QuakeVector = [
        cosineRoll * sinePitch * cosineYaw + sineRoll * sineYaw,
        cosineRoll * sinePitch * sineYaw - sineRoll * cosineYaw,
        cosineRoll * cosinePitch
    ];
    return forward.map((component, axis) => (
        component * offsets[0] + right[axis] * offsets[1] + up[axis] * offsets[2]
    )) as QuakeVector;
};

export const quakeBoundViewOrigin = (
    viewOrigin: QuakeVector,
    playerOrigin: QuakeVector
): QuakeVector => [
    clamp(viewOrigin[0], playerOrigin[0] - 14, playerOrigin[0] + 14),
    clamp(viewOrigin[1], playerOrigin[1] - 14, playerOrigin[1] + 14),
    clamp(viewOrigin[2], playerOrigin[2] - 22, playerOrigin[2] + 30)
];

export const quakeMouseAngleDelta = (
    movement: number,
    sensitivity: number,
    scale = 0.022
): number => movement * sensitivity * scale;

export const quakeMouseSideMove = (
    movement: number,
    sensitivity: number,
    scale = 0.8
): number => (
    movement * sensitivity * scale
);

export const quakeMouseForwardMove = (
    movement: number,
    sensitivity: number,
    scale = 1
): number => movement * sensitivity * scale;

export const quakeFilteredMouseDelta = (
    current: number,
    previous: number,
    filter: number
): number => (filter !== 0 ? (current + previous) * 0.5 : current);

export const quakeMouseVerticalInput = (
    movement: number,
    sensitivity: number,
    pitchScale: number,
    forwardScale: number,
    mouseLookActive: boolean,
    strafeActive: boolean,
    noclipAngleHack = false
): { forwardMove: number; pitchDelta: number; upMove: number } => {
    if (mouseLookActive && !strafeActive) {
        return {
            forwardMove: 0,
            pitchDelta: quakeMouseAngleDelta(movement, sensitivity, pitchScale),
            upMove: 0
        };
    }
    const move = -quakeMouseForwardMove(movement, sensitivity, forwardScale);
    return {
        forwardMove: strafeActive && noclipAngleHack ? 0 : move,
        pitchDelta: 0,
        upMove: strafeActive && noclipAngleHack ? move : 0
    };
};

export const quakeMouseStrafes = (
    strafeActive: boolean,
    lookStrafe: number,
    mouseLookActive: boolean
): boolean => strafeActive || (lookStrafe !== 0 && mouseLookActive);

export const quakeButtonFrameValue = (
    down: boolean,
    pressed: boolean,
    released: boolean
): number => (
    pressed && released ? (down ? 0.75 : 0.25) :
        (pressed ? (down ? 0.5 : 0) : down ? 1 : 0)
);

export const quakeClampedPitch = (pitch: number): number => clamp(pitch, -70, 80);

export interface QuakePitchDriftState {
    driftMove: number;
    lastStop: number;
    noDrift: boolean;
    pitch: number;
    pitchVelocity: number;
}

export const quakePitchDriftStep = (
    state: QuakePitchDriftState,
    idealPitch: number,
    frameTime: number,
    time: number,
    onGround: boolean,
    mouseLookActive: boolean,
    fullForwardMove: boolean,
    centerMove = 0.15,
    centerSpeed = 500
): QuakePitchDriftState => {
    if (mouseLookActive) {
        return {
            ...state,
            driftMove: 0,
            lastStop: time,
            noDrift: true,
            pitchVelocity: 0
        };
    }
    if (!onGround) {
        return { ...state, driftMove: 0, pitchVelocity: 0 };
    }
    if (state.noDrift) {
        const driftMove = fullForwardMove ? state.driftMove + frameTime : 0;
        if (driftMove <= centerMove || state.lastStop === time) {
            return { ...state, driftMove };
        }
        return {
            ...state,
            driftMove: 0,
            noDrift: false,
            pitchVelocity: centerSpeed
        };
    }

    const delta = idealPitch - state.pitch;
    if (delta === 0) {
        return { ...state, pitchVelocity: 0 };
    }
    const move = frameTime * state.pitchVelocity;
    const appliedMove = Math.min(Math.abs(delta), move) * Math.sign(delta);
    return {
        ...state,
        pitch: quakeClampedPitch(state.pitch + appliedMove),
        pitchVelocity: Math.abs(appliedMove) === Math.abs(delta) ? 0 :
            state.pitchVelocity + frameTime * centerSpeed
    };
};

export const quakeGroundFrictionScale = (
    horizontalSpeed: number,
    frameTime: number,
    overEdge: boolean,
    frictionValue = FRICTION,
    edgeFrictionValue = EDGE_FRICTION,
    stopSpeed = STOP_SPEED
): number => {
    if (horizontalSpeed === 0) return 1;
    const control = horizontalSpeed < stopSpeed ? stopSpeed : horizontalSpeed;
    const friction = frictionValue * (overEdge ? edgeFrictionValue : 1);
    return Math.max(0, horizontalSpeed - frameTime * control * friction) / horizontalSpeed;
};

export const quakeWaterUpMove = (
    hasHorizontalMovement: boolean,
    swimUp: boolean,
    swimDown: boolean
): number => {
    const upMove = (swimUp ? 200 : 0) - (swimDown ? 200 : 0);
    return hasHorizontalMovement || upMove !== 0 ? upMove : -60;
};

export const quakeSwimmingJumpSpeed = (waterType: number): number => (
    waterType === CONTENTS.WATER ? 100 : waterType === CONTENTS.SLIME ? 80 : 50
);

export const quakeWallFrictionVelocity = (
    pitch: number,
    yaw: number,
    velocity: QuakeVector,
    normal: QuakeVector
): QuakeVector => {
    const pitchRadians = pitch * Math.PI / 180;
    const yawRadians = yaw * Math.PI / 180;
    const forward: QuakeVector = [
        Math.cos(pitchRadians) * Math.cos(yawRadians),
        Math.cos(pitchRadians) * Math.sin(yawRadians),
        -Math.sin(pitchRadians)
    ];
    const friction = dot(normal, forward) + 0.5;
    if (friction >= 0) {
        return [...velocity];
    }
    const intoSpeed = dot(normal, velocity);
    const side = velocity.map(
        (component, axis) => component - normal[axis] * intoSpeed
    ) as QuakeVector;
    return [side[0] * (1 + friction), side[1] * (1 + friction), velocity[2]];
};

export const quakeServerWallFrictionVelocity = (
    viewAngles: QuakeVector,
    velocity: QuakeVector,
    normal: QuakeVector
): QuakeVector => quakeWallFrictionVelocity(
    quakeProtocolAngle(viewAngles[0]),
    quakeProtocolAngle(viewAngles[1]),
    velocity,
    normal
);

const length = (vector: QuakeVector): number => Math.hypot(...vector);

const normalize = (vector: QuakeVector): { direction: QuakeVector; magnitude: number } => {
    const magnitude = length(vector);
    return {
        direction: magnitude > 0 ? vector.map(component => component / magnitude) as QuakeVector : [0, 0, 0],
        magnitude
    };
};

export interface QuakeAirWishVelocity {
    direction: QuakeVector;
    speed: number;
    velocity: QuakeVector;
}

export const quakeClientEntityAngles = (
    viewAngles: QuakeVector,
    punchAngles: QuakeVector,
    movementRoll: number
): QuakeVector => [
    -(viewAngles[0] + punchAngles[0]) / 3,
    viewAngles[1] + punchAngles[1],
    movementRoll
];

export const quakeAirWishVelocity = (
    entityAngles: QuakeVector,
    forwardMove: number,
    sideMove: number,
    upMove: number,
    walking: boolean,
    maximumSpeed: number
): QuakeAirWishVelocity => {
    const pitch = entityAngles[0] * Math.PI / 180;
    const yaw = entityAngles[1] * Math.PI / 180;
    const roll = entityAngles[2] * Math.PI / 180;
    const sinePitch = Math.sin(pitch);
    const cosinePitch = Math.cos(pitch);
    const sineYaw = Math.sin(yaw);
    const cosineYaw = Math.cos(yaw);
    const sineRoll = Math.sin(roll);
    const cosineRoll = Math.cos(roll);
    const forward: QuakeVector = [
        cosinePitch * cosineYaw,
        cosinePitch * sineYaw,
        -sinePitch
    ];
    const right: QuakeVector = [
        -sineRoll * sinePitch * cosineYaw + cosineRoll * sineYaw,
        -sineRoll * sinePitch * sineYaw - cosineRoll * cosineYaw,
        -sineRoll * cosinePitch
    ];
    let velocity = forward.map(
        (component, axis) => component * forwardMove + right[axis] * sideMove
    ) as QuakeVector;
    velocity[2] = walking ? 0 : upMove;
    let speed = length(velocity);
    if (speed > maximumSpeed) {
        velocity = velocity.map(
            component => component * maximumSpeed / speed
        ) as QuakeVector;
        speed = maximumSpeed;
    }
    return {
        direction: normalize(velocity).direction,
        speed,
        velocity
    };
};

const cross = (left: QuakeVector, right: QuakeVector): QuakeVector => [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0]
];

const clipVelocity = (
    velocity: QuakeVector,
    normal: QuakeVector,
    overbounce = 1
): QuakeVector => {
    const backoff = dot(velocity, normal) * overbounce;
    return velocity.map((component, axis) => {
        const output = component - normal[axis] * backoff;
        return Math.abs(output) < 0.1 ? 0 : output;
    }) as QuakeVector;
};

interface SlideResult {
    blocked: number;
    wallTrace?: HullTrace;
}

export class CameraController {
    readonly app: AppBase;
    map: BspMap;
    readonly entity: Entity;
    collision: WorldCollision;
    readonly activeButtonSources = new Map<string, Set<string>>();
    readonly buttonFrameValues = new Map<string, number>();
    readonly buttonPressEdges = new Set<string>();
    readonly buttonReleaseEdges = new Set<string>();
    readonly touchedBrushModelIndices = new Set<number>();
    readonly touchedEntityReferences = new Set<number>();
    origin: QuakeVector = [0, 0, 0];
    velocity: QuakeVector = [0, 0, 0];
    angularVelocity: QuakeVector = [0, 0, 0];
    entityAngles: QuakeVector = [0, 0, 0];
    eyeOrigin: QuakeVector = [0, 0, 0];
    yaw = 0;
    pitch = 0;
    viewRoll = 0;
    idealPitch = 0;
    onGround = false;
    oldOrigin: QuakeVector = [0, 0, 0];
    groundModelIndex: number | undefined;
    damageKickPitch = 0;
    damageKickRoll = 0;
    dead = false;
    punchAngle: QuakeVector = [0, 0, 0];
    stairZ = 0;
    cameraElapsed = 0;
    bobAmount = 0.02;
    bobCycle = 0.6;
    bobUp = 0.5;
    rollAngle = 2;
    rollSpeed = 200;
    idleScale = 0;
    idleYawCycle = 2;
    idleRollCycle = 0.5;
    idlePitchCycle = 1;
    idleYawLevel = 0.3;
    idleRollLevel = 0.1;
    idlePitchLevel = 0.3;
    kickTime = 0.5;
    kickRoll = 0.6;
    kickPitch = 0.6;
    screenOffset: QuakeVector = [0, 0, 0];
    renderedScreenOffset: QuakeVector = [0, 0, 0];
    jumpReleased = true;
    jumped = false;
    attack = false;
    backwardMoveBlocked = false;
    elapsed = 0;
    angleSpeedKey = 1.5;
    backSpeed = 200;
    centerMove = 0.15;
    centerSpeed = 500;
    forwardSpeed = 200;
    lookSpring = 0;
    lookStrafe = 0;
    mouseFilter = 0;
    mousePitch = 0.022;
    mouseForward = 1;
    mouseForwardMove = 0;
    mouseOldX = 0;
    mouseOldY = 0;
    mousePendingX = 0;
    mousePendingY = 0;
    mouseSide = 0.8;
    mouseUpMove = 0;
    mouseYaw = 0.022;
    moveSpeedKey = 2;
    pitchSpeed = 150;
    sideSpeed = 350;
    upSpeed = 200;
    yawSpeed = 140;
    acceleration = ACCELERATE;
    edgeFriction = EDGE_FRICTION;
    friction = FRICTION;
    gravity = 800;
    maxSpeed = MAX_SPEED;
    maxVelocity = 2_000;
    mouseSideMove = 0;
    mouseLookActive = false;
    moveType = MOVETYPE_WALK;
    noclipAngleHack = false;
    noStep = false;
    sensitivity = 3;
    serverDrivenJump = false;
    stopSpeed = STOP_SPEED;
    viewHeight = VIEW_HEIGHT;
    waterJump = false;
    waterJumpDirection: QuakeVector = [0, 0, 0];
    waterJumpTime = 0;
    movementTrace?: (start: QuakeVector, end: QuakeVector) => QuakePlayerMovementTrace;
    pointTrace?: (start: QuakeVector, end: QuakeVector) => HullTrace;
    pointerLockAllowed = (): boolean => true;
    private preparedFrameTime = 0;
    private framePrepared = false;
    private pitchDrift: QuakePitchDriftState = {
        driftMove: 0,
        lastStop: 0,
        noDrift: false,
        pitch: 0,
        pitchVelocity: 0
    };

    constructor(app: AppBase, map: BspMap, entity: Entity) {
        this.app = app;
        this.map = map;
        this.entity = entity;
        this.collision = new WorldCollision(map);
        this.spawn();
        this.bindInput();
    }

    replaceMap(map: BspMap, collision = new WorldCollision(map)): void {
        this.map = map;
        this.collision = collision;
        this.touchedBrushModelIndices.clear();
        this.touchedEntityReferences.clear();
    }

    set alwaysRun(value: boolean) {
        this.forwardSpeed = value ? 400 : 200;
        this.backSpeed = this.forwardSpeed;
    }

    get alwaysRun(): boolean {
        return this.forwardSpeed > 200;
    }

    set invertMouse(value: boolean) {
        if (value !== this.invertMouse) this.mousePitch = -this.mousePitch;
    }

    get invertMouse(): boolean {
        return this.mousePitch < 0;
    }

    private spawn(): void {
        const spawn = this.map.entities.find(candidate => candidate.classname === 'info_player_start');
        if (!spawn) {
            throw new Error('Map has no info_player_start entity');
        }
        this.origin = parseVector(spawn.origin);
        this.oldOrigin = [...this.origin];
        this.stairZ = this.origin[2];
        this.yaw = Number(spawn.angle ?? 0);
        this.entityAngles[1] = this.yaw;
        this.updateCamera();
    }

    private bindInput(): void {
        const canvas = this.app.graphicsDevice.canvas;
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new Error('Quake input requires an HTML canvas');
        }
        canvas.addEventListener('click', () => {
            if (this.pointerLockAllowed()) canvas.requestPointerLock();
        });
        document.addEventListener('pointerlockchange', () => {
            const mouseLookActive = document.pointerLockElement === canvas;
            if (this.mouseLookActive && !mouseLookActive && this.lookSpring !== 0) {
                this.startPitchDrift(true);
            }
            this.mouseLookActive = mouseLookActive;
        });
        window.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement !== canvas) {
                return;
            }
            this.mousePendingX += event.movementX;
            this.mousePendingY += event.movementY;
        });
    }

    private processMouseInput(): void {
        if (!this.mouseLookActive) return;
        const mouseX = quakeFilteredMouseDelta(
            this.mousePendingX, this.mouseOldX, this.mouseFilter
        );
        const mouseY = quakeFilteredMouseDelta(
            this.mousePendingY, this.mouseOldY, this.mouseFilter
        );
        this.mouseOldX = this.mousePendingX;
        this.mouseOldY = this.mousePendingY;
        this.mousePendingX = 0;
        this.mousePendingY = 0;
        const strafeActive = this.buttonDown('+strafe');
        if (quakeMouseStrafes(strafeActive, this.lookStrafe, this.mouseLookActive)) {
            this.mouseSideMove += quakeMouseSideMove(
                mouseX, this.sensitivity, this.mouseSide
            );
        } else {
            this.yaw -= quakeMouseAngleDelta(mouseX, this.sensitivity, this.mouseYaw);
        }
        const vertical = quakeMouseVerticalInput(
            mouseY,
            this.sensitivity,
            this.mousePitch,
            this.mouseForward,
            this.mouseLookActive,
            strafeActive,
            this.noclipAngleHack
        );
        this.pitch = quakeClampedPitch(this.pitch + vertical.pitchDelta);
        this.mouseForwardMove += vertical.forwardMove;
        this.mouseUpMove += vertical.upMove;
    }

    setButtonState(command: string, source: string, down: boolean): void {
        let sources = this.activeButtonSources.get(command);
        const wasDown = (sources?.size ?? 0) > 0;
        if (down) {
            if (!sources) {
                sources = new Set();
                this.activeButtonSources.set(command, sources);
            }
            sources.add(source);
        } else if (sources) {
            sources.delete(source);
            if (sources.size === 0) this.activeButtonSources.delete(command);
        }
        const isDown = this.buttonDown(command);
        if (!wasDown && isDown) this.buttonPressEdges.add(command);
        if (wasDown && !isDown) this.buttonReleaseEdges.add(command);
        if (command === '+mlook' && wasDown && !isDown && this.lookSpring !== 0) {
            this.startPitchDrift(true);
        }
    }

    sampleInputButtons(): void {
        this.sampleButtonStates();
    }

    private buttonDown(command: string): boolean {
        return (this.activeButtonSources.get(command)?.size ?? 0) > 0;
    }

    private buttonValue(command: string): number {
        return this.buttonFrameValues.get(command) ?? (
            this.buttonDown(command) || this.buttonPressEdges.has(command) ? 1 : 0
        );
    }

    private sampleButtonStates(): void {
        const commands = new Set([
            ...this.activeButtonSources.keys(),
            ...this.buttonFrameValues.keys(),
            ...this.buttonPressEdges,
            ...this.buttonReleaseEdges
        ]);
        for (const command of commands) {
            const down = this.buttonDown(command);
            const pressed = this.buttonPressEdges.has(command);
            const released = this.buttonReleaseEdges.has(command);
            this.buttonFrameValues.set(
                command, quakeButtonFrameValue(down, pressed, released)
            );
        }
        this.buttonPressEdges.clear();
        this.buttonReleaseEdges.clear();
        this.attack = this.buttonValue('+attack') > 0;
    }

    private adjustKeyboardAngles(frameTime: number): void {
        const speed = frameTime * (
            this.buttonDown('+speed') ? this.angleSpeedKey : 1
        );
        if (!this.buttonDown('+strafe')) {
            this.yaw += speed * this.yawSpeed * (
                this.buttonValue('+left') - this.buttonValue('+right')
            );
            this.yaw = quakeAngleMod(this.yaw);
        }
        const keyboardLook = (
            this.buttonValue('+lookdown') - this.buttonValue('+lookup')
        ) + (this.buttonDown('+klook') ?
            this.buttonValue('+back') - this.buttonValue('+forward') : 0);
        this.pitch = quakeClampedPitch(
            this.pitch + speed * this.pitchSpeed * keyboardLook
        );
    }

    private setLookAngles(angles: QuakeVector): void {
        const yaw = angles[1] * Math.PI / 180;
        const pitch = angles[0] * Math.PI / 180;
        const direction = new Vec3(
            Math.cos(pitch) * Math.cos(yaw),
            -Math.sin(pitch),
            -Math.cos(pitch) * Math.sin(yaw)
        );
        this.entity.lookAt(this.entity.getPosition().clone().add(direction), Vec3.UP);
        this.entity.rotateLocal(0, 0, -angles[2]);
    }

    private updateLook(): void {
        this.setLookAngles(quakeIdleViewAngles([
            this.pitch + this.punchAngle[0] + this.damageKickPitch,
            this.yaw + this.punchAngle[1],
            this.dead ? 80 : this.viewRoll + this.calculateRoll() +
                this.punchAngle[2] + this.damageKickRoll
        ], this.elapsed, {
            pitchCycle: this.idlePitchCycle,
            pitchLevel: this.idlePitchLevel,
            rollCycle: this.idleRollCycle,
            rollLevel: this.idleRollLevel,
            scale: this.idleScale,
            yawCycle: this.idleYawCycle,
            yawLevel: this.idleYawLevel
        }));
    }

    updateIntermissionView(time: number): void {
        this.setLookAngles(quakeIntermissionIdleAngles([
            this.pitch, this.yaw, this.viewRoll
        ], time, {
            pitchCycle: this.idlePitchCycle,
            pitchLevel: this.idlePitchLevel,
            rollCycle: this.idleRollCycle,
            rollLevel: this.idleRollLevel,
            yawCycle: this.idleYawCycle,
            yawLevel: this.idleYawLevel
        }));
    }

    private calculateBob(): number {
        const velocity = this.clientVelocity();
        const horizontalSpeed = Math.hypot(velocity[0], velocity[1]);
        return calculateQuakeViewBob(
            horizontalSpeed,
            this.elapsed,
            this.bobAmount,
            this.bobCycle,
            this.bobUp
        );
    }

    private calculateRoll(): number {
        return calculateQuakeViewRoll(
            this.yaw,
            this.clientVelocity(),
            this.rollAngle,
            this.rollSpeed
        );
    }

    private clientVelocity(): QuakeVector {
        return this.velocity.map(quakeClientVelocityComponent) as QuakeVector;
    }

    private updateCamera(): void {
        const clientOrigin = this.origin.map(quakeProtocolCoordinate) as QuakeVector;
        const exactViewOrigin = this.viewHeight === 0;
        const eye: QuakeVector = [
            clientOrigin[0], clientOrigin[1], clientOrigin[2] + this.viewHeight
        ];
        if (!exactViewOrigin) {
            eye[2] += this.calculateBob();
            for (let axis = 0; axis < 3; axis++) eye[axis] += 1 / 32;
            const requestedOffset = quakeScreenViewOffset([
                this.pitch, this.yaw, this.entityAngles[2]
            ], this.screenOffset);
            for (let axis = 0; axis < 3; axis++) eye[axis] += requestedOffset[axis];
            const boundedEye = quakeBoundViewOrigin(eye, clientOrigin);
            this.renderedScreenOffset = boundedEye.map(
                (component, axis) => component - (eye[axis] - requestedOffset[axis])
            ) as QuakeVector;
            for (let axis = 0; axis < 3; axis++) eye[axis] = boundedEye[axis];
        } else {
            this.renderedScreenOffset = [0, 0, 0];
        }
        const frameTime = Math.max(0, this.elapsed - this.cameraElapsed);
        this.cameraElapsed = this.elapsed;
        if (!exactViewOrigin && this.onGround && clientOrigin[2] - this.stairZ > 0) {
            this.stairZ = Math.min(clientOrigin[2], this.stairZ + frameTime * 80);
            this.stairZ = Math.max(this.stairZ, clientOrigin[2] - 12);
            eye[2] += this.stairZ - clientOrigin[2];
        } else {
            this.stairZ = clientOrigin[2];
        }
        this.eyeOrigin = [...eye];
        this.entity.setPosition(...quakeToPlayCanvas(eye));
        this.updateLook();
    }

    private waterLevel(): number {
        const isLiquid = (contents: number): boolean => contents <= CONTENTS.WATER && contents >= CONTENTS.LAVA;
        if (!isLiquid(this.collision.pointContents([
            this.origin[0], this.origin[1], this.origin[2] - 23
        ]))) {
            return 0;
        }
        if (!isLiquid(this.collision.pointContents([
            this.origin[0], this.origin[1], this.origin[2] + 4
        ]))) {
            return 1;
        }
        return isLiquid(this.collision.pointContents([
            this.origin[0], this.origin[1], this.origin[2] + this.viewHeight
        ])) ? 3 : 2;
    }

    private serverViewAngles(): QuakeVector {
        return [this.pitch, this.yaw, 0].map(quakeProtocolAngle) as QuakeVector;
    }

    private movementCommand(): {
        forwardMove: number;
        sideMove: number;
        upMove: number;
        } {
        const speedMultiplier = this.buttonDown('+speed') ? this.moveSpeedKey : 1;
        const keyboardLook = this.buttonDown('+klook');
        const forwardMove = ((keyboardLook ? 0 : this.buttonValue('+forward')) *
            this.forwardSpeed -
            (keyboardLook || this.backwardMoveBlocked ? 0 : this.buttonValue('+back')) *
            this.backSpeed) * speedMultiplier + this.mouseForwardMove;
        const strafeTurn = this.buttonDown('+strafe');
        const sideMove = ((this.buttonValue('+moveright') +
            (strafeTurn ? this.buttonValue('+right') : 0)) * this.sideSpeed -
            (this.buttonValue('+moveleft') +
            (strafeTurn ? this.buttonValue('+left') : 0)) * this.sideSpeed) *
            speedMultiplier + this.mouseSideMove;
        const upMove = (
            this.buttonValue('+moveup') - this.buttonValue('+movedown')
        ) * this.upSpeed * speedMultiplier + this.mouseUpMove;
        return {
            forwardMove: quakeProtocolMessageNumber('short', forwardMove),
            sideMove: quakeProtocolMessageNumber('short', sideMove),
            upMove: quakeProtocolMessageNumber('short', upMove)
        };
    }

    private wishVelocity(includePitch = false): QuakeVector {
        const { forwardMove, sideMove } = this.movementCommand();
        const viewAngles = this.serverViewAngles();
        const yaw = viewAngles[1] * Math.PI / 180;
        const pitch = includePitch ? viewAngles[0] * Math.PI / 180 : 0;
        const forward: QuakeVector = [
            Math.cos(pitch) * Math.cos(yaw),
            Math.cos(pitch) * Math.sin(yaw),
            -Math.sin(pitch)
        ];
        const right: QuakeVector = [Math.sin(yaw), -Math.cos(yaw), 0];
        return forward.map(
            (component, axis) => component * forwardMove + right[axis] * sideMove
        ) as QuakeVector;
    }

    private applyFriction(frameTime: number): void {
        const speed = Math.hypot(this.velocity[0], this.velocity[1]);
        if (speed === 0) {
            return;
        }
        const leadingEdge: QuakeVector = [
            this.origin[0] + this.velocity[0] / speed * 16,
            this.origin[1] + this.velocity[1] / speed * 16,
            this.origin[2] - 24
        ];
        const edgeEnd: QuakeVector = [
            leadingEdge[0], leadingEdge[1], leadingEdge[2] - 34
        ];
        const edgeTrace = this.pointTrace?.(leadingEdge, edgeEnd) ??
            this.collision.tracePoint(leadingEdge, edgeEnd);
        const newSpeed = quakeGroundFrictionScale(
            speed,
            frameTime,
            edgeTrace.fraction === 1,
            this.friction,
            this.edgeFriction,
            this.stopSpeed
        );
        this.velocity = this.velocity.map(component => component * newSpeed) as QuakeVector;
    }

    private accelerate(direction: QuakeVector, speed: number, frameTime: number): void {
        const additionalSpeed = speed - dot(this.velocity, direction);
        if (additionalSpeed <= 0) {
            return;
        }
        const accelerationSpeed = Math.min(
            this.acceleration * frameTime * speed, additionalSpeed
        );
        this.velocity = this.velocity.map(
            (component, axis) => component + accelerationSpeed * direction[axis]
        ) as QuakeVector;
    }

    private airMove(frameTime: number): void {
        const command = this.movementCommand();
        const wish = quakeAirWishVelocity(
            this.entityAngles,
            command.forwardMove,
            command.sideMove,
            command.upMove,
            this.moveType === MOVETYPE_WALK,
            this.maxSpeed
        );
        if (this.moveType === MOVETYPE_NOCLIP) {
            this.velocity = wish.velocity;
            return;
        }

        if (this.onGround) {
            this.applyFriction(frameTime);
            this.accelerate(wish.direction, wish.speed, frameTime);
            return;
        }

        const airWishSpeed = Math.min(wish.speed, 30);
        const additionalSpeed = airWishSpeed - dot(this.velocity, wish.direction);
        if (additionalSpeed <= 0) {
            return;
        }
        const accelerationSpeed = Math.min(
            this.acceleration * wish.speed * frameTime, additionalSpeed
        );
        this.velocity = this.velocity.map(
            (component, axis) => component + accelerationSpeed * wish.direction[axis]
        ) as QuakeVector;
    }

    private waterMove(frameTime: number): void {
        const wishVelocity = this.wishVelocity(true);
        const command = this.movementCommand();
        const hasMovement = command.forwardMove !== 0 || command.sideMove !== 0 ||
            command.upMove !== 0;
        wishVelocity[2] += hasMovement ? command.upMove : -60;
        let { direction, magnitude: wishSpeed } = normalize(wishVelocity);
        if (wishSpeed > this.maxSpeed) {
            wishSpeed = this.maxSpeed;
        }
        wishSpeed *= 0.7;

        const speed = length(this.velocity);
        const newSpeed = Math.max(0, speed - frameTime * speed * this.friction);
        if (speed > 0) {
            this.velocity = this.velocity.map(component => component * newSpeed / speed) as QuakeVector;
        }
        if (wishSpeed === 0 || wishSpeed <= newSpeed) {
            return;
        }
        direction = normalize(wishVelocity).direction;
        const accelerationSpeed = Math.min(
            this.acceleration * wishSpeed * frameTime, wishSpeed - newSpeed
        );
        this.velocity = this.velocity.map(
            (component, axis) => component + accelerationSpeed * direction[axis]
        ) as QuakeVector;
    }

    private traceMovement(start: QuakeVector, end: QuakeVector): QuakePlayerMovementTrace {
        if (this.movementTrace) {
            return this.movementTrace(start, end);
        }
        return {
            entity: 0,
            solid: SOLID_BSP,
            trace: this.collision.trace(start, end)
        };
    }

    private checkStuck(): void {
        const result = quakeUnstuckOrigin(
            this.origin,
            this.oldOrigin,
            (candidate) => {
                const trace = this.traceMovement(candidate, candidate).trace;
                return trace.startSolid || trace.allSolid;
            }
        );
        this.origin = result.origin;
        this.oldOrigin = result.oldOrigin;
    }

    private recordMovementImpact(result: QuakePlayerMovementTrace): void {
        if (result.trace.fraction === 1) {
            return;
        }
        if (result.trace.modelIndex !== undefined) {
            this.touchedBrushModelIndices.add(result.trace.modelIndex);
        } else if (result.entity !== 0) {
            this.touchedEntityReferences.add(result.entity);
        }
    }

    private slideMove(frameTime: number): SlideResult {
        let blocked = 0;
        let wallTrace: HullTrace | undefined;
        let timeLeft = frameTime;
        let originalVelocity: QuakeVector = [...this.velocity];
        const primalVelocity: QuakeVector = [...this.velocity];
        const planes: QuakeVector[] = [];

        for (let bump = 0; bump < 4; bump++) {
            if (this.velocity.every(component => component === 0)) {
                break;
            }
            const end: QuakeVector = [
                this.origin[0] + timeLeft * this.velocity[0],
                this.origin[1] + timeLeft * this.velocity[1],
                this.origin[2] + timeLeft * this.velocity[2]
            ];
            const movementTrace = this.traceMovement(this.origin, end);
            const { trace } = movementTrace;
            this.recordMovementImpact(movementTrace);
            if (trace.allSolid) {
                this.velocity = [0, 0, 0];
                return { blocked: 3, wallTrace };
            }
            if (trace.fraction > 0) {
                this.origin = [...trace.endPosition];
                originalVelocity = [...this.velocity];
                planes.length = 0;
            }
            if (trace.fraction === 1) {
                break;
            }

            if (trace.plane.normal[2] > 0.7) {
                blocked |= 1;
                if (movementTrace.solid === SOLID_BSP) {
                    this.onGround = true;
                    this.groundModelIndex = trace.modelIndex;
                }
            }
            if (trace.plane.normal[2] === 0) {
                blocked |= 2;
                wallTrace = trace;
            }
            timeLeft -= timeLeft * trace.fraction;
            if (planes.length >= MAX_CLIP_PLANES) {
                this.velocity = [0, 0, 0];
                return { blocked: 3, wallTrace };
            }
            planes.push([...trace.plane.normal]);

            let clippedVelocity: QuakeVector | undefined;
            for (let planeIndex = 0; planeIndex < planes.length; planeIndex++) {
                const candidate = clipVelocity(originalVelocity, planes[planeIndex]);
                if (planes.every((plane, index) => index === planeIndex || dot(candidate, plane) >= 0)) {
                    clippedVelocity = candidate;
                    break;
                }
            }
            if (!clippedVelocity) {
                if (planes.length !== 2) {
                    this.velocity = [0, 0, 0];
                    return { blocked: 7, wallTrace };
                }
                const direction = cross(planes[0], planes[1]);
                const creaseSpeed = dot(direction, this.velocity);
                clippedVelocity = direction.map(component => component * creaseSpeed) as QuakeVector;
            }
            this.velocity = clippedVelocity;
            if (dot(this.velocity, primalVelocity) <= 0) {
                this.velocity = [0, 0, 0];
                return { blocked, wallTrace };
            }
        }
        return { blocked, wallTrace };
    }

    private tryUnstick(oldVelocity: QuakeVector): SlideResult {
        const oldOrigin: QuakeVector = [...this.origin];
        const directions: readonly QuakeVector[] = [
            [2, 0, 0], [0, 2, 0], [-2, 0, 0], [0, -2, 0],
            [2, 2, 0], [-2, 2, 0], [2, -2, 0], [-2, -2, 0]
        ];
        for (const direction of directions) {
            const movementTrace = this.traceMovement(this.origin, this.origin.map(
                (component, axis) => component + direction[axis]
            ) as QuakeVector);
            this.recordMovementImpact(movementTrace);
            this.origin = [...movementTrace.trace.endPosition];
            this.velocity = [oldVelocity[0], oldVelocity[1], 0];
            const slide = this.slideMove(0.1);
            if (Math.abs(oldOrigin[0] - this.origin[0]) > 4 ||
                Math.abs(oldOrigin[1] - this.origin[1]) > 4) {
                return slide;
            }
            this.origin = [...oldOrigin];
        }
        this.velocity = [0, 0, 0];
        return { blocked: 7 };
    }

    private walkMove(frameTime: number, waterLevel: number): void {
        const oldOnGround = this.onGround;
        const oldOrigin: QuakeVector = [...this.origin];
        const oldVelocity: QuakeVector = [...this.velocity];
        this.onGround = false;
        this.groundModelIndex = undefined;
        const slide = this.slideMove(frameTime);
        if ((slide.blocked & 2) === 0 || (!oldOnGround && waterLevel === 0)) {
            return;
        }
        if (this.noStep || this.waterJump) return;

        const noStepOrigin: QuakeVector = [...this.origin];
        const noStepVelocity: QuakeVector = [...this.velocity];
        this.origin = [...oldOrigin];

        const upMovementTrace = this.traceMovement(this.origin, [
            this.origin[0], this.origin[1], this.origin[2] + STEP_SIZE
        ]);
        const upTrace = upMovementTrace.trace;
        this.recordMovementImpact(upMovementTrace);
        this.origin = [...upTrace.endPosition];
        this.velocity = [oldVelocity[0], oldVelocity[1], 0];
        let stepSlide = this.slideMove(frameTime);
        if (stepSlide.blocked !== 0 &&
            Math.abs(oldOrigin[0] - this.origin[0]) < 0.03125 &&
            Math.abs(oldOrigin[1] - this.origin[1]) < 0.03125) {
            stepSlide = this.tryUnstick(oldVelocity);
        }
        if ((stepSlide.blocked & 2) !== 0 && stepSlide.wallTrace) {
            this.velocity = quakeServerWallFrictionVelocity(
                [this.pitch, this.yaw, 0],
                this.velocity,
                stepSlide.wallTrace.plane.normal
            );
        }

        const downMovementTrace = this.traceMovement(this.origin, [
            this.origin[0],
            this.origin[1],
            this.origin[2] - STEP_SIZE + oldVelocity[2] * frameTime
        ]);
        const downTrace = downMovementTrace.trace;
        this.recordMovementImpact(downMovementTrace);
        this.origin = [...downTrace.endPosition];
        if (downTrace.plane.normal[2] > 0.7 && downMovementTrace.solid === SOLID_BSP) {
            this.onGround = true;
            this.groundModelIndex = downTrace.modelIndex;
        } else {
            this.origin = noStepOrigin;
            this.velocity = noStepVelocity;
        }
    }

    playerState(): QuakePlayerState {
        return {
            angularVelocity: [...this.angularVelocity],
            angles: this.serverViewAngles(),
            attack: this.attack,
            entityAngles: [...this.entityAngles],
            groundModelIndex: this.groundModelIndex,
            jump: this.buttonValue('+jump') > 0,
            jumped: this.jumped,
            onGround: this.onGround,
            oldOrigin: [...this.oldOrigin],
            origin: [...this.origin],
            touchEntityReferences: [...this.touchedEntityReferences],
            touchModelIndices: [...this.touchedBrushModelIndices],
            velocity: [...this.velocity],
            waterJump: this.waterJump,
            waterJumpDirection: [...this.waterJumpDirection],
            waterLevel: this.waterLevel(),
            waterType: this.collision.pointContents([
                this.origin[0], this.origin[1], this.origin[2] - 23
            ])
        };
    }

    viewBob(): number {
        return this.calculateBob();
    }

    synchronizeClientTime(time: number): void {
        if (!Number.isFinite(time) || time < 0) {
            throw new Error(`Invalid Quake client time ${time}`);
        }
        this.elapsed = time;
        this.cameraElapsed = time;
    }

    setPlaybackTime(time: number): void {
        if (!Number.isFinite(time) || time < 0) {
            throw new Error(`Invalid Quake playback time ${time}`);
        }
        this.elapsed = time;
    }

    viewLightingOrigin(): QuakeVector {
        return [...this.eyeOrigin];
    }

    viewModelScreenOffset(): QuakeVector {
        return [...this.renderedScreenOffset];
    }

    viewModelAngles(): QuakeVector {
        return quakeViewModelAngles(
            [this.pitch, this.yaw, this.viewRoll],
            this.damageKickPitch,
            this.elapsed,
            {
                pitchCycle: this.idlePitchCycle,
                pitchLevel: this.idlePitchLevel,
                rollCycle: this.idleRollCycle,
                rollLevel: this.idleRollLevel,
                scale: this.idleScale,
                yawCycle: this.idleYawCycle,
                yawLevel: this.idleYawLevel
            }
        );
    }

    applyServerState(state: QuakePlayerResult, updateView = true): void {
        this.origin = [...state.origin];
        this.velocity = [...state.velocity];
        this.angularVelocity = [...state.angularVelocity];
        this.entityAngles = [...state.entityAngles];
        this.backwardMoveBlocked = state.backwardMoveBlocked;
        this.damageKickPitch = state.damagePitch;
        this.damageKickRoll = state.damageRoll;
        this.dead = state.dead;
        this.idealPitch = state.idealPitch;
        this.moveType = state.moveType;
        this.onGround = state.onGround;
        this.groundModelIndex = state.onGround ? state.groundModelIndex : undefined;
        this.oldOrigin = [...state.oldOrigin];
        this.punchAngle = [...state.punchAngle];
        this.viewHeight = state.viewHeight;
        this.waterJump = state.waterJump;
        this.waterJumpDirection = [...state.waterJumpDirection];
        this.waterJumpTime = state.waterJumpTime;
        if (state.fixAngle) {
            this.pitch = state.angles[0];
            this.yaw = state.angles[1];
            this.viewRoll = state.angles[2];
        }
        if (updateView) this.updateCamera();
    }

    beginFrame(deltaTime: number): void {
        if (this.framePrepared) {
            throw new Error('Quake controller frame is already prepared');
        }
        this.touchedBrushModelIndices.clear();
        this.touchedEntityReferences.clear();
        this.jumped = false;
        const frameTime = quakeHostFrameTime(deltaTime);
        this.preparedFrameTime = frameTime;
        this.framePrepared = true;
        this.elapsed += frameTime;
        this.sampleButtonStates();
        this.adjustKeyboardAngles(frameTime);
        this.processMouseInput();
        const manualLookActive = this.mouseLookActive || this.buttonDown('+mlook') ||
            this.buttonDown('+klook') || this.buttonValue('+lookup') !== 0 ||
            this.buttonValue('+lookdown') !== 0;
        this.pitchDrift = quakePitchDriftStep(
            { ...this.pitchDrift, pitch: this.pitch },
            this.idealPitch,
            frameTime,
            this.elapsed,
            this.onGround && this.moveType !== MOVETYPE_NOCLIP,
            manualLookActive,
            !this.buttonDown('+klook') && (
                this.buttonDown('+forward') || this.buttonDown('+back')
            ),
            this.centerMove,
            this.centerSpeed
        );
        this.pitch = this.pitchDrift.pitch;
        for (let axis = 0; axis < 3; axis++) {
            if (Number.isNaN(this.velocity[axis])) this.velocity[axis] = 0;
            if (Number.isNaN(this.origin[axis])) this.origin[axis] = 0;
            this.velocity[axis] = clamp(
                this.velocity[axis], -this.maxVelocity, this.maxVelocity
            );
        }
        const waterLevel = this.waterLevel();
        const waterType = this.collision.pointContents([
            this.origin[0], this.origin[1], this.origin[2] - 23
        ]);
        if (this.dead || this.moveType === MOVETYPE_NONE) {
            this.mouseForwardMove = 0;
            this.mouseSideMove = 0;
            this.mouseUpMove = 0;
            return;
        }
        this.entityAngles = quakeClientEntityAngles(
            this.serverViewAngles(),
            this.punchAngle,
            calculateQuakeViewRoll(
                this.entityAngles[1], this.clientVelocity()
            ) * 4
        );
        if (this.waterJump) {
            this.waterJumpTime -= frameTime;
            if (this.waterJumpTime < 0 || waterLevel === 0) {
                this.waterJump = false;
            }
            this.velocity = quakeWaterJumpVelocity(
                this.velocity, this.waterJumpDirection
            );
            this.mouseForwardMove = 0;
            this.mouseSideMove = 0;
            this.mouseUpMove = 0;
            return;
        }
        if (this.moveType === MOVETYPE_WALK) {
            if (this.serverDrivenJump) {
                this.jumpReleased = this.buttonValue('+jump') === 0;
            } else if (this.buttonValue('+jump') > 0) {
                if (waterLevel >= 2) {
                    this.velocity[2] = quakeSwimmingJumpSpeed(waterType);
                    this.onGround = false;
                    this.groundModelIndex = undefined;
                } else if (this.onGround && this.jumpReleased) {
                    this.velocity[2] += JUMP_SPEED;
                    this.onGround = false;
                    this.groundModelIndex = undefined;
                    this.jumpReleased = false;
                    this.jumped = true;
                }
            } else {
                this.jumpReleased = true;
            }
        }
        if (waterLevel >= 2 && this.moveType !== MOVETYPE_NOCLIP) {
            this.waterMove(frameTime);
        } else {
            this.airMove(frameTime);
        }
        this.mouseForwardMove = 0;
        this.mouseSideMove = 0;
        this.mouseUpMove = 0;
    }

    startPitchDrift(force = false): void {
        if (!force && this.pitchDrift.lastStop === this.elapsed) return;
        if (this.pitchDrift.noDrift || this.pitchDrift.pitchVelocity === 0) {
            this.pitchDrift = {
                ...this.pitchDrift,
                driftMove: 0,
                noDrift: false,
                pitchVelocity: this.centerSpeed
            };
        }
    }

    finishFrame(updateView = true): void {
        if (!this.framePrepared) {
            throw new Error('Quake controller frame was not prepared');
        }
        const frameTime = this.preparedFrameTime;
        this.framePrepared = false;
        if (this.moveType === MOVETYPE_NONE) return;
        if (this.moveType === MOVETYPE_NOCLIP) {
            this.origin = this.origin.map(
                (component, axis) => component + this.velocity[axis] * frameTime
            ) as QuakeVector;
            if (updateView) this.updateCamera();
            return;
        }
        if (this.moveType === MOVETYPE_TOSS || this.moveType === MOVETYPE_BOUNCE) {
            this.tossMove(frameTime, this.moveType === MOVETYPE_BOUNCE);
            if (updateView) this.updateCamera();
            return;
        }
        if (this.moveType === MOVETYPE_FLY) {
            this.slideMove(frameTime);
            if (updateView) this.updateCamera();
            return;
        }
        const waterLevel = this.waterLevel();

        if (waterLevel < 2 && !this.waterJump) {
            this.velocity[2] -= this.gravity * frameTime;
        }
        this.checkStuck();
        this.walkMove(frameTime, waterLevel);
        if (updateView) this.updateCamera();
    }

    private tossMove(frameTime: number, bounce: boolean): void {
        if (this.onGround) return;
        this.velocity[2] -= this.gravity * frameTime;
        this.entityAngles = quakeTossAngles(
            this.entityAngles, this.angularVelocity, frameTime
        );
        const movementTrace = this.traceMovement(this.origin, this.origin.map(
            (component, axis) => component + this.velocity[axis] * frameTime
        ) as QuakeVector);
        this.recordMovementImpact(movementTrace);
        this.origin = [...movementTrace.trace.endPosition];
        if (movementTrace.trace.fraction === 1) return;
        this.velocity = clipVelocity(
            this.velocity, movementTrace.trace.plane.normal, bounce ? 1.5 : 1
        );
        if (movementTrace.trace.plane.normal[2] > 0.7 &&
            (!bounce || this.velocity[2] < 60)) {
            this.onGround = true;
            this.groundModelIndex = movementTrace.trace.modelIndex;
            this.velocity = [0, 0, 0];
            this.angularVelocity = [0, 0, 0];
        }
    }

    update(deltaTime: number): void {
        this.beginFrame(deltaTime);
        this.finishFrame();
    }
}
