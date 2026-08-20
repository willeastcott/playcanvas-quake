import { describe, expect, it } from 'vitest';

import { decodeQuakeWavPcm, parseQuakeWavInfo } from '../src/formats/wav';

const writeTag = (bytes: Uint8Array, offset: number, tag: string): void => {
    for (let index = 0; index < tag.length; index++) {
        bytes[offset + index] = tag.charCodeAt(index);
    }
};

const monoPcmWav = (bitsPerSample: 8 | 16, values: number[]): Uint8Array => {
    const bytesPerSample = bitsPerSample / 8;
    const sampleRate = bitsPerSample === 8 ? 11_025 : 22_050;
    const dataLength = values.length * bytesPerSample;
    const bytes = new Uint8Array(44 + dataLength);
    const view = new DataView(bytes.buffer);
    writeTag(bytes, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeTag(bytes, 8, 'WAVE');
    writeTag(bytes, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, bitsPerSample, true);
    writeTag(bytes, 36, 'data');
    view.setUint32(40, dataLength, true);
    values.forEach((value, index) => {
        if (bitsPerSample === 8) {
            view.setUint8(44 + index, value);
        } else {
            view.setInt16(44 + index * 2, value, true);
        }
    });
    return bytes;
};

describe('Quake PCM WAV decoding', () => {
    it('maps unsigned eight-bit samples to the source signed range', () => {
        const wav = monoPcmWav(8, [0, 1, 127, 128, 129, 254, 255]);
        const decoded = decodeQuakeWavPcm(wav);

        expect(decoded.info).toMatchObject({
            bitsPerSample: 8,
            channelCount: 1,
            dataOffset: 44,
            sampleCount: 7,
            sampleRate: 11_025
        });
        expect([...decoded.samples]).toEqual([
            -1, -127 / 128, -1 / 128, 0, 1 / 128, 126 / 128, 127 / 128
        ]);
    });

    it('maps little-endian signed sixteen-bit samples without browser decoding', () => {
        const wav = monoPcmWav(16, [-32_768, -1, 0, 1, 32_767]);
        const decoded = decodeQuakeWavPcm(wav);

        expect(decoded.info).toMatchObject({
            bitsPerSample: 16,
            channelCount: 1,
            dataOffset: 44,
            sampleCount: 5,
            sampleRate: 22_050
        });
        expect([...decoded.samples]).toEqual([
            -1, -1 / 32_768, 0, 1 / 32_768, 32_767 / 32_768
        ]);
    });

    it('rejects formats that the original mono mixer cannot consume', () => {
        const stereo = monoPcmWav(8, [0, 255]);
        new DataView(stereo.buffer).setUint16(22, 2, true);
        expect(() => parseQuakeWavInfo(stereo)).toThrow(/Only mono/);

        const twentyFourBit = monoPcmWav(8, [0, 128, 255]);
        const view = new DataView(twentyFourBit.buffer);
        view.setUint16(32, 3, true);
        view.setUint16(34, 24, true);
        expect(() => parseQuakeWavInfo(twentyFourBit)).toThrow(/8-bit and 16-bit/);
    });

    it('stops at malformed trailing chunks like the source scanner', () => {
        const wav = monoPcmWav(8, [0, 128, 255, 64]);
        const withTrailingChunk = (length: number): Uint8Array => {
            const extended = new Uint8Array(wav.length + 8);
            extended.set(wav);
            writeTag(extended, wav.length, 'LIST');
            new DataView(extended.buffer).setInt32(wav.length + 4, length, true);
            return extended;
        };

        expect([...decodeQuakeWavPcm(withTrailingChunk(-1)).samples]).toEqual([
            -1, 0, 127 / 128, -0.5
        ]);
        expect([...decodeQuakeWavPcm(withTrailingChunk(24)).samples]).toEqual([
            -1, 0, 127 / 128, -0.5
        ]);
    });
});
