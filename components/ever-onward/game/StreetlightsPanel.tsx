"use client";

import { canPerformAction, cloneRun } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  LAMP_STEPS,
  lampActionId,
} from "@/lib/ever-onward/universes/light/lamps";
import { short } from "@/lib/ever-onward/universes/light/preview";
import {
  citiesLit,
  isLampsOpen,
  knowhowPerSecond,
  lampStep,
  powerPerSecond,
  setLamps,
} from "@/lib/ever-onward/universes/light/tick";
import type { PanelProps } from "../universes/types";
import useRoving from "./grow/useRoving";
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

/** What the night would read at a step, from a copy of the run. */
function numbersAt(run: RunState, step: number): StepNumbers {
  const draft = cloneRun(run);
  setLamps(draft, step);
  return {
    power: powerPerSecond(draft),
    knowhow: knowhowPerSecond(draft),
    cities: citiesLit(draft),
  };
}

/**
 * The streetlights: how bright the cities shine. Brighter pays more, softer
 * gives the crews time to learn and lights more towns with the same plants.
 * A real radio group (arrow keys, one tab stop); nothing is ever lost.
 */
export default function StreetlightsPanel({ def, run, onAct }: PanelProps) {
  const active = lampStep(run);
  const { radioProps } = useRoving(LAMP_STEPS.length, active);
  if (!isLampsOpen(run) || run.complete) return null;

  const now = numbersAt(run, active);
  const hasChosen = (run.resources.lampChanges ?? 0) > 0;

  return (
    <section
      aria-label="Streetlights"
      data-testid="lm-lamps"
      data-step={active}
      className="space-y-3 border-4 border-yellow-300/70 bg-slate-950/85 p-3 shadow-[4px_4px_0_#713f12]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-[10px] text-yellow-200`}>
          <span aria-hidden="true" className="mr-2 text-amber-300">
            ☼
          </span>
          Streetlights
        </h2>
        <p className={`${pixelClass} text-[8px] text-yellow-100/80`}>
          {LAMP_STEPS[active].label}
        </p>
      </header>
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
          const at = numbersAt(run, i);
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
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1.5 border-4 p-2 text-left text-[9px] ${retroFocusClass} ${
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
                className="block font-mono text-[11px] leading-snug font-bold normal-case tabular-nums"
              >
                {short(at.power)} power/sec · {short(at.knowhow)} know-how/sec ·{" "}
                {Math.floor(at.cities)} towns lit
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
      {/* Changes only when a step is picked, so a screen reader hears the
          choice once, not every tick of the numbers. */}
      <p
        role="status"
        aria-live="polite"
        data-testid="lm-lamps-result"
        className={
          hasChosen
            ? "border-2 border-yellow-300/70 bg-yellow-950/40 p-2 font-mono text-sm font-bold text-yellow-100"
            : "sr-only"
        }
      >
        {hasChosen
          ? `The streetlights are set to ${LAMP_STEPS[active].label.toLowerCase()}.`
          : ""}
      </p>
    </section>
  );
}
