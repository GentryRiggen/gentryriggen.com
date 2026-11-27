"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Box3,
  Matrix4,
  MOUSE,
  Ray,
  PerspectiveCamera,
  Raycaster,
  TOUCH,
  Vector2,
  Vector3,
  type Group,
} from "three";
import { OrbitControls } from "three-stdlib";
import { placeFor } from "@/lib/shipwreck/places";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { storyIdOf, type ShipSpec } from "@/lib/shipwreck/ships/types";
import { createFrame, sampleTrackInto } from "@/lib/shipwreck/sim/track";
import { partAt } from "@/lib/shipwreck/xray";
import {
  FITZGERALD_WIDE_SHOTS,
  aboveWaves,
  cinematicHit,
  cinematicShot,
  fitAcross,
  clampAboveFloor,
  clampAboveGround,
  dampSpring,
  groundFor,
  hullBoxesFor,
  keepClear,
  lifeboatView,
  nearFor,
  shipToThree as shipThree,
  shipToThreeInto,
  portraitPullBack,
  shotView,
  torpedoInView,
  underwaterView,
  type ShotContext,
  type ShotId,
  type V3,
  type View,
} from "./cameraMath";
import {
  orbitOnceCapsized,
  poseidonBridgeView,
  poseidonSternView,
} from "./poseidonShots";
import type { SceneRuntime } from "./runtime";
import { torpedoHole, trackSideY } from "./Torpedo";
import { insideFov, viewDirection } from "./walkCamera";

/**
 * Every camera. `orbit` is the free camera: one finger orbits, pinch or the
 * wheel zooms (3 m to 3 km), two fingers (or right/shift drag) pan,
 * double-tap a spot on the ship to fly there. It rides with the part of the
 * ship it looks at, never goes under the sea floor or into the hull (X-ray
 * excepted). The presets ease (critically damped) toward their shot; touching
 * the scene on a preset hands the current view to the free camera.
 */

type PartName = "whole" | "bow" | "stern";

interface Fly {
  part: PartName | null;
  target: Vector3;
  cam: Vector3;
}

const FLY_DISTANCE = 26;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 28;

interface CameraRigProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
  /** The ship on the stage (her sea floor and places). */
  spec: ShipSpec;
}

/** A place's camera stays at least this far above the sea (m). */
const PIN_SEA_CLEARANCE_M = 2.5;

