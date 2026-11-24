import { ridePose } from "@/components/shipwreck/scene/stormRide";
import type { ShipSpec, StormSpec } from "../../ships/types";
import type { Body } from "../body";
import {
  type SimOptions,
  createSimRunner,
  simulate,
  whatIfOpenings,
  whatIfRealIds,
  whatIfSpots,
} from "../run";
import type { BodyPose, SimTrack } from "../track";
import {
  rogueGroup,
  ruleRoll,
  swellFade,
  waveOpenings,
  waveStartT,
  type WaveVariant,
} from "../wave";
import { waveRide } from "../waveRide";
import { stormOf } from "../waves";
import { WAVE, WAVE_SPOTS, waveShip } from "./testShips";

const DEG = Math.PI / 180;
const ALL = [...WAVE_SPOTS];

interface Step {
  t: number;
  roll: number;
  pitch: number;
  z: number;
  wr: number;
  water: number;
}

/** A run with every step's whole-hull state (the probe). */
function run(
  spec: ShipSpec,
  variant: WaveVariant,
  opts: SimOptions = {}
): { track: SimTrack; steps: Step[] } {
  const steps: Step[] = [];
  const runner = createSimRunner(spec, whatIfOpenings(spec, ALL, variant), {
    wave: variant,
    endT: 400,
    ...opts,
    probe: (p) => {
      const b = p.bodies[0] as Body;
      let water = 0;
      for (const c of b.all) water += c.water;
      steps.push({
        t: p.t,
        roll: b.roll,
        pitch: b.pitch,
        z: b.z,
        wr: b.wr,
        water,
      });
    },
  });
  runner.advance(Infinity);
  return { track: runner.track(), steps };
}

function events(track: SimTrack, kind: string) {
  return track.events.filter((e) => e.kind === kind);
}

describe("the wave's roll rule (a rule)", () => {
  const spec = waveShip({ extra: { lcg: 5 } });
  const { track, steps } = run(spec, "real", { endT: 80 });
  const g = rogueGroup(track.storm) as NonNullable<
    ReturnType<typeof rogueGroup>
  >;
  const t0 = waveStartT(g);
  const t1 = t0 + WAVE.rollS;
  const during = steps.filter((s) => s.t > t0 && s.t < t1 - 1e-9);

  it("joins her storm as her rogue wave, locked on her", () => {
    expect(g).not.toBeNull();
    expect(g.heightM).toBe(WAVE.heightM);
    expect(Math.abs(g.t - WAVE.t)).toBeLessThanOrEqual(WAVE.periodS / 2);
  });

  it("eases her roll by the smoothstep to peakDeg over rollS", () => {
    expect(during.length).toBeGreaterThan(100);
    const roll0 = steps.filter((s) => s.t <= t0).pop()?.roll ?? 0;
    const out: [number, number] = [0, 0];
    for (const s of during) {
      ruleRoll(roll0, WAVE.peakDeg * DEG, t0, WAVE.rollS, s.t, out);
      expect(Math.abs(s.roll - out[0]) / DEG).toBeLessThan(0.5);
    }
  });

  it("lets go at the peak with her roll rate zeroed", () => {
    const handOff = steps.find((s) => s.t >= t1 - 1e-9) as Step;
    expect(handOff.roll / DEG).toBeCloseTo(WAVE.peakDeg, 9);
    expect(handOff.wr).toBe(0);
    // Physics owns her roll from the next step.
    const next = steps[steps.indexOf(handOff) + 1];
    expect(next.wr).not.toBe(0);
  });

  it("leaves heave, pitch and flooding to physics during it", () => {
    const zs = during.map((s) => s.z);
    const pitches = during.map((s) => s.pitch / DEG);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(5);
    expect(Math.max(...pitches) - Math.min(...pitches)).toBeGreaterThan(0.1);
    expect(during[during.length - 1].water).toBeGreaterThan(during[0].water);
  });

  it("puts the lights out the step her list passes blackout.listDeg", () => {
    const out = events(track, "lights-out");
    expect(out).toHaveLength(1);
    const first = steps.find((s) => Math.abs(s.roll) > 60 * DEG) as Step;
    expect(out[0].t).toBeCloseTo(first.t, 9);
    for (const f of track.frames)
      if (f.t >= out[0].t) expect(f.power).toBe(0.2);
      else expect(f.power).toBe(1);
  });

  it("fires capsized once, as the rule lets go past 150°", () => {
    const c = events(track, "capsized");
    expect(c).toHaveLength(1);
    expect(c[0].realT).toBeGreaterThanOrEqual(t1 - 1e-9);
    expect(c[0].realT).toBeLessThan(t1 + 0.2);
  });

  it("runs shown time 6× slower once capsized, frames carrying realT", () => {
    const c = events(track, "capsized")[0];
    const after = track.frames.filter((f) => f.t > c.t + 0.5);
    expect(after.length).toBeGreaterThan(10);
    for (let i = 1; i < after.length; i += 1) {
      const dReal = after[i].realT - after[i - 1].realT;
      const dShown = after[i].t - after[i - 1].t;
      expect(dReal).toBeCloseTo(6 * dShown, 6);
    }
    const before = track.frames.filter((f) => f.t < c.t);
    for (const f of before) expect(f.realT).toBeCloseTo(f.t, 9);
  });

  it("keeps the rogue wave out of her ride and fades her swell's over rollS", () => {
    const storm = track.storm as StormSpec;
    const scale = track.stormScale ?? 1;
    const without: StormSpec = {
      ...storm,
      groups: (storm.groups ?? []).filter((x) => x !== g),
    };
    const a = new Float64Array(3);
    const b = new Float64Array(3);
    // At the crest, the group adds nothing to her ride.
    waveRide(storm, scale, g.x ?? 0, g.y ?? 0, spec, g.t, a);
    waveRide(without, scale, g.x ?? 0, g.y ?? 0, spec, g.t, b);
    expect([...a]).toEqual([...b]);
    expect(swellFade(spec, storm, t0 - 1)).toBe(1);
    expect(swellFade(spec, storm, t0 + WAVE.rollS / 2)).toBeCloseTo(0.5, 9);
    expect(swellFade(spec, storm, t1)).toBe(0);
    expect(swellFade(spec, storm, t1 + 100)).toBe(0);
    // Any ship without a wave keeps her whole ride.
    const plain = { ...spec, wave: undefined };
    expect(swellFade(plain, storm, t1)).toBe(1);
  });

  it("rides her on screen by the same rule (stormRide)", () => {
    const body: BodyPose = {
      part: "whole",
      x: 0,
      y: 0,
      z: -7,
      pitch: 0,
      roll: 0,
      yaw: 0,
    };
    const out = { ...body };
    const ride = new Float64Array(3);
    const at = (t: number) => {
      ridePose(spec, track, body, t, t, out, ride);
      return Math.abs(out.z - body.z) + Math.abs(out.roll - body.roll);
    };
    expect(at(t0 - 10)).toBeGreaterThan(0);
    expect(at(t1 + 1)).toBe(0);
    expect(at(t1 + 300)).toBe(0);
  });
});

