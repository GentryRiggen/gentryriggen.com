import { Vector3 } from "three";

/**
 * The Sun the sun-dive effect brings in. The effect writes it every frame;
 * the Vaporized ending (planet drifts toward it) and the Stage (warm light
 * from its side) read it. Nothing is active outside a sun dive.
 */
export const sunState = {
  active: false,
  /** World position of the Sun's centre. */
  pos: new Vector3(),
  /** 0..1: how far the light has turned warm and swung toward the Sun. */
  warm: 0,
};

export const SUN_RADIUS = 2.5;

export function resetSunState(): void {
  sunState.active = false;
  sunState.warm = 0;
}
