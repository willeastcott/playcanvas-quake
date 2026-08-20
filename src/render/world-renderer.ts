import {
    ADDRESS_CLAMP_TO_EDGE,
    ADDRESS_REPEAT,
    CULLFACE_BACK,
    Entity,
    FILTER_NEAREST,
    FILTER_NEAREST_MIPMAP_NEAREST,
    Mesh,
    MeshInstance,
    PIXELFORMAT_R8,
    PIXELFORMAT_RGBA8,
    PRIMITIVE_TRIANGLES,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    SEMANTIC_TEXCOORD1,
    SEMANTIC_TEXCOORD2,
    ShaderMaterial,
    Texture,
    type AppBase,
    type GraphicsDevice
} from 'playcanvas';

import { buildDynamicLightmap, buildLightmapAtlas } from './lightmap-atlas';
import {
    createColormapTexture,
    createPaletteTexture,
    updatePaletteTexture
} from './palette';
import {
    quakeLightStyleValue,
    quakeSurfaceMipLevelForPreparedView,
    quakeSurfaceMipView,
    quakeTextureMipAdjustment
} from './quake-lighting';
import { quakeEntityRotation } from './quake-transform';
import { WORLD_FRAGMENT_SHADER, WORLD_VERTEX_SHADER } from './shaders';
import { QUAKE_TURBULENCE_OFFSETS } from './turbulence';
import type { BspFace, BspMap, BspTexture, BspTextureInfo, Vec3 } from '../formats/bsp';
import {
    quakeProtocolAngle,
    quakeProtocolByte,
    quakeProtocolCoordinate
} from '../game/quake-protocol';
import type { QuakeWorldRuntime } from '../game/quake-world';

const SURFACE_MODE = Object.freeze({
    NORMAL: 0,
    TURBULENT: 1,
    SKY: 2
});

type SurfaceMode = typeof SURFACE_MODE[keyof typeof SURFACE_MODE];

interface WorldBatchGeometry {
    alternateTextureFrames: number[];
    faces: WorldBatchFace[];
    textureIndex: number;
    textureFrames: number[];
    modelIndex: number;
    entityClass: string;
    styles: [number, number, number, number];
    mode: SurfaceMode;
    positions: number[];
    textureCoordinates: number[];
    lightmapCoordinates: number[];
    mipLevels: number[];
    indices: number[];
}

interface WorldBatchFace {
    firstVertex: number;
    indices: number[];
    leafs: number[];
    mipAdjustment: number;
    vertexCount: number;
    visible: boolean;
}

export interface WorldBatch extends WorldBatchGeometry {
    activeTextureIndex: number;
    material: ShaderMaterial;
    entity: Entity;
    lightStyleValues: Float32Array<ArrayBuffer>;
    mesh: Mesh;
    textureSize: Float32Array<ArrayBuffer>;
}

interface WorldMipBatch {
    entity: Entity;
    faces: WorldBatchFace[];
    mesh: Mesh;
    mipLevels: number[];
    modelIndex: number;
    mode: SurfaceMode;
    positions: number[];
}

export interface WorldBrushModelInstance {
    batches: WorldMipBatch[];
    root: Entity;
}

export interface QuakeSkyView {
    fieldOfView: number;
    forward: Float32Array<ArrayBufferLike>;
    renderSize: Float32Array<ArrayBufferLike>;
    right: Float32Array<ArrayBufferLike>;
    up: Float32Array<ArrayBufferLike>;
    videoSize: Float32Array<ArrayBufferLike>;
    viewRect: Float32Array<ArrayBufferLike>;
}

const quakeToPlayCanvas = (position: Vec3): Vec3 => [position[0], position[2], -position[1]];

const arraysEqual = (left: ArrayLike<number>, right: ArrayLike<number>): boolean => {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index++) {
        if (left[index] !== right[index]) return false;
    }
    return true;
};

