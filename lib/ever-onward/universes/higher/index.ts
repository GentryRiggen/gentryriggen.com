import { higherGoal } from "./goal";
import type { UniverseDef } from "../../engine/types";
import { HIGHER_ACTIONS } from "./actions";
import { higherAlert } from "./alerts";
import { isSkyMomentBusy } from "./sky";
import { higherGauge } from "./gauge";
import {
  HIGHER_CONSUMABLES,
  HIGHER_DECISION_ACTIONS,
  HIGHER_PLATE_ACTIONS,
  higherIncomeView,
  higherPlates,
  higherSceneDiff,
} from "./hooks";
import { HIGHER_PROJECTS } from "./knowhow";
import { PHASES } from "./phases";
import { HIGHER_MAP } from "./map";
import { PRESTIGE } from "./prestige";
import { RESOURCES } from "./resources";
import { STORY } from "./story";
import { HIGHER_EVENTS } from "./events";
import { isHigherComplete, manualHigher, tickHigher } from "./tick";
import { UPGRADES } from "./upgrades";
import { TEASERS, VISITORS, higherCountdown } from "./visitors";

export { sceneInfo } from "./scene";
export type { HigherSceneInfo } from "./scene";

export const higherUniverse: UniverseDef = {
  id: "higher",
  title: "Build It Higher",
  goal: "Stack one more block, then one more, then one more.",
  requires: {
    universeId: "grow",
    hint: "Opens when you finish Make It Grow.",
  },
  resources: RESOURCES,
  phases: PHASES,
  upgrades: UPGRADES,
  actions: HIGHER_ACTIONS,
  projects: HIGHER_PROJECTS,
  maxVisible: 3,
  goalMeter: higherGoal,
  story: STORY,
  events: HIGHER_EVENTS,
  teasers: TEASERS,
  visitors: VISITORS,
  countdown: higherCountdown,
  alert: higherAlert,
  isSceneBusy: isSkyMomentBusy,
  gauge: higherGauge,
  prestige: PRESTIGE,
  map: HIGHER_MAP,
  plates: higherPlates,
  plateActions: HIGHER_PLATE_ACTIONS,
  decisionActions: HIGHER_DECISION_ACTIONS,
  consumables: HIGHER_CONSUMABLES,
  incomeView: higherIncomeView,
  sceneDiff: higherSceneDiff,
  tick: tickHigher,
  manualAction: manualHigher,
  isComplete: isHigherComplete,
};
