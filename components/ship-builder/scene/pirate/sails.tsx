import { CrateMesh } from "./fallback";
import type { PirateMesh } from "./shared";

/** Task 3 replaces these crates with masts, sails and the flag. */
export const SAIL_MESHES = {
  "mast-wood-short": CrateMesh,
  "mast-wood-tall": CrateMesh,
  "mast-wood-main": CrateMesh,
  "sail-square-small": CrateMesh,
  "sail-square": CrateMesh,
  "sail-square-large": CrateMesh,
  "sail-jib": CrateMesh,
  "sail-lateen": CrateMesh,
  "flag-jolly-roger": CrateMesh,
} satisfies Record<string, PirateMesh>;
