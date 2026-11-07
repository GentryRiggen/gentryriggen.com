"use client";

import {
  artifactAt,
  lastSquare,
  squareKey,
} from "@/lib/ever-onward/engine/map";
import type {
  MapState,
  SquareKey,
  UniverseDef,
} from "@/lib/ever-onward/engine/types";
import Glyph from "./Glyph";
import { retroFocusClass } from "../retro/retroStyles";

interface MapGridProps {
  def: UniverseDef;
  state: MapState;
  selected: SquareKey;
  /** Squares the next run may be played on (choose mode); empty otherwise. */
  choosable: readonly SquareKey[];
  onSelect: (key: SquareKey) => void;
}

/** What a square is called to assistive tech; never names an unfound artifact. */
export function squareLabel(
  def: UniverseDef,
  state: MapState,
  key: SquareKey,
  isChoosable: boolean
): string {
  const [x, y] = key.split(",").map(Number);
  const parts = [`Column ${x + 1}, row ${y + 1}`];
  if (key === state.at) parts.push("you are here");
  if (state.visited.includes(key)) parts.push("visited");
  const artifact = artifactAt(def, key);
  if (artifact)
    parts.push(
      state.found.includes(artifact.id)
        ? `found: ${artifact.name}`
        : "something strange is here"
    );
  if (def.map && key === lastSquare(def.map)) parts.push("the last square");
  if (isChoosable) parts.push("you can go here");
  return parts.join(", ");
}

const HATCH =
  "bg-[repeating-linear-gradient(135deg,rgba(148,163,184,0.28)_0_2px,transparent_2px_7px)]";

/**
 * The chart: an 8 x 8 grid on a starry night sea. Visited squares are
 * hatched, the current square pulses, strange glyphs float where artifacts
 * wait, and choosable squares glow amber.
 */
export default function MapGrid({
  def,
  state,
  selected,
  choosable,
  onSelect,
}: MapGridProps) {
  const map = def.map!;
  const last = lastSquare(map);
  const keys: SquareKey[] = [];
  for (let y = 0; y < map.rows; y += 1)
    for (let x = 0; x < map.cols; x += 1) keys.push(squareKey(x, y));

  return (
    <div
      role="grid"
      aria-label={map.title}
      data-testid="eo-map-grid"
      className="eo-map-sea grid w-full grid-cols-8 border-2 border-cyan-800/80 bg-[#060b1f]"
    >
      {keys.map((key) => {
        const artifact = artifactAt(def, key);
        const isFound = !!artifact && state.found.includes(artifact.id);
        const isHere = key === state.at;
        const isVisited = state.visited.includes(key);
        const isChoosable = choosable.includes(key);
        const isSelected = key === selected;
        return (
          <button
            key={key}
            type="button"
            role="gridcell"
            data-testid={`eo-map-square-${key}`}
            data-choosable={isChoosable || undefined}
            aria-selected={isSelected}
            aria-label={squareLabel(def, state, key, isChoosable)}
            onClick={() => onSelect(key)}
            className={`relative flex aspect-square touch-manipulation items-center justify-center border border-cyan-900/40 ${retroFocusClass} ${
              isVisited ? HATCH : ""
            } ${isChoosable ? "eo-map-choosable bg-amber-400/15" : ""} ${
              isSelected ? "outline-2 -outline-offset-2 outline-cyan-200" : ""
            }`}
          >
            {artifact && !isFound && (
              <Glyph
                glyph={artifact.glyph}
                palette={artifact.palette}
                className="eo-map-float h-3/5 w-3/5 drop-shadow-[0_0_4px_rgba(186,230,253,0.7)]"
              />
            )}
            {artifact && isFound && (
              <Glyph
                glyph={artifact.glyph}
                palette={artifact.palette}
                className="h-2/5 w-2/5 opacity-45 grayscale"
              />
            )}
            {key === last && !artifact && (
              <span
                aria-hidden="true"
                className="eo-map-beacon h-2/5 w-2/5 rotate-45 border-2 border-amber-300 bg-amber-500/40"
              />
            )}
            {isHere && (
              <span
                aria-hidden="true"
                data-testid="eo-map-here"
                className="eo-map-here pointer-events-none absolute inset-1 border-2 border-cyan-200"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
