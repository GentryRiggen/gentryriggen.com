"use client";

import { Sailboat } from "lucide-react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import useSeaState from "../hooks/useSeaState";

/** Id the result card uses to hand focus back here. */
export const SEA_TRIAL_BUTTON_ID = "sea-trial-button";

/**
 * Starts a sea trial. It floats bottom-centre, the slot the placement hint
 * and the selection bar use while a tool or a part is active, so it only
 * shows when both are idle.
 */
export default function SeaTrialButton() {
  const isShown = useShipBuilderStore(
    (s) =>
      s.trial.status === "idle" &&
      s.tool.kind === "none" &&
      s.selectedId === null &&
      s.pendingRemoval === null
  );
  const startTrial = useShipBuilderStore((s) => s.startTrial);
  const { seaState } = useSeaState();

  if (!isShown) return null;
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 mx-auto flex w-fit justify-center">
      <button
        id={SEA_TRIAL_BUTTON_ID}
        type="button"
        onClick={() => startTrial(seaState)}
        className="pointer-events-auto inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-full bg-sky-600 px-5 text-sm font-semibold text-white shadow-lg hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-sky-500 dark:hover:bg-sky-400 dark:focus-visible:outline-sky-300"
      >
        <Sailboat aria-hidden="true" className="h-5 w-5 shrink-0" />
        Sea trial
      </button>
    </div>
  );
}
