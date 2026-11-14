/**
 * The tap combo: each tap in quick succession climbs one step up a major
 * pentatonic scale, so mashing the button sounds like coins pouring and
 * rising. A pause lets it fall back to the bottom. Pure, so it is easy to test.
 */

/** Semitone offsets of the climb: major pentatonic. */
export const COMBO_SCALE = [0, 2, 4, 7, 9] as const;

/** Idle time (ms) after which the next tap starts again from the bottom. */
export const COMBO_RESET_MS = 600;

/** The highest step; beyond it the top octave keeps cycling. */
export const COMBO_MAX_STEP = 12;

export interface ComboState {
  step: number;
  at: number;
}

/** The combo after a tap at time `now` (ms), given the state after the last. */
export function nextCombo(prev: ComboState | null, now: number): ComboState {
  if (prev === null || now - prev.at > COMBO_RESET_MS || now < prev.at) {
    return { step: 0, at: now };
  }
  return { step: prev.step + 1, at: now };
}

/**
 * Semitones above the base note for a combo step. It climbs to
 * `COMBO_MAX_STEP`, then cycles through the top five notes so a long mash
 * keeps sparkling instead of sitting on one pitch.
 */
export function comboSemitones(step: number): number {
  const safe = Math.max(0, Math.floor(step));
  const capped =
    safe <= COMBO_MAX_STEP
      ? safe
      : COMBO_MAX_STEP -
        COMBO_SCALE.length +
        1 +
        ((safe - COMBO_MAX_STEP - 1) % COMBO_SCALE.length);
  const octave = Math.floor(capped / COMBO_SCALE.length);
  return COMBO_SCALE[capped % COMBO_SCALE.length] + 12 * octave;
}
