"use client";
/* eslint-disable react-hooks/immutability -- three.js objects and the scene runtime are mutated in the frame loop by design */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  LinearSRGBColorSpace,
  Color,
  FogExp2,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SpotLight,
  SRGBColorSpace,
  HemisphereLight,
} from "three";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import type { SceneRuntime } from "./runtime";

/**
 * Light, fog and the deep: very low starlight (hemisphere), the night fog
 * to the horizon, and under the surface a blue-black fog that thickens with
 * depth, the mud of the sea floor at `seaDepthM` and a submersible's lamp on
 * the camera so the wreck is readable.
 */

const SEA_DEPTH = titanic.seaDepthM;
// The sky's colour at the horizon (linear), so the sea fades into it.
const NIGHT_FOG = new Color().setRGB(
  0.014,
  0.0195,
  0.032,
  LinearSRGBColorSpace
);
const SEA_FOG = new Color(0x02121c);
const DEEP_FOG = new Color(0x020a14);

function mudTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#4a4136";
  g.fillRect(0, 0, 256, 256);
  // Deterministic speckle and soft blotches.
  let a = 77;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  for (let i = 0; i < 260; i += 1) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 6 + rnd() * 26;
    const l = 50 + rnd() * 30;
    g.fillStyle = `hsla(34, 14%, ${l}%, 0.10)`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 4000; i += 1) {
    const l = 20 + rnd() * 50;
    g.fillStyle = `hsla(30, 10%, ${l}%, 0.5)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1, 1);
  }
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(160, 160);
  t.colorSpace = SRGBColorSpace;
  return t;
}

interface EnvironmentProps {
  runtime: SceneRuntime;
}

export default function Environment({ runtime }: EnvironmentProps) {
  const { scene, camera } = useThree();

  const fog = useMemo(() => new FogExp2(NIGHT_FOG.getHex(), 0.00011), []);
  useEffect(() => {
    scene.fog = fog;
    scene.background = new Color(0x02040a);
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene, fog]);

  const floor = useMemo(() => {
    const map = mudTexture();
    const mat = new MeshStandardMaterial({
      color: 0x8a7f70,
      map,
      roughness: 1,
      metalness: 0,
    });
    const geo = new PlaneGeometry(24000, 24000);
    const m = new Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = -SEA_DEPTH;
    m.name = "sea-floor";
    return { m, geo, mat, map };
  }, []);
  useEffect(
    () => () => {
      floor.geo.dispose();
      floor.mat.dispose();
      floor.map?.dispose();
    },
    [floor]
  );

  // Starlight; a rocket's burst lights everything briefly (white).
  const sky = useMemo(() => {
    const h = new HemisphereLight(0x4a5c86, 0x06080e, 0.9);
    h.name = "starlight";
    return h;
  }, []);

  const lamp = useMemo(() => {
    const l = new SpotLight(0xd8ecff, 0, 420, 0.55, 0.6, 1.1);
    l.name = "submersible-lamp";
    return l;
  }, []);

  useFrame((state) => {
    const y = camera.position.y;
    const under = y < 0;
    if (under) {
      // Thicker and darker the deeper it goes.
      const k = Math.min(1, -y / 600);
      fog.color.copy(SEA_FOG).lerp(DEEP_FOG, k);
      fog.density = 0.0065 - 0.002 * k;
      (scene.background as Color).copy(fog.color);
    } else {
      fog.color.copy(NIGHT_FOG);
      fog.density = 0.00011;
      (scene.background as Color).set(0x02040a);
    }
    floor.m.visible = y < -SEA_DEPTH + 2500;
    // The lamp rides on the camera, a little above, pointing where it looks.
    lamp.intensity = under ? Math.min(1, -y / 40) * 320 : 0;
    lamp.position.copy(camera.position);
    lamp.position.y += 1.5;
    state.camera.getWorldDirection(lamp.target.position);
    lamp.target.position.multiplyScalar(60).add(camera.position);
    lamp.target.updateMatrixWorld();
    runtime.underwater = under;
    sky.intensity = under ? 0.25 : 0.9 + runtime.flash * 5;
  }, -0.8);

  return (
    <>
      <primitive object={sky} />
      <primitive object={floor.m} />
      <primitive object={lamp} />
      <primitive object={lamp.target} />
    </>
  );
}
