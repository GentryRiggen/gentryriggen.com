import {
  concordia,
  concordiaEarth,
  frameX,
} from "@/lib/shipwreck/ships/concordia";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { SimEvent } from "@/lib/shipwreck/sim/events";
import { floorAt, shoreDistance } from "@/lib/shipwreck/sim/seabed";
import { sampleTrack, type SimTrack } from "@/lib/shipwreck/sim/track";

/**
 * Isola del Giglio's east coast on the night of 13 January 2012 (the
 * Costa Concordia): the island's land, the sea floor under her, Le
 * Scole, Giglio Porto's lights and its two mole lights. Pure data and
 * plain arrays (no three.js): `Coast.tsx` draws the land and the lights,
 * `Environment.tsx` the floor and its seagrass, `cameraMath.ts` keeps the
 * camera over both.
 *
 * One source of truth: every height comes from her `seabed` (the sim's
 * `floorAt`, lib/shipwreck/sim/seabed.ts) offshore and, inland of the
 * same traced shoreline (`shoreDistance` < 0), from SRTM's heights. So
 * the drawn shore is the sim's shore, and the floor she rests on is the
 * floor drawn under her.
 *
 * Earth frame: metres, x along her heading at the strike (350°), y to
 * port, z up (the sim's). Three.js axes: (x, z, −y).
 */

const SEABED = concordia.seabed!;

// ---------------------------------------------------------------------------
// The land: SRTM 1″ (30 m) heights [SRTM, via OpenTopoData's srtm30m],
// sampled every 0.002° over 42.335–42.395° N, 10.870–10.934° E (31 rows
// south to north, 33 columns west to east), metres. Bilinear between.

