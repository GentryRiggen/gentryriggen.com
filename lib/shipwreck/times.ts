import type { ShipId } from "./ships/types";

/**
 * The time button (1.9): each ship at her real hour or another to try, and
 * how each looks on its chip. Plain data (no three.js: the HUD reads it);
 * the scene builds each hour's settings (`sceneSettingsFor` in
 * components/shipwreck/scene/settings.ts).
 */

/** Ships whose real scene is a storm: they keep it, offered by day too. */
const STORM_SHIPS: ReadonlySet<ShipId> = new Set(["fitzgerald", "poseidon"]);

/** A time the button offers: "real" is her own (`SCENE_SETTINGS`). */
export type TimeId =
  "real" | "morning" | "afternoon" | "sunset" | "night" | "storm-day";

/** How a time looks on its chip (an SVG: a sky, a sun or moon, the sea). */
export interface TimeChip {
  /** The sky at the top and at the horizon (sRGB hex). */
  top: string;
  low: string;
  /** The sea (sRGB hex). */
  sea: string;
  /** The sun (its height on the chip, 0 the horizon to 1 the top), or the moon. */
  sun: number | "moon" | "cloud";
}

export interface TimeOption {
  id: TimeId;
  /** Words for the button and its help (a young player's). */
  label: string;
  chip: TimeChip;
}

const CHIPS: Record<Exclude<TimeId, "real">, TimeChip> = {
  morning: { top: "#7fa8d8", low: "#f3cfa0", sea: "#2a5d8a", sun: 0.2 },
  afternoon: { top: "#3f7fd0", low: "#bcd4ea", sea: "#2b6c7a", sun: 0.8 },
  sunset: { top: "#3b3f78", low: "#f08a4a", sea: "#3a3a5c", sun: 0.08 },
  night: { top: "#03060f", low: "#16213a", sea: "#050b16", sun: "moon" },
  "storm-day": { top: "#6d777d", low: "#9aa4a8", sea: "#3c4a4c", sun: "cloud" },
};

/** Her real hour, as a young player hears it, and its chip. */
const REAL: Record<ShipId, { label: string; chip: TimeChip }> = {
  titanic: { label: "Real: 11:40 at night", chip: CHIPS.night },
  lusitania: { label: "Real: 2:10 in the afternoon", chip: CHIPS.afternoon },
  fitzgerald: {
    label: "Real: a stormy evening, getting dark",
    chip: { top: "#1c2226", low: "#4a5358", sea: "#1d2a2c", sun: "cloud" },
  },
  carpathia: {
    label: "Real: 9:15 in the morning",
    chip: { top: "#8ea6c0", low: "#d6dde4", sea: "#2a4e70", sun: 0.45 },
  },
  britannic: { label: "Real: 8:12 in the morning", chip: CHIPS.morning },
  concordia: { label: "Real: 9:45 at night", chip: CHIPS.night },
  poseidon: {
    label: "Real: New Year's Eve, just before midnight",
    chip: { top: "#070b14", low: "#1c2733", sea: "#0a1118", sun: "cloud" },
  },
};

const LABELS: Record<Exclude<TimeId, "real">, string> = {
  morning: "Early morning",
  afternoon: "Sunny afternoon",
  sunset: "Sunset",
  night: "Night, with stars",
  "storm-day": "The storm by day",
};

/** Her own words for the time button's by-day choice. */
const POSEIDON_DAY = "The big wave by day";

/** Which of the made-up hours stands for her real one (not offered twice). */
const REAL_IS: Record<ShipId, Exclude<TimeId, "real"> | null> = {
  titanic: "night",
  lusitania: "afternoon",
  fitzgerald: null,
  carpathia: "morning",
  britannic: "morning",
  concordia: "night",
  poseidon: null,
};

/** Her real time first, then the others to try. */
export function timesOf(ship: ShipId): TimeOption[] {
  const real: TimeOption = { id: "real", ...REAL[ship] };
  const others: Exclude<TimeId, "real">[] = STORM_SHIPS.has(ship)
    ? ["storm-day"]
    : (["morning", "afternoon", "sunset", "night"] as const).filter(
        (id) => id !== REAL_IS[ship]
      );
  return [
    real,
    ...others.map((id) => ({
      id,
      label:
        ship === "poseidon" && id === "storm-day" ? POSEIDON_DAY : LABELS[id],
      chip: CHIPS[id],
    })),
  ];
}

/** `id` when the ship offers it, else "real". */
export function resolveTime(ship: ShipId, id: string | null): TimeId {
  return timesOf(ship).some((o) => o.id === id) ? (id as TimeId) : "real";
}
