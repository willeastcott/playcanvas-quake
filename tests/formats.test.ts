import fs from 'node:fs';
import path from 'node:path';

import {
    FRONTFACE_CW,
    LAYERID_UI,
    SEMANTIC_ATTR1,
    SEMANTIC_POSITION,
    Vec3 as PlayCanvasVec3,
    semanticToLocation,
    type Texture as PlayCanvasTexture
} from 'playcanvas';
import { describe, expect, it } from 'vitest';

import { BspMap, BSP_VERSION, CONTENTS } from '../src/formats/bsp';
import { parseEntities, parseVector } from '../src/formats/entities';
import { parseIndexedPicture } from '../src/formats/lmp';
import { AliasModel } from '../src/formats/mdl';
import { PakArchive } from '../src/formats/pak';
import { PROGS_CRC, PROGS_VERSION, QuakeProgram } from '../src/formats/progs';
import { SpriteModel, SPRITE_VERSION } from '../src/formats/spr';
import { WadArchive } from '../src/formats/wad';
import { decodeQuakeWavPcm, parseQuakeWavInfo } from '../src/formats/wav';
import {
    QUAKE_MAX_STATIC_CHANNELS,
    QuakeAudioFocusController,
    loadQuakeMusicTrack,
    quakeAmbientChannelState,
    quakeAmbientChannelVolume,
    quakeCdTrackNumber,
    quakeDuplicateSoundPlaybackOffset,
    quakeDuplicateSoundOffsetSamples,
    quakeLoopingSoundChannelEnd,
    quakeMusicGain,
    quakeMusicTrackPaths,
    quakeLoopingSoundPlaybackOffset,
    quakeLocalSoundEvent,
    quakePickDynamicChannel,
    runQuakeSoundCommandsInOrder,
    quakeSoundChannelGains,
    quakeCombinedStaticSoundGains,
    quakeStaticSoundGroups,
    quakeStoppedAmbientChannelState,
    quakeStoppedSoundSlot
} from '../src/game/audio-system';
import {
    CameraController,
    calculateQuakeViewBob,
    calculateQuakeViewRoll,
    quakeAirWishVelocity,
    quakeBoundViewOrigin,
    quakeButtonFrameValue,
    quakeClientEntityAngles,
    quakeClampedPitch,
    quakeClientVelocityComponent,
    quakeGroundFrictionScale,
    quakeIdleViewAngles,
    quakeIntermissionIdleAngles,
    quakeFilteredMouseDelta,
    quakeMouseAngleDelta,
    quakeMouseForwardMove,
    quakeMouseSideMove,
    quakeMouseStrafes,
    quakeMouseVerticalInput,
    quakePitchDriftStep,
    quakeScreenViewOffset,
    quakeServerWallFrictionVelocity,
    quakeSwimmingJumpSpeed,
    quakeTossAngles,
    quakeUnstuckOrigin,
    quakeViewModelAngles,
    quakeWaterJumpVelocity,
    quakeWallFrictionVelocity,
    quakeWaterUpMove
} from '../src/game/camera-controller';
import {
    QUAKE_PLAYER_DEATH_CAPTURE_FRAMES,
    prepareQuakePlayerDeathCapture,
    prepareQuakeStartStairsCapture
} from '../src/game/capture-state';
import { WorldCollision } from '../src/game/collision';
import { loadQuakeModelBounds } from '../src/game/model-bounds';
import {
    quakePlayerColorsCommand,
    quakePlayerColorsFromCvar,
    quakePlayerName,
    quakePlayerNameCommand
} from '../src/game/player-setup';
import {
    configureQuakeProjection,
    quakeCanvasDisplaySize,
    quakeConsoleHeight,
    quakeFieldOfView,
    quakeMapSpawnPose,
    quakeMenuGamma,
    quakeMenuViewSize,
    quakePageAudioActive,
    quakeQuitPreviousMenu,
    quakeQuitReturnMenu,
    quakeScreenshotName,
    quakeStartupConsoleLines,
    quakeViewLayout
} from '../src/game/quake-app';
import {
    quakeStringToFloat,
    registerQuakeBuiltins,
    type QuakeParticleEvent
} from '../src/game/quake-builtins';
import { quakeAngleMod, quakeHostFrameTime } from '../src/game/quake-math';
import {
    quakeProtocolAngle,
    quakeProtocolMessageNumber
} from '../src/game/quake-protocol';
import { QuakeOpcode, QuakeVirtualMachine } from '../src/game/quake-vm';
import {
    QuakeWorldRuntime,
    quakeEntityInhibited,
    quakeIdealPitchFromHeights
} from '../src/game/quake-world';
import { QUAKE_ALIAS_NORMALS } from '../src/render/alias-normals';
import {
    QUAKE_ALIAS_FRONT_FACE,
    QUAKE_ALIAS_NEAR_CLIP
} from '../src/render/alias-raster';
import {
    quakeEntitySyncBase,
    quakeGroupFrameIndex,
    quakeModelIndex
} from '../src/render/animation';
import { layoutQuakeBeam } from '../src/render/beam-renderer';
import {
    QUAKE_OPTIONS_MENU_ITEMS,
    QUAKE_WINQUAKE_QUIT_CREDITS,
    quakeCrosshairPosition,
    quakeFinaleVisibleCharacters,
    quakeInventoryAmmoDigitX,
    quakeLoadingHudState,
    quakeMenuFadeOpaque,
    quakePlayerTranslation,
    quakeWeaponIconName,
    stampQuakeConsoleVersion
} from '../src/render/hud-renderer';
import {
    buildDynamicLightmap,
    buildLightmapAtlas,
    quakeDynamicLightContribution,
    quakeDynamicLightmapValue
} from '../src/render/lightmap-atlas';
import {
    applyQuakeGamma,
    applyQuakePaletteShifts,
    quakeColormapGrade,
    quakePaletteRgba,
    updatePaletteTexture
} from '../src/render/palette';
import {
    EF_ROTATE,
    QUAKE_PARTICLE_NEAR_CLIP,
    hasQuakeRocketLight,
    quakeBlobParticleState,
    quakeEffectParticleState,
    quakeExplosionTwoParticleState,
    quakeLavaParticleState,
    quakeModelTrailType,
    quakeEntityParticleOrigin,
    quakeParticleDisplayPixelSize,
    quakeParticlePixelSize,
    quakeParticleRaster,
    quakeRotatingModelYaw,
    quakeTeleportParticleState
} from '../src/render/particle-effects';
import {
    quakeParticleLayerInsertionIndex,
    quakeParticleRandomState,
    quakeParticleRandomValue
} from '../src/render/particle-renderer';
import {
    calculateQuakeAliasLighting,
    quakeAliasColormapGrade,
    quakeAliasVertexLightNumber,
    quakeLightStyleScale,
    quakeSurfaceDarkness,
    quakeSurfaceLightGrade,
    quakeSurfaceMipLevel,
    quakeSurfaceMipLevelForScale,
    quakeSurfaceMipLevelForView,
    quakeTextureMipAdjustment,
    sampleQuakeBspLight
} from '../src/render/quake-lighting';
import {
    quakeAliasLightDirection,
    quakeAliasRotation,
    quakeEntityRotation,
    quakeOrientedSpriteRotation,
    quakeUprightSpriteRotation,
    quakeViewModelLightDirection,
    quakeViewModelLocalPosition,
    quakeViewModelLocalRotation,
    quakeViewModelVerticalOffset
} from '../src/render/quake-transform';
import { ALIAS_FRAGMENT_SHADER, ALIAS_VERTEX_SHADER } from '../src/render/shaders';
import {
    QUAKE_TURBULENCE_OFFSETS,
    quakeTurbulentTextureCoordinate
} from '../src/render/turbulence';
import {
    quakeUnderwaterWarpCoordinate,
    usesQuakeUnderwaterWarp
} from '../src/render/underwater-warp';
import {
    quakeAnimatedTextureIndex,
    quakeFaceWorldVertices,
    quakeOrientedFaceVertexIndices,
    quakePvsContainsLeaf,
    quakeTextureAnimation
} from '../src/render/world-renderer';

const pakPath = path.resolve('.quake-data/id1/pak0.pak');
const hasPak = fs.existsSync(pakPath);
const describeWithPak = hasPak ? describe : describe.skip;

describe('Quake entity text parsing', () => {
    it('decodes ED_NewString escapes with the original source semantics', () => {
        expect(parseEntities(
            '{"message" "first\\nsecond" "unsupported" "left\\tright"}'
        )).toEqual([{
            message: 'first\nsecond',
            unsupported: 'left\\right'
        }]);
    });
});

const movementController = (moveType: number): CameraController => Object.assign(
    Object.create(CameraController.prototype) as CameraController,
    {
        acceleration: 10,
        activeButtonSources: new Map<string, Set<string>>(),
        angleSpeedKey: 1.5,
        alwaysRun: false,
        angularVelocity: [0, 0, 0],
        attack: false,
        backSpeed: 200,
        backwardMoveBlocked: false,
        buttonFrameValues: new Map<string, number>(),
        buttonPressEdges: new Set<string>(),
        buttonReleaseEdges: new Set<string>(),
        collision: {
            pointContents: () => CONTENTS.EMPTY,
            tracePoint: (_start: [number, number, number], end: [number, number, number]) => ({
                allSolid: false,
                endPosition: [...end] as [number, number, number],
                fraction: 1,
                inOpen: true,
                inWater: false,
                plane: { distance: 0, normal: [0, 0, 0] as [number, number, number] },
                startSolid: false
            })
        } as unknown as WorldCollision,
        centerMove: 0.15,
        centerSpeed: 500,
        dead: false,
        edgeFriction: 2,
        elapsed: 0,
        entityAngles: [0, 0, 0],
        framePrepared: false,
        friction: 4,
        forwardSpeed: 200,
        gravity: 800,
        groundModelIndex: undefined,
        idealPitch: 0,
        invertMouse: false,
        jumpReleased: true,
        jumped: false,
        lookSpring: 0,
        lookStrafe: 0,
        maxSpeed: 320,
        maxVelocity: 2_000,
        mouseForward: 1,
        mouseForwardMove: 0,
        mouseFilter: 0,
        mouseLookActive: false,
        mouseOldX: 0,
        mouseOldY: 0,
        mousePendingX: 0,
        mousePendingY: 0,
        mousePitch: 0.022,
        mouseSide: 0.8,
        mouseSideMove: 0,
        mouseUpMove: 0,
        mouseYaw: 0.022,
        moveSpeedKey: 2,
        moveType,
        movementTrace: (_start: [number, number, number], end: [number, number, number]) => ({
            entity: 0,
            solid: 4,
            trace: {
                allSolid: false,
                endPosition: [...end] as [number, number, number],
                fraction: 1,
                inOpen: true,
                inWater: false,
                plane: { distance: 0, normal: [0, 0, 0] },
                startSolid: false
            }
        }),
        noStep: false,
        noclipAngleHack: false,
        oldOrigin: [0, 0, 0],
        onGround: false,
        origin: [0, 0, 0],
        pitch: 0,
        pitchSpeed: 150,
        pitchDrift: {
            driftMove: 0,
            lastStop: 0,
            noDrift: false,
            pitch: 0,
            pitchVelocity: 0
        },
        preparedFrameTime: 0,
        punchAngle: [0, 0, 0],
        sensitivity: 3,
        serverDrivenJump: true,
        sideSpeed: 350,
        stopSpeed: 100,
        touchedBrushModelIndices: new Set<number>(),
        touchedEntityReferences: new Set<number>(),
        upSpeed: 200,
        velocity: [0, 0, 0],
        viewHeight: 22,
        viewRoll: 0,
        waterJump: false,
        waterJumpDirection: [0, 0, 0],
        waterJumpTime: 0,
        yaw: 0,
        yawSpeed: 140
    }
);

describe('Quake first-person view calculations', () => {
    it('keeps Quake FOV horizontal across gameplay and intermission viewports', () => {
        const camera = {
            aspectRatio: 0,
            aspectRatioMode: 0,
            fov: 0,
            horizontalFov: false
        };
        configureQuakeProjection(camera);

        expect(camera.aspectRatio).toBeCloseTo(320 * (5 / 6) / 152);
        expect(camera.aspectRatioMode).toBe(1);
        expect(camera.fov).toBe(90);
        expect(camera.horizontalFov).toBe(true);

        configureQuakeProjection(camera, 320, 200);
        expect(camera.aspectRatio).toBeCloseTo(4 / 3);

        configureQuakeProjection(camera, 320, 152, 60);
        expect(camera.fov).toBe(60);
    });

    it('clamps the source fov cvar at refdef rebuild boundaries', () => {
        expect(quakeFieldOfView(9)).toBe(10);
        expect(quakeFieldOfView(75.5)).toBe(75.5);
        expect(quakeFieldOfView(171)).toBe(170);
    });

    it('adds the source three-axis idle sway to intermission cameras', () => {
        expect(quakeIntermissionIdleAngles([20, 120, 5], 0)).toEqual([20, 120, 5]);
        const angles = quakeIntermissionIdleAngles([20, 120, 5], Math.PI / 2);

        expect(angles[0]).toBeCloseTo(20.3);
        expect(angles[1]).toBeCloseTo(120);
        expect(angles[2]).toBeCloseTo(5 + Math.SQRT1_2 * 0.1);
    });

    it('applies live source idle and bounded screen-offset cvars', () => {
        const angles = quakeIdleViewAngles([10, 20, 30], Math.PI / 2, {
            pitchCycle: 1,
            pitchLevel: 0.5,
            rollCycle: 0.5,
            rollLevel: 0.1,
            scale: 2,
            yawCycle: 2,
            yawLevel: 0.3
        });
        expect(angles[0]).toBeCloseTo(11);
        expect(angles[1]).toBeCloseTo(20);
        expect(angles[2]).toBeCloseTo(30 + Math.SQRT1_2 * 0.2);
        expect(quakeScreenViewOffset([0, 0, 0], [10, 2, 3])).toEqual([
            10, -2, 3
        ]);
        expect(quakeBoundViewOrigin([120, -120, 60], [100, -100, 20])).toEqual([
            114, -114, 50
        ]);
    });

    it('matches CalcGunAngle idle cancellation and base view roll', () => {
        expect(quakeViewModelAngles([10, 20, 3], 2, 0)).toEqual([
            -12, 20, 3
        ]);
        const angles = quakeViewModelAngles([10, 20, 3], 2, Math.PI / 2, {
            pitchCycle: 1,
            pitchLevel: 0.5,
            rollCycle: 0.5,
            rollLevel: 0.1,
            scale: 2,
            yawCycle: 2,
            yawLevel: 0.3
        });
        expect(angles[0]).toBeCloseTo(-14);
        expect(angles[1]).toBeCloseTo(20);
        expect(angles[2]).toBeCloseTo(3 - Math.SQRT1_2 * 0.2);
    });

    it('accelerates pitch drift and stops it while mouse-look is active', () => {
        const initial = {
            driftMove: 0,
            lastStop: 0,
            noDrift: false,
            pitch: 0,
            pitchVelocity: 0
        };
        const accelerating = quakePitchDriftStep(
            initial, 8, 0.1, 0.1, true, false, false
        );
        expect(accelerating).toMatchObject({ pitch: 0, pitchVelocity: 50 });
        const moving = quakePitchDriftStep(
            accelerating, 8, 0.1, 0.2, true, false, false
        );
        expect(moving).toMatchObject({ pitch: 5, pitchVelocity: 100 });
        expect(quakePitchDriftStep(
            moving, 8, 0.1, 0.3, true, false, false
        )).toMatchObject({ pitch: 8, pitchVelocity: 0 });

        const stopped = quakePitchDriftStep(
            moving, 8, 0.1, 0.3, true, true, false
        );
        expect(stopped).toMatchObject({
            driftMove: 0,
            lastStop: 0.3,
            noDrift: true,
            pitchVelocity: 0
        });
        const waiting = quakePitchDriftStep(
            stopped, 8, 0.1, 0.4, true, false, true
        );
        expect(waiting).toMatchObject({ driftMove: 0.1, noDrift: true });
        expect(quakePitchDriftStep(
            waiting, 8, 0.1, 0.5, true, false, true
        )).toMatchObject({ driftMove: 0, noDrift: false, pitchVelocity: 500 });
    });

    it('derives source ideal pitch only from a consistent run of floor steps', () => {
        expect(quakeIdealPitchFromHeights([10, 10, 10, 10, 10, 10], 7, 0.8)).toBe(0);
        expect(quakeIdealPitchFromHeights([10, 8, 6, 4, 2, 0], 0, 0.8)).toBe(1.6);
        expect(quakeIdealPitchFromHeights([10, 8, 8, 8, 8, 8], 7, 0.8)).toBe(7);
        expect(quakeIdealPitchFromHeights([10, 8, 6, 8, 6, 4], 7, 0.8)).toBe(7);
    });

    it('uses the source Options-menu gamma direction, step, and clamp', () => {
        expect(quakeMenuGamma(1, 1)).toBeCloseTo(0.95);
        expect(quakeMenuGamma(0.5, 1)).toBe(0.5);
        expect(quakeMenuGamma(0.95, -1)).toBe(1);
    });

    it('uses source screen-size steps, status-bar modes, and aligned view rectangles', () => {
        expect(quakeMenuViewSize(100, 1)).toBe(110);
        expect(quakeMenuViewSize(30, -1)).toBe(30);
        expect(quakeMenuViewSize(120, 1)).toBe(120);
        expect(quakeViewLayout(100)).toEqual({
            statusBarLines: 48,
            viewRect: { height: 152, width: 320, x: 0, y: 0 }
        });
        expect(quakeViewLayout(90)).toEqual({
            statusBarLines: 48,
            viewRect: { height: 152, width: 288, x: 16, y: 0 }
        });
        expect(quakeViewLayout(70)).toEqual({
            statusBarLines: 48,
            viewRect: { height: 140, width: 224, x: 48, y: 6 }
        });
        expect(quakeViewLayout(30)).toEqual({
            statusBarLines: 48,
            viewRect: { height: 60, width: 96, x: 112, y: 46 }
        });
        expect(quakeViewLayout(110)).toEqual({
            statusBarLines: 24,
            viewRect: { height: 176, width: 320, x: 0, y: 0 }
        });
        expect(quakeViewLayout(120)).toEqual({
            statusBarLines: 0,
            viewRect: { height: 200, width: 320, x: 0, y: 0 }
        });
        expect(quakeViewLayout(30, true)).toEqual(quakeViewLayout(120));
    });

    it('derives responsive WebGL dimensions from the stage and Quake view rectangle', () => {
        expect(quakeCanvasDisplaySize(
            1_152, 720, quakeViewLayout(100).viewRect
        )).toEqual({ height: 547, width: 1_152 });
        expect(quakeCanvasDisplaySize(
            600, 375, quakeViewLayout(100).viewRect
        )).toEqual({ height: 285, width: 600 });
        expect(quakeCanvasDisplaySize(
            1_152, 720, quakeViewLayout(70).viewRect
        )).toEqual({ height: 504, width: 806 });
        expect(quakeCanvasDisplaySize(
            0, 0, quakeViewLayout(100).viewRect
        )).toEqual({ height: 1, width: 1 });
    });

    it('uploads a rebuilt Quake palette into an existing indexed texture', () => {
        const storage = new Uint8Array(256 * 4);
        let unlocks = 0;
        const texture = {
            lock: () => storage,
            unlock: () => unlocks++
        } as unknown as PlayCanvasTexture;
        const palette = Uint8Array.from(
            { length: 256 * 3 }, (_value, index) => index & 255
        );

        updatePaletteTexture(texture, palette);

        expect([...storage.slice(0, 4)]).toEqual([0, 1, 2, 255]);
        expect([...storage.slice(-4)]).toEqual([253, 254, 255, 255]);
        expect(unlocks).toBe(1);
    });

    it('matches the asymmetric source bob cycle and final clamp', () => {
        expect(calculateQuakeViewBob(100, 0.15)).toBeCloseTo(2);
        expect(calculateQuakeViewBob(100, 0.45)).toBeCloseTo(-0.8);
        expect(calculateQuakeViewBob(1_000, 0.15)).toBe(4);
        expect(calculateQuakeViewBob(1_000, 0.45)).toBe(-7);
        expect(calculateQuakeViewBob(100, 0.125, 0.01, 1, 0.25)).toBeCloseTo(1);
    });

    it('synchronizes the local client view clock to the server snapshot', () => {
        const controller = movementController(3);
        Object.assign(controller, {
            bobAmount: 0.02,
            bobCycle: 0.6,
            bobUp: 0.5,
            cameraElapsed: 0,
            velocity: [100, 0, 0]
        });

        controller.synchronizeClientTime(1);

        expect(controller.elapsed).toBe(1);
        expect(controller.cameraElapsed).toBe(1);
        expect(controller.viewBob()).toBeCloseTo(calculateQuakeViewBob(96, 1));
        expect(() => controller.synchronizeClientTime(Number.NaN)).toThrow(
            'Invalid Quake client time'
        );
    });

    it('uses signed velocity characters for client bob and roll input', () => {
        expect(quakeClientVelocityComponent(31.9)).toBe(16);
        expect(quakeClientVelocityComponent(-31.9)).toBe(-16);
        expect(quakeClientVelocityComponent(2_000)).toBe(2_000);
    });

    it('round-trips source angles through the signed one-byte protocol field', () => {
        expect(quakeProtocolAngle(-45)).toBe(-45);
        expect(quakeProtocolAngle(315)).toBe(-45);
        expect(quakeProtocolAngle(180)).toBe(-180);
        expect(quakeProtocolAngle(1.9)).toBe(0);
        expect(quakeProtocolAngle(179.9)).toBe(178.59375);
    });

    it('round-trips movement commands through signed protocol shorts', () => {
        expect(quakeProtocolMessageNumber('short', 24.9)).toBe(24);
        expect(quakeProtocolMessageNumber('short', -24.9)).toBe(-24);
        expect(quakeProtocolMessageNumber('short', 32_768)).toBe(-32_768);
        expect(quakeProtocolMessageNumber('short', 65_535)).toBe(-1);
    });

    it('advances client toss angles from the QuakeC angular velocity', () => {
        expect(quakeTossAngles([10, 20, 30], [100, -200, 300], 0.05)).toEqual([
            15, 10, 45
        ]);
    });

    it('locks horizontal velocity to the source water-jump direction', () => {
        expect(quakeWaterJumpVelocity([10, 20, 225], [-50, 75, 0])).toEqual([
            -50, 75, 225
        ]);
    });

    it('uses the source player-model angles as the air-movement basis', () => {
        expect(quakeClientEntityAngles(
            [60, 90, 0], [3, -5, 7], 8
        )).toEqual([-21, 85, 8]);
        const wish = quakeAirWishVelocity([-20, 0, 0], 200, 0, 0, true, 320);
        expect(wish.velocity[0]).toBeCloseTo(Math.cos(Math.PI / 9) * 200);
        expect(wish.velocity[1]).toBe(0);
        expect(wish.velocity[2]).toBe(0);
        expect(wish.speed).toBeCloseTo(Math.cos(Math.PI / 9) * 200);
    });

    it('applies grounded gravity through the source frame-scaled walk trace', () => {
        const controller = movementController(3);
        const verticalMoves: number[] = [];
        controller.onGround = true;
        controller.movementTrace = (start, end) => {
            const downward = end[2] < start[2];
            verticalMoves.push(end[2] - start[2]);
            return {
                entity: 0,
                solid: 4,
                trace: {
                    allSolid: false,
                    endPosition: downward ? [...start] : [...end],
                    fraction: downward ? 0 : 1,
                    inOpen: true,
                    inWater: false,
                    plane: {
                        distance: 0,
                        normal: downward ? [0, 0, 1] : [0, 0, 0]
                    },
                    startSolid: false
                }
            };
        };

        controller.beginFrame(0.01);
        verticalMoves.length = 0;
        controller.finishFrame(false);

        expect(verticalMoves.filter(movement => movement < 0)[0]).toBeCloseTo(-0.08);
        expect(controller.onGround).toBe(true);
        expect(controller.velocity).toEqual([0, 0, 0]);
    });

    it('does not snap an airborne walk player across a sub-two-unit drop', () => {
        const controller = movementController(3);
        controller.origin = [0, 0, 24];
        controller.oldOrigin = [...controller.origin];
        controller.onGround = false;
        controller.movementTrace = (_start, end) => {
            const hitsFloor = end[2] < 23;
            return {
                entity: 0,
                solid: 4,
                trace: {
                    allSolid: false,
                    endPosition: hitsFloor ? [end[0], end[1], 23] : [...end],
                    fraction: hitsFloor ? 0.5 : 1,
                    inOpen: true,
                    inWater: false,
                    plane: {
                        distance: 0,
                        normal: hitsFloor ? [0, 0, 1] : [0, 0, 0]
                    },
                    startSolid: false
                }
            };
        };

        controller.beginFrame(0.01);
        controller.finishFrame(false);

        expect(controller.origin[0]).toBe(0);
        expect(controller.origin[1]).toBe(0);
        expect(controller.origin[2]).toBeCloseTo(23.92);
        expect(controller.onGround).toBe(false);
        expect(controller.velocity[0]).toBe(0);
        expect(controller.velocity[1]).toBe(0);
        expect(controller.velocity[2]).toBeCloseTo(-8);
    });

    it('retains vertical commands and maximum-speed scaling outside walk mode', () => {
        const wish = quakeAirWishVelocity([0, 0, 0], 400, 0, 300, false, 320);
        expect(wish.velocity).toEqual([256, 0, 192]);
        expect(wish.direction).toEqual([0.8, 0, 0.6]);
        expect(wish.speed).toBe(320);
    });

    it('applies live client commands directly to noclip velocity', () => {
        const controller = movementController(8);
        controller.activeButtonSources.set('+forward', new Set(['test']));
        controller.activeButtonSources.set('+moveup', new Set(['test']));

        controller.beginFrame(0.05);
        controller.finishFrame(false);

        expect(controller.velocity).toEqual([200, 0, 200]);
        expect(controller.origin[0]).toBeCloseTo(10);
        expect(controller.origin[1]).toBe(0);
        expect(controller.origin[2]).toBeCloseTo(10);
    });

    it('uses live source movement-speed cvars when building client commands', () => {
        const controller = movementController(8);
        controller.forwardSpeed = 123;
        controller.upSpeed = 45;
        controller.activeButtonSources.set('+forward', new Set(['test']));
        controller.activeButtonSources.set('+moveup', new Set(['test']));

        controller.beginFrame(0.05);
        controller.finishFrame(false);

        expect(controller.velocity).toEqual([123, 0, 45]);
        expect(controller.origin[0]).toBeCloseTo(6.15);
        expect(controller.origin[1]).toBe(0);
        expect(controller.origin[2]).toBeCloseTo(2.25);
    });

    it('adds mouse forward movement after the source speed-key scaling phase', () => {
        const controller = movementController(8);
        controller.mouseForwardMove = -30;
        controller.activeButtonSources.set('+speed', new Set(['test']));

        controller.beginFrame(0.05);
        controller.finishFrame(false);

        expect(controller.velocity[0]).toBe(-30);
        expect(controller.velocity[1]).toBeCloseTo(0);
        expect(controller.velocity[2]).toBe(0);
        expect(controller.origin[0]).toBeCloseTo(-1.5);
        expect(controller.origin[1]).toBeCloseTo(0);
        expect(controller.origin[2]).toBe(0);
    });

    it('wraps adjusted client yaw through the source fixed-point anglemod', () => {
        expect(quakeAngleMod(360)).toBe(0);
        expect(quakeAngleMod(-90)).toBe(270);
        expect(quakeAngleMod(361)).toBeCloseTo(0.999755859375);

        const controller = movementController(8);
        controller.yaw = 359;
        controller.activeButtonSources.set('+left', new Set(['test']));
        controller.beginFrame(0.05);
        controller.finishFrame(false);

        expect(controller.yaw).toBe(quakeAngleMod(366));
    });

    it('passes host frame duration through the source float boundary', () => {
        expect(quakeHostFrameTime(0.05)).toBe(Math.fround(0.05));
        expect(quakeHostFrameTime(0.05)).toBeGreaterThan(0.05);
        expect(quakeHostFrameTime(1)).toBe(Math.fround(0.1));
        expect(quakeHostFrameTime(-1)).toBe(0);
    });

    it('samples and filters accumulated mouse movement once per client frame', () => {
        const controller = movementController(8);
        controller.mouseFilter = 1;
        controller.mouseLookActive = true;
        controller.mouseOldX = 4;
        controller.mousePendingX = 12;
        controller.mousePendingY = 4;

        controller.beginFrame(0.05);
        controller.finishFrame(false);

        expect(controller.yaw).toBeCloseTo(-0.528);
        expect(controller.pitch).toBeCloseTo(0.132);
        expect(controller.mouseOldX).toBe(12);
        expect(controller.mouseOldY).toBe(4);
        expect(controller.mousePendingX).toBe(0);
        expect(controller.mousePendingY).toBe(0);
    });

    it('routes strafe mouse Y into noclip up-move through anglehack', () => {
        const controller = movementController(8);
        controller.mouseLookActive = true;
        controller.noclipAngleHack = true;
        controller.mousePendingY = 10;
        controller.activeButtonSources.set('+strafe', new Set(['test']));

        controller.beginFrame(0.05);
        controller.finishFrame(false);

        expect(controller.velocity[0]).toBeCloseTo(0);
        expect(controller.velocity[1]).toBeCloseTo(0);
        expect(controller.velocity[2]).toBe(-30);
        expect(controller.origin[2]).toBeCloseTo(-1.5);
    });

    it('starts source pitch drift when mlook is released with lookspring', () => {
        const controller = movementController(3);
        controller.idealPitch = 8;
        controller.onGround = true;
        controller.lookSpring = 1;
        Object.assign(controller, {
            pitchDrift: {
                driftMove: 0,
                lastStop: 0,
                noDrift: true,
                pitch: 0,
                pitchVelocity: 0
            }
        });

        controller.setButtonState('+mlook', 'test', true);
        controller.setButtonState('+mlook', 'test', false);
        controller.beginFrame(0.01);

        expect(controller.pitch).toBeCloseTo(5);
    });

    it('packet-quantizes view angles and fractional mouse side movement', () => {
        const controller = movementController(8);
        controller.pitch = -45.9;
        controller.yaw = 181.9;
        controller.mouseSideMove = 24.9;

        controller.beginFrame(0.05);
        controller.finishFrame(false);

        expect(controller.playerState().angles).toEqual([-45, -180, 0]);
        expect(controller.entityAngles).toEqual([15, -180, 0]);
        expect(controller.velocity[0]).toBeCloseTo(0);
        expect(controller.velocity[1]).toBe(24);
        expect(controller.velocity[2]).toBe(0);
    });

    it('air-accelerates a live flying client from vertical input', () => {
        const controller = movementController(5);
        controller.activeButtonSources.set('+moveup', new Set(['test']));

        controller.beginFrame(0.05);
        controller.finishFrame(false);

        expect(controller.velocity).toEqual([0, 0, 30]);
        expect(controller.origin[0]).toBe(0);
        expect(controller.origin[1]).toBe(0);
        expect(controller.origin[2]).toBeCloseTo(1.5);
    });

    it('matches the source old-origin and one-unit player unsticking search', () => {
        const free = quakeUnstuckOrigin(
            [10, 20, 30], [1, 2, 3], () => false
        );
        expect(free).toEqual({ oldOrigin: [10, 20, 30], origin: [10, 20, 30] });

        const restored = quakeUnstuckOrigin(
            [10, 20, 30], [1, 2, 3], candidate => candidate[0] !== 1
        );
        expect(restored).toEqual({ oldOrigin: [1, 2, 3], origin: [1, 2, 3] });

        const searched = quakeUnstuckOrigin(
            [10, 20, 30], [1, 2, 3], candidate => (
                candidate[0] !== 9 || candidate[1] !== 19 || candidate[2] !== 32
            )
        );
        expect(searched).toEqual({ oldOrigin: [1, 2, 3], origin: [9, 19, 32] });

        const stuck = quakeUnstuckOrigin(
            [10, 20, 30], [1, 2, 3], () => true
        );
        expect(stuck).toEqual({ oldOrigin: [1, 2, 3], origin: [10, 20, 30] });
    });

    it('matches source movement roll direction and limits', () => {
        expect(calculateQuakeViewRoll(0, [0, -100, 0])).toBeCloseTo(1);
        expect(calculateQuakeViewRoll(0, [0, 500, 0])).toBe(-2);
        expect(calculateQuakeViewRoll(90, [100, 0, 0])).toBeCloseTo(1);
        expect(calculateQuakeViewRoll(0, [0, -50, 0], 4, 100)).toBeCloseTo(2);
    });

    it('uses Quake default sensitivity and m_yaw/m_pitch scaling', () => {
        expect(quakeMouseAngleDelta(100, 3)).toBeCloseTo(6.6);
        expect(quakeMouseAngleDelta(-50, 11)).toBeCloseTo(-12.1);
        expect(quakeMouseAngleDelta(100, 2, -0.01)).toBe(-2);
        expect(quakeFilteredMouseDelta(12, 4, 0)).toBe(12);
        expect(quakeFilteredMouseDelta(12, 4, 1)).toBe(8);
        expect(quakeMouseForwardMove(10, 2, 0.5)).toBe(10);
        expect(quakeMouseSideMove(10, 3)).toBe(24);
        expect(quakeMouseSideMove(10, 2, 0.5)).toBe(10);
        expect(quakeMouseStrafes(true, 0, true)).toBe(true);
        expect(quakeMouseStrafes(false, 1, true)).toBe(true);
        expect(quakeMouseStrafes(false, 1, false)).toBe(false);
        const pitchedMouse = quakeMouseVerticalInput(10, 3, 0.022, 1, true, false);
        expect(pitchedMouse.forwardMove).toBe(0);
        expect(pitchedMouse.pitchDelta).toBeCloseTo(0.66);
        expect(pitchedMouse.upMove).toBe(0);
        expect(quakeMouseVerticalInput(10, 3, 0.022, 1, true, true)).toEqual({
            forwardMove: -30,
            pitchDelta: 0,
            upMove: 0
        });
        expect(quakeMouseVerticalInput(10, 3, 0.022, 1, false, false)).toEqual({
            forwardMove: -30,
            pitchDelta: 0,
            upMove: 0
        });
        expect(quakeMouseVerticalInput(
            10, 3, 0.022, 1, true, true, true
        )).toEqual({
            forwardMove: 0,
            pitchDelta: 0,
            upMove: -30
        });
        expect(quakeClampedPitch(-90)).toBe(-70);
        expect(quakeClampedPitch(90)).toBe(80);
    });

    it('applies the source Sbar_DrawCharacter offset to inventory ammo digits', () => {
        expect([0, 1, 2].map(digit => quakeInventoryAmmoDigitX(0, digit))).toEqual([
            10, 18, 26
        ]);
        expect([0, 1, 2].map(digit => quakeInventoryAmmoDigitX(3, digit))).toEqual([
            154, 162, 170
        ]);
    });

    it('retains the original kbutton edge fractions between client frames', () => {
        expect(quakeButtonFrameValue(false, false, false)).toBe(0);
        expect(quakeButtonFrameValue(true, false, false)).toBe(1);
        expect(quakeButtonFrameValue(true, true, false)).toBe(0.5);
        expect(quakeButtonFrameValue(false, false, true)).toBe(0);
        expect(quakeButtonFrameValue(false, true, true)).toBe(0.25);
        expect(quakeButtonFrameValue(true, true, true)).toBe(0.75);
    });

    it('doubles source ground friction at a leading-edge drop', () => {
        expect(quakeGroundFrictionScale(200, 0.05, false)).toBeCloseTo(0.8);
        expect(quakeGroundFrictionScale(200, 0.05, true)).toBeCloseTo(0.6);
        expect(quakeGroundFrictionScale(50, 0.05, false)).toBeCloseTo(0.6);
        expect(quakeGroundFrictionScale(50, 0.05, true)).toBeCloseTo(0.2);
        expect(quakeGroundFrictionScale(200, 0.05, false, 2, 3, 50)).toBeCloseTo(0.9);
        expect(quakeGroundFrictionScale(200, 0.05, true, 2, 3, 50)).toBeCloseTo(0.7);
    });

    it('uses the authoritative point trace for friction over a moved BSP platform', () => {
        const controller = movementController(3);
        controller.origin = [0, 0, 24];
        controller.oldOrigin = [...controller.origin];
        controller.velocity = [200, 0, 0];
        controller.onGround = true;
        controller.movementTrace = (start, end) => ({
            entity: 7,
            solid: 4,
            trace: {
                allSolid: false,
                endPosition: [...start],
                fraction: 0.5,
                inOpen: true,
                inWater: false,
                modelIndex: 7,
                plane: { distance: 23, normal: [0, 0, 1] },
                startSolid: false
            }
        });
        let pointTraceCalls = 0;
        controller.pointTrace = (start, end) => {
            pointTraceCalls++;
            expect(start).toEqual([16, 0, 0]);
            expect(end).toEqual([16, 0, -34]);
            return {
                allSolid: false,
                endPosition: [16, 0, -1],
                fraction: 0.25,
                inOpen: true,
                inWater: false,
                modelIndex: 7,
                plane: { distance: -1, normal: [0, 0, 1] },
                startSolid: false
            };
        };

        controller.beginFrame(0.05);

        expect(pointTraceCalls).toBe(1);
        expect(controller.velocity[0]).toBeCloseTo(160);
        expect(controller.velocity[1]).toBe(0);
        expect(controller.velocity[2]).toBe(0);
    });

    it('matches source view-dependent wall friction', () => {
        expect(quakeWallFrictionVelocity(0, 0, [100, 50, 20], [-1, 0, 0])).toEqual([
            0, 25, 20
        ]);
        expect(quakeWallFrictionVelocity(0, 180, [100, 50, 20], [-1, 0, 0])).toEqual([
            100, 50, 20
        ]);
        expect(quakeServerWallFrictionVelocity(
            [0, 0.9, 0], [100, 50, 20], [-1, 0, 0]
        )).toEqual([0, 25, 20]);
        expect(quakeServerWallFrictionVelocity(
            [0, -0.9, 0], [100, 50, 20], [-1, 0, 0]
        )).toEqual([0, 25, 20]);
    });

    it('uses vertical swim intent before applying the idle sink', () => {
        expect(quakeWaterUpMove(false, false, false)).toBe(-60);
        expect(quakeWaterUpMove(false, true, false)).toBe(200);
        expect(quakeWaterUpMove(false, false, true)).toBe(-200);
        expect(quakeWaterUpMove(true, false, false)).toBe(0);
        expect(quakeSwimmingJumpSpeed(-3)).toBe(100);
        expect(quakeSwimmingJumpSpeed(-4)).toBe(80);
        expect(quakeSwimmingJumpSpeed(-5)).toBe(50);
    });
});

describe('Quake CD music', () => {
    it('maps the worldspawn byte to conventional user-owned track paths', () => {
        expect(quakeCdTrackNumber(258.9)).toBe(2);
        expect(quakeCdTrackNumber(Number.NaN)).toBe(0);
        expect(quakeMusicTrackPaths(0)).toEqual([]);
        expect(quakeMusicTrackPaths(2)).toEqual([
            '/game-data/id1/music/track02.ogg',
            '/game-data/id1/music/track02.mp3',
            '/game-data/id1/music/track02.flac',
            '/game-data/id1/music/track02.wav'
        ]);
        expect(quakeMusicTrackPaths(2, '/quake/')).toEqual([
            '/quake/game-data/id1/music/track02.ogg',
            '/quake/game-data/id1/music/track02.mp3',
            '/quake/game-data/id1/music/track02.flac',
            '/quake/game-data/id1/music/track02.wav'
        ]);
    });

    it('uses the source 8-bit volume boundary', () => {
        expect(quakeMusicGain(1)).toBe(1);
        expect(quakeMusicGain(0.5)).toBe(127 / 255);
        expect(quakeMusicGain(-1)).toBe(0);
        expect(quakeMusicGain(2)).toBe(1);
        expect(quakeMusicGain(Number.NaN)).toBe(0);
    });

    it('loads only a supplied matching track and otherwise remains silent', async () => {
        const requests: string[] = [];
        const supplied = await loadQuakeMusicTrack(
            2,
            (path) => {
                requests.push(path);
                return Promise.resolve({
                    arrayBuffer: () => Promise.resolve(new Uint8Array([2]).buffer),
                    ok: path.endsWith('.mp3')
                });
            },
            data => Promise.resolve(new Uint8Array(data)[0])
        );
        expect(supplied).toEqual({
            decoded: 2,
            path: '/game-data/id1/music/track02.mp3'
        });
        expect(requests).toEqual([
            '/game-data/id1/music/track02.ogg',
            '/game-data/id1/music/track02.mp3'
        ]);

        expect(await loadQuakeMusicTrack(
            2,
            () => Promise.resolve({
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
                ok: false
            }),
            () => Promise.resolve('unexpected')
        )).toBeUndefined();
    });
});

describe('Quake stereo spatialization', () => {
    it('treats only a visible focused page as audio-active', () => {
        expect(quakePageAudioActive('visible', true)).toBe(true);
        expect(quakePageAudioActive('visible', false)).toBe(false);
        expect(quakePageAudioActive('hidden', true)).toBe(false);
        expect(quakePageAudioActive('hidden', false)).toBe(false);
    });

    it('suspends enabled audio while inactive and resumes it in order', async () => {
        const operations: string[] = [];
        const context = {
            state: 'running' as AudioContextState,
            resume: (): Promise<void> => {
                operations.push('resume');
                context.state = 'running';
                return Promise.resolve();
            },
            suspend: (): Promise<void> => {
                operations.push('suspend');
                return Promise.resolve().then(() => {
                    context.state = 'suspended';
                });
            }
        };
        const focus = new QuakeAudioFocusController(context);

        const hidden = focus.setActive(false);
        const visible = focus.setActive(true);
        await Promise.all([hidden, visible]);

        expect(operations).toEqual(['suspend', 'resume']);
        expect(context.state).toBe('running');
    });

    it('does not auto-start audio that was never enabled by the user', async () => {
        const operations: string[] = [];
        const context = {
            state: 'suspended' as AudioContextState,
            resume: (): Promise<void> => {
                operations.push('resume');
                context.state = 'running';
                return Promise.resolve();
            },
            suspend: (): Promise<void> => {
                operations.push('suspend');
                context.state = 'suspended';
                return Promise.resolve();
            }
        };
        const focus = new QuakeAudioFocusController(context);

        await focus.setActive(false);
        await focus.setActive(true);
        expect(operations).toEqual([]);

        await focus.resumeFromGesture();
        expect(operations).toEqual(['resume']);
    });

    it('phase-combines identical static loops and retains the source channel cap', () => {
        const left = {
            attenuation: 1,
            origin: [0, 100, 0] as [number, number, number],
            sample: 'ambience/fire1.wav',
            volume: 1
        };
        const right = {
            ...left,
            origin: [0, -100, 0] as [number, number, number]
        };
        const other = { ...left, sample: 'ambience/hum1.wav' };
        const groups = quakeStaticSoundGroups([left, right, other]);

        expect(groups.map(group => [group.path, group.events.length])).toEqual([
            ['sound/ambience/fire1.wav', 2],
            ['sound/ambience/hum1.wav', 1]
        ]);
        expect(quakeCombinedStaticSoundGains(
            groups[0].events, [0, 0, 0], 0
        )).toEqual({ left: 459 / 255, right: 459 / 255 });
        expect(quakeStaticSoundGroups(
            Array.from({ length: QUAKE_MAX_STATIC_CHANNELS + 2 }, () => left)
        )[0].events).toHaveLength(QUAKE_MAX_STATIC_CHANNELS);
        expect(QUAKE_MAX_STATIC_CHANNELS).toBe(116);
    });

    it('matches source ambient threshold and frame-rate-scaled fading', () => {
        expect(quakeAmbientChannelVolume(0, 255, 0.1, 0.3, 100)).toBe(10);
        expect(quakeAmbientChannelVolume(70, 255, 0.1, 0.3, 100)).toBe(76);
        expect(quakeAmbientChannelVolume(10, 20, 0.1, 0.3, 100)).toBe(0);
        expect(quakeAmbientChannelVolume(30, 255, 0.05, 0, 100)).toBe(30);
        expect(quakeAmbientChannelVolume(0, 255, 0.005, 0.3, 100)).toBe(0);
    });

    it('silences ambient channels without discarding mixer volume state', () => {
        expect(quakeAmbientChannelState(30, 255, 0.05, 0, 100)).toEqual({
            active: false,
            volume: 30
        });
        expect(quakeAmbientChannelState(30, undefined, 0.05, 0.3, 100)).toEqual({
            active: false,
            volume: 30
        });
        expect(quakeAmbientChannelState(30, 255, 0.05, 0.3, 100)).toEqual({
            active: true,
            volume: 35
        });
    });

    it('holds a disabled looping sound at its exact source loop position', () => {
        expect(quakeLoopingSoundPlaybackOffset(0, 0.9, 0.25, 1)).toBeCloseTo(0.9);
        expect(quakeLoopingSoundPlaybackOffset(0, 1.2, 0.25, 1)).toBeCloseTo(0.45);
        expect(quakeLoopingSoundPlaybackOffset(0.9, 0.2, 0.25, 1)).toBeCloseTo(0.35);
        expect(quakeLoopingSoundPlaybackOffset(0.35, 0, 0.25, 1)).toBeCloseTo(0.35);
    });

    it('advances dynamic-channel end time at each source loop boundary', () => {
        expect(quakeLoopingSoundChannelEnd(12, 10, 2, 5)).toBe(12);
        expect(quakeLoopingSoundChannelEnd(12, 12, 2, 5)).toBe(15);
        expect(quakeLoopingSoundChannelEnd(12, 18.1, 2, 5)).toBe(21);
        expect(quakeLoopingSoundChannelEnd(12, 18.1)).toBe(12);
        expect(quakeLoopingSoundChannelEnd(12, 18.1, 5, 5)).toBe(12);
    });

    it('resets retained ambient slots to the source stop-all state', () => {
        expect(quakeStoppedAmbientChannelState()).toEqual({ offset: 0, volume: 0 });
        expect(quakeAmbientChannelState(
            quakeStoppedAmbientChannelState().volume, 255, 0.1, 0.3, 100
        )).toEqual({ active: true, volume: 10 });
    });

    it('uses the original right-vector sign and linear channel scaling', () => {
        expect(quakeSoundChannelGains([0, -100, 0], 1, 1, [0, 0, 0], 0)).toEqual({
            left: 0,
            right: 459 / 255
        });
        expect(quakeSoundChannelGains([0, 100, 0], 1, 1, [0, 0, 0], 0)).toEqual({
            left: 459 / 255,
            right: 0
        });
        expect(quakeSoundChannelGains(
            [100, 0, 0], 1, 1, [0, 0, 0], 0
        )).toEqual({ left: 229 / 255, right: 229 / 255 });
    });

    it('keeps listener sounds centered and applies packet-quantized attenuation', () => {
        expect(quakeSoundChannelGains(
            [10_000, 0, 0], 0.5, 1, [0, 0, 0], 0, true
        )).toEqual({ left: 127 / 255, right: 127 / 255 });
        expect(quakeSoundChannelGains(
            [500, 0, 0], 1, 1, [0, 0, 0], 0
        )).toEqual({ left: 127 / 255, right: 127 / 255 });
        expect(quakeSoundChannelGains(
            [500, 0, 0], 1, 1.01, [0, 0, 0], 0
        )).toEqual({ left: 127 / 255, right: 127 / 255 });
        expect(quakeSoundChannelGains(
            [250, 0, 0], 1, 3, [0, 0, 0], 0
        )).toEqual({ left: 63 / 255, right: 63 / 255 });
        expect(quakeSoundChannelGains(
            [500, 0, 0], 1, 3, [0, 0, 0], 0
        )).toEqual({ left: 0, right: 0 });
    });

    it('matches the eight-channel replacement and view-sound protection rules', () => {
        expect(quakePickDynamicChannel([], 2, 0, 1, 10)).toBe(0);
        const channels = Array.from({ length: 8 }, (_, index) => ({
            channel: index + 1,
            endsAt: 20 - index,
            entity: index === 0 ? 1 : index + 2
        }));
        expect(quakePickDynamicChannel(channels, 4, 3, 1, 10)).toBe(2);
        expect(quakePickDynamicChannel(channels, 20, 0, 1, 10)).toBe(7);
        const expiredThenEmpty = [
            { channel: 1, endsAt: 9, entity: 2 },
            undefined,
            { channel: 2, endsAt: 20, entity: 3 }
        ];
        expect(quakePickDynamicChannel(expiredThenEmpty, 20, 0, 1, 10)).toBe(1);
        expect(quakePickDynamicChannel(
            channels.map(channel => ({ ...channel, entity: 1 })),
            20,
            0,
            1,
            10
        )).toBeUndefined();
        expect(quakePickDynamicChannel(channels, 1, 0, 1, 10)).toBe(7);
        const withLocalSound = channels.map((channel, index) => ({
            ...channel,
            entity: index + 2
        }));
        withLocalSound[4] = { channel: -1, endsAt: 30, entity: 1 };
        expect(quakePickDynamicChannel(withLocalSound, 1, -1, 1, 10)).toBe(4);
        const withPlayerWeaponSound = [...withLocalSound];
        withPlayerWeaponSound[3] = { channel: 2, endsAt: 30, entity: 1 };
        expect(quakePickDynamicChannel(withPlayerWeaponSound, 1, -1, 1, 10)).toBe(3);
    });

    it('stops only the first matching dynamic slot in source slot order', () => {
        const channels = [
            { channel: 0, endsAt: 20, entity: 2 },
            { channel: 1, endsAt: 20, entity: 2 },
            { channel: 0, endsAt: 20, entity: 2 }
        ];

        expect(quakeStoppedSoundSlot(channels, 2, 0)).toBe(0);
        expect(quakeStoppedSoundSlot(channels, 2, 1)).toBe(1);
        expect(quakeStoppedSoundSlot(channels, 3, 0)).toBeUndefined();
        expect(quakeStoppedSoundSlot([
            undefined,
            undefined,
            undefined,
            undefined,
            { channel: 0, endsAt: 20, entity: 2 }
        ], 2, 0)).toBeUndefined();
    });

    it('routes local UI sounds through the tracked view-entity channel', () => {
        expect(quakeLocalSoundEvent('misc/menu1.wav', 7)).toEqual({
            attenuation: 1,
            channel: -1,
            entity: 7,
            origin: [0, 0, 0],
            sample: 'misc/menu1.wav',
            volume: 1
        });
    });

    it('serializes same-channel start and stop commands across asynchronous decoding', async () => {
        const start = {
            attenuation: 1,
            channel: 3,
            entity: 2,
            origin: [0, 0, 0] as [number, number, number],
            sample: 'weapons/rocket1i.wav',
            volume: 1
        };
        const stop = { channel: 3, entity: 2 };
        const order: string[] = [];
        const startSound = async (): Promise<void> => {
            order.push('start:begin');
            await Promise.resolve();
            order.push('start:end');
        };
        const stopSound = (): void => {
            order.push('stop');
        };
        const onError = (): void => {
            order.push('error');
        };

        await runQuakeSoundCommandsInOrder([
            { event: start, kind: 'start' },
            { event: stop, kind: 'stop' }
        ], startSound, stopSound, onError);
        expect(order).toEqual(['start:begin', 'start:end', 'stop']);

        order.length = 0;
        await runQuakeSoundCommandsInOrder([
            { event: stop, kind: 'stop' },
            { event: start, kind: 'start' }
        ], startSound, stopSound, onError);
        expect(order).toEqual(['stop', 'start:begin', 'start:end']);
    });

    it('applies WinQuake duplicate-effect start offsets in output-sample units', () => {
        expect(quakeDuplicateSoundOffsetSamples(
            false, 48_000, 4_800, 0, 1_234
        )).toBe(0);
        expect(quakeDuplicateSoundOffsetSamples(
            true, 48_000, 4_800, 0, 1_234
        )).toBe(1_234);
        expect(quakeDuplicateSoundOffsetSamples(
            true, 48_000, 100, 0, 1_234
        )).toBe(99);
        expect(quakeDuplicateSoundOffsetSamples(
            true, 48_000, 100, 2_000, 1_234
        )).toBe(1_234);
        expect(quakeDuplicateSoundOffsetSamples(
            true, 0, 100, 0, 1_234
        )).toBe(0);
    });

    it('maps duplicate offsets back to seconds after the source short-loop boundary', () => {
        expect(quakeDuplicateSoundPlaybackOffset(1_200, 48_000, 4_800))
        .toBeCloseTo(0.025);
        expect(quakeDuplicateSoundPlaybackOffset(1_200, 48_000, 1_000))
        .toBeCloseTo(0.025);
        expect(quakeDuplicateSoundPlaybackOffset(1_200, 48_000, 1_000, 0.01))
        .toBeCloseTo(0.01);
        expect(quakeDuplicateSoundPlaybackOffset(1_200, 0, 1_000, 0.01)).toBe(0);
    });
});

describe('Quake underwater screen warp', () => {
    it('matches the source integer sine-table coordinate mapping', () => {
        expect(quakeUnderwaterWarpCoordinate(0, 0, 320, 152, 0)).toEqual([2, 2]);
        expect(quakeUnderwaterWarpCoordinate(32, 96, 320, 152, 0)).toEqual([31, 97]);
        expect(quakeUnderwaterWarpCoordinate(0, 0, 320, 152, 1.6)).toEqual([4, 4]);
    });

    it('uses the source view-leaf contents threshold', () => {
        expect(usesQuakeUnderwaterWarp(-1)).toBe(false);
        expect(usesQuakeUnderwaterWarp(-2)).toBe(false);
        expect(usesQuakeUnderwaterWarp(-3)).toBe(true);
        expect(usesQuakeUnderwaterWarp(-4)).toBe(true);
        expect(usesQuakeUnderwaterWarp(-5)).toBe(true);
    });
});

describe('Quake turbulent liquid mapping', () => {
    it('matches the source fixed-point sine table and cross-axis lookup', () => {
        expect(QUAKE_TURBULENCE_OFFSETS[0]).toBe(8);
        expect(QUAKE_TURBULENCE_OFFSETS[32]).toBe(15);
        expect(QUAKE_TURBULENCE_OFFSETS[96]).toBe(0);
        expect(quakeTurbulentTextureCoordinate(0, 0, 0)).toEqual([8, 8]);
        expect(quakeTurbulentTextureCoordinate(32, 96, 0)).toEqual([32, 47]);
        expect(quakeTurbulentTextureCoordinate(0, 0, 1.6)).toEqual([15, 15]);
    });

    it('wraps negative surface coordinates like the source bit masks', () => {
        expect(quakeTurbulentTextureCoordinate(-1, -1, 0)).toEqual([6, 6]);
    });
});

describe('Quake model effects and particle projection', () => {
    it('renders particles before the UI post-process boundary', () => {
        expect(quakeParticleLayerInsertionIndex([
            { id: 0 }, { id: LAYERID_UI }, { id: 5 }
        ])).toBe(1);
        expect(quakeParticleLayerInsertionIndex([{ id: 0 }, { id: 1 }])).toBe(2);
    });

    it('retains WinQuake\'s selectable Video Options row', () => {
        expect(QUAKE_OPTIONS_MENU_ITEMS).toHaveLength(13);
        expect(QUAKE_OPTIONS_MENU_ITEMS[12]).toBe('         Video Options');
    });

    it('uses the software renderer alias winding and near clip', () => {
        expect(QUAKE_ALIAS_FRONT_FACE).toBe(FRONTFACE_CW);
        expect(QUAKE_ALIAS_NEAR_CLIP).toBe(5);
    });

    it('decodes the original alias-model flag precedence', () => {
        expect(quakeModelTrailType(1)).toBe(0);
        expect(quakeModelTrailType(2)).toBe(1);
        expect(quakeModelTrailType(4 | 1)).toBe(2);
        expect(quakeModelTrailType(32)).toBe(4);
        expect(quakeModelTrailType(16)).toBe(3);
        expect(quakeModelTrailType(64)).toBe(5);
        expect(quakeModelTrailType(128)).toBe(6);
        expect(quakeModelTrailType(EF_ROTATE)).toBeUndefined();
        expect(hasQuakeRocketLight(1)).toBe(true);
    });

    it('matches client-side item rotation and logical software particle sizes', () => {
        expect(quakeRotatingModelYaw(0)).toBe(0);
        expect(quakeRotatingModelYaw(1.8)).toBe(180);
        expect(quakeRotatingModelYaw(3.6)).toBe(0);
        expect(quakeParticlePixelSize(64, 320)).toBe(4);
        expect(quakeParticlePixelSize(128, 320)).toBe(2);
        expect(quakeParticlePixelSize(256, 320)).toBe(1);
        expect(quakeParticlePixelSize(64, 640)).toBe(8);
        expect(quakeParticlePixelSize(
            64, quakeViewLayout(100).viewRect.width
        )).toBe(4);
        expect(quakeParticlePixelSize(
            64, quakeViewLayout(70).viewRect.width
        )).toBe(3);
    });

    it('scales logical particles once into the resized framebuffer', () => {
        const viewRect = quakeViewLayout(100).viewRect;
        const compactBuffer = quakeCanvasDisplaySize(320, 200, viewRect);
        const largeBuffer = quakeCanvasDisplaySize(1_152, 720, viewRect);

        expect(compactBuffer).toEqual({ height: 152, width: 320 });
        expect(largeBuffer).toEqual({ height: 547, width: 1_152 });
        expect(quakeParticlePixelSize(64, viewRect.width)).toBe(4);
        expect(quakeParticlePixelSize(64, largeBuffer.width)).toBe(14);
        expect(quakeParticleDisplayPixelSize(
            64, viewRect.width, compactBuffer.width
        )).toBe(4);
        expect(quakeParticleDisplayPixelSize(
            64, viewRect.width, largeBuffer.width
        )).toBe(14);
        expect(quakeParticleDisplayPixelSize(
            128, viewRect.width, largeBuffer.width
        )).toBe(7);
    });

    it('matches the software particle near clip, projection rounding, and edge guard', () => {
        expect(QUAKE_PARTICLE_NEAR_CLIP).toBe(8);
        expect(quakeParticleRaster(159.6, 75.6, 64, 320, 152)).toEqual({
            size: 4,
            topLeft: [160, 76],
            visible: true
        });
        expect(quakeParticleRaster(-0.6, -0.6, 64, 320, 152)).toMatchObject({
            topLeft: [0, 0],
            visible: true
        });
        expect(quakeParticleRaster(160, 76, 7.999, 320, 152).visible).toBe(false);
        expect(quakeParticleRaster(316, 148, 64, 320, 152).visible).toBe(true);
        expect(quakeParticleRaster(317, 148, 64, 320, 152).visible).toBe(false);
        expect(quakeParticleRaster(316, 149, 64, 320, 152).visible).toBe(false);
    });

    it('uses the high bits of its deterministic C-shaped particle random sequence', () => {
        const state = quakeParticleRandomState(0x4d595df4);
        expect(state).toBe(1_214_613_789);
        expect(quakeParticleRandomValue(state)).toBe(18_533);
        expect(quakeParticleRandomValue(state)).toBeLessThanOrEqual(0x7fff);
    });

    it('matches the source teleporter random-call order and particle state', () => {
        const values = [5, 6, 1, 2, 3, 4];
        const particle = quakeTeleportParticleState(
            [100, 200, 300], 0, 0, 4, 10, () => values.shift() ?? 0
        );
        expect(values).toEqual([]);
        expect(particle.color).toBe(13);
        expect(particle.die).toBeCloseTo(10.3);
        expect(particle.origin).toEqual([101, 202, 307]);
        expect(particle.velocity).toEqual([0, 0, 54]);
    });

    it('matches source random-call order for ordinary impact particles', () => {
        const values = [3, 6, 1, 2, 3];
        const particle = quakeEffectParticleState(
            [100, 200, 300], [1, 2, 3], 20, 10,
            () => values.shift() ?? 0
        );
        expect(values).toEqual([]);
        expect(particle).toEqual({
            color: 22,
            die: 10.3,
            origin: [93, 194, 295],
            velocity: [15, 30, 45]
        });
    });

    it('interleaves explosion-two origin and velocity random calls per axis', () => {
        const values = [1, 2, 3, 4, 5, 6];
        const particle = quakeExplosionTwoParticleState(
            [100, 200, 300], 224, 4, 5, 10,
            () => values.shift() ?? 0
        );
        expect(values).toEqual([]);
        expect(particle).toEqual({
            color: 225,
            die: 10.3,
            origin: [85, 187, 289],
            velocity: [-254, -252, -250]
        });
    });

    it('consumes blob lifetime and color before interleaved axis state', () => {
        const values = [8, 5, 1, 2, 3, 4, 5, 6];
        const particle = quakeBlobParticleState(
            [100, 200, 300], true, 10, () => values.shift() ?? 0
        );
        expect(values).toEqual([]);
        expect(particle).toEqual({
            color: 71,
            die: 11.4,
            origin: [85, 187, 289],
            velocity: [-254, -252, -250]
        });
    });

    it('matches lava lifetime, color, direction, height, and speed call order', () => {
        const values = [31, 7, 1, 2, 3, 4];
        const particle = quakeLavaParticleState(
            [100, 200, 300], 0, 0, 10, () => values.shift() ?? 0
        );
        expect(values).toEqual([]);
        expect(particle.color).toBe(231);
        expect(particle.die).toBeCloseTo(12.62);
        expect(particle.origin).toEqual([101, 202, 303]);
        expect(Math.hypot(...particle.velocity)).toBeCloseTo(54);
        expect(particle.velocity[0]).toBeCloseTo(54 / Math.sqrt(65_541));
        expect(particle.velocity[1]).toBeCloseTo(108 / Math.sqrt(65_541));
        expect(particle.velocity[2]).toBeCloseTo(13_824 / Math.sqrt(65_541));
    });

    it('keeps the particle color and position attributes at distinct GPU locations', () => {
        const locations = semanticToLocation as Record<string, number>;
        expect(locations[SEMANTIC_ATTR1]).not.toBe(locations[SEMANTIC_POSITION]);
    });

    it('matches the original bright-field normal shell and orbit offset', () => {
        expect(quakeEntityParticleOrigin([0, 0, 0], [1, 0, 0], [0, 0, 0], 0))
        .toEqual([80, 0, 0]);
        const orbit = quakeEntityParticleOrigin(
            [0, 0, 0], [0, 0, 1], [Math.PI / 2, 0, 0], 1
        );
        expect(orbit[0]).toBeCloseTo(0);
        expect(orbit[1]).toBeCloseTo(16);
        expect(orbit[2]).toBeCloseTo(64);
    });
});

describe('Quake alias orientation and temporary beams', () => {
    it('converts the source alias basis into PlayCanvas coordinates', () => {
        const identityDirection = quakeAliasRotation([0, 0, 0])
        .transformVector(new PlayCanvasVec3(1, 0, 0));
        expect(identityDirection.x).toBeCloseTo(1);
        expect(identityDirection.y).toBeCloseTo(0);
        expect(identityDirection.z).toBeCloseTo(0);

        const yawDirection = quakeAliasRotation([0, 90, 0])
        .transformVector(new PlayCanvasVec3(1, 0, 0));
        expect(yawDirection.x).toBeCloseTo(0);
        expect(yawDirection.y).toBeCloseTo(0);
        expect(yawDirection.z).toBeCloseTo(-1);
        const lightDirection = quakeAliasLightDirection([0, 90, 0]);
        expect(lightDirection[0]).toBeCloseTo(0);
        expect(lightDirection[1]).toBeCloseTo(0);
        expect(lightDirection[2]).toBeCloseTo(1);

        const aliasPitch = quakeAliasRotation([90, 0, 0])
        .transformVector(new PlayCanvasVec3(1, 0, 0));
        const entityPitch = quakeEntityRotation([90, 0, 0])
        .transformVector(new PlayCanvasVec3(1, 0, 0));
        expect(aliasPitch.y).toBeCloseTo(1);
        expect(entityPitch.y).toBeCloseTo(-1);
    });

    it('uses source pitch/yaw and 30-unit model segmentation', () => {
        expect(layoutQuakeBeam([0, 0, 0], [61, 0, 0])).toEqual({
            angles: [0, 0, 0],
            origins: [[0, 0, 0], [30, 0, 0], [60, 0, 0]]
        });
        expect(layoutQuakeBeam([1, 2, 3], [1, 2, 34])).toEqual({
            angles: [90, 0, 0],
            origins: [[1, 2, 3], [1, 2, 33]]
        });
    });

    it('maps source oriented and upright sprite axes without mirroring', () => {
        const orientedRight = quakeOrientedSpriteRotation([0, 0, 0])
        .transformVector(new PlayCanvasVec3(1, 0, 0));
        expect(orientedRight.x).toBeCloseTo(0);
        expect(orientedRight.y).toBeCloseTo(0);
        expect(orientedRight.z).toBeCloseTo(1);

        const upright = quakeUprightSpriteRotation([1, 0, 0]);
        expect(upright).toBeDefined();
        const uprightRight = upright?.transformVector(new PlayCanvasVec3(1, 0, 0));
        expect(uprightRight?.x).toBeCloseTo(0);
        expect(uprightRight?.y).toBeCloseTo(0);
        expect(uprightRight?.z).toBeCloseTo(1);
        expect(quakeUprightSpriteRotation([0, 1, 0])).toBeUndefined();
    });

    it('keeps the source weapon offset relative to an un-kicked camera', () => {
        expect([
            70, 80, 90, 100, 110, 120
        ].map(quakeViewModelVerticalOffset)).toEqual([0, 0.5, 1, 2, 1, 0]);
        const cameraRotation = quakeOrientedSpriteRotation([0, 0, 0]);
        const position = quakeViewModelLocalPosition(cameraRotation, [0, 0, 0], 4);
        expect(position.x).toBeCloseTo(1 / 32);
        expect(position.y).toBeCloseTo(2 - 1 / 32);
        expect(position.z).toBeCloseTo(-1.6 + 1 / 32);
        const reducedViewPosition = quakeViewModelLocalPosition(
            cameraRotation, [0, 0, 0], 4, quakeViewModelVerticalOffset(70)
        );
        expect(reducedViewPosition.y).toBeCloseTo(-1 / 32);
        const offsetPosition = quakeViewModelLocalPosition(
            cameraRotation, [0, 0, 0], 4, 2, [10, -2, 3]
        );
        const expectedOffsetDelta = cameraRotation.clone().invert().transformVector(
            new PlayCanvasVec3(-10, -3, -2)
        );
        expect(offsetPosition.x - position.x).toBeCloseTo(expectedOffsetDelta.x);
        expect(offsetPosition.y - position.y).toBeCloseTo(expectedOffsetDelta.y);
        expect(offsetPosition.z - position.z).toBeCloseTo(expectedOffsetDelta.z);

        const rotation = quakeViewModelLocalRotation(cameraRotation, [0, 0, 0]);
        const forward = rotation.transformVector(new PlayCanvasVec3(0, 0, -1));
        expect(forward.x).toBeCloseTo(0);
        expect(forward.y).toBeCloseTo(0);
        expect(forward.z).toBeCloseTo(-1);

        const turnedCamera = quakeOrientedSpriteRotation([20, 70, 0]);
        const turnedWeapon = quakeViewModelLocalRotation(turnedCamera, [-20, 70, 0]);
        const turnedForward = turnedWeapon.transformVector(new PlayCanvasVec3(0, 0, -1));
        expect(turnedForward.x).toBeCloseTo(0);
        expect(turnedForward.y).toBeCloseTo(0);
        expect(turnedForward.z).toBeCloseTo(-1);

        const shadeDirection = quakeViewModelLightDirection([-20, 70, 0]);
        expect(Math.hypot(...shadeDirection)).toBeCloseTo(1);
        expect(quakeViewModelLightDirection([0, 90, 0])[0]).toBeCloseTo(1);
    });
});

describe('Quake grouped animation timing', () => {
    it('falls back to model frame or skin zero for every invalid index', () => {
        expect(quakeModelIndex(2, 3)).toBe(2);
        expect(quakeModelIndex(2.9, 3)).toBe(2);
        expect(quakeModelIndex(-1, 3)).toBe(0);
        expect(quakeModelIndex(3, 3)).toBe(0);
        expect(quakeModelIndex(255, 3)).toBe(0);
        expect(quakeModelIndex(Number.NaN, 3)).toBe(0);
    });

    it('uses cumulative intervals and an absolute random-sync time offset', () => {
        const intervals = [0.1, 0.2, 0.3];
        expect(quakeGroupFrameIndex(intervals, 0.099)).toBe(0);
        expect(quakeGroupFrameIndex(intervals, 0.1)).toBe(1);
        expect(quakeGroupFrameIndex(intervals, 0.299)).toBe(2);
        expect(quakeGroupFrameIndex(intervals, 0.3)).toBe(0);
        expect(quakeGroupFrameIndex(intervals, 0, 0.15)).toBe(1);

        const syncBase = quakeEntitySyncBase(17);
        expect(syncBase).toBeGreaterThanOrEqual(0);
        expect(syncBase).toBeLessThanOrEqual(1);
        expect(quakeEntitySyncBase(17)).toBe(syncBase);
    });

    it('parses cumulative grouped SPR frames in the original disk layout', () => {
        const bytes = new Uint8Array(86);
        bytes.set(new TextEncoder().encode('IDSP'));
        const view = new DataView(bytes.buffer);
        const int32 = (offset: number, value: number): void => {
            view.setInt32(offset, value, true);
        };
        const float32 = (offset: number, value: number): void => {
            view.setFloat32(offset, value, true);
        };
        int32(4, SPRITE_VERSION);
        int32(8, 2);
        float32(12, 1);
        int32(16, 1);
        int32(20, 1);
        int32(24, 1);
        float32(28, 0);
        int32(32, 1);
        int32(36, 1);
        int32(40, 2);
        float32(44, 0.1);
        float32(48, 0.3);
        int32(52, -2);
        int32(56, 3);
        int32(60, 1);
        int32(64, 1);
        bytes[68] = 11;
        int32(69, 4);
        int32(73, 5);
        int32(77, 1);
        int32(81, 1);
        bytes[85] = 22;

        const model = new SpriteModel(bytes);
        expect(model.frames).toHaveLength(1);
        expect(model.frames[0].intervals[0]).toBeCloseTo(0.1);
        expect(model.frames[0].intervals[1]).toBeCloseTo(0.3);
        expect(model.frames[0].frames.map(frame => ({
            origin: frame.origin,
            pixels: [...frame.pixels]
        }))).toEqual([
            { origin: [-2, 3], pixels: [11] },
            { origin: [4, 5], pixels: [22] }
        ]);
        expect(quakeGroupFrameIndex(model.frames[0].intervals, 0.11)).toBe(1);
        expect(model.offset).toBe(bytes.length);
    });
});

describe('Quake status-bar animation', () => {
    it('cycles five pickup frames for one second before selecting the active icon', () => {
        expect(quakeWeaponIconName('shotgun', 1, 1, 2, 2)).toBe('inva1_shotgun');
        expect(quakeWeaponIconName('shotgun', 1, 1, 2, 2.49)).toBe('inva5_shotgun');
        expect(quakeWeaponIconName('shotgun', 1, 1, 2, 3)).toBe('inv2_shotgun');
        expect(quakeWeaponIconName('shotgun', 1, 2, 0, 0)).toBe('inv_shotgun');
    });
});

describe('Quake loading compositor', () => {
    it('uses the source-shaped console boot sequence instead of a custom loader', () => {
        expect(quakeStartupConsoleLines(true)).toEqual([
            'Playing shareware version.',
            'execing quake.rc',
            'execing default.cfg',
            'execing config.cfg',
            'execing autoexec.cfg'
        ]);
        expect(quakeStartupConsoleLines(false)[0]).toBe('Playing registered version.');
    });

    it('preserves the live status-bar values underneath the loading plaque', () => {
        expect(quakeLoadingHudState({
            activeWeapon: 4,
            ammo: 7,
            armor: 63,
            health: 42,
            items: 0x1234
        })).toEqual({
            activeWeapon: 4,
            ammo: 7,
            armor: 63,
            health: 42,
            items: 0x1234,
            loading: true
        });
    });
});

describe('Quake software crosshair', () => {
    it('uses the source view-rectangle center without centering the 8-pixel glyph', () => {
        expect(quakeCrosshairPosition({ height: 152, width: 320, x: 0, y: 0 })).toEqual([
            160, 76
        ]);
        expect(quakeCrosshairPosition({ height: 140, width: 224, x: 48, y: 6 })).toEqual([
            160, 76
        ]);
    });

    it('truncates floating cl_crossx and cl_crossy offsets like C integer arguments', () => {
        expect(quakeCrosshairPosition(
            { height: 60, width: 96, x: 112, y: 46 },
            -2.75,
            3.9
        )).toEqual([157, 79]);
    });
});

describe('Quake screen timing cvars', () => {
    it('slides the console by scr_conspeed times host frame time and clamps overshoot', () => {
        expect(quakeConsoleHeight(0, 100, 0.1)).toBe(30);
        expect(quakeConsoleHeight(90, 100, 0.1)).toBe(100);
        expect(quakeConsoleHeight(100, 0, 0.1)).toBe(70);
        expect(quakeConsoleHeight(5, 0, 0.1)).toBe(0);
        expect(quakeConsoleHeight(0, 100, 0.1, -300)).toBe(-30);
    });

    it('reproduces the finale post-decrement character limit', () => {
        expect(quakeFinaleVisibleCharacters(0, 8)).toBe(1);
        expect(quakeFinaleVisibleCharacters(0.24, 8)).toBe(2);
        expect(quakeFinaleVisibleCharacters(0.25, 8)).toBe(3);
        expect(quakeFinaleVisibleCharacters(1, -1)).toBe(Number.POSITIVE_INFINITY);
    });
});

describe('Quake browser screenshots', () => {
    it('retains the source two-digit sequence and one-hundred-file ceiling', () => {
        expect(quakeScreenshotName(0)).toBe('quake00.png');
        expect(quakeScreenshotName(9)).toBe('quake09.png');
        expect(quakeScreenshotName(99)).toBe('quake99.png');
        expect(quakeScreenshotName(100)).toBeUndefined();
        expect(quakeScreenshotName(1.5)).toBeUndefined();
    });
});

describe('Quake menu compositor', () => {
    it('keeps exactly one source pixel in each four-pixel software fade group', () => {
        expect([0, 1, 2, 3].map(x => quakeMenuFadeOpaque(x, 0))).toEqual([
            false, true, true, true
        ]);
        expect([0, 1, 2, 3].map(x => quakeMenuFadeOpaque(x, 1))).toEqual([
            true, true, false, true
        ]);
    });

    it('uses the complete WinQuake credits quit panel instead of Unix taunts', () => {
        expect(QUAKE_WINQUAKE_QUIT_CREDITS).toHaveLength(21);
        expect(QUAKE_WINQUAKE_QUIT_CREDITS[0]).toEqual({
            color: 'white',
            text: '  Quake version 1.09 by id Software\n\n',
            x: 16,
            y: 12
        });
        expect(QUAKE_WINQUAKE_QUIT_CREDITS).toContainEqual({
            color: 'brown',
            text: ' Trent Reznor and Nine Inch Nails\n\n',
            x: 16,
            y: 132
        });
        expect(QUAKE_WINQUAKE_QUIT_CREDITS.at(-1)).toEqual({
            color: 'white',
            text: 'reserved. Press y to exit\n',
            x: 16,
            y: 180
        });
        expect(QUAKE_WINQUAKE_QUIT_CREDITS.some(
            line => line.text.includes('Are you gonna quit')
        )).toBe(false);
    });

    it('restores Quit to the exact prior menu or directly to gameplay', () => {
        expect(quakeQuitReturnMenu(quakeQuitPreviousMenu(undefined, 0, 0))).toBeUndefined();
        expect(quakeQuitReturnMenu(quakeQuitPreviousMenu('main', 4, 0))).toEqual({
            cursor: 4,
            page: 0,
            screen: 'main'
        });
        expect(quakeQuitReturnMenu(quakeQuitPreviousMenu('help', 0, 5))).toEqual({
            cursor: 0,
            page: 5,
            screen: 'help'
        });
        expect(quakeQuitPreviousMenu('newgame', 0, 0)).toBeUndefined();
        expect(quakeQuitPreviousMenu('quit', 0, 0)).toBeUndefined();
    });

    it('stamps the WinQuake source version into indexed conback pixels', () => {
        const background = new Uint8Array(320 * 200);
        const characters = new Uint8Array(128 * 128);
        characters[16 * 128 + 64] = 1;
        characters[40 * 128 + 56] = 2;
        characters[24 * 128 + 8] = 5;

        const stamped = stampQuakeConsoleVersion(background, characters);

        expect(stamped[186 * 320 + 189]).toBe(0x61);
        expect(stamped[186 * 320 + 197]).toBe(0x62);
        expect(stamped[186 * 320 + 277]).toBe(0x65);
        expect(stamped[186 * 320 + 188]).toBe(0);
        expect(stamped[186 * 320 + 276]).toBe(0);
        expect(background[186 * 320 + 277]).toBe(0);
    });

    it('builds the source player shirt and pants translation ranges', () => {
        const translation = quakePlayerTranslation(2, 10);

        expect([...translation.slice(16, 32)]).toEqual(
            Array.from({ length: 16 }, (_, index) => 32 + index)
        );
        expect([...translation.slice(96, 112)]).toEqual(
            Array.from({ length: 16 }, (_, index) => 175 - index)
        );
        expect([translation[0], translation[15], translation[32], translation[95],
            translation[112], translation[255]]).toEqual([0, 15, 32, 95, 112, 255]);
    });

    it('applies the source name and color console-command rules', () => {
        expect(quakePlayerName('12345678901234567890')).toBe('123456789012345');
        expect(quakePlayerNameCommand([], 'player')).toBe('player');
        expect(quakePlayerNameCommand(['The', 'Ranger'], 'player')).toBe('The Ranger');
        expect(quakePlayerColorsCommand([], 42)).toEqual({
            bottom: 10,
            encoded: 42,
            top: 2
        });
        expect(quakePlayerColorsCommand(['4'], 0)).toEqual({
            bottom: 4,
            encoded: 68,
            top: 4
        });
        expect(quakePlayerColorsCommand(['14', '-1'], 0)).toEqual({
            bottom: 13,
            encoded: 221,
            top: 13
        });
        expect(quakePlayerColorsCommand(['garbage', '18ignored'], 0)).toEqual({
            bottom: 2,
            encoded: 2,
            top: 0
        });
        expect(quakePlayerColorsFromCvar(255)).toEqual({
            bottom: 13,
            encoded: 221,
            top: 13
        });
    });
});

describe('Quake dynamic-light accumulation', () => {
    it('matches the source lightmap distance metric and 8.8 contribution', () => {
        expect(quakeDynamicLightContribution(215, 0, 0, 16, 32)).toBe(175 * 256);
        expect(quakeDynamicLightContribution(100, 32, 20, 48, 48)).toBe(0);
        expect(quakeDynamicLightContribution(100, 0, 101, 0, 0)).toBe(0);
        expect(quakeDynamicLightmapValue(175 * 256)).toBe(175);
        expect(quakeDynamicLightmapValue(255 * 256)).toBe(255);
        expect(quakeDynamicLightmapValue(350 * 256)).toBe(255);
        expect(quakeColormapGrade(quakeDynamicLightmapValue(350 * 256) * 256)).toBe(0);
    });
});

describe('Quake indexed lighting', () => {
    it('matches the source 8.8 light inversion and 64-grade clamp', () => {
        expect(quakeColormapGrade(0)).toBe(63);
        expect(quakeColormapGrade(128 * 256)).toBe(31);
        expect(quakeColormapGrade(255 * 256)).toBe(0);
        expect(quakeColormapGrade(300 * 256)).toBe(0);
    });

    it('uses the software surface cache darkness and mip-block interpolation', () => {
        expect(quakeSurfaceDarkness(0)).toBe(16_320);
        expect(quakeSurfaceDarkness(255 * 256)).toBe(64);
        expect([1, 1.01, 2.5, 2.51, 5, 5.01].map(
            quakeSurfaceMipLevel
        )).toEqual([0, 1, 1, 2, 2, 3]);
        expect([1, 0.4, 0.2, 0.19].map(
            quakeSurfaceMipLevelForScale
        )).toEqual([0, 1, 2, 3]);
        expect(quakeTextureMipAdjustment([
            [1, 0, 0, 0], [0, 1, 0, 0]
        ])).toBe(1);
        expect(quakeTextureMipAdjustment([
            [0.5, 0, 0, 0], [0, 0.5, 0, 0]
        ])).toBe(2);
        expect(quakeTextureMipAdjustment([
            [0.4, 0, 0, 0], [0, 0.4, 0, 0]
        ])).toBe(3);
        expect(quakeTextureMipAdjustment([
            [0.2, 0, 0, 0], [0, 0.2, 0, 0]
        ])).toBe(4);
        const surfaceAtDepth = (depth: number) => [
            [-10, -10, depth], [10, -10, depth],
            [10, 10, depth], [-10, 10, depth]
        ] as [number, number, number][];
        const mipForDepth = (depth: number) => quakeSurfaceMipLevelForView(
            surfaceAtDepth(depth),
            [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
            320, 152, 1
        );
        expect([160, 161, 400, 401, 800, 801].map(mipForDepth)).toEqual([
            0, 1, 1, 2, 2, 3
        ]);
        expect(quakeSurfaceMipLevelForView(
            surfaceAtDepth(800),
            [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
            320, 152, 1, 10
        )).toBe(0);
        expect(quakeSurfaceMipLevelForView(
            surfaceAtDepth(160),
            [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
            320, 152, 1, 170
        )).toBe(3);
        expect(quakeSurfaceMipLevelForView(
            surfaceAtDepth(160).map(
                point => [point[0] + 400, point[1], point[2]]
            ) as [number, number, number][],
            [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1],
            320, 152, 1
        )).toBeUndefined();
        const instanceTransform = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            1176, -432, -936, 1
        ]);
        expect(quakeFaceWorldVertices(
            [0, 0, 0, 32, 16, -32], 0, 2, instanceTransform
        )).toEqual([
            [1176, 936, -432],
            [1208, 968, -416]
        ]);
        const corners = [
            0,
            255 * 256,
            128 * 256,
            64 * 256
        ] as const;

        expect(quakeSurfaceLightGrade(corners, 0, 0, 0)).toBe(59);
        expect(quakeSurfaceLightGrade(corners, 15, 0, 0)).toBe(0);
        expect(quakeSurfaceLightGrade(corners, 0, 0, 1)).toBe(55);
        expect(quakeSurfaceLightGrade(corners, 7, 0, 1)).toBe(0);
    });
});

describe('Quake alias lighting', () => {
    it('uses the original lightstyle scale and alias light clamps', () => {
        expect(quakeLightStyleScale(0, 0)).toBe(264);
        const lighting = calculateQuakeAliasLighting(100, [0, 0, 0], 90, [{
            origin: [0, 0, 0], radius: 100
        }]);

        expect(lighting.ambient * 255).toBe(128);
        expect(lighting.shade * 255).toBe(64);
        expect(lighting.shadeDirection[0]).toBeCloseTo(0);
        expect(lighting.shadeDirection[2]).toBeCloseTo(1);
        expect(quakeAliasColormapGrade(128, 64, 1)).toBe(15);
        expect(quakeAliasColormapGrade(128, 64, 0)).toBe(31);
        expect(calculateQuakeAliasLighting(0, [0, 0, 0], 0, []).ambient * 255).toBe(5);
    });

    it('perspective-compensates alias skin and light varyings for affine rasterization', () => {
        expect(ALIAS_VERTEX_SHADER).toContain('aUv0 * gl_Position.w');
        expect(ALIAS_VERTEX_SHADER).toContain(') * gl_Position.w;');
        expect(ALIAS_FRAGMENT_SHADER).toContain('vTextureCoord * gl_FragCoord.w');
        expect(ALIAS_FRAGMENT_SHADER).toContain('vLightNumber * gl_FragCoord.w');
        expect(ALIAS_VERTEX_SHADER).not.toContain('normalize(aNormal)');
    });
});

describe('Quake BSP visibility', () => {
    it('uses the source leaf-one-based PVS bit numbering and always includes the camera leaf', () => {
        const visibility = new Uint8Array([0b0000_0101]);

        expect(quakePvsContainsLeaf(visibility, 2, 1)).toBe(true);
        expect(quakePvsContainsLeaf(visibility, 2, 2)).toBe(true);
        expect(quakePvsContainsLeaf(visibility, 2, 3)).toBe(true);
        expect(quakePvsContainsLeaf(visibility, 2, 4)).toBe(false);
    });
});

describeWithPak('Quake shareware data', () => {
    const pak = new PakArchive(fs.readFileSync(pakPath));

    const createE1m1PickupWorld = (
        initialCvars?: Readonly<Record<string, string>>
    ) => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm,
            map,
            new WorldCollision(map),
            'e1m1',
            undefined,
            pak,
            initialCvars
        );
        for (let tick = 0; tick < 5; tick++) {
            world.update(0.05);
        }
        return { map, vm, world };
    };

    type E1m1PickupWorld = ReturnType<typeof createE1m1PickupWorld>;

    const activeE1m1Entity = (
        state: E1m1PickupWorld,
        classname: string,
        selector: (entity: Readonly<Record<string, string>>) => boolean = () => true
    ): number => {
        for (let index = 0; index < state.map.entities.length; index++) {
            const entity = state.map.entities[index];
            if (entity.classname !== classname || !selector(entity)) continue;
            const reference = state.world.entityReferences[index];
            if (reference !== null && !state.vm.entity(reference).free &&
                state.vm.getEntityFloat(reference, 'solid') === 1) {
                return reference;
            }
        }
        throw new Error(`E1M1 has no active ${classname} matching the test`);
    };

    const touchE1m1Entity = (state: E1m1PickupWorld, reference: number): void => {
        const player = state.world.playerResult(false);
        state.world.update(0.01, {
            angles: player.angles,
            attack: false,
            jump: false,
            onGround: true,
            origin: state.vm.getEntityVector(reference, 'origin'),
            velocity: [0, 0, 0]
        });
    };

    const prepareE1m1SoldierShot = (world: QuakeWorldRuntime) => {
        world.update(0.1);
        world.update(0.01);
        const vm = world.vm;
        const player = world.playerReference;
        const playerState = world.playerResult();
        const soldier = world.entityReferences.find((reference, index) => (
            world.map.entities[index].classname === 'monster_army' && reference !== null &&
            !vm.entity(reference).free &&
            vm.getEntityString(reference, 'model') === 'progs/soldier.mdl'
        ));
        if (soldier === null || soldier === undefined) {
            throw new Error('E1M1 soldier was not spawned');
        }
        const soldierMins = vm.getEntityVector(soldier, 'mins');
        const soldierMaxs = vm.getEntityVector(soldier, 'maxs');
        const playerMins = vm.getEntityVector(player, 'mins');
        const playerMaxs = vm.getEntityVector(player, 'maxs');
        const shotHeight = playerState.origin[2] + playerMins[2] - 1 +
            (playerMaxs[2] - playerMins[2]) * 0.7;
        let yaw = 0;
        let shotSource: [number, number, number] | undefined;
        let soldierCenter: [number, number, number] | undefined;
        for (let candidateYaw = 0; candidateYaw < 360; candidateYaw += 45) {
            const radians = candidateYaw * Math.PI / 180;
            const forward: [number, number, number] = [
                Math.cos(radians), Math.sin(radians), 0
            ];
            const candidateSource: [number, number, number] = [
                playerState.origin[0] + forward[0] * 10,
                playerState.origin[1] + forward[1] * 10,
                shotHeight
            ];
            const wallTrace = world.traceLine(candidateSource, [
                candidateSource[0] + forward[0] * 2_048,
                candidateSource[1] + forward[1] * 2_048,
                candidateSource[2]
            ], true, player).trace;
            if (wallTrace.fraction * 2_048 <= 128) continue;
            yaw = candidateYaw;
            shotSource = candidateSource;
            soldierCenter = [
                candidateSource[0] + forward[0] * 64,
                candidateSource[1] + forward[1] * 64,
                candidateSource[2]
            ];
            break;
        }
        if (!shotSource || !soldierCenter) {
            throw new Error('E1M1 spawn has no clear shotgun test direction');
        }
        world.setEntityOrigin(soldier, soldierCenter.map(
            (component, axis) => component -
                (soldierMins[axis] + soldierMaxs[axis]) / 2
        ) as [number, number, number]);
        expect(world.traceLine(shotSource, soldierCenter, false, player).entity).toBe(soldier);
        const yawRadians = yaw * Math.PI / 180;
        expect(world.traceLine(shotSource, [
            shotSource[0] + Math.cos(yawRadians) * 2_048,
            shotSource[1] + Math.sin(yawRadians) * 2_048,
            shotSource[2]
        ], false, player).entity).toBe(soldier);
        return { player, playerState, soldier, yaw };
    };

    const prepareE1m1DogShot = (world: QuakeWorldRuntime) => {
        world.update(0.1);
        world.update(0.01);
        const vm = world.vm;
        const player = world.playerReference;
        const playerState = world.playerResult();
        const dog = world.entityReferences.find((reference, index) => (
            world.map.entities[index].classname === 'monster_dog' && reference !== null &&
            !vm.entity(reference).free &&
            vm.getEntityString(reference, 'model') === 'progs/dog.mdl'
        ));
        if (dog === null || dog === undefined) {
            throw new Error('E1M1 dog was not spawned');
        }
        const dogMins = vm.getEntityVector(dog, 'mins');
        const dogMaxs = vm.getEntityVector(dog, 'maxs');
        const playerMins = vm.getEntityVector(player, 'mins');
        const playerMaxs = vm.getEntityVector(player, 'maxs');
        const shotHeight = playerState.origin[2] + playerMins[2] - 1 +
            (playerMaxs[2] - playerMins[2]) * 0.7;
        let yaw = 0;
        let shotSource: [number, number, number] | undefined;
        let dogCenter: [number, number, number] | undefined;
        for (let candidateYaw = 0; candidateYaw < 360; candidateYaw += 45) {
            const radians = candidateYaw * Math.PI / 180;
            const forward: [number, number, number] = [
                Math.cos(radians), Math.sin(radians), 0
            ];
            const candidateSource: [number, number, number] = [
                playerState.origin[0] + forward[0] * 10,
                playerState.origin[1] + forward[1] * 10,
                shotHeight
            ];
            const wallTrace = world.traceLine(candidateSource, [
                candidateSource[0] + forward[0] * 2_048,
                candidateSource[1] + forward[1] * 2_048,
                candidateSource[2]
            ], true, player).trace;
            if (wallTrace.fraction * 2_048 <= 128) continue;
            yaw = candidateYaw;
            shotSource = candidateSource;
            dogCenter = [
                candidateSource[0] + forward[0] * 64,
                candidateSource[1] + forward[1] * 64,
                candidateSource[2]
            ];
            break;
        }
        if (!shotSource || !dogCenter) {
            throw new Error('E1M1 spawn has no clear dog shotgun test direction');
        }
        world.setEntityOrigin(dog, dogCenter.map(
            (component, axis) => component - (dogMins[axis] + dogMaxs[axis]) / 2
        ) as [number, number, number]);
        expect(world.traceLine(shotSource, dogCenter, false, player).entity).toBe(dog);
        const yawRadians = yaw * Math.PI / 180;
        expect(world.traceLine(shotSource, [
            shotSource[0] + Math.cos(yawRadians) * 2_048,
            shotSource[1] + Math.sin(yawRadians) * 2_048,
            shotSource[2]
        ], false, player).entity).toBe(dog);
        return { dog, player, playerState, yaw };
    };


    it('reads the verified PAK directory', () => {
        expect(pak.entries.size).toBeGreaterThan(300);
        expect(pak.has('maps/e1m1.bsp')).toBe(true);
        expect(pak.get('gfx/palette.lmp')).toHaveLength(768);
        expect(pak.has('progs.dat')).toBe(true);

        const palette = pak.get('gfx/palette.lmp');
        expect([...applyQuakeGamma(palette, 1)]).toEqual([...palette]);
        expect(applyQuakeGamma(palette, 0.5)[300]).toBeGreaterThan(palette[300]);
        const rgba = quakePaletteRgba(applyQuakeGamma(palette, 0.5));
        expect(rgba).toHaveLength(256 * 4);
        expect(rgba[403]).toBe(255);
    });

    it.each([
        'start',
        'e1m1',
        'e1m2',
        'e1m3',
        'e1m4',
        'e1m5',
        'e1m6',
        'e1m7',
        'e1m8'
    ])('spawns and advances the complete shareware level %s', (mapName) => {
        const map = new BspMap(pak.get(`maps/${mapName}.bsp`));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), mapName, undefined, pak
        );
        world.toggleNoTarget();

        for (let frame = 0; frame < 200; frame++) world.update(0.05);

        expect(vm.getEntityString(0, 'model')).toBe(`maps/${mapName}.bsp`);
        expect(vm.getEntityString(world.playerReference, 'classname')).toBe('player');
        expect(vm.getEntityFloat(world.playerReference, 'health')).toBeGreaterThan(0);
        expect(world.time).toBeCloseTo(11);
        expect(world.entityReferences.some(reference => reference !== null)).toBe(true);
        for (let reference = 0; reference < vm.edicts.length; reference++) {
            if (vm.entity(reference).free) continue;
            expect(vm.getEntityVector(reference, 'origin').every(Number.isFinite)).toBe(true);
            expect(vm.getEntityVector(reference, 'velocity').every(Number.isFinite)).toBe(true);
        }
        for (const collider of world.collision.brushColliders) {
            const index = map.entities.findIndex(
                entity => entity.model === `*${collider.modelIndex}`
            );
            const reference = world.entityReferences[index];
            if (reference !== null && !vm.entity(reference).free) {
                expect(collider.origin).toEqual(vm.getEntityVector(reference, 'origin'));
            }
        }
    });

    it('falls from the authored E1M8 start and lands under its low gravity', () => {
        const map = new BspMap(pak.get('maps/e1m8.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m8', undefined, pak
        );
        const player = world.playerResult(false);
        const controller = movementController(3);
        Object.assign(controller, {
            collision: world.collision,
            gravity: world.serverGravity(),
            movementTrace: (start: [number, number, number], end: [number, number, number]) => (
                world.tracePlayerMovement(start, end)
            )
        });
        controller.applyServerState(player, false);

        for (let frame = 0; frame < 200; frame++) {
            controller.beginFrame(0.05);
            controller.finishFrame(false);
        }

        expect(player.origin).toEqual([1024, 720, -103]);
        expect(world.serverGravity()).toBe(100);
        expect(controller.playerState().onGround).toBe(true);
        expect(controller.playerState().origin).toEqual([1024, 720, -735.96875]);
        expect(controller.playerState().velocity).toEqual([0, 0, 0]);
    });

    it('keeps a grounded player settled on the real E1M1 collision hull at 120 Hz', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m1', undefined, pak
        );
        const player = world.playerResult(false);
        const controller = movementController(3);
        Object.assign(controller, {
            collision: world.collision,
            gravity: world.serverGravity(),
            movementTrace: (start: [number, number, number], end: [number, number, number]) => (
                world.tracePlayerMovement(start, end)
            )
        });
        controller.applyServerState(player, false);

        for (let frame = 0; frame < 120; frame++) {
            controller.beginFrame(1 / 120);
            controller.finishFrame(false);
        }

        expect(player.origin).toEqual([480, -352, 89]);
        expect(controller.playerState().origin).toEqual([480, -352, 88.03125]);
        expect(controller.playerState().onGround).toBe(true);
        expect(controller.playerState().velocity).toEqual([0, 0, 0]);
    });

    it('descends and re-climbs the real E1M1 spawn ramp at 100 Hz', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m1', undefined, pak
        );
        const controller = movementController(3);
        Object.assign(controller, {
            collision: world.collision,
            gravity: world.serverGravity(),
            movementTrace: (start: [number, number, number], end: [number, number, number]) => (
                world.tracePlayerMovement(start, end)
            )
        });
        world.toggleNoTarget();
        controller.applyServerState(world.playerResult(false), false);
        // The native `map e1m1; wait10` carrier begins its first movement
        // command at server time 1.39. Preserve that settled state and let
        // setButtonState produce CL_KeyState's half-strength press frame.
        for (let frame = 0; frame < 39; frame++) {
            controller.beginFrame(0.01);
            const state = world.update(0.01, controller.playerState(), (preMoveState) => {
                controller.applyServerState(preMoveState, false);
                controller.finishFrame(false);
                return controller.playerState();
            });
            controller.applyServerState(state, false);
        }
        controller.setButtonState('+forward', 'test', true);
        const heights: number[] = [];
        const groundHeights: number[] = [];

        for (let frame = 0; frame < 240; frame++) {
            controller.beginFrame(0.01);
            const state = world.update(0.01, controller.playerState(), (preMoveState) => {
                controller.applyServerState(preMoveState, false);
                controller.finishFrame(false);
                return controller.playerState();
            });
            controller.applyServerState(state, false);
            heights.push(state.origin[2]);
            if (state.onGround) groundHeights.push(state.origin[2]);
        }

        expect(heights).toContain(88.03125);
        expect(heights).toContain(72.03125);
        expect(groundHeights.at(-1)).toBe(24.03125);
        expect(Math.abs(controller.origin[1] - 116.876_854)).toBeLessThan(0.01);
        expect(controller.origin[2]).toBe(24.03125);
        expect(controller.onGround).toBe(true);
        expect(controller.origin.every(Number.isFinite)).toBe(true);
        expect(world.time).toBeCloseTo(3.79);

        controller.setButtonState('+forward', 'test', false);
        controller.setButtonState('+back', 'test', true);
        let climbedHeight = controller.origin[2];
        let topFrame: number | undefined;
        for (let frame = 0; frame < 240; frame++) {
            controller.beginFrame(0.01);
            const state = world.update(0.01, controller.playerState(), (preMoveState) => {
                controller.applyServerState(preMoveState, false);
                controller.finishFrame(false);
                return controller.playerState();
            });
            controller.applyServerState(state, false);
            climbedHeight = Math.max(climbedHeight, state.origin[2]);
            if (topFrame === undefined && state.origin[2] === 88.03125) {
                topFrame = frame + 1;
            }
        }

        expect(climbedHeight).toBe(88.03125);
        expect(topFrame).toBe(230);
        expect(controller.origin[0]).toBe(480);
        expect(Math.abs(controller.origin[1] - -325.478_394)).toBeLessThan(0.001);
        expect(controller.origin[2]).toBe(88.03125);
        expect(controller.onGround).toBe(true);
        expect(world.time).toBeCloseTo(6.19);
    });

    it('matches the native E1M1 forward-jump arc and landing at 100 Hz', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m1', undefined, pak
        );
        const controller = movementController(3);
        Object.assign(controller, {
            collision: world.collision,
            gravity: world.serverGravity(),
            movementTrace: (start: [number, number, number], end: [number, number, number]) => (
                world.tracePlayerMovement(start, end)
            )
        });
        world.toggleNoTarget();
        controller.applyServerState(world.playerResult(false), false);
        const advance = (): void => {
            controller.beginFrame(0.01);
            const state = world.update(0.01, controller.playerState(), (preMoveState) => {
                controller.applyServerState(preMoveState, false);
                controller.finishFrame(false);
                return controller.playerState();
            });
            controller.applyServerState(state, false);
        };
        const expectNativeState = (
            origin: [number, number, number],
            velocity: [number, number, number]
        ): void => {
            for (let axis = 0; axis < 3; axis++) {
                expect(Math.abs(controller.origin[axis] - origin[axis])).toBeLessThan(0.01);
                expect(Math.abs(controller.velocity[axis] - velocity[axis])).toBeLessThan(0.001);
            }
        };

        for (let frame = 0; frame < 39; frame++) advance();
        controller.setButtonState('+forward', 'test', true);
        for (let frame = 0; frame < 240; frame++) advance();
        controller.setButtonState('+forward', 'test', false);
        // Loading the native carrier consumes one reconnect frame before a new
        // client command is available. SV_Physics_Client still advances the
        // player with the saved velocity, but SV_ClientThink does not apply
        // friction during that frame.
        const reconnectState = world.update(
            0.01,
            controller.playerState(),
            (preMoveState) => {
                const state = controller.playerState();
                state.origin = [...world.tracePlayerMovement(
                    preMoveState.origin,
                    preMoveState.origin.map(
                        (component, axis) => component + preMoveState.velocity[axis] * 0.01
                    ) as [number, number, number]
                ).trace.endPosition];
                return state;
            }
        );
        controller.applyServerState(reconnectState, false);
        for (let frame = 0; frame < 7; frame++) advance();

        expect(world.time).toBeCloseTo(3.87);
        expectNativeState([480, 130.807_373, 24.03125], [0, 150.289_505, 0]);

        controller.setButtonState('+forward', 'test', true);
        controller.setButtonState('+jump', 'test', true);
        advance();
        controller.setButtonState('+jump', 'test', false);
        expect(world.time).toBeCloseTo(3.88);
        expectNativeState([480, 132.250_153, 26.651_249], [0, 144.277_924, 262]);
        expect(controller.onGround).toBe(false);

        for (let frame = 0; frame < 20; frame++) advance();
        expect(world.time).toBeCloseTo(4.08);
        expectNativeState([480, 161.105_743, 62.251_247], [0, 144.277_924, 102]);
        expect(controller.onGround).toBe(false);

        for (let frame = 0; frame < 20; frame++) advance();
        expect(world.time).toBeCloseTo(4.28);
        expectNativeState([480, 189.961_334, 65.85125], [0, 144.277_924, -58]);
        expect(controller.onGround).toBe(false);

        for (let frame = 0; frame < 30; frame++) advance();
        expect(world.time).toBeCloseTo(4.58);
        expectNativeState([480, 234.611_816, 24.03125], [0, 197.868_683, 0]);
        expect(controller.onGround).toBe(true);
    });

    it('jumps after forward and run have already been held on E1M1', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m1', undefined, pak
        );
        const controller = movementController(3);
        Object.assign(controller, {
            collision: world.collision,
            gravity: world.serverGravity(),
            movementTrace: (start: [number, number, number], end: [number, number, number]) => (
                world.tracePlayerMovement(start, end)
            ),
            serverDrivenJump: true
        });
        world.toggleNoTarget();
        controller.applyServerState(world.playerResult(false), false);
        const advance = (): void => {
            controller.beginFrame(0.01);
            const state = world.update(0.01, controller.playerState(), (preMoveState) => {
                controller.applyServerState(preMoveState, false);
                controller.finishFrame(false);
                return controller.playerState();
            });
            controller.applyServerState(state, false);
        };

        for (let frame = 0; frame < 39; frame++) advance();
        controller.setButtonState('+forward', 'w', true);
        for (let frame = 0; frame < 10; frame++) advance();
        controller.setButtonState('+speed', 'SHIFT', true);
        for (let frame = 0; frame < 10; frame++) advance();
        const groundHeight = controller.origin[2];
        controller.setButtonState('+jump', 'SPACE', true);

        advance();

        expect(controller.onGround).toBe(false);
        expect(controller.origin[2]).toBeGreaterThan(groundHeight);
        expect(controller.velocity[2]).toBeGreaterThan(0);
        expect(controller.playerState().jump).toBe(true);
    });

    it('samples continue buttons while movement frames are suspended for intermission', () => {
        const controller = movementController(3);
        controller.setButtonState('+attack', 'CTRL', true);
        controller.setButtonState('+jump', 'SPACE', true);

        controller.sampleInputButtons();

        expect(controller.playerState()).toMatchObject({
            attack: true,
            jump: true
        });
    });

    it('replaces the BSP collision tree without rebuilding the input controller', () => {
        const controller = movementController(3);
        const nextMap = new BspMap(pak.get('maps/e1m2.bsp'));
        controller.touchedBrushModelIndices.add(4);
        controller.touchedEntityReferences.add(12);
        controller.setButtonState('+forward', 'w', true);

        controller.replaceMap(nextMap);

        expect(controller.map).toBe(nextMap);
        expect(controller.collision.map).toBe(nextMap);
        expect(controller.touchedBrushModelIndices.size).toBe(0);
        expect(controller.touchedEntityReferences.size).toBe(0);
        expect(controller.activeButtonSources.get('+forward')).toEqual(new Set(['w']));
    });

    it('climbs the real start-hub east stairs at 100 Hz', () => {
        const map = new BspMap(pak.get('maps/start.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'start', undefined, pak
        );
        const inactiveGate = map.entities.findIndex(entity => (
            entity.classname === 'func_episodegate' && entity.model === '*42'
        ));
        const inactiveGateReference = world.entityReferences[inactiveGate];
        expect(inactiveGateReference).not.toBeNull();
        expect(vm.getEntityFloat(inactiveGateReference ?? 0, 'solid')).toBe(0);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === 42
        )?.active).toBe(false);

        const controller = movementController(3);
        Object.assign(controller, {
            collision: world.collision,
            gravity: world.serverGravity(),
            movementTrace: (
                start: [number, number, number], end: [number, number, number]
            ) => world.tracePlayerMovement(start, end)
        });
        const capture = prepareQuakeStartStairsCapture(
            world,
            controller,
            [736, 1728, 24.03125],
            [0, 0, 0]
        );

        expect(capture.movementStates.slice(0, 5).map(state => ({
            origin: state.origin,
            velocity: state.velocity
        }))).toEqual([
            { origin: [736.099_975_585_937_5, 1728, 24.03125], velocity: [10, 0, 0] },
            { origin: [736.359_985_351_562_5, 1728, 24.03125], velocity: [26, 0, 0] },
            { origin: [736.779_968_261_718_8, 1728, 24.03125], velocity: [42, 0, 0] },
            { origin: [737.359_985_351_562_5, 1728, 24.03125], velocity: [58, 0, 0] },
            { origin: [738.099_975_585_937_5, 1728, 24.03125], velocity: [74, 0, 0] }
        ]);
        expect(Math.abs(controller.origin[0] - 1123.517_578)).toBeLessThan(0.001);
        expect(controller.origin[1]).toBe(1728);
        expect(controller.origin[2]).toBe(128.03125);
        expect(capture.maximumHeight).toBe(128.03125);
        expect(capture.playerState.origin).toEqual(controller.origin);
        expect(world.time).toBeCloseTo(4.37);
        expect(world.centerMessage).toBe(
            'This is the fourth episode:\nThe Elder World\n\n' +
            'Your worst nightmares come true...'
        );
    });

    it('exhausts the eight SV_TryUnstick nudges at a real start-hub stair edge', () => {
        const map = new BspMap(pak.get('maps/start.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'start', undefined, pak
        );
        const origin: [number, number, number] = [736, 1_658, 24.03125];
        const traces: Array<{
            end: [number, number, number];
            fraction: number;
            normal: [number, number, number];
            start: [number, number, number];
        }> = [];
        const controller = movementController(3);
        Object.assign(controller, {
            collision: world.collision,
            gravity: world.serverGravity(),
            movementTrace: (
                start: [number, number, number], end: [number, number, number]
            ) => {
                const result = world.tracePlayerMovement(start, end);
                traces.push({
                    end: [...end],
                    fraction: result.trace.fraction,
                    normal: [...result.trace.plane.normal],
                    start: [...start]
                });
                return result;
            },
            oldOrigin: [...origin],
            onGround: true,
            origin: [...origin],
            yaw: -45
        });
        controller.activeButtonSources.set('+forward', new Set(['test']));

        controller.beginFrame(0.01);
        controller.finishFrame(false);

        const raisedOrigin = [735.9816534278974, 1_657.974773574182, 42.03125];
        const nudgeDirections = traces.flatMap(({ end, start }) => {
            const direction = end.map(
                (component, axis) => component - start[axis]
            ) as [number, number, number];
            const fromRaisedOrigin = start.every(
                (component, axis) => Math.abs(component - raisedOrigin[axis]) < 1e-9
            );
            const isNudge = direction[2] === 0 &&
                direction.slice(0, 2).every(component => (
                    component === -2 || component === 0 || component === 2
                )) && (direction[0] !== 0 || direction[1] !== 0);
            return fromRaisedOrigin && isNudge ? [direction] : [];
        });

        expect(nudgeDirections).toEqual([
            [2, 0, 0], [0, 2, 0], [-2, 0, 0], [0, -2, 0],
            [2, 2, 0], [-2, 2, 0], [2, -2, 0], [-2, -2, 0]
        ]);
        expect(controller.origin[0]).toBeCloseTo(735.9816534278974);
        expect(controller.origin[1]).toBeCloseTo(1_657.974773574182);
        expect(controller.origin[2]).toBe(24.03125);
        expect(controller.velocity).toEqual([0, 0, 0]);
        expect(controller.onGround).toBe(true);
        expect(traces.at(-1)).toMatchObject({
            normal: [0, 0, 1]
        });
    });

    it('runs the real E1M1 drowning path into the player death camera', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m1', undefined, pak
        );
        const controller = movementController(3);
        Object.assign(controller, {
            collision: world.collision,
            gravity: world.serverGravity(),
            movementTrace: (
                start: [number, number, number], end: [number, number, number]
            ) => world.tracePlayerMovement(start, end)
        });
        const capture = prepareQuakePlayerDeathCapture(
            world,
            controller,
            [587, 1_007, -344],
            [-66.093_75, 0, 0]
        );
        const player = world.playerReference;

        expect(QUAKE_PLAYER_DEATH_CAPTURE_FRAMES).toBe(8);
        expect(world.time).toBeCloseTo(1.8);
        expect(vm.getEntityFloat(player, 'health')).toBe(-3);
        expect(vm.getEntityFloat(player, 'deadflag')).toBe(1);
        expect(vm.getEntityFloat(player, 'movetype')).toBe(6);
        expect(vm.getEntityVector(player, 'view_ofs')).toEqual([0, 0, -8]);
        expect(vm.program.functions[vm.getEntityWord(player, 'think')].name).toMatch(
            /^player_diea\d+$/
        );
        expect(capture.bubbleReferences).toHaveLength(5);
        expect(world.damageShift).toBe(0);
        expect(capture.playerState.origin).toEqual(controller.origin);
        expect(world.soundEvents.some(event => (
            event.entity === player && event.sample === 'player/h2odeath.wav'
        ))).toBe(true);
    });

    it('applies software Quake color shifts sequentially before gamma', () => {
        const palette = pak.get('gfx/palette.lmp');
        const shifts = [
            { color: [255, 0, 0] as const, percent: 128 },
            { color: [0, 0, 255] as const, percent: 64 }
        ];
        const shifted = applyQuakePaletteShifts(palette, shifts, 1);
        const offset = 100 * 3;
        const expected = [0, 1, 2].map((channel) => {
            let value = palette[offset + channel];
            for (const shift of shifts) {
                value += (shift.percent * (shift.color[channel] - value)) >> 8;
            }
            return value;
        });

        expect([...shifted.slice(offset, offset + 3)]).toEqual(expected);
        expect(applyQuakePaletteShifts(palette, shifts, 0.7)).toEqual(
            applyQuakeGamma(shifted, 0.7)
        );
    });

    it('preserves the original 64-grade indexed colormap and fullbrights', () => {
        const colormap = pak.get('gfx/colormap.lmp');
        expect(colormap).toHaveLength(16_385);
        expect(colormap[63 * 256 + 100]).toBe(0);
        for (let grade = 0; grade < 64; grade++) {
            for (let index = 224; index < 256; index++) {
                expect(colormap[grade * 256 + index]).toBe(index);
            }
        }
    });

    it('loads the three original shareware lightning models without inventing beam data', () => {
        for (const modelPath of [
            'progs/bolt.mdl', 'progs/bolt2.mdl', 'progs/bolt3.mdl'
        ]) {
            expect(pak.has(modelPath)).toBe(true);
            const model = new AliasModel(pak.get(modelPath));
            expect(model.frames.length).toBeGreaterThan(0);
            expect(model.triangles.length).toBeGreaterThan(0);
        }
        expect(pak.has('progs/beam.mdl')).toBe(false);
    });

    it('lights an original rocket viewmodel vertex with WinQuake integer math', () => {
        const model = new AliasModel(pak.get('progs/v_rock.mdl'));
        const normalIndex = model.frames[0].frames[0].packedVertices[0].normalIndex;
        expect(normalIndex).toBe(115);
        const normal = QUAKE_ALIAS_NORMALS[normalIndex];
        const cameraNormal = [-normal[1], normal[2], -normal[0]];
        const direction = quakeViewModelLightDirection([0, 90, 0]);
        const directional = cameraNormal.reduce(
            (sum, component, axis) => sum + component * direction[axis], 0
        );

        expect(directional).toBeCloseTo(0.951056);
        expect(quakeAliasVertexLightNumber(24, 24, directional)).toBe(13_324);
        expect(quakeAliasColormapGrade(24, 24, directional)).toBe(52);
    });

    it('reads original WAV cue loops used by ambience and moving doors', () => {
        const water = parseQuakeWavInfo(pak.get('sound/ambience/water1.wav'));
        const door = parseQuakeWavInfo(pak.get('sound/doors/doormv1.wav'));
        const shotgun = parseQuakeWavInfo(pak.get('sound/weapons/sgun1.wav'));
        const lightning = parseQuakeWavInfo(pak.get('sound/weapons/lstart.wav'));

        expect(water.loopStart).toBe(0);
        expect(water.loopEnd).toBeGreaterThan(0);
        expect(water.sampleCount).toBeGreaterThanOrEqual(water.loopEnd ?? 0);
        expect(door.loopStart).toBe(4_730);
        expect(door.loopEnd).toBeGreaterThan(door.loopStart ?? 0);
        expect(shotgun.loopStart).toBeUndefined();
        expect(shotgun.sampleCount).toBeGreaterThan(1_000);
        expect(lightning.bitsPerSample).toBe(16);
        expect(lightning.sampleRate).toBe(22_050);
    });

    it('directly decodes every original gameplay WAV at its native PCM rate', () => {
        const wavPaths = pak.list('sound/').filter(path => path.endsWith('.wav'));
        const formats = new Map<string, number>();
        for (const path of wavPaths) {
            let decoded: ReturnType<typeof decodeQuakeWavPcm>;
            try {
                decoded = decodeQuakeWavPcm(pak.get(path));
            } catch (error) {
                throw new Error(
                    `Could not decode verified PAK sound ${path}: ${String(error)}`
                );
            }
            const key = `${decoded.info.bitsPerSample}@${decoded.info.sampleRate}`;
            formats.set(key, (formats.get(key) ?? 0) + 1);
            expect(decoded.info.channelCount, path).toBe(1);
            expect(decoded.samples.length, path).toBe(decoded.info.sampleCount);
            expect(decoded.samples.length, path).toBeGreaterThan(0);
            expect(decoded.samples.every(Number.isFinite), path).toBe(true);
        }

        expect(wavPaths).toHaveLength(190);
        expect(formats).toEqual(new Map([
            ['8@11025', 188],
            ['16@22050', 2]
        ]));
    });

    it('parses the original E1M1 BSP and spawn point', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const spawn = map.entities.find(entity => entity.classname === 'info_player_start');
        expect(spawn).toBeDefined();
        if (!spawn) {
            throw new Error('E1M1 has no player spawn');
        }

        expect(map.version).toBe(BSP_VERSION);
        expect(map.faces.length).toBeGreaterThan(1_000);
        expect(map.textures.length).toBeGreaterThan(50);
        expect(map.lightData.length).toBeGreaterThan(100_000);
        const ambientLeaf = map.leafs.find(leaf => leaf.ambient[0] === 255);
        expect(ambientLeaf).toBeDefined();
        expect(quakeAmbientChannelVolume(
            0, ambientLeaf?.ambient[0] ?? 0, 0.1, 0.3, 100
        )).toBe(10);
        const turbulentTextures = map.textures.filter(
            texture => texture?.name.startsWith('*')
        );
        expect(turbulentTextures.length).toBeGreaterThan(0);
        expect(turbulentTextures.every(
            texture => texture?.width === 64 && texture.height === 64
        )).toBe(true);
        expect(map.textures.some(texture => texture?.name.toLowerCase().startsWith('sky') &&
            texture.width === 256 && texture.height === 128
        )).toBe(true);
        expect(spawn).toBeDefined();
        expect(spawn.origin).toBeTruthy();
        expect(quakeMapSpawnPose(map)).toEqual({
            angles: [0, 90, 0],
            origin: [480, -352, 88]
        });
        const spawnLeaf = map.findLeaf(parseVector(spawn.origin));
        expect(spawnLeaf).toBeGreaterThan(0);
        const visibility = map.visibleLeafs(spawnLeaf);
        expect(visibility).toHaveLength(Math.ceil(map.models[0].visibleLeafs / 8));
        expect(quakePvsContainsLeaf(visibility, spawnLeaf, spawnLeaf)).toBe(true);
        expect(visibility.some(byte => byte !== 0xff)).toBe(true);
    });

    it('selects the E1M1 button alternate texture from the brush entity frame', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const base = map.textures.findIndex(texture => texture?.name === '+0basebtn');
        if (base === -1) throw new Error('E1M1 +0basebtn texture is missing');
        const animation = quakeTextureAnimation(map, base);

        expect(animation.normal.map(index => map.textures[index]?.name)).toEqual([
            '+0basebtn', '+1basebtn'
        ]);
        expect(animation.alternate.map(index => map.textures[index]?.name)).toEqual([
            '+abasebtn'
        ]);
        expect(map.textures[quakeAnimatedTextureIndex(animation, 0, false)]?.name).toBe(
            '+0basebtn'
        );
        expect(map.textures[quakeAnimatedTextureIndex(animation, 0.2, false)]?.name).toBe(
            '+1basebtn'
        );
        expect(map.textures[quakeAnimatedTextureIndex(animation, 0.2, true)]?.name).toBe(
            '+abasebtn'
        );
    });

    it('orients E1M1 faces from the strongest fan triangle', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const face = map.faces[3884];
        const normal = map.planes[face.plane].normal;
        const direction = face.side === 0 ? 1 : -1;
        const playCanvasNormal = [
            normal[0] * direction,
            normal[2] * direction,
            -normal[1] * direction
        ];
        const triangleFacing = (indices: number[], index: number): number => {
            const vertices = [indices[0], indices[index], indices[index + 1]].map(
                (vertexIndex) => {
                    const vertex = map.vertices[vertexIndex];
                    return [vertex[0], vertex[2], -vertex[1]];
                }
            );
            const ab = vertices[1].map((component, axis) => component - vertices[0][axis]);
            const ac = vertices[2].map((component, axis) => component - vertices[0][axis]);
            const cross = [
                ab[1] * ac[2] - ab[2] * ac[1],
                ab[2] * ac[0] - ab[0] * ac[2],
                ab[0] * ac[1] - ab[1] * ac[0]
            ];
            return cross.reduce(
                (sum, component, axis) => sum + component * playCanvasNormal[axis], 0
            );
        };

        expect(triangleFacing(face.vertexIndices, 1)).toBe(0);
        const oriented = quakeOrientedFaceVertexIndices(map, face);
        const facing = Array.from({ length: oriented.length - 2 }, (_, index) => (
            triangleFacing(oriented, index + 1)
        )).find(value => Math.abs(value) > 1e-6);
        expect(facing).toBeGreaterThan(0);
    });

    it('keeps the E1M1 secret-area water surface front-facing', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const face = map.faces[3574];
        const normal = map.planes[face.plane].normal;
        const direction = face.side === 0 ? 1 : -1;
        const playCanvasNormal = [
            normal[0] * direction,
            normal[2] * direction,
            -normal[1] * direction
        ];
        const triangleFacing = (indices: number[], index: number): number => {
            const vertices = [indices[0], indices[index], indices[index + 1]].map(
                (vertexIndex) => {
                    const vertex = map.vertices[vertexIndex];
                    return [vertex[0], vertex[2], -vertex[1]];
                }
            );
            const ab = vertices[1].map((component, axis) => component - vertices[0][axis]);
            const ac = vertices[2].map((component, axis) => component - vertices[0][axis]);
            const cross = [
                ab[1] * ac[2] - ab[2] * ac[1],
                ab[2] * ac[0] - ab[0] * ac[2],
                ab[0] * ac[1] - ab[1] * ac[0]
            ];
            return cross.reduce(
                (sum, component, axis) => sum + component * playCanvasNormal[axis], 0
            );
        };

        expect(map.textures[map.textureInfo[face.textureInfo].texture]?.name).toBe('*water0');
        expect(triangleFacing(face.vertexIndices, 1)).toBeGreaterThan(0);
        expect(triangleFacing(face.vertexIndices, 1)).toBeLessThan(0.01);
        expect(Math.min(...Array.from(
            { length: face.vertexIndices.length - 2 },
            (_, index) => triangleFacing(face.vertexIndices, index + 1)
        ))).toBeLessThan(-1_000);

        const oriented = quakeOrientedFaceVertexIndices(map, face);
        const meaningfulFacing = Array.from(
            { length: oriented.length - 2 },
            (_, index) => triangleFacing(oriented, index + 1)
        ).filter(value => Math.abs(value) > 1);
        expect(meaningfulFacing.length).toBeGreaterThan(0);
        expect(meaningfulFacing.every(value => value > 0)).toBe(true);
    });

    it('builds the source eight-unit fat PVS and filters linked E1M1 entities', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const playerOrigin = vm.getEntityVector(world.playerReference, 'origin');
        const viewOffset = vm.getEntityVector(world.playerReference, 'view_ofs');
        const eye = playerOrigin.map(
            (component, axis) => component + viewOffset[axis]
        ) as [number, number, number];
        const eyeLeaf = map.findLeaf(eye);
        const touched = map.touchedLeafs(
            eye.map(component => component - 8) as [number, number, number],
            eye.map(component => component + 8) as [number, number, number]
        );
        const visibility = map.fatVisibleLeafs(eye);

        expect(touched).toContain(eyeLeaf);
        expect(map.visibilityContainsLeaf(visibility, eyeLeaf)).toBe(true);
        const modeledEntities = world.entityReferences.filter(reference => reference !== null &&
            !vm.entity(reference).free && vm.getEntityFloat(reference, 'modelindex') !== 0
        ) as number[];
        expect(modeledEntities.some(reference => world.entityVisible(reference))).toBe(true);
        expect(modeledEntities.some(reference => !world.entityVisible(reference))).toBe(true);
        expect(world.entityVisible(world.playerReference)).toBe(true);
    });

    it('accumulates a source-shaped dynamic light into E1M1 lightmap texels', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const atlas = buildLightmapAtlas(map);
        const face = map.faces.find(candidate => candidate.lightmapAtlas);
        if (!face) {
            throw new Error('E1M1 has no lightmapped face');
        }
        const lightmap = buildDynamicLightmap(map, atlas.size, [{
            minimumLight: 0,
            origin: [...map.vertices[face.vertexIndices[0]]] as [number, number, number],
            radius: 350
        }]);

        expect(lightmap.some(value => value > 0)).toBe(true);
        expect(buildDynamicLightmap(map, atlas.size, []).every(value => value === 0)).toBe(true);
    });

    it('interpolates a real styled E1M1 surface with software-cache integer steps', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const face = map.faces[943];
        expect(face.styles).toEqual([0, 10, 255, 255]);
        expect(face.lightOffset).toBe(25_612);
        expect(face.lightmapSize).toEqual([3, 3]);
        const atlas = buildLightmapAtlas(map);
        const placement = face.lightmapAtlas;
        if (!placement) throw new Error('Styled E1M1 face was not placed in the atlas');
        const atlasSample = (x: number, y: number, channel: number): number => (
            atlas.pixels[((placement.y + y) * atlas.size + placement.x + x) * 4 + channel]
        );
        expect(atlasSample(placement.width, 0, 0)).toBe(
            atlasSample(placement.width - 1, 0, 0)
        );
        expect(atlasSample(0, placement.height, 1)).toBe(
            atlasSample(0, placement.height - 1, 1)
        );
        const sampleCount = face.lightmapSize[0] * face.lightmapSize[1];
        const samples = [0, 1, face.lightmapSize[0], face.lightmapSize[0] + 1];
        const blockLights = samples.map(sample => (
            map.lightData[face.lightOffset + sample] * 264 +
            map.lightData[face.lightOffset + sampleCount + sample] * 264
        )) as [number, number, number, number];

        expect(blockLights).toEqual([30_888, 30_888, 34_056, 34_056]);
        expect(quakeSurfaceLightGrade(blockLights, 0, 0, 0)).toBe(33);
        expect(quakeSurfaceLightGrade(blockLights, 15, 15, 0)).toBe(30);
        expect(quakeSurfaceLightGrade(blockLights, 3, 5, 2)).toBe(32);
    });

    it('selects one source software mip per clipped E1M1 surface', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const camera: [number, number, number] = [592, 90.666667, 80];
        const mipForFace = (faceIndex: number): number | undefined => {
            const face = map.faces[faceIndex];
            const textureInfo = map.textureInfo[face.textureInfo];
            return quakeSurfaceMipLevelForView(
                face.vertexIndices.map(vertexIndex => map.vertices[vertexIndex]),
                camera,
                [0, -1, 0],
                [0, 0, 1],
                [1, 0, 0],
                320,
                152,
                quakeTextureMipAdjustment(textureInfo.vectors)
            );
        };

        expect([4803, 4802, 82, 18].map(mipForFace)).toEqual([0, 1, 2, 3]);
    });

    it('samples original E1M1 lightmaps below an alias-model position', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const horizontalFace = map.faces.find(face => face.lightOffset >= 0 &&
            map.planes[face.plane].normal[2] > 0.9
        );
        if (!horizontalFace) {
            throw new Error('E1M1 has no upward-facing lightmapped face');
        }
        const center = horizontalFace.vertexIndices.reduce<[number, number, number]>(
            (sum, vertexIndex) => sum.map(
                (component, axis) => component + map.vertices[vertexIndex][axis]
            ) as [number, number, number],
            [0, 0, 0]
        ).map(component => component / horizontalFace.vertexIndices.length) as [number, number, number];
        center[2] += 32;

        expect(sampleQuakeBspLight(map, center, 0)).toBeGreaterThan(0);
    });

    it('reads original HUD pictures from gfx.wad', () => {
        const wad = new WadArchive(pak.get('gfx.wad'));
        const statusBar = wad.getPicture('sbar');

        expect(statusBar.width).toBe(320);
        expect(statusBar.height).toBe(24);
        expect(statusBar.pixels).toHaveLength(320 * 24);
        expect(wad.getPicture('scorebar').width).toBe(320);
        expect(wad.getPicture('backtile').width).toBe(64);
        expect(wad.getPicture('backtile').height).toBe(64);
    });

    it('reads the original pause and menu artwork from the PAK', () => {
        for (const asset of [
            'gfx/pause.lmp',
            'gfx/conback.lmp',
            'gfx/complete.lmp',
            'gfx/finale.lmp',
            'gfx/inter.lmp',
            'gfx/loading.lmp',
            'gfx/qplaque.lmp',
            'gfx/ttl_main.lmp',
            'gfx/mainmenu.lmp',
            'gfx/ttl_sgl.lmp',
            'gfx/sp_menu.lmp',
            'gfx/p_multi.lmp',
            'gfx/mp_menu.lmp',
            'gfx/bigbox.lmp',
            'gfx/menuplyr.lmp',
            'gfx/p_option.lmp',
            'gfx/help0.lmp',
            'gfx/help5.lmp',
            'gfx/box_tl.lmp',
            'gfx/box_mm2.lmp',
            'gfx/box_br.lmp',
            'gfx/menudot1.lmp'
        ]) {
            const picture = parseIndexedPicture(pak.get(asset), asset);
            expect(picture.width).toBeGreaterThan(0);
            expect(picture.height).toBeGreaterThan(0);
            expect(picture.pixels).toHaveLength(picture.width * picture.height);
        }
    });

    it('parses the original pickup brush models and their lightmaps', () => {
        for (const path of ['maps/b_bh25.bsp', 'maps/b_shell0.bsp', 'maps/b_explob.bsp']) {
            const model = new BspMap(pak.get(path));
            const atlas = buildLightmapAtlas(model);

            expect(model.version).toBe(BSP_VERSION);
            expect(model.faces.length).toBeGreaterThan(0);
            expect(model.textures.some(Boolean)).toBe(true);
            expect(atlas.size).toBeGreaterThanOrEqual(512);
        }
    });

    it('selects pickup BSP mips from each entity world transform', () => {
        const model = new BspMap(pak.get('maps/b_bh25.bsp'));
        const camera: [number, number, number] = [1288, 700, -215.96875];
        const pitch = 18.060798 * Math.PI / 180;
        const yaw = 63.434949 * Math.PI / 180;
        const forward: [number, number, number] = [
            Math.cos(pitch) * Math.cos(yaw),
            Math.cos(pitch) * Math.sin(yaw),
            -Math.sin(pitch)
        ];
        const right: [number, number, number] = [Math.sin(yaw), -Math.cos(yaw), 0];
        const up: [number, number, number] = [
            Math.sin(pitch) * Math.cos(yaw),
            Math.sin(pitch) * Math.sin(yaw),
            Math.cos(pitch)
        ];
        const mipsAt = (origin: [number, number, number]) => model.faces.map((face) => {
            const textureInfo = model.textureInfo[face.textureInfo];
            return quakeSurfaceMipLevelForView(
                face.vertexIndices.map(vertexIndex => model.vertices[vertexIndex].map(
                    (component, axis) => component + origin[axis]
                ) as [number, number, number]),
                camera,
                right,
                up,
                forward,
                320,
                152,
                quakeTextureMipAdjustment(textureInfo.vectors)
            );
        });

        expect(mipsAt([0, 0, 0])).toEqual(model.faces.map(() => undefined));
        const visibleMips = mipsAt([1176, 936, -432]).filter(
            mip => mip !== undefined
        );
        expect(visibleMips.length).toBeGreaterThan(0);
        expect(visibleMips.every(mip => mip === 1)).toBe(true);
    });

    it('traces the original standing-player hull against the E1M1 floor', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const spawn = map.entities.find(entity => entity.classname === 'info_player_start');
        if (!spawn) {
            throw new Error('E1M1 has no player spawn');
        }
        const origin = parseVector(spawn.origin);
        const collision = new WorldCollision(map);
        const traceStart: [number, number, number] = [origin[0], origin[1], origin[2] + 16];
        const trace = collision.trace(traceStart, [origin[0], origin[1], origin[2] - 128]);

        expect(collision.hullPointContents(origin)).not.toBe(-2);
        expect(trace.startSolid).toBe(false);
        expect(trace.fraction).toBeGreaterThan(0);
        expect(trace.fraction).toBeLessThan(1);
        expect(trace.plane.normal[2]).toBeGreaterThan(0.7);

        const pointTrace = collision.tracePoint(traceStart, [
            traceStart[0], traceStart[1], traceStart[2] - 128
        ]);
        expect(pointTrace.startSolid).toBe(false);
        expect(pointTrace.fraction).toBeGreaterThan(trace.fraction);
        expect(pointTrace.fraction).toBeLessThan(1);
    });

    it('parses the original shotgun alias model', () => {
        const model = new AliasModel(pak.get('progs/v_shot.mdl'));

        expect(model.version).toBe(6);
        expect(model.skins).toHaveLength(1);
        expect(model.frames.length).toBeGreaterThan(5);
        expect(model.triangles.length).toBeGreaterThan(100);
        expect(model.frames[0].frames[0].vertices).toHaveLength(model.vertexCount);
    });

    it('parses the shareware flame random-sync grouped frames', () => {
        const model = new AliasModel(pak.get('progs/flame.mdl'));

        expect(model.syncType).toBe(1);
        expect(model.frames[0].frames.length).toBeGreaterThan(1);
        expect(model.frames[0].intervals.at(-1)).toBeGreaterThan(0);
    });

    it('preserves original client-static torch baselines when QuakeC releases their edicts', () => {
        const map = new BspMap(pak.get('maps/e1m2.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));

        expect(world.staticEntities.length).toBeGreaterThan(20);
        expect(world.staticEntities.some(entity => (
            entity.classname === 'light_torch_small_walltorch' &&
            entity.model === 'progs/flame.mdl'
        ))).toBe(true);
        expect(world.staticEntities.every(entity => pak.has(entity.model))).toBe(true);
    });

    it('reads original rotation and trail flags from alias models', () => {
        expect(new AliasModel(pak.get('progs/missile.mdl')).flags).toBe(1);
        expect(new AliasModel(pak.get('progs/grenade.mdl')).flags).toBe(2);
        expect(new AliasModel(pak.get('progs/gib1.mdl')).flags).toBe(4);
        expect(new AliasModel(pak.get('progs/gib2.mdl')).flags).toBe(4);
        expect(new AliasModel(pak.get('progs/gib3.mdl')).flags).toBe(4);
        expect(new AliasModel(pak.get('progs/h_guard.mdl')).flags).toBe(4);
        expect(new AliasModel(pak.get('progs/armor.mdl')).flags & EF_ROTATE).toBe(EF_ROTATE);
    });

    it('parses the original rocket explosion sprite', () => {
        const model = new SpriteModel(pak.get('progs/s_explod.spr'));

        expect(model.version).toBe(SPRITE_VERSION);
        expect(model.frames.length).toBe(model.frameCount);
        expect(model.frames.length).toBeGreaterThan(1);
        expect(model.frames.every(group => group.frames.every((frame) => {
            return frame.pixels.length === frame.width * frame.height;
        }))).toBe(true);
    });

    it('loads source PF_setmodel bounds for every original model format', () => {
        expect(loadQuakeModelBounds(pak, 'maps/b_explob.bsp')).toEqual({
            maximum: [32, 32, 64],
            minimum: [0, 0, 0]
        });
        expect(loadQuakeModelBounds(pak, 'progs/player.mdl')).toEqual({
            maximum: [16, 16, 16],
            minimum: [-16, -16, -16]
        });
        const sprite = new SpriteModel(pak.get('progs/s_explod.spr'));
        expect(loadQuakeModelBounds(pak, 'progs/s_explod.spr')).toEqual({
            maximum: [sprite.width / 2, sprite.width / 2, sprite.height / 2],
            minimum: [-sprite.width / 2, -sprite.width / 2, -sprite.height / 2]
        });
    });

    it('parses and indexes the original QuakeC program', () => {
        const program = new QuakeProgram(pak.get('progs.dat'));

        expect(program.header.version).toBe(PROGS_VERSION);
        expect(program.header.crc).toBe(PROGS_CRC);
        expect(program.statements.length).toBeGreaterThan(10_000);
        expect(program.findFunction('worldspawn').firstStatement).toBeGreaterThan(0);
        expect(program.findFunction('monster_army').file).toBe('soldier.qc');
        expect(program.fieldsByName.get('origin')?.offset).toBeGreaterThan(0);
        expect(program.globalsByName.has('self')).toBe(true);
    });

    it('initializes the source world edict before executing worldspawn', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map), 'e1m1');

        expect(world.playerReference).toBe(1);
        expect(vm.getString(vm.getGlobalWord('mapname'))).toBe('e1m1');
        expect(vm.getEntityString(0, 'model')).toBe('maps/e1m1.bsp');
        expect(vm.getEntityFloat(0, 'modelindex')).toBe(1);
        expect(vm.getEntityFloat(0, 'solid')).toBe(4);
        expect(vm.getEntityFloat(0, 'movetype')).toBe(7);
    });

    it('delivers a live one-shot weapon impulse to the original QuakeC player code', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        world.update(0.1);
        const player = world.playerReference;
        const playerResult = world.playerResult();
        vm.setEntityFloat(player, 'items', 3);
        vm.setEntityFloat(player, 'ammo_shells', 25);

        world.setPlayerImpulse(259);
        expect(vm.getEntityFloat(player, 'impulse')).toBe(3);
        world.update(0.05, {
            angles: playerResult.angles,
            attack: false,
            entityAngles: playerResult.entityAngles,
            jump: false,
            onGround: true,
            oldOrigin: playerResult.oldOrigin,
            origin: playerResult.origin,
            velocity: playerResult.velocity
        });

        expect(vm.getEntityFloat(player, 'weapon')).toBe(2);
        expect(vm.getEntityString(player, 'weaponmodel')).toBe('progs/v_shot2.mdl');
        expect(vm.getEntityFloat(player, 'currentammo')).toBe(25);
        expect(vm.getEntityFloat(player, 'impulse')).toBe(0);
    });

    it('moves the player and visibility origin to a deterministic capture pose', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));

        world.setPlayerPose([300, 1_100, 16], [-45, 90, 0]);
        world.setSnapshotTime(5.9);
        const state = world.playerResult();

        expect(state.origin).toEqual([300, 1_100, 16]);
        expect(state.oldOrigin).toEqual([300, 1_100, 16]);
        expect(state.velocity).toEqual([0, 0, 0]);
        expect(state.fixAngle).toBe(true);
        expect(state.angles).toEqual([-45, 90, 0]);
        expect(vm.getEntityVector(world.playerReference, 'v_angle')).toEqual([-45, 90, 0]);
        expect(world.time).toBe(5.9);
        expect(vm.getGlobalFloat('time')).toBeCloseTo(5.9);
    });

    it('packet-quantizes arbitrary client view angles before QuakeC receives them', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const initial = world.playerResult();

        world.update(0.01, {
            angles: [1.9, 181.9, -45.9],
            attack: false,
            jump: false,
            onGround: true,
            origin: initial.origin,
            velocity: [0, 0, 0]
        });

        expect(vm.getEntityVector(world.playerReference, 'v_angle')).toEqual([
            0, -180, -45
        ]);
    });

    it('round-trips HUD and viewmodel fields through svc_clientdata widths', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const player = world.playerReference;
        vm.setEntityFloat(player, 'health', 65_535);
        vm.setEntityFloat(player, 'armorvalue', 511);
        vm.setEntityFloat(player, 'currentammo', 257);
        vm.setEntityFloat(player, 'ammo_shells', 258);
        vm.setEntityFloat(player, 'ammo_nails', 259);
        vm.setEntityFloat(player, 'ammo_rockets', 260);
        vm.setEntityFloat(player, 'ammo_cells', 261);
        vm.setEntityFloat(player, 'weaponframe', 258);
        vm.setEntityFloat(player, 'weapon', 258);
        vm.setEntityFloat(player, 'idealpitch', 130);
        vm.setEntityFloat(player, 'items', 1);
        vm.setGlobalFloat('serverflags', 3);

        expect(world.clientData()).toMatchObject({
            activeWeapon: 2,
            ammo: 1,
            ammoCells: 5,
            ammoNails: 3,
            ammoRockets: 4,
            ammoShells: 2,
            armor: 255,
            health: -1,
            idealPitch: -126,
            items: 3 << 28 | 1,
            weaponFrame: 2
        });
    });

    it('executes original QuakeC return and no-op functions', () => {
        const program = new QuakeProgram(pak.get('progs.dat'));
        const vm = new QuakeVirtualMachine(program);
        const checkSpawnPoint = program.findFunction('CheckSpawnPoint');
        const returnStatement = program.statements[checkSpawnPoint.firstStatement];
        const expectedReturn = vm.words.slice(returnStatement.a, returnStatement.a + 3);

        vm.execute('SUB_Null');
        vm.execute(checkSpawnPoint.index);

        expect([...vm.words.slice(1, 4)]).toEqual([...expectedReturn]);
        const stringReference = vm.internString('maps/e1m1.bsp');
        expect(vm.getString(stringReference)).toBe('maps/e1m1.bsp');
    });

    it('preserves the signed strcmp result of QuakeC string inequality', () => {
        const program = new QuakeProgram(pak.get('progs.dat'));
        const vm = new QuakeVirtualMachine(program);
        const quakeFunction = program.findFunction('SUB_Null');
        const firstStatement = quakeFunction.firstStatement;
        const originalStatements = program.statements.slice(firstStatement, firstStatement + 2);

        vm.words[4] = vm.internString('armor');
        vm.words[7] = vm.internString('soldier');
        program.statements[firstStatement] = {
            opcode: QuakeOpcode.NotEqualString,
            a: 4,
            b: 7,
            c: 1
        };
        program.statements[firstStatement + 1] = {
            opcode: QuakeOpcode.Done,
            a: 1,
            b: 0,
            c: 0
        };

        try {
            vm.execute(quakeFunction.index);
            expect(vm.values[1]).toBe(-1);
        } finally {
            program.statements.splice(firstStatement, 2, ...originalStatements);
        }
    });

    it('rejects an indirect null QuakeC function call', () => {
        const program = new QuakeProgram(pak.get('progs.dat'));
        const vm = new QuakeVirtualMachine(program);
        const quakeFunction = program.findFunction('SUB_Null');
        const firstStatement = quakeFunction.firstStatement;
        const originalStatement = program.statements[firstStatement];

        vm.words[4] = 0;
        program.statements[firstStatement] = {
            opcode: QuakeOpcode.Call0,
            a: 4,
            b: 0,
            c: 0
        };

        try {
            expect(() => vm.execute(quakeFunction.index)).toThrow('QuakeC NULL function');
        } finally {
            program.statements[firstStatement] = originalStatement;
        }
    });

    it('allows loading-time world writes but rejects active-server world assignment', () => {
        const program = new QuakeProgram(pak.get('progs.dat'));
        const vm = new QuakeVirtualMachine(program);
        const quakeFunction = program.findFunction('SUB_Null');
        const firstStatement = quakeFunction.firstStatement;
        const originalStatements = program.statements.slice(firstStatement, firstStatement + 2);
        vm.words[4] = 0;
        vm.words[7] = program.fieldsByName.get('origin')!.offset;
        program.statements[firstStatement] = {
            opcode: QuakeOpcode.Address,
            a: 4,
            b: 7,
            c: 10
        };
        program.statements[firstStatement + 1] = {
            opcode: QuakeOpcode.Done,
            a: 1,
            b: 0,
            c: 0
        };

        try {
            expect(() => vm.execute(quakeFunction.index)).not.toThrow();
            vm.setServerActive();
            expect(() => vm.execute(quakeFunction.index)).toThrow(
                'QuakeC assignment to world entity'
            );
        } finally {
            program.statements.splice(firstStatement, 2, ...originalStatements);
        }
    });

    it('matches QuakeC rint rounding on negative and positive halves', () => {
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        registerQuakeBuiltins(vm);
        const rint = vm.builtins.get(36);
        if (!rint) {
            throw new Error('rint builtin is not registered');
        }

        vm.values[4] = -1.5;
        rint(vm, 1);
        expect(vm.values[1]).toBe(-2);
        vm.values[4] = 1.5;
        rint(vm, 1);
        expect(vm.values[1]).toBe(2);
        vm.values[4] = -1.4;
        rint(vm, 1);
        expect(vm.values[1]).toBe(-1);
    });

    it('matches variadic PF_error text and PF_objerror self removal', () => {
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        let removedEntity: number | undefined;
        registerQuakeBuiltins(vm, undefined, {
            removeEntity: (entity) => {
                removedEntity = entity;
                vm.freeEdict(entity);
            }
        });
        const error = vm.builtins.get(10);
        const objectError = vm.builtins.get(11);
        if (!error || !objectError) {
            throw new Error('QuakeC error builtins are not registered');
        }
        vm.words[4] = vm.internString('bad ');
        vm.words[7] = vm.internString('target');

        expect(() => error(vm, 2)).toThrow('QuakeC error: bad target');
        const entity = vm.allocateEdict();
        vm.setGlobalWord('self', entity);
        expect(() => objectError(vm, 2)).toThrow('QuakeC object error: bad target');
        expect(removedEntity).toBe(entity);
        expect(vm.entity(entity).free).toBe(true);
    });

    it('gates variadic PF_dprint text through the source developer cvar', () => {
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        let developer = 0;
        const prints: string[] = [];
        registerQuakeBuiltins(vm, undefined, {
            cvarValue: name => (name === 'developer' ? developer : 0),
            print: (_entity, message) => prints.push(message)
        });
        const debugPrint = vm.builtins.get(25);
        if (!debugPrint) {
            throw new Error('dprint builtin is not registered');
        }
        vm.words[4] = vm.internString('debug ');
        vm.words[7] = vm.internString('message\n');

        debugPrint(vm, 2);
        expect(prints).toEqual([]);
        developer = 1;
        debugPrint(vm, 2);
        expect(prints).toEqual(['debug message\n']);
    });

    it('routes PF_dprint into the real console only while developer is enabled', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const debugPrint = vm.builtins.get(25);
        if (!debugPrint) {
            throw new Error('dprint builtin is not registered');
        }
        vm.words[4] = vm.internString('source debug line\n');

        debugPrint(vm, 1);
        expect(world.consoleLines).not.toContain('source debug line');
        world.setCvar('developer', '1');
        debugPrint(vm, 1);
        expect(world.consoleLines).toContain('source debug line');
    });

    it('parses cvar strings with the original Q_atof rules', () => {
        expect(quakeStringToFloat('12.5ignored')).toBe(12.5);
        expect(quakeStringToFloat('-0x10!')).toBe(-16);
        expect(quakeStringToFloat('\'A')).toBe(65);
        expect(quakeStringToFloat(' 12')).toBe(0);
    });

    it('bridges QuakeC cvar and cvar_set builtins through registered server cvars', () => {
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const cvars = new Map([['sv_gravity', '800']]);
        registerQuakeBuiltins(vm, undefined, {
            cvarValue: name => quakeStringToFloat(cvars.get(name) ?? ''),
            setCvar: (name, value) => {
                if (cvars.has(name)) cvars.set(name, value);
            }
        });
        const cvar = vm.builtins.get(45);
        const setCvar = vm.builtins.get(72);
        if (!cvar || !setCvar) {
            throw new Error('cvar builtins are not registered');
        }
        vm.words[4] = vm.internString('sv_gravity');
        cvar(vm, 1);
        expect(vm.values[1]).toBe(800);

        vm.words[4] = vm.internString('sv_gravity');
        vm.words[7] = vm.internString('100');
        setCvar(vm, 2);
        cvar(vm, 1);
        expect(vm.values[1]).toBe(100);
    });

    it('truncates QuakeC vector-derived yaw and pitch to source integer degrees', () => {
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        registerQuakeBuiltins(vm);
        const vectorToYaw = vm.builtins.get(13);
        const vectorToAngles = vm.builtins.get(51);
        if (!vectorToYaw || !vectorToAngles) {
            throw new Error('vector angle builtins are not registered');
        }

        vm.values.set([2, 1, 0], 4);
        vectorToYaw(vm, 1);
        expect(vm.values[1]).toBe(26);
        vm.values.set([2, -1, 0], 4);
        vectorToYaw(vm, 1);
        expect(vm.values[1]).toBe(334);

        vm.values.set([2, 0, 1], 4);
        vectorToAngles(vm, 1);
        expect([...vm.values.slice(1, 4)]).toEqual([26, 0, 0]);
        vm.values.set([2, 0, -1], 4);
        vectorToAngles(vm, 1);
        expect([...vm.values.slice(1, 4)]).toEqual([334, 0, 0]);
    });

    it('formats QuakeC float and vector strings with the source field widths', () => {
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        registerQuakeBuiltins(vm);
        const floatToString = vm.builtins.get(26);
        const vectorToString = vm.builtins.get(27);
        if (!floatToString || !vectorToString) {
            throw new Error('numeric string builtins are not registered');
        }

        vm.values[4] = 1.26;
        floatToString(vm, 1);
        expect(vm.getString(vm.words[1])).toBe('  1.3');
        vm.values[4] = -2;
        floatToString(vm, 1);
        expect(vm.getString(vm.words[1])).toBe('-2');
        vm.values.set([1.26, -2, 30], 4);
        vectorToString(vm, 1);
        expect(vm.getString(vm.words[1])).toBe('\'  1.3  -2.0  30.0\'');
    });

    it('packetizes QuakeC sounds at the source entity bounding-box center', () => {
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        let soundOrigin: [number, number, number] | undefined;
        let soundAttenuation: number | undefined;
        let soundVolume: number | undefined;
        registerQuakeBuiltins(vm, undefined, {
            sound: (event) => {
                soundAttenuation = event.attenuation;
                soundOrigin = event.origin;
                soundVolume = event.volume;
            }
        });
        const entity = vm.allocateEdict();
        vm.setEntityVector(entity, 'origin', [10.11, 20.22, 30.33]);
        vm.setEntityVector(entity, 'mins', [-2, -4, -6]);
        vm.setEntityVector(entity, 'maxs', [6, 8, 10]);
        vm.words[4] = entity;
        vm.values[7] = 2;
        vm.words[10] = vm.internString('misc/menu1.wav');
        vm.values[13] = 0.5;
        vm.values[16] = 0.3;
        const sound = vm.builtins.get(8);
        const precacheSound = vm.builtins.get(76);
        if (!sound || !precacheSound) {
            throw new Error('sound builtins are not registered');
        }
        sound(vm, 5);
        expect(soundOrigin).toBeUndefined();
        vm.words[4] = vm.words[10];
        precacheSound(vm, 1);
        vm.words[4] = entity;

        sound(vm, 5);

        expect(soundOrigin).toEqual([12, 22.125, 32.25]);
        expect(soundAttenuation).toBe(19 / 64);
        expect(soundVolume).toBe(127 / 255);
    });

    it('rejects model and sound precaching after the server becomes active', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const message = 'Precache can only be done in spawn functions';

        expect(world.playerReference).toBe(1);
        vm.words[4] = vm.internString('progs/player.mdl');
        expect(() => vm.builtins.get(20)!(vm, 1)).toThrow(message);
        vm.words[4] = vm.internString('misc/menu1.wav');
        expect(() => vm.builtins.get(19)!(vm, 1)).toThrow(message);
    });

    it('round-trips QuakeC particle fields through the source packet widths', () => {
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        let particle: QuakeParticleEvent | undefined;
        registerQuakeBuiltins(vm, undefined, {
            particle: (event) => {
                particle = event;
            }
        });
        const particleBuiltin = vm.builtins.get(48);
        if (!particleBuiltin) {
            throw new Error('particle builtin is not registered');
        }
        vm.values.set([10.11, -20.22, 30.33], 4);
        vm.values.set([20, -20, 0.19], 7);
        vm.values[10] = 300;
        vm.values[13] = 255;

        particleBuiltin(vm, 4);

        expect(particle).toMatchObject({
            color: 44,
            count: 1_024,
            direction: [127 / 16, -8, 3 / 16],
            origin: [10, -20.125, 30.25]
        });
    });

    it('keeps QuakeC absmin and absmax linked after setsize and setorigin', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        expect(world.serverGravity()).toBe(800);
        const entity = vm.allocateEdict();
        const setModel = vm.builtins.get(3);
        const setOrigin = vm.builtins.get(2);
        const setSize = vm.builtins.get(4);
        if (!setModel || !setOrigin || !setSize) {
            throw new Error('entity-linking builtins are not registered');
        }
        vm.words[4] = entity;
        vm.values.set([-1, -2, -3], 7);
        vm.values.set([4, 5, 6], 10);
        setSize(vm, 3);
        vm.values.set([10, 20, 30], 7);
        setOrigin(vm, 2);

        expect(vm.getEntityVector(entity, 'size')).toEqual([5, 7, 9]);
        expect(vm.getEntityVector(entity, 'absmin')).toEqual([8, 17, 26]);
        expect(vm.getEntityVector(entity, 'absmax')).toEqual([15, 26, 37]);

        vm.words[4] = entity;
        vm.words[7] = vm.internString('');
        setModel(vm, 2);
        expect(vm.getEntityVector(entity, 'mins')).toEqual([0, 0, 0]);
        expect(vm.getEntityVector(entity, 'maxs')).toEqual([0, 0, 0]);
        expect(vm.getEntityVector(entity, 'size')).toEqual([0, 0, 0]);
    });

    it('executes original QuakeC item and monster spawn functions', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        registerQuakeBuiltins(vm, new WorldCollision(map));
        vm.setGlobalFloat('deathmatch', 0);
        vm.setGlobalFloat('coop', 0);
        vm.setGlobalFloat('skill', 1);
        vm.setGlobalString('mapname', 'e1m1');
        vm.setGlobalWord('self', 0);
        vm.execute('worldspawn');

        const armor = vm.loadEdict({ classname: 'item_armor1', origin: '0 0 0' });
        vm.setGlobalWord('self', armor);
        vm.execute('item_armor1');
        expect(vm.getEntityString(armor, 'model')).toBe('progs/armor.mdl');
        const armorModelIndex = vm.getEntityFloat(armor, 'modelindex');
        expect(armorModelIndex).toBeGreaterThan(map.models.length);

        const soldier = vm.loadEdict({ classname: 'monster_army', origin: '0 0 0' });
        vm.setGlobalWord('self', soldier);
        vm.execute('monster_army');
        expect(vm.getEntityString(soldier, 'model')).toBe('progs/soldier.mdl');
        expect(vm.getEntityFloat(soldier, 'modelindex')).toBeGreaterThan(map.models.length);
        expect(vm.getEntityFloat(soldier, 'modelindex')).not.toBe(armorModelIndex);
        expect(vm.getEntityWord(soldier, 'think')).toBeGreaterThan(0);
    });

    it('loads every normal-skill E1M1 entity through its original QuakeC spawn function', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const program = new QuakeProgram(pak.get('progs.dat'));
        const vm = new QuakeVirtualMachine(program);
        registerQuakeBuiltins(vm, new WorldCollision(map));
        vm.setGlobalFloat('deathmatch', 0);
        vm.setGlobalFloat('coop', 0);
        vm.setGlobalFloat('skill', 1);
        vm.setGlobalString('mapname', 'e1m1');

        let loaded = 0;
        for (const [index, properties] of map.entities.entries()) {
            if ((Number(properties.spawnflags ?? 0) & 512) !== 0) {
                continue;
            }
            const quakeFunction = program.functionsByName.get(properties.classname);
            if (!quakeFunction) {
                continue;
            }
            const reference = vm.loadEdict(properties, index === 0 ? 0 : undefined);
            vm.setGlobalWord('self', reference);
            try {
                vm.execute(quakeFunction.index);
            } catch (error) {
                throw new Error(`Failed to spawn ${properties.classname}`, { cause: error });
            }
            loaded++;
        }

        expect(loaded).toBeGreaterThan(300);
    });

    it('applies the original single-player skill and deathmatch inhibit flags', () => {
        expect(quakeEntityInhibited(256, 0, false)).toBe(true);
        expect(quakeEntityInhibited(256, 1, false)).toBe(false);
        expect(quakeEntityInhibited(512, 1, false)).toBe(true);
        expect(quakeEntityInhibited(512, 2, false)).toBe(false);
        expect(quakeEntityInhibited(1_024, 2, false)).toBe(true);
        expect(quakeEntityInhibited(1_024, 3, false)).toBe(true);
        expect(quakeEntityInhibited(2_048, 1, false)).toBe(false);
        expect(quakeEntityInhibited(2_048, 1, true)).toBe(true);
        expect(quakeEntityInhibited(512, 1, true)).toBe(false);
    });

    it('spawns E1M1 skill-gated entities from the initial skill cvar', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const pentagramIndex = map.entities.findIndex(
            entity => entity.classname === 'item_artifact_invulnerability'
        );
        expect(pentagramIndex).toBeGreaterThan(0);
        expect(Number(map.entities[pentagramIndex].spawnflags) & 256).not.toBe(0);
        expect(Number(map.entities[pentagramIndex].spawnflags) & 512).not.toBe(0);
        expect(Number(map.entities[pentagramIndex].spawnflags) & 1_024).not.toBe(0);

        const mediumVm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const mediumWorld = new QuakeWorldRuntime(
            mediumVm,
            map,
            new WorldCollision(map)
        );
        expect(mediumWorld.entityReferences[pentagramIndex]).toBeNull();

        const deathmatchVm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const deathmatchWorld = new QuakeWorldRuntime(
            deathmatchVm,
            map,
            new WorldCollision(map),
            'e1m1',
            undefined,
            pak,
            { deathmatch: '1' }
        );
        const pentagram = deathmatchWorld.entityReferences[pentagramIndex];
        expect(pentagram).not.toBeNull();
        expect(deathmatchVm.getEntityString(pentagram ?? 0, 'model'))
        .toBe('progs/invulner.mdl');
        expect(deathmatchWorld.cvarString('deathmatch')).toBe('1');
    });

    it('runs original E1M1 QuakeC think functions over time', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const soldier = world.entityReferences.find((reference, index) => map.entities[index].classname === 'monster_army' &&
            reference !== null &&
            !vm.entity(reference).free &&
            vm.getEntityString(reference, 'model') === 'progs/soldier.mdl'
        );
        if (soldier === null || soldier === undefined) {
            throw new Error('E1M1 soldier was not spawned');
        }
        const initialFrame = vm.getEntityFloat(soldier, 'frame');

        for (let tick = 0; tick < 14; tick++) {
            world.update(0.05);
        }

        expect(vm.entity(soldier).free).toBe(false);
        expect(vm.getEntityFloat(soldier, 'frame')).not.toBe(initialFrame);
        expect(vm.getEntityFloat(soldier, 'nextthink')).toBeGreaterThan(world.time);
        const movementOrigin = vm.getEntityVector(soldier, 'origin');
        const moved = [[8, 0, 0], [-8, 0, 0], [0, 8, 0], [0, -8, 0]].some((movement) => {
            vm.setEntityVector(soldier, 'origin', movementOrigin);
            return world.moveStep(soldier, movement as [number, number, number]);
        });
        expect(moved).toBe(true);
        expect(vm.getEntityVector(soldier, 'origin')).not.toEqual(movementOrigin);
    });

    const e1m1NormalPatrolRoutes = [
        { route: ['t16', 't17'], start: 't16' },
        { route: ['t20', 't21', 't22', 't19'], start: 't20' },
        { route: ['t22', 't19', 't20', 't21'], start: 't22' },
        { route: ['t25', 't26', 't27', 't28'], start: 't25' },
        { route: ['t27', 't28', 't25', 't26'], start: 't27' },
        { route: ['t29', 't30'], start: 't29' }
    ] as const;

    it('accounts for every normal-skill authored E1M1 soldier patrol', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const activePatrolStarts = map.entities.filter(entity => (
            entity.classname === 'monster_army' && entity.target !== undefined &&
            !quakeEntityInhibited(Number(entity.spawnflags ?? 0), 1, false)
        )).map(entity => entity.target).sort();

        expect(activePatrolStarts).toEqual(
            e1m1NormalPatrolRoutes.map(patrol => patrol.start).sort()
        );
    });

    it.each(e1m1NormalPatrolRoutes)(
        'completes the authored E1M1 $start soldier patrol loop',
        ({ route, start }) => {
            const map = new BspMap(pak.get('maps/e1m1.bsp'));
            const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
            const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
            const soldierIndex = map.entities.findIndex(entity => (
                entity.classname === 'monster_army' && entity.target === start
            ));
            const soldier = world.entityReferences[soldierIndex];
            const corners = route.map((targetname) => {
                const index = map.entities.findIndex(entity => (
                    entity.classname === 'path_corner' && entity.targetname === targetname
                ));
                return world.entityReferences[index];
            });
            if (soldier === null || soldier === undefined ||
                corners.some(corner => corner === null || corner === undefined)) {
                throw new Error(`E1M1 authored ${start} soldier patrol was not spawned`);
            }
            const cornerReferences = corners.filter(
                (corner): corner is number => corner !== null && corner !== undefined
            );
            const expectedTargets = [...cornerReferences, cornerReferences[0]];
            const playerFlags = Math.trunc(
                vm.getEntityFloat(world.playerReference, 'flags')
            );
            vm.setEntityFloat(world.playerReference, 'flags', playerFlags | 128);
            const initialOrigin = vm.getEntityVector(soldier, 'origin');
            let visitedTargets = 0;

            for (let tick = 0; tick < 2_000 &&
                visitedTargets < expectedTargets.length; tick++) {
                world.update(0.05);
                if (vm.getEntityWord(soldier, 'movetarget') ===
                    expectedTargets[visitedTargets]) {
                    visitedTargets++;
                }
            }

            expect(visitedTargets).toBe(expectedTargets.length);
            expect(vm.getEntityWord(soldier, 'enemy')).toBe(0);
            expect(vm.getEntityVector(soldier, 'origin')).not.toEqual(initialOrigin);
            expect(vm.getEntityWord(soldier, 'movetarget')).toBe(cornerReferences[0]);
            expect(vm.getEntityWord(soldier, 'goalentity')).toBe(cornerReferences[0]);
            for (const corner of cornerReferences) {
                expect(vm.program.functions[vm.getEntityWord(corner, 'touch')].name).toBe(
                    't_movetarget'
                );
            }
        }
    );

    it('routes original soldier hitscan damage back to the player', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const soldier = world.entityReferences.find((reference, index) => {
            return map.entities[index].classname === 'monster_army' && reference !== null &&
                !vm.entity(reference).free &&
                vm.getEntityString(reference, 'model') === 'progs/soldier.mdl';
        });
        if (soldier === null || soldier === undefined) {
            throw new Error('E1M1 soldier was not spawned');
        }
        for (let tick = 0; tick < 10; tick++) {
            world.update(0.1);
        }
        vm.setEntityVector(world.playerReference, 'origin', vm.getEntityVector(soldier, 'origin'));
        vm.setEntityWord(soldier, 'enemy', world.playerReference);
        vm.setGlobalWord('self', soldier);
        const initialHealth = vm.getEntityFloat(world.playerReference, 'health');

        vm.execute('army_fire');

        expect(vm.getEntityFloat(world.playerReference, 'health')).toBeLessThan(initialHealth);
        expect(world.soundEvents.some(event => event.entity === soldier &&
            event.sample === 'soldier/sattck1.wav'
        )).toBe(true);
    });

    it('lets an E1M1 soldier acquire and attack the player through its think loop', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const soldier = world.entityReferences.find((reference, index) => {
            return map.entities[index].classname === 'monster_army' && reference !== null &&
                !vm.entity(reference).free &&
                vm.getEntityString(reference, 'model') === 'progs/soldier.mdl';
        });
        const setOrigin = vm.builtins.get(2);
        if (soldier === null || soldier === undefined || !setOrigin) {
            throw new Error('E1M1 soldier or setorigin builtin is unavailable');
        }
        for (let tick = 0; tick < 10; tick++) {
            world.update(0.1);
        }
        const playerOrigin = vm.getEntityVector(world.playerReference, 'origin');
        vm.words[4] = soldier;
        vm.values.set([playerOrigin[0] + 64, playerOrigin[1], playerOrigin[2]], 7);
        setOrigin(vm, 2);
        vm.setEntityVector(soldier, 'angles', [0, 180, 0]);
        vm.setEntityFloat(soldier, 'ideal_yaw', 180);
        vm.setEntityWord(soldier, 'enemy', 0);
        const initialHealth = vm.getEntityFloat(world.playerReference, 'health');
        const playerState = {
            angles: [0, 0, 0] as [number, number, number],
            attack: false,
            jump: false,
            onGround: true,
            origin: playerOrigin,
            velocity: [0, 0, 0] as [number, number, number]
        };

        for (let tick = 0; tick < 100 &&
            vm.getEntityFloat(world.playerReference, 'health') === initialHealth; tick++) {
            world.update(0.05, playerState);
        }

        expect(vm.getEntityWord(soldier, 'enemy')).toBe(world.playerReference);
        expect(vm.getEntityFloat(world.playerReference, 'health')).toBeLessThan(initialHealth);
    });

    it('carries an E1M2 ogre grenade from acquisition through impact damage', () => {
        const map = new BspMap(pak.get('maps/e1m2.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map), 'e1m2');
        const ogre = world.entityReferences.find((reference, index) => {
            return map.entities[index].classname === 'monster_ogre' && reference !== null &&
                !vm.entity(reference).free &&
                vm.getEntityString(reference, 'model') === 'progs/ogre.mdl';
        });
        const setOrigin = vm.builtins.get(2);
        if (ogre === null || ogre === undefined || !setOrigin) {
            throw new Error('E1M2 ogre or setorigin builtin is unavailable');
        }
        for (let tick = 0; tick < 10; tick++) world.update(0.1);

        const player = world.playerReference;
        const playerOrigin = vm.getEntityVector(player, 'origin');
        const ogreMins = vm.getEntityVector(ogre, 'mins');
        const ogreMaxs = vm.getEntityVector(ogre, 'maxs');
        const directions = [
            [1, 0], [-1, 0], [0, 1], [0, -1],
            [Math.SQRT1_2, Math.SQRT1_2],
            [-Math.SQRT1_2, Math.SQRT1_2],
            [Math.SQRT1_2, -Math.SQRT1_2],
            [-Math.SQRT1_2, -Math.SQRT1_2]
        ] as const;
        let ogreOrigin: [number, number, number] | undefined;
        for (const distance of [96, 128, 160]) {
            for (const direction of directions) {
                const candidate: [number, number, number] = [
                    playerOrigin[0] + direction[0] * distance,
                    playerOrigin[1] + direction[1] * distance,
                    playerOrigin[2]
                ];
                const occupancy = world.collision.traceBox(
                    candidate,
                    candidate,
                    ogreMins,
                    ogreMaxs
                );
                const sightStart: [number, number, number] = [
                    candidate[0], candidate[1], candidate[2] + 16
                ];
                const sightEnd: [number, number, number] = [
                    playerOrigin[0], playerOrigin[1], playerOrigin[2] + 16
                ];
                if (!occupancy.startSolid && !occupancy.allSolid &&
                    world.traceLine(sightStart, sightEnd, false, ogre).entity === player) {
                    ogreOrigin = candidate;
                    break;
                }
            }
            if (ogreOrigin) break;
        }
        if (!ogreOrigin) {
            throw new Error('E1M2 player spawn has no clear nearby ogre test position');
        }

        vm.words[4] = ogre;
        vm.values.set(ogreOrigin, 7);
        setOrigin(vm, 2);
        const yaw = Math.atan2(
            playerOrigin[1] - ogreOrigin[1],
            playerOrigin[0] - ogreOrigin[0]
        ) * 180 / Math.PI;
        vm.setEntityVector(ogre, 'angles', [0, yaw, 0]);
        vm.setEntityFloat(ogre, 'ideal_yaw', yaw);
        vm.setEntityWord(ogre, 'enemy', 0);
        const playerState = {
            angles: [0, 0, 0] as [number, number, number],
            attack: false,
            jump: false,
            onGround: true,
            origin: playerOrigin,
            velocity: [0, 0, 0] as [number, number, number]
        };

        for (let tick = 0; tick < 40 && vm.getEntityWord(ogre, 'enemy') === 0; tick++) {
            world.update(0.05, playerState);
        }
        expect(vm.getEntityWord(ogre, 'enemy')).toBe(player);

        vm.setGlobalWord('self', ogre);
        vm.execute('OgreFireGrenade');
        const grenade = vm.edicts.findIndex((edict, reference) => (
            reference > player && !edict.free &&
            vm.getEntityString(reference, 'model') === 'progs/grenade.mdl' &&
            vm.getEntityWord(reference, 'owner') === ogre
        ));
        expect(grenade).toBeGreaterThan(player);
        expect(vm.getEntityString(grenade, 'model')).toBe('progs/grenade.mdl');
        expect(vm.getEntityFloat(grenade, 'movetype')).toBe(10);
        expect(vm.program.functions[vm.getEntityWord(grenade, 'touch')].name).toBe(
            'OgreGrenadeTouch'
        );
        expect(vm.program.functions[vm.getEntityWord(grenade, 'think')].name).toBe(
            'OgreGrenadeExplode'
        );
        const fuseDeadline = vm.getEntityFloat(grenade, 'nextthink');
        expect(world.soundEvents.some(
            event => event.entity === ogre && event.sample === 'weapons/grenade.wav'
        )).toBe(true);

        const initialHealth = vm.getEntityFloat(player, 'health');
        const initialOrigin = vm.getEntityVector(grenade, 'origin');
        let moved = false;
        for (let tick = 0; tick < 60 && !vm.entity(grenade).free; tick++) {
            world.update(0.05, playerState);
            moved ||= vm.getEntityVector(grenade, 'origin').some(
                (component, axis) => component !== initialOrigin[axis]
            );
        }

        expect(moved).toBe(true);
        expect(vm.entity(grenade).free).toBe(true);
        expect(world.time).toBeLessThan(fuseDeadline);
        expect(vm.getEntityFloat(player, 'health')).toBeLessThan(initialHealth);
        expect(world.soundEvents.some(
            event => event.sample === 'weapons/r_exp3.wav'
        )).toBe(true);
        expect(world.particleEvents.some(
            event => event.kind === 'explosion' && event.count === 1_024
        )).toBe(true);
    });

    it.each([
        {
            attackSamples: ['knight/sword1.wav', 'knight/sword2.wav'],
            classname: 'monster_knight',
            distance: 48,
            mapName: 'e1m2',
            model: 'progs/knight.mdl'
        },
        {
            attackSamples: ['demon/dhit2.wav'],
            classname: 'monster_demon1',
            distance: 48,
            mapName: 'e1m2',
            model: 'progs/demon.mdl'
        },
        {
            attackSamples: ['wizard/wattack.wav'],
            classname: 'monster_wizard',
            distance: 160,
            mapName: 'e1m4',
            model: 'progs/wizard.mdl',
            projectileModel: 'progs/w_spike.mdl',
            projectileTouch: 'spike_touch'
        },
        {
            attackSamples: [
                'shambler/melee1.wav',
                'shambler/melee2.wav',
                'shambler/smack.wav'
            ],
            classname: 'monster_shambler',
            distance: 64,
            mapName: 'e1m7',
            model: 'progs/shambler.mdl'
        },
        {
            attackSamples: ['zombie/z_shot1.wav'],
            classname: 'monster_zombie',
            distance: 160,
            mapName: 'e1m3',
            model: 'progs/zombie.mdl',
            projectileModel: 'progs/zom_gib.mdl',
            projectileTouch: 'ZombieGrenadeTouch'
        }
    ] as const)(
        'lets an authored $classname acquire and damage the player',
        ({ classname, distance, mapName, model, ...combat }) => {
            const map = new BspMap(pak.get(`maps/${mapName}.bsp`));
            const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
            const world = new QuakeWorldRuntime(
                vm,
                map,
                new WorldCollision(map),
                mapName
            );
            const monster = world.entityReferences.find((reference, index) => {
                return map.entities[index].classname === classname && reference !== null &&
                    !vm.entity(reference).free &&
                    vm.getEntityString(reference, 'model') === model;
            });
            const setOrigin = vm.builtins.get(2);
            if (monster === null || monster === undefined || !setOrigin) {
                const authored = map.entities.flatMap((entity, index) => (
                    entity.classname === classname ? [{
                        active: world.entityReferences[index],
                        spawnflags: entity.spawnflags ?? '0'
                    }] : []
                ));
                throw new Error(
                    `${mapName} ${classname} or setorigin builtin is unavailable: ${
                        JSON.stringify(authored)
                    }`
                );
            }
            for (let tick = 0; tick < 10; tick++) world.update(0.1);

            const player = world.playerReference;
            const playerOrigin = vm.getEntityVector(player, 'origin');
            const monsterMins = vm.getEntityVector(monster, 'mins');
            const monsterMaxs = vm.getEntityVector(monster, 'maxs');
            const directions = [
                [1, 0], [-1, 0], [0, 1], [0, -1],
                [Math.SQRT1_2, Math.SQRT1_2],
                [-Math.SQRT1_2, Math.SQRT1_2],
                [Math.SQRT1_2, -Math.SQRT1_2],
                [-Math.SQRT1_2, -Math.SQRT1_2]
            ] as const;
            const distances = distance < 100 ?
                [distance, distance + 16, distance + 32] :
                [distance, distance - 32, distance + 32];
            let monsterOrigin: [number, number, number] | undefined;
            for (const candidateDistance of distances) {
                for (const direction of directions) {
                    const candidate: [number, number, number] = [
                        playerOrigin[0] + direction[0] * candidateDistance,
                        playerOrigin[1] + direction[1] * candidateDistance,
                        playerOrigin[2]
                    ];
                    const occupancy = world.collision.traceBox(
                        candidate,
                        candidate,
                        monsterMins,
                        monsterMaxs
                    );
                    const sightStart: [number, number, number] = [
                        candidate[0], candidate[1], candidate[2] + 16
                    ];
                    const sightEnd: [number, number, number] = [
                        playerOrigin[0], playerOrigin[1], playerOrigin[2] + 16
                    ];
                    if (!occupancy.startSolid && !occupancy.allSolid &&
                        world.traceLine(
                            sightStart,
                            sightEnd,
                            false,
                            monster
                        ).entity === player) {
                        monsterOrigin = candidate;
                        break;
                    }
                }
                if (monsterOrigin) break;
            }
            if (!monsterOrigin) {
                throw new Error(`${mapName} spawn has no clear ${classname} test position`);
            }

            vm.words[4] = monster;
            vm.values.set(monsterOrigin, 7);
            setOrigin(vm, 2);
            const yaw = Math.atan2(
                playerOrigin[1] - monsterOrigin[1],
                playerOrigin[0] - monsterOrigin[0]
            ) * 180 / Math.PI;
            vm.setEntityVector(monster, 'angles', [0, yaw, 0]);
            vm.setEntityFloat(monster, 'ideal_yaw', yaw);
            vm.setEntityWord(monster, 'enemy', 0);
            vm.setEntityFloat(monster, 'attack_finished', 0);
            const initialHealth = vm.getEntityFloat(player, 'health');
            const playerState = {
                angles: [0, 0, 0] as [number, number, number],
                attack: false,
                jump: false,
                onGround: true,
                origin: playerOrigin,
                velocity: [0, 0, 0] as [number, number, number]
            };
            let acquired = false;
            let sawProjectile = false;
            let projectileTouch = '';

            for (let tick = 0; tick < 240 &&
                vm.getEntityFloat(player, 'health') === initialHealth; tick++) {
                world.update(0.05, playerState);
                acquired ||= vm.getEntityWord(monster, 'enemy') === player;
                if ('projectileModel' in combat) {
                    const projectile = vm.edicts.findIndex((edict, reference) => (
                        reference > player && !edict.free &&
                        vm.getEntityWord(reference, 'owner') === monster &&
                        vm.getEntityString(reference, 'model') === combat.projectileModel
                    ));
                    if (projectile > player) {
                        sawProjectile = true;
                        projectileTouch = vm.program.functions[
                        vm.getEntityWord(projectile, 'touch')
                        ].name;
                    }
                }
            }

            expect(acquired).toBe(true);
            expect(vm.getEntityFloat(player, 'health')).toBeLessThan(initialHealth);
            expect(world.soundEvents.some(
                event => combat.attackSamples.some(sample => sample === event.sample)
            )).toBe(true);
            if ('projectileModel' in combat) {
                expect(sawProjectile).toBe(true);
                expect(projectileTouch).toBe(combat.projectileTouch);
            }
        }
    );

    it('runs E1M7 Chthon from the rune wake through three authored lightning shocks', () => {
        const map = new BspMap(pak.get('maps/e1m7.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map), 'e1m7');
        const activeMapEntity = (
            predicate: (entity: Readonly<Record<string, string>>) => boolean
        ): number => {
            const index = map.entities.findIndex(predicate);
            const reference = world.entityReferences[index];
            if (index < 0 || reference === null || reference === undefined ||
                vm.entity(reference).free) {
                throw new Error('E1M7 authored encounter entity was not spawned');
            }
            return reference;
        };
        const boss = activeMapEntity(entity => entity.classname === 'monster_boss');
        const sigil = activeMapEntity(entity => entity.classname === 'item_sigil');
        const leftButton = activeMapEntity(entity => (
            entity.classname === 'func_button' && entity.target === 't12' &&
            !quakeEntityInhibited(Number(entity.spawnflags ?? 0), 1, false)
        ));
        const rightButton = activeMapEntity(entity => (
            entity.classname === 'func_button' && entity.target === 't13' &&
            !quakeEntityInhibited(Number(entity.spawnflags ?? 0), 1, false)
        ));
        const centerButton = activeMapEntity(entity => (
            entity.classname === 'func_button' && entity.target === 't14'
        ));
        const leftRod = activeMapEntity(entity => (
            entity.classname === 'func_door' && entity.targetname === 't12'
        ));
        const rightRod = activeMapEntity(entity => (
            entity.classname === 'func_door' && entity.targetname === 't13'
        ));
        const lightning = activeMapEntity(entity => entity.classname === 'event_lightning');
        const exit = activeMapEntity(entity => entity.classname === 'trigger_changelevel');
        const exitDoors = map.entities.flatMap((entity, index) => {
            const reference = world.entityReferences[index];
            return entity.classname === 'func_door' && entity.targetname === 't9' &&
                reference !== null && reference !== undefined ? [reference] : [];
        });
        expect(exitDoors).toHaveLength(3);
        for (let tick = 0; tick < 5; tick++) world.update(0.05);

        expect(vm.program.functions[vm.getEntityWord(boss, 'use')].name).toBe('boss_awake');
        expect(vm.program.functions[vm.getEntityWord(lightning, 'use')].name).toBe(
            'lightning_use'
        );
        const sigilOrigin = vm.getEntityVector(sigil, 'origin');
        const player = world.playerReference;
        vm.setEntityFloat(player, 'health', 1_000);
        vm.setEntityFloat(
            player,
            'flags',
            Math.trunc(vm.getEntityFloat(player, 'flags')) | 64
        );
        const playerState = {
            angles: [0, 0, 0] as [number, number, number],
            attack: false,
            jump: false,
            onGround: true,
            origin: sigilOrigin,
            velocity: [0, 0, 0] as [number, number, number]
        };
        world.update(0.01, playerState);

        expect(vm.getEntityWord(boss, 'enemy')).toBe(player);
        expect(vm.getEntityFloat(sigil, 'solid')).toBe(0);
        expect(vm.getEntityString(sigil, 'model')).toBe('');
        const initialBossHealth = vm.getEntityFloat(boss, 'health');
        expect(initialBossHealth).toBe(3);
        let sawLavaBall = false;
        for (let tick = 0; tick < 120 && !sawLavaBall; tick++) {
            world.update(0.05, playerState);
            sawLavaBall = vm.edicts.some((edict, reference) => (
                reference > player && !edict.free &&
                vm.getEntityWord(reference, 'owner') === boss &&
                vm.getEntityString(reference, 'model') === 'progs/lavaball.mdl'
            ));
        }
        expect(sawLavaBall).toBe(true);

        const touchButton = (button: number): void => {
            const modelIndex = Number(vm.getEntityString(button, 'model').slice(1));
            world.update(0.01, {
                ...playerState,
                touchModelIndices: [modelIndex]
            });
        };
        for (let shock = 1; shock <= 3; shock++) {
            for (let tick = 0; tick < 200 && (
                vm.getEntityFloat(leftRod, 'state') !== 1 ||
                vm.getEntityFloat(rightRod, 'state') !== 1 ||
                vm.getEntityFloat(leftButton, 'state') !== 1 ||
                vm.getEntityFloat(rightButton, 'state') !== 1 ||
                vm.getEntityFloat(centerButton, 'state') !== 1
            ); tick++) {
                world.update(0.05, playerState);
            }
            touchButton(leftButton);
            touchButton(rightButton);
            for (let tick = 0; tick < 100 && (
                vm.getEntityFloat(leftRod, 'state') !== 0 ||
                vm.getEntityFloat(rightRod, 'state') !== 0
            ); tick++) {
                world.update(0.05, playerState);
            }
            expect(vm.getEntityFloat(leftRod, 'state')).toBe(0);
            expect(vm.getEntityFloat(rightRod, 'state')).toBe(0);
            touchButton(centerButton);
            for (let tick = 0; tick < 80 &&
                vm.getEntityFloat(boss, 'health') > initialBossHealth - shock; tick++) {
                world.update(0.05, playerState);
            }
            expect(vm.getEntityFloat(boss, 'health')).toBe(initialBossHealth - shock);
            expect(world.activeBeams().some(beam => beam.model === 'progs/bolt3.mdl')).toBe(true);
        }

        expect(vm.getEntityFloat(boss, 'health')).toBe(0);
        expect(world.soundEvents.some(
            event => event.sample === 'misc/power.wav'
        )).toBe(true);
        for (let tick = 0; tick < 200 && !vm.entity(boss).free; tick++) {
            world.update(0.05, playerState);
        }
        expect(vm.entity(boss).free).toBe(true);
        expect(exitDoors.some(
            door => vm.getEntityFloat(door, 'state') === 2 ||
                vm.getEntityVector(door, 'velocity').some(component => component !== 0)
        )).toBe(true);
        for (let tick = 0; tick < 200 && exitDoors.some(
            door => vm.getEntityFloat(door, 'state') !== 0
        ); tick++) {
            world.update(0.05, playerState);
        }
        expect(exitDoors.every(door => vm.getEntityFloat(door, 'state') === 0)).toBe(true);

        expect(Math.trunc(vm.getGlobalFloat('serverflags')) & 1).toBe(1);
        const exitOrigin = vm.getEntityVector(exit, 'origin');
        const exitMins = vm.getEntityVector(exit, 'mins');
        const exitMaxs = vm.getEntityVector(exit, 'maxs');
        const exitCenter = exitOrigin.map(
            (component, axis) => component + (exitMins[axis] + exitMaxs[axis]) / 2
        ) as [number, number, number];
        let exitState = {
            ...playerState,
            origin: exitCenter
        };
        world.update(0.01, exitState);
        world.update(0.1, exitState);
        expect(world.intermission).toBe(1);
        const intermissionExitTime = vm.getGlobalFloat('intermission_exittime');
        for (let frame = 0; frame < 100 && world.time <= intermissionExitTime; frame++) {
            const current = world.playerResult();
            exitState = {
                ...exitState,
                angles: current.angles,
                origin: current.origin,
                velocity: current.velocity
            };
            world.update(0.1, exitState);
        }
        expect(world.time).toBeGreaterThan(intermissionExitTime);
        for (let frame = 0; frame < 10 && world.intermission !== 2; frame++) {
            world.update(0.05, { ...exitState, attack: frame % 2 === 0 });
        }
        expect(world.intermission).toBe(2);
        expect(vm.getGlobalFloat('intermission_running')).toBe(2);
        expect(world.centerMessage).toContain(
            'As the corpse of the monstrous entity\nChthon sinks back into the lava'
        );
        expect(world.centerMessage).toContain('If\nyou don\'t register Quake');
        expect(world.takePendingLevelTransition()).toBeUndefined();
    });

    it('routes an original E1M1 dog bite through QuakeC melee damage', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const dog = world.entityReferences.find((reference, index) => {
            return map.entities[index].classname === 'monster_dog' && reference !== null &&
                !vm.entity(reference).free &&
                vm.getEntityString(reference, 'model') === 'progs/dog.mdl';
        });
        if (dog === null || dog === undefined) {
            throw new Error('E1M1 dog was not spawned');
        }
        for (let tick = 0; tick < 10; tick++) world.update(0.1);
        vm.setEntityVector(world.playerReference, 'origin', vm.getEntityVector(dog, 'origin'));
        vm.setEntityWord(dog, 'enemy', world.playerReference);
        vm.setGlobalWord('self', dog);
        const initialHealth = vm.getEntityFloat(world.playerReference, 'health');

        vm.execute('dog_bite');

        expect(vm.getEntityFloat(world.playerReference, 'health')).toBeLessThan(initialHealth);
    });

    it('lets an E1M1 dog acquire and attack the player through its think loop', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const dog = world.entityReferences.find((reference, index) => {
            return map.entities[index].classname === 'monster_dog' && reference !== null &&
                !vm.entity(reference).free &&
                vm.getEntityString(reference, 'model') === 'progs/dog.mdl';
        });
        const setOrigin = vm.builtins.get(2);
        if (dog === null || dog === undefined || !setOrigin) {
            throw new Error('E1M1 dog or setorigin builtin is unavailable');
        }
        for (let tick = 0; tick < 10; tick++) world.update(0.1);
        const playerOrigin = vm.getEntityVector(world.playerReference, 'origin');
        vm.words[4] = dog;
        vm.values.set([playerOrigin[0] + 48, playerOrigin[1], playerOrigin[2]], 7);
        setOrigin(vm, 2);
        vm.setEntityVector(dog, 'angles', [0, 180, 0]);
        vm.setEntityFloat(dog, 'ideal_yaw', 180);
        vm.setEntityWord(dog, 'enemy', 0);
        const initialHealth = vm.getEntityFloat(world.playerReference, 'health');
        const playerState = {
            angles: [0, 0, 0] as [number, number, number],
            attack: false,
            jump: false,
            onGround: true,
            origin: playerOrigin,
            velocity: [0, 0, 0] as [number, number, number]
        };

        for (let tick = 0; tick < 120 &&
            vm.getEntityFloat(world.playerReference, 'health') === initialHealth; tick++) {
            world.update(0.05, playerState);
        }

        expect(vm.getEntityWord(dog, 'enemy')).toBe(world.playerReference);
        expect(vm.getEntityFloat(world.playerReference, 'health')).toBeLessThan(initialHealth);
        expect(world.soundEvents.some(
            event => event.entity === dog && event.sample.startsWith('dog/')
        )).toBe(true);
    });

    it('carries an E1M1 dog leap through step physics into JumpTouch damage', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const dog = world.entityReferences.find((reference, index) => {
            return map.entities[index].classname === 'monster_dog' && reference !== null &&
                !vm.entity(reference).free &&
                vm.getEntityString(reference, 'model') === 'progs/dog.mdl';
        });
        const jumpTouch = vm.program.functionsByName.get('Dog_JumpTouch');
        const leap = vm.program.functionsByName.get('dog_leap1');
        if (dog === null || dog === undefined || !jumpTouch || !leap) {
            throw new Error('E1M1 dog leap prerequisites are unavailable');
        }
        for (let tick = 0; tick < 10; tick++) world.update(0.1);
        const dogOrigin = vm.getEntityVector(dog, 'origin');
        const playerOrigin = [
            dogOrigin[0], dogOrigin[1] - 160, dogOrigin[2]
        ] as [number, number, number];
        world.setPlayerPose(playerOrigin, [0, 0, 0]);
        vm.setEntityVector(dog, 'angles', [0, 270, 0]);
        vm.setEntityFloat(dog, 'ideal_yaw', 270);
        vm.setEntityWord(dog, 'enemy', world.playerReference);
        world.setSnapshotTime(1);
        vm.setEntityWord(dog, 'think', leap.index);
        vm.setEntityFloat(dog, 'nextthink', world.time + 0.05);
        const initialHealth = vm.getEntityFloat(world.playerReference, 'health');
        const playerState = {
            angles: [0, 0, 0] as [number, number, number],
            attack: false,
            jump: false,
            onGround: true,
            origin: playerOrigin,
            velocity: [0, 0, 0] as [number, number, number]
        };
        let sawJumpTouch = false;
        let sawAirborneVelocity = false;
        let firstAirborneTick = -1;
        let damageTick = -1;

        for (let tick = 0; tick < 30 &&
            vm.getEntityFloat(world.playerReference, 'health') === initialHealth; tick++) {
            world.update(0.05, playerState);
            sawJumpTouch ||= vm.getEntityWord(dog, 'touch') === jumpTouch.index;
            const velocity = vm.getEntityVector(dog, 'velocity');
            sawAirborneVelocity ||= velocity[1] < -250 && velocity[2] > 0;
            if (firstAirborneTick < 0 && velocity[1] < -250 && velocity[2] > 0) {
                firstAirborneTick = tick;
            }
            if (vm.getEntityFloat(world.playerReference, 'health') < initialHealth) {
                damageTick = tick;
            }
        }

        expect({ damageTick, firstAirborneTick }).toEqual({
            damageTick: 10,
            firstAirborneTick: 2
        });
        expect(sawJumpTouch).toBe(true);
        expect(sawAirborneVelocity).toBe(true);
        expect(vm.getEntityVector(dog, 'origin')[1]).toBeLessThan(dogOrigin[1] - 80);
        expect(vm.getEntityFloat(world.playerReference, 'health')).toBeLessThan(initialHealth);
        expect(vm.getEntityWord(world.playerReference, 'dmg_inflictor')).toBe(dog);
    });

    it('executes the original QuakeC StartFrame hook once per server frame', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const initialFrameCount = vm.getGlobalFloat('framecount');
        const initialServerTime = world.time;

        world.update(0.05);
        expect(vm.getGlobalFloat('framecount')).toBe(initialFrameCount + 1);
        expect(vm.getGlobalFloat('time')).toBe(initialServerTime);
        expect(world.time).toBeCloseTo(initialServerTime + 0.05);
        world.update(0.05);
        expect(vm.getGlobalFloat('framecount')).toBe(initialFrameCount + 2);
        expect(vm.getGlobalFloat('time')).toBeCloseTo(initialServerTime + 0.05);
    });

    it('applies the QuakeC-controlled sv_gravity cvar to toss physics', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        expect(world.serverGravity()).toBe(800);
        world.setCvar('sv_gravity', '100');
        const tossed = vm.allocateEdict();
        vm.setEntityFloat(tossed, 'movetype', 6);
        vm.setEntityVector(tossed, 'origin', [10_000, 10_000, 10_000]);
        vm.setEntityVector(tossed, 'mins', [0, 0, 0]);
        vm.setEntityVector(tossed, 'maxs', [0, 0, 0]);

        world.update(0.05);

        expect(vm.getEntityVector(tossed, 'velocity')[2]).toBeCloseTo(-5);
        expect(vm.getEntityVector(tossed, 'origin')[2]).toBeCloseTo(9_999.75);
    });

    it('sanitizes entity vectors and applies the live sv_maxvelocity limit', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        expect(world.serverMaximumVelocity()).toBe(2_000);
        world.setCvar('sv_maxvelocity', '100');
        const missile = vm.allocateEdict();
        vm.setEntityString(missile, 'classname', 'velocity_test');
        vm.setEntityFloat(missile, 'movetype', 5);
        vm.setEntityVector(missile, 'origin', [10_000, Number.NaN, Number.POSITIVE_INFINITY]);
        vm.setEntityVector(missile, 'velocity', [
            5_000, Number.NEGATIVE_INFINITY, -5_000
        ]);

        world.update(0.05);

        expect(vm.getEntityVector(missile, 'origin')).toEqual([10_005, 0, -5]);
        expect(vm.getEntityVector(missile, 'velocity')).toEqual([100, 0, -100]);
        expect(world.consoleLines).toContain('Got a NaN velocity on velocity_test');
        expect(world.consoleLines).toContain('Got a NaN origin on velocity_test');
    });

    it('runs player pre-think and velocity checks before delegated client movement', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        world.setCvar('sv_maxvelocity', '100');
        const initial = world.playerResult();
        let delegatedVelocity: [number, number, number] | undefined;

        world.update(0.05, {
            angles: initial.angles,
            attack: false,
            jump: false,
            onGround: true,
            origin: initial.origin,
            velocity: [5_000, 0, 0]
        }, (preMoveState) => {
            delegatedVelocity = preMoveState.velocity;
            return {
                angles: preMoveState.angles,
                attack: false,
                jump: false,
                onGround: true,
                origin: [
                    preMoveState.origin[0] + preMoveState.velocity[0] * 0.05,
                    preMoveState.origin[1],
                    preMoveState.origin[2]
                ],
                velocity: preMoveState.velocity
            };
        });

        expect(delegatedVelocity).toEqual([100, 0, 0]);
        expect(vm.getEntityVector(world.playerReference, 'origin')[0]).toBeCloseTo(
            initial.origin[0] + 5
        );
    });

    it('delegates the original QuakeC jump velocity without a client-side duplicate', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const initial = world.playerResult();
        vm.setEntityFloat(world.playerReference, 'flags', 512 | 4_096);
        let delegatedVerticalVelocity = 0;

        const result = world.update(0.01, {
            angles: initial.angles,
            attack: false,
            jump: true,
            onGround: true,
            origin: initial.origin,
            velocity: [0, 0, 0],
            waterLevel: 0,
            waterType: -1
        }, (preMoveState) => {
            delegatedVerticalVelocity = preMoveState.velocity[2];
            return {
                angles: preMoveState.angles,
                attack: false,
                jump: true,
                onGround: false,
                origin: preMoveState.origin,
                velocity: preMoveState.velocity,
                waterLevel: 0,
                waterType: -1
            };
        });

        expect(delegatedVerticalVelocity).toBe(270);
        expect(result.velocity[2]).toBe(270);
        expect(world.soundEvents.filter(
            event => event.sample === 'player/plyrjmp8.wav'
        )).toHaveLength(1);
    });

    it('delegates QuakeC-selected client toss movement to the controller phase', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const initial = world.playerResult();
        vm.setEntityFloat(world.playerReference, 'movetype', 6);
        vm.setEntityVector(world.playerReference, 'angles', [10, 20, 30]);
        vm.setEntityVector(world.playerReference, 'avelocity', [100, -200, 300]);
        let delegatedMoveType = -1;

        const result = world.update(0.01, {
            angularVelocity: [100, -200, 300],
            angles: initial.angles,
            attack: false,
            entityAngles: [10, 20, 30],
            jump: false,
            onGround: false,
            origin: initial.origin,
            velocity: [0, 0, -10]
        }, (preMoveState) => {
            delegatedMoveType = preMoveState.moveType;
            return {
                angularVelocity: preMoveState.angularVelocity,
                angles: preMoveState.angles,
                attack: false,
                entityAngles: quakeTossAngles(
                    preMoveState.entityAngles,
                    preMoveState.angularVelocity,
                    0.01
                ),
                jump: false,
                onGround: false,
                origin: preMoveState.origin,
                velocity: preMoveState.velocity
            };
        });

        expect(delegatedMoveType).toBe(6);
        expect(result.moveType).toBe(6);
        expect(result.angularVelocity).toEqual([100, -200, 300]);
        expect(result.entityAngles).toEqual([11, 18, 33]);
    });

    it('round-trips the source client water-jump state through delegated movement', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const player = world.playerReference;
        const initial = world.playerResult();
        vm.setEntityFloat(player, 'flags',
            Math.trunc(vm.getEntityFloat(player, 'flags')) | 2_048
        );
        vm.setEntityVector(player, 'movedir', [-50, 75, 0]);
        vm.setEntityFloat(player, 'teleport_time', world.time + 2);
        let delegatedWaterJump = false;

        const result = world.update(0.01, {
            angles: initial.angles,
            attack: false,
            jump: false,
            onGround: false,
            origin: initial.origin,
            velocity: [10, 20, 225],
            waterJump: true,
            waterJumpDirection: [-50, 75, 0],
            waterLevel: 1,
            waterType: CONTENTS.EMPTY
        }, (preMoveState) => {
            delegatedWaterJump = preMoveState.waterJump;
            return {
                angles: preMoveState.angles,
                attack: false,
                jump: false,
                onGround: false,
                origin: preMoveState.origin,
                velocity: quakeWaterJumpVelocity(
                    preMoveState.velocity, preMoveState.waterJumpDirection
                ),
                waterJump: preMoveState.waterJump,
                waterJumpDirection: preMoveState.waterJumpDirection
            };
        });

        expect(delegatedWaterJump).toBe(true);
        expect(result.waterJump).toBe(true);
        expect(result.waterJumpDirection).toEqual([-50, 75, 0]);
        expect(result.waterJumpTime).toBeCloseTo(1.99);
        expect(result.velocity).toEqual([-50, 75, 225]);

        world.update(0.01, {
            angles: result.angles,
            attack: false,
            jump: false,
            onGround: false,
            origin: result.origin,
            velocity: result.velocity,
            waterJump: false,
            waterJumpDirection: result.waterJumpDirection
        });

        expect(Math.trunc(vm.getEntityFloat(player, 'flags')) & 2_048).toBe(0);
        expect(vm.getEntityFloat(player, 'teleport_time')).toBe(0);
    });

    it('moves nonsolid toss entities through bbox actors like MOVE_NOMONSTERS', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const mover = vm.allocateEdict();
        vm.setEntityFloat(mover, 'movetype', 5);
        vm.setEntityFloat(mover, 'solid', 0);
        vm.setEntityVector(mover, 'origin', [10_000, 10_000, 10_000]);
        vm.setEntityVector(mover, 'velocity', [200, 0, 0]);
        vm.setEntityVector(mover, 'mins', [-1, -1, -1]);
        vm.setEntityVector(mover, 'maxs', [1, 1, 1]);
        const actor = vm.allocateEdict();
        vm.setEntityFloat(actor, 'movetype', 0);
        vm.setEntityFloat(actor, 'solid', 2);
        vm.setEntityVector(actor, 'origin', [10_005, 10_000, 10_000]);
        vm.setEntityVector(actor, 'mins', [-1, -1, -1]);
        vm.setEntityVector(actor, 'maxs', [1, 1, 1]);

        world.update(0.05);

        expect(vm.getEntityVector(mover, 'origin')).toEqual([10_010, 10_000, 10_000]);
        expect(vm.getEntityVector(mover, 'velocity')).toEqual([200, 0, 0]);
    });

    it('does not link SOLID_NOT movers against trigger volumes', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const remove = vm.program.functionsByName.get('SUB_Remove');
        if (!remove) {
            throw new Error('Original progs.dat has no SUB_Remove function');
        }
        const trigger = vm.allocateEdict();
        vm.setEntityFloat(trigger, 'movetype', 0);
        vm.setEntityFloat(trigger, 'solid', 1);
        vm.setEntityWord(trigger, 'touch', remove.index);
        vm.setEntityVector(trigger, 'origin', [10_000, 10_000, 10_000]);
        vm.setEntityVector(trigger, 'mins', [-16, -16, -16]);
        vm.setEntityVector(trigger, 'maxs', [16, 16, 16]);
        const mover = vm.allocateEdict();
        vm.setEntityFloat(mover, 'movetype', 5);
        vm.setEntityFloat(mover, 'solid', 0);
        vm.setEntityVector(mover, 'origin', [10_000, 10_000, 10_000]);
        vm.setEntityVector(mover, 'velocity', [1, 0, 0]);

        world.update(0.01);

        expect(vm.entity(trigger).free).toBe(false);
    });

    it('relinks a zero-displacement fly entity through overlapping triggers', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const remove = vm.program.functionsByName.get('SUB_Remove');
        if (!remove) {
            throw new Error('Original progs.dat has no SUB_Remove function');
        }
        const trigger = vm.allocateEdict();
        vm.setEntityFloat(trigger, 'movetype', 0);
        vm.setEntityFloat(trigger, 'solid', 1);
        vm.setEntityWord(trigger, 'touch', remove.index);
        vm.setEntityVector(trigger, 'origin', [10_000, 10_000, 10_000]);
        vm.setEntityVector(trigger, 'mins', [-16, -16, -16]);
        vm.setEntityVector(trigger, 'maxs', [16, 16, 16]);
        const mover = vm.allocateEdict();
        vm.setEntityFloat(mover, 'movetype', 5);
        vm.setEntityFloat(mover, 'solid', 2);
        vm.setEntityVector(mover, 'origin', [10_000, 10_000, 10_000]);
        vm.setEntityVector(mover, 'mins', [-1, -1, -1]);
        vm.setEntityVector(mover, 'maxs', [1, 1, 1]);
        vm.setGlobalFloat('force_retouch', 0);

        world.update(0.01);

        expect(vm.entity(trigger).free).toBe(true);
        expect(vm.entity(mover).free).toBe(false);
    });

    it('clears the original ED_Free field subset before an edict is reused', () => {
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        vm.allocateEdict();
        const reference = vm.allocateEdict();
        vm.setEntityString(reference, 'model', 'progs/player.mdl');
        vm.setEntityFloat(reference, 'takedamage', 2);
        vm.setEntityFloat(reference, 'modelindex', 7);
        vm.setEntityFloat(reference, 'colormap', 4);
        vm.setEntityFloat(reference, 'skin', 3);
        vm.setEntityFloat(reference, 'frame', 2);
        vm.setEntityFloat(reference, 'solid', 2);
        vm.setEntityVector(reference, 'origin', [1, 2, 3]);
        vm.setEntityVector(reference, 'angles', [4, 5, 6]);
        vm.setEntityFloat(reference, 'nextthink', 10);
        vm.setEntityFloat(reference, 'health', 42);
        const generation = vm.entity(reference).generation;

        vm.freeEdict(reference);

        expect(vm.entity(reference).free).toBe(true);
        expect(vm.getEntityWord(reference, 'model')).toBe(0);
        for (const field of ['takedamage', 'modelindex', 'colormap', 'skin', 'frame', 'solid']) {
            expect(vm.getEntityFloat(reference, field)).toBe(0);
        }
        expect(vm.getEntityVector(reference, 'origin')).toEqual([0, 0, 0]);
        expect(vm.getEntityVector(reference, 'angles')).toEqual([0, 0, 0]);
        expect(vm.getEntityFloat(reference, 'nextthink')).toBe(-1);
        expect(vm.getEntityFloat(reference, 'health')).toBe(42);
        expect(vm.allocateEdict()).toBe(reference);
        expect(vm.entity(reference).generation).toBe(generation + 1);
    });

    it('reserves the client slot and delays mature freed-edict reuse for half a second', () => {
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const client = vm.allocateEdict();
        const entity = vm.allocateEdict();
        expect(client).toBe(1);
        expect(entity).toBe(2);

        vm.setServerTime(3);
        vm.freeEdict(client);
        vm.freeEdict(entity);
        expect(vm.allocateEdict()).toBe(3);

        vm.setServerTime(3.5);
        expect(vm.allocateEdict()).toBe(4);
        vm.setServerTime(3.51);
        expect(vm.allocateEdict()).toBe(entity);
    });

    it('unlinks an inline brush collider when QuakeC removes its edict', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const buttonIndex = map.entities.findIndex(entity => entity.classname === 'func_button');
        const button = world.entityReferences[buttonIndex];
        if (button === null || button === undefined) {
            throw new Error('E1M1 button was not spawned');
        }
        const modelIndex = Number(vm.getEntityString(button, 'model').slice(1));
        const collider = world.collision.brushColliders.find(
            candidate => candidate.modelIndex === modelIndex
        );
        const remove = vm.builtins.get(15);
        if (!collider || !remove) {
            throw new Error('E1M1 button collider or remove builtin is unavailable');
        }
        expect(collider.active).toBe(true);
        vm.words[4] = button;

        remove(vm, 1);

        expect(vm.entity(button).free).toBe(true);
        expect(world.entityReferences[buttonIndex]).toBeNull();
        expect(collider.active).toBe(false);
        const replacement = vm.allocateEdict();
        expect(replacement).toBe(button);
        expect(world.entityReferences[buttonIndex]).toBeNull();
        const setModel = vm.builtins.get(3);
        if (!setModel) {
            throw new Error('setmodel builtin is unavailable');
        }
        vm.setEntityFloat(replacement, 'movetype', 7);
        vm.setEntityFloat(replacement, 'solid', 4);
        vm.words[4] = replacement;
        vm.words[7] = vm.internString(`*${modelIndex}`);
        setModel(vm, 2);
        expect(collider.active).toBe(true);

        vm.words[4] = replacement;
        vm.words[7] = vm.internString('');
        setModel(vm, 2);
        expect(collider.active).toBe(false);
    });

    it('does not retain map references to freed and recycled spawn edicts', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const lightIndex = map.entities.findIndex(entity => entity.classname === 'light');
        const doorIndex = map.entities.findIndex(entity => entity.classname === 'func_door');

        expect(lightIndex).toBeGreaterThan(0);
        expect(world.entityReferences[lightIndex]).toBeNull();
        const door = world.entityReferences[doorIndex];
        expect(door).not.toBeNull();
        if (door === null || door === undefined) {
            throw new Error('E1M1 door was not spawned');
        }
        expect(vm.entity(door).free).toBe(false);
        expect(vm.getEntityString(door, 'model')).toBe(map.entities[doorIndex].model);
    });

    it('force-retouches a stationary entity against a newly linked trigger', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const actor = vm.allocateEdict();
        vm.setEntityFloat(actor, 'solid', 3);
        vm.setEntityVector(actor, 'origin', [10_000, 10_000, 10_000]);
        vm.setEntityVector(actor, 'mins', [-8, -8, -8]);
        vm.setEntityVector(actor, 'maxs', [8, 8, 8]);
        const trigger = vm.allocateEdict();
        const remove = vm.program.functionsByName.get('SUB_Remove');
        if (!remove) {
            throw new Error('Original progs.dat has no SUB_Remove function');
        }
        vm.setEntityFloat(trigger, 'solid', 1);
        vm.setEntityVector(trigger, 'origin', [10_000, 10_000, 10_000]);
        vm.setEntityVector(trigger, 'mins', [-16, -16, -16]);
        vm.setEntityVector(trigger, 'maxs', [16, 16, 16]);
        vm.setEntityWord(trigger, 'touch', remove.index);
        vm.setGlobalFloat('force_retouch', 1);

        world.update(0.05);

        expect(vm.entity(trigger).free).toBe(true);
        expect(vm.getGlobalFloat('force_retouch')).toBe(0);
    });

    it('gates the single-player checkclient builtin through the player-eye PVS', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const checkClient = vm.builtins.get(17);
        if (!checkClient) {
            throw new Error('checkclient builtin is not registered');
        }
        const playerOrigin = vm.getEntityVector(world.playerReference, 'origin');
        const playerViewOffset = vm.getEntityVector(world.playerReference, 'view_ofs');
        const playerView = playerOrigin.map(
            (component, axis) => component + playerViewOffset[axis]
        ) as [number, number, number];
        const playerLeaf = map.findLeaf(playerView);
        const visibility = map.visibleLeafs(playerLeaf);
        const occludedMonster = world.entityReferences.find((reference, index) => {
            if (reference === null || vm.entity(reference).free ||
                map.entities[index].classname !== 'monster_army') {
                return false;
            }
            const origin = vm.getEntityVector(reference, 'origin');
            const viewOffset = vm.getEntityVector(reference, 'view_ofs');
            const leaf = map.findLeaf(origin.map(
                (component, axis) => component + viewOffset[axis]
            ) as [number, number, number]);
            const bitIndex = leaf - 1;
            return bitIndex >= 0 &&
                (visibility[bitIndex >> 3] & (1 << (bitIndex & 7))) === 0;
        });
        if (occludedMonster === null || occludedMonster === undefined) {
            throw new Error('E1M1 has no PVS-occluded soldier from the player spawn');
        }

        vm.setGlobalWord('self', world.playerReference);
        checkClient(vm, 0);
        expect(vm.words[1]).toBe(world.playerReference);

        vm.setGlobalWord('self', occludedMonster);
        checkClient(vm, 0);
        expect(vm.words[1]).toBe(0);

        const observer = vm.allocateEdict();
        const observerOrigin = vm.getEntityVector(occludedMonster, 'origin');
        const observerViewOffset = vm.getEntityVector(occludedMonster, 'view_ofs');
        vm.setEntityVector(observer, 'origin', observerOrigin);
        vm.setEntityVector(observer, 'view_ofs', observerViewOffset);
        const observerView = observerOrigin.map(
            (component, axis) => component + observerViewOffset[axis]
        ) as [number, number, number];
        vm.setEntityVector(world.playerReference, 'origin', observerView.map(
            (component, axis) => component - playerViewOffset[axis]
        ) as [number, number, number]);
        vm.setGlobalWord('self', observer);
        checkClient(vm, 0);
        expect(vm.words[1]).toBe(0);

        world.update(0.1);
        vm.setGlobalWord('self', observer);
        checkClient(vm, 0);
        expect(vm.words[1]).toBe(world.playerReference);
    });

    it('tracks fly-monster height and sweeps moving boxes against entities', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const playerOrigin = vm.getEntityVector(world.playerReference, 'origin');
        const flyer = vm.allocateEdict();
        const flyerOrigin: [number, number, number] = [
            playerOrigin[0], playerOrigin[1], playerOrigin[2] + 48
        ];
        vm.setEntityFloat(flyer, 'flags', 1);
        vm.setEntityFloat(flyer, 'solid', 3);
        vm.setEntityWord(flyer, 'enemy', world.playerReference);
        vm.setEntityVector(flyer, 'origin', flyerOrigin);
        vm.setEntityVector(flyer, 'mins', [-1, -1, -1]);
        vm.setEntityVector(flyer, 'maxs', [1, 1, 1]);

        const trigger = vm.allocateEdict();
        const remove = vm.program.functionsByName.get('SUB_Remove');
        if (!remove) {
            throw new Error('Original progs.dat has no SUB_Remove function');
        }
        vm.setEntityFloat(trigger, 'solid', 1);
        vm.setEntityVector(trigger, 'origin', [
            flyerOrigin[0], flyerOrigin[1], flyerOrigin[2] - 8
        ]);
        vm.setEntityVector(trigger, 'mins', [-4, -4, -4]);
        vm.setEntityVector(trigger, 'maxs', [4, 4, 4]);
        vm.setEntityWord(trigger, 'touch', remove.index);

        expect(world.moveStep(flyer, [0, 0, 0])).toBe(true);
        expect(vm.getEntityVector(flyer, 'origin')[2]).toBe(flyerOrigin[2] - 8);
        expect(vm.entity(trigger).free).toBe(true);

        const blocker = vm.allocateEdict();
        const trackedOrigin = vm.getEntityVector(flyer, 'origin');
        vm.setEntityFloat(blocker, 'solid', 2);
        vm.setEntityVector(blocker, 'origin', [
            trackedOrigin[0] + 5, trackedOrigin[1], trackedOrigin[2]
        ]);
        vm.setEntityVector(blocker, 'mins', [-1, -1, -1]);
        vm.setEntityVector(blocker, 'maxs', [1, 1, 1]);
        vm.setEntityWord(flyer, 'enemy', 0);

        expect(world.moveStep(flyer, [10, 0, 0])).toBe(false);
        expect(vm.getEntityVector(flyer, 'origin')).toEqual(trackedOrigin);
        vm.setEntityFloat(blocker, 'solid', 0);
        expect(world.moveStep(flyer, [10, 0, 0])).toBe(true);
    });

    it('stops toss velocity and angular velocity on a floor landing', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const playerOrigin = vm.getEntityVector(world.playerReference, 'origin');
        const toss = vm.allocateEdict();
        vm.setEntityFloat(toss, 'movetype', 6);
        vm.setEntityFloat(toss, 'solid', 2);
        vm.setEntityWord(toss, 'owner', world.playerReference);
        vm.setEntityVector(toss, 'mins', [-1, -1, -1]);
        vm.setEntityVector(toss, 'maxs', [1, 1, 1]);
        vm.setEntityVector(toss, 'origin', [
            playerOrigin[0], playerOrigin[1], playerOrigin[2] - 18
        ]);
        vm.setEntityVector(toss, 'velocity', [0, 0, -10]);
        vm.setEntityVector(toss, 'avelocity', [100, 200, 300]);

        world.update(0.1);

        expect(Math.trunc(vm.getEntityFloat(toss, 'flags')) & 512).toBe(512);
        expect(vm.getEntityVector(toss, 'velocity')).toEqual([0, 0, 0]);
        expect(vm.getEntityVector(toss, 'avelocity')).toEqual([0, 0, 0]);
    });

    it('keeps flying step actors aloft and sounds a hard step landing', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const playerOrigin = vm.getEntityVector(world.playerReference, 'origin');
        const flyer = vm.allocateEdict();
        const flyerOrigin: [number, number, number] = [
            playerOrigin[0], playerOrigin[1], playerOrigin[2] + 48
        ];
        vm.setEntityFloat(flyer, 'movetype', 4);
        vm.setEntityFloat(flyer, 'flags', 1);
        vm.setEntityVector(flyer, 'origin', flyerOrigin);
        vm.setEntityVector(flyer, 'velocity', [0, 0, -100]);

        world.update(0.05);

        expect(vm.getEntityVector(flyer, 'origin')).toEqual(flyerOrigin);
        expect(vm.getEntityVector(flyer, 'velocity')).toEqual([0, 0, -100]);

        const faller = vm.allocateEdict();
        vm.setEntityFloat(faller, 'movetype', 4);
        vm.setEntityFloat(faller, 'solid', 2);
        vm.setEntityWord(faller, 'owner', world.playerReference);
        vm.setEntityVector(faller, 'mins', [-1, -1, -1]);
        vm.setEntityVector(faller, 'maxs', [1, 1, 1]);
        vm.setEntityVector(faller, 'origin', [
            playerOrigin[0], playerOrigin[1], playerOrigin[2] - 18
        ]);
        const fallerOrigin = vm.getEntityVector(faller, 'origin');
        vm.setEntityVector(faller, 'velocity', [20, 0, -100]);

        world.update(0.1);

        expect(Math.trunc(vm.getEntityFloat(faller, 'flags')) & 512).toBe(512);
        expect(vm.getEntityVector(faller, 'origin')[0]).toBeCloseTo(fallerOrigin[0] + 2, 1);
        expect(vm.getEntityVector(faller, 'velocity')).toEqual([20, 0, 0]);
        expect(world.soundEvents.some(
            event => event.entity === faller && event.sample === 'demon/dland2.wav'
        )).toBe(true);
    });

    it('tracks step-actor liquid transitions and plays the source splash sound', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        let liquidPoint: [number, number, number] | undefined;
        for (const leaf of map.leafs) {
            if (leaf.contents > CONTENTS.WATER || leaf.contents < CONTENTS.LAVA) {
                continue;
            }
            for (const x of [0.2, 0.4, 0.5, 0.6, 0.8]) {
                for (const y of [0.2, 0.4, 0.5, 0.6, 0.8]) {
                    for (const z of [0.2, 0.4, 0.5, 0.6, 0.8]) {
                        const point = leaf.mins.map(
                            (component, axis) => component +
                                (leaf.maxs[axis] - component) * [x, y, z][axis]
                        ) as [number, number, number];
                        if (world.collision.pointContents(point) === leaf.contents) {
                            liquidPoint = point;
                            break;
                        }
                    }
                    if (liquidPoint) break;
                }
                if (liquidPoint) break;
            }
            if (liquidPoint) break;
        }
        if (!liquidPoint) {
            throw new Error('E1M1 has no sampleable liquid leaf');
        }

        const swimmer = vm.allocateEdict();
        vm.setEntityFloat(swimmer, 'movetype', 4);
        vm.setEntityFloat(swimmer, 'flags', 2);
        vm.setEntityVector(swimmer, 'origin', liquidPoint);
        world.update(0.01);
        expect(vm.getEntityFloat(swimmer, 'watertype')).toBeLessThanOrEqual(CONTENTS.WATER);
        expect(vm.getEntityFloat(swimmer, 'waterlevel')).toBe(1);
        expect(world.soundEvents.some(event => event.entity === swimmer)).toBe(false);

        vm.setEntityVector(swimmer, 'origin', world.playerResult().origin);
        world.update(0.01);
        expect(vm.getEntityFloat(swimmer, 'watertype')).toBe(CONTENTS.EMPTY);
        expect(vm.getEntityFloat(swimmer, 'waterlevel')).toBe(CONTENTS.EMPTY);
        expect(world.soundEvents.filter(
            event => event.entity === swimmer && event.sample === 'misc/h2ohit1.wav'
        )).toHaveLength(1);

        vm.setEntityVector(swimmer, 'origin', liquidPoint);
        world.update(0.01);
        expect(world.soundEvents.filter(
            event => event.entity === swimmer && event.sample === 'misc/h2ohit1.wav'
        )).toHaveLength(2);
    });

    it('clips player movement against dynamic boxes and dispatches their touch', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const start = vm.getEntityVector(world.playerReference, 'origin');
        const directions: Array<[number, number, number]> = [
            [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
            [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0]
        ];
        const direction = directions.find((candidate) => {
            const end = start.map(
                (component, axis) => component + candidate[axis] * 96
            ) as [number, number, number];
            return world.tracePlayerMovement(start, end).trace.fraction === 1;
        });
        if (!direction) {
            throw new Error('E1M1 spawn has no clear horizontal player trace');
        }

        const blocker = vm.allocateEdict();
        vm.setEntityFloat(blocker, 'solid', 3);
        vm.setEntityVector(blocker, 'mins', [-8, -8, -8]);
        vm.setEntityVector(blocker, 'maxs', [8, 8, 8]);
        vm.setEntityVector(blocker, 'origin', start.map(
            (component, axis) => component + direction[axis] * 64
        ) as [number, number, number]);
        const end = start.map(
            (component, axis) => component + direction[axis] * 96
        ) as [number, number, number];
        vm.setEntityWord(blocker, 'owner', world.playerReference);
        expect(world.tracePlayerMovement(start, end).trace.fraction).toBe(1);
        vm.setEntityWord(blocker, 'owner', 0);
        vm.setEntityVector(blocker, 'mins', [0, 0, 0]);
        vm.setEntityVector(blocker, 'maxs', [0, 0, 0]);
        expect(world.tracePlayerMovement(start, end).trace.fraction).toBe(1);
        expect(world.traceLine(
            start, end, false, world.playerReference
        ).entity).not.toBe(blocker);
        vm.setEntityVector(blocker, 'mins', [-8, -8, -8]);
        vm.setEntityVector(blocker, 'maxs', [8, 8, 8]);
        const movement = world.tracePlayerMovement(start, end);
        expect(world.traceLine(
            start, end, false, world.playerReference
        ).entity).toBe(blocker);

        expect(movement.entity).toBe(blocker);
        expect(movement.solid).toBe(3);
        expect(movement.trace.fraction).toBeGreaterThan(0);
        expect(movement.trace.fraction).toBeLessThan(1);
        expect(movement.trace.startSolid).toBe(false);
        expect(movement.trace.plane.normal.reduce(
            (sum, component, axis) => sum + component * direction[axis], 0
        )).toBeLessThan(0);

        const remove = vm.program.functionsByName.get('SUB_Remove');
        if (!remove) {
            throw new Error('Original progs.dat has no SUB_Remove function');
        }
        vm.setEntityWord(blocker, 'touch', remove.index);
        const player = world.playerResult();
        world.update(0.01, {
            angles: player.angles,
            attack: false,
            jump: false,
            onGround: true,
            origin: movement.trace.endPosition,
            touchEntityReferences: [blocker],
            velocity: [0, 0, 0]
        });
        expect(vm.entity(blocker).free).toBe(true);
    });

    it('matches the source local cheat toggles and deathmatch restriction', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));

        expect(world.toggleGodMode()).toBe(true);
        expect(Math.trunc(vm.getEntityFloat(world.playerReference, 'flags')) & 64).toBe(64);
        expect(world.toggleNoTarget()).toBe(true);
        expect(Math.trunc(vm.getEntityFloat(world.playerReference, 'flags')) & 128).toBe(128);
        expect(world.toggleNoclip()).toBe(true);
        expect(world.playerResult().moveType).toBe(8);
        expect(world.toggleNoclip()).toBe(false);
        expect(world.playerResult().moveType).toBe(3);
        expect(world.toggleFly()).toBe(true);
        expect(world.playerResult().moveType).toBe(5);
        expect(world.toggleFly()).toBe(false);
        expect(world.playerResult().moveType).toBe(3);
        expect(world.consoleLines.slice(-6)).toEqual([
            'godmode ON',
            'notarget ON',
            'noclip ON',
            'noclip OFF',
            'flymode ON',
            'flymode OFF'
        ]);

        const deathmatchVm = new QuakeVirtualMachine(
            new QuakeProgram(pak.get('progs.dat'))
        );
        const deathmatchWorld = new QuakeWorldRuntime(
            deathmatchVm,
            map,
            new WorldCollision(map),
            'e1m1',
            undefined,
            pak,
            { deathmatch: '1' }
        );
        const initialFlags = deathmatchVm.getEntityFloat(
            deathmatchWorld.playerReference, 'flags'
        );
        const initialConsoleLines = [...deathmatchWorld.consoleLines];
        expect(deathmatchWorld.toggleGodMode()).toBeUndefined();
        expect(deathmatchWorld.toggleNoTarget()).toBeUndefined();
        expect(deathmatchWorld.toggleNoclip()).toBeUndefined();
        expect(deathmatchWorld.toggleFly()).toBeUndefined();
        expect(deathmatchVm.getEntityFloat(
            deathmatchWorld.playerReference, 'flags'
        )).toBe(initialFlags);
        expect(deathmatchWorld.playerResult().moveType).toBe(3);
        expect(deathmatchWorld.consoleLines).toEqual(initialConsoleLines);
    });

    it('matches the base-Quake give command inventory and deathmatch boundary', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m1', undefined, pak
        );
        const player = world.playerReference;
        const originalItems = Math.trunc(vm.getEntityFloat(player, 'items'));

        expect(world.givePlayer('8', 0)).toBe(true);
        expect(Math.trunc(vm.getEntityFloat(player, 'items'))).toBe(
            originalItems | (1 << 6)
        );
        expect(world.givePlayer('n', 123.9)).toBe(true);
        expect(world.givePlayer('r', -4.9)).toBe(true);
        expect(world.givePlayer('c', 55)).toBe(true);
        expect(world.givePlayer('h', 175)).toBe(true);
        expect(vm.getEntityFloat(player, 'ammo_nails')).toBe(123);
        expect(vm.getEntityFloat(player, 'ammo_rockets')).toBe(-4);
        expect(vm.getEntityFloat(player, 'ammo_cells')).toBe(55);
        expect(vm.getEntityFloat(player, 'health')).toBe(175);

        const deathmatchVm = new QuakeVirtualMachine(
            new QuakeProgram(pak.get('progs.dat'))
        );
        const deathmatchWorld = new QuakeWorldRuntime(
            deathmatchVm,
            map,
            new WorldCollision(map),
            'e1m1',
            undefined,
            pak,
            { deathmatch: '1' }
        );
        const deathmatchPlayer = deathmatchWorld.playerReference;
        const deathmatchItems = deathmatchVm.getEntityFloat(deathmatchPlayer, 'items');
        const deathmatchHealth = deathmatchVm.getEntityFloat(deathmatchPlayer, 'health');
        expect(deathmatchWorld.givePlayer('8', 0)).toBeUndefined();
        expect(deathmatchWorld.givePlayer('h', 999)).toBeUndefined();
        expect(deathmatchVm.getEntityFloat(deathmatchPlayer, 'items')).toBe(
            deathmatchItems
        );
        expect(deathmatchVm.getEntityFloat(deathmatchPlayer, 'health')).toBe(
            deathmatchHealth
        );
    });

    it('spawns a real QuakeC player and touches an E1M1 armor pickup', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));

        expect(world.playerReference).toBe(1);
        expect(vm.getEntityString(world.playerReference, 'classname')).toBe('player');
        expect(vm.getEntityFloat(world.playerReference, 'health')).toBe(100);
        expect(vm.getEntityString(world.playerReference, 'model')).toBe('progs/player.mdl');
        expect(world.playerResult().viewHeight).toBe(22);
        expect(world.playerResult().moveType).toBe(3);
        expect(world.lightStyles.get(0)).toBe('m');
        expect(vm.getEntityFloat(0, 'sounds')).toBe(6);
        expect(world.ambientSounds.length).toBeGreaterThan(0);
        expect(world.ambientSounds.some(sound => sound.attenuation === 3)).toBe(true);
        const staticSoundGroups = quakeStaticSoundGroups(world.ambientSounds);
        expect(world.ambientSounds).toHaveLength(14);
        expect(staticSoundGroups.map(group => ({
            count: group.events.length,
            path: group.path
        }))).toEqual([
            { count: 2, path: 'sound/ambience/buzz1.wav' },
            { count: 6, path: 'sound/ambience/fl_hum1.wav' },
            { count: 1, path: 'sound/ambience/hum1.wav' },
            { count: 4, path: 'sound/ambience/comp1.wav' },
            { count: 1, path: 'sound/ambience/drone6.wav' }
        ]);
        expect(staticSoundGroups.every(group => (
            parseQuakeWavInfo(pak.get(group.path)).loopStart !== undefined
        ))).toBe(true);
        const staticReference = vm.allocateEdict();
        vm.setEntityString(staticReference, 'classname', 'light_torch_small_walltorch');
        vm.setEntityString(staticReference, 'model', 'progs/flame.mdl');
        vm.setEntityFloat(staticReference, 'colormap', 258);
        vm.setEntityFloat(staticReference, 'frame', 258);
        vm.setEntityFloat(staticReference, 'skin', 257);
        vm.setEntityVector(staticReference, 'angles', [10, -90, 370]);
        vm.setEntityVector(staticReference, 'origin', [16.19, 32.24, 48.37]);
        world.makeStatic(staticReference);
        expect(vm.entity(staticReference).free).toBe(true);
        expect(world.staticEntities.at(-1)).toMatchObject({
            angles: [9.84375, -90, 9.84375],
            classname: 'light_torch_small_walltorch',
            colormap: 2,
            frame: 2,
            model: 'progs/flame.mdl',
            origin: [16.125, 32.125, 48.25],
            skin: 1
        });
        expect(world.checkBottom(world.playerReference)).toBe(true);
        const groundedOrigin = vm.getEntityVector(world.playerReference, 'origin');
        vm.setEntityVector(world.playerReference, 'origin', [
            groundedOrigin[0], groundedOrigin[1], groundedOrigin[2] + 64
        ]);
        expect(world.checkBottom(world.playerReference)).toBe(false);
        vm.setEntityVector(world.playerReference, 'origin', groundedOrigin);
        vm.setEntityVector(world.playerReference, 'view_ofs', [0, 0, -8.9]);
        vm.setEntityVector(world.playerReference, 'punchangle', [-2.9, 260, -260]);
        expect(world.playerResult()).toMatchObject({
            moveType: 3,
            punchAngle: [-2, 4, -4],
            viewHeight: -8
        });
        vm.setEntityVector(world.playerReference, 'view_ofs', [0, 0, 22]);

        for (let tick = 0; tick < 5; tick++) {
            world.update(0.05);
        }
        const armor = world.entityReferences.find((reference, index) => map.entities[index].classname === 'item_armor1' &&
            reference !== null &&
            !vm.entity(reference).free &&
            vm.getEntityString(reference, 'model') === 'progs/armor.mdl'
        );
        if (armor === null || armor === undefined) {
            throw new Error('E1M1 green armor was not spawned');
        }
        const armorOrigin = vm.getEntityVector(armor, 'origin');
        world.update(0.01, {
            angles: [0, 0, 0],
            attack: false,
            jump: false,
            onGround: true,
            origin: armorOrigin,
            velocity: [0, 0, 0]
        });

        expect(vm.getEntityFloat(world.playerReference, 'armorvalue')).toBe(100);
        expect(vm.getEntityFloat(world.playerReference, 'armortype')).toBeCloseTo(0.3);
        expect(vm.getEntityFloat(armor, 'solid')).toBe(0);
        expect(vm.getEntityString(armor, 'model')).toBe('');
        expect(world.soundEvents.some(event => event.sample.includes('armor'))).toBe(true);
        expect(world.visibleNotifyLines()).toContain('You got armor');
        expect(world.visibleConsoleLines()).toContain('You got armor');
        expect(world.bonusShift).toBe(49);
        expect(world.viewBlend().amount).toBeGreaterThan(0);
        expect(world.itemGetTimes[13]).toBe(world.time);

        const playerOrigin = vm.getEntityVector(world.playerReference, 'origin');
        vm.setEntityWord(world.playerReference, 'dmg_inflictor', armor);
        vm.setEntityVector(armor, 'origin', [
            playerOrigin[0], playerOrigin[1] - 100, playerOrigin[2]
        ]);
        world.viewKickPitch = 0;
        world.viewKickRoll = 1.2;
        world.viewKickTime = 1;
        vm.setEntityFloat(world.playerReference, 'health', 90);
        vm.setEntityFloat(world.playerReference, 'dmg_take', 10);
        const damageResult = world.update(0.01);
        expect(world.damageShift).toBe(28);
        expect(damageResult.damageRoll).toBeGreaterThan(10);
        expect(damageResult.damagePitch).toBeCloseTo(0);
        world.damageKickTime = -1;
        expect(world.playerResult(false).damageRoll).toBe(0);
    });

    it('uses the shipped QuakeC for both authored E1M1 armor tiers', () => {
        const cases = [
            {
                armor: 100,
                armorType: 0.3,
                bit: 13,
                classname: 'item_armor1',
                skin: 0
            },
            {
                armor: 150,
                armorType: 0.6,
                bit: 14,
                classname: 'item_armor2',
                skin: 1
            }
        ] as const;

        for (const pickup of cases) {
            const state = createE1m1PickupWorld();
            const armor = activeE1m1Entity(state, pickup.classname);
            expect(state.vm.getEntityString(armor, 'model')).toBe('progs/armor.mdl');
            expect(state.vm.getEntityFloat(armor, 'skin')).toBe(pickup.skin);
            state.world.clearSoundEvents();

            touchE1m1Entity(state, armor);

            expect(state.world.clientData()).toMatchObject({ armor: pickup.armor });
            expect(state.vm.getEntityFloat(
                state.world.playerReference, 'armortype'
            )).toBeCloseTo(pickup.armorType);
            expect(Math.trunc(state.vm.getEntityFloat(
                state.world.playerReference, 'items'
            )) & (1 << pickup.bit)).not.toBe(0);
            expect(state.world.itemGetTimes[pickup.bit]).toBe(state.world.time);
            expect(state.vm.getEntityFloat(armor, 'solid')).toBe(0);
            expect(state.vm.getEntityString(armor, 'model')).toBe('');
            expect(state.world.visibleNotifyLines()).toContain('You got armor');
            expect(state.world.soundEvents.some(event => (
                event.entity === state.world.playerReference &&
                event.sample === 'items/armor1.wav'
            ))).toBe(true);
            expect(state.world.bonusShift).toBe(49);
        }

        const state = createE1m1PickupWorld();
        const yellowArmor = activeE1m1Entity(state, 'item_armor2');
        const greenArmor = activeE1m1Entity(state, 'item_armor1');
        touchE1m1Entity(state, yellowArmor);
        state.world.bonusShift = 0;
        state.world.clearSoundEvents();

        touchE1m1Entity(state, greenArmor);

        expect(state.world.clientData()).toMatchObject({ armor: 150 });
        expect(state.vm.getEntityFloat(
            state.world.playerReference, 'armortype'
        )).toBeCloseTo(0.6);
        expect(Math.trunc(state.vm.getEntityFloat(
            state.world.playerReference, 'items'
        )) & (1 << 14)).not.toBe(0);
        expect(state.vm.getEntityFloat(greenArmor, 'solid')).toBe(1);
        expect(state.vm.getEntityString(greenArmor, 'model')).toBe('progs/armor.mdl');
        expect(state.world.soundEvents.some(event => (
            event.sample === 'items/armor1.wav'
        ))).toBe(false);
        expect(state.world.bonusShift).toBe(0);
    });

    it('uses E1M2\'s authored silver key to open its paired key door', () => {
        const map = new BspMap(pak.get('maps/e1m2.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m2', undefined, pak
        );
        world.toggleNoTarget();
        for (let tick = 0; tick < 5; tick++) world.update(0.05);
        const keyIndex = map.entities.findIndex(entity => (
            entity.classname === 'item_key1' && entity.origin === '880 -300 464'
        ));
        const doorIndices = ['*39', '*40'].map(model => map.entities.findIndex(entity => (
            entity.classname === 'func_door' && entity.model === model
        )));
        const key = world.entityReferences[keyIndex];
        const doors = doorIndices.map(index => world.entityReferences[index]);
        if (key === null || key === undefined || doors.some(
            reference => reference === null || reference === undefined
        )) {
            throw new Error('E1M2 silver-key progression chain was not spawned');
        }
        const doorReferences = doors as [number, number];
        const player = world.playerReference;
        const initial = world.playerResult(false);
        const playerState = {
            angles: initial.angles,
            attack: false,
            jump: false,
            onGround: true,
            origin: initial.origin,
            velocity: [0, 0, 0] as [number, number, number]
        };
        const initialDoorOrigins = doorReferences.map(
            reference => vm.getEntityVector(reference, 'origin')
        );
        world.soundEvents.length = 0;

        world.update(0.01, { ...playerState, touchModelIndices: [39] });

        expect(vm.getEntityString(key, 'model')).toBe('progs/w_s_key.mdl');
        expect(world.visibleCenterMessage()).toBe('You need the silver key');
        expect(world.soundEvents.some(event => (
            event.entity === doorReferences[0] && event.sample === 'doors/medtry.wav'
        ))).toBe(true);
        expect(doorReferences.every(
            reference => vm.getEntityFloat(reference, 'state') === 1
        )).toBe(true);
        expect(Math.trunc(vm.getEntityFloat(player, 'items')) & 131_072).toBe(0);

        const keyOrigin = vm.getEntityVector(key, 'origin');
        world.soundEvents.length = 0;
        world.update(0.01, { ...playerState, origin: keyOrigin });

        expect(vm.getEntityString(key, 'model')).toBe('');
        expect(vm.getEntityFloat(key, 'solid')).toBe(0);
        expect(Math.trunc(vm.getEntityFloat(player, 'items')) & 131_072).toBe(131_072);
        expect(world.visibleNotifyLines()).toContain('You got the silver key');
        expect(world.soundEvents.some(event => event.sample === 'misc/medkey.wav')).toBe(true);

        for (let tick = 0; tick < 41; tick++) world.update(0.05, playerState);
        world.soundEvents.length = 0;
        world.update(0.01, { ...playerState, touchModelIndices: [39] });

        expect(Math.trunc(vm.getEntityFloat(player, 'items')) & 131_072).toBe(0);
        expect(doorReferences.every(
            reference => vm.getEntityFloat(reference, 'state') === 2
        )).toBe(true);
        expect(doorReferences.every(reference => (
            vm.program.functions[vm.getEntityWord(reference, 'touch')]?.name === 'SUB_Null'
        ))).toBe(true);
        expect(world.soundEvents.some(event => (
            event.entity === doorReferences[0] && event.sample === 'doors/stndr1.wav'
        ))).toBe(true);

        for (let tick = 0; tick < 100 && doorReferences.some(
            reference => vm.getEntityFloat(reference, 'state') !== 0
        ); tick++) {
            world.update(0.05, playerState);
        }
        expect(doorReferences.every(
            reference => vm.getEntityFloat(reference, 'state') === 0
        )).toBe(true);
        for (const [index, reference] of doorReferences.entries()) {
            expect(vm.getEntityVector(reference, 'origin')).not.toEqual(
                initialDoorOrigins[index]
            );
            const modelIndex = Number(vm.getEntityString(reference, 'model').slice(1));
            expect(world.collision.brushColliders.find(
                collider => collider.modelIndex === modelIndex
            )?.origin).toEqual(vm.getEntityVector(reference, 'origin'));
        }
    });

    it('uses the shipped QuakeC for every E1M1 health-box variant', () => {
        const cases = [
            {
                expectedHealth: 100,
                expectedThinkDelay: 0,
                healAmount: 25,
                itemBit: undefined,
                model: 'maps/b_bh25.bsp',
                sample: 'items/health1.wav',
                spawnflags: '0',
                startingHealth: 75
            },
            {
                expectedHealth: 90,
                expectedThinkDelay: 0,
                healAmount: 15,
                itemBit: undefined,
                model: 'maps/b_bh10.bsp',
                sample: 'items/r_item1.wav',
                spawnflags: '1',
                startingHealth: 75
            },
            {
                expectedHealth: 200,
                expectedThinkDelay: 5,
                healAmount: 100,
                itemBit: 16,
                model: 'maps/b_bh100.bsp',
                sample: 'items/r_item2.wav',
                spawnflags: '2',
                startingHealth: 100
            }
        ] as const;

        for (const pickup of cases) {
            const state = createE1m1PickupWorld();
            const health = activeE1m1Entity(
                state,
                'item_health',
                entity => (entity.spawnflags ?? '0') === pickup.spawnflags
            );
            expect(state.vm.getEntityString(health, 'model')).toBe(pickup.model);
            state.vm.setEntityFloat(
                state.world.playerReference,
                'health',
                pickup.startingHealth
            );
            state.world.previousHealth = pickup.startingHealth;
            state.world.soundEvents.length = 0;

            touchE1m1Entity(state, health);

            expect(state.world.clientData().health).toBe(pickup.expectedHealth);
            expect(state.world.soundEvents.some(
                event => event.sample === pickup.sample
            )).toBe(true);
            expect(state.world.visibleNotifyLines()).toContain(
                `You receive ${pickup.healAmount} health`
            );
            expect(state.vm.getEntityFloat(health, 'solid')).toBe(0);
            expect(state.vm.getEntityString(health, 'model')).toBe('');
            expect(state.world.bonusShift).toBe(49);
            const nextThink = state.vm.getEntityFloat(health, 'nextthink');
            if (pickup.expectedThinkDelay === 0) {
                expect(nextThink).toBe(0);
            } else {
                expect(nextThink - (state.world.time - 0.01)).toBeCloseTo(
                    pickup.expectedThinkDelay
                );
            }
            if (pickup.itemBit !== undefined) {
                expect(Math.trunc(state.vm.getEntityFloat(
                    state.world.playerReference, 'items'
                )) & (1 << pickup.itemBit)).not.toBe(0);
                expect(state.world.itemGetTimes[pickup.itemBit]).toBe(state.world.time);
                expect(state.vm.getEntityWord(health, 'owner')).toBe(
                    state.world.playerReference
                );
            }
        }

        const fullHealthState = createE1m1PickupWorld();
        const untouchedHealth = activeE1m1Entity(
            fullHealthState,
            'item_health',
            entity => (entity.spawnflags ?? '0') === '0'
        );
        fullHealthState.world.soundEvents.length = 0;
        touchE1m1Entity(fullHealthState, untouchedHealth);
        expect(fullHealthState.world.clientData().health).toBe(100);
        expect(fullHealthState.vm.getEntityFloat(untouchedHealth, 'solid')).toBe(1);
        expect(fullHealthState.vm.getEntityString(untouchedHealth, 'model')).toBe(
            'maps/b_bh25.bsp'
        );
        expect(fullHealthState.world.soundEvents.some(
            event => event.sample === 'items/health1.wav'
        )).toBe(false);
        expect(fullHealthState.world.bonusShift).toBe(0);
    });

    it('silently rots E1M1 megahealth without a client damage effect', () => {
        const state = createE1m1PickupWorld();
        const megahealth = activeE1m1Entity(
            state,
            'item_health',
            entity => entity.spawnflags === '2'
        );
        touchE1m1Entity(state, megahealth);
        expect(state.world.clientData().health).toBe(200);

        state.world.damageShift = 0;
        state.world.damageKickTime = 0;
        const expectNoDamageEffect = (): void => {
            expect(state.vm.getEntityFloat(
                state.world.playerReference, 'dmg_take'
            )).toBe(0);
            expect(state.vm.getEntityFloat(
                state.world.playerReference, 'dmg_save'
            )).toBe(0);
            expect(state.world.damageShift).toBe(0);
            expect(state.world.playerResult(false)).toMatchObject({
                damagePitch: 0,
                damageRoll: 0
            });
            expect(state.world.faceAnimationUntil).toBeLessThan(state.world.time);
        };

        for (let expectedHealth = 199; expectedHealth >= 100; expectedHealth--) {
            for (let tick = 0; tick < 60 &&
                state.world.clientData().health > expectedHealth; tick++) {
                state.world.update(0.1);
                expectNoDamageEffect();
            }
            expect(state.world.clientData().health).toBe(expectedHealth);
            expectNoDamageEffect();
        }

        const superHealthBit = 1 << 16;
        for (let tick = 0; tick < 20 && (Math.trunc(state.vm.getEntityFloat(
            state.world.playerReference, 'items'
        )) & superHealthBit) !== 0; tick++) {
            state.world.update(0.1);
            expectNoDamageEffect();
        }
        expect(Math.trunc(state.vm.getEntityFloat(
            state.world.playerReference, 'items'
        )) & superHealthBit).toBe(0);
        expect(state.world.clientData().health).toBe(100);
        expect(state.vm.entity(megahealth).free).toBe(false);
        expect(state.vm.getEntityString(megahealth, 'model')).toBe('');
        expect(state.vm.getEntityFloat(megahealth, 'solid')).toBe(0);
        expect(state.vm.getEntityFloat(megahealth, 'nextthink')).toBe(0);
        expect(state.vm.program.functions[state.vm.getEntityWord(
            megahealth, 'think'
        )].name).toBe('item_megahealth_rot');
    }, 10_000);

    it('uses the shipped QuakeC for E1M1 shell, nail, and rocket boxes', () => {
        const cases = [
            {
                ammoField: 'ammo_shells',
                classname: 'item_shells',
                deathmatch: false,
                expectedAmmo: 20,
                expectedThinkDelay: 0,
                model: 'maps/b_shell0.bsp',
                spawnflags: '0'
            },
            {
                ammoField: 'ammo_nails',
                classname: 'item_spikes',
                deathmatch: false,
                expectedAmmo: 25,
                expectedThinkDelay: 0,
                model: 'maps/b_nail0.bsp',
                spawnflags: '0'
            },
            {
                ammoField: 'ammo_rockets',
                classname: 'item_rockets',
                deathmatch: true,
                expectedAmmo: 5,
                expectedThinkDelay: 30,
                model: 'maps/b_rock0.bsp',
                spawnflags: '1792'
            }
        ] as const;

        for (const pickup of cases) {
            const state = createE1m1PickupWorld(
                pickup.deathmatch ? { deathmatch: '1' } : undefined
            );
            const ammo = activeE1m1Entity(
                state,
                pickup.classname,
                entity => (entity.spawnflags ?? '0') === pickup.spawnflags
            );
            expect(state.vm.getEntityString(ammo, 'model')).toBe(pickup.model);
            state.vm.setEntityFloat(
                state.world.playerReference,
                pickup.ammoField,
                0
            );
            state.world.soundEvents.length = 0;

            touchE1m1Entity(state, ammo);

            expect(state.vm.getEntityFloat(
                state.world.playerReference,
                pickup.ammoField
            )).toBe(pickup.expectedAmmo);
            expect(state.world.soundEvents.some(
                event => event.sample === 'weapons/lock4.wav'
            )).toBe(true);
            expect(state.world.visibleNotifyLines()).toContain(
                `You got the ${state.vm.getEntityString(ammo, 'netname')}`
            );
            expect(state.vm.getEntityFloat(ammo, 'solid')).toBe(0);
            expect(state.vm.getEntityString(ammo, 'model')).toBe('');
            expect(state.world.bonusShift).toBe(49);
            const nextThink = state.vm.getEntityFloat(ammo, 'nextthink');
            if (pickup.expectedThinkDelay === 0) {
                expect(nextThink).toBe(0);
            } else {
                expect(nextThink - (state.world.time - 0.01)).toBeCloseTo(
                    pickup.expectedThinkDelay
                );
            }
        }

        const fullAmmoState = createE1m1PickupWorld();
        const untouchedShells = activeE1m1Entity(
            fullAmmoState,
            'item_shells',
            entity => (entity.spawnflags ?? '0') === '0'
        );
        fullAmmoState.vm.setEntityFloat(
            fullAmmoState.world.playerReference,
            'ammo_shells',
            100
        );
        fullAmmoState.world.soundEvents.length = 0;
        touchE1m1Entity(fullAmmoState, untouchedShells);
        expect(fullAmmoState.vm.getEntityFloat(untouchedShells, 'solid')).toBe(1);
        expect(fullAmmoState.vm.getEntityString(untouchedShells, 'model')).toBe(
            'maps/b_shell0.bsp'
        );
        expect(fullAmmoState.world.soundEvents.some(
            event => event.sample === 'weapons/lock4.wav'
        )).toBe(false);
        expect(fullAmmoState.world.bonusShift).toBe(0);
    });

    it('runs all E1M1 weapon pickups through the original weapon-touch path', () => {
        const cases = [
            {
                ammoField: 'ammo_shells',
                bit: 1,
                classname: 'weapon_supershotgun',
                deathmatch: false,
                expectedAmmo: 30,
                expectedThinkDelay: 0,
                pickupName: 'Double-barrelled Shotgun',
                spawnflags: '0',
                weapon: 2,
                weaponModel: 'progs/v_shot2.mdl'
            },
            {
                ammoField: 'ammo_nails',
                bit: 2,
                classname: 'weapon_nailgun',
                deathmatch: false,
                expectedAmmo: 30,
                expectedThinkDelay: 0,
                pickupName: 'nailgun',
                spawnflags: '2048',
                weapon: 4,
                weaponModel: 'progs/v_nail.mdl'
            },
            {
                ammoField: 'ammo_nails',
                bit: 3,
                classname: 'weapon_supernailgun',
                deathmatch: true,
                expectedAmmo: 30,
                expectedThinkDelay: 30,
                pickupName: 'Super Nailgun',
                spawnflags: '1792',
                weapon: 8,
                weaponModel: 'progs/v_nail2.mdl'
            },
            {
                ammoField: 'ammo_rockets',
                bit: 4,
                classname: 'weapon_grenadelauncher',
                deathmatch: true,
                expectedAmmo: 5,
                expectedThinkDelay: 30,
                pickupName: 'Grenade Launcher',
                spawnflags: '1792',
                weapon: 16,
                weaponModel: 'progs/v_rock.mdl'
            },
            {
                ammoField: 'ammo_rockets',
                bit: 5,
                classname: 'weapon_rocketlauncher',
                deathmatch: true,
                expectedAmmo: 5,
                expectedThinkDelay: 30,
                pickupName: 'Rocket Launcher',
                spawnflags: '1792',
                weapon: 32,
                weaponModel: 'progs/v_rock2.mdl'
            }
        ] as const;

        for (const pickup of cases) {
            const state = createE1m1PickupWorld(
                pickup.deathmatch ? { deathmatch: '1' } : undefined
            );
            const weapon = activeE1m1Entity(
                state,
                pickup.classname,
                entity => (entity.spawnflags ?? '0') === pickup.spawnflags
            );
            state.world.soundEvents.length = 0;

            touchE1m1Entity(state, weapon);

            const clientData = state.world.clientData();
            expect(clientData.items & pickup.weapon).not.toBe(0);
            expect(clientData.activeWeapon).toBe(pickup.weapon);
            expect(clientData.weaponModel).toBe(pickup.weaponModel);
            expect(state.vm.getEntityFloat(
                state.world.playerReference,
                pickup.ammoField
            )).toBe(pickup.expectedAmmo);
            expect(clientData.ammo).toBe(pickup.expectedAmmo);
            expect(state.world.soundEvents.some(
                event => event.sample === 'weapons/pkup.wav'
            )).toBe(true);
            expect(state.world.visibleNotifyLines()).toContain(
                `You got the ${pickup.pickupName}`
            );
            expect(state.vm.getEntityFloat(weapon, 'solid')).toBe(0);
            expect(state.vm.getEntityString(weapon, 'model')).toBe('');
            expect(state.world.bonusShift).toBe(49);
            expect(state.world.itemGetTimes[pickup.bit]).toBe(state.world.time);
            const nextThink = state.vm.getEntityFloat(weapon, 'nextthink');
            if (pickup.expectedThinkDelay === 0) {
                expect(nextThink).toBe(0);
            } else {
                expect(nextThink - (state.world.time - 0.01)).toBeCloseTo(
                    pickup.expectedThinkDelay
                );
            }
        }
    });

    it('fires E1M1\'s authored nailgun through spike impact and damage', () => {
        const state = createE1m1PickupWorld();
        const { map, vm, world } = state;
        const player = world.playerReference;
        const nailgun = activeE1m1Entity(
            state,
            'weapon_nailgun',
            entity => entity.spawnflags === '2048'
        );
        touchE1m1Entity(state, nailgun);
        const soldier = world.entityReferences.find((reference, index) => {
            return map.entities[index].classname === 'monster_army' && reference !== null &&
                !vm.entity(reference).free &&
                vm.getEntityString(reference, 'model') === 'progs/soldier.mdl';
        });
        if (soldier === null || soldier === undefined) {
            throw new Error('E1M1 soldier was not spawned');
        }
        const playerFlags = Math.trunc(vm.getEntityFloat(player, 'flags'));
        vm.setEntityFloat(player, 'flags', playerFlags | 128);
        const playerOrigin: [number, number, number] = [480, -352, 88];
        const viewAngles: [number, number, number] = [0, 90, 0];
        world.setPlayerPose(playerOrigin, viewAngles);
        world.setEntityOrigin(soldier, [480, -152, 88]);
        vm.setEntityWord(soldier, 'enemy', 0);
        const initialNails = vm.getEntityFloat(player, 'ammo_nails');
        const initialHealth = vm.getEntityFloat(soldier, 'health');
        world.soundEvents.length = 0;
        world.particleEvents.length = 0;
        const consumedParticles: QuakeParticleEvent[] = [];
        world.setParticleConsumer(event => consumedParticles.push(event));
        vm.setEntityFloat(soldier, 'effects', 1);
        const playerState = (attack: boolean) => ({
            angles: viewAngles,
            attack,
            jump: false,
            onGround: true,
            origin: playerOrigin,
            velocity: [0, 0, 0] as [number, number, number]
        });

        world.update(0.05, playerState(true));

        const spike = vm.edicts.findIndex((edict, reference) => reference > 1 &&
            !edict.free && vm.getEntityString(reference, 'classname') === 'spike'
        );
        expect(spike).toBeGreaterThan(1);
        expect(vm.getEntityWord(spike, 'owner')).toBe(player);
        expect(vm.getEntityString(spike, 'model')).toBe('progs/spike.mdl');
        expect(vm.getEntityFloat(spike, 'movetype')).toBe(9);
        expect(Math.hypot(...vm.getEntityVector(spike, 'velocity'))).toBeCloseTo(1_000);
        expect(vm.program.functions[vm.getEntityWord(spike, 'touch')].name).toBe(
            'spike_touch'
        );
        expect(vm.getEntityFloat(player, 'ammo_nails')).toBe(initialNails - 1);
        expect(vm.getEntityFloat(player, 'currentammo')).toBe(initialNails - 1);
        expect(world.soundEvents.some(
            event => event.entity === player && event.sample === 'weapons/rocket1i.wav'
        )).toBe(true);

        for (let tick = 0; tick < 10 && !vm.entity(spike).free; tick++) {
            world.update(0.05, playerState(false));
        }

        expect(vm.entity(spike).free).toBe(true);
        expect(vm.getEntityFloat(soldier, 'health')).toBe(initialHealth - 9);
        expect(world.particleEvents.some(
            event => event.color === 73 && event.count === 18
        )).toBe(true);
        const impactIndex = consumedParticles.findIndex(
            event => event.color === 73 && event.count === 18
        );
        expect(impactIndex).toBeGreaterThanOrEqual(0);
        expect(consumedParticles.slice(impactIndex + 1).some(
            event => event.kind === 'entity' && event.origin[1] === -152
        )).toBe(true);
    });

    it('restores a deathmatch E1M1 weapon with the original respawn think', () => {
        const state = createE1m1PickupWorld({ deathmatch: '1' });
        const rocketLauncher = activeE1m1Entity(
            state,
            'weapon_rocketlauncher',
            entity => entity.spawnflags === '1792'
        );
        touchE1m1Entity(state, rocketLauncher);
        const respawnTime = state.vm.getEntityFloat(rocketLauncher, 'nextthink');
        expect(respawnTime - (state.world.time - 0.01)).toBeCloseTo(30);
        state.world.setPlayerPose([592, 90.666_667, 80], [0, 0, 0]);
        state.world.soundEvents.length = 0;

        for (let frame = 0; frame < 302 && state.world.time <= respawnTime; frame++) {
            state.world.update(0.1);
        }

        expect(state.vm.getEntityFloat(rocketLauncher, 'solid')).toBe(1);
        expect(state.vm.getEntityString(rocketLauncher, 'model')).toBe(
            'progs/g_rock2.mdl'
        );
        expect(state.world.soundEvents.some(
            event => event.sample === 'items/itembk2.wav'
        )).toBe(true);
    });

    it('applies the original vertical-only player autoaim correction', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const origin = vm.getEntityVector(world.playerReference, 'origin');
        const target = vm.allocateEdict();
        vm.setGlobalVector('v_forward', [1, 0, 0]);
        vm.setEntityFloat(target, 'solid', 2);
        vm.setEntityFloat(target, 'takedamage', 2);
        vm.setEntityVector(target, 'mins', [-1, -1, -1]);
        vm.setEntityVector(target, 'maxs', [1, 1, 1]);
        vm.setEntityVector(target, 'origin', [
            origin[0] + 30, origin[1] + 10, origin[2] + 20
        ]);

        const aimed = world.aim(world.playerReference, 0);

        expect(aimed[0]).toBeCloseTo(30 / Math.hypot(30, 20));
        expect(aimed[1]).toBe(0);
        expect(aimed[2]).toBeCloseTo(20 / Math.hypot(30, 20));
        world.setCvar('sv_aim', '0.99');
        expect(world.aim(world.playerReference, 0)).toEqual([1, 0, 0]);
    });

    it('excludes positive-team teammates from the original autoaim scan', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const player = world.playerReference;
        const playerOrigin = vm.getEntityVector(player, 'origin');
        vm.setGlobalVector('v_forward', [1, 0, 0]);
        vm.setEntityFloat(player, 'team', 1);
        const createTarget = (
            offset: [number, number, number], team: number
        ): number => {
            const target = vm.allocateEdict();
            vm.setEntityFloat(target, 'solid', 2);
            vm.setEntityFloat(target, 'takedamage', 2);
            vm.setEntityFloat(target, 'team', team);
            vm.setEntityVector(target, 'mins', [-1, -1, -1]);
            vm.setEntityVector(target, 'maxs', [1, 1, 1]);
            vm.setEntityVector(target, 'origin', playerOrigin.map(
                (component, axis) => component + offset[axis]
            ) as [number, number, number]);
            return target;
        };
        createTarget([30, 0, 20], 1);
        createTarget([30, 2, 24], 1);
        createTarget([30, 10, 20], 2);

        expect(world.aim(player, 0)).toEqual([1, 0, 0]);

        world.setCvar('teamplay', '1');
        const teamFiltered = world.aim(player, 0);
        expect(teamFiltered[0]).toBeCloseTo(30 / Math.hypot(30, 20));
        expect(teamFiltered[1]).toBe(0);
        expect(teamFiltered[2]).toBeCloseTo(20 / Math.hypot(30, 20));
    });

    it('executes the original grounded PlayerJump velocity and sound', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const player = world.playerReference;
        vm.setGlobalWord('self', player);
        vm.setEntityFloat(player, 'button2', 1);
        vm.setEntityFloat(player, 'flags', 512 | 4_096);
        vm.setEntityFloat(player, 'waterlevel', 0);
        vm.setEntityVector(player, 'velocity', [0, 0, 0]);

        vm.execute('PlayerPreThink');

        expect(vm.getEntityVector(player, 'velocity')[2]).toBe(270);
        expect(world.soundEvents.some(event => event.sample === 'player/plyrjmp8.wav')).toBe(true);
    });

    it('executes the original swimming PlayerJump velocity and sound', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const player = world.playerReference;
        const initial = world.playerResult();

        const result = world.update(0.01, {
            angles: initial.angles,
            attack: false,
            jump: true,
            onGround: false,
            origin: initial.origin,
            velocity: [0, 0, 0],
            waterLevel: 2,
            waterType: -4
        });

        expect(result.velocity[2]).toBe(80);
        expect(vm.getEntityFloat(player, 'waterlevel')).toBe(2);
        expect(vm.getEntityFloat(player, 'watertype')).toBe(-4);
        expect(world.soundEvents.some(event => /^misc\/water[12]\.wav$/u.test(event.sample))).toBe(true);
    });

    it('runs the original E1M1 drowning-bubble sprite lifecycle', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const player = world.playerReference;
        world.setPlayerPose([588, 1_008, -352], [0, 0, 0]);
        vm.setGlobalWord('self', player);
        vm.setEntityFloat(player, 'waterlevel', 3);
        vm.setEntityFloat(player, 'watertype', CONTENTS.WATER);
        vm.values[4] = 1;

        vm.execute('DeathBubbles');
        world.update(0.1);
        world.update(0.1);

        const bubble = vm.edicts.findIndex((edict, reference) => (
            reference > player && !edict.free &&
            vm.getEntityString(reference, 'classname') === 'bubble'
        ));
        expect(bubble).toBeGreaterThan(player);
        expect(vm.getEntityString(bubble, 'model')).toBe('progs/s_bubble.spr');
        expect(vm.getEntityFloat(bubble, 'movetype')).toBe(8);
        expect(vm.getEntityFloat(bubble, 'solid')).toBe(0);
        expect(vm.getEntityFloat(bubble, 'frame')).toBe(0);
        expect(vm.getEntityVector(bubble, 'origin').slice(0, 2)).toEqual([588, 1_008]);
        expect(vm.getEntityVector(bubble, 'origin')[2]).toBeGreaterThanOrEqual(-328);
        expect(vm.getEntityVector(bubble, 'velocity')).toEqual([0, 0, 15]);

        world.update(0.5);

        expect(vm.getEntityVector(bubble, 'origin')[2]).toBeGreaterThan(-328);
        expect(vm.getEntityFloat(bubble, 'nextthink')).toBeGreaterThan(world.time);
    });

    it('bridges a controller-timed ground jump to the original sound channel', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const initial = world.playerResult();
        world.soundEvents.length = 0;

        world.update(0.01, {
            angles: initial.angles,
            attack: false,
            jump: true,
            jumped: true,
            onGround: false,
            origin: initial.origin,
            velocity: [0, 0, 262],
            waterLevel: 0,
            waterType: -1
        });

        const jumpSounds = world.soundEvents.filter(
            event => event.sample === 'player/plyrjmp8.wav'
        );
        expect(jumpSounds).toHaveLength(1);
        expect(jumpSounds[0]).toMatchObject({
            attenuation: 1,
            channel: 4,
            entity: world.playerReference,
            volume: 1
        });
        expect(Math.trunc(vm.getEntityFloat(world.playerReference, 'flags')) & 4_096).toBe(0);
    });

    it('runs the original PlayerPostThink landing cue after delegated movement', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const initial = world.playerResult();
        world.soundEvents.length = 0;

        const falling = world.update(0.01, {
            angles: initial.angles,
            attack: false,
            jump: false,
            onGround: false,
            origin: initial.origin,
            velocity: [0, 0, -400]
        }, preMoveState => ({
            angles: preMoveState.angles,
            attack: false,
            jump: false,
            onGround: false,
            origin: preMoveState.origin,
            velocity: [0, 0, -400]
        }));
        expect(vm.getEntityFloat(world.playerReference, 'jump_flag')).toBe(-400);

        world.update(0.01, {
            angles: falling.angles,
            attack: false,
            jump: false,
            onGround: false,
            oldOrigin: falling.oldOrigin,
            origin: falling.origin,
            velocity: falling.velocity
        }, preMoveState => ({
            angles: preMoveState.angles,
            attack: false,
            jump: false,
            onGround: true,
            oldOrigin: preMoveState.oldOrigin,
            origin: preMoveState.origin,
            velocity: [0, 0, 0]
        }));

        expect(world.soundEvents.filter(
            event => event.sample === 'player/land.wav'
        )).toHaveLength(1);
    });

    it('feeds liquid state into the original QuakeC lava damage path', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const player = world.playerReference;
        const initial = world.playerResult();
        const initialHealth = vm.getEntityFloat(player, 'health');

        world.update(0.01, {
            angles: initial.angles,
            attack: false,
            jump: false,
            onGround: false,
            origin: initial.origin,
            velocity: [0, 0, 0],
            waterLevel: 3,
            waterType: -5
        });

        expect(vm.getEntityFloat(player, 'health')).toBe(initialHealth - 30);
        expect(world.soundEvents.some(event => event.sample === 'player/inlava.wav')).toBe(true);
        expect(world.damageShift).toBeGreaterThan(0);
    });

    it('routes QuakeC centerprint through the original timed compositor state', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const centerPrint = vm.builtins.get(73);
        if (!centerPrint) {
            throw new Error('centerprint builtin is not registered');
        }
        vm.words[4] = world.playerReference;
        vm.words[7] = vm.internString('Only 1 more to go...');
        world.centerMessageDuration = 0.2;

        centerPrint(vm, 2);

        expect(world.visibleCenterMessage()).toBe('Only 1 more to go...');
        world.advanceCenterMessage(0.1);
        expect(world.visibleCenterMessage()).toBe('Only 1 more to go...');
        world.advanceCenterMessage(0.1);
        expect(world.visibleCenterMessage()).toBe('');

        world.centerMessageDuration = 0;
        centerPrint(vm, 2);
        world.advanceCenterMessage(0.01);
        expect(world.visibleCenterMessage()).toBe('');
    });

    it('accounts for every authored non-patrol E1M1 target source', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const targetSources = map.entities.flatMap(entity => (
            (entity.target !== undefined || entity.killtarget !== undefined) &&
            entity.classname !== 'path_corner' && entity.classname !== 'monster_army' ? [{
                    classname: entity.classname,
                    killtarget: entity.killtarget,
                    model: entity.model,
                    target: entity.target,
                    targetname: entity.targetname
                }] : []
        ));

        expect(targetSources).toEqual([
            { classname: 'func_button', killtarget: undefined, model: '*4', target: 't1', targetname: undefined },
            { classname: 'func_button', killtarget: undefined, model: '*9', target: 't2', targetname: undefined },
            { classname: 'trigger_once', killtarget: undefined, model: '*11', target: 't3', targetname: undefined },
            { classname: 'trigger_once', killtarget: undefined, model: '*12', target: 't3', targetname: undefined },
            { classname: 'trigger_multiple', killtarget: undefined, model: '*16', target: 't4', targetname: undefined },
            { classname: 'trigger_once', killtarget: undefined, model: '*18', target: 't5', targetname: undefined },
            { classname: 'func_button', killtarget: undefined, model: '*19', target: 't1', targetname: undefined },
            { classname: 'trigger_teleport', killtarget: undefined, model: '*20', target: 't6', targetname: undefined },
            { classname: 'trigger_multiple', killtarget: undefined, model: '*24', target: 't8', targetname: undefined },
            { classname: 'func_button', killtarget: undefined, model: '*25', target: 't9', targetname: undefined },
            { classname: 'func_button', killtarget: undefined, model: '*26', target: 't9', targetname: undefined },
            { classname: 'func_button', killtarget: undefined, model: '*27', target: 't9', targetname: undefined },
            { classname: 'trigger_counter', killtarget: undefined, model: '*28', target: 't10', targetname: 't9' },
            { classname: 'trigger_once', killtarget: undefined, model: '*30', target: 't11', targetname: undefined },
            { classname: 'trigger_once', killtarget: undefined, model: '*31', target: 't12', targetname: undefined },
            { classname: 'trigger_once', killtarget: undefined, model: '*32', target: 't13', targetname: undefined },
            { classname: 'trigger_once', killtarget: undefined, model: '*33', target: 't14', targetname: undefined },
            { classname: 'trigger_once', killtarget: undefined, model: '*39', target: 't15', targetname: undefined },
            { classname: 'trigger_multiple', killtarget: undefined, model: '*40', target: 't18', targetname: undefined },
            { classname: 'trigger_multiple', killtarget: undefined, model: '*42', target: 't18', targetname: undefined },
            { classname: 'trigger_once', killtarget: 't31', model: '*54', target: 't31', targetname: undefined },
            { classname: 'trigger_once', killtarget: 't32', model: '*55', target: 't32', targetname: undefined }
        ]);
    });

    it.each(['*11', '*12'])('fires E1M1 %s into its original t3 secret-door movement', (
        triggerModel
    ) => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const triggerIndex = map.entities.findIndex(entity => (
            entity.classname === 'trigger_once' && entity.model === triggerModel &&
            entity.target === 't3'
        ));
        const doorIndex = map.entities.findIndex(entity => entity.classname === 'func_door_secret' && entity.targetname === 't3'
        );
        const trigger = world.entityReferences[triggerIndex];
        const door = world.entityReferences[doorIndex];
        if (trigger === null || door === null) {
            throw new Error('E1M1 secret-door trigger chain was not spawned');
        }
        const triggerOrigin = vm.getEntityVector(trigger, 'origin');
        const triggerMins = vm.getEntityVector(trigger, 'mins');
        const triggerMaxs = vm.getEntityVector(trigger, 'maxs');
        const triggerCenter = triggerOrigin.map(
            (component, axis) => component + (triggerMins[axis] + triggerMaxs[axis]) / 2
        ) as [number, number, number];
        const closedDoorOrigin = vm.getEntityVector(door, 'origin');
        const initialLightStyle = world.lightStyles.get(32);

        world.update(0.01, {
            angles: [0, 0, 0],
            attack: false,
            jump: false,
            onGround: true,
            origin: triggerCenter,
            velocity: [0, 0, 0]
        });

        expect(vm.getEntityVector(door, 'velocity').some(component => component !== 0)).toBe(true);
        expect(vm.getEntityFloat(door, 'nextthink')).toBeGreaterThan(0);
        expect(vm.program.functions[vm.getEntityWord(trigger, 'touch')].name).toBe('SUB_Null');
        expect(world.lightStyles.get(32)).not.toBe(initialLightStyle);

        world.update(0.1);
        expect(vm.getEntityVector(door, 'origin')).not.toEqual(closedDoorOrigin);
        const doorCollider = world.collision.brushColliders.find(collider => collider.modelIndex === 10);
        expect(doorCollider?.origin).toEqual(vm.getEntityVector(door, 'origin'));
    });

    it.each([
        ['t31', 'You can jump up here...'],
        ['t32', 'You can jump across...']
    ] as const)('runs E1M1\'s authored %s tutorial and killtarget lifecycle', (
        targetname,
        message
    ) => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const messageIndex = map.entities.findIndex(entity => (
            entity.classname === 'trigger_multiple' &&
            entity.targetname === targetname &&
            entity.message === message
        ));
        const disableIndex = map.entities.findIndex(entity => (
            entity.classname === 'trigger_once' &&
            entity.target === targetname &&
            entity.killtarget === targetname
        ));
        const messageTrigger = world.entityReferences[messageIndex];
        const disableTrigger = world.entityReferences[disableIndex];
        if (messageTrigger === null || messageTrigger === undefined ||
            disableTrigger === null || disableTrigger === undefined) {
            throw new Error('E1M1 tutorial trigger chain was not spawned');
        }
        const triggerCenter = (reference: number): [number, number, number] => {
            const origin = vm.getEntityVector(reference, 'origin');
            const minimum = vm.getEntityVector(reference, 'mins');
            const maximum = vm.getEntityVector(reference, 'maxs');
            return origin.map(
                (component, axis) => component + (minimum[axis] + maximum[axis]) / 2
            ) as [number, number, number];
        };
        const initial = world.playerResult();
        const movePlayer = (origin: [number, number, number], deltaTime = 0.01): void => {
            world.update(deltaTime, {
                angles: initial.angles,
                attack: false,
                jump: false,
                onGround: true,
                origin,
                velocity: [0, 0, 0]
            });
            world.advanceCenterMessage(deltaTime);
        };

        movePlayer(triggerCenter(messageTrigger));

        expect(world.visibleCenterMessage()).toBe(message);
        expect(world.soundEvents.some(event => (
            event.entity === messageTrigger &&
            event.sample === 'misc/talk.wav' &&
            event.channel === 2
        ))).toBe(true);
        expect(vm.entity(messageTrigger).free).toBe(false);

        movePlayer(initial.origin);
        movePlayer(triggerCenter(disableTrigger));

        expect(vm.entity(messageTrigger).free).toBe(true);
        expect(vm.program.functions[vm.getEntityWord(disableTrigger, 'touch')].name).toBe('SUB_Null');
        movePlayer(initial.origin, 0.1);
        expect(vm.entity(disableTrigger).free).toBe(true);

        for (let tick = 0; tick < 21; tick++) {
            movePlayer(initial.origin, 0.1);
        }
        expect(world.visibleCenterMessage()).toBe('');
        const talkSounds = world.soundEvents.filter(event => event.sample === 'misc/talk.wav').length;

        movePlayer(triggerCenter(messageTrigger));

        expect(world.visibleCenterMessage()).toBe('');
        expect(world.soundEvents.filter(event => event.sample === 'misc/talk.wav')).toHaveLength(talkSounds);
    });

    it('shoots E1M1\'s authored secret door through its original damage path', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const doorIndex = map.entities.findIndex(entity => (
            entity.classname === 'func_door_secret' &&
            entity.message === 'Shoot this secret door...'
        ));
        const door = world.entityReferences[doorIndex];
        if (door === null || door === undefined) {
            throw new Error('E1M1 shootable secret door was not spawned');
        }
        const player = world.playerReference;
        const minimum = vm.getEntityVector(door, 'absmin');
        const maximum = vm.getEntityVector(door, 'absmax');
        expect(minimum).toEqual([655, 47, 47]);
        expect(maximum).toEqual([721, 65, 113]);
        const playerOrigin: [number, number, number] = [688, 23, 79];
        const aimPoint: [number, number, number] = [663, 56, 55];
        const shotSource: [number, number, number] = [688, 23, 101];
        const delta = aimPoint.map(
            (component, axis) => component - shotSource[axis]
        ) as [number, number, number];
        const horizontal = Math.hypot(delta[0], delta[1]);
        const viewAngles: [number, number, number] = [
            -Math.atan2(delta[2], horizontal) * 180 / Math.PI,
            Math.atan2(delta[1], delta[0]) * 180 / Math.PI,
            0
        ];
        const positionTrace = world.collision.trace(playerOrigin, playerOrigin);
        expect(positionTrace.startSolid).toBe(false);
        expect(positionTrace.allSolid).toBe(false);
        expect(world.traceLine(shotSource, aimPoint, false, player).entity).toBe(door);
        const initialOrigin = vm.getEntityVector(door, 'origin');
        const initialAmmo = vm.getEntityFloat(player, 'currentammo');
        expect(vm.getEntityFloat(door, 'solid')).toBe(4);
        expect(vm.getEntityFloat(door, 'takedamage')).toBe(1);
        expect(vm.program.functions[vm.getEntityWord(door, 'th_pain')].name).toBe(
            'fd_secret_use'
        );
        world.soundEvents.length = 0;

        world.update(0.05, {
            angles: viewAngles,
            attack: true,
            jump: false,
            onGround: false,
            origin: playerOrigin,
            velocity: [0, 0, 0]
        });

        expect(vm.getEntityFloat(player, 'currentammo')).toBe(initialAmmo - 1);
        expect(vm.getEntityFloat(door, 'takedamage')).toBe(0);
        expect(vm.getEntityString(door, 'message')).toBe('');
        expect(vm.getEntityVector(door, 'velocity').some(component => component !== 0)).toBe(true);
        expect(vm.getEntityFloat(door, 'nextthink')).toBeGreaterThan(0);
        expect(world.soundEvents.some(event => (
            event.entity === door && event.sample === vm.getEntityString(door, 'noise2')
        ))).toBe(true);
        world.update(0.1);
        expect(vm.getEntityVector(door, 'origin')).not.toEqual(initialOrigin);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === 43
        )?.origin).toEqual(vm.getEntityVector(door, 'origin'));
    });

    it('opens E1M1\'s t4 door through its authored shootable trigger', () => {
        const doorModel = '*15';
        const targetName = 't4';
        const triggerModel = '*16';
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const triggerIndex = map.entities.findIndex(entity => (
            entity.classname === 'trigger_multiple' && entity.target === targetName &&
            entity.model === triggerModel && entity.health === '1'
        ));
        const doorIndex = map.entities.findIndex(entity => (
            entity.targetname === targetName && entity.model === doorModel
        ));
        const trigger = world.entityReferences[triggerIndex];
        const door = world.entityReferences[doorIndex];
        if (trigger === null || trigger === undefined ||
            door === null || door === undefined) {
            throw new Error(`E1M1 ${targetName} shootable-trigger chain was not spawned`);
        }
        const player = world.playerReference;
        const triggerMinimum = vm.getEntityVector(trigger, 'absmin');
        const triggerMaximum = vm.getEntityVector(trigger, 'absmax');
        const target = triggerMinimum.map(
            (component, axis) => (component + triggerMaximum[axis]) / 2
        ) as [number, number, number];
        const carrierHeights = [target[2] - 16];
        for (let offset = -64; offset <= 64; offset += 4) {
            const height = target[2] + offset;
            if (!carrierHeights.includes(height)) carrierHeights.push(height);
        }
        let playerOrigin: [number, number, number] | undefined;
        for (let x = target[0] - 60; x <= target[0] + 60 && !playerOrigin; x += 4) {
            for (let y = target[1] - 60; y <= target[1] + 60 && !playerOrigin; y += 4) {
                for (const z of carrierHeights) {
                    const candidate: [number, number, number] = [x, y, z];
                    const source: [number, number, number] = [x, y, z + 16];
                    const distance = Math.hypot(...target.map(
                        (component, axis) => component - source[axis]
                    ));
                    const positionTrace = world.collision.trace(candidate, candidate);
                    if (distance <= 63 && !positionTrace.startSolid &&
                        !positionTrace.allSolid &&
                        world.traceLine(source, target, false, player).entity === trigger) {
                        playerOrigin = candidate;
                        break;
                    }
                }
            }
        }
        if (!playerOrigin) {
            throw new Error(`E1M1 ${targetName} trigger has no clear axe carrier position`);
        }
        const shotSource: [number, number, number] = [
            playerOrigin[0], playerOrigin[1], playerOrigin[2] + 16
        ];
        const delta = target.map(
            (component, axis) => component - shotSource[axis]
        ) as [number, number, number];
        const horizontal = Math.hypot(delta[0], delta[1]);
        const viewAngles: [number, number, number] = [
            -Math.atan2(delta[2], horizontal) * 180 / Math.PI,
            Math.atan2(delta[1], delta[0]) * 180 / Math.PI,
            0
        ];
        const playerState = {
            angles: viewAngles,
            attack: false,
            jump: false,
            onGround: true,
            origin: playerOrigin,
            velocity: [0, 0, 0] as [number, number, number]
        };
        for (let frame = 0; frame < 20; frame++) world.update(0.05, playerState);
        world.setPlayerPose(playerOrigin, viewAngles);

        expect(vm.getEntityString(trigger, 'model')).toBe('');
        expect(vm.getEntityFloat(trigger, 'solid')).toBe(2);
        expect(vm.getEntityFloat(trigger, 'takedamage')).toBe(1);
        expect(vm.program.functions[vm.getEntityWord(trigger, 'th_die')].name).toBe(
            'multi_killed'
        );
        expect(world.traceLine(shotSource, target, false, player).entity).toBe(trigger);
        const initialDoorOrigin = vm.getEntityVector(door, 'origin');
        const doorMoveSound = vm.getEntityString(door, 'noise2');

        world.setPlayerImpulse(1);
        world.update(0.05, playerState);
        expect(world.clientData().weaponModel).toBe('progs/v_axe.mdl');
        world.clearSoundEvents();
        world.update(0.05, { ...playerState, attack: true });
        for (let frame = 0; frame < 4; frame++) world.update(0.05, playerState);

        if (vm.getEntityFloat(trigger, 'health') > 0) {
            throw new Error(`E1M1 ${targetName} axe carrier missed: ${JSON.stringify({
                angles: vm.getEntityVector(player, 'angles'),
                origin: vm.getEntityVector(player, 'origin'),
                shotSource,
                sounds: world.soundEvents.map(event => event.sample),
                target,
                trace: world.traceLine(shotSource, target, false, player).entity,
                vAngle: vm.getEntityVector(player, 'v_angle'),
                viewAngles
            })}`);
        }
        expect(vm.getEntityFloat(trigger, 'health')).toBeLessThanOrEqual(0);
        expect(vm.getEntityFloat(trigger, 'takedamage')).toBe(0);
        expect(vm.getEntityFloat(door, 'state')).toBe(2);
        expect(vm.getEntityVector(door, 'velocity').some(component => component !== 0)).toBe(
            true
        );
        expect(world.soundEvents.some(event => event.sample === 'weapons/ax1.wav')).toBe(true);
        expect(world.soundEvents.some(event => (
            event.entity === door && event.sample === doorMoveSound
        ))).toBe(true);
        world.update(0.1);
        expect(vm.getEntityVector(door, 'origin')).not.toEqual(initialDoorOrigin);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === Number(doorModel.slice(1))
        )?.origin).toEqual(vm.getEntityVector(door, 'origin'));
    });

    it('opens E1M1\'s t18 secret door through its authored shootable trigger', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const triggerIndex = map.entities.findIndex(entity => (
            entity.classname === 'trigger_multiple' && entity.model === '*40' &&
            entity.target === 't18' && entity.health === '1'
        ));
        const doorIndex = map.entities.findIndex(entity => (
            entity.classname === 'func_door_secret' && entity.model === '*41' &&
            entity.targetname === 't18'
        ));
        const trigger = world.entityReferences[triggerIndex];
        const door = world.entityReferences[doorIndex];
        if (trigger === null || trigger === undefined ||
            door === null || door === undefined) {
            throw new Error('E1M1 t18 shootable-trigger chain was not spawned');
        }
        const player = world.playerReference;
        vm.setEntityFloat(player, 'flags', Math.trunc(
            vm.getEntityFloat(player, 'flags')
        ) | 128);
        const triggerMinimum = vm.getEntityVector(trigger, 'absmin');
        const triggerMaximum = vm.getEntityVector(trigger, 'absmax');
        const target = triggerMinimum.map(
            (component, axis) => (component + triggerMaximum[axis]) / 2
        ) as [number, number, number];
        const carrierHeights = [target[2] - 15.2];
        for (let offset = -64; offset <= 64; offset += 4) {
            const height = target[2] + offset;
            if (!carrierHeights.includes(height)) carrierHeights.push(height);
        }
        let playerOrigin: [number, number, number] | undefined;
        for (let distance = 64; distance <= 512 && !playerOrigin; distance += 8) {
            const horizontalCandidates = [
                [target[0] - distance, target[1]],
                [target[0] + distance, target[1]],
                [target[0], target[1] - distance],
                [target[0], target[1] + distance]
            ];
            for (const [x, y] of horizontalCandidates) {
                for (const z of carrierHeights) {
                    const candidate: [number, number, number] = [x, y, z];
                    const source: [number, number, number] = [x, y, z + 15.2];
                    const positionTrace = world.collision.trace(candidate, candidate);
                    if (!positionTrace.startSolid && !positionTrace.allSolid &&
                        world.traceLine(source, target, false, player).entity === trigger) {
                        playerOrigin = candidate;
                        break;
                    }
                }
                if (playerOrigin) break;
            }
        }
        if (!playerOrigin) {
            throw new Error('E1M1 t18 trigger has no clear shotgun carrier position');
        }
        expect(playerOrigin).toEqual([160, 2972, -15.2]);
        const source: [number, number, number] = [
            playerOrigin[0], playerOrigin[1], playerOrigin[2] + 15.2
        ];
        const delta = target.map(
            (component, axis) => component - source[axis]
        ) as [number, number, number];
        const horizontal = Math.hypot(delta[0], delta[1]);
        const viewAngles: [number, number, number] = [
            -Math.atan2(delta[2], horizontal) * 180 / Math.PI,
            Math.atan2(delta[1], delta[0]) * 180 / Math.PI,
            0
        ];
        const playerState = {
            angles: viewAngles,
            attack: false,
            jump: false,
            onGround: true,
            origin: playerOrigin,
            velocity: [0, 0, 0] as [number, number, number]
        };
        for (let frame = 0; frame < 20; frame++) world.update(0.05, playerState);
        world.setPlayerPose(playerOrigin, viewAngles);
        const initialDoorOrigin = vm.getEntityVector(door, 'origin');
        const initialShells = vm.getEntityFloat(player, 'ammo_shells');
        world.clearSoundEvents();

        world.update(0.05, { ...playerState, attack: true });

        expect(vm.getEntityFloat(player, 'ammo_shells')).toBe(initialShells - 1);
        expect(vm.getEntityFloat(trigger, 'health')).toBeLessThanOrEqual(0);
        expect(vm.getEntityFloat(trigger, 'takedamage')).toBe(0);
        expect(vm.getEntityVector(door, 'velocity').some(component => component !== 0)).toBe(
            true
        );
        expect(world.soundEvents.some(event => event.sample === 'weapons/guncock.wav')).toBe(true);
        expect(world.soundEvents.some(event => (
            event.entity === door && event.sample === vm.getEntityString(door, 'noise2')
        ))).toBe(true);
        world.update(0.1);
        expect(vm.getEntityVector(door, 'origin')).not.toEqual(initialDoorOrigin);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === 41
        )?.origin).toEqual(vm.getEntityVector(door, 'origin'));
    });

    it.each([
        { doorModel: '*23', oneShot: false, target: 't8', triggerModel: '*24' },
        { doorModel: '*38', oneShot: true, target: 't15', triggerModel: '*39' },
        { doorModel: '*41', oneShot: false, target: 't18', triggerModel: '*42' }
    ])('opens E1M1\'s $target door through its authored touch trigger', ({
        doorModel,
        oneShot,
        target,
        triggerModel
    }) => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        for (let frame = 0; frame < 3; frame++) world.update(0.05);
        const triggerIndex = map.entities.findIndex(entity => (
            entity.model === triggerModel && entity.target === target
        ));
        const doorIndex = map.entities.findIndex(entity => (
            entity.model === doorModel && entity.targetname === target
        ));
        const trigger = world.entityReferences[triggerIndex];
        const door = world.entityReferences[doorIndex];
        if (trigger === null || trigger === undefined ||
            door === null || door === undefined) {
            throw new Error(`E1M1 ${target} touch-trigger chain was not spawned`);
        }
        const player = world.playerReference;
        vm.setEntityFloat(player, 'flags', Math.trunc(
            vm.getEntityFloat(player, 'flags')
        ) | 128);
        const triggerMinimum = vm.getEntityVector(trigger, 'absmin');
        const triggerMaximum = vm.getEntityVector(trigger, 'absmax');
        const playerMinimum = vm.getEntityVector(player, 'mins');
        const playerMaximum = vm.getEntityVector(player, 'maxs');
        const candidateAxes = triggerMinimum.map((minimum, axis) => [
            minimum - playerMinimum[axis] + 1,
            (minimum + triggerMaximum[axis] -
                playerMinimum[axis] - playerMaximum[axis]) / 2,
            triggerMaximum[axis] - playerMaximum[axis] - 1
        ]);
        let playerOrigin: [number, number, number] | undefined;
        for (const x of candidateAxes[0]) {
            for (const y of candidateAxes[1]) {
                for (const z of candidateAxes[2]) {
                    const candidate: [number, number, number] = [x, y, z];
                    const trace = world.collision.trace(candidate, candidate);
                    if (!trace.startSolid && !trace.allSolid) {
                        playerOrigin = candidate;
                        break;
                    }
                }
                if (playerOrigin) break;
            }
            if (playerOrigin) break;
        }
        if (!playerOrigin) {
            throw new Error(`E1M1 ${target} trigger has no clear player carrier`);
        }
        if (target === 't18') expect(playerOrigin).toEqual([-368, 2896, -44]);
        const triggerTouch = vm.getEntityWord(trigger, 'touch');
        expect(vm.program.functions[triggerTouch].name).toBe('multi_touch');
        const initialDoorOrigin = vm.getEntityVector(door, 'origin');
        const movingSound = vm.getEntityString(door, 'noise2');
        const initial = world.playerResult(false);

        world.update(0.01, {
            angles: initial.angles,
            attack: false,
            jump: false,
            onGround: true,
            origin: playerOrigin,
            velocity: [0, 0, 0]
        });

        expect(vm.getEntityWord(trigger, 'enemy')).toBe(player);
        expect(vm.getEntityVector(door, 'velocity').some(component => component !== 0)).toBe(
            true
        );
        expect(world.soundEvents.some(event => (
            event.entity === door && event.sample === movingSound
        ))).toBe(true);
        if (oneShot) {
            expect(vm.program.functions[vm.getEntityWord(trigger, 'touch')].name).toBe('SUB_Null');
        } else {
            expect(vm.program.functions[vm.getEntityWord(trigger, 'think')].name).toBe(
                'multi_wait'
            );
        }
        world.update(0.1);
        expect(vm.getEntityVector(door, 'origin')).not.toEqual(initialDoorOrigin);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === Number(doorModel.slice(1))
        )?.origin).toEqual(vm.getEntityVector(door, 'origin'));
        if (oneShot) expect(vm.entity(trigger).free).toBe(true);
    });

    it.each([
        { buttonModel: '*4', modelIndex: 4 },
        { buttonModel: '*19', modelIndex: 19 }
    ])('fires E1M1 t1 only after authored button $buttonModel reaches its end', ({
        buttonModel,
        modelIndex
    }) => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        for (let frame = 0; frame < 3; frame++) world.update(0.05);
        const buttonIndex = map.entities.findIndex(entity => (
            entity.classname === 'func_button' && entity.model === buttonModel &&
            entity.target === 't1'
        ));
        const doorIndex = map.entities.findIndex(entity => (
            entity.classname === 'func_door' && entity.model === '*3' &&
            entity.targetname === 't1'
        ));
        const button = world.entityReferences[buttonIndex];
        const door = world.entityReferences[doorIndex];
        if (button === null || button === undefined ||
            door === null || door === undefined) {
            throw new Error(`E1M1 t1 ${buttonModel} chain was not spawned`);
        }
        expect(vm.program.functions[vm.getEntityWord(button, 'touch')].name).toBe(
            'button_touch'
        );
        const player = world.playerResult(false);
        const initialDoorOrigin = vm.getEntityVector(door, 'origin');
        const movingSound = vm.getEntityString(door, 'noise2');

        world.update(0.01, {
            angles: player.angles,
            attack: false,
            jump: false,
            onGround: player.onGround,
            origin: player.origin,
            touchModelIndices: [modelIndex],
            velocity: player.velocity
        });

        expect(vm.getEntityFloat(button, 'state')).toBe(2);
        expect(vm.getEntityVector(door, 'origin')).toEqual(initialDoorOrigin);
        for (let frame = 0; frame < 150 && vm.getEntityFloat(button, 'state') !== 0; frame++) {
            world.update(0.05);
        }
        expect(vm.getEntityFloat(button, 'state')).toBe(0);
        expect(vm.getEntityFloat(button, 'frame')).toBe(1);
        expect(vm.getEntityVector(door, 'velocity').some(component => component !== 0)).toBe(
            true
        );
        expect(world.soundEvents.some(event => (
            event.entity === door && event.sample === movingSound
        ))).toBe(true);
        world.update(0.05);
        expect(vm.getEntityVector(door, 'origin')).not.toEqual(initialDoorOrigin);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === 3
        )?.origin).toEqual(vm.getEntityVector(door, 'origin'));
    });

    it.each([
        { doorModel: '*17', lightStyle: undefined, target: 't5', triggerModel: '*18' },
        { doorModel: '*34', lightStyle: 33, target: 't11', triggerModel: '*30' },
        { doorModel: '*35', lightStyle: 34, target: 't12', triggerModel: '*31' },
        { doorModel: '*36', lightStyle: 35, target: 't13', triggerModel: '*32' },
        { doorModel: '*37', lightStyle: 36, target: 't14', triggerModel: '*33' }
    ])('fires E1M1\'s authored $target one-shot door chain', ({
        doorModel,
        lightStyle,
        target,
        triggerModel
    }) => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        for (let frame = 0; frame < 3; frame++) world.update(0.05);
        const triggerIndex = map.entities.findIndex(entity => (
            entity.classname === 'trigger_once' && entity.model === triggerModel &&
            entity.target === target
        ));
        const doorIndex = map.entities.findIndex(entity => (
            entity.classname === 'func_door' && entity.model === doorModel &&
            entity.targetname === target
        ));
        const lightIndex = lightStyle === undefined ? -1 : map.entities.findIndex(entity => (
            entity.classname === 'light' && entity.targetname === target &&
            Number(entity.style) === lightStyle
        ));
        const trigger = world.entityReferences[triggerIndex];
        const door = world.entityReferences[doorIndex];
        const light = lightIndex < 0 ? undefined : world.entityReferences[lightIndex];
        if (trigger === null || trigger === undefined ||
            door === null || door === undefined ||
            (lightStyle !== undefined && (light === null || light === undefined))) {
            throw new Error(`E1M1 ${target} one-shot chain was not spawned`);
        }
        const player = world.playerReference;
        vm.setEntityFloat(player, 'flags', Math.trunc(
            vm.getEntityFloat(player, 'flags')
        ) | 128);
        const triggerMinimum = vm.getEntityVector(trigger, 'absmin');
        const triggerMaximum = vm.getEntityVector(trigger, 'absmax');
        const playerMinimum = vm.getEntityVector(player, 'mins');
        const playerMaximum = vm.getEntityVector(player, 'maxs');
        const candidateAxes = triggerMinimum.map((minimum, axis) => [
            minimum - playerMinimum[axis] + 1,
            (minimum + triggerMaximum[axis] -
                playerMinimum[axis] - playerMaximum[axis]) / 2,
            triggerMaximum[axis] - playerMaximum[axis] - 1
        ]);
        let playerOrigin: [number, number, number] | undefined;
        for (const x of candidateAxes[0]) {
            for (const y of candidateAxes[1]) {
                for (const z of candidateAxes[2]) {
                    const candidate: [number, number, number] = [x, y, z];
                    const trace = world.collision.trace(candidate, candidate);
                    if (!trace.startSolid && !trace.allSolid) {
                        playerOrigin = candidate;
                        break;
                    }
                }
                if (playerOrigin) break;
            }
            if (playerOrigin) break;
        }
        if (!playerOrigin) {
            throw new Error(`E1M1 ${target} trigger has no clear player carrier`);
        }
        if (target === 't11') expect(playerOrigin).toEqual([800, 2_384, -80]);
        expect(vm.program.functions[vm.getEntityWord(trigger, 'touch')].name).toBe(
            'multi_touch'
        );
        const initialDoorOrigin = vm.getEntityVector(door, 'origin');
        const initialLightStyle = lightStyle === undefined ? undefined :
            world.lightStyles.get(lightStyle);
        const movingSound = vm.getEntityString(door, 'noise2');
        const initial = world.playerResult(false);

        world.update(0.01, {
            angles: initial.angles,
            attack: false,
            jump: false,
            onGround: true,
            origin: playerOrigin,
            velocity: [0, 0, 0]
        });

        expect(vm.getEntityWord(trigger, 'enemy')).toBe(player);
        expect(vm.program.functions[vm.getEntityWord(trigger, 'touch')].name).toBe('SUB_Null');
        expect(vm.getEntityVector(door, 'velocity').some(component => component !== 0)).toBe(
            true
        );
        expect(world.soundEvents.some(event => (
            event.entity === door && event.sample === movingSound
        ))).toBe(true);
        if (lightStyle !== undefined) {
            expect(initialLightStyle).toBe('a');
            expect(world.lightStyles.get(lightStyle)).toBe('m');
            expect(vm.program.functions[vm.getEntityWord(light as number, 'use')].name).toBe(
                'light_use'
            );
        }
        world.update(0.1);
        expect(vm.entity(trigger).free).toBe(true);
        expect(vm.getEntityVector(door, 'origin')).not.toEqual(initialDoorOrigin);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === Number(doorModel.slice(1))
        )?.origin).toEqual(vm.getEntityVector(door, 'origin'));
    });

    it('fires E1M1\'s t2 target only when its authored button reaches the pressed end', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        for (let frame = 0; frame < 3; frame++) world.update(0.05);
        const buttonIndex = map.entities.findIndex(entity => (
            entity.classname === 'func_button' && entity.model === '*9' &&
            entity.target === 't2'
        ));
        const doorIndex = map.entities.findIndex(entity => (
            entity.classname === 'func_door' && entity.model === '*8' &&
            entity.targetname === 't2'
        ));
        const button = world.entityReferences[buttonIndex];
        const door = world.entityReferences[doorIndex];
        if (button === null || button === undefined || door === null || door === undefined) {
            throw new Error('E1M1 t2 button-door chain was not spawned');
        }
        const player = world.playerResult(false);
        const initialDoorOrigin = vm.getEntityVector(door, 'origin');
        const movingSound = vm.getEntityString(door, 'noise2');

        world.update(0.01, {
            angles: player.angles,
            attack: false,
            jump: false,
            onGround: player.onGround,
            origin: player.origin,
            touchModelIndices: [9],
            velocity: player.velocity
        });

        expect(vm.getEntityFloat(button, 'state')).toBe(2);
        expect(vm.getEntityVector(door, 'origin')).toEqual(initialDoorOrigin);
        for (let frame = 0; frame < 40 && vm.getEntityFloat(button, 'state') !== 0; frame++) {
            world.update(0.05);
        }
        expect(vm.getEntityFloat(button, 'state')).toBe(0);
        expect(vm.getEntityVector(door, 'velocity').some(component => component !== 0)).toBe(
            true
        );
        expect(world.soundEvents.some(event => (
            event.entity === door && event.sample === movingSound
        ))).toBe(true);
        world.update(0.05);
        expect(vm.getEntityVector(door, 'origin')).not.toEqual(initialDoorOrigin);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === 8
        )?.origin).toEqual(vm.getEntityVector(door, 'origin'));
    });

    it('counts and removes an E1M1 secret trigger through original QuakeC', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const secretIndex = map.entities.findIndex((entity, index) => {
            const reference = world.entityReferences[index];
            return entity.classname === 'trigger_secret' && reference !== null &&
                reference !== undefined && !vm.entity(reference).free;
        });
        const secret = world.entityReferences[secretIndex];
        if (secret === null || secret === undefined) {
            throw new Error('E1M1 has no active secret trigger');
        }
        const origin = vm.getEntityVector(secret, 'origin');
        const mins = vm.getEntityVector(secret, 'mins');
        const maxs = vm.getEntityVector(secret, 'maxs');
        const center = origin.map(
            (component, axis) => component + (mins[axis] + maxs[axis]) * 0.5
        ) as [number, number, number];
        const initialSecrets = vm.getGlobalFloat('found_secrets');

        world.update(0.01, {
            angles: [0, 0, 0],
            attack: false,
            jump: false,
            onGround: true,
            origin: center,
            velocity: [0, 0, 0]
        });

        expect(vm.getGlobalFloat('found_secrets')).toBe(initialSecrets + 1);
        expect(world.visibleCenterMessage()).not.toBe('');
        expect(world.soundEvents.some(event => event.sample === 'misc/secret.wav')).toBe(true);
        expect(vm.program.functions[vm.getEntityWord(secret, 'touch')].name).toBe('SUB_Null');
        world.update(0.1);
        world.update(0.01);
        expect(vm.entity(secret).free).toBe(true);
    });

    it('keeps base-Quake pushers translation-only when avelocity is set', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const pusher = vm.allocateEdict();
        vm.setEntityFloat(pusher, 'movetype', 7);
        vm.setEntityVector(pusher, 'angles', [10, 20, 30]);
        vm.setEntityVector(pusher, 'avelocity', [90, 180, 270]);
        vm.setEntityFloat(pusher, 'nextthink', 0.05);

        world.update(0.05);

        expect(vm.getEntityVector(pusher, 'angles')).toEqual([10, 20, 30]);
        expect(vm.getEntityFloat(pusher, 'ltime')).toBeCloseTo(0.05);
    });

    it('does not advance a pusher local clock without a scheduled think', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const pusher = vm.allocateEdict();
        vm.setEntityFloat(pusher, 'movetype', 7);
        vm.setEntityVector(pusher, 'velocity', [100, 0, 0]);

        world.update(0.05);

        expect(vm.getEntityVector(pusher, 'origin')).toEqual([0, 0, 0]);
        expect(vm.getEntityFloat(pusher, 'ltime')).toBe(0);
    });

    it('advances non-client MOVETYPE_NOCLIP origin and angles without collision', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const entity = vm.allocateEdict();
        vm.setEntityFloat(entity, 'movetype', 8);
        vm.setEntityVector(entity, 'origin', [1, 2, 3]);
        vm.setEntityVector(entity, 'angles', [10, 20, 30]);
        vm.setEntityVector(entity, 'velocity', [20, 40, 60]);
        vm.setEntityVector(entity, 'avelocity', [80, 100, 120]);

        world.update(0.05);

        expect(vm.getEntityVector(entity, 'origin')).toEqual([2, 4, 6]);
        expect(vm.getEntityVector(entity, 'angles')).toEqual([14, 25, 36]);
    });

    it('drops an entity onto a solid entity and records the real groundentity', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const spawnOrigin = vm.getEntityVector(world.playerReference, 'origin');
        const platform = vm.allocateEdict();
        vm.setEntityFloat(platform, 'solid', 2);
        vm.setEntityVector(platform, 'origin', [
            spawnOrigin[0], spawnOrigin[1], spawnOrigin[2] + 32
        ]);
        vm.setEntityVector(platform, 'mins', [-24, -24, -4]);
        vm.setEntityVector(platform, 'maxs', [24, 24, 4]);
        const dropper = vm.allocateEdict();
        vm.setEntityVector(dropper, 'origin', [
            spawnOrigin[0], spawnOrigin[1], spawnOrigin[2] + 80
        ]);
        vm.setEntityVector(dropper, 'mins', [-4, -4, -4]);
        vm.setEntityVector(dropper, 'maxs', [4, 4, 4]);
        const dropToFloor = vm.builtins.get(34);
        if (!dropToFloor) {
            throw new Error('droptofloor builtin is not registered');
        }

        vm.setGlobalWord('self', dropper);
        dropToFloor(vm, 0);

        expect(vm.values[1]).toBe(1);
        expect(vm.getEntityWord(dropper, 'groundentity')).toBe(platform);
        expect(Math.trunc(vm.getEntityFloat(dropper, 'flags')) & 512).toBe(512);
    });

    it('carries the player on an E1M1 platform pusher', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const platformIndex = map.entities.findIndex(entity => entity.classname === 'func_plat');
        const platform = world.entityReferences[platformIndex];
        if (platform === null || platform === undefined) {
            throw new Error('E1M1 platform was not spawned');
        }
        const platformOrigin = vm.getEntityVector(platform, 'origin');
        const platformMins = vm.getEntityVector(platform, 'mins');
        const platformMaxs = vm.getEntityVector(platform, 'maxs');
        expect(platformOrigin).toEqual([0, 0, -152]);
        expect(platformMins).toEqual([-592, 2624, -128]);
        expect(platformMaxs).toEqual([-496, 2688, 32]);
        const playerMins = vm.getEntityVector(world.playerReference, 'mins');
        // Linked abs bounds expand around this exact model/player contact by one unit.
        const playerOrigin: [number, number, number] = [
            platformOrigin[0] + (platformMins[0] + platformMaxs[0]) / 2,
            platformOrigin[1] + (platformMins[1] + platformMaxs[1]) / 2,
            platformOrigin[2] + platformMaxs[2] - playerMins[2]
        ];
        vm.setEntityVector(platform, 'velocity', [0, 0, 40]);
        vm.setEntityFloat(platform, 'nextthink', vm.getEntityFloat(platform, 'ltime') + 1);
        const modelIndex = Number(vm.getEntityString(platform, 'model').slice(1));

        const state = world.update(0.05, {
            angles: [0, 0, 0],
            attack: false,
            groundModelIndex: modelIndex,
            jump: false,
            onGround: true,
            origin: playerOrigin,
            velocity: [0, 0, 0]
        });

        const platformDisplacement = vm.getEntityVector(platform, 'origin')[2] -
            platformOrigin[2];
        expect(platformDisplacement).toBeGreaterThan(0);
        expect(vm.getEntityVector(world.playerReference, 'origin')[2]).toBeCloseTo(
            playerOrigin[2] + platformDisplacement
        );
        expect(vm.getEntityWord(world.playerReference, 'groundentity')).toBe(platform);
        expect(state.groundModelIndex).toBe(modelIndex);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === modelIndex
        )?.origin).toEqual(vm.getEntityVector(platform, 'origin'));
    });

    it('finds a moved E1M1 platform with the source point-sized edge trace', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const platformIndex = map.entities.findIndex(entity => entity.classname === 'func_plat');
        const platform = world.entityReferences[platformIndex];
        if (platform === null || platform === undefined) {
            throw new Error('E1M1 platform was not spawned');
        }
        const platformOrigin = vm.getEntityVector(platform, 'origin');
        const platformMins = vm.getEntityVector(platform, 'mins');
        const platformMaxs = vm.getEntityVector(platform, 'maxs');
        const playerMins = vm.getEntityVector(world.playerReference, 'mins');
        const modelIndex = Number(vm.getEntityString(platform, 'model').slice(1));
        const initialState = {
            angles: [0, 0, 0] as [number, number, number],
            attack: false,
            groundModelIndex: modelIndex,
            jump: false,
            onGround: true,
            origin: [
                platformOrigin[0] + (platformMins[0] + platformMaxs[0]) / 2,
                platformOrigin[1] + (platformMins[1] + platformMaxs[1]) / 2,
                platformOrigin[2] + platformMaxs[2] - playerMins[2]
            ] as [number, number, number],
            velocity: [200, 0, 0] as [number, number, number]
        };
        vm.setEntityVector(platform, 'velocity', [0, 0, 150]);
        vm.setEntityFloat(platform, 'nextthink', vm.getEntityFloat(platform, 'ltime') + 1);

        const state = world.update(0.05, initialState);

        const liveOrigin = vm.getEntityVector(platform, 'origin');
        expect(liveOrigin[2]).toBeCloseTo(platformOrigin[2] + 7.5);
        const leadingEdge: [number, number, number] = [
            state.origin[0] + 16,
            state.origin[1],
            state.origin[2] + playerMins[2]
        ];
        const trace = world.traceLine(leadingEdge, [
            leadingEdge[0], leadingEdge[1], leadingEdge[2] - 34
        ], true, world.playerReference).trace;

        expect(trace.fraction).toBeLessThan(1);
        expect(trace.modelIndex).toBe(modelIndex);
        expect(world.collision.brushColliders.find(
            collider => collider.modelIndex === modelIndex
        )?.origin).toEqual(liveOrigin);
    });

    it('activates and rides E1M1\'s platform through its authored center trigger', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const platformIndex = map.entities.findIndex(entity => entity.classname === 'func_plat');
        const platform = world.entityReferences[platformIndex];
        if (platform === null || platform === undefined) {
            throw new Error('E1M1 platform was not spawned');
        }
        const trigger = vm.edicts.findIndex((edict, reference) => {
            if (reference <= world.playerReference || edict.free ||
                vm.getEntityWord(reference, 'enemy') !== platform) {
                return false;
            }
            const touch = vm.getEntityWord(reference, 'touch');
            return touch !== 0 && vm.program.functions[touch]?.name === 'plat_center_touch';
        });
        if (trigger < 0) {
            throw new Error('E1M1 platform center trigger was not spawned');
        }
        const platformOrigin = vm.getEntityVector(platform, 'origin');
        const platformMins = vm.getEntityVector(platform, 'mins');
        const platformMaxs = vm.getEntityVector(platform, 'maxs');
        const playerMins = vm.getEntityVector(world.playerReference, 'mins');
        const playerOrigin: [number, number, number] = [
            platformOrigin[0] + (platformMins[0] + platformMaxs[0]) / 2,
            platformOrigin[1] + (platformMins[1] + platformMaxs[1]) / 2,
            platformOrigin[2] + platformMaxs[2] - playerMins[2]
        ];
        const modelIndex = Number(vm.getEntityString(platform, 'model').slice(1));
        world.soundEvents.length = 0;

        const result = world.update(0.05, {
            angles: [0, 0, 0],
            attack: false,
            groundModelIndex: modelIndex,
            jump: false,
            onGround: true,
            origin: playerOrigin,
            velocity: [0, 0, 0]
        });

        const platformPosition = vm.getEntityVector(platform, 'origin');
        const displacement = platformPosition[2] - platformOrigin[2];
        expect(vm.getEntityFloat(platform, 'state')).toBe(2);
        expect(vm.getEntityVector(platform, 'velocity')).toEqual([0, 0, 150]);
        expect(displacement).toBeCloseTo(7.5);
        expect(result.origin).toEqual([
            playerOrigin[0], playerOrigin[1], playerOrigin[2] + displacement
        ]);
        expect(result.groundModelIndex).toBe(modelIndex);
        expect(vm.getEntityWord(world.playerReference, 'groundentity')).toBe(platform);
        expect(world.soundEvents.map(event => `${event.entity}:${event.sample}`)).toContain(
            `${platform}:plats/plat1.wav`
        );
    });

    it('rolls back a blocked pusher and runs the original platform crush callback', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const platformIndex = map.entities.findIndex(entity => entity.classname === 'func_plat');
        const platform = world.entityReferences[platformIndex];
        if (platform === null || platform === undefined) {
            throw new Error('E1M1 platform was not spawned');
        }
        const platformOrigin: [number, number, number] = [10_000, 10_000, 10_000];
        const platformMins = vm.getEntityVector(platform, 'mins');
        const platformMaxs = vm.getEntityVector(platform, 'maxs');
        const oldLocalTime = vm.getEntityFloat(platform, 'ltime');
        vm.setEntityVector(platform, 'origin', platformOrigin);
        vm.setEntityVector(platform, 'velocity', [10, 0, 0]);
        vm.setEntityFloat(platform, 'nextthink', oldLocalTime + 1);
        vm.setEntityFloat(platform, 'state', 2);
        vm.setEntityFloat(platform, 'speed', 150);
        vm.setEntityVector(platform, 'pos2', [
            platformOrigin[0], platformOrigin[1], platformOrigin[2] - 30
        ]);
        expect(vm.getEntityWord(platform, 'blocked')).toBeGreaterThan(0);

        const carriedOrigin: [number, number, number] = [
            platformOrigin[0] + platformMaxs[0] + 0.25,
            platformOrigin[1] + (platformMins[1] + platformMaxs[1]) * 0.5,
            platformOrigin[2] + (platformMins[2] + platformMaxs[2]) * 0.5
        ];
        const carried = vm.allocateEdict();
        vm.setEntityFloat(carried, 'movetype', 3);
        vm.setEntityFloat(carried, 'solid', 2);
        vm.setEntityFloat(carried, 'takedamage', 2);
        vm.setEntityFloat(carried, 'health', 100);
        vm.setEntityVector(carried, 'origin', carriedOrigin);
        vm.setEntityVector(carried, 'mins', [-0.1, -0.1, -0.1]);
        vm.setEntityVector(carried, 'maxs', [0.1, 0.1, 0.1]);
        const blocker = vm.allocateEdict();
        vm.setEntityFloat(blocker, 'movetype', 0);
        vm.setEntityFloat(blocker, 'solid', 2);
        vm.setEntityVector(blocker, 'origin', [
            carriedOrigin[0] + 0.5, carriedOrigin[1], carriedOrigin[2]
        ]);
        vm.setEntityVector(blocker, 'mins', [-0.1, -0.1, -0.1]);
        vm.setEntityVector(blocker, 'maxs', [0.1, 0.1, 0.1]);

        world.update(0.05);

        expect(vm.getEntityVector(platform, 'origin')).toEqual(platformOrigin);
        expect(vm.getEntityFloat(platform, 'ltime')).toBe(oldLocalTime);
        expect(vm.getEntityVector(carried, 'origin')).toEqual(carriedOrigin);
        expect(vm.getEntityFloat(carried, 'health')).toBe(99);
        expect(vm.getEntityFloat(platform, 'state')).toBe(3);
        expect(vm.getEntityVector(platform, 'velocity')).toEqual([0, 0, -150]);
    });

    it('rolls back every earlier pusher occupant when a later occupant blocks', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const platformIndex = map.entities.findIndex(entity => entity.classname === 'func_plat');
        const platform = world.entityReferences[platformIndex];
        if (platform === null || platform === undefined) {
            throw new Error('E1M1 platform was not spawned');
        }
        const platformOrigin = vm.getEntityVector(platform, 'origin');
        const platformMins = vm.getEntityVector(platform, 'mins');
        const platformMaxs = vm.getEntityVector(platform, 'maxs');
        const oldLocalTime = vm.getEntityFloat(platform, 'ltime');
        vm.setEntityVector(platform, 'velocity', [0, 0, 40]);
        vm.setEntityFloat(platform, 'nextthink', oldLocalTime + 1);
        vm.setEntityFloat(platform, 'state', 2);
        vm.setEntityFloat(platform, 'speed', 150);
        vm.setEntityVector(platform, 'pos2', [
            platformOrigin[0], platformOrigin[1], platformOrigin[2] - 30
        ]);

        const createOccupant = (origin: [number, number, number]): number => {
            const reference = vm.allocateEdict();
            vm.setEntityFloat(reference, 'movetype', 3);
            vm.setEntityFloat(reference, 'solid', 2);
            vm.setEntityFloat(reference, 'takedamage', 2);
            vm.setEntityFloat(reference, 'health', 100);
            vm.setEntityFloat(reference, 'flags', 512);
            vm.setEntityWord(reference, 'groundentity', platform);
            vm.setEntityVector(reference, 'origin', origin);
            vm.setEntityVector(reference, 'mins', [-16, -16, -24]);
            vm.setEntityVector(reference, 'maxs', [16, 16, 32]);
            return reference;
        };
        const firstOrigin: [number, number, number] = [
            platformOrigin[0] + (platformMins[0] + platformMaxs[0]) * 0.5 - 20,
            platformOrigin[1] + (platformMins[1] + platformMaxs[1]) * 0.5,
            platformOrigin[2] + platformMaxs[2] + 24
        ];
        const secondOrigin: [number, number, number] = [
            platformOrigin[0] + (platformMins[0] + platformMaxs[0]) * 0.5 + 20,
            platformOrigin[1] + (platformMins[1] + platformMaxs[1]) * 0.5,
            platformOrigin[2] + platformMaxs[2] + 24
        ];
        const firstOccupant = createOccupant(firstOrigin);
        const secondOccupant = createOccupant(secondOrigin);
        const blocker = vm.allocateEdict();
        vm.setEntityFloat(blocker, 'movetype', 0);
        vm.setEntityFloat(blocker, 'solid', 2);
        vm.setEntityVector(blocker, 'origin', [
            secondOrigin[0], secondOrigin[1], secondOrigin[2] + 33
        ]);
        vm.setEntityVector(blocker, 'mins', [-16, -16, 0]);
        vm.setEntityVector(blocker, 'maxs', [16, 16, 4]);

        world.update(0.05);

        expect(vm.getEntityVector(platform, 'origin')).toEqual(platformOrigin);
        expect(vm.getEntityFloat(platform, 'ltime')).toBe(oldLocalTime);
        expect(vm.getEntityVector(firstOccupant, 'origin')).toEqual(firstOrigin);
        expect(vm.getEntityVector(secondOccupant, 'origin')).toEqual(secondOrigin);
        expect([
            vm.getEntityFloat(firstOccupant, 'health'),
            vm.getEntityFloat(secondOccupant, 'health')
        ]).toEqual([100, 99]);
        expect(Math.trunc(vm.getEntityFloat(firstOccupant, 'flags')) & 512).toBe(512);
        expect(Math.trunc(vm.getEntityFloat(secondOccupant, 'flags')) & 512).toBe(512);
        expect(vm.getEntityWord(firstOccupant, 'groundentity')).toBe(platform);
        expect(vm.getEntityWord(secondOccupant, 'groundentity')).toBe(platform);
        expect(vm.getEntityFloat(platform, 'state')).toBe(3);
        expect(vm.getEntityVector(platform, 'velocity')).toEqual([0, 0, -150]);
    });

    it('keeps a crushed corpse bbox collapsed while rolling a mixed pusher chain back', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const platformIndex = map.entities.findIndex(entity => entity.classname === 'func_plat');
        const platform = world.entityReferences[platformIndex];
        if (platform === null || platform === undefined) {
            throw new Error('E1M1 platform was not spawned');
        }
        const platformOrigin = vm.getEntityVector(platform, 'origin');
        const platformMins = vm.getEntityVector(platform, 'mins');
        const platformMaxs = vm.getEntityVector(platform, 'maxs');
        const oldLocalTime = vm.getEntityFloat(platform, 'ltime');
        vm.setEntityVector(platform, 'velocity', [0, 0, 40]);
        vm.setEntityFloat(platform, 'nextthink', oldLocalTime + 1);
        vm.setEntityFloat(platform, 'state', 2);
        vm.setEntityFloat(platform, 'speed', 150);
        vm.setEntityVector(platform, 'pos2', [
            platformOrigin[0], platformOrigin[1], platformOrigin[2] - 30
        ]);

        const centerX = platformOrigin[0] +
            (platformMins[0] + platformMaxs[0]) * 0.5;
        const centerY = platformOrigin[1] +
            (platformMins[1] + platformMaxs[1]) * 0.5;
        const riderZ = platformOrigin[2] + platformMaxs[2] + 24;
        const createOccupant = (
            origin: [number, number, number],
            moveType: number,
            solid: number,
            flags: number
        ): number => {
            const reference = vm.allocateEdict();
            vm.setEntityFloat(reference, 'movetype', moveType);
            vm.setEntityFloat(reference, 'solid', solid);
            vm.setEntityFloat(reference, 'flags', flags);
            vm.setEntityWord(reference, 'groundentity', platform);
            vm.setEntityVector(reference, 'origin', origin);
            vm.setEntityVector(reference, 'mins', [-16, -16, -24]);
            vm.setEntityVector(reference, 'maxs', [16, 16, 32]);
            return reference;
        };
        const firstOrigin: [number, number, number] = [centerX - 32, centerY, riderZ];
        const corpseOrigin: [number, number, number] = [centerX, centerY, riderZ];
        const blockerOrigin: [number, number, number] = [centerX + 32, centerY, riderZ];
        const firstOccupant = createOccupant(firstOrigin, 3, 2, 512);
        const corpse = createOccupant(corpseOrigin, 4, 0, 513);
        const blockingOccupant = createOccupant(blockerOrigin, 4, 2, 513);
        vm.setEntityFloat(blockingOccupant, 'takedamage', 2);
        vm.setEntityFloat(blockingOccupant, 'health', 100);
        for (const origin of [corpseOrigin, blockerOrigin]) {
            const ceiling = vm.allocateEdict();
            vm.setEntityFloat(ceiling, 'movetype', 0);
            vm.setEntityFloat(ceiling, 'solid', 2);
            vm.setEntityVector(ceiling, 'origin', [origin[0], origin[1], origin[2] + 33]);
            vm.setEntityVector(ceiling, 'mins', [-15, -15, 0]);
            vm.setEntityVector(ceiling, 'maxs', [15, 15, 4]);
        }

        world.update(0.05);

        expect(vm.getEntityVector(platform, 'origin')).toEqual(platformOrigin);
        expect(vm.getEntityFloat(platform, 'ltime')).toBe(oldLocalTime);
        expect(vm.getEntityVector(firstOccupant, 'origin')).toEqual(firstOrigin);
        expect(vm.getEntityVector(corpse, 'origin')).toEqual(corpseOrigin);
        expect(vm.getEntityVector(blockingOccupant, 'origin')).toEqual(blockerOrigin);
        expect(vm.getEntityVector(corpse, 'mins')).toEqual([0, 0, -24]);
        expect(vm.getEntityVector(corpse, 'maxs')).toEqual([0, 0, -24]);
        expect(Math.trunc(vm.getEntityFloat(firstOccupant, 'flags'))).toBe(512);
        expect(Math.trunc(vm.getEntityFloat(corpse, 'flags'))).toBe(1);
        expect(Math.trunc(vm.getEntityFloat(blockingOccupant, 'flags'))).toBe(1);
        expect(vm.getEntityWord(firstOccupant, 'groundentity')).toBe(platform);
        expect(vm.getEntityWord(corpse, 'groundentity')).toBe(platform);
        expect(vm.getEntityWord(blockingOccupant, 'groundentity')).toBe(platform);
        expect(vm.getEntityFloat(blockingOccupant, 'health')).toBe(99);
        expect(vm.getEntityFloat(platform, 'state')).toBe(3);
        expect(vm.getEntityVector(platform, 'velocity')).toEqual([0, 0, -150]);
    });

    it('collapses a blocked SOLID_TRIGGER without rolling back its E1M1 lift chain', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const platformIndex = map.entities.findIndex(entity => entity.classname === 'func_plat');
        const platform = world.entityReferences[platformIndex];
        if (platform === null || platform === undefined) {
            throw new Error('E1M1 platform was not spawned');
        }
        const platformOrigin = vm.getEntityVector(platform, 'origin');
        const platformMins = vm.getEntityVector(platform, 'mins');
        const platformMaxs = vm.getEntityVector(platform, 'maxs');
        const oldLocalTime = vm.getEntityFloat(platform, 'ltime');
        vm.setEntityVector(platform, 'velocity', [0, 0, 40]);
        vm.setEntityFloat(platform, 'nextthink', oldLocalTime + 1);
        vm.setEntityFloat(platform, 'state', 2);

        const centerX = platformOrigin[0] +
            (platformMins[0] + platformMaxs[0]) * 0.5;
        const centerY = platformOrigin[1] +
            (platformMins[1] + platformMaxs[1]) * 0.5;
        const riderZ = platformOrigin[2] + platformMaxs[2] + 24;
        const createOccupant = (
            origin: [number, number, number],
            moveType: number,
            solid: number
        ): number => {
            const reference = vm.allocateEdict();
            vm.setEntityFloat(reference, 'movetype', moveType);
            vm.setEntityFloat(reference, 'solid', solid);
            vm.setEntityFloat(reference, 'flags', 512);
            vm.setEntityWord(reference, 'groundentity', platform);
            vm.setEntityVector(reference, 'origin', origin);
            vm.setEntityVector(reference, 'mins', [-6, -6, -24]);
            vm.setEntityVector(reference, 'maxs', [6, 6, 32]);
            return reference;
        };
        const riderOrigins = [-36, -18, 0, 18].map(offset => (
            [centerX + offset, centerY, riderZ] as [number, number, number]
        ));
        const riders = riderOrigins.map(origin => createOccupant(origin, 3, 2));
        const triggerOrigin: [number, number, number] = [centerX + 36, centerY, riderZ];
        const trigger = createOccupant(triggerOrigin, 4, 1);
        vm.setEntityFloat(trigger, 'takedamage', 2);
        vm.setEntityFloat(trigger, 'health', 100);
        const ceiling = vm.allocateEdict();
        vm.setEntityFloat(ceiling, 'movetype', 0);
        vm.setEntityFloat(ceiling, 'solid', 2);
        vm.setEntityVector(ceiling, 'origin', [
            triggerOrigin[0], triggerOrigin[1], triggerOrigin[2] + 33
        ]);
        vm.setEntityVector(ceiling, 'mins', [-5, -5, 0]);
        vm.setEntityVector(ceiling, 'maxs', [5, 5, 4]);

        world.update(0.05);

        expect(vm.getEntityVector(platform, 'origin')).toEqual([
            platformOrigin[0], platformOrigin[1], platformOrigin[2] + 2
        ]);
        expect(vm.getEntityFloat(platform, 'ltime')).toBeCloseTo(oldLocalTime + 0.05);
        expect(vm.getEntityVector(platform, 'velocity')).toEqual([0, 0, 40]);
        expect(riders.map(reference => vm.getEntityVector(reference, 'origin'))).toEqual(
            riderOrigins.map(origin => [origin[0], origin[1], origin[2] + 2])
        );
        expect(vm.getEntityVector(trigger, 'origin')).toEqual([
            triggerOrigin[0], triggerOrigin[1], triggerOrigin[2] + 1
        ]);
        expect(vm.getEntityVector(trigger, 'mins')).toEqual([0, 0, -24]);
        expect(vm.getEntityVector(trigger, 'maxs')).toEqual([0, 0, -24]);
        expect(Math.trunc(vm.getEntityFloat(trigger, 'flags')) & 512).toBe(0);
        expect(vm.getEntityWord(trigger, 'groundentity')).toBe(platform);
        expect(vm.getEntityFloat(trigger, 'health')).toBe(100);
    });

    it('runs a carried entity impact before deciding whether its pusher is blocked', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const platformIndex = map.entities.findIndex(entity => entity.classname === 'func_plat');
        const platform = world.entityReferences[platformIndex];
        const remove = vm.program.functionsByName.get('SUB_Remove');
        if (platform === null || platform === undefined || !remove) {
            throw new Error('E1M1 platform or SUB_Remove was not spawned');
        }
        const platformOrigin: [number, number, number] = [11_000, 11_000, 11_000];
        const platformMins = vm.getEntityVector(platform, 'mins');
        const platformMaxs = vm.getEntityVector(platform, 'maxs');
        const oldLocalTime = vm.getEntityFloat(platform, 'ltime');
        vm.setEntityVector(platform, 'origin', platformOrigin);
        vm.setEntityVector(platform, 'velocity', [10, 0, 0]);
        vm.setEntityFloat(platform, 'nextthink', oldLocalTime + 1);
        vm.setEntityWord(platform, 'blocked', 0);

        const carriedOrigin: [number, number, number] = [
            platformOrigin[0] + platformMaxs[0] + 0.25,
            platformOrigin[1] + (platformMins[1] + platformMaxs[1]) * 0.5,
            platformOrigin[2] + (platformMins[2] + platformMaxs[2]) * 0.5
        ];
        const carried = vm.allocateEdict();
        vm.setEntityFloat(carried, 'movetype', 3);
        vm.setEntityFloat(carried, 'solid', 2);
        vm.setEntityWord(carried, 'touch', remove.index);
        vm.setEntityVector(carried, 'origin', carriedOrigin);
        vm.setEntityVector(carried, 'mins', [-0.1, -0.1, -0.1]);
        vm.setEntityVector(carried, 'maxs', [0.1, 0.1, 0.1]);
        const blocker = vm.allocateEdict();
        vm.setEntityFloat(blocker, 'movetype', 0);
        vm.setEntityFloat(blocker, 'solid', 2);
        vm.setEntityVector(blocker, 'origin', [
            carriedOrigin[0] + 0.5, carriedOrigin[1], carriedOrigin[2]
        ]);
        vm.setEntityVector(blocker, 'mins', [-0.1, -0.1, -0.1]);
        vm.setEntityVector(blocker, 'maxs', [0.1, 0.1, 0.1]);

        world.update(0.05);

        expect(vm.entity(carried).free).toBe(true);
        expect(vm.getEntityVector(platform, 'origin')).toEqual([
            platformOrigin[0] + 0.5, platformOrigin[1], platformOrigin[2]
        ]);
        expect(vm.getEntityFloat(platform, 'ltime')).toBeCloseTo(oldLocalTime + 0.05);
    });

    it('allows a pusher occupant to finish exactly flush with another solid bbox', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const platformIndex = map.entities.findIndex(entity => entity.classname === 'func_plat');
        const platform = world.entityReferences[platformIndex];
        if (platform === null || platform === undefined) {
            throw new Error('E1M1 platform was not spawned');
        }
        const platformOrigin = vm.getEntityVector(platform, 'origin');
        const oldLocalTime = vm.getEntityFloat(platform, 'ltime');
        vm.setEntityVector(platform, 'velocity', [0, 0, 40]);
        vm.setEntityFloat(platform, 'nextthink', oldLocalTime + 1);
        vm.setEntityWord(platform, 'blocked', 0);
        const platformMins = vm.getEntityVector(platform, 'mins');
        const platformMaxs = vm.getEntityVector(platform, 'maxs');
        const carriedOrigin: [number, number, number] = [
            platformOrigin[0] + (platformMins[0] + platformMaxs[0]) * 0.5,
            platformOrigin[1] + (platformMins[1] + platformMaxs[1]) * 0.5,
            platformOrigin[2] + platformMaxs[2] + 2
        ];
        const carried = vm.allocateEdict();
        vm.setEntityFloat(carried, 'movetype', 3);
        vm.setEntityFloat(carried, 'solid', 2);
        vm.setEntityFloat(carried, 'flags', 512);
        vm.setEntityWord(carried, 'groundentity', platform);
        vm.setEntityVector(carried, 'origin', carriedOrigin);
        vm.setEntityVector(carried, 'mins', [-1, -1, -1]);
        vm.setEntityVector(carried, 'maxs', [1, 1, 1]);
        const blocker = vm.allocateEdict();
        vm.setEntityFloat(blocker, 'movetype', 0);
        vm.setEntityFloat(blocker, 'solid', 2);
        vm.setEntityVector(blocker, 'origin', [
            carriedOrigin[0], carriedOrigin[1], carriedOrigin[2] + 4
        ]);
        vm.setEntityVector(blocker, 'mins', [-1, -1, -1]);
        vm.setEntityVector(blocker, 'maxs', [1, 1, 1]);

        world.update(0.05);

        expect(vm.getEntityVector(platform, 'origin')).toEqual([
            platformOrigin[0], platformOrigin[1], platformOrigin[2] + 2
        ]);
        expect(vm.getEntityVector(carried, 'origin')).toEqual([
            carriedOrigin[0], carriedOrigin[1], carriedOrigin[2] + 2
        ]);
    });

    it('uses linked expanded bounds for the source monster close-enough test', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const actor = vm.allocateEdict();
        const goal = vm.allocateEdict();
        vm.setEntityFloat(actor, 'flags', 512);
        vm.setEntityWord(actor, 'goalentity', goal);
        vm.setEntityWord(actor, 'enemy', goal);
        vm.setEntityVector(actor, 'absmin', [9_998, 9_998, 9_998]);
        vm.setEntityVector(actor, 'absmax', [10_002, 10_002, 10_002]);
        vm.setEntityVector(goal, 'absmin', [10_003, 9_998, 9_998]);
        vm.setEntityVector(goal, 'absmax', [10_007, 10_002, 10_002]);
        let attemptedStep = false;
        world.moveStep = () => {
            attemptedStep = true;
            return true;
        };

        world.moveToGoal(actor, 1);

        expect(attemptedStep).toBe(false);
    });

    it('fires the starting shotgun through the original player weapon code', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const { player, playerState, soldier, yaw } = prepareE1m1SoldierShot(world);
        const initialAmmo = vm.getEntityFloat(player, 'currentammo');
        const initialSoldierHealth = vm.getEntityFloat(soldier, 'health');

        world.update(0.05, {
            angles: [0, yaw, 0],
            attack: true,
            jump: false,
            onGround: true,
            origin: playerState.origin,
            velocity: playerState.velocity
        });

        expect(vm.getEntityFloat(player, 'currentammo')).toBe(initialAmmo - 1);
        expect(vm.getEntityFloat(player, 'weaponframe')).toBeGreaterThan(0);
        expect(Math.trunc(vm.getEntityFloat(player, 'effects')) & 2).toBe(0);
        expect(world.activeDynamicLights().some(light => light.key === player)).toBe(true);
        expect(world.soundEvents.some(event => event.sample === 'weapons/guncock.wav')).toBe(true);
        expect(vm.getEntityFloat(soldier, 'health') < initialSoldierHealth ||
            vm.getEntityFloat(soldier, 'takedamage') === 0
        ).toBe(true);
        expect(vm.getEntityVector(player, 'punchangle')[0]).toBeLessThan(0);
    });

    it('carries a real E1M1 soldier through shotgun pain and non-gib death', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        world.toggleNoTarget();
        const { player, playerState, soldier, yaw } = prepareE1m1SoldierShot(world);
        const input = (attack: boolean) => ({
            angles: [0, yaw, 0] as [number, number, number],
            attack,
            jump: false,
            onGround: true,
            origin: playerState.origin,
            velocity: playerState.velocity
        });
        vm.setEntityFloat(soldier, 'health', 100);
        vm.setEntityFloat(soldier, 'pain_finished', 0);
        vm.setEntityFloat(soldier, 'pausetime', 100_000_000);
        vm.setEntityWord(soldier, 'enemy', 0);
        world.soundEvents.length = 0;

        world.update(0.05, input(true));

        const painHealth = vm.getEntityFloat(soldier, 'health');
        const painThink = vm.program.functions[vm.getEntityWord(soldier, 'think')].name;
        expect(painHealth).toBeLessThan(100);
        expect(painHealth).toBeGreaterThan(0);
        expect(painThink).toMatch(/^army_pain(?:b|c)?\d+$/);
        expect(vm.getEntityFloat(soldier, 'takedamage')).toBe(2);
        expect(vm.getEntityFloat(soldier, 'solid')).toBe(3);
        expect(world.soundEvents.some(event => (
            event.entity === soldier && /^soldier\/pain[12]\.wav$/.test(event.sample)
        ))).toBe(true);

        const attackFinished = vm.getEntityFloat(player, 'attack_finished');
        while (world.time <= attackFinished + 0.05) {
            world.update(0.05, input(false));
        }
        vm.setEntityFloat(soldier, 'health', 1);
        world.soundEvents.length = 0;
        world.update(0.05, input(true));

        const deathThink = vm.program.functions[vm.getEntityWord(soldier, 'think')].name;
        expect(vm.getEntityFloat(soldier, 'health')).toBeLessThanOrEqual(0);
        expect(vm.getEntityFloat(soldier, 'health')).toBeGreaterThan(-35);
        expect(vm.getEntityFloat(soldier, 'takedamage')).toBe(0);
        expect(vm.getEntityFloat(soldier, 'solid')).toBe(3);
        expect(vm.getEntityFloat(soldier, 'movetype')).toBe(4);
        expect(vm.getEntityString(soldier, 'model')).toBe('progs/soldier.mdl');
        expect(deathThink).toMatch(/^army_c?die\d+$/);
        expect(vm.getGlobalFloat('killed_monsters')).toBe(1);
        expect(world.soundEvents.some(event => (
            event.entity === soldier && event.sample === 'soldier/death1.wav'
        ))).toBe(true);

        for (let frame = 0; frame < 30; frame++) {
            world.update(0.05, input(false));
        }
        const corpseThink = vm.program.functions[vm.getEntityWord(soldier, 'think')].name;
        expect(vm.entity(soldier).free).toBe(false);
        expect(vm.getEntityFloat(soldier, 'solid')).toBe(0);
        expect(corpseThink).toMatch(/^army_c?die1[01]$/);
    });

    it('carries a real E1M1 dog through shotgun pain and non-gib death', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        world.toggleNoTarget();
        const { dog, player, playerState, yaw } = prepareE1m1DogShot(world);
        const input = (attack: boolean) => ({
            angles: [0, yaw, 0] as [number, number, number],
            attack,
            jump: false,
            onGround: true,
            origin: playerState.origin,
            velocity: playerState.velocity
        });
        vm.setEntityFloat(dog, 'health', 100);
        vm.setEntityFloat(dog, 'pain_finished', 0);
        vm.setEntityFloat(dog, 'pausetime', 100_000_000);
        vm.setEntityWord(dog, 'enemy', 0);
        world.soundEvents.length = 0;

        world.update(0.05, input(true));

        const painHealth = vm.getEntityFloat(dog, 'health');
        const painThink = vm.program.functions[vm.getEntityWord(dog, 'think')].name;
        expect(painHealth).toBeLessThan(100);
        expect(painHealth).toBeGreaterThan(0);
        expect(painThink).toMatch(/^dog_painb?\d+$/);
        expect(vm.getEntityFloat(dog, 'takedamage')).toBe(2);
        expect(vm.getEntityFloat(dog, 'solid')).toBe(3);
        expect(world.soundEvents.some(event => (
            event.entity === dog && event.sample === 'dog/dpain1.wav'
        ))).toBe(true);

        const attackFinished = vm.getEntityFloat(player, 'attack_finished');
        while (world.time <= attackFinished + 0.05) {
            world.update(0.05, input(false));
        }
        vm.setEntityFloat(dog, 'health', 1);
        world.soundEvents.length = 0;
        world.update(0.05, input(true));

        const deathThink = vm.program.functions[vm.getEntityWord(dog, 'think')].name;
        expect(vm.getEntityFloat(dog, 'health')).toBeLessThanOrEqual(0);
        expect(vm.getEntityFloat(dog, 'health')).toBeGreaterThan(-35);
        expect(vm.getEntityFloat(dog, 'takedamage')).toBe(0);
        expect(vm.getEntityFloat(dog, 'solid')).toBe(0);
        expect(vm.getEntityFloat(dog, 'movetype')).toBe(4);
        expect(vm.getEntityString(dog, 'model')).toBe('progs/dog.mdl');
        expect(deathThink).toMatch(/^dog_dieb?\d+$/);
        expect(vm.getGlobalFloat('killed_monsters')).toBe(1);
        expect(world.soundEvents.some(event => (
            event.entity === dog && event.sample === 'dog/ddeath.wav'
        ))).toBe(true);

        for (let frame = 0; frame < 30; frame++) {
            world.update(0.05, input(false));
        }
        const corpseThink = vm.program.functions[vm.getEntityWord(dog, 'think')].name;
        expect(vm.entity(dog).free).toBe(false);
        expect(vm.getEntityFloat(dog, 'solid')).toBe(0);
        expect(corpseThink).toMatch(/^dog_dieb?\d+$/);
    });

    it('shoots E1M1\'s explosive box through its original radius-damage path', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm, map, new WorldCollision(map), 'e1m1', undefined, pak
        );
        world.update(0.1);
        world.update(0.01);
        const player = world.playerReference;
        const playerState = world.playerResult();
        const barrel = world.entityReferences.find((reference, index) => {
            return map.entities[index].classname === 'misc_explobox' && reference !== null &&
                !vm.entity(reference).free &&
                vm.getEntityString(reference, 'model') === 'maps/b_explob.bsp';
        });
        const setOrigin = vm.builtins.get(2);
        if (barrel === null || barrel === undefined || !setOrigin) {
            throw new Error('E1M1 explosive box or setorigin builtin is unavailable');
        }
        const playerMins = vm.getEntityVector(player, 'mins');
        const playerMaxs = vm.getEntityVector(player, 'maxs');
        const shotHeight = playerState.origin[2] + playerMins[2] - 1 +
            (playerMaxs[2] - playerMins[2]) * 0.7;
        let yaw = 0;
        let shotSource: [number, number, number] | undefined;
        let barrelCenter: [number, number, number] | undefined;
        for (let candidateYaw = 0; candidateYaw < 360; candidateYaw += 45) {
            const radians = candidateYaw * Math.PI / 180;
            const forward: [number, number, number] = [
                Math.cos(radians), Math.sin(radians), 0
            ];
            const candidateSource: [number, number, number] = [
                playerState.origin[0] + forward[0] * 10,
                playerState.origin[1] + forward[1] * 10,
                shotHeight
            ];
            const clearTrace = world.traceLine(candidateSource, [
                candidateSource[0] + forward[0] * 2_048,
                candidateSource[1] + forward[1] * 2_048,
                candidateSource[2]
            ], false, player);
            if (clearTrace.trace.fraction * 2_048 <= 128) continue;
            yaw = candidateYaw;
            shotSource = candidateSource;
            barrelCenter = [
                candidateSource[0] + forward[0] * 64,
                candidateSource[1] + forward[1] * 64,
                candidateSource[2]
            ];
            break;
        }
        if (!shotSource || !barrelCenter) {
            throw new Error('E1M1 spawn has no clear explosive-box test direction');
        }
        const barrelMins = vm.getEntityVector(barrel, 'mins');
        const barrelMaxs = vm.getEntityVector(barrel, 'maxs');
        expect(barrelMins).toEqual([0, 0, 0]);
        expect(barrelMaxs).toEqual([32, 32, 64]);
        vm.words[4] = barrel;
        vm.values.set(barrelCenter.map(
            (component, axis) => component - (barrelMins[axis] + barrelMaxs[axis]) / 2
        ), 7);
        setOrigin(vm, 2);
        const barrelTrace = world.traceLine(shotSource, barrelCenter, false, player);
        expect(barrelTrace.entity).toBe(barrel);
        const initialHealth = vm.getEntityFloat(player, 'health');

        world.update(0.05, {
            angles: [0, yaw, 0],
            attack: true,
            jump: false,
            onGround: true,
            origin: playerState.origin,
            velocity: playerState.velocity
        });

        expect(vm.entity(barrel).free).toBe(false);
        expect(vm.getEntityString(barrel, 'classname')).toBe('explo_box');
        expect(vm.getEntityFloat(barrel, 'takedamage')).toBe(0);
        expect(vm.getEntityFloat(barrel, 'nextthink')).toBeGreaterThan(world.time);

        let sawExplosionSprite = false;
        for (let tick = 0; tick < 20 && !vm.entity(barrel).free; tick++) {
            world.update(0.05);
            sawExplosionSprite ||= vm.getEntityString(barrel, 'model') ===
                'progs/s_explod.spr';
        }

        expect(vm.entity(barrel).free).toBe(true);
        expect(vm.getEntityFloat(player, 'health')).toBeLessThan(initialHealth);
        expect(sawExplosionSprite).toBe(true);
        expect(world.soundEvents.some(event => event.sample === 'weapons/r_exp3.wav')).toBe(true);
        expect(world.particleEvents.some(event => event.kind === 'explosion')).toBe(false);
    });

    it('moves and impacts a rocket spawned by the original QuakeC weapon code', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const player = world.playerReference;
        vm.setGlobalWord('self', player);
        vm.setEntityVector(player, 'v_angle', [0, 0, 0]);
        vm.execute('W_FireRocket');

        const rocket = vm.edicts.findIndex((edict, reference) => reference > 1 &&
            !edict.free && vm.getEntityString(reference, 'model') === 'progs/missile.mdl'
        );
        expect(rocket).toBeGreaterThan(1);
        expect(vm.getEntityWord(rocket, 'owner')).toBe(player);
        expect(vm.getEntityString(rocket, 'model')).toBe('progs/missile.mdl');
        expect(vm.getEntityFloat(rocket, 'movetype')).toBe(9);
        expect(Math.hypot(...vm.getEntityVector(rocket, 'velocity'))).toBeCloseTo(1_000);

        const launchOrigin = vm.getEntityVector(rocket, 'origin');
        world.update(0.01);
        expect(vm.entity(rocket).free).toBe(false);
        expect(Math.hypot(...vm.getEntityVector(rocket, 'origin').map(
            (component, axis) => component - launchOrigin[axis]
        ))).toBeGreaterThan(5);

        const soldier = world.entityReferences.find((reference, index) => {
            return map.entities[index].classname === 'monster_army' && reference !== null &&
                !vm.entity(reference).free &&
                vm.getEntityString(reference, 'model') === 'progs/soldier.mdl';
        });
        if (soldier === null || soldier === undefined) {
            throw new Error('E1M1 soldier was not spawned');
        }
        const soldierOrigin = vm.getEntityVector(soldier, 'origin');
        const soldierMins = vm.getEntityVector(soldier, 'mins');
        const soldierMaxs = vm.getEntityVector(soldier, 'maxs');
        const impactStart: [number, number, number] = [
            soldierOrigin[0] + soldierMins[0] - 16,
            soldierOrigin[1] + soldierMaxs[1] + 10,
            soldierOrigin[2] + (soldierMins[2] + soldierMaxs[2]) / 2
        ];
        vm.setEntityVector(rocket, 'origin', impactStart);
        vm.setEntityVector(rocket, 'velocity', [1_000, 0, 0]);
        const initialSoldierHealth = vm.getEntityFloat(soldier, 'health');
        const impactEnd: [number, number, number] = [
            impactStart[0] + 10, impactStart[1], impactStart[2]
        ];
        expect(world.traceLine(
            impactStart,
            impactEnd,
            false,
            rocket,
            player
        ).entity).not.toBe(soldier);
        expect(world.traceLine(
            impactStart,
            impactEnd,
            false,
            rocket,
            player,
            true
        ).entity).toBe(soldier);

        world.update(0.01);

        expect(vm.entity(rocket).free).toBe(false);
        expect(vm.getEntityString(rocket, 'model')).toBe('progs/s_explod.spr');
        expect(vm.getEntityFloat(rocket, 'movetype')).toBe(0);
        expect(vm.getEntityFloat(soldier, 'health')).toBeLessThan(initialSoldierHealth);
        expect(world.soundEvents.some(event => event.sample === 'weapons/r_exp3.wav')).toBe(true);

        const explosionFrame = vm.getEntityFloat(rocket, 'frame');
        world.update(0.1);
        world.update(0.01);
        expect(vm.getEntityFloat(rocket, 'frame')).toBeGreaterThan(explosionFrame);
        for (let tick = 0; tick < 10 && !vm.entity(rocket).free; tick++) {
            world.update(0.1);
        }
        expect(vm.entity(rocket).free).toBe(true);
    });

    it('reports an inline BSP button as the trace entity', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const buttonIndex = map.entities.findIndex(
            entity => entity.classname === 'func_button' && !entity.health
        );
        const button = world.entityReferences[buttonIndex];
        if (button === null || button === undefined) {
            throw new Error('E1M1 button was not spawned');
        }
        const origin = vm.getEntityVector(button, 'origin');
        const minimum = vm.getEntityVector(button, 'mins').map(
            (component, axis) => component + origin[axis]
        ) as [number, number, number];
        const maximum = vm.getEntityVector(button, 'maxs').map(
            (component, axis) => component + origin[axis]
        ) as [number, number, number];
        const center = minimum.map(
            (component, axis) => (component + maximum[axis]) / 2
        ) as [number, number, number];
        let hitButton = false;
        for (let axis = 0; axis < 3 && !hitButton; axis++) {
            for (const side of [-1, 1]) {
                const start: [number, number, number] = [...center];
                start[axis] = side < 0 ? minimum[axis] - 2 : maximum[axis] + 2;
                if (world.traceLine(start, center, true, world.playerReference).entity === button) {
                    hitButton = true;
                    break;
                }
            }
        }
        expect(hitButton).toBe(true);
        expect(vm.program.functions[vm.getEntityWord(button, 'touch')].name).toBe('button_touch');
        const modelIndex = Number(vm.getEntityString(button, 'model').slice(1));
        expect(vm.getEntityFloat(button, 'modelindex')).toBe(modelIndex + 1);
        const buttonModel = map.models[modelIndex];
        const buttonTextures = map.faces.slice(
            buttonModel.firstFace,
            buttonModel.firstFace + buttonModel.faceCount
        ).map(face => map.textures[map.textureInfo[face.textureInfo].texture]?.name);
        expect(buttonTextures).toContain('+0basebtn');
        const player = world.playerResult();
        const destination = vm.getEntityVector(button, 'pos2');
        world.update(0.01, {
            angles: player.angles,
            attack: false,
            jump: false,
            onGround: true,
            origin: player.origin,
            touchModelIndices: [modelIndex],
            velocity: player.velocity
        });
        expect(vm.getEntityFloat(button, 'state')).toBe(2);
        expect(vm.getEntityFloat(button, 'frame')).toBe(0);
        expect(vm.getEntityFloat(button, 'nextthink')).toBeGreaterThan(0);
        expect(world.soundEvents.some(event => event.entity === button)).toBe(true);
        world.update(0.1);
        expect(vm.getEntityVector(button, 'origin')).toEqual(destination);
        expect(vm.getEntityFloat(button, 'state')).toBe(0);
        expect(vm.getEntityFloat(button, 'frame')).toBe(1);
    });

    it.each([
        {
            models: ['*1', '*2'],
            triggerBounds: [[147, 451, -9], [317, 701, 137]]
        },
        {
            models: ['*5', '*6'],
            triggerBounds: [[3, 1715, -217], [253, 1885, -71]]
        }
    ] as const)(
        'opens E1M1 auto-door group $models with original sounds',
        ({ models, triggerBounds }) => {
            const map = new BspMap(pak.get('maps/e1m1.bsp'));
            const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
            const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
            for (let tick = 0; tick < 3; tick++) {
                world.update(0.05);
            }
            const triggers = vm.edicts.flatMap((edict, reference) => {
                if (reference <= world.playerReference || edict.free) return [];
                const touch = vm.getEntityWord(reference, 'touch');
                return touch !== 0 &&
                vm.program.functions[touch]?.name === 'door_trigger_touch' ? [reference] : [];
            });
            expect(triggers).toHaveLength(2);
            const linkedDoorReferences = (door: number): number[] => {
                const linkedDoors: number[] = [];
                let linkedDoor = door;
                do {
                    linkedDoors.push(linkedDoor);
                    linkedDoor = vm.getEntityWord(linkedDoor, 'enemy');
                } while (linkedDoor !== 0 && linkedDoor !== door &&
                linkedDoors.length < vm.edicts.length);
                return linkedDoors;
            };
            const trigger = triggers.find((candidate) => {
                const owner = vm.getEntityWord(candidate, 'owner');
                return linkedDoorReferences(owner).map(
                    reference => vm.getEntityString(reference, 'model')
                ).join(',') === models.join(',');
            });
            if (trigger === undefined) {
                throw new Error(`E1M1 did not create auto-door group ${models.join('/')}`);
            }
            const door = vm.getEntityWord(trigger, 'owner');
            const linkedDoors = linkedDoorReferences(door);
            expect(linkedDoors.map(reference => vm.getEntityString(reference, 'model'))).toEqual(
                models
            );
            const triggerMinimum = vm.getEntityVector(trigger, 'absmin');
            const triggerMaximum = vm.getEntityVector(trigger, 'absmax');
            expect([triggerMinimum, triggerMaximum]).toEqual(triggerBounds);
            const playerMins = vm.getEntityVector(world.playerReference, 'mins');
            const playerMaxs = vm.getEntityVector(world.playerReference, 'maxs');
            const axes = triggerMinimum.map((minimum, axis) => [
                minimum - playerMins[axis] + 1,
                (minimum + triggerMaximum[axis] - playerMins[axis] - playerMaxs[axis]) / 2,
                triggerMaximum[axis] - playerMaxs[axis] - 1
            ]);
            let triggerOrigin: [number, number, number] | undefined;
            for (const x of axes[0]) {
                for (const y of axes[1]) {
                    for (const z of axes[2]) {
                        const candidate: [number, number, number] = [x, y, z];
                        const trace = world.collision.trace(candidate, candidate);
                        const playerMinimum = candidate.map(
                            (component, axis) => component + playerMins[axis]
                        );
                        const playerMaximum = candidate.map(
                            (component, axis) => component + playerMaxs[axis]
                        );
                        const clearOfDoorSweep = linkedDoors.every((reference) => {
                            const mins = vm.getEntityVector(reference, 'mins');
                            const maxs = vm.getEntityVector(reference, 'maxs');
                            const positionOne = vm.getEntityVector(reference, 'pos1');
                            const positionTwo = vm.getEntityVector(reference, 'pos2');
                            return [0, 1, 2].some((axis) => {
                                const sweptMinimum = Math.min(
                                    positionOne[axis] + mins[axis],
                                    positionTwo[axis] + mins[axis]
                                ) - 1;
                                const sweptMaximum = Math.max(
                                    positionOne[axis] + maxs[axis],
                                    positionTwo[axis] + maxs[axis]
                                ) + 1;
                                return playerMaximum[axis] < sweptMinimum ||
                                playerMinimum[axis] > sweptMaximum;
                            });
                        });
                        if (!trace.startSolid && !trace.allSolid && clearOfDoorSweep) {
                            triggerOrigin = candidate;
                            break;
                        }
                    }
                    if (triggerOrigin) break;
                }
                if (triggerOrigin) break;
            }
            if (!triggerOrigin) {
                throw new Error('E1M1 touch-door trigger has no clear player position');
            }
            const movingSound = vm.getEntityString(door, 'noise2');
            const stopSound = vm.getEntityString(door, 'noise1');
            const modelIndex = Number(vm.getEntityString(door, 'model').slice(1));
            const closedOrigins = new Map(linkedDoors.map(reference => [
                reference,
                vm.getEntityVector(reference, 'origin')
            ]));
            const settledPlayer = world.playerResult(false);

            world.update(0.01, {
                angles: [0, 0, 0],
                attack: false,
                jump: false,
                onGround: true,
                origin: triggerOrigin,
                velocity: [0, 0, 0]
            });

            expect(vm.getEntityFloat(door, 'state')).toBe(2);
            expect(linkedDoors).toHaveLength(2);
            expect(linkedDoors.every(
                reference => vm.getEntityFloat(reference, 'state') === 2
            )).toBe(true);
            expect(vm.getEntityVector(door, 'velocity').some(component => component !== 0)).toBe(true);
            expect(world.soundEvents.some(event => event.entity === door &&
            event.sample === movingSound
            )).toBe(true);
            for (let tick = 0; tick < 100 && vm.getEntityFloat(door, 'state') !== 0; tick++) {
                world.update(0.05);
            }
            expect(vm.getEntityFloat(door, 'state')).toBe(0);
            expect(vm.getEntityVector(door, 'origin')).not.toEqual(closedOrigins.get(door));
            expect(world.collision.brushColliders.find(
                collider => collider.modelIndex === modelIndex
            )?.origin).toEqual(vm.getEntityVector(door, 'origin'));
            expect(world.soundEvents.some(event => event.entity === door &&
            event.sample === stopSound
            )).toBe(true);
            // The second authored doorway has live monsters close enough to keep
            // retriggering it. Isolate the return trip after proving the real
            // trigger path so the complete mover/collider lifecycle is observable.
            for (let reference = world.playerReference + 1;
                reference < vm.edicts.length; reference++) {
                if (linkedDoors.includes(reference) || reference === trigger ||
                vm.edicts[reference].free ||
                vm.getEntityFloat(reference, 'health') <= 0) continue;
                vm.setEntityFloat(reference, 'health', 0);
                vm.setEntityFloat(reference, 'solid', 0);
            }

            world.update(0.01, {
                angles: settledPlayer.angles,
                attack: false,
                jump: false,
                onGround: settledPlayer.onGround,
                origin: settledPlayer.origin,
                velocity: [0, 0, 0]
            });
            for (let tick = 0; tick < 300 && linkedDoors.some(
                reference => vm.getEntityFloat(reference, 'state') !== 1
            ); tick++) {
                world.update(0.05);
            }
            expect(linkedDoors.every(
                reference => vm.getEntityFloat(reference, 'state') === 1
            )).toBe(true);
            for (const reference of linkedDoors) {
                expect(vm.getEntityVector(reference, 'origin')).toEqual(
                    closedOrigins.get(reference)
                );
                expect(vm.getEntityVector(reference, 'velocity')).toEqual([0, 0, 0]);
            }
        });

    it('runs the original E1M1 three-button counter before opening its exit door', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        for (let tick = 0; tick < 3; tick++) {
            world.update(0.05);
        }
        const buttonIndices = map.entities.flatMap((entity, index) => {
            return entity.classname === 'func_button' && entity.target === 't9' ? [index] : [];
        });
        const counterIndex = map.entities.findIndex(
            entity => entity.classname === 'trigger_counter' && entity.targetname === 't9'
        );
        const doorIndex = map.entities.findIndex(
            entity => entity.classname === 'func_door' && entity.targetname === 't10'
        );
        const counter = world.entityReferences[counterIndex];
        const door = world.entityReferences[doorIndex];
        if (buttonIndices.length !== 3 || counter === null || counter === undefined ||
            door === null || door === undefined) {
            throw new Error('E1M1 three-button sequence was not spawned');
        }
        const buttonReferences = buttonIndices.map(index => world.entityReferences[index]);
        if (buttonReferences.some(reference => reference === null || reference === undefined)) {
            throw new Error('An E1M1 sequence button was not spawned');
        }
        const doorOrigin = vm.getEntityVector(door, 'origin');
        const player = world.playerResult();
        const pressButton = (buttonIndex: number, remaining: number, message: string): void => {
            const button = buttonReferences[buttonIndex] as number;
            const modelIndex = Number(vm.getEntityString(button, 'model').slice(1));
            world.update(0.01, {
                angles: player.angles,
                attack: false,
                jump: false,
                onGround: true,
                origin: player.origin,
                touchModelIndices: [modelIndex],
                velocity: player.velocity
            });
            for (let tick = 0; tick < 100 && vm.getEntityFloat(counter, 'count') !== remaining;
                tick++) {
                world.update(0.05);
            }
            expect(vm.getEntityFloat(button, 'state')).toBe(0);
            expect(vm.getEntityFloat(button, 'frame')).toBe(1);
            expect(vm.getEntityFloat(counter, 'count')).toBe(remaining);
            expect(world.visibleCenterMessage()).toBe(message);
        };

        pressButton(0, 2, 'Only 2 more to go...');
        expect(vm.getEntityFloat(door, 'state')).toBe(1);
        expect(vm.getEntityVector(door, 'origin')).toEqual(doorOrigin);
        pressButton(1, 1, 'Only 1 more to go...');
        expect(vm.getEntityFloat(door, 'state')).toBe(1);
        expect(vm.getEntityVector(door, 'origin')).toEqual(doorOrigin);
        pressButton(2, 0, 'Sequence completed!');

        expect(vm.getEntityWord(counter, 'think')).not.toBe(0);
        expect(vm.getEntityFloat(counter, 'nextthink')).toBeGreaterThan(world.time);
        expect(vm.getEntityFloat(door, 'state')).toBe(2);
        expect(vm.getEntityVector(door, 'velocity').some(component => component !== 0)).toBe(true);
        expect(vm.getEntityString(door, 'message')).toBe('');
        expect(world.soundEvents.some(event => event.entity === door &&
            event.sample === vm.getEntityString(door, 'noise2')
        )).toBe(true);
        for (let tick = 0; tick < 100 && vm.getEntityFloat(door, 'state') !== 0; tick++) {
            world.update(0.05);
        }
        expect(vm.getEntityFloat(door, 'state')).toBe(0);
        expect(vm.getEntityVector(door, 'origin')).not.toEqual(doorOrigin);
    });

    it('decodes original temporary-entity writes into an explosion effect', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const callMessageBuiltin = (builtin: number, value: number): void => {
            vm.values[4] = 0;
            vm.values[7] = value;
            const callback = vm.builtins.get(builtin);
            if (!callback) {
                throw new Error(`Missing message builtin ${builtin}`);
            }
            callback(vm, 2);
        };

        callMessageBuiltin(52, 23);
        callMessageBuiltin(52, 3);
        callMessageBuiltin(56, 10.11);
        callMessageBuiltin(56, 20.22);
        callMessageBuiltin(56, 30.33);

        expect(world.particleEvents.at(-1)).toMatchObject({
            count: 1_024,
            kind: 'explosion',
            origin: [10, 20.125, 30.25]
        });
        expect(world.activeDynamicLights().some(light => light.origin[0] === 10 && light.radius === 350
        )).toBe(true);
        expect(world.soundEvents.at(-1)?.sample).toBe('weapons/r_exp3.wav');
    });

    it('creates source-shaped entity effect lights', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const muzzle = vm.allocateEdict();
        const bright = vm.allocateEdict();
        const dim = vm.allocateEdict();
        const hidden = vm.allocateEdict();
        const base = vm.getEntityVector(world.playerReference, 'origin');
        const configureVisibleModel = (
            reference: number,
            origin: [number, number, number]
        ): void => {
            vm.setEntityString(reference, 'model', 'progs/soldier.mdl');
            vm.setEntityFloat(reference, 'modelindex', 2);
            vm.setEntityVector(reference, 'origin', origin);
            vm.setEntityVector(reference, 'mins', [-16, -16, -24]);
            vm.setEntityVector(reference, 'maxs', [16, 16, 40]);
            vm.setEntityVector(reference, 'absmin', origin.map(
                (component, axis) => component + [-17, -17, -25][axis]
            ) as [number, number, number]);
            vm.setEntityVector(reference, 'absmax', origin.map(
                (component, axis) => component + [17, 17, 41][axis]
            ) as [number, number, number]);
        };
        configureVisibleModel(muzzle, [...base]);
        configureVisibleModel(bright, [base[0] + 4, base[1], base[2]]);
        configureVisibleModel(dim, [base[0] + 8, base[1], base[2]]);
        vm.setEntityVector(muzzle, 'angles', [0, 90, 0]);
        vm.setEntityFloat(muzzle, 'effects', 2);
        vm.setEntityFloat(bright, 'effects', 4);
        vm.setEntityFloat(dim, 'effects', 8);
        const viewOffset = vm.getEntityVector(world.playerReference, 'view_ofs');
        const eye = base.map(
            (component, axis) => component + viewOffset[axis]
        ) as [number, number, number];
        const visibility = map.fatVisibleLeafs(eye);
        const hiddenLeaf = map.leafs.findIndex((leaf, index) => index > 0 &&
            leaf.contents !== CONTENTS.SOLID && !map.visibilityContainsLeaf(visibility, index)
        );
        if (hiddenLeaf === -1) {
            throw new Error('E1M1 has no leaf outside the spawn fat PVS');
        }
        const hiddenOrigin = map.leafs[hiddenLeaf].mins.map(
            (component, axis) => (component + map.leafs[hiddenLeaf].maxs[axis]) / 2
        ) as [number, number, number];
        configureVisibleModel(hidden, hiddenOrigin);
        vm.setEntityFloat(hidden, 'effects', 6);

        world.update(0.01);

        const muzzleLight = world.dynamicLights.get(muzzle);
        const brightLight = world.dynamicLights.get(bright);
        const dimLight = world.dynamicLights.get(dim);
        expect(muzzleLight?.origin[0]).toBeCloseTo(base[0]);
        expect(muzzleLight?.origin[1]).toBeCloseTo(base[1] + 18);
        expect(muzzleLight?.origin[2]).toBeCloseTo(base[2] + 16);
        expect(muzzleLight?.radius).toBeGreaterThanOrEqual(200);
        expect(muzzleLight?.radius).toBeLessThanOrEqual(231);
        expect(muzzleLight?.minimumLight).toBe(32);
        expect(muzzleLight?.die).toBeCloseTo(world.time + 0.1);
        expect(vm.getEntityFloat(muzzle, 'effects')).toBe(0);
        expect(brightLight?.origin).toEqual([base[0] + 4, base[1], base[2] + 16]);
        expect(brightLight?.radius).toBeGreaterThanOrEqual(400);
        expect(brightLight?.radius).toBeLessThanOrEqual(431);
        expect(dimLight?.origin).toEqual([base[0] + 8, base[1], base[2]]);
        expect(dimLight?.radius).toBeGreaterThanOrEqual(200);
        expect(dimLight?.radius).toBeLessThanOrEqual(231);
        expect(world.dynamicLights.has(hidden)).toBe(false);
        expect(vm.getEntityFloat(hidden, 'effects')).toBe(4);
    });

    it('routes original spike-family temporary effects and impact sounds', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const callMessageBuiltin = (builtin: number, value: number): void => {
            vm.values[4] = 0;
            vm.values[7] = value;
            const callback = vm.builtins.get(builtin);
            if (!callback) throw new Error(`Missing message builtin ${builtin}`);
            callback(vm, 2);
        };
        const emit = (type: number): void => {
            callMessageBuiltin(52, 23);
            callMessageBuiltin(52, type);
            callMessageBuiltin(56, 10);
            callMessageBuiltin(56, 20);
            callMessageBuiltin(56, 30);
        };

        emit(7);
        expect(world.particleEvents.at(-1)).toMatchObject({ color: 20, count: 30 });
        expect(world.soundEvents.at(-1)?.sample).toBe('wizard/hit.wav');
        emit(8);
        expect(world.particleEvents.at(-1)).toMatchObject({ color: 226, count: 20 });
        expect(world.soundEvents.at(-1)?.sample).toBe('hknight/hit.wav');
        emit(0);
        expect(world.soundEvents.at(-1)?.sample).toMatch(/^weapons\/(?:tink1|ric[123])\.wav$/u);
    });

    it('keeps original entity-keyed temporary beam state for 0.2 seconds', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const callMessageBuiltin = (builtin: number, value: number, word = false): void => {
            vm.values[4] = 0;
            if (word) {
                vm.words[7] = value;
            } else {
                vm.values[7] = value;
            }
            const callback = vm.builtins.get(builtin);
            if (!callback) throw new Error(`Missing message builtin ${builtin}`);
            callback(vm, 2);
        };
        const emitBeam = (type: number, entity: number, end: [number, number, number]): void => {
            callMessageBuiltin(52, 23);
            callMessageBuiltin(52, type);
            callMessageBuiltin(59, entity, true);
            for (const coordinate of [10, 20, 30, ...end]) {
                callMessageBuiltin(56, coordinate);
            }
        };

        emitBeam(5, 42, [70, 80, 90]);
        expect(world.activeBeams()).toEqual([{
            end: [70, 80, 90],
            endTime: world.time + 0.2,
            entity: 42,
            model: 'progs/bolt.mdl',
            start: [10, 20, 30]
        }]);
        emitBeam(6, 42, [100, 110, 120]);
        expect(world.activeBeams()).toHaveLength(1);
        expect(world.activeBeams()[0]).toMatchObject({
            end: [100, 110, 120], model: 'progs/bolt2.mdl'
        });
        world.time += 0.201;
        expect(world.activeBeams()).toEqual([]);
    });

    it('decodes payload-free Quake intermission without consuming the next message', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const writeByte = vm.builtins.get(52);
        const writeCoord = vm.builtins.get(56);
        if (!writeByte || !writeCoord) {
            throw new Error('Intermission message builtins are not registered');
        }
        const playerBefore = world.playerResult(false);
        vm.values[4] = 2;
        vm.values[7] = 30;

        writeByte(vm, 2);
        vm.values[4] = 0;
        vm.values[7] = 23;
        writeByte(vm, 2);
        vm.values[7] = 11;
        writeByte(vm, 2);
        for (const coordinate of [100.19, 200.26, 300.99]) {
            vm.values[7] = coordinate;
            writeCoord(vm, 2);
        }

        expect(world.intermission).toBe(1);
        expect(world.completedTime).toBe(world.time);
        expect(world.playerResult()).toMatchObject({
            angles: playerBefore.angles,
            origin: playerBefore.origin,
            velocity: playerBefore.velocity
        });
        expect(world.particleEvents.at(-1)).toMatchObject({
            color: 7,
            count: 896,
            kind: 'teleport',
            origin: [100.125, 200.25, 300.875]
        });
        expect(vm.getGlobalFloat('total_monsters')).toBeGreaterThan(0);
        expect(vm.getGlobalFloat('total_secrets')).toBeGreaterThan(0);
        expect(vm.getEntityString(0, 'message')).toBe('the Slipgate Complex');
    });

    it('runs the E1M1 exit trigger through the original intermission camera path', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const exitIndex = map.entities.findIndex(
            entity => entity.classname === 'trigger_changelevel'
        );
        const exit = world.entityReferences[exitIndex];
        if (exit === null || exit === undefined) {
            throw new Error('E1M1 changelevel trigger was not spawned');
        }
        const exitOrigin = vm.getEntityVector(exit, 'origin');
        const exitMins = vm.getEntityVector(exit, 'mins');
        const exitMaxs = vm.getEntityVector(exit, 'maxs');
        const exitCenter = exitOrigin.map(
            (component, axis) => component + (exitMins[axis] + exitMaxs[axis]) / 2
        ) as [number, number, number];
        const playerState = {
            angles: [0, 0, 0] as [number, number, number],
            attack: false,
            jump: false,
            onGround: true,
            origin: exitCenter,
            velocity: [0, 0, 0] as [number, number, number]
        };

        world.update(0.01, playerState);
        const result = world.update(0.1, playerState);

        expect(world.intermission).toBe(1);
        expect(result.fixAngle).toBe(true);
        expect(result.origin).not.toEqual(exitCenter);
        expect(result.velocity).toEqual([0, 0, 0]);
        expect(result.viewHeight).toBe(0);
    });

    it('carries QuakeC spawn parms and server state from the E1M1 exit into E1M2', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const exitIndex = map.entities.findIndex(
            entity => entity.classname === 'trigger_changelevel'
        );
        const exit = world.entityReferences[exitIndex];
        if (exit === null || exit === undefined) {
            throw new Error('E1M1 changelevel trigger was not spawned');
        }
        const exitOrigin = vm.getEntityVector(exit, 'origin');
        const exitMins = vm.getEntityVector(exit, 'mins');
        const exitMaxs = vm.getEntityVector(exit, 'maxs');
        const exitCenter = exitOrigin.map(
            (component, axis) => component + (exitMins[axis] + exitMaxs[axis]) / 2
        ) as [number, number, number];
        const player = world.playerReference;
        vm.setEntityFloat(player, 'health', 75);
        vm.setEntityFloat(player, 'armorvalue', 40);
        vm.setEntityFloat(player, 'armortype', 0.6);
        vm.setEntityFloat(player, 'items', 3 | 4_194_304);
        vm.setEntityFloat(player, 'ammo_shells', 40);
        vm.setEntityFloat(player, 'ammo_nails', 12);
        vm.setEntityFloat(player, 'weapon', 1);
        vm.setGlobalFloat('serverflags', 5);
        world.setCvar('skill', '2.6');
        let playerState = {
            angles: [0, 0, 0] as [number, number, number],
            attack: false,
            jump: false,
            onGround: true,
            origin: exitCenter,
            velocity: [0, 0, 0] as [number, number, number]
        };

        world.update(0.01, playerState);
        world.update(0.1, playerState);
        for (let frame = 0; frame < 51; frame++) {
            const current = world.playerResult();
            playerState = {
                angles: current.angles,
                attack: false,
                jump: false,
                onGround: true,
                origin: current.origin,
                velocity: current.velocity
            };
            world.update(0.1, playerState);
        }
        const intermissionController = movementController(3);
        intermissionController.applyServerState(world.playerResult(false), false);
        intermissionController.setButtonState('+jump', 'SPACE', true);
        intermissionController.sampleInputButtons();
        world.update(0.05, {
            ...intermissionController.playerState(),
            jumped: false,
            touchEntityReferences: [],
            touchModelIndices: []
        });
        const transition = world.takePendingLevelTransition();

        expect(transition).toMatchObject({
            cvars: { skill: '2.6' },
            mapName: 'e1m2',
            serverFlags: 5
        });
        expect(transition?.spawnParameters).toHaveLength(16);
        expect(transition?.spawnParameters.slice(0, 8)).toEqual([
            3, 75, 40, 40, 12, 0, 0, 1
        ]);
        expect(transition?.spawnParameters[8]).toBeCloseTo(60);
        expect(world.takePendingLevelTransition()).toBeUndefined();
        if (!transition) throw new Error('E1M1 did not issue its changelevel builtin');

        const nextMap = new BspMap(pak.get('maps/e1m2.bsp'));
        const nextVm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const nextWorld = new QuakeWorldRuntime(
            nextVm,
            nextMap,
            new WorldCollision(nextMap),
            'e1m2',
            transition
        );
        const nextPlayer = nextWorld.playerReference;

        expect(nextVm.getString(nextVm.getGlobalWord('mapname'))).toBe('e1m2');
        expect(nextVm.getEntityString(0, 'model')).toBe('maps/e1m2.bsp');
        expect(nextVm.getGlobalFloat('serverflags')).toBe(5);
        expect(nextWorld.cvarString('skill')).toBe('3');
        expect(nextVm.getGlobalFloat('skill')).toBe(3);
        expect(Math.trunc(nextVm.getEntityFloat(nextPlayer, 'items')) & 3).toBe(3);
        expect(nextVm.getEntityFloat(nextPlayer, 'health')).toBe(75);
        expect(nextVm.getEntityFloat(nextPlayer, 'armorvalue')).toBe(40);
        expect(nextVm.getEntityFloat(nextPlayer, 'armortype')).toBeCloseTo(0.6);
        expect(nextVm.getEntityFloat(nextPlayer, 'ammo_shells')).toBe(40);
        expect(nextVm.getEntityFloat(nextPlayer, 'ammo_nails')).toBe(12);
        expect(nextVm.getEntityFloat(nextPlayer, 'weapon')).toBe(1);
    });

    it('creates a fresh source-shaped New Game transition for start.bsp', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const player = world.playerReference;
        vm.setEntityFloat(player, 'health', 17);
        vm.setEntityFloat(player, 'armorvalue', 80);
        vm.setEntityFloat(player, 'items', 4_194_367);
        vm.setGlobalFloat('serverflags', 15);
        world.setCvar('deathmatch', '1');
        world.setCvar('skill', '2');
        world.setCvar('sv_gravity', '640');

        const transition = world.createNewGameTransition();

        expect(transition).toMatchObject({
            cvars: {
                coop: '0',
                deathmatch: '0',
                skill: '2',
                sv_gravity: '640'
            },
            mapName: 'start',
            serverFlags: 0
        });
        expect(transition.spawnParameters).toHaveLength(16);
        expect(transition.spawnParameters.slice(0, 8)).toEqual([
            4_097, 100, 0, 25, 0, 0, 0, 1
        ]);
        expect(vm.getEntityFloat(player, 'health')).toBe(17);
        expect(vm.getEntityFloat(player, 'armorvalue')).toBe(80);
        expect(vm.getEntityFloat(player, 'items')).toBe(4_194_367);
        expect(vm.getGlobalFloat('serverflags')).toBe(15);

        const startMap = new BspMap(pak.get('maps/start.bsp'));
        const startVm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const startWorld = new QuakeWorldRuntime(
            startVm,
            startMap,
            new WorldCollision(startMap),
            'start',
            transition,
            pak
        );
        expect(startWorld.cvarString('skill')).toBe('2');
        expect(startWorld.cvarString('sv_gravity')).toBe('800');
        expect(startVm.getGlobalFloat('serverflags')).toBe(0);
        expect(startWorld.clientData()).toMatchObject({
            ammoShells: 25,
            armor: 0,
            health: 100,
            items: 4_353
        });
    });

    it('runs the start-map skill trigger and E1M1 slipgate through QuakeC', () => {
        const startMap = new BspMap(pak.get('maps/start.bsp'));
        const startVm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const startWorld = new QuakeWorldRuntime(
            startVm,
            startMap,
            new WorldCollision(startMap),
            'start',
            undefined,
            pak
        );
        const triggerCenter = (reference: number): [number, number, number] => {
            const origin = startVm.getEntityVector(reference, 'origin');
            const minimum = startVm.getEntityVector(reference, 'mins');
            const maximum = startVm.getEntityVector(reference, 'maxs');
            return origin.map(
                (component, axis) => component + (minimum[axis] + maximum[axis]) / 2
            ) as [number, number, number];
        };
        const skillIndex = startMap.entities.findIndex(entity => (
            entity.classname === 'trigger_setskill' && entity.message === '2'
        ));
        const skillTrigger = startWorld.entityReferences[skillIndex];
        if (skillTrigger === null || skillTrigger === undefined) {
            throw new Error('start.bsp hard-skill trigger did not spawn');
        }
        const state = (origin: [number, number, number]) => ({
            angles: [0, 0, 0] as [number, number, number],
            attack: false,
            jump: false,
            onGround: true,
            origin,
            velocity: [0, 0, 0] as [number, number, number]
        });

        expect(startVm.getEntityFloat(skillTrigger, 'solid')).toBe(1);
        expect(startVm.getEntityWord(skillTrigger, 'touch')).toBeGreaterThan(0);
        const skillOrigin = triggerCenter(skillTrigger);
        skillOrigin[1] = startVm.getEntityVector(skillTrigger, 'mins')[1] - 14;
        const skillState = state(skillOrigin);
        startWorld.update(0.01, skillState);
        startWorld.update(0.01, skillState);
        expect(startWorld.cvarString('skill')).toBe('2');

        const e1m1Index = startMap.entities.findIndex(entity => (
            entity.classname === 'trigger_changelevel' && entity.map === 'e1m1'
        ));
        const e1m1Trigger = startWorld.entityReferences[e1m1Index];
        if (e1m1Trigger === null || e1m1Trigger === undefined) {
            throw new Error('start.bsp E1M1 slipgate did not spawn');
        }
        const slipgateState = state(triggerCenter(e1m1Trigger));
        startWorld.update(0.01, slipgateState);
        for (let frame = 0; frame < 3; frame++) startWorld.update(0.1, slipgateState);
        const transition = startWorld.takePendingLevelTransition();

        expect(startWorld.intermission).toBe(0);
        expect(transition).toMatchObject({
            cvars: { skill: '2' },
            mapName: 'e1m1',
            serverFlags: 0
        });
        if (!transition) throw new Error('start.bsp did not issue the E1M1 changelevel');
        const e1m1Map = new BspMap(pak.get('maps/e1m1.bsp'));
        const e1m1Vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const e1m1World = new QuakeWorldRuntime(
            e1m1Vm,
            e1m1Map,
            new WorldCollision(e1m1Map),
            'e1m1',
            transition,
            pak
        );
        expect(e1m1World.cvarString('skill')).toBe('2');
        expect(e1m1Vm.getGlobalFloat('skill')).toBe(2);
        expect(e1m1World.clientData()).toMatchObject({ health: 100, items: 4_353 });
    });

    it('queues the original single-player death restart and preserves entry spawn parms', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const player = world.playerReference;

        vm.setEntityFloat(player, 'health', -20);
        vm.setEntityFloat(player, 'items', 0);
        vm.setEntityFloat(player, 'ammo_shells', 0);
        vm.setGlobalWord('self', player);
        vm.execute('respawn');

        expect(world.takePendingLocalCommandText()).toBe('restart\n');
        expect(world.takePendingLocalCommandText()).toBe('');

        vm.setGlobalFloat('serverflags', 6);
        world.setCvar('skill', '2');
        world.requestRestart();
        const transition = world.takePendingLevelTransition();

        expect(transition).toEqual({
            cvars: expect.objectContaining({ skill: '2' }),
            mapName: 'e1m1',
            serverFlags: 6,
            spawnParameters: [4_097, 100, 0, 25, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]
        });
        expect(world.takePendingLevelTransition()).toBeUndefined();
        if (!transition) throw new Error('Single-player restart state was not produced');

        const nextVm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const nextWorld = new QuakeWorldRuntime(
            nextVm,
            map,
            new WorldCollision(map),
            'e1m1',
            transition
        );
        const nextPlayer = nextWorld.playerReference;
        expect(nextVm.getEntityFloat(nextPlayer, 'health')).toBe(100);
        expect(nextVm.getEntityFloat(nextPlayer, 'ammo_shells')).toBe(25);
        expect(Math.trunc(nextVm.getEntityFloat(nextPlayer, 'items')) & 4_097).toBe(4_097);
        expect(nextVm.getGlobalFloat('serverflags')).toBe(6);
        expect(nextWorld.cvarString('skill')).toBe('2');
    });

    it('runs the original local kill command through ClientKill into deferred restart', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const player = world.playerReference;

        world.killPlayer();

        expect(vm.getEntityFloat(player, 'health')).toBe(100);
        expect(vm.getEntityFloat(player, 'frags')).toBe(-2);
        expect(world.visibleConsoleLines()).toContain('player suicides');
        expect(world.takePendingLocalCommandText()).toBe('restart\n');
    });

    it('spawns the local client with the source client-name cvar value', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(
            vm,
            map,
            new WorldCollision(map),
            'e1m1',
            undefined,
            pak,
            { hostname: 'SLIPGATE' },
            'The Ranger'
        );

        expect(vm.getEntityString(world.playerReference, 'netname')).toBe('The Ranger');
        expect(world.cvarString('hostname')).toBe('SLIPGATE');
    });

    it('round-trips an E1M1 savegame through QuakeC globals, edicts, and world state', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map), 'e1m1');
        const player = world.playerReference;
        world.setSnapshotTime(12.5);
        world.setEntityOrigin(player, [480, 200, 88]);
        vm.setEntityFloat(player, 'health', 73);
        vm.setEntityFloat(player, 'armorvalue', 42);
        vm.setEntityFloat(player, 'items', 7);
        vm.setGlobalFloat('killed_monsters', 3);
        vm.setGlobalWord('self', player);
        world.setCvar('sv_gravity', '640');
        world.lightStyles.set(10, 'az');
        const marker = vm.allocateEdict();
        vm.setEntityString(marker, 'classname', 'savegame_marker');
        vm.setEntityString(marker, 'model', 'progs/missile.mdl');
        vm.setEntityVector(marker, 'origin', [500, 220, 96]);
        const savedGeneration = vm.entity(marker).generation;

        const serialized = JSON.parse(JSON.stringify(world.createSaveState()));
        const restoredVm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const restoredWorld = new QuakeWorldRuntime(
            restoredVm,
            map,
            new WorldCollision(map),
            'e1m1'
        );
        const freshSelf = restoredVm.getGlobalWord('self');
        restoredWorld.restoreSaveState(serialized);

        expect(restoredWorld.time).toBe(12.5);
        expect(restoredWorld.cvarString('sv_gravity')).toBe('640');
        expect(restoredWorld.lightStyles.get(10)).toBe('az');
        expect(restoredVm.getEntityVector(player, 'origin')).toEqual([480, 200, 88]);
        expect(restoredVm.getEntityFloat(player, 'health')).toBe(73);
        expect(restoredVm.getEntityFloat(player, 'armorvalue')).toBe(42);
        expect(restoredVm.getEntityFloat(player, 'items')).toBe(7);
        expect(restoredVm.getGlobalFloat('killed_monsters')).toBe(3);
        expect(restoredVm.getGlobalWord('self')).toBe(freshSelf);
        expect(restoredVm.getEntityString(marker, 'classname')).toBe('savegame_marker');
        expect(restoredVm.getEntityString(marker, 'model')).toBe('progs/missile.mdl');
        expect(restoredVm.entity(marker).generation).toBe(savedGeneration);
        expect(restoredVm.edicts).toHaveLength(vm.edicts.length);
        expect(restoredWorld.entityReferences).toEqual(world.entityReferences);
        expect(restoredWorld.inlineModelReferences.size).toBe(world.inlineModelReferences.size);
        expect(restoredWorld.playerResult().origin).toEqual([480, 200, 88]);
    });

    it('refuses to archive native-invalid intermission and dead-player states', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map), 'e1m1');

        world.intermission = 1;
        expect(() => world.createSaveState()).toThrow('Can\'t save in intermission.');
        world.intermission = 0;
        vm.setEntityFloat(world.playerReference, 'health', 0);
        expect(() => world.createSaveState()).toThrow('Can\'t savegame with a dead player');
    });

    it('routes lethal QuakeC damage through PlayerDeathThink attack into restart', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const player = world.playerReference;
        const initial = world.playerResult(false);
        vm.setEntityFloat(player, 'health', 1);

        let result = world.update(0.01, {
            angles: initial.angles,
            attack: false,
            entityAngles: initial.entityAngles,
            jump: false,
            onGround: false,
            origin: initial.origin,
            velocity: initial.velocity,
            waterLevel: 3,
            waterType: CONTENTS.LAVA
        });

        expect(vm.getEntityFloat(player, 'health')).toBeLessThanOrEqual(0);
        expect(vm.getEntityFloat(player, 'deadflag')).toBe(1);
        expect(vm.getEntityFloat(player, 'movetype')).toBe(6);
        expect(world.takePendingLocalCommandText()).toBe('');

        const advanceDeath = (attack: boolean): void => {
            result = world.update(0.1, {
                angles: result.angles,
                attack,
                entityAngles: result.entityAngles,
                jump: false,
                onGround: false,
                origin: result.origin,
                velocity: result.velocity,
                waterLevel: 0,
                waterType: CONTENTS.EMPTY
            });
        };
        for (let frame = 0; frame < 20 &&
            vm.getEntityFloat(player, 'deadflag') < 2; frame++) {
            advanceDeath(false);
        }
        expect(vm.getEntityFloat(player, 'deadflag')).toBe(2);
        advanceDeath(false);
        expect(vm.getEntityFloat(player, 'deadflag')).toBe(3);
        expect(world.takePendingLocalCommandText()).toBe('');
        advanceDeath(true);

        expect(world.takePendingLocalCommandText()).toBe('restart\n');
    });

    it('runs an E1M1 teleporter through its original QuakeC destination path', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        for (let tick = 0; tick < 10; tick++) {
            world.update(0.1);
        }
        const teleportIndex = map.entities.findIndex((entity, index) => {
            const reference = world.entityReferences[index];
            return entity.classname === 'trigger_teleport' && reference !== null &&
                reference !== undefined && !vm.entity(reference).free &&
                vm.getEntityWord(reference, 'touch') !== 0;
        });
        const teleport = world.entityReferences[teleportIndex];
        if (teleport === null || teleport === undefined) {
            throw new Error('E1M1 has no active teleport trigger');
        }
        const triggerOrigin = vm.getEntityVector(teleport, 'origin');
        const triggerMins = vm.getEntityVector(teleport, 'mins');
        const triggerMaxs = vm.getEntityVector(teleport, 'maxs');
        const triggerCenter = triggerOrigin.map(
            (component, axis) => component + (triggerMins[axis] + triggerMaxs[axis]) / 2
        ) as [number, number, number];
        const target = vm.getEntityString(teleport, 'target');
        const destination = world.entityReferences.find(reference => reference !== null &&
            !vm.entity(reference).free &&
            vm.getEntityString(reference, 'targetname') === target
        );
        const soldier = world.entityReferences.find((reference, index) => reference !== null &&
            !vm.entity(reference).free && map.entities[index].classname === 'monster_army'
        );
        if (destination === null || destination === undefined ||
            soldier === null || soldier === undefined) {
            throw new Error('E1M1 teleporter has no destination or stationary test soldier');
        }
        vm.setEntityVector(soldier, 'origin', vm.getEntityVector(destination, 'origin'));
        const result = world.update(0.01, {
            angles: [0, 0, 0],
            attack: false,
            jump: false,
            onGround: true,
            origin: triggerCenter,
            velocity: [0, 0, 0]
        });

        expect(result.origin).not.toEqual(triggerCenter);
        expect(result.fixAngle).toBe(true);
        expect(result.backwardMoveBlocked).toBe(true);
        expect(Math.hypot(...result.velocity)).toBeGreaterThan(0);
        expect(vm.getEntityFloat(world.playerReference, 'teleport_time')).toBeGreaterThan(world.time);
        expect(world.particleEvents.some(event => event.kind === 'teleport')).toBe(true);
        expect(vm.entity(soldier).free || vm.getEntityFloat(soldier, 'health') <= 0).toBe(true);
        for (let tick = 0; tick < 8; tick++) {
            world.update(0.1);
        }
        expect(world.soundEvents.some(event => event.sample.startsWith('misc/r_tele'))).toBe(true);
        expect(world.playerResult().backwardMoveBlocked).toBe(false);
    });

    it('decodes the Quake finale service message and its center text', () => {
        const map = new BspMap(pak.get('maps/e1m1.bsp'));
        const vm = new QuakeVirtualMachine(new QuakeProgram(pak.get('progs.dat')));
        const world = new QuakeWorldRuntime(vm, map, new WorldCollision(map));
        const writeByte = vm.builtins.get(52);
        const writeString = vm.builtins.get(58);
        if (!writeByte || !writeString) {
            throw new Error('Message-writing builtins are not registered');
        }
        vm.values[4] = 2;
        vm.values[7] = 31;
        writeByte(vm, 2);
        vm.words[7] = vm.internString('Shub-Niggurath is defeated.');
        writeString(vm, 2);

        expect(world.intermission).toBe(2);
        expect(world.centerMessage).toBe('Shub-Niggurath is defeated.');
        expect(world.visibleCenterMessage()).toBe('Shub-Niggurath is defeated.');
    });
});
