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
  {
    id: "coins",
    label: "Coins",
    phases: [PHASE_COAST],
    purpose: "Buys keepers, oil and lighthouses.",
  },
  { id: "ships", label: "Ships guided", phases: [PHASE_COAST, PHASE_LAST] },
  { id: "oil", label: "Lamp oil", initial: 40, phases: [PHASE_COAST] },
  { id: "oilTrend", label: "Oil price trend", phases: HIDDEN },
  {
    id: "oilPrice",
    label: "Oil price",
    initial: 2,
    phases: [PHASE_COAST],
    format: (v) => v.toFixed(2),
  },
  {
    id: "lighthouses",
    label: "Lighthouses",
    initial: 1,
    phases: [PHASE_COAST],
  },
  { id: "keepers", label: "Keepers", phases: [PHASE_COAST] },
  // The lamp's brightness knob (Dim, Normal, Bright, Blazing), read by tick.ts
  {
    id: "lampBeam",
    label: "Lamp brightness",
    initial: 1,
    phases: HIDDEN,
  },
  { id: "lampBeamChanges", label: "Lamp brightness changes", phases: HIDDEN },
  { id: "storm", label: "Storm", phases: HIDDEN },
  { id: "stormCooldown", label: "Next storm", initial: 120, phases: HIDDEN },
  // No More Night
  {
    id: "power",
    label: "Power",
    phases: [PHASE_NIGHT],
    purpose: "Buys plants and lines for cities.",
  },
  { id: "supply", label: "Supply (MW)", phases: [PHASE_NIGHT] },
  { id: "demand", label: "Demand (MW)", phases: [PHASE_NIGHT] },
  { id: "cities", label: "Cities lit", phases: [PHASE_NIGHT] },
  {
    id: "night",
    label: "Night remaining %",
    initial: 100,
    phases: [PHASE_NIGHT],
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    id: "knowhow",
    label: "Know-how",
    phases: [PHASE_NIGHT, PHASE_SKY],
    purpose: "Buys projects and overdrive.",
  },
  // Overdrive (night and sky): the run's clock and tallies, read by overdrive.ts
  { id: "odLeft", label: "Overdrive time left", phases: HIDDEN },
  { id: "odClean", label: "Overdrive held steady", phases: HIDDEN },
  { id: "odRuns", label: "Overdrive runs", phases: HIDDEN },
  { id: "odCleanRuns", label: "Overdrive runs held steady", phases: HIDDEN },
  {
    id: "odKind",
    label: "Overdrive last run (1 steady, 2 slipped)",
    phases: HIDDEN,
  },
  { id: "lamps", label: "Streetlight brightness", initial: 2, phases: HIDDEN },
  { id: "lampChanges", label: "Streetlight changes", phases: HIDDEN },
  { id: "lampLock", label: "Streetlights settling", phases: HIDDEN },
  {
    id: "lampHome",
    label: "Streetlight step to go back to after the rush (step + 1)",
    phases: HIDDEN,
  },
  {
    id: "lampNext",
    label: "Streetlight step on its way (step + 1)",
    phases: HIDDEN,
  },
  // The grid (No More Night): the day clock, the batteries and the evening's
  // moments, all read by grid.ts. A save without them reads as "not begun".
  { id: "pgStarted", label: "Grid day clock begun", phases: HIDDEN },
  { id: "pgClock", label: "Seconds into the day", phases: HIDDEN },
  { id: "pgLevel", label: "Tonight's rush", phases: HIDDEN },
  { id: "pgSeed", label: "Grid random stream", phases: HIDDEN },
  { id: "pgCharge", label: "Battery charge", phases: HIDDEN },
  { id: "pgRush", label: "Evening rush on", phases: HIDDEN },
  { id: "pgDays", label: "Days so far", phases: HIDDEN },
  { id: "pgDark", label: "Districts dark", phases: HIDDEN },
  {
    id: "pgDarkLeft",
    label: "Seconds until the lights are back",
    phases: HIDDEN,
  },
  {
    id: "pgDarkFrom",
    label: "Districts dark at the rush's end",
    phases: HIDDEN,
  },
  { id: "pgLast", label: "Last evening (1 lit, 2 dark)", phases: HIDDEN },
  { id: "pgLits", label: "Nights kept lit", phases: HIDDEN },
  { id: "pgBlackouts", label: "Blackouts", phases: HIDDEN },
  { id: "pgBanner", label: "Evening banner", phases: HIDDEN },
  { id: "pgBannerLeft", label: "Evening banner seconds left", phases: HIDDEN },
  { id: "pgLitPay", label: "Last lit night's bonus", phases: HIDDEN },
  { id: "pgFrozen", label: "Grid frozen (simulator)", phases: HIDDEN },
  // The crews: each one's post (0 build, 1 school, 2+ a town) and road time
  { id: "crewPost0", label: "Crew 1 post", phases: HIDDEN },
  { id: "crewPost1", label: "Crew 2 post", phases: HIDDEN },
  { id: "crewPost2", label: "Crew 3 post", phases: HIDDEN },
  { id: "crewLock0", label: "Crew 1 committed to its watch", phases: HIDDEN },
  { id: "crewLock1", label: "Crew 2 committed to its watch", phases: HIDDEN },
  { id: "crewLock2", label: "Crew 3 committed to its watch", phases: HIDDEN },
  { id: "crewTravel0", label: "Crew 1 road time", phases: HIDDEN },
  { id: "crewTravel1", label: "Crew 2 road time", phases: HIDDEN },
  { id: "crewTravel2", label: "Crew 3 road time", phases: HIDDEN },
  { id: "wxHitLeft", label: "Storm hit banner left", phases: HIDDEN },
  // The forks: when the wind farms were started, read by forkState.ts
  { id: "forkWindAt", label: "Wind farms started at", phases: HIDDEN },
  // The fund (every part): the savings jar and its tallies, read by fund.ts
  { id: "fund", label: "In the fund", phases: HIDDEN },
  { id: "fundSince", label: "Fund, age of the money", phases: HIDDEN },
  { id: "fundDeposits", label: "Fund deposits", phases: HIDDEN },
  { id: "fundFees", label: "Fund fees paid", phases: HIDDEN },
  { id: "fundEarned", label: "Earned by the fund", phases: HIDDEN },
  // The harbor toll (The Coast): the sign, the traffic and the rival, read by toll.ts
  { id: "tollStep", label: "Harbor toll", initial: 1, phases: HIDDEN },
  { id: "tollChanges", label: "Harbor toll changes", phases: HIDDEN },
  { id: "tollLock", label: "Sign being repainted", phases: HIDDEN },
  {
    id: "hbTraffic",
    label: "Ships choosing the harbor",
    initial: 1,
    phases: HIDDEN,
  },
  { id: "hbRival", label: "Rival harbor toll", initial: 1.3, phases: HIDDEN },
  {
    id: "hbGoal",
    label: "Rival harbor next toll",
    initial: 1.3,
    phases: HIDDEN,
  },
  {
    id: "hbTimer",
    label: "Rival harbor next change",
    initial: 120,
    phases: HIDDEN,
  },
  { id: "hbShifts", label: "Rival harbor changes", phases: HIDDEN },
  { id: "hbRate", label: "Going rate", phases: HIDDEN },
  { id: "hbSeed", label: "Harbor random stream", phases: HIDDEN },
  {
    id: "nightSeed",
    label: "The night's seed, fixed when the run began",
    phases: HIDDEN,
  },
  // Oil tankers and the lamp's moments (The Coast), read by tanker.ts
  // 0 until the market has moved: a save from before reads the saved price.
  { id: "oilBase", label: "Oil market price", phases: HIDDEN },
  { id: "oilHabit", label: "What you pay against the market", phases: HIDDEN },
  { id: "tkLeft", label: "Tanker in port, seconds left", phases: HIDDEN },
  { id: "tkDeal", label: "Tanker price, share of market", phases: HIDDEN },
  { id: "tkCooldown", label: "Next tanker", phases: HIDDEN },
  { id: "tkVisits", label: "Tankers so far", phases: HIDDEN },
  { id: "tkBuys", label: "Buys from a tanker", phases: HIDDEN },
  { id: "barrelLeft", label: "Barrels rolling", phases: HIDDEN },
  {
    id: "lampDarkFor",
    label: "Seconds the lamp has been dark",
    phases: HIDDEN,
  },
  { id: "lampDarks", label: "Times the lamp went dark", phases: HIDDEN },
  { id: "lampRelit", label: "Beam burst left", phases: HIDDEN },
  {
    id: "lampRelitHold",
    label: "Seconds narration still waits after a relight",
    phases: HIDDEN,
  },
  // The Weather Desk (No More Night): all timers and tallies, read by weather.ts
  { id: "wxStage", label: "Weather stage", phases: HIDDEN },
  { id: "wxTimer", label: "Weather timer", phases: HIDDEN },
  { id: "wxSeed", label: "Weather random stream", phases: HIDDEN },
  { id: "wxStageLen", label: "Weather stage length", phases: HIDDEN },
  { id: "wxChance0", label: "Chance, town 1", phases: HIDDEN },
  { id: "wxChance1", label: "Chance, town 2", phases: HIDDEN },
  { id: "wxChance2", label: "Chance, town 3", phases: HIDDEN },
  { id: "wxStep", label: "Forecast step", phases: HIDDEN },
  { id: "wxTarget", label: "Where the storm lands", phases: HIDDEN },
  {
    id: "wxSize",
    label: "How big the storm is (0 small, 1 ordinary, 2 big)",
    initial: 1,
    phases: HIDDEN,
  },
  {
    id: "wxLastSize",
    label: "How big the last storm was",
    initial: 1,
    phases: HIDDEN,
  },
  { id: "wxBase0", label: "First forecast, town 1", phases: HIDDEN },
  { id: "wxBase1", label: "First forecast, town 2", phases: HIDDEN },
  { id: "wxBase2", label: "First forecast, town 3", phases: HIDDEN },
  { id: "wxReady0", label: "Crew ready, town 1", phases: HIDDEN },
  { id: "wxReady1", label: "Crew ready, town 2", phases: HIDDEN },
  { id: "wxReady2", label: "Crew ready, town 3", phases: HIDDEN },
  { id: "wxOut0", label: "Lights out, town 1", phases: HIDDEN },
  { id: "wxOut1", label: "Lights out, town 2", phases: HIDDEN },
  { id: "wxOut2", label: "Lights out, town 3", phases: HIDDEN },
  { id: "wxFixes", label: "Outages fixed by crews", phases: HIDDEN },
  { id: "wxMoves", label: "Crews sent", phases: HIDDEN },
  { id: "wxFronts", label: "Storm fronts so far", phases: HIDDEN },
  { id: "wxLastKind", label: "Last storm result", phases: HIDDEN },
  { id: "wxLastTown", label: "Last storm town", phases: HIDDEN },
  { id: "wxLastPayout", label: "Last storm payout", phases: HIDDEN },
  { id: "wxPending", label: "Storm power still flowing in", phases: HIDDEN },
  { id: "wxSurgeRate", label: "Storm power surge rate", phases: HIDDEN },
  { id: "wxHeld", label: "Storms held", phases: HIDDEN },
  { id: "wxFlickered", label: "Storms that flickered", phases: HIDDEN },
  { id: "wxEarned", label: "Storm power earned", phases: HIDDEN },
  // The sky's dials (The Sky): the design split, the sun's edge, the flares and
  // the wild probes, read by design.ts and sunEdge.ts
  { id: "skSeed", label: "Flare random stream", phases: HIDDEN },
  { id: "skT0", label: "Design target, speed", phases: HIDDEN },
  { id: "skT1", label: "Design target, mirrors", phases: HIDDEN },
  { id: "skT2", label: "Design target, copying", phases: HIDDEN },
  { id: "skT3", label: "Design target, shields", phases: HIDDEN },
  { id: "skE0", label: "Design at work, speed", phases: HIDDEN },
  { id: "skE1", label: "Design at work, mirrors", phases: HIDDEN },
  { id: "skE2", label: "Design at work, copying", phases: HIDDEN },
  { id: "skE3", label: "Design at work, shields", phases: HIDDEN },
  { id: "skPool", label: "Design points on their way", phases: HIDDEN },
  { id: "skResplits", label: "Times the design was changed", phases: HIDDEN },
  { id: "skDist", label: "Sun's edge, chosen step", phases: HIDDEN },
  { id: "skDistNow", label: "Sun's edge, where the fleet is", phases: HIDDEN },
  { id: "skFlareIn", label: "Seconds to the next flare", phases: HIDDEN },
  {
    id: "skFlareSize",
    label: "Next flare size (0 small, 2 big)",
    phases: HIDDEN,
  },
  { id: "skFlareFore", label: "Next flare as forecast", phases: HIDDEN },
  { id: "skFlareWrong", label: "What a wrong forecast says", phases: HIDDEN },
  {
    id: "skFlareSureRoll",
    label: "Whether the forecast is right",
    phases: HIDDEN,
  },
  {
    id: "skDistChanges",
    label: "Times the sun's edge was changed",
    phases: HIDDEN,
  },
  {
    id: "skMood",
    label: "The sun's mood (0 quiet, 2 restless)",
    phases: HIDDEN,
  },
  {
    id: "skMoodLeft",
    label: "Seconds until the sun's mood changes",
    phases: HIDDEN,
  },
  { id: "skMoods", label: "Times the sun's mood changed", phases: HIDDEN },
  { id: "skFlares", label: "Flares so far", phases: HIDDEN },
  { id: "skHitLeft", label: "Flare moment, seconds left", phases: HIDDEN },
  {
    id: "skHitSize",
    label: "Last flare size (0 small, 2 big)",
    phases: HIDDEN,
  },
  {
    id: "skHitLost",
    label: "Last flare, share of the fleet lost",
    phases: HIDDEN,
  },
  {
    id: "skHitSaved",
    label: "Last flare, share the shields saved",
    phases: HIDDEN,
  },
  { id: "skWild", label: "Wild probes", phases: HIDDEN },
  { id: "skWilds", label: "Times probes went wild", phases: HIDDEN },
  { id: "skWildLeft", label: "Gone wild moment, seconds left", phases: HIDDEN },
  { id: "skRecall", label: "Bringing them home, seconds left", phases: HIDDEN },
  {
    id: "skRecalls",
    label: "Times wild probes were brought home",
    phases: HIDDEN,
  },
  { id: "skHomeLeft", label: "Home moment, seconds left", phases: HIDDEN },
  // The Sky
  {
    id: "energy",
    label: "Energy",
    phases: [PHASE_SKY],
    purpose: "Buys collectors and star probes.",
  },
  { id: "collectors", label: "Sun collectors", phases: [PHASE_SKY] },
  { id: "probes", label: "Probes", phases: [PHASE_SKY] },
  { id: "starsTaken", label: "Stars taken", phases: HIDDEN },
  {
    id: "stars",
    label: "Stars remaining",
    initial: TOTAL_STARS,
    phases: [PHASE_SKY],
  },
  // The Last Light
  {
    id: "resolve",
    label: "Resolve",
    phases: [PHASE_LAST],
    purpose: "Spend it to let lights go dark.",
  },
  {
    id: "flame",
    label: "Flame",
    initial: 600,
    phases: [PHASE_LAST],
    // The flame holds 0-1000; the player reads it as a percent.
    format: (v) => `${Math.round(v / 10)}%`,
  },
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
