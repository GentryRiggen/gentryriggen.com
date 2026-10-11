"use client";

import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import { LEVELS } from "@/lib/plane-builder/levels";
import { TRACK_IDS } from "@/lib/plane-builder/plane/catalog";
import { formatCoins } from "./format";
import { cardClass, primaryButtonClass, secondaryButtonClass } from "./styles";
import UpgradeTrack from "./UpgradeTrack";

export default function Hangar() {
  const levelId = usePlaneBuilderStore((s) => s.levelId);
  const lp = usePlaneBuilderStore((s) => s.progress.levels[s.levelId]);
  const buy = usePlaneBuilderStore((s) => s.buy);
  const goToLevels = usePlaneBuilderStore((s) => s.goToLevels);
  const startLaunch = usePlaneBuilderStore((s) => s.startLaunch);
  const level = LEVELS[levelId];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end md:items-end md:justify-stretch">
      <section
        aria-label="Hangar"
        className={`pointer-events-auto flex max-h-[50%] w-full flex-col gap-3 overflow-y-auto rounded-b-none p-3 md:max-h-none md:w-[22rem] md:rounded-2xl md:rounded-r-none md:p-4 ${cardClass}`}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goToLevels}
            className={secondaryButtonClass}
          >
            ← Levels
          </button>
          {/* Task 12: the SoundToggle goes here. */}
          <div data-slot="sound-toggle" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold">{level.name}</h2>
          <p
            aria-label={`${lp.coins} coins`}
            className="rounded-full bg-amber-100 px-3 py-1 text-lg font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
          >
            🪙 {formatCoins(lp.coins)}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
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
        <button
          type="button"
          onClick={startLaunch}
          className={`${primaryButtonClass} min-h-14 text-xl`}
        >
          Launch!
        </button>
      </section>
    </div>
  );
}
