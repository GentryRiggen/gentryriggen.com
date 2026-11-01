"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import {
  TOWNS,
  chanceOf,
  hasWeatherVane,
  isShielded,
  lastStorm,
  shieldActionId,
  shieldSlots,
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

function ChanceBar({ chance, tone }: { chance: number; tone: string }) {
  const filled = Math.round((chance / 100) * CHANCE_SEGMENTS);
  return (
    <div
      aria-hidden="true"
      className="flex h-3 w-full gap-0.5 border-2 border-slate-600 bg-slate-950 p-px"
    >
      {Array.from({ length: CHANCE_SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={`h-full flex-1 ${i < filled ? tone : "bg-slate-800"}`}
        />
      ))}
    </div>
  );
}

interface TownCardProps {
  run: RunState;
  town: number;
  stage: ReturnType<typeof weatherStage>;
  onShield: () => void;
  isDoable: boolean;
}

function TownCard({ run, town, stage, onShield, isDoable }: TownCardProps) {
  const name = TOWNS[town];
  const chance = chanceOf(run, town);
  const isOn = isShielded(run, town);
  const storm = lastStorm(run);
  const isForecast = stage === "forecast";
  const wasHit = !isForecast && storm.kind !== "none" && storm.town === town;
  const isLikely = isForecast && chance >= 40;
  const frame = isOn
    ? "border-emerald-300 bg-emerald-950/70 shadow-[3px_3px_0_#064e3b]"
    : isForecast
      ? "border-sky-400 bg-slate-900/80 shadow-[3px_3px_0_#0c4a6e] hover:bg-slate-800/80 active:translate-y-0.5 active:shadow-none"
      : "border-slate-700 bg-slate-950/70 shadow-[3px_3px_0_#0f172a]";
  const body = (
    <>
      <span
        className={`${pixelClass} text-[8px] leading-tight text-sky-100 sm:text-[9px]`}
      >
        {name}
      </span>
      <TownArt town={town} />
      {isForecast ? (
        <>
          <span
            className={`${pixelClass} text-xl tabular-nums sm:text-2xl ${
              isLikely ? "text-amber-300" : "text-sky-200"
            }`}
          >
            {chance}%
          </span>
          <ChanceBar
            chance={chance}
            tone={isLikely ? "bg-amber-300" : "bg-sky-400"}
          />
          <span
            className={`${pixelClass} mt-1 block w-full border-2 px-1 py-2 text-[8px] leading-tight ${
              isOn
                ? "border-emerald-300 bg-emerald-400 text-emerald-950"
                : "border-sky-300 bg-sky-950 text-sky-100"
            }`}
          >
            {isOn ? "Shielded" : "Shield"}
          </span>
        </>
      ) : (
        <>
          <span
            className={`${pixelClass} text-[9px] ${
              wasHit ? "text-amber-200" : "text-slate-400"
            }`}
          >
            {wasHit ? (storm.kind === "flicker" ? "Flicker" : "Held!") : "Calm"}
          </span>
          {wasHit && (
            <span
              aria-hidden="true"
              className={`text-lg ${storm.kind === "flicker" ? "wx-flicker" : ""}`}
            >
              {storm.kind === "flicker" ? "💡" : "🛡"}
            </span>
          )}
        </>
      )}
    </>
  );
  const layout = `${isForecast ? "min-h-40" : "min-h-28"} flex min-w-0 flex-col items-center justify-between gap-1.5 border-4 p-2 text-center`;
  if (!isForecast) {
    return (
      <div
        data-testid={`lm-town-${town}`}
        className={`${layout} ${frame} ${
          wasHit ? "ring-2 ring-amber-300/70" : ""
        }`}
      >
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-testid={`lm-town-${town}`}
      aria-pressed={isOn}
      aria-label={`${isOn ? "Lift the sandbags at" : "Sandbag"} ${name}, ${chance}% chance of the storm`}
      onClick={() => {
        if (isDoable) onShield();
      }}
      className={`${layout} touch-manipulation transition-transform ${retroFocusClass} ${frame}`}
    >
      {body}
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
 * The Weather Desk: a storm front forms by itself, the forecast shows how
 * likely it is to hit each town, and the player may shield some. Nothing here
 * can be lost or missed; an ignored storm only flickers some lights.
 */
export default function WeatherDesk({ def, run, onAct }: WeatherDeskProps) {
  const stage = weatherStage(run);
  if (def.id !== "light" || stage === "closed" || run.complete) return null;

  const isForecast = stage === "forecast";
  const left = stageSecondsLeft(run);
  const share = 1 - left / stageLength(run);
  const slots = shieldSlots(run);
  const resultLine = stormResultLine(run);
  const storm = lastStorm(run);
  const held = run.resources.wxHeld ?? 0;
  const flickered = run.resources.wxFlickered ?? 0;
  const earned = run.resources.wxEarned ?? 0;
  const vaneTown = TOWNS[vanePick(run)];

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
          className={`${pixelClass} border-2 px-2 py-1 text-[8px] ${
            isForecast
              ? "border-amber-300 bg-amber-950 text-amber-200"
              : "border-slate-600 bg-slate-900 text-slate-300"
          }`}
        >
          {isForecast ? "Storm coming" : "All calm"}
        </p>
      </header>

      {isForecast ? (
        <p className="font-mono text-sm text-sky-50">
          Storm coming! Tap {slots === 1 ? "a town" : "up to 2 towns"} to put
          sandbags there. If the storm lands on one, you get bonus power. If
          not, the lights just flicker.
        </p>
      ) : (
        <p className="font-mono text-sm text-sky-50">
          {storm.kind === "none"
            ? "The sea is quiet. A storm front will form on its own, so there is nothing to do yet."
            : "The sea is quiet again. The next front forms on its own."}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {TOWNS.map((_, town) => (
          <TownCard
            key={town}
            run={run}
            town={town}
            stage={stage}
            isDoable={canPerformAction(def, run, shieldActionId(town))}
            onShield={() => onAct(shieldActionId(town))}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="flex items-baseline justify-between gap-3">
          <span className={`${pixelClass} text-[8px] text-sky-200`}>
            {isForecast ? "Landfall" : "Next front forming…"}
          </span>
          <span
            className={`${pixelClass} text-[10px] tabular-nums text-amber-100`}
          >
            {clock(left)}
          </span>
        </p>
        <FrontBar
          share={share}
          label={isForecast ? "Time until landfall" : "Next front forming"}
          tone={isForecast ? "bg-amber-300" : "bg-sky-500/70"}
        />
      </div>

      {isForecast && (
        <p className="font-mono text-xs text-slate-300">
          You can shield {slots} {slots === 1 ? "town" : "towns"} at a time.
          {hasWeatherVane(run) &&
            ` Pick none and the weather vane shields ${vaneTown} for you, for 60% of the bonus.`}
        </p>
      )}

      {resultLine && !isForecast && (
        <p
          data-testid="lm-weather-result"
          className={`border-2 p-2 font-mono text-sm font-bold ${
            storm.kind === "flicker"
              ? "border-slate-600 bg-slate-900/80 text-slate-200"
              : "border-emerald-400 bg-emerald-950/70 text-emerald-200"
          }`}
        >
          {resultLine}
        </p>
      )}

      {held + flickered > 0 && (
        <p className="font-mono text-xs text-slate-300">
          Storms so far: {held + flickered}. Sandbags held {held}{" "}
          {held === 1 ? "time" : "times"}
          {earned > 0 && ` (+${formatNumber(Math.floor(earned))} power)`}.
        </p>
      )}
    </section>
  );
}
