import type { UniverseDef } from "../../engine/types";
import { PHASES } from "./phases";
import { PRESTIGE } from "./prestige";
import { RESOURCES } from "./resources";
import { STORY } from "./story";
import { isLightComplete, manualLight, tickLight } from "./tick";
import { UPGRADES } from "./upgrades";

export { sceneInfo } from "./scene";
export type { LightSceneInfo } from "./scene";

export const lightUniverse: UniverseDef = {
  id: "light",
  title: "Keep the Light On",
  goal: "Keep one old lighthouse lit, and see how far that goes.",
  resources: RESOURCES,
  phases: PHASES,
  upgrades: UPGRADES,
  story: STORY,
  prestige: PRESTIGE,
  tick: tickLight,
  manualAction: manualLight,
  isComplete: isLightComplete,
};
