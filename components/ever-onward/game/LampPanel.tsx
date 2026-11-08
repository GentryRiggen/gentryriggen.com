"use client";

import { memo } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  BEAM_STEPS,
  beamActionId,
  beamNumbers,
  clock,
} from "@/lib/ever-onward/universes/light/beam";
import {
  barrelOil,
  beamStep,
  isOilCheap,
  isOilDear,
  marketOilPrice,
  tankCapacity,
} from "@/lib/ever-onward/universes/light/tick";
import {
  isLampDark,
  isTankerIn,
  tankerSecondsLeft,
} from "@/lib/ever-onward/universes/light/tanker";
import type { PanelProps } from "../universes/types";
import { lightGauge } from "@/lib/ever-onward/universes/light/goal";
import GaugeMeter from "./GaugeMeter";
import useRoving from "./grow/useRoving";
import PanelFrame from "./retro/PanelFrame";
import {
  pixelClass,
  retroFocusClass,
  retroPrimaryButtonClass,
} from "./retro/retroStyles";

const BUY_OIL = "buy-oil";

/** Little pips, brighter for each step. */
const GLOW = [
  "bg-amber-200/40",
  "bg-amber-200/70",
  "bg-amber-200",
  "bg-yellow-100 shadow-[0_0_8px_rgba(254,240,138,0.9)]",
];

/**
 * The coast's panel for the lamp: the oil tank, the oil market (the price
 * drifts, and now and then a tanker ties up with cheap oil), the Buy Oil
 * button and the brightness knob, together. Each brightness shows what it
 * gives (ships) and what it costs (oil) and how long the tank would last.
 */
function LampPanel({ def, run, onAct }: PanelProps) {
  const active = beamStep(run);
  const { radioProps } = useRoving(BEAM_STEPS.length, active);
  const gauge = lightGauge(run);
  if (run.phase !== 0 || !gauge || run.complete) return null;

  const rows = BEAM_STEPS.map((_, i) => beamNumbers(run, i));
  const oil = run.resources.oil;
  const capacity = tankCapacity(run);
  const price = run.resources.oilPrice;
  const buyable = barrelOil(run);
  const canBuy = canPerformAction(def, run, BUY_OIL);
  const priceTag = isOilCheap(run)
    ? "cheap!"
    : isOilDear(run)
      ? "pricey"
      : "fair";
  const trend = run.resources.oilTrend;
  const arrow = trend > 0.015 ? "↑" : trend < -0.015 ? "↓" : "→";
  const isTanker = isTankerIn(run);
  const isDark = isLampDark(run);

  return (
    <PanelFrame
      label="The lamp"
      title="The Lamp"
      icon="☼"
      tone="amber"
      status={BEAM_STEPS[active].label}
      statusActive={false}
      testId="lm-lamp"
      data={{ "data-step": active }}
    >
      <GaugeMeter gauge={gauge} size="panel" testId="lm-oil-gauge" />
      {isTanker && (
        <p
          data-testid="lm-tanker"
          className="border-2 border-emerald-300 bg-emerald-950 p-2 font-mono text-xs font-bold text-emerald-100"
        >
          A tanker is in! Oil is {price.toFixed(2)} while it stays (market{" "}
          {marketOilPrice(run).toFixed(2)}). It sails on in{" "}
          {Math.ceil(tankerSecondsLeft(run))} s.
        </p>
      )}
      {isDark && (
        <p
          data-testid="lm-dark"
          className="border-2 border-red-300 bg-red-950 p-2 font-mono text-xs font-bold text-red-100"
        >
          The lamp is dark! Ships are keeping away from the coast.
        </p>
      )}
      <p className="flex items-baseline justify-between gap-2 font-mono text-sm font-bold tabular-nums">
        <span className="text-slate-300">Oil price</span>
        <span
          data-testid="lm-oil-price"
          className={
            isOilCheap(run)
              ? "text-emerald-300"
              : isOilDear(run)
                ? "text-red-300"
                : "text-slate-200"
          }
        >
          {price.toFixed(2)} each {isTanker ? "tanker" : `${arrow} ${priceTag}`}
        </span>
      </p>
      {/* The button has its own full-width row and a fixed height, so it
          stays put however the label or the price changes. */}
      <button
        type="button"
        data-testid="lm-buy-oil"
        aria-disabled={!canBuy}
        onClick={() => {
          if (canBuy) onAct(BUY_OIL);
        }}
        className={`${retroPrimaryButtonClass} h-12 w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-40`}
      >
        {capacity - oil < 1
          ? "Tank full"
          : buyable < 1
            ? "Need coins"
            : `Buy oil ${formatNumber(Math.ceil(buyable * price))}`}
      </button>
      <div
        role="radiogroup"
        aria-label="How bright the lamp burns"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {BEAM_STEPS.map((step, i) => {
          const checked = i === active;
          const doable = canPerformAction(def, run, beamActionId(i));
          const at = rows[i];
          return (
            <button
              key={step.label}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!checked && !doable}
              aria-label={`${step.label}: ships x${step.pay}, oil x${step.burn}, tank lasts ${clock(at.tankSeconds)}`}
              data-testid={`lm-lamp-${i}`}
              onClick={() => {
                if (!checked && doable) onAct(beamActionId(i));
              }}
              className={`${pixelClass} min-h-14 w-full touch-manipulation space-y-1 border-4 p-2 text-left text-[10px] ${retroFocusClass} ${
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
              <span className="block font-mono text-sm leading-tight font-bold normal-case tabular-nums">
                ships x{step.pay}
              </span>
              <span className="block font-mono text-xs leading-tight normal-case tabular-nums">
                oil x{step.burn}
              </span>
              <span className="block font-mono text-xs leading-tight normal-case tabular-nums">
                tank lasts {clock(at.tankSeconds)}
              </span>
            </button>
          );
        })}
      </div>
    </PanelFrame>
  );
}

export default memo(LampPanel);
