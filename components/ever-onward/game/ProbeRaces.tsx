"use client";

import { useState } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import {
  ROUTES,
  bestHaul,
  cometCloseness,
  cometPlace,
  hasMissionControl,
  hasRacingFins,
  isProbeOut,
  isProbesOpen,
  isScoutOut,
  lastRoute,
  launchActionId,
  progressOf,
  resultLine,
  routeHaul,
  routeOut,
  routeSeconds,
  runsHome,
  scoutProgress,
  scoutRunsHome,
  scoutSecondsLeft,
  secondsLeft,
} from "@/lib/ever-onward/universes/light/probes";
import { calmSkyIncomePerSecond } from "@/lib/ever-onward/universes/light/tick";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

interface ProbeRacesProps {
  def: UniverseDef;
  run: RunState;
  onAct: (id: string) => void;
}

interface Point {
  x: number;
  y: number;
}

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

const energy = (value: number): string => `+${formatNumber(Math.floor(value))}`;

/** The little star map (a 200 x 110 picture): the dock, five stars, three routes. */
const DOCK: Point = { x: 16, y: 92 };
const STARS: Record<string, Point> = {
  A: { x: 46, y: 64 },
  B: { x: 88, y: 46 },
  C: { x: 124, y: 78 },
  D: { x: 152, y: 34 },
  E: { x: 182, y: 72 },
  K: { x: 108, y: 44 },
  F: { x: 150, y: 86 },
};
/** Each route goes out from the dock, past its stars, and back home. */
const ROUTE_STOPS: readonly (readonly Point[])[] = [
  [DOCK, STARS.A, STARS.B, STARS.C, DOCK],
  [DOCK, STARS.B, STARS.D, STARS.E, STARS.C, DOCK],
  [DOCK, STARS.A, STARS.K, STARS.F, DOCK],
];
/** The comet's pass runs along the top of the map. */
const COMET_FROM = 28;
const COMET_TO = 188;
const COMET_Y = 14;
const BACKDROP: readonly Point[] = [
  { x: 10, y: 12 },
  { x: 30, y: 40 },
  { x: 62, y: 20 },
  { x: 70, y: 100 },
  { x: 120, y: 14 },
  { x: 134, y: 52 },
  { x: 170, y: 98 },
  { x: 192, y: 22 },
  { x: 196, y: 100 },
  { x: 100, y: 102 },
];

const lengthOf = (a: Point, b: Point): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

/** Where a probe is, and which way it points, `share` (0..1) of the way round. */
function along(
  stops: readonly Point[],
  share: number
): { x: number; y: number; angle: number } {
  const legs = stops.slice(1).map((to, i) => lengthOf(stops[i], to));
  const total = legs.reduce((sum, leg) => sum + leg, 0);
  let left = Math.min(1, Math.max(0, share)) * total;
  for (let i = 0; i < legs.length; i += 1) {
    if (left <= legs[i] || i === legs.length - 1) {
      const t = legs[i] === 0 ? 0 : Math.min(1, left / legs[i]);
      const from = stops[i];
      const to = stops[i + 1];
      return {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        angle: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
      };
    }
    left -= legs[i];
  }
  return { ...stops[0], angle: 0 };
}

const pathOf = (stops: readonly Point[]): string =>
  stops.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");

interface StarMapProps {
  route: number;
  isOut: boolean;
  progress: number;
  isScoutOut: boolean;
  scoutShare: number;
  comet: number;
  hasFins: boolean;
  hasControl: boolean;
}

