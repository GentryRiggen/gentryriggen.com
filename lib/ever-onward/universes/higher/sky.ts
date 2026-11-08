import { nextRandom } from "../../engine/rng";
import type { ActionDef, ConsumableDef, RunState } from "../../engine/types";
import { formatNumber } from "../../engine/format";
import { helperLevels, owned, res } from "./lines";
import { PHASE_SKY } from "./resources";
import { leanCalm } from "./sway";
import { TUNING } from "./tuning";

/**
 * The Sky's three dials.
 *
 * The forecast (wind): a calm sky, then clouds gathering, then a sure gust,
 * and it firms up as it gets close. Clouds may clear and a calm sky may
 * stay calm, so the forecast is a bet. A gust drops a loose load (the last
 * stretch of hoisting) and the crew spends a moment fetching it. Tying down
 * keeps the load safe, but the crane earns nothing while tied, and tying down
 * and untying each take a moment (the straps come off by themselves once the
 * gust has passed). A strong gust drops a loose load at any cable strain, so
 * only a tie-down keeps it for sure.
 *
 * The cable's strain: slack to humming. A tighter cable hoists faster and
 * snaps more often, and a gust on a tight cable snaps it far more often. A
 * snap loses the load and takes a moment to restring. (This is also the
 * sky's pace dial: a second dial that trades speed for a loss would only be
 * a copy of it.) The dial moves a step every couple of seconds.
 *
 * The no-crane climb: switch the crane off for a minute and hoist by hand at
 * a much lower pay. Get through the minute and the tower pays a bit more for
 * good. A gust or a snap ends it early, and the slow minute was the cost.
 *
 * State is hidden resources (`sk*`), so an old save reads as a taut cable, a
 * calm sky and no badges. The weather has a random stream of its own.
 */

const K = TUNING.sky;
const SEED_MIX = 0x5c71e;
/** The weather's own stream: what you choose never changes the sky. */
const WEATHER_MIX = 0x3f1d7a;

export const STRAINS = K.strains;
export const strainActionId = (step: number): string => `strain-${step}`;
export const STRAIN_ACTION_IDS: readonly string[] = STRAINS.map((_, i) =>
  strainActionId(i)
);
export const TIE_ACTION_ID = "sky-tie";
export const NC_START_ACTION_ID = "sky-nocrane";
export const NC_STOP_ACTION_ID = "sky-nocrane-stop";

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const stored = (run: RunState, id: string, fallback: number): number =>
  run.resources[id] ?? fallback;

/** The dials open once the first crew is in (where the old Steady button did). */
export const isSkyOpen = (run: RunState): boolean =>
  run.phase === 2 && !run.complete && helperLevels(run) >= 2;

// ------------------------------------------------------------------- strain

/** The strain that is set (the one you chose). */
export const strainStep = (run: RunState): number =>
  Math.min(
    STRAINS.length - 1,
    Math.max(0, Math.round(stored(run, "skStrain", K.startStrain)))
  );

/** The strain the cable is really at: it moves toward the set strain. */
export const strainNow = (run: RunState): number =>
  Math.min(
    STRAINS.length - 1,
    Math.max(0, stored(run, "skEff", strainStep(run)))
  );

export const isStrainSettling = (run: RunState): boolean =>
  Math.abs(strainNow(run) - strainStep(run)) > 0.01;

function blendAt(at: number, pick: (i: number) => number): number {
  const lo = Math.floor(at);
  const hi = Math.min(STRAINS.length - 1, lo + 1);
  return pick(lo) + (pick(hi) - pick(lo)) * (at - lo);
}

/** How much a strain pays (1 = taut), blended between steps while it moves. */
export const strainPay = (at: number): number =>
  blendAt(at, (i) => STRAINS[i].pay);

/** How much of that pay is left while clouds gather (a tight cable hums and slows). */
export const strainDrag = (at: number): number =>
  blendAt(at, (i) => STRAINS[i].drag);

// ------------------------------------------------------------------ weather

export type Forecast = 0 | 1 | 2;
export const FORECAST_NAMES = [
  "Calm sky",
  "Clouds gathering",
  "Gust coming!",
] as const;

/** True when the gust that is sure (or blowing) is a strong one. */
export const isStrongGust = (run: RunState): boolean =>
  isSkyOpen(run) && res(run, "skStrong") > 0;

/** How much a gust multiplies the chances of a drop and a snap. */
export const gustPower = (run: RunState): number =>
  isStrongGust(run) ? K.strongMult : K.lightMult;

