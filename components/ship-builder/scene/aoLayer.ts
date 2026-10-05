/**
 * The three.js layer holding the big shapes that cast ambient occlusion: hull,
 * blocks, funnels and other large bodies. Layer 0 stays on, so the main render
 * and picking see them as before; the occlusion depth pass looks through a
 * camera restricted to this layer, so railings, windows, lifeboats and the
 * rest are not drawn a second time just to darken a crease.
 */
export const AO_LAYER = 1;

/** Layers 0 and `AO_LAYER`, as a bit mask. */
export const AO_OCCLUDER_MASK = 0b11;

/** Spread onto a mesh to make it an occluder: `<mesh {...AO_OCCLUDER}>`. */
export const AO_OCCLUDER = { "layers-mask": AO_OCCLUDER_MASK } as const;
