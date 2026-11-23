"use client";

import { useEffect, useRef } from "react";
import { SAFE_INSETS } from "@/lib/game-kit/safeArea";
import { HISTORY_NOTE, type EndWords } from "@/lib/shipwreck/story";
import Icon from "./Icon";
import { PANEL, PRIMARY, SECONDARY } from "./styles";

interface EndCardProps {
  words: EndWords;
  /** "What really happened" (default: the Titanic's). */
  history?: string;
  /** What sank her: the What if? button's icon. */
  cause?: "iceberg" | "torpedo" | "storm" | "mine";
  /** First time this ending was seen: a small celebration. */
  isNew: boolean;
  onWatchAgain: () => void;
  onWhatIf: () => void;
  /** Look at the wreck (sank) or keep looking around (floated). */
  onLook: () => void;
}

/** How the night ended, and what to do next. */
export default function EndCard({
  words,
  history = HISTORY_NOTE,
  cause = "iceberg",
  isNew,
  onWatchAgain,
  onWhatIf,
  onLook,
}: EndCardProps) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => firstRef.current?.focus(), []);
  const floated = words.outcome === "floated";

  return (
    <div
      className={`absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/30 p-4 ${SAFE_INSETS}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={words.title}
        data-testid="shipwreck-end"
        data-outcome={words.outcome}
        className={`${PANEL} sw-pop-in relative flex w-full max-w-lg flex-col gap-3 p-5 sm:p-7`}
      >
        {isNew && (
          <p
            data-testid="shipwreck-new-ending"
            className="sw-badge self-start rounded-full bg-amber-300 px-3 py-1 text-sm font-bold text-slate-900"
          >
            ★ New ending found!
          </p>
        )}
        <h2 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
          {words.title}
        </h2>
        {words.lines.map((l) => (
          <p key={l} className="text-lg leading-snug text-slate-100">
            {l}
          </p>
        ))}
        {!floated && (
          <p className="rounded-xl bg-white/5 px-3 py-2 text-base leading-snug text-slate-300">
            {history}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            ref={firstRef}
            type="button"
            data-testid="shipwreck-look"
            aria-label={floated ? "Look around the ship" : "Look at the wreck"}
            onClick={onLook}
            className={PRIMARY}
          >
            <Icon name={floated ? "orbit" : "wreck"} className="size-7" />
            {floated ? "Look around" : "Look at the wreck"}
          </button>
          <button
            type="button"
            data-testid="shipwreck-watch-again"
            aria-label="Watch again from the start"
            onClick={onWatchAgain}
            className={SECONDARY}
          >
            <Icon name="replay" className="size-7" />
            Watch again
          </button>
          <button
            type="button"
            data-testid="shipwreck-try-what-if"
            aria-label="Try What if?"
            onClick={onWhatIf}
            className={SECONDARY}
          >
            <Icon name={cause} className="size-7" />
            Try What if?
          </button>
        </div>
      </div>
    </div>
  );
}
