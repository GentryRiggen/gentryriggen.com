import { formatNumber } from "../../engine/format";
import { isProjectDone } from "../../engine/engine";
import { nextRandom } from "../../engine/rng";
import type { RunState } from "../../engine/types";
import { TUNING } from "./tuning";

/**
 * The Weather Desk and the crews of No More Night. A storm front forms by
 * itself, then a forecast in three steps: the storm's path firms up as it
 * nears, so the chances for each of three towns sharpen. The player has a
 * few crews (two, three with the storm crews), and each one is building,
 * learning at the school, or watching a town for the storm. A crew on watch
 * isn't building, and moving to a new post takes a while on the road. A
 * crew needs a little while to get ready (sandbags, ladders) once it is
 * there, so moving early on a vague forecast and moving late on a sure one
 * is the choice. A storm that lands
 * on a ready crew pays a bonus. One that lands on a town with no crew puts
 * its lights out for a while: a small dip, never a loss. A crew sent there
 * fixes it fast (and learns from it); left alone it comes back on its own.
 * Crews stay where they are between storms; move them only when a forecast
 * says so. A dark town costs a little power (a tenth of the pay, a fifth at
 * most) until a crew or time puts it right. Nothing expires, nothing is
 * taken for good, and nobody is told off.
 *
 * All state lives in `run.resources` (hidden numbers) and one flag, so a save
 * without them simply reads as "not opened yet". Time is the engine's `dt`.
 * The desk draws from its own random stream, never the run's.
 */

const W = TUNING.weather;
const C = TUNING.crews;
/** Makes the desk's stream differ from the run's own. */
const SEED_MIX = 0x5bd1e995;

export const WEATHER_OPEN_FLAG = "weather-open";
/** Set by a forecast with steps (a save from before has none). */
const STEPS_FLAG = "weather-steps";
export const STORM_CREWS_ID = "storm-crews";
export const WEATHER_VANE_ID = "weather-vane";
/** Projects (projects.ts) that make the desk better. */
export const BAROMETERS_ID = "barometers";
export const SPARE_PARTS_ID = "spare-parts";

export const TOWNS = ["Rivertown", "Hilltop", "Harbor"] as const;
export const TOWN_COUNT = TOWNS.length;
const TOWN_INDEXES: readonly number[] = [0, 1, 2];

/** The crews' posts: building, the school, then one watch post per town. */
export const POST_BUILD = 0;
export const POST_SCHOOL = 1;
export const POST_WATCH = 2;
export const POST_COUNT = POST_WATCH + TOWN_COUNT;
export const MAX_CREWS = C.base + 1;
const CREW_INDEXES: readonly number[] = Array.from(
  { length: MAX_CREWS },
  (_, i) => i
);

/** One button per crew and post (each crew's own row of posts). */
export const crewPostActionId = (crew: number, post: number): string =>
  `crew-${crew}-${post}`;
export const CREW_POST_ACTION_IDS: readonly string[] = CREW_INDEXES.flatMap(
  (crew) =>
    Array.from({ length: POST_COUNT }, (_, post) =>
      crewPostActionId(crew, post)
    )
);

export type WeatherStage = "closed" | "forming" | "forecast";

/** What the last front did, as stored in `wxLastKind`. */
export type StormKind = "none" | "held" | "vane" | "flicker";
const KINDS: readonly StormKind[] = ["none", "held", "vane", "flicker"];

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;

function draw(run: RunState): number {
  const stream = { rng: res(run, "wxSeed") | 0 };
  const value = nextRandom(stream);
  run.resources.wxSeed = stream.rng;
  return value;
}

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

export const isWeatherOpen = (run: RunState): boolean =>
  run.phase === 1 && run.flags[WEATHER_OPEN_FLAG] === true;

/** Crews: two, or three with the storm crews. */
export const crewCount = (run: RunState): number =>
  C.base + owned(run, STORM_CREWS_ID);

/** Where a crew is posted (a crew nobody has moved is building). */
export const postOf = (run: RunState, crew: number): number => {
  const post = Math.round(res(run, `crewPost${crew}`));
  return post >= 0 && post < POST_COUNT ? post : POST_BUILD;
};

/** Seconds a crew still has on the road to its post (0: it is there). */
export const travelLeft = (run: RunState, crew: number): number =>
  Math.max(0, res(run, `crewTravel${crew}`));

/** A crew is on its post, not on the road. */
export const isThere = (run: RunState, crew: number): boolean =>
  crew < crewCount(run) && travelLeft(run, crew) <= 0;

const crewsActive = (run: RunState): number[] =>
  CREW_INDEXES.filter((crew) => crew < crewCount(run));

