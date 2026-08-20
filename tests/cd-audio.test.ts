import { describe, expect, it } from 'vitest';

import { quakeMusicPlaybackOffset } from '../src/game/audio-system';
import {
    QuakeCdAudioController,
    type QuakeCdTransport
} from '../src/game/cd-audio';

class FakeCdTransport implements QuakeCdTransport {
    readonly availableTracks = new Set<number>();
    readonly playCalls: Array<{ looping: boolean; track: number }> = [];
    cancelCount = 0;
    musicLooping = false;
    musicPaused = false;
    musicPlaying = false;
    musicTrack = 0;
    musicVolume = 0.5;
    stopCount = 0;

    cancelMusicRequest(): void {
        this.cancelCount++;
    }

    pauseMusic(): boolean {
        if (!this.musicPlaying) return false;
        this.musicPlaying = false;
        this.musicPaused = true;
        return true;
    }

    playMusicTrack(track: number, looping: boolean): Promise<boolean> {
        this.playCalls.push({ looping, track });
        if (!this.availableTracks.has(track)) return Promise.resolve(false);
        this.musicLooping = looping;
        this.musicPaused = false;
        this.musicPlaying = true;
        this.musicTrack = track;
        return Promise.resolve(true);
    }

    resumeMusic(): boolean {
        if (!this.musicPaused) return false;
        this.musicPaused = false;
        this.musicPlaying = true;
        return true;
    }

    stopMusic(): void {
        this.stopCount++;
        this.musicLooping = false;
        this.musicPaused = false;
        this.musicPlaying = false;
        this.musicTrack = 0;
    }
}

const controllerHarness = (): {
    controller: QuakeCdAudioController;
    output: string[];
    transport: FakeCdTransport;
} => {
    const output: string[] = [];
    const transport = new FakeCdTransport();
    return {
        controller: new QuakeCdAudioController(transport, text => output.push(text)),
        output,
        transport
    };
};

describe('WinQuake CD command state', () => {
    it('applies the source track remap table and resets it to identity', async () => {
        const { controller, output, transport } = controllerHarness();
        transport.availableTracks.add(2);

        await controller.execute(['remap', '2', '0x07', '\x27A']);
        await controller.execute(['remap']);
        expect(output).toEqual([
            '  1 -> 2\n',
            '  2 -> 7\n',
            '  3 -> 65\n'
        ]);
        expect(await controller.playTrack(1, true)).toBe(true);
        expect(transport.playCalls).toEqual([{ looping: true, track: 2 }]);

        await controller.execute(['reset']);
        expect(controller.enabled).toBe(true);
        expect(controller.remap[1]).toBe(1);
        expect(controller.remap[2]).toBe(2);
    });

    it('supports play, loop, pause, resume, stop, on, and off', async () => {
        const { controller, output, transport } = controllerHarness();
        transport.availableTracks.add(6);
        transport.availableTracks.add(7);

        await controller.execute(['play', '6']);
        await controller.execute(['info']);
        expect(output).toEqual([
            '1 tracks\n',
            'Currently playing track 6\n',
            'Volume is 0.500000\n'
        ]);

        await controller.execute(['pause']);
        output.length = 0;
        await controller.execute(['info']);
        expect(output[1]).toBe('Paused playing track 6\n');
        await controller.execute(['stop']);
        expect(transport.musicPaused).toBe(true);
        await controller.execute(['resume']);
        expect(transport.musicPlaying).toBe(true);

        await controller.execute(['loop', '7']);
        expect(transport.playCalls.at(-1)).toEqual({ looping: true, track: 7 });
        await controller.execute(['off']);
        expect(controller.enabled).toBe(false);
        expect(transport.musicPlaying).toBe(false);
        const callCount = transport.playCalls.length;
        await controller.execute(['play', '6']);
        expect(transport.playCalls).toHaveLength(callCount);
        await controller.execute(['on']);
        expect(controller.enabled).toBe(true);
    });

    it('models close and eject without inventing missing soundtrack media', async () => {
        const { controller, output, transport } = controllerHarness();
        transport.availableTracks.add(6);

        await controller.execute(['eject']);
        await controller.execute(['play', '6']);
        expect(output).toEqual(['No CD in player.\n']);
        expect(transport.playCalls).toHaveLength(0);

        await controller.execute(['close']);
        await controller.execute(['play', '6']);
        expect(transport.musicPlaying).toBe(true);
        await controller.execute(['stop']);
        expect(transport.stopCount).toBe(1);

        output.length = 0;
        await controller.execute(['play', '12']);
        expect(output).toEqual(['CDAudio: track 12 is not available.\n']);
        expect(transport.musicPlaying).toBe(false);
    });
});

describe('Web Audio CD playback position', () => {
    it('wraps looping tracks and clamps one-shot tracks when resuming', () => {
        expect(quakeMusicPlaybackOffset(5, 7, 10, true)).toBe(2);
        expect(quakeMusicPlaybackOffset(5, 7, 10, false)).toBe(10);
        expect(quakeMusicPlaybackOffset(-2, 3, 10, false)).toBe(3);
        expect(quakeMusicPlaybackOffset(2, 3, 0, true)).toBe(0);
    });
});
