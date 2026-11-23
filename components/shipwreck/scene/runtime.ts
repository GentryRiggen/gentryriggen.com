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
}

/** The walker for the test hooks. */
export interface WalkInfo {
  phase: "deck" | "water";
  part: "whole" | "bow" | "stern" | null;
  /** Ship frame on deck (m), earth frame in the water. */
  x: number;
  y: number;
  slopeDeg: number;
  /** Sea over the feet (m; negative when dry); 0 in the water. */
  depthM: number;
  area: string | null;
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
  };
  return rt;
}

/** Stops (or lets) the walk input move the walker: the end card's gate. */
export function setWalkInputOff(runtime: SceneRuntime, off: boolean): void {
  runtime.walkInputOff = off;
}
