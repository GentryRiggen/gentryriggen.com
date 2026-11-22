import type { SimEvent, SimEventKind } from "@/lib/shipwreck/sim/events";
import type { SimFrame } from "@/lib/shipwreck/sim/track";
import type { ShipId, StormSpec } from "@/lib/shipwreck/ships/types";
import { rampAt } from "@/lib/shipwreck/sim/waves";
import { hitTimeS } from "@/lib/shipwreck/sim/run";

/** Every one-shot the night can make. No voices of any kind. */
export type Cue =
  | "scrape"
  | "rocket"
  | "davit"
  | "creak"
  | "creakFar"
  | "rush"
  | "funnel"
  | "powerDown"
  | "breakup"
  | "plunge"
  | "thud"
  | "torpedo"
  | "boom"
  | "gull"
  | "splash"
  | "swell"
  | "hatch"
  | "waveCrash";

/** Which event makes which cue (events not listed make none). */
export const EVENT_CUES: Partial<Record<SimEventKind, Cue>> = {
  collision: "scrape",
  rocket: "rocket",
  "boat-lowered": "davit",
  "last-boat": "davit",
  "forecastle-under": "rush",
  "bridge-under": "rush",
  "funnel-falls": "funnel",
  "lights-out": "powerDown",
  breakup: "breakup",
  "bow-under": "plunge",
  "stern-under": "plunge",
  "bow-lands": "thud",
  "stern-lands": "thud",
};

/**
 * The Lusitania's afternoon: her torpedo is a muffled thud (no scrape), the
 * second explosion a deeper, longer rumble, and she fired no rockets.
 */
export const LUSITANIA_EVENT_CUES: Partial<Record<SimEventKind, Cue>> = {
  ...EVENT_CUES,
  collision: "torpedo",
  explosion: "boom",
  rocket: undefined,
};

/**
 * The Edmund Fitzgerald's afternoon: the run opens at 3:30 PM with the damage
 * already done, so no scrape, only a quiet storm swell. Each hatch cover that
 * gives way sounds (rate limited), and her end is the shared breakup, dive
 * and landing. No rocket, no whistle (her funnel never falls).
 */
export const FITZGERALD_EVENT_CUES: Partial<Record<SimEventKind, Cue>> = {
  collision: "swell",
  "hatch-fails": "hatch",
  "lights-out": "powerDown",
  breakup: "breakup",
  "bow-under": "plunge",
  "stern-under": "plunge",
  "bow-lands": "thud",
  "stern-lands": "thud",
};

/** The event-to-cue map for a ship (the Titanic's is `EVENT_CUES`). */
export function eventCuesFor(ship: ShipId): Partial<Record<SimEventKind, Cue>> {
  if (ship === "lusitania") return LUSITANIA_EVENT_CUES;
  if (ship === "fitzgerald") return FITZGERALD_EVENT_CUES;
  return EVENT_CUES;
}

/** The wind's loudness (0..1) from the storm's sea at shown time `t`. */
export const WIND_FULL_KN = 60;
export function windAt(
  storm: StormSpec | undefined,
  scale: number,
  t: number
): number {
  if (!storm) return 0;
  return Math.min(1, (storm.windKn / WIND_FULL_KN) * rampAt(storm, t) * scale);
}

/** Seconds (wall clock) before the same cue may sound again. */
export const CUE_GAP_S: Record<Cue, number> = {
  scrape: 4,
  rocket: 0.6,
  davit: 0.8,
  creak: 1,
  creakFar: 3,
  rush: 2,
  funnel: 1,
  powerDown: 2,
  breakup: 4,
  plunge: 4,
  thud: 2,
  // Under the stagger between a multi-torpedo run's hits (3 s).
  torpedo: 2,
  boom: 4,
  gull: 4,
  splash: 2,
  swell: 6,
  hatch: 3,
  waveCrash: 2,
};

/** Short cues are skipped from this speed up; beds and long cues stay. */
export const THIN_FROM_SPEED = 30;
const SHORT: ReadonlySet<Cue> = new Set<Cue>([
  "rocket",
  "davit",
  "creak",
  "creakFar",
  "powerDown",
  "gull",
]);

/** Trim (degrees) the hull starts to complain at, and where it is loudest. */
export const CREAK_FROM_DEG = 2;
export const CREAK_FULL_DEG = 25;
/** Seconds between hull creaks at the quietest and loudest trim. */
export const CREAK_SLOW_S = 7;
export const CREAK_FAST_S = 1.2;
/** Seconds between the distant creaks heard under water. */
export const FAR_CREAK_S = 5;

