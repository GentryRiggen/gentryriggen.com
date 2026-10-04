import { BufferGeometry, Float32BufferAttribute } from "three";
import { endOutline, type EndSection } from "./hullShapes";

export interface EndGeometryOptions {
  /** The slice shape at a world height. */
  sectionAt: (y: number) => EndSection;
  halfBeam: number;
  bottom: number;
  top: number;
  /** World x of the hull end the solid grows from. */
  originX: number;
  /** A stern grows toward -x and is wound the other way round. */
  isStern: boolean;
  hasBottomCap: boolean;
  hasTopCap: boolean;
}

const ROW_HEIGHT = 0.3;

/**
 * Lofts a hull end between `bottom` and `top`. Slices are evaluated at the
 * exact band edges, so two bands sharing an edge meet with no gap or step.
 */
export function buildEndGeometry(options: EndGeometryOptions): BufferGeometry {
  const { sectionAt, halfBeam, bottom, top, originX, isStern } = options;
  const direction = isStern ? -1 : 1;
  const rowCount = Math.max(1, Math.ceil((top - bottom) / ROW_HEIGHT));
  const positions: number[] = [];
  const indices: number[] = [];

  const rings: number[][][] = [];
  for (let row = 0; row <= rowCount; row++) {
    const y = bottom + ((top - bottom) * row) / rowCount;
    rings.push(
      endOutline(sectionAt(y), halfBeam).map(([x, z]) => [
        originX + direction * x,
        y,
        z,
      ])
    );
  }
  const ringSize = rings[0].length;

  for (const ring of rings) for (const point of ring) positions.push(...point);

  // Winding is outward for a bow; mirroring in x reverses it for a stern.
  const push = (a: number, b: number, c: number) =>
    isStern ? indices.push(a, c, b) : indices.push(a, b, c);

  for (let row = 0; row < rowCount; row++) {
    for (let k = 0; k < ringSize - 1; k++) {
      const a = row * ringSize + k;
      const b = a + 1;
      const c = a + ringSize;
      const d = c + 1;
      push(a, b, c);
      push(b, d, c);
    }
  }

  const addCap = (row: number, isUp: boolean) => {
    const centre = positions.length / 3;
    positions.push(originX, rings[row][0][1], 0);
    const first = positions.length / 3;
    for (const point of rings[row]) positions.push(...point);
    for (let k = 0; k < ringSize - 1; k++) {
      if (isUp) push(centre, first + k, first + k + 1);
      else push(centre, first + k + 1, first + k);
    }
  };
  if (options.hasBottomCap) addCap(0, false);
  if (options.hasTopCap) addCap(rowCount, true);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
