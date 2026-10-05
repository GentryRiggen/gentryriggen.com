"use client";

import { useEffect, useMemo, useState } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { useLiveTrialState } from "../scene/liveTrial";
import BelowDeckDiagram from "./BelowDeckDiagram";
import { belowDeckWater } from "./belowDeckWater";
import { panelClass } from "./styles";

const NO_COMPARTMENTS: readonly never[] = [];

/**
 * A small read-only "Below deck" cut-away shown during an iceberg trial, with
 * the water rising in each compartment as the trial plays. Below the view
 * corner thumbnail that stays up through the result. Tap it to enlarge; it
 * shrinks again after a few seconds or another tap. Waves trials do not show it.
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
  const [enlarged, setEnlarged] = useState(false);

  // Shrink back after a moment so it never keeps covering the ship.
  useEffect(() => {
    if (!enlarged) return;
    const timer = setTimeout(() => setEnlarged(false), 4000);
    return () => clearTimeout(timer);
  }, [enlarged]);

  if (!isIceberg) return null;
  return (
    <section
      aria-label="Below deck"
      data-testid="below-deck-inset"
      data-enlarged={enlarged}
      className={`absolute left-3 top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] z-10 rounded-xl border p-1 shadow-lg transition-[width] ${
        enlarged
          ? "w-[min(24rem,calc(100%-1.5rem))]"
          : "w-[28%] min-w-28 max-w-56"
      } ${panelClass}`}
    >
      <button
        type="button"
        aria-label={enlarged ? "Below deck, shrink" : "Below deck, enlarge"}
        aria-expanded={enlarged}
        onClick={() => setEnlarged((value) => !value)}
        className="block w-full touch-manipulation"
      >
        <BelowDeckDiagram
          hull={hull}
          water={water}
          opened={opened}
          className="h-auto w-full"
        />
      </button>
    </section>
  );
}
