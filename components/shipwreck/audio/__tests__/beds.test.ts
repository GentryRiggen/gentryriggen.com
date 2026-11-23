import { createFakeAudio } from "@/components/game-audio/testing/fakeAudio";
import type { VoiceEngine } from "@/components/game-audio/primitives";
import { BED_LEVEL, bedTargets, createBeds } from "../beds";
import type { BedState } from "../cues";
import { CUE_BUS_LEVEL, VOICE_PEAK_MAX, playCue } from "../voices";
import type { Cue } from "../cues";

const base: BedState = {
  steam: false,
  power: 1,
  strain: 0,
  underwater: false,
  speed: 1,
};

describe("bed targets", () => {
  it("is silent when sound is off", () => {
    const t = bedTargets({ ...base, steam: true }, false);
    expect(Object.values(t).every((v) => v === 0)).toBe(true);
  });

  it("keeps the sea, hum and night tone on a calm night", () => {
    const t = bedTargets(base, true);
    expect(t.sea).toBe(BED_LEVEL.sea);
    expect(t.hum).toBe(BED_LEVEL.hum);
    expect(t.steam).toBe(0);
    expect(t.rumble).toBe(0);
  });

  it("stops the hum when the power fails", () => {
    expect(bedTargets({ ...base, power: 0 }, true).hum).toBe(0);
  });

  it("roars with steam, ducked above x10", () => {
    const loud = bedTargets({ ...base, steam: true, speed: 10 }, true).steam;
    const ducked = bedTargets({ ...base, steam: true, speed: 30 }, true).steam;
    expect(loud).toBe(BED_LEVEL.steam);
    expect(ducked).toBeLessThan(loud);
    expect(ducked).toBeGreaterThan(0);
  });

  it("goes to a low rumble under water", () => {
    const t = bedTargets({ ...base, steam: true, underwater: true }, true);
    expect(t.rumble).toBe(BED_LEVEL.rumble);
    expect(t.sea).toBe(0);
    expect(t.steam).toBe(0);
  });

  it("keeps the Titanic's targets as they were (no engines, no gulls bed)", () => {
    expect(bedTargets(base, true)).toEqual({
      sea: BED_LEVEL.sea,
      hum: BED_LEVEL.hum,
      night: BED_LEVEL.night,
      steam: 0,
      rumble: 0,
      engines: 0,
      wind: 0,
      wash: 0,
    });
    expect(bedTargets({ ...base, ship: "titanic" }, true)).toEqual(
      bedTargets(base, true)
    );
  });

  it("gives the Lusitania an afternoon: open sea and engines, no night tone", () => {
    const l = { ...base, ship: "lusitania" as const };
    const t = bedTargets(l, true);
    expect(t.sea).toBe(BED_LEVEL.sea);
    expect(t.engines).toBe(BED_LEVEL.engines);
    expect(t.night).toBe(0);
    expect(t.hum).toBe(0);
  });

  it("fades her engines as steam fails, and under water", () => {
    const l = { ...base, ship: "lusitania" as const };
    const half = bedTargets({ ...l, power: 0.5 }, true).engines;
    expect(half).toBeLessThan(BED_LEVEL.engines);
    expect(half).toBeGreaterThan(0);
    expect(bedTargets({ ...l, power: 0 }, true).engines).toBe(0);
    expect(bedTargets({ ...l, underwater: true }, true).engines).toBe(0);
    expect(bedTargets(l, false).engines).toBe(0);
  });

  it("keeps every bed well under 0.2", () => {
    for (const v of Object.values(BED_LEVEL)) expect(v).toBeLessThan(0.2);
  });
});

