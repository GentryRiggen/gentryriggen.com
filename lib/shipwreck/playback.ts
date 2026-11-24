import { createStore, type StoreApi } from "zustand/vanilla";
import { boardableBoats, type BoatRide } from "./boatRide";
import { resetWalkInput, walkMapFor } from "./walk";
import { placeFor, type PlaceId } from "./places";
import {
  type Opening,
  type RunOpening,
  type ShipId,
  type ShipSpec,
  isDeckOpening,
} from "./ships/types";
import {
  createSimRunner,
  FINISHER_SPOT,
  HIT_STAGGER_S,
  hitTimeS,
  type SimOptions,
  type SimRunner,
  type TorpedoHit,
} from "./sim/run";
import { sampleTrack, type SimTrack } from "./sim/track";
import type { WaveVariant } from "./sim/wave";
import { storyEndT } from "./story";
import type { CameraId, Speed } from "./types";

/**
 * The night's playback: the sim runner's track as it is computed, the shown
 * time, speed, camera, X-ray and the selected place. The scene reads `t` and
 * samples the track in its frame loop (through `store.getState()`, never
 * React state per frame); the DOM UI subscribes with `useStore`.
 *
 * See components/shipwreck/scene/README.md for the full API.
 */

export type QualityTier = "high" | "medium" | "low";
export const QUALITY_TIERS: readonly QualityTier[] = ["high", "medium", "low"];

/** Seconds around the break and the plunge played at ×1 on the cinematic camera. */
export const SLOWMO_BREAK = { before: 30, after: 45 } as const;
export const SLOWMO_PLUNGE = { before: 45, after: 15 } as const;
/**
 * A torpedo's hit (a track with a second explosion, and holes): its first
 * seconds at ×1 on the cinematic camera, through the second explosion.
 */
export const SLOWMO_HIT_S = 20;
/** And the last seconds of its run-in before the hit. */
export const SLOWMO_HIT_BEFORE_S = 20;
/**
 * A storm ship (a track with a storm): from this long before the big
 * seas (its wave group) through her bow going under, joined to the
 * break's window, at ×1, so the sea that takes her is watched at real
 * speed.
 */
export const SLOWMO_SEAS = { before: 30 } as const;
/**
 * A storm ship: her parts' fall to the floor, from just before the bow
 * strikes to just after the stern lands, at ×½ (a playback slow motion:
 * the stern's roll lasts about 3 s).
 */
export const SLOWMO_HALF = { before: 3, after: 3, speed: 0.5 } as const;
/** A wave ship's roll-over at ×1: seconds before the wave, after keel up. */
export const SLOWMO_WAVE = { before: 6, after: 8 } as const;
/** A storm ship's run starts at this speed at most (her 3¾ hours). */
export const STORM_START_SPEED = 10;
/** A speed the player touched this recently (s) overrides the slow-mo. */
export const SPEED_TOUCH_HOLD_S = 10;
/** The runner's wall-time budget per frame (ms; the sim may run ~0.5 ms over). */
export const RUNNER_BUDGET_MS = 6;
/** While a tail run holds for the runner (nothing moves): a bigger budget. */
export const HOLD_BUDGET_MS = 12;

/** A free-camera view in the ship frame (x forward, y port, z up; m). */
export interface ShipView {
  target: [number, number, number];
  cam: [number, number, number];
  /** Jump there instead of flying. */
  snap?: boolean;
}

/** The walker's state; the scene decides deck or water when `seq` changes. */
export interface WalkState {
  /** "boat": riding a lifeboat (`boat`), on the walk camera. */
  phase: "off" | "deck" | "water" | "boat";
  lookUnder: boolean;
  /** Bumped whenever the walker must be re-placed (start, seek, back on deck). */
  seq: number;
  /** The lifeboat being ridden (phase "boat" only). */
  boat?: BoatRide | null;
}

const WALK_OFF: WalkState = { phase: "off", lookUnder: false, seq: 0 };

