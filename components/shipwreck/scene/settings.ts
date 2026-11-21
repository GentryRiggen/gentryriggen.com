import { Color, LinearSRGBColorSpace } from "three";
import type { ShipId } from "@/lib/shipwreck/ships/types";

/**
 * Each ship's scene: the hour, the sun, the fog above and below the sea,
 * the coast and the iceberg. The Titanic's night is exactly 1.0's (its
 * constants live here and the scene reads them); the Lusitania's afternoon
 * is 2:10 PM on 7 May 1915, about 11 nautical miles south of the Old Head
 * of Kinsale, with the sun worked out for the place and the hour.
 */

export interface SunAngles {
  /** Degrees above the horizon. */
  elevationDeg: number;
  /** True bearing, degrees clockwise from north. */
  azimuthDeg: number;
}

export interface SceneSettings {
  timeOfDay: "night" | "afternoon";
  sun: SunAngles | null;
  /** The haze at the horizon above the sea (sRGB hex). */
  fog: string;
  /** The water's colour just under the surface (sRGB hex). */
  underwaterFog: string;
  coast: boolean;
  iceberg: boolean;
  /** Her true heading at the first event (the scene's +x), degrees. */
  headingDeg?: number;
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

// --- The afternoon of 7 May 1915.

/**
 * Where and when the torpedo struck: about 11 nautical miles south of the
 * Old Head of Kinsale (her wreck lies at 51°25′ N, 8°33′ W), 2:10 PM. The
 * ship's clocks are taken as GMT (the brief's call; Irish time in 1915 was
 * Dublin Mean Time, 25 minutes behind, which would put the sun 6° further
 * west and 1° higher).
 */
export const LUSITANIA_HIT = {
  latDeg: 51.417,
  lonDeg: -8.55,
  utcMs: Date.UTC(1915, 4, 7, 14, 10),
  /**
   * S 87° E: the course she had come back to after taking her bearing on
   * the Old Head (Mersey inquiry), so the coast lies on her port beam.
   */
  headingDeg: 93,
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
  const rel = (sun.azimuthDeg - headingDeg) * RAD;
  const el = sun.elevationDeg * RAD;
  return [
    Math.cos(rel) * Math.cos(el),
    Math.sin(el),
    Math.sin(rel) * Math.cos(el),
  ];
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const HIT_SUN = sunPosition(
  LUSITANIA_HIT.latDeg,
  LUSITANIA_HIT.lonDeg,
  LUSITANIA_HIT.utcMs
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
    fog: "#c5d3dc",
    underwaterFog: "#2f7564",
    coast: true,
    iceberg: false,
    headingDeg: LUSITANIA_HIT.headingDeg,
  },
};
