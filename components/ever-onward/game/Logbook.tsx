import { metVisitors } from "@/lib/ever-onward/engine/engine";
import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import { uiFor } from "../universes";
import { pixelClass, retroInsetClass } from "./retro/retroStyles";

interface LogbookProps {
  def: UniverseDef;
  run: RunState;
}

/** Everyone who has stopped by this run, and what they said. */
export default function Logbook({ def, run }: LogbookProps) {
  if (!def.visitors || def.visitors.length === 0) return null;
  const { copy, Keepsakes } = uiFor(def.id);
  const met = metVisitors(def, run);
  const lines = new Map(def.story.map((m) => [m.id, m.text]));
  return (
    <section aria-label="Logbook" className="space-y-2">
      <h2 className={`${pixelClass} text-[10px] text-cyan-200`}>
        Logbook
        <span className="ml-2 font-mono text-xs normal-case text-slate-300">
          {met.length === 0
            ? "no visitors yet"
            : `${met.length} ${met.length === 1 ? "visitor" : "visitors"} so far`}
        </span>
      </h2>
      {met.length === 0 ? (
        <p className="font-mono text-xs text-slate-300">{copy.logbookEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {met.map((v) => (
            <li key={v.id} className={`${retroInsetClass} p-2`}>
              <p className="font-mono text-xs font-bold text-amber-300">
                {v.name}
              </p>
              <p className="font-mono text-xs text-slate-300">
                {lines.get(v.id)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {(run.resources.prRuns ?? 0) > 0 && (
        <p className="font-mono text-xs text-sky-200">
          Probe races: {run.resources.prRuns} runs home so far (+
          {formatNumber(Math.floor(run.resources.prEarned ?? 0))} energy
          {(run.resources.prAutoEarned ?? 0) > 0 &&
            `, +${formatNumber(Math.floor(run.resources.prAutoEarned ?? 0))} from the scout`}
          ).
        </p>
      )}
      {(run.resources.tdHauls ?? 0) > 0 && (
        <p className="font-mono text-xs text-sky-200">
          Tide clock: {run.resources.tdHauls} hauls so far (+
          {formatNumber(Math.floor(run.resources.tdEarned ?? 0))} coins from the
          nets
          {(run.resources.tdMilled ?? 0) > 0 &&
            `, +${formatNumber(Math.floor(run.resources.tdMilled ?? 0))} from the tide mill`}
          ).
        </p>
      )}
      {(run.resources.wxFronts ?? 0) > 0 && (
        <p className="font-mono text-xs text-sky-200">
          Weather desk: {run.resources.wxFronts} storms so far, sandbags held{" "}
          {run.resources.wxHeld ?? 0} times (+
          {formatNumber(Math.floor(run.resources.wxEarned ?? 0))} power).
        </p>
      )}
      {Keepsakes && <Keepsakes run={run} />}
    </section>
  );
}
