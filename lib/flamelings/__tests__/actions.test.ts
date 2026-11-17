import {
  buy,
  clean,
  createPet,
  dress,
  emptySave,
  feed,
  finishPlay,
  hatch,
  MAX_PETS,
  openGift,
  restyle,
  setDecor,
  settle,
  SPARKS,
  tapPet,
} from "../actions";
import { UNLOCK_ORDER } from "../catalog";
import { advance, OUT_AFTER_MS } from "../sim";
import type { Pet } from "../types";

const look = { colour: "ember", shape: "flame", eyes: "round" } as const;
const noon = new Date(2026, 10, 16, 12).getTime();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const make = (patch: Partial<Pet> = {}): Pet => ({
  ...createPet({ id: "a", name: "Pip", look, now: noon }),
  ...patch,
});

describe("feed", () => {
  it("adds fuel and gives 10 XP only while fuel is under 80", () => {
    const hungry = feed(make({ fuel: 50 }), "log", noon);
    expect(hungry.pet.fuel).toBe(90);
    expect(hungry.pet.xp).toBe(10);
    const peckish = feed(make({ fuel: 85 }), "twig", noon);
    expect(peckish.pet.fuel).toBe(100);
    expect(peckish.pet.xp).toBe(0);
  });

  it("applies each food's fuel and joy", () => {
    const base = make({
      fuel: 10,
      joy: 10,
      unlocked: [...make().unlocked, "food:coal"],
    });
    expect(feed(base, "pinecone", noon).pet).toMatchObject({
      fuel: 35,
      joy: 15,
    });
    expect(feed(base, "marshmallow", noon).pet).toMatchObject({
      fuel: 15,
      joy: 25,
    });
    expect(feed(base, "coal", noon).pet.fuel).toBe(70);
  });

  it("shakes its head when full, with no penalty", () => {
    const out = feed(make({ fuel: 100 }), "log", noon);
    expect(out.events).toEqual([{ type: "overfed" }]);
    expect(out.pet).toEqual(make({ fuel: 100 }));
  });

  it("ignores locked food and a sleeping pet", () => {
    expect(feed(make({ fuel: 10 }), "coal", noon).pet.fuel).toBe(10);
    const night = new Date(2026, 10, 16, 22).getTime();
    expect(feed(make({ fuel: 10 }), "log", night).pet.fuel).toBe(10);
  });

  it("levels up and hands out the first unlock", () => {
    const out = feed(make({ fuel: 10, xp: 35 }), "log", noon);
    expect(out.pet.level).toBe(2);
    expect(out.pet.unlocked).toContain(UNLOCK_ORDER[0]);
    expect(out.events.map((e) => e.type)).toEqual([
      "care",
      "sparks",
      "levelUp",
      "unlock",
      "sparks",
    ]);
  });
});

describe("relight", () => {
  it("takes three feeds, then glow 40 and fuel 50", () => {
    let pet = make({ state: "ember", emberAt: noon, fuel: 0, glow: 0 });
    pet = feed(pet, "twig", noon).pet;
    expect(pet.state).toBe("ember");
    pet = feed(pet, "twig", noon).pet;
    expect(pet.state).toBe("ember");
    const last = feed(pet, "twig", noon);
    expect(last.pet).toMatchObject({
      state: "alive",
      glow: 40,
      fuel: 50,
      emberAt: null,
    });
    expect(last.events).toContainEqual({ type: "state", to: "relit" });
    expect(last.pet.xp).toBe(20);
  });

  it("wakes up and drains again after relighting", () => {
    const pet = make({
      state: "ember",
      emberAt: noon,
      fuel: 0,
      glow: 0,
      relightFeeds: 2,
    });
    const lit = feed(pet, "log", noon).pet;
    expect(advance(lit, noon, noon + 2 * HOUR).fuel).toBeLessThan(50);
  });
});

describe("relight recovery", () => {
  it("starts a pet that is happy and tidy, so it does not slip back within a day", () => {
    const ember = make({
      state: "ember",
      emberAt: noon,
      fuel: 0,
      glow: 0,
      joy: 0,
      ash: 4,
      relightFeeds: 2,
    });
    const lit = feed(ember, "log", noon).pet;
    expect(lit).toMatchObject({ joy: 60, ash: 0, glow: 40, fuel: 50 });
    const nextDay = advance(lit, noon, noon + 24 * HOUR);
    expect(nextDay.state).toBe("alive");
    expect(nextDay.glow).toBeGreaterThan(0);
    // Glow climbs while it is fed and happy.
    expect(advance(lit, noon, noon + 2 * HOUR).glow).toBeGreaterThan(40);
  });

  it("hatches full and happy", () => {
    expect(make()).toMatchObject({ fuel: 100, joy: 100, glow: 100 });
  });
});

