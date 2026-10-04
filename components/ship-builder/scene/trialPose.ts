/** Past this the ship has rolled over or gone under: not a gentle lean. */
const HEAVY_ROLL = 1;
const HEAVY_SINK = 0.3;

export interface PoseLike {
  roll: number;
  sink: number;
}

/** Whether a trial pose is far enough gone that leaving it should pop back. */
export function isHeavyTrialPose(pose: PoseLike): boolean {
  return Math.abs(pose.roll) > HEAVY_ROLL || pose.sink > HEAVY_SINK;
}
