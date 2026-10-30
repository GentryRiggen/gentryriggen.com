import { isTemplateId } from "@/lib/analytics/gameEvents";
import { trackGame } from "@/lib/analytics/trackGame";
import type { PartCategory } from "./model/types";
import type { SimSea, SimState } from "./sim/types";

/** Records how a sea trial ended (anonymous; see lib/analytics/gameEvents.ts). */
export function trackTrialRun(
  state: SimState,
  sea: SimSea,
  isIceberg: boolean
): void {
  trackGame("trial_run", {
    kind: isIceberg ? "iceberg" : "weather",
    outcome: state.outcome ?? "steady",
    sea,
  });
}

export function trackPartPlaced(category: PartCategory): void {
  trackGame("part_placed", { category });
}

/** Records a built-in template being used; any other id is not tracked. */
export function trackTemplateUsed(id: string): void {
  if (isTemplateId(id)) trackGame("template_used", { template: id });
}
