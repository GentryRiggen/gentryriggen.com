/**
 * The player's throttle and rudder, shared by the controls (which write it)
 * and the sail runner (which reads it every frame). Mutable on purpose: it
 * changes at pointer speed and must not cause React renders.
 */
export const sailInput: { throttle: number; rudder: number } = {
  throttle: 0,
  rudder: 0,
};

export function resetSailInput(): void {
  sailInput.throttle = 0;
  sailInput.rudder = 0;
}
