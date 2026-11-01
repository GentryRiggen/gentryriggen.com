"use client";

import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { RunState } from "@/lib/ever-onward/engine/types";
import {
  PATCHES,
  beeResultLine,
  danceAngle,
  danceHint,
  danceLength,
  dancesSoFar,
  followActionId,
  followsSoFar,
  hasBeeKeeper,
  isBeesOpen,
  isDancing,
  keeperPays,
  patchPays,
  secondsToDance,
} from "@/lib/ever-onward/universes/grow/bees";
import { incomePerSecond } from "@/lib/ever-onward/universes/grow/tick";
import type { PanelProps } from "../../universes/types";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

const CENTER = 100;
/** A patch sits this far from the hive at length 0 and at length 1. */
const NEAR = 30;
const FAR = 82;

const place = (angle: number, length: number): { x: number; y: number } => {
  const rad = (angle * Math.PI) / 180;
  const r = NEAR + length * (FAR - NEAR);
  return { x: CENTER + Math.sin(rad) * r, y: CENTER - Math.cos(rad) * r };
};

const WAYS = [
  "straight up",
  "up and to the right",
  "to the right",
  "down and to the right",
  "straight down",
  "down and to the left",
  "to the left",
  "up and to the left",
] as const;

/** The dance in plain words: which way, and how far. */
export function describeDance(angle: number, length: number): string {
  const way = WAYS[Math.round((((angle % 360) + 360) % 360) / 45) % 8];
  const far =
    length < 0.4 ? "a short way" : length < 0.7 ? "a fair way" : "far";
  return `The bee waggles ${way}, ${far} off.`;
}

/** A flower: petals around a bright middle, in the patch's colour. */
function Flower({ x, y, fill }: { x: number; y: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-2" y="-9" width="4" height="4" fill={fill} />
      <rect x="-2" y="5" width="4" height="4" fill={fill} />
      <rect x="-9" y="-2" width="4" height="4" fill={fill} />
      <rect x="5" y="-2" width="4" height="4" fill={fill} />
      <rect x="-3" y="-3" width="6" height="6" fill="#fde047" />
    </g>
  );
}

const PATCH_FILLS = ["#a3e635", "#c084fc", "#f9a8d4", "#fb923c"];

