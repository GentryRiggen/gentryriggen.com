/** The story's events, in a closed set the UI and the sound can rely on. */

export const SIM_EVENT_KINDS = [
  "collision",
  "explosion",
  "steam-start",
  "steam-stop",
  "rocket",
  "boat-lowered",
  "last-boat",
  "forecastle-under",
  "bridge-under",
  "funnel-falls",
  "lights-flicker",
  "lights-out",
  "breakup",
  "bow-under",
  "stern-under",
  "bow-lands",
  "stern-lands",
  "floating-steady",
  "hatch-fails",
  "sheltered",
  "radio",
] as const;

export type SimEventKind = (typeof SIM_EVENT_KINDS)[number];

export interface SimEvent {
  /** Shown seconds after the collision. */
  t: number;
  /** Real seconds after the collision (differs once the way down is sped up). */
  realT: number;
  kind: SimEventKind;
  /** Rocket, boat (spec order), funnel (0 forward), hatch (from 1) or
   *  radio message (the ship's own numbering) number. */
  index?: number;
}

/**
 * Funnels: one goes when the sea reaches its base (the wave that ran up the
 * boat deck), or when its part leans past what its stays hold: the limit
 * grows a few degrees per funnel aft, as the stays fanned out more widely
 * there (and the after funnels leaned on the forward ones' stays).
 */
export const FUNNEL_UNDER_M = 0;
export const FUNNEL_STAY_LIMIT_DEG = 22;
export const FUNNEL_STAY_STEP_DEG = 6;
/** The lights flicker once the bow is this far down, or a funnel falls. */
export const LIGHTS_FLICKER_TRIM_DEG = 10;
/** The dynamos stop once the water is this deep in the aftmost engine space (m). */
export const DYNAMO_FLOOD_M = 4;
/** Floating steady: inflow and motion this small for this long. */
export const STEADY_INFLOW_M3S = 0.05;
export const STEADY_HOLD_S = 300;
/** The inflow is also judged averaged over about this long (s). */
export const STEADY_AVG_S = 120;
/**
 * `hatch-fails`: a hatch cover gives way once the water over its lip
 * reaches its `failHeadM` (ship data); a tight cover (`SimOptions
 * .hatchesTight`, Kestner clamps all done up) holds this many times that.
 * `sheltered`: still afloat and whole at `spec.shelter.t`.
 */
export const HATCH_TIGHT_FAIL_FACTOR = 2;
