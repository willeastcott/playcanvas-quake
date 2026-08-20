import { BinaryReader } from '../formats/binary';
import type { QuakeDemoMessage } from '../formats/dem';

const PROTOCOL_VERSION = 15;
const MAX_CLIENTS = 16;
const MAX_EDICTS = 600;
const MAX_LIGHT_STYLES = 64;
const MAX_MODELS = 256;
const MAX_SOUNDS = 256;
const MAX_STATS = 32;
const MAX_STATIC_ENTITIES = 128;

const U_MOREBITS = 1 << 0;
const U_ORIGIN1 = 1 << 1;
const U_ORIGIN2 = 1 << 2;
const U_ORIGIN3 = 1 << 3;
const U_ANGLE2 = 1 << 4;
const U_NOLERP = 1 << 5;
const U_FRAME = 1 << 6;
const U_ANGLE1 = 1 << 8;
const U_ANGLE3 = 1 << 9;
const U_MODEL = 1 << 10;
const U_COLORMAP = 1 << 11;
const U_SKIN = 1 << 12;
const U_EFFECTS = 1 << 13;
const U_LONGENTITY = 1 << 14;

const SU_VIEWHEIGHT = 1 << 0;
const SU_IDEALPITCH = 1 << 1;
const SU_PUNCH1 = 1 << 2;
const SU_VELOCITY1 = 1 << 5;
const SU_ONGROUND = 1 << 10;
const SU_INWATER = 1 << 11;
const SU_WEAPONFRAME = 1 << 12;
const SU_ARMOR = 1 << 13;
const SU_WEAPON = 1 << 14;

const SND_VOLUME = 1 << 0;
const SND_ATTENUATION = 1 << 1;

const STAT_HEALTH = 0;
const STAT_WEAPON = 2;
const STAT_AMMO = 3;
const STAT_ARMOR = 4;
const STAT_WEAPONFRAME = 5;
const STAT_SHELLS = 6;
const STAT_NAILS = 7;
const STAT_ROCKETS = 8;
const STAT_CELLS = 9;
const STAT_ACTIVEWEAPON = 10;
const STAT_SECRETS = 13;
const STAT_MONSTERS = 14;

export type QuakeDemoVector = [number, number, number];

export interface QuakeDemoBaseline {
    angles: QuakeDemoVector;
    colormap: number;
    effects: number;
    frame: number;
    modelIndex: number;
    origin: QuakeDemoVector;
    skin: number;
}

export interface QuakeDemoEntity extends QuakeDemoBaseline {
    entity: number;
    forceLink: boolean;
    messageTime: number;
    noLerp: boolean;
    previousAngles: QuakeDemoVector;
    previousOrigin: QuakeDemoVector;
}

export interface QuakeDemoServerInfo {
    gameType: number;
    levelName: string;
    maxClients: number;
    models: string[];
    protocol: number;
    sounds: string[];
}

export interface QuakeDemoScore {
    colors: number;
    frags: number;
    name: string;
}

export interface QuakeDemoSoundEvent {
    attenuation: number;
    channel: number;
    entity: number;
    origin: QuakeDemoVector;
    sample?: string;
    soundIndex: number;
    volume: number;
}

export interface QuakeDemoStaticSound {
    attenuation: number;
    origin: QuakeDemoVector;
    sample?: string;
    soundIndex: number;
    volume: number;
}

export interface QuakeDemoParticleEvent {
    color: number;
    count: number;
    direction: QuakeDemoVector;
    origin: QuakeDemoVector;
}

export interface QuakeDemoDamageEvent {
    armor: number;
    blood: number;
    origin: QuakeDemoVector;
}

export interface QuakeDemoTemporaryEntityEvent {
    colorLength?: number;
    colorStart?: number;
    end?: QuakeDemoVector;
    entity?: number;
    origin: QuakeDemoVector;
    type: number;
}

export interface QuakeDemoStoppedSound {
    channel: number;
    entity: number;
}

export type QuakeDemoSoundCommand =
    { event: QuakeDemoSoundEvent; kind: 'start' } |
    { event: QuakeDemoStoppedSound; kind: 'stop' };

export interface QuakeDemoCommandSpan {
    byteLength: number;
    kind: string;
    offset: number;
}

