export type ToolId =
  | "asteroid"
  | "meteorShower"
  | "megaBomb"
  | "nuke"
  | "supervolcano"
  | "earthquake"
  | "alienLaser"
  | "freezeRay"
  | "moonRam"
  | "blackHole";
export type EndingFamily = "shatter" | "molten" | "frozen";
export type EndingKind = EndingFamily | "swallowed";

export interface ToolSpec {
  id: ToolId;
  /** Kid-readable English name (used for aria-labels). */
  name: string;
  icon: string;
  family: EndingFamily;
  /** Health % removed per hit (before wreck scaling). */
  power: number;
  /** Angular radius, radians. */
  radius: number;
  /** 0..1 share of people in the radius lost. */
  lethality: number;
  cooldownMs: number;
  mode: "tap" | "hold";
  /** Always ends the planet with this ending. */
  finisher?: EndingKind;
  stamp: "crater" | "scorch" | "lava" | "crack" | "ice" | "trench" | "none";
}

export const TOOLS: Record<ToolId, ToolSpec> = {
  asteroid: {
    id: "asteroid",
    name: "Asteroid",
    icon: "☄️",
    family: "shatter",
    power: 4,
    radius: 0.08,
    lethality: 0.6,
    cooldownMs: 350,
    mode: "tap",
    stamp: "crater",
  },
  meteorShower: {
    id: "meteorShower",
    name: "Meteor shower",
    icon: "🌠",
    family: "shatter",
    power: 1.2, // per meteor; the effect fires 10
    radius: 0.04,
    lethality: 0.5,
    cooldownMs: 1800,
    mode: "tap",
    stamp: "crater",
  },
  megaBomb: {
    id: "megaBomb",
    name: "Mega bomb",
    icon: "💣",
    family: "molten",
    power: 7,
    radius: 0.12,
    lethality: 0.8,
    cooldownMs: 700,
    mode: "tap",
    stamp: "scorch",
  },
  nuke: {
    id: "nuke",
    name: "Nuke",
    icon: "☢️",
    family: "molten",
    power: 12,
    radius: 0.2,
    lethality: 0.95,
    cooldownMs: 1500,
    mode: "tap",
    stamp: "scorch",
  },
  supervolcano: {
    id: "supervolcano",
    name: "Supervolcano",
    icon: "🌋",
    family: "molten",
    power: 10,
    radius: 0.15,
    lethality: 0.7,
    cooldownMs: 2000,
    mode: "tap",
    stamp: "lava",
  },
  earthquake: {
    id: "earthquake",
    name: "Earthquake",
    icon: "⚡",
    family: "shatter",
    power: 11,
    radius: 0.1, // along a crack
    lethality: 0.6,
    cooldownMs: 2000,
    mode: "tap",
    stamp: "crack",
  },
  alienLaser: {
    id: "alienLaser",
    name: "Alien laser",
    icon: "🛸",
    family: "molten",
    power: 0.8, // per tick, 8 ticks a second
    radius: 0.04,
    lethality: 0.9,
    cooldownMs: 125,
    mode: "hold",
    stamp: "trench",
  },
  freezeRay: {
    id: "freezeRay",
    name: "Freeze ray",
    icon: "❄️",
    family: "frozen",
    power: 14,
    radius: 0.35,
    lethality: 0.5,
    cooldownMs: 2000,
    mode: "tap",
    stamp: "ice",
  },
  moonRam: {
    id: "moonRam",
    name: "Moon ram",
    icon: "🌙",
    family: "shatter",
    power: 100,
    radius: 0.5,
    lethality: 1,
    cooldownMs: 0,
    mode: "tap",
    finisher: "shatter",
    stamp: "crater",
  },
  blackHole: {
    id: "blackHole",
    name: "Black hole",
    icon: "🕳️",
    family: "shatter",
    power: 100,
    radius: 0.3,
    lethality: 1,
    cooldownMs: 0,
    mode: "tap",
    finisher: "swallowed",
    stamp: "none",
  },
};

export const TOOL_ORDER: readonly ToolId[] = [
  "asteroid",
  "meteorShower",
  "megaBomb",
  "nuke",
  "supervolcano",
  "earthquake",
  "alienLaser",
  "freezeRay",
  "moonRam",
  "blackHole",
];
