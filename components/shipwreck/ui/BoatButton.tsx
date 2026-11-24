"use client";

import { useStore } from "zustand";
import { nextBoardable } from "@/lib/shipwreck/boatRide";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import Icon from "./Icon";
import { ROUND } from "./styles";

interface BoatButtonProps {
  store: PlaybackStore;
}

/**
 * Ride a lifeboat from the outside view: one tap puts you in the next boat
 * due to leave, which lowers at once and rows away. Only there while a boat
 * is still in its davits (never on a ship without boats), not while
 * walking or riding, and not at phone width.
 */
export default function BoatButton({ store }: BoatButtonProps) {
  const next = useStore(store, (s) =>
    s.track && s.track.frames.length > 0 && s.camera !== "walk"
      ? nextBoardable(s.track.events, s.t)
      : null
  );
  if (next === null) return null;

  return (
    <button
      type="button"
      aria-label="Ride a lifeboat"
      data-testid="shipwreck-ride-boat"
      data-walk-control
      onClick={() => store.getState().boardBoat(next)}
      // Not on a phone: the top bar has no room beside the clock (walk
      // to a boat there instead).
      className={`${ROUND} max-sm:hidden`}
    >
      <Icon name="lifeboat" className="size-9" />
    </button>
  );
}