export const quakeFaceWorldVertices = (
    positions: readonly number[],
    firstVertex: number,
    vertexCount: number,
    transform: ArrayLike<number>
): Vec3[] => Array.from(
    { length: vertexCount },
    (_, offset): Vec3 => {
        const vertex = (firstVertex + offset) * 3;
        const x = positions[vertex];
        const y = positions[vertex + 1];
        const z = positions[vertex + 2];
        const worldX = transform[0] * x + transform[4] * y +
            transform[8] * z + transform[12];
        const worldY = transform[1] * x + transform[5] * y +
            transform[9] * z + transform[13];
        const worldZ = transform[2] * x + transform[6] * y +
            transform[10] * z + transform[14];
        return [worldX, -worldZ, worldY];
    }
);

export const quakePvsContainsLeaf = (
    visibility: Uint8Array<ArrayBufferLike>,
    cameraLeaf: number,
    candidateLeaf: number
): boolean => {
    if (candidateLeaf === cameraLeaf) return true;
    const bitIndex = candidateLeaf - 1;
    return bitIndex >= 0 &&
        (visibility[bitIndex >> 3] & (1 << (bitIndex & 7))) !== 0;
};

const faceLeafMemberships = (map: BspMap): number[][] => {
    const memberships = Array.from({ length: map.faces.length }, () => [] as number[]);
    for (let leafIndex = 1; leafIndex < map.leafs.length; leafIndex++) {
        const leaf = map.leafs[leafIndex];
        const lastMarkSurface = leaf.firstMarkSurface + leaf.markSurfaceCount;
        for (let markSurface = leaf.firstMarkSurface;
            markSurface < lastMarkSurface; markSurface++) {
            const faceIndex = map.markSurfaces[markSurface];
            if (faceIndex !== undefined && !memberships[faceIndex].includes(leafIndex)) {
                memberships[faceIndex].push(leafIndex);
            }
        }
    }
    return memberships;
};

const completeMipChain = (texture: BspTexture): Array<Uint8Array<ArrayBufferLike>> => {
    const levels = texture.levels.map(level => new Uint8Array(level));
    let width = Math.max(1, texture.width >> (levels.length - 1));
    let height = Math.max(1, texture.height >> (levels.length - 1));
    while (width > 1 || height > 1) {
        const source = levels.at(-1) as Uint8Array<ArrayBufferLike>;
        const nextWidth = Math.max(1, width >> 1);
        const nextHeight = Math.max(1, height >> 1);
        const next = new Uint8Array(nextWidth * nextHeight);
        for (let y = 0; y < nextHeight; y++) {
            for (let x = 0; x < nextWidth; x++) {
                next[y * nextWidth + x] = source[(y * 2) * width + x * 2];
            }
        }
        levels.push(next);
        width = nextWidth;
        height = nextHeight;
    }
    return levels;
};

const createIndexTexture = (device: GraphicsDevice, texture: BspTexture): Texture => {
    const tiled = texture.name.startsWith('*') || texture.name.toLowerCase().startsWith('sky');
    return new Texture(device, {
        name: texture.name,
        width: texture.width,
        height: texture.height,
        format: PIXELFORMAT_R8,
        minFilter: tiled ? FILTER_NEAREST : FILTER_NEAREST_MIPMAP_NEAREST,
        magFilter: FILTER_NEAREST,
        addressU: ADDRESS_REPEAT,
        addressV: ADDRESS_REPEAT,
        mipmaps: !tiled,
        levels: tiled ? [new Uint8Array(texture.levels[0])] : completeMipChain(texture)
    });
};

const surfaceMode = (textureName: string): SurfaceMode => {
    const normalizedName = textureName.toLowerCase();
    if (normalizedName.startsWith('sky')) {
        return SURFACE_MODE.SKY;
    }
    if (normalizedName.startsWith('*')) {
        return SURFACE_MODE.TURBULENT;
    }
    return SURFACE_MODE.NORMAL;
};

export interface QuakeTextureAnimation {
    alternate: number[];
    normal: number[];
}

