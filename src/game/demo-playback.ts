import {
    QuakeDemoClient,
    type QuakeDemoEntity,
    type QuakeDemoFrameEvents,
    type QuakeDemoVector
} from './demo-client';
import type { QuakeDemo } from '../formats/dem';

export interface QuakeDemoPlaybackStep {
    events: QuakeDemoFrameEvents[];
    finished: boolean;
    messageIndex: number;
}

export interface QuakeTimeDemoResult {
    frames: number;
    framesPerSecond: number;
    seconds: number;
}

export class QuakeTimeDemoCounter {
    private renderedFrames = 0;
    private startMilliseconds?: number;

    beginFrame(nowMilliseconds: number): void {
        if (!Number.isFinite(nowMilliseconds)) {
            throw new Error(`Invalid timedemo clock ${nowMilliseconds}`);
        }
        this.renderedFrames++;
        if (this.renderedFrames === 2) this.startMilliseconds = nowMilliseconds;
    }

    finish(nowMilliseconds: number): QuakeTimeDemoResult {
        if (!Number.isFinite(nowMilliseconds)) {
            throw new Error(`Invalid timedemo clock ${nowMilliseconds}`);
        }
        const frames = Math.max(0, this.renderedFrames - 1);
        const measuredSeconds = this.startMilliseconds === undefined ? 0 :
            (nowMilliseconds - this.startMilliseconds) / 1_000;
        const seconds = measuredSeconds > 0 ? measuredSeconds : 1;
        return {
            frames,
            framesPerSecond: frames / seconds,
            seconds
        };
    }
}

export const quakeTimeDemoReport = (result: QuakeTimeDemoResult): string => {
    return `${result.frames} frames ${result.seconds.toFixed(1).padStart(5)} seconds ${
        result.framesPerSecond.toFixed(1).padStart(5)
    } fps\n`;
};

const angleDelta = (current: number, previous: number): number => {
    let delta = current - previous;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
};

export class QuakeDemoPlayback {
    readonly client = new QuakeDemoClient();
    readonly demo: QuakeDemo;
    active = true;
    clientTime = 0;
    finished = false;
    messageIndex = 0;
    readonly timedemo: boolean;

    constructor(demo: QuakeDemo, timedemo = false) {
        this.demo = demo;
        this.timedemo = timedemo;
    }

    start(): QuakeDemoPlaybackStep {
        const events: QuakeDemoFrameEvents[] = [];
        while (!this.finished && this.client.signon < 4) {
            events.push(this.readNext());
        }
        this.clientTime = this.client.time;
        return this.stepResult(events);
    }

    advance(frameTime: number): QuakeDemoPlaybackStep {
        if (!Number.isFinite(frameTime) || frameTime < 0) {
            throw new Error(`Invalid Quake demo frame time ${frameTime}`);
        }
        if (!this.active) return this.stepResult([]);
        if (this.timedemo) {
            const events = this.finished ? [] : [this.readNext()];
            this.clientTime = this.client.time;
            return this.stepResult(events);
        }
        this.clientTime += frameTime;
        const events: QuakeDemoFrameEvents[] = [];
        while (!this.finished && (
            this.client.signon < 4 || this.clientTime > this.client.time
        )) {
            events.push(this.readNext());
        }
        this.interpolationFraction();
        return this.stepResult(events);
    }

    stop(): boolean {
        if (!this.active) return false;
        this.active = false;
        this.finished = true;
        return true;
    }

    interpolationFraction(): number {
        if (this.timedemo) {
            this.clientTime = this.client.time;
            return 1;
        }
        let span = this.client.time - this.client.previousTime;
        if (span === 0) {
            this.clientTime = this.client.time;
            return 1;
        }
        if (span > 0.1) {
            this.client.previousTime = this.client.time - 0.1;
            span = 0.1;
        }
        let fraction = (this.clientTime - this.client.previousTime) / span;
        if (fraction < 0) {
            if (fraction < -0.01) this.clientTime = this.client.previousTime;
            fraction = 0;
        } else if (fraction > 1) {
            if (fraction > 1.01) this.clientTime = this.client.time;
            fraction = 1;
        }
        return fraction;
    }

    viewAngles(): QuakeDemoVector {
        const fraction = this.interpolationFraction();
        return this.client.messageViewAngles.map((angle, axis) => (
            this.client.previousMessageViewAngles[axis] + angleDelta(
                angle, this.client.previousMessageViewAngles[axis]
            ) * fraction
        )) as QuakeDemoVector;
    }

    velocity(): QuakeDemoVector {
        const fraction = this.interpolationFraction();
        return this.client.velocity.map((component, axis) => (
            this.client.previousVelocity[axis] + (
                component - this.client.previousVelocity[axis]
            ) * fraction
        )) as QuakeDemoVector;
    }

    entityState(entityNumber: number): QuakeDemoEntity | undefined {
        const entity = this.client.entities.get(entityNumber);
        if (!entity || entity.messageTime !== this.client.time) return undefined;
        if (entity.forceLink) return entity;
        let fraction = this.interpolationFraction();
        if (entity.origin.some((component, axis) => (
            Math.abs(component - entity.previousOrigin[axis]) > 100
        ))) {
            fraction = 1;
        }
        return {
            ...entity,
            angles: entity.angles.map((angle, axis) => (
                entity.previousAngles[axis] + angleDelta(
                    angle, entity.previousAngles[axis]
                ) * fraction
            )) as QuakeDemoVector,
            origin: entity.origin.map((component, axis) => (
                entity.previousOrigin[axis] + (
                    component - entity.previousOrigin[axis]
                ) * fraction
            )) as QuakeDemoVector
        };
    }

    private readNext(): QuakeDemoFrameEvents {
        const message = this.demo.messages[this.messageIndex];
        if (!message) {
            this.finished = true;
            return {
                centerPrints: [],
                commands: [],
                damages: [],
                particles: [],
                prints: [],
                soundCommands: [],
                sounds: [],
                stoppedSounds: [],
                stuffText: [],
                temporaryEntities: []
            };
        }
        this.messageIndex++;
        const events = this.client.parseMessage(message);
        if (this.client.disconnected || this.messageIndex >= this.demo.messages.length) {
            this.finished = true;
        }
        return events;
    }

    private stepResult(events: QuakeDemoFrameEvents[]): QuakeDemoPlaybackStep {
        return {
            events,
            finished: this.finished,
            messageIndex: this.messageIndex
        };
    }
}
