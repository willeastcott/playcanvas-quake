import type { QuakeWorldSaveState } from './quake-world';

export const QUAKE_SAVE_SLOT_COUNT = 12;
export const QUAKE_UNUSED_SAVE_SLOT = '--- UNUSED SLOT ---';

const SAVEGAME_COMMENT_LENGTH = 39;
const SAVEGAME_FORMAT = 'quake-playcanvas-save';
const SAVEGAME_EXTENSION = '.sav';

export interface QuakeSaveSlot {
    comment: string;
    format: typeof SAVEGAME_FORMAT;
    state: QuakeWorldSaveState;
    version: 1;
}

export interface QuakeSaveStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export const quakeSaveName = (name: string): string | undefined => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.includes('..') || trimmed.length > 255) return undefined;
    const baseName = trimmed.toLowerCase().endsWith(SAVEGAME_EXTENSION) ?
        trimmed.slice(0, -SAVEGAME_EXTENSION.length) : trimmed;
    return baseName ? baseName.toLowerCase() : undefined;
};

export const quakeSaveKey = (name: string): string => {
    const normalized = quakeSaveName(name);
    if (!normalized) throw new Error(`Invalid Quake save name ${name}`);
    return `quake-playcanvas-save-${normalized}`;
};

const validateSlotIndex = (slot: number): void => {
    if (!Number.isInteger(slot) || slot < 0 || slot >= QUAKE_SAVE_SLOT_COUNT) {
        throw new Error(`Invalid Quake save slot ${slot}`);
    }
};

export const quakeSaveSlotKey = (slot: number): string => {
    validateSlotIndex(slot);
    return quakeSaveKey(`s${slot}`);
};

export const quakeSaveSlotNumber = (name: string): number | undefined => {
    const match = /^s(\d|1[01])$/i.exec(name.trim());
    return match ? Number(match[1]) : undefined;
};

export const quakeSaveComment = (
    levelName: string,
    killedMonsters: number,
    totalMonsters: number
): string => {
    const characters = new Array<string>(SAVEGAME_COMMENT_LENGTH).fill(' ');
    for (let index = 0; index < Math.min(levelName.length, characters.length); index++) {
        characters[index] = levelName[index];
    }
    const kills = `kills:${String(Math.trunc(killedMonsters)).padStart(3)}/${
        String(Math.trunc(totalMonsters)).padStart(3)}`;
    for (let index = 0; index < kills.length && index + 22 < characters.length; index++) {
        characters[index + 22] = kills[index];
    }
    return characters.join('');
};

export const quakeCreateSaveSlot = (
    state: QuakeWorldSaveState,
    comment: string
): QuakeSaveSlot => ({
    comment: comment.slice(0, SAVEGAME_COMMENT_LENGTH).padEnd(SAVEGAME_COMMENT_LENGTH),
    format: SAVEGAME_FORMAT,
    state,
    version: 1
});

export const quakeParseSaveSlot = (text: string | null): QuakeSaveSlot | undefined => {
    if (!text) return undefined;
    try {
        const value: unknown = JSON.parse(text);
        if (!value || typeof value !== 'object') return undefined;
        const slot = value as Partial<QuakeSaveSlot>;
        if (slot.format !== SAVEGAME_FORMAT || slot.version !== 1 ||
            typeof slot.comment !== 'string' || slot.comment.length !== SAVEGAME_COMMENT_LENGTH ||
            !slot.state || typeof slot.state !== 'object' || slot.state.version !== 1 ||
            typeof slot.state.mapName !== 'string') {
            return undefined;
        }
        return slot as QuakeSaveSlot;
    } catch {
        return undefined;
    }
};

export const quakeReadSave = (
    storage: QuakeSaveStorage,
    name: string
): QuakeSaveSlot | undefined => {
    try {
        return quakeParseSaveSlot(storage.getItem(quakeSaveKey(name)));
    } catch {
        return undefined;
    }
};

export const quakeReadSaveSlot = (
    storage: QuakeSaveStorage,
    slot: number
): QuakeSaveSlot | undefined => {
    validateSlotIndex(slot);
    return quakeReadSave(storage, `s${slot}`);
};

export const quakeReadSaveSlots = (storage: QuakeSaveStorage): Array<QuakeSaveSlot | undefined> => (
    Array.from({ length: QUAKE_SAVE_SLOT_COUNT }, (_, slot) => (
        quakeReadSaveSlot(storage, slot)
    ))
);

export const quakeWriteSave = (
    storage: QuakeSaveStorage,
    name: string,
    save: QuakeSaveSlot
): void => {
    storage.setItem(quakeSaveKey(name), JSON.stringify(save));
};

export const quakeWriteSaveSlot = (
    storage: QuakeSaveStorage,
    slot: number,
    save: QuakeSaveSlot
): void => {
    validateSlotIndex(slot);
    quakeWriteSave(storage, `s${slot}`, save);
};
