import type { Vec3 } from "@/lib/planet-smasher/sphere";

/**
 * Where the held alien laser points, shared between the input (Stage) and the
 * beam. `owner` is the effect id of the beam that currently drives damage;
 * `ticks` counts the shots the cooldown has allowed so far.
 */
export const laserAim = {
  held: false,
  owner: -1,
  u: 0.5,
  v: 0.5,
  point: { x: 0, y: 0, z: 1 } as Vec3,
  ticks: 0,
};
