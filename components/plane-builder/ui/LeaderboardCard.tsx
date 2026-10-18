"use client";

import { useEffect, useState } from "react";
import { LEADERBOARDS_ENABLED } from "@/lib/plane-builder/state/leaderboardSync";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import useLeaderboardStanding from "../hooks/useLeaderboardStanding";
import Leaderboards from "./Leaderboards";
import { focusRingClass } from "./styles";
import { formatKm, medalFor, prestigeOf } from "./standing";
import type { Standing } from "@/lib/leaderboard/rank";

export const LAST_RANK_KEY = "plane-builder:last-rank";

function readLastRank(): number | null {
  try {
    const value = Number(window.localStorage.getItem(LAST_RANK_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeLastRank(rank: number): void {
  try {
    window.localStorage.setItem(LAST_RANK_KEY, String(rank));
  } catch {
    // Private mode or blocked storage: the pill just won't show next time.
  }
}

interface Lines {
  headline: string;
  detail: string;
}

/** What the card says. Names are rendered as text by the caller. */
function linesFor(standing: Standing, myPrestige: number): Lines {
  if (standing.kind === "offBoard") {
    const needsPrestige = prestigeOf(standing.cutoff.value) > myPrestige;
    return {
      headline: "🏆 Join the top 50!",
      detail: needsPrestige
        ? "Prestige to reach the top 50!"
        : `Fly ${formatKm(standing.gap)} more to reach the top 50!`,
    };
  }
  const { rank, rival, gap } = standing;
  if (rival === null || gap === null) {
    return {
      headline: "🥇 You're the top pilot in the world! 👑",
      detail: "Keep flying to stay on top!",
    };
  }
  const headline = `${medalFor(rank) ?? "🏆"} You're #${rank} in the world!`;
  return {
    headline,
    detail:
      prestigeOf(rival.value) > myPrestige
        ? `Prestige to catch ${rival.nickname}`
        : `${formatKm(gap)} to pass ${rival.nickname}`,
  };
}

interface LeaderboardCardProps {
  /** Off in tests and e2e by default; see LEADERBOARDS_ENABLED. */
  enabled?: boolean;
}

/** The worlds list's world-rank card; opens the leaderboards when tapped. */
export default function LeaderboardCard({
  enabled = LEADERBOARDS_ENABLED,
}: LeaderboardCardProps) {
  const { uid, standing } = useLeaderboardStanding(enabled, null);
  const nickname = usePlaneBuilderStore((s) => s.progress.nickname);
  const myPrestige = usePlaneBuilderStore((s) => s.progress.prestige.level);
  const [isOpen, setIsOpen] = useState(false);
  const [upBy, setUpBy] = useState<number | null>(null);
  const rank = standing?.kind === "ranked" ? standing.rank : null;

  // Remember the last rank shown so a climb can be celebrated.
  useEffect(() => {
    if (rank === null) return;
    const last = readLastRank();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (last !== null && rank < last) setUpBy(last - rank);
    writeLastRank(rank);
  }, [rank]);

  if (!enabled || uid === null) return null;

  const lines = standing ? linesFor(standing, myPrestige) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`flex min-h-28 w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-200 p-4 text-left text-amber-950 shadow-lg ring-2 ring-amber-400 hover:from-amber-200 hover:to-yellow-100 dark:from-amber-500 dark:to-yellow-400 dark:hover:from-amber-400 dark:hover:to-yellow-300 dark:ring-amber-300 ${focusRingClass}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold">
            {lines ? lines.headline : "See who's flying 🏆"}
          </span>
          {lines ? (
            <span className="block font-semibold">{lines.detail}</span>
          ) : null}
          <span className="block truncate text-sm font-medium">
            {nickname
              ? `Flying as ${nickname}`
              : "Tap to pick your pilot name and join in!"}
          </span>
        </span>
        {upBy !== null ? (
          <span className="pb-pop shrink-0 rounded-full bg-emerald-600 px-3 py-1 text-sm font-extrabold text-white dark:bg-emerald-300 dark:text-emerald-950">
            ▲ up {upBy}!
          </span>
        ) : null}
      </button>
      {isOpen ? (
        <Leaderboards uid={uid} onClose={() => setIsOpen(false)} />
      ) : null}
    </>
  );
}
