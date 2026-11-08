import type { ActionDef } from "../../engine/types";
import { loadActions } from "./deliveries";
import { FOOTING_ACTIONS } from "./footing";
import { FORK_ACTIONS } from "./forks";
import { OVERTIME_ACTIONS } from "./knowhow";
import { PACE_ACTIONS, bankAction } from "./playroom";
import { SKY_ACTIONS } from "./sky";
import { TOWN_ACTIONS } from "./town";
import { tendingValue } from "./tick";

export const HIGHER_ACTIONS: readonly ActionDef[] = [
  ...SKY_ACTIONS,
  ...PACE_ACTIONS,
  ...TOWN_ACTIONS,
  bankAction(tendingValue),
  ...FORK_ACTIONS,
  ...FOOTING_ACTIONS,
  ...OVERTIME_ACTIONS,
  ...loadActions(tendingValue),
];
