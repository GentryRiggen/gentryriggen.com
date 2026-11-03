import type { ResourceDef } from "../../engine/types";

export const PHASE_FRIEND = "friend";
export const PHASE_TOWN = "town";
export const PHASE_WORLD = "world";
export const PHASE_QUIET = "quiet";

export type SmilePhaseId =
  | typeof PHASE_FRIEND
  | typeof PHASE_TOWN
  | typeof PHASE_WORLD
  | typeof PHASE_QUIET;

/** Phase ids, in order (the index is the run's `phase`). */
export const PHASE_IDS: readonly SmilePhaseId[] = [
  PHASE_FRIEND,
  PHASE_TOWN,
  PHASE_WORLD,
  PHASE_QUIET,
];

/** What each phase's tap earns, by phase index. */
export const MANUAL_RESOURCES = [
  "smiles",
  "cheers",
  "grins",
  "patience",
] as const;

/** How much of the one friendship is grown, 0 to 100. */
export const FULL_TRUST = 100;

const HIDDEN: readonly string[] = [];

const hidden = (ids: readonly string[]): ResourceDef[] =>
  ids.map((id): ResourceDef => ({ id, label: id, phases: HIDDEN }));

export const RESOURCES: readonly ResourceDef[] = [
  {
    id: "smiles",
    label: "Smiles",
    phases: [PHASE_FRIEND],
    purpose: "Buys cheer-ups and milestones.",
  },
  {
    id: "cheers",
    label: "Cheers",
    phases: [PHASE_TOWN],
    purpose: "Buys town helpers and milestones.",
  },
  {
    id: "grins",
    label: "Grins",
    phases: [PHASE_WORLD],
    purpose: "Buys world helpers and milestones.",
  },
  {
    id: "patience",
    label: "Patience",
    phases: [PHASE_QUIET],
    purpose: "Every bit earned builds trust.",
  },
  {
    id: "trust",
    label: "Trust (%)",
    phases: [PHASE_QUIET],
    format: (v) => `${((v / FULL_TRUST) * 100).toFixed(1)}%`,
  },
  {
    id: "knowhow",
    label: "Know-how",
    phases: [PHASE_TOWN, PHASE_WORLD],
    purpose: "Buys projects and parades.",
  },
  // The cheer meter: heat (0 to 1) and whether the crowd is worn out.
  ...hidden(["mtHeat", "mtTired"]),
  // The parade: seconds left and parades held.
  ...hidden(["pdLeft", "pdCount"]),
  // The puppy's ball: stage (0 away, 1 ready), the clock and throws made.
  ...hidden(["ftStage", "ftTime", "ftThrows"]),
  // Forks: 0 not chosen, 1 the first side, 2 the second (one per phase).
  ...hidden(["fkFriend", "fkTown", "fkWorld", "fkQuiet"]),
  // The friendship bank: the share kept (a step), what is in it, times changed.
  ...hidden(["bdStep", "bdStock", "bdChanges"]),
  // The friend's wants: stage (0 resting, 1 wanting), the clock, the want,
  // answers given, the last answer (right or not), and care for the last one.
  ...hidden([
    "qtStage",
    "qtTime",
    "qtWant",
    "qtTends",
    "qtLastRight",
    "qtLastPays",
    "qtPaused",
  ]),
];
