import { waitingVisitors } from "@/lib/ever-onward/engine/engine";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";

import { storyClipId } from "@/lib/ever-onward/narration/lines";
import ListenButton from "../narration/ListenButton";
import { pixelClass, retroQuietPanelClass } from "./retro/retroStyles";

interface StoryLogProps {
  def: UniverseDef;
  run: RunState;
}

const VISIBLE = 5;
const NEWS_PREFIX = "NEWS:";
const FADE = [
  "text-base text-amber-50",
  "text-sm text-slate-200",
  "text-sm text-slate-300",
  "text-sm text-slate-400",
  "text-sm text-slate-500",
];

export default function StoryLog({ def, run }: StoryLogProps) {
  const texts = new Map(def.story.map((m) => [m.id, m.text]));
  // A waiting visitor shows its line on its own card; it joins the log once
  // the player has said hello.
  const onCard = new Set(waitingVisitors(def, run).map((v) => v.id));
  const latest = run.story
    .filter((id) => !onCard.has(id))
    .slice(-VISIBLE)
    .reverse()
    .flatMap((id) => {
      const text = texts.get(id);
      return text ? [{ id, text }] : [];
    });
  if (latest.length === 0) return null;
  return (
    <section
      aria-label="Story"
      className={`${retroQuietPanelClass} space-y-3 p-3`}
    >
      {/* Announces only the newest line, not the whole list each time. */}
      <p aria-live="polite" className="sr-only">
        {latest[0].text.replace(NEWS_PREFIX, "News:")}
      </p>
      {latest.map((m, i) => {
        const isNews = m.text.startsWith(NEWS_PREFIX);
        return (
          <p
            key={m.id}
            className={`font-mono ${i === 0 ? "lm-fade-up" : ""} ${FADE[i]}`}
          >
            {i === 0 && (
              <span aria-hidden="true" className="mr-2 text-amber-300">
                ▶
              </span>
            )}
            {isNews && (
              <span
                className={`${pixelClass} mr-2 inline-block border-2 border-red-300 bg-red-700 px-1.5 py-1 text-[8px] leading-none text-white`}
              >
                NEWS
              </span>
            )}
            {isNews ? m.text.slice(NEWS_PREFIX.length).trim() : m.text}
            <ListenButton
              clipId={storyClipId(def.id, m.id)}
              accessibleLabel="Listen to this message"
              className="ml-2 size-8 border-2 border-slate-500 align-middle text-xs text-amber-300 hover:bg-slate-800"
            />
          </p>
        );
      })}
    </section>
  );
}
