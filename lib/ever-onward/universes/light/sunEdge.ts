import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { harborSeed } from "./toll";
import { hasFork } from "./forkState";
import { SKY_DIALS_FLAG, isDialsOpen, openDials, shieldLeak } from "./design";
import { PHASE_SKY } from "./resources";
import { hasProject, tier } from "./tick";
import { TUNING } from "./tuning";

/**
 * The sun's edge: how close the fleet flies. Closer gathers much more light
 * (the collectors and every star taken pay more), and the sun's flares reach
 * it harder: a flare burns a share of the fleet, less where it is far and
 * less with shields. The fleet glides between the steps slowly, so a change
 * of mind is a commitment too.
 *
 * Flares come on their own, from their own random stream (fixed from the
 * run's start seed, so nothing the player does moves them). Each has a size,
 * small, medium or big, and is forecast a little ahead, vaguely: the forecast
 * has the size right about six times in ten, and the sun charts make it
 * surer. What a flare costs is the share of the fleet it burns, and that is
 * what shows in the picture.
 */

const D = TUNING.dials;
const SEED_MIX = 0x2b7c9d11;

export const SIZE_NAMES = ["small", "medium", "big"] as const;

export const DISTANCES = [
  { label: "Far", note: "Far from the sun" },
  { label: "Safe", note: "A safe distance" },
  { label: "Near", note: "Near the sun" },
  { label: "Close", note: "Close to the sun" },
  { label: "Brushing", note: "Brushing the sun" },
] as const;

export const distanceActionId = (step: number): string => `sun-dist-${step}`;
export const DISTANCE_ACTION_IDS: readonly string[] = DISTANCES.map((_, i) =>
  distanceActionId(i)
);

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));
const LAST = DISTANCES.length - 1;

/** The step the fleet is heading for (a save from before it reads the start). */
export function distanceTarget(run: RunState): number {
  const raw = run.resources.skDist;
  return typeof raw === "number" && Number.isFinite(raw)
    ? clamp(Math.round(raw), 0, LAST)
    : D.startDistance;
}

/** Where the fleet is now, 0..4 (it glides toward the chosen step). */
export function distanceNow(run: RunState): number {
  const raw = run.resources.skDistNow;
  return typeof raw === "number" && Number.isFinite(raw)
    ? clamp(raw, 0, LAST)
    : distanceTarget(run);
}

const between = (table: readonly number[], at: number): number => {
  const low = Math.floor(at);
  const high = Math.min(table.length - 1, low + 1);
  return table[low] + (table[high] - table[low]) * (at - low);
};

/** How much light the fleet gathers where it flies (1 at the starting step). */
export const lightMult = (run: RunState): number =>
  isDialsOpen(run)
    ? between(D.light, distanceNow(run))
    : D.light[D.startDistance];

/** How hot it is where the fleet flies: the share of a flare that reaches it. */
export const heatNow = (run: RunState): number =>
  isDialsOpen(run) ? between(D.heat, distanceNow(run)) : 0;

/** True while the fleet is on its way to another step. */
export const isGliding = (run: RunState): boolean =>
  Math.abs(distanceNow(run) - distanceTarget(run)) > 0.02;

/** Flares burn more of a swarm and less of a fleet under big mirrors. */
const flareFactor = (run: RunState): number =>
  (hasFork(run, "swarm")
    ? TUNING.fork.sky.swarmFlare
    : hasFork(run, "mirrors")
      ? TUNING.fork.sky.mirrorsFlare
      : 1) *
  (hasProject(run, "mirror-polish") ? TUNING.projects.sky.polishFlare : 1);

/** The share of the fleet a flare of `size` would burn right now (0..0.95). */
export const burnShare = (run: RunState, size: number): number =>
  Math.min(
    0.95,
    D.flareBurn[clamp(Math.round(size), 0, 2)] *
      heatNow(run) *
      shieldLeak(run) *
      flareFactor(run)
  );

/** The same, with no shields at all (what the shields saved is the difference). */
const bareBurn = (run: RunState, size: number): number =>
  Math.min(
    0.95,
    D.flareBurn[clamp(Math.round(size), 0, 2)] * heatNow(run) * flareFactor(run)
  );

/** Seconds ahead the forecast shows (flare watchers: sooner). */
export const forecastLead = (run: RunState): number =>
  D.moods[sunMood(run)].lead +
  (hasProject(run, "flare-watch") ? D.watchLead : 0);

