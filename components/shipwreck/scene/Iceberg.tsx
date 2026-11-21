"use client";
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in the frame loop by design */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { IcosahedronGeometry, Mesh, MeshStandardMaterial } from "three";
import type { PlaybackStore } from "@/lib/shipwreck/playback";

/**
 * The iceberg: a large, irregular, dark berg (procedural, nothing
 * downloaded) with a faint blue tint, scraped along the starboard bow at
 * 11:40 PM and drifting slowly astern, out of view by about 12:30 AM.
 */

function noise3(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 0.11 + y * 0.07) * Math.cos(z * 0.09 - x * 0.05) * 0.5 +
    Math.sin(x * 0.31 - z * 0.23 + y * 0.17) * 0.3 +
    Math.cos(y * 0.41 + z * 0.37) * 0.2
  );
}

export default function Iceberg({ store }: { store: PlaybackStore }) {
  const berg = useMemo(() => {
    const g = new IcosahedronGeometry(1, 4);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i += 1) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const n = noise3(x * 40, y * 40, z * 40);
      // Wide and low, a peak off-centre, flatter underneath.
      const r = 1 + 0.32 * n;
      const peak = Math.max(0, 1 - Math.hypot(x - 0.25, z + 0.1) * 1.6);
      p.setXYZ(
        i,
        x * r * 42,
        (y > 0 ? y * (16 + 22 * peak) : y * 30) * r,
        z * r * 30
      );
    }
    g.computeVertexNormals();
    const mat = new MeshStandardMaterial({
      color: 0x8fa6b8,
      roughness: 0.85,
      metalness: 0,
      flatShading: true,
      emissive: 0x0a1a28,
    });
    const m = new Mesh(g, mat);
    m.name = "iceberg";
    return { m, g, mat };
  }, []);
  useEffect(
    () => () => {
      berg.g.dispose();
      berg.mat.dispose();
    },
    [berg]
  );

  useFrame(() => {
    const { t, openings } = store.getState();
    // Off the starboard bow at the collision, then slipping astern.
    const x = 105 - t * 0.38;
    const z = 46 + t * 0.06;
    berg.m.position.set(x, 0, z);
    berg.m.rotation.y = 0.4 + t * 0.00004;
    // No holes (the title's calm ship before the collision): no iceberg yet.
    berg.m.visible = t < 3600 && openings.length > 0;
  }, -1.5);

  return <primitive object={berg.m} />;
}
