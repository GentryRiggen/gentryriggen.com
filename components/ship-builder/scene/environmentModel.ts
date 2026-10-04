import { PALETTE } from "./palette";
import { seaParams, type SeaState } from "./seaState";
import type { TimeOfDay } from "./timeOfDay";

export type Vec3 = readonly [number, number, number];

/** Everything the scene needs to look like one time of day in one sea state. */
export interface Environment {
  colors: {
    /** Sky straight overhead. */
    skyZenith: string;
    /** Sky at the horizon; the fog and the far water fade into it. */
    skyHorizon: string;
    sunColor: string;
    ambient: string;
    hemiSky: string;
    hemiGround: string;
    /** The key light: the sun by day, the moon at night. */
    light: string;
    /** Multiplies the ocean's own gradient. */
    seaTint: string;
    /** Background and fog in the below view. */
    underwater: string;
    cloud: string;
  };
  numbers: {
    /** Strength of the sun's halo and disc in the sky (0 hides it). */
    sunGlow: number;
    /** Strength of the moon in the sky (0 hides it). */
    moonAmount: number;
    fogNear: number;
    fogFar: number;
    ambientIntensity: number;
    hemiIntensity: number;
    lightIntensity: number;
    seaRoughness: number;
    /** 0 clear sky .. 1 solid overcast. */
    cloudCover: number;
    /** 0 no stars .. 1 full starfield. */
    starAmount: number;
  };
  vectors: {
    /** Unit vectors from the ship toward the sun and the moon. */
    sunDirection: Vec3;
    moonDirection: Vec3;
    /** Where the key light sits; it always looks at the ship. */
    lightPosition: Vec3;
  };
}

export type ColorKey = keyof Environment["colors"];
export type NumberKey = keyof Environment["numbers"];
export type VectorKey = keyof Environment["vectors"];

/** The key light's distance from the ship; the shadow frustum is sized to it. */
const LIGHT_DISTANCE = 54;

function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

/** A unit vector at `elevation` above the horizon, `azimuth` around it. */
function direction(elevationDeg: number, azimuthDeg: number): Vec3 {
  const elevation = (elevationDeg * Math.PI) / 180;
  const azimuth = (azimuthDeg * Math.PI) / 180;
  const flat = Math.cos(elevation);
  return [
    flat * Math.sin(azimuth),
    Math.sin(elevation),
    flat * Math.cos(azimuth),
  ];
}

function scale([x, y, z]: Vec3, factor: number): Vec3 {
  return [x * factor, y * factor, z * factor];
}

