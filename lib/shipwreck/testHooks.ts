import { TEST_HOOKS_ENABLED, createTestHooks } from "@/lib/game-kit/testHooks";

export { TEST_HOOKS_ENABLED };

export type ShipwreckScreen =
  "title" | "editor" | "night" | "end" | "model" | "scene";

/** What the dev/e2e model viewer (`/shipwreck?model`) shows. */
export interface ModelViewOptions {
  /** Null: whole; a ship-frame x: broken there, the halves drawn apart. */
  breakX?: number | null;
  /** 0..1, the lights. */
  power?: number;
  flicker?: number;
  quality?: "high" | "medium" | "low";
  camera?:
    | "bow"
    | "stern"
    | "side"
    | "top"
    | "break"
    | "bridge"
    | "bow-close"
    | "stern-close"
    | "astern"
    | "break-close"
    | "boat-deck"
    | "bow-port"
    | "gantry"
    | "funnel"
    | "rock"
    | "dome"
    | "keel";
  stage?: "day" | "night";
  /**
   * A livery id (repainted live, no rebuild), e.g. "cunard-1907" or the
   * Britannic's "liner".
   */
  livery?: string;
  /** The bent bow (R12), radians (ships with a hinge; default 0). */
  bowBend?: number;
  /**
   * Turn the whole ship about her length, degrees to starboard (180: keel
   * up, the Poseidon's; default 0).
   */
  roll?: number;
}

export interface ModelInfo {
  /** True once the model is built and a frame has been drawn. */
  ready: boolean;
  /** Last frame's draw calls and triangles (all passes). */
  calls: number;
  triangles: number;
  /** Triangles in the model itself (instances counted). */
  modelTriangles: number;
  /** How long the last model build took, ms. */
  buildMs: number;
  /** Which ship is on the stage (`spec.id`). */
  ship?: string;
  /** Her livery shown (null: one paint) and the last swap's time, ms. */
  livery?: string | null;
  liveryMs?: number;
}

export interface ShipwreckModelHooks {
  setModelView(view: ModelViewOptions): void;
  getModelInfo(): ModelInfo;
}

/** What `getState()` reports about the night's playback. */
export interface ScenePlaybackInfo {
  /** The ship on the stage ("titanic" | "lusitania" | "fitzgerald" |
   *  "carpathia" | "britannic"). */
  ship: string;
  t: number;
  realT: number;
  phase: string;
  eventsSeen: string[];
  quality: "high" | "medium" | "low";
  camera: string;
  xray: boolean;
  place: string | null;
  playing: boolean;
  speed: number;
  slowMo: boolean;
  done: boolean;
  computedT: number;
  progress: number;
  /** Her lean now (degrees, + to starboard, unwrapped: keel up is about 180); 0 before a run. */
  listDeg: number;
}

/** The scene's hooks (`?scene`, and later the game itself). */
export interface ShipwreckSceneHooks {
  seek(t: number): void;
  play(): void;
  pause(): void;
  setSpeed(speed: 1 | 10 | 30 | 100): void;
  setCamera(camera: string): void;
  setXray(on: boolean): void;
  flyToPlace(place: string | null): void;
  setQuality(quality: "high" | "medium" | "low"): void;
  /** The time button's hour ("real" or one she offers). */
  setTime?(id: string): void;
  /** Free camera to a ship-frame view (target and camera, x fwd, y port, z up). */
  flyToView(
    target: [number, number, number],
    cam: [number, number, number],
    snap?: boolean
  ): void;
  /** The track's events so far (kind, t, realT, index). */
  getEvents(): { kind: string; t: number; realT: number; index?: number }[];
  getState(): ScenePlaybackInfo;
  /** Last frame's draw calls and triangles (every pass) and the camera. */
  getRenderInfo(): {
    calls: number;
    triangles: number;
    camera: [number, number, number];
  } | null;
  /** Whether a named scene object ("iceberg", "coast") is on screen. */
  isShown(name: string): boolean;
  /**
   * Steps the night's computation for up to `budgetMs` now (the game does
   * 6 ms a frame; software WebGL draws few frames, so e2e computes ahead).
   */
  pump(budgetMs: number): void;
  /** Walk the deck (as the Walk button does; no-op without a walk map). */
  startWalk(): void;
  /** Gets in lifeboat `index` (default: the next due to leave), if any. */
  boardBoat(index?: number): void;
  /** Holds the stick at `forward` and `strafe` (each −1..1; 0, 0 lets go). */
  setWalkInput(forward: number, strafe: number): void;
  /** Turns the walker's view by `yawRad` (positive: to the left). */
  turnWalk(yawRad: number): void;
  /** Where the walker is, or null when not walking. */
  getWalk(): WalkHookInfo | null;
  setLookUnder(on: boolean): void;
}

