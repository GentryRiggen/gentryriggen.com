"use client";

import { useEffect, useMemo, useState } from "react";
import { getIdToken } from "@/lib/leaderboard/auth";
import { fetchBoard } from "@/lib/leaderboard/client";
import { FIRST_SEASON } from "@/lib/leaderboard/season";
import { standingOn } from "@/lib/leaderboard/rank";
import type { Standing } from "@/lib/leaderboard/rank";
import { scoreFor } from "@/lib/leaderboard/types";
import type { BoardKind, LeaderboardRow } from "@/lib/leaderboard/types";
import type { LevelId } from "@/lib/plane-builder/levels/types";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";

export interface LeaderboardStanding {
  /** Known as soon as sign-in resolves; null while waiting or with no token. */
  uid: string | null;
  /** Null unless the board loaded and the player has a value on it. */
  standing: Standing | null;
}

interface Fetched {
  key: string;
  uid: string | null;
  /** Undefined while the board is still loading, null if it failed. */
  rows: LeaderboardRow[] | null | undefined;
}

/**
 * Where the player stands on the prestige board (`world` null) or on a
 * world's best-time board. Fetches once per board; the standing is recomputed
 * from the player's current local value, so it is right before the throttled
 * upload lands. Does nothing while `enabled` is false.
 */
export default function useLeaderboardStanding(
  enabled: boolean,
  world: LevelId | null
): LeaderboardStanding {
  const myValue = usePlaneBuilderStore((s) =>
    world === null
      ? scoreFor(s.progress.prestige.level, s.progress.lifetimeDistance)
      : (s.progress.bestTimes[world] ?? null)
  );
  const [fetched, setFetched] = useState<Fetched | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let isCancelled = false;
    const key = world ?? "prestige";
    const kind: BoardKind = world === null ? "prestige" : { world };
    const publish = (uid: string | null, rows: Fetched["rows"]) => {
      if (!isCancelled) setFetched({ key, uid, rows });
    };
    getIdToken()
      .then(async (session) => {
        if (!session) return publish(null, null);
        publish(session.uid, undefined);
        const rows = await fetchBoard(kind, FIRST_SEASON);
        publish(session.uid, rows ?? null);
      })
      .catch(() => publish(null, null));
    return () => {
      isCancelled = true;
    };
  }, [enabled, world]);

  const key = world ?? "prestige";
  const current = enabled && fetched?.key === key ? fetched : null;
  const uid = current?.uid ?? null;
  const rows = current?.rows ?? null;

  const standing = useMemo(
    () =>
      rows !== null && uid !== null && myValue !== null
        ? standingOn(rows, uid, myValue, world === null ? "desc" : "asc")
        : null,
    [rows, uid, myValue, world]
  );

  return { uid, standing };
}
