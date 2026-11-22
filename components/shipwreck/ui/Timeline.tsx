"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useStore } from "zustand";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { getShip } from "@/lib/shipwreck/ships";
import {
  clockText,
  MARK_PRIORITY,
  markRows,
  storyOf,
  timelineMarks,
  type MarkKind,
} from "@/lib/shipwreck/story";
import Icon, { type IconName } from "./Icon";
import { FOCUS } from "./styles";
import { useThrottledStore, useTimelineEnd } from "./useTimelineEnd";

/** An event icon's width plus a small gap (px), for the row packing. */
const MARK_SPAN_PX = 50;

const MARK_ICON: Record<MarkKind, IconName> = {
  iceberg: "iceberg",
  rocket: "rocket",
  boat: "boat",
  lights: "lights",
  break: "break",
  sinks: "sinks",
  afloat: "afloat",
  hatch: "hatch",
  shelter: "afloat",
};

interface TimelineProps {
  store: PlaybackStore;
}

/**
 * The night from 11:40 PM (the afternoon from 2:10 PM, the storm from 3:30 PM) to the end: the computed part lit, the rest dim,
 * event icons above (tap to jump), drag anywhere to seek (within computed).
 */
export default function Timeline({ store }: TimelineProps) {
  const end = useTimelineEnd(store);
  // A torpedo's run-in starts before the hit (negative time): the bar runs
  // from there.
  const start = useStore(store, (s) => s.minT);
  const span = Math.max(1, end - start);
  const ship = getShip(useStore(store, (s) => s.ship));
  // The runner stores a new track object every frame while it computes:
  // follow only the number of events (and a new run), not the object.
  const events = useStore(store, (s) => s.track?.events.length ?? -1);
  const runStart = useStore(store, (s) => s.track?.frames[0] ?? null);
  // Re-render on about a pixel of movement, not every frame.
  const tPermille = useStore(store, (s) =>
    Math.round(((s.t - s.minT) / Math.max(1, end - s.minT)) * 1000)
  );
  const computedPermille = useThrottledStore(store, (s) =>
    Math.round(((s.computedT - s.minT) / Math.max(1, end - s.minT)) * 1000)
  );
  const realMinute = useStore(store, (s) => Math.floor(s.realT / 60));
  // Walking or swimming: no event marks (they sit under Look under and
  // Back on deck, an easy mis-tap); play, speeds and the bar stay.
  const walking = useStore(store, (s) => s.walk.phase !== "off");
  const barRef = useRef<HTMLDivElement>(null);
  const [barPx, setBarPx] = useState(320);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setBarPx(bar.clientWidth || 320));
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  const marks = useMemo(
    () => timelineMarks(store.getState().track, ship),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- marks change only when events are added or a new run starts
    [store, events, runStart, ship]
  );
  // Only what happens within the story (a ship that floats still has
  // boats and rockets after her story ends): none pile up at the right end.
  const shown = marks.filter((m) => m.t <= end + 1);
  const fractions = shown.map((m) =>
    Math.min(1, Math.max(0, (m.t - start) / span))
  );
  const rows = markRows(
    fractions,
    MARK_SPAN_PX / Math.max(1, barPx),
    shown.map((m) => MARK_PRIORITY[m.kind])
  );

  const seekTo = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return;
    const r = bar.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    store.getState().seek(start + f * span);
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    seekTo(e.clientX);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0 && e.pointerType === "mouse") return;
    if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
    seekTo(e.clientX);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const s = store.getState();
    if (e.key === "ArrowRight") s.seek(s.t + 60);
    else if (e.key === "ArrowLeft") s.seek(s.t - 60);
    else return;
    e.preventDefault();
  };

  const tPct = Math.min(100, tPermille / 10);
  const cPct = Math.min(100, computedPermille / 10);

  return (
    // Room above for two rows of event icons (the second row on a phone
    // would otherwise sit on the speed buttons).
    // The wrapper lets drags through to the 3D view; only the icons and the
    // bar take touches.
    <div className="pointer-events-none relative mt-12 min-w-0 flex-1 pt-12 sm:mt-0">
      {shown.map((m, i) =>
        walking || rows[i] < 0 ? null : (
          <button
            key={m.kind}
            type="button"
            aria-label={`Jump to: ${m.label}`}
            title={m.label}
            data-testid={`shipwreck-mark-${m.kind}`}
            onClick={() => store.getState().seek(m.t)}
            className={`pointer-events-auto absolute grid size-11 -translate-x-1/2 touch-manipulation place-items-center rounded-full border border-amber-200/60 bg-slate-900/90 text-amber-200 shadow ${FOCUS}`}
            // Per-event position along the bar: a computed value, not a style.
            style={{
              // Kept a half icon in from each end, so none hangs off screen.
              left: `clamp(1.375rem, ${fractions[i] * 100}%, calc(100% - 1.375rem))`,
              top: rows[i] === 0 ? 0 : -48,
            }}
          >
            <Icon name={MARK_ICON[m.kind]} className="size-6" />
          </button>
        )
      )}
      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label={`Time in the ${storyOf(ship).period}`}
        aria-valuemin={Math.round(start)}
        aria-valuemax={Math.round(end)}
        aria-valuenow={Math.round(start + (tPermille / 1000) * span)}
        aria-valuetext={clockText(realMinute * 60, ship.clockStartS)}
        data-testid="shipwreck-timeline"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onKeyDown={onKey}
        className={`pointer-events-auto relative h-11 touch-none rounded-full ${FOCUS}`}
      >
        <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/10">
          <div
            data-testid="shipwreck-computed"
            className="absolute inset-y-0 left-0 bg-sky-200/35"
            style={{ width: `${cPct}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-sky-400"
            style={{ width: `${tPct}%` }}
          />
        </div>
        <div
          className="absolute top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 shadow-lg"
          style={{ left: `${tPct}%` }}
        />
      </div>
    </div>
  );
}