/** The chance a forecast has the size right. */
export const forecastSure = (run: RunState): number =>
  tier(run, "nav") >= 1 ? D.forecastSureCharts : D.forecastSure;

export const flaresSoFar = (run: RunState): number => res(run, "skFlares");

/** Seconds to the next flare. */
export const secondsToFlare = (run: RunState): number =>
  Math.max(0, res(run, "skFlareIn"));

/** The size the forecast shows (0 small .. 2 big), or null when none is shown yet. */
export function forecastSize(run: RunState): number | null {
  if (!isDialsOpen(run) || res(run, "skFlareIn") <= 0) return null;
  if (secondsToFlare(run) > forecastLead(run)) return null;
  return clamp(Math.round(res(run, "skFlareFore")), 0, 2);
}

/** The flare that has just hit: its size 0..2, or null once the moment is over. */
export const hitSize = (run: RunState): number | null =>
  res(run, "skHitLeft") > 0
    ? clamp(Math.round(res(run, "skHitSize")), 0, 2)
    : null;

export const isFlareMoment = (run: RunState): boolean =>
  res(run, "skHitLeft") > 0;

/** What the last flare burned and what the shields saved, as shares of the fleet (0..1). */
export const lastBurn = (run: RunState): number => res(run, "skHitLost");
export const lastSaved = (run: RunState): number => res(run, "skHitSaved");

// ------------------------------------------------------------ the stream

/** The flare stream's own random numbers (never the player's taps). */
function draw(run: RunState): number {
  const r = run.resources;
  if (!r.skSeed)
    r.skSeed = harborSeed(((r.nightSeed ?? 0) || run.rng) ^ SEED_MIX);
  const stream = { rng: r.skSeed | 0 };
  const value = nextRandom(stream);
  r.skSeed = stream.rng;
  return value;
}

/** The sun's mood now (0 quiet, 1 usual, 2 restless); a save from before reads "usual". */
export function sunMood(run: RunState): number {
  const raw = run.resources.skMood;
  return typeof raw === "number" &&
    Number.isFinite(raw) &&
    run.flags[SKY_DIALS_FLAG]
    ? clamp(Math.round(raw), 0, D.moods.length - 1)
    : D.startMood;
}

export const moodName = (run: RunState): string => D.moods[sunMood(run)].name;

function pickSize(run: RunState, roll: number): number {
  const odds = D.moods[sunMood(run)].odds;
  let sum = 0;
  for (let size = 0; size < odds.length; size += 1) {
    sum += odds[size];
    if (roll < sum) return size;
  }
  return odds.length - 1;
}

/** Plans the next flare: when, how big, and what the forecast will say. */
function planFlare(run: RunState, wait: number): void {
  const r = run.resources;
  const size = pickSize(run, draw(run));
  const sureRoll = draw(run);
  const otherRoll = draw(run);
  const wrong = [0, 1, 2].filter((s) => s !== size);
  r.skFlareSize = size;
  // The forecast is settled now, so reading it twice never changes it. A
  // wrong one is always one of the other sizes; whether it is right is
  // decided against the chance the sun charts give, at the time it shows.
  r.skFlareFore = size;
  r.skFlareWrong = wrong[otherRoll < 0.5 ? 0 : 1];
  r.skFlareSureRoll = sureRoll;
  r.skFlareIn = wait;
}

function nextWait(run: RunState): number {
  const mood = D.moods[sunMood(run)];
  return mood.gapMin + draw(run) * mood.gapSpread;
}

/** The sun settles into another mood (never the one it had). */
function changeMood(run: RunState): void {
  const r = run.resources;
  const others = D.moods.map((_, i) => i).filter((i) => i !== sunMood(run));
  r.skMood = others[Math.floor(draw(run) * others.length)] ?? D.startMood;
  r.skMoodLeft = D.moodMin + draw(run) * D.moodSpread;
  r.skMoods = res(run, "skMoods") + 1;
}

/** Lets the forecast's chance change with the charts (read when it shows). */
function foreRead(run: RunState): number {
  return res(run, "skFlareSureRoll") < forecastSure(run)
    ? res(run, "skFlareSize")
    : res(run, "skFlareWrong");
}

