import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import { REMOVED_LAST_COSTS, REMOVED_LAST_SCALE } from "./costs";
import { hasFork } from "./forkState";
import { PHASE_LAST, TOTAL_LIGHTS } from "./resources";
import { harborSeed } from "./toll";
import { TUNING } from "./tuning";

/**
 * Warmth: the one quiet choice of The Last Light.
 *
 * Eleven remembered lights still burn, and every one costs warmth each
 * second. Warmth is what guides the boat home, so a crowd of lights leaves
 * the boat in fog and a bare shore leaves nothing to remember. Each light
 * keeps you company (a trickle of resolve while it burns, less when the flame
 * is cold); letting one go pays a lump of resolve (more when the flame is
 * warm, less when it is cold) and a flower blooms where it stood. The player picks which light goes and when; the lights,
 * their costs and the cold winds differ from run to run, because every
 * number is moved a little by the run's own seed.
 *
 * Everything here is plain arithmetic on the engine's `dt`. The only random
 * numbers (each light's spread, the cold winds) come from streams fixed from
 * the run's start seed, so nothing the player does moves them. All state is
 * in `run.resources` (hidden numbers) and `run.owned` (`letgo-*` is a light
 * that has gone), so a save from before reads as it always did.
 */

const L = TUNING.last;
const FK = TUNING.fork.last;
const SEED_MIX = 0x6d2b79f5;
const CHILL_MIX = 0x51ed270b;

/** One remembered light: its words, and the flower it leaves. */
export interface LightDef {
  id: string;
  name: string;
  /** The card's line. */
  text: string;
  /** What the flower is called, and its petal colour and heart. */
  flower: string;
  petal: string;
  heart: string;
}

export const LIGHTS: readonly LightDef[] = [
  {
    id: "letgo-porch",
    name: "Porch lights",
    text: "Every porch light that ever waited for someone to come home.",
    flower: "Porch lights",
    petal: "#fbbf24",
    heart: "#fef3c7",
  },
  {
    id: "letgo-signs",
    name: "Shop signs",
    text: "OPEN, OPEN, OPEN. You can rest now.",
    flower: "Shop signs",
    petal: "#fb7185",
    heart: "#ffe4e6",
  },
  {
    id: "letgo-stadium",
    name: "Stadium lights",
    text: "They were loud and bright. They were good at it.",
    flower: "Stadium lights",
    petal: "#38bdf8",
    heart: "#e0f2fe",
  },
  {
    id: "letgo-bridges",
    name: "Bridge lights",
    text: "The bridges hold on without them.",
    flower: "Bridge lights",
    petal: "#a78bfa",
    heart: "#ede9fe",
  },
  {
    id: "letgo-harbor",
    name: "Harbor lamps",
    text: "A row of small lamps, each one a ship's welcome.",
    flower: "Harbor lamps",
    petal: "#2dd4bf",
    heart: "#ccfbf1",
  },
  {
    id: "letgo-towers",
    name: "Tower windows",
    text: "Ten thousand windows, one after another.",
    flower: "Tower windows",
    petal: "#fb923c",
    heart: "#ffedd5",
  },
  {
    id: "letgo-festival",
    name: "Festival lanterns",
    text: "They floated up once a year. That was enough.",
    flower: "Festival lanterns",
    petal: "#f472b6",
    heart: "#fce7f3",
  },
  {
    id: "letgo-fire",
    name: "Campfires",
    text: "Warm, crackly, and good for stories.",
    flower: "Campfires",
    petal: "#f87171",
    heart: "#fee2e2",
  },
  {
    id: "letgo-moon",
    name: "Moon mirror",
    text: "It only ever borrowed the light anyway.",
    flower: "Moon mirror",
    petal: "#c4b5fd",
    heart: "#f5f3ff",
  },
  {
    id: "letgo-sun",
    name: "Sun collectors",
    text: "You built them. You can thank them.",
    flower: "Sun collectors",
    petal: "#facc15",
    heart: "#fef9c3",
  },
  {
    id: "letgo-night",
    name: "Last stars",
    text: "They were never yours. Let them be dim.",
    flower: "Last stars",
    petal: "#93c5fd",
    heart: "#eff6ff",
  },
];

