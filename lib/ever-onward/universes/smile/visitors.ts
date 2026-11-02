import { formatNumber } from "../../engine/format";
import type {
  CountdownView,
  RunState,
  TeaserDef,
  VisitorDef,
} from "../../engine/types";
import { isRealSmile } from "./quiet";
import {
  FULL_TRUST,
  PHASE_FRIEND,
  PHASE_QUIET,
  PHASE_TOWN,
  PHASE_WORLD,
  MANUAL_RESOURCES,
} from "./resources";
import { incomePerSecond } from "./tick";

export const RETURN_VISITOR_ID = "real-smile";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** A small thank-you: twelve seconds of the part's work, never under `floor`. */
const gift = (run: RunState, floor: number): number =>
  Math.max(floor, Math.floor(incomePerSecond(run) * 12));

const FLOORS = [25, 60, 200, 0] as const;

const giveGift = (run: RunState): void => {
  if (run.phase > 2) return;
  run.resources[MANUAL_RESOURCES[run.phase]] += gift(run, FLOORS[run.phase]);
};

const giftText = (run: RunState): string =>
  run.phase > 2
    ? "a warm thank-you"
    : `${formatNumber(gift(run, FLOORS[run.phase]))} ${MANUAL_RESOURCES[run.phase]}`;

/** The arrivals: friendly faces, and at the very end, the smile. */
export const VISITORS: readonly VisitorDef[] = [
  {
    id: "visitor-bird",
    phase: PHASE_FRIEND,
    name: "A little bird with a tune",
    arrivesWhen: (run) => owned(run, "balloon") >= 4,
    giftText,
    give: giveGift,
  },
  {
    id: "visitor-grandma",
    phase: PHASE_FRIEND,
    name: "A grandma with cookies",
    arrivesWhen: (run) => owned(run, "lemonade") >= 1,
    giftText,
    give: giveGift,
  },
  {
    id: "visitor-mayor",
    phase: PHASE_TOWN,
    name: "The mayor with a very big ribbon",
    arrivesWhen: (run) => owned(run, "band") >= 3,
    giftText,
    give: giveGift,
  },
  {
    id: "visitor-baker",
    phase: PHASE_TOWN,
    name: "The baker with a smile-shaped cake",
    arrivesWhen: (run) => owned(run, "smile-factory") >= 2,
    giftText,
    give: giveGift,
  },
  {
    id: "visitor-reporter",
    phase: PHASE_WORLD,
    name: "A reporter with a camera",
    arrivesWhen: (run) => owned(run, "cheer-tower") >= 1,
    giftText,
    give: giveGift,
  },
  {
    id: "visitor-announcer",
    phase: PHASE_WORLD,
    name: "The radio announcer",
    arrivesWhen: (run) => owned(run, "loudspeaker") >= 3,
    giftText,
    give: giveGift,
  },
  {
    id: RETURN_VISITOR_ID,
    phase: PHASE_QUIET,
    name: "One small, real smile",
    arrivesWhen: (run) => isRealSmile(run),
    giftText: () => "a warm thank-you",
    give: () => {},
  },
];

/** Greyed "someday" cards for the purchase that ends each phase. */
export const TEASERS: readonly TeaserDef[] = [
  {
    upgradeId: "next-door",
    showWhen: (run) => owned(run, "puppy") >= 1,
    hint: () => "When the lemonade stand is open",
  },
  {
    upgradeId: "key-to-town",
    showWhen: (run) => owned(run, "band") >= 1,
    hint: () => "When two smile factories hum",
  },
  {
    upgradeId: "cheer-satellite",
    showWhen: (run) => owned(run, "loudspeaker") >= 1,
    hint: () => "When two cheer towers stand and the sign is up",
  },
];

/** The quiet's countdown: how much trust is still to build. */
export function smileCountdown(run: RunState): CountdownView | null {
  if (run.phase !== 3) return null;
  const left = Math.ceil(FULL_TRUST - run.resources.trust);
  return {
    label: "Left to trust",
    resourceId: "trust",
    value: left,
    max: FULL_TRUST,
    detail: "Keep sitting with your friend",
  };
}
