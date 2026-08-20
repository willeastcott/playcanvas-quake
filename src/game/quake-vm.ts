import { parseVector, type EntityDictionary } from '../formats/entities';
import type { QuakeDefinition, QuakeFunction, QuakeProgram } from '../formats/progs';

const MAX_STACK_DEPTH = 32;
const MAX_RUNAWAY_STATEMENTS = 100_000;
const OFS_RETURN = 1;
const OFS_PARM0 = 4;
const TYPE_MASK = 0x7fff;
const DEF_SAVEGLOBAL = 1 << 15;

enum QuakeValueType {
    Void,
    String,
    Float,
    Vector,
    Entity,
    Field,
    Function,
    Pointer
}

export enum QuakeOpcode {
    Done,
    MultiplyFloat,
    MultiplyVector,
    MultiplyFloatVector,
    MultiplyVectorFloat,
    DivideFloat,
    AddFloat,
    AddVector,
    SubtractFloat,
    SubtractVector,
    EqualFloat,
    EqualVector,
    EqualString,
    EqualEntity,
    EqualFunction,
    NotEqualFloat,
    NotEqualVector,
    NotEqualString,
    NotEqualEntity,
    NotEqualFunction,
    LessOrEqual,
    GreaterOrEqual,
    LessThan,
    GreaterThan,
    LoadFloat,
    LoadVector,
    LoadString,
    LoadEntity,
    LoadField,
    LoadFunction,
    Address,
    StoreFloat,
    StoreVector,
    StoreString,
    StoreEntity,
    StoreField,
    StoreFunction,
    StorePointerFloat,
    StorePointerVector,
    StorePointerString,
    StorePointerEntity,
    StorePointerField,
    StorePointerFunction,
    Return,
    NotFloat,
    NotVector,
    NotString,
    NotEntity,
    NotFunction,
    If,
    IfNot,
    Call0,
    Call1,
    Call2,
    Call3,
    Call4,
    Call5,
    Call6,
    Call7,
    Call8,
    State,
    GoTo,
    And,
    Or,
    BitAnd,
    BitOr
}

export class QuakeEdict {
    readonly words: Int32Array<ArrayBuffer>;
    readonly values: Float32Array<ArrayBuffer>;
    free = false;
    freeTime = 0;
    generation = 1;

    constructor(fieldCount: number) {
        this.words = new Int32Array(fieldCount);
        this.values = new Float32Array(this.words.buffer);
    }
}

interface CallFrame {
    quakeFunction: QuakeFunction;
    returnStatement: number;
    savedLocals: Int32Array<ArrayBuffer>;
}

export type QuakeBuiltin = (vm: QuakeVirtualMachine, argumentCount: number) => void;

export interface QuakeVmSaveState {
    dynamicStrings: Array<readonly [number, string]>;
    edicts: Array<{
        free: boolean;
        freeTime: number;
        generation: number;
        words: number[];
    }>;
    programCrc: number;
    savedGlobals: Array<readonly [number, number]>;
    serverActive: boolean;
    serverTime: number;
    version: 1;
}

export class QuakeVirtualMachine {
    readonly program: QuakeProgram;
    readonly words: Int32Array<ArrayBuffer>;
    readonly values: Float32Array<ArrayBuffer>;
    readonly edicts: QuakeEdict[] = [];
    readonly builtins = new Map<number, QuakeBuiltin>();
    readonly dynamicStrings = new Map<number, string>();
    private serverActive = false;
    private serverTime = 0;
    private nextStringReference: number;

    constructor(program: QuakeProgram) {
        this.program = program;
        this.words = new Int32Array(program.globalWords);
        this.values = new Float32Array(this.words.buffer);
        this.nextStringReference = program.strings.length;
        this.allocateEdict();
    }