/** A tiny space-age map: the route to fly, the probe on it, and the comet. */
function StarMap({
  route,
  isOut,
  progress,
  isScoutOut: scoutIsOut,
  scoutShare,
  comet,
  hasFins,
  hasControl,
}: StarMapProps) {
  const stops = ROUTE_STOPS[route];
  const probe = isOut ? along(stops, progress) : { ...DOCK, angle: -45 };
  const scout = along(stops, scoutShare);
  const cometX = COMET_FROM + (COMET_TO - COMET_FROM) * comet;
  return (
    <svg
      viewBox="0 0 200 110"
      className="h-auto w-full"
      role="img"
      aria-label={`Star map: the ${ROUTES[route].name.toLowerCase()} route`}
      data-testid="lm-probe-map"
      data-route={ROUTES[route].id}
      data-progress={progress.toFixed(2)}
      shapeRendering="crispEdges"
    >
      <rect x="1" y="1" width="198" height="108" fill="#0a0a23" />
      <rect
        x="1"
        y="1"
        width="198"
        height="108"
        fill="none"
        stroke="#312e81"
        strokeWidth="2"
      />
      {BACKDROP.map((p, i) => (
        <rect
          key={`${p.x}-${p.y}`}
          x={p.x}
          y={p.y}
          width="2"
          height="2"
          fill="#c7d2fe"
          className={i % 3 === 0 ? "pr-twinkle" : undefined}
          opacity="0.6"
        />
      ))}
      {/* the other routes, faint, so a child sees there are three to choose from */}
      {ROUTE_STOPS.map((other, i) =>
        i === route ? null : (
          <path
            key={ROUTES[i].id}
            d={pathOf(other)}
            fill="none"
            stroke="#6366f1"
            strokeOpacity="0.22"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        )
      )}
      <path
        d={pathOf(stops)}
        fill="none"
        stroke="#fcd34d"
        strokeWidth="1.6"
        strokeDasharray="5 3"
      />
      {/* the comet passing over the top of the map */}
      <g transform={`translate(${cometX} ${COMET_Y})`}>
        <line
          x1={comet > 0.5 ? 14 : -14}
          x2="0"
          y1="3"
          y2="0"
          stroke="#7dd3fc"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.6"
        />
        <circle r="4" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1.5" />
      </g>
      {Object.entries(STARS).map(([name, p]) => {
        const isOnRoute = stops.includes(p);
        return (
          <g key={name} transform={`translate(${p.x} ${p.y})`}>
            {isOnRoute && (
              <circle
                r="7"
                fill="none"
                stroke="#fcd34d"
                strokeOpacity="0.5"
                className="pr-ping"
              />
            )}
            <polygon
              points="0,-4.5 1.6,-1.6 4.5,0 1.6,1.6 0,4.5 -1.6,1.6 -4.5,0 -1.6,-1.6"
              fill={isOnRoute ? "#fde68a" : "#64748b"}
            />
          </g>
        );
      })}
      {/* the dock, with mission control beside it once it is built */}
      <g transform={`translate(${DOCK.x} ${DOCK.y})`}>
        <rect x="-11" y="4" width="22" height="5" fill="#475569" />
        <rect x="-11" y="4" width="22" height="2" fill="#94a3b8" />
        <rect x="-1" y="-6" width="2" height="10" fill="#94a3b8" />
        <rect x="1" y="-6" width="6" height="3" fill="#f87171" />
        {hasControl && (
          <g transform="translate(-22 2)">
            <rect x="-5" y="2" width="10" height="7" fill="#475569" />
            <path d="M-5 2 Q0 -8 5 2 Z" fill="#7dd3fc" stroke="#e0f2fe" />
          </g>
        )}
      </g>
      {/* the scout, flying on its own */}
      {scoutIsOut && (
        <g
          data-testid="lm-probe-scout"
          transform={`translate(${scout.x} ${scout.y}) rotate(${scout.angle})`}
        >
          <circle r="2.6" fill="#7dd3fc" stroke="#e0f2fe" strokeWidth="0.8" />
        </g>
      )}
      {/* the racing probe: a bright arrow with fins, and a trail */}
      <g
        data-testid="lm-probe-ship"
        transform={`translate(${probe.x} ${probe.y}) rotate(${probe.angle})`}
      >
        {isOut && (
          <polygon
            points="-4,0 -17,-3 -17,3"
            fill="#fb923c"
            fillOpacity="0.85"
            className="pr-exhaust"
          />
        )}
        {hasFins && (
          <>
            <polygon points="-5,0 -9,-6 -2,-2" fill="#f87171" />
            <polygon points="-5,0 -9,6 -2,2" fill="#f87171" />
          </>
        )}
        <polygon
          points="7,0 -4,-4.5 -2,0 -4,4.5"
          fill="#ffffff"
          stroke="#facc15"
          strokeWidth="1.2"
        />
      </g>
    </svg>
  );
}

