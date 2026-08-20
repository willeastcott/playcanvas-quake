import { assertRange, BinaryReader } from './binary';

export interface IndexedPicture {
    height: number;
    pixels: Uint8Array<ArrayBufferLike>;
    width: number;
}

export const parseIndexedPicture = (
    data: ArrayBuffer | Uint8Array<ArrayBufferLike>,
    label = 'Quake picture'
): IndexedPicture => {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    assertRange(bytes, 0, 8, `${label} header`);
    const reader = new BinaryReader(bytes);
    const width = reader.int32(0);
    const height = reader.int32(4);
    if (width <= 0 || height <= 0) {
        throw new Error(`${label} has invalid dimensions`);
    }
    assertRange(bytes, 8, width * height, `${label} pixels`);
    return { height, pixels: bytes.subarray(8, 8 + width * height), width };
};
