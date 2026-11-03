import { projectDoneFlag } from "../../engine/engine";
import type { ActionDef, ProjectDef, RunState } from "../../engine/types";
import { knowForkMult } from "./forks";
import { HELPER_LINES, owned, res } from "./lines";
import { PHASE_SKY, PHASE_TOWN } from "./resources";
import { TUNING } from "./tuning";

/**
 * Know-how: the town's and the sky's one second resource, and the place
 * where you have to choose. Every helper you own learns a little while it
 * works, so know-how trickles in. There are two hungry things to spend it on:
 *  - projects: a few permanent ideas (hard hats, ready-mix, prefab floors),
 *    each one a big, lasting step;
 *  - overtime: a burst of double pay for a short while, as often as you can
 *    afford it. Best when a big purchase is near.
 * Know-how spent on one is not there for the other, and nothing here is luck:
 * every project and every shift does exactly what its card says.
 *
 * All state is hidden resources, `knowhow` and `otLeft` (seconds of overtime
 * left), plus the engine's project flags, so a save from before reads as no
 * know-how, no overtime and no projects done.
 */

const K = TUNING.knowhow;

export const KNOWHOW = "knowhow";
export const OVERTIME_ACTION_ID = "overtime-start";

/** The two parts that have know-how and overtime. */
export const hasKnowhow = (run: RunState): boolean =>
  run.phase === 1 || run.phase === 2;

/** Know-how each second: every level of every helper learns a little. */
export function knowhowPerSecond(run: RunState): number {
  if (!hasKnowhow(run)) return 0;
  const levels = HELPER_LINES[run.phase].reduce(
    (sum, id) => sum + owned(run, id),
    0
  );
  return (
    levels * K.perLevel * (run.phase === 2 ? K.skyRate : 1) * knowForkMult(run)
  );
}

export const knowhowOf = (run: RunState): number => res(run, KNOWHOW);

export const isProjectDone = (run: RunState, id: string): boolean =>
  run.flags[projectDoneFlag(id)] === true;

// ------------------------------------------------------------------ overtime

/** Seconds of overtime left (0 when none is on). */
export const overtimeLeft = (run: RunState): number => res(run, "otLeft");

export const isOvertimeOn = (run: RunState): boolean => overtimeLeft(run) > 0;

/** Shifts held so far. */
export const overtimeSoFar = (run: RunState): number => res(run, "otCount");

/** The overtime shows once the part has a few helpers learning. */
export const isOvertimeOpen = (run: RunState): boolean =>
  hasKnowhow(run) && owned(run, HELPER_LINES[run.phase][0]) >= 2;

export const OVERTIME_NAMES = ["", "Overtime shift", "Night shift"] as const;

/** Pay while a shift is on (1 otherwise). */
export const overtimeMult = (run: RunState): number =>
  hasKnowhow(run) && isOvertimeOn(run) ? K.overtimeMult : 1;

function startOvertime(run: RunState): void {
  run.resources.otLeft = K.overtimeSeconds;
  run.resources.otCount = overtimeSoFar(run) + 1;
}

/** Runs the know-how for `dt` seconds and the overtime down. */
export function tickKnowhow(run: RunState, dt: number): void {
  if (res(run, "otLeft") > 0)
    run.resources.otLeft = Math.max(0, res(run, "otLeft") - dt);
  if (!hasKnowhow(run)) return;
  run.resources[KNOWHOW] = knowhowOf(run) + knowhowPerSecond(run) * dt;
}

export const OVERTIME_ACTIONS: readonly ActionDef[] = [
  {
    id: OVERTIME_ACTION_ID,
    phases: [PHASE_TOWN, PHASE_SKY],
    isInline: true,
    visibleWhen: isOvertimeOpen,
    describe: (run) => {
      const on = isOvertimeOn(run);
      return {
        label: on
          ? `${OVERTIME_NAMES[run.phase]} is on`
          : `Call an ${OVERTIME_NAMES[run.phase].toLowerCase()}`,
        detail: `Everything pays ${K.overtimeMult}x for ${K.overtimeSeconds} seconds. Best just before something big.`,
        cost: { resource: KNOWHOW, amount: K.overtimeCost },
        isBlocked: on,
      };
    },
    perform: (run) => startOvertime(run),
  },
];

// ------------------------------------------------------------------- projects

/** "×2", "×1.5": a project's multiplier, no more digits than it needs. */
const times = (n: number): string => `×${Number(n.toFixed(2))}`;

/** "half as fast" for 0.5, "×0.7 as fast" otherwise. */
const asFast = (n: number): string =>
  n === 0.5 ? "half as fast" : `${times(n)} as fast`;

/** Hard hats and the wind tunnel: the tower sways half as fast. */
export const knowhowSwayMult = (run: RunState): number =>
  (run.phase === 1 && isProjectDone(run, "hard-hats")) ||
  (run.phase === 2 && isProjectDone(run, "wind-tunnel"))
    ? TUNING.sway.projectMult
    : 1;

