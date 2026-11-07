import type { ActionDef } from "../../engine/types";
import { FORK_ACTIONS } from "./forks";
import { PARADE_ACTIONS } from "./knowhow";
import { QUIET_ACTIONS } from "./quiet";
import { TOGETHER_ACTIONS } from "./together";
import { TOWN_ACTIONS } from "./town";

/** Every hand-made decision besides the tap and the shop. */
export const SMILE_ACTIONS: readonly ActionDef[] = [
  ...FORK_ACTIONS,
  ...TOGETHER_ACTIONS,
  ...TOWN_ACTIONS,
  ...PARADE_ACTIONS,
  ...QUIET_ACTIONS,
];
