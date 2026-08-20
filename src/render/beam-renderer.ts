import {
    ADDRESS_REPEAT,
    Entity,
    FILTER_NEAREST,
    Mesh,
    MeshInstance,
    PIXELFORMAT_R8,
    PRIMITIVE_TRIANGLES,
    SEMANTIC_NORMAL,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial,
    Texture,
    type AppBase
} from 'playcanvas';

import { QUAKE_ALIAS_NORMALS } from './alias-normals';
import { configureQuakeAliasRaster } from './alias-raster';
import {
    createColormapTexture,
    createPaletteTexture,
    updatePaletteTexture
} from './palette';
import { calculateQuakeAliasLighting, sampleQuakeBspLight } from './quake-lighting';
import { quakeAliasRotation } from './quake-transform';
import { ALIAS_FRAGMENT_SHADER, ALIAS_VERTEX_SHADER } from './shaders';
import { quakeToPlayCanvas } from './world-renderer';
import type { Vec3 } from '../formats/bsp';
import { AliasModel, type AliasSimpleFrame } from '../formats/mdl';
import type { PakArchive } from '../formats/pak';
import type { QuakeBeam, QuakeWorldRuntime } from '../game/quake-world';

const MAX_TEMP_ENTITIES = 64;
const BEAM_SEGMENT_LENGTH = 30;

interface BeamAsset {
    material: ShaderMaterial;
    mesh: Mesh;
    path: string;
    texture: Texture;
}

interface BeamSegment {
    asset: BeamAsset;
    entity: Entity;
    meshInstance: MeshInstance;
}

export interface QuakeBeamLayout {
    angles: Vec3;
    origins: Vec3[];
}

export const layoutQuakeBeam = (start: Vec3, end: Vec3): QuakeBeamLayout => {
    const distance: Vec3 = end.map(
        (component, axis) => component - start[axis]
    ) as Vec3;
    let pitch: number;
    let yaw: number;
    if (distance[0] === 0 && distance[1] === 0) {
        yaw = 0;
        pitch = distance[2] > 0 ? 90 : 270;
    } else {
        yaw = Math.trunc(Math.atan2(distance[1], distance[0]) * 180 / Math.PI);
        if (yaw < 0) yaw += 360;
        pitch = Math.trunc(
            Math.atan2(distance[2], Math.hypot(distance[0], distance[1])) * 180 / Math.PI
        );
        if (pitch < 0) pitch += 360;
    }
    const length = Math.hypot(...distance);
    const origins: Vec3[] = [];
    if (length > 0) {
        const direction = distance.map(component => component / length) as Vec3;
        const origin: Vec3 = [...start];
        for (let remaining = length; remaining > 0; remaining -= BEAM_SEGMENT_LENGTH) {
            origins.push([...origin]);
            for (let axis = 0; axis < 3; axis++) {
                origin[axis] += direction[axis] * BEAM_SEGMENT_LENGTH;
            }
        }
    }
    return { angles: [pitch, yaw, 0], origins };
};

export class BeamRenderer {
    readonly app: AppBase;
    readonly pak: PakArchive;
    readonly quakeWorld: QuakeWorldRuntime;
    readonly paletteTexture: Texture;
    readonly colormapTexture: Texture;
    readonly root = new Entity('Quake temporary beams');
    readonly assets = new Map<string, BeamAsset>();
    readonly missingModels = new Set<string>();
    readonly segments: BeamSegment[] = [];

    constructor(
        app: AppBase,
        pak: PakArchive,
        palette: Uint8Array<ArrayBufferLike>,
        quakeWorld: QuakeWorldRuntime
    ) {
        this.app = app;
        this.pak = pak;
        this.quakeWorld = quakeWorld;
        this.paletteTexture = createPaletteTexture(app.graphicsDevice, palette);
        this.colormapTexture = createColormapTexture(
            app.graphicsDevice, pak.get('gfx/colormap.lmp')
        );
        this.app.root.addChild(this.root);
    }

    setPalette(palette: Uint8Array<ArrayBufferLike>): void {
        updatePaletteTexture(this.paletteTexture, palette);
    }

    destroy(): void {
        this.root.destroy();
        for (const asset of this.assets.values()) {
            asset.material.destroy();
            asset.mesh.destroy();
            asset.texture.destroy();
        }
        this.paletteTexture.destroy();
        this.colormapTexture.destroy();
    }

