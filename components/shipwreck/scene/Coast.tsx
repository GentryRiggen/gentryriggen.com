"use client";

import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshLambertMaterial,
} from "three";
import type { ShipId } from "@/lib/shipwreck/ships/types";
import { BRITANNIC_MINE, LUSITANIA_HIT } from "./settings";

/**
 * The south coast of County Cork on the northern horizon, as it lay from
 * where the torpedo struck (about 11 nautical miles south of the Old Head
 * of Kinsale): low green farmland over grey cliffs from Galley Head in the
 * west to Robert's Head in the east (sinking into the haze beyond), the long narrow Old Head standing out
 * toward her, with its lighthouse (black with two white bands) at the tip.
 * Real places (latitude and longitude, below), heights shown 2.5× (at 20–45 km
 * a 70 m cliff is a few pixels; drawn true it would not read as land). One
 * mesh, one draw call; the haze (the scene's fog) does the distance.
 */

/** Heights are drawn this many times their real size. */
export const COAST_HEIGHT_SCALE = 2.5;

/** The coast, west to east: [lat, lon, cliff m, hills inland m]. */
const COASTLINE: readonly [number, number, number, number][] = [
  [51.532, -8.952, 45, 120], // Galley Head
  [51.57, -8.9, 30, 110],
  [51.605, -8.86, 15, 120], // Clonakilty Bay
  [51.585, -8.8, 35, 110],
  [51.566, -8.716, 50, 90], // the Seven Heads
  [51.6, -8.69, 30, 100],
  [51.627, -8.66, 15, 120], // Courtmacsherry Bay
  [51.638, -8.6, 25, 130], // Garrettstown
  [51.632, -8.548, 40, 110], // the Old Head's neck
  [51.646, -8.522, 25, 140], // Bullen's Bay
  [51.672, -8.49, 30, 150], // toward Kinsale
  [51.68, -8.45, 40, 160],
  [51.695, -8.4, 45, 170], // Frower Point
  [51.728, -8.33, 50, 160], // Robert's Head
  [51.75, -8.3, 35, 140], // toward Cork Harbour, under the horizon
];

/** The Old Head: from its neck to the tip with the lighthouse. */
const OLD_HEAD = {
  neck: [51.632, -8.541] as const,
  tip: [51.6036, -8.5322] as const,
  halfWidthM: 240,
  heightM: 72,
};

const LAT_M = 111200;
/**
 * The land sinks into the sea between these distances from her (m), so it
 * never reaches the camera's far plane (42 km) and its ends fade into the
 * haze instead of stopping (the earth's curve hides it about so).
 */
export const COAST_FADE_FROM_M = 31000;
export const COAST_FADE_TO_M = 38000;

function sinkWithDistance(x: number, y: number, z: number): number {
  const d = Math.hypot(x, z);
  const f = Math.min(
    1,
    Math.max(0, (COAST_FADE_TO_M - d) / (COAST_FADE_TO_M - COAST_FADE_FROM_M))
  );
  return y * f - 12 * (1 - f);
}

/** A scene's origin on the earth and her heading there. */
export interface SceneOrigin {
  latDeg: number;
  lonDeg: number;
  headingDeg: number;
}

/**
 * Earth (lat, lon) to the scene's axes at the first event (x her heading,
 * z starboard): the Lusitania's hit unless another origin is given.
 */
export function coastToScene(
  lat: number,
  lon: number,
  origin: SceneOrigin = LUSITANIA_HIT
): [number, number] {
  const north = (lat - origin.latDeg) * LAT_M;
  const east =
    (lon - origin.lonDeg) * LAT_M * Math.cos((origin.latDeg * Math.PI) / 180);
  const h = (origin.headingDeg * Math.PI) / 180;
  return [
    east * Math.sin(h) + north * Math.cos(h),
    east * Math.cos(h) - north * Math.sin(h),
  ];
}

function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const FIELD = new Color(0x58763a);
const FIELD_DARK = new Color(0x3f5a2c);
const ROCK = new Color(0x8c8577);
const SHORE = new Color(0x6c665c);
const TOWER = new Color(0x15161a);
const BAND = new Color(0xf2f2ee);

/** The coast a ship's scene draws (the Lusitania's Cork by default). */
export function buildCoastGeometry(ship: ShipId = "lusitania"): BufferGeometry {
  return ship === "britannic" ? buildKeaGeometry() : buildCorkGeometry();
}

