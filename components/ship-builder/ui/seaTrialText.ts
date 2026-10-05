import type { BreakMode, SimEvent, SimSea } from "@/lib/ship-builder/sim/types";

/** How each sea reads in the trial's status line, matching the sea buttons. */
export const SEA_LABELS: Record<SimSea, string> = {
  calm: "Calm sea",
  choppy: "Choppy sea",
  stormy: "Stormy sea",
};

/**
 * Tooltip and accessible description for controls that are disabled while a
 * trial runs or its result shows.
 */
export const TRIAL_PAUSED_TITLE = "Paused during the sea trial";

/** The break-mode switch on the aim panel, in the order it shows them. */
export const BREAK_MODE_OPTIONS: readonly {
  mode: BreakMode;
  label: string;
  help: string;
}[] = [
  {
    mode: "real",
    label: "Real",
    help: "Long ships can break in two as they sink, like the real one did.",
  },
  {
    mode: "always",
    label: "Break her",
    help: "If she sinks, she breaks in two.",
  },
  {
    mode: "never",
    label: "Hold together",
    help: "If she sinks, she goes down in one piece.",
  },
];

export const FOLLOW_HER_DOWN = "Follow her down";

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
