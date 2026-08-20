import type {
    QuakeAmbientSound,
    QuakeSoundCommand,
    QuakeSoundEvent,
    QuakeStoppedSoundEvent
} from './quake-builtins';
import type { QuakeWorldRuntime } from './quake-world';
import type { BspMap, Vec3 } from '../formats/bsp';
import type { PakArchive } from '../formats/pak';
import { decodeQuakeWavPcm } from '../formats/wav';

const MASTER_VOLUME = 0.7;
const MAX_CHANNELS = 128;
const MAX_DYNAMIC_CHANNELS = 8;
const QUAKE_NUM_AMBIENT_CHANNELS = 4;
export const QUAKE_MAX_STATIC_CHANNELS =
    MAX_CHANNELS - MAX_DYNAMIC_CHANNELS - QUAKE_NUM_AMBIENT_CHANNELS;
const QUAKE_MUSIC_EXTENSIONS = ['ogg', 'mp3', 'flac', 'wav'] as const;

interface AmbientChannel {
    gain: GainNode;
    offset: number;
    sound: DecodedSound;
    source: AudioBufferSourceNode | undefined;
    startedAt: number;
    volume: number;
}

interface StaticChannel {
    events: QuakeAmbientSound[];
    offset: number;
    output: SpatialOutput;
    sound: DecodedSound;
    source: AudioBufferSourceNode | undefined;
    startedAt: number;
}

interface SpatialOutput {
    leftGain: GainNode;
    merger: ChannelMergerNode;
    rightGain: GainNode;
}

interface ActiveSound {
    endsAt: number;
    event: QuakeSoundEvent;
    loopEnd?: number;
    loopStart?: number;
    output: SpatialOutput;
    sample: string;
    source: AudioBufferSourceNode;
    startOffsetSamples: number;
    startedFrame: number;
}

interface DecodedSound {
    buffer: AudioBuffer;
    loopEnd?: number;
    loopStart?: number;
}

export interface QuakeMusicAsset<T> {
    decoded: T;
    path: string;
}

export interface QuakeMusicResponse {
    arrayBuffer: () => Promise<ArrayBuffer>;
    ok: boolean;
}

export interface QuakeSoundChannelGains {
    left: number;
    right: number;
}

export interface QuakeAmbientChannelState {
    active: boolean;
    volume: number;
}

interface QuakeSuspendableAudioContext {
    readonly state: AudioContextState;
    resume: () => Promise<void>;
    suspend: () => Promise<void>;
}

export class QuakeAudioFocusController {
    private active = true;
    private resumeOnActivation = false;
    private transition = Promise.resolve();

    constructor(private readonly context: QuakeSuspendableAudioContext) {}

    setActive(active: boolean): Promise<void> {
        this.active = active;
        if (!active && this.context.state === 'running') {
            this.resumeOnActivation = true;
        }
        return this.enqueue(async () => {
            if (!active) {
                if (this.context.state === 'running') {
                    this.resumeOnActivation = true;
                    await this.context.suspend();
                }
            } else if (this.resumeOnActivation && this.context.state !== 'running') {
                await this.context.resume();
            }
        });
    }

    resumeFromGesture(): Promise<void> {
        return this.enqueue(async () => {
            if (!this.active) return;
            if (this.context.state !== 'running') await this.context.resume();
            if (this.context.state === 'running') this.resumeOnActivation = true;
        });
    }

    private enqueue(operation: () => Promise<void>): Promise<void> {
        const next = this.transition.then(operation);
        this.transition = next.catch(() => {});
        return next;
    }
}

export interface QuakeStaticSoundGroup {
    events: QuakeAmbientSound[];
    path: string;
}

export interface QuakeStoppedAmbientChannelState {
    offset: number;
    volume: number;
}

export interface QuakeDynamicChannelState {
    channel: number;
    endsAt: number;
    entity: number;
}

