import { assertRange, BinaryReader } from './binary';

export const SPRITE_VERSION = 1;

const SPRITE_IDENT = 'IDSP';
const HEADER_SIZE = 36;

export enum SpriteType {
    ViewParallelUpright = 0,
    FacingUpright = 1,
    ViewParallel = 2,
    Oriented = 3,
    ViewParallelOriented = 4
}

export interface SpriteFrame {
    height: number;
    origin: [number, number];
    pixels: Uint8Array<ArrayBufferLike>;
    width: number;
}

export interface SpriteFrameGroup {
    frames: SpriteFrame[];
    intervals: number[];
}

export class SpriteModel {
    readonly bytes: Uint8Array<ArrayBufferLike>;
    readonly reader: BinaryReader;
    boundingRadius = 0;
    beamLength = 0;
    frameCount = 0;
    frames: SpriteFrameGroup[] = [];
    height = 0;
    offset = HEADER_SIZE;
    syncType = 0;
    type = SpriteType.ViewParallel;
    version = 0;
    width = 0;

    constructor(data: ArrayBuffer | Uint8Array<ArrayBufferLike>) {
        this.bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        this.reader = new BinaryReader(this.bytes);
        this.parseHeader();
        this.parseFrames();
    }

    private parseHeader(): void {
        assertRange(this.bytes, 0, HEADER_SIZE, 'SPR header');
        if (this.reader.string(0, 4) !== SPRITE_IDENT) {
            throw new Error('Not a Quake sprite model');
        }
        this.version = this.reader.int32(4);
        if (this.version !== SPRITE_VERSION) {
            throw new Error(`Unsupported sprite version ${this.version}`);
        }
        this.type = this.reader.int32(8);
        if (this.type < SpriteType.ViewParallelUpright ||
            this.type > SpriteType.ViewParallelOriented) {
            throw new Error(`Unsupported sprite orientation ${this.type}`);
        }
        this.boundingRadius = this.reader.float32(12);
        this.width = this.reader.int32(16);
        this.height = this.reader.int32(20);
        this.frameCount = this.reader.int32(24);
        this.beamLength = this.reader.float32(28);
        this.syncType = this.reader.int32(32);
        if (this.width <= 0 || this.height <= 0 || this.frameCount <= 0) {
            throw new Error('Sprite has invalid dimensions or frame count');
        }
    }

    private parseFrame(label: string): SpriteFrame {
        assertRange(this.bytes, this.offset, 16, `${label} header`);
        const origin: [number, number] = [
            this.reader.int32(this.offset),
            this.reader.int32(this.offset + 4)
        ];
        const width = this.reader.int32(this.offset + 8);
        const height = this.reader.int32(this.offset + 12);
        this.offset += 16;
        if (width <= 0 || height <= 0) {
            throw new Error(`${label} has invalid dimensions`);
        }
        const pixelCount = width * height;
        assertRange(this.bytes, this.offset, pixelCount, `${label} pixels`);
        const pixels = this.reader.slice(this.offset, pixelCount);
        this.offset += pixelCount;
        return { height, origin, pixels, width };
    }

    private parseFrames(): void {
        for (let frameIndex = 0; frameIndex < this.frameCount; frameIndex++) {
            assertRange(this.bytes, this.offset, 4, `SPR frame ${frameIndex} type`);
            const grouped = this.reader.int32(this.offset);
            this.offset += 4;
            if (grouped === 0) {
                this.frames.push({
                    frames: [this.parseFrame(`SPR frame ${frameIndex}`)],
                    intervals: [0]
                });
                continue;
            }
            if (grouped !== 1) {
                throw new Error(`Unsupported SPR frame type ${grouped}`);
            }
            assertRange(this.bytes, this.offset, 4, `SPR group ${frameIndex}`);
            const count = this.reader.int32(this.offset);
            this.offset += 4;
            if (count <= 0) {
                throw new Error(`SPR group ${frameIndex} is empty`);
            }
            assertRange(this.bytes, this.offset, count * 4, `SPR group ${frameIndex} intervals`);
            const intervals: number[] = [];
            for (let subframe = 0; subframe < count; subframe++) {
                const interval = this.reader.float32(this.offset);
                this.offset += 4;
                if (interval <= 0) {
                    throw new Error(`SPR group ${frameIndex} has a non-positive interval`);
                }
                intervals.push(interval);
            }
            const frames: SpriteFrame[] = [];
            for (let subframe = 0; subframe < count; subframe++) {
                frames.push(this.parseFrame(`SPR group ${frameIndex} frame ${subframe}`));
            }
            this.frames.push({ frames, intervals });
        }
        if (this.offset > this.bytes.length) {
            throw new Error('Sprite extends beyond its file');
        }
    }
}
