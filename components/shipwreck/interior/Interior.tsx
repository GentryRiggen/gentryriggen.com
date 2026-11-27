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
  type Texture,
} from "three";
import { useStore } from "zustand";
import {
  easeLevel,
  interiorFor,
  roomPower,
  roomWaterTargets,
  segmentAt,
  torchOn,
  type InteriorMap,
  type Room,
} from "@/lib/shipwreck/interior";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { ShipId, ShipSpec } from "@/lib/shipwreck/ships/types";
import { TEST_HOOKS_ENABLED } from "@/lib/shipwreck/testHooks";
import { walkMapFor, type WalkMap } from "@/lib/shipwreck/walk";
import type { InteriorLevels, SceneRuntime } from "../scene/runtime";
import { doorGlowGeometry } from "./doorGlow";
import { buildInterior } from "./kit";
import { roomMaterials, type SharedUniforms } from "./materials";
import { LAYERS } from "./pieces";
import { detailTexture } from "./textures";
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
 * then the rooms and their water are built once (behind the walk start's
 * cut) and their shaders warmed with `gl.compile`. Each frame while
 * walking on her whole: the group rides her `whole` part, the walker's
 * room's zone and the zones it has doorways to are drawn with their
 * water, each drawn room's water level eased toward its target (into the
 * shaders' uniform and `runtime.interiorLevels`, which the walker's depth
 * reads), each drawn room's lamps set from the ship's power and its water
 * (`roomPower`), the torch eased on in a dim room (`torchOn`) and aimed
 * from the eyes, and on the open deck only the deck doors' glow. Nothing
 * off the walk camera or after the break. Disposed on unmount or a change
 * of ship.
 *
 * Inside wins: while a room is drawn, the depth is cleared just before the
 * rooms, so her exterior's decks, roofs and walls that run through a room
 * never show in it, and what the rooms leave open (the doorways) still
 * shows the outside drawn before. The clear and the rooms are in the
 * transparent pass (the rooms with blending off: still opaque), after
 * every exterior piece in either pass, so nothing outside draws over a
 * room. One clear a frame, only inside, never in the sea's reflection.
 * The water is see-through and draws after the rooms (renderOrder 11, 12).
 */

/** The rooms draw after everything else; the clear just before. */
const ROOMS_ORDER = 10;
const CLEAR_ORDER = ROOMS_ORDER - 1;

interface InteriorProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
  spec: ShipSpec;
  /** The sky the portholes and the dome show (sRGB hex: the scene's haze). */
  sky?: string;
}

/** The share of a lit neighbour's light a dark room still gets. */
const SPILL = 0.22;
/** How fast the torch comes on and goes off (per second, 0..1). */
const TORCH_EASE_PER_S = 4;
/** The room must stay dim (or lit) this long to switch the torch (s). */
const TORCH_HOLD_S = 0.5;
/** The torch is held a little under the eyes (m). */
const TORCH_DROP_M = 0.25;

/**
 * The lamps' shimmer while the ship's power dips (`frame.power` under 1):
 * a fast hash of real time, mostly near full, now and then a deep dip, so
 * the flicker shows even with the clock paused.
 */
export function lampFlicker(power: number, seconds: number): number {
  if (!(power > 0 && power < 1)) return 1;
  const k = Math.floor(seconds * 14);
  const h = (((k * 2654435761) >>> 0) % 1000) / 1000;
  return h < 0.12 ? 0.3 + h : 0.82 + 0.18 * h;
}

export default function Interior({ store, runtime, spec, sky }: InteriorProps) {
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
      sky={sky}
    />
  );
}

interface SceneProps extends InteriorProps {
  interior: InteriorMap;
  map: WalkMap;
}

type Built = ReturnType<typeof build>;

