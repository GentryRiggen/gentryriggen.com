import type { ActionDef } from "../../engine/types";
import { BOND_ACTIONS } from "./bond";
import { FETCH_ACTIONS } from "./fetch";
import { FORK_ACTIONS } from "./forks";
import { PARADE_ACTIONS } from "./knowhow";
import { QUIET_ACTIONS } from "./quiet";

/** Every hand-made decision besides the tap and the shop. */
export const SMILE_ACTIONS: readonly ActionDef[] = [
  ...FORK_ACTIONS,
  ...BOND_ACTIONS,
  ...FETCH_ACTIONS,
  ...PARADE_ACTIONS,
  ...QUIET_ACTIONS,
];
