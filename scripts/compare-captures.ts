import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import { decodeRgbPng, encodeRgbPng, type RgbImage } from '../src/formats/png.ts';

interface Options {
    candidate: string;
    hudHeight: number;
    outputPrefix: string;
    reference: string;
}

interface Metrics {
    mae: number;
    rmse: number;
}

const argumentValue = (args: string[], index: number, name: string): string => {
    const value = args[index + 1];
    if (value === undefined) throw new Error(`${name} requires a value`);
    return value;
};

const parseOptions = (args: string[]): Options => {
    const options: Options = { candidate: '', hudHeight: 48, outputPrefix: '', reference: '' };
    for (let index = 0; index < args.length; index++) {
        const name = args[index];
        if (name === '--candidate') {
            options.candidate = argumentValue(args, index++, name);
        } else if (name === '--reference') {
            options.reference = argumentValue(args, index++, name);
        } else if (name === '--output-prefix') {
            options.outputPrefix = argumentValue(args, index++, name);
        } else if (name === '--hud-height') {
            options.hudHeight = Number(argumentValue(args, index++, name));
        } else {
            throw new Error(`Unknown argument: ${name}`);
        }
    }
    if (!options.candidate || !options.reference || !options.outputPrefix) {
        throw new Error(
            'Usage: --reference native.png --candidate playcanvas.png --output-prefix comparison'
        );
    }
    if (!Number.isInteger(options.hudHeight) || options.hudHeight < 0) {
        throw new Error('--hud-height must be a non-negative integer');
    }
    return options;
};

const imageMetrics = (
    reference: RgbImage,
    candidate: RgbImage,
    startRow: number,
    endRow: number
): Metrics => {
    let absoluteError = 0;
    let squaredError = 0;
    const start = startRow * reference.width * 3;
    const end = endRow * reference.width * 3;
    for (let offset = start; offset < end; offset++) {
        const error = Math.abs(reference.pixels[offset] - candidate.pixels[offset]);
        absoluteError += error;
        squaredError += error * error;
    }
    const samples = end - start;
    return {
        mae: samples === 0 ? 0 : absoluteError / samples,
        rmse: samples === 0 ? 0 : Math.sqrt(squaredError / samples)
    };
};

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const options = parseOptions(process.argv.slice(2));
const [referenceBytes, candidateBytes] = await Promise.all([
    readFile(options.reference),
    readFile(options.candidate)
]);
const reference = decodeRgbPng(referenceBytes);
const candidate = decodeRgbPng(candidateBytes);
if (reference.width !== candidate.width || reference.height !== candidate.height) {
    throw new Error(
        `Capture dimensions differ: ${reference.width}x${reference.height} versus ${candidate.width}x${candidate.height}`
    );
}
if (options.hudHeight > reference.height) {
    throw new Error('--hud-height exceeds the capture height');
}

const sideBySide = new Uint8Array(reference.width * 2 * reference.height * 3);
const overlay = new Uint8Array(reference.pixels.length);
const difference = new Uint8Array(reference.pixels.length);
for (let row = 0; row < reference.height; row++) {
    const sourceOffset = row * reference.width * 3;
    const targetOffset = row * reference.width * 6;
    sideBySide.set(
        reference.pixels.subarray(sourceOffset, sourceOffset + reference.width * 3),
        targetOffset
    );
    sideBySide.set(
        candidate.pixels.subarray(sourceOffset, sourceOffset + candidate.width * 3),
        targetOffset + reference.width * 3
    );
}
for (let offset = 0; offset < reference.pixels.length; offset++) {
    overlay[offset] = Math.round((reference.pixels[offset] + candidate.pixels[offset]) / 2);
    difference[offset] = Math.abs(reference.pixels[offset] - candidate.pixels[offset]);
}

const outputs = {
    difference: `${options.outputPrefix}-difference.png`,
    overlay: `${options.outputPrefix}-overlay.png`,
    sideBySide: `${options.outputPrefix}-side-by-side.png`
};
await Promise.all([
    writeFile(outputs.sideBySide, encodeRgbPng(sideBySide, reference.width * 2, reference.height)),
    writeFile(outputs.overlay, encodeRgbPng(overlay, reference.width, reference.height)),
    writeFile(outputs.difference, encodeRgbPng(difference, reference.width, reference.height))
]);
const gameplayHeight = reference.height - options.hudHeight;
process.stdout.write(`${JSON.stringify({
    candidateSha256: sha256(candidateBytes),
    dimensions: [reference.width, reference.height],
    fullFrame: imageMetrics(reference, candidate, 0, reference.height),
    gameplay: imageMetrics(reference, candidate, 0, gameplayHeight),
    hud: imageMetrics(reference, candidate, gameplayHeight, reference.height),
    outputs,
    referenceSha256: sha256(referenceBytes)
}, null, 2)}\n`);
