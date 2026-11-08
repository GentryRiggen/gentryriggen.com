"use client";

import { memo } from "react";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  EVENING_NAMES,
  batteryCapacity,
  batteryCharge,
  batterySecondsOfGrid,
  blackouts,
  dayShare,
  districtsDark,
  eveningLevel,
  isGridOpen,
  isRushNow,
  lastEvening,
  litNights,
  rateShare,
  rushCarry,
  rushExcess,
  secondsToRush,
} from "@/lib/ever-onward/universes/light/grid";
import { supplyMW } from "@/lib/ever-onward/universes/light/tick";
import { TUNING } from "@/lib/ever-onward/universes/light/tuning";
import type { PanelProps } from "../universes/types";
import PanelFrame from "./retro/PanelFrame";
import { pixelClass } from "./retro/retroStyles";

const G = TUNING.grid;
/** The day is drawn as this many little blocks, left to right. */
const BLOCKS = 24;
const CHARGE_SEGMENTS = 12;

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** Which part of the day it is, for the chip and the sky strip. */
function partOfDay(run: PanelProps["run"]): string {
  if (isRushNow(run)) return "Evening rush";
  const share = dayShare(run) * G.daySeconds;
  if (share >= G.duskAt && share < G.rushAt) return "Dusk";
  if (share >= G.rushAt + G.rushSeconds) return "Late night";
  return "Day";
}

/** The day as a strip: sun by day, dusk, the rush lit up, then night. */
function DayStrip({ share }: { share: number }) {
  const now = Math.min(BLOCKS - 1, Math.floor(share * BLOCKS));
  const at = (seconds: number): number =>
    Math.floor((seconds / G.daySeconds) * BLOCKS);
  const dusk = at(G.duskAt);
  const rush = at(G.rushAt);
  const rushEnd = at(G.rushAt + G.rushSeconds);
  return (
    <div
      aria-hidden="true"
      data-testid="lm-day-strip"
      data-now={now}
      className="flex h-6 gap-0.5 border-2 border-slate-600 bg-slate-950 p-0.5"
    >
      {Array.from({ length: BLOCKS }, (_, i) => {
        const tone =
          i >= rush && i < rushEnd
            ? "bg-orange-400"
            : i >= dusk && i < rush
              ? "bg-fuchsia-400/70"
              : i >= rushEnd
                ? "bg-indigo-500/70"
                : "bg-sky-300/80";
        return (
          <span
            key={i}
            className={`relative flex-1 ${tone} ${
              i === now
                ? "z-10 scale-y-125 ring-2 ring-white"
                : i < now
                  ? "opacity-45"
                  : ""
            }`}
          />
        );
      })}
    </div>
  );
}

function Segments({ share, tone }: { share: number; tone: string }) {
  const filled = Math.round(Math.min(1, Math.max(0, share)) * CHARGE_SEGMENTS);
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-full gap-0.5 border-2 border-slate-600 bg-slate-950 p-px"
    >
      {Array.from({ length: CHARGE_SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={`h-full flex-1 ${i < filled ? tone : "bg-slate-800"}`}
        />
      ))}
    </span>
  );
}

function Gauge({
  label,
  value,
  note,
  testId,
}: {
  label: string;
  value: string;
  note: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="min-w-0 space-y-1 border-2 border-slate-600 bg-slate-900/80 p-2"
    >
      <p className={`${pixelClass} text-[10px] text-slate-300`}>{label}</p>
      <p
        className={`${pixelClass} text-sm tabular-nums text-amber-200 sm:text-base`}
      >
        {value}
      </p>
      <p className="font-mono text-xs leading-snug text-slate-300">{note}</p>
    </div>
  );
}

/**
 * The grid: the day, tonight's evening rush, and the three things that have
 * to stay in step to carry it. It shows the numbers and never says which
 * streetlights to pick; the batteries and lines are bought in the shop.
 */
function GridPanel({ run }: PanelProps) {
  if (!isGridOpen(run) || run.complete) return null;
  const plants = supplyMW(run);
  const capacity = batteryCapacity(run);
  const charge = batteryCharge(run);
  const level = eveningLevel(run);
  const isRush = isRushNow(run);
  const dark = districtsDark(run);
  const asks = rushExcess(run) * G.rushSeconds;
  const holds =
    batterySecondsOfGrid(run) * (capacity > 0 ? charge / capacity : 0);
  const last = lastEvening(run);
  const lits = litNights(run);
  const out = blackouts(run);
  const toRush = secondsToRush(run);
  const result =
    last === 1
      ? `Last evening every district stayed lit. ${lits} ${lits === 1 ? "night" : "nights"} lit all night so far.`
      : last === 2
        ? `Last evening the rush was more than the grid could carry, and districts went dark for a while. It costs a little power, nothing more.`
        : "";

  return (
    <PanelFrame
      label="The grid"
      title="The grid"
      icon="⚡"
      tone="amber"
      status={partOfDay(run)}
      statusActive={isRush}
      statusTestId="lm-grid-part"
      testId="lm-grid"
      data={{
        "data-part": partOfDay(run),
        "data-level": level,
        "data-dark": dark,
      }}
      result={result}
      resultTestId="lm-grid-result"
      resultTone={last === 2 ? "slate" : "emerald"}
    >
      <DayStrip share={dayShare(run)} />
      <p
        data-testid="lm-grid-tonight"
        className="font-mono text-sm font-bold text-amber-100"
      >
        {isRush
          ? `The rush is on: everybody switched on at once.`
          : `Tonight's rush: a ${EVENING_NAMES[level]} evening, in ${clock(toRush)}.`}{" "}
        <span className="text-slate-200">
          With the streetlights as they are it asks for {asks.toFixed(1)}{" "}
          seconds of the grid on top of what the plants make.
        </span>
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Gauge
          testId="lm-grid-plants"
          label="Plants make"
          value={`${formatNumber(Math.floor(plants))} MW`}
          note="Every plant, with its lines. Cities want more at dusk."
        />
        <Gauge
          testId="lm-grid-lines"
          label="Lines carry"
          value={`${formatNumber(Math.floor(rushCarry(run)))} MW`}
          note={`The most the batteries can give back at once: ${Math.round(rateShare(run) * 100)}% of the plants.`}
        />
        <div
          data-testid="lm-grid-batteries"
          className="min-w-0 space-y-1 border-2 border-slate-600 bg-slate-900/80 p-2"
        >
          <p className={`${pixelClass} text-[10px] text-slate-300`}>
            Batteries
          </p>
          <p
            className={`${pixelClass} text-sm tabular-nums text-amber-200 sm:text-base`}
          >
            {capacity > 0 ? `${holds.toFixed(1)} s` : "none yet"}
          </p>
          <Segments
            share={capacity > 0 ? charge / capacity : 0}
            tone="bg-lime-300"
          />
          <p className="font-mono text-xs leading-snug text-slate-300">
            {capacity > 0
              ? `Stored of ${batterySecondsOfGrid(run).toFixed(1)} s they hold. They charge by day and carry the rush.`
              : "Buy some in the shop. They charge by day and carry the rush."}
          </p>
        </div>
      </div>
      <p className="font-mono text-xs text-slate-300">
        Short of power at the rush, districts go dark for a little while and pay
        nothing. Keep every district lit and the night pays a bonus.
        {out + lits > 0 && ` So far: ${lits} lit, ${out} dark.`}
      </p>
    </PanelFrame>
  );
}

export default memo(GridPanel);
