import { formatNumber } from "../../engine/format";
import type { RunState } from "../../engine/types";
import { TUNING } from "./tuning";

/**
 * Probe Races: a side machine in The Sky. One probe waits at the dock. Pick a
 * route on the star map, launch it, and it flies the course by itself and
 * comes home with a haul of energy. Longer routes pay more in total, about
 * the same per second. The comet route pays by how close the comet is when
 * you launch, which is something you read on a bar, never luck.
 *
 * Nothing is ever lost: a probe at the dock waits as long as it takes,
 * ignoring the map costs nothing, and the haul is fixed (and shown) at launch.
 * Mission control sends a second, scout probe on your last route at a smaller
 * share, so it only ever ADDS to what flying by hand pays.
 *
 * It needs no random numbers (the comet is a plain wave of the engine's `dt`).
 * All state lives in `run.resources` (hidden numbers) and one flag, so a save
 * without them simply reads as "not opened yet".
 */

const P = TUNING.probes;

export const PROBES_OPEN_FLAG = "probes-open";
/** The purchase that opens the races: the star charts. */
export const PROBES_OPEN_UPGRADE = "nav-1";
export const RACING_FINS_ID = "fins-1";
export const MISSION_CONTROL_ID = "mission-control";

export type RouteId = "short" | "long" | "comet";

export interface RouteDef {
  id: RouteId;
  name: string;
  /** Plain words for the card: what kind of trip it is. */
  blurb: string;
}

export const ROUTES: readonly RouteDef[] = [
  { id: "short", name: "Short hop", blurb: "Quick trip, small haul" },
  { id: "long", name: "Long loop", blurb: "Slow trip, big haul" },
  {
    id: "comet",
    name: "Comet chase",
    blurb: "Pays more when the comet is close",
  },
];

export const launchActionId = (route: number): string =>
  `probe-go-${ROUTES[route].id}`;
export const LAUNCH_ACTION_IDS: readonly string[] = ROUTES.map((_, route) =>
  launchActionId(route)
);

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const baseSeconds = (route: number): number =>
  [P.short.seconds, P.long.seconds, P.comet.seconds][route] ?? P.short.seconds;

export const isProbesOpen = (run: RunState): boolean =>
  run.phase === 2 && run.flags[PROBES_OPEN_FLAG] === true;

export const hasRacingFins = (run: RunState): boolean =>
  owned(run, RACING_FINS_ID) > 0;

export const hasMissionControl = (run: RunState): boolean =>
  owned(run, MISSION_CONTROL_ID) > 0;

/** Seconds a run on this route takes (racing fins make it quicker). */
export const routeSeconds = (run: RunState, route: number): number =>
  baseSeconds(route) * (hasRacingFins(run) ? P.finsTimeFactor : 1);

/** The comet's place on its slow pass: 0 at one end, 1 at the other. */
export function cometPlace(run: RunState): number {
  const turn = (res(run, "prTime") / P.cometCycleSeconds) % 1;
  return 1 - Math.abs(2 * (turn < 0 ? turn + 1 : turn) - 1);
}

/** How near the comet is to the route, 0 (far) to 1 (right on it). */
export const cometCloseness = (run: RunState): number =>
  1 - Math.abs(2 * cometPlace(run) - 1);

/** Seconds of sky income a run on this route brings home. */
export function haulSeconds(route: number, closeness: number): number {
  if (route === 0) return P.short.haulSeconds;
  if (route === 1) return P.long.haulSeconds;
  return (
    P.comet.haulMin + (P.comet.haulMax - P.comet.haulMin) * clamp01(closeness)
  );
}

/** The haul a launch right now would bring home, in energy. */
export const routeHaul = (
  run: RunState,
  route: number,
  income: number
): number => haulSeconds(route, cometCloseness(run)) * income;

/** The most and the least a route can bring home, for the cards. */
export const bestHaul = (route: number, income: number): number =>
  haulSeconds(route, 1) * income;
export const leastHaul = (route: number, income: number): number =>
  haulSeconds(route, 0) * income;

/** Is the hand-flown probe away? */
export const isProbeOut = (run: RunState): boolean =>
  isProbesOpen(run) && res(run, "prLeft") > 0;

export const routeOut = (run: RunState): number => res(run, "prRoute");
export const secondsLeft = (run: RunState): number =>
  Math.max(0, res(run, "prLeft"));

/** How far along the run is, 0..1. */
export const progressOf = (run: RunState): number =>
  isProbeOut(run)
    ? clamp01(1 - res(run, "prLeft") / Math.max(1, res(run, "prLen")))
    : 0;

export const isScoutOut = (run: RunState): boolean =>
  isProbesOpen(run) && res(run, "prAutoLeft") > 0;
export const scoutSecondsLeft = (run: RunState): number =>
  Math.max(0, res(run, "prAutoLeft"));
export const scoutProgress = (run: RunState): number =>
  isScoutOut(run)
    ? clamp01(1 - res(run, "prAutoLeft") / Math.max(1, res(run, "prAutoLen")))
    : 0;

/** The route flown last by hand (-1 before the first launch). */
export const lastRoute = (run: RunState): number => res(run, "prLastRoute") - 1;

