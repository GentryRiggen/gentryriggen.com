import { waitingVisitors } from "@/lib/ever-onward/engine/engine";
import type {
  LogTone,
  RunState,
  UniverseDef,
} from "@/lib/ever-onward/engine/types";

export interface StoryEntry {
  id: string;
  text: string;
  /** A running-log line (a storm landed), not a story message. */
  event?: { tone: LogTone; at: number };
}

export const NEWS_PREFIX = "NEWS:";

/**
 * The story lines and running-log lines the player can read, newest first. A
 * waiting visitor shows its line on its own card; it joins the story once the
 * player says hello.
 */
export function storyEntries(def: UniverseDef, run: RunState): StoryEntry[] {
  const texts = new Map(def.story.map((m) => [m.id, m.text]));
  // A waiting visitor's line sits on its card, not in the list. A finished run
  // shows no cards, so a visitor who ends the run (Grow's someone-came-back)
  // keeps its line in the story.
  const onCard = new Set(
    run.complete ? [] : waitingVisitors(def, run).map((v) => v.id)
  );
  const log = run.log ?? [];
  const out: StoryEntry[] = [];
  let next = 0;
  // A log line written after `after` story lines goes just after them.
  const takeLog = (upTo: number) => {
    while (next < log.length && log[next].after <= upTo) {
      const e = log[next];
      out.push({
        id: `log:${e.at}:${e.text}`,
        text: e.text,
        event: { tone: e.tone, at: e.at },
      });
      next += 1;
    }
  };
  run.story.forEach((id, i) => {
    takeLog(i);
    const text = texts.get(id);
    if (text && !onCard.has(id)) out.push({ id, text });
  });
  takeLog(Infinity);
  return out.reverse();
}

/** Splits an intro paragraph into its sentences for staggered display. */
export function introSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}
