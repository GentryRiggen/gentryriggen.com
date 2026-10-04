import { BOW_IDS, STERN_IDS } from "@/lib/ship-builder/model/types";
import { bowLength, sternLength } from "@/lib/ship-builder/model/hullEnds";
import { BOOT_TOP, DECK_Y, HULL_DRAFT } from "../coords";
import {
  BULB_PROTRUSION,
  bowAnchorSpot,
  endOutline,
  endSectionAt,
  halfWidthAt,
} from "../hullShapes";

type Bow = (typeof BOW_IDS)[number];
type Stern = (typeof STERN_IDS)[number];

const HEIGHTS = [-HULL_DRAFT, -0.8, 0, BOOT_TOP, 0.8, DECK_Y];

describe("bow shapes", () => {
  const section = (bow: Bow, y: number) =>
    endSectionAt("bow", bow, bowLength(bow), y);
  const reachAt = (bow: Bow, y: number) => section(bow, y).reach;

  it("keeps the straight stem vertical", () => {
    const reaches = HEIGHTS.map((y) => reachAt("straight", y));
    expect(new Set(reaches).size).toBe(1);
  });

  it("rakes the clipper's deck far forward of its waterline point", () => {
    expect(reachAt("clipper", DECK_Y)).toBeGreaterThan(
      reachAt("clipper", 0) * 1.5
    );
  });

  it("slopes the icebreaker back above the waterline, steeply", () => {
    expect(reachAt("icebreaker", DECK_Y)).toBeLessThan(
      reachAt("icebreaker", 0) * 0.5
    );
    expect(reachAt("icebreaker", -HULL_DRAFT)).toBeLessThan(
      reachAt("icebreaker", 0)
    );
  });

  it("makes the icebreaker blunter in plan than the straight bow", () => {
    const nearTip = (bow: Bow) => {
      const s = section(bow, 0);
      return halfWidthAt(s, 2, s.reach * 0.9) / 2;
    };
    expect(nearTip("icebreaker")).toBeGreaterThan(nearTip("straight"));
  });

  it("leaves room for the bulb within the bulbous bow's length", () => {
    expect(reachAt("bulbous", 0) + BULB_PROTRUSION).toBeCloseTo(
      bowLength("bulbous")
    );
  });
});

describe("stern shapes", () => {
  const section = (stern: Stern, y: number) =>
    endSectionAt("stern", stern, sternLength(stern), y);

  it("tucks the cruiser's underside up and aft", () => {
    expect(section("cruiser", -HULL_DRAFT).reach).toBeLessThan(
      section("cruiser", 0).reach * 0.3
    );
    expect(section("cruiser", 0).reach).toBe(sternLength("cruiser"));
  });

  it("cuts the transom square and short", () => {
    expect(section("transom", 0).exponent).toBeGreaterThanOrEqual(6);
    expect(section("transom", 0).reach).toBeLessThan(sternLength("counter"));
  });

  it("points the canoe in plan view", () => {
    expect(section("canoe", 0).exponent).toBe(1);
  });
});

describe("endOutline", () => {
  it.each([...BOW_IDS])("spans the full beam at the base for %s", (bow) => {
    const section = endSectionAt("bow", bow, bowLength(bow), 0.5);
    const points = endOutline(section, 2);
    expect(points[0][0]).toBeCloseTo(0);
    expect(points[0][1]).toBeCloseTo(2);
    expect(points[points.length - 1][0]).toBeCloseTo(0);
    expect(points[points.length - 1][1]).toBeCloseTo(-2);
  });

  it("reaches the tip on the centreline", () => {
    const tip = endOutline({ reach: 3, exponent: 1 }, 2).find(
      ([, z]) => Math.abs(z) < 1e-9
    );
    expect(tip?.[0]).toBeCloseTo(3);
  });

  it("is symmetric about the centreline", () => {
    const points = endOutline({ reach: 2, exponent: 2 }, 2);
    points.forEach(([x, z], i) => {
      const [mirroredX, mirroredZ] = points[points.length - 1 - i];
      expect(mirroredX).toBeCloseTo(x);
      expect(mirroredZ).toBeCloseTo(-z);
    });
  });
});

describe("bowAnchorSpot", () => {
  it.each([...BOW_IDS])("rests on the hull side for %s", (bow) => {
    const spot = bowAnchorSpot(bow, bowLength(bow), 2, 1);
    expect(spot.z).toBeGreaterThan(0);
    expect(spot.z).toBeLessThanOrEqual(2);
    expect(bowAnchorSpot(bow, bowLength(bow), 2, -1).z).toBeCloseTo(-spot.z);
  });
});

describe("band edges", () => {
  it.each([...BOW_IDS])(
    "gives the same slice for both bands at the boot top for %s",
    (bow) => {
      const slice = () =>
        endOutline(endSectionAt("bow", bow, bowLength(bow), BOOT_TOP), 2);
      expect(slice()).toEqual(slice());
    }
  );
});
