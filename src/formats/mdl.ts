import { assertRange, BinaryReader } from './binary';
import type { Vec3 } from './bsp';

const MDL_IDENT = 'IDPO';
const MDL_VERSION = 6;
const HEADER_SIZE = 84;

export interface PackedAliasVertex {
    vertex: Vec3;
    normalIndex: number;
}

export interface AliasSkin {
    intervals: number[];
    pixels: Array<Uint8Array<ArrayBufferLike>>;
}

export interface AliasTextureVertex {
    onSeam: boolean;
    s: number;
    t: number;
}

export interface AliasTriangle {
    facesFront: boolean;
    vertices: [number, number, number];
}

export interface AliasSimpleFrame {
    boundsMin: PackedAliasVertex;
    boundsMax: PackedAliasVertex;
    name: string;
    packedVertices: PackedAliasVertex[];
    vertices: Vec3[];
}

export interface AliasFrameGroup {
    intervals: number[];
    frames: AliasSimpleFrame[];
}

const readTrivert = (reader: BinaryReader, offset: number): PackedAliasVertex => ({
    vertex: [reader.uint8(offset), reader.uint8(offset + 1), reader.uint8(offset + 2)],
    normalIndex: reader.uint8(offset + 3)
});

export class AliasModel {
    readonly bytes: Uint8Array<ArrayBufferLike>;
    readonly reader: BinaryReader;
    offset = HEADER_SIZE;
    version = 0;
    scale: Vec3 = [0, 0, 0];
    scaleOrigin: Vec3 = [0, 0, 0];
    boundingRadius = 0;
    eyePosition: Vec3 = [0, 0, 0];
    skinCount = 0;
    skinWidth = 0;
    skinHeight = 0;
    vertexCount = 0;
    triangleCount = 0;
    frameCount = 0;
    syncType = 0;
    flags = 0;
    size = 0;
    skins: AliasSkin[] = [];
    textureVertices: AliasTextureVertex[] = [];
    triangles: AliasTriangle[] = [];
    frames: AliasFrameGroup[] = [];

    constructor(data: ArrayBuffer | Uint8Array<ArrayBufferLike>) {
        this.bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        this.reader = new BinaryReader(this.bytes);
        this.parseHeader();
        this.parseSkins();
        this.parseTextureVertices();
        this.parseTriangles();
        this.parseFrames();
    }

    private parseHeader(): void {
        if (this.reader.string(0, 4) !== MDL_IDENT) {
            throw new Error('Not a Quake alias model');
        }
        this.version = this.reader.int32(4);
        if (this.version !== MDL_VERSION) {
            throw new Error(`Unsupported alias model version ${this.version}`);
        }
        this.scale = [
            this.reader.float32(8),
            this.reader.float32(12),
            this.reader.float32(16)
        ];
        this.scaleOrigin = [
            this.reader.float32(20),
            this.reader.float32(24),
            this.reader.float32(28)
        ];
        this.boundingRadius = this.reader.float32(32);
        this.eyePosition = [
            this.reader.float32(36),
            this.reader.float32(40),
            this.reader.float32(44)
        ];
        this.skinCount = this.reader.int32(48);
        this.skinWidth = this.reader.int32(52);
        this.skinHeight = this.reader.int32(56);
        this.vertexCount = this.reader.int32(60);
        this.triangleCount = this.reader.int32(64);
        this.frameCount = this.reader.int32(68);
        this.syncType = this.reader.int32(72);
        this.flags = this.reader.int32(76);
        this.size = this.reader.float32(80);
    }

    private parseSkins(): void {
        const pixelCount = this.skinWidth * this.skinHeight;
        this.skins = [];
        for (let skinIndex = 0; skinIndex < this.skinCount; skinIndex++) {
            const group = this.reader.int32(this.offset);
            this.offset += 4;
            if (group === 0) {
                assertRange(this.bytes, this.offset, pixelCount, `MDL skin ${skinIndex}`);
                this.skins.push({ intervals: [0], pixels: [this.reader.slice(this.offset, pixelCount)] });
                this.offset += pixelCount;
                continue;
            }
            const count = this.reader.int32(this.offset);
            this.offset += 4;
            const intervals: number[] = [];
            for (let index = 0; index < count; index++) {
                intervals.push(this.reader.float32(this.offset));
                this.offset += 4;
            }
            const pixels: Array<Uint8Array<ArrayBufferLike>> = [];
            for (let index = 0; index < count; index++) {
                assertRange(this.bytes, this.offset, pixelCount, `MDL grouped skin ${skinIndex}`);
                pixels.push(this.reader.slice(this.offset, pixelCount));
                this.offset += pixelCount;
            }
            this.skins.push({ intervals, pixels });
        }
    }

    private parseTextureVertices(): void {
        this.textureVertices = [];
        for (let index = 0; index < this.vertexCount; index++) {
            this.textureVertices.push({
                onSeam: this.reader.int32(this.offset) !== 0,
                s: this.reader.int32(this.offset + 4),
                t: this.reader.int32(this.offset + 8)
            });
            this.offset += 12;
        }
    }

    private parseTriangles(): void {
        this.triangles = [];
        for (let index = 0; index < this.triangleCount; index++) {
            this.triangles.push({
                facesFront: this.reader.int32(this.offset) !== 0,
                vertices: [
                    this.reader.int32(this.offset + 4),
                    this.reader.int32(this.offset + 8),
                    this.reader.int32(this.offset + 12)
                ]
            });
            this.offset += 16;
        }
    }

    private parseSimpleFrame(): AliasSimpleFrame {
        const boundsMin = readTrivert(this.reader, this.offset);
        const boundsMax = readTrivert(this.reader, this.offset + 4);
        const name = this.reader.string(this.offset + 8, 16);
        this.offset += 24;
        const packedVertices: PackedAliasVertex[] = [];
        const vertices: Vec3[] = [];
        for (let index = 0; index < this.vertexCount; index++) {
            const packed = readTrivert(this.reader, this.offset);
            packedVertices.push(packed);
            vertices.push(packed.vertex.map(
                (value, axis) => value * this.scale[axis] + this.scaleOrigin[axis]
            ) as Vec3);
            this.offset += 4;
        }
        return { boundsMin, boundsMax, name, packedVertices, vertices };
    }

    private parseFrames(): void {
        this.frames = [];
        for (let frameIndex = 0; frameIndex < this.frameCount; frameIndex++) {
            const group = this.reader.int32(this.offset);
            this.offset += 4;
            if (group === 0) {
                this.frames.push({ intervals: [0], frames: [this.parseSimpleFrame()] });
                continue;
            }
            const count = this.reader.int32(this.offset);
            this.offset += 12;
            const intervals: number[] = [];
            for (let index = 0; index < count; index++) {
                intervals.push(this.reader.float32(this.offset));
                this.offset += 4;
            }
            const frames: AliasSimpleFrame[] = [];
            for (let index = 0; index < count; index++) {
                frames.push(this.parseSimpleFrame());
            }
            this.frames.push({ intervals, frames });
        }
        if (this.offset > this.bytes.length) {
            throw new Error('Alias model extends beyond its file');
        }
    }
}