/** What `getWalk()` reports. */
export interface WalkHookInfo {
  /** "deck" | "water" | "boat". */
  phase: string;
  /** The piece underfoot ("whole" | "bow" | "stern"), "none" in the water. */
  part: string;
  /** Ship frame on deck (m), earth frame in the water. */
  x: number;
  y: number;
  slopeDeg: number;
  /** Sea over the feet (m; negative when dry); 0 in the water. */
  depthM: number;
  lookUnder: boolean;
}

/** The game's own hooks: start a run, read where it is and how it ended. */
export interface ShipwreckGameHooks {
  /** Picks a ship as the title screen does (and shows the title). */
  setShip(id: string): void;
  /** The ship chosen ("titanic" | "lusitania" | "fitzgerald" | "carpathia" |
   *  "britannic"). */
  ship(): string;
  startReal(): void;
  /**
   * Starts a What if with these spots chosen (compartments open; a torpedo
   * or mine ship: where they hit; a storm ship: her leaking hatches, vents
   * and shoal scrapes), and for a torpedo or mine ship whether the
   * portholes are open, for a storm ship the storm ("real" | "calmer" |
   * "worse"), and for a mine ship whether every watertight door is shut
   * and her engines stopped at once (default: neither, as the real
   * morning), and for a rocks ship whether the wind blows her out to sea,
   * and for a wave ship the wave ("real" | "smaller" | "ahead").
   */
  startWhatIf(
    ids: string[],
    portholesOpen?: boolean,
    storm?: string,
    doorsClosed?: boolean,
    enginesStopped?: boolean,
    toSea?: boolean,
    wave?: string
  ): void;
  /** "sank" | "floated" | "broke-in-two" | "aground" | "capsized" once the run is done, else null. */
  getOutcome(): string | null;
  /** Paints the ship on the stage in livery `id`, as the paint button does. */
  setLivery(id: string): void;
  /** Her livery now (null: a ship with one paint). */
  livery(): string | null;
  /** Shows her at time `id` ("real" or another she offers), as the time button does. */
  setTime(id: string): void;
  /** The time shown ("real" unless changed). */
  time(): string;
  /** The water light under the surface (0 real, 1, 2). */
  setUnderLight(level: 0 | 1 | 2): void;
}

declare global {
  interface Window {
    __shipwreck?: {
      /** The screen the game is showing. Later tasks add more. */
      getScreen(): ShipwreckScreen;
      /** Model viewer only (`?model`, dev and e2e builds). */
      setModelView?(view: ModelViewOptions): void;
      getModelInfo?(): ModelInfo | null;
    } & Partial<ShipwreckSceneHooks> &
      Partial<ShipwreckGameHooks>;
  }
}

/** Puts the hooks on `window` when enabled. Returns a cleanup function. */
export function installTestHooks(
  getScreen: () => ShipwreckScreen,
  model?: () => ShipwreckModelHooks | null,
  scene?: ShipwreckSceneHooks,
  game?: ShipwreckGameHooks
): () => void {
  return createTestHooks<NonNullable<Window["__shipwreck"]>>("__shipwreck", {
    getScreen,
    ...(scene ?? {}),
    ...(game ?? {}),
    ...(model
      ? {
          setModelView: (view: ModelViewOptions) => model()?.setModelView(view),
          getModelInfo: () => model()?.getModelInfo() ?? null,
        }
      : {}),
  });
}
