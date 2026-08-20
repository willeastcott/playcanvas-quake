import type { Vec3 } from '../formats/bsp';

export interface QuakeCapturePose {
    angles: Vec3;
    origin: Vec3;
}

export type QuakePaletteCaptureMode =
    'bonus' | 'damage' | 'invisibility' | 'invulnerability' | 'quad' | 'suit';

export const quakePaletteCaptureModeFromParameters = (
    parameters: URLSearchParams
): QuakePaletteCaptureMode | undefined => {
    const captureMode = parameters.get('capture');
    return captureMode === 'bonus' || captureMode === 'damage' ||
        captureMode === 'invisibility' || captureMode === 'invulnerability' ||
        captureMode === 'quad' ||
        captureMode === 'suit' ? captureMode : undefined;
};

export const quakeCaptureViewSizeFromParameters = (
    parameters: URLSearchParams
): number | undefined => {
    if (parameters.get('capture') === null) {
        return undefined;
    }
    const value = parameters.get('captureViewSize');
    if (value === null) {
        return undefined;
    }
    const viewSize = Number(value);
    if (!Number.isFinite(viewSize)) {
        throw new Error('Invalid captureViewSize; expected a finite number');
    }
    return Math.max(30, Math.min(120, viewSize));
};

const parseCaptureVector = (
    captureMode: string,
    name: string,
    value: string | null
): Vec3 => {
    if (value === null) {
        throw new Error(`capture=${captureMode} requires ${name}=x,y,z`);
    }
    const components = value.split(',').map(component => Number(component.trim()));
    if (components.length !== 3 || components.some(component => !Number.isFinite(component))) {
        throw new Error(`Invalid ${name}; expected three finite comma-separated numbers`);
    }
    return components as Vec3;
};

export const quakeCapturePoseFromParameters = (
    parameters: URLSearchParams
): QuakeCapturePose | undefined => {
    const captureMode = parameters.get('capture');
    const origin = parameters.get('captureOrigin');
    const angles = parameters.get('captureAngles');
    const poseCapture = captureMode === 'pose' || captureMode === 'shot' ||
        captureMode === 'button-door' || captureMode === 'silver-key-door' ||
        captureMode === 'secret-door-shot' || captureMode === 'trigger-secret-door' ||
        captureMode === 'touch-trigger-door' || captureMode === 'light-door' ||
        captureMode === 'axe-hit' || captureMode === 'shoot-trigger-door' ||
        captureMode === 'start-stairs' ||
        captureMode === 'explobox' ||
        captureMode === 'tutorial-message' ||
        captureMode === 'lightning' || captureMode === 'rocket-flight' ||
        captureMode === 'nailgun-flight' || captureMode === 'rocket-impact' ||
        captureMode === 'grenade-flight' ||
        captureMode === 'grenade-bounce' || captureMode === 'grenade-explosion' ||
        captureMode === 'ogre-grenade-flight' ||
        captureMode === 'ogre-grenade-impact' ||
        captureMode === 'knight-melee' ||
        captureMode === 'shambler-lightning' ||
        captureMode === 'wizard-tracer' ||
        captureMode === 'soldier-death' ||
        captureMode === 'soldier-gib-impact' || captureMode === 'soldier-gib-trail' ||
        captureMode === 'patrol' || captureMode === 'platform-ride' ||
        captureMode === 'dog-leap' || captureMode === 'dog-death' ||
        captureMode === 'drowning-bubble' || captureMode === 'player-death' ||
        captureMode === 'weapon-pickup' ||
        captureMode === 'bonus' || captureMode === 'damage' ||
        captureMode === 'invisibility' || captureMode === 'invulnerability' ||
        captureMode === 'quad' ||
        captureMode === 'suit';
    const intermissionOverride = captureMode === 'intermission' &&
        (origin !== null || angles !== null);
    if (!poseCapture && !intermissionOverride) {
        return undefined;
    }
    return {
        angles: parseCaptureVector(captureMode, 'captureAngles', angles),
        origin: parseCaptureVector(captureMode, 'captureOrigin', origin)
    };
};
