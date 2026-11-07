import type { ActionDef } from "../../engine/types";
import { loadActions } from "./deliveries";
import { FOOTING_ACTIONS } from "./footing";
import { FORK_ACTIONS } from "./forks";
import { OVERTIME_ACTIONS } from "./knowhow";
import { PACE_ACTIONS, bankAction } from "./playroom";
import { STEADY_ACTION } from "./sway";
import { tendingValue } from "./tick";

export const HIGHER_ACTIONS: readonly ActionDef[] = [
  STEADY_ACTION,
  ...PACE_ACTIONS,
  bankAction(tendingValue),
  ...FORK_ACTIONS,
  ...FOOTING_ACTIONS,
  ...OVERTIME_ACTIONS,
  ...loadActions(tendingValue),
];
