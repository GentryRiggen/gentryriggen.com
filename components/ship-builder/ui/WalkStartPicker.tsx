"use client";

import { useEffect, useRef } from "react";
import type { WalkStart } from "@/lib/ship-builder/walk";
import { panelClass } from "./styles";

interface StartOption {
  start: WalkStart;
  name: string;
  word: string;
  note: string;
}

const OPTIONS: readonly StartOption[] = [
  { start: "bow", name: "Front (bow)", word: "Front", note: "bow" },
  { start: "middle", name: "Middle", word: "Middle", note: "bridge" },
  { start: "stern", name: "Back (stern)", word: "Back", note: "stern" },
];

/** Where the glowing marker sits along the deck, in the picture's units. */
const MARKER_X: Record<WalkStart, number> = {
  bow: 84,
  middle: 52,
  stern: 12,
};

/**
 * A little side view of a ship, bow to the right, with a glowing marker where
 * the walk would start.
 */
export function WalkStartPicture({ start }: { start: WalkStart }) {
  const markerX = MARKER_X[start];
  return (
    <svg
      viewBox="0 0 96 40"
      aria-hidden="true"
      className="h-10 w-24 shrink-0"
      focusable="false"
    >
      <rect
        x="38"
        y="4"
        width="5"
        height="14"
        rx="1"
        className="fill-slate-500 dark:fill-slate-400"
      />
      <rect
        x="46"
        y="9"
        width="22"
        height="9"
        rx="1.5"
        className="fill-slate-600 dark:fill-slate-300"
      />
      <rect
        x="52"
        y="4"
        width="10"
        height="5"
        rx="1"
        className="fill-slate-600 dark:fill-slate-300"
      />
      <path
        d="M6 18 H93 L81 31 H6 Z"
        className="fill-slate-700 dark:fill-slate-300"
      />
      <path
        d="M0 28 q6 -3 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        className="stroke-sky-500 dark:stroke-sky-400"
      />
      <circle
        cx={markerX}
        cy="18"
        r="9"
        className="fill-amber-500/30 dark:fill-amber-400/30"
      />
      <circle
        cx={markerX}
        cy="18"
        r="5"
        strokeWidth="1.5"
        className="fill-amber-500 stroke-white dark:fill-amber-400 dark:stroke-slate-900"
      />
    </svg>
  );
}

interface WalkStartPickerProps {
  /** Id for the card, so the Walk button can point at it. */
  id: string;
  onPick: (start: WalkStart) => void;
  /** Where the card sits over the button: its right edge, or its centre. */
  align?: "end" | "center";
}

/**
 * The small card that asks where to start walking, with a big picture button
 * for the front, middle and back of the ship. Focus lands on Middle. The Walk
 * button owns closing it (Esc, a press outside).
 */
export default function WalkStartPicker({
  id,
  onPick,
  align = "end",
}: WalkStartPickerProps) {
  const middle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    middle.current?.focus();
  }, []);

  return (
    <div
      id={id}
      role="dialog"
      aria-label="Where do you want to start?"
      className={`pointer-events-auto absolute bottom-full ${
        align === "center" ? "left-1/2 -translate-x-1/2" : "right-0"
      } z-30 mb-2 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 rounded-2xl border p-3 shadow-xl motion-safe:animate-scaleUp ${panelClass}`}
    >
      <h2 className="text-sm font-semibold">Where do you want to start?</h2>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ start, name, word, note }) => (
          <button
            key={start}
            ref={start === "middle" ? middle : undefined}
            type="button"
            aria-label={name}
            onClick={() => onPick(start)}
            className="flex min-h-11 touch-manipulation flex-col items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-1 py-2 text-slate-800 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:outline-amber-300"
          >
            <WalkStartPicture start={start} />
            <span className="flex flex-col items-center leading-tight">
              <span className="text-base font-semibold">{word}</span>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {note}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
