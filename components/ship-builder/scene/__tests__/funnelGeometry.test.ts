import { Box3 } from "three";
import type { BufferGeometry } from "three";
import {
  MODERN_FUNNEL_HEIGHT,
  MODERN_FUNNEL_STRETCH,
  RIM_TUBE,
  buildFunnelBands,
  buildFunnelCap,
  buildFunnelOpening,
  buildModernFunnelBody,
  buildModernFunnelGrille,
  buildSteamPipe,
} from "../funnelGeometry";

const SMALL = {
  baseRadius: 0.42,
  topRadius: 0.38,
  bodyHeight: 2.6,
  capHeight: 0.6,
};
const LARGE = {
  baseRadius: 0.71,
  topRadius: 0.65,
  bodyHeight: 3.4,
  capHeight: 0.8,
};

function bounds(geometry: BufferGeometry): Box3 {
  return new Box3().setFromBufferAttribute(
    geometry.getAttribute("position") as never
  );
}

function hasNoNaN(geometry: BufferGeometry): boolean {
  return Array.from(geometry.getAttribute("position").array).every(
    Number.isFinite
  );
}

describe.each([
  ["small", SMALL],
  ["large", LARGE],
])("%s funnel trim", (_name, dims) => {
  const outer = dims.topRadius + 0.01;
  const capTop = dims.bodyHeight + dims.capHeight;

  it("keeps the old cap's outer size, plus the rolled rim", () => {
    const box = bounds(buildFunnelCap(dims));
    expect(box.min.y).toBeCloseTo(dims.bodyHeight, 5);
    expect(box.max.y).toBeGreaterThan(capTop);
    expect(box.max.y).toBeLessThanOrEqual(capTop + RIM_TUBE * 0.6 + 1e-6);
    expect(box.max.x).toBeLessThanOrEqual(outer + RIM_TUBE * 0.6);
    expect(box.max.x).toBeGreaterThanOrEqual(outer);
  });

  it("keeps the opening inside the rim", () => {
    const box = bounds(buildFunnelOpening(dims));
    expect(box.max.x).toBeLessThan(outer);
    expect(box.min.y).toBeGreaterThan(capTop);
    expect(box.max.y).toBeLessThan(capTop + RIM_TUBE * 0.6);
  });

  it("keeps the bands on the body, under the cap", () => {
    const box = bounds(buildFunnelBands(dims));
    expect(box.max.y).toBeLessThan(dims.bodyHeight);
    expect(box.min.y).toBeGreaterThan(dims.bodyHeight - 1);
    expect(box.max.x).toBeLessThan(dims.baseRadius + 0.02);
  });

  it("puts the steam pipe aft and below the cap", () => {
    const box = bounds(buildSteamPipe(dims));
    expect(box.max.x).toBeLessThan(0);
    expect(box.min.x).toBeGreaterThan(-(dims.baseRadius + 0.2));
    expect(box.max.y).toBeLessThan(capTop);
  });

  it("has no NaN", () => {
    for (const build of [
      buildFunnelCap,
      buildFunnelOpening,
      buildFunnelBands,
      buildSteamPipe,
    ]) {
      expect(hasNoNaN(build(dims))).toBe(true);
    }
  });
});

describe("modern funnel", () => {
  it("keeps the old height and stretched width with a rounded top", () => {
    const body = buildModernFunnelBody();
    const box = bounds(body);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(MODERN_FUNNEL_HEIGHT, 5);
    expect(box.max.x).toBeCloseTo(0.34 * MODERN_FUNNEL_STRETCH, 5);
    expect(box.max.z).toBeCloseTo(0.34, 2);
    expect(hasNoNaN(body)).toBe(true);
  });

  it("keeps the grille on the body", () => {
    const grille = buildModernFunnelGrille();
    expect(bounds(grille).max.y).toBeLessThan(MODERN_FUNNEL_HEIGHT);
    expect(hasNoNaN(grille)).toBe(true);
  });
});
