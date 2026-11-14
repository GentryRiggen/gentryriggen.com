"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  PACES,
  isSettling,
  paceActionId,
  paceStep,
} from "@/lib/ever-onward/universes/higher/playroom";
import {
  dayNext,
  dayNow,
  daySecondsLeft,
  isTownOpen,
} from "@/lib/ever-onward/universes/higher/town";
import { TUNING } from "@/lib/ever-onward/universes/higher/tuning";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";
import useRoving from "../grow/useRoving";

const pct = (n: number): string => `${Math.round(n * 100)}%`;

const LEAN_WORDS: readonly string[] = [
  "Hardly leans",
  "Leans a little",
  "Leans some",
  "Leans a lot",
];

/**
 * The Town's build pace (the Playroom's dial, carried up the tower) and the
 * day's sign. Each pace card shows what it pays and how much it leans, and
 * none says which is better: that moves with the height, the foremen and the
 * day. Tomorrow is always on the sign, so there is time to change hats.
 */
export default function TownPanel({ def, run, onAct }: PanelProps) {
  const active = paceStep(run);
  const { radioProps } = useRoving(PACES.length, active);
  if (!isTownOpen(run)) return null;
  const today = dayNow(run);
  const tomorrow = dayNext(run);
  return (
    <PanelFrame
      label="The town's build pace"
      title="Build pace and the day"
      icon="/"
      tone="orange"
      status={`${today.name}`}
      statusActive={today.id !== "quiet"}
      testId="bh-town"
      data={{ "data-pace": active, "data-day": today.id }}
      result={`${today.name}: ${today.note}`}
      resultTestId="bh-town-day"
      resultTone="amber"
    >
      <div
        role="radiogroup"
        aria-label="How fast to build"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {PACES.map((pace, i) => {
          const checked = i === active;
          const doable = canPerformAction(def, run, paceActionId(i));
          const pay = TUNING.town.pacePay[i];
          return (
            <button
              key={pace.name}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!checked && !doable}
              aria-label={`${pace.name} pace`}
              data-testid={`bh-pace-${i}`}
              onClick={() => {
                if (!checked && doable) onAct(paceActionId(i));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1.5 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-orange-200 bg-orange-400 text-orange-950 shadow-[4px_4px_0_#7c2d12]"
                  : "border-slate-500 bg-slate-800 text-slate-100 shadow-[4px_4px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none"
              }`}
            >
              <span className="block">{pace.name}</span>
              <span className="block font-mono text-xs leading-snug font-bold normal-case tabular-nums">
                <span className="block">
                  {pay >= 1 ? "+" : "-"}
                  {pct(Math.abs(pay - 1))} bricks
                </span>
                <span className="block">{LEAN_WORDS[i]}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="font-mono text-xs text-slate-300">
        {isSettling(run)
          ? "Changing pace… the crew takes a moment to settle."
          : "Changing pace takes a moment to settle."}{" "}
        A tall tower leans more than a short one.
      </p>
      <div
        data-testid="bh-day-sign"
        className="space-y-1 border-2 border-orange-700 bg-orange-950/40 p-2 font-mono text-xs text-orange-50"
      >
        <p>
          <span className={`${pixelClass} text-[10px] text-orange-300`}>
            Today: {today.name}
          </span>{" "}
          {daySecondsLeft(run)} sec left. {today.note}
        </p>
        <p data-testid="bh-day-next">
          <span className={`${pixelClass} text-[10px] text-sky-300`}>
            Tomorrow: {tomorrow.name}
          </span>{" "}
          {tomorrow.note}
        </p>
      </div>
    </PanelFrame>
  );
}
