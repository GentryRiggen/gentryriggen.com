"use client";

import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  REGIONS,
  REGION_COUNT,
  flightsSoFar,
  flockDestination,
  flockPays,
  hasFlockLeader,
  isMigrationOpen,
  leaderPaysOn,
  migrationResultLine,
  migrationStage,
  mostWelcoming,
  regionGreen,
  regionWelcome,
  secondsToFlock,
  sendActionId,
} from "@/lib/ever-onward/universes/grow/migration";
import { incomePerSecond } from "@/lib/ever-onward/universes/grow/tick";
import type { PanelProps } from "../../universes/types";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";
import useRoving from "./useRoving";

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** How green a region looks on the map: bare, then four steps of green. */
const GREENS = ["#78716c", "#84a56b", "#65a30d", "#4d7c0f", "#166534"];
const greenFill = (green: number): string =>
  GREENS[Math.min(GREENS.length - 1, Math.round(green * (GREENS.length - 1)))];

const HOME = { x: 8, y: 48 };

/** The little map: five regions that turn green as flocks land. */
function FlockMap({
  run,
  stage,
}: {
  run: PanelProps["run"];
  stage: ReturnType<typeof migrationStage>;
}) {
  const dest = flockDestination(run);
  const flights = flightsSoFar(run);
  const bird = stage === "flying" ? REGIONS[dest] : HOME;
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-44 w-44 shrink-0 sm:h-48 sm:w-48"
      role="img"
      aria-label={
        stage === "flying"
          ? `The flock is flying to ${REGIONS[dest].name}`
          : stage === "ready"
            ? "A flock is ready on the left of the map"
            : "The map of five regions"
      }
      data-testid="lm-migration-map"
      data-stage={stage}
      shapeRendering="crispEdges"
    >
      <rect x="0" y="0" width="100" height="100" fill="#0c4a6e" />
      <rect x="3" y="3" width="94" height="94" fill="#075985" />
      {REGIONS.map((region, i) => {
        const green = regionGreen(run, i);
        const justLanded = stage !== "flying" && flights > 0 && dest === i;
        return (
          <g
            key={`${region.name}-${justLanded ? flights : 0}`}
            className={justLanded ? "bee-reveal-1" : undefined}
            data-testid={`lm-migration-region-${i}`}
            data-green={Math.round(green * 100)}
          >
            <rect
              x={region.x - 9}
              y={region.y - 8}
              width="18"
              height="16"
              fill={greenFill(green)}
            />
            <rect
              x={region.x - 9}
              y={region.y + 5}
              width="18"
              height="3"
              fill="#292524"
              opacity="0.35"
            />
            <text
              x={region.x}
              y={region.y + 18}
              textAnchor="middle"
              fill="#e0f2fe"
              fontSize="6"
              className={pixelClass}
            >
              {i + 1}
            </text>
          </g>
        );
      })}
      <g
        transform={`translate(${bird.x} ${bird.y})`}
        data-testid="lm-migration-flock"
      >
        <rect x="-4" y="-1" width="8" height="3" fill="#fef3c7" />
        <rect x="-7" y="-4" width="4" height="3" fill="#fef3c7" />
        <rect x="3" y="-4" width="4" height="3" fill="#fef3c7" />
      </g>
    </svg>
  );
}

/**
 * Seed migration: a flock of migrating birds gathers with seeds. Five
 * regions are on the map and each shows how much green a flock would grow
 * there, before you choose. Every region grows something, so nothing can go
 * wrong. A flock waits as long as it takes. The choices are a real radio
 * group (arrow keys, one tab stop); while no flock waits they stay put and
 * announce that they are off with aria-disabled.
 */
