import type { WalkInput } from "./step";

/**
 * The walker's controls, shared by the joystick, the look drag and the keys
 * (which write it) and the walk runner (which reads it every frame).
 * `forward` and `strafe` are −1..1; `lookDx` and `lookDy` add up the look
 * drag in px since the runner last read them, and the runner zeroes them
 * once it has. Mutable on purpose: it changes at pointer speed and must not
 * cause React renders.
 */
export const walkInput: WalkInput = {
  forward: 0,
  strafe: 0,
  lookDx: 0,
  lookDy: 0,
  jump: false,
};

export function resetWalkInput(): void {
  walkInput.forward = 0;
  walkInput.strafe = 0;
  walkInput.lookDx = 0;
  walkInput.lookDy = 0;
  walkInput.jump = false;
  // The door buttons' flags: cleared, not set false (unset when idle).
  walkInput.door = undefined;
  walkInput.outside = undefined;
}
