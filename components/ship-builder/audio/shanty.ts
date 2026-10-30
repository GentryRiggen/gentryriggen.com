import type { MusicSpec } from "../../game-audio/music";

/**
 * A calm sea-shanty loop for building: a slow six-beat bar (felt as two
 * rolling groups of three), a low drone-and-strum accompaniment in D dorian
 * and a gentle wandering tune on top.
 */
export const SHANTY: MusicSpec = {
  id: "ship:shanty",
  tempo: 138,
  beatsPerBar: 6,
  rootMidi: 62,
  scale: [0, 2, 3, 5, 7, 9, 10],
  progression: [0, 0, 6, 0, 0, 3, 6, 0],
  leadDensity: 0.5,
  leadRange: [0, 7],
  padWave: "sine",
  leadWave: "triangle",
  isStrummed: true,
  level: 0.9,
  seed: 7,
};
