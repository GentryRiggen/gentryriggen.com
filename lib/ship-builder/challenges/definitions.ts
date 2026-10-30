import type { BreakMode, SimSea } from "../sim/types";

export const CHALLENGE_IDS = ["outlast", "evacuation", "shipshape"] as const;
export type ChallengeId = (typeof CHALLENGE_IDS)[number];

export type Stars = 0 | 1 | 2 | 3;

/**
 * Where the iceberg strikes in the iceberg challenges, as a fraction of her
 * length from the bow: the same spot as "Hit with an iceberg", which sinks
 * the Titanic.
 */
export const CHALLENGE_STRIKE_FRACTION = 0.2;

/** Story minutes stored for a ship that never sinks (a full day). */
export const NEVER_SINKS_MINUTES = 1440;

/** Story minutes the real Titanic took to go down: 2 hours 40 minutes. */
export const TITANIC_MINUTES = 160;

/**
 * Story-free value of a challenge that did not apply (a ship that stayed
 * afloat has no sinking to escape). Never stored or sent to the board.
 */
export const NOT_SCORED = -1;

/**
 * Shipshape: the most a stormy sea may heel her, in degrees from her resting
 * list, for the third star. A stable, level ship rolls about 27.7 degrees; a
 * top-heavier one more.
 */
export const STEADY_PEAK_ROLL_DEG = 28;

/**
 * Shipshape: how high her weight may sit (`stabilityRatio`, the lever of the
 * weight above the waterline over her width; lower is steadier and below zero
 * is ballasted) for each star. The stormy sim rolls every stable ship the
 * same, so this margin is what tells ships apart: the Titanic (0.109) earns
 * two stars, a low warship or pirate sloop three, a tall container ship or
 * cruise liner one.
 */
export const SOLID_STABILITY_RATIO = 0.12;
export const STEADY_STABILITY_RATIO = 0.06;

export type ChallengeTrial =
  | {
      kind: "iceberg";
      sea: SimSea;
      breakMode: BreakMode;
      /** The gash runs the whole hull, so every ship really sinks. */
      isWholeHull?: boolean;
    }
  | { kind: "waves"; sea: SimSea };

export interface ChallengeDef {
  id: ChallengeId;
  title: string;
  /** One plain sentence for a young builder. */
  blurb: string;
  trial: ChallengeTrial;
  /** The value that earns 1, 2 and 3 stars (3 = best). All are "at least". */
  starAt: readonly [number, number, number];
  /** What to change to beat the next star. */
  tip: string;
}

export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: "outlast",
    title: "Outlast the Titanic",
    blurb: "Hit an iceberg and stay afloat as long as you can.",
    trial: { kind: "iceberg", sea: "calm", breakMode: "real" },
    starAt: [60, TITANIC_MINUTES, NEVER_SINKS_MINUTES],
    tip: "Add watertight walls (bulkheads) and make them tall, so water stays in the sections the iceberg opened.",
  },
  {
    id: "evacuation",
    title: "Everyone off safely",
    blurb: "When she sinks, get as many people into lifeboats as you can.",
    trial: {
      kind: "iceberg",
      sea: "calm",
      breakMode: "real",
      isWholeHull: true,
    },
    starAt: [25, 75, 100],
    tip: "Add lifeboats on davits, spread along both sides of the deck, so every passenger has a seat nearby.",
  },
  {
    id: "shipshape",
    title: "Shipshape",
    blurb: "Ride out a stormy sea steadily, with your weight kept low.",
    trial: { kind: "waves", sea: "stormy" },
    starAt: [1, 2, 3],
    tip: "Build fewer levels on top, keep heavy blocks low, widen the hull and balance the weight, so her weight sits lower.",
  },
];

export function challengeDef(id: ChallengeId): ChallengeDef {
  const def = CHALLENGES.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown challenge ${id}`);
  return def;
}

export function isChallengeId(value: unknown): value is ChallengeId {
  return (CHALLENGE_IDS as readonly unknown[]).includes(value);
}

/** The most a stored value can be for a challenge (also the rules' limit). */
export const MAX_VALUE: Record<ChallengeId, number> = {
  outlast: NEVER_SINKS_MINUTES,
  evacuation: 100,
  shipshape: 3,
};

/** Stars a best value earns, 0 to 3. */
export function starsFor(id: ChallengeId, value: number): Stars {
  const [one, two, three] = challengeDef(id).starAt;
  if (value >= three) return 3;
  if (value >= two) return 2;
  if (value >= one) return 1;
  return 0;
}

/** The value that earns the next star, or null at three stars. */
export function nextStarAt(id: ChallengeId, value: number): number | null {
  const stars = starsFor(id, value);
  return stars === 3 ? null : challengeDef(id).starAt[stars];
}
