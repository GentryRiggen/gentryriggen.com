"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  ACTIVITIES,
  activityOf,
  bondGain,
  faceLine,
  freshness,
  isSwitching,
  isTogetherOpen,
  switchingTo,
  togetherActionId,
  togetherChanges,
  togetherLine,
  wearLine,
  wearOf,
} from "@/lib/ever-onward/universes/smile/together";
import { TUNING } from "@/lib/ever-onward/universes/smile/tuning";
import useRoving from "../grow/useRoving";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const T = TUNING.together;
const pct = (n: number): string => `${Math.round(n * 100)}%`;
const times = (n: number): string => `${Number(n.toFixed(2))}x`;

/** Width classes for the wear bar, in tenths. */
const FILL: readonly string[] = [
  "w-0",
  "w-[10%]",
  "w-[20%]",
  "w-[30%]",
  "w-[40%]",
  "w-[50%]",
  "w-[60%]",
  "w-[70%]",
  "w-[80%]",
  "w-[90%]",
  "w-full",
];

/** What each card says it pays, from the real numbers. */
function payText(run: PanelProps["run"], i: number): string {
  return T.pay[i] === 0
    ? "Pays no smiles"
    : `Pays ${times(T.pay[i] * freshness(run, i))} smiles`;
}

/**
 * What you do together: jokes, games or listening. Each pays something and
 * costs something, whatever you repeat wears thin, and the friend's face hints
 * (only hints) at what they need next. A real radio group; a change takes a
 * moment, and nothing is ever lost.
 */
export default function TogetherPanel({ def, run, onAct }: PanelProps) {
  const active = activityOf(run);
  const { radioProps } = useRoving(ACTIVITIES.length, active);
  if (!isTogetherOpen(run) || run.complete) return null;

  const switching = isSwitching(run);
  const target = switching ? switchingTo(run) : active;
  const gain = bondGain(run);
  const result = togetherLine(run) ?? "";

  return (
    <PanelFrame
      label="What you do together"
      title="What you do together"
      icon="♥"
      tone="orange"
      status={switching ? "Settling in" : ACTIVITIES[active].label}
      statusActive={false}
      testId="ms-together"
      data={{
        "data-activity": active,
        "data-switching": switching ? "yes" : "no",
      }}
      result={
        togetherChanges(run) > 0 || result
          ? result || `${ACTIVITIES[active].label}. Bond +${pct(gain)}.`
          : ""
      }
      resultTestId="ms-together-result"
    >
      <p className="font-mono text-sm text-slate-200">
        Whatever you keep doing wears thin, and comes back while you do
        something else. Changing takes a moment.
      </p>
      <p
        data-testid="ms-together-face"
        className="font-mono text-sm font-bold text-orange-100"
      >
        {faceLine(run)}
      </p>
      <div
        role="radiogroup"
        aria-label="What to do together"
        className="grid gap-2 sm:grid-cols-3"
      >
        {ACTIVITIES.map((activity, i) => {
          const checked = i === target;
          const doable = canPerformAction(def, run, togetherActionId(i));
          const wear = wearOf(run, i);
          return (
            <button
              key={activity.id}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!checked && !doable}
              aria-label={activity.label}
              aria-describedby={`ms-together-${i}-note`}
              data-testid={`ms-together-${i}`}
              onClick={() => {
                if (!checked && doable) onAct(togetherActionId(i));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1.5 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-orange-200 bg-orange-400 text-orange-950 shadow-[4px_4px_0_#7c2d12]"
                  : "border-slate-500 bg-slate-800 text-slate-100 shadow-[4px_4px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none"
              }`}
            >
              <span className="block">{activity.label}</span>
              <span
                id={`ms-together-${i}-note`}
                className="block font-mono text-xs leading-snug font-bold normal-case tabular-nums"
              >
                <span className="block">+ {activity.plus}</span>
                <span className="block">− {activity.minus}</span>
                <span className="block">{payText(run, i)}</span>
                <span className="block">{wearLine(run, i)}</span>
              </span>
              <span
                aria-hidden="true"
                className="block h-1.5 w-full bg-black/40"
              >
                <span
                  className={`block h-1.5 ${checked ? "bg-orange-950" : "bg-orange-300"} ${FILL[Math.round(wear * 10)]}`}
                />
              </span>
            </button>
          );
        })}
      </div>
      <p className="font-mono text-sm font-bold text-orange-100 tabular-nums">
        The bond is adding {pct(gain)} to every laugh.
      </p>
    </PanelFrame>
  );
}
