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
    quakeEntitySyncBase,
    quakeGroupFrameIndex,
    quakeModelIndex
} from './animation';
import {
    createColormapTexture,
    createPaletteTexture,
    updatePaletteTexture
} from './palette';
import {
    EF_ROTATE,
    hasQuakeRocketLight,
    quakeModelTrailType,
    quakeRotatingModelYaw
} from './particle-effects';
import { calculateQuakeAliasLighting, sampleQuakeBspLight } from './quake-lighting';
import { quakeAliasRotation } from './quake-transform';
import { ALIAS_FRAGMENT_SHADER, ALIAS_VERTEX_SHADER } from './shaders';
import { quakeToPlayCanvas } from './world-renderer';
import { AliasModel, type AliasSimpleFrame } from '../formats/mdl';
import type { PakArchive } from '../formats/pak';
import {
    quakeProtocolAngle,
    quakeProtocolByte,
    quakeProtocolCoordinate
} from '../game/quake-protocol';
import type {
    QuakeDynamicLight,
    QuakeStaticEntity,
    QuakeWorldRuntime
} from '../game/quake-world';

interface AliasAsset {
    material: ShaderMaterial;
    meshes: Map<number, Mesh>;
    model: AliasModel;
    path: string;
    skinIntervals: number[];
    skinTextures: Texture[];
}

interface AliasEntityInstance {
    asset: AliasAsset;
    entity: Entity;
    meshInstance: MeshInstance;
    previousOrigin?: [number, number, number];
    reference?: number;
    staticEntity?: QuakeStaticEntity;
    syncBase: number;
}

interface AliasEntityState {
    angles: [number, number, number];
    frame: number;
    origin: [number, number, number];
}

