import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  NO_JOINED_SIDES,
  sidesKey,
  type BlockSides,
} from "@/lib/ship-builder/model/blockSides";
import { DEFAULT_BEVEL } from "./roundedBox";

export interface BlockSize {
  x: number;
  z: number;
}

type Face = "x+" | "x-" | "z+" | "z-";

interface WindowRow {
  face: Face;
  /** Window centre height above the block's base. */
  y: number;
  height: number;
  /** One window of this width per slot; omit for a single continuous band. */
  width?: number;
  /** Windows per cell along the face (ignored for a continuous band). */
  perCell?: number;
  /** Lay a dark band behind the panes (a bridge's wheelhouse windows). */
  band?: boolean;
}

/** Faces sit at 0.96 of the footprint, the same inset the body box uses. */
const FACE_INSET = 0.48;

/**
 * The block side a local face is on: world +x is the bow and +z the starboard
 * side (see modelToWorld).
 */
const FACE_SIDE: Record<Face, keyof BlockSides> = {
  "x+": "bow",
  "x-": "stern",
  "z+": "starboard",
  "z-": "port",
};

/**
 * The sides at the two ends of a face, along its width: the low end
 * (smaller local x or z) and the high end.
 */
const FACE_ENDS: Record<Face, [keyof BlockSides, keyof BlockSides]> = {
  "x+": ["port", "starboard"],
  "x-": ["port", "starboard"],
  "z+": ["stern", "bow"],
  "z-": ["stern", "bow"],
};
const FRAME_MARGIN = 0.03;
/** Frames stand this far off the body face, and reach this far into it. */
const FRAME_PROUD = 0.02;
const FRAME_BACK = 0.01;
/** The glass sits recessed behind the frame; a bridge's band behind that. */
const GLASS_PROUD = 0.008;
const BAND_PROUD = 0.004;
const SILL_OVERHANG = 0.02;
const SILL_EXTRA = 0.015;
/** Keeps a window clear of the body's rounded vertical edges. */
const EDGE_CLEARANCE = DEFAULT_BEVEL + FRAME_MARGIN + SILL_OVERHANG + 0.03;
/** How far a lit pane's bloom reaches past its edge. */
const HALO_MARGIN = 0.07;
/** Trim stands just proud of the body so it never z-fights. */
const TRIM_PROUD = 0.0075;

function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number
): BoxGeometry {
  const geometry = new BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return geometry;
}

/** Offsets (along the face, from its centre) of each window's centre. */
function slotCentres(length: number, row: WindowRow): number[] {
  if (row.width === undefined) return [0];
  const perCell = row.perCell ?? 2;
  const cells = Math.max(1, Math.round(length));
  const centres: number[] = [];
  for (let cell = 0; cell < cells; cell++) {
    for (let k = 0; k < perCell; k++) {
      centres.push(-length / 2 + cell + (k + 0.5) / perCell);
    }
  }
  return centres;
}

/** A thin box on a face: `offset` is where its middle sits off the face. */
function faceBox(
  face: Face,
  size: BlockSize,
  along: number,
  row: WindowRow,
  width: number,
  height: number,
  depth: number,
  offset: number,
  dy = 0
): BoxGeometry {
  const isXFace = face[0] === "x";
  const sign = face[1] === "+" ? 1 : -1;
  const distance = sign * ((isXFace ? size.x : size.z) * FACE_INSET + offset);
  return isXFace
    ? box(depth, height, width, distance, row.y + dy, along)
    : box(width, height, depth, along, row.y + dy, distance);
}

export interface WindowGeometries {
  /** Panes that stay dark at night, and a bridge's dark band. */
  glass: BufferGeometry | null;
  /** Panes that light up at night. Null when none are. */
  litGlass: BufferGeometry | null;
  /** Slightly larger flat panels over the lit panes: their night-time bloom. */
  litHalo: BufferGeometry | null;
  /** Each pane's frame (a ring with a wider sill) and a band's mullions. Null when no face has windows. */
  frames: BufferGeometry | null;
}

