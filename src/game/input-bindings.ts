export type QuakeBoundCommandExecutor = (command: string) => void;

export const QUAKE_DEFAULT_ALIASES: ReadonlyArray<readonly [string, string]> = [
    [
        'zoom_in',
        'sensitivity 2; fov 90; wait; fov 70; wait; fov 50; wait; ' +
        'fov 30; wait; fov 10; wait; fov 5; bind F11 zoom_out'
    ],
    [
        'zoom_out',
        'sensitivity 4; fov 5; wait; fov 10; wait; fov 30; wait; ' +
        'fov 50; wait; fov 70; wait; fov 90; bind F11 zoom_in; sensitivity 3'
    ]
];

export const QUAKE_KEY_MENU_COMMANDS: ReadonlyArray<readonly [string, string]> = [
    ['+attack', 'attack'],
    ['impulse 10', 'change weapon'],
    ['+jump', 'jump / swim up'],
    ['+forward', 'walk forward'],
    ['+back', 'backpedal'],
    ['+left', 'turn left'],
    ['+right', 'turn right'],
    ['+speed', 'run'],
    ['+moveleft', 'step left'],
    ['+moveright', 'step right'],
    ['+strafe', 'sidestep'],
    ['+lookup', 'look up'],
    ['+lookdown', 'look down'],
    ['centerview', 'center view'],
    ['+mlook', 'mouse look'],
    ['+klook', 'keyboard look'],
    ['+moveup', 'swim up'],
    ['+movedown', 'swim down']
];

const namedKeys = new Set([
    'TAB', 'ENTER', 'ESCAPE', 'SPACE', 'BACKSPACE',
    'UPARROW', 'DOWNARROW', 'LEFTARROW', 'RIGHTARROW',
    'ALT', 'CTRL', 'SHIFT', 'PAUSE',
    'INS', 'DEL', 'PGUP', 'PGDN', 'HOME', 'END',
    'MOUSE1', 'MOUSE2', 'MOUSE3', 'MOUSE4', 'MOUSE5',
    'MWHEELUP', 'MWHEELDOWN',
    ...Array.from({ length: 12 }, (_, index) => `F${index + 1}`)
]);

const keyboardCodeNames: Readonly<Record<string, string>> = {
    AltLeft: 'ALT',
    AltRight: 'ALT',
    ArrowDown: 'DOWNARROW',
    ArrowLeft: 'LEFTARROW',
    ArrowRight: 'RIGHTARROW',
    ArrowUp: 'UPARROW',
    Backquote: '`',
    Backslash: '\\',
    Backspace: 'BACKSPACE',
    BracketLeft: '[',
    BracketRight: ']',
    Comma: ',',
    ControlLeft: 'CTRL',
    ControlRight: 'CTRL',
    Delete: 'DEL',
    End: 'END',
    Enter: 'ENTER',
    Equal: '=',
    Escape: 'ESCAPE',
    Home: 'HOME',
    Insert: 'INS',
    Minus: '-',
    PageDown: 'PGDN',
    PageUp: 'PGUP',
    Pause: 'PAUSE',
    Period: '.',
    Quote: '\'',
    Semicolon: ';',
    ShiftLeft: 'SHIFT',
    ShiftRight: 'SHIFT',
    Slash: '/',
    Space: 'SPACE',
    Tab: 'TAB'
};

export const QUAKE_DEFAULT_BINDINGS: ReadonlyArray<readonly [string, string]> = [
    ['TAB', '+showscores'],
    ['ENTER', '+jump'],
    ['SPACE', '+jump'],
    ['`', 'toggleconsole'],
    ['~', 'toggleconsole'],
    ['a', '+moveleft'],
    ['c', '+movedown'],
    ['d', '+moveright'],
    ['e', '+moveup'],
    ['r', '+movedown'],
    ['s', '+back'],
    ['w', '+forward'],
    ['z', '+lookdown'],
    ['UPARROW', '+forward'],
    ['DOWNARROW', '+back'],
    ['LEFTARROW', '+left'],
    ['RIGHTARROW', '+right'],
    ['ALT', '+strafe'],
    ['CTRL', '+attack'],
    ['SHIFT', '+speed'],
    ['INS', '+klook'],
    ['DEL', '+lookdown'],
    ['PGDN', '+lookup'],
    ['END', 'centerview'],
    [',', '+moveleft'],
    ['.', '+moveright'],
    ['\\', '+mlook'],
    ['MOUSE1', '+attack'],
    ['MOUSE2', '+forward'],
    ['MOUSE3', '+mlook'],
    ['MOUSE4', 'impulse 12'],
    ['MOUSE5', 'impulse 10'],
    ['MWHEELUP', 'impulse 10'],
    ['MWHEELDOWN', 'impulse 12'],
    ['PAUSE', 'pause'],
    ['F1', 'help'],
    ['F2', 'menu_save'],
    ['F3', 'menu_load'],
    ['F4', 'menu_options'],
    ['F5', 'menu_multiplayer'],
    ['F6', 'echo Quicksaving...; wait; save quick'],
    ['F9', 'echo Quickloading...; wait; load quick'],
    ['F10', 'quit'],
    ['F11', 'zoom_in'],
    ['F12', 'screenshot'],
    ['/', 'impulse 10'],
    ['-', 'sizedown'],
    ['=', 'sizeup'],
    ...Array.from({ length: 9 }, (_, index) => [
        String(index + 1), `impulse ${index + 1}`
    ] as const),
    ['0', 'impulse 0']
];

