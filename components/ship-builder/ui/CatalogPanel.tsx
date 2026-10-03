"use client";

import { CATEGORIES, partsInCategory } from "@/lib/ship-builder/model/catalog";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

export default function CatalogPanel() {
  const tool = useShipBuilderStore((s) => s.tool);
  const selectTool = useShipBuilderStore((s) => s.selectTool);

  return (
    <nav aria-label="Parts catalog" className="space-y-5 p-4">
      {CATEGORIES.map((category) => (
        <section key={category.id}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {category.name}
          </h2>
          <ul className="mt-2 space-y-1">
            {partsInCategory(category.id).map((def) => {
              const active = tool.kind === "place" && tool.type === def.type;
              return (
                <li key={def.type}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectTool(def.type)}
                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950"
                        : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="block text-sm font-medium">
                      {def.name}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {def.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