    allocateEdict(): number {
        const reusable = this.edicts.findIndex((edict, index) => index > 1 && edict.free &&
            (edict.freeTime < 2 || this.serverTime - edict.freeTime > 0.5)
        );
        if (reusable !== -1) {
            const edict = this.edicts[reusable];
            edict.words.fill(0);
            edict.free = false;
            edict.generation++;
            return reusable;
        }
        this.edicts.push(new QuakeEdict(this.program.header.entityFieldCount));
        return this.edicts.length - 1;
    }

    freeEdict(reference: number): void {
        const edict = this.entity(reference);
        edict.free = true;
        edict.freeTime = this.serverTime;
        const clearWord = (name: string): void => {
            const definition = this.program.fieldsByName.get(name);
            if (definition) edict.words[definition.offset] = 0;
        };
        const clearFloat = (name: string, value = 0): void => {
            const definition = this.program.fieldsByName.get(name);
            if (definition) edict.values[definition.offset] = value;
        };
        const clearVector = (name: string): void => {
            const definition = this.program.fieldsByName.get(name);
            if (definition) edict.values.fill(0, definition.offset, definition.offset + 3);
        };
        clearWord('model');
        for (const name of ['takedamage', 'modelindex', 'colormap', 'skin', 'frame', 'solid']) {
            clearFloat(name);
        }
        clearVector('origin');
        clearVector('angles');
        clearFloat('nextthink', -1);
    }

    loadEdict(properties: EntityDictionary, reference = this.allocateEdict()): number {
        for (const [originalKey, value] of Object.entries(properties)) {
            if (originalKey.startsWith('_')) {
                continue;
            }
            const key = originalKey === 'light' ? 'light_lev' : originalKey;
            if (key === 'angle') {
                this.setEntityVector(reference, 'angles', [0, Number(value), 0]);
                continue;
            }
            const definition = this.program.fieldsByName.get(key);
            if (!definition) {
                continue;
            }
            const type = definition.type & TYPE_MASK;
            const edict = this.entity(reference);
            switch (type) {
                case QuakeValueType.String:
                    edict.words[definition.offset] = this.internString(value);
                    break;
                case QuakeValueType.Float:
                    edict.values[definition.offset] = Number(value);
                    break;
                case QuakeValueType.Vector:
                    edict.values.set(parseVector(value), definition.offset);
                    break;
                case QuakeValueType.Entity:
                    edict.words[definition.offset] = Number(value);
                    break;
                case QuakeValueType.Field:
                    edict.words[definition.offset] = this.field(value).offset;
                    break;
                case QuakeValueType.Function:
                    edict.words[definition.offset] = this.program.findFunction(value).index;
                    break;
                default:
                    break;
            }
        }
        return reference;
    }

    entity(reference: number): QuakeEdict {
        const edict = this.edicts[reference];
        if (!edict) {
            throw new Error(`Invalid QuakeC entity reference ${reference}`);
        }
        return edict;
    }

    registerBuiltin(index: number, builtin: QuakeBuiltin): void {
        this.builtins.set(index, builtin);
    }

    setServerActive(active = true): void {
        this.serverActive = active;
    }

    isServerActive(): boolean {
        return this.serverActive;
    }

    createSaveState(): QuakeVmSaveState {
        const savedGlobals: Array<readonly [number, number]> = [];
        for (const definition of this.program.globalDefinitions) {
            const type = definition.type & TYPE_MASK;
            if ((definition.type & DEF_SAVEGLOBAL) !== 0 && [
                QuakeValueType.String,
                QuakeValueType.Float,
                QuakeValueType.Entity
            ].includes(type)) {
                savedGlobals.push([definition.offset, this.words[definition.offset]]);
            }
        }
        return {
            dynamicStrings: [...this.dynamicStrings],
            edicts: this.edicts.map(edict => ({
                free: edict.free,
                freeTime: edict.freeTime,
                generation: edict.generation,
                words: Array.from(edict.words)
            })),
            programCrc: this.program.header.crc,
            savedGlobals,
            serverActive: this.serverActive,
            serverTime: this.serverTime,
            version: 1
        };
    }

