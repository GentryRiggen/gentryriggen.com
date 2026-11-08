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
    "stair-lamp": 0.525,
    songbird: 3.9,
    hum: 24,
  } as Readonly<Record<string, number>>,
  /**
   * Sway: how a tall tower leans, and its calm (braces, footing, projects).
   * The town and the sky both read the calm; only the town leans.
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
      { name: "Careful", pay: 0.92, lean: 0.05, stack: 5.1 },
      { name: "Easy", pay: 1, lean: 0.22, stack: 3.5 },
      { name: "Quick", pay: 1.15, lean: 0.5, stack: 2.4 },
      { name: "Rush", pay: 1.3, lean: 0.9, stack: 1.6 },
    ] as readonly {
      name: string;
      pay: number;
      lean: number;
      stack: number;
    }[],
    /** The pace a fresh playroom starts at (index into `paces`). */
    startPace: 1,
    /**
     * The pace dial moves one step every this many seconds. (Raised from 2 with
     * the Sky; the Town reads the same value and was retuned on it. Not a
     * Sky-only change.)
     */
    settleSeconds: 3,
    /** The lean eases toward its target; this many seconds to close the gap. */
    leanSeconds: 4,
    /** The tower only stacks (and can only tumble) this long after a tap. */
    armSeconds: 6,
    /** Tumble chance per block: base, per full lean, per block in the streak. */
    tumbleBase: 0.01,
    tumbleLean: 0.4,
    tumbleStreak: 0.006,
    /** Braces and footings never calm the lean below this share of the pace's lean. */
    calmFloor: 0.15,
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
    /**
     * While the toddler stomps, the lean term is this many times as big and
     * the base and streak terms this many times as big.
     */
    toddlerLeanMult: 6,
    toddlerBaseMult: 2,
    /** The scene shows a tumble or a bank for this long. */
    showSeconds: 5,
    /** A pillow from a delivery halves tumbles for this many seconds. */
    softSeconds: 60,
    /** The streak plate lights at this many blocks. */
    plateAt: 5,
  },
  /**
   * The Town's dials (town.ts, foremen.ts): the build pace it shares with the
   * playroom, three foremen's hats, and the shadow a tall tower throws.
   */
  town: {
    /** The town's own pay before foremen and the dark (keeps the part's length). */
    base: 0.775,
    /** What each build pace pays in the town (careful to rush). */
    pacePay: [0.9, 1, 1.1, 1.2] as readonly number[],
    /** How much harder the tall town's lean pushes than the playroom's. */
    leanScale: 1.8,
    /** Braces and footings never calm the town's lean below this share. */
    calmFloor: 0.2,
    /** A fresh site leans this share of full; every helper level adds to it. */
    leanBase: 0.7,
    /** Helper levels at which the tower is as tall (for leaning) as it gets. */
    leanLevels: 14,
    /** Hats, and how long a foreman takes to change over (a whole shift). */
    hats: 3,
    /** An empty hat (or one waiting for a swap) is the site's regular foreman: plain pay. */
    regularPay: 1,
    shiftSeconds: 40,
    /** Two foremen who get on, or clash: their pay is this much more or less. */
    pairLike: 1.1,
    pairClash: 0.9,
    /** The hat toss shows this long after a swap. */
    showSeconds: 5,
    /** A day lasts this long; tomorrow's is on the sign all day. */
    daySeconds: 120,
    /** Market day: taps pay this much more. */
    marketTap: 3,
    /** Night shift: the dark meter reads this much higher before any lamp (a night is dark). */
    nightDark: 0.35,
    /** Windy day: the tower leans this much more. */
    windyLean: 2.2,
    /** Festival: a lit town pays this much more for each step of light. */
    festivalPerLit: 0.18,
    /** A steadying pole holds the lean at half for this long. */
    poleSeconds: 60,
    /** Tower height (levels / 2) at which the shadow is at its longest. */
    shadeFull: 14,
    /** The darkest town pays this much less. */
    cutMax: 0.6,
    /** How much of the dark each street lamp, and the park, take away. */
    lampRelief: 0.3,
    parkRelief: 0.25,
    /** The park is a place to play: the tower leans this much (a share) as usual. */
    parkLean: 0.8,
    /** Taps never pay less than this share, however many foremen slow them. */
    tapFloor: 0.6,
    /** The lights take this long to warm up or cool down when switched. */
    lightWarmSeconds: 10,
    /** The dark (and the pay it takes) eases to a new level over this long. */
    darkEaseSeconds: 10,
    /** Lamps, then the park: price in seconds of the site's pay. */
    lampSeconds: [60, 110, 190] as readonly number[],
    parkSeconds: 360,
    /** Lamps and the park never cost less than this many bricks a second's worth. */
    priceFloor: 40,
    /** Every step of light (the park counts as two) costs this share of the bricks, all the time. */
    lightUpkeep: 0.16,
    /** The lights-on moment shows this long. */
    lightsShowSeconds: 5,
  },
  /**
   * The Sky's three dials (sky.ts): a forecast you bet on (wind), the cable's
   * strain, and the optional no-crane climb. Pace is merged into strain here:
   * two dials that both trade speed for a loss would only be one.
   */
  sky: {
    /** The sky's own pay before strain (keeps the part's length). */
    base: 0.96,
    /**
     * Slack to humming: pay, how much of it is left while clouds gather (a
     * tight cable hums in the wind and hoists slowly), then the chance per
     * second of a snap in calm air, and per second of a snap and of a drop
     * while a gust blows.
     */
    strains: [
      { name: "Slack", pay: 0.85, drag: 1, calm: 0, snap: 0.005, drop: 0.02 },
      {
        name: "Taut",
        pay: 1.05,
        drag: 1,
        calm: 0.0004,
        snap: 0.02,
        drop: 0.05,
      },
      {
        name: "Tight",
        pay: 1.15,
        drag: 0.9,
        calm: 0.002,
        snap: 0.08,
        drop: 0.13,
      },
      {
        name: "Humming",
        pay: 1.4,
        drag: 0.6,
        calm: 0.006,
        snap: 0.2,
        drop: 0.2,
      },
    ] as readonly {
      name: string;
      pay: number;
      drag: number;
      calm: number;
      snap: number;
      drop: number;
    }[],
    /** While clouds gather or a gust is sure, calm-air snaps are this many times likelier. */
    cloudSnapMult: 4,
    startStrain: 1,
    /** The dial moves one step every this many seconds. */
    settleSeconds: 2.5,
    /** The forecast moves a step this often: calm, clouds, then a sure gust. */
    stepSeconds: 10,
    /** From a calm sky, clouds gather; from clouds, a sure gust (else it clears). */
    cloudChance: 0.18,
    gustChance: 0.6,
    /** After a gust the sky stays clear for a while: clouds gather this much less often. */
    spellSeconds: 30,
    spellMult: 0.2,
    /** A gust blows this long, and is light or strong (known once it is sure). */
    gustSeconds: 4,
    strongChance: 0.5,
    lightMult: 0.25,
    strongMult: 3,
    /** A strong gust also pulls a loose load free at any strain, this chance a second (only a tie-down stops it). */
    strongDropRate: 1,
    /** The load on the hook is the last this many seconds of hoisting. */
    hookSeconds: 36,
    /** After a drop the crew spends this long fetching it; after a snap, restringing. */
    stallSeconds: 3,
    restringSeconds: 5,
    /** Tying down and untying each take this long, and the crane earns nothing. */
    tieSeconds: 2,
    untieSeconds: 2,
    /** Braces and ballast never calm the risks below this share. */
    calmFloor: 0.25,
    /** The no-crane climb: how long, how much the pay drops to, and the prize. */
    ncSeconds: 55,
    ncPay: 0.25,
    ncBonus: 0.1,
    ncMax: 4,
    /** A climb that fails leaves the crew resting this long, earning nothing. */
    ncFailSeconds: 16,
    /** Giving a climb up leaves the crew resting this long (less than a failed one). */
    ncGiveUpSeconds: 7,
    /** A spare cable (a delivery) halves the risks for this long. */
    softSeconds: 60,
    /** The scene shows a drop, a snap, a tie or a win for this long. */
    showSeconds: 4,
    /** The wind plate lights when clouds gather. */
    plateAt: 1,
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
      steelKnow: 0.75,
      /** Timber: helpers pay this much; know-how this fast; sway this much. */
      timberPay: 1.5,
      timberKnow: 1.2,
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
    descentPerQuiet: 0.000015,
    /** A block lantern makes each unit of quiet count this much more. */
    lanternBoost: 1,
    /**
     * Keepsakes to carry down (keepsakes.ts). The pack holds `packSize` of
     * weight; every unit of weight carried slows each step by `slowPerWeight`
     * (the old lift carries it, so only `liftEase` of that). Each sits on the
     * way down at `share` of the descent (the descent speeds up, so the
     * shares are spread to land about a minute or three apart for a player
     * at a steady pace). Setting one down stops the robot
     * for `setDownSeconds`; the scene shows a pickup or a goodbye for
     * `showSeconds`.
     */
    keepsakes: {
      packSize: 4,
      slowPerWeight: 0.2,
      liftEase: 0.5,
      setDownSeconds: 8,
      showSeconds: 5,
      items: [
        { id: "marble", share: 2e-5, weight: 1 },
        { id: "feather", share: 0.00066, weight: 1 },
        { id: "bolt", share: 0.00366, weight: 2 },
        { id: "blueprint", share: 0.01657, weight: 1 },
        { id: "key", share: 0.086, weight: 1 },
        { id: "bulb", share: 0.276, weight: 1 },
        { id: "star", share: 0.795, weight: 1 },
        { id: "daisy", share: 0.94, weight: 1 },
      ] as readonly { id: string; share: number; weight: number }[],
    },
  },
  /** Start-of-phase gift for each level of the box of blocks, in seconds of helper income. */
  headStartSeconds: 20,
} as const;
