"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  WANTS,
  currentWant,
  isQuietOpen,
  isWanting,
  quietLine,
  secondsToWant,
  tendActionId,
  trustFraction,
} from "@/lib/ever-onward/universes/smile/quiet";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

/**
 * The friend on the bench. Now and then they seem to want something, and the
 * words say what. Every answer helps, the right one most, and nothing here
 * is ever wrong. The three choices are plain buttons (stable labels,
 * aria-disabled while the friend rests, never remounted).
 */
export default function FriendPanel({ def, run, onAct }: PanelProps) {
  if (!isQuietOpen(run) || run.complete) return null;

  const wanting = isWanting(run);
  const want = currentWant(run);
  const percent = Math.floor(trustFraction(run) * 100);
  const headline = wanting
    ? "They seem to want something. What would be kind?"
    : `Resting. They may say something in about ${Math.max(1, Math.ceil(secondsToWant(run)))} seconds.`;

  return (
    <PanelFrame
      label="The friend on the bench"
      title="The friend"
      tone="sky"
      status={`${percent}% trust`}
      statusActive={wanting}
      testId="ms-friend"
      data={{ "data-wanting": wanting ? "true" : "false" }}
      result={quietLine(run)}
      resultTestId="ms-friend-result"
    >
      <p
        data-testid="ms-friend-headline"
        className={`${pixelClass} text-xs leading-relaxed sm:text-sm ${
          wanting ? "text-sky-200" : "text-slate-100"
        }`}
      >
        {headline}
      </p>
      <p className="font-mono text-xs text-slate-300">
        Every answer helps. The one that fits helps most. There is no hurry.
      </p>
      <div
        role="group"
        aria-label="Sit with the friend"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {WANTS.map((w, i) => {
          const doable = canPerformAction(def, run, tendActionId(i));
          const right = wanting && want === i;
          return (
            <button
              key={w.id}
              type="button"
              aria-disabled={!doable}
              aria-label={w.label}
              aria-describedby={`ms-friend-${w.id}-note`}
              data-testid={`ms-friend-${w.id}`}
              onClick={() => {
                if (doable) onAct(tendActionId(i));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                doable
                  ? "border-sky-200 bg-sky-400 text-sky-950 shadow-[4px_4px_0_#0c4a6e] hover:bg-sky-300 active:translate-y-0.5 active:shadow-none"
                  : "border-slate-600 bg-slate-800 text-slate-400 shadow-[4px_4px_0_#0f172a]"
              }`}
            >
              <span className="block">{w.label}</span>
              <span
                id={`ms-friend-${w.id}-note`}
                className="block font-mono text-xs font-bold normal-case"
              >
                {doable
                  ? right
                    ? "Just what they wanted"
                    : "It will help a little too"
                  : "They are resting"}
              </span>
            </button>
          );
        })}
      </div>
    </PanelFrame>
  );
}
