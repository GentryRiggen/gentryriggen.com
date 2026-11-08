import { formatNumber } from "../../engine/format";
import { nextRandom } from "../../engine/rng";
import type { ActionDef, RunState } from "../../engine/types";
import {
  FOREMEN,
  crewDark,
  crewLean,
  crewPay,
  crewTap,
  foreman,
  pairNotes,
} from "./foremen";
import { referenceIncome } from "./income";
import { TOWN_UPGRADE_IDS, helperLevels, owned, res } from "./lines";
import { PACES, paceNow, paceStep } from "./playroom";
import { PHASE_TOWN } from "./resources";
import { leanCalm, swayOf } from "./sway";
import { TUNING } from "./tuning";

/**
 * The Town's three dials, besides the build pace it shares with the Playroom.
 *
 * Foremen's hats: three hats, six foremen, each with a plus and a minus. A
 * swap takes a whole shift, and the hat stands empty until the new foreman
 * arrives.
 *
 * The shadow: the taller the tower, the darker the town, and a dark town
 * sends fewer bricks. Street lamps and a park take some of the dark away, for
 * bricks you could have spent on the climb.
 *
 * The day: market, night shift, wind or a festival. Tomorrow is always on the
 * sign, so there is time to change hats.
 *
 * Everything is hidden resources (`tf*`, `tw*`), so an old save reads as no
 * foremen, no lamps and a quiet day. The day's dice have a stream of their
 * own, so the run's random numbers are never touched.
 */

const T = TUNING.town;
const SEED_MIX = 0x70ad5;

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export const HATS = T.hats;
export const isTownPhase = (run: RunState): boolean =>
  run.phase === 1 && !run.complete;

/** The dials open once the first crew is in (where the old Steady button did). */
export const isTownOpen = (run: RunState): boolean =>
  isTownPhase(run) && helperLevels(run) >= 2;

// ------------------------------------------------------------------ the days

export type DayId = "quiet" | "market" | "night" | "windy" | "festival";

export interface DayDef {
  id: DayId;
  name: string;
  /** What it does, in plain words. */
  note: string;
}

export const DAYS: readonly DayDef[] = [
  { id: "quiet", name: "Quiet day", note: "Nothing special today." },
  {
    id: "market",
    name: "Market day",
    note: `Crowds buy bricks: your taps pay ${T.marketTap} times as much.`,
  },
  {
    id: "night",
    name: "Night shift",
    note: `Work goes on in the dark: the shadow bites ${T.nightDark} times as hard.`,
  },
  {
    id: "windy",
    name: "Windy day",
    note: `Gusts everywhere: the tower leans ${T.windyLean} times as much.`,
  },
  {
    id: "festival",
    name: "Festival",
    note: `The town wants light: every step of light pays +${Math.round(T.festivalPerLit * 100)}% today.`,
  },
];

const dayIndex = (n: number): number =>
  Math.min(DAYS.length - 1, Math.max(0, Math.round(n)));

/** Today's day (a quiet one before the dials open). */
export const dayNow = (run: RunState): DayDef =>
  DAYS[isTownOpen(run) ? dayIndex(res(run, "twDay")) : 0];

/** Tomorrow's day, which is on the sign all day. */
export const dayNext = (run: RunState): DayDef =>
  DAYS[isTownOpen(run) ? dayIndex(res(run, "twNext")) : 0];

/** A new day has just begun (the scene shows a sign). */
export const justNewDay = (run: RunState): boolean =>
  isTownOpen(run) &&
  res(run, "twDayAt") > 0 &&
  run.time - res(run, "twDayAt") < 4;

/** Seconds left of today. */
export const daySecondsLeft = (run: RunState): number =>
  isTownOpen(run) ? Math.max(0, Math.ceil(res(run, "twEnd") - run.time)) : 0;

export const daysSoFar = (run: RunState): number => res(run, "twDayN");

function roll(run: RunState): number {
  const r = run.resources;
  if (!r.twRng) r.twRng = (run.rng ^ SEED_MIX) | 0 || 1;
  const stream = { rng: r.twRng | 0 };
  const value = nextRandom(stream);
  r.twRng = stream.rng;
  return value;
}

/** A day other than `not`, drawn from the town's own stream. */
function pickDay(run: RunState, not: number): number {
  const others = DAYS.map((_, i) => i).filter((i) => i !== not);
  return others[
    Math.min(others.length - 1, Math.floor(roll(run) * others.length))
  ];
}

