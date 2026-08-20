const decoder = new TextDecoder('windows-1252');

export class BinaryReader {
    readonly bytes: Uint8Array<ArrayBufferLike>;
    readonly view: DataView;

    constructor(data: ArrayBuffer | Uint8Array<ArrayBufferLike>) {
        this.bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    }

    int8(offset: number): number {
        return this.view.getInt8(offset);
    }

    uint8(offset: number): number {
        return this.view.getUint8(offset);
    }

    int16(offset: number): number {
        return this.view.getInt16(offset, true);
    }

    uint16(offset: number): number {
        return this.view.getUint16(offset, true);
    }

    int32(offset: number): number {
        return this.view.getInt32(offset, true);
    }

    uint32(offset: number): number {
        return this.view.getUint32(offset, true);
    }

    float32(offset: number): number {
        return this.view.getFloat32(offset, true);
    }

    string(offset: number, length: number): string {
        const bytes = this.bytes.subarray(offset, offset + length);
        const terminator = bytes.indexOf(0);
        return decoder.decode(terminator === -1 ? bytes : bytes.subarray(0, terminator));
    }

    slice(offset: number, length: number): Uint8Array<ArrayBufferLike> {
        return this.bytes.subarray(offset, offset + length);
    }
}

export const assertRange = (
    bytes: Uint8Array<ArrayBufferLike>,
    offset: number,
    length: number,
    label: string
): void => {
    if (!Number.isInteger(offset) || !Number.isInteger(length) ||
        offset < 0 || length < 0 || offset + length > bytes.byteLength) {
        throw new Error(`${label} points outside the file (${offset} + ${length})`);
    }
};
