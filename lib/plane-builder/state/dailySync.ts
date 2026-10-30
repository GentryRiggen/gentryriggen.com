import { useEffect } from "react";
import { submitDaily, type DailyEntry } from "@/lib/leaderboard/daily";
import { randomNickname } from "@/lib/leaderboard/nickname";
import { dailyFor, utcDateKey } from "../daily/daily";
import { LEADERBOARDS_ENABLED } from "./leaderboardSync";
import { usePlaneBuilderStore } from "./store";

export interface DailySyncDeps {
  enabled?: boolean;
  submit?: (date: string, entry: DailyEntry) => Promise<boolean>;
  now?: () => number;
}

/** The entry for the player's stored daily best, or null if there is none. */
function currentDailyEntry(): { date: string; entry: DailyEntry } | null {
  const store = usePlaneBuilderStore.getState();
  const best = store.progress.dailyBest;
  if (!best) return null;
  if (store.progress.nickname === null) store.setNickname(randomNickname());
  const nickname = usePlaneBuilderStore.getState().progress.nickname ?? "";
  return {
    date: best.date,
    entry: { nickname, world: dailyFor(best.date).world, time: best.time },
  };
}

/**
 * Sends the player's daily best to the day's board when it improves, and once
 * at start (an earlier send may have failed offline). Only a best set today
 * or yesterday is sent: the rules refuse older days.
 */
export function startDailySync(deps: DailySyncDeps = {}): () => void {
  const enabled = deps.enabled ?? LEADERBOARDS_ENABLED;
  if (!enabled) return () => {};
  const submit = deps.submit ?? ((date, entry) => submitDaily(date, entry));
  const now = deps.now ?? Date.now;

  const send = async (): Promise<void> => {
    const current = currentDailyEntry();
    if (!current) return;
    const today = utcDateKey(now());
    const yesterday = utcDateKey(now() - 86_400_000);
    if (current.date !== today && current.date !== yesterday) return;
    try {
      await submit(current.date, current.entry);
    } catch {
      // The next improvement or visit tries again; never bother the game.
    }
  };

  void send();
  return usePlaneBuilderStore.subscribe((state, prev) => {
    if (state.progress.dailyBest !== prev.progress.dailyBest) void send();
  });
}

/** Mount once in PlaneBuilder, after the save is loaded. */
export function useDailySync(): void {
  useEffect(() => startDailySync(), []);
}
