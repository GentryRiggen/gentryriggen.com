"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { type InstancedMesh, Object3D } from "three";
import type {
  LevelDef,
  Obstacle,
  ObstacleKind,
} from "@/lib/plane-builder/levels/types";
import { buildObstacleGeometry } from "./obstacleGeometry";

interface KindInstancesProps {
  kind: ObstacleKind;
  items: Obstacle[];
  level: LevelDef;
}

function KindInstances({ kind, items, level }: KindInstancesProps) {
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(
    () => buildObstacleGeometry(kind, level.palette),
    [kind, level.palette]
  );

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

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, undefined, items.length]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial vertexColors roughness={0.85} />
    </instancedMesh>
  );
}

interface ObstaclesProps {
  level: LevelDef;
}

/** One instanced mesh per obstacle kind in the level. */
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
