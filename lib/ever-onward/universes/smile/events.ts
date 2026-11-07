import type { EventSource } from "../../engine/types";
import { paradeSeconds, paradesSoFar } from "./knowhow";
import { litCount, sighCount, togetherLine } from "./together";
import { dayLogLine, daysSoFar } from "./town";

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
];
