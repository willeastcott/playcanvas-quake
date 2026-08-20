import type { HullTrace, WorldCollision } from './collision';
import { quakeProtocolCoordinate } from './quake-protocol';
import type { QuakeVirtualMachine } from './quake-vm';
import type { Vec3 } from '../formats/bsp';

const degreesToRadians = Math.PI / 180;
const FL_ONGROUND = 512;

export interface QuakeSoundEvent {
    attenuation: number;
    channel: number;
    entity: number;
    origin: Vec3;
    sample: string;
    volume: number;
}

export interface QuakeStoppedSoundEvent {
    channel: number;
    entity: number;
}

export type QuakeSoundCommand =
    { event: QuakeSoundEvent; kind: 'start' } |
    { event: QuakeStoppedSoundEvent; kind: 'stop' };

export interface QuakeParticleEvent {
    color: number;
    colorLength?: number;
    count: number;
    direction: Vec3;
    end?: Vec3;
    kind?: 'blob' | 'effect' | 'entity' | 'explosion' | 'explosion2' | 'lava' |
        'teleport' | 'trail';
    origin: Vec3;
    trailType?: number;
}

export interface QuakeAmbientSound {
    attenuation: number;
    origin: Vec3;
    sample: string;
    volume: number;
}

export interface QuakeBuiltinServices {
    ambientSound?: (event: QuakeAmbientSound) => void;
    aim?: (entity: number, missileSpeed: number) => Vec3;
    changeLevel?: (mapName: string) => void;
    changeYaw?: (entity: number) => void;
    checkBottom?: (entity: number) => boolean;
    checkClient?: () => number;
    cvarValue?: (name: string) => number;
    dropToFloor?: (entity: number) => boolean;
    lightStyle?: (style: number, pattern: string) => void;
    linkEntity?: (entity: number) => void;
    localCommand?: (command: string) => void;
    makeStatic?: (entity: number) => void;
    modelBounds?: (modelPath: string) => {
        maximum: Vec3;
        minimum: Vec3;
    } | undefined;
    moveStep?: (entity: number, movement: Vec3) => boolean;
    moveToGoal?: (entity: number, distance: number) => void;
    particle?: (event: QuakeParticleEvent) => void;
    print?: (entity: number, message: string, centered: boolean) => void;
    random?: () => number;
    removeEntity?: (entity: number) => void;
    sound?: (event: QuakeSoundEvent) => void;
    setCvar?: (name: string, value: string) => void;
    setSpawnParameters?: (entity: number) => void;
    stuffCommand?: (entity: number, command: string) => void;
    traceLine?: (
        start: Vec3,
        end: Vec3,
        noMonsters: boolean,
        ignore: number
    ) => { entity: number; trace: HullTrace };
    writeMessage?: (
        destination: number,
        kind: 'angle' | 'byte' | 'char' | 'coord' | 'entity' | 'long' | 'short' | 'string',
        value: number | string
    ) => void;
    worldModelPath?: string;
}

export const quakeStringToFloat = (value: string): number => {
    let index = 0;
    let sign = 1;
    if (value[index] === '-') {
        sign = -1;
        index++;
    }
    if (value[index] === '0' && (value[index + 1] === 'x' || value[index + 1] === 'X')) {
        index += 2;
        let result = 0;
        while (index < value.length) {
            const character = value[index++];
            const digit = character >= '0' && character <= '9' ? character.charCodeAt(0) - 48 :
                character >= 'a' && character <= 'f' ? character.charCodeAt(0) - 87 :
                    character >= 'A' && character <= 'F' ? character.charCodeAt(0) - 55 : -1;
            if (digit < 0) break;
            result = result * 16 + digit;
        }
        return sign * result;
    }
    if (value[index] === '\'') {
        return sign * (value.charCodeAt(index + 1) || 0);
    }
    let result = 0;
    let decimal = -1;
    let total = 0;
    while (index < value.length) {
        const character = value[index++];
        if (character === '.') {
            decimal = total;
            continue;
        }
        if (character < '0' || character > '9') break;
        result = result * 10 + character.charCodeAt(0) - 48;
        total++;
    }
    return sign * (decimal === -1 ? result : result / 10 ** (total - decimal));
};