/** What a run is started with beyond its openings. */
export type RunOptions = Pick<
  SimOptions,
  | "portholesOpen"
  | "storm"
  | "endT"
  | "doorsClosed"
  | "enginesStopped"
  | "toSea"
  | "wave"
>;

/** And what the scene needs to know of it (not the sim). */
export interface StartOptions extends RunOptions {
  /**
   * Where each torpedo strikes (ship-frame x, aft first: `torpedoHitXs`).
   * Missing: the first hole in her side at the first moment, if any.
   */
  hits?: readonly number[];
  /**
   * Every torpedo of the run in landing order (`torpedoHits`): where, when
   * and on which side. Missing: one per `hits`, hit k at `hitTimeS(k, n)`
   * on her starboard side (the Lusitania's 1.1 path).
   */
  torpedoes?: readonly TorpedoHit[];
  /**
   * Behind the title and the editor: her opening moment as a still stage
   * whose storm sea (and her ride on it) runs on the wall clock while the
   * playback is paused. Default false.
   */
  preview?: boolean;
}

/**
 * Each torpedo's hit lands `hitTimeS(k, n)` after the first event (the
 * first at 0, the sim opening hit k's holes then): re-exported for the
 * scene.
 */
export { HIT_STAGGER_S, hitTimeS };
/** A torpedo ship's What-if spot for her later torpedo: re-exported. */
export { FINISHER_SPOT };

export interface PlaybackState {
  /** The ship on the stage (the title's choice, then the run's). */
  ship: ShipId;
  /** The track so far (live arrays while computing), or null before a run. */
  track: SimTrack | null;
  /** The holes in her hull this run was started with (the real night's or
   *  a What if; deck openings go to the sim only). */
  openings: readonly Opening[];
  /** Each torpedo's or mine's hit (ship-frame x, aft first; none for
   *  other ships). */
  hits: readonly number[];
  /** Each torpedo in landing order: x, shown time and side (`TorpedoHit`). */
  torpedoes: readonly TorpedoHit[];
  /**
   * A ship with her own hits (`spec.torpedo`, the Carpathia): each hit's
   * shown time, and the cinematic camera plays each at ×1
   * (`inOwnHitWindow`). Null: the 1.1 rule (`inHitWindow`).
   */
  hitTimesS: readonly number[] | null;
  /** The title's stage (`StartOptions.preview`): her storm sea runs on. */
  preview: boolean;
  /**
   * A wave ship's run: which wave (`SimOptions.wave`) and whether any spot
   * was open (what the wave smashed): the captions' words. Null for the
   * other ships.
   */
  waveRun: { variant: WaveVariant; smashed: boolean } | null;
  /** Water over the selected place's floor (m), updated by the scene. */
  placeWaterM: number;
  /** The last computed frame's time (s); playback and seeks stop here. */
  computedT: number;
  /** True once the runner has finished the whole night. */
  done: boolean;
  /** 0..1, how far the runner has got. */
  progress: number;
  /** Shown seconds after the collision (negative in a pre-roll). */
  t: number;
  /**
   * Where this run's time starts: 0, or minus the ship's pre-roll for a
   * run with holes (a torpedo's run-in before the hit).
   */
  minT: number;
  /**
   * The ship's `timelineTail` for this run (0: the whole run). Until the
   * runner is done the time holds at 0; then `minT` and `t` move to the
   * start of the tail.
   */
  tail: number;
  /**
   * Real seconds after the collision at `t` (the sim's frame time). Equal to
   * `t` until both parts are under; the way down plays faster than real time.
   */
  realT: number;
  playing: boolean;
  /** The speed the player chose. */
  speed: Speed;
  /** True while the cinematic camera holds ×1 for the break or the plunge. */
  slowMo: boolean;
  camera: CameraId;
  walk: WalkState;
  quality: QualityTier;
  xray: boolean;
  place: PlaceId | null;
  /** Bumped on every seek and camera change: the camera rig snaps, not eases. */
  snapId: number;
  /** Bumped by flyToPlace / flyToView: the camera rig flies there. */
  flyId: number;
  /** The view flyToView asked for (null after flyToPlace). */
  flyView: ShipView | null;
  /** Wall-clock seconds when the player last touched the speed (or -Infinity). */
  speedTouchedAt: number;
  /**
   * The ship's livery shown (an id in `spec.liveries`; null or an id she
   * does not have: her default). The scene repaints the model live.
   */
  livery: string | null;
  /**
   * The time of day shown (a `TimeId` she offers; null: her real one,
   * `sceneSettingsFor`). Back to her real one with each new ship.
   */
  time: string | null;
  /**
   * How light the water is under the surface: 0 her real water, 1 and 2
   * clearer and brighter (`UNDER_LIGHT`). Kept across ships.
   */
  underLight: 0 | 1 | 2;
}

