import type {
  CountdownView,
  RunState,
  TeaserDef,
  VisitorDef,
} from "../../engine/types";
import { formatNumber } from "../../engine/format";
import { FULL_GROWTH, PHASE_SEED, PHASE_YARD } from "./resources";
import { incomePerSecond } from "./tick";

export const RETURN_VISITOR_ID = "seed-return";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** A small thank-you: twelve seconds of the garden's work, never under 25. */
const gift = (run: RunState): number =>
  Math.max(25, Math.floor(incomePerSecond(run) * 12));

const giftSeeds = (run: RunState): void => {
  if (run.phase === 0) run.resources.seeds += gift(run);
};

const giftSeedsText = (run: RunState): string =>
  run.phase === 0 ? `${formatNumber(gift(run))} seeds` : "a warm thank-you";

/** The arrivals of the skeleton: the pot is grown, and someone comes back. */
export const VISITORS: readonly VisitorDef[] = [
  {
    id: "visitor-ladybirds",
    phase: PHASE_YARD,
    name: "A parade of ladybirds",
    arrivesWhen: (run) => owned(run, "bee-hive") >= 4,
    giftText: giftSeedsText,
    give: giftSeeds,
  },
  {
    id: "visitor-neighbor",
    phase: PHASE_YARD,
    name: "The neighbor with the ladder",
    arrivesWhen: (run) => owned(run, "orchard") >= 1,
    giftText: giftSeedsText,
    give: giftSeeds,
  },
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
    showWhen: (run) => owned(run, "glasshouse") >= 1,
    hint: () => "When the first seed drone hums",
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
