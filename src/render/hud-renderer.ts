import { indexedToImageData } from './palette';
import { parseIndexedPicture, type IndexedPicture } from '../formats/lmp';
import type { PakArchive } from '../formats/pak';
import type { WadArchive } from '../formats/wad';

export const QUAKE_OPTIONS_MENU_ITEMS = [
    '    Customize controls',
    '         Go to console',
    '     Reset to defaults',
    '           Screen size',
    '            Brightness',
    '           Mouse Speed',
    '       CD Music Volume',
    '          Sound Volume',
    '            Always Run',
    '          Invert Mouse',
    '            Lookspring',
    '            Lookstrafe',
    '         Video Options'
] as const;

export type HudMenuScreen = 'help' | 'keys' | 'load' | 'main' | 'newgame' | 'options' |
    'quit' | 'save' | 'setup' | 'singleplayer' | 'multiplayer';

export const QUAKE_WINQUAKE_QUIT_CREDITS = [
    { color: 'white', text: '  Quake version 1.09 by id Software\n\n', x: 16, y: 12 },
    { color: 'white', text: 'Programming        Art \n', x: 16, y: 28 },
    { color: 'brown', text: ' John Carmack       Adrian Carmack\n', x: 16, y: 36 },
    { color: 'brown', text: ' Michael Abrash     Kevin Cloud\n', x: 16, y: 44 },
    { color: 'brown', text: ' John Cash          Paul Steed\n', x: 16, y: 52 },
    { color: 'brown', text: ' Dave \'Zoid\' Kirsch\n', x: 16, y: 60 },
    { color: 'white', text: 'Design             Biz\n', x: 16, y: 68 },
    { color: 'brown', text: ' John Romero        Jay Wilbur\n', x: 16, y: 76 },
    { color: 'brown', text: ' Sandy Petersen     Mike Wilson\n', x: 16, y: 84 },
    { color: 'brown', text: ' American McGee     Donna Jackson\n', x: 16, y: 92 },
    { color: 'brown', text: ' Tim Willits        Todd Hollenshead\n', x: 16, y: 100 },
    { color: 'white', text: 'Support            Projects\n', x: 16, y: 108 },
    { color: 'brown', text: ' Barrett Alexander  Shawn Green\n', x: 16, y: 116 },
    { color: 'white', text: 'Sound Effects\n', x: 16, y: 124 },
    { color: 'brown', text: ' Trent Reznor and Nine Inch Nails\n\n', x: 16, y: 132 },
    { color: 'white', text: 'Quake is a trademark of Id Software,\n', x: 16, y: 140 },
    { color: 'white', text: 'inc., (c)1996 Id Software, inc. All\n', x: 16, y: 148 },
    { color: 'white', text: 'rights reserved. NIN logo is a\n', x: 16, y: 156 },
    { color: 'white', text: 'registered trademark licensed to\n', x: 16, y: 164 },
    { color: 'white', text: 'Nothing Interactive, Inc. All rights\n', x: 16, y: 172 },
    { color: 'white', text: 'reserved. Press y to exit\n', x: 16, y: 180 }
] as const;

export interface HudMenuState {
    bindingGrab?: boolean;
    cursor: number;
    keyBindings?: ReadonlyArray<{
        keys: readonly string[];
        label: string;
    }>;
    page?: number;
    previous?: {
        cursor: number;
        page?: number;
        screen: Exclude<HudMenuScreen, 'newgame' | 'quit'>;
    };
    saveSlots?: readonly string[];
    screen: HudMenuScreen;
    setup?: {
        bottomColor: number;
        hostName: string;
        playerName: string;
        topColor: number;
    };
    settings?: {
        alwaysRun: boolean;
        brightness: number;
        invertMouse: boolean;
        lookSpring: boolean;
        lookStrafe: boolean;
        mouseSpeed: number;
        musicVolume: number;
        screenSize: number;
        soundVolume: number;
    };
    time: number;
}

export interface HudConsoleState {
    height: number;
    input: string;
    lines: string[];
    time: number;
}

export interface HudFinaleState {
    message: string;
    printSpeed?: number;
    showPlaque: boolean;
    time: number;
}

export interface HudStatistics {
    levelName: string;
    monsters: number;
    secrets: number;
    time: number;
    totalMonsters: number;
    totalSecrets: number;
}

