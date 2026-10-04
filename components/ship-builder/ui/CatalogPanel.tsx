"use client";

import { CATEGORIES, partsInCategory } from "@/lib/ship-builder/model/catalog";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import {
  BOW_SHAPES,
  STERN_SHAPES,
  type HullEndDef,
} from "@/lib/ship-builder/model/hullEnds";
import {
  BOW_IDS,
  STERN_IDS,
  type BowShape,
  type SternShape,
} from "@/lib/ship-builder/model/types";
import HullEndIcon, { type HullEndKind } from "./icons/HullEndIcon";
import PartIcon from "./icons/PartIcon";

interface CatalogPanelProps {
  /** Called after a part is picked (or unpicked). */
  onPick?: () => void;
}

const HEADING_CLASS =
  "text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

interface HullEndTilesProps {
  label: string;
  tiles: { kind: HullEndKind; def: HullEndDef<string> }[];
  selected: string;
  onSelect: (shape: string) => void;
}

/** One row of picture tiles; picking one never changes the active tool. */
function HullEndTiles({ label, tiles, selected, onSelect }: HullEndTilesProps) {
  return (
    <div role="group" aria-label={label} className="mt-2">
      <h3 className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </h3>
      <ul className="mt-1 grid grid-cols-4 gap-1.5">
        {tiles.map(({ kind, def }) => {
          const isSelected = def.id === selected;
          return (
            <li key={def.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                title={def.description}
                onClick={() => onSelect(def.id)}
                className={`flex min-h-16 w-full touch-manipulation flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 py-1 transition-colors ${
                  isSelected
                    ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950"
                    : "border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                }`}
              >
                <HullEndIcon kind={kind} className="h-9 w-9 shrink-0" />
                <span className="text-[11px] font-medium leading-tight">
                  {def.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function CatalogPanel({ onPick }: CatalogPanelProps) {
  const tool = useShipBuilderStore((s) => s.tool);
  const selectTool = useShipBuilderStore((s) => s.selectTool);
  const bow = useShipBuilderStore((s) => s.ship.hull.bow);
  const stern = useShipBuilderStore((s) => s.ship.hull.stern);
  const setBow = useShipBuilderStore((s) => s.setBow);
  const setStern = useShipBuilderStore((s) => s.setStern);

  return (
    <div className="space-y-5 p-4">
      <section>
        <h2 className={HEADING_CLASS}>Hull</h2>
        <HullEndTiles
          label="Bow"
          selected={bow}
          onSelect={(shape) => setBow(shape as BowShape)}
          tiles={BOW_IDS.map((shape) => ({
            kind: { end: "bow", shape },
            def: BOW_SHAPES[shape],
          }))}
        />
        <HullEndTiles
          label="Stern"
          selected={stern}
          onSelect={(shape) => setStern(shape as SternShape)}
          tiles={STERN_IDS.map((shape) => ({
            kind: { end: "stern", shape },
            def: STERN_SHAPES[shape],
          }))}
        />
      </section>
      {CATEGORIES.map((category) => (
        <section key={category.id}>
          <h2 className={HEADING_CLASS}>{category.name}</h2>
          <ul className="mt-2 space-y-1">
            {partsInCategory(category.id).map((def) => {
              const active = tool.kind === "place" && tool.type === def.type;
              return (
                <li key={def.type}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      selectTool(def.type);
                      onPick?.();
                    }}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950"
                        : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <PartIcon type={def.type} className="h-10 w-10 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {def.name}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {def.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
