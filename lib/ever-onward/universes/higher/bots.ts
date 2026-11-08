import { genericBots, type BotSet } from "../../engine/bots";
import { shownProjects, upgradeCost } from "../../engine/engine";
import type { Strategy } from "../../engine/sim";
import type { RunState } from "../../engine/types";
import { bestLoad, loadActionId } from "./deliveries";
import {
  footingActionId,
  footingChanges,
  footingStep,
  isFootingOpen,
} from "./footing";
import { currentFork, forkActionId, type ForkSide } from "./forks";
import { OVERTIME_ACTION_ID, knowhowOf } from "./knowhow";
import {
  BANK_ACTION_ID,
  PACES,
  TUMBLE_COST_SECONDS,
  canBank,
  isPlayroomOpen,
  isSoft,
  paceActionId,
  paceStep,
  potSeconds,
  streakOf,
  toddlerStage,
  tumbleChanceFor,
} from "./playroom";
import { STEADY_ACTION_ID, leanCalm, swayOf } from "./sway";
import { tendingValue } from "./tick";
import {
  HATS,
  LAMP_ACTION_ID,
  PARK_ACTION_ID,
  foremanActionId,
  hasPark,
  hatIds,
  hatKey,
  isTownOpen,
  lampPrice,
  lampsLeft,
  lampsOf,
  parkPrice,
  pendingIds,
  townLeanTarget,
} from "./town";
import { FOREMEN } from "./foremen";
import { TUNING } from "./tuning";
import { UPGRADES } from "./upgrades";
import { higherUniverse } from ".";

type Actions = NonNullable<Strategy["actions"]>;

/** True for the one step at the start of each window (steps are 0.5 or 1 s). */
const isWindowStart = (run: RunState, seconds: number): boolean =>
  run.time % seconds < 0.5;

/** The side an engaged bot picks in each part. */
const ENGAGED_SIDES: readonly ForkSide[] = [0, 0, 1, 0];

/**
 * Buys the given side of the current part's fork the moment it is open and
 * affordable (a bot that checks every step always gets there first).
 */
export const takesFork =
  (side?: ForkSide): Actions =>
  (run, available) => {
    const id = forkActionId(
      currentFork(run).id,
      side ?? ENGAGED_SIDES[run.phase] ?? 0
    );
    return available.includes(id) ? [id] : [];
  };

/** Presses Steady once the tower leans this far, looking every `window` seconds. */
export const steadiesAt =
  (threshold: number, window = 1): Actions =>
  (run, available) =>
    run.phase === 2 &&
    swayOf(run) >= threshold &&
    isWindowStart(run, window) &&
    available.includes(STEADY_ACTION_ID)
      ? [STEADY_ACTION_ID]
      : [];

/**
 * How a bot plays the Playroom's dials. `pace` is a fixed step, or "reads":
 * quick when the coast is clear, careful while the toddler is on the way.
 * `bank` is a fixed streak length to bank at, "never", or "reads": bank when
 * one more block is worth less than the chance of losing the pot.
 */
export interface PlayroomStyle {
  pace: number | "reads" | "plan";
  bank: number | "never" | "reads";
}

/**
 * What a pace is worth in the long run when banking at `blocks`: pay times
 * one plus the bonus per second of building, with the tumbles priced in
 * (`stomping` triples the chance of a tumble).
 */
export function paceRate(
  run: RunState,
  step: number,
  blocks: number,
  stomping: boolean
): number {
  const P = TUNING.playroom;
  const pace = PACES[step];
  const lean = Math.min(1, pace.lean * Math.max(P.calmFloor, leanCalm(run)));
  let alive = 1;
  let seconds = 0;
  let lost = 0;
  for (let k = 0; k < blocks; k += 1) {
    const q = tumbleChanceFor(lean, k, stomping, isSoft(run));
    seconds += alive * pace.stack;
    lost += alive * q * TUMBLE_COST_SECONDS;
    alive *= 1 - q;
  }
  seconds += alive * P.bankPause;
  return pace.pay + (alive * potSeconds(blocks) - lost * pace.pay) / seconds;
}

/** The pace and streak length that earn the most right now. */
const PLANS = new Map<string, { step: number; blocks: number }>();

export function bestPlan(run: RunState): { step: number; blocks: number } {
  const key = `${toddlerStage(run) !== "away"}|${isSoft(run)}|${Math.round(leanCalm(run) * 100)}`;
  const known = PLANS.get(key);
  if (known) return known;
  const stomping = toddlerStage(run) !== "away";
  let best = { step: paceStep(run), blocks: P_BANK_MIN, rate: -Infinity };
  for (let step = 0; step < PACES.length; step += 1)
    for (let blocks = P_BANK_MIN; blocks <= 16; blocks += 1) {
      const rate = paceRate(run, step, blocks, stomping);
      if (rate > best.rate) best = { step, blocks, rate };
    }
  const plan = { step: best.step, blocks: best.blocks };
  PLANS.set(key, plan);
  return plan;
}

