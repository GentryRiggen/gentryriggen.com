import { cloneRun } from "../../engine/engine";
import type { ActionDef, RunState } from "../../engine/types";
import { PHASE_COAST, PHASE_LAST, PHASE_NIGHT, PHASE_SKY } from "./resources";
import { hasFork, markFork, type ForkId, type ForkSideId } from "./forkState";
import { previewLines, type Stat } from "./preview";
import {
  autoCoinsPerSecond,
  calmSkyIncomePerSecond,
  calmTapCoins,
  driftPerSecond,
  lastTapResolve,
  lighthouseCount,
  lightsLetGo,
  powerPerSecond,
  resolvePerSecond,
  steadyFlame,
  strainPerSecond,
  syncDisplay,
} from "./tick";
import { TUNING } from "./tuning";

/**
 * The forks in the road: one in every part of the story, and each is a
 * choice between two things that can't both be had. Choosing a side pays its
 * price, locks the other for this run, changes the numbers a lot and changes
 * the picture. Both sides are good; they are good at different things. A
 * save from before the forks simply has no side chosen.
 */

const K = TUNING.fork;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const pct = (n: number): string => `${Math.round(n * 100)}%`;
/** "2.5×" / "3×". */
const times = (n: number): string => `${Number(n.toFixed(2))}×`;
const more = (n: number): string => pct(n - 1);
const less = (n: number): string => pct(1 - n);

export interface ForkSide {
  id: ForkSideId;
  name: string;
  /** What it is, in a few plain words. */
  tagline: string;
  /** A dry, kind line. */
  wry: string;
  /** What it gives, in plain words. */
  gives: string;
  /** What it costs besides the price. */
  catches: string;
  price: number;
}

export interface ForkDef {
  id: ForkId;
  phase: number;
  title: string;
  question: string;
  /** The resource both sides cost. */
  currency: string;
  /** Offered the first time this is true (then it stays). Must only read. */
  isOpen(run: RunState): boolean;
  sides: readonly [ForkSide, ForkSide];
  /** The numbers the cards compare, before and after. */
  stats: readonly Stat[];
}

const COINS: Stat = { label: "Coins/sec", read: autoCoinsPerSecond };
const COINS_PER_FLASH: Stat = { label: "Coins per flash", read: calmTapCoins };

export const FORKS: readonly ForkDef[] = [
  {
    id: "coast",
    phase: 0,
    title: "Two ways to be seen",
    question: "How should the lighthouse reach further?",
    currency: "coins",
    isOpen: (run) => lighthouseCount(run) >= 4,
    stats: [COINS, COINS_PER_FLASH],
    sides: [
      {
        id: "fresnel",
        name: "Fresnel lens",
        tagline: "A farther beam",
        wry: "Ships you never knew existed will now be rescued. They have opinions about the harbor fees.",
        gives: `Every flash guides ${times(K.coast.fresnelFlash)} the ships, yours and the keepers'.`,
        catches: "The keepers flash no faster than before.",
        price: K.costs.fresnel,
      },
      {
        id: "crews",
        name: "More keepers",
        tagline: "Faster tending",
        wry: "Three more people who know exactly where the good tea is kept.",
        gives: `Keepers flash ${times(K.coast.crewsFlash)} as often.`,
        catches: `They burn ${more(K.coast.crewsOil)} more oil, and your own taps get no help.`,
        price: K.costs.crews,
      },
    ],
  },
  {
    id: "night",
    phase: 1,
    title: "What should the plants burn?",
    question: "Coal or wind: which does the grid get?",
    currency: "power",
    isOpen: (run) => owned(run, "gen2") >= 2,
    stats: [
      { label: "Power/sec", read: powerPerSecond },
      {
        label: "Strain",
        read: (run) => strainPerSecond(run) * 60,
        suffix: "% a minute",
      },
    ],
    sides: [
      {
        id: "coal",
        name: "Coal",
        tagline: "Cheap now, smoky later",
        wry: "Quick, cheap, and the sky will remember this.",
        gives: `Every plant makes ${times(K.night.coalSupply)} at once.`,
        catches: `Smog over the cities, and the grid strains ${more(K.night.coalStrain)} faster.`,
        price: K.costs.coal,
      },
      {
        id: "wind",
        name: "Wind",
        tagline: "Slow to build, clean",
        wry: "Takes a season to raise. The sky doesn't mind waiting.",
        gives: `Over ${Math.round((K.night.windRampSeconds / 60) * 10) / 10} minutes the farms grow in, and every plant makes ${times(K.night.windSupply)}. The grid strains ${less(K.night.windStrain)} less.`,
        catches: `Costs ${times(K.costs.wind / K.costs.coal)} what coal does, and nothing happens at first.`,
        price: K.costs.wind,
      },
    ],
  },
  {
    id: "sky",
    phase: 2,
    title: "Where should the sun go?",
    question: "More probes, or bigger mirrors?",
    currency: "energy",
    isOpen: (run) => owned(run, "probe") >= 1,
    stats: [
      { label: "Energy/sec", read: calmSkyIncomePerSecond },
      {
        label: "Drift",
        read: (run) => driftPerSecond(run) * 60,
        suffix: "% a minute",
      },
    ],
    sides: [
      {
        id: "swarm",
        name: "More probes",
        tagline: "A swarm",
        wry: "Fine. Now there are more of them to lose.",
        gives: `The fleet grows ${times(K.sky.swarmProbes)} at once.`,
        catches: `The fleet drifts off course ${more(K.sky.swarmDrift)} faster.`,
        price: K.costs.swarm,
      },
      {
        id: "mirrors",
        name: "Bigger mirrors",
        tagline: "One very large idea",
        wry: "Very large, very patient, and not going anywhere.",
        gives: `Every collector catches ${times(K.sky.mirrorsEnergy)}, and the fleet drifts ${less(K.sky.mirrorsDrift)} less.`,
        catches: "No new probes come of it.",
        price: K.costs.mirrors,
      },
    ],
  },
  {
    id: "last",
    phase: 3,
    title: "Hold on, or let go?",
    question: "What do you do with the one light that is left to choose?",
    currency: "resolve",
    isOpen: (run) => lightsLetGo(run) >= 4,
    stats: [
      { label: "Resolve/sec", read: resolvePerSecond },
      { label: "Resolve per tap", read: lastTapResolve },
      {
        label: "Flame holds at",
        read: (run) => (steadyFlame(run) / TUNING.last.flameFull) * 100,
        suffix: "%",
      },
    ],
    sides: [
      {
        id: "release",
        name: "Let it go",
        tagline: "Open your hands",
        wry: "Holding on was the heavy part.",
        gives: `Resolve comes ${times(K.last.releaseResolve)} as fast.`,
        catches: `The flame fades ${more(K.last.releaseFade)} faster. It gets cold.`,
        price: K.costs.release,
      },
      {
        id: "keep",
        name: "Keep it",
        tagline: "Hold the flame",
        wry: "Somebody might still be out there.",
        gives: `The flame fades ${less(K.last.keepFade)} slower, and every tap is worth ${times(K.last.keepTaps)} resolve.`,
        catches: "Letting go is no faster than before.",
        price: K.costs.keep,
      },
    ],
  },
];

