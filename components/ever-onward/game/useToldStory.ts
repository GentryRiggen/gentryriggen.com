"use client";

import { useMemo, useState } from "react";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";

/**
 * Game seconds between two story lines on screen. The engine fires lines the
 * moment they are due (gates and visitors count on that), but several often
 * come due together; the player is told them one at a time instead.
 */
export const STORY_GAP = 45;

export interface Told {
  universe: string;
  count: number;
  /** Run time the last line was told. */
  at: number;
}

/** Where the telling stands after this frame of the run. */
export function advanceTold(def: UniverseDef, run: RunState, told: Told): Told {
  let t = told;
  if (t.universe !== def.id || run.story.length < t.count || run.time < t.at) {
    // A new universe or a restart: what is there now counts as told.
    return { universe: def.id, count: run.story.length, at: run.time };
  }
  while (t.count < run.story.length) {
    const id = run.story[t.count];
    const isOpener = def.story.find((m) => m.id === id)?.when === undefined;
    if (!isOpener && run.time - t.at < STORY_GAP) break;
    t = { ...t, count: t.count + 1, at: run.time };
  }
  return t;
}

/**
 * The run's story as far as the player has been told it: lines due on load
 * count as told, then each new one waits until STORY_GAP game seconds after
 * the one before. A part's opening line (no condition) never waits.
 */
export function useToldStory(def: UniverseDef, run: RunState): RunState {
  const [told, setTold] = useState<Told>(() => ({
    universe: def.id,
    count: run.story.length,
    at: run.time,
  }));
  const next = advanceTold(def, run, told);
  if (next !== told) setTold(next);
  const { count } = next;
  return useMemo(
    () =>
      count >= run.story.length
        ? run
        : { ...run, story: run.story.slice(0, count) },
    [run, count]
  );
}