export const quakeTextureAnimation = (
    map: BspMap,
    textureIndex: number
): QuakeTextureAnimation => {
    const texture = map.textures[textureIndex];
    if (!texture?.name.startsWith('+') || !/[0-9a-j]/iu.test(texture.name[1])) {
        return { alternate: [], normal: [textureIndex] };
    }
    const baseName = texture.name.slice(2).toLowerCase();
    const primary: number[] = [];
    const alternate: number[] = [];
    for (let candidateIndex = 0; candidateIndex < map.textures.length; candidateIndex++) {
        const candidate = map.textures[candidateIndex];
        if (!candidate?.name.startsWith('+') || candidate.name.length <= 2 ||
            candidate.name.slice(2).toLowerCase() !== baseName) {
            continue;
        }
        const frame = candidate.name[1].toUpperCase();
        if (/\d/u.test(frame)) {
            primary[Number(frame)] = candidateIndex;
        } else if (frame >= 'A' && frame <= 'J') {
            alternate[frame.charCodeAt(0) - 65] = candidateIndex;
        }
    }
    const complete = (frames: number[], label: string): number[] => {
        for (let frame = 0; frame < frames.length; frame++) {
            if (!Number.isInteger(frames[frame])) {
                throw new Error(`Missing ${label} frame ${frame} of ${texture.name}`);
            }
        }
        return frames;
    };
    const primaryFrames = complete(primary, 'animation');
    const alternateFrames = complete(alternate, 'alternate animation');
    return /[a-j]/iu.test(texture.name[1]) ? {
        alternate: primaryFrames,
        normal: alternateFrames
    } : {
        alternate: alternateFrames,
        normal: primaryFrames
    };
};

export const quakeAnimatedTextureIndex = (
    animation: QuakeTextureAnimation,
    time: number,
    useAlternate: boolean
): number => {
    const frames = useAlternate && animation.alternate.length > 0 ?
        animation.alternate : animation.normal;
    return frames[Math.floor(time * 5) % frames.length];
};

const faceNormal = (map: BspMap, face: BspFace): Vec3 => {
    const quakeNormal = map.planes[face.plane].normal;
    const direction = face.side === 0 ? 1 : -1;
    return quakeToPlayCanvas(quakeNormal).map(component => component * direction) as Vec3;
};

export const quakeOrientedFaceVertexIndices = (map: BspMap, face: BspFace): number[] => {
    const result = [...face.vertexIndices];
    if (result.length < 3) {
        return result;
    }
    const a = quakeToPlayCanvas(map.vertices[result[0]]);
    const normal = faceNormal(map, face);
    let facing = 0;
    for (let index = 1; index < result.length - 1; index++) {
        const b = quakeToPlayCanvas(map.vertices[result[index]]);
        const c = quakeToPlayCanvas(map.vertices[result[index + 1]]);
        const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const cross = [
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0]
        ];
        const candidate = cross[0] * normal[0] +
            cross[1] * normal[1] + cross[2] * normal[2];
        if (Math.abs(candidate) > Math.abs(facing)) facing = candidate;
    }
    return facing >= 0 ? result : result.reverse();
};

export class WorldRenderer {
    readonly app: AppBase;
    readonly map: BspMap;
    readonly quakeWorld?: QuakeWorldRuntime;
    readonly device: GraphicsDevice;
    readonly paletteTexture: Texture;
    readonly colormapTexture: Texture;
    readonly indexTextures: Array<Texture | null>;
    readonly lightmap: Texture;
    readonly dynamicLightmap: Texture;
    readonly dynamicLightmapPixels: Uint8Array<ArrayBuffer>;
    readonly faceLeafs: number[][];
    readonly batches: WorldBatch[] = [];
    readonly root: Entity;
    readonly cameraPositionUniform = new Float32Array(3);
    readonly skyForwardUniform = new Float32Array([1, 0, 0]);
    readonly skyRenderSizeUniform = new Float32Array([320, 152]);
    readonly skyRightUniform = new Float32Array([0, -1, 0]);
    readonly skyUpUniform = new Float32Array([0, 0, 1]);
    readonly skyVideoSizeUniform = new Float32Array([320, 200]);
    readonly skyViewRectUniform = new Float32Array([0, 0, 320, 152]);
    readonly staticMipCameraPosition = new Float32Array(3);
    readonly staticMipForward = new Float32Array(3);
    readonly staticMipRight = new Float32Array(3);
    readonly staticMipUp = new Float32Array(3);
    readonly staticMipViewRect = new Float32Array(4);
    dynamicLightsWereActive = false;
    lightmapSize = 0;
    staticMipFieldOfView = Number.NaN;
    visibilityLeaf = -1;

