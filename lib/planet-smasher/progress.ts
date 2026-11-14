import type { PlanetId } from "./planets";
import { PLANETS } from "./planets";
import type { EndingKind, ToolId } from "./tools";
import { TOOLS } from "./tools";

export const PROGRESS_KEY = "planet-smasher:progress:v1";
export const FIRST_ENDING_BONUS = 300;

export interface Progress {
  points: number;
  endingsSeen: EndingKind[];
  planetId: PlanetId;
  toolId: ToolId;
}

const ENDINGS: readonly EndingKind[] = [
  "shatter",
  "molten",
  "frozen",
  "swallowed",
];

export function freshProgress(): Progress {
  return { points: 0, endingsSeen: [], planetId: "earth", toolId: "asteroid" };
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
