import { deflateSync, inflateSync } from 'node:zlib';

export interface RgbImage {
    height: number;
    pixels: Uint8Array;
    width: number;
}

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit++) {
        crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    return crc >>> 0;
});

const writeUint32 = (output: Uint8Array, offset: number, value: number): void => {
    new DataView(output.buffer, output.byteOffset + offset, 4).setUint32(0, value, false);
};

const readUint32 = (input: Uint8Array, offset: number): number => (
    new DataView(input.buffer, input.byteOffset + offset, 4).getUint32(0, false)
);

const crc32 = (type: Uint8Array, data: Uint8Array): number => {
    let crc = 0xffffffff;
    for (const bytes of [type, data]) {
        for (const value of bytes) crc = CRC_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (name: string, data: Uint8Array): Uint8Array => {
    const type = new TextEncoder().encode(name);
    if (type.length !== 4) throw new Error('PNG chunk names must contain four bytes');
    const output = new Uint8Array(12 + data.length);
    writeUint32(output, 0, data.length);
    output.set(type, 4);
    output.set(data, 8);
    writeUint32(output, 8 + data.length, crc32(type, data));
    return output;
};

const concatenate = (parts: readonly Uint8Array[]): Uint8Array => {
    const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.length;
    }
    return output;
};

const encodePng = (
    pixels: Uint8Array,
    width: number,
    height: number,
    channels: 3 | 4
): Uint8Array => {
    if (!Number.isInteger(width) || width <= 0 ||
        !Number.isInteger(height) || height <= 0) {
        throw new Error('PNG dimensions must be positive integers');
    }
    if (pixels.length !== width * height * channels) {
        throw new Error(
            `Expected ${width * height * channels} ${channels === 3 ? 'RGB' : 'RGBA'} bytes, got ${pixels.length}`
        );
    }
    const header = new Uint8Array(13);
    writeUint32(header, 0, width);
    writeUint32(header, 4, height);
    header.set([8, channels === 3 ? 2 : 6, 0, 0, 0], 8);
    const stride = width * channels;
    const scanlines = new Uint8Array(height * (stride + 1));
    for (let row = 0; row < height; row++) {
        scanlines.set(
            pixels.subarray(row * stride, (row + 1) * stride),
            row * (stride + 1) + 1
        );
    }
    return concatenate([
        PNG_SIGNATURE,
        pngChunk('IHDR', header),
        pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
        pngChunk('IEND', new Uint8Array())
    ]);
};

export const encodeRgbPng = (
    rgb: Uint8Array,
    width: number,
    height: number
): Uint8Array => encodePng(rgb, width, height, 3);

export const encodeIndexedPng = (
    indices: Uint8Array,
    palette: Uint8Array,
    width: number,
    height: number
): Uint8Array => {
    if (!Number.isInteger(width) || width <= 0 ||
        !Number.isInteger(height) || height <= 0) {
        throw new Error('PNG dimensions must be positive integers');
    }
    if (indices.length !== width * height) {
        throw new Error(`Expected ${width * height} palette indices, got ${indices.length}`);
    }
    if (palette.length === 0 || palette.length > 768 || palette.length % 3 !== 0) {
        throw new Error('PNG palettes must contain between 1 and 256 RGB entries');
    }
    const paletteEntries = palette.length / 3;
    if (indices.some(index => index >= paletteEntries)) {
        throw new Error('PNG palette index exceeds the supplied palette');
    }
    const header = new Uint8Array(13);
    writeUint32(header, 0, width);
    writeUint32(header, 4, height);
    header.set([8, 3, 0, 0, 0], 8);
    const scanlines = new Uint8Array(height * (width + 1));
    for (let row = 0; row < height; row++) {
        scanlines.set(indices.subarray(row * width, (row + 1) * width), row * (width + 1) + 1);
    }
    return concatenate([
        PNG_SIGNATURE,
        pngChunk('IHDR', header),
        pngChunk('PLTE', palette),
        pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
        pngChunk('IEND', new Uint8Array())
    ]);
};

export const encodeRgbaPng = (
    rgba: Uint8Array,
    width: number,
    height: number
): Uint8Array => encodePng(rgba, width, height, 4);

const paethPredictor = (left: number, up: number, upperLeft: number): number => {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
    return upDistance <= upperLeftDistance ? up : upperLeft;
};

export const decodeRgbPng = (bytes: Uint8Array): RgbImage => {
    if (bytes.length < PNG_SIGNATURE.length || PNG_SIGNATURE.some(
        (value, index) => bytes[index] !== value
    )) {
        throw new Error('Not a PNG image');
    }
    let width = 0;
    let height = 0;
    let channels: 1 | 3 | 4 | 0 = 0;
    let colorType: 2 | 3 | 6 | 0 = 0;
    let palette = new Uint8Array();
    let paletteAlpha = new Uint8Array();
    const compressedParts: Uint8Array[] = [];
    let offset = PNG_SIGNATURE.length;
    let foundEnd = false;
    while (offset + 12 <= bytes.length) {
        const length = readUint32(bytes, offset);
        const end = offset + 12 + length;
        if (end > bytes.length) throw new Error('PNG chunk extends past the file');
        const type = bytes.subarray(offset + 4, offset + 8);
        const data = bytes.subarray(offset + 8, offset + 8 + length);
        const name = new TextDecoder().decode(type);
        if (readUint32(bytes, offset + 8 + length) !== crc32(type, data)) {
            throw new Error(`PNG ${name} chunk has an invalid CRC`);
        }
        if (name === 'IHDR') {
            if (length !== 13 || width !== 0 || height !== 0) {
                throw new Error('PNG has an invalid IHDR chunk');
            }
            width = readUint32(data, 0);
            height = readUint32(data, 4);
            const bitDepth = data[8];
            const parsedColorType = data[9];
            if (width <= 0 || height <= 0 || bitDepth !== 8 ||
                (parsedColorType !== 2 && parsedColorType !== 3 && parsedColorType !== 6) ||
                data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
                throw new Error(
                    'Only non-interlaced 8-bit indexed, RGB, and RGBA PNGs are supported'
                );
            }
            colorType = parsedColorType;
            channels = colorType === 3 ? 1 : colorType === 2 ? 3 : 4;
        } else if (name === 'PLTE') {
            if (data.length === 0 || data.length > 768 || data.length % 3 !== 0) {
                throw new Error('PNG has an invalid PLTE chunk');
            }
            palette = Uint8Array.from(data);
        } else if (name === 'tRNS') {
            paletteAlpha = Uint8Array.from(data);
        } else if (name === 'IDAT') {
            compressedParts.push(data);
        } else if (name === 'IEND') {
            foundEnd = true;
            break;
        }
        offset = end;
    }
    if (!foundEnd || width === 0 || height === 0 || channels === 0 ||
        compressedParts.length === 0) {
        throw new Error('PNG is missing required chunks');
    }
    if (colorType === 3 && (palette.length === 0 || paletteAlpha.length > palette.length / 3)) {
        throw new Error('Indexed PNG is missing a valid palette');
    }
    const filtered = inflateSync(concatenate(compressedParts));
    const stride = width * channels;
    if (filtered.length !== height * (stride + 1)) {
        throw new Error('PNG decompressed byte count does not match its dimensions');
    }
    const unfiltered = new Uint8Array(width * height * channels);
    for (let row = 0; row < height; row++) {
        const filter = filtered[row * (stride + 1)];
        if (filter > 4) throw new Error(`Unsupported PNG row filter ${filter}`);
        for (let column = 0; column < stride; column++) {
            const raw = filtered[row * (stride + 1) + column + 1];
            const outputOffset = row * stride + column;
            const left = column >= channels ? unfiltered[outputOffset - channels] : 0;
            const up = row > 0 ? unfiltered[outputOffset - stride] : 0;
            const upperLeft = row > 0 && column >= channels ?
                unfiltered[outputOffset - stride - channels] : 0;
            const prediction = filter === 1 ? left :
                filter === 2 ? up :
                    filter === 3 ? Math.floor((left + up) / 2) :
                        filter === 4 ? paethPredictor(left, up, upperLeft) : 0;
            unfiltered[outputOffset] = (raw + prediction) & 0xff;
        }
    }
    if (colorType === 2) return { height, pixels: unfiltered, width };
    const rgb = new Uint8Array(width * height * 3);
    if (colorType === 3) {
        for (let source = 0, target = 0; source < unfiltered.length; source++) {
            const index = unfiltered[source];
            const paletteOffset = index * 3;
            if (paletteOffset + 2 >= palette.length) {
                throw new Error(`Indexed PNG palette index ${index} is out of range`);
            }
            const alpha = paletteAlpha[index] ?? 255;
            for (let channel = 0; channel < 3; channel++) {
                rgb[target++] = Math.round(palette[paletteOffset + channel] * alpha / 255);
            }
        }
        return { height, pixels: rgb, width };
    }
    for (let source = 0, target = 0; source < unfiltered.length; source += 4) {
        const alpha = unfiltered[source + 3];
        for (let channel = 0; channel < 3; channel++) {
            rgb[target++] = Math.round(unfiltered[source + channel] * alpha / 255);
        }
    }
    return { height, pixels: rgb, width };
};
