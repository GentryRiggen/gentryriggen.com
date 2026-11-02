import type { ActionDef, RunState } from "../../engine/types";
import { referenceIncome } from "./income";
import { knowhowSpoilMult } from "./knowhow";
import { HELPER_LINES, owned, res } from "./lines";
import { PHASE_PLAYROOM, PHASE_SKY, PHASE_TOWN } from "./resources";
import { TUNING } from "./tuning";

/**
 * Foundations, the spend-now-or-invest choice of the first three parts. Of
 * everything the crew earns you can keep a share back as footing (none, a
 * quarter, half). The footing slowly settles away; the bigger it is next to a
 * little of the site's income, the better every later payout is and the
 * slower the tower sways. The share you keep is stuff you do not get to spend
 * on floors now. A quarter is best for a long stretch, and it pays to stop
 * keeping any when the top of the part is near, because footing left when the
 * part ends is simply left in the ground.
 *
 * State is hidden resources (`ftStep`, `ftStock`), so a save from before
 * foundations existed reads as "keep nothing, no footing".
 */

const F = TUNING.footing;

export const FOOTING_SHARES: readonly number[] = F.shares;

export const footingActionId = (step: number): string => `footing-${step}`;
export const FOOTING_ACTION_IDS: readonly string[] = FOOTING_SHARES.map(
  (_, i) => footingActionId(i)
);

/** The footing opens once the first helper line has a couple of levels. */
export const isFootingOpen = (run: RunState): boolean =>
  run.phase <= 2 && owned(run, HELPER_LINES[run.phase][0]) >= 2;

/** The step that is set (0 keeps nothing). Old saves read 0. */
export const footingStep = (run: RunState): number =>
  Math.min(
    FOOTING_SHARES.length - 1,
    Math.max(0, Math.round(res(run, "ftStep")))
  );

/** The share of income kept back right now (0 in the last part). */
export const savedShare = (run: RunState): number =>
  run.phase <= 2 ? FOOTING_SHARES[footingStep(run)] : 0;

export const footingStock = (run: RunState): number => res(run, "ftStock");

/** The gain for a footing of `stock` next to a site earning `reference` a second. */
export function gainFor(stock: number, reference: number): number {
  if (stock <= 0) return 0;
  const seconds = stock / Math.max(reference, 1e-9);
  return (F.maxGain * seconds) / (seconds + F.halfSeconds);
}

/** What the footing settles at if a share is kept steadily for a long time. */
export function settledGain(share: number, spoilMult = 1): number {
  if (share <= 0) return 0;
  const seconds = share / (F.spoilPerSecond * spoilMult);
  return (F.maxGain * seconds) / (seconds + F.halfSeconds);
}

/** How much better the footing makes every payout (a fraction). */
export const gainOf = (run: RunState): number =>
  run.phase <= 2 ? gainFor(footingStock(run), referenceIncome(run)) : 0;

/** Moves the footing for `dt` seconds: it gains the kept share and settles a little. */
export function tickFooting(run: RunState, kept: number, dt: number): void {
  if (run.phase > 2) return;
  const stock = footingStock(run);
  run.resources.ftStock = Math.max(
    0,
    stock + kept * dt - stock * F.spoilPerSecond * knowhowSpoilMult(run) * dt
  );
}

/** Puts a share of one tap's worth into the footing. */
export function addToFooting(run: RunState, amount: number): void {
  if (run.phase > 2 || amount <= 0) return;
  run.resources.ftStock = footingStock(run) + amount;
}

/** Gives a delivery's worth straight to the footing. */
export const giveFooting = addToFooting;

export function setFootingStep(run: RunState, step: number): void {
  run.resources.ftStep = Math.min(
    FOOTING_SHARES.length - 1,
    Math.max(0, Math.round(step))
  );
  run.resources.ftChanges = res(run, "ftChanges") + 1;
}

export const footingChanges = (run: RunState): number => res(run, "ftChanges");

const pct = (n: number): string => `${Math.round(n * 100)}%`;

export const FOOTING_LABELS: readonly string[] = [
  "Spend it all",
  "Keep a quarter",
  "Keep half",
];

/** What the footing is called in each part. */
export const FOOTING_NAMES: readonly string[] = [
  "Wide base blocks",
  "Foundations",
  "Anchors",
];

export const FOOTING_NOTES: readonly string[] = [
  "Every bit goes into floors now. A plain tower, and all the stuff to spend today.",
  "A quarter goes into the footing. The tower pays more and leans less, and so does every payout after.",
  "Half goes into the footing. A rock-solid tower, but a thin pile of stuff to spend for now. It settles a little, too.",
];

/** One radio button per step; the foundations panel draws them itself. */
export const FOOTING_ACTIONS: readonly ActionDef[] = FOOTING_SHARES.map(
  (share, i) => ({
    id: footingActionId(i),
    phases: [PHASE_PLAYROOM, PHASE_TOWN, PHASE_SKY],
    isInline: true,
    visibleWhen: isFootingOpen,
    describe: (run) => ({
      label: FOOTING_LABELS[i],
      detail: `${FOOTING_NOTES[i]} Settles at +${pct(settledGain(share))} pay.`,
      isBlocked: footingStep(run) === i,
    }),
    perform: (run) => setFootingStep(run, i),
  })
);
