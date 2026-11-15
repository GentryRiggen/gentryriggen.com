import { useEffect, useMemo } from "react";
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

/**
 * The body's material: a plain coloured ball until the planet's real maps
 * (cached, so usually instant) arrive.
 */
export function useBodyMaterial(id: PlanetId): MeshStandardMaterial {
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: PLAIN[id],
        roughness: 0.9,
        emissive: PLAIN[id],
        emissiveIntensity: 0.08,
      }),
    [id]
  );
  useEffect(() => {
    let cancelled = false;
    let map: Texture | null = null;
    loadPlanetTextures(id)
      .then((t) => {
        if (cancelled) return;
        map = new Texture(t.day);
        map.colorSpace = SRGBColorSpace;
        map.wrapS = RepeatWrapping;
        map.needsUpdate = true;
        material.map = map;
        material.color.set("#ffffff");
        // Earth's day map has near-black oceans (the globe lifts them in its
        // shader), so the body gets a flat blue glow instead.
        material.emissive.set(id === "earth" ? "#0c2a58" : "#000000");
        material.emissiveIntensity = 1;
        material.needsUpdate = true;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      map?.dispose();
      material.dispose();
    };
  }, [id, material]);
  return material;
}
