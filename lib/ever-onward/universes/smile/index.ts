import type { UniverseDef } from "../../engine/types";
import { SMILE_ACTIONS } from "./actions";
import { smileAlert } from "./alerts";
import {
  SMILE_CONSUMABLES,
  SMILE_DECISION_ACTIONS,
  SMILE_PLATE_ACTIONS,
  smileIncomeView,
  smilePlates,
  smileSceneDiff,
} from "./hooks";
import { SMILE_PROJECTS } from "./knowhow";
import { PHASES } from "./phases";
import { PRESTIGE } from "./prestige";
import { RESOURCES } from "./resources";
import { STORY } from "./story";
import { isSmileComplete, manualSmile, tickSmile } from "./tick";
import { UPGRADES } from "./upgrades";
import { TEASERS, VISITORS, smileCountdown } from "./visitors";

export { sceneInfo } from "./scene";
export type { SmileSceneInfo } from "./scene";

export const smileUniverse: UniverseDef = {
  id: "smile",
  title: "Make Everyone Smile",
  goal: "Cheer up one friend, and see how far the cheer can go.",
  requires: {
    universeId: "higher",
    hint: "Opens when you finish Build It Higher.",
  },
  resources: RESOURCES,
  phases: PHASES,
  upgrades: UPGRADES,
  actions: SMILE_ACTIONS,
  projects: SMILE_PROJECTS,
  maxVisible: 3,
  story: STORY,
  teasers: TEASERS,
  visitors: VISITORS,
  countdown: smileCountdown,
  alert: smileAlert,
  prestige: PRESTIGE,
  plates: smilePlates,
  plateActions: SMILE_PLATE_ACTIONS,
  decisionActions: SMILE_DECISION_ACTIONS,
  consumables: SMILE_CONSUMABLES,
  incomeView: smileIncomeView,
  sceneDiff: smileSceneDiff,
  tick: tickSmile,
  manualAction: manualSmile,
  isComplete: isSmileComplete,
};
