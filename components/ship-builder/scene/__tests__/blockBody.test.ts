import type { BufferGeometry } from "three";
import {
  NO_JOINED_SIDES,
  type BlockSides,
} from "@/lib/ship-builder/model/blockSides";
import { blockBody } from "../blockBody";

function bounds(geometry: BufferGeometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  return { min, max };
}

const SIZE = { x: 1, z: 1 };
const sides = (joined: Partial<BlockSides>): BlockSides => ({
  ...NO_JOINED_SIDES,
  ...joined,
});

describe("blockBody", () => {
  it("keeps the 0.96 inset on every exposed side of a lone block", () => {
    const { min, max } = bounds(blockBody(SIZE, 1, NO_JOINED_SIDES));
    expect(max.x).toBeCloseTo(0.48, 5);
    expect(min.x).toBeCloseTo(-0.48, 5);
    expect(max.z).toBeCloseTo(0.48, 5);
    expect(min.z).toBeCloseTo(-0.48, 5);
    expect(max.y).toBeCloseTo(0.5, 5);
    expect(min.y).toBeCloseTo(-0.5, 5);
  });

  it("scales the inset with a larger footprint", () => {
    const { max } = bounds(blockBody({ x: 3, z: 2 }, 1, NO_JOINED_SIDES));
    expect(max.x).toBeCloseTo(1.44, 5);
    expect(max.z).toBeCloseTo(0.96, 5);
  });

  it.each([
    ["bow", "max", "x", 0.5],
    ["stern", "min", "x", -0.5],
    ["starboard", "max", "z", 0.5],
    ["port", "min", "z", -0.5],
    ["top", "max", "y", 0.5],
  ] as const)(
    "reaches the cell edge on a joined %s only",
    (side, end, axis, flush) => {
      const box = bounds(blockBody(SIZE, 1, sides({ [side]: true })));
      expect(box[end][axis]).toBeCloseTo(flush, 5);
      // The other end of the same axis stays exposed.
      const other = end === "max" ? "min" : "max";
      if (axis !== "y") {
        expect(Math.abs(box[other][axis])).toBeCloseTo(0.48, 5);
      }
    }
  );

  it("is flat and complete: no NaN, normals are unit length", () => {
    const geometry = blockBody(
      SIZE,
      1,
      sides({ bow: true, stern: true, top: true })
    );
    const positions = geometry.getAttribute("position").array;
    const normals = geometry.getAttribute("normal");
    expect(Array.from(positions).every(Number.isFinite)).toBe(true);
    for (let i = 0; i < normals.count; i++) {
      const length = Math.hypot(
        normals.getX(i),
        normals.getY(i),
        normals.getZ(i)
      );
      expect(length).toBeCloseTo(1, 4);
    }
  });

  it("drops the hidden joined faces, so a joined block is cheaper", () => {
    const triangles = (g: BufferGeometry) =>
      g.getAttribute("position").count / 3;
    const lone = triangles(blockBody(SIZE, 1, NO_JOINED_SIDES));
    const joinedBoth = triangles(
      blockBody(SIZE, 1, sides({ bow: true, stern: true }))
    );
    expect(joinedBoth).toBeLessThan(lone);
  });

  it("keeps the exposed vertical walls flat out to the joined edge", () => {
    // Every vertex on the exposed port wall (z = -0.48) of a row piece
    // should span the full cell length: the wall reaches both x edges.
    const geometry = blockBody(SIZE, 1, sides({ bow: true, stern: true }));
    const position = geometry.getAttribute("position");
    let reachesBow = false;
    let reachesStern = false;
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(position.getZ(i) + 0.48) < 1e-4) {
        if (position.getX(i) > 0.4999) reachesBow = true;
        if (position.getX(i) < -0.4999) reachesStern = true;
      }
    }
    expect(reachesBow && reachesStern).toBe(true);
  });

  it("is shared per size and mask", () => {
    const a = blockBody(SIZE, 1, sides({ bow: true }));
    expect(blockBody(SIZE, 1, sides({ bow: true }))).toBe(a);
    expect(blockBody(SIZE, 1, sides({ stern: true }))).not.toBe(a);
  });
});
