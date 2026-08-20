import { assertRange, BinaryReader } from './binary';

export const PROGS_VERSION = 6;
export const PROGS_CRC = 5927;

const HEADER_SIZE = 60;
const STATEMENT_SIZE = 8;
const DEFINITION_SIZE = 8;
const FUNCTION_SIZE = 36;

export interface QuakeStatement {
    opcode: number;
    a: number;
    b: number;
    c: number;
}

export interface QuakeDefinition {
    type: number;
    offset: number;
    nameOffset: number;
    name: string;
}

export interface QuakeFunction {
    index: number;
    firstStatement: number;
    parameterStart: number;
    localCount: number;
    profile: number;
    nameOffset: number;
    fileOffset: number;
    name: string;
    file: string;
    parameterCount: number;
    parameterSizes: [number, number, number, number, number, number, number, number];
}

interface ProgsHeader {
    version: number;
    crc: number;
    statementsOffset: number;
    statementCount: number;
    globalDefinitionsOffset: number;
    globalDefinitionCount: number;
    fieldDefinitionsOffset: number;
    fieldDefinitionCount: number;
    functionsOffset: number;
    functionCount: number;
    stringsOffset: number;
    stringSize: number;
    globalsOffset: number;
    globalCount: number;
    entityFieldCount: number;
}

export class QuakeProgram {
    readonly bytes: Uint8Array<ArrayBufferLike>;
    readonly reader: BinaryReader;
    readonly header: ProgsHeader;
    readonly strings: Uint8Array<ArrayBufferLike>;
    readonly statements: QuakeStatement[];
    readonly globalDefinitions: QuakeDefinition[];
    readonly fieldDefinitions: QuakeDefinition[];
    readonly functions: QuakeFunction[];
    readonly globalWords: Int32Array<ArrayBuffer>;
    readonly globalValues: Float32Array<ArrayBuffer>;
    readonly functionsByName = new Map<string, QuakeFunction>();
    readonly fieldsByName = new Map<string, QuakeDefinition>();
    readonly globalsByName = new Map<string, QuakeDefinition>();

    constructor(data: ArrayBuffer | Uint8Array<ArrayBufferLike>) {
        this.bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        this.reader = new BinaryReader(this.bytes);
        this.header = this.parseHeader();
        this.validateHeader();
        this.strings = this.reader.slice(this.header.stringsOffset, this.header.stringSize);
        this.statements = this.parseStatements();
        this.globalDefinitions = this.parseDefinitions(
            this.header.globalDefinitionsOffset,
            this.header.globalDefinitionCount
        );
        this.fieldDefinitions = this.parseDefinitions(
            this.header.fieldDefinitionsOffset,
            this.header.fieldDefinitionCount
        );
        this.functions = this.parseFunctions();
        this.globalWords = new Int32Array(this.header.globalCount);
        this.globalValues = new Float32Array(this.globalWords.buffer);
        for (let index = 0; index < this.header.globalCount; index++) {
            this.globalWords[index] = this.reader.int32(this.header.globalsOffset + index * 4);
        }
        for (const definition of this.globalDefinitions) {
            this.globalsByName.set(definition.name, definition);
        }
        for (const definition of this.fieldDefinitions) {
            this.fieldsByName.set(definition.name, definition);
        }
        for (const quakeFunction of this.functions) {
            if (quakeFunction.name) {
                this.functionsByName.set(quakeFunction.name, quakeFunction);
            }
        }
    }

    getString(offset: number): string {
        if (offset < 0 || offset >= this.strings.length) {
            throw new Error(`QuakeC string offset ${offset} is outside the string table`);
        }
        const terminator = this.strings.indexOf(0, offset);
        const end = terminator === -1 ? this.strings.length : terminator;
        return new TextDecoder('windows-1252').decode(this.strings.subarray(offset, end));
    }

    findFunction(name: string): QuakeFunction {
        const quakeFunction = this.functionsByName.get(name);
        if (!quakeFunction) {
            throw new Error(`QuakeC function not found: ${name}`);
        }
        return quakeFunction;
    }

