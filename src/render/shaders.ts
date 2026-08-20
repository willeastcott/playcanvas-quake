export const WORLD_VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec2 aUv0;
attribute vec2 aUv1;
attribute float aMipLevel;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

varying vec3 vWorldPosition;
varying vec2 vTextureCoord;
varying vec2 vLightmapCoord;
varying float vMipLevel;

void main(void) {
    vec4 worldPosition = matrix_model * vec4(aPosition, 1.0);
    vWorldPosition = worldPosition.xyz;
    vTextureCoord = aUv0;
    vLightmapCoord = aUv1;
    vMipLevel = aMipLevel;
    gl_Position = matrix_viewProjection * worldPosition;
}
`;

export const WORLD_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D uIndexMap;
uniform sampler2D uPaletteMap;
uniform sampler2D uColormap;
uniform sampler2D uLightmap;
uniform sampler2D uDynamicLightmap;
uniform vec2 uTextureSize;
uniform float uLightmapSize;
uniform vec4 uLightStyles;
uniform vec3 uCameraPosition;
uniform vec3 uSkyForward;
uniform vec3 uSkyRight;
uniform vec3 uSkyUp;
uniform vec2 uSkyRenderSize;
uniform vec2 uSkyVideoSize;
uniform vec4 uSkyViewRect;
uniform vec3 uColorShift;
uniform float uColorShiftAmount;
uniform float uGamma;
uniform float uHasLightmap;
uniform float uSurfaceMode;
uniform float uTime;
uniform float uTransparent;
uniform float uTurbulenceOffsets[128];

varying vec3 vWorldPosition;
varying vec2 vTextureCoord;
varying vec2 vLightmapCoord;
varying float vMipLevel;

float indexAt(vec2 coordinate) {
    return floor(texture2D(uIndexMap, coordinate).r * 255.0 + 0.5);
}

float indexAtMip(vec2 coordinate, float mipLevel) {
    return floor(texture2DLod(uIndexMap, coordinate, mipLevel).r * 255.0 + 0.5);
}

vec3 paletteColor(float index) {
    return texture2D(uPaletteMap, vec2((index + 0.5) / 256.0, 0.5)).rgb;
}

float litPaletteIndex(float index, float grade) {
    return floor(texture2D(
        uColormap,
        vec2((index + 0.5) / 256.0, (grade + 0.5) / 64.0)
    ).r * 255.0 + 0.5);
}

float surfaceDarkness(vec2 texel) {
    vec2 coordinate = (texel + 0.5) / uLightmapSize;
    vec4 samples = texture2D(uLightmap, coordinate);
    float staticBlockLight = dot(samples, uLightStyles) * 65280.0;
    float dynamicBlockLight = texture2D(uDynamicLightmap, coordinate).r * 65280.0;
    return max(64.0, floor((65280.0 - staticBlockLight - dynamicBlockLight) / 4.0));
}

float surfaceMipLevel(void) {
    return clamp(floor(vMipLevel + 0.5), 0.0, 3.0);
}

float surfaceLightGrade(void) {
    vec2 lightCoordinate = vLightmapCoord * uLightmapSize - 0.5;
    vec2 first = floor(lightCoordinate);
    float blockSize = exp2(4.0 - surfaceMipLevel());
    vec2 blockPixel = floor(fract(lightCoordinate) * blockSize);
    float topLeft = surfaceDarkness(first);
    float topRight = surfaceDarkness(first + vec2(1.0, 0.0));
    float bottomLeft = surfaceDarkness(first + vec2(0.0, 1.0));
    float bottomRight = surfaceDarkness(first + vec2(1.0, 1.0));
    float left = topLeft + floor((bottomLeft - topLeft) / blockSize) * blockPixel.y;
    float right = topRight + floor((bottomRight - topRight) / blockSize) * blockPixel.y;
    float light = right + floor((left - right) / blockSize) *
        (blockSize - 1.0 - blockPixel.x);
    return clamp(floor(light / 256.0), 0.0, 63.0);
}

float turbulenceOffset(float coordinate) {
    float phase = mod(floor(uTime * 20.0), 128.0);
    int index = int(mod(floor(coordinate) + phase, 128.0));
    return uTurbulenceOffsets[index];
}

void main(void) {
    float paletteIndex;

    if (uSurfaceMode > 1.5) {
        float screenU = floor(
            gl_FragCoord.x * uSkyViewRect.z / uSkyRenderSize.x + uSkyViewRect.x
        );
        float screenV = floor(
            (uSkyRenderSize.y - gl_FragCoord.y) * uSkyViewRect.w / uSkyRenderSize.y +
            uSkyViewRect.y
        );
        float projectionSize = max(uSkyViewRect.z, uSkyViewRect.w);
        float wu = 8192.0 * (screenU - floor(uSkyVideoSize.x * 0.5)) / projectionSize;
        float wv = 8192.0 * (floor(uSkyVideoSize.y * 0.5) - screenV) / projectionSize;
        vec3 quakeDirection = 4096.0 * uSkyForward + wu * uSkyRight + wv * uSkyUp;
        quakeDirection.z *= 3.0;
        float scale = 378.0 / max(length(quakeDirection), 0.001);
        vec2 projected = quakeDirection.xy * scale;
        vec2 solidCoord = fract((projected + uTime * 8.0) / 128.0);
        float alphaShift = uTime * 8.0 + floor(uTime * 8.0);
        vec2 alphaCoord = fract((projected + alphaShift) / 128.0);
        float solidIndex = indexAt(vec2(0.5 + solidCoord.x * 0.5, solidCoord.y));
        float alphaIndex = indexAt(vec2(alphaCoord.x * 0.5, alphaCoord.y));
        paletteIndex = alphaIndex == 0.0 ? solidIndex : alphaIndex;
    } else if (uSurfaceMode > 0.5) {
        vec2 destination = floor(vTextureCoord);
        vec2 source = mod(destination + vec2(
            turbulenceOffset(destination.y),
            turbulenceOffset(destination.x)
        ), 64.0);
        paletteIndex = indexAt((source + 0.5) / 64.0);
    } else {
        paletteIndex = indexAtMip(
            vTextureCoord / uTextureSize,
            surfaceMipLevel()
        );
    }

    if (uTransparent > 0.5 && paletteIndex == 255.0) {
        discard;
    }

    if (uHasLightmap > 0.5) {
        paletteIndex = litPaletteIndex(paletteIndex, surfaceLightGrade());
    }
    vec3 color = paletteColor(paletteIndex);
    color = mix(color, uColorShift, uColorShiftAmount);
    color = pow(max(color, vec3(0.0)), vec3(uGamma));
    gl_FragColor = vec4(color, 1.0);
}
`;

