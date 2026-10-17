// lib/plane-builder/sim/constants.ts
export const STEP = 1 / 60;
/** Sim seconds per real second. The scene plays flights this much faster. */
export const GAME_SPEED = 1.5;
export const G = 9.81;
/** Steepest climb or dive the pilot can command, rad (35°). */
export const MAX_PITCH = 0.61;
/** Hard limits on the flight-path angle, rad. */
export const MIN_PITCH = -1.2;
/** How hard the elevator chases the target angle, 1/s. */
export const PITCH_GAIN = 1.6;
/** Max lift = lift × v² × this (elevator authority). */
export const LIFT_HEADROOM = 1.5;
/** Thin air: no climbing above this height over the ground, m. */
export const CEILING = 60;
/** Climbing fades out over this many metres below CEILING. */
export const CEILING_FADE = 15;
/** Above the ceiling the plane noses down to this share of MAX_PITCH. */
export const CEILING_DIVE = 0.5;
export const MAX_BANK = 0.8;
export const BANK_RATE = 2;
/** Heading change per second at full bank, rad/s. */
export const TURN_RATE = 0.9;
/** Never point more than this far off straight ahead, rad. */
export const MAX_HEADING = 1.2;
/** Seconds after launch that hands-off flight holds the launch angle. */
export const LAUNCH_HOLD = 1.2;
export const LAUNCH_HEIGHT = 3;
/** Aim limits for the slingshot, rad. */
export const MAX_AIM_PITCH = 0.7;
export const MAX_AIM_YAW = 0.5;
export const MIN_SPEED = 2;
export const MAX_SPEED = 120;
export const BOOST_THRUST = 2;
export const BOOST_BURN = 3;
export const PLANE_RADIUS = 1;
export const COIN_RADIUS = 2.5;
export const RING_COINS = 10;
/** Soft hits multiply speed by this. */
export const SOFT_SLOW = 0.85;
/** Shield hits multiply speed by this. */
export const SHIELD_SLOW = 0.6;
/** Seconds of no hard hits after a shield is spent. */
export const SHIELD_GRACE = 1;
/** Touch-downs shallower than this angle and slower than LAND_SPEED land. */
export const LAND_ANGLE = -0.35;
export const LAND_SPEED = 45;
export const SLIDE_DECEL = 10;
/** Heading correction past the corridor edge, rad/s at one half-width over. */
export const CORRIDOR_TURN = 1.5;
/** Sideways push back past the edge, m/s per metre over. */
export const CORRIDOR_PUSH = 0.5;
export const STALL_WINDOW = 3;
export const STALL_PROGRESS = 1;
export const MAX_FLIGHT_TIME = 120;
