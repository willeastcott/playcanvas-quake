import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_NEAREST,
    PIXELFORMAT_R8,
    PIXELFORMAT_RGBA8,
    Texture,
    type GraphicsDevice
} from 'playcanvas';

import type { IndexedPicture } from '../formats/wad';

const COLORMAP_GRADES = 64;
const COLORMAP_WIDTH = 256;

export interface QuakePaletteShift {
    color: readonly [number, number, number];
    percent: number;
}

export const applyQuakeGamma = (
    palette: Uint8Array<ArrayBufferLike>,
    gamma: number
): Uint8Array<ArrayBuffer> => {
    if (palette.length !== 256 * 3) {
        throw new Error(`Expected a 768-byte Quake palette, got ${palette.length}`);
    }
    const table = new Uint8Array(256);
    for (let index = 0; index < 256; index++) {
        table[index] = gamma === 1 ? index : Math.max(0, Math.min(255,
            Math.trunc(255 * ((index + 0.5) / 255.5) ** gamma + 0.5)
        ));
    }
    return Uint8Array.from(palette, value => table[value]);
};

export const applyQuakePaletteShifts = (
    palette: Uint8Array<ArrayBufferLike>,
    shifts: readonly QuakePaletteShift[],
    gamma: number
): Uint8Array<ArrayBuffer> => {
    if (palette.length !== 256 * 3) {
        throw new Error(`Expected a 768-byte Quake palette, got ${palette.length}`);
    }
    const shifted = Uint8Array.from(palette);
    for (let index = 0; index < shifted.length; index += 3) {
        for (const shift of shifts) {
            const percent = Math.trunc(shift.percent);
            for (let channel = 0; channel < 3; channel++) {
                const value = shifted[index + channel];
                shifted[index + channel] = value +
                    ((percent * (shift.color[channel] - value)) >> 8);
            }
        }
    }
    return applyQuakeGamma(shifted, gamma);
};

export const quakePaletteRgba = (
    palette: Uint8Array<ArrayBufferLike>
): Uint8Array<ArrayBuffer> => {
    if (palette.length !== 256 * 3) {
        throw new Error(`Expected a 768-byte Quake palette, got ${palette.length}`);
    }
    const pixels = new Uint8Array(256 * 4);
    for (let index = 0; index < 256; index++) {
        pixels[index * 4] = palette[index * 3];
        pixels[index * 4 + 1] = palette[index * 3 + 1];
        pixels[index * 4 + 2] = palette[index * 3 + 2];
        pixels[index * 4 + 3] = 255;
    }
    return pixels;
};

export const createPaletteTexture = (
    device: GraphicsDevice,
    palette: Uint8Array<ArrayBufferLike>
): Texture => {
    const pixels = quakePaletteRgba(palette);
    return new Texture(device, {
        name: 'Quake palette',
        width: 256,
        height: 1,
        format: PIXELFORMAT_RGBA8,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        mipmaps: false,
        levels: [pixels]
    });
};

export const updatePaletteTexture = (
    texture: Texture,
    palette: Uint8Array<ArrayBufferLike>
): void => {
    const target = texture.lock();
    if (!(target instanceof Uint8Array)) {
        throw new Error('Quake palette texture did not expose byte storage');
    }
    target.set(quakePaletteRgba(palette));
    texture.unlock();
};

export const createColormapTexture = (
    device: GraphicsDevice,
    colormap: Uint8Array<ArrayBufferLike>
): Texture => {
    const requiredLength = COLORMAP_WIDTH * COLORMAP_GRADES;
    if (colormap.length < requiredLength) {
        throw new Error(`Expected at least ${requiredLength} Quake colormap bytes, got ${colormap.length}`);
    }
    return new Texture(device, {
        name: 'Quake colormap',
        width: COLORMAP_WIDTH,
        height: COLORMAP_GRADES,
        format: PIXELFORMAT_R8,
        minFilter: FILTER_NEAREST,
        magFilter: FILTER_NEAREST,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        mipmaps: false,
        levels: [Uint8Array.from(colormap.subarray(0, requiredLength))]
    });
};

export const quakeColormapGrade = (blockLight: number): number => {
    const inverted = (255 * 256 - Math.trunc(blockLight)) >> 2;
    return (Math.max(1 << 6, inverted) & 0xFF00) >> 8;
};

export const indexedToImageData = (
    picture: IndexedPicture,
    palette: Uint8Array<ArrayBufferLike>,
    transparentIndex = 255
): ImageData => {
    const rgba = new Uint8ClampedArray(picture.width * picture.height * 4);
    for (let index = 0; index < picture.pixels.length; index++) {
        const paletteIndex = picture.pixels[index];
        rgba[index * 4] = palette[paletteIndex * 3];
        rgba[index * 4 + 1] = palette[paletteIndex * 3 + 1];
        rgba[index * 4 + 2] = palette[paletteIndex * 3 + 2];
        rgba[index * 4 + 3] = paletteIndex === transparentIndex ? 0 : 255;
    }
    return new ImageData(rgba, picture.width, picture.height);
};
