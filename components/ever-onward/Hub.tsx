import Link from "next/link";
import { formatDuration } from "@/lib/ever-onward/engine/format";
import type { SaveData, UniverseDef } from "@/lib/ever-onward/engine/types";
import { EVER_ONWARD_VERSION } from "@/lib/ever-onward/version";
import {
  LOCKED_UNIVERSES,
  PLAYABLE_UNIVERSES,
} from "@/lib/ever-onward/universes";
import { cardClass, focusRingClass, primaryButtonClass } from "./styles";

interface HubProps {
  save: SaveData;
  isRecovered: boolean;
  onPlay: (id: string) => void;
}

function UniverseCard({
  def,
  save,
  onPlay,
}: {
  def: UniverseDef;
  save: SaveData;
  onPlay: (id: string) => void;
}) {
  const universe = save.universes[def.id];
  const run = universe?.run;
  const hasStarted =
    !!universe && (universe.completions > 0 || run.time > 0 || run.taps > 0);
  const facts: string[] = [];
  if (universe && hasStarted) {
    facts.push(`Reached: ${def.phases[run.phase]?.title ?? "The beginning"}`);
    if (universe.completions > 0)
      facts.push(
        `Finished ${universe.completions} ${universe.completions === 1 ? "time" : "times"}`
      );
    if (universe.best !== null)
      facts.push(`Best time: ${formatDuration(universe.best)}`);
    if (universe.embers > 0) facts.push(`Embers: ${universe.embers}`);
  }
  return (
    <li className={`${cardClass} flex flex-col gap-3 p-4`}>
      <div>
        <h2 className="text-xl font-bold">{def.title}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">{def.goal}</p>
      </div>
      {facts.length > 0 && (
        <ul
          data-testid={`lm-facts-${def.id}`}
          className="space-y-0.5 text-sm text-slate-700 dark:text-slate-300"
        >
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        data-testid={`lm-play-${def.id}`}
        onClick={() => onPlay(def.id)}
        className={`${primaryButtonClass} self-start`}
      >
        {hasStarted ? "Continue" : "Play"}
        <span className="sr-only"> {def.title}</span>
      </button>
    </li>
  );
}

export default function Hub({ save, isRecovered, onPlay }: HubProps) {
  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Ever Onward</h1>
          <p className="text-lg text-slate-700 dark:text-slate-300">
            Little machines. One simple goal each. Ever onward.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
            <Link
              href="/ever-onward/versions"
              className={`rounded underline ${focusRingClass}`}
            >
              v{EVER_ONWARD_VERSION} · What&apos;s new
            </Link>
            <Link href="/" className={`rounded underline ${focusRingClass}`}>
              Back to gentryriggen.com
            </Link>
          </p>
        </header>
        {isRecovered && (
          <p
            role="status"
            className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
          >
            Your old save could not be read. We kept a backup and started fresh.
          </p>
        )}
        <ul className="space-y-4">
          {PLAYABLE_UNIVERSES.map((def) => (
            <UniverseCard key={def.id} def={def} save={save} onPlay={onPlay} />
          ))}
          {LOCKED_UNIVERSES.map((locked) => (
            <li
              key={locked.id}
              aria-label={`${locked.title}, coming soon`}
              className={`${cardClass} space-y-1 border-dashed p-4 opacity-70`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xl font-bold">{locked.title}</h2>
                <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800">
                  Coming soon
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {locked.goal}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          More universes on the way. Your game saves on this device.
        </p>
      </main>
    </div>
  );
}
