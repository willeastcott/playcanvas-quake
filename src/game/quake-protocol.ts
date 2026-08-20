export type QuakeMessageNumberKind =
    'angle' | 'byte' | 'char' | 'coord' | 'entity' | 'long' | 'short';

export const quakeProtocolCoordinate = (value: number): number => {
    const fixed = Math.trunc(value * 8);
    return ((fixed & 0xffff) << 16 >> 16) / 8;
};

export const quakeProtocolAngle = (value: number): number => {
    const encoded = Math.trunc(Math.trunc(value) * 256 / 360) & 255;
    return (encoded << 24 >> 24) * 360 / 256;
};

export const quakeProtocolByte = (value: number): number => Math.trunc(value) & 255;

export const quakeProtocolMessageNumber = (
    kind: QuakeMessageNumberKind,
    value: number
): number => {
    const integer = Math.trunc(value);
    switch (kind) {
        case 'angle':
            return quakeProtocolAngle(value);
        case 'byte':
            return quakeProtocolByte(value);
        case 'char':
            return (integer & 255) << 24 >> 24;
        case 'coord':
            return quakeProtocolCoordinate(value);
        case 'entity':
        case 'short':
            return (integer & 0xffff) << 16 >> 16;
        case 'long':
            return integer | 0;
    }
};
