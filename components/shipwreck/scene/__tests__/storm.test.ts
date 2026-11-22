import { QUALITY_TIERS } from "@/lib/shipwreck/playback";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { SCENE_SETTINGS } from "../settings";
import {
  ANDERSON,
  FITZGERALD_START,
  STORM_MIN_PX,
  STORM_PARTICLES,
  WHITEFISH_POINT,
  WRECK_SITE,
  andersonAsternM,
  geoToScene,
  snowAt,
  stormDaylight,
  stormSun,
  whitefishLit,
} from "../storm";
import { STREAK_DOTS } from "../stormEffects";

/** Shown seconds after 3:30 PM for h:mm PM. */
const pm = (h: number, m: number) => (h + 12 - 15) * 3600 + (m - 30) * 60;

describe("the Fitzgerald's scene settings", () => {
  it("is a storm at dusk: no sun disc, snow, her heading", () => {
    const s = SCENE_SETTINGS.fitzgerald;
    expect(s.timeOfDay).toBe("storm-dusk");
    expect(s.sun).toBeNull();
    expect(s.storm).toBe(true);
    expect(s.snow).toBe(true);
    expect(s.coast).toBe(false);
    expect(s.iceberg).toBe(false);
    expect(s.headingDeg).toBe(141);
  });
});

describe("the storm's light", () => {
  it("sets the sun about 5:05 PM Eastern on 10 November 1975 at her place", () => {
    // NOAA's calculator for 47.3° N, 85.4° W: sunset about 5:05 PM EST.
    let set = -1;
    for (let t = 0; t < 4 * 3600; t += 60)
      if (stormSun(t).elevationDeg < 0) {
        set = t;
        break;
      }
    expect(set).toBeGreaterThan(pm(4, 50));
    expect(set).toBeLessThan(pm(5, 20));
    // Low in the south-west at 3:30 PM.
    const s = stormSun(0);
    expect(s.elevationDeg).toBeGreaterThan(6);
    expect(s.elevationDeg).toBeLessThan(16);
    expect(s.azimuthDeg).toBeGreaterThan(205);
    expect(s.azimuthDeg).toBeLessThan(245);
  });

  it("is grey at 3:30 PM and fades to full dark by about 5:45 PM", () => {
    expect(stormDaylight(0)).toBeGreaterThan(0.35);
    expect(stormDaylight(0)).toBeLessThanOrEqual(1);
    let prev = Infinity;
    for (let t = 0; t <= pm(6, 0); t += 300) {
      const d = stormDaylight(t);
      expect(d).toBeLessThanOrEqual(prev + 1e-9);
      prev = d;
    }
    expect(stormDaylight(pm(5, 0))).toBeGreaterThan(0.05);
    expect(stormDaylight(pm(5, 45))).toBeLessThan(0.02);
    expect(stormDaylight(pm(7, 10))).toBe(0);
  });
});

describe("snow squalls", () => {
  it("come and go, heaviest before 7:15 PM, thin after it", () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let t = 0; t < pm(8, 0); t += 30) {
      const s = snowAt(t);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
      lo = Math.min(lo, s);
      hi = Math.max(hi, s);
    }
    expect(hi - lo).toBeGreaterThan(0.5);
    // The Anderson lost her in snow before 7:15 PM; it cleared about 7:20.
    expect(snowAt(pm(7, 5))).toBeGreaterThan(0.7);
    expect(snowAt(pm(7, 30))).toBeLessThan(0.35);
  });
});

describe("far lights", () => {
  it("puts Whitefish Point about 17 miles ahead of her wreck, a little to starboard", () => {
    const [x, z] = geoToScene(WHITEFISH_POINT.latDeg, WHITEFISH_POINT.lonDeg);
    const [wx, wz] = geoToScene(WRECK_SITE.latDeg, WRECK_SITE.lonDeg);
    const d = Math.hypot(x - wx, z - wz);
    expect(d).toBeGreaterThan(24000);
    expect(d).toBeLessThan(31000);
    // Ahead (+x) and a little to starboard (+z).
    const rel = (Math.atan2(z - wz, x - wx) * 180) / Math.PI;
    expect(rel).toBeGreaterThan(0);
    expect(rel).toBeLessThan(30);
    // The wreck lies on her course where the sim puts it (about 76 km on).
    expect(wx).toBeGreaterThan(70000);
    expect(wx).toBeLessThan(82000);
    expect(Math.abs(wz)).toBeLessThan(1500);
    // The scene's origin is her 3:30 PM place.
    const [ox, oz] = geoToScene(
      FITZGERALD_START.latDeg,
      FITZGERALD_START.lonDeg
    );
    expect(Math.hypot(ox, oz)).toBeLessThan(1);
  });

  it("keeps Whitefish Point's light out for her real night, lit in a calmer What if", () => {
    expect(whitefishLit(1)).toBe(false);
    expect(whitefishLit(1.25)).toBe(false);
    expect(whitefishLit(0.6)).toBe(true);
  });

  it("brings the Anderson up from about 17 miles astern to about 10 by 7 PM", () => {
    const mi = 1609.344;
    expect(andersonAsternM(pm(3, 35)) / mi).toBeCloseTo(17, 0);
    expect(andersonAsternM(pm(7, 0)) / mi).toBeCloseTo(10, 0);
    expect(andersonAsternM(pm(7, 10))).toBeLessThan(andersonAsternM(pm(7, 0)));
    expect(andersonAsternM(0)).toBeGreaterThan(andersonAsternM(pm(4, 0)));
    // Her lights: masthead and range lights, high, and her side lights.
    expect(ANDERSON.lights.length).toBeGreaterThanOrEqual(3);
    expect(fitzgerald.storm).toBeDefined();
  });
});

describe("storm particles per tier", () => {
  it("draws fewer and smaller at medium and low (iPads start at medium)", () => {
    const { high, medium, low } = STORM_PARTICLES;
    for (const q of QUALITY_TIERS) expect(STORM_PARTICLES[q]).toBeDefined();
    for (const key of [
      "snow",
      "streaks",
      "snowFar",
      "spray",
      "smoke",
      "plume",
      "pool",
    ] as const) {
      expect(medium[key]).toBeLessThan(high[key]);
      expect(low[key]).toBeLessThanOrEqual(medium[key]);
    }
    expect(medium.maxPx).toBeLessThanOrEqual(96);
    expect(low.maxPx).toBeLessThanOrEqual(medium.maxPx);
    // No flake drawn up to a pinpoint (night snow read as stars).
    expect(STORM_MIN_PX).toBeGreaterThanOrEqual(2);
    // Every share fits its pool.
    for (const q of QUALITY_TIERS) {
      const t = STORM_PARTICLES[q];
      // The most a frame can draw above water (the plume is under it),
      // the streaks at their cap (four more points each), fits the pool.
      expect(
        t.snow + STREAK_DOTS * t.streaks + t.snowFar + t.spray + t.smoke
      ).toBeLessThanOrEqual(t.pool);
      expect(t.plume).toBeLessThanOrEqual(t.pool);
    }
  });
});

describe("no allocation per frame", () => {
  it("gives the same sun for the same time (the scene asks several times a frame)", () => {
    const a = stormSun(1234);
    expect(stormSun(1234)).toBe(a);
    expect(stormDaylight(1234)).toBe(stormDaylight(1234));
    const b = stormSun(1235);
    expect(b).not.toBe(a);
    expect(b.elevationDeg).toBeLessThan(a.elevationDeg);
  });
});
