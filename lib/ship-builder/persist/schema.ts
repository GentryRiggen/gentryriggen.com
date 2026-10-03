import { z } from "zod";
import { MAX_SEGMENTS, MIN_SEGMENTS } from "../model/grid";
import { MAX_NAME_LENGTH, validateShip } from "../model/placement";
import { PART_TYPES, type Ship } from "../model/types";

export const CURRENT_VERSION = 1;
export const MAX_PARTS = 1000;
const MAX_ID_LENGTH = 64;

const gridAnchor = z.object({
  kind: z.literal("grid"),
  level: z.number().int(),
  x: z.number().int(),
  z: z.number().int(),
});

const attachAnchor = z.object({
  kind: z.literal("attach"),
  parentId: z.string().min(1).max(MAX_ID_LENGTH),
  pointId: z.string().min(1).max(MAX_ID_LENGTH),
});

const placedPart = z.object({
  id: z.string().min(1).max(MAX_ID_LENGTH),
  type: z.enum(PART_TYPES),
  anchor: z.discriminatedUnion("kind", [gridAnchor, attachAnchor]),
  rotation: z.union([
    z.literal(0),
    z.literal(90),
    z.literal(180),
    z.literal(270),
  ]),
});

export const shipSchema = z.object({
  v: z.literal(CURRENT_VERSION),
  name: z.string().max(MAX_NAME_LENGTH),
  hull: z.object({
    lengthSegments: z.number().int().min(MIN_SEGMENTS).max(MAX_SEGMENTS),
  }),
  parts: z.array(placedPart).max(MAX_PARTS),
});

type RawShip = Record<string, unknown>;
export type Migration = (raw: RawShip) => RawShip;

/** MIGRATIONS[n] upgrades a version-n ship to version n + 1. */
const MIGRATIONS: Record<number, Migration> = {};

function isRecord(value: unknown): value is RawShip {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function migrate(
  raw: unknown,
  migrations: Record<number, Migration> = MIGRATIONS
): unknown {
  if (!isRecord(raw)) return raw;
  let current = raw;
  while (typeof current.v === "number" && current.v < CURRENT_VERSION) {
    const step = migrations[current.v];
    if (!step) break;
    let next: unknown;
    try {
      next = step(current);
    } catch {
      break;
    }
    // Each step must hand back a record with a strictly higher version;
    // otherwise keep the last good record and let the schema reject it.
    if (
      !isRecord(next) ||
      typeof next.v !== "number" ||
      !(next.v > current.v)
    ) {
      break;
    }
    current = next;
  }
  return current;
}

export type ParseResult =
  | { ok: true; ship: Ship }
  | { ok: false; error: string };

const INVALID: ParseResult = { ok: false, error: "Invalid ship data" };

/**
 * Cheap shape check before zod: zod visits every array element (and records
 * an issue for each) even past `.max()`, so an oversized parts array would
 * cost time and memory proportional to its length.
 */
function hasBoundedParts(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const { parts } = value;
  return Array.isArray(parts) && parts.length <= MAX_PARTS;
}

export function parseShip(raw: unknown): ParseResult {
  try {
    const migrated = migrate(raw);
    if (!hasBoundedParts(migrated)) return INVALID;
    const parsed = shipSchema.safeParse(migrated);
    if (!parsed.success) return INVALID;
    const ship: Ship = parsed.data;
    const valid = validateShip(ship);
    if (!valid.ok) return { ok: false, error: valid.reason };
    return { ok: true, ship };
  } catch {
    // Hostile input (getters, deep nesting) can throw, including RangeError.
    return INVALID;
  }
}
