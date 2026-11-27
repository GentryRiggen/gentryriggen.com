/**
 * Every game on the site, newest first. The side-projects table, the
 * per-game commands and `help` all read this list, so a new game is one entry.
 */

import { EVER_ONWARD_VERSION } from "@/lib/ever-onward/version";
import { FLAMELINGS_VERSION } from "@/lib/flamelings/version";
import { PLANE_BUILDER_VERSION } from "@/lib/plane-builder/version";
import { PLANET_SMASHER_VERSION } from "@/lib/planet-smasher/version";
import { SHIP_BUILDER_VERSION } from "@/lib/ship-builder/version";
import { SHIPWRECK_VERSION } from "@/lib/shipwreck/version";

export interface Game {
  /** Route segment, shown as the folder name in the table. */
  id: string;
  name: string;
  emoji: string;
  /** About six words, for the table. */
  tagline: string;
  href: string;
  version: string;
  /** The short command shown in `help`. */
  command: string;
  /** Other words that launch it (lower case). The id always works too. */
  aliases: readonly string[];
  /** First line of the command's output. */
  blurb: string;
  /** Shown before the link while the page navigates. */
  launch: string;
  /** One line for `help`. */
  help: string;
}

export const GAMES: readonly Game[] = [
  {
    id: "shipwreck",
    name: "Shipwreck",
    emoji: "🚢",
    tagline: "sink history's famous ships, realistically",
    href: "/shipwreck",
    version: SHIPWRECK_VERSION,
    command: "shipwreck",
    aliases: ["titanic"],
    blurb:
      "A realistic sinking-ship simulator: the Titanic, the Concordia and more 🚢",
    launch: "Checking the bulkheads...",
    help: "Watch famous ships go down",
  },
  {
    id: "flamelings",
    name: "Flamelings",
    emoji: "🔥",
    tagline: "hatch, feed and dress a flame pet",
    href: "/flamelings",
    version: FLAMELINGS_VERSION,
    command: "flamelings",
    aliases: ["pets", "pet"],
    blurb: "A little flame pet I made for my boys 🔥",
    launch: "Lighting the egg...",
    help: "Hatch a little flame pet",
  },
  {
    id: "planet-smasher",
    name: "Planet Smasher",
    emoji: "🌍",
    tagline: "wreck worlds with nukes and black holes",
    href: "/planet-smasher",
    version: PLANET_SMASHER_VERSION,
    command: "planets",
    aliases: ["smash"],
    blurb: "A planet-smashing game I made for my boys 🌍☄️",
    launch: "Launching the asteroids...",
    help: "Play my planet-smashing game",
  },
  {
    id: "ever-onward",
    name: "Ever Onward",
    emoji: "💡",
    tagline: "robots who take one job too far",
    href: "/ever-onward",
    version: EVER_ONWARD_VERSION,
    command: "onward",
    // machines and little-machines are the series' old names.
    aliases: ["ever onward", "machines", "little-machines", "little machines"],
    blurb:
      "Ever Onward. A little series of incremental games about robots who take one job too far. 💡",
    launch: "Lighting the lamp...",
    help: "Play Ever Onward, my incremental games",
  },
  {
    id: "plane-builder",
    name: "Plane Builder",
    emoji: "✈️",
    tagline: "upgrade a slingshot plane to the finish",
    href: "/plane-builder",
    version: PLANE_BUILDER_VERSION,
    command: "planes",
    aliases: [],
    blurb: "A plane-flying game I made for my boys ✈️",
    launch: "Taking off in a moment...",
    help: "Play my plane-flying game",
  },
  {
    id: "ship-builder",
    name: "Ship Builder",
    emoji: "⚓",
    tagline: "build a ship block by block, then sail it",
    href: "/ship-builder",
    version: SHIP_BUILDER_VERSION,
    command: "ships",
    aliases: [],
    blurb: "A ship-building game I made for my boys ⚓",
    launch: "Setting sail in a moment...",
    help: "Play my ship-building game",
  },
];

/** The game a lower-case command launches, if any. */
export function gameForCommand(lower: string): Game | undefined {
  return GAMES.find(
    (game) =>
      game.command === lower ||
      game.id === lower ||
      game.aliases.includes(lower)
  );
}
