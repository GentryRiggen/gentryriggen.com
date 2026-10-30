import type { ShipBoardEntry } from "@/lib/leaderboard/shipBoard";
import { overallBests, totalStars, type ChallengeProgress } from "./progress";

/** The server allows a write every 10 s; stay clear of that. */
export const SUBMIT_INTERVAL_MS = 15_000;

/**
 * The most the total may rise in one write (one design's maximum); the
 * rules refuse a bigger jump. A bigger gap is climbed over several writes.
 */
export const MAX_STARS_PER_WRITE = 9;

export interface BoardSyncDeps {
  enabled: boolean;
  getProgress: () => ChallengeProgress;
  /** Gives the player a generated name the first time. */
  ensureNickname: () => string;
  submit: (entry: ShipBoardEntry) => Promise<boolean>;
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
  let hasFailed = false;

  /**
   * The total to send now. With a known base it steps up by at most
   * `MAX_STARS_PER_WRITE`. With none, the full total is tried first; if that
   * was refused (the server may hold a lower total), a small one is sent,
   * which is always allowed, and the climb continues from there.
   */
  function totalToSend(target: number): number {
    if (accepted !== null) {
      return Math.min(target, accepted + MAX_STARS_PER_WRITE);
    }
    return hasFailed ? Math.min(target, MAX_STARS_PER_WRITE) : target;
  }

  async function send(): Promise<void> {
    lastSentAt = now();
    try {
      const entry = entryOf(deps.getProgress(), deps.ensureNickname());
      if (!entry) return;
      const totalStars = totalToSend(entry.totalStars);
      if (await deps.submit({ ...entry, totalStars })) {
        accepted = totalStars;
        if (totalStars < entry.totalStars) request();
      } else {
        hasFailed = true;
      }
    } catch {
      hasFailed = true;
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
