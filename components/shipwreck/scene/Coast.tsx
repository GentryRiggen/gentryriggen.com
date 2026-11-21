"use client";

import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshLambertMaterial,
} from "three";
import { LUSITANIA_HIT } from "./settings";

/**
 * The south coast of County Cork on the northern horizon, as it lay from
 * where the torpedo struck (about 11 nautical miles south of the Old Head
 * of Kinsale): low green farmland over grey cliffs from Galley Head in the
 * west to Roche's Point in the east, the long narrow Old Head standing out
 * toward her, with its lighthouse (black with two white bands) at the tip.
 * Real places (latitude and longitude, below), heights shown 2.5× (at 20–45 km
 * a 70 m cliff is a few pixels; drawn true it would not read as land). One
 * mesh, one draw call; the haze (the scene's fog) does the distance.
 */

/** Heights are drawn this many times their real size. */
export const COAST_HEIGHT_SCALE = 2.5;

/** The coast, west to east: [lat, lon, cliff m, hills inland m]. */
const COASTLINE: readonly [number, number, number, number][] = [
  [51.54, -9.12, 40, 160], // toward Glandore
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
  [51.77, -8.29, 35, 140],
  [51.792, -8.255, 30, 120], // Roche's Point
  [51.795, -8.17, 40, 110], // Power Head
  [51.83, -8.0, 30, 120], // Ballycotton
];

/** The Old Head: from its neck to the tip with the lighthouse. */
const OLD_HEAD = {
  neck: [51.632, -8.541] as const,
  tip: [51.6036, -8.5322] as const,
  halfWidthM: 240,
  heightM: 72,
};

const LAT_M = 111200;

/** Earth (lat, lon) to the scene's axes at the hit (x her heading, z starboard). */
export function coastToScene(lat: number, lon: number): [number, number] {
  const north = (lat - LUSITANIA_HIT.latDeg) * LAT_M;
  const east =
    (lon - LUSITANIA_HIT.lonDeg) *
    LAT_M *
    Math.cos((LUSITANIA_HIT.latDeg * Math.PI) / 180);
  const h = (LUSITANIA_HIT.headingDeg * Math.PI) / 180;
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

export function buildCoastGeometry(): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const S = COAST_HEIGHT_SCALE;
  const vert = (x: number, y: number, z: number, c: Color) => {
    pos.push(x, y, z);
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
    { d: 9000, h: (p: (typeof line)[0]) => p.hill * 0.7, c: FIELD_DARK },
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

export default function Coast() {
  const coast = useMemo(() => {
    const geo = buildCoastGeometry();
    const mat = new MeshLambertMaterial({ vertexColors: true });
    const m = new Mesh(geo, mat);
    m.name = "coast";
    return { m, geo, mat };
  }, []);
  useEffect(
    () => () => {
      coast.geo.dispose();
      coast.mat.dispose();
    },
    [coast]
  );
  return <primitive object={coast.m} />;
}