    constructor(
        app: AppBase,
        map: BspMap,
        palette: Uint8Array<ArrayBufferLike>,
        colormap: Uint8Array<ArrayBufferLike>,
        quakeWorld?: QuakeWorldRuntime
    ) {
        this.app = app;
        this.map = map;
        this.quakeWorld = quakeWorld;
        this.device = app.graphicsDevice;
        this.paletteTexture = createPaletteTexture(this.device, palette);
        this.colormapTexture = createColormapTexture(this.device, colormap);
        this.faceLeafs = faceLeafMemberships(map);
        this.indexTextures = map.textures.map(texture => (texture ? createIndexTexture(this.device, texture) : null));
        this.lightmap = this.createLightmap();
        this.dynamicLightmapPixels = new Uint8Array(this.lightmapSize * this.lightmapSize);
        this.dynamicLightmap = new Texture(this.device, {
            name: 'Quake dynamic lightmap',
            width: this.lightmapSize,
            height: this.lightmapSize,
            format: PIXELFORMAT_R8,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            mipmaps: false,
            levels: [this.dynamicLightmapPixels]
        });
        this.root = new Entity('E1M1 world');
        this.app.root.addChild(this.root);
        this.buildModels();
    }

    setPalette(palette: Uint8Array<ArrayBufferLike>): void {
        updatePaletteTexture(this.paletteTexture, palette);
    }

    destroy(): void {
        this.root.destroy();
        for (const batch of this.batches) {
            batch.mesh.destroy();
            batch.material.destroy();
        }
        for (const texture of this.indexTextures) texture?.destroy();
        this.paletteTexture.destroy();
        this.colormapTexture.destroy();
        this.lightmap.destroy();
        this.dynamicLightmap.destroy();
    }

    private createLightmap(): Texture {
        const atlas = buildLightmapAtlas(this.map);
        this.lightmapSize = atlas.size;
        return new Texture(this.device, {
            name: 'E1M1 lightmap styles',
            width: atlas.size,
            height: atlas.size,
            format: PIXELFORMAT_RGBA8,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            mipmaps: false,
            levels: [atlas.pixels]
        });
    }

    private buildModels(): void {
        this.buildModel(0, 'worldspawn');
        for (const entity of this.map.entities) {
            if (!entity.model?.startsWith('*') || entity.classname.startsWith('trigger_')) {
                continue;
            }
            const modelIndex = Number(entity.model.slice(1));
            if (Number.isInteger(modelIndex) && this.map.models[modelIndex]) {
                this.buildModel(modelIndex, entity.classname);
            }
        }
    }

    private buildModel(modelIndex: number, entityClass: string): void {
        const model = this.map.models[modelIndex];
        const batches = new Map<string, WorldBatchGeometry>();
        const lastFace = model.firstFace + model.faceCount;
        for (let faceIndex = model.firstFace; faceIndex < lastFace; faceIndex++) {
            const face = this.map.faces[faceIndex];
            const textureInfo = this.map.textureInfo[face.textureInfo];
            const texture = this.map.textures[textureInfo.texture];
            if (!texture || face.vertexIndices.length < 3) {
                continue;
            }
            const mode = surfaceMode(texture.name);
            const animation = quakeTextureAnimation(this.map, textureInfo.texture);
            const key = `${modelIndex}/${textureInfo.texture}/${face.styles.join(',')}/${mode}`;
            if (!batches.has(key)) {
                batches.set(key, {
                    alternateTextureFrames: animation.alternate,
                    faces: [],
                    textureIndex: textureInfo.texture,
                    textureFrames: animation.normal,
                    modelIndex,
                    entityClass,
                    styles: face.styles,
                    mode,
                    positions: [],
                    textureCoordinates: [],
                    lightmapCoordinates: [],
                    mipLevels: [],
                    indices: []
                });
            }
            const batch = batches.get(key);
            if (batch) {
                this.addFace(batch, faceIndex, face, textureInfo);
            }
        }

        for (const batch of batches.values()) {
            this.createBatch(batch);
        }
    }

