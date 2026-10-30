import type { CommitResult } from "@/lib/leaderboard/client";
import type { ShipBoardEntry } from "@/lib/leaderboard/shipBoard";
import { isChallengeId, starsFor } from "./definitions";
import { overallBests, totalStars, type ChallengeProgress } from "./progress";

/** The server allows a write every 10 s; stay clear of that. */
export const SUBMIT_INTERVAL_MS = 15_000;

/**
 * The most the total may rise in one write (three trials' worth); the
 * rules refuse a bigger jump. A bigger gap is climbed over several writes.
 */
export const MAX_STARS_PER_WRITE = 9;

export interface BoardSyncDeps {
  enabled: boolean;
  getProgress: () => ChallengeProgress;
  /** Gives the player a generated name the first time. */
  ensureNickname: () => string;
  submit: (entry: ShipBoardEntry) => Promise<CommitResult>;
  intervalMs?: number;
  now?: () => number;
}

export interface BoardSync {
  /** Asks for a submit: sent now if the interval has passed, else later. */
  request: () => void;
  /** Stops any waiting submit. */
  stop: () => void;
}

/** What goes on the board, or null while there are no stars to show. */
export function entryOf(
  progress: ChallengeProgress,
  nickname: string
): ShipBoardEntry | null {
  const stars = totalStars(progress);
  if (stars < 1) return null;
  return { nickname, totalStars: stars, bests: overallBests(progress) };
}

/**
 * The bests that may ride with a write whose total is `limit`: the rules
 * refuse a total below the stars its bests are worth, so when a climb sends a
 * small total, the bests that would not fit are left out until it catches up.
 * The most valuable ones stay.
 */
export function fitBests(
  bests: ShipBoardEntry["bests"],
  limit: number
): ShipBoardEntry["bests"] {
  const ranked = Object.entries(bests)
    .flatMap(([id, value]) =>
      isChallengeId(id) && typeof value === "number"
        ? [{ id, value, stars: starsFor(id, value) }]
        : []
    )
    .sort((a, b) => b.stars - a.stars);
  const fitted: Record<string, number> = {};
  let sum = 0;
  for (const best of ranked) {
    if (sum + best.stars > limit) continue;
    fitted[best.id] = best.value;
    sum += best.stars;
  }
  return fitted;
}

/**
 * Uploads the player's stars after they change: at most one write per
 * interval, the latest state riding a trailing one. Never throws.
 */
export function createBoardSync(deps: BoardSyncDeps): BoardSync {
  const intervalMs = deps.intervalMs ?? SUBMIT_INTERVAL_MS;
  const now = deps.now ?? Date.now;
  let lastSentAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** The total the server last accepted, or null until one is. */
  let accepted: number | null = null;
  /**
   * Refusals in a row of the full total. The rules refuse for a rate limit
   * as well as for a step bigger than the cap, and the two look the same,
   * so one refusal is retried in full; only a second one means the server
   * holds a lower total and the climb must go in steps.
   */
  let refusals = 0;

  /**
   * The total to send now. With a known base it steps up by at most
   * `MAX_STARS_PER_WRITE`. With none, the full total is sent, and only
   * repeated refusals (never a network error or a server blip) fall back to
   * a small total, which is always allowed, and the climb continues from it.
   */
  function totalToSend(target: number): number {
    if (accepted !== null) {
      return Math.min(target, accepted + MAX_STARS_PER_WRITE);
    }
    return refusals >= 2 ? Math.min(target, MAX_STARS_PER_WRITE) : target;
  }

  async function send(): Promise<void> {
    lastSentAt = now();
    try {
      const entry = entryOf(deps.getProgress(), deps.ensureNickname());
      if (!entry) return;
      const totalStars = totalToSend(entry.totalStars);
      // A climb's small total may be worth less than all the bests.
      const bests =
        totalStars < entry.totalStars
          ? fitBests(entry.bests, totalStars)
          : entry.bests;
      const result = await deps.submit({ ...entry, totalStars, bests });
      if (result === "ok") {
        refusals = 0;
        accepted = totalStars;
        if (totalStars < entry.totalStars) request();
      } else if (result === "refused") {
        refusals++;
        // Nothing else asks again before the next trial; retry (bounded).
        if (refusals <= 2) request();
      }
    } catch {
      // Retried by the next trial; the game never waits on the board.
    }
  }

  function request(): void {
    if (!deps.enabled || timer !== null) return;
    const wait = lastSentAt + intervalMs - now();
    if (wait <= 0) {
      void send();
      return;
    }
    // Read when the timer fires, so it carries the latest stars.
    timer = setTimeout(() => {
      timer = null;
      void send();
    }, wait);
  }

  function stop(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  return { request, stop };
}
