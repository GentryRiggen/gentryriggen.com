import { Color, LinearSRGBColorSpace } from "three";
import { SHIP_IDS } from "@/lib/shipwreck/ships";
import {
  buildCoastGeometry,
  coastToScene,
  COAST_FADE_TO_M,
  KEA_HEIGHT_SCALE,
} from "../Coast";
import {
  BRITANNIC_MINE,
  BRITANNIC_WRECK,
  DAY_LOOKS,
  dayLookOf,
  isDaylit,
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

describe("the Britannic's morning (1.4)", () => {
  it("keeps every other ship's scene exactly as it was", () => {
    expect(SCENE_SETTINGS.lusitania).toEqual({
      timeOfDay: "afternoon",
      sun: { elevationDeg: 50.01, azimuthDeg: 218.66 },
      fog: "#bccddb",
      underwaterFog: "#2f7564",
      coast: true,
      iceberg: false,
      headingDeg: 93,
    });
    expect(SCENE_SETTINGS.fitzgerald).toEqual({
      timeOfDay: "storm-dusk",
      sun: null,
      fog: "#6b7377",
      underwaterFog: "#1d302d",
      coast: false,
      iceberg: false,
      headingDeg: 141,
      storm: true,
      snow: true,
    });
    // The afternoon's look is the 1.1 constants.
    expect(dayLookOf(SCENE_SETTINGS.lusitania)).toBe(DAY_LOOKS.afternoon);
    expect(DAY_LOOKS.afternoon.fogDensity).toBe(0.000027);
    expect(DAY_LOOKS.afternoon.deepWater).toBe(0x0c3a33);
  });

  it("is a daylit morning off Kea with the sun computed for 8:12 AM EET", () => {
    const s = SCENE_SETTINGS.britannic;
    expect(s.timeOfDay).toBe("morning");
    expect(isDaylit(s)).toBe(true);
    expect(isDaylit(SCENE_SETTINGS.titanic)).toBe(false);
    expect(s.coast).toBe(true);
    expect(s.iceberg).toBe(false);
    expect(s.headingDeg).toBe(18);
    // 06:12 UTC (EET is UTC+2) at 37.7° N 24.3° E: about 10° up, ESE.
    expect(BRITANNIC_MINE.utcMs).toBe(Date.UTC(1916, 10, 21, 6, 12));
    const sun = sunPosition(
      BRITANNIC_MINE.latDeg,
      BRITANNIC_MINE.lonDeg,
      BRITANNIC_MINE.utcMs
    );
    expect(s.sun?.elevationDeg).toBeCloseTo(sun.elevationDeg, 1);
    expect(s.sun?.azimuthDeg).toBeCloseTo(sun.azimuthDeg, 1);
    expect(sun.elevationDeg).toBeGreaterThan(5);
    expect(sun.elevationDeg).toBeLessThan(15);
    expect(sun.azimuthDeg).toBeGreaterThan(110);
    expect(sun.azimuthDeg).toBeLessThan(135);
    // After her turn (heading about 88°) the sun is on her starboard bow.
    const d = sunDirection(s.sun!, 88);
    expect(d[0]).toBeGreaterThan(0);
    expect(d[2]).toBeGreaterThan(0);
    expect(dayLookOf(s)).toBe(DAY_LOOKS.morning);
  });

  it("draws Kea ahead to starboard after her turn, Attica and Makronisos low to port", () => {
    const g = buildCoastGeometry("britannic");
    const p = g.getAttribute("position");
    let top = 0;
    for (let i = 0; i < p.count; i += 1) {
      const d = Math.hypot(p.getX(i), p.getZ(i));
      if (d > COAST_FADE_TO_M) expect(p.getY(i)).toBeLessThan(0);
      top = Math.max(top, p.getY(i));
    }
    // Kea's hills reach about 560 m (Profitis Ilias, 568 m), drawn ×1.5.
    expect(top / KEA_HEIGHT_SCALE).toBeGreaterThan(450);
    expect(top / KEA_HEIGHT_SCALE).toBeLessThan(600);
    // Port St Nikolo light (37.6673 N 24.3139 E) from the mine: about
    // 7 km off, east-south-east (scene +z is starboard of her 18°).
    const [lx, lz] = coastToScene(37.6673, 24.3139, BRITANNIC_MINE);
    const lightBearing = (Math.atan2(lz, lx) * 180) / Math.PI + 18;
    expect(Math.hypot(lx, lz)).toBeGreaterThan(6000);
    expect(Math.hypot(lx, lz)).toBeLessThan(8000);
    expect(lightBearing).toBeGreaterThan(100);
    expect(lightBearing).toBeLessThan(125);
    // Her wreck (where the sim's run ends, about 4.2 km on) is about
    // 1.5–2.5 nmi from Kea's north-west shore: the light is ahead to
    // starboard of her new heading (88°).
    const [wx, wz] = coastToScene(
      BRITANNIC_WRECK.latDeg,
      BRITANNIC_WRECK.lonDeg,
      BRITANNIC_MINE
    );
    expect(Math.hypot(wx, wz)).toBeGreaterThan(3800);
    expect(Math.hypot(wx, wz)).toBeLessThan(4600);
    const rel = (Math.atan2(lz - wz, lx - wx) * 180) / Math.PI + 18 - 88;
    expect(rel).toBeGreaterThan(20);
    expect(rel).toBeLessThan(120);
    // Cape Sounion (37.650 N 24.026 E) lies to port, about 19 km off.
    const [sx, sz] = coastToScene(37.6501, 24.0263, BRITANNIC_MINE);
    expect(sz).toBeLessThan(0);
    expect(Math.hypot(sx, sz)).toBeGreaterThan(17000);
    expect(Math.hypot(sx, sz)).toBeLessThan(21000);
    g.dispose();
  });

  it("puts the scene's origin where her run ends at her wreck (within 300 m)", () => {
    // The sim's real run ends 2,575 m along 18° and 3,334 m to starboard.
    const [wx, wz] = coastToScene(
      BRITANNIC_WRECK.latDeg,
      BRITANNIC_WRECK.lonDeg,
      BRITANNIC_MINE
    );
    expect(Math.hypot(wx - 2575, wz - 3334)).toBeLessThan(300);
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
