"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { OpenLink } from "@/components/jim/notes/NotesUi";
import { EVENING_RETRO_HOUR, type RetroKind } from "@/lib/jim/routes";
import type { RetroData } from "@/lib/jim/view";

const TITLES: Record<RetroKind, string> = {
  morning: "Morning retro",
  evening: "Evening retro",
};

interface RetroCardProps {
  /** The payload's retro; without one the card hides. */
  retro: RetroData | undefined;
  onOpen: (kind: RetroKind) => void;
  hrefFor?: (kind: RetroKind) => string;
  /** The device's time, for tests; otherwise now, kept current. */
  now?: Date;
}

/** Ticks once a minute, so the card turns to the evening at 15:00. */
function useNow(fixed: Date | undefined): Date {
  const [now, setNow] = useState(() => fixed ?? new Date());
  useEffect(() => {
    if (fixed) return;
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [fixed]);
  return fixed ?? now;
}

/** Home: the retro for this time of day (morning before 15:00), Done once saved. */
export default function RetroCard({
  retro,
  onOpen,
  hrefFor,
  now: fixed,
}: RetroCardProps) {
  const now = useNow(fixed);
  if (!retro) return null;
  const kind: RetroKind =
    now.getHours() < EVENING_RETRO_HOUR ? "morning" : "evening";
  const side = retro[kind];
  const done = side.answers !== null;
  return (
    <OpenLink
      href={hrefFor?.(kind)}
      onOpen={() => onOpen(kind)}
      className="jim-card flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left hover:border-ayu-accent/40"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-medium text-ayu-text">
          {TITLES[kind]}
          {done && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-ayu-green">
              <Check aria-hidden="true" className="size-4" />
              Done
            </span>
          )}
        </span>
        <span className="block text-sm text-ayu-subtle [overflow-wrap:anywhere]">
          {side.questions[0]}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-5 shrink-0 text-ayu-subtle"
      />
    </OpenLink>
  );
}