const normalize = (vector: Vec3): Vec3 => {
    const magnitude = Math.hypot(...vector);
    return magnitude > 0 ? vector.map(component => component / magnitude) as Vec3 : [0, 0, 0];
};

const angleVectors = (angles: Vec3): { forward: Vec3; right: Vec3; up: Vec3 } => {
    const pitch = angles[0] * degreesToRadians;
    const yaw = angles[1] * degreesToRadians;
    const roll = angles[2] * degreesToRadians;
    const sinePitch = Math.sin(pitch);
    const cosinePitch = Math.cos(pitch);
    const sineYaw = Math.sin(yaw);
    const cosineYaw = Math.cos(yaw);
    const sineRoll = Math.sin(roll);
    const cosineRoll = Math.cos(roll);
    return {
        forward: [cosinePitch * cosineYaw, cosinePitch * sineYaw, -sinePitch],
        right: [
            -sineRoll * sinePitch * cosineYaw + cosineRoll * sineYaw,
            -sineRoll * sinePitch * sineYaw - cosineRoll * cosineYaw,
            -sineRoll * cosinePitch
        ],
        up: [
            cosineRoll * sinePitch * cosineYaw + sineRoll * sineYaw,
            cosineRoll * sinePitch * sineYaw - sineRoll * cosineYaw,
            cosineRoll * cosinePitch
        ]
    };
};