export const LIGHT_COUNT = LIGHTS.length;
/** What the three sizes of cold wind are called. */
export const CHILL_NAMES = ["mild", "chilly", "bitter"] as const;
/** The lights' indexes, for loops. */
const INDEXES: readonly number[] = LIGHTS.map((_, i) => i);

export const letGoActionId = (index: number): string => `let-go-${index}`;
export const LET_GO_ACTION_IDS: readonly string[] = INDEXES.map(letGoActionId);

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
const speed = (run: RunState): number => run.mods.speed ?? 1;

/** Steps of a one-off chain bought so far, in order (`hearth-1`, `hearth-2`...). */
function chainTier(run: RunState, base: string): number {
  let n = 0;
  while (owned(run, `${base}-${n + 1}`) > 0) n += 1;
  return n;
}

// ---------------------------------------------------------------- the lights

/** True while the part is the last one. */
export const isLastPart = (run: RunState): boolean => run.phase === 3;

/** Has this light gone? (`letgo-*` is owned once it is let go; old saves too.) */
export const isLetGo = (run: RunState, index: number): boolean =>
  owned(run, LIGHTS[index].id) > 0;

export const isLit = (run: RunState, index: number): boolean =>
  !isLetGo(run, index);

export const litCount = (run: RunState): number =>
  INDEXES.filter((i) => isLit(run, i)).length;

export const letGoCount = (run: RunState): number =>
  LIGHT_COUNT - litCount(run);

/** Bit i is set once light i has gone. */
export const letGoMask = (run: RunState): number =>
  INDEXES.reduce((mask, i) => (isLetGo(run, i) ? mask | (1 << i) : mask), 0);

/** The names of the flowers that have bloomed, in the order of the lights. */
export const flowerNames = (run: RunState): string[] =>
  INDEXES.filter((i) => isLetGo(run, i)).map((i) => LIGHTS[i].flower);

// ----------------------------------------------------------------- the seed

/** The lights' own stream, fixed from the run's start seed (never the player's taps). */
function worldSeed(run: RunState): number {
  const r = run.resources;
  if (!r.wmSeed)
    r.wmSeed = harborSeed(((r.nightSeed ?? 0) || run.rng) ^ SEED_MIX);
  return r.wmSeed | 0;
}

/** A steady number in 0..1 for light `index` and purpose `k` (the same for the whole run). */
function unit(run: RunState, index: number, k: number): number {
  const stream = { rng: harborSeed(worldSeed(run) + index * 977 + k * 7919) };
  nextRandom(stream);
  return nextRandom(stream);
}

/** A light's number moved by up to `spread` either way for this run. */
const spreadOf = (run: RunState, index: number, k: number): number =>
  1 + L.spread * (2 * unit(run, index, k) - 1);

// ----------------------------------------------------------------- the burn

/** The multiplier on every burn: slow burns, a choice made, an ember. */
export const burnMult = (run: RunState): number =>
  L.slowBurn ** chainTier(run, "slowburn") *
  (hasFork(run, "release")
    ? FK.releaseBurn
    : hasFork(run, "keep")
      ? FK.keepBurn
      : 1) *
  (1 - 0.12 * (run.mods.bright ?? 0));

/** The warmth share light `index` costs each second while it burns, with no wind. */
export const burnOf = (run: RunState, index: number): number =>
  L.lights[index].burn * spreadOf(run, index, 1) * burnMult(run);

/** The multiplier on every light's company: warm company. */
export const companyMult = (run: RunState): number =>
  L.companyMult ** chainTier(run, "company");

/** The hope of the crossing, grown by the songs sung on the way. */
export const songMult = (run: RunState): number =>
  L.songMult ** chainTier(run, "song");

/**
 * How much company the lights keep you in this run, 0.65 to 1.55 times usual:
 * some nights are lonelier than others, and nothing the player does moves it.
 */
export const lonelyScale = (run: RunState): number =>
  1 - L.lonely + 2 * L.lonely * unit(run, 99, 5);

