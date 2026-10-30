import { buildGashGeometry, gashSegments } from "../HullGash";

describe("the hull gash strip", () => {
  it("keeps the usual short gash as it was", () => {
    expect(gashSegments(6)).toBe(8);
  });

  it("is cut finer as it gets longer", () => {
    expect(gashSegments(60)).toBe(80);
  });

  it("spans exactly the gash it is given", () => {
    for (const width of [6, 24, 60]) {
      const geometry = buildGashGeometry(width);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      expect(box.max.x - box.min.x).toBeCloseTo(width, 5);
      geometry.dispose();
    }
  });
});
