import { readFile, writeFile } from 'node:fs/promises';

interface Options {
    angles: [number, number, number];
    classname: string;
    input: string;
    occurrence: number;
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
        classname: '',
        input: '',
        occurrence: 0,
        origin: [0, 0, 0],
        output: '',
        overrides: new Map()
    };
    let hasAngles = false;
    let hasOrigin = false;
    for (let index = 0; index < args.length; index++) {
        const name = args[index];
        if (name === '--input') options.input = argumentValue(args, index++, name);
        else if (name === '--output') options.output = argumentValue(args, index++, name);
        else if (name === '--classname') {
            options.classname = argumentValue(args, index++, name);
        } else if (name === '--occurrence') {
            options.occurrence = Number(argumentValue(args, index++, name));
        } else if (name === '--origin') {
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
    if (!options.input || !options.output || !options.classname ||
        !hasOrigin || !hasAngles || !Number.isInteger(options.occurrence) ||
        options.occurrence < 0) {
        throw new Error(
            'Usage: --input base.sav --output posed.sav --classname name ' +
            '--occurrence n --origin x,y,z --angles pitch,yaw,roll [--set field=value]'
        );
    }
    return options;
};

const quakeVector = (vector: readonly number[]): string => (
    vector.map(component => component.toFixed(6)).join(' ')
);

const fieldValue = (block: string, name: string): string | undefined => (
    new RegExp(`^"${name}" "([^"]*)"$`, 'm').exec(block)?.[1]
);

const saveVector = (block: string, name: string): [number, number, number] => {
    const value = fieldValue(block, name)?.split(' ').map(Number);
    if (!value || value.length !== 3 || value.some(component => !Number.isFinite(component))) {
        throw new Error(`Selected save block is missing a valid ${name}`);
    }
    return value as [number, number, number];
};

const replaceField = (block: string, name: string, value: string): string => {
    const pattern = new RegExp(`^"${name}" "[^"]*"$`, 'm');
    if (!pattern.test(block)) return block.replace(/\}$/u, `"${name}" "${value}"\n}`);
    return block.replace(pattern, `"${name}" "${value}"`);
};

const options = parseOptions(process.argv.slice(2));
const input = await readFile(options.input, 'utf8');
const blocks = [...input.matchAll(/^\{\r?\n[\s\S]*?^\}$/gm)].filter(match => (
    fieldValue(match[0], 'classname') === options.classname
));
const entity = blocks[options.occurrence];
if (!entity || entity.index === undefined) {
    throw new Error(
        `Save file has no ${options.classname} occurrence ${options.occurrence}`
    );
}

const minimum = saveVector(entity[0], 'mins');
const maximum = saveVector(entity[0], 'maxs');
const [x, y, z] = options.origin;
const fields = new Map<string, string>([
    ['absmin', quakeVector([
        x + minimum[0] - 1,
        y + minimum[1] - 1,
        z + minimum[2] - 1
    ])],
    ['absmax', quakeVector([
        x + maximum[0] + 1,
        y + maximum[1] + 1,
        z + maximum[2] + 1
    ])],
    ['origin', quakeVector(options.origin)],
    ['oldorigin', quakeVector(options.origin)],
    ['angles', quakeVector(options.angles)],
    ...options.overrides
]);
let entityBlock = entity[0];
for (const [name, value] of fields) entityBlock = replaceField(entityBlock, name, value);
const output = input.slice(0, entity.index) + entityBlock +
    input.slice(entity.index + entity[0].length);
await writeFile(options.output, output, 'utf8');
process.stdout.write(`${JSON.stringify({
    classname: options.classname,
    fields: Object.fromEntries(fields),
    input: options.input,
    occurrence: options.occurrence,
    output: options.output
}, null, 2)}\n`);
