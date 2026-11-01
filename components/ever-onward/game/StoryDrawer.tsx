"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import { introClipId, storyClipId } from "@/lib/ever-onward/narration/lines";
import ListenButton from "../narration/ListenButton";
import PhaseBriefing from "./PhaseBriefing";
import { NEWS_PREFIX, type StoryEntry } from "./storyEntries";
import RetroHeading from "./retro/RetroHeading";
import {
  pixelClass,
  pixelFont,
  retroFocusClass,
  retroPanelClass,
} from "./retro/retroStyles";

interface StoryDrawerProps {
  def: UniverseDef;
  run: RunState;
  /** Newest first. */
  entries: StoryEntry[];
  endingIds: string[];
  onClose: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The whole story in a bottom sheet (phones) or side panel (wide screens),
 * with the intros of the parts reached so far on top for re-reading.
 */
export default function StoryDrawer({
  def,
  run,
  entries,
  endingIds,
  onClose,
}: StoryDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [openIntro, setOpenIntro] = useState<string | null>(null);
  const endings = useMemo(() => new Set(endingIds), [endingIds]);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Focus Close once, when the drawer opens (not on every re-render).
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (!panelRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const reached = def.phases.slice(0, run.phase + 1);

  // Portalled out of <main> and the ticker, so it is not inert or nested in
  // a landmark while it is the thing in front.
  return createPortal(
    <div
      className={`${pixelFont.variable} dark fixed inset-0 z-50 flex items-end lg:items-stretch lg:justify-end`}
    >
      <div
        aria-hidden="true"
        data-testid="lm-story-backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-[#02030a]/80"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lm-story-title"
        data-testid="lm-story-drawer"
        className={`${retroPanelClass} lm-fade-up relative flex max-h-[85dvh] w-full flex-col !bg-slate-950 text-amber-50 lg:max-h-none lg:max-w-xl lg:border-y-0 lg:border-r-0`}
      >
        <div className="flex items-center justify-between gap-3 border-b-4 border-amber-500/60 p-3">
          <RetroHeading as="h2" id="lm-story-title" className="text-sm">
            Story
          </RetroHeading>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close story"
            className={`${pixelClass} inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center border-2 border-slate-500 bg-slate-900 px-3 text-[10px] text-slate-100 hover:bg-slate-800 ${retroFocusClass}`}
          >
            ✕ Close
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto overscroll-contain p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <section aria-label="Intros" className="space-y-2">
            {reached.map((phase, i) => {
              const isOpen = openIntro === phase.id;
              return (
                <div key={phase.id} className="border-2 border-slate-700">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenIntro(isOpen ? null : phase.id)}
                    className={`flex min-h-11 w-full items-center justify-between gap-2 bg-slate-900/80 px-3 text-left font-mono text-xs text-cyan-100 hover:bg-slate-800 ${retroFocusClass}`}
                  >
                    <span>
                      Intro · Part {i + 1}: {phase.title}
                    </span>
                    <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <div className="p-3">
                      <PhaseBriefing
                        phase={phase}
                        clipId={introClipId(def.id, phase.id)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </section>
          <ol className="space-y-3">
            {entries.map((entry, i) => {
              const isNews = entry.text.startsWith(NEWS_PREFIX);
              return (
                <li
                  key={entry.id}
                  className={`font-mono ${
                    i === 0
                      ? "text-base text-amber-50"
                      : "text-sm text-slate-300"
                  } ${endings.has(entry.id) ? "text-amber-100" : ""}`}
                >
                  {i === 0 && (
                    <span aria-hidden="true" className="mr-2 text-amber-300">
                      ▶︎
                    </span>
                  )}
                  {isNews && (
                    <span
                      className={`${pixelClass} mr-2 inline-block border-2 border-red-300 bg-red-700 px-1.5 py-1 text-[8px] leading-none text-white`}
                    >
                      NEWS
                    </span>
                  )}
                  {isNews
                    ? entry.text.slice(NEWS_PREFIX.length).trim()
                    : entry.text}
                  <ListenButton
                    clipId={storyClipId(def.id, entry.id)}
                    accessibleLabel="Listen to this message"
                    className="ml-2 size-8 border-2 border-slate-500 align-middle text-xs text-amber-300 hover:bg-slate-800"
                  />
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>,
    document.body
  );
}