    restoreSaveState(state: QuakeVmSaveState): void {
        if (state.version !== 1 || state.programCrc !== this.program.header.crc) {
            throw new Error('Savegame QuakeC program does not match progs.dat');
        }
        if (!Number.isFinite(state.serverTime) || state.serverTime < 0 ||
            typeof state.serverActive !== 'boolean') {
            throw new Error('Savegame has invalid QuakeC server state');
        }
        const savedGlobalOffsets = new Set(this.program.globalDefinitions
        .filter(definition => (definition.type & DEF_SAVEGLOBAL) !== 0 && [
            QuakeValueType.String,
            QuakeValueType.Float,
            QuakeValueType.Entity
        ].includes(definition.type & TYPE_MASK))
        .map(definition => definition.offset));
        if (!Array.isArray(state.savedGlobals)) {
            throw new Error('Savegame QuakeC globals are missing');
        }
        for (const entry of state.savedGlobals) {
            if (!Array.isArray(entry) || entry.length !== 2 ||
                !savedGlobalOffsets.has(entry[0]) || !Number.isInteger(entry[1])) {
                throw new Error('Savegame contains an invalid QuakeC global');
            }
            this.words[entry[0]] = entry[1];
        }
        if (!Array.isArray(state.dynamicStrings)) {
            throw new Error('Savegame QuakeC strings are missing');
        }
        this.dynamicStrings.clear();
        let nextStringReference = this.program.strings.length;
        for (const entry of state.dynamicStrings) {
            if (!Array.isArray(entry) || entry.length !== 2 ||
                !Number.isInteger(entry[0]) || entry[0] < this.program.strings.length ||
                typeof entry[1] !== 'string') {
                throw new Error('Savegame contains an invalid QuakeC string');
            }
            this.dynamicStrings.set(entry[0], entry[1]);
            nextStringReference = Math.max(nextStringReference, entry[0] + 1);
        }
        if (!Array.isArray(state.edicts) || state.edicts.length < 2 ||
            state.edicts.length > 8_192) {
            throw new Error('Savegame has an invalid QuakeC edict count');
        }
        const fieldCount = this.program.header.entityFieldCount;
        const restoredEdicts: QuakeEdict[] = [];
        for (const savedEdict of state.edicts) {
            if (!savedEdict || typeof savedEdict.free !== 'boolean' ||
                !Number.isFinite(savedEdict.freeTime) ||
                !Number.isInteger(savedEdict.generation) || savedEdict.generation < 1 ||
                !Array.isArray(savedEdict.words) || savedEdict.words.length !== fieldCount ||
                savedEdict.words.some(word => !Number.isInteger(word))) {
                throw new Error('Savegame contains an invalid QuakeC edict');
            }
            const edict = new QuakeEdict(fieldCount);
            edict.words.set(savedEdict.words);
            edict.free = savedEdict.free;
            edict.freeTime = savedEdict.freeTime;
            edict.generation = savedEdict.generation;
            restoredEdicts.push(edict);
        }
        this.edicts.length = 0;
        this.edicts.push(...restoredEdicts);
        this.nextStringReference = nextStringReference;
        this.serverActive = state.serverActive;
        this.serverTime = state.serverTime;
    }

    setServerTime(time: number): void {
        this.serverTime = time;
    }

    internString(value: string): number {
        for (const [reference, existing] of this.dynamicStrings) {
            if (existing === value) {
                return reference;
            }
        }
        const reference = this.nextStringReference++;
        this.dynamicStrings.set(reference, value);
        return reference;
    }

    getString(reference: number): string {
        return this.dynamicStrings.get(reference) ?? this.program.getString(reference);
    }

    getGlobalFloat(name: string): number {
        return this.values[this.global(name).offset];
    }

    setGlobalFloat(name: string, value: number): void {
        this.values[this.global(name).offset] = value;
    }

