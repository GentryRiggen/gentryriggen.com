import { isValidSpec, type MusicSpec } from "../../game-audio/music";
import type { UneaseSpec } from "./scores";

/**
 * Make It Grow's music. Light is slow 4/4 pentatonic sine and triangle; Grow
 * is livelier: waltz and folk meters, a soft strum, plucky leads and warmer
 * modes. The unease lives in the mode and the meter, and in a rare soft
 * swell (see `GROW_UNEASE`), never in the tempo or the volume.
 */

/** Pure joy: bright Lydian waltz, a bouncy strum, a busy little lead. */
export const YARD_SCORE: MusicSpec = {
  id: "gr-yard",
  tempo: 104,
  beatsPerBar: 3,
  rootMidi: 55,
  scale: [0, 2, 4, 6, 7, 9, 11],
  progression: [0, 3, 4, 0, 5, 3, 1, 4],
  leadDensity: 0.55,
  leadRange: [4, 11],
  padWave: "triangle",
  leadWave: "triangle",
  isStrummed: true,
  level: 0.8,
  seed: 21,
};

/** Cheerful, with a faint unease: Mixolydian, a flat seventh keeps leaning. */
export const FARM_SCORE: MusicSpec = {
  id: "gr-farm",
  tempo: 88,
  beatsPerBar: 3,
  rootMidi: 53,
  scale: [0, 2, 4, 5, 7, 9, 10],
  progression: [0, 6, 3, 0, 4, 6, 3, 4],
  leadDensity: 0.42,
  leadRange: [3, 10],
  padWave: "triangle",
  leadWave: "triangle",
  isStrummed: true,
  level: 0.8,
  seed: 37,
};

/**
 * The strongest unease, never scary: five beats to the bar so it never quite
 * settles, a minor mode with a flat second, and a slower, wider lead.
 */
export const WORLD_SCORE: MusicSpec = {
  id: "gr-world",
  tempo: 72,
  beatsPerBar: 5,
  rootMidi: 50,
  scale: [0, 1, 3, 5, 7, 8, 10],
  progression: [0, 5, 3, 6, 0, 4, 1, 5],
  leadDensity: 0.3,
  leadRange: [4, 12],
  padWave: "sine",
  leadWave: "triangle",
  isStrummed: false,
  level: 0.75,
  seed: 53,
};

/** Sparse and warm: a few round notes over a slow major pentatonic. */
export const SEED_SCORE: MusicSpec = {
  id: "gr-seed",
  tempo: 56,
  beatsPerBar: 4,
  rootMidi: 55,
  scale: [0, 2, 4, 7, 9],
  progression: [0, 2, 3, 0],
  leadDensity: 0.14,
  leadRange: [3, 9],
  padWave: "sine",
  leadWave: "sine",
  isStrummed: false,
  level: 0.6,
  seed: 8,
};

/** The title and hub theme: a sunny strummed waltz, brighter than the yard. */
export const GROW_TITLE_SCORE: MusicSpec = {
  id: "gr-title",
  tempo: 96,
  beatsPerBar: 3,
  rootMidi: 57,
  scale: [0, 2, 4, 7, 9],
  progression: [0, 3, 4, 0, 2, 3, 4, 0],
  leadDensity: 0.45,
  leadRange: [4, 10],
  padWave: "triangle",
  leadWave: "triangle",
  isStrummed: true,
  level: 0.75,
  seed: 14,
};

export const GROW_SCORES: readonly MusicSpec[] = [
  YARD_SCORE,
  FARM_SCORE,
  WORLD_SCORE,
  SEED_SCORE,
];

/** None in the yard; faint on the farm; strongest (still soft) in the world. */
export const GROW_UNEASE: readonly (UneaseSpec | null)[] = [
  null,
  { meanGapS: 70, interval: 1, gain: 0.03 },
  { meanGapS: 32, interval: 6, gain: 0.05 },
  null,
];

export function areGrowScoresValid(): boolean {
  return GROW_SCORES.every(isValidSpec) && isValidSpec(GROW_TITLE_SCORE);
}
