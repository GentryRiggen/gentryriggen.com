import { LEVEL_ORDER } from "@/lib/plane-builder/levels";
import { MAX_TIER, type Tiers } from "@/lib/plane-builder/plane/catalog";
import { planeParts } from "../planeParts";
import {
  HANGAR_PLANE_RADIUS,
  SIDEBAR_WIDTH,
  hangarFraming,
} from "../hangarFraming";

const FOV = 55;

/** Half of the visible world height at `distance`. */
const halfHeight = (distance: number) =>
  distance * Math.tan((FOV * Math.PI) / 360);

describe("hangarFraming", () => {
  it("shifts the view up on a phone and fits the plane in the open top half", () => {
    const { distance, offsetX, offsetY } = hangarFraming(390, 844, FOV);
    expect(offsetX).toBe(0);
    expect(offsetY).toBeGreaterThan(0);
    // The radius, in px, must fit in half of the open area.
    const pxPerUnit = 844 / (2 * halfHeight(distance));
    expect(HANGAR_PLANE_RADIUS * pxPerUnit).toBeLessThanOrEqual(390 / 2 + 0.01);
    expect(HANGAR_PLANE_RADIUS * pxPerUnit).toBeLessThanOrEqual(422 / 2 + 0.01);
  });

  it("shifts the view left of the sidebar from md", () => {
    const { distance, offsetX, offsetY } = hangarFraming(1280, 800, FOV);
    expect(offsetX).toBe(SIDEBAR_WIDTH / 2);
    expect(offsetY).toBe(0);
    const pxPerUnit = 800 / (2 * halfHeight(distance));
    expect(HANGAR_PLANE_RADIUS * pxPerUnit).toBeLessThanOrEqual(
      (1280 - SIDEBAR_WIDTH) / 2 + 0.01
    );
  });

  it("backs the camera off further on a narrow screen", () => {
    expect(hangarFraming(390, 844, FOV).distance).toBeGreaterThan(
      hangarFraming(1280, 800, FOV).distance
    );
  });

  it.each(LEVEL_ORDER)("holds the maxed %s plane", (id) => {
    const maxed: Tiers = {
      launcher: MAX_TIER,
      wings: MAX_TIER,
      engine: MAX_TIER,
      fuel: MAX_TIER,
      body: MAX_TIER,
      multiplier: MAX_TIER,
    };
    const parts = planeParts(id, maxed);
    // Allow for a nose cone, propeller or exhaust flame past the body ends.
    const reach = parts.bodyLength / 2 + 0.6;
    expect(Math.hypot(parts.wingSpan / 2, reach)).toBeLessThanOrEqual(
      HANGAR_PLANE_RADIUS
    );
  });
});
