/** Every balance number for Keep the Light On, in one place. */
export const TUNING = {
  /**
   * Every upgrade's cost in a phase is multiplied by this (except the first
   * buys, see `openingScale`). Round 7 made every step at least half as big
   * again (and added forks, the fund and overdrive), so the whole run is
   * priced up to stay about two hours.
   */
  costScale: { coast: 1, night: 28, sky: 9.5, last: 4.6 } as Record<
    string,
    number
  >,
  /**
   * The fund (see fund.ts): each part's savings jar. It grows by
   * `yieldPerSecond` of what is in it, less as the jar fills: the yield is
   * halved at `halfSeconds` of the part's income. Taking it out costs a fee.
   */
  fund: {
    yieldPerSecond: 0.02,
    halfSeconds: 30,
    minScale: 60,
    /** The fee for taking it out: steep at first, small after `matureSeconds`. */
    earlyFee: 0.3,
    lateFee: 0.04,
    matureSeconds: 120,
    opensAt: {
      coastShips: 60,
      nightLittleGenerators: 2,
      skyCollectors: 3,
      lastLights: 10,
    },
  },
  /**
   * The forks (see forks.ts): in every part, one choice locks the other for
   * the run. Prices are in the part's currency; the effects are plain
   * multipliers the tick reads.
   */
  fork: {
    coast: {
      /** Fresnel lens: every flash (yours and the keepers') guides this many times the ships. */
      fresnelFlash: 2.5,
      /** More keepers: they flash this many times as often, and burn more oil. */
      crewsFlash: 3,
      crewsOil: 1.3,
    },
    night: {
      /** Coal: every plant makes this much more at once, and the grid strains more. */
      coalSupply: 1.8,
      coalStrain: 1.6,
      /** Wind: slow to build, then this much more, and the grid strains less. */
      windSupply: 2.6,
      windStrain: 0.7,
      windRampSeconds: 150,
    },
    sky: {
      /** More probes: the fleet grows at once, and drifts off course faster. */
      swarmProbes: 3,
      swarmDrift: 1.5,
      /** Bigger mirrors: every collector catches more, and the fleet is steadier. */
      mirrorsEnergy: 2.6,
      mirrorsDrift: 0.85,
    },
    last: {
      /** Let it go: resolve comes faster and the flame fades faster. */
      releaseResolve: 1.8,
      releaseFade: 1.6,
      /** Keep it: the flame holds, and every tap is worth more resolve. */
      keepFade: 0.4,
      keepTaps: 2,
    },
    /** What each side costs. */
    costs: {
      fresnel: 5000000,
      crews: 5000000,
      coal: 9000,
      wind: 30000,
      swarm: 4000,
      mirrors: 4000,
      release: 150,
      keep: 150,
    },
  },
  /**
   * The first buys of the coast and the night keep the scale the whole game
   * used to have, so a player who barely taps still gets going.
   */
  openingScale: {
    crank: 2.9,
    gen1: 2.9,
    gen2: 2.9,
    // The sky's first steps: the mirror, the first probe and the first copying
    // (the gate to the rest of the chain).
    "mirror-1": 3,
    probe: 4,
    "copy-1": 3,
  } as Record<string, number>,
  coast: {
    fareGrowth: 1.5,
    /** Keepers (the main repeatable buy) stop here. */
    keeperMax: 40,
    /** Having this many keepers doubles every keeper's work, once each. */
    keeperMilestones: [5, 10, 25, 40] as readonly number[],
    keeperMilestoneMult: 2,
    /** Every lighthouse after the first multiplies the ships by this. */
    lighthouseMult: 2,
    /** Each lighthouse costs this many times the one before. */
    lighthouseGrowth: 7.5,
    /**
     * The lamp's brightness, the coast's one knob. `pay` multiplies the ships
     * every flash guides (yours and the keepers'), `burn` the oil the lamp
     * burns. Brighter pays more but burns even more, so the right step
     * follows the oil price.
     */
    beam: {
      defaultStep: 1,
      steps: [
        { label: "Dim", pay: 0.5, burn: 0.3 },
        { label: "Normal", pay: 1, burn: 1 },
        { label: "Bright", pay: 1.8, burn: 2.5 },
        { label: "Blazing", pay: 2.5, burn: 5 },
      ] as readonly { label: string; pay: number; burn: number }[],
    },
    /** Ships one flash guides at each lens level, the keepers' flashes too. */
    lensShips: [1, 2, 4, 8] as readonly number[],
    /** A tap also brings this share of a second of the keepers' coins. */
    tapShare: 0.04,
    keeperFlashes: 0.3,
    /** Each training step multiplies every keeper's flashes. */
    trainingSteps: [2, 2, 2] as readonly number[],
    /** Oil burned per coin of fare a keeper's ship pays, at the Normal step. */
    burnPerShip: 0.25,
    stormTapBonus: 3,
    /** Ships still come in a storm at this share; shutters and glass raise it (glass: ships shelter and more come). */
    stormPassive: [0.2, 1, 1.5] as readonly number[],
    stormLength: 25,
    stormGapMin: 150,
    stormGapSpread: 150,
    dimLamp: 0.25,
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
    tankSecondsPerTier: 120,
    tankTapsPerSecond: 3,
    cheapPrice: 1.4,
    dearPrice: 2.8,
    contractPrice: 1.6,
    wickSaving: 0.6,
    /** Each dock building makes every ship pay this much more. */
    dockBonus: 1.5,
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
  /** Probe Races, a side machine of the sky (see probes.ts). */
  probes: {
    /** Seconds of sky income each route brings home, and how long it takes. */
    short: { seconds: 75, haulSeconds: 52 },
    long: { seconds: 180, haulSeconds: 120 },
    /** The comet route pays between these, by how close the comet is at launch. */
    comet: { seconds: 110, haulMin: 40, haulMax: 92 },
    /** The comet drifts out and back in one slow pass of this many seconds. */
    cometCycleSeconds: 150,
    /** Racing fins: every run takes this share of its time. */
    finsTimeFactor: 0.5,
    /** Mission control's scout brings home this share of a hand-flown haul. */
    scoutShare: 0.35,
    /** A haul flows in over this many seconds, like a rush of light. */
    surgeSeconds: 4,
  },
  /** The Memory Garden, a side machine of The Last Light (see garden.ts). */
  garden: {
    /** Seconds a seed takes to bloom with no water at all. */
    growSeconds: 170,
    /** A seed counts as sprouted (and the story says so) from this share. */
    sproutAt: 0.1,
    /** A plant is a bud from this share of its growth on. */
    budAt: 0.34,
    /** A picked plant starts again from here, and grows at this pace. */
    regrowTo: 0.34,
    regrowPace: 0.5,
    /** A watering keeps a plant watered this long; the can then rests. */
    wetSeconds: 100,
    waterCooldown: 40,
    /** Watered seconds count this much extra (2.2x in all). */
    wetBoost: 1.2,
    /** The rain barrel waters thirsty plants this often, for this long. */
    rainEvery: 45,
    rainWetSeconds: 14,
    /** A bloom is worth this many seconds of letting go, and a little flame. */
    pickSeconds: 3,
    pickFlame: 20,
    /** The picked resolve flows in over this many seconds, like a glow. */
    surgeSeconds: 4,
  },
  night: {
    perCityMW: 150,
    payPerMW: 0.2,
    crankBase: 1,
    crankPerLevel: 1.5,
    /**
     * A turn of the crank also brings this share of a second's city power,
     * so a tap never falls to nothing as the grid grows (still a nudge).
     */
    crankShare: 0.003,
    gensMW: [8, 30, 300, 3000] as const,
    /** Each power line carries this many times the power (they stack). */
    lineBonus: 1.5,
    /** Each substation carries this much more of every plant's power. */
    substationBonus: 1.5,
    bulbSaving: 0.66,
    /** The grid: cities dim (never to zero) when it is left strained. */
    gridFloor: 0.6,
    /**
     * Steady glow: while the grid is at least this steady the cities sparkle
     * and pay this much more. A bonus for looking after it, not a tax.
     */
    glowAt: 75,
    glowBonus: 0.15,
    /** Steadiness lost per second (percent): a base plus more as the grid works harder. */
    strainBase: 0.2,
    strainPerLoad: 0.4,
    /** Load balancer halves the strain; smart grid fixes itself below this. */
    balancerSaving: 0.5,
    autoBalanceBelow: 55,
    autoBalanceTo: 90,
    /** The grid is worth a button once this much power is made (MW). */
    gridVisibleSupplyMW: 16,
    /** Evening rush: a claimable bonus that waits until it is claimed. */
    rushGapMin: 100,
    rushGapSpread: 100,
    rushFirst: 90,
    /** Seconds of income the rush pays when claimed. */
    rushBonusSeconds: 25,
  },
  /** Know-how and the night's projects (see projects.ts). */
  projects: {
    /** Know-how a second for every power plant built. */
    knowhowPerPlant: 0.028,
    /** Night school: know-how comes this much faster. */
    schoolBoost: 1.5,
    /** Know-how for balancing an uneasy grid by hand (line patrols: less). */
    perBalance: 3,
    patrolBalance: 1,
    /** Know-how for riding an evening rush. */
    perRush: 2,
    /** Smart meters: cities pay more, towns want more. */
    meterPay: 1.2,
    meterDemand: 1.05,
    /** Lamplighters: towns want less, the steady glow pays less. */
    lampDemand: 0.94,
    lampGlowBonus: 0.08,
    /** Line patrols: the grid strains slower. */
    patrolStrain: 0.7,
    /** Rush-hour pricing: a bigger rush, a little less often. */
    rushPay: 1.5,
    rushGap: 1.25,
    /** Fish ladders: every dam makes more. */
    ladderBoost: 1.4,
    /** The power co-op: steam plants make more, the grid strains more. */
    coopBoost: 1.25,
    coopStrain: 1.15,
    /** Wind maps: every wind and sun farm makes more. */
    windBoost: 1.25,
    /** The sky's projects (see projects.ts), paid in know-how too. */
    sky: {
      /** Know-how a second: every collector, and the fleet's size on a log scale. */
      knowhowPerCollector: 0.02,
      knowhowPerDecade: 0.08,
      /** Know-how for catching a flare, and for correcting the course. */
      perFlare: 2,
      perCourse: 1,
      /** Star atlas: probes take stars faster. */
      atlasBoost: 1.6,
      /** Mirror polish: every collector catches more, the fleet drifts faster. */
      polishBoost: 1.6,
      polishDrift: 1.25,
      /** Relay codes: every star taken pays more. */
      relayBoost: 1.5,
      /** Probe school: probes copy faster; flares come less often. */
      schoolBoost: 1.5,
      schoolFlareGap: 1.3,
      /** Flare watchers: flares pay more and come sooner. */
      flarePay: 1.6,
      flareGap: 0.8,
    },
  },
  /**
   * Overdrive, the second thing know-how buys (besides projects): run the
   * night's plants, or the sky's whole fleet, hot for a minute. Everything
   * pays `boost` times as much, but the grid (or the fleet's heading) slips
   * `strain` times as fast. Keep it above `cleanAbove` the whole minute and
   * `refund` of the know-how comes back. Nothing here is chance.
   */
  overdrive: {
    seconds: 60,
    boost: 2,
    strain: 3,
    cleanAbove: 60,
    refund: 0.5,
    nightCost: 30,
    skyCost: 30,
    /** It is offered from this many steam plants (night) / probes (sky). */
    nightAtSteamPlants: 2,
  },
  /**
   * The streetlights (No More Night's knob): how bright the cities shine.
   * Brighter pays more per megawatt, but the grid works harder, every city
   * wants a little more and the busy crews learn less. Softer pays less but
   * eases the grid, lights more towns with the same power, and gives the
   * crews quiet time to learn (know-how). "Bright" is how the night always
   * played.
   */
  lamps: {
    steps: [
      { pay: 0.9, demand: 0.88, strain: 0.7, knowhow: 2 },
      { pay: 0.95, demand: 0.94, strain: 0.85, knowhow: 1.4 },
      { pay: 1, demand: 1, strain: 1, knowhow: 1 },
      { pay: 1.3, demand: 1.06, strain: 1.3, knowhow: 0.5 },
    ] as readonly {
      pay: number;
      demand: number;
      strain: number;
      knowhow: number;
    }[],
    defaultStep: 2,
  },
  /** The Weather Desk, a side machine of No More Night (see weather.ts). */
  weather: {
    /** It opens with this many steam plants (about a third of the way in). */
    openAtSteamPlants: 2,
    /** Seconds after it opens until the first front forms. */
    firstFormSeconds: 40,
    /** Seconds a front takes to form. */
    formMin: 35,
    formSpread: 25,
    /** The forecast comes in steps, the storm's path firming up each time. */
    forecastSteps: 3,
    stepSeconds: 20,
    /**
     * How sure each step is: the share of the chances that points at where
     * the storm will really land (the first step is the honest draw).
     * Barometers make every step surer.
     */
    firm: [0, 0.45, 0.8] as readonly number[],
    firmBarometers: [0.3, 0.7, 0.95] as readonly number[],
    /** Each town is at least this likely; the rest is shared out at random. */
    minChance: 5,
    /** Chances are drawn as random ** skew, so one town is usually likely. */
    skew: 2,
    /** Seconds of income a storm pays when it lands on a ready crew. */
    bonusSeconds: 45,
    /** A crew that has only just arrived earns this share of the bonus. */
    unreadyShare: 0.5,
    /** Seconds a crew takes to get ready, and to fix a dark town. */
    readySeconds: 40,
    fixSeconds: 12,
    /** Spare parts: crews get ready and fix in this share of the time. */
    sparePartsFactor: 0.5,
    /** A town hit with no crew goes dark this long, and pays this much less. */
    outageSeconds: 120,
    outageShare: 0.1,
    /** However many towns are dark, the dip is never more than this. */
    outageMaxShare: 0.2,
    /** Know-how for a storm met by a crew, and for an outage fixed. */
    heldKnowhow: 4,
    fixKnowhow: 3,
    /** The bonus flows in over this many seconds, like a surge of power. */
    surgeSeconds: 12,
    /** The weather vane pays this share of that. */
    vaneShare: 0.6,
  },
  sky: {
    aimBase: 1,
    aimPerLevel: 1.5,
    /** Six bigger steps: each collector is worth what 1.67 used to be. */
    collectorEnergy: 10 / 6,
    mirrorBonus: 1.6,
    probeGrowth: 0.0028,
    /** The first launch sends this many small probes. */
    firstProbes: 8,
    copyBonus: 1.9,
    travelBase: 240,
    travelHalf: 120,
    engineSaving: 0.6,
    takePerProbe: 0.003,
    appetiteBonus: 2.2,
    /** Energy each star taken pays out, so probe progress shows as income. */
    starBounty: 25,
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
    driftBase: 0.16,
    driftPerDecade: 0.14,
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
    decayPerLight: 0.003,
    darkness: 3,
    /**
     * Share of the way to a full flame one tap brings: a few taps warm a cold
     * lantern, and tapping a warm one does little, so tending is a top-up now
     * and then, not a mash.
     */
    tapWarmth: 0.15,
    /** Resolve per second (the pace of letting go), and per tap. */
    resolvePerSecond: 1,
    resolvePerTap: 0.06,
    /** A cold flame still lets go, at this share of the pace (never zero). */
    flameFloor: 0.75,
    /** Each light let go makes the next easier: this much more resolve. */
    reliefPerLetGo: 0.25,
    /** Gifts: porch/bridge-like (fade), festival-like (burst), moon-like (taps). */
    fadeSaving: 0.6,
    tapGift: 0.6,
    burstFlame: 600,
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