    getGlobalWord(name: string): number {
        return this.words[this.global(name).offset];
    }

    setGlobalWord(name: string, value: number): void {
        this.words[this.global(name).offset] = value;
    }

    setGlobalString(name: string, value: string): void {
        this.setGlobalWord(name, this.internString(value));
    }

    getGlobalVector(name: string): [number, number, number] {
        const offset = this.global(name).offset;
        return [this.values[offset], this.values[offset + 1], this.values[offset + 2]];
    }

    setGlobalVector(name: string, value: [number, number, number]): void {
        this.values.set(value, this.global(name).offset);
    }

    getEntityFloat(reference: number, fieldName: string): number {
        return this.entity(reference).values[this.field(fieldName).offset];
    }

    setEntityFloat(reference: number, fieldName: string, value: number): void {
        this.entity(reference).values[this.field(fieldName).offset] = value;
    }

    getEntityWord(reference: number, fieldName: string): number {
        return this.entity(reference).words[this.field(fieldName).offset];
    }

    setEntityWord(reference: number, fieldName: string, value: number): void {
        this.entity(reference).words[this.field(fieldName).offset] = value;
    }

    getEntityString(reference: number, fieldName: string): string {
        return this.getString(this.getEntityWord(reference, fieldName));
    }

    setEntityString(reference: number, fieldName: string, value: string): void {
        this.setEntityWord(reference, fieldName, this.internString(value));
    }

    getEntityVector(reference: number, fieldName: string): [number, number, number] {
        const offset = this.field(fieldName).offset;
        const values = this.entity(reference).values;
        return [values[offset], values[offset + 1], values[offset + 2]];
    }

    setEntityVector(reference: number, fieldName: string, value: [number, number, number]): void {
        this.entity(reference).values.set(value, this.field(fieldName).offset);
    }

    argumentFloat(index: number): number {
        return this.values[OFS_PARM0 + index * 3];
    }

    argumentWord(index: number): number {
        return this.words[OFS_PARM0 + index * 3];
    }

    argumentVector(index: number): [number, number, number] {
        const offset = OFS_PARM0 + index * 3;
        return [this.values[offset], this.values[offset + 1], this.values[offset + 2]];
    }

    argumentString(index: number): string {
        return this.getString(this.argumentWord(index));
    }

    setReturnFloat(value: number): void {
        this.values[OFS_RETURN] = value;
    }

    setReturnWord(value: number): void {
        this.words[OFS_RETURN] = value;
    }

    setReturnVector(value: [number, number, number]): void {
        this.values.set(value, OFS_RETURN);
    }

    setReturnString(value: string): void {
        this.setReturnWord(this.internString(value));
    }

