import type { UniverseDef } from "../../engine/types";
import { ACTIONS } from "./actions";
import {
  LIGHT_CONSUMABLES,
  LIGHT_DECISION_ACTIONS,
  lightIncomeView,
  PLATE_ACTIONS,
  lightPlates,
  lightSceneDiff,
} from "./hooks";
import { lightAlert } from "./alerts";
import { lightGauge, lightGoal } from "./goal";
import { LIGHT_MAP } from "./map";
import { PHASES } from "./phases";
import { PRESTIGE } from "./prestige";
import { ALL_PROJECTS } from "./projects";
import { RESOURCES } from "./resources";
import { STORY } from "./story";
import { isCoastMomentBusy } from "./tanker";
import { isGridMomentBusy } from "./grid";
import { isSkyMomentBusy } from "./sunEdge";
import { isStormHit } from "./weather";
import { LIGHT_EVENTS } from "./events";
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
  projects: ALL_PROJECTS,
  maxVisible: 3,
  story: STORY,
  events: LIGHT_EVENTS,
  teasers: TEASERS,
  visitors: VISITORS,
  countdown: lightCountdown,
  alert: lightAlert,
  // A big moment on in the picture holds pop-ups back: the coast's tanker and
  // dark lamp, the night's blackout and lit night, a storm just landed, a flare or stray
  // probes in the sky (their first seconds only).
  isSceneBusy: (run) =>
    isCoastMomentBusy(run) ||
    isGridMomentBusy(run) ||
    isStormHit(run) ||
    isSkyMomentBusy(run),
  goalMeter: lightGoal,
  gauge: lightGauge,
  prestige: PRESTIGE,
  map: LIGHT_MAP,
  upkeep: (run): Record<string, number> => {
    if (run.phase === 0) return { coins: coastUpkeep(run) };
    return {};
  },
  plates: lightPlates,
  plateActions: PLATE_ACTIONS,
  decisionActions: LIGHT_DECISION_ACTIONS,
  consumables: LIGHT_CONSUMABLES,
  incomeView: lightIncomeView,
  sceneDiff: lightSceneDiff,
  tick: tickLight,
  manualAction: manualLight,
  isComplete: isLightComplete,
};
