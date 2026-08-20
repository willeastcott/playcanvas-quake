import type { HudMenuScreen } from '../render/hud-renderer';

type CursorMenuScreen = Exclude<HudMenuScreen, 'help' | 'newgame' | 'quit'>;

const cursorKey = (screen: CursorMenuScreen): CursorMenuScreen => (
    screen === 'save' ? 'load' : screen
);

const MENU_CAPTURE_SCREENS = new Map<string, HudMenuScreen>([
    ['menu-help', 'help'],
    ['menu-keys', 'keys'],
    ['menu-load', 'load'],
    ['menu', 'main'],
    ['menu-multiplayer', 'multiplayer'],
    ['menu-options', 'options'],
    ['menu-quit', 'quit'],
    ['menu-save', 'save'],
    ['menu-setup', 'setup'],
    ['menu-singleplayer', 'singleplayer']
]);

export const quakeMenuCaptureScreen = (
    captureMode: string | null
): HudMenuScreen | undefined => (
    captureMode === null ? undefined : MENU_CAPTURE_SCREENS.get(captureMode)
);

export const quakeMenuCaptureUsesEmptySaveSlots = (
    screen: HudMenuScreen | undefined
): boolean => screen === 'load' || screen === 'save';

export class QuakeMenuCursorState {
    private readonly cursors = new Map<CursorMenuScreen, number>([['setup', 4]]);

    cursor(screen: HudMenuScreen): number {
        if (screen === 'help' || screen === 'newgame' || screen === 'quit') return 0;
        return this.cursors.get(cursorKey(screen)) ?? 0;
    }

    remember(screen: HudMenuScreen | undefined, cursor: number): void {
        if (!screen || screen === 'help' || screen === 'newgame' || screen === 'quit') return;
        this.cursors.set(cursorKey(screen), cursor);
    }

    transition(
        currentScreen: HudMenuScreen | undefined,
        currentCursor: number,
        nextScreen: HudMenuScreen | undefined,
        nextCursor?: number
    ): number {
        this.remember(currentScreen, currentCursor);
        if (!nextScreen) return 0;
        if (nextCursor !== undefined) this.remember(nextScreen, nextCursor);
        return nextCursor ?? this.cursor(nextScreen);
    }
}
