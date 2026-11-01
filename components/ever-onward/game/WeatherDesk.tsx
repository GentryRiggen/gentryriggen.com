"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import {
  TOWNS,
  chanceOf,
  crewActionId,
  crewCount,
  crewThatMoves,
  crewsPlaced,
  forecastStep,
  hasCrew,
  hasWeatherVane,
  isOut,
  lastStorm,
  outageSecondsLeft,
  readiness,
  readySeconds,
  stageLength,
  stageSecondsLeft,
  stormResultLine,
  vanePick,
  weatherStage,
} from "@/lib/ever-onward/universes/light/weather";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

interface WeatherDeskProps {
  def: UniverseDef;
  run: RunState;
  onAct: (id: string) => void;
}

const SEGMENTS = 20;
const CHANCE_SEGMENTS = 10;
const READY_SEGMENTS = 5;
/** The storm's track above the map: nine spots, left to right. */
const TRACK_SPOTS = 9;
const TRACK_COLUMNS = [
  "col-start-1",
  "col-start-2",
  "col-start-3",
  "col-start-4",
  "col-start-5",
  "col-start-6",
  "col-start-7",
  "col-start-8",
  "col-start-9",
] as const;
const FORECAST_STEPS = 3;

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** Little pixel pictures of the three towns (river, hill, harbor). */
function TownArt({ town }: { town: number }) {
  return (
    <svg
      viewBox="0 0 16 12"
      className="h-9 w-12 shrink-0"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {town === 0 && (
        <>
          <rect x="0" y="9" width="16" height="3" fill="#38bdf8" />
          <rect x="2" y="9" width="4" height="1" fill="#e0f2fe" />
          <rect x="9" y="10" width="5" height="1" fill="#e0f2fe" />
          <rect x="2" y="4" width="5" height="5" fill="#fbbf24" />
          <rect x="1" y="3" width="7" height="1" fill="#b45309" />
          <rect x="9" y="5" width="5" height="4" fill="#fde68a" />
          <rect x="8" y="4" width="7" height="1" fill="#b45309" />
          <rect x="4" y="6" width="1" height="2" fill="#78350f" />
        </>
      )}
      {town === 1 && (
        <>
          <polygon points="0,12 7,2 16,12" fill="#4ade80" />
          <polygon points="7,2 10,6 4,6" fill="#bbf7d0" />
          <rect x="9" y="6" width="5" height="4" fill="#fbbf24" />
          <rect x="8" y="5" width="7" height="1" fill="#b45309" />
          <rect x="11" y="8" width="1" height="2" fill="#78350f" />
        </>
      )}
      {town === 2 && (
        <>
          <rect x="0" y="9" width="16" height="3" fill="#0ea5e9" />
          <rect x="3" y="7" width="9" height="2" fill="#b45309" />
          <rect x="4" y="9" width="7" height="1" fill="#78350f" />
          <rect x="7" y="1" width="1" height="6" fill="#e2e8f0" />
          <polygon points="8,1 8,5 12,5" fill="#fbbf24" />
          <rect x="13" y="6" width="2" height="3" fill="#94a3b8" />
        </>
      )}
    </svg>
  );
}

