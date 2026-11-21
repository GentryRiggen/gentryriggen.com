import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
  Matrix4,
  Color,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PLACES, deckZAt, type PlaceId } from "@/lib/shipwreck/places";
import type { Opening, ShipSpec } from "@/lib/shipwreck/ships/types";
import { hullHalfBreadth, type HullModel } from "@/lib/shipwreck/sim/geometry";
import { compartmentTopZ } from "@/lib/shipwreck/xray";

/**
 * Geometry for the X-ray cutaway, in the ship frame written in three.js
 * axes (three.x = x, three.y = z, three.z = -y): each compartment's water
 * as a closed loft of hull sections (the shader cuts it at the sim's level),
 * the bulkheads' outlines, the openings and the four places' blockouts.
 */

const NX = 6;
const NZ = 10;
/** The water sits just inside the shell so the ghost hull stays on top. */
const INSET = 0.96;

/** Ring of a section at x from the keel to `top`: port up, starboard down. */
function sectionRing(hull: HullModel, x: number, top: number): number[][] {
  const port: number[][] = [];
  const star: number[][] = [];
  for (let j = 0; j <= NZ; j += 1) {
    const z = 0.05 + ((top - 0.05) * j) / NZ;
    const hb = Math.max(0.05, hullHalfBreadth(hull, x, z) * INSET);
    port.push([x, z, -hb]);
    star.push([x, z, hb]);
  }
  return port.concat(star.reverse());
}

/**
 * Closed lofts for compartment pieces, with `aComp` (the slot of each piece
 * in the level uniform array).
 */
export function waterGeometry(
  hull: HullModel,
  spec: Pick<ShipSpec, "compartments">,
  pieces: readonly { index: number; fromX: number; toX: number }[]
): BufferGeometry {
  const pos: number[] = [];
  const comp: number[] = [];
  const tri = (a: number[], b: number[], c: number[], slot: number) => {
    pos.push(...a, ...b, ...c);
    comp.push(slot, slot, slot);
  };
  pieces.forEach((piece, slot) => {
    const c = spec.compartments[piece.index];
    const rings: number[][][] = [];
    for (let i = 0; i <= NX; i += 1) {
      const x = piece.fromX + ((piece.toX - piece.fromX) * i) / NX;
      // A hair in from each bulkhead so neighbours don't z-fight.
      const xi = Math.min(piece.toX - 0.15, Math.max(piece.fromX + 0.15, x));
      rings.push(sectionRing(hull, xi, compartmentTopZ(c, x)));
    }
    const n = rings[0].length;
    for (let i = 0; i < NX; i += 1) {
      const a = rings[i];
      const b = rings[i + 1];
      for (let k = 0; k < n; k += 1) {
        const k2 = (k + 1) % n;
        tri(a[k], b[k], b[k2], slot);
        tri(a[k], b[k2], a[k2], slot);
      }
    }
    // End caps (fans).
    for (const [ring, flip] of [
      [rings[0], true],
      [rings[NX], false],
    ] as const) {
      const cx = ring[0][0];
      let cy = 0;
      for (const p of ring) cy += p[1];
      const center = [cx, cy / n, 0];
      for (let k = 0; k < n; k += 1) {
        const k2 = (k + 1) % n;
        if (flip) tri(center, ring[k2], ring[k], slot);
        else tri(center, ring[k], ring[k2], slot);
      }
    }
  });
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aComp", new BufferAttribute(new Float32Array(comp), 1));
  g.computeVertexNormals();
  return g;
}

