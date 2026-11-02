import type { ActionDef, RunState } from "../../engine/types";
import { bankSpoilMult } from "./knowhow";
import { PHASE_FARM } from "./resources";
import { TUNING } from "./tuning";

/**
 * The Seed Bank: the farm's spend-now-or-invest choice. Of everything the
 * farm earns you can keep a share back as seed (none, a quarter or half).
 * Kept seed goes in the bank and slowly spoils; the more of it there is
 * compared with a bit of farm income, the better every later harvest grows,
 * but the share you keep is harvest you do not get to spend now. Keep
 * nothing and you have all your harvest and a plain field; keep half and
 * the harvest is thin while the bank fills. A quarter is best for a long
 * stretch, and it pays to stop keeping any when the barn is near, because
 * seed in the bank when the farm ends is simply left behind.
 *
 * State is two hidden resources (`sbStep`, `sbStock`), so a save from before
 * the bank existed reads as "keep nothing, empty bank": exactly the old farm.
 */

const B = TUNING.farm.bank;

/** The shares of income that can be kept back, by step. */
export const BANK_SHARES: readonly number[] = B.shares;

export const bankActionId = (step: number): string => `seedbank-${step}`;
export const BANK_ACTION_IDS: readonly string[] = BANK_SHARES.map((_, i) =>
  bankActionId(i)
);

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** The bank opens once the farm has a couple of scarecrows. */
export const isBankOpen = (run: RunState): boolean =>
  run.phase === 1 && owned(run, "scarecrow") >= B.opensAtScarecrows;

/** The step that is set (0 keeps nothing). Old saves read 0. */
export const bankStep = (run: RunState): number =>
  Math.min(BANK_SHARES.length - 1, Math.max(0, Math.round(res(run, "sbStep"))));

/** The share of income kept back right now (0 outside the farm). */
export const savedShare = (run: RunState): number =>
  run.phase === 1 ? BANK_SHARES[bankStep(run)] : 0;

/** The seed in the bank, in harvest. */
export const bankStock = (run: RunState): number => res(run, "sbStock");

/**
 * How much better the bank makes every harvest, for a bank of `stock` next
 * to a farm that earns `reference` a second: seconds of income in the bank
 * pull toward the most it can give.
 */
export function bankGainFor(stock: number, reference: number): number {
  if (stock <= 0) return 0;
  const seconds = stock / Math.max(reference, 1e-9);
  return (B.maxGain * seconds) / (seconds + B.halfSeconds);
}

/** What the bank settles at if a share is kept for a long time at a steady pace. */
export function settledGain(share: number, spoilMult = 1): number {
  if (share <= 0) return 0;
  const seconds = share / (B.spoilPerSecond * spoilMult);
  return (B.maxGain * seconds) / (seconds + B.halfSeconds);
}

/** Moves the bank for `dt` seconds: it gains the kept share and spoils a little. */
export function tickBank(run: RunState, kept: number, dt: number): void {
  if (run.phase !== 1) return;
  const stock = bankStock(run);
  run.resources.sbStock = Math.max(
    0,
    stock + kept * dt - stock * B.spoilPerSecond * bankSpoilMult(run) * dt
  );
}

/** Puts a share of one tap's worth into the bank. */
export function bankKept(run: RunState, kept: number): void {
  if (run.phase !== 1 || kept <= 0) return;
  run.resources.sbStock = bankStock(run) + kept;
}

export function setBankStep(run: RunState, step: number): void {
  run.resources.sbStep = Math.min(
    BANK_SHARES.length - 1,
    Math.max(0, Math.round(step))
  );
  run.resources.sbChanges = res(run, "sbChanges") + 1;
}

/** Times the share has been changed (for the tally and the result line). */
export const bankChanges = (run: RunState): number => res(run, "sbChanges");

const pct = (n: number): string => `${Math.round(n * 100)}%`;

export const BANK_LABELS: readonly string[] = [
  "Sell it all",
  "Keep a quarter",
  "Keep half",
];

export const BANK_NOTES: readonly string[] = [
  "Every sack goes to market. A plain field, and all the harvest now.",
  "A quarter goes in the bank as seed. The field grows richer, and so does every harvest after.",
  "Half goes in the bank. A rich field, but a thin harvest for now. It spoils a little, too.",
];

/** One radio button per step; the seed bank panel draws them itself. */
export const BANK_ACTIONS: readonly ActionDef[] = BANK_SHARES.map(
  (share, i) => ({
    id: bankActionId(i),
    phases: [PHASE_FARM],
    isInline: true,
    visibleWhen: isBankOpen,
    describe: (run) => ({
      label: BANK_LABELS[i],
      detail: `${BANK_NOTES[i]} Settles at +${pct(settledGain(share))} yield.`,
      isBlocked: bankStep(run) === i,
    }),
    perform: (run) => setBankStep(run, i),
  })
);