export interface HudState {
    activeWeapon?: number;
    health?: number;
    intermission?: HudStatistics;
    loading?: boolean;
    armor?: number;
    ammo?: number;
    ammoCells?: number;
    ammoNails?: number;
    ammoRockets?: number;
    ammoShells?: number;
    console?: HudConsoleState;
    crosshair?: boolean;
    crosshairOffsetX?: number;
    crosshairOffsetY?: number;
    finale?: HudFinaleState;
    centerMessage?: string;
    items?: number;
    itemGetTimes?: readonly number[];
    menu?: HudMenuState;
    notifyLines?: string[];
    pain?: boolean;
    paused?: boolean;
    scoreboard?: HudStatistics;
    statusBarLines?: number;
    time?: number;
    viewRect?: {
        height: number;
        width: number;
        x: number;
        y: number;
    };
}

export const quakeLoadingHudState = (state: HudState): HudState => ({
    ...state,
    loading: true
});

export const quakeCrosshairPosition = (
    viewRect: NonNullable<HudState['viewRect']>,
    offsetX = 0,
    offsetY = 0
): readonly [number, number] => [
    Math.trunc(viewRect.x + Math.trunc(viewRect.width / 2) + offsetX),
    Math.trunc(viewRect.y + Math.trunc(viewRect.height / 2) + offsetY)
];

export const quakeFinaleVisibleCharacters = (time: number, printSpeed = 8): number => {
    const remaining = Math.trunc(printSpeed * time);
    return remaining < 0 ? Number.POSITIVE_INFINITY : remaining + 1;
};

const WEAPON_ICONS = [
    'shotgun', 'sshotgun', 'nailgun', 'snailgun', 'rlaunch', 'srlaunch', 'lightng'
];
const ITEM_ICONS = ['sb_key1', 'sb_key2', 'sb_invis', 'sb_invuln', 'sb_suit', 'sb_quad'];

export const quakeWeaponIconName = (
    name: string,
    weapon: number,
    activeWeapon: number,
    itemGetTime: number,
    time: number
): string => {
    const flash = Math.trunc((time - itemGetTime) * 10);
    if (itemGetTime > 0 && flash < 10) {
        return `inva${((flash % 5) + 5) % 5 + 1}_${name}`;
    }
    return `${activeWeapon === weapon ? 'inv2' : 'inv'}_${name}`;
};

const hudStatisticsDrawState = (statistics?: HudStatistics): unknown => (
    statistics ? { ...statistics, time: Math.trunc(statistics.time) } : undefined
);

export const quakeHudStateDrawKey = (state: HudState): string => {
    const activeWeapon = Math.trunc(state.activeWeapon ?? 1);
    const time = state.time ?? 0;
    const menu = state.menu ? {
        ...state.menu,
        animationFrame: Math.floor(state.menu.time * 10) % 6,
        cursorFrame: Math.floor(state.menu.time * 4) & 1,
        time: undefined
    } : undefined;
    const consoleState = state.console ? {
        ...state.console,
        cursorFrame: Math.floor(state.console.time * 4) & 1,
        time: undefined
    } : undefined;
    const finale = state.finale ? {
        ...state.finale,
        time: undefined,
        visibleCharacters: quakeFinaleVisibleCharacters(
            state.finale.time,
            state.finale.printSpeed
        )
    } : undefined;
    return JSON.stringify({
        ...state,
        console: consoleState,
        finale,
        intermission: hudStatisticsDrawState(state.intermission),
        menu,
        scoreboard: hudStatisticsDrawState(state.scoreboard),
        time: undefined,
        weaponIcons: WEAPON_ICONS.map((name, index) => quakeWeaponIconName(
            name,
            1 << index,
            activeWeapon,
            state.itemGetTimes?.[index] ?? 0,
            time
        ))
    });
};

export const quakeMenuFadeOpaque = (x: number, y: number): boolean => (x & 3) !== ((y & 1) << 1);

export const quakePlayerTranslation = (topColor: number, bottomColor: number): Uint8Array => {
    const translation = Uint8Array.from({ length: 256 }, (_, index) => index);
    const copyRange = (target: number, color: number): void => {
        const source = Math.max(0, Math.min(13, Math.trunc(color))) * 16;
        for (let index = 0; index < 16; index++) {
            translation[target + index] = source < 128 ?
                source + index : source + 15 - index;
        }
    };
    copyRange(16, topColor);
    copyRange(96, bottomColor);
    return translation;
};

export const quakeInventoryAmmoDigitX = (slot: number, digit: number): number => (
    (slot * 6 + digit + 1) * 8 + 2
);