export interface PlaybackActions {
  /**
   * Starts a new run (the real night or a What if) of `spec`, which becomes
   * the ship on the stage. Resets the time to 0.
   */
  start(
    spec: ShipSpec,
    openings: readonly RunOpening[],
    options?: StartOptions
  ): void;
  /**
   * Puts another ship on the stage: a different one drops the run (the
   * game then starts her own; the scene rebuilds the model).
   */
  setShip(ship: ShipId): void;
  /** Steps the runner for up to `budgetMs`; call once per frame until done. */
  pump(budgetMs?: number): void;
  /**
   * Advances `t` by `dtReal × speed` (×1 in the slow-mo windows), clamped to
   * the computed frames. `nowS` is the wall clock in seconds.
   */
  tick(dtReal: number, nowS: number): void;
  play(): void;
  pause(): void;
  setSpeed(speed: Speed, nowS?: number): void;
  /** Jumps to `t`, clamped to [minT, computedT] (not while a tail run holds). */
  seek(t: number): void;
  setCamera(camera: CameraId): void;
  /** Switches to the free camera from the current view, without a snap. */
  takeControl(): void;
  /** Walk the deck (no-op for a ship without a walk map). */
  startWalk(): void;
  /** Back to the orbit camera; zeroes the walk controls. */
  leaveWalk(): void;
  /**
   * The walker is in the water. `steppedIn` (default true) is a real step or
   * slide off her deck: then, from the deck, the speed drops (see
   * speedOnGoingIn). False when re-placing found nowhere to stand: no change.
   */
  wentInWater(steppedIn?: boolean): void;
  /** The walker is back on the deck. */
  backOnDeck(): void;
  /**
   * Gets in lifeboat `index` (its `boat-lowered` index) now: it is lowered
   * at once and rows away, the walk camera riding in it. Needs a frame;
   * works on a ship without a walk map.
   */
  boardBoat(index: number): void;
  /** Out of the boat: on her deck if she can be walked, else the free camera. */
  leaveBoat(): void;
  setLookUnder(on: boolean): void;
  setQuality(quality: QualityTier): void;
  setXray(on: boolean): void;
  /**
   * Paints her in livery `id` (null: her default). Nothing else changes:
   * the run's time, playing state and frames stay as they are.
   */
  setLivery(id: string | null): void;
  /** Shows her at time `id` (null: her real one), live: the run goes on. */
  setTime(id: string | null): void;
  /** How light the water is under the surface (0 her real water). */
  setUnderLight(level: 0 | 1 | 2): void;
  /** Flies the free camera to a place (X-ray on for the interior places). */
  flyToPlace(place: PlaceId | null, xray?: boolean): void;
  /** The scene reports the water at the selected place (m). */
  setPlaceWater(depthM: number): void;
  /** Flies (or jumps) the free camera to a ship-frame view. */
  flyToView(view: ShipView): void;
  reset(): void;
}

export type PlaybackStore = StoreApi<PlaybackState & PlaybackActions>;

