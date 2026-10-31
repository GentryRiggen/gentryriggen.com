import {
  Anchor,
  CloudLightning,
  Link,
  Moon,
  Sailboat,
  Ship,
  Sun,
  Sunset,
  Unlink,
  Users,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type {
  BreakMode,
  LifeboatMode,
  SimEvent,
  SimSea,
} from "@/lib/ship-builder/sim/types";
import type { SeaState } from "../scene/seaState";
import type { TimeOfDay } from "../scene/timeOfDay";

/** How each sea reads in the trial's status line, matching the sea buttons. */
export const SEA_LABELS: Record<SimSea, string> = {
  calm: "Calm sea",
  choppy: "Choppy sea",
  stormy: "Stormy sea",
  wild: "Wild storm",
};

/**
 * Tooltip and accessible description for controls that are disabled while a
 * trial runs or its result shows.
 */
export const TRIAL_PAUSED_TITLE = "Paused during the sea trial";

/** One icon-and-word choice in a setup card row. */
export interface Choice<T> {
  value: T;
  label: string;
  Icon: LucideIcon;
}

/** The Waves card's seas, with the main screen's own icons. */
export const SEA_CHOICES: readonly Choice<SeaState>[] = [
  { value: "calm", label: "Calm", Icon: Sailboat },
  { value: "choppy", label: "Choppy", Icon: Wind },
  { value: "stormy", label: "Stormy", Icon: CloudLightning },
];

/** Every card's time of day, with the main screen's own icons. */
export const TIME_CHOICES: readonly Choice<TimeOfDay>[] = [
  { value: "day", label: "Day", Icon: Sun },
  { value: "sunset", label: "Sunset", Icon: Sunset },
  { value: "night", label: "Night", Icon: Moon },
];

/** The lifeboat switch on the storm and iceberg cards. */
export const LIFEBOAT_CHOICES: readonly Choice<LifeboatMode>[] = [
  { value: "titanic", label: "Like the Titanic", Icon: Ship },
  { value: "fill", label: "Fill every seat", Icon: Users },
];

/** The break-mode switch on the aim panel, in the order it shows them. */
export const BREAK_MODE_OPTIONS: readonly {
  mode: BreakMode;
  label: string;
  Icon: LucideIcon;
  help: string;
}[] = [
  {
    mode: "real",
    label: "Real",
    Icon: Anchor,
    help: "Long ships can break in two as they sink, like the real one did.",
  },
  {
    mode: "always",
    label: "Break her",
    Icon: Unlink,
    help: "If she sinks, she breaks in two.",
  },
  {
    mode: "never",
    label: "Hold together",
    Icon: Link,
    help: "If she sinks, she goes down in one piece.",
  },
];

/** The storm's name for its first mark (the iceberg trial's "Iceberg"). */
export const STORM_FLOODING_LABEL = "Water in";

/** The scrubber's tick marks: which events get one, and what they are called. */
export const TIMELINE_MARKS: readonly {
  kind: SimEvent["kind"];
  label: string;
}[] = [
  { kind: "flooding", label: "Iceberg" },
  { kind: "power-flicker", label: "Lights flicker" },
  { kind: "power-out", label: "Lights out" },
  { kind: "broke", label: "Breaks in two" },
  { kind: "sunk", label: "Sinks" },
  { kind: "touched-bottom", label: "Sea floor" },
];

/**
 * The result card's lifeboat line for a ship that sank: the real seats
 * against the real people, then whether they were enough ("Fill every seat")
 * or the Titanic's half-empty boats, or that she had none at all.
 */
export function lifeboatLines(
  { seats, people }: { seats: number; people: number },
  mode: LifeboatMode
): string[] {
  const counts = `Lifeboat seats: ${seats.toLocaleString()}. People aboard: ${people.toLocaleString()}.`;
  if (seats === 0) return [counts, "She had no lifeboats."];
  if (mode === "titanic") {
    return [counts, "Some boats left half-empty, like the Titanic."];
  }
  const left = people - seats;
  if (left <= 0) return [counts, "Everyone fit in the lifeboats!"];
  const who =
    left === 1 ? "1 person was" : `${left.toLocaleString()} people were`;
  return [counts, `Not enough lifeboats: ${who} left on board.`];
}
