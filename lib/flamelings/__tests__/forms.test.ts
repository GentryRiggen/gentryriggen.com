import {
  clean,
  createPet,
  dress,
  emote,
  emptySave,
  feed,
  finishPlay,
  buy,
  settle,
  tapPet,
} from "../actions";
import { FORMS, pickForm } from "../forms";
import { parseSaveSalvaging, parseSave } from "../save";
import { stageFor } from "../progress";
import { SAVE_SCHEMA, type CareStats, type Pet } from "../types";

const look = { colour: "ember", shape: "flame", eyes: "round" } as const;
const noon = new Date(2026, 10, 16, 12).getTime();
const care = (patch: Partial<CareStats> = {}): CareStats => ({
  feeds: 0,
  cleans: 0,
  plays: 0,
  pets: 0,
  styles: 0,
  ...patch,
});
const make = (patch: Partial<Pet> = {}): Pet => ({
  ...createPet({ id: "a", name: "Pip", look, now: noon }),
  ...patch,
});

describe("pickForm", () => {
  it("is Cozy for a pet that is mostly fed and cleaned", () => {
    expect(pickForm(care({ feeds: 40, cleans: 20, plays: 5 }), "x")).toBe(
      "cozy"
    );
  });
  it("is Wild for a pet that is mostly played with", () => {
    expect(pickForm(care({ feeds: 20, cleans: 10, plays: 40 }), "x")).toBe(
      "wild"
    );
  });
  it("is Sparkly for a pet that is petted, emoted and dressed up", () => {
    expect(
      pickForm(care({ feeds: 20, pets: 25, styles: 10, plays: 5 }), "x")
    ).toBe("sparkly");
  });
  it("settles a tie by the pet id, the same way every time", () => {
    const tie = care({ plays: 6, pets: 6 });
    const first = pickForm(tie, "pet-1");
    expect(["wild", "sparkly"]).toContain(first);
    for (let i = 0; i < 5; i++) expect(pickForm(tie, "pet-1")).toBe(first);
  });
  it("picks any form for all zeros, seeded by id, and uses all three across ids", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(pickForm(care(), `pet-${i}`));
    expect([...seen].sort()).toEqual([...FORMS].sort());
    expect(pickForm(care(), "same")).toBe(pickForm(care(), "same"));
  });
});

describe("counting care", () => {
  it("counts feeds, cleans, plays, taps, emotes and dress-ups", () => {
    let pet = make({
      fuel: 40,
      ash: 2,
      unlocked: [...make().unlocked, "hat:chef"],
    });
    pet = feed(pet, "log", noon).pet;
    pet = clean(pet, noon).pet;
    pet = finishPlay(pet, 5, noon).pet;
    pet = tapPet(pet, noon).pet;
    pet = emote(pet).pet;
    pet = dress(pet, "hat", "chef");
    expect(pet.care).toEqual({
      feeds: 1,
      cleans: 1,
      plays: 1,
      pets: 2,
      styles: 1,
    });
    // Putting on what is already on does not count again.
    expect(dress(pet, "hat", "chef").care.styles).toBe(1);
  });

  it("counts a purchase as a dress-up", () => {
    const rich = make({ sparks: 500 });
    expect(buy(rich, "hat:chef", noon).pet.care.styles).toBe(1);
    expect(buy(rich, "decor:plant", noon).pet.care.styles).toBe(1);
  });
});

describe("growing up", () => {
  it("picks the form the moment the pet reaches level 10, once", () => {
    const pet = make({
      level: 9,
      xp: 1e6,
      care: care({ plays: 30 }),
    });
    const out = tapPet({ ...pet, xp: 1e5 }, noon);
    expect(out.pet.level).toBeGreaterThanOrEqual(10);
    expect(out.pet.form).toBe("wild");
    expect(out.events.filter((e) => e.type === "evolve")).toEqual([
      { type: "evolve", form: "wild" },
    ]);
    // Later level-ups keep the form and do not celebrate again.
    const more = tapPet(
      { ...out.pet, xp: 1e6, care: care({ pets: 99 }) },
      noon
    );
    expect(more.pet.form).toBe("wild");
    expect(more.events.some((e) => e.type === "evolve")).toBe(false);
  });

  it("does nothing below level 10", () => {
    const out = tapPet(make({ level: 5 }), noon);
    expect(out.pet.form).toBeNull();
  });
});

describe("a 1.2 save in 1.3", () => {
  const old = () => {
    const save = emptySave(noon);
    const young = make({ id: "young" });
    const grown = make({ id: "grown", level: 12 });
    const raw = JSON.parse(
      JSON.stringify({ ...save, schema: 3, pets: [young, grown] })
    );
    for (const p of raw.pets) {
      delete p.care;
      delete p.form;
    }
    return raw;
  };

  it("loads with counters at 0 and no form yet", () => {
    const parsed = parseSaveSalvaging(old());
    expect(parsed?.skipped).toBe(0);
    expect(parsed?.newer).toBe(false);
    expect(parsed?.save.schema).toBe(SAVE_SCHEMA);
    for (const pet of parsed!.save.pets) {
      expect(pet.care).toEqual(care());
      expect(pet.form).toBeNull();
    }
    expect(parseSave(old())).not.toBeNull();
  });

  it("gives a pet already at level 10 or more its form when it settles, with a celebration event", () => {
    const save = parseSave(old())!;
    const settled = settle(save, noon + 1000);
    const grown = settled.save.pets.find((p) => p.id === "grown")!;
    const young = settled.save.pets.find((p) => p.id === "young")!;
    expect(FORMS).toContain(grown.form);
    expect(stageFor(grown.level).id).toBe("blaze");
    expect(young.form).toBeNull();
    expect(settled.events).toEqual([
      { petId: "grown", event: { type: "evolve", form: grown.form } },
    ]);
    // Settling again does not pick again.
    const again = settle(settled.save, noon + 2000);
    expect(again.events).toEqual([]);
    expect(again.save.pets.find((p) => p.id === "grown")!.form).toBe(
      grown.form
    );
  });

  it("drops a form this build does not know and repairs bad counters", () => {
    const raw = old();
    raw.pets[1].form = "plasma";
    raw.pets[1].care = { feeds: -5, plays: "lots", pets: 3.7 };
    const pet = parseSave(raw)!.pets[1];
    expect(pet.form).toBeNull();
    expect(pet.care).toEqual(care({ pets: 3 }));
  });
});

describe("one shared cap for every game", () => {
  it("pays sparks for three rounds in a window whichever game they came from", () => {
    let pet = make();
    const paid: number[] = [];
    for (let i = 0; i < 5; i++) {
      const out = finishPlay(pet, 8, noon);
      paid.push(
        out.events.some((e) => e.type === "sparks" && e.source === "play")
          ? 1
          : 0
      );
      pet = out.pet;
    }
    expect(paid).toEqual([1, 1, 1, 0, 0]);
    expect(pet.joy).toBeGreaterThan(0);
    expect(pet.xp + pet.level).toBeGreaterThan(1);
  });
});
