"use client";

import { useMemo } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { useLiveTrialState } from "../scene/liveTrial";
import BelowDeckDiagram from "./BelowDeckDiagram";
import { belowDeckWater } from "./belowDeckWater";
import { panelClass } from "./styles";

const NO_COMPARTMENTS: readonly never[] = [];

/**
 * A small read-only "Below deck" cut-away shown during an iceberg trial, with
 * the water rising in each compartment as the trial plays. Below the view
 * controls on desktop and below the status pill on phones. On phones the
 * result card shows its own copy, so this one hides once the trial ends. Waves trials do not show it.
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
  const { water, opened } = useMemo(
    () => belowDeckWater(compartments),
    [compartments]
  );
  // The result card carries its own diagram on phones, where it would cover
  // this one.
  const isResult = useShipBuilderStore((s) => s.trial.status === "result");

  if (!isIceberg) return null;
  return (
    <section
      aria-label="Below deck"
      data-testid="below-deck-inset"
      className={`pointer-events-none absolute inset-x-3 top-[15rem] z-10 rounded-xl border p-2 shadow-lg lg:inset-x-auto lg:left-3 lg:top-36 lg:w-80 ${isResult ? "hidden lg:block" : ""} ${panelClass}`}
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
