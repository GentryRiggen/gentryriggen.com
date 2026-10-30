import type { MusicSpec } from "../../game-audio/music";
import type { LevelId } from "@/lib/plane-builder/levels/types";

const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const;
const LYDIAN = [0, 2, 4, 6, 7, 9, 11] as const;
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10] as const;
const DORIAN = [0, 2, 3, 5, 7, 9, 10] as const;
const MINOR = [0, 2, 3, 5, 7, 8, 10] as const;
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10] as const;

function world(
  id: LevelId,
  spec: Omit<MusicSpec, "id" | "beatsPerBar" | "isStrummed">
): MusicSpec {
  return { id: `world:${id}`, beatsPerBar: 4, isStrummed: false, ...spec };
}

/**
 * One light mood per world: the key, scale, tempo and chord loop change, and
 * the melody is a quiet wandering line over slow pads.
 */
export const WORLD_MUSIC: Record<LevelId, MusicSpec> = {
  // Bright and easy: the first sky.
  meadow: world("meadow", {
    tempo: 84,
    rootMidi: 60,
    scale: MAJOR,
    progression: [0, 3, 4, 3],
    leadDensity: 0.45,
    leadRange: [0, 7],
    padWave: "triangle",
    leadWave: "triangle",
    level: 0.9,
    seed: 11,
  }),
  // Warm and dusty.
  canyon: world("canyon", {
    tempo: 76,
    rootMidi: 62,
    scale: DORIAN,
    progression: [0, 3, 0, 6],
    leadDensity: 0.4,
    leadRange: [0, 6],
    padWave: "triangle",
    leadWave: "sine",
    level: 0.9,
    seed: 23,
  }),
  // Wide and grand.
  mountains: world("mountains", {
    tempo: 68,
    rootMidi: 57,
    scale: MINOR,
    progression: [0, 5, 2, 6],
    leadDensity: 0.3,
    leadRange: [0, 7],
    padWave: "sine",
    leadWave: "triangle",
    level: 1,
    seed: 37,
  }),
  // Sunny and lazy.
  beach: world("beach", {
    tempo: 96,
    rootMidi: 67,
    scale: LYDIAN,
    progression: [0, 4, 5, 3],
    leadDensity: 0.55,
    leadRange: [0, 6],
    padWave: "sine",
    leadWave: "triangle",
    level: 0.85,
    seed: 41,
  }),
  // Busy and bouncy.
  jungle: world("jungle", {
    tempo: 104,
    rootMidi: 64,
    scale: DORIAN,
    progression: [0, 3, 0, 4],
    leadDensity: 0.6,
    leadRange: [0, 7],
    padWave: "triangle",
    leadWave: "triangle",
    level: 0.85,
    seed: 53,
  }),
  // Upbeat and bright.
  city: world("city", {
    tempo: 112,
    rootMidi: 58,
    scale: MIXOLYDIAN,
    progression: [0, 3, 4, 3],
    leadDensity: 0.5,
    leadRange: [0, 7],
    padWave: "triangle",
    leadWave: "square",
    level: 0.7,
    seed: 61,
  }),
  // Cold, slow and glassy.
  glacier: world("glacier", {
    tempo: 60,
    rootMidi: 65,
    scale: LYDIAN,
    progression: [0, 4, 3, 1],
    leadDensity: 0.25,
    leadRange: [2, 9],
    padWave: "sine",
    leadWave: "sine",
    level: 1,
    seed: 71,
  }),
  // Low and rumbling.
  volcano: world("volcano", {
    tempo: 80,
    rootMidi: 55,
    scale: PHRYGIAN,
    progression: [0, 1, 0, 5],
    leadDensity: 0.3,
    leadRange: [0, 5],
    padWave: "sawtooth",
    leadWave: "triangle",
    level: 0.6,
    seed: 83,
  }),
  // Tense but never loud.
  storm: world("storm", {
    tempo: 92,
    rootMidi: 62,
    scale: MINOR,
    progression: [0, 5, 3, 6],
    leadDensity: 0.4,
    leadRange: [0, 6],
    padWave: "triangle",
    leadWave: "sine",
    level: 0.85,
    seed: 97,
  }),
  // Open water, island hopping.
  islands: world("islands", {
    tempo: 88,
    rootMidi: 60,
    scale: LYDIAN,
    progression: [0, 5, 3, 4],
    leadDensity: 0.5,
    leadRange: [0, 7],
    padWave: "sine",
    leadWave: "triangle",
    level: 0.9,
    seed: 101,
  }),
};

/** The bed for a world. */
export function musicForWorld(levelId: LevelId): MusicSpec {
  return WORLD_MUSIC[levelId];
}

/** How loud the bed is on each screen: quieter in flight, where effects lead. */
export function musicLevelForScreen(screen: string): number {
  return screen === "flight" ? 0.55 : 1;
}
