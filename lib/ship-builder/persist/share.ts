import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import type { Ship } from "../model/types";
import { parseShip } from "./schema";

/**
 * The most encoded characters a link may carry. A ship of MAX_PARTS blocks
 * on the longest, widest hull with store-style ids compresses to about 25,000,
 * so this leaves headroom for longer ids and attach parts.
 */
export const MAX_SHARE_LENGTH = 32000;
/**
 * A ship of MAX_PARTS blocks with store-style ids serialises to about 103 KB
 * of JSON; the cap is about 2.4 times that.
 */
export const MAX_JSON_LENGTH = 250_000;
export const SHARE_PATH = "/ship-builder";

export type HashResult =
  { kind: "none" } | { kind: "ok"; ship: Ship } | { kind: "invalid" };

const INVALID: HashResult = { kind: "invalid" };

export function encodeShip(ship: Ship): string {
  return compressToEncodedURIComponent(JSON.stringify(ship));
}

/**
 * The link for a ship, or null when the encoded ship is too long for
 * decodeShareHash to accept, since such a link would never open.
 */
export function buildShareUrl(ship: Ship, origin: string): string | null {
  const encoded = encodeShip(ship);
  if (encoded.length > MAX_SHARE_LENGTH) return null;
  return `${origin}${SHARE_PATH}#ship=${encoded}`;
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
  // lz-string inflates quadratically, so a short hash can expand to tens of
  // megabytes. Reject anything larger than a maximal valid ship before
  // parsing it.
  if (!json || json.length > MAX_JSON_LENGTH) return INVALID;

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return INVALID;
  }

  const result = parseShip(raw);
  return result.ok ? { kind: "ok", ship: result.ship } : INVALID;
}