function Segments({
  share,
  count,
  tone,
}: {
  share: number;
  count: number;
  tone: string;
}) {
  const filled = Math.round(Math.min(1, Math.max(0, share)) * count);
  return (
    <span
      aria-hidden="true"
      className="flex h-3 w-full gap-0.5 border-2 border-slate-600 bg-slate-950 p-px"
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-full flex-1 ${i < filled ? tone : "bg-slate-800"}`}
        />
      ))}
    </span>
  );
}

/** A little pixel crew member in a hard hat. */
function CrewArt({ isReady }: { isReady: boolean }) {
  return (
    <svg
      viewBox="0 0 8 10"
      className="h-6 w-5 shrink-0"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect x="1" y="0" width="6" height="2" fill="#facc15" />
      <rect x="2" y="2" width="4" height="2" fill="#fcd34d" />
      <rect
        x="1"
        y="4"
        width="6"
        height="3"
        fill={isReady ? "#f97316" : "#94a3b8"}
      />
      <rect x="1" y="7" width="2" height="3" fill="#1e3a8a" />
      <rect x="5" y="7" width="2" height="3" fill="#1e3a8a" />
    </svg>
  );
}

interface TownCardProps {
  run: RunState;
  town: number;
  onSend: () => void;
  isDoable: boolean;
}

function TownCard({ run, town, onSend, isDoable }: TownCardProps) {
  const name = TOWNS[town];
  const isForecast = weatherStage(run) === "forecast";
  const chance = chanceOf(run, town);
  const isHere = hasCrew(run, town);
  const ready = readiness(run, town);
  const isDark = isOut(run, town);
  const isLikely = isForecast && chance >= 40;
  const mover = crewThatMoves(run, town);
  const frame = isDark
    ? "border-slate-500 bg-slate-950 shadow-[3px_3px_0_#0f172a]"
    : isHere
      ? "border-emerald-300 bg-emerald-950/70 shadow-[3px_3px_0_#064e3b]"
      : "border-sky-400 bg-slate-900/80 shadow-[3px_3px_0_#0c4a6e] hover:bg-slate-800/80 active:translate-y-0.5 active:shadow-none";
  const action = isHere
    ? "Call back"
    : mover !== null
      ? `Move crew here`
      : "Send a crew";
  const spoken = [
    isHere ? `Call the crew back from ${name}` : `Send a crew to ${name}`,
    isForecast ? `${chance}% chance of the storm` : null,
    isDark ? "its lights are out" : null,
    isHere ? `crew ${Math.round(ready * 100)}% ready` : null,
    mover !== null ? `moves the crew from ${TOWNS[mover]}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      type="button"
      data-testid={`lm-town-${town}`}
      data-dark={isDark}
      aria-pressed={isHere}
      aria-label={spoken}
      aria-disabled={!isDoable}
      onClick={() => {
        if (isDoable) onSend();
      }}
      className={`flex min-h-44 min-w-0 touch-manipulation flex-col items-center justify-between gap-1.5 border-4 p-2 text-center transition-transform ${retroFocusClass} ${frame}`}
    >
      <span
        className={`${pixelClass} text-[8px] leading-tight text-sky-100 sm:text-[9px]`}
      >
        {name}
      </span>
      <span className={isDark ? "opacity-40 grayscale" : ""}>
        <TownArt town={town} />
      </span>
      {isForecast ? (
        <>
          <span
            className={`${pixelClass} text-lg tabular-nums sm:text-xl ${
              isLikely ? "text-amber-300" : "text-sky-200"
            }`}
          >
            {chance}%
          </span>
          <Segments
            share={chance / 100}
            count={CHANCE_SEGMENTS}
            tone={isLikely ? "bg-amber-300" : "bg-sky-400"}
          />
        </>
      ) : (
        <span className={`${pixelClass} text-[9px] text-slate-400`}>
          {isDark ? "Dark" : "Calm"}
        </span>
      )}
      {isDark && (
        <span className="font-mono text-[11px] font-bold text-slate-200 tabular-nums">
          Lights out {clock(outageSecondsLeft(run, town))}
        </span>
      )}
      <span className="flex min-h-6 w-full items-center gap-1">
        {isHere ? (
          <>
            <CrewArt isReady={ready >= 1} />
            <Segments
              share={ready}
              count={READY_SEGMENTS}
              tone="bg-orange-400"
            />
          </>
        ) : (
          <span className="w-full font-mono text-[10px] text-slate-400">
            no crew
          </span>
        )}
      </span>
      <span
        className={`${pixelClass} block w-full border-2 px-1 py-2 text-[8px] leading-tight ${
          isHere
            ? "border-emerald-300 bg-emerald-400 text-emerald-950"
            : "border-sky-300 bg-sky-950 text-sky-100"
        }`}
      >
        {action}
      </span>
    </button>
  );
}

