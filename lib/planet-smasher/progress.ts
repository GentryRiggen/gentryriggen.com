import type { PlanetId } from "./planets";
import { PLANETS } from "./planets";
import type { EndingKind, ToolId } from "./tools";
import { TOOLS } from "./tools";
import { TROPHIES, type TrophyId } from "./trophies";

export const PROGRESS_KEY = "planet-smasher:progress:v1";
export const FIRST_ENDING_BONUS = 300;

export interface Stats {
  planetsEnded: number;
  endedByPlanet: Partial<Record<PlanetId, number>>;
  endedBy: Partial<Record<EndingKind, number>>;
  shots: Partial<Record<ToolId, number>>;
  peopleLost: number;
  bestCombo: number;
  fastestEndMs: number | null;
}

export interface Progress {
  points: number;
  endingsSeen: EndingKind[];
  planetId: PlanetId;
  toolId: ToolId;
  stats: Stats;
  trophies: TrophyId[];
}

export function freshStats(): Stats {
  return {
    planetsEnded: 0,
    endedByPlanet: {},
    endedBy: {},
    shots: {},
    peopleLost: 0,
    bestCombo: 0,
    fastestEndMs: null,
  };
}

const num = (x: unknown): number =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : 0;

/** Keeps only known keys with sane counts. */
function counts<K extends string>(
  raw: unknown,
  keys: readonly K[]
): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const k of keys) {
    const n = num((raw as Record<string, unknown>)[k]);
    if (n > 0) out[k] = n;
  }
  return out;
}

function loadStats(raw: unknown): Stats {
  const fresh = freshStats();
  if (!raw || typeof raw !== "object") return fresh;
  const d = raw as Record<string, unknown>;
  return {
    planetsEnded: num(d.planetsEnded),
    endedByPlanet: counts(d.endedByPlanet, Object.keys(PLANETS) as PlanetId[]),
    endedBy: counts(d.endedBy, ENDINGS),
    shots: counts(d.shots, Object.keys(TOOLS) as ToolId[]),
    peopleLost: num(d.peopleLost),
    bestCombo: num(d.bestCombo),
    fastestEndMs:
      typeof d.fastestEndMs === "number" &&
      Number.isFinite(d.fastestEndMs) &&
      d.fastestEndMs >= 0
        ? d.fastestEndMs
        : null,
  };
}

const ENDINGS: readonly EndingKind[] = [
  "shatter",
  "molten",
  "frozen",
  "consumed",
  "swallowed",
  "vaporized",
  "collided",
];

export function freshProgress(): Progress {
  return {
    points: 0,
    endingsSeen: [],
    planetId: "earth",
    toolId: "asteroid",
    stats: freshStats(),
    trophies: [],
  };
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadProgress(storage?: Storage | null): Progress {
  const fresh = freshProgress();
  try {
    const store = storage === undefined ? defaultStorage() : storage;
    const raw = store?.getItem(PROGRESS_KEY);
    if (!raw) return fresh;
    const data = JSON.parse(raw) as Partial<Record<keyof Progress, unknown>>;
    if (!data || typeof data !== "object") return fresh;
    return {
      points:
        typeof data.points === "number" &&
        Number.isFinite(data.points) &&
        data.points >= 0
          ? data.points
          : 0,
      endingsSeen: Array.isArray(data.endingsSeen)
        ? ENDINGS.filter((e) => (data.endingsSeen as unknown[]).includes(e))
        : [],
      planetId:
        typeof data.planetId === "string" &&
        Object.prototype.hasOwnProperty.call(PLANETS, data.planetId)
          ? (data.planetId as PlanetId)
          : fresh.planetId,
      toolId:
        typeof data.toolId === "string" &&
        Object.prototype.hasOwnProperty.call(TOOLS, data.toolId)
          ? (data.toolId as ToolId)
          : fresh.toolId,
      stats: loadStats(data.stats),
      trophies: Array.isArray(data.trophies)
        ? TROPHIES.map((t) => t.id).filter((id) =>
            (data.trophies as unknown[]).includes(id)
          )
        : [],
    };
  } catch {
    return fresh;
  }
}

export function saveProgress(p: Progress, storage?: Storage | null): void {
  try {
    const store = storage === undefined ? defaultStorage() : storage;
    store?.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // Private mode or a full disk: progress just will not persist.
  }
}
