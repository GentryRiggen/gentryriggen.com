"use client";

import { memo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import {
  currentEffectText,
  ownedPrestigeUpgrades,
  ownedRunUpgradesByPhase,
  ownedSignature,
} from "@/lib/ever-onward/engine/ownedUpgrades";
import { prestigeLabel } from "@/lib/ever-onward/engine/prestige";
import type { UniverseDef, UniverseSave } from "@/lib/ever-onward/engine/types";
import RetroHeading from "./retro/RetroHeading";
import {
  pixelClass,
  pixelFont,
  retroFocusClass,
  retroPanelClass,
} from "./retro/retroStyles";

interface UpgradesDialogProps {
  def: UniverseDef;
  universe: UniverseSave;
  onClose: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function levelLine(level: number, max: number | null): string | null {
  if (max === null || max === 1) return null;
  return Number.isFinite(max)
    ? `Level ${level} of ${max}`
    : `Level ${formatNumber(level)}`;
}

/**
 * Everything the player has bought: the permanent upgrades (kept between
 * runs) and the run upgrades, newest part first. Same shape as the ember
 * dialog. It re-renders only when something is bought, not every tick.
 */
function UpgradesDialogView({ def, universe, onClose }: UpgradesDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (!panelRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const label = prestigeLabel(def);
  const permanent = ownedPrestigeUpgrades(def, universe);
  const groups = ownedRunUpgradesByPhase(def, universe.run);

  return createPortal(
    <div
      className={`${pixelFont.variable} dark fixed inset-0 z-50 flex items-end lg:items-stretch lg:justify-end`}
    >
      <div
        aria-hidden="true"
        data-testid="lm-upgrades-backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-[#02030a]/80"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lm-upgrades-title"
        data-testid="lm-upgrades-dialog"
        className={`${retroPanelClass} lm-fade-up relative flex max-h-[85dvh] w-full flex-col !bg-slate-950 text-amber-50 lg:max-h-none lg:max-w-xl lg:border-y-0 lg:border-r-0`}
      >
        <div className="flex items-center justify-between gap-3 border-b-4 border-amber-500/60 p-3">
          <RetroHeading as="h2" id="lm-upgrades-title" className="text-sm">
            Your upgrades
          </RetroHeading>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close your upgrades"
            className={`${pixelClass} inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center border-2 border-slate-500 bg-slate-900 px-3 text-[10px] text-slate-100 hover:bg-slate-800 ${retroFocusClass}`}
          >
            ✕ Close
          </button>
        </div>
        <div className="space-y-6 overflow-y-auto overscroll-contain p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <section
            aria-labelledby="lm-upgrades-permanent"
            className="space-y-3"
          >
            <h3
              id="lm-upgrades-permanent"
              className={`${pixelClass} text-xs text-orange-200`}
            >
              Permanent
            </h3>
            {permanent.length === 0 ? (
              <p
                data-testid="lm-upgrades-permanent-empty"
                className="font-mono text-sm text-slate-300"
              >
                Nothing here yet. Finish parts of a run to earn{" "}
                {label.toLowerCase()}, then spend them in the {label} dialog on
                upgrades that stay with you every time you play.
              </p>
            ) : (
              <ul className="space-y-3">
                {permanent.map(({ upgrade, level }) => (
                  <li
                    key={upgrade.id}
                    data-testid="lm-upgrades-permanent-item"
                    className="border-4 border-orange-300/70 bg-orange-950/40 p-3"
                  >
                    <p
                      className={`${pixelClass} text-[10px] leading-relaxed text-orange-200`}
                    >
                      {upgrade.name}
                    </p>
                    <p className="mt-2 font-mono text-sm text-orange-50">
                      {upgrade.description}
                    </p>
                    <p className="mt-2 font-mono text-xs text-slate-300">
                      Level {level} of {upgrade.maxLevel}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="lm-upgrades-run" className="space-y-3">
            <h3
              id="lm-upgrades-run"
              className={`${pixelClass} text-xs text-amber-200`}
            >
              This run
            </h3>
            {groups.length === 0 ? (
              <p className="font-mono text-sm text-slate-300">
                Nothing bought in this run yet. Upgrades you buy will show up
                here.
              </p>
            ) : (
              groups.map((group) => (
                <div
                  key={group.phaseId ?? "all"}
                  data-testid="lm-upgrades-group"
                  className="space-y-2"
                >
                  <h4 className="font-mono text-xs font-bold text-cyan-200">
                    {group.title}
                  </h4>
                  <ul className="space-y-2">
                    {group.items.map(({ upgrade, level, maxLevel }) => {
                      const effect = currentEffectText(
                        upgrade.effectPreview?.(universe.run) ?? null,
                        maxLevel === null
                      );
                      const levelText = levelLine(level, maxLevel);
                      return (
                        <li
                          key={upgrade.id}
                          data-testid="lm-upgrades-run-item"
                          className="border-2 border-slate-600 bg-slate-900/70 p-3"
                        >
                          <p
                            className={`${pixelClass} text-[10px] leading-relaxed text-amber-200`}
                          >
                            {upgrade.name}
                          </p>
                          {levelText && (
                            <p className="mt-1 font-mono text-xs text-slate-300">
                              {levelText}
                            </p>
                          )}
                          {effect && (
                            <p className="mt-2 font-mono text-sm font-bold tabular-nums text-emerald-300">
                              {effect}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}

const UpgradesDialog = memo(
  UpgradesDialogView,
  (a, b) =>
    a.def === b.def &&
    a.onClose === b.onClose &&
    ownedSignature(a.def, a.universe) === ownedSignature(b.def, b.universe)
);

export default UpgradesDialog;
