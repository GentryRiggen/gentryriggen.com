import { BufferGeometry, Float32BufferAttribute } from "three";
import type { InteriorMap } from "@/lib/shipwreck/interior";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { floorZ, type WalkMap } from "@/lib/shipwreck/walk";

/**
 * The deck doors' warm lit doorways (see README.md): for each `door` link,
 * a doorway on the house face between its two ends, a frame round it and
 * the edge of the door swung in, all one merged mesh (one draw) facing out
 * onto the deck. Not see-through: the house wall stays. HDR colours, so
 * bloom makes the doorway glow. Her part's local frame (three.js axes:
 * ship x, z, −y).
 */

/** A door link's outside end stands this far off the house face (m). */
export const DOOR_FACE_OFFSET_M = 0.45;
/** The lit doorway (m). */
export const DOOR_GLOW_WIDTH_M = 1.1;
export const DOOR_GLOW_HEIGHT_M = 2.1;
/** Proud of the wall so it never fights it (m). */
const PROUD_M = 0.03;
const FRAME_M = 0.09;
/** Linear colours: the warm light inside, the open leaf's edge, the frame. */
const GLOW: readonly [number, number, number] = [1.7, 0.95, 0.36];
const LEAF: readonly [number, number, number] = [0.9, 0.5, 0.22];
const FRAME: readonly [number, number, number] = [0.12, 0.065, 0.03];

export function doorGlowGeometry(
  interior: InteriorMap,
  map: WalkMap,
  spec: ShipSpec
): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  /** A quad in the door's plane: across (−1..1 of half widths) and up (m). */
  const quad = (
    o: readonly [number, number, number],
    ux: number,
    uy: number,
    a0: number,
    a1: number,
    z0: number,
    z1: number,
    c: readonly [number, number, number]
  ) => {
    // Counter-clockwise seen from outside (the normal points out to deck).
    const p = (a: number, z: number) => [
      o[0] + ux * a,
      o[2] + z,
      -(o[1] + uy * a),
    ];
    const v = [p(a0, z0), p(a1, z0), p(a1, z1), p(a0, z1)];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      pos.push(...v[i]);
      col.push(...c);
    }
  };
  for (const link of interior.links) {
    if (link.kind !== "door") continue;
    const [ox, oy] = link.from.at;
    const [ix, iy] = link.to.at;
    const len = Math.hypot(ix - ox, iy - oy);
    // Out toward the deck (from the inside end to the outside end).
    const nx = (ox - ix) / len;
    const ny = (oy - iy) / len;
    const off = DOOR_FACE_OFFSET_M - PROUD_M;
    const z = floorZ(map, link.from.area, ox, spec, oy);
    const o = [ox - nx * off, oy - ny * off, z] as const;
    // Across the doorway, so that (across, up) is counter-clockwise from
    // outside: across = up × out.
    const ux = -ny;
    const uy = nx;
    const w = DOOR_GLOW_WIDTH_M / 2;
    const h = DOOR_GLOW_HEIGHT_M;
    // The frame (behind), the light, the open leaf's edge on its hinge side.
    const f = FRAME_M;
    quad(o, ux, uy, -w - f, w + f, 0, h + f, FRAME);
    const o2 = [o[0] + nx * 0.005, o[1] + ny * 0.005, o[2]] as const;
    quad(o2, ux, uy, -w, w, 0, h, GLOW);
    const o3 = [o[0] + nx * 0.01, o[1] + ny * 0.01, o[2]] as const;
    quad(o3, ux, uy, w - 0.22, w, 0, h, LEAF);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  return g;
}