describe("the smaller wave", () => {
  const spec = waveShip();
  const { track, steps } = run(spec, "smaller");
  const g = rogueGroup(track.storm) as NonNullable<
    ReturnType<typeof rogueGroup>
  >;
  const t1 = waveStartT(g) + WAVE.rollS;

  it("is her rogue wave at its own height, out of her ride", () => {
    expect(g.heightM).toBe(WAVE.smaller.heightM);
    expect(g.ride).toBe(false);
  });

  it("peaks at its own degrees, then physics rights her", () => {
    const peak = Math.max(...steps.map((s) => s.roll));
    expect(peak / DEG).toBeCloseTo(WAVE.smaller.peakDeg, 6);
    const upright = steps.find(
      (s) =>
        s.t > t1 &&
        steps.slice(steps.indexOf(s)).every((r) => Math.abs(r.roll) < 10 * DEG)
    ) as Step;
    expect(upright).toBeDefined();
    expect(upright.t - t1).toBeLessThan(120);
    expect(events(track, "capsized")).toHaveLength(0);
    expect(events(track, "lights-out")).toHaveLength(0);
  });
});

describe("the wave from ahead", () => {
  const spec = waveShip();
  const { track, steps } = run(spec, "ahead");

  it("has no rule: she never rolls past 15°", () => {
    for (const s of steps) expect(Math.abs(s.roll)).toBeLessThan(15 * DEG);
    expect(events(track, "capsized")).toHaveLength(0);
  });

  it("is in her ride, from ahead, at its full height", () => {
    const storm = track.storm as StormSpec;
    expect(rogueGroup(storm)).toBeNull();
    const g = (storm.groups ?? [])[(storm.groups ?? []).length - 1];
    expect(g.dirDeg).toBe(0);
    expect(g.heightM).toBe(WAVE.heightM);
    expect(g.ride).toBeUndefined();
    const without: StormSpec = { ...storm, groups: [] };
    const a = new Float64Array(3);
    const b = new Float64Array(3);
    // A quarter wavelength from its crest: its slope is steepest there.
    const lambda = (9.81 * WAVE.periodS ** 2) / (2 * Math.PI);
    const x = (g.x ?? 0) + lambda / 4;
    waveRide(storm, 1, x, g.y ?? 0, spec, g.t, a);
    waveRide(without, 1, x, g.y ?? 0, spec, g.t, b);
    expect(Math.abs(a[1] - b[1]) / DEG).toBeGreaterThan(1);
    // Her swell keeps its ride (no fade from ahead).
    expect(swellFade(spec, storm, g.t + 100)).toBe(1);
  });
});

describe("a wave ship's What if", () => {
  const spec = waveShip();

  it("offers her spots and takes every one as real", () => {
    expect(whatIfSpots(spec)).toEqual(ALL);
    expect(whatIfRealIds(spec)).toEqual(ALL);
  });

  it("opens the chosen spots' openings, only forward ones from ahead", () => {
    const spots = spec.wave?.spots ?? [];
    expect(whatIfOpenings(spec, ["hold", "aft-win"])).toEqual([
      ...spots[0].openings,
      ...spots[1].openings,
    ]);
    expect(whatIfOpenings(spec, ALL, "smaller")).toEqual(
      whatIfOpenings(spec, ALL)
    );
    expect(whatIfOpenings(spec, ALL, "ahead")).toEqual(spots[2].openings);
    expect(whatIfOpenings(spec, ["hold"], "ahead")).toEqual([]);
    expect(waveOpenings(spec, [])).toEqual([]);
  });

  it("leaves every other ship's storm as it was", () => {
    const plain = { ...spec, wave: undefined };
    expect(stormOf(plain)?.groups).toBeUndefined();
    expect(stormOf(spec, "real")?.groups).toHaveLength(1);
  });

  it("is deterministic", () => {
    const a = simulate(spec, whatIfOpenings(spec, ALL), { endT: 120 });
    const b = simulate(spec, whatIfOpenings(spec, ALL), { endT: 120 });
    expect(a).toEqual(b);
  });
});