/** A bar that shows where the comet is: lit up when it is close to the route. */
function CometBar({ place, closeness }: { place: number; closeness: number }) {
  const isNear = closeness >= 0.7;
  return (
    <span className="block space-y-1" data-testid="lm-probe-comet-bar">
      <svg
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="block h-4 w-full"
        role="meter"
        aria-label="How close the comet is"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(closeness * 100)}
        shapeRendering="crispEdges"
      >
        <rect width="100" height="10" fill="#020617" />
        <rect x="35" width="30" height="10" fill="#fbbf24" fillOpacity="0.3" />
        <rect
          x={Math.min(94, Math.max(0, place * 100 - 3))}
          width="6"
          height="10"
          fill={isNear ? "#fcd34d" : "#38bdf8"}
          stroke={isNear ? "#fffbeb" : "#e0f2fe"}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <rect
          width="100"
          height="10"
          fill="none"
          stroke="#64748b"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="flex justify-between font-mono text-[11px] font-bold text-slate-300">
        <span>Far away</span>
        <span className={isNear ? "text-amber-300" : undefined}>
          {isNear ? "Close: go now!" : "Close"}
        </span>
        <span>Far away</span>
      </span>
    </span>
  );
}

interface RouteCardProps {
  index: number;
  run: RunState;
  income: number;
  isPicked: boolean;
  isFlying: boolean;
  onPick: (index: number) => void;
}

