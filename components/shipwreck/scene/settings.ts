import { Color, LinearSRGBColorSpace } from "three";
import type { ShipId } from "@/lib/shipwreck/ships/types";

/**
 * Each ship's scene: the hour, the sun, the fog above and below the sea,
 * the coast and the iceberg. The Titanic's night is exactly 1.0's (its
 * constants live here and the scene reads them); the Lusitania's afternoon
 * is 2:10 PM on 7 May 1915, about 11 nautical miles south of the Old Head
 * of Kinsale, with the sun worked out for the place and the hour; the
 * Carpathia's morning is 9:15 AM on 17 July 1918 at her wreck, west of
 * Fastnet, on the same daylight pipeline in her own colours; the
 * Britannic's morning is 8:12 AM on 21 November 1916 in the Kea Channel.
 */

export interface SunAngles {
  /** Degrees above the horizon. */
  elevationDeg: number;
  /** True bearing, degrees clockwise from north. */
  azimuthDeg: number;
}

/** A linear RGB colour (as three.js `setRGB` in the linear space). */
export type LinearRGB = readonly [number, number, number];

/**
 * A daylight scene's colours and haze where a ship's differ from the
 * Lusitania's afternoon (`LUSITANIA_DAYLIGHT`, the 1.1 values the scene
 * kept as constants). Visual only: the sim's water is calm.
 */
export interface DaylightLook {
  /** The sky overhead, and the high sky the sea reflects (linear). */
  zenith: LinearRGB;
  /** The haze's exp² density over the sea (1/m). */
  hazeDensity: number;
  /** The sea's body, its sunlit scatter and the light seen under it (linear). */
  seaDeep: LinearRGB;
  seaScatter: LinearRGB;
  seaUnder: LinearRGB;
  /** Under water: the colour toward the floor (sRGB hex). */
  deepWater: string;
  /** Under water: the exp² density just under the surface and at the floor. */
  underDensity: readonly [number, number];
  /** The sun's colour under water (sRGB hex). */
  sunUnder: string;
  /** The shafts of sunlight under water (linear, additive). */
  shafts: LinearRGB;
  /** The floor's tint over its sand texture (sRGB hex). */
  floor: string;
  /** The sunlight's ripples on the floor (emissive strength at the top). */
  caustics: number;
  /** The sun (a directional light) above the water: colour and strength. */
  sunColor: number;
  sunIntensity: number;
  /**
   * The sky light (the "skylight" hemisphere) above the water: sky and
   * ground colours and strength. A low morning sun leaves the side away
   * from it in shade; a stronger fill, with light off the sea from below,
   * keeps her shaded side's paint reading (the Britannic branch's
   * `DayLook` uses the same names).
   */
  skyColor: number;
  skyGround: number;
  skyIntensity: number;
  /**
   * The sea's ripple strength (the shader's slope scale; the Lusitania's
   * calm afternoon 0.34). Missing: 0.34. A look only: the sea stays flat.
   */
  ripple?: number;
  /**
   * Broken cloud in the day sky: the share of it covered (0–1). Missing:
   * a clear sky (the Lusitania's and the Britannic's programs unchanged).
   */
  clouds?: number;
  /**
   * Small whitecaps on the sea: the share of the surface white at any
   * moment (Beaufort 4, "fairly frequent white horses", a few percent).
   * Missing: none. A look only.
   */
  whitecaps?: number;
  /**
   * How much of the high tier's planar reflection (the ship, the clouds)
   * the sea shows over its own sky gradient, 0–1. A moderate sea's
   * ripples break a mirror image up. Missing: all of it (1.1's).
   */
  mirror?: number;
}

/** The Lusitania's afternoon (1.1's constants, written out once). */
export const LUSITANIA_DAYLIGHT: DaylightLook = {
  zenith: [0.045, 0.16, 0.55],
  hazeDensity: 0.000027,
  seaDeep: [0.008, 0.036, 0.05],
  seaScatter: [0.012, 0.05, 0.05],
  seaUnder: [0.22, 0.5, 0.44],
  deepWater: "#0c3a33",
  underDensity: [0.0085, 0.0125],
  sunUnder: "#9fe0cf",
  shafts: [0.55, 0.85, 0.7],
  floor: "#c8bc9e",
  caustics: 0.12,
  sunColor: 0xfff0d8,
  sunIntensity: 4,
  skyColor: 0xa9c8ee,
  skyGround: 0x2f4a4c,
  skyIntensity: 0.75,
};

