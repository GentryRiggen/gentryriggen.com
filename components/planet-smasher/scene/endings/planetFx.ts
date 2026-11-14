import { Quaternion, Vector3 } from "three";

/**
 * What the endings do to the globe. The ending components write these every
 * frame (before the planet draws) and Planet applies them to its meshes and
 * shader uniforms. One planet exists at a time, so one shared object is enough.
 */
export interface PlanetFx {
  /** 0..1 red-hot surface. */
  molten: number;
  /** 0..1 frosted surface. */
  frozen: number;
  /** 0..1 orange glow pulse (the cracks before a shatter). */
  pulse: number;
  /** Hides the globe and its atmosphere. */
  hidden: boolean;
  /** Multiplies the atmosphere glow. */
  atmosphere: number;
  /** Uniform scale of the whole globe. */
  scale: number;
  /** Extra scale per axis (in `quat`'s frame), for stretching. */
  stretch: Vector3;
  pos: Vector3;
  quat: Quaternion;
  /** Spin of the planet itself about its own axis, radians. */
  spin: number;
}

export const planetFx: PlanetFx = {
  molten: 0,
  frozen: 0,
  pulse: 0,
  hidden: false,
  atmosphere: 1,
  scale: 1,
  stretch: new Vector3(1, 1, 1),
  pos: new Vector3(),
  quat: new Quaternion(),
  spin: 0,
};

export function resetPlanetFx(): void {
  planetFx.molten = 0;
  planetFx.frozen = 0;
  planetFx.pulse = 0;
  planetFx.hidden = false;
  planetFx.atmosphere = 1;
  planetFx.scale = 1;
  planetFx.stretch.set(1, 1, 1);
  planetFx.pos.set(0, 0, 0);
  planetFx.quat.identity();
  planetFx.spin = 0;
}