export default function SeedMigration({ run, onAct }: PanelProps) {
  const stage = migrationStage(run);
  const dest = flockDestination(run);
  const checkedIndex = stage === "flying" ? dest : mostWelcoming(run);
  const { radioProps } = useRoving(REGION_COUNT, checkedIndex);
  if (!isMigrationOpen(run) || run.complete) return null;

  const ready = stage === "ready";
  const flying = stage === "flying";
  const income = incomePerSecond(run);
  const best = mostWelcoming(run);
  const bestWelcome = Math.max(0.0001, regionWelcome(run, best));
  const resultLine = migrationResultLine(run);
  const flights = flightsSoFar(run);
  const earned = run.resources.mgEarned ?? 0;
  const shown = run.resources.mgShown ?? 0;

  const headline = ready
    ? "A flock of birds is ready to fly. Where should it carry its seeds?"
    : flying
      ? `The flock is flying to ${REGIONS[dest].name}...`
      : shown === 0
        ? "Birds are gathering on the hills."
        : `The next flock gathers in about ${clock(secondsToFlock(run))}.`;

  return (
    <section
      aria-label="Seed migration"
      data-testid="lm-migration"
      data-stage={stage}
      className="relative isolate space-y-3 overflow-hidden border-4 border-sky-400/80 bg-slate-950/85 p-3 shadow-[4px_4px_0_#075985]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-[10px] text-sky-200`}>
          <span aria-hidden="true" className="mr-2 text-sky-300">
            ~
          </span>
          Seed migration
        </h2>
        <p
          className={`${pixelClass} border-2 px-2 py-1 text-[8px] ${
            ready
              ? "border-sky-300 bg-sky-950 text-sky-100"
              : "border-slate-600 bg-slate-900 text-slate-300"
          }`}
        >
          {ready ? "A flock is ready!" : flying ? "In flight" : "Gathering"}
        </p>
      </header>

      <div className="flex items-center gap-3">
        <FlockMap run={run} stage={stage} />
        <div className="min-w-0 flex-1 space-y-2">
          <p
            data-testid="lm-migration-headline"
            className={`${pixelClass} text-xs leading-relaxed sm:text-sm ${
              ready ? "text-sky-300" : "text-lime-50"
            }`}
          >
            {headline}
          </p>
          <p className="font-mono text-xs text-slate-300">
            {ready
              ? "Every place grows something. Greener places welcome fewer seeds, and meadows make every welcome bigger."
              : "Nothing to do right now. The map stays as it is."}
          </p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Where to send the flock"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {REGIONS.map((region, i) => {
          const checked = flying && dest === i;
          const welcome = regionWelcome(run, i);
          const pays = flockPays(run, i, income);
          return (
            <button
              key={region.name}
              {...radioProps(i)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={!ready}
              aria-label={`Send the flock to ${region.name}`}
              aria-describedby={`lm-migration-${i}-note`}
              data-testid={`lm-migration-send-${i}`}
              onClick={() => {
                if (ready) onAct(sendActionId(i));
              }}
              className={`${pixelClass} flex min-h-14 w-full touch-manipulation items-center gap-2 border-4 px-2 py-2 text-left text-[9px] sm:text-[10px] ${retroFocusClass} ${
                checked
                  ? "border-sky-200 bg-sky-900 text-sky-100"
                  : ready
                    ? "border-sky-200 bg-sky-400 text-sky-950 shadow-[4px_4px_0_#075985] hover:bg-sky-300 active:translate-y-0.5 active:shadow-none"
                    : "border-slate-600 bg-slate-800 text-slate-400 shadow-[4px_4px_0_#0f172a]"
              }`}
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-current text-[10px]"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block">
                  {region.name}
                  {ready && best === i ? " (most welcome)" : ""}
                </span>
                <span
                  id={`lm-migration-${i}-note`}
                  data-testid={`lm-migration-welcome-${i}`}
                  className="block font-mono text-[11px] font-bold normal-case"
                >
                  About +{formatNumber(Math.floor(pays))} green (
                  {Math.round((welcome / bestWelcome) * 100)}% welcome), a{" "}
                  {region.hop} second flight
                </span>
                <span className="block font-mono text-[11px] normal-case">
                  {region.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p
        role="status"
        aria-live="polite"
        data-testid="lm-migration-result"
        className={
          resultLine
            ? "border-2 border-emerald-400 bg-emerald-950/70 p-2 font-mono text-sm font-bold text-emerald-200"
            : "sr-only"
        }
      >
        {resultLine ?? ""}
      </p>

      {hasFlockLeader(run) && (
        <p className="font-mono text-xs text-sky-100">
          The flock leader sends a flock that waits a while to the most
          welcoming place: about +
          {formatNumber(Math.floor(leaderPaysOn(run, income)))} green, on top of
          what you send by hand.
        </p>
      )}

      {flights > 0 && (
        <p className="font-mono text-xs text-slate-300">
          Flocks landed so far: {flights} (+{formatNumber(Math.floor(earned))}{" "}
          green).
        </p>
      )}
    </section>
  );
}