    private addFace(
        batch: WorldBatchGeometry,
        faceIndex: number,
        face: BspFace,
        textureInfo: BspTextureInfo
    ): void {
        const vertexIndices = quakeOrientedFaceVertexIndices(this.map, face);
        const firstVertex = batch.positions.length / 3;
        for (const vertexIndex of vertexIndices) {
            const quakePosition = this.map.vertices[vertexIndex];
            batch.positions.push(...quakeToPlayCanvas(quakePosition));
            const s = quakePosition[0] * textureInfo.vectors[0][0] +
                quakePosition[1] * textureInfo.vectors[0][1] +
                quakePosition[2] * textureInfo.vectors[0][2] + textureInfo.vectors[0][3];
            const t = quakePosition[0] * textureInfo.vectors[1][0] +
                quakePosition[1] * textureInfo.vectors[1][1] +
                quakePosition[2] * textureInfo.vectors[1][2] + textureInfo.vectors[1][3];
            batch.textureCoordinates.push(s, t);
            batch.mipLevels.push(0);
            if (face.lightmapAtlas) {
                const lightmapS = face.lightmapAtlas.x + s / 16 - face.lightmapMins[0] + 0.5;
                const lightmapT = face.lightmapAtlas.y + t / 16 - face.lightmapMins[1] + 0.5;
                batch.lightmapCoordinates.push(
                    lightmapS / this.lightmapSize,
                    lightmapT / this.lightmapSize
                );
            } else {
                batch.lightmapCoordinates.push(0, 0);
            }
        }
        const faceIndices: number[] = [];
        for (let index = 1; index < vertexIndices.length - 1; index++) {
            faceIndices.push(firstVertex, firstVertex + index, firstVertex + index + 1);
        }
        batch.indices.push(...faceIndices);
        batch.faces.push({
            firstVertex,
            indices: faceIndices,
            leafs: this.faceLeafs[faceIndex],
            mipAdjustment: quakeTextureMipAdjustment(textureInfo.vectors),
            vertexCount: vertexIndices.length,
            visible: true
        });
    }

