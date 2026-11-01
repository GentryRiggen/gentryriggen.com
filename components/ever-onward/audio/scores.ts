import { isValidSpec, type MusicSpec } from "../../game-audio/music";

/**
 * One calm generative score per phase (zen, sparse, a little Minecraft). The
 * unease lives in the scale and the chord loop, and in a rare dissonant
 * swell (see `UNEASE`), never in the tempo.
 */

/** Warm major pentatonic, slow: the coast. */
export const COAST_SCORE: MusicSpec = {
  id: "eo-coast",
  tempo: 60,
  beatsPerBar: 4,
  rootMidi: 52,
  scale: [0, 2, 4, 7, 9],
  progression: [0, 3, 1, 4],
  leadDensity: 0.2,
  leadRange: [3, 9],
  padWave: "sine",
  leadWave: "triangle",
  isStrummed: false,
  level: 0.8,
  seed: 11,
};

/** The same motif, busier, in Dorian: a minor third creeps in. */
export const NIGHT_SCORE: MusicSpec = {
  id: "eo-night",
  tempo: 68,
  beatsPerBar: 4,
  rootMidi: 52,
  scale: [0, 2, 3, 5, 7, 9, 10],
  progression: [0, 3, 0, 6, 0, 3, 4, 6],
  leadDensity: 0.32,
  leadRange: [4, 11],
  padWave: "sine",
  leadWave: "triangle",
  isStrummed: false,
  level: 0.8,
  seed: 11,
};

/** Wide and airy: suspended chords and a stray major seventh. */
export const SKY_SCORE: MusicSpec = {
  id: "eo-sky",
  tempo: 56,
  beatsPerBar: 4,
  rootMidi: 50,
  scale: [0, 2, 5, 7, 9, 11],
  progression: [0, 4, 2, 5, 3, 1],
  leadDensity: 0.26,
  leadRange: [4, 13],
  padWave: "sine",
  leadWave: "sine",
  isStrummed: false,
  level: 0.75,
  seed: 29,
};

/** Sparse, slow, minor and quiet: the last light. */
export const LAST_SCORE: MusicSpec = {
  id: "eo-last",
  tempo: 46,
  beatsPerBar: 4,
  rootMidi: 48,
  scale: [0, 3, 5, 7, 10],
  progression: [0, 2, 3, 1],
  leadDensity: 0.12,
  leadRange: [3, 8],
  padWave: "sine",
  leadWave: "sine",
  isStrummed: false,
  level: 0.6,
  seed: 5,
};

export const SCORES: readonly MusicSpec[] = [
  COAST_SCORE,
  NIGHT_SCORE,
  SKY_SCORE,
  LAST_SCORE,
];

/** The score for a phase index; later or unknown phases use the last one. */
export function scoreForPhase(phase: number): MusicSpec {
  const index = Math.min(SCORES.length - 1, Math.max(0, Math.floor(phase)));
  return SCORES[index];
}

/**
 * A rare, soft dissonant swell: two quiet notes `interval` semitones apart
 * over the tonic, roughly every `meanGapS` seconds. The coast has none.
 */
export interface UneaseSpec {
  meanGapS: number;
  interval: number;
  gain: number;
}

export const UNEASE: readonly (UneaseSpec | null)[] = [
  null,
  { meanGapS: 50, interval: 6, gain: 0.05 },
  { meanGapS: 40, interval: 1, gain: 0.045 },
  { meanGapS: 55, interval: 6, gain: 0.04 },
];

export function uneaseForPhase(phase: number): UneaseSpec | null {
  return UNEASE[Math.min(UNEASE.length - 1, Math.max(0, Math.floor(phase)))];
}

export function areScoresValid(): boolean {
  return SCORES.every(isValidSpec);
}