    update(time: number): void {
        for (const segment of this.segments) {
            segment.entity.enabled = false;
        }
        const dynamicLights = this.quakeWorld.activeDynamicLights();
        let segmentIndex = 0;
        for (const beam of this.quakeWorld.activeBeams()) {
            const asset = this.assetForBeam(beam);
            if (!asset) {
                continue;
            }
            const layout = layoutQuakeBeam(beam.start, beam.end);
            for (const origin of layout.origins) {
                if (segmentIndex >= MAX_TEMP_ENTITIES) {
                    return;
                }
                const angles: Vec3 = [
                    layout.angles[0],
                    layout.angles[1],
                    this.quakeWorld.nextTemporaryEntityRoll()
                ];
                const segment = this.segmentAt(segmentIndex++, asset);
                segment.entity.enabled = true;
                segment.entity.setPosition(...quakeToPlayCanvas(origin));
                segment.entity.setRotation(quakeAliasRotation(angles));
                const lighting = calculateQuakeAliasLighting(
                    sampleQuakeBspLight(
                        this.quakeWorld.map,
                        origin,
                        time,
                        this.quakeWorld.lightStyles
                    ),
                    origin,
                    angles,
                    dynamicLights
                );
                segment.meshInstance.setParameter(
                    'uShadeDirection', new Float32Array(lighting.shadeDirection)
                );
                segment.meshInstance.setParameter('uAmbient', lighting.ambient);
                segment.meshInstance.setParameter('uShade', lighting.shade);
            }
        }
    }

    private assetForBeam(beam: QuakeBeam): BeamAsset | undefined {
        const existing = this.assets.get(beam.model);
        if (existing) {
            return existing;
        }
        if (!this.pak.has(beam.model)) {
            if (!this.missingModels.has(beam.model)) {
                this.missingModels.add(beam.model);
                this.quakeWorld.printToConsole(`Missing beam model ${beam.model}\n`);
            }
            return undefined;
        }
        const model = new AliasModel(this.pak.get(beam.model));
        const skinTexture = new Texture(this.app.graphicsDevice, {
            name: `${beam.model} skin`,
            width: model.skinWidth,
            height: model.skinHeight,
            format: PIXELFORMAT_R8,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_REPEAT,
            addressV: ADDRESS_REPEAT,
            mipmaps: false,
            levels: [new Uint8Array(model.skins[0].pixels[0])]
        });
        const material = new ShaderMaterial({
            uniqueName: `Quake beam ${beam.model}`,
            attributes: {
                aPosition: SEMANTIC_POSITION,
                aNormal: SEMANTIC_NORMAL,
                aUv0: SEMANTIC_TEXCOORD0
            },
            vertexGLSL: ALIAS_VERTEX_SHADER,
            fragmentGLSL: ALIAS_FRAGMENT_SHADER
        });
        configureQuakeAliasRaster(material);
        material.depthTest = true;
        material.depthWrite = true;
        material.setParameter('uIndexMap', skinTexture);
        material.setParameter('uPaletteMap', this.paletteTexture);
        material.setParameter('uColormap', this.colormapTexture);
        material.setParameter('uShadeDirection', new Float32Array([1, 0, 0]));
        material.setParameter('uAmbient', 1);
        material.setParameter('uShade', 0);
        material.setParameter('uGamma', 1);
        material.update();
        const asset = {
            material,
            mesh: this.createMesh(model, model.frames[0].frames[0]),
            path: beam.model,
            texture: skinTexture
        };
        this.assets.set(beam.model, asset);
        return asset;
    }

    private segmentAt(index: number, asset: BeamAsset): BeamSegment {
        let segment = this.segments[index];
        if (!segment) {
            const meshInstance = new MeshInstance(asset.mesh, asset.material);
            const entity = new Entity(`Quake beam segment ${index}`);
            entity.addComponent('render', {
                castShadows: false,
                meshInstances: [meshInstance],
                receiveShadows: false
            });
            this.root.addChild(entity);
            segment = { asset, entity, meshInstance };
            this.segments.push(segment);
        } else if (segment.asset !== asset) {
            segment.asset = asset;
            segment.meshInstance.mesh = asset.mesh;
            segment.meshInstance.material = asset.material;
        }
        return segment;
    }

    private createMesh(model: AliasModel, frame: AliasSimpleFrame): Mesh {
        const positions: number[] = [];
        const normals: number[] = [];
        const textureCoordinates: number[] = [];
        const indices: number[] = [];
        for (const triangle of model.triangles) {
            for (const vertexIndex of triangle.vertices) {
                positions.push(...quakeToPlayCanvas(frame.vertices[vertexIndex]));
                normals.push(...quakeToPlayCanvas(
                    QUAKE_ALIAS_NORMALS[frame.packedVertices[vertexIndex].normalIndex]
                ));
                const textureVertex = model.textureVertices[vertexIndex];
                let s = textureVertex.s;
                if (!triangle.facesFront && textureVertex.onSeam) {
                    s += model.skinWidth / 2;
                }
                textureCoordinates.push(
                    (s + 0.5) / model.skinWidth,
                    (textureVertex.t + 0.5) / model.skinHeight
                );
                indices.push(indices.length);
            }
        }
        const mesh = new Mesh(this.app.graphicsDevice);
        mesh.setPositions(positions);
        mesh.setNormals(normals);
        mesh.setUvs(0, textureCoordinates);
        mesh.setIndices(indices);
        mesh.update(PRIMITIVE_TRIANGLES);
        return mesh;
    }
}
