"use client";
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in the frame loop by design */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  Euler,
} from "three";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { BREAK_DAMAGE_M } from "@/lib/shipwreck/sim/constants";
import type { BodyPose } from "@/lib/shipwreck/sim/track";
import { shipToThreeInto, type V3 } from "./cameraMath";

/**
 * The broken middle of the Fitzgerald on the floor between her two parts
 * (the survey: the bow and the stern about 170 ft apart, the middle of her
 * broken up between them, taconite pellets spread around): a field of torn
 * plates, frames and a few hatch covers, and a dark red-brown spill of
 * pellets over the clay. Laid out once (a fixed hash), placed each frame
 * at the gap between her parts' torn ends on the track's last frame, shown
 * once her bow has struck the floor and only under the water. Two draws.
 */

const PIECES = 140;

function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

function pelletTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d");
  if (!g) return null;
  // A radial fade (the spill thins out over the clay), pellets on it.
  g.scale(2, 2);
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, "rgba(58,34,28,0.95)");
  grd.addColorStop(0.6, "rgba(64,40,32,0.6)");
  grd.addColorStop(1, "rgba(70,48,40,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const rnd = rand(1975);
  for (let i = 0; i < 9000; i += 1) {
    const r = Math.sqrt(rnd()) * 120;
    const a = rnd() * Math.PI * 2;
    const l = 14 + rnd() * 22;
    g.fillStyle = `hsla(${10 + rnd() * 14}, 35%, ${l}%, ${0.8 * (1 - r / 128)})`;
    g.beginPath();
    g.arc(
      128 + Math.cos(a) * r,
      128 + Math.sin(a) * r,
      0.25 + rnd() * 0.45,
      0,
      Math.PI * 2
    );
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

interface WreckageProps {
  store: PlaybackStore;
  /** Her sea floor's depth (m). */
  seaDepthM: number;
}

export default function Wreckage({ store, seaDepthM }: WreckageProps) {
  const parts = useMemo(() => {
    const group = new Group();
    group.name = "wreckage";
    group.visible = false;
    const geo = new BoxGeometry(1, 1, 1);
    const mat = new MeshStandardMaterial({ roughness: 0.95, metalness: 0.1 });
    const debris = new InstancedMesh(geo, mat, PIECES);
    debris.name = "debris";
    const rnd = rand(1110);
    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    const p = new Vector3();
    const sc = new Vector3();
    const col = new Color();
    const hull = new Color(0x4a1c1a);
    const rust = new Color(0x5a3424);
    const cover = new Color(0x4a2620);
    for (let i = 0; i < PIECES; i += 1) {
      // Along the gap (x, three), thickest in its middle, spread across.
      const u = (rnd() + rnd() + rnd()) / 3 - 0.5;
      const kind = rnd();
      if (kind < 0.06)
        sc.set(14.6, 0.5, 3.4); // a hatch cover
      else if (kind < 0.55)
        sc.set(2 + rnd() * 5, 0.25, 1.5 + rnd() * 3); // plate
      else sc.set(4 + rnd() * 7, 0.45, 0.45); // a frame or beam
      p.set(u * 70, sc.y / 2 - 0.15 - rnd() * 0.4, (rnd() - 0.5) * 34);
      e.set((rnd() - 0.5) * 0.5, rnd() * Math.PI, (rnd() - 0.5) * 0.6);
      q.setFromEuler(e);
      m.compose(p, q, sc);
      debris.setMatrixAt(i, m);
      col.copy(kind < 0.06 ? cover : rnd() < 0.5 ? hull : rust);
      col.multiplyScalar(0.75 + rnd() * 0.4);
      debris.setColorAt(i, col);
    }
    debris.instanceMatrix.needsUpdate = true;
    if (debris.instanceColor) debris.instanceColor.needsUpdate = true;
    const map = pelletTexture();
    const spillGeo = new CircleGeometry(48, 32);
    const spillMat = new MeshStandardMaterial({
      map,
      transparent: true,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    });
    const spill = new Mesh(spillGeo, spillMat);
    spill.name = "taconite";
    spill.rotation.x = -Math.PI / 2;
    spill.scale.set(1.5, 0.8, 1);
    spill.position.y = 0.06;
    spill.renderOrder = 1;
    group.add(spill, debris);
    return { group, geo, mat, debris, spillGeo, spillMat, map };
  }, []);
  useEffect(
    () => () => {
      parts.geo.dispose();
      parts.mat.dispose();
      parts.debris.dispose();
      parts.spillGeo.dispose();
      parts.spillMat.dispose();
      parts.map?.dispose();
    },
    [parts]
  );

  const scratch = useMemo(
    () => ({
      bowEnd: [0, 0, 0] as number[],
      sternEnd: [0, 0, 0] as number[],
      a: [0, 0, 0] as V3,
      b: [0, 0, 0] as V3,
    }),
    []
  );

  useFrame((state) => {
    const s = store.getState();
    const track = s.track;
    const g = parts.group;
    g.visible = false;
    if (!track || track.breakX === null || track.frames.length === 0) return;
    if (state.camera.position.y > -5) return;
    let landed = Infinity;
    for (const e of track.events)
      if (e.kind === "bow-lands") {
        landed = e.t;
        break;
      }
    if (s.t < landed) return;
    const last = track.frames[track.frames.length - 1];
    let bow: BodyPose | null = null;
    let stern: BodyPose | null = null;
    for (const p of last.bodies)
      if (p.part === "bow") bow = p;
      else if (p.part === "stern") stern = p;
    if (!bow || !stern) return;
    scratch.bowEnd[0] = track.breakX + BREAK_DAMAGE_M;
    scratch.sternEnd[0] = track.breakX - BREAK_DAMAGE_M;
    const a = shipToThreeInto(bow, scratch.bowEnd, scratch.a);
    const b = shipToThreeInto(stern, scratch.sternEnd, scratch.b);
    g.position.set((a[0] + b[0]) / 2, -seaDepthM, (a[2] + b[2]) / 2);
    g.rotation.set(0, Math.atan2(-(a[2] - b[2]), a[0] - b[0]), 0);
    g.visible = true;
  }, -0.8);

  return <primitive object={parts.group} />;
}
