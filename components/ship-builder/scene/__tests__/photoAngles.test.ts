import { MAX_POLAR_ANGLE, MAX_VIEW_DISTANCE, polarAngle } from "../cameraViews";
import { PHOTO_ANGLES, photoPose } from "../photoAngles";

describe("photoPose", () => {
  it.each(PHOTO_ANGLES.map((a) => a.id))(
    "keeps %s inside the orbit limits for short and long ships",
    (angle) => {
      for (const length of [6, 14, 40]) {
        for (const aspect of [0.5, 1, 1.6]) {
          const { position, target } = photoPose(angle, length, aspect);
          expect(position.every(Number.isFinite)).toBe(true);
          const distance = Math.hypot(...position.map((v, i) => v - target[i]));
          expect(distance).toBeLessThanOrEqual(MAX_VIEW_DISTANCE);
          expect(polarAngle(position)).toBeLessThanOrEqual(MAX_POLAR_ANGLE);
        }
      }
    }
  );

  it("faces the bow from +X in the bow-on shot", () => {
    const [x, , z] = photoPose("bow-on", 14, 1.4).position;
    expect(x).toBeGreaterThan(Math.abs(z) * 3);
  });

  it("looks from the side in the side shot", () => {
    const [x, , z] = photoPose("side", 14, 1.4).position;
    expect(z).toBeGreaterThan(Math.abs(x));
  });

  it("sits lower in the dramatic low shot than in the three-quarter shot", () => {
    const low = photoPose("low", 14, 1.4).position[1];
    const threeQuarter = photoPose("three-quarter", 14, 1.4).position[1];
    expect(low).toBeLessThan(threeQuarter);
  });

  it("backs off for a narrow canvas", () => {
    const wide = photoPose("bow-on", 14, 1.6).position;
    const narrow = photoPose("bow-on", 14, 0.6).position;
    expect(Math.hypot(...narrow)).toBeGreaterThan(Math.hypot(...wide));
  });
});
