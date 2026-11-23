/**
 * The Carpathia's convoy (spec R12): the six other ships of the seven she
 * led as commodore once the escort had left early on 17 July 1918
 * (thegreatoceanliners.com, Wikipedia), steaming on in an open formation
 * around her until the first torpedo at 9:15 AM, then turning away and
 * scattering at full speed (GOL: "the convoy scattered at full speed").
 * Pure: every position comes from the shown time `t` (s after the first
 * hit), so seeking anywhere is right.
 *
 * Scene axes (as `shipToThree`): +x her course at the hit (due west), +z
 * to her starboard (north), y up. Her place at the hit is the origin.
 *
 * No source gives the ships' names, stations, paint, speeds or scatter
 * courses: all of it is ours, in the style of a 1918 Atlantic convoy (three
 * columns, the commodore at the head of the centre one; British merchant
 * ships in grey or dazzle). The stations are an open order, wider than a
 * close convoy's 3–5 cables: the escort had gone and the convoy had split.
 */

/** Convoy speed: hers, about 10 knots (R9, an assumption). */
export const CONVOY_MPS = 10 * 0.514444;
/** A steamer's turn with the helm hard over (about 1° a second). */
export const TURN_DEG_S = 1;
/** How fast she works up to full speed after the turn (m/s²). */
export const ACCEL_MPS2 = 0.012;

export type ConvoyPaint = "grey" | "dark" | "dazzle-a" | "dazzle-b";

export interface ConvoyShip {
  /** Her station at the first hit (m): ahead along the course, to starboard. */
  station: readonly [number, number];
  lengthM: number;
  paint: ConvoyPaint;
  /** Seconds after the hit she puts her helm over (seeing the hit, the flags). */
  reactS: number;
  /** Her scatter course off the convoy's (degrees, + to starboard). */
  scatterDeg: number;
  /** Full speed (m/s). */
  fullMps: number;
}

const KN = 0.514444;

/**
 * The six: port column (south, the side the torpedoes came from), the two
 * astern of her in the centre column, the starboard column. Each turns
 * away from her and from the others, the ones astern sheering off to
 * starboard past her stopped hull.
 */
export const CONVOY: readonly ConvoyShip[] = [
  {
    station: [800, -3000],
    lengthM: 125,
    paint: "dazzle-a",
    reactS: 60,
    scatterDeg: -40,
    fullMps: 12.5 * KN,
  },
  {
    station: [-1800, -3000],
    lengthM: 110,
    paint: "grey",
    reactS: 90,
    scatterDeg: -80,
    fullMps: 11.5 * KN,
  },
  {
    station: [-2200, 0],
    lengthM: 135,
    paint: "dazzle-b",
    reactS: 40,
    scatterDeg: 65,
    fullMps: 13 * KN,
  },
  {
    station: [-4400, 0],
    lengthM: 115,
    paint: "dark",
    reactS: 110,
    scatterDeg: 115,
    fullMps: 12 * KN,
  },
  {
    station: [800, 3000],
    lengthM: 130,
    paint: "grey",
    reactS: 50,
    scatterDeg: 35,
    fullMps: 13 * KN,
  },
  {
    station: [-1800, 3000],
    lengthM: 120,
    paint: "dazzle-a",
    reactS: 75,
    scatterDeg: 85,
    fullMps: 12 * KN,
  },
];

export interface ConvoyPose {
  x: number;
  z: number;
  /** Her heading off +x toward +z (rad). */
  heading: number;
  /** Her speed (m/s). */
  speed: number;
}

/**
 * Where a convoy ship is at shown time `t`: on station at convoy speed
 * until `reactS` after the first hit (`scatterAtS`; null: no hit, she
 * steams on), then a turn at `TURN_DEG_S` onto her scatter course, then
 * working up to full speed on it.
 */
export function convoyPose(
  ship: ConvoyShip,
  t: number,
  scatterAtS: number | null
): ConvoyPose {
  const v0 = CONVOY_MPS;
  const [sx, sz] = ship.station;
  const turnAt = scatterAtS === null ? Infinity : scatterAtS + ship.reactS;
  if (t <= turnAt) return { x: sx + v0 * t, z: sz, heading: 0, speed: v0 };
  const x0 = sx + v0 * turnAt;
  const w = (TURN_DEG_S * Math.PI) / 180;
  const s = Math.sign(ship.scatterDeg) || 1;
  const final = (ship.scatterDeg * Math.PI) / 180;
  const turnS = Math.abs(final) / w;
  const tau = t - turnAt;
  // The turn: an arc of radius v0 / w at convoy speed.
  const r = v0 / w;
  const arc = (a: number) => ({
    x: x0 + r * Math.sin(a),
    z: sz + s * r * (1 - Math.cos(a)),
  });
  if (tau <= turnS) {
    const a = w * tau;
    const p = arc(a);
    return { x: p.x, z: p.z, heading: s * a, speed: v0 };
  }
  const end = arc(Math.abs(final));
  // Then straight on her course, working up to full speed.
  const u = tau - turnS;
  const rampS = Math.max(0, (ship.fullMps - v0) / ACCEL_MPS2);
  const d =
    u <= rampS
      ? v0 * u + 0.5 * ACCEL_MPS2 * u * u
      : v0 * rampS +
        0.5 * ACCEL_MPS2 * rampS * rampS +
        ship.fullMps * (u - rampS);
  return {
    x: end.x + d * Math.cos(final),
    z: end.z + d * Math.sin(final),
    heading: final,
    speed: u <= rampS ? v0 + ACCEL_MPS2 * u : ship.fullMps,
  };
}

/** The earth's radius with standard refraction (7/6 of 6371 km). */
export const EARTH_R_M = (6371000 * 7) / 6;

/**
 * How far below the sea's level a thing `distM` off sits for an eye
 * `eyeM` up (m): nothing inside the eye's horizon, then the earth's curve
 * (hull-down, then gone). The scene's sea is flat, so the ships are
 * lowered by this much.
 */
export function hullDownM(distM: number, eyeM: number): number {
  const horizon = Math.sqrt(2 * EARTH_R_M * Math.max(eyeM, 0.5));
  if (distM <= horizon) return 0;
  return ((distM - horizon) * (distM - horizon)) / (2 * EARTH_R_M);
}

/** Her masthead above the water (m): gone when the curve hides that much. */
export const CONVOY_MAST_M = 30;
/**
 * Faded into the haze between these distances (m), then not drawn: her
 * haze (exp² 0.000055) leaves under a tenth of a ship's contrast at 28 km.
 */
export const CONVOY_FADE_FROM_M = 22000;
export const CONVOY_MAX_M = 28000;

/** How far a ship has faded into the haze beyond the fog's own (0–1). */
export function convoyFade(distM: number): number {
  const u = (distM - CONVOY_FADE_FROM_M) / (CONVOY_MAX_M - CONVOY_FADE_FROM_M);
  const k = Math.min(1, Math.max(0, u));
  return k * k * (3 - 2 * k);
}

/** Whether a ship `distM` off with `dropM` hidden is still drawn. */
export function convoyShown(distM: number, dropM: number): boolean {
  return distM < CONVOY_MAX_M && dropM < CONVOY_MAST_M;
}

/** The first hit's shown time, the moment the convoy scatters (null: none). */
export function scatterAtOf(
  torpedoes: readonly { t: number }[]
): number | null {
  let best: number | null = null;
  for (const h of torpedoes) if (best === null || h.t < best) best = h.t;
  return best;
}
