import type {
  CountdownView,
  RunState,
  TeaserDef,
  VisitorDef,
} from "../../engine/types";
import { FULL_GROWTH, PHASE_SEED } from "./resources";

export const RETURN_VISITOR_ID = "seed-return";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** The one arrival of the skeleton: the pot is grown, and someone comes back. */
export const VISITORS: readonly VisitorDef[] = [
  {
    id: RETURN_VISITOR_ID,
    phase: PHASE_SEED,
    name: "Someone who came back",
    arrivesWhen: (run) => run.resources.growth >= FULL_GROWTH,
    giftText: () => "a warm thank-you",
    give: () => {},
  },
];

/** Greyed "someday" cards for the purchase that ends each phase. */
export const TEASERS: readonly TeaserDef[] = [
  {
    upgradeId: "cold-frame",
    showWhen: (run) => owned(run, "gardener") >= 1,
    hint: () => "When the orchard is planted",
  },
  {
    upgradeId: "grain-barn",
    showWhen: (run) => owned(run, "scarecrow") >= 1,
    hint: () => "When 3 scarecrows stand guard",
  },
  {
    upgradeId: "seed-vault",
    showWhen: (run) => owned(run, "windbreak") >= 1,
    hint: () => "When 3 windbreaks stand",
  },
];

/** The seed phase's countdown: how much of the pot is still to grow. */
export function growCountdown(run: RunState): CountdownView | null {
  if (run.phase !== 3) return null;
  const left = Math.ceil(FULL_GROWTH - run.resources.growth);
  return {
    label: "Left to grow",
    value: left,
    max: FULL_GROWTH,
    detail: "Keep tending the one small pot",
  };
}