/** The forecast: 0 calm, 1 clouds gathering, 2 a sure gust. */
export const forecastOf = (run: RunState): Forecast =>
  isSkyOpen(run) ? (Math.min(2, Math.max(0, res(run, "skWx"))) as Forecast) : 0;

/** True while a gust is blowing. */
export const isBlowing = (run: RunState): boolean =>
  isSkyOpen(run) && res(run, "skGustUntil") > run.time;

/** Seconds until the sure gust arrives (0 when none is forecast). */
export const gustIn = (run: RunState): number =>
  forecastOf(run) === 2
    ? Math.max(0, Math.ceil(res(run, "skWxAt") - run.time))
    : 0;

/** Seconds of the sure gust's warning left, exactly (for the bots). */
export const gustInExact = (run: RunState): number =>
  forecastOf(run) === 2 ? Math.max(0, res(run, "skWxAt") - run.time) : 0;

export const gustsSoFar = (run: RunState): number => res(run, "skGusts");

/** True for a moment after a gust arrives (the scene sweeps it in). */
export const justGusted = (run: RunState): boolean => isBlowing(run);

// ---------------------------------------------------------------- tie down

export type TieState = "free" | "tying" | "tied" | "untying";
const TIE_STATES: readonly TieState[] = ["free", "tying", "tied", "untying"];

export const tieState = (run: RunState): TieState =>
  TIE_STATES[
    isSkyOpen(run) ? Math.min(3, Math.max(0, Math.round(res(run, "skTie")))) : 0
  ];

/** Safe from a gust: tied, or still strapped while untying. */
export const isSecured = (run: RunState): boolean => {
  const t = tieState(run);
  return t === "tied" || t === "untying";
};

/** Seconds until tying or untying is done (0 when neither is going on). */
export const tieWait = (run: RunState): number =>
  tieState(run) === "tying" || tieState(run) === "untying"
    ? Math.max(0, Math.ceil(res(run, "skTieAt") - run.time))
    : 0;

export const tiesSoFar = (run: RunState): number => res(run, "skTies");

/** True for a few seconds after the tower is tied down. */
export const justTied = (run: RunState): boolean =>
  res(run, "skTiedAt") > 0 && run.time - res(run, "skTiedAt") < K.showSeconds;

// -------------------------------------------------------------- the load

/** What is on the hook now: the last stretch of hoisting, lost if it drops. */
export const hookOf = (run: RunState): number =>
  isSkyOpen(run) ? res(run, "skHook") : 0;

export const isFetching = (run: RunState): boolean =>
  isSkyOpen(run) && res(run, "skStallUntil") > run.time;

export const isRestringing = (run: RunState): boolean =>
  isSkyOpen(run) && res(run, "skRestringUntil") > run.time;

/** True while the crew rests after a failed no-crane climb. */
export const isResting = (run: RunState): boolean =>
  isSkyOpen(run) && res(run, "skRestUntil") > run.time;

/** True when the crane earns nothing: tying, tied, untying, fetching, restringing, resting. */
export const isIdle = (run: RunState): boolean =>
  isSkyOpen(run) &&
  (tieState(run) !== "free" ||
    isFetching(run) ||
    isRestringing(run) ||
    isResting(run));

/** True while a spare cable from a delivery is halving the risks. */
export const isSpare = (run: RunState): boolean =>
  res(run, "skSoftUntil") > run.time;

export const dropsSoFar = (run: RunState): number => res(run, "skDrops");
export const snapsSoFar = (run: RunState): number => res(run, "skSnaps");

export const justDropped = (run: RunState): boolean =>
  res(run, "skDropAt") > 0 && run.time - res(run, "skDropAt") < K.showSeconds;
export const justSnapped = (run: RunState): boolean =>
  res(run, "skSnapAt") > 0 && run.time - res(run, "skSnapAt") < K.showSeconds;

/** The risks are this much of what they would be: braces, ballast, a spare cable. */
export const riskCalm = (run: RunState): number =>
  Math.max(K.calmFloor, leanCalm(run)) * (isSpare(run) ? 0.5 : 1);

/** Share of a gust's drops and snaps still left, for a calm and a spare cable. */
const perSecond = (n: number, calm: number): number => n * calm;

const chanceInGust = (perSec: number): number =>
  1 - (1 - Math.min(1, perSec)) ** K.gustSeconds;

