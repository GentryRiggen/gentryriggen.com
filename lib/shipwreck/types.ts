/** Shared Shipwreck types. */

export const CAMERA_IDS = [
  "orbit",
  "bridge",
  "stern",
  "lifeboat",
  "underwater",
  "cinematic",
  "walk",
] as const;
export type CameraId = (typeof CAMERA_IDS)[number];

export const OUTCOME_IDS = ["sank", "floated", "broke-in-two"] as const;
export type OutcomeId = (typeof OUTCOME_IDS)[number];

/** Simulation speed: real time, 10x, 30x or 100x. */
export const SPEEDS = [1, 10, 30, 100] as const;
export type Speed = (typeof SPEEDS)[number];
