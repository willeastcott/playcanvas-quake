import { describe, expect, it } from 'vitest';

import type { QuakeWorldSaveState } from '../src/game/quake-world';
import {
    QUAKE_SAVE_SLOT_COUNT,
    quakeCreateSaveSlot,
    quakeParseSaveSlot,
    quakeReadSave,
    quakeReadSaveSlots,
    quakeSaveComment,
    quakeSaveKey,
    quakeSaveName,
    quakeSaveSlotKey,
    quakeSaveSlotNumber,
    quakeWriteSave,
    quakeWriteSaveSlot,
    type QuakeSaveStorage
} from '../src/game/save-game';

const testState: QuakeWorldSaveState = {
    clientSpawnParameters: new Array(16).fill(0),
    cvars: { skill: '1' },
    entityReferenceGenerations: [],
    entityReferences: [],
    gameplayRandomState: 123,
    inlineModelReferences: [],
    lightStyles: [[0, 'm']],
    mapName: 'e1m1',
    time: 12.5,
    version: 1,
    vm: {
        dynamicStrings: [],
        edicts: [],
        programCrc: 5927,
        savedGlobals: [],
        serverActive: true,
        serverTime: 12.5,
        version: 1
    }
};

class MemorySaveStorage implements QuakeSaveStorage {
    readonly values = new Map<string, string>();

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.values.set(key, value);
    }
}

describe('Quake savegame slots', () => {
    it('reproduces the source 39-character level and kill comment', () => {
        const comment = quakeSaveComment('the Slipgate Complex', 7, 14);

        expect(comment).toHaveLength(39);
        expect(comment.slice(0, 20)).toBe('the Slipgate Complex');
        expect(comment.slice(20, 22)).toBe('  ');
        expect(comment.slice(22, 35)).toBe('kills:  7/ 14');
        expect(comment.slice(35)).toBe('    ');
    });

    it('uses the original s0 through s11 menu slot names', () => {
        expect(QUAKE_SAVE_SLOT_COUNT).toBe(12);
        expect(quakeSaveSlotNumber('s0')).toBe(0);
        expect(quakeSaveSlotNumber('S11')).toBe(11);
        expect(quakeSaveSlotNumber('s12')).toBeUndefined();
        expect(quakeSaveSlotNumber('../s0')).toBeUndefined();
        expect(quakeSaveSlotKey(11)).toBe('quake-playcanvas-save-s11');
        expect(() => quakeSaveSlotKey(12)).toThrow('Invalid Quake save slot 12');
    });

    it('normalizes safe source-style named saves for the quick slot', () => {
        expect(quakeSaveName('quick')).toBe('quick');
        expect(quakeSaveName('QUICK.SAV')).toBe('quick');
        expect(quakeSaveName('../quick')).toBeUndefined();
        expect(quakeSaveName('')).toBeUndefined();
        expect(quakeSaveKey('quick.sav')).toBe('quake-playcanvas-save-quick');
    });

    it('writes, scans, and rejects corrupt browser-backed slots', () => {
        const storage = new MemorySaveStorage();
        const save = quakeCreateSaveSlot(
            testState,
            quakeSaveComment('the Slipgate Complex', 0, 10)
        );

        quakeWriteSaveSlot(storage, 4, save);
        storage.setItem(quakeSaveSlotKey(5), '{bad json');
        const slots = quakeReadSaveSlots(storage);

        expect(slots).toHaveLength(12);
        expect(slots[4]).toEqual(save);
        expect(slots[5]).toBeUndefined();
        expect(quakeParseSaveSlot(JSON.stringify({ ...save, version: 2 }))).toBeUndefined();
    });

    it('round-trips a named save independently of the menu slots', () => {
        const storage = new MemorySaveStorage();
        const save = quakeCreateSaveSlot(testState, 'quick'.padEnd(39));

        quakeWriteSave(storage, 'quick', save);

        expect(quakeReadSave(storage, 'QUICK.SAV')).toEqual(save);
        expect(quakeReadSaveSlots(storage).every(slot => slot === undefined)).toBe(true);
    });
});
