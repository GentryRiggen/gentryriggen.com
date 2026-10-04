"use client";

import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import BelowDeckDiagram from "./BelowDeckDiagram";

/** The Hull panel's "Below deck" section: tap walls to add or raise them. */
export default function BelowDeck() {
  const hull = useShipBuilderStore((s) => s.ship.hull);
  const cycleBulkhead = useShipBuilderStore((s) => s.cycleBulkhead);
  const isTrialRunning = useShipBuilderStore((s) => s.trial.status !== "idle");

  return (
    <section aria-labelledby="below-deck-heading" className="mt-3">
      <h3
        id="below-deck-heading"
        className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
        Below deck
      </h3>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        Tap a wall to add it or make it taller. Walls keep water out if the hull
        is holed.
      </p>
      <div className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        <BelowDeckDiagram
          hull={hull}
          onCycle={isTrialRunning ? undefined : cycleBulkhead}
        />
      </div>
    </section>
  );
}
