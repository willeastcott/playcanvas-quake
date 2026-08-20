export const quakeAngleMod = (angle: number): number => (
    360 / 65_536 * (Math.trunc(angle * (65_536 / 360)) & 65_535)
);

// Host_Frame receives a C float, and a positive host_framerate cvar also
// reaches the double host clock through its stored float value.
export const quakeHostFrameTime = (deltaTime: number): number => (
    Math.fround(Math.max(0, Math.min(deltaTime, 0.1)))
);