export interface QuakeDemoFrameEvents {
    centerPrints: string[];
    commands: QuakeDemoCommandSpan[];
    damages: QuakeDemoDamageEvent[];
    particles: QuakeDemoParticleEvent[];
    prints: string[];
    sounds: QuakeDemoSoundEvent[];
    soundCommands: QuakeDemoSoundCommand[];
    stoppedSounds: QuakeDemoStoppedSound[];
    stuffText: string[];
    temporaryEntities: QuakeDemoTemporaryEntityEvent[];
}

class QuakeMessageReader {
    readonly bytes: Uint8Array<ArrayBufferLike>;
    readonly reader: BinaryReader;
    offset = 0;

    constructor(bytes: Uint8Array<ArrayBufferLike>) {
        this.bytes = bytes;
        this.reader = new BinaryReader(bytes);
    }

    get done(): boolean {
        return this.offset === this.bytes.length;
    }

    private require(length: number, label: string): void {
        if (this.offset + length > this.bytes.length) {
            throw new Error(`Truncated Quake server message while reading ${label}`);
        }
    }

    uint8(label: string): number {
        this.require(1, label);
        return this.reader.uint8(this.offset++);
    }

    int8(label: string): number {
        this.require(1, label);
        return this.reader.int8(this.offset++);
    }

    int16(label: string): number {
        this.require(2, label);
        const value = this.reader.int16(this.offset);
        this.offset += 2;
        return value;
    }

    uint16(label: string): number {
        this.require(2, label);
        const value = this.reader.uint16(this.offset);
        this.offset += 2;
        return value;
    }

    int32(label: string): number {
        this.require(4, label);
        const value = this.reader.int32(this.offset);
        this.offset += 4;
        return value;
    }

    float32(label: string): number {
        this.require(4, label);
        const value = this.reader.float32(this.offset);
        this.offset += 4;
        if (!Number.isFinite(value)) {
            throw new Error(`Quake server message has invalid ${label}`);
        }
        return value;
    }

    coordinate(label: string): number {
        return this.int16(label) * 0.125;
    }

    angle(label: string): number {
        return this.int8(label) * (360 / 256);
    }

    string(label: string): string {
        const start = this.offset;
        const terminator = this.bytes.indexOf(0, start);
        if (terminator === -1) {
            throw new Error(`Unterminated ${label} in Quake server message`);
        }
        this.offset = terminator + 1;
        return new TextDecoder('windows-1252').decode(this.bytes.subarray(start, terminator));
    }
}

const zeroVector = (): QuakeDemoVector => [0, 0, 0];
const copyVector = (value: readonly number[]): QuakeDemoVector => [...value] as QuakeDemoVector;

const emptyBaseline = (): QuakeDemoBaseline => ({
    angles: zeroVector(),
    colormap: 0,
    effects: 0,
    frame: 0,
    modelIndex: 0,
    origin: zeroVector(),
    skin: 0
});

const emptyFrameEvents = (): QuakeDemoFrameEvents => ({
    centerPrints: [],
    commands: [],
    damages: [],
    particles: [],
    prints: [],
    sounds: [],
    soundCommands: [],
    stoppedSounds: [],
    stuffText: [],
    temporaryEntities: []
});

export class QuakeDemoClient {
    readonly baselines = new Map<number, QuakeDemoBaseline>();
    readonly commandCounts = new Map<string, number>();
    readonly entities = new Map<number, QuakeDemoEntity>();
    readonly itemGetTimes = new Array<number>(32).fill(0);
    readonly lightStyles = new Map<number, string>();
    readonly staticEntities: QuakeDemoBaseline[] = [];
    readonly staticSounds: QuakeDemoStaticSound[] = [];
    readonly stats = new Int32Array(MAX_STATS);
    cdTrack = 0;
    completedTime = 0;
    disconnected = false;
    idealPitch = 0;
    inWater = false;
    intermission = 0;
    items = 0;
    loopTrack = 0;
    messageViewAngles: QuakeDemoVector = zeroVector();
    onGround = false;
    paused = false;
    previousMessageViewAngles: QuakeDemoVector = zeroVector();
    previousTime = 0;
    previousVelocity: QuakeDemoVector = zeroVector();
    punchAngles: QuakeDemoVector = zeroVector();
    scores: QuakeDemoScore[] = [];
    serverInfo?: QuakeDemoServerInfo;
    signon = 0;
    time = 0;
    velocity: QuakeDemoVector = zeroVector();
    viewAngles: QuakeDemoVector = zeroVector();
    viewEntity = 0;
    viewHeight = 22;

