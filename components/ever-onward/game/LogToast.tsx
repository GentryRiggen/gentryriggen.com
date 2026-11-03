"use client";

import { useEffect, useRef, useState } from "react";
import type { LogEntry, RunState } from "@/lib/ever-onward/engine/types";
import LogTag from "./LogTag";
import { retroPanelClass } from "./retro/retroStyles";

interface LogToastProps {
  run: RunState;
  /** A full-screen moment is open: hold the pop-up back. */
  isSuppressed?: boolean;
}

export const LOG_TOAST_MS = 5000;

/**
 * Pops up each new running-log line (a storm landed, the nets came in) for a
 * few seconds, just above the big button. The Log keeps every line, and the
 * story ticker already reads the newest one aloud to screen readers, so this
 * is for the eyes only.
 */
export default function LogToast({ run, isSuppressed = false }: LogToastProps) {
  const latest = run.log?.at(-1);
  // Lines already there when the screen opens are not news.
  const lastSeen = useRef<LogEntry | undefined>(latest);
  const [shown, setShown] = useState<LogEntry | null>(null);

  useEffect(() => {
    if (!latest || latest === lastSeen.current) return;
    lastSeen.current = latest;
    if (isSuppressed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(latest);
  }, [latest, isSuppressed]);

  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(() => setShown(null), LOG_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);

  if (!shown || isSuppressed) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="lm-log-toast"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(7.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-3 lg:inset-x-auto lg:left-[72.5%] lg:-translate-x-1/2"
    >
      <p
        key={`${shown.at}:${shown.text}`}
        className={`${retroPanelClass} lm-fade-up w-[min(92vw,26rem)] p-3 font-mono text-xs text-slate-100 sm:text-sm`}
      >
        <LogTag tone={shown.tone} />
        {shown.text}
      </p>
    </div>
  );
}
