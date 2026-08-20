import {
    AppBase,
    AppOptions,
    ASPECT_MANUAL,
    CameraComponentSystem,
    Color,
    DEVICETYPE_WEBGL2,
    Entity,
    FILLMODE_NONE,
    GAMMA_NONE,
    RenderComponentSystem,
    RESOLUTION_AUTO,
    TONEMAP_NONE,
    Vec4,
    createGraphicsDevice
} from 'playcanvas';

import { QuakeAudioSystem, quakeCdTrackNumber } from './audio-system';
import { CameraController } from './camera-controller';
import {
    quakePaletteCaptureModeFromParameters,
    quakeCapturePoseFromParameters,
    quakeCaptureViewSizeFromParameters
} from './capture-pose';
import {
    QUAKE_GRENADE_CAPTURE_FRAMES,
    QUAKE_DOG_DEATH_CAPTURE_FRAMES,
    QUAKE_EXPLOBOX_CAPTURE_FRAMES,
    QUAKE_NAILGUN_CAPTURE_FRAMES,
    QUAKE_OGRE_GRENADE_CAPTURE_FRAMES,
    QUAKE_PLATFORM_CAPTURE_FRAMES,
    QUAKE_SOLDIER_DEATH_CAPTURE_FRAMES,
    QUAKE_SOLDIER_GIB_CAPTURE_FRAMES,
    QUAKE_TELEPORT_CAPTURE_TIME,
    QUAKE_WIZARD_TRACER_CAPTURE_FRAMES,
    advanceQuakeGrenadeCapture,
    advanceQuakeDogDeathCapture,
    advanceQuakeExploboxCapture,
    advanceQuakeNailgunCapture,
    advanceQuakeOgreGrenadeCapture,
    advanceQuakePlatformCapture,
    advanceQuakeRocketCapture,
    advanceQuakeSoldierDeathCapture,
    advanceQuakeSoldierGibCapture,
    advanceQuakeWizardTracerCapture,
    prepareQuakeButtonDoorCapture,
    prepareQuakeAxeHitCapture,
    prepareQuakeDogLeapCapture,
    prepareQuakeDogDeathCapture,
    prepareQuakeDrowningBubbleCapture,
    prepareQuakeExploboxCapture,
    prepareQuakeGrenadeCapture,
    prepareQuakeKnightMeleeCapture,
    prepareQuakeLightDoorCapture,
    prepareQuakePaletteCapture,
    prepareQuakeLightningCapture,
    prepareQuakeNailgunCapture,
    prepareQuakeOgreGrenadeCapture,
    prepareQuakePatrolCapture,
    prepareQuakePlayerDeathCapture,
    prepareQuakePlatformCapture,
    prepareQuakeRocketCapture,
    prepareQuakeShamblerLightningCapture,
    prepareQuakeSecretDoorShotCapture,
    prepareQuakeShootableTriggerDoorCapture,
    prepareQuakeSilverKeyDoorCapture,
    prepareQuakeStartStairsCapture,
    prepareQuakeSoldierDeathCapture,
    prepareQuakeSoldierGibCapture,
    prepareQuakeTeleportCapture,
    prepareQuakeTouchTriggerDoorCapture,
    prepareQuakeTriggeredSecretDoorCapture,
    prepareQuakeTutorialMessageCapture,
    prepareQuakeWeaponPickupCapture,
    prepareQuakeWizardTracerCapture,
    setQuakePaletteCaptureTime,
    settleQuakePausedCapturePalette
} from './capture-state';
import { QuakeCdAudioController } from './cd-audio';
import { WorldCollision } from './collision';
import {
    QUAKE_DEFAULT_DEMOS,
    QUAKE_MAX_DEMOS,
    parseQuakeDemoLoopState,
    quakeDemoLoopNames,
    quakeDemoPath,
    quakeNextDemo,
    serializeQuakeDemoLoopState,
    type QuakeDemoLoopState
} from './demo-loop';
import {
    QuakeDemoPlayback,
    QuakeTimeDemoCounter,
    quakeTimeDemoReport
} from './demo-playback';
import {
    QUAKE_DEFAULT_ALIASES,
    QUAKE_KEY_MENU_COMMANDS,
    QuakeCommandBuffer,
    QuakeKeyBindings,
    quakeApplyBindingCommands,
    quakeAliasName,
    quakeCommandArguments,
    quakeCommandScript,
    quakeKeyboardKeyName,
    quakeMouseKeyName
} from './input-bindings';
import {
    parseQuakeLevelTransition,
    quakeMapName,
    quakeMapPath,
    type QuakeLevelTransitionState
} from './level-transition';
import {
    quakeMenuCaptureScreen,
    quakeMenuCaptureUsesEmptySaveSlots,
    QuakeMenuCursorState
} from './menu-state';
import {
    quakePlayerColorsCommand,
    quakePlayerColorsFromCvar,
    quakePlayerName,
    quakePlayerNameCommand
} from './player-setup';
import { quakeStringToFloat } from './quake-builtins';
import { quakeProtocolAngle } from './quake-protocol';
import { QuakeVirtualMachine } from './quake-vm';
import { QuakeWorldRuntime, type QuakePlayerResult } from './quake-world';
import {
    QUAKE_SAVE_SLOT_COUNT,
    QUAKE_UNUSED_SAVE_SLOT,
    quakeCreateSaveSlot,
    quakeReadSave,
    quakeReadSaveSlots,
    quakeSaveComment,
    quakeSaveName,
    quakeSaveSlotNumber,
    quakeWriteSave,
    type QuakeSaveSlot
} from './save-game';
import { extractQuakeSharewarePak, quakePakUrl } from './shareware-archive';
import { BspMap, type Vec3 } from '../formats/bsp';
import { parseQuakeDemo } from '../formats/dem';
import { parseVector } from '../formats/entities';
import { PakArchive } from '../formats/pak';
import { QuakeProgram } from '../formats/progs';
import { WadArchive } from '../formats/wad';
import { ViewModelRenderer } from '../render/alias-renderer';
import { BeamRenderer } from '../render/beam-renderer';
import {
    HudRenderer,
    QUAKE_OPTIONS_MENU_ITEMS,
    type HudMenuState
} from '../render/hud-renderer';
import { applyQuakeGamma, applyQuakePaletteShifts } from '../render/palette';
import { ParticleRenderer } from '../render/particle-renderer';
import { QuakeUnderwaterWarp, usesQuakeUnderwaterWarp } from '../render/underwater-warp';
import { WorldAliasRenderer } from '../render/world-alias-renderer';
import { WorldBrushEntityRenderer } from '../render/world-brush-entity-renderer';
import { WorldRenderer } from '../render/world-renderer';
import { WorldSpriteRenderer } from '../render/world-sprite-renderer';

const SHAREWARE_PAK_SIZE = 18_689_235;
const SHAREWARE_PAK_HASH = '35a9c55e5e5a284a159ad2a62e0e8def23d829561fe2f54eb402dbc0a9a946af';
const IT_INVISIBILITY = 524_288;
const LEVEL_TRANSITION_STORAGE_KEY = 'quake-playcanvas-level-transition';
const DEMO_LOOP_STORAGE_KEY = 'quake-playcanvas-demo-loop';
export const QUAKE_LOADING_FRAME_STORAGE_KEY = 'quake-playcanvas-loading-frame';

export const quakeStartupConsoleLines = (shareware: boolean): string[] => [
    shareware ? 'Playing shareware version.' : 'Playing registered version.',
    'execing quake.rc',
    'execing default.cfg',
    'execing config.cfg',
    'execing autoexec.cfg'
];

interface StartQuakeOptions {
    gameCanvas: HTMLCanvasElement;
    restoredLoadingFrame?: boolean;
    screenCanvas: HTMLCanvasElement;
    onStatus: (message: string) => void;
}

interface QuakeClientCvarBinding {
    read: () => number;
    write: (value: number) => void;
}

export const quakeFieldOfView = (fieldOfView: number): number => (
    Math.max(10, Math.min(170, fieldOfView))
);

export const quakePageAudioActive = (
    visibilityState: DocumentVisibilityState,
    hasFocus: boolean
): boolean => visibilityState === 'visible' && hasFocus;

export const configureQuakeProjection = (camera: {
    aspectRatio: number;
    aspectRatioMode: number;
    fov: number;
    horizontalFov: boolean;
}, viewWidth = 320, viewHeight = 152, fieldOfView = 90,
videoWidth = 320, videoHeight = 200): void => {
    const pixelAspect = videoHeight / videoWidth * (320 / 240);
    camera.aspectRatio = viewWidth * pixelAspect / viewHeight;
    camera.aspectRatioMode = ASPECT_MANUAL;
    camera.fov = quakeFieldOfView(fieldOfView);
    camera.horizontalFov = true;
};

export const quakeMenuGamma = (gamma: number, direction: number): number => {
    return Math.max(0.5, Math.min(1, gamma - direction * 0.05));
};

export const quakeQuitPreviousMenu = (
    screen: HudMenuState['screen'] | undefined,
    cursor: number,
    page: number
): HudMenuState['previous'] => {
    if (!screen || screen === 'newgame' || screen === 'quit') return undefined;
    return { cursor, page, screen };
};

export const quakeQuitReturnMenu = (
    previous: HudMenuState['previous']
): { cursor: number; page: number; screen: HudMenuState['screen'] } | undefined => (
    previous ? {
        cursor: previous.cursor,
        page: previous.page ?? 0,
        screen: previous.screen
    } : undefined
);

export interface QuakeViewLayout {
    statusBarLines: number;
    viewRect: {
        height: number;
        width: number;
        x: number;
        y: number;
    };
}

export const quakeCanvasDisplaySize = (
    stageWidth: number,
    stageHeight: number,
    viewRect: QuakeViewLayout['viewRect']
): { height: number; width: number } => ({
    height: Math.max(1, Math.round(stageHeight * viewRect.height / 200)),
    width: Math.max(1, Math.round(stageWidth * viewRect.width / 320))
});

export const quakeMenuViewSize = (viewSize: number, direction: number): number => {
    return Math.max(30, Math.min(120, viewSize + direction * 10));
};

export const quakeConsoleHeight = (
    current: number,
    target: number,
    frameTime: number,
    speed = 300
): number => {
    if (target < current) {
        current -= speed * frameTime;
        return target > current ? target : current;
    }
    if (target > current) {
        current += speed * frameTime;
        return target < current ? target : current;
    }
    return current;
};

export const quakeScreenshotName = (index: number): string | undefined => (
    Number.isInteger(index) && index >= 0 && index < 100 ?
        `quake${String(index).padStart(2, '0')}.png` : undefined
);

export const quakeViewLayout = (
    requestedViewSize: number,
    intermission = false,
    width = 320,
    height = 200
): QuakeViewLayout => {
    const viewSize = intermission ? 120 :
        Math.max(30, Math.min(120, requestedViewSize));
    const statusBarLines = viewSize >= 120 ? 0 : viewSize >= 110 ? 24 : 48;
    let scale = Math.min(100, viewSize) / 100;
    let viewWidth = Math.trunc(width * scale);
    if (viewWidth < 96) {
        scale = 96 / width;
        viewWidth = 96;
    }
    viewWidth &= ~7;
    let viewHeight = Math.trunc(height * scale);
    viewHeight = Math.min(viewHeight, height - statusBarLines) & ~1;
    const availableHeight = height - statusBarLines;
    return {
        statusBarLines,
        viewRect: {
            height: viewHeight,
            width: viewWidth,
            x: Math.trunc((width - viewWidth) / 2),
            y: Math.trunc((availableHeight - viewHeight) / 2)
        }
    };
};

export const quakeMapSpawnPose = (map: BspMap): { angles: Vec3; origin: Vec3 } => {
    const spawn = map.entities.find(entity => entity.classname === 'info_player_start');
    if (!spawn) {
        throw new Error('Map has no info_player_start entity');
    }
    return {
        angles: [0, Number(spawn.angle ?? 0), 0],
        origin: parseVector(spawn.origin)
    };
};

export { quakeDemoPath } from './demo-loop';

const hexDigest = (buffer: ArrayBuffer): string => [...new Uint8Array(buffer)]
.map(value => value.toString(16).padStart(2, '0'))
.join('');

const isPakData = (data: ArrayBuffer): boolean => (
    new TextDecoder().decode(data.slice(0, 4)) === 'PACK'
);

const loadPak = async (status: (message: string) => void) => {
    status('Loading id1/pak0.pak…');
    const response = await fetch(quakePakUrl());
    const responseData = response.ok ? await response.arrayBuffer() : undefined;
    const data = responseData && isPakData(responseData) ?
        responseData : await extractQuakeSharewarePak(status);
    status('Verifying Quake data…');
    const sha256 = hexDigest(await crypto.subtle.digest('SHA-256', data));
    const sharewareVerified = data.byteLength === SHAREWARE_PAK_SIZE && sha256 === SHAREWARE_PAK_HASH;
    return { pak: new PakArchive(data), sha256, sharewareVerified };
};

