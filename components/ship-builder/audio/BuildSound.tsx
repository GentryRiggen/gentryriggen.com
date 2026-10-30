"use client";

import { useEffect } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { buildCueFor, type BuildSnapshot } from "./shipMix";
import { trialSynth } from "./synth";

function snapshotOf(state: {
  ship: BuildSnapshot["ship"];
  past: readonly unknown[];
  future: readonly unknown[];
}): BuildSnapshot {
  return {
    ship: state.ship,
    historyLength: state.past.length,
    futureLength: state.future.length,
  };
}

/**
 * Clicks, pops, paint swishes and undo whooshes for edits to the ship. It
 * renders nothing and listens to the store directly, so it never re-renders.
 */
export default function BuildSound() {
  useEffect(
    () =>
      useShipBuilderStore.subscribe((state, prev) => {
        if (state.ship === prev.ship) return;
        const cue = buildCueFor(snapshotOf(prev), snapshotOf(state));
        if (cue) trialSynth.play(cue);
      }),
    []
  );
  return null;
}
