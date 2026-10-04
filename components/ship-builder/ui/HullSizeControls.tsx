"use client";

import {
  ArrowLeftRight,
  ArrowUpDown,
  ChevronsLeftRight,
  ChevronsRightLeft,
  Minus,
  Plus,
} from "lucide-react";
import {
  MAX_BEAM,
  MAX_SEGMENTS,
  MIN_BEAM,
  MIN_SEGMENTS,
} from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { buttonClass } from "./styles";

const ICON_CLASS = "h-4 w-4 shrink-0";
const STEP_BUTTON_CLASS = `${buttonClass} h-11 w-11 shrink-0 p-0!`;

/** Hull length and width steppers. */
export default function HullSizeControls() {
  const segments = useShipBuilderStore((s) => s.ship.hull.lengthSegments);
  const beam = useShipBuilderStore((s) => s.ship.hull.beam);
  const changeHullLength = useShipBuilderStore((s) => s.changeHullLength);
  const changeBeam = useShipBuilderStore((s) => s.changeBeam);

  return (
    <div className="mt-2 space-y-1">
      <div
        role="group"
        aria-label="Hull length"
        className="flex items-center gap-1"
      >
        <ArrowLeftRight
          aria-hidden="true"
          className={`${ICON_CLASS} text-slate-500 dark:text-slate-400`}
        />
        <button
          type="button"
          aria-label="Shorten hull"
          disabled={segments <= MIN_SEGMENTS}
          onClick={() => changeHullLength(-1)}
          className={STEP_BUTTON_CLASS}
        >
          <Minus aria-hidden="true" className={ICON_CLASS} />
        </button>
        <span
          data-testid="hull-length"
          className="min-w-0 flex-1 text-center text-sm tabular-nums"
        >
          {segments} segments
        </span>
        <button
          type="button"
          aria-label="Lengthen hull"
          disabled={segments >= MAX_SEGMENTS}
          onClick={() => changeHullLength(1)}
          className={STEP_BUTTON_CLASS}
        >
          <Plus aria-hidden="true" className={ICON_CLASS} />
        </button>
      </div>

      <div role="group" aria-label="Beam" className="flex items-center gap-1">
        <ArrowUpDown
          aria-hidden="true"
          className={`${ICON_CLASS} text-slate-500 dark:text-slate-400`}
        />
        <button
          type="button"
          aria-label="Narrower"
          disabled={beam <= MIN_BEAM}
          onClick={() => changeBeam(-1)}
          className={STEP_BUTTON_CLASS}
        >
          <ChevronsRightLeft aria-hidden="true" className={ICON_CLASS} />
        </button>
        <span
          data-testid="beam-width"
          className="min-w-0 flex-1 text-center text-sm tabular-nums"
        >
          {beam} wide
        </span>
        <button
          type="button"
          aria-label="Wider"
          disabled={beam >= MAX_BEAM}
          onClick={() => changeBeam(1)}
          className={STEP_BUTTON_CLASS}
        >
          <ChevronsLeftRight aria-hidden="true" className={ICON_CLASS} />
        </button>
      </div>
    </div>
  );
}
