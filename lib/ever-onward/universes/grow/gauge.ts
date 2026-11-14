import type { GaugeView, RunState } from "../../engine/types";
import { isDry, waterCapacity } from "./water";

/** The water tank, kept on the HUD so a dry spell never sneaks up. */
export function growGauge(run: RunState): GaugeView | null {
  if (run.complete || run.phase > 2) return null;
  const max = Math.max(1, waterCapacity(run));
  const current = Math.min(max, Math.max(0, run.resources.tank ?? 0));
  const dry = isDry(run);
  return {
    label: "WATER",
    current,
    max,
    isLow: dry || current / max <= 0.35,
    isCritical: dry || current / max <= 0.12,
    status: dry ? "DRY" : current / max <= 0.35 ? "LOW" : "",
  };
}
