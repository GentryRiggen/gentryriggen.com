import { visitorHereFlag } from "../../engine/engine";
import type { RunState } from "../../engine/types";
import { descentShare } from "./descent";
import { FORK_BY_PHASE, forkSide } from "./forks";
import { footingStep, gainOf } from "./footing";
import { isOvertimeOn, isProjectDone } from "./knowhow";
import { HELPER_LINES, owned } from "./lines";
import { PHASE_IDS, RETURN_VISITOR_ID, type HigherPhaseId } from "./resources";
import { isLoadHere } from "./deliveries";
import {
  KEEPSAKE_COUNT,
  endingWarmth,
  isOnTheStairs,
  isSettingDown,
  justLeft,
  justPicked,
  keepsakeState,
  leftBehind,
  loadOf,
  pickedUp,
} from "./keepsakes";
import {
  bankTier,
  banksSoFar,
  isPlayroomOpen,
  justBanked,
  justTumbled,
  paceNow,
  playroomLean,
  streakOf,
  toddlerStage,
  tumblesSoFar,
} from "./playroom";
import {
  dropsSoFar,
  forecastOf,
  gustsSoFar,
  isBlowing,
  isNoCrane,
  isSkyOpen,
  isStrongGust,
  justDropped,
  justNcFailed,
  justNcWon,
  justSnapped,
  justTied,
  ncFails,
  ncWins,
  snapsSoFar,
  strainNow,
  tiesSoFar,
  tieState,
} from "./sky";
import { swayOf } from "./sway";
import {
  DAYS,
  darkness,
  dayNext,
  dayNow,
  hasPark,
  hatIds,
  isTownOpen,
  flipsSoFar,
  justArrived,
  justFlipped,
  justLit,
  justNewDay,
  justTossed,
  lampsOf,
  lightLevel,
  lightsSoFar,
  pendingIds,
  swapStarts,
  swapsSoFar,
} from "./town";
import { UPGRADES } from "./upgrades";

