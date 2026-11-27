"use client";
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in the frame loop by design */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
} from "three";
import { useStore } from "zustand";
import { interiorFor, type InteriorMap } from "@/lib/shipwreck/interior";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { ShipId, ShipSpec } from "@/lib/shipwreck/ships/types";
import { walkMapFor, type WalkMap } from "@/lib/shipwreck/walk";
import type { SceneRuntime } from "../scene/runtime";
import { doorGlowGeometry } from "./doorGlow";
import { buildInterior } from "./kit";

/**
 * Her rooms inside (see README.md), mounted beside XRay. Nothing at all
 * until the first time walk starts on a ship with rooms (the Titanic):
 * then the blockout is built once (behind the walk start's cut) and its
 * shader warmed with `gl.compile`. Each frame while walking on her whole:
 * the group rides her `whole` part, the walker's room's zone and the zones
 * it has doorways to are drawn, and on the open deck only the deck doors'
 * glow. Nothing off the walk camera or after the break. Disposed on
 * unmount or a change of ship.
 *
 * Inside wins: while a room is drawn, the depth is cleared just before the
 * rooms (drawn last of the opaque things), so her exterior's decks, roofs
 * and walls that run through a room never show in it, and what the rooms
 * leave open (the doorways) still shows the outside drawn before. One
 * clear a frame, only inside, never in the sea's reflection.
 */

/** The rooms draw after everything else opaque; the clear just before. */
const ROOMS_ORDER = 10;
const CLEAR_ORDER = ROOMS_ORDER - 1;

interface InteriorProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
  spec: ShipSpec;
}

export default function Interior({ store, runtime, spec }: InteriorProps) {
  const walking = useStore(store, (s) => s.camera === "walk");
  const interior = interiorFor(spec.id);
  // Built from the first walk on her on (kept while she is the ship).
  const [builtFor, setBuiltFor] = useState<ShipId | null>(null);
  if (walking && interior && builtFor !== spec.id) setBuiltFor(spec.id);
  if (!interior || builtFor !== spec.id) return null;
  const map = walkMapFor(spec.id);
  if (!map) return null;
  return (
    <InteriorScene
      key={spec.id}
      store={store}
      runtime={runtime}
      spec={spec}
      interior={interior}
      map={map}
    />
  );
}

interface SceneProps extends InteriorProps {
  interior: InteriorMap;
  map: WalkMap;
}

function InteriorScene({ store, runtime, spec, interior, map }: SceneProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const built = useMemo(() => {
    const b = buildInterior(interior, spec);
    // Indoors: no sea fog (it greys a long hall to nothing).
    const shell = new MeshBasicMaterial({ vertexColors: true, fog: false });
    const glowMat = new MeshBasicMaterial({ vertexColors: true });
    const group = new Group();
    group.name = "interior";
    group.matrixAutoUpdate = false;
    group.visible = false;
    const zones: { zone: string; mesh: Mesh }[] = [];
    for (const [zone, geom] of b.zones) {
      const mesh = new Mesh(geom, shell);
      mesh.name = `interior-${zone}`;
      mesh.renderOrder = ROOMS_ORDER;
      group.add(mesh);
      zones.push({ zone, mesh });
    }
    const glow = new Mesh(doorGlowGeometry(interior, map, spec), glowMat);
    glow.name = "interior-door-glow";
    group.add(glow);
    // Draws nothing; clears the depth before the rooms (see above).
    const clearGeom = new BufferGeometry();
    clearGeom.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)
    );
    const clearMat = new MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      depthTest: false,
    });
    const clear = new Mesh(clearGeom, clearMat);
    clear.name = "interior-depth-clear";
    clear.renderOrder = CLEAR_ORDER;
    clear.frustumCulled = false;
    clear.visible = false;
    clear.onBeforeRender = (renderer) => {
      if (!runtime.reflecting) renderer.clearDepth();
    };
    group.add(clear);
    return { ...b, shell, glowMat, group, zones, glow, clear, clearMat };
  }, [interior, map, spec, runtime]);

  useEffect(() => {
    const b = built;
    return () => {
      for (const { mesh } of b.zones) mesh.geometry.dispose();
      b.glow.geometry.dispose();
      b.shell.dispose();
      b.glowMat.dispose();
      b.clear.geometry.dispose();
      b.clearMat.dispose();
    };
  }, [built]);

  const compiled = useRef(false);

  useFrame(() => {
    const p = store.getState();
    const b = built;
    const part = runtime.part("whole");
    const on = p.camera === "walk" && !runtime.broken && part !== null;
    b.group.visible = on;
    if (!on || !part) return;
    part.updateMatrixWorld();
    b.group.matrix.copy(part.matrixWorld);
    b.group.matrixWorldNeedsUpdate = true;
    if (!compiled.current) {
      // Warm the shell's shader once with everything drawn.
      compiled.current = true;
      for (const z of b.zones) z.mesh.visible = true;
      b.group.updateMatrixWorld(true);
      gl.compile(scene, camera);
    }
    // The walker's room's zone and the zones it opens onto; none on deck.
    const room = runtime.walkRoom;
    const zone = room !== null ? b.roomZone.get(room) : undefined;
    const seen = zone !== undefined ? b.seen.get(zone) : undefined;
    for (const z of b.zones) z.mesh.visible = seen?.has(z.zone) ?? false;
    b.clear.visible = seen !== undefined;
    b.glow.visible = true;
  }, -1.4);

  return <primitive object={built.group} />;
}
