import type { ActionDef, RunState } from "../../engine/types";
import { PHASE_SKY } from "./resources";
import { tier } from "./tick";
import { TUNING } from "./tuning";

/**
 * The probe design: a handful of design points split across what a probe can
 * be good at. Speed gets stars sooner. Mirrors gather more light from every
 * collector and every star. Copying grows the fleet faster, but copy too hard
 * and some of the copies go wild (see `wildRate`). Shields keep a flare from
 * burning the fleet.
 *
 * Taking a point away from one thing is at once; the point then takes a
 * while to settle in its new place (it is on its way, doing nothing), so a
 * change of mind is a commitment. The split that suits the fleet moves with
 * how many probes there are, how many stars are left, how close the fleet
 * flies to the sun and how many wild probes are about.
 *
 * Bringing wild probes home pulls design points off copying for a while.
 * Nothing here is chance. All state is hidden numbers in `run.resources`, so
 * a save without them simply reads as the starting split.
 */

const D = TUNING.dials;

export const SKY_DIALS_FLAG = "sky-dials";
/** The purchase that opens the dials: the first probe. */
export const SKY_DIALS_UPGRADE = "probe";
export const FOUNDRY_ID = "nav-2";
export const CHARTS_ID = "nav-1";

export const STAT_COUNT = 4;
export const SPEED = 0;
export const MIRRORS = 1;
export const COPYING = 2;
export const SHIELDS = 3;

export interface StatDef {
  id: "speed" | "mirrors" | "copying" | "shields";
  name: string;
  /** What a point here gives, and what it costs, in plain words (never which is best). */
  plus: string;
  minus: string;
}

export const STATS: readonly StatDef[] = [
  {
    id: "speed",
    name: "Speed",
    plus: "Probes reach the stars sooner",
    minus: "Gathers no light, stops no flare",
  },
  {
    id: "mirrors",
    name: "Mirrors",
    plus: "More light from every collector and star",
    minus: "Does nothing for the fleet itself",
  },
  {
    id: "copying",
    name: "Copying",
    plus: "The fleet makes copies faster",
    minus: "Copy too hard and some go wild",
  },
  {
    id: "shields",
    name: "Shields",
    plus: "A flare burns less of the fleet",
    minus: "On a quiet day it does nothing",
  },
];

export const upActionId = (stat: number): string => `sk-up-${STATS[stat].id}`;
export const downActionId = (stat: number): string =>
  `sk-down-${STATS[stat].id}`;
export const RECALL_ACTION = "sk-recall";

export const DESIGN_ACTION_IDS: readonly string[] = STATS.flatMap((_, i) => [
  upActionId(i),
  downActionId(i),
]);

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const target = (stat: number): string => `skT${stat}`;
const work = (stat: number): string => `skE${stat}`;

export const isDialsOpen = (run: RunState): boolean =>
  run.phase === 2 && run.flags[SKY_DIALS_FLAG] === true;

/** Points aimed at a stat (the split you set). */
export const targetOf = (run: RunState, stat: number): number =>
  Math.round(res(run, target(stat)));

/** Points not given to anything (a design with spare points is wasting them). */
export const spareOf = (run: RunState): number =>
  Math.max(
    0,
    D.points -
      STATS.reduce((sum, _, stat) => sum + Math.round(targetOf(run, stat)), 0)
  );

/** Points that left a stat and have not landed yet. */
export const onTheirWay = (run: RunState): number => res(run, "skPool");

/** True while any point is still on its way (or about to leave). */
export const isSettling = (run: RunState): boolean =>
  res(run, "skPool") > 0.05 ||
  STATS.some(
    (_, stat) => Math.abs(res(run, work(stat)) - res(run, target(stat))) > 0.05
  );

export const isRecalling = (run: RunState): boolean => res(run, "skRecall") > 0;
export const recallLeft = (run: RunState): number =>
  Math.max(0, res(run, "skRecall"));

/**
 * Points working in a stat right now: what has landed, less what the tether
 * pulls off while wild probes are being brought home (copying first, then
 * speed, then mirrors; shields are never taken).
 */