describe("other care", () => {
  it("cleans one pile for 3 XP", () => {
    const out = clean(make({ ash: 2 }), noon);
    expect(out.pet.ash).toBe(1);
    expect(out.pet.xp).toBe(3);
    expect(clean(make({ ash: 0 }), noon).events).toEqual([]);
  });

  it("turns a Firefly Catch score into joy and XP with caps", () => {
    const small = finishPlay(make({ joy: 10 }), 7, noon).pet;
    expect(small.joy).toBe(24);
    expect(small.xp).toBe(3);
    const huge = finishPlay(make({ joy: 10 }), 90, noon).pet;
    expect(huge.joy).toBe(50);
    expect(huge.xp).toBe(20);
  });

  it("gives pet-tap XP only ten times a day", () => {
    let pet = make();
    for (let i = 0; i < 14; i++) pet = tapPet(pet, noon).pet;
    expect(pet.xp).toBe(10);
    const tomorrow = noon + DAY;
    expect(tapPet(pet, tomorrow).pet.xp).toBe(11);
  });

  it("opens one gift per window with a locked item and 15 XP", () => {
    const first = openGift(make(), noon, () => 0);
    expect(first.pet.xp).toBe(15);
    expect(first.pet.unlocked.length).toBe(make().unlocked.length + 1);
    expect(first.events).toContainEqual({
      type: "unlock",
      key: first.pet.unlocked.at(-1),
      via: "gift",
    });
    expect(openGift(first.pet, noon, () => 0).events).toEqual([]);
    expect(
      openGift(first.pet, noon + 4 * HOUR, () => 0).events.length
    ).toBeGreaterThan(0);
  });

  it("gives bonus XP when everything is unlocked", () => {
    const all = make({ unlocked: [...make().unlocked, ...UNLOCK_ORDER] });
    const out = openGift(all, noon);
    expect(out.events).toContainEqual({ type: "bonusXp", amount: 15 });
  });
});

describe("dressing", () => {
  it("wears unlocked items only", () => {
    const pet = make({ unlocked: [...make().unlocked, "hat:crown"] });
    expect(dress(pet, "hat", "crown").worn.hat).toBe("crown");
    expect(dress(pet, "hat", "wizard").worn.hat).toBeNull();
    expect(dress(dress(pet, "hat", "crown"), "hat", null).worn.hat).toBeNull();
    expect(restyle(pet, { colour: "rose" }).look.colour).toBe("ember");
    expect(restyle(pet, { colour: "sky", shape: "drop" }).look).toEqual({
      colour: "sky",
      shape: "flame",
      eyes: "round",
    });
  });
});

describe("shelf", () => {
  it("caps at eight pets and shares the collection with newcomers", () => {
    let save = emptySave(noon);
    const a = hatch(save, { id: "a", name: "A", look, now: noon });
    const unlocked = [...a.pets[0].unlocked, "hat:crown" as const];
    save = { ...a, pets: [{ ...a.pets[0], unlocked }] };
    save = hatch(save, { id: "b", name: "B", look, now: noon });
    expect(save.pets[1].unlocked).toContain("hat:crown");
    for (let i = 0; i < 10; i++) {
      save = hatch(save, { id: `x${i}`, name: "X", look, now: noon });
    }
    expect(save.pets).toHaveLength(MAX_PETS);
  });

  it("moves a pet that stayed an ember for five days to the Memory Grove", () => {
    const born = noon - 10 * DAY;
    const pet = make({ bornAt: born, tickedAt: noon, fuel: 100, joy: 100 });
    let save = { ...emptySave(noon), pets: [pet] };
    const gone = settle(save, noon + 4 * DAY);
    expect(gone.save.pets[0].state).toBe("ember");
    expect(gone.events).toContainEqual({
      petId: "a",
      event: { type: "state", to: "ember" },
    });
    const emberAt = gone.save.pets[0].emberAt ?? 0;
    save = gone.save;
    const out = settle(save, emberAt + OUT_AFTER_MS + HOUR);
    expect(out.save.pets).toEqual([]);
    expect(out.save.memorial).toHaveLength(1);
    expect(out.save.memorial[0]).toMatchObject({ name: "Pip", level: 1 });
    expect(out.events.map((e) => e.event)).toContainEqual({
      type: "state",
      to: "out",
    });
    // Their unlocks stay on the device.
    expect(out.save.collection).toContain("emote:love");
  });
});

