"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import { calmIncomePerSecond } from "@/lib/ever-onward/universes/light/tick";
import {
  HAUL_ACTION,
  SET_NETS_ACTION,
  catchCoins,
  earlinessIfSetNow,
  hasBiggerNets,
  hasTideMill,
  haulResultLine,
  haulsSoFar,
  isRising,
  isTideOpen,
  millCoins,
  netState,
  secondsToHighTide,
  tideLevel,
  type NetState,
} from "@/lib/ever-onward/universes/light/tide";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

interface TideClockProps {
  def: UniverseDef;
  run: RunState;
  onAct: (id: string) => void;
}

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** The water line in the gauge: y at level 0 (low) and at level 1 (high). */
const LOW_Y = 124;
const HIGH_Y = 34;
const WAVE =
  "M0 0 q6 -4 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 V120 H0 Z";

/** A tall tide gauge: a pier post in the sea, the water rising and falling. */
function TideGauge({ level }: { level: number }) {
  const top = LOW_Y - level * (LOW_Y - HIGH_Y);
  return (
    <svg
      viewBox="0 0 120 140"
      className="h-40 w-32 shrink-0 sm:h-44 sm:w-36"
      role="img"
      aria-label={`Tide gauge: the water is ${Math.round(level * 100)} percent of the way up`}
      data-testid="lm-tide-gauge"
      data-level={level.toFixed(2)}
      shapeRendering="crispEdges"
    >
      <defs>
        <clipPath id="td-window">
          <rect x="6" y="6" width="108" height="128" />
        </clipPath>
      </defs>
      <rect x="2" y="2" width="116" height="136" fill="#1e293b" />
      <g clipPath="url(#td-window)">
        <rect x="6" y="6" width="108" height="128" fill="#0b1b3f" />
        <circle cx="96" cy="22" r="8" fill="#fef3c7" />
        <circle cx="100" cy="20" r="7" fill="#0b1b3f" />
        <rect x="18" y="14" width="2" height="2" fill="#e0f2fe" />
        <rect x="40" y="22" width="2" height="2" fill="#e0f2fe" />
        <rect x="76" y="12" width="2" height="2" fill="#e0f2fe" />
        <rect x="55" y="18" width="10" height="116" fill="#92400e" />
        {[44, 64, 84, 104].map((y) => (
          <rect key={y} x="55" y={y} width="10" height="2" fill="#451a03" />
        ))}
        <line
          x1="6"
          x2="114"
          y1={HIGH_Y}
          y2={HIGH_Y}
          stroke="#fcd34d"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <g transform={`translate(0 ${top + 2})`}>
          <g className="td-sway-b">
            <path d={WAVE} fill="#0284c7" transform="translate(-24 2)" />
          </g>
        </g>
        <g transform={`translate(0 ${top})`}>
          <g className="td-sway">
            <path
              d={WAVE}
              fill="#38bdf8"
              fillOpacity="0.85"
              transform="translate(-24 0)"
            />
          </g>
        </g>
        <g transform={`translate(88 ${top - 2})`}>
          <g className="td-bob">
            <circle r="4.5" fill="#fb923c" stroke="#fff7ed" strokeWidth="1.2" />
            <rect x="-1" y="-10" width="2" height="6" fill="#fff7ed" />
          </g>
        </g>
      </g>
      <text
        x="10"
        y={HIGH_Y - 3}
        fill="#fcd34d"
        fontSize="6.5"
        className={pixelClass}
      >
        High
      </text>
      <text x="10" y="130" fill="#e0f2fe" fontSize="6.5" className={pixelClass}>
        Low
      </text>
    </svg>
  );
}

/** The net: empty, out in the water, or full of fish. */
function NetIcon({ state }: { state: NetState }) {
  const isFull = state === "full";
  const isOut = state !== "empty";
  return (
    <svg
      viewBox="0 0 64 44"
      className="h-16 w-24 shrink-0"
      aria-hidden="true"
      data-testid="lm-tide-net"
      data-state={state}
      shapeRendering="crispEdges"
    >
      <rect x="2" y="2" width="6" height="6" fill="#fb923c" stroke="#fff7ed" />
      <rect x="56" y="2" width="6" height="6" fill="#fb923c" stroke="#fff7ed" />
      <path
        d="M5 8 Q32 54 59 8 Z"
        fill={isFull ? "#0ea5e9" : "#0f172a"}
        fillOpacity={isFull ? 0.45 : 0.6}
        stroke={isOut ? "#e0f2fe" : "#64748b"}
        strokeWidth="2"
        strokeDasharray={isOut ? undefined : "4 3"}
      />
      <path
        d="M14 12 L24 33 M24 11 L32 38 M40 11 L32 38 M50 12 L40 33 M10 18 H54 M16 26 H48"
        stroke={isOut ? "#bae6fd" : "#475569"}
        strokeWidth="1"
        fill="none"
      />
      {isFull &&
        [
          [22, 22],
          [34, 28],
          [42, 20],
        ].map(([x, y], i) => (
          <g key={x} transform={`translate(${x} ${y})`}>
            <g
              className={
                i % 2 === 0 ? "td-glint" : "td-glint [animation-delay:-0.8s]"
              }
            >
              <ellipse
                rx="6"
                ry="3.4"
                fill="#fde68a"
                stroke="#b45309"
                strokeWidth="0.8"
              />
              <polygon
                points="6,0 10.5,-3.6 10.5,3.6"
                fill="#fde68a"
                stroke="#b45309"
                strokeWidth="0.8"
              />
              <rect x="-4" y="-1.5" width="2" height="2" fill="#0f172a" />
            </g>
          </g>
        ))}
    </svg>
  );
}