/** The dance floor: the hive in the middle, the patches around it. */
function Compass({ run, dancing }: { run: RunState; dancing: boolean }) {
  const angle = danceAngle(run);
  const length = danceLength(run);
  const reach = NEAR + length * (FAR - NEAR);
  return (
    <svg
      viewBox="0 0 200 200"
      className="h-44 w-44 shrink-0 sm:h-48 sm:w-48"
      role="img"
      aria-label={
        dancing
          ? describeDance(angle, length)
          : "The bees are out among the flowers"
      }
      data-testid="lm-bees-compass"
      data-dancing={dancing ? "true" : "false"}
      shapeRendering="crispEdges"
    >
      <rect x="2" y="2" width="196" height="196" fill="#1a2e05" />
      <rect x="6" y="6" width="188" height="188" fill="#365314" />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={NEAR + 20}
        fill="none"
        stroke="#4d7c0f"
        strokeWidth="1.5"
        strokeDasharray="3 4"
      />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={FAR}
        fill="none"
        stroke="#4d7c0f"
        strokeWidth="1.5"
        strokeDasharray="3 4"
      />
      {PATCHES.map((patch, i) => {
        const at = place(patch.angle, patch.length);
        return (
          <g key={patch.name} data-testid={`lm-bees-patch-${i}`}>
            <Flower x={at.x} y={at.y} fill={PATCH_FILLS[i]} />
            <text
              x={at.x}
              y={at.y + 21}
              textAnchor="middle"
              fill="#ecfccb"
              fontSize="9"
              className={pixelClass}
            >
              {i + 1}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${CENTER} ${CENTER})`}>
        <rect x="-9" y="-9" width="18" height="18" fill="#b45309" />
        <rect x="-9" y="-3" width="18" height="3" fill="#78350f" />
        <rect x="-9" y="3" width="18" height="3" fill="#78350f" />
        <rect x="-3" y="0" width="6" height="7" fill="#1c1917" />
      </g>
      {dancing ? (
        <g key={dancesSoFar(run)} className="bee-reveal-1">
          <g transform={`rotate(${angle} ${CENTER} ${CENTER})`}>
            <line
              x1={CENTER}
              y1={CENTER - 12}
              x2={CENTER}
              y2={CENTER - reach}
              stroke="#fde047"
              strokeWidth="2.5"
              strokeDasharray="5 4"
            />
            <polygon
              points={`${CENTER},${CENTER - reach - 7} ${CENTER - 6},${CENTER - reach + 3} ${CENTER + 6},${CENTER - reach + 3}`}
              fill="#fde047"
            />
            <g transform={`translate(${CENTER} ${CENTER - 20})`}>
              <g className="bee-waggle">
                <ellipse rx="6" ry="4" fill="#facc15" />
                <rect x="-2" y="-4" width="2" height="8" fill="#1c1917" />
                <rect x="2" y="-4" width="2" height="8" fill="#1c1917" />
                <rect x="-8" y="-7" width="5" height="3" fill="#e0f2fe" />
                <rect x="3" y="-7" width="5" height="3" fill="#e0f2fe" />
              </g>
            </g>
          </g>
        </g>
      ) : (
        <g className="bee-orbit">
          <g transform={`translate(${CENTER + 46} ${CENTER})`}>
            <ellipse rx="5" ry="3.4" fill="#facc15" />
            <rect x="-1.5" y="-3.4" width="2" height="6.8" fill="#1c1917" />
            <rect x="-6" y="-6" width="4" height="2.5" fill="#e0f2fe" />
          </g>
        </g>
      )}
    </svg>
  );
}

/**
 * The Bee Dance: a bee comes home and waggles a little figure of eight. Its
 * direction and length point at one of four flower patches. Follow it to the
 * patch it points at for the best pollination. A dance waits as long as it
 * takes, and nothing is ever lost.
 */
export default function BeeDance({ def, run, onAct }: PanelProps) {
  if (!isBeesOpen(run) || run.complete) return null;

  const dancing = isDancing(run);
  const hint = danceHint(run);
  const income = incomePerSecond(run);
  const resultLine = beeResultLine(run);
  const follows = followsSoFar(run);
  const earned = run.resources.beEarned ?? 0;
  const keeper = hasBeeKeeper(run);

  const headline = dancing
    ? describeDance(danceAngle(run), danceLength(run))
    : dancesSoFar(run) === 0
      ? "The bees are out looking for flowers."
      : `A bee will be home in about ${clock(secondsToDance(run))}.`;
  const hintLine = dancing
    ? "Find the patch it points at on the map, then follow it."
    : "Nothing to do right now. Enjoy the garden.";

  return (
    <section
      aria-label="Bee dances"
      data-testid="lm-bees"
      data-stage={dancing ? "dancing" : "foraging"}
      className="relative isolate space-y-3 overflow-hidden border-4 border-amber-400/80 bg-slate-950/85 p-3 shadow-[4px_4px_0_#78350f]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-[10px] text-amber-200`}>
          <span aria-hidden="true" className="mr-2 text-amber-300">
            ✿
          </span>
          Bee dances
        </h2>
        <p
          className={`${pixelClass} border-2 px-2 py-1 text-[8px] ${
            dancing
              ? "border-amber-300 bg-amber-950 text-amber-100"
              : "border-slate-600 bg-slate-900 text-slate-300"
          }`}
        >
          {dancing ? "A bee is dancing!" : "Bees out foraging"}
        </p>
      </header>

      <div className="flex items-center gap-3">
        <Compass run={run} dancing={dancing} />
        <div className="min-w-0 flex-1 space-y-2">
          <p
            data-testid="lm-bees-headline"
            className={`${pixelClass} text-xs leading-relaxed sm:text-sm ${
              dancing ? "text-amber-300" : "text-lime-50"
            }`}
          >
            {headline}
          </p>
          <p
            key={`${dancesSoFar(run)}-${dancing}`}
            className="bee-reveal-2 font-mono text-xs text-slate-300"
          >
            {hintLine}
          </p>
          {dancing && (
            <p className="bee-reveal-3 font-mono text-xs text-amber-100">
              The best patch pays about +
              {formatNumber(Math.floor(patchPays(run, hint, income)))} seeds.
            </p>
          )}
        </div>
      </div>

      <ul
        key={`${dancesSoFar(run)}-${dancing}`}
        className="bee-reveal-3 grid grid-cols-2 gap-2"
      >
        {PATCHES.map((patch, i) => {
          const id = followActionId(i);
          const isDoable = canPerformAction(def, run, id);
          const isPointed = dancing && hint === i;
          return (
            <li key={patch.name}>
              <button
                type="button"
                data-testid={`lm-bees-follow-${i}`}
                disabled={!isDoable}
                onClick={() => {
                  if (isDoable) onAct(id);
                }}
                className={`${pixelClass} flex min-h-14 w-full touch-manipulation items-center gap-2 border-4 px-2 py-2 text-left text-[9px] sm:gap-3 sm:px-3 sm:text-[10px] transition-transform disabled:cursor-not-allowed ${retroFocusClass} ${
                  dancing
                    ? "border-amber-200 bg-amber-400 text-amber-950 shadow-[4px_4px_0_#78350f] hover:bg-amber-300 active:translate-y-0.5 active:shadow-none"
                    : "border-slate-600 bg-slate-800 text-slate-400 shadow-[4px_4px_0_#0f172a]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-current text-[10px] sm:h-7 sm:w-7 sm:text-xs"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{patch.name}</span>
                  <span className="block font-mono text-[11px] font-bold normal-case">
                    {patch.blurb}
                  </span>
                </span>
                <span className="sr-only">
                  {isPointed ? "The dance points here" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {resultLine && (
        <p
          data-testid="lm-bees-result"
          className="border-2 border-emerald-400 bg-emerald-950/70 p-2 font-mono text-sm font-bold text-emerald-200"
        >
          {resultLine}
        </p>
      )}

      {keeper && (
        <p className="font-mono text-xs text-amber-100">
          The bee keeper reads any dance that waits a while: about +
          {formatNumber(Math.floor(keeperPays(run, income)))} seeds, on top of
          what you gather by hand.
        </p>
      )}

      {follows > 0 && (
        <p className="font-mono text-xs text-slate-300">
          Dances followed so far: {follows} (+{formatNumber(Math.floor(earned))}{" "}
          seeds).
        </p>
      )}
    </section>
  );
}