/** The bulkheads' outlines and the compartments' floors, as line pairs. */
export function bulkheadLines(
  hull: HullModel,
  spec: Pick<ShipSpec, "compartments">,
  fromX: number,
  toX: number
): BufferGeometry {
  const pts: number[] = [];
  const xs = new Set<number>();
  for (const c of spec.compartments) {
    if (c.fromX > fromX + 0.1 && c.fromX < toX - 0.1) xs.add(c.fromX);
  }
  for (const x of xs) {
    const c = spec.compartments.find((k) => Math.abs(k.fromX - x) < 1e-6);
    const top = c ? c.aftBulkheadTopZ : 15;
    const ring = sectionRing(hull, x, top);
    for (let k = 0; k < ring.length; k += 1) {
      const a = ring[k];
      const b = ring[(k + 1) % ring.length];
      pts.push(a[0], a[1], a[2] / INSET, b[0], b[1], b[2] / INSET);
    }
    // A cross at mid-height so a bulkhead reads as a wall.
    const mid = top / 2;
    const hb = hullHalfBreadth(hull, x, mid);
    pts.push(x, mid, -hb, x, mid, hb);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
  return g;
}

/** Red gashes where the sea comes in (quads on the shell, jagged in the shader). */
export function openingGeometry(
  hull: HullModel,
  openings: readonly Opening[]
): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  for (const o of openings) {
    // Longer for a bigger opening: about 6 m for the real night's 0.3 m².
    const half = Math.max(2, Math.min(7, o.areaM2 * 20));
    const z0 = o.zLow;
    const z1 = o.zHigh;
    const side = o.side === "starboard" ? 1 : -1;
    const at = (x: number, z: number) => {
      const hb = hullHalfBreadth(hull, x, z) + 0.12;
      return [x, z, side * hb];
    };
    const a = at(o.x - half, z0);
    const b = at(o.x + half, z0);
    const c = at(o.x + half, z1);
    const d = at(o.x - half, z1);
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  return g;
}

// ---------------------------------------------------------------------------
// Place blockouts: simple shapes at the real places and sizes.

type Part = { g: BufferGeometry; color: number; glow?: boolean };

const m = new Matrix4();
function at(
  g: BufferGeometry,
  x: number,
  y: number,
  z: number,
  rot?: { x?: number; y?: number; z?: number }
): BufferGeometry {
  if (rot?.x) g.applyMatrix4(m.makeRotationX(rot.x));
  if (rot?.y) g.applyMatrix4(m.makeRotationY(rot.y));
  if (rot?.z) g.applyMatrix4(m.makeRotationZ(rot.z));
  // ship (x, y port, z up) -> three (x, z, -y)
  g.applyMatrix4(m.makeTranslation(x, z, -y));
  return g;
}

function box(
  x: number,
  y: number,
  z: number,
  lx: number,
  ly: number,
  lz: number
): BufferGeometry {
  // Centre at (x, y, z) in the ship frame; sizes along x, y, z.
  return at(new BoxGeometry(lx, lz, ly), x, y, z);
}

function bridgeParts(): Part[] {
  const p = PLACES.bridge;
  const x = 69.2;
  const deck = p.floorZ;
  const parts: Part[] = [
    { g: box(68.6, 0, deck + 0.1, 4.6, 9.4, 0.2), color: 0x8a6a45 },
    // The wheel (a ship's wheel on its stand) and the compass binnacle.
    {
      g: at(new TorusGeometry(0.55, 0.06, 6, 20), x, 0, deck + 1.35, {
        y: Math.PI / 2,
      }),
      color: 0x9a6a3a,
    },
    { g: box(x + 0.15, 0, deck + 0.6, 0.3, 0.3, 1.2), color: 0x6b4a2a },
    {
      g: at(new CylinderGeometry(0.28, 0.32, 1.2, 10), x + 1.3, 0, deck + 0.6),
      color: 0xc89a4a,
    },
  ];
  // Engine telegraphs either side of the wheel.
  for (const y of [-1.6, 1.6]) {
    parts.push({
      g: at(new CylinderGeometry(0.12, 0.18, 1.1, 8), x + 0.8, y, deck + 0.55),
      color: 0xc89a4a,
    });
    parts.push({
      g: at(
        new CylinderGeometry(0.32, 0.32, 0.14, 14),
        x + 0.8,
        y,
        deck + 1.2,
        {
          z: Math.PI / 2,
        }
      ),
      color: 0xf0e0b0,
      glow: true,
    });
  }
  return parts;
}

function staircaseParts(): Part[] {
  const x0 = 37.4;
  const decks = ["E", "D", "C", "B", "A", "Boat"];
  const parts: Part[] = [];
  for (let i = 0; i < decks.length; i += 1) {
    const z = deckZAt(decks[i], x0);
    // Landing.
    parts.push({ g: box(x0 - 2.5, 0, z + 0.1, 5, 9, 0.2), color: 0x7a5232 });
    if (i === decks.length - 1) break;
    const z1 = deckZAt(decks[i + 1], x0);
    // A flight of steps going forward and up, split around a centre rail.
    const steps = 12;
    for (let s = 0; s < steps; s += 1) {
      const u = (s + 0.5) / steps;
      parts.push({
        g: box(x0 + 0.2 + u * 4.2, 0, z + (z1 - z) * u, 0.42, 6.5, 0.25),
        color: 0x9a6a3e,
      });
    }
    // Balustrades.
    for (const y of [-3.3, 3.3]) {
      const len = Math.hypot(4.2, z1 - z);
      const g = new BoxGeometry(len, 0.12, 0.12);
      g.applyMatrix4(m.makeRotationZ(Math.atan2(z1 - z, 4.2)));
      parts.push({
        g: at(g, x0 + 2.3, y, (z + z1) / 2 + 0.9),
        color: 0xd9c08a,
      });
    }
  }
  // The glass dome over the top, lit.
  const zTop = deckZAt("Boat", x0) + 2.2;
  const dome = new SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.applyMatrix4(m.makeScale(3.4, 1.5, 3.0));
  parts.push({ g: at(dome, x0, 0, zTop), color: 0xbfe4ff, glow: true });
  // The chandelier under it.
  parts.push({
    g: at(new SphereGeometry(0.45, 10, 6), x0, 0, zTop - 0.8),
    color: 0xffe6a8,
    glow: true,
  });
  return parts;
}

function boilerParts(): Part[] {
  const x0 = 62.5;
  const zc = 1.6 + 2.55;
  const parts: Part[] = [{ g: box(x0, 0, 1.6, 16, 20, 0.15), color: 0x3a3a3a }];
  // Four double-ended boilers across the beam, furnaces at both ends.
  for (const y of [-8.4, -2.8, 2.8, 8.4]) {
    parts.push({
      g: at(new CylinderGeometry(2.4, 2.4, 6.1, 18), x0, y, zc, {
        z: Math.PI / 2,
      }),
      color: 0x5a3a2a,
    });
    // The uptake to the funnel.
    parts.push({ g: box(x0, y, zc + 3.4, 1.6, 1.6, 2.2), color: 0x4a4a4a });
    for (const end of [-1, 1]) {
      for (const dy of [-1.3, 0, 1.3]) {
        parts.push({
          g: at(
            new CylinderGeometry(0.42, 0.42, 0.08, 12),
            x0 + end * 3.07,
            y + dy,
            zc - 1.0,
            {
              z: Math.PI / 2,
            }
          ),
          color: 0xff7a2a,
          glow: true,
        });
      }
    }
  }
  return parts;
}

function engineParts(): Part[] {
  const parts: Part[] = [];
  // Two four-cylinder triple-expansion engines, port and starboard.
  for (const y of [-5.6, 5.6]) {
    parts.push({ g: box(-38, y, 3.2, 17, 4.6, 3.2), color: 0x3d4a44 });
    for (let k = 0; k < 4; k += 1) {
      const r = k === 0 || k === 3 ? 1.6 : 1.25;
      parts.push({
        g: at(new CylinderGeometry(r, r, 6.5, 16), -45 + k * 4.6, y, 8.1),
        color: 0x56635c,
      });
    }
    parts.push({ g: box(-38, y, 11.6, 18, 5, 0.4), color: 0x8a8a7a });
    // The shaft aft.
    parts.push({
      g: at(new CylinderGeometry(0.35, 0.35, 70, 8), -82, y, 2.6, {
        z: Math.PI / 2,
      }),
      color: 0x9a9a8a,
    });
  }
  // The low-pressure turbine in the next room aft, on the centre line.
  parts.push({
    g: at(new CylinderGeometry(2.1, 2.6, 13, 20), -57, 0, 4.6, {
      z: Math.PI / 2,
    }),
    color: 0x3d4a44,
  });
  parts.push({
    g: at(new CylinderGeometry(0.4, 0.4, 60, 8), -92, 0, 3, { z: Math.PI / 2 }),
    color: 0x9a9a8a,
  });
  // Lamps on the gratings.
  for (const x of [-44, -38, -32]) {
    parts.push({
      g: at(new SphereGeometry(0.3, 8, 6), x, 0, 12.6),
      color: 0xffe0a0,
      glow: true,
    });
  }
  return parts;
}

const BUILDERS: Record<PlaceId, () => Part[]> = {
  bridge: bridgeParts,
  "grand-staircase": staircaseParts,
  "boiler-room-6": boilerParts,
  "engine-room": engineParts,
};

function colored(parts: Part[]): BufferGeometry | null {
  if (parts.length === 0) return null;
  const c = new Color();
  const gs = parts.map((p) => {
    const g = p.g.index ? p.g.toNonIndexed() : p.g;
    g.deleteAttribute("uv");
    c.setHex(p.color);
    const n = g.getAttribute("position").count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new BufferAttribute(col, 3));
    return g;
  });
  return mergeGeometries(gs, false);
}

/** A place's blockout: solid shapes and glowing ones (lamps, furnaces). */
export function placeGeometry(id: PlaceId): {
  solid: BufferGeometry | null;
  glow: BufferGeometry | null;
} {
  const parts = BUILDERS[id]();
  return {
    solid: colored(parts.filter((p) => !p.glow)),
    glow: colored(parts.filter((p) => p.glow)),
  };
}