const NET_CAPTION: Record<NetState, string> = {
  empty: "Nets are in the shed",
  set: "Nets are out in the water",
  full: "Nets are full of fish!",
};

/**
 * The Tide Clock: the sea breathes in and out on its own. Set the nets while
 * the tide is coming in, and haul them in after high tide for a catch of
 * coins. Full nets wait as long as it takes and nothing is ever lost.
 */
export default function TideClock({ def, run, onAct }: TideClockProps) {
  if (!isTideOpen(run) || run.complete) return null;

  const state = netState(run);
  const level = tideLevel(run);
  const income = calmIncomePerSecond(run);
  const toHigh = secondsToHighTide(run);
  const hauls = haulsSoFar(run);
  const earned = run.resources.tdEarned ?? 0;
  const milled = run.resources.tdMilled ?? 0;
  const resultLine = haulResultLine(run);
  const isFull = state === "full";
  const action = state === "empty" ? SET_NETS_ACTION : HAUL_ACTION;
  const isDoable = canPerformAction(def, run, action);
  const isBest = earlinessIfSetNow(run) >= 0.85;

  const headline = isFull
    ? "High tide! Your nets are full."
    : `High tide in ${clock(toHigh)}`;
  const hint = isFull
    ? "Haul them in whenever you like. They wait for you."
    : state === "set"
      ? "Your nets fill when the water is highest."
      : isBest
        ? "The tide is coming in: set them now for the biggest catch."
        : "Set them now, and they fill at the next high tide.";

  const buttonLook = isFull
    ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[4px_4px_0_#78350f,0_0_18px_rgba(251,191,36,0.7)] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
    : state === "empty"
      ? "border-sky-200 bg-sky-400 text-sky-950 shadow-[4px_4px_0_#0c4a6e] hover:bg-sky-300 active:translate-y-0.5 active:shadow-none"
      : "border-slate-600 bg-slate-800 text-slate-300 shadow-[4px_4px_0_#0f172a]";

  return (
    <section
      aria-label="Tide clock"
      data-testid="lm-tide-panel"
      data-nets={state}
      className="relative isolate space-y-3 overflow-hidden border-4 border-sky-400/80 bg-slate-950/85 p-3 shadow-[4px_4px_0_#0c4a6e]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-[10px] text-sky-200`}>
          <span aria-hidden="true" className="mr-2 text-sky-300">
            ≈
          </span>
          Tide clock
        </h2>
        <p
          className={`${pixelClass} border-2 px-2 py-1 text-[8px] ${
            isRising(run)
              ? "border-sky-300 bg-sky-950 text-sky-100"
              : "border-slate-600 bg-slate-900 text-slate-300"
          }`}
        >
          {isRising(run) ? "Tide coming in" : "Tide going out"}
        </p>
      </header>

      <div className="flex items-center gap-3">
        <TideGauge level={level} />
        <div className="min-w-0 flex-1 space-y-2">
          <p
            data-testid="lm-tide-headline"
            className={`${pixelClass} text-xs tabular-nums sm:text-sm ${
              isFull ? "text-amber-300" : "text-sky-50"
            }`}
          >
            {headline}
          </p>
          <div className="flex items-center gap-2">
            <NetIcon state={state} />
            <p className="font-mono text-xs font-bold text-sky-100">
              {NET_CAPTION[state]}
            </p>
          </div>
          <p className="font-mono text-xs text-slate-300">{hint}</p>
        </div>
      </div>

      <button
        type="button"
        data-testid="lm-tide-button"
        disabled={!isDoable}
        onClick={() => {
          if (isDoable) onAct(action);
        }}
        className={`${pixelClass} flex min-h-14 w-full touch-manipulation flex-col items-center justify-center gap-1 border-4 px-3 py-2 text-xs transition-transform disabled:cursor-not-allowed ${retroFocusClass} ${buttonLook}`}
      >
        <span>
          {isFull
            ? "Haul in!"
            : state === "empty"
              ? "Set the nets"
              : "Waiting for high tide…"}
        </span>
        {isFull && (
          <span className="font-mono text-[11px] font-bold normal-case">
            about +{formatNumber(Math.floor(catchCoins(run, income)))} coins
          </span>
        )}
      </button>

      {resultLine && (
        <p
          data-testid="lm-tide-result"
          className="border-2 border-emerald-400 bg-emerald-950/70 p-2 font-mono text-sm font-bold text-emerald-200"
        >
          {resultLine}
        </p>
      )}

      {hasTideMill(run) && (
        <p className="font-mono text-xs text-sky-100">
          The tide mill works its own nets at every high tide: about +
          {formatNumber(Math.floor(millCoins(income)))} coins, on top of yours.
        </p>
      )}

      {hauls > 0 && (
        <p className="font-mono text-xs text-slate-300">
          Hauls so far: {hauls} (+{formatNumber(Math.floor(earned))} coins
          {milled > 0 && `, +${formatNumber(Math.floor(milled))} from the mill`}
          ).{hasBiggerNets(run) ? " Your nets are extra big." : ""}
        </p>
      )}
    </section>
  );
}
