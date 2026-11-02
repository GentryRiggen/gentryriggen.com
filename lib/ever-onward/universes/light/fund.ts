import type { RunState } from "../../engine/types";
import { TUNING } from "./tuning";

/**
 * The fund: spend now, or invest. Every part of the story has a savings jar
 * (the Harbour Fund, the Reservoir, the Starlight Vault, the Quiet Jar) for
 * that part's own currency. What sits in the jar grows, a little faster the
 * less there is in it, and can come out any time, minus a small fee. So a
 * coin in the jar is a coin that is not buying an upgrade now: park what
 * you are saving up for, spend what is already enough.
 *
 * Nothing here is chance. The yield is a plain curve of the balance, the
 * jar closes (paying nothing out) when the part of the story ends, and an
 * old save simply has an empty jar.
 */

const F = TUNING.fund;

export const FUND_RESOURCE = "fund";

/** The four jars, one per part of the story. */
export interface FundKind {
  /** The resource it holds. */
  currency: string;
  name: string;
  /** What the money does while it is in. */
  verb: string;
}

export const FUNDS: readonly FundKind[] = [
  {
    currency: "coins",
    name: "Harbour Fund",
    verb: "The harbour master lends your coins to the quay, and the quay pays them back with interest.",
  },
  {
    currency: "power",
    name: "Reservoir",
    verb: "Spare power pumps water uphill. Let it back down later and it turns a little more than you put in.",
  },
  {
    currency: "energy",
    name: "Starlight Vault",
    verb: "Sunlight banked in a ring of mirrors. It picks up a little more on every lap.",
  },
  {
    currency: "resolve",
    name: "Quiet Jar",
    verb: "A jar of resolve on the shelf. Left alone, it deepens.",
  },
];

export const DEPOSIT_SHARES = [0.25, 0.5, 1] as const;
export const depositActionId = (share: number): string =>
  `fund-in-${Math.round(share * 100)}`;
export const WITHDRAW_ACTION = "fund-out";
export const FUND_ACTION_IDS: readonly string[] = [
  ...DEPOSIT_SHARES.map(depositActionId),
  WITHDRAW_ACTION,
];
/** The deposits are real choices; taking it out is a claim. */
export const FUND_CHOICE_IDS: readonly string[] =
  DEPOSIT_SHARES.map(depositActionId);

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

export const fundKind = (run: RunState): FundKind =>
  FUNDS[Math.min(FUNDS.length - 1, Math.max(0, run.phase))];

/** The jar opens at a milestone in each part, and then stays open. */
export function isFundOpen(run: RunState): boolean {
  switch (run.phase) {
    case 0:
      // The coast has one knob (the lamp) and no savings jar: the money all
      // goes into keepers and lighthouses.
      return false;
    case 1:
      return owned(run, "gen1") >= F.opensAt.nightLittleGenerators;
    case 2:
      return owned(run, "collector") >= F.opensAt.skyCollectors;
    default:
      return res(run, "lights") <= F.opensAt.lastLights;
  }
}

export const fundBalance = (run: RunState): number =>
  Math.max(0, res(run, FUND_RESOURCE));

/**
 * The size at which the jar's growth has halved: a number of seconds of the
 * part's own income, so the jar stays about as big a deal all game.
 */
export const fundScale = (income: number): number =>
  Math.max(F.minScale, F.halfSeconds * (Number.isFinite(income) ? income : 0));

/** Growth per second of a jar of this size, in the currency. */
export function fundYieldPerSecond(balance: number, income: number): number {
  if (balance <= 0) return 0;
  return (F.yieldPerSecond * balance) / (1 + balance / fundScale(income));
}

/** Growth per minute of the next `amount` put in (for the panel's hint). */
export function extraPerMinute(
  balance: number,
  amount: number,
  income: number
): number {
  return (
    60 *
    (fundYieldPerSecond(balance + amount, income) -
      fundYieldPerSecond(balance, income))
  );
}

/**
 * The fee for taking the jar out: steep for money that has only just gone
 * in, falling to a small one once it has been left alone a couple of minutes.
 * So the jar is for what you will not need soon.
 */
export function fundFee(run: RunState): number {
  const held = Math.max(0, run.time - res(run, "fundSince"));
  const ripe = Math.min(1, held / F.matureSeconds);
  return F.earlyFee + (F.lateFee - F.earlyFee) * ripe;
}

/** What comes out when the jar is emptied now. */
export const fundPayout = (run: RunState): number =>
  fundBalance(run) * (1 - fundFee(run));

export function deposit(run: RunState, amount: number): void {
  if (!(amount > 0)) return;
  // The clock restarts at the average age of what is in: older money keeps
  // most of its age, so a small top-up does not make the whole jar young.
  const balance = fundBalance(run);
  const held = Math.max(0, run.time - res(run, "fundSince"));
  const age = (held * balance) / (balance + amount);
  run.resources.fundSince = run.time - age;
  run.resources[FUND_RESOURCE] = balance + amount;
  run.resources.fundDeposits = res(run, "fundDeposits") + 1;
}

/** Empties the jar into the part's currency, minus the fee. */
export function withdrawAll(run: RunState): void {
  const balance = fundBalance(run);
  if (balance <= 0) return;
  const { currency } = fundKind(run);
  const fee = fundFee(run);
  run.resources[currency] = res(run, currency) + balance * (1 - fee);
  run.resources.fundFees = res(run, "fundFees") + balance * fee;
  run.resources[FUND_RESOURCE] = 0;
}

/** The part ends: the old jar closes, so the next part starts clean. */
export function closeFund(run: RunState): void {
  run.resources[FUND_RESOURCE] = 0;
}

/**
 * Grows the jar for `dt` seconds. `income` is the part's own income per
 * second (read lazily: only an open, filled jar needs it).
 */
export function tickFund(
  run: RunState,
  dt: number,
  income: () => number
): void {
  const balance = fundBalance(run);
  if (balance <= 0) return;
  const grown = fundYieldPerSecond(balance, income()) * dt;
  run.resources[FUND_RESOURCE] = balance + grown;
  run.resources.fundEarned = res(run, "fundEarned") + grown;
}
