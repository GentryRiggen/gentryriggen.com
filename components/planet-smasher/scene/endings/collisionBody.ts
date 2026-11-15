import { useEffect } from "react";
import {
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";
import type { PlanetId } from "@/lib/planet-smasher/planets";
import { loadPlanetTextures } from "../planetTextures";
import { buildChunkSet, fibonacciSeeds, type ChunkSet } from "./chunks";
import type { Vec3 } from "@/lib/planet-smasher/sphere";

/** The planet that smashes into `current`: Mars for Earth, else Earth. */
export function collisionBody(current: PlanetId): PlanetId {
  return current === "earth" ? "mars" : "earth";
}

/** The incoming body's size, in planet radii. */
export const BODY_RADIUS = 0.6;
export const BODY_CHUNKS = 12;

/** Stand-in colours until the real maps arrive. */
const PLAIN: Record<PlanetId, string> = {
  earth: "#3a78c8",
  mars: "#c45a32",
  ice: "#bfe3f2",
};

/**
 * Where the incoming body met the planet: the effect writes it just before
 * the hit and the Collided ending reads it. `id` is null when no effect ran
 * (the ending was forced), and the ending picks its own.
 */
export const collisionState: { id: PlanetId | null; dir: Vector3 } = {
  id: null,
  dir: new Vector3(-0.55, 0.3, 0.75).normalize(),
};

/** The body's 12 pre-cut chunks, built once on demand. */
let bodyChunks: { seeds: Vec3[]; set: ChunkSet } | null = null;
export function getBodyChunks(): { seeds: Vec3[]; set: ChunkSet } {
  if (!bodyChunks) {
    const seeds = fibonacciSeeds(BODY_CHUNKS, 0.2, 7);
    bodyChunks = { seeds, set: buildChunkSet(BODY_RADIUS, seeds) };
  }
  return bodyChunks;
}

interface BodyEntry {
  material: MeshStandardMaterial;
  map: Texture | null;
  users: number;
  disposeTimer: ReturnType<typeof setTimeout> | null;
  disposed: boolean;
}

const bodyEntries = new Map<PlanetId, BodyEntry>();

/** How long an unused body material lingers, so a hand-over does not reload. */
const DISPOSE_DELAY_MS = 1500;

function bodyEntry(id: PlanetId): BodyEntry {
  const found = bodyEntries.get(id);
  if (found) return found;
  const entry: BodyEntry = {
    material: new MeshStandardMaterial({
      color: PLAIN[id],
      roughness: 0.9,
      emissive: PLAIN[id],
      emissiveIntensity: 0.08,
    }),
    map: null,
    users: 0,
    disposeTimer: null,
    disposed: false,
  };
  bodyEntries.set(id, entry);
  loadPlanetTextures(id)
    .then((t) => {
      if (entry.disposed) return;
      const map = new Texture(t.day);
      map.colorSpace = SRGBColorSpace;
      map.wrapS = RepeatWrapping;
      map.needsUpdate = true;
      entry.map = map;
      const m = entry.material;
      m.map = map;
      m.color.set("#ffffff");
      // Earth's day map has near-black oceans (the globe lifts them in its
      // shader), so the body gets a flat blue glow instead.
      m.emissive.set(id === "earth" ? "#0c2a58" : "#000000");
      m.emissiveIntensity = 1;
      m.needsUpdate = true;
    })
    // Intended: the plain coloured ball is the fallback if the maps fail.
    .catch(() => {});
  return entry;
}

function releaseBody(id: PlanetId, entry: BodyEntry) {
  entry.users -= 1;
  if (entry.users > 0) return;
  entry.disposeTimer = setTimeout(() => {
    entry.disposed = true;
    entry.map?.dispose();
    entry.material.dispose();
    if (bodyEntries.get(id) === entry) bodyEntries.delete(id);
  }, DISPOSE_DELAY_MS);
}

/**
 * The body's material, shared by the incoming-body effect and the Collided
 * ending (one material and one map upload per id). It is a plain coloured ball
 * until the planet's real maps (cached, so usually instant) arrive, and the
 * last user to unmount disposes it.
 */
export function useBodyMaterial(id: PlanetId): MeshStandardMaterial {
  const entry = bodyEntry(id);
  useEffect(() => {
    const e = bodyEntry(id);
    if (e.disposeTimer) {
      clearTimeout(e.disposeTimer);
      e.disposeTimer = null;
    }
    e.users += 1;
    return () => releaseBody(id, e);
  }, [id]);
  return entry.material;
}
