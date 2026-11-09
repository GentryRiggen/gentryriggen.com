import type { EventSource } from "../../engine/types";
import { goodbyeLine, letsSoFar } from "./warmth";
import { flareLine, homeLine, wildLine } from "./skyLines";
import { flaresSoFar } from "./sunEdge";
import { recallsSoFar, wildsSoFar } from "./design";
import { tankerLine, tankerVisits } from "./tanker";
import {
  frontsSoFar,
  lastStorm,
  likeliestTown,
  stormResultLine,
  TOWNS,
  weatherStage,
} from "./weather";

/** What goes in Keep the Light On's running log. */
export const LIGHT_EVENTS: readonly EventSource[] = [
  {
    // Counts forecasts begun: the landed fronts, plus the one on its way.
    id: "storm-coming",
    count: (run) =>
      frontsSoFar(run) + (weatherStage(run) === "forecast" ? 1 : 0),
    line: (run) =>
      weatherStage(run) === "forecast"
        ? `A storm is coming! The forecast says ${TOWNS[likeliestTown(run)] ?? TOWNS[0]} is likeliest. Post a crew on watch to get ready.`
        : null,
    tone: () => "info",
  },
  {
    id: "storm",
    count: frontsSoFar,
    line: stormResultLine,
    tone: (run) => (lastStorm(run).kind === "flicker" ? "bad" : "good"),
  },
  {
    id: "tanker",
    count: tankerVisits,
    line: tankerLine,
    tone: () => "good",
  },
  {
    id: "flare",
    count: flaresSoFar,
    line: flareLine,
    tone: (run) => ((run.resources.skHitLost ?? 0) >= 0.25 ? "bad" : "good"),
  },
  { id: "wild", count: wildsSoFar, line: wildLine, tone: () => "bad" },
  { id: "home", count: recallsSoFar, line: homeLine, tone: () => "good" },
  { id: "goodbye", count: letsSoFar, line: goodbyeLine, tone: () => "good" },
];
