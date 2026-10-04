import { getPartDef } from "@/lib/ship-builder/model/catalog";
import type { GridPartDef } from "@/lib/ship-builder/model/types";
import {
  isWindowLit,
  WINDOW_GLOW,
  windowGroupOf,
  type WindowGroup,
} from "../lightColors";
import {
  bulbCountFor,
  festoonPoint,
  sagFor,
  stringLength,
} from "../stringLightsMath";

const grid = (type: Parameters<typeof getPartDef>[0]) =>
  getPartDef(type) as GridPartDef;

function litShare(group: WindowGroup, windows = 400): number {
  const { litFraction } = WINDOW_GLOW[group];
  let lit = 0;
  for (let i = 0; i < windows; i++) {
    if (isWindowLit(i, litFraction, 3)) lit++;
  }
  return lit / windows;
}

describe("window glow by class", () => {
  it("maps every cabin and bridge to its glow group", () => {
    expect(windowGroupOf(grid("cabin-1st"))).toBe("first");
    expect(windowGroupOf(grid("cabin-2nd"))).toBe("second");
    expect(windowGroupOf(grid("cabin-3rd"))).toBe("third");
    expect(windowGroupOf(grid("cabin-crew"))).toBe("crew");
    expect(windowGroupOf(grid("cabin-balcony"))).toBe("second");
    for (const type of ["bridge", "bridge-3", "bridge-5"] as const) {
      expect(windowGroupOf(grid(type))).toBe("bridge");
    }
    expect(windowGroupOf(grid("deck-1x1"))).toBeNull();
  });

  it("ranks brightness first > second > third > crew", () => {
    const { first, second, third, crew } = WINDOW_GLOW;
    expect(first.strength).toBeGreaterThan(second.strength);
    expect(second.strength).toBeGreaterThan(third.strength);
    expect(third.strength).toBeGreaterThan(crew.strength);
  });

  it("lights every first-class window and fewer of each lower class", () => {
    expect(litShare("first")).toBe(1);
    expect(litShare("second")).toBeGreaterThan(litShare("third"));
    expect(litShare("third")).toBeGreaterThan(litShare("crew"));
    expect(litShare("second")).toBeCloseTo(0.8, 1);
    expect(litShare("third")).toBeCloseTo(0.45, 1);
    expect(litShare("crew")).toBeCloseTo(0.25, 1);
  });

  it("gives each class its own colour, cool for crew and warm for first", () => {
    const colours = [first(), second(), third(), crew()];
    expect(new Set(colours).size).toBe(4);
    expect(red(crew())).toBeLessThan(blue(crew()));
    expect(red(first())).toBeGreaterThan(blue(first()));
  });

  it("is deterministic and varies with the block seed", () => {
    const pattern = (seed: number) =>
      Array.from({ length: 32 }, (_, i) => isWindowLit(i, 0.45, seed));
    expect(pattern(5)).toEqual(pattern(5));
    expect(pattern(5)).not.toEqual(pattern(6));
  });
});

function first() {
  return WINDOW_GLOW.first.color;
}
function second() {
  return WINDOW_GLOW.second.color;
}
function third() {
  return WINDOW_GLOW.third.color;
}
function crew() {
  return WINDOW_GLOW.crew.color;
}
const red = (hex: string) => parseInt(hex.slice(1, 3), 16);
const blue = (hex: string) => parseInt(hex.slice(5, 7), 16);

describe("string lights maths", () => {
  it("starts and ends on the poles and sags in between", () => {
    const target: [number, number, number] = [4, 0, 0];
    expect(festoonPoint(target, 0)).toEqual([0, 0, 0]);
    expect(festoonPoint(target, 1)).toEqual([4, 0, 0]);
    const middle = festoonPoint(target, 0.5);
    expect(middle[0]).toBeCloseTo(2);
    expect(middle[1]).toBeCloseTo(-sagFor(4));
  });

  it("caps the sag and keeps a sensible bulb count", () => {
    expect(sagFor(100)).toBeLessThanOrEqual(0.9);
    expect(bulbCountFor(0.1)).toBe(3);
    expect(bulbCountFor(4)).toBe(10);
    expect(bulbCountFor(1000)).toBe(40);
    expect(stringLength([3, 4, 0])).toBe(5);
  });
});
