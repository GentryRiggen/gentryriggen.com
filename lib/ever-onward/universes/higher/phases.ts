import type { PhaseDef, RunState } from "../../engine/types";
import { CUTSCENES, TIPS } from "./cutscenes";
import { resetDeliveries } from "./deliveries";
import { HELPER_LINES } from "./lines";
import {
  MANUAL_RESOURCES,
  PHASE_PLAYROOM,
  PHASE_SKY,
  PHASE_TOP,
  PHASE_TOWN,
} from "./resources";
import { TUNING } from "./tuning";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** A prestige gift: some seconds of the first helper line's work, up front. */
function headStart(index: number): (run: RunState) => void {
  return (run) => {
    const level = run.mods.headStart ?? 0;
    if (level <= 0) return;
    run.resources[MANUAL_RESOURCES[index]] +=
      TUNING.headStartSeconds *
      level *
      (TUNING.rates[HELPER_LINES[index][0]] ?? 0) *
      3;
  };
}

/** Every part begins with an upright tower, empty footing and no shift on. */
function freshSite(run: RunState): void {
  run.resources.sway = 0;
  run.resources.ftStock = 0;
  run.resources.otLeft = 0;
  run.resources.dlLast = 0;
  resetDeliveries(run);
}

/** What a part's leftovers are worth in the next part's own stuff. */
export const CARRY_RATES = [0.004, 0.0002, 0.00001] as const;

/** The most the last part's leftovers can hand the robot at the top. */
export const CARRY_CAP_TOP = 5;

export const PHASES: readonly PhaseDef[] = [
  {
    id: PHASE_PLAYROOM,
    cutscene: CUTSCENES[PHASE_PLAYROOM],
    tips: TIPS[PHASE_PLAYROOM],
    title: "The Playroom",
    intro:
      "This is one little builder robot, and it has been told one thing: build it higher. There is a rug, a box of wooden blocks and a very tall afternoon. Stack a block, then another. Every big tower starts exactly like this.",
    goal: "Stack blocks and build a treehouse.",
    manualResource: "blocks",
    manualLabel: "Stack a block",
    tapDoes: "stack a block and earn blocks",
    isDone: (run) => owned(run, "treehouse") >= 1,
    onEnter: (run) => {
      freshSite(run);
      headStart(0)(run);
    },
  },
  {
    id: PHASE_TOWN,
    cutscene: CUTSCENES[PHASE_TOWN],
    tips: TIPS[PHASE_TOWN],
    title: "The Town",
    intro:
      "The treehouse grew into a tower, and the whole town came out to look. There are bricks to lay, cranes to swing and a mayor with very large scissors. Everybody cheers, and the robot is a hero. Keep building, and keep it standing straight.",
    goal: "Raise the tower to the top floor.",
    manualResource: "bricks",
    manualLabel: "Lay a brick",
    tapDoes: "lay a brick and earn bricks",
    isDone: (run) => owned(run, "skyscraper") >= 1,
    onEnter: (run) => {
      // Leftover blocks are worth a little at the building yard.
      run.resources.bricks += Math.floor(
        (run.resources.blocks ?? 0) * CARRY_RATES[0]
      );
      freshSite(run);
      // A new site keeps a quarter back as footing; the panel changes it.
      run.resources.ftStep = 1;
      headStart(1)(run);
    },
  },
  {
    id: PHASE_SKY,
    cutscene: CUTSCENES[PHASE_SKY],
    tips: TIPS[PHASE_SKY],
    title: "The Sky",
    intro:
      "The tower climbs past the clouds, past the birds, past the place where the aeroplanes go. Down below, the town is in its shadow, and fewer lights are on in the streets. Up here there is just wind, and one more beam, and a long, long cable.",
    goal: "Climb past the clouds and set the last block.",
    manualResource: "beams",
    manualLabel: "Hoist a beam",
    tapDoes: "hoist a beam and earn beams",
    isDone: (run) => owned(run, "space-elevator") >= 1,
    onEnter: (run) => {
      run.resources.beams += Math.floor(
        (run.resources.bricks ?? 0) * CARRY_RATES[1]
      );
      freshSite(run);
      run.resources.ftStep = 1;
      headStart(2)(run);
    },
  },
  {
    id: PHASE_TOP,
    cutscene: CUTSCENES[PHASE_TOP],
    tips: TIPS[PHASE_TOP],
    title: "The Top",
    intro:
      "This is the very top. The last block is in place, and there is nobody up here but a robot, a lot of wind and some very quiet stars. The robot has built everything there is to build. It has one block left, and a long way to carry it down. It goes slowly. There is no hurry any more.",
    goal: "Carry the last block all the way down.",
    manualResource: "quiet",
    manualLabel: "Take a step down",
    tapDoes:
      "take a step down. Every bit of quiet you earn carries the block lower",
    isDone: () => false,
    onEnter: (run) => {
      run.resources.quiet += Math.min(
        CARRY_CAP_TOP,
        Math.floor((run.resources.beams ?? 0) * CARRY_RATES[2])
      );
      freshSite(run);
      headStart(3)(run);
    },
  },
];
