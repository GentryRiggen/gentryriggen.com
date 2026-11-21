import { titanic } from "../../ships";
import type { ShipSpec } from "../../ships/types";
import { SIM_EVENT_KINDS } from "../events";
import { simulate } from "../run";
import type { BodyPose, SimTrack } from "../track";

/** Earth position of a ship-frame point for a pose: Rz·Ry·Rx. */
function earth(p: BodyPose, x: number, y: number, z: number) {
  const [cp, sp, cr, sr] = [
    Math.cos(p.pitch),
    Math.sin(p.pitch),
    Math.cos(p.roll),
    Math.sin(p.roll),
  ];
  const ex = cp * x + sp * sr * y + sp * cr * z;
  const ey = cr * y - sr * z;
  const ez = -sp * x + cp * sr * y + cp * cr * z;
  const [cy, sy] = [Math.cos(p.yaw), Math.sin(p.yaw)];
  return [p.x + cy * ex - sy * ey, p.y + sy * ex + cy * ey, p.z + ez];
}

/** Seconds after the 11:40 PM collision for a clock time after midnight. */
const at = (h: number, m: number) => (h * 60 + m + 20) * 60;
const DEG = Math.PI / 180;
const pctFromStern = (x: number) => ((x + titanic.lbp / 2) / titanic.lbp) * 100;

function breakup(track: SimTrack) {
  const e = track.events.find((ev) => ev.kind === "breakup");
  if (!e) throw new Error("no breakup");
  const before = track.frames.filter((f) => f.t < e.t);
  return { t: e.t, frame: before[before.length - 1], before };
}

