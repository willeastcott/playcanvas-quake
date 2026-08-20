import { quakeStringToFloat } from './quake-builtins';

const QUAKE_CD_TRACK_COUNT = 256;

export interface QuakeCdTransport {
    readonly musicLooping: boolean;
    readonly musicPaused: boolean;
    readonly musicPlaying: boolean;
    readonly musicTrack: number;
    readonly musicVolume: number;
    cancelMusicRequest: () => void;
    pauseMusic: () => boolean;
    playMusicTrack: (track: number, looping: boolean) => Promise<boolean>;
    resumeMusic: () => boolean;
    stopMusic: () => void;
}

export type QuakeCdPrint = (text: string) => void;

const quakeCdArgumentInteger = (value = ''): number => (
    Math.trunc(quakeStringToFloat(value))
);

const quakeCdTrackByte = (value: number): number => (
    Number.isFinite(value) ? Math.trunc(value) & 0xff : 0
);

export class QuakeCdAudioController {
    readonly knownTracks = new Set<number>();
    readonly remap = new Uint8Array(QUAKE_CD_TRACK_COUNT);
    enabled = true;
    trayOpen = false;
    private commandGeneration = 0;
    private readonly print: QuakeCdPrint;
    private readonly transport: QuakeCdTransport;

    constructor(transport: QuakeCdTransport, print: QuakeCdPrint) {
        this.transport = transport;
        this.print = print;
        this.resetRemap();
    }

    async playTrack(
        track: number,
        looping: boolean,
        reportMissing = false
    ): Promise<boolean> {
        if (!this.enabled || this.trayOpen) return false;
        const mappedTrack = this.remap[quakeCdTrackByte(track)];
        const generation = ++this.commandGeneration;
        const played = await this.transport.playMusicTrack(mappedTrack, looping);
        if (generation !== this.commandGeneration || !this.enabled || this.trayOpen) {
            return false;
        }
        if (played) {
            this.knownTracks.add(mappedTrack);
        } else if (reportMissing) {
            this.print(`CDAudio: track ${mappedTrack} is not available.\n`);
        }
        return played;
    }

    async execute(arguments_: readonly string[]): Promise<void> {
        const command = arguments_[0]?.toLowerCase();
        if (!command) return;
        if (command === 'on') {
            this.enabled = true;
            return;
        }
        if (command === 'off') {
            this.cancelPendingRequest();
            if (this.transport.musicPlaying) this.transport.stopMusic();
            this.enabled = false;
            return;
        }
        if (command === 'reset') {
            this.cancelPendingRequest();
            this.enabled = true;
            this.trayOpen = false;
            if (this.transport.musicPlaying) this.transport.stopMusic();
            this.resetRemap();
            return;
        }
        if (command === 'remap') {
            if (arguments_.length === 1) {
                for (let track = 1; track < this.remap.length; track++) {
                    if (this.remap[track] !== track) {
                        this.print(`  ${track} -> ${this.remap[track]}\n`);
                    }
                }
                return;
            }
            const count = Math.min(arguments_.length - 1, this.remap.length - 1);
            for (let track = 1; track <= count; track++) {
                this.remap[track] = quakeCdTrackByte(
                    quakeCdArgumentInteger(arguments_[track])
                );
            }
            return;
        }
        if (command === 'close') {
            this.trayOpen = false;
            return;
        }
        if (this.trayOpen) {
            this.print('No CD in player.\n');
            return;
        }
        if (command === 'play' || command === 'loop') {
            await this.playTrack(
                quakeCdArgumentInteger(arguments_[1]),
                command === 'loop',
                true
            );
            return;
        }
        if (command === 'stop') {
            this.cancelPendingRequest();
            if (this.transport.musicPlaying) this.transport.stopMusic();
            return;
        }
        if (command === 'pause') {
            this.transport.pauseMusic();
            return;
        }
        if (command === 'resume') {
            if (this.enabled) this.transport.resumeMusic();
            return;
        }
        if (command === 'eject') {
            this.cancelPendingRequest();
            if (this.transport.musicPlaying) this.transport.stopMusic();
            this.trayOpen = true;
            return;
        }
        if (command === 'info') this.printInfo();
    }

    private cancelPendingRequest(): void {
        this.commandGeneration++;
        this.transport.cancelMusicRequest();
    }

    private printInfo(): void {
        this.print(`${this.knownTracks.size} tracks\n`);
        if (this.transport.musicPlaying) {
            this.print(
                `Currently ${this.transport.musicLooping ? 'looping' : 'playing'} ` +
                `track ${this.transport.musicTrack}\n`
            );
        } else if (this.transport.musicPaused) {
            this.print(
                `Paused ${this.transport.musicLooping ? 'looping' : 'playing'} ` +
                `track ${this.transport.musicTrack}\n`
            );
        }
        this.print(`Volume is ${this.transport.musicVolume.toFixed(6)}\n`);
    }

    private resetRemap(): void {
        for (let track = 0; track < this.remap.length; track++) {
            this.remap[track] = track;
        }
    }
}
