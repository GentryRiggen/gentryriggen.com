/**
 * Physical constants and the tuned parameters of the Shipwreck sim. Every
 * tuned value is a physical quantity in a plausible range (README:
 * "Calibration"); none of them is a time.
 */

/** Sea water at about -2 °C, kg/m³, and gravity, m/s². */
export const RHO = 1025;
export const GRAV = 9.81;

/** Fixed steps: slow phases (quasi-static), fast phases (the plunge). */
export const SIM_STEP_S = 1;
export const FAST_STEP_S = 0.1;
/** Frames: one per second while slow, ten per second while fast. */
export const SLOW_FRAME_S = 1;
export const FAST_FRAME_S = 0.1;

/**
 * What-if storms (`SimOptions.storm`): the field's heights scaled. Calmer
 * 0.6 (Hs 7.6 → 4.6 m, a hard autumn gale the lakers sailed through);
 * worse 1.25 (9.5 m, about the highest waves hindcast for Superior).
 */
export const STORM_SCALE = { real: 1, calmer: 0.6, worse: 1.25 } as const;

/** 6:00 AM: a ship still afloat then has "floated". */
export const END_T = 22800;

// --- Flooding -------------------------------------------------------------

/** Discharge coefficient of the openings (orifice law). */
export const CD_OPENING = 0.6;
/** Weir coefficient for water spilling over a bulkhead top, m^0.5/s. */
export const WEIR_CW = 1.0;
/**
 * Fraction of the breadth at a bulkhead top that water can actually spill
 * across (the deck above is cut up by cabins, casings and passages).
 */
export const SPILL_BREADTH = 0.1;
/**
 * Effective open area per metre of deck edge under the sea (hatches,
 * stairways, doors, portholes), m²/m, for the hull below the sheer.
 */
export const DOWNFLOOD_M2_PER_M = 0.02;
/** The same for a superstructure box over its lower edge, m²/m. */
export const BOX_FLOOD_M2_PER_M = 0.035;
/**
 * Trapped air: once a space's deck edge is this deep (m), its vents,
 * skylights and hatch covers give way: an opening of this area (m²).
 */
export const VENT_BURST_M = 20;
export const VENT_BURST_M2 = 3;
/** Fraction of the broken section open to the sea after the breakup. */
export const BREAK_OPEN_FRACTION = 0.4;
/** Below this head (m) the orifice law is linearised (no 1/sqrt blow-up). */
export const HEAD_EPS = 0.02;
/** Fraction of the level difference one step may equalise. */
export const FLOW_CAP = 0.5;
/**
 * Coal doors and leaks in a longitudinal bulkhead sit just above the tank
 * top (the stokehold plates): this high over the section's bottom (m).
 */
export const CROSS_DOOR_Z_M = 1.5;
/**
 * Portholes: a row is let in as pieces at most this long (m), each a strip
 * this tall (m, a 16-inch scuttle), so a row goes under bit by bit as she
 * lists and trims.
 */
export const PORTHOLE_PIECE_M = 5;
export const PORTHOLE_HEIGHT_M = 0.4;
/**
 * Deck openings sample the storm's wave surface this often through a step
 * (s): a 1 s step sees a wave crest (a few seconds over a hatch) at only a
 * point or two; four samples a step follow its rise and fall.
 */
export const DECK_SAMPLE_S = 0.25;

// --- Body -----------------------------------------------------------------

/** Added mass normal to the axis per metre: coefficient on ρ·π·s²/8. */
export const ADDED_MASS_COEF = 0.7;
/** Added mass along the axis, as a fraction of the displaced mass. */
export const AXIAL_ADDED_MASS = 0.05;
/** Roll radius of gyration as a fraction of beam, and its added inertia. */
export const ROLL_GYRATION = 0.38;
export const ROLL_ADDED = 0.2;
/** Vertical radius of gyration (pitch inertia from heights), fraction of depth. */
export const VERTICAL_GYRATION = 0.3;
/** Linear (wave-making) damping as a fraction of critical. */
export const HEAVE_ZETA = 0.5;
export const PITCH_ZETA = 0.5;
export const ROLL_ZETA = 0.15;
/** Drag coefficients: across the hull and along it. */
export const DRAG_CD = 1.0;
export const AXIAL_CD = 0.15;
/**
 * Bilge and ballast pumps (Titanic: five 250 t/h ballast pumps and three
 * 150 t/h bilge pumps), m³/s, working the machinery spaces while the lights
 * are on, until the water there is deeper than PUMP_DEPTH_M.
 */
export const PUMP_M3S = 0.45;
export const PUMP_DEPTH_M = 3;
/** A slow drift to port, m/s, while she floats. */
export const DRIFT_MPS = 0.02;
/**
 * Steady headway (no `halfLifeS`): once she goes under, her way halves
 * every this many real seconds. A flooded hull of about 40,000 t with
 * its added mass, driven by nothing, against the drag of its whole
 * section (about 250 m² at Cd 1 in fresh water: 6 MN at 7 m/s) halves
 * its speed in about 45 s.
 */
