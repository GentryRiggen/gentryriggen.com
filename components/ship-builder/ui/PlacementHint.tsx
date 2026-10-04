"use client";

import { useMemo } from "react";
import PartIcon from "./icons/PartIcon";
import { openAttachPoints } from "@/lib/ship-builder/model/attach";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

export default function PlacementHint() {
  const tool = useShipBuilderStore((s) => s.tool);
  const hover = useShipBuilderStore((s) => s.hover);
  const ship = useShipBuilderStore((s) => s.ship);

  const noRoom = useMemo(() => {
    if (tool.kind !== "place") return null;
    const def = getPartDef(tool.type);
    if (def.placement !== "attach") return null;
    return openAttachPoints(ship, def).length === 0 ? def.emptyHint : null;
  }, [ship, tool]);

  if (tool.kind !== "place") return null;
  const def = getPartDef(tool.type);
  const rotateHint =
    def.placement === "grid" ? ` · R to rotate (${tool.rotation}°)` : "";

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-1.5 text-sm text-white shadow dark:bg-slate-100/90 dark:text-slate-900">
      {hover && !hover.result.ok ? (
        <span
          data-testid="placement-reason"
          className="font-medium text-red-300 dark:text-red-700"
        >
          {hover.result.reason}
        </span>
      ) : noRoom ? (
        <span>{noRoom}</span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <PartIcon type={def.type} className="h-6 w-6 shrink-0" />
          <span>
            Placing {def.name}
            {rotateHint} · Esc to cancel
          </span>
        </span>
      )}
    </div>
  );
}
