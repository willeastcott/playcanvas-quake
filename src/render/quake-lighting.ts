import { quakeAliasLightDirection } from './quake-transform';
import type { BspMap, Vec3 } from '../formats/bsp';

const LIGHTSTYLE_PATTERNS = [
    'm',
    'mmnmmommommnonmmonqnmmo',
    'abcdefghijklmnopqrstuvwxyzyxwvutsrqponmlkjihgfedcba',
    'mmmmmaaaaammmmmaaaaaabcdefgabcdefg',
    'mamamamamama',
    'jklmnopqrstuvwxyzyxwvutsrqponmlkj',
    'nmonqnmomnmomomno',
    'mmmaaaabcdefgmmmmaaaammmaamm',
    'mmmaaammmaaammmabcdefaaaammmmabcdefmmmaaaa',
    'aaaaaaaazzzzzzzz',
    'mmamammmmammamamaaamammma',
    'abcdefghijklmnopqrrqponmlkjihgfedcba'
];

interface AliasDynamicLight {
    origin: Vec3;
    radius: number;
}

export interface QuakeAliasLighting {
    ambient: number;
    shade: number;
    shadeDirection: Vec3;
}

const dot = (left: Vec3, right: Vec3): number => left[0] * right[0] +
    left[1] * right[1] + left[2] * right[2];

export const quakeSurfaceDarkness = (blockLight: number): number => Math.max(
    64,
    Math.floor((255 * 256 - Math.trunc(blockLight)) / 4)
);

export const quakeSurfaceMipLevelForScale = (scale: number): number => {
    if (scale >= 1) return 0;
    if (scale >= 0.4) return 1;
    if (scale >= 0.2) return 2;
    return 3;
};

export const quakeSurfaceMipLevel = (texelsPerPixel: number): number => (
    quakeSurfaceMipLevelForScale(1 / Math.max(texelsPerPixel, 0.0001))
);

export const quakeTextureMipAdjustment = (
    vectors: readonly [
        readonly [number, number, number, number],
        readonly [number, number, number, number]
    ]
): number => {
    const firstLength = Math.hypot(...vectors[0].slice(0, 3));
    const secondLength = Math.hypot(...vectors[1].slice(0, 3));
    const averageLength = (firstLength + secondLength) / 2;
    if (averageLength < 0.32) return 4;
    if (averageLength < 0.49) return 3;
    if (averageLength < 0.99) return 2;
    return 1;
};

type ViewPoint = [number, number, number];

const clipSurface = (
    polygon: ViewPoint[],
    distance: (point: ViewPoint) => number
): ViewPoint[] => {
    if (polygon.length === 0) return polygon;
    const clipped: ViewPoint[] = [];
    let previous = polygon.at(-1) as ViewPoint;
    let previousDistance = distance(previous);
    for (const current of polygon) {
        const currentDistance = distance(current);
        const previousInside = previousDistance >= 0;
        const currentInside = currentDistance >= 0;
        if (previousInside !== currentInside) {
            const fraction = previousDistance / (previousDistance - currentDistance);
            clipped.push(previous.map(
                (component, axis) => component +
                    fraction * (current[axis] - component)
            ) as ViewPoint);
        }
        if (currentInside) clipped.push(current);
        previous = current;
        previousDistance = currentDistance;
    }
    return clipped;
};

