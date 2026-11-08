import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { FULL_GROWTH, PHASE_SEED } from "./resources";
import { seedSunMult } from "./forks";
import { TUNING } from "./tuning";

/**
 * The old window box: the last seed, and the one small pot on its sill.
 * One quiet choice: how much sun the pot gets. More sun grows it faster and
 * dries the soil; shade is slow and keeps it moist. Nobody tells you which
 * is right. The leaves do: perky when the soil is just right, curling when
 * it is dry, drooping when it is soggy. The sky changes how much sun is
 * right (rain, cloud, bright, a hot spell), so the dial is never set for
 * good. The blind takes a few seconds to move. A pot that dries or soaks is
 * slow, never lost: it perks back up when you ease off.
 *
 * The sky comes from a random stream of the pot's own (`run.rng` is never
 * touched). All state lives in hidden `run.resources`; a save from before
 * the dial simply starts the pot in the middle.
 */

const B = TUNING.windowbox;

export const LANTERN_ID = "window-lantern";
export const DEEP_POT_ID = "deep-pot";

export const SUN_ACTION_ID = "windowbox-sun";
export const SHADE_ACTION_ID = "windowbox-shade";
export const WINDOWBOX_ACTION_IDS: readonly string[] = [
  SUN_ACTION_ID,
  SHADE_ACTION_ID,
];

export type PotStage = "soil" | "sprout" | "bud" | "bloom";
export const POT_STAGES: readonly PotStage[] = [
  "soil",
  "sprout",
  "bud",
  "bloom",
];

export type LeafMood = "perky" | "curl" | "dry" | "droop" | "soggy";
export const LEAF_MOODS: readonly LeafMood[] = [
  "perky",
  "curl",
  "dry",
  "droop",
  "soggy",
];

export type SkyId = "rain" | "cloud" | "bright" | "heat";
export type PotMoment = "" | "thrive" | "dry" | "soggy";

/** The last place the blind can be: wide open. */
export const MAX_AIM = B.steps - 1;

/** Mixed into the run's seed so the sky has a stream of its own. */
const SEED_MIX = 0x70b0c5;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

/** How much of the pot is grown, 0 to 1. */
export const potGrowth = (run: RunState): number =>
  clamp(res(run, "growth") / FULL_GROWTH, 0, 1);

export function potStage(run: RunState): PotStage {
  const g = potGrowth(run);
  if (g >= 1) return "bloom";
  if (g >= B.budAt) return "bud";
  if (g >= B.sproutAt) return "sprout";
  return "soil";
}

/** True once the pot is fully grown: the milestone that brings a visitor. */
export const isSeedBloomed = (run: RunState): boolean => potGrowth(run) >= 1;

/** Keeps the hidden stage counter in step (the bloom sound reads it). */
export function syncPotStage(run: RunState): void {
  const index = POT_STAGES.indexOf(potStage(run));
  if (index > res(run, "potStage")) run.resources.potStage = index;
}

export const isWindowBoxOpen = (run: RunState): boolean =>
  run.phase === 3 && !run.complete;

const isReady = (run: RunState): boolean => res(run, "wbReady") === 1;

/** Where the blind is aimed: 0 drawn shut to MAX_AIM wide open. */
export const aimOf = (run: RunState): number =>
  isReady(run) ? Math.round(res(run, "wbAim")) : B.startAim;

/** How much light the window lets in right now, 0 to 1 (it moves slowly). */
export const lightOf = (run: RunState): number =>
  isReady(run) ? clamp(res(run, "wbLight"), 0, 1) : B.startAim / MAX_AIM;

/** True while the blind is still moving toward where it is aimed. */
export const isBlindMoving = (run: RunState): boolean =>
  Math.abs(lightOf(run) - aimOf(run) / MAX_AIM) > 0.001;

