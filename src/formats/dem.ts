import { assertRange, BinaryReader } from './binary';

const MAX_DEMO_HEADER_BYTES = 64;
export const QUAKE_MAX_MESSAGE_BYTES = 8_000;

export type QuakeDemoAngles = readonly [number, number, number];

export interface QuakeDemoMessage {
    readonly data: Uint8Array<ArrayBufferLike>;
    readonly fileOffset: number;
    readonly viewAngles: QuakeDemoAngles;
}

export interface QuakeDemo {
    readonly forcedTrack: number;
    readonly messages: readonly QuakeDemoMessage[];
}

const headerDecoder = new TextDecoder('ascii');

export const parseQuakeDemo = (
    data: ArrayBuffer | Uint8Array<ArrayBufferLike>
): QuakeDemo => {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const reader = new BinaryReader(bytes);
    const headerLimit = Math.min(bytes.length, MAX_DEMO_HEADER_BYTES);
    const lineFeed = bytes.subarray(0, headerLimit).indexOf(10);
    if (lineFeed === -1) {
        throw new Error('Quake demo has no forced-track header terminator');
    }
    const header = headerDecoder.decode(bytes.subarray(0, lineFeed));
    if (!/^-?\d+$/u.test(header)) {
        throw new Error(`Quake demo has invalid forced track: ${header}`);
    }
    const forcedTrack = Number(header);
    if (!Number.isSafeInteger(forcedTrack)) {
        throw new Error(`Quake demo forced track is out of range: ${header}`);
    }

    const messages: QuakeDemoMessage[] = [];
    let offset = lineFeed + 1;
    while (offset < bytes.length) {
        assertRange(bytes, offset, 16, `Quake demo message ${messages.length} header`);
        const fileOffset = offset;
        const length = reader.int32(offset);
        if (length < 0 || length > QUAKE_MAX_MESSAGE_BYTES) {
            throw new Error(`Quake demo message ${messages.length} has invalid length ${length}`);
        }
        const viewAngles = [
            reader.float32(offset + 4),
            reader.float32(offset + 8),
            reader.float32(offset + 12)
        ] as const;
        if (!viewAngles.every(Number.isFinite)) {
            throw new Error(`Quake demo message ${messages.length} has invalid view angles`);
        }
        offset += 16;
        assertRange(bytes, offset, length, `Quake demo message ${messages.length}`);
        messages.push({
            data: bytes.subarray(offset, offset + length),
            fileOffset,
            viewAngles
        });
        offset += length;
    }

    return { forcedTrack, messages };
};
