import { isValidSpec, type MusicSpec } from "../../game-audio/music";
import type { UneaseSpec } from "./scores";

/**
 * Build It Higher's music. The playroom is a music box in a bright major
 * waltz, the town a bouncy march, the sky a wide, thin Lydian drift and the
 * top a few quiet notes with room around them. The unease is a rare, soft
 * swell, never in the tempo or the volume.
 */

/** Pure joy: a plinking music box over a bright waltz. */
export const PLAYROOM_SCORE: MusicSpec = {
  id: "bh-playroom",
  tempo: 108,
  beatsPerBar: 3,
  rootMidi: 60,
  scale: [0, 2, 4, 5, 7, 9, 11],
  progression: [0, 3, 4, 0, 5, 3, 4, 0],
  leadDensity: 0.6,
  leadRange: [5, 12],
  padWave: "triangle",
  leadWave: "triangle",
  isStrummed: true,
  level: 0.8,
  seed: 61,
};

/** A cheerful march with a faint lean to it. */
export const TOWN_SCORE: MusicSpec = {
  id: "bh-town",
  tempo: 100,
  beatsPerBar: 4,
  rootMidi: 55,
  scale: [0, 2, 4, 5, 7, 9, 10],
  progression: [0, 4, 3, 0, 5, 3, 4, 4],
  leadDensity: 0.45,
  leadRange: [3, 10],
  padWave: "triangle",
  leadWave: "triangle",
  isStrummed: true,
  level: 0.8,
  seed: 73,
};

/** Wide and thin: Lydian, slow, and never quite landing on the beat. */
export const SKY_SCORE: MusicSpec = {
  id: "bh-sky",
  tempo: 74,
  beatsPerBar: 5,
  rootMidi: 52,
  scale: [0, 2, 4, 6, 7, 9, 11],
  progression: [0, 4, 1, 5, 0, 3, 1, 4],
  leadDensity: 0.3,
  leadRange: [5, 13],
  padWave: "sine",
  leadWave: "triangle",
  isStrummed: false,
  level: 0.75,
  seed: 85,
};

/** Sparse and warm: a few round notes, with a lot of quiet in between. */
export const TOP_SCORE: MusicSpec = {
  id: "bh-top",
  tempo: 54,
  beatsPerBar: 4,
  rootMidi: 57,
  scale: [0, 2, 4, 7, 9],
  progression: [0, 3, 0, 2],
  leadDensity: 0.12,
  leadRange: [3, 9],
  padWave: "sine",
  leadWave: "sine",
  isStrummed: false,
  level: 0.6,
  seed: 19,
};

/** The title and hub theme: the music box again, a little taller. */
export const HIGHER_TITLE_SCORE: MusicSpec = {
  id: "bh-title",
  tempo: 100,
  beatsPerBar: 3,
  rootMidi: 62,
  scale: [0, 2, 4, 7, 9],
  progression: [0, 3, 4, 0, 2, 3, 4, 0],
  leadDensity: 0.45,
  leadRange: [5, 11],
  padWave: "triangle",
  leadWave: "triangle",
  isStrummed: true,
  level: 0.75,
  seed: 27,
};

export const HIGHER_SCORES: readonly MusicSpec[] = [
  PLAYROOM_SCORE,
  TOWN_SCORE,
  SKY_SCORE,
  TOP_SCORE,
];

/** None in the playroom; faint in the town; strongest (still soft) in the sky. */
export const HIGHER_UNEASE: readonly (UneaseSpec | null)[] = [
  null,
  { meanGapS: 80, interval: 1, gain: 0.03 },
  { meanGapS: 38, interval: 6, gain: 0.05 },
  null,
];

export function areHigherScoresValid(): boolean {
  return HIGHER_SCORES.every(isValidSpec) && isValidSpec(HIGHER_TITLE_SCORE);
}