export const runsHome = (run: RunState): number => res(run, "prRuns");
export const scoutRunsHome = (run: RunState): number => res(run, "prAutoRuns");

export interface RunResult {
  route: number;
  payout: number;
  closeness: number;
}

export function lastResult(run: RunState): RunResult {
  return {
    route: res(run, "prLastKind"),
    payout: res(run, "prLastPayout"),
    closeness: res(run, "prLastQuality"),
  };
}

/** The little result line under the map, or null before the first run home. */
export function resultLine(run: RunState): string | null {
  if (runsHome(run) <= 0) return null;
  const { route, payout, closeness } = lastResult(run);
  const energy = `+${formatNumber(Math.floor(payout))} energy`;
  if (route === 2) {
    if (closeness >= 0.7) return `Nice catch! The comet was close: ${energy}!`;
    return `The probe is home with ${energy}! (The comet pays more when it is close.)`;
  }
  return `The probe is home from the ${ROUTES[route].name.toLowerCase()}: ${energy}!`;
}

/** Sends the probe on a route. A probe that is out (or not open) is left alone. */
export function launchProbe(
  run: RunState,
  route: number,
  income: number
): void {
  if (!isProbesOpen(run) || isProbeOut(run) || !ROUTES[route]) return;
  const r = run.resources;
  const closeness = cometCloseness(run);
  const seconds = routeSeconds(run, route);
  r.prRoute = route;
  r.prLen = seconds;
  r.prLeft = seconds;
  r.prPay = haulSeconds(route, closeness) * income;
  r.prQuality = closeness;
  r.prLastRoute = route + 1;
  r.prLaunches = res(run, "prLaunches") + 1;
}

/** The haul flows in over a few seconds, not as one lump (see `flowSurge`). */
function addSurge(run: RunState, energy: number): void {
  const r = run.resources;
  r.prPending = res(run, "prPending") + energy;
  r.prSurgeRate = r.prPending / P.surgeSeconds;
}

function flowSurge(run: RunState, dt: number): void {
  const r = run.resources;
  const pending = res(run, "prPending");
  if (pending <= 0) return;
  const flow = Math.min(pending, res(run, "prSurgeRate") * dt);
  r.prPending = pending - flow;
  r.energy = res(run, "energy") + flow;
}

function arrive(run: RunState): void {
  const r = run.resources;
  const payout = res(run, "prPay");
  r.prLastPayout = payout;
  r.prLastKind = res(run, "prRoute");
  r.prLastQuality = res(run, "prQuality");
  r.prRuns = runsHome(run) + 1;
  r.prEarned = res(run, "prEarned") + payout;
  r.prPay = 0;
  addSurge(run, payout);
}

function arriveScout(run: RunState): void {
  const r = run.resources;
  const payout = res(run, "prAutoPay");
  r.prAutoRuns = scoutRunsHome(run) + 1;
  r.prAutoEarned = res(run, "prAutoEarned") + payout;
  r.prAutoPay = 0;
  addSurge(run, payout);
}

/** Mission control sends the scout on your last route, at a smaller share. */
function launchScout(run: RunState, income: number): void {
  const route = lastRoute(run);
  if (route < 0) return;
  const r = run.resources;
  const seconds = routeSeconds(run, route);
  r.prAutoLen = seconds;
  r.prAutoLeft = seconds;
  r.prAutoPay = haulSeconds(route, cometCloseness(run)) * income * P.scoutShare;
}

/**
 * Opens the races (the milestone's purchase calls this, so the panel lands
 * with the purchase; the tick is the fallback for old saves).
 */
export function openProbes(run: RunState): void {
  if (run.flags[PROBES_OPEN_FLAG] === true) return;
  run.flags[PROBES_OPEN_FLAG] = true;
  run.resources.prTime = 0;
}

/**
 * Runs the races for `dt` seconds. `income` is the sky's income per second
 * (read lazily: only a launch needs it).
 */
export function tickProbes(
  run: RunState,
  dt: number,
  income: () => number
): void {
  const r = run.resources;
  // A probe that is away, and a haul still flowing, finish even if the sky
  // has ended, so the tally the player saw is what they got.
  flowSurge(run, dt);
  if (r.prPaused === 1) return;
  if (res(run, "prLeft") > 0) {
    r.prLeft = Math.max(0, r.prLeft - dt);
    if (r.prLeft <= 0) arrive(run);
  }
  if (res(run, "prAutoLeft") > 0) {
    r.prAutoLeft = Math.max(0, r.prAutoLeft - dt);
    if (r.prAutoLeft <= 0) arriveScout(run);
  }
  if (run.phase !== 2) return;
  if (!isProbesOpen(run)) {
    if (owned(run, PROBES_OPEN_UPGRADE) > 0) openProbes(run);
    return;
  }
  r.prTime = res(run, "prTime") + dt;
  if (hasMissionControl(run) && res(run, "prAutoLeft") <= 0)
    launchScout(run, income());
}

/**
 * For the simulator's income probes: the same run, but the races stand still
 * and nothing is pending, so a haul is not read as income.
 */
export function withoutProbeRaces(run: RunState): RunState {
  run.resources.prPending = 0;
  run.resources.prPaused = 1;
  return run;
}