export const runQuakeSoundCommandsInOrder = (
    commands: readonly QuakeSoundCommand[],
    start: (event: QuakeSoundEvent) => Promise<void>,
    stop: (event: QuakeStoppedSoundEvent) => void,
    onError: (command: QuakeSoundCommand, error: unknown) => void
): Promise<void> => {
    return commands.reduce<Promise<void>>((chain, command) => chain.then(() => {
        try {
            if (command.kind === 'start') {
                return start(command.event).catch(error => onError(command, error));
            }
            stop(command.event);
        } catch (error) {
            onError(command, error);
        }
    }), Promise.resolve());
};

export const quakeCdTrackNumber = (worldSounds: number): number => {
    return Number.isFinite(worldSounds) ? Math.trunc(worldSounds) & 0xff : 0;
};

export const quakeMusicTrackPaths = (
    track: number,
    basePath = import.meta.env.BASE_URL
): string[] => {
    const trackNumber = quakeCdTrackNumber(track);
    if (trackNumber === 0) return [];
    const filename = `track${String(trackNumber).padStart(2, '0')}`;
    const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
    return QUAKE_MUSIC_EXTENSIONS.map(
        extension => `${normalizedBasePath}game-data/id1/music/${filename}.${extension}`
    );
};

export const quakeMusicGain = (volume: number): number => {
    const finiteVolume = Number.isFinite(volume) ? volume : 0;
    const clampedVolume = Math.max(0, Math.min(1, finiteVolume));
    return Math.trunc(clampedVolume * 255) / 255;
};

export const quakeMusicPlaybackOffset = (
    offset: number,
    elapsed: number,
    duration: number,
    looping: boolean
): number => {
    const finiteDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
    if (finiteDuration === 0) return 0;
    const position = Math.max(0, Number.isFinite(offset) ? offset : 0) +
        Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
    return looping ? position % finiteDuration : Math.min(position, finiteDuration);
};

export const quakeLocalSoundEvent = (
    sample: string,
    viewEntity: number
): QuakeSoundEvent => ({
    attenuation: 1,
    channel: -1,
    entity: viewEntity,
    origin: [0, 0, 0],
    sample,
    volume: 1
});

export const loadQuakeMusicTrack = <T>(
    track: number,
    request: (path: string) => Promise<QuakeMusicResponse>,
    decode: (data: ArrayBuffer) => Promise<T>
): Promise<QuakeMusicAsset<T> | undefined> => {
    const paths = quakeMusicTrackPaths(track);
    const loadCandidate = async (index: number): Promise<QuakeMusicAsset<T> | undefined> => {
        const path = paths[index];
        if (!path) return undefined;
        try {
            const response = await request(path);
            if (!response.ok) return loadCandidate(index + 1);
            return { decoded: await decode(await response.arrayBuffer()), path };
        } catch {
            // A missing or undecodable candidate is not replaced with other media.
            return loadCandidate(index + 1);
        }
    };
    return loadCandidate(0);
};

export const quakeAmbientChannelState = (
    currentVolume: number,
    leafLevel: number | undefined,
    frameTime: number,
    ambientLevel: number,
    ambientFade: number
): QuakeAmbientChannelState => {
    const storedVolume = Math.trunc(currentVolume);
    if (leafLevel === undefined || ambientLevel === 0) {
        return { active: false, volume: storedVolume };
    }
    const rawTarget = ambientLevel * leafLevel;
    const target = rawTarget < 8 ? 0 : rawTarget;
    const adjustment = frameTime * ambientFade;
    if (storedVolume < target) {
        const adjusted = Math.trunc(storedVolume + adjustment);
        return {
            active: true,
            volume: adjusted > target ? Math.trunc(target) : adjusted
        };
    }
    if (storedVolume > target) {
        const adjusted = Math.trunc(storedVolume - adjustment);
        return {
            active: true,
            volume: adjusted < target ? Math.trunc(target) : adjusted
        };
    }
    return { active: true, volume: storedVolume };
};

export const quakeStoppedAmbientChannelState = (): QuakeStoppedAmbientChannelState => ({
    offset: 0,
    volume: 0
});

export const quakeAmbientChannelVolume = (
    currentVolume: number,
    leafLevel: number,
    frameTime: number,
    ambientLevel: number,
    ambientFade: number
): number => quakeAmbientChannelState(
    currentVolume, leafLevel, frameTime, ambientLevel, ambientFade
).volume;

