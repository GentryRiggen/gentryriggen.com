import type { ActionDef, RunState } from "../../engine/types";
import { forkSide } from "./forks";
import { banksSoFar } from "./playroom";
import { gustsSoFar, snapsSoFar } from "./sky";
import { flipsSoFar } from "./town";
import { isProjectDone } from "./knowhow";
import { FULL_DESCENT, PHASE_TOP } from "./resources";
import { res } from "./lines";
import { TUNING } from "./tuning";

/**
 * What to carry (the Top's one quiet choice).
 *
 * On the way down the robot can pick up little things from the build: a
 * feather from a gust, the bolt from a snapped cable, the mayor's ribbon, a
 * crayon from the rug. Which ones are on the stairs depends on what happened
 * in this run. Each sits at a place on the way down. The robot only carries
 * what you said to bring, and the pack is small.
 *
 * - A carried keepsake is a real cost: every unit of weight slows each step
 *   (the old lift carries it, so only half as much). It costs the most when
 *   it is picked up early, because it is carried the whole way.
 * - It is a real gain: what is carried is laid out at the bottom, and how
 *   warm the last picture is depends on it (more for something that mattered
 *   in this run).
 * - Changing your mind takes a little time: a keepsake marked to bring can
 *   be unmarked until the robot reaches it, but one that is picked up is set
 *   down with a stop (and the slow steps are not paid back).
 *
 * State is hidden resources (`kp0`..), one per keepsake: 0 on the stairs,
 * 1 marked to bring, 2 carried, 3 left behind. An old save reads as "all on
 * the stairs", and the ones already passed are left behind quietly (no
 * goodbye) on the first tick.
 */

const K = TUNING.top.keepsakes;

export type KeepsakeState = "open" | "marked" | "carried" | "left";
const STATES: readonly KeepsakeState[] = ["open", "marked", "carried", "left"];

export interface KeepsakeDef {
  id: string;
  name: string;
  /** Where in the build it came from. */
  from: "Playroom" | "Town" | "Sky" | "Grass";
  /** What it is, in a few words. */
  note: string;
  /** How much of it happened in this run (0: it is not on the stairs). */
  count(run: RunState): number;
  /** Counts at which it adds 1, 2 and 3 to how warm the ending is. */
  warmAt: readonly [number, number, number];
}

const PROJECT_IDS = [
  "hard-hats",
  "ready-mix",
  "prefab-floors",
  "wind-tunnel",
  "loading-dock",
  "carbon-cable",
] as const;

/**
 * In the order they sit on the way down, a few minutes apart: five that
 * only exist if they happened in this run, and three that are always there.
 */
export const KEEPSAKES: readonly KeepsakeDef[] = [
  {
    id: "marble",
    name: "A sky-blue marble",
    from: "Sky",
    note: "It rolled out of a cloud and stopped at your foot.",
    count: () => 1,
    warmAt: [1, 99, 99],
  },
  {
    id: "feather",
    name: "A goose feather",
    from: "Sky",
    note: "It blew in on a gust and stuck to the rail.",
    count: gustsSoFar,
    warmAt: [1, 6, 12],
  },
  {
    id: "bolt",
    name: "A snapped bolt",
    from: "Sky",
    note: "From the cable that whipped loose.",
    count: snapsSoFar,
    warmAt: [1, 3, 6],
  },
  {
    id: "blueprint",
    name: "A rolled blueprint",
    from: "Town",
    note: "From a lasting project, with coffee on one corner.",
    count: (run) => PROJECT_IDS.filter((id) => isProjectDone(run, id)).length,
    warmAt: [1, 3, 5],
  },
  {
    id: "key",
    name: "A spare key",
    from: "Town",
    note: "To a door in the tower nobody ever found.",
    count: () => 1,
    warmAt: [1, 99, 99],
  },
  {
    id: "bulb",
    name: "A lamp bulb",
    from: "Town",
    note: "Still warm from the night shift.",
    count: flipsSoFar,
    warmAt: [1, 4, 9],
  },
  {
    id: "star",
    name: "A gold star",
    from: "Playroom",
    note: "Banked after a long streak.",
    count: banksSoFar,
    warmAt: [1, 4, 10],
  },
  {
    id: "daisy",
    name: "A daisy",
    from: "Grass",
    note: "The first thing growing that nobody planted.",
    count: () => 1,
    warmAt: [1, 99, 99],
  },
];

export const KEEPSAKE_COUNT = KEEPSAKES.length;
export const PACK_SIZE = K.packSize;

