import { Box3 } from "three";
import { roundedBox } from "../roundedBox";

describe("roundedBox", () => {
  it("keeps the exact outer size", () => {
    const geometry = roundedBox(2.88, 0.8, 3.84);
    const box = new Box3().setFromBufferAttribute(
      geometry.getAttribute("position") as never
    );
    expect(box.max.x - box.min.x).toBeCloseTo(2.88, 5);
    expect(box.max.y - box.min.y).toBeCloseTo(0.8, 5);
    expect(box.max.z - box.min.z).toBeCloseTo(3.84, 5);
  });

  it("is shared per size", () => {
    expect(roundedBox(1, 1, 1)).toBe(roundedBox(1, 1, 1));
    expect(roundedBox(1, 1, 1)).not.toBe(roundedBox(1, 2, 1));
  });

  it("stays valid for pieces thinner than the bevel", () => {
    const geometry = roundedBox(1, 0.02, 1);
    const positions = geometry.getAttribute("position").array;
    expect(Array.from(positions).every(Number.isFinite)).toBe(true);
  });
});