const P_BANK_MIN = TUNING.playroom.bankMin;

/** Sets the pace and banks the streak by a style, looking every `window` seconds. */
export const playsPlayroom =
  (style: PlayroomStyle, window = 1): Actions =>
  (run, available) => {
    if (!isPlayroomOpen(run) || !isWindowStart(run, window)) return [];
    const bankNow =
      style.bank === "never"
        ? false
        : style.bank === "reads"
          ? (canBank(run) && streakOf(run) >= bestPlan(run).blocks) ||
            (toddlerStage(run) === "coming" && canBank(run))
          : streakOf(run) >= style.bank;
    if (bankNow && available.includes(BANK_ACTION_ID)) return [BANK_ACTION_ID];
    const want =
      style.pace === "plan"
        ? bestPlan(run).step
        : style.pace === "reads"
          ? toddlerStage(run) === "away"
            ? 2
            : 0
          : style.pace;
    const id = paceActionId(Math.min(PACES.length - 1, want));
    return paceStep(run) !== want && available.includes(id) ? [id] : [];
  };

/**
 * How a bot plays the Town's dials. `pace` is a fixed step or "plan" (the
 * best for the day and the foremen it has). `crew` is nobody, a fixed trio of
 * foreman ids, or "adjusts" (reads today and tomorrow and changes hats when
 * the change pays for the shift it costs). `lights` is "never", "always"
 * (whenever it can afford it) or "adjusts" (when the lights pay back well
 * inside what is left of the Town).
 */
export interface TownStyle {
  pace: number | "plan";
  crew: "none" | readonly number[] | "adjusts";
  lights: "never" | "always" | "adjusts";
}

interface Probe {
  ids?: readonly number[];
  day?: number;
  pace?: number;
  lamps?: number;
  park?: boolean;
}

/** The run as it would be settled with these foremen, this day, pace and lights. */
function probe(run: RunState, o: Probe): RunState {
  const r = { ...run.resources };
  if (o.ids)
    for (let h = 0; h < HATS; h += 1) {
      r[hatKey(h)] = o.ids[h] ?? 0;
      r[`tfP${h}`] = 0;
    }
  if (o.day !== undefined) r.twDay = o.day;
  if (o.pace !== undefined) {
    r.pcPace = o.pace;
    r.pcEff = o.pace;
  }
  if (o.lamps !== undefined) r.twLamps = o.lamps;
  if (o.park !== undefined) r.twPark = o.park ? 1 : 0;
  const settled = { ...run, resources: r };
  r.sway = townLeanTarget(settled);
  return settled;
}

/** What a second of building is worth once settled, at the best pace. */
function settledValue(run: RunState, o: Probe): number {
  const paces = o.pace === undefined ? [0, 1, 2, 3] : [o.pace];
  return Math.max(
    ...paces.map((pace) => tendingValue(probe(run, { ...o, pace })))
  );
}

const FOREMAN_IDS = FOREMEN.map((f) => f.id);
const TRIOS: readonly (readonly number[])[] = FOREMAN_IDS.flatMap((a) =>
  FOREMAN_IDS.filter((b) => b > a).flatMap((b) =>
    FOREMAN_IDS.filter((c) => c > b).map((c) => [a, b, c] as const)
  )
);

/** The crew's value now and tomorrow, weighted by how long each lasts. */
function crewValue(
  run: RunState,
  ids: readonly number[],
  extra: Probe = {}
): number {
  const today = run.resources.twDay ?? 0;
  const tomorrow = run.resources.twNext ?? 0;
  const left = Math.max(1, (run.resources.twEnd ?? 0) - run.time);
  const day = TUNING.town.daySeconds;
  return (
    (left * settledValue(run, { ...extra, ids, day: today }) +
      day * settledValue(run, { ...extra, ids, day: tomorrow })) /
    (left + day)
  );
}

/** The hats' foremen, counting the ones already on their way. */
const crewNow = (run: RunState): number[] =>
  hatIds(run).map((id, h) => id || pendingIds(run)[h]);

/** Seconds the rest of the Town should take at today's pay (a bot's guess). */
function townSecondsLeft(run: RunState): number {
  const end = UPGRADES.find((u) => u.id === "skyscraper");
  if (!end) return 600;
  const need = upgradeCost(run, end) - (run.resources.bricks ?? 0);
  return Math.max(30, need / Math.max(1, tendingValue(run)));
}

