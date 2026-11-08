import { visitorHereFlag } from "../../engine/engine";
import type { RunState } from "../../engine/types";
import { forkSide } from "./forks";
import { isParadeOn, isProjectDone } from "./knowhow";
import {
  TRUST_STAGES,
  eventLook,
  isAway,
  isMoving as isScooting,
  justLanded,
  justPulled,
  landCount,
  movingTo as scootingTo,
  pullCount,
  pullWhy,
  seatOf,
  tellOf,
  trustFraction,
  trustStage,
  type TrustStage,
} from "./quiet";
import { PHASE_IDS, type SmilePhaseId } from "./resources";
import {
  activityOf,
  bondOf,
  hintOf,
  hintStage,
  isSwitching,
  isTogetherOpen,
  justLit,
  justSighed,
  litCount,
  sighCount,
  wearOf,
} from "./together";
import {
  DAY_RAIN,
  DAY_PARTY,
  STREET_COUNT,
  crowdOf,
  dayKind,
  dayStreet,
  floatsOn,
  isMoving,
  isRepainting,
  isTownOpen,
  lastArrival,
  lastGrump,
  moodOfStreet,
  movingTo,
  priceOf,
} from "./town";
import { RETURN_VISITOR_ID } from "./visitors";
import {
  DAY_FESTIVAL,
  DAY_GLOOM,
  DAY_WEARY,
  dayKind as worldDayKind,
  droneCount,
  healCount,
  isRetuning,
  isWorldOpen,
  justDroned,
  justHealed,
  justLost,
  levelOf,
  lostCount,
  realOf,
} from "./world";

/** The few numbers the picture needs; the scene redraws only when they change. */
export interface SmileSceneInfo {
  phase: SmilePhaseId;
  /** This part's fork: 0 not chosen, 1 the first side, 2 the second. */
  fork: number;
  /** The three helper lines, by level owned in this part. */
  a: number;
  b: number;
  c: number;
  d: number;
  /** Scaling levels owned in this part. */
  scaling: number;
  /** Whether this part's ending purchase is made. */
  ended: boolean;
  /** The part's extra one-offs, drawn when owned. */
  extraA: number;
  extraB: number;
  extraC: number;
  /**
   * Town, once the stand and the route are open: the price (-1 until then),
   * the sign is being repainted, the day ("" plain, "hot", "rain2", "party1":
   * the street follows), floats on each street ("1-2-0-0"), each street's
   * mood (0 grumpy to 3 delighted, "3201"), a float on the road (the street it
   * goes to, -1 none), and the two big moments (a float just arrived, a street
   * just turned grumpy: the street, -1 none).
   */
  price: number;
  /** The crowd at the stand, in tenths (0 to 10). */
  crowd: number;
  painting: boolean;
  day: string;
  crew: string;
  moods: string;
  moving: number;
  arrived: number;
  grumped: number;
  /**
   * World: the broadcast is on; once the dial is open, the loudspeaker level
   * (0 to 4), it is being retuned, the share of smiles that are real in
   * tenths (10 = all real), the day ("" plain, "fest", "gloom", "weary"), and
   * the three big moments (faces painted over, real smiles back, HypnoDrones
   * launched: each one's running count while it shows, else 0).
   */
  parade: boolean;
  loud: number;
  retune: boolean;
  real: number;
  wday: string;
  lostKey: number;
  healKey: number;
  droneKey: number;
  /** Which know-how projects are done (bit 0, 1 and 2). */
  projects: number;
  /** Friend: the bond's tier (0 to 3). */
  bond: number;
  /**
   * Friend, once what you do together is open: what you are doing (0 jokes, 1
   * games, 2 listening), the change is under way, what the face hints at (-1
   * nothing yet) and how sure it is (0 to 2), how worn thin the activity is in
   * quarters (0 to 4), and the two big moments (lit up, sighed; a sigh is
   * about being worn thin when `sighThin`).
   */
  doing: number;
  switching: boolean;
  hint: number;
  sure: number;
  thin: number;
  lit: boolean;
  sigh: boolean;
  sighThin: boolean;
  /** Which light-up and which sigh is showing (their running counts, else 0). */
  litKey: number;
  sighKey: number;
  /** Quiet: whole percent of trust (steps of 5), and the face's stage. */
  trust: number;
  face: TrustStage;
  /**
   * Quiet bench: the seat you sit at (0 the far end to 4 side by side), the
   * seat you are scooting to (-1 not moving), their body language (0 pulling
   * away to 3 leaning in), they sit at the far end after pulling away, what is
   * happening ("", "bird", "snack", "warn", "truck"), and the two big moments
   * (stepped closer, pulled away: the running count while it shows, else 0;
   * a pull is about staying when it turned when `pullStayed`).
   */
  seat: number;
  scoot: number;
  tell: number;
  away: boolean;
  happening: string;
  landKey: number;
  pullKey: number;
  pullStayed: boolean;
  /** Quiet: someone smiled. */
  visitorHere: boolean;
}

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** [a, b, c, d, scale, extraA, extraB, extraC, ender] ids per phase. */
const IDS: readonly (readonly string[])[] = [
  [
    "balloon",
    "puppy",
    "lemonade",
    "magic-hat",
    "joke-book",
    "bracelet",
    "",
    "",
    "next-door",
  ],
  [
    "clown",
    "band",
    "smile-factory",
    "fireworks",
    "bunting",
    "bench",
    "",
    "",
    "key-to-town",
  ],
  [
    "poster",
    "loudspeaker",
    "cheer-tower",
    "cheer-blimp",
    "bigger-brush",
    "mask-booth",
    "no-bad-days",
    "",
    "cheer-satellite",
  ],
  [
    "tea",
    "blanket",
    "rain",
    "candle",
    "long-silence",
    "",
    "room-on-bench",
    "",
    "",
  ],
];

