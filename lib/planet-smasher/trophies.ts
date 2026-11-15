import type { PlanetId } from "./planets";
import type { Progress } from "./progress";
import type { EndingKind, ToolId } from "./tools";
import { TOOL_ORDER } from "./tools";

export type TrophyId =
  | "firstSmash"
  | "smash10"
  | "smash50"
  | "nuke25"
  | "nuke100"
  | "allEndings"
  | "meteorsOnly"
  | "laserOnly"
  | "aliens"
  | "combo10"
  | "mars"
  | "frostia"
  | "everyTool"
  | "blackHole"
  | "monster"
  | "sunDive"
  | "collision"
  | "speedy"
  | "billions"
  | "stars10k";

export interface TrophySpec {
  id: TrophyId;
  icon: string;
  name: string;
  /** Set for trophies that count toward a number. */
  goal?: number;
}

export const TROPHY_REWARD = 150;

export const TROPHIES: readonly TrophySpec[] = [
  { id: "firstSmash", icon: "💥", name: "First smash" },
  { id: "smash10", icon: "🔟", name: "10 planets", goal: 10 },
  { id: "smash50", icon: "🏅", name: "50 planets", goal: 50 },
  { id: "nuke25", icon: "☢️", name: "Nuke fan", goal: 25 },
  { id: "nuke100", icon: "🚀", name: "Nuke master", goal: 100 },
  { id: "allEndings", icon: "🌈", name: "Every ending", goal: 7 },
  { id: "meteorsOnly", icon: "☄️", name: "Rock storm" },
  { id: "laserOnly", icon: "🔫", name: "Laser show" },
  { id: "aliens", icon: "👽", name: "Alien friend", goal: 5 },
  { id: "combo10", icon: "🔥", name: "Combo ×10" },
  { id: "mars", icon: "🔴", name: "Mars smasher" },
  { id: "frostia", icon: "🧊", name: "Frostia smasher" },
  {
    id: "everyTool",
    icon: "🧰",
    name: "Every tool",
    goal: TOOL_ORDER.length,
  },
  { id: "blackHole", icon: "🕳️", name: "Swallowed whole" },
  { id: "monster", icon: "🦖", name: "Monster mash", goal: 10 },
  { id: "sunDive", icon: "☀️", name: "Too hot" },
  { id: "collision", icon: "🪐", name: "Crash!" },
  { id: "speedy", icon: "⚡", name: "Speed smash" },
  { id: "billions", icon: "🌍", name: "100 billion", goal: 100_000_000_000 },
  { id: "stars10k", icon: "⭐", name: "Star collector", goal: 10000 },
];

/** What the player has used since the current planet began. */
export interface PlanetRun {
  toolsUsed: ToolId[];
  startedAt: number;
}

const NUKES: readonly ToolId[] = ["nuke", "nukeTwin", "nukeRain"];
const ALIENS: readonly ToolId[] = [
  "alienLaser",
  "ufoSwarm",
  "gravityBeam",
  "nanobots",
  "mothership",
];

const shotsOf = (p: Progress, id: ToolId) => p.stats.shots[id] ?? 0;
const sumShots = (p: Progress, ids: readonly ToolId[]) =>
  ids.reduce((n, id) => n + shotsOf(p, id), 0);

/** The count for goal trophies; null for the others. */
export function progressToward(id: TrophyId, p: Progress): number | null {
  const s = p.stats;
  switch (id) {
    case "smash10":
    case "smash50":
      return s.planetsEnded;
    case "nuke25":
    case "nuke100":
      return sumShots(p, NUKES);
    case "allEndings":
      return p.endingsSeen.length;
    case "aliens":
      return ALIENS.filter((t) => shotsOf(p, t) > 0).length;
    case "everyTool":
      return TOOL_ORDER.filter((t) => shotsOf(p, t) > 0).length;
    case "monster":
      return shotsOf(p, "monster");
    case "billions":
      return s.peopleLost;
    case "stars10k":
      return p.points;
    default:
      return null;
  }
}

function holds(
  id: TrophyId,
  p: Progress,
  run: PlanetRun | null,
  endedNow: { ending: EndingKind; planetId: PlanetId; at: number } | null
): boolean {
  const s = p.stats;
  const goal = TROPHIES.find((t) => t.id === id)?.goal;
  switch (id) {
    case "firstSmash":
      return s.planetsEnded >= 1;
    case "smash10":
    case "smash50":
    case "nuke25":
    case "nuke100":
    case "allEndings":
    case "aliens":
    case "everyTool":
    case "monster":
    case "billions":
    case "stars10k":
      return (progressToward(id, p) ?? 0) >= (goal ?? Infinity);
    case "meteorsOnly":
      return (
        !!endedNow &&
        !!run &&
        run.toolsUsed.length > 0 &&
        run.toolsUsed.every((t) => t === "asteroid" || t === "meteorShower")
      );
    case "laserOnly":
      return (
        !!endedNow &&
        !!run &&
        run.toolsUsed.length === 1 &&
        run.toolsUsed[0] === "alienLaser"
      );
    case "combo10":
      return s.bestCombo >= 10;
    case "mars":
      return (s.endedByPlanet.mars ?? 0) >= 1;
    case "frostia":
      return (s.endedByPlanet.ice ?? 0) >= 1;
    case "blackHole":
      return (s.endedBy.swallowed ?? 0) >= 1;
    case "sunDive":
      return (s.endedBy.vaporized ?? 0) >= 1;
    case "collision":
      return (s.endedBy.collided ?? 0) >= 1;
    case "speedy":
      return s.fastestEndMs !== null && s.fastestEndMs <= 20000;
  }
}

/** Trophies whose condition holds and that are not held yet, in table order. */
export function newlyEarned(
  p: Progress,
  run: PlanetRun | null,
  endedNow: { ending: EndingKind; planetId: PlanetId; at: number } | null
): TrophyId[] {
  return TROPHIES.filter(
    (t) => !p.trophies.includes(t.id) && holds(t.id, p, run, endedNow)
  ).map((t) => t.id);
}
