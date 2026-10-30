"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getIdToken } from "@/lib/leaderboard/auth";
import {
  TWIST_INFO,
  dailyFor,
  formatCountdown,
  msUntilNextUtcDay,
  utcDateKey,
} from "@/lib/plane-builder/daily/daily";
import { planeTierName } from "@/lib/plane-builder/share/timeCard";
import { LEVELS } from "@/lib/plane-builder/levels";
import { LEADERBOARDS_ENABLED } from "@/lib/plane-builder/state/leaderboardSync";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import Leaderboards from "./Leaderboards";
import ShareTimeButton from "./ShareTimeButton";
import { cardClass, primaryButtonClass, secondaryButtonClass } from "./styles";

/** The clock, as whole seconds, so the card re-renders once a second. */
function subscribeToClock(onChange: () => void): () => void {
  const timer = setInterval(onChange, 1000);
  return () => clearInterval(timer);
}
const readClock = () => Math.floor(Date.now() / 1000) * 1000;
/** Zero on the server and during hydration; the card draws once it ticks. */
const readServerClock = () => 0;

interface DailyCardProps {
  /** Off in tests and e2e by default; see LEADERBOARDS_ENABLED. */
  leaderboardsEnabled?: boolean;
}

/** Today's challenge: world, twist, countdown, your best time, and the board. */
export default function DailyCard({
  leaderboardsEnabled = LEADERBOARDS_ENABLED,
}: DailyCardProps) {
  const now = useSyncExternalStore(
    subscribeToClock,
    readClock,
    readServerClock
  );
  const openDaily = usePlaneBuilderStore((s) => s.openDaily);
  const dailyBest = usePlaneBuilderStore((s) => s.progress.dailyBest);
  const nickname = usePlaneBuilderStore((s) => s.progress.nickname);
  const levels = usePlaneBuilderStore((s) => s.progress.levels);
  const [uid, setUid] = useState<string | null>(null);
  const [isBoardOpen, setIsBoardOpen] = useState(false);

  useEffect(() => {
    if (!leaderboardsEnabled) return;
    let isCancelled = false;
    getIdToken()
      .then((session) => {
        if (!isCancelled) setUid(session?.uid ?? null);
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [leaderboardsEnabled]);

  if (now === 0) return null;

  const today = dailyFor(utcDateKey(now));
  const twist = TWIST_INFO[today.twist];
  const bestToday = dailyBest?.date === today.date ? dailyBest.time : null;

  return (
    <section
      aria-labelledby="daily-card"
      data-testid="daily-card"
      className={`p-4 ring-4 ring-violet-400 dark:ring-violet-300 ${cardClass}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="daily-card" className="text-xl font-extrabold">
          Daily challenge <span aria-hidden="true">⚡</span>
        </h2>
        <p
          data-testid="daily-countdown"
          className="text-sm font-semibold text-slate-600 tabular-nums dark:text-slate-300"
        >
          New one in {formatCountdown(msUntilNextUtcDay(now))}
        </p>
      </div>
      <p className="mt-1 text-lg font-bold">{LEVELS[today.world].name}</p>
      <p className="font-semibold text-violet-800 dark:text-violet-200">
        <span aria-hidden="true">{twist.emoji} </span>
        {twist.name}
      </p>
      <p className="text-slate-600 dark:text-slate-300">{twist.blurb}</p>
      <p
        data-testid="daily-best"
        className="mt-2 font-semibold text-slate-800 dark:text-slate-100"
      >
        {bestToday === null
          ? "No time yet today. Reach the finish to set one!"
          : `Your best today: ${bestToday.toFixed(1)} s`}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => openDaily(now)}
          className={primaryButtonClass}
        >
          {bestToday === null ? "Fly today's challenge" : "Fly it again"}
        </button>
        {bestToday !== null ? (
          <ShareTimeButton
            card={{
              worldName: LEVELS[today.world].name,
              time: bestToday,
              nickname,
              planeTier: planeTierName(levels[today.world].tiers),
              twist,
            }}
          />
        ) : null}
        {leaderboardsEnabled && uid !== null ? (
          <button
            type="button"
            onClick={() => setIsBoardOpen(true)}
            className={secondaryButtonClass}
          >
            🏆 Daily board
          </button>
        ) : null}
      </div>
      {isBoardOpen && uid !== null ? (
        <Leaderboards
          uid={uid}
          initialTab="daily"
          onClose={() => setIsBoardOpen(false)}
        />
      ) : null}
    </section>
  );
}
