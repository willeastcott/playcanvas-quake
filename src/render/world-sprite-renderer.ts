import {
    ADDRESS_CLAMP_TO_EDGE,
    CULLFACE_NONE,
    Entity,
    FILTER_NEAREST,
    Mesh,
    MeshInstance,
    PIXELFORMAT_R8,
    PRIMITIVE_TRIANGLES,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial,
    Texture,
    type AppBase
} from 'playcanvas';

import {
    quakeEntitySyncBase,
    quakeGroupFrameIndex,
    quakeModelIndex
} from './animation';
import { createPaletteTexture, updatePaletteTexture } from './palette';
import { quakeOrientedSpriteRotation, quakeUprightSpriteRotation } from './quake-transform';
import { SPRITE_FRAGMENT_SHADER, SPRITE_VERTEX_SHADER } from './shaders';
import { quakeToPlayCanvas } from './world-renderer';
import type { PakArchive } from '../formats/pak';
import { SpriteModel, SpriteType, type SpriteFrame } from '../formats/spr';
import {
    quakeProtocolAngle,
    quakeProtocolByte,
    quakeProtocolCoordinate
} from '../game/quake-protocol';
import type { QuakeStaticEntity, QuakeWorldRuntime } from '../game/quake-world';

interface SpriteRenderable {
    material: ShaderMaterial;
    mesh: Mesh;
    texture: Texture;
}

interface SpriteAsset {
    model: SpriteModel;
    path: string;
    renderables: SpriteRenderable[][];
}

interface SpriteEntityInstance {
    asset: SpriteAsset;
    entity: Entity;
    meshInstance: MeshInstance;
    reference?: number;
    staticEntity?: QuakeStaticEntity;
}

interface SpriteEntityState {
    angles: [number, number, number];
    frame: number;
    origin: [number, number, number];
}

export class WorldSpriteRenderer {
    readonly app: AppBase;
    readonly cameraEntity: Entity;
    readonly pak: PakArchive;
    readonly quakeWorld: QuakeWorldRuntime;
    readonly paletteTexture: Texture;
    readonly root = new Entity('Quake sprite entities');
    readonly assets = new Map<string, SpriteAsset>();
    readonly instances: SpriteEntityInstance[] = [];
    readonly instancesByReference = new Map<number, SpriteEntityInstance>();
    readonly instancesByStaticId = new Map<number, SpriteEntityInstance>();

    constructor(
        app: AppBase,
        cameraEntity: Entity,
        pak: PakArchive,
        palette: Uint8Array<ArrayBufferLike>,
        quakeWorld: QuakeWorldRuntime
    ) {
        this.app = app;
        this.cameraEntity = cameraEntity;
        this.pak = pak;
        this.quakeWorld = quakeWorld;
        this.paletteTexture = createPaletteTexture(app.graphicsDevice, palette);
        this.app.root.addChild(this.root);
        this.discoverEntities(0);
        this.update(0);
    }

    setPalette(palette: Uint8Array<ArrayBufferLike>): void {
        updatePaletteTexture(this.paletteTexture, palette);
    }

    destroy(): void {
        this.root.destroy();
        for (const asset of this.assets.values()) {
            for (const renderable of asset.renderables.flat()) {
                renderable.material.destroy();
                renderable.mesh.destroy();
                renderable.texture.destroy();
            }
        }
        this.paletteTexture.destroy();
    }

    update(time: number): void {
        this.discoverEntities(time);
        this.discoverStaticEntities(time);
        for (const instance of this.instances) {
            const state = this.entityState(instance);
            instance.entity.enabled = state !== null;
            if (!state) {
                continue;
            }
            const renderable = this.renderableForFrame(
                instance.asset, state.frame, time, instance.reference
            );
            instance.meshInstance.mesh = renderable.mesh;
            instance.meshInstance.material = renderable.material;
            instance.entity.setPosition(...quakeToPlayCanvas(state.origin));
            instance.entity.enabled = this.orient(instance, state.angles);
        }
    }

    private discoverEntities(time: number): void {
        for (let reference = 1; reference < this.quakeWorld.vm.edicts.length; reference++) {
            if (reference === this.quakeWorld.playerReference) {
                continue;
            }
            const edict = this.quakeWorld.vm.entity(reference);
            const path = this.quakeWorld.vm.getEntityString(reference, 'model');
            if (edict.free || !path.toLowerCase().endsWith('.spr') || !this.pak.has(path)) {
                continue;
            }
            let asset = this.assets.get(path);
            if (!asset) {
                asset = this.createAsset(path);
                this.assets.set(path, asset);
            }
            const existing = this.instancesByReference.get(reference);
            const requestedFrame = quakeProtocolByte(
                this.quakeWorld.vm.getEntityFloat(reference, 'frame')
            );
            const renderable = this.renderableForFrame(asset, requestedFrame, time, reference);
            if (existing) {
                if (existing.asset !== asset) {
                    existing.asset = asset;
                    existing.meshInstance.mesh = renderable.mesh;
                    existing.meshInstance.material = renderable.material;
                }
                continue;
            }
            const meshInstance = new MeshInstance(renderable.mesh, renderable.material);
            const entity = new Entity(this.quakeWorld.vm.getEntityString(reference, 'classname'));
            entity.addComponent('render', {
                castShadows: false,
                meshInstances: [meshInstance],
                receiveShadows: false
            });
            this.root.addChild(entity);
            const instance = { asset, entity, meshInstance, reference };
            this.instances.push(instance);
            this.instancesByReference.set(reference, instance);
        }
    }

