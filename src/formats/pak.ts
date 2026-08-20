import { assertRange, BinaryReader } from './binary';

const DIRECTORY_ENTRY_SIZE = 64;

export interface PakEntry {
    name: string;
    offset: number;
    length: number;
}

export class PakArchive {
    readonly bytes: Uint8Array;
    readonly reader: BinaryReader;
    readonly entries = new Map<string, PakEntry>();

    constructor(data: ArrayBuffer | Uint8Array) {
        this.bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        this.reader = new BinaryReader(this.bytes);
        this.parseDirectory();
    }

    private parseDirectory(): void {
        if (this.reader.string(0, 4) !== 'PACK') {
            throw new Error('Not a Quake PACK archive');
        }

        const directoryOffset = this.reader.int32(4);
        const directoryLength = this.reader.int32(8);
        assertRange(this.bytes, directoryOffset, directoryLength, 'PAK directory');
        if (directoryLength % DIRECTORY_ENTRY_SIZE !== 0) {
            throw new Error('Invalid PAK directory length');
        }

        for (let offset = directoryOffset;
            offset < directoryOffset + directoryLength;
            offset += DIRECTORY_ENTRY_SIZE) {
            const name = this.reader.string(offset, 56).replaceAll('\\', '/').toLowerCase();
            const fileOffset = this.reader.int32(offset + 56);
            const fileLength = this.reader.int32(offset + 60);
            assertRange(this.bytes, fileOffset, fileLength, `PAK entry ${name}`);
            this.entries.set(name, { name, offset: fileOffset, length: fileLength });
        }
    }

    has(name: string): boolean {
        return this.entries.has(name.replaceAll('\\', '/').toLowerCase());
    }

    get(name: string): Uint8Array {
        const normalizedName = name.replaceAll('\\', '/').toLowerCase();
        const entry = this.entries.get(normalizedName);
        if (!entry) {
            throw new Error(`PAK entry not found: ${normalizedName}`);
        }
        return this.bytes.subarray(entry.offset, entry.offset + entry.length);
    }

    list(prefix = ''): string[] {
        const normalizedPrefix = prefix.replaceAll('\\', '/').toLowerCase();
        return [...this.entries.keys()].filter(name => name.startsWith(normalizedPrefix));
    }
}
