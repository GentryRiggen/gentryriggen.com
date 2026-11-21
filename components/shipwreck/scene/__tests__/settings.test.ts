import { Color, LinearSRGBColorSpace } from "three";
import { SHIP_IDS } from "@/lib/shipwreck/ships";
import { buildCoastGeometry, coastToScene, COAST_FADE_TO_M } from "../Coast";
import {
  NIGHT_FOG,
  NIGHT_SEA_FOG,
  SCENE_SETTINGS,
  sunDirection,
  sunPosition,
  LUSITANIA_HIT,
} from "../settings";

describe("SCENE_SETTINGS", () => {
  it("has a scene for every ship", () => {
    for (const id of SHIP_IDS) expect(SCENE_SETTINGS[id]).toBeDefined();
  });

  it("keeps the Titanic's night exactly as 1.0 had it", () => {
    // 1.0's constants, written out: the starlit horizon (linear) and the
    // blue-black water.
    const fog1 = new Color().setRGB(0.014, 0.0195, 0.032, LinearSRGBColorSpace);
    expect(NIGHT_FOG.equals(fog1)).toBe(true);
    expect(NIGHT_SEA_FOG.getHex()).toBe(0x02121c);
    expect(SCENE_SETTINGS.titanic).toEqual({
      timeOfDay: "night",
      sun: null,
      fog: `#${fog1.getHexString()}`,
      underwaterFog: "#02121c",
      coast: false,
      iceberg: true,
    });
  });

  it("gives the Lusitania her sunny afternoon off the coast", () => {
    const s = SCENE_SETTINGS.lusitania;
    expect(s.timeOfDay).toBe("afternoon");
    expect(s.coast).toBe(true);
    expect(s.iceberg).toBe(false);
    expect(s.sun).not.toBeNull();
    // The sun is the one computed for the place and the hour.
    const sun = sunPosition(
      LUSITANIA_HIT.latDeg,
      LUSITANIA_HIT.lonDeg,
      LUSITANIA_HIT.utcMs
    );
    expect(s.sun?.elevationDeg).toBeCloseTo(sun.elevationDeg, 1);
    expect(s.sun?.azimuthDeg).toBeCloseTo(sun.azimuthDeg, 1);
  });
});

describe("sunPosition", () => {
  it("puts the sun about 50° up in the south-south-west at 2:10 PM on 7 May 1915, 51.4° N", () => {
    const sun = sunPosition(
      LUSITANIA_HIT.latDeg,
      LUSITANIA_HIT.lonDeg,
      LUSITANIA_HIT.utcMs
    );
    expect(sun.elevationDeg).toBeGreaterThan(48);
    expect(sun.elevationDeg).toBeLessThan(55);
    expect(sun.azimuthDeg).toBeGreaterThan(200);
    expect(sun.azimuthDeg).toBeLessThan(230);
  });

  it("matches known positions (NOAA calculator)", () => {
    // Greenwich, the June solstice at noon: 62° up, due south.
    const june = sunPosition(51.4769, 0, Date.UTC(2000, 5, 21, 12, 0));
    expect(june.elevationDeg).toBeCloseTo(61.96, 0);
    expect(Math.abs(june.azimuthDeg - 180)).toBeLessThan(1.5);
    // The equator at the March equinox, 6 AM local: on the eastern horizon.
    const dawn = sunPosition(0, 0, Date.UTC(2023, 2, 20, 6, 7));
    expect(Math.abs(dawn.elevationDeg)).toBeLessThan(1);
    expect(dawn.azimuthDeg).toBeCloseTo(90, 0);
  });
});

describe("sunDirection", () => {
  it("turns a true bearing into the scene's axes (x her heading, z starboard)", () => {
    // Heading due east: north is on her port side (-z), south to starboard.
    const north = sunDirection({ elevationDeg: 0, azimuthDeg: 0 }, 90);
    expect(north[0]).toBeCloseTo(0, 5);
    expect(north[2]).toBeCloseTo(-1, 5);
    const up = sunDirection({ elevationDeg: 90, azimuthDeg: 0 }, 90);
    expect(up[1]).toBeCloseTo(1, 5);
    // Her afternoon: the sun is abaft her starboard beam.
    const s = SCENE_SETTINGS.lusitania;
    const d = sunDirection(s.sun!, s.headingDeg!);
    expect(d[0]).toBeLessThan(0);
    expect(d[2]).toBeGreaterThan(0);
    expect(Math.hypot(d[0], d[1], d[2])).toBeCloseTo(1, 6);
  });
});

describe("the coast", () => {
  it("stays inside the camera's far plane (42 km), its ends under the sea", () => {
    const g = buildCoastGeometry();
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i += 1) {
      const d = Math.hypot(p.getX(i), p.getZ(i));
      if (d > 40000) expect(p.getY(i)).toBeLessThan(0);
      if (d > COAST_FADE_TO_M) expect(p.getY(i)).toBeLessThan(0);
    }
    // The Old Head bears north by east (about 13° true) from where she was
    // hit, about 21 km off (scene -z is 3° west of north at heading 93°).
    const [x, z] = coastToScene(51.6036, -8.5322);
    expect(Math.hypot(x, z)).toBeGreaterThan(19000);
    expect(Math.hypot(x, z)).toBeLessThan(23000);
    const trueBearing = (Math.atan2(x, -z) * 180) / Math.PI + 3;
    expect(trueBearing).toBeGreaterThan(8);
    expect(trueBearing).toBeLessThan(18);
    g.dispose();
  });
});
