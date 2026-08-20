import { describe, expect, it } from 'vitest';

import {
    parseQuakeLevelTransition,
    quakeMapName,
    quakeMapPath
} from '../src/game/level-transition';

describe('Quake level transitions', () => {
    const transition = {
        cvars: { skill: '2', sv_gravity: '800' },
        mapName: 'e1m2',
        serverFlags: 5,
        spawnParameters: Array.from({ length: 16 }, (_, index) => index + 1)
    };

    it('accepts source map names without permitting arbitrary PAK paths', () => {
        expect(quakeMapName(' E1M2 ')).toBe('e1m2');
        expect(quakeMapPath('start')).toBe('maps/start.bsp');
        expect(quakeMapPath('../id1/pak0')).toBeUndefined();
        expect(quakeMapName('e1m2.bsp')).toBeUndefined();
    });

    it('restores only finite, correctly targeted sixteen-parm transitions', () => {
        expect(parseQuakeLevelTransition(
            JSON.stringify(transition), 'e1m2'
        )).toEqual(transition);
        expect(parseQuakeLevelTransition(
            JSON.stringify(transition), 'e1m3'
        )).toBeUndefined();
        expect(parseQuakeLevelTransition(JSON.stringify({
            ...transition,
            spawnParameters: [1, 2]
        }), 'e1m2')).toBeUndefined();
        expect(parseQuakeLevelTransition(JSON.stringify({
            ...transition,
            cvars: { skill: 2 }
        }), 'e1m2')).toBeUndefined();
        expect(parseQuakeLevelTransition('{', 'e1m2')).toBeUndefined();
    });
});