export const quakeLoopingSoundPlaybackOffset = (
    offset: number,
    elapsed: number,
    loopStart: number,
    loopEnd: number
): number => {
    const end = Number.isFinite(loopEnd) ? Math.max(0, loopEnd) : 0;
    if (end === 0) return 0;
    const start = Math.max(0, Math.min(
        end,
        Number.isFinite(loopStart) ? loopStart : 0
    ));
    const position = Math.max(0, Number.isFinite(offset) ? offset : 0) +
        Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
    if (position < end) return position;
    const loopLength = end - start;
    return loopLength > 0 ? start + (position - start) % loopLength : start;
};

export const quakeLoopingSoundChannelEnd = (
    firstEnd: number,
    currentTime: number,
    loopStart?: number,
    loopEnd?: number
): number => {
    if (loopStart === undefined || loopEnd === undefined || loopEnd <= loopStart ||
        currentTime < firstEnd) {
        return firstEnd;
    }
    const loopDuration = loopEnd - loopStart;
    const completedLoops = Math.floor((currentTime - firstEnd) / loopDuration) + 1;
    return firstEnd + completedLoops * loopDuration;
};

export const quakeDuplicateSoundOffsetSamples = (
    duplicateStartedAtZero: boolean,
    outputSampleRate: number,
    outputSampleLength: number,
    paintedTimeSamples: number,
    randomInteger: number
): number => {
    const skipRange = Math.trunc(outputSampleRate * 0.1);
    const sampleLength = Math.trunc(outputSampleLength);
    if (!duplicateStartedAtZero || skipRange <= 0 || sampleLength <= 0) {
        return 0;
    }
    let skip = Math.trunc(randomInteger) % skipRange;
    if (skip < 0) skip += skipRange;
    const channelEnd = Math.trunc(paintedTimeSamples) + sampleLength;
    if (skip >= channelEnd) skip = channelEnd - 1;
    return skip;
};

export const quakeDuplicateSoundPlaybackOffset = (
    skipSamples: number,
    outputSampleRate: number,
    outputSampleLength: number,
    loopStart?: number
): number => {
    if (outputSampleRate <= 0) return 0;
    if (loopStart !== undefined && skipSamples >= outputSampleLength) {
        return loopStart;
    }
    return skipSamples / outputSampleRate;
};

export const quakePickDynamicChannel = (
    channels: ReadonlyArray<QuakeDynamicChannelState | undefined>,
    entity: number,
    entityChannel: number,
    viewEntity: number,
    time: number
): number | undefined => {
    let selected = -1;
    let shortestLife = Number.POSITIVE_INFINITY;
    for (let index = 0; index < MAX_DYNAMIC_CHANNELS; index++) {
        const channel = channels[index];
        if (entityChannel !== 0 && channel?.entity === entity &&
            (channel.channel === entityChannel || entityChannel === -1)) {
            return index;
        }
        if (channel?.entity === viewEntity && entity !== viewEntity) {
            continue;
        }
        const life = (channel?.endsAt ?? 0) - time;
        if (selected === -1 || life < shortestLife) {
            shortestLife = life;
            selected = index;
        }
    }
    return selected === -1 ? undefined : selected;
};

export const quakeStoppedSoundSlot = (
    channels: readonly (QuakeDynamicChannelState | undefined)[],
    entity: number,
    channel: number
): number | undefined => {
    // WinQuake scans raw channels 0..7 even though dynamic channels begin after four
    // ambient slots, so only logical dynamic slots 0..3 are reachable here.
    const reachableDynamicSlots = MAX_DYNAMIC_CHANNELS - QUAKE_NUM_AMBIENT_CHANNELS;
    for (let slot = 0; slot < reachableDynamicSlots; slot++) {
        const active = channels[slot];
        if (active?.entity === entity && active.channel === channel) return slot;
    }
    return undefined;
};

