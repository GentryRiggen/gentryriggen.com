/**
 * The sea's summed sine waves. The scene's sea (components/ship-builder/scene/
 * seaState.ts) uses the same weights and frequencies; lib can't import from
 * components, so a test there checks they stay in step. `dirX`/`dirY` and
 * `wavelength` only shape the scene's surface; the sim's roll uses `weight`,
 * `omega` and `phase`.
 */
export interface SeaWave {
  /** Direction of travel across the sea surface (a unit vector). */
  dirX: number;
  dirY: number;
  /** World units crest to crest. */
  wavelength: number;
  /** Share of the peak height; the weights sum to 1. */
  weight: number;
  /** Radians per second at speed 1. */
  omega: number;
  /** Starting phase of the sim's roll forcing, radians. */
  phase: number;
}

/** Calm, choppy and stormy seas: three waves. */
export const WAVES: readonly SeaWave[] = [
  { dirX: 0.8, dirY: 0.6, wavelength: 9, weight: 0.5, omega: 1.1, phase: 0.6 },
  {
    dirX: -0.5,
    dirY: 0.866,
    wavelength: 5.5,
    weight: 0.3,
    omega: 1.5,
    phase: 2.1,
  },
  {
    dirX: 0.2,
    dirY: -0.98,
    wavelength: 3.2,
    weight: 0.2,
    omega: 2,
    phase: 4.0,
  },
];

/**
 * The storm trial's wild sea: a cross sea of six waves from six directions,
 * with frequencies that never line up (no common rhythm), so the rolls come
 * irregularly, big ones without warning.
 */
export const WILD_WAVES: readonly SeaWave[] = [
  {
    dirX: 0.8,
    dirY: 0.6,
    wavelength: 11,
    weight: 0.28,
    omega: 0.93,
    phase: 0.6,
  },
  {
    dirX: -0.6,
    dirY: 0.8,
    wavelength: 7.5,
    weight: 0.22,
    omega: 1.27,
    phase: 2.1,
  },
  {
    dirX: 0.28,
    dirY: -0.96,
    wavelength: 5.2,
    weight: 0.17,
    omega: 1.61,
    phase: 4.0,
  },
  {
    dirX: -0.96,
    dirY: -0.28,
    wavelength: 4.1,
    weight: 0.14,
    omega: 1.94,
    phase: 1.3,
  },
  {
    dirX: 0.6,
    dirY: -0.8,
    wavelength: 3.3,
    weight: 0.11,
    omega: 2.37,
    phase: 5.2,
  },
  {
    dirX: -0.28,
    dirY: 0.96,
    wavelength: 2.6,
    weight: 0.08,
    omega: 2.83,
    phase: 3.4,
  },
];