const SRTM_LAT0 = 42.335;
const SRTM_LON0 = 10.87;
const SRTM_STEP = 0.002;
const SRTM_ROWS = 31;
const SRTM_COLS = 33;
// prettier-ignore
const SRTM: readonly number[] = [0,0,0,0,0,0,0,0,0,0,0,0,0,7,58,131,166,199,252,286,305,328,371,374,371,347,311,220,131,125,62,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,54,120,172,211,255,304,318,329,367,378,325,299,299,252,191,136,88,26,0,0,0,0,0,0,0,0,0,0,0,0,0,25,5,83,170,199,243,272,309,347,369,386,321,274,219,210,201,155,93,35,6,0,0,0,0,0,0,0,0,0,0,0,0,1,92,46,87,172,242,298,330,400,406,374,321,260,203,175,149,128,86,20,0,0,0,0,0,0,0,0,0,0,0,0,0,82,115,128,126,150,167,247,337,402,451,410,343,283,226,176,122,88,41,8,0,0,0,0,0,0,0,0,0,0,0,0,0,4,156,219,178,169,211,270,278,354,464,415,337,293,252,217,180,134,88,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,38,208,277,241,206,273,333,385,425,427,370,326,281,233,176,125,115,108,39,3,0,0,0,0,0,0,0,0,0,0,0,0,3,137,226,293,309,299,332,365,445,463,400,346,293,247,178,142,122,83,49,51,22,0,0,0,0,0,0,0,0,1,6,0,0,70,148,224,286,326,372,409,450,475,439,404,351,330,294,217,137,84,58,5,0,0,0,0,0,0,0,1,3,33,63,77,59,32,72,141,223,278,308,354,377,386,384,383,398,395,400,328,265,183,138,115,47,0,0,0,0,0,0,0,89,91,97,105,79,96,63,82,160,232,263,288,293,290,286,309,348,395,440,451,410,324,257,190,161,88,11,4,0,0,0,0,0,112,171,166,148,109,61,89,110,186,239,234,222,197,228,249,289,349,404,456,453,345,279,212,162,124,81,30,49,3,0,0,0,0,138,147,155,143,118,62,89,156,193,175,186,161,170,233,283,320,362,415,463,412,319,198,138,93,39,7,8,3,0,0,0,0,0,146,130,94,120,83,65,39,102,136,125,138,153,207,221,270,313,380,423,428,381,332,237,149,90,24,-2,0,0,0,0,0,0,0,142,115,62,122,58,13,37,74,78,112,140,177,235,267,294,351,413,418,345,267,242,213,143,78,47,0,0,0,0,0,0,0,0,88,93,33,28,4,3,28,12,71,127,139,183,229,281,343,349,380,344,254,178,134,106,94,91,27,1,0,0,0,0,0,0,0,26,2,0,0,0,0,0,11,60,106,157,200,239,289,352,389,326,239,163,118,76,57,55,45,21,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,4,30,79,140,188,244,263,302,333,316,268,188,122,72,41,12,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,17,73,105,146,187,227,251,284,289,250,185,130,83,68,27,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-2,53,82,134,184,220,218,236,250,216,172,145,123,66,45,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,22,63,116,139,151,185,233,272,235,196,147,85,37,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,24,63,104,147,180,219,257,254,216,164,138,67,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,59,100,132,149,168,185,194,197,186,163,89,20,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,48,108,150,176,181,171,163,142,125,152,121,68,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,58,112,191,218,187,144,86,48,60,69,37,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,53,125,166,156,117,82,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,49,86,71,58,23,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,9,14,22,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

/** Latitude and longitude of an earth-frame point (concordiaEarth inverted). */
const INV = (() => {
  // concordiaEarth is affine in (lat, lon) (an equirectangular projection
  // turned to her heading): two long baselines give its matrix.
  const o = concordiaEarth(42.36, 10.92);
  const a = concordiaEarth(42.46, 10.92);
  const b = concordiaEarth(42.36, 11.02);
  const m00 = (a[0] - o[0]) / 0.1;
  const m10 = (a[1] - o[1]) / 0.1;
  const m01 = (b[0] - o[0]) / 0.1;
  const m11 = (b[1] - o[1]) / 0.1;
  const det = m00 * m11 - m01 * m10;
  return {
    o,
    i00: m11 / det,
    i01: -m01 / det,
    i10: -m10 / det,
    i11: m00 / det,
  };
})();

export function earthToLatLon(x: number, y: number): [number, number] {
  const dx = x - INV.o[0];
  const dy = y - INV.o[1];
  return [
    42.36 + INV.i00 * dx + INV.i01 * dy,
    10.92 + INV.i10 * dx + INV.i11 * dy,
  ];
}

/** SRTM's height (m) at an earth-frame point, bilinear, edges held. */
export function srtmHeight(x: number, y: number): number {
  const [lat, lon] = earthToLatLon(x, y);
  const r = Math.min(
    SRTM_ROWS - 1.001,
    Math.max(0, (lat - SRTM_LAT0) / SRTM_STEP)
  );
  const c = Math.min(
    SRTM_COLS - 1.001,
    Math.max(0, (lon - SRTM_LON0) / SRTM_STEP)
  );
  const r0 = Math.floor(r);
  const c0 = Math.floor(c);
  const fr = r - r0;
  const fc = c - c0;
  const at = (i: number, j: number) => SRTM[i * SRTM_COLS + j];
  return (
    (at(r0, c0) * (1 - fc) + at(r0, c0 + 1) * fc) * (1 - fr) +
    (at(r0 + 1, c0) * (1 - fc) + at(r0 + 1, c0 + 1) * fc) * fr
  );
}

function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth value noise (0–1) on a lattice of `cell` metres. */
function noise(x: number, y: number, cell: number): number {
  const u = x / cell;
  const v = y / cell;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fu = u - i;
  const fv = v - j;
  const su = fu * fu * (3 - 2 * fu);
  const sv = fv * fv * (3 - 2 * fv);
  const a = hash(i, j);
  const b = hash(i + 1, j);
  const c = hash(i, j + 1);
  const d = hash(i + 1, j + 1);
  return (a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv;
}

function smooth(e0: number, e1: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * The land's height (earth z, m) `inland` metres in from the shore: from
 * 0 at the shore it climbs as the floor falls away offshore (the first
 * 25 m at the profile's own slope, so the drawn waterline sits on the
 * shore), then the granite coast's steeper rise (never lower than that
 * rise up to 70 m), blending into SRTM's heights 30–200 m in (the hills behind Giglio Porto, Poggio della
 * Chiusa's 485 m ridge, Giglio Castello at about 400 m), with a little
 * hashed roughness of our own (rock and scrub; ±6 m, none at the shore).
 */
export function landHeight(x: number, y: number, inland: number): number {
  if (inland <= 0) return 0;
  const slope0 = SEABED.profile[1][1] / SEABED.profile[1][0];
  const coast =
    inland < 25 ? inland * slope0 : 25 * slope0 + (inland - 25) * 0.5;
  const k = smooth(30, 200, inland);
  // SRTM's 200 m lattice runs its sea-level samples a cell or two inland
  // along the shore (bilinear), which drew low flat sheets of land there:
  // the coast's own rise (to 70 m) is a floor under it.
  const h = Math.max(
    Math.min(coast, 70),
    coast * (1 - k) + Math.max(0, srtmHeight(x, y)) * k
  );
  const rough = (noise(x, y, 45) - 0.5) * 12 * smooth(20, 120, inland);
  // South of the drawn shore (it starts south of Giglio Porto) the land
  // falls into the sea by the grid's edge, so it ends in a slope, not a
  // cut (the island runs on about 2 km further south: not drawn).
  const south = smooth(GIGLIO_XS_START, GIGLIO_XS_START + 900, x);
  return Math.max(inland * 0.05, h + rough) * south - 4 * (1 - south);
}

/**
 * The ground (earth z) at an earth point: the land inland of her shore,
 * else the sim's floor (`floorAt`, negative).
 */
export function groundZ(
  x: number,
  y: number,
  spec: ShipSpec = concordia
): number {
  const d = shoreDistance(SEABED, x, y);
  return d < 0 ? landHeight(x, y, -d) : floorAt(spec, x, y);
}

// ---------------------------------------------------------------------------
// The mesh: one grid over land and sea, finer where she sails, drifts and
// lies (her run-in to past Punta Lazzaretto, her drift back to Punta
// Gabbianara and the harbour), coarser out to the horizon's edge.

/** Grid lines from [from, to, step] runs (each run's last line is the next's first). */
function axis(runs: readonly (readonly [number, number, number])[]): number[] {
  const out: number[] = [];
  for (const [a, b, step] of runs) {
    const n = Math.max(1, Math.round((b - a) / step));
    for (let i = out.length === 0 ? 0 : 1; i <= n; i += 1)
      out.push(a + ((b - a) * i) / n);
  }
  return out;
}

/** The grid's southern edge (earth x). */
const GIGLIO_XS_START = -2600;
/** Earth x (along 350°) and y (to port, toward the island) of the grid. */
export const GIGLIO_XS: readonly number[] = axis([
  [GIGLIO_XS_START, -1100, 300],
  [-1100, -460, 80],
  [-460, 2300, 10],
  [2300, 3000, 60],
  [3000, 5200, 300],
]);
export const GIGLIO_YS: readonly number[] = axis([
  [-3000, -800, 300],
  [-800, -140, 60],
  [-140, 960, 10],
  [960, 1600, 50],
  [1600, 3600, 160],
]);
/** The fine part of the grid (the shoreline matches the sim's there). */
export const GIGLIO_FINE = { x: [-460, 2300], y: [-140, 960] } as const;

/** Plain mesh arrays (three.js axes; colours linear 0–1). */
export interface MeshArrays {
  position: Float32Array;
  color: Float32Array;
  normal: Float32Array;
  index: Uint32Array;
}

/** sRGB hex to linear 0–1. */
function lin(hex: number): [number, number, number] {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
}

// Night colours (lit by starlight, the moon and her lights). The island's
// slopes are macchia over granite [WC: photographs of the east coast]: a
// dark olive with grey granite at the shore and in the bare places. The
// floor [WPP, MIT]: granite rock near the shore and on the spurs,
// Posidonia seagrass meadows down to about 35 m, then sand and mud.
const MACCHIA = lin(0x4c5536);
const MACCHIA_DARK = lin(0x343d26);
const GRANITE = lin(0x8d877c);
const GRANITE_DARK = lin(0x5f5a52);
const SAND = lin(0xa39577);
const MUD = lin(0x7d7362);
const POSIDONIA = lin(0x34462a);
const RED_TOWER = lin(0xb3302a);
const GREEN_TOWER = lin(0x2f8a45);
const WHITE = lin(0xe8e6de);

function mix3(
  a: readonly number[],
  b: readonly number[],
  k: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

function landColour(x: number, y: number, inland: number, h: number): number[] {
  const n = noise(x, y, 60);
  // Bare granite only right at the water (a narrow band: a wide one read
  // as a flat grey sheet on the low points by night), patchy, and the
  // summits' rock; macchia elsewhere.
  const shore = (1 - smooth(4, 22, inland)) * (0.5 + 0.5 * noise(x, y, 18));
  let c = mix3(MACCHIA, MACCHIA_DARK, n);
  c = mix3(
    c,
    GRANITE_DARK,
    Math.max(shore, smooth(0.62, 0.8, noise(x + 900, y, 90)) * 0.6)
  );
  // A little lighter up high (the ridge against the sky).
  return mix3(c, GRANITE_DARK, smooth(300, 480, h) * 0.3);
}

/** The floor's colour at a depth (m, + down). */
export function floorColour(x: number, y: number, depth: number): number[] {
  const n = noise(x, y, 25);
  if (depth < 6) return mix3(GRANITE, GRANITE_DARK, n);
  if (depth < 36) {
    // Seagrass meadows broken by sand and boulders.
    const meadow = smooth(0.35, 0.55, noise(x + 300, y - 200, 40));
    const base = mix3(SAND, GRANITE_DARK, smooth(0.6, 0.8, n));
    return mix3(base, POSIDONIA, meadow * (1 - smooth(30, 36, depth)));
  }
  return mix3(SAND, MUD, smooth(40, 110, depth) * 0.8 + n * 0.2);
}

/** Whether the floor at this depth and place grows seagrass (cards drawn). */
export function isMeadow(x: number, y: number, depth: number): boolean {
  return (
    depth > 6 &&
    depth < 34 &&
    smooth(0.35, 0.55, noise(x + 300, y - 200, 40)) > 0.6
  );
}

function pushMesh(pos: number[], col: number[], idx: number[]): MeshArrays {
  const position = new Float32Array(pos);
  const index = new Uint32Array(idx);
  return {
    position,
    color: new Float32Array(col),
    index,
    normal: faceNormals(position, index),
  };
}

/** Vertex normals by summing the faces round each vertex (small meshes). */
function faceNormals(p: Float32Array, idx: Uint32Array): Float32Array {
  const n = new Float32Array(p.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3;
    const b = idx[t + 1] * 3;
    const c = idx[t + 2] * 3;
    const ux = p[b] - p[a];
    const uy = p[b + 1] - p[a + 1];
    const uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a];
    const vy = p[c + 1] - p[a + 1];
    const vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      n[k] += nx;
      n[k + 1] += ny;
      n[k + 2] += nz;
    }
  }
  for (let k = 0; k < n.length; k += 3) {
    const l = Math.hypot(n[k], n[k + 1], n[k + 2]) || 1;
    n[k] /= l;
    n[k + 1] /= l;
    n[k + 2] /= l;
  }
  return n;
}

/** Everything the island draws: its meshes, its lights and its seagrass. */
export interface GiglioData {
  land: MeshArrays;
  floor: MeshArrays;
  lights: LightPoints;
  /** Seagrass clumps (`seagrassCards`) and their instance matrices (16 each). */
  grass: { cards: Float32Array; matrices: Float32Array };
}

/** One mesh of the grid, filled column by column into preallocated arrays. */
class GridMesh {
  readonly map: Int32Array;
  readonly pos: Float32Array;
  readonly col: Float32Array;
  readonly nor: Float32Array;
  readonly idx: Uint32Array;
  nv = 0;
  ni = 0;
  constructor(n: number, cells: number) {
    this.map = new Int32Array(n).fill(-1);
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.nor = new Float32Array(n * 3);
    this.idx = new Uint32Array(cells * 6);
  }
  arrays(): MeshArrays {
    return {
      position: this.pos.subarray(0, this.nv * 3),
      color: this.col.subarray(0, this.nv * 3),
      normal: this.nor.subarray(0, this.nv * 3),
      index: this.idx.subarray(0, this.ni),
    };
  }
}

/**
 * The island built in small steps (a generator: each `next()` is one
 * column of the grid, a few dozen houses or a row of seagrass, well under
 * a millisecond on a desktop), so the scene can spread it over frames
 * (`GiglioBuild`) and no frame is blocked. Returns everything at the end.
 */
export function* giglioBuild(
  spec: ShipSpec = concordia
): Generator<void, GiglioData, void> {
  const xs = GIGLIO_XS;
  const ys = GIGLIO_YS;
  const nx = xs.length;
  const ny = ys.length;
  const n = nx * ny;
  const dist = new Float64Array(n);
  const floor = new Float64Array(n);
  const ground = new Float64Array(n);
  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      const k = i * ny + j;
      const x = xs[i];
      const y = ys[j];
      dist[k] = shoreDistance(SEABED, x, y);
      floor[k] = floorAt(spec, x, y);
      ground[k] = dist[k] < 0 ? landHeight(x, y, -dist[k]) : floor[k];
    }
    yield;
  }
  const cells = (nx - 1) * (ny - 1);
  const meshes = [new GridMesh(n, cells), new GridMesh(n, cells)];
  const vert = (m: GridMesh, land: boolean, k: number): number => {
    if (m.map[k] >= 0) return m.map[k];
    const i = Math.floor(k / ny);
    const j = k % ny;
    const x = xs[i];
    const y = ys[j];
    const h = land ? ground : floor;
    const z = h[k];
    const v = m.nv;
    m.pos[v * 3] = x;
    m.pos[v * 3 + 1] = z;
    m.pos[v * 3 + 2] = -y;
    const c =
      land && dist[k] < 0
        ? landColour(x, y, -dist[k], z)
        : floorColour(x, y, -floor[k]);
    m.col[v * 3] = c[0];
    m.col[v * 3 + 1] = c[1];
    m.col[v * 3 + 2] = c[2];
    // The grid's normal from its neighbours' heights (central
    // differences; three axes: (−∂h/∂x, 1, ∂h/∂y) since three z = −y).
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(nx - 1, i + 1);
    const j0 = Math.max(0, j - 1);
    const j1 = Math.min(ny - 1, j + 1);
    const dx = (h[i1 * ny + j] - h[i0 * ny + j]) / (xs[i1] - xs[i0]);
    const dy = (h[i * ny + j1] - h[i * ny + j0]) / (ys[j1] - ys[j0]);
    const l = Math.hypot(dx, 1, dy);
    m.nor[v * 3] = -dx / l;
    m.nor[v * 3 + 1] = 1 / l;
    m.nor[v * 3 + 2] = dy / l;
    m.map[k] = v;
    m.nv += 1;
    return v;
  };
  const tri = (a: number, b: number, c: number) => {
    const la = dist[a] < 0;
    const lb = dist[b] < 0;
    const lc = dist[c] < 0;
    // The land: any corner on land; the floor: any corner at sea.
    if (la || lb || lc) {
      const m = meshes[0];
      m.idx[m.ni++] = vert(m, true, a);
      m.idx[m.ni++] = vert(m, true, b);
      m.idx[m.ni++] = vert(m, true, c);
    }
    if (!(la && lb && lc)) {
      const m = meshes[1];
      m.idx[m.ni++] = vert(m, false, a);
      m.idx[m.ni++] = vert(m, false, b);
      m.idx[m.ni++] = vert(m, false, c);
    }
  };
  for (let i = 0; i < nx - 1; i += 1) {
    for (let j = 0; j < ny - 1; j += 1) {
      const a = i * ny + j;
      const b = (i + 1) * ny + j;
      // Counter-clockwise seen from above (three y up, z = −y).
      tri(a, b, a + 1);
      tri(a + 1, b, b + 1);
    }
    yield;
  }
  const rocks = rockArrays(spec);
  yield;
  const land = merge(meshes[0].arrays(), rocks);
  yield;
  const lights = yield* lightSteps();
  const cards = yield* grassSteps(spec, 3200);
  const matrices = new Float32Array((cards.length / 5) * 16);
  for (let i = 0; i < cards.length / 5; i += 1) {
    const k = i * 5;
    const c = Math.cos(cards[k + 3]);
    const sn = Math.sin(cards[k + 3]);
    const sc = cards[k + 4];
    // A turn about the vertical, a uniform scale, the floor's place
    // (three.js column-major, as Matrix4.compose makes it).
    matrices.set(
      [
        c * sc,
        0,
        -sn * sc,
        0,
        0,
        sc,
        0,
        0,
        sn * sc,
        0,
        c * sc,
        0,
        cards[k],
        cards[k + 2],
        -cards[k + 1],
        1,
      ],
      i * 16
    );
    if (i % 400 === 399) yield;
  }
  return {
    land,
    floor: meshes[1].arrays(),
    lights,
    grass: { cards, matrices },
  };
}

