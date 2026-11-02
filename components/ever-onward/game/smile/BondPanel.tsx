"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  BOND_LABELS,
  BOND_SHARES,
  bondActionId,
  bondChanges,
  bondStep,
  isBondOpen,
  settledGain,
} from "@/lib/ever-onward/universes/smile/bond";
import { forkBondMult } from "@/lib/ever-onward/universes/smile/forks";
import { bondGain } from "@/lib/ever-onward/universes/smile/tick";
import { TUNING } from "@/lib/ever-onward/universes/smile/tuning";
import useRoving from "../grow/useRoving";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** Width classes for the jar, in tenths of the most the bank can give. */
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
 * The friendship bank: how much of every smile to set aside as time together.
 * Time together makes every later laugh bigger, but it is a laugh you do not
 * get to spend now. A real radio group; nothing is ever lost by changing it.
 */
export default function BondPanel({ def, run, onAct }: PanelProps) {
  const active = bondStep(run);
  const { radioProps } = useRoving(BOND_SHARES.length, active);
  if (!isBondOpen(run) || run.complete) return null;

  const gain = bondGain(run);
  const mostItCanGive = TUNING.bond.maxGain * forkBondMult(run);
  const fill =
    FILL[Math.min(10, Math.round((gain / Math.max(0.01, mostItCanGive)) * 10))];
  const hasChosen = bondChanges(run) > 0;

  return (
    <PanelFrame
      label="The friendship bank"
      title="Friendship bank"
      icon="♥"
      tone="orange"
      status={BOND_LABELS[active]}
      statusActive={false}
      testId="ms-bond"
      data={{ "data-step": active }}
      result={
        hasChosen
          ? `${BOND_LABELS[active]}. Time together is making every laugh ${pct(gain)} bigger.`
          : ""
      }
      resultTestId="ms-bond-result"
    >
      <p className="font-mono text-sm text-slate-200">
        Spend some of every smile on time together and every later laugh grows
        bigger. Time together fades a little, and any left when you knock next
        door stays behind.
      </p>
      <div
        role="radiogroup"
        aria-label="How much of every smile to spend on time together"
        className="grid gap-2 sm:grid-cols-3"
      >
        {BOND_SHARES.map((share, i) => {
          const checked = i === active;
          const doable = canPerformAction(def, run, bondActionId(i));
          return (
            <button
              key={BOND_LABELS[i]}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!checked && !doable}
              aria-label={BOND_LABELS[i]}
              aria-describedby={`ms-bond-${i}-note`}
              data-testid={`ms-bond-${i}`}
              onClick={() => {
                if (!checked && doable) onAct(bondActionId(i));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1.5 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-orange-200 bg-orange-400 text-orange-950 shadow-[4px_4px_0_#7c2d12]"
                  : "border-slate-500 bg-slate-800 text-slate-100 shadow-[4px_4px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none"
              }`}
            >
              <span className="block">{BOND_LABELS[i]}</span>
              <span
                id={`ms-bond-${i}-note`}
                className="block font-mono text-xs leading-snug font-bold normal-case tabular-nums"
              >
                <span className="block">Laugh with {pct(1 - share)} now</span>
                <span className="block">
                  Settles at +{pct(settledGain(share) * forkBondMult(run))}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div aria-hidden="true" className="h-2 w-full bg-black/50">
        <span className={`block h-2 bg-orange-300 ${fill}`} />
      </div>
      <p className="font-mono text-sm font-bold text-orange-100 tabular-nums">
        Time together is adding {pct(gain)} to every laugh.
      </p>
    </PanelFrame>
  );
}
