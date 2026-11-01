import type { ComponentType } from "react";
import type { RunState } from "@/lib/ever-onward/engine/types";
import type { LastBuy } from "./light/callouts";
import LightScene from "./light/LightScene";

/** Scene per universe id; each draws only from the run it is given. */
export const SCENES: Record<
  string,
  ComponentType<{ run: RunState; lastBuy?: LastBuy | null }>
> = {
  light: LightScene,
};