// ------------------------------------------------------------- foremen's hats

export const hatKey = (hat: number): string => `tfH${hat}`;
const pendingKey = (hat: number): string => `tfP${hat}`;
const untilKey = (hat: number): string => `tfU${hat}`;

/** Who wears each hat now (0: empty, or waiting for a swap). */
export const hatIds = (run: RunState): number[] =>
  Array.from({ length: HATS }, (_, h) => Math.round(res(run, hatKey(h))));

/** The foreman on his way to each hat (0: nobody). */
export const pendingIds = (run: RunState): number[] =>
  Array.from({ length: HATS }, (_, h) => Math.round(res(run, pendingKey(h))));

/** Seconds until this hat's new foreman arrives (0 when none is coming). */
export const hatWait = (run: RunState, hat: number): number =>
  pendingIds(run)[hat] > 0
    ? Math.max(0, Math.ceil(res(run, untilKey(hat)) - run.time))
    : 0;

/** True when this foreman wears a hat or is on his way to one. */
export const isHired = (run: RunState, id: number): boolean =>
  hatIds(run).includes(id) || pendingIds(run).includes(id);

export const foremanActionId = (hat: number, id: number): string =>
  `foreman-${hat}-${id}`;
export const FOREMAN_ACTION_IDS: readonly string[] = Array.from(
  { length: HATS },
  (_, h) => FOREMEN.map((f) => foremanActionId(h, f.id))
).flat();

export const swapsSoFar = (run: RunState): number => res(run, "tfSwaps");
export const swapStarts = (run: RunState): number => res(run, "tfStarts");

/** A foreman has just taken a hat. */
export const justArrived = (run: RunState): boolean =>
  res(run, "tfAt") > 0 && run.time - res(run, "tfAt") < T.showSeconds;

/** A hat has just been handed back (the old foreman tosses it away). */
export const justTossed = (run: RunState): boolean =>
  res(run, "tfStartAt") > 0 && run.time - res(run, "tfStartAt") < T.showSeconds;

/** Puts `id` on `hat`: the old foreman goes now, the new one comes after a shift. */
export function startSwap(run: RunState, hat: number, id: number): void {
  const r = run.resources;
  r.tfGone = Math.round(res(run, hatKey(hat)));
  r[hatKey(hat)] = 0;
  r[pendingKey(hat)] = id;
  r[untilKey(hat)] = run.time + T.shiftSeconds;
  r.tfStartAt = run.time;
  r.tfHatOff = hat;
  r.tfStarts = swapStarts(run) + 1;
}

function tickHats(run: RunState): void {
  const r = run.resources;
  for (let h = 0; h < HATS; h += 1) {
    const id = Math.round(res(run, pendingKey(h)));
    if (id > 0 && run.time >= res(run, untilKey(h))) {
      r[hatKey(h)] = id;
      r[pendingKey(h)] = 0;
      r.tfAt = run.time;
      r.tfHatOn = h;
      r.tfWho = id;
      r.tfSwaps = swapsSoFar(run) + 1;
    }
  }
}

// ----------------------------------------------------------------- the shadow

/** How tall the tower is, 0 to 12 (every Town upgrade bought is half a floor...). */
export const towerHeight = (run: RunState): number =>
  Math.min(
    12,
    TOWN_UPGRADE_IDS.reduce((sum, id) => sum + owned(run, id), 0) / 2
  );

export const lampsOf = (run: RunState): number =>
  Math.min(T.lampSeconds.length, Math.round(res(run, "twLamps")));
export const hasPark = (run: RunState): boolean => res(run, "twPark") >= 1;

/** Steps of light the town has (a park counts as two), for the festival. */
export const litSteps = (run: RunState): number =>
  lampsOf(run) + (hasPark(run) ? 2 : 0);

/** How much of the dark the lamps and the park take away, 0 to 0.95. */
export const reliefOf = (run: RunState): number =>
  Math.min(
    0.95,
    lampsOf(run) * T.lampRelief + (hasPark(run) ? T.parkRelief : 0)
  );

/** The shadow the tower throws before anyone lights anything, 0 to 1. */
export const shadeRaw = (run: RunState): number =>
  clamp01(towerHeight(run) / T.shadeFull);

