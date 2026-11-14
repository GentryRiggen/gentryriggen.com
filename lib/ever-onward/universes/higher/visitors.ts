import type {
  CountdownView,
  RunState,
  TeaserDef,
  VisitorDef,
} from "../../engine/types";
import { formatNumber } from "../../engine/format";
import {
  FULL_DESCENT,
  PHASE_PLAYROOM,
  PHASE_SKY,
  PHASE_TOP,
  PHASE_TOWN,
  RETURN_VISITOR_ID,
} from "./resources";
import { descentShare } from "./descent";
import { owned } from "./lines";
import { incomePerSecond } from "./tick";

export { RETURN_VISITOR_ID };

/** A small thank-you: twelve seconds of the site's work, never under 25. */
const gift = (run: RunState): number =>
  Math.max(25, Math.floor(incomePerSecond(run) * 12));

const KEYS = ["blocks", "bricks", "beams"] as const;

const giveStuff = (run: RunState): void => {
  const key = KEYS[run.phase];
  if (key) run.resources[key] = (run.resources[key] ?? 0) + gift(run);
};

const giftText = (run: RunState): string =>
  run.phase <= 2
    ? `${formatNumber(gift(run))} ${KEYS[run.phase]}`
    : "a warm thank-you";

/** The arrivals: friends on the rug, in the street and in the clouds. */
export const VISITORS: readonly VisitorDef[] = [
  {
    id: "visitor-cat",
    phase: PHASE_PLAYROOM,
    name: "A cat who sits on the rug",
    arrivesWhen: (run) => owned(run, "bear") >= 4,
    giftText,
    give: giveStuff,
  },
  {
    id: "visitor-dad",
    phase: PHASE_PLAYROOM,
    name: "Dad, with a camera",
    arrivesWhen: (run) => owned(run, "toy-crane") >= 1,
    giftText,
    give: giveStuff,
  },
  {
    id: "visitor-mayor",
    phase: PHASE_TOWN,
    name: "The mayor with the big scissors",
    arrivesWhen: (run) => owned(run, "concrete-truck") >= 1,
    giftText,
    give: giveStuff,
  },
  {
    id: "visitor-pigeons",
    phase: PHASE_TOWN,
    name: "Pigeons on the scaffold",
    arrivesWhen: (run) => owned(run, "crane") >= 4,
    giftText,
    give: giveStuff,
  },
  {
    id: "visitor-geese",
    phase: PHASE_SKY,
    name: "Geese, flying around",
    arrivesWhen: (run) => owned(run, "cloud-crane") >= 2,
    giftText,
    give: giveStuff,
  },
  {
    id: "visitor-cloudwasher",
    phase: PHASE_SKY,
    name: "A window cleaner, very far from home",
    arrivesWhen: (run) => owned(run, "cable-spinner") >= 2,
    giftText,
    give: giveStuff,
  },
  {
    id: RETURN_VISITOR_ID,
    phase: PHASE_TOP,
    name: "A kid on the grass, with a block",
    arrivesWhen: (run) => owned(run, "set-down") >= 1,
    giftText: () => "a warm thank-you",
    give: () => {},
  },
];

/** Greyed "someday" cards for the purchase that ends each phase. */
export const TEASERS: readonly TeaserDef[] = [
  {
    upgradeId: "treehouse",
    showWhen: (run) => owned(run, "toy-crane") >= 1,
    hint: () => "When the fairy lights are strung",
  },
  {
    upgradeId: "skyscraper",
    showWhen: (run) => owned(run, "concrete-truck") >= 1,
    hint: () => "When the neon sign lights up",
  },
  {
    upgradeId: "space-elevator",
    showWhen: (run) => owned(run, "cable-spinner") >= 1,
    hint: () => "When the red beacon blinks",
  },
  {
    upgradeId: "rest-bench",
    showWhen: (run) => owned(run, "stair-lamp") >= 2,
    hint: () => "When four lamps light the stair",
  },
  {
    upgradeId: "set-down",
    showWhen: (run) => descentShare(run) >= 0.4,
    hint: () => "When the grass is in sight",
  },
  {
    upgradeId: "block-lantern",
    showWhen: (run) => owned(run, "songbird") >= 1,
    hint: () => "When the songbirds sing along",
  },
];

/** The top's countdown: how far there is still to go down. */
export function higherCountdown(run: RunState): CountdownView | null {
  if (run.phase !== 3) return null;
  const left = Math.ceil(FULL_DESCENT - (run.resources.descent ?? 0));
  return {
    label: "Left to go down",
    resourceId: "descent",
    value: left,
    max: FULL_DESCENT,
    detail: "Carry the last block to the ground",
  };
}
