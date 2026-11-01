import { formatNumber } from "../../engine/format";
import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { migrationSeedsMult } from "./biomes";
import { MANUAL_RESOURCES, PHASE_WORLD } from "./resources";
import { TUNING } from "./tuning";

/**
 * Seed migration: a side machine on the green world. Every couple of minutes
 * a flock of migrating birds gathers with seeds in its feathers. Five regions
 * are named on a small map, and each shows how welcome a flock would be there
 * (how much green it would grow, in plain numbers) before you choose. Every
 * region grows something, so nothing can go wrong: a better-chosen region
 * simply grows more. A region that has turned green already welcomes fewer
 * seeds, so the flock goes round the map. Meadows feed the birds, so a
 * meadow raises every welcome. The flock waits as long as it takes. The flock
 * leader sends a waiting flock to the most welcoming region at a lower
 * payout, so it only ever adds to hand play.
 *
 * The flocks come from a random stream of their own (`run.rng` is never
 * touched). All state lives in hidden `run.resources` and one flag, so a save
 * without them simply reads as "not opened yet".
 */

const M = TUNING.migration;

export const MIGRATION_OPEN_FLAG = "migration-open";
/** The purchase that opens the migration: the first rover to plant a path. */
export const MIGRATION_OPEN_UPGRADE = "planting-rover";
export const FLOCK_LEADER_ID = "flock-leader";

export interface Region {
  name: string;
  blurb: string;
  /** Seconds of green income a flock grows here, before the day's weather. */
  base: number;
  /** Seconds the flight takes. */
  hop: number;
  /** Where it sits on the little map (0 to 100). */
  x: number;
  y: number;
}

/** The regions on the map, nearest and humblest first. */
export const REGIONS: readonly Region[] = [
  {
    name: "Dry Plains",
    blurb: "A short hop over bare, dusty ground",
    base: 14,
    hop: 6,
    x: 22,
    y: 62,
  },
  {
    name: "Misty Hills",
    blurb: "Soft slopes under a low cloud",
    base: 17,
    hop: 9,
    x: 40,
    y: 24,
  },
  {
    name: "Salt Marsh",
    blurb: "Flat, shiny and full of reeds",
    base: 20,
    hop: 12,
    x: 56,
    y: 70,
  },
  {
    name: "Rocky Coast",
    blurb: "Cliffs and sea wind, a longer flight",
    base: 24,
    hop: 16,
    x: 80,
    y: 36,
  },
  {
    name: "Far Islands",
    blurb: "A very long flight to bare, sunny islands",
    base: 30,
    hop: 22,
    x: 86,
    y: 78,
  },
];

export const REGION_COUNT = REGIONS.length;

export const sendActionId = (region: number): string =>
  `migration-send-${region}`;
export const MIGRATION_ACTION_IDS: readonly string[] = REGIONS.map((_, i) =>
  sendActionId(i)
);

/** Mixed into the run's seed so the flocks have a stream of their own. */
const SEED_MIX = 0xb12d5;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

export type MigrationStage = "gathering" | "ready" | "flying";

export const isMigrationOpen = (run: RunState): boolean =>
  run.phase === 2 && run.flags[MIGRATION_OPEN_FLAG] === true;

export const hasFlockLeader = (run: RunState): boolean =>
  owned(run, FLOCK_LEADER_ID) > 0;

export function migrationStage(run: RunState): MigrationStage {
  const s = res(run, "mgStage");
  return s === 1 ? "ready" : s === 2 ? "flying" : "gathering";
}

/** True while a flock waits for the player to choose. */
export const isFlockReady = (run: RunState): boolean =>
  isMigrationOpen(run) && migrationStage(run) === "ready";

/** Flights landed so far. */
export const flightsSoFar = (run: RunState): number => res(run, "mgFlights");

const waitTotal = (run: RunState): number =>
  res(run, "mgShown") === 0 ? M.firstWaitSeconds : M.waitSeconds;

/** Seconds until the next flock (while gathering). */
export const secondsToFlock = (run: RunState): number =>
  migrationStage(run) === "gathering"
    ? Math.max(0, waitTotal(run) - res(run, "mgTime"))
    : 0;