/** How dark the town is now, 0 (bright) to 1 (pitch dark). */
export function darkness(run: RunState): number {
  if (run.phase !== 1) return 0;
  const night = dayNow(run).id === "night" ? T.nightDark : 1;
  return clamp01(
    shadeRaw(run) * crewDark(hatIds(run)) * night * (1 - reliefOf(run))
  );
}

/** What the dark does to the pay (1 = nothing, down to 1 - cutMax). */
export const shadowMult = (run: RunState): number =>
  1 - T.cutMax * darkness(run);

/** What the lamps' power bill leaves of the pay (1 with no lights). */
export const upkeepMult = (run: RunState): number =>
  1 - T.lightUpkeep * litSteps(run);

const festival = (run: RunState): number =>
  dayNow(run).id === "festival" ? 1 + T.festivalPerLit * litSteps(run) : 1;

/** What the crew's pay is multiplied by in the town (foremen, the dark, the festival). */
export const townPay = (run: RunState): number =>
  run.phase === 1
    ? T.base *
      crewPay(hatIds(run), darkness(run)) *
      shadowMult(run) *
      upkeepMult(run) *
      festival(run)
    : 1;

/** What a tap's pay is multiplied by in the town. */
export const townTap = (run: RunState): number =>
  run.phase === 1
    ? T.base *
      crewTap(hatIds(run)) *
      shadowMult(run) *
      upkeepMult(run) *
      festival(run) *
      (dayNow(run).id === "market" ? T.marketTap : 1)
    : 1;

export const lampsLeft = (run: RunState): boolean =>
  lampsOf(run) < T.lampSeconds.length;

/** What the next street lamp costs, in bricks. */
export const lampPrice = (run: RunState): number =>
  Math.ceil(
    (T.lampSeconds[Math.min(lampsOf(run), T.lampSeconds.length - 1)] ?? 0) *
      Math.max(T.priceFloor, referenceIncome(run))
  );

export const parkPrice = (run: RunState): number =>
  Math.ceil(T.parkSeconds * Math.max(T.priceFloor, referenceIncome(run)));

export const lightsSoFar = (run: RunState): number => res(run, "twBuys");

/** The lights have just come on. */
export const justLit = (run: RunState): boolean =>
  res(run, "twLitAt") > 0 &&
  run.time - res(run, "twLitAt") < T.lightsShowSeconds;

function lightUp(run: RunState): void {
  const r = run.resources;
  r.twLitAt = run.time;
  r.twBuys = lightsSoFar(run) + 1;
}

// ------------------------------------------------------------------ the lean

/** Where the town's lean is heading with this pace. */
export function leanFor(run: RunState, pace: number): number {
  const lo = Math.floor(pace);
  const hi = Math.min(PACES.length - 1, lo + 1);
  const lean = PACES[lo].lean + (PACES[hi].lean - PACES[lo].lean) * (pace - lo);
  const height =
    T.leanBase +
    (1 - T.leanBase) * Math.min(1, helperLevels(run) / T.leanLevels);
  const wind = dayNow(run).id === "windy" ? T.windyLean : 1;
  const pole = res(run, "twPoleUntil") > run.time ? 0.5 : 1;
  return clamp01(
    lean *
      T.leanScale *
      height *
      Math.max(T.calmFloor, leanCalm(run)) *
      crewLean(hatIds(run)) *
      wind *
      pole
  );
}

export const townLeanTarget = (run: RunState): number =>
  leanFor(run, paceNow(run));

// ---------------------------------------------------------------------- tick

export function tickTown(run: RunState, dt: number): void {
  if (run.phase !== 1) return;
  const r = run.resources;
  // The pace dial eases toward where it is set.
  const set = paceStep(run);
  const now = paceNow(run);
  const move = dt / TUNING.playroom.settleSeconds;
  r.pcEff = now < set ? Math.min(set, now + move) : Math.max(set, now - move);
  // The lean eases toward where it is going.
  const sway = swayOf(run);
  r.sway = clamp01(
    sway +
      (townLeanTarget(run) - sway) *
        Math.min(1, dt / TUNING.playroom.leanSeconds)
  );
  if (!isTownOpen(run)) return;
  tickHats(run);
  if (!r.twEnd) {
    r.twDay = 0;
    r.twNext = pickDay(run, 0);
    r.twEnd = run.time + T.daySeconds;
  }
  while (run.time >= r.twEnd) {
    r.twDay = r.twNext;
    r.twNext = pickDay(run, r.twDay);
    r.twEnd += T.daySeconds;
    r.twDayN = daysSoFar(run) + 1;
    r.twDayAt = run.time;
  }
}