    private discoverStaticEntities(time: number): void {
        for (const staticEntity of this.quakeWorld.staticEntities) {
            const path = staticEntity.model;
            if (this.instancesByStaticId.has(staticEntity.id) ||
                !path.toLowerCase().endsWith('.spr') || !this.pak.has(path)) {
                continue;
            }
            let asset = this.assets.get(path);
            if (!asset) {
                asset = this.createAsset(path);
                this.assets.set(path, asset);
            }
            const renderable = this.renderableForFrame(
                asset, staticEntity.frame, time, undefined
            );
            const meshInstance = new MeshInstance(renderable.mesh, renderable.material);
            const entity = new Entity(staticEntity.classname);
            entity.addComponent('render', {
                castShadows: false,
                meshInstances: [meshInstance],
                receiveShadows: false
            });
            this.root.addChild(entity);
            const instance: SpriteEntityInstance = {
                asset,
                entity,
                meshInstance,
                staticEntity
            };
            this.instances.push(instance);
            this.instancesByStaticId.set(staticEntity.id, instance);
        }
    }

    private entityState(instance: SpriteEntityInstance): SpriteEntityState | null {
        if (instance.staticEntity) {
            const halfWidth = instance.asset.model.width / 2;
            const halfHeight = instance.asset.model.height / 2;
            const minimum: [number, number, number] = [
                instance.staticEntity.origin[0] - halfWidth,
                instance.staticEntity.origin[1] - halfWidth,
                instance.staticEntity.origin[2] - halfHeight
            ];
            const maximum: [number, number, number] = [
                instance.staticEntity.origin[0] + halfWidth,
                instance.staticEntity.origin[1] + halfWidth,
                instance.staticEntity.origin[2] + halfHeight
            ];
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

    private createAsset(path: string): SpriteAsset {
        const model = new SpriteModel(this.pak.get(path));
        const renderables = model.frames.map((group, frameIndex) => group.frames.map(
            (frame, subframeIndex) => this.createRenderable(
                path, frameIndex, subframeIndex, frame
            )
        ));
        return { model, path, renderables };
    }

    private createRenderable(
        path: string,
        frameIndex: number,
        subframeIndex: number,
        frame: SpriteFrame
    ): SpriteRenderable {
        const texture = new Texture(this.app.graphicsDevice, {
            name: `${path} frame ${frameIndex}/${subframeIndex}`,
            width: frame.width,
            height: frame.height,
            format: PIXELFORMAT_R8,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            mipmaps: false,
            levels: [new Uint8Array(frame.pixels)]
        });
        const material = new ShaderMaterial({
            uniqueName: `Quake sprite ${path}/${frameIndex}/${subframeIndex}`,
            attributes: {
                aPosition: SEMANTIC_POSITION,
                aUv0: SEMANTIC_TEXCOORD0
            },
            vertexGLSL: SPRITE_VERTEX_SHADER,
            fragmentGLSL: SPRITE_FRAGMENT_SHADER
        });
        material.cull = CULLFACE_NONE;
        material.depthTest = true;
        material.depthWrite = true;
        material.setParameter('uIndexMap', texture);
        material.setParameter('uPaletteMap', this.paletteTexture);
        material.update();

        const left = frame.origin[0];
        const right = left + frame.width;
        const up = frame.origin[1];
        const down = up - frame.height;
        const mesh = new Mesh(this.app.graphicsDevice);
        mesh.setPositions([
            left, down, 0,
            left, up, 0,
            right, up, 0,
            right, down, 0
        ]);
        mesh.setUvs(0, [0, 1, 0, 0, 1, 0, 1, 1]);
        mesh.setIndices([0, 1, 2, 0, 2, 3]);
        mesh.update(PRIMITIVE_TRIANGLES);
        return { material, mesh, texture };
    }

    private renderableForFrame(
        asset: SpriteAsset,
        requestedFrame: number,
        time: number,
        reference?: number
    ): SpriteRenderable {
        const frameIndex = quakeModelIndex(requestedFrame, asset.model.frames.length);
        const group = asset.model.frames[frameIndex];
        let subframeIndex = 0;
        if (group.frames.length > 1) {
            const syncOffset = asset.model.syncType === 0 || reference === undefined ? 0 :
                quakeEntitySyncBase(reference);
            subframeIndex = quakeGroupFrameIndex(group.intervals, time, syncOffset);
        }
        return asset.renderables[frameIndex][subframeIndex];
    }

    private orient(
        instance: SpriteEntityInstance,
        angles: [number, number, number]
    ): boolean {
        switch (instance.asset.model.type) {
            case SpriteType.ViewParallel:
                instance.entity.setRotation(this.cameraEntity.getRotation());
                return true;
            case SpriteType.ViewParallelOriented:
                instance.entity.setRotation(this.cameraEntity.getRotation());
                instance.entity.rotateLocal(0, 0, angles[2]);
                return true;
            case SpriteType.Oriented:
                instance.entity.setRotation(quakeOrientedSpriteRotation(angles));
                return true;
            case SpriteType.ViewParallelUpright: {
                const forward = this.cameraEntity.forward;
                const rotation = quakeUprightSpriteRotation([
                    forward.x, forward.y, forward.z
                ]);
                if (rotation) instance.entity.setRotation(rotation);
                return rotation !== undefined;
            }
            case SpriteType.FacingUpright: {
                const position = instance.entity.getPosition();
                const cameraPosition = this.cameraEntity.getPosition();
                const rotation = quakeUprightSpriteRotation([
                    position.x - cameraPosition.x,
                    position.y - cameraPosition.y,
                    position.z - cameraPosition.z
                ]);
                if (rotation) instance.entity.setRotation(rotation);
                return rotation !== undefined;
            }
        }
    }
}
