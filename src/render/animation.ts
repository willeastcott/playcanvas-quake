export const quakeEntitySyncBase = (reference: number): number => (
    (Math.imul(reference, 2_654_435_761) >>> 0) & 0x7fff
) / 0x7fff;

export const quakeModelIndex = (requested: number, count: number): number => {
    const index = Math.trunc(requested);
    return Number.isFinite(index) && index >= 0 && index < count ? index : 0;
};

export const quakeGroupFrameIndex = (
    intervals: readonly number[],
    time: number,
    syncBase = 0
): number => {
    if (intervals.length <= 1) {
        return 0;
    }
    const fullInterval = intervals.at(-1) ?? 0;
    if (fullInterval <= 0) {
        return 0;
    }
    const target = (time + syncBase) % fullInterval;
    const index = intervals.findIndex(interval => interval > target);
    return index === -1 ? intervals.length - 1 : index;
};