export const quakeSoundChannelGains = (
    sourceOrigin: Vec3,
    volume: number,
    attenuation: number,
    listenerOrigin: Vec3,
    listenerYaw: number,
    attachedToListener = false
): QuakeSoundChannelGains => {
    const masterVolume = Math.trunc(volume * 255);
    if (attachedToListener) {
        const centered = Math.max(0, Math.min(255, masterVolume)) / 255;
        return { left: centered, right: centered };
    }
    const offset = sourceOrigin.map(
        (component, axis) => component - listenerOrigin[axis]
    ) as Vec3;
    const distance = Math.hypot(...offset);
    const yaw = listenerYaw * Math.PI / 180;
    const dot = distance === 0 ? 0 : (
        offset[0] * Math.sin(yaw) - offset[1] * Math.cos(yaw)
    ) / distance;
    const packetAttenuation = Math.trunc(attenuation * 64);
    const distanceMultiplier = (packetAttenuation / 64) / 1_000;
    const distanceScale = 1 - distance * distanceMultiplier;
    const channel = (stereoScale: number): number => Math.max(
        0, Math.trunc(masterVolume * distanceScale * stereoScale)
    ) / 255;
    return {
        left: channel(1 - dot),
        right: channel(1 + dot)
    };
};

export const quakeCombinedStaticSoundGains = (
    events: readonly QuakeAmbientSound[],
    listenerOrigin: Vec3,
    listenerYaw: number
): QuakeSoundChannelGains => events.reduce<QuakeSoundChannelGains>((combined, event) => {
    const gains = quakeSoundChannelGains(
        event.origin,
        event.volume,
        event.attenuation,
        listenerOrigin,
        listenerYaw
    );
    return {
        left: combined.left + gains.left,
        right: combined.right + gains.right
    };
}, { left: 0, right: 0 });

export const quakeStaticSoundGroups = (
    events: readonly QuakeAmbientSound[]
): QuakeStaticSoundGroup[] => {
    const groups = new Map<string, QuakeStaticSoundGroup>();
    for (const event of events.slice(0, QUAKE_MAX_STATIC_CHANNELS)) {
        const path = `sound/${event.sample.toLowerCase()}`;
        const existing = groups.get(path);
        if (existing) existing.events.push(event);
        else groups.set(path, { events: [event], path });
    }
    return [...groups.values()];
};

export class QuakeAudioSystem {
    readonly context: AudioContext;
    readonly focus: QuakeAudioFocusController;
    readonly masterGain: GainNode;
    readonly musicGain: GainNode;
    readonly pak: PakArchive;
    map: BspMap;
    quakeWorld: QuakeWorldRuntime;
    readonly channels: AmbientChannel[] = [];
    readonly staticChannels: StaticChannel[] = [];
    readonly buffers = new Map<string, Promise<DecodedSound>>();
    readonly activeSounds = new Map<number, ActiveSound>();
    ambientFade = 100;
    ambientLevel = 0.3;
    musicPath?: string;
    musicLooping = true;
    musicPaused = false;
    musicTrack = 0;
    musicVolume = 1;
    private audioRandomState = 0x2468ace1;
    private musicBuffer?: AudioBuffer;
    private musicOffset = 0;
    private musicRequestGeneration = 0;
    private musicSource?: AudioBufferSourceNode;
    private musicStartedAt = 0;
    private soundFrame = 0;
    private soundStartGeneration = 0;
    private soundStartChain = Promise.resolve();

    constructor(
        pak: PakArchive,
        map: BspMap,
        quakeWorld: QuakeWorldRuntime,
        canvas: HTMLCanvasElement
    ) {
        this.pak = pak;
        this.map = map;
        this.quakeWorld = quakeWorld;
        this.context = new AudioContext({ latencyHint: 'interactive' });
        this.focus = new QuakeAudioFocusController(this.context);
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = MASTER_VOLUME;
        this.masterGain.connect(this.context.destination);
        this.musicGain = this.context.createGain();
        this.musicGain.gain.value = quakeMusicGain(this.musicVolume);
        this.musicGain.connect(this.context.destination);
        canvas.addEventListener('click', () => {
            this.focus.resumeFromGesture().catch(
                error => console.error('Could not resume Quake audio', error)
            );
        });
    }

