import { BufferGeometry, Float32BufferAttribute } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { sidesKey, type BlockSides } from "@/lib/ship-builder/model/blockSides";
import { DEFAULT_BEVEL } from "./roundedBox";

/** Exposed faces sit at this fraction of the cell; joined ones reach the edge. */
export const BODY_INSET = 0.96;
/** Segments per bevel arc. One is plenty at a 0.06 radius. */
const BEVEL_SEGMENTS = 1;
const EPSILON = 1e-5;

const cache = new Map<string, BufferGeometry>();

interface Extent {
  min: number;
  max: number;
}

/** Where a block's faces sit along one axis, for its two ends. */
function extentOf(length: number, minJoined: boolean, maxJoined: boolean) {
  const exposed = (length * BODY_INSET) / 2;
  const flush = length / 2;
  return {
    min: -(minJoined ? flush : exposed),
    max: maxJoined ? flush : exposed,
  };
}

/**
 * The outer extent of a block's body for a joined mask, in the block's local
 * frame (world axes: bow is +x, starboard +z), centred on the footprint
 * horizontally and on the block's mid-height vertically. Exposed sides keep
 * the 0.96 inset; joined sides reach the cell boundary.
 */
export function bodyExtents(
  size: { x: number; z: number },
  height: number,
  joined: BlockSides
): { x: Extent; y: Extent; z: Extent } {
  return {
    x: extentOf(size.x, joined.stern, joined.bow),
    y: { min: -height / 2, max: height / 2 },
    z: extentOf(size.z, joined.port, joined.starboard),
  };
}

/**
 * The body of a grid block as a rounded box whose joined sides are flat and
 * flush with the cell edge, so neighbours meet without a seam. Exposed
 * vertical edges and exposed top edges keep the DEFAULT_BEVEL rounding; the
 * bottom is always flat. Built by growing a rounded box a bevel past every
 * flat side, clamping the overshoot to the boundary and dropping the faces
 * that end up lying in a joined plane (hidden against the neighbour, so
 * they would only cost triangles). Cached per size, height and mask (shared,
 * never disposed). Centred on the origin.
 */
export function blockBody(
  size: { x: number; z: number },
  height: number,
  joined: BlockSides
): BufferGeometry {
  const key = [size.x, size.z, height, sidesKey(joined)].join(":");
  const cached = cache.get(key);
  if (cached) return cached;
  const geometry = buildBlockBody(size, height, joined);
  cache.set(key, geometry);
  return geometry;
}

function buildBlockBody(
  size: { x: number; z: number },
  height: number,
  joined: BlockSides
): BufferGeometry {
  const { x, y, z } = bodyExtents(size, height, joined);
  const radius =
    Math.min(
      DEFAULT_BEVEL,
      (x.max - x.min) / 2,
      (y.max - y.min) / 2,
      (z.max - z.min) / 2
    ) * 0.999;
  // Every flat side (and the bottom) grows by a bevel, so the flat face of
  // the rounded box lands exactly on the boundary.
  const grow = {
    x: { min: joined.stern, max: joined.bow },
    y: { min: true, max: joined.top },
    z: { min: joined.port, max: joined.starboard },
  };
  const axes = { x, y, z } as const;
  const grown = (axis: "x" | "y" | "z") => ({
    min: axes[axis].min - (grow[axis].min ? radius : 0),
    max: axes[axis].max + (grow[axis].max ? radius : 0),
  });
  const gx = grown("x");
  const gy = grown("y");
  const gz = grown("z");
  const source = new RoundedBoxGeometry(
    gx.max - gx.min,
    gy.max - gy.min,
    gz.max - gz.min,
    BEVEL_SEGMENTS,
    radius
  );
  source.translate(
    (gx.max + gx.min) / 2,
    (gy.max + gy.min) / 2,
    (gz.max + gz.min) / 2
  );

  const positions = source.getAttribute("position").array as Float32Array;
  const normals = source.getAttribute("normal").array as Float32Array;
  const vertexCount = positions.length / 3;
  const bounds = [x, y, z];
  const flatSides = [
    [grow.x.min, grow.x.max],
    [grow.y.min, grow.y.max],
    [grow.z.min, grow.z.max],
  ];
  for (let v = 0; v < vertexCount; v++) {
    const hits: { axis: 0 | 1 | 2; sign: 1 | -1 }[] = [];
    for (const axis of [0, 1, 2] as const) {
      const value = positions[v * 3 + axis];
      const { min, max } = bounds[axis];
      if (flatSides[axis][1] && value > max + EPSILON) {
        positions[v * 3 + axis] = max;
        hits.push({ axis, sign: 1 });
      } else if (flatSides[axis][0] && value < min - EPSILON) {
        positions[v * 3 + axis] = min;
        hits.push({ axis, sign: -1 });
      }
    }
    if (hits.length > 0) {
      const { axis, sign } = hits[0];
      normals[v * 3] = 0;
      normals[v * 3 + 1] = 0;
      normals[v * 3 + 2] = 0;
      normals[v * 3 + axis] = sign;
    }
  }

  // A triangle lying wholly in a joined plane is hidden against the
  // neighbour. The bottom plane stays: it is the block's visible underside.
  const joinedPlanes: { axis: 0 | 1 | 2; value: number }[] = [];
  if (joined.bow) joinedPlanes.push({ axis: 0, value: x.max });
  if (joined.stern) joinedPlanes.push({ axis: 0, value: x.min });
  if (joined.starboard) joinedPlanes.push({ axis: 2, value: z.max });
  if (joined.port) joinedPlanes.push({ axis: 2, value: z.min });
  if (joined.top) joinedPlanes.push({ axis: 1, value: y.max });
  const keptPositions: number[] = [];
  const keptNormals: number[] = [];
  for (let t = 0; t < vertexCount; t += 3) {
    const hidden = joinedPlanes.some(({ axis, value }) =>
      [0, 1, 2].every(
        (k) => Math.abs(positions[(t + k) * 3 + axis] - value) < EPSILON
      )
    );
    if (hidden) continue;
    for (let k = 0; k < 3; k++) {
      const at = (t + k) * 3;
      keptPositions.push(positions[at], positions[at + 1], positions[at + 2]);
      keptNormals.push(normals[at], normals[at + 1], normals[at + 2]);
    }
  }
  source.dispose();

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(keptPositions, 3)
  );
  geometry.setAttribute("normal", new Float32BufferAttribute(keptNormals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
