"use client";

import { useState } from "react";
import { useStore } from "zustand";
import { trackCamera } from "@/lib/shipwreck/analytics";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { walkMapFor } from "@/lib/shipwreck/walk";
import Icon from "./Icon";
import { FOCUS } from "./styles";

/** Remembers that the Walk button has been tapped (it stops glowing). */
export const WALK_SEEN_KEY = "shipwreck:walk-seen";

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(WALK_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen() {
  try {
    window.localStorage.setItem(WALK_SEEN_KEY, "1");
  } catch {
    /* private mode: it glows again next time */
  }
}

interface WalkButtonProps {
  store: PlaybackStore;
}

/**
 * The big round Walk button at the top of the right rail: one tap puts you
 * on her boat deck. It glows until the first tap, and is only there for a
 * ship you can walk on, and not while walking (Fly takes you back).
 */
export default function WalkButton({ store }: WalkButtonProps) {
  const ship = useStore(store, (s) => s.ship);
  const walking = useStore(store, (s) => s.camera === "walk");
  // Disabled until the night has a frame to stand on.
  const hasFrame = useStore(
    store,
    (s) => s.track !== null && s.track.frames.length > 0
  );
  const [seen, setSeen] = useState(readSeen);
  if (!walkMapFor(ship) || walking) return null;

  const onWalk = () => {
    const s = store.getState();
    if (s.place) s.flyToPlace(null, false);
    s.setXray(false);
    store.getState().startWalk();
    // Counted only when the walk really started.
    if (store.getState().camera !== "walk") return;
    trackCamera("walk");
    if (!seen) {
      writeSeen();
      setSeen(true);
    }
  };

  return (
    <div className="relative grid size-20 place-items-center self-end">
      {!seen && hasFrame && (
        <span
          aria-hidden="true"
          data-testid="shipwreck-walk-glow"
          className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-amber-300/50 motion-reduce:animate-pulse"
        />
      )}
      <button
        type="button"
        aria-label="Walk on the deck"
        data-testid="shipwreck-walk"
        data-walk-control
        disabled={!hasFrame}
        onClick={onWalk}
        className={`pointer-events-auto relative grid size-20 shrink-0 touch-manipulation place-items-center rounded-full border-2 border-amber-100 bg-amber-400 text-slate-950 shadow-lg shadow-black/50 active:scale-95 disabled:opacity-40 dark:border-amber-100 dark:bg-amber-400 dark:text-slate-950 ${FOCUS}`}
      >
        <Icon name="walk" className="size-11" />
      </button>
    </div>
  );
}
