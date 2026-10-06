/**
 * The player's movement, shared by the controls (which write it) and the walk
 * runner (which reads it every frame). `forward` and `strafe` are -1..1 in the
 * player's own frame; `turn` is -1..1 (positive turns right). Mutable on
 * purpose: it changes at pointer speed and must not cause React renders.
 */
export const walkInput: { forward: number; strafe: number; turn: number } = {
  forward: 0,
  strafe: 0,
  turn: 0,
};

export function resetWalkInput(): void {
  walkInput.forward = 0;
  walkInput.strafe = 0;
  walkInput.turn = 0;
}
