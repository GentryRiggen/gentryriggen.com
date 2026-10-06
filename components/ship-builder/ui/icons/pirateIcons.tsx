import type { ReactNode } from "react";
import type { PIRATE_PART_TYPES } from "@/lib/ship-builder/model/types";
import { CANNON_ICONS } from "./pirate/cannons";
import { CREW_ICONS } from "./pirate/crew";
import { DECO_ICONS } from "./pirate/deco";
import { SAIL_ICONS } from "./pirate/sails";

/** Typed against the part list so a missing icon is a compile error. */
export const PIRATE_ICONS: Record<
  (typeof PIRATE_PART_TYPES)[number],
  () => ReactNode
> = {
  ...SAIL_ICONS,
  ...CANNON_ICONS,
  ...DECO_ICONS,
  ...CREW_ICONS,
};
