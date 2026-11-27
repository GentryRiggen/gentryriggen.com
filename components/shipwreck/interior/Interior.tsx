"use client";
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in the frame loop by design */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
} from "three";
import { useStore } from "zustand";
import {
  easeLevel,
  interiorFor,
  roomWaterTargets,
  type InteriorMap,
  type Room,
} from "@/lib/shipwreck/interior";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { ShipId, ShipSpec } from "@/lib/shipwreck/ships/types";
import { walkMapFor, type WalkMap } from "@/lib/shipwreck/walk";
import type { InteriorLevels, SceneRuntime } from "../scene/runtime";
import { doorGlowGeometry } from "./doorGlow";
import { buildInterior } from "./kit";
import {
  DRY_LEVEL,
  interiorWater,
  waterMaterials,
  WATER_BODY_ORDER,
  WATER_SURFACE_ORDER,
} from "./water";

/**
 * Her rooms inside (see README.md), mounted beside XRay. Nothing at all
 * until the first time walk starts on a ship with rooms (the Titanic):
 * then the blockout and its water are built once (behind the walk start's
 * cut) and their shaders warmed with `gl.compile`. Each frame while
 * walking on her whole: the group rides her `whole` part, the walker's
 * room's zone and the zones it has doorways to are drawn with their
 * water, each drawn room's water level eased toward its target (into the
 * water's uniform and `runtime.interiorLevels`, which the walker's depth
 * reads), and on the open deck only the deck doors' glow. Nothing off the
 * walk camera or after the break. Disposed on unmount or a change of ship.
 *
 * Inside wins: while a room is drawn, the depth is cleared just before the
 * rooms (drawn last of the opaque things), so her exterior's decks, roofs
 * and walls that run through a room never show in it, and what the rooms
 * leave open (the doorways) still shows the outside drawn before. One
 * clear a frame, only inside, never in the sea's reflection. The water is
 * see-through, so it draws after every opaque thing (renderOrder 11, 12).
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
  // Built from the first walk on her on (kept while she is the ship; a
  // change of ship forgets it, even without a key).
  const [builtFor, setBuiltFor] = useState<ShipId | null>(null);
  if (builtFor !== null && builtFor !== spec.id) setBuiltFor(null);
  else if (walking && interior && builtFor !== spec.id) setBuiltFor(spec.id);
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

type Built = ReturnType<typeof build>;

/** The blockout, its water, the door glow and the depth clear. */
function build(
  interior: InteriorMap,
  map: WalkMap,
  spec: ShipSpec,
  runtime: SceneRuntime
) {
  const b = buildInterior(interior, spec);
  const water = interiorWater(interior, spec);
  const waterMats = waterMaterials(water.count);
  // Indoors: no sea fog (it greys a long hall to nothing).
  const shell = new MeshBasicMaterial({ vertexColors: true, fog: false });
  const glowMat = new MeshBasicMaterial({ vertexColors: true });
  const group = new Group();
  group.name = "interior";
  group.matrixAutoUpdate = false;
  group.visible = false;
  const zones: { zone: string; meshes: Mesh[]; slots: number[] }[] = [];
  for (const [zone, geom] of b.zones) {
    const mesh = new Mesh(geom, shell);
    mesh.name = `interior-${zone}`;
    mesh.renderOrder = ROOMS_ORDER;
    group.add(mesh);
    const meshes: Mesh[] = [mesh];
    const w = water.zones.get(zone);
    if (w) {
      const body = new Mesh(w.body, waterMats.body);
      body.name = `interior-water-body-${zone}`;
      body.renderOrder = WATER_BODY_ORDER;
      // The surface climbs in the shader: its plan box is not its place.
      body.frustumCulled = false;
      const surface = new Mesh(w.surface, waterMats.surface);
      surface.name = `interior-water-${zone}`;
      surface.renderOrder = WATER_SURFACE_ORDER;
      surface.frustumCulled = false;
      group.add(body, surface);
      meshes.push(body, surface);
    }
    zones.push({ zone, meshes, slots: water.zoneSlots.get(zone) ?? [] });
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
  const rooms: Room[] = [];
  for (const r of interior.rooms) rooms[water.slot.get(r.id)!] = r;
  const levels: InteriorLevels = {
    slot: water.slot,
    shown: new Float64Array(water.count).fill(-Infinity),
    drawn: new Uint8Array(water.count),
  };
  return {
    ...b,
    shell,
    glowMat,
    group,
    zones,
    glow,
    clear,
    clearMat,
    water,
    waterMats,
    rooms,
    levels,
    /** Rooms eased this frame (scratch, reused). */
    now: new Uint8Array(water.count),
    target: roomWaterTargets(spec),
    compiled: false,
  };
}

function dispose(b: Built): void {
  for (const { meshes } of b.zones)
    for (const m of meshes) m.geometry.dispose();
  b.glow.geometry.dispose();
  b.shell.dispose();
  b.glowMat.dispose();
  b.clear.geometry.dispose();
  b.clearMat.dispose();
  b.waterMats.surface.dispose();
  b.waterMats.body.dispose();
}

function InteriorScene({ store, runtime, spec, interior, map }: SceneProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  // Built and disposed in one effect, so a double mount (strict mode)
  // disposes the first build instead of leaking it.
  const built = useRef<Built | null>(null);
  useEffect(() => {
    const b = build(interior, map, spec, runtime);
    built.current = b;
    scene.add(b.group);
    runtime.interiorLevels = b.levels;
    return () => {
      scene.remove(b.group);
      if (runtime.interiorLevels === b.levels) runtime.interiorLevels = null;
      if (built.current === b) built.current = null;
      dispose(b);
    };
  }, [interior, map, spec, runtime, scene]);

  useFrame((state, dt) => {
    const b = built.current;
    if (!b) return;
    const p = store.getState();
    const part = runtime.part("whole");
    const frame = runtime.frame;
    const on =
      p.camera === "walk" && !runtime.broken && part !== null && !!frame;
    b.group.visible = on;
    const lv = b.levels;
    if (!on || !part || !frame) {
      lv.drawn.fill(0);
      return;
    }
    part.updateMatrixWorld();
    b.group.matrix.copy(part.matrixWorld);
    b.group.matrixWorldNeedsUpdate = true;
    if (!b.compiled) {
      // Warm the shell's and the water's shaders once with all drawn.
      b.compiled = true;
      for (const z of b.zones) for (const m of z.meshes) m.visible = true;
      b.group.updateMatrixWorld(true);
      gl.compile(scene, camera);
    }
    // The walker's room's zone and the zones it opens onto; none on deck.
    const room = runtime.walkRoom;
    const zone = room !== null ? b.roomZone.get(room) : undefined;
    const seen = zone !== undefined ? b.seen.get(zone) : undefined;
    // Each drawn room's water: its target, eased (a room just come into
    // view starts at its target: it was not seen climbing).
    const now = b.now;
    now.fill(0);
    const pose = frame.bodies[0];
    const levels = b.waterMats.levels;
    for (const z of b.zones) {
      const show = seen?.has(z.zone) ?? false;
      for (const m of z.meshes) m.visible = show;
      if (!show) continue;
      for (const k of z.slots) {
        const target = b.target(b.rooms[k], pose, frame.water);
        const s = lv.drawn[k] ? easeLevel(lv.shown[k], target, dt) : target;
        lv.shown[k] = s;
        now[k] = 1;
        levels[k] = Number.isFinite(s)
          ? Math.max(DRY_LEVEL, Math.min(-DRY_LEVEL, s))
          : DRY_LEVEL;
      }
    }
    lv.drawn.set(now);
    b.waterMats.surface.uniforms.uTime.value = state.clock.elapsedTime;
    b.clear.visible = seen !== undefined;
    // On deck only: inside, the glow would be drawn over by the rooms.
    b.glow.visible = seen === undefined;
  }, -1.4);

  return null;
}
