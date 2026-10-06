import type { ReactNode } from "react";
import { crateIcon } from "./CrateIcon";

/** Task 4 replaces these crates with real drawings. */
export const CANNON_ICONS = {
  "cannon-deck": crateIcon("cannon-deck"),
  "cannon-chaser": crateIcon("cannon-chaser"),
  "cannon-swivel": crateIcon("cannon-swivel"),
} satisfies Record<string, () => ReactNode>;