export const quakeSurfaceMipLevelForView = (
    vertices: readonly Vec3[],
    cameraOrigin: Vec3,
    cameraRight: Vec3,
    cameraUp: Vec3,
    cameraForward: Vec3,
    viewWidth: number,
    viewHeight: number,
    mipAdjustment: number,
    fieldOfView = 90,
    pixelAspect = 5 / 6
): number | undefined => {
    if (vertices.length < 3 || viewWidth <= 0 || viewHeight <= 0) return undefined;
    let polygon = vertices.map((vertex): ViewPoint => {
        const relative = vertex.map(
            (component, axis) => component - cameraOrigin[axis]
        ) as Vec3;
        return [
            dot(relative, cameraRight),
            dot(relative, cameraUp),
            dot(relative, cameraForward)
        ];
    });
    const clampedFieldOfView = Math.max(10, Math.min(170, fieldOfView));
    const horizontalHalf = Math.tan(clampedFieldOfView * Math.PI / 360);
    const screenAspect = viewWidth * pixelAspect / viewHeight;
    const verticalHalf = horizontalHalf / screenAspect;
    for (const distance of [
        (point: ViewPoint): number => point[2] * horizontalHalf - point[0],
        (point: ViewPoint): number => point[2] * horizontalHalf + point[0],
        (point: ViewPoint): number => point[2] * verticalHalf - point[1],
        (point: ViewPoint): number => point[2] * verticalHalf + point[1]
    ]) {
        polygon = clipSurface(polygon, distance);
    }
    if (polygon.length < 3) return undefined;
    const nearZi = polygon.reduce(
        (nearest, point) => Math.max(nearest, 1 / Math.max(point[2], 0.01)), 0
    );
    const horizontalFieldOfView = horizontalHalf * 2;
    const xScale = viewWidth / horizontalFieldOfView;
    const scaleForMip = Math.max(xScale, xScale * pixelAspect);
    return quakeSurfaceMipLevelForScale(nearZi * scaleForMip * mipAdjustment);
};

export const quakeSurfaceLightGrade = (
    blockLights: readonly [number, number, number, number],
    x: number,
    y: number,
    mipLevel: number
): number => {
    const mip = Math.max(0, Math.min(3, Math.trunc(mipLevel)));
    const blockSize = 16 >> mip;
    const blockX = ((Math.trunc(x) % blockSize) + blockSize) % blockSize;
    const blockY = ((Math.trunc(y) % blockSize) + blockSize) % blockSize;
    const [topLeft, topRight, bottomLeft, bottomRight] = blockLights.map(
        quakeSurfaceDarkness
    );
    const left = topLeft + Math.floor((bottomLeft - topLeft) / blockSize) * blockY;
    const right = topRight + Math.floor(
        (bottomRight - topRight) / blockSize
    ) * blockY;
    const light = right + Math.floor((left - right) / blockSize) *
        (blockSize - 1 - blockX);
    return Math.max(0, Math.min(63, Math.floor(light / 256)));
};

export const quakeLightStyleScale = (
    style: number,
    time: number,
    dynamicStyles?: ReadonlyMap<number, string>
): number => {
    if (style === 255) {
        return 0;
    }
    const pattern = dynamicStyles?.get(style) ?? LIGHTSTYLE_PATTERNS[style] ?? 'm';
    if (pattern.length === 0) {
        return 0;
    }
    const character = pattern[Math.floor(time * 10) % pattern.length];
    return (character.charCodeAt(0) - 97) * 22;
};

export const quakeLightStyleValue = (
    style: number,
    time: number,
    dynamicStyles?: ReadonlyMap<number, string>
): number => quakeLightStyleScale(style, time, dynamicStyles) / 256;