/** How wet the soil is, 0 to 1. The player never sees this number. */
export const moistOf = (run: RunState): number =>
  isReady(run) ? clamp(res(run, "wbMoist"), 0, 1) : B.startMoist;

export const skyOf = (run: RunState): (typeof B.skies)[number] =>
  B.skies[isReady(run) ? Math.round(res(run, "wbSky")) % B.skies.length : 1];

/** The sun that actually reaches the pot: the light through the window. */
export const sunOnPot = (run: RunState): number =>
  lightOf(run) * skyOf(run).sun;

/** How fast the soil changes: each deeper pot slows it down. */
export const soilRate = (run: RunState): number =>
  B.deepPer ** owned(run, DEEP_POT_ID);

/** The soil's effect on growth: 1 until the leaves go crisp or floppy. */
export function moistTerm(moist: number): number {
  if (moist >= B.dryBelow && moist <= B.soggyAbove) return 1;
  const edge =
    moist < B.dryBelow ? moist / B.dryBelow : (1 - moist) / (1 - B.soggyAbove);
  return B.moistFloor + (1 - B.moistFloor) * clamp(edge, 0, 1);
}

/** The sun's effect on growth: more sun is faster, up to a point. */
export const sunTerm = (sun: number): number =>
  B.sunFloor + (1 - B.sunFloor) * Math.min(1, sun / B.sunFull);

/** How fast the pot grows, as a share of the care it earns. */
export const paceOf = (run: RunState): number =>
  B.paceMin +
  (B.paceMax - B.paceMin) * sunTerm(sunOnPot(run)) * moistTerm(moistOf(run));

/** What the leaves look like now: the one thing the player reads. */
export function leafOf(run: RunState): LeafMood {
  const m = moistOf(run);
  if (m < B.dryBelow) return "dry";
  if (m < B.curlBelow) return "curl";
  if (m > B.soggyAbove) return "soggy";
  if (m > B.droopAbove) return "droop";
  return "perky";
}

/** How long the leaves have looked the way they do (run seconds). */
export const leafSeconds = (run: RunState): number =>
  Math.max(0, run.time - res(run, "wbLeafAt"));

/** Seconds after the sky changes that the pot asks for a look at the window. */
const NEW_SKY_LOOK_SECONDS = 45;

/**
 * True when the pot wants a look: the leaves are anything but perky, or the
 * weather has just turned (so the sun that was right may not be any more).
 */
export const needsLook = (run: RunState): boolean =>
  isWindowBoxOpen(run) &&
  !isSeedBloomed(run) &&
  (leafOf(run) !== "perky" ||
    (skiesSoFar(run) > 0 && res(run, "wbSkyTime") < NEW_SKY_LOOK_SECONDS));

/** What the scene is celebrating (or mourning, gently) right now. */
export function momentOf(run: RunState): PotMoment {
  const wilt = res(run, "wbWiltAt");
  const thrive = res(run, "wbThriveAt");
  const latest = Math.max(wilt, thrive);
  if (latest <= 0 || run.time - latest > B.momentSeconds) return "";
  if (latest === thrive) return "thrive";
  return res(run, "wbWiltKind") === 1 ? "soggy" : "dry";
}

export const thrivesSoFar = (run: RunState): number =>
  Math.round(res(run, "wbThrives"));
export const wiltsSoFar = (run: RunState): number =>
  Math.round(res(run, "wbWilts"));
/** Times the sky has changed (a clock that keeps its own time). */
export const skiesSoFar = (run: RunState): number =>
  Math.round(res(run, "wbSkies"));
/** Times the blind has been moved. */
export const movesSoFar = (run: RunState): number =>
  Math.round(res(run, "wbMoves"));

/** Care earned in the seed phase grows the pot, at the pot's pace. */
export function addCare(run: RunState, amount: number): void {
  run.resources.care = res(run, "care") + amount;
  run.resources.growth = Math.min(
    FULL_GROWTH,
    res(run, "growth") +
      amount *
        B.growthPerCare *
        (1 + B.lanternBoost * owned(run, LANTERN_ID)) *
        paceOf(run)
  );
  syncPotStage(run);
}

