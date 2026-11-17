import {
  collectWish,
  completeHappening,
  createPet,
  markHappeningSeen,
  settle,
} from "../actions";
import {
  HAPPENING_KINDS,
  activeHappening,
  ensureHappening,
  forcedHappening,
  hasHappeningWaiting,
  hatchDayAt,
  happeningWindowAt,
  mushroomSequence,
  pickHappening,
  seasonAt,
  type Happening,
} from "../happenings";
import { GIFTABLE_UNLOCKS } from "../catalog";
import { parseSave } from "../save";
import { priceOf, shopItem } from "../shop";
import type { Pet, SaveData } from "../types";

const at = (m: number, d: number, h = 12, min = 0) =>
  new Date(2026, m - 1, d, h, min).getTime();
const noon = at(11, 17);
const look = { colour: "ember", shape: "flame", eyes: "round" } as const;

function make(patch: Partial<Pet> = {}, born = at(11, 16)): Pet {
  return {
    ...createPet({ id: "pet-a", name: "Pip", look, now: born }),
    ...patch,
  };
}

function withHappening(
  kind: Happening["kind"],
  patch: Partial<Pet> = {},
  ms = noon,
  variant?: string
): Pet {
  return make({ happening: forcedHappening(kind, ms, variant), ...patch });
}

describe("windows", () => {
  it("splits the day into morning, evening and night", () => {
    expect(happeningWindowAt(at(11, 17, 6, 29))).toBe("2026-11-16:night");
    expect(happeningWindowAt(at(11, 17, 6, 30))).toBe("2026-11-17:am");
    expect(happeningWindowAt(at(11, 17, 13, 59))).toBe("2026-11-17:am");
    expect(happeningWindowAt(at(11, 17, 14))).toBe("2026-11-17:pm");
    expect(happeningWindowAt(at(11, 17, 20, 59))).toBe("2026-11-17:pm");
    expect(happeningWindowAt(at(11, 17, 21))).toBe("2026-11-17:night");
    expect(happeningWindowAt(at(11, 18, 2))).toBe("2026-11-17:night");
  });
});

describe("the seeded pick", () => {
  it("is the same every time for the same pet and window", () => {
    for (let i = 0; i < 50; i++) {
      const id = `pet-${i}`;
      expect(pickHappening(id, at(11, 1), noon)).toEqual(
        pickHappening(id, at(11, 1), noon)
      );
    }
  });

  it("brings something to about three windows in four, and every kind turns up", () => {
    let some = 0;
    const kinds = new Set<string>();
    const total = 800;
    for (let i = 0; i < total; i++) {
      const h = pickHappening(`pet-${i}`, at(11, 1), noon);
      if (h) {
        some += 1;
        kinds.add(h.kind);
      }
    }
    expect(some / total).toBeGreaterThan(0.69);
    expect(some / total).toBeLessThan(0.81);
    expect([...kinds].sort()).toEqual(
      ["mushrooms", "rain", "season", "treasure", "visitor"].sort()
    );
  });

  it("only brings a shooting star at night", () => {
    const night = at(11, 17, 23);
    const kinds = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const h = pickHappening(`pet-${i}`, at(11, 1), night);
      if (h) kinds.add(h.kind);
    }
    expect([...kinds]).toEqual(["star"]);
  });

  it("never picks a season outside winter, spring and autumn", () => {
    const summer = at(7, 10);
    for (let i = 0; i < 300; i++) {
      expect(pickHappening(`pet-${i}`, at(6, 1), summer)?.kind).not.toBe(
        "season"
      );
    }
  });

  it("gives visitors their own faces and mushrooms 3 to 5 steps", () => {
    const visitors = new Set<string>();
    const steps = new Set<string>();
    for (let i = 0; i < 600; i++) {
      const h = pickHappening(`pet-${i}`, at(11, 1), noon);
      if (h?.kind === "visitor") visitors.add(h.variant);
      if (h?.kind === "mushrooms") steps.add(h.variant);
    }
    expect(visitors.size).toBe(5);
    expect([...steps].sort()).toEqual(["3", "4", "5"]);
  });
});

