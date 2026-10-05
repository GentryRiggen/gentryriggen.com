import {
  createSeaFloorGeometry,
  SEA_FLOOR_BUMP,
  SEA_FLOOR_SIZE,
  seaFloorHeight,
} from "../seaFloorGeometry";

describe("seaFloorGeometry", () => {
  it("keeps every bump within the limit", () => {
    for (let x = -200; x <= 200; x += 7) {
      for (let z = -200; z <= 200; z += 11) {
        expect(Math.abs(seaFloorHeight(x, z))).toBeLessThanOrEqual(
          SEA_FLOOR_BUMP
        );
      }
    }
  });

  it("covers the full plane and stays within the bump height", () => {
    const geometry = createSeaFloorGeometry();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.max.x).toBeCloseTo(SEA_FLOOR_SIZE / 2);
    expect(box.min.z).toBeCloseTo(-SEA_FLOOR_SIZE / 2);
    expect(box.max.y).toBeLessThanOrEqual(SEA_FLOOR_BUMP + 1e-6);
    expect(box.min.y).toBeGreaterThanOrEqual(-SEA_FLOOR_BUMP - 1e-6);
  });

  it("is deterministic", () => {
    const a = createSeaFloorGeometry().getAttribute("position").array;
    const b = createSeaFloorGeometry().getAttribute("position").array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("darkens with distance from the middle", () => {
    const colors = createSeaFloorGeometry().getAttribute("color");
    const side = Math.sqrt(colors.count);
    const centre = Math.floor(side / 2) * side + Math.floor(side / 2);
    const corner = 0;
    const brightness = (i: number) =>
      colors.getX(i) + colors.getY(i) + colors.getZ(i);
    expect(brightness(corner)).toBeLessThan(brightness(centre));
  });
});
