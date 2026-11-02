import type { PhaseDef, RunState } from "../../engine/types";
import { CUTSCENES } from "./cutscenes";
import { openQuiet } from "./quiet";
import {
  MANUAL_RESOURCES,
  PHASE_FRIEND,
  PHASE_QUIET,
  PHASE_TOWN,
  PHASE_WORLD,
} from "./resources";
import { TUNING } from "./tuning";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** A prestige gift: some seconds of three helpers' income, up front. */
function headStart(index: number): (run: RunState) => void {
  return (run) => {
    const level = run.mods.headStart ?? 0;
    if (level <= 0) return;
    const { lines } = TUNING.phases[index];
    run.resources[MANUAL_RESOURCES[index]] +=
      TUNING.headStartSeconds * level * lines[0] * 3;
  };
}

/** Leftover currency from the last part, worth a little in the next. */
function carry(from: number, to: number): (run: RunState) => void {
  return (run) => {
    run.resources[MANUAL_RESOURCES[to]] += Math.floor(
      (run.resources[MANUAL_RESOURCES[from]] ?? 0) * TUNING.carry[from]
    );
  };
}

export const PHASES: readonly PhaseDef[] = [
  {
    id: PHASE_FRIEND,
    cutscene: CUTSCENES[PHASE_FRIEND],
    title: "One Sad Friend",
    intro:
      "This is a robot with one job: make everyone smile. And here is the first someone, sitting on a step with their chin in their hands. Tell a joke, tie on a balloon, pour a lemonade and see what happens. Every big cheer starts with one small laugh.",
    goal: "Cheer up your friend and knock next door.",
    manualResource: "smiles",
    manualLabel: "Tell a joke",
    isDone: (run) => owned(run, "next-door") >= 1,
    onEnter: (run) => headStart(0)(run),
  },
  {
    id: PHASE_TOWN,
    cutscene: CUTSCENES[PHASE_TOWN],
    title: "The Town",
    intro:
      "The friend is smiling, and good news gets around fast. Now there is a whole town of faces, and the robot has a funny hat, a parade and a plan. Be loud, be silly and leave nobody out. Nobody ever asked for a quieter town.",
    goal: "Fill the town with cheer and earn the key.",
    manualResource: "cheers",
    manualLabel: "Cheer the street",
    isDone: (run) => owned(run, "key-to-town") >= 1,
    onEnter: (run) => {
      carry(0, 1)(run);
      headStart(1)(run);
    },
  },
  {
    id: PHASE_WORLD,
    cutscene: CUTSCENES[PHASE_WORLD],
    title: "The World",
    intro:
      "The town is delighted. The next town is delighted, and the one after that. The robot was told to make everyone smile, and everyone is a very big word. Posters go up, loudspeakers go on, and a cheerful voice wishes the whole world a nice day. It is a nice day. It is always a nice day.",
    goal: "Spread cheer to every place and launch the satellite.",
    manualResource: "grins",
    manualLabel: "Spread the cheer",
    isDone: (run) => owned(run, "cheer-satellite") >= 1,
    onEnter: (run) => {
      carry(1, 2)(run);
      headStart(2)(run);
    },
  },
  {
    id: PHASE_QUIET,
    cutscene: CUTSCENES[PHASE_QUIET],
    title: "The Quiet",
    intro:
      "The whole world is smiling, and so loud you can hardly hear yourself think. Then, at the very edge of the cheer, the robot spots one person on a bench who is not. The cheerful voice does not seem to reach it. So the robot puts down the paintbrush, and for the first time in a long time, it simply sits.",
    goal: "Sit with your friend until they are ready to smile.",
    manualResource: "patience",
    manualLabel: "Sit with them",
    isDone: () => false,
    onEnter: (run) => {
      openQuiet(run);
      headStart(3)(run);
    },
  },
];