    private parseHeader(): ProgsHeader {
        if (this.bytes.length < HEADER_SIZE) {
            throw new Error('progs.dat header is truncated');
        }
        return {
            version: this.reader.int32(0),
            crc: this.reader.int32(4),
            statementsOffset: this.reader.int32(8),
            statementCount: this.reader.int32(12),
            globalDefinitionsOffset: this.reader.int32(16),
            globalDefinitionCount: this.reader.int32(20),
            fieldDefinitionsOffset: this.reader.int32(24),
            fieldDefinitionCount: this.reader.int32(28),
            functionsOffset: this.reader.int32(32),
            functionCount: this.reader.int32(36),
            stringsOffset: this.reader.int32(40),
            stringSize: this.reader.int32(44),
            globalsOffset: this.reader.int32(48),
            globalCount: this.reader.int32(52),
            entityFieldCount: this.reader.int32(56)
        };
    }

    private validateHeader(): void {
        if (this.header.version !== PROGS_VERSION) {
            throw new Error(`Unsupported progs.dat version ${this.header.version}`);
        }
        if (this.header.crc !== PROGS_CRC) {
            throw new Error(`Unexpected progs.dat system CRC ${this.header.crc}`);
        }
        assertRange(
            this.bytes,
            this.header.statementsOffset,
            this.header.statementCount * STATEMENT_SIZE,
            'QuakeC statements'
        );
        assertRange(
            this.bytes,
            this.header.globalDefinitionsOffset,
            this.header.globalDefinitionCount * DEFINITION_SIZE,
            'QuakeC global definitions'
        );
        assertRange(
            this.bytes,
            this.header.fieldDefinitionsOffset,
            this.header.fieldDefinitionCount * DEFINITION_SIZE,
            'QuakeC field definitions'
        );
        assertRange(
            this.bytes,
            this.header.functionsOffset,
            this.header.functionCount * FUNCTION_SIZE,
            'QuakeC functions'
        );
        assertRange(this.bytes, this.header.stringsOffset, this.header.stringSize, 'QuakeC strings');
        assertRange(
            this.bytes,
            this.header.globalsOffset,
            this.header.globalCount * 4,
            'QuakeC globals'
        );
    }

    private parseStatements(): QuakeStatement[] {
        return Array.from({ length: this.header.statementCount }, (_, index) => {
            const offset = this.header.statementsOffset + index * STATEMENT_SIZE;
            return {
                opcode: this.reader.uint16(offset),
                a: this.reader.int16(offset + 2),
                b: this.reader.int16(offset + 4),
                c: this.reader.int16(offset + 6)
            };
        });
    }

    private parseDefinitions(offset: number, count: number): QuakeDefinition[] {
        return Array.from({ length: count }, (_, index) => {
            const definitionOffset = offset + index * DEFINITION_SIZE;
            const nameOffset = this.reader.int32(definitionOffset + 4);
            return {
                type: this.reader.uint16(definitionOffset),
                offset: this.reader.uint16(definitionOffset + 2),
                nameOffset,
                name: this.getString(nameOffset)
            };
        });
    }

    private parseFunctions(): QuakeFunction[] {
        return Array.from({ length: this.header.functionCount }, (_, index) => {
            const offset = this.header.functionsOffset + index * FUNCTION_SIZE;
            const nameOffset = this.reader.int32(offset + 16);
            const fileOffset = this.reader.int32(offset + 20);
            return {
                index,
                firstStatement: this.reader.int32(offset),
                parameterStart: this.reader.int32(offset + 4),
                localCount: this.reader.int32(offset + 8),
                profile: this.reader.int32(offset + 12),
                nameOffset,
                fileOffset,
                name: this.getString(nameOffset),
                file: this.getString(fileOffset),
                parameterCount: this.reader.int32(offset + 24),
                parameterSizes: [
                    this.reader.uint8(offset + 28),
                    this.reader.uint8(offset + 29),
                    this.reader.uint8(offset + 30),
                    this.reader.uint8(offset + 31),
                    this.reader.uint8(offset + 32),
                    this.reader.uint8(offset + 33),
                    this.reader.uint8(offset + 34),
                    this.reader.uint8(offset + 35)
                ]
            };
        });
    }
}
