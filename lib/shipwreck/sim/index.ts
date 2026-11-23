/** The Shipwreck physics sim (see README.md). */
export { SIM_EVENT_KINDS } from "./events";
export type { SimEvent, SimEventKind } from "./events";
export { eventsBetween, sampleTrack } from "./track";
export type { BodyPose, SimFrame, SimTrack } from "./track";
export {
  FINISHER_SPOT,
  createSimRunner,
  simulate,
  torpedoHits,
  whatIfOpenings,
  whatIfSpots,
} from "./run";
export type { SimOptions, SimProbe, SimRunner, TorpedoHit } from "./run";
export {
  DESCENT_TIME_SCALE,
  END_T,
  FAST_STEP_S,
  SIM_STEP_S,
} from "./constants";