function pickCrew(run: RunState): Actions {
  return (_, available) => {
    if (pendingIds(run).some((id) => id > 0)) return [];
    const cur = hatIds(run);
    const horizon =
      Math.max(1, (run.resources.twEnd ?? 0) - run.time) +
      TUNING.town.daySeconds;
    // Fill empty hats first with the best trio that keeps who is there.
    const keep = cur.filter((id) => id > 0);
    let best = TRIOS[0];
    let bestValue = -Infinity;
    for (const trio of TRIOS) {
      if (!keep.every((id) => trio.includes(id)) && keep.length < HATS)
        continue;
      const v = crewValue(run, trio);
      if (v > bestValue) {
        best = trio;
        bestValue = v;
      }
    }
    if (keep.length < HATS) {
      const need = best.filter((id) => !cur.includes(id));
      const hat = cur.findIndex((id) => id === 0);
      const id = foremanActionId(hat, need[0]);
      return available.includes(id) ? [id] : [];
    }
    // All hats are filled: change one only when it pays for the shift.
    const nowValue = crewValue(run, cur);
    let pick: { id: string; net: number } | null = null;
    for (let h = 0; h < HATS; h += 1) {
      const empty = cur.map((id, i) => (i === h ? 0 : id));
      const lost =
        TUNING.town.shiftSeconds *
        Math.max(0, nowValue - crewValue(run, empty));
      for (const id of FOREMAN_IDS) {
        if (cur.includes(id)) continue;
        const swapped = cur.map((x, i) => (i === h ? id : x));
        const net = horizon * (crewValue(run, swapped) - nowValue) - lost;
        if (net > 0.05 * horizon * nowValue && (!pick || net > pick.net))
          pick = { id: foremanActionId(h, id), net };
      }
    }
    return pick && available.includes(pick.id) ? [pick.id] : [];
  };
}

/** The bot's Town: pace, hats and lights by a style, looking every `window` seconds. */
export const playsTown =
  (style: TownStyle, window = 1): Actions =>
  (run, available) => {
    if (!isTownOpen(run) || !isWindowStart(run, window)) return [];
    const out: string[] = [];
    // Hats.
    if (style.crew === "adjusts") out.push(...pickCrew(run)(run, available));
    else if (style.crew !== "none") {
      const cur = crewNow(run);
      style.crew.forEach((want, h) => {
        if (cur[h] === 0) {
          const id = foremanActionId(h, want);
          if (available.includes(id)) out.push(id);
        }
      });
    }
    // Pace.
    const today = run.resources.twDay ?? 0;
    const step =
      style.pace === "plan"
        ? [0, 1, 2, 3].reduce(
            (best, p) =>
              tendingValue(probe(run, { pace: p, day: today })) >
              tendingValue(probe(run, { pace: best, day: today })) * 1.02
                ? p
                : best,
            paceStepOf(run)
          )
        : style.pace;
    const paceId = paceActionId(step);
    if (step !== paceStepOf(run) && available.includes(paceId))
      out.push(paceId);
    // Lights.
    if (style.lights !== "never") {
      const lamp = lampsLeft(run);
      const id = lamp ? LAMP_ACTION_ID : PARK_ACTION_ID;
      const price = lamp ? lampPrice(run) : parkPrice(run);
      const open = lamp || !hasPark(run);
      if (open && available.includes(id)) {
        if (style.lights === "always") out.push(id);
        else {
          const after = lamp
            ? { lamps: lampsOf(run) + 1 }
            : { lamps: lampsOf(run), park: true };
          const gain =
            crewValue(run, hatIds(run), after) - crewValue(run, hatIds(run));
          if (gain > 0 && price / gain < LIGHT_PAYBACK * townSecondsLeft(run))
            out.push(id);
        }
      }
    }
    return out;
  };

/** Lights are bought when they would pay back in this share of what is left of the Town. */
const LIGHT_PAYBACK = 0.2;
const paceStepOf = (run: RunState): number => paceStep(run);

/** Places the load that helps most, looking every `window` seconds. */
export const placesLoad =
  (window = 1): Actions =>
  (run, available) => {
    if (!isWindowStart(run, window)) return [];
    const ids = [0, 1, 2].map(loadActionId);
    if (!ids.some((id) => available.includes(id))) return [];
    const id = loadActionId(bestLoad(run, tendingValue(run)));
    return available.includes(id) ? [id] : [];
  };

/** The upgrade that ends each of the first three parts. */
const END_IDS = ["treehouse", "skyscraper", "space-elevator"] as const;

/** Share of the last upgrade's price in hand at which the footing stops. */
const END_NEAR_SHARE = 0.25;

/**
 * Keeps this step of the footing while the top of the part is far off, and
 * keeps nothing once a good part of the last upgrade's price is in hand
 * (footing left when the part ends is left behind).
 */
