/** Lifecycle maths shared by the particle effects (smoke and bubbles). */

/** Position within a particle's life: 0 just emitted, approaching 1 at death. */
export function lifePhase(time: number, life: number, offset: number): number {
  const phase = (time / life + offset) % 1;
  return phase < 0 ? phase + 1 : phase;
}

/** A stable pseudo-random value in [-1, 1) for a particle slot. */
export function slotNoise(slot: number, salt: number): number {
  const x = Math.sin(slot * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}
