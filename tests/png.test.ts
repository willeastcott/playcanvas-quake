import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
    decodeRgbPng,
    encodeIndexedPng,
    encodeRgbPng,
    encodeRgbaPng
} from '../src/formats/png';

const readUint32 = (bytes: Uint8Array, offset: number): number => (
    new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false)
);

describe('RGB PNG encoder', () => {
    it('writes lossless 8-bit truecolor scanlines', () => {
        const rgb = Uint8Array.from([
            255, 0, 0, 0, 255, 0,
            0, 0, 255, 255, 255, 255
        ]);
        const png = encodeRgbPng(rgb, 2, 2);

        expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
        expect(new TextDecoder().decode(png.subarray(12, 16))).toBe('IHDR');
        expect(readUint32(png, 16)).toBe(2);
        expect(readUint32(png, 20)).toBe(2);
        expect([...png.subarray(24, 29)]).toEqual([8, 2, 0, 0, 0]);

        const idatOffset = 8 + 12 + readUint32(png, 8);
        expect(new TextDecoder().decode(png.subarray(idatOffset + 4, idatOffset + 8)))
        .toBe('IDAT');
        const compressedLength = readUint32(png, idatOffset);
        const scanlines = inflateSync(
            png.subarray(idatOffset + 8, idatOffset + 8 + compressedLength)
        );
        expect([...scanlines]).toEqual([
            0, 255, 0, 0, 0, 255, 0,
            0, 0, 0, 255, 255, 255, 255
        ]);
        expect(decodeRgbPng(png)).toEqual({ height: 2, pixels: rgb, width: 2 });
    });

    it('decodes browser-style RGBA output to RGB', () => {
        const rgba = Uint8Array.from([255, 64, 0, 255, 255, 255, 255, 128]);
        expect(decodeRgbPng(encodeRgbaPng(rgba, 2, 1))).toEqual({
            height: 1,
            pixels: Uint8Array.from([255, 64, 0, 128, 128, 128]),
            width: 2
        });
    });

    it('decodes lossless 8-bit indexed reference captures through their palette', () => {
        const indices = Uint8Array.from([0, 1, 2, 1]);
        const palette = Uint8Array.from([
            8, 16, 24,
            32, 64, 96,
            255, 128, 0
        ]);
        expect(decodeRgbPng(encodeIndexedPng(indices, palette, 2, 2))).toEqual({
            height: 2,
            pixels: Uint8Array.from([
                8, 16, 24, 32, 64, 96,
                255, 128, 0, 32, 64, 96
            ]),
            width: 2
        });
    });

    it('rejects invalid dimensions and byte counts', () => {
        expect(() => encodeRgbPng(new Uint8Array(), 0, 1)).toThrow(
            'PNG dimensions must be positive integers'
        );
        expect(() => encodeRgbPng(new Uint8Array(5), 1, 2)).toThrow(
            'Expected 6 RGB bytes, got 5'
        );
    });
});
