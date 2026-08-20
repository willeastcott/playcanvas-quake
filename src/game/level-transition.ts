export const QUAKE_SPAWN_PARAMETER_COUNT = 16;

export interface QuakeLevelTransitionState {
    cvars: Record<string, string>;
    mapName: string;
    serverFlags: number;
    spawnParameters: number[];
}

export const quakeMapName = (value: string | null | undefined): string | undefined => {
    const normalized = value?.trim().toLowerCase();
    return normalized && /^[a-z\d_]{1,32}$/.test(normalized) ? normalized : undefined;
};

export const quakeMapPath = (mapName: string): string | undefined => {
    const normalized = quakeMapName(mapName);
    return normalized ? `maps/${normalized}.bsp` : undefined;
};

export const parseQuakeLevelTransition = (
    value: string | null,
    expectedMapName: string
): QuakeLevelTransitionState | undefined => {
    if (!value) return undefined;
    try {
        const candidate = JSON.parse(value) as Partial<QuakeLevelTransitionState>;
        const mapName = quakeMapName(candidate.mapName);
        const serverFlags = candidate.serverFlags;
        if (!mapName || mapName !== quakeMapName(expectedMapName) ||
            typeof serverFlags !== 'number' || !Number.isFinite(serverFlags) ||
            !Array.isArray(candidate.spawnParameters) ||
            candidate.spawnParameters.length !== QUAKE_SPAWN_PARAMETER_COUNT ||
            candidate.spawnParameters.some(value => !Number.isFinite(value)) ||
            !candidate.cvars || typeof candidate.cvars !== 'object' ||
            Array.isArray(candidate.cvars) || Object.values(candidate.cvars).some(
            value => typeof value !== 'string'
        )) {
            return undefined;
        }
        return {
            cvars: { ...candidate.cvars } as Record<string, string>,
            mapName,
            serverFlags,
            spawnParameters: [...candidate.spawnParameters]
        };
    } catch {
        return undefined;
    }
};
