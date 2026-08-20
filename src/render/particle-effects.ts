const EF_ROCKET = 1;
const EF_GRENADE = 2;
const EF_GIB = 4;
export const EF_ROTATE = 8;
const EF_TRACER = 16;
const EF_ZOMGIB = 32;
const EF_TRACER2 = 64;
const EF_TRACER3 = 128;

export const quakeModelTrailType = (flags: number): number | undefined => {
    if ((flags & EF_GIB) !== 0) return 2;
    if ((flags & EF_ZOMGIB) !== 0) return 4;
    if ((flags & EF_TRACER) !== 0) return 3;
    if ((flags & EF_TRACER2) !== 0) return 5;
    if ((flags & EF_ROCKET) !== 0) return 0;
    if ((flags & EF_GRENADE) !== 0) return 1;
    if ((flags & EF_TRACER3) !== 0) return 6;
    return undefined;
};

export const hasQuakeRocketLight = (flags: number): boolean => (flags & EF_ROCKET) !== 0;

export const quakeRotatingModelYaw = (time: number): number => ((time * 100) % 360 + 360) % 360;

export const QUAKE_PARTICLE_NEAR_CLIP = 8;

export const quakeParticleMaximumPixelSize = (viewportWidth: number): number => (
    Math.max(1, Math.trunc(viewportWidth / 80 + 0.5))
);

export const quakeParticlePixelSize = (depth: number, viewportWidth: number): number => {
    const minimum = Math.max(1, Math.trunc(viewportWidth / 320));
    const maximum = quakeParticleMaximumPixelSize(viewportWidth);
    const shift = 8 - Math.trunc(viewportWidth / 320 + 0.5);
    const inverseDepth = Math.trunc(32_768 / Math.max(depth, 0.001));
    const size = Math.floor(inverseDepth / 2 ** shift);
    return Math.max(minimum, Math.min(maximum, size));
};

export const quakeParticleDisplayPixelSize = (
    depth: number,
    logicalViewportWidth: number,
    displayViewportWidth: number
): number => Math.max(1, Math.round(
    quakeParticlePixelSize(depth, logicalViewportWidth) *
    Math.max(1, displayViewportWidth) / Math.max(1, logicalViewportWidth)
));

export interface QuakeParticleRaster {
    size: number;
    topLeft: [number, number];
    visible: boolean;
}

export const quakeParticleRaster = (
    projectedX: number,
    projectedY: number,
    depth: number,
    viewportWidth: number,
    viewportHeight: number
): QuakeParticleRaster => {
    // D_DrawParticle adds 0.5 and then casts to int, which truncates toward zero.
    const x = Math.trunc(projectedX + 0.5) || 0;
    const y = Math.trunc(projectedY + 0.5) || 0;
    const size = quakeParticlePixelSize(depth, viewportWidth);
    const maximum = quakeParticleMaximumPixelSize(viewportWidth);
    return {
        size,
        topLeft: [x, y],
        visible: depth >= QUAKE_PARTICLE_NEAR_CLIP &&
            x >= 0 && y >= 0 &&
            x <= viewportWidth - maximum && y <= viewportHeight - maximum
    };
};

export interface QuakeTeleportParticleState {
    color: number;
    die: number;
    origin: [number, number, number];
    velocity: [number, number, number];
}

export type QuakeParticleSeed = QuakeTeleportParticleState;

const normalizedVelocity = (
    direction: readonly number[],
    speed: number
): [number, number, number] => {
    const magnitude = Math.hypot(...direction);
    return direction.map(
        component => (magnitude === 0 ? 0 : component * speed / magnitude)
    ) as [number, number, number];
};

export const quakeEffectParticleState = (
    eventOrigin: readonly number[],
    direction: readonly number[],
    colorBase: number,
    time: number,
    random: () => number
): QuakeParticleSeed => ({
    die: time + 0.1 * (random() % 5),
    color: (colorBase & ~7) + (random() & 7),
    origin: eventOrigin.map(
        component => component + (random() & 15) - 8
    ) as [number, number, number],
    velocity: direction.map(component => component * 15) as [number, number, number]
});

export const quakeExplosionTwoParticleState = (
    eventOrigin: readonly number[],
    colorStart: number,
    colorLength: number,
    index: number,
    time: number,
    random: () => number
): QuakeParticleSeed => {
    const origin: [number, number, number] = [0, 0, 0];
    const velocity: [number, number, number] = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
        origin[axis] = eventOrigin[axis] + (random() % 32) - 16;
        velocity[axis] = (random() % 512) - 256;
    }
    return {
        color: colorStart + index % Math.max(1, colorLength),
        die: time + 0.3,
        origin,
        velocity
    };
};

export const quakeBlobParticleState = (
    eventOrigin: readonly number[],
    blob: boolean,
    time: number,
    random: () => number
): QuakeParticleSeed => {
    const die = time + 1 + (random() & 8) * 0.05;
    const color = (blob ? 66 : 150) + random() % 6;
    const origin: [number, number, number] = [0, 0, 0];
    const velocity: [number, number, number] = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
        origin[axis] = eventOrigin[axis] + (random() % 32) - 16;
        velocity[axis] = (random() % 512) - 256;
    }
    return { color, die, origin, velocity };
};

export const quakeLavaParticleState = (
    eventOrigin: readonly number[],
    row: number,
    column: number,
    time: number,
    random: () => number
): QuakeParticleSeed => {
    const die = time + 2 + (random() & 31) * 0.02;
    const color = 224 + (random() & 7);
    const direction: [number, number, number] = [
        column * 8 + (random() & 7),
        row * 8 + (random() & 7),
        256
    ];
    const origin: [number, number, number] = [
        eventOrigin[0] + direction[0],
        eventOrigin[1] + direction[1],
        eventOrigin[2] + (random() & 63)
    ];
    const speed = 50 + (random() & 63);
    return { color, die, origin, velocity: normalizedVelocity(direction, speed) };
};

export const quakeTeleportParticleState = (
    eventOrigin: readonly number[],
    x: number,
    y: number,
    z: number,
    time: number,
    random: () => number
): QuakeTeleportParticleState => {
    // R_TeleportSplash consumes rand() in this exact order.
    const die = time + 0.2 + (random() & 7) * 0.02;
    const color = 7 + (random() & 7);
    const origin: [number, number, number] = [
        eventOrigin[0] + x + (random() & 3),
        eventOrigin[1] + y + (random() & 3),
        eventOrigin[2] + z + (random() & 3)
    ];
    const speed = 50 + (random() & 63);
    const direction: [number, number, number] = [y * 8, x * 8, z * 8];
    return { color, die, origin, velocity: normalizedVelocity(direction, speed) };
};

export const quakeEntityParticleOrigin = (
    origin: readonly number[],
    normal: readonly number[],
    angularVelocity: readonly number[],
    time: number
): [number, number, number] => {
    const yaw = time * angularVelocity[0];
    const pitch = time * angularVelocity[1];
    const forward = [
        Math.cos(pitch) * Math.cos(yaw),
        Math.cos(pitch) * Math.sin(yaw),
        -Math.sin(pitch)
    ];
    return [0, 1, 2].map(
        axis => origin[axis] + normal[axis] * 64 + forward[axis] * 16
    ) as [number, number, number];
};
