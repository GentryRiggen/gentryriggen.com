"use client";

import type { ShipKind } from "@/lib/ship-builder/model/kinds";
import useKnots from "./useKnots";
import { controlsForKind } from "./controlsForKind";
import SteeringWheel from "./SteeringWheel";
import ThrottleLever from "./ThrottleLever";

/** The gauge reads up to this many knots, over a 240 degree sweep. */
const GAUGE_MAX_KNOTS = 30;
const GAUGE_SWEEP_DEGREES = 240;
const TICK_COUNT = 7;

interface GaugeProps {
  kind: ShipKind;
  knots: number;
}

/** A round dial whose needle follows the speed; decoration for the console. */
function Gauge({ kind, knots }: GaugeProps) {
  const { gaugeClass, needleClass } = controlsForKind[kind].cockpit;
  const share = Math.min(1, Math.max(0, knots / GAUGE_MAX_KNOTS));
  const needle = -GAUGE_SWEEP_DEGREES / 2 + share * GAUGE_SWEEP_DEGREES;
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="pointer-events-none h-16 w-16 sm:h-20 sm:w-20"
    >
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        strokeWidth="4"
        className={gaugeClass}
      />
      {Array.from({ length: TICK_COUNT }, (_, i) => {
        const angle =
          -GAUGE_SWEEP_DEGREES / 2 +
          (i * GAUGE_SWEEP_DEGREES) / (TICK_COUNT - 1);
        return (
          <line
            key={angle}
            x1="50"
            y1="10"
            x2="50"
            y2="20"
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${angle} 50 50)`}
            className={gaugeClass}
          />
        );
      })}
      <line
        x1="50"
        y1="54"
        x2="50"
        y2="16"
        strokeWidth="4"
        strokeLinecap="round"
        transform={`rotate(${needle} 50 50)`}
        className={needleClass}
      />
      <circle
        cx="50"
        cy="50"
        r="5"
        className={gaugeClass}
        fill="currentColor"
      />
    </svg>
  );
}

interface CockpitOverlayProps {
  kind: ShipKind;
}

/**
 * The bridge view's console: a larger wheel and the throttle lever, styled
 * for the class of ship, around a speed readout and a dial. The wheel and the
 * lever are the same controls the chase and top views show; only their look
 * comes from `controlsForKind`.
 */
export default function CockpitOverlay({ kind }: CockpitOverlayProps) {
  const { cockpit } = controlsForKind[kind];
  const knots = useKnots();

  return (
    <div
      data-testid="cockpit-overlay"
      data-kind={kind}
      className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${cockpit.consoleClass}`}
    >
      <SteeringWheel kind={kind} sizeClass={cockpit.wheelSizeClass} />
      <div className="flex min-w-0 flex-col items-center gap-1">
        <p
          aria-label={`Speed ${knots} knots`}
          className={`rounded-md border-2 px-3 py-1 font-mono text-lg font-bold tabular-nums shadow-inner sm:text-2xl ${cockpit.readoutClass}`}
        >
          {knots} kn
        </p>
        <Gauge kind={kind} knots={knots} />
        <p
          className={`text-center text-[0.65rem] font-semibold uppercase tracking-wider sm:text-xs ${cockpit.captionClass}`}
        >
          {cockpit.instrumentName}
        </p>
      </div>
      <ThrottleLever kind={kind} />
    </div>
  );
}