const TOP_BURN = Math.max(...L.lights.map((l) => l.burn)) * (1 + L.spread);
const TOP_COMPANY =
  Math.max(...L.lights.map((l) => l.company)) * (1 + L.spread) * (1 + L.lonely);

/** A share of the top, as 1 to 5 pips for a card (never a number to work out). */
const pipsOf = (value: number, top: number): number =>
  clamp(Math.ceil((value / top) * 5), 1, 5);

/** How heavy light `index` is on the warmth, in 1 to 5 flames. */
export const burnPips = (run: RunState, index: number): number =>
  pipsOf(burnOf(run, index), TOP_BURN);

/** How much company light `index` keeps you, in 1 to 5 hearts. */
export const companyPips = (run: RunState, index: number): number =>
  pipsOf(companyOf(run, index), TOP_COMPANY);

/** The resolve a second light `index` keeps you while it burns, with this run's spread. */
export const companyOf = (run: RunState, index: number): number =>
  L.lights[index].company *
  spreadOf(run, index, 2) *
  lonelyScale(run) *
  companyMult(run);

/** What letting light `index` go is worth in all, in resolve, if the flame were warm. */
export const memoryOf = (run: RunState, index: number): number =>
  L.lights[index].memory * spreadOf(run, index, 3);

// ----------------------------------------------------------------- the wind

/** Which wind is blowing or on the way: 0 mild, 1 chilly, 2 bitter. */
export const chillSize = (run: RunState): number =>
  clamp(Math.round(res(run, "wmChillSize")), 0, L.chill.mult.length - 1);

export const isChillBlowing = (run: RunState): boolean =>
  run.phase === 3 && res(run, "wmChillLeft") > 0;

/** Seconds to the next wind (0 while one blows). */
export const chillIn = (run: RunState): number =>
  isChillBlowing(run) ? 0 : Math.max(0, res(run, "wmChillIn"));

/** Seconds a wind has left to blow. */
export const chillLeft = (run: RunState): number =>
  Math.max(0, res(run, "wmChillLeft"));

/** The size of the wind to come, when it is close enough to be forecast; otherwise null. */
export function chillForecast(run: RunState): number | null {
  if (run.phase !== 3 || isChillBlowing(run)) return null;
  const left = res(run, "wmChillIn");
  return left > 0 && left <= L.chill.lead ? chillSize(run) : null;
}

/** How much a wind of `size` multiplies every burn. */
export const chillBite = (size: number): number =>
  L.chill.mult[clamp(Math.round(size), 0, L.chill.mult.length - 1)];

/** True once the player has cupped their hands round the flame against the wind to come or blowing. */
export const isSheltered = (run: RunState): boolean =>
  run.phase === 3 && res(run, "wmShield") > 0;

/** How much a wind of `size` multiplies every burn for a flame that is sheltered or not. */
export const biteWith = (size: number, isShelter: boolean): number =>
  1 + (chillBite(size) - 1) * (isShelter ? L.chill.shelterBite : 1);

/** How much a wind blowing now multiplies every burn (1 when none). */
export const chillMult = (run: RunState): number =>
  isChillBlowing(run) ? biteWith(chillSize(run), isSheltered(run)) : 1;

/** What cupping your hands round the flame costs: some seconds of the resolve coming in. */
export const shelterCost = (run: RunState): number =>
  Math.max(2, Math.round(resolvePerSecond(run) * L.chill.shelterSeconds));

/** A wind is on the way or blowing, and the flame is not yet cupped. */
export const canShelter = (run: RunState): boolean =>
  run.phase === 3 &&
  !isSheltered(run) &&
  (isChillBlowing(run) || chillForecast(run) !== null) &&
  (run.resources.resolve ?? 0) >= shelterCost(run);

function chillStream<T>(run: RunState, draw: (next: () => number) => T): T {
  const r = run.resources;
  if (!r.wmChillSeed) r.wmChillSeed = harborSeed(worldSeed(run) ^ CHILL_MIX);
  const stream = { rng: r.wmChillSeed | 0 };
  const out = draw(() => nextRandom(stream));
  r.wmChillSeed = stream.rng;
  return out;
}

