"use client";

import { useMemo, useState } from "react";
import { SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "@/lib/game-kit/safeArea";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { whatIfOpenings } from "@/lib/shipwreck/sim/run";
import HullDiagram from "./HullDiagram";
import Icon from "./Icon";
import { FOCUS, PANEL, PRIMARY, ROUND, SECONDARY } from "./styles";

/** The compartments the iceberg opened on the real night. */
export const REAL_NIGHT_IDS: readonly string[] = [
  ...new Set(titanic.realNight.map((o) => o.compartmentId)),
];

const KNOWN = new Set(titanic.compartments.map((c) => c.id));

interface WhatIfEditorProps {
  /** The last What if (ids), remembered in the save. */
  initial: readonly string[];
  onBack: () => void;
  onGo: (ids: string[]) => void;
}

/** Tap the hull's compartments to open them, then Go. */
export default function WhatIfEditor({
  initial,
  onBack,
  onGo,
}: WhatIfEditorProps) {
  const [ids, setIds] = useState<string[]>(() => {
    const known = initial.filter((id) => KNOWN.has(id));
    return known.length > 0 ? known : [...REAL_NIGHT_IDS];
  });
  const selected = useMemo(() => new Set(ids), [ids]);
  const openings = useMemo(() => whatIfOpenings(titanic, ids), [ids]);
  const toggle = (id: string) =>
    setIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  // Bow first: the order a player reads the ship from the iceberg's side.
  const comps = [...titanic.compartments].reverse();

  return (
    <div
      data-testid="shipwreck-editor"
      className={`absolute inset-0 flex flex-col overflow-y-auto bg-slate-950/55 ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Back to the title"
          onClick={onBack}
          className={ROUND}
        >
          <Icon name="back" className="size-8" />
        </button>
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            What if?
          </h1>
          <p className="text-base text-slate-300 sm:text-lg">
            Tap the hull to make holes. Will she float?
          </p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-3 py-3 sm:gap-4 sm:py-4">
        <div className={`${PANEL} p-2 sm:p-4`}>
          <HullDiagram
            spec={titanic}
            openings={openings}
            selected={selected}
            onToggle={toggle}
            title="Titanic's side, bow to the right. Tap a compartment to open or close it."
            className="block h-auto w-full"
          />
          <p className="px-1 pt-1 text-xs text-slate-400 sm:text-sm">
            Stern ← · → Bow. The white lines are the watertight walls.
          </p>
        </div>

        <div
          className="flex flex-wrap justify-center gap-1.5"
          role="group"
          aria-label="Compartments"
        >
          {comps.map((c) => {
            const on = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                aria-label={`${c.label}: ${on ? "open" : "closed"}`}
                data-testid={`shipwreck-chip-${c.id}`}
                onClick={() => toggle(c.id)}
                className={`min-h-11 touch-manipulation rounded-full border px-3 text-sm font-semibold ${
                  on
                    ? "border-red-300 bg-red-500/80 text-white"
                    : "border-white/15 bg-slate-900/80 text-slate-200"
                } ${FOCUS}`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            data-testid="shipwreck-preset-real"
            aria-label="Like the real night: six compartments open"
            onClick={() => setIds([...REAL_NIGHT_IDS])}
            className={`${SECONDARY} min-h-14 px-5 text-base sm:text-lg`}
          >
            <Icon name="iceberg" className="size-6" />
            Like the real night
          </button>
          <button
            type="button"
            data-testid="shipwreck-preset-clear"
            aria-label="Clear: no holes"
            onClick={() => setIds([])}
            className={`${SECONDARY} min-h-14 px-5 text-base sm:text-lg`}
          >
            <Icon name="close" className="size-6" />
            Clear
          </button>
        </div>

        <div className="flex items-center justify-center gap-4">
          <p
            data-testid="shipwreck-hole-count"
            className="text-xl font-semibold text-white"
          >
            {ids.length === 0
              ? "No holes yet"
              : `${ids.length} ${ids.length === 1 ? "hole" : "holes"}`}
          </p>
          <button
            type="button"
            data-testid="shipwreck-go"
            aria-label="Go: start the night with these holes"
            disabled={ids.length === 0}
            onClick={() => onGo(ids)}
            className={`${PRIMARY} min-w-36 disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Go
            <Icon name="go" className="size-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
