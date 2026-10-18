"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { canPrestige } from "@/lib/plane-builder/economy/progress";
import { LEVEL_ORDER, LEVELS } from "@/lib/plane-builder/levels";
import type { LevelId } from "@/lib/plane-builder/levels/types";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import { PLANE_BUILDER_VERSION } from "@/lib/plane-builder/version";
import ConfirmPrestige from "./ConfirmPrestige";
import ConfirmRestart from "./ConfirmRestart";
import { percentOf } from "./format";
import LeaderboardCard from "./LeaderboardCard";
import SoundToggle from "./SoundToggle";
import {
  cardClass,
  coinButtonClass,
  focusRingClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./styles";

export default function LevelSelect() {
  const progress = usePlaneBuilderStore((s) => s.progress);
  const openLevel = usePlaneBuilderStore((s) => s.openLevel);
  const restart = usePlaneBuilderStore((s) => s.restart);
  const celebrate = usePlaneBuilderStore((s) => s.celebrate);
  const doPrestige = usePlaneBuilderStore((s) => s.doPrestige);
  const openMap = usePlaneBuilderStore((s) => s.openMap);
  const nextPlayRef = useRef<HTMLButtonElement>(null);
  const [restartId, setRestartId] = useState<LevelId | null>(null);
  const [isPrestigeOpen, setIsPrestigeOpen] = useState(false);
  const prestigeLevel = progress.prestige.level;

  const nextId = celebrate?.next ?? null;

  // Point the player at what to play next.
  useEffect(() => {
    const button = nextPlayRef.current;
    if (!button) return;
    button.focus();
    button.scrollIntoView?.({ block: "center" });
  }, [nextId]);

  return (
    <div className="pointer-events-auto absolute inset-0 z-10 overflow-y-auto">
      <div
        inert={restartId !== null || isPrestigeOpen}
        className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 p-4 sm:p-6"
      >
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3 rounded-2xl bg-white/80 px-3 dark:bg-slate-900/80">
            <h1 className="text-3xl font-extrabold text-sky-900 dark:text-sky-100">
              Plane Builder
            </h1>
            <Link
              href="/plane-builder/versions"
              className={`inline-flex min-h-11 items-center rounded text-sm font-medium text-sky-800 underline dark:text-sky-300 ${focusRingClass}`}
            >
              v{PLANE_BUILDER_VERSION}
            </Link>
          </div>
          <SoundToggle />
        </header>

        {/* Renders nothing until leaderboards are reachable. */}
        <LeaderboardCard />

        {celebrate && celebrate.next === null ? (
          <p
            role="status"
            className="rounded-2xl bg-emerald-100 px-4 py-3 text-center text-lg font-extrabold text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100"
          >
            You beat every world! 🏆
          </p>
        ) : null}

        {canPrestige(progress) ? (
          <section
            aria-labelledby="prestige-card"
            className={`p-4 ring-4 ring-amber-400 dark:ring-amber-300 ${cardClass}`}
          >
            <h2 id="prestige-card" className="text-xl font-extrabold">
              Prestige ⭐
            </h2>
            <p className="text-slate-600 dark:text-slate-300">
              Start every world again with a new bonus from the Sky Map. Your
              bonuses stack forever.
            </p>
            <button
              type="button"
              onClick={() => setIsPrestigeOpen(true)}
              className={`${coinButtonClass} mt-3`}
            >
              Prestige ⭐
            </button>
          </section>
        ) : null}

        {prestigeLevel >= 1 ? (
          <button
            type="button"
            onClick={openMap}
            className={secondaryButtonClass}
          >
            🗺️ Sky Map (Prestige {prestigeLevel})
          </button>
        ) : null}

        <ul className="flex flex-col gap-4">
          {LEVEL_ORDER.map((id, index) => {
            const level = LEVELS[id];
            const lp = progress.levels[id];
            const isUnlocked = progress.unlocked.includes(id);
            const hasProgress =
              lp.coins > 0 ||
              lp.best > 0 ||
              Object.values(lp.tiers).some((tier) => tier > 0);
            const percent = percentOf(lp.best, level.finishDistance);
            const previous = LEVELS[LEVEL_ORDER[index - 1] ?? id];
            const isWon = celebrate?.won === id;
            const isNext = nextId === id;
            const highlightClass = isWon
              ? "ring-4 ring-emerald-500 dark:ring-emerald-400"
              : isNext
                ? "pb-glow ring-4 ring-amber-400 dark:ring-amber-300"
                : "";
            return (
              <li key={id}>
                <article
                  aria-labelledby={`level-${id}`}
                  className={`p-4 ${cardClass} ${isUnlocked ? "" : "opacity-80"} ${highlightClass}`}
                >
                  {isWon || isNext ? (
                    <p
                      className={`mb-2 inline-block rounded-full px-3 py-1 text-sm font-extrabold ${
                        isWon
                          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"
                      }`}
                    >
                      {isWon ? "Finished! 🏆" : "Next up!"}
                    </p>
                  ) : null}
                  <h2 id={`level-${id}`} className="text-xl font-bold">
                    {level.name}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300">
                    {level.blurb}
                  </p>
                  {isUnlocked ? (
                    <>
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Best: {percent}%
                        </p>
                        <svg
                          aria-hidden="true"
                          className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                        >
                          <rect
                            width={`${percent}%`}
                            height="100%"
                            className="fill-sky-500 dark:fill-sky-400"
                          />
                        </svg>
                      </div>
                      <div className="mt-4 flex gap-3">
                        <button
                          type="button"
                          onClick={() => openLevel(id)}
                          ref={isNext ? nextPlayRef : undefined}
                          data-play-level={id}
                          aria-label={`${lp.finished ? "Replay" : "Play"} ${level.name}`}
                          className={primaryButtonClass}
                        >
                          {lp.finished ? "Replay" : "Play"}
                        </button>
                        {hasProgress ? (
                          <button
                            type="button"
                            onClick={() => setRestartId(id)}
                            aria-label={`Restart ${level.name}`}
                            className={secondaryButtonClass}
                          >
                            Restart
                          </button>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                      <Lock aria-hidden="true" className="h-5 w-5 shrink-0" />
                      Reach the finish in {previous.name} to unlock
                    </p>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      </div>
      {isPrestigeOpen ? (
        <ConfirmPrestige
          onCancel={() => setIsPrestigeOpen(false)}
          onConfirm={() => {
            setIsPrestigeOpen(false);
            doPrestige();
          }}
        />
      ) : null}
      {restartId ? (
        <ConfirmRestart
          levelId={restartId}
          getFallbackFocus={() =>
            document.querySelector<HTMLElement>(
              `[data-play-level="${restartId}"]`
            )
          }
          onCancel={() => setRestartId(null)}
          onConfirm={() => {
            restart(restartId);
            setRestartId(null);
          }}
        />
      ) : null}
    </div>
  );
}
