"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  formatStoryTime,
  storyMinutesSinceImpact,
} from "@/lib/ship-builder/sim/story";
import {
  firstEvent,
  timelineEnd,
  timelineStart,
  type Timeline,
} from "@/lib/ship-builder/sim/timeline";
import type { SimEvent } from "@/lib/ship-builder/sim/types";
import { trialPlayback, writeTimelinePlayback } from "../scene/trialPlayback";
import { TIMELINE_MARKS } from "./seaTrialText";

interface TrialScrubberProps {
  timeline: Timeline;
}

interface Mark {
  kind: SimEvent["kind"];
  label: string;
  at: number;
}

/** A colour per mark, readable on the light and the dark card. */
const MARK_COLORS: Partial<
  Record<SimEvent["kind"], { dot: string; tick: string }>
> = {
  flooding: {
    dot: "bg-sky-500 dark:bg-sky-400",
    tick: "fill-sky-500 dark:fill-sky-400",
  },
  "power-flicker": {
    dot: "bg-amber-500 dark:bg-amber-400",
    tick: "fill-amber-500 dark:fill-amber-400",
  },
  "power-out": {
    dot: "bg-slate-700 dark:bg-slate-300",
    tick: "fill-slate-700 dark:fill-slate-300",
  },
  broke: {
    dot: "bg-rose-600 dark:bg-rose-400",
    tick: "fill-rose-600 dark:fill-rose-400",
  },
  sunk: {
    dot: "bg-indigo-600 dark:bg-indigo-400",
    tick: "fill-indigo-600 dark:fill-indigo-400",
  },
  "touched-bottom": {
    dot: "bg-emerald-600 dark:bg-emerald-400",
    tick: "fill-emerald-600 dark:fill-emerald-400",
  },
};

const FALLBACK_COLOR = {
  dot: "bg-slate-500",
  tick: "fill-slate-500",
};

function marksOf(timeline: Timeline): Mark[] {
  return TIMELINE_MARKS.flatMap(({ kind, label }) => {
    const event = firstEvent(timeline, kind);
    return event ? [{ kind, label, at: event.at }] : [];
  }).sort((a, b) => a.at - b.at);
}

/** Marks closer than this share of the track would overlap as dots. */
const CLOSE_MARK_FRACTION = 0.06;
const MARK_LANE_OFFSET_PX = 7;
const MAX_MARK_LANES = 3;

/**
 * The row each mark's dot sits in: 0 on the track, then stacked upward while
 * the marks before it are too close to sit side by side. Marks must be sorted
 * by time.
 */
export function markLanes(marks: readonly Mark[], span: number): number[] {
  const lanes: number[] = [];
  marks.forEach((mark, index) => {
    const previous = marks[index - 1];
    const isClose =
      previous !== undefined &&
      (mark.at - previous.at) / span < CLOSE_MARK_FRACTION;
    lanes.push(isClose ? (lanes[index - 1] + 1) % MAX_MARK_LANES : 0);
  });
  return lanes;
}

/** "40 minutes after the iceberg · Lights out" for screen readers. */
function describeMoment(time: number, marks: readonly Mark[]): string {
  const clock = `${formatStoryTime(storyMinutesSinceImpact(time))} after the iceberg`;
  const latest = marks.filter((mark) => mark.at <= time).at(-1);
  return latest ? `${clock} · ${latest.label}` : clock;
}

/**
 * Drags back and forth through an iceberg trial on its result screen. The ship
 * jumps to each moment (the scene sees `trialPlayback.scrubbing` and keeps
 * quiet) and stays there on release: `trialPlayback.scrubbed` freezes the
 * effects clock until a replay. Marks that fall close together stack upward
 * so their dots do not hide each other. Tick marks show the big moments; Page Up
 * and Page Down jump between them.
 */
export default function TrialScrubber({ timeline }: TrialScrubberProps) {
  const inputId = useId();
  const start = timelineStart(timeline);
  const end = timelineEnd(timeline);
  const span = Math.max(end - start, Number.EPSILON);
  const marks = useMemo(() => marksOf(timeline), [timeline]);
  const lanes = useMemo(() => markLanes(marks, span), [marks, span]);
  // The result shows the ship where the trial ended.
  const [time, setTime] = useState(end);

  // Never leave the scene thinking a drag is still going on.
  useEffect(
    () => () => {
      trialPlayback.scrubbing = false;
      trialPlayback.scrubbed = false;
    },
    []
  );

  function showMoment(next: number) {
    const clamped = Math.min(end, Math.max(start, next));
    trialPlayback.scrubbing = true;
    trialPlayback.scrubbed = true;
    writeTimelinePlayback(timeline, clamped);
    setTime(clamped);
  }

  function handleRelease() {
    trialPlayback.scrubbing = false;
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "PageUp" && event.key !== "PageDown") return;
    event.preventDefault();
    const target =
      event.key === "PageUp"
        ? (marks.find((mark) => mark.at > time + 1e-6)?.at ?? end)
        : (marks.filter((mark) => mark.at < time - 1e-6).at(-1)?.at ?? start);
    showMoment(target);
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
        Look back
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="range"
          min={start}
          max={end}
          step="any"
          value={time}
          aria-valuetext={describeMoment(time, marks)}
          onChange={(event) => showMoment(Number(event.target.value))}
          onKeyDown={handleKeyDown}
          onKeyUp={handleRelease}
          onPointerUp={handleRelease}
          onPointerCancel={handleRelease}
          onBlur={handleRelease}
          className="h-11 w-full cursor-pointer touch-manipulation accent-sky-600 dark:accent-sky-400"
        />
        {/* Inset by about half the thumb so marks line up with its centre. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0.5 left-2 h-2 w-[calc(100%-1rem)] overflow-visible"
        >
          {marks.map((mark, index) => (
            <circle
              key={mark.kind}
              data-testid={`scrubber-mark-${mark.kind}`}
              cx={`${((mark.at - start) / span) * 100}%`}
              cy="50%"
              r="3"
              transform={`translate(0 ${-lanes[index] * MARK_LANE_OFFSET_PX})`}
              className={(MARK_COLORS[mark.kind] ?? FALLBACK_COLOR).tick}
            />
          ))}
        </svg>
      </div>
      {marks.length > 0 && (
        <ul
          aria-hidden="true"
          className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400"
        >
          {marks.map((mark) => (
            <li key={mark.kind} className="inline-flex items-center gap-1">
              <span
                className={`h-1.5 w-1.5 rounded-full ${(MARK_COLORS[mark.kind] ?? FALLBACK_COLOR).dot}`}
              />
              {mark.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
