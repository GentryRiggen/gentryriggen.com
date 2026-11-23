import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
  Matrix4,
  Color,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  CARPATHIA_PLACES,
  BRITANNIC_PLACES,
  FITZGERALD_PLACES,
  LUSITANIA_PLACES,
  PLACES,
  deckZAt,
  type PlaceId,
} from "@/lib/shipwreck/places";
import {
  FITZGERALD_HATCHES,
  FITZGERALD_TANK_Y,
  fitzgerald,
} from "@/lib/shipwreck/ships/fitzgerald";
import { CARPATHIA_WING_Y, carpathia } from "@/lib/shipwreck/ships/carpathia";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import {
  BRITANNIC_E_DECK_ROW_Z,
  INNER_SKIN_M,
  britannic,
  britannicHalfBreadthAt,
} from "@/lib/shipwreck/ships/britannic";
import type {
  Compartment,
  Opening,
  ShipId,
  ShipSpec,
} from "@/lib/shipwreck/ships/types";
import { hullHalfBreadth, type HullModel } from "@/lib/shipwreck/sim/geometry";
import { cargoLayer, compartmentTopZ } from "@/lib/shipwreck/xray";

/**
 * Geometry for the X-ray cutaway, in the ship frame written in three.js
 * axes (three.x = x, three.y = z, three.z = -y): each compartment's water
 * as a closed loft of hull sections (the shader cuts it at the sim's level),
 * (a side bunker's only across its wing, between the longitudinal bulkhead
 * and the shell), the bulkheads' outlines, the openings and the places'
 * blockouts.
 */

/**
 * The water shaders' room for a part's cells (uniform arrays): every
 * compartment of every ship. The Britannic has 32 (her double skin splits
 * each boiler and engine room in three); 24 left her forward holds dry.
 */
export const XRAY_SLOTS = 32;

const NX = 6;
const NZ = 10;
/** The water sits just inside the shell so the ghost hull stays on top. */
const INSET = 0.96;

/** How far a cell's water stands in from a longitudinal bulkhead (m). */
const WALL_GAP = 0.1;

/**
 * A cell's share of a section of inset half-breadth `hb` (ship y, to port):
 * the whole breadth, or its side of the longitudinal bulkheads.
 */
function cellSpan(
  c: Pick<Compartment, "span"> | undefined,
  hb: number
): [lo: number, hi: number] {
  const sp = c?.span;
  if (!sp) return [-hb, hb];
  if (sp.side === "centre") {
    const y = Math.min(hb, sp.y - WALL_GAP);
    return [-y, y];
  }
  const y = Math.min(hb, sp.y + WALL_GAP);
  return sp.side === "port" ? [y, hb] : [-hb, -y];
}

/**
 * Ring of a section at x from the keel to `top`: port up, starboard down
 * (across the cell's share of the breadth).
 */
