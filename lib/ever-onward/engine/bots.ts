import type { Strategy } from "./sim";

/** The player personalities the scorecard plays a universe with. */
export interface BotSet {
  /** 3 taps a second all the time, shops every 10 s. The primary trace. */
  tapper: Strategy;
  /** 3 taps a second for the first 10 minutes of each phase, then 0.3. */
  realistic: Strategy;
  /**
   * Taps to get each machine going (the first 10 minutes of the run, the first
   * 5 of the next two phases, all of the last), then only watches. The doc's
   * literal version (tap 2 minutes, then never) is stuck forever in the first
   * phase of this universe, which says "the first minutes need hands", not
   * what idle play feels like later.
   */
  idle: Strategy;
  /** Buys oil (or its universe's consumable) only when it runs low. */
  naiveOil: Strategy;
  /** Buys oil only when it is cheap (or when the tank is nearly dry). */
  cheapskateOil: Strategy;
}

const MIN = 60;
const SHOP_EVERY = 10;
const BASE_TAPS = 3;
/** From this phase on the idle bot taps throughout (the ending is hands-on). */
const IDLE_HANDS_ON_PHASE = 3;

/** Bots with no hand-made actions: fine for a universe without a consumable. */
export function genericBots(): BotSet {
  const tapper: Strategy = { tapsPerSecond: BASE_TAPS, shopEvery: SHOP_EVERY };
  return {
    tapper,
    realistic: {
      shopEvery: SHOP_EVERY,
      tapRate: (run) => {
        const phaseStart = run.transitions.at(-1)?.at ?? 0;
        return run.time - phaseStart < 10 * MIN ? BASE_TAPS : 0.3;
      },
    },
    idle: {
      shopEvery: SHOP_EVERY,
      tapRate: (run) => {
        if (run.phase >= IDLE_HANDS_ON_PHASE) return BASE_TAPS;
        const phaseStart = run.transitions.at(-1)?.at ?? 0;
        const warmUp = run.phase === 0 ? 10 * MIN : 5 * MIN;
        return run.time - phaseStart < warmUp ? BASE_TAPS : 0;
      },
    },
    naiveOil: tapper,
    cheapskateOil: tapper,
  };
}
