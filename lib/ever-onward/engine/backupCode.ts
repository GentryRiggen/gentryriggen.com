import { parseSaveReport } from "./save";
import type { SaveData } from "./types";

const PREFIX = "EO1-";
const CHECKSUM_LENGTH = 8;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const HEX = /^[0-9a-f]+$/;

/** FNV-1a: a tiny hash that catches typos (not meant to stop tampering). */
function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(CHECKSUM_LENGTH, "0");
}

/** JSON with non-ASCII escaped (valid inside strings), so btoa can take it. */
const toAscii = (json: string): string =>
  json.replace(
    /[\u0080-\uffff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`
  );

function toBase64Url(text: string): string {
  return btoa(toAscii(text))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(payload: string): string {
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

/** A save as one line of text: `EO1-<payload>-<checksum>`. */
export function encodeBackup(save: SaveData): string {
  const payload = toBase64Url(JSON.stringify(save));
  return `${PREFIX}${payload}-${checksum(payload)}`;
}

/**
 * The save inside a backup code, or null for anything that isn't a whole,
 * readable code. Spaces and line breaks (from pasting) are ignored.
 */
export function decodeBackup(code: string): SaveData | null {
  const clean = code.replace(/\s+/g, "");
  if (!clean.startsWith(PREFIX)) return null;
  const body = clean.slice(PREFIX.length);
  const split = body.length - CHECKSUM_LENGTH - 1;
  if (split < 1 || body[split] !== "-") return null;
  const payload = body.slice(0, split);
  const sum = body.slice(split + 1);
  if (!BASE64URL.test(payload) || !HEX.test(sum)) return null;
  if (checksum(payload) !== sum) return null;
  try {
    const parsed = parseSaveReport(JSON.parse(fromBase64Url(payload)));
    // A code with a damaged universe is refused rather than half-loaded.
    return parsed && parsed.dropped.length === 0 ? parsed.save : null;
  } catch {
    return null;
  }
}
