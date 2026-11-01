import type { ComponentType } from "react";
import type { RunState } from "@/lib/little-machines/engine/types";
import LightScene from "./light/LightScene";

/** Scene per universe id; each draws only from the run it is given. */
export const SCENES: Record<string, ComponentType<{ run: RunState }>> = {
  light: LightScene,
};
