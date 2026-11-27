import { SHIP_IDS, getShip, specFor } from "..";
import {
  torpedoHits,
  whatIfOpenings,
  whatIfRealIds,
  whatIfSpots,
} from "../../sim/run";
import { hullOpenings, isDeckOpening, storyIdOf } from "../types";
import { endWords, historyNote } from "../../story";
import type { SimTrack } from "../../sim/track";

const PAIRS = SHIP_IDS.flatMap((ship) =>
  SHIP_IDS.filter((w) => w !== ship).map((wreck) => [ship, wreck] as const)
);

describe("any ship in any wreck (crossover specs)", () => {
  it("is her own spec for her own wreck, and one object per pair", () => {
    for (const id of SHIP_IDS) {
      expect(specFor(id)).toBe(getShip(id));
      expect(specFor(id, id)).toBe(getShip(id));
      expect(storyIdOf(getShip(id))).toBe(id);
    }
    expect(specFor("titanic", "fitzgerald")).toBe(
      specFor("titanic", "fitzgerald")
    );
  });

  it.each(PAIRS)("%s in the %s's wreck", (ship, wreck) => {
    const host = getShip(ship);
    const story = getShip(wreck);
    const spec = specFor(ship, wreck);
    // Her hull, rooms, mass, paint and decks.
    expect(spec.id).toBe(ship);
    expect(spec.name).toBe(host.name);
    expect(spec.compartments).toBe(host.compartments);
    expect(spec.stations).toBe(host.stations);
    expect(spec.displacementT).toBe(host.displacementT);
    expect(spec.liveries).toBe(host.liveries);
    expect(spec.decks).toBe(host.decks);
    // The story's sea, place, time and cause.
    expect(spec.story).toBe(wreck);
    expect(storyIdOf(spec)).toBe(wreck);
    expect(spec.cause).toBe(story.cause);
    expect(spec.clockStartS).toBe(story.clockStartS);
    expect(spec.seaDepthM).toBe(story.seaDepthM);
    expect(spec.storm).toBe(story.storm);
    expect(spec.seabed).toBe(story.seabed);
    expect(spec.waterDensity).toBe(story.waterDensity);
    // Every opening names one of her rooms or one of her deckhouses.
    const rooms = new Set(spec.compartments.map((c) => c.id));
    const boxes = new Set(spec.superstructure.map((b) => b.id));
    const named = (id: string) => rooms.has(id) || boxes.has(id);
    expect(spec.realNight.length).toBeGreaterThan(0);
    for (const o of spec.realNight) {
      expect(named(o.compartmentId)).toBe(true);
      expect(o.zHigh).toBeGreaterThan(o.zLow);
      expect(Number.isFinite(o.x)).toBe(true);
    }
    for (const d of spec.deckOpenings ?? [])
      expect(rooms.has(d.compartmentId)).toBe(true);
    for (const s of spec.wave?.spots ?? [])
      for (const o of s.openings) expect(named(o.compartmentId)).toBe(true);
    if (spec.blackout)
      expect(rooms.has(spec.blackout.compartmentId)).toBe(true);
    for (const id of spec.headway?.pathWhenOpen ?? [])
      expect(rooms.has(id)).toBe(true);
    // Her wreck's own torn bulkheads stay with her own story.
    expect((spec.doors ?? []).some((d) => d.kind === "damage")).toBe(false);
    // Her real run is a What if of real spots, all of them hers to offer.
    const spots = whatIfSpots(spec);
    const real = whatIfRealIds(spec);
    expect(real.length).toBeGreaterThan(0);
    for (const id of real) expect(spots).toContain(id);
    const openings = whatIfOpenings(spec, real, "real");
    expect(openings.length).toBeGreaterThan(0);
    if (spec.cause === "torpedo") {
      expect(spec.torpedo).toBeDefined();
      expect(torpedoHits(spec, real).length).toBe(
        torpedoHits(story, whatIfRealIds(story)).length
      );
      // Her real run's holes are the What if of her real spots.
      expect(hullOpenings(openings)).toEqual(spec.realNight);
    }
    if (spec.cause === "storm")
      expect(openings.some((o) => isDeckOpening(o))).toBe(true);
  });
});

describe("a crossover's end card", () => {
  const track = (outcome: SimTrack["outcome"], extra: Partial<SimTrack> = {}) =>
    ({
      frames: [],
      events: [],
      outcome,
      sankAtT: null,
      brokeAtT: null,
      breakX: null,
      endT: 3600,
      ...extra,
    }) as SimTrack;

  it.each(SHIP_IDS.filter((id) => id !== "titanic"))(
    "never tells the %s's own story lines for the Titanic",
    (wreck) => {
      const spec = specFor("titanic", wreck);
      for (const outcome of [
        "floated",
        "aground",
        "capsized",
        "sank",
      ] as const) {
        const w = endWords(
          track(outcome, outcome === "sank" ? { sankAtT: 1800 } : {}),
          spec,
          2
        );
        const text = [w.title, ...w.lines].join(" ");
        expect(text).toMatch(/Titanic/);
        expect(text).not.toMatch(/On the real (night|morning|afternoon)/);
        expect(text).not.toMatch(/never reached the bay/);
      }
    }
  );

  it("adds whose story it was to the history note", () => {
    expect(historyNote(specFor("britannic", "titanic"))).toMatch(
      /^This was the Titanic's night with the Britannic in it instead\. What really happened: the real Titanic/
    );
  });
});
