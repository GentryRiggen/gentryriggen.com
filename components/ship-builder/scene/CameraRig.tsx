"use client";

import { useCallback, useEffect, useRef, type ComponentRef } from "react";
import { MOUSE, PerspectiveCamera, TOUCH, Vector3 } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { bowLength, sternLength } from "@/lib/ship-builder/model/hullEnds";
import { gridLength } from "@/lib/ship-builder/model/grid";
import type { Ship } from "@/lib/ship-builder/model/types";
import type { SailState } from "@/lib/ship-builder/sail";
import type { DriveView } from "@/lib/ship-builder/sail/driveConfig";
import { getSailState } from "@/lib/ship-builder/state/sailLive";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { MAX_FRAME_DELTA } from "./animationMath";
import { cameraFollow } from "./cameraFollow";
import { cardFraming, type CardFraming } from "./cardFraming";
import {
  clampTarget,
  MAX_VIEW_DISTANCE,
  maxPolarAngleFor,
  panBounds,
  shipBeam,
  shouldFrame,
  type FrameRequest,
  viewPosition,
  viewTarget,
} from "./cameraViews";
import {
  bridgeCamera,
  type BridgeLayout,
  bridgeLayout,
  chaseCamera,
  topCamera,
  type DriveCameraPose,
} from "./driveCamera";
import { sceneTime } from "./testClock";
import { trialPlayback } from "./trialPlayback";

// Left orbits (Shift/Ctrl/Meta + left pans, built into OrbitControls), the
// wheel zooms and right pans. One finger orbits; two pinch and pan.
const MOUSE_BUTTONS = {
  LEFT: MOUSE.ROTATE,
  MIDDLE: MOUSE.DOLLY,
  RIGHT: MOUSE.PAN,
};
const TOUCHES = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

/** How fast the follow closes on its goal, per second (about 0.3 s to settle). */
const FOLLOW_RATE = 3;
/** The slow-mo side-on view: camera height as a share of its distance. */
const SIDE_ON_HEIGHT = 0.25;
/** The first-person lens: near plane (so railings never clip) and field of view. */
const WALK_NEAR = 0.05;
const WALK_FOV = 70;
/** How fast the drive camera closes on its pose, per second. */
const DRIVE_RATE = 4;
/** The chase camera's gentle sway: size in cells and speed in radians a second. */
const SWAY_SIZE = 0.12;
const SWAY_SPEED = 0.6;
/** The wreck framing: camera height above the target, as a share of distance. */
const WRECK_HEIGHT = 0.2;
/** Closer than this to the goal the target is simply there. */
const FOLLOW_EPSILON = 0.02;
/** Following a half under the surface, the camera dips this far under. */
const UNDER_CAMERA_DEPTH = 1.5;
/** A tall subject (a stern on end) fills at most this share of the view. */
const FIT_SHARE = 0.8;
/** The slim result bar, read (never changed) to keep the wreck out from under it. */
const RESULT_CARD_SELECTOR = "[data-sea-trial-result]";

// Scratch values for the per-frame follow, so it allocates nothing.
const offset = new Vector3();
const underGoal: [number, number, number] = [0, 0, 0];
const driveGoal = new Vector3();
const driveLook = new Vector3();
const canvasBox = { left: 0, top: 0, width: 0, height: 0 };
const cardBox = { left: 0, top: 0, width: 0, height: 0 };

/** Copies an element's on-screen box into `out`. */
function readBox(element: Element, out: typeof canvasBox): typeof canvasBox {
  const rect = element.getBoundingClientRect();
  out.left = rect.left;
  out.top = rect.top;
  out.width = rect.width;
  out.height = rect.height;
  return out;
}

/** Which result (or run) the follow belongs to, so settling is per screen. */
function trialKey(): string {
  const { trial } = useShipBuilderStore.getState();
  return "runId" in trial ? `${trial.status}:${trial.runId}` : trial.status;
}

const WORLD_UP: [number, number, number] = [0, 1, 0];

const bridgeLayouts = new WeakMap<Ship, BridgeLayout>();

/** The bridge spot of a ship, worked out once per ship (the drive never edits it). */
function cachedBridgeLayout(ship: Ship): BridgeLayout {
  let layout = bridgeLayouts.get(ship);
  if (!layout) {
    layout = bridgeLayout(ship);
    bridgeLayouts.set(ship, layout);
  }
  return layout;
}

