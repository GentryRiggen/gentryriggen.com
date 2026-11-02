import type { ActionDef, RunState } from "../../engine/types";
import { forkBondMult } from "./forks";
import { PHASE_FRIEND } from "./resources";
import { TUNING } from "./tuning";

/**
 * The friendship bank: the first part's spend-now-or-invest choice. Of every
 * smile you earn you can set a share aside as time spent together (none, a
 * quarter or half). Time together slowly fades, but the more of it there is
 * next to a bit of income, the bigger every later laugh grows. The share you
 * set aside is a laugh you do not get to spend now: set nothing aside and you
 * keep every smile and a plain friendship; set half aside and the laughs are
 * thin while the friendship fills. A quarter is best for a long stretch, and
 * it pays to stop setting any aside when the next door is near, because time
 * together banked when the part ends is simply left behind.
 *
 * State is two hidden resources (`bdStep`, `bdStock`), so a save from before
 * reads as "set nothing aside, nothing banked".
 */

const B = TUNING.bond;

export const BOND_SHARES: readonly number[] = B.shares;

export const bondActionId = (step: number): string => `bond-${step}`;
export const BOND_ACTION_IDS: readonly string[] = BOND_SHARES.map((_, i) =>
  bondActionId(i)
);

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** The bank opens once the friend wears a bracelet. */
export const isBondOpen = (run: RunState): boolean =>
  run.phase === 0 && owned(run, "bracelet") >= 1;

/** The step that is set (0 sets nothing aside). Old saves read 0. */
export const bondStep = (run: RunState): number =>
  Math.min(BOND_SHARES.length - 1, Math.max(0, Math.round(res(run, "bdStep"))));

/** The share of income set aside right now (0 outside the first part). */
export const savedShare = (run: RunState): number =>
  run.phase === 0 ? BOND_SHARES[bondStep(run)] : 0;

/** Time together in the bank, in smiles. */
export const bondStock = (run: RunState): number => res(run, "bdStock");

/**
 * How much bigger the bank makes every laugh, for a bank of `stock` next to a
 * friend who gives `reference` smiles a second.
 */
export function bondGainFor(stock: number, reference: number): number {
  if (stock <= 0) return 0;
  const seconds = stock / Math.max(reference, 1e-9);
  return (B.maxGain * seconds) / (seconds + B.halfSeconds);
}

/** What the bank settles at if a share is kept for a long time. */
export function settledGain(share: number): number {
  if (share <= 0) return 0;
  const seconds = share / B.fadePerSecond;
  return (B.maxGain * seconds) / (seconds + B.halfSeconds);
}

/** Moves the bank for `dt` seconds: it gains the set-aside share and fades. */
export function tickBond(run: RunState, kept: number, dt: number): void {
  if (run.phase !== 0) return;
  const stock = bondStock(run);
  run.resources.bdStock = Math.max(
    0,
    stock + kept * dt - stock * B.fadePerSecond * dt
  );
}

/** Puts a share of one tap's worth into the bank. */
export function bondKept(run: RunState, kept: number): void {
  if (run.phase !== 0 || kept <= 0) return;
  run.resources.bdStock = bondStock(run) + kept;
}

export function setBondStep(run: RunState, step: number): void {
  run.resources.bdStep = Math.min(
    BOND_SHARES.length - 1,
    Math.max(0, Math.round(step))
  );
  run.resources.bdChanges = res(run, "bdChanges") + 1;
}

export const bondChanges = (run: RunState): number => res(run, "bdChanges");

const pct = (n: number): string => `${Math.round(n * 100)}%`;

export const BOND_LABELS: readonly string[] = [
  "Laugh now",
  "Spend a quarter together",
  "Spend half together",
];

export const BOND_NOTES: readonly string[] = [
  "Every smile goes to the laughing. A plain friendship, and all the smiles now.",
  "A quarter of every smile goes to time together. Every laugh after is bigger.",
  "Half goes to time together. A thin laugh for now, but a fast-growing friendship. It fades a little, too.",
];

/** One radio button per step; the bond panel draws them itself. */
export const BOND_ACTIONS: readonly ActionDef[] = BOND_SHARES.map(
  (share, i) => ({
    id: bondActionId(i),
    phases: [PHASE_FRIEND],
    isInline: true,
    visibleWhen: isBondOpen,
    describe: (run) => ({
      label: BOND_LABELS[i],
      detail: `${BOND_NOTES[i]} Settles at +${pct(settledGain(share) * forkBondMult(run))}.`,
      isBlocked: bondStep(run) === i,
    }),
    perform: (run) => setBondStep(run, i),
  })
);
