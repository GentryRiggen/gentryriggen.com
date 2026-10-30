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
export const LIFT_HEADROOM = 0.45;
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
/** Speed a ring adds, m/s. */
export const RING_BOOST = 8;
export const FUEL_CAN_RADIUS = 3;
/**
 * Seconds of fuel a fuel can adds. Fixed, not a share of the tank: a share
 * let a big tank refill as fast as it burned between cans and never run dry.
 * One second: a can is a small top-up, not a free tank, so grabbing every can
 * is not a shortcut past the upgrade prices.
 */
export const FUEL_CAN_SECONDS = 1;
/** Shares of the finish distance that are milestone flags. */
export const MILESTONES = [0.25, 0.5, 0.75] as const;
/** Soft hits multiply speed by this. */
export const SOFT_SLOW = 0.85;
/** Shield hits multiply speed by this. */
export const SHIELD_SLOW = 0.6;
/** Seconds of no hard hits after a shield is spent. */
export const SHIELD_GRACE = 1;
/** Touch-downs shallower than this angle and slower than LAND_SPEED land. */
export const LAND_ANGLE = -0.9;
export const LAND_SPEED = 55;
export const SLIDE_DECEL = 10;
/** Heading correction past the corridor edge, rad/s at one half-width over. */
export const CORRIDOR_TURN = 1.5;
/** Sideways push back past the edge, m/s per metre over. */
export const CORRIDOR_PUSH = 0.5;
export const STALL_WINDOW = 3;
export const STALL_PROGRESS = 1;
export const MAX_FLIGHT_TIME = 120;
/** Stick past this (either way) counts as a hard dive or pull-up. */
export const SWOOP_STICK = 0.5;
/** Out of fuel, in a hard dive: share of the normal drag. */
export const SWOOP_DRAG = 0.3;
/** Out of fuel, in a hard pull-up: lift multiplier. */
export const SWOOP_LIFT = 2.5;
/**
 * Near miss: passing a hard obstacle with less than this much clear air (m)
 * between the plane and the obstacle's collision box. All planes share
 * PLANE_RADIUS, so one margin fits every plane size; the box is the same one
 * the collision code uses, so a graze is always just short of a hit.
 */
export const NEAR_MISS_MARGIN = 3;
/** A near miss within this many sim seconds of the last one extends the combo. */
export const COMBO_WINDOW = 4;
/** The combo multiplier never goes past this. */
export const MAX_COMBO_MULTIPLIER = 5;
/** Coins for a near miss at multiplier x1. */
export const NEAR_MISS_COINS = 1;
/** Most near-miss coins one flight can earn, so skimming never outpays flying. */
export const NEAR_MISS_COIN_CAP = 30;
