import './styles.css';

import {
    QUAKE_LOADING_FRAME_STORAGE_KEY,
    startQuake
} from './game/quake-app';

const requireElement = <T extends Element>(selector: string): T => {
    const element = document.querySelector<T>(selector);
    if (!element) {
        throw new Error(`Required page element is missing: ${selector}`);
    }
    return element;
};

const gameCanvas = requireElement<HTMLCanvasElement>('#game-canvas');
const screenCanvas = requireElement<HTMLCanvasElement>('#screen-canvas');
const fatalError = requireElement<HTMLElement>('#fatal-error');
const fatalErrorMessage = requireElement<HTMLElement>('#fatal-error-message');
const dataHelp = requireElement<HTMLElement>('.data-help');
const debug = requireElement<HTMLElement>('#debug');

const restoreLoadingFrame = async (): Promise<boolean> => {
    const png = sessionStorage.getItem(QUAKE_LOADING_FRAME_STORAGE_KEY);
    sessionStorage.removeItem(QUAKE_LOADING_FRAME_STORAGE_KEY);
    if (!png) return false;
    screenCanvas.width = 320;
    screenCanvas.height = 200;
    const context = screenCanvas.getContext('2d');
    if (!context) return false;
    const image = new Image();
    const restored = await new Promise<boolean>((resolve) => {
        image.addEventListener('load', () => {
            context.imageSmoothingEnabled = false;
            context.drawImage(image, 0, 0);
            resolve(true);
        }, { once: true });
        image.addEventListener('error', () => resolve(false), { once: true });
        image.src = png;
    });
    return restored;
};

try {
    const restoredLoadingFrame = await restoreLoadingFrame();
    const game = await startQuake({
        gameCanvas,
        onStatus: () => undefined,
        restoredLoadingFrame,
        screenCanvas
    });
    const debugEnabled = new URLSearchParams(window.location.search).get('debug') === '1';
    const updateDebug = (): void => {
        debug.textContent = [
            `${game.mapName.toUpperCase()} / BSP 29`,
            `${game.map.faces.length} faces`,
            `${game.world.batches.length} draw batches`,
            `origin ${game.controller.origin.map(value => value.toFixed(3)).join(' ')}`,
            `view ${game.controller.pitch.toFixed(3)} ${game.controller.yaw.toFixed(3)}`,
            `mlook ${game.controller.mouseLookActive ? 1 : 0}`,
            `movetype ${game.controller.moveType} noclip_anglehack ${
                game.controller.noclipAngleHack ? 1 : 0
            }`,
            `audio ${game.audio.context.state} ${game.audio.buffers.size} buffers ${
                game.audio.activeSounds.size
            } dynamic`,
            game.audio.musicPath ? `CD track ${game.audio.musicTrack}: ${game.audio.musicPath}` :
                `CD track ${game.requestedMusicTrack}: original media not supplied`,
            `CD volume ${game.audio.musicVolume}`,
            game.sharewareVerified ? 'pak0.pak SHA-256 verified' : `user PAK ${game.pakSha256.slice(0, 12)}…`,
            'Click to look · WASD move · Space jump · Shift run'
        ].join('\n');
    };
    updateDebug();
    if (debugEnabled) game.app.on('update', updateDebug);
    debug.hidden = !debugEnabled;
} catch (error) {
    console.error(error);
    fatalError.hidden = false;
    fatalErrorMessage.textContent = error instanceof Error ? error.message : String(error);
    dataHelp.hidden = false;
}
