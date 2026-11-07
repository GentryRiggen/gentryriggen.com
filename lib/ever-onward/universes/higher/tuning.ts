/** Every balance number for Build It Higher, in one place. */
export interface PhaseTuning {
  /** What one tap earns before any bonus. */
  tap: number;
  /** What each scaling level adds to taps and helpers alike. */
  scalePer: number;
}

export const TUNING = {
  /** Every level of a helper line multiplies its output by this (see `stacked`). */
  stackGrowth: 1.6,
  /** Every upgrade's price in a phase is multiplied by this (playroom, town, sky, top). */
  costScale: [4.5, 3.6, 6.5, 10] as readonly number[],
  /** Repeatable upgrades climb this much steeper in a phase that needs it. */
  costSteepness: [1, 1, 1.2, 1] as readonly number[],
  /** By phase index. */
  phases: [
    { tap: 1.4, scalePer: 0.6 },
    { tap: 10, scalePer: 0.6 },
    { tap: 28, scalePer: 0.6 },
    { tap: 1, scalePer: 0.6 },
  ] as readonly PhaseTuning[],
  /** What each helper line earns per second at level 1, before bonuses. */
  rates: {
    bear: 0.6,
    ramp: 3.6,
    "toy-crane": 18,
    mason: 5,
    crane: 32,
    "concrete-truck": 190,
    "sky-crew": 40,
    "cloud-crane": 150,
    "cable-spinner": 700,
    "stair-lamp": 0.35,
    songbird: 2.6,
    hum: 16,
  } as Readonly<Record<string, number>>,
  /**
   * Sway: a tall tower leans, and the crew slows when it does. Never a loss:
   * pay drops to half at the worst, and one press of Steady puts it right.
   */
  sway: {
    /** Share of the whole scale a tower sways per second, by phase. */
    rise: [1 / 150, 1 / 130, 1 / 110] as readonly number[],
    /** Each level of every helper makes it sway this much faster. */
    perLevel: 0.05,
    /** Each brace upgrade makes it sway this much slower (a multiplier). */
    brace: 0.7,
    /** Footing: sway builds 1 / (1 + footing gain * this) as fast. */
    footing: 1,
    /**
     * A braced tower rights itself: every brace level (a fort counts as two)
     * takes this share of the lean away each second.
     */
    relax: 0.004,
    /** Sway starts costing pay above this, down to `floor` at 1. */
    from: 0.5,
    floor: 0.55,
    /** The steady button works above this. */
    steadyAt: 0.15,
    /** Hard hats and wind tunnels: sway builds this much as fast. */
    projectMult: 0.5,
    /** A cushion fort or a cable damper: sway builds this much as fast. */
    fortMult: 0.5,
    /** A steadying pole from a delivery takes this much off. */
    poleRelief: 0.7,
  },
  /**
   * The Playroom's two dials (playroom.ts): the build pace and the streak.
   * Pace trades pay and speed against a leaning tower; the streak is a pot
   * that grows block by block, banked for a bonus or lost in a tumble.
   */
  playroom: {
    /** Careful to rush: pay, how far it leans, seconds between blocks. */
    paces: [
      { name: "Careful", pay: 0.9, lean: 0.05, stack: 5.1 },
      { name: "Easy", pay: 1, lean: 0.22, stack: 3.5 },
      { name: "Quick", pay: 1.12, lean: 0.5, stack: 2.4 },
      { name: "Rush", pay: 1.22, lean: 0.9, stack: 1.6 },
    ] as readonly {
      name: string;
      pay: number;
      lean: number;
      stack: number;
    }[],
    /** The pace a fresh playroom starts at (index into `paces`). */
    startPace: 1,
    /** The pace dial moves one step every this many seconds. */
    settleSeconds: 2,
    /** The lean eases toward its target; this many seconds to close the gap. */
    leanSeconds: 4,
    /** The tower only stacks (and can only tumble) this long after a tap. */
    armSeconds: 6,
    /** Tumble chance per block: base, per full lean, per block in the streak. */
    tumbleBase: 0.01,
    tumbleLean: 0.3,
    tumbleStreak: 0.008,
    /** Braces and footings never calm the lean below this share of the pace's lean. */
    calmFloor: 0.7,
    tumbleMax: 0.75,
    /** The streak stops growing here. */
    streakMax: 40,
    /** The streak is worth `pot * blocks ^ potPower` seconds of building. */
    pot: 0.24,
    potPower: 2,
    /** Banking pauses the stacking this long while the crew cheers. */
    bankPause: 5,
    /** A streak shorter than this cannot be banked. */
    bankMin: 3,
    /**
     * A tumble sends blocks everywhere: the crew spends this long picking
     * them up, paid at this share of the usual rate.
     */
    rebuildSeconds: 6,
    rebuildPay: 0.4,
    /** The toddler: gap between visits, warning before, and how long it stomps. */
    toddlerGap: [22, 34] as readonly [number, number],
    toddlerWarn: 6,
    toddlerStomp: 14,
    /** While the toddler stomps, a tumble is this many times as likely. */
    toddlerMult: 5,
    /** The scene shows a tumble or a bank for this long. */
    showSeconds: 5,
    /** A pillow from a delivery halves tumbles for this many seconds. */
    softSeconds: 60,
    /** The streak plate lights at this many blocks. */
    plateAt: 5,
  },
  /** Foundations: the spend-now-or-invest choice of the first three parts. */
  footing: {
    /** Shares that can be kept back: none, a quarter, half. */
    shares: [0, 0.25, 0.5] as readonly number[],
    /** The most the footing can add to every payout (a fraction). */
    maxGain: 1.5,
    /** Seconds of income in the footing for half of that. */
    halfSeconds: 80,
    /** Share of the footing that settles away each second. */
    spoilPerSecond: 1 / 240,
    /** Taps a second counted when the footing is weighed against the site. */
    referenceTaps: 2,
  },
  /** Deliveries: a load to place about every minute and a half. */
  deliveries: {
    firstWaitSeconds: 40,
    waitSeconds: 80,
    /** The way down is quiet, with a small moment more often. */
    topWaitSeconds: 55,
    /** Seconds of income each load is worth. */
    materialSeconds: 12,
    poleSeconds: 5,
    stoneSeconds: 6,
    /** Know-how a plan load gives (the town and the sky). */
    planKnowhow: 12,
    /** The loading dock (a project) multiplies loads by this. */
    dockMult: 2,
  },
  /** Know-how (town and sky): projects and overtime both want it. */
  knowhow: {
    perLevel: 0.05,
    skyRate: 2.5,
    overtimeCost: 25,
    overtimeSeconds: 45,
    overtimeMult: 1.7,
    costs: [30, 70, 160] as readonly number[],
    /** Ready-mix: footing settles this much as fast. */
    readyMixSpoil: 0.5,
    /** Prefab floors and carbon cable. */
    prefabMult: 2,
    cableMult: 2,
  },
  /** One-off boosts (fairy lights and the like). */
  oneOffs: {
    fairyLights: 1.6,
    neonSign: 1.6,
    beacon: 1.6,
    restBench: 1.6,
    windowSeat: 1.6,
  },
  /** Forks: one either-or choice per phase (prices are before costScale). */
  forks: {
    play: {
      cost: 60,
      /** Tall and thin: helpers pay this much more and it sways this much faster. */
      tallPay: 2.1,
      tallSway: 2,
      /** Wide and sturdy: helpers pay this much and it sways this much slower. */
      widePay: 1.65,
      wideSway: 0.4,
    },
    town: {
      cost: 3000,
      /** Steel: helpers pay this much; know-how comes this fast. */
      steelPay: 2,
      steelKnow: 0.5,
      /** Timber: helpers pay this much; know-how this fast; sway this much. */
      timberPay: 1.5,
      timberKnow: 1.6,
      timberSway: 0.5,
    },
    sky: {
      cost: 8000,
      /** Space elevator: helpers pay this much; loads from the town pay this much. */
      elevatorPay: 2.1,
      elevatorLoads: 0.5,
      /** Cloud terraces: helpers pay this much; loads this much. */
      terracePay: 1.6,
      terraceLoads: 1.5,
    },
    top: {
      cost: 15,
      /** The stairs: your own steps pay this much more. */
      stairsTap: 4,
      /** ... and the lamps along them pay this much more. */
      stairsHelpers: 1.3,
      /** The old lift: helpers pay this much more. */
      liftHelpers: 1.9,
    },
  },
  /** The way down: quiet turns into steps, steps into the ground. */
  top: {
    /** Share of the descent (of 100) each unit of quiet adds. */
    descentPerQuiet: 0.000018,
    /** A block lantern makes each unit of quiet count this much more. */
    lanternBoost: 1,
  },
  /** Start-of-phase gift for each level of the box of blocks, in seconds of helper income. */
  headStartSeconds: 20,
} as const;
