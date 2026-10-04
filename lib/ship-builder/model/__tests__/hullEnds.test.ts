import {
  BOW_SHAPES,
  bowLength,
  hullSpeedModifier,
  STERN_SHAPES,
  sternLength,
} from "../hullEnds";
import { BOW_IDS, STERN_IDS } from "../types";

describe("hull ends", () => {
  it("keeps the Titanic lengths for the default shapes", () => {
    expect(bowLength("straight")).toBe(2);
    expect(sternLength("counter")).toBe(1.5);
  });

  it("lengths the other shapes", () => {
    expect(bowLength("clipper")).toBe(3);
    expect(bowLength("bulbous")).toBe(2.2);
    expect(bowLength("icebreaker")).toBe(2.2);
    expect(sternLength("cruiser")).toBe(1.8);
    expect(sternLength("transom")).toBe(0.6);
    expect(sternLength("canoe")).toBe(1.8);
  });

  it("makes the clipper the longest bow", () => {
    const longest = Math.max(...BOW_IDS.map(bowLength));
    expect(bowLength("clipper")).toBe(longest);
  });

  it("has a name and description for every shape, keyed by its id", () => {
    for (const id of BOW_IDS) {
      expect(BOW_SHAPES[id]).toMatchObject({ id });
      expect(BOW_SHAPES[id].name).not.toBe("");
      expect(BOW_SHAPES[id].description).not.toBe("");
    }
    for (const id of STERN_IDS) {
      expect(STERN_SHAPES[id]).toMatchObject({ id });
      expect(STERN_SHAPES[id].name).not.toBe("");
      expect(STERN_SHAPES[id].description).not.toBe("");
    }
  });

  it("sums the bow and stern speed modifiers", () => {
    expect(hullSpeedModifier("straight", "counter")).toBe(0);
    expect(hullSpeedModifier("bulbous", "cruiser")).toBe(1.5);
    expect(hullSpeedModifier("icebreaker", "cruiser")).toBe(-1);
  });
});