export class WorldAliasRenderer {
    readonly app: AppBase;
    readonly pak: PakArchive;
    readonly quakeWorld: QuakeWorldRuntime;
    readonly paletteTexture: Texture;
    readonly colormapTexture: Texture;
    readonly root = new Entity('Quake alias entities');
    readonly assets = new Map<string, AliasAsset>();
    readonly instances: AliasEntityInstance[] = [];
    readonly instancesByReference = new Map<number, AliasEntityInstance>();
    readonly instancesByStaticId = new Map<number, AliasEntityInstance>();

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
        this.buildEntities();
    }

    setPalette(palette: Uint8Array<ArrayBufferLike>): void {
        updatePaletteTexture(this.paletteTexture, palette);
    }

    destroy(): void {
        this.root.destroy();
        for (const asset of this.assets.values()) {
            asset.material.destroy();
            for (const mesh of asset.meshes.values()) mesh.destroy();
            for (const texture of asset.skinTextures) texture.destroy();
        }
        this.paletteTexture.destroy();
        this.colormapTexture.destroy();
    }

    update(time: number): void {
        this.discoverEntities(time);
        this.discoverStaticEntities(time);
        const dynamicLights = this.quakeWorld.activeDynamicLights();
        for (const instance of this.instances) {
            const state = this.entityState(instance);
            instance.entity.enabled = state !== null;
            if (!state) {
                instance.previousOrigin = undefined;
                continue;
            }
            const animationTime = time + instance.syncBase;
            instance.meshInstance.mesh = this.meshForFrame(
                instance.asset, state.frame, animationTime
            );
            instance.meshInstance.setParameter(
                'uIndexMap', this.skinTextureForTime(instance.asset, animationTime)
            );
            const { angles, origin } = state;
            const trailType = quakeModelTrailType(instance.asset.model.flags);
            if (instance.previousOrigin && trailType !== undefined && instance.previousOrigin.some(
                (component, axis) => component !== origin[axis]
            )) {
                this.quakeWorld.emitParticleEvent({
                    color: 0,
                    count: 0,
                    direction: [0, 0, 0],
                    end: [...origin],
                    kind: 'trail',
                    origin: [...instance.previousOrigin],
                    trailType
                });
            }
            instance.previousOrigin = [...origin];
            const renderedYaw = (instance.asset.model.flags & EF_ROTATE) !== 0 ?
                quakeRotatingModelYaw(time) : angles[1];
            const renderedAngles: [number, number, number] = [
                angles[0], renderedYaw, angles[2]
            ];
            instance.entity.setPosition(...quakeToPlayCanvas(origin));
            instance.entity.setRotation(quakeAliasRotation(renderedAngles));
            if (hasQuakeRocketLight(instance.asset.model.flags)) {
                const lightKey = instance.reference ?? -(instance.staticEntity!.id + 1);
                const rocketLight: QuakeDynamicLight = {
                    decay: 0,
                    die: this.quakeWorld.time + 0.01,
                    key: lightKey,
                    minimumLight: 0,
                    origin: [...origin],
                    radius: 200
                };
                this.quakeWorld.dynamicLights.set(lightKey, rocketLight);
                const previousLight = dynamicLights.findIndex(
                    light => light.key === lightKey
                );
                if (previousLight === -1) {
                    dynamicLights.push(rocketLight);
                } else {
                    dynamicLights[previousLight] = rocketLight;
                }
            }
            const lighting = calculateQuakeAliasLighting(
                sampleQuakeBspLight(
                    this.quakeWorld.map,
                    origin,
                    time,
                    this.quakeWorld.lightStyles
                ),
                origin,
                renderedAngles,
                dynamicLights
            );
            instance.meshInstance.setParameter('uShadeDirection', new Float32Array(
                lighting.shadeDirection
            ));
            instance.meshInstance.setParameter('uAmbient', lighting.ambient);
            instance.meshInstance.setParameter('uShade', lighting.shade);
        }
    }

    private buildEntities(): void {
        this.discoverEntities(0);
        this.update(this.quakeWorld.time);
    }

    private discoverEntities(time: number): void {
        for (let reference = 1; reference < this.quakeWorld.vm.edicts.length; reference++) {
            if (reference === this.quakeWorld.playerReference) {
                continue;
            }
            const edict = this.quakeWorld.vm.entity(reference);
            const path = this.quakeWorld.vm.getEntityString(reference, 'model');
            if (edict.free || !path.toLowerCase().endsWith('.mdl') || !this.pak.has(path)) {
                continue;
            }
            const skin = quakeProtocolByte(
                this.quakeWorld.vm.getEntityFloat(reference, 'skin')
            );
            const assetKey = `${path}/${skin}`;
            let asset = this.assets.get(assetKey);
            if (!asset) {
                asset = this.createAsset(path, skin);
                this.assets.set(assetKey, asset);
            }
            const existing = this.instancesByReference.get(reference);
            if (existing) {
                if (existing.asset !== asset) {
                    existing.asset = asset;
                    existing.meshInstance.material = asset.material;
                    const frameIndex = quakeProtocolByte(
                        this.quakeWorld.vm.getEntityFloat(reference, 'frame')
                    );
                    existing.meshInstance.mesh = this.meshForFrame(
                        asset, frameIndex, time + existing.syncBase
                    );
                }
                continue;
            }
            const frameIndex = quakeProtocolByte(
                this.quakeWorld.vm.getEntityFloat(reference, 'frame')
            );
            const meshInstance = new MeshInstance(
                this.meshForFrame(asset, frameIndex, time), asset.material
            );
            const entity = new Entity(this.quakeWorld.vm.getEntityString(reference, 'classname'));
            entity.addComponent('render', {
                castShadows: false,
                meshInstances: [meshInstance],
                receiveShadows: false
            });
            this.root.addChild(entity);
            const instance = {
                asset,
                entity,
                meshInstance,
                reference,
                syncBase: asset.model.syncType === 0 ? 0 : quakeEntitySyncBase(reference)
            };
            this.instances.push(instance);
            this.instancesByReference.set(reference, instance);
        }
    }

    private discoverStaticEntities(time: number): void {
        for (const staticEntity of this.quakeWorld.staticEntities) {
            const path = staticEntity.model;
            if (this.instancesByStaticId.has(staticEntity.id) ||
                !path.toLowerCase().endsWith('.mdl') || !this.pak.has(path)) {
                continue;
            }
            const assetKey = `${path}/${staticEntity.skin}`;
            let asset = this.assets.get(assetKey);
            if (!asset) {
                asset = this.createAsset(path, staticEntity.skin);
                this.assets.set(assetKey, asset);
            }
            const meshInstance = new MeshInstance(
                this.meshForFrame(asset, staticEntity.frame, time), asset.material
            );
            const entity = new Entity(staticEntity.classname);
            entity.addComponent('render', {
                castShadows: false,
                meshInstances: [meshInstance],
                receiveShadows: false
            });
            this.root.addChild(entity);
            const instance: AliasEntityInstance = {
                asset,
                entity,
                meshInstance,
                staticEntity,
                syncBase: 0
            };
            this.instances.push(instance);
            this.instancesByStaticId.set(staticEntity.id, instance);
        }
    }

    private entityState(instance: AliasEntityInstance): AliasEntityState | null {
        if (instance.staticEntity) {
            const minimum = instance.staticEntity.origin.map(
                component => component - 16
            ) as [number, number, number];
            const maximum = instance.staticEntity.origin.map(
                component => component + 16
            ) as [number, number, number];
            if (!this.quakeWorld.boundsVisibleToPlayer(minimum, maximum)) {
                return null;
            }
            return {
                angles: [...instance.staticEntity.angles],
                frame: instance.staticEntity.frame,
                origin: [...instance.staticEntity.origin]
            };
        }
        const reference = instance.reference;
        if (reference === undefined) return null;
        const edict = this.quakeWorld.vm.entity(reference);
        if (edict.free || !this.quakeWorld.entityVisible(reference) ||
            this.quakeWorld.vm.getEntityString(reference, 'model') !== instance.asset.path) {
            return null;
        }
        return {
            angles: this.quakeWorld.vm.getEntityVector(reference, 'angles').map(
                quakeProtocolAngle
            ) as [number, number, number],
            frame: quakeProtocolByte(this.quakeWorld.vm.getEntityFloat(reference, 'frame')),
            origin: this.quakeWorld.vm.getEntityVector(reference, 'origin').map(
                quakeProtocolCoordinate
            ) as [number, number, number]
        };
    }

    private createAsset(path: string, requestedSkin: number): AliasAsset {
        const model = new AliasModel(this.pak.get(path));
        const skinIndex = quakeModelIndex(requestedSkin, model.skins.length);
        const skinTextures = model.skins[skinIndex].pixels.map(
            (pixels, subframeIndex) => new Texture(this.app.graphicsDevice, {
                name: `${path} skin ${skinIndex}/${subframeIndex}`,
                width: model.skinWidth,
                height: model.skinHeight,
                format: PIXELFORMAT_R8,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST,
                addressU: ADDRESS_REPEAT,
                addressV: ADDRESS_REPEAT,
                mipmaps: false,
                levels: [new Uint8Array(pixels)]
            })
        );
        const material = new ShaderMaterial({
            uniqueName: `Quake alias ${path}/${skinIndex}`,
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
        material.setParameter('uIndexMap', skinTextures[0]);
        material.setParameter('uPaletteMap', this.paletteTexture);
        material.setParameter('uColormap', this.colormapTexture);
        material.setParameter('uShadeDirection', new Float32Array([1, 0, 0]));
        material.setParameter('uAmbient', 1);
        material.setParameter('uShade', 0);
        material.setParameter('uGamma', 1);
        material.update();
        return {
            material,
            meshes: new Map(),
            model,
            path,
            skinIntervals: model.skins[skinIndex].intervals,
            skinTextures
        };
    }

    private meshForFrame(asset: AliasAsset, requestedFrame: number, time: number): Mesh {
        const frameIndex = quakeModelIndex(requestedFrame, asset.model.frames.length);
        const frameGroup = asset.model.frames[frameIndex];
        const subframeIndex = quakeGroupFrameIndex(frameGroup.intervals, time);
        const meshKey = frameIndex * 256 + subframeIndex;
        let mesh = asset.meshes.get(meshKey);
        if (!mesh) {
            mesh = this.createMesh(asset.model, frameGroup.frames[subframeIndex]);
            asset.meshes.set(meshKey, mesh);
        }
        return mesh;
    }

    private skinTextureForTime(asset: AliasAsset, time: number): Texture {
        return asset.skinTextures[quakeGroupFrameIndex(asset.skinIntervals, time)];
    }

    private createMesh(model: AliasModel, frame: AliasSimpleFrame): Mesh {
        const positions: number[] = [];
        const normals: number[] = [];
        const textureCoordinates: number[] = [];
        const indices: number[] = [];
        for (const triangle of model.triangles) {
            for (const vertexIndex of triangle.vertices) {
                positions.push(...quakeToPlayCanvas(frame.vertices[vertexIndex]));
                const normalIndex = frame.packedVertices[vertexIndex].normalIndex;
                normals.push(...quakeToPlayCanvas(QUAKE_ALIAS_NORMALS[normalIndex]));
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
