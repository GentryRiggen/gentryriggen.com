import raw from "./manifest.json";

export interface ShipClipEntry {
  /** Path under public/, served from the site root. */
  file: string;
  hash: string;
  /** Rough length in seconds, for UI only. */
  durationGuess: number;
}

const manifest: Record<string, ShipClipEntry> = raw;

/** The recorded clip for a voice line id, if it has one. */
export function getShipClip(id: string): ShipClipEntry | undefined {
  return Object.hasOwn(manifest, id) ? manifest[id] : undefined;
}
