import { WORLD_MUSIC } from "../../plane-builder/audio/worldMusic";
import { SHANTY } from "../../ship-builder/audio/shanty";
import { LEVEL_ORDER } from "@/lib/plane-builder/levels";
import {
  barSeconds,
  createRandom,
  degreeToMidi,
  isValidSpec,
  midiToHz,
  PHRASE_BARS,
  planBar,
  type MusicSpec,
} from "../music";

const SPEC: MusicSpec = {
  id: "test",
  tempo: 120,
  beatsPerBar: 4,
  rootMidi: 60,
  scale: [0, 2, 4, 5, 7, 9, 11],
  progression: [0, 3, 4, 3],
  leadDensity: 0.6,
  leadRange: [0, 7],
  padWave: "sine",
  leadWave: "triangle",
  isStrummed: false,
  level: 1,
  seed: 5,
};

describe("music theory helpers", () => {
  it("maps A4 to 440 Hz and an octave to double", () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(81)).toBeCloseTo(880);
  });

  it("wraps scale degrees across octaves, up and down", () => {
    expect(degreeToMidi(SPEC, 0)).toBe(60);
    expect(degreeToMidi(SPEC, 7)).toBe(72);
    expect(degreeToMidi(SPEC, -1)).toBe(59);
    expect(degreeToMidi(SPEC, 9)).toBe(76);
  });

  it("gives the same random sequence for the same seed", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("works out a bar's length from tempo and beats", () => {
    expect(barSeconds(SPEC)).toBeCloseTo(2);
  });
});

describe("planBar", () => {
  it("is deterministic", () => {
    expect(planBar(SPEC, 3)).toEqual(planBar(SPEC, 3));
  });

  it("repeats the melody every phrase", () => {
    expect(planBar(SPEC, 2)).toEqual(planBar(SPEC, 2 + PHRASE_BARS));
  });

  it("keeps every note inside its bar, in time order", () => {
    for (let bar = 0; bar < PHRASE_BARS; bar += 1) {
      const events = planBar(SPEC, bar);
      let last = -1;
      for (const event of events) {
        expect(event.beat).toBeGreaterThanOrEqual(0);
        expect(event.beat).toBeLessThan(SPEC.beatsPerBar);
        expect(event.beat).toBeGreaterThanOrEqual(last);
        expect(event.gain).toBeGreaterThan(0);
        expect(event.gain).toBeLessThanOrEqual(1);
        last = event.beat;
      }
    }
  });

  it("plays a three-note pad and a bass each bar", () => {
    const events = planBar(SPEC, 0);
    expect(events.filter((e) => e.voice === "pad")).toHaveLength(3);
    expect(events.filter((e) => e.voice === "bass")).toHaveLength(1);
  });

  it("has no melody at zero density", () => {
    const events = planBar({ ...SPEC, leadDensity: 0 }, 1);
    expect(events.some((e) => e.voice === "lead")).toBe(false);
  });

  it("keeps the melody inside its range (plus the octave lift)", () => {
    const [low, high] = SPEC.leadRange;
    for (let bar = 0; bar < PHRASE_BARS; bar += 1) {
      for (const event of planBar(SPEC, bar)) {
        if (event.voice !== "lead") continue;
        expect(event.midi).toBeGreaterThanOrEqual(degreeToMidi(SPEC, low) + 12);
        expect(event.midi).toBeLessThanOrEqual(degreeToMidi(SPEC, high) + 12);
      }
    }
  });

  it("strums off the beat when asked", () => {
    const events = planBar({ ...SPEC, isStrummed: true, beatsPerBar: 6 }, 0);
    expect(events.some((e) => e.voice === "pluck")).toBe(true);
  });

  it("follows the chord progression", () => {
    const rootOf = (bar: number) =>
      planBar({ ...SPEC, leadDensity: 0 }, bar).find((e) => e.voice === "bass")!
        .midi;
    expect(rootOf(0)).toBe(degreeToMidi(SPEC, 0) - 12);
    expect(rootOf(1)).toBe(degreeToMidi(SPEC, 3) - 12);
    expect(rootOf(4)).toBe(rootOf(0));
  });
});

describe("the shipped specs", () => {
  it("gives every world a valid, distinct mood", () => {
    const ids = new Set<string>();
    for (const levelId of LEVEL_ORDER) {
      const spec = WORLD_MUSIC[levelId];
      expect(spec).toBeDefined();
      expect(isValidSpec(spec)).toBe(true);
      ids.add(spec.id);
    }
    expect(ids.size).toBe(LEVEL_ORDER.length);
    const moods = new Set(
      LEVEL_ORDER.map(
        (id) => `${WORLD_MUSIC[id].rootMidi}-${WORLD_MUSIC[id].tempo}`
      )
    );
    expect(moods.size).toBeGreaterThan(7);
  });

  it("has a valid shanty in six", () => {
    expect(isValidSpec(SHANTY)).toBe(true);
    expect(SHANTY.beatsPerBar).toBe(6);
    expect(SHANTY.isStrummed).toBe(true);
  });
});