export const forkOf = (run: RunState): ForkDef | undefined =>
  FORKS.find((f) => f.phase === run.phase);

export const forkById = (id: ForkId): ForkDef =>
  FORKS.find((f) => f.id === id) as ForkDef;

/** The side chosen in this fork, or null. */
export function chosenSide(run: RunState, fork: ForkDef): ForkSide | null {
  return fork.sides.find((s) => hasFork(run, s.id)) ?? null;
}

/** True while the fork is on offer in this part (or already decided). */
export function isForkShown(run: RunState): boolean {
  const fork = forkOf(run);
  return !!fork && (chosenSide(run, fork) !== null || fork.isOpen(run));
}

/** Applies a side to a draft (the price is paid by the action, not here). */
export function chooseSide(run: RunState, side: ForkSideId): void {
  markFork(run, side);
  if (side === "swarm")
    run.resources.probes =
      Math.max(1, run.resources.probes) * K.sky.swarmProbes;
  syncDisplay(run);
}

/** The cards' numbers: the run as it would be with this side chosen. */
export function forkPreview(
  run: RunState,
  fork: ForkDef,
  side: ForkSideId
): string {
  const after = cloneRun(run);
  chooseSide(after, side);
  return previewLines(run, after, fork.stats);
}

export const forkActionId = (side: ForkSideId): string => `fork-${side}`;
export const FORK_ACTION_IDS: readonly string[] = FORKS.flatMap((f) =>
  f.sides.map((s) => forkActionId(s.id))
);

const PHASE_IDS = [PHASE_COAST, PHASE_NIGHT, PHASE_SKY, PHASE_LAST];

/** One button a side; the fork panel draws them itself. */
export const FORK_ACTIONS: readonly ActionDef[] = FORKS.flatMap((fork) =>
  fork.sides.map((side, index) => ({
    id: forkActionId(side.id),
    phases: [PHASE_IDS[fork.phase]],
    isInline: true,
    visibleWhen: (run: RunState) =>
      fork.isOpen(run) || chosenSide(run, fork) !== null,
    describe: (run: RunState) => {
      const chosen = chosenSide(run, fork);
      const rival = fork.sides[1 - index];
      return {
        label: side.name,
        detail:
          chosen === null
            ? side.gives
            : chosen.id === side.id
              ? "Yours."
              : `Closed: you chose ${chosen.name.toLowerCase()} instead of ${rival.name.toLowerCase()}.`,
        cost: { resource: fork.currency, amount: side.price },
        isBlocked: chosen !== null,
      };
    },
    perform: (run: RunState) => chooseSide(run, side.id),
  }))
);
