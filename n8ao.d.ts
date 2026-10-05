/** The part of n8ao we use; the package ships no typings. */
declare module "n8ao" {
  import type { Camera, Color, Material, Scene } from "three";
  import type { Pass } from "postprocessing";

  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera);
    configuration: {
      color: Color;
      aoRadius: number;
      distanceFalloff: number;
      intensity: number;
      halfRes: boolean;
      depthAwareUpsampling: boolean;
    };
    /** The fullscreen blit that writes the final frame to the screen. */
    copyQuad: { material: Material };
    setQualityMode(mode: string): void;
  }
}
