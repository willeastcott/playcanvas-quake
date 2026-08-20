export const QUAKE_PLAYER_NAME_LENGTH = 15;

export interface QuakePlayerColors {
    bottom: number;
    encoded: number;
    top: number;
}

const quakeAtoi = (value: string): number => {
    const match = /^\s*([+-]?\d+)/u.exec(value);
    return match ? Number(match[1]) : 0;
};

const quakePlayerColorComponent = (value: number): number => (
    Math.min(13, Math.trunc(value) & 15)
);

export const quakePlayerName = (value: string): string => (
    value.slice(0, QUAKE_PLAYER_NAME_LENGTH)
);

export const quakePlayerNameCommand = (
    arguments_: readonly string[],
    current: string
): string => (
    arguments_.length === 0 ? current : quakePlayerName(arguments_.join(' '))
);

export const quakePlayerColorsFromCvar = (value: number): QuakePlayerColors => {
    const encoded = Math.trunc(Number.isFinite(value) ? value : 0);
    const top = quakePlayerColorComponent(encoded >> 4);
    const bottom = quakePlayerColorComponent(encoded);
    return { bottom, encoded: top * 16 + bottom, top };
};

export const quakePlayerColorsCommand = (
    arguments_: readonly string[],
    current: number
): QuakePlayerColors => {
    if (arguments_.length === 0) return quakePlayerColorsFromCvar(current);
    const top = quakePlayerColorComponent(quakeAtoi(arguments_[0]));
    const bottom = quakePlayerColorComponent(quakeAtoi(arguments_[1] ?? arguments_[0]));
    return { bottom, encoded: top * 16 + bottom, top };
};
