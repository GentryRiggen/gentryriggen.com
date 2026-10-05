"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, type Group } from "three";
import type { Obstacle } from "@/lib/ship-builder/sail";
import { getSailState } from "@/lib/ship-builder/state/sailLive";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { topCamera } from "./driveCamera";
import { markerColor, markerRadius } from "./obstacleMarker";
import ObstacleMesh from "./ObstacleMesh";

/** Obstacles farther than this from the ship (cells) are hidden. */
const DRAW_DISTANCE = 130;

type ObstacleLook = Pick<Obstacle, "id" | "kind" | "radius">;

/** A flat ring on the water that lifts hazards out of the sea in top view. */
function MarkerRing({ look }: { look: ObstacleLook }) {
  return (
    <mesh
      name="obstacle-marker"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.4, 0]}
      renderOrder={10}
    >
      <ringGeometry args={[0.82, 1, 40]} />
      <meshBasicMaterial
        color={markerColor(look.kind)}
        side={DoubleSide}
        depthTest={false}
        toneMapped={false}
        transparent
        opacity={0.95}
      />
    </mesh>
  );
}

function World() {
  const isTop = useShipBuilderStore(
    (s) => s.drive.status === "sailing" && s.drive.view === "top"
  );
  const [looks, setLooks] = useState<ObstacleLook[]>([]);
  const groups = useRef(new Map<string, Group>());
  // Sectors only change when obstacles come or go, so their identity is a
  // cheap signal to re-render the mounted set.
  const seenSectors = useRef<readonly string[] | null>(null);

  useFrame(() => {
    const sail = getSailState();
    if (!sail) return;
    if (sail.sectors !== seenSectors.current) {
      seenSectors.current = sail.sectors;
      setLooks(
        sail.obstacles.map(({ id, kind, radius }) => ({ id, kind, radius }))
      );
    }
    // Rings are sized for the top camera's height, so small things show.
    const topHeight = isTop
      ? topCamera(sail, gridLength(useShipBuilderStore.getState().ship))
          .position[1]
      : 0;
    const cos = Math.cos(sail.heading);
    const sin = Math.sin(sail.heading);
    for (const o of sail.obstacles) {
      const group = groups.current.get(o.id);
      if (!group) continue;
      // The world turns around her: the obstacle in the ship's own frame,
      // where she faces +X and starboard is +Z.
      const dx = o.x - sail.x;
      const dz = o.z - sail.z;
      const u = dx * cos + dz * sin;
      const v = -dx * sin + dz * cos;
      group.visible = Math.hypot(u, v) < DRAW_DISTANCE;
      group.position.set(u, 0, v);
      // A plane heading of `a` is a yaw of `-a` about Y.
      group.rotation.y = sail.heading - (o.heading ?? 0);
      const ring = group.getObjectByName("obstacle-marker");
      if (ring) {
        const size = markerRadius(o.radius, topHeight);
        ring.scale.set(size, size, 1);
      }
    }
  });

  return (
    <>
      {looks.map((look) => (
        <group
          key={look.id}
          ref={(group) => {
            if (group) groups.current.set(look.id, group);
            else groups.current.delete(look.id);
          }}
          visible={false}
        >
          <ObstacleMesh obstacle={look} />
          {isTop && <MarkerRing look={look} />}
        </group>
      ))}
    </>
  );
}

/** The obstacles of a drive, placed around the ship, which stays at the origin. */
export default function SailWorld() {
  const isSailing = useShipBuilderStore((s) => s.drive.status === "sailing");
  if (!isSailing) return null;
  return <World />;
}
