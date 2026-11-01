"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/little-machines/engine/format";
import { focusRingClass } from "../styles";

interface Floater {
  id: number;
  text: string;
}

interface TapButtonProps {
  label: string;
  isStorm: boolean;
  /** Taps once and returns what the tap earned. */
  onTap: () => number;
}

const MAX_FLOATERS = 6;
const FLOATER_MS = 900;

export default function TapButton({ label, isStorm, onTap }: TapButtonProps) {
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

  const storm = isStorm
    ? "bg-sky-400 text-sky-950 ring-4 ring-sky-300/70 hover:bg-sky-300 lm-glow"
    : "bg-amber-400 text-amber-950 hover:bg-amber-300 dark:bg-amber-500 dark:hover:bg-amber-400";

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0"
      >
        {floaters.map((f, i) => (
          <span
            key={f.id}
            className={`lm-float absolute top-2 text-xl font-bold tabular-nums text-amber-500 drop-shadow dark:text-amber-300 ${
              i % 2 === 0 ? "left-[38%]" : "left-[62%]"
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
        onClick={handleClick}
        className={`min-h-20 w-full touch-manipulation select-none rounded-2xl px-6 py-4 text-xl font-bold shadow-lg transition-colors active:brightness-95 ${storm} ${focusRingClass}`}
      >
        {label}
        {isStorm && (
          <span className="mt-0.5 block text-sm font-semibold">
            Storm! Taps count triple
          </span>
        )}
      </button>
    </div>
  );
}
