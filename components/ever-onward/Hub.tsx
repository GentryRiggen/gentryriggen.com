"use client";

import Link from "next/link";
import { formatDuration } from "@/lib/ever-onward/engine/format";
import {
  hasStartedUniverse,
  isUniverseUnlocked,
} from "@/lib/ever-onward/engine/progress";
import type { SaveData, UniverseDef } from "@/lib/ever-onward/engine/types";
import { EVER_ONWARD_VERSION } from "@/lib/ever-onward/version";
import { prestigeLabel } from "@/lib/ever-onward/engine/prestige";
import { PADLOCK_COLORS, PADLOCK_ROWS } from "@/lib/ever-onward/start/sprites";
import {
  LOCKED_UNIVERSES,
  PLAYABLE_UNIVERSES,
  type LockedUniverse,
} from "@/lib/ever-onward/universes";
import { uiFor } from "./universes";
import MusicToggle from "./audio/MusicToggle";
import PixelSprite from "./start/PixelSprite";
import RetroLabel from "./start/RetroLabel";
import RetroPage from "./start/RetroPage";
import RetroText from "./start/RetroText";
import {
  retroFocusClass,
  retroHeadingClass,
  retroLinkClass,
  retroPanelClass,
} from "./start/retroStyles";

interface HubProps {
  save: SaveData;
  isRecovered: boolean;
  onPlay: (id: string) => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 border-2 border-slate-700 bg-slate-900/80 px-2 py-1.5">
      <dt>
        <RetroLabel
          label={label}
          className="text-[8px] text-cyan-200 leading-none"
        />
      </dt>
      <dd className="font-mono text-sm text-amber-100">{value}</dd>
    </div>
  );
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
  const hasStarted = !!universe && hasStartedUniverse(universe);
  const { hubSprite } = uiFor(def.id);
  const stats: { label: string; value: string }[] = [];
  if (universe && hasStarted) {
    stats.push({
      label: "Reached",
      value: def.phases[run.phase]?.title ?? "The beginning",
    });
    if (universe.completions > 0)
      stats.push({
        label: "Finished",
        value: `${universe.completions} ${universe.completions === 1 ? "time" : "times"}`,
      });
    if (universe.best !== null)
      stats.push({ label: "Best time", value: formatDuration(universe.best) });
    if (universe.embers > 0)
      stats.push({ label: prestigeLabel(def), value: String(universe.embers) });
  }
  return (
    <li className={`${retroPanelClass} eo-rise flex flex-col gap-3 p-3 sm:p-4`}>
      <div className="flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center border-2 border-slate-700 bg-slate-900/80">
          <PixelSprite
            rows={hubSprite.rows}
            palette={hasStarted ? hubSprite.lit : hubSprite.dim}
            className={`h-12 ${hasStarted ? "drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" : ""}`}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h2>
            <RetroLabel
              label={def.title}
              className={`text-xs leading-snug whitespace-normal! sm:text-sm ${retroHeadingClass}`}
            />
          </h2>
          <p className="font-mono text-xs text-slate-200 sm:text-sm">
            {def.goal}
          </p>
        </div>
      </div>
      {stats.length > 0 && (
        <dl
          data-testid={`lm-facts-${def.id}`}
          className="grid grid-cols-2 gap-2"
        >
          {stats.map((stat) => (
            <Stat key={stat.label} {...stat} />
          ))}
        </dl>
      )}
      <button
        type="button"
        data-testid={`lm-play-${def.id}`}
        onClick={() => onPlay(def.id)}
        className={`group flex min-h-14 touch-manipulation items-center justify-center border-4 border-amber-300 bg-amber-950/60 px-4 py-3 hover:bg-amber-900/70 ${retroFocusClass}`}
      >
        <span className="sr-only">
          {hasStarted ? "Continue" : "Play"} {def.title}
        </span>
        <span aria-hidden="true" className="eo-prompt flex items-center gap-3">
          <RetroText text="▶︎" className={`text-sm ${retroHeadingClass}`} />
          <RetroText
            text={hasStarted ? "CONTINUE" : "PLAY"}
            className={`text-sm group-hover:text-amber-200 ${retroHeadingClass}`}
          />
        </span>
      </button>
    </li>
  );
}

