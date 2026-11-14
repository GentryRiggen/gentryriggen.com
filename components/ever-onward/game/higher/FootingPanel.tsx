"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  FOOTING_LABELS,
  FOOTING_NAMES,
  FOOTING_SHARES,
  footingActionId,
  footingChanges,
  footingStep,
  gainOf,
  isFootingOpen,
  settledGain,
} from "@/lib/ever-onward/universes/higher/footing";
import { TUNING } from "@/lib/ever-onward/universes/higher/tuning";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";
import useRoving from "../grow/useRoving";

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** Width classes for the gauge, in tenths of the most the footing can give. */
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

/**
 * Foundations: how much of what the crew earns to keep back for the footing.
 * Keeping some makes every later payout richer and the tower steadier, but it
 * is stuff you cannot spend on floors now. A real radio group; nothing is
 * ever lost by changing it.
 */
export default function FootingPanel({ def, run, onAct }: PanelProps) {
  const active = footingStep(run);
  const { radioProps } = useRoving(FOOTING_SHARES.length, active);
  if (!isFootingOpen(run) || run.complete) return null;

  const gain = gainOf(run);
  const fill =
    FILL[Math.min(10, Math.round((gain / TUNING.footing.maxGain) * 10))];
  const name = FOOTING_NAMES[run.phase];

  return (
    <PanelFrame
      label={name}
      title={name}
      icon="◆"
      tone="lime"
      status={FOOTING_LABELS[active]}
      statusActive={false}
      testId="bh-footing"
      data={{ "data-step": active }}
      result={
        footingChanges(run) > 0
          ? `${FOOTING_LABELS[active]}. The footing is adding ${pct(gain)} to every payout.`
          : ""
      }
      resultTestId="bh-footing-result"
    >
      <p className="font-mono text-sm text-slate-200">
        Keep some of what the crew earns for the footing and every payout grows
        and the tower leans less. Spend it all and you have more to build with
        today. Footing settles a little, and any left when this part ends stays
        in the ground.
      </p>
      <div
        role="radiogroup"
        aria-label="How much to keep for the footing"
        className="grid gap-2 sm:grid-cols-3"
      >
        {FOOTING_SHARES.map((share, i) => {
          const checked = i === active;
          const doable = canPerformAction(def, run, footingActionId(i));
          return (
            <button
              key={FOOTING_LABELS[i]}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!checked && !doable}
              aria-label={FOOTING_LABELS[i]}
              aria-describedby={`bh-footing-${i}-note`}
              data-testid={`bh-footing-${i}`}
              onClick={() => {
                if (!checked && doable) onAct(footingActionId(i));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1.5 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-lime-200 bg-lime-400 text-lime-950 shadow-[4px_4px_0_#365314]"
                  : "border-slate-500 bg-slate-800 text-slate-100 shadow-[4px_4px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none"
              }`}
            >
              <span className="block">{FOOTING_LABELS[i]}</span>
              <span
                id={`bh-footing-${i}-note`}
                className="block font-mono text-xs leading-snug font-bold normal-case tabular-nums"
              >
                <span className="block">Spend {pct(1 - share)} now</span>
                <span className="block">
                  Settles at +{pct(settledGain(share))} pay
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div aria-hidden="true" className="h-2 w-full bg-black/50">
        <span className={`block h-2 bg-lime-300 ${fill}`} />
      </div>
      <p className="font-mono text-sm font-bold text-lime-100 tabular-nums">
        The footing is adding {pct(gain)} to every payout.
      </p>
    </PanelFrame>
  );
}