const INITIAL: PlaybackState = {
  ship: "titanic",
  track: null,
  openings: [],
  hits: [],
  torpedoes: [],
  hitTimesS: null,
  preview: false,
  waveRun: null,
  placeWaterM: 0,
  computedT: 0,
  done: false,
  progress: 0,
  t: 0,
  realT: 0,
  minT: 0,
  tail: 0,
  playing: false,
  speed: 10,
  slowMo: false,
  camera: "orbit",
  walk: WALK_OFF,
  // iPad first: start at medium; the scene's PerformanceMonitor steps up.
  quality: "medium",
  xray: false,
  place: null,
  snapId: 0,
  flyId: 0,
  flyView: null,
  speedTouchedAt: -Infinity,
  livery: null,
  time: null,
  underLight: 0,
};

/**
 * Going in this close (s of sim time) before her last piece goes under drops
 * the speed to ×1, so Look under shows her go down.
 */
export const WATCH_HER_GO_S = 300;

/**
 * The speed change when the walker goes into the water from her deck: ×1 if
 * her last piece goes under within WATCH_HER_GO_S, else at most ×10 (a faster
 * speed comes down to ×10, a slower one stays). When she has gone under is
 * `track.sankAtT`, which the run sets as soon as its computed frames reach
 * it: while it is null she is afloat through every frame computed so far, so
 * she is not known to go soon. The player can speed up again either way.
 */
export function speedOnGoingIn(
  track: SimTrack | null,
  t: number,
  speed: Speed
): Partial<Pick<PlaybackState, "speed" | "slowMo">> {
  const sank = track?.sankAtT ?? null;
  if (sank !== null && sank >= t && sank - t <= WATCH_HER_GO_S)
    return { speed: 1, slowMo: false };
  if (speed > 10) return { speed: 10, slowMo: false };
  return {};
}

/**
 * The speed the cinematic camera holds at `t` (1, or ½ for a storm ship's
 * fall to the floor), or null outside the slow-mo windows. Per ship from
 * the track: the liners' windows are the break and the plunge; a storm
 * ship's add her big seas through bow-under (`SLOWMO_SEAS`) and her fall
 * (`SLOWMO_HALF`).
 */
export function slowMoSpeed(track: SimTrack | null, t: number): number | null {
  if (!track) return null;
  // A wave ship's roll-over plays at ×1, from just before the wave to just
  // after she is keel up (a run that capsizes has no storm seas window: her
  // sea is one wave and a long float).
  const capsized = track.events.find((e) => e.kind === "capsized");
  if (capsized) {
    if (t >= -SLOWMO_WAVE.before && t <= capsized.t + SLOWMO_WAVE.after)
      return 1;
  } else if (track.storm) {
    let under: number | null = null;
    let lands: number | null = null;
    let sternLands: number | null = null;
    for (const e of track.events) {
      if (e.kind === "bow-under" && under === null) under = e.t;
      if (e.kind === "bow-lands" && lands === null) lands = e.t;
      if (e.kind === "stern-lands" && sternLands === null) sternLands = e.t;
    }
    const first = lands ?? track.brokeAtT;
    const last = sternLands ?? track.sankAtT;
    if (
      first !== null &&
      last !== null &&
      t >= first - SLOWMO_HALF.before &&
      t <= last + SLOWMO_HALF.after
    )
      return SLOWMO_HALF.speed;
    const groups = track.storm.groups;
    if (under !== null && groups && groups.length > 0) {
      let seas = groups[0].t;
      for (const g of groups) seas = Math.min(seas, g.t);
      const b = track.brokeAtT;
      const end = Math.max(under, b !== null ? b - SLOWMO_BREAK.before : under);
      if (t >= Math.min(seas, under) - SLOWMO_SEAS.before && t <= end) return 1;
    }
  }
  return inLinerWindow(track, t) ? 1 : null;
}

/** True when `t` is inside the slow-mo windows of `track`. */
export function inSlowMoWindow(track: SimTrack | null, t: number): boolean {
  return slowMoSpeed(track, t) !== null;
}

/** The break's and the plunge's windows (every ship). */
function inLinerWindow(track: SimTrack, t: number): boolean {
  const b = track.brokeAtT;
  if (b !== null && t >= b - SLOWMO_BREAK.before && t <= b + SLOWMO_BREAK.after)
    return true;
  const s = track.sankAtT;
  return (
    s !== null && t >= s - SLOWMO_PLUNGE.before && t <= s + SLOWMO_PLUNGE.after
  );
}

