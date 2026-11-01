/** Every balance number for Make It Grow, in one place. */
export interface PhaseTuning {
  /** What one tap earns before any bonus. */
  tap: number;
  /** What each helper earns every second before any bonus. */
  helper: number;
  /** Each scaling level adds this share to taps and helpers alike. */
  scalePer: number;
}

export const TUNING = {
  /** By phase index. */
  phases: [
    { tap: 1, helper: 0.6, scalePer: 0.5 },
    { tap: 8, helper: 5, scalePer: 0.5 },
    { tap: 60, helper: 40, scalePer: 0.5 },
    { tap: 1, helper: 0.35, scalePer: 0.5 },
  ] as readonly PhaseTuning[],
  seed: {
    /** Growth (of 100) each unit of care adds to the pot. */
    growthPerCare: 0.5,
  },
  /** Start-of-phase gift for each level of the packet, in seconds of helper income. */
  headStartSeconds: 20,
} as const;
