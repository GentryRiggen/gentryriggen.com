import type { SimEvent, SimEventKind } from "@/lib/shipwreck/sim/events";
import type { SimFrame } from "@/lib/shipwreck/sim/track";

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
  | "thud";

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
};

/** Short cues are skipped from this speed up; beds and long cues stay. */
export const THIN_FROM_SPEED = 30;
const SHORT: ReadonlySet<Cue> = new Set<Cue>([
  "rocket",
  "davit",
  "creak",
  "creakFar",
  "powerDown",
]);

/** Trim (degrees) the hull starts to complain at, and where it is loudest. */
export const CREAK_FROM_DEG = 2;
export const CREAK_FULL_DEG = 25;
/** Seconds between hull creaks at the quietest and loudest trim. */
export const CREAK_SLOW_S = 7;
export const CREAK_FAST_S = 1.2;
/** Seconds between the distant creaks heard under water. */
export const FAR_CREAK_S = 5;

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
  };
  let events: readonly SimEvent[] | null = null;
  let next = 0;
  let lastT = 0;
  let lastSnap = -1;
  let steamOn = false;
  let nextCreakAt = 0;

  function fire(cue: Cue, level: number, i: CueInput) {
    if (i.speed >= THIN_FROM_SPEED && SHORT.has(cue)) return;
    if (i.now - lastAt[cue] < CUE_GAP_S[cue]) return;
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
      steamOn = false;
      nextCreakAt = 0;
    },
    update(list, frames, i) {
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
      } else if (i.playing) {
        while (next < list.length && list[next].t <= i.t) {
          const e = list[next];
          next += 1;
          if (e.kind === "steam-start") steamOn = true;
          else if (e.kind === "steam-stop") steamOn = false;
          const cue = EVENT_CUES[e.kind];
          if (cue) fire(cue, i.underwater ? 0.5 : 1, i);
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