/** True in the first seconds after a torpedo's hit (see SLOWMO_HIT_S). */
export function inHitWindow(
  track: SimTrack | null,
  openings: readonly Opening[] | undefined,
  t: number,
  /** The run's torpedo hits: the window runs on until the last one's. */
  hitCount = 1
): boolean {
  return (
    track !== null &&
    (openings?.length ?? 0) > 0 &&
    t <=
      SLOWMO_HIT_S +
        hitTimeS(Math.max(hitCount, 1) - 1, Math.max(hitCount, 1)) &&
    t >= -SLOWMO_HIT_BEFORE_S &&
    track.events.some((e) => e.kind === "explosion")
  );
}

/**
 * A ship with her own hits (`PlaybackState.hitTimesS`): true from
 * SLOWMO_HIT_BEFORE_S before each hit (its wake running in) to SLOWMO_HIT_S
 * after it, on a run with holes. Her 10:50 AM torpedo gets its own window.
 */
export function inOwnHitWindow(
  track: SimTrack | null,
  openings: readonly Opening[] | undefined,
  t: number,
  hitTimes: readonly number[]
): boolean {
  if (track === null || (openings?.length ?? 0) === 0) return false;
  for (const h of hitTimes)
    if (t >= h - SLOWMO_HIT_BEFORE_S && t <= h + SLOWMO_HIT_S) return true;
  return false;
}

/** The speed playback actually runs at. */
export function effectiveSpeed(
  s: Pick<
    PlaybackState,
    "track" | "t" | "speed" | "camera" | "speedTouchedAt"
  > & {
    openings?: readonly Opening[];
    hits?: readonly number[];
    hitTimesS?: readonly number[] | null;
  },
  nowS: number
): number {
  if (s.camera !== "cinematic") return s.speed;
  if (nowS - s.speedTouchedAt < SPEED_TOUCH_HOLD_S) return s.speed;
  const slow = slowMoSpeed(s.track, s.t);
  if (slow !== null) return slow;
  if (s.hitTimesS)
    return inOwnHitWindow(s.track, s.openings, s.t, s.hitTimesS) ? 1 : s.speed;
  return inHitWindow(s.track, s.openings, s.t, s.hits?.length) ? 1 : s.speed;
}

/**
 * The run's torpedoes (`StartOptions.torpedoes`), or, missing, one per hit
 * x at `hitTimeS` on her starboard side (the 1.1 path).
 */
function torpedoesOf(
  hits: readonly number[],
  given: readonly TorpedoHit[] | undefined
): readonly TorpedoHit[] {
  if (given) return given;
  return hits.map((x, k) => ({
    x,
    t: hitTimeS(k, hits.length),
    side: "starboard" as const,
    finisher: false,
  }));
}

/**
 * The speed a run starts at: the player's, but a storm ship's long
 * afternoon at most ×10 (at ×30 her sea plays as a time-lapse).
 */
export function startSpeed(spec: ShipSpec, saved: Speed): Speed {
  // A wave ship's roll lasts 25 s: at ×30 it would be gone in a blink.
  return (spec.cause === "storm" || spec.cause === "wave") &&
    saved > STORM_START_SPEED
    ? STORM_START_SPEED
    : saved;
}

/** The real time at shown time `t` (the sim's frames carry both). */
export function realTimeAt(track: SimTrack | null, t: number): number {
  // Before the first event (a pre-roll) the clock simply runs.
  if (t < 0 || !track || track.frames.length === 0) return t;
  return sampleTrack(track, t).realT;
}

/**
 * A finished tail run's start: the last `tail` of its story (to the end
 * the timeline shows), whole seconds.
 */
export function tailStartT(track: SimTrack, tail: number): number {
  const end = storyEndT(track, true) ?? lastT(track);
  return Math.max(0, Math.floor(end * (1 - tail)));
}

