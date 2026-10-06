"use client";

import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { useLiveTrialState } from "../scene/liveTrial";
import WalkButton from "./WalkButton";

/**
 * The Walk button while a sea trial plays (the Sea trial button, which
 * normally carries it, is hidden then). It goes away once she has broken in two
 * or gone under: there is nothing left to walk on.
 */
export default function TrialWalkButton() {
  const isShown = useShipBuilderStore(
    (s) =>
      s.trial.status === "running" &&
      s.walk.status === "idle" &&
      s.drive.status === "idle"
  );
  const live = useLiveTrialState();
  if (!isShown) return null;
  if (live && (live.phase === "done" || live.breakup !== null)) return null;
  return (
    <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2">
      <WalkButton />
    </div>
  );
}
