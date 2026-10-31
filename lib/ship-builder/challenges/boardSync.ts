import type { CommitResult } from "@/lib/leaderboard/client";
import { FIRST_SEASON, type SeasonInfo } from "@/lib/leaderboard/season";
import type { OwnShipEntry, ShipBoardEntry } from "@/lib/leaderboard/shipBoard";
import { isChallengeId, starsFor } from "./definitions";
import { overallBests, totalStars, type ChallengeProgress } from "./progress";

/** The server allows a write every 10 s; stay clear of that. */
export const SUBMIT_INTERVAL_MS = 15_000;

/**
 * The most the total may rise in one write (three trials' worth); the
 * rules refuse a bigger jump. A bigger gap is climbed over several writes.
 */
export const MAX_STARS_PER_WRITE = 9;

/** The season is read again before a submit once the last read is this old. */
export const SEASON_READ_MS = 10 * 60_000;

/**
 * The most a first write in a season may hold (firestore.rules,
 * validShipCreate and shipSeasonCreate): 60 stars, and early in a season no
 * more than 6 plus one per 5 seconds since it began.
 */
export const CREATE_MAX_STARS = 60;

/** The most a season's first write may hold `secsSinceStart` seconds in. */
export function firstWriteMax(secsSinceStart: number | null): number {
  if (secsSinceStart === null) return CREATE_MAX_STARS;
  return Math.min(
    CREATE_MAX_STARS,
    Math.floor(6 + Math.max(0, secsSinceStart) / 5)
  );
}

export interface BoardSyncDeps {
  enabled: boolean;
  getProgress: () => ChallengeProgress;
  /** Gives the player a generated name the first time. */
  ensureNickname: () => string;
  submit: (entry: ShipBoardEntry, season: number) => Promise<CommitResult>;
  /** The current season, or null when it can't be read. */
  readSeason: () => Promise<SeasonInfo | null>;
  /** The player's entry in a season, "missing", or null if it can't be read. */
  readOwnEntry: (season: number) => Promise<OwnShipEntry | "missing" | null>;
  /** Hears every season read (the stars move into a newer one). */
  onSeason?: (season: number) => void;
  /** The name the save loaded with, before this session changed it. */
  loadedNickname: () => string | null;
  /** Takes a name the admin gave the board entry. */
  setNickname: (nickname: string) => void;
  intervalMs?: number;
  now?: () => number;
}

export interface BoardSync {
  /** Asks for a submit: sent now if the interval has passed, else later. */
  request: () => void;
  /** Reads the season now, so a newer one resets the stars before play. */
  start: () => void;
  /** Stops any waiting submit. */
  stop: () => void;
}

/**
 * What goes on the board, or null while there are no stars to show: this
 * season's stars only (the all-time ones stay in the game).
 */
export function entryOf(
  progress: ChallengeProgress,
  nickname: string
): ShipBoardEntry | null {
  const season = { ...progress, designs: progress.season.designs };
  const stars = totalStars(season);
  if (stars < 1) return null;
  return { nickname, totalStars: stars, bests: overallBests(season) };
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
 * Uploads the player's season stars after they change: at most one write per
 * interval, the latest state riding a trailing one. Never writes without a
 * season read, and never to season 1 (frozen). Never throws.
 */
export function createBoardSync(deps: BoardSyncDeps): BoardSync {
  const intervalMs = deps.intervalMs ?? SUBMIT_INTERVAL_MS;
  const now = deps.now ?? Date.now;
  let lastSentAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let season: number | null = null;
  let seasonReadAt = Number.NEGATIVE_INFINITY;
  let seasonRead: Promise<number | null> | null = null;
  /** When the current season began (ms), if known. */
  let seasonStartedAt: number | null = null;
  /**
   * The name this client last saw on the board (sent or adopted) this
   * visit; undefined until then, when the save's loaded name stands in.
   */
  let lastSentName: string | null | undefined = undefined;
  /** The total the server last accepted in `season`, or null until one is. */
  let accepted: number | null = null;
  /**
   * Refusals in a row of the full total while the board entry can't be read.
   * The rules refuse for a rate limit as well as for a step bigger than the
   * cap, and the two look the same, so one refusal is retried in full; only
   * a second one means the server holds a lower total and the climb must go
   * in steps.
   */
  let refusals = 0;

  /** The current season, read again when the last read is stale. */
  function currentSeason(): Promise<number | null> {
    if (season !== null && now() - seasonReadAt < SEASON_READ_MS) {
      return Promise.resolve(season);
    }
    seasonRead ??= deps
      .readSeason()
      .catch(() => null)
      .then((info) => {
        seasonRead = null;
        // A failed re-read keeps the season last read; none read means none.
        if (info === null) return season;
        if (info.number !== season) {
          // A new season's board starts empty: the climb starts over.
          accepted = null;
          refusals = 0;
        }
        season = info.number;
        seasonStartedAt = info.startedAt?.getTime() ?? null;
        seasonReadAt = now();
        deps.onSeason?.(info.number);
        return season;
      });
    return seasonRead;
  }

  /** Takes a name the admin gave the entry; never a name not yet sent. */
  function adoptName(onBoard: string): void {
    const known =
      lastSentName === undefined ? deps.loadedNickname() : lastSentName;
    if (onBoard === known) return;
    lastSentName = onBoard;
    deps.setNickname(onBoard);
  }

  /**
   * The total to send now. With no entry on the board, a first write's cap
   * applies (`createMax`). With a known base (the board's total, or the last
   * one accepted) it steps up by at most `MAX_STARS_PER_WRITE`. With neither,
   * the full total is sent, and only repeated refusals (never a network
   * error or a server blip) fall back to a small total, which is always
   * allowed, and the climb continues from it.
   */
  function totalToSend(
    target: number,
    own: OwnShipEntry | "missing" | null,
    createMax: number
  ): number {
    if (own === "missing") return Math.min(target, createMax);
    const base = own !== null ? own.totalStars : accepted;
    if (base !== null) return Math.min(target, base + MAX_STARS_PER_WRITE);
    return refusals >= 2
      ? Math.min(target, MAX_STARS_PER_WRITE, createMax)
      : target;
  }

  async function send(): Promise<void> {
    lastSentAt = now();
    try {
      const n = await currentSeason();
      // No season known means no write (never guess); season 1 is frozen.
      if (n === null || n <= FIRST_SEASON) return;
      const own = await deps.readOwnEntry(n);
      if (own !== null && own !== "missing") adoptName(own.nickname);
      const entry = entryOf(deps.getProgress(), deps.ensureNickname());
      if (!entry) return;
      const createMax = firstWriteMax(
        seasonStartedAt === null ? null : (now() - seasonStartedAt) / 1000
      );
      const totalStars = totalToSend(entry.totalStars, own, createMax);
      // A climb's small total may be worth less than all the bests.
      const bests =
        totalStars < entry.totalStars
          ? fitBests(entry.bests, totalStars)
          : entry.bests;
      const result = await deps.submit({ ...entry, totalStars, bests }, n);
      // A season that changed while this write was out has its own climb.
      if (n !== season) return;
      if (result === "ok") {
        refusals = 0;
        accepted = totalStars;
        lastSentName = entry.nickname;
        if (totalStars < entry.totalStars) request();
      } else if (result === "refused") {
        refusals++;
        // The season may have moved on; check before the next write.
        seasonReadAt = Number.NEGATIVE_INFINITY;
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

  function start(): void {
    if (!deps.enabled) return;
    void currentSeason();
  }

  function stop(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  return { request, start, stop };
}
