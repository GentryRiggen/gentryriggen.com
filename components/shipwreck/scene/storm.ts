import type { QualityTier } from "@/lib/shipwreck/playback";
import {
  FITZGERALD_HEADING_DEG,
  sunPosition,
  type SunAngles,
} from "./settings";

/**
 * The Edmund Fitzgerald's storm scene, as data: where she was at 3:30 PM
 * Eastern on 10 November 1975 (the scene's origin), the light fading from
 * grey afternoon to black night, the snow squalls, Whitefish Point's light
 * ahead and the Arthur M. Anderson's lights astern. Pure (no three.js), so
 * the tests and the scene read the same numbers. Sources: README, "The
 * Fitzgerald's storm".
 */

const DEG = Math.PI / 180;
const EARTH_R = 6371000;
const MILE = 1609.344;

export { FITZGERALD_HEADING_DEG };

/**
 * Her wreck (the Great Lakes Shipwreck Historical Society: 46°59.9′ N,
 * 85°06.6′ W, in Canadian waters, 162 m down).
 */
export const WRECK_SITE = { latDeg: 46 + 59.9 / 60, lonDeg: -(85 + 6.6 / 60) };

/**
 * How far the sim's real run carries her along her course from 3:30 PM to
 * where her parts lie (m): the end of her real track (about 76.4 km at her
 * 5.72 m/s, `realStorm.test.ts`). Her 3:30 PM place is the wreck moved back
 * that far along her course, so her wreck lies where it is surveyed; her
 * report put her near Caribou Island then, which this agrees with (about
 * 47.5° N, 85.75° W).
 */
export const WRECK_RUN_M = 76400;

/** A point `d` m from (lat, lon) along a true bearing (great circle). */
function destination(
  latDeg: number,
  lonDeg: number,
  bearingDeg: number,
  d: number
): { latDeg: number; lonDeg: number } {
  const p1 = latDeg * DEG;
  const l1 = lonDeg * DEG;
  const th = bearingDeg * DEG;
  const dl = d / EARTH_R;
  const p2 = Math.asin(
    Math.sin(p1) * Math.cos(dl) + Math.cos(p1) * Math.sin(dl) * Math.cos(th)
  );
  const l2 =
    l1 +
    Math.atan2(
      Math.sin(th) * Math.sin(dl) * Math.cos(p1),
      Math.cos(dl) - Math.sin(p1) * Math.sin(p2)
    );
  return { latDeg: p2 / DEG, lonDeg: l2 / DEG };
}

/** Her place and time at the first event (3:30 PM EST = 20:30 UTC). */
export const FITZGERALD_START = {
  ...destination(
    WRECK_SITE.latDeg,
    WRECK_SITE.lonDeg,
    FITZGERALD_HEADING_DEG + 180,
    WRECK_RUN_M
  ),
  utcMs: Date.UTC(1975, 10, 10, 20, 30),
  headingDeg: FITZGERALD_HEADING_DEG,
} as const;

/** Whitefish Point light (USCG Light List: 46°46.3′ N, 84°57.4′ W). */
export const WHITEFISH_POINT = {
  latDeg: 46 + 46.3 / 60,
  lonDeg: -(84 + 57.4 / 60),
};

/**
 * A place on the lake in the scene's axes (three x along her heading at
 * 3:30 PM, three z to starboard), m from her 3:30 PM place: a flat map
 * about it (under 0.1% out at 100 km).
 */
export function geoToScene(latDeg: number, lonDeg: number): [number, number] {
  const o = FITZGERALD_START;
  const north = (latDeg - o.latDeg) * DEG * EARTH_R;
  const east =
    (lonDeg - o.lonDeg) *
    DEG *
    EARTH_R *
    Math.cos(((latDeg + o.latDeg) / 2) * DEG);
  const h = o.headingDeg * DEG;
  return [
    east * Math.sin(h) + north * Math.cos(h),
    east * Math.cos(h) - north * Math.sin(h),
  ];
}

/** The last `stormSun` asked for (the scene asks several times a frame). */
let sunT = NaN;
let sunAt: SunAngles = { elevationDeg: 0, azimuthDeg: 0 };

/**
 * The sun at shown time t (s after 3:30 PM), where she was then. The
 * same object again for the same t (one slot): read it, never write it.
 */
export function stormSun(t: number): SunAngles {
  if (t === sunT) return sunAt;
  const o = FITZGERALD_START;
  sunAt = sunPosition(o.latDeg, o.lonDeg, o.utcMs + t * 1000);
  sunT = t;
  return sunAt;
}