/** Crews on this post, on the road or not. */
export const crewsPosted = (run: RunState, post: number): number =>
  crewsActive(run).filter((crew) => postOf(run, crew) === post).length;

/** Crews working this post right now (not on the road). */
export const crewsWorking = (run: RunState, post: number): number =>
  crewsActive(run).filter(
    (crew) => postOf(run, crew) === post && isThere(run, crew)
  ).length;

/** Crews still on the road to a new post. */
export const crewsOnTheRoad = (run: RunState): number =>
  crewsActive(run).filter((crew) => !isThere(run, crew)).length;

export const buildingCrews = (run: RunState): number =>
  crewsWorking(run, POST_BUILD);
export const schoolCrews = (run: RunState): number =>
  crewsWorking(run, POST_SCHOOL);

/** What every building crew adds to the power cities pay. */
export const buildMult = (run: RunState): number =>
  run.phase === 1 ? 1 + C.buildBoost * buildingCrews(run) : 1;

/** What every crew at the school adds to the know-how a second (patrols: less). */
export const schoolMult = (run: RunState): number =>
  run.phase === 1
    ? 1 +
      C.schoolBoost *
        (isProjectDone(run, "line-patrols")
          ? TUNING.projects.patrolSchool
          : 1) *
        schoolCrews(run)
    : 1;

export const hasWeatherVane = (run: RunState): boolean =>
  owned(run, WEATHER_VANE_ID) > 0;

export const hasBarometers = (run: RunState): boolean =>
  isProjectDone(run, BAROMETERS_ID);

export const hasSpareParts = (run: RunState): boolean =>
  isProjectDone(run, SPARE_PARTS_ID);

export function weatherStage(run: RunState): WeatherStage {
  if (!isWeatherOpen(run)) return "closed";
  return res(run, "wxStage") === 1 ? "forecast" : "forming";
}

/** The forecast step, 1 to `forecastSteps` (0 outside a forecast). */
export const forecastStep = (run: RunState): number =>
  weatherStage(run) === "forecast"
    ? Math.min(W.forecastSteps, Math.round(res(run, "wxStep")) + 1)
    : 0;

export const chanceOf = (run: RunState, town: number): number =>
  res(run, `wxChance${town}`);

/** Crews watching this town that have got there. */
export const crewsAt = (run: RunState, town: number): number =>
  crewsWorking(run, POST_WATCH + town);

/** A crew is at this town. */
export const hasCrew = (run: RunState, town: number): boolean =>
  crewsAt(run, town) > 0;
export const isShielded = hasCrew;

/** Crews posted to a town, there or on the road. */
export const crewsHeaded = (run: RunState, town: number): number =>
  crewsPosted(run, POST_WATCH + town);

/** Towns with a crew there. */
export const crewsPlaced = (run: RunState): number =>
  TOWN_INDEXES.filter((town) => hasCrew(run, town)).length;
export const shieldedCount = crewsPlaced;

/** How ready the crew at a town is, 0..1 (0 with no crew). */
export const readiness = (run: RunState, town: number): number =>
  hasCrew(run, town) ? Math.min(1, Math.max(0, res(run, `wxReady${town}`))) : 0;

/** Seconds left on a town's outage (0: its lights are on). */
export const outageLeft = (run: RunState, town: number): number =>
  Math.max(0, res(run, `wxOut${town}`));

/** Seconds until a dark town's lights are back (a crew there makes it quick). */
export const outageSecondsLeft = (run: RunState, town: number): number =>
  hasCrew(run, town)
    ? (outageLeft(run, town) * fixSeconds(run)) / W.outageSeconds
    : outageLeft(run, town);

export const isOut = (run: RunState, town: number): boolean =>
  outageLeft(run, town) > 0;

export const townsOut = (run: RunState): number =>
  TOWN_INDEXES.filter((town) => isOut(run, town)).length;

/**
 * What the cities pay while some towns are dark: a small dip per town, and
 * never in another phase.
 */
export const outageFactor = (run: RunState): number =>
  run.phase === 1
    ? 1 - Math.min(W.outageMaxShare, W.outageShare * townsOut(run))
    : 1;

/** Seconds a crew takes to get ready, and to fix an outage. */
export const readySeconds = (run: RunState): number =>
  W.readySeconds * (hasSpareParts(run) ? W.sparePartsFactor : 1);
export const fixSeconds = (run: RunState): number =>
  W.fixSeconds * (hasSpareParts(run) ? W.sparePartsFactor : 1);

/** The likeliest town (the first, on a tie). */
export function likeliestTown(run: RunState): number {
  return TOWN_INDEXES.reduce(
    (best, town) => (chanceOf(run, town) > chanceOf(run, best) ? town : best),
    0
  );
}

