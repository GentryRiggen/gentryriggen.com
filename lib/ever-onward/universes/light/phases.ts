import type { PhaseDef, RunState } from "../../engine/types";
import {
  COAST_LIGHTHOUSES,
  PHASE_COAST,
  PHASE_LAST,
  PHASE_NIGHT,
  PHASE_SKY,
} from "./resources";
import { TUNING } from "./tuning";
import { syncDisplay } from "./tick";

const headStart = (run: RunState): number => run.mods.headStart ?? 0;

export const PHASES: readonly PhaseDef[] = [
  {
    id: PHASE_COAST,
    title: "The Coast",
    intro:
      "One lighthouse. One lamp. One job: keep the light on. How hard can that be?",
    manualResource: "coins",
    manualLabel: "Flash the light",
    isDone: (run) => run.resources.lighthouses >= COAST_LIGHTHOUSES,
    onEnter: (run) => {
      run.resources.coins += 40 * headStart(run);
      syncDisplay(run);
    },
  },
  {
    id: PHASE_NIGHT,
    title: "No More Night",
    intro:
      "The coast is lit. The town has a request: could the streetlights work too? And the next town? And the next?",
    manualResource: "power",
    manualLabel: "Crank the generator",
    isDone: (run) => run.resources.night <= 0.001,
    onEnter: (run) => {
      // Old coins no longer matter; the grid runs on power.
      run.resources.power += 20 * headStart(run);
      run.resources.night = 100;
      run.resources.grid = 100;
      run.resources.rush = 0;
      run.resources.rushCooldown = TUNING.night.rushFirst;
      syncDisplay(run);
    },
  },
  {
    id: PHASE_SKY,
    title: "The Sky",
    intro:
      "The night is gone from the ground. But the sun is wasting light all day, and the stars are only just sitting there.",
    manualResource: "energy",
    manualLabel: "Aim a collector",
    isDone: (run) => run.resources.stars <= 0.5,
    onEnter: (run) => {
      run.resources.energy += 20 * headStart(run);
      run.resources.heading = 100;
      run.resources.flare = 0;
      run.resources.flareCooldown = TUNING.sky.flareFirst;
      syncDisplay(run);
    },
  },
  {
    id: PHASE_LAST,
    title: "The Last Light",
    intro:
      "The sky is empty and quiet. Light does not last forever, and now it is up to you which lights stay.",
    manualResource: "energy",
    manualLabel: "Tend the flame",
    isDone: () => false,
    onEnter: (run) => {
      run.resources.energy = Math.max(
        run.resources.energy,
        TUNING.last.startEnergy
      );
      run.resources.resolve = 0;
      syncDisplay(run);
    },
  },
];
