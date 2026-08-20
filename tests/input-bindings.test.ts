import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PakArchive } from '../src/formats/pak';
import {
    QUAKE_DEFAULT_ALIASES,
    QUAKE_DEFAULT_BINDINGS,
    QUAKE_KEY_MENU_COMMANDS,
    QuakeCommandBuffer,
    QuakeKeyBindings,
    quakeAliasName,
    quakeApplyBindingCommands,
    quakeCommandArguments,
    quakeCommandLines,
    quakeCommandScript,
    quakeKeyboardKeyName,
    quakeMouseKeyName,
    quakeNormalizeKeyName
} from '../src/game/input-bindings';

describe('Quake input bindings', () => {
    it('maps browser keyboard and mouse inputs to source key names', () => {
        expect(quakeKeyboardKeyName('KeyW')).toBe('w');
        expect(quakeKeyboardKeyName('Digit7')).toBe('7');
        expect(quakeKeyboardKeyName('ArrowLeft')).toBe('LEFTARROW');
        expect(quakeKeyboardKeyName('ControlRight')).toBe('CTRL');
        expect(quakeKeyboardKeyName('Backquote')).toBe('`');
        expect(quakeKeyboardKeyName('Numpad7')).toBeUndefined();
        expect(quakeMouseKeyName(0)).toBe('MOUSE1');
        expect(quakeMouseKeyName(4)).toBe('MOUSE5');
        expect(quakeMouseKeyName(5)).toBeUndefined();
        expect(quakeNormalizeKeyName('control')).toBe('CTRL');
        expect(quakeNormalizeKeyName('RETURN')).toBe('ENTER');
        expect(quakeNormalizeKeyName('not-a-key')).toBeUndefined();
    });

    it('preserves quoted bind commands while splitting command buffers', () => {
        expect(quakeCommandLines(
            'echo first; bind x "echo one; echo two"\necho last'
        )).toEqual([
            'echo first',
            'bind x "echo one; echo two"',
            'echo last'
        ]);
        expect(quakeCommandArguments('bind "MOUSE1" "+attack"')).toEqual([
            'bind', 'MOUSE1', '+attack'
        ]);
        expect(quakeCommandArguments('// load keybindings')).toEqual([]);
        expect(quakeCommandArguments(
            'bind / "impulse 10" // change weapon'
        )).toEqual(['bind', '/', 'impulse 10']);
    });

    it('decodes command scripts through their first C-string terminator', () => {
        expect(quakeCommandScript(new Uint8Array([
            101, 99, 104, 111, 32, 111, 107, 0, 101, 99, 104, 111, 32, 110, 111
        ]))).toBe('echo ok');
    });

    it('defers commands after wait until the next frame', () => {
        const buffer = new QuakeCommandBuffer();
        const commands: string[] = [];
        const execute = (command: string): void => {
            commands.push(command);
        };

        buffer.addText('echo Quicksaving...; wait; save quick', execute);
        buffer.addText('echo queued', execute);
        expect(commands).toEqual(['echo Quicksaving...']);

        buffer.advanceFrame(execute);
        expect(commands).toEqual([
            'echo Quicksaving...',
            'save quick',
            'echo queued'
        ]);
    });

    it('inserts alias text ahead of the remaining command buffer', () => {
        const buffer = new QuakeCommandBuffer();
        const commands: string[] = [];
        const execute = (command: string): void => {
            commands.push(command);
            if (command === 'zoom_in') {
                buffer.insertText('fov 70; wait; fov 50', execute);
            }
        };

        buffer.addText('zoom_in; echo after', execute);
        expect(commands).toEqual(['zoom_in', 'fov 70']);

        buffer.advanceFrame(execute);
        expect(commands).toEqual(['zoom_in', 'fov 70', 'fov 50', 'echo after']);
    });

    it('retains the supplied frame-stepped zoom aliases and name limit', () => {
        expect(QUAKE_DEFAULT_ALIASES).toEqual([
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
        ]);
        expect(quakeAliasName('zoom_in')).toBe('zoom_in');
        expect(quakeAliasName('x'.repeat(31))).toHaveLength(31);
        expect(quakeAliasName('x'.repeat(32))).toBeUndefined();
    });

    it('emits matched source-shaped button down/up commands without repeats', () => {
        const bindings = new QuakeKeyBindings([
            ['w', '+forward'],
            ['UPARROW', '+forward'],
            ['x', 'echo first; echo second']
        ]);
        const commands: string[] = [];
        const execute = (command: string): void => {
            commands.push(command);
        };

        bindings.keyEvent('w', true, execute);
        bindings.keyEvent('w', true, execute);
        bindings.keyEvent('UPARROW', true, execute);
        bindings.unbind('w');
        bindings.keyEvent('w', false, execute);
        bindings.keyEvent('UPARROW', false, execute);
        bindings.keyEvent('x', true, execute);

        expect(commands).toEqual([
            '+forward w',
            '+forward UPARROW',
            '-forward w',
            '-forward UPARROW',
            'echo first',
            'echo second'
        ]);
    });

    it('keeps forward, run, and jump active as an ordered three-key chord', () => {
        const bindings = new QuakeKeyBindings(QUAKE_DEFAULT_BINDINGS);
        const commands: string[] = [];
        const execute = (command: string): void => {
            commands.push(command);
        };

        bindings.keyEvent('w', true, execute);
        bindings.keyEvent('SHIFT', true, execute);
        bindings.keyEvent('SPACE', true, execute);

        expect(commands).toEqual([
            '+forward w',
            '+speed SHIFT',
            '+jump SPACE'
        ]);
        expect(bindings.pressedKeys).toEqual(new Set(['w', 'SHIFT', 'SPACE']));

        bindings.keyEvent('SPACE', false, execute);
        bindings.keyEvent('SHIFT', false, execute);
        bindings.keyEvent('w', false, execute);

        expect(commands.slice(3)).toEqual([
            '-jump SPACE',
            '-speed SHIFT',
            '-forward w'
        ]);
    });

    it('ships original-style movement, attack, score, and weapon bindings', () => {
        const bindings = new QuakeKeyBindings(QUAKE_DEFAULT_BINDINGS);

        expect(bindings.binding('w')).toBe('+forward');
        expect(bindings.binding('a')).toBe('+moveleft');
        expect(bindings.binding('SPACE')).toBe('+jump');
        expect(bindings.binding('ENTER')).toBe('+jump');
        expect(bindings.binding('MOUSE1')).toBe('+attack');
        expect(bindings.binding('TAB')).toBe('+showscores');
        expect(bindings.binding('7')).toBe('impulse 7');
        expect(bindings.binding('MWHEELUP')).toBe('impulse 10');
        expect(bindings.binding(',')).toBe('+moveleft');
        expect(bindings.binding('.')).toBe('+moveright');
        expect(bindings.binding('\\')).toBe('+mlook');
        expect(bindings.binding('F1')).toBe('help');
        expect(bindings.binding('F2')).toBe('menu_save');
        expect(bindings.binding('F3')).toBe('menu_load');
        expect(bindings.binding('F4')).toBe('menu_options');
        expect(bindings.binding('F5')).toBe('menu_multiplayer');
        expect(bindings.binding('F6')).toBe('echo Quicksaving...; wait; save quick');
        expect(bindings.binding('F9')).toBe('echo Quickloading...; wait; load quick');
        expect(bindings.binding('F10')).toBe('quit');
        expect(bindings.binding('F11')).toBe('zoom_in');
        expect(bindings.binding('F12')).toBe('screenshot');
    });

    it('matches the original 18-action customize-controls ordering', () => {
        expect(QUAKE_KEY_MENU_COMMANDS).toEqual([
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
        ]);
    });

    it('finds, replaces, clears, and resets source-style command bindings', () => {
        const bindings = new QuakeKeyBindings([
            ['MOUSE1', '+attack'],
            ['CTRL', '+attack'],
            ['ENTER', '+attack; impulse 2'],
            ['x', '+attack2']
        ]);

        expect(bindings.keysForCommand('+attack')).toEqual(['CTRL', 'MOUSE1']);
        bindings.unbindCommand('+attack');
        expect([...bindings.bindings]).toEqual([
            ['ENTER', '+attack; impulse 2'],
            ['x', '+attack2']
        ]);

        bindings.bind('x', '+jump');
        bindings.reset([['SPACE', '+jump']]);
        expect([...bindings.bindings]).toEqual([['SPACE', '+jump']]);
    });

    it('applies only binding commands from a Quake command script', () => {
        const bindings = new QuakeKeyBindings([['w', '+forward']]);

        quakeApplyBindingCommands(bindings, [
            'unbindall',
            'bind "SPACE" "+jump"',
            'bind x "echo one; echo two"',
            'unbind x',
            'gamma 1'
        ].join('\n'));

        expect([...bindings.bindings]).toEqual([['SPACE', '+jump']]);
    });
});

