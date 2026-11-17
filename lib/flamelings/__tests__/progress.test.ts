import {
  GIFTABLE_UNLOCKS,
  STARTING_UNLOCKS,
  UNLOCK_ORDER,
  levelFor,
} from "../catalog";
import {
  addXp,
  giftWindowAt,
  hasGiftWaiting,
  nextLevelUnlock,
  stageFor,
  visitWindow,
  xpToNext,
} from "../progress";
import { createPet } from "../actions";

const at = (h: number, m = 0) => new Date(2026, 10, 16, h, m).getTime();

describe("xp and stages", () => {
  it("follows round(40 * level^1.4) and slows down", () => {
    expect(xpToNext(1)).toBe(40);
    expect(xpToNext(2)).toBe(Math.round(40 * Math.pow(2, 1.4)));
    for (let l = 1; l < 50; l++) {
      expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
    }
  });

  it("maps levels to stages", () => {
    expect(stageFor(1).id).toBe("spark");
    expect(stageFor(2).id).toBe("spark");
    expect(stageFor(3).id).toBe("flicker");
    expect(stageFor(6).id).toBe("flame");
    expect(stageFor(10).id).toBe("blaze");
    expect(stageFor(15).id).toBe("bonfire");
    expect(stageFor(80).scale).toBe(1);
    expect(stageFor(1).scale).toBe(0.6);
  });

  it("rolls over several levels and hands an item out for each", () => {
    const gain = addXp(1, 0, 40 + xpToNext(2) + 5, STARTING_UNLOCKS);
    expect(gain.level).toBe(3);
    expect(gain.xp).toBe(5);
    expect(gain.gains.map((g) => g.unlocked)).toEqual([
      UNLOCK_ORDER[0],
      UNLOCK_ORDER[1],
    ]);
  });

  it("skips items already won from a gift", () => {
    const owned = [...STARTING_UNLOCKS, UNLOCK_ORDER[0]];
    expect(nextLevelUnlock(owned)).toBe(UNLOCK_ORDER[1]);
  });

  it("gives coal at level 4 and lists every item once", () => {
    expect(levelFor("food:coal")).toBe(4);
    expect(new Set(UNLOCK_ORDER).size).toBe(UNLOCK_ORDER.length);
    const locked = GIFTABLE_UNLOCKS.filter(
      (k) => !STARTING_UNLOCKS.includes(k)
    );
    expect([...UNLOCK_ORDER].sort()).toEqual([...locked].sort());
  });
});

describe("check-in gifts", () => {
  it("has a morning and an evening window and none overnight", () => {
    expect(giftWindowAt(at(6, 29))).toBeNull();
    expect(giftWindowAt(at(6, 30))).toBe("2026-11-16:am");
    expect(giftWindowAt(at(13, 59))).toBe("2026-11-16:am");
    expect(giftWindowAt(at(14))).toBe("2026-11-16:pm");
    expect(giftWindowAt(at(21))).toBeNull();
    expect(visitWindow(at(9))).toBe("morning");
    expect(visitWindow(at(18))).toBe("evening");
    expect(visitWindow(at(23))).toBe("night");
  });

  it("is waiting once per pet per window", () => {
    const pet = createPet({
      id: "a",
      name: "A",
      look: { colour: "ember", shape: "flame", eyes: "round" },
      now: at(8),
    });
    expect(hasGiftWaiting(pet, at(9))).toBe(true);
    const opened = { ...pet, giftWindow: "2026-11-16:am" };
    expect(hasGiftWaiting(opened, at(10))).toBe(false);
    expect(hasGiftWaiting(opened, at(15))).toBe(true);
    expect(hasGiftWaiting(pet, at(22))).toBe(false);
    expect(hasGiftWaiting({ ...pet, state: "ember" }, at(9))).toBe(false);
  });
});