export default function CameraRig({ store, runtime, spec }: CameraRigProps) {
  const { camera, gl } = useThree();
  const SEA_DEPTH = spec.seaDepthM;
  const boxes = hullBoxesFor(spec.id);
  // Her wreck's story (her own, or another ship's: a crossover).
  const story = storyIdOf(spec);
  // The Concordia's island and sloping floor (else her flat floor).
  const ground = groundFor(story);
  const controls = useMemo(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.minDistance = 3;
    c.maxDistance = 3000;
    c.screenSpacePanning = true;
    c.zoomSpeed = 1.2;
    c.rotateSpeed = 0.6;
    c.panSpeed = 1;
    c.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };
    c.mouseButtons = {
      LEFT: MOUSE.ROTATE,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.PAN,
    };
    c.target.set(0, 12, 0);
    return c;
  }, [camera, gl]);
  useEffect(() => () => controls.dispose(), [controls]);

  const st = useRef({
    anchor: "whole" as PartName | null,
    local: new Vector3(0, 12, 0),
    fly: null as Fly | null,
    flySnap: false,
    pos: [0, 0, 0] as number[],
    posV: [0, 0, 0] as number[],
    tgt: [0, 0, 0] as number[],
    tgtV: [0, 0, 0] as number[],
    snapId: -1,
    flyId: 0,
    lastTap: { at: -1e9, x: 0, y: 0 },
    shot: "" as string,
    down: { x: 0, y: 0, at: 0 },
    walked: false,
    dir: [0, 0, 0] as V3,
    /** The scene's field of view (the Canvas's), restored after walk. */
    baseFov: null as number | null,
  });
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const hitScratch = useMemo(
    () => ({
      p: [0, -13.4, 9] as [number, number, number],
      out: [0, 0, 0] as V3,
      own: [0, 0, 9] as [number, number, number],
      frame: createFrame(),
    }),
    []
  );
  const tmp = useMemo(
    () => ({
      a: new Vector3(),
      b: new Vector3(),
      ray: new Raycaster(),
      ndc: new Vector2(),
      inv: new Matrix4(),
      localRay: new Ray(),
      box: new Box3(),
    }),
    []
  );

  // Touching the scene on a preset hands the view to the free camera.
  useEffect(() => {
    const onStart = () => {
      const s = st.current;
      s.fly = null;
      if (store.getState().camera !== "orbit") {
        store.getState().takeControl();
        reanchor();
      }
    };
    controls.addEventListener("start", onStart);
    return () => controls.removeEventListener("start", onStart);
    // reanchor reads refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, store]);

  function partGroup(name: PartName | null): Group | null {
    return name ? runtime.part(name) : null;
  }

  /** Re-anchors the target to the part nearest it (or the world). */
  function reanchor() {
    const s = st.current;
    const names: PartName[] = runtime.broken ? ["bow", "stern"] : ["whole"];
    let best: PartName | null = null;
    let bestD = 400;
    for (const n of names) {
      const g = partGroup(n);
      if (!g) continue;
      g.updateMatrixWorld();
      const local = g.worldToLocal(tmp.a.copy(controls.target));
      const dx = Math.max(
        0,
        Math.abs(local.x - (n === "bow" ? 60 : n === "stern" ? -80 : 0)) - 140
      );
      const d = Math.hypot(dx, local.z, Math.max(0, local.y - 40));
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    s.anchor = best;
    const g = partGroup(best);
    if (g) s.local.copy(g.worldToLocal(tmp.a.copy(controls.target)));
  }

  // Double-tap (or double-click) on the ship flies the camera there.
  useEffect(() => {
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => {
      st.current.down = { x: e.clientX, y: e.clientY, at: e.timeStamp };
    };
    const onUp = (e: PointerEvent) => {
      const s = st.current;
      const moved = Math.hypot(e.clientX - s.down.x, e.clientY - s.down.y);
      if (moved > 10 || e.timeStamp - s.down.at > 350) return;
      const last = s.lastTap;
      const isDouble =
        e.timeStamp - last.at < DOUBLE_TAP_MS &&
        Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_TAP_PX;
      s.lastTap = {
        at: isDouble ? -1e9 : e.timeStamp,
        x: e.clientX,
        y: e.clientY,
      };
      // Walking: a double tap is a look drag's, not a fly-to.
      if (isDouble && store.getState().camera !== "walk")
        flyToPoint(e.clientX, e.clientY);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  function flyToPoint(clientX: number, clientY: number) {
    const rect = gl.domElement.getBoundingClientRect();
    tmp.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    tmp.ray.setFromCamera(tmp.ndc, camera);
    // Cheap proxies, not the ship's meshes (150k triangles and thousands of
    // instances): the hull boxes in each part's own frame, clipped to it.
    const breakX = runtime.split?.breakX ?? null;
    let part: PartName | null = null;
    let bestD = Infinity;
    const point = new Vector3();
    for (const n of ["whole", "bow", "stern"] as PartName[]) {
      const g = runtime.part(n);
      if (!g) continue;
      g.updateMatrixWorld();
      tmp.inv.copy(g.matrixWorld).invert();
      tmp.localRay.copy(tmp.ray.ray).applyMatrix4(tmp.inv);
      for (const b of boxes) {
        let x0 = b.x[0];
        let x1 = b.x[1];
        if (n === "bow" && breakX !== null) x0 = Math.max(x0, breakX);
        if (n === "stern" && breakX !== null) x1 = Math.min(x1, breakX);
        if (x1 <= x0) continue;
        // Ship frame (x fwd, y port, z up) to the part's three.js axes.
        tmp.box.min.set(x0, b.z[0], -b.y[1]);
        tmp.box.max.set(x1, b.z[1], -b.y[0]);
        if (!tmp.localRay.intersectBox(tmp.box, tmp.a)) continue;
        tmp.a.applyMatrix4(g.matrixWorld);
        const d = tmp.a.distanceTo(tmp.ray.ray.origin);
        if (d < bestD) {
          bestD = d;
          part = n;
          point.copy(tmp.a);
        }
      }
    }
    if (!part) return;
    const hit = { point };
    const g = partGroup(part);
    if (!g) return;
    const dir = tmp.b.copy(camera.position).sub(hit.point).normalize();
    const camW = hit.point.clone().addScaledVector(dir, FLY_DISTANCE);
    store.getState().takeControl();
    st.current.fly = {
      part,
      target: g.worldToLocal(hit.point.clone()),
      cam: g.worldToLocal(camW),
    };
  }

  function flyToPlace() {
    const s = store.getState();
    const id = s.place;
    if (!id && s.flyView) {
      const v = s.flyView;
      const part = partAt(
        runtime.split?.breakX ?? null,
        runtime.broken,
        v.target[0]
      );
      st.current.fly = {
        part,
        target: new Vector3(v.target[0], v.target[2], -v.target[1]),
        cam: new Vector3(v.cam[0], v.cam[2], -v.cam[1]),
      };
      st.current.flySnap = v.snap === true;
      return;
    }
    const place = placeFor(spec.id, id);
    if (!place) return;
    const part = partAt(
      runtime.split?.breakX ?? null,
      runtime.broken,
      place.at[0]
    );
    const [x, y, z] = place.at;
    const [dx, dy, dz] = place.view;
    // Keep the camera above the sea (and so above the water inside): from
    // inside the flooded volume the whole view is a flat blue wash.
    let camZ = z + dz;
    const pose =
      runtime.frame?.bodies.find((b) => b.part === part) ??
      runtime.frame?.bodies[0];
    if (pose) {
      const seaZ = shipThree(pose, [x + dx, y + dy, camZ])[1];
      if (seaZ < PIN_SEA_CLEARANCE_M) {
        const up = Math.max(0.3, Math.cos(pose.pitch) * Math.cos(pose.roll));
        camZ += (PIN_SEA_CLEARANCE_M - seaZ) / up;
      }
    }
    st.current.fly = {
      part,
      target: new Vector3(x, z, -y),
      cam: new Vector3(x + dx, camZ, -(y + dy)),
    };
  }

  useFrame((state, dt) => {
    const s = st.current;
    const p = store.getState();
    const cam = camera as PerspectiveCamera;
    const frame = runtime.frame;
    const snap = p.snapId !== s.snapId;
    s.snapId = p.snapId;
    if (p.flyId !== s.flyId) {
      s.flyId = p.flyId;
      flyToPlace();
    }
    const d = Math.min(0.1, dt);
    if (s.baseFov === null) s.baseFov = cam.fov;

    const walker = p.camera === "walk" ? runtime.walker : null;
    if (walker) {
      // First person: the walker's eyes, level with the horizon. The free
      // camera's controls, its bounds and its anchor stay out of it.
      controls.enabled = false;
      s.fly = null;
      s.walked = true;
      const dir = viewDirection(walker, s.dir);
      camera.position.set(walker.pos[0], walker.pos[1], walker.pos[2]);
      controls.target.set(
        walker.pos[0] + dir[0] * 10,
        walker.pos[1] + dir[1] * 10,
        walker.pos[2] + dir[2] * 10
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(controls.target);
      const near = nearFor(0.5);
      // Inside her the view widens (and narrows again on the way out).
      const fov = insideFov(cam.fov, runtime.walkInside, d, s.baseFov);
      if (Math.abs(cam.near - near) > near * 0.1 || fov !== cam.fov) {
        cam.near = near;
        cam.fov = fov;
        cam.updateProjectionMatrix();
      }
      runtime.underwater = camera.position.y < 0;
      return;
    }
    if (cam.fov !== s.baseFov) {
      // Walk ended: the scene's own view at once.
      cam.fov = s.baseFov;
      cam.updateProjectionMatrix();
    }
    if (s.walked) {
      // Back from walking: the free camera carries on from the eyes.
      s.walked = false;
      controls.enabled = true;
      reanchor();
    }

    if (p.camera === "orbit" || p.camera === "walk" || !frame) {
      // Ride with the anchored part.
      if (s.anchor && !runtime.part(s.anchor)) {
        // The break: hand the anchor to the half under the target.
        const half = partAt(
          runtime.split?.breakX ?? null,
          runtime.broken,
          s.local.x
        );
        s.anchor = runtime.part(half) ? half : null;
      }
      const g = partGroup(s.anchor);
      if (g) {
        g.updateMatrixWorld();
        const w = g.localToWorld(tmp.a.copy(s.local));
        const delta = tmp.b.copy(w).sub(controls.target);
        camera.position.add(delta);
        controls.target.copy(w);
      }
      if (s.fly) {
        const fg = partGroup(s.fly.part);
        if (fg) fg.updateMatrixWorld();
        const tw = fg
          ? fg.localToWorld(tmp.a.copy(s.fly.target))
          : tmp.a.copy(s.fly.target);
        const cw = fg
          ? fg.localToWorld(tmp.b.copy(s.fly.cam))
          : tmp.b.copy(s.fly.cam);
        const k = s.flySnap || reducedMotion ? 1 : 1 - Math.exp(-d * 3.2);
        s.flySnap = false;
        controls.target.lerp(tw, k);
        camera.position.lerp(cw, k);
        if (
          controls.target.distanceTo(tw) < 0.05 &&
          camera.position.distanceTo(cw) < 0.05
        ) {
          s.fly = null;
        }
        if (s.fly && fg) s.anchor = s.fly.part;
      }
      controls.enabled = true;
      controls.update();
    } else {
      const hole = torpedoHole(p.openings);
      // A ship with her own hits (the Carpathia): the torpedo in view now,
      // where her side was as it struck (port, and her 10:50 AM one).
      const own =
        p.hitTimesS && p.torpedoes.length > 0 && p.track
          ? p.torpedoes[torpedoInView(p.torpedoes, p.t)]
          : null;
      if (own && p.track && p.track.frames.length > 0) {
        hitScratch.own[0] = own.x;
        hitScratch.own[1] = trackSideY(spec, own.side);
        shipToThreeInto(
          sampleTrackInto(p.track, own.t, hitScratch.frame).bodies[0],
          hitScratch.own,
          hitScratch.out
        );
      }
      const ctx: ShotContext = own
        ? {
            t: p.t,
            wall: state.clock.elapsedTime,
            bodies: frame.bodies,
            breakX: p.track?.breakX ?? null,
            seaDepthM: SEA_DEPTH,
            ship: story,
            hull: spec.id,
            hitX: own.x,
            hitT: own.t,
            hitAt: p.track!.frames.length > 0 ? hitScratch.out : undefined,
          }
        : {
            t: p.t,
            wall: state.clock.elapsedTime,
            bodies: frame.bodies,
            breakX: p.track?.breakX ?? null,
            seaDepthM: SEA_DEPTH,
            ship: story,
            hull: spec.id,
            hitX: hole?.x,
            // Where it struck: her first frame, into scratch arrays.
            hitAt:
              hole && p.track && p.track.frames.length > 0
                ? shipToThreeInto(
                    p.track.frames[0].bodies[0],
                    setHole(hitScratch.p, hole.x),
                    hitScratch.out
                  )
                : undefined,
          };
      let view: View;
      let cut = false;
      if (p.camera === "lifeboat") view = lifeboatView(ctx);
      else if (p.camera === "underwater") view = underwaterView(ctx);
      else if (p.camera === "bridge") view = bridgeView(ctx);
      else if (p.camera === "stern") view = sternView(ctx);
      else {
        const shot = p.track
          ? cinematicShot(
              p.track,
              p.t,
              story,
              cinematicHit(p.openings.length, spec.cause, p.preview)
            )
          : story === "lusitania" || story === "carpathia"
            ? "afternoon"
            : story === "britannic"
              ? "morning"
              : story === "fitzgerald"
                ? "storm"
                : story === "concordia"
                  ? "giglio"
                  : story === "poseidon"
                    ? "poseidon-party"
                    : "establishing";
        // Reduced motion: cut between the shots instead of flying.
        if (reducedMotion && shot !== s.shot) cut = true;
        s.shot = shot;
        view = shotView(shot, ctx);
      }
      // Keel up, the cameras that stand on her or by her hand over to the
      // free camera (the Poseidon), from her keel-up shot: never upside
      // down in her flooded bridge or under her.
      const handOver =
        p.track !== null && orbitOnceCapsized(p.camera, p.track.events, p.t);
      if (handOver) {
        view = shotView("poseidon-keel", ctx);
        cut = true;
      }
      if (snap || cut) {
        s.pos = [...view.pos];
        s.tgt = [...view.target];
        s.posV = [0, 0, 0];
        s.tgtV = [0, 0, 0];
      } else {
        dampSpring(s.tgt, s.tgtV, view.target, 3.5, d);
        dampSpring(s.pos, s.posV, view.pos, 1.6, d);
      }
      // Portrait screens are narrow: stand further back so a shot framed
      // for landscape still fits the ship across.
      // (Across only: the height is the shot's, so a camera on the water
      // stays on the water.)
      // (Not so far in her green water, where 200 m is lost in the murk.)
      // Her length across a portrait screen in her wide shots (1.15 × her
      // length shows); under water at most 1.2 (lost in the dark water).
      const pull = portraitPullBack(cam.aspect);
      let back =
        story !== "titanic" && s.pos[1] < 0 ? Math.min(1.2, pull) : pull;
      if (
        story === "fitzgerald" &&
        p.camera === "cinematic" &&
        s.pos[1] >= 0 &&
        cam.aspect < 1.2 &&
        FITZGERALD_WIDE_SHOTS.includes(s.shot as ShotId)
      )
        back = Math.min(
          2.8,
          Math.max(
            back,
            fitAcross(
              cam.aspect,
              cam.fov,
              Math.hypot(s.pos[0] - s.tgt[0], s.pos[2] - s.tgt[2]),
              1.15 * spec.loa
            )
          )
        );
      camera.position.set(
        s.tgt[0] + (s.pos[0] - s.tgt[0]) * back,
        s.pos[1],
        s.tgt[2] + (s.pos[2] - s.tgt[2]) * back
      );
      controls.target.set(s.tgt[0], s.tgt[1], s.tgt[2]);
      camera.lookAt(controls.target);
      reanchor();
      if (handOver) p.takeControl();
    }

    // Never under the floor (or in the island's land); never inside the
    // hull (except in X-ray).
    const cp: V3 = [camera.position.x, camera.position.y, camera.position.z];
    const c = ground
      ? clampAboveGround(cp, ground, 3)
      : clampAboveFloor(cp, SEA_DEPTH, 3);
    camera.position.set(c[0], c[1], c[2]);
    const tp: V3 = [controls.target.x, controls.target.y, controls.target.z];
    const t2 = ground
      ? clampAboveGround(tp, ground, 1)
      : clampAboveFloor(tp, SEA_DEPTH, 1);
    controls.target.set(t2[0], t2[1], t2[2]);
    if (!p.xray && frame && p.camera === "orbit") {
      for (const n of ["whole", "bow", "stern"] as PartName[]) {
        const g = runtime.part(n);
        if (!g) continue;
        const pose = frame.bodies.find((b) => b.part === n) ?? frame.bodies[0];
        const l = g.worldToLocal(tmp.a.copy(camera.position));
        // Local three axes to ship frame and back.
        const ship: V3 = [l.x, -l.z, l.y];
        // Out of her and never through the sea floor (a wreck on her side
        // has a face on the floor).
        const out = keepClear(ship, pose, SEA_DEPTH, boxes, 0.6, 3, ground);
        if (out[0] !== ship[0] || out[1] !== ship[1] || out[2] !== ship[2]) {
          g.localToWorld(tmp.a.set(out[0], out[2], -out[1]));
          camera.position.copy(tmp.a);
        }
      }
    }
    if (s.anchor) {
      const g = partGroup(s.anchor);
      if (g) s.local.copy(g.worldToLocal(tmp.a.copy(controls.target)));
    }
    // A storm: clear of the waves under (or over) the camera, and the
    // target never inside a crest (trap 4: the local surface, not z = 0).
    const sea = runtime.sea;
    if (sea.storm) {
      const surf = runtime.seaY(camera.position.x, camera.position.z);
      camera.position.y = aboveWaves(camera.position.y, surf, 1.5);
      sea.atCamera = surf;
    } else sea.atCamera = 0;
    camera.lookAt(controls.target);
    const near = nearFor(camera.position.distanceTo(controls.target));
    if (Math.abs(cam.near - near) > near * 0.1) {
      cam.near = near;
      cam.updateProjectionMatrix();
    }
    runtime.underwater = camera.position.y < sea.atCamera;
  }, -1);

  return null;
}

function bridgeView(ctx: ShotContext): View {
  if ((ctx.hull ?? ctx.ship) === "poseidon") return poseidonBridgeView(ctx);
  const b = ctx.bodies.find((x) => x.part === "bow") ?? ctx.bodies[0];
  if ((ctx.hull ?? ctx.ship) === "fitzgerald")
    // Her pilothouse's starboard wing, forward, looking aft down her deck
    // (the hatches, the seas coming up from astern).
    return {
      pos: shipThree(b, [101, -8.5, 22.5]),
      target: shipThree(b, [-60, -2, 13]),
    };
  if ((ctx.hull ?? ctx.ship) === "concordia")
    // Her starboard bridge wing on deck 8, out over her side, looking aft
    // along her balconies and boats.
    return {
      pos: shipThree(b, [127, -18.6, 36]),
      target: shipThree(b, [-60, -15, 30]),
    };
  if ((ctx.hull ?? ctx.ship) === "carpathia")
    // Her port bridge wing (the side the torpedo's track was seen on),
    // over the bridge house's front, looking aft along her port boats.
    return {
      pos: shipThree(b, [16, 9.6, 24.5]),
      target: shipThree(b, [-40, 7, 21]),
    };
  if ((ctx.hull ?? ctx.ship) === "lusitania")
    // Her starboard bridge wing (the bridge at 68 m, over the boat deck),
    // looking aft along the boats.
    return {
      pos: shipThree(b, [69, -14.6, 28.4]),
      target: shipThree(b, [-30, -10, 25]),
    };
  return {
    pos: shipThree(b, [74, -15.5, 31.5]),
    target: shipThree(b, [-30, -10, 29]),
  };
}

function sternView(ctx: ShotContext): View {
  if ((ctx.hull ?? ctx.ship) === "poseidon") return poseidonSternView(ctx);
  const b = ctx.bodies.find((x) => x.part === "stern") ?? ctx.bodies[0];
  if ((ctx.hull ?? ctx.ship) === "fitzgerald")
    // On her after house by the funnel, looking forward along her deck.
    return {
      pos: shipThree(b, [-84, 0, 20.5]),
      target: shipThree(b, [60, 0, 13]),
    };
  if ((ctx.hull ?? ctx.ship) === "concordia")
    // Her stepped terraces aft (deck 9's open deck), looking forward to
    // the funnel and the top tier.
    return {
      pos: shipThree(b, [-124, 0, 39]),
      target: shipThree(b, [10, 0, 42]),
    };
  if ((ctx.hull ?? ctx.ship) === "carpathia")
    // Over her stern deckhouse on the open after deck (R21), looking
    // forward past the jigger and the boat platform.
    return {
      pos: shipThree(b, [-84, 0, 19.6]),
      target: shipThree(b, [10, 0, 21]),
    };
  if ((ctx.hull ?? ctx.ship) === "lusitania")
    // Her open Shelter deck aft (no raised poop), looking forward.
    return {
      pos: shipThree(b, [-116, 0, 22.5]),
      target: shipThree(b, [10, 0, 24]),
    };
  return {
    pos: shipThree(b, [-130, 0, 26]),
    target: shipThree(b, [10, 0, 26]),
  };
}

/** A hole's ship-frame point (its x at her side, under the waterline). */
function setHole(
  p: [number, number, number],
  x: number
): [number, number, number] {
  p[0] = x;
  return p;
}
