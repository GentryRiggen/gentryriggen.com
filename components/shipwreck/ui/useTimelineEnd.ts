"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { storyEndT } from "@/lib/shipwreck/story";

/** Before the run is done the timeline spans 3 hours (or what is computed). */
export const PROVISIONAL_END_S = 3 * 3600;

/** How often values that move every frame while computing re-render (ms). */
export const THROTTLE_MS = 250;

/** The shown time at the right end of the timeline. */
export function timelineEnd(
  s: Parameters<typeof storyEndT>[0],
  done: boolean,
  computedT: number
): number {
  const end = storyEndT(s, done);
  if (end !== null) return Math.max(1, end);
  return Math.max(PROVISIONAL_END_S, computedT);
}

/**
 * A store value that re-renders at most every `ms` (4 Hz by default): for
 * things the runner moves every frame while it computes.
 */
export function useThrottledStore<T>(
  store: PlaybackStore,
  select: (s: ReturnType<PlaybackStore["getState"]>) => T,
  ms: number = THROTTLE_MS
): T {
  const [value, setValue] = useState(() => select(store.getState()));
  const selectRef = useRef(select);
  useEffect(() => {
    selectRef.current = select;
  });
  useEffect(() => {
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      last = Date.now();
      setValue(selectRef.current(store.getState()));
    };
    // Catch anything that changed between the first render and now.
    timer = setTimeout(flush, 0);
    const unsubscribe = store.subscribe(() => {
      if (timer !== null) return;
      const wait = ms - (Date.now() - last);
      if (wait <= 0) flush();
      else timer = setTimeout(flush, wait);
    });
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [store, ms]);
  return value;
}

export function useTimelineEnd(store: PlaybackStore): number {
  return useThrottledStore(store, (s) =>
    timelineEnd(s.track, s.done, s.computedT)
  );
}

/** True once the story has reached its end (the end card shows). */
export function useAtStoryEnd(store: PlaybackStore): boolean {
  return useStore(store, (s) => {
    const end = storyEndT(s.track, s.done);
    return end !== null && s.t >= end - 0.05;
  });
}