    parseMessage(message: QuakeDemoMessage): QuakeDemoFrameEvents {
        this.previousMessageViewAngles = copyVector(this.messageViewAngles);
        this.messageViewAngles = copyVector(message.viewAngles);
        this.onGround = false;
        const events = emptyFrameEvents();
        const reader = new QuakeMessageReader(message.data);
        while (!reader.done) {
            const start = reader.offset;
            const command = reader.uint8('command');
            let kind: string;
            if ((command & 128) !== 0) {
                kind = 'fastUpdate';
                this.parseFastUpdate(reader, command & 127);
            } else {
                kind = this.parseCommand(reader, command, events);
            }
            events.commands.push({
                byteLength: reader.offset - start,
                kind,
                offset: start
            });
            this.commandCounts.set(kind, (this.commandCounts.get(kind) ?? 0) + 1);
        }
        return events;
    }

    private parseCommand(
        reader: QuakeMessageReader,
        command: number,
        events: QuakeDemoFrameEvents
    ): string {
        switch (command) {
            case 1:
                return 'nop';
            case 2:
                this.disconnected = true;
                return 'disconnect';
            case 3:
                this.parseUpdateStat(reader);
                return 'updateStat';
            case 4:
                this.validateProtocol(reader.int32('protocol version'));
                return 'version';
            case 5:
                this.viewEntity = reader.int16('view entity');
                return 'setView';
            case 6: {
                const event = this.parseSound(reader);
                events.sounds.push(event);
                events.soundCommands.push({ event, kind: 'start' });
                return 'sound';
            }
            case 7:
                this.previousTime = this.time;
                this.time = reader.float32('server time');
                return 'time';
            case 8:
                events.prints.push(reader.string('print string'));
                return 'print';
            case 9:
                events.stuffText.push(reader.string('stufftext string'));
                return 'stuffText';
            case 10:
                this.viewAngles = this.readAngles(reader, 'setangle');
                return 'setAngle';
            case 11:
                this.parseServerInfo(reader);
                return 'serverInfo';
            case 12:
                this.parseLightStyle(reader);
                return 'lightStyle';
            case 13:
                this.score(reader, 'name').name = reader.string('scoreboard name');
                return 'updateName';
            case 14:
                this.score(reader, 'frags').frags = reader.int16('scoreboard frags');
                return 'updateFrags';
            case 15:
                this.parseClientData(reader);
                return 'clientData';
            case 16: {
                const packed = reader.int16('stopped sound');
                const event = { channel: packed & 7, entity: packed >> 3 };
                events.stoppedSounds.push(event);
                events.soundCommands.push({ event, kind: 'stop' });
                return 'stopSound';
            }
            case 17:
                this.score(reader, 'colors').colors = reader.uint8('scoreboard colors');
                return 'updateColors';
            case 18:
                events.particles.push(this.parseParticle(reader));
                return 'particle';
            case 19:
                events.damages.push(this.parseDamage(reader));
                return 'damage';
            case 20:
                this.parseStaticEntity(reader);
                return 'spawnStatic';
            case 21:
                throw new Error('Obsolete svc_spawnbinary in Quake server message');
            case 22:
                this.parseSpawnBaseline(reader);
                return 'spawnBaseline';
            case 23:
                events.temporaryEntities.push(this.parseTemporaryEntity(reader));
                return 'temporaryEntity';
            case 24:
                this.paused = reader.uint8('pause state') !== 0;
                return 'setPause';
            case 25:
                this.parseSignon(reader);
                return 'signon';
            case 26:
                events.centerPrints.push(reader.string('centerprint string'));
                return 'centerPrint';
            case 27:
                this.stats[STAT_MONSTERS]++;
                return 'killedMonster';
            case 28:
                this.stats[STAT_SECRETS]++;
                return 'foundSecret';
            case 29:
                this.staticSounds.push(this.parseStaticSound(reader));
                return 'spawnStaticSound';
            case 30:
                this.intermission = 1;
                this.completedTime = this.time;
                return 'intermission';
            case 31:
                this.intermission = 2;
                this.completedTime = this.time;
                events.centerPrints.push(reader.string('finale string'));
                return 'finale';
            case 32:
                this.cdTrack = reader.uint8('CD track');
                this.loopTrack = reader.uint8('looping CD track');
                return 'cdTrack';
            case 33:
                return 'sellScreen';
            case 34:
                this.intermission = 3;
                this.completedTime = this.time;
                events.centerPrints.push(reader.string('cutscene string'));
                return 'cutscene';
            default:
                throw new Error(`Illegible Quake server command ${command}`);
        }
    }

