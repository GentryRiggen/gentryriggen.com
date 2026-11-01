"use client";

import Link from "next/link";
import { useState } from "react";
import { canRestart } from "@/lib/little-machines/engine/prestige";
import type {
  UniverseDef,
  UniverseSave,
} from "@/lib/little-machines/engine/types";
import { SCENES } from "../scenes";
import { cardClass, focusRingClass, secondaryButtonClass } from "../styles";
import EmberPanel from "./EmberPanel";
import EndingOverlay from "./EndingOverlay";
import PhaseOverlay from "./PhaseOverlay";
import Resources from "./Resources";
import StoryLog from "./StoryLog";
import TapButton from "./TapButton";
import UpgradeList from "./UpgradeList";
import type { Overlay } from "./useGame";

interface GameScreenProps {
  def: UniverseDef;
  universe: UniverseSave;
  overlay: Overlay;
  onTap: () => number;
  onBuy: (id: string) => void;
  onBuyEmber: (id: string) => void;
  onRestart: () => void;
  onLeave: () => void;
  onDismissOverlay: () => void;
}

/** Story ids that close the run, in the order they read. */
const ENDING_STORY_IDS = ["last-remember", "last-end-1", "last-end-2"];

export default function GameScreen({
  def,
  universe,
  overlay,
  onTap,
  onBuy,
  onBuyEmber,
  onRestart,
  onLeave,
  onDismissOverlay,
}: GameScreenProps) {
  const { run } = universe;
  const phase = def.phases[run.phase];
  const Scene = SCENES[def.id];
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isStorm = run.phase === 0 && (run.resources.storm ?? 0) > 0;
  const showsEmbers = run.complete || universe.embers > 0 || canRestart(run);

  const endingLines = ENDING_STORY_IDS.filter((id) =>
    run.story.includes(id)
  ).flatMap((id) => def.story.find((m) => m.id === id)?.text ?? []);

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:flex lg:h-dvh">
      <div className="sticky top-0 z-20 h-[36dvh] w-full overflow-hidden bg-slate-950 lg:h-dvh lg:w-[55%] lg:shrink-0">
        {Scene && <Scene run={run} />}
      </div>
      <main className="mx-auto w-full max-w-xl space-y-4 px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] lg:h-dvh lg:overflow-y-auto">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-600 dark:text-slate-400">
              {def.title} · Part {run.phase + 1} of {def.phases.length}
            </p>
            <h1 className="text-2xl font-bold">{phase.title}</h1>
          </div>
          <button
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls="lm-menu"
            onClick={() => setIsMenuOpen((open) => !open)}
            className={`${secondaryButtonClass} shrink-0`}
          >
            Menu
          </button>
        </header>

        {isMenuOpen && (
          <nav
            id="lm-menu"
            aria-label="Game menu"
            className={`${cardClass} space-y-3 p-4`}
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onLeave}
                className={secondaryButtonClass}
              >
                Back to all universes
              </button>
              <Link
                href="/little-machines/versions"
                className={secondaryButtonClass}
              >
                What&apos;s new
              </Link>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Your game saves on this device and pauses when you leave.
            </p>
            {!run.complete && showsEmbers && (
              <EmberPanel
                def={def}
                universe={universe}
                onBuy={onBuyEmber}
                onRestart={onRestart}
              />
            )}
          </nav>
        )}

        {run.complete ? (
          <EmberPanel
            def={def}
            universe={universe}
            onBuy={onBuyEmber}
            onRestart={onRestart}
          />
        ) : (
          <TapButton
            label={phase.manualLabel}
            isStorm={isStorm}
            onTap={onTap}
          />
        )}
        <Resources def={def} run={run} />
        <StoryLog def={def} run={run} />
        {!run.complete && (
          <UpgradeList key={run.phase} def={def} run={run} onBuy={onBuy} />
        )}
        <p className="text-center text-xs text-slate-500 dark:text-slate-500">
          <Link href="/" className={`rounded underline ${focusRingClass}`}>
            gentryriggen.com
          </Link>
        </p>
      </main>

      {overlay === "phase" && (
        <PhaseOverlay
          phase={phase}
          number={run.phase + 1}
          total={def.phases.length}
          onContinue={onDismissOverlay}
        />
      )}
      {overlay === "ending" && (
        <EndingOverlay lines={endingLines} onContinue={onDismissOverlay} />
      )}
    </div>
  );
}