export const keepActionId = (index: number): string => `keep-${index}`;
export const KEEP_ACTION_IDS: readonly string[] = KEEPSAKES.map((_, i) =>
  keepActionId(i)
);
export const leaveActionId = (index: number): string => `keepleave-${index}`;
export const LEAVE_ACTION_IDS: readonly string[] = KEEPSAKES.map((_, i) =>
  leaveActionId(i)
);

const slot = (index: number): string => `kp${index}`;
const shareOf = (index: number): number => K.items[index].share;
export const weightOf = (index: number): number => K.items[index].weight;

/** Where on the way down (0 to 1) a keepsake sits. */
export const keepsakeShare = shareOf;

const isTop = (run: RunState): boolean => run.phase === 3 && !run.complete;

const descent = (run: RunState): number =>
  Math.min(1, Math.max(0, res(run, "descent") / FULL_DESCENT));

export const keepsakeState = (run: RunState, index: number): KeepsakeState =>
  STATES[Math.min(3, Math.max(0, Math.round(res(run, slot(index)))))];

/** True when this run has this keepsake on the stairs. */
export const isOnTheStairs = (run: RunState, index: number): boolean =>
  KEEPSAKES[index].count(run) >= 1;

/** The keepsakes this run has on the stairs, in order. */
export const onTheStairs = (run: RunState): number[] =>
  KEEPSAKES.flatMap((_, i) => (isOnTheStairs(run, i) ? [i] : []));

/** How many cards show ahead of the robot (it is not one long list to plan). */
const CARDS_AHEAD = 3;

/**
 * A card shows while its keepsake is within a few of the robot, and for what
 * is carried (so it can be set down). What was left behind drops off the list.
 */
export function isCardShown(run: RunState, index: number): boolean {
  if (!isTop(run) || !isOnTheStairs(run, index)) return false;
  const state = keepsakeState(run, index);
  if (state === "carried") return true;
  if (state === "left") return false;
  const list = onTheStairs(run);
  const passed = list.filter((i) => shareOf(i) <= descent(run)).length;
  return list.indexOf(index) < passed + CARDS_AHEAD;
}

/** The indexes of the keepsakes in the pack. */
export const carriedIndexes = (run: RunState): number[] =>
  KEEPSAKES.flatMap((_, i) => (keepsakeState(run, i) === "carried" ? [i] : []));

/** Weight in the pack now. */
export const loadOf = (run: RunState): number =>
  carriedIndexes(run).reduce((sum, i) => sum + weightOf(i), 0);

/** Weight in the pack and marked to bring (the pack cannot go past this). */
export const bookedLoad = (run: RunState): number =>
  KEEPSAKES.reduce(
    (sum, _, i) =>
      ["carried", "marked"].includes(keepsakeState(run, i))
        ? sum + weightOf(i)
        : sum,
    0
  );

export const packLeft = (run: RunState): number => K.packSize - bookedLoad(run);

/** How much of the weight is felt: the old lift carries half of it. */
export const loadEase = (run: RunState): number =>
  forkSide(run, "top") === 1 ? K.liftEase : 1;

/** What each step is worth, as a share of a step with an empty pack (1 = full). */
export const walkMult = (run: RunState): number =>
  1 / (1 + K.slowPerWeight * loadEase(run) * loadOf(run));

/** How much slower each step is for what is carried (0 to 1). */
export const slowedBy = (run: RunState): number => 1 - walkMult(run);

/** How warm a keepsake makes the ending (0 when it is not on the stairs). */
export function warmthOf(run: RunState, index: number): number {
  const count = KEEPSAKES[index].count(run);
  return KEEPSAKES[index].warmAt.filter((at) => count >= at).length;
}

/** How warm the ending is: the sum over what was carried. */
export const endingWarmth = (run: RunState): number =>
  carriedIndexes(run).reduce((sum, i) => sum + warmthOf(run, i), 0);

/** The warmest an ending can be with a full pack of what this run has. */
export const warmestPossible = (run: RunState): number => {
  let best = 0;
  const items = onTheStairs(run);
  const search = (at: number, weight: number, warmth: number): void => {
    best = Math.max(best, warmth);
    for (let k = at; k < items.length; k += 1) {
      const w = weightOf(items[k]);
      if (weight + w <= K.packSize)
        search(k + 1, weight + w, warmth + warmthOf(run, items[k]));
    }
  };
  search(0, 0, 0);
  return best;
};

/**
 * Where the robot and the keepsakes are drawn on the stairs (0 to 1). The
 * keepsakes are spread evenly along the stairs, and the robot's place is
 * stretched to match, so it always stands at a keepsake as it reaches it.
 */