    private parseServerInfo(reader: QuakeMessageReader): void {
        const protocol = reader.int32('serverinfo protocol');
        this.validateProtocol(protocol);
        const maxClients = reader.uint8('serverinfo maxclients');
        if (maxClients < 1 || maxClients > MAX_CLIENTS) {
            throw new Error(`Invalid Quake server maxclients ${maxClients}`);
        }
        const gameType = reader.uint8('serverinfo game type');
        const levelName = reader.string('serverinfo level name');
        const models = this.readPrecache(reader, 'model', MAX_MODELS);
        const sounds = this.readPrecache(reader, 'sound', MAX_SOUNDS);
        this.clearLevelState();
        this.scores = Array.from({ length: maxClients }, () => ({
            colors: 0,
            frags: 0,
            name: ''
        }));
        this.serverInfo = { gameType, levelName, maxClients, models, protocol, sounds };
    }

    private clearLevelState(): void {
        this.baselines.clear();
        this.entities.clear();
        this.itemGetTimes.fill(0);
        this.lightStyles.clear();
        this.staticEntities.length = 0;
        this.staticSounds.length = 0;
        this.stats.fill(0);
        this.completedTime = 0;
        this.idealPitch = 0;
        this.inWater = false;
        this.intermission = 0;
        this.items = 0;
        this.onGround = false;
        this.previousTime = 0;
        this.previousVelocity = zeroVector();
        this.punchAngles = zeroVector();
        this.time = 0;
        this.velocity = zeroVector();
        this.viewHeight = 22;
    }

    private readPrecache(
        reader: QuakeMessageReader,
        label: string,
        maximum: number
    ): string[] {
        const entries = [''];
        while (true) {
            const value = reader.string(`${label} precache`);
            if (value === '') return entries;
            if (entries.length >= maximum) {
                throw new Error(`Quake server sent too many ${label} precaches`);
            }
            entries.push(value);
        }
    }

    private validateProtocol(protocol: number): void {
        if (protocol !== PROTOCOL_VERSION) {
            throw new Error(`Quake server protocol ${protocol} is not ${PROTOCOL_VERSION}`);
        }
    }

    private parseFastUpdate(reader: QuakeMessageReader, lowBits: number): void {
        if (this.signon === 3) this.signon = 4;
        let bits = lowBits;
        if ((bits & U_MOREBITS) !== 0) {
            bits |= reader.uint8('fast-update high bits') << 8;
        }
        const entityNumber = (bits & U_LONGENTITY) !== 0 ?
            reader.int16('fast-update entity') : reader.uint8('fast-update entity');
        if (entityNumber < 0 || entityNumber >= MAX_EDICTS) {
            throw new Error(`Invalid Quake entity ${entityNumber}`);
        }
        const baseline = this.baselines.get(entityNumber) ?? emptyBaseline();
        const existing = this.entities.get(entityNumber);
        const previousOrigin = copyVector(existing?.origin ?? baseline.origin);
        const previousAngles = copyVector(existing?.angles ?? baseline.angles);
        const modelIndex = (bits & U_MODEL) !== 0 ?
            reader.uint8('fast-update model') : baseline.modelIndex;
        const frame = (bits & U_FRAME) !== 0 ?
            reader.uint8('fast-update frame') : baseline.frame;
        const colormap = (bits & U_COLORMAP) !== 0 ?
            reader.uint8('fast-update colormap') : baseline.colormap;
        const skin = (bits & U_SKIN) !== 0 ?
            reader.uint8('fast-update skin') : baseline.skin;
        const effects = (bits & U_EFFECTS) !== 0 ?
            reader.uint8('fast-update effects') : baseline.effects;
        const origin = copyVector(baseline.origin);
        const angles = copyVector(baseline.angles);
        if ((bits & U_ORIGIN1) !== 0) origin[0] = reader.coordinate('fast-update origin x');
        if ((bits & U_ANGLE1) !== 0) angles[0] = reader.angle('fast-update pitch');
        if ((bits & U_ORIGIN2) !== 0) origin[1] = reader.coordinate('fast-update origin y');
        if ((bits & U_ANGLE2) !== 0) angles[1] = reader.angle('fast-update yaw');
        if ((bits & U_ORIGIN3) !== 0) origin[2] = reader.coordinate('fast-update origin z');
        if ((bits & U_ANGLE3) !== 0) angles[2] = reader.angle('fast-update roll');
        const forceLink = !existing || existing.messageTime !== this.previousTime;
        const noLerp = (bits & U_NOLERP) !== 0;
        this.entities.set(entityNumber, {
            angles,
            colormap,
            effects,
            entity: entityNumber,
            forceLink: forceLink || noLerp,
            frame,
            messageTime: this.time,
            modelIndex,
            noLerp,
            origin,
            previousAngles: forceLink ? copyVector(angles) : previousAngles,
            previousOrigin: forceLink ? copyVector(origin) : previousOrigin,
            skin
        });
    }