const recursiveLightPoint = (
    map: BspMap,
    nodeIndex: number,
    start: Vec3,
    end: Vec3,
    time: number,
    dynamicStyles?: ReadonlyMap<number, string>
): number => {
    if (nodeIndex < 0) {
        return -1;
    }
    const node = map.nodes[nodeIndex];
    const plane = map.planes[node.plane];
    const front = dot(start, plane.normal) - plane.distance;
    const back = dot(end, plane.normal) - plane.distance;
    const side = front < 0 ? 1 : 0;
    if ((back < 0 ? 1 : 0) === side) {
        return recursiveLightPoint(map, node.children[side], start, end, time, dynamicStyles);
    }

    const fraction = front / (front - back);
    const middle = start.map(
        (component, axis) => component + (end[axis] - component) * fraction
    ) as Vec3;
    const frontResult = recursiveLightPoint(
        map, node.children[side], start, middle, time, dynamicStyles
    );
    if (frontResult >= 0) {
        return frontResult;
    }
    if ((back < 0 ? 1 : 0) === side) {
        return -1;
    }

    const lastFace = node.firstFace + node.faceCount;
    for (let faceIndex = node.firstFace; faceIndex < lastFace; faceIndex++) {
        const face = map.faces[faceIndex];
        const textureInfo = map.textureInfo[face.textureInfo];
        if ((textureInfo.flags & 1) !== 0) {
            continue;
        }
        const s = dot(middle, textureInfo.vectors[0].slice(0, 3) as Vec3) +
            textureInfo.vectors[0][3];
        const t = dot(middle, textureInfo.vectors[1].slice(0, 3) as Vec3) +
            textureInfo.vectors[1][3];
        const textureMinimumS = face.lightmapMins[0] * 16;
        const textureMinimumT = face.lightmapMins[1] * 16;
        const ds = s - textureMinimumS;
        const dt = t - textureMinimumT;
        if (ds < 0 || dt < 0 || ds > (face.lightmapSize[0] - 1) * 16 ||
            dt > (face.lightmapSize[1] - 1) * 16) {
            continue;
        }
        if (face.lightOffset < 0) {
            return 0;
        }
        const sample = Math.trunc(dt / 16) * face.lightmapSize[0] + Math.trunc(ds / 16);
        const sampleCount = face.lightmapSize[0] * face.lightmapSize[1];
        let light = 0;
        for (let channel = 0; channel < 4 && face.styles[channel] !== 255; channel++) {
            light += map.lightData[face.lightOffset + channel * sampleCount + sample] *
                quakeLightStyleScale(face.styles[channel], time, dynamicStyles);
        }
        return Math.trunc(light / 256);
    }
    return recursiveLightPoint(map, node.children[side ^ 1], middle, end, time, dynamicStyles);
};

export const sampleQuakeBspLight = (
    map: BspMap,
    point: Vec3,
    time: number,
    dynamicStyles?: ReadonlyMap<number, string>
): number => {
    if (map.lightData.length === 0) {
        return 255;
    }
    const end: Vec3 = [point[0], point[1], point[2] - 2_048];
    return Math.max(0, recursiveLightPoint(
        map, map.models[0].headnodes[0], point, end, time, dynamicStyles
    ));
};

export const calculateQuakeAliasLighting = (
    staticLight: number,
    origin: Vec3,
    anglesOrYaw: number | Vec3,
    dynamicLights: readonly AliasDynamicLight[],
    minimumLight = 0
): QuakeAliasLighting => {
    let ambient = Math.max(staticLight, minimumLight);
    let shade = Math.max(staticLight, minimumLight);
    for (const light of dynamicLights) {
        const distance = Math.hypot(
            origin[0] - light.origin[0],
            origin[1] - light.origin[1],
            origin[2] - light.origin[2]
        );
        ambient = Math.trunc(ambient + Math.max(0, light.radius - distance));
    }
    ambient = Math.max(5, Math.min(128, ambient));
    shade = Math.max(0, Math.min(shade, 192 - ambient));
    const angles: Vec3 = typeof anglesOrYaw === 'number' ? [0, anglesOrYaw, 0] : anglesOrYaw;
    return {
        ambient: ambient / 255,
        shade: shade / 255,
        shadeDirection: quakeAliasLightDirection(angles)
    };
};

export const quakeAliasVertexLightNumber = (
    ambient: number,
    shade: number,
    directional: number
): number => (255 - Math.trunc(ambient)) * 64 -
    Math.trunc(Math.trunc(shade) * 64 * Math.max(0, directional));

export const quakeAliasColormapGrade = (
    ambient: number,
    shade: number,
    directional: number
): number => Math.max(0, Math.min(63, Math.floor(
    quakeAliasVertexLightNumber(ambient, shade, directional) / 256
)));