/** Plans the next wind: its size and when it comes. */
function planChill(run: RunState, wait: number): void {
  const r = run.resources;
  chillStream(run, (next) => {
    const roll = next();
    let sum = 0;
    let size = L.chill.odds.length - 1;
    for (let s = 0; s < L.chill.odds.length; s += 1) {
      sum += L.chill.odds[s];
      if (roll < sum) {
        size = s;
        break;
      }
    }
    r.wmChillSize = size;
    r.wmChillIn = wait + next() * L.chill.gapSpread;
    r.wmShield = 0;
  });
}

// --------------------------------------------------------------- the warmth

/** The warmth, 0..1 (kept in `flame`; a save from before reads its flame). */
export const warmthOf = (run: RunState): number =>
  clamp((run.resources.flame ?? L.startFlame) / L.flameFull, 0, 1);

export const hearthTier = (run: RunState): number => chainTier(run, "hearth");

/** The warmth the hearth gives with no lights burning. */
export const hearthWarmth = (run: RunState): number =>
  L.hearthBase + L.hearthStep * hearthTier(run);

/** The glow of recent taps (0 to `stokeMax`). */
export const stokeOf = (run: RunState): number =>
  clamp(res(run, "wmStoke"), 0, L.stokeMax);

/** The share of a light still burning on the books: a light rising fades out. */
function burnShare(run: RunState, index: number): number {
  if (isLit(run, index)) return 1;
  const rising = Math.round(res(run, "wmRiseIdx")) - 1;
  if (rising !== index) return 0;
  return clamp(res(run, "wmRise") / L.riseSeconds, 0, 1);
}

/** All the warmth the burning lights cost each second, with no wind. */
export const burnTotal = (run: RunState): number =>
  INDEXES.reduce((sum, i) => sum + burnOf(run, i) * burnShare(run, i), 0);

/** Where the warmth is heading right now (0..1): the hearth less the burn, plus the stoke. */
export const warmthTarget = (run: RunState): number =>
  clamp(
    hearthWarmth(run) - burnTotal(run) * chillMult(run) + stokeOf(run),
    L.warmFloor,
    1
  );

/** The boat's pace for a warmth: the floor at the coldest, full at the warmest. */
export const paceAt = (warmth: number): number =>
  L.boatFloor + (1 - L.boatFloor) * clamp(warmth, 0, 1);

/** The boat's own gear: sails, a mast and a lookout make the same warmth go farther. */
export const boatGear = (run: RunState): number =>
  L.sailMult ** chainTier(run, "sail");

export const boatPace = (run: RunState): number =>
  paceAt(warmthOf(run)) * boatGear(run) * speed(run);

export const boatProgressOf = (run: RunState): number =>
  clamp(res(run, "boatProgress"), 0, 100);

export const boatArrived = (run: RunState): boolean =>
  res(run, "boatProgress") >= 100;

/** The boat is out from the first moment of the part. */
export const isBoatOut = (run: RunState): boolean => run.phase === 3;

/** The boat is home and waits for one flash. */
export const isReadyToFlash = (run: RunState): boolean =>
  run.phase === 3 && boatArrived(run) && run.flags.finished !== true;

/** True while the flame is warm enough for the boat to surge. */
export const isSurging = (run: RunState): boolean =>
  run.phase === 3 && warmthOf(run) >= L.surgeAt && !boatArrived(run);

/** The fog, 0..1: nothing above `fogBelow`, thick at the coldest. */
export const fogOf = (run: RunState): number =>
  clamp((L.fogBelow - warmthOf(run)) / (L.fogBelow - L.warmFloor), 0, 1);

// ---------------------------------------------------------------- resolve

/** All the company the burning lights keep you, in resolve a second before the warmth (a light rising fades out). */
export const companyTotal = (run: RunState): number =>
  INDEXES.reduce((sum, i) => sum + companyOf(run, i) * burnShare(run, i), 0);

