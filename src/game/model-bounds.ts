import { BspMap, type Vec3 } from '../formats/bsp';
import { AliasModel } from '../formats/mdl';
import type { PakArchive } from '../formats/pak';
import { SpriteModel } from '../formats/spr';

export interface QuakeModelBounds {
    maximum: Vec3;
    minimum: Vec3;
}

export const loadQuakeModelBounds = (
    pak: PakArchive,
    modelPath: string
): QuakeModelBounds | undefined => {
    if (!pak.has(modelPath)) return undefined;
    const extension = modelPath.slice(modelPath.lastIndexOf('.')).toLowerCase();
    if (extension === '.bsp') {
        const model = new BspMap(pak.get(modelPath)).models[0];
        return model ? { maximum: model.maxs, minimum: model.mins } : undefined;
    }
    if (extension === '.mdl') {
        const alias = new AliasModel(pak.get(modelPath));
        return alias.version === 6 ?
            { maximum: [16, 16, 16], minimum: [-16, -16, -16] } : undefined;
    }
    if (extension === '.spr') {
        const sprite = new SpriteModel(pak.get(modelPath));
        return {
            maximum: [sprite.width / 2, sprite.width / 2, sprite.height / 2],
            minimum: [-sprite.width / 2, -sprite.width / 2, -sprite.height / 2]
        };
    }
    return undefined;
};

export class QuakeModelBoundsCache {
    readonly pak: PakArchive;
    private readonly cache = new Map<string, QuakeModelBounds | undefined>();

    constructor(pak: PakArchive) {
        this.pak = pak;
    }

    get(modelPath: string): QuakeModelBounds | undefined {
        if (!this.cache.has(modelPath)) {
            this.cache.set(modelPath, loadQuakeModelBounds(this.pak, modelPath));
        }
        return this.cache.get(modelPath);
    }
}
