/**
 * The anonymous gameplay events (the `gameEvents` Firestore collection).
 *
 * Players are children, so an event is self-contained and carries no user id,
 * no session id, no free text and nothing that fingerprints a device: just
 * what happened, as enums and small whole numbers. This file is the single
 * source of truth for the shape: firestore.rules mirrors it (checked by
 * firestore-tests/gameEvents.test.ts, which feeds every event and every enum
 * value through the real rules) and the admin dashboard parses with it.
 */

export type GameSite = "plane-builder" | "ship-builder";

export type PropSpec =
  | { kind: "enum"; values: readonly string[] }
  /** A whole number; `step` (when set) means a multiple of it, or -1 if `min` is -1. */
  | { kind: "int"; min: number; max: number; step?: number };

const WORLDS = [
  "meadow",
  "canyon",
  "mountains",
  "beach",
  "jungle",
  "city",
  "glacier",
  "volcano",
  "storm",
  "islands",
] as const;

const OBSTACLE_KINDS = [
  "tree",
  "barn",
  "balloon",
  "wall",
  "arch",
  "bird",
  "peak",
  "palm",
  "skyscraper",
  "iceberg",
  "cloud",
] as const;

const PART_CATEGORIES = [
  "decks",
  "cabins",
  "command",
  "funnels",
  "masts",
  "lifeboats",
  "decor",
  "lights",
  "propulsion",
  "naval",
  "cargo",
  "sails",
  "weapons",
] as const;

/**
 * The built-in ship templates. A closed list on purpose: a free-form id could
 * carry text a child typed (or anything an attacker likes) onto the dashboard.
 * A test keeps it equal to the template registry and to firestore.rules.
 */
export const TEMPLATE_IDS = [
  "ever-given",
  "little-hopper",
  "wonder-of-the-seas",
  "ocean-breeze",
  "titanic",
  "olympic",
  "britannic",
  "lusitania",
  "carpathia",
  "arleigh-burke",
  "coast-guard-cutter",
  "small-sloop",
  "whydah-gally",
  "queen-annes-revenge",
  "black-pearl-galleon",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export function isTemplateId(id: string): id is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(id);
}

/** The longest course is under 10 km; crash positions are 50 m buckets. */
export const CRASH_BUCKET_METERS = 50;
const MAX_CRASH_X = 12_000;

/** Tenths of a course flown (0 to 10). */
const TENTHS = { kind: "int", min: 0, max: 10 } as const;
const FLAG = { kind: "int", min: 0, max: 1 } as const;
const WORLD = { kind: "enum", values: WORLDS } as const;

/**
 * Each event: the site it belongs to, the share of occurrences that are sent
 * (high-volume events are sampled), and the fixed schema of its `props`.
 */
export const GAME_EVENTS = {
  // ---- Plane Builder ----------------------------------------------------
  flight_end: {
    site: "plane-builder",
    sample: 1,
    props: {
      world: WORLD,
      outcome: {
        kind: "enum",
        values: [
          "finish",
          "crash",
          "landed",
          "stalled",
          "timeout",
          "out_of_fuel",
        ],
      },
      /** How far along the course the flight got, in tenths. */
      dist: TENTHS,
      /** Crash position, bucketed to 50 m; -1 when the flight did not crash. */
      crashX: {
        kind: "int",
        min: -1,
        max: MAX_CRASH_X,
        step: CRASH_BUCKET_METERS,
      },
      obstacle: {
        kind: "enum",
        values: [...OBSTACLE_KINDS, "none"],
      },
      /** The sum of the six upgrade tiers (each 0 to 8). */
      tiers: { kind: "int", min: 0, max: 48 },
      daily: FLAG,
    },
  },
  upgrade_bought: {
    site: "plane-builder",
    sample: 1,
    props: {
      part: {
        kind: "enum",
        values: ["launcher", "wings", "engine", "fuel", "body", "multiplier"],
      },
      tier: { kind: "int", min: 1, max: 8 },
    },
  },
  world_unlocked: { site: "plane-builder", sample: 1, props: { world: WORLD } },
  daily_played: {
    site: "plane-builder",
    sample: 1,
    props: {
      world: WORLD,
      twist: {
        kind: "enum",
        values: ["tailwind", "headwind", "doubleCoins", "noBoost"],
      },
      finished: FLAG,
    },
  },
  quit_mid_flight: {
    site: "plane-builder",
    sample: 1,
    props: { world: WORLD, dist: TENTHS },
  },
  // ---- Ship Builder -----------------------------------------------------
  trial_run: {
    site: "ship-builder",
    sample: 1,
    props: {
      kind: { kind: "enum", values: ["weather", "iceberg"] },
      outcome: {
        kind: "enum",
        values: ["steady", "recovered", "capsized", "afloat", "sank"],
      },
      sea: { kind: "enum", values: ["calm", "choppy", "stormy"] },
    },
  },
  challenge_result: {
    site: "ship-builder",
    sample: 1,
    props: {
      id: { kind: "enum", values: ["outlast", "evacuation", "shipshape"] },
      stars: { kind: "int", min: 0, max: 3 },
    },
  },
  template_used: {
    site: "ship-builder",
    sample: 1,
    props: { template: { kind: "enum", values: TEMPLATE_IDS } },
  },
  /** Fires on every placement, so only one in twenty is sent. */
  part_placed: {
    site: "ship-builder",
    sample: 0.05,
    props: { category: { kind: "enum", values: PART_CATEGORIES } },
  },
  walk_started: {
    site: "ship-builder",
    sample: 1,
    props: { start: { kind: "enum", values: ["bow", "middle", "stern"] } },
  },
  drive_started: {
    site: "ship-builder",
    sample: 1,
    props: { density: { kind: "enum", values: ["few", "some", "many"] } },
  },
  ship_shared: { site: "ship-builder", sample: 1, props: {} },
} as const satisfies Record<
  string,
  { site: GameSite; sample: number; props: Record<string, PropSpec> }