    execute(functionNameOrIndex: string | number): void {
        const initialFunction = typeof functionNameOrIndex === 'string' ?
            this.program.findFunction(functionNameOrIndex) : this.functionAt(functionNameOrIndex);
        if (initialFunction.index === 0) {
            throw new Error('Cannot execute the null QuakeC function');
        }

        const stack: CallFrame[] = [];
        let currentFunction = initialFunction;
        let statementIndex = this.enterFunction(initialFunction, -1, stack);
        let runaway = MAX_RUNAWAY_STATEMENTS;

        while (runaway-- > 0) {
            statementIndex++;
            const statement = this.program.statements[statementIndex];
            if (!statement) {
                throw new Error(`QuakeC statement ${statementIndex} is outside progs.dat`);
            }
            const { a, b, c, opcode } = statement;
            switch (opcode) {
                case QuakeOpcode.AddFloat:
                    this.values[c] = this.values[a] + this.values[b];
                    break;
                case QuakeOpcode.AddVector:
                    this.vectorBinary(a, b, c, (left, right) => left + right);
                    break;
                case QuakeOpcode.SubtractFloat:
                    this.values[c] = this.values[a] - this.values[b];
                    break;
                case QuakeOpcode.SubtractVector:
                    this.vectorBinary(a, b, c, (left, right) => left - right);
                    break;
                case QuakeOpcode.MultiplyFloat:
                    this.values[c] = this.values[a] * this.values[b];
                    break;
                case QuakeOpcode.MultiplyVector:
                    this.values[c] = this.values[a] * this.values[b] +
                        this.values[a + 1] * this.values[b + 1] +
                        this.values[a + 2] * this.values[b + 2];
                    break;
                case QuakeOpcode.MultiplyFloatVector:
                    this.vectorScale(b, this.values[a], c);
                    break;
                case QuakeOpcode.MultiplyVectorFloat:
                    this.vectorScale(a, this.values[b], c);
                    break;
                case QuakeOpcode.DivideFloat:
                    this.values[c] = this.values[a] / this.values[b];
                    break;
                case QuakeOpcode.BitAnd:
                    this.values[c] = Math.trunc(this.values[a]) & Math.trunc(this.values[b]);
                    break;
                case QuakeOpcode.BitOr:
                    this.values[c] = Math.trunc(this.values[a]) | Math.trunc(this.values[b]);
                    break;
                case QuakeOpcode.GreaterOrEqual:
                    this.values[c] = this.values[a] >= this.values[b] ? 1 : 0;
                    break;
                case QuakeOpcode.LessOrEqual:
                    this.values[c] = this.values[a] <= this.values[b] ? 1 : 0;
                    break;
                case QuakeOpcode.GreaterThan:
                    this.values[c] = this.values[a] > this.values[b] ? 1 : 0;
                    break;
                case QuakeOpcode.LessThan:
                    this.values[c] = this.values[a] < this.values[b] ? 1 : 0;
                    break;
                case QuakeOpcode.And:
                    this.values[c] = this.values[a] && this.values[b] ? 1 : 0;
                    break;
                case QuakeOpcode.Or:
                    this.values[c] = this.values[a] || this.values[b] ? 1 : 0;
                    break;
                case QuakeOpcode.NotFloat:
                    this.values[c] = this.values[a] ? 0 : 1;
                    break;
                case QuakeOpcode.NotVector:
                    this.values[c] = this.values[a] || this.values[a + 1] || this.values[a + 2] ? 0 : 1;
                    break;
                case QuakeOpcode.NotString:
                    this.values[c] = this.words[a] && this.getString(this.words[a]) ? 0 : 1;
                    break;
                case QuakeOpcode.NotFunction:
                    this.values[c] = this.words[a] ? 0 : 1;
                    break;
                case QuakeOpcode.NotEntity:
                    this.values[c] = this.words[a] === 0 ? 1 : 0;
                    break;
                case QuakeOpcode.EqualFloat:
                    this.values[c] = this.values[a] === this.values[b] ? 1 : 0;
                    break;
                case QuakeOpcode.EqualVector:
                    this.values[c] = this.vectorEquals(a, b) ? 1 : 0;
                    break;
                case QuakeOpcode.EqualString:
                    this.values[c] = this.getString(this.words[a]) === this.getString(this.words[b]) ? 1 : 0;
                    break;
                case QuakeOpcode.EqualEntity:
                case QuakeOpcode.EqualFunction:
                    this.values[c] = this.words[a] === this.words[b] ? 1 : 0;
                    break;
                case QuakeOpcode.NotEqualFloat:
                    this.values[c] = this.values[a] !== this.values[b] ? 1 : 0;
                    break;
                case QuakeOpcode.NotEqualVector:
                    this.values[c] = this.vectorEquals(a, b) ? 0 : 1;
                    break;
                case QuakeOpcode.NotEqualString:
                    this.values[c] = this.compareStrings(
                        this.getString(this.words[a]),
                        this.getString(this.words[b])
                    );
                    break;
                case QuakeOpcode.NotEqualEntity:
                case QuakeOpcode.NotEqualFunction:
                    this.values[c] = this.words[a] !== this.words[b] ? 1 : 0;
                    break;
                case QuakeOpcode.StoreFloat:
                case QuakeOpcode.StoreString:
                case QuakeOpcode.StoreEntity:
                case QuakeOpcode.StoreField:
                case QuakeOpcode.StoreFunction:
                    this.words[b] = this.words[a];
                    break;
                case QuakeOpcode.StoreVector:
                    this.copyWords(this.words, a, this.words, b, 3);
                    break;
                case QuakeOpcode.StorePointerFloat:
                case QuakeOpcode.StorePointerString:
                case QuakeOpcode.StorePointerEntity:
                case QuakeOpcode.StorePointerField:
                case QuakeOpcode.StorePointerFunction:
                    this.writePointer(this.words[b], a, 1);
                    break;
                case QuakeOpcode.StorePointerVector:
                    this.writePointer(this.words[b], a, 3);
                    break;
                case QuakeOpcode.Address:
                    if (this.serverActive && this.words[a] === 0) {
                        throw new Error('QuakeC assignment to world entity');
                    }
                    this.words[c] = (this.words[a] * this.program.header.entityFieldCount + this.words[b]) * 4;
                    break;
                case QuakeOpcode.LoadFloat:
                case QuakeOpcode.LoadString:
                case QuakeOpcode.LoadEntity:
                case QuakeOpcode.LoadField:
                case QuakeOpcode.LoadFunction:
                    this.readEntityField(this.words[a], this.words[b], c, 1);
                    break;
                case QuakeOpcode.LoadVector:
                    this.readEntityField(this.words[a], this.words[b], c, 3);
                    break;
                case QuakeOpcode.IfNot:
                    if (!this.words[a]) statementIndex += b - 1;
                    break;
                case QuakeOpcode.If:
                    if (this.words[a]) statementIndex += b - 1;
                    break;
                case QuakeOpcode.GoTo:
                    statementIndex += a - 1;
                    break;
                case QuakeOpcode.Call0:
                case QuakeOpcode.Call1:
                case QuakeOpcode.Call2:
                case QuakeOpcode.Call3:
                case QuakeOpcode.Call4:
                case QuakeOpcode.Call5:
                case QuakeOpcode.Call6:
                case QuakeOpcode.Call7:
                case QuakeOpcode.Call8: {
                    const argumentCount = opcode - QuakeOpcode.Call0;
                    const functionIndex = this.words[a];
                    if (functionIndex === 0) {
                        throw new Error(`QuakeC NULL function called by ${currentFunction.name}`);
                    }
                    const calledFunction = this.functionAt(functionIndex);
                    if (calledFunction.firstStatement < 0) {
                        const builtinIndex = -calledFunction.firstStatement;
                        const builtin = this.builtins.get(builtinIndex);
                        if (!builtin) {
                            throw new Error(
                                `Unimplemented QuakeC builtin ${builtinIndex} called by ${currentFunction.name}`
                            );
                        }
                        builtin(this, argumentCount);
                    } else {
                        currentFunction = calledFunction;
                        statementIndex = this.enterFunction(
                            calledFunction, statementIndex, stack
                        );
                    }
                    break;
                }
                case QuakeOpcode.Done:
                case QuakeOpcode.Return:
                    this.copyWords(this.words, a, this.words, OFS_RETURN, 3);
                    statementIndex = this.leaveFunction(stack);
                    if (stack.length === 0) {
                        return;
                    }
                    currentFunction = stack.at(-1)!.quakeFunction;
                    break;
                case QuakeOpcode.State:
                    this.executeState(a, b);
                    break;
                default:
                    throw new Error(
                        `Unsupported QuakeC opcode ${opcode} in ${currentFunction.name} at ${statementIndex}`
                    );
            }
        }
        throw new Error(`QuakeC runaway loop in ${currentFunction.name}`);
    }