    private createBatch(batch: WorldBatchGeometry): void {
        const texture = this.map.textures[batch.textureIndex];
        if (!texture) {
            throw new Error(`Missing BSP texture ${batch.textureIndex}`);
        }
        const mesh = this.createMesh(batch);

        const material = new ShaderMaterial({
            uniqueName: `Quake world ${texture.name}/${batch.styles.join('-')}`,
            attributes: {
                aPosition: SEMANTIC_POSITION,
                aUv0: SEMANTIC_TEXCOORD0,
                aUv1: SEMANTIC_TEXCOORD1,
                aMipLevel: SEMANTIC_TEXCOORD2
            },
            vertexGLSL: WORLD_VERTEX_SHADER,
            fragmentGLSL: WORLD_FRAGMENT_SHADER
        });
        material.cull = CULLFACE_BACK;
        material.depthTest = true;
        material.depthWrite = true;
        const indexTexture = this.indexTextures[batch.textureIndex];
        if (!indexTexture) {
            throw new Error(`Missing indexed BSP texture ${batch.textureIndex}`);
        }
        material.setParameter('uIndexMap', indexTexture);
        material.setParameter('uPaletteMap', this.paletteTexture);
        material.setParameter('uColormap', this.colormapTexture);
        material.setParameter('uLightmap', this.lightmap);
        material.setParameter('uDynamicLightmap', this.dynamicLightmap);
        const textureSize = new Float32Array([texture.width, texture.height]);
        const lightStyleValues = new Float32Array([1, 0, 0, 0]);
        material.setParameter('uTextureSize', textureSize);
        material.setParameter('uLightmapSize', this.lightmapSize);
        material.setParameter('uLightStyles', lightStyleValues);
        material.setParameter('uCameraPosition', this.cameraPositionUniform);
        material.setParameter('uSkyForward', this.skyForwardUniform);
        material.setParameter('uSkyRight', this.skyRightUniform);
        material.setParameter('uSkyUp', this.skyUpUniform);
        material.setParameter('uSkyRenderSize', this.skyRenderSizeUniform);
        material.setParameter('uSkyVideoSize', this.skyVideoSizeUniform);
        material.setParameter('uSkyViewRect', this.skyViewRectUniform);
        material.setParameter('uColorShift', new Float32Array(3));
        material.setParameter('uColorShiftAmount', 0);
        material.setParameter('uGamma', 1);
        material.setParameter('uHasLightmap', batch.styles[0] === 255 ? 0 : 1);
        material.setParameter('uSurfaceMode', batch.mode);
        material.setParameter('uTime', 0);
        material.setParameter('uTransparent', texture.name.startsWith('{') ? 1 : 0);
        material.setParameter('uTurbulenceOffsets[0]', QUAKE_TURBULENCE_OFFSETS);
        material.update();

        const entity = this.createMeshEntity(
            `${batch.entityClass} ${batch.modelIndex}: ${texture.name}`,
            mesh,
            material
        );
        this.root.addChild(entity);
        this.batches.push({
            ...batch,
            activeTextureIndex: batch.textureIndex,
            material,
            entity,
            lightStyleValues,
            mesh,
            textureSize
        });
    }

    private createMesh(batch: WorldBatchGeometry): Mesh {
        const mesh = new Mesh(this.device);
        mesh.clear(
            true,
            true,
            batch.positions.length / 3,
            batch.indices.length
        );
        mesh.setPositions(batch.positions);
        mesh.setUvs(0, batch.textureCoordinates);
        mesh.setUvs(1, batch.lightmapCoordinates);
        mesh.setVertexStream(SEMANTIC_TEXCOORD2, batch.mipLevels, 1);
        mesh.setIndices(batch.indices);
        mesh.update(PRIMITIVE_TRIANGLES);
        return mesh;
    }

    private createMeshEntity(
        name: string,
        mesh: Mesh,
        material: ShaderMaterial
    ): Entity {
        const meshInstance = new MeshInstance(mesh, material);
        const entity = new Entity(name);
        entity.addComponent('render', {
            castShadows: false,
            meshInstances: [meshInstance],
            receiveShadows: false
        });
        return entity;
    }

    createBrushModelInstance(name: string): WorldBrushModelInstance {
        const root = new Entity(name);
        const batches = this.batches.map((batch): WorldMipBatch => {
            const mipLevels = [...batch.mipLevels];
            const mesh = this.createMesh({ ...batch, mipLevels });
            const entity = this.createMeshEntity(batch.entity.name, mesh, batch.material);
            root.addChild(entity);
            return {
                entity,
                faces: batch.faces,
                mesh,
                mipLevels,
                modelIndex: batch.modelIndex,
                mode: batch.mode,
                positions: batch.positions
            };
        });
        return { batches, root };
    }

    update(
        time: number,
        cameraPosition: Float32Array<ArrayBuffer>,
        skyView?: QuakeSkyView
    ): void {
        this.updateDynamicLightmap();
        this.updateVisibility(cameraPosition);
        this.updateMaterials(time, cameraPosition, skyView);
        if (skyView) {
            this.updateSurfaceMipLevels(
                this.batches,
                cameraPosition,
                skyView,
                !this.staticMipViewChanged(cameraPosition, skyView)
            );
        }
    }