/** How green a region already is, 0 to 1 (it fills as flocks land). */
export const regionGreen = (run: RunState, region: number): number =>
  Math.min(1, Math.max(0, res(run, `mgGreen${region}`)));

/** The region the flock is flying to (or flew to last). */
export const flockDestination = (run: RunState): number =>
  Math.round(res(run, "mgDest"));

/**
 * What a flock would grow in this region right now, in seconds of green
 * income. Today's weather, how much green is already there and the meadows
 * all count. These are the real numbers the landing pays from.
 */
export function regionWelcome(run: RunState, region: number): number {
  const r = REGIONS[region];
  if (!r) return 0;
  const weather = res(run, `mgRoll${region}`) || 1;
  const room = 1 - M.greenCut * regionGreen(run, region);
  return r.base * weather * room * migrationSeedsMult(run);
}

/** The region with the biggest welcome (the likeliest to grow most). */
export function mostWelcoming(run: RunState): number {
  let best = 0;
  for (let i = 1; i < REGION_COUNT; i += 1)
    if (regionWelcome(run, i) > regionWelcome(run, best)) best = i;
  return best;
}

/** What a flock sent to `region` grows, in green. */
export const flockPays = (
  run: RunState,
  region: number,
  income: number
): number => regionWelcome(run, region) * Math.max(1, income);

/** What the flock leader's send would grow. */
export const leaderPaysOn = (run: RunState, income: number): number =>
  flockPays(run, mostWelcoming(run), income) * M.leaderShare;

/** The flock leader turns up once a couple of flights have landed. */
export const leaderShown = (run: RunState): boolean =>
  run.flags[MIGRATION_OPEN_FLAG] === true &&
  flightsSoFar(run) >= M.leaderAfterFlights;

export interface FlightResult {
  region: number;
  pays: number;
  byLeader: boolean;
}

export const lastFlight = (run: RunState): FlightResult => ({
  region: flockDestination(run),
  pays: res(run, "mgLastPays"),
  byLeader: res(run, "mgBy") === 1,
});

/** The little result line under the map, or null before the first landing. */
export function migrationResultLine(run: RunState): string | null {
  if (flightsSoFar(run) <= 0) return null;
  const { region, pays, byLeader } = lastFlight(run);
  const name = REGIONS[region]?.name ?? "the far side";
  const who = byLeader ? "The flock leader sent a flock. " : "";
  const tail = byLeader ? " (Choose one yourself for even more.)" : "";
  return `${who}The flock landed on ${name}, and new green is spreading there: +${formatNumber(Math.floor(pays))} green.${tail}`;
}

/** The landing flows in over a few seconds, not as one lump. */
function addSurge(run: RunState, green: number): void {
  const r = run.resources;
  r.mgPending = res(run, "mgPending") + green;
  r.mgSurgeRate = r.mgPending / M.surgeSeconds;
}

/**
 * Moves the green that is still flowing in. Once the world has ended,
 * whatever is left is settled at a small rate into the new phase's own
 * currency.
 */
function flowSurge(run: RunState, dt: number): void {
  const r = run.resources;
  const pending = res(run, "mgPending");
  if (pending <= 0) return;
  if (run.phase !== 2) {
    const id = MANUAL_RESOURCES[run.phase];
    r[id] = res(run, id) + pending * M.greenToCare;
    r.mgPending = 0;
    return;
  }
  const flow = Math.min(pending, res(run, "mgSurgeRate") * dt);
  r.mgPending = pending - flow;
  r.green = res(run, "green") + flow;
}

/** Sends the flock to a region. A hand send pays in full. */
function send(
  run: RunState,
  region: number,
  byLeader: boolean,
  income: number
) {
  if (!isFlockReady(run) || region < 0 || region >= REGION_COUNT) return;
  const r = run.resources;
  r.mgDest = region;
  r.mgBy = byLeader ? 1 : 0;
  r.mgLastPays =
    flockPays(run, region, income) * (byLeader ? M.leaderShare : 1);
  r.mgStage = 2;
  r.mgFly = REGIONS[region].hop;
  r.mgTime = 0;
}

