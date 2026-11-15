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
  | "blackHole"
  | "nukeTwin"
  | "nukeRain"
  | "ufoSwarm"
  | "gravityBeam"
  | "nanobots"
  | "mothership"
  | "monster"
  | "tsunami"
  | "sunDive"
  | "planetCollision";
export type EndingFamily = "shatter" | "molten" | "frozen" | "consumed";
export type EndingKind = EndingFamily | "swallowed" | "vaporized" | "collided";

export type ToolCategory = "space" | "bombs" | "nature" | "aliens";

export interface ToolSpec {
  id: ToolId;
  /** Kid-readable English name (used for aria-labels). */
  name: string;
  icon: string;
  /** Which arsenal tab the tool lives on. */
  category: ToolCategory;
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
  stamp:
    | "crater"
    | "scorch"
    | "lava"
    | "crack"
    | "ice"
    | "trench"
    | "goo"
    | "abduct"
    | "flood"
    | "none";
}

export const TOOLS: Record<ToolId, ToolSpec> = {
  asteroid: {
    id: "asteroid",
    name: "Asteroid",
    icon: "☄️",
    category: "space",
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
    category: "space",
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
    category: "bombs",
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
    category: "bombs",
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
    category: "nature",
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
    category: "nature",
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
    icon: "🔫",
    category: "aliens",
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
    category: "nature",
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
    category: "space",
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
    category: "space",
    family: "shatter",
    power: 100,
    radius: 0.3,
    lethality: 1,
    cooldownMs: 0,
    mode: "tap",
    finisher: "swallowed",
    stamp: "none",
  },
  nukeTwin: {
    id: "nukeTwin",
    name: "Twin nuke",
    icon: "☢️",
    category: "bombs",
    family: "molten",
    power: 10, // per warhead; the effect fires 2
    radius: 0.18,
    lethality: 0.95,
    cooldownMs: 1800,
    mode: "tap",
    stamp: "scorch",
  },
  nukeRain: {
    id: "nukeRain",
    name: "Nuke rain",
    icon: "🚀",
    category: "bombs",
    family: "molten",
    power: 7, // per warhead; the effect fires 6
    radius: 0.14,
    lethality: 0.9,
    cooldownMs: 3000,
    mode: "tap",
    stamp: "scorch",
  },
  ufoSwarm: {
    id: "ufoSwarm",
    name: "UFO swarm",
    icon: "👾",
    category: "aliens",
    family: "molten",
    power: 1.5, // per beam; the effect fires 12
    radius: 0.05,
    lethality: 1,
    cooldownMs: 3500,
    mode: "tap",
    stamp: "abduct",
  },
  gravityBeam: {
    id: "gravityBeam",
    name: "Gravity beam",
    icon: "🧲",
    category: "aliens",
    family: "shatter",
    power: 9,
    radius: 0.13,
    lethality: 0.8,
    cooldownMs: 1500,
    mode: "tap",
    stamp: "crater",
  },
  nanobots: {
    id: "nanobots",
    name: "Nanobot swarm",
    icon: "🤖",
    category: "aliens",
    family: "consumed",
    power: 1.1, // per tick; 40 ticks over 10 s
    radius: 0.07,
    lethality: 0.7,
    cooldownMs: 4000,
    mode: "tap",
    stamp: "goo",
  },
  mothership: {
    id: "mothership",
    name: "Mothership",
    icon: "🛸",
    category: "aliens",
    family: "shatter",
    power: 100,
    radius: 0.5,
    lethality: 1,
    cooldownMs: 6000,
    mode: "tap",
    finisher: "shatter",
    stamp: "scorch",
  },
  monster: {
    id: "monster",
    name: "Giant monster",
    icon: "🦖",
    category: "nature",
    family: "shatter",
    power: 3, // per stomp (4); each eye laser hit adds 2 (2)
    radius: 0.07,
    lethality: 0.8,
    cooldownMs: 7000,
    mode: "tap",
    stamp: "crater",
  },
  tsunami: {
    id: "tsunami",
    name: "Tsunami",
    icon: "🌊",
    category: "nature",
    family: "shatter",
    power: 1, // per wave hit (16)
    radius: 0.09,
    lethality: 0.6,
    cooldownMs: 5000,
    mode: "tap",
    stamp: "flood",
  },
  sunDive: {
    id: "sunDive",
    name: "Sun dive",
    icon: "☀️",
    category: "space",
    family: "molten",
    power: 100,
    radius: 0.5,
    lethality: 1,
    cooldownMs: 8000,
    mode: "tap",
    finisher: "vaporized",
    stamp: "scorch",
  },
  planetCollision: {
    id: "planetCollision",
    name: "Planet collision",
    icon: "🪐",
    category: "space",
    family: "shatter",
    power: 100,
    radius: 0.6,
    lethality: 1,
    cooldownMs: 8000,
    mode: "tap",
    finisher: "collided",
    stamp: "crater",
  },
};

export const TOOL_ORDER: readonly ToolId[] = [
  "asteroid",
  "meteorShower",
  "megaBomb",
  "nuke",
  "nukeTwin",
  "nukeRain",
  "supervolcano",
  "earthquake",
  "alienLaser",
  "ufoSwarm",
  "gravityBeam",
  "nanobots",
  "freezeRay",
  "moonRam",
  "blackHole",
  "mothership",
  "monster",
  "tsunami",
  "sunDive",
  "planetCollision",
];

/** The arsenal tabs, in order, with the tools each one holds. */
export const CATEGORIES: readonly {
  id: ToolCategory;
  icon: string;
  name: string;
  tools: readonly ToolId[];
}[] = [
  {
    id: "space",
    icon: "🌠",
    name: "Space",
    tools: [
      "asteroid",
      "meteorShower",
      "moonRam",
      "blackHole",
      "sunDive",
      "planetCollision",
    ],
  },
  {
    id: "bombs",
    icon: "💣",
    name: "Bombs",
    tools: ["megaBomb", "nuke", "nukeTwin", "nukeRain"],
  },
  {
    id: "nature",
    icon: "🌋",
    name: "Nature",
    tools: ["supervolcano", "earthquake", "tsunami", "freezeRay", "monster"],
  },
  {
    id: "aliens",
    icon: "👽",
    name: "Aliens",
    tools: ["alienLaser", "ufoSwarm", "gravityBeam", "nanobots", "mothership"],
  },
];
