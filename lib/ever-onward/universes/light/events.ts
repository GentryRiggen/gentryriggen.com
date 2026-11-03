import type { EventSource } from "../../engine/types";
import { gardenResultLine, picksSoFar } from "./garden";
import { resultLine, runsHome } from "./probes";
import { haulResultLine, haulsSoFar } from "./tide";
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
        ? `A storm is coming! The forecast says ${TOWNS[likeliestTown(run)] ?? TOWNS[0]} is likeliest. Send a crew to get ready.`
        : null,
    tone: () => "info",
  },
  {
    id: "storm",
    count: frontsSoFar,
    line: stormResultLine,
    tone: (run) => (lastStorm(run).kind === "flicker" ? "bad" : "good"),
  },
  { id: "haul", count: haulsSoFar, line: haulResultLine },
  { id: "probe", count: runsHome, line: resultLine },
  { id: "garden-pick", count: picksSoFar, line: gardenResultLine },
];
