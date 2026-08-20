import { assertRange, BinaryReader } from './binary';
import { parseEntities, type EntityDictionary } from './entities';

export const BSP_VERSION = 29;

export const CONTENTS = Object.freeze({
    EMPTY: -1,
    SOLID: -2,
    WATER: -3,
    SLIME: -4,
    LAVA: -5,
    SKY: -6,
    CURRENT_0: -9,
    CURRENT_90: -10,
    CURRENT_180: -11,
    CURRENT_270: -12,
    CURRENT_UP: -13,
    CURRENT_DOWN: -14
});

const LUMP_NAMES = [
    'entities',
    'planes',
    'textures',
    'vertices',
    'visibility',
    'nodes',
    'texinfo',
    'faces',
    'lighting',
    'clipnodes',
    'leafs',
    'marksurfaces',
    'edges',
    'surfedges',
    'models'
] as const;

type LumpName = typeof LUMP_NAMES[number];
export type Vec3 = [number, number, number];

interface Lump {
    name: LumpName;
    offset: number;
    length: number;
}

export interface BspPlane { normal: Vec3; distance: number; type: number }
export interface BspNode {
    plane: number; children: [number, number]; mins: Vec3; maxs: Vec3;
    firstFace: number; faceCount: number;
}
export interface BspTextureInfo {
    vectors: [[number, number, number, number], [number, number, number, number]];
    texture: number; flags: number;
}
export interface LightmapPlacement { x: number; y: number; width: number; height: number }
export interface BspFace {
    plane: number; side: number; firstEdge: number; edgeCount: number; textureInfo: number;
    styles: [number, number, number, number]; lightOffset: number; vertexIndices: number[];
    lightmapMins: [number, number]; lightmapSize: [number, number]; lightmapAtlas?: LightmapPlacement;
}
export interface BspClipNode { plane: number; children: [number, number] }
export interface BspLeaf {
    contents: number; visibilityOffset: number; mins: Vec3; maxs: Vec3;
    firstMarkSurface: number; markSurfaceCount: number; ambient: [number, number, number, number];
}
export interface BspModel {
    mins: Vec3; maxs: Vec3; origin: Vec3; headnodes: [number, number, number, number];
    visibleLeafs: number; firstFace: number; faceCount: number;
}
export interface BspTexture { name: string; width: number; height: number; levels: Uint8Array[] }

const HEADER_SIZE = 4 + LUMP_NAMES.length * 8;
const textDecoder = new TextDecoder('windows-1252');

const readArray = <T>(
    reader: BinaryReader,
    lump: Lump,
    stride: number,
    callback: (offset: number, reader: BinaryReader) => T
): T[] => {
    if (lump.length % stride !== 0) {
        throw new Error(`Misaligned ${lump.name} lump`);
    }
    const result: T[] = [];
    for (let offset = lump.offset; offset < lump.offset + lump.length; offset += stride) {
        result.push(callback(offset, reader));
    }
    return result;
};

const readBounds = (reader: BinaryReader, offset: number): { mins: Vec3; maxs: Vec3 } => ({
    mins: [reader.int16(offset), reader.int16(offset + 2), reader.int16(offset + 4)],
    maxs: [reader.int16(offset + 6), reader.int16(offset + 8), reader.int16(offset + 10)]
});

export class BspMap {
    readonly bytes: Uint8Array<ArrayBufferLike>;
    readonly reader: BinaryReader;
    readonly lumps = {} as Record<LumpName, Lump>;
    version = 0;
    entityText = '';
    entities: EntityDictionary[] = [];
    planes: BspPlane[] = [];
    vertices: Vec3[] = [];
    nodes: BspNode[] = [];
    textureInfo: BspTextureInfo[] = [];
    faces: BspFace[] = [];
    clipnodes: BspClipNode[] = [];
    leafs: BspLeaf[] = [];
    markSurfaces: number[] = [];
    edges: [number, number][] = [];
    surfaceEdges: number[] = [];
    models: BspModel[] = [];
    textures: Array<BspTexture | null> = [];
    lightData: Uint8Array<ArrayBufferLike> = new Uint8Array();
    visibilityData: Uint8Array<ArrayBufferLike> = new Uint8Array();

