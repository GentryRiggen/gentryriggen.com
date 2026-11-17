import { createPet } from "../actions";
import { emotesOf, labelOf, lockText, stateGlyph, tidiness } from "../status";

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