export interface SceneSettings {
  /**
   * "afternoon" is the daylight pipeline (the Lusitania's afternoon, and
   * the Carpathia's morning: the name is 1.1's, kept so the other ships'
   * settings do not move): the sun from `sun`, the day sky, the sunlit sea.
   * "storm-dusk" (the Fitzgerald): a November storm from grey late
   * afternoon to black night (`storm.ts`): no sun disc, the light from
   * `stormDaylight`, the sea from her track's storm. "morning" (the
   * Britannic): drawn like the afternoon (`isDaylit`) with its own sun,
   * sea, coast and water (`DAY_LOOKS.morning`).
   */
  timeOfDay: "night" | "afternoon" | "storm-dusk" | "morning";
  sun: SunAngles | null;
  /** The haze at the horizon above the sea (sRGB hex). */
  fog: string;
  /** The water's colour just under the surface (sRGB hex). */
  underwaterFog: string;
  coast: boolean;
  iceberg: boolean;
  /** Her true heading at the first event (the scene's +x), degrees. */
  headingDeg?: number;
  /** The sea drawn from her track's storm (`SimTrack.storm`), no mirror. */
  storm?: true;
  /** Snow squalls drifting on the wind (`snowAt`). */
  snow?: true;
  /** Daylight colours of her own (missing: `LUSITANIA_DAYLIGHT`). */
  daylight?: DaylightLook;
  /** Her convoy on the horizon, scattering after the hit (`convoyMotion.ts`). */
  convoy?: true;
}

// --- The night of 14–15 April 1912 (1.0's constants).

/** The sky's colour at the horizon (linear), so the sea fades into it. */
export const NIGHT_FOG = new Color().setRGB(
  0.014,
  0.0195,
  0.032,
  LinearSRGBColorSpace
);
/** Just under the surface, and deep down. */
export const NIGHT_SEA_FOG = new Color(0x02121c);
export const NIGHT_DEEP_FOG = new Color(0x020a14);

/** The Fitzgerald's course for Whitefish Point, true (USCG, NTSB). */
export const FITZGERALD_HEADING_DEG = 141;

// --- The afternoon of 7 May 1915.

/**
 * Where and when the torpedo struck: about 11 nautical miles south of the
 * Old Head of Kinsale, 2:10 PM. The scene's origin is her position at the
 * hit, not her wreck (51°25′ N, 8°33′ W): she ran on about 3.8 km to the
 * east before she went down, so the hit lies about 0.055° of longitude
 * west of it. Her 2:10 PM is GMT: U-20's log gives the hit at 15:10
 * Central European Time, which is 14:10 GMT. (Had her clocks kept Dublin
 * Mean Time, 25 minutes behind, 2:10 PM would be 14:35 GMT and the sun
 * about 47.4° up at 226.8°.)
 */
export const LUSITANIA_HIT = {
  latDeg: 51.419,
  lonDeg: -8.603,
  utcMs: Date.UTC(1915, 4, 7, 14, 10),
  /**
   * S 87° E: the course she had come back to after taking her bearing on
   * the Old Head (Mersey inquiry), so the coast lies on her port beam.
   */
  headingDeg: 93,
} as const;

// --- The morning of 17 July 1918.

/**
 * Where and when the first torpedo struck the Carpathia: her wreck's
 * surveyed position, 49°30.03′ N 10°43.04′ W (cunardshipwrecks.com dive
 * data; spec R6: the Snowdrop's, uboat.net's and GOL's positions are in
 * the sim README), at 9:15 AM read as British Summer Time (GMT+1, in force
 * in 1918): 08:15 GMT. The sun is then about 30° up, due east. (Read as
 * GMT, 9:15 AM would put it about 39.6° up at 104°.) She sank about 500 m
 * east of where she was struck, close enough for one place.
 */
export const CARPATHIA_HIT = {
  latDeg: 49 + 30.03 / 60,
  lonDeg: -(10 + 43.04 / 60),
  utcMs: Date.UTC(1918, 6, 17, 8, 15),
  /**
   * Due west: bound for Boston from Liverpool, zig-zagging with what was
   * left of convoy OL 24 (no source gives her course; ours). The great
   * circle to Boston leaves the place at about 284°, the rhumb line at
   * about 260°; 270° lies between, so her port side, where the torpedoes
   * struck, faces south and the morning sun is nearly astern.
   */
  headingDeg: 270,
} as const;

