/**
 * Base cost of every upgrade; the shop cost is this times costGrowth ^ level.
 * The coast is priced directly (its costScale is 1): what is written here is
 * what the player pays.
 * The night's opening buys (crank, gen1, gen2) were cut when its costScale
 * went from 2 to 2.6 (Round 5), so the opening keeps its prices. Round 7
 * re-priced the rest step by step against a steady wait between buys (see
 * the lab notebook); a few keep old prices on purpose (`openingScale`).
 */
export const COSTS: Record<string, number> = {
  "wick-1": 1400,
  "wick-2": 2200000,
  "fees-1": 490,
  "fees-2": 1200000,
  "fees-3": 110250000,
  "tank-1": 17000,
  "tank-2": 52500000,
  "train-1": 2600,
  "train-2": 3200000,
  "train-3": 157500000,
  "shutters-1": 1100000,
  "shutters-2": 99750000,
  "lines-1": 120,
  "lines-2": 250,
  "lines-3": 36500,
  "lines-4": 563000,
  "bulbs-1": 9206,
  "bulbs-2": 6000,
  "bulbs-3": 325000,
  "dock-1": 1900,
  "dock-2": 4800000,
  "dock-3": 425250000,
  "subs-1": 60000,
  "subs-2": 300000,
  // Batteries: about half what the plants of their size cost, per second held.
  "batt-1": 38,
  "batt-2": 100,
  "batt-3": 17,
  "batt-4": 65,
  "batt-5": 227,
  "batt-6": 350,
  "batt-7": 1900,
  "batt-8": 5500,
  "relay-1": 3740,
  "relay-2": 12000,
  "relay-3": 20000,
  "storm-crews": 2500,
  "weather-vane": 1600,
  "nav-1": 400,
  "nav-2": 21000,
  "mirror-1": 198,
  "mirror-2": 500,
  "mirror-3": 2000,
  "copy-1": 300,
  "copy-2": 1500,
  "engines-1": 2500,
  "engines-2": 3000,
  "appetite-1": 3000,
  "appetite-2": 12030,
  lens: 85,
  keeper: 15,
  lighthouse: 1500,
  contract: 2000000,
  crank: 72,
  gen1: 72,
  gen2: 450,
  gen3: 1000,
  gen4: 45000,
  aim: 163,
  collector: 145,
  probe: 220,
  shield: 1800,
  glass: 1400,
  remember: 100,
  "hearth-1": 8,
  "hearth-2": 26,
  "hearth-3": 38,
  "hearth-4": 58,
  "hearth-5": 71,
  "hearth-6": 320,
  "sail-1": 10,
  "sail-2": 33,
  "sail-3": 41,
  "sail-4": 62,
  "sail-5": 120,
  "song-1": 47,
  "song-2": 55,
  "song-3": 60,
  "song-4": 66,
  "slowburn-1": 16,
  "slowburn-2": 28,
  "slowburn-3": 53,
  "company-1": 13,
  "company-2": 26,
  "company-3": 49,
};

/**
 * Upgrades that were cut (the grid's load balancer and smart grid went when
 * the batteries came) and what they cost before the night's costScale, which
 * was `REMOVED_NIGHT_SCALE` when they were bought. A save that owns one is
 * paid back what it paid, whatever the night's prices are now.
 */
export const REMOVED_NIGHT_SCALE = 28;
export const REMOVED_NIGHT_COSTS: Readonly<Record<string, number>> = {
  "grid-1": 9600,
  "grid-2": 9000,
};

/**
 * Upgrades cut when the sky got its dials (the racing fins and mission
 * control belonged to the probe races) and what they cost before the sky's
 * costScale, which was `REMOVED_SKY_SCALE` when they were bought. A save that
 * owns one in the sky is paid back what it paid.
 */
export const REMOVED_SKY_SCALE = 9.5;
export const REMOVED_SKY_COSTS: Readonly<Record<string, number>> = {
  "fins-1": 5250,
  "mission-control": 3792,
};

/**
 * Upgrades cut when the last light got its warmth (the rain barrel belonged
 * to the memory garden) and what they cost before the last part's costScale,
 * which was `REMOVED_LAST_SCALE` when they were bought. A save that owns one
 * in the last part is paid back what it paid in resolve. (The lights that
 * were bought with resolve stay gone: a light let go is still let go.)
 */
export const REMOVED_LAST_SCALE = 4.6;
export const REMOVED_LAST_COSTS: Readonly<Record<string, number>> = {
  "rain-barrel": 126,
};
