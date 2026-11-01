"use client";

import { useEffect, useRef, useState } from "react";
import CrtOverlay from "./retro/CrtOverlay";
import { retroPrimaryButtonClass } from "./retro/retroStyles";

interface EndingOverlayProps {
  /** The closing lines, in order. */
  lines: readonly string[];
  onContinue: () => void;
}

/** Fixed classes so Tailwind sees them; line i appears after DELAYS[i]. */
const DELAYS = [
  "[animation-delay:1s]",
  "[animation-delay:4.5s]",
  "[animation-delay:8s]",
  "[animation-delay:11s]",
];

/** The Continue button fades in last; it can't take focus before it shows. */
const BUTTON_READY_MS = 11_500;

export default function EndingOverlay({
  lines,
  onContinue,
}: EndingOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Keyboard users start inside the dialog, not behind it.
  useEffect(() => {
    dialogRef.current?.focus();
    const timer = window.setTimeout(() => setIsReady(true), BUTTON_READY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isReady) buttonRef.current?.focus();
  }, [isReady]);

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="The ending"
      data-testid="lm-ending"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black p-6 text-slate-50 outline-none"
    >
      <div className="pointer-events-none fixed inset-0">
        <CrtOverlay />
      </div>
      <div className="relative max-w-md space-y-6 py-8 text-center">
        <div
          aria-hidden="true"
          className="lm-flicker mx-auto size-3 bg-amber-300 shadow-[0_0_40px_14px_rgb(251_191_36/0.45)]"
        />
        {lines.map((line, i) => (
          <p
            key={line}
            className={`lm-fade-up font-mono text-lg text-slate-100 ${DELAYS[Math.min(i, DELAYS.length - 2)]}`}
          >
            {line}
          </p>
        ))}
        <div
          inert={!isReady}
          className={`lm-fade-up ${DELAYS[DELAYS.length - 1]}`}
        >
          <button
            ref={buttonRef}
            type="button"
            onClick={onContinue}
            className={`${retroPrimaryButtonClass} min-w-40 !ring-offset-black`}
          >
            <span aria-hidden="true">▶︎</span>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
