import {
    CULLFACE_NONE,
    Entity,
    LAYERID_UI,
    Layer,
    Mesh,
    MeshInstance,
    PRIMITIVE_POINTS,
    SEMANTIC_ATTR1,
    SEMANTIC_POSITION,
    ShaderMaterial,
    Texture,
    type AppBase
} from 'playcanvas';

import { QUAKE_ALIAS_NORMALS } from './alias-normals';
import { createPaletteTexture, updatePaletteTexture } from './palette';
import {
    QUAKE_PARTICLE_NEAR_CLIP,
    quakeBlobParticleState,
    quakeEntityParticleOrigin,
    quakeEffectParticleState,
    quakeExplosionTwoParticleState,
    quakeLavaParticleState,
    quakeTeleportParticleState
} from './particle-effects';
import { quakeToPlayCanvas } from './world-renderer';
import type { Vec3 } from '../formats/bsp';
import type { QuakeParticleEvent } from '../game/quake-builtins';
import type { QuakeWorldRuntime } from '../game/quake-world';

const MAX_PARTICLES = 2_048;
const RAMP_ONE = [0x6f, 0x6d, 0x6b, 0x69, 0x67, 0x65, 0x63, 0x61];
const RAMP_TWO = [0x6f, 0x6e, 0x6d, 0x6c, 0x6b, 0x6a, 0x68, 0x66];
const RAMP_THREE = [0x6d, 0x6b, 6, 5, 4, 3];

export const quakeParticleRandomState = (state: number): number => (
    Math.imul(state, 1_103_515_245) + 12_345
) & 0x7fffffff;

export const quakeParticleRandomValue = (state: number): number => (
    state >>> 16
) & 0x7fff;

export const quakeParticleLayerInsertionIndex = (
    layers: readonly { id: number }[]
): number => {
    const uiIndex = layers.findIndex(layer => layer.id === LAYERID_UI);
    return uiIndex < 0 ? layers.length : uiIndex;
};

type ParticleType = 'blob' | 'blob2' | 'explode' | 'explode2' | 'fire' |
    'gravity' | 'slowGravity' | 'static';

interface QuakeParticle {
    color: number;
    die: number;
    origin: Vec3;
    ramp: number;
    type: ParticleType;
    velocity: Vec3;
}

const PARTICLE_VERTEX_SHADER = `
attribute vec3 aPosition;
attribute float aColorIndex;

uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_viewProjection;
uniform vec2 uQuakeViewportSize;
uniform float uParticlePixelScale;

varying float vColorIndex;

float quakeTrunc(float value) {
    return sign(value) * floor(abs(value));
}

void main(void) {
    vColorIndex = aColorIndex;
    vec4 worldPosition = matrix_model * vec4(aPosition, 1.0);
    vec4 viewPosition = matrix_view * worldPosition;
    vec4 clipPosition = matrix_viewProjection * worldPosition;
    float viewDepth = -viewPosition.z;
    float viewportScale = uQuakeViewportSize.x / 320.0;
    float minimumSize = max(1.0, floor(viewportScale));
    float maximumSize = max(1.0, floor(uQuakeViewportSize.x / 80.0 + 0.5));
    float shift = 8.0 - floor(viewportScale + 0.5);
    float inverseDepth = floor(32768.0 / max(viewDepth, 0.001));
    float pointSize = clamp(
        floor(inverseDepth / exp2(shift)), minimumSize, maximumSize
    );

    vec2 ndc = clipPosition.xy / clipPosition.w;
    vec2 projected = vec2(
        (ndc.x * 0.5 + 0.5) * uQuakeViewportSize.x,
        (0.5 - ndc.y * 0.5) * uQuakeViewportSize.y
    );
    vec2 topLeft = vec2(
        quakeTrunc(projected.x + 0.5),
        quakeTrunc(projected.y + 0.5)
    );
    bool clipped = viewDepth < ${QUAKE_PARTICLE_NEAR_CLIP.toFixed(1)} ||
        topLeft.x < 0.0 || topLeft.y < 0.0 ||
        topLeft.x > uQuakeViewportSize.x - maximumSize ||
        topLeft.y > uQuakeViewportSize.y - maximumSize;
    if (clipped) {
        gl_PointSize = 1.0;
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    } else {
        gl_PointSize = max(1.0, floor(pointSize * uParticlePixelScale + 0.5));
        gl_Position = clipPosition;
    }
}
`;

const PARTICLE_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D uPaletteMap;
varying float vColorIndex;

