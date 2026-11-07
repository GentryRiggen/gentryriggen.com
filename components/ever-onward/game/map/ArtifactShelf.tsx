"use client";

import { hasKeepsake, mapOf } from "@/lib/ever-onward/engine/map";
import type { UniverseDef, UniverseSave } from "@/lib/ever-onward/engine/types";
import Glyph from "./Glyph";
import { pixelClass, retroFocusClass } from "../retro/retroStyles";

interface ArtifactShelfProps {
  def: UniverseDef;
  universe: UniverseSave;
  onToggle: (id: string) => void;
}

/** Everything found on the map, what it does, and the On/Off switch for catches. */
export default function ArtifactShelf({
  def,
  universe,
  onToggle,
}: ArtifactShelfProps) {
  const map = def.map!;
  const state = mapOf(def, universe);
  const found = state.found
    .map((id) => map.artifacts.find((a) => a.id === id))
    .filter((a) => a !== undefined);
  const hasOld = hasKeepsake(universe);

  return (
    <section
      aria-labelledby="eo-shelf-title"
      data-testid="eo-map-shelf"
      className="space-y-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3
          id="eo-shelf-title"
          className={`${pixelClass} text-[10px] text-amber-200`}
        >
          Found
        </h3>
        <p className="font-mono text-xs text-slate-300">
          {found.length} of {map.artifacts.length}
        </p>
      </div>
      {found.length === 0 && !hasOld && (
        <p className="font-mono text-sm text-slate-300">
          Nothing yet. Strange things float on the chart. Finish a run on one to
          find out what it is.
        </p>
      )}
      <ul className="space-y-2">
        {hasOld && (
          <li className="flex gap-3 border-2 border-slate-700 bg-slate-900/80 p-2">
            <Glyph
              glyph={map.keepsake.glyph}
              palette={map.keepsake.palette}
              className="h-10 w-10 shrink-0"
            />
            <div className="min-w-0 space-y-1">
              <p className={`${pixelClass} text-[10px] text-orange-200`}>
                {map.keepsake.name}
              </p>
              <p className="font-mono text-xs text-slate-200">
                The permanent upgrades you bought before the chart still work in
                every run.
              </p>
            </div>
          </li>
        )}
        {found.map((a) => {
          const isOff = state.off.includes(a.id);
          return (
            <li
              key={a.id}
              data-testid={`eo-shelf-${a.id}`}
              className={`flex gap-3 border-2 p-2 ${
                a.tier === "big"
                  ? "border-amber-400/70 bg-amber-950/30"
                  : "border-slate-700 bg-slate-900/80"
              } ${isOff ? "opacity-60" : ""}`}
            >
              <Glyph
                glyph={a.glyph}
                palette={a.palette}
                className="h-10 w-10 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className={`${pixelClass} text-[10px] text-amber-100`}>
                  {a.name}
                </p>
                <p className="font-mono text-xs text-slate-200">{a.effect}</p>
                {a.catch && (
                  <p className="font-mono text-xs text-rose-300">
                    Catch: {a.catch}
                  </p>
                )}
                {a.catch && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      aria-pressed={!isOff}
                      data-testid={`eo-shelf-toggle-${a.id}`}
                      onClick={() => onToggle(a.id)}
                      className={`min-h-11 min-w-16 touch-manipulation border-2 px-2 font-mono text-xs ${retroFocusClass} ${
                        isOff
                          ? "border-slate-600 bg-slate-900 text-slate-300"
                          : "border-emerald-400 bg-emerald-950/60 text-emerald-100"
                      }`}
                    >
                      {isOff ? "Off" : "On"}
                    </button>
                    <span className="font-mono text-xs text-slate-400">
                      Changes apply from your next run.
                    </span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