const quakeNamedKeyNumbers: Readonly<Record<string, number>> = {
    TAB: 9,
    ENTER: 13,
    ESCAPE: 27,
    SPACE: 32,
    BACKSPACE: 127,
    UPARROW: 128,
    DOWNARROW: 129,
    LEFTARROW: 130,
    RIGHTARROW: 131,
    ALT: 132,
    CTRL: 133,
    SHIFT: 134,
    ...Object.fromEntries(Array.from({ length: 12 }, (_, index) => [
        `F${index + 1}`, 135 + index
    ])),
    INS: 147,
    DEL: 148,
    PGDN: 149,
    PGUP: 150,
    HOME: 151,
    END: 152,
    MOUSE1: 200,
    MOUSE2: 201,
    MOUSE3: 202,
    MOUSE4: 203,
    MOUSE5: 204,
    MWHEELUP: 239,
    MWHEELDOWN: 240,
    PAUSE: 255
};

const quakeKeyNumber = (key: string): number => (
    key.length === 1 ? key.charCodeAt(0) : quakeNamedKeyNumbers[key] ?? 256
);

export const quakeNormalizeKeyName = (name: string): string | undefined => {
    const trimmed = name.trim();
    if (trimmed.length === 1) return trimmed.toLowerCase();
    const upper = trimmed.toUpperCase();
    const alias = upper === 'CONTROL' ? 'CTRL' : upper === 'RETURN' ? 'ENTER' : upper;
    return namedKeys.has(alias) ? alias : undefined;
};

export const quakeKeyboardKeyName = (code: string): string | undefined => {
    const named = keyboardCodeNames[code];
    if (named) return named;
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^F(?:[1-9]|1[0-2])$/.test(code)) return code;
    return undefined;
};

export const quakeMouseKeyName = (button: number): string | undefined => (
    button >= 0 && button < 5 ? `MOUSE${button + 1}` : undefined
);

export const quakeCommandLines = (text: string): string[] => {
    const commands: string[] = [];
    let current = '';
    let quoted = false;
    for (const character of text) {
        if (character === '"') quoted = !quoted;
        if (!quoted && (character === ';' || character === '\n' || character === '\r')) {
            if (current.trim()) commands.push(current.trim());
            current = '';
        } else {
            current += character;
        }
    }
    if (current.trim()) commands.push(current.trim());
    return commands;
};

export const quakeCommandArguments = (text: string): string[] => {
    const arguments_: string[] = [];
    let index = 0;
    while (index < text.length) {
        while (/\s/.test(text[index] ?? '')) index++;
        if (index >= text.length) break;
        if (text[index] === '/' && text[index + 1] === '/') break;
        let argument = '';
        if (text[index] === '"') {
            index++;
            while (index < text.length && text[index] !== '"') {
                argument += text[index++];
            }
            if (text[index] === '"') index++;
        } else {
            while (index < text.length && !/\s/.test(text[index])) {
                argument += text[index++];
            }
        }
        arguments_.push(argument);
    }
    return arguments_;
};

export const quakeCommandScript = (bytes: Uint8Array): string => {
    const terminator = bytes.indexOf(0);
    return new TextDecoder('windows-1252').decode(
        terminator === -1 ? bytes : bytes.subarray(0, terminator)
    );
};

export const quakeAliasName = (name: string): string | undefined => {
    const trimmed = name.trim();
    return trimmed.length > 0 && trimmed.length < 32 ? trimmed : undefined;
};

