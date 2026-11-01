import type { ResourceDef } from "../../engine/types";
import { PLOT_COUNT } from "./garden";

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
  // The Tide Clock (The Coast): the wave clock and tallies, read by tide.ts
  { id: "tdTime", label: "Tide clock", phases: HIDDEN },
  { id: "tdNets", label: "Nets (0 empty, 1 set, 2 full)", phases: HIDDEN },
  { id: "tdEarly", label: "Nets set early", phases: HIDDEN },
  { id: "tdHighs", label: "High tides so far", phases: HIDDEN },
  { id: "tdHauls", label: "Nets hauled in", phases: HIDDEN },
  { id: "tdLastPayout", label: "Last catch", phases: HIDDEN },
  { id: "tdLastEarly", label: "Last catch, how early", phases: HIDDEN },
  { id: "tdPending", label: "Catch still flowing in", phases: HIDDEN },
  { id: "tdSurgeRate", label: "Catch flow rate", phases: HIDDEN },
  { id: "tdEarned", label: "Coins from nets", phases: HIDDEN },
  { id: "tdMilled", label: "Coins from the tide mill", phases: HIDDEN },
  { id: "tdPaused", label: "Tide clock paused (simulator)", phases: HIDDEN },
  // The Weather Desk (No More Night): all timers and tallies, read by weather.ts
  { id: "wxStage", label: "Weather stage", phases: HIDDEN },
  { id: "wxTimer", label: "Weather timer", phases: HIDDEN },
  { id: "wxSeed", label: "Weather random stream", phases: HIDDEN },
  { id: "wxStageLen", label: "Weather stage length", phases: HIDDEN },
  { id: "wxChance0", label: "Chance, town 1", phases: HIDDEN },
  { id: "wxChance1", label: "Chance, town 2", phases: HIDDEN },
  { id: "wxChance2", label: "Chance, town 3", phases: HIDDEN },
  { id: "wxShield0", label: "Shield, town 1", phases: HIDDEN },
  { id: "wxShield1", label: "Shield, town 2", phases: HIDDEN },
  { id: "wxShield2", label: "Shield, town 3", phases: HIDDEN },
  { id: "wxShieldSeq", label: "Shield order", phases: HIDDEN },
  { id: "wxFronts", label: "Storm fronts so far", phases: HIDDEN },
  { id: "wxLastKind", label: "Last storm result", phases: HIDDEN },
  { id: "wxLastTown", label: "Last storm town", phases: HIDDEN },
  { id: "wxLastPayout", label: "Last storm payout", phases: HIDDEN },
  { id: "wxPending", label: "Storm power still flowing in", phases: HIDDEN },
  { id: "wxSurgeRate", label: "Storm power surge rate", phases: HIDDEN },
  { id: "wxHeld", label: "Storms held", phases: HIDDEN },
  { id: "wxFlickered", label: "Storms that flickered", phases: HIDDEN },
  { id: "wxEarned", label: "Storm power earned", phases: HIDDEN },
  // Probe Races (The Sky): the comet clock, the two probes and tallies, read by probes.ts
  { id: "prTime", label: "Comet clock", phases: HIDDEN },
  { id: "prRoute", label: "Route out", phases: HIDDEN },
  { id: "prLeft", label: "Probe time left", phases: HIDDEN },
  { id: "prLen", label: "Probe run length", phases: HIDDEN },
  { id: "prPay", label: "Probe haul", phases: HIDDEN },
  { id: "prQuality", label: "Comet closeness at launch", phases: HIDDEN },
  { id: "prLastRoute", label: "Last route (0 none)", phases: HIDDEN },
  { id: "prLaunches", label: "Probes launched", phases: HIDDEN },
  { id: "prRuns", label: "Probe runs home", phases: HIDDEN },
  { id: "prLastPayout", label: "Last haul", phases: HIDDEN },
  { id: "prLastQuality", label: "Last haul, comet closeness", phases: HIDDEN },
  { id: "prLastKind", label: "Last haul, route", phases: HIDDEN },
  { id: "prEarned", label: "Energy from probe runs", phases: HIDDEN },
  { id: "prAutoLeft", label: "Scout time left", phases: HIDDEN },
  { id: "prAutoRoute", label: "Scout route", phases: HIDDEN },
  { id: "prAutoLen", label: "Scout run length", phases: HIDDEN },
  { id: "prAutoPay", label: "Scout haul", phases: HIDDEN },
  { id: "prAutoRuns", label: "Scout runs home", phases: HIDDEN },
  { id: "prAutoEarned", label: "Energy from the scout", phases: HIDDEN },
  { id: "prPending", label: "Haul still flowing in", phases: HIDDEN },
  { id: "prSurgeRate", label: "Haul flow rate", phases: HIDDEN },
  { id: "prPaused", label: "Probe races paused (simulator)", phases: HIDDEN },
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
  // The Memory Garden (The Last Light): growth, watering and tallies, read by garden.ts
  ...Array.from({ length: PLOT_COUNT }, (_, plot): ResourceDef[] => [
    { id: `gdP${plot}`, label: `Plant ${plot + 1} growth`, phases: HIDDEN },
    { id: `gdWet${plot}`, label: `Plant ${plot + 1} watered`, phases: HIDDEN },
    {
      id: `gdPicked${plot}`,
      label: `Plant ${plot + 1} picked`,
      phases: HIDDEN,
    },
  ]).flat(),
  { id: "gdCool", label: "Watering can rests", phases: HIDDEN },
  { id: "gdRain", label: "Next rain barrel shower", phases: HIDDEN },
  { id: "gdPicks", label: "Blooms picked", phases: HIDDEN },
  { id: "gdWaterings", label: "Times watered", phases: HIDDEN },
  {
    id: "gdLastKind",
    label: "Garden last done (1 water, 2 pick)",
    phases: HIDDEN,
  },
  { id: "gdLastBlooms", label: "Last pick, blooms", phases: HIDDEN },
  { id: "gdLastPayout", label: "Last pick, resolve", phases: HIDDEN },
  { id: "gdPending", label: "Pick glow still flowing in", phases: HIDDEN },
  { id: "gdSurgeRate", label: "Pick glow flow rate", phases: HIDDEN },
  { id: "gdEarned", label: "Resolve from the garden", phases: HIDDEN },
  { id: "gdPaused", label: "Garden paused (simulator)", phases: HIDDEN },
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
