"use client";

import { useState } from "react";
import {
  canAfford,
  upgradeCost,
  upgradeLevel,
  isMaxed,
  visibleUpgrades,
} from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type {
  RunState,
  UniverseDef,
  UpgradeDef,
} from "@/lib/ever-onward/engine/types";
import { focusRingClass } from "../styles";

interface UpgradeListProps {
  def: UniverseDef;
  run: RunState;
  onBuy: (id: string) => void;
}

interface Seen {
  known: ReadonlySet<string>;
  fresh: ReadonlySet<string>;
}

function levelText(run: RunState, upgrade: UpgradeDef): string | null {
  const max = upgrade.maxLevel ?? 1;
  if (max === 1) return null;
  const level = upgradeLevel(run, upgrade.id);
  return Number.isFinite(max) ? `Level ${level} of ${max}` : `Level ${level}`;
}

/** Visible upgrades. Mount it with `key={phase}` so a new phase starts calm. */
export default function UpgradeList({ def, run, onBuy }: UpgradeListProps) {
  const visible = visibleUpgrades(def, run);
  const open = visible.filter((u) => !isMaxed(run, u));
  const done = visible.filter((u) => isMaxed(run, u));

  // Upgrades that show up after the list mounted pop in once.
  const [seen, setSeen] = useState<Seen>(() => ({
    known: new Set(visible.map((u) => u.id)),
    fresh: new Set(),
  }));
  if (visible.some((u) => !seen.known.has(u.id))) {
    const known = new Set(seen.known);
    const fresh = new Set(seen.fresh);
    for (const u of visible) {
      if (known.has(u.id)) continue;
      known.add(u.id);
      fresh.add(u.id);
    }
    setSeen({ known, fresh });
  }

  const currencyLabel = (id: string) =>
    def.resources.find((r) => r.id === id)?.label ?? id;

  return (
    <section aria-label="Upgrades" className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
        Upgrades
      </h2>
      {open.length === 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Nothing new yet. Keep going.
        </p>
      )}
      <ul className="space-y-2">
        {open.map((u) => {
          const affordable = canAfford(run, u);
          const level = levelText(run, u);
          return (
            <li key={u.id} className={seen.fresh.has(u.id) ? "lm-pop" : ""}>
              <button
                type="button"
                aria-disabled={!affordable}
                onClick={() => {
                  if (affordable) onBuy(u.id);
                }}
                className={`w-full touch-manipulation rounded-xl border p-3 text-left transition-colors aria-disabled:cursor-not-allowed ${focusRingClass} ${
                  affordable
                    ? "lm-glow border-amber-400 bg-amber-50 text-slate-900 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:bg-amber-950/70"
                    : "border-slate-200 bg-white text-slate-600 opacity-80 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                }`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{u.name}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatNumber(upgradeCost(run, u))}{" "}
                    <span className="font-normal">
                      {currencyLabel(u.currency).toLowerCase()}
                    </span>
                  </span>
                </span>
                <span className="mt-0.5 block text-sm">{u.description}</span>
                {level && (
                  <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
                    {level}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {done.length > 0 && (
        <details className="text-sm text-slate-600 dark:text-slate-400">
          <summary
            className={`cursor-pointer rounded ${focusRingClass}`}
          >{`Done (${done.length})`}</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {done.map((u) => (
              <li key={u.id}>{u.name}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