describe("voices", () => {
  const audio = createFakeAudio();
  beforeEach(() => {
    audio.install();
    audio.reset();
  });
  afterEach(() => audio.uninstall());

  function engine(): VoiceEngine {
    const ctx = new (
      window as unknown as { AudioContext: new () => AudioContext }
    ).AudioContext();
    return {
      ctx,
      bus: ctx.createGain(),
      white: ctx.createBuffer(1, 1, 100),
      brown: ctx.createBuffer(1, 1, 100),
    };
  }

  const CUES: Cue[] = [
    "scrape",
    "rocket",
    "davit",
    "creak",
    "creakFar",
    "rush",
    "funnel",
    "powerDown",
    "breakup",
    "plunge",
    "thud",
    "torpedo",
    "boom",
    "mine",
    "whistle",
    "hardHit",
    "bowDown",
    "gull",
    "swell",
    "hatch",
    "waveCrash",
  ];

  it("plays every cue under 0.2 gain and disconnects when done", () => {
    const e = engine();
    for (const cue of CUES) {
      audio.sources.length = 0;
      playCue(e, cue, 1);
      expect(audio.sources.length).toBeGreaterThan(0);
      for (const g of audio.nodes) {
        for (const call of g.gain.linearRampToValueAtTime.mock.calls) {
          expect(call[0]).toBeLessThan(0.2);
        }
      }
      for (const s of audio.sources) s.onended?.();
    }
  });

  it("keeps every voice's peak at or under VOICE_PEAK_MAX", () => {
    const e = engine();
    for (const cue of CUES) {
      audio.nodes.length = 0;
      playCue(e, cue, 1);
      for (const g of audio.nodes) {
        const p = g.gain;
        for (const call of [
          ...p.linearRampToValueAtTime.mock.calls,
          ...p.setValueAtTime.mock.calls,
        ])
          expect(call[0]).toBeLessThanOrEqual(VOICE_PEAK_MAX + 1e-9);
      }
    }
  });

  it("stays under 0.3 at the output with the loudest cues and beds at once", () => {
    const e = engine();
    audio.nodes.length = 0;
    const loud: Cue[] = ["breakup", "plunge", "thud", "rush"];
    for (const cue of loud) playCue(e, cue, 1);
    // Each voice: rises to its peak, then decays exponentially to its end.
    const envelopes = audio.nodes
      .map((g) => {
        const lin = g.gain.linearRampToValueAtTime.mock.calls;
        const exp = g.gain.exponentialRampToValueAtTime.mock.calls;
        const set = g.gain.setValueAtTime.mock.calls;
        if (lin.length === 0 || exp.length === 0) return null;
        return {
          start: set[0][1] as number,
          peakT: lin[0][1] as number,
          peak: Math.max(
            ...lin.map((c: number[]) => c[0]),
            ...set.map((c: number[]) => c[0])
          ),
          end: exp[exp.length - 1][1] as number,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
    const at = (t: number) =>
      envelopes.reduce((sum, v) => {
        if (t < v.start || t > v.end) return sum;
        if (t <= v.peakT)
          return sum + (v.peak * (t - v.start)) / (v.peakT - v.start || 1);
        const k = (t - v.peakT) / (v.end - v.peakT || 1);
        return sum + v.peak * Math.pow(0.0001 / v.peak, k);
      }, 0);
    let worstCues = 0;
    for (let t = 0; t < 6; t += 0.01) worstCues = Math.max(worstCues, at(t));
    // The held beds at their loudest above water (steam not ducked).
    const beds = bedTargets({ ...base, steam: true, power: 1, speed: 1 }, true);
    const bedSum =
      beds.sea +
      beds.hum +
      beds.night +
      beds.steam +
      beds.rumble +
      beds.engines;
    // The kit's master gain (0.8) sits between the bus and the limiter.
    const total = (worstCues * CUE_BUS_LEVEL + bedSum) * 0.8;
    console.log(
      `Shipwreck worst-case sum: cues ${worstCues.toFixed(3)} x ${CUE_BUS_LEVEL} + beds ${bedSum.toFixed(3)}, x 0.8 = ${total.toFixed(3)}`
    );
    expect(total).toBeLessThanOrEqual(0.3);
  });

  it("keeps her loudest cues and beds under 0.3 too", () => {
    const l = bedTargets(
      { ...base, ship: "lusitania", steam: true, power: 1 },
      true
    );
    const sum = Object.values(l).reduce((a, b) => a + b, 0);
    // The boom's three voices and a plunge's can overlap at their peaks.
    const cues = 4 * VOICE_PEAK_MAX * CUE_BUS_LEVEL;
    expect((cues + sum) * 0.8).toBeLessThan(0.3);
  });

  it("has a storm bed for the Fitzgerald that rises with the wind and muffles under water", () => {
    const calm = bedTargets({ ...base, ship: "fitzgerald", wind: 0.2 }, true);
    const gale = bedTargets(
      { ...base, ship: "fitzgerald", wind: 1, strain: 0.5 },
      true
    );
    expect(gale.wind).toBeGreaterThan(calm.wind);
    expect(gale.wash).toBeGreaterThan(calm.wash);
    expect(gale.sea).toBeGreaterThan(calm.sea);
    expect(gale.engines).toBeGreaterThan(0);
    expect(gale.hum).toBe(0);
    expect(gale.night).toBe(0);
    expect(gale.steam).toBe(0);
    const under = bedTargets(
      { ...base, ship: "fitzgerald", wind: 1, underwater: true },
      true
    );
    expect(under.wind).toBe(0);
    expect(under.wash).toBe(0);
    expect(under.sea).toBe(0);
    expect(under.rumble).toBeGreaterThan(0);
  });

  it("leaves the liners' beds without wind", () => {
    for (const ship of ["titanic", "lusitania"] as const) {
      const t = bedTargets({ ...base, ship, wind: 1 }, true);
      expect(t.wind).toBe(0);
      expect(t.wash).toBe(0);
    }
  });

  it("keeps the Fitzgerald's loudest cues and beds under 0.3", () => {
    const l = bedTargets(
      { ...base, ship: "fitzgerald", wind: 1, strain: 1, power: 1 },
      true
    );
    const sum = Object.values(l).reduce((a, b) => a + b, 0);
    const cues = 4 * VOICE_PEAK_MAX * CUE_BUS_LEVEL;
    expect((cues + sum) * 0.8).toBeLessThan(0.3);
  });

  it("builds the beds once and tears them down", () => {
    const e = engine();
    const beds = createBeds(e);
    const before = audio.sources.length;
    beds.apply(base, true);
    beds.apply(base, true);
    expect(audio.sources.length).toBe(before);
    beds.dispose();
    for (const s of audio.sources) expect(s.stop).toHaveBeenCalled();
  });
});

describe("the Britannic's morning bed", () => {
  it("has a calm sea and engines that follow her power, no hum or night tone", () => {
    const full = bedTargets({ ...base, ship: "britannic" }, true);
    const half = bedTargets({ ...base, ship: "britannic", power: 0.5 }, true);
    const off = bedTargets({ ...base, ship: "britannic", power: 0 }, true);
    expect(full.sea).toBe(BED_LEVEL.sea);
    expect(full.engines).toBeGreaterThan(0);
    expect(half.engines).toBeLessThan(full.engines);
    expect(off.engines).toBe(0);
    expect(full.hum).toBe(0);
    expect(full.night).toBe(0);
    expect(full.wind).toBe(0);
    expect(full.wash).toBe(0);
  });

  it("goes to the low rumble under water", () => {
    const u = bedTargets(
      { ...base, ship: "britannic", underwater: true },
      true
    );
    expect(u.sea).toBe(0);
    expect(u.engines).toBe(0);
    expect(u.rumble).toBe(BED_LEVEL.rumble);
  });

  it("keeps her loudest cues and beds under 0.3", () => {
    const l = bedTargets({ ...base, ship: "britannic", steam: true }, true);
    const sum = Object.values(l).reduce((a, b) => a + b, 0);
    const cues = 4 * VOICE_PEAK_MAX * CUE_BUS_LEVEL;
    expect((cues + sum) * 0.8).toBeLessThan(0.3);
  });
});

describe("the Britannic's engines follow her way", () => {
  it("falls quiet as her way comes off and is gated by power", () => {
    const at = (way: number, power = 1) =>
      bedTargets({ ...base, ship: "britannic", way, power }, true).engines;
    expect(at(1)).toBeGreaterThan(at(0.1));
    expect(at(0)).toBe(0);
    expect(at(1, 0)).toBe(0);
    expect(bedTargets({ ...base, ship: "britannic" }, true).engines).toBe(
      at(1)
    );
  });

  it("is ignored by every other ship", () => {
    for (const ship of ["titanic", "lusitania", "fitzgerald"] as const)
      expect(bedTargets({ ...base, ship, way: 0.1 }, true)).toEqual(
        bedTargets({ ...base, ship }, true)
      );
  });
});

describe("the Carpathia's open-Atlantic bed", () => {
  const car = { ...base, ship: "carpathia" } as const;
  it("has a deeper sea, a fresh breeze and engines, no coast wash or hum", () => {
    const t = bedTargets(car, true);
    expect(t.sea).toBeGreaterThan(BED_LEVEL.sea);
    expect(t.wind).toBeGreaterThan(0);
    expect(t.wind).toBeLessThan(BED_LEVEL.wind * 0.5);
    expect(t.engines).toBeGreaterThan(0);
    expect(t.wash).toBe(0);
    expect(t.hum).toBe(0);
    expect(t.night).toBe(0);
    expect(bedTargets({ ...car, power: 0 }, true).engines).toBe(0);
  });

  it("goes to the low rumble under water and is silent when off", () => {
    const u = bedTargets({ ...car, underwater: true }, true);
    expect(u.sea).toBe(0);
    expect(u.wind).toBe(0);
    expect(u.rumble).toBe(BED_LEVEL.rumble);
    const off = bedTargets(car, false);
    expect(Object.values(off).every((v) => v === 0)).toBe(true);
  });

  it("keeps her loudest cues and beds under 0.3", () => {
    const l = bedTargets({ ...car, steam: true }, true);
    const sum = Object.values(l).reduce((a, b) => a + b, 0);
    expect((4 * VOICE_PEAK_MAX * CUE_BUS_LEVEL + sum) * 0.8).toBeLessThan(0.3);
  });

  it("leaves every other ship's mix as it was", () => {
    for (const ship of ["titanic", "lusitania", "fitzgerald"] as const)
      expect(bedTargets({ ...base, ship }, true).wind).toBe(0);
    expect(bedTargets(base, true).sea).toBe(BED_LEVEL.sea);
  });
});
