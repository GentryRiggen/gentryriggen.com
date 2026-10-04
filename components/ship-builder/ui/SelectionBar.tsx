"use client";

import { Trash2 } from "lucide-react";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import PartIcon from "./icons/PartIcon";
import { dangerButtonClass, panelClass } from "./styles";

/**
 * Offers Delete only while a part is selected and no tool is active. It
 * shares the bottom-centre slot with PlacementHint; the store clears the tool
 * on select, and the tool check here keeps them apart regardless.
 */
export default function SelectionBar() {
  const selected = useShipBuilderStore((s) =>
    s.selectedId ? s.ship.parts.find((p) => p.id === s.selectedId) : undefined
  );
  const hasTool = useShipBuilderStore((s) => s.tool.kind !== "none");
  const requestDelete = useShipBuilderStore((s) => s.requestDelete);

  if (!selected || hasTool) return null;
  const def = getPartDef(selected.type);

  return (
    <div
      className={`absolute inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+3.5rem)] z-20 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border py-1 pl-4 pr-1 shadow-lg xl:bottom-[max(0.75rem,env(safe-area-inset-bottom))] ${panelClass}`}
    >
      <PartIcon type={def.type} className="h-6 w-6 shrink-0" />
      <span className="truncate text-sm font-medium">{def.name}</span>
      <button
        type="button"
        onClick={requestDelete}
        className={`${dangerButtonClass} min-h-11 rounded-full px-4`}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4 shrink-0" />
        Delete
      </button>
    </div>
  );
}