/** The few numbers the picture needs; the scene redraws only when they change. */
export interface HigherSceneInfo {
  phase: HigherPhaseId;
  /** Levels owned of every upgrade of this phase, by id. */
  own: Readonly<Record<string, number>>;
  /** This part's fork: 0 not chosen, 1 the first side, 2 the second. */
  fork: number;
  /** How far the tower leans, 0 (upright) to 4. */
  lean: number;
  /** The playroom's build pace, 0 (careful) to 3 (rush). */
  pace: number;
  /** Blocks in the streak, 0 to 12 (the playroom). */
  streak: number;
  /** The toddler: 0 away, 1 coming, 2 stomping. */
  toddler: number;
  /** The top tumbled a moment ago, and how many times it has this run. */
  tumbling: boolean;
  tumbles: number;
  /** A streak was just banked: 0 no, or the fanfare's size 1 to 3; and the count. */
  banking: number;
  banks: number;
  /** The town's foremen on their hats, a digit each (0 empty), like "205". */
  crew: string;
  /** Hats waiting for a foreman who is on his way, one bit per hat. */
  waiting: number;
  /** A hat was just handed back (the old foreman tosses it): the colour, and which swap. */
  tossed: number;
  tosses: number;
  /** A new foreman just took a hat: who, and which arrival. */
  arrived: number;
  arrivals: number;
  /** Which hat was handed back, and which one a new foreman just took (0 to 2). */
  tossHat: number;
  arriveHat: number;
  /** A new day has just begun, and how many have. */
  dayNew: boolean;
  days: number;
  /** The shadow over the town, 0 (bright) to 5 (pitch dark). */
  shade: number;
  /** Street lamps lit (0 to 3), and whether the park is open. */
  lamps: number;
  park: boolean;
  /** The lights have just come on, and how many times they have. */
  lit: boolean;
  lights: number;
  /** How warm the lights are, 0 (cold) to 4 (full), and the switch just flipped (0 no, 1 on, 2 off) and how many times. */
  glow: number;
  flipped: number;
  flips: number;
  /** Today's day and tomorrow's (an index into the days: quiet, market, night, windy, festival). */
  day: number;
  tomorrow: number;
  /** The sky's forecast: 0 calm, 1 clouds gathering, 2 a sure gust. */
  wx: number;
  /** A gust is blowing, and how many have blown. */
  gust: boolean;
  gusts: number;
  /** The gust that is sure (or blowing) is a strong one. */
  strong: boolean;
  /** The cable's strain, 0 (slack) to 3 (humming). */
  strain: number;
  /** The tie-down: 0 free, 1 tying, 2 tied, 3 untying. */
  tie: number;
  /** The tower was just tied down, and how many times it has been. */
  tied: boolean;
  ties: number;
  /** A beam was just dropped, and how many have been. */
  dropped: boolean;
  drops: number;
  /** The cable just snapped, and how many times it has. */
  snapped: boolean;
  snaps: number;
  /** The crane is off for the no-crane climb. */
  noCrane: boolean;
  /** A no-crane climb was just won or lost, how many badges, and how many fails. */
  ncWon: boolean;
  ncLost: boolean;
  badges: number;
  ncFailed: number;
  /** How much footing there is, 0 (none) to 3. */
  footing: number;
  /** The share of income kept back (0, 1 or 2). */
  keeps: number;
  /** Know-how projects done (bit 0, 1 and 2). */
  projects: number;
  /** An overtime shift is on. */
  overtime: boolean;
  /** How tall the tower is, 0 to 12, from the helpers and scaling bought. */
  height: number;
  /** The top: how far down the robot is, in percent. */
  descent: number;
  /** The keepsakes, a digit each: "-" not on the stairs, 0 on them, 1 marked, 2 carried, 3 left. */
  carry: string;
  /** Weight in the pack (0 to 4), and whether the robot has stopped to set something down. */
  load: number;
  setting: boolean;
  /** Something was just picked up or left, and how many have been. */
  packed: boolean;
  parted: boolean;
  packs: number;
  parts: number;
  /** How warm the ending is so far (what is carried). */
  warmth: number;
  /** A load is waiting on the site. */
  loadHere: boolean;
  /** The kid is on the grass. */
  visitorHere: boolean;
}

const TIE_STATES = ["free", "tying", "tied", "untying"] as const;

const PROJECT_IDS: readonly (readonly string[])[] = [
  [],
  ["hard-hats", "ready-mix", "prefab-floors"],
  ["wind-tunnel", "loading-dock", "carbon-cable"],
  [],
];

/** The upgrade ids of each phase, by phase index. */
const IDS_BY_PHASE: readonly (readonly string[])[] = PHASE_IDS.map((id) =>
  UPGRADES.filter((u) => u.phases?.[0] === id).map((u) => u.id)
);

