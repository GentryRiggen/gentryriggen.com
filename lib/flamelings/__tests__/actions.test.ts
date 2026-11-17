import {
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
  settle,
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
      "levelUp",
      "unlock",
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