export const HEADWAY_LOST_HALF_LIFE_S = 45;
/**
 * Engines stopped at the first event (`SimOptions.enginesStopped`): an
 * intact liner coasting, her way halving every this many real seconds.
 * A 53,000 t liner (about 56,000 t with her surge added mass) at 21 kn
 * (10.8 m/s) meets about 2 MN of resistance (some 22 MW of effective
 * power, 60 % of 50,000 shp): an initial slowing of 0.036 m/s², the
 * speed's own e-folding time 300 s, an exponential half-life of about
 * 210 s with that start. Her three screws stopped (dragging, not
 * driving) and a bow trimmed down by the flooding add roughly 40 % to
 * the drag: 150 s, inside the 90–180 s a liner losing way takes.
 */
export const HEADWAY_STOP_HALF_LIFE_S = 150;

// --- Lightship distribution (fractions of the displacement) ---------------

/** Boilers, their water and the coal in the bunkers around them. */
export const MASS_BOILER = 0.17;
/** Engines, turbine, condensers, dynamos. */
export const MASS_ENGINE = 0.08;
/** Shafting, propellers, rudder, and cargo over the tunnels. */
export const MASS_SHAFT = 0.035;
/** Cargo, mail and stores in the holds. */
export const MASS_HOLD = 0.04;
/** Stores and tanks in the peaks. */
export const MASS_PEAK = 0.008;
/** Superstructure steel and outfit (the rest is the hull). */
export const MASS_SUPERSTRUCTURE = 0.11;

// --- Breakup and descent --------------------------------------------------

/**
 * Hull girder strength along the length: full over the middle half, falling
 * linearly to this fraction at the ends.
 */
export const GIRDER_END_FRACTION = 0.3;
/**
 * The engine spaces' casings (the openings through every deck over the
 * engines, up to the skylights) take this share of the deck out of the
 * girder there.
 */
export const ENGINE_CASING_FACTOR = 0.85;
/** How far either side of the break the hull is torn open (m). */
export const BREAK_DAMAGE_M = 25;
/** A bulkhead this close to the break takes the break (m). */
export const BREAK_SNAP_M = 2.5;
/** Steel and fittings displace this fraction of the lightship's mass in water. */
export const STEEL_BUOYANCY = 0.2;
/** Descent: how far the bow glides sideways per metre down, and its pitch. */
export const BOW_GLIDE = 0.16;
export const BOW_DESCENT_PITCH = (40 * Math.PI) / 180;
export const STERN_GLIDE = 0.04;
/** The stern tumbles and spins as it falls, rad/s. */
export const STERN_TUMBLE = 0.03;
export const STERN_SPIN = 0.05;
/** Mud: how deep the bow ploughs in, how far the stern crushes, m. */
export const BOW_PLOUGH_M = 15;
/** How deep the bow's after end beds in once it settles (m). */
export const BOW_BEDDED_M = 3;
/** The plough or crush eases in over a few of these (real seconds). */
export const PLOUGH_TIME_S = 5;
export const STERN_CRUSH_M = 4;
/**
 * The sea floor under a body still afloat (it grounds before it sinks): a
 * spring and damper at every hull vertex under the floor, per metre of
 * hull. Stiffness: the body's whole lightship weight laid along its whole
 * keel would press FLOOR_SINK_M into the mud; a short contact (the stem)
 * sinks deeper until enough of the hull bears. Damping: FLOOR_DAMP_S times
 * the stiffness (well damped for any contact length here). Friction: mud
 * on steel, regularised below a slip speed.
 */
export const FLOOR_SINK_M = 1;
export const FLOOR_DAMP_S = 3;
export const FLOOR_FRICTION = 0.5;
export const FLOOR_SLIP_MS = 0.05;
/**
 * `wreckParts.stern.capsize`: a stern part rolls over as it falls at this
 * rate (degrees per real second), a rule like the rest on the floor. 10°/s
 * turns it over in about 18 s, about the time it takes to fall 160 m at
 * its 10 m/s terminal speed, so it lands about upside down; if it lands
 * sooner it finishes the roll on the floor, re-seated so it stays on it.
 */
export const STERN_CAPSIZE_DEG_S = 10;
/** The way down plays this many times faster once both parts are under. */
export const DESCENT_TIME_SCALE = 6;

// --- Permeability ---------------------------------------------------------

/**
 * Share of each kind of space that flood water can fill (the rest is
 * boilers, coal, cargo, machinery and fittings). SOLAS-style values: holds
 * with cargo below and berths above, boiler rooms with coal in the bunkers.
 */
export const PERMEABILITY = {
  peak: 0.95,
  hold: 0.75,
  boiler: 0.8,
  engine: 0.85,
  shaft: 0.8,
  stern: 0.95,
} as const;
/** Superstructure (cabins, saloons). */
export const BOX_PERMEABILITY = 0.95;
