import { poseidon } from "../../ships";
import { type Body, rotate } from "../body";
import { simulate } from "../run";
import type { BodyPose, SimTrack } from "../track";

/**
 * The Poseidon's real night (spec "Pass criteria"): the wave at 23:58, the
 * roll rule past keel up, the blackout, keel up on her trapped air, the
 * ballroom flooding, her air leaking away, the dive keel up to the
 * 4,000 m floor. One run, shared by every test.
 */

const DEG = Math.PI / 180;
const MIN = 60;

/** Her list wrapped to 0..360 (roll is unwrapped). */
const list360 = (deg: number) => ((deg % 360) + 360) % 360;
/** Earth z of a ship-frame point at a pose. */
const earthZ = (p: BodyPose, x: number, y: number, z: number) =>
  p.z + rotate(p.pitch, p.roll, x, y, z)[2];
/** Her keel amidships and her propellers (ship frame). */
const KEEL: [number, number, number] = [0, 0, 0];
const PROPS: [number, number, number][] = [
  [-118, 5, 3],
  [-118, -5, 3],
];

let track: SimTrack;
/** Total air aboard (atm·m³) after each step, from the wave on. */
const airs: { t: number; m: number }[] = [];
/** The hull's air's lift over her weight at 10 real minutes. */
let lift10 = -1;
let realOf: (t: number) => number = (t) => t;

beforeAll(() => {
  const tc = 25;
  const shown10 = tc + (10 * MIN - tc) / (poseidon.capsizeTimeScale ?? 1);
  track = simulate(poseidon, poseidon.realNight, {
    probe: (p) => {
      if (p.bodies.length > 1) return;
      const b = p.bodies[0] as Body;
      const air = b.air;
      if (!air || b.mode !== "float") return;
      let m = 0;
      for (let i = 0; i < b.all.length; i += 1) {
        m += air.mass[i];
      }
      airs.push({ t: p.t, m });
      if (lift10 < 0 && p.t >= shown10) {
        let v = 0;
        for (const c of b.cells) v += Math.max(0, c.seaVol - c.water);
        lift10 = (v * b.rho) / b.lightMass;
      }
    },
  });
  const cap = track.events.find((e) => e.kind === "capsized")!;
  const scale = poseidon.capsizeTimeScale ?? 1;
  realOf = (t) => (t <= cap.t ? t : cap.t + (t - cap.t) * scale);
});

const ev = (kind: string) => track.events.filter((e) => e.kind === kind);
const frameAt = (t: number) =>
  track.frames.find((f) => f.t >= t) ?? track.frames[track.frames.length - 1];

