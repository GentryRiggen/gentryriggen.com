import type { EventSource } from "../../engine/types";
import { paradeSeconds, paradesSoFar } from "./knowhow";
import { litCount, sighCount, togetherLine } from "./together";
import { dayLogLine, daysSoFar } from "./town";
import {
  dayLogLine as worldDayLogLine,
  daysSoFar as worldDaysSoFar,
  healCount,
  lostCount,
} from "./world";

/** What goes in Make Everyone Smile's running log. */
export const SMILE_EVENTS: readonly EventSource[] = [
  {
    id: "parade",
    count: paradesSoFar,
    line: () =>
      `The parade is on! Everything pays extra for ${paradeSeconds()} seconds.`,
  },
  {
    id: "together",
    count: (run) => litCount(run) + sighCount(run),
    line: togetherLine,
  },
  {
    id: "town-day",
    count: daysSoFar,
    line: dayLogLine,
  },
  {
    id: "world-day",
    count: worldDaysSoFar,
    line: worldDayLogLine,
  },
  {
    id: "world-painted",
    count: lostCount,
    line: () =>
      "A stretch of faces goes still, with a grin that does not move. It is a very good grin.",
  },
  {
    id: "world-real",
    count: healCount,
    line: () =>
      "Somewhere in the crowd a real smile comes back, crinkly eyes and all.",
  },
];
