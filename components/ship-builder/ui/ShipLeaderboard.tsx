"use client";

import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getIdToken } from "@/lib/leaderboard/auth";
import { standingOn } from "@/lib/leaderboard/rank";
import { fetchShipBoard } from "@/lib/leaderboard/shipBoard";
import type { LeaderboardRow } from "@/lib/leaderboard/types";
import { entryOf } from "@/lib/ship-builder/challenges/boardSync";
import { challengeProgress } from "@/lib/ship-builder/challenges/progressStore";
import SeasonPicker from "@/components/leaderboard/SeasonPicker";
import {
  SHIP_BOARD_ENABLED,
  refreshShipSeason,
  useShipSeason,
} from "../hooks/shipBoardSync";

/** How many players the board shows; your own rank is added below. */
export const BOARD_SHOWN = 20;

type Load =
  | { status: "loading" }
  | { status: "failed"; season: number }
  | { status: "ready"; season: number; uid: string; rows: LeaderboardRow[] };

interface ShipLeaderboardProps {
  /** Off in tests and e2e by default; see SHIP_BOARD_ENABLED. */
  enabled?: boolean;
}

/**
 * Top players by this season's stars (or a past season's, picked), plus where
 * you stand this season. Names are text only.
 */
export default function ShipLeaderboard({
  enabled = SHIP_BOARD_ENABLED,
}: ShipLeaderboardProps) {
  const progress = challengeProgress.useValue();
  const myStars = entryOf(progress, "")?.totalStars ?? 0;
  const { current, isNewSeason, dismissNewSeason } = useShipSeason();
  /** A past season the player picked; null follows the current one. */
  const [picked, setPicked] = useState<number | null>(null);
  const season = picked ?? current;
  const isPast = season !== current;
  const [fetched, setFetched] = useState<Load>({ status: "loading" });
  /** The season read on open failed, and none was known before it. */
  const [isSeasonUnreachable, setIsSeasonUnreachable] = useState(false);

  // Read the season again on open: a missed first read or a season started
  // during this visit shows now, not on the next submit.
  useEffect(() => {
    if (!enabled) return;
    let isCancelled = false;
    refreshShipSeason()
      .then((n) => {
        if (!isCancelled) setIsSeasonUnreachable(n === null);
      })
      .catch(() => {
        if (!isCancelled) setIsSeasonUnreachable(true);
      });
    return () => {
      isCancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    // The board waits for the season (read when Ship Builder starts).
    if (!enabled || season === null) return;
    let isCancelled = false;
    const publish = (next: Load) => {
      if (!isCancelled) setFetched(next);
    };
    getIdToken()
      .then(async (session) => {
        const rows = session ? await fetchShipBoard(season) : null;
        publish(
          session && rows
            ? { status: "ready", season, uid: session.uid, rows }
            : { status: "failed", season }
        );
      })
      .catch(() => publish({ status: "failed", season }));
    return () => {
      isCancelled = true;
    };
  }, [enabled, season]);

  // Data for another season is stale: treat it as still loading.
  const load = useMemo<Load>(
    () =>
      fetched.status !== "loading" && fetched.season === season
        ? fetched
        : { status: "loading" },
    [fetched, season]
  );

  const standing = useMemo(
    () =>
      load.status === "ready" && !isPast && myStars > 0
        ? standingOn(load.rows, load.uid, myStars, "desc")
        : null,
    [load, isPast, myStars]
  );

  if (!enabled) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        The leaderboard is switched off here.
      </p>
    );
  }
  if (current === null) {
    if (isSeasonUnreachable) {
      return (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          Couldn&apos;t reach the leaderboard. Try again later.
        </p>
      );
    }
    return (
      <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
        Loading the leaderboard…
      </p>
    );
  }

  const shown = load.status === "ready" ? load.rows.slice(0, BOARD_SHOWN) : [];
  return (
    <div className="space-y-3">
      {isNewSeason ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-emerald-50 p-2 text-sm font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
        >
          <p>
            New season! Everyone starts from zero. Earn stars to get on the
            board.
          </p>
          <button
            type="button"
            onClick={dismissNewSeason}
            className="min-h-11 rounded-md border border-emerald-300 bg-white px-3 font-semibold text-emerald-900 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-50 dark:hover:bg-emerald-800 dark:focus-visible:ring-sky-400"
          >
            Got it
          </button>
        </div>
      ) : null}
      <SeasonPicker
        current={current}
        value={season ?? current}
        onChange={(n) => setPicked(n === current ? null : n)}
      />
      {load.status === "loading" ? (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          Loading the leaderboard…
        </p>
      ) : load.status === "failed" ? (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          Couldn&apos;t reach the leaderboard. Try again later.
        </p>
      ) : (
        <>
          {isPast ? null : (
            <p
              className="text-sm font-medium"
              data-testid="ship-board-standing"
            >
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
          )}
          {shown.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No one is on the board yet. Be the first!
            </p>
          ) : (
            <ol className="max-h-72 space-y-1 overflow-y-auto">
              {shown.map((row, index) => (
                <li
                  key={row.uid}
                  data-own={row.uid === load.uid ? "true" : undefined}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                    row.uid === load.uid
                      ? "bg-sky-50 font-semibold dark:bg-sky-950"
                      : "border border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <span className="w-6 shrink-0 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {row.nickname}
                  </span>
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
        </>
      )}
    </div>
  );
}