    constructor(data: ArrayBuffer | Uint8Array<ArrayBufferLike>) {
        this.bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        this.reader = new BinaryReader(this.bytes);
        this.parseHeader();
        this.parseData();
    }

    private parseHeader(): void {
        if (this.bytes.byteLength < HEADER_SIZE) {
            throw new Error('BSP header is truncated');
        }
        this.version = this.reader.int32(0);
        if (this.version !== BSP_VERSION) {
            throw new Error(`Unsupported BSP version ${this.version}; expected ${BSP_VERSION}`);
        }

        for (let index = 0; index < LUMP_NAMES.length; index++) {
            const offset = this.reader.int32(4 + index * 8);
            const length = this.reader.int32(8 + index * 8);
            const name = LUMP_NAMES[index];
            assertRange(this.bytes, offset, length, `${name} lump`);
            this.lumps[name] = { name, offset, length };
        }
    }

    private parseData(): void {
        const entityBytes = this.getLumpBytes('entities');
        const terminator = entityBytes.indexOf(0);
        this.entityText = textDecoder.decode(terminator === -1 ? entityBytes : entityBytes.subarray(0, terminator));
        this.entities = parseEntities(this.entityText);
        this.planes = readArray<BspPlane>(this.reader, this.lumps.planes, 20, offset => ({
            normal: [
                this.reader.float32(offset),
                this.reader.float32(offset + 4),
                this.reader.float32(offset + 8)
            ],
            distance: this.reader.float32(offset + 12),
            type: this.reader.int32(offset + 16)
        }));
        this.vertices = readArray<Vec3>(this.reader, this.lumps.vertices, 12, offset => [
            this.reader.float32(offset),
            this.reader.float32(offset + 4),
            this.reader.float32(offset + 8)
        ]);
        this.nodes = readArray<BspNode>(this.reader, this.lumps.nodes, 24, offset => ({
            plane: this.reader.int32(offset),
            children: [this.reader.int16(offset + 4), this.reader.int16(offset + 6)],
            ...readBounds(this.reader, offset + 8),
            firstFace: this.reader.uint16(offset + 20),
            faceCount: this.reader.uint16(offset + 22)
        }));
        this.textureInfo = readArray<BspTextureInfo>(this.reader, this.lumps.texinfo, 40, offset => ({
            vectors: [
                [
                    this.reader.float32(offset),
                    this.reader.float32(offset + 4),
                    this.reader.float32(offset + 8),
                    this.reader.float32(offset + 12)
                ],
                [
                    this.reader.float32(offset + 16),
                    this.reader.float32(offset + 20),
                    this.reader.float32(offset + 24),
                    this.reader.float32(offset + 28)
                ]
            ],
            texture: this.reader.int32(offset + 32),
            flags: this.reader.int32(offset + 36)
        }));
        this.faces = readArray<BspFace>(this.reader, this.lumps.faces, 20, offset => ({
            plane: this.reader.uint16(offset),
            side: this.reader.int16(offset + 2),
            firstEdge: this.reader.int32(offset + 4),
            edgeCount: this.reader.uint16(offset + 8),
            textureInfo: this.reader.uint16(offset + 10),
            styles: [
                this.reader.uint8(offset + 12),
                this.reader.uint8(offset + 13),
                this.reader.uint8(offset + 14),
                this.reader.uint8(offset + 15)
            ],
            lightOffset: this.reader.int32(offset + 16),
            vertexIndices: [],
            lightmapMins: [0, 0],
            lightmapSize: [0, 0]
        }));
        this.clipnodes = readArray<BspClipNode>(this.reader, this.lumps.clipnodes, 8, offset => ({
            plane: this.reader.int32(offset),
            children: [this.reader.int16(offset + 4), this.reader.int16(offset + 6)]
        }));
        this.leafs = readArray<BspLeaf>(this.reader, this.lumps.leafs, 28, offset => ({
            contents: this.reader.int32(offset),
            visibilityOffset: this.reader.int32(offset + 4),
            ...readBounds(this.reader, offset + 8),
            firstMarkSurface: this.reader.uint16(offset + 20),
            markSurfaceCount: this.reader.uint16(offset + 22),
            ambient: [
                this.reader.uint8(offset + 24),
                this.reader.uint8(offset + 25),
                this.reader.uint8(offset + 26),
                this.reader.uint8(offset + 27)
            ]
        }));
        this.markSurfaces = readArray<number>(this.reader, this.lumps.marksurfaces, 2, offset => this.reader.uint16(offset));
        this.edges = readArray<[number, number]>(this.reader, this.lumps.edges, 4, offset => [
            this.reader.uint16(offset),
            this.reader.uint16(offset + 2)
        ]);
        this.surfaceEdges = readArray<number>(this.reader, this.lumps.surfedges, 4, offset => this.reader.int32(offset));
        // Mod_LoadSubmodels spreads every disk dmodel bound by one pixel before
        // the server exposes it through PF_setmodel or QuakeC mover sizing.
        this.models = readArray<BspModel>(this.reader, this.lumps.models, 64, offset => ({
            mins: [
                this.reader.float32(offset) - 1,
                this.reader.float32(offset + 4) - 1,
                this.reader.float32(offset + 8) - 1
            ],
            maxs: [
                this.reader.float32(offset + 12) + 1,
                this.reader.float32(offset + 16) + 1,
                this.reader.float32(offset + 20) + 1
            ],
            origin: [
                this.reader.float32(offset + 24),
                this.reader.float32(offset + 28),
                this.reader.float32(offset + 32)
            ],
            headnodes: [
                this.reader.int32(offset + 36),
                this.reader.int32(offset + 40),
                this.reader.int32(offset + 44),
                this.reader.int32(offset + 48)
            ],
            visibleLeafs: this.reader.int32(offset + 52),
            firstFace: this.reader.int32(offset + 56),
            faceCount: this.reader.int32(offset + 60)
        }));
        this.textures = this.parseTextures();
        this.lightData = this.getLumpBytes('lighting');
        this.visibilityData = this.getLumpBytes('visibility');
        this.prepareFaces();
    }

