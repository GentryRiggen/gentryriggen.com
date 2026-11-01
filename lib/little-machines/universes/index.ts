import type { UniverseDef } from "../engine/types";

/** A universe that is announced but not built yet. */
export interface LockedUniverse {
  id: string;
  title: string;
  goal: string;
}

/** Playable universes, in hub order. Add a universe by importing it here. */
export const PLAYABLE_UNIVERSES: readonly UniverseDef[] = [];

/** Shown after the playable ones as "coming soon". */
export const LOCKED_UNIVERSES: readonly LockedUniverse[] = [
  {
    id: "grow",
    title: "Make It Grow",
    goal: "Help one small seed grow, and then keep helping.",
  },
  {
    id: "higher",
    title: "Build It Higher",
    goal: "Stack one more block, then one more, then one more.",
  },
  {
    id: "smile",
    title: "Make Everyone Smile",
    goal: "Cheer up one friend, and see how far the cheer can go.",
  },
];

export function getPlayableUniverse(id: string): UniverseDef | undefined {
  return PLAYABLE_UNIVERSES.find((u) => u.id === id);
}