const pakPath = path.resolve('.quake-data/id1/pak0.pak');
const describeWithPak = fs.existsSync(pakPath) ? describe : describe.skip;

describeWithPak('verified shareware command scripts', () => {
    it('inserts the original default.cfg ahead of buffered commands', () => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const script = quakeCommandScript(pak.get('default.cfg'));
        const buffer = new QuakeCommandBuffer();
        const commands: string[] = [];
        const execute = (line: string): void => {
            const arguments_ = quakeCommandArguments(line);
            if (arguments_.length === 0) return;
            commands.push(arguments_.join(' '));
            if (arguments_[0] === 'exec') buffer.insertText(script, execute);
        };

        buffer.addText('exec default.cfg; echo after', execute);

        expect(commands[0]).toBe('exec default.cfg');
        expect(commands[1]).toBe('unbindall');
        expect(commands).toContain('bind / impulse 10');
        expect(commands.at(-1)).toBe('echo after');
        expect(commands.some(command => command.startsWith('//'))).toBe(false);
    });

    it('restores exactly the bindings and cvars listed by the supplied default.cfg', () => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const script = quakeCommandScript(pak.get('default.cfg'));
        const buffer = new QuakeCommandBuffer();
        const bindings = new QuakeKeyBindings(QUAKE_DEFAULT_BINDINGS);
        const aliases = new Map<string, string>();
        const cvars = new Map([
            ['gamma', '0.7'],
            ['lookspring', '1'],
            ['sensitivity', '11'],
            ['viewsize', '30'],
            ['volume', '0.1']
        ]);
        const execute = (line: string): void => {
            const [command, ...arguments_] = quakeCommandArguments(line);
            if (!command) return;
            if (command === 'exec') {
                expect(arguments_).toEqual(['default.cfg']);
                buffer.insertText(script, execute);
            } else if (command === 'unbindall') {
                bindings.unbindAll();
            } else if (command === 'bind') {
                bindings.bind(arguments_[0], arguments_.slice(1).join(' '));
            } else if (command === 'alias') {
                aliases.set(arguments_[0], arguments_.slice(1).join(' '));
            } else if (cvars.has(command)) {
                cvars.set(command, arguments_[0]);
            }
        };

        buffer.addText('exec default.cfg', execute);

        expect(bindings.binding('w')).toBeUndefined();
        expect(bindings.binding('a')).toBe('+lookup');
        expect(bindings.binding('d')).toBe('+moveup');
        expect(bindings.binding('ENTER')).toBe('+jump');
        expect(bindings.binding('MOUSE4')).toBeUndefined();
        expect(bindings.binding('F11')).toBe('zoom_in');
        expect(aliases.get('zoom_in')).toContain('bind F11 zoom_out');
        expect(cvars).toEqual(new Map([
            ['gamma', '1.0'],
            ['lookspring', '1'],
            ['sensitivity', '3'],
            ['viewsize', '100'],
            ['volume', '0.7']
        ]));
    });

    it('derives the Customize Controls capture bindings from the supplied default.cfg', () => {
        const pak = new PakArchive(fs.readFileSync(pakPath));
        const bindings = new QuakeKeyBindings(QUAKE_DEFAULT_BINDINGS);

        quakeApplyBindingCommands(bindings, quakeCommandScript(pak.get('default.cfg')));

        expect(QUAKE_KEY_MENU_COMMANDS.map(([command]) => (
            bindings.keysForCommand(command)
        ))).toEqual([
            ['CTRL', 'MOUSE1'],
            ['/'],
            ['ENTER', 'SPACE'],
            ['UPARROW', 'MOUSE2'],
            ['DOWNARROW'],
            ['LEFTARROW'],
            ['RIGHTARROW'],
            ['SHIFT'],
            [','],
            ['.'],
            ['ALT'],
            ['a', 'PGDN'],
            ['z', 'DEL'],
            ['END'],
            ['\\', 'MOUSE3'],
            ['INS'],
            ['d'],
            ['c']
        ]);
        expect(bindings.binding('w')).toBeUndefined();
        expect(bindings.binding('MWHEELUP')).toBeUndefined();
    });
});
