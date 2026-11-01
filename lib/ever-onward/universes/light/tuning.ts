/** Every balance number for Keep the Light On, in one place. */
export const TUNING = {
  coast: {
    fareGrowth: 1.3,
    lensAutoBonus: 0.1,
    keeperFlashes: 1,
    /** Each training step multiplies every keeper's flashes. */
    trainingSteps: [2, 2, 2.5] as readonly number[],
    burnPerShip: 0.1,
    burnPerShipPerLighthouse: 0.1,
    /** One barrel never takes more than this share of the coins. */
    barrelCoinShare: 0.6,
    stormTapBonus: 3,
    stormPassive: 0.5,
    stormShutterBonus: 0.15,
    stormLength: 25,
    stormGapMin: 150,
    stormGapSpread: 150,
    dimLamp: 0.5,
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
    barrelMin: 10,
    barrelShare: 0.5,
    cheapPrice: 1.4,
    dearPrice: 2.8,
    contractPrice: 1.6,
    wickSaving: 0.75,
    /** Each dock building makes every ship pay this much more. */
    dockBonus: 1.2,
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
    gridFloor: 0.4,
    /** Steadiness lost per second (percent): a base plus more as the grid works harder. */
    strainBase: 0.15,
    strainPerLoad: 0.3,
    /** Load balancer halves the strain; smart grid fixes itself below this. */
    balancerSaving: 0.5,
    autoBalanceBelow: 55,
    autoBalanceTo: 90,
    /** The grid is worth a button once this much power is made (MW). */
    gridVisibleSupplyMW: 6,
    /** Evening rush: a claimable bonus, with the grid straining faster. */
    rushStrainMult: 3,
    rushLength: 45,
    rushGapMin: 100,
    rushGapSpread: 100,
    rushFirst: 90,
    /** Seconds of income the rush pays when claimed. */
    rushBonusSeconds: 40,
  },
  sky: {
    aimBase: 1,
    aimPerLevel: 1,
    collectorEnergy: 1,
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
    headingFloor: 0.35,
    driftBase: 0.12,
    driftPerDecade: 0.1,
    chartsSaving: 0.5,
    autoCorrectBelow: 55,
    autoCorrectTo: 90,
    /** Solar flare: a claimable bonus, like the evening rush. */
    flareLength: 40,
    flareGapMin: 110,
    flareGapSpread: 110,
    flareFirst: 100,
    flareBonusSeconds: 40,
  },
  last: {
    startEnergy: 600,
    decayPerLight: 2,
    shieldSaving: 0.88,
    tapEnergy: 15,
    glassBonus: 0.25,
    resolvePerSecond: 1,
    resolvePerTap: 0.2,
    letGoRefund: 200,
    brightDecay: 0.12,
  },
} as const;
