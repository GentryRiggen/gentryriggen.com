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
      "This is your lighthouse, and you are its keeper. Out on the dark water, little ships are looking for home, and your light is the only thing that shows them the way. Flash the lamp, guide them into the harbor, and build more lighthouses along the coast. Every ship you save matters.",
    goal: "Guide ships home and light the whole coast.",
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
      "The coast is glowing, and the town noticed. Now they want streetlights, then the next town's, then the one after that. Crank the generator and wire up the grid. Nobody asks what the dark was for, and you are far too busy to wonder.",
    goal: "Power the grid until there is no more night.",
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
      "The ground is bright, but look up. The sun pours light into the sky all day and nobody catches any of it, and the stars just sit there, burning for no one. You have a better idea. Aim your collectors and put every bit of that light to work.",
    goal: "Collect the sky's light until the last star is used.",
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
      "The sky is empty and very quiet. Light does not last forever, and every flame you tend is a choice. One small flame is left, and one small boat is still out on the dark water. It is up to you which lights stay.",
    goal: "Tend the flame and bring the last ship home.",
    manualResource: "resolve",
    manualLabel: "Tend the flame",
    isDone: () => false,
    onEnter: (run) => {
      // The flame starts here whatever came before, so the ending is the same
      // small thing for every player.
      run.resources.flame = TUNING.last.startFlame;
      run.resources.resolve = 0;
      run.resources.ships = 0;
      run.resources.boatHeading = 100;
      run.resources.boatProgress = 0;
      syncDisplay(run);
    },
  },
];
