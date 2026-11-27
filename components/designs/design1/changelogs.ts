/**
 * Every game's changelog by game id. Server only: app/page.tsx summarises it
 * at build time, so this never reaches the homepage bundle. A test checks it
 * covers every game in GAMES.
 */

import { CHANGELOG as EVER_ONWARD } from "@/lib/ever-onward/changelog";
import { CHANGELOG as FLAMELINGS } from "@/lib/flamelings/changelog";
import { CHANGELOG as PLANE_BUILDER } from "@/lib/plane-builder/changelog";
import { CHANGELOG as PLANET_SMASHER } from "@/lib/planet-smasher/changelog";
import { CHANGELOG as SHIP_BUILDER } from "@/lib/ship-builder/changelog";
import { CHANGELOG as SHIPWRECK } from "@/lib/shipwreck/changelog";
import type { ChangelogEntry } from "./releases";

export const CHANGELOGS: Readonly<Record<string, readonly ChangelogEntry[]>> = {
  "ever-onward": EVER_ONWARD,
  flamelings: FLAMELINGS,
  "plane-builder": PLANE_BUILDER,
  "planet-smasher": PLANET_SMASHER,
  "ship-builder": SHIP_BUILDER,
  shipwreck: SHIPWRECK,
};