    getLumpBytes(name: LumpName): Uint8Array<ArrayBufferLike> {
        const lump = this.lumps[name];
        return this.bytes.subarray(lump.offset, lump.offset + lump.length);
    }

    private parseTextures(): Array<BspTexture | null> {
        const lump = this.lumps.textures;
        if (lump.length < 4) {
            return [];
        }
        const count = this.reader.int32(lump.offset);
        if (count < 0 || 4 + count * 4 > lump.length) {
            throw new Error('Invalid BSP texture directory');
        }

        const textures: Array<BspTexture | null> = [];
        for (let index = 0; index < count; index++) {
            const relativeOffset = this.reader.int32(lump.offset + 4 + index * 4);
            if (relativeOffset === -1) {
                textures.push(null);
                continue;
            }
            const offset = lump.offset + relativeOffset;
            assertRange(this.bytes, offset, 40, `BSP texture ${index}`);
            const name = this.reader.string(offset, 16);
            const width = this.reader.uint32(offset + 16);
            const height = this.reader.uint32(offset + 20);
            const mipOffsets = [0, 1, 2, 3].map(level => this.reader.uint32(offset + 24 + level * 4));
            const levels = mipOffsets.map((mipOffset, level) => {
                const mipWidth = Math.max(1, width >> level);
                const mipHeight = Math.max(1, height >> level);
                assertRange(this.bytes, offset + mipOffset, mipWidth * mipHeight, `BSP texture ${name} mip ${level}`);
                return this.reader.slice(offset + mipOffset, mipWidth * mipHeight);
            });
            textures.push({ name, width, height, levels });
        }
        return textures;
    }

    private prepareFaces(): void {
        for (const face of this.faces) {
            face.vertexIndices = [];
            for (let index = 0; index < face.edgeCount; index++) {
                const surfaceEdge = this.surfaceEdges[face.firstEdge + index];
                const edge = this.edges[Math.abs(surfaceEdge)];
                face.vertexIndices.push(surfaceEdge >= 0 ? edge[0] : edge[1]);
            }

            const textureInfo = this.textureInfo[face.textureInfo];
            let minS = Infinity;
            let minT = Infinity;
            let maxS = -Infinity;
            let maxT = -Infinity;
            for (const vertexIndex of face.vertexIndices) {
                const vertex = this.vertices[vertexIndex];
                const s = vertex[0] * textureInfo.vectors[0][0] +
                    vertex[1] * textureInfo.vectors[0][1] +
                    vertex[2] * textureInfo.vectors[0][2] + textureInfo.vectors[0][3];
                const t = vertex[0] * textureInfo.vectors[1][0] +
                    vertex[1] * textureInfo.vectors[1][1] +
                    vertex[2] * textureInfo.vectors[1][2] + textureInfo.vectors[1][3];
                minS = Math.min(minS, s);
                minT = Math.min(minT, t);
                maxS = Math.max(maxS, s);
                maxT = Math.max(maxT, t);
            }
            const textureMins: [number, number] = [Math.floor(minS / 16), Math.floor(minT / 16)];
            const textureMaxs: [number, number] = [Math.ceil(maxS / 16), Math.ceil(maxT / 16)];
            face.lightmapMins = textureMins;
            face.lightmapSize = [
                textureMaxs[0] - textureMins[0] + 1,
                textureMaxs[1] - textureMins[1] + 1
            ];
        }
    }