describe("keeping the pick", () => {
  it("stores the pick, keeps it (and its done state) for the window", () => {
    // Find a pet that has something happen at noon.
    let pet = make();
    for (let i = 0; i < 50 && !ensureHappening(pet, noon).happening; i++) {
      pet = make({ id: `p${i}` });
    }
    const stored = ensureHappening(pet, noon);
    expect(stored.happening).not.toBeNull();
    const done = completeHappening(stored, noon, () => 0.5).pet;
    expect(done.happening?.done).toBe(true);
    // Settling again (a reload) does not reroll it or undo it.
    expect(ensureHappening(done, noon + 60_000)).toBe(done);
    expect(activeHappening(done, noon + 60_000)).toBeNull();
    // A later window picks again.
    const evening = at(11, 17, 18);
    const next = ensureHappening(done, evening);
    expect(next.happening?.window ?? "2026-11-17:pm").toBe("2026-11-17:pm");
  });

  it("brings nothing to an ember", () => {
    const ember = make({ state: "ember", glow: 0, emberAt: noon });
    expect(ensureHappening(ember, noon)).toBe(ember);
    expect(
      activeHappening({ ...withHappening("visitor"), state: "ember" }, noon)
    ).toBeNull();
  });

  it("is saved by settle and survives a save round trip", () => {
    const save: SaveData = {
      v: 1,
      schema: 3,
      pets: [make({ tickedAt: noon })],
      memorial: [],
      collection: [],
      updatedAt: noon,
    };
    const { save: settled } = settle(save, noon);
    const loaded = parseSave(JSON.parse(JSON.stringify(settled)));
    expect(loaded?.pets[0].happening).toEqual(settled.pets[0].happening);
  });

  it("is only active in its own window", () => {
    const pet = withHappening("visitor");
    expect(activeHappening(pet, noon)).not.toBeNull();
    expect(activeHappening(pet, at(11, 17, 18))).toBeNull();
  });
});

describe("hatch days and seasons", () => {
  const born = at(10, 1, 9);
  it("celebrates every 30th day alive and each yearly anniversary", () => {
    expect(hatchDayAt(born, at(10, 31))).toBe("monthly");
    expect(hatchDayAt(born, at(10, 30))).toBeNull();
    expect(hatchDayAt(born, at(10, 1))).toBeNull();
    expect(hatchDayAt(at(11, 17), new Date(2027, 10, 17, 12).getTime())).toBe(
      "yearly"
    );
  });

  it("always picks the party on a hatch day, in the morning window", () => {
    const day = at(10, 31);
    expect(pickHappening("any", born, day)).toMatchObject({
      kind: "hatchday",
      variant: "monthly",
    });
  });

  it("keeps an undone party for the evening, then does not repeat it", () => {
    const day = at(10, 31, 9);
    const pet = ensureHappening(
      make({ id: "x", bornAt: born, tickedAt: day, state: "alive" }, born),
      day
    );
    expect(pet.happening?.kind).toBe("hatchday");
    const evening = at(10, 31, 17);
    expect(ensureHappening(pet, evening)).toBe(pet);
    expect(activeHappening(pet, evening)).not.toBeNull();
    const done = completeHappening(pet, evening, () => 0.5).pet;
    const later = ensureHappening(done, at(10, 31, 19));
    expect(later.happening?.kind).not.toBe("hatchday");
  });

  it("follows the calendar", () => {
    expect(seasonAt(at(12, 25))).toBe("winter");
    expect(seasonAt(at(1, 15))).toBe("winter");
    expect(seasonAt(at(2, 28))).toBe("winter");
    expect(seasonAt(at(4, 10))).toBe("spring");
    expect(seasonAt(at(7, 4))).toBeNull();
    expect(seasonAt(at(10, 5))).toBe("autumn");
    expect(seasonAt(at(10, 25))).toBe("halloween");
    expect(seasonAt(at(11, 17))).toBe("autumn");
  });

  it("puts the snowman on sale in winter only", () => {
    const snowman = shopItem("decor:snowman")!;
    expect(priceOf(snowman, at(1, 10))).toBe(100);
    expect(priceOf(snowman, at(7, 10))).toBe(150);
    expect(priceOf(snowman)).toBe(150);
  });
});