/** The rooms, their water, the door glow and the depth clear. */
function build(
  interior: InteriorMap,
  map: WalkMap,
  spec: ShipSpec,
  runtime: SceneRuntime
) {
  const b = buildInterior(interior, spec);
  if (TEST_HOOKS_ENABLED && process.env.NODE_ENV !== "test")
    console.info(`interior built in ${b.ms.toFixed(1)} ms`);
  const water = interiorWater(interior, spec);
  // Slots: the rooms', then a long hall's lamp parts (kit `segments`).
  const waterMats = waterMaterials(b.slots);
  // The rooms share the water's room power, levels, torch and time.
  const u = waterMats.surface.uniforms;
  const shared: SharedUniforms = {
    uRoomPower: u.uRoomPower,
    uLevel: u.uLevel,
    uTorchOn: u.uTorchOn,
    uTorchPos: u.uTorchPos,
    uTorchDir: u.uTorchDir,
    uTime: u.uTime,
  };
  const detail: Texture = detailTexture();
  const mats = roomMaterials(b.slots, shared, detail);
  const glowMat = new MeshBasicMaterial({ vertexColors: true });
  const group = new Group();
  group.name = "interior";
  group.matrixAutoUpdate = false;
  group.visible = false;
  const zones: { zone: string; meshes: Mesh[]; slots: number[] }[] = [];
  for (const [zone, layers] of b.zones) {
    const meshes: Mesh[] = [];
    for (const layer of LAYERS) {
      const geom = layers[layer];
      if (!geom) continue;
      const mesh = new Mesh(geom, mats[layer]);
      mesh.name = `interior-${zone}-${layer}`;
      mesh.renderOrder = ROOMS_ORDER;
      group.add(mesh);
      meshes.push(mesh);
    }
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
  // In the transparent pass, as the rooms (see above).
  const clearMat = new MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    depthTest: false,
    transparent: true,
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
  // A long hall's first part's slot (or -1): its lamps go by parts.
  const firstPart = new Int32Array(water.count).fill(-1);
  for (const seg of b.segments)
    if (firstPart[seg.room] < 0) firstPart[seg.room] = seg.slot;
  const levels: InteriorLevels = {
    slot: water.slot,
    shown: new Float64Array(water.count).fill(-Infinity),
    drawn: new Uint8Array(water.count),
  };
  return {
    ...b,
    mats,
    detail,
    glowMat,
    group,
    zones,
    glow,
    clear,
    clearMat,
    water,
    waterMats,
    rooms,
    firstPart,
    levels,
    /** Rooms eased this frame (scratch, reused). */
    now: new Uint8Array(water.count),
    target: roomWaterTargets(spec),
    compiled: false,
    /** Each slot's own lamps this frame (scratch). */
    own: new Float32Array(b.slots),
    /** Each room's best lit neighbour this frame (scratch). */
    spill: new Float32Array(water.count),
    /** How long the walker's room has been dim, or lit (s). */
    dimFor: 0,
    litFor: 0,
    torchWanted: false,
    /** The torch, eased (0..1). */
    torch: 0,
  };
}

function dispose(b: Built): void {
  for (const { meshes } of b.zones)
    for (const m of meshes) m.geometry.dispose();
  b.glow.geometry.dispose();
  b.mats.dispose();
  b.detail.dispose();
  b.glowMat.dispose();
  b.clear.geometry.dispose();
  b.clearMat.dispose();
  b.waterMats.surface.dispose();
  b.waterMats.body.dispose();
}

function InteriorScene({
  store,
  runtime,
  spec,
  interior,
  map,
  sky,
}: SceneProps) {
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
  useEffect(() => {
    const b = built.current;
    if (b && sky) b.mats.sky.value.set(sky);
  });

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
    // A long hall's parts share its level.
    for (let i = 0; i < b.segments.length; i += 1) {
      const seg = b.segments[i];
      if (now[seg.room]) levels[seg.slot] = levels[seg.room];
    }
    b.waterMats.surface.uniforms.uTime.value = state.clock.elapsedTime;

    // The lights: each drawn room's from the ship's power and the water
    // over its floor (its lowest point, in her frame); the lamps shimmer
    // while the power dips.
    const shipPower = Number.isFinite(frame.power) ? frame.power : 1;
    b.mats.flicker.value = lampFlicker(shipPower, state.clock.elapsedTime);
    const m = b.group.matrix.elements;
    const power = b.waterMats.power;
    const f = b.floors;
    const own = b.own;
    for (let k = 0; k < now.length; k += 1) {
      if (!now[k]) continue;
      const floorY =
        m[1] * f[k * 3] + m[5] * f[k * 3 + 1] + m[9] * f[k * 3 + 2] + m[13];
      own[k] = roomPower(shipPower, lv.shown[k] - floorY, p.t);
    }
    // A long hall's parts: each by the water over its own middle.
    for (let i = 0; i < b.segments.length; i += 1) {
      const { room: r, slot: k } = b.segments[i];
      if (!now[r]) continue;
      const floorY =
        m[1] * f[k * 3] + m[5] * f[k * 3 + 1] + m[9] * f[k * 3 + 2] + m[13];
      own[k] = roomPower(shipPower, lv.shown[r] - floorY, p.t);
    }
    // A dark room still catches a little of a lit room open to it (down
    // a stair, through a doorway): never pitch black beside the light.
    for (let k = 0; k < now.length; k += 1) {
      if (!now[k]) continue;
      let spill = 0;
      const nb = b.neighbours[k];
      for (let i = 0; i < nb.length; i += 1)
        if (now[nb[i]]) spill = Math.max(spill, own[nb[i]]);
      b.spill[k] = spill;
      power[k] = Math.max(own[k], SPILL * spill);
    }
    for (let i = 0; i < b.segments.length; i += 1) {
      const { room: r, slot: k } = b.segments[i];
      if (now[r]) power[k] = Math.max(own[k], SPILL * b.spill[r]);
    }
    // The torch: on by itself in a dim room, held under the eyes, aimed
    // where they look.
    // Held a moment either way, so a flicker's dip does not blink it.
    // In a long hall, the part the walker stands in.
    const rk = room !== null ? b.slot.get(room) : undefined;
    const info = runtime.walkInfo;
    const k =
      rk !== undefined && b.firstPart[rk] >= 0 && info
        ? b.firstPart[rk] + segmentAt(b.rooms[rk], info.x, info.y)
        : rk;
    const dim = k !== undefined && torchOn(power[k] * b.mats.flicker.value);
    const d = Math.min(dt, 0.1);
    b.dimFor = dim ? b.dimFor + d : 0;
    b.litFor = dim ? 0 : b.litFor + d;
    if (b.dimFor >= TORCH_HOLD_S) b.torchWanted = true;
    else if (b.litFor >= TORCH_HOLD_S || k === undefined) b.torchWanted = false;
    const want = b.torchWanted ? 1 : 0;
    const step = TORCH_EASE_PER_S * d;
    b.torch =
      want > b.torch
        ? Math.min(want, b.torch + step)
        : Math.max(want, b.torch - step);
    const u = b.waterMats.surface.uniforms;
    u.uTorchOn.value = b.torch;
    camera.getWorldPosition(u.uTorchPos.value);
    u.uTorchPos.value.y -= TORCH_DROP_M;
    camera.getWorldDirection(u.uTorchDir.value);
    b.clear.visible = seen !== undefined;
    // On deck only: inside, the glow would be drawn over by the rooms.
    b.glow.visible = seen === undefined;
  }, -1.4);

  return null;
}