    updateBrushModelInstances(
        time: number,
        cameraPosition: Float32Array<ArrayBuffer>,
        instances: readonly WorldBrushModelInstance[],
        skyView?: QuakeSkyView,
        lightStyles?: ReadonlyMap<number, string>
    ): void {
        this.updateMaterials(time, cameraPosition, skyView, lightStyles);
        if (!skyView) return;
        for (const instance of instances) {
            if (instance.root.enabled) {
                this.updateSurfaceMipLevels(instance.batches, cameraPosition, skyView);
            }
        }
    }

    private updateMaterials(
        time: number,
        cameraPosition: Float32Array<ArrayBuffer>,
        skyView?: QuakeSkyView,
        lightStyles: ReadonlyMap<number, string> | undefined = this.quakeWorld?.lightStyles
    ): void {
        this.cameraPositionUniform.set(cameraPosition);
        if (skyView) {
            this.skyForwardUniform.set(skyView.forward);
            this.skyRenderSizeUniform.set(skyView.renderSize);
            this.skyRightUniform.set(skyView.right);
            this.skyUpUniform.set(skyView.up);
            this.skyVideoSizeUniform.set(skyView.videoSize);
            this.skyViewRectUniform.set(skyView.viewRect);
        }
        for (const batch of this.batches) {
            if (batch.modelIndex !== 0 && this.quakeWorld) {
                const reference = this.quakeWorld.inlineModelReferences.get(batch.modelIndex);
                if (reference === undefined) {
                    batch.entity.enabled = false;
                } else {
                    const edict = this.quakeWorld.vm.entity(reference);
                    batch.entity.enabled = !edict.free &&
                        this.quakeWorld.entityVisible(reference) &&
                        this.quakeWorld.vm.getEntityString(reference, 'model') === `*${batch.modelIndex}`;
                    const origin = this.quakeWorld.vm.getEntityVector(
                        reference, 'origin'
                    ).map(quakeProtocolCoordinate) as Vec3;
                    const angles = this.quakeWorld.vm.getEntityVector(
                        reference, 'angles'
                    ).map(quakeProtocolAngle) as Vec3;
                    batch.entity.setPosition(...quakeToPlayCanvas(origin));
                    batch.entity.setRotation(quakeEntityRotation(angles));
                }
            }
            let useAlternate = false;
            if (batch.modelIndex !== 0 && this.quakeWorld) {
                const reference = this.quakeWorld.inlineModelReferences.get(batch.modelIndex);
                useAlternate = reference !== undefined && quakeProtocolByte(
                    this.quakeWorld.vm.getEntityFloat(reference, 'frame')
                ) !== 0;
            }
            const textureIndex = quakeAnimatedTextureIndex({
                alternate: batch.alternateTextureFrames,
                normal: batch.textureFrames
            }, time, useAlternate);
            const texture = this.map.textures[textureIndex];
            if (!texture) {
                continue;
            }
            const indexTexture = this.indexTextures[textureIndex];
            if (!indexTexture) {
                continue;
            }
            if (textureIndex !== batch.activeTextureIndex) {
                batch.activeTextureIndex = textureIndex;
                batch.textureSize[0] = texture.width;
                batch.textureSize[1] = texture.height;
                batch.material.setParameter('uIndexMap', indexTexture);
            }
            for (let styleIndex = 0; styleIndex < batch.styles.length; styleIndex++) {
                batch.lightStyleValues[styleIndex] = quakeLightStyleValue(
                    batch.styles[styleIndex], time, lightStyles
                );
            }
            if (batch.mode !== SURFACE_MODE.NORMAL) batch.material.setParameter('uTime', time);
        }
    }

