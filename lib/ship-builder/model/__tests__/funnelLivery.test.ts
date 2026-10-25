import {
  FUNNEL_LOGOS,
  funnelColors,
  isFunnelType,
  normalizeMarkText,
} from "../funnelLivery";
import { FUNNEL_LOGO_PATHS } from "../funnelLogoPaths";
import { testShip } from "../../testing";

describe("normalizeMarkText", () => {
  it.each([
    ["ab", "AB"],
    ["a-b!c", "AB"],
    ["7", "7"],
    ["🚢x", "X"],
    ["", ""],
    ["abc", "AB"],
  ])("%j becomes %j", (input, expected) => {
    expect(normalizeMarkText(input)).toBe(expected);
  });
});

describe("isFunnelType", () => {
  it("is true for the funnel parts only", () => {
    expect(isFunnelType("funnel")).toBe(true);
    expect(isFunnelType("funnel-large")).toBe(true);
    expect(isFunnelType("funnel-modern")).toBe(true);
    expect(isFunnelType("mast")).toBe(false);
  });
});

describe("funnelColors", () => {
  const ship = {
    ...testShip(),
    funnelPaint: { body: "red", top: "black" } as const,
  };

  it("reads the ship's funnel paint", () => {
    expect(funnelColors(ship, {})).toEqual({ body: "red", top: "black" });
  });

  it("lets a funnel's own colour override the body", () => {
    expect(funnelColors(ship, { color: "buff" })).toEqual({
      body: "buff",
      top: "black",
    });
  });

  it("is empty for an unpainted ship", () => {
    expect(funnelColors(testShip(), {})).toEqual({});
  });
});

describe("FUNNEL_LOGO_PATHS", () => {
  it("has one filled path per logo", () => {
    expect(Object.keys(FUNNEL_LOGO_PATHS).sort()).toEqual(
      FUNNEL_LOGOS.map((l) => l.id).sort()
    );
    for (const path of Object.values(FUNNEL_LOGO_PATHS)) {
      expect(path.startsWith("M")).toBe(true);
    }
  });
});
