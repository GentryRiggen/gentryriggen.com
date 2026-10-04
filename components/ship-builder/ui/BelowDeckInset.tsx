"use client";

import { useMemo } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { useLiveTrialState } from "../scene/liveTrial";
import BelowDeckDiagram from "./BelowDeckDiagram";
import { panelClass } from "./styles";

const NO_COMPARTMENTS: readonly never[] = [];

/**
 * A small read-only "Below deck" cut-away shown during an iceberg trial, with
 * the water rising in each compartment as the trial plays. Top-left on desktop
 * and across the top on phones, clear of the status pill and the view
 * controls. Waves trials do not show it.
 */
export default function BelowDeckInset() {
  const hull = useShipBuilderStore((s) => s.ship.hull);
  const isIceberg = useShipBuilderStore(
    (s) =>
      (s.trial.status === "running" || s.trial.status === "result") &&
      s.trial.input.iceberg !== undefined
  );
  const live = useLiveTrialState();
  const compartments = live?.compartments ?? NO_COMPARTMENTS;
  const water = useMemo(
    () => Object.fromEntries(compartments.map((c) => [c.id, c.water])),
    [compartments]
  );
  const opened = useMemo(
    () => compartments.filter((c) => c.opened).map((c) => c.id),
    [compartments]
  );

  if (!isIceberg) return null;
  return (
    <section
      aria-label="Below deck"
      data-testid="below-deck-inset"
      className={`pointer-events-none absolute inset-x-3 top-[15rem] z-10 rounded-xl border p-2 shadow-lg lg:inset-x-auto lg:left-3 lg:top-16 lg:w-80 ${panelClass}`}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Below deck
      </h2>
      <BelowDeckDiagram
        hull={hull}
        water={water}
        opened={opened}
        className="mt-1 h-auto w-full"
      />
    </section>
  );
}
