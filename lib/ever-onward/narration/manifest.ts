import raw from "./manifest.json";

export interface ClipEntry {
  /** Path under public/, served from the site root. */
  file: string;
  hash: string;
  /** Rough length in seconds, for UI only. */
  durationGuess: number;
}

const manifest: Record<string, ClipEntry> = raw;

/** The recorded clip for a line id, if it has one. */
export function getClip(id: string): ClipEntry | undefined {
  return manifest[id];
}

export function allClips(): Readonly<Record<string, ClipEntry>> {
  return manifest;
}
