import type { ReactNode } from "react";
import { crateIcon } from "./CrateIcon";

/** Task 6 replaces these crates with real drawings. */
export const CREW_ICONS = {
  plank: crateIcon("plank"),
  "pirate-crew": crateIcon("pirate-crew"),
  parrot: crateIcon("parrot"),
} satisfies Record<string, () => ReactNode>;
