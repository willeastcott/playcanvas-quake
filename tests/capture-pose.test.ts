import { describe, expect, it } from 'vitest';

import {
    quakePaletteCaptureModeFromParameters,
    quakeCapturePoseFromParameters,
    quakeCaptureViewSizeFromParameters
} from '../src/game/capture-pose';

describe('deterministic capture poses', () => {
    it('parses an explicit Quake origin and view angles', () => {
        const parameters = new URLSearchParams(
            'capture=pose&captureOrigin=300,1100,16&captureAngles=-45,90,0'
        );

        expect(quakeCapturePoseFromParameters(parameters)).toEqual({
            angles: [-45, 90, 0],
            origin: [300, 1100, 16]
        });
    });

    it('ignores pose fields outside pose capture mode', () => {
        expect(quakeCapturePoseFromParameters(new URLSearchParams(
            'capture=spawn&captureOrigin=bad&captureAngles=bad'
        ))).toBeUndefined();
    });

    it('accepts an explicit intermission camera override for reference matching', () => {
        const parameters = new URLSearchParams(
            'capture=intermission&captureOrigin=240,2664,104&captureAngles=20,120,0'
        );

        expect(quakeCapturePoseFromParameters(parameters)).toEqual({
            angles: [20, 120, 0],
            origin: [240, 2664, 104]
        });
        expect(quakeCapturePoseFromParameters(new URLSearchParams(
            'capture=intermission'
        ))).toBeUndefined();
    });

    it('requires an explicit pose for deterministic shot capture', () => {
        expect(quakeCapturePoseFromParameters(new URLSearchParams(
            'capture=shot&captureOrigin=480,-352,88&captureAngles=0,60,0'
        ))).toEqual({
            angles: [0, 60, 0],
            origin: [480, -352, 88]
        });
        expect(() => quakeCapturePoseFromParameters(new URLSearchParams(
            'capture=shot'
        ))).toThrow();
    });

    it('requires an explicit pose for deterministic lightning capture', () => {
        expect(quakeCapturePoseFromParameters(new URLSearchParams(
            'capture=lightning&captureOrigin=480,-352,88&captureAngles=0,60,0'
        ))).toEqual({
            angles: [0, 60, 0],
            origin: [480, -352, 88]
        });
        expect(() => quakeCapturePoseFromParameters(new URLSearchParams(
            'capture=lightning'
        ))).toThrow();
    });

    it.each([
        'rocket-flight',
        'rocket-impact',
        'grenade-flight',
        'grenade-bounce',
        'grenade-explosion',
        'ogre-grenade-flight',
        'ogre-grenade-impact',
        'knight-melee',
        'shambler-lightning',
        'wizard-tracer',
        'nailgun-flight',
        'button-door',
        'axe-hit',
        'shoot-trigger-door',
        'start-stairs',
        'player-death',
        'silver-key-door',
        'dog-death',
        'explobox',
        'patrol',
        'platform-ride',
        'secret-door-shot',
        'trigger-secret-door',
        'touch-trigger-door',
        'light-door',
        'tutorial-message',
        'soldier-death',
        'soldier-gib-impact',
        'soldier-gib-trail'
    ] as const)(
        'requires an explicit pose for deterministic %s capture',
        (captureMode) => {
            expect(quakeCapturePoseFromParameters(new URLSearchParams(
                `capture=${captureMode}&captureOrigin=480,-352,88&captureAngles=0,60,0`
            ))).toEqual({
                angles: [0, 60, 0],
                origin: [480, -352, 88]
            });
            expect(() => quakeCapturePoseFromParameters(new URLSearchParams(
                `capture=${captureMode}`
            ))).toThrow();
        }
    );

    it.each(['bonus', 'damage', 'invulnerability', 'quad', 'suit'] as const)(
        'requires an explicit pose for deterministic %s palette capture',
        (captureMode) => {
            const parameters = new URLSearchParams(
                `capture=${captureMode}&captureOrigin=592,90,80&captureAngles=0,0,0`
            );
            expect(quakePaletteCaptureModeFromParameters(parameters)).toBe(captureMode);
            expect(quakeCapturePoseFromParameters(parameters)).toEqual({
                angles: [0, 0, 0],
                origin: [592, 90, 80]
            });
            expect(() => quakeCapturePoseFromParameters(new URLSearchParams(
                `capture=${captureMode}`
            ))).toThrow();
        }
    );

    it.each([
        'capture=pose&captureAngles=0,90,0',
        'capture=pose&captureOrigin=0,0,0',
        'capture=pose&captureOrigin=0,0&captureAngles=0,90,0',
        'capture=pose&captureOrigin=0,0,0&captureAngles=0,NaN,0'
    ])('rejects an incomplete or non-finite pose: %s', (query) => {
        expect(() => quakeCapturePoseFromParameters(new URLSearchParams(query))).toThrow();
    });
});

describe('deterministic capture view size', () => {
    it('uses a finite capture-only view size within the source range', () => {
        expect(quakeCaptureViewSizeFromParameters(new URLSearchParams(
            'capture=pose&captureViewSize=70'
        ))).toBe(70);
        expect(quakeCaptureViewSizeFromParameters(new URLSearchParams(
            'capture=pose&captureViewSize=0'
        ))).toBe(30);
        expect(quakeCaptureViewSizeFromParameters(new URLSearchParams(
            'capture=pose&captureViewSize=999'
        ))).toBe(120);
    });

    it('ignores the parameter outside capture mode and rejects non-finite input', () => {
        expect(quakeCaptureViewSizeFromParameters(new URLSearchParams(
            'captureViewSize=70'
        ))).toBeUndefined();
        expect(() => quakeCaptureViewSizeFromParameters(new URLSearchParams(
            'capture=pose&captureViewSize=nope'
        ))).toThrow('Invalid captureViewSize');
    });
});