const PROJECT_IDS: readonly (readonly string[])[] = [
  [],
  ["big-top", "shady-corners", "confetti-cannons"],
  [
    "quiet-hours",
    "every-language",
    "grin-guide",
    "smile-filters",
    "hypno-drones",
    "listening-benches",
  ],
  [],
];

const level = (run: RunState, id: string): number => (id ? owned(run, id) : 0);

/** The bond's tier: empty, a little, a good deal, nearly full. */
function bondTier(run: RunState): number {
  if (run.phase !== 0) return 0;
  const bond = bondOf(run);
  return bond >= 0.6 ? 3 : bond >= 0.3 ? 2 : bond >= 0.05 ? 1 : 0;
}

function togetherInfo(
  run: RunState
): Pick<
  SmileSceneInfo,
  | "doing"
  | "switching"
  | "hint"
  | "sure"
  | "thin"
  | "lit"
  | "sigh"
  | "sighThin"
  | "litKey"
  | "sighKey"
> {
  if (!isTogetherOpen(run))
    return {
      doing: 0,
      switching: false,
      hint: -1,
      sure: 0,
      thin: 0,
      lit: false,
      sigh: false,
      sighThin: false,
      litKey: 0,
      sighKey: 0,
    };
  const act = activityOf(run);
  return {
    doing: act,
    switching: isSwitching(run),
    hint: hintOf(run),
    sure: hintStage(run),
    thin: Math.round(wearOf(run, act) * 4),
    lit: justLit(run),
    sigh: justSighed(run),
    sighThin: (run.resources.tgSighWhy ?? 0) === 0,
    litKey: justLit(run) ? litCount(run) : 0,
    sighKey: justSighed(run) ? sighCount(run) : 0,
  };
}

function townInfo(
  run: RunState
): Pick<
  SmileSceneInfo,
  | "price"
  | "crowd"
  | "painting"
  | "day"
  | "crew"
  | "moods"
  | "moving"
  | "arrived"
  | "grumped"