describe("the real night", () => {
  let track: SimTrack;
  beforeAll(() => {
    track = simulate(titanic, titanic.realNight);
  });

  it("breaks between 2:05 and 2:25 AM between funnels 3 and 4", () => {
    const b = breakup(track);
    expect(track.brokeAtT).toBe(b.t);
    expect(b.t).toBeGreaterThanOrEqual(at(2, 5));
    expect(b.t).toBeLessThanOrEqual(at(2, 25));
    const x = track.breakX as number;
    expect(pctFromStern(x)).toBeGreaterThanOrEqual(35);
    expect(pctFromStern(x)).toBeLessThanOrEqual(45);
    const [, , f3, f4] = titanic.funnels;
    expect(x).toBeLessThan(f3.x);
    expect(x).toBeGreaterThan(f4.x);
  });

  it("breaks at a trim of 8–25°", () => {
    const { frame } = breakup(track);
    expect(frame.bodies[0].part).toBe("whole");
    expect(frame.trimDeg).toBeGreaterThanOrEqual(8);
    expect(frame.trimDeg).toBeLessThanOrEqual(25);
  });

  it("is wholly under between 2:10 and 2:30 AM", () => {
    const under = track.events.find((e) => e.kind === "stern-under");
    expect(under).toBeDefined();
    expect(track.sankAtT).toBe(under?.t);
    expect(track.sankAtT).toBeGreaterThanOrEqual(at(2, 10));
    expect(track.sankAtT).toBeLessThanOrEqual(at(2, 30));
  });

  it("never lists past 10° before the breakup", () => {
    const { before } = breakup(track);
    for (const f of before) expect(Math.abs(f.listDeg)).toBeLessThan(10);
  });

  it("ends with both halves on the floor", () => {
    expect(track.outcome).toBe("sank");
    const last = track.frames[track.frames.length - 1];
    expect(last.bodies.map((b) => b.part).sort()).toEqual(["bow", "stern"]);
    for (const b of last.bodies) {
      expect(b.z).toBeLessThan(-titanic.seaDepthM + 30);
      expect(b.z).toBeGreaterThan(-titanic.seaDepthM - 30);
      expect(Math.abs(b.pitch)).toBeLessThan(10 * DEG);
    }
    const kinds = track.events.map((e) => e.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(["bow-lands", "stern-lands", "lights-out"])
    );
  });

  it("falls without orbiting and ploughs in without sliding", () => {
    const stemX = titanic.stations[titanic.stations.length - 1].x;
    const sternMid = (titanic.stations[0].x + (track.breakX as number)) / 2;
    const landed = track.events.find((e) => e.kind === "bow-lands")?.t ?? 0;
    const after = track.frames.filter((f) => f.t >= landed);
    const stem0 = earth(
      after[0].bodies.find((b) => b.part === "bow")!,
      stemX,
      0,
      0
    );
    for (const f of after) {
      const stem = earth(
        f.bodies.find((b) => b.part === "bow")!,
        stemX,
        0,
        0
      );
      // The nose stays where it went in.
      expect(Math.hypot(stem[0] - stem0[0], stem[1] - stem0[1])).toBeLessThan(
        3
      );
    }
    // The plough eases in over seconds of real time (not a blink on screen):
    // a second after landing the stem is still well short of its full depth.
    const oneSecond = after.find((f) => f.realT >= after[0].realT + 1)!;
    const stem1 = earth(
      oneSecond.bodies.find((b) => b.part === "bow")!,
      stemX,
      0,
      0
    );
    const last = after[after.length - 1];
    const stemEnd = earth(
      last.bodies.find((b) => b.part === "bow")!,
      stemX,
      0,
      0
    );
    expect(stem0[2] - stem1[2]).toBeLessThan(0.5 * (stem0[2] - stemEnd[2]));
    // The stern's middle drifts slowly sideways while it spins and falls.
    const sunk = track.sankAtT as number;
    const falling = track.frames.filter((f) => f.t > sunk + 1);
    for (let i = 1; i < falling.length; i += 1) {
      const [a, b] = [falling[i - 1], falling[i]];
      const pa = earth(
        a.bodies.find((p) => p.part === "stern")!,
        sternMid,
        0,
        10
      );
      const pb = earth(
        b.bodies.find((p) => p.part === "stern")!,
        sternMid,
        0,
        10
      );
      const dt = b.realT - a.realT;
      if (dt <= 0) continue;
      expect(Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) / dt).toBeLessThan(3);
    }
  });

  it("tells the story in order, with only known events", () => {
    for (let i = 1; i < track.events.length; i += 1)
      expect(track.events[i].t).toBeGreaterThanOrEqual(track.events[i - 1].t);
    for (const e of track.events)
      expect(SIM_EVENT_KINDS as readonly string[]).toContain(e.kind);
    const count = (k: string) =>
      track.events.filter((e) => e.kind === k).length;
    expect(count("collision")).toBe(1);
    expect(count("rocket")).toBe(8);
    expect(count("boat-lowered")).toBe(20);
    expect(count("last-boat")).toBe(1);
    expect(count("funnel-falls")).toBe(4);
    const t = (k: string) => track.events.find((e) => e.kind === k)?.t ?? NaN;
    // ~2:00 forecastle at the water, then the bridge, then the break.
    expect(t("forecastle-under")).toBeGreaterThan(at(1, 45));
    expect(t("forecastle-under")).toBeLessThan(t("bridge-under"));
    expect(t("bridge-under")).toBeLessThan(t("breakup"));
    expect(t("lights-flicker")).toBeLessThanOrEqual(t("lights-out"));
    // The forward funnel falls first, before the break; the others after.
    const funnels = track.events.filter((e) => e.kind === "funnel-falls");
    expect(funnels.map((e) => e.index)).toEqual([0, 1, 2, 3]);
    expect(funnels[0].t).toBeLessThan(t("breakup"));
    // Events carry real time too; it runs ahead once the fall is sped up.
    for (const e of track.events) expect(e.realT).toBeGreaterThanOrEqual(e.t);
    const lands = track.events.find((e) => e.kind === "stern-lands");
    expect((lands?.realT ?? 0) - (lands?.t ?? 0)).toBeGreaterThan(30);
  });

  it("has frames every second while slow and ten a second while fast", () => {
    const f = track.frames;
    expect(f[0].t).toBe(0);
    expect(f[1].t - f[0].t).toBeCloseTo(1, 6);
    const b = breakup(track).t;
    const fast = f.filter((x) => x.t > b && x.t < b + 10);
    expect(fast.length).toBeGreaterThanOrEqual(90);
    for (const x of f) {
      expect(x.water).toHaveLength(titanic.compartments.length);
      for (const w of x.water) {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      }
      expect(x.power).toBeGreaterThanOrEqual(0);
      expect(x.power).toBeLessThanOrEqual(1);
    }
    // The way down is sped up, but the real time is kept.
    const last = f[f.length - 1];
    expect(last.realT).toBeGreaterThan(last.t);
  });

  it("is deterministic", () => {
    expect(simulate(titanic, titanic.realNight)).toEqual(track);
  });

  it.each([0.95, 1.05])(
    "still breaks inside 2:05–2:25 AM with %s× the girder strength",
    (f) => {
      const spec: ShipSpec = {
        ...titanic,
        girder: {
          hogMaxNm: titanic.girder.hogMaxNm * f,
          sagMaxNm: titanic.girder.sagMaxNm * f,
        },
      };
      const t = simulate(spec, spec.realNight);
      expect(t.brokeAtT).not.toBeNull();
      expect(t.brokeAtT as number).toBeGreaterThanOrEqual(at(2, 5));
      expect(t.brokeAtT as number).toBeLessThanOrEqual(at(2, 25));
      const pct = pctFromStern(t.breakX as number);
      expect(pct).toBeGreaterThanOrEqual(35);
      expect(pct).toBeLessThanOrEqual(45);
    }
  );
});
