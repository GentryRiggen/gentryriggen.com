"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { TapLook } from "../universes/types";
import PixelIcon from "./retro/PixelIcon";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

interface Floater {
  id: number;
  text: string;
}

interface TapButtonProps {
  /** The phase's manual action; the button's accessible name. */
  label: string;
  /** The current phase's colours and icon. */
  look: TapLook;
  isStorm: boolean;
  /** True while a full-screen moment covers the game. */
  isCovered: boolean;
  /** Taps once and returns what the tap earned. */
  onTap: () => number;
}

const MAX_FLOATERS = 6;
const FLOATER_MS = 900;

export default function TapButton({
  label,
  look,
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

  const shortLabel = label.split(" ")[0];
  const tone = isStorm
    ? "border-sky-200 bg-sky-950 text-sky-200 shadow-[4px_4px_0_#0c4a6e,0_0_30px_rgba(56,189,248,0.7)] ring-4 ring-sky-300/70 hover:bg-sky-900"
    : look.classes;

  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 h-36 bg-linear-to-t from-[#02030a] via-[#02030a]/85 to-transparent lg:left-[55%] ${
          isCovered ? "invisible" : ""
        }`}
      />
      <div
        data-testid="lm-tap-fab"
        aria-hidden={isCovered}
        inert={isCovered}
        className={`pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 lg:left-[77.5%] ${
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
              className={`lm-float ${pixelClass} absolute -top-1 text-sm tabular-nums text-amber-300 [text-shadow:2px_2px_0_#78350f] ${
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
          className={`${pixelClass} pointer-events-auto flex size-20 touch-manipulation select-none flex-col items-center justify-center gap-1.5 border-4 text-[8px] leading-none transition-transform [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] active:translate-y-0.5 sm:size-24 sm:text-[9px] ${tone} ${retroFocusClass}`}
        >
          <PixelIcon name={look.icon} className="size-8 sm:size-10" />
          <span aria-hidden="true">{isStorm ? "x3!" : shortLabel}</span>
        </button>
      </div>
    </>
  );
}
