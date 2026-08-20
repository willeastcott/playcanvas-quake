export interface IndexedPcx {
    height: number;
    pixels: Uint8Array<ArrayBuffer>;
    width: number;
}

const PCX_HEADER_SIZE = 128;
const PCX_PALETTE_SIZE = 769;

const uint16 = (bytes: Uint8Array<ArrayBufferLike>, offset: number): number => (
    bytes[offset] | (bytes[offset + 1] << 8)
);

export const decodeIndexedPcx = (
    bytes: Uint8Array<ArrayBufferLike>
): IndexedPcx => {
    if (bytes.length < PCX_HEADER_SIZE || bytes[0] !== 0x0a ||
        bytes[2] !== 1 || bytes[3] !== 8) {
        throw new Error('Expected an RLE-encoded 8-bit PCX image');
    }
    if (bytes[65] !== 1) {
        throw new Error(`Expected a one-plane indexed PCX, got ${bytes[65]} planes`);
    }
    const xMinimum = uint16(bytes, 4);
    const yMinimum = uint16(bytes, 6);
    const width = uint16(bytes, 8) - xMinimum + 1;
    const height = uint16(bytes, 10) - yMinimum + 1;
    const bytesPerLine = uint16(bytes, 66);
    if (width <= 0 || height <= 0 || bytesPerLine < width) {
        throw new Error(
            `Invalid indexed PCX dimensions ${width}x${height} with stride ${bytesPerLine}`
        );
    }
    const paletteOffset = bytes.length >= PCX_HEADER_SIZE + PCX_PALETTE_SIZE &&
        bytes[bytes.length - PCX_PALETTE_SIZE] === 0x0c ?
        bytes.length - PCX_PALETTE_SIZE : bytes.length;
    const decoded = new Uint8Array(bytesPerLine * height);
    let inputOffset = PCX_HEADER_SIZE;
    let outputOffset = 0;
    while (outputOffset < decoded.length) {
        if (inputOffset >= paletteOffset) {
            throw new Error('Truncated indexed PCX pixel stream');
        }
        const token = bytes[inputOffset++];
        const runLength = (token & 0xc0) === 0xc0 ? token & 0x3f : 1;
        if (runLength === 0 || outputOffset + runLength > decoded.length) {
            throw new Error('Invalid indexed PCX RLE run');
        }
        if ((token & 0xc0) === 0xc0 && inputOffset >= paletteOffset) {
            throw new Error('Truncated indexed PCX RLE run');
        }
        const value = (token & 0xc0) === 0xc0 ? bytes[inputOffset++] : token;
        decoded.fill(value, outputOffset, outputOffset + runLength);
        outputOffset += runLength;
    }
    const pixels = new Uint8Array(width * height);
    for (let row = 0; row < height; row++) {
        pixels.set(
            decoded.subarray(row * bytesPerLine, row * bytesPerLine + width),
            row * width
        );
    }
    return { height, pixels, width };
};