function tailStart(
  track: SimTrack,
  tail: number,
  snapId: number
): Partial<PlaybackState> {
  const minT = tailStartT(track, tail);
  return { minT, t: minT, realT: realTimeAt(track, minT), snapId: snapId + 1 };
}

function lastT(track: SimTrack | null): number {
  if (!track || track.frames.length === 0) return 0;
  return track.frames[track.frames.length - 1].t;
}

export interface PlaybackOptions {
  /** Makes the runner (tests pass a fake). */
  createRunner?: (
    spec: ShipSpec,
    openings: readonly RunOpening[],
    options: RunOptions
  ) => SimRunner;
}

export function createPlaybackStore(
  options: PlaybackOptions = {}
): PlaybackStore {
  const makeRunner =
    options.createRunner ??
    ((spec: ShipSpec, openings: readonly RunOpening[], o: RunOptions) =>
      createSimRunner(spec, openings, o));
  let runner: SimRunner | null = null;

  return createStore<PlaybackState & PlaybackActions>()((set, get) => {
    /** Walk off, the camera back to orbit if it was walking. */
    const walkOff = (): Partial<PlaybackState> => {
      resetWalkInput();
      const s = get();
      return {
        walk: { phase: "off", lookUnder: false, seq: s.walk.seq },
        ...(s.camera === "walk" ? { camera: "orbit" as const } : {}),
      };
    };
    return {
      ...INITIAL,
      start(spec, given, options = {}) {
        const {
          hits: chosen,
          torpedoes: givenTorpedoes,
          preview = false,
          ...run
        } = options;
        runner = makeRunner(spec, given, run);
        const openings = given.filter((o): o is Opening => !isDeckOpening(o));
        const firstHole = openings.find(
          (o) => o.side === "starboard" && (o.t ?? 0) === 0
        );
        // Torpedoes and mines (a mine has no track: the HUD counts them).
        const torpedoesGiven =
          spec.cause !== "torpedo" ? undefined : givenTorpedoes;
        const hits =
          spec.cause !== "torpedo" && spec.cause !== "mine"
            ? []
            : (chosen ??
              (torpedoesGiven
                ? torpedoesGiven.map((h) => h.x).sort((a, b) => a - b)
                : firstHole
                  ? [firstHole.x]
                  : []));
        const torpedoes =
          spec.cause !== "torpedo" ? [] : torpedoesOf(hits, torpedoesGiven);
        // The run-in plays before a hit at the first moment only (her
        // U-boat alone strikes at 10:50 AM: no wake comes at 9:15). A rocks
        // ship always gets her lit passage first, whichever rooms the rock
        // opens (even none: she sails past).
        const pre =
          spec.cause === "rocks" ||
          spec.cause === "wave" ||
          (openings.length > 0 && openings.some((o) => (o.t ?? 0) <= 0))
            ? (spec.preRollS ?? 0)
            : 0;
        const minT = pre > 0 ? -pre : 0;
        const tail = preview ? 0 : (spec.timelineTail ?? 0);
        set({
          ship: spec.id,
          track: null,
          openings,
          hits,
          torpedoes,
          hitTimesS: spec.torpedo ? torpedoes.map((h) => h.t) : null,
          preview,
          waveRun:
            spec.cause === "wave"
              ? { variant: run.wave ?? "real", smashed: given.length > 0 }
              : null,
          computedT: 0,
          done: false,
          progress: 0,
          t: minT,
          realT: minT,
          minT,
          tail,
          slowMo: false,
          place: null,
          ...walkOff(),
          snapId: get().snapId + 1,
        });
      },
      setShip(ship) {
        if (ship === get().ship) return;
        runner = null;
        set({
          ship,
          track: null,
          openings: [],
          hits: [],
          torpedoes: [],
          hitTimesS: null,
          preview: false,
          waveRun: null,
          computedT: 0,
          done: false,
          progress: 0,
          t: 0,
          realT: 0,
          minT: 0,
          tail: 0,
          playing: false,
          slowMo: false,
          place: null,
          placeWaterM: 0,
          flyView: null,
          // Her own default until the game applies her saved livery.
          livery: null,
          // Her real time again.
          time: null,
          ...walkOff(),
          snapId: get().snapId + 1,
        });
      },
      pump(budgetMs = RUNNER_BUDGET_MS) {
        const s = get();
        if (!runner || s.done) return;
        const done = runner.advance(
          s.tail > 0 ? Math.max(budgetMs, HOLD_BUDGET_MS) : budgetMs
        );
        const track = { ...runner.track() };
        const computedT = done ? Math.max(lastT(track), 0) : lastT(track);
        set({
          // A new object each pump so subscribers see the track grow.
          track,
          computedT,
          done,
          progress: done ? 1 : runner.progress(),
          ...(done && s.tail > 0 ? tailStart(track, s.tail, s.snapId) : {}),
        });
      },
      tick(dtReal, nowS) {
        const s = get();
        if (!s.playing || !s.track || !(dtReal > 0)) return;
        // A tail run holds at its first moment until the tail is known.
        if (s.tail > 0 && !s.done) return;
        const speed = effectiveSpeed(s, nowS);
        const end = s.computedT;
        const t = Math.min(end, s.t + dtReal * speed);
        const atEnd = s.done && t >= end;
        const slowMo = speed !== s.speed;
        set({
          t,
          realT: realTimeAt(s.track, t),
          playing: !atEnd,
          ...(slowMo !== s.slowMo ? { slowMo } : {}),
        });
      },
      play() {
        const s = get();
        // Playing from the end starts the night again (out of a lifeboat:
        // the ride had not happened yet).
        if (s.done && s.t >= s.computedT)
          set({
            t: s.minT,
            realT: s.minT,
            snapId: s.snapId + 1,
            ...(s.walk.phase === "boat"
              ? { ...walkOff(), camera: "orbit" as const }
              : {}),
          });
        set({ playing: true });
      },
      pause() {
        set({ playing: false });
      },
      setSpeed(speed, nowS = performance.now() / 1000) {
        set({ speed, speedTouchedAt: nowS, slowMo: false });
      },
      seek(t) {
        const s = get();
        // Holding for the tail: nothing to scrub to yet.
        if (s.tail > 0 && !s.done) return;
        const clamped = Math.max(s.minT, Math.min(s.computedT, t));
        // Back to before they got in: the ride never happened.
        if (
          s.walk.phase === "boat" &&
          s.walk.boat &&
          clamped < s.walk.boat.at
        ) {
          set({
            t: clamped,
            realT: realTimeAt(s.track, clamped),
            ...walkOff(),
            camera: "orbit",
            snapId: s.snapId + 1,
          });
          return;
        }
        set({
          t: clamped,
          realT: realTimeAt(s.track, clamped),
          snapId: s.snapId + 1,
          ...(s.walk.phase !== "off"
            ? { walk: { ...s.walk, seq: s.walk.seq + 1 } }
            : {}),
        });
      },
      setCamera(camera) {
        if (camera === "walk") {
          get().startWalk();
          return;
        }
        set({ ...walkOff(), camera, snapId: get().snapId + 1 });
      },
      takeControl() {
        if (get().camera !== "orbit") set({ ...walkOff(), camera: "orbit" });
      },
      startWalk() {
        const s = get();
        if (!walkMapFor(s.ship)) return;
        set({
          camera: "walk",
          walk: { phase: "deck", lookUnder: false, seq: s.walk.seq + 1 },
          snapId: s.snapId + 1,
        });
      },
      leaveWalk() {
        set({ ...walkOff(), camera: "orbit", snapId: get().snapId + 1 });
      },
      wentInWater(steppedIn = true) {
        const s = get();
        if (s.walk.phase === "off") return;
        set({
          walk: { ...s.walk, phase: "water" },
          ...(s.walk.phase === "deck" && steppedIn
            ? speedOnGoingIn(s.track, s.t, s.speed)
            : {}),
        });
      },
      backOnDeck() {
        const s = get();
        if (s.walk.phase === "off") return;
        set({
          walk: { phase: "deck", lookUnder: false, seq: s.walk.seq + 1 },
        });
      },
      boardBoat(index) {
        const s = get();
        if (!s.track || s.track.frames.length === 0) return;
        // Only a boat still in its davits (one already lowering or away
        // would jump back to them).
        if (!boardableBoats(s.track.events, s.t).includes(index)) return;
        resetWalkInput();
        set({
          camera: "walk",
          walk: {
            phase: "boat",
            lookUnder: false,
            seq: s.walk.seq + 1,
            boat: { index, at: s.t },
          },
          place: null,
          xray: false,
          // Down the side at once, not hanging in the davits while paused.
          playing: true,
          snapId: s.snapId + 1,
        });
      },
      leaveBoat() {
        const s = get();
        if (s.walk.phase !== "boat") return;
        if (walkMapFor(s.ship)) {
          resetWalkInput();
          set({
            camera: "walk",
            walk: { phase: "deck", lookUnder: false, seq: s.walk.seq + 1 },
            snapId: s.snapId + 1,
          });
        } else get().leaveWalk();
      },
      setLookUnder(on) {
        const s = get();
        if (s.walk.phase === "off") return;
        set({ walk: { ...s.walk, lookUnder: on } });
      },
      setQuality(quality) {
        set({ quality });
      },
      setXray(xray) {
        set({ xray });
      },
      setLivery(livery) {
        if (livery !== get().livery) set({ livery });
      },
      setTime(time) {
        if (time !== get().time) set({ time });
      },
      setUnderLight(underLight) {
        if (underLight !== get().underLight) set({ underLight });
      },
      flyToPlace(place, xray) {
        const s = get();
        set({
          ...(place ? walkOff() : {}),
          place,
          camera: place ? "orbit" : s.camera,
          xray: xray ?? (placeFor(s.ship, place)?.interior ? true : s.xray),
          flyId: s.flyId + 1,
          flyView: null,
        });
      },
      setPlaceWater(depthM) {
        if (Math.abs(depthM - get().placeWaterM) >= 0.05)
          set({ placeWaterM: depthM });
      },
      flyToView(view) {
        const s = get();
        set({
          ...walkOff(),
          place: null,
          camera: "orbit",
          flyView: view,
          flyId: s.flyId + 1,
        });
      },
      reset() {
        runner = null;
        resetWalkInput();
        set({
          ...INITIAL,
          walk: { ...WALK_OFF, seq: get().walk.seq },
          snapId: get().snapId + 1,
        });
      },
    };
  });
}