/** Resolve a second: the lights' company (less when the flame is cold) and the hope of the crossing. */
export function resolvePerSecond(run: RunState): number {
  const warmth = L.coldResolve + (1 - L.coldResolve) * warmthOf(run);
  const company =
    (L.resolvePerSecond * lonelyScale(run) + companyTotal(run)) * warmth;
  // The crossing gives hope too, the more so the faster the boat sails.
  const hope =
    L.hopePerSecond * paceAt(warmthOf(run)) * boatGear(run) * songMult(run);
  return (
    (company + hope) *
    (hasFork(run, "release") ? FK.releaseResolve : 1) *
    speed(run)
  );
}

/** Resolve per tap. */
export const tapResolve = (run: RunState): number =>
  L.resolvePerTap * (hasFork(run, "keep") ? FK.keepTaps : 1);

/** The resolve letting light `index` go would pay right now. */
export function lumpNow(run: RunState, index: number): number {
  if (!isLit(run, index)) return 0;
  const warm = L.lumpCold + (1 - L.lumpCold) * warmthOf(run);
  return memoryOf(run, index) * warm;
}

// ------------------------------------------------------------ letting go

/** Seconds until another light may go (0: ready). */
export const lockLeft = (run: RunState): number =>
  Math.max(0, res(run, "wmLock"));

export const canLetGo = (run: RunState, index: number): boolean =>
  run.phase === 3 && isLit(run, index) && lockLeft(run) <= 0;

/** The light that has just gone, while the goodbye shows (index), or null. */
export function goodbyeIndex(run: RunState): number | null {
  if (res(run, "wmBye") <= 0) return null;
  const index = Math.round(res(run, "wmByeIdx")) - 1;
  return index >= 0 && index < LIGHT_COUNT ? index : null;
}

/** Resolve the last light let go paid. */
export const lastLump = (run: RunState): number => res(run, "wmLastLump");

/** Lets light `index` go: its lump of resolve now, its flower, and a settle before the next. */
export function letGo(run: RunState, index: number): void {
  if (!canLetGo(run, index)) return;
  const r = run.resources;
  const lump = lumpNow(run, index);
  r.resolve = res(run, "resolve") + lump;
  run.owned[LIGHTS[index].id] = 1;
  r.wmLastLump = lump;
  r.wmLock = L.goSeconds;
  r.wmRiseIdx = index + 1;
  r.wmRise = L.riseSeconds;
  r.wmBye = L.goodbyeSeconds;
  r.wmByeIdx = index + 1;
  r.wmLets = res(run, "wmLets") + 1;
  r.lights = Math.max(0, TOTAL_LIGHTS - letGoCount(run));
}

/** Seconds the goodbye has left on the picture. */
export const goodbyeLeft = (run: RunState): number =>
  Math.max(0, res(run, "wmBye"));

/** True in the first seconds of a goodbye: a story card must not cover it. */
export const isGoodbyeBusy = (run: RunState): boolean =>
  run.phase === 3 && goodbyeLeft(run) > L.goodbyeSeconds - 4;

/** Lets every light still burning go at once: the last flash. */
export function letAllGo(run: RunState): void {
  for (const light of LIGHTS) run.owned[light.id] = 1;
  run.resources.lights = TOTAL_LIGHTS - LIGHT_COUNT;
}

// ------------------------------------------------------------------- tick

/** Starts the part: the lights are all lit; the first wind is planned. */
export function startWarmth(run: RunState): void {
  const r = run.resources;
  r.wmSeed = harborSeed(((r.nightSeed ?? 0) || run.rng) ^ SEED_MIX);
  r.wmChillSeed = harborSeed(r.wmSeed ^ CHILL_MIX);
  r.wmStoke = 0;
  r.wmLock = 0;
  r.wmRise = 0;
  r.wmRiseIdx = 0;
  r.wmBye = 0;
  r.wmChillLeft = 0;
  planChill(run, L.chill.first);
}

/** A tap stokes the flame. */
export function stoke(run: RunState, taps = 1): void {
  run.resources.wmStoke = clamp(
    stokeOf(run) + L.stokePerTap * taps,
    0,
    L.stokeMax
  );
}

/**
 * A save from before the warmth owns the cut rain barrel: while it is in the
 * last part, pay back what it cost (at the price it was bought at) and take
 * it off the books, once.
 */
