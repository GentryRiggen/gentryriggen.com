import type { UniverseDef } from "../../engine/types";
import { GROW_ACTIONS } from "./actions";
import { growAlert } from "./alerts";
import {
  GROW_CONSUMABLES,
  GROW_PLATE_ACTIONS,
  growIncomeView,
  growPlates,
  growSceneDiff,
} from "./hooks";
import { PHASES } from "./phases";
import { PRESTIGE } from "./prestige";
import { RESOURCES } from "./resources";
import { STORY } from "./story";
import { isGrowComplete, manualGrow, tickGrow } from "./tick";
import { UPGRADES } from "./upgrades";
import { TEASERS, VISITORS, growCountdown } from "./visitors";

export { sceneInfo } from "./scene";
export type { GrowSceneInfo } from "./scene";

export const growUniverse: UniverseDef = {
  id: "grow",
  title: "Make It Grow",
  goal: "Help one small seed grow, and then keep helping.",
  resources: RESOURCES,
  phases: PHASES,
  upgrades: UPGRADES,
  actions: GROW_ACTIONS,
  maxVisible: 3,
  story: STORY,
  teasers: TEASERS,
  visitors: VISITORS,
  countdown: growCountdown,
  alert: growAlert,
  prestige: PRESTIGE,
  plates: growPlates,
  plateActions: GROW_PLATE_ACTIONS,
  consumables: GROW_CONSUMABLES,
  incomeView: growIncomeView,
  sceneDiff: growSceneDiff,
  tick: tickGrow,
  manualAction: manualGrow,
  isComplete: isGrowComplete,
};
