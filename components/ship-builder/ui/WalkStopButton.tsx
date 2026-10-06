"use client";

import { LogOut } from "lucide-react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { focusWalkButton } from "./WalkButton";
import { panelClass } from "./styles";

/**
 * A temporary way out of walk mode, until the walk HUD lands and replaces it.
 * Only shown while walking; sits top-right.
 */
export default function WalkStopButton() {
  const isWalking = useShipBuilderStore((s) => s.walk.status === "walking");
  const stopWalk = useShipBuilderStore((s) => s.stopWalk);
  if (!isWalking) return null;

  function handleStop() {
    stopWalk();
    focusWalkButton();
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={handleStop}
        className={`pointer-events-auto inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-lg hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:bg-slate-800 dark:focus-visible:outline-sky-400 ${panelClass}`}
      >
        <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
        Stop walking
      </button>
    </div>
  );
}
