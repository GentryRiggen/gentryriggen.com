"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import { focusRingClass } from "../styles";

interface Floater {
  id: number;
  text: string;
}

interface TapButtonProps {
  /** The phase's manual action; the button's accessible name. */
  label: string;
  /** Index of the current phase; picks the button's colours and icon. */
  phase: number;
  isStorm: boolean;
  /** True while a full-screen moment covers the game. */
  isCovered: boolean;
  /** Taps once and returns what the tap earned. */
  onTap: () => number;
}

interface PhaseLook {
  icon: string;
  classes: string;
}

/** Lantern for the coast, then generator, collector and flame. */
const LOOKS: PhaseLook[] = [
  {
    icon: "\u{1F3EE}",
    classes:
      "bg-amber-400 text-amber-950 shadow-amber-500/50 hover:bg-amber-300 dark:bg-amber-500 dark:shadow-amber-400/40",
  },
  {
    icon: "⚡",
    classes:
      "bg-lime-400 text-lime-950 shadow-lime-500/50 hover:bg-lime-300 dark:bg-lime-500 dark:shadow-lime-400/40",
  },
  {
    icon: "☀",
    classes:
      "bg-orange-400 text-orange-950 shadow-orange-500/50 hover:bg-orange-300 dark:bg-orange-500 dark:shadow-orange-400/40",
  },
  {
    icon: "\u{1F525}",
    classes:
      "bg-rose-400 text-rose-950 shadow-rose-500/50 hover:bg-rose-300 dark:bg-rose-500 dark:shadow-rose-400/40",
  },
];

const MAX_FLOATERS = 6;
const FLOATER_MS = 900;

export default function TapButton({
  label,
  phase,
  isStorm,
  isCovered,
  onTap,
}: TapButtonProps) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const handleClick = useCallback(() => {
    const gain = onTap();
    const button = buttonRef.current;
    if (button) {
      // Restart the press animation without remounting (keeps focus).
      button.classList.remove("lm-press");
      void button.offsetWidth;
      button.classList.add("lm-press");
    }
    if (!(gain > 0)) return;
    const id = nextId.current++;
    setFloaters((list) =>
      [...list, { id, text: `+${formatNumber(gain)}` }].slice(-MAX_FLOATERS)
    );
    timers.current.push(
      window.setTimeout(
        () => setFloaters((list) => list.filter((f) => f.id !== id)),
        FLOATER_MS
      )
    );
  }, [onTap]);

  const look = LOOKS[Math.min(phase, LOOKS.length - 1)];
  const shortLabel = label.split(" ")[0];
  const tone = isStorm
    ? "bg-sky-400 text-sky-950 shadow-sky-400/60 ring-4 ring-sky-300/70 hover:bg-sky-300 lm-glow"
    : look.classes;

  return (
    <div
      data-testid="lm-tap-fab"
      aria-hidden={isCovered}
      inert={isCovered}
      className={`pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))] z-30 lg:right-[calc(1.5rem+env(safe-area-inset-right))] ${
        isCovered ? "invisible" : ""
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-0"
      >
        {floaters.map((f, i) => (
          <span
            key={f.id}
            className={`lm-float absolute -top-1 text-xl font-bold tabular-nums text-amber-500 drop-shadow dark:text-amber-300 ${
              i % 2 === 0 ? "left-[40%]" : "left-[60%]"
            }`}
          >
            {f.text}
          </span>
        ))}
      </div>
      <button
        ref={buttonRef}
        type="button"
        data-testid="lm-tap"
        aria-label={label}
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()}
        className={`pointer-events-auto flex size-20 touch-manipulation select-none flex-col items-center justify-center rounded-full text-sm font-bold leading-tight shadow-xl transition-colors [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] active:brightness-95 sm:size-24 ${tone} ${focusRingClass}`}
      >
        <span aria-hidden="true" className="text-3xl leading-none">
          {look.icon}
        </span>
        <span aria-hidden="true" className="mt-0.5">
          {isStorm ? "x3!" : shortLabel}
        </span>
      </button>
    </div>
  );
}