/** Ready-mix: the footing settles half as fast. */
export const knowhowSpoilMult = (run: RunState): number =>
  run.phase === 1 && isProjectDone(run, "ready-mix") ? K.readyMixSpoil : 1;

/** Prefab floors and carbon cable: everything pays more, always. */
export const projectIncomeMult = (run: RunState): number =>
  run.phase === 1 && isProjectDone(run, "prefab-floors")
    ? K.prefabMult
    : run.phase === 2 && isProjectDone(run, "carbon-cable")
      ? K.cableMult
      : 1;

/** The loading dock: loads pay more. */
export const dockMult = (run: RunState): number =>
  run.phase === 2 && isProjectDone(run, "loading-dock")
    ? TUNING.deliveries.dockMult
    : 1;

/** Everything that multiplies the pay of the town or the sky right now. */
export const phaseBoost = (run: RunState): number =>
  overtimeMult(run) * projectIncomeMult(run);

const cost = (amount: number) => [{ resource: KNOWHOW, amount }];

/** True when a project of this part is on offer and the know-how is in hand. */
export const hasAffordableProject = (run: RunState): boolean =>
  HIGHER_PROJECTS.some(
    (p) =>
      p.phase === (run.phase === 1 ? PHASE_TOWN : PHASE_SKY) &&
      hasKnowhow(run) &&
      !isProjectDone(run, p.id) &&
      (p.revealWhen?.(run) ?? true) &&
      knowhowOf(run) >= p.costs[0].amount
  );

export const HIGHER_PROJECTS: readonly ProjectDef[] = [
  {
    id: "hard-hats",
    phase: PHASE_TOWN,
    name: "Hard hats for everyone",
    description:
      "Yellow hats, a whistle and a little safety talk. The crews work steadier, so the tower sways half as fast.",
    tradeOff: "Know-how spent here is not there for overtime.",
    costs: cost(K.costs[0]),
    revealWhen: (run) => owned(run, "cross-braces") >= 1,
    effectPreview: () => `The tower sways ${asFast(TUNING.sway.projectMult)}`,
    botValue: 0.3,
  },
  {
    id: "ready-mix",
    phase: PHASE_TOWN,
    name: "Ready-mix concrete",
    description:
      "A big drum that turns and turns. Footing in the ground sets hard, so it settles half as fast and a smaller share does the work of a bigger one.",
    tradeOff: "It only helps if you keep some back for the footing.",
    costs: cost(K.costs[1]),
    revealWhen: (run) => owned(run, "mason") >= 3,
    effectPreview: () => `Footing lasts ${times(1 / K.readyMixSpoil)} as long`,
    botValue: 0.35,
  },
  {
    id: "prefab-floors",
    phase: PHASE_TOWN,
    name: "Prefab floors",
    description:
      "Whole floors built in a workshop and lifted into place in a day. Every crew in town pays twice as much, all the time.",
    tradeOff: "It costs a lot of know-how, which overtime would have used.",
    costs: cost(K.costs[2]),
    revealWhen: (run) => owned(run, "crane") >= 2,
    effectPreview: () => `Every crew pays ${times(K.prefabMult)}`,
  },
  {
    id: "wind-tunnel",
    phase: PHASE_SKY,
    name: "A wind tunnel",
    description:
      "A tiny tower in a tube of wind teaches the big one how to lean into a gust. It sways half as fast.",
    tradeOff: "Know-how spent here is not there for a night shift.",
    costs: cost(K.costs[0]),
    revealWhen: (run) => owned(run, "damper") >= 1,
    effectPreview: () => `The tower sways ${asFast(TUNING.sway.projectMult)}`,
    botValue: 0.3,
  },
  {
    id: "loading-dock",
    phase: PHASE_SKY,
    name: "A loading dock in the clouds",
    description:
      "A flat place where deliveries can land safely. Loads pay twice as much.",
    tradeOff: "It only helps if you place the loads that arrive.",
    costs: cost(K.costs[1]),
    revealWhen: (run) => owned(run, "sky-crew") >= 3,
    effectPreview: () => `Every load pays ${times(TUNING.deliveries.dockMult)}`,
    botValue: 0.4,
  },
  {
    id: "carbon-cable",
    phase: PHASE_SKY,
    name: "Carbon cable",
    description:
      "Thread-thin and stronger than steel. Every crew in the sky pays twice as much, all the time.",
    tradeOff:
      "It costs a lot of know-how, which a night shift would have used.",
    costs: cost(K.costs[2]),
    revealWhen: (run) => owned(run, "cloud-crane") >= 2,
    effectPreview: () => `Every crew pays ${times(K.cableMult)}`,
  },
];