function refundRemovedUpgrades(run: RunState): void {
  for (const [id, cost] of Object.entries(REMOVED_LAST_COSTS)) {
    const levels = Math.floor(owned(run, id));
    if (levels <= 0) continue;
    run.resources.resolve =
      res(run, "resolve") + cost * REMOVED_LAST_SCALE * levels;
    delete run.owned[id];
  }
}

/** Runs the warmth, the company, the wind and the boat for `dt` seconds. */
export function tickWarmth(run: RunState, dt: number): void {
  const r = run.resources;
  refundRemovedUpgrades(run);
  if (!r.wmChillSeed) planChill(run, L.chill.first);
  // The wind.
  if (res(run, "wmChillLeft") > 0) {
    r.wmChillLeft = res(run, "wmChillLeft") - dt;
    if (r.wmChillLeft <= 0) {
      r.wmChillLeft = 0;
      planChill(run, L.chill.gapMin);
    }
  } else {
    r.wmChillIn = res(run, "wmChillIn") - dt;
    if (r.wmChillIn <= 0) {
      r.wmChillIn = 0;
      r.wmChillLeft = L.chill.seconds;
    }
  }
  // The settle after a goodbye.
  r.wmLock = Math.max(0, res(run, "wmLock") - dt);
  r.wmRise = Math.max(0, res(run, "wmRise") - dt);
  r.wmBye = Math.max(0, res(run, "wmBye") - dt);
  r.wmStoke = Math.max(0, stokeOf(run) - L.stokeFade * dt);
  // The warmth moves toward where the lights leave it.
  const warmth = warmthOf(run);
  const target = warmthTarget(run);
  const next = warmth + (target - warmth) * (1 - Math.exp(-L.warmRate * dt));
  r.flame = clamp(next, 0, 1) * L.flameFull;
  // The resolve of the quiet, and the boat.
  r.resolve = res(run, "resolve") + resolvePerSecond(run) * dt;
  if (boatArrived(run)) return;
  r.boatProgress = Math.min(
    100,
    res(run, "boatProgress") + (100 / L.boatSeconds) * boatPace(run) * dt
  );
}

/** One button for each light; the lights panel draws them itself. */
export const LET_GO_ACTIONS: readonly ActionDef[] = INDEXES.map((i) => ({
  id: letGoActionId(i),
  phases: [PHASE_LAST],
  isInline: true,
  visibleWhen: (run) => isLit(run, i),
  describe: (run) => ({
    label: `Let the ${LIGHTS[i].name.toLowerCase()} go`,
    detail:
      lockLeft(run) > 0
        ? "The last light is still rising."
        : `It pays about ${Math.round(lumpNow(run, i))} resolve now.`,
    isBlocked: !canLetGo(run, i),
  }),
  perform: (run) => letGo(run, i),
}));

/** How many lights have gone. */
export const letsSoFar = (run: RunState): number => res(run, "wmLets");

/** The log line for the light that has just gone. */
export function goodbyeLine(run: RunState): string | null {
  const index = Math.round(res(run, "wmByeIdx")) - 1;
  if (index < 0 || index >= LIGHT_COUNT) return null;
  const lump = Math.max(1, Math.round(lastLump(run)));
  return `You let the ${LIGHTS[index].name.toLowerCase()} go. A flower blooms where they stood: +${lump} resolve.`;
}

export const SHELTER_ACTION = "shelter-flame";

/** Cups your hands round the flame: this wind bites less, for some resolve. */
export const SHELTER: ActionDef = {
  id: SHELTER_ACTION,
  phases: [PHASE_LAST],
  isInline: true,
  visibleWhen: (run) =>
    run.phase === 3 && (isChillBlowing(run) || chillForecast(run) !== null),
  describe: (run) => ({
    label: "Cup your hands round the flame",
    detail: isSheltered(run)
      ? "Your hands are round the flame. This wind will bite less."
      : "This wind bites less, and the lights burn gentler while it blows.",
    cost: { resource: "resolve", amount: shelterCost(run) },
    isBlocked: isSheltered(run),
  }),
  perform: (run) => {
    if (isSheltered(run)) return;
    run.resources.wmShield = 1;
    run.resources.wmShelters = res(run, "wmShelters") + 1;
  },
};
