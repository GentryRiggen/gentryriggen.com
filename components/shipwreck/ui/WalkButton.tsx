"use client";

import { useState } from "react";
import { useStore } from "zustand";
import { trackCamera } from "@/lib/shipwreck/analytics";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { walkMapFor } from "@/lib/shipwreck/walk";
import Icon from "./Icon";
import { FOCUS } from "./styles";

/**
 * Remembers that the Walk button has been tapped (it stops glowing): 1.15's
 * own key, still read so a player who walked then is not asked again, and
 * still written alongside the save's `seen.walked` (1.16), which owns it.
 */
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

/**
 * Starts a walk, as the Walk button and the camera picker's "Walk the deck"
 * both do: leaves a place and X-ray, then walks. Counted (and the button
 * stops glowing) only when the walk really started; returns whether it did.
 */
export function beginWalk(store: PlaybackStore): boolean {
  const s = store.getState();
  if (s.place) s.flyToPlace(null, false);
  s.setXray(false);
  store.getState().startWalk();
  if (store.getState().camera !== "walk") return false;
  trackCamera("walk");
  writeSeen();
  return true;
}

interface WalkButtonProps {
  store: PlaybackStore;
  /** The save says they have walked (it does not pulse). */
  walked?: boolean;
  /** A walk started from here (the save remembers it). */
  onWalked?: () => void;
}

/**
 * The big round Walk button at the top of the right rail: one tap puts you
 * on her boat deck. It pulses until the player has walked once (here, from
 * the camera picker or into a room), and is only there for a ship you can
 * walk on, and not while walking (Fly takes you back).
 */
export default function WalkButton({
  store,
  walked = false,
  onWalked,
}: WalkButtonProps) {
  const ship = useStore(store, (s) => s.ship);
  const walking = useStore(store, (s) => s.camera === "walk");
  // Disabled until the night has a frame to stand on.
  const hasFrame = useStore(
    store,
    (s) => s.track !== null && s.track.frames.length > 0
  );
  const [tapped, setTapped] = useState(readSeen);
  const seen = walked || tapped;
  if (!walkMapFor(ship) || walking) return null;

  const onWalk = () => {
    if (!beginWalk(store)) return;
    setTapped(true);
    onWalked?.();
  };

  return (
    <div className="relative grid size-20 place-items-center self-end">
      {!seen && hasFrame && (
        <span
          aria-hidden="true"
          data-testid="shipwreck-walk-glow"
          className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-amber-300/50 motion-reduce:-inset-1.5 motion-reduce:animate-none motion-reduce:bg-transparent motion-reduce:ring-4 motion-reduce:ring-amber-300/80"
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
