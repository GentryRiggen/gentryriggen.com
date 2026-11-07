/** Every balance number for Make It Grow, in one place. */
export interface PhaseTuning {
  /** What one tap earns before any bonus. */
  tap: number;
  /** What each helper earns every second before any bonus. */
  helper: number;
  /** Each scaling level adds this share to taps and helpers alike. */
  scalePer: number;
}

export const TUNING = {
  /** Every level of a helper line multiplies its output by this (see `stacked`). */
  stackGrowth: 1.6,
  /** Every upgrade's price in a phase is multiplied by this (yard, farm, world, seed). */
  costSteepness: [1.0, 1.78, 1.35, 1.2] as readonly number[],
  costScale: [4.4, 1.88, 2.75, 9] as readonly number[],
  /** By phase index. */
  phases: [
    { tap: 1.4, helper: 0.6, scalePer: 0.6 },
    { tap: 4, helper: 5, scalePer: 0.6 },
    { tap: 28, helper: 40, scalePer: 0.6 },
    { tap: 1, helper: 0.35, scalePer: 0.6 },
  ] as readonly PhaseTuning[],
  /** The backyard's water: a tank, rain that comes and goes, and a thirst. */
  water: {
    /** Units the tank holds with no storage built. */
    baseCapacity: 12,
    /** Units each rain barrel adds. */
    barrelCapacity: 18,
    /** Units each garden hose (a long hose to the butt) adds. */
    hoseCapacity: 40,
    /** Units of rain per second when the outlook is fully rainy. */
    rainMax: 0.9,
    /** Units per second the garden drinks. */
    thirst: 0.3,
    /** The outlook it drifts back toward, and how fast (per second). */
    outlookMean: 0.5,
    outlookPull: 0.01,
    /** Size of the random wobble per root-second. */
    outlookWobble: 0.1,
    outlookStart: 0.6,
    /** The rain forecast reads as dry below this. */
    dryOutlook: 0.35,
  },
  /** Seasons follow the phase clock; none of them ever takes anything away. */
  seasons: {
    seconds: 90,
    /** Boost for [plant (taps), grow (sprinklers, bees), harvest]. */
    spring: [1.5, 1.15, 1],
    summer: [1.1, 1.5, 1.1],
    autumn: [1, 1.1, 3],
    winter: [1, 1, 1],
  },
  /** The backyard's harvest: ripe produce waits in the garden until picked. */
  yard: {
    /** Produce per second each helper grows (before bonuses). */
    sprinklerRate: 1.1,
    hiveRate: 3.6,
    /** The share of ripening produce each helper picks, at the base rate. */
    basketShare: 0.07,
    gardenerShare: 0.14,
    /** The most the pickers can keep up with, before wheelbarrows. */
    pickCap: 0.6,
    /** Past the cap, the share of a helper's pick that still counts. */
    overflowKeep: 0.05,
    /** Each level of compost tea adds this share to ripening. */
    teaPer: 0.6,
    /** The greenhouse multiplies ripening by this. */
    greenhouse: 2,
    /** The orchard multiplies ripening by this. */
    orchard: 1.6,
    /** The honey stand multiplies what a hand harvest pays by this. */
    honey: 1.5,
    /** Each wheelbarrow raises the pickers' cap by this much. */
    barrowPer: 0.12,
    /** The hand-harvest button shows once this much is ripe. */
    ripeShown: 5,
    /** The harvest plate lights up at this many seconds of basket work. */
    ripeFor: 25,
  },
  /** The backyard's pollination (bees.ts): beds, bees, honey and winter. */
  pollen: {
    /** Bees each hive brings. */
    beesPerHive: 3,
    /** A freshly planted bed starts at this bloom. */
    plantBloom: 0.8,
    /** A worn-out bed's bees still work at this share (full bloom: 1). */
    yieldFloor: 0.4,
    /** Each working lavender bee multiplies other beds' wear by this. */
    lavenderCalm: 0.88,
    /** The bee keeper's smoke: every bed wears this much as fast. */
    keeperWear: 0.7,
    /** Spring regrows beds this much faster. */
    springRegrow: 1.4,
    /** Summer: bees work this much harder (honey and sunflowers). */
    summerYield: 1.25,
    /** Honey per clover bee per second at full bloom. */
    cloverHoney: 0.12,
    /** Honey per apple bee per second, outside autumn and in it. */
    appleHoney: 0.02,
    appleAutumnHoney: 0.4,
    /** Ripening added per sunflower bee (0.06 = 6%). */
    sunflowerRipen: 0.03,
    /** Ripening added per apple bee in autumn. */
    appleAutumnRipen: 0.04,
    /** Honey each bee eats per second in winter. */
    winterEat: 0.016,
    /** With no honey in winter, a bee leaves every this many seconds. */
    leaveSeconds: 4,
    /** In the warm seasons, a lost bee comes back every this many seconds. */
    returnSeconds: 20,
    /** One honey sells for this many seconds of ripening, times the season. */
    honeySeconds: 1.5,
    honeyPrice: { spring: 0.8, summer: 0.7, autumn: 1, winter: 1.8 },
    /** Both neighbours must be at least this healthy to cross. */
    crossBloom: 0.6,
    /** Chance per second of a cross at full bloom on both. */
    crossRate: 0.006,
    /** A cross pays this many seconds of ripening at once. */
    crossBurstSeconds: 10,
    /** Every rare flower makes the garden ripen this much faster. */
    rareRipen: 0.06,
    rareMax: 6,
    /** A bed this many seconds from wilting asks for attention. */
    warnSeconds: 20,
    /** How long the scene shows a wilt and a cross. */
    wiltShowSeconds: 6,
    crossShowSeconds: 6,
  },
  /** The farm: helpers by tier, its own water and the towns' market. */
  farm: {
    /** What each helper earns per second, before bonuses. */
    scarecrowRate: 3.2,
    tractorRate: 19,
    glasshouseRate: 120,
    droneRate: 580,
    /** Leftover seeds become this much harvest when the farm opens. */
    seedsToHarvest: 0.004,
    /** The seed bank: keep a share of income as seed, grow richer harvests. */
    bank: {
      /** Shares that can be kept back: none, a quarter, half. */
      shares: [0, 0.25, 0.5] as readonly number[],
      /** The most the bank can add to every harvest (a fraction). */
      maxGain: 2.5,
      /** Seconds of farm income in the bank for half of that. */
      halfSeconds: 100,
      /** Share of the bank that spoils each second. */
      spoilPerSecond: 1 / 240,
      /** The bank opens with this many scarecrows. */
      opensAtScarecrows: 2,
      /** Taps a second counted when the bank is weighed against the farm. */
      referenceTaps: 2,
    },
    /** The farm's thirsty fields: a bigger tank, more thirst, and wells. */
    water: {
      baseCapacity: 40,
      wellCapacity: 60,
      irrigationCapacity: 150,
      /** Units per second each well seeps in, rain or not. */
      wellSeep: 0.18,
      /** Each irrigation channel adds this share to what the rain gives. */
      irrigationRain: 0.2,
      rainMax: 0.9,
      thirst: 0.3,
      /** Thirst added by each scarecrow, tractor, glasshouse and drone. */
      thirstPerHelper: 0.045,
    },
  },
  /** The county fair: a pumpkin to enter about every two minutes. */
  fair: {
    /** Seconds before the first fair, then between fairs. */
    firstWaitSeconds: 45,
    waitSeconds: 110,
    /** The judges take this long to walk the row. */
    judgeSeconds: 5,
    /** Seconds of farm income a ribbon pays: blue, red, garden. */
    placeSeconds: [24, 11, 5],
    /** The chance of a blue ribbon: a floor, plus this much times quality. */
    blueBase: 0.05,
    blueSlope: 0.75,
    /** Of the rest, this share is a red ribbon. */
    redShare: 0.6,
    /** The fair helper enters a waiting fair after this long, at this share. */
    handDelay: 30,
    handShare: 0.5,
    /** A payout flows into the harvest over this many seconds. */
    surgeSeconds: 4,
    /** Fairs finished (or the first glasshouse) before the fair helper turns up. */
    handAfterFairs: 5,
    /** How much of a pumpkin's quality is its size (the rest is shine). */
    sizeWeight: 0.6,
  },
  /** The market: three towns ask for crops, and the asks drift. */
  market: {
    /** How far a wave of demand swings from the usual price. */
    swing: 0.4,
    /** Seconds for the demand to go all the way round. */
    periodSeconds: 330,
    /** Wobble on each crop: step size, pull back to zero, and its limit. */
    wobbleStep: 0.05,
    wobblePull: 0.02,
    wobbleMax: 0.08,
    /** The wave's speed wanders by this, between 0.7 and 1.3 of usual. */
    speedStep: 0.04,
    speedPull: 0.02,
    /** A newly planted crop pays this share of the price while it sprouts. */
    sproutSeconds: 20,
    sproutFloor: 0.5,
    /** The market agent looks this often, and only moves for this gain. */
    agentSeconds: 90,
    agentMargin: 1.25,
    /** A player moves once the best crop pays this much more. */
    playerMargin: 1.15,
  },
  /** The green world: biomes spread over the map, with rivers and clouds. */
  world: {
    /** Leftover farm harvest becomes this much green when the world opens. */
    harvestToGreen: 0.0002,
    /** Green per second from each helper, before bonuses. */
    windbreakRate: 30,
    roverRate: 225,
    seederRate: 1800,
    /** The planet's weather: its own tank, rivers, clouds and thirst. */
    water: {
      baseCapacity: 80,
      riverCapacity: 120,
      /** Units per second each river bend seeps in, rain or not. */
      riverSeep: 0.3,
      /** Each cloud seeder adds this share to what the rain gives. */
      cloudRain: 0.25,
      rainMax: 1.2,
      thirst: 0.4,
      thirstPerHelper: 0.02,
      /** Extra thirst of a fully grown jungle (scaled by its perk curve). */
      jungleThirst: 3,
      /** Wetland: extra tank and a gentle seep, at a fully grown wetland. */
      wetlandCapacity: 160,
      wetlandSeep: 0.4,
    },
    /** Share of the planet a biome gains per second while it spreads. */
    spreadBase: 1 / 3200,
    spreadPerRover: 0.00004,
    spreadPerSeeder: 0.00008,
    /** A newly chosen biome spreads at this share of the speed while it settles. */
    settleSeconds: 15,
    settleFloor: 0.5,
    /**
     * What a fully grown biome adds to green income: a fraction on top of
     * 1. Every biome's gain flattens as it covers more, so a second biome
     * soon beats a bigger first one.
     */
    greenPer: { forest: 0.8, jungle: 1.8, meadow: 0.35, wetland: 0.2 },
    /** Meadow: extra migration seeds at a fully grown meadow (a fraction). */
    meadowSeeds: 1.5,
    /** How much a bot values a unit of migration seeds, and of stored water. */
    seedsWeight: 0.55,
    waterWeight: 1,
    /** The planet counts as green enough for a vault at this cover. */
    vaultCover: 0.7,
    /** A player switches when another biome is this much better. */
    playerMargin: 1.1,
  },
  /** Seed migration: a flock of birds to send somewhere about every two minutes. */
  migration: {
    /** Seconds before the first flock, then between flocks. */
    firstWaitSeconds: 45,
    waitSeconds: 110,
    /** The day's weather in a region is a number between these. */
    weatherLow: 0.6,
    weatherHigh: 1.4,
    /** A fully green region welcomes this much less (a share). */
    greenCut: 0.5,
    /** Each landing greens a region by this much (0 to 1). */
    greenStep: 0.25,
    /** The flock leader sends a waiting flock after this long, at this share. */
    leaderDelay: 30,
    leaderShare: 0.5,
    /** Flights landed before the flock leader turns up. */
    leaderAfterFlights: 2,
    /** A landing flows into the green over this many seconds. */
    surgeSeconds: 4,
    /** A landing still flowing when the world ends becomes this much care. */
    greenToCare: 0.00005,
    /** The most care a flock in flight at the world's end can hand the seed. */
    carryCap: 5,
  },
  /** The old window box: the last pot, and what it asks for. */
  windowbox: {
    /** Care per second from a wind chime and from a dew collector. */
    chimeRate: 3,
    dewRate: 20,
    /** A window lantern makes each unit of care grow the pot this much more. */
    lanternBoost: 1,
    /** Growth (of 100) each unit of care adds to the pot. */
    growthPerCare: 0.00003,
    /** The pot is a sprout from this share grown, and a bud from this one. */
    sproutAt: 0.015,
    budAt: 0.6,
    /** Seconds before the first want, and between one answer and the next. */
    firstWantSeconds: 15,
    restSeconds: 25,
    /** The right answer pays this many seconds of tending, any other this. */
    matchSeconds: 12,
    otherSeconds: 4,
    /** Each watering can adds this share to every answer. */
    canPer: 0.5,
    /** The music box answers after this long, for this share of a right one. */
    boxDelay: 30,
    boxShare: 0.5,
    /** Answers by hand before the music box is offered. */
    boxAfterTends: 4,
  },
  /** Know-how (farm and world): projects and festivals both want it. */
  knowhow: {
    /** Know-how a second from every level of every helper. */
    perLevel: 0.05,
    /** The world learns this much faster than the farm. */
    worldRate: 2.5,
    /** A festival: its price, how long it lasts and how much it multiplies pay. */
    festivalCost: 25,
    festivalSeconds: 45,
    festivalMult: 2,
    /** The three projects of each part, in know-how (cheapest first). */
    costs: [30, 70, 160] as readonly number[],
    /** Drip lines and rain gauges. */
    tankMult: 2,
    thirstMult: 0.5,
    /** The cold store: the seed bank's seed spoils this much as fast. */
    coldStoreSpoil: 0.5,
    /** Hybrid seed (farm) and wildlife corridors (world). */
    hybridMult: 2,
    corridorMult: 2,
    /** The tree nursery: spread speed. */
    nurserySpread: 2,
  },
  /** Forks: one either-or choice per phase (prices are before costScale). */
  forks: {
    yard: {
      cost: 60,
      /** Bug spray: every sprinkler ripens this much more. */
      sprayRipen: 2.2,
      /** Bug spray: the orchard (no bees to set the fruit) boosts this much. */
      sprayOrchard: 1.3,
    },
    farm: {
      cost: 3000,
      /** Scarecrow crew: fields pay this much more, drink less, fair pays double. */
      crewIncome: 1.8,
      crewThirst: 0.7,
      crewFair: 3,
      /** Hired hawk: fields pay this much more, and the county fair stays home. */
      hawkIncome: 2.1,
    },
    world: {
      cost: 8000,
      /** Old forest: forest's green pay and spread speed. */
      forestGreen: 2.2,
      forestSpread: 1.5,
      /** Wetland: wetland's green pay and the water it holds and seeps. */
      wetlandGreen: 9,
      wetlandWater: 2,
    },
    seed: {
      cost: 15,
      /** Morning sun: answers to the pot pay this much more. */
      sunTap: 3,
      /** Night-light: trellis, chime and dew pay this much more. */
      nightHelpers: 2.5,
    },
  },
  /** Start-of-phase gift for each level of the packet, in seconds of helper income. */
  headStartSeconds: 20,
} as const;
