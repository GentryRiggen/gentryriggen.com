import type { UniverseDef } from "../../engine/types";
import { ACTIONS } from "./actions";
import {
  LIGHT_CONSUMABLES,
  lightIncomeView,
  PLATE_ACTIONS,
  lightPlates,
  lightSceneDiff,
} from "./hooks";
import { PHASES } from "./phases";
import { PRESTIGE } from "./prestige";
import { RESOURCES } from "./resources";
import { STORY } from "./story";
import { coastUpkeep, isLightComplete, manualLight, tickLight } from "./tick";
import { UPGRADES } from "./upgrades";
import { TEASERS, VISITORS, lightCountdown } from "./visitors";

export { LANTERN_COUNT, lanternOf, sceneInfo } from "./scene";
export type { LightSceneInfo } from "./scene";

export const lightUniverse: UniverseDef = {
  id: "light",
  title: "Keep the Light On",
  goal: "Keep one old lighthouse lit, and see how far that goes.",
  resources: RESOURCES,
  phases: PHASES,
  upgrades: UPGRADES,
  actions: ACTIONS,
  maxVisible: 3,
  story: STORY,
  teasers: TEASERS,
  visitors: VISITORS,
  countdown: lightCountdown,
  prestige: PRESTIGE,
  upkeep: (run): Record<string, number> => {
    if (run.phase === 0) return { coins: coastUpkeep(run) };
    return {};
  },
  plates: lightPlates,
  plateActions: PLATE_ACTIONS,
  consumables: LIGHT_CONSUMABLES,
  incomeView: lightIncomeView,
  sceneDiff: lightSceneDiff,
  tick: tickLight,
  manualAction: manualLight,
  isComplete: isLightComplete,
};
