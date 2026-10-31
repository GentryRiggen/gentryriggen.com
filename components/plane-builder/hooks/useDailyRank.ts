"use client";

import { useEffect, useState } from "react";
import { getIdToken } from "@/lib/leaderboard/auth";
import { DAILY_BOARD_LIMIT, fetchDailyBoard } from "@/lib/leaderboard/daily";
import { standingOn } from "@/lib/leaderboard/rank";

interface Fetched {
  key: string;
  rank: number | null;
}

/**
 * The player's place on a day's top 20 with `myTime` (their best that day),
 * or null while loading, off the board, signed out, or on any failure. Does
 * nothing while `enabled` is false or `myTime` is null.
 */
export default function useDailyRank(
  enabled: boolean,
  date: string | null,
  myTime: number | null
): number | null {
  const isActive = enabled && date !== null && myTime !== null;
  const key = `${date}:${myTime}`;
  const [fetched, setFetched] = useState<Fetched | null>(null);

  useEffect(() => {
    if (!isActive || date === null || myTime === null) return;
    let isCancelled = false;
    const publish = (rank: number | null) => {
      if (!isCancelled) setFetched({ key: `${date}:${myTime}`, rank });
    };
    getIdToken()
      .then(async (session) => {
        if (!session) return publish(null);
        const rows = await fetchDailyBoard(date);
        if (!rows) return publish(null);
        const standing = standingOn(
          rows,
          session.uid,
          myTime,
          "asc",
          DAILY_BOARD_LIMIT
        );
        publish(standing.kind === "ranked" ? standing.rank : null);
      })
      .catch(() => publish(null));
    return () => {
      isCancelled = true;
    };
  }, [isActive, date, myTime]);

  return isActive && fetched?.key === key ? fetched.rank : null;
}
