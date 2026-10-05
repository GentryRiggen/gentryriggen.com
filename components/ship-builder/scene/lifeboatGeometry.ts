import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Stations along the length, and steps around each half-section. */
const STATIONS = 14;
const SECTION_STEPS = 6;
const COVER_STATIONS = 10;
/** Where along the length (stern 0, bow 1) the boat is widest. */
const BEAM_AT = 0.55;
/** How far the rim rises at the ends, as a fraction of the depth. */
const SHEER = 0.16;
/** The keel's depth at the stern and bow tips, as a fraction of the depth. */
const STERN_KEEL = 0.55;
const BOW_KEEL = 0.3;
/** The cover spans this share of the length. */
const COVER_START = 0.12;
const COVER_END = 0.84;
const COVER_BEAM = 0.82;

export interface LifeboatDims {
  /** Overall length along X; the bow is at +X. */
  length: number;
  /** Beam at the widest point. */
  width: number;
  /** Depth of the keel below the rim amidships. */
  depth: number;
  /** Height of the cover's ridge above the rim. */
  coverHeight: number;
}

export interface LifeboatGeometry {
  /** The hull below the rim, closed by a flat deck at the rim. */
  hull: BufferGeometry;
  /** The canvas cover over the middle. */
  cover: BufferGeometry;
  /** Gunwale band around the rim plus the cover's ridge line. */
  trim: BufferGeometry;
}

interface Station {
  x: number;
  /** Rim height at this station. */
  rim: number;
  /** Half-beam at the rim. */
  half: number;
  /** How far the section's lowest point sits below the rim. */
  drop: number;
}

/** Half-beam at a position along the length (0 stern, 1 bow). */
export function halfBeamAt(t: number, width: number): number {
  const half = width / 2;
  if (t <= BEAM_AT) {
    const u = (BEAM_AT - t) / BEAM_AT;
    return half * Math.sqrt(Math.max(0, 1 - u * u));
  }
  const v = (t - BEAM_AT) / (1 - BEAM_AT);
  return half * (1 - Math.pow(v, 1.7));
}

/** Rim height at a position along the length: it rises toward both ends. */
function rimAt(t: number, depth: number): number {
  const s = 2 * t - 1;
  return depth * SHEER * s * s;
}

/** Keel depth below the rim: full amidships, shoaling toward both tips. */
function keelAt(t: number, depth: number): number {
  const isAft = t < BEAM_AT;
  const reach = isAft ? (BEAM_AT - t) / BEAM_AT : (t - BEAM_AT) / (1 - BEAM_AT);
  const end = isAft ? STERN_KEEL : BOW_KEEL;
  return depth * (1 - (1 - end) * reach * reach);
}

/**
 * Rows of stations, each a half-section from the port rim round the bottom to
 * the starboard rim. Triangles face up where the section bulges up.
 */