function sectionRing(
  hull: HullModel,
  x: number,
  top: number,
  cell?: Pick<Compartment, "span">,
  bottom = 0.05
): number[][] {
  const port: number[][] = [];
  const star: number[][] = [];
  for (let j = 0; j <= NZ; j += 1) {
    const z = bottom + ((top - bottom) * j) / NZ;
    const hb = Math.max(0.05, hullHalfBreadth(hull, x, z) * INSET);
    const [lo, hi] = cellSpan(cell, hb);
    // three.z = -y
    port.push([x, z, -hi]);
    star.push([x, z, -lo]);
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
      rings.push(sectionRing(hull, xi, compartmentTopZ(c, x), c));
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
      let cz = 0;
      for (const p of ring) {
        cy += p[1];
        cz += p[2];
      }
      const center = [cx, cy / n, cz / n];
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

/**
 * A laker's cargo in the X-ray: each hold's taconite as a dense, solid
 * layer from her tank top to its level (`cargoLayer`: its bulk volume
 * across the hold), a closed loft across the hold's own span, for the
 * pieces a part holds. Null for a ship without cargo.
 */
export function cargoGeometry(
  hull: HullModel,
  spec: Pick<ShipSpec, "compartments" | "decks" | "beam">,
  pieces: readonly { index: number; fromX: number; toX: number }[]
): BufferGeometry | null {
  const pos: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) =>
    pos.push(...a, ...b, ...c);
  for (const piece of pieces) {
    const c = spec.compartments[piece.index];
    const layer = cargoLayer(spec, c);
    if (!layer || piece.toX - piece.fromX < 0.5) continue;
    const rings: number[][][] = [];
    for (let i = 0; i <= NX; i += 1) {
      const x = piece.fromX + 0.25 + ((piece.toX - piece.fromX - 0.5) * i) / NX;
      rings.push(sectionRing(hull, x, layer.topZ, c, layer.bottomZ));
    }
    const n = rings[0].length;
    for (let i = 0; i < NX; i += 1)
      for (let k = 0; k < n; k += 1) {
        const k2 = (k + 1) % n;
        tri(rings[i][k], rings[i + 1][k], rings[i + 1][k2]);
        tri(rings[i][k], rings[i + 1][k2], rings[i][k2]);
      }
    for (const [ring, flip] of [
      [rings[0], true],
      [rings[NX], false],
    ] as const) {
      let cy = 0;
      let cz = 0;
      for (const p of ring) {
        cy += p[1];
        cz += p[2];
      }
      const centre = [ring[0][0], cy / n, cz / n];
      for (let k = 0; k < n; k += 1) {
        const k2 = (k + 1) % n;
        if (flip) tri(centre, ring[k2], ring[k]);
        else tri(centre, ring[k], ring[k2]);
      }
    }
  }
  if (pos.length === 0) return null;
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A laker's double bottom in the X-ray: the tank top over it along each
 * cargo hold, at the hold's sides and across at its ends, as line pairs
 * (her side tanks show by their longitudinal bulkheads, `bulkheadLines`).
 * Null for a ship without cargo.
 */
export function doubleBottomLines(
  hull: HullModel,
  spec: Pick<ShipSpec, "compartments" | "decks" | "beam">,
  fromX: number,
  toX: number
): BufferGeometry | null {
  const pts: number[] = [];
  for (const c of spec.compartments) {
    const layer = cargoLayer(spec, c);
    if (!layer) continue;
    const a = Math.max(c.fromX, fromX);
    const b = Math.min(c.toX, toX);
    if (b - a < 0.1) continue;
    const z = layer.bottomZ;
    const halfAt = (x: number) =>
      Math.min(
        c.span?.side === "centre" ? c.span.y : spec.beam / 2,
        hullHalfBreadth(hull, x, z)
      );
    for (const side of [-1, 1])
      pts.push(a, z, side * halfAt(a), b, z, side * halfAt(b));
    pts.push(
      a,
      z,
      -halfAt(a),
      a,
      z,
      halfAt(a),
      b,
      z,
      -halfAt(b),
      b,
      z,
      halfAt(b)
    );
  }
  if (pts.length === 0) return null;
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
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
  // The longitudinal bulkheads beside the side bunkers: their top and
  // bottom edges and a line at mid-height, along the bunker.
  for (const c of spec.compartments) {
    const sp = c.span;
    if (!sp || sp.side === "centre") continue;
    const a = Math.max(c.fromX, fromX);
    const b = Math.min(c.toX, toX);
    if (b - a < 0.1) continue;
    const zt = (c.aftBulkheadTopZ + c.fwdBulkheadTopZ) / 2;
    // Where the shell is first wider than the bulkhead is out.
    let zb = zt;
    for (let z = 0.2; z < zt; z += 0.25) {
      if (hullHalfBreadth(hull, (a + b) / 2, z) >= sp.y) {
        zb = z;
        break;
      }
    }
    const tz = sp.side === "port" ? -sp.y : sp.y; // three.z = -y
    for (const z of [zb, (zb + zt) / 2, zt]) pts.push(a, z, tz, b, z, tz);
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
  const openT: number[] = [];
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
    // When it opens (shown s): a later torpedo's gash shows from then.
    for (let k = 0; k < 6; k += 1) openT.push(o.t ?? 0);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  g.setAttribute("aOpenT", new BufferAttribute(new Float32Array(openT), 1));
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
  return bridgeAt(68.6, 69.2, PLACES.bridge.floorZ);
}

/** The wheelhouse's floor centred at `floorX`, the wheel at `x`. */
function bridgeAt(floorX: number, x: number, deck: number): Part[] {
  const parts: Part[] = [
    { g: box(floorX, 0, deck + 0.1, 4.6, 9.4, 0.2), color: 0x8a6a45 },
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
  // Four double-ended boilers across the beam, furnaces at both ends.
  return boilersAt(62.5, [-8.4, -2.8, 2.8, 8.4], 2.4, 20);
}

/** Double-ended boilers across the room at `ys` (radius r), on the tank top. */
function boilersAt(
  x0: number,
  ys: readonly number[],
  r: number,
  floorWidth: number
): Part[] {
  const zc = 1.6 + r + 0.15;
  const parts: Part[] = [
    { g: box(x0, 0, 1.6, 16, floorWidth, 0.15), color: 0x3a3a3a },
  ];
  for (const y of ys) {
    parts.push({
      g: at(new CylinderGeometry(r, r, 6.1, 18), x0, y, zc, {
        z: Math.PI / 2,
      }),
      color: 0x5a3a2a,
    });
    // The uptake to the funnel.
    parts.push({ g: box(x0, y, zc + r + 1, 1.6, 1.6, 2.2), color: 0x4a4a4a });
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

// The Lusitania's places.

function lusitaniaBridgeParts(): Part[] {
  const p = LUSITANIA_PLACES.bridge;
  return bridgeAt(p.at[0], p.at[0] + 0.6, p.floorZ);
}

function saloonParts(): Part[] {
  const p = LUSITANIA_PLACES["dining-saloon"];
  const x0 = p.at[0];
  const floor = p.floorZ;
  const upper = deckZAt("C", x0, lusitania);
  const top = deckZAt("B", x0, lusitania);
  const parts: Part[] = [
    { g: box(x0, 0, floor + 0.1, 22, 20, 0.2), color: 0xb89a6a },
  ];
  // Round tables with white cloths, in rows.
  for (let x = x0 - 8; x <= x0 + 8.01; x += 3.2) {
    for (const y of [-7, -3.5, 0, 3.5, 7]) {
      parts.push({
        g: at(new CylinderGeometry(0.8, 0.8, 0.12, 14), x, y, floor + 0.8),
        color: 0xf3ece0,
      });
      parts.push({
        g: at(new CylinderGeometry(0.12, 0.2, 0.7, 6), x, y, floor + 0.4),
        color: 0x8a6a45,
      });
    }
  }
  // The gallery round the well, one deck up, on white columns.
  for (const [dx, dy, lx, ly] of [
    [0, 8.5, 22, 3],
    [0, -8.5, 22, 3],
    [9.5, 0, 3, 14],
    [-9.5, 0, 3, 14],
  ]) {
    parts.push({
      g: box(x0 + dx, dy, upper + 0.1, lx, ly, 0.25),
      color: 0xe8dcc0,
    });
  }
  for (const x of [x0 - 8, x0 - 4, x0, x0 + 4, x0 + 8]) {
    for (const y of [-7, 7]) {
      parts.push({
        g: at(
          new CylinderGeometry(0.22, 0.22, upper - floor, 10),
          x,
          y,
          (floor + upper) / 2
        ),
        color: 0xf2ead8,
      });
    }
  }
  // The painted dome over the well, lit.
  const dome = new SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.applyMatrix4(m.makeScale(6, 1.6, 5));
  parts.push({ g: at(dome, x0, 0, top - 0.2), color: 0x6a5a40, glow: true });
  return parts;
}

function lusitaniaBoilerParts(): Part[] {
  // Three across: her forward boiler room is narrow low down.
  return boilersAt(
    LUSITANIA_PLACES["boiler-room-1"].at[0],
    [-5.2, 0, 5.2],
    2.3,
    14
  );
}

function bunkerParts(): Part[] {
  const p = LUSITANIA_PLACES["starboard-bunker"];
  const [x0, y0] = p.at;
  const parts: Part[] = [
    // The coal left six days out of New York: a low heap along the wing.
    { g: box(x0, y0 + 0.2, 2.8, 20, 2.6, 1.4), color: 0x1c1c1f },
    { g: box(x0 - 4, y0 + 0.3, 3.8, 7, 2.0, 0.8), color: 0x26262a },
    // A coal door in the bulkhead, to the boiler room.
    { g: box(x0 + 3, -9.45, 5.2, 1.4, 0.15, 1.6), color: 0x7a6a50 },
  ];
  for (const x of [x0 - 6, x0 + 6]) {
    parts.push({
      g: at(new SphereGeometry(0.25, 8, 6), x, y0, 9),
      color: 0xffd9a0,
      glow: true,
    });
  }
  return parts;
}

function turbineParts(): Part[] {
  const x0 = LUSITANIA_PLACES["turbine-room"].at[0];
  const parts: Part[] = [{ g: box(x0, 0, 1.6, 18, 18, 0.15), color: 0x3a3a3a }];
  // Four turbines, one to each propeller: the low-pressure ones inboard,
  // the high-pressure ones outboard.
  for (const [y, r, len] of [
    [-2.8, 2.0, 13],
    [2.8, 2.0, 13],
    [-7.2, 1.5, 9],
    [7.2, 1.5, 9],
  ]) {
    parts.push({
      g: at(new CylinderGeometry(r, r * 0.9, len, 18), x0, y, 5, {
        z: Math.PI / 2,
      }),
      color: 0x3d4a44,
    });
    // The shaft aft to its propeller.
    parts.push({
      g: at(new CylinderGeometry(0.3, 0.3, 56, 8), x0 - len / 2 - 28, y, 4, {
        z: Math.PI / 2,
      }),
      color: 0x9a9a8a,
    });
  }
  for (const x of [x0 - 6, x0, x0 + 6]) {
    parts.push({
      g: at(new SphereGeometry(0.3, 8, 6), x, 0, 10.5),
      color: 0xffe0a0,
      glow: true,
    });
  }
  return parts;
}

// The Fitzgerald's places.

function fitzPilothouseParts(): Part[] {
  const p = FITZGERALD_PLACES.pilothouse;
  const parts = bridgeAt(p.at[0], p.at[0] + 1.2, p.floorZ);
  // The radar sets and the chart table along its after wall.
  for (const y of [-3.2, 3.2])
    parts.push({
      g: box(p.at[0] - 2.4, y, p.floorZ + 0.6, 1.0, 1.4, 1.2),
      color: 0x4a5560,
    });
  parts.push({
    g: box(p.at[0] - 2.6, 0, p.floorZ + 0.45, 1.2, 2.2, 0.9),
    color: 0x7a5a3a,
  });
  // The radar screens, lit.
  for (const y of [-3.2, 3.2])
    parts.push({
      g: at(
        new CylinderGeometry(0.32, 0.32, 0.06, 14),
        p.at[0] - 2.4,
        y,
        p.floorZ + 1.23
      ),
      color: 0x7dffb0,
      glow: true,
    });
  return parts;
}

function fitzBellParts(): Part[] {
  const [x, y, z] = FITZGERALD_PLACES.bell.at;
  const floor = FITZGERALD_PLACES.bell.floorZ;
  return [
    // Its bronze bell hanging from a yoke on a short post.
    {
      g: box(x, y, (floor + z) / 2 + 0.2, 0.12, 0.12, z - floor + 0.4),
      color: 0x5a5a5a,
    },
    { g: box(x, y, z + 0.45, 0.12, 0.9, 0.12), color: 0x5a5a5a },
    {
      g: at(new CylinderGeometry(0.16, 0.3, 0.5, 16, 1, true), x, y, z),
      color: 0xc08a2e,
    },
    {
      g: at(
        new SphereGeometry(0.17, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        x,
        y,
        z + 0.24
      ),
      color: 0xc08a2e,
    },
  ];
}

function fitzHoldParts(): Part[] {
  // Her taconite is the X-ray's cargo layer; loaded by chute through each
  // hatch, it heaped up under them (USCG: the normal loading profile).
  const hold = fitzgerald.compartments.find((c) => c.id === "hold1")!;
  const layer = cargoLayer(fitzgerald, hold)!;
  return FITZGERALD_HATCHES.filter(
    (h) => h.x > hold.fromX && h.x < hold.toX
  ).map((h) => ({
    g: at(new ConeGeometry(3.6, 1.6, 14), h.x, 0, layer.topZ + 0.75),
    color: 0x5c3a2c,
  }));
}

function fitzTankParts(): Part[] {
  const [x0] = FITZGERALD_PLACES["ballast-tank"].at;
  const shell = 22.86 / 2;
  const wing = shell - FITZGERALD_TANK_Y;
  const parts: Part[] = [];
  // Her side frames in the tank (a few drawn): a web up the shell and a
  // floor across the wing to the tank's inner wall.
  for (let k = -3; k <= 3; k += 1) {
    const x = x0 + k * 2.4;
    parts.push({
      g: box(x, -(shell - 0.45), 6, 0.14, 0.5, 9.6),
      color: 0x4a4a4a,
    });
    parts.push({
      g: box(x, -(FITZGERALD_TANK_Y + wing / 2), 1.2, 0.14, wing - 0.3, 0.5),
      color: 0x4a4a4a,
    });
  }
  // The two broken vent pipes up to the deck, 8 in bores.
  for (const d of fitzgerald.deckOpenings ?? [])
    if (d.kind === "vent")
      parts.push({
        g: at(new CylinderGeometry(0.1, 0.1, 3, 8), d.x, d.y, d.z - 1.5),
        color: 0x8a5a3a,
      });
  return parts;
}

function fitzEngineParts(): Part[] {
  const x0 = FITZGERALD_PLACES["engine-room"].at[0];
  const floor = FITZGERALD_PLACES["engine-room"].floorZ;
  const parts: Part[] = [
    { g: box(x0, 0, floor, 24, 16, 0.15), color: 0x3a3a3a },
  ];
  // Her steam turbine and its gearing on the centre line, two boilers
  // forward of it, the shaft aft to her one propeller.
  parts.push({
    g: at(new CylinderGeometry(1.6, 1.9, 7, 18), x0 - 4, 0, floor + 2.4, {
      z: Math.PI / 2,
    }),
    color: 0x3d4a44,
  });
  parts.push({ g: box(x0 - 9, 0, floor + 1.6, 3, 4, 3), color: 0x56635c });
  for (const y of [-3.6, 3.6])
    parts.push({
      g: box(x0 + 7, y, floor + 3.2, 5, 4.4, 6.2),
      color: 0x5a3a2a,
    });
  parts.push({
    g: at(new CylinderGeometry(0.3, 0.3, 14, 8), x0 - 17, 0, 2.6, {
      z: Math.PI / 2,
    }),
    color: 0x9a9a8a,
  });
  for (const x of [x0 - 6, x0, x0 + 6])
    parts.push({
      g: at(new SphereGeometry(0.3, 8, 6), x, 0, floor + 7.5),
      color: 0xffe0a0,
      glow: true,
    });
  return parts;
}

// The Carpathia's places.

function carpBridgeParts(): Part[] {
  const p = CARPATHIA_PLACES.bridge;
  return bridgeAt(p.at[0], p.at[0] + 0.6, p.floorZ);
}

function carpBoilerParts(): Part[] {
  // Seven single-ended boilers (about 15½ ft across), three abreast
  // between her side bunkers: two rows back to back, furnaces outward,
  // and the seventh aft on the centre line (the arrangement is ours).
  const p = CARPATHIA_PLACES["boiler-room"];
  const room = carpathia.compartments.find((c) => c.id === "boiler")!;
  const r = 2.3;
  const len = 3.4;
  const floor = p.floorZ;
  const zc = floor + r + 0.15;
  const mid = (room.fromX + room.toX) / 2;
  const parts: Part[] = [
    {
      g: box(
        mid,
        0,
        floor,
        room.toX - room.fromX - 1,
        CARPATHIA_WING_Y * 2,
        0.15
      ),
      color: 0x3a3a3a,
    },
  ];
  const rows: { x: number; ys: number[]; face: 1 | -1 }[] = [
    { x: mid + 5.5, ys: [-5, 0, 5], face: 1 },
    { x: mid + 2, ys: [-5, 0, 5], face: -1 },
    { x: mid - 5.5, ys: [0], face: -1 },
  ];
  for (const row of rows)
    for (const y of row.ys) {
      parts.push({
        g: at(new CylinderGeometry(r, r, len, 18), row.x, y, zc, {
          z: Math.PI / 2,
        }),
        color: 0x5a3a2a,
      });
      for (const dy of [-1.1, 0, 1.1])
        parts.push({
          g: at(
            new CylinderGeometry(0.4, 0.4, 0.08, 12),
            row.x + row.face * (len / 2 + 0.04),
            y + dy,
            zc - 0.9,
            { z: Math.PI / 2 }
          ),
          color: 0xff7a2a,
          glow: true,
        });
    }
  // The coal bunker on her port side, where the first torpedo struck.
  parts.push({
    g: box(room.toX - 5, CARPATHIA_WING_Y + 0.9, floor + 1.2, 8, 1.4, 2),
    color: 0x1c1c1f,
  });
  return parts;
}

function carpEngineParts(): Part[] {
  // Two four-cylinder quadruple-expansion engines, port and starboard,
  // each turning a shaft aft to its propeller.
  const p = CARPATHIA_PLACES["engine-room"];
  const x0 = p.at[0];
  const floor = p.floorZ;
  const parts: Part[] = [
    { g: box(x0, 0, floor, 15, 15, 0.15), color: 0x3a3a3a },
  ];
  for (const y of [-3.8, 3.8]) {
    parts.push({ g: box(x0, y, floor + 1.4, 12, 3.4, 2.6), color: 0x3d4a44 });
    for (let k = 0; k < 4; k += 1)
      parts.push({
        g: at(
          new CylinderGeometry(
            k === 3 ? 1.3 : 1.0,
            k === 3 ? 1.3 : 1.0,
            4.6,
            16
          ),
          x0 - 4.5 + k * 3,
          y,
          floor + 5
        ),
        color: 0x56635c,
      });
    parts.push({
      g: at(new CylinderGeometry(0.3, 0.3, 50, 8), x0 - 31, y, 2.4, {
        z: Math.PI / 2,
      }),
      color: 0x9a9a8a,
    });
  }
  for (const x of [x0 - 5, x0, x0 + 5])
    parts.push({
      g: at(new SphereGeometry(0.3, 8, 6), x, 0, floor + 8.5),
      color: 0xffe0a0,
      glow: true,
    });
  return parts;
}

function carpHoldParts(): Part[] {
  // An empty hold in ballast: its floor, the hatch above with its ladder.
  const p = CARPATHIA_PLACES["hold-5"];
  const hold = carpathia.compartments.find((c) => c.id === "hold5")!;
  const x0 = p.at[0];
  const floor = p.floorZ;
  const top = Math.min(hold.aftBulkheadTopZ, hold.fwdBulkheadTopZ);
  const parts: Part[] = [
    {
      g: box(
        (hold.fromX + hold.toX) / 2,
        0,
        floor,
        hold.toX - hold.fromX - 1,
        9,
        0.15
      ),
      color: 0x4a4038,
    },
  ];
  // The hatch's coaming outline, at the top of the hold.
  for (const [dx, dy, lx, ly] of [
    [0, 2.6, 6, 0.3],
    [0, -2.6, 6, 0.3],
    [3, 0, 0.3, 5.5],
    [-3, 0, 0.3, 5.5],
  ])
    parts.push({
      g: box(x0 + dx, dy, top - 0.3, lx, ly, 0.5),
      color: 0x6a6a6a,
    });
  // A ladder down the hold's side.
  parts.push({
    g: box(x0 + 3.6, 0, (floor + top) / 2, 0.15, 0.8, top - floor),
    color: 0x8a8a7a,
  });
  parts.push({
    g: at(new SphereGeometry(0.3, 8, 6), x0, 0, top - 1.2),
    color: 0xffe0a0,
    glow: true,
  });
  return parts;
}

function carpSaloonParts(): Part[] {
  // Long tables down the room, chairs either side (the layout is ours).
  const p = CARPATHIA_PLACES["dining-saloon"];
  const x0 = p.at[0];
  const floor = p.floorZ;
  const parts: Part[] = [
    { g: box(x0, 0, floor + 0.1, 18, 16, 0.2), color: 0xb89a6a },
  ];
  for (const y of [-5, 0, 5]) {
    parts.push({ g: box(x0, y, floor + 0.8, 14, 1.4, 0.1), color: 0xf3ece0 });
    for (const dy of [-1.1, 1.1])
      for (let x = x0 - 6; x <= x0 + 6.01; x += 1.5)
        parts.push({
          g: box(x, y + dy, floor + 0.45, 0.5, 0.5, 0.9),
          color: 0x8a6a45,
        });
  }
  for (const x of [x0 - 5, x0, x0 + 5])
    parts.push({
      g: at(new SphereGeometry(0.3, 8, 6), x, 0, floor + 2.2),
      color: 0xffe6a8,
      glow: true,
    });
  return parts;
}

function carpWirelessParts(): Part[] {
  // A desk with the wireless set and its headphones, and a lamp.
  const p = CARPATHIA_PLACES["wireless-room"];
  const [x0] = p.at;
  const floor = p.floorZ;
  return [
    { g: box(x0, 0, floor + 0.1, 3, 3.4, 0.2), color: 0x8a6a45 },
    { g: box(x0 - 0.8, 0, floor + 0.75, 1.2, 2.4, 0.1), color: 0x7a5232 },
    { g: box(x0 - 0.9, 0, floor + 1.05, 0.7, 1.4, 0.5), color: 0x3a3a3a },
    {
      g: at(
        new TorusGeometry(0.16, 0.03, 6, 14, Math.PI),
        x0 - 0.5,
        0.6,
        floor + 0.95
      ),
      color: 0x222222,
    },
    {
      g: at(new SphereGeometry(0.18, 8, 6), x0 - 0.8, -0.9, floor + 1.4),
      color: 0xffe0a0,
      glow: true,
    },
  ];
}

// The Britannic's places (her data; the Titanic's frames and decks).

function britBridgeParts(): Part[] {
  const p = BRITANNIC_PLACES.bridge;
  return bridgeAt(p.at[0], p.at[0] + 0.6, p.floorZ);
}

function britHoldParts(): Part[] {
  // Hold 2 by the hold 2/3 bulkhead: her stores, crated, and the torn
  // shell plating of the mine's hole on her starboard side (just aft, in
  // hold 3, against the bulkhead).
  const p = BRITANNIC_PLACES["hold-2"];
  const [x0] = p.at;
  const floor = p.floorZ;
  const w = 2 * britannicHalfBreadthAt(x0 + 4, floor + 0.5) - 1;
  const parts: Part[] = [
    { g: box(x0 + 4, 0, floor, 12, w, 0.15), color: 0x4a4038 },
  ];
  for (const [dx, y, h] of [
    [1, -3, 1.6],
    [4, -1, 2.2],
    [7, 2, 1.4],
    [3, 3, 1.8],
    [9, 0, 1.2],
  ])
    parts.push({
      g: box(x0 + dx, y, floor + h / 2, 2.4, 2, h),
      color: 0x8a6a45,
    });
  const hole = britannic.realNight[0];
  const zMid = (hole.zLow + hole.zHigh) / 2;
  const side = britannicHalfBreadthAt(hole.x, zMid) - 0.3;
  // Plates bent inward round the hole, and the sea's way in (lit).
  for (const [dz, rot] of [
    [-1.2, 0.5],
    [0, -0.4],
    [1.3, 0.3],
  ])
    parts.push({
      g: at(
        new BoxGeometry(3, 1.1, 0.12),
        hole.x - 1 + dz,
        -side + 0.6,
        zMid + dz,
        { x: rot }
      ),
      color: 0x5a4a40,
    });
  parts.push({
    g: box(hole.x, -side, zMid, 3.2, 0.1, 2.6),
    color: 0x9fd6ff,
    glow: true,
  });
  return parts;
}

function britBoilerParts(): Part[] {
  // Five double-ended boilers across her front boiler room as her
  // sisters' (the Titanic's four; her beam is wider but the inner skin
  // takes it), and the inner skin's walls either side.
  const x0 = BRITANNIC_PLACES["boiler-room-6"].at[0];
  const parts = boilersAt(x0, [-8.4, -2.8, 2.8, 8.4], 2.4, 20);
  const y = britannic.beam / 2 - INNER_SKIN_M - 0.3;
  for (const s of [1, -1])
    parts.push({ g: box(x0, s * y, 6.5, 18, 0.12, 9.6), color: 0x6a6a64 });
  return parts;
}

function britPortholeParts(): Part[] {
  // Her open E-deck portholes forward (R8): a row of round windows in the
  // starboard side, their glass swung open into the room.
  const p = BRITANNIC_PLACES.portholes;
  const [x0] = p.at;
  // (At her E-deck row's height, the room's floor under it.)
  const z = BRITANNIC_E_DECK_ROW_Z;
  const half = britannicHalfBreadthAt(x0, z) - 0.3;
  const parts: Part[] = [
    { g: box(x0, -half + 3, z - 1.2, 16, 6, 0.1), color: 0x9a8a70 },
  ];
  for (let k = -3; k <= 3; k += 1) {
    const x = x0 + k * 2.2;
    parts.push({
      g: at(new TorusGeometry(0.24, 0.05, 6, 16), x, -half, z, {
        x: Math.PI / 2,
      }),
      color: 0xc89a4a,
    });
    // The glass on its hinge, swung in and up.
    parts.push({
      g: at(
        new CylinderGeometry(0.22, 0.22, 0.04, 14),
        x,
        -half + 0.2,
        z + 0.24,
        {
          x: 0.3,
        }
      ),
      color: 0xbfe4ff,
      glow: true,
    });
  }
  return parts;
}

function britGantryParts(): Part[] {
  // The gantry's electric motor and its drum of falls at the set's foot
  // (the model draws the gantry itself and its boats).
  const p = BRITANNIC_PLACES["gantry-davit"];
  const [x0, y0] = p.at;
  return [
    { g: box(x0, y0 + 2, p.floorZ + 0.7, 2.2, 1.4, 1.4), color: 0x3d4a44 },
    {
      g: at(
        new CylinderGeometry(0.45, 0.45, 1.6, 14),
        x0 + 1.8,
        y0 + 2,
        p.floorZ + 0.7,
        {
          z: Math.PI / 2,
        }
      ),
      color: 0x8a8a7a,
    },
    {
      g: at(new SphereGeometry(0.25, 8, 6), x0, y0 + 2, p.floorZ + 1.7),
      color: 0xffe0a0,
      glow: true,
    },
  ];
}

function britTurbineParts(): Part[] {
  // Her low-pressure turbine on the centre line, the shaft aft to her
  // middle propeller, its condensers either side.
  const x0 = BRITANNIC_PLACES["turbine-room"].at[0];
  const floor = BRITANNIC_PLACES["turbine-room"].floorZ;
  const parts: Part[] = [
    { g: box(x0, 0, floor, 18, 18, 0.15), color: 0x3a3a3a },
  ];
  parts.push({
    g: at(new CylinderGeometry(2.3, 2.8, 14, 20), x0, 0, floor + 3, {
      z: Math.PI / 2,
    }),
    color: 0x3d4a44,
  });
  parts.push({
    g: at(new CylinderGeometry(0.35, 0.35, 60, 8), x0 - 37, 0, 2.6, {
      z: Math.PI / 2,
    }),
    color: 0x9a9a8a,
  });
  for (const y of [-6, 6])
    parts.push({
      g: box(x0 + 1, y, floor + 2.2, 10, 3.2, 4.4),
      color: 0x56635c,
    });
  for (const x of [x0 - 6, x0, x0 + 6])
    parts.push({
      g: at(new SphereGeometry(0.3, 8, 6), x, 0, floor + 9),
      color: 0xffe0a0,
      glow: true,
    });
  return parts;
}

const BUILDERS: Record<ShipId, Partial<Record<PlaceId, () => Part[]>>> = {
  titanic: {
    bridge: bridgeParts,
    "grand-staircase": staircaseParts,
    "boiler-room-6": boilerParts,
    "engine-room": engineParts,
  },
  lusitania: {
    bridge: lusitaniaBridgeParts,
    "dining-saloon": saloonParts,
    "boiler-room-1": lusitaniaBoilerParts,
    "starboard-bunker": bunkerParts,
    "turbine-room": turbineParts,
  },
  // The hatch crane needs none: the model draws it.
  fitzgerald: {
    pilothouse: fitzPilothouseParts,
    bell: fitzBellParts,
    "cargo-hold-1": fitzHoldParts,
    "ballast-tank": fitzTankParts,
    "engine-room": fitzEngineParts,
  },
  carpathia: {
    bridge: carpBridgeParts,
    "boiler-room": carpBoilerParts,
    "engine-room": carpEngineParts,
    "hold-5": carpHoldParts,
    "dining-saloon": carpSaloonParts,
    "wireless-room": carpWirelessParts,
  },
  britannic: {
    bridge: britBridgeParts,
    "hold-2": britHoldParts,
    "boiler-room-6": britBoilerParts,
    portholes: britPortholeParts,
    "gantry-davit": britGantryParts,
    "turbine-room": britTurbineParts,
  },
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
export function placeGeometry(
  ship: ShipId,
  id: PlaceId
): {
  solid: BufferGeometry | null;
  glow: BufferGeometry | null;
} {
  const parts = BUILDERS[ship][id]?.() ?? [];
  return {
    solid: colored(parts.filter((p) => !p.glow)),
    glow: colored(parts.filter((p) => p.glow)),
  };
}
