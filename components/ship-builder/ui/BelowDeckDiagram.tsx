"use client";

import { useId, type KeyboardEvent } from "react";
import { bulkheadAt } from "@/lib/ship-builder/model/bulkheads";
import { CELLS_PER_SEGMENT } from "@/lib/ship-builder/model/grid";
import type { BulkheadHeight, Hull } from "@/lib/ship-builder/model/types";
import {
  BULKHEAD_FRACTION,
  compartmentSpecsOf,
} from "@/lib/ship-builder/sim/compartments";

/** Drawing units per hull segment, and the hull's depth in the same units. */
const SEGMENT_WIDTH = 24;
const HULL_DEPTH = 64;
const DECK_Y = 8;
const KEEL_Y = DECK_Y + HULL_DEPTH;
const VIEW_HEIGHT = KEEL_Y + 8;
/** The waterline sits this far up the hull's depth. */
const WATERLINE_FRACTION = 0.6;

const HEIGHT_WORDS: Record<BulkheadHeight | "none", string> = {
  none: "none",
  low: "low",
  waterline: "up to the waterline",
  deck: "up to the deck",
};

/** Y for a level that is `fraction` of the way up the hull from the keel. */
function levelY(fraction: number): number {
  return KEEL_Y - fraction * HULL_DEPTH;
}

export interface BelowDeckDiagramProps {
  hull: Hull;
  /** Water per compartment id (0..1), for the trial inset. */
  water?: Record<string, number>;
  /** Opened compartment ids, drawn with a gash mark. */
  opened?: readonly string[];
  /** Given: wall slots are buttons that call this with the boundary. */
  onCycle?: (at: number) => void;
  className?: string;
}

function slotLabel(hull: Hull, at: number): string {
  const wall = bulkheadAt(hull, at);
  return `Wall ${at}: ${HEIGHT_WORDS[wall?.height ?? "none"]}. Tap to change.`;
}

function summaryLabel(hull: Hull): string {
  const walls = hull.bulkheads?.length ?? 0;
  const rooms = walls + 1;
  return `Below deck: ${rooms} watertight ${rooms === 1 ? "room" : "rooms"} with ${walls} ${walls === 1 ? "wall" : "walls"}`;
}

/**
 * A side cut-away of the hull (bow on the left) showing its watertight walls,
 * and optionally the water in each compartment and the ones the iceberg
 * opened. Editable when `onCycle` is given, otherwise a read-only picture.
 */
export default function BelowDeckDiagram({
  hull,
  water,
  opened,
  onCycle,
  className = "",
}: BelowDeckDiagramProps) {
  const clipId = useId();
  const width = hull.lengthSegments * SEGMENT_WIDTH;
  const specs = compartmentSpecsOf(hull);
  const slots = Array.from(
    { length: hull.lengthSegments - 1 },
    (_, i) => i + 1
  );
  const waterlineY = levelY(WATERLINE_FRACTION);
  const hullPath = `M0 ${DECK_Y} H${width} L${width - SEGMENT_WIDTH * 0.6} ${KEEL_Y} H${SEGMENT_WIDTH * 0.9} Z`;
  const xOf = (cell: number) => (cell / CELLS_PER_SEGMENT) * SEGMENT_WIDTH;

  const handleKeyDown = (event: KeyboardEvent, at: number) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onCycle?.(at);
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${VIEW_HEIGHT}`}
      role={onCycle ? "group" : "img"}
      aria-label={onCycle ? "Below deck walls" : summaryLabel(hull)}
      className={`block w-full ${onCycle ? "min-w-[28rem]" : ""} ${className}`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={hullPath} />
        </clipPath>
      </defs>

      <path
        d={hullPath}
        data-testid="below-deck-hull"
        className="fill-slate-100 stroke-slate-500 dark:fill-slate-800 dark:stroke-slate-400"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      <g clipPath={`url(#${clipId})`}>
        {specs.map((spec) => {
          const level = water?.[spec.id] ?? 0;
          if (level <= 0) return null;
          const top = levelY(Math.min(level, 1));
          return (
            <rect
              key={spec.id}
              data-testid={`below-deck-water-${spec.id}`}
              x={xOf(spec.fromX)}
              y={top}
              width={xOf(spec.toX) - xOf(spec.fromX)}
              height={KEEL_Y - top}
              className="fill-sky-500/70 dark:fill-sky-400/70"
            />
          );
        })}
      </g>

      <line
        x1={0}
        x2={width}
        y1={waterlineY}
        y2={waterlineY}
        strokeDasharray="4 3"
        strokeWidth={1}
        className="stroke-sky-600 dark:stroke-sky-300"
      />
      <line
        x1={0}
        x2={width}
        y1={DECK_Y}
        y2={DECK_Y}
        strokeWidth={2.5}
        className="stroke-slate-700 dark:stroke-slate-200"
      />

      {slots.map((at) => {
        const wall = bulkheadAt(hull, at);
        const x = at * SEGMENT_WIDTH;
        return wall ? (
          <line
            key={at}
            data-testid={`below-deck-wall-${at}`}
            x1={x}
            x2={x}
            y1={KEEL_Y}
            y2={levelY(BULKHEAD_FRACTION[wall.height])}
            strokeWidth={3}
            strokeLinecap="round"
            className="stroke-slate-700 dark:stroke-slate-200"
          />
        ) : (
          <line
            key={at}
            x1={x}
            x2={x}
            y1={KEEL_Y}
            y2={DECK_Y}
            strokeDasharray="2 3"
            strokeWidth={1}
            className="stroke-slate-300 dark:stroke-slate-600"
          />
        );
      })}

      {specs
        .filter((spec) => opened?.includes(spec.id))
        .map((spec) => {
          const cx = (xOf(spec.fromX) + xOf(spec.toX)) / 2;
          return (
            <polyline
              key={spec.id}
              data-testid={`below-deck-gash-${spec.id}`}
              points={`${cx - 6},${KEEL_Y - 22} ${cx - 2},${KEEL_Y - 14} ${cx - 6},${KEEL_Y - 8} ${cx + 1},${KEEL_Y - 2} ${cx + 6},${KEEL_Y - 10}`}
              fill="none"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-red-600 dark:stroke-red-400"
            />
          );
        })}

      {onCycle &&
        slots.map((at) => (
          <g
            key={at}
            role="button"
            tabIndex={0}
            aria-label={slotLabel(hull, at)}
            data-testid={`below-deck-slot-${at}`}
            onClick={() => onCycle(at)}
            onKeyDown={(event) => handleKeyDown(event, at)}
            className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-sky-500 [&:focus-visible>rect]:stroke-2"
          >
            <rect
              x={at * SEGMENT_WIDTH - SEGMENT_WIDTH / 2}
              y={0}
              width={SEGMENT_WIDTH}
              height={VIEW_HEIGHT}
              fill="transparent"
            />
          </g>
        ))}
    </svg>
  );
}
