export const QUAKE_MAX_DEMOS = 8;
export const QUAKE_DEFAULT_DEMOS = ['demo1', 'demo2', 'demo3'] as const;

export interface QuakeDemoLoopState {
    demos: string[];
    nextIndex: number;
}

export interface QuakeNextDemo {
    demo: string;
    state: QuakeDemoLoopState;
}

export const quakeDemoPath = (value: string | null): string | undefined => {
    if (value === null) return undefined;
    const normalized = value.toLowerCase().endsWith('.dem') ?
        value.toLowerCase() : `${value.toLowerCase()}.dem`;
    return /^[a-z0-9_-]+\.dem$/u.test(normalized) ? normalized : undefined;
};

export const quakeDemoLoopNames = (values: readonly string[]): string[] => values
.slice(0, QUAKE_MAX_DEMOS)
.flatMap((value) => {
    const path = quakeDemoPath(value);
    return path ? [path.slice(0, -4)] : [];
});

export const quakeNextDemo = (state: QuakeDemoLoopState): QuakeNextDemo | undefined => {
    if (state.demos.length === 0) return undefined;
    let index = state.nextIndex;
    if (index < 0 || index >= state.demos.length || index >= QUAKE_MAX_DEMOS) index = 0;
    const demo = state.demos[index];
    if (!demo) return undefined;
    return {
        demo,
        state: {
            demos: [...state.demos],
            nextIndex: index + 1
        }
    };
};

export const parseQuakeDemoLoopState = (value: string | null): QuakeDemoLoopState | undefined => {
    if (value === null) return undefined;
    try {
        const parsed = JSON.parse(value) as Partial<QuakeDemoLoopState>;
        if (!Array.isArray(parsed.demos) || !Number.isInteger(parsed.nextIndex)) {
            return undefined;
        }
        const demos = quakeDemoLoopNames(parsed.demos.filter(
            (demo): demo is string => typeof demo === 'string'
        ));
        if (demos.length === 0) return undefined;
        return { demos, nextIndex: parsed.nextIndex as number };
    } catch {
        return undefined;
    }
};

export const serializeQuakeDemoLoopState = (state: QuakeDemoLoopState): string => JSON.stringify({
    demos: quakeDemoLoopNames(state.demos),
    nextIndex: state.nextIndex
});