/** The game's one playback store. */
export const playback: PlaybackStore = createPlaybackStore();

export type NightPhase =
  | "settling"
  | "lifeboats"
  | "final-plunge"
  | "breakup"
  | "descent"
  | "wreck"
  | "afloat";

/** Where in the story `t` is, from the track's own events. */
export function phaseAt(track: SimTrack | null, t: number): NightPhase {
  if (!track) return "settling";
  let firstBoat: number | null = null;
  let lastBoat: number | null = null;
  let landed: number | null = null;
  let steady: number | null = null;
  for (const e of track.events) {
    if (e.kind === "boat-lowered" && firstBoat === null) firstBoat = e.t;
    if (e.kind === "last-boat") lastBoat = e.t;
    if (e.kind === "floating-steady") steady = e.t;
    if (e.kind === "bow-lands" || e.kind === "stern-lands")
      landed = Math.max(landed ?? 0, e.t);
  }
  if (landed !== null && t >= landed) return "wreck";
  if (track.sankAtT !== null && t >= track.sankAtT) return "descent";
  if (track.brokeAtT !== null && t >= track.brokeAtT) return "breakup";
  if (steady !== null && t >= steady) return "afloat";
  if (lastBoat !== null && t >= lastBoat) return "final-plunge";
  if (firstBoat !== null && t >= firstBoat) return "lifeboats";
  return "settling";
}

/** The kinds of event that have happened by `t`, in order. */
export function eventsSeen(track: SimTrack | null, t: number): string[] {
  if (!track) return [];
  return track.events.filter((e) => e.t <= t).map((e) => e.kind);
}
