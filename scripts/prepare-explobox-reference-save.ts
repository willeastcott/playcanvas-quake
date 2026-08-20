import { readFile, writeFile } from 'node:fs/promises';

interface Options {
    input: string;
    output: string;
}

const argumentValue = (args: string[], index: number, name: string): string => {
    const value = args[index + 1];
    if (value === undefined) throw new Error(`${name} requires a value`);
    return value;
};

const parseOptions = (args: string[]): Options => {
    const options: Options = { input: '', output: '' };
    for (let index = 0; index < args.length; index++) {
        const name = args[index];
        if (name === '--input') options.input = argumentValue(args, index++, name);
        else if (name === '--output') options.output = argumentValue(args, index++, name);
        else throw new Error(`Unknown argument: ${name}`);
    }
    if (!options.input || !options.output) {
        throw new Error('Usage: --input capture-base.sav --output capture-explobox-base.sav');
    }
    return options;
};

const replaceField = (block: string, name: string, value: string): string => {
    const pattern = new RegExp(`^"${name}" "[^"]*"$`, 'm');
    if (!pattern.test(block)) throw new Error(`Player save block is missing ${name}`);
    return block.replace(pattern, `"${name}" "${value}"`);
};

const options = parseOptions(process.argv.slice(2));
const input = await readFile(options.input, 'utf8');
const blocks = [...input.matchAll(/^\{\r?\n[\s\S]*?^\}$/gm)];
const player = blocks.find(match => match[0].includes('"classname" "player"'));
if (!player || player.index === undefined) {
    throw new Error('Save file has no player entity block');
}

const fields = new Map([
    ['absmin', '199.000000 2055.000000 -224.968750'],
    ['absmax', '233.000000 2089.000000 -166.968750'],
    ['origin', '216.000000 2072.000000 -199.968750'],
    ['oldorigin', '216.000000 2072.000000 -199.968750'],
    ['angles', '0.000000 180.000000 0.000000'],
    ['v_angle', '0.000000 180.000000 0.000000']
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
