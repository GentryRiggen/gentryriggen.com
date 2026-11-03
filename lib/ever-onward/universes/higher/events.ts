import type { EventSource } from "../../engine/types";
import { overtimeSoFar } from "./knowhow";

/** What goes in Build It Higher's running log. */
export const HIGHER_EVENTS: readonly EventSource[] = [
  {
    id: "overtime",
    count: overtimeSoFar,
    line: () => "Overtime! The whole crew is working extra hard for a while.",
  },
];
