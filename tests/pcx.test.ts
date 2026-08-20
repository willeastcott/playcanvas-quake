import { describe, expect, it } from 'vitest';

import { decodeIndexedPcx } from '../src/formats/pcx';

const indexedPcx = (): Uint8Array => {
    const bytes = new Uint8Array(128 + 8 + 769);
    bytes[0] = 0x0a;
    bytes[2] = 1;
    bytes[3] = 8;
    bytes[8] = 2;
    bytes[10] = 1;
    bytes[65] = 1;
    bytes[66] = 4;
    bytes.set([1, 2, 3, 0, 4, 5, 6, 0], 128);
    bytes[136] = 0x0c;
    return bytes;
};

describe('indexed PCX decoding', () => {
    it('decodes rows while removing their even-byte padding', () => {
        const image = decodeIndexedPcx(indexedPcx());

        expect(image.width).toBe(3);
        expect(image.height).toBe(2);
        expect([...image.pixels]).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('decodes RLE runs and rejects a truncated stream', () => {
        const encoded = indexedPcx();
        encoded.set([0xc4, 7, 0xc4, 8], 128);
        encoded[132] = 0x0c;
        expect([...decodeIndexedPcx(encoded).pixels]).toEqual([7, 7, 7, 8, 8, 8]);

        expect(() => decodeIndexedPcx(encoded.subarray(0, 129))).toThrow(
            'Truncated indexed PCX RLE run'
        );
    });
});
