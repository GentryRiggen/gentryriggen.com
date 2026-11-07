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
    { tap: 62.5, lines: [31.2, 203, 1320, 8590], scalePer: 0.6 },
    { tap: 1, lines: [0.5, 3.25, 21, 137], scalePer: 0.6 },
  ] as readonly PhaseTuning[],
  /** Leftover currency carried into the next phase (friend, town, world). */
  carry: [0.002, 0.00003, 0] as readonly number[],
  /**
   * What you do together (friend). Three things to do, by index: jokes, games
   * (the puppy's fetch lives here) and listening. Each pays smiles now (`pay`)
   * and builds a bond (`bondRate`) that makes every laugh bigger. Whatever you
   * keep doing wears thin (`wearSeconds` to fully worn, `wearDepth` of the pay
   * lost) and recovers while you do something else. The friend needs one of the
   * three at a time (`dwell` seconds each); their face hints at it (`firmAt`
   * seconds in, the hint is right `hintRight` of the time). Right pays
   * `rightMult`, wrong `wrongMult`.
   */
  together: {
    pay: [1.8, 1.1, 0] as readonly number[],
    bondRate: [0, 0.005, 0.02] as readonly number[],
    wearSeconds: [40, 70, 100] as readonly number[],
    recoverSeconds: 60,
    wearDepth: 0.5,
    thinAt: 0.8,
    switchSeconds: 5,
    switchPay: 0.35,
    maxGain: 2.2,
    fadePerSecond: 1 / 200,
    rightMult: 1.6,
    wrongMult: 0.45,
    dwell: [45, 90] as readonly number[],
    firmAt: [0, 10, 25] as readonly number[],
    hintRight: [0.45, 0.75, 0.95] as readonly number[],
    burstSeconds: 14,
    showSeconds: 4,
  },
  /**
   * The world's dial: real smiles and painted smiles. The loudspeakers have
   * five levels. A louder one pays more grins (`pay`) and paints real smiles
   * over faster (`pressure`, a share of the crowd a second), a quieter one
   * pays less and lets real smiles come back (`heal`). The real share never
   * drops under `floor`. Retuning takes `retuneSeconds` and pays `retunePay`
   * meanwhile. Days move the best level: a festival (noise is welcome: levels
   * from `loudFrom` pay `festivalPay`, painting is `festivalPaint`), a gloomy
   * week (`gloomPaint` as much painting) and noise-weary crowds (levels from
   * `loudFrom` pay `wearyPay`). Projects: some are cheap in grins and cost
   * real smiles (`drift` is painting a second whatever the level, `loss` is
   * painted at once), some protect or restore them.
   */
  world: {
    startLevel: 2,
    pay: [0.55, 0.8, 1, 1.35, 1.8] as readonly number[],
    pressure: [0, 0, 0.0007, 0.0016, 0.004] as readonly number[],
    heal: [0.002, 0.0009, 0, 0, 0] as readonly number[],
    floor: 0.03,
    retuneSeconds: 6,
    retunePay: 0.5,
    loudFrom: 3,
    dayKinds: [0.35, 0.6] as readonly number[],
    daySeconds: [60, 90] as readonly number[],
    calmSeconds: [12, 30] as readonly number[],
    firstDay: 45,
    festivalPay: 1.3,
    festivalPaint: 0.5,
    gloomPaint: 2,
    wearyPay: 0.25,
    broadcastPaint: 1.6,
    maskPay: 0.15,
    maskPaint: 0.15,
    quietHoursPaint: 0.5,
    quietHoursPay: 0.9,
    filtersPay: 1.25,
    filtersDrift: 0.0004,
    guideLoss: 0.1,
    dronesPay: 2.2,
    dronesDrift: 0.0015,
    dronesLoss: 0.3,
    benchesPay: 0.95,
    benchesHeal: 0.0004,
    benchesGain: 0.2,
    momentGap: 8,
    showSeconds: 4.5,
    /** The Quiet opens with this share of the trust bar for all real smiles kept. */
    quietHeadStart: 0.6,
  },
  /**
   * The town's two dials. The lemonade stand: five prices (free to pricey);
   * `crowdSlope` is the share of the town each step up loses, so a higher
   * price brings fewer people, and `thirst` moves the whole curve (a hot day
   * lifts it, rain drops it). Coins come from the crowd times the price;
   * cheers get `cheerBase` plus `cheerSpan` of the crowd. Changing the price
   * repaints the sign (`repaintSeconds`) and the crowd stays away meanwhile
   * (`repaintCrowd`). The parade route: floats cheer a street, and `1 -
   * careDecay ^ floats` of it is cheered (each float after the first is worth
   * less); a street left behind drifts to grumpy at `fall`, and cheers up at
   * `rise`. The route pays `routeBase` plus `routeSpan` of the weighted
   * mood, and every grumpy street takes `grumpyDrag` off all of it. Moving a
   * float takes `moveSeconds`. Days bring hot weather, rain on one street or
   * a party in one.
   */
  town: {
    prices: 5,
    crowdSlope: 0.22,
    minCrowd: 0.04,
    priceWeight: [0, 1, 2.2, 3.6, 5.5] as readonly number[],
    coinPerLevel: 0.04,
    cheerBase: 0.51,
    cheerSpan: 0.9,
    repaintSeconds: 6,
    repaintCrowd: 0.4,
    streetWeights: [0.34, 0.28, 0.22, 0.16] as readonly number[],
    careDecay: 0.75,
    rise: 0.05,
    fall: 0.02,
    grumpyAt: 0.25,
    routeBase: 0.35,
    routeSpan: 2.4,
    grumpyDrag: 0.8,
    startFloats: 4,
    floatCosts: [
      15, 25, 40, 60, 90, 130, 190, 280, 420, 640,
    ] as readonly number[],
    moveSeconds: 4,
    benchRise: 1.4,
    shadeFall: 0.5,
    clownFall: 1.25,
    factoryCare: 0.85,
    hotThirst: 0.4,
    rainThirst: -0.35,
    rainCare: 0.25,
    partyWeight: 3,
    dayKinds: [0.4, 0.65] as readonly number[],
    daySeconds: [60, 90] as readonly number[],
    calmSeconds: [5, 15] as readonly number[],
    firstDay: 40,
    showSeconds: 4,
    benchMax: 3,
    bigTopCare: 1.5,
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
    /** The town's projects cost coins. */
    townCosts: [40, 80, 170] as readonly number[],
    bigTopMult: 1.5,
    allMult: 2,
    spreadMult: 2,
  },
  /** Forks: one either-or choice per phase (prices are before costScale). */
  forks: {
    friend: { cost: 60, jokesTap: 4, jokesBond: 0.65, kindHelpers: 1.2 },
    town: {
      cost: 3000,
      clownTap: 3,
      factoryHelpers: 1.6,
    },
    world: {
      cost: 8000,
      speakerHelpers: 2,
      speakerPaint: 1.4,
      boxHelpers: 1.75,
      boxPaint: 0.6,
      boxHeal: 0.0008,
    },
    quiet: { cost: 15, wordsTap: 4, silenceHelpers: 1.8 },
  },
  /** The friend's wants in the quiet. */
  quiet: {
    growthPerPatience: 1.25e-5,
    firstWaitSeconds: 15,
    restSeconds: 25,
    matchSeconds: 12,
    otherSeconds: 4,
    kettleDelay: 30,
    kettleShare: 0.5,
    kettleAfterAnswers: 4,
    benchBoost: 1,
  },
  headStartSeconds: 20,
} as const;
