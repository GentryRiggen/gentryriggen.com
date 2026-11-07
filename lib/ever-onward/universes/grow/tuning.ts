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
  /**
   * The farm's harvest day: the towns send a cart every `daySeconds`. What
   * the planted crop pays depends on what the towns want ON THAT DAY, and
   * the forecast of it firms up as the day comes closer.
   */
  market: {
    /** Seconds between harvest days. */
    daySeconds: 110,
    /** A crop needs this long in the ground to be fully grown. */
    growSeconds: 60,
    /** What a crop that has only just gone in pays (full grown: 1). */
    growFloor: 0.5,
    /** How far the slow wave of demand swings from the usual price. */
    swing: 0.4,
    /** Seconds for the wave to go all the way round. */
    periodSeconds: 900,
    /** The wave also jumps about by up to this many radians each day. */
    angleJitter: 0.9,
    /** Each day's luck: demand moves by up to this much, per crop. */
    luck: 0.8,
    /** Luck never sinks a crop's demand below this share of the usual price. */
    demandFloor: 0.3,
    /** Beans pay a steady share of the usual price and rest the soil. */
    beanDemand: 0.75,
    /** What the fields pay between harvest days, against the old market. */
    fieldBase: 1.5,
    /** A bare field pays this much, and a grown crop this much more. */
    bareShare: 0.65,
    growShare: 0.1,
    /** What a harvest day pays: this share of a day of farm pay, times demand. */
    daySharePay: 0.8,
    /** Taps a second counted when a day of farm pay is worked out. */
    referenceTaps: 2,
    /** The day's pay flows in over this many seconds. */
    surgeSeconds: 4,
    /** The cart starts rolling in this many seconds before harvest day. */
    cartSeconds: 40,
    /** How long the scene shows a harvest day's cheer or droop. */
    showSeconds: 9,
    /** A pay this close to the best the day offered counts as a match. */
    matchShare: 0.93,
    /** A crop that sold under this share of the usual price droops. */
    droopBelow: 0.85,
    /** The market agent plants this far into each day. */
    agentAt: 55,
  },
  /** The soil: wears when a crop is repeated, rests after beans. */
  soil: {
    /** A fresh farm's soil (0 worn out, 1 rich). */
    start: 0.6,
    /** Growing the same crop twice takes this much from the soil. */
    wear: 0.22,
    /** A bean harvest gives this much back. */
    rest: 0.3,
    /** Yield at worn out soil, and the most a rich soil adds. */
    floor: 0.8,
    reach: 0.4,
  },
  /** The prize pumpkin: feed it, risk it, enter it on a harvest day. */
  pumpkin: {
    /** Steps from a seedling (0) to a giant (the last). */
    steps: 5,
    /** Feeding costs this many seconds of farm pay, from each step. */
    feedSeconds: [6, 9, 13, 22, 38] as readonly number[],
    /** The chance it splits when fed from each step. */
    splitChance: [0.04, 0.1, 0.2, 0.35, 0.5] as readonly number[],
    /** The chance of a blue ribbon at each step. */
    blueChance: [0.02, 0.06, 0.14, 0.28, 0.44, 0.62] as readonly number[],
    /** Of the rest, this share is a red ribbon. */
    redShare: 0.6,
    /** Seconds of farm pay each ribbon is worth for a full-size pumpkin: blue, red, garden. */
    ribbonSeconds: [430, 143, 43] as readonly number[],
    /**
     * How much of that a ribbon pays at each size, seedling first: a small
     * pumpkin's ribbons are worth little, so waiting and feeding is the bet.
     */
    sizePay: [0.2, 0.38, 0.62, 0.95, 1.2, 2] as readonly number[],
    /** The judges take this long to walk the row. */
    judgeSeconds: 5,
    /** A ribbon's pay flows in over this many seconds. */
    surgeSeconds: 4,
    /** The pumpkin helper enters it this far into a day, at this share. */
    handDelay: 20,
    handShare: 0.5,
    /** Harvest days held before the pumpkin helper turns up. */
    handAfterDays: 6,
    /** How long the scene shows a ribbon or a split. */
    showSeconds: 10,
  },
  /** The green world: biomes spread over the map, with rivers and clouds. */
  world: {
    /**
     * The world opens with this much green however the farm ended (the
     * farm's leftover harvest was a lottery that decided how the world began).
     * A well-stocked barn adds up to `openingLeftover` more, no further than
     * `openingLeftoverFull` harvest.
     */
    /**
     * Careful: 1500 until 56c03642, 1800 since. The world is tuned so a
     * player who tends it lands a little over the scorecard's 2.0 h length
     * floor, so any change here moves the finish (re-run the scorecard).
     */
    openingGreen: 1800,
    /** A payout still flowing when the farm ends turns into green at this rate, up to a cap. */
    harvestToGreen: 0.0002,
    carryCap: 150,
    openingLeftover: 0.1,
    openingLeftoverFull: 8_000_000,
    /** Green per second from each helper, before bonuses. */
    windbreakRate: 36,
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
      rainMax: 2.8,
      /** The planet's rain swings harder than a yard's: long dry and rainy spells. */
      outlookWobble: 0.14,
      thirst: 0.4,
      thirstPerHelper: 0.02,
      /** Thirst of a jungle covering the whole planet; it grows with the square of its share. */
      jungleThirst: 56,
      /** Wetland: extra tank and a gentle seep, at a fully grown wetland. */
      wetlandCapacity: 160,
      wetlandSeep: 0.4,
    },
    /** Share of the planet the green reaches per second, before helpers. */
    spreadBase: 1 / 3200,
    spreadPerRover: 0.00004,
    spreadPerSeeder: 0.00008,
    /**
     * The mix sliders: a biome's share moves toward its slider's goal at this
     * much of the planet per second, so changing your mind takes a minute or so.
     */
    shiftPerSecond: 0.004,
    /**
     * What a fully grown biome adds to green income: a fraction on top of
     * 1. Every biome's gain flattens as it covers more, so a second biome
     * soon beats a bigger first one.
     */
    greenPer: { forest: 0.8, jungle: 1.8, meadow: 0.35, wetland: 0.2 },
    /** Meadow: how much faster the green spreads at a fully grown meadow. */
    meadowSpread: 1.5,
    /** The mix a fresh world starts with (half forest, a little of the rest), as slider points. */
    startMix: [6, 5, 5, 4] as readonly number[],
    /** Slider points a biome can hold, 0 to this. */
    maxPoints: 10,
    /**
     * Blight: a biome that covers more than `blightAt` of the planet starts to
     * rot. The rot climbs by `blightRise` a second (more the further past the
     * line), eases by `blightHeal` once the biome is back under, and takes up
     * to `blightCut` of that biome's green.
     */
    blightAt: 0.42,
    /** The land counts as at least this green when sizing a biome's share of it. */
    blightMinCover: 0.15,
    /** The mix plate shows when the tank is under this much with a jungle past `thirstyJungle`. */
    lowTank: 0.45,
    thirstyJungle: 0.2,
    blightRise: 0.01,
    blightExtra: 2.5,
    blightHeal: 0.02,
    blightCut: 0.85,
    /** Rot shows from this much; healing from this much shows the wave. */
    blightShows: 0.08,
    /** Seconds the HEALED wave and the first rot flash show for. */
    healShowSeconds: 7,
    /** A dry world sheds this share of the planet a second (jungle most). */
    dryErode: 0.002,
    dryThirst: { forest: 0.35, jungle: 1, meadow: 0.25, wetland: 0 },
    /** The planet counts as green enough for a vault at this cover. */
    vaultCover: 0.7,
  },
  /**
   * The old window box: one pot, and one quiet choice, how much sun it gets.
   * More sun grows it faster and dries the soil out; shade is slow and keeps
   * it moist. The sky changes how much sun is right, and the leaves tell.
   */
  windowbox: {
    /** Care per second from a wind chime and from a dew collector. */
    chimeRate: 3,
    dewRate: 20,
    /** Care per second from a sun-catcher (between the chime and the dew). */
    catcherRate: 7,
    /** A window lantern makes each unit of care grow the pot this much more. */
    lanternBoost: 1,
    /** Growth (of 100) the pot adds a second just from the light, at a pace of 1. */
    lightGrowth: 0.031,
    /** Growth (of 100) each unit of care adds to the pot, at a pace of 1. */
    growthPerCare: 0.0002,
    /** The pot is a sprout from this share grown, and a bud from this one. */
    sproutAt: 0.015,
    budAt: 0.6,
    /** The blind has this many places (0 drawn, the last wide open). */
    steps: 3,
    startAim: 1,
    /** Seconds the blind takes to move one place. */
    moveSeconds: 4,
    startMoist: 0.55,
    /** Each deeper pot makes the soil change this share as fast (a slower dial). */
    deepPer: 0.72,
    /** Soil moisture lost each second, for each unit of sun on the pot. */
    evap: 0.04,
    /**
     * The sky, in the order it can come. `sun` is how strong the light is
     * outside; `wet` is moisture the soil gains each second from the air.
     */
    skies: [
      { id: "rain", sun: 0.35, wet: 0.019 },
      { id: "cloud", sun: 0.7, wet: 0.012 },
      { id: "bright", sun: 1.2, wet: 0.012 },
      { id: "heat", sun: 1.9, wet: 0.012 },
    ] as readonly { id: string; sun: number; wet: number }[],
    /** The sky changes after this many seconds, plus up to `skySpan` more. */
    skyMin: 45,
    skySpan: 45,
    /**
     * The leaves curl (a warning) below `curlBelow` and droop above
     * `droopAbove`. Past `dryBelow` or `soggyAbove` they have gone crisp or
     * floppy, and growth slows the further it goes.
     */
    curlBelow: 0.35,
    droopAbove: 0.75,
    dryBelow: 0.2,
    soggyAbove: 0.9,
    /** Sun on the pot at which growth stops getting faster. */
    sunFull: 0.8,
    /** Share of the pace sun alone gives with no light at all. */
    sunFloor: 0.1,
    /** Share of the pace left when the soil is bone dry or flooded. */
    moistFloor: 0.1,
    /** The pace (times the care rate): the worst and the best. */
    paceMin: 0.15,
    paceMax: 1.5,
    /** The sun's effect on growth must be at least this for the pot to thrive. */
    thriveSun: 0.7,
    /** Seconds of good growing in a row that make the pot thrive. */
    thriveAfter: 8,
    /** Seconds before the pot can thrive again after it has. */
    thriveRest: 25,
    /** Seconds the scene shows a thrive or a wilt. */
    momentSeconds: 4.5,
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
    /** The compost heap: the soil wears this much as fast when a crop repeats. */
    heapWear: 0.5,
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
      /** Morning sun: the pot grows this much faster from the light itself. */
      sunGrowth: 4.5,
      /** Night-light: trellis, chime and dew pay this much more. */
      nightHelpers: 2.5,
    },
  },
  /** Start-of-phase gift for each level of the packet, in seconds of helper income. */
  headStartSeconds: 20,
} as const;
