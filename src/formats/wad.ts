import { assertRange, BinaryReader } from './binary';
import { parseIndexedPicture, type IndexedPicture } from './lmp';

export type { IndexedPicture } from './lmp';

const DIRECTORY_ENTRY_SIZE = 32;

export interface WadEntry {
    name: string;
    offset: number;
    diskSize: number;
    size: number;
    type: number;
}

export class WadArchive {
    readonly bytes: Uint8Array;
    readonly reader: BinaryReader;
    readonly entries = new Map<string, WadEntry>();

    constructor(data: ArrayBuffer | Uint8Array) {
        this.bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        this.reader = new BinaryReader(this.bytes);
        this.parseDirectory();
    }

    private parseDirectory(): void {
        const magic = this.reader.string(0, 4);
        if (magic !== 'WAD2') {
            throw new Error(`Unsupported WAD type ${magic}`);
        }
        const entryCount = this.reader.int32(4);
        const directoryOffset = this.reader.int32(8);
        assertRange(this.bytes, directoryOffset, entryCount * DIRECTORY_ENTRY_SIZE, 'WAD directory');

        for (let index = 0; index < entryCount; index++) {
            const offset = directoryOffset + index * DIRECTORY_ENTRY_SIZE;
            const fileOffset = this.reader.int32(offset);
            const diskSize = this.reader.int32(offset + 4);
            const size = this.reader.int32(offset + 8);
            const type = this.reader.uint8(offset + 12);
            const compression = this.reader.uint8(offset + 13);
            const name = this.reader.string(offset + 16, 16).toLowerCase();
            assertRange(this.bytes, fileOffset, diskSize, `WAD entry ${name}`);
            if (compression !== 0) {
                throw new Error(`Compressed WAD entry ${name} is unsupported`);
            }
            this.entries.set(name, { name, offset: fileOffset, diskSize, size, type });
        }
    }

    has(name: string): boolean {
        return this.entries.has(name.toLowerCase());
    }

    get(name: string): Uint8Array {
        const entry = this.entries.get(name.toLowerCase());
        if (!entry) {
            throw new Error(`WAD entry not found: ${name}`);
        }
        return this.bytes.subarray(entry.offset, entry.offset + entry.diskSize);
    }

    getPicture(name: string): IndexedPicture {
        return parseIndexedPicture(this.get(name), `WAD picture ${name}`);
    }
}
