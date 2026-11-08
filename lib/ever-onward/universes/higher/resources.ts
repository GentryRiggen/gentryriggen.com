import type { ResourceDef } from "../../engine/types";
import { TUNING } from "./tuning";

export const PHASE_PLAYROOM = "playroom";
export const PHASE_TOWN = "town";
export const PHASE_SKY = "sky";
export const PHASE_TOP = "top";

export type HigherPhaseId =
  | typeof PHASE_PLAYROOM
  | typeof PHASE_TOWN
  | typeof PHASE_SKY
  | typeof PHASE_TOP;

/** Phase ids, in order (the index is the run's `phase`). */
export const PHASE_IDS: readonly HigherPhaseId[] = [
  PHASE_PLAYROOM,
  PHASE_TOWN,
  PHASE_SKY,
  PHASE_TOP,
];

/** What each phase's tap earns, by phase index. */
export const MANUAL_RESOURCES = ["blocks", "bricks", "beams", "quiet"] as const;

/** The visitor whose arrival ends the run: someone on the grass with a kid. */
export const RETURN_VISITOR_ID = "kid-on-the-grass";

/** How far down the robot has come, 0 to 100. */
export const FULL_DESCENT = 100;

const HIDDEN: readonly string[] = [];

const hidden = (
  ids: readonly string[],
  initial?: Readonly<Record<string, number>>
): ResourceDef[] =>
  ids.map((id) => ({ id, label: id, phases: HIDDEN, initial: initial?.[id] }));

export const RESOURCES: readonly ResourceDef[] = [
  {
    id: "blocks",
    label: "Blocks",
    phases: [PHASE_PLAYROOM],
    purpose: "Buys stackers and milestones.",
  },
  {
    id: "bricks",
    label: "Bricks",
    phases: [PHASE_TOWN],
    purpose: "Buys builders and milestones.",
  },
  {
    id: "beams",
    label: "Beams",
    phases: [PHASE_SKY],
    purpose: "Buys sky crews and milestones.",
  },
  {
    id: "quiet",
    label: "Quiet",
    phases: [PHASE_TOP],
    purpose: "Every bit earned lowers the block.",
  },
  {
    id: "descent",
    label: "Descent (%)",
    phases: [PHASE_TOP],
    format: (v) => `${((v / FULL_DESCENT) * 100).toFixed(1)}%`,
  },
  // Know-how for the town and the sky.
  {
    id: "knowhow",
    label: "Know-how",
    phases: [PHASE_TOWN, PHASE_SKY],
    purpose: "Buys projects and overtime.",
  },
  // Sway: how far the tower leans, 0 (upright) to 1 (wobbling).
  ...hidden(["sway"]),
  // The playroom's dials: pace (set and where the dial is), lean, the streak,
  // the clock that stacks blocks, the tower awake until, the random stream,
  // the toddler's next visit, tumbles and banks (with when and how much).
  ...hidden(
    [
      "pcPace",
      "pcEff",
      "pcLean",
      "pcStreak",
      "pcAcc",
      "pcArmed",
      "pcRng",
      "pcTodNext",
      "pcChanges",
      "pcSoftUntil",
      "pcTumbles",
      "pcTumbleAt",
      "pcRebuildUntil",
      "pcPauseUntil",
      "pcLostN",
      "pcBanks",
      "pcBankAt",
      "pcBankN",
      "pcBankPays",
      "pcIdle",
    ],
    { pcPace: TUNING.playroom.startPace, pcEff: TUNING.playroom.startPace }
  ),
  // The town's dials: foremen on each hat, the one on the way and when he
  // arrives, who left and arrived last, the shadow's lamps and park, the day
  // and the next one, and a die of its own.
  ...hidden([
    "tfH0",
    "tfH1",
    "tfH2",
    "tfP0",
    "tfP1",
    "tfP2",
    "tfU0",
    "tfU1",
    "tfU2",
    "tfGone",
    "tfWho",
    "tfAt",
    "tfStartAt",
    "tfStarts",
    "tfSwaps",
    "twLamps",
    "twPark",
    "twBuys",
    "twLitAt",
    "twDay",
    "twNext",
    "twEnd",
    "twDayN",
    "twRng",
    "twPoleUntil",
    "twDayAt",
    "tfHatOff",
    "tfHatOn",
  ]),
  // Overtime: seconds left and times held.
  ...hidden(["otLeft", "otCount"]),
  // Forks: 0 not chosen, 1 the first side, 2 the second (one per phase).
  ...hidden(["fkPlay", "fkTown", "fkSky", "fkTop"]),
  // Foundations: the share kept back (a step), the stock in the footing and
  // how many times the share was changed.
  ...hidden(["ftStep", "ftStock", "ftChanges"]),
  // Deliveries: stage (0 waiting, 1 here), the clock, loads placed, the last
  // load placed (1 to 3), and how much it paid, in plain units.
  ...hidden(["dlStage", "dlTime", "dlCount", "dlLast", "dlLastPays"]),
];
