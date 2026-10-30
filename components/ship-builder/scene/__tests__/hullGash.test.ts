import { buildGashGeometry, gashHalves, gashSegments } from "../HullGash";
import { hullHalfWidth } from "../hullShapes";

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

  it("hugs the hull's side at every height when given the beam", () => {
    const halfBeam = 2;
    const geometry = buildGashGeometry(10, halfBeam);
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      expect(positions.getZ(i)).toBeCloseTo(
        hullHalfWidth(positions.getY(i), halfBeam) - halfBeam,
        6
      );
    }
    geometry.dispose();
  });
});

describe("gashHalves", () => {
  it("gives a gash on one side of the break to that half", () => {
    expect(gashHalves(5, 40, undefined, 20)).toEqual(["bow"]);
    expect(gashHalves(35, 40, undefined, 20)).toEqual(["stern"]);
  });

  it("gives a gash across the break to both halves", () => {
    expect(gashHalves(20, 40, undefined, 20)).toEqual(["bow", "stern"]);
    expect(gashHalves(20, 40, 40, 12)).toEqual(["bow", "stern"]);
  });
});