/** Runs a step generator to its end (tests, and the island's wrappers). */
function finish<T>(g: Generator<void, T, void>): T {
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

/**
 * The island's land and the sea floor as two meshes from one grid. The
 * floor's every vertex is `floorAt` (its triangles where any corner is
 * sea); the land's are the ground (`groundZ`: land inland, the floor
 * offshore), its triangles where any corner is land, so the two meet on
 * the sim's shoreline. Le Scole's islets, the rock spurs she lay on and
 * the rock she struck are lumps of granite on them (`rockArrays`). All
 * at once (the scene builds it in steps: `giglioBuild`).
 */
export function buildGiglioGeometry(spec: ShipSpec = concordia): {
  land: MeshArrays;
  floor: MeshArrays;
} {
  const d = finish(giglioBuild(spec));
  return { land: d.land, floor: d.floor };
}

function merge(a: MeshArrays, b: MeshArrays): MeshArrays {
  const off = a.position.length / 3;
  const index = new Uint32Array(a.index.length + b.index.length);
  index.set(a.index);
  for (let i = 0; i < b.index.length; i += 1)
    index[a.index.length + i] = b.index[i] + off;
  const cat = (x: Float32Array, y: Float32Array) => {
    const o = new Float32Array(x.length + y.length);
    o.set(x);
    o.set(y, x.length);
    return o;
  };
  return {
    position: cat(a.position, b.position),
    color: cat(a.color, b.color),
    normal: cat(a.normal, b.normal),
    index,
  };
}

/**
 * The page's island, built a step at a time and kept (the CPU arrays; the
 * scene's GPU copies are made and disposed with its components).
 */
let giglioJob: Generator<void, GiglioData, void> | null = null;
let giglioDone: GiglioData | null = null;
const giglioListeners = new Set<() => void>();

/** The island if built (null until then). */
export function giglioReady(): GiglioData | null {
  return giglioDone;
}

/** Calls `f` once the island is built (returns the unsubscribe). */
export function onGiglioReady(f: () => void): () => void {
  giglioListeners.add(f);
  return () => giglioListeners.delete(f);
}

/**
 * Builds the island for at most `budgetMs` (by `now`, ms) and returns
 * it once done. Each step is small, so a frame's budget holds.
 */
export function stepGiglio(
  budgetMs: number,
  now: () => number = () => performance.now()
): GiglioData | null {
  if (giglioDone) return giglioDone;
  giglioJob ??= giglioBuild();
  const end = now() + budgetMs;
  do {
    const r = giglioJob.next();
    if (r.done) {
      giglioDone = r.value;
      giglioJob = null;
      for (const f of giglioListeners) f();
      return giglioDone;
    }
  } while (now() < end);
  return null;
}

// ---------------------------------------------------------------------------
// Le Scole, the spurs and the rock she struck.

/**
 * Le Scole's islets above the water: how high each stands (m). Not
 * surveyed in any source we have: low granite rocks, the biggest about
 * 10 m (photographs of the islets [WC] show them a few metres high;
 * ours, so they read from her decks at night).
 */
export function isletHeight(radiusM: number): number {
  return Math.min(10, 1.5 + radiusM * 0.25);
}

/** Her port side at the strike (earth y) and the rock's reach toward it. */
export const STRIKE_SIDE_Y = concordia.beam / 2;
/** How far outside her side the drawn rock stops (m): touching, not in her. */
export const STRIKE_GAP_M = 0.3;

/**
 * Every rock of her seabed as a granite lump over its bump in the floor
 * (drawn at the floor's own height, 0.1 m over it so the two do not
 * fight), Le Scole's islets standing out of the sea, and the rock she
 * struck: the sim's islet is a round bump (57.5 m deep at her side, as
 * `floorAt` gives it), but the real rock reached her below the waterline
 * [MIT §3, §4.7.2], so a ridge of it runs from Scola piccola to her port
 * side at frame 124, its face stopping `STRIKE_GAP_M` off her plating
 * from 1.5 m under the sea down to the floor. A look: the sim's floor
 * is unchanged.
 */
export function rockArrays(spec: ShipSpec = concordia): MeshArrays {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const rocks = spec.seabed?.rocks ?? [];
  const RINGS = 7;
  const SECTORS = 18;
  rocks.forEach((r, ri) => {
    const islet = r.topDepthM <= 0;
    const start = pos.length / 3;
    for (let a = 0; a <= RINGS; a += 1) {
      const f = a / RINGS;
      for (let s = 0; s < SECTORS; s += 1) {
        const th = (s / SECTORS) * Math.PI * 2;
        const wob = a === RINGS ? 1 : 0.85 + 0.3 * hash(ri * 31 + s, a);
        const rr = r.radiusM * f * wob;
        const x = r.x + Math.cos(th) * rr;
        const y = r.y + Math.sin(th) * rr;
        let z = floorAt(spec, x, y) + 0.1;
        // A spur under water: broken granite, boulders standing up to
        // about 2 m off its bump (it deformed her side [WPP]).
        if (!islet && a < RINGS)
          z += 2.2 * hash(ri * 13 + s, a * 5) * (1 - f * 0.6);
        if (islet) {
          const q = Math.min(1, (rr / r.radiusM) ** 2);
          z +=
            isletHeight(r.radiusM) *
            (1 - q) ** 0.6 *
            (0.75 + 0.5 * hash(s, ri + a));
        }
        pos.push(x, z, -y);
        const c = mix3(GRANITE, GRANITE_DARK, hash(ri + s * 3, a * 7));
        col.push(c[0], c[1], c[2]);
      }
    }
    for (let a = 0; a < RINGS; a += 1)
      for (let s = 0; s < SECTORS; s += 1) {
        const s1 = (s + 1) % SECTORS;
        const p = start + a * SECTORS;
        const q = start + (a + 1) * SECTORS;
        // Counter-clockwise from outside (above): faces out.
        idx.push(p + s, q + s, p + s1, p + s1, q + s, q + s1);
      }
  });
  // The struck rock's ridge, from Scola piccola (the islet nearest her
  // line) to her port side at frame 124 at the strike.
  const piccola = rocks
    .filter((r) => r.topDepthM <= 0)
    .reduce((m, r) => (Math.abs(r.y) < Math.abs(m.y) ? r : m), rocks[0]);
  if (piccola) {
    const tipX = frameX(124);
    const tipY = STRIKE_SIDE_Y + STRIKE_GAP_M;
    const U = 8;
    const V = 7;
    const start = pos.length / 3;
    for (let u = 0; u <= U; u += 1) {
      const f = u / U;
      const cx = piccola.x + (tipX - piccola.x) * f;
      const cy = piccola.y + (tipY - piccola.y) * f;
      const top = 1.2 + (-1.5 - 1.2) * f;
      const half = 6 + (3 - 6) * f;
      for (let v = 0; v <= V; v += 1) {
        const g = (v / V) * 2 - 1;
        // Across her line (x): the ridge's width.
        const x = cx + g * half;
        const y = u === U ? tipY : cy + (hash(u, v) - 0.5) * 0.8;
        const fl = floorAt(spec, x, y);
        const lump = (hash(u * 7 + 3, v) - 0.5) * 0.8;
        const z = top + lump - Math.abs(g) ** 1.5 * (top - fl);
        pos.push(x, z, -y);
        const c = mix3(GRANITE, GRANITE_DARK, hash(u + 50, v));
        col.push(c[0], c[1], c[2]);
      }
    }
    for (let u = 0; u < U; u += 1)
      for (let v = 0; v < V; v += 1) {
        const a = start + u * (V + 1) + v;
        const b = a + V + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    // The face against her side: from the ridge's last row to the floor.
    const last = start + U * (V + 1);
    const face = pos.length / 3;
    for (let v = 0; v <= V; v += 1) {
      const k = (last + v) * 3;
      const x = pos[k];
      pos.push(x, floorAt(spec, x, tipY), -tipY);
      const c = mix3(GRANITE, GRANITE_DARK, hash(v, 99));
      col.push(c[0], c[1], c[2]);
    }
    for (let v = 0; v < V; v += 1)
      idx.push(
        last + v,
        face + v,
        last + v + 1,
        last + v + 1,
        face + v,
        face + v + 1
      );
  }
  // Giglio Porto's two mole lights' towers (OpenStreetMap; lights below).
  for (const l of MOLE_LIGHTS) {
    const [x, y] = concordiaEarth(l.lat, l.lon);
    const base = Math.max(0, groundZ(x, y, spec));
    const c = l.colour === "red" ? RED_TOWER : GREEN_TOWER;
    const SIDES = 8;
    const s0 = pos.length / 3;
    for (let k = 0; k <= SIDES; k += 1) {
      const a = (k / SIDES) * Math.PI * 2;
      pos.push(x + Math.cos(a) * 1.6, base - 1, -(y + Math.sin(a) * 1.6));
      col.push(c[0], c[1], c[2]);
      pos.push(
        x + Math.cos(a) * 1.0,
        l.heightM - 0.6,
        -(y + Math.sin(a) * 1.0)
      );
      const w = k % 2 === 0 ? WHITE : c;
      col.push(w[0], w[1], w[2]);
    }
    for (let k = 0; k < SIDES; k += 1) {
      const a = s0 + k * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  return pushMesh(pos, col, idx);
}

// ---------------------------------------------------------------------------
// The lights: Giglio Porto's houses, its waterfront, Giglio Castello on the
// ridge, and the mole lights.

/**
 * Giglio Porto's two harbour lights [OSM seamarks, from the Italian list
 * of lights]: on the Molo Rosso, the eastern breakwater, E 1488, flashing
 * red every 3 s (0.5 s on), 9 m, 7 nmi, the harbour's main light; on the
 * Molo Verde, the northern one, E 1490, flashing green every 3 s, 9 m,
 * 7 nmi (Lighthouse Digest: a green conical tower).
 */
export const MOLE_LIGHTS = [
  {
    name: "Molo Rosso",
    lat: 42.3613839,
    lon: 10.9211564,
    colour: "red",
    heightM: 9,
    periodS: 3,
    onS: 0.5,
  },
  {
    name: "Molo Verde",
    lat: 42.3609793,
    lon: 10.9204094,
    colour: "green",
    heightM: 9,
    periodS: 3,
    onS: 0.5,
  },
] as const;

/**
 * Buildings of Giglio Porto, Arenella and Giglio Castello [OSM, building
 * outlines' centres; a third of the Porto's, half the Castello's]: as
 * (lat − 42.35, lon − 10.89) × 10⁵.
 */
// prettier-ignore
const BUILDINGS: readonly number[] = [627,3457,858,3211,649,3388,417,2582,533,2637,996,2515,925,3064,948,3005,1649,2754,1701,2803,1505,2451,1491,2467,1387,2534,1389,2458,1380,2557,1371,2563,1352,2572,1348,2481,1339,2640,1321,2627,1282,2813,1216,2736,1216,2789,1206,2749,1206,2712,1128,2869,1457,2459,1458,2469,1124,2847,1122,2829,1122,2756,1116,2911,1103,2859,1098,3041,1085,2890,1086,2664,1080,2798,1069,2911,1043,2844,1038,2893,1035,2843,1029,2827,1030,2722,1022,2933,1013,2861,1013,2940,1003,2967,1001,2952,1003,2736,989,2957,990,2882,991,2830,984,2813,985,2884,977,2959,978,2885,975,2925,968,2965,968,2918,950,2967,943,3250,944,3224,943,3183,940,2970,940,3004,942,2998,936,2899,925,3174,933,2959,924,3168,921,3154,926,3076,920,3096,920,3188,917,3143,918,3228,918,3073,912,3295,917,3007,912,3189,906,3339,913,2964,895,3121,896,3111,897,2860,889,3090,885,3184,877,3319,888,3140,880,3102,879,3164,878,3109,878,3051,881,3033,880,2837,872,3393,879,2863,872,3086,868,3143,869,3097,859,3314,865,3083,863,3158,859,3358,855,2999,851,3335,849,3323,852,3047,846,3365,847,3106,841,2989,837,3330,840,3295,840,3181,832,3316,831,3086,831,3189,831,3208,817,3040,816,3025,809,3115,806,3137,802,3150,799,3381,800,3355,803,3099,794,3348,793,3374,791,3341,1633,2745,743,3263,738,3197,734,3269,736,3099,730,3142,724,3224,723,3143,717,3290,694,3234,685,3414,675,3264,663,3398,658,3401,653,3357,649,3401,788,3154,784,3175,778,3322,777,3126,771,3323,761,3102,755,3200,758,3204,748,3180,1188,2711,1773,2919,1196,2783,1150,2875,1145,2928,1141,2793,1139,2852,949,2929,943,2975,820,3318,830,2967,825,3127,825,3121,822,3212,815,3387,817,3268,819,3000,1182,2725,1168,2775,1171,2810,1164,2782,1682,2559,962,2984,955,3255,958,2956,951,2957,957,2929,955,2842,1244,2689,940,3019,934,3195,932,3043,936,2986,1158,2813,904,3273,906,3101,896,3318,895,3345,902,3178,904,2861,903,3049,899,3168,1334,2638,1330,2691,1326,2626,770,3082,763,3417,761,3328,760,3437,1496,2456,1066,2844,1063,2754,1052,2861,1040,2884,644,3403,634,3479,631,3337,612,3530,617,3311,616,3205,600,3193,573,3240,542,3315,514,3235,507,3287,334,3089,274,3087,1139,3117,864,3199,1209,649,1311,669,1538,616,1770,569,1797,508,1683,1038,1662,1028,1627,1081,1596,989,1579,1025,1550,1070,1561,1042,1622,992,1986,706,1839,997,1838,864,1834,938,1829,869,1828,894,1683,958,1686,848,1680,1041,1682,1013,1678,1081,1678,932,1681,944,1678,1021,1678,960,1678,1001,1665,933,1662,967,1661,1020,1658,913,1658,1096,1656,1074,1660,989,1659,946,1659,931,1655,1001,1654,1103,1655,929,1650,1084,1651,908,1646,961,1644,939,1645,1064,1643,1005,1646,1051,1639,1053,1642,950,1644,915,1641,969,1642,928,1638,1026,1639,975,1637,1113,1636,1020,1635,1085,1635,1042,1637,916,1633,1064,1636,925,1634,960,1694,1047,1693,963,1692,1029,1686,1051,1627,1086,1627,1037,1625,1094,1621,1000,1619,1067,1621,1006,1625,910,1618,1030,1621,1043,1617,1048,1601,1067,1601,1061,1601,1011,1598,1071,1596,1108,1597,1063,1591,1049,1594,1101,1597,979,1596,1035,1597,988,1594,917,1588,1153,1593,1062,1590,1057,1588,1027,1588,1077,1588,1112,1588,1162,1586,994,1591,935,1585,1070,1585,1127,1573,1124,1584,949,1580,1072,1577,1109,1579,1017,1579,871,1575,887,1577,1057,1575,1037,1573,1063,1573,1097,1572,902,1574,1056,1566,1174,1571,1090,1570,1097,1568,1063,1552,1186,1529,1215,1527,1158,1527,1143,1525,1040,1526,1007,1526,849,1522,910,1522,1052,1516,1012,1509,1222,1511,1172,1500,1212,1508,1083,1437,1261,1619,1074,1615,1017,1615,1044,1612,1096,1614,1073,1615,1041,1612,1084,1613,1036,1609,994,1610,1013,1615,868,1608,1104,1611,1019,1609,1073,1608,877,1609,987,1603,1080,1605,1106,1604,1030,1604,1005,1603,1052,1601,1102,1407,1174,1401,1076,1391,1153,1375,1115,1373,1043,1367,1043,1362,1139,1353,1035,1344,1096,1345,1131,1342,1020,1332,1085,1336,1124,1325,1013,1314,1080,1311,1035,1305,1074,1303,1038,1301,1054,1283,997,1243,1027,1958,751,1484,1287,1486,1203,1478,1284,1489,887,1480,1203,1473,1283,1469,1233,1493,1179,1788,986,1787,973,1551,1075,1551,1065,1546,1129,1544,1215,1543,1203,1543,1256,1547,1065,1542,1197,1538,969,1540,924,1534,1257,1531,1212,1530,1150,1531,1073,1673,1075,1676,957,1674,1004,1675,1022,1670,1013,1667,944,1673,948,1668,1072,1663,980,1670,1020,1669,964,1666,1077,1666,1008,1663,1065,1665,921,1664,1024,1665,943,1567,1091,1564,1110,1559,1204,1565,1042,1563,1055,1562,1065,1556,1193,1557,1091,1557,1109,1558,1038,1553,1189,1553,848,1555,1048,1413,1167,1493,1172,1455,1090,1449,1155,1213,1031,1807,858,1227,1062,1215,1064,1653,917,1649,1033,1648,991,1646,1096,1650,927,1558,989,1557,1252,1562,968,1562,991,1607,762,1600,986,1599,1007,1602,959,1916,792,1426,1146,1205,1034,1711,1011,1703,999,1703,1044,1703,995,1863,826,1505,1011,1498,1213,1686,957,1685,843,1634,1030,1632,1099,1631,1072,1632,1027,1629,968,1630,1048,1630,1007,1628,1109,1630,993,1444,1084,1284,1048,1283,1056,1252,1053,1875,1037,1626,923,1623,1014,1621,1102,1623,1077,1624,1045,1622,940,1622,916,1703,800,1699,1029,1697,1025,1696,1043,1360,1046,1552,1055,1694,969,1692,983,1691,1008,1688,977,1687,963,1521,1035,1515,1147,1520,1030,1296,639];

/** Points of light (three.js axes), their colours (linear, > 1 blooms), sizes (m) and flashing (0 steady; else the period in s). */
export interface LightPoints {
  position: Float32Array;
  color: Float32Array;
  size: Float32Array;
  period: Float32Array;
  /** Each light's phase in its period (s). */
  phase: Float32Array;
}

/**
 * The island's lights on the night: one to three lit windows per house
 * (warm, a few cooler), from the ground up a storey or two; the
 * waterfront's street lamps; the mole lights flashing. Only on land
 * (`shoreDistance` < −2): a house the simplified shoreline puts in the
 * sea is left out.
 */
export function giglioLights(): LightPoints {
  return finish(lightSteps());
}

function* lightSteps(): Generator<void, LightPoints, void> {
  const p: number[] = [];
  const c: number[] = [];
  const s: number[] = [];
  const per: number[] = [];
  const ph: number[] = [];
  for (let i = 0; i < BUILDINGS.length; i += 2) {
    const lat = 42.35 + BUILDINGS[i] / 1e5;
    const lon = 10.89 + BUILDINGS[i + 1] / 1e5;
    const [x, y] = concordiaEarth(lat, lon);
    const d = shoreDistance(SEABED, x, y);
    if (d > -2) continue;
    // Giglio Castello, a walled village on the ridge 1.5 km off: its
    // houses pack close, so fewer and dimmer windows there (else, at that
    // range, they run together into one glow).
    const castello = lon < 10.91;
    if (castello && hash(i, 31) < 0.5) continue;
    const g = landHeight(x, y, -d);
    const n = castello ? 1 : 1 + Math.floor(hash(i, 1) * 3);
    for (let k = 0; k < n; k += 1) {
      const ox = (hash(i, k + 2) - 0.5) * 8;
      const oy = (hash(i, k + 5) - 0.5) * 8;
      const z = g + 2 + Math.floor(hash(i, k + 9) * 2) * 3;
      p.push(x + ox, z, -(y + oy));
      const warm = hash(i, k + 13);
      const b = (2.5 + 3 * hash(i, k + 17)) * (castello ? 0.45 : 1);
      if (warm < 0.85) c.push(1 * b, 0.62 * b, 0.28 * b);
      else c.push(0.75 * b, 0.82 * b, 1 * b);
      s.push(castello ? 2.2 : 3);
      per.push(0);
      ph.push(0);
    }
    if (i % 80 === 78) yield;
  }
  // The waterfront: sodium lamps every 30 m along the harbour's shore.
  const shore = SEABED.shore;
  for (let i = 0; i < shore.length - 1; i += 1) {
    const [ax, ay] = shore[i];
    const [bx, by] = shore[i + 1];
    if (ax < 380 || ax > 1000) continue;
    const len = Math.hypot(bx - ax, by - ay);
    for (let u = 0; u < len; u += 30) {
      const x = ax + ((bx - ax) * u) / len;
      const y = ay + ((by - ay) * u) / len;
      // A few metres inland of the quay.
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      const qx = x - nx * 6 * SEABED.seaSide;
      const qy = y - ny * 6 * SEABED.seaSide;
      const d = shoreDistance(SEABED, qx, qy);
      if (d > -2) continue;
      p.push(qx, landHeight(qx, qy, -d) + 5, -qy);
      c.push(5, 2.6, 0.7);
      s.push(3);
      per.push(0);
      ph.push(0);
    }
  }
  for (const l of MOLE_LIGHTS) {
    const [x, y] = concordiaEarth(l.lat, l.lon);
    p.push(x, l.heightM, -y);
    if (l.colour === "red") c.push(9, 0.6, 0.4);
    else c.push(0.5, 8, 1.6);
    s.push(5);
    per.push(l.periodS);
    ph.push(l.colour === "red" ? 0 : 1.3);
  }
  return {
    position: new Float32Array(p),
    color: new Float32Array(c),
    size: new Float32Array(s),
    period: new Float32Array(per),
    phase: new Float32Array(ph),
  };
}

/** Whether a flashing light is lit at time `t` (s): on for `onS` each period. */
export function flashOn(
  t: number,
  periodS: number,
  phaseS: number,
  onS = 0.5
): boolean {
  if (periodS <= 0) return true;
  const u = (((t + phaseS) % periodS) + periodS) % periodS;
  return u < onS;
}

// ---------------------------------------------------------------------------
// Seagrass (Posidonia oceanica): instanced cards on the meadows.

/**
 * Where the seagrass cards stand (earth x, y, z of the floor; a yaw; a
 * height in m), on a jittered 6 m lattice over the meadows of her part of
 * the shelf (around where she lies, by Punta Gabbianara), at most
 * `max`. Posidonia's leaves stand about a metre [WP: Posidonia oceanica].
 */
export function seagrassCards(
  spec: ShipSpec = concordia,
  max = 3200
): Float32Array {
  return finish(grassSteps(spec, max));
}

function* grassSteps(
  spec: ShipSpec,
  max: number
): Generator<void, Float32Array, void> {
  const out: number[] = [];
  for (let x = 700; x <= 1450 && out.length / 5 < max; x += 6) {
    yield;
    for (let y = 300; y <= 800 && out.length / 5 < max; y += 6) {
      const px = x + (hash(x, y) - 0.5) * 5;
      const py = y + (hash(y, x) - 0.5) * 5;
      if (shoreDistance(SEABED, px, py) < 0) continue;
      // Not on the rocks (bare granite: the spurs and Le Scole).
      if (
        SEABED.rocks?.some(
          (r) => (px - r.x) ** 2 + (py - r.y) ** 2 < (r.radiusM + 2) ** 2
        )
      )
        continue;
      const fz = floorAt(spec, px, py);
      if (!isMeadow(px, py, -fz)) continue;
      out.push(px, py, fz, hash(px, 3) * Math.PI * 2, 0.7 + 0.7 * hash(py, 5));
    }
  }
  return new Float32Array(out);
}

// ---------------------------------------------------------------------------
// The strike: a rush of white water along her port side aft.

/** How long the rock ran along her side (s): frame 124 to 52 [MIT §4.7.2]. */
export const STRIKE_S = 7;

/** How long after the strike the rock may take to reach frame 52 (s). */
const LODGE_WINDOW_S = 60;
/** How often `rockLodgedT` looks along her run (s). */
const LODGE_STEP_S = 0.1;

/**
 * When the rock she struck lodged in her side (shown s): the first time
 * Le Scole's tip, fixed in the sea where it met her frame 124 at the
 * `collision`, lies as far aft along her side as the rock stuck in it
 * (`rockX`, frame 52 [MIT §4.7.2]). The gash's 7 s assumes the 15.5 kn
 * she struck at; her sim runs on at 8.3 kn (her drift path), so the islet
 * reaches frame 52 at about 13 s: from then on the rock in her side is the
 * one the islet left there. `undefined` while the track does not reach it
 * yet; null with no collision; the collision plus `STRIKE_S` if she never
 * gets there within `LODGE_WINDOW_S`.
 */
export function rockLodgedT(
  track: SimTrack,
  rockX: number
): number | null | undefined {
  const c = track.events.find((e) => e.kind === "collision");
  if (!c || track.frames.length === 0) return null;
  const end = track.frames[track.frames.length - 1].t;
  const at = sampleTrack(track, c.t).bodies[0];
  // The islet's tip in the sea (earth x, y): her port side at frame 124.
  const fx = frameX(124);
  const hy = concordia.beam / 2;
  const ex = at.x + Math.cos(at.yaw) * fx - Math.sin(at.yaw) * hy;
  const ey = at.y + Math.sin(at.yaw) * fx + Math.cos(at.yaw) * hy;
  for (let t = c.t; t <= c.t + LODGE_WINDOW_S; t += LODGE_STEP_S) {
    if (t > end) return undefined;
    const b = sampleTrack(track, t).bodies[0];
    // How far forward of her midships the islet is now (ship-frame x).
    const along = (ex - b.x) * Math.cos(b.yaw) + (ey - b.y) * Math.sin(b.yaw);
    if (along <= rockX) return t;
  }
  return c.t + STRIKE_S;
}

/**
 * The strike's white water at shown time `t`: from the first
 * `collision` for `untilS` seconds (once a run; `STRIKE_S` unless the
 * scene knows when the rock lodged: `rockLodgedT`), where the rock is on
 * her side then (ship-frame x, from frame 124 aft to frame 52, the rock's
 * run), on her gash's side (`y`: + port), and how strong (0–1, a quick
 * rise and a fade). Null at any other time, or a run with no collision.
 */
export function strikeSpray(
  spec: ShipSpec,
  events: readonly SimEvent[],
  t: number,
  /**
   * How far she has run since the strike (m): the rock stays where it is
   * while she runs on past it, so the white water stays at the rock
   * (her ship-frame x: frame 124's less this, never aft of frame 52).
   * Missing: the rock's run at an even pace over the window.
   */
  runOnM?: number,
  untilS: number = STRIKE_S
): { x: number; y: number; amount: number } | null {
  if (!spec.gash) return null;
  let tc: number | null = null;
  for (const e of events)
    if (e.kind === "collision") {
      tc = e.t;
      break;
    }
  const span = Math.max(1, untilS);
  if (tc === null || t < tc || t > tc + span) return null;
  const u = (t - tc) / span;
  const fwd = frameX(124);
  const aft = spec.heel?.rock?.x ?? frameX(52);
  return {
    x:
      runOnM === undefined
        ? fwd + (aft - fwd) * u
        : Math.max(aft, fwd - Math.max(0, runOnM)),
    y: (spec.gash.side === "port" ? 1 : -1) * (spec.beam / 2),
    amount: Math.min(1, u * 8) * (1 - u * u),
  };
}

// ---------------------------------------------------------------------------
// Her boats to Giglio Porto.

/**
 * Where her boats went: into Giglio Porto, between the mole lights [MIT
 * §3: the boats ferried people to the harbour]. Each boat's slot just
 * outside the mouth (the boats lie off it; no people shown), earth x, y.
 */
export const HARBOUR_MOUTH: readonly [number, number] = (() => {
  const [rx, ry] = concordiaEarth(MOLE_LIGHTS[0].lat, MOLE_LIGHTS[0].lon);
  const [gx, gy] = concordiaEarth(MOLE_LIGHTS[1].lat, MOLE_LIGHTS[1].lon);
  return [(rx + gx) / 2 + 40, (ry + gy) / 2 - 30];
})();

/** A boat's slot off the harbour mouth (earth x, y): a fan of them. */
export function harbourSlot(i: number): [number, number] {
  const a = (hash(i, 11) - 0.5) * 2.4;
  const r = 25 + hash(i, 13) * 60;
  return [
    HARBOUR_MOUTH[0] + Math.cos(a) * r,
    HARBOUR_MOUTH[1] - Math.abs(Math.sin(a)) * r,
  ];
}

/**
 * A boat's way to the harbour (earth x, y waypoints): out from her side,
 * then, from her port (seaward) side, round her bow (which pointed at
 * Giglio Porto), then to its slot.
 */
export function boatRoute(
  launch: readonly [number, number],
  side: "port" | "starboard",
  shipX: number,
  shipY: number,
  yaw: number,
  i: number
): [number, number][] {
  const out = side === "port" ? 1 : -1;
  const px = -Math.sin(yaw) * out;
  const py = Math.cos(yaw) * out;
  const away: [number, number] = [launch[0] + px * 50, launch[1] + py * 50];
  const route: [number, number][] = [[launch[0], launch[1]], away];
  if (side === "port") {
    const half = concordia.loa / 2 + 60;
    route.push([
      shipX + Math.cos(yaw) * half + px * 40,
      shipY + Math.sin(yaw) * half + py * 40,
    ]);
  }
  route.push(harbourSlot(i));
  return route;
}

/**
 * The point `d` metres along a route (its end beyond) and its heading:
 * earth x, y and the heading (rad), into `out` (no allocation).
 */
export function alongRoute(
  route: readonly (readonly [number, number])[],
  d: number,
  out: [number, number, number] = [0, 0, 0]
): [number, number, number] {
  let left = Math.max(0, d);
  for (let i = 0; i < route.length - 1; i += 1) {
    const ax = route[i][0];
    const ay = route[i][1];
    const bx = route[i + 1][0];
    const by = route[i + 1][1];
    const len = Math.hypot(bx - ax, by - ay);
    if (left <= len || i === route.length - 2) {
      const u = len > 0 ? Math.min(1, left / len) : 1;
      out[0] = ax + (bx - ax) * u;
      out[1] = ay + (by - ay) * u;
      out[2] = Math.atan2(by - ay, bx - ax);
      return out;
    }
    left -= len;
  }
  const last = route[route.length - 1];
  out[0] = last[0];
  out[1] = last[1];
  out[2] = 0;
  return out;
}