/** Chance that a gust (all of it) snaps the cable at this strain. */
export const snapInGust = (strain: number, calm: number, power = 1): number =>
  chanceInGust(
    perSecond(
      blendAt(strain, (i) => STRAINS[i].snap),
      calm
    ) * power
  );

/**
 * What a strong gust drops a loose load at any strain, a second (a Slack
 * cable only softens it). Braces and ballast calm it like the rest.
 */
export const gustFloor = (run: RunState): number =>
  isStrongGust(run) ? K.strongDropRate : 0;

/** Chance that a gust (all of it) drops a loose load at this strain. */
export const dropInGust = (
  strain: number,
  calm: number,
  power = 1,
  floor = 0
): number =>
  chanceInGust(
    perSecond(
      blendAt(strain, (i) => STRAINS[i].drop),
      calm
    ) *
      power +
      perSecond(floor, calm)
  );

/** Chance per second that the cable snaps in calm air. */
export const snapPerCalmSecond = (
  strain: number,
  calm: number,
  isCloudy = false
): number =>
  perSecond(
    blendAt(strain, (i) => STRAINS[i].calm),
    calm
  ) * (isCloudy ? K.cloudSnapMult : 1);

/** True while clouds gather or a gust is sure: a taut cable hums and snaps more. */
export const isCloudy = (run: RunState): boolean =>
  isSkyOpen(run) && forecastOf(run) >= 1;

/** What a drop costs, in seconds of the load's pay and of fetching it. */
export const DROP_SECONDS = K.hookSeconds + K.stallSeconds;
export const SNAP_SECONDS = K.hookSeconds + K.restringSeconds;

/**
 * True while the scene is showing a big sky moment (a gust, a drop, a snap, a
 * climb won or lost). Story toasts wait so they never cover it.
 */
export const isSkyMomentBusy = (run: RunState): boolean =>
  isSkyOpen(run) &&
  (isBlowing(run) ||
    justDropped(run) ||
    justSnapped(run) ||
    justNcWon(run) ||
    justNcFailed(run));

// ------------------------------------------------------------ no-crane climb

/** The climb needs a crane to turn off: it opens with the first cloud crane. */
export const isNcOpen = (run: RunState): boolean =>
  isSkyOpen(run) && owned(run, "cloud-crane") >= 1;

export const isNoCrane = (run: RunState): boolean =>
  isSkyOpen(run) && res(run, "skNc") > 0;
export const ncWins = (run: RunState): number =>
  Math.min(K.ncMax, Math.floor(res(run, "skNcWins")));
export const ncFails = (run: RunState): number => res(run, "skNcFails");

/** Seconds left of the no-crane climb (0 when it is not on). */
export const ncLeft = (run: RunState): number =>
  isNoCrane(run) ? Math.max(0, Math.ceil(res(run, "skNcUntil") - run.time)) : 0;

export const justNcWon = (run: RunState): boolean =>
  res(run, "skNcWinAt") > 0 && run.time - res(run, "skNcWinAt") < K.showSeconds;
export const justNcFailed = (run: RunState): boolean =>
  res(run, "skNcFailAt") > 0 &&
  run.time - res(run, "skNcFailAt") < K.showSeconds;

/** What the permanent bonus pays now (1 + `ncBonus` per badge). */
export const ncBonusMult = (run: RunState): number =>
  1 + K.ncBonus * ncWins(run);

export const canStartNoCrane = (run: RunState): boolean =>
  isNcOpen(run) &&
  !isNoCrane(run) &&
  ncWins(run) < K.ncMax &&
  tieState(run) === "free" &&
  !isBlowing(run) &&
  forecastOf(run) !== 2 &&
  !isFetching(run) &&
  !isRestringing(run) &&
  !isResting(run);

// --------------------------------------------------------------------- pay

/**
 * What the sky pays, multiplied in: the sky's base, the strain, the badges,
 * and the crane being off (which only cuts what the helpers earn: a hand
 * on the rope still pays in full). Nothing at all while tying, tied,
 * untying, fetching a dropped load or restringing a snapped cable.
 */
export function skyPay(run: RunState, isTap = false): number {
  if (run.phase !== 2) return 1;
  if (!isSkyOpen(run)) return K.base;
  if (isIdle(run)) return 0;
  return (
    K.base *
    strainPay(strainNow(run)) *
    (isCloudy(run) ? strainDrag(strainNow(run)) : 1) *
    (isNoCrane(run) && !isTap ? K.ncPay : 1) *
    ncBonusMult(run)
  );
}

