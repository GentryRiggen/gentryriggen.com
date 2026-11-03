import type { EventSource } from "../../engine/types";
import { paradeSeconds, paradesSoFar } from "./knowhow";

/** What goes in Make Everyone Smile's running log. */
export const SMILE_EVENTS: readonly EventSource[] = [
  {
    id: "parade",
    count: paradesSoFar,
    line: () =>
      `The parade is on! Everything pays extra for ${paradeSeconds()} seconds.`,
  },
];
