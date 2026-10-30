import {
  BufferAttribute,
  BufferGeometry,
  Matrix3,
  Matrix4,
  Vector3,
} from "three";

/** One piece of geometry to fold into a merged one, already in its final frame. */
export interface MergeSource {
  geometry: BufferGeometry;
  /** Takes the geometry's own coordinates to the merged geometry's frame. */
  matrix: Matrix4;
}

export interface MergeRange {
  /** First entry of the piece in the merged index buffer. */
  start: number;
  /** Number of index entries the piece owns. */
  count: number;
}

export interface MergedGeometry {
  geometry: BufferGeometry;
  /** One range per source, in source order. */
  ranges: MergeRange[];
}

const scratchPosition = new Vector3();
const scratchNormal = new Vector3();
const scratchNormalMatrix = new Matrix3();

/**
 * Folds geometries into one indexed geometry with position, normal and
 * (optionally) colour. Sources need positions and normals; a source with no
 * colour contributes white when `withColor` is set. A source whose matrix
 * mirrors it has its winding flipped, as three does when drawing it alone.
 * Each source keeps a contiguous index range, so a caller can blank a piece
 * out later by zeroing its range.
 */
export function mergeGeometries(
  sources: readonly MergeSource[],
  withColor: boolean
): MergedGeometry {
  let vertexTotal = 0;
  let indexTotal = 0;
  for (const { geometry } of sources) {
    const count = geometry.getAttribute("position").count;
    vertexTotal += count;
    indexTotal += geometry.index ? geometry.index.count : count;
  }
  const positions = new Float32Array(vertexTotal * 3);
  const normals = new Float32Array(vertexTotal * 3);
  const colors = withColor ? new Float32Array(vertexTotal * 3).fill(1) : null;
  const indices = new Uint32Array(indexTotal);
  const ranges: MergeRange[] = [];

  let vertexBase = 0;
  let indexBase = 0;
  for (const { geometry, matrix } of sources) {
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const color = colors ? geometry.getAttribute("color") : undefined;
    scratchNormalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < position.count; i++) {
      const at = (vertexBase + i) * 3;
      scratchPosition.fromBufferAttribute(position, i).applyMatrix4(matrix);
      positions[at] = scratchPosition.x;
      positions[at + 1] = scratchPosition.y;
      positions[at + 2] = scratchPosition.z;
      scratchNormal
        .fromBufferAttribute(normal, i)
        .applyMatrix3(scratchNormalMatrix)
        .normalize();
      normals[at] = scratchNormal.x;
      normals[at + 1] = scratchNormal.y;
      normals[at + 2] = scratchNormal.z;
      if (colors && color) {
        colors[at] = color.getX(i);
        colors[at + 1] = color.getY(i);
        colors[at + 2] = color.getZ(i);
      }
    }
    const flip = matrix.determinant() < 0;
    const count = geometry.index ? geometry.index.count : position.count;
    for (let i = 0; i < count; i += 3) {
      const a = geometry.index ? geometry.index.getX(i) : i;
      const b = geometry.index ? geometry.index.getX(i + 1) : i + 1;
      const c = geometry.index ? geometry.index.getX(i + 2) : i + 2;
      indices[indexBase + i] = vertexBase + a;
      indices[indexBase + i + 1] = vertexBase + (flip ? c : b);
      indices[indexBase + i + 2] = vertexBase + (flip ? b : c);
    }
    ranges.push({ start: indexBase, count });
    vertexBase += position.count;
    indexBase += count;
  }

  const merged = new BufferGeometry();
  merged.setAttribute("position", new BufferAttribute(positions, 3));
  merged.setAttribute("normal", new BufferAttribute(normals, 3));
  if (colors) merged.setAttribute("color", new BufferAttribute(colors, 3));
  merged.setIndex(new BufferAttribute(indices, 1));
  return { geometry: merged, ranges };
}