    private updateSurfaceMipLevels(
        batches: readonly WorldMipBatch[],
        cameraPosition: Float32Array<ArrayBuffer>,
        view: QuakeSkyView,
        skipStaticWorld = false
    ): void {
        const cameraOrigin: Vec3 = [
            cameraPosition[0], -cameraPosition[2], cameraPosition[1]
        ];
        const cameraRight: Vec3 = [view.right[0], view.right[1], view.right[2]];
        const cameraUp: Vec3 = [view.up[0], view.up[1], view.up[2]];
        const cameraForward: Vec3 = [view.forward[0], view.forward[1], view.forward[2]];
        const mipView = quakeSurfaceMipView(
            cameraOrigin,
            cameraRight,
            cameraUp,
            cameraForward,
            view.viewRect[2],
            view.viewRect[3],
            view.fieldOfView
        );
        if (!mipView) return;
        for (const batch of batches) {
            if (skipStaticWorld && batch.modelIndex === 0) continue;
            if (batch.mode !== SURFACE_MODE.NORMAL) continue;
            let changed = false;
            const transform = batch.entity.getWorldTransform().data;
            for (const face of batch.faces) {
                if (!face.visible) continue;
                const vertices = quakeFaceWorldVertices(
                    batch.positions,
                    face.firstVertex,
                    face.vertexCount,
                    transform
                );
                const mipLevel = quakeSurfaceMipLevelForPreparedView(
                    vertices,
                    mipView,
                    face.mipAdjustment
                ) ?? 3;
                if (batch.mipLevels[face.firstVertex] !== mipLevel) {
                    batch.mipLevels.fill(
                        mipLevel,
                        face.firstVertex,
                        face.firstVertex + face.vertexCount
                    );
                    changed = true;
                }
            }
            if (!changed) continue;
            batch.mesh.setVertexStream(
                SEMANTIC_TEXCOORD2,
                batch.mipLevels,
                1,
                batch.mipLevels.length
            );
            batch.mesh.update(PRIMITIVE_TRIANGLES, false);
        }
    }

    private staticMipViewChanged(
        cameraPosition: Float32Array<ArrayBuffer>,
        view: QuakeSkyView
    ): boolean {
        const changed = this.staticMipFieldOfView !== view.fieldOfView ||
            !arraysEqual(this.staticMipCameraPosition, cameraPosition) ||
            !arraysEqual(this.staticMipForward, view.forward) ||
            !arraysEqual(this.staticMipRight, view.right) ||
            !arraysEqual(this.staticMipUp, view.up) ||
            !arraysEqual(this.staticMipViewRect, view.viewRect);
        if (!changed) return false;
        this.staticMipFieldOfView = view.fieldOfView;
        this.staticMipCameraPosition.set(cameraPosition);
        this.staticMipForward.set(view.forward);
        this.staticMipRight.set(view.right);
        this.staticMipUp.set(view.up);
        this.staticMipViewRect.set(view.viewRect);
        return true;
    }

    private updateVisibility(cameraPosition: Float32Array<ArrayBuffer>): void {
        const quakeCameraPosition: Vec3 = [
            cameraPosition[0], -cameraPosition[2], cameraPosition[1]
        ];
        const cameraLeaf = this.map.findLeaf(quakeCameraPosition);
        if (cameraLeaf === this.visibilityLeaf) return;
        this.visibilityLeaf = cameraLeaf;
        const visibility = this.map.visibleLeafs(cameraLeaf);
        for (const batch of this.batches) {
            if (batch.modelIndex !== 0) continue;
            const visibleIndices: number[] = [];
            for (const face of batch.faces) {
                face.visible = face.leafs.length === 0 || face.leafs.some(
                    leaf => quakePvsContainsLeaf(visibility, cameraLeaf, leaf)
                );
                if (face.visible) visibleIndices.push(...face.indices);
            }
            batch.mesh.setIndices(visibleIndices);
            batch.mesh.update(PRIMITIVE_TRIANGLES, false);
        }
    }

    private updateDynamicLightmap(): void {
        if (!this.quakeWorld) {
            return;
        }
        const lights = this.quakeWorld.activeDynamicLights();
        if (lights.length === 0 && !this.dynamicLightsWereActive) {
            return;
        }
        buildDynamicLightmap(this.map, this.lightmapSize, lights, this.dynamicLightmapPixels);
        this.dynamicLightmap.upload();
        this.dynamicLightsWereActive = lights.length > 0;
    }
}

export { quakeToPlayCanvas };