/**
 * Dark glass panes recessed behind their frames, as one merged geometry
 * each, so a block's windows cost a few draw calls however many there are.
 * Frames stand FRAME_PROUD off the face, glass only GLASS_PROUD, and the sill
 * is a little wider than the ring. `isLit` picks, by pane number, which panes
 * go to the lit group (a fixed pattern, so a block looks the same every
 * render); omitted, none are lit.
 */
export function buildWindowGeometries(
  size: BlockSize,
  rows: WindowRow[],
  isLit: (paneIndex: number) => boolean = () => false,
  /** A bridge's height: its roof wings are merged into the frames. */
  wingsHeight?: number,
  /** Sides joined to a neighbour: nothing is built on those faces. */
  joined: BlockSides = NO_JOINED_SIDES
): WindowGeometries {
  const glass: BoxGeometry[] = [];
  const litGlass: BoxGeometry[] = [];
  const litHalo: BoxGeometry[] = [];
  const frames: BufferGeometry[] = [];
  let paneIndex = 0;
  const frameDepth = FRAME_PROUD + FRAME_BACK;
  const frameMid = (FRAME_PROUD - FRAME_BACK) / 2;
  for (const row of rows) {
    if (joined[FACE_SIDE[row.face]]) continue;
    const length = row.face[0] === "x" ? size.z : size.x;
    // A band reaches the cell edge where its face meets a joined side, and
    // keeps clear of the rounded vertical edge where it does not.
    const [lowEnd, highEnd] = FACE_ENDS[row.face];
    const low = joined[lowEnd] ? length / 2 : length * 0.48 - DEFAULT_BEVEL;
    const high = joined[highEnd] ? length / 2 : length * 0.48 - DEFAULT_BEVEL;
    const bandCentre = (high - low) / 2;
    const bandWidth = low + high;
    // Keep every window out of the rounded vertical edges of the body.
    const paneWidth =
      row.width ??
      bandWidth -
        2 * FRAME_MARGIN -
        (joined[lowEnd] ? 0 : EDGE_CLEARANCE - DEFAULT_BEVEL - FRAME_MARGIN) -
        (joined[highEnd] ? 0 : EDGE_CLEARANCE - DEFAULT_BEVEL - FRAME_MARGIN);
    // Windows stay centred on the face; a continuous band follows its ends.
    const shift = row.width === undefined ? bandCentre : 0;
    const frameWidth = paneWidth + FRAME_MARGIN * 2;
    const bar = (
      along: number,
      width: number,
      height: number,
      dy: number
    ): void => {
      frames.push(
        faceBox(
          row.face,
          size,
          along,
          row,
          width,
          height,
          frameDepth,
          frameMid,
          dy
        )
      );
    };
    if (row.band) {
      glass.push(
        faceBox(
          row.face,
          size,
          bandCentre,
          row,
          bandWidth,
          row.height + 0.12,
          BAND_PROUD + FRAME_BACK,
          (BAND_PROUD - FRAME_BACK) / 2
        )
      );
    }
    for (const slot of slotCentres(length, row)) {
      const along = slot + shift;
      bar(along, frameWidth, FRAME_MARGIN, row.height / 2 + FRAME_MARGIN / 2);
      const sideOffset = paneWidth / 2 + FRAME_MARGIN / 2;
      bar(along - sideOffset, FRAME_MARGIN, row.height, 0);
      bar(along + sideOffset, FRAME_MARGIN, row.height, 0);
      // The sill: wider and a touch thicker than the head, under the pane.
      frames.push(
        faceBox(
          row.face,
          size,
          along,
          row,
          frameWidth + SILL_OVERHANG * 2,
          FRAME_MARGIN + SILL_EXTRA,
          frameDepth,
          frameMid,
          -(row.height / 2 + FRAME_MARGIN / 2 + SILL_EXTRA / 2)
        )
      );
      const pane = faceBox(
        row.face,
        size,
        along,
        row,
        paneWidth,
        row.height,
        GLASS_PROUD + FRAME_BACK,
        (GLASS_PROUD - FRAME_BACK) / 2
      );
      if (isLit(paneIndex++)) {
        litGlass.push(pane);
        litHalo.push(
          faceBox(
            row.face,
            size,
            along,
            row,
            paneWidth + HALO_MARGIN * 2,
            row.height + HALO_MARGIN * 2,
            0.01,
            FRAME_PROUD + 0.005
          )
        );
      } else {
        glass.push(pane);
      }
    }
    if (row.width === undefined) {
      // Light mullions break the continuous band into panes.
      const panes = Math.max(2, Math.round(length));
      for (let i = 1; i < panes; i++) {
        bar(
          shift - paneWidth / 2 + (paneWidth * i) / panes,
          0.04,
          row.height,
          0
        );
      }
    }
  }
  if (wingsHeight !== undefined) {
    const wings = buildBridgeWings(size, wingsHeight, joined);
    if (wings) frames.push(wings);
  }
  return {
    glass: glass.length > 0 ? mergeGeometries(glass) : null,
    litGlass: litGlass.length > 0 ? mergeGeometries(litGlass) : null,
    litHalo: litHalo.length > 0 ? mergeGeometries(litHalo) : null,
    frames: frames.length > 0 ? mergeGeometries(frames) : null,
  };
}