export const footingPolicy =
  (step = 1, window = 10): Actions =>
  (run, available) => {
    if (run.phase > 2 || !isFootingOpen(run) || !isWindowStart(run, window))
      return [];
    const end = UPGRADES.find((u) => u.id === END_IDS[run.phase]);
    const resource = end?.currency ?? "";
    const isNear =
      !!end &&
      run.revealed.includes(end.id) &&
      (run.resources[resource] ?? 0) >= END_NEAR_SHARE * upgradeCost(run, end);
    // Sets the step once, then lets go for good when the top is near.
    if (!isNear && footingChanges(run) > 0) return [];
    const want = isNear ? 0 : step;
    const id = footingActionId(want);
    return footingStep(run) !== want && available.includes(id) ? [id] : [];
  };

/**
 * Calls overtime when the know-how is there and no project is close: it keeps
 * back half of the cheapest project on offer.
 */
export const holdsOvertime: Actions = (run, available) => {
  if (!available.includes(OVERTIME_ACTION_ID)) return [];
  const shown = shownProjects(higherUniverse, run);
  const reserve = shown.length
    ? 0.5 * Math.min(...shown.map((p) => p.costs[0].amount))
    : 0;
  return knowhowOf(run) >= TUNING.knowhow.overtimeCost + reserve
    ? [OVERTIME_ACTION_ID]
    : [];
};

/** Runs several choices at once, so a bot can pick and steady in one step. */
export const together =
  (...parts: Actions[]): Actions =>
  (run, available) =>
    parts.flatMap((part) => part(run, available));

/** A strategy that builds the given way. */
const site = (base: Strategy, actions: Actions): Strategy => ({
  ...base,
  actions,
});

/** A player who builds quickly and banks when one more block risks more than it adds. */
const READS: PlayroomStyle = { pace: 2, bank: "reads" };

/** A player who reads the day, changes hats when it pays, and lights the town when it pays back. */
const TOWN_ADJUSTS: TownStyle = {
  pace: "plan",
  crew: "adjusts",
  lights: "adjusts",
};

/** A player who never touches the town's dials. */
const TOWN_IGNORES: TownStyle = { pace: 1, crew: "none", lights: "never" };

/** A player who puts three foremen on the hats, lights the town when they can, and walks away. */
const TOWN_SET_AND_LEAVE: TownStyle = {
  pace: 2,
  crew: [2, 4, 6],
  lights: "always",
};

/** A player who rushes with the fast foremen and never lights a lamp. */
const TOWN_GREEDY: TownStyle = { pace: 2, crew: [1, 3, 5], lights: "never" };

/** A player who never touches the dials. */
const IGNORES: PlayroomStyle = { pace: 1, bank: "never" };

/** A player who rushes and banks on a hunch rather than by the odds. */
const GREEDY: PlayroomStyle = { pace: 3, bank: 3 };

/** The scorecard's player personalities for Build It Higher. */
export function higherBots(): BotSet {
  const base = genericBots(higherUniverse);
  const hands = (
    steady: number,
    window: number,
    load: number,
    dials: PlayroomStyle = READS,
    town: TownStyle = TOWN_ADJUSTS
  ): Actions =>
    together(
      takesFork(),
      steadiesAt(steady, window),
      playsPlayroom(dials, window),
      playsTown(town, window),
      placesLoad(load),
      footingPolicy(1, Math.max(window, 10)),
      holdsOvertime
    );
  const tapper = site(base.tapper, hands(0.8, 1, 1));
  return {
    tapper,
    realistic: site(base.realistic, hands(0.75, 5, 15)),
    idle: {
      ...base.idle,
      projects: "best",
      // Sets three hats once and leaves the rest alone.
      actions: together(takesFork(1), playsTown(TOWN_SET_AND_LEAVE, 30)),
      greetAfter: Infinity,
    },
    dawdler: site(base.dawdler, hands(0.9, 60, 60)),
    skill: Object.fromEntries(
      [0, 1, 2].map((phase) => [
        phase,
        {
          naive: site(base.tapper, hands(0.97, 1, 1, GREEDY, TOWN_GREEDY)),
          careful: site(base.tapper, hands(0.7, 1, 1)),
        },
      ])
    ),
    claim: Object.fromEntries(
      [0, 1, 2].map((phase) => [
        phase,
        {
          ignores: site(
            base.tapper,
            together(
              takesFork(),
              steadiesAt(0.8),
              playsPlayroom(IGNORES),
              playsTown(TOWN_IGNORES),
              footingPolicy(1, 10)
            )
          ),
          claims: tapper,
        },
      ])
    ),
    naiveOil: site(base.tapper, hands(0.97, 1, 1, GREEDY, TOWN_GREEDY)),
    cheapskateOil: tapper,
  };
}
