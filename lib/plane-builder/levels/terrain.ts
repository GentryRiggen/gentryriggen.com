// lib/plane-builder/levels/terrain.ts
import type { TerrainDef } from "./types";

/** Rises from flat over this many metres after flatUntil. */
const RAMP = 120;

/** Ground height at (x, z), m. Smooth, seeded and never negative. */
export function terrainHeight(t: TerrainDef, x: number, z: number): number {
  if (t.amplitude === 0 || x <= t.flatUntil) return 0;
  const ramp = Math.min(1, (x - t.flatUntil) / RAMP);
  const p1 = (t.seed * 0.618) % (Math.PI * 2);
  const p2 = (t.seed * 1.303) % (Math.PI * 2);
  const wave =
    Math.sin(x / t.wavelength + p1) * 0.6 +
    Math.sin(x / (t.wavelength * 0.37) + z / (t.wavelength * 0.5) + p2) * 0.4;
  return t.amplitude * (wave * 0.5 + 0.5) * ramp;
}
