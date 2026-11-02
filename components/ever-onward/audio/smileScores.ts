import { isValidSpec, type MusicSpec } from "../../game-audio/music";
import type { UneaseSpec } from "./scores";

/**
 * Make Everyone Smile's music. It starts as the sunniest thing in the game:
 * a bouncy major waltz. The unease lives in the mode and the meter, and in
 * a rare soft swell (see `SMILE_UNEASE`), never in the tempo or the volume:
 * the world's tune is the same cheerful one, slightly too steady, with one
 * note that does not belong. The quiet is almost silent and warm.
 */

/** Pure joy: bright major, a skipping waltz, a busy little lead. */
export const FRIEND_SCORE: MusicSpec = {
  id: "ms-friend",
  tempo: 112,
  beatsPerBar: 3,
  rootMidi: 57,
  scale: [0, 2, 4, 7, 9],
  progression: [0, 3, 4, 0, 5, 3, 4, 0],
  leadDensity: 0.55,
  leadRange: [4, 11],
  padWave: "triangle",
  leadWave: "triangle",
  isStrummed: true,
  level: 0.8,
  seed: 61,
};

/** A marching, festive tune; loud and glad. */
export const TOWN_SCORE: MusicSpec = {
  id: "ms-town",
  tempo: 120,
  beatsPerBar: 4,
  rootMidi: 55,
  scale: [0, 2, 4, 5, 7, 9, 11],
  progression: [0, 4, 5, 3, 0, 4, 3, 0],
  leadDensity: 0.5,
  leadRange: [4, 11],
  padWave: "triangle",
  leadWave: "triangle",
  isStrummed: true,
  level: 0.8,
  seed: 67,
};

/**
 * The same bright tune, held too steady: a lydian lift on a four-beat bar
 * that never relaxes, with a lead that keeps landing a note too high.
 */
export const WORLD_SCORE: MusicSpec = {
  id: "ms-world",
  tempo: 104,
  beatsPerBar: 4,
  rootMidi: 57,
  scale: [0, 2, 4, 6, 7, 9, 11],
  progression: [0, 0, 3, 3, 4, 4, 0, 0],
  leadDensity: 0.4,
  leadRange: [5, 12],
  padWave: "sine",
  leadWave: "triangle",
  isStrummed: false,
  level: 0.75,
  seed: 71,
};

/** Sparse and warm: a few round notes over a slow major pentatonic. */
export const QUIET_SCORE: MusicSpec = {
  id: "ms-quiet",
  tempo: 52,
  beatsPerBar: 4,
  rootMidi: 53,
  scale: [0, 2, 4, 7, 9],
  progression: [0, 3, 0, 4],
  leadDensity: 0.12,
  leadRange: [3, 8],
  padWave: "sine",
  leadWave: "sine",
  isStrummed: false,
  level: 0.55,
  seed: 9,
};

/** The title and hub theme: a sunny strummed waltz, brighter than the step. */
export const SMILE_TITLE_SCORE: MusicSpec = {
  id: "ms-title",
  tempo: 100,
  beatsPerBar: 3,
  rootMidi: 59,
  scale: [0, 2, 4, 7, 9],
  progression: [0, 4, 3, 0, 2, 3, 4, 0],
  leadDensity: 0.45,
  leadRange: [4, 10],
  padWave: "triangle",
  leadWave: "triangle",
  isStrummed: true,
  level: 0.75,
  seed: 19,
};

export const SMILE_SCORES: readonly MusicSpec[] = [
  FRIEND_SCORE,
  TOWN_SCORE,
  WORLD_SCORE,
  QUIET_SCORE,
];

/** None on the step; faint in the town; strongest (still soft) in the world. */
export const SMILE_UNEASE: readonly (UneaseSpec | null)[] = [
  null,
  { meanGapS: 80, interval: 1, gain: 0.03 },
  { meanGapS: 30, interval: 6, gain: 0.05 },
  null,
];

export function areSmileScoresValid(): boolean {
  return SMILE_SCORES.every(isValidSpec) && isValidSpec(SMILE_TITLE_SCORE);
}
