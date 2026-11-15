/** Real seconds the ending holds its slow-motion floor. */
export const SLOW_HOLD = 0.8;
/** Real seconds after which time is back to normal. */
export const SLOW_END = 1.2;
export const SLOW_SCALE = 0.25;
/** How much closer the camera gets (a fraction of its distance). */
export const DOLLY_AMOUNT = 0.15;
const DOLLY_IN = 0.4;
const DOLLY_BACK = 0.8;

/** The time scale `t` real seconds after an ending began. */
export function slowMoScale(t: number): number {
  if (t < SLOW_HOLD) return SLOW_SCALE;
  if (t >= SLOW_END) return 1;
  return (
    SLOW_SCALE + ((1 - SLOW_SCALE) * (t - SLOW_HOLD)) / (SLOW_END - SLOW_HOLD)
  );
}

const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

/** How far in the camera is pushed (0..DOLLY_AMOUNT): in, hold, ease back. */
export function dollyAmount(t: number): number {
  if (t < SLOW_END) return DOLLY_AMOUNT * smooth(t / DOLLY_IN);
  return DOLLY_AMOUNT * (1 - smooth((t - SLOW_END) / DOLLY_BACK));
}

export interface SlowMoDeps {
  setTimeScale(s: number): void;
  /** Multiplies the camera's distance from the planet by `k`. */
  scaleCamera(k: number): void;
  reducedMotion: boolean;
}

export interface SlowMoController {
  /** Advances by real seconds. */
  update(realDt: number): void;
  /** Puts time and the camera back, whatever state the ending was in. */
  dispose(): void;
}

/**
 * The lifecycle of an ending's slow motion, free of React. The camera is moved
 * by relative steps, so a pinch during the ending is kept.
 */
export function createSlowMo(deps: SlowMoDeps): SlowMoController {
  let t = 0;
  let applied = 1;
  const setFactor = (f: number) => {
    if (f === applied) return;
    deps.scaleCamera(f / applied);
    applied = f;
  };
  return {
    update(realDt) {
      t += realDt;
      deps.setTimeScale(slowMoScale(t));
      if (!deps.reducedMotion) setFactor(1 - dollyAmount(t));
    },
    dispose() {
      deps.setTimeScale(1);
      setFactor(1);
    },
  };
}
