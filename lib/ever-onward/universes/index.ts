import type { UniverseDef } from "../engine/types";
import {
  SHOWS_UNRELEASED,
  lockedUniverses,
  playableUniverses,
  type LockedUniverse,
} from "./staging";

export type { LockedUniverse };

/** Playable universes, in hub order. Add a universe in `staging.ts`. */
export const PLAYABLE_UNIVERSES: readonly UniverseDef[] =
  playableUniverses(SHOWS_UNRELEASED);

/** Shown after the playable ones as "coming soon". */
export const LOCKED_UNIVERSES: readonly LockedUniverse[] =
  lockedUniverses(SHOWS_UNRELEASED);

export function getPlayableUniverse(id: string): UniverseDef | undefined {
  return PLAYABLE_UNIVERSES.find((u) => u.id === id);
}
