"use client";

import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getIdToken } from "@/lib/leaderboard/auth";
import { standingOn } from "@/lib/leaderboard/rank";
import { fetchShipBoard } from "@/lib/leaderboard/shipBoard";
import type { LeaderboardRow } from "@/lib/leaderboard/types";
import { totalStars } from "@/lib/ship-builder/challenges/progress";
import { challengeProgress } from "../hooks/challengeProgress";
import { SHIP_BOARD_ENABLED } from "../hooks/shipBoardSync";

/** How many players the board shows; your own rank is added below. */
export const BOARD_SHOWN = 20;

type Load =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; uid: string; rows: LeaderboardRow[] };

interface ShipLeaderboardProps {
  /** Off in tests and e2e by default; see SHIP_BOARD_ENABLED. */
  enabled?: boolean;
}

/** Top players by total stars, plus where you stand. Names are text only. */
export default function ShipLeaderboard({
  enabled = SHIP_BOARD_ENABLED,
}: ShipLeaderboardProps) {
  const progress = challengeProgress.useValue();
  const myStars = totalStars(progress);
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let isCancelled = false;
    const publish = (next: Load) => {
      if (!isCancelled) setLoad(next);
    };
    getIdToken()
      .then(async (session) => {
        const rows = session ? await fetchShipBoard() : null;
        publish(
          session && rows
            ? { status: "ready", uid: session.uid, rows }
            : { status: "failed" }
        );
      })
      .catch(() => publish({ status: "failed" }));
    return () => {
      isCancelled = true;
    };
  }, [enabled]);

  const standing = useMemo(
    () =>
      load.status === "ready" && myStars > 0
        ? standingOn(load.rows, load.uid, myStars, "desc")
        : null,
    [load, myStars]
  );

  if (!enabled) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        The leaderboard is switched off here.
      </p>
    );
  }
  if (load.status === "loading") {
    return (
      <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
        Loading the leaderboard…
      </p>
    );
  }
  if (load.status === "failed") {
    return (
      <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
        Couldn&apos;t reach the leaderboard. Try again later.
      </p>
    );
  }

  const mine = load.uid;
  const shown = load.rows.slice(0, BOARD_SHOWN);
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium" data-testid="ship-board-standing">
        {myStars === 0
          ? "Earn a star to join the board."
          : standing?.kind === "ranked"
            ? `You are #${standing.rank} with ${myStars} ${myStars === 1 ? "star" : "stars"}.`
            : standing
              ? `Keep going! Reach ${standing.cutoff.value} stars to get on the board.`
              : null}
        {progress.nickname && myStars > 0
          ? ` Sailing as ${progress.nickname}.`
          : null}
      </p>
      {shown.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No one is on the board yet. Be the first!
        </p>
      ) : (
        <ol className="max-h-72 space-y-1 overflow-y-auto">
          {shown.map((row, index) => (
            <li
              key={row.uid}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                row.uid === mine
                  ? "bg-sky-50 font-semibold dark:bg-sky-950"
                  : "border border-slate-200 dark:border-slate-800"
              }`}
            >
              <span className="w-6 shrink-0 text-right tabular-nums text-slate-500 dark:text-slate-400">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{row.nickname}</span>
              <span className="shrink-0 tabular-nums">
                {row.value}
                <span className="sr-only"> stars</span>
              </span>
              <Star
                aria-hidden="true"
                className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500 dark:fill-amber-300 dark:text-amber-300"
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
