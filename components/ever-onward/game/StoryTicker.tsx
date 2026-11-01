"use client";

import { useRef, useState } from "react";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import StoryDrawer from "./StoryDrawer";
import { NEWS_PREFIX, storyEntries } from "./storyEntries";
import {
  pixelClass,
  retroFocusClass,
  retroQuietPanelClass,
} from "./retro/retroStyles";

interface StoryTickerProps {
  def: UniverseDef;
  run: RunState;
  /** Ending lines keep their own place at the end of the drawer. */
  endingIds: string[];
}

/**
 * One line of the newest story near the top of the page, with a button that
 * opens the whole story. Lines the player has not opened the drawer for yet
 * count as unread (kept in component state only).
 */
export default function StoryTicker({ def, run, endingIds }: StoryTickerProps) {
  const entries = storyEntries(def, run);
  // Lines already there when the screen opens are not news.
  const [seen, setSeen] = useState(
    () => new Set(storyEntries(def, run).map((e) => e.id))
  );
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unread = entries.filter((e) => !seen.has(e.id)).length;
  const newest = entries[0];
  const isNews = newest?.text.startsWith(NEWS_PREFIX) ?? false;
  const newestText = newest
    ? isNews
      ? newest.text.slice(NEWS_PREFIX.length).trim()
      : newest.text
    : "The story begins when the lamp is lit.";

  const handleOpen = () => {
    setSeen(new Set(entries.map((e) => e.id)));
    setIsOpen(true);
  };
  const handleClose = () => {
    setIsOpen(false);
    // The panel unmounts first; put focus back on the button that opened it.
    window.setTimeout(() => buttonRef.current?.focus(), 0);
  };

  return (
    <section
      aria-label="Latest story"
      data-testid="lm-story-ticker"
      className={`${retroQuietPanelClass} flex items-stretch gap-2 p-2`}
    >
      {/* Announces only the newest line, not the whole list each time. */}
      <p aria-live="polite" className="sr-only">
        {newest ? newest.text.replace(NEWS_PREFIX, "News:") : ""}
      </p>
      <p
        key={newest?.id}
        aria-hidden="true"
        className={`${newest ? "lm-fade-up" : ""} line-clamp-2 min-w-0 flex-1 self-center font-mono text-xs text-slate-100 sm:text-sm`}
      >
        {unread > 0 && (
          <span
            data-testid="lm-story-new"
            className={`${pixelClass} mr-2 inline-block border-2 border-amber-300 bg-amber-500 px-1.5 py-1 align-middle text-[8px] leading-none text-slate-950 motion-safe:animate-pulse`}
          >
            NEW
          </span>
        )}
        {isNews && (
          <span
            className={`${pixelClass} mr-2 inline-block border-2 border-red-300 bg-red-700 px-1.5 py-1 align-middle text-[8px] leading-none text-white`}
          >
            NEWS
          </span>
        )}
        {newestText}
      </p>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={handleOpen}
        className={`${pixelClass} inline-flex min-h-11 shrink-0 touch-manipulation items-center justify-center border-2 border-amber-300 bg-amber-950/60 px-3 text-[10px] text-amber-300 hover:bg-amber-900/70 active:translate-y-0.5 ${retroFocusClass}`}
      >
        Story ({entries.length})
        {unread > 0 && <span className="sr-only"> , {unread} new</span>}
      </button>
      {isOpen && (
        <StoryDrawer
          def={def}
          run={run}
          entries={entries}
          endingIds={endingIds}
          onClose={handleClose}
        />
      )}
    </section>
  );
}