export const stampQuakeConsoleVersion = (
    background: Uint8Array<ArrayBufferLike>,
    characters: Uint8Array<ArrayBufferLike>,
    text = '(WinQuake) 1.09',
    width = 320,
    height = 200
): Uint8Array<ArrayBuffer> => {
    const output = Uint8Array.from(background);
    const startX = width - 11 - text.length * 8;
    const startY = 186;
    for (let characterIndex = 0; characterIndex < text.length; characterIndex++) {
        const character = text.charCodeAt(characterIndex) & 255;
        const sourceX = (character & 15) * 8;
        const sourceY = (character >> 4) * 8;
        for (let y = 0; y < 8; y++) {
            const targetY = startY + y;
            if (targetY < 0 || targetY >= height) continue;
            for (let x = 0; x < 8; x++) {
                const targetX = startX + characterIndex * 8 + x;
                if (targetX < 0 || targetX >= width) continue;
                const source = characters[(sourceY + y) * 128 + sourceX + x];
                if (source !== 0) {
                    output[targetY * width + targetX] = (0x60 + source) & 255;
                }
            }
        }
    }
    return output;
};

export class HudRenderer {
    readonly canvas: HTMLCanvasElement;
    readonly context: CanvasRenderingContext2D;
    readonly pak: PakArchive;
    readonly wad: WadArchive;
    palette: Uint8Array<ArrayBufferLike>;
    readonly pictures = new Map<string, HTMLCanvasElement>();
    characterCanvas?: HTMLCanvasElement;
    backTilePattern?: CanvasPattern;
    menuFadePattern?: CanvasPattern;
    private lastState: HudState = {};
    private lastDrawKey?: string;

    constructor(
        canvas: HTMLCanvasElement,
        wad: WadArchive,
        pak: PakArchive,
        palette: Uint8Array<ArrayBufferLike>
    ) {
        this.canvas = canvas;
        if (this.canvas.width !== 320) this.canvas.width = 320;
        if (this.canvas.height !== 200) this.canvas.height = 200;
        const context = canvas.getContext('2d', { alpha: true });
        if (!context) {
            throw new Error('A 2D canvas context is required for the Quake HUD');
        }
        this.context = context;
        this.context.imageSmoothingEnabled = false;
        this.pak = pak;
        this.wad = wad;
        this.palette = palette;
    }

    setPalette(palette: Uint8Array<ArrayBufferLike>): void {
        this.palette = palette;
        this.pictures.clear();
        this.backTilePattern = undefined;
        this.characterCanvas = undefined;
        this.lastDrawKey = undefined;
    }

    drawLoading(): void {
        this.draw(quakeLoadingHudState(this.lastState));
    }

    private picture(name: string): HTMLCanvasElement {
        const key = `wad:${name}`;
        return this.pictures.get(key) ?? this.cachePicture(key, this.wad.getPicture(name));
    }

