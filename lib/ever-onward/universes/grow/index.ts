import { growGoal } from "./goal";
import type { UniverseDef } from "../../engine/types";
import { GROW_ACTIONS } from "./actions";
import { GROW_PROJECTS } from "./knowhow";
import { growAlert } from "./alerts";
import { growGauge } from "./gauge";
import {
  GROW_CONSUMABLES,
  GROW_DECISION_ACTIONS,
  GROW_PLATE_ACTIONS,
  growIncomeView,
  growPlates,
  growSceneDiff,
} from "./hooks";
import { PHASES } from "./phases";
import { GROW_MAP } from "./map";
import { PRESTIGE } from "./prestige";
import { RESOURCES } from "./resources";
import { STORY } from "./story";
import { GROW_EVENTS } from "./events";
import { isGrowComplete, manualGrow, tickGrow } from "./tick";
import { UPGRADES } from "./upgrades";
import { TEASERS, VISITORS, growCountdown } from "./visitors";

export { sceneInfo } from "./scene";
export type { GrowSceneInfo } from "./scene";

export const growUniverse: UniverseDef = {
  id: "grow",
  title: "Make It Grow",
  goal: "Help one small seed grow, and then keep helping.",
  requires: {
    universeId: "light",
    hint: "Opens when you finish Keep the Light On.",
  },
  resources: RESOURCES,
  phases: PHASES,
  upgrades: UPGRADES,
  actions: GROW_ACTIONS,
  projects: GROW_PROJECTS,
  maxVisible: 3,
  goalMeter: growGoal,
  story: STORY,
  events: GROW_EVENTS,
  teasers: TEASERS,
  visitors: VISITORS,
  countdown: growCountdown,
  alert: growAlert,
  gauge: growGauge,
  prestige: PRESTIGE,
  map: GROW_MAP,
  plates: growPlates,
  plateActions: GROW_PLATE_ACTIONS,
  decisionActions: GROW_DECISION_ACTIONS,
  consumables: GROW_CONSUMABLES,
  incomeView: growIncomeView,
  sceneDiff: growSceneDiff,
  tick: tickGrow,
  manualAction: manualGrow,
  isComplete: isGrowComplete,
};