describe("sparks", () => {
  it("pays 3 for feeding while hungry, nothing when nearly full", () => {
    expect(feed(make({ fuel: 50 }), "log", noon).pet.sparks).toBe(3);
    expect(feed(make({ fuel: 85 }), "twig", noon).pet.sparks).toBe(0);
    expect(feed(make({ fuel: 100 }), "twig", noon).pet.sparks).toBe(0);
  });

  it("pays 2 for each ash pile and 1 per firefly (at most 12)", () => {
    expect(clean(make({ ash: 2 }), noon).pet.sparks).toBe(2);
    expect(finishPlay(make(), 7, noon).pet.sparks).toBe(7);
    expect(finishPlay(make(), 90, noon).pet.sparks).toBe(SPARKS.playCap);
    expect(finishPlay(make(), 0, noon).pet.sparks).toBe(0);
  });

  it("pays 10 to 25 for the check-in gift", () => {
    expect(openGift(make(), noon, () => 0).pet.sparks).toBe(10);
    expect(openGift(make(), noon, () => 0.999).pet.sparks).toBe(25);
  });

  it("pays 10 x level on each level-up, and 5 for a relight", () => {
    const up = feed(make({ fuel: 10, xp: 35 }), "log", noon);
    expect(up.pet.level).toBe(2);
    expect(up.pet.sparks).toBe(3 + 20);
    const ember = make({ state: "ember", relightFeeds: 2, emberAt: noon });
    const lit = feed(ember, "twig", noon);
    expect(lit.pet.sparks).toBeGreaterThanOrEqual(5);
    expect(lit.events).toContainEqual({
      type: "sparks",
      amount: 5,
      source: "relight",
    });
  });

  it("stays between 40 and 80 a day for two normal visits", () => {
    // Visits at 9:00 and 18:00: open the gift, feed whenever it is hungry
    // enough to pay, clean every pile, play one round of 6 fireflies.
    let pet = make({ bornAt: noon, tickedAt: noon });
    const day0 = new Date(2026, 10, 16).getTime();
    const DAYS = 28;
    let total = 0;
    let rolls = 0;
    const random = () => [0.2, 0.7, 0.45, 0.9][rolls++ % 4];
    for (let day = 0; day < DAYS; day++) {
      for (const hour of [9, 18]) {
        const at = day0 + day * DAY + hour * HOUR;
        pet = advance(pet, pet.tickedAt, at);
        const before = pet.sparks;
        pet = openGift(pet, at, random).pet;
        for (let i = 0; i < 4 && pet.fuel < 80; i++) {
          pet = feed(pet, "log", at).pet;
        }
        while (pet.ash > 0) pet = clean(pet, at).pet;
        pet = finishPlay(pet, 6, at).pet;
        total += pet.sparks - before;
      }
    }
    const perDay = total / DAYS;
    expect(perDay).toBeGreaterThanOrEqual(40);
    expect(perDay).toBeLessThanOrEqual(80);
  });
});

describe("shop", () => {
  const rich = (patch: Partial<Pet> = {}) => make({ sparks: 500, ...patch });

  it("takes the price, adds the item to the collection and wears a hat", () => {
    const out = buy(rich(), "hat:pirate");
    expect(out.pet.sparks).toBe(500 - 90);
    expect(out.pet.unlocked).toContain("hat:pirate");
    expect(out.pet.worn.hat).toBe("pirate");
    expect(out.events).toEqual([{ type: "buy", key: "hat:pirate", price: 90 }]);
  });

  it("puts new decor out in the glade", () => {
    const out = buy(rich(), "decor:rug");
    expect(out.pet.decor).toEqual(["rug"]);
    expect(out.pet.sparks).toBe(440);
  });

  it("refuses when short of sparks, owned already or not for sale", () => {
    expect(buy(make({ sparks: 89 }), "hat:pirate").events).toEqual([]);
    const owned = buy(rich(), "hat:chef").pet;
    expect(buy(owned, "hat:chef").events).toEqual([]);
    expect(buy(rich(), "hat:party").events).toEqual([]);
    expect(buy(rich(), "food:coal").events).toEqual([]);
  });

  it("shares bought items with newly hatched pets", () => {
    const first = buy(rich(), "decor:tent").pet;
    const save = hatch(
      { ...emptySave(noon), pets: [first] },
      { id: "b", name: "Bo", look, now: noon }
    );
    const second = save.pets[1];
    expect(second.unlocked).toContain("decor:tent");
    expect(second.sparks).toBe(0);
    expect(second.decor).toEqual([]);
  });

  it("puts owned decor out and away, and ignores decor not owned", () => {
    const pet = buy(rich(), "decor:plant").pet;
    expect(setDecor(pet, "plant", false).decor).toEqual([]);
    expect(
      setDecor(setDecor(pet, "plant", false), "plant", true).decor
    ).toEqual(["plant"]);
    expect(setDecor(pet, "tent", true).decor).toEqual(["plant"]);
  });

  it("never gives shop items as level or gift rewards", () => {
    const every = rich();
    for (let i = 0; i < 80; i++) {
      const out = openGift(every, noon + i * DAY, () => i / 80);
      for (const e of out.events) {
        if (e.type === "unlock") {
          expect(e.key).not.toMatch(/pirate|rug|tent|cape|bunny/);
        }
      }
    }
  });
});
