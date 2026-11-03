import type { EventSource } from "../../engine/types";
import { beeResultLine, followsSoFar } from "./bees";
import { fairResultLine, fairsSoFar } from "./fair";
import { flightsSoFar, migrationResultLine } from "./migration";

/** What goes in Make It Grow's running log. */
export const GROW_EVENTS: readonly EventSource[] = [
  { id: "fair", count: fairsSoFar, line: fairResultLine },
  { id: "bees", count: followsSoFar, line: beeResultLine },
  { id: "flock", count: flightsSoFar, line: migrationResultLine },
];
