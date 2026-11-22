import type { Group } from "three";
import type { TitanicHandles } from "@/components/shipwreck/model/shipModel";
import type { PlaceId } from "@/lib/shipwreck/places";
import type { SimFrame } from "@/lib/shipwreck/sim/track";
import type { WalkerView } from "./walkCamera";

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
  };
  /**
   * Walking (WalkRunner, priority −1.5): the first-person eyes, null when
   * not walking; CameraRig stands the camera there on the "walk" camera.
   */
  walker: WalkerView | null;
  /** True while floating and looking under (clear water, her lights on). */
  walkLookUnder: boolean;
  /** 0..1 how hard the deck is pushing the walker downhill (HUD arrows). */
  walkSlide: number;
  /** Bumped each time the walker goes into the sea (the splash). */
  walkSplash: number;
  /** For the test hooks: where the walker is (null when not walking). */
  walkInfo: WalkInfo | null;
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
    wake: { x: 0, z: 0, dx: 1, dz: 0, amount: 0, length: 0 },
    walker: null,
    walkLookUnder: false,
    walkSlide: 0,
    walkSplash: 0,
    walkInfo: null,
  };
  return rt;
}
