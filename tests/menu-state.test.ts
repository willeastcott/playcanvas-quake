import { describe, expect, it } from 'vitest';

import {
    quakeMenuCaptureScreen,
    quakeMenuCaptureUsesEmptySaveSlots,
    QuakeMenuCursorState
} from '../src/game/menu-state';

describe('deterministic menu captures', () => {
    it('maps every supported capture mode to its source menu', () => {
        expect([
            'menu',
            'menu-help',
            'menu-keys',
            'menu-load',
            'menu-save',
            'menu-singleplayer',
            'menu-multiplayer',
            'menu-options',
            'menu-setup',
            'menu-quit'
        ].map(quakeMenuCaptureScreen)).toEqual([
            'main',
            'help',
            'keys',
            'load',
            'save',
            'singleplayer',
            'multiplayer',
            'options',
            'setup',
            'quit'
        ]);
        expect(quakeMenuCaptureScreen('spawn')).toBeUndefined();
        expect(quakeMenuCaptureScreen(null)).toBeUndefined();
    });

    it('isolates only Load and Save capture slots from browser storage', () => {
        expect(quakeMenuCaptureUsesEmptySaveSlots('load')).toBe(true);
        expect(quakeMenuCaptureUsesEmptySaveSlots('save')).toBe(true);
        expect(quakeMenuCaptureUsesEmptySaveSlots('singleplayer')).toBe(false);
        expect(quakeMenuCaptureUsesEmptySaveSlots(undefined)).toBe(false);
    });
});

describe('WinQuake menu cursor state', () => {
    it('starts Setup at its source row and the other supported menus at zero', () => {
        const state = new QuakeMenuCursorState();

        expect(state.cursor('main')).toBe(0);
        expect(state.cursor('options')).toBe(0);
        expect(state.cursor('keys')).toBe(0);
        expect(state.cursor('setup')).toBe(4);
    });

    it('retains independent cursor variables across menu transitions', () => {
        const state = new QuakeMenuCursorState();

        expect(state.transition('main', 2, 'options')).toBe(0);
        expect(state.transition('options', 9, 'main')).toBe(2);
        expect(state.transition('main', 3, 'help')).toBe(0);
        expect(state.transition('help', 0, 'main')).toBe(3);
        expect(state.transition('main', 1, 'multiplayer')).toBe(0);
        expect(state.transition('multiplayer', 2, 'setup')).toBe(4);
        expect(state.transition('setup', 1, 'multiplayer')).toBe(2);
    });

    it('shares WinQuake load_cursor between Load and Save', () => {
        const state = new QuakeMenuCursorState();

        expect(state.transition('load', 7, 'save')).toBe(7);
        expect(state.transition('save', 11, 'load')).toBe(11);
    });

    it('does not replace stored cursors with modal-screen placeholder values', () => {
        const state = new QuakeMenuCursorState();

        state.remember('singleplayer', 2);
        expect(state.transition('newgame', 0, 'singleplayer')).toBe(2);
        state.remember('main', 4);
        expect(state.transition('quit', 0, 'main')).toBe(4);
    });
});
