/** Every balance number for Make Everyone Smile, in one place. */
export interface PhaseTuning {
  /** What one tap earns before any bonus. */
  tap: number;
  /** What each helper line earns every second before any bonus, by line. */
  lines: readonly number[];
  /** Each scaling level adds this share to taps and helpers alike. */
  scalePer: number;
}

export const TUNING = {
  /** Every level of a helper line multiplies its output by this (see `stacked`). */
  stackGrowth: 1.55,
  /** Every upgrade's price in a phase is multiplied by this. */
  costSteepness: [1.0, 1.0, 1.0, 1.0] as readonly number[],
  costScale: [1, 1, 1, 1] as readonly number[],
  /** By phase index. */
  phases: [
    { tap: 1.2, lines: [0.6, 3.9, 25, 165], scalePer: 0.6 },
    { tap: 6, lines: [3, 19.5, 127, 825], scalePer: 0.6 },
    { tap: 80, lines: [40, 260, 1690, 11000], scalePer: 0.6 },
    { tap: 1, lines: [0.5, 3.25, 21, 137], scalePer: 0.6 },
  ] as readonly PhaseTuning[],
  /** Leftover currency carried into the next phase (friend, town, world). */
  carry: [0.002, 0.00003, 0] as readonly number[],
  /**
   * The friendship bank (friend): keep a share of the smiles back and the
   * friendship grows, so every later laugh is bigger. It fades a little.
   */
  bond: {
    shares: [0, 0.25, 0.5] as readonly number[],
    maxGain: 2.5,
    halfSeconds: 100,
    fadePerSecond: 1 / 240,
    referenceTaps: 2,
  },
  /**
   * The cheer meter (town and world): taps and parades heat it, rest cools
   * it. Past full the crowd is worn out and pays less until it has rested.
   */
  meter: {
    heatPerTap: 0.012,
    paradeHeat: 0.02,
    coolPerSecond: 0.05,
    /** Each bench (or mask booth) cools this much faster per level. */
    coolPerLevel: 1.6,
    tiredAt: 1,
    restedAt: 0.4,
    tiredMult: 0.6,
    /** A parade needs the meter at or under this. */
    paradeMaxHeat: 0.6,
  },
  /** Know-how (town and world): projects and parades both want it. */
  knowhow: {
    perLevel: 0.05,
    worldRate: 2.5,
    paradeCost: 25,
    paradeSeconds: 45,
    /** After a parade the crowd rests this long before the next one. */
    paradeRest: 20,
    paradeMult: 2,
    costs: [30, 70, 160] as readonly number[],
    coolMult: 2,
    bigTopMult: 1.5,
    allMult: 2,
    spreadMult: 2,
  },
  /** Forks: one either-or choice per phase (prices are before costScale). */
  forks: {
    friend: { cost: 60, jokesTap: 4, jokesBond: 0.6, kindHelpers: 1.2 },
    town: {
      cost: 3000,
      clownTap: 3,
      clownHeat: 1.25,
      factoryHelpers: 1.6,
      factoryParade: 1.5,
    },
    world: {
      cost: 8000,
      speakerHelpers: 2,
      speakerCool: 0.7,
      boxHelpers: 2.4,
      boxCool: 1.5,
    },
    quiet: { cost: 15, wordsTap: 4, silenceHelpers: 1.8 },
  },
  /** The friend's wants in the quiet. */
  quiet: {
    growthPerPatience: 2e-5,
    firstWaitSeconds: 15,
    restSeconds: 25,
    matchSeconds: 12,
    otherSeconds: 4,
    kettleDelay: 30,
    kettleShare: 0.5,
    kettleAfterAnswers: 4,
    benchBoost: 1,
  },
  /** The puppy's ball: rest between throws, and seconds of laugh a throw pays. */
  fetch: { restSeconds: 30, seconds: 15 },
  headStartSeconds: 20,
} as const;
