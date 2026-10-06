import { CrateMesh } from "./fallback";
import type { PirateMesh } from "./shared";

/** Task 4 replaces these crates with cannons. */
export const CANNON_MESHES = {
  "cannon-deck": CrateMesh,
  "cannon-chaser": CrateMesh,
  "cannon-swivel": CrateMesh,
} satisfies Record<string, PirateMesh>;