describe("mushroom dance", () => {
  it("is the same every time and never repeats a mushroom in a row", () => {
    const a = mushroomSequence("seed", 5);
    expect(a).toEqual(mushroomSequence("seed", 5));
    expect(a).toHaveLength(5);
    for (let i = 1; i < a.length; i++) expect(a[i]).not.toBe(a[i - 1]);
    for (const n of a) expect(n).toBeGreaterThanOrEqual(0);
    for (const n of a) expect(n).toBeLessThan(5);
  });
});

describe("rewards", () => {
  const sparksOf = (out: ReturnType<typeof completeHappening>) =>
    out.pet.sparks - 0;

  it("a visitor leaves 10 to 30 sparks, or a locked item", () => {
    const low = completeHappening(withHappening("visitor"), noon, () => 0.99);
    expect(sparksOf(low)).toBe(30);
    const none = completeHappening(withHappening("visitor"), noon, () => 0.9);
    expect(none.events.some((e) => e.type === "unlock")).toBe(false);
    const item = completeHappening(withHappening("visitor"), noon, () => 0);
    expect(item.events).toContainEqual(
      expect.objectContaining({ type: "unlock", via: "gift" })
    );
    expect(item.pet.sparks).toBe(0);
  });

  it("falls back to sparks when every item is owned", () => {
    const owned = withHappening("visitor", {
      unlocked: [...make().unlocked, ...GIFTABLE_UNLOCKS],
    });
    const out = completeHappening(owned, noon, () => 0);
    expect(out.events.some((e) => e.type === "unlock")).toBe(false);
    expect(out.pet.sparks).toBe(10);
  });

  it("a treasure and a mushroom dance pay sparks", () => {
    expect(
      completeHappening(withHappening("treasure"), noon, () => 0.99).pet.sparks
    ).toBeGreaterThanOrEqual(15);
    const dance = completeHappening(
      withHappening("mushrooms", { joy: 50 }),
      noon,
      () => 0.5
    ).pet;
    expect(dance.sparks).toBeGreaterThanOrEqual(12);
    expect(dance.joy).toBe(60);
  });

  it("rain pays and cheers when popped, and is only a little soggy when missed", () => {
    const good = completeHappening(
      withHappening("rain", { joy: 50 }),
      noon,
      () => 0,
      { popped: 10, missed: 3 }
    ).pet;
    expect(good.joy).toBe(65);
    expect(good.sparks).toBe(8);
    const soggy = completeHappening(
      withHappening("rain", { joy: 50, glow: 90 }),
      noon,
      () => 0,
      { popped: 2, missed: 12 }
    ).pet;
    expect(soggy.joy).toBe(42);
    expect(soggy.glow).toBe(90);
    expect(soggy.fuel).toBe(100);
    expect(soggy.sparks).toBe(3);
  });

  it("a shooting star holds its wish until the pet is up, then pays once", () => {
    const night = at(11, 17, 23);
    const wished = completeHappening(
      withHappening("star", {}, night),
      night,
      () => 0.5
    ).pet;
    expect(wished.wish).toBeGreaterThanOrEqual(10);
    expect(wished.sparks).toBe(0);
    expect(collectWish(wished, night).pet).toBe(wished);
    const morning = at(11, 18, 8);
    const paid = collectWish(wished, morning);
    expect(paid.pet.sparks).toBe(wished.wish);
    expect(paid.pet.wish).toBe(0);
    expect(collectWish(paid.pet, morning).events).toEqual([]);
  });

  it("a hatch day pays, gives the party hat once and adds a bit of joy", () => {
    const first = completeHappening(
      withHappening("hatchday", {}, noon, "yearly"),
      noon,
      () => 0.5
    );
    expect(first.pet.sparks).toBe(100);
    expect(first.events).toContainEqual({
      type: "unlock",
      key: "hat:party",
      via: "gift",
    });
    const monthly = completeHappening(
      withHappening(
        "hatchday",
        { unlocked: [...first.pet.unlocked] },
        noon,
        "monthly"
      ),
      noon,
      () => 0.5
    );
    expect(monthly.pet.sparks).toBe(30);
    expect(monthly.events.some((e) => e.type === "unlock")).toBe(false);
  });

  it("ignores a second completion and counts started and done for stats", () => {
    const pet = withHappening("season");
    const seen = markHappeningSeen(pet, noon);
    expect(seen.events).toEqual([
      { type: "happening", kind: "season", done: false },
    ]);
    expect(markHappeningSeen(seen.pet, noon).events).toEqual([]);
    const done = completeHappening(seen.pet, noon, () => 0.5);
    expect(done.events[0]).toEqual({
      type: "happening",
      kind: "season",
      done: true,
    });
    expect(completeHappening(done.pet, noon).events).toEqual([]);
  });

  it("shows the bubble for a happening or a waiting wish", () => {
    expect(hasHappeningWaiting(withHappening("rain"), noon, true)).toBe(true);
    expect(hasHappeningWaiting(make(), noon, true)).toBe(false);
    expect(hasHappeningWaiting(make({ wish: 12 }), noon, true)).toBe(true);
    expect(hasHappeningWaiting(make({ wish: 12 }), noon, false)).toBe(false);
  });

  it("knows every kind", () => {
    expect(HAPPENING_KINDS).toHaveLength(7);
  });
});

