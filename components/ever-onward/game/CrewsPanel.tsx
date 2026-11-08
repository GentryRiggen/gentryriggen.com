"use client";

import { memo } from "react";
import { canPerformAction } from "@/lib/ever-onward/engine/engine";
import {
  MAX_CREWS,
  POST_BUILD,
  POST_COUNT,
  POST_SCHOOL,
  POST_WATCH,
  TOWNS,
  buildingCrews,
  crewCount,
  crewPostActionId,
  isCommitted,
  isCrewsOpen,
  isWeatherOpen,
  moveFee,
  postOf,
  schoolCrews,
  travelLeft,
} from "@/lib/ever-onward/universes/light/weather";
import { short } from "@/lib/ever-onward/universes/light/preview";
import { incomePerSecond } from "@/lib/ever-onward/universes/light/tick";
import { TUNING } from "@/lib/ever-onward/universes/light/tuning";
import type { PanelProps } from "../universes/types";
import PanelFrame from "./retro/PanelFrame";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

const C = TUNING.crews;
const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** A little pixel crew member in a hard hat. */
function CrewArt({ isMoving }: { isMoving: boolean }) {
  return (
    <svg
      viewBox="0 0 8 10"
      className={`h-8 w-6 shrink-0 ${isMoving ? "opacity-60" : ""}`}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <rect x="1" y="0" width="6" height="2" fill="#facc15" />
      <rect x="2" y="2" width="4" height="2" fill="#fcd34d" />
      <rect x="1" y="4" width="6" height="3" fill="#f97316" />
      <rect x="1" y="7" width="2" height="3" fill="#1e3a8a" />
      <rect x="5" y="7" width="2" height="3" fill="#1e3a8a" />
    </svg>
  );
}

const postLabel = (post: number): string =>
  post === POST_BUILD
    ? "Build"
    : post === POST_SCHOOL
      ? "School"
      : TOWNS[post - POST_WATCH];

const postState = (post: number): string =>
  post === POST_BUILD
    ? "building"
    : post === POST_SCHOOL
      ? "at the school"
      : `watching ${TOWNS[post - POST_WATCH]} for the storm`;

/**
 * The crews: each one is building, learning at the school, or on storm
 * watch at a town. A crew on watch builds nothing, and a move to a new post
 * takes a while on the road. Nothing here says where a crew should be.
 */
function CrewsPanel({ def, run, onAct }: PanelProps) {
  if (!isCrewsOpen(run) || run.complete) return null;
  const crews = crewCount(run);
  const posts = isWeatherOpen(run) ? POST_COUNT : POST_WATCH;
  const building = buildingCrews(run);
  const learning = schoolCrews(run);

  return (
    <PanelFrame
      label="Crews"
      title="Crews"
      icon="⚒"
      tone="orange"
      status={`${crews} crews`}
      statusActive={false}
      testId="lm-crews"
      data={{ "data-crews": crews }}
    >
      <ul className="space-y-2">
        {Array.from({ length: MAX_CREWS }, (_, crew) => {
          if (crew >= crews) return null;
          const post = postOf(run, crew);
          const road = travelLeft(run, crew);
          const isMoving = road > 0;
          return (
            <li
              key={crew}
              data-testid={`lm-crew-${crew}`}
              data-post={post}
              data-moving={isMoving}
              data-committed={isCommitted(run, crew)}
              className="space-y-1.5 border-2 border-slate-600 bg-slate-900/80 p-2"
            >
              <p className="flex items-center gap-2 font-mono text-sm font-bold text-slate-100">
                <CrewArt isMoving={isMoving} />
                <span>
                  Crew {crew + 1}:{" "}
                  {isMoving
                    ? `on the road, ${Math.ceil(road)} s`
                    : postState(post)}
                  {isCommitted(run, crew) && " until the storm lands"}
                </span>
              </p>
              <div
                role="group"
                aria-label={`Where crew ${crew + 1} works`}
                className={`grid gap-1.5 ${
                  posts > POST_WATCH
                    ? "grid-cols-2 sm:grid-cols-5"
                    : "grid-cols-2"
                }`}
              >
                {Array.from({ length: posts }, (_, p) => {
                  const here = post === p;
                  const id = crewPostActionId(crew, p);
                  const isDoable = canPerformAction(def, run, id);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={here}
                      data-testid={`lm-crew-${crew}-post-${p}`}
                      aria-disabled={!here && !isDoable}
                      onClick={() => {
                        if (!here && isDoable) onAct(id);
                      }}
                      className={`${pixelClass} min-h-11 touch-manipulation border-2 px-1 py-2 text-[10px] ${retroFocusClass} ${
                        here
                          ? "border-orange-200 bg-orange-400 text-orange-950"
                          : "border-slate-500 bg-slate-800 text-slate-100 hover:bg-slate-700 active:translate-y-0.5"
                      }`}
                    >
                      {postLabel(p)}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="font-mono text-xs text-slate-300">
        Building: each crew adds {pct(C.buildBoost)} to what the cities pay (
        {building} {building === 1 ? "crew" : "crews"} now). School: each crew
        adds {pct(C.schoolBoost)} to the know-how ({learning} now).
        {isWeatherOpen(run)
          ? " On watch: a crew at the town the storm hits earns a bonus and keeps its lights on, but builds nothing."
          : ""}{" "}
        A crew sent to watch a town once the forecast is up stays there until
        the storm lands. A move takes {TUNING.grid.moveSeconds} seconds on the
        road, and the crew does no work until it arrives. Going out on storm
        watch costs about {short(moveFee(incomePerSecond(run)))} power in
        sandbags and wages; coming home is free.
      </p>
    </PanelFrame>
  );
}

export default memo(CrewsPanel);
