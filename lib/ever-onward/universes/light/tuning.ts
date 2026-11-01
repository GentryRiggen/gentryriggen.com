/** Every balance number for Keep the Light On, in one place. */
export const TUNING = {
  /**
   * Every upgrade's cost in a phase is multiplied by this: the steady glow
   * and the bigger collector steps made the night and the sky quicker, so
   * they are priced up to keep the run about two hours.
   */
  costScale: { coast: 1.14, night: 1.18, sky: 1.35, last: 1.15 } as Record<
    string,
    number
  >,
  coast: {
    fareGrowth: 1.3,
    lensAutoBonus: 0.1,
    keeperFlashes: 1,
    /** Each training step multiplies every keeper's flashes. */
    trainingSteps: [2, 2, 2.5] as readonly number[],
    burnPerShip: 0.1,
    burnPerShipPerLighthouse: 0.1,
    stormTapBonus: 3,
    stormPassive: 0.5,
    stormShutterBonus: 0.15,
    stormLength: 25,
    stormGapMin: 150,
    stormGapSpread: 150,
    dimLamp: 0.7,
    burnBase: 0.3,
    oilMean: 2,
    oilMin: 0.3,
    oilMax: 6,
    oilWobble: 1.0,
    oilPull: 0.006,
    trendSeconds: 6,
    tankBase: 40,
    tankPerTier: 80,
    /** Seconds of full-tilt burn a tank holds, and what each tank upgrade adds. */
    tankSeconds: 60,
    tankSecondsPerTier: 60,
    tankTapsPerSecond: 3,
    cheapPrice: 1.4,
    dearPrice: 2.8,
    contractPrice: 1.6,
    wickSaving: 0.75,
    /** Each dock building makes every ship pay this much more. */
    dockBonus: 1.2,
  },
  /** The Tide Clock, a side machine of the coast (see tide.ts). */
  tide: {
    /** One full wave, low to high to low, in seconds of play. */
    cycleSeconds: 175,
    /** Seconds of coast income a catch is worth: late nets, then early nets. */
    catchMinSeconds: 30,
    catchMaxSeconds: 45,
    /** Bigger nets multiply the catch by this. */
    biggerNetsFactor: 1.5,
    /** Seconds of income the tide mill adds on its own at each high tide. */
    millSeconds: 14,
    /** The catch flows in over this many seconds, like a rush of fish. */
    surgeSeconds: 6,
  },
  night: {
    perCityMW: 150,
    payPerMW: 0.2,
    crankBase: 1,
    crankPerLevel: 2,
    gensMW: [3, 30, 300, 3000] as const,
    lineBonus: 0.15,
    /** Each substation carries this much more of every plant's power. */
    substationBonus: 1.2,
    bulbSaving: 0.88,
    /** The grid: cities dim (never to zero) when it is left strained. */
    gridFloor: 0.6,
    /**
     * Steady glow: while the grid is at least this steady the cities sparkle
     * and pay this much more. A bonus for looking after it, not a tax.
     */
    glowAt: 75,
    glowBonus: 0.15,
    /** Steadiness lost per second (percent): a base plus more as the grid works harder. */
    strainBase: 0.35,
    strainPerLoad: 0.7,
    /** Load balancer halves the strain; smart grid fixes itself below this. */
    balancerSaving: 0.5,
    autoBalanceBelow: 55,
    autoBalanceTo: 90,
    /** The grid is worth a button once this much power is made (MW). */
    gridVisibleSupplyMW: 6,
    /** Evening rush: a claimable bonus that waits until it is claimed. */
    rushGapMin: 100,
    rushGapSpread: 100,
    rushFirst: 90,
    /** Seconds of income the rush pays when claimed. */
    rushBonusSeconds: 25,
  },
  /** The Weather Desk, a side machine of No More Night (see weather.ts). */
  weather: {
    /** It opens with this many steam plants (about a third of the way in). */
    openAtSteamPlants: 3,
    /** Seconds after it opens until the first front forms. */
    firstFormSeconds: 40,
    /** Seconds a front takes to form, and how long its forecast stands. */
    formMin: 130,
    formSpread: 50,
    forecastSeconds: 55,
    /** Each town is at least this likely; the rest is shared out at random. */
    minChance: 5,
    /** Chances are drawn as random ** skew, so one town is usually likely. */
    skew: 2,
    /** Seconds of income a held storm pays. */
    bonusSeconds: 45,
    /** The bonus flows in over this many seconds, like a surge of power. */
    surgeSeconds: 12,
    /** The weather vane pays this share of that. */
    vaneShare: 0.6,
  },
  sky: {
    aimBase: 1,
    aimPerLevel: 1,
    /** Six bigger steps: each collector is worth what 1.67 used to be. */
    collectorEnergy: 10 / 6,
    mirrorBonus: 1.4,
    probeGrowth: 0.0028,
    copyBonus: 1.9,
    travelBase: 240,
    travelHalf: 120,
    engineSaving: 0.6,
    takePerProbe: 0.003,
    appetiteBonus: 2.2,
    /** Energy each star taken pays out, so probe progress shows as income. */
    starBounty: 15,
    /** Each relay station makes every star taken pay this much more. */
    relayBonus: 1.6,
    /** A wave of copies / early arrivals lands when these are bought. */
    copyFleetBump: 1.5,
    engineFleetBump: 1.3,
    /** Probes wander off course; cheaper to fix by hand than to ignore. */
    headingFloor: 0.6,
    /** Steady glow: a fleet in formation takes stars this much faster. */
    glowAt: 75,
    glowBonus: 0.15,
    driftBase: 0.28,
    driftPerDecade: 0.24,
    chartsSaving: 0.5,
    autoCorrectBelow: 55,
    autoCorrectTo: 90,
    /** Solar flare: a claimable bonus that waits, like the evening rush. */
    flareGapMin: 110,
    flareGapSpread: 110,
    flareFirst: 100,
    flareBonusSeconds: 25,
  },
  last: {
    /** The flame (0..flameFull) starts here, whatever came before. */
    startFlame: 600,
    flameFull: 1000,
    /**
     * Share of the flame lost each second for every light still lit, plus
     * `darkness` more lights' worth (the dark itself): it never reaches zero
     * by itself, and the lights going out lets it climb, not run away.
     */
    decayPerLight: 0.01,
    darkness: 3,
    /** Flame one tap adds. */
    tapFlame: 16,
    /** Resolve per second (the pace of letting go), and per tap. */
    resolvePerSecond: 1,
    resolvePerTap: 0.06,
    /** A cold flame still lets go, at this share of the pace (never zero). */
    flameFloor: 0.75,
    /** Each light let go makes the next easier: this much more resolve. */
    reliefPerLetGo: 0.16,
    /** Gifts: porch/bridge-like (fade), festival-like (burst), moon-like (taps). */
    fadeSaving: 0.85,
    tapGift: 0.25,
    burstFlame: 300,
    brightDecay: 0.12,
    /** The first ship's boat appears when this many lights are left. */
    boatAtLights: 3,
    /** Heading lost per second (percent), and what one tap on the beam gives. */
    boatDrift: 0.6,
    boatSteer: 45,
    /** The boat sails at this share of its pace when off course (never zero). */
    boatFloor: 0.3,
    /** Seconds the crossing takes with the beam true. */
    boatSeconds: 120,
    /**
     * Steering earns resolve: while the boat is out, a true heading makes
     * letting go this much faster (never below 1x). The bonus is full from
     * `steerTrue` and fades to nothing at `steerFrom`.
     */
    steerBonus: 0.5,
    steerFrom: 40,
    steerTrue: 80,
  },
} as const;