/** A segmented bar that fills as the front draws near. */
function FrontBar({
  share,
  label,
  tone,
}: {
  share: number;
  label: string;
  tone: string;
}) {
  const filled = Math.floor(Math.min(1, Math.max(0, share)) * SEGMENTS);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(share * 100)}
      className="flex h-4 gap-0.5 border-2 border-slate-600 bg-slate-950 p-0.5"
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-full flex-1 ${i < filled ? tone : "bg-slate-800"}`}
        />
      ))}
    </div>
  );
}

/**
 * Where the storm is heading: the chance-weighted middle of the three towns,
 * on a track of nine spots above the map. It slides as the forecast firms.
 */
function StormTrack({ run }: { run: RunState }) {
  const weight = TOWNS.reduce((sum, _, t) => sum + chanceOf(run, t), 0);
  const middle =
    weight > 0
      ? TOWNS.reduce((sum, _, t) => sum + t * chanceOf(run, t), 0) / weight
      : 1;
  const spot = Math.min(
    TRACK_SPOTS - 1,
    Math.max(0, Math.round((middle / (TOWNS.length - 1)) * (TRACK_SPOTS - 1)))
  );
  return (
    <div
      aria-hidden="true"
      data-testid="lm-storm-track"
      data-spot={spot}
      className="grid h-7 grid-cols-9 items-center border-b-2 border-dashed border-sky-700/70"
    >
      <span
        className={`${TRACK_COLUMNS[spot]} row-start-1 text-center text-xl transition-all duration-700`}
      >
        ⛈
      </span>
    </div>
  );
}

/**
 * The Weather Desk: a storm forms, its forecast firms up over three steps,
 * and the player sends repair crews where they think it will land. A crew
 * takes a while to get ready, so an early guess and a late sure move are
 * both choices. A town hit with no crew goes dark for a while (a crew fixes
 * it fast); nothing is ever lost or missed.
 */
export default function WeatherDesk({ def, run, onAct }: WeatherDeskProps) {
  const stage = weatherStage(run);
  if (stage === "closed" || run.complete) return null;

  const isForecast = stage === "forecast";
  const left = stageSecondsLeft(run);
  const share = 1 - left / stageLength(run);
  const crews = crewCount(run);
  const placed = crewsPlaced(run);
  const resultLine = stormResultLine(run);
  const storm = lastStorm(run);
  const held = run.resources.wxHeld ?? 0;
  const flickered = run.resources.wxFlickered ?? 0;
  const fixes = run.resources.wxFixes ?? 0;
  const earned = run.resources.wxEarned ?? 0;
  const vaneTown = TOWNS[vanePick(run)];
  const step = forecastStep(run);

  return (
    <section
      aria-label="Weather desk"
      data-testid="lm-weather"
      data-stage={stage}
      className="relative isolate space-y-3 overflow-hidden border-4 border-sky-400/80 bg-slate-950/85 p-3 shadow-[4px_4px_0_#0c4a6e]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-sky-950 via-slate-950 to-slate-950" />
        <span className="wx-cloud absolute top-1 left-0 h-3 w-16 bg-slate-600/40" />
        <span className="wx-cloud absolute top-5 left-0 h-2 w-10 bg-slate-500/30 [animation-delay:-28s]" />
        {isForecast && (
          <>
            <div className="wx-rain absolute inset-0" />
            <div className="wx-rain-b absolute inset-0" />
            <div className="wx-flash absolute inset-0 bg-sky-100" />
          </>
        )}
      </div>

      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-[10px] text-sky-200`}>
          <span aria-hidden="true" className="mr-2 text-amber-300">
            ⛈
          </span>
          Weather desk
        </h2>
        <p
          data-testid="lm-weather-step"
          className={`${pixelClass} border-2 px-2 py-1 text-[8px] ${
            isForecast
              ? "border-amber-300 bg-amber-950 text-amber-200"
              : "border-slate-600 bg-slate-900 text-slate-300"
          }`}
        >
          {isForecast
            ? `Forecast ${step} of ${FORECAST_STEPS}`
            : "Storm forming"}
        </p>
      </header>

      <p className="font-mono text-sm text-sky-50">
        {isForecast
          ? step < FORECAST_STEPS
            ? "The storm's path gets surer each step. Move a crew now on a guess, or wait for a surer forecast: a crew needs time to get ready."
            : "Last forecast: this is about where it lands."
          : `A storm is forming out at sea. You can send ${
              crews === 1 ? "your crew" : "your crews"
            } ahead. A crew takes about ${Math.round(
              readySeconds(run)
            )} seconds to get ready.`}
      </p>

      {isForecast && <StormTrack run={run} />}

      <div className="grid grid-cols-3 gap-2">
        {TOWNS.map((_, town) => (
          <TownCard
            key={town}
            run={run}
            town={town}
            isDoable={canPerformAction(def, run, crewActionId(town))}
            onSend={() => onAct(crewActionId(town))}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="flex items-baseline justify-between gap-3">
          <span className={`${pixelClass} text-[8px] text-sky-200`}>
            {isForecast ? "Landfall" : "Next storm forming…"}
          </span>
          <span
            className={`${pixelClass} text-[10px] tabular-nums text-amber-100`}
          >
            {clock(left)}
          </span>
        </p>
        <FrontBar
          share={share}
          label={isForecast ? "Time until landfall" : "Next storm forming"}
          tone={isForecast ? "bg-amber-300" : "bg-sky-500/70"}
        />
      </div>

      <p className="font-mono text-xs text-slate-300">
        Crews out: {placed} of {crews}. A town with no crew goes dark for a
        while when the storm hits; a crew fixes it fast.
        {hasWeatherVane(run) &&
          ` The weather vane also watches ${vaneTown} for you, for 60% of the bonus.`}
      </p>

      {/* Changes only when a storm lands, so it is read once. */}
      <p
        role="status"
        aria-live="polite"
        data-testid="lm-weather-result"
        className={
          resultLine
            ? `border-2 p-2 font-mono text-sm font-bold ${
                storm.kind === "flicker"
                  ? "border-slate-600 bg-slate-900/80 text-slate-200"
                  : "border-emerald-400 bg-emerald-950/70 text-emerald-200"
              }`
            : "sr-only"
        }
      >
        {resultLine ?? ""}
      </p>

      {held + flickered > 0 && (
        <p className="font-mono text-xs text-slate-300">
          Storms so far: {held + flickered}. Crews met {held}
          {earned > 0 && ` (+${formatNumber(Math.floor(earned))} power)`}
          {fixes > 0 &&
            `, and fixed ${fixes} dark ${fixes === 1 ? "town" : "towns"}`}
          .
        </p>
      )}
    </section>
  );
}