/** Opens the sun's edge: the first flare is planned. */
function openSunEdge(run: RunState): void {
  const r = run.resources;
  r.skDist = D.startDistance;
  r.skDistNow = D.startDistance;
  r.skMood = D.startMood;
  r.skMoodLeft = D.moodMin + draw(run) * D.moodSpread;
  planFlare(run, TUNING.sky.flareFirst);
}

/** Opens the design and the sun's edge together (the first probe does this). */
export function openSkyDials(run: RunState): void {
  if (isDialsOpen(run) || run.flags[SKY_DIALS_FLAG] === true) return;
  openDials(run);
  openSunEdge(run);
}

/** Sets the step the fleet flies to. */
export function setDistance(run: RunState, step: number): void {
  if (!isDialsOpen(run)) return;
  const next = clamp(Math.round(step), 0, LAST);
  if (next === distanceTarget(run)) return;
  run.resources.skDist = next;
  run.resources.skDistChanges = res(run, "skDistChanges") + 1;
}

/**
 * Moves the fleet toward its step, counts down to the flare and, when it
 * comes, burns its share of the fleet. `onWeathered` is called when a flare
 * burned under a quarter of the fleet.
 */
export function tickSunEdge(
  run: RunState,
  dt: number,
  onWeathered: () => void
): void {
  if (!isDialsOpen(run)) return;
  const r = run.resources;
  const reach = dt / D.distanceStepSeconds;
  const now = distanceNow(run);
  const want = distanceTarget(run);
  r.skDistNow = now + clamp(want - now, -reach, reach);
  r.skHitLeft = Math.max(0, res(run, "skHitLeft") - dt);
  r.skMoodLeft = res(run, "skMoodLeft") - dt;
  if (r.skMoodLeft <= 0) changeMood(run);
  if (res(run, "skFlareIn") <= 0) {
    openSunEdgeIfMissing(run);
    return;
  }
  r.skFlareIn -= dt;
  r.skFlareFore = foreRead(run);
  if (r.skFlareIn > 0) return;
  burn(run, onWeathered);
}

function openSunEdgeIfMissing(run: RunState): void {
  planFlare(run, nextWait(run));
}

function burn(run: RunState, onWeathered: () => void): void {
  const r = run.resources;
  const size = Math.round(res(run, "skFlareSize"));
  const share = burnShare(run, size);
  const bare = bareBurn(run, size);
  const tame = res(run, "probes");
  if (tame > 1) {
    r.probes = Math.max(1, tame * (1 - share));
  }
  r.skHitSize = size;
  r.skHitLost = share;
  r.skHitSaved = Math.max(0, bare - share);
  r.skHitLeft = D.hitSeconds;
  r.skFlares = res(run, "skFlares") + 1;
  if (share < 0.25) onWeathered();
  planFlare(run, nextWait(run));
}

/** One button per step; the sun's edge panel draws them itself. */
export const DISTANCE_ACTIONS: readonly ActionDef[] = DISTANCES.map(
  (step, i) => ({
    id: distanceActionId(i),
    phases: [PHASE_SKY],
    isInline: true,
    visibleWhen: (run) => isDialsOpen(run),
    describe: (run) => ({
      label: step.label,
      detail: step.note,
      isBlocked: distanceTarget(run) === i,
    }),
    perform: (run) => setDistance(run, i),
  })
);

/**
 * For the simulator's income probes: the same run, but no flare comes in the
 * next stretch, so a probe of the income never sees a fleet burned.
 */
export function withoutFlares(run: RunState): RunState {
  run.resources.skFlareIn = 1e9;
  return run;
}

/**
 * How safe the fleet is from a usual flare where it flies, with the shields
 * it has, 0..1: what the HUD watches (low when it flies close and thin on
 * shields, so a flare would burn a lot of it).
 */
export const flareSafety = (run: RunState): number => 1 - burnShare(run, 1);

/** Seconds a sky shout holds pop-ups back (its first moments only, never the whole stretch). */
const BUSY_SECONDS = 4;

/**
 * True while a shout (a flare, probes going wild, the wild ones home) is in
 * its first few seconds: a story card must not cover it.
 */
export const isSkyMomentBusy = (run: RunState): boolean =>
  run.phase === 2 &&
  (res(run, "skHitLeft") > D.hitSeconds - BUSY_SECONDS ||
    res(run, "skWildLeft") > D.wildBannerSeconds - BUSY_SECONDS ||
    res(run, "skHomeLeft") > D.homeBannerSeconds - BUSY_SECONDS);