/** The town the weather vane would cover if no crew is there. */
export const vanePick = likeliestTown;

/** Seconds left in the current stage, and how long the stage is. */
export const stageSecondsLeft = (run: RunState): number =>
  Math.max(0, res(run, "wxTimer"));
export const stageLength = (run: RunState): number =>
  Math.max(1, res(run, "wxStageLen"));

/** Seconds until the storm lands (0 outside a forecast). */
export const secondsToLandfall = (run: RunState): number =>
  weatherStage(run) === "forecast" ? stageSecondsLeft(run) : 0;

/** Fronts that have come and gone. */
export const frontsSoFar = (run: RunState): number => res(run, "wxFronts");

/** Seconds of income a held storm pays at full readiness. */
export const stormBonus = (run: RunState, income: number): number =>
  W.bonusSeconds * income;

/** Share of the bonus a crew this ready earns (half even if it just got there). */
export const readyShare = (ready: number): number =>
  W.unreadyShare + (1 - W.unreadyShare) * Math.min(1, Math.max(0, ready));

/**
 * How ready the crew at `town` will be when the storm lands, or a crew sent
 * there now (`isMoving`, fixing an outage first).
 */
export function readyAtLandfall(
  run: RunState,
  town: number,
  isMoving: boolean
): number {
  // A crew sent now spends its road time first, and starts over when it gets there.
  const left =
    secondsToLandfall(run) - (isMoving ? TUNING.grid.moveSeconds : 0);
  const fixing = isOut(run, town)
    ? fixSeconds(run) * (outageLeft(run, town) / W.outageSeconds)
    : 0;
  const start = isMoving ? 0 : readiness(run, town);
  return Math.min(1, start + Math.max(0, left - fixing) / readySeconds(run));
}

export interface StormResult {
  kind: StormKind;
  town: number;
  payout: number;
}

export function lastStorm(run: RunState): StormResult {
  return {
    kind: KINDS[res(run, "wxLastKind")] ?? "none",
    town: res(run, "wxLastTown"),
    payout: res(run, "wxLastPayout"),
  };
}

/** A storm has just hit: true for a few seconds, for the picture. */
export const isStormHit = (run: RunState): boolean =>
  run.phase === 1 && res(run, "wxHitLeft") > 0;

/** The little result line under the map, or null before the first storm. */
export function stormResultLine(run: RunState): string | null {
  const { kind, town, payout } = lastStorm(run);
  if (kind === "none") return null;
  const name = TOWNS[town] ?? TOWNS[0];
  const power = `+${formatNumber(Math.floor(payout))} power`;
  if (kind === "held")
    return `The storm hit ${name}, and your crew was ready: ${power}!`;
  if (kind === "vane")
    return `The storm hit ${name}. The weather vane's sandbags held: ${power}.`;
  return `The storm hit ${name} and its lights went out for a while. It costs a little power until a crew fixes it, or it comes back on its own.`;
}

/** Whole numbers that add up to exactly 100, each at least `floor`. */
function roundTo100(shares: readonly number[], floor = 0): number[] {
  const chances = shares.map((s) => Math.max(floor, Math.floor(s)));
  let left = 100 - chances.reduce((sum, c) => sum + c, 0);
  const byRemainder = [...TOWN_INDEXES].sort(
    (a, b) => shares[b] - chances[b] - (shares[a] - chances[a]) || a - b
  );
  for (let i = 0; left > 0; i = (i + 1) % TOWN_COUNT) {
    chances[byRemainder[i]] += 1;
    left -= 1;
  }
  for (let i = 0, guard = 0; left < 0 && guard < 300; guard += 1) {
    const town = byRemainder[TOWN_COUNT - 1 - i];
    if (chances[town] > floor) {
      chances[town] -= 1;
      left += 1;
    }
    i = (i + 1) % TOWN_COUNT;
  }
  return chances;
}

/**
 * Three chances that add up to exactly 100, each at least `minChance`. The
 * draw is skewed so there is usually one clear favourite.
 */
export function drawChances(run: RunState): number[] {
  const raw = TOWN_INDEXES.map(() => draw(run) ** W.skew + 0.05);
  const total = raw.reduce((sum, r) => sum + r, 0);
  const pool = 100 - W.minChance * TOWN_COUNT;
  return roundTo100(
    raw.map((r) => (r / total) * pool + W.minChance),
    W.minChance
  );
}

