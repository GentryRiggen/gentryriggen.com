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
import { swayOf } from "./sway";
import {
  DAYS,
  darkness,
  dayNext,
  dayNow,
  hasPark,
  hatIds,
  isTownOpen,
  justArrived,
  justLit,
  justNewDay,
  justTossed,
  lampsOf,
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
  /** Today's day and tomorrow's (an index into the days: quiet, market, night, windy, festival). */
  day: number;
  tomorrow: number;
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
  /** The top: how far down the robot is, in twentieths. */
  descent: number;
  /** A load is waiting on the site. */
  loadHere: boolean;
  /** The kid is on the grass. */
  visitorHere: boolean;
}

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
    day: isTownOpen(run) ? DAYS.indexOf(dayNow(run)) : 0,
    tomorrow: isTownOpen(run) ? DAYS.indexOf(dayNext(run)) : 0,
    footing: Math.min(3, Math.round(gainOf(run) * 2)),
    keeps: run.phase <= 2 ? footingStep(run) : 0,
    projects: PROJECT_IDS[run.phase].reduce(
      (bits, id, i) => bits | (isProjectDone(run, id) ? 1 << i : 0),
      0
    ),
    overtime: isOvertimeOn(run),
    height: Math.min(12, Math.floor((levels + scaling) / 2)),
    descent: Math.round(descentShare(run) * 20),
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
