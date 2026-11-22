"use client";

import { useMemo, useState } from "react";
import { SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "@/lib/game-kit/safeArea";
import type { ShipWhatIf } from "@/lib/shipwreck/save";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { whatIfOpenings, whatIfSpots } from "@/lib/shipwreck/sim/run";
import HullDiagram from "./HullDiagram";
import Icon from "./Icon";
import { FOCUS, PANEL, PRIMARY, ROUND, SECONDARY } from "./styles";

/**
 * The What if? ids that give a ship's real damage: for an iceberg ship the
 * compartments it opened, for a torpedo ship the one spot where the real
 * hit lands (the hit moved there is the real afternoon).
 */
export function realWhatIfIds(spec: ShipSpec): string[] {
  if (spec.cause !== "torpedo")
    return [...new Set(spec.realNight.map((o) => o.compartmentId))];
  const real = JSON.stringify(spec.realNight);
  const spot = whatIfSpots(spec).find(
    (id) => JSON.stringify(whatIfOpenings(spec, [id])) === real
  );
  return spot ? [spot] : [];
}

/** The compartments the iceberg opened on the real night. */
export const REAL_NIGHT_IDS: readonly string[] = realWhatIfIds(titanic);

export interface WhatIfChoice {
  ids: string[];
  /** Torpedo ships only. */
  portholesOpen?: boolean;
}

interface WhatIfEditorProps {
  spec: ShipSpec;
  /** The ship's last What if, remembered in the save. */
  initial: ShipWhatIf;
  onBack: () => void;
  onGo: (choice: WhatIfChoice) => void;
}

/**
 * Tap the hull's compartments to open them, then Go. For a torpedo ship,
 * tap where the one torpedo hits (along her starboard side), and choose
 * whether her portholes were open.
 */
export default function WhatIfEditor({
  spec,
  initial,
  onBack,
  onGo,
}: WhatIfEditorProps) {
  const torpedo = spec.cause === "torpedo";
  const spots = useMemo(() => whatIfSpots(spec), [spec]);
  const real = useMemo(() => realWhatIfIds(spec), [spec]);
  const [ids, setIds] = useState<string[]>(() => {
    const known = initial.ids.filter((id) => spots.includes(id));
    if (torpedo) return known.length > 0 ? known.slice(0, 1) : real;
    return known.length > 0 ? known : real;
  });
  const [portholesOpen, setPortholesOpen] = useState(
    initial.portholesOpen ?? true
  );
  const selected = useMemo(() => new Set(ids), [ids]);
  const openings = useMemo(() => whatIfOpenings(spec, ids), [spec, ids]);
  const toggle = (id: string) => {
    if (!spots.includes(id)) return;
    // One torpedo: tapping a spot moves the hit there.
    if (torpedo) setIds([id]);
    else
      setIds((cur) =>
        cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      );
  };
  // Bow first: the order a player reads the ship from the hit side.
  const comps = spec.compartments.filter((c) => spots.includes(c.id)).reverse();
  const hit = spec.compartments.find((c) => c.id === ids[0]);
  const isReal =
    ids.length === real.length &&
    ids.every((id) => real.includes(id)) &&
    (!torpedo || portholesOpen);

  return (
    <div
      data-testid="shipwreck-editor"
      data-ship={spec.id}
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
            {torpedo
              ? "Tap where the torpedo hits. Will she float?"
              : "Tap the hull to make holes. Will she float?"}
          </p>
        </div>
      </div>

      <div
        className={`mx-auto flex w-full flex-1 flex-col justify-center gap-3 py-3 sm:gap-4 sm:py-4 ${
          torpedo ? "max-w-3xl" : "max-w-4xl"
        }`}
      >
        <div className={`${PANEL} p-2 sm:p-4`}>
          <HullDiagram
            spec={spec}
            openings={openings}
            selected={selected}
            onToggle={toggle}
            title={
              torpedo
                ? `${spec.name}'s side, bow to the right, and her plan from above. Tap where the torpedo hits.`
                : `${spec.name}'s side, bow to the right. Tap a compartment to open or close it.`
            }
            className="block h-auto w-full"
          />
          <p className="px-1 pt-1 text-xs text-slate-400 sm:text-sm">
            {torpedo
              ? "Stern ← · → Bow. The torpedo comes from starboard (the bottom of the plan). White lines: watertight walls and her side coal bunkers."
              : "Stern ← · → Bow. The white lines are the watertight walls."}
          </p>
        </div>

        <div
          className="flex flex-wrap justify-center gap-1.5"
          role={torpedo ? "radiogroup" : "group"}
          aria-label={torpedo ? "Where the torpedo hits" : "Compartments"}
        >
          {comps.map((c) => {
            const on = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                role={torpedo ? "radio" : undefined}
                aria-checked={torpedo ? on : undefined}
                aria-pressed={torpedo ? undefined : on}
                aria-label={
                  torpedo
                    ? `${c.label}${on ? ": the torpedo hits here" : ""}`
                    : `${c.label}: ${on ? "open" : "closed"}`
                }
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

        {/* A torpedo ship's choices and Go share one row (her plan is taller). */}
        <div
          className={
            torpedo
              ? "flex flex-wrap items-center justify-center gap-3"
              : "contents"
          }
        >
          <div
            className={
              torpedo
                ? "contents"
                : "flex flex-wrap items-center justify-center gap-3"
            }
          >
            <button
              type="button"
              data-testid="shipwreck-preset-real"
              aria-label={
                torpedo
                  ? "Like the real afternoon: the torpedo beside the front boiler room, portholes open"
                  : "Like the real night: six compartments open"
              }
              aria-pressed={torpedo ? isReal : undefined}
              onClick={() => {
                setIds([...real]);
                setPortholesOpen(true);
              }}
              className={`${SECONDARY} min-h-14 px-5 text-base sm:text-lg`}
            >
              <Icon name={torpedo ? "torpedo" : "iceberg"} className="size-6" />
              {torpedo ? "Like the real afternoon" : "Like the real night"}
            </button>
            {torpedo ? (
              <button
                type="button"
                data-testid="shipwreck-portholes"
                aria-pressed={portholesOpen}
                aria-label={
                  portholesOpen
                    ? "Portholes open: tap to shut them"
                    : "Portholes shut: tap to open them"
                }
                onClick={() => setPortholesOpen(!portholesOpen)}
                className={`${portholesOpen ? PRIMARY : SECONDARY} min-h-14 px-5 text-base sm:text-lg`}
              >
                <Icon name="porthole" className="size-6" />
                {portholesOpen ? "Portholes open" : "Portholes shut"}
              </button>
            ) : (
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
            )}
          </div>

          <div className="flex items-center justify-center gap-4">
            <p
              data-testid="shipwreck-hole-count"
              className="text-xl font-semibold text-white"
            >
              {torpedo
                ? hit
                  ? `Hits: ${hit.label}`
                  : "Choose where it hits"
                : ids.length === 0
                  ? "No holes yet"
                  : `${ids.length} ${ids.length === 1 ? "hole" : "holes"}`}
            </p>
            <button
              type="button"
              data-testid="shipwreck-go"
              aria-label={
                torpedo
                  ? "Go: start the afternoon with the torpedo here"
                  : "Go: start the night with these holes"
              }
              disabled={ids.length === 0}
              onClick={() => onGo(torpedo ? { ids, portholesOpen } : { ids })}
              className={`${PRIMARY} min-w-36 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Go
              <Icon name="go" className="size-7" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