/** Where the storm will land: drawn once, against the first forecast. */
function drawLandfall(chances: readonly number[], roll: number): number {
  let cumulative = 0;
  for (const town of TOWN_INDEXES) {
    cumulative += chances[town];
    if (roll * 100 < cumulative) return town;
  }
  return TOWN_COUNT - 1;
}

/** How sure the forecast is at each step (barometers: surer, sooner). */
const firmness = (run: RunState): readonly number[] =>
  hasBarometers(run) ? W.firmBarometers : W.firm;

/** The chances shown at the current step: the path narrowing on the storm. */
function showStep(run: RunState): void {
  const step = Math.min(W.forecastSteps - 1, Math.round(res(run, "wxStep")));
  const sure = firmness(run)[step] ?? 0;
  const target = res(run, "wxTarget");
  const shares = TOWN_INDEXES.map(
    (town) =>
      (1 - sure) * res(run, `wxBase${town}`) +
      sure * (town === target ? 100 : 0)
  );
  roundTo100(shares).forEach((chance, town) => {
    run.resources[`wxChance${town}`] = chance;
  });
}

/**
 * Posts a crew somewhere new. It spends a while on the road first, and does
 * nothing there (no building, no learning, no watching) until it arrives.
 * A watch post only opens once the weather desk does.
 */
export function setPost(run: RunState, crew: number, post: number): void {
  if (run.phase !== 1 || crew < 0 || crew >= crewCount(run)) return;
  if (!Number.isInteger(post) || post < 0 || post >= POST_COUNT) return;
  if (post >= POST_WATCH && !isWeatherOpen(run)) return;
  if (postOf(run, crew) === post) return;
  run.resources[`crewPost${crew}`] = post;
  run.resources[`crewTravel${crew}`] = TUNING.grid.moveSeconds;
  run.resources.wxMoves = res(run, "wxMoves") + 1;
}

/** Crews open with the grid, and with the weather desk. */
export const isCrewsOpen = (run: RunState): boolean =>
  run.phase === 1 && (isWeatherOpen(run) || (run.resources.pgStarted ?? 0) > 0);

function beginForecast(run: RunState): void {
  const r = run.resources;
  const base = drawChances(run);
  base.forEach((chance, town) => {
    r[`wxBase${town}`] = chance;
  });
  // Where it lands is decided now, honestly, against the first forecast.
  r.wxTarget = drawLandfall(base, draw(run));
  run.flags[STEPS_FLAG] = true;
  r.wxStage = 1;
  r.wxStep = 0;
  r.wxStageLen = W.stepSeconds * W.forecastSteps;
  r.wxTimer = r.wxStageLen;
  showStep(run);
}

function beginForming(run: RunState, seconds: number): void {
  const r = run.resources;
  r.wxStage = 0;
  r.wxStep = 0;
  r.wxStageLen = seconds;
  r.wxTimer = seconds;
}

/** The storm lands: pays a ready crew, or puts a town's lights out for a while. */
function landfall(run: RunState, income: number): void {
  const r = run.resources;
  const town = res(run, "wxTarget");
  const handShare = hasCrew(run, town) ? readyShare(readiness(run, town)) : 0;
  // The vane covers its pick on top of the crews, so sending a crew by hand
  // can never pay less than leaving the desk alone.
  const vaneShare =
    hasWeatherVane(run) && town === vanePick(run) ? W.vaneShare : 0;
  const share = Math.max(handShare, vaneShare);
  r.wxFronts = frontsSoFar(run) + 1;
  r.wxLastTown = town;
  r.wxHitLeft = TUNING.grid.bannerSeconds;
  if (share <= 0) {
    r.wxLastKind = KINDS.indexOf("flicker");
    r.wxLastPayout = 0;
    r.wxFlickered = res(run, "wxFlickered") + 1;
    r[`wxOut${town}`] = W.outageSeconds;
    return;
  }
  const payout = stormBonus(run, income) * share;
  // The bonus flows in as a short surge, not one lump (see `flowSurge`).
  r.wxPending = res(run, "wxPending") + payout;
  r.wxSurgeRate = res(run, "wxPending") / W.surgeSeconds;
  const isHand = handShare >= vaneShare;
  r.wxLastKind = KINDS.indexOf(isHand ? "held" : "vane");
  r.wxLastPayout = payout;
  r.wxHeld = res(run, "wxHeld") + 1;
  r.wxEarned = res(run, "wxEarned") + payout;
  if (isHand) r.knowhow = res(run, "knowhow") + W.heldKnowhow;
}

/** Moves the storm power that is still flowing in to the grid. */
function flowSurge(run: RunState, dt: number): void {
  const r = run.resources;
  const pending = res(run, "wxPending");
  if (pending <= 0) return;
  const flow = Math.min(pending, res(run, "wxSurgeRate") * dt);
  r.wxPending = pending - flow;
  r.power = res(run, "power") + flow;
}

