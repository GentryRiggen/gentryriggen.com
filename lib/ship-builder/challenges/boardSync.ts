import type { ShipBoardEntry } from "@/lib/leaderboard/shipBoard";
import { overallBests, totalStars, type ChallengeProgress } from "./progress";

/** The server allows a write every 10 s; stay clear of that. */
export const SUBMIT_INTERVAL_MS = 15_000;

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

  async function send(): Promise<void> {
    lastSentAt = now();
    try {
      const entry = entryOf(deps.getProgress(), deps.ensureNickname());
      if (entry) await deps.submit(entry);
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
