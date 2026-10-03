"use client";

import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import PartMesh from "./PartMesh";

export default function GhostPreview() {
  const hover = useShipBuilderStore((s) => s.hover);
  const ship = useShipBuilderStore((s) => s.ship);
  if (!hover) return null;
  return (
    <PartMesh
      ship={ship}
      part={hover.candidate}
      tint={hover.result.ok ? "ghost-ok" : "ghost-bad"}
    />
  );
}