/** Crews get ready and fix outages; dark towns come back on their own. */
function workCrews(run: RunState, dt: number): void {
  const r = run.resources;
  for (const town of TOWN_INDEXES) {
    const out = outageLeft(run, town);
    if (out > 0) {
      const pace = hasCrew(run, town) ? W.outageSeconds / fixSeconds(run) : 1;
      const left = Math.max(0, out - pace * dt);
      r[`wxOut${town}`] = left;
      if (left <= 0 && hasCrew(run, town)) {
        r.wxFixes = res(run, "wxFixes") + 1;
        r.knowhow = res(run, "knowhow") + W.fixKnowhow;
      }
      continue;
    }
    // A town nobody is watching starts over: a crew that comes back gets ready afresh.
    r[`wxReady${town}`] = hasCrew(run, town)
      ? Math.min(1, readiness(run, town) + dt / readySeconds(run))
      : 0;
  }
}

/** Crews on the road get closer to their posts (the grid opens them). */
export function tickCrews(run: RunState, dt: number): void {
  if (run.phase !== 1) return;
  run.resources.wxHitLeft = Math.max(0, res(run, "wxHitLeft") - dt);
  for (const crew of CREW_INDEXES) {
    const left = travelLeft(run, crew);
    if (left > 0) run.resources[`crewTravel${crew}`] = Math.max(0, left - dt);
  }
}

/**
 * Opens the desk (the milestone's purchase calls this, so its story line
 * lands with the purchase itself; the tick is the fallback for old saves).
 */
export function openWeather(run: RunState): void {
  if (run.flags[WEATHER_OPEN_FLAG] === true) return;
  run.flags[WEATHER_OPEN_FLAG] = true;
  run.resources.wxSeed = run.rng ^ SEED_MIX;
  beginForming(run, W.firstFormSeconds);
}

/**
 * A save from before the forecast had steps: a standing forecast with no
 * landing town picks one from its own chances, so it plays on. Its old
 * shields become crews that are ready.
 */
function upgradeOldForecast(run: RunState): void {
  const r = run.resources;
  if (r.wxStage !== 1 || run.flags[STEPS_FLAG] === true) return;
  run.flags[STEPS_FLAG] = true;
  const chances = TOWN_INDEXES.map((t) => chanceOf(run, t));
  TOWN_INDEXES.forEach((town) => {
    r[`wxBase${town}`] = chances[town];
    if (hasCrew(run, town)) r[`wxReady${town}`] = 1;
  });
  r.wxTarget = drawLandfall(chances, draw(run));
  r.wxStep = W.forecastSteps - 1;
  r.wxStageLen = Math.max(stageLength(run), stageSecondsLeft(run));
}

/**
 * Runs the desk for `dt` seconds. `income` is the phase's income per second
 * (read lazily: only a landfall needs it).
 */
export function tickWeather(
  run: RunState,
  dt: number,
  income: () => number
): void {
  if (run.phase !== 1) {
    // A surge still flowing when the night ends finishes paying out, so the
    // tally the player saw is what they got.
    flowSurge(run, dt);
    return;
  }
  const r = run.resources;
  if (!isWeatherOpen(run)) {
    if (owned(run, "gen2") < W.openAtSteamPlants) return;
    openWeather(run);
    return;
  }
  upgradeOldForecast(run);
  flowSurge(run, dt);
  workCrews(run, dt);
  r.wxTimer = res(run, "wxTimer") - dt;
  if (r.wxStage === 1) {
    // The path firms up: the next step's chances, as each step passes.
    const elapsed = stageLength(run) - Math.max(0, r.wxTimer);
    const step = Math.min(
      W.forecastSteps - 1,
      Math.floor(elapsed / W.stepSeconds)
    );
    if (step > res(run, "wxStep")) {
      r.wxStep = step;
      showStep(run);
    }
  }
  if (r.wxTimer > 0) return;
  if (r.wxStage === 1) {
    landfall(run, income());
    beginForming(run, W.formMin + draw(run) * W.formSpread);
  } else {
    beginForecast(run);
  }
}

/**
 * For the simulator's income probes: the same run, but no front ever lands
 * and no surge is pending, so a storm's bonus is not read as income.
 */
export function withoutStorms(run: RunState): RunState {
  run.resources.wxPending = 0;
  run.resources.wxTimer = Number.MAX_SAFE_INTEGER;
  // A dark town is a passing dip, not the grid's income.
  for (const town of TOWN_INDEXES) run.resources[`wxOut${town}`] = 0;
  return run;
}