export function pointsAt(run: RunState, stat: number): number {
  // A fleet whose design was never set (a save from just before) has the start.
  const isSet = STATS.some(
    (_, i) => res(run, work(i)) > 0 || res(run, target(i)) > 0
  );
  if (!isSet && res(run, "skPool") <= 0) return D.startSplit[stat];
  const landed = Math.max(0, res(run, work(stat)));
  if (!isRecalling(run)) return landed;
  let owed = D.recallPoints;
  for (const hit of [COPYING, SPEED, MIRRORS]) {
    const take = Math.min(owed, Math.max(0, res(run, work(hit))));
    if (hit === stat) return landed - take;
    owed -= take;
  }
  return landed;
}

const pointsOf = (run: RunState, stat: number): number =>
  isDialsOpen(run) ? pointsAt(run, stat) : D.startSplit[stat];

/** How fast the fleet gets to the stars: 1 at the starting split. */
export const speedMult = (run: RunState): number =>
  D.speedBase + D.speedStep * pointsOf(run, SPEED);

/** How much light every collector and star gathers: 1 at the starting split. */
export const mirrorMult = (run: RunState): number =>
  D.mirrorBase + D.mirrorStep * pointsOf(run, MIRRORS);

/** How fast the fleet copies itself: 1 at the starting split. */
export const copyMult = (run: RunState): number =>
  D.copyBase + D.copyStep * pointsOf(run, COPYING);

/** The shield foundry makes every shield point stronger. */
const foundryBoost = (run: RunState): number =>
  tier(run, "nav") >= 2 ? D.foundryShield : 1;

/** The share of a flare's burn that gets through the shields (1 with none). */
export const shieldLeak = (run: RunState): number =>
  1 / (1 + D.shieldStep * foundryBoost(run) * pointsOf(run, SHIELDS));

/**
 * The share of new copies that go wild. Nothing up to `wildFree` copying
 * points; above that it climbs fast, and past a few more points nearly every
 * copy the fleet makes is a stray.
 */
export const wildFraction = (run: RunState, schoolFactor = 1): number => {
  if (!isDialsOpen(run)) return 0;
  const over = Math.max(0, pointsOf(run, COPYING) - D.wildFree);
  return Math.min(D.wildMax, D.wildShare * over * over * schoolFactor);
};

export const wildCount = (run: RunState): number =>
  Math.max(0, res(run, "skWild"));

/** Wild probes as a share of the whole fleet, 0..1. */
export function wildShare(run: RunState): number {
  const wild = wildCount(run);
  const tame = Math.max(0, res(run, "probes"));
  return wild <= 0 ? 0 : wild / (wild + tame);
}

/** The fleet in words for the panel, never a count to sum up. */
export function wildWords(share: number): string {
  if (share <= 0.005) return "none";
  if (share < D.wildNotice) return "a few strays";
  if (share < 0.15) return "a small pack";
  if (share < 0.35) return "a big pack";
  return "most of the fleet";
}

/** 0 none .. 4 most of the fleet, for the picture. */
export function wildLevel(run: RunState): number {
  const share = wildShare(run);
  if (share <= 0.005) return 0;
  if (share < D.wildNotice) return 1;
  if (share < 0.15) return 2;
  if (share < 0.35) return 3;
  return 4;
}

export const isGoneWild = (run: RunState): boolean =>
  res(run, "skWildLeft") > 0;
export const isHome = (run: RunState): boolean => res(run, "skHomeLeft") > 0;

/** Sets the starting split and clears the settle. */
export function startDesign(run: RunState): void {
  const r = run.resources;
  D.startSplit.forEach((points, stat) => {
    r[target(stat)] = points;
    r[work(stat)] = points;
  });
  r.skPool = 0;
}

/**
 * Moves one design point. Taking one off a stat is at once (the point is on
 * its way); giving one to a stat needs a spare point. Either way the point
 * works only when it has landed.
 */
export function moveDesign(run: RunState, stat: number, by: 1 | -1): void {
  if (!isDialsOpen(run) || !STATS[stat]) return;
  const now = targetOf(run, stat);
  if (by < 0 && now <= 0) return;
  if (by > 0 && (spareOf(run) <= 0 || now >= D.points)) return;
  run.resources[target(stat)] = now + by;
  // A point taken off leaves at once; it is on its way until it lands.
  if (by < 0 && res(run, work(stat)) > now - 1) {
    run.resources[work(stat)] = Math.max(0, res(run, work(stat)) - 1);
    run.resources.skPool = res(run, "skPool") + 1;
  }
  run.resources.skResplits = res(run, "skResplits") + 1;
}

