import { BoxGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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
}

/** Faces sit at 0.96 of the footprint, the same inset the body box uses. */
const FACE_INSET = 0.48;
const FRAME_MARGIN = 0.03;

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

/** A thin box set into a face: `depth` is the part that stands proud. */
function faceBox(
  face: Face,
  size: BlockSize,
  along: number,
  row: WindowRow,
  width: number,
  height: number,
  depth: number,
  offset: number
): BoxGeometry {
  const isXFace = face[0] === "x";
  const sign = face[1] === "+" ? 1 : -1;
  const distance = sign * ((isXFace ? size.x : size.z) * FACE_INSET + offset);
  return isXFace
    ? box(depth, height, width, distance, row.y, along)
    : box(width, height, depth, along, row.y, distance);
}

export interface WindowGeometries {
  /** Panes that stay dark at night. Null when every pane is lit. */
  glass: BufferGeometry | null;
  /** Panes that light up at night. Null when none are. */
  litGlass: BufferGeometry | null;
  frames: BufferGeometry;
}

/**
 * Dark glass panes plus the light frames behind them, as one merged geometry
 * each, so a block's windows cost a few draw calls however many there are.
 * `isLit` picks, by pane number, which panes go to the lit group (a fixed
 * pattern, so a block looks the same every render); omitted, none are lit.
 */
export function buildWindowGeometries(
  size: BlockSize,
  rows: WindowRow[],
  isLit: (paneIndex: number) => boolean = () => false
): WindowGeometries {
  const glass: BoxGeometry[] = [];
  const litGlass: BoxGeometry[] = [];
  const frames: BoxGeometry[] = [];
  for (const row of rows) {
    const length = row.face[0] === "x" ? size.z : size.x;
    const paneWidth = row.width ?? length * 0.9;
    for (const along of slotCentres(length, row)) {
      frames.push(
        faceBox(
          row.face,
          size,
          along,
          row,
          paneWidth + FRAME_MARGIN * 2,
          row.height + FRAME_MARGIN * 2,
          0.03,
          0
        )
      );
      const pane = faceBox(
        row.face,
        size,
        along,
        row,
        paneWidth,
        row.height,
        0.04,
        0.005
      );
      (isLit(glass.length + litGlass.length) ? litGlass : glass).push(pane);
    }
    if (row.width === undefined) {
      // Light mullions break the continuous band into panes.
      const panes = Math.max(2, Math.round(length));
      for (let i = 1; i < panes; i++) {
        const along = -paneWidth / 2 + (paneWidth * i) / panes;
        frames.push(
          faceBox(row.face, size, along, row, 0.04, row.height, 0.05, 0.003)
        );
      }
    }
  }
  return {
    glass: glass.length > 0 ? mergeGeometries(glass) : null,
    litGlass: litGlass.length > 0 ? mergeGeometries(litGlass) : null,
    frames: mergeGeometries(frames),
  };
}

export const CABIN_WINDOW_ROWS: WindowRow[] = (
  ["x+", "x-", "z+", "z-"] as const
).map((face) => ({ face, y: 0.62, height: 0.22, width: 0.2, perCell: 2 }));

export const BRIDGE_WINDOW_ROWS: WindowRow[] = [
  { face: "x+", y: 0.5, height: 0.26 },
  { face: "z+", y: 0.5, height: 0.22, width: 0.22, perCell: 2 },
  { face: "z-", y: 0.5, height: 0.22, width: 0.22, perCell: 2 },
  { face: "x-", y: 0.5, height: 0.22, width: 0.22, perCell: 2 },
];
