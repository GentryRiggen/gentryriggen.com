import type { Group } from "three";
import type { TitanicHandles } from "@/components/shipwreck/model/shipModel";
import type { PlaceId } from "@/lib/shipwreck/places";
import type { SimFrame } from "@/lib/shipwreck/sim/track";

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
  };
  return rt;
}
