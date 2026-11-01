/**
 * Seasonal looks for the start screen and the home-screen icon.
 *
 * Each season is plain data: when it runs, its colors, what the robot wears
 * and what drifts through the sky. To add one, add an entry to SEASONS (and
 * its id to SeasonId); nothing else needs to change.
 */

export type SeasonId = "default" | "autumn" | "winter" | "spring" | "summer";

/** What falls or floats across the scene (twinkling stars are always there). */
export type Particles = "none" | "leaves" | "snow" | "blossoms" | "fireflies";

/** A small pixel sprite drawn over the robot. `x`/`y` are robot pixels. */
export interface Accessory {
  x: number;
  y: number;
  /** One string per row; "." is empty, any other character is a palette key. */
  rows: readonly string[];
  /** Palette keys for this accessory, merged over the robot's own. */
  colors: Readonly<Record<string, string>>;
}

export interface Season {
  id: SeasonId;
  label: string;
  /** Calendar months (1 = January) the season runs. */
  months: readonly number[];
  /** Lantern flame and glow. */
  lantern: string;
  /** The sweeping beam. */
  beam: string;
  /** What drifts through the sky. */
  particles: Particles;
  accessories: readonly Accessory[];
}

export const SEASONS: readonly Season[] = [
  {
    id: "autumn",
    label: "Autumn",
    months: [10, 11],
    lantern: "#fb923c",
    beam: "#fb923c",
    particles: "leaves",
    accessories: [
      {
        // A tiny pumpkin hat that covers the antenna.
        x: 4,
        y: -2,
        rows: [".....GG.....", "..PPPPPPPP..", ".PPpPPPPpPP.", "PPPPPPPPPPPP"],
        colors: { G: "#4ade80", P: "#f97316", p: "#c2410c" },
      },
    ],
  },
  {
    id: "winter",
    label: "Winter",
    months: [12, 1],
    lantern: "#fde68a",
    beam: "#bae6fd",
    particles: "snow",
    accessories: [
      {
        // A red scarf with a tail.
        x: 4,
        y: 9,
        rows: ["SSSSSSSSSSSS", "sSSSSSSSSSSs", "..SS........", "..sS........"],
        colors: { S: "#ef4444", s: "#b91c1c" },
      },
    ],
  },
  {
    id: "spring",
    label: "Spring",
    months: [3, 4, 5],
    lantern: "#fef08a",
    beam: "#fbcfe8",
    particles: "blossoms",
    accessories: [
      {
        // A little sprout growing from the antenna.
        x: 7,
        y: -3,
        rows: ["GG..GG", ".GGGG.", "..gg..", "..gg..", "..gg.."],
        colors: { G: "#86efac", g: "#16a34a" },
      },
    ],
  },
  {
    id: "summer",
    label: "Summer",
    months: [6, 7, 8],
    lantern: "#fde047",
    beam: "#fde047",
    particles: "fireflies",
    accessories: [
      {
        // Sunglasses over the visor.
        x: 6,
        y: 4,
        rows: ["FFFFFFFF", "DDDFFDDD", "DDDFFDDD"],
        colors: { F: "#f472b6", D: "#3730a3" },
      },
    ],
  },
];

export const DEFAULT_SEASON: Season = {
  id: "default",
  label: "Evergreen",
  months: [],
  lantern: "#fbbf24",
  beam: "#fcd34d",
  particles: "none",
  accessories: [],
};

/** The look for a date, from its local calendar month. */
export function currentSeason(date: Date = new Date()): Season {
  const month = date.getMonth() + 1;
  return SEASONS.find((s) => s.months.includes(month)) ?? DEFAULT_SEASON;
}

/** A season by id (used by `?season=` previews and the icon script). */
export function seasonById(id: string | null | undefined): Season | null {
  if (id === "default") return DEFAULT_SEASON;
  return SEASONS.find((s) => s.id === id) ?? null;
}