export function stairShare(share: number): number {
  const n = KEEPSAKE_COUNT + 1;
  const knots = [0, ...K.items.map((k) => k.share), 1];
  const s = Math.min(1, Math.max(0, share));
  for (let i = 1; i < knots.length; i += 1)
    if (s <= knots[i]) {
      const f = (s - knots[i - 1]) / Math.max(1e-9, knots[i] - knots[i - 1]);
      return (i - 1 + f) / n;
    }
  return 1;
}

/** Where a keepsake sits on the stairs (0 to 1). */
export const keepsakeStairShare = (index: number): number =>
  (index + 1) / (KEEPSAKE_COUNT + 1);

/** The one the robot is about to reach (the next one ahead), or -1. */
export function nextAhead(run: RunState): number {
  const here = descent(run);
  return (
    onTheStairs(run).find(
      (i) =>
        shareOf(i) > here && ["open", "marked"].includes(keepsakeState(run, i))
    ) ?? -1
  );
}

/**
 * True when a keepsake is coming up that has not been decided: the last one
 * is behind the robot, and the next is still on the stairs ahead.
 */
export function isPackDue(run: RunState): boolean {
  if (!isTop(run)) return false;
  const next = nextAhead(run);
  if (next < 0 || keepsakeState(run, next) !== "open") return false;
  const before = onTheStairs(run).filter((i) => i < next);
  const from = before.length ? shareOf(before[before.length - 1]) : 0;
  return descent(run) >= from;
}

/** True while the robot has stopped to set something down. */
export const isSettingDown = (run: RunState): boolean =>
  isTop(run) && res(run, "kpPauseUntil") > run.time;

export const pickedUp = (run: RunState): number => res(run, "kpPicks");
export const leftBehind = (run: RunState): number => res(run, "kpLefts");

/** The keepsake that was last picked up or left, 0-based (-1 when none). */
export const lastTouched = (run: RunState): number =>
  Math.round(res(run, "kpLast")) - 1;

// ----------------------------------------------------------------- actions

export function canBring(run: RunState, index: number): boolean {
  return (
    isTop(run) &&
    isOnTheStairs(run, index) &&
    keepsakeState(run, index) === "open" &&
    shareOf(index) > descent(run) &&
    weightOf(index) <= packLeft(run)
  );
}

export function bring(run: RunState, index: number): void {
  if (canBring(run, index)) run.resources[slot(index)] = 1;
}

export function unmark(run: RunState, index: number): void {
  if (isTop(run) && keepsakeState(run, index) === "marked")
    run.resources[slot(index)] = 0;
}

/** Setting one down stops the robot for a moment, and the pack is lighter after. */
export function setDown(run: RunState, index: number): void {
  if (!isTop(run) || keepsakeState(run, index) !== "carried") return;
  if (isSettingDown(run)) return;
  const r = run.resources;
  r[slot(index)] = 3;
  r.kpLefts = leftBehind(run) + 1;
  r.kpLast = index + 1;
  r.kpPauseUntil = run.time + K.setDownSeconds;
  r.kpLeftAt = run.time;
}

export function canLeave(run: RunState, index: number): boolean {
  return (
    isTop(run) &&
    isOnTheStairs(run, index) &&
    ["open", "marked"].includes(keepsakeState(run, index)) &&
    shareOf(index) > descent(run)
  );
}

/** Choosing to leave one behind: the goodbye happens at once. */
export function leave(run: RunState, index: number): void {
  if (!canLeave(run, index)) return;
  const r = run.resources;
  r[slot(index)] = 3;
  r.kpLefts = leftBehind(run) + 1;
  r.kpLeftAt = run.time;
  r.kpLast = index + 1;
}

/** What one keepsake's button does right now. */
export function tapKeepsake(run: RunState, index: number): void {
  const state = keepsakeState(run, index);
  if (state === "open") bring(run, index);
  else if (state === "marked") unmark(run, index);
  else if (state === "carried") setDown(run, index);
}

/** How much slower each step is for this much weight (0 to 1), for the cards. */
export const slowFor = (weight: number, ease = 1): number =>
  1 - 1 / (1 + K.slowPerWeight * ease * weight);

const costText = (run: RunState, index: number): string =>
  `Slows every step by about ${Math.round(slowFor(weightOf(index), loadEase(run)) * 100)}% while carried (${weightOf(index)} of ${K.packSize} in the pack).`;