function RouteCard({
  index,
  run,
  income,
  isPicked,
  isFlying,
  onPick,
}: RouteCardProps) {
  const route = ROUTES[index];
  const isComet = route.id === "comet";
  const closeness = cometCloseness(run);
  const seconds = Math.round(routeSeconds(run, index));
  const haul = routeHaul(run, index, income);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isPicked}
      data-testid={`lm-probe-card-${route.id}`}
      onClick={() => onPick(index)}
      className={`block w-full touch-manipulation border-4 p-2 text-left transition-colors ${retroFocusClass} ${
        isPicked
          ? "border-amber-300 bg-indigo-950 shadow-[3px_3px_0_#78350f]"
          : "border-slate-600 bg-slate-900/80 hover:border-indigo-300"
      }`}
    >
      <span className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${
            isPicked ? "border-amber-300" : "border-slate-500"
          }`}
        >
          {isPicked && <span className="h-2.5 w-2.5 bg-amber-300" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`${pixelClass} block text-[10px] text-indigo-100`}>
            {route.name}
          </span>
          <span className="mt-1 block font-mono text-xs text-slate-300">
            {route.blurb}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span
            data-testid={`lm-probe-time-${route.id}`}
            className={`${pixelClass} block text-sm text-sky-200`}
          >
            {seconds} s
          </span>
          <span
            data-testid={`lm-probe-haul-${route.id}`}
            className="mt-1 block font-mono text-sm font-bold text-amber-300"
          >
            {energy(haul)}
            {isComet && "…"}
          </span>
        </span>
      </span>
      {isComet && (
        <span className="mt-2 block">
          <CometBar place={cometPlace(run)} closeness={closeness} />
          <span className="mt-1 block font-mono text-xs text-slate-300">
            Up to {energy(bestHaul(index, income))} when the comet is close.
          </span>
        </span>
      )}
      {isFlying && isPicked && (
        <span className="sr-only">This route is being flown.</span>
      )}
    </button>
  );
}

function ProbeRacesPanel({ def, run, onAct }: ProbeRacesProps) {
  const lastFlown = lastRoute(run);
  const [picked, setPicked] = useState(lastFlown >= 0 ? lastFlown : 0);
  const isOut = isProbeOut(run);
  const income = calmSkyIncomePerSecond(run);
  const mapRoute = isOut ? routeOut(run) : picked;
  const action = launchActionId(picked);
  const isDoable = !isOut && canPerformAction(def, run, action);
  const homeCount = runsHome(run);
  const line = resultLine(run);
  const earned = run.resources.prEarned ?? 0;
  const scoutEarned = run.resources.prAutoEarned ?? 0;
  const scoutHome = scoutRunsHome(run);
  const route = ROUTES[picked];
  const progress = progressOf(run);
  const launchLook = isOut
    ? "border-slate-600 bg-slate-800 text-slate-200 shadow-[4px_4px_0_#0f172a]"
    : "border-amber-200 bg-amber-400 text-amber-950 shadow-[4px_4px_0_#78350f,0_0_18px_rgba(251,191,36,0.6)] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none";

  return (
    <section
      aria-label="Probe races"
      data-testid="lm-probe-panel"
      data-probe={isOut ? "out" : "docked"}
      className="relative isolate space-y-3 overflow-hidden border-4 border-indigo-400/80 bg-slate-950/85 p-3 shadow-[4px_4px_0_#312e81]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-[10px] text-indigo-200`}>
          <span aria-hidden="true" className="mr-2 text-amber-300">
            ★
          </span>
          Probe races
        </h2>
        <p
          data-testid="lm-probe-status"
          className={`${pixelClass} border-2 px-2 py-1 text-[8px] ${
            isOut
              ? "border-amber-300 bg-amber-950 text-amber-100"
              : "border-slate-600 bg-slate-900 text-slate-300"
          }`}
        >
          {isOut
            ? `Probe is out: ${clock(secondsLeft(run))} left`
            : "Probe is at the dock"}
        </p>
      </header>

      <StarMap
        route={mapRoute}
        isOut={isOut}
        progress={progress}
        isScoutOut={isScoutOut(run)}
        scoutShare={scoutProgress(run)}
        comet={cometPlace(run)}
        hasFins={hasRacingFins(run)}
        hasControl={hasMissionControl(run)}
      />

      <p className="font-mono text-xs text-slate-300">
        {isOut
          ? "Your probe is flying the route. Plan the next one while you wait."
          : "Pick a route, then launch. The probe flies it by itself and brings energy home."}
      </p>

      <div role="radiogroup" aria-label="Route" className="space-y-2">
        {ROUTES.map((_, index) => (
          <RouteCard
            key={ROUTES[index].id}
            index={index}
            run={run}
            income={income}
            isPicked={picked === index}
            isFlying={isOut && routeOut(run) === index}
            onPick={setPicked}
          />
        ))}
      </div>

      <div className="space-y-1">
        <button
          type="button"
          data-testid="lm-probe-launch"
          disabled={!isDoable}
          onClick={() => {
            if (isDoable) onAct(action);
          }}
          className={`${pixelClass} flex min-h-14 w-full touch-manipulation flex-col items-center justify-center gap-1 border-4 px-3 py-2 text-xs transition-transform disabled:cursor-not-allowed ${retroFocusClass} ${launchLook}`}
        >
          <span>
            {isOut
              ? `Probe is out: ${clock(secondsLeft(run))} left`
              : `Launch: ${route.name}`}
          </span>
          {!isOut && (
            <span className="font-mono text-[11px] font-bold normal-case">
              {Math.round(routeSeconds(run, picked))} s, about{" "}
              {energy(routeHaul(run, picked, income))} energy
            </span>
          )}
        </button>
        {isOut && (
          <svg
            viewBox="0 0 100 8"
            preserveAspectRatio="none"
            className="block h-3 w-full"
            role="progressbar"
            aria-label="Probe trip"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            data-testid="lm-probe-progress"
            shapeRendering="crispEdges"
          >
            <rect width="100" height="8" fill="#020617" />
            <rect width={progress * 100} height="8" fill="#fcd34d" />
            <rect
              width="100"
              height="8"
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>

      {line && (
        <p
          role="status"
          data-testid="lm-probe-result"
          className="border-2 border-emerald-400 bg-emerald-950/70 p-2 font-mono text-sm font-bold text-emerald-200"
        >
          {line}
        </p>
      )}

      {hasMissionControl(run) && (
        <p
          data-testid="lm-probe-scout-line"
          className="font-mono text-xs text-sky-100"
        >
          {lastFlown < 0
            ? "Mission control is ready. Fly a route and its scout will follow it."
            : isScoutOut(run)
              ? `The scout probe is out on the ${ROUTES[lastFlown].name.toLowerCase()}: ${clock(scoutSecondsLeft(run))} left. It brings a smaller haul, on top of yours.`
              : "The scout probe is at the dock."}
        </p>
      )}

      {homeCount > 0 && (
        <p className="font-mono text-xs text-slate-300">
          Runs home: {homeCount} ({energy(earned)} energy
          {scoutHome > 0 && `, ${energy(scoutEarned)} from the scout`}).
        </p>
      )}
    </section>
  );
}

/**
 * Probe races: pick one of three routes on the star map and launch the racing
 * probe. It flies by itself and brings a haul of energy home, then waits at
 * the dock until the next launch. Nothing is ever lost by leaving it there.
 */
export default function ProbeRaces({ def, run, onAct }: ProbeRacesProps) {
  if (def.id !== "light" || !isProbesOpen(run) || run.complete) return null;
  return <ProbeRacesPanel def={def} run={run} onAct={onAct} />;
}
