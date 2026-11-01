"use client";

import { useState } from "react";
import {
  canAfford,
  upgradeCost,
  upgradeLevel,
  upgradeNoEffectReason,
  previewChangesNothing,
  hasUnrevealedUpgrades,
  isMaxed,
  teaserHint,
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
import {
  pixelClass,
  retroFocusClass,
  retroSecondaryButtonClass,
} from "./retro/retroStyles";

interface UpgradeListProps {
  def: UniverseDef;
  run: RunState;
  onBuy: (id: string) => void;
  /** Opens the list of everything bought so far. */
  onShowBought?: () => void;
  /** The HUD's next goal: always shown, even past the cap. */
  pinnedId?: string;
}

/** How many cards show before "Show more upgrades". */
const SHOWN_CAP = 3;

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
export default function UpgradeList({
  def,
  run,
  onBuy,
  onShowBought,
  pinnedId,
}: UpgradeListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visible = visibleUpgrades(def, run);
  // The order is frozen between purchases and reveals, so a card never jumps
  // under a finger when affordability flips. Affordable first, then cheapest.
  const openNow = visible.filter((u) => !isMaxed(run, u));
  const signature = `${openNow.map((u) => u.id).join(",")}|${Object.values(
    run.owned
  ).reduce((sum, n) => sum + n, 0)}`;
  const sortOpen = () =>
    openNow
      .map((u, i) => ({ u, i, affordable: canAfford(run, u) }))
      .sort(
        (a, b) =>
          Number(b.affordable) - Number(a.affordable) ||
          upgradeCost(run, a.u) - upgradeCost(run, b.u) ||
          a.i - b.i
      )
      .map((x) => x.u.id);
  const [order, setOrder] = useState(() => ({
    signature,
    ids: sortOpen(),
  }));
  if (order.signature !== signature) setOrder({ signature, ids: sortOpen() });
  const byId = new Map(openNow.map((u) => [u.id, u]));
  const open = order.ids.flatMap((id) => byId.get(id) ?? []);
  // A reveal not yet in the frozen order (same render as the change) goes last.
  for (const u of openNow) if (!order.ids.includes(u.id)) open.push(u);
  const shownOpen = isExpanded
    ? open
    : open.filter((u, i) => i < SHOWN_CAP || u.id === pinnedId);
  const hiddenCount = open.length - shownOpen.length;
  const done = visible.filter((u) => isMaxed(run, u));
  const teasers = visibleTeasers(def, run).map((t) => ({
    id: t.upgradeId,
    name:
      t.name ?? def.upgrades.find((u) => u.id === t.upgradeId)?.name ?? "???",
    hint: teaserHint(def, run, t),
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
      <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {shownOpen.map((u) => {
          const affordable = canAfford(run, u);
          const level = levelText(run, u);
          const noEffect = upgradeNoEffectReason(run, u);
          return (
            <li
              key={u.id}
              id={upgradeElementId(u.id)}
              className={`scroll-mt-[calc(var(--eo-hud-h)+max(24dvh,9rem)+0.75rem)] lg:scroll-mt-[calc(var(--eo-hud-h)+0.75rem)] ${seen.fresh.has(u.id) ? "lm-pop" : ""}`}
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
                      ▶︎
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
                {u.effectPreview &&
                  (noEffect ? (
                    <span
                      data-testid="lm-no-effect"
                      className="mt-2 block font-mono text-sm text-slate-300"
                    >
                      {noEffect}
                      {!previewChangesNothing(u.effectPreview(run)) && (
                        <span className="block tabular-nums">
                          {u.effectPreview(run)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span
                      data-testid="lm-effect-preview"
                      className="mt-2 block font-mono text-sm font-bold tabular-nums text-emerald-300"
                    >
                      {u.effectPreview(run)}
                    </span>
                  ))}
                {level && (
                  <span className="mt-2 block font-mono text-xs text-slate-300">
                    {level}
                  </span>
                )}
                {affordable ? (
                  <span
                    className={`${pixelClass} mt-2 inline-block border-2 border-amber-300 bg-amber-400 px-2 py-1 text-[10px] text-amber-950`}
                  >
                    Tap to buy
                  </span>
                ) : (
                  <span className="mt-2 block font-mono text-xs text-slate-300">
                    Need{" "}
                    {formatNumber(
                      Math.ceil(
                        upgradeCost(run, u) - (run.resources[u.currency] ?? 0)
                      )
                    )}{" "}
                    more {currencyLabel(u.currency).toLowerCase()}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {(hiddenCount > 0 || isExpanded) && open.length > SHOWN_CAP && (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((v) => !v)}
          className={`${retroSecondaryButtonClass} w-full`}
        >
          {isExpanded
            ? "Show fewer upgrades"
            : `Show ${hiddenCount} more ${hiddenCount === 1 ? "upgrade" : "upgrades"}`}
        </button>
      )}
      {teasers.length > 0 && (
        <ul aria-label="Coming someday" className="space-y-3">
          {teasers.map((t) => (
            <li
              key={t.id}
              data-testid="lm-teaser"
              className="border-4 border-dashed border-slate-700 bg-slate-950/60 p-3"
            >
              <p
                className={`${pixelClass} text-[10px] leading-none text-cyan-200`}
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
      {done.length > 0 && onShowBought && (
        <button
          type="button"
          onClick={onShowBought}
          className={`${retroSecondaryButtonClass} w-full`}
        >
          Bought this part: {done.length} · See all
        </button>
      )}
    </section>
  );
}