/** Sends the flock by hand (the panel's buttons call this). */
export const sendFlock = (
  run: RunState,
  region: number,
  income: number
): void => send(run, region, false, income);

/** A new flock gathers, and the day's weather is rolled for every region. */
function gather(run: RunState): void {
  const r = run.resources;
  const stream = { rng: res(run, "mgRng") | 0 };
  for (let i = 0; i < REGION_COUNT; i += 1)
    r[`mgRoll${i}`] =
      Math.round(
        (M.weatherLow + (M.weatherHigh - M.weatherLow) * nextRandom(stream)) *
          100
      ) / 100;
  r.mgRng = stream.rng;
  r.mgStage = 1;
  r.mgTime = 0;
  r.mgShown = res(run, "mgShown") + 1;
}

/** The flock lands: the region greens up and the green flows in. */
function land(run: RunState): void {
  const r = run.resources;
  const region = flockDestination(run);
  const pays = res(run, "mgLastPays");
  r[`mgGreen${region}`] = Math.min(1, regionGreen(run, region) + M.greenStep);
  r.mgFlights = flightsSoFar(run) + 1;
  r.mgEarned = res(run, "mgEarned") + pays;
  r.mgStage = 0;
  r.mgTime = 0;
  addSurge(run, pays);
}

/**
 * Opens the migration (the first rover calls this; the tick is the fallback
 * for old saves). The first flock gathers after a short wait.
 */
export function openMigration(run: RunState): void {
  if (run.flags[MIGRATION_OPEN_FLAG] === true) return;
  run.flags[MIGRATION_OPEN_FLAG] = true;
  run.resources.mgRng = (run.rng ^ SEED_MIX) | 0;
  run.resources.mgStage = 0;
  run.resources.mgTime = 0;
}

/**
 * Runs the migration for `dt` seconds. `income` is the world's green per
 * second (read lazily: only a send needs it). A flock already in the air,
 * and green still flowing in, finish after the world ends.
 */
export function tickMigration(
  run: RunState,
  dt: number,
  income: () => number = () => 1
): void {
  const r = run.resources;
  if (run.flags[MIGRATION_OPEN_FLAG] !== true) {
    if (run.phase === 2 && owned(run, MIGRATION_OPEN_UPGRADE) > 0)
      openMigration(run);
    return;
  }
  flowSurge(run, dt);
  if (r.mgPaused === 1) return;
  if (migrationStage(run) === "flying") {
    r.mgFly = res(run, "mgFly") - dt;
    if (r.mgFly <= 0) {
      land(run);
      if (run.phase !== 2) flowSurge(run, 0);
    }
    return;
  }
  if (run.phase !== 2) return;
  r.mgTime = res(run, "mgTime") + dt;
  if (migrationStage(run) === "gathering") {
    if (r.mgTime >= waitTotal(run)) gather(run);
    return;
  }
  if (hasFlockLeader(run) && r.mgTime >= M.leaderDelay)
    send(run, mostWelcoming(run), true, income());
}

/**
 * For the simulator's income probes: nothing is pending, so a landing is not
 * read as income.
 */
export function withoutMigration(run: RunState): RunState {
  run.resources.mgPending = 0;
  run.resources.mgPaused = 1;
  return run;
}

/** One send button per region; the migration panel draws them itself. */
export function sendActions(
  income: (run: RunState) => number
): readonly ActionDef[] {
  return REGIONS.map((region, index) => ({
    id: sendActionId(index),
    phases: [PHASE_WORLD],
    isInline: true,
    visibleWhen: isMigrationOpen,
    describe: (run: RunState) => {
      const on = isFlockReady(run);
      return {
        label: `Send the flock to ${region.name}`,
        detail: on
          ? `About +${formatNumber(Math.floor(flockPays(run, index, income(run))))} green, a ${region.hop} second flight.`
          : "The flock is on its way.",
        isBlocked: !on,
        hint:
          on && mostWelcoming(run) === index
            ? { text: "most welcome", tone: "good" as const }
            : undefined,
      };
    },
    perform: (run: RunState) => sendFlock(run, index, income(run)),
  }));
}
