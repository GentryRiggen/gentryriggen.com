import { isExcluded } from "./exclude";
import { LOCAL_HOSTS } from "./event";
import {
  buildGameEvent,
  GAME_EVENTS,
  MAX_EVENTS_PER_PAGE_LOAD,
  type GameEvent,
  type GameEventName,
  type GameEventProps,
} from "./gameEvents";
import { sendGameEvent } from "./gameSend";
import { safeLocalStorage, type KeyValueStorage } from "./storage";
import { isBot } from "./ua";

export interface TrackEnv {
  hostname: string;
  userAgent: string;
  webdriver: boolean;
  isProduction: boolean;
  storage: KeyValueStorage | null;
}

/** Same skips as pageviews: dev builds, localhost, the owner, and bots. */
export function canTrack(env: TrackEnv): boolean {
  if (!env.isProduction) return false;
  if (LOCAL_HOSTS.has(env.hostname)) return false;
  if (isExcluded(env.storage)) return false;
  return !isBot(env.userAgent, env.webdriver);
}

/**
 * Decides whether this occurrence should be sent: sampling for high-volume
 * events, and a cap on events per page load. `random` is injectable for tests.
 */
export function createGameTracker({
  send,
  canSend,
  random = Math.random,
  cap = MAX_EVENTS_PER_PAGE_LOAD,
}: {
  send: (event: GameEvent, flush: boolean) => unknown;
  canSend: () => boolean;
  random?: () => number;
  cap?: number;
}) {
  let used = 0;
  return function track<N extends GameEventName>(
    name: N,
    props: GameEventProps<N>,
    flush = false
  ): void {
    try {
      if (used >= cap || !canSend()) return;
      if (random() >= GAME_EVENTS[name].sample) return;
      const event = buildGameEvent(name, props);
      if (!event) return;
      used += 1;
      void send(event, flush);
    } catch {
      // Analytics must never break the game.
    }
  };
}

const tracker = createGameTracker({
  send: (event, flush) => sendGameEvent(event, { cachedAppCheckOnly: flush }),
  canSend: () =>
    typeof window !== "undefined" &&
    canTrack({
      hostname: window.location.hostname,
      userAgent: navigator.userAgent,
      webdriver: navigator.webdriver === true,
      isProduction: process.env.NODE_ENV === "production",
      storage: safeLocalStorage(),
    }),
});

/**
 * Records one anonymous gameplay event. The one call games make: a no-op in
 * dev and e2e, for bots and for the signed-in owner; sampled, capped per page
 * load, never throws and never waits.
 */
export function trackGame<N extends GameEventName>(
  name: N,
  props: GameEventProps<N>,
  /** True on page hide: the send may only use an already-cached App Check token. */
  flush = false
): void {
  tracker(name, props, flush);
}