/** A fresh site starts with no foremen, no lamps and a quiet day. */
export function resetTown(run: RunState): void {
  const r = run.resources;
  for (let h = 0; h < HATS; h += 1) {
    r[hatKey(h)] = 0;
    r[pendingKey(h)] = 0;
    r[untilKey(h)] = 0;
  }
  r.twLamps = 0;
  r.twPark = 0;
  r.twEnd = 0;
  r.twDay = 0;
  r.twNext = 0;
  r.twPoleUntil = 0;
}

// ------------------------------------------------------------ words and ids

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** What the dark costs the town's pay right now, in words. */
export const darkCutText = (run: RunState): string =>
  `The dark is taking ${pct(1 - shadowMult(run))} of your bricks.`;

export const LAMP_ACTION_ID = "town-lamps";
export const PARK_ACTION_ID = "town-park";
export const LIGHT_ACTION_IDS: readonly string[] = [
  LAMP_ACTION_ID,
  PARK_ACTION_ID,
];

const FOREMAN_ACTIONS: readonly ActionDef[] = Array.from(
  { length: HATS },
  (_, hat) =>
    FOREMEN.map((f): ActionDef => ({
      id: foremanActionId(hat, f.id),
      phases: [PHASE_TOWN],
      isInline: true,
      visibleWhen: isTownOpen,
      describe: (run) => {
        const waiting = hatWait(run, hat) > 0 || pendingIds(run)[hat] > 0;
        return {
          label: f.name,
          detail: `${f.plus}. ${f.minus}. A swap takes a whole shift of ${T.shiftSeconds} sec.`,
          isBlocked: waiting || isHired(run, f.id),
        };
      },
      perform: (run) => startSwap(run, hat, f.id),
    }))
).flat();

const LIGHT_ACTIONS: readonly ActionDef[] = [
  {
    id: LAMP_ACTION_ID,
    phases: [PHASE_TOWN],
    isInline: true,
    visibleWhen: isTownOpen,
    describe: (run) => ({
      label: "Street lamps",
      detail: `Lamps along the street. The dark bites ${pct(T.lampRelief)} less each time. Costs bricks you could spend on the climb, and ${pct(T.lightUpkeep)} of your bricks every second for the power.`,
      cost: lampsLeft(run)
        ? { resource: "bricks", amount: lampPrice(run) }
        : undefined,
      isBlocked: !lampsLeft(run),
    }),
    perform: (run) => {
      run.resources.twLamps = lampsOf(run) + 1;
      lightUp(run);
    },
  },
  {
    id: PARK_ACTION_ID,
    phases: [PHASE_TOWN],
    isInline: true,
    visibleWhen: isTownOpen,
    describe: (run) => ({
      label: "A park with lights",
      detail: `Trees, a pond and lanterns. The dark bites ${pct(T.parkRelief)} less. Costs a lot of bricks you could spend on the climb, and ${pct(T.lightUpkeep * 2)} of your bricks every second for the lanterns.`,
      cost: hasPark(run)
        ? undefined
        : { resource: "bricks", amount: parkPrice(run) },
      isBlocked: hasPark(run),
    }),
    perform: (run) => {
      run.resources.twPark = 1;
      lightUp(run);
    },
  },
];

export const TOWN_ACTIONS: readonly ActionDef[] = [
  ...FOREMAN_ACTIONS,
  ...LIGHT_ACTIONS,
];

// ------------------------------------------------------------------ the log

export const townEvents = (run: RunState): number =>
  swapsSoFar(run) + lightsSoFar(run);

/** Plain words for who has taken a hat. */
export function swapLine(run: RunState): string {
  const f = foreman(Math.round(res(run, "tfWho")));
  return f
    ? `${f.name} put on a hard hat and took over. ${f.plus}. ${f.minus}.`
    : "A new foreman put on a hard hat.";
}

export const lightsLine = (run: RunState): string =>
  hasPark(run)
    ? `LIGHTS ON! The park is open and the town glows. It cost ${formatNumber(Math.floor(parkPrice(run)))} bricks' worth of climbing.`
    : "LIGHTS ON! Street lamps glow along the street, and the shadow is not so dark.";

export { pairNotes };
