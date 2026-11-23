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
  "torpedo-hit",
  "aground",
] as const;

export type SimEventKind = (typeof SIM_EVENT_KINDS)[number];

export interface SimEvent {
  /** Shown seconds after the collision. */
  t: number;
  /** Real seconds after the collision (differs once the way down is sped up). */
  realT: number;
  kind: SimEventKind;
  /** Rocket, boat (spec order), funnel (0 forward), hatch (from 1),
   *  radio message or signal (the ship's own numbering: the Fitzgerald's
   *  messages, the Britannic's 9:00 whistle) or torpedo (`torpedo-hit`:
   *  its hit number, the hit at the first event being 1) number. */
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
 * A mine ship's roll rate (rad/s) that still counts as steady (1.4): a
 * mine's hole (12 m²) into a double skin's narrow void (0.85 m) trades
 * water in pulses that rock her by up to about 1e-4 rad/s (0.005°/s)
 * about a steady list; 1e-5 for every other ship.
 */
export const STEADY_MINE_ROLL_RADS = 2e-4;
/**
 * Settled (the steady test's second way, 1.5): a hull whose pose stays
 * inside a box this small (pitch and roll within STEADY_POSE_DEG, her
 * height within STEADY_POSE_M) for STEADY_POSE_S, with the averaged
 * inflow under STEADY_INFLOW_M3S, has stopped, though a small flooded
 * space still trades water in a slow cycle that rocks her by a few
 * thousandths of a degree. Only for a ship whose U-boat comes back
 * (`spec.torpedo.finisher`, the Carpathia); the others keep the rate test.
 */
export const STEADY_POSE_S = 600;
export const STEADY_POSE_DEG = 0.01;
export const STEADY_POSE_M = 0.01;
/**
 * `hatch-fails`: a hatch cover gives way once the water over its lip
 * reaches its `failHeadM` (ship data); a tight cover (`SimOptions
 * .hatchesTight`, Kestner clamps all done up) holds this many times that.
 * `sheltered`: still afloat and whole at `spec.shelter.t`.
 */
export const HATCH_TIGHT_FAIL_FACTOR = 2;
