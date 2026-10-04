"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  Matrix4,
  MeshBasicMaterial,
  SphereGeometry,
  type InstancedMesh,
} from "three";

/** Writes one instance: position, uniform scale and opacity (0 to 1). */
export interface ParticleWriter {
  set: (
    index: number,
    x: number,
    y: number,
    z: number,
    scale: number,
    alpha: number
  ) => void;
}

interface ParticleFieldProps {
  capacity: number;
  color: string;
  /**
   * Fills the instances for this frame and returns how many are live. It runs
   * every frame, so it must not allocate.
   */
  update: (writer: ParticleWriter, time: number, delta: number) => number;
}

interface MeshWriter extends ParticleWriter {
  mesh: InstancedMesh | null;
}

const noRaycast = () => {};

/**
 * One InstancedMesh of soft translucent spheres with a per-instance alpha, so
 * every particle fades on its own. It never blocks pointer events.
 */
export default function ParticleField({
  capacity,
  color,
  update,
}: ParticleFieldProps) {
  const resources = useMemo(() => {
    const geometry = new SphereGeometry(0.5, 8, 6);
    const alphas = new InstancedBufferAttribute(new Float32Array(capacity), 1);
    alphas.setUsage(DynamicDrawUsage);
    geometry.setAttribute("aAlpha", alphas);
    const material = new MeshBasicMaterial({
      color,
      transparent: true,
      depthWrite: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute float aAlpha;\nvarying float vAlpha;"
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvAlpha = aAlpha;"
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vAlpha;"
        )
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\ndiffuseColor.a *= vAlpha;"
        );
    };
    const matrix = new Matrix4();
    const writer: MeshWriter = {
      mesh: null,
      set(index, x, y, z, scale, alpha) {
        // Uniform scale then translation, written straight into one matrix.
        matrix.makeScale(scale, scale, scale);
        matrix.setPosition(x, y, z);
        this.mesh?.setMatrixAt(index, matrix);
        alphas.setX(index, alpha);
      },
    };
    return { geometry, material, alphas, writer };
  }, [capacity, color]);

  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.material.dispose();
    },
    [resources]
  );

  useFrame((state, delta) => {
    const { writer, alphas } = resources;
    const mesh = writer.mesh;
    if (!mesh) return;
    const count = update(writer, state.clock.elapsedTime, delta);
    mesh.count = count;
    if (count === 0) return;
    mesh.instanceMatrix.needsUpdate = true;
    alphas.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={(mesh: InstancedMesh | null) => {
        resources.writer.mesh = mesh;
      }}
      args={[resources.geometry, resources.material, capacity]}
      frustumCulled={false}
      raycast={noRaycast}
      renderOrder={2}
    />
  );
}
