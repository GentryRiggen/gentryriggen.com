import { waitingVisitors } from "@/lib/ever-onward/engine/engine";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";

export interface StoryEntry {
  id: string;
  text: string;
}

export const NEWS_PREFIX = "NEWS:";

/**
 * The story lines the player can read, newest first. A waiting visitor shows
 * its line on its own card; it joins the story once the player says hello.
 */
export function storyEntries(def: UniverseDef, run: RunState): StoryEntry[] {
  const texts = new Map(def.story.map((m) => [m.id, m.text]));
  // A waiting visitor's line sits on its card, not in the list. A finished run
  // shows no cards, so a visitor who ends the run (Grow's someone-came-back)
  // keeps its line in the story.
  const onCard = new Set(
    run.complete ? [] : waitingVisitors(def, run).map((v) => v.id)
  );
  return run.story
    .filter((id) => !onCard.has(id))
    .reverse()
    .flatMap((id) => {
      const text = texts.get(id);
      return text ? [{ id, text }] : [];
    });
}

/** Splits an intro paragraph into its sentences for staggered display. */
export function introSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}