/** Seconds between the distant gulls (a floor and a spread). */
export const GULL_MIN_S = 9;
export const GULL_SPREAD_S = 8;
/** Gulls stop once she is listing past this strain (0..1). */
export const GULL_UNTIL_STRAIN = 0.5;

/** What the scheduler reads from the playback store each change. */
export interface CueInput {
  t: number;
  playing: boolean;
  /** The speed playback really runs at (1 in the slow-mo windows). */
  speed: number;
  /** Bumped by every seek and camera change. */
  snapId: number;
  underwater: boolean;
  /** Wall clock, seconds. */
  now: number;
  /** The ship on the stage (the Titanic when left out). */
  ship?: ShipId;
  /** Walking the deck (left out: not walking). */
  walk?: WalkCueInput;
  /** The run's torpedo hits (each lands at `hitTimeS`; the first is the
   *  collision event). */
  hits?: number;
  /** The run's storm (with `stormScale`): wind, and its wave groups' crashes. */
  storm?: StormSpec;
  stormScale?: number;
}

/** What the walk tells the sound (from the scene runtime). */
export interface WalkCueInput {
  phase: "off" | "deck" | "water";
  /** Bumped each time they go into the sea. */
  splash: number;
}

/** The held sounds, written by the scheduler and read by the beds. */
export interface BedState {
  /** Steam is venting (between steam-start and steam-stop, while playing). */
  steam: boolean;
  /** 0..1 how much power the ship has: the machinery hum. */
  power: number;
  /** 0..1 the hull's strain, from her trim. */
  strain: number;
  underwater: boolean;
  speed: number;
  /** Which ship's afternoon or night the beds make (Titanic if absent). */
  ship?: ShipId;
  /** 0..1 how hard the wind blows (the storm's, rising with its sea). */
  wind?: number;
}

export interface CueScheduler {
  readonly bed: BedState;
  /** Call on every store change; allocates nothing. */
  update(
    events: readonly SimEvent[],
    frames: readonly SimFrame[],
    i: CueInput
  ): void;
  /** Forget everything (a new run). */
  reset(): void;
}

/** The frame nearest `t` (binary search, no allocation). */
export function frameNear(
  frames: readonly SimFrame[],
  t: number
): SimFrame | null {
  const n = frames.length;
  if (n === 0) return null;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return frames[lo];
}

/**
 * Turns the playback's time into cues. Events that pass during normal
 * playback fire their cue; a seek (or a restart) just moves the pointer, so
 * skipped events never sound. At ×30 and up the short cues are dropped, and
 * every cue is rate limited by the wall clock.
 */
