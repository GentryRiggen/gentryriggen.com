import type { Group } from "three";
import type { TitanicHandles } from "@/components/shipwreck/model/shipModel";
import type { PlaceId } from "@/lib/shipwreck/places";
import type { StormSpec } from "@/lib/shipwreck/ships/types";
import type { SimFrame } from "@/lib/shipwreck/sim/track";
import type { WalkerView } from "./walkCamera";
import {
  boardingElevation,
  type WaveFieldArrays,
} from "@/lib/shipwreck/sim/waves";

/**
 * What the scene's parts share each frame without React: the sampled sim
 * frame, the model's visible parts, and a few effect values. One per scene,
 * written by the ship rig (priority -2) and read by the camera, effects and
 * sea after it.
 */
export interface SceneRuntime {
  frame: SimFrame | null;
  /** True once the sampled frame has two bodies. */
  broken: boolean;
  /** The models: whole (one piece) and split (bow and stern), once built. */
  whole: TitanicHandles | null;
  split: TitanicHandles | null;
  /** The group posed as each sim part right now (null if not drawn). */
  part(name: "whole" | "bow" | "stern"): Group | null;
  /** 0..1 rocket flash this frame (lights the scene and the sea). */
  flash: number;
  /** True while the sea renders its reflection (effects may skip work). */
  reflecting: boolean;
  /** Camera under the sea surface. */
  underwater: boolean;
  /** The place pins' DOM (PlacePins registers, XRay positions them). */
  pins: Map<PlaceId, { el: HTMLElement; label: HTMLElement }>;
  /**
   * Her wake while she has way (a ship with `headway`): the stern on the
   * sea (three x, z), her heading (unit, three x, z), 0..1 of her starting
   * speed, and how far she has come (m). The ship rig writes it.
   */
  wake: {
    x: number;
    z: number;
    dx: number;
    dz: number;
    amount: number;
    length: number;
    /**
     * A turning ship's wake (the Britannic's, `WAKE_PATH_POINTS`): her
     * stern's path back over the last minute or so, three (x, z) pairs
     * from now backward, `pathN` of them (0: the straight wake).
     */
    path: Float32Array;
    pathN: number;
  };
  /**
   * Walking (WalkRunner, priority −1.5): the first-person eyes, null when
   * not walking; CameraRig stands the camera there on the "walk" camera.
   */
  walker: WalkerView | null;
  /** True while floating and looking under (clear water, her lights on). */
  walkLookUnder: boolean;
  /** Bumped each time the walker goes into the sea (the splash). */
  walkSplash: number;
  /** True while floating and Back on deck could put them on her now. */
  walkCanReboard: boolean;
  /**
   * True while the walk controls are hidden (the end card): the keys and any
   * held input do not move the walker. Written by WalkHud.
   */
  walkInputOff: boolean;
  /** For the test hooks: where the walker is (null when not walking). */
  walkInfo: WalkInfo | null;
  /**
   * Inside her (WalkRunner writes them): whether the walker stands in an
   * interior room, the area they stand in (null off her deck), the deck
   * door they last came in by (Go outside's first choice), and a counter
   * bumped each time the lift goes (the HUD's wipe).
   */
  walkInside: boolean;
  walkRoom: string | null;
  walkCameInBy: string | null;
  walkLift: number;
  /**
   * On her deck: the index (in the map's stairs) of the deck door within
   * reach to go in by, or −1. WalkRunner writes it a few times a second.
   */
  walkDoor: number;
  /**
   * Riding her glass lift (WalkRunner writes it each frame; null when not
   * riding): the shaft, the stops from and to (indices, bottom to top),
   * seconds in and the car floor's ship-frame z now. Interior draws the
   * car there and every zone the shaft passes. One object, written in place.
   */
  walkRide: WalkRide | null;
  /**
   * In a glass car, not riding: which ways a ride can go (bit 1 up, bit 2
   * down: a dry stop that way); 0 anywhere else. The HUD's ▲ ▼.
   */
  walkLiftDirs: number;
  /**
   * Her glass cars' floors as drawn (Interior writes them each frame, per
   * lift id, ship-frame z; null while her lifts are not built). WalkRunner
   * keeps a landing's door into a car shut until its car is at that stop.
   */
  walkLiftCarZ: Map<string, number> | null;
  /**
   * A request to stand the walker somewhere (`requestWalkPlace`: the test
   * hooks and the picker's rooms), ship frame, on her whole piece or the
   * piece under x; WalkRunner takes it next frame.
   */
  walkPlace: { area: string; x: number; y: number; yaw: number } | null;
  /**
   * Inside her: each room's shown water level (Interior eases it each
   * frame for the rooms it draws, priority −1.4); WalkRunner's `waterZ`
   * reads it, and a room's target when it is not drawn. Null while the
   * interior is not built.
   */
  interiorLevels: InteriorLevels | null;
  /**
   * Her emergency lights' dip this frame (Interior writes it): 1 is no
   * dip; while her power is at the emergency level it follows
   * `emergencyFlicker`, never under 0.1 (softened for reduced motion). Her
   * emergency lamps' shader multiplies it in (`uEmergency`).
   */
  interiorEmergency: number;
  /**
   * The water around the walker inside her (Interior writes it): 0 dry to 1
   * at a metre, the deepest of their room and the rooms open to it. The
   * sound's wash follows it.
   */
  walkWet: number;
  /**
   * In one of her sea-view rooms (`Room.seaView`: her balcony, stateroom,
   * ocean-view cabin), 0..1 eased (Interior writes it): the night sea is
   * lifted a little by it (her moonlit sea's shader only), so kids see
   * the water out there. 0 anywhere else, and for every other ship.
   */
  walkSeaView: number;
  /**
   * Riding a lifeboat: the player's look, a yaw turned from facing her
   * (radians, + to port) and a pitch (WalkRunner turns both by the drag),
   * and whether a ride's first frame has zeroed it. Effects writes
   * `rideView` into `walker`.
   */
  ride: { yaw: number; pitch: number; aimed: boolean };
  rideView: WalkerView;
  /**
   * While on her deck: the lifeboat beside the walker they can get in
   * (its `boat-lowered` index), or −1. Effects writes it.
   */
  boardable: number;
  /**
   * The storm's sea this frame (a storm ship: her track's storm, the field
   * the sea shader draws and the time it is drawn at; real seconds, or the
   * wall clock on the title's stage). The ship rig writes it; `storm` is
   * null without one.
   */
  sea: {
    storm: StormSpec | null;
    scale: number;
    field: WaveFieldArrays | null;
    t: number;
    /** The sea's height under the camera (the camera rig writes it). */
    atCamera: number;
  };
  /** The sea's surface height (three y) at a three.js (x, z): 0 if calm. */
  seaY(x: number, z: number): number;
  /**
   * Her deck lamps (three.js x, y, z each, `lampCount` of them, up to
   * MAX_LAMPS) and their strength, for the storm's sea, spray, snow and
   * green water to catch (0 when out). The first two are the scene's
   * point lights; the rest light only those shaders.
   */
  lamps: Float32Array;
  lampCount: number;
  lampPower: number;
  /**
   * A storm's light pinned by the time button (0–1), or null: it follows
   * the clock (`stormLightAt`).
   */
  stormLight: number | null;
  /** How light the water is under the surface (the store's `underLight`). */
  underLight: 0 | 1 | 2;
  /**
   * White water on the storm's sea where a ship rolled over (the
   * Poseidon's, `poseidonEffects.ts` writes it): three x, z, radius (m)
   * and strength (0–1; 0 none).
   */
  foamPatch: Float32Array;
  /**
   * Her emergency lights' level (0–1) after a blackout (the ship rig
   * writes it): the storm's sea glows round her hull with it, her lit
   * decks under the water (the Poseidon keel up). 0 for every other ship.
   */
  underGlow: number;
}

