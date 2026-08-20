import { readFile, writeFile } from 'node:fs/promises';

import { decodeRgbPng, encodeRgbPng } from '../src/formats/png.ts';

interface Options {
    background: string;
    output: string;
    pak: string;
}

const argumentValue = (args: string[], index: number, name: string): string => {
    const value = args[index + 1];
    if (value === undefined) throw new Error(`${name} requires a value`);
    return value;
};

const parseOptions = (args: string[]): Options => {
    const options: Options = { background: '', output: '', pak: '' };
    for (let index = 0; index < args.length; index++) {
        const name = args[index];
        if (name === '--background') {
            options.background = argumentValue(args, index++, name);
        } else if (name === '--output') {
            options.output = argumentValue(args, index++, name);
        } else if (name === '--pak') {
            options.pak = argumentValue(args, index++, name);
        } else {
            throw new Error(`Unknown argument: ${name}`);
        }
    }
    if (!options.background || !options.output || !options.pak) {
        throw new Error(
            'Usage: --pak pak0.pak --background native.png --output loading.png'
        );
    }
    return options;
};

const int32 = (bytes: Uint8Array<ArrayBufferLike>, offset: number): number => (
    new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getInt32(0, true)
);

const pakEntry = (
    bytes: Uint8Array<ArrayBufferLike>,
    requestedName: string
): Uint8Array<ArrayBufferLike> => {
    if (new TextDecoder().decode(bytes.subarray(0, 4)) !== 'PACK') {
        throw new Error('Not a Quake PACK archive');
    }
    const directoryOffset = int32(bytes, 4);
    const directoryLength = int32(bytes, 8);
    if (directoryOffset < 0 || directoryLength < 0 || directoryLength % 64 !== 0 ||
        directoryOffset + directoryLength > bytes.length) {
        throw new Error('Invalid Quake PACK directory');
    }
    const normalizedName = requestedName.toLowerCase();
    for (let offset = directoryOffset;
        offset < directoryOffset + directoryLength;
        offset += 64) {
        const terminator = bytes.subarray(offset, offset + 56).indexOf(0);
        const nameLength = terminator < 0 ? 56 : terminator;
        const name = new TextDecoder().decode(
            bytes.subarray(offset, offset + nameLength)
        ).replaceAll('\\', '/').toLowerCase();
        if (name !== normalizedName) continue;
        const entryOffset = int32(bytes, offset + 56);
        const entryLength = int32(bytes, offset + 60);
        if (entryOffset < 0 || entryLength < 0 ||
            entryOffset + entryLength > bytes.length) {
            throw new Error(`Invalid Quake PACK entry ${requestedName}`);
        }
        return bytes.subarray(entryOffset, entryOffset + entryLength);
    }
    throw new Error(`Quake PACK entry not found: ${requestedName}`);
};

const options = parseOptions(process.argv.slice(2));
const [pakBytes, backgroundBytes] = await Promise.all([
    readFile(options.pak),
    readFile(options.background)
]);
const background = decodeRgbPng(backgroundBytes);
if (background.width !== 320 || background.height !== 200) {
    throw new Error(
        `Expected a 320x200 native Quake frame, got ${background.width}x${background.height}`
    );
}

const plaqueBytes = pakEntry(pakBytes, 'gfx/loading.lmp');
if (plaqueBytes.length < 8) throw new Error('gfx/loading.lmp is truncated');
const plaque = {
    height: int32(plaqueBytes, 4),
    pixels: plaqueBytes.subarray(8),
    width: int32(plaqueBytes, 0)
};
if (plaque.width <= 0 || plaque.height <= 0 ||
    plaque.pixels.length !== plaque.width * plaque.height) {
    throw new Error('gfx/loading.lmp has invalid dimensions');
}
const palette = pakEntry(pakBytes, 'gfx/palette.lmp');
if (palette.length !== 768) {
    throw new Error(`Expected a 768-byte Quake palette, got ${palette.length}`);
}

// WinQuake SCR_DrawLoading uses opaque Draw_Pic at these exact 320x200 coordinates.
const left = Math.trunc((background.width - plaque.width) / 2);
const top = Math.trunc((background.height - 48 - plaque.height) / 2);
const pixels = Uint8Array.from(background.pixels);
for (let y = 0; y < plaque.height; y++) {
    for (let x = 0; x < plaque.width; x++) {
        const paletteOffset = plaque.pixels[y * plaque.width + x] * 3;
        const outputOffset = ((top + y) * background.width + left + x) * 3;
        pixels.set(palette.subarray(paletteOffset, paletteOffset + 3), outputOffset);
    }
}

await writeFile(options.output, encodeRgbPng(pixels, background.width, background.height));
process.stdout.write(`${JSON.stringify({
    background: options.background,
    dimensions: [background.width, background.height],
    output: options.output,
    plaque: {
        height: plaque.height,
        left,
        top,
        width: plaque.width
    }
}, null, 2)}\n`);
