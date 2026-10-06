import { CrateDecor, CrateMesh } from "./fallback";
import type { PirateDecor, PirateMesh } from "./shared";

/** Task 6 replaces this crate with the plank. */
export const CREW_MESHES = {
  plank: CrateMesh,
} satisfies Record<string, PirateMesh>;

/** Task 6 replaces these crates with a pirate and a parrot. */
export const CREW_DECOR = {
  "pirate-crew": CrateDecor,
  parrot: CrateDecor,
} satisfies Record<string, PirateDecor>;