/** A glass lift ride as the scene sees it (`SceneRuntime.walkRide`). */
export interface WalkRide {
  lift: string;
  from: number;
  to: number;
  s: number;
  z: number;
}

/** `walkLiftDirs`: a ride up is possible. */
export const LIFT_UP = 1;
/** `walkLiftDirs`: a ride down is possible. */
export const LIFT_DOWN = 2;

/** The walker for the test hooks. */
export interface WalkInfo {
  phase: "deck" | "water" | "boat";
  part: "whole" | "bow" | "stern" | null;
  /** Ship frame on deck (m), earth frame in the water. */
  x: number;
  y: number;
  slopeDeg: number;
  /** Her heel at the shown time (degrees, absolute; tests key on it). */
  heelDeg: number;
  /** Sea over the feet (m; negative when dry); 0 in the water. */
  depthM: number;
  area: string | null;
  /** Standing in a room inside her. */
  inside: boolean;
  /** Riding a glass lift: its id, else null (missing: not riding). */
  ride?: string | null;
}

/** The rooms' eased water levels (`SceneRuntime.interiorLevels`). */
export interface InteriorLevels {
  /** Each room's index in `shown` and `drawn`. */
  slot: ReadonlyMap<string, number>;
  /** Earth z (−Infinity dry), valid where `drawn` is 1. */
  shown: Float64Array;
  /** 1 for a room eased last frame (its zone drawn), else 0. */
  drawn: Uint8Array;
}