    private parseBaseline(reader: QuakeMessageReader): QuakeDemoBaseline {
        const baseline = emptyBaseline();
        baseline.modelIndex = reader.uint8('baseline model');
        baseline.frame = reader.uint8('baseline frame');
        baseline.colormap = reader.uint8('baseline colormap');
        baseline.skin = reader.uint8('baseline skin');
        for (let axis = 0; axis < 3; axis++) {
            baseline.origin[axis] = reader.coordinate(`baseline origin ${axis}`);
            baseline.angles[axis] = reader.angle(`baseline angle ${axis}`);
        }
        return baseline;
    }

    private parseSpawnBaseline(reader: QuakeMessageReader): void {
        const entity = reader.int16('baseline entity');
        if (entity < 0 || entity >= MAX_EDICTS) {
            throw new Error(`Invalid Quake baseline entity ${entity}`);
        }
        this.baselines.set(entity, this.parseBaseline(reader));
    }

    private parseStaticEntity(reader: QuakeMessageReader): void {
        if (this.staticEntities.length >= MAX_STATIC_ENTITIES) {
            throw new Error('Too many Quake static entities');
        }
        this.staticEntities.push(this.parseBaseline(reader));
    }

    private parseClientData(reader: QuakeMessageReader): void {
        const bits = reader.uint16('clientdata bits');
        this.viewHeight = (bits & SU_VIEWHEIGHT) !== 0 ?
            reader.int8('client viewheight') : 22;
        this.idealPitch = (bits & SU_IDEALPITCH) !== 0 ?
            reader.int8('client ideal pitch') : 0;
        const punchAngles = zeroVector();
        const velocity = zeroVector();
        this.previousVelocity = copyVector(this.velocity);
        for (let axis = 0; axis < 3; axis++) {
            if ((bits & (SU_PUNCH1 << axis)) !== 0) {
                punchAngles[axis] = reader.int8(`client punch ${axis}`);
            }
            if ((bits & (SU_VELOCITY1 << axis)) !== 0) {
                velocity[axis] = reader.int8(`client velocity ${axis}`) * 16;
            }
        }
        this.punchAngles = punchAngles;
        this.velocity = velocity;
        const items = reader.int32('client items');
        for (let bit = 0; bit < 32; bit++) {
            if ((items & (1 << bit)) !== 0 && (this.items & (1 << bit)) === 0) {
                this.itemGetTimes[bit] = this.time;
            }
        }
        this.items = items;
        this.onGround = (bits & SU_ONGROUND) !== 0;
        this.inWater = (bits & SU_INWATER) !== 0;
        this.stats[STAT_WEAPONFRAME] = (bits & SU_WEAPONFRAME) !== 0 ?
            reader.uint8('client weapon frame') : 0;
        this.stats[STAT_ARMOR] = (bits & SU_ARMOR) !== 0 ?
            reader.uint8('client armor') : 0;
        this.stats[STAT_WEAPON] = (bits & SU_WEAPON) !== 0 ?
            reader.uint8('client weapon') : 0;
        this.stats[STAT_HEALTH] = reader.int16('client health');
        this.stats[STAT_AMMO] = reader.uint8('client ammo');
        this.stats[STAT_SHELLS] = reader.uint8('client shells');
        this.stats[STAT_NAILS] = reader.uint8('client nails');
        this.stats[STAT_ROCKETS] = reader.uint8('client rockets');
        this.stats[STAT_CELLS] = reader.uint8('client cells');
        this.stats[STAT_ACTIVEWEAPON] = reader.uint8('client active weapon');
    }

    private parseUpdateStat(reader: QuakeMessageReader): void {
        const index = reader.uint8('stat index');
        if (index >= MAX_STATS) throw new Error(`Invalid Quake stat ${index}`);
        this.stats[index] = reader.int32('stat value');
    }