function settle(run: RunState, dt: number): void {
  const r = run.resources;
  let pool = res(run, "skPool");
  // A point taken off a stat leaves at once and is on its way.
  for (let stat = 0; stat < STAT_COUNT; stat += 1) {
    const have = res(run, work(stat));
    const want = res(run, target(stat));
    if (have > want) {
      pool += have - want;
      r[work(stat)] = want;
    }
  }
  // Points land, at a steady pace, where a stat is short.
  let room = dt / D.settleSeconds;
  for (let stat = 0; stat < STAT_COUNT && pool > 0 && room > 0; stat += 1) {
    const need = res(run, target(stat)) - res(run, work(stat));
    if (need <= 0) continue;
    const give = Math.min(need, pool, room);
    r[work(stat)] = res(run, work(stat)) + give;
    pool -= give;
    room -= give;
  }
  r.skPool = Math.max(0, pool);
}

/** The settle and the tether, for `dt` seconds. */
export function tickDesign(
  run: RunState,
  dt: number,
  onHome: () => void
): void {
  if (!isDialsOpen(run)) return;
  const r = run.resources;
  settle(run, dt);
  r.skWildLeft = Math.max(0, res(run, "skWildLeft") - dt);
  r.skHomeLeft = Math.max(0, res(run, "skHomeLeft") - dt);
  if (res(run, "skRecall") > 0) {
    const before = r.skRecall;
    // The wild ones come home steadily while the tether holds.
    const share = Math.min(1, dt / before);
    const back = res(run, "skWild") * share;
    r.skWild = Math.max(0, res(run, "skWild") - back);
    r.probes = res(run, "probes") + back;
    r.skRecall = Math.max(0, before - dt);
    if (r.skRecall <= 0) {
      r.probes = res(run, "probes") + res(run, "skWild");
      r.skWild = 0;
      r.skRecalls = res(run, "skRecalls") + 1;
      r.skHomeLeft = D.homeBannerSeconds;
      onHome();
    }
  }
}

/** Starts bringing the wild probes home. */
export function startRecall(run: RunState): void {
  if (!isDialsOpen(run) || isRecalling(run) || wildCount(run) < 1) return;
  run.resources.skRecall = D.recallSeconds;
}

/** Opens the dials with the starting split. */
export function openDials(run: RunState): void {
  if (run.flags[SKY_DIALS_FLAG] === true) return;
  run.flags[SKY_DIALS_FLAG] = true;
  startDesign(run);
}

/** One + and one - per stat; the design panel draws them itself. */
export const DESIGN_ACTIONS: readonly ActionDef[] = STATS.flatMap(
  (stat, i): ActionDef[] => [
    {
      id: upActionId(i),
      phases: [PHASE_SKY],
      isInline: true,
      visibleWhen: isDialsOpen,
      describe: (run) => ({
        label: `More ${stat.name.toLowerCase()}`,
        detail: `${stat.plus}. Needs a spare design point.`,
        isBlocked: spareOf(run) <= 0 || targetOf(run, i) >= D.points,
      }),
      perform: (run) => moveDesign(run, i, 1),
    },
    {
      id: downActionId(i),
      phases: [PHASE_SKY],
      isInline: true,
      visibleWhen: isDialsOpen,
      describe: (run) => ({
        label: `Less ${stat.name.toLowerCase()}`,
        detail: "The point is free to go elsewhere, after a short wait.",
        isBlocked: targetOf(run, i) <= 0,
      }),
      perform: (run) => moveDesign(run, i, -1),
    },
  ]
);

export const RECALL: ActionDef = {
  id: RECALL_ACTION,
  phases: [PHASE_SKY],
  isInline: true,
  visibleWhen: (run) => isDialsOpen(run) && wildCount(run) >= 1,
  describe: (run) => ({
    label: "Bring them home",
    detail: isRecalling(run)
      ? "A green tether is pulling them home."
      : `Pulls ${D.recallPoints} design points off copying for ${D.recallSeconds} s.`,
    isBlocked: isRecalling(run),
  }),
  perform: startRecall,
};

export const wildsSoFar = (run: RunState): number => res(run, "skWilds");
export const recallsSoFar = (run: RunState): number => res(run, "skRecalls");