export function createCueScheduler(
  emit: (cue: Cue, level: number) => void
): CueScheduler {
  const bed: BedState = {
    steam: false,
    power: 1,
    strain: 0,
    underwater: false,
    speed: 1,
  };
  const lastAt: Record<Cue, number> = {
    scrape: -Infinity,
    rocket: -Infinity,
    davit: -Infinity,
    creak: -Infinity,
    creakFar: -Infinity,
    rush: -Infinity,
    funnel: -Infinity,
    powerDown: -Infinity,
    breakup: -Infinity,
    plunge: -Infinity,
    thud: -Infinity,
    torpedo: -Infinity,
    boom: -Infinity,
    gull: -Infinity,
    splash: -Infinity,
    swell: -Infinity,
    hatch: -Infinity,
    waveCrash: -Infinity,
  };
  let events: readonly SimEvent[] | null = null;
  let next = 0;
  let lastT = 0;
  let lastSnap = -1;
  let steamOn = false;
  let nextCreakAt = 0;
  let nextGullAt = 0;
  let gulls = 0;
  /** The walk's splash count last seen (null before the first update). */
  let lastSplash: number | null = null;

  /**
   * Plays a cue unless thinned by speed or within its gap. `scheduled`: a
   * cue at its own sim time (a torpedo's later hit), which the wall-clock
   * gap must not drop at a fast speed.
   */
  function fire(cue: Cue, level: number, i: CueInput, scheduled = false) {
    if (i.speed >= THIN_FROM_SPEED && SHORT.has(cue)) return;
    if (!scheduled && i.now - lastAt[cue] < CUE_GAP_S[cue]) return;
    lastAt[cue] = i.now;
    emit(cue, level);
  }

  /**
   * Puts the pointer after `t` and works out the held state, silently. At
   * the very start of a run (`atStart`) events exactly at `t` stay ahead,
   * so the collision at t = 0 still sounds once playback moves.
   */
  function reposition(list: readonly SimEvent[], t: number, atStart: boolean) {
    next = 0;
    steamOn = false;
    while (
      next < list.length &&
      (atStart ? list[next].t < t : list[next].t <= t)
    ) {
      const k = list[next].kind;
      if (k === "steam-start") steamOn = true;
      else if (k === "steam-stop") steamOn = false;
      next += 1;
    }
  }

  return {
    bed,
    reset() {
      events = null;
      next = 0;
      lastT = 0;
      lastSnap = -1;
      lastSplash = null;
      steamOn = false;
      nextCreakAt = 0;
      nextGullAt = 0;
    },
    update(list, frames, i) {
      const ship = i.ship ?? "titanic";
      const cues = eventCuesFor(ship);
      const jump = 1 + 0.5 * i.speed;
      const isNewRun = list !== events || list.length < next;
      const seeked =
        isNewRun ||
        i.t < lastT ||
        (i.snapId !== lastSnap && i.t - lastT > jump);
      events = list;
      lastSnap = i.snapId;
      if (seeked) {
        reposition(list, i.t, isNewRun && i.t <= 0);
        nextCreakAt = i.now;
        nextGullAt = i.now + GULL_MIN_S / 2;
      } else if (i.playing) {
        while (next < list.length && list[next].t <= i.t) {
          const e = list[next];
          next += 1;
          if (e.kind === "steam-start") steamOn = true;
          else if (e.kind === "steam-stop") steamOn = false;
          const cue = cues[e.kind];
          if (cue) fire(cue, i.underwater ? 0.5 : 1, i);
        }
        // A multi-torpedo run's later hits land staggered after t = 0.
        const n = i.hits ?? 0;
        if (ship === "lusitania" && n > 1)
          for (let k = 1; k < n; k += 1) {
            const tk = hitTimeS(k, n);
            if (tk > lastT && tk <= i.t) fire("torpedo", 1, i, true);
          }
        // Her wave groups break on her, one per sea, centred on the group's
        // biggest crest at `t`.
        const groups = i.storm?.groups;
        if (groups)
          for (let g = 0; g < groups.length; g += 1) {
            const grp = groups[g];
            for (let k = 0; k < grp.count; k += 1) {
              const tk = grp.t + (k - (grp.count - 1) / 2) * grp.periodS;
              if (tk > lastT && tk <= i.t)
                fire("waveCrash", i.underwater ? 0.5 : 1, i);
            }
          }
      }
      lastT = i.t;

      const f = frameNear(frames, i.t);
      const trim = f ? Math.abs(f.trimDeg) : 0;
      bed.power = f ? f.power : 1;
      bed.strain = Math.min(
        1,
        Math.max(0, (trim - CREAK_FROM_DEG) / (CREAK_FULL_DEG - CREAK_FROM_DEG))
      );
      bed.steam = steamOn && i.playing;
      bed.underwater = i.underwater;
      bed.speed = i.speed;
      bed.ship = ship;
      bed.wind = windAt(i.storm, i.stormScale ?? 1, i.t);

      // Her afternoon: a gull now and then, far off, while she is upright.
      if (
        ship === "lusitania" &&
        i.playing &&
        !i.underwater &&
        bed.strain < GULL_UNTIL_STRAIN &&
        i.now >= nextGullAt
      ) {
        fire("gull", 0.5 + 0.5 * ((gulls * 0.37) % 1), i);
        gulls += 1;
        nextGullAt = i.now + GULL_MIN_S + ((gulls * 0.618) % 1) * GULL_SPREAD_S;
      }

      // Walking (real time, playing or not): a splash on going in.
      const w = i.walk;
      if (w && w.phase !== "off") {
        if (lastSplash !== null && w.splash > lastSplash && w.phase === "water")
          fire("splash", 1, i);
      }
      if (w) lastSplash = w.splash;

      // Groans as she tilts: faster and louder with the trim; far-off
      // creaks when the camera is under the sea.
      if (i.playing && i.now >= nextCreakAt) {
        if (i.underwater) {
          fire("creakFar", 0.6, i);
          nextCreakAt = i.now + FAR_CREAK_S;
        } else if (bed.strain > 0) {
          fire("creak", bed.strain, i);
          nextCreakAt =
            i.now + CREAK_SLOW_S - (CREAK_SLOW_S - CREAK_FAST_S) * bed.strain;
        } else nextCreakAt = i.now + 1;
      }
    },
  };
}
