"use client";

import { useState } from "react";
import {
  canAffordProject,
  doneProjects,
  shownProjects,
  waitingProjectCount,
} from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import type { ProjectDef, RunState } from "@/lib/ever-onward/engine/types";
import type { PanelProps } from "../universes/types";
import { pixelClass, retroFocusClass } from "./retro/retroStyles";

const labelOf = (def: PanelProps["def"], id: string): string =>
  def.resources.find((r) => r.id === id)?.label ?? id;

/** "40 know-how + 1.50K power", with what is still missing. */
function costLine(
  def: PanelProps["def"],
  run: RunState,
  project: ProjectDef
): string {
  return project.costs
    .map((c) => {
      const have = run.resources[c.resource] ?? 0;
      const label = labelOf(def, c.resource).toLowerCase();
      const short =
        have >= c.amount ? "" : ` (${formatNumber(Math.floor(have))} so far)`;
      return `${formatNumber(Math.ceil(c.amount))} ${label}${short}`;
    })
    .join(" + ");
}

function ProjectCard({
  def,
  run,
  project,
  onStart,
}: {
  def: PanelProps["def"];
  run: RunState;
  project: ProjectDef;
  onStart: () => void;
}) {
  const isAffordable = canAffordProject(run, project);
  const effect = project.effectPreview?.(run);
  const id = `lm-project-${project.id}`;
  return (
    <li
      data-testid={id}
      className={`space-y-2 border-4 p-3 ${
        isAffordable
          ? "border-violet-300 bg-violet-950/50 shadow-[4px_4px_0_#4c1d95]"
          : "border-slate-700 bg-slate-950/85 shadow-[4px_4px_0_#0f172a]"
      }`}
    >
      <h3
        className={`${pixelClass} text-[10px] ${isAffordable ? "text-violet-200" : "text-slate-300"}`}
      >
        {project.name}
      </h3>
      <p id={`${id}-about`} className="font-mono text-sm text-slate-100">
        {project.description}
      </p>
      {effect && (
        <p className="font-mono text-sm font-bold text-emerald-200 tabular-nums">
          {effect}
        </p>
      )}
      {project.tradeOff && (
        <p id={`${id}-catch`} className="font-mono text-xs text-amber-200">
          The catch: {project.tradeOff}
        </p>
      )}
      <button
        type="button"
        aria-disabled={!isAffordable}
        aria-describedby={
          project.tradeOff ? `${id}-about ${id}-catch` : `${id}-about`
        }
        data-testid={`${id}-start`}
        onClick={() => {
          if (isAffordable) onStart();
        }}
        className={`flex w-full touch-manipulation items-center justify-between gap-2 border-4 px-3 py-2 text-left transition-transform aria-disabled:cursor-not-allowed ${retroFocusClass} ${
          isAffordable
            ? "border-violet-200 bg-violet-400 text-violet-950 shadow-[3px_3px_0_#4c1d95] hover:bg-violet-300 active:translate-y-0.5 active:shadow-none"
            : "border-slate-600 bg-slate-900 text-slate-400"
        }`}
      >
        <span className={`${pixelClass} text-[9px]`}>
          {isAffordable ? "Start" : "Not yet"}
        </span>
        <span className="font-mono text-xs font-bold tabular-nums">
          {costLine(def, run, project)}
        </span>
      </button>
    </li>
  );
}

/**
 * Projects: a few one-off choices, paid mostly in a slow second resource
 * (the night's know-how). Each has a catch, so which one first is the
 * choice. Nothing on offer goes away; new ones arrive with milestones.
 */
export default function ProjectsPanel({ def, run, onAct }: PanelProps) {
  const [lastId, setLastId] = useState<string | null>(null);
  const shown = shownProjects(def, run);
  const done = doneProjects(def, run);
  if (run.complete || (shown.length === 0 && done.length === 0)) return null;
  const waiting = waitingProjectCount(def, run) - shown.length;
  const last = done.find((p) => p.id === lastId);
  const currency = shown[0]?.costs[0]?.resource ?? done[0]?.costs[0]?.resource;
  const currencyLabel = currency ? labelOf(def, currency) : "";

  return (
    <section
      aria-label="Projects"
      data-testid="lm-projects"
      className="space-y-3 border-4 border-violet-400/80 bg-slate-950/85 p-3 shadow-[4px_4px_0_#4c1d95]"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${pixelClass} text-[10px] text-violet-200`}>
          <span aria-hidden="true" className="mr-2 text-amber-300">
            ✎
          </span>
          Projects
        </h2>
        {currency && (
          <p
            data-testid="lm-projects-currency"
            className={`${pixelClass} border-2 border-violet-300 bg-violet-950 px-2 py-1 text-[8px] text-violet-100 tabular-nums`}
          >
            {currencyLabel}{" "}
            {formatNumber(Math.floor(run.resources[currency] ?? 0))}
          </p>
        )}
      </header>
      {shown.length > 0 ? (
        <>
          <p className="font-mono text-sm text-slate-200">
            Your crews learn as they work. Pick what to try next: each idea
            helps, and each has a catch.
          </p>
          <ul className="space-y-3">
            {shown.map((project) => (
              <ProjectCard
                key={project.id}
                def={def}
                run={run}
                project={project}
                onStart={() => {
                  setLastId(project.id);
                  onAct(project.id);
                }}
              />
            ))}
          </ul>
        </>
      ) : (
        <p className="font-mono text-sm text-slate-300">
          Every idea so far is done. New ones come as the grid grows.
        </p>
      )}
      {waiting > 0 && (
        <p className="font-mono text-xs text-slate-300">
          {waiting} more {waiting === 1 ? "idea is" : "ideas are"} waiting for a
          free spot.
        </p>
      )}
      <p
        role="status"
        aria-live="polite"
        data-testid="lm-projects-result"
        className={
          last
            ? "border-2 border-emerald-400 bg-emerald-950/70 p-2 font-mono text-sm font-bold text-emerald-200"
            : "sr-only"
        }
      >
        {last ? `${last.name}: done!` : ""}
      </p>
      {done.length > 0 && (
        <p className="font-mono text-xs text-slate-400">
          Done: {done.map((p) => p.name).join(", ")}.
        </p>
      )}
    </section>
  );
}
