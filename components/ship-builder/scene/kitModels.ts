"use client";

import { useContext, useEffect, useSyncExternalStore } from "react";
import { Matrix4, type BufferGeometry, type Mesh, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GlbSourceContext } from "./GlbRegistryPart";
import { trackGlbPart } from "./glbLoadStatus";
import { KIT_MODEL_URLS, kitModelUrl, type KitName } from "./kitFiles";

export { KIT_NAMES } from "./kitFiles";

type KitState = BufferGeometry | "pending" | "failed";

const states = new Map<string, KitState>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The single mesh's geometry in a kit glb; throws when there is not one. */
function geometryOf(scene: Object3D): BufferGeometry {
  const found: Mesh[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    if ((node as Mesh).isMesh) found.push(node as Mesh);
  });
  if (found.length !== 1) {
    throw new Error(`a kit piece holds one mesh, found ${found.length}`);
  }
  const [mesh] = found;
  // Bake any node transform in, so a placement matrix is the only transform.
  return mesh.matrixWorld.equals(new Matrix4())
    ? mesh.geometry
    : mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
}

/** Starts loading `url` once; the state map answers every later call. */
function ensureLoaded(url: string): void {
  if (states.has(url)) return;
  states.set(url, "pending");
  new GLTFLoader()
    .loadAsync(url)
    .then((gltf) => {
      states.set(url, geometryOf(gltf.scene));
    })
    .catch((error: unknown) => {
      states.set(url, "failed");
      if (process.env.NODE_ENV === "development") {
        console.warn("kit piece fell back:", url, error);
      }
    })
    .finally(notify);
}

/** Starts loading every kit piece, so blocks rarely draw their stand-ins. */
export function preloadKitModels(): void {
  for (const url of KIT_MODEL_URLS) ensureLoaded(url);
}

/**
 * The loaded geometry of a kit piece, or null while it loads, if it failed,
 * or when the asset studio forces the procedural look. The geometry is
 * shared by every user: never dispose it.
 */
export function useKitGeometry(name: KitName): BufferGeometry | null {
  const source = useContext(GlbSourceContext);
  const url = source.procedural
    ? null
    : (source.kitUrl?.(name) ?? kitModelUrl(name));
  const state = useSyncExternalStore(
    subscribe,
    () => {
      const found = url ? states.get(url) : undefined;
      return found === undefined || found === "pending" ? null : found;
    },
    () => null
  );
  useEffect(() => {
    if (url) ensureLoaded(url);
  }, [url]);
  const tracked =
    url === null
      ? null
      : state === null
        ? "pending"
        : state === "failed"
          ? "failed"
          : "loaded";
  useEffect(() => (tracked ? trackGlbPart(tracked) : undefined), [tracked]);
  return state === null || state === "failed" ? null : state;
}
