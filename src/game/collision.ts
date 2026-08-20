import {
    CONTENTS,
    type BspClipNode,
    type BspMap,
    type BspPlane,
    type Vec3
} from '../formats/bsp';
import { parseVector } from '../formats/entities';

const DIST_EPSILON = 0.03125;
const SOLID_BRUSH_CLASSES = new Set([
    'func_bossgate',
    'func_button',
    'func_door',
    'func_door_secret',
    'func_episodegate',
    'func_plat',
    'func_train',
    'func_wall'
]);

interface BrushCollider {
    active: boolean;
    headnodes: [number, number, number];
    modelIndex: number;
    origin: Vec3;
}

export interface CollisionPlane {
    normal: Vec3;
    distance: number;
}

export interface HullTrace {
    allSolid: boolean;
    startSolid: boolean;
    inOpen: boolean;
    inWater: boolean;
    fraction: number;
    endPosition: Vec3;
    modelIndex?: number;
    plane: CollisionPlane;
}

const dot = (left: Vec3, right: Vec3): number => left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

const planeDistance = (plane: BspPlane, point: Vec3): number => (plane.type < 3 ? point[plane.type] : dot(plane.normal, point)) - plane.distance;

export class WorldCollision {
    readonly map: BspMap;
    readonly pointClipnodes: BspClipNode[];
    readonly brushColliders: BrushCollider[];

    constructor(map: BspMap) {
        this.map = map;
        if (map.models[0].headnodes[1] < 0) {
            throw new Error('The world model has no standing-player collision hull');
        }
        this.pointClipnodes = map.nodes.map(node => ({
            plane: node.plane,
            children: node.children.map(child => (child < 0 ?
                (map.leafs[-1 - child]?.contents ?? CONTENTS.SOLID) : child)
            ) as [number, number]
        }));
        this.brushColliders = map.entities.flatMap((entity) => {
            if (!SOLID_BRUSH_CLASSES.has(entity.classname) || !entity.model?.startsWith('*')) {
                return [];
            }
            const modelIndex = Number(entity.model.slice(1));
            const model = map.models[modelIndex];
            return model && model.headnodes[1] >= 0 ? [{
                active: true,
                headnodes: [model.headnodes[0], model.headnodes[1], model.headnodes[2]],
                modelIndex,
                origin: parseVector(entity.origin)
            }] : [];
        });
    }

    pointContents(point: Vec3): number {
        const leafIndex = this.map.findLeaf(point);
        const contents = this.map.leafs[leafIndex]?.contents ?? CONTENTS.SOLID;
        return contents <= CONTENTS.CURRENT_0 && contents >= CONTENTS.CURRENT_DOWN ?
            CONTENTS.WATER : contents;
    }

    hullPointContents(
        point: Vec3,
        nodeIndex = this.map.models[0].headnodes[1],
        clipnodes = this.map.clipnodes
    ): number {
        let currentNode = nodeIndex;
        while (currentNode >= 0) {
            const node = clipnodes[currentNode];
            if (!node) {
                throw new Error(`Invalid BSP clipnode ${currentNode}`);
            }
            const plane = this.map.planes[node.plane];
            currentNode = node.children[planeDistance(plane, point) < 0 ? 1 : 0];
        }
        return currentNode;
    }

    trace(start: Vec3, end: Vec3): HullTrace {
        return this.traceBox(start, end, [-16, -16, -24], [16, 16, 32]);
    }

    tracePoint(start: Vec3, end: Vec3): HullTrace {
        return this.traceBox(start, end, [0, 0, 0], [0, 0, 0]);
    }

    traceBox(start: Vec3, end: Vec3, mins: Vec3, maxs: Vec3): HullTrace {
        const hullIndex = maxs[0] - mins[0] < 3 ? 0 : maxs[0] - mins[0] <= 32 ? 1 : 2;
        const clipMins: Vec3 = hullIndex === 0 ? [0, 0, 0] :
            hullIndex === 1 ? [-16, -16, -24] : [-32, -32, -24];
        const clipnodes = hullIndex === 0 ? this.pointClipnodes : this.map.clipnodes;
        const worldOffset = clipMins.map(
            (component, axis) => component - mins[axis]
        ) as Vec3;
        let bestTrace = this.traceOffsetHull(
            start,
            end,
            this.map.models[0].headnodes[hullIndex],
            clipnodes,
            worldOffset
        );
        for (const collider of this.brushColliders) {
            if (!collider.active) {
                continue;
            }
            const offset = worldOffset.map(
                (component, axis) => component + collider.origin[axis]
            ) as Vec3;
            const candidate = this.traceOffsetHull(
                start,
                end,
                collider.headnodes[hullIndex],
                clipnodes,
                offset
            );
            candidate.modelIndex = collider.modelIndex;
            if (candidate.allSolid || candidate.startSolid || candidate.fraction < bestTrace.fraction) {
                if (bestTrace.startSolid) {
                    candidate.startSolid = true;
                }
                bestTrace = candidate;
            }
        }
        return bestTrace;
    }