function loftSections(stations: Station[]): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const columns = SECTION_STEPS + 1;
  for (const { x, rim, half, drop } of stations) {
    for (let j = 0; j <= SECTION_STEPS; j++) {
      const angle = (j / SECTION_STEPS) * Math.PI;
      positions.push(x, rim - drop * Math.sin(angle), half * Math.cos(angle));
    }
  }
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < SECTION_STEPS; j++) {
      const a = i * columns + j;
      const b = (i + 1) * columns + j;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** Flips triangle winding in place, so a bowl's faces point outward. */
function flip(geometry: BufferGeometry): BufferGeometry {
  const index = geometry.getIndex();
  if (!index) return geometry;
  for (let i = 0; i < index.count; i += 3) {
    const second = index.getX(i + 1);
    index.setX(i + 1, index.getX(i + 2));
    index.setX(i + 2, second);
  }
  return geometry;
}

/** Zeroed UVs, so loft pieces merge with the stock three geometries. */
function withUv(geometry: BufferGeometry): BufferGeometry {
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute(
    "uv",
    new Float32BufferAttribute(new Array<number>(count * 2).fill(0), 2)
  );
  return geometry;
}

function buildHull({ length, width, depth }: LifeboatDims): BufferGeometry {
  const stations = Array.from({ length: STATIONS + 1 }, (_, i): Station => {
    const t = i / STATIONS;
    const rim = rimAt(t, depth);
    return {
      x: (t - 0.5) * length,
      rim,
      half: halfBeamAt(t, width),
      drop: keelAt(t, depth) + rim,
    };
  });
  const shell = flip(loftSections(stations));
  shell.computeVertexNormals();

  // A flat deck closes the rim, so the boat is solid seen from above.
  const deckPositions: number[] = [];
  const deckIndices: number[] = [];
  for (const { x, rim, half } of stations) {
    deckPositions.push(x, rim, half, x, rim, -half);
  }
  for (let i = 0; i < STATIONS; i++) {
    const a = i * 2;
    const b = (i + 1) * 2;
    deckIndices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const deck = new BufferGeometry();
  deck.setAttribute("position", new Float32BufferAttribute(deckPositions, 3));
  deck.setIndex(deckIndices);
  deck.computeVertexNormals();

  const merged = mergeGeometries([withUv(shell), withUv(deck)]);
  shell.dispose();
  deck.dispose();
  return merged;
}

function coverStations({
  length,
  width,
  depth,
  coverHeight,
}: LifeboatDims): Station[] {
  const middle = (COVER_START + COVER_END) / 2;
  return Array.from({ length: COVER_STATIONS + 1 }, (_, i): Station => {
    const t = COVER_START + ((COVER_END - COVER_START) * i) / COVER_STATIONS;
    const across = (t - middle) / ((COVER_END - COVER_START) / 2);
    return {
      x: (t - 0.5) * length,
      rim: rimAt(t, depth),
      half: halfBeamAt(t, width) * COVER_BEAM,
      // Negative drop rises above the rim; it pinches shut at both ends.
      drop: -coverHeight * Math.sqrt(Math.max(0, 1 - across * across)),
    };
  });
}

function buildCover(dims: LifeboatDims): BufferGeometry {
  const cover = loftSections(coverStations(dims));
  cover.computeVertexNormals();
  return withUv(cover);
}

function buildTrim(dims: LifeboatDims): BufferGeometry {
  const { length, width, depth } = dims;
  const tube = Math.max(0.014, width * 0.05);
  const rimPoint = (t: number, side: 1 | -1) =>
    new Vector3(
      (t - 0.5) * length,
      rimAt(t, depth),
      side * halfBeamAt(t, width)
    );
  // Port side stern to bow, then back along the starboard side.
  const loop: Vector3[] = [];
  for (let i = 0; i <= STATIONS; i++) loop.push(rimPoint(i / STATIONS, 1));
  for (let i = STATIONS - 1; i >= 1; i--) {
    loop.push(rimPoint(i / STATIONS, -1));
  }
  const gunwale = new TubeGeometry(
    new CatmullRomCurve3(loop, true),
    STATIONS * 4,
    tube,
    5,
    true
  );

  const ridge = coverStations(dims).map(
    ({ x, rim, drop }) => new Vector3(x, rim - drop + 0.004, 0)
  );
  const ridgeTube = new TubeGeometry(
    new CatmullRomCurve3(ridge),
    ridge.length * 2,
    tube * 0.5,
    4,
    false
  );
  const merged = mergeGeometries([gunwale, ridgeTube]);
  gunwale.dispose();
  ridgeTube.dispose();
  return merged;
}

/** Lofts a boat profile into hull, cover and trim geometry. */
export function buildLifeboatGeometry(dims: LifeboatDims): LifeboatGeometry {
  return {
    hull: buildHull(dims),
    cover: buildCover(dims),
    trim: buildTrim(dims),
  };
}

const cache = new Map<string, LifeboatGeometry>();

/**
 * Shared per lifeboat size for the whole session, so never disposed: a row of
 * identical boats reuses one set of geometry.
 */
export function getLifeboatGeometry(dims: LifeboatDims): LifeboatGeometry {
  const key = [dims.length, dims.width, dims.depth, dims.coverHeight].join(":");
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = buildLifeboatGeometry(dims);
    cache.set(key, geometry);
  }
  return geometry;
}
