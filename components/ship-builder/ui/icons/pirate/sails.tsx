import type { ReactNode } from "react";
import { crateIcon } from "./CrateIcon";

/** Task 3 replaces these crates with real drawings. */
export const SAIL_ICONS = {
  "mast-wood-short": crateIcon("mast-wood-short"),
  "mast-wood-tall": crateIcon("mast-wood-tall"),
  "mast-wood-main": crateIcon("mast-wood-main"),
  "sail-square-small": crateIcon("sail-square-small"),
  "sail-square": crateIcon("sail-square"),
  "sail-square-large": crateIcon("sail-square-large"),
  "sail-jib": crateIcon("sail-jib"),
  "sail-lateen": crateIcon("sail-lateen"),
  "flag-jolly-roger": crateIcon("flag-jolly-roger"),
} satisfies Record<string, () => ReactNode>;
