import {
  Box3,
  Vector3,
  type BufferAttribute,
  type Mesh,
  type Object3D,
} from "three";

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

const ROUND = 10_000;
const round = (v: number) => Math.round(v * ROUND) / ROUND + 0; // + 0: never -0

/**
 * The bounding box of every visible mesh under `root`, from its vertices in
 * `root`'s world frame, then turned back by `rakeRadians` about Z so a part
 * the game tilts (a funnel's rake) is measured upright. Rounded to 4 places.
 * Null when there is no geometry.
 */
export function partBounds(root: Object3D, rakeRadians = 0): Bounds | null {
  root.updateMatrixWorld(true);
  const box = new Box3();
  const point = new Vector3();
  const cos = Math.cos(-rakeRadians);
  const sin = Math.sin(-rakeRadians);
  root.traverseVisible((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute("position") as
      BufferAttribute | undefined;
    if (!position) return;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      box.expandByPoint(
        point.set(
          point.x * cos - point.y * sin,
          point.x * sin + point.y * cos,
          point.z
        )
      );
    }
  });
  if (box.isEmpty()) return null;
  return {
    min: box.min.toArray().map(round) as Bounds["min"],
    max: box.max.toArray().map(round) as Bounds["max"],
  };
}
