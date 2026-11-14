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
    id: "coins",
    label: "Coins",
    phases: [PHASE_TOWN],
    purpose: "Buys floats and town projects.",
  },
  {
    id: "knowhow",
    label: "Know-how",
    phases: [PHASE_WORLD],
    purpose: "Buys projects and broadcasts.",
  },
  // The world's dial: the real share of smiles, the loudspeaker level and the
  // one being tuned to (seconds left), changes, the day (kind, seconds left,
  // calm left, count), the random stream, the big moments' clocks and counts,
  // and the real share the Quiet opened with.
  ...hidden([
    "wsReal",
    "wsLoud",
    "wsNext",
    "wsTune",
    "wsChanges",
    "wsDay",
    "wsDayLeft",
    "wsCalm",
    "wsDays",
    "wsRng",
    "wsLostAt",
    "wsLosses",
    "wsHealAt",
    "wsHeals",
    "wsDroneAt",
    "wsDrones",
    "wsKept",
  ]),
  // The cheer broadcast (the world): seconds left and broadcasts held.
  ...hidden(["pdLeft", "pdCount"]),
  // The town: the price and the one being painted, the seconds left, floats
  // on each street and owned, the one on the road (and where to, how long),
  // each street's mood, the day (kind, street, seconds left, calm left, count),
  // the random stream, and the big moments' clocks.
  ...hidden([
    "tnPrice",
    "tnNext",
    "tnPaint",
    "tnChanges",
    "tnFloats",
    "tnF0",
    "tnF1",
    "tnF2",
    "tnF3",
    "tnMove",
    "tnTo",
    "tnMoveLeft",
    "tnMoves",
    "tnH0",
    "tnH1",
    "tnH2",
    "tnH3",
    "tnDay",
    "tnDaySt",
    "tnDayLeft",
    "tnCalm",
    "tnDays",
    "tnRng",
    "tnArriveAt",
    "tnArriveSt",
    "tnGrumpAt",
    "tnGrumpSt",
  ]),
  // Forks: 0 not chosen, 1 the first side, 2 the second (one per phase).
  ...hidden(["fkFriend", "fkTown", "fkWorld", "fkQuiet"]),
  // What you do together: the activity, the one being switched to and the
  // seconds left, wear per activity, the bond, the friend's need and its
  // clock, three hints, the random stream, and the big moments' clocks.
  ...hidden([
    "tgAct",
    "tgNext",
    "tgSwitch",
    "tgWear0",
    "tgWear1",
    "tgWear2",
    "tgBond",
    "tgNeed",
    "tgSince",
    "tgLeft",
    "tgH0",
    "tgH1",
    "tgH2",
    "tgRng",
    "tgPaused",
    "tgChanges",
    "tgEpoch",
    "tgLitEpoch",
    "tgLitAt",
    "tgLits",
    "tgSighAt",
    "tgSighWhy",
    "tgSighs",
  ]),
  // The bench: the seat, the seat being scooted to and the seconds left, the
  // seconds they stay at the far end, seconds sat somewhere uncomfortable, what
  // is happening (and its age, and the seconds to the next), the random stream
  // and mood phase, and the big moments' clocks and counts.
  ...hidden([
    "qbSeat",
    "qbTo",
    "qbMove",
    "qbAway",
    "qbCrowd",
    "qbEv",
    "qbEvT",
    "qbNext",
    "qbRng",
    "qbPhase",
    "qbLandAt",
    "qbLands",
    "qbPullAt",
    "qbPulls",
    "qbPullWhy",
  ]),
];
