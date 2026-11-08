/** Every balance number for Keep the Light On, in one place. */
export const TUNING = {
  /**
   * Every upgrade's cost in a phase is multiplied by this (except the first
   * buys, see `openingScale`). Round 7 made every step at least half as big
   * again (and added forks, the fund and overdrive), so the whole run is
   * priced up to stay about two hours.
   */
  costScale: { coast: 1, night: 135, sky: 9.5, last: 4.6 } as Record<
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
      /** Coal: every plant makes this much more at once, and the evening rush is bigger. */
      coalSupply: 1.8,
      coalPeak: 1.35,
      /** Wind: slow to build, then this much more, and the evening rush is smaller. */
      windSupply: 2.6,
      windPeak: 0.75,
      windRampSeconds: 150,
    },
    sky: {
      /** More probes: the fleet grows at once, and flares burn more of it. */
      swarmProbes: 3,
      swarmFlare: 1.4,
      /** Bigger mirrors: every collector catches more, and flares burn less of the fleet. */
      mirrorsEnergy: 2.6,
      mirrorsFlare: 0.85,
    },
    last: {
      /** Let it go: resolve comes faster, but every light burns more warmth. */
      releaseResolve: 1.5,
      releaseBurn: 1.3,
      /** Keep it: the lights burn less warmth, and every tap is worth more resolve. */
      keepBurn: 0.7,
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
    "batt-1": 2.9,
    "batt-2": 2.9,
    // The sky's first steps: the mirror, the first probe and the first copying
    // (the gate to the rest of the chain).
    "mirror-1": 3,
    probe: 4,
    "copy-1": 3,
  } as Record<string, number>,
  coast: {
    fareGrowth: 1.5,
    /** Keepers (the main repeatable buy) stop here. */
    keeperMax: 14,
    /** Having this many keepers doubles every keeper's work, once each. */
    keeperMilestones: [3, 6, 10, 14] as readonly number[],
    keeperMilestoneMult: 2,
    /** Every lighthouse after the first multiplies the ships by this. */
    lighthouseMult: 2,
    /** Each lighthouse costs this many times the one before. */
    lighthouseGrowth: 8,
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
        { label: "Bright", pay: 1.7, burn: 3.5 },
        { label: "Blazing", pay: 2.5, burn: 10 },
      ] as readonly { label: string; pay: number; burn: number }[],
    },
    /** Ships one flash guides at each lens level, the keepers' flashes too. */
    lensShips: [1, 2, 4, 8] as readonly number[],
    /** A tap also brings this share of a second of the keepers' coins. */
    tapShare: 0.04,
    keeperFlashes: 0.35,
    /** Each training step multiplies every keeper's flashes. */
    trainingSteps: [2, 2, 2] as readonly number[],
    /** Oil burned per coin of fare a keeper's ship pays, at the Normal step. */
    burnPerShip: 0.22,
    stormTapBonus: 3,
    /** Ships still come in a storm at this share; shutters and glass raise it (glass: ships shelter and more come). */
    stormPassive: [0.2, 1, 1.5] as readonly number[],
    stormLength: 25,
    stormGapMin: 150,
    stormGapSpread: 150,
    /** A dry lamp is dark: this share of the ships still find the harbor (so nobody is ever stuck). */
    dimLamp: 0.25,
    oilMean: 1.2,
    oilMin: 0.15,
    oilMax: 6.5,
    oilWobble: 0.55,
    oilPull: 0.0012,
    trendSeconds: 6,
    tankBase: 40,
    tankPerTier: 80,
    /** Seconds of full-tilt burn a tank holds, and what each tank upgrade adds. */
    tankSeconds: 150,
    tankSecondsPerTier: 250,
    tankTapsPerSecond: 3,
    /** Under this share of a full tank the oil is a rush order: it costs this many times more. */
    rushBelow: 0.12,
    rushMult: 1.2,
    cheapPrice: 1.4,
    dearPrice: 2.8,
    wickSaving: 0.66,
    /** Each dock building makes every ship pay this much more. */
    dockBonus: 1.5,
    /** The oil merchant orders a full tank whenever the tank falls under this share. */
    contractBelow: 0.25,
    /**
     * The harbor toll (see toll.ts): the price you set. Every ship pays
     * `pay` times the fare, but ships pick a harbor by its toll against the
     * going rate (the rival harbor down the coast, grown by your own
     * lighthouses and docks). The share that choose you is
     * `eagerness / (1 + (pay / rate) ^ steepness)`, at most all of them, and
     * the traffic follows it slowly.
     */
    harbor: {
      steps: [
        { label: "Low", pay: 0.7 },
        { label: "Usual", pay: 1 },
        { label: "High", pay: 1.4 },
        { label: "Steep", pay: 2 },
        { label: "Greedy", pay: 2.8 },
      ] as readonly { label: string; pay: number }[],
      defaultStep: 1,
      /** The desk opens with this many keepers. */
      opensAtKeepers: 3,
      steepness: 4,
      eagerness: 1.5,
      /** Seconds the traffic takes to cover most of the way to a new share. */
      followSeconds: 25,
      /** ... and when the lamp is dark (ships steer clear faster than they come back). */
      darkFollowSeconds: 8,
      /** The sign takes this long to repaint; a change also puts a few ships off. */
      changeLockSeconds: 20,
      changeTraffic: 0.92,
      /** The rival harbor's toll wanders between these and glides to each new one. */
      rivalStart: 1.3,
      rivalMin: 0.7,
      rivalMax: 2.2,
      rivalGapMin: 110,
      rivalGapSpread: 100,
      rivalGlideSeconds: 30,
      /** Each lighthouse after the first and each dock building raises the going rate. */
      lighthouseRate: 0.03,
      dockRate: 0.04,
      /**
       * How much of the rival's price shows up in what ships pay: the rest is
       * the same for every toll, so it never changes which toll is best, only
       * keeps a rival's big swing from rocking the whole coast's income.
       */
      rivalPayShare: 0.3,
      /** In a storm, ships have fewer harbors to pick from. */
      stormRate: 1.35,
      /** While the lamp is dark, the traffic settles at this share of what it would be. */
      darkTraffic: 0.6,
    },
    /**
     * Oil tankers (see tanker.ts): now and then one ties up with cheap oil
     * for a while. The market price drifts as before; the tanker sells at
     * `dealMin`..`dealMax` of it until it leaves.
     */
    tanker: {
      firstSeconds: 80,
      gapMin: 130,
      gapSpread: 200,
      staySeconds: 35,
      /** Each tank's worth of oil bought moves what you remember paying this share of the way. */
      habitMemory: 0.5,
      /** A tanker's first seconds in port are the moment that holds pop-ups back. */
      arrivalSeconds: 6,
      dealMin: 0.3,
      dealMax: 0.8,
      /** Barrels roll into the tanks this long after a buy. */
      barrelSeconds: 4,
      /** The relit beam bursts for this long. */
      relitSeconds: 5,
      /** Narration waits this much longer, so a story card never covers "LIT AGAIN!". */
      relitHoldSeconds: 8,
      /** "DARK!" shows this long. */
      darkBannerSeconds: 6,
    },
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
    /** The grid (see grid.ts) opens once this much power is made (MW). */
    gridVisibleSupplyMW: 16,
  },
  /**
   * The grid: plants, power lines and batteries have to stay in step. A day
   * is `daySeconds` long; at dusk everybody switches on and the evening rush
   * wants more than the plants make. Batteries soak up spare power by day
   * and carry the rush; power lines limit how fast they can. Short of that,
   * districts snap dark for a little while. See grid.ts.
   */
  grid: {
    daySeconds: 120,
    /** The clock starts here when the grid opens (the first rush is near). */
    firstClock: 40,
    /** Seconds into the day the sun goes down, the rush starts and its length. */
    duskAt: 62,
    rushAt: 78,
    rushSeconds: 24,
    /** How much more than usual the rush wants, drawn each evening, and how likely. */
    excess: [0.12, 0.25, 0.4, 0.6] as readonly number[],
    odds: [0.2, 0.35, 0.3, 0.15] as readonly number[],
    /** The first evenings are gentle: mild, then usual. */
    gentleEvenings: 2,
    /** While the batteries are not full, this share of the plants' power goes into them. */
    chargeShare: 0.3,
    /** Share of the power that goes into a battery that comes back out. */
    efficiency: 0.8,
    /**
     * What the batteries hold, in MW-seconds, with 1 to 8 steps of the
     * battery chain bought: each step holds about 2.7 times the one before,
     * so the bank keeps up with plants that grow by tens.
     */
    batteryHolds: [
      100, 270, 730, 1970, 5310, 14350, 38740, 104600,
    ] as readonly number[],
    /** A bank step shows once the plants make this many seconds' worth of what it holds. */
    showBankSeconds: 40,
    /** Batteries keep this share back at the rush, so they never run to nothing. */
    reserveShare: 0.04,
    /** The lines let the batteries give back this much of the plants' power, and more per line. */
    rateBase: 0.25,
    ratePerLine: 0.15,
    /** Districts that can go dark, and how long they take to come back on. */
    districts: 10,
    recoverySeconds: 24,
    /** Surviving the rush pays this many seconds of income, and know-how. */
    litSeconds: 200,
    litKnowhow: 2,
    /** The banners last this long. */
    bannerSeconds: 6,
    /** Pop-ups wait this long into a rush for the houses to snap dark. */
    snapSeconds: 5,
    /** A change of streetlights (or a crew's move) takes this long. */
    lampLockSeconds: 8,
    /** Crews: how long a move to a new post takes. */
    moveSeconds: 6,
    /** Going out on storm duty costs sandbags and wages, in seconds of what the cities pay (coming home is free). */
    moveFeeSeconds: 30,
    /** Co-op and rush pricing make the rush this much bigger. */
    coopPeak: 1.12,
    pricingPeak: 1.1,
    /** Overdrive: the rush is this much bigger, and nothing charges. */
    hotPeak: 1.25,
  },
  /** Know-how and the night's projects (see projects.ts). */
  projects: {
    /** Know-how a second for every power plant built. */
    knowhowPerPlant: 0.028,
    /** Night school: know-how comes this much faster. */
    schoolBoost: 1.5,
    /** Smart meters: cities pay more, towns want more. */
    meterPay: 1.2,
    meterDemand: 1.05,
    /** Lamplighters: towns want less, a lit night pays less. */
    lampDemand: 0.94,
    lampLitPay: 0.8,
    /** Line patrols: the lines carry the batteries' power this much faster; school crews learn less. */
    patrolRate: 1.35,
    patrolSchool: 0.7,
    /** Rush-hour pricing: a lit night pays more, the rush is a little bigger. */
    rushPay: 1.5,
    /** Fish ladders: every dam makes more. */
    ladderBoost: 1.4,
    /** The power co-op: steam plants make more, the evening rush is bigger. */
    coopBoost: 1.25,
    /** Wind maps: every wind and sun farm makes more. */
    windBoost: 1.25,
    /** The sky's projects (see projects.ts), paid in know-how too. */
    sky: {
      /** Know-how a second: every collector, and the fleet's size on a log scale. */
      knowhowPerCollector: 0.02,
      knowhowPerDecade: 0.08,
      /** Know-how for a flare weathered (it burned under a quarter of the fleet), and for bringing wild probes home. */
      perFlare: 2,
      perHome: 1,
      /** Star atlas: probes take stars faster. */
      atlasBoost: 1.6,
      /** Mirror polish: every collector catches more, flares burn more of the fleet. */
      polishBoost: 1.6,
      polishFlare: 1.25,
      /** Relay codes: every star taken pays more. */
      relayBoost: 1.5,
      /** Probe school: probes copy faster; more of them go wild. */
      schoolBoost: 1.5,
      schoolWild: 1.4,
    },
  },
  /**
   * Overdrive, the second thing know-how buys (besides projects): run the
   * night's plants hot for a minute. Everything pays `boost` times as much,
   * but the evening rush is bigger and nothing charges. Keep it above `cleanAbove` the whole minute and
   * `refund` of the know-how comes back. Nothing here is chance.
   */
  overdrive: {
    seconds: 60,
    boost: 2,
    cleanAbove: 60,
    refund: 0.5,
    nightCost: 30,
    /** It is offered from this many steam plants. */
    nightAtSteamPlants: 2,
  },
  /**
   * The streetlights (No More Night's knob): how bright the cities shine.
   * Brighter pays more per megawatt, but the evening rush hits harder, every
   * city wants a little more and the busy crews learn less. Softer pays less but
   * eases the grid, lights more towns with the same power, and gives the
   * crews quiet time to learn (know-how). "Bright" is how the night always
   * played.
   */
  lamps: {
    steps: [
      { pay: 0.6, demand: 0.88, peak: 0.45, knowhow: 2 },
      { pay: 0.8, demand: 0.94, peak: 0.7, knowhow: 1.4 },
      { pay: 1, demand: 1, peak: 1, knowhow: 1 },
      { pay: 1.6, demand: 1.06, peak: 1.6, knowhow: 0.5 },
    ] as readonly {
      pay: number;
      demand: number;
      peak: number;
      knowhow: number;
    }[],
    defaultStep: 2,
  },
  /**
   * The crews (see weather.ts): each one is building, learning at the
   * school, or watching a town for the storm. A crew that moves to a new post
   * spends `grid.moveSeconds` on the road first.
   */
  crews: {
    /** Crews to start with; the storm-crews buy adds one. */
    base: 2,
    /** Each building crew adds this share to the power cities pay. */
    buildBoost: 0.4,
    /** Each crew at the school adds this share to the know-how a second. */
    schoolBoost: 0.6,
  },
  /** The Weather Desk, a side machine of No More Night (see weather.ts). */
  weather: {
    /** It opens with this many steam plants (about a third of the way in). */
    openAtSteamPlants: 2,
    /** Seconds after it opens until the first front forms. */
    firstFormSeconds: 40,
    /** Seconds a front takes to form. */
    formMin: 70,
    formSpread: 50,
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
    skew: 1.3,
    /** Seconds of income a storm pays when it lands on a ready crew. */
    bonusSeconds: 220,
    /**
     * Every front is small, ordinary or big (shown with the forecast): the
     * bonus is this many times as much, and this often.
     */
    sizes: [0.5, 1, 2] as readonly number[],
    sizeOdds: [0.3, 0.4, 0.3] as readonly number[],
    /** What a storm on each town pays, against the usual: Rivertown is big, Harbor small. */
    townWorth: [1.6, 1, 0.6] as readonly number[],
    /** A crew that has only just arrived earns this share of the bonus. */
    unreadyShare: 0.3,
    /** Seconds a crew takes to get ready, and to fix a dark town. */
    readySeconds: 45,
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
    collectorMilestones: [3, 6] as const,
    collectorMilestoneMult: 1.1,
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
    /** The sky's first flare comes this long after the first probe flies. */
    flareFirst: 90,
  },
  /**
   * The sky's three dials (see design.ts and sunEdge.ts). Design points are
   * split across four things a probe can be good at; the sun's edge is how
   * close the fleet flies (much more light, and flares that burn probes);
   * and copying hard sends some probes wild.
   */
  dials: {
    /** Design points to split, and the split the fleet starts with. */
    points: 8,
    startSplit: [2, 2, 2, 2] as readonly number[],
    /** One point takes this long to land in its new place. */
    settleSeconds: 6,
    /** What each point of a stat is worth (1 at the starting 2 points). */
    speedBase: 0.4,
    speedStep: 0.3,
    mirrorBase: 0.5,
    mirrorStep: 0.25,
    copyBase: 0,
    copyStep: 0.5,
    /**
     * Each shield point takes this much off a flare's burn, the same for
     * every point (so a point is worth a lot where flares burn a lot and
     * nothing where they do not), down to at least `shieldLeakMin` left.
     */
    shieldCut: 0.3,
    shieldLeakMin: 0.08,
    /** The shield foundry makes every shield point this much stronger. */
    foundryShield: 1.5,
    /** Where the sun's edge steps start and how fast the fleet moves between them. */
    startDistance: 1,
    distanceStepSeconds: 20,
    /** Light each distance gathers (step 0 far, 4 brushing the sun). */
    light: [0.7, 1, 1.5, 2.0, 2.6] as readonly number[],
    /** How hot each distance is under a usual sun: the share of a flare that reaches the fleet (see `reach` and `stray` for the other moods). */
    heat: [0, 0.1, 0.22, 0.38, 0.6] as readonly number[],
    /** How hard each size of flare burns, unshielded and at heat 1. */
    flareBurn: [1, 4, 8] as readonly number[],
    /** No flare burns this share of the fleet or more, however hot and big (the burn bends toward it). */
    burnCap: 0.58,
    /** The share of the probes a flare burns that are mended, and about how long that takes. */
    repairShare: 0.65,
    repairSeconds: 60,
    /**
     * A flare also dazzles the collectors: light is cut by its burn share
     * times `dazzleHit` (at most `dazzleMax`), back to full over `dazzleSeconds`.
     */
    dazzleHit: 1.5,
    dazzleMax: 0.7,
    dazzleSeconds: 40,
    /**
     * The sun's moods, which come and go on their own: how soon its flares
     * come (a gap of `gapMin` plus up to `gapSpread` seconds) and how big
     * (the odds of small, medium and big).
     */
    moods: [
      {
        name: "quiet",
        gapMin: 150,
        gapSpread: 100,
        lead: 50,
        reach: 0.7,
        stray: 0,
        odds: [0.7, 0.25, 0.05],
      },
      {
        name: "usual",
        gapMin: 70,
        gapSpread: 50,
        lead: 45,
        reach: 1,
        stray: 0,
        odds: [0.25, 0.4, 0.35],
      },
      {
        name: "restless",
        gapMin: 30,
        gapSpread: 30,
        lead: 8,
        reach: 1.2,
        stray: 0.15,
        odds: [0.02, 0.28, 0.7],
      },
    ] as readonly {
      name: string;
      gapMin: number;
      gapSpread: number;
      /** How many seconds ahead its flares are forecast (a restless sun gives little warning). */
      lead: number;
      /** How much of a step's heat a flare of this mood reaches, and the heat it reaches even at the far edge. */
      reach: number;
      stray: number;
      odds: readonly number[];
    }[],
    /** A mood lasts this long, and the sun starts out "usual". */
    moodMin: 150,
    moodSpread: 150,
    startMood: 1,
    /** The chance the forecast has the size right (with sun charts). */
    forecastSure: 0.6,
    forecastSureCharts: 0.9,
    /** Flare watchers show the forecast this much sooner. */
    watchLead: 15,
    /** How long the flare and wild moments stay on in the picture. */
    hitSeconds: 6,
    wildBannerSeconds: 6,
    /** Pop-ups (story cards) wait this long after a banner is gone. */
    momentAfter: 2,
    homeBannerSeconds: 6,
    /** Copying above this many points sends copies wild: this share of them, times the points over, squared. */
    wildFree: 2,
    wildShare: 0.06,
    wildMax: 0.95,
    /** Wild probes grow on their own at this share of a probe's growth (and take no stars for you). */
    wildGrowth: 1,
    /** Wild probes crowd the sky: tame growth and star-taking shrink by this share of the wild share. */
    wildCrowd: 0.6,
    /** The share of the sunlight wild probes keep (at most, when all are wild). */
    wildLight: 0.8,
    /** Bringing them home: design points pulled from copying for this long. */
    recallPoints: 3,
    recallSeconds: 20,
    /** The wild ones are first noticed when they are this share of the fleet. */
    wildNotice: 0.04,
  },
  last: {
    /** The warmth (0..flameFull, kept in `flame`) starts here, whatever came before. */
    startFlame: 300,
    flameFull: 1000,
    /** The warmth never goes below this share: the lantern is never out. */
    warmFloor: 0.08,
    /** How fast the warmth moves to where the lights leave it (a share a second). */
    warmRate: 0.06,
    /** The hearth's own warmth with no lights burning, and what each hearth step adds. */
    hearthBase: 0.6,
    hearthStep: 0.05,
    /** Each tap stokes the flame a little; the stoke fades, so mashing gains nothing past the cap. */
    stokePerTap: 0.012,
    stokeMax: 0.1,
    stokeFade: 0.02,
    /** Resolve per second (the pace of the quiet), per tap, and the share of it that even a cold flame gives. */
    resolvePerSecond: 0.2,
    resolvePerTap: 0.02,
    coldResolve: 0.35,
    /** The crossing itself gives hope: resolve a second for each full pace of the boat. */
    hopePerSecond: 0.5,
    /** Letting go pays this share of a ripe light's worth when cold, rising to all of it when warm. */
    lumpCold: 0.2,
    /** Letting go takes this long (no second light goes meanwhile), and the light's burn fades over `riseSeconds`. */
    goSeconds: 30,
    riseSeconds: 10,
    /** "GOODBYE, LITTLE LIGHT" and the flower stay on the picture this long. */
    goodbyeSeconds: 7,
    /** The boat sails this many seconds with full warmth, and at this share of that when the flame is out. */
    boatSeconds: 2500,
    boatFloor: 0.12,
    /** The boat is "surging" in the picture from this warmth. */
    surgeAt: 0.75,
    /** Fog creeps in below this warmth. */
    fogBelow: 0.4,
    /**
     * The cold winds: every so often the lights burn harder for a spell. A
     * wind is forecast `lead` seconds ahead and has a size (mild, chilly,
     * bitter) that multiplies every burn while it blows.
     */
    chill: {
      first: 80,
      gapMin: 50,
      gapSpread: 60,
      lead: 20,
      seconds: 30,
      mult: [1.7, 2.6, 3.8] as const,
      /** Cupping your hands round the flame costs this many seconds of resolve, and a wind bites this share as hard. */
      shelterSeconds: 15,
      shelterBite: 0.25,
      odds: [0.45, 0.35, 0.2] as const,
    },
    /** What a hearth step, a slow burn and warm company change. */
    hearthTiers: 6,
    /** Each sail step makes the boat this much faster (they stack). */
    sailMult: 1.4,
    slowBurn: 0.85,
    companyMult: 1.3,
    /** Each step of the crossing song makes its hope this much bigger (they stack). */
    songMult: 1.3,
    /**
     * The eleven remembered lights, nearest to farthest. `burn` is the warmth
     * share it costs each second; `company` is the resolve a second it keeps
     * you while it burns; `memory` is what it pays to let it go (the most, if
     * the flame is warm). Each run moves every number by up to `spread`
     * either way, from the run's own seed.
     */
    spread: 0.5,
    lonely: 0.6,
    lights: [
      { burn: 0.02, company: 0.096, memory: 20 },
      { burn: 0.03, company: 0.112, memory: 20 },
      { burn: 0.07, company: 0.352, memory: 60 },
      { burn: 0.035, company: 0.08, memory: 30 },
      { burn: 0.022, company: 0.16, memory: 40 },
      { burn: 0.08, company: 0.32, memory: 60 },
      { burn: 0.03, company: 0.144, memory: 40 },
      { burn: 0.018, company: 0.128, memory: 40 },
      { burn: 0.014, company: 0.048, memory: 30 },
      { burn: 0.06, company: 0.256, memory: 60 },
      { burn: 0.022, company: 0.064, memory: 40 },
    ] as const,
  },
} as const;
