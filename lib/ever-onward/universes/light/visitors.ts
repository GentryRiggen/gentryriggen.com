import { formatNumber } from "../../engine/format";
import type {
  CountdownView,
  RunState,
  TeaserDef,
  VisitorDef,
} from "../../engine/types";
import { PHASE_COAST, PHASE_NIGHT, PHASE_SKY, TOTAL_STARS } from "./resources";
import { tankCapacity, visitorGift } from "./tick";

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const whole = (n: number): string => formatNumber(Math.max(1, Math.floor(n)));

/** What each phase's income is paid in, by phase index (the last has none). */
const INCOME_RESOURCE = ["coins", "power", "energy"] as const;

/**
 * Every visitor's basic gift is a small slice of what the player earns *now*,
 * in the currency of the phase they are in: a visitor who waited into a later
 * part still brings something that part can use.
 */
function giveIncome(run: RunState): void {
  const id = INCOME_RESOURCE[run.phase];
  if (id) run.resources[id] += visitorGift(run);
}

const incomeText = (run: RunState): string => {
  const id = INCOME_RESOURCE[run.phase];
  return id ? `${whole(visitorGift(run))} ${id}` : "a warm thank-you";
};

/**
 * Gentle one-off arrivals. Each one comes when a milestone is reached (never
 * a timer), waits as long as it takes until the player greets it, gives a
 * small gift and is kept in the Menu's logbook. The line each one reads is
 * the story message with the same id.
 */
export const VISITORS: readonly VisitorDef[] = [
  {
    id: "visitor-mail",
    phase: PHASE_COAST,
    name: "A mail boat",
    arrivesWhen: (run) => owned(run, "keeper") >= 6,
    giftText: incomeText,
    give: giveIncome,
  },
  {
    id: "visitor-whales",
    phase: PHASE_COAST,
    name: "Whale-watchers",
    arrivesWhen: (run) => owned(run, "keeper") >= 8,
    giftText: (run) =>
      run.phase === 0 ? "a full tank of lamp oil" : incomeText(run),
    give: (run) => {
      if (run.phase === 0)
        run.resources.oil = Math.max(run.resources.oil, tankCapacity(run));
      else giveIncome(run);
    },
  },
  {
    id: "visitor-fair",
    phase: PHASE_NIGHT,
    name: "The town fair",
    arrivesWhen: (run) => owned(run, "gen3") >= 4,
    giftText: (run) =>
      run.phase === 1
        ? `${incomeText(run)} and a steady grid`
        : incomeText(run),
    give: (run) => {
      giveIncome(run);
      if (run.phase === 1) run.resources.grid = 100;
    },
  },
  {
    id: "visitor-comet",
    phase: PHASE_SKY,
    name: "A comet",
    arrivesWhen: (run) => owned(run, "collector") >= 4,
    giftText: incomeText,
    give: giveIncome,
  },
  {
    id: "visitor-signal",
    phase: PHASE_SKY,
    name: "A strange signal",
    arrivesWhen: (run) => res(run, "stars") <= 970 && owned(run, "probe") >= 1,
    giftText: (run) =>
      run.phase === 2
        ? `${incomeText(run)} and a true course for the fleet`
        : incomeText(run),
    give: (run) => {
      giveIncome(run);
      if (run.phase === 2) run.resources.heading = 100;
    },
  },
];

/** Greyed "someday" cards: a look at what is coming, and what unlocks it. */
export const TEASERS: readonly TeaserDef[] = [
  {
    upgradeId: "lighthouse",
    showWhen: (run) => owned(run, "lens") >= 4,
    hint: () => "When you have 3 keepers",
  },
  {
    upgradeId: "contract",
    showWhen: (run) => owned(run, "lighthouse") >= 1,
    hint: () => "When 5 lighthouses stand",
  },
  {
    upgradeId: "gen3",
    showWhen: (run) => owned(run, "gen2") >= 1,
    hint: () => "When 4 steam plants hum",
  },
  {
    upgradeId: "gen4",
    showWhen: (run) => owned(run, "gen3") >= 1,
    hint: () => "When 3 river dams turn",
  },
  {
    upgradeId: "probe",
    showWhen: (run) => owned(run, "collector") >= 2,
    hint: () => "When 5 collectors catch the sun",
  },
  {
    upgradeId: "relay-1",
    showWhen: (run) => owned(run, "collector") >= 6,
    hint: () => "After the biggest mirror is built",
  },
  {
    upgradeId: "relay-2",
    showWhen: (run) => owned(run, "relay-1") >= 1,
    hint: () => "When 700 stars are left",
  },
  {
    upgradeId: "relay-3",
    showWhen: (run) => owned(run, "relay-2") >= 1,
    hint: () => "When 350 stars are left",
  },
  {
    // A look at the next part, so the end of the sky is not an empty shop.
    upgradeId: "letgo-porch",
    phase: PHASE_SKY,
    name: "Something quiet",
    showWhen: (run) => res(run, "stars") <= 300,
    hint: () => "After the last star",
  },
];

/** Where the star-countdown ticks sit: a relay ring unlocks at each. */
export const STAR_MARKS = [700, 350] as const;

/** The sky's countdown: stars left, with a tick where something wakes up. */
export function lightCountdown(run: RunState): CountdownView | null {
  if (run.phase !== 2) return null;
  const stars = Math.ceil(res(run, "stars"));
  const next = STAR_MARKS.find((mark) => stars > mark);
  return {
    label: "Stars left",
    value: stars,
    max: TOTAL_STARS,
    marks: STAR_MARKS,
    detail:
      next !== undefined
        ? `More relays wake at ${next} stars`
        : "Every star is one step closer to the last light",
  };
}
