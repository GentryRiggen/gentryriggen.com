"use client";

import { useState } from "react";
import {
  canAfford,
  upgradeCost,
  upgradeLevel,
  hasUnrevealedUpgrades,
  isMaxed,
  visibleTeasers,
  visibleUpgrades,
} from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type {
  RunState,
  UniverseDef,
  UpgradeDef,
} from "@/lib/ever-onward/engine/types";
import RetroHeading from "./retro/RetroHeading";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

interface UpgradeListProps {
  def: UniverseDef;
  run: RunState;
  onBuy: (id: string) => void;
}

/** DOM id of an upgrade's card, so the next-goal bar can scroll to it. */
export const upgradeElementId = (id: string): string => `lm-upgrade-${id}`;

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
  const teasers = visibleTeasers(def, run).map((t) => ({
    id: t.upgradeId,
    name:
      t.name ?? def.upgrades.find((u) => u.id === t.upgradeId)?.name ?? "???",
    hint: t.hint(run),
  }));

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
    <section aria-label="Upgrades" className="space-y-3">
      <RetroHeading hasBullet>Upgrades</RetroHeading>
      {open.length === 0 && (
        <p className="font-mono text-sm text-slate-300">
          Nothing to buy right now.
        </p>
      )}
      <ul className="space-y-3">
        {open.map((u) => {
          const affordable = canAfford(run, u);
          const level = levelText(run, u);
          return (
            <li
              key={u.id}
              id={upgradeElementId(u.id)}
              className={seen.fresh.has(u.id) ? "lm-pop" : ""}
            >
              <button
                type="button"
                aria-disabled={!affordable}
                onClick={(event) => {
                  if (!affordable) return;
                  // Restart the bounce without remounting (keeps focus).
                  const button = event.currentTarget;
                  button.classList.remove("lm-buy");
                  void button.offsetWidth;
                  button.classList.add("lm-buy");
                  onBuy(u.id);
                }}
                className={`block w-full touch-manipulation border-4 p-3 text-left transition-transform aria-disabled:cursor-not-allowed ${retroFocusClass} ${
                  affordable
                    ? "border-amber-300 bg-amber-950/50 text-amber-50 shadow-[4px_4px_0_#78350f,0_0_14px_rgba(251,191,36,0.4)] hover:bg-amber-900/60 active:translate-y-0.5 active:shadow-none"
                    : "border-slate-700 bg-slate-950/85 text-slate-400 shadow-[4px_4px_0_#0f172a]"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span
                    className={`${pixelClass} min-w-0 text-[10px] leading-relaxed ${
                      affordable ? "text-amber-300" : "text-slate-300"
                    }`}
                  >
                    <span aria-hidden="true" className="mr-2">
                      ▶
                    </span>
                    {u.name}
                  </span>
                  <span
                    className={`${pixelClass} shrink-0 text-right text-[10px] tabular-nums ${
                      affordable ? "text-amber-100" : "text-slate-400"
                    }`}
                  >
                    {formatNumber(upgradeCost(run, u))}{" "}
                    <span className="font-mono text-xs normal-case">
                      {currencyLabel(u.currency).toLowerCase()}
                    </span>
                  </span>
                </span>
                <span className="mt-2 block font-mono text-sm">
                  {u.description}
                </span>
                {u.effectPreview && (
                  <span
                    data-testid="lm-effect-preview"
                    className="mt-2 block font-mono text-sm font-bold tabular-nums text-emerald-300"
                  >
                    {u.effectPreview(run)}
                  </span>
                )}
                {level && (
                  <span className="mt-2 block font-mono text-xs text-slate-300">
                    {level}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {teasers.length > 0 && (
        <ul aria-label="Coming someday" className="space-y-3">
          {teasers.map((t) => (
            <li
              key={t.id}
              data-testid="lm-teaser"
              className="border-4 border-dashed border-slate-700 bg-slate-950/60 p-3"
            >
              <p
                className={`${pixelClass} text-[8px] leading-none text-cyan-200`}
              >
                Someday
              </p>
              <p
                className={`${pixelClass} mt-2 text-[10px] leading-relaxed text-slate-400`}
              >
                {t.name}
              </p>
              <p className="mt-2 font-mono text-sm text-slate-400">{t.hint}</p>
            </li>
          ))}
        </ul>
      )}
      {hasUnrevealedUpgrades(def, run) && (
        <p className="font-mono text-xs text-slate-300">
          More upgrades unlock as you grow…
        </p>
      )}
      {done.length > 0 && (
        <details className="font-mono text-sm text-slate-300">
          <summary
            className={`cursor-pointer px-1 py-1 ${retroFocusClass}`}
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
