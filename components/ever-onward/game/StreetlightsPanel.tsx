"use client";

import { memo, useMemo } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  LAMP_STEPS,
  lampActionId,
} from "@/lib/ever-onward/universes/light/lamps";
import { short } from "@/lib/ever-onward/universes/light/preview";
import {
  demandAtStep,
  isLampsOpen,
  knowhowPerSecond,
  lampStep,
  powerPerSecond,
  supplyMW,
} from "@/lib/ever-onward/universes/light/tick";
import { TUNING } from "@/lib/ever-onward/universes/light/tuning";
import type { PanelProps } from "../universes/types";
import useRoving from "./grow/useRoving";
import PanelFrame from "./retro/PanelFrame";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

/** Little lamp pips, brighter for each step. */
const GLOW = [
  "bg-amber-200/40",
  "bg-amber-200/70",
  "bg-amber-200",
  "bg-yellow-100 shadow-[0_0_8px_rgba(254,240,138,0.9)]",
];

interface StepNumbers {
  power: number;
  knowhow: number;
  cities: number;
}

const STEPS = TUNING.lamps.steps;
/** Steps' figures are recomputed only when a reading moves by this much. */
const round = (n: number): number => Number(n.toPrecision(3));

/**
 * What the night would read at every step. Brightness only scales pay and
 * know-how and moves the towns' demand, so the four rows come from today's
 * numbers without copying the run.
 */
function numbersByStep(
  active: number,
  power: number,
  knowhow: number,
  supply: number,
  demands: readonly number[]
): StepNumbers[] {
  return STEPS.map((step, i) => ({
    power: (power / STEPS[active].pay) * step.pay,
    knowhow: (knowhow / STEPS[active].knowhow) * step.knowhow,
    cities: Math.min(100, (supply / Math.max(demands[i], 1e-9)) * 100),
  }));
}

/**
 * The streetlights: how bright the cities shine. Brighter pays more, softer
 * gives the crews time to learn and lights more towns with the same plants.
 * A real radio group (arrow keys, one tab stop); nothing is ever lost.
 */
function StreetlightsPanel({ def, run, onAct }: PanelProps) {
  const active = lampStep(run);
  const { radioProps } = useRoving(LAMP_STEPS.length, active);
  const isOpen = isLampsOpen(run) && !run.complete;
  const power = isOpen ? round(powerPerSecond(run)) : 0;
  const knowhow = isOpen ? round(knowhowPerSecond(run)) : 0;
  const supply = isOpen ? round(supplyMW(run)) : 0;
  const demandKey = isOpen
    ? STEPS.map((_, i) => round(demandAtStep(run, i))).join("|")
    : "";
  const rows = useMemo(
    () =>
      numbersByStep(
        active,
        power,
        knowhow,
        supply,
        demandKey.split("|").map(Number)
      ),
    [active, power, knowhow, supply, demandKey]
  );
  if (!isOpen) return null;

  const now = rows[active];
  const hasChosen = (run.resources.lampChanges ?? 0) > 0;

  return (
    <PanelFrame
      label="Streetlights"
      title="Streetlights"
      icon="☼"
      tone="amber"
      status={LAMP_STEPS[active].label}
      statusActive={false}
      testId="lm-lamps"
      data={{ "data-step": active }}
      result={
        hasChosen
          ? `The streetlights are set to ${LAMP_STEPS[active].label.toLowerCase()}.`
          : ""
      }
      resultTestId="lm-lamps-result"
    >
      <p className="font-mono text-sm text-slate-200">
        Brighter streets pay more. Softer ones light more towns with the same
        power, and give your crews quiet time to learn.
      </p>
      <div
        role="radiogroup"
        aria-label="How bright the streetlights shine"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {LAMP_STEPS.map((step, i) => {
          const checked = i === active;
          const doable = canPerformAction(def, run, lampActionId(i));
          const at = rows[i];
          return (
            <button
              key={step.label}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!checked && !doable}
              aria-label={step.label}
              aria-describedby={`lm-lamps-${i}-note`}
              data-testid={`lm-lamps-${i}`}
              onClick={() => {
                if (!checked && doable) onAct(lampActionId(i));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1.5 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-yellow-100 bg-yellow-300 text-yellow-950 shadow-[4px_4px_0_#713f12]"
                  : "border-slate-500 bg-slate-800 text-slate-100 shadow-[4px_4px_0_#0f172a] hover:bg-slate-700 active:translate-y-0.5 active:shadow-none"
              }`}
            >
              <span className="flex items-center gap-1" aria-hidden="true">
                {Array.from({ length: 4 }, (_, pip) => (
                  <span
                    key={pip}
                    className={`h-2 w-2 ${pip <= i ? GLOW[i] : "bg-slate-600"}`}
                  />
                ))}
              </span>
              <span className="block">{step.label}</span>
              <span
                id={`lm-lamps-${i}-note`}
                className="block font-mono text-xs leading-snug font-bold normal-case tabular-nums"
              >
                <span className="block">{short(at.power)} power/sec</span>
                <span className="block">{short(at.knowhow)} know-how/sec</span>
                <span className="block">
                  {Math.floor(at.cities)}{" "}
                  {Math.floor(at.cities) === 1 ? "town" : "towns"} lit
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="font-mono text-xs text-slate-300">
        {LAMP_STEPS[active].note}.
      </p>
      <p className="font-mono text-sm font-bold text-yellow-100 tabular-nums">
        Now: {short(now.power)} power and {short(now.knowhow)} know-how a
        second.
      </p>
    </PanelFrame>
  );
}

export default memo(StreetlightsPanel);