/** What the sky would pay at this strain, never idle (for the panel and the bots). */
export const skyPayAt = (run: RunState, strain: number): number =>
  K.base *
  strainPay(strain) *
  (isCloudy(run) ? strainDrag(strain) : 1) *
  (isNoCrane(run) ? K.ncPay : 1) *
  ncBonusMult(run);

// ------------------------------------------------------------------ actions

export function setStrain(run: RunState, step: number): void {
  const r = run.resources;
  const now = strainNow(run);
  r.skStrain = Math.min(STRAINS.length - 1, Math.max(0, Math.round(step)));
  r.skEff = now;
  r.skChanges = res(run, "skChanges") + 1;
}

export const strainChanges = (run: RunState): number => res(run, "skChanges");

export function toggleTie(run: RunState): void {
  const r = run.resources;
  const state = tieState(run);
  if (state === "free") {
    r.skTie = 1;
    r.skTieAt = run.time + K.tieSeconds;
  } else if (state === "tied") {
    r.skTie = 3;
    r.skTieAt = run.time + K.untieSeconds;
  }
}

export function startNoCrane(run: RunState): void {
  if (!canStartNoCrane(run)) return;
  const r = run.resources;
  r.skNc = 1;
  r.skNcUntil = run.time + K.ncSeconds;
  r.skNcTries = res(run, "skNcTries") + 1;
}

/** Giving up is not free: the crew rests a while before the crane is back. */
export function stopNoCrane(run: RunState): void {
  const r = run.resources;
  if (res(run, "skNc") <= 0) return;
  r.skNc = 0;
  r.skRestUntil = run.time + K.ncGiveUpSeconds;
}

/** A spare cable from a delivery halves the risks for a minute. */
export function spareCable(run: RunState): void {
  run.resources.skSoftUntil = run.time + K.softSeconds;
}

// --------------------------------------------------------------------- tick

function rollFrom(run: RunState, key: string, mix: number): number {
  const r = run.resources;
  if (!r[key]) r[key] = (run.rng ^ mix) | 0 || 1;
  const stream = { rng: r[key] | 0 };
  const value = nextRandom(stream);
  r[key] = stream.rng;
  return value;
}

/** The roll for drops and snaps. */
const roll = (run: RunState): number => rollFrom(run, "skRng", SEED_MIX);

/** The roll for the weather: a stream of its own, so choices never move it. */
const rollWeather = (run: RunState): number =>
  rollFrom(run, "skWxRng", WEATHER_MIX);

/** Records an hoisted amount: it is on the hook until it lands. */
export function hoisted(run: RunState, amount: number): void {
  run.resources.skHook = res(run, "skHook") + amount;
}

function loseLoad(run: RunState): number {
  const r = run.resources;
  const lost = Math.min(res(run, "skHook"), res(run, "beams"));
  r.beams = res(run, "beams") - lost;
  r.skHook = 0;
  return lost;
}

function failNoCrane(run: RunState): void {
  const r = run.resources;
  if (res(run, "skNc") <= 0) return;
  r.skNc = 0;
  r.skNcFails = ncFails(run) + 1;
  r.skRestUntil = run.time + K.ncFailSeconds;
  r.skNcFailAt = run.time;
}

function snap(run: RunState): void {
  const r = run.resources;
  loseLoad(run);
  r.skRestringUntil = run.time + K.restringSeconds;
  r.skSnaps = snapsSoFar(run) + 1;
  r.skSnapAt = run.time;
  failNoCrane(run);
}

function drop(run: RunState): void {
  const r = run.resources;
  r.skDropN = loseLoad(run);
  r.skStallUntil = run.time + K.stallSeconds;
  r.skDrops = dropsSoFar(run) + 1;
  r.skDropAt = run.time;
  failNoCrane(run);
}

/** Clouds gather less often just after a gust (the sky clears for a while). */
export const cloudChanceAt = (run: RunState, at: number): number =>
  at - res(run, "skGustUntil") < K.spellSeconds
    ? K.cloudChance * K.spellMult
    : K.cloudChance;

/** Seconds since the last gust passed (a big number if none has). */
export const sinceGust = (run: RunState): number =>
  res(run, "skGusts") > 0
    ? Math.max(0, run.time - res(run, "skGustUntil"))
    : 1e9;

