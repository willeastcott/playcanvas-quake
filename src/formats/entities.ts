const WHITESPACE = /\s/u;

export type EntityDictionary = Record<string, string>;

interface TokenState {
    offset: number;
}

const readToken = (source: string, state: TokenState): string | null => {
    while (state.offset < source.length && WHITESPACE.test(source[state.offset])) {
        state.offset++;
    }

    if (state.offset >= source.length) {
        return null;
    }

    const first = source[state.offset++];
    if (first === '{' || first === '}') {
        return first;
    }

    if (first !== '"') {
        throw new Error(`Unexpected entity token at byte ${state.offset - 1}`);
    }

    let value = '';
    while (state.offset < source.length) {
        const character = source[state.offset++];
        if (character === '"') {
            return value;
        }
        if (character === '\\' && state.offset < source.length) {
            const escaped = source[state.offset++];
            value += escaped === 'n' ? '\n' : '\\';
        } else {
            value += character;
        }
    }
    throw new Error('Unterminated entity string');
};

export const parseEntities = (source: string): EntityDictionary[] => {
    const state = { offset: 0 };
    const entities = [];

    while (true) {
        const opening = readToken(source, state);
        if (opening === null) {
            break;
        }
        if (opening !== '{') {
            throw new Error('Expected an entity opening brace');
        }

        const entity: EntityDictionary = {};
        while (true) {
            const key = readToken(source, state);
            if (key === '}') {
                break;
            }
            if (key === null || key === '{') {
                throw new Error('Malformed entity dictionary');
            }
            const value = readToken(source, state);
            if (value === null || value === '{' || value === '}') {
                throw new Error(`Missing value for entity key ${key}`);
            }
            entity[key] = value;
        }
        entities.push(entity);
    }

    return entities;
};

export const parseVector = (
    value: string | undefined,
    fallback: [number, number, number] = [0, 0, 0]
): [number, number, number] => {
    if (!value) {
        return [...fallback];
    }
    const values = value.trim().split(/\s+/u).map(Number);
    return values.length === 3 && values.every(Number.isFinite) ?
        values as [number, number, number] : [...fallback];
};
