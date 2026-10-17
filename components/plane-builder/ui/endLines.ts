import type { EndReason } from "@/lib/plane-builder/sim/flight";

/** The headline for how a flight ended. */
export const END_LINES: Partial<Record<EndReason, string>> = {
  crash: "You crashed!",
  landed: "Nice landing!",
  stalled: "You ran out of speed.",
};

export function endLineFor(reason: EndReason): string {
  return END_LINES[reason] ?? "Flight over!";
}
