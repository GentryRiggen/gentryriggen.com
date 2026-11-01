import type { ResourceDef } from "../../engine/types";

export const PHASE_COAST = "coast";
export const PHASE_NIGHT = "night";
export const PHASE_SKY = "sky";
export const PHASE_LAST = "last";

/** Lighthouses needed to light the whole coast (the first one is free). */
export const COAST_LIGHTHOUSES = 8;
/** Cities in the world that want the night gone. */
export const TOTAL_CITIES = 100;
/** Stars in the sky at the start of The Sky. */
export const TOTAL_STARS = 1000;
/** Lights in the world when The Last Light begins (the lantern is one). */
export const TOTAL_LIGHTS = 12;

const HIDDEN: readonly string[] = [];

/**
 * Resources that only the tick reads (timers) use `phases: []` so the UI
 * hides them. Derived numbers (keepers, lighthouses, supply...) are kept in
 * sync by `syncDisplay` so the UI and the scene can read them directly.
 */
export const RESOURCES: readonly ResourceDef[] = [
  // The Coast
  { id: "coins", label: "Coins", phases: [PHASE_COAST] },
  { id: "ships", label: "Ships guided", phases: [PHASE_COAST, PHASE_LAST] },
  { id: "oil", label: "Lamp oil", initial: 40, phases: [PHASE_COAST] },
  { id: "oilTrend", label: "Oil price trend", phases: HIDDEN },
  { id: "oilPrice", label: "Oil price", initial: 2, phases: [PHASE_COAST] },
  {
    id: "lighthouses",
    label: "Lighthouses",
    initial: 1,
    phases: [PHASE_COAST],
  },
  { id: "keepers", label: "Keepers", phases: [PHASE_COAST] },
  { id: "storm", label: "Storm", phases: HIDDEN },
  { id: "stormCooldown", label: "Next storm", initial: 120, phases: HIDDEN },
  // No More Night
  { id: "power", label: "Power", phases: [PHASE_NIGHT] },
  { id: "supply", label: "Supply (MW)", phases: [PHASE_NIGHT] },
  { id: "demand", label: "Demand (MW)", phases: [PHASE_NIGHT] },
  { id: "cities", label: "Cities lit", phases: [PHASE_NIGHT] },
  {
    id: "night",
    label: "Night remaining %",
    initial: 100,
    phases: [PHASE_NIGHT],
  },
  {
    id: "grid",
    label: "Grid steadiness (%)",
    initial: 100,
    phases: [PHASE_NIGHT],
  },
  { id: "rush", label: "Evening rush", phases: HIDDEN },
  { id: "rushCooldown", label: "Next rush", initial: 90, phases: HIDDEN },
  // The Sky
  { id: "energy", label: "Energy", phases: [PHASE_SKY] },
  { id: "collectors", label: "Sun collectors", phases: [PHASE_SKY] },
  { id: "probes", label: "Probes", phases: [PHASE_SKY] },
  {
    id: "heading",
    label: "Probe heading (%)",
    initial: 100,
    phases: [PHASE_SKY],
  },
  { id: "flare", label: "Solar flare", phases: HIDDEN },
  { id: "flareCooldown", label: "Next flare", initial: 100, phases: HIDDEN },
  { id: "starsTaken", label: "Stars taken", phases: HIDDEN },
  {
    id: "stars",
    label: "Stars remaining",
    initial: TOTAL_STARS,
    phases: [PHASE_SKY],
  },
  // The Last Light
  { id: "resolve", label: "Resolve", phases: [PHASE_LAST] },
  { id: "flame", label: "Flame", initial: 600, phases: [PHASE_LAST] },
  // The first ship's boat (shown through its action, not as a number).
  { id: "boatHeading", label: "Boat heading", initial: 100, phases: HIDDEN },
  { id: "boatProgress", label: "Boat progress", phases: HIDDEN },
  // The lantern colour the player picked at the start (1 to 3, 0 = not picked,
  // which shows as the first). Stays on this device in the save; never sent.
  { id: "lantern", label: "Lantern colour", phases: HIDDEN },
  {
    id: "lights",
    label: "Lights still lit",
    initial: TOTAL_LIGHTS,
    phases: [PHASE_LAST],
  },
];
