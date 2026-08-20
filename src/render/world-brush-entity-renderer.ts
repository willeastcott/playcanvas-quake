import { Entity, type AppBase } from 'playcanvas';

import { quakeEntityRotation } from './quake-transform';
import {
    WorldRenderer,
    quakeToPlayCanvas,
    type WorldBrushModelInstance,
    type QuakeSkyView
} from './world-renderer';
import { BspMap } from '../formats/bsp';
import type { PakArchive } from '../formats/pak';
import {
    quakeProtocolAngle,
    quakeProtocolCoordinate
} from '../game/quake-protocol';
import type { QuakeWorldRuntime } from '../game/quake-world';

interface BrushInstance {
    entity: Entity;
    model: WorldBrushModelInstance;
    path: string;
    reference: number;
}

export const quakeExternalBrushModelPath = (
    reference: number,
    path: string
): boolean => reference !== 0 && !path.startsWith('*') &&
    path.toLowerCase().endsWith('.bsp');

export class WorldBrushEntityRenderer {
    readonly app: AppBase;
    readonly quakeWorld: QuakeWorldRuntime;
    readonly instances: BrushInstance[] = [];
    readonly templates = new Map<string, WorldRenderer>();

    constructor(
        app: AppBase,
        pak: PakArchive,
        palette: Uint8Array<ArrayBufferLike>,
        quakeWorld: QuakeWorldRuntime
    ) {
        this.app = app;
        this.quakeWorld = quakeWorld;
        const seenReferences = new Set<number>();
        for (const reference of quakeWorld.entityReferences) {
            if (reference === null || seenReferences.has(reference)) {
                continue;
            }
            seenReferences.add(reference);
            const path = quakeWorld.vm.getEntityString(reference, 'model');
            if (quakeWorld.vm.entity(reference).free ||
                !quakeExternalBrushModelPath(reference, path) || !pak.has(path)) {
                continue;
            }
            let template = this.templates.get(path);
            if (!template) {
                template = new WorldRenderer(
                    app,
                    new BspMap(pak.get(path)),
                    palette,
                    pak.get('gfx/colormap.lmp')
                );
                template.root.enabled = false;
                this.templates.set(path, template);
            }
            const model = template.createBrushModelInstance(
                quakeWorld.vm.getEntityString(reference, 'classname')
            );
            model.root.enabled = true;
            this.app.root.addChild(model.root);
            this.instances.push({ entity: model.root, model, path, reference });
        }
        this.updateInstances();
    }

    setPalette(palette: Uint8Array<ArrayBufferLike>): void {
        for (const renderer of this.templates.values()) {
            renderer.setPalette(palette);
        }
    }

    destroy(): void {
        for (const instance of this.instances) {
            instance.entity.destroy();
            for (const batch of instance.model.batches) batch.mesh.destroy();
        }
        for (const renderer of this.templates.values()) renderer.destroy();
    }

    update(
        time: number,
        cameraPosition: Float32Array<ArrayBuffer>,
        skyView?: QuakeSkyView
    ): void {
        this.updateInstances();
        for (const [path, renderer] of this.templates) {
            renderer.updateBrushModelInstances(
                time,
                cameraPosition,
                this.instances.filter(instance => instance.path === path).map(
                    instance => instance.model
                ),
                skyView,
                this.quakeWorld.lightStyles
            );
        }
    }

    private updateInstances(): void {
        for (const instance of this.instances) {
            const edict = this.quakeWorld.vm.entity(instance.reference);
            instance.entity.enabled = !edict.free &&
                this.quakeWorld.entityVisible(instance.reference) &&
                this.quakeWorld.vm.getEntityString(instance.reference, 'model') === instance.path;
            if (!instance.entity.enabled) {
                continue;
            }
            const origin = this.quakeWorld.vm.getEntityVector(
                instance.reference, 'origin'
            ).map(quakeProtocolCoordinate) as [number, number, number];
            const angles = this.quakeWorld.vm.getEntityVector(
                instance.reference, 'angles'
            ).map(quakeProtocolAngle) as [number, number, number];
            instance.entity.setPosition(...quakeToPlayCanvas(origin));
            instance.entity.setRotation(quakeEntityRotation(angles));
        }
    }
}
