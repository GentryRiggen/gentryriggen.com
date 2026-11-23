/**
 * The water-light button (1.9): how light the water is under the surface.
 * Step 0 is her real water (each scene's own fog, colour and light,
 * unchanged); steps 1 and 2 clear the water (a share of its fog density),
 * lift its colour toward a lighter one of the scene's own, and raise the
 * ambient light and the camera's lamp, so a young player can follow her
 * down in the darkest water (the Titanic's night, the Fitzgerald's storm).
 */
export const UNDER_LIGHT = [
  { fog: 1, lift: 0, ambient: 1, lamp: 1 },
  { fog: 0.5, lift: 0.45, ambient: 2, lamp: 1.6 },
  { fog: 0.28, lift: 0.8, ambient: 3.2, lamp: 2.4 },
] as const;

export type UnderLightLevel = 0 | 1 | 2;

/** The lighter water the night's under-water fog lifts toward (sRGB hex). */
export const UNDER_LIGHT_NIGHT_WATER = 0x1a5468;
/** By day and in the storm the water lifts toward its own colour, this much brighter. */
export const UNDER_LIGHT_DAY_GAIN = 1.5;

/** The step's numbers (any other level: the real water). */
export function underLightOf(level: number): (typeof UNDER_LIGHT)[number] {
  return UNDER_LIGHT[level === 1 || level === 2 ? level : 0];
}
