"use client";

import {
  requestBoard,
  requestClimbIn,
} from "@/lib/ship-builder/state/escapeActions";
import { useEscape } from "@/lib/ship-builder/state/escapeLive";

/** What the action does here, or null when there is nothing to do. */
export function escapeActionFor(
  snapshot: ReturnType<typeof useEscape>
): { label: "Board" | "Jump in" | "Climb in"; run: () => void } | null {
  if (snapshot.pickup) return { label: "Climb in", run: requestClimbIn };
  if (snapshot.boardable) {
    return {
      label: snapshot.boardable.kind === "raft" ? "Jump in" : "Board",
      run: requestBoard,
    };
  }
  return null;
}

/** Board a lifeboat, jump into a raft, or climb into a boat from the water. */
export default function EscapeActionButton() {
  const action = escapeActionFor(useEscape());
  if (!action) return null;
  return (
    <button
      type="button"
      data-testid="escape-action"
      onClick={action.run}
      className="pointer-events-auto absolute inset-x-0 bottom-28 z-40 mx-auto inline-flex min-h-12 w-fit touch-manipulation items-center justify-center rounded-full bg-amber-500 px-8 text-base font-bold text-slate-900 shadow-lg hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:bg-amber-400 dark:hover:bg-amber-300 dark:focus-visible:outline-amber-200"
    >
      {action.label}
    </button>
  );
}