export class QuakeCommandBuffer {
    private readonly commands: string[] = [];
    private executing = false;
    private waiting = false;

    addText(text: string, execute: QuakeBoundCommandExecutor): void {
        this.commands.push(...quakeCommandLines(text));
        this.drain(execute);
    }

    insertText(text: string, execute: QuakeBoundCommandExecutor): void {
        this.commands.unshift(...quakeCommandLines(text));
        this.drain(execute);
    }

    advanceFrame(execute: QuakeBoundCommandExecutor): void {
        if (!this.waiting) return;
        this.waiting = false;
        this.drain(execute);
    }

    private drain(execute: QuakeBoundCommandExecutor): void {
        if (this.executing || this.waiting) return;
        this.executing = true;
        try {
            while (this.commands.length > 0) {
                const command = this.commands.shift();
                if (!command) continue;
                if (quakeCommandArguments(command)[0]?.toLowerCase() === 'wait') {
                    this.waiting = true;
                    break;
                }
                execute(command);
            }
        } finally {
            this.executing = false;
        }
    }
}

export class QuakeKeyBindings {
    readonly bindings = new Map<string, string>();
    readonly pressedKeys = new Set<string>();
    readonly activeButtonBindings = new Map<string, string>();

    constructor(defaults: ReadonlyArray<readonly [string, string]> = QUAKE_DEFAULT_BINDINGS) {
        for (const [key, command] of defaults) this.bind(key, command);
    }

    keysForCommand(command: string, limit = 2): string[] {
        return [...this.bindings]
        .filter(([, binding]) => binding === command)
        .sort(([left], [right]) => quakeKeyNumber(left) - quakeKeyNumber(right))
        .slice(0, limit)
        .map(([key]) => key);
    }

    bind(key: string, command: string): boolean {
        const normalized = quakeNormalizeKeyName(key);
        if (!normalized) return false;
        this.bindings.set(normalized, command);
        return true;
    }

    binding(key: string): string | undefined {
        const normalized = quakeNormalizeKeyName(key);
        return normalized ? this.bindings.get(normalized) : undefined;
    }

    unbind(key: string): boolean {
        const normalized = quakeNormalizeKeyName(key);
        if (!normalized) return false;
        this.bindings.delete(normalized);
        return true;
    }

    unbindAll(): void {
        this.bindings.clear();
    }

    unbindCommand(command: string): void {
        for (const [key, binding] of this.bindings) {
            if (binding === command) this.bindings.delete(key);
        }
    }

    reset(defaults: ReadonlyArray<readonly [string, string]> = QUAKE_DEFAULT_BINDINGS): void {
        this.unbindAll();
        for (const [key, command] of defaults) this.bind(key, command);
    }

    keyEvent(key: string, down: boolean, execute: QuakeBoundCommandExecutor): void {
        const normalized = quakeNormalizeKeyName(key);
        if (!normalized) return;
        if (!down) {
            this.pressedKeys.delete(normalized);
            const active = this.activeButtonBindings.get(normalized);
            if (active) {
                this.activeButtonBindings.delete(normalized);
                execute(`-${active.slice(1)} ${normalized}`);
            }
            return;
        }
        if (this.pressedKeys.has(normalized)) return;
        this.pressedKeys.add(normalized);
        const binding = this.bindings.get(normalized)?.trim();
        if (!binding) return;
        if (binding.startsWith('+')) {
            this.activeButtonBindings.set(normalized, binding);
            execute(`${binding} ${normalized}`);
            return;
        }
        for (const command of quakeCommandLines(binding)) execute(command);
    }

    releaseAll(execute: QuakeBoundCommandExecutor): void {
        for (const key of [...this.pressedKeys]) this.keyEvent(key, false, execute);
    }
}

export const quakeApplyBindingCommands = (
    bindings: QuakeKeyBindings,
    script: string
): void => {
    for (const commandLine of quakeCommandLines(script)) {
        const [rawCommand, ...arguments_] = quakeCommandArguments(commandLine);
        const command = rawCommand?.toLowerCase();
        if (command === 'unbindall') {
            bindings.unbindAll();
        } else if (command === 'unbind' && arguments_[0]) {
            bindings.unbind(arguments_[0]);
        } else if (command === 'bind' && arguments_.length >= 2) {
            bindings.bind(arguments_[0], arguments_.slice(1).join(' '));
        }
    }
};