    private cachePicture(
        key: string,
        picture: IndexedPicture,
        transparentIndex = 255
    ): HTMLCanvasElement {
        if (!this.pictures.has(key)) {
            const canvas = document.createElement('canvas');
            canvas.width = picture.width;
            canvas.height = picture.height;
            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error(`Could not decode Quake picture ${key}`);
            }
            context.putImageData(
                indexedToImageData(picture, this.palette, transparentIndex), 0, 0
            );
            this.pictures.set(key, canvas);
        }
        return this.pictures.get(key) as HTMLCanvasElement;
    }

    private pakPicture(path: string, transparent = true): HTMLCanvasElement {
        const key = `pak:${path}:${transparent ? 'transparent' : 'opaque'}`;
        return this.pictures.get(key) ?? this.cachePicture(
            key,
            parseIndexedPicture(this.pak.get(path), path),
            transparent ? 255 : -1
        );
    }

    private translatedPakPicture(
        path: string,
        topColor: number,
        bottomColor: number
    ): HTMLCanvasElement {
        const key = `pak:${path}:translated:${topColor}:${bottomColor}`;
        const cached = this.pictures.get(key);
        if (cached) return cached;
        const picture = parseIndexedPicture(this.pak.get(path), path);
        const translation = quakePlayerTranslation(topColor, bottomColor);
        return this.cachePicture(key, {
            ...picture,
            pixels: picture.pixels.map(index => translation[index])
        });
    }

    private consoleBackground(): HTMLCanvasElement {
        const key = 'pak:gfx/conback.lmp:console-version';
        const cached = this.pictures.get(key);
        if (cached) return cached;
        const picture = parseIndexedPicture(this.pak.get('gfx/conback.lmp'), 'gfx/conback.lmp');
        return this.cachePicture(key, {
            ...picture,
            pixels: stampQuakeConsoleVersion(
                picture.pixels,
                this.wad.get('conchars')
            )
        }, -1);
    }

    private drawPicture(name: string, x: number, y: number): void {
        this.context.drawImage(this.picture(name), x, y);
    }

    private drawNumber(value: number, digits: number, x: number, y: number, alternate = false): void {
        let text = String(Math.trunc(value));
        if (text.length > digits) {
            text = text.slice(-digits);
        }
        x += (digits - text.length) * 24;
        for (const character of text) {
            const suffix = character === '-' ? 'minus' : character;
            this.drawPicture(`${alternate ? 'anum' : 'num'}_${suffix}`, x, y);
            x += 24;
        }
    }

    private characters(): HTMLCanvasElement {
        if (!this.characterCanvas) {
            const pixels = this.wad.get('conchars');
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error('Could not decode the Quake console characters');
            }
            context.putImageData(indexedToImageData({
                height: 128,
                pixels: pixels.subarray(0, 128 * 128),
                width: 128
            }, this.palette, 0), 0, 0);
            this.characterCanvas = canvas;
        }
        return this.characterCanvas;
    }

    private drawCharacter(character: number, x: number, y: number): void {
        const sourceX = (character & 15) * 8;
        const sourceY = (character >> 4) * 8;
        this.context.drawImage(this.characters(), sourceX, sourceY, 8, 8, x, y, 8, 8);
    }

    private drawString(text: string, x: number, y: number, maximumLength = 40): void {
        for (const character of [...text].slice(0, maximumLength)) {
            this.drawCharacter(character.charCodeAt(0) & 255, x, y);
            x += 8;
        }
    }

    private drawMessages(state: HudState): void {
        for (const [line, text] of (state.notifyLines ?? []).slice(-4).entries()) {
            this.drawString(text, 8, line * 8, 38);
        }
        if (!state.centerMessage) {
            return;
        }
        this.drawCenterMessage(state.centerMessage);
    }

    private drawCrosshair(state: HudState): void {
        if (!state.crosshair || !state.viewRect) {
            return;
        }
        const [x, y] = quakeCrosshairPosition(
            state.viewRect,
            state.crosshairOffsetX,
            state.crosshairOffsetY
        );
        this.drawCharacter('+'.charCodeAt(0), x, y);
    }

    private drawCenterMessage(message: string, visibleCharacters = Number.POSITIVE_INFINITY): void {
        const lines = message.split('\n');
        let y = lines.length <= 4 ? Math.trunc(200 * 0.35) : 48;
        let remaining = visibleCharacters;
        for (const line of lines) {
            const text = line.slice(0, 40);
            const visible = text.slice(0, Math.max(0, remaining));
            this.drawString(visible, Math.trunc((320 - text.length * 8) / 2), y);
            remaining -= visible.length;
            if (remaining <= 0) {
                return;
            }
            y += 8;
        }
    }

    private drawPause(): void {
        const picture = this.pakPicture('gfx/pause.lmp', false);
        this.context.drawImage(
            picture,
            Math.trunc((320 - picture.width) / 2),
            Math.trunc((200 - 48 - picture.height) / 2)
        );
    }

    private drawMenuFade(): void {
        if (!this.menuFadePattern) {
            const canvas = document.createElement('canvas');
            canvas.width = 4;
            canvas.height = 2;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Could not create the Quake menu fade pattern');
            const image = context.createImageData(4, 2);
            for (let y = 0; y < 2; y++) {
                for (let x = 0; x < 4; x++) {
                    if (quakeMenuFadeOpaque(x, y)) image.data[(y * 4 + x) * 4 + 3] = 255;
                }
            }
            context.putImageData(image, 0, 0);
            this.menuFadePattern = this.context.createPattern(canvas, 'repeat') ?? undefined;
        }
        if (!this.menuFadePattern) return;
        this.context.fillStyle = this.menuFadePattern;
        this.context.fillRect(0, 0, 320, 200);
    }

    private drawMenu(menu: HudMenuState): void {
        if (menu.screen === 'newgame') {
            this.drawCenterMessage('Are you sure you want to\nstart a new game?\n');
            return;
        }
        if (menu.screen === 'help') {
            this.context.drawImage(this.pakPicture(`gfx/help${menu.page ?? 0}.lmp`, false), 0, 0);
            return;
        }
        if (menu.screen === 'options') {
            this.drawOptionsMenu(menu);
            return;
        }
        if (menu.screen === 'keys') {
            this.drawKeysMenu(menu);
            return;
        }
        if (menu.screen === 'load' || menu.screen === 'save') {
            this.drawSaveMenu(menu);
            return;
        }
        if (menu.screen === 'quit') {
            if (menu.previous) {
                this.drawMenu({
                    ...menu,
                    cursor: menu.previous.cursor,
                    page: menu.previous.page,
                    previous: undefined,
                    screen: menu.previous.screen
                });
            }
            this.drawTextBox(0, 0, 38, 23);
            for (const line of QUAKE_WINQUAKE_QUIT_CREDITS) {
                if (line.color === 'white') {
                    this.drawString(line.text, line.x, line.y);
                } else {
                    this.drawMenuString(line.text, line.x, line.y);
                }
            }
            return;
        }
        if (menu.screen === 'main') {
            this.drawMainMenu(menu.cursor, menu.time);
            return;
        }
        if (menu.screen === 'multiplayer') {
            this.drawMultiplayerMenu(menu);
            return;
        }
        if (menu.screen === 'setup') {
            this.drawSetupMenu(menu);
            return;
        }

        this.context.drawImage(this.pakPicture('gfx/qplaque.lmp'), 16, 4);
        const title = this.pakPicture('gfx/ttl_sgl.lmp', false);
        this.context.drawImage(title, Math.trunc((320 - title.width) / 2), 4);
        this.context.drawImage(this.pakPicture('gfx/sp_menu.lmp'), 72, 32);
        const dotFrame = Math.floor(menu.time * 10) % 6 + 1;
        this.context.drawImage(
            this.pakPicture(`gfx/menudot${dotFrame}.lmp`),
            54,
            32 + menu.cursor * 20
        );
    }

    private drawMainMenu(cursor: number, time: number): void {
        this.context.drawImage(this.pakPicture('gfx/qplaque.lmp'), 16, 4);
        const title = this.pakPicture('gfx/ttl_main.lmp', false);
        this.context.drawImage(title, Math.trunc((320 - title.width) / 2), 4);
        this.context.drawImage(this.pakPicture('gfx/mainmenu.lmp'), 72, 32);
        const dotFrame = Math.floor(time * 10) % 6 + 1;
        this.context.drawImage(
            this.pakPicture(`gfx/menudot${dotFrame}.lmp`), 54, 32 + cursor * 20
        );
    }

    private drawMultiplayerMenu(menu: HudMenuState): void {
        this.context.drawImage(this.pakPicture('gfx/qplaque.lmp'), 16, 4);
        const title = this.pakPicture('gfx/p_multi.lmp', false);
        this.context.drawImage(title, Math.trunc((320 - title.width) / 2), 4);
        this.context.drawImage(this.pakPicture('gfx/mp_menu.lmp'), 72, 32);
        const dotFrame = Math.floor(menu.time * 10) % 6 + 1;
        this.context.drawImage(
            this.pakPicture(`gfx/menudot${dotFrame}.lmp`),
            54,
            32 + menu.cursor * 20
        );
        this.drawString('No Communications Available', 52, 148);
    }

    private drawSetupMenu(menu: HudMenuState): void {
        const setup = menu.setup ?? {
            bottomColor: 0,
            hostName: 'UNNAMED',
            playerName: 'player',
            topColor: 0
        };
        this.context.drawImage(this.pakPicture('gfx/qplaque.lmp'), 16, 4);
        const title = this.pakPicture('gfx/p_multi.lmp', false);
        this.context.drawImage(title, Math.trunc((320 - title.width) / 2), 4);
        this.drawMenuString('Hostname', 64, 40);
        this.drawTextBox(160, 32, 16, 1);
        this.drawMenuString(setup.hostName, 168, 40);
        this.drawMenuString('Your name', 64, 56);
        this.drawTextBox(160, 48, 16, 1);
        this.drawMenuString(setup.playerName, 168, 56);
        this.drawMenuString('Shirt color', 64, 80);
        this.drawMenuString('Pants color', 64, 104);
        this.drawTextBox(64, 132, 14, 1);
        this.drawMenuString('Accept Changes', 72, 140);
        this.context.drawImage(this.pakPicture('gfx/bigbox.lmp'), 160, 64);
        this.context.drawImage(this.translatedPakPicture(
            'gfx/menuplyr.lmp', setup.topColor, setup.bottomColor
        ), 172, 72);
        const cursorFrame = 12 + (Math.floor(menu.time * 4) & 1);
        const cursorY = [40, 56, 80, 104, 140][menu.cursor] ?? 140;
        this.drawCharacter(cursorFrame, 56, cursorY);
        if (menu.cursor === 0 || menu.cursor === 1) {
            const text = menu.cursor === 0 ? setup.hostName : setup.playerName;
            this.drawCharacter(
                10 + (Math.floor(menu.time * 4) & 1), 168 + text.length * 8, cursorY
            );
        }
    }

    private drawOptionsMenu(menu: HudMenuState): void {
        const settings = menu.settings ?? {
            alwaysRun: false,
            brightness: 0,
            invertMouse: false,
            lookSpring: false,
            lookStrafe: false,
            mouseSpeed: 3,
            musicVolume: 1,
            screenSize: 100,
            soundVolume: 0.7
        };
        this.context.drawImage(this.pakPicture('gfx/qplaque.lmp'), 16, 4);
        const title = this.pakPicture('gfx/p_option.lmp', false);
        this.context.drawImage(title, Math.trunc((320 - title.width) / 2), 4);
        for (const [line, text] of QUAKE_OPTIONS_MENU_ITEMS.entries()) {
            this.drawMenuString(text, 16, 32 + line * 8);
        }
        this.drawSlider(220, 56, (settings.screenSize - 30) / 90);
        this.drawSlider(220, 64, settings.brightness);
        this.drawSlider(220, 72, (settings.mouseSpeed - 1) / 10);
        this.drawSlider(220, 80, settings.musicVolume);
        this.drawSlider(220, 88, settings.soundVolume);
        this.drawMenuString(settings.alwaysRun ? 'on' : 'off', 220, 96);
        this.drawMenuString(settings.invertMouse ? 'on' : 'off', 220, 104);
        this.drawMenuString(settings.lookSpring ? 'on' : 'off', 220, 112);
        this.drawMenuString(settings.lookStrafe ? 'on' : 'off', 220, 120);
        this.drawCharacter(12 + (Math.floor(menu.time * 4) & 1), 200, 32 + menu.cursor * 8);
    }

    private drawKeysMenu(menu: HudMenuState): void {
        const title = this.pakPicture('gfx/ttl_cstm.lmp', false);
        this.context.drawImage(title, Math.trunc((320 - title.width) / 2), 4);
        this.drawMenuString(
            menu.bindingGrab ? 'Press a key or button for this action' :
                'Enter to change, backspace to clear',
            menu.bindingGrab ? 12 : 18,
            32
        );
        for (const [index, binding] of (menu.keyBindings ?? []).entries()) {
            const y = 48 + index * 8;
            this.drawMenuString(binding.label, 16, y);
            const [first, second] = binding.keys;
            if (!first) {
                this.drawMenuString('???', 140, y);
                continue;
            }
            this.drawMenuString(first, 140, y);
            if (second) {
                this.drawMenuString('or', 148 + first.length * 8, y);
                this.drawMenuString(second, 172 + first.length * 8, y);
            }
        }
        this.drawCharacter(
            menu.bindingGrab ? 61 : 12 + (Math.floor(menu.time * 4) & 1),
            130,
            48 + menu.cursor * 8
        );
    }

    private drawSaveMenu(menu: HudMenuState): void {
        const title = this.pakPicture(
            menu.screen === 'load' ? 'gfx/p_load.lmp' : 'gfx/p_save.lmp',
            false
        );
        this.context.drawImage(title, Math.trunc((320 - title.width) / 2), 4);
        for (const [index, description] of (menu.saveSlots ?? []).entries()) {
            this.drawMenuString(description, 16, 32 + index * 8);
        }
        this.drawCharacter(
            12 + (Math.floor(menu.time * 4) & 1),
            8,
            32 + menu.cursor * 8
        );
    }

    private drawMenuString(text: string, x: number, y: number): void {
        for (const character of text) {
            this.drawCharacter((character.charCodeAt(0) + 128) & 255, x, y);
            x += 8;
        }
    }

    private drawSlider(x: number, y: number, range: number): void {
        const clamped = Math.max(0, Math.min(1, range));
        this.drawCharacter(128, x - 8, y);
        for (let index = 0; index < 10; index++) this.drawCharacter(129, x + index * 8, y);
        this.drawCharacter(130, x + 80, y);
        this.drawCharacter(131, x + 72 * clamped, y);
    }

    private drawTextBox(x: number, y: number, width: number, lines: number): void {
        const drawColumn = (columnX: number, middle: string, top: string, bottom: string): void => {
            this.context.drawImage(this.pakPicture(`gfx/${top}.lmp`), columnX, y);
            for (let line = 0; line < lines; line++) {
                const middleName = middle === 'box_mm' && line === 1 ? 'box_mm2' : middle;
                this.context.drawImage(
                    this.pakPicture(`gfx/${middleName}.lmp`), columnX, y + 8 + line * 8
                );
            }
            this.context.drawImage(
                this.pakPicture(`gfx/${bottom}.lmp`), columnX, y + 8 + lines * 8
            );
        };
        drawColumn(x, 'box_ml', 'box_tl', 'box_bl');
        for (let column = 0; column < width; column += 2) {
            drawColumn(x + 8 + column * 8, 'box_mm', 'box_tm', 'box_bm');
        }
        drawColumn(x + 8 + width * 8, 'box_mr', 'box_tr', 'box_br');
    }

    private drawConsole(console: HudConsoleState): void {
        const height = Math.max(0, Math.min(200, Math.trunc(console.height)));
        if (height <= 0) {
            return;
        }
        const background = this.consoleBackground();
        this.context.drawImage(background, 0, height - 200);

        const rows = Math.max(0, (height - 16) >> 3);
        let y = height - 16 - rows * 8;
        const visibleLines = rows > 0 ? console.lines.slice(-rows) : [];
        for (const line of visibleLines) {
            this.drawString(line, 8, y, 38);
            y += 8;
        }
        let input = `]${console.input}`;
        if (input.length >= 38) {
            input = input.slice(1 + input.length - 38);
        }
        this.drawString(input, 8, height - 16, 38);
        const cursor = 10 + (Math.floor(console.time * 4) & 1);
        this.drawCharacter(cursor, 8 + input.length * 8, height - 16);
    }

    private drawSoloScoreboard(statistics: HudStatistics): void {
        const monsters = `Monsters:${String(Math.trunc(statistics.monsters)).padStart(3)} /${
            String(Math.trunc(statistics.totalMonsters)).padStart(3)}`;
        const secrets = `Secrets :${String(Math.trunc(statistics.secrets)).padStart(3)} /${
            String(Math.trunc(statistics.totalSecrets)).padStart(3)}`;
        const minutes = Math.trunc(statistics.time / 60);
        const seconds = Math.trunc(statistics.time) - minutes * 60;
        const time = `Time :${String(minutes).padStart(3)}:${String(seconds).padStart(2, '0')}`;
        this.drawString(monsters, 8, 180);
        this.drawString(secrets, 8, 188);
        this.drawString(time, 184, 180);
        this.drawString(
            statistics.levelName,
            232 - statistics.levelName.length * 4,
            188
        );
    }

    private drawIntermission(statistics: HudStatistics): void {
        this.context.drawImage(this.pakPicture('gfx/complete.lmp', false), 64, 24);
        this.context.drawImage(this.pakPicture('gfx/inter.lmp'), 0, 56);
        const minutes = Math.trunc(statistics.time / 60);
        const seconds = Math.trunc(statistics.time) - minutes * 60;
        this.drawNumber(minutes, 3, 160, 64);
        this.drawPicture('num_colon', 234, 64);
        this.drawNumber(Math.trunc(seconds / 10), 1, 246, 64);
        this.drawNumber(seconds % 10, 1, 266, 64);
        this.drawNumber(statistics.secrets, 3, 160, 104);
        this.drawPicture('num_slash', 232, 104);
        this.drawNumber(statistics.totalSecrets, 3, 240, 104);
        this.drawNumber(statistics.monsters, 3, 160, 144);
        this.drawPicture('num_slash', 232, 144);
        this.drawNumber(statistics.totalMonsters, 3, 240, 144);
    }

    private drawFinale(finale: HudFinaleState): void {
        if (finale.showPlaque) {
            const picture = this.pakPicture('gfx/finale.lmp');
            this.context.drawImage(picture, Math.trunc((320 - picture.width) / 2), 16);
        }
        this.drawCenterMessage(
            finale.message,
            quakeFinaleVisibleCharacters(finale.time, finale.printSpeed)
        );
    }

    private drawInventoryNumber(value: number, slot: number): void {
        const text = String(Math.max(0, Math.trunc(value))).padStart(3, ' ').slice(-3);
        for (let digit = 0; digit < 3; digit++) {
            if (text[digit] !== ' ') {
                this.drawCharacter(
                    18 + Number(text[digit]),
                    quakeInventoryAmmoDigitX(slot, digit),
                    152
                );
            }
        }
    }

    private drawInventory(state: HudState, items: number, activeWeapon: number): void {
        this.drawPicture('ibar', 0, 152);
        for (const [index, name] of WEAPON_ICONS.entries()) {
            const weapon = 1 << index;
            if ((items & weapon) !== 0) {
                this.drawPicture(quakeWeaponIconName(
                    name,
                    weapon,
                    activeWeapon,
                    state.itemGetTimes?.[index] ?? 0,
                    state.time ?? 0
                ), index * 24, 160);
            }
        }
        [state.ammoShells ?? 0, state.ammoNails ?? 0,
            state.ammoRockets ?? 0, state.ammoCells ?? 0].forEach(
            (value, slot) => this.drawInventoryNumber(value, slot)
        );
        for (let index = 0; index < ITEM_ICONS.length; index++) {
            if ((items & (1 << (17 + index))) !== 0) {
                this.drawPicture(ITEM_ICONS[index], 192 + index * 16, 160);
            }
        }
        for (let index = 0; index < 4; index++) {
            if ((items & (1 << (28 + index))) !== 0) {
                this.drawPicture(`sb_sigil${index + 1}`, 288 + index * 8, 160);
            }
        }
    }

    private facePicture(health: number, items: number, pain: boolean): string {
        const invisible = (items & (1 << 19)) !== 0;
        const invulnerable = (items & (1 << 20)) !== 0;
        if (invisible && invulnerable) return 'face_inv2';
        if ((items & (1 << 22)) !== 0) return 'face_quad';
        if (invisible) return 'face_invis';
        if (invulnerable) return 'face_invul2';
        const healthBand = health >= 100 ? 4 : Math.max(0, Math.min(4, Math.floor(health / 20)));
        return `face${pain ? '_p' : ''}${5 - healthBand}`;
    }

    private drawViewBorder(state: HudState): void {
        const view = state.viewRect;
        if (!view) {
            return;
        }
        if (!this.backTilePattern) {
            const key = 'wad:backtile:opaque';
            const backTile = this.pictures.get(key) ?? this.cachePicture(
                key, this.wad.getPicture('backtile'), -1
            );
            this.backTilePattern = this.context.createPattern(
                backTile, 'repeat'
            ) ?? undefined;
        }
        if (!this.backTilePattern) {
            return;
        }
        const availableHeight = 200 - (state.statusBarLines ?? 48);
        const right = view.x + view.width;
        const bottom = view.y + view.height;
        this.context.fillStyle = this.backTilePattern;
        this.context.fillRect(0, 0, 320, view.y);
        this.context.fillRect(0, view.y, view.x, view.height);
        this.context.fillRect(right, view.y, 320 - right, view.height);
        this.context.fillRect(0, bottom, 320, availableHeight - bottom);
    }

    draw(state: HudState = {}): void {
        if (!state.loading) this.lastState = state;
        const drawKey = quakeHudStateDrawKey(state);
        if (drawKey === this.lastDrawKey) return;
        this.lastDrawKey = drawKey;
        const health = state.health ?? 100;
        const armor = state.armor ?? 0;
        const ammo = state.ammo ?? 25;
        const items = Math.trunc(state.items ?? ((1 << 0) | (1 << 8)));
        const activeWeapon = Math.trunc(state.activeWeapon ?? 1);
        const statusBarLines = state.statusBarLines ?? 48;
        this.context.clearRect(0, 0, 320, 200);
        this.drawViewBorder(state);
        this.drawCrosshair(state);
        if (state.intermission) {
            this.drawIntermission(state.intermission);
            return;
        }
        if (state.finale) {
            this.drawFinale(state.finale);
            return;
        }
        if (statusBarLines > 24) {
            this.drawInventory(state, items, activeWeapon);
        }
        if (state.scoreboard) {
            this.drawPicture('scorebar', 0, 176);
            this.drawSoloScoreboard(state.scoreboard);
        } else if (statusBarLines > 0) {
            this.drawPicture('sbar', 0, 176);
            if ((items & (1 << 20)) !== 0) {
                this.drawNumber(666, 3, 24, 176, true);
                this.drawPicture('disc', 0, 176);
            } else {
                this.drawNumber(armor, 3, 24, 176, armor <= 25);
                if ((items & (1 << 15)) !== 0) {
                    this.drawPicture('sb_armor3', 0, 176);
                } else if ((items & (1 << 14)) !== 0) {
                    this.drawPicture('sb_armor2', 0, 176);
                } else if ((items & (1 << 13)) !== 0) {
                    this.drawPicture('sb_armor1', 0, 176);
                }
            }
            this.drawPicture(this.facePicture(health, items, state.pain ?? false), 112, 176);
            this.drawNumber(health, 3, 136, 176, health <= 25);
            if ((items & (1 << 8)) !== 0) {
                this.drawPicture('sb_shells', 224, 176);
            } else if ((items & (1 << 9)) !== 0) {
                this.drawPicture('sb_nails', 224, 176);
            } else if ((items & (1 << 10)) !== 0) {
                this.drawPicture('sb_rocket', 224, 176);
            } else if ((items & (1 << 11)) !== 0) {
                this.drawPicture('sb_cells', 224, 176);
            }
            this.drawNumber(ammo, 3, 248, 176, ammo <= 10);
        }
        if (!state.console && !state.loading && !state.menu) {
            this.drawMessages(state);
        }
        if (state.loading) {
            const picture = this.pakPicture('gfx/loading.lmp', false);
            this.context.drawImage(
                picture,
                Math.trunc((320 - picture.width) / 2),
                Math.trunc((200 - 48 - picture.height) / 2)
            );
        } else if (state.console) {
            this.drawConsole(state.console);
        } else if (state.menu) {
            this.drawMenuFade();
            this.drawMenu(state.menu);
        } else if (state.paused) {
            this.drawPause();
        }
    }
}
