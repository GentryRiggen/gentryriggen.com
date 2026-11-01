import type { PhaseDef, RunState } from "../../engine/types";
import {
  MANUAL_RESOURCES,
  PHASE_FARM,
  PHASE_SEED,
  PHASE_WORLD,
  PHASE_YARD,
} from "./resources";
import { seedBiomes } from "./biomes";
import { seedMarket } from "./market";
import { TUNING } from "./tuning";
import { fillFarmTank, fillWorldTank, seedWater } from "./water";
import { openWindowBox } from "./windowbox";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** A prestige gift: some seconds of three helpers' income, up front. */
function headStart(index: number): (run: RunState) => void {
  return (run) => {
    const level = run.mods.headStart ?? 0;
    if (level <= 0) return;
    run.resources[MANUAL_RESOURCES[index]] +=
      TUNING.headStartSeconds * level * TUNING.phases[index].helper * 3;
  };
}

export const PHASES: readonly PhaseDef[] = [
  {
    id: PHASE_YARD,
    title: "The Backyard",
    intro:
      "This is one small seed, and you are its gardener. It sits in a plain pot on a plain windowsill, waiting for a drop of water and a bit of luck. Water it, keep the soil damp and watch what happens. Every big garden starts exactly like this.",
    goal: "Water the seed and build a cold frame.",
    manualResource: "seeds",
    manualLabel: "Water the seed",
    isDone: (run) => owned(run, "cold-frame") >= 1,
    onEnter: (run) => {
      seedWater(run);
      headStart(0)(run);
    },
  },
  {
    id: PHASE_FARM,
    title: "The Farm",
    intro:
      "The seed grew, and then the seed grew seeds. Now there are rows and rows of green, a muddy boot by the gate and a scarecrow who needs a hat. Pick what is ready, plant what comes next and fill the barn.",
    goal: "Bring in the harvest and raise a barn.",
    manualResource: "harvest",
    manualLabel: "Pick the harvest",
    isDone: (run) => owned(run, "grain-barn") >= 1,
    onEnter: (run) => {
      // Leftover seeds are worth a little at the farm gate.
      run.resources.harvest += Math.floor(
        (run.resources.seeds ?? 0) * TUNING.farm.seedsToHarvest
      );
      fillFarmTank(run);
      seedMarket(run);
      headStart(1)(run);
    },
  },
  {
    id: PHASE_WORLD,
    title: "The Whole World",
    intro:
      "The farm fed the valley, and the valley wrote to its neighbors. Now the grey places are asking for trees, the dry places for rain and the bare places for anything at all. Plant widely and plant kindly. One green thing is so much better than none.",
    goal: "Spread green across the world and build a seed vault.",
    manualResource: "green",
    manualLabel: "Plant something green",
    isDone: (run) => owned(run, "seed-vault") >= 1,
    onEnter: (run) => {
      // The farm's leftover harvest turns into the first green.
      run.resources.green += Math.floor(
        (run.resources.harvest ?? 0) * TUNING.world.harvestToGreen
      );
      seedBiomes(run);
      fillWorldTank(run);
      headStart(2)(run);
    },
  },
  {
    id: PHASE_SEED,
    title: "The Old Window Box",
    intro:
      "The whole world is green now, and so quiet you can hear the leaves. The robot has grown everything there is to grow, except for one thing: the old window box, empty on its sill. The kid who planted the first seed grew up and moved away. So the robot tends one small pot and plants one small seed, just in case they come back.",
    goal: "Tend the old window box until the seed blooms.",
    manualResource: "care",
    manualLabel: "Tend the pot",
    isDone: () => false,
    onEnter: (run) => {
      openWindowBox(run);
      headStart(3)(run);
    },
  },
];