    findLeaf(position: Vec3): number {
        let nodeIndex = this.models[0].headnodes[0];
        while (nodeIndex >= 0) {
            const node = this.nodes[nodeIndex];
            const plane = this.planes[node.plane];
            const distance = position[0] * plane.normal[0] +
                position[1] * plane.normal[1] +
                position[2] * plane.normal[2] - plane.distance;
            nodeIndex = node.children[distance >= 0 ? 0 : 1];
        }
        return -1 - nodeIndex;
    }

    touchedLeafs(minimum: Vec3, maximum: Vec3, limit = Number.POSITIVE_INFINITY): number[] {
        const touched: number[] = [];
        const visit = (nodeIndex: number): void => {
            if (touched.length >= limit) return;
            if (nodeIndex < 0) {
                const leafIndex = -1 - nodeIndex;
                if (leafIndex !== 0 && !touched.includes(leafIndex)) touched.push(leafIndex);
                return;
            }
            const node = this.nodes[nodeIndex];
            const plane = this.planes[node.plane];
            let frontDistance = -plane.distance;
            let backDistance = -plane.distance;
            for (let axis = 0; axis < 3; axis++) {
                if (plane.normal[axis] >= 0) {
                    frontDistance += plane.normal[axis] * maximum[axis];
                    backDistance += plane.normal[axis] * minimum[axis];
                } else {
                    frontDistance += plane.normal[axis] * minimum[axis];
                    backDistance += plane.normal[axis] * maximum[axis];
                }
            }
            if (frontDistance >= 0) visit(node.children[0]);
            if (backDistance < 0) visit(node.children[1]);
        };
        visit(this.models[0].headnodes[0]);
        return touched;
    }

    fatVisibleLeafs(position: Vec3): Uint8Array {
        const visibility = new Uint8Array(Math.ceil(this.models[0].visibleLeafs / 8));
        const minimum = position.map(component => component - 8) as Vec3;
        const maximum = position.map(component => component + 8) as Vec3;
        for (const leafIndex of this.touchedLeafs(minimum, maximum)) {
            const leafVisibility = this.visibleLeafs(leafIndex);
            for (let byte = 0; byte < visibility.length; byte++) {
                visibility[byte] |= leafVisibility[byte];
            }
        }
        return visibility;
    }

    visibilityContainsLeaf(
        visibility: Uint8Array<ArrayBufferLike>,
        leafIndex: number
    ): boolean {
        const bitIndex = leafIndex - 1;
        return bitIndex >= 0 &&
            (visibility[bitIndex >> 3] & (1 << (bitIndex & 7))) !== 0;
    }

    visibleLeafs(leafIndex: number): Uint8Array {
        const leaf = this.leafs[leafIndex];
        const visibleLeafCount = this.models[0].visibleLeafs;
        if (!leaf || leaf.visibilityOffset < 0) {
            return new Uint8Array(Math.ceil(visibleLeafCount / 8)).fill(0xff);
        }

        const output = new Uint8Array(Math.ceil(visibleLeafCount / 8));
        let inputOffset = leaf.visibilityOffset;
        let outputOffset = 0;
        while (outputOffset < output.length && inputOffset < this.visibilityData.length) {
            const value = this.visibilityData[inputOffset++];
            if (value !== 0) {
                output[outputOffset++] = value;
                continue;
            }
            const runLength = this.visibilityData[inputOffset++];
            outputOffset += runLength;
        }
        return output;
    }
}