function channels(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/**
 * Returns the `a`..`b` blend as a hex string; `amount` 0 is `a`. Blends the
 * sRGB values directly, which is plenty for tinting a sky grey.
 */
export function mixHex(a: string, b: string, amount: number): string {
  const from = channels(a);
  const to = channels(b);
  const mixed = from.map((value, i) => Math.round(mix(value, to[i], amount)));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

/** The clear-weather look of each time. Day is the original scene. */
const CLEAR: Record<TimeOfDay, Environment> = {
  day: {
    colors: {
      skyZenith: "#6fa6d6",
      skyHorizon: PALETTE.sky,
      sunColor: "#fff6e0",
      ambient: "#ffffff",
      hemiSky: "#ffffff",
      hemiGround: "#ffffff",
      light: "#ffffff",
      seaTint: "#ffffff",
      underwater: PALETTE.underwater,
      cloud: "#ffffff",
    },
    numbers: {
      sunGlow: 0.5,
      moonAmount: 0,
      fogNear: 80,
      fogFar: 260,
      ambientIntensity: 0.55,
      hemiIntensity: 0,
      lightIntensity: 1.4,
      seaRoughness: 0.35,
      cloudCover: 0,
      starAmount: 0,
    },
    vectors: {
      sunDirection: normalize([100, 40, 80]),
      moonDirection: direction(-30, 0),
      lightPosition: [30, 40, 20],
    },
  },
  sunset: {
    colors: {
      skyZenith: "#4a5a9a",
      skyHorizon: "#f4a982",
      sunColor: "#ffb36b",
      ambient: "#ffd0c4",
      hemiSky: "#d596b4",
      hemiGround: "#2d4170",
      light: "#ffab66",
      seaTint: "#d2bff0",
      underwater: mixHex(PALETTE.underwater, "#03101c", 0.4),
      cloud: "#ffb18c",
    },
    numbers: {
      sunGlow: 1,
      moonAmount: 0,
      fogNear: 60,
      fogFar: 230,
      ambientIntensity: 0.65,
      hemiIntensity: 0.7,
      lightIntensity: 1.2,
      seaRoughness: 0.26,
      cloudCover: 0,
      starAmount: 0.15,
    },
    vectors: {
      sunDirection: direction(9, 50),
      moonDirection: direction(-30, 0),
      lightPosition: scale(direction(14, 50), LIGHT_DISTANCE),
    },
  },
  night: {
    colors: {
      skyZenith: "#070d26",
      skyHorizon: "#1b2b52",
      sunColor: "#000000",
      ambient: "#8b9fe0",
      hemiSky: "#4a62a8",
      hemiGround: "#0c1530",
      light: "#b3c8ff",
      seaTint: "#8da2d6",
      underwater: mixHex(PALETTE.underwater, "#020a14", 0.6),
      cloud: "#3a4468",
    },
    numbers: {
      sunGlow: 0,
      moonAmount: 1,
      fogNear: 70,
      fogFar: 240,
      ambientIntensity: 0.58,
      hemiIntensity: 0.6,
      lightIntensity: 0.8,
      seaRoughness: 0.3,
      cloudCover: 0,
      starAmount: 1,
    },
    vectors: {
      sunDirection: direction(-30, 0),
      moonDirection: direction(24, 40),
      lightPosition: scale(direction(45, 35), LIGHT_DISTANCE),
    },
  },
};

/** What the sky, light, sea and clouds turn toward as the weather closes in. */
const STORM: Record<
  TimeOfDay,
  {
    skyZenith: string;
    skyHorizon: string;
    light: string;
    ambient: string;
    seaTint: string;
    cloud: string;
  }
> = {
  day: {
    skyZenith: "#5d6670",
    skyHorizon: "#8a949c",
    light: "#d4dbe2",
    ambient: "#dfe6ee",
    seaTint: "#a9bcc0",
    cloud: "#7d8791",
  },
  sunset: {
    skyZenith: "#4c4658",
    skyHorizon: "#a07f7a",
    light: "#e0aa94",
    ambient: "#cdb4b0",
    seaTint: "#b8a0a0",
    cloud: "#8a6a6a",
  },
  night: {
    skyZenith: "#0b101c",
    skyHorizon: "#18202f",
    light: "#8a9ab8",
    ambient: "#8c9ac4",
    seaTint: "#7d8aa8",
    cloud: "#1b2132",
  },
};

/** Fully overcast water closes the horizon in. */
const STORM_FOG_NEAR = 50;
const STORM_FOG_FAR = 190;
/** Share of the key light that gets through full overcast. */
const OVERCAST_LIGHT_LOSS = 0.45;
/** Cloud cover this thick hides the stars and the moon entirely. */
const STAR_HIDING_COVER = 1.1;
/** The below view darkens a little more under a storm. */
const STORM_UNDERWATER_DARKEN = 0.25;

/**
 * The look of `time` in `sea`: calm is clear sky, choppy partly cloudy,
 * stormy overcast, darker, greyer and with the horizon closed in by fog.
 */
export function environmentFor(time: TimeOfDay, sea: SeaState): Environment {
  const clear = CLEAR[time];
  const storm = STORM[time];
  const { cloudCover, overcast } = seaParams(sea);
  const hidden = Math.max(0, 1 - cloudCover / STAR_HIDING_COVER);

  return {
    colors: {
      ...clear.colors,
      skyZenith: mixHex(clear.colors.skyZenith, storm.skyZenith, overcast),
      skyHorizon: mixHex(clear.colors.skyHorizon, storm.skyHorizon, overcast),
      light: mixHex(clear.colors.light, storm.light, overcast),
      ambient: mixHex(clear.colors.ambient, storm.ambient, overcast),
      seaTint: mixHex(clear.colors.seaTint, storm.seaTint, overcast),
      cloud: mixHex(clear.colors.cloud, storm.cloud, overcast),
      underwater: mixHex(
        clear.colors.underwater,
        "#02080f",
        overcast * STORM_UNDERWATER_DARKEN
      ),
    },
    numbers: {
      ...clear.numbers,
      sunGlow: clear.numbers.sunGlow * (1 - overcast),
      moonAmount: clear.numbers.moonAmount * (1 - overcast * 0.8),
      fogNear: mix(clear.numbers.fogNear, STORM_FOG_NEAR, overcast),
      fogFar: mix(clear.numbers.fogFar, STORM_FOG_FAR, overcast),
      lightIntensity:
        clear.numbers.lightIntensity * (1 - OVERCAST_LIGHT_LOSS * overcast),
      cloudCover,
      starAmount: clear.numbers.starAmount * hidden,
    },
    vectors: clear.vectors,
  };
}
