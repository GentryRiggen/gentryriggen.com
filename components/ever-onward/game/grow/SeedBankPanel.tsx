"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  BANK_LABELS,
  BANK_SHARES,
  bankActionId,
  bankChanges,
  bankStep,
  isBankOpen,
  settledGain,
} from "@/lib/ever-onward/universes/grow/seedbank";
import { bankGain } from "@/lib/ever-onward/universes/grow/tick";
import { TUNING } from "@/lib/ever-onward/universes/grow/tuning";
import type { PanelProps } from "../../universes/types";
import PanelFrame from "../retro/PanelFrame";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";
import useRoving from "./useRoving";

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
 * The seed bank: how much of the harvest to keep back as seed. Keeping some
 * makes every later harvest richer, but it is harvest you cannot spend now.
 * A real radio group; nothing is ever lost by changing it.
 */
export default function SeedBankPanel({ def, run, onAct }: PanelProps) {
  const active = bankStep(run);
  const { radioProps } = useRoving(BANK_SHARES.length, active);
  if (!isBankOpen(run) || run.complete) return null;

  const gain = bankGain(run);
  const fill =
    FILL[Math.min(10, Math.round((gain / TUNING.farm.bank.maxGain) * 10))];
  const hasChosen = bankChanges(run) > 0;

  return (
    <PanelFrame
      label="The seed bank"
      title="Seed bank"
      icon="◆"
      tone="lime"
      status={BANK_LABELS[active]}
      statusActive={false}
      testId="gr-bank"
      data={{ "data-step": active }}
      result={
        hasChosen
          ? `${BANK_LABELS[active]}. The bank is giving ${pct(gain)} more on every harvest.`
          : ""
      }
      resultTestId="gr-bank-result"
    >
      <p className="font-mono text-sm text-slate-200">
        Keep some of the harvest back as seed and every later harvest grows
        richer. Seed in the bank spoils a little, and any left when the farm
        ends is left behind.
      </p>
      <div
        role="radiogroup"
        aria-label="How much harvest to keep as seed"
        className="grid gap-2 sm:grid-cols-3"
      >
        {BANK_SHARES.map((share, i) => {
          const checked = i === active;
          const doable = canPerformAction(def, run, bankActionId(i));
          return (
            <button
              key={BANK_LABELS[i]}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!checked && !doable}
              aria-label={BANK_LABELS[i]}
              aria-describedby={`gr-bank-${i}-note`}
              data-testid={`gr-bank-${i}`}
              onClick={() => {
                if (!checked && doable) onAct(bankActionId(i));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1.5 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-lime-200 bg-lime-400 text-lime-950 shadow-[4px_4px_0_#365314]"
                  : "border-slate-500 bg-slate-800 text-slate-100 shadow-[4px_4px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none"
              }`}
            >
              <span className="block">{BANK_LABELS[i]}</span>
              <span
                id={`gr-bank-${i}-note`}
                className="block font-mono text-xs leading-snug font-bold normal-case tabular-nums"
              >
                <span className="block">Spend {pct(1 - share)} now</span>
                <span className="block">
                  Settles at +{pct(settledGain(share))} yield
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
        The bank is adding {pct(gain)} to every harvest.
      </p>
    </PanelFrame>
  );
}