> {
  if (!isTownOpen(run))
    return {
      price: -1,
      crowd: 0,
      painting: false,
      day: "",
      crew: "",
      moods: "",
      moving: -1,
      arrived: -1,
      grumped: -1,
    };
  const kind = dayKind(run);
  const day =
    kind === 0
      ? ""
      : kind === 1
        ? "hot"
        : `${kind === DAY_RAIN ? "rain" : kind === DAY_PARTY ? "party" : ""}${dayStreet(run)}`;
  const streets = Array.from({ length: STREET_COUNT }, (_, i) => i);
  return {
    price: priceOf(run),
    crowd: Math.round(crowdOf(run) * 10),
    painting: isRepainting(run),
    day,
    crew: streets.map((i) => floatsOn(run, i)).join("-"),
    moods: streets
      .map((i) => {
        const mood = moodOfStreet(run, i);
        return mood < 0.25 ? 0 : mood < 0.5 ? 1 : mood < 0.8 ? 2 : 3;
      })
      .join(""),
    moving: isMoving(run) ? movingTo(run) : -1,
    arrived: lastArrival(run),
    grumped: lastGrump(run),
  };
}

function worldInfo(
  run: RunState
): Pick<
  SmileSceneInfo,
  "loud" | "retune" | "real" | "wday" | "lostKey" | "healKey" | "droneKey"
> {
  if (!isWorldOpen(run))
    return {
      loud: 2,
      retune: false,
      real: 10,
      wday: "",
      lostKey: 0,
      healKey: 0,
      droneKey: 0,
    };
  const kind = worldDayKind(run);
  return {
    loud: levelOf(run),
    retune: isRetuning(run),
    real: Math.round(realOf(run) * 10),
    wday:
      kind === DAY_FESTIVAL
        ? "fest"
        : kind === DAY_GLOOM
          ? "gloom"
          : kind === DAY_WEARY
            ? "weary"
            : "",
    lostKey: justLost(run) ? lostCount(run) : 0,
    healKey: justHealed(run) ? healCount(run) : 0,
    droneKey: justDroned(run) ? droneCount(run) : 0,
  };
}

function benchInfo(
  run: RunState
): Pick<
  SmileSceneInfo,
  | "seat"
  | "scoot"
  | "tell"
  | "away"
  | "happening"
  | "landKey"
  | "pullKey"
  | "pullStayed"
> {
  if (run.phase !== 3)
    return {
      seat: 0,
      scoot: -1,
      tell: 1,
      away: false,
      happening: "",
      landKey: 0,
      pullKey: 0,
      pullStayed: false,
    };
  return {
    seat: seatOf(run),
    scoot: isScooting(run) ? scootingTo(run) : -1,
    tell: tellOf(run),
    away: isAway(run),
    happening: eventLook(run),
    landKey: justLanded(run) ? landCount(run) : 0,
    pullKey: justPulled(run) ? pullCount(run) : 0,
    pullStayed: pullWhy(run) === 1,
  };
}

export function sceneInfo(run: RunState): SmileSceneInfo {
  const p = Math.max(0, Math.min(3, run.phase));
  const phase = PHASE_IDS[p];
  const ids = IDS[p];
  const forkId = (["friend", "town", "world", "quiet"] as const)[p];
  const side = forkSide(run, forkId);
  const trust = trustFraction(run);
  return {
    phase,
    fork: side === null ? 0 : side + 1,
    a: level(run, ids[0]),
    b: level(run, ids[1]),
    c: level(run, ids[2]),
    d: level(run, ids[3]),
    scaling: level(run, ids[4]),
    ended: ids[8] ? owned(run, ids[8]) > 0 : false,
    extraA: level(run, ids[5]),
    extraB: level(run, ids[6]),
    extraC: level(run, ids[7]),
    ...townInfo(run),
    parade: isParadeOn(run) && p === 2,
    ...worldInfo(run),
    projects: PROJECT_IDS[p].reduce(
      (bits, id, i) => bits | (isProjectDone(run, id) ? 1 << i : 0),
      0
    ),
    bond: bondTier(run),
    ...togetherInfo(run),
    trust: p === 3 ? Math.round(trust * 20) * 5 : 0,
    face: p === 3 ? trustStage(run) : TRUST_STAGES[0],
    ...benchInfo(run),
    visitorHere: run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true,
  };
}

/** True when two scene infos draw the same picture. */
export function isSameSceneInfo(a: SmileSceneInfo, b: SmileSceneInfo): boolean {
  return (Object.keys(a) as (keyof SmileSceneInfo)[]).every(
    (key) => a[key] === b[key]
  );
}
