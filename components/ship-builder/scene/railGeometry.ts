import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import type { OutlinePoint } from "./hullShapes";

const UP = new Vector3(0, 1, 0);
const MAX_MITRE = 2;

/**
 * Sweeps a round tube along 3D routes and merges them into one geometry, so a
 * whole ship's top rail is a single draw. Corners are mitred so the tube keeps
 * its thickness through the bow's bends.
 */
export function buildTubeGeometry(
  routes: ReadonlyArray<{
    points: readonly Vector3[];
    isClosed: boolean;
  }>,
  radius: number,
  radialSegments = 6
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (const { points, isClosed } of routes) {
    const count = points.length;
    if (count < 2) continue;
    const base = positions.length / 3;
    const segmentTangent = (i: number): Vector3 =>
      points[(i + 1) % count].clone().sub(points[i]).normalize();

    for (let i = 0; i < count; i++) {
      const hasBefore = isClosed || i > 0;
      const hasAfter = isClosed || i < count - 1;
      const before = hasBefore ? segmentTangent((i - 1 + count) % count) : null;
      const after = hasAfter ? segmentTangent(i) : null;
      const tangent = new Vector3()
        .add(before ?? after!)
        .add(after ?? before!)
        .normalize();
      const mitre = Math.min(
        MAX_MITRE,
        1 / Math.max(1 / MAX_MITRE, tangent.dot(after ?? before!))
      );
      const side = new Vector3().crossVectors(tangent, UP).normalize();
      const lift = new Vector3().crossVectors(side, tangent).normalize();
      for (let k = 0; k < radialSegments; k++) {
        const angle = (2 * Math.PI * k) / radialSegments;
        const ring = side
          .clone()
          .multiplyScalar(Math.cos(angle) * radius * mitre)
          .addScaledVector(lift, Math.sin(angle) * radius);
        positions.push(
          points[i].x + ring.x,
          points[i].y + ring.y,
          points[i].z + ring.z
        );
      }
    }

    const segments = isClosed ? count : count - 1;
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % count;
      for (let k = 0; k < radialSegments; k++) {
        const a = base + i * radialSegments + k;
        const b = base + i * radialSegments + ((k + 1) % radialSegments);
        const c = base + next * radialSegments + k;
        const d = base + next * radialSegments + ((k + 1) % radialSegments);
        indices.push(a, c, b, b, c, d);
      }
    }

    if (!isClosed) {
      for (const [index, isStart] of [
        [0, true],
        [count - 1, false],
      ] as const) {
        const centre = positions.length / 3;
        positions.push(points[index].x, points[index].y, points[index].z);
        const ring = base + index * radialSegments;
        for (let k = 0; k < radialSegments; k++) {
          const a = ring + k;
          const b = ring + ((k + 1) % radialSegments);
          if (isStart) indices.push(centre, a, b);
          else indices.push(centre, b, a);
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Lifts a plan route to 3D, with y given by a function of world x. */
export function liftRoute(
  points: readonly OutlinePoint[],
  heightAt: (x: number) => number
): Vector3[] {
  return points.map(([x, z]) => new Vector3(x, heightAt(x), z));
}
