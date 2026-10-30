import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Vector3,
} from "three";
import { mergeGeometries } from "../batchMerge";

function triangle(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)
  );
  g.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3)
  );
  return g;
}

describe("mergeGeometries", () => {
  it("places each source with its matrix and gives it its own index range", () => {
    const box = new BoxGeometry(1, 1, 1);
    const { geometry, ranges } = mergeGeometries(
      [
        { geometry: box, matrix: new Matrix4().makeTranslation(5, 0, 0) },
        { geometry: box, matrix: new Matrix4().makeTranslation(-5, 0, 0) },
      ],
      false
    );
    const boxIndexCount = box.index!.count;
    expect(ranges).toEqual([
      { start: 0, count: boxIndexCount },
      { start: boxIndexCount, count: boxIndexCount },
    ]);
    const position = geometry.getAttribute("position");
    expect(position.count).toBe(box.getAttribute("position").count * 2);
    const first = new Vector3().fromBufferAttribute(position, 0);
    const boxFirst = new Vector3().fromBufferAttribute(
      box.getAttribute("position"),
      0
    );
    expect(first.x).toBeCloseTo(boxFirst.x + 5);
    // The second source's indices point past the first source's vertices.
    expect(geometry.index!.getX(boxIndexCount)).toBeGreaterThanOrEqual(
      box.getAttribute("position").count
    );
  });

  it("rotates normals with their source", () => {
    const quarterTurn = new Matrix4().makeRotationY(Math.PI / 2);
    const { geometry } = mergeGeometries(
      [{ geometry: triangle(), matrix: quarterTurn }],
      false
    );
    const normal = new Vector3().fromBufferAttribute(
      geometry.getAttribute("normal"),
      0
    );
    expect(normal.x).toBeCloseTo(1);
    expect(normal.z).toBeCloseTo(0);
  });

  it("flips the winding of a mirrored source", () => {
    const mirror = new Matrix4().makeScale(-1, 1, 1);
    const { geometry } = mergeGeometries(
      [{ geometry: triangle(), matrix: mirror }],
      false
    );
    expect([0, 1, 2].map((i) => geometry.index!.getX(i))).toEqual([0, 2, 1]);
  });

  it("carries vertex colours, and fills white where a source has none", () => {
    const coloured = triangle();
    coloured.setAttribute(
      "color",
      new BufferAttribute(
        new Float32Array([0.5, 0.25, 0.1, 0.5, 0.25, 0.1, 0.5, 0.25, 0.1]),
        3
      )
    );
    const { geometry } = mergeGeometries(
      [
        { geometry: coloured, matrix: new Matrix4() },
        { geometry: triangle(), matrix: new Matrix4() },
      ],
      true
    );
    const color = geometry.getAttribute("color");
    expect(color.getX(0)).toBeCloseTo(0.5);
    expect(color.getY(0)).toBeCloseTo(0.25);
    expect(color.getX(3)).toBe(1);
  });
});