function tickWeather(run: RunState): void {
  const r = run.resources;
  if (!r.skWxAt) {
    r.skWx = 0;
    r.skWxAt = run.time + K.stepSeconds;
  }
  while (run.time >= r.skWxAt) {
    const wx = Math.round(res(run, "skWx"));
    if (wx === 2) {
      // The gust arrives, and a calm step follows it.
      r.skGustUntil = r.skWxAt + K.gustSeconds;
      r.skGusts = gustsSoFar(run) + 1;
      r.skGustHit = 0;
      r.skWx = 0;
      r.skWxAt += K.gustSeconds + K.stepSeconds;
      failNoCrane(run);
    } else {
      const next =
        wx === 0
          ? rollWeather(run) < cloudChanceAt(run, r.skWxAt)
            ? 1
            : 0
          : rollWeather(run) < K.gustChance
            ? 2
            : 0;
      r.skWx = next;
      r.skWxAt += K.stepSeconds;
      // Once a gust is sure, so is how strong it is.
      if (next === 2) r.skStrong = rollWeather(run) < K.strongChance ? 1 : 0;
    }
  }
}

function tickTie(run: RunState): void {
  const r = run.resources;
  const state = Math.round(res(run, "skTie"));
  if (state === 1 && run.time >= res(run, "skTieAt")) {
    r.skTie = 2;
    r.skTiedAt = run.time;
    r.skTies = tiesSoFar(run) + 1;
  } else if (state === 3 && run.time >= res(run, "skTieAt")) r.skTie = 0;
  else if (
    state === 2 &&
    res(run, "skGustUntil") > res(run, "skTiedAt") &&
    run.time >= res(run, "skGustUntil")
  ) {
    // The gust that was tied against has passed: the straps come off by
    // themselves (taking the same moment as untying), so a tie is one click.
    r.skTie = 3;
    r.skTieAt = run.time + K.untieSeconds;
  }
}

/** Runs the sky for `dt` seconds. */
export function tickSky(run: RunState, dt: number): void {
  if (run.phase !== 2) return;
  const r = run.resources;
  // The strain dial eases toward where it is set.
  const set = strainStep(run);
  const now = strainNow(run);
  const move = dt / K.settleSeconds;
  r.skEff = now < set ? Math.min(set, now + move) : Math.max(set, now - move);
  if (!isSkyOpen(run)) return;
  r.skHook = res(run, "skHook") * Math.max(0, 1 - dt / K.hookSeconds);
  tickTie(run);
  tickWeather(run);
  if (res(run, "skNc") > 0 && run.time >= res(run, "skNcUntil")) {
    r.skNc = 0;
    r.skNcWins = res(run, "skNcWins") + 1;
    r.skNcWinAt = run.time;
  }
  // Nothing hangs on the hook while the crew fetches or restrings, and a tied
  // tower is safe (a tying one is still loose).
  if (isFetching(run) || isRestringing(run) || isSecured(run)) return;
  const calm = riskCalm(run);
  const strain = strainNow(run);
  if (isBlowing(run)) {
    if (res(run, "skGustHit") > 0) return;
    const power = gustPower(run);
    if (
      roll(run) <
      perSecond(
        blendAt(strain, (i) => STRAINS[i].snap),
        calm
      ) *
        power *
        dt
    ) {
      r.skGustHit = 1;
      snap(run);
    } else if (
      roll(run) <
      (perSecond(
        blendAt(strain, (i) => STRAINS[i].drop),
        calm
      ) *
        power +
        perSecond(gustFloor(run), calm)) *
        dt
    ) {
      r.skGustHit = 1;
      drop(run);
    }
    return;
  }
  if (roll(run) < snapPerCalmSecond(strain, calm, isCloudy(run)) * dt)
    snap(run);
}

/** A new site has calm air, a taut cable and the crane on. */
export function resetSky(run: RunState): void {
  const r = run.resources;
  r.skStrain = K.startStrain;
  r.skEff = K.startStrain;
  r.skWx = 0;
  r.skWxAt = 0;
  r.skGustUntil = 0;
  r.skTie = 0;
  r.skTieAt = 0;
  r.skHook = 0;
  r.skStallUntil = 0;
  r.skRestringUntil = 0;
  r.skNc = 0;
  r.skNcUntil = 0;
  r.skRestUntil = 0;
  r.skSoftUntil = 0;
}

// ------------------------------------------------------------ words and ids

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** How often each strain snaps the cable, in plain words (never which is better). */
export const SNAP_WORDS: readonly string[] = [
  "Almost never snaps",
  "Snaps now and then",
  "Snaps often in a gust",
  "Snaps very often",
];

