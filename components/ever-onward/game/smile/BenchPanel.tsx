"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  BACK_ACTION_ID,
  CLOSER_ACTION_ID,
  TELL_WORDS,
  benchLine,
  benchStatus,
  closeMult,
  closeMultAt,
  isAway,
  isMoving,
  isQuietOpen,
  seatOf,
  tellOf,
  trustFraction,
} from "@/lib/ever-onward/universes/smile/quiet";
import { TUNING } from "@/lib/ever-onward/universes/smile/tuning";
import { quietOpeningLine } from "@/lib/ever-onward/universes/smile/world";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const Q = TUNING.quiet;
const times = (n: number): string => `${Number(n.toFixed(2))}x`;

/** The seats along the bench, far end to side by side. */
const SEATS = Array.from({ length: Q.seats + 1 }, (_, i) => i);

/**
 * The bench: your one dial. Sitting closer builds trust faster, but only when
 * the friend is ready, and their body language is the only clue. Two plain
 * buttons (stable labels, aria-disabled while a move is under way or they are
 * at the far end, never remounted). A move takes a moment, and nothing is
 * ever lost for good.
 */
export default function BenchPanel({ def, run, onAct }: PanelProps) {
  if (!isQuietOpen(run) || run.complete) return null;

  const seat = seatOf(run);
  const moving = isMoving(run);
  const away = isAway(run);
  const percent = Math.floor(trustFraction(run) * 100);
  const tell = tellOf(run);
  const buttons = [
    {
      id: CLOSER_ACTION_ID,
      testId: "ms-bench-closer",
      label: "Scoot closer",
      plus: `Trust builds up to ${times(closeMultAt(run, Q.seats))} as fast`,
      minus: "Too soon and they pull away, and lose trust",
      note: moving
        ? "Scooting along the bench"
        : away
          ? "They need a moment"
          : seat >= Q.seats
            ? "You are side by side"
            : "One seat closer",
    },
    {
      id: BACK_ACTION_ID,
      testId: "ms-bench-back",
      label: "Scoot back",
      plus: "Gives them room, and nobody pulls away",
      minus: "Trust builds slower from further away",
      note: moving
        ? "Scooting along the bench"
        : seat <= 0
          ? "You are at the far end"
          : "One seat back",
    },
  ];

  return (
    <PanelFrame
      label="The friend on the bench"
      title="The bench"
      tone="sky"
      status={`${percent}% trust`}
      statusActive={tell === 3}
      testId="ms-bench"
      data={{
        "data-seat": seat,
        "data-tell": tell,
        "data-moving": moving ? "yes" : "no",
        "data-away": away ? "yes" : "no",
      }}
      result={benchLine(run) ?? ""}
      resultTestId="ms-bench-result"
    >
      <p
        data-testid="ms-bench-status"
        className={`${pixelClass} text-xs leading-relaxed text-slate-100 sm:text-sm`}
      >
        {benchStatus(run)}. Trust builds {times(closeMult(run))} as fast.
      </p>
      <p
        data-testid="ms-bench-tell"
        className="font-mono text-sm font-bold text-sky-100"
      >
        {TELL_WORDS[tell]}
      </p>
      {quietOpeningLine(run) && (
        <p
          data-testid="ms-bench-opening"
          className="font-mono text-xs font-bold text-sky-100"
        >
          {quietOpeningLine(run)}
        </p>
      )}
      <div
        aria-hidden="true"
        data-testid="ms-bench-seats"
        className="flex items-center gap-1"
      >
        {SEATS.map((i) => (
          <span
            key={i}
            className={`h-3 flex-1 border-2 ${
              i === seat
                ? "border-sky-100 bg-sky-300"
                : "border-slate-600 bg-slate-800"
            }`}
          />
        ))}
        <span className="h-4 w-4 shrink-0 bg-amber-200" />
      </div>
      <div
        role="group"
        aria-label="Move along the bench"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {buttons.map((b) => {
          const doable = canPerformAction(def, run, b.id);
          return (
            <button
              key={b.id}
              type="button"
              aria-disabled={!doable}
              aria-label={b.label}
              aria-describedby={`${b.testId}-note`}
              data-testid={b.testId}
              onClick={() => {
                if (doable) onAct(b.id);
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                doable
                  ? "border-sky-200 bg-sky-400 text-sky-950 shadow-[4px_4px_0_#0c4a6e] hover:bg-sky-300 active:translate-y-0.5 active:shadow-none"
                  : "border-slate-600 bg-slate-800 text-slate-400 shadow-[4px_4px_0_#0f172a]"
              }`}
            >
              <span className="block">{b.label}</span>
              <span
                id={`${b.testId}-note`}
                className="block font-mono text-xs leading-snug font-bold normal-case"
              >
                <span className="block">+ {b.plus}</span>
                <span className="block">− {b.minus}</span>
                <span className="block">{b.note}</span>
              </span>
            </button>
          );
        })}
      </div>
    </PanelFrame>
  );
}