/** Moves the blind one place (+1 more sun, -1 more shade). */
export function moveBlind(run: RunState, direction: 1 | -1): void {
  if (!isWindowBoxOpen(run)) return;
  ensureReady(run);
  const next = clamp(aimOf(run) + direction, 0, MAX_AIM);
  if (next === aimOf(run)) return;
  run.resources.wbAim = next;
  run.resources.wbMoves = movesSoFar(run) + 1;
}

export const canMoveBlind = (run: RunState, direction: 1 | -1): boolean =>
  isWindowBoxOpen(run) &&
  !isSeedBloomed(run) &&
  clamp(aimOf(run) + direction, 0, MAX_AIM) !== aimOf(run);

/** Draws the next sky from the pot's own stream (never the same one twice). */
function nextSky(run: RunState): void {
  const r = run.resources;
  const stream = { rng: res(run, "wbRng") | 0 };
  const last = Math.round(res(run, "wbSky"));
  let pick = Math.floor(nextRandom(stream) * B.skies.length) % B.skies.length;
  if (pick === last) pick = (pick + 1) % B.skies.length;
  const length = B.skyMin + nextRandom(stream) * B.skySpan;
  r.wbRng = stream.rng;
  r.wbSky = pick;
  r.wbSkyTime = 0;
  r.wbSkyLen = length;
  r.wbSkies = skiesSoFar(run) + 1;
}

/** Sets the pot up in the middle, leaving its growth alone. */
function ensureReady(run: RunState): void {
  if (isReady(run)) return;
  const r = run.resources;
  r.wbReady = 1;
  r.wbAim = B.startAim;
  r.wbLight = B.startAim / MAX_AIM;
  r.wbMoist = B.startMoist;
  r.wbRng = (run.rng ^ SEED_MIX) | 0;
  r.wbSky = 1;
  r.wbSkyTime = 0;
  r.wbSkyLen = B.skyMin + B.skySpan / 2;
  r.wbGood = 0;
  r.wbLeaf = 0;
  r.wbLeafAt = run.time;
}

/** Gives the pot a quiet start (the seed phase calls it). */
export function openWindowBox(run: RunState): void {
  run.resources.wbReady = 0;
  run.resources.growth = 0;
  run.resources.potStage = 0;
  ensureReady(run);
}

/** Runs the window box for `dt` seconds. */
export function tickWindowBox(run: RunState, dt: number): void {
  if (!isWindowBoxOpen(run)) return;
  ensureReady(run);
  const r = run.resources;

  // The blind slides toward where it is aimed.
  const target = aimOf(run) / MAX_AIM;
  const reach = dt / (B.moveSeconds * MAX_AIM);
  r.wbLight = lightOf(run) + clamp(target - lightOf(run), -reach, reach);

  // The sky changes now and then, so the right amount of sun changes too.
  r.wbSkyTime = res(run, "wbSkyTime") + dt;
  if (r.wbSkyTime >= res(run, "wbSkyLen")) nextSky(run);

  // The sun dries the soil, the air wets it.
  r.wbMoist = clamp(
    moistOf(run) +
      (skyOf(run).wet - B.evap * sunOnPot(run)) * soilRate(run) * dt,
    0,
    1
  );
  if (isSeedBloomed(run)) return;

  // The pot grows a little from the light itself, at its pace.
  r.growth = Math.min(
    FULL_GROWTH,
    res(run, "growth") + B.lightGrowth * seedSunMult(run) * paceOf(run) * dt
  );
  syncPotStage(run);

  // What the leaves show, and the big moments when it goes well or badly.
  const mood = leafOf(run);
  const seen = LEAF_MOODS[Math.round(res(run, "wbLeaf"))] ?? "perky";
  if (mood !== seen) {
    r.wbLeaf = LEAF_MOODS.indexOf(mood);
    r.wbLeafAt = run.time;
    if (mood === "dry" || mood === "soggy") {
      r.wbWiltAt = run.time;
      r.wbWiltKind = mood === "soggy" ? 1 : 0;
      r.wbWilts = wiltsSoFar(run) + 1;
    }
  }
  const isGood = mood === "perky" && sunTerm(sunOnPot(run)) >= B.thriveSun;
  r.wbGood = isGood ? res(run, "wbGood") + dt : Math.min(0, res(run, "wbGood"));
  if (r.wbGood >= B.thriveAfter) {
    r.wbThriveAt = run.time;
    r.wbThrives = thrivesSoFar(run) + 1;
    r.wbGood = -B.thriveRest;
  }
}

