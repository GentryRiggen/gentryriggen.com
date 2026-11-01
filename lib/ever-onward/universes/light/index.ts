import type { UniverseDef } from "../../engine/types";
import { ACTIONS } from "./actions";
import { PHASES } from "./phases";
import { PRESTIGE } from "./prestige";
import { RESOURCES } from "./resources";
import { STORY } from "./story";
import {
  coastUpkeep,
  decayPerSecond,
  isLightComplete,
  manualLight,
  tickLight,
} from "./tick";
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
  actions: ACTIONS,
  maxVisible: 3,
  story: STORY,
  prestige: PRESTIGE,
  upkeep: (run): Record<string, number> => {
    if (run.phase === 0) return { coins: coastUpkeep(run) };
    if (run.phase === 3) return { energy: decayPerSecond(run) };
    return {};
  },
  tick: tickLight,
  manualAction: manualLight,
  isComplete: isLightComplete,
};
