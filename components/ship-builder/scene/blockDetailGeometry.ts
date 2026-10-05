import {
  BoxGeometry,
  type BufferGeometry,
  ExtrudeGeometry,
  Shape,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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
  /** Each pane's frame (a ring with a wider sill) and a band's mullions. */
  frames: BufferGeometry;
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
  wingsHeight?: number
): WindowGeometries {
  const glass: BoxGeometry[] = [];
  const litGlass: BoxGeometry[] = [];
  const litHalo: BoxGeometry[] = [];
  const frames: BufferGeometry[] = [];
  let paneIndex = 0;
  const frameDepth = FRAME_PROUD + FRAME_BACK;
  const frameMid = (FRAME_PROUD - FRAME_BACK) / 2;
  for (const row of rows) {
    const length = row.face[0] === "x" ? size.z : size.x;
    // Keep every window out of the rounded vertical edges of the body.
    const paneWidth = row.width ?? length * 0.96 - EDGE_CLEARANCE * 2;
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
          0,
          row,
          length * 0.96 - DEFAULT_BEVEL * 2,
          row.height + 0.12,
          BAND_PROUD + FRAME_BACK,
          (BAND_PROUD - FRAME_BACK) / 2
        )
      );
    }
    for (const along of slotCentres(length, row)) {
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
        bar(-paneWidth / 2 + (paneWidth * i) / panes, 0.04, row.height, 0);
      }
    }
  }
  if (wingsHeight !== undefined)
    frames.push(buildBridgeWings(size, wingsHeight));
  return {
    glass: glass.length > 0 ? mergeGeometries(glass) : null,
    litGlass: litGlass.length > 0 ? mergeGeometries(litGlass) : null,
    litHalo: litHalo.length > 0 ? mergeGeometries(litHalo) : null,
    frames: mergeGeometries(frames),
  };
}

const trimCache = new Map<string, BufferGeometry>();

/**
 * A flat band that hugs the rounded body: the footprint outline pushed out by
 * TRIM_PROUD, with corner arcs concentric with the body's, so a stripe or a
 * deck line wraps the corners without poking out. Centred on the origin;
 * cached per size for the session (shared, never disposed).
 */
export function trimBand(size: BlockSize, height: number): BufferGeometry {
  const key = [size.x, size.z, height].join(":");
  const cached = trimCache.get(key);
  if (cached) return cached;
  const hx = size.x * FACE_INSET + TRIM_PROUD;
  const hz = size.z * FACE_INSET + TRIM_PROUD;
  const r = DEFAULT_BEVEL + TRIM_PROUD;
  const shape = new Shape();
  shape.moveTo(-hx + r, -hz);
  shape.lineTo(hx - r, -hz);
  shape.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(hx, hz - r);
  shape.absarc(hx - r, hz - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-hx + r, hz);
  shape.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hx, -hz + r);
  shape.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5, false);
  const geometry = new ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 4,
  });
  // The shape lies in XY and extrudes along +Z: stand it up so +Z is +Y.
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -height / 2, 0);
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
  height: number
): BufferGeometry {
  const parts: BoxGeometry[] = [];
  const reach = size.z * 0.5;
  const inner = size.z * FACE_INSET - 0.16;
  const deckLength = Math.min(size.x * 0.6, size.x - 0.3);
  const deckDepth = reach - inner;
  const deckY = height - 0.1;
  for (const sign of [-1, 1]) {
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
  return mergeGeometries(parts);
}