    private enterFunction(
        quakeFunction: QuakeFunction,
        returnStatement: number,
        stack: CallFrame[]
    ): number {
        if (stack.length >= MAX_STACK_DEPTH) {
            throw new Error('QuakeC call stack overflow');
        }
        const savedLocals = this.words.slice(
            quakeFunction.parameterStart,
            quakeFunction.parameterStart + quakeFunction.localCount
        );
        stack.push({ quakeFunction, returnStatement, savedLocals });
        let destination = quakeFunction.parameterStart;
        for (let parameter = 0; parameter < quakeFunction.parameterCount; parameter++) {
            const size = quakeFunction.parameterSizes[parameter];
            this.copyWords(this.words, OFS_PARM0 + parameter * 3, this.words, destination, size);
            destination += size;
        }
        return quakeFunction.firstStatement - 1;
    }

    private leaveFunction(stack: CallFrame[]): number {
        const frame = stack.pop();
        if (!frame) {
            throw new Error('QuakeC call stack underflow');
        }
        this.words.set(frame.savedLocals, frame.quakeFunction.parameterStart);
        return frame.returnStatement;
    }

    private executeState(frameOffset: number, thinkOffset: number): void {
        const self = this.getGlobalWord('self');
        this.setEntityFloat(self, 'nextthink', this.getGlobalFloat('time') + 0.1);
        this.setEntityFloat(self, 'frame', this.values[frameOffset]);
        this.setEntityWord(self, 'think', this.words[thinkOffset]);
    }