/** A built universe that still waits for another one to be finished. */
function RequirementCard({ def }: { def: UniverseDef }) {
  return (
    <li
      data-testid={`lm-locked-${def.id}`}
      aria-label={`${def.title}, locked`}
      className="flex items-center gap-3 border-4 border-dashed border-slate-700 bg-slate-950/70 p-3 opacity-90 sm:p-4"
    >
      <div className="grid size-16 shrink-0 place-items-center border-2 border-slate-800 bg-slate-900/80">
        <PixelSprite
          rows={PADLOCK_ROWS}
          palette={PADLOCK_COLORS}
          className="h-8"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h2>
          <RetroLabel
            label={def.title}
            className="text-[10px] leading-snug whitespace-normal! text-slate-300 sm:text-xs"
          />
        </h2>
        <p className="font-mono text-xs text-slate-300">{def.goal}</p>
        <p className="font-mono text-xs text-amber-200">{def.requires?.hint}</p>
      </div>
    </li>
  );
}

function LockedCard({ locked }: { locked: LockedUniverse }) {
  return (
    <li
      aria-label={`${locked.title}, coming soon`}
      className="flex items-center gap-3 border-4 border-dashed border-slate-700 bg-slate-950/70 p-3 opacity-80 sm:p-4"
    >
      <div className="grid size-16 shrink-0 place-items-center border-2 border-slate-800 bg-slate-900/80">
        <PixelSprite
          rows={PADLOCK_ROWS}
          palette={PADLOCK_COLORS}
          className="h-8"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h2>
          <RetroLabel
            label={locked.title}
            className="text-[10px] leading-snug whitespace-normal! text-slate-400 sm:text-xs"
          />
        </h2>
        <p className="font-mono text-xs text-slate-300">{locked.goal}</p>
        <p>
          <span className="sr-only">Coming soon</span>
          <RetroText text="COMING SOON" className="text-[8px] text-slate-400" />
        </p>
      </div>
    </li>
  );
}

export default function Hub({ save, isRecovered, onPlay }: HubProps) {
  return (
    <RetroPage>
      <main className="eo-fade-in relative z-10 mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <header className="flex flex-col items-center gap-3 pt-2 text-center">
          <h1 className="flex flex-col items-center gap-2">
            <span className="sr-only">Ever Onward</span>
            <RetroText
              text="EVER"
              className={`text-[min(11vw,3.25rem)] ${retroHeadingClass}`}
            />
            <RetroText
              text="ONWARD"
              className={`text-[min(11vw,3.25rem)] ${retroHeadingClass}`}
            />
          </h1>
          <p className="font-mono text-xs tracking-[0.2em] text-cyan-100 uppercase [text-shadow:1px_1px_0_#0b1233]">
            Little machines. One simple goal.
          </p>
          <RetroText
            text="SELECT A UNIVERSE"
            className="text-[10px] text-slate-300"
          />
        </header>
        {isRecovered && (
          <p
            role="status"
            className="border-4 border-amber-500 bg-amber-950/80 p-3 font-mono text-sm text-amber-100"
          >
            Your old save could not be read. We kept a backup and started fresh.
          </p>
        )}
        <ul className="flex flex-col gap-4">
          {PLAYABLE_UNIVERSES.map((def) =>
            isUniverseUnlocked(def, save) ? (
              <UniverseCard
                key={def.id}
                def={def}
                save={save}
                onPlay={onPlay}
              />
            ) : (
              <RequirementCard key={def.id} def={def} />
            )
          )}
          {LOCKED_UNIVERSES.map((locked) => (
            <LockedCard key={locked.id} locked={locked} />
          ))}
        </ul>
        <p className="text-center font-mono text-xs text-slate-300">
          More universes on the way. Your game saves on this device.
        </p>
        <footer className="mt-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 font-mono text-xs text-slate-200">
          <Link href="/ever-onward/versions" className={retroLinkClass}>
            v{EVER_ONWARD_VERSION} · what&apos;s new
          </Link>
          <Link href="/" className={retroLinkClass}>
            gentryriggen.com
          </Link>
        </footer>
      </main>
      <MusicToggle className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-3 z-30" />
    </RetroPage>
  );
}
