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
  /** By phase index. */
  phases: [
    { tap: 1, helper: 0.6, scalePer: 0.5 },
    { tap: 10, helper: 5, scalePer: 0.5 },
    { tap: 60, helper: 40, scalePer: 0.5 },
    { tap: 1, helper: 0.35, scalePer: 0.5 },
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
    autumn: [1, 1.1, 2],
    winter: [1, 1, 1],
  },
  /** The backyard's harvest: ripe produce waits in the garden until picked. */
  yard: {
    /** Produce per second each helper grows (before bonuses). */
    sprinklerRate: 0.9,
    hiveRate: 3,
    /** The share of ripening produce each helper picks, at the base rate. */
    basketShare: 0.07,
    gardenerShare: 0.13,
    /** The most the pickers can keep up with, before wheelbarrows. */
    pickCap: 0.65,
    /** Each level of compost tea adds this share to ripening. */
    teaPer: 0.5,
    /** The greenhouse multiplies ripening by this. */
    greenhouse: 1.5,
    /** The orchard multiplies ripening by this. */
    orchard: 1.25,
    /** The honey stand multiplies what a hand harvest pays by this. */
    honey: 1.25,
    /** Each wheelbarrow raises the pickers' cap by this much. */
    barrowPer: 0.06,
    /** The hand-harvest button shows once this much is ripe. */
    ripeShown: 5,
    /** The harvest plate lights up at this many seconds of basket work. */
    ripeFor: 25,
  },
  /** The bee dances: a decision about every two minutes, never a timer. */
  bees: {
    /** Seconds of foraging before the first dance, then between dances. */
    firstForageSeconds: 40,
    forageSeconds: 100,
    /** Seconds of ripening a followed best patch is worth. */
    bestSeconds: 12,
    /** A patch the dance does not point at pays this share of the best. */
    otherShare: 0.4,
    /** The bee keeper follows a waiting dance after this long. */
    keeperDelay: 30,
    /** What the keeper's follow pays, as a share of the best patch. */
    keeperShare: 0.45,
    /** A payout flows into the seeds over this many seconds. */
    surgeSeconds: 4,
    /** Dances before the bee keeper turns up. */
    keeperAfterDances: 2,
    /** Dance wobble: degrees and length, around the true patch. */
    angleJitter: 14,
    lengthJitter: 0.06,
  },
  /** The farm: helpers by tier, its own water and the towns' market. */
  farm: {
    /** What each helper earns per second, before bonuses. */
    scarecrowRate: 5,
    tractorRate: 30,
    glasshouseRate: 190,
    droneRate: 900,
    /** Leftover seeds become this much harvest when the farm opens. */
    seedsToHarvest: 0.004,
    /** The farm's thirsty fields: a bigger tank, more thirst, and wells. */
    water: {
      baseCapacity: 40,
      wellCapacity: 60,
      irrigationCapacity: 150,
      /** Units per second each well seeps in, rain or not. */
      wellSeep: 0.12,
      /** Each irrigation channel adds this share to what the rain gives. */
      irrigationRain: 0.2,
      rainMax: 0.9,
      thirst: 0.3,
      /** Thirst added by each scarecrow, tractor, glasshouse and drone. */
      thirstPerHelper: 0.03,
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
    /** Fairs finished before the fair helper turns up. */
    handAfterFairs: 1,
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
  seed: {
    /** Growth (of 100) each unit of care adds to the pot. */
    growthPerCare: 0.5,
  },
  /** Start-of-phase gift for each level of the packet, in seconds of helper income. */
  headStartSeconds: 20,
} as const;