    get musicPlaying(): boolean {
        return this.musicSource !== undefined;
    }

    async initialize(): Promise<void> {
        const buffers = await Promise.all([
            this.decode('sound/ambience/water1.wav'),
            this.decode('sound/ambience/wind2.wav')
        ]);
        for (const sound of buffers) {
            const gain = this.context.createGain();
            gain.gain.value = 0;
            gain.connect(this.masterGain);
            const channel: AmbientChannel = {
                gain,
                offset: 0,
                sound,
                source: undefined,
                startedAt: this.context.currentTime,
                volume: 0
            };
            this.resumeAmbientChannel(channel);
            this.channels.push(channel);
        }
        await Promise.all(quakeStaticSoundGroups(this.quakeWorld.ambientSounds).map(
            group => this.startStaticSoundGroup(group)
        ));
    }

    async replaceLevel(map: BspMap, quakeWorld: QuakeWorldRuntime): Promise<void> {
        this.stopAllSounds();
        this.map = map;
        this.quakeWorld = quakeWorld;
        await Promise.all(quakeStaticSoundGroups(quakeWorld.ambientSounds).map(
            group => this.startStaticSoundGroup(group)
        ));
    }

    async playMusicTrack(
        track: number,
        looping = true,
        request: (path: string) => Promise<QuakeMusicResponse> = fetch
    ): Promise<boolean> {
        const trackNumber = quakeCdTrackNumber(track);
        if (this.musicSource && this.musicTrack === trackNumber) return true;
        if (trackNumber === 0) return false;
        const requestGeneration = ++this.musicRequestGeneration;
        const music = await loadQuakeMusicTrack(
            trackNumber,
            request,
            data => this.context.decodeAudioData(data)
        );
        if (!music || requestGeneration !== this.musicRequestGeneration) return false;
        this.releaseMusicSource();
        this.musicBuffer = music.decoded;
        this.musicLooping = looping;
        this.musicOffset = 0;
        this.musicPaused = false;
        this.musicPath = music.path;
        this.musicTrack = trackNumber;
        return this.startMusicSource();
    }

