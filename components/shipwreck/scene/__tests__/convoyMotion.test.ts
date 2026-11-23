import { buildSteamerGeometry, STEAMER_LENGTH_M } from "../Convoy";
import {
  CONVOY,
  convoyFade,
  CONVOY_MPS,
  convoyPose,
  convoyShown,
  hullDownM,
  scatterAtOf,
} from "../convoyMotion";

describe("the Carpathia's convoy (R12)", () => {
  it("is the six others of the seven she led", () => {
    expect(CONVOY).toHaveLength(6);
  });

  it("keeps station at convoy speed before the hit", () => {
    for (const ship of CONVOY) {
      const a = convoyPose(ship, -40, 0);
      const b = convoyPose(ship, 0, 0);
      expect(b.x - a.x).toBeCloseTo(CONVOY_MPS * 40, 6);
      expect(a.z).toBe(ship.station[1]);
      expect(b.x).toBe(ship.station[0]);
      expect(a.heading).toBe(0);
    }
  });

  it("steams on in formation with no hit", () => {
    const p = convoyPose(CONVOY[0], 3600, null);
    expect(p.heading).toBe(0);
    expect(p.z).toBe(CONVOY[0].station[1]);
  });

  it("turns away and works up to full speed after the hit", () => {
    for (const ship of CONVOY) {
      const p = convoyPose(ship, 1200, 0);
      expect(p.heading).toBeCloseTo((ship.scatterDeg * Math.PI) / 180, 9);
      expect(p.speed).toBeCloseTo(ship.fullMps, 9);
      // Turning to starboard moves her to starboard (+z), and to port, port.
      expect(Math.sign(p.z - ship.station[1])).toBe(Math.sign(ship.scatterDeg));
    }
  });

  it("moves continuously (no jump through the turn or the ramp)", () => {
    for (const ship of CONVOY) {
      for (let t = -40; t < 1500; t += 0.5) {
        const a = convoyPose(ship, t, 0);
        const b = convoyPose(ship, t + 0.5, 0);
        const step = Math.hypot(b.x - a.x, b.z - a.z);
        expect(step).toBeLessThanOrEqual(ship.fullMps * 0.5 + 1e-6);
        expect(step).toBeGreaterThan(CONVOY_MPS * 0.5 * 0.99);
      }
    }
  });

  it("never comes near her, nor near another, as they scatter", () => {
    for (let t = -40; t < 3600; t += 5) {
      const ps = CONVOY.map((s) => convoyPose(s, t, 0));
      for (const p of ps) {
        // She stops within about 450 m of the hit (60 s half-life of 10 kn).
        expect(Math.hypot(p.x - 300, p.z)).toBeGreaterThan(1200);
      }
      for (let i = 0; i < ps.length; i += 1)
        for (let j = i + 1; j < ps.length; j += 1)
          expect(
            Math.hypot(ps[i].x - ps[j].x, ps[i].z - ps[j].z)
          ).toBeGreaterThan(800);
    }
  });

  it("follows the first hit's time (a What-if's first torpedo)", () => {
    const late = convoyPose(CONVOY[2], 600, 500);
    const early = convoyPose(CONVOY[2], 100, 0);
    expect(late.x).toBeCloseTo(early.x + CONVOY_MPS * 500, 6);
    expect(late.z).toBeCloseTo(early.z, 6);
    expect(scatterAtOf([{ t: 8 }, { t: 0 }, { t: 5700 }])).toBe(0);
    expect(scatterAtOf([])).toBeNull();
  });

  it("is far off by 10:00 and gone over the horizon well before she sinks", () => {
    const eye = 25;
    const dist = (t: number) =>
      CONVOY.map((s) => {
        const p = convoyPose(s, t, 0);
        return Math.hypot(p.x, p.z);
      });
    // 10:00 AM: every one more than 12 km off.
    for (const d of dist(45 * 60)) expect(d).toBeGreaterThan(12000);
    // 10:40 AM (10 min before the third torpedo): none drawn.
    for (const d of dist(85 * 60))
      expect(convoyShown(d, hullDownM(d, eye))).toBe(false);
  });

  it("hull-down: nothing inside the horizon, then the earth's curve", () => {
    expect(hullDownM(5000, 20)).toBe(0);
    // An eye 20 m up sees the sea's edge about 17.2 km off (7/6 earth).
    expect(hullDownM(17000, 20)).toBe(0);
    expect(hullDownM(27200, 20)).toBeCloseTo(6.7, 0);
  });

  it("fades into the haze from 22 km and is gone at 28 km", () => {
    expect(convoyFade(10000)).toBe(0);
    expect(convoyFade(25000)).toBeGreaterThan(0);
    expect(convoyFade(28000)).toBe(1);
    expect(convoyShown(27999, 0)).toBe(true);
    expect(convoyShown(28000, 0)).toBe(false);
  });

  it("is one cheap steamer shape, her length, bow at +x", () => {
    const g = buildSteamerGeometry();
    const tris = g.getAttribute("position").count / 3;
    expect(tris).toBeLessThan(500);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.max.x - b.min.x).toBeCloseTo(STEAMER_LENGTH_M, 0);
    expect(b.max.y).toBeGreaterThan(25); // the masthead
    expect(b.min.y).toBeLessThan(0); // under the waterline
    const part = g.getAttribute("aPart");
    for (let i = 0; i < part.count; i += 1)
      expect([0, 1, 2, 3]).toContain(part.getX(i));
  });
});
