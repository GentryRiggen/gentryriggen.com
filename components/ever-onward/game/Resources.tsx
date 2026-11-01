import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";

interface ResourcesProps {
  def: UniverseDef;
  run: RunState;
}

function formatResource(id: string, value: number): string {
  if (id === "night") return `${value.toFixed(1)}%`;
  if (id === "oilPrice") return value.toFixed(2);
  return formatNumber(Math.floor(value));
}

export default function Resources({ def, run }: ResourcesProps) {
  const phaseId = def.phases[run.phase].id;
  const shown = def.resources.filter(
    (r) => r.phases === undefined || r.phases.includes(phaseId)
  );
  return (
    <dl
      aria-label="Resources"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {shown.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
        >
          <dt className="truncate text-xs text-slate-600 dark:text-slate-400">
            {r.label}
          </dt>
          <dd
            data-testid={`lm-res-${r.id}`}
            className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50"
          >
            {formatResource(r.id, run.resources[r.id] ?? 0)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
