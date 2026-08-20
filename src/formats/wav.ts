import { assertRange, BinaryReader } from './binary';

interface WavChunk {
    dataOffset: number;
    length: number;
    offset: number;
    tag: string;
}

export interface QuakeWavInfo {
    bitsPerSample: number;
    channelCount: number;
    dataOffset: number;
    loopEnd?: number;
    loopStart?: number;
    sampleCount: number;
    sampleRate: number;
}

export interface QuakeWavPcm {
    info: QuakeWavInfo;
    samples: Float32Array;
}

export const parseQuakeWavInfo = (
    data: ArrayBuffer | Uint8Array<ArrayBufferLike>
): QuakeWavInfo => {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const reader = new BinaryReader(bytes);
    assertRange(bytes, 0, 12, 'WAV header');
    if (reader.string(0, 4) !== 'RIFF' || reader.string(8, 4) !== 'WAVE') {
        throw new Error('Not a RIFF/WAVE sound');
    }
    const chunks: WavChunk[] = [];
    for (let offset = 12; offset + 8 <= bytes.length;) {
        const length = reader.int32(offset + 4);
        if (length < 0) break;
        const dataOffset = offset + 8;
        if (dataOffset + length > bytes.length) break;
        chunks.push({ dataOffset, length, offset, tag: reader.string(offset, 4) });
        offset = dataOffset + length + (length & 1);
    }
    const format = chunks.find(chunk => chunk.tag === 'fmt ');
    const samples = chunks.find(chunk => chunk.tag === 'data');
    if (!format || format.length < 16 || !samples) {
        throw new Error('WAV is missing format or sample data');
    }
    if (reader.uint16(format.dataOffset) !== 1) {
        throw new Error('Only PCM WAV sounds are supported');
    }
    const channelCount = reader.uint16(format.dataOffset + 2);
    const sampleRate = reader.uint32(format.dataOffset + 4);
    const blockAlign = reader.uint16(format.dataOffset + 12);
    const bitsPerSample = reader.uint16(format.dataOffset + 14);
    if (channelCount !== 1) {
        throw new Error('Only mono Quake WAV sounds are supported');
    }
    if (bitsPerSample !== 8 && bitsPerSample !== 16) {
        throw new Error('Only 8-bit and 16-bit Quake WAV sounds are supported');
    }
    const expectedBlockAlign = channelCount * bitsPerSample / 8;
    if (sampleRate <= 0 || blockAlign !== expectedBlockAlign) {
        throw new Error('WAV has an invalid sample rate or block alignment');
    }
    if (samples.length % blockAlign !== 0) {
        throw new Error('WAV sample data is not block aligned');
    }
    const sampleCount = samples.length / blockAlign;
    const baseInfo: QuakeWavInfo = {
        bitsPerSample,
        channelCount,
        dataOffset: samples.dataOffset,
        sampleCount,
        sampleRate
    };
    const cueIndex = chunks.findIndex(chunk => chunk.tag === 'cue ');
    if (cueIndex === -1 || chunks[cueIndex].length < 28) {
        return baseInfo;
    }
    const loopStart = reader.uint32(chunks[cueIndex].dataOffset + 24);
    let loopEnd = sampleCount;
    const marker = chunks.slice(cueIndex + 1).find(
        chunk => chunk.tag === 'LIST' && chunk.length >= 24 &&
            reader.string(chunk.offset + 28, 4) === 'mark'
    );
    if (marker) {
        loopEnd = loopStart + reader.uint32(marker.offset + 24);
    }
    if (loopStart >= loopEnd || loopEnd > sampleCount) {
        throw new Error('WAV has an invalid loop range');
    }
    return { ...baseInfo, loopEnd, loopStart };
};

export const decodeQuakeWavPcm = (
    data: ArrayBuffer | Uint8Array<ArrayBufferLike>
): QuakeWavPcm => {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const reader = new BinaryReader(bytes);
    const info = parseQuakeWavInfo(bytes);
    const samples = new Float32Array(info.sampleCount);
    if (info.bitsPerSample === 8) {
        for (let index = 0; index < samples.length; index++) {
            samples[index] = (reader.uint8(info.dataOffset + index) - 128) / 128;
        }
    } else {
        for (let index = 0; index < samples.length; index++) {
            samples[index] = reader.int16(info.dataOffset + index * 2) / 32_768;
        }
    }
    return { info, samples };
};
