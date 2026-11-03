"use client";

import { memo } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  BEAM_STEPS,
  beamActionId,
  beamNumbers,
  bestBeamStep,
  clock,
} from "@/lib/ever-onward/universes/light/beam";
import {
  barrelOil,
  beamStep,
  isOilCheap,
  isOilDear,
  tankCapacity,
} from "@/lib/ever-onward/universes/light/tick";
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

const signed = (n: number): string =>
  `${n < 0 ? "-" : "+"}${formatNumber(Math.abs(Math.round(n)))}`;

/**
 * The coast's one panel for the lamp: the oil tank, the price, the Buy Oil
 * button and the brightness knob, together. Each brightness shows what it
 * would earn after the oil bill and how long the tank would last, right now,
 * so the best one changes as the oil price wobbles: blaze when oil is cheap,
 * dim when it is dear.
 */
function LampPanel({ def, run, onAct }: PanelProps) {
  const active = beamStep(run);
  const { radioProps } = useRoving(BEAM_STEPS.length, active);
  const gauge = lightGauge(run);
  if (run.phase !== 0 || !gauge || run.complete) return null;

  const rows = BEAM_STEPS.map((_, i) => beamNumbers(run, i));
  const best = bestBeamStep(run);
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
          {price.toFixed(2)} each {arrow} {priceTag}
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
              aria-label={`${step.label}: ${signed(at.net)} coins a second after oil, tank lasts ${clock(at.tankSeconds)}`}
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
                {i === best && (
                  <span
                    data-testid="lm-lamp-best"
                    className="ml-auto text-[10px] text-emerald-500"
                  >
                    best
                  </span>
                )}
              </span>
              <span className="block">{step.label}</span>
              <span className="block font-mono text-sm leading-tight font-bold normal-case tabular-nums">
                {signed(at.net)}/s net
              </span>
              <span className="block font-mono text-xs leading-tight normal-case tabular-nums">
                tank lasts {clock(at.tankSeconds)}
              </span>
            </button>
          );
        })}
      </div>
      {/* The how-to line goes away once the player has used the knob. */}
      {(run.resources.lampBeamChanges ?? 0) === 0 && (
        <p className="font-mono text-xs text-slate-300">
          Brighter guides more ships but burns far more oil. Burn bright when
          oil is cheap, dim when it is dear.
        </p>
      )}
    </PanelFrame>
  );
}

export default memo(LampPanel);
