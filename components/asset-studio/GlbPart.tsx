"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { BufferGeometry, Mesh } from "three";
import Surface, {
  type SurfaceFinish,
} from "@/components/ship-builder/scene/Surface";

export interface SlotColor {
  color: string;
  finish?: SurfaceFinish;
}

interface GlbPartProps {
  url: string;
  /** Colour (and finish) per slot; every mesh in the file is named by slot. */
  slotColors: Record<string, SlotColor>;
  /** Tilt about Z, like the game's funnel rake. */
  rakeRadians?: number;
}

interface SlotMesh {
  slot: string;
  geometry: BufferGeometry;
}

/**
 * A Blender-made .glb drawn with the game's own materials: each mesh is named
 * by slot and gets that slot's colour through `Surface`. An unknown slot
 * throws, so a mis-named mesh shows up in the console and the load gate.
 */
export default function GlbPart({
  url,
  slotColors,
  rakeRadians = 0,
}: GlbPartProps) {
  const { scene } = useGLTF(url);
  const meshes = useMemo(() => {
    const found: SlotMesh[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      const slot = mesh.name || (mesh.material as { name?: string }).name || "";
      if (!Object.hasOwn(slotColors, slot)) {
        throw new Error(`Unknown slot "${slot}" in ${url}`);
      }
      // Bake the node transform so the geometry sits where the file puts it.
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      found.push({ slot, geometry });
    });
    return found;
  }, [scene, slotColors, url]);

  return (
    <group rotation={[0, 0, rakeRadians]}>
      {meshes.map(({ slot, geometry }, index) => (
        <mesh key={`${slot}-${index}`} geometry={geometry} castShadow>
          <Surface
            color={slotColors[slot].color}
            finish={slotColors[slot].finish}
            tint={null}
            emphasis={null}
          />
        </mesh>
      ))}
    </group>
  );
}
