"use client";

import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { type BufferGeometry, type InstancedMesh, Object3D } from "three";
import type {
  LevelDef,
  Obstacle,
  ObstacleKind,
} from "@/lib/plane-builder/levels/types";
import { FallbackBoundary, Tracked } from "./GlbProp";
import { buildObstacleGeometry } from "./obstacleGeometry";
import {
  obstacleGeometryFromScene,
  obstacleModelUrl,
  obstacleVariant,
} from "./obstacleModels";

interface InstancesProps {
  geometry: BufferGeometry;
  items: Obstacle[];
  /** Clouds are soft: they cast no shadow and take none (no acne, no black blob). */
  hasShadows?: boolean;
}

/** One instanced mesh: `geometry` stretched to each obstacle's box. */
function Instances({ geometry, items, hasShadows = true }: InstancesProps) {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) return;
    const dummy = new Object3D();
    items.forEach((o, i) => {
      dummy.position.set(o.center.x, o.center.y, o.center.z);
      dummy.scale.set(o.half.x * 2, o.half.y * 2, o.half.z * 2);
      dummy.updateMatrix();
      instances.setMatrixAt(i, dummy.matrix);
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();
  }, [items, geometry]);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, undefined, items.length]}
      castShadow={hasShadows}
      receiveShadow={hasShadows}
    >
      <meshStandardMaterial vertexColors roughness={0.85} />
    </instancedMesh>
  );
}

interface ProceduralProps {
  kind: ObstacleKind;
  items: Obstacle[];
  level: LevelDef;
}

/** The old hand-built shape: drawn while a model loads, or if it fails. */
function Procedural({ kind, items, level }: ProceduralProps) {
  const geometry = useMemo(
    () => buildObstacleGeometry(kind, level.palette),
    [kind, level.palette]
  );
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <Instances
      geometry={geometry}
      items={items}
      hasShadows={kind !== "cloud"}
    />
  );
}

interface ModelProps {
  kind: ObstacleKind;
  url: string;
  items: Obstacle[];
  level: LevelDef;
}

function Model({ kind, url, items, level }: ModelProps) {
  // No Draco or meshopt: the files use neither.
  const { scene } = useGLTF(url, false, false);
  const geometry = useMemo(
    () => obstacleGeometryFromScene(scene, level.palette, url),
    [scene, level.palette, url]
  );
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <Tracked state="loaded">
      <Instances
        geometry={geometry}
        items={items}
        hasShadows={kind !== "cloud"}
      />
    </Tracked>
  );
}

interface KindInstancesProps {
  kind: ObstacleKind;
  items: Obstacle[];
  level: LevelDef;
}

/** One kind's obstacles: a draw call per variant, each from its glb. */
function KindInstances({ kind, items, level }: KindInstancesProps) {
  const byVariant = useMemo(() => {
    const groups = new Map<string, Obstacle[]>();
    for (const o of items) {
      const variant = obstacleVariant(o, level.id);
      const list = groups.get(variant);
      if (list) list.push(o);
      else groups.set(variant, [o]);
    }
    return [...groups.entries()];
  }, [items, level.id]);

  return (
    <>
      {byVariant.map(([variant, group]) => {
        const url = obstacleModelUrl(kind, variant);
        const stand = <Procedural kind={kind} items={group} level={level} />;
        return (
          <FallbackBoundary key={url} fallback={stand}>
            <Suspense fallback={<Tracked state="pending">{stand}</Tracked>}>
              <Model kind={kind} url={url} items={group} level={level} />
            </Suspense>
          </FallbackBoundary>
        );
      })}
    </>
  );
}

interface ObstaclesProps {
  level: LevelDef;
}

/** Instanced meshes per obstacle kind (and variant) in the level. */
export default function Obstacles({ level }: ObstaclesProps) {
  const groups = useMemo(() => {
    const byKind = new Map<ObstacleKind, Obstacle[]>();
    for (const o of level.obstacles) {
      const list = byKind.get(o.kind);
      if (list) list.push(o);
      else byKind.set(o.kind, [o]);
    }
    return [...byKind.entries()];
  }, [level]);

  return (
    <>
      {groups.map(([kind, items]) => (
        <KindInstances
          key={`${level.id}-${kind}`}
          kind={kind}
          items={items}
          level={level}
        />
      ))}
    </>
  );
}