describe("the Poseidon's real night", () => {
  it("meets the wave at t = 0 and rolls over by the rule", () => {
    expect(ev("collision")[0].t).toBe(0);
    expect(list360(frameAt(15).listDeg)).toBeGreaterThanOrEqual(90);
    expect(
      list360(frameAt(poseidon.wave!.rollS).listDeg)
    ).toBeGreaterThanOrEqual(150);
    expect(ev("capsized")).toHaveLength(1);
  });

  it("loses her power between 3 and 20 s, then shows her emergency lights", () => {
    const out = ev("lights-out");
    expect(out).toHaveLength(1);
    expect(out[0].t).toBeGreaterThanOrEqual(3);
    expect(out[0].t).toBeLessThanOrEqual(20);
    for (const f of track.frames.filter((f) => f.t > out[0].t + 1)) {
      expect(f.power).toBeGreaterThan(0);
      expect(f.power).toBeCloseTo(poseidon.blackout!.emergencyLight, 6);
    }
  });

  it("floats keel up (165°–195°), keel and propellers in the air, for at least 20 real minutes", () => {
    const cap = ev("capsized")[0].t;
    // Afloat: from the hand-off until the first part goes under.
    const under = Math.min(
      ...[...ev("bow-under"), ...ev("stern-under")].map((e) => e.t)
    );
    let keelUp = 0;
    let dry = 0;
    const fr = track.frames;
    for (let i = 1; i < fr.length; i += 1) {
      const f = fr[i];
      if (f.t <= cap || f.t > under || f.bodies.length !== 1) continue;
      const dt = f.realT - fr[i - 1].realT;
      const l = list360(f.listDeg);
      if (l >= 165 && l <= 195) keelUp += dt;
      const p = f.bodies[0];
      if (earthZ(p, ...KEEL) > 0 && PROPS.every((q) => earthZ(p, ...q) > 0))
        dry += dt;
    }
    expect(keelUp).toBeGreaterThanOrEqual(20 * MIN);
    expect(dry).toBeGreaterThanOrEqual(20 * MIN);
  });

  it("fills the ballroom at least 90% within 5 real minutes", () => {
    const k = poseidon.superstructure.findIndex((s) => s.id === "ballroom");
    const f = track.frames.find((f) => (f.boxWater?.[k] ?? 0) >= 0.9);
    expect(f).toBeDefined();
    expect(f!.realT).toBeLessThanOrEqual(5 * MIN);
  });

  it("holds her up on trapped air: it only falls from the wave on, and carries half her weight at 10 minutes", () => {
    // Her total air never rises, step to step, while she floats (no air
    // in from the sea), but for rounding (1e-9 of it).
    const after = airs.filter((a) => a.t > 0.5);
    expect(after.length).toBeGreaterThan(100);
    const eps = 1e-9 * after[0].m;
    for (let i = 1; i < after.length; i += 1)
      expect(after[i].m).toBeLessThanOrEqual(after[i - 1].m + eps);
    expect(lift10).toBeGreaterThanOrEqual(0.5);
  });

  it("goes under 35–60 real minutes after the wave, whole, and sinks", () => {
    const under = [...ev("bow-under"), ...ev("stern-under")].sort(
      (a, b) => a.t - b.t
    )[0];
    expect(under).toBeDefined();
    const real = under.realT ?? realOf(under.t);
    expect(real).toBeGreaterThanOrEqual(35 * MIN);
    expect(real).toBeLessThanOrEqual(60 * MIN);
    expect(ev("breakup")).toHaveLength(0);
    expect(track.outcome).toBe("sank");
  });

  it("stays at least 90° from upright from capsized to her rest (the keel-under and dive rules)", () => {
    const cap = ev("capsized")[0].t;
    for (const f of track.frames.filter((f) => f.t >= cap)) {
      const l = list360(f.listDeg);
      expect(Math.min(l, 360 - l)).toBeGreaterThanOrEqual(90);
    }
  });

  it("lands keel up (180 ± 10°) on the 4,000 m floor", () => {
    const last = track.frames[track.frames.length - 1];
    expect(last.bodies).toHaveLength(1);
    const l = list360(last.listDeg);
    expect(Math.abs(l - 180)).toBeLessThanOrEqual(10);
    expect(last.groundedParts).toContain("whole");
    const p = last.bodies[0];
    expect(earthZ(p, ...KEEL)).toBeLessThan(-poseidon.seaDepthM + 80);
  });

  it("plays in at most 15 shown minutes from the first frame to her rest, inside endS", () => {
    const last = track.frames[track.frames.length - 1];
    expect(last.t + (poseidon.preRollS ?? 0)).toBeLessThanOrEqual(15 * MIN);
    expect(track.endT).toBeLessThanOrEqual(poseidon.endS!);
  });

  it("is deterministic, finite and smooth keel up (no pose jitter at 0.6 s steps)", () => {
    const again = simulate(poseidon, poseidon.realNight);
    expect(again.events).toEqual(track.events);
    expect(again.frames.length).toBe(track.frames.length);
    expect(again.frames[again.frames.length - 1]).toEqual(
      track.frames[track.frames.length - 1]
    );
    for (const f of track.frames)
      for (const b of f.bodies)
        for (const v of [b.x, b.y, b.z, b.pitch, b.roll, b.yaw])
          expect(Number.isFinite(v)).toBe(true);
    // Keel up and afloat (a minute after the hand-off to three real
    // minutes before she goes under): frame to frame her roll moves under
    // 0.5° and never reverses by more than 0.05°.
    const under = ev("bow-under")[0] ?? ev("stern-under")[0];
    const fr = track.frames.filter(
      (f) => f.realT > 85 && f.t < under.t - 30 && f.bodies.length === 1
    );
    for (let i = 2; i < fr.length; i += 1) {
      const d1 = fr[i - 1].bodies[0].roll - fr[i - 2].bodies[0].roll;
      const d2 = fr[i].bodies[0].roll - fr[i - 1].bodies[0].roll;
      expect(Math.abs(d2)).toBeLessThan(0.5 * DEG);
      if (d1 * d2 < 0) expect(Math.abs(d2)).toBeLessThan(0.05 * DEG);
    }
  });
});