const trimCache = new Map<string, BufferGeometry>();
const CORNER_SEGMENTS = 4;

interface RibbonPoint {
  x: number;
  z: number;
  /** Outward unit normal in the XZ plane. */
  nx: number;
  nz: number;
}

/** The sign (+1 or -1) of a block side along its axis, and that axis. */
const TRIM_SIDES = [
  { side: "bow", axis: "x", sign: 1 },
  { side: "starboard", axis: "z", sign: 1 },
  { side: "stern", axis: "x", sign: -1 },
  { side: "port", axis: "z", sign: -1 },
] as const;

/**
 * A flat band on the exposed vertical faces of the body: the footprint
 * outline pushed out by TRIM_PROUD, as an open ribbon with no caps. Each
 * exposed side is a straight run that ends at the cell edge where the next
 * side is joined (so a neighbour's band carries on flush) and at the start of
 * a corner arc, concentric with the body's, where it is not. Joined sides get
 * no band. Centred on the origin; cached per size, height and mask (shared,
 * never disposed).
 */
export function trimBand(
  size: BlockSize,
  height: number,
  joined: BlockSides = NO_JOINED_SIDES
): BufferGeometry {
  const key = [size.x, size.z, height, sidesKey(joined)].join(":");
  const cached = trimCache.get(key);
  if (cached) return cached;

  const half = (axis: "x" | "z", sign: 1 | -1): number => {
    const side = TRIM_SIDES.find((s) => s.axis === axis && s.sign === sign)!;
    return (axis === "x" ? size.x : size.z) * (joined[side.side] ? 0.5 : 0.48);
  };
  const runs: RibbonPoint[][] = [];

  for (const { side, axis, sign } of TRIM_SIDES) {
    if (joined[side]) continue;
    // Along the side, each end is the cell edge if the adjacent side is
    // joined, else it stops a bevel short of the corner.
    const alongAxis = axis === "x" ? "z" : "x";
    const ends = ([-1, 1] as const).map((end) => {
      const neighbour = TRIM_SIDES.find(
        (s) => s.axis === alongAxis && s.sign === end
      )!;
      return joined[neighbour.side]
        ? end * (alongAxis === "x" ? size.x : size.z) * 0.5
        : end * (half(alongAxis, end) - DEFAULT_BEVEL);
    });
    const face = sign * (half(axis, sign) + TRIM_PROUD);
    const normal = { nx: axis === "x" ? sign : 0, nz: axis === "z" ? sign : 0 };
    runs.push(
      ends.map((along) => ({
        x: axis === "x" ? face : along,
        z: axis === "x" ? along : face,
        ...normal,
      }))
    );
  }

  // Corner arcs, only where both sides meeting at the corner are exposed.
  const radius = DEFAULT_BEVEL + TRIM_PROUD;
  for (const sx of [1, -1] as const) {
    for (const sz of [1, -1] as const) {
      const xSide = TRIM_SIDES.find((s) => s.axis === "x" && s.sign === sx)!;
      const zSide = TRIM_SIDES.find((s) => s.axis === "z" && s.sign === sz)!;
      if (joined[xSide.side] || joined[zSide.side]) continue;
      const cx = sx * (half("x", sx) - DEFAULT_BEVEL);
      const cz = sz * (half("z", sz) - DEFAULT_BEVEL);
      const start = sx > 0 ? 0 : Math.PI;
      const target = sz > 0 ? Math.PI / 2 : -Math.PI / 2;
      let sweep = target - start;
      if (sweep > Math.PI) sweep -= 2 * Math.PI;
      if (sweep < -Math.PI) sweep += 2 * Math.PI;
      const arc: RibbonPoint[] = [];
      for (let i = 0; i <= CORNER_SEGMENTS; i++) {
        const angle = start + (sweep * i) / CORNER_SEGMENTS;
        const nx = Math.cos(angle);
        const nz = Math.sin(angle);
        arc.push({ x: cx + nx * radius, z: cz + nz * radius, nx, nz });
      }
      runs.push(arc);
    }
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const top = height / 2;
  const bottom = -height / 2;
  for (const run of runs) {
    for (let i = 0; i + 1 < run.length; i++) {
      const a = run[i];
      const b = run[i + 1];
      // Wind each quad so it faces along the run's outward normal.
      const faceUp = -(b.z - a.z) * a.nx + (b.x - a.x) * a.nz > 0;
      const quad = faceUp
        ? [
            [a, bottom],
            [b, bottom],
            [b, top],
            [a, bottom],
            [b, top],
            [a, top],
          ]
        : [
            [a, bottom],
            [b, top],
            [b, bottom],
            [a, bottom],
            [a, top],
            [b, top],
          ];
      for (const [point, y] of quad as [RibbonPoint, number][]) {
        positions.push(point.x, y, point.z);
        normals.push(point.nx, 0, point.nz);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  trimCache.set(key, geometry);
  return geometry;
}

export const CABIN_WINDOW_ROWS: WindowRow[] = (
  ["x+", "x-", "z+", "z-"] as const
).map((face) => ({ face, y: 0.62, height: 0.22, width: 0.2, perCell: 2 }));

export const BRIDGE_WINDOW_ROWS: WindowRow[] = [
  { face: "x+", y: 0.5, height: 0.26, band: true },
  { face: "z+", y: 0.5, height: 0.22, width: 0.22, perCell: 2, band: true },
  { face: "z-", y: 0.5, height: 0.22, width: 0.22, perCell: 2, band: true },
  { face: "x-", y: 0.5, height: 0.22, width: 0.22, perCell: 2, band: true },
];

/**
 * Small wings at both ends of a bridge's roof, across the ship, reaching the
 * cell edge but no further: a thin wing deck with a low screen at its outer
 * edge. One merged geometry in the block's frame colour.
 */
export function buildBridgeWings(
  size: BlockSize,
  height: number,
  joined: BlockSides = NO_JOINED_SIDES
): BufferGeometry | null {
  const parts: BoxGeometry[] = [];
  const reach = size.z * 0.5;
  const inner = size.z * FACE_INSET - 0.16;
  const deckLength = Math.min(size.x * 0.6, size.x - 0.3);
  const deckDepth = reach - inner;
  const deckY = height - 0.1;
  for (const sign of [-1, 1] as const) {
    // +z is the starboard side, -z the port side.
    if (joined[sign > 0 ? "starboard" : "port"]) continue;
    parts.push(
      box(
        deckLength,
        0.03,
        deckDepth,
        0,
        deckY,
        sign * (inner + deckDepth / 2)
      ),
      box(deckLength, 0.07, 0.015, 0, deckY + 0.05, sign * (reach - 0.0075))
    );
  }
  return parts.length > 0 ? mergeGeometries(parts) : null;
}