>;

export type GameEventName = keyof typeof GAME_EVENTS;
export const GAME_EVENT_NAMES = Object.keys(GAME_EVENTS) as GameEventName[];

type PropValue<S> = S extends { kind: "enum"; values: readonly (infer V)[] }
  ? V
  : S extends { kind: "int" }
    ? number
    : S extends { kind: "slug" }
      ? string
      : never;

export type GameEventProps<N extends GameEventName> = {
  -readonly [K in keyof (typeof GAME_EVENTS)[N]["props"]]: PropValue<
    (typeof GAME_EVENTS)[N]["props"][K]
  >;
};

/** A validated event, as stored (besides the server timestamp). */
export interface GameEvent<N extends GameEventName = GameEventName> {
  site: GameSite;
  name: N;
  props: Record<string, string | number>;
  /** The UTC day the event happened, `yyyy-mm-dd`. */
  day: string;
}

/** Events allowed per page load, so a runaway loop costs nothing. */
export const MAX_EVENTS_PER_PAGE_LOAD = 50;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isValidProp(spec: PropSpec, value: unknown): boolean {
  switch (spec.kind) {
    case "enum":
      return typeof value === "string" && spec.values.includes(value);
    case "int": {
      if (typeof value !== "number" || !Number.isInteger(value)) return false;
      if (value < spec.min || value > spec.max) return false;
      return !spec.step || value === -1 || value % spec.step === 0;
    }
  }
}

/** True when `props` has exactly this event's keys, each with a legal value. */
export function isValidGameProps(
  name: string,
  props: unknown
): props is Record<string, string | number> {
  if (!Object.hasOwn(GAME_EVENTS, name)) return false;
  if (typeof props !== "object" || props === null) return false;
  const specs: Record<string, PropSpec> =
    GAME_EVENTS[name as GameEventName].props;
  const keys = Object.keys(props);
  if (keys.length !== Object.keys(specs).length) return false;
  return keys.every(
    (key) =>
      Object.hasOwn(specs, key) &&
      isValidProp(specs[key], (props as Record<string, unknown>)[key])
  );
}

export function isGameEventName(name: unknown): name is GameEventName {
  return typeof name === "string" && Object.hasOwn(GAME_EVENTS, name);
}

/** Builds the event for `name`, or null if the props break the schema. */
export function buildGameEvent<N extends GameEventName>(
  name: N,
  props: GameEventProps<N>,
  now: Date = new Date()
): GameEvent<N> | null {
  if (!isValidGameProps(name, props)) return null;
  return {
    site: GAME_EVENTS[name].site,
    name,
    props: { ...props },
    day: now.toISOString().slice(0, 10),
  };
}

/** Parses a stored doc's fields; null when anything is off (skip it). */
export function parseGameEvent(data: {
  site?: unknown;
  name?: unknown;
  props?: unknown;
  day?: unknown;
}): GameEvent | null {
  if (!isGameEventName(data.name)) return null;
  if (data.site !== GAME_EVENTS[data.name].site) return null;
  if (typeof data.day !== "string" || !DAY.test(data.day)) return null;
  if (!isValidGameProps(data.name, data.props)) return null;
  return {
    site: GAME_EVENTS[data.name].site,
    name: data.name,
    props: data.props,
    day: data.day,
  };
}

/** Rounds a crash position down to its 50 m bucket (-1 for "no crash"). */
export function crashBucket(x: number | null): number {
  if (x === null || !Number.isFinite(x) || x < 0) return -1;
  return Math.min(
    MAX_CRASH_X,
    Math.floor(x / CRASH_BUCKET_METERS) * CRASH_BUCKET_METERS
  );
}

/** Tenths of the way along a course, clamped to 0 to 10. */
export function tenths(distance: number, total: number): number {
  if (!Number.isFinite(distance) || !(total > 0)) return 0;
  return Math.max(0, Math.min(10, Math.floor((distance / total) * 10)));
}
