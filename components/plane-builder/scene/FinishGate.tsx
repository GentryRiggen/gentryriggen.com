"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { BoxGeometry, Color, type InstancedMesh, Object3D } from "three";
import { terrainHeight } from "@/lib/plane-builder/levels/terrain";
import type { LevelDef } from "@/lib/plane-builder/levels/types";
import { createLabelTexture } from "./signTexture";

const SEGMENT = 2;
const SEGMENTS = 14;
const POST_WIDTH = 2;
const BANNER_HEIGHT = 6;
const BANNER_DEPTH = 0.6;

interface FinishGateProps {
  level: LevelDef;
}

/** Two chequered posts and a banner across the corridor at the finish line. */
export default function FinishGate({ level }: FinishGateProps) {
  const posts = useRef<InstancedMesh>(null);
  const x = level.finishDistance;
  const postZ = level.corridorHalfWidth + POST_WIDTH;
  const baseY = terrainHeight(level.terrain, x, 0);
  const postGeometry = useMemo(
    () => new BoxGeometry(POST_WIDTH, SEGMENT, POST_WIDTH),
    []
  );
  const bannerWidth = postZ * 2;
  const bannerY = baseY + SEGMENT * SEGMENTS - BANNER_HEIGHT / 2;

  useLayoutEffect(() => {
    const mesh = posts.current;
    if (!mesh) return;
    const dummy = new Object3D();
    const black = new Color("#111827");
    const white = new Color("#f9fafb");
    let index = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < SEGMENTS; i += 1) {
        dummy.position.set(x, baseY + SEGMENT * (i + 0.5), side * postZ);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, (i + (side > 0 ? 1 : 0)) % 2 ? black : white);
        index += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [x, baseY, postZ]);

  const bannerTexture = useMemo(
    () => createLabelTexture("FINISH", "#dc2626", "#ffffff"),
    []
  );

  useLayoutEffect(() => () => postGeometry.dispose(), [postGeometry]);
  useLayoutEffect(() => () => bannerTexture.dispose(), [bannerTexture]);

  return (
    <group>
      <instancedMesh
        ref={posts}
        args={[postGeometry, undefined, SEGMENTS * 2]}
        castShadow
      >
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <mesh position={[x, bannerY, 0]} castShadow>
        <boxGeometry args={[BANNER_DEPTH, BANNER_HEIGHT, bannerWidth]} />
        <meshStandardMaterial color="#dc2626" roughness={0.6} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[x + side * (BANNER_DEPTH / 2 + 0.05), bannerY, 0]}
          rotation={[0, side < 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
        >
          <planeGeometry args={[bannerWidth * 0.9, BANNER_HEIGHT * 0.9]} />
          <meshBasicMaterial map={bannerTexture} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
