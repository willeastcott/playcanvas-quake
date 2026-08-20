import { Mat4, Quat, Vec3 as PlayCanvasVec3 } from 'playcanvas';

import type { Vec3 } from '../formats/bsp';

interface QuakeAliasBasis {
    forward: Vec3;
    right: Vec3;
    up: Vec3;
}

const quakeAngleBasis = (angles: Vec3, negatePitch: boolean): QuakeAliasBasis => {
    const pitch = (negatePitch ? -angles[0] : angles[0]) * Math.PI / 180;
    const yaw = angles[1] * Math.PI / 180;
    const roll = angles[2] * Math.PI / 180;
    const sinePitch = Math.sin(pitch);
    const cosinePitch = Math.cos(pitch);
    const sineYaw = Math.sin(yaw);
    const cosineYaw = Math.cos(yaw);
    const sineRoll = Math.sin(roll);
    const cosineRoll = Math.cos(roll);
    return {
        forward: [
            cosinePitch * cosineYaw,
            cosinePitch * sineYaw,
            -sinePitch
        ],
        right: [
            -sineRoll * sinePitch * cosineYaw + cosineRoll * sineYaw,
            -sineRoll * sinePitch * sineYaw - cosineRoll * cosineYaw,
            -sineRoll * cosinePitch
        ],
        up: [
            cosineRoll * sinePitch * cosineYaw + sineRoll * sineYaw,
            cosineRoll * sinePitch * sineYaw - sineRoll * cosineYaw,
            cosineRoll * cosinePitch
        ]
    };
};

const toPlayCanvasDirection = (direction: Vec3): Vec3 => [
    direction[0], direction[2], -direction[1]
];

const rotationFromColumns = (x: Vec3, y: Vec3, z: Vec3): Quat => {
    const matrix = new Mat4().set([
        x[0], x[1], x[2], 0,
        y[0], y[1], y[2], 0,
        z[0], z[1], z[2], 0,
        0, 0, 0, 1
    ]);
    return new Quat().setFromMat4(matrix);
};

const quakeModelRotation = (angles: Vec3, negatePitch: boolean): Quat => {
    const basis = quakeAngleBasis(angles, negatePitch);
    return rotationFromColumns(
        toPlayCanvasDirection(basis.forward),
        toPlayCanvasDirection(basis.up),
        toPlayCanvasDirection(basis.right)
    );
};

export const quakeAliasRotation = (angles: Vec3): Quat => quakeModelRotation(angles, true);

export const quakeEntityRotation = (angles: Vec3): Quat => quakeModelRotation(angles, false);

export const quakeAliasLightDirection = (angles: Vec3): Vec3 => {
    const basis = quakeAngleBasis(angles, true);
    return [basis.forward[0], basis.up[0], basis.right[0]];
};

export const quakeOrientedSpriteRotation = (angles: Vec3): Quat => {
    const basis = quakeAngleBasis(angles, false);
    const negativeForward = basis.forward.map(component => -component) as Vec3;
    return rotationFromColumns(
        toPlayCanvasDirection(basis.right),
        toPlayCanvasDirection(basis.up),
        toPlayCanvasDirection(negativeForward)
    );
};

export const quakeUprightSpriteRotation = (
    playCanvasDirection: Vec3
): Quat | undefined => {
    const length = Math.hypot(playCanvasDirection[0], playCanvasDirection[2]);
    const magnitude = Math.hypot(...playCanvasDirection);
    if (magnitude === 0 || Math.abs(playCanvasDirection[1] / magnitude) > 0.999848 ||
        length === 0) {
        return undefined;
    }
    const forward: Vec3 = [
        playCanvasDirection[0] / length,
        0,
        playCanvasDirection[2] / length
    ];
    return rotationFromColumns(
        [-forward[2], 0, forward[0]],
        [0, 1, 0],
        [-forward[0], 0, -forward[2]]
    );
};

const VIEWMODEL_BASE_ROTATION = rotationFromColumns(
    [0, 0, 1],
    [0, 1, 0],
    [-1, 0, 0]
);

export const quakeViewModelLocalRotation = (
    cameraRotation: Quat,
    modelAngles: Vec3
): Quat => cameraRotation.clone().invert().mul(
    quakeAliasRotation(modelAngles).mul(VIEWMODEL_BASE_ROTATION)
);

export const quakeViewModelVerticalOffset = (viewSize: number): number => {
    if (viewSize === 110 || viewSize === 90) {
        return 1;
    }
    if (viewSize === 100) {
        return 2;
    }
    if (viewSize === 80) {
        return 0.5;
    }
    return 0;
};

export const quakeViewModelLocalPosition = (
    cameraRotation: Quat,
    viewAngles: Vec3,
    bob: number,
    verticalOffset = 2,
    screenOffset: Vec3 = [0, 0, 0]
): PlayCanvasVec3 => {
    const forward = quakeAngleBasis(viewAngles, false).forward;
    const quakeOffset: Vec3 = [
        forward[0] * bob * 0.4 - 1 / 32 - screenOffset[0],
        forward[1] * bob * 0.4 - 1 / 32 - screenOffset[1],
        forward[2] * bob * 0.4 + verticalOffset - 1 / 32 - screenOffset[2]
    ];
    const playCanvasOffset = toPlayCanvasDirection(quakeOffset);
    return cameraRotation.clone().invert().transformVector(
        new PlayCanvasVec3(...playCanvasOffset)
    );
};

export const quakeViewModelLightDirection = (modelAngles: Vec3): Vec3 => {
    const basis = quakeAngleBasis(modelAngles, true);
    return [basis.right[0], basis.up[0], -basis.forward[0]];
};
