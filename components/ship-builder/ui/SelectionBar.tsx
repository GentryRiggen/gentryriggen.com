"use client";

import { useCallback, useState } from "react";
import { Check, Palette, Trash2 } from "lucide-react";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { isFunnelType } from "@/lib/ship-builder/model/funnelLivery";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import FunnelStylePanel from "./FunnelStylePanel";
import PartIcon from "./icons/PartIcon";
import {
  buttonClass,
  dangerButtonClass,
  panelClass,
  pressedButtonClass,
} from "./styles";

/**
 * Offers Done (deselect) and Delete only while a part is selected and no tool is active. It
 * shares the bottom-centre slot with PlacementHint; the store clears the tool
 * on select, and the tool check here keeps them apart regardless.
 */
export default function SelectionBar() {
  const selected = useShipBuilderStore((s) =>
    s.selectedId ? s.ship.parts.find((p) => p.id === s.selectedId) : undefined
  );
  const hasTool = useShipBuilderStore((s) => s.tool.kind !== "none");
  const requestDelete = useShipBuilderStore((s) => s.requestDelete);
  const select = useShipBuilderStore((s) => s.select);

  const [styleFor, setStyleFor] = useState<string | null>(null);
  const closeStyle = useCallback(() => setStyleFor(null), []);

  if (!selected || hasTool) return null;
  const def = getPartDef(selected.type);
  const isFunnel = isFunnelType(selected.type);
  const styleOpen = isFunnel && styleFor === selected.id;

  return (
    <>
      {styleOpen && (
        <div className="absolute inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+8rem)] z-20 mx-auto flex max-w-sm justify-center xl:bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.5rem)]">
          <FunnelStylePanel partId={selected.id} onClose={closeStyle} />
        </div>
      )}
      <div
        className={`absolute inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+3.5rem)] z-20 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border py-1 pl-4 pr-1 shadow-lg xl:bottom-[max(0.75rem,env(safe-area-inset-bottom))] ${panelClass}`}
      >
        <PartIcon type={def.type} className="h-6 w-6 shrink-0" />
        <span className="truncate text-sm font-medium">{def.name}</span>
        {isFunnel && (
          <button
            type="button"
            aria-pressed={styleOpen}
            onClick={() => setStyleFor(styleOpen ? null : selected.id)}
            className={`${styleOpen ? pressedButtonClass : buttonClass} min-h-11 rounded-full px-4`}
          >
            <Palette aria-hidden="true" className="h-4 w-4 shrink-0" />
            Style
          </button>
        )}
        <button
          type="button"
          onClick={() => select(null)}
          className={`${buttonClass} min-h-11 rounded-full px-4`}
        >
          <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
          Done
        </button>
        <button
          type="button"
          onClick={requestDelete}
          className={`${dangerButtonClass} min-h-11 rounded-full px-4`}
        >
          <Trash2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          Delete
        </button>
      </div>
    </>
  );
}