export const startQuake = async ({
    gameCanvas,
    restoredLoadingFrame = false,
    screenCanvas,
    onStatus
}: StartQuakeOptions) => {
    const loaded = await loadPak(onStatus);
    const urlParameters = new URLSearchParams(window.location.search);
    const gammaParameter = Number(urlParameters.get('gamma') ?? 1);
    let gamma = Number.isFinite(gammaParameter) ?
        Math.max(0.3, Math.min(1, gammaParameter)) : 1;
    const originalPalette = loaded.pak.get('gfx/palette.lmp');
    const palette = applyQuakeGamma(originalPalette, gamma);
    const wad = new WadArchive(loaded.pak.get('gfx.wad'));
    const hud = new HudRenderer(screenCanvas, wad, loaded.pak, palette);
    const startupConsoleLines = quakeStartupConsoleLines(loaded.sharewareVerified);
    if (!restoredLoadingFrame) {
        hud.draw({
            console: {
                height: 200,
                input: '',
                lines: startupConsoleLines,
                time: 0
            },
            statusBarLines: 0
        });
    }
    let playerName = quakePlayerName(urlParameters.get('_cl_name') ?? 'player');
    const initialPlayerColors = quakePlayerColorsFromCvar(quakeStringToFloat(
        urlParameters.get('_cl_color') ?? '0'
    ));
    let playerTopColor = initialPlayerColors.top;
    let playerBottomColor = initialPlayerColors.bottom;
    const capturePngEnabled = urlParameters.get('capturePng') === '1';
    if (capturePngEnabled) {
        const stage = gameCanvas.parentElement;
        if (stage) {
            stage.style.width = '320px';
            stage.style.height = '200px';
        }
    }
    const attractLoopRequested = window.location.search === '' ||
        urlParameters.get('attract') === '1';
    const loopDemos = quakeDemoLoopNames(
        (urlParameters.get('demos')?.split(',') ?? QUAKE_DEFAULT_DEMOS)
    );
    const requestedLoopIndex = Number(urlParameters.get('demonum') ?? 0);
    let activeDemoLoop: QuakeDemoLoopState | undefined;
    let demoParameter = urlParameters.get('demo');
    if (attractLoopRequested) {
        const nextIndex = Number.isInteger(requestedLoopIndex) ? requestedLoopIndex : 0;
        if (demoParameter === null) {
            const nextDemo = quakeNextDemo({ demos: loopDemos, nextIndex });
            demoParameter = nextDemo?.demo ?? null;
            activeDemoLoop = nextDemo?.state;
        } else {
            const normalizedDemo = quakeDemoPath(demoParameter)?.slice(0, -4);
            const currentIndex = normalizedDemo === undefined ? -1 :
                loopDemos.indexOf(normalizedDemo);
            activeDemoLoop = {
                demos: loopDemos,
                nextIndex: urlParameters.has('demonum') ? nextIndex : currentIndex + 1
            };
        }
    }
    const requestedDemoPath = quakeDemoPath(demoParameter);
    const timeDemoRequested = urlParameters.get('timedemo') === '1';
    if (demoParameter !== null && !requestedDemoPath) {
        throw new Error(`Invalid Quake demo name ${demoParameter}`);
    }
    if (requestedDemoPath && !loaded.pak.has(requestedDemoPath)) {
        throw new Error(`Verified PAK does not contain requested demo ${requestedDemoPath}`);
    }
    if (activeDemoLoop) {
        sessionStorage.setItem(
            DEMO_LOOP_STORAGE_KEY, serializeQuakeDemoLoopState(activeDemoLoop)
        );
    }
    const demoPlayback = requestedDemoPath ? new QuakeDemoPlayback(
        parseQuakeDemo(loaded.pak.get(requestedDemoPath)), timeDemoRequested
    ) : undefined;
    const timeDemo = demoPlayback?.timedemo ? new QuakeTimeDemoCounter() : undefined;
    const demoStartup = demoPlayback?.start();
    const demoMapPath = demoPlayback?.client.serverInfo?.models[1];
    const demoMapName = demoMapPath?.match(/^maps\/([a-z0-9_]+)\.bsp$/u)?.[1];
    if (demoPlayback && (!demoMapName || !demoMapPath)) {
        throw new Error(`Quake demo ${requestedDemoPath} has no valid world model`);
    }
    const requestedLoadName = demoPlayback ? undefined :
        quakeSaveName(urlParameters.get('load') ?? '');
    const requestedSave = requestedLoadName === undefined ? undefined :
        quakeReadSave(localStorage, requestedLoadName);
    const requestedMapName = quakeMapName(
        demoMapName ?? requestedSave?.state.mapName ?? urlParameters.get('map') ?? 'e1m1'
    );
    const mapPath = demoMapPath ?? (requestedMapName ? quakeMapPath(requestedMapName) : undefined);
    if (!requestedMapName || !mapPath || !loaded.pak.has(mapPath)) {
        throw new Error(`Verified PAK does not contain requested map ${
            urlParameters.get('map') ?? ''
        }`);
    }
    let mapName = requestedMapName;
    onStatus(`Parsing ${mapPath}…`);
    let map = new BspMap(loaded.pak.get(mapPath));
    let transitionState: QuakeLevelTransitionState | undefined;
    try {
        transitionState = demoPlayback || requestedSave ? undefined : parseQuakeLevelTransition(
            sessionStorage.getItem(LEVEL_TRANSITION_STORAGE_KEY), mapName
        );
        sessionStorage.removeItem(LEVEL_TRANSITION_STORAGE_KEY);
    } catch {
        transitionState = undefined;
    }
    const captureMode = urlParameters.get('capture');
    const menuCaptureScreen = quakeMenuCaptureScreen(captureMode);
    const drowningBubbleFrameParameter = urlParameters.get('captureBubbleFrame');
    if (captureMode === 'drowning-bubble' && drowningBubbleFrameParameter !== null &&
        drowningBubbleFrameParameter !== '0' && drowningBubbleFrameParameter !== '1') {
        throw new Error('Invalid captureBubbleFrame; expected 0 or 1');
    }
    const drowningBubbleFrame: 0 | 1 = drowningBubbleFrameParameter === '1' ? 1 : 0;
    const tutorialTargetParameter = urlParameters.get('captureTutorialTarget');
    if (captureMode === 'tutorial-message' && tutorialTargetParameter !== null &&
        tutorialTargetParameter !== 't31' && tutorialTargetParameter !== 't32') {
        throw new Error('Invalid captureTutorialTarget; expected t31 or t32');
    }
    const tutorialTarget = tutorialTargetParameter === 't32' ? 't32' : 't31';
    const rocketCaptureMode = captureMode === 'rocket-flight' ||
        captureMode === 'rocket-impact' ? captureMode : undefined;
    const grenadeCaptureMode = captureMode === 'grenade-flight' ||
        captureMode === 'grenade-bounce' || captureMode === 'grenade-explosion' ?
        captureMode : undefined;
    const ogreGrenadeCaptureMode = captureMode === 'ogre-grenade-flight' ||
        captureMode === 'ogre-grenade-impact' ? captureMode : undefined;
    const soldierGibCaptureMode = captureMode === 'soldier-gib-impact' ||
        captureMode === 'soldier-gib-trail' ? captureMode : undefined;
    const capturePose = quakeCapturePoseFromParameters(urlParameters);
    const paletteCaptureMode = quakePaletteCaptureModeFromParameters(urlParameters);
    const requestedInitialCvars = Object.fromEntries(
        ['deathmatch', 'hostname', 'skill'].flatMap((name) => {
            const value = urlParameters.get(name);
            return value === null ? [] : [[name, value]];
        })
    );
    const initialServerCvars = requestedSave ||
        Object.keys(requestedInitialCvars).length === 0 ?
        undefined : requestedInitialCvars;
    const captureViewSize = quakeCaptureViewSizeFromParameters(urlParameters);
    const viewSizeParameter = Number(urlParameters.get('viewsize') ?? 100);
    const initialViewSize = Number.isFinite(viewSizeParameter) ?
        Math.max(30, Math.min(120, viewSizeParameter)) : 100;
    const soundVolumeParameter = Number(urlParameters.get('volume') ?? 0.7);
    const initialSoundVolume = Number.isFinite(soundVolumeParameter) ?
        soundVolumeParameter : 0.7;
    const musicVolumeParameter = Number(urlParameters.get('bgmvolume') ?? 1);
    const initialMusicVolume = Number.isFinite(musicVolumeParameter) ?
        musicVolumeParameter : 1;
    const ambientLevelParameter = Number(urlParameters.get('ambient_level') ?? 0.3);
    const initialAmbientLevel = Number.isFinite(ambientLevelParameter) ?
        ambientLevelParameter : 0.3;
    const ambientFadeParameter = Number(urlParameters.get('ambient_fade') ?? 100);
    const initialAmbientFade = Number.isFinite(ambientFadeParameter) ?
        ambientFadeParameter : 100;
    const program = new QuakeProgram(loaded.pak.get('progs.dat'));
    let vm = new QuakeVirtualMachine(program);

    const app = new AppBase(gameCanvas);
    const options = new AppOptions();
    options.graphicsDevice = await createGraphicsDevice(gameCanvas, {
        antialias: false,
        depth: true,
        deviceTypes: [DEVICETYPE_WEBGL2],
        powerPreference: 'high-performance'
    });
    options.componentSystems = [RenderComponentSystem, CameraComponentSystem];
    options.resourceHandlers = [];
    app.init(options);
    app.setCanvasFillMode(FILLMODE_NONE);
    app.setCanvasResolution(RESOLUTION_AUTO);
    app.scene.ambientLight = new Color(0, 0, 0);

    const cameraEntity = new Entity('Quake camera');
    cameraEntity.addComponent('camera', {
        clearColor: new Color(0, 0, 0),
        farClip: 8192,
        nearClip: 1,
        rect: new Vec4(0, 0, 1, 1)
    });
    const camera = cameraEntity.camera;
    if (!camera) {
        throw new Error('PlayCanvas did not create the camera component');
    }
    configureQuakeProjection(camera);
    camera.gammaCorrection = GAMMA_NONE;
    camera.toneMapping = TONEMAP_NONE;
    const underwaterWarp = new QuakeUnderwaterWarp(app.graphicsDevice);
    camera.postEffects.addEffect(underwaterWarp);
    app.root.addChild(cameraEntity);

    onStatus('Building indexed textures and per-texel lightmaps…');
    const controller = new CameraController(app, map, cameraEntity);
    let crosshair = 0;
    let crosshairOffsetX = 0;
    let crosshairOffsetY = 0;
    let centerMessageDuration = 2;
    const centerMessageRuntime: { world?: QuakeWorldRuntime } = {};
    let consoleSpeed = 300;
    let fieldOfView = 90;
    let finalePrintSpeed = 8;
    let showPause = 1;
    const clientCvars = new Map<string, QuakeClientCvarBinding>([
        ['_cl_color', {
            read: () => playerTopColor * 16 + playerBottomColor,
            write: (value) => {
                const colors = quakePlayerColorsFromCvar(value);
                playerTopColor = colors.top;
                playerBottomColor = colors.bottom;
            }
        }],
        ['cl_bob', {
            read: () => controller.bobAmount,
            write: (value) => {
                controller.bobAmount = value;
            }
        }],
        ['cl_bobcycle', {
            read: () => controller.bobCycle,
            write: (value) => {
                controller.bobCycle = value;
            }
        }],
        ['cl_bobup', {
            read: () => controller.bobUp,
            write: (value) => {
                controller.bobUp = value;
            }
        }],
        ['cl_crossx', {
            read: () => crosshairOffsetX,
            write: (value) => {
                crosshairOffsetX = value;
            }
        }],
        ['cl_crossy', {
            read: () => crosshairOffsetY,
            write: (value) => {
                crosshairOffsetY = value;
            }
        }],
        ['cl_rollangle', {
            read: () => controller.rollAngle,
            write: (value) => {
                controller.rollAngle = value;
            }
        }],
        ['cl_rollspeed', {
            read: () => controller.rollSpeed,
            write: (value) => {
                controller.rollSpeed = value;
            }
        }],
        ['cl_anglespeedkey', {
            read: () => controller.angleSpeedKey,
            write: (value) => {
                controller.angleSpeedKey = value;
            }
        }],
        ['cl_backspeed', {
            read: () => controller.backSpeed,
            write: (value) => {
                controller.backSpeed = value;
            }
        }],
        ['cl_forwardspeed', {
            read: () => controller.forwardSpeed,
            write: (value) => {
                controller.forwardSpeed = value;
            }
        }],
        ['cl_movespeedkey', {
            read: () => controller.moveSpeedKey,
            write: (value) => {
                controller.moveSpeedKey = value;
            }
        }],
        ['cl_pitchspeed', {
            read: () => controller.pitchSpeed,
            write: (value) => {
                controller.pitchSpeed = value;
            }
        }],
        ['cl_sidespeed', {
            read: () => controller.sideSpeed,
            write: (value) => {
                controller.sideSpeed = value;
            }
        }],
        ['cl_upspeed', {
            read: () => controller.upSpeed,
            write: (value) => {
                controller.upSpeed = value;
            }
        }],
        ['cl_yawspeed', {
            read: () => controller.yawSpeed,
            write: (value) => {
                controller.yawSpeed = value;
            }
        }],
        ['lookspring', {
            read: () => controller.lookSpring,
            write: (value) => {
                controller.lookSpring = value;
            }
        }],
        ['lookstrafe', {
            read: () => controller.lookStrafe,
            write: (value) => {
                controller.lookStrafe = value;
            }
        }],
        ['crosshair', {
            read: () => crosshair,
            write: (value) => {
                crosshair = value;
            }
        }],
        ['fov', {
            read: () => fieldOfView,
            write: (value) => {
                fieldOfView = quakeFieldOfView(value);
            }
        }],
        ['scr_ofsx', {
            read: () => controller.screenOffset[0],
            write: (value) => {
                controller.screenOffset[0] = value;
            }
        }],
        ['scr_ofsy', {
            read: () => controller.screenOffset[1],
            write: (value) => {
                controller.screenOffset[1] = value;
            }
        }],
        ['scr_ofsz', {
            read: () => controller.screenOffset[2],
            write: (value) => {
                controller.screenOffset[2] = value;
            }
        }],
        ['scr_centertime', {
            read: () => centerMessageDuration,
            write: (value) => {
                centerMessageDuration = value;
                if (centerMessageRuntime.world) {
                    centerMessageRuntime.world.centerMessageDuration = value;
                }
            }
        }],
        ['scr_conspeed', {
            read: () => consoleSpeed,
            write: (value) => {
                consoleSpeed = value;
            }
        }],
        ['scr_printspeed', {
            read: () => finalePrintSpeed,
            write: (value) => {
                finalePrintSpeed = value;
            }
        }],
        ['showpause', {
            read: () => showPause,
            write: (value) => {
                showPause = value;
            }
        }],
        ['m_forward', {
            read: () => controller.mouseForward,
            write: (value) => {
                controller.mouseForward = value;
            }
        }],
        ['m_filter', {
            read: () => controller.mouseFilter,
            write: (value) => {
                controller.mouseFilter = value;
            }
        }],
        ['m_pitch', {
            read: () => controller.mousePitch,
            write: (value) => {
                controller.mousePitch = value;
            }
        }],
        ['m_side', {
            read: () => controller.mouseSide,
            write: (value) => {
                controller.mouseSide = value;
            }
        }],
        ['m_yaw', {
            read: () => controller.mouseYaw,
            write: (value) => {
                controller.mouseYaw = value;
            }
        }],
        ['sensitivity', {
            read: () => controller.sensitivity,
            write: (value) => {
                controller.sensitivity = value;
            }
        }],
        ['v_idlescale', {
            read: () => controller.idleScale,
            write: (value) => {
                controller.idleScale = value;
            }
        }],
        ['v_ipitch_cycle', {
            read: () => controller.idlePitchCycle,
            write: (value) => {
                controller.idlePitchCycle = value;
            }
        }],
        ['v_ipitch_level', {
            read: () => controller.idlePitchLevel,
            write: (value) => {
                controller.idlePitchLevel = value;
            }
        }],
        ['v_iroll_cycle', {
            read: () => controller.idleRollCycle,
            write: (value) => {
                controller.idleRollCycle = value;
            }
        }],
        ['v_iroll_level', {
            read: () => controller.idleRollLevel,
            write: (value) => {
                controller.idleRollLevel = value;
            }
        }],
        ['v_iyaw_cycle', {
            read: () => controller.idleYawCycle,
            write: (value) => {
                controller.idleYawCycle = value;
            }
        }],
        ['v_iyaw_level', {
            read: () => controller.idleYawLevel,
            write: (value) => {
                controller.idleYawLevel = value;
            }
        }],
        ['v_kickpitch', {
            read: () => controller.kickPitch,
            write: (value) => {
                controller.kickPitch = value;
            }
        }],
        ['v_kickroll', {
            read: () => controller.kickRoll,
            write: (value) => {
                controller.kickRoll = value;
            }
        }],
        ['v_kicktime', {
            read: () => controller.kickTime,
            write: (value) => {
                controller.kickTime = value;
            }
        }],
        ['v_centermove', {
            read: () => controller.centerMove,
            write: (value) => {
                controller.centerMove = value;
            }
        }],
        ['v_centerspeed', {
            read: () => controller.centerSpeed,
            write: (value) => {
                controller.centerSpeed = value;
            }
        }]
    ]);
    for (const [name, binding] of clientCvars) {
        const parameter = urlParameters.get(name);
        if (parameter === null) continue;
        const value = quakeStringToFloat(parameter);
        if (Number.isFinite(value)) binding.write(value);
    }
    const writeClientCvars = (url: URL): void => {
        for (const [name, binding] of clientCvars) {
            url.searchParams.set(name, String(binding.read()));
        }
        url.searchParams.set('_cl_name', playerName);
    };
    const keyBindings = new QuakeKeyBindings();
    if (menuCaptureScreen === 'keys') {
        quakeApplyBindingCommands(
            keyBindings,
            quakeCommandScript(loaded.pak.get('default.cfg'))
        );
    }
    const commandAliases = new Map<string, string>(QUAKE_DEFAULT_ALIASES);
    controller.serverDrivenJump = true;
    let quakeWorld = new QuakeWorldRuntime(
        vm,
        map,
        controller.collision,
        mapName,
        transitionState,
        loaded.pak,
        initialServerCvars,
        playerName
    );
    for (const line of startupConsoleLines) quakeWorld.printToConsole(`${line}\n`);
    const initialParticleViewRect = quakeViewLayout(
        captureViewSize ?? initialViewSize,
        quakeWorld.intermission !== 0
    ).viewRect;
    const particles = new ParticleRenderer(
        app,
        cameraEntity,
        palette,
        quakeWorld,
        initialParticleViewRect.width,
        initialParticleViewRect.height
    );
    centerMessageRuntime.world = quakeWorld;
    quakeWorld.centerMessageDuration = centerMessageDuration;
    const synchronizeClientViewCvars = (): void => {
        quakeWorld.viewKickPitch = controller.kickPitch;
        quakeWorld.viewKickRoll = controller.kickRoll;
        quakeWorld.viewKickTime = controller.kickTime;
    };
    synchronizeClientViewCvars();
    if (demoPlayback && demoStartup) {
        quakeWorld.applyDemoPlayback(demoPlayback, demoStartup.events, 0);
    }
    if (requestedSave) {
        quakeWorld.restoreSaveState(requestedSave.state);
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('load');
        cleanUrl.searchParams.set('map', mapName);
        window.history.replaceState(null, '', cleanUrl);
    }
    vm.setEntityString(quakeWorld.playerReference, 'netname', playerName);
    vm.setEntityFloat(quakeWorld.playerReference, 'team', playerBottomColor + 1);
    const writeRuntimeCvars = (url: URL): void => {
        writeClientCvars(url);
        url.searchParams.set('hostname', quakeWorld.cvarString('hostname') ?? 'UNNAMED');
    };
    controller.movementTrace = (start, end) => quakeWorld.tracePlayerMovement(start, end);
    controller.pointTrace = (start, end) => quakeWorld.traceLine(
        start, end, true, quakeWorld.playerReference
    ).trace;
    if (captureMode === 'spawn' || captureMode === 'paused' || captureMode === 'loading') {
        const spawnPose = quakeMapSpawnPose(map);
        quakeWorld.setPlayerPose(spawnPose.origin, spawnPose.angles);
    }
    if ((captureMode === 'pose' || captureMode === 'shot' ||
        captureMode === 'button-door' || captureMode === 'silver-key-door' ||
        captureMode === 'secret-door-shot' || captureMode === 'trigger-secret-door' ||
        captureMode === 'touch-trigger-door' ||
        captureMode === 'axe-hit' || captureMode === 'shoot-trigger-door' ||
        captureMode === 'start-stairs' ||
        captureMode === 'tutorial-message' ||
        captureMode === 'lightning' || captureMode === 'shambler-lightning' ||
        captureMode === 'wizard-tracer' ||
        captureMode === 'nailgun-flight' ||
        captureMode === 'patrol' || captureMode === 'platform-ride' ||
        captureMode === 'explobox' ||
        captureMode === 'dog-leap' || captureMode === 'dog-death' ||
        captureMode === 'drowning-bubble' || captureMode === 'player-death' ||
        captureMode === 'soldier-death' ||
        rocketCaptureMode || grenadeCaptureMode || ogreGrenadeCaptureMode ||
        soldierGibCaptureMode || paletteCaptureMode) && capturePose) {
        quakeWorld.setPlayerPose(capturePose.origin, capturePose.angles);
    }
    if (captureMode === 'intermission') {
        const exitIndex = map.entities.findIndex(
            entity => entity.classname === 'trigger_changelevel'
        );
        const exit = quakeWorld.entityReferences[exitIndex];
        if (exit === null || exit === undefined) {
            throw new Error('E1M1 intermission capture requires trigger_changelevel');
        }
        const exitOrigin = vm.getEntityVector(exit, 'origin');
        const exitMins = vm.getEntityVector(exit, 'mins');
        const exitMaxs = vm.getEntityVector(exit, 'maxs');
        const exitCenter = exitOrigin.map(
            (component, axis) => component + (exitMins[axis] + exitMaxs[axis]) / 2
        ) as Vec3;
        const captureState = {
            angles: [0, 0, 0] as Vec3,
            attack: false,
            jump: false,
            onGround: true,
            origin: exitCenter,
            velocity: [0, 0, 0] as Vec3
        };
        quakeWorld.update(0.01, captureState);
        quakeWorld.update(0.1, captureState);
        if (capturePose) {
            quakeWorld.setPlayerPose(capturePose.origin, capturePose.angles);
        }
    }
    if (captureMode === 'finale') {
        if (mapName !== 'e1m7') {
            throw new Error('capture=finale requires map=e1m7');
        }
        const finaleView = map.entities.find(
            entity => entity.classname === 'info_intermission'
        );
        if (!finaleView?.origin || !finaleView.mangle) {
            throw new Error('E1M7 finale capture requires info_intermission');
        }
        quakeWorld.setPlayerPose(
            parseVector(finaleView.origin),
            parseVector(finaleView.mangle)
        );
        vm.setEntityVector(quakeWorld.playerReference, 'view_ofs', [0, 0, 0]);
        vm.setGlobalString('nextmap', 'start');
        vm.setGlobalFloat('intermission_running', 1);
        vm.setGlobalFloat('intermission_exittime', quakeWorld.time);
        vm.setGlobalWord('self', quakeWorld.playerReference);
        vm.setEntityFloat(quakeWorld.playerReference, 'button0', 1);
        vm.execute('IntermissionThink');
        vm.setEntityFloat(quakeWorld.playerReference, 'button0', 0);
        if (quakeWorld.intermission !== 2) {
            throw new Error('E1M7 QuakeC did not enter the finale state');
        }
    }
    if (captureMode === 'shot' && capturePose) {
        const shotState = {
            angles: capturePose.angles,
            attack: false,
            jump: false,
            onGround: true,
            origin: capturePose.origin,
            velocity: [0, 0, 0] as Vec3
        };
        for (let frame = 0; frame < 20; frame++) {
            quakeWorld.update(0.05, shotState);
        }
        quakeWorld.update(0.05, { ...shotState, attack: true });
        quakeWorld.setPlayerPose(capturePose.origin, capturePose.angles);
    }
    if (captureMode === 'secret-door-shot' && capturePose) {
        prepareQuakeSecretDoorShotCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'trigger-secret-door' && capturePose) {
        prepareQuakeTriggeredSecretDoorCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'touch-trigger-door' && capturePose) {
        prepareQuakeTouchTriggerDoorCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'light-door' && capturePose) {
        prepareQuakeLightDoorCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'axe-hit' && capturePose) {
        prepareQuakeAxeHitCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'shoot-trigger-door' && capturePose) {
        prepareQuakeShootableTriggerDoorCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'start-stairs' && capturePose) {
        prepareQuakeStartStairsCapture(
            quakeWorld,
            controller,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'tutorial-message' && capturePose) {
        prepareQuakeTutorialMessageCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles,
            tutorialTarget
        );
    }
    if (captureMode === 'button-door' && capturePose) {
        prepareQuakeButtonDoorCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'silver-key-door' && capturePose) {
        prepareQuakeSilverKeyDoorCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (paletteCaptureMode && capturePose) {
        prepareQuakePaletteCapture(
            quakeWorld,
            paletteCaptureMode,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'weapon-pickup' && capturePose) {
        prepareQuakeWeaponPickupCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'lightning' && capturePose) {
        prepareQuakeLightningCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'patrol' && capturePose) {
        prepareQuakePatrolCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'dog-leap' && capturePose) {
        prepareQuakeDogLeapCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'drowning-bubble' && capturePose) {
        prepareQuakeDrowningBubbleCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles,
            drowningBubbleFrame
        );
    }
    if (captureMode === 'player-death' && capturePose) {
        prepareQuakePlayerDeathCapture(
            quakeWorld,
            controller,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'knight-melee' && capturePose) {
        prepareQuakeKnightMeleeCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    if (captureMode === 'shambler-lightning' && capturePose) {
        prepareQuakeShamblerLightningCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        );
    }
    const wizardTracerCaptureState = captureMode === 'wizard-tracer' && capturePose ?
        prepareQuakeWizardTracerCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        ) : undefined;
    const dogDeathCaptureState = captureMode === 'dog-death' && capturePose ?
        prepareQuakeDogDeathCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        ) : undefined;
    const exploboxCaptureState = captureMode === 'explobox' && capturePose ?
        prepareQuakeExploboxCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        ) : undefined;
    const nailgunCaptureState = captureMode === 'nailgun-flight' && capturePose ?
        prepareQuakeNailgunCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        ) : undefined;
    const platformCaptureState = captureMode === 'platform-ride' && capturePose ?
        prepareQuakePlatformCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        ) : undefined;
    const rocketCaptureState = rocketCaptureMode && capturePose ?
        prepareQuakeRocketCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        ) : undefined;
    const grenadeCaptureState = grenadeCaptureMode && capturePose ?
        prepareQuakeGrenadeCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        ) : undefined;
    const ogreGrenadeCaptureState = ogreGrenadeCaptureMode && capturePose ?
        prepareQuakeOgreGrenadeCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        ) : undefined;
    const soldierGibCaptureState = soldierGibCaptureMode && capturePose ?
        prepareQuakeSoldierGibCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        ) : undefined;
    const soldierDeathCaptureState = captureMode === 'soldier-death' && capturePose ?
        prepareQuakeSoldierDeathCapture(
            quakeWorld,
            capturePose.origin,
            capturePose.angles
        ) : undefined;
    const teleportCaptureMode = captureMode === 'teleport' ||
        captureMode === 'teleport-fog';
    let teleportCaptureResult: QuakePlayerResult | undefined;
    if (teleportCaptureMode) {
        const immediateTeleportResult = prepareQuakeTeleportCapture(quakeWorld);
        controller.applyServerState(immediateTeleportResult, false);
        controller.beginFrame(0.01);
        teleportCaptureResult = quakeWorld.update(
            0.01,
            controller.playerState(),
            (preMoveState) => {
                controller.applyServerState(preMoveState, false);
                controller.finishFrame(false);
                return controller.playerState();
            }
        );
        quakeWorld.setSnapshotTime(QUAKE_TELEPORT_CAPTURE_TIME);
    }
    controller.applyServerState(teleportCaptureResult ?? quakeWorld.playerResult());
    let world = new WorldRenderer(
        app,
        map,
        palette,
        loaded.pak.get('gfx/colormap.lmp'),
        quakeWorld
    );
    let worldAliases = new WorldAliasRenderer(app, loaded.pak, palette, quakeWorld);
    let beams = new BeamRenderer(app, loaded.pak, palette, quakeWorld);
    let worldSprites = new WorldSpriteRenderer(
        app, cameraEntity, loaded.pak, palette, quakeWorld
    );
    let worldBrushes = new WorldBrushEntityRenderer(app, loaded.pak, palette, quakeWorld);
    if (captureMode === 'teleport-fog') {
        particles.update(0.01);
        particles.update(0.01);
        particles.update(0);
    }
    if (captureMode === 'shot' || captureMode === 'secret-door-shot' ||
        captureMode === 'axe-hit' || captureMode === 'shoot-trigger-door') {
        particles.update(0);
    }
    if (soldierDeathCaptureState) {
        particles.update(0);
        for (let frame = 0; frame < QUAKE_SOLDIER_DEATH_CAPTURE_FRAMES; frame++) {
            advanceQuakeSoldierDeathCapture(quakeWorld, soldierDeathCaptureState);
            worldAliases.update(quakeWorld.time);
            particles.update(0.05);
        }
        controller.applyServerState(quakeWorld.playerResult());
    }
    if (dogDeathCaptureState) {
        particles.update(0);
        for (let frame = 0; frame < QUAKE_DOG_DEATH_CAPTURE_FRAMES; frame++) {
            advanceQuakeDogDeathCapture(quakeWorld, dogDeathCaptureState);
            worldAliases.update(quakeWorld.time);
            particles.update(0.05);
        }
        controller.applyServerState(quakeWorld.playerResult());
    }
    if (exploboxCaptureState) {
        particles.update(0);
        for (let frame = 0; frame < QUAKE_EXPLOBOX_CAPTURE_FRAMES; frame++) {
            advanceQuakeExploboxCapture(quakeWorld, exploboxCaptureState);
            worldSprites.update(quakeWorld.time);
            particles.update(0.05);
        }
        controller.applyServerState(quakeWorld.playerResult());
    }
    if (nailgunCaptureState) {
        for (let frame = 0; frame < QUAKE_NAILGUN_CAPTURE_FRAMES; frame++) {
            advanceQuakeNailgunCapture(quakeWorld, nailgunCaptureState);
            worldAliases.update(quakeWorld.time);
        }
        controller.applyServerState(quakeWorld.playerResult());
    }
    if (wizardTracerCaptureState) {
        for (let frame = 0; frame < QUAKE_WIZARD_TRACER_CAPTURE_FRAMES; frame++) {
            advanceQuakeWizardTracerCapture(quakeWorld, wizardTracerCaptureState);
            worldAliases.update(quakeWorld.time);
            particles.update(0);
        }
        controller.applyServerState(quakeWorld.playerResult());
    }
    if (platformCaptureState) {
        for (let frame = 0; frame < QUAKE_PLATFORM_CAPTURE_FRAMES; frame++) {
            advanceQuakePlatformCapture(quakeWorld, platformCaptureState);
        }
        controller.applyServerState(quakeWorld.playerResult());
    }
    if (rocketCaptureState) {
        const flightFrames = rocketCaptureMode === 'rocket-flight' ? 4 : 1;
        for (let frame = 0; frame < flightFrames; frame++) {
            advanceQuakeRocketCapture(quakeWorld, rocketCaptureState, 'flight');
            worldAliases.update(quakeWorld.time);
            const finalFlightFrame = rocketCaptureMode === 'rocket-flight' &&
                frame === flightFrames - 1;
            particles.update(finalFlightFrame ? 0 : 0.05);
        }
        if (rocketCaptureMode === 'rocket-impact') {
            advanceQuakeRocketCapture(quakeWorld, rocketCaptureState, 'impact');
            worldAliases.update(quakeWorld.time);
            particles.update(0.05);
            particles.update(0);
            settleQuakePausedCapturePalette(quakeWorld);
        }
        controller.applyServerState(quakeWorld.playerResult());
    }
    if (grenadeCaptureState && grenadeCaptureMode) {
        const phase = grenadeCaptureMode === 'grenade-flight' ? 'flight' :
            grenadeCaptureMode === 'grenade-bounce' ? 'bounce' : 'explosion';
        const targetFrame = QUAKE_GRENADE_CAPTURE_FRAMES[phase];
        for (let frame = 1; frame <= targetFrame; frame++) {
            const finalFrame = frame === targetFrame;
            const explosionWasEmitted = grenadeCaptureState.explosionEmitted;
            advanceQuakeGrenadeCapture(
                quakeWorld,
                grenadeCaptureState,
                finalFrame ? phase : undefined
            );
            worldAliases.update(quakeWorld.time);
            if (finalFrame && phase === 'explosion') {
                if (!explosionWasEmitted) particles.update(0.05);
                particles.update(0);
            } else {
                particles.update(finalFrame ? 0 : 0.05);
            }
        }
        controller.applyServerState(quakeWorld.playerResult());
    }
    if (ogreGrenadeCaptureState && ogreGrenadeCaptureMode) {
        const phase = ogreGrenadeCaptureMode === 'ogre-grenade-flight' ?
            'flight' : 'impact';
        const targetFrame = QUAKE_OGRE_GRENADE_CAPTURE_FRAMES[phase];
        for (let frame = 1; frame <= targetFrame; frame++) {
            const finalFrame = frame === targetFrame;
            const explosionWasEmitted = ogreGrenadeCaptureState.explosionEmitted;
            advanceQuakeOgreGrenadeCapture(
                quakeWorld,
                ogreGrenadeCaptureState,
                finalFrame ? phase : undefined
            );
            worldAliases.update(quakeWorld.time);
            if (finalFrame && phase === 'impact') {
                if (!explosionWasEmitted) particles.update(0.05);
                particles.update(0);
            } else {
                particles.update(finalFrame ? 0 : 0.05);
            }
        }
        controller.applyServerState(quakeWorld.playerResult());
    }
    if (soldierGibCaptureState && soldierGibCaptureMode) {
        const phase = soldierGibCaptureMode === 'soldier-gib-impact' ?
            'impact' : 'trail';
        const targetFrame = QUAKE_SOLDIER_GIB_CAPTURE_FRAMES[phase];
        for (let frame = 1; frame <= targetFrame; frame++) {
            const capturePhase = frame === QUAKE_SOLDIER_GIB_CAPTURE_FRAMES.impact ?
                'impact' : frame === targetFrame && phase === 'trail' ? 'trail' : undefined;
            advanceQuakeSoldierGibCapture(
                quakeWorld,
                soldierGibCaptureState,
                capturePhase
            );
            worldAliases.update(quakeWorld.time);
            const finalFrame = frame === targetFrame;
            if (finalFrame && phase === 'impact') {
                particles.update(0.05);
                particles.update(0);
            } else {
                particles.update(finalFrame ? 0 : 0.05);
            }
        }
        controller.applyServerState(quakeWorld.playerResult());
    }
    const viewModel = new ViewModelRenderer(app, cameraEntity, loaded.pak, palette, quakeWorld);
    const captureFrozen = captureMode === 'console' || menuCaptureScreen !== undefined ||
        captureMode === 'intermission' || captureMode === 'finale' ||
        captureMode === 'pose' ||
        captureMode === 'shot' || captureMode === 'button-door' ||
        captureMode === 'silver-key-door' ||
        captureMode === 'secret-door-shot' || captureMode === 'trigger-secret-door' ||
        captureMode === 'touch-trigger-door' || captureMode === 'light-door' ||
        captureMode === 'axe-hit' || captureMode === 'shoot-trigger-door' ||
        captureMode === 'start-stairs' ||
        captureMode === 'tutorial-message' ||
        captureMode === 'lightning' ||
        captureMode === 'nailgun-flight' || captureMode === 'patrol' ||
        captureMode === 'platform-ride' || captureMode === 'dog-leap' ||
        captureMode === 'drowning-bubble' || captureMode === 'player-death' ||
        captureMode === 'knight-melee' ||
        captureMode === 'shambler-lightning' ||
        captureMode === 'wizard-tracer' ||
        captureMode === 'explobox' ||
        captureMode === 'dog-death' || captureMode === 'soldier-death' ||
        captureMode === 'weapon-pickup' ||
        rocketCaptureMode ||
        grenadeCaptureMode || ogreGrenadeCaptureMode || soldierGibCaptureMode ||
        captureMode === 'spawn' || captureMode === 'paused' || captureMode === 'loading' ||
        teleportCaptureMode ||
        paletteCaptureMode !== undefined;
    const defaultCaptureTime = captureMode === 'finale' ? 60 :
        captureMode === 'menu-multiplayer' ? 0 :
            captureMode === 'menu-singleplayer' || captureMode === 'menu-load' ||
                captureMode === 'menu-save' ? 0.3 :
                captureMode === 'pose' || paletteCaptureMode ? 1 : 0.2;
    const captureTimeParameter = Number(
        urlParameters.get('captureTime') ?? defaultCaptureTime
    );
    const captureTime = Number.isFinite(captureTimeParameter) ?
        Math.max(0, captureTimeParameter) : defaultCaptureTime;
    const captureViewTimeParameter = Number(urlParameters.get('captureViewTime'));
    const captureViewTime = urlParameters.get('captureViewTime') !== null &&
        Number.isFinite(captureViewTimeParameter) ?
        Math.max(0, captureViewTimeParameter) : undefined;
    const intermissionCaptureTime = captureMode === 'intermission' &&
        urlParameters.get('captureTime') !== null ? captureTime :
        captureMode === 'finale' ? captureViewTime : undefined;
    if (captureMode === 'finale') {
        quakeWorld.completedTime = quakeWorld.time - captureTime;
    }
    if (captureMode === 'pose') {
        quakeWorld.setSnapshotTime(captureTime);
    } else if (paletteCaptureMode) {
        setQuakePaletteCaptureTime(quakeWorld, paletteCaptureMode, captureTime);
    }
    controller.synchronizeClientTime(quakeWorld.time);
    const frozenPlayerState = quakeWorld.playerResult();
    controller.applyServerState(
        capturePose && (rocketCaptureMode || grenadeCaptureMode ||
            ogreGrenadeCaptureMode) ? {
                ...frozenPlayerState,
                // The client renders the once-decoded setangle, while the server's
                // following user command packet supplies QuakeC's twice-decoded angle.
                angles: capturePose.angles.map(quakeProtocolAngle) as Vec3,
                fixAngle: true
            } : frozenPlayerState
    );
    const commandHistory: string[] = [];
    let commandHistoryIndex = 0;
    let changingLevel = false;
    let pendingNewGame = false;
    let pendingMapName: string | undefined;
    let consoleHeight = captureMode === 'console' ? 100 : 0;
    let consoleInput = '';
    let consoleOpen = captureMode === 'console';
    let consoleForced = false;
    let elapsed = demoPlayback ? demoPlayback.clientTime :
        requestedSave ? Math.max(0, quakeWorld.time - 1) :
            captureMode === 'player-death' ? quakeWorld.time : 0;
    let hostTime = captureMode === 'console' || menuCaptureScreen !== undefined ? captureTime : 0;
    let menuPage = 0;
    let menuScreen: HudMenuState['screen'] | undefined = menuCaptureScreen;
    const menuCursors = new QuakeMenuCursorState();
    let menuCursor = menuScreen ? menuCursors.cursor(menuScreen) : 0;
    let quitPreviousMenu: HudMenuState['previous'];
    let menuBindingGrab = false;
    controller.pointerLockAllowed = () => menuScreen === undefined && !consoleOpen;
    let setupHostName = quakePlayerName(quakeWorld.cvarString('hostname') ?? 'UNNAMED');
    let setupPlayerName = playerName;
    let setupTopColor = playerTopColor;
    let setupBottomColor = playerBottomColor;
    let saveSlots: Array<QuakeSaveSlot | undefined> =
        quakeMenuCaptureUsesEmptySaveSlots(menuCaptureScreen) ?
            new Array<QuakeSaveSlot | undefined>(QUAKE_SAVE_SLOT_COUNT).fill(undefined) :
            quakeReadSaveSlots(localStorage);
    let paused = captureMode === 'paused';
    let musicVolume = Math.max(0, Math.min(1, initialMusicVolume));
    let soundVolume = initialSoundVolume;
    let simulationAdvanced = false;
    let showingScores = false;
    let viewSize = captureViewSize ?? initialViewSize;
    if (captureMode === 'console' || menuCaptureScreen !== undefined ||
        captureMode === 'intermission' ||
        captureMode === 'finale' ||
        captureMode === 'spawn' || captureMode === 'paused' || captureMode === 'loading' ||
        captureMode === 'pose' || captureMode === 'shot' ||
        captureMode === 'button-door' || captureMode === 'silver-key-door' ||
        captureMode === 'secret-door-shot' || captureMode === 'trigger-secret-door' ||
        captureMode === 'touch-trigger-door' || captureMode === 'light-door' ||
        captureMode === 'axe-hit' || captureMode === 'shoot-trigger-door' ||
        captureMode === 'start-stairs' ||
        captureMode === 'explobox' ||
        captureMode === 'tutorial-message' ||
        captureMode === 'lightning' || captureMode === 'patrol' ||
        captureMode === 'dog-leap' || captureMode === 'dog-death' ||
        captureMode === 'drowning-bubble' || captureMode === 'player-death' ||
        captureMode === 'knight-melee' ||
        captureMode === 'shambler-lightning' ||
        captureMode === 'wizard-tracer' ||
        captureMode === 'soldier-death' ||
        rocketCaptureMode ||
        grenadeCaptureMode || ogreGrenadeCaptureMode || soldierGibCaptureMode ||
        teleportCaptureMode || paletteCaptureMode) {
        quakeWorld.clearConsole();
    }
    let viewLayout = quakeViewLayout(viewSize);
    let viewLayoutSignature = '';
    const stage = gameCanvas.parentElement;
    if (!stage) {
        throw new Error('Quake game canvas requires a stage element');
    }
    const resizeGameCanvas = (): void => {
        const displaySize = quakeCanvasDisplaySize(
            stage.clientWidth,
            stage.clientHeight,
            viewLayout.viewRect
        );
        // AppBase.resizeCanvas writes fixed pixel CSS dimensions. Keep the
        // authored percentage layout responsive and resize only the WebGL
        // backing buffer to the current stage-derived display size.
        app.graphicsDevice.resizeCanvas(displaySize.width, displaySize.height);
        particles.setQuakeViewportSize(
            viewLayout.viewRect.width,
            viewLayout.viewRect.height,
            displaySize.width
        );
    };
    const updateViewLayout = (): void => {
        const signature = `${viewSize}:${fieldOfView}:${quakeWorld.intermission !== 0}`;
        if (signature === viewLayoutSignature) {
            return;
        }
        viewLayoutSignature = signature;
        viewLayout = quakeViewLayout(viewSize, quakeWorld.intermission !== 0);
        const { viewRect } = viewLayout;
        camera.rect = new Vec4(0, 0, 1, 1);
        gameCanvas.style.left = `${viewRect.x / 3.2}%`;
        gameCanvas.style.top = `${viewRect.y / 2}%`;
        gameCanvas.style.right = 'auto';
        gameCanvas.style.bottom = 'auto';
        gameCanvas.style.width = `${viewRect.width / 3.2}%`;
        gameCanvas.style.height = `${viewRect.height / 2}%`;
        resizeGameCanvas();
        configureQuakeProjection(
            camera,
            viewRect.width,
            viewRect.height,
            fieldOfView
        );
    };
    updateViewLayout();
    let paletteSignature = '';
    const updatePaletteConsumers = (
        adjustedPalette: Uint8Array<ArrayBufferLike>
    ): void => {
        hud.setPalette(adjustedPalette);
        world.setPalette(adjustedPalette);
        worldAliases.setPalette(adjustedPalette);
        beams.setPalette(adjustedPalette);
        worldSprites.setPalette(adjustedPalette);
        worldBrushes.setPalette(adjustedPalette);
        particles.setPalette(adjustedPalette);
        viewModel.setPalette(adjustedPalette);
    };
    const refreshPalette = (): void => {
        const shifts = quakeWorld.viewPaletteShifts(controller.viewLightingOrigin());
        const signature = `${gamma}|${shifts.map(shift => (
            `${Math.trunc(shift.percent)}:${shift.color.join(',')}`
        )).join('|')}`;
        if (signature === paletteSignature) {
            return;
        }
        paletteSignature = signature;
        updatePaletteConsumers(applyQuakePaletteShifts(
            originalPalette, shifts, gamma
        ));
    };
    const updateGamma = (value: number): void => {
        gamma = Math.max(0.3, Math.min(1, value));
        paletteSignature = '';
        refreshPalette();
    };
    refreshPalette();
    const drawHud = (): void => {
        const clientData = quakeWorld.clientData();
        const health = clientData.health;
        const statistics = {
            levelName: vm.getEntityString(0, 'message') || 'The Slipgate Complex',
            monsters: vm.getGlobalFloat('killed_monsters'),
            secrets: vm.getGlobalFloat('found_secrets'),
            time: quakeWorld.intermission === 0 ? elapsed : quakeWorld.completedTime,
            totalMonsters: vm.getGlobalFloat('total_monsters'),
            totalSecrets: vm.getGlobalFloat('total_secrets')
        };
        hud.draw({
            activeWeapon: clientData.activeWeapon,
            ammo: clientData.ammo,
            ammoCells: clientData.ammoCells,
            ammoNails: clientData.ammoNails,
            ammoRockets: clientData.ammoRockets,
            ammoShells: clientData.ammoShells,
            armor: clientData.armor,
            centerMessage: quakeWorld.visibleCenterMessage(),
            console: consoleHeight > 0 ? {
                height: consoleHeight,
                input: consoleInput,
                lines: quakeWorld.visibleConsoleLines(),
                time: hostTime
            } : undefined,
            crosshair: crosshair !== 0,
            crosshairOffsetX,
            crosshairOffsetY,
            finale: quakeWorld.intermission >= 2 && !menuScreen && consoleHeight === 0 ? {
                message: quakeWorld.centerMessage,
                printSpeed: finalePrintSpeed,
                showPlaque: quakeWorld.intermission === 2,
                time: Math.max(0, quakeWorld.time - quakeWorld.completedTime)
            } : undefined,
            health,
            intermission: quakeWorld.intermission === 1 && !menuScreen && consoleHeight === 0 ?
                statistics : undefined,
            itemGetTimes: quakeWorld.itemGetTimes,
            items: clientData.items,
            loading: captureMode === 'loading',
            menu: menuScreen ? {
                bindingGrab: menuBindingGrab,
                cursor: menuCursor,
                keyBindings: menuScreen === 'keys' ? QUAKE_KEY_MENU_COMMANDS.map(
                    ([command, label]) => ({
                        keys: keyBindings.keysForCommand(command),
                        label
                    })
                ) : undefined,
                page: menuPage,
                previous: menuScreen === 'quit' ? quitPreviousMenu : undefined,
                saveSlots: menuScreen === 'load' || menuScreen === 'save' ?
                    saveSlots.map(slot => slot?.comment ?? QUAKE_UNUSED_SAVE_SLOT) : undefined,
                screen: menuScreen,
                setup: menuScreen === 'setup' ? {
                    bottomColor: setupBottomColor,
                    hostName: setupHostName,
                    playerName: setupPlayerName,
                    topColor: setupTopColor
                } : undefined,
                settings: {
                    alwaysRun: controller.alwaysRun,
                    brightness: Math.max(0, Math.min(1, (1 - gamma) / 0.5)),
                    invertMouse: controller.invertMouse,
                    lookSpring: controller.lookSpring !== 0,
                    lookStrafe: controller.lookStrafe !== 0,
                    mouseSpeed: controller.sensitivity,
                    musicVolume,
                    screenSize: viewSize,
                    soundVolume
                },
                time: hostTime
            } : undefined,
            notifyLines: quakeWorld.visibleNotifyLines(),
            pain: quakeWorld.time <= quakeWorld.faceAnimationUntil,
            paused: paused && showPause !== 0,
            scoreboard: quakeWorld.intermission === 0 && (showingScores || health <= 0) ?
                statistics : undefined,
            statusBarLines: viewLayout.statusBarLines,
            viewRect: viewLayout.viewRect,
            time: quakeWorld.time
        });
    };
    drawHud();
    const composeFrame = (): HTMLCanvasElement => {
        const output = document.createElement('canvas');
        output.width = screenCanvas.width;
        output.height = screenCanvas.height;
        const context = output.getContext('2d');
        if (!context) {
            throw new Error('Could not create the screenshot compositor');
        }
        context.imageSmoothingEnabled = false;
        context.fillStyle = '#000';
        context.fillRect(0, 0, output.width, output.height);
        context.drawImage(
            gameCanvas,
            viewLayout.viewRect.x,
            viewLayout.viewRect.y,
            viewLayout.viewRect.width,
            viewLayout.viewRect.height
        );
        context.drawImage(screenCanvas, 0, 0);
        return output;
    };
    const drawAndPersistLoadingPlaque = (): void => {
        hud.drawLoading();
        try {
            sessionStorage.setItem(
                QUAKE_LOADING_FRAME_STORAGE_KEY,
                composeFrame().toDataURL('image/png')
            );
        } catch {
            sessionStorage.removeItem(QUAKE_LOADING_FRAME_STORAGE_KEY);
        }
    };
    let screenshotIndex = 0;
    let screenshotPending = false;
    const saveScreenshot = (): void => {
        if (screenshotPending) return;
        const name = quakeScreenshotName(screenshotIndex);
        if (!name) {
            quakeWorld.printToConsole('SCR_ScreenShot_f: Couldn\'t create a PNG file\n');
            return;
        }
        screenshotPending = true;
        const captureScreenshot = (): void => {
            app.off('frameend', captureScreenshot);
            const link = document.createElement('a');
            const png = composeFrame().toDataURL('image/png');
            link.download = name;
            link.href = png;
            link.hidden = true;
            document.body.appendChild(link);
            link.click();
            link.remove();
            screenCanvas.dataset.screenshotName = name;
            screenCanvas.dataset.screenshotReady = '1';
            screenCanvas.textContent = png;
            screenshotIndex++;
            screenshotPending = false;
            quakeWorld.printToConsole(`Wrote ${name}\n`);
        };
        app.on('frameend', captureScreenshot);
    };
    onStatus('Decoding original ambient audio…');
    const audio = new QuakeAudioSystem(loaded.pak, map, quakeWorld, gameCanvas);
    const cdAudio = new QuakeCdAudioController(
        audio,
        text => quakeWorld.printToConsole(text)
    );
    audio.masterGain.gain.value = soundVolume;
    audio.setMusicVolume(musicVolume);
    audio.ambientLevel = initialAmbientLevel;
    audio.ambientFade = initialAmbientFade;
    const requestedMusicTrack = quakeCdTrackNumber(
        demoPlayback && demoPlayback.demo.forcedTrack !== -1 ?
            demoPlayback.demo.forcedTrack : demoPlayback?.client.cdTrack ??
                vm.getEntityFloat(0, 'sounds')
    );
    const audioInitialization = audio.initialize();
    cdAudio.playTrack(requestedMusicTrack, true).catch((error) => {
        console.warn('Could not initialize optional Quake music', error);
    });
    if (capturePngEnabled) {
        audioInitialization.catch((error) => {
            console.error('Could not initialize Quake capture audio', error);
        });
    } else {
        await audioInitialization;
    }
    const updateMusicVolume = (value: number): void => {
        audio.setMusicVolume(value);
        musicVolume = audio.musicVolume;
    };
    const updateSoundVolume = (value: number): void => {
        soundVolume = value;
        audio.masterGain.gain.value = value;
    };
    const adjustOptions = (direction: number): void => {
        switch (menuCursor) {
            case 3:
                viewSize = quakeMenuViewSize(viewSize, direction);
                updateViewLayout();
                break;
            case 4:
                updateGamma(quakeMenuGamma(gamma, direction));
                break;
            case 5:
                controller.sensitivity = Math.max(
                    1, Math.min(11, controller.sensitivity + direction * 0.5)
                );
                break;
            case 6:
                updateMusicVolume(musicVolume + direction * 0.1);
                break;
            case 7:
                updateSoundVolume(Math.max(
                    0, Math.min(1, soundVolume + direction * 0.1)
                ));
                break;
            case 8:
                controller.alwaysRun = !controller.alwaysRun;
                break;
            case 9:
                controller.invertMouse = !controller.invertMouse;
                break;
            case 10:
                controller.lookSpring = controller.lookSpring === 0 ? 1 : 0;
                break;
            case 11:
                controller.lookStrafe = controller.lookStrafe === 0 ? 1 : 0;
                controller.mouseSideMove = 0;
                break;
        }
        audio.playLocal('misc/menu3.wav');
    };
    const saveGame = (name: string): boolean => {
        const normalizedName = quakeSaveName(name);
        if (!normalizedName) return false;
        try {
            const state = quakeWorld.createSaveState();
            const save = quakeCreateSaveSlot(state, quakeSaveComment(
                vm.getEntityString(0, 'message'),
                vm.getGlobalFloat('killed_monsters'),
                vm.getGlobalFloat('total_monsters')
            ));
            quakeWorld.printToConsole(`Saving game to ${normalizedName}.sav...\n`);
            quakeWriteSave(localStorage, normalizedName, save);
            const slot = quakeSaveSlotNumber(normalizedName);
            if (slot !== undefined) saveSlots[slot] = save;
            quakeWorld.printToConsole('done.\n');
            return true;
        } catch (error) {
            quakeWorld.printToConsole(`${
                error instanceof Error ? error.message : 'Could not save game'
            }\n`);
            return false;
        }
    };
    const saveGameToSlot = (slot: number): boolean => saveGame(`s${slot}`);
    const loadGame = (name: string): boolean => {
        const normalizedName = quakeSaveName(name);
        if (!normalizedName) return false;
        const save = quakeReadSave(localStorage, normalizedName);
        if (!save) return false;
        const targetMap = quakeMapName(save.state.mapName);
        const targetPath = targetMap ? quakeMapPath(targetMap) : undefined;
        if (!targetMap || !targetPath || !loaded.pak.has(targetPath)) {
            quakeWorld.printToConsole(`Could not load ${targetPath ?? save.state.mapName}\n`);
            return false;
        }
        changingLevel = true;
        menuScreen = undefined;
        drawAndPersistLoadingPlaque();
        const nextUrl = new URL(window.location.href);
        const showDebug = urlParameters.get('debug') === '1';
        nextUrl.search = '';
        nextUrl.searchParams.set('map', targetMap);
        nextUrl.searchParams.set('load', normalizedName);
        nextUrl.searchParams.set('gamma', String(gamma));
        nextUrl.searchParams.set('viewsize', String(viewSize));
        nextUrl.searchParams.set('volume', String(soundVolume));
        nextUrl.searchParams.set('bgmvolume', String(musicVolume));
        nextUrl.searchParams.set('ambient_level', String(audio.ambientLevel));
        nextUrl.searchParams.set('ambient_fade', String(audio.ambientFade));
        writeRuntimeCvars(nextUrl);
        if (showDebug) nextUrl.searchParams.set('debug', '1');
        window.location.assign(nextUrl);
        return true;
    };
    const loadGameFromSlot = (slot: number): boolean => loadGame(`s${slot}`);
    const navigateToDemo = (
        path: string,
        loopState?: QuakeDemoLoopState,
        timedemo = false
    ): void => {
        changingLevel = true;
        menuScreen = undefined;
        drawAndPersistLoadingPlaque();
        const nextUrl = new URL(window.location.href);
        const showDebug = urlParameters.get('debug') === '1';
        nextUrl.search = '';
        nextUrl.searchParams.set('demo', path.slice(0, -4));
        if (timedemo) nextUrl.searchParams.set('timedemo', '1');
        if (loopState) {
            nextUrl.searchParams.set('attract', '1');
            nextUrl.searchParams.set('demos', loopState.demos.join(','));
            nextUrl.searchParams.set('demonum', String(loopState.nextIndex));
            sessionStorage.setItem(
                DEMO_LOOP_STORAGE_KEY, serializeQuakeDemoLoopState(loopState)
            );
        } else {
            sessionStorage.removeItem(DEMO_LOOP_STORAGE_KEY);
        }
        nextUrl.searchParams.set('gamma', String(gamma));
        nextUrl.searchParams.set('viewsize', String(viewSize));
        nextUrl.searchParams.set('volume', String(soundVolume));
        nextUrl.searchParams.set('bgmvolume', String(musicVolume));
        nextUrl.searchParams.set('ambient_level', String(audio.ambientLevel));
        nextUrl.searchParams.set('ambient_fade', String(audio.ambientFade));
        writeRuntimeCvars(nextUrl);
        if (showDebug) nextUrl.searchParams.set('debug', '1');
        window.location.assign(nextUrl);
    };
    const playDemo = (name: string, timedemo = false): boolean => {
        const path = quakeDemoPath(name);
        if (!path || !loaded.pak.has(path)) {
            quakeWorld.printToConsole(`ERROR: couldn't open ${path ?? name}\n`);
            return false;
        }
        activeDemoLoop = undefined;
        navigateToDemo(path, undefined, timedemo);
        return true;
    };
    const playNextDemo = (state: QuakeDemoLoopState): boolean => {
        const next = quakeNextDemo(state);
        if (!next) {
            quakeWorld.printToConsole('No demos listed with startdemos\n');
            activeDemoLoop = undefined;
            sessionStorage.removeItem(DEMO_LOOP_STORAGE_KEY);
            return false;
        }
        const path = quakeDemoPath(next.demo);
        if (!path || !loaded.pak.has(path)) {
            quakeWorld.printToConsole(`ERROR: couldn't open ${path ?? next.demo}\n`);
            activeDemoLoop = undefined;
            sessionStorage.removeItem(DEMO_LOOP_STORAGE_KEY);
            return false;
        }
        activeDemoLoop = next.state;
        navigateToDemo(path, next.state);
        return true;
    };
    const scoreButtonSources = new Set<string>();
    let demoLoopSavedForMenu = false;
    let savedDemoLoop: QuakeDemoLoopState | undefined;
    const disconnectDemoPlayback = (): void => {
        demoPlayback?.stop();
        activeDemoLoop = undefined;
        savedDemoLoop = undefined;
        demoLoopSavedForMenu = false;
        sessionStorage.removeItem(DEMO_LOOP_STORAGE_KEY);
    };
    const stopDemoPlayback = (): boolean => {
        if (!demoPlayback?.stop()) return false;
        audio.stopAllSounds(false);
        menuScreen = undefined;
        consoleOpen = true;
        consoleForced = true;
        consoleHeight = 200;
        scoreButtonSources.clear();
        showingScores = false;
        document.exitPointerLock();
        return true;
    };
    const setMenuScreen = (
        screen: HudMenuState['screen'] | undefined,
        cursor?: number
    ): void => {
        menuCursor = menuCursors.transition(menuScreen, menuCursor, screen, cursor);
        menuScreen = screen;
    };
    const setConsoleOpen = (open: boolean): void => {
        consoleOpen = open;
        if (open) {
            setMenuScreen(undefined);
            quitPreviousMenu = undefined;
            scoreButtonSources.clear();
            showingScores = false;
            document.exitPointerLock();
        }
    };
    const openMenuScreen = (
        screen: Exclude<typeof menuScreen, undefined>,
        cursor?: number
    ): void => {
        consoleOpen = false;
        consoleForced = false;
        menuBindingGrab = false;
        if (screen !== 'quit') quitPreviousMenu = undefined;
        setMenuScreen(screen, cursor);
        scoreButtonSources.clear();
        showingScores = false;
        document.exitPointerLock();
    };
    const openQuitMenu = (): void => {
        const previous = quakeQuitPreviousMenu(menuScreen, menuCursor, menuPage);
        openMenuScreen('quit');
        quitPreviousMenu = previous;
    };
    const closeQuitMenu = (): void => {
        const previous = quakeQuitReturnMenu(quitPreviousMenu);
        quitPreviousMenu = undefined;
        if (previous) {
            setMenuScreen(previous.screen, previous.cursor);
            menuPage = previous.page ?? 0;
        } else {
            setMenuScreen(undefined);
        }
    };
    const openSetupMenu = (): void => {
        setupHostName = quakePlayerName(quakeWorld.cvarString('hostname') ?? 'UNNAMED');
        setupPlayerName = playerName;
        setupTopColor = playerTopColor;
        setupBottomColor = playerBottomColor;
        openMenuScreen('setup');
    };
    const toggleMenu = (): void => {
        const opening = menuScreen === undefined;
        if (menuScreen === 'newgame') {
            setMenuScreen('singleplayer');
        } else if (menuScreen && menuScreen !== 'main') {
            setMenuScreen('main');
        } else if (menuScreen === 'main') {
            setMenuScreen(undefined);
            if (demoLoopSavedForMenu) {
                activeDemoLoop = savedDemoLoop;
                savedDemoLoop = undefined;
                demoLoopSavedForMenu = false;
            }
        } else {
            savedDemoLoop = activeDemoLoop;
            activeDemoLoop = undefined;
            demoLoopSavedForMenu = true;
            setMenuScreen('main');
            consoleOpen = false;
            scoreButtonSources.clear();
            showingScores = false;
            document.exitPointerLock();
        }
        audio.playLocal(opening ? 'misc/menu2.wav' : 'misc/menu1.wav');
    };
    let gamePointerLocked = document.pointerLockElement === gameCanvas;
    let suppressPointerLockEscapeUntil = 0;
    document.addEventListener('pointerlockchange', () => {
        const pointerLocked = document.pointerLockElement === gameCanvas;
        const pointerReleased = gamePointerLocked && !pointerLocked;
        gamePointerLocked = pointerLocked;
        if (!pointerReleased || menuScreen !== undefined || consoleOpen) return;
        suppressPointerLockEscapeUntil = performance.now() + 250;
        toggleMenu();
    });
    const commandBuffer = new QuakeCommandBuffer();
    const executeSingleCommand = (commandLine: string): void => {
        const [rawCommand, ...arguments_] = quakeCommandArguments(commandLine);
        if (!rawCommand) return;
        const command = rawCommand.toLowerCase();
        if (command.startsWith('+') || command.startsWith('-')) {
            const down = command.startsWith('+');
            const button = `+${command.slice(1)}`;
            const source = arguments_.at(-1) ?? 'console';
            if (button === '+showscores') {
                if (down) scoreButtonSources.add(source);
                else scoreButtonSources.delete(source);
                showingScores = scoreButtonSources.size > 0;
            } else {
                controller.setButtonState(button, source, down);
            }
            return;
        }
        switch (command) {
            case 'alias': {
                if (arguments_.length === 0) {
                    quakeWorld.printToConsole('Current alias commands:\n');
                    for (const [name, value] of commandAliases) {
                        quakeWorld.printToConsole(`${name} : ${value}\n`);
                    }
                    break;
                }
                const aliasName = quakeAliasName(arguments_[0]);
                if (!aliasName) {
                    quakeWorld.printToConsole('Alias name is too long\n');
                    break;
                }
                commandAliases.set(
                    aliasName.toLowerCase(),
                    arguments_.slice(1).join(' ')
                );
                break;
            }
            case 'ambient_fade': {
                if (arguments_[0] !== undefined) {
                    const value = quakeStringToFloat(arguments_[0]);
                    if (Number.isFinite(value)) audio.ambientFade = value;
                } else {
                    quakeWorld.printToConsole(
                        `"ambient_fade" is "${audio.ambientFade}"\n`
                    );
                }
                break;
            }
            case 'ambient_level': {
                if (arguments_[0] !== undefined) {
                    const value = quakeStringToFloat(arguments_[0]);
                    if (Number.isFinite(value)) audio.ambientLevel = value;
                } else {
                    quakeWorld.printToConsole(
                        `"ambient_level" is "${audio.ambientLevel}"\n`
                    );
                }
                break;
            }
            case 'bgmvolume': {
                if (arguments_[0] !== undefined) {
                    updateMusicVolume(quakeStringToFloat(arguments_[0]));
                } else {
                    quakeWorld.printToConsole(`"bgmvolume" is "${musicVolume}"\n`);
                }
                break;
            }
            case 'bind': {
                const key = arguments_[0];
                if (!key) {
                    quakeWorld.printToConsole('bind <key> [command] : attach a command to a key\n');
                    break;
                }
                if (arguments_.length === 1) {
                    const binding = keyBindings.binding(key);
                    quakeWorld.printToConsole(binding === undefined ?
                        `"${key}" is not bound\n` : `"${key}" = "${binding}"\n`);
                    break;
                }
                if (!keyBindings.bind(key, arguments_.slice(1).join(' '))) {
                    quakeWorld.printToConsole(`"${key}" isn't a valid key\n`);
                }
                break;
            }
            case 'cd':
                cdAudio.execute(arguments_).catch((error) => {
                    console.error('Could not execute Quake CD command', error);
                });
                break;
            case 'color': {
                if (arguments_.length === 0) {
                    quakeWorld.printToConsole(
                        `"color" is "${playerTopColor} ${playerBottomColor}"\n`
                    );
                    quakeWorld.printToConsole('color <0-13> [0-13]\n');
                    break;
                }
                const colors = quakePlayerColorsCommand(
                    arguments_, playerTopColor * 16 + playerBottomColor
                );
                playerTopColor = colors.top;
                playerBottomColor = colors.bottom;
                vm.setEntityFloat(quakeWorld.playerReference, 'team', playerBottomColor + 1);
                break;
            }
            case 'changelevel':
                if (!arguments_[0]) {
                    quakeWorld.printToConsole(
                        'changelevel <levelname> : continue game on a new level\n'
                    );
                } else {
                    quakeWorld.requestLevelTransition(arguments_[0]);
                }
                break;
            case 'clear':
                quakeWorld.clearConsole();
                break;
            case 'centerview':
                controller.startPitchDrift();
                break;
            case 'echo':
                quakeWorld.printToConsole(`${arguments_.join(' ')}\n`);
                break;
            case 'exec': {
                if (arguments_.length !== 1) {
                    quakeWorld.printToConsole(
                        'exec <filename> : execute a script file\n'
                    );
                    break;
                }
                const filename = arguments_[0];
                if (!loaded.pak.has(filename)) {
                    quakeWorld.printToConsole(`couldn't exec ${filename}\n`);
                    break;
                }
                quakeWorld.printToConsole(`execing ${filename}\n`);
                commandBuffer.insertText(
                    quakeCommandScript(loaded.pak.get(filename)),
                    executeSingleCommand
                );
                break;
            }
            case 'demos': {
                const stored = parseQuakeDemoLoopState(
                    sessionStorage.getItem(DEMO_LOOP_STORAGE_KEY)
                );
                const state = stored ?? activeDemoLoop;
                if (!state) {
                    quakeWorld.printToConsole('No demos listed with startdemos\n');
                    break;
                }
                playNextDemo({
                    demos: state.demos,
                    nextIndex: state.nextIndex === -1 ? 1 : state.nextIndex
                });
                break;
            }
            case 'gamma':
                if (arguments_[0] !== undefined) {
                    const requestedGamma = Number(arguments_[0]);
                    if (Number.isFinite(requestedGamma)) {
                        updateGamma(requestedGamma);
                    }
                } else {
                    quakeWorld.printToConsole(`"gamma" is "${gamma}"\n`);
                }
                break;
            case 'help':
                menuPage = 0;
                openMenuScreen('help');
                break;
            case 'god':
                quakeWorld.toggleGodMode();
                break;
            case 'notarget':
                quakeWorld.toggleNoTarget();
                break;
            case 'noclip': {
                const enabled = quakeWorld.toggleNoclip();
                if (enabled !== undefined) {
                    controller.noclipAngleHack = enabled;
                    controller.applyServerState(quakeWorld.playerResult(false));
                }
                break;
            }
            case 'fly': {
                const enabled = quakeWorld.toggleFly();
                if (enabled !== undefined) {
                    controller.applyServerState(quakeWorld.playerResult(false));
                }
                break;
            }
            case 'give':
                quakeWorld.givePlayer(
                    arguments_[0] ?? '',
                    quakeStringToFloat(arguments_[1] ?? '')
                );
                break;
            case 'pause':
                paused = !paused;
                break;
            case 'playdemo':
                if (arguments_.length !== 1) {
                    quakeWorld.printToConsole('playdemo <demoname> : plays a demo\n');
                } else {
                    playDemo(arguments_[0]);
                }
                break;
            case 'quit':
                if (consoleOpen) {
                    window.close();
                } else {
                    openQuitMenu();
                }
                break;
            case 'timedemo':
                if (arguments_.length !== 1) {
                    quakeWorld.printToConsole(
                        'timedemo <demoname> : gets demo speeds\n'
                    );
                } else {
                    playDemo(arguments_[0], true);
                }
                break;
            case 'restart':
                quakeWorld.requestRestart();
                break;
            case 'impulse': {
                const impulse = Number(arguments_[0]);
                if (Number.isFinite(impulse)) quakeWorld.setPlayerImpulse(impulse);
                break;
            }
            case 'kill':
                quakeWorld.killPlayer();
                break;
            case 'load': {
                const saveName = arguments_.length === 1 ?
                    quakeSaveName(arguments_[0]) : undefined;
                if (saveName === undefined) {
                    quakeWorld.printToConsole('load <savename> : load a game\n');
                } else if (!loadGame(saveName)) {
                    quakeWorld.printToConsole(
                        `ERROR: couldn't open ${saveName}.sav\n`
                    );
                }
                break;
            }
            case 'map': {
                if (arguments_.length < 1) {
                    quakeWorld.printToConsole('map <levelname> : start a new server\n');
                    break;
                }
                const targetMap = quakeMapName(arguments_[0]);
                const targetPath = targetMap ? quakeMapPath(targetMap) : undefined;
                if (!targetMap || !targetPath || !loaded.pak.has(targetPath)) {
                    quakeWorld.printToConsole(
                        `Could not load ${targetPath ?? arguments_[0]}\n`
                    );
                    break;
                }
                activeDemoLoop = undefined;
                sessionStorage.removeItem(DEMO_LOOP_STORAGE_KEY);
                pendingMapName = targetMap;
                break;
            }
            case 'menu_keys':
                openMenuScreen('keys');
                break;
            case 'menu_load':
                saveSlots = quakeReadSaveSlots(localStorage);
                openMenuScreen('load');
                break;
            case 'menu_main':
                openMenuScreen('main');
                break;
            case 'menu_multiplayer':
                openMenuScreen('multiplayer');
                break;
            case 'menu_options':
                openMenuScreen('options');
                break;
            case 'menu_quit':
                openQuitMenu();
                break;
            case 'menu_save':
                if (quakeWorld.intermission === 0) {
                    saveSlots = quakeReadSaveSlots(localStorage);
                    openMenuScreen('save');
                }
                break;
            case 'menu_setup':
                openSetupMenu();
                break;
            case 'menu_singleplayer':
                openMenuScreen('singleplayer');
                break;
            case 'menu_video':
                quakeWorld.printToConsole(
                    'Video menu is unavailable in this browser runtime.\n'
                );
                break;
            case '_cl_name':
                if (arguments_[0] !== undefined) {
                    playerName = quakePlayerName(arguments_[0]);
                } else {
                    quakeWorld.printToConsole(`"_cl_name" is "${playerName}"\n`);
                }
                break;
            case 'name':
                if (arguments_.length === 0) {
                    quakeWorld.printToConsole(`"name" is "${playerName}"\n`);
                    break;
                }
                playerName = quakePlayerNameCommand(arguments_, playerName);
                vm.setEntityString(quakeWorld.playerReference, 'netname', playerName);
                break;
            case 'save': {
                const saveName = arguments_.length === 1 ?
                    quakeSaveName(arguments_[0]) : undefined;
                if (saveName === undefined) {
                    quakeWorld.printToConsole('save <savename> : save a game\n');
                } else {
                    saveGame(saveName);
                }
                break;
            }
            case 'screenshot':
                saveScreenshot();
                break;
            case 'startdemos': {
                if (arguments_.length > QUAKE_MAX_DEMOS) {
                    quakeWorld.printToConsole(`Max ${QUAKE_MAX_DEMOS} demos in demoloop\n`);
                }
                const demos = quakeDemoLoopNames(arguments_);
                quakeWorld.printToConsole(`${demos.length} demo(s) in loop\n`);
                activeDemoLoop = undefined;
                sessionStorage.setItem(DEMO_LOOP_STORAGE_KEY, serializeQuakeDemoLoopState({
                    demos,
                    nextIndex: -1
                }));
                break;
            }
            case 'stopdemo':
                stopDemoPlayback();
                break;
            case 'stopsound':
                audio.stopAllSounds();
                break;
            case 'sizedown':
                viewSize = quakeMenuViewSize(viewSize, -1);
                updateViewLayout();
                break;
            case 'sizeup':
                viewSize = quakeMenuViewSize(viewSize, 1);
                updateViewLayout();
                break;
            case 'toggleconsole':
                setConsoleOpen(!consoleOpen);
                break;
            case 'togglemenu':
                toggleMenu();
                break;
            case 'unbind':
                if (!arguments_[0]) {
                    quakeWorld.printToConsole('unbind <key> : remove commands from a key\n');
                } else if (!keyBindings.unbind(arguments_[0])) {
                    quakeWorld.printToConsole(`"${arguments_[0]}" isn't a valid key\n`);
                }
                break;
            case 'unbindall':
                keyBindings.unbindAll();
                break;
            case 'version':
                quakeWorld.printToConsole('Quake PlayCanvas port / shareware data 1.06\n');
                break;
            case 'viewsize':
                if (arguments_[0] !== undefined) {
                    const requestedViewSize = Number(arguments_[0]);
                    if (Number.isFinite(requestedViewSize)) {
                        viewSize = Math.max(30, Math.min(120, requestedViewSize));
                        updateViewLayout();
                    }
                } else {
                    quakeWorld.printToConsole(`"viewsize" is "${viewSize}"\n`);
                }
                break;
            case 'volume':
                if (arguments_[0] !== undefined) {
                    const value = quakeStringToFloat(arguments_[0]);
                    if (Number.isFinite(value)) updateSoundVolume(value);
                } else {
                    quakeWorld.printToConsole(`"volume" is "${soundVolume}"\n`);
                }
                break;
            default: {
                const alias = commandAliases.get(command);
                if (alias !== undefined) {
                    commandBuffer.insertText(alias, executeSingleCommand);
                    break;
                }
                const cvarName = command;
                const clientCvar = clientCvars.get(cvarName);
                if (clientCvar) {
                    if (arguments_[0] !== undefined) {
                        const value = quakeStringToFloat(arguments_[0]);
                        if (Number.isFinite(value)) {
                            clientCvar.write(value);
                            if (cvarName === '_cl_color') {
                                vm.setEntityFloat(
                                    quakeWorld.playerReference,
                                    'team',
                                    playerBottomColor + 1
                                );
                            }
                        }
                    } else {
                        quakeWorld.printToConsole(
                            `"${cvarName}" is "${clientCvar.read()}"\n`
                        );
                    }
                    break;
                }
                if (quakeWorld.cvarString(cvarName) === undefined) {
                    quakeWorld.printToConsole(`Unknown command "${rawCommand}"\n`);
                    break;
                }
                if (arguments_[0] !== undefined) {
                    quakeWorld.setCvar(cvarName, arguments_[0]);
                } else {
                    quakeWorld.printToConsole(
                        `"${cvarName}" is "${quakeWorld.cvarString(cvarName)}"\n`
                    );
                }
                break;
            }
        }
    };
    const executeCommandText = (text: string): void => {
        commandBuffer.addText(text, executeSingleCommand);
    };
    const executeConsoleCommand = (): void => {
        const commandLine = consoleInput.trim();
        quakeWorld.printToConsole(`]${consoleInput}\n`);
        consoleInput = '';
        if (!commandLine) return;
        commandHistory.push(commandLine);
        commandHistoryIndex = commandHistory.length;
        executeCommandText(commandLine);
    };
    window.addEventListener('keydown', (event) => {
        const quakeKey = quakeKeyboardKeyName(event.code);
        if (menuScreen === 'keys') {
            event.preventDefault();
            const [command] = QUAKE_KEY_MENU_COMMANDS[menuCursor];
            if (menuBindingGrab) {
                if (!quakeKey) return;
                audio.playLocal('misc/menu1.wav');
                if (quakeKey !== 'ESCAPE' && quakeKey !== '`') {
                    keyBindings.bind(quakeKey, command);
                }
                menuBindingGrab = false;
                return;
            }
            if (event.code === 'Escape') {
                setMenuScreen('options');
                audio.playLocal('misc/menu1.wav');
            } else if ([
                'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'
            ].includes(event.code)) {
                const direction = event.code === 'ArrowDown' || event.code === 'ArrowRight' ?
                    1 : -1;
                menuCursor = (
                    menuCursor + direction + QUAKE_KEY_MENU_COMMANDS.length
                ) % QUAKE_KEY_MENU_COMMANDS.length;
                audio.playLocal('misc/menu1.wav');
            } else if (event.code === 'Enter') {
                if (keyBindings.keysForCommand(command).length === 2) {
                    keyBindings.unbindCommand(command);
                }
                menuBindingGrab = true;
                audio.playLocal('misc/menu2.wav');
            } else if (event.code === 'Backspace' || event.code === 'Delete') {
                keyBindings.unbindCommand(command);
                audio.playLocal('misc/menu2.wav');
            }
            return;
        }
        if (menuScreen === 'setup') {
            event.preventDefault();
            if (event.code === 'Escape') {
                setMenuScreen('multiplayer');
                audio.playLocal('misc/menu1.wav');
                return;
            }
            if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
                const direction = event.code === 'ArrowDown' ? 1 : -1;
                menuCursor = (menuCursor + direction + 5) % 5;
                audio.playLocal('misc/menu1.wav');
                return;
            }
            if (event.code === 'ArrowLeft' || event.code === 'ArrowRight' ||
                event.code === 'Enter') {
                if (event.code === 'Enter' && menuCursor === 4) {
                    playerName = setupPlayerName;
                    playerTopColor = setupTopColor;
                    playerBottomColor = setupBottomColor;
                    quakeWorld.setCvar('hostname', setupHostName);
                    vm.setEntityString(quakeWorld.playerReference, 'netname', playerName);
                    vm.setEntityFloat(
                        quakeWorld.playerReference, 'team', playerBottomColor + 1
                    );
                    setMenuScreen('multiplayer');
                    audio.playLocal('misc/menu2.wav');
                    return;
                }
                if (menuCursor < 2) return;
                const direction = event.code === 'ArrowLeft' ? -1 : 1;
                if (menuCursor === 2) {
                    setupTopColor = (setupTopColor + direction + 14) % 14;
                } else if (menuCursor === 3) {
                    setupBottomColor = (setupBottomColor + direction + 14) % 14;
                }
                audio.playLocal('misc/menu3.wav');
                return;
            }
            if (event.code === 'Backspace') {
                if (menuCursor === 0) setupHostName = setupHostName.slice(0, -1);
                if (menuCursor === 1) setupPlayerName = setupPlayerName.slice(0, -1);
                return;
            }
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey &&
                event.key.charCodeAt(0) >= 32 && event.key.charCodeAt(0) <= 127) {
                if (menuCursor === 0 && setupHostName.length < 15) {
                    setupHostName += event.key;
                } else if (menuCursor === 1 && setupPlayerName.length < 15) {
                    setupPlayerName += event.key;
                }
            }
            return;
        }
        if ((menuScreen === 'load' || menuScreen === 'save') && [
            'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Enter', 'Escape'
        ].includes(event.code)) {
            event.preventDefault();
            if (event.code === 'Escape') {
                setMenuScreen('singleplayer');
                audio.playLocal('misc/menu2.wav');
            } else if ([
                'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'
            ].includes(event.code)) {
                const direction = event.code === 'ArrowDown' || event.code === 'ArrowRight' ?
                    1 : -1;
                menuCursor = (menuCursor + direction + 12) % 12;
                audio.playLocal('misc/menu1.wav');
            } else if (menuScreen === 'load') {
                audio.playLocal('misc/menu2.wav');
                if (saveSlots[menuCursor]) loadGameFromSlot(menuCursor);
            } else {
                const slot = menuCursor;
                setMenuScreen(undefined);
                saveGameToSlot(slot);
            }
            return;
        }
        if (event.code === 'Backquote') {
            event.preventDefault();
            if (quakeKey) keyBindings.keyEvent(quakeKey, true, executeCommandText);
            return;
        }
        if (consoleOpen) {
            event.preventDefault();
            if (event.code === 'Escape') {
                setConsoleOpen(false);
            } else if (event.code === 'Backspace') {
                consoleInput = consoleInput.slice(0, -1);
            } else if (event.code === 'Enter') {
                executeConsoleCommand();
            } else if (event.code === 'ArrowUp' && commandHistory.length > 0) {
                commandHistoryIndex = Math.max(0, commandHistoryIndex - 1);
                consoleInput = commandHistory[commandHistoryIndex];
            } else if (event.code === 'ArrowDown') {
                commandHistoryIndex = Math.min(commandHistory.length, commandHistoryIndex + 1);
                consoleInput = commandHistory[commandHistoryIndex] ?? '';
            } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey &&
                consoleInput.length < 255) {
                consoleInput += event.key;
            }
            return;
        }
        if (event.code === 'Escape') {
            event.preventDefault();
            if (performance.now() <= suppressPointerLockEscapeUntil) return;
            if (menuScreen === 'quit') {
                const returningToMenu = quitPreviousMenu !== undefined;
                closeQuitMenu();
                if (returningToMenu) audio.playLocal('misc/menu1.wav');
                return;
            }
            toggleMenu();
            return;
        }
        if (!menuScreen) {
            if (quakeKey) {
                if (keyBindings.binding(quakeKey)) event.preventDefault();
                keyBindings.keyEvent(quakeKey, true, executeCommandText);
            }
            return;
        }
        if (menuScreen === 'newgame') {
            if (event.key.toLowerCase() === 'n') {
                setMenuScreen('singleplayer');
            } else if (event.key.toLowerCase() === 'y') {
                setMenuScreen(undefined);
                pendingNewGame = true;
            }
            return;
        }
        if (menuScreen === 'quit') {
            if (event.key.toLowerCase() === 'n') {
                const returningToMenu = quitPreviousMenu !== undefined;
                closeQuitMenu();
                if (returningToMenu) audio.playLocal('misc/menu1.wav');
            } else if (event.key.toLowerCase() === 'y') {
                window.close();
            }
            return;
        }
        if (menuScreen === 'help' && [
            'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'
        ].includes(event.code)) {
            event.preventDefault();
            const direction = event.code === 'ArrowUp' || event.code === 'ArrowRight' ? 1 : -1;
            menuPage = (menuPage + direction + 6) % 6;
            audio.playLocal('misc/menu2.wav');
            return;
        }
        if (menuScreen === 'options' &&
            (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {
            event.preventDefault();
            adjustOptions(event.code === 'ArrowRight' ? 1 : -1);
            return;
        }
        const itemCount = menuScreen === 'main' ? 5 :
            menuScreen === 'singleplayer' || menuScreen === 'multiplayer' ? 3 :
                menuScreen === 'options' ? QUAKE_OPTIONS_MENU_ITEMS.length : 12;
        if (event.code === 'ArrowDown' || event.code === 'ArrowUp') {
            event.preventDefault();
            const direction = event.code === 'ArrowDown' ? 1 : -1;
            menuCursor = (menuCursor + direction + itemCount) % itemCount;
            audio.playLocal('misc/menu1.wav');
        } else if (event.code === 'Enter') {
            event.preventDefault();
            audio.playLocal('misc/menu2.wav');
            if (menuScreen === 'main' && menuCursor === 0) {
                setMenuScreen('singleplayer');
            } else if (menuScreen === 'main' && menuCursor === 1) {
                setMenuScreen('multiplayer');
            } else if (menuScreen === 'main' && menuCursor === 2) {
                setMenuScreen('options');
            } else if (menuScreen === 'main' && menuCursor === 3) {
                setMenuScreen('help');
                menuPage = 0;
            } else if (menuScreen === 'main' && menuCursor === 4) {
                openQuitMenu();
            } else if (menuScreen === 'singleplayer' && menuCursor === 0) {
                setMenuScreen('newgame');
            } else if (menuScreen === 'singleplayer' && menuCursor === 1) {
                saveSlots = quakeReadSaveSlots(localStorage);
                setMenuScreen('load');
            } else if (menuScreen === 'singleplayer' && menuCursor === 2 &&
                quakeWorld.intermission === 0 &&
                vm.getEntityFloat(quakeWorld.playerReference, 'health') > 0) {
                saveSlots = quakeReadSaveSlots(localStorage);
                setMenuScreen('save');
            } else if (menuScreen === 'multiplayer' && menuCursor === 2) {
                openSetupMenu();
            } else if (menuScreen === 'options' && menuCursor === 0) {
                setMenuScreen('keys');
            } else if (menuScreen === 'options' && menuCursor === 1) {
                setMenuScreen(undefined);
                consoleOpen = true;
            } else if (menuScreen === 'options' && menuCursor === 2) {
                executeCommandText('exec default.cfg');
            } else if (menuScreen === 'options' && menuCursor === 12) {
                setMenuScreen(undefined);
                consoleOpen = true;
                executeCommandText('menu_video');
            } else if (menuScreen === 'options' && menuCursor >= 3) {
                adjustOptions(1);
            }
        }
    });
    window.addEventListener('keyup', (event) => {
        const quakeKey = quakeKeyboardKeyName(event.code);
        if (quakeKey) keyBindings.keyEvent(quakeKey, false, executeCommandText);
    });
    gameCanvas.addEventListener('mousedown', (event) => {
        if (menuScreen === 'keys' && menuBindingGrab) {
            const quakeKey = quakeMouseKeyName(event.button);
            if (quakeKey) {
                event.preventDefault();
                const [command] = QUAKE_KEY_MENU_COMMANDS[menuCursor];
                keyBindings.bind(quakeKey, command);
                menuBindingGrab = false;
                audio.playLocal('misc/menu1.wav');
            }
            return;
        }
        if (menuScreen || consoleOpen) return;
        const quakeKey = quakeMouseKeyName(event.button);
        if (quakeKey) keyBindings.keyEvent(quakeKey, true, executeCommandText);
    });
    gameCanvas.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('mouseup', (event) => {
        const quakeKey = quakeMouseKeyName(event.button);
        if (quakeKey) keyBindings.keyEvent(quakeKey, false, executeCommandText);
    });
    gameCanvas.addEventListener('wheel', (event) => {
        if (menuScreen === 'keys' && menuBindingGrab && event.deltaY !== 0) {
            event.preventDefault();
            const quakeKey = event.deltaY < 0 ? 'MWHEELUP' : 'MWHEELDOWN';
            const [command] = QUAKE_KEY_MENU_COMMANDS[menuCursor];
            keyBindings.bind(quakeKey, command);
            menuBindingGrab = false;
            audio.playLocal('misc/menu1.wav');
            return;
        }
        if (menuScreen || consoleOpen || event.deltaY === 0) return;
        event.preventDefault();
        const quakeKey = event.deltaY < 0 ? 'MWHEELUP' : 'MWHEELDOWN';
        keyBindings.keyEvent(quakeKey, true, executeCommandText);
        keyBindings.keyEvent(quakeKey, false, executeCommandText);
    }, { passive: false });
    const setAudioFocus = (active: boolean): void => {
        audio.focus.setActive(active).catch(
            error => console.error('Could not update Quake audio focus', error)
        );
    };
    const updateAudioFocus = (): void => {
        setAudioFocus(quakePageAudioActive(
            document.visibilityState, document.hasFocus()
        ));
    };
    window.addEventListener('blur', () => {
        keyBindings.releaseAll(executeCommandText);
        setAudioFocus(false);
    });
    window.addEventListener('focus', updateAudioFocus);
    document.addEventListener('visibilitychange', updateAudioFocus);
    updateAudioFocus();

    const beginLevelTransition = (transition: QuakeLevelTransitionState): void => {
        if (changingLevel) return;
        const targetMap = quakeMapName(transition.mapName);
        const targetPath = targetMap ? quakeMapPath(targetMap) : undefined;
        if (!targetMap || !targetPath || !loaded.pak.has(targetPath)) {
            quakeWorld.printToConsole(`Could not load ${targetPath ?? transition.mapName}\n`);
            return;
        }
        disconnectDemoPlayback();
        changingLevel = true;
        menuScreen = undefined;
        consoleOpen = false;
        audio.stopAllSounds();
        hud.drawLoading();

        requestAnimationFrame(() => {
            const replaceLevel = async (): Promise<void> => {
                const nextMap = new BspMap(loaded.pak.get(targetPath));
                const nextCollision = new WorldCollision(nextMap);
                const nextVm = new QuakeVirtualMachine(program);
                const nextWorld = new QuakeWorldRuntime(
                    nextVm,
                    nextMap,
                    nextCollision,
                    targetMap,
                    transition,
                    loaded.pak,
                    undefined,
                    playerName
                );
                const nextPalette = applyQuakeGamma(originalPalette, gamma);
                const nextWorldRenderer = new WorldRenderer(
                    app,
                    nextMap,
                    nextPalette,
                    loaded.pak.get('gfx/colormap.lmp'),
                    nextWorld
                );
                const nextWorldAliases = new WorldAliasRenderer(
                    app, loaded.pak, nextPalette, nextWorld
                );
                const nextBeams = new BeamRenderer(
                    app, loaded.pak, nextPalette, nextWorld
                );
                const nextWorldSprites = new WorldSpriteRenderer(
                    app, cameraEntity, loaded.pak, nextPalette, nextWorld
                );
                const nextWorldBrushes = new WorldBrushEntityRenderer(
                    app, loaded.pak, nextPalette, nextWorld
                );

                const spawnedConsoleLines = nextWorld.consoleLines.splice(0);
                nextWorld.consoleLines.push(...quakeWorld.consoleLines, ...spawnedConsoleLines);
                nextWorld.centerMessageDuration = centerMessageDuration;
                nextVm.setEntityString(nextWorld.playerReference, 'netname', playerName);
                nextVm.setEntityFloat(nextWorld.playerReference, 'team', playerBottomColor + 1);

                world.destroy();
                worldAliases.destroy();
                beams.destroy();
                worldSprites.destroy();
                worldBrushes.destroy();

                map = nextMap;
                mapName = targetMap;
                vm = nextVm;
                quakeWorld = nextWorld;
                world = nextWorldRenderer;
                worldAliases = nextWorldAliases;
                beams = nextBeams;
                worldSprites = nextWorldSprites;
                worldBrushes = nextWorldBrushes;
                centerMessageRuntime.world = quakeWorld;
                controller.replaceMap(map, nextCollision);
                controller.applyServerState(quakeWorld.playerResult());
                controller.synchronizeClientTime(quakeWorld.time);
                particles.replaceWorld(quakeWorld);
                viewModel.replaceWorld(quakeWorld);
                await audio.replaceLevel(map, quakeWorld);

                elapsed = 0;
                hostTime = 0;
                paletteSignature = '';
                viewLayoutSignature = '';
                updateViewLayout();
                refreshPalette();
                drawHud();

                const nextTrack = quakeCdTrackNumber(vm.getEntityFloat(0, 'sounds'));
                cdAudio.playTrack(nextTrack, true).catch((error) => {
                    console.warn('Could not change optional Quake music', error);
                });
                const nextUrl = new URL(window.location.href);
                nextUrl.searchParams.set('map', targetMap);
                nextUrl.searchParams.delete('load');
                nextUrl.searchParams.delete('demo');
                nextUrl.searchParams.delete('timedemo');
                nextUrl.searchParams.delete('attract');
                nextUrl.searchParams.delete('demos');
                nextUrl.searchParams.delete('demonum');
                nextUrl.searchParams.set('gamma', String(gamma));
                nextUrl.searchParams.set('viewsize', String(viewSize));
                nextUrl.searchParams.set('volume', String(soundVolume));
                nextUrl.searchParams.set('bgmvolume', String(musicVolume));
                nextUrl.searchParams.set('ambient_level', String(audio.ambientLevel));
                nextUrl.searchParams.set('ambient_fade', String(audio.ambientFade));
                writeRuntimeCvars(nextUrl);
                window.history.replaceState(null, '', nextUrl);
                changingLevel = false;
            };
            replaceLevel().catch((error) => {
                quakeWorld.printToConsole(`Could not change level: ${
                    error instanceof Error ? error.message : String(error)
                }\n`);
                changingLevel = false;
                drawHud();
            });
        });
    };

    const synchronizeControllerCvars = (): void => {
        controller.acceleration = quakeWorld.cvarValue('sv_accelerate');
        controller.edgeFriction = quakeWorld.cvarValue('edgefriction');
        controller.friction = quakeWorld.cvarValue('sv_friction');
        controller.gravity = quakeWorld.serverGravity();
        controller.maxSpeed = quakeWorld.cvarValue('sv_maxspeed');
        controller.maxVelocity = quakeWorld.serverMaximumVelocity();
        controller.noStep = quakeWorld.cvarValue('sv_nostep') !== 0;
        controller.stopSpeed = quakeWorld.cvarValue('sv_stopspeed');
    };

    const renderCameraPosition = new Float32Array(3);
    const renderSkyView = {
        fieldOfView,
        forward: new Float32Array(3),
        renderSize: new Float32Array(2),
        right: new Float32Array(3),
        up: new Float32Array(3),
        videoSize: new Float32Array([320, 200]),
        viewRect: new Float32Array(4)
    };

    app.on('update', (deltaTime) => {
        commandBuffer.advanceFrame(executeSingleCommand);
        if (changingLevel) return;
        if (pendingMapName) {
            const targetMap = pendingMapName;
            pendingMapName = undefined;
            beginLevelTransition(quakeWorld.createNewGameTransition(targetMap));
            return;
        }
        if (pendingNewGame) {
            pendingNewGame = false;
            beginLevelTransition(quakeWorld.createNewGameTransition());
            return;
        }
        const localCommandText = quakeWorld.takePendingLocalCommandText();
        if (localCommandText) executeCommandText(localCommandText);
        const queuedLevelTransition = quakeWorld.takePendingLevelTransition();
        if (queuedLevelTransition) {
            beginLevelTransition(queuedLevelTransition);
            return;
        }
        simulationAdvanced = false;
        if (!captureFrozen) {
            hostTime += deltaTime;
        }
        const consoleTarget = consoleForced ? 200 : consoleOpen ? 100 : 0;
        consoleHeight = quakeConsoleHeight(
            consoleHeight,
            consoleTarget,
            deltaTime,
            consoleSpeed
        );
        if (!captureFrozen && !paused && demoPlayback?.active) {
            simulationAdvanced = true;
            elapsed += deltaTime;
            timeDemo?.beginFrame(performance.now());
            const playbackStep = demoPlayback.advance(deltaTime);
            quakeWorld.applyDemoPlayback(demoPlayback, playbackStep.events, deltaTime);
            controller.setPlaybackTime(demoPlayback.clientTime);
            controller.applyServerState(quakeWorld.playerResult());
            if (demoPlayback.finished && activeDemoLoop) {
                playNextDemo(activeDemoLoop);
                return;
            }
            if (demoPlayback.finished) {
                if (timeDemo) {
                    quakeWorld.printToConsole(
                        quakeTimeDemoReport(timeDemo.finish(performance.now()))
                    );
                }
                stopDemoPlayback();
            }
        } else if (!captureFrozen && !paused && !menuScreen && !consoleOpen) {
            simulationAdvanced = true;
            elapsed += deltaTime;
            if (quakeWorld.intermission === 0) {
                synchronizeClientViewCvars();
                synchronizeControllerCvars();
                controller.beginFrame(deltaTime);
                controller.applyServerState(
                    quakeWorld.update(
                        deltaTime,
                        controller.playerState(),
                        (preMoveState) => {
                            controller.applyServerState(preMoveState, false);
                            synchronizeControllerCvars();
                            controller.finishFrame(false);
                            return controller.playerState();
                        }
                    )
                );
            } else {
                controller.sampleInputButtons();
                controller.applyServerState(quakeWorld.update(deltaTime, {
                    ...controller.playerState(),
                    jumped: false,
                    touchEntityReferences: [],
                    touchModelIndices: []
                }));
            }
        }
        if (!captureFrozen && !simulationAdvanced) {
            quakeWorld.advanceClientViewEffects(deltaTime);
            controller.applyServerState(quakeWorld.playerResult(false));
        }
        if (!captureFrozen) {
            quakeWorld.advanceCenterMessage(deltaTime);
        }
        const levelTransition = quakeWorld.takePendingLevelTransition();
        if (levelTransition) {
            beginLevelTransition(levelTransition);
            return;
        }
        updateViewLayout();
        const clientData = quakeWorld.clientData();
        const renderTime = intermissionCaptureTime ?? quakeWorld.time;
        if (quakeWorld.intermission !== 0) {
            controller.updateIntermissionView(renderTime);
        }
        viewModel.update(
            quakeWorld.intermission === 0 &&
                clientData.health > 0 &&
                (clientData.items & IT_INVISIBILITY) === 0 ?
                clientData.weaponModel : '',
            clientData.weaponFrame,
            renderTime,
            controller.viewBob(),
            controller.viewLightingOrigin(),
            controller.yaw,
            [controller.pitch, controller.yaw, 0],
            controller.viewModelAngles(),
            controller.viewModelScreenOffset(),
            viewSize
        );
        refreshPalette();
        drawHud();
        worldAliases.update(renderTime);
        beams.update(renderTime);
        if (simulationAdvanced) {
            particles.update(deltaTime);
        }
        worldSprites.update(renderTime);
        audio.update(deltaTime, controller.viewLightingOrigin(), controller.yaw);
        const cameraPosition = cameraEntity.getPosition();
        underwaterWarp.active = usesQuakeUnderwaterWarp(
            controller.collision.pointContents(controller.viewLightingOrigin())
        );
        underwaterWarp.time = renderTime;
        renderCameraPosition[0] = cameraPosition.x;
        renderCameraPosition[1] = cameraPosition.y;
        renderCameraPosition[2] = cameraPosition.z;
        const cameraForward = cameraEntity.forward;
        const cameraRight = cameraEntity.right;
        const cameraUp = cameraEntity.up;
        renderSkyView.fieldOfView = fieldOfView;
        renderSkyView.forward[0] = cameraForward.x;
        renderSkyView.forward[1] = -cameraForward.z;
        renderSkyView.forward[2] = cameraForward.y;
        renderSkyView.renderSize[0] = app.graphicsDevice.width;
        renderSkyView.renderSize[1] = app.graphicsDevice.height;
        renderSkyView.right[0] = cameraRight.x;
        renderSkyView.right[1] = -cameraRight.z;
        renderSkyView.right[2] = cameraRight.y;
        renderSkyView.up[0] = cameraUp.x;
        renderSkyView.up[1] = -cameraUp.z;
        renderSkyView.up[2] = cameraUp.y;
        renderSkyView.viewRect[0] = viewLayout.viewRect.x;
        renderSkyView.viewRect[1] = viewLayout.viewRect.y;
        renderSkyView.viewRect[2] = viewLayout.viewRect.width;
        renderSkyView.viewRect[3] = viewLayout.viewRect.height;
        world.update(renderTime, renderCameraPosition, renderSkyView);
        worldBrushes.update(renderTime, renderCameraPosition, renderSkyView);
    });
    const resize = (): void => {
        resizeGameCanvas();
        configureQuakeProjection(
            camera,
            viewLayout.viewRect.width,
            viewLayout.viewRect.height,
            fieldOfView
        );
    };
    window.addEventListener('resize', resize);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    resize();
    if (capturePngEnabled) {
        let remainingCaptureFrames = 2;
        const captureCompositePng = (): void => {
            remainingCaptureFrames--;
            if (remainingCaptureFrames > 0) return;
            const output = composeFrame();
            screenCanvas.textContent = output.toDataURL('image/png');
            screenCanvas.dataset.captureReady = '1';
            app.off('frameend', captureCompositePng);
        };
        app.on('frameend', captureCompositePng);
    }
    app.start();
    return {
        app,
        audio,
        get beams() {
            return beams;
        },
        cdAudio,
        controller,
        get map() {
            return map;
        },
        get mapName() {
            return mapName;
        },
        pakSha256: loaded.sha256,
        particles,
        program,
        get quakeWorld() {
            return quakeWorld;
        },
        requestedMusicTrack,
        sharewareVerified: loaded.sharewareVerified,
        underwaterWarp,
        viewModel,
        get vm() {
            return vm;
        },
        get world() {
            return world;
        },
        get worldAliases() {
            return worldAliases;
        },
        get worldBrushes() {
            return worldBrushes;
        },
        get worldSprites() {
            return worldSprites;
        }
    };
};
