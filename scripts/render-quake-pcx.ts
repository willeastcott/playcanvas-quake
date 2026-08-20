import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';

import { decodeIndexedPcx } from '../src/formats/pcx.ts';
import { encodeRgbPng } from '../src/formats/png.ts';

interface PaletteShift {
    color: readonly [number, number, number];
    percent: number;
}

interface Options {
    gamma: number;
    input: string;
    output: string;
    pak: string;
    shifts: PaletteShift[];
}

const argumentValue = (args: string[], index: number, name: string): string => {
    const value = args[index + 1];
    if (value === undefined) throw new Error(`${name} requires a value`);
    return value;
};

const parseShift = (value: string): PaletteShift => {
    const components = value.split(',').map(Number);
    if (components.length !== 4 || components.some(component => !Number.isFinite(component))) {
        throw new Error('--shift requires red,green,blue,percent');
    }
    const [red, green, blue, percent] = components;
    if ([red, green, blue].some(component => component < 0 || component > 255)) {
        throw new Error('--shift colors must be between 0 and 255');
    }
    return {
        color: [Math.trunc(red), Math.trunc(green), Math.trunc(blue)],
        percent: Math.trunc(percent)
    };
};

const parseOptions = (args: string[]): Options => {
    const options: Options = {
        gamma: 1,
        input: '',
        output: '',
        pak: '',
        shifts: []
    };
    for (let index = 0; index < args.length; index++) {
        const name = args[index];
        if (name === '--input') options.input = argumentValue(args, index++, name);
        else if (name === '--output') options.output = argumentValue(args, index++, name);
        else if (name === '--pak') options.pak = argumentValue(args, index++, name);
        else if (name === '--gamma') {
            options.gamma = Number(argumentValue(args, index++, name));
        } else if (name === '--shift') {
            options.shifts.push(parseShift(argumentValue(args, index++, name)));
        } else {
            throw new Error(`Unknown argument: ${name}`);
        }
    }
    if (!options.input || !options.output || !options.pak) {
        throw new Error('Usage: --pak pak0.pak --input image.pcx --output image.rgb|image.png [--shift r,g,b,percent] [--gamma value]');
    }
    if (!Number.isFinite(options.gamma) || options.gamma <= 0) {
        throw new Error('--gamma must be a positive finite number');
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

const shiftedPalette = (
    palette: Uint8Array<ArrayBufferLike>,
    shifts: readonly PaletteShift[],
    gamma: number
): Uint8Array<ArrayBuffer> => {
    if (palette.length !== 768) {
        throw new Error(`Expected a 768-byte Quake palette, got ${palette.length}`);
    }
    const output = Uint8Array.from(palette);
    for (let offset = 0; offset < output.length; offset += 3) {
        for (const shift of shifts) {
            for (let channel = 0; channel < 3; channel++) {
                const value = output[offset + channel];
                output[offset + channel] = value +
                    ((shift.percent * (shift.color[channel] - value)) >> 8);
            }
        }
    }
    if (gamma !== 1) {
        for (let offset = 0; offset < output.length; offset++) {
            output[offset] = Math.max(0, Math.min(255, Math.trunc(
                255 * ((output[offset] + 0.5) / 255.5) ** gamma + 0.5
            )));
        }
    }
    return output;
};

const options = parseOptions(process.argv.slice(2));
const [pakBytes, pcxBytes] = await Promise.all([
    readFile(options.pak),
    readFile(options.input)
]);
const palette = shiftedPalette(
    pakEntry(pakBytes, 'gfx/palette.lmp'),
    options.shifts,
    options.gamma
);
const image = decodeIndexedPcx(pcxBytes);
const rgb = new Uint8Array(image.pixels.length * 3);
for (let index = 0; index < image.pixels.length; index++) {
    const paletteOffset = image.pixels[index] * 3;
    rgb.set(palette.subarray(paletteOffset, paletteOffset + 3), index * 3);
}
const pngOutput = extname(options.output).toLowerCase() === '.png';
await writeFile(
    options.output,
    pngOutput ? encodeRgbPng(rgb, image.width, image.height) : rgb
);
process.stdout.write(`${JSON.stringify({
    format: pngOutput ? 'png' : 'rgb',
    height: image.height,
    output: options.output,
    shifts: options.shifts,
    width: image.width
})}\n`);
