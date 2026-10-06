import type { ReactNode } from "react";
import { crateIcon } from "./CrateIcon";

/** Task 5 replaces these crates with real drawings. */
export const DECO_ICONS = {
  "cabin-captain": crateIcon("cabin-captain"),
  "helm-wheel": crateIcon("helm-wheel"),
  figurehead: crateIcon("figurehead"),
  "ship-anchor": crateIcon("ship-anchor"),
  "barrel-stack": crateIcon("barrel-stack"),
  "crate-stack": crateIcon("crate-stack"),
  "treasure-chest": crateIcon("treasure-chest"),
  rowboat: crateIcon("rowboat"),
} satisfies Record<string, () => ReactNode>;
