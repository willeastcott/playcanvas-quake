import type { BspFace, BspMap } from '../formats/bsp';

const MAX_ATLAS_SIZE = 4096;

export interface DynamicLightSource {
    minimumLight: number;
    origin: [number, number, number];
    radius: number;
}

const dot = (left: number[], right: number[]): number => left.reduce(
    (sum, component, axis) => sum + component * (right[axis] ?? 0), 0
);

export const quakeDynamicLightContribution = (
    radius: number,
    minimumLight: number,
    planeDistance: number,
    sDistance: number,
    tDistance: number
): number => {
    const surfaceRadius = radius - Math.abs(planeDistance);
    if (surfaceRadius < minimumLight) {
        return 0;
    }
    const cutoff = surfaceRadius - minimumLight;
    const s = Math.abs(Math.trunc(sDistance));
    const t = Math.abs(Math.trunc(tDistance));
    const distance = s > t ? s + Math.floor(t / 2) : t + Math.floor(s / 2);
    return distance < cutoff ? Math.trunc((surfaceRadius - distance) * 256) : 0;
};

export const quakeDynamicLightmapValue = (blockLight: number): number => {
    return Math.min(255, Math.max(0, Math.trunc(blockLight / 256)));
};

const placeFaces = (faces: BspFace[], atlasSize: number): boolean => {
    let x = 0;
    let y = 0;
    let rowHeight = 0;
    for (const face of faces) {
        const [width, height] = face.lightmapSize;
        if (x + width + 1 > atlasSize) {
            x = 0;
            y += rowHeight;
            rowHeight = 0;
        }
        if (y + height + 1 > atlasSize) {
            return false;
        }
        face.lightmapAtlas = { x, y, width, height };
        x += width + 1;
        rowHeight = Math.max(rowHeight, height + 1);
    }
    return true;
};

export const buildLightmapAtlas = (
    map: BspMap
): { size: number; pixels: Uint8Array<ArrayBuffer> } => {
    const faces = map.faces
    .filter(face => face.lightOffset >= 0)
    .sort((left, right) => right.lightmapSize[1] - left.lightmapSize[1]);
    let size = 512;
    while (size <= MAX_ATLAS_SIZE && !placeFaces(faces, size)) {
        size *= 2;
    }
    if (size > MAX_ATLAS_SIZE) {
        throw new Error('BSP lightmaps do not fit in a 4096×4096 atlas');
    }

    const pixels = new Uint8Array(size * size * 4);
    for (const face of faces) {
        const placement = face.lightmapAtlas;
        if (!placement) {
            throw new Error('Lightmap face was not placed in the atlas');
        }
        const sampleCount = placement.width * placement.height;
        for (let channel = 0; channel < 4 && face.styles[channel] !== 255; channel++) {
            const sourceOffset = face.lightOffset + channel * sampleCount;
            if (sourceOffset + sampleCount > map.lightData.length) {
                throw new Error(`Face lightmap at ${sourceOffset} exceeds the lighting lump`);
            }
            for (let targetY = 0; targetY <= placement.height; targetY++) {
                for (let targetX = 0; targetX <= placement.width; targetX++) {
                    const sourceX = Math.min(targetX, placement.width - 1);
                    const sourceY = Math.min(targetY, placement.height - 1);
                    const source = sourceOffset + sourceY * placement.width + sourceX;
                    const target = ((placement.y + targetY) * size +
                        placement.x + targetX) * 4 + channel;
                    pixels[target] = map.lightData[source];
                }
            }
        }
    }
    return { size, pixels };
};

export const buildDynamicLightmap = (
    map: BspMap,
    atlasSize: number,
    lights: readonly DynamicLightSource[],
    pixels = new Uint8Array(atlasSize * atlasSize)
): Uint8Array<ArrayBuffer> => {
    if (pixels.length !== atlasSize * atlasSize) {
        throw new Error('Dynamic lightmap buffer does not match its atlas size');
    }
    pixels.fill(0);
    if (lights.length === 0) {
        return pixels;
    }

    for (const face of map.faces) {
        const placement = face.lightmapAtlas;
        if (!placement || face.lightOffset < 0) {
            continue;
        }
        const plane = map.planes[face.plane];
        const textureInfo = map.textureInfo[face.textureInfo];
        const accumulated = new Uint32Array(placement.width * placement.height);
        for (const light of lights) {
            const planeDistance = dot(light.origin, plane.normal) - plane.distance;
            const impact = light.origin.map(
                (component, axis) => component - plane.normal[axis] * planeDistance
            );
            const localS = dot(impact, textureInfo.vectors[0]) +
                textureInfo.vectors[0][3] - face.lightmapMins[0] * 16;
            const localT = dot(impact, textureInfo.vectors[1]) +
                textureInfo.vectors[1][3] - face.lightmapMins[1] * 16;
            for (let t = 0; t < placement.height; t++) {
                for (let s = 0; s < placement.width; s++) {
                    accumulated[t * placement.width + s] += quakeDynamicLightContribution(
                        light.radius,
                        light.minimumLight,
                        planeDistance,
                        localS - s * 16,
                        localT - t * 16
                    );
                }
            }
        }
        for (let t = 0; t < placement.height; t++) {
            for (let s = 0; s < placement.width; s++) {
                const source = accumulated[t * placement.width + s];
                pixels[(placement.y + t) * atlasSize + placement.x + s] =
                    quakeDynamicLightmapValue(source);
            }
        }
        for (let t = 0; t <= placement.height; t++) {
            const sourceT = Math.min(t, placement.height - 1);
            pixels[(placement.y + t) * atlasSize + placement.x + placement.width] =
                pixels[(placement.y + sourceT) * atlasSize +
                    placement.x + placement.width - 1];
        }
        const bottomRow = placement.y + placement.height;
        const sourceRow = bottomRow - 1;
        for (let s = 0; s < placement.width; s++) {
            pixels[bottomRow * atlasSize + placement.x + s] =
                pixels[sourceRow * atlasSize + placement.x + s];
        }
    }
    return pixels;
};
