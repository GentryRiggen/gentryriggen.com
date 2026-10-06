"use client";

import { useEffect, useRef } from "react";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { canPlace } from "@/lib/ship-builder/model/placement";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { footprintBase, modelToWorld } from "./coords";
import { facingYaw } from "./deckDecor";
import { gridTargetAnchors } from "./gridTargetAnchors";
import PartMesh from "./PartMesh";

/** Arrow lying on the top of the ghost, pointing the way the part will face. */
function FacingArrow() {
  return (
    <group rotation={[0, 0, 0]}>
      <mesh position={[0.12, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.36, 0.1]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} />
      </mesh>
      <mesh position={[0.36, 0, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.15, 0.24, 3]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} />
      </mesh>
    </group>
  );
}

export default function GhostPreview() {
  const hover = useShipBuilderStore((s) => s.hover);
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const hoverAt = useShipBuilderStore((s) => s.hoverAt);
  const rotation = tool.kind === "place" ? tool.rotation : 0;
  const lastRotation = useRef(rotation);

  // Touch has no hover, so after a turn with nothing under the pointer, show
  // the part on the first spot it fits to make the new direction visible.
  useEffect(() => {
    const turned = lastRotation.current !== rotation;
    lastRotation.current = rotation;
    const state = useShipBuilderStore.getState();
    if (!turned || state.hover || state.tool.kind !== "place") return;
    const tool = state.tool;
    if (getPartDef(tool.type).placement !== "grid") return;
    const targets = gridTargetAnchors(state.ship);
    for (const { level, x, z } of targets) {
      const anchor = { kind: "grid" as const, level, x, z };
      const candidate = { type: tool.type, anchor, rotation: tool.rotation };
      if (canPlace(state.ship, candidate).ok) {
        hoverAt(anchor);
        return;
      }
    }
  }, [rotation, hoverAt]);

  if (!hover) return null;
  const { candidate } = hover;
  const def = getPartDef(candidate.type);
  let arrow = null;
  if (def.placement === "grid" && candidate.anchor.kind === "grid") {
    const { center } = footprintBase(def, candidate.anchor, candidate.rotation);
    const [x, y, z] = modelToWorld(gridLength(ship), beamOf(ship), center);
    arrow = (
      <group
        position={[x, y + Math.max(def.height, 1) + 0.05, z]}
        rotation={[0, facingYaw(candidate.rotation), 0]}
        renderOrder={5}
      >
        <FacingArrow />
      </group>
    );
  }
  return (
    <>
      <PartMesh
        ship={ship}
        part={candidate}
        tint={hover.result.ok ? "ghost-ok" : "ghost-bad"}
      />
      {arrow}
    </>
  );
}