/** Degrees and radians. */
const RAD = Math.PI / 180;

/**
 * The sun's place in the sky (NOAA's solar position algorithm, from Meeus;
 * good to about 0.01° for these centuries; no refraction).
 * `lonDeg` is + east.
 */
export function sunPosition(
  latDeg: number,
  lonDeg: number,
  utcMs: number
): SunAngles {
  const jd = utcMs / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 =
    (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = M * RAD;
  const C =
    Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mr) * 0.000289;
  const omega = (125.04 - 1934.136 * T) * RAD;
  const lambda = (L0 + C - 0.00569 - 0.00478 * Math.sin(omega)) * RAD;
  const eps0 =
    23 +
    (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = (eps0 + 0.00256 * Math.cos(omega)) * RAD;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const y = Math.tan(eps / 2) ** 2;
  const L0r = L0 * RAD;
  const eotMin =
    (4 / RAD) *
    (y * Math.sin(2 * L0r) -
      2 * e * Math.sin(Mr) +
      4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) -
      0.5 * y * y * Math.sin(4 * L0r) -
      1.25 * e * e * Math.sin(2 * Mr));
  const minutes = (((utcMs / 60000) % 1440) + 1440) % 1440;
  const solarMin = minutes + eotMin + 4 * lonDeg;
  const hourAngle = (solarMin / 4 - 180) * RAD;
  const lat = latDeg * RAD;
  const cosZen =
    Math.sin(lat) * Math.sin(decl) +
    Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZen)));
  const az =
    Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)
    ) /
      RAD +
    180;
  return { elevationDeg: 90 - zen / RAD, azimuthDeg: ((az % 360) + 360) % 360 };
}

/**
 * A direction given as a true bearing and elevation, in the scene's axes:
 * x along her heading at the first event, y up, z to starboard.
 */
export function sunDirection(
  sun: SunAngles,
  headingDeg: number
): [number, number, number] {
  return sunDirectionInto(sun, headingDeg, [0, 0, 0]);
}

/** As `sunDirection`, written into `out` (no allocation). */
export function sunDirectionInto(
  sun: SunAngles,
  headingDeg: number,
  out: [number, number, number]
): [number, number, number] {
  const rel = (sun.azimuthDeg - headingDeg) * RAD;
  const el = sun.elevationDeg * RAD;
  out[0] = Math.cos(rel) * Math.cos(el);
  out[1] = Math.sin(el);
  out[2] = Math.sin(rel) * Math.cos(el);
  return out;
}

// --- The morning of 21 November 1916.

/**
 * Where and when the mine went off: the scene's origin is her place at
 * 8:12 AM, worked back from her wreck (37°42′05″ N 24°17′02″ E [WP]) along
 * her track (the sim's real run: 4.2 km to the east-north-east, most of
 * it after her turn), which puts the mine about 3.8 nautical miles
 * N 70° W of Port St Nikolo light (sim README, "Her run for Kea":
 * [FI] 3 miles N 48° W, Divernet 4 nmi). Her clock is EET (UTC+2), as
 * the sources give it; `BRITANNIC_WRECK` is where she lies.
 */
export const BRITANNIC_MINE = {
  latDeg: 37.6886,
  lonDeg: 24.2388,
  utcMs: Date.UTC(1916, 10, 21, 6, 12),
  /** N 18° E: her course up the Kea Channel for Mudros (sim README). */
  headingDeg: 18,
} as const;
export const BRITANNIC_HEADING_DEG = BRITANNIC_MINE.headingDeg;
export const BRITANNIC_WRECK = { latDeg: 37.70139, lonDeg: 24.28389 } as const;

/** Day scenes that are drawn in daylight (the afternoon and the morning). */
export function isDaylit(s: Pick<SceneSettings, "timeOfDay">): boolean {
  return s.timeOfDay === "afternoon" || s.timeOfDay === "morning";
}

/**
 * The colours and lights of a daylit scene (sRGB hex unless "linear"):
 * the afternoon's are the Lusitania's 1.1 constants exactly; the morning
 * is a low warm sun over the deep-blue Aegean, clear blue water and a
 * pale sand-and-mud floor.
 */
