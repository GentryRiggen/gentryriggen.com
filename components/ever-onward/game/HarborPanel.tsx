"use client";

import { memo } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  TOLL_STEPS,
  isTollOpen,
  rivalToll,
  shipShare,
  tollActionId,
  tollLockLeft,
  tollStep,
  trafficShare,
} from "@/lib/ever-onward/universes/light/toll";
import { goingRate } from "@/lib/ever-onward/universes/light/tick";
import { TUNING } from "@/lib/ever-onward/universes/light/tuning";
import type { PanelProps } from "../universes/types";
import useRoving from "./grow/useRoving";
import PanelFrame from "./retro/PanelFrame";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** Little coin stacks, taller for each step. */
const STACK = ["h-1", "h-2", "h-3", "h-4", "h-5"] as const;

/**
 * The harbor desk: the coast's price you set. Every card shows the plus (what
 * each ship pays) and the minus (the share of ships that would pick your
 * harbor at the going rate, once the traffic settles). The traffic follows
 * your sign slowly, and the sign takes a while to repaint, so a change is a
 * commitment. The rival harbor's sign and the ships choosing you are on show.
 */
function HarborPanel({ def, run, onAct }: PanelProps) {
  const active = tollStep(run);
  const { radioProps } = useRoving(TOLL_STEPS.length, active);
  if (!isTollOpen(run) || run.complete) return null;

  const rate = goingRate(run);
  const traffic = trafficShare(run);
  const lock = tollLockLeft(run);
  const settled = shipShare(TOLL_STEPS[active].pay, rate);
  const arrow =
    Math.abs(settled - traffic) < 0.02 ? "→" : settled > traffic ? "↑" : "↓";

  return (
    <PanelFrame
      label="The harbor"
      title="The Harbor"
      icon="⚓"
      tone="sky"
      status={TOLL_STEPS[active].label}
      statusActive={false}
      testId="lm-harbor"
      data={{ "data-step": active }}
    >
      <p className="flex items-baseline justify-between gap-2 font-mono text-sm font-bold tabular-nums">
        <span className="text-slate-300">Ships choosing you</span>
        <span data-testid="lm-harbor-traffic" className="text-sky-200">
          {pct(traffic)} {arrow}
        </span>
      </p>
      <p className="flex items-baseline justify-between gap-2 font-mono text-sm font-bold tabular-nums">
        <span className="text-slate-300">The other harbor charges</span>
        <span data-testid="lm-harbor-rival" className="text-slate-100">
          x{rivalToll(run).toFixed(1)}
        </span>
      </p>
      <div
        role="radiogroup"
        aria-label="The harbor toll"
        className="grid grid-cols-5 gap-1.5"
      >
        {TOLL_STEPS.map((step, i) => {
          const checked = i === active;
          const doable = canPerformAction(def, run, tollActionId(i));
          const share = shipShare(step.pay, rate);
          return (
            <button
              key={step.label}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!checked && !doable}
              aria-label={`${step.label}: each ship pays x${step.pay}, ${pct(share)} of ships would pick your harbor`}
              data-testid={`lm-toll-${i}`}
              onClick={() => {
                if (!checked && doable) onAct(tollActionId(i));
              }}
              className={`${pixelClass} min-h-16 w-full touch-manipulation space-y-1 border-4 p-1.5 text-left text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-sky-100 bg-sky-300 text-sky-950 shadow-[3px_3px_0_#0c4a6e]"
                  : "border-slate-500 bg-slate-800 text-slate-100 shadow-[3px_3px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none aria-disabled:opacity-60"
              }`}
            >
              <span className="flex h-5 items-end gap-0.5" aria-hidden="true">
                <span className={`w-2 bg-yellow-300 ${STACK[i]}`} />
                <span className={`w-2 bg-yellow-400 ${STACK[i]}`} />
              </span>
              <span className="block">{step.label}</span>
              <span className="block font-mono text-xs leading-tight font-bold normal-case tabular-nums">
                pays x{step.pay}
              </span>
              <span className="block font-mono text-[10px] leading-tight normal-case tabular-nums">
                {pct(share)} come
              </span>
            </button>
          );
        })}
      </div>
      <p
        data-testid="lm-harbor-lock"
        className="font-mono text-xs text-slate-300"
      >
        {lock > 0
          ? `The sign is being repainted: ${Math.ceil(lock)} s.`
          : `Ships take a while to notice a new sign (about ${TUNING.coast.harbor.followSeconds} s).`}
      </p>
    </PanelFrame>
  );
}

export default memo(HarborPanel);