export const strainNote = (step: number): string => {
  const s = STRAINS[step];
  return `${s.pay >= 1 ? "+" : "-"}${pct(Math.abs(s.pay - 1))} beams. ${SNAP_WORDS[step]}.`;
};

/** One radio button per strain; the sky panel draws them itself. */
export const STRAIN_ACTIONS: readonly ActionDef[] = STRAINS.map((s, i) => ({
  id: strainActionId(i),
  phases: [PHASE_SKY],
  isInline: true,
  visibleWhen: isSkyOpen,
  describe: (run) => ({
    label: s.name,
    detail: `${strainNote(i)} Clouds and gusts make a snap likelier. Changing takes a moment.`,
    isBlocked: strainStep(run) === i,
  }),
  perform: (run) => setStrain(run, i),
}));

export const SKY_ACTIONS: readonly ActionDef[] = [
  ...STRAIN_ACTIONS,
  {
    id: TIE_ACTION_ID,
    phases: [PHASE_SKY],
    isInline: true,
    visibleWhen: isSkyOpen,
    describe: (run) => {
      const state = tieState(run);
      return {
        label: state === "tied" ? "Untie" : "Tie down",
        detail:
          state === "tied"
            ? `Let the crane go again. Untying takes ${K.untieSeconds} sec and earns nothing. The straps also come off by themselves once a gust has passed.`
            : `A gust cannot drop a beam or snap a cable. The crane earns nothing while tied, and tying takes ${K.tieSeconds} sec.`,
        isBlocked: state === "tying" || state === "untying" || isNoCrane(run),
      };
    },
    perform: (run) => toggleTie(run),
  },
  {
    id: NC_START_ACTION_ID,
    phases: [PHASE_SKY],
    isInline: true,
    visibleWhen: isNcOpen,
    describe: (run) => ({
      label: "No-crane climb",
      detail: `Turn the crane off for ${K.ncSeconds} sec and hoist by hand: beams drop to ${pct(K.ncPay)}. Make it and the tower pays +${pct(K.ncBonus)} for good. A gust or a snap ends it.`,
      isBlocked: !canStartNoCrane(run),
    }),
    perform: (run) => startNoCrane(run),
  },
  {
    id: NC_STOP_ACTION_ID,
    phases: [PHASE_SKY],
    isInline: true,
    visibleWhen: (run) => isNoCrane(run),
    describe: () => ({
      label: "Crane back on",
      detail: "Give up the climb. The slow stretch is not paid back.",
      isBlocked: false,
    }),
    perform: (run) => stopNoCrane(run),
  },
];

// ---------------------------------------------------------------- the log

/** Counts of things that go in the log. */
export const skyEvents = (run: RunState): number =>
  dropsSoFar(run) + snapsSoFar(run) + ncWins(run) + ncFails(run);

export const dropLine = (run: RunState): string =>
  `DROPPED! A gust knocked a beam loose and ${formatNumber(Math.floor(res(run, "skDropN")))} beams of hoisting fell. The crew is fetching it.`;
export const snapLine = (): string =>
  "SNAP! The cable whipped loose and the load fell. The crew is restringing it.";
export const tieLine = (): string =>
  "Tied down. Nothing can fall now, and the crane waits.";
export const noCraneWinLine = (run: RunState): string =>
  `NO CRANE! A whole minute by hand. The tower pays +${pct(K.ncBonus * ncWins(run))} for good.`;
export const noCraneFailLine = (): string =>
  "The no-crane climb ended early, and the crane is back on.";

/**
 * The watched number: how safe the load is. It drops when the cable is
 * tight, when clouds gather and when a gust is near, and it is full while
 * tied down.
 */
export const SKY_CONSUMABLE: ConsumableDef = {
  id: "safe-hoist",
  label: "Safe hoisting",
  level: (run) => {
    if (!isSkyOpen(run)) return null;
    if (isSecured(run)) return 1;
    const calm = riskCalm(run);
    const risk =
      forecastOf(run) === 2 || isBlowing(run)
        ? snapInGust(strainNow(run), calm) +
          (1 - snapInGust(strainNow(run), calm)) *
            dropInGust(strainNow(run), calm, 1, gustFloor(run))
        : forecastOf(run) === 1
          ? 0.35 * snapInGust(strainNow(run), calm)
          : 0;
    return clamp01(1 - risk);
  },
  lowZone: { lo: 0.02, hi: 0.7 },
};