export interface DayLook {
  /** The haze above the sea (exp² density). */
  fogDensity: number;
  /** The water deep down (under-water fog toward the floor). */
  deepWater: number;
  sunColor: number;
  /** The sun's colour above the water (the afternoon's a touch paler). */
  warm: number;
  sunIntensity: number;
  /** The sun's colour under water. */
  sunUnder: number;
  skyColor: number;
  skyGround: number;
  /**
   * The sky light's strength above the water (the hemisphere): the
   * morning's is stronger, with light off the sea from below, so her
   * white hull reads white on its shaded side under a 10° sun.
   */
  skyIntensity: number;
  /** The sky dome: the sun's glow (linear) and the blue overhead. */
  skySun: [number, number, number];
  zenith: [number, number, number];
  /** A warm glow along the horizon under a low sun (linear; 0 none). */
  dawnGlow: [number, number, number];
  /** The sea shader (linear): deep, lit from within, under it. */
  seaDeep: [number, number, number];
  seaScatter: [number, number, number];
  seaUnder: [number, number, number];
  /** The floor's tint and its canvas base colour. */
  floorColor: number;
  floorBase: string;
  /** The light shafts and the caustics (linear). */
  shaft: [number, number, number];
  caustic: [number, number, number];
  /** The light shafts' strength. */
  shaftStrength: number;
}

export const DAY_LOOKS: Record<"afternoon" | "morning", DayLook> = {
  afternoon: {
    fogDensity: 0.000027,
    deepWater: 0x0c3a33,
    sunColor: 0xfff0d8,
    warm: 0xfff1dc,
    sunIntensity: 4,
    sunUnder: 0x9fe0cf,
    skyColor: 0xa9c8ee,
    skyGround: 0x2f4a4c,
    skyIntensity: 0.75,
    skySun: [1, 0.93, 0.82],
    zenith: [0.045, 0.16, 0.55],
    dawnGlow: [0, 0, 0],
    seaDeep: [0.008, 0.036, 0.05],
    seaScatter: [0.012, 0.05, 0.05],
    seaUnder: [0.22, 0.5, 0.44],
    floorColor: 0xc8bc9e,
    floorBase: "#a89a7c",
    shaft: [0.55, 0.85, 0.7],
    caustic: [0.7, 0.95, 0.8],
    shaftStrength: 0.16,
  },
  // 10° up: a warm, slightly gold sun; the Aegean's deep blue, the
  // clearest water of the four ships; a pale sand and grey mud floor.
  morning: {
    fogDensity: 0.000036,
    deepWater: 0x06244a,
    sunColor: 0xffdcb0,
    warm: 0xffdcb0,
    sunIntensity: 3.6,
    sunUnder: 0x9fd0f0,
    skyColor: 0xb4cbe8,
    skyGround: 0x7d8c9a,
    skyIntensity: 1.25,
    skySun: [1, 0.82, 0.6],
    zenith: [0.05, 0.15, 0.48],
    dawnGlow: [0.32, 0.17, 0.06],
    seaDeep: [0.004, 0.02, 0.07],
    seaScatter: [0.006, 0.03, 0.08],
    seaUnder: [0.16, 0.42, 0.62],
    floorColor: 0xd2cab6,
    floorBase: "#b4aa94",
    shaft: [0.5, 0.75, 0.95],
    caustic: [0.7, 0.85, 1.0],
    shaftStrength: 0.14,
  },
};