/** The sky in plain words. */
export const SKY_WORDS: Record<SkyId, string> = {
  rain: "Rainy",
  cloud: "Cloudy",
  bright: "Bright and sunny",
  heat: "A hot spell",
};

/** What the leaves look like, in plain words. */
export const LEAF_WORDS: Record<LeafMood, string> = {
  perky: "Perky and green",
  curl: "Curling at the edges",
  dry: "Crisp and brown",
  droop: "Drooping",
  soggy: "Floppy and pale",
};

/** The line under the pot: how the leaves look, or the last big moment. */
export function windowBoxLine(run: RunState): string {
  if (isSeedBloomed(run))
    return "The flower is open. Someone is coming up the stairs.";
  const moment = momentOf(run);
  if (moment === "thrive")
    return "The pot is thriving! The leaves are shining.";
  if (moment === "dry")
    return "The soil dried right out and the leaves went crisp. Ease off the sun and they will perk up again.";
  if (moment === "soggy")
    return "The soil got soggy and the leaves went floppy. Let in more sun and they will perk up again.";
  if (potStage(run) === "soil")
    return "Just soil, and a seed that is thinking about it. The soil is the thing to watch.";
  return `The leaves are ${LEAF_WORDS[leafOf(run)].toLowerCase()}.`;
}

// --------------------------------------------------------------- the log

/** Count of things that go in the log (thrives and wilts). */
export const windowBoxEvents = (run: RunState): number =>
  thrivesSoFar(run) + wiltsSoFar(run);

export function windowBoxResultLine(run: RunState): string | null {
  const wilt = res(run, "wbWiltAt");
  const thrive = res(run, "wbThriveAt");
  if (wilt <= 0 && thrive <= 0) return null;
  if (thrive >= wilt)
    return "The pot thrived! Sun and water were just right, and it shot up.";
  return res(run, "wbWiltKind") === 1
    ? "The pot got soggy and drooped. A little more sun and it will perk up."
    : "The pot dried out and curled. A little shade and it will perk up.";
}

// ------------------------------------------------------------- the dial

const STEP_WORDS = ["Blind drawn", "Half open", "Wide open"];
export const aimWords = (run: RunState): string => STEP_WORDS[aimOf(run)];

/** One button per way to turn the dial; the window box panel draws them. */
export const BLIND_ACTIONS: readonly ActionDef[] = [
  {
    id: SUN_ACTION_ID,
    direction: 1,
    label: "More sun",
    detail: "+ Grows faster. − Dries the soil out.",
  },
  {
    id: SHADE_ACTION_ID,
    direction: -1,
    label: "More shade",
    detail: "+ Keeps the soil moist. − Grows slower.",
  },
].map(({ id, direction, label, detail }): ActionDef => ({
  id,
  phases: [PHASE_SEED],
  isInline: true,
  visibleWhen: isWindowBoxOpen,
  describe: (run: RunState) => ({
    label,
    detail,
    isBlocked: !canMoveBlind(run, direction as 1 | -1),
  }),
  perform: (run: RunState) => moveBlind(run, direction as 1 | -1),
}));