export const registerQuakeBuiltins = (
    vm: QuakeVirtualMachine,
    collision?: WorldCollision,
    services: QuakeBuiltinServices = {}
): void => {
    let randomState = 0x1234abcd;
    const fallbackCvars = new Map<string, string>([
        ['coop', '0'],
        ['deathmatch', '0'],
        ['developer', '0'],
        ['edgefriction', '2'],
        ['fraglimit', '0'],
        ['noexit', '0'],
        ['registered', '0'],
        ['samelevel', '0'],
        ['skill', '1'],
        ['sv_accelerate', '10'],
        ['sv_aim', '0.93'],
        ['sv_friction', '4'],
        ['sv_gravity', '800'],
        ['sv_idealpitchscale', '0.8'],
        ['sv_maxspeed', '320'],
        ['sv_maxvelocity', '2000'],
        ['sv_nostep', '0'],
        ['sv_stopspeed', '100'],
        ['teamplay', '0'],
        ['temp1', '0'],
        ['timelimit', '0']
    ]);
    const noOperation = (): void => {};
    const passthroughString = (): void => vm.setReturnWord(vm.argumentWord(0));
    const modelIndices = new Map<string, number>([['', 0]]);
    const soundPrecache = new Set<string>();
    if (services.worldModelPath) {
        modelIndices.set(services.worldModelPath, 1);
    }
    if (collision) {
        for (let modelIndex = 1; modelIndex < collision.map.models.length; modelIndex++) {
            modelIndices.set(`*${modelIndex}`, modelIndex + 1);
        }
    }
    let nextModelIndex = collision ? collision.map.models.length + 1 : 1;
    const precacheModel = (modelPath: string): number => {
        if (!modelPath || modelPath.charCodeAt(0) <= 32) {
            throw new Error('QuakeC error: Bad string');
        }
        const existing = modelIndices.get(modelPath);
        if (existing !== undefined) return existing;
        if (nextModelIndex >= 256) {
            throw new Error('QuakeC error: PF_precache_model: overflow');
        }
        const modelIndex = nextModelIndex++;
        modelIndices.set(modelPath, modelIndex);
        return modelIndex;
    };
    const precacheSound = (sample: string): void => {
        if (!sample || sample.charCodeAt(0) <= 32) {
            throw new Error('QuakeC error: Bad string');
        }
        if (!soundPrecache.has(sample) && soundPrecache.size >= 255) {
            throw new Error('QuakeC error: PF_precache_sound: overflow');
        }
        soundPrecache.add(sample);
    };
    const variadicString = (first: number, count: number): string => {
        let result = '';
        for (let argument = first; argument < count; argument++) {
            result += vm.argumentString(argument);
        }
        return result;
    };
    const precacheModelBuiltin = (): void => {
        if (vm.isServerActive()) {
            throw new Error(
                'QuakeC error: PF_Precache_*: Precache can only be done in spawn functions'
            );
        }
        precacheModel(vm.argumentString(0));
        vm.setReturnWord(vm.argumentWord(0));
    };
    const precacheSoundBuiltin = (): void => {
        if (vm.isServerActive()) {
            throw new Error(
                'QuakeC error: PF_Precache_*: Precache can only be done in spawn functions'
            );
        }
        precacheSound(vm.argumentString(0));
        vm.setReturnWord(vm.argumentWord(0));
    };

    vm.registerBuiltin(1, () => {
        const vectors = angleVectors(vm.argumentVector(0));
        vm.setGlobalVector('v_forward', vectors.forward);
        vm.setGlobalVector('v_right', vectors.right);
        vm.setGlobalVector('v_up', vectors.up);
    });
    vm.registerBuiltin(2, () => {
        const entity = vm.argumentWord(0);
        vm.setEntityVector(entity, 'origin', vm.argumentVector(1));
        services.linkEntity?.(entity);
    });
    vm.registerBuiltin(3, () => {
        const entity = vm.argumentWord(0);
        const modelPath = vm.argumentString(1);
        vm.setEntityString(entity, 'model', modelPath);
        const modelIndex = modelPath ? modelIndices.get(modelPath) : 0;
        if (modelIndex === undefined) {
            throw new Error(`QuakeC error: no precache: ${modelPath}`);
        }
        vm.setEntityFloat(entity, 'modelindex', modelIndex);
        let bounds: { maximum: Vec3; minimum: Vec3 } | undefined;
        if (!modelPath) {
            bounds = { maximum: [0, 0, 0], minimum: [0, 0, 0] };
        } else if (collision && modelPath.startsWith('*')) {
            const model = collision.map.models[Number(modelPath.slice(1))];
            if (model) bounds = { maximum: model.maxs, minimum: model.mins };
        } else {
            bounds = services.modelBounds?.(modelPath);
        }
        if (bounds) {
            vm.setEntityVector(entity, 'mins', bounds.minimum);
            vm.setEntityVector(entity, 'maxs', bounds.maximum);
            vm.setEntityVector(entity, 'size', bounds.maximum.map(
                (component, axis) => component - bounds.minimum[axis]
            ) as Vec3);
        }
        services.linkEntity?.(entity);
    });
    vm.registerBuiltin(4, () => {
        const entity = vm.argumentWord(0);
        const minimum = vm.argumentVector(1);
        const maximum = vm.argumentVector(2);
        vm.setEntityVector(entity, 'mins', minimum);
        vm.setEntityVector(entity, 'maxs', maximum);
        vm.setEntityVector(entity, 'size', maximum.map(
            (component, axis) => component - minimum[axis]
        ) as Vec3);
        services.linkEntity?.(entity);
    });
    vm.registerBuiltin(6, noOperation);
    vm.registerBuiltin(7, () => {
        if (services.random) {
            vm.setReturnFloat(services.random());
            return;
        }
        randomState = (Math.imul(randomState, 1_103_515_245) + 12_345) & 0x7fffffff;
        vm.setReturnFloat((randomState & 0x7fff) / 0x7fff);
    });
    vm.registerBuiltin(8, () => {
        const entity = vm.argumentWord(0);
        const entityOrigin = vm.getEntityVector(entity, 'origin');
        const minimum = vm.getEntityVector(entity, 'mins');
        const maximum = vm.getEntityVector(entity, 'maxs');
        const channel = Math.trunc(vm.argumentFloat(1));
        const sample = vm.argumentString(2);
        const volume = Math.trunc(vm.argumentFloat(3) * 255);
        const attenuation = vm.argumentFloat(4);
        if (volume < 0 || volume > 255) {
            throw new Error(`SV_StartSound: volume = ${volume}`);
        }
        if (attenuation < 0 || attenuation > 4) {
            throw new Error(`SV_StartSound: attenuation = ${attenuation}`);
        }
        if (channel < 0 || channel > 7) {
            throw new Error(`SV_StartSound: channel = ${channel}`);
        }
        if (!soundPrecache.has(sample)) {
            services.print?.(0, `SV_StartSound: ${sample} not precacheed\n`, false);
            return;
        }
        services.sound?.({
            attenuation: Math.trunc(attenuation * 64) / 64,
            channel,
            entity,
            origin: entityOrigin.map(
                (component, axis) => quakeProtocolCoordinate(
                    component + 0.5 * (minimum[axis] + maximum[axis])
                )
            ) as Vec3,
            sample,
            volume: volume / 255
        });
    });
    vm.registerBuiltin(9, () => vm.setReturnVector(normalize(vm.argumentVector(0))));
    vm.registerBuiltin(10, (_runtime, argumentCount) => {
        throw new Error(`QuakeC error: ${variadicString(0, argumentCount)}`);
    });
    vm.registerBuiltin(11, (_runtime, argumentCount) => {
        const entity = vm.getGlobalWord('self');
        if (services.removeEntity) {
            services.removeEntity(entity);
        } else {
            vm.freeEdict(entity);
        }
        throw new Error(`QuakeC object error: ${variadicString(0, argumentCount)}`);
    });
    vm.registerBuiltin(12, () => vm.setReturnFloat(Math.hypot(...vm.argumentVector(0))));
    vm.registerBuiltin(13, () => {
        const vector = vm.argumentVector(0);
        let yaw = vector[0] === 0 && vector[1] === 0 ? 0 :
            Math.trunc(Math.atan2(vector[1], vector[0]) / degreesToRadians);
        if (yaw < 0) yaw += 360;
        vm.setReturnFloat(yaw);
    });
    vm.registerBuiltin(14, () => vm.setReturnWord(vm.allocateEdict()));
    vm.registerBuiltin(15, () => {
        const entity = vm.argumentWord(0);
        if (services.removeEntity) {
            services.removeEntity(entity);
        } else {
            vm.freeEdict(entity);
        }
    });
    vm.registerBuiltin(16, () => {
        if (!collision && !services.traceLine) {
            vm.setGlobalFloat('trace_fraction', 1);
            vm.setGlobalVector('trace_endpos', vm.argumentVector(1));
            return;
        }
        const result = services.traceLine?.(
            vm.argumentVector(0),
            vm.argumentVector(1),
            vm.argumentFloat(2) !== 0,
            vm.argumentWord(3)
        );
        const trace = result?.trace ?? collision!.tracePoint(
            vm.argumentVector(0), vm.argumentVector(1)
        );
        vm.setGlobalFloat('trace_allsolid', trace.allSolid ? 1 : 0);
        vm.setGlobalFloat('trace_startsolid', trace.startSolid ? 1 : 0);
        vm.setGlobalFloat('trace_fraction', trace.fraction);
        vm.setGlobalVector('trace_endpos', trace.endPosition);
        vm.setGlobalVector('trace_plane_normal', trace.plane.normal);
        vm.setGlobalFloat('trace_plane_dist', trace.plane.distance);
        vm.setGlobalWord('trace_ent', result?.entity ?? 0);
        vm.setGlobalFloat('trace_inopen', trace.inOpen ? 1 : 0);
        vm.setGlobalFloat('trace_inwater', trace.inWater ? 1 : 0);
    });
    vm.registerBuiltin(17, () => vm.setReturnWord(services.checkClient?.() ?? 0));
    vm.registerBuiltin(18, () => {
        const start = vm.argumentWord(0);
        const fieldOffset = vm.argumentWord(1);
        const match = vm.argumentString(2);
        for (let reference = start + 1; reference < vm.edicts.length; reference++) {
            const edict = vm.edicts[reference];
            if (!edict.free && vm.getString(edict.words[fieldOffset]) === match) {
                vm.setReturnWord(reference);
                return;
            }
        }
        vm.setReturnWord(0);
    });
    vm.registerBuiltin(19, precacheSoundBuiltin);
    vm.registerBuiltin(20, precacheModelBuiltin);
    vm.registerBuiltin(21, () => services.stuffCommand?.(
        vm.argumentWord(0), vm.argumentString(1)
    ));
    vm.registerBuiltin(22, () => {
        const origin = vm.argumentVector(0);
        const radius = vm.argumentFloat(1);
        let chain = 0;
        for (let reference = 1; reference < vm.edicts.length; reference++) {
            if (vm.entity(reference).free || vm.getEntityFloat(reference, 'solid') === 0) {
                continue;
            }
            const entityOrigin = vm.getEntityVector(reference, 'origin');
            const mins = vm.getEntityVector(reference, 'mins');
            const maxs = vm.getEntityVector(reference, 'maxs');
            const center = entityOrigin.map(
                (component, axis) => component + (mins[axis] + maxs[axis]) * 0.5
            ) as Vec3;
            if (Math.hypot(...center.map(
                (component, axis) => component - origin[axis]
            )) > radius) {
                continue;
            }
            vm.setEntityWord(reference, 'chain', chain);
            chain = reference;
        }
        vm.setReturnWord(chain);
    });
    vm.registerBuiltin(23, (_runtime, argumentCount) => services.print?.(
        0, variadicString(0, argumentCount), false
    ));
    vm.registerBuiltin(24, (_runtime, argumentCount) => services.print?.(
        vm.argumentWord(0), variadicString(1, argumentCount), false
    ));
    vm.registerBuiltin(25, (_runtime, argumentCount) => {
        const developer = services.cvarValue?.('developer') ??
            quakeStringToFloat(fallbackCvars.get('developer') ?? '');
        if (developer !== 0) {
            services.print?.(0, variadicString(0, argumentCount), false);
        }
    });
    for (const index of [28, 29, 30, 31]) {
        vm.registerBuiltin(index, noOperation);
    }
    vm.registerBuiltin(26, () => {
        const value = vm.argumentFloat(0);
        vm.setReturnString(Number.isInteger(value) ? String(value) :
            value.toFixed(1).padStart(5)
        );
    });
    vm.registerBuiltin(27, () => {
        const vector = vm.argumentVector(0);
        vm.setReturnString(`'${vector.map(
            value => value.toFixed(1).padStart(5)
        ).join(' ')}'`);
    });
    vm.registerBuiltin(32, () => {
        const yaw = vm.argumentFloat(0) * degreesToRadians;
        const movement: Vec3 = [
            Math.cos(yaw) * vm.argumentFloat(1),
            Math.sin(yaw) * vm.argumentFloat(1),
            0
        ];
        vm.setReturnFloat(services.moveStep?.(
            vm.getGlobalWord('self'), movement
        ) ? 1 : 0);
    });
    vm.registerBuiltin(34, () => {
        const entity = vm.getGlobalWord('self');
        if (services.dropToFloor) {
            vm.setReturnFloat(services.dropToFloor(entity) ? 1 : 0);
            return;
        }
        if (!collision) {
            vm.setReturnFloat(0);
            return;
        }
        const origin = vm.getEntityVector(entity, 'origin');
        const end: Vec3 = [origin[0], origin[1], origin[2] - 256];
        const trace = collision.traceBox(
            origin,
            end,
            vm.getEntityVector(entity, 'mins'),
            vm.getEntityVector(entity, 'maxs')
        );
        if (trace.fraction === 1 || trace.allSolid) {
            vm.setReturnFloat(0);
            return;
        }
        vm.setEntityVector(entity, 'origin', trace.endPosition);
        vm.setEntityFloat(entity, 'flags',
            Math.trunc(vm.getEntityFloat(entity, 'flags')) | FL_ONGROUND
        );
        vm.setEntityWord(entity, 'groundentity', 0);
        vm.setReturnFloat(1);
    });
    vm.registerBuiltin(35, () => services.lightStyle?.(
        Math.trunc(vm.argumentFloat(0)), vm.argumentString(1)
    ));
    vm.registerBuiltin(36, () => {
        const value = vm.argumentFloat(0);
        vm.setReturnFloat(Math.trunc(value + (value > 0 ? 0.5 : -0.5)));
    });
    vm.registerBuiltin(37, () => vm.setReturnFloat(Math.floor(vm.argumentFloat(0))));
    vm.registerBuiltin(38, () => vm.setReturnFloat(Math.ceil(vm.argumentFloat(0))));
    vm.registerBuiltin(40, () => vm.setReturnFloat(
        services.checkBottom ? (services.checkBottom(vm.argumentWord(0)) ? 1 : 0) : 1
    ));
    vm.registerBuiltin(41, () => vm.setReturnFloat(
        collision?.pointContents(vm.argumentVector(0)) ?? -1
    ));
    vm.registerBuiltin(43, () => vm.setReturnFloat(Math.abs(vm.argumentFloat(0))));
    vm.registerBuiltin(44, () => vm.setReturnVector(
        services.aim?.(vm.argumentWord(0), vm.argumentFloat(1)) ??
        vm.getGlobalVector('v_forward')
    ));
    vm.registerBuiltin(45, () => {
        const name = vm.argumentString(0);
        vm.setReturnFloat(services.cvarValue?.(name) ??
            quakeStringToFloat(fallbackCvars.get(name) ?? '')
        );
    });
    vm.registerBuiltin(46, () => services.localCommand?.(vm.argumentString(0)));
    vm.registerBuiltin(47, () => {
        let reference = vm.argumentWord(0) + 1;
        while (reference < vm.edicts.length && vm.edicts[reference].free) reference++;
        vm.setReturnWord(reference < vm.edicts.length ? reference : 0);
    });
    vm.registerBuiltin(48, () => {
        const encodedCount = Math.trunc(vm.argumentFloat(3)) & 255;
        services.particle?.({
            color: Math.trunc(vm.argumentFloat(2)) & 255,
            count: encodedCount === 255 ? 1_024 : encodedCount,
            direction: vm.argumentVector(1).map((component) => {
                return Math.max(-128, Math.min(127, Math.trunc(component * 16))) / 16;
            }) as Vec3,
            origin: vm.argumentVector(0).map(quakeProtocolCoordinate) as Vec3
        });
    });
    vm.registerBuiltin(49, () => {
        const entity = vm.getGlobalWord('self');
        if (services.changeYaw) {
            services.changeYaw(entity);
            return;
        }
        let current = ((vm.getEntityVector(entity, 'angles')[1] % 360) + 360) % 360;
        const ideal = vm.getEntityFloat(entity, 'ideal_yaw');
        const speed = vm.getEntityFloat(entity, 'yaw_speed');
        if (current === ideal) {
            return;
        }
        let move = ideal - current;
        if (ideal > current ? move >= 180 : move <= -180) {
            move += ideal > current ? -360 : 360;
        }
        move = Math.max(-speed, Math.min(speed, move));
        current = ((current + move) % 360 + 360) % 360;
        const angles = vm.getEntityVector(entity, 'angles');
        angles[1] = current;
        vm.setEntityVector(entity, 'angles', angles);
    });
    vm.registerBuiltin(51, () => {
        const vector = vm.argumentVector(0);
        if (vector[0] === 0 && vector[1] === 0) {
            vm.setReturnVector([vector[2] > 0 ? 90 : 270, 0, 0]);
            return;
        }
        let yaw = Math.trunc(Math.atan2(vector[1], vector[0]) / degreesToRadians);
        if (yaw < 0) yaw += 360;
        const forward = Math.hypot(vector[0], vector[1]);
        let pitch = Math.trunc(Math.atan2(vector[2], forward) / degreesToRadians);
        if (pitch < 0) pitch += 360;
        vm.setReturnVector([pitch, yaw, 0]);
    });
    vm.registerBuiltin(52, () => services.writeMessage?.(
        Math.trunc(vm.argumentFloat(0)), 'byte', Math.trunc(vm.argumentFloat(1))
    ));
    vm.registerBuiltin(53, () => services.writeMessage?.(
        Math.trunc(vm.argumentFloat(0)), 'char', Math.trunc(vm.argumentFloat(1))
    ));
    vm.registerBuiltin(54, () => services.writeMessage?.(
        Math.trunc(vm.argumentFloat(0)), 'short', Math.trunc(vm.argumentFloat(1))
    ));
    vm.registerBuiltin(55, () => services.writeMessage?.(
        Math.trunc(vm.argumentFloat(0)), 'long', Math.trunc(vm.argumentFloat(1))
    ));
    vm.registerBuiltin(56, () => services.writeMessage?.(
        Math.trunc(vm.argumentFloat(0)), 'coord', vm.argumentFloat(1)
    ));
    vm.registerBuiltin(57, () => services.writeMessage?.(
        Math.trunc(vm.argumentFloat(0)), 'angle', vm.argumentFloat(1)
    ));
    vm.registerBuiltin(58, () => services.writeMessage?.(
        Math.trunc(vm.argumentFloat(0)), 'string', vm.argumentString(1)
    ));
    vm.registerBuiltin(59, () => services.writeMessage?.(
        Math.trunc(vm.argumentFloat(0)), 'entity', vm.argumentWord(1)
    ));
    vm.registerBuiltin(67, () => services.moveToGoal?.(
        vm.getGlobalWord('self'), vm.argumentFloat(0)
    ));
    vm.registerBuiltin(68, passthroughString);
    vm.registerBuiltin(69, () => {
        const entity = vm.argumentWord(0);
        if (services.makeStatic) {
            services.makeStatic(entity);
        } else {
            vm.freeEdict(entity);
        }
    });
    let changeLevelIssued = false;
    vm.registerBuiltin(70, () => {
        if (changeLevelIssued) return;
        changeLevelIssued = true;
        services.changeLevel?.(vm.argumentString(0));
    });
    vm.registerBuiltin(72, () => {
        const name = vm.argumentString(0);
        const value = vm.argumentString(1);
        if (services.setCvar) {
            services.setCvar(name, value);
        } else if (fallbackCvars.has(name)) {
            fallbackCvars.set(name, value);
        }
    });
    vm.registerBuiltin(73, (_runtime, argumentCount) => services.print?.(
        vm.argumentWord(0), variadicString(1, argumentCount), true
    ));
    vm.registerBuiltin(74, () => {
        const sample = vm.argumentString(1);
        if (!soundPrecache.has(sample)) {
            services.print?.(0, `no precache: ${sample}\n`, false);
            return;
        }
        services.ambientSound?.({
            attenuation: Math.trunc(vm.argumentFloat(3) * 64) / 64,
            origin: vm.argumentVector(0).map(quakeProtocolCoordinate) as Vec3,
            sample,
            volume: Math.trunc(vm.argumentFloat(2) * 255) / 255
        });
    });
    vm.registerBuiltin(75, precacheModelBuiltin);
    vm.registerBuiltin(76, precacheSoundBuiltin);
    vm.registerBuiltin(77, passthroughString);
    vm.registerBuiltin(78, () => services.setSpawnParameters?.(vm.argumentWord(0)));
};