    setMusicVolume(volume: number): void {
        this.musicVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0));
        this.musicGain.gain.value = quakeMusicGain(this.musicVolume);
    }

    cancelMusicRequest(): void {
        this.musicRequestGeneration++;
    }

    pauseMusic(): boolean {
        if (!this.musicSource || !this.musicBuffer) return false;
        this.musicOffset = quakeMusicPlaybackOffset(
            this.musicOffset,
            this.context.currentTime - this.musicStartedAt,
            this.musicBuffer.duration,
            this.musicLooping
        );
        this.musicPaused = true;
        this.releaseMusicSource();
        return true;
    }

    resumeMusic(): boolean {
        if (!this.musicPaused || !this.musicBuffer || this.musicTrack === 0) return false;
        this.musicPaused = false;
        return this.startMusicSource();
    }

    stopMusic(): void {
        this.cancelMusicRequest();
        this.releaseMusicSource();
        this.musicBuffer = undefined;
        this.musicLooping = true;
        this.musicOffset = 0;
        this.musicPaused = false;
        this.musicPath = undefined;
        this.musicTrack = 0;
    }

    stopAllSounds(retainAmbientChannels = true): void {
        this.soundStartGeneration++;
        this.soundStartChain = Promise.resolve();
        for (const channel of this.channels) {
            const stoppedState = quakeStoppedAmbientChannelState();
            channel.gain.gain.value = 0;
            channel.source?.stop();
            channel.source = undefined;
            channel.offset = stoppedState.offset;
            channel.startedAt = this.context.currentTime;
            channel.volume = stoppedState.volume;
        }
        if (!retainAmbientChannels) this.channels.length = 0;
        for (const channel of this.staticChannels) channel.source?.stop();
        this.staticChannels.length = 0;
        for (const channel of this.activeSounds.values()) channel.source.stop();
        this.activeSounds.clear();
        this.quakeWorld.drainSoundCommands();
    }

    private releaseMusicSource(): void {
        const source = this.musicSource;
        if (!source) return;
        this.musicSource = undefined;
        source.onended = null;
        source.stop();
    }

    private startMusicSource(): boolean {
        const buffer = this.musicBuffer;
        if (!buffer) return false;
        const offset = quakeMusicPlaybackOffset(
            this.musicOffset,
            0,
            buffer.duration,
            this.musicLooping
        );
        if (!this.musicLooping && offset >= buffer.duration) {
            this.musicPaused = false;
            return false;
        }
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = this.musicLooping;
        source.connect(this.musicGain);
        source.onended = () => {
            if (this.musicSource !== source) return;
            this.musicSource = undefined;
            this.musicOffset = 0;
            this.musicPaused = false;
        };
        this.musicOffset = offset;
        this.musicSource = source;
        this.musicStartedAt = this.context.currentTime;
        source.start(0, offset);
        return true;
    }

    private decode(path: string): Promise<DecodedSound> {
        let buffer = this.buffers.get(path);
        if (!buffer) {
            const bytes = this.pak.get(path);
            const { info, samples } = decodeQuakeWavPcm(bytes);
            const decoded = this.context.createBuffer(1, samples.length, info.sampleRate);
            decoded.getChannelData(0).set(samples);
            buffer = Promise.resolve({
                buffer: decoded,
                loopEnd: info.loopEnd === undefined ? undefined : info.loopEnd / info.sampleRate,
                loopStart: info.loopStart === undefined ? undefined :
                    info.loopStart / info.sampleRate
            });
            this.buffers.set(path, buffer);
        }
        return buffer;
    }

    update(frameTime: number, listenerOrigin: Vec3, listenerYaw = 0): void {
        const leaf = this.map.leafs[this.map.findLeaf(listenerOrigin)];
        for (let index = 0; index < this.channels.length; index++) {
            const channel = this.channels[index];
            const state = quakeAmbientChannelState(
                channel.volume,
                leaf?.ambient[index],
                frameTime,
                this.ambientLevel,
                this.ambientFade
            );
            channel.volume = state.volume;
            channel.gain.gain.value = state.active ? channel.volume / 255 : 0;
            if (state.active) this.resumeAmbientChannel(channel);
            else this.pauseAmbientChannel(channel);
        }
        this.updateStaticSounds(listenerOrigin, listenerYaw);
        this.updateActiveSounds(listenerOrigin, listenerYaw);
        const soundCommands = this.quakeWorld.drainSoundCommands();
        const contextRunning = this.context.state === 'running';
        const soundFrame = contextRunning ? this.soundFrame++ : this.soundFrame;
        const generation = this.soundStartGeneration;
        const playableCommands = contextRunning ? soundCommands :
            soundCommands.filter(command => command.kind === 'stop');
        if (playableCommands.length === 0) return;
        this.soundStartChain = this.soundStartChain.then(() => runQuakeSoundCommandsInOrder(
            playableCommands,
            (event) => {
                if (generation !== this.soundStartGeneration) return Promise.resolve();
                return this.startSound(
                    event, listenerOrigin, listenerYaw, soundFrame, generation
                );
            },
            (event) => {
                if (generation === this.soundStartGeneration) this.stopSound(event);
            },
            (command, error) => console.warn(
                command.kind === 'start' ?
                    `Could not play Quake sound ${command.event.sample}` :
                    'Could not stop Quake sound',
                error
            )
        ));
    }

    playLocal(sample: string): void {
        if (this.context.state !== 'running') {
            return;
        }
        const generation = this.soundStartGeneration;
        const soundFrame = this.soundFrame;
        this.soundStartChain = this.soundStartChain.then(() => this.startSound(
            quakeLocalSoundEvent(sample, this.quakeWorld.playerReference),
            [0, 0, 0],
            0,
            soundFrame,
            generation
        )).catch(error => console.warn(`Could not play Quake UI sound ${sample}`, error));
    }

    private async startSound(
        event: QuakeSoundEvent,
        listenerOrigin: Vec3,
        listenerYaw: number,
        soundFrame: number,
        generation: number
    ): Promise<void> {
        const path = `sound/${event.sample.toLowerCase()}`;
        if (!this.pak.has(path)) {
            return;
        }
        const source = this.context.createBufferSource();
        const output = this.createSpatialOutput();
        const sound = await this.decode(path);
        if (generation !== this.soundStartGeneration) return;
        const slot = quakePickDynamicChannel(
            this.dynamicChannelStates(),
            event.entity,
            event.channel,
            this.quakeWorld.playerReference,
            this.context.currentTime
        );
        if (slot === undefined) return;
        this.activeSounds.get(slot)?.source.stop();
        this.activeSounds.delete(slot);
        const duplicateStartedAtZero = [...this.activeSounds.values()].some(
            active => active.sample === path && active.startedFrame === soundFrame &&
                active.startOffsetSamples === 0
        );
        const outputSampleRate = this.context.sampleRate;
        const outputSampleLength = Math.trunc(sound.buffer.duration * outputSampleRate);
        const paintedTimeSamples = Math.trunc(
            this.context.currentTime * outputSampleRate
        );
        const startOffsetSamples = duplicateStartedAtZero ?
            quakeDuplicateSoundOffsetSamples(
                true,
                outputSampleRate,
                outputSampleLength,
                paintedTimeSamples,
                this.nextAudioRandomInteger()
            ) : 0;
        const startOffset = quakeDuplicateSoundPlaybackOffset(
            startOffsetSamples,
            outputSampleRate,
            outputSampleLength,
            sound.loopStart
        );
        source.buffer = sound.buffer;
        this.configureLoop(source, sound);
        this.spatialize(event.origin, event.volume, event.attenuation,
            listenerOrigin, listenerYaw, output, event.entity === this.quakeWorld.playerReference
        );
        source.connect(output.leftGain);
        source.connect(output.rightGain);
        if (output.leftGain.gain.value === 0 && output.rightGain.gain.value === 0) return;
        const activeSound = {
            endsAt: this.context.currentTime + sound.buffer.duration - startOffset,
            event,
            loopEnd: sound.loopEnd,
            loopStart: sound.loopStart,
            output,
            sample: path,
            source,
            startOffsetSamples,
            startedFrame: soundFrame
        };
        this.activeSounds.set(slot, activeSound);
        source.addEventListener('ended', () => {
            if (this.activeSounds.get(slot) === activeSound) {
                this.activeSounds.delete(slot);
            }
        });
        source.start(0, startOffset);
    }

    private stopSound(event: QuakeStoppedSoundEvent): void {
        if (event.entity === 0 && event.channel === 0) {
            const ambient = this.channels[0];
            if (ambient) {
                ambient.gain.gain.value = 0;
                this.pauseAmbientChannel(ambient);
            }
            return;
        }
        const slot = quakeStoppedSoundSlot(
            this.dynamicChannelStates(), event.entity, event.channel
        );
        if (slot === undefined) return;
        this.activeSounds.get(slot)?.source.stop();
        this.activeSounds.delete(slot);
    }

    private dynamicChannelStates(): Array<QuakeDynamicChannelState | undefined> {
        const states: Array<QuakeDynamicChannelState | undefined> = [];
        for (const [slot, active] of this.activeSounds) {
            states[slot] = {
                channel: active.event.channel,
                endsAt: quakeLoopingSoundChannelEnd(
                    active.endsAt,
                    this.context.currentTime,
                    active.loopStart,
                    active.loopEnd
                ),
                entity: active.event.entity
            };
        }
        return states;
    }

    private async startStaticSoundGroup(group: QuakeStaticSoundGroup): Promise<void> {
        if (!this.pak.has(group.path)) {
            return;
        }
        const output = this.createSpatialOutput();
        output.leftGain.gain.value = 0;
        output.rightGain.gain.value = 0;
        const sound = await this.decode(group.path);
        if (sound.loopStart === undefined) {
            return;
        }
        this.staticChannels.push({
            events: group.events,
            offset: 0,
            output,
            sound,
            source: undefined,
            startedAt: this.context.currentTime
        });
    }

    private updateStaticSounds(listenerOrigin: Vec3, listenerYaw: number): void {
        for (const channel of this.staticChannels) {
            const gains = quakeCombinedStaticSoundGains(
                channel.events, listenerOrigin, listenerYaw
            );
            channel.output.leftGain.gain.value = gains.left;
            channel.output.rightGain.gain.value = gains.right;
            if (gains.left === 0 && gains.right === 0) this.pauseStaticChannel(channel);
            else this.resumeStaticChannel(channel);
        }
    }

    private pauseStaticChannel(channel: StaticChannel): void {
        const source = channel.source;
        if (!source) return;
        const loopStart = channel.sound.loopStart ?? 0;
        const loopEnd = channel.sound.loopEnd ?? channel.sound.buffer.duration;
        channel.offset = quakeLoopingSoundPlaybackOffset(
            channel.offset,
            this.context.currentTime - channel.startedAt,
            loopStart,
            loopEnd
        );
        source.stop();
        channel.source = undefined;
    }

    private resumeStaticChannel(channel: StaticChannel): void {
        if (channel.source) return;
        const source = this.context.createBufferSource();
        source.buffer = channel.sound.buffer;
        this.configureLoop(source, channel.sound);
        source.connect(channel.output.leftGain);
        source.connect(channel.output.rightGain);
        channel.source = source;
        channel.startedAt = this.context.currentTime;
        source.start(0, channel.offset);
    }

    private updateActiveSounds(listenerOrigin: Vec3, listenerYaw: number): void {
        for (const channel of this.activeSounds.values()) {
            this.spatialize(
                channel.event.origin,
                channel.event.volume,
                channel.event.attenuation,
                listenerOrigin,
                listenerYaw,
                channel.output,
                channel.event.entity === this.quakeWorld.playerReference
            );
        }
    }

    private spatialize(
        sourceOrigin: Vec3,
        volume: number,
        attenuation: number,
        listenerOrigin: Vec3,
        listenerYaw: number,
        output: SpatialOutput,
        attachedToListener = false
    ): void {
        const gains = quakeSoundChannelGains(
            sourceOrigin,
            volume,
            attenuation,
            listenerOrigin,
            listenerYaw,
            attachedToListener
        );
        output.leftGain.gain.value = gains.left;
        output.rightGain.gain.value = gains.right;
    }

    private createSpatialOutput(): SpatialOutput {
        const leftGain = this.context.createGain();
        const rightGain = this.context.createGain();
        const merger = this.context.createChannelMerger(2);
        leftGain.connect(merger, 0, 0);
        rightGain.connect(merger, 0, 1);
        merger.connect(this.masterGain);
        return { leftGain, merger, rightGain };
    }

    private pauseAmbientChannel(channel: AmbientChannel): void {
        const source = channel.source;
        if (!source) return;
        const loopStart = channel.sound.loopStart ?? 0;
        const loopEnd = channel.sound.loopEnd ?? channel.sound.buffer.duration;
        channel.offset = quakeLoopingSoundPlaybackOffset(
            channel.offset,
            this.context.currentTime - channel.startedAt,
            loopStart,
            loopEnd
        );
        source.stop();
        channel.source = undefined;
    }

    private resumeAmbientChannel(channel: AmbientChannel): void {
        if (channel.source) return;
        const source = this.context.createBufferSource();
        source.buffer = channel.sound.buffer;
        this.configureLoop(source, channel.sound);
        source.connect(channel.gain);
        channel.source = source;
        channel.startedAt = this.context.currentTime;
        source.start(0, channel.offset);
    }

    private configureLoop(source: AudioBufferSourceNode, sound: DecodedSound): void {
        if (sound.loopStart === undefined || sound.loopEnd === undefined) {
            return;
        }
        source.loop = true;
        source.loopStart = sound.loopStart;
        source.loopEnd = sound.loopEnd;
    }

    private nextAudioRandomInteger(): number {
        this.audioRandomState = (
            Math.imul(this.audioRandomState, 1_103_515_245) + 12_345
        ) & 0x7fffffff;
        return this.audioRandomState & 0x7fff;
    }
}