function smoothstep(a: number, b: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/**
 * The share of the overcast afternoon's light at shown time t: from the
 * sun's height under a heavy overcast, full at about 14° (above her 3:30 PM
 * sun) down to none at about 7° below the horizon (past civil dusk, about
 * 5:40 PM), steepening through the dusk as twilight does. No sun disc: the
 * cloud hides it.
 */
export function stormDaylight(t: number): number {
  const e = stormSun(t).elevationDeg;
  return smoothstep(-7, 14, e) ** 1.6;
}

/**
 * The storm's light at shown time t, or the time button's pinned light
 * (`SceneRuntime.stormLight`: the storm by day).
 */
export function stormLightAt(
  rt: { stormLight: number | null },
  t: number
): number {
  return rt.stormLight ?? stormDaylight(t);
}

/** Shown seconds after 3:30 PM for h:mm PM. */
function pm(h: number, m: number): number {
  return (h + 12 - 15) * 3600 + (m - 30) * 60;
}

/**
 * Snow squalls, as shown seconds [from, to]: the record has squalls through
 * the evening (the Anderson's log and testimony, USCG), heavy around 7 PM
 * when she lost the Fitzgerald's lights, and clearing about 7:20 PM, when
 * the Anderson could see ships 19 miles off but not her. The squalls' own
 * times before that are an assumption (README).
 */
export const SQUALLS: readonly (readonly [number, number])[] = [
  [pm(4, 10), pm(4, 40)],
  [pm(5, 15), pm(5, 45)],
  [pm(6, 10), pm(6, 30)],
  [pm(6, 45), pm(7, 16)],
];
const SQUALL_EDGE_S = 240;
const SNOW_BASE = 0.12;

/** How thick the snow is at shown time t: 0 clear to 1 a squall. */
export function snowAt(t: number): number {
  let s = 0;
  for (const [a, b] of SQUALLS)
    s = Math.max(
      s,
      smoothstep(a - SQUALL_EDGE_S, a, t) *
        (1 - smoothstep(b, b + SQUALL_EDGE_S, t))
    );
  return Math.min(1, SNOW_BASE + (1 - SNOW_BASE) * s);
}

/**
 * Whitefish Point's light and radio beacon were reported out that evening
 * (USCG): dark in her real run. In a calmer What-if storm it is lit (the
 * builder's call: a calmer evening, the power kept), a white flash every
 * WHITEFISH_PERIOD_S (an assumption for 1975).
 */
export function whitefishLit(stormScale: number): boolean {
  return stormScale < 1;
}
export const WHITEFISH_PERIOD_S = 20;

/**
 * The Arthur M. Anderson astern: about 17 miles behind at 3:35 PM and
 * about 10 at 7:00 PM (USCG), closing steadily (her 14.6 mph against the
 * Fitzgerald's 12.8), on the same course. Her lights as she comes on,
 * seen from ahead: two masthead lights (the after one higher), and her
 * red and green side lights (a 767 ft laker; heights an assumption).
 * Ship frame: x forward (toward the Fitzgerald), y to port, z up (m).
 * `offDeg`: she is drawn this far off the Fitzgerald's centre line, to
 * starboard (an assumption: the record gives miles astern, not a
 * bearing; dead astern her own mast and funnel would hide the lights).
 */
export const ANDERSON = {
  offDeg: 1.5,
  lights: [
    { at: [105, 0, 24], color: [1, 0.95, 0.85] },
    { at: [-100, 0, 33], color: [1, 0.95, 0.85] },
    { at: [104, 11, 17], color: [1, 0.12, 0.08] },
    { at: [104, -11, 17], color: [0.1, 1, 0.35] },
  ] as const,
};

const ANDERSON_AT: readonly [number, number][] = [
  [pm(3, 35), 17 * MILE],
  [pm(7, 0), 10 * MILE],
];

/** How far astern of her the Anderson is at shown time t (m). */
export function andersonAsternM(t: number): number {
  const [[t0, d0], [t1, d1]] = ANDERSON_AT;
  return Math.max(2 * MILE, d0 + ((d1 - d0) * (t - t0)) / (t1 - t0));
}

/**
 * At night white things (foam, spray, snow, the green water's churn) keep
 * at least this share of their daylight brightness: her deck lights
 * scattered by the snow and the low cloud. A look, not physics (as the
 * 1.0 night's starlight); without it the storm's action is black.
 */
export const STORM_NIGHT_WHITE = 0.18;

/**
 * The storm's particles per quality tier: snowflakes round the camera
 * (near ones streak along the wind), the far snow curtain of a squall,
 * spray, funnel smoke, the clay plume where each part lands, the pool
 * they share (with room for the near flakes' streaks), and how big one
 * may be on screen (framebuffer px). iPads start at medium. Flakes, spray
 * and smoke are soft and fill-rate bound at the larger sizes.
 */
export const STORM_PARTICLES: Record<
  QualityTier,
  {
    snow: number;
    /** At most this many near flakes streak (4 more points each). */
    streaks: number;
    snowFar: number;
    spray: number;
    smoke: number;
    plume: number;
    pool: number;
    maxPx: number;
  }
> = {
  high: {
    snow: 2000,
    streaks: 200,
    snowFar: 700,
    spray: 900,
    smoke: 220,
    plume: 360,
    pool: 5000,
    maxPx: 120,
  },
  medium: {
    snow: 1100,
    streaks: 110,
    snowFar: 380,
    spray: 500,
    smoke: 120,
    plume: 200,
    pool: 2800,
    maxPx: 80,
  },
  low: {
    snow: 600,
    streaks: 60,
    snowFar: 200,
    spray: 280,
    smoke: 70,
    plume: 110,
    pool: 1500,
    maxPx: 56,
  },
};

/**
 * A storm particle smaller than this on screen (px) fades out instead of
 * being drawn up to a 1.5 px pinpoint (far snow read as stars).
 */
export const STORM_MIN_PX = 2;