function buildCorkGeometry(): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const S = COAST_HEIGHT_SCALE;
  const vert = (x: number, y: number, z: number, c: Color) => {
    pos.push(x, sinkWithDistance(x, y, z), z);
    col.push(c.r, c.g, c.b);
    return pos.length / 3 - 1;
  };

  // --- The coast: a strip of land behind the shoreline, densified.
  const pts = COASTLINE.map(([la, lo, cliff, hill]) => ({
    p: coastToScene(la, lo),
    cliff,
    hill,
  }));
  const line: { x: number; z: number; cliff: number; hill: number }[] = [];
  const STEPS = 10;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    for (let k = 0; k < STEPS; k += 1) {
      const u = k / STEPS;
      const n = hash(i, k) - 0.5;
      line.push({
        x: a.p[0] + (b.p[0] - a.p[0]) * u,
        z: a.p[1] + (b.p[1] - a.p[1]) * u + n * 120,
        cliff: (a.cliff + (b.cliff - a.cliff) * u) * (0.8 + 0.4 * hash(k, i)),
        hill: (a.hill + (b.hill - a.hill) * u) * (0.75 + 0.5 * hash(i + 7, k)),
      });
    }
  }
  const last = pts[pts.length - 1];
  line.push({ x: last.p[0], z: last.p[1], cliff: last.cliff, hill: last.hill });
  // Inland (north is -z, nearly): rows back from the shore.
  const rows = [
    { d: -40, h: () => -6, c: SHORE },
    { d: 0, h: (p: (typeof line)[0]) => p.cliff * 0.15, c: ROCK },
    { d: 60, h: (p: (typeof line)[0]) => p.cliff, c: ROCK },
    { d: 160, h: (p: (typeof line)[0]) => p.cliff * 1.1, c: FIELD },
    { d: 1500, h: (p: (typeof line)[0]) => p.hill * 0.6, c: FIELD_DARK },
    { d: 4000, h: (p: (typeof line)[0]) => p.hill, c: FIELD },
    { d: 7000, h: (p: (typeof line)[0]) => p.hill * 0.7, c: FIELD_DARK },
  ];
  const width = rows.length;
  line.forEach((p, i) => {
    const prev = line[Math.max(0, i - 1)];
    const next = line[Math.min(line.length - 1, i + 1)];
    // Inland normal: left of the line running east (toward -z, north).
    let nx = next.z - prev.z;
    let nz = -(next.x - prev.x);
    const len = Math.hypot(nx, nz) || 1;
    nx /= len;
    nz /= len;
    if (nz > 0) {
      nx = -nx;
      nz = -nz;
    }
    for (const r of rows) {
      const wob = r.d > 100 ? (hash(i, r.d) - 0.5) * r.d * 0.15 : 0;
      vert(p.x + nx * (r.d + wob), r.h(p) * S, p.z + nz * (r.d + wob), r.c);
    }
  });
  for (let i = 0; i < line.length - 1; i += 1) {
    for (let r = 0; r < width - 1; r += 1) {
      const a = i * width + r;
      const b = (i + 1) * width + r;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  // --- The Old Head: a long narrow ridge with cliffs all round.
  const neck = coastToScene(OLD_HEAD.neck[0], OLD_HEAD.neck[1]);
  const tip = coastToScene(OLD_HEAD.tip[0], OLD_HEAD.tip[1]);
  const ax = tip[0] - neck[0];
  const az = tip[1] - neck[1];
  const alen = Math.hypot(ax, az);
  const ux = ax / alen;
  const uz = az / alen;
  const ACROSS = [-1.15, -1, -0.82, -0.4, 0, 0.4, 0.82, 1, 1.15];
  const ALONG = 18;
  const start = pos.length / 3;
  for (let i = 0; i <= ALONG; i += 1) {
    const u = i / ALONG;
    // Rounded at the tip; the ground falls a little toward it.
    const hw = OLD_HEAD.halfWidthM * Math.sqrt(Math.max(0, 1 - u ** 6)) + 20;
    const top =
      OLD_HEAD.heightM * (0.85 + 0.15 * (1 - u)) * (0.92 + 0.16 * hash(i, 3));
    for (const v of ACROSS) {
      const edge = Math.abs(v);
      const h =
        edge > 1.05
          ? -6
          : edge > 0.9
            ? top * 0.25
            : edge > 0.7
              ? top * 0.95
              : top;
      const c = edge > 0.75 ? ROCK : hash(i, v) > 0.5 ? FIELD : FIELD_DARK;
      const along = u * alen + (i === ALONG ? hw * 0.3 : 0);
      vert(
        neck[0] + ux * along - uz * v * hw,
        h * S,
        neck[1] + uz * along + ux * v * hw,
        c
      );
    }
  }
  const W2 = ACROSS.length;
  for (let i = 0; i < ALONG; i += 1)
    for (let r = 0; r < W2 - 1; r += 1) {
      const a = start + i * W2 + r;
      const b = start + (i + 1) * W2 + r;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }

  // --- The lighthouse near the tip: a tower, black with two white bands.
  const lx = tip[0] - ux * 60;
  const lz = tip[1] - uz * 60;
  const ground = OLD_HEAD.heightM * 0.85 * S;
  const towerH = 30 * S;
  const r0 = 4 * S;
  const SIDES = 10;
  const bands = [0, 0.3, 0.45, 0.62, 0.77, 1];
  for (let bI = 0; bI < bands.length - 1; bI += 1) {
    const c = bI % 2 === 1 ? BAND : TOWER;
    const y0 = ground + bands[bI] * towerH;
    const y1 = ground + bands[bI + 1] * towerH;
    const s0 = pos.length / 3;
    for (let k = 0; k <= SIDES; k += 1) {
      const a = (k / SIDES) * Math.PI * 2;
      const rr0 = r0 * (1 - 0.25 * bands[bI]);
      const rr1 = r0 * (1 - 0.25 * bands[bI + 1]);
      vert(lx + Math.cos(a) * rr0, y0, lz + Math.sin(a) * rr0, c);
      vert(lx + Math.cos(a) * rr1, y1, lz + Math.sin(a) * rr1, c);
    }
    for (let k = 0; k < SIDES; k += 1) {
      const a = s0 + k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export default function Coast({ ship = "lusitania" }: { ship?: ShipId }) {
  const coast = useMemo(() => {
    const geo = buildCoastGeometry(ship);
    const mat = new MeshLambertMaterial({ vertexColors: true });
    if (ship === "britannic") {
      // Kea stands between her and the low morning sun: a little of the
      // hills' own colour as light, so the shaded side reads brown-green
      // in the haze rather than grey.
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * 0.3;"
        );
      };
      mat.customProgramCacheKey = () => "shipwreck-coast-kea";
    }
    const m = new Mesh(geo, mat);
    m.name = "coast";
    return { m, geo, mat };
  }, [ship]);
  useEffect(
    () => () => {
      coast.geo.dispose();
      coast.mat.dispose();
    },
    [coast]
  );
  return <primitive object={coast.m} />;
}

// ---------------------------------------------------------------------------
// The Kea Channel, 21 November 1916 (the Britannic). Real outlines
// (OpenStreetMap, simplified to about 300 m): Kea, its hills rising to
// Profitis Ilias (568 m), its north-west shore with the bay of Port St
// Nikolo (Agios Nikolaos) and its light; Makronisos, long and low (to
// about 280 m), and the Attica coast from Cape Sounion north past
// Lavrio (from the chart, about 300 m), both to port and fading into the
// haze. Heights true (`KEA_HEIGHT_SCALE`, 1: at ×1.5 it read better at
// distance, but at true height Kea still stands clear on the horizon in
// her turn and boats shots). No temple, no people. One draw.

/** Kea's outline (lat, lon), round the island. */
const KEA: readonly [number, number][] = [
  [37.5935, 24.2716],
  [37.5812, 24.2652],
  [37.5772, 24.281],
  [37.5638, 24.2799],
  [37.5564, 24.2734],
  [37.5518, 24.2725],
  [37.5393, 24.2762],
  [37.5281, 24.2714],
  [37.5218, 24.2759],
  [37.5237, 24.2937],
  [37.5288, 24.3022],
  [37.5321, 24.3076],
  [37.5434, 24.3137],
  [37.545, 24.3212],
  [37.5553, 24.3251],
  [37.5593, 24.3293],
  [37.5582, 24.3348],
  [37.5733, 24.3562],
  [37.5935, 24.3706],
  [37.6058, 24.3867],
  [37.617, 24.3946],
  [37.6261, 24.3946],
  [37.6366, 24.3989],
  [37.6454, 24.4],
  [37.6548, 24.4103],
  [37.6606, 24.4061],
  [37.6647, 24.4029],
  [37.6749, 24.392],
  [37.6821, 24.3728],
  [37.6841, 24.3578],
  [37.6878, 24.3511],
  [37.6808, 24.3409],
  [37.6831, 24.3327],
  [37.6823, 24.3274],
  [37.6777, 24.3229],
  [37.6741, 24.3199],
  [37.6674, 24.313],

  [37.6582, 24.316],
  [37.6636, 24.3051],
  [37.6589, 24.2944],
  [37.642, 24.286],
  [37.6327, 24.2802],
  [37.6272, 24.2769],
  [37.622, 24.2741],
  [37.6172, 24.2719],
  [37.6077, 24.267],
  [37.6031, 24.2689],
  [37.5969, 24.2685],
];
/** Profitis Ilias, Kea's summit (568 m), and the island's middle. */
const KEA_PEAK = { lat: 37.62, lon: 24.335, m: 568 };

/** Makronisos's outline (lat, lon). */
const MAKRONISOS: readonly [number, number][] = [
  [37.6563, 24.1029],
  [37.6454, 24.1067],
  [37.6577, 24.114],
  [37.671, 24.1216],
  [37.6819, 24.1289],
  [37.6969, 24.1345],
  [37.7131, 24.1361],
  [37.7208, 24.1514],
  [37.7308, 24.1538],
  [37.7408, 24.1545],
  [37.7572, 24.1432],
  [37.7403, 24.1272],
  [37.7144, 24.1213],
  [37.698, 24.115],
  [37.6799, 24.1047],
  [37.6671, 24.1035],
  [37.6599, 24.1012],
];
const MAKRONISOS_TOP = { lat: 37.705, lon: 24.127, m: 280 };

/** Attica from west of Cape Sounion north to Porto Rafti: [lat, lon, cliff, hills]. */
const ATTICA: readonly [number, number, number, number][] = [
  [37.675, 23.96, 20, 220],
  [37.66, 23.995, 40, 260],
  [37.6501, 24.0263, 60, 200], // Cape Sounion
  [37.6585, 24.042, 30, 240],
  [37.672, 24.0475, 20, 300],
  [37.688, 24.056, 25, 330],
  [37.71, 24.06, 10, 350], // Lavrio
  [37.73, 24.068, 20, 330],
  [37.75, 24.065, 15, 300], // Thorikos
  [37.775, 24.07, 30, 280],
  [37.805, 24.06, 30, 300],
  [37.84, 24.05, 20, 280],
  [37.88, 24.045, 20, 260], // Porto Rafti
];
/** Port St Nikolo light (Agios Nikolaos, MarineTraffic's light list). */
const ST_NIKOLO_LIGHT = [37.6673, 24.3139] as const;

/** Kea's, Makronisos's and Attica's heights are drawn this many times true (1). */
export const KEA_HEIGHT_SCALE = 1;
// Brown-green: maquis and phrygana on brown rock, terraces (lighter than
// the Cork farmland: the morning sun is behind them from her deck).
const MAQUIS = new Color(0x6f7a3e);
const MAQUIS_DARK = new Color(0x55602f);
const SCRUB = new Color(0x9c8458);
const KEA_ROCK = new Color(0xb09a74);
const KEA_SHORE = new Color(0x8a7a62);
const WHITE = new Color(0xeeeae0);

function buildKeaGeometry(): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const o = BRITANNIC_MINE;
  const vert = (x: number, y: number, z: number, c: Color) => {
    pos.push(x, sinkWithDistance(x, y * KEA_HEIGHT_SCALE, z), z);
    col.push(c.r, c.g, c.b);
    return pos.length / 3 - 1;
  };

  // An island: rings from its shore in toward its summit, the ground
  // rising steeply from rocky shores to scrubby hills (a hash for ridges).
  const island = (
    outline: readonly [number, number][],
    top: { lat: number; lon: number; m: number },
    seed: number
  ) => {
    const pk = coastToScene(top.lat, top.lon, o);
    const ring = outline.map(([la, lo]) => coastToScene(la, lo, o));
    // [share of the way to the summit, share of its height, colour]
    const rows: [number, number, Color][] = [
      [-0.04, -14, KEA_SHORE],
      [0, 0.004, KEA_SHORE],
      [0.035, 0.09, KEA_ROCK],
      [0.1, 0.22, SCRUB],
      [0.25, 0.42, MAQUIS],
      [0.45, 0.62, SCRUB],
      [0.68, 0.82, MAQUIS_DARK],
      [0.88, 0.94, SCRUB],
      [1, 1, KEA_ROCK],
    ];
    const start = pos.length / 3;
    const n = ring.length;
    for (let i = 0; i < n; i += 1) {
      const [x, z] = ring[i];
      for (let r = 0; r < rows.length; r += 1) {
        const [f, hShare, c] = rows[r];
        const wob = r > 1 && r < rows.length - 1 ? hash(i, r + seed) : 0.5;
        const h =
          hShare < 0
            ? hShare
            : Math.min(top.m, top.m * hShare * (r > 1 ? 0.55 + 0.8 * wob : 1));
        const shade = new Color().copy(c).multiplyScalar(0.85 + 0.3 * wob);
        vert(x + (pk[0] - x) * f, h, z + (pk[1] - z) * f, shade);
      }
    }
    const w = rows.length;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      for (let r = 0; r < w - 1; r += 1) {
        const a = start + i * w + r;
        const b = start + j * w + r;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  };
  island(KEA, KEA_PEAK, 3);
  island(MAKRONISOS, MAKRONISOS_TOP, 11);

  // Attica: a strip of land behind its shore (inland is west, about -z).
  const line = ATTICA.map(([la, lo, cliff, hill]) => {
    const [x, z] = coastToScene(la, lo, o);
    return { x, z, cliff, hill };
  });
  const rows = [
    { d: -60, h: () => -10, c: KEA_SHORE },
    { d: 0, h: (p: (typeof line)[0]) => p.cliff * 0.15, c: KEA_ROCK },
    { d: 80, h: (p: (typeof line)[0]) => p.cliff, c: KEA_ROCK },
    { d: 900, h: (p: (typeof line)[0]) => p.hill * 0.55, c: SCRUB },
    { d: 3000, h: (p: (typeof line)[0]) => p.hill, c: MAQUIS },
    { d: 7000, h: (p: (typeof line)[0]) => p.hill * 0.8, c: SCRUB },
  ];
  const aStart = pos.length / 3;
  line.forEach((p, i) => {
    const prev = line[Math.max(0, i - 1)];
    const next = line[Math.min(line.length - 1, i + 1)];
    let nx = next.z - prev.z;
    let nz = -(next.x - prev.x);
    const len = Math.hypot(nx, nz) || 1;
    nx /= len;
    nz /= len;
    if (nz > 0) {
      nx = -nx;
      nz = -nz;
    }
    for (const r of rows) {
      const wob = r.d > 100 ? (hash(i, r.d) - 0.5) * r.d * 0.2 : 0;
      vert(p.x + nx * (r.d + wob), r.h(p), p.z + nz * (r.d + wob), r.c);
    }
  });
  for (let i = 0; i < line.length - 1; i += 1)
    for (let r = 0; r < rows.length - 1; r += 1) {
      const a = aStart + i * rows.length + r;
      const b = aStart + (i + 1) * rows.length + r;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }

  // Port St Nikolo light: a small white tower on the point.
  const [lx, lz] = coastToScene(ST_NIKOLO_LIGHT[0], ST_NIKOLO_LIGHT[1], o);
  const SIDES = 8;
  const s0 = pos.length / 3;
  for (let k = 0; k <= SIDES; k += 1) {
    const a = (k / SIDES) * Math.PI * 2;
    vert(
      lx + Math.cos(a) * 4,
      4 / KEA_HEIGHT_SCALE,
      lz + Math.sin(a) * 4,
      WHITE
    );
    vert(
      lx + Math.cos(a) * 3,
      24 / KEA_HEIGHT_SCALE,
      lz + Math.sin(a) * 3,
      WHITE
    );
  }
  for (let k = 0; k < SIDES; k += 1) {
    const a = s0 + k * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
