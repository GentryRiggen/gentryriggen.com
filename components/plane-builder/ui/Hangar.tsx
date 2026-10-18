"use client";

import { useState } from "react";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import { LEVELS } from "@/lib/plane-builder/levels";
import { TRACK_IDS } from "@/lib/plane-builder/plane/catalog";
import BonusSummary from "./BonusSummary";
import { formatCoins } from "./format";
import LastFlight from "./LastFlight";
import {
  cardClass,
  focusRingClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./styles";
import SoundToggle from "./SoundToggle";
import UpgradeTrack from "./UpgradeTrack";

/**
 * The upgrade panel: most of the screen on phones (the plane turns in a strip
 * above it), a sidebar from `md:`. Only the upgrade list (with the last
 * flight's results above it) scrolls. The header (with the coin wallet) and
 * the Launch! footer stay put, so Launch! is always on screen. Every flight
 * comes back here.
 */
export default function Hangar() {
  const levelId = usePlaneBuilderStore((s) => s.levelId);
  const lp = usePlaneBuilderStore((s) => s.progress.levels[s.levelId]);
  const lastFlight = usePlaneBuilderStore((s) => s.lastFlight);
  const buy = usePlaneBuilderStore((s) => s.buy);
  const goToLevels = usePlaneBuilderStore((s) => s.goToLevels);
  const startLaunch = usePlaneBuilderStore((s) => s.startLaunch);
  const prestige = usePlaneBuilderStore((s) => s.progress.prestige);
  const [isBonusOpen, setIsBonusOpen] = useState(false);
  const level = LEVELS[levelId];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end md:items-end md:justify-start">
      <section
        aria-label="Hangar"
        className={`pointer-events-auto flex h-[72%] w-full flex-col max-md:rounded-b-none md:h-full pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] md:w-[calc(22rem+env(safe-area-inset-right))] md:pl-0 md:rounded-2xl md:rounded-r-none ${cardClass}`}
      >
        <header className="flex shrink-0 flex-col gap-2 p-3 pb-2 md:p-4 md:pt-[max(1rem,env(safe-area-inset-top))] md:pb-2 short:gap-1 short:p-2 short:pb-1">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goToLevels}
              className={secondaryButtonClass}
            >
              ← Levels
            </button>
            <div className="relative flex items-center gap-2">
              {prestige.level >= 1 ? (
                <>
                  <button
                    type="button"
                    aria-expanded={isBonusOpen}
                    aria-controls="hangar-bonuses"
                    onClick={() => setIsBonusOpen((open) => !open)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setIsBonusOpen(false);
                    }}
                    className={`inline-flex min-h-11 items-center rounded-full bg-amber-100 px-3 text-sm font-bold text-amber-900 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-800/60 ${focusRingClass}`}
                  >
                    ⭐ Prestige {prestige.level}
                  </button>
                  {isBonusOpen ? (
                    <div
                      id="hangar-bonuses"
                      className={`absolute top-full right-0 z-20 mt-2 w-72 max-w-[85vw] p-3 ${cardClass}`}
                    >
                      <BonusSummary bonuses={prestige.bonuses} />
                    </div>
                  ) : null}
                </>
              ) : null}
              <SoundToggle />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold short:text-lg">
              {level.name}
            </h2>
            <p className="rounded-full bg-amber-100 px-3 py-1 text-lg font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
              <span aria-hidden="true">🪙 </span>
              {formatCoins(lp.coins)}
              <span className="sr-only"> coins</span>
            </p>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-1 md:px-4 short:gap-1.5 short:px-2">
          {lastFlight ? (
            <LastFlight levelId={levelId} flight={lastFlight} />
          ) : null}
          <ul className="flex flex-col gap-2 short:gap-1.5">
            {TRACK_IDS.map((track) => (
              <UpgradeTrack
                key={track}
                track={track}
                catalog={level.plane}
                tier={lp.tiers[track]}
                coins={lp.coins}
                onBuy={(t) => buy(t).ok}
              />
            ))}
          </ul>
        </div>
        <footer className="shrink-0 border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-4 dark:border-slate-700 short:p-2">
          <button
            type="button"
            onClick={startLaunch}
            className={`${primaryButtonClass} w-full min-h-14 text-xl short:min-h-11`}
          >
            Launch!
          </button>
        </footer>
      </section>
    </div>
  );
}