/** The camera pose for the chosen drive view. */
function drivePose(
  view: DriveView,
  sail: SailState,
  length: number,
  ship: Ship
): DriveCameraPose {
  switch (view) {
    case "top":
      return topCamera(sail, length);
    case "bridge":
      return bridgeCamera(cachedBridgeLayout(ship));
    case "chase":
      return chaseCamera(sail, length);
  }
}

export default function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const get = useThree((state) => state.get);
  const camera = useShipBuilderStore((s) => s.camera);
  const lengthSegments = useShipBuilderStore((s) => s.ship.hull.lengthSegments);
  const lengthCells = useShipBuilderStore((s) => gridLength(s.ship));
  const beam = useShipBuilderStore((s) => shipBeam(s.ship));
  const endLength = useShipBuilderStore((s) =>
    Math.max(bowLength(s.ship.hull.bow), sternLength(s.ship.hull.stern))
  );
  const view = camera.view;
  const isSailing = useShipBuilderStore((s) => s.drive.status === "sailing");
  const isWalking = useShipBuilderStore((s) => s.walk.status === "walking");
  const isActive = isSailing || isWalking;
  const reducedMotion = usePrefersReducedMotion();
  // False until the drive camera has taken its first pose, which it snaps to.
  const hasDrivePose = useRef(false);
  // True while the player orbits or pans, so the follow never fights a drag.
  const isDragging = useRef(false);
  // True from the first followed frame until the target is back at the view's.
  const isFollowing = useRef(false);
  // The follow has reached its goal on this screen (`trialKey`) and lets go,
  // so the player can orbit, zoom and pan the wreck freely.
  const settledKey = useRef<string | null>(null);
  // The player grabbed the camera once she was down; the follow lets go.
  const hasTakenOver = useRef(false);
  // How far the result card's framing has eased in (0 to 1), and its goal.
  const cardBlend = useRef(0);
  const lastCardFraming = useRef<CardFraming | null>(null);
  // The previous request, updated on every run so that repeated single-step
  // length edits never add up to a reframe.
  const seen = useRef<FrameRequest | null>(null);

  useEffect(() => {
    // While sailing or walking another camera owns the view. Forgetting the
    // request makes the builder's own view place the camera again when she is
    // back.
    if (isActive) {
      seen.current = null;
      return;
    }
    const next = { camera, lengthSegments, beam };
    const shouldPlace = shouldFrame(seen.current, next);
    seen.current = next;
    if (!shouldPlace) return;

    const { ship } = useShipBuilderStore.getState();
    const lengthCells = gridLength(ship);
    const orbit = controls.current;
    // With damping on, update() only applies a fraction of any leftover drag
    // momentum, so a preset would drift off its pose. Flush the momentum with
    // damping off, place the camera, then settle once more before restoring.
    if (orbit) {
      orbit.enableDamping = false;
      orbit.update();
    }
    // Read the size here rather than subscribing to it, so a resize doesn't
    // reframe the camera.
    const { width, height } = get().size;
    const aspect = height > 0 ? width / height : 1;
    get().camera.position.set(
      ...viewPosition(camera.view, lengthCells, aspect, shipBeam(ship))
    );
    if (orbit) {
      orbit.target.set(...viewTarget(camera.view));
      orbit.update();
      orbit.enableDamping = true;
    }
  }, [camera, lengthSegments, beam, isActive, get]);

  // Walking: a wider, close-in first-person lens (WalkCamera places it). The
  // builder's lens is restored when the walk ends.
  useEffect(() => {
    if (!isWalking) return;
    const { camera: cam } = get();
    if (!(cam instanceof PerspectiveCamera)) return;
    const { near, fov } = cam;
    if (cam.view?.enabled) cam.clearViewOffset();
    cam.near = WALK_NEAR;
    cam.fov = WALK_FOV;
    cam.updateProjectionMatrix();
    return () => {
      cam.near = near;
      cam.fov = fov;
      cam.up.set(...WORLD_UP);
      cam.updateProjectionMatrix();
    };
  }, [isWalking, get]);

  // Keep the target near the ship after every pan (and damping step). The
  // camera moves by the same amount, so the view slides rather than turns.
  // The target's minimum height also keeps the camera above the water, since
  // maxPolarAngle only holds it above the target.
  const handleChange = useCallback(() => {
    const orbit = controls.current;
    // The follow takes the target far below the usual pan box.
    if (!orbit || isFollowing.current) return;
    const { target, object } = orbit;
    const [x, y, z] = clampTarget(
      [target.x, target.y, target.z],
      panBounds(lengthCells, beam, view, endLength)
    );
    const dx = x - target.x;
    const dy = y - target.y;
    const dz = z - target.z;
    if (dx === 0 && dy === 0 && dz === 0) return;
    target.set(x, y, z);
    object.position.set(
      object.position.x + dx,
      object.position.y + dy,
      object.position.z + dz
    );
  }, [lengthCells, beam, view, endLength]);

  // A shorter or narrower hull shrinks the box; pull the target back into it.
  useEffect(handleChange, [handleChange]);

  // The card framing's view offset never outlives the rig.
  useEffect(
    () => () => {
      const { camera } = get();
      if (camera instanceof PerspectiveCamera) camera.clearViewOffset();
    },
    [get]
  );

  // While the result card is up, the scene is drawn off-centre (and a little
  // smaller if need be) so the wreck sits in the clear part of the canvas.
  // A view offset keeps the orbit target where it is, so orbiting still turns
  // about the wreck. Eases in and out; reduced motion snaps.
  const updateCardFraming = (amount: number) => {
    const { camera, gl, size } = get();
    if (!(camera instanceof PerspectiveCamera)) return;
    const isResult = useShipBuilderStore.getState().trial.status === "result";
    const card = isResult ? document.querySelector(RESULT_CARD_SELECTOR) : null;
    const framing = card
      ? cardFraming(readBox(gl.domElement, canvasBox), readBox(card, cardBox))
      : null;
    if (framing) lastCardFraming.current = framing;
    const goal = framing ? 1 : 0;
    cardBlend.current += (goal - cardBlend.current) * amount;
    if (Math.abs(goal - cardBlend.current) < 0.001) cardBlend.current = goal;
    const target = lastCardFraming.current;
    if (cardBlend.current === 0 || !target) {
      if (camera.view?.enabled) camera.clearViewOffset();
      return;
    }
    const { width, height } = size;
    const blend = cardBlend.current;
    const scale = 1 + (target.scale - 1) * blend;
    const x = width / 2 + (target.x - width / 2) * blend;
    const y = height / 2 + (target.y - height / 2) * blend;
    // Shows the window of a virtual view whose middle (the target) lands on
    // (x, y) of the canvas, drawn `scale` times as large as usual.
    camera.setViewOffset(
      width,
      height,
      width / 2 - x / scale,
      height / 2 - y / scale,
      width / scale,
      height / scale
    );
  };

  // While a ship sinks the orbit target follows her, and the camera moves by
  // the same amount so the player's orbit and zoom are kept. Once she is down
  // and the camera has caught up (or the player grabs it), the follow lets go
  // until the next screen. When the trial ends the target eases back to the
  // view's own. Reduced motion snaps instead.
  useFrame((_, delta) => {
    const orbit = controls.current;
    if (!orbit) return;
    const amount = reducedMotion
      ? 1
      : Math.min(1, Math.min(delta, MAX_FRAME_DELTA) * FOLLOW_RATE);
    updateCardFraming(amount);
    const { phase, sink, halves, breakup, speed } = trialPlayback;
    const follow = cameraFollow(
      { phase, sink, halves, breakup, speed },
      lengthCells
    );
    const isDown = follow !== null && phase === "done";
    if (!isDown) {
      settledKey.current = null;
      hasTakenOver.current = false;
    }
    if (!follow && !isFollowing.current) return;
    isFollowing.current = true;
    const key = trialKey();
    if (isDown && (hasTakenOver.current || settledKey.current === key)) return;

    const { target, object } = orbit;
    const goal = follow ? follow.target : viewTarget(view);
    if (follow?.isUnder) {
      // The orbit keeps the camera a little above its target, so to dip
      // under the sea the target goes deep enough for that height to fit.
      const across = Math.hypot(
        object.position.x - target.x,
        object.position.z - target.z
      );
      const rise = across / Math.tan(orbit.maxPolarAngle);
      underGoal[0] = goal[0];
      underGoal[1] = Math.min(goal[1], -rise - UNDER_CAMERA_DEPTH * 2);
      underGoal[2] = goal[2];
    }
    const aim = follow?.isUnder ? underGoal : goal;
    const dx = (aim[0] - target.x) * amount;
    const dy = (aim[1] - target.y) * amount;
    const dz = (aim[2] - target.z) * amount;
    target.x += dx;
    target.y += dy;
    target.z += dz;
    object.position.x += dx;
    object.position.y += dy;
    object.position.z += dz;

    if (follow && !isDragging.current) {
      offset.copy(object.position).sub(target);
      if (follow.isSideOn) {
        // Swing round to whichever side she is nearer, keeping the distance.
        const side = offset.z < 0 ? -1 : 1;
        const length = offset.length() / Math.hypot(1, SIDE_ON_HEIGHT);
        offset.x -= offset.x * amount;
        offset.z += (side * length - offset.z) * amount;
        offset.y += (length * SIDE_ON_HEIGHT - offset.y) * amount;
      } else if (follow.isUnder) {
        // The sea hides what is under it from above: dip just under it.
        const limit = -target.y - UNDER_CAMERA_DEPTH;
        if (offset.y > limit) offset.y += (limit - offset.y) * amount;
      } else if (follow.isLow) {
        // Only ever lower the camera; a player who went lower stays there.
        const limit = Math.hypot(offset.x, offset.z) * WRECK_HEIGHT;
        if (offset.y > limit) offset.y += (limit - offset.y) * amount;
      }
      const { camera } = get();
      if (follow.height > 0 && camera instanceof PerspectiveCamera) {
        // Back off (never in) until a stern standing on end fits.
        const halfFov = (camera.fov * Math.PI) / 360;
        const needed = Math.min(
          MAX_VIEW_DISTANCE,
          follow.height / 2 / Math.tan(halfFov) / FIT_SHARE
        );
        const distance = offset.length();
        if (distance > 0 && distance < needed) {
          offset.multiplyScalar(1 + ((needed - distance) / distance) * amount);
        }
      }
      object.position.copy(target).add(offset);
    }

    const distanceToGoal =
      Math.abs(aim[0] - target.x) +
      Math.abs(aim[1] - target.y) +
      Math.abs(aim[2] - target.z);
    if (distanceToGoal < FOLLOW_EPSILON) {
      if (!follow) isFollowing.current = false;
      else if (isDown) settledKey.current = key;
    }
    orbit.update();
  });

  // Sailing: no orbiting. The camera rides behind and above the ship, which
  // stays at the origin, and eases to its pose as she speeds up.
  useFrame((state, delta) => {
    if (!isSailing) {
      if (hasDrivePose.current) get().camera.up.set(...WORLD_UP);
      hasDrivePose.current = false;
      return;
    }
    const sail = getSailState();
    if (!sail) return;
    const { camera: cam } = get();
    if (cam instanceof PerspectiveCamera && cam.view?.enabled) {
      cam.clearViewOffset();
    }
    const { ship, drive } = useShipBuilderStore.getState();
    const length = gridLength(ship);
    const driveView = drive.status === "sailing" ? drive.view : "chase";
    const pose = drivePose(driveView, sail, length, ship);
    driveGoal.set(...pose.position);
    driveLook.set(...pose.target);
    cam.up.set(...(pose.up ?? WORLD_UP));
    if (driveView === "chase" && !reducedMotion) {
      const sway = Math.sin(sceneTime(state.clock.elapsedTime) * SWAY_SPEED);
      driveGoal.z += sway * SWAY_SIZE * length * 0.2;
      driveGoal.y += Math.cos(sway * 2) * SWAY_SIZE;
    }
    const amount =
      reducedMotion || !hasDrivePose.current
        ? 1
        : Math.min(1, Math.min(delta, MAX_FRAME_DELTA) * DRIVE_RATE);
    hasDrivePose.current = true;
    cam.position.lerp(driveGoal, amount);
    cam.lookAt(driveLook);
  });

  if (isActive) return null;
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={viewTarget(view)}
      enablePan
      screenSpacePanning
      mouseButtons={MOUSE_BUTTONS}
      touches={TOUCHES}
      onChange={handleChange}
      onStart={() => {
        isDragging.current = true;
        // Once she is down, a grab hands the camera to the player for good.
        if (trialPlayback.phase === "done" && isFollowing.current) {
          hasTakenOver.current = true;
        }
      }}
      onEnd={() => {
        isDragging.current = false;
      }}
      minDistance={6}
      maxDistance={MAX_VIEW_DISTANCE}
      maxPolarAngle={maxPolarAngleFor(view)}
    />
  );
}
