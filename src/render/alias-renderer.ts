import {
    ADDRESS_REPEAT,
    Entity,
    FILTER_NEAREST,
    Layer,
    Mesh,
    MeshInstance,
    PIXELFORMAT_R8,
    PRIMITIVE_TRIANGLES,
    SEMANTIC_NORMAL,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial,
    Texture,
    type AppBase,
    type GraphicsDevice
} from 'playcanvas';

import { QUAKE_ALIAS_NORMALS } from './alias-normals';
import { configureQuakeAliasRaster } from './alias-raster';
import { quakeGroupFrameIndex, quakeModelIndex } from './animation';
import {
    createColormapTexture,
    createPaletteTexture,
    updatePaletteTexture
} from './palette';
import { calculateQuakeAliasLighting, sampleQuakeBspLight } from './quake-lighting';
import {
    quakeViewModelLocalPosition,
    quakeViewModelLocalRotation,
    quakeViewModelLightDirection,
    quakeViewModelVerticalOffset
} from './quake-transform';
import { ALIAS_FRAGMENT_SHADER, ALIAS_VERTEX_SHADER } from './shaders';
import type { Vec3 } from '../formats/bsp';
import { AliasModel, type AliasSimpleFrame } from '../formats/mdl';
import type { PakArchive } from '../formats/pak';
import type { QuakeWorldRuntime } from '../game/quake-world';

const toCameraSpace = (position: Vec3): Vec3 => [-position[1], position[2], -position[0]];

const createSkinTexture = (
    device: GraphicsDevice,
    model: AliasModel,
    path: string,
    subframeIndex: number
): Texture => new Texture(device, {
    name: `${path} skin 0/${subframeIndex}`,
    width: model.skinWidth,
    height: model.skinHeight,
    format: PIXELFORMAT_R8,
    minFilter: FILTER_NEAREST,
    magFilter: FILTER_NEAREST,
    addressU: ADDRESS_REPEAT,
    addressV: ADDRESS_REPEAT,
    mipmaps: false,
    levels: [new Uint8Array(model.skins[0].pixels[subframeIndex])]
});

interface ViewModelAsset {
    material: ShaderMaterial;
    meshes: Map<number, Mesh>;
    model: AliasModel;
    path: string;
    skinTextures: Texture[];
}

export class ViewModelRenderer {
    readonly app: AppBase;
    readonly camera: Entity;
    readonly pak: PakArchive;
    quakeWorld: QuakeWorldRuntime;
    readonly paletteTexture: Texture;
    readonly colormapTexture: Texture;
    readonly layer: Layer;
    readonly entity: Entity;
    readonly assets = new Map<string, ViewModelAsset>();
    currentAsset?: ViewModelAsset;
    meshInstance?: MeshInstance;

    constructor(
        app: AppBase,
        camera: Entity,
        pak: PakArchive,
        palette: Uint8Array<ArrayBufferLike>,
        quakeWorld: QuakeWorldRuntime
    ) {
        this.app = app;
        this.camera = camera;
        this.pak = pak;
        this.quakeWorld = quakeWorld;
        this.paletteTexture = createPaletteTexture(app.graphicsDevice, palette);
        this.colormapTexture = createColormapTexture(
            app.graphicsDevice, pak.get('gfx/colormap.lmp')
        );
        this.layer = new Layer({
            clearDepthBuffer: true,
            name: 'Quake viewmodel'
        });
        this.app.scene.layers.pushOpaque(this.layer);
        const cameraComponent = this.camera.camera;
        if (!cameraComponent) {
            throw new Error('Viewmodel camera has no camera component');
        }
        cameraComponent.layers = [...cameraComponent.layers, this.layer.id];
        this.entity = new Entity('Shotgun viewmodel');
        this.entity.setLocalPosition(0, 2, 0);
        this.camera.addChild(this.entity);
        this.createRenderable('progs/v_shot.mdl');
    }

    setPalette(palette: Uint8Array<ArrayBufferLike>): void {
        updatePaletteTexture(this.paletteTexture, palette);
    }

    replaceWorld(quakeWorld: QuakeWorldRuntime): void {
        this.quakeWorld = quakeWorld;
    }