void main(void) {
    vec3 color = texture2D(uPaletteMap, vec2((vColorIndex + 0.5) / 256.0, 0.5)).rgb;
    gl_FragColor = vec4(color, 1.0);
}
`;

export class ParticleRenderer {
    readonly app: AppBase;
    readonly camera: Entity;
    quakeWorld: QuakeWorldRuntime;
    readonly layer: Layer;
    readonly root = new Entity('Quake particles');
    readonly mesh: Mesh;
    readonly material: ShaderMaterial;
    readonly paletteTexture: Texture;
    readonly particles: QuakeParticle[] = [];
    entityAngularVelocities?: Vec3[];
    randomState = 0x4d595df4;
    tracerCount = 0;

    constructor(
        app: AppBase,
        camera: Entity,
        palette: Uint8Array<ArrayBufferLike>,
        quakeWorld: QuakeWorldRuntime,
        quakeViewportWidth = 320,
        quakeViewportHeight = 200
    ) {
        this.app = app;
        this.camera = camera;
        this.quakeWorld = quakeWorld;
        this.layer = new Layer({ name: 'Quake particles' });
        this.app.scene.layers.insertOpaque(
            this.layer,
            quakeParticleLayerInsertionIndex(this.app.scene.layers.layerList)
        );
        const cameraComponent = camera.camera;
        if (!cameraComponent) {
            throw new Error('Particle camera has no camera component');
        }
        cameraComponent.layers = [...cameraComponent.layers, this.layer.id];
        this.mesh = new Mesh(app.graphicsDevice);
        this.mesh.clear(true, false, MAX_PARTICLES, 0);
        this.mesh.setPositions([0, 0, 0]);
        this.mesh.setVertexStream(SEMANTIC_ATTR1, [0], 1);
        this.mesh.update(PRIMITIVE_POINTS);

        this.material = new ShaderMaterial({
            uniqueName: 'Quake indexed particles',
            attributes: {
                aColorIndex: SEMANTIC_ATTR1,
                aPosition: SEMANTIC_POSITION
            },
            vertexGLSL: PARTICLE_VERTEX_SHADER,
            fragmentGLSL: PARTICLE_FRAGMENT_SHADER
        });
        this.material.cull = CULLFACE_NONE;
        this.material.depthTest = true;
        this.material.depthWrite = true;
        this.paletteTexture = createPaletteTexture(app.graphicsDevice, palette);
        this.material.setParameter('uPaletteMap', this.paletteTexture);
        this.setQuakeViewportSize(quakeViewportWidth, quakeViewportHeight);
        this.material.update();

        const meshInstance = new MeshInstance(this.mesh, this.material);
        meshInstance.cull = false;
        this.root.addComponent('render', {
            castShadows: false,
            layers: [this.layer.id],
            meshInstances: [meshInstance],
            receiveShadows: false
        });
        this.root.enabled = false;
        this.app.root.addChild(this.root);
        this.quakeWorld.setParticleConsumer(event => this.spawnEvent(event));
    }

    setPalette(palette: Uint8Array<ArrayBufferLike>): void {
        updatePaletteTexture(this.paletteTexture, palette);
    }

    replaceWorld(quakeWorld: QuakeWorldRuntime): void {
        this.particles.length = 0;
        this.entityAngularVelocities = undefined;
        this.quakeWorld = quakeWorld;
        quakeWorld.setParticleConsumer(event => this.spawnEvent(event));
    }

    setQuakeViewportSize(
        width: number,
        height: number,
        displayWidth = width
    ): void {
        const logicalWidth = Math.max(1, width);
        this.material.setParameter('uQuakeViewportSize', new Float32Array([
            logicalWidth, Math.max(1, height)
        ]));
        this.material.setParameter(
            'uParticlePixelScale',
            Math.max(1, displayWidth) / logicalWidth
        );
    }

    update(frameTime: number): void {
        this.quakeWorld.drainParticleEvents();
        this.particles.splice(0, this.particles.length,
            ...this.particles.filter(particle => particle.die >= this.quakeWorld.time)
        );
        this.root.enabled = this.particles.length > 0;
        if (!this.root.enabled) {
            return;
        }
        const positions: number[] = [];
        const colors: number[] = [];
        for (const particle of this.particles) {
            positions.push(...quakeToPlayCanvas(particle.origin));
            colors.push(particle.color);
        }
        this.mesh.setPositions(positions, 3, this.particles.length);
        this.mesh.setVertexStream(
            SEMANTIC_ATTR1, colors, 1, this.particles.length
        );
        this.mesh.update(PRIMITIVE_POINTS, false);
        this.integrate(Math.min(frameTime, 0.1));
    }

    private spawnEvent(event: QuakeParticleEvent): void {
        switch (event.kind) {
            case 'blob':
                this.spawnBlobExplosion(event);
                break;
            case 'explosion':
                this.spawnExplosion(event);
                break;
            case 'entity':
                this.spawnEntityParticles(event);
                break;
            case 'explosion2':
                this.spawnExplosionTwo(event);
                break;
            case 'lava':
                this.spawnLavaSplash(event);
                break;
            case 'teleport':
                this.spawnTeleportSplash(event);
                break;
            case 'trail':
                this.spawnTrail(event);
                break;
            default:
                if (event.count === 1_024) {
                    this.spawnExplosion(event);
                } else {
                    this.spawnEffect(event);
                }
                break;
        }
    }

    private spawnEffect(event: QuakeParticleEvent): void {
        for (let index = 0; index < event.count && this.hasCapacity(); index++) {
            const state = quakeEffectParticleState(
                event.origin, event.direction, event.color,
                this.quakeWorld.time, () => this.random()
            );
            this.particles.push({
                color: state.color,
                die: state.die,
                origin: state.origin,
                ramp: 0,
                type: 'slowGravity',
                velocity: state.velocity
            });
        }
    }

    private spawnEntityParticles(event: QuakeParticleEvent): void {
        if (!this.entityAngularVelocities) {
            this.entityAngularVelocities = QUAKE_ALIAS_NORMALS.map(() => [
                (this.random() & 255) * 0.01,
                (this.random() & 255) * 0.01,
                (this.random() & 255) * 0.01
            ]);
        }
        for (let index = 0;
            index < QUAKE_ALIAS_NORMALS.length && this.hasCapacity();
            index++) {
            this.particles.push({
                color: 0x6f,
                die: this.quakeWorld.time + 0.01,
                origin: quakeEntityParticleOrigin(
                    event.origin,
                    QUAKE_ALIAS_NORMALS[index],
                    this.entityAngularVelocities[index],
                    this.quakeWorld.time
                ),
                ramp: 0,
                type: 'explode',
                velocity: [0, 0, 0]
            });
        }
    }

    private spawnExplosion(event: QuakeParticleEvent): void {
        for (let index = 0; index < event.count && this.hasCapacity(); index++) {
            const explode = (index & 1) !== 0;
            const particle: QuakeParticle = {
                color: RAMP_ONE[0],
                die: this.quakeWorld.time + 5,
                ramp: this.random() & 3,
                origin: [...event.origin],
                type: explode ? 'explode' : 'explode2',
                velocity: [0, 0, 0]
            };
            for (let axis = 0; axis < 3; axis++) {
                particle.origin[axis] += (this.random() % 32) - 16;
                particle.velocity[axis] = (this.random() % 512) - 256;
            }
            this.particles.push(particle);
        }
    }

    private spawnExplosionTwo(event: QuakeParticleEvent): void {
        const colorLength = Math.max(1, event.colorLength ?? 1);
        for (let index = 0; index < event.count && this.hasCapacity(); index++) {
            const state = quakeExplosionTwoParticleState(
                event.origin, event.color, colorLength, index,
                this.quakeWorld.time, () => this.random()
            );
            this.particles.push({
                color: state.color,
                die: state.die,
                origin: state.origin,
                ramp: 0,
                type: 'blob',
                velocity: state.velocity
            });
        }
    }

    private spawnBlobExplosion(event: QuakeParticleEvent): void {
        for (let index = 0; index < event.count && this.hasCapacity(); index++) {
            const first = (index & 1) !== 0;
            const state = quakeBlobParticleState(
                event.origin, first, this.quakeWorld.time, () => this.random()
            );
            this.particles.push({
                color: state.color,
                die: state.die,
                origin: state.origin,
                ramp: 0,
                type: first ? 'blob' : 'blob2',
                velocity: state.velocity
            });
        }
    }

    private spawnLavaSplash(event: QuakeParticleEvent): void {
        for (let row = -16; row < 16 && this.hasCapacity(); row++) {
            for (let column = -16; column < 16 && this.hasCapacity(); column++) {
                const state = quakeLavaParticleState(
                    event.origin, row, column,
                    this.quakeWorld.time, () => this.random()
                );
                this.particles.push({
                    color: state.color,
                    die: state.die,
                    origin: state.origin,
                    ramp: 0,
                    type: 'slowGravity',
                    velocity: state.velocity
                });
            }
        }
    }

    private spawnTeleportSplash(event: QuakeParticleEvent): void {
        for (let x = -16; x < 16 && this.hasCapacity(); x += 4) {
            for (let y = -16; y < 16 && this.hasCapacity(); y += 4) {
                for (let z = -24; z < 32 && this.hasCapacity(); z += 4) {
                    const state = quakeTeleportParticleState(
                        event.origin, x, y, z, this.quakeWorld.time,
                        () => this.random()
                    );
                    this.particles.push({
                        color: state.color,
                        die: state.die,
                        origin: state.origin,
                        ramp: 0,
                        type: 'slowGravity',
                        velocity: state.velocity
                    });
                }
            }
        }
    }

    private spawnTrail(event: QuakeParticleEvent): void {
        if (!event.end) {
            return;
        }
        const start: Vec3 = [...event.origin];
        const vector = event.end.map(
            (component, axis) => component - start[axis]
        ) as Vec3;
        let remaining = Math.hypot(...vector);
        if (remaining === 0) {
            return;
        }
        for (let axis = 0; axis < 3; axis++) vector[axis] /= remaining;
        const trailType = event.trailType ?? 0;
        while (remaining > 0 && this.hasCapacity()) {
            remaining -= 3;
            const particle: QuakeParticle = {
                color: 0,
                die: this.quakeWorld.time + 2,
                origin: [...start],
                ramp: 0,
                type: 'static',
                velocity: [0, 0, 0]
            };
            switch (trailType) {
                case 0:
                    particle.ramp = this.random() & 3;
                    particle.color = RAMP_THREE[particle.ramp];
                    particle.type = 'fire';
                    this.jitterTrailOrigin(particle.origin, 6);
                    break;
                case 1:
                    particle.ramp = (this.random() & 3) + 2;
                    particle.color = RAMP_THREE[particle.ramp];
                    particle.type = 'fire';
                    this.jitterTrailOrigin(particle.origin, 6);
                    break;
                case 2:
                case 4:
                    particle.color = 67 + (this.random() & 3);
                    particle.type = 'gravity';
                    this.jitterTrailOrigin(particle.origin, 6);
                    if (trailType === 4) remaining -= 3;
                    break;
                case 3:
                case 5:
                    particle.die = this.quakeWorld.time + 0.5;
                    particle.color = (trailType === 3 ? 52 : 230) +
                        ((this.tracerCount & 4) << 1);
                    this.tracerCount++;
                    particle.velocity = (this.tracerCount & 1) !== 0 ?
                        [30 * vector[1], -30 * vector[0], 0] :
                        [-30 * vector[1], 30 * vector[0], 0];
                    break;
                case 6:
                    particle.color = 9 * 16 + 8 + (this.random() & 3);
                    particle.die = this.quakeWorld.time + 0.3;
                    this.jitterTrailOrigin(particle.origin, 16);
                    break;
                default:
                    break;
            }
            this.particles.push(particle);
            for (let axis = 0; axis < 3; axis++) start[axis] += vector[axis];
        }
    }

    private jitterTrailOrigin(origin: Vec3, range: number): void {
        for (let axis = 0; axis < 3; axis++) {
            origin[axis] += range === 6 ? this.random() % 6 - 3 : (this.random() & 15) - 8;
        }
    }

    private integrate(frameTime: number): void {
        const gravity = frameTime * this.quakeWorld.serverGravity() * 0.05;
        const acceleration = 4 * frameTime;
        for (const particle of this.particles) {
            particle.origin = particle.origin.map(
                (component, axis) => component + particle.velocity[axis] * frameTime
            ) as Vec3;
            switch (particle.type) {
                case 'static':
                    break;
                case 'fire':
                    particle.ramp += frameTime * 5;
                    if (particle.ramp >= RAMP_THREE.length) {
                        particle.die = -1;
                    } else {
                        particle.color = RAMP_THREE[Math.trunc(particle.ramp)];
                    }
                    particle.velocity[2] += gravity;
                    break;
                case 'explode':
                    particle.ramp += frameTime * 10;
                    if (particle.ramp >= RAMP_ONE.length) {
                        particle.die = -1;
                    } else {
                        particle.color = RAMP_ONE[Math.trunc(particle.ramp)];
                    }
                    particle.velocity = particle.velocity.map(
                        component => component * (1 + acceleration)
                    ) as Vec3;
                    particle.velocity[2] -= gravity;
                    break;
                case 'explode2':
                    particle.ramp += frameTime * 15;
                    if (particle.ramp >= RAMP_TWO.length) {
                        particle.die = -1;
                    } else {
                        particle.color = RAMP_TWO[Math.trunc(particle.ramp)];
                    }
                    particle.velocity = particle.velocity.map(
                        component => component * (1 - frameTime)
                    ) as Vec3;
                    particle.velocity[2] -= gravity;
                    break;
                case 'blob':
                    particle.velocity = particle.velocity.map(
                        component => component * (1 + acceleration)
                    ) as Vec3;
                    particle.velocity[2] -= gravity;
                    break;
                case 'blob2':
                    particle.velocity[0] *= 1 - acceleration;
                    particle.velocity[1] *= 1 - acceleration;
                    particle.velocity[2] -= gravity;
                    break;
                case 'slowGravity':
                case 'gravity':
                    particle.velocity[2] -= gravity;
                    break;
            }
        }
    }

    private hasCapacity(): boolean {
        return this.particles.length < MAX_PARTICLES;
    }

    private random(): number {
        this.randomState = quakeParticleRandomState(this.randomState);
        return quakeParticleRandomValue(this.randomState);
    }
}
