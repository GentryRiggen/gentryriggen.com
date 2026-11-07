import type { EventSource } from "../../engine/types";
import { beeEvents, beeResultLine } from "./bees";
import { dayResultLine, harvestDays } from "./market";
import { pumpkinEvents, pumpkinResultLine } from "./pumpkin";
import { mixEvents, mixResultLine } from "./biomes";

/** What goes in Make It Grow's running log. */
export const GROW_EVENTS: readonly EventSource[] = [
  { id: "market", count: harvestDays, line: dayResultLine },
  { id: "pumpkin", count: pumpkinEvents, line: pumpkinResultLine },
  { id: "bees", count: beeEvents, line: beeResultLine },
  { id: "world-mix", count: mixEvents, line: mixResultLine },
];