    update(
        path: string,
        requestedFrame: number,
        time: number,
        bob = 0,
        lightingOrigin: Vec3 = [0, 0, 0],
        yaw = 0,
        viewAngles: Vec3 = [0, yaw, 0],
        modelAngles: Vec3 = [0, yaw, 0],
        screenOffset: Vec3 = [0, 0, 0],
        viewSize = 100
    ): void {
        if (!this.meshInstance) {
            return;
        }
        this.entity.enabled = Boolean(path) && this.pak.has(path);
        if (!this.entity.enabled) {
            return;
        }
        const cameraRotation = this.camera.getRotation();
        this.entity.setLocalPosition(quakeViewModelLocalPosition(
            cameraRotation,
            viewAngles,
            bob,
            quakeViewModelVerticalOffset(viewSize),
            screenOffset
        ));
        this.entity.setLocalRotation(quakeViewModelLocalRotation(
            cameraRotation, modelAngles
        ));
        const asset = this.getAsset(path);
        if (asset !== this.currentAsset) {
            this.currentAsset = asset;
            this.meshInstance.material = asset.material;
        }
        const frameIndex = quakeModelIndex(requestedFrame, asset.model.frames.length);
        const frameGroup = asset.model.frames[frameIndex];
        const subframeIndex = quakeGroupFrameIndex(frameGroup.intervals, time);
        const meshKey = frameIndex * 256 + subframeIndex;
        let mesh = asset.meshes.get(meshKey);
        if (!mesh) {
            mesh = this.createMesh(asset.model, frameGroup.frames[subframeIndex]);
            asset.meshes.set(meshKey, mesh);
        }
        this.meshInstance.mesh = mesh;
        const skinIndex = quakeGroupFrameIndex(asset.model.skins[0].intervals, time);
        this.meshInstance.setParameter('uIndexMap', asset.skinTextures[skinIndex]);
        const lighting = calculateQuakeAliasLighting(
            sampleQuakeBspLight(
                this.quakeWorld.map,
                lightingOrigin,
                time,
                this.quakeWorld.lightStyles
            ),
            lightingOrigin,
            modelAngles,
            this.quakeWorld.activeDynamicLights(),
            24
        );
        this.meshInstance.setParameter(
            'uShadeDirection', new Float32Array(quakeViewModelLightDirection(modelAngles))
        );
        this.meshInstance.setParameter('uAmbient', lighting.ambient);
        this.meshInstance.setParameter('uShade', lighting.shade);
    }

    private createMesh(model: AliasModel, frame: AliasSimpleFrame): Mesh {
        const positions: number[] = [];
        const normals: number[] = [];
        const textureCoordinates: number[] = [];
        const indices: number[] = [];
        for (const triangle of model.triangles) {
            for (const vertexIndex of triangle.vertices) {
                positions.push(...toCameraSpace(frame.vertices[vertexIndex]));
                const normalIndex = frame.packedVertices[vertexIndex].normalIndex;
                normals.push(...toCameraSpace(QUAKE_ALIAS_NORMALS[normalIndex]));
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

    private getAsset(path: string): ViewModelAsset {
        let asset = this.assets.get(path);
        if (asset) {
            return asset;
        }
        const model = new AliasModel(this.pak.get(path));
        const skinTextures = model.skins[0].pixels.map(
            (_pixels, subframeIndex) => createSkinTexture(
                this.app.graphicsDevice, model, path, subframeIndex
            )
        );
        const material = new ShaderMaterial({
            uniqueName: `Quake viewmodel ${path}`,
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
        material.setParameter('uShadeDirection', new Float32Array([0, 0, -1]));
        material.setParameter('uAmbient', 24 / 255);
        material.setParameter('uShade', 24 / 255);
        material.setParameter('uGamma', 1);
        material.update();
        asset = { material, meshes: new Map(), model, path, skinTextures };
        this.assets.set(path, asset);
        return asset;
    }

    private createRenderable(path: string): void {
        const asset = this.getAsset(path);
        this.currentAsset = asset;
        const mesh = this.createMesh(asset.model, asset.model.frames[0].frames[0]);
        asset.meshes.set(0, mesh);
        this.meshInstance = new MeshInstance(mesh, asset.material);
        this.meshInstance.drawOrder = 1_000;
        this.entity.addComponent('render', {
            castShadows: false,
            layers: [this.layer.id],
            meshInstances: [this.meshInstance],
            receiveShadows: false
        });
    }
}
