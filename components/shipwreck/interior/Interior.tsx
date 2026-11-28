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
  type Object3D,
  type Texture,
} from "three";
import { useStore } from "zustand";
import {
  easeLevel,
  emergencyFlicker,
  interiorFor,
  roomPower,
  roomsOpen,
  roomWaterTargets,
  seepTarget,
  segmentAt,
  torchOn,
  type InteriorMap,
  type Room,
} from "@/lib/shipwreck/interior";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { SimFrame } from "@/lib/shipwreck/sim/track";
import type { ShipId, ShipSpec } from "@/lib/shipwreck/ships/types";
import usePrefersReducedMotion from "@/components/game-kit/usePrefersReducedMotion";
import { TEST_HOOKS_ENABLED } from "@/lib/shipwreck/testHooks";
import { walkMapFor, type WalkMap } from "@/lib/shipwreck/walk";
import type { InteriorLevels, SceneRuntime } from "../scene/runtime";
import { doorGlowGeometry } from "./doorGlow";
import { buildInterior, ZONE_LAYERS } from "./kit";
import { glassMaterial, roomMaterials, type SharedUniforms } from "./materials";
import { applyModern, modernTextures } from "./modernTextures";
import { detailTexture } from "./textures";
import {
  basinWater,
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
 *
 * A deck room (her pool hall, 1.17) is drawn whenever walking on her: from
 * outside it is part of her exterior, drawn before the clear and depth
 * tested against it (`DECK_ORDER`); with the walker in it, inside wins as
 * in any room (after the clear). Its pool's water stands at the basin's
 * low rim's height (spilling as she leans), its glass (`pane`) is blended
 * over everything behind it, and by day (`daylight`) her shader lights it
 * as under the sky whatever her power. Her model's own block there (the
 * paint mesh's tail, `Block.walkHidden`) is hidden meanwhile, so her
 * deck sees in.
 *
 * Her rooms (the Concordia's, Task 7): `roomsOpen` instead of the break
 * alone, so from her 30° heel only the deck rooms are drawn and the
 * walker is walked out; her low rooms' water is the seep table's (slow,
 * `seepTarget`), their lamps' water flicker is the soft kind, her lamps
 * never take the sim's fast shimmer, and while her power is at the
 * emergency level `emergencyFlicker` dips her lamps (never black; softened
 * for reduced motion) and is written to `runtime.interiorEmergency` for
 * her emergency lamps' shader. `runtime.walkWet` is the water around the
 * walker (the sound's wash).
 */

/** The rooms draw after everything else; the clear just before. */
const ROOMS_ORDER = 10;
const CLEAR_ORDER = ROOMS_ORDER - 1;
/**
 * A deck room's meshes: its surfaces, its pool's water, then its glass;
 * before the clear from outside, after it (inside wins) from within.
 */
const DECK_ORDER = { rooms: 6, pool: 7, pane: 8 } as const;
/** The deck doors' glow, with the walker in a deck room: after the clear. */
const GLOW_INSIDE_ORDER = CLEAR_ORDER + 0.5;
const DECK_INSIDE_ORDER = {
  rooms: ROOMS_ORDER,
  pool: ROOMS_ORDER + 0.3,
  pane: ROOMS_ORDER + 0.6,
} as const;
/** A pool's water stands this far under its low rim (m): over her model's deck under the hall (2 cm under the rim), so her deck sees it. */
const POOL_FREEBOARD_M = 0.01;

interface InteriorProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
  spec: ShipSpec;
  /** The sky the portholes and the dome show (sRGB hex: the scene's haze). */
  sky?: string;
  /** Daylight (the scene's time of day): her deck rooms lit by the sky. */
  daylight?: boolean;
}

/** The share of a lit neighbour's light a dark room still gets. */
const SPILL = 0.22;
/** How much of a dip reduced motion keeps (0..1): shallower dips. */
const REDUCED_DIP = 0.35;
const NO_FRAMES: readonly SimFrame[] = [];
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

export default function Interior({
  store,
  runtime,
  spec,
  sky,
  daylight,
}: InteriorProps) {
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
      daylight={daylight}
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
  // Her modern finishes (and the daylight on her deck rooms): only hers.
  const modern = b.modern ? applyModern(mats, modernTextures()) : null;
  const daylight = modern ? modern.uDaylight : { value: 0 };
  const paneMat = glassMaterial(mats.sky, daylight);
  const glowMat = new MeshBasicMaterial({ vertexColors: true });
  const group = new Group();
  group.name = "interior";
  group.matrixAutoUpdate = false;
  group.visible = false;
  const pools = basinWater(b.basins);
  const zones: {
    zone: string;
    meshes: Mesh[];
    slots: number[];
    /** A deck room's zone: drawn whenever walking on her. */
    deck: boolean;
    /** Its pool's water and its glass (a deck zone's orders move). */
    pool: Mesh | null;
    pane: Mesh | null;
  }[] = [];
  for (const [zone, layers] of b.zones) {
    const meshes: Mesh[] = [];
    let pane: Mesh | null = null;
    for (const layer of ZONE_LAYERS) {
      const geom = layers[layer];
      if (!geom) continue;
      const mesh = new Mesh(geom, layer === "pane" ? paneMat : mats[layer]);
      mesh.name = `interior-${zone}-${layer}`;
      mesh.renderOrder = ROOMS_ORDER;
      group.add(mesh);
      meshes.push(mesh);
      if (layer === "pane") pane = mesh;
    }
    let pool: Mesh | null = null;
    const pg = pools.get(zone);
    if (pg) {
      pool = new Mesh(pg, waterMats.surface);
      pool.name = `interior-pool-${zone}`;
      // The surface lies at its level in the shader, not its plan.
      pool.frustumCulled = false;
      group.add(pool);
      meshes.push(pool);
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
    zones.push({
      zone,
      meshes,
      slots: water.zoneSlots.get(zone) ?? [],
      deck: b.deckZones.has(zone),
      pool,
      pane,
    });
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
  // The deck rooms' slots (their lamps follow her power, no water).
  const deckSlots: number[] = [];
  const deckRooms = new Set<string>();
  for (const r of interior.rooms)
    if (r.deckRoom) {
      deckSlots.push(water.slot.get(r.id)!);
      deckRooms.add(r.id);
    }
  return {
    ...b,
    mats,
    modern,
    daylight,
    paneMat,
    deckSlots,
    deckRooms,
    /** Whether the deck zones are drawn inside-wins (scratch). */
    deckInside: null as boolean | null,
    /**
     * Her model's paint meshes whose tail (the walk-hidden block the deck
     * room replaces) is cut off by their draw range while drawn; found
     * once per part.
     */
    hidden: null as Mesh[] | null,
    hiddenIn: null as Object3D | null,
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
    /** Each room's water over its lowest floor point this frame (m). */
    depth: new Float32Array(water.count),
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
  b.paneMat.dispose();
  // Her modern tiles go with her build (they upload again if used again).
  if (b.modern) modernTextures().dispose();
  b.clear.geometry.dispose();
  b.clearMat.dispose();
  b.waterMats.surface.dispose();
  b.waterMats.body.dispose();
}

/**
 * Hides her model's walk-hidden block in `part` (the deck room is drawn
 * there), or, with null, shows the one hidden again. The block is the
 * tail of a paint mesh's index (`userData.walkHiddenFrom`): its draw range
 * stops before it (shadow and depth passes too), so it costs no draw call.
 */
function showModel(b: Built, part: Object3D | null): void {
  if (b.hidden && b.hiddenIn !== part) {
    for (const m of b.hidden) m.geometry.setDrawRange(0, Infinity);
    b.hidden = null;
    b.hiddenIn = null;
  }
  if (!part || b.hidden) return;
  const found: Mesh[] = [];
  part.traverse((o) => {
    if (o.userData.walkHiddenFrom !== undefined) found.push(o as Mesh);
  });
  b.hidden = found;
  b.hiddenIn = part;
  for (const m of found)
    m.geometry.setDrawRange(0, m.userData.walkHiddenFrom as number);
}

function InteriorScene({
  store,
  runtime,
  spec,
  interior,
  map,
  sky,
  daylight,
}: SceneProps) {
  const reduced = useRef(false);
  reduced.current = usePrefersReducedMotion();
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
      showModel(b, null);
      scene.remove(b.group);
      if (runtime.interiorLevels === b.levels) runtime.interiorLevels = null;
      if (built.current === b) built.current = null;
      dispose(b);
    };
  }, [interior, map, spec, runtime, scene]);
  useEffect(() => {
    const b = built.current;
    if (b && sky) b.mats.sky.value.set(sky);
    if (b) b.daylight.value = daylight ? 1 : 0;
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
      showModel(b, null);
      lv.drawn.fill(0);
      runtime.interiorEmergency = 1;
      runtime.walkWet = 0;
      return;
    }
    // Her rooms close at her heel limit: only her deck rooms are drawn then.
    const open = roomsOpen(interior, frame, runtime.broken);
    // Her deck room stands where her model's block was: hide that.
    if (b.deckSlots.length > 0) showModel(b, part);
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
    // In a deck room, inside wins (after the clear); outside, it is her
    // exterior's (before it).
    const deckInside = room !== null && b.deckRooms.has(room);
    if (b.deckInside !== deckInside) {
      b.deckInside = deckInside;
      const o = deckInside ? DECK_INSIDE_ORDER : DECK_ORDER;
      for (const z of b.zones) {
        if (!z.deck) continue;
        for (const m of z.meshes) m.renderOrder = o.rooms;
        if (z.pool) z.pool.renderOrder = o.pool;
        if (z.pane) z.pane.renderOrder = o.pane;
      }
      // The deck doors' glow (the club's door in the hall's wall) is drawn
      // inside wins too: in the transparent pass after the clear, before
      // the rooms, so the hall's wall shows the doorway, not a plain wall.
      b.glow.renderOrder = deckInside ? GLOW_INSIDE_ORDER : 0;
      b.glowMat.transparent = deckInside;
    }
    // Each drawn room's water: its target, eased (a room just come into
    // view starts at its target: it was not seen climbing).
    const now = b.now;
    now.fill(0);
    const pose = frame.bodies[0];
    const levels = b.waterMats.levels;
    for (const z of b.zones) {
      const show = z.deck || (open && (seen?.has(z.zone) ?? false));
      for (const m of z.meshes) m.visible = show;
      if (!show) continue;
      for (const k of z.slots) {
        const room = b.rooms[k];
        // A seeping room takes the sea slowly: the seep table's level.
        const seep = room.seep
          ? seepTarget(
              interior,
              p.track?.frames ?? NO_FRAMES,
              spec,
              room.id,
              p.t
            )
          : NaN;
        const target = Number.isNaN(seep)
          ? b.target(room, pose, frame.water)
          : seep;
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
    // Hers: her power's own slow dips (below), never the sim's fast
    // shimmer (14 Hz is too near a strobe); the water's flicker is soft too.
    const hers = interior.emergencyFlicker === true;
    b.mats.flicker.value = hers
      ? 1
      : lampFlicker(shipPower, state.clock.elapsedTime);
    const emergencyLight = spec.blackout?.emergencyLight;
    let dipTo = 1;
    if (hers && emergencyLight !== undefined) {
      const e = emergencyFlicker(
        shipPower,
        emergencyLight,
        state.clock.elapsedTime,
        frame.listDeg
      );
      // Only at the emergency level; reduced motion softens the dips.
      if (shipPower <= emergencyLight + 0.01)
        dipTo = reduced.current ? 1 - (1 - e) * REDUCED_DIP : e;
    }
    runtime.interiorEmergency = dipTo;
    const m = b.group.matrix.elements;
    const power = b.waterMats.power;
    const f = b.floors;
    const own = b.own;
    for (let k = 0; k < now.length; k += 1) {
      if (!now[k]) continue;
      const floorY =
        m[1] * f[k * 3] + m[5] * f[k * 3 + 1] + m[9] * f[k * 3 + 2] + m[13];
      b.depth[k] = lv.shown[k] - floorY;
      own[k] = roomPower(shipPower, b.depth[k], p.t, hers) * dipTo;
    }
    // A long hall's parts: each by the water over its own middle.
    for (let i = 0; i < b.segments.length; i += 1) {
      const { room: r, slot: k } = b.segments[i];
      if (!now[r]) continue;
      const floorY =
        m[1] * f[k * 3] + m[5] * f[k * 3 + 1] + m[9] * f[k * 3 + 2] + m[13];
      own[k] = roomPower(shipPower, lv.shown[r] - floorY, p.t, hers) * dipTo;
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
    // A deck room: her power (no water reaches it); by day the sky lights
    // it whatever her power.
    const day = b.daylight.value;
    for (let i = 0; i < b.deckSlots.length; i += 1) {
      const k = b.deckSlots[i];
      own[k] = shipPower;
      power[k] = shipPower;
    }
    // Each pool's water: level with the sea's horizon at its low rim
    // (spilled as she leans), never under its floor; lit as its room.
    for (let i = 0; i < b.basins.length; i += 1) {
      const bs = b.basins[i];
      let rimY = Infinity;
      let floorY = Infinity;
      for (let c = 0; c < 4; c += 1) {
        const p = bs.rim[c];
        // Ship (x, y, z) is her part's three-local (x, z, −y).
        const y0 = m[1] * p[0] + m[9] * -p[1] + m[13];
        rimY = Math.min(rimY, y0 + m[5] * p[2]);
        floorY = Math.min(floorY, y0 + m[5] * bs.floorZ);
      }
      levels[bs.slot] = Math.max(floorY, rimY - POOL_FREEBOARD_M);
      power[bs.slot] = Math.max(power[bs.room], day);
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
    const dim =
      k !== undefined &&
      torchOn(
        Math.max(
          power[k] * b.mats.flicker.value,
          b.deckSlots.includes(k) ? day : 0
        )
      );
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
    // On deck (or in a deck room: its glow draws after the clear): inside,
    // the glow would be drawn over by the rooms; the doors are shut while
    // the rooms are closed.
    b.glow.visible = open && (seen === undefined || deckInside);
    // The water around the walker (0..1 at a metre): their room's and the
    // rooms open to it (the sound's wash).
    let wet = 0;
    if (open && rk !== undefined) {
      wet = Math.max(0, b.depth[rk]);
      const nb = b.neighbours[rk];
      for (let i = 0; i < nb.length; i += 1)
        if (now[nb[i]]) wet = Math.max(wet, b.depth[nb[i]]);
    }
    runtime.walkWet = Math.min(1, wet);
  }, -1.4);

  return null;
}
