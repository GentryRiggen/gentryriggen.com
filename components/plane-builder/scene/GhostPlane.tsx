"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BackSide,
  DoubleSide,
  type Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  Shape,
  ShapeGeometry,
} from "three";
import {
  decodeGhost,
  poseAt,
  type Ghost,
} from "@/lib/plane-builder/ghost/ghost";
import type { LevelDef } from "@/lib/plane-builder/levels/types";
import type { Tiers } from "@/lib/plane-builder/plane/catalog";
import { flightLive } from "@/lib/plane-builder/state/flightLive";
import PlaneModel from "./PlaneModel";

/** Bright cyan that reads against every world's sky and ground. */
const GHOST_COLOR = "#8be9ff";
const GHOST_OPACITY = 0.5;
const OUTLINE_COLOR = "#0b1f4d";
const OUTLINE_OPACITY = 0.85;
/** How far the outline hull is pushed out along each normal, m. */
const OUTLINE_PUSH = 0.07;
/** Above every opaque object; the outline draws just before the fill. */
const OUTLINE_ORDER = 1000;
const FILL_ORDER = 1001;
const MARKER_ORDER = 1002;
/** Sim seconds the ghost stays after its finish before it vanishes. */
const LINGER = 1.5;
/** The plane's pieces load one by one, so look for new ones this often. */
const RESTYLE_EVERY_FRAMES = 20;
/** The chevron's size as a share of its distance from the camera. */
const MARKER_SIZE = 0.025;
/** It floats this share of the camera distance above the ghost. */
const MARKER_LIFT = 0.035;
/** It fades in between these distances from the player, m. */
const MARKER_FADE_FROM = 15;
const MARKER_FADE_OVER = 25;

/** Moves each vertex out along its normal, which is what makes the hull. */
function pushOutAlongNormal(material: MeshBasicMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `vec3 transformed = position + normalize(normal) * ${OUTLINE_PUSH.toFixed(3)};`
    );
  };
}

function makeMarkerGeometry(): ShapeGeometry {
  // A downward-pointing chevron arrow, one unit wide.
  const shape = new Shape();
  shape.moveTo(-0.5, 0.35);
  shape.lineTo(0, -0.45);
  shape.lineTo(0.5, 0.35);
  shape.lineTo(0.5, 0.05);
  shape.lineTo(0, -0.75 + 0.35);
  shape.lineTo(-0.5, 0.05);
  shape.closePath();
  return new ShapeGeometry(shape);
}

interface GhostPlaneProps {
  level: LevelDef;
  tiers: Tiers;
  ghost: Ghost;
}

/**
 * A glowing cyan copy of the player's plane (outlined in navy) flying a saved
 * best flight, timed to the running flight's clock. It is only drawn: it never
 * touches the sim, so it cannot collide or pick anything up. Its materials
 * are its own (unlit, fog-free, not tone-mapped), so it reads in every world
 * and shares nothing with the player's plane.
 */
export default function GhostPlane({ level, tiers, ghost }: GhostPlaneProps) {
  const root = useRef<Group>(null);
  const plane = useRef<Group>(null);
  const marker = useRef<Mesh>(null);
  const frames = useRef(0);
  const poses = useMemo(() => decodeGhost(ghost), [ghost]);
  const resources = useMemo(
    () => ({
      fill: new MeshBasicMaterial({
        color: GHOST_COLOR,
        transparent: true,
        opacity: GHOST_OPACITY,
        fog: false,
        toneMapped: false,
        depthWrite: false,
      }),
      outline: (() => {
        const outline = new MeshBasicMaterial({
          color: OUTLINE_COLOR,
          transparent: true,
          opacity: OUTLINE_OPACITY,
          side: BackSide,
          fog: false,
          toneMapped: false,
          depthWrite: false,
        });
        pushOutAlongNormal(outline);
        return outline;
      })(),
      marker: new MeshBasicMaterial({
        color: GHOST_COLOR,
        transparent: true,
        opacity: 0,
        side: DoubleSide,
        fog: false,
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
      }),
      markerGeometry: makeMarkerGeometry(),
    }),
    []
  );

  useEffect(
    () => () => {
      resources.fill.dispose();
      resources.outline.dispose();
      resources.marker.dispose();
      resources.markerGeometry.dispose();
    },
    [resources]
  );

  /** Gives every plane piece the ghost paint and an outline hull, once each. */
  function restyle(group: Group): void {
    const meshes: Mesh[] = [];
    group.traverse((node) => {
      const mesh = node as Mesh;
      if (mesh.isMesh && !mesh.userData.isGhostStyled) meshes.push(mesh);
    });
    for (const mesh of meshes) {
      mesh.userData.isGhostStyled = true;
      (mesh.material as Material | Material[]) = resources.fill;
      mesh.renderOrder = FILL_ORDER;
      mesh.castShadow = false;
      const hull = new Mesh(mesh.geometry, resources.outline);
      hull.userData.isGhostStyled = true;
      hull.renderOrder = OUTLINE_ORDER;
      mesh.add(hull);
    }
  }

  useFrame((state) => {
    const group = root.current;
    const live = flightLive.get();
    // Hidden until the flight exists, so there is no flash at the origin.
    if (!group || !live || poses.length === 0) {
      if (group) group.visible = false;
      return;
    }
    group.visible = live.time <= ghost.time + LINGER;
    const pose = poseAt(poses, live.time);
    const body = plane.current;
    if (body) {
      body.position.set(pose.x, pose.y, pose.z);
      body.rotation.set(pose.bank, -pose.heading, pose.pitch, "YZX");
      if (frames.current % RESTYLE_EVERY_FRAMES === 0) restyle(body);
    }
    frames.current += 1;

    const arrow = marker.current;
    if (!arrow) return;
    const toCamera = state.camera.position.distanceTo(body!.position);
    const toPlayer = Math.hypot(
      pose.x - live.x,
      pose.y - live.y,
      pose.z - live.z
    );
    const fade = Math.min(
      1,
      Math.max(0, (toPlayer - MARKER_FADE_FROM) / MARKER_FADE_OVER)
    );
    resources.marker.opacity = 0.9 * fade;
    arrow.visible = fade > 0;
    arrow.position.set(pose.x, pose.y + toCamera * MARKER_LIFT, pose.z);
    arrow.scale.setScalar(toCamera * MARKER_SIZE);
    arrow.quaternion.copy(state.camera.quaternion);
  });

  return (
    <group ref={root} name="ghost-plane" visible={false}>
      <group ref={plane}>
        <PlaneModel levelId={level.id} tiers={tiers} palette={level.palette} />
      </group>
      <mesh
        ref={marker}
        geometry={resources.markerGeometry}
        material={resources.marker}
        renderOrder={MARKER_ORDER}
        visible={false}
      />
    </group>
  );
}
