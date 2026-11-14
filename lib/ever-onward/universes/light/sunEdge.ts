import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { harborSeed } from "./toll";
import { hasFork } from "./forkState";
import {
  SKY_DIALS_FLAG,
  holdMoment,
  isDialsOpen,
  openDials,
  shieldLeak,
} from "./design";
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

/**
 * How much of its light the fleet is not gathering right now, 0..1: a flare
 * dazzles the collectors for a little (the bigger it burned, the more) and
 * they come back by themselves.
 */
export const dazzle = (run: RunState): number =>
  clamp(res(run, "skDazzle"), 0, 1);

/** How much light the fleet gathers where it flies (1 at the starting step). */
export const lightMult = (run: RunState): number =>
  isDialsOpen(run)
    ? between(D.light, distanceNow(run)) * (1 - dazzle(run))
    : D.light[D.startDistance];

/**
 * How hot it is where the fleet flies: the share of a flare that reaches it.
 * A restless sun throws its flares wide, so even the far edge is not safe
 * from them (and a quiet sun's reach is short).
 */
export const heatNow = (run: RunState): number => {
  if (!isDialsOpen(run)) return 0;
  const mood = D.moods[sunMood(run)];
  return between(D.heat, distanceNow(run)) * mood.reach + mood.stray;
};

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
  (hasProject(run, "mirror-polish") && res(run, "skGrandPolish") <= 0
    ? TUNING.projects.sky.polishFlare
    : 1);

/**
 * What a flare would burn before the cap: its size, how hot it is where the
 * fleet flies and what the shields leave of it.
 */
const rawBurn = (run: RunState, size: number, leak: number): number =>
  D.flareBurn[clamp(Math.round(size), 0, 2)] *
  heatNow(run) *
  leak *
  flareFactor(run);

/**
 * A flare never takes the whole fleet: the burn bends toward `burnCap` as it
 * grows (a shield still helps all the way up), so even the worst flare at the
 * hottest edge leaves the fleet something to grow back from.
 */
const capped = (raw: number): number =>
  D.burnCap * (1 - Math.exp(-raw / D.burnCap));

/** The share of the fleet a flare of `size` would burn right now (under `burnCap`). */
export const burnShare = (run: RunState, size: number): number =>
  capped(rawBurn(run, size, shieldLeak(run)));

/** The same, with no shields at all (what the shields saved is the difference). */
const bareBurn = (run: RunState, size: number): number =>
  capped(rawBurn(run, size, 1));

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
  // From a seed fixed at the run's start, never run.rng (that moves with taps).
  if (!r.skSeed)
    r.skSeed = harborSeed(
      ((r.nightSeed ?? 0) || (r.hbSeed ?? 0) || SEED_MIX) ^ SEED_MIX
    );
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

/** Plans the next flare: when, how big, and what its forecast will say. */
function planFlare(run: RunState, wait: number): void {
  const r = run.resources;
  const size = pickSize(run, draw(run));
  const sureRoll = draw(run);
  const otherRoll = draw(run);
  const wrong = [0, 1, 2].filter((s) => s !== size);
  r.skFlareSize = size;
  // The forecast is settled now with the charts the fleet has now, so reading
  // it twice, or buying charts while it counts down, never changes it. A wrong
  // one is always one of the other sizes.
  r.skFlareFore =
    sureRoll < forecastSure(run) ? size : wrong[otherRoll < 0.5 ? 0 : 1];
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
  // A flare already on its way is re-planned for the new mood (a big one
  // planned while restless does not land on a quiet sun), and no sooner
  // than the new mood's own gaps allow it later than they would.
  const waiting = res(run, "skFlareIn");
  if (waiting > 0) {
    const mood = D.moods[sunMood(run)];
    planFlare(run, Math.min(waiting, mood.gapMin + mood.gapSpread));
  }
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
  r.skBusy = Math.max(0, res(run, "skBusy") - dt);
  r.skDazzle = Math.max(
    0,
    res(run, "skDazzle") - (D.dazzleMax * dt) / D.dazzleSeconds
  );
  mend(run, dt);
  r.skMoodLeft = res(run, "skMoodLeft") - dt;
  if (r.skMoodLeft <= 0) changeMood(run);
  if (res(run, "skFlareIn") <= 0) {
    openSunEdgeIfMissing(run);
    return;
  }
  r.skFlareIn -= dt;
  if (r.skFlareIn > 0) return;
  burn(run, onWeathered);
}

/** Burned probes that are mended fly back into the fleet. */
function mend(run: RunState, dt: number): void {
  const waiting = res(run, "skRepair");
  if (waiting <= 0) return;
  const back = waiting * Math.min(1, dt / D.repairSeconds);
  run.resources.skRepair = waiting - back;
  run.resources.probes = res(run, "probes") + back;
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
    const lost = Math.min(tame - 1, tame * share);
    r.probes = tame - lost;
    // Most of what burned is mended and flies again, a few at a time.
    r.skRepair = res(run, "skRepair") + lost * D.repairShare;
  }
  // The wild ones fly in the same sun: a flare burns them too.
  const wild = res(run, "skWild");
  if (wild > 0) r.skWild = wild * (1 - share);
  r.skHitSize = size;
  r.skHitLost = share;
  r.skHitSaved = Math.max(0, bare - share);
  r.skDazzle = Math.max(
    res(run, "skDazzle"),
    Math.min(D.dazzleMax, share * D.dazzleHit)
  );
  r.skHitLeft = D.hitSeconds;
  holdMoment(run, D.hitSeconds);
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
 * shields, so a flare would burn about as much of it as any flare can).
 */
export const flareSafety = (run: RunState): number =>
  1 - burnShare(run, 1) / D.burnCap;

/**
 * True while a shout (a flare, probes going wild, the wild ones home) is on
 * in the picture and for a couple of seconds after it: a story card must
 * not cover it, so it waits until the banner has gone.
 */
export const isSkyMomentBusy = (run: RunState): boolean =>
  run.phase === 2 && res(run, "skBusy") > 0;