export const warmthWords = (n: number): string =>
  n >= 3
    ? "a big light in the last picture"
    : n === 2
      ? "a warm light in the last picture"
      : "a small light in the last picture";

export const KEEP_ACTIONS: readonly ActionDef[] = KEEPSAKES.map((k, i) => ({
  id: keepActionId(i),
  phases: [PHASE_TOP],
  isInline: true,
  visibleWhen: (run) => isCardShown(run, i),
  describe: (run) => {
    const state = keepsakeState(run, i);
    const open = canBring(run, i);
    return {
      label: k.name,
      detail:
        state === "left"
          ? "Left behind on the stairs."
          : `${k.note} Adds ${warmthWords(warmthOf(run, i))}. ${costText(run, i)}`,
      isBlocked:
        state === "left" ||
        (state === "open" && !open) ||
        (state === "carried" && isSettingDown(run)),
    };
  },
  perform: (run) => tapKeepsake(run, i),
}));

export const LEAVE_ACTIONS: readonly ActionDef[] = KEEPSAKES.map((k, i) => ({
  id: leaveActionId(i),
  phases: [PHASE_TOP],
  isInline: true,
  visibleWhen: (run) => isCardShown(run, i),
  describe: (run) => ({
    label: `Leave ${k.name.toLowerCase()}`,
    detail: "Say goodbye to it on the stairs.",
    isBlocked: !canLeave(run, i),
  }),
  perform: (run) => leave(run, i),
}));

// -------------------------------------------------------------------- tick

/** Picks up what was marked and leaves the rest, as the robot passes each place. */
export function tickKeepsakes(run: RunState): void {
  if (!isTop(run)) return;
  const here = descent(run);
  const r = run.resources;
  // A save from before the keepsakes can open part-way down: what is already
  // behind the robot was never on offer, so it is left quietly (no goodbye).
  const isFirstLook = res(run, "kpSeen") === 0;
  r.kpSeen = 1;
  for (const i of onTheStairs(run)) {
    if (here < shareOf(i)) continue;
    const state = keepsakeState(run, i);
    if (state !== "open" && state !== "marked") continue;
    if (state === "open" && isFirstLook) {
      r[slot(i)] = 3;
      continue;
    }
    const fits = loadOf(run) + weightOf(i) <= K.packSize;
    if (state === "marked" && fits) {
      r[slot(i)] = 2;
      r.kpPicks = pickedUp(run) + 1;
      r.kpPickAt = run.time;
    } else {
      r[slot(i)] = 3;
      r.kpLefts = leftBehind(run) + 1;
      r.kpLeftAt = run.time;
    }
    r.kpLast = i + 1;
  }
}

/** True for a few seconds after something is picked up or left behind. */
export const justPicked = (run: RunState): boolean =>
  res(run, "kpPickAt") > 0 && run.time - res(run, "kpPickAt") < K.showSeconds;
export const justLeft = (run: RunState): boolean =>
  res(run, "kpLeftAt") > 0 && run.time - res(run, "kpLeftAt") < K.showSeconds;

/**
 * True while the scene shows a pickup, a goodbye or the robot setting
 * something down. Story toasts wait so they never cover it.
 */
export const isKeepMomentBusy = (run: RunState): boolean =>
  isTop(run) && (justPicked(run) || justLeft(run) || isSettingDown(run));

/** A new site starts with an empty pack. */
export function resetKeepsakes(run: RunState): void {
  for (let i = 0; i < KEEPSAKE_COUNT; i += 1) run.resources[slot(i)] = 0;
  run.resources.kpPauseUntil = 0;
  run.resources.kpSeen = 0;
}

// -------------------------------------------------------------------- log

export const keepEvents = (run: RunState): number =>
  pickedUp(run) + leftBehind(run);

export function keepLine(run: RunState): string | null {
  const i = lastTouched(run);
  if (i < 0 || i >= KEEPSAKE_COUNT) return null;
  const name = KEEPSAKES[i].name.replace(/^A /, "a ").replace(/^The /, "the ");
  return keepsakeState(run, i) === "carried"
    ? `The robot tucks ${name} into the pack.`
    : `The robot leaves ${name} on the stairs and says goodbye.`;
}

// ------------------------------------------------------------------ words

/** What was carried, in plain words ("a crayon and the mayor's ribbon"). */
export function carriedWords(run: RunState): string {
  const names = carriedIndexes(run).map((i) =>
    KEEPSAKES[i].name.replace(/^A /, "a ").replace(/^The /, "the ")
  );
  if (names.length === 0) return "nothing but the block";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