export function sceneInfo(run: RunState): HigherSceneInfo {
  const phase = PHASE_IDS[run.phase];
  const own: Record<string, number> = {};
  for (const id of IDS_BY_PHASE[run.phase]) own[id] = owned(run, id);
  const levels = (HELPER_LINES[run.phase] ?? []).reduce(
    (sum, id) => sum + owned(run, id),
    0
  );
  const scaling = Object.values(own).reduce((a, b) => a + b, 0) - levels;
  const forkId = FORK_BY_PHASE[run.phase];
  const side = forkSide(run, forkId);
  return {
    phase,
    own,
    fork: side === null ? 0 : side + 1,
    lean: Math.min(
      4,
      Math.floor((run.phase === 0 ? playroomLean(run) : swayOf(run)) * 4.999)
    ),
    pace: run.phase === 0 && isPlayroomOpen(run) ? Math.round(paceNow(run)) : 1,
    streak: Math.min(12, streakOf(run)),
    toddler: ["away", "coming", "stomping"].indexOf(toddlerStage(run)),
    tumbling: justTumbled(run),
    tumbles: tumblesSoFar(run),
    banking: justBanked(run) ? bankTier(run) : 0,
    banks: banksSoFar(run),
    crew: hatIds(run).join(""),
    waiting: pendingIds(run).reduce(
      (bits, id, h) => bits | (id > 0 ? 1 << h : 0),
      0
    ),
    tossed: justTossed(run) ? Math.round(run.resources.tfGone ?? 0) + 1 : 0,
    tosses: swapStarts(run),
    arrived: justArrived(run) ? Math.round(run.resources.tfWho ?? 0) : 0,
    arrivals: swapsSoFar(run),
    tossHat: Math.round(run.resources.tfHatOff ?? 0),
    arriveHat: Math.round(run.resources.tfHatOn ?? 0),
    dayNew: justNewDay(run),
    days: Math.round(run.resources.twDayN ?? 0),
    shade: run.phase === 1 ? Math.round(darkness(run) * 5) : 0,
    lamps: run.phase === 1 ? lampsOf(run) : 0,
    park: run.phase === 1 && hasPark(run),
    lit: run.phase === 1 && justLit(run),
    lights: lightsSoFar(run),
    glow: run.phase === 1 ? Math.round(lightLevel(run) * 4) : 0,
    flipped: run.phase === 1 ? justFlipped(run) : 0,
    flips: flipsSoFar(run),
    day: isTownOpen(run) ? DAYS.indexOf(dayNow(run)) : 0,
    tomorrow: isTownOpen(run) ? DAYS.indexOf(dayNext(run)) : 0,
    wx: forecastOf(run),
    gust: isBlowing(run),
    gusts: gustsSoFar(run),
    strong:
      run.phase === 2 &&
      (forecastOf(run) === 2 || isBlowing(run)) &&
      isStrongGust(run),
    strain: run.phase === 2 && isSkyOpen(run) ? Math.round(strainNow(run)) : 1,
    tie: TIE_STATES.indexOf(tieState(run)),
    tied: justTied(run),
    ties: tiesSoFar(run),
    dropped: justDropped(run),
    drops: dropsSoFar(run),
    snapped: justSnapped(run),
    snaps: snapsSoFar(run),
    noCrane: isNoCrane(run),
    ncWon: run.phase === 2 && justNcWon(run),
    ncLost: run.phase === 2 && justNcFailed(run),
    badges: run.phase === 2 ? ncWins(run) : 0,
    ncFailed: ncFails(run),
    footing: Math.min(3, Math.round(gainOf(run) * 2)),
    keeps: run.phase <= 2 ? footingStep(run) : 0,
    projects: PROJECT_IDS[run.phase].reduce(
      (bits, id, i) => bits | (isProjectDone(run, id) ? 1 << i : 0),
      0
    ),
    overtime: isOvertimeOn(run),
    height: Math.min(12, Math.floor((levels + scaling) / 2)),
    descent: Math.round(descentShare(run) * 100),
    carry:
      run.phase === 3
        ? Array.from({ length: KEEPSAKE_COUNT }, (_, i) =>
            isOnTheStairs(run, i)
              ? ["0", "1", "2", "3"][
                  ["open", "marked", "carried", "left"].indexOf(
                    keepsakeState(run, i)
                  )
                ]
              : "-"
          ).join("")
        : "-".repeat(KEEPSAKE_COUNT),
    load: run.phase === 3 ? loadOf(run) : 0,
    setting: run.phase === 3 && isSettingDown(run),
    packed: run.phase === 3 && justPicked(run),
    parted: run.phase === 3 && justLeft(run),
    packs: pickedUp(run),
    parts: leftBehind(run),
    warmth: run.phase === 3 ? endingWarmth(run) : 0,
    loadHere: isLoadHere(run),
    visitorHere: run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true,
  };
}

/** One string that changes exactly when the picture does. */
export function sceneKey(info: HigherSceneInfo): string {
  const { own, ...rest } = info;
  return [
    ...Object.values(rest),
    ...Object.entries(own).map(([id, n]) => `${id}:${n}`),
  ].join("|");
}

/** True when two infos draw the same picture. */
export const isSameSceneInfo = (
  a: HigherSceneInfo,
  b: HigherSceneInfo
): boolean => sceneKey(a) === sceneKey(b);
