"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  canAfford,
  previewUpgrade,
  upgradeCost,
} from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import { primaryResourceId } from "@/lib/ever-onward/engine/pull";
import { upkeepRate } from "@/lib/ever-onward/engine/rate";
import { canRestart } from "@/lib/ever-onward/engine/prestige";
import type {
  SaveData,
  UniverseDef,
  UniverseSave,
} from "@/lib/ever-onward/engine/types";
import SoundControls from "../audio/SoundControls";
import useEverOnwardAudio from "../audio/useEverOnwardAudio";
import { SCENES } from "../scenes";
import { cardClass, focusRingClass, secondaryButtonClass } from "../styles";
import ActionPanel from "./ActionPanel";
import BackupPanel from "./BackupPanel";
import { type Effect } from "./EffectFloater";
import EmberPanel from "./EmberPanel";
import EndingOverlay from "./EndingOverlay";
import NextUpgradeBar from "./NextUpgradeBar";
import PhaseOverlay from "./PhaseOverlay";
import Resources from "./Resources";
import type { Spend } from "./SpendFloater";
import StickyHud from "./StickyHud";
import StoryLog from "./StoryLog";
import TapButton from "./TapButton";
import UpgradeList, { upgradeElementId } from "./UpgradeList";
import type { Overlay } from "./useGame";
import { useNetRate } from "./useNetRate";
import { useNextUpgrade } from "./useNextUpgrade";
import { useOutOfView } from "./useOutOfView";
import { useReducedMotion } from "./useAnimatedNumber";

interface GameScreenProps {
  def: UniverseDef;
  universe: UniverseSave;
  overlay: Overlay;
  onTap: () => number;
  onBuy: (id: string) => void;
  onAction: (id: string) => void;
  onBuyEmber: (id: string) => void;
  onRestart: () => void;
  onLeave: () => void;
  currentSave: SaveData;
  onReplaceSave: (save: SaveData) => void;
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
  onAction,
  onBuyEmber,
  onRestart,
  onLeave,
  currentSave,
  onReplaceSave,
  onDismissOverlay,
}: GameScreenProps) {
  const { run } = universe;
  useEverOnwardAudio(def, run);
  const phase = def.phases[run.phase];
  const Scene = SCENES[def.id];
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isStorm = run.phase === 0 && (run.resources.storm ?? 0) > 0;
  const showsEmbers = run.complete || universe.embers > 0 || canRestart(run);

  const primaryId = primaryResourceId(def, run);
  const primaryValue = run.resources[primaryId] ?? 0;
  const primaryLabel =
    def.resources.find((r) => r.id === primaryId)?.label ?? primaryId;
  const { rate, trend } = useNetRate(
    primaryValue,
    primaryId,
    upkeepRate(def, run, primaryId)
  );
  const readoutRef = useRef<HTMLDivElement>(null);
  // On phones the scene (36% of the screen) covers the top of the page.
  const isHudShown = useOutOfView(readoutRef, "36%");
  const isReduced = useReducedMotion();
  const next = useNextUpgrade(def, run);
  const [spend, setSpend] = useState<Spend | null>(null);
  const [effect, setEffect] = useState<Effect | null>(null);

  useEffect(() => {
    if (!spend) return;
    const timer = window.setTimeout(() => setSpend(null), 900);
    return () => window.clearTimeout(timer);
  }, [spend]);

  useEffect(() => {
    if (!effect) return;
    const timer = window.setTimeout(() => setEffect(null), 2600);
    return () => window.clearTimeout(timer);
  }, [effect]);

  const handleBuy = (id: string) => {
    const upgrade = def.upgrades.find((u) => u.id === id);
    if (upgrade && upgrade.currency === primaryId && canAfford(run, upgrade)) {
      const text = `-${formatNumber(upgradeCost(run, upgrade))}`;
      setSpend((s) => ({ id: (s?.id ?? 0) + 1, text }));
    }
    if (upgrade && canAfford(run, upgrade)) {
      const preview = previewUpgrade(def, run, id);
      if (preview)
        setEffect((e) => ({ id: (e?.id ?? 0) + 1, text: `${preview} ⬆` }));
    }
    onBuy(id);
  };

  const handleSelectNext = () => {
    if (!next) return;
    document.getElementById(upgradeElementId(next.upgrade.id))?.scrollIntoView({
      behavior: isReduced ? "auto" : "smooth",
      block: "center",
    });
  };

  const endingLines = ENDING_STORY_IDS.filter((id) =>
    run.story.includes(id)
  ).flatMap((id) => def.story.find((m) => m.id === id)?.text ?? []);

  return (
    <div className="min-h-dvh touch-manipulation bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:flex lg:h-dvh">
      <div
        inert={overlay !== null}
        className="sticky top-0 z-20 h-[36dvh] w-full overflow-hidden bg-slate-950 lg:h-dvh lg:w-[55%] lg:shrink-0"
      >
        {Scene && <Scene run={run} />}
      </div>
      <main
        inert={overlay !== null}
        className="mx-auto w-full max-w-xl space-y-4 px-4 pt-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] lg:h-dvh lg:overflow-y-auto"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-600 dark:text-slate-400">
              {def.title} · Part {run.phase + 1} of {def.phases.length}
            </p>
            <h1 className="text-2xl font-bold">{phase.title}</h1>
          </div>
          <div className="flex shrink-0 gap-2">
            <SoundControls />
            <button
              type="button"
              aria-expanded={isMenuOpen}
              aria-controls="lm-menu"
              onClick={() => setIsMenuOpen((open) => !open)}
              className={`${secondaryButtonClass} shrink-0`}
            >
              Menu
            </button>
          </div>
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
                href="/ever-onward/versions"
                className={secondaryButtonClass}
              >
                What&apos;s new
              </Link>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Your game saves on this device and pauses when you leave.
            </p>
            <BackupPanel
              save={currentSave}
              isDisabled={overlay !== null}
              onReplaceSave={onReplaceSave}
            />
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
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tap the button at the bottom right to{" "}
            {phase.manualLabel.toLowerCase()}.
          </p>
        )}
        <ActionPanel def={def} run={run} onAct={onAction} />
        <Resources
          def={def}
          run={run}
          primaryId={primaryId}
          rate={rate}
          trend={trend}
          spend={spend}
          effect={effect}
          primaryRef={readoutRef}
        />
        <StoryLog def={def} run={run} />
        {!run.complete && (
          <div className="space-y-2">
            {next && (
              <NextUpgradeBar
                next={next}
                onSelect={handleSelectNext}
                testId="lm-next"
              />
            )}
            <UpgradeList
              key={run.phase}
              def={def}
              run={run}
              onBuy={handleBuy}
            />
          </div>
        )}
        <p className="text-center text-xs text-slate-500 dark:text-slate-500">
          <Link href="/" className={`rounded underline ${focusRingClass}`}>
            gentryriggen.com
          </Link>
        </p>
      </main>

      {!run.complete && (
        <TapButton
          label={phase.manualLabel}
          phase={run.phase}
          isStorm={isStorm}
          isCovered={overlay !== null}
          onTap={onTap}
        />
      )}

      {!run.complete && (
        <StickyHud
          isShown={isHudShown}
          isCovered={overlay !== null}
          resourceId={primaryId}
          resourceLabel={primaryLabel}
          value={primaryValue}
          rate={rate}
          trend={trend}
          spend={spend}
          effect={effect}
          next={next}
          onSelectNext={handleSelectNext}
        />
      )}

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