    private score(reader: QuakeMessageReader, label: string): QuakeDemoScore {
        const index = reader.uint8(`scoreboard ${label} index`);
        if (index >= this.scores.length) {
            throw new Error(`Invalid Quake scoreboard index ${index}`);
        }
        return this.scores[index];
    }

    private parseLightStyle(reader: QuakeMessageReader): void {
        const index = reader.uint8('lightstyle index');
        if (index >= MAX_LIGHT_STYLES) {
            throw new Error(`Invalid Quake lightstyle ${index}`);
        }
        this.lightStyles.set(index, reader.string('lightstyle pattern'));
    }

    private readOrigin(reader: QuakeMessageReader, label: string): QuakeDemoVector {
        return [
            reader.coordinate(`${label} x`),
            reader.coordinate(`${label} y`),
            reader.coordinate(`${label} z`)
        ];
    }

    private readAngles(reader: QuakeMessageReader, label: string): QuakeDemoVector {
        return [
            reader.angle(`${label} pitch`),
            reader.angle(`${label} yaw`),
            reader.angle(`${label} roll`)
        ];
    }

    private parseSound(reader: QuakeMessageReader): QuakeDemoSoundEvent {
        const fieldMask = reader.uint8('sound field mask');
        const volume = (fieldMask & SND_VOLUME) !== 0 ? reader.uint8('sound volume') : 255;
        const attenuation = (fieldMask & SND_ATTENUATION) !== 0 ?
            reader.uint8('sound attenuation') / 64 : 1;
        const packedChannel = reader.int16('sound entity and channel');
        const soundIndex = reader.uint8('sound index');
        const entity = packedChannel >> 3;
        if (entity > MAX_EDICTS) throw new Error(`Invalid Quake sound entity ${entity}`);
        return {
            attenuation,
            channel: packedChannel & 7,
            entity,
            origin: this.readOrigin(reader, 'sound origin'),
            sample: this.serverInfo?.sounds[soundIndex],
            soundIndex,
            volume
        };
    }

    private parseStaticSound(reader: QuakeMessageReader): QuakeDemoStaticSound {
        const origin = this.readOrigin(reader, 'static sound origin');
        const soundIndex = reader.uint8('static sound index');
        const volume = reader.uint8('static sound volume');
        const attenuation = reader.uint8('static sound attenuation');
        return {
            attenuation,
            origin,
            sample: this.serverInfo?.sounds[soundIndex],
            soundIndex,
            volume
        };
    }

    private parseParticle(reader: QuakeMessageReader): QuakeDemoParticleEvent {
        const origin = this.readOrigin(reader, 'particle origin');
        const direction = [
            reader.int8('particle direction x') / 16,
            reader.int8('particle direction y') / 16,
            reader.int8('particle direction z') / 16
        ] as QuakeDemoVector;
        const messageCount = reader.uint8('particle count');
        return {
            color: reader.uint8('particle color'),
            count: messageCount === 255 ? 1_024 : messageCount,
            direction,
            origin
        };
    }

    private parseDamage(reader: QuakeMessageReader): QuakeDemoDamageEvent {
        return {
            armor: reader.uint8('damage armor'),
            blood: reader.uint8('damage blood'),
            origin: this.readOrigin(reader, 'damage origin')
        };
    }

    private parseTemporaryEntity(reader: QuakeMessageReader): QuakeDemoTemporaryEntityEvent {
        const type = reader.uint8('temporary entity type');
        if (type === 5 || type === 6 || type === 9 || type === 13) {
            const entity = reader.int16('beam entity');
            const origin = this.readOrigin(reader, 'beam start');
            const end = this.readOrigin(reader, 'beam end');
            return {
                end,
                entity,
                origin,
                type
            };
        }
        if (![0, 1, 2, 3, 4, 7, 8, 10, 11, 12].includes(type)) {
            throw new Error(`Invalid Quake temporary entity type ${type}`);
        }
        const origin = this.readOrigin(reader, 'temporary entity origin');
        if (type === 12) {
            return {
                colorLength: reader.uint8('explosion color length'),
                colorStart: reader.uint8('explosion color start'),
                origin,
                type
            };
        }
        return { origin, type };
    }

    private parseSignon(reader: QuakeMessageReader): void {
        const signon = reader.uint8('signon stage');
        if (signon <= this.signon || signon > 4) {
            throw new Error(`Invalid Quake signon transition ${this.signon} to ${signon}`);
        }
        this.signon = signon;
    }
}