/** Points along a turning ship's wake (`SceneRuntime.wake.path`). */
export const WAKE_PATH_POINTS = 8;

/** Room for her deck lamps in `SceneRuntime.lamps`. */
export const MAX_LAMPS = 8;

export function createSceneRuntime(): SceneRuntime {
  const rt: SceneRuntime = {
    frame: null,
    broken: false,
    whole: null,
    split: null,
    part(name) {
      if (name === "whole") return rt.broken ? null : (rt.whole?.whole ?? null);
      if (!rt.broken) return null;
      return rt.split ? rt.split[name] : null;
    },
    flash: 0,
    reflecting: false,
    underwater: false,
    pins: new Map(),
    wake: {
      x: 0,
      z: 0,
      dx: 1,
      dz: 0,
      amount: 0,
      length: 0,
      path: new Float32Array(2 * WAKE_PATH_POINTS),
      pathN: 0,
    },
    walker: null,
    walkLookUnder: false,
    walkSplash: 0,
    walkCanReboard: false,
    walkInputOff: false,
    walkInfo: null,
    walkInside: false,
    walkRoom: null,
    walkCameInBy: null,
    walkLift: 0,
    walkDoor: -1,
    walkRide: null,
    walkLiftDirs: 0,
    walkLiftCarZ: null,
    walkPlace: null,
    interiorLevels: null,
    interiorEmergency: 1,
    walkWet: 0,
    walkSeaView: 0,
    ride: { yaw: 0, pitch: 0, aimed: false },
    rideView: { pos: [0, 0, 0], yaw: 0, pitch: 0 },
    boardable: -1,
    sea: { storm: null, scale: 1, field: null, t: 0, atCamera: 0 },
    seaY(x, z) {
      const sea = rt.sea;
      return sea.storm
        ? boardingElevation(sea.storm, x, -z, sea.t, sea.scale)
        : 0;
    },
    lamps: new Float32Array(3 * MAX_LAMPS),
    lampCount: 0,
    lampPower: 0,
    stormLight: null,
    underLight: 0,
    foamPatch: new Float32Array(4),
    underGlow: 0,
  };
  return rt;
}

/**
 * Stands the walker in an area at (x, y) facing `yaw` (ship frame) on the
 * next frame: the test hooks' `placeWalk` and the picker's rooms (1.16)
 * both come this way, so a room start gets the same inside, eyes, water,
 * lights and torch as walking in. Ignored unless every number is finite.
 */
export function requestWalkPlace(
  runtime: SceneRuntime,
  area: string,
  x: number,
  y: number,
  yaw: number
): void {
  if (![x, y, yaw].every(Number.isFinite)) return;
  runtime.walkPlace = { area, x, y, yaw };
}

/** Stops (or lets) the walk input move the walker: the end card's gate. */
export function setWalkInputOff(runtime: SceneRuntime, off: boolean): void {
  runtime.walkInputOff = off;
}