/** A daylit scene's look (the afternoon's for the afternoon). */
export function dayLookOf(s: Pick<SceneSettings, "timeOfDay">): DayLook {
  return s.timeOfDay === "morning" ? DAY_LOOKS.morning : DAY_LOOKS.afternoon;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const HIT_SUN = sunPosition(
  LUSITANIA_HIT.latDeg,
  LUSITANIA_HIT.lonDeg,
  LUSITANIA_HIT.utcMs
);
const CARPATHIA_SUN = sunPosition(
  CARPATHIA_HIT.latDeg,
  CARPATHIA_HIT.lonDeg,
  CARPATHIA_HIT.utcMs
);

const MINE_SUN = sunPosition(
  BRITANNIC_MINE.latDeg,
  BRITANNIC_MINE.lonDeg,
  BRITANNIC_MINE.utcMs
);

export const SCENE_SETTINGS: Record<ShipId, SceneSettings> = {
  titanic: {
    timeOfDay: "night",
    sun: null,
    fog: `#${NIGHT_FOG.getHexString()}`,
    underwaterFog: `#${NIGHT_SEA_FOG.getHexString()}`,
    coast: false,
    iceberg: true,
  },
  lusitania: {
    timeOfDay: "afternoon",
    // About 50° up in the south-south-west (worked out above).
    sun: {
      elevationDeg: round2(HIT_SUN.elevationDeg),
      azimuthDeg: round2(HIT_SUN.azimuthDeg),
    },
    // A light haze over a calm sea; green, sunlit shallow water.
    fog: "#bccddb",
    underwaterFog: "#2f7564",
    coast: true,
    iceberg: false,
    headingDeg: LUSITANIA_HIT.headingDeg,
  },
  // 3:30 PM to night on Lake Superior, 10 November 1975 (`storm.ts`): an
  // overcast with no sun disc, grey snow haze, cold dark fresh water.
  fitzgerald: {
    timeOfDay: "storm-dusk",
    sun: null,
    fog: "#6b7377",
    underwaterFog: "#1d302d",
    coast: false,
    iceberg: false,
    headingDeg: FITZGERALD_HEADING_DEG,
    storm: true,
    snow: true,
  },
  // 9:15 AM on 17 July 1918 in the open Atlantic west of Fastnet (spec
  // R6, R7): no land, the sun about 30° up in the east, a cloudy-bright
  // morning (the one photograph of her sinking shows broken grey cloud
  // and a moderate sea): a paler, greyer sky and a thicker haze than the
  // Lusitania's afternoon, a deep blue ocean, and under it blue water
  // darkening to her 150 m floor of grey-brown sand and mud (the survey
  // gives no colour: ours). Visual only: the sim's water is calm.
  carpathia: {
    timeOfDay: "afternoon",
    sun: {
      elevationDeg: round2(CARPATHIA_SUN.elevationDeg),
      azimuthDeg: round2(CARPATHIA_SUN.azimuthDeg),
    },
    fog: "#b3bcc4",
    underwaterFog: "#1e5a82",
    coast: false,
    iceberg: false,
    headingDeg: CARPATHIA_HIT.headingDeg,
    // The six others of the seven she led (R12), not at the low tier.
    convoy: true,
    daylight: {
      zenith: [0.11, 0.2, 0.42],
      hazeDensity: 0.000055,
      seaDeep: [0.004, 0.02, 0.06],
      seaScatter: [0.005, 0.026, 0.07],
      seaUnder: [0.12, 0.3, 0.52],
      deepWater: "#04121f",
      underDensity: [0.0062, 0.0082],
      sunUnder: "#a4cbe6",
      shafts: [0.45, 0.65, 0.9],
      floor: "#8e877b",
      // 150 m down the sun's ripples are all but gone.
      caustics: 0.035,
      // A 30° sun through broken cloud, nearly astern: a little softer
      // than the Lusitania's, and a brighter grey-blue sky fill with the
      // sea's light from below, so her dazzle reads black, white and grey
      // on her shaded port side, the sunlit side not washed out.
      sunColor: 0xfff1dc,
      sunIntensity: 3.6,
      skyColor: 0xc8d4e2,
      skyGround: 0x7c8d9a,
      skyIntensity: 1.5,
      // A fresh breeze over a moderate sea (R7): about twice the
      // Lusitania's ripple, breaking up the reflections.
      ripple: 0.75,
      // The sinking photograph's broken grey cloud and small whitecaps.
      clouds: 0.5,
      whitecaps: 0.03,
      // A moderate sea mirrors her and the clouds only faintly (the
      // sinking photograph's sea is grey and broken, no reflections).
      mirror: 0.2,
    },
  },
  // 8:12 AM in the Kea Channel, 21 November 1916: the sun 10° up in the
  // south-east (125°, worked out above), a light haze, clear blue water.
  britannic: {
    timeOfDay: "morning",
    sun: {
      elevationDeg: round2(MINE_SUN.elevationDeg),
      azimuthDeg: round2(MINE_SUN.azimuthDeg),
    },
    fog: "#c9d3dc",
    underwaterFog: "#1f6a9a",
    coast: true,
    iceberg: false,
    headingDeg: BRITANNIC_HEADING_DEG,
  },
};
