"use client";

import { useEffect, useState } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { useLiveTrialState } from "../scene/liveTrial";
import { isPastBoarding } from "../scene/pastBoarding";
import { trialPlayback } from "../scene/trialPlayback";
import WalkButton from "./WalkButton";

/** How often the playback is checked; it is not reactive, so poll it. */
const PLAYBACK_POLL_MS = 150;

/**
 * Whether the playback (written by every driver, weather trials included, which
 * publish no live state) shows her going over or under.
 */
function isWreckedInPlayback(): boolean {
  const { phase } = trialPlayback;
  return (
    isPastBoarding(trialPlayback) ||
    phase === "capsizing" ||
    phase === "sinking" ||
    trialPlayback.capsizedAt !== null
  );
}

/**
 * The Walk button while a sea trial plays (the Sea trial button, which
 * normally carries it, is hidden then). It goes away once she has broken in two
 * or gone under, or started to capsize or sink (`isPastBoarding`): there is no climbing aboard a wreck.
 */
export default function TrialWalkButton() {
  const isShown = useShipBuilderStore(
    (s) =>
      s.trial.status === "running" &&
      s.walk.status === "idle" &&
      s.drive.status === "idle"
  );
  const live = useLiveTrialState();
  const [isWrecked, setIsWrecked] = useState(false);
  useEffect(() => {
    if (!isShown) return;
    const check = () => setIsWrecked(isWreckedInPlayback());
    check();
    const id = setInterval(check, PLAYBACK_POLL_MS);
    return () => clearInterval(id);
  }, [isShown]);
  if (!isShown) return null;
  if (isWrecked || (live && isPastBoarding(live))) return null;
  return (
    <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2">
      <WalkButton align="center" />
    </div>
  );
}
