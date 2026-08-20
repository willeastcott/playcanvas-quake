import { readFile, writeFile } from 'node:fs/promises';

interface Options {
    angles: [number, number, number];
    input: string;
    origin: [number, number, number];
    output: string;
    overrides: Map<string, string>;
}

const argumentValue = (args: string[], index: number, name: string): string => {
    const value = args[index + 1];
    if (value === undefined) throw new Error(`${name} requires a value`);
    return value;
};

const vectorArgument = (value: string, name: string): [number, number, number] => {
    const vector = value.split(',').map(Number);
    if (vector.length !== 3 || vector.some(component => !Number.isFinite(component))) {
        throw new Error(`${name} requires three finite comma-separated numbers`);
    }
    return vector as [number, number, number];
};

const parseOptions = (args: string[]): Options => {
    const options: Options = {
        angles: [0, 0, 0],
        input: '',
        origin: [0, 0, 0],
        output: '',
        overrides: new Map()
    };
    let hasAngles = false;
    let hasOrigin = false;
    for (let index = 0; index < args.length; index++) {
        const name = args[index];
        if (name.startsWith('--origin=')) {
            options.origin = vectorArgument(name.slice('--origin='.length), '--origin');
            hasOrigin = true;
        } else if (name.startsWith('--angles=')) {
            options.angles = vectorArgument(name.slice('--angles='.length), '--angles');
            hasAngles = true;
        } else if (name === '--input') options.input = argumentValue(args, index++, name);
        else if (name === '--output') options.output = argumentValue(args, index++, name);
        else if (name === '--origin') {
            options.origin = vectorArgument(argumentValue(args, index++, name), name);
            hasOrigin = true;
        } else if (name === '--angles') {
            options.angles = vectorArgument(argumentValue(args, index++, name), name);
            hasAngles = true;
        } else if (name === '--set') {
            const assignment = argumentValue(args, index++, name);
            const separator = assignment.indexOf('=');
            if (separator <= 0) throw new Error('--set requires field=value');
            options.overrides.set(
                assignment.slice(0, separator),
                assignment.slice(separator + 1)
            );
        } else {
            throw new Error(`Unknown argument: ${name}`);
        }
    }
    if (!options.input || !options.output || !hasOrigin || !hasAngles) {
        throw new Error(
            'Usage: --input base.sav --output posed.sav --origin x,y,z ' +
            '--angles pitch,yaw,roll [--set field=value]'
        );
    }
    return options;
};

const quakeVector = (vector: readonly number[]): string => (
    vector.map(component => component.toFixed(6)).join(' ')
);

const replaceField = (block: string, name: string, value: string): string => {
    const pattern = new RegExp(`^"${name}" "[^"]*"$`, 'm');
    if (!pattern.test(block)) return block.replace(/\}$/u, `"${name}" "${value}"\n}`);
    return block.replace(pattern, `"${name}" "${value}"`);
};

const options = parseOptions(process.argv.slice(2));
const input = await readFile(options.input, 'utf8');
const blocks = [...input.matchAll(/^\{\r?\n[\s\S]*?^\}$/gm)];
const player = blocks.find(match => match[0].includes('"classname" "player"'));
if (!player || player.index === undefined) {
    throw new Error('Save file has no player entity block');
}

const [x, y, z] = options.origin;
const fields = new Map<string, string>([
    ['absmin', quakeVector([x - 17, y - 17, z - 25])],
    ['absmax', quakeVector([x + 17, y + 17, z + 33])],
    ['origin', quakeVector(options.origin)],
    ['oldorigin', quakeVector(options.origin)],
    ['angles', quakeVector(options.angles)],
    ['v_angle', quakeVector(options.angles)],
    ...options.overrides
]);
let playerBlock = player[0];
for (const [name, value] of fields) playerBlock = replaceField(playerBlock, name, value);
const output = input.slice(0, player.index) + playerBlock +
    input.slice(player.index + player[0].length);
await writeFile(options.output, output, 'utf8');
process.stdout.write(`${JSON.stringify({
    input: options.input,
    output: options.output,
    player: Object.fromEntries(fields)
}, null, 2)}\n`);
