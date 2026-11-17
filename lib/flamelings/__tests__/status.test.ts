import { createPet } from "../actions";
import {
  bubblesFor,
  emotesOf,
  fadeLevel,
  labelOf,
  lockText,
  stateGlyph,
  tidiness,
} from "../status";

const look = { colour: "ember", shape: "flame", eyes: "round" } as const;
const at = (h: number) => new Date(2026, 10, 16, h).getTime();
const pet = createPet({ id: "a", name: "Pip", look, now: at(8) });

describe("status", () => {
  it("picks the shelf glyph by priority", () => {
    expect(
      stateGlyph({ ...pet, state: "ember", emberAt: 1 }, at(9))?.label
    ).toBe("Ember");
    expect(stateGlyph(pet, at(9))?.label).toBe("Gift waiting");
    const opened = { ...pet, giftWindow: "2026-11-16:am" };
    expect(stateGlyph(opened, at(9))).toBeNull();
    expect(stateGlyph({ ...opened, fuel: 10 }, at(9))?.label).toBe("Hungry");
    expect(stateGlyph(opened, at(22))?.label).toBe("Asleep");
  });

  it("lists emotes, labels and locks", () => {
    expect(emotesOf(pet)).toEqual(["love", "dance"]);
    expect(labelOf("hat:propeller")).toBe("Propeller cap");
    expect(labelOf("colour:sky")).toBe("Sky");
    expect(lockText("food:coal")).toBe("Level 4");
    expect(lockText("colour:ash")).toBe("Gift");
    expect(tidiness({ ...pet, ash: 3 })).toBe(25);
  });
});

describe("fading and bubbles", () => {
  const healthy = { ...pet, fuel: 100, joy: 100, glow: 100 };
  it("fades with glow, and a little with low needs", () => {
    expect(fadeLevel(healthy)).toBe(0);
    expect(fadeLevel({ ...healthy, glow: 70 })).toBe(1);
    expect(fadeLevel({ ...healthy, glow: 40 })).toBe(3);
    expect(fadeLevel({ ...healthy, glow: 8 })).toBe(4);
    expect(fadeLevel({ ...healthy, fuel: 20 })).toBe(1);
    expect(fadeLevel({ ...healthy, joy: 5 })).toBe(2);
    expect(fadeLevel({ ...healthy, state: "ember", glow: 0 })).toBe(0);
  });

  it("shows a bubble for hunger and for sadness, only while up", () => {
    expect(bubblesFor(healthy, at(12))).toEqual([]);
    expect(bubblesFor({ ...healthy, fuel: 10 }, at(12))).toEqual(["food"]);
    expect(bubblesFor({ ...healthy, fuel: 10, joy: 10 }, at(12))).toEqual([
      "food",
      "play",
    ]);
    expect(bubblesFor({ ...healthy, fuel: 10 }, at(22))).toEqual([]);
  });
});