    private readEntityField(entityReference: number, fieldOffset: number, target: number, count: number): void {
        this.copyWords(this.entity(entityReference).words, fieldOffset, this.words, target, count);
    }

    private writePointer(pointer: number, source: number, count: number): void {
        if (pointer % 4 !== 0) {
            throw new Error(`Misaligned QuakeC entity pointer ${pointer}`);
        }
        const wordPointer = pointer / 4;
        const entityReference = Math.floor(wordPointer / this.program.header.entityFieldCount);
        const fieldOffset = wordPointer % this.program.header.entityFieldCount;
        this.copyWords(this.words, source, this.entity(entityReference).words, fieldOffset, count);
    }

    private vectorBinary(
        left: number,
        right: number,
        target: number,
        operation: (left: number, right: number) => number
    ): void {
        for (let axis = 0; axis < 3; axis++) {
            this.values[target + axis] = operation(this.values[left + axis], this.values[right + axis]);
        }
    }

    private vectorScale(vector: number, scale: number, target: number): void {
        for (let axis = 0; axis < 3; axis++) {
            this.values[target + axis] = this.values[vector + axis] * scale;
        }
    }

    private vectorEquals(left: number, right: number): boolean {
        return this.values[left] === this.values[right] &&
            this.values[left + 1] === this.values[right + 1] &&
            this.values[left + 2] === this.values[right + 2];
    }

    private compareStrings(left: string, right: string): number {
        if (left === right) return 0;
        return left < right ? -1 : 1;
    }

    private copyWords(
        source: Int32Array<ArrayBuffer>,
        sourceOffset: number,
        target: Int32Array<ArrayBuffer>,
        targetOffset: number,
        count: number
    ): void {
        for (let index = 0; index < count; index++) {
            target[targetOffset + index] = source[sourceOffset + index];
        }
    }

    private functionAt(index: number): QuakeFunction {
        const quakeFunction = this.program.functions[index];
        if (!quakeFunction) {
            throw new Error(`Invalid QuakeC function index ${index}`);
        }
        return quakeFunction;
    }

    private field(name: string): QuakeDefinition {
        const definition = this.program.fieldsByName.get(name);
        if (!definition) {
            throw new Error(`QuakeC field not found: ${name}`);
        }
        return definition;
    }

    private global(name: string): QuakeDefinition {
        const definition = this.program.globalsByName.get(name);
        if (!definition) {
            throw new Error(`QuakeC global not found: ${name}`);
        }
        return definition;
    }
}