    setBrushState(modelIndex: number, origin: Vec3, active = true): void {
        const collider = this.brushColliders.find(candidate => candidate.modelIndex === modelIndex);
        if (collider) {
            collider.origin = [...origin];
            collider.active = active;
        }
    }

    private traceOffsetHull(
        start: Vec3,
        end: Vec3,
        headnode: number,
        clipnodes: BspClipNode[],
        offset: Vec3
    ): HullTrace {
        const localStart = start.map((component, axis) => component - offset[axis]) as Vec3;
        const localEnd = end.map((component, axis) => component - offset[axis]) as Vec3;
        const trace = this.traceHull(localStart, localEnd, headnode, clipnodes);
        trace.endPosition = trace.endPosition.map(
            (component, axis) => component + offset[axis]
        ) as Vec3;
        trace.plane.distance += dot(trace.plane.normal, offset);
        return trace;
    }

    private traceHull(
        start: Vec3,
        end: Vec3,
        headnode: number,
        clipnodes: BspClipNode[]
    ): HullTrace {
        const trace: HullTrace = {
            allSolid: true,
            startSolid: false,
            inOpen: false,
            inWater: false,
            fraction: 1,
            endPosition: [...end],
            plane: { normal: [0, 0, 0], distance: 0 }
        };
        this.recursiveHullCheck(headnode, headnode, 0, 1, start, end, trace, clipnodes);
        if (trace.fraction === 1) {
            trace.endPosition = [...end];
        }
        return trace;
    }

    private recursiveHullCheck(
        headnode: number,
        nodeIndex: number,
        startFraction: number,
        endFraction: number,
        start: Vec3,
        end: Vec3,
        trace: HullTrace,
        clipnodes: BspClipNode[]
    ): boolean {
        if (nodeIndex < 0) {
            if (nodeIndex !== CONTENTS.SOLID) {
                trace.allSolid = false;
                if (nodeIndex === CONTENTS.EMPTY) {
                    trace.inOpen = true;
                } else {
                    trace.inWater = true;
                }
            } else {
                trace.startSolid = true;
            }
            return true;
        }

        const node = clipnodes[nodeIndex];
        if (!node) {
            throw new Error(`Invalid BSP clipnode ${nodeIndex}`);
        }
        const plane = this.map.planes[node.plane];
        const startDistance = planeDistance(plane, start);
        const endDistance = planeDistance(plane, end);

        if (startDistance >= 0 && endDistance >= 0) {
            return this.recursiveHullCheck(
                headnode, node.children[0], startFraction, endFraction, start, end, trace, clipnodes
            );
        }
        if (startDistance < 0 && endDistance < 0) {
            return this.recursiveHullCheck(
                headnode, node.children[1], startFraction, endFraction, start, end, trace, clipnodes
            );
        }

        const fraction = Math.max(0, Math.min(1,
            (startDistance < 0 ? startDistance + DIST_EPSILON : startDistance - DIST_EPSILON) /
            (startDistance - endDistance)
        ));
        const middleFraction = startFraction + (endFraction - startFraction) * fraction;
        const middle = start.map(
            (component, axis) => component + fraction * (end[axis] - component)
        ) as Vec3;
        const side = startDistance < 0 ? 1 : 0;

        if (!this.recursiveHullCheck(
            headnode, node.children[side], startFraction, middleFraction, start, middle, trace,
            clipnodes
        )) {
            return false;
        }

        if (this.hullPointContents(middle, node.children[side ^ 1], clipnodes) !== CONTENTS.SOLID) {
            return this.recursiveHullCheck(
                headnode, node.children[side ^ 1], middleFraction, endFraction, middle, end, trace,
                clipnodes
            );
        }

        if (trace.allSolid) {
            return false;
        }

        trace.plane = side === 0 ? {
            normal: [...plane.normal],
            distance: plane.distance
        } : {
            normal: plane.normal.map(component => -component) as Vec3,
            distance: -plane.distance
        };

        let backedUpFraction = fraction;
        let backedUpMiddleFraction = middleFraction;
        let backedUpMiddle = middle;
        while (this.hullPointContents(backedUpMiddle, headnode, clipnodes) === CONTENTS.SOLID) {
            backedUpFraction -= 0.1;
            if (backedUpFraction < 0) {
                trace.fraction = backedUpMiddleFraction;
                trace.endPosition = [...backedUpMiddle];
                return false;
            }
            backedUpMiddleFraction = startFraction +
                (endFraction - startFraction) * backedUpFraction;
            backedUpMiddle = [
                start[0] + backedUpFraction * (end[0] - start[0]),
                start[1] + backedUpFraction * (end[1] - start[1]),
                start[2] + backedUpFraction * (end[2] - start[2])
            ];
        }

        trace.fraction = backedUpMiddleFraction;
        trace.endPosition = [...backedUpMiddle];
        return false;
    }
}
