const TURBULENCE_CYCLE = 128;
const TURBULENCE_AMPLITUDE = 8;
const TURBULENCE_SPEED = 20;
const TURBULENCE_SIZE = 64;
const FIXED_POINT_SCALE = 65_536;
const SOURCE_PI = 3.14159;

export const QUAKE_TURBULENCE_OFFSETS = Float32Array.from(
    { length: TURBULENCE_CYCLE },
    (_, coordinate) => Math.trunc(
        TURBULENCE_AMPLITUDE * FIXED_POINT_SCALE + Math.sin(
            coordinate * SOURCE_PI * 2 / TURBULENCE_CYCLE
        ) * TURBULENCE_AMPLITUDE * FIXED_POINT_SCALE
    ) >> 16
);

const wrap = (value: number, size: number): number => ((value % size) + size) % size;

const turbulenceOffset = (coordinate: number, time: number): number => {
    const phase = Math.trunc(time * TURBULENCE_SPEED) & (TURBULENCE_CYCLE - 1);
    return QUAKE_TURBULENCE_OFFSETS[wrap(Math.floor(coordinate) + phase, TURBULENCE_CYCLE)];
};

export const quakeTurbulentTextureCoordinate = (
    s: number,
    t: number,
    time: number
): [number, number] => {
    const x = Math.floor(s);
    const y = Math.floor(t);
    return [
        wrap(x + turbulenceOffset(y, time), TURBULENCE_SIZE),
        wrap(y + turbulenceOffset(x, time), TURBULENCE_SIZE)
    ];
};
