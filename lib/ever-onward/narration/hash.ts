import { createHash } from "node:crypto";

/** Short fingerprint of a line's spoken text (script and tests only). */
export function narrationHash(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 12);
}
