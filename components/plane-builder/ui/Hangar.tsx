"use client";

import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import { LEVELS } from "@/lib/plane-builder/levels";
import { TRACK_IDS } from "@/lib/plane-builder/plane/catalog";
import { formatCoins } from "./format";
import LastFlight from "./LastFlight";
import { cardClass, primaryButtonClass, secondaryButtonClass } from "./styles";
import SoundToggle from "./SoundToggle";
import UpgradeTrack from "./UpgradeTrack";

/**
 * The upgrade panel: a bottom sheet on phones, a sidebar from `md:`. Only the
 * upgrade list (with the last flight's results above it) scrolls. The header
 * (with the coin wallet) and the Launch! footer stay put, so Launch! is always
 * on screen. Every flight comes back here.
 */
export default function Hangar() {
  const levelId = usePlaneBuilderStore((s) => s.levelId);
  const lp = usePlaneBuilderStore((s) => s.progress.levels[s.levelId]);
  const lastFlight = usePlaneBuilderStore((s) => s.lastFlight);
  const buy = usePlaneBuilderStore((s) => s.buy);
  const goToLevels = usePlaneBuilderStore((s) => s.goToLevels);
  const startLaunch = usePlaneBuilderStore((s) => s.startLaunch);
  const level = LEVELS[levelId];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end md:items-end md:justify-stretch">
      <section
        aria-label="Hangar"
        className={`pointer-events-auto flex max-h-[50%] w-full flex-col rounded-b-none md:max-h-full md:w-[calc(22rem+env(safe-area-inset-right))] md:pr-[env(safe-area-inset-right)] md:rounded-2xl md:rounded-r-none ${cardClass}`}
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
            <SoundToggle />
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