export const ALIAS_VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv0;

uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_viewProjection;
uniform vec3 uShadeDirection;
uniform float uAmbient;
uniform float uShade;

varying vec2 vTextureCoord;
varying float vLightNumber;
varying float vViewDepth;

void main(void) {
    vec4 worldPosition = matrix_model * vec4(aPosition, 1.0);
    vViewDepth = -(matrix_view * worldPosition).z;
    float directional = max(dot(aNormal, uShadeDirection), 0.0);
    float ambientLight = floor(uAmbient * 255.0 + 0.5);
    float shadeLight = floor(uShade * 255.0 + 0.5);
    gl_Position = matrix_viewProjection * worldPosition;
    vLightNumber = ((255.0 - ambientLight) * 64.0 -
        floor(shadeLight * 64.0 * directional)) * gl_Position.w;
    vTextureCoord = aUv0 * gl_Position.w;
}
`;

export const ALIAS_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D uIndexMap;
uniform sampler2D uPaletteMap;
uniform sampler2D uColormap;
uniform float uGamma;
uniform float uAliasNearClip;

varying vec2 vTextureCoord;
varying float vLightNumber;
varying float vViewDepth;

void main(void) {
    if (vViewDepth < uAliasNearClip) {
        discard;
    }
    vec2 textureCoordinate = vTextureCoord * gl_FragCoord.w;
    float lightNumber = vLightNumber * gl_FragCoord.w;
    float paletteIndex = floor(texture2D(uIndexMap, textureCoordinate).r * 255.0 + 0.5);
    float grade = clamp(floor(max(lightNumber, 0.0) / 256.0), 0.0, 63.0);
    paletteIndex = floor(texture2D(
        uColormap,
        vec2((paletteIndex + 0.5) / 256.0, (grade + 0.5) / 64.0)
    ).r * 255.0 + 0.5);
    vec3 color = texture2D(uPaletteMap, vec2((paletteIndex + 0.5) / 256.0, 0.5)).rgb;
    color = pow(max(color, vec3(0.0)), vec3(uGamma));
    gl_FragColor = vec4(color, 1.0);
}
`;

export const SPRITE_VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec2 aUv0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

varying vec2 vTextureCoord;

void main(void) {
    vTextureCoord = aUv0;
    gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
}
`;

export const SPRITE_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D uIndexMap;
uniform sampler2D uPaletteMap;

varying vec2 vTextureCoord;

void main(void) {
    float paletteIndex = floor(texture2D(uIndexMap, vTextureCoord).r * 255.0 + 0.5);
    if (paletteIndex >= 255.0) {
        discard;
    }
    vec3 color = texture2D(uPaletteMap, vec2((paletteIndex + 0.5) / 256.0, 0.5)).rgb;
    gl_FragColor = vec4(color, 1.0);
}
`;
