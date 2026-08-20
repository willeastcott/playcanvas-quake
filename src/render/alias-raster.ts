import {
    CULLFACE_BACK,
    FRONTFACE_CW,
    type ShaderMaterial
} from 'playcanvas';

// r_local.h uses ALIAS_Z_CLIP_PLANE 5 for MDLs. Quake's positive signed
// area is measured in a top-down framebuffer, so it maps to clockwise WebGL.
export const QUAKE_ALIAS_NEAR_CLIP = 5;
export const QUAKE_ALIAS_FRONT_FACE = FRONTFACE_CW;

export const configureQuakeAliasRaster = (material: ShaderMaterial): void => {
    material.cull = CULLFACE_BACK;
    material.frontFace = QUAKE_ALIAS_FRONT_FACE;
    material.setParameter('uAliasNearClip', QUAKE_ALIAS_NEAR_CLIP);
};
