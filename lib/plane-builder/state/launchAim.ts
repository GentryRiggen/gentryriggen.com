/**
 * The slingshot's live pull while the player drags or holds Space. A shared
 * mutable so the scene can read it every frame without React re-rendering.
 * The launch overlay writes it; Slingshot reads it.
 */
export interface LaunchPull {
  pitch: number;
  yaw: number;
  /** 0 (slack) to 1 (fully drawn). */
  power: number;
}

export const launchAim: LaunchPull = { pitch: 0, yaw: 0, power: 0 };

export function resetLaunchAim(): void {
  launchAim.pitch = 0;
  launchAim.yaw = 0;
  launchAim.power = 0;
}
