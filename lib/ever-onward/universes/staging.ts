import type { UniverseDef } from "../engine/types";
import { growUniverse } from "./grow";
import { lightUniverse } from "./light";

/** A universe that is announced but not built yet. */
export interface LockedUniverse {
  id: string;
  title: string;
  goal: string;
}

/**
 * Unfinished universes show up in development and in the e2e build, never in
 * the build that ships (the `lib/ship-builder/testHooks.ts` pattern).
 */
export const SHOWS_UNRELEASED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1";

/** Ids of universes that are built but not released yet. */
export const UNRELEASED_IDS: readonly string[] = ["grow"];

/** Every universe that is built, in hub order. */
export const ALL_UNIVERSES: readonly UniverseDef[] = [
  lightUniverse,
  growUniverse,
];

/** Every announced universe, in hub order. */
const ANNOUNCED: readonly LockedUniverse[] = [
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

export function playableUniverses(
  showsUnreleased: boolean,
  unreleased: readonly string[] = UNRELEASED_IDS
): readonly UniverseDef[] {
  return ALL_UNIVERSES.filter(
    (u) => showsUnreleased || !unreleased.includes(u.id)
  );
}

export function lockedUniverses(
  showsUnreleased: boolean,
  unreleased: readonly string[] = UNRELEASED_IDS
): readonly LockedUniverse[] {
  const playable = new Set(
    playableUniverses(showsUnreleased, unreleased).map((u) => u.id)
  );
  return ANNOUNCED.filter((l) => !playable.has(l.id));
}