describe("review fixes: parties and window rollover", () => {
  const born = at(10, 1);
  const party = () =>
    ensureHappening(
      make({ id: "x", bornAt: born, tickedAt: at(10, 31, 9) }, born),
      at(10, 31, 9)
    );

  it("keeps an undone party through the night and the next morning", () => {
    const pet = party();
    expect(pet.happening?.kind).toBe("hatchday");
    const night = at(10, 31, 21, 30);
    expect(ensureHappening(pet, night)).toBe(pet);
    expect(activeHappening(pet, night)?.kind).toBe("hatchday");
    const morning = at(11, 1, 8);
    expect(ensureHappening(pet, morning)).toBe(pet);
    expect(activeHappening(pet, morning)?.kind).toBe("hatchday");
  });

  it("lets the party go once the next morning window is over", () => {
    const pet = party();
    const later = ensureHappening(pet, at(11, 1, 15));
    expect(later.happening?.kind).not.toBe("hatchday");
    expect(activeHappening(pet, at(11, 1, 15))).toBeNull();
  });

  it("does not replace a happening that is on screen at a rollover", () => {
    const pet = ensureHappening(
      withHappening("rain", { tickedAt: noon }, at(11, 17, 13, 50)),
      at(11, 17, 13, 50)
    );
    const window = pet.happening!.window;
    const after = at(11, 17, 14, 5);
    expect(ensureHappening(pet, after, window)).toBe(pet);
    // Not held: the new window's pick replaces it as before.
    expect(ensureHappening(pet, after).happening?.window).not.toBe(window);
  });

  it("pays only the happening the screen was playing, across the boundary", () => {
    const am = at(11, 17, 13, 50);
    const pet = withHappening("rain", {}, am);
    const expect_ = { window: pet.happening!.window, kind: "rain" } as const;
    const crossed = at(11, 17, 14, 5);
    // The held rain still pays after 14:00.
    const paid = completeHappening(
      pet,
      crossed,
      () => 0.5,
      { popped: 5 },
      expect_
    );
    expect(paid.events[0]).toMatchObject({ type: "happening", kind: "rain" });
    // A different happening now active is not paid for the old one.
    const swapped = withHappening("visitor", {}, crossed);
    expect(
      completeHappening(swapped, crossed, () => 0.5, {}, expect_).events
    ).toEqual([]);
    // And an already finished one pays nothing twice.
    expect(
      completeHappening(paid.pet, crossed, () => 0.5, {}, expect_).events
    ).toEqual([]);
  });

  it("settle keeps a held happening and swaps it once released", () => {
    const pet = withHappening("rain", { tickedAt: at(11, 17, 13, 50) });
    const am = withHappening(
      "rain",
      { tickedAt: at(11, 17, 13, 50) },
      at(11, 17, 13, 50)
    );
    void pet;
    const save = { ...emptyForTest(), pets: [am] };
    const crossed = at(11, 17, 14, 5);
    const held = settle(save, crossed, {
      petId: am.id,
      window: am.happening!.window,
    });
    expect(held.save.pets[0].happening?.kind).toBe("rain");
    expect(held.save.pets[0].happening?.window).toBe(am.happening!.window);
    const free = settle(save, crossed);
    expect(free.save.pets[0].happening?.window).not.toBe(am.happening!.window);
  });
});

function emptyForTest(): SaveData {
  return {
    v: 1,
    schema: 3,
    pets: [],
    memorial: [],
    collection: [],
    updatedAt: 0,
  };
}
