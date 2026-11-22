"use client";

import { useEffect, useState } from "react";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { getShip } from "@/lib/shipwreck/ships";
import { eventsBetween } from "@/lib/shipwreck/sim/track";
import {
  captionContext,
  captionFor,
  clockText,
  runInCaption,
} from "@/lib/shipwreck/story";

/** How long a caption stays (wall ms). */
export const CAPTION_MS = 6500;
/** A seek captions only events this recent (shown s). */
export const CAPTION_RECENT_S = 90;

interface CaptionsProps {
  store: PlaybackStore;
}

/**
 * A calm line for each event as playback passes it, with the clock time
 * from the sim. Starts with the collision when mounted at the start of a
 * run (never a stale one later in the night), or with the torpedo's run-in
 * when the run starts before the hit; hides itself after a few seconds.
 */
export default function Captions({ store }: CaptionsProps) {
  const [text, setText] = useState<string | null>(() => {
    const s = store.getState();
    const ship = getShip(s.ship);
    if (s.t < 0) {
      // The torpedo's run-in (the collision's caption comes at the hit).
      const run = runInCaption(ship);
      return run ? `${clockText(s.t, ship.clockStartS)} — ${run}` : null;
    }
    return s.t < CAPTION_RECENT_S
      ? captionFor({ kind: "collision", t: 0, realT: 0 }, ship)
      : null;
  });

  useEffect(() => {
    return store.subscribe((s, prev) => {
      // Back before the hit (a new run, a replay, a scrub): the run-in.
      if (s.t < 0 && !(prev.t < 0)) {
        const ship = getShip(s.ship);
        const run = runInCaption(ship);
        if (run) setText(`${clockText(s.t, ship.clockStartS)} — ${run}`);
        return;
      }
      if (!s.track || !(s.t > prev.t)) return;
      const evs = eventsBetween(s.track, prev.t, s.t);
      for (let i = evs.length - 1; i >= 0; i -= 1) {
        // After a long seek, only what just happened.
        if (s.t - evs[i].t > CAPTION_RECENT_S) break;
        const c = captionFor(
          evs[i],
          getShip(s.ship),
          captionContext(s.track, evs[i].t)
        );
        if (c) {
          setText(c);
          return;
        }
      }
    });
  }, [store]);

  useEffect(() => {
    if (!text) return;
    const id = setTimeout(() => setText(null), CAPTION_MS);
    return () => clearTimeout(id);
  }, [text]);

  return (
    <div className="pointer-events-none relative z-10 h-0" aria-live="polite">
      {text && (
        <p
          data-testid="shipwreck-caption"
          className="absolute left-1/2 top-2 w-[min(28rem,calc(100%-10rem))] -translate-x-1/2 rounded-2xl bg-slate-950/75 px-4 py-2 text-center text-base font-semibold text-slate-50 shadow-lg backdrop-blur-md sm:text-lg"
        >
          {text}
        </p>
      )}
    </div>
  );
}
