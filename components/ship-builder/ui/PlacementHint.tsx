"use client";

import { useMemo } from "react";
import { RotateCw } from "lucide-react";
import PartIcon from "./icons/PartIcon";
import { SWATCH_FILL } from "./PaintPanel";
import { openAttachPoints } from "@/lib/ship-builder/model/attach";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { PAINT_COLORS } from "@/lib/ship-builder/model/paint";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

// Click-through pill: only the buttons inside it take pointer events. Raised
// on phones so it clears the help and undo buttons in the bottom corners.
const HINT_CLASS =
  "pointer-events-none absolute inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+3.5rem)] z-20 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full bg-slate-900/85 py-1 pl-4 pr-1 text-sm text-white shadow xl:bottom-[max(0.75rem,env(safe-area-inset-bottom))] xl:max-w-[calc(100%-15rem)] dark:bg-slate-100/90 dark:text-slate-900";
const HINT_BUTTON_CLASS =
  "pointer-events-auto inline-flex min-h-11 touch-manipulation items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium";
const HINT_SECONDARY_CLASS = `${HINT_BUTTON_CLASS} bg-white/15 text-white hover:bg-white/25 dark:bg-slate-900/10 dark:text-slate-900 dark:hover:bg-slate-900/20`;
const HINT_PRIMARY_CLASS = `${HINT_BUTTON_CLASS} bg-sky-500 text-white hover:bg-sky-400 dark:bg-sky-600 dark:hover:bg-sky-500`;

interface PlacementHintProps {
  /** Opens the parts drawer so a small screen can pick a paint colour. */
  onOpenColours?: () => void;
}

export default function PlacementHint({ onOpenColours }: PlacementHintProps) {
  const tool = useShipBuilderStore((s) => s.tool);
  const hover = useShipBuilderStore((s) => s.hover);
  const ship = useShipBuilderStore((s) => s.ship);
  const rotate = useShipBuilderStore((s) => s.rotate);
  const cancel = useShipBuilderStore((s) => s.cancel);

  const noRoom = useMemo(() => {
    if (tool.kind !== "place") return null;
    const def = getPartDef(tool.type);
    if (def.placement !== "attach") return null;
    return openAttachPoints(ship, def).length === 0 ? def.emptyHint : null;
  }, [ship, tool]);

  if (tool.kind === "paint") {
    const colour = PAINT_COLORS.find((c) => c.id === tool.color);
    return (
      <div className={HINT_CLASS}>
        <span
          aria-hidden="true"
          className={`h-6 w-6 shrink-0 rounded-full border border-white/60 dark:border-slate-900/40 ${SWATCH_FILL[tool.color]}`}
        />
        <span>Painting{colour ? ` · ${colour.name}` : ""}</span>
        {onOpenColours && (
          <button
            type="button"
            onClick={onOpenColours}
            className={`${HINT_SECONDARY_CLASS} lg:hidden`}
          >
            Colours
          </button>
        )}
        <button type="button" onClick={cancel} className={HINT_PRIMARY_CLASS}>
          Done
        </button>
      </div>
    );
  }
  if (tool.kind !== "place") return null;
  const def = getPartDef(tool.type);
  const canRotate = def.placement === "grid";

  return (
    <div className={HINT_CLASS}>
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
          <span className="whitespace-nowrap">
            Placing {def.name}
            <span className="hidden xl:inline"> · Esc to cancel</span>
          </span>
        </span>
      )}
      {canRotate && (
        <button
          type="button"
          onClick={rotate}
          title={`Rotate (R) · now ${tool.rotation}°`}
          className={HINT_SECONDARY_CLASS}
        >
          <RotateCw aria-hidden="true" className="h-4 w-4 shrink-0" />
          Rotate
        </button>
      )}
    </div>
  );
}
