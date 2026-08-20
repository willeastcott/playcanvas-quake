import {
    ADDRESS_CLAMP_TO_EDGE,
    FILTER_NEAREST,
    PostEffect,
    SEMANTIC_POSITION,
    ShaderUtils,
    type GraphicsDevice,
    type RenderTarget,
    type Shader,
    type Vec4
} from 'playcanvas';

import { CONTENTS } from '../formats/bsp';

const WARP_CYCLE = 128;
const WARP_AMPLITUDE = 3;
const WARP_SPEED = 20;
const SOURCE_PI = 3.14159;

const UNDERWATER_WARP_FRAGMENT_SHADER = `
uniform sampler2D uColorBuffer;
uniform vec2 uResolution;
uniform float uTime;
uniform float uWarpActive;
uniform float uWarpOffsets[128];

varying vec2 vUv0;

float warpOffset(float coordinate) {
    float phase = mod(floor(uTime * 20.0), 128.0);
    int index = int(mod(coordinate + phase, 128.0));
    return uWarpOffsets[index];
}

void main(void) {
    vec2 sourceUv = vUv0;
    if (uWarpActive > 0.5) {
        vec2 destination = floor(vec2(vUv0.x, 1.0 - vUv0.y) * uResolution);
        destination = clamp(destination, vec2(0.0), uResolution - vec2(1.0));
        vec2 source;
        source.x = floor(
            (destination.x + warpOffset(destination.y)) * uResolution.x /
            (uResolution.x + 6.0)
        );
        source.y = floor(
            (destination.y + warpOffset(destination.x)) * uResolution.y /
            (uResolution.y + 6.0)
        );
        sourceUv = vec2(
            (source.x + 0.5) / uResolution.x,
            1.0 - (source.y + 0.5) / uResolution.y
        );
    }
    gl_FragColor = texture2D(uColorBuffer, sourceUv);
}
`;

const quakeWarpOffset = (coordinate: number, time: number): number => {
    const phase = Math.trunc(time * WARP_SPEED) & (WARP_CYCLE - 1);
    return Math.trunc(
        WARP_AMPLITUDE + Math.sin(
            (coordinate + phase) * SOURCE_PI * 2 / WARP_CYCLE
        ) * WARP_AMPLITUDE
    );
};

export const quakeUnderwaterWarpCoordinate = (
    x: number,
    y: number,
    width: number,
    height: number,
    time: number
): [number, number] => [
    Math.trunc((x + quakeWarpOffset(y, time)) * width / (width + WARP_AMPLITUDE * 2)),
    Math.trunc((y + quakeWarpOffset(x, time)) * height / (height + WARP_AMPLITUDE * 2))
];

export const usesQuakeUnderwaterWarp = (contents: number): boolean => contents <= CONTENTS.WATER;

export class QuakeUnderwaterWarp extends PostEffect {
    readonly shader: Shader;
    readonly resolution = new Float32Array(2);
    readonly warpOffsets = Float32Array.from(
        { length: WARP_CYCLE }, (_, coordinate) => quakeWarpOffset(coordinate, 0)
    );
    active = false;
    time = 0;

    constructor(device: GraphicsDevice) {
        super(device);
        this.shader = ShaderUtils.createShader(device, {
            uniqueName: 'QuakeUnderwaterWarp',
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexGLSL: PostEffect.quadVertexShader,
            fragmentGLSL: UNDERWATER_WARP_FRAGMENT_SHADER
        });
    }

    override render(inputTarget: RenderTarget, outputTarget: RenderTarget, rect?: Vec4): void {
        const colorBuffer = inputTarget.colorBuffer;
        if (!colorBuffer) {
            return;
        }
        colorBuffer.minFilter = FILTER_NEAREST;
        colorBuffer.magFilter = FILTER_NEAREST;
        colorBuffer.addressU = ADDRESS_CLAMP_TO_EDGE;
        colorBuffer.addressV = ADDRESS_CLAMP_TO_EDGE;
        this.resolution[0] = inputTarget.width;
        this.resolution[1] = inputTarget.height;
        this.device.scope.resolve('uColorBuffer').setValue(colorBuffer);
        this.device.scope.resolve('uResolution').setValue(this.resolution);
        this.device.scope.resolve('uTime').setValue(this.time);
        this.device.scope.resolve('uWarpActive').setValue(this.active ? 1 : 0);
        this.device.scope.resolve('uWarpOffsets[0]').setValue(this.warpOffsets);
        this.drawQuad(outputTarget, this.shader, rect);
    }
}
