import { createStore, type StoreApi } from "zustand/vanilla";
import { placeFor, type PlaceId } from "./places";
import type { Opening, ShipId, ShipSpec } from "./ships/types";
import { createSimRunner, type SimOptions, type SimRunner } from "./sim/run";
import { sampleTrack, type SimTrack } from "./sim/track";
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
/** A speed the player touched this recently (s) overrides the slow-mo. */
export const SPEED_TOUCH_HOLD_S = 10;
/** The runner's wall-time budget per frame (ms; the sim may run ~0.5 ms over). */
export const RUNNER_BUDGET_MS = 6;

/** A free-camera view in the ship frame (x forward, y port, z up; m). */
export interface ShipView {
  target: [number, number, number];
  cam: [number, number, number];
  /** Jump there instead of flying. */
  snap?: boolean;
}

/** What a run is started with beyond its openings. */
export type RunOptions = Pick<SimOptions, "portholesOpen">;

export interface PlaybackState {
  /** The ship on the stage (the title's choice, then the run's). */
  ship: ShipId;
  /** The track so far (live arrays while computing), or null before a run. */
  track: SimTrack | null;
  /** The holes this run was started with (the real night's or a What if). */
  openings: readonly Opening[];
  /** Water over the selected place's floor (m), updated by the scene. */
  placeWaterM: number;
  /** The last computed frame's time (s); playback and seeks stop here. */
  computedT: number;
  /** True once the runner has finished the whole night. */
  done: boolean;
  /** 0..1, how far the runner has got. */
  progress: number;
  /** Shown seconds after the collision. */
  t: number;
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
}

export interface PlaybackActions {
  /**
   * Starts a new run (the real night or a What if) of `spec`, which becomes
   * the ship on the stage. Resets the time to 0.
   */
  start(
    spec: ShipSpec,
    openings: readonly Opening[],
    options?: RunOptions
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
  /** Jumps to `t`, clamped to [0, computedT]. */
  seek(t: number): void;
  setCamera(camera: CameraId): void;
  /** Switches to the free camera from the current view, without a snap. */
  takeControl(): void;
  setQuality(quality: QualityTier): void;
  setXray(on: boolean): void;
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
  placeWaterM: 0,
  computedT: 0,
  done: false,
  progress: 0,
  t: 0,
  realT: 0,
  playing: false,
  speed: 10,
  slowMo: false,
  camera: "orbit",
  // iPad first: start at medium; the scene's PerformanceMonitor steps up.
  quality: "medium",
  xray: false,
  place: null,
  snapId: 0,
  flyId: 0,
  flyView: null,
  speedTouchedAt: -Infinity,
};

/** True when `t` is inside the slow-mo windows of `track`. */
export function inSlowMoWindow(track: SimTrack | null, t: number): boolean {
  if (!track) return false;
  const b = track.brokeAtT;
  if (b !== null && t >= b - SLOWMO_BREAK.before && t <= b + SLOWMO_BREAK.after)
    return true;
  const s = track.sankAtT;
  return (
    s !== null && t >= s - SLOWMO_PLUNGE.before && t <= s + SLOWMO_PLUNGE.after
  );
}

/** The speed playback actually runs at. */
export function effectiveSpeed(
  s: Pick<PlaybackState, "track" | "t" | "speed" | "camera" | "speedTouchedAt">,
  nowS: number
): number {
  if (s.camera !== "cinematic") return s.speed;
  if (nowS - s.speedTouchedAt < SPEED_TOUCH_HOLD_S) return s.speed;
  return inSlowMoWindow(s.track, s.t) ? 1 : s.speed;
}

/** The real time at shown time `t` (the sim's frames carry both). */
export function realTimeAt(track: SimTrack | null, t: number): number {
  if (!track || track.frames.length === 0) return t;
  return sampleTrack(track, t).realT;
}

function lastT(track: SimTrack | null): number {
  if (!track || track.frames.length === 0) return 0;
  return track.frames[track.frames.length - 1].t;
}

export interface PlaybackOptions {
  /** Makes the runner (tests pass a fake). */
  createRunner?: (
    spec: ShipSpec,
    openings: readonly Opening[],
    options: RunOptions
  ) => SimRunner;
}

export function createPlaybackStore(
  options: PlaybackOptions = {}
): PlaybackStore {
  const makeRunner =
    options.createRunner ??
    ((spec: ShipSpec, openings: readonly Opening[], o: RunOptions) =>
      createSimRunner(spec, openings, o));
  let runner: SimRunner | null = null;

  return createStore<PlaybackState & PlaybackActions>()((set, get) => ({
    ...INITIAL,
    start(spec, openings, options = {}) {
      runner = makeRunner(spec, openings, options);
      set({
        ship: spec.id,
        track: null,
        openings,
        computedT: 0,
        done: false,
        progress: 0,
        t: 0,
        realT: 0,
        slowMo: false,
        place: null,
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
        computedT: 0,
        done: false,
        progress: 0,
        t: 0,
        realT: 0,
        playing: false,
        slowMo: false,
        place: null,
        placeWaterM: 0,
        flyView: null,
        snapId: get().snapId + 1,
      });
    },
    pump(budgetMs = RUNNER_BUDGET_MS) {
      if (!runner || get().done) return;
      const done = runner.advance(budgetMs);
      const track = runner.track();
      const computedT = done ? Math.max(lastT(track), 0) : lastT(track);
      set({
        // A new object each pump so subscribers see the track grow.
        track: { ...track },
        computedT,
        done,
        progress: done ? 1 : runner.progress(),
      });
    },
    tick(dtReal, nowS) {
      const s = get();
      if (!s.playing || !s.track || !(dtReal > 0)) return;
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
      // Playing from the end starts the night again.
      if (s.done && s.t >= s.computedT)
        set({ t: 0, realT: 0, snapId: s.snapId + 1 });
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
      const clamped = Math.max(0, Math.min(s.computedT, t));
      set({
        t: clamped,
        realT: realTimeAt(s.track, clamped),
        snapId: s.snapId + 1,
      });
    },
    setCamera(camera) {
      set({ camera, snapId: get().snapId + 1 });
    },
    takeControl() {
      if (get().camera !== "orbit") set({ camera: "orbit" });
    },
    setQuality(quality) {
      set({ quality });
    },
    setXray(xray) {
      set({ xray });
    },
    flyToPlace(place, xray) {
      const s = get();
      set({
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
      set({ place: null, camera: "orbit", flyView: view, flyId: s.flyId + 1 });
    },
    reset() {
      runner = null;
      set({ ...INITIAL, snapId: get().snapId + 1 });
    },
  }));
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
