import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import type { Ship } from "../model/types";
import { parseShip } from "./schema";

export const MAX_SHARE_LENGTH = 20000;
export const SHARE_PATH = "/ship-builder";

export type HashResult =
  | { kind: "none" }
  | { kind: "ok"; ship: Ship }
  | { kind: "invalid" };

const INVALID: HashResult = { kind: "invalid" };

export function encodeShip(ship: Ship): string {
  return compressToEncodedURIComponent(JSON.stringify(ship));
}

export function buildShareUrl(ship: Ship, origin: string): string {
  return `${origin}${SHARE_PATH}#ship=${encodeShip(ship)}`;
}

/**
 * Parsed by hand: lz-string's URI-safe alphabet includes "+", which
 * URLSearchParams would turn into a space.
 */
export function decodeShareHash(hash: string): HashResult {
  const match = /(?:^#?|&)ship=([^&]*)/.exec(hash);
  if (!match) return { kind: "none" };
  const encoded = match[1];
  if (!encoded || encoded.length > MAX_SHARE_LENGTH) return INVALID;

  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(encoded);
  } catch {
    return INVALID;
  }
  if (!json) return INVALID;

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return INVALID;
  }

  const result = parseShip(raw);
  return result.ok ? { kind: "ok", ship: result.ship } : INVALID;
}
