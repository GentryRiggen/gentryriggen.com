"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  canAfford,
  previewUpgrade,
  upgradeCost,
  waitingVisitors,
} from "@/lib/ever-onward/engine/engine";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import { primaryResourceId } from "@/lib/ever-onward/engine/pull";
import { upkeepRate } from "@/lib/ever-onward/engine/rate";
import {
  canRestart,
  emberReward,
  prestigeLabel,
  prestigeSingular,
} from "@/lib/ever-onward/engine/prestige";
import type {
  SaveData,
  UniverseDef,
  UniverseSave,
} from "@/lib/ever-onward/engine/types";
import PlayOnSilentToggle from "../audio/PlayOnSilentToggle";
import SoundControls from "../audio/SoundControls";
import useEverOnwardAudio from "../audio/useEverOnwardAudio";
import NarrationLayer from "../narration/NarrationLayer";
import NarrationSettings from "../narration/NarrationSettings";
import { uiFor } from "../universes";
import type { LastBuy } from "../universes/types";
import ActionPanel from "./ActionPanel";
import BackupPanel from "./BackupPanel";
import CountdownBar from "./CountdownBar";
import { type Effect } from "./EffectFloater";
import EmberDialog from "./EmberDialog";
import EmberPanel from "./EmberPanel";
import EmberTip from "./EmberTip";
import EndingOverlay from "./EndingOverlay";
import Logbook from "./Logbook";
import PhaseCutscene from "./PhaseCutscene";
import Resources from "./Resources";
import type { Spend } from "./SpendFloater";
import StickyHud from "./StickyHud";
import StoryTicker from "./StoryTicker";
import TapButton from "./TapButton";
import UpgradeList, { upgradeElementId } from "./UpgradeList";
import VisitorCard from "./VisitorCard";
import CrtOverlay from "./retro/CrtOverlay";
import RetroHeading from "./retro/RetroHeading";
import {
  bodyClass,
  pixelFont,
  retroFocusClass,
  retroLabelClass,
  retroPanelClass,
  retroSecondaryButtonClass,
  pixelClass,
} from "./retro/retroStyles";
import type { Overlay } from "./useGame";
import { useNetRate } from "./useNetRate";
import { useNextUpgrade } from "./useNextUpgrade";
import { useReducedMotion } from "./useAnimatedNumber";

interface GameScreenProps {
  def: UniverseDef;
  universe: UniverseSave;
  overlay: Overlay;
  onTap: () => number;
  onBuy: (id: string) => void;
  onAction: (id: string) => void;
  onGreet: (id: string) => void;
  onChooseLantern: (lantern: number) => void;
  onBuyEmber: (id: string) => void;
  onDismissEmberTip: () => void;
  onRestart: () => void;
  onLeave: () => void;
  currentSave: SaveData;
  onReplaceSave: (save: SaveData) => void;
  onDismissOverlay: () => void;
}

export default function GameScreen({
  def,
  universe,
  overlay,
  onTap,
  onBuy,
  onAction,
  onGreet,
  onChooseLantern,
  onBuyEmber,
  onDismissEmberTip,
  onRestart,
  onLeave,
  currentSave,
  onReplaceSave,
  onDismissOverlay,
}: GameScreenProps) {
  const { run } = universe;
  useEverOnwardAudio(def, run);
  const phase = def.phases[run.phase];
  const ui = uiFor(def.id);
  const { Scene, Opening } = ui;
  const EndingArt = ui.ending.Art;
  const label = prestigeLabel(def);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isStorm = ui.audio.isStormy?.(run) ?? false;
  // Once a restart is possible (or embers are banked) the header offers the
  // embers dialog. A finished run shows the panel in the page instead.
  const showsEmbersButton =
    !run.complete && (canRestart(run) || universe.embers > 0);
  const waitingEmbers = canRestart(run) ? emberReward(def, run) : 0;
  const showsEmberTip =
    !run.complete &&
    canRestart(run) &&
    !universe.hasSeenEmberTip &&
    overlay === null;
  const [isEmberDialogOpen, setIsEmberDialogOpen] = useState(false);
  const emberButtonRef = useRef<HTMLButtonElement>(null);
  // A new part's intro covers everything: close the dialog behind it.
  if (isEmberDialogOpen && overlay !== null) setIsEmberDialogOpen(false);

  const primaryId = primaryResourceId(def, run);
  const primaryValue = run.resources[primaryId] ?? 0;
  const primaryLabel =
    def.resources.find((r) => r.id === primaryId)?.label ?? primaryId;
  const { rate, trend } = useNetRate(
    primaryValue,
    primaryId,
    upkeepRate(def, run, primaryId)
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const isReduced = useReducedMotion();
  const next = useNextUpgrade(def, run);
  const [spend, setSpend] = useState<Spend | null>(null);
  const [effect, setEffect] = useState<Effect | null>(null);
  const [lastBuy, setLastBuy] = useState<LastBuy | null>(null);

  // The HUD's height goes into a CSS variable on the root before the first
  // paint, so the scene band and the page column sit exactly below it.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const hud = hudRef.current;
    if (!root) return;
    const setHeight = (px: number) =>
      root.style.setProperty("--eo-hud-h", `${px}px`);
    if (!hud) {
      setHeight(0);
      return;
    }
    setHeight(hud.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(hud.offsetHeight));
    observer.observe(hud);
    return () => observer.disconnect();
  }, [run.complete]);

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
      setLastBuy((b) => ({
        id: (b?.id ?? 0) + 1,
        upgradeId: id,
        n: (run.owned[id] ?? 0) + 1,
      }));
      const preview = previewUpgrade(def, run, id);
      if (preview)
        setEffect((e) => ({ id: (e?.id ?? 0) + 1, text: `${preview} ⬆` }));
    }
    onBuy(id);
  };

  const handleOpenEmbers = () => {
    onDismissEmberTip();
    setIsEmberDialogOpen(true);
  };
  const handleCloseEmbers = useCallback(() => {
    setIsEmberDialogOpen(false);
    // The dialog unmounts first; put focus back on the button that opened it.
    window.setTimeout(() => emberButtonRef.current?.focus(), 0);
  }, []);

  const handleSelectNext = () => {
    if (!next) return;
    document.getElementById(upgradeElementId(next.upgrade.id))?.scrollIntoView({
      behavior: isReduced ? "auto" : "smooth",
      block: "start",
    });
  };

  const handleGreet = (id: string) => {
    const visitor = waitingVisitors(def, run).find((v) => v.id === id);
    if (visitor)
      setEffect((e) => ({
        id: (e?.id ?? 0) + 1,
        text: `${visitor.name}: ${visitor.giftText(run)} ⬆`,
      }));
    onGreet(id);
  };

  const countdown = def.countdown?.(run) ?? null;
  const alert = def.alert?.(run) ?? null;
  const visitors = waitingVisitors(def, run);
  const storyText = new Map(def.story.map((m) => [m.id, m.text]));

  const endingLines = ui.ending.storyIds
    .filter((id) => run.story.includes(id))
    .flatMap((id) => def.story.find((m) => m.id === id)?.text ?? []);

  return (
    // `dark` keeps the game dark in both site themes, so the shared pieces
    // (sound switches, update pill) use their dark colours too.
    <div
      ref={rootRef}
      className={`${pixelFont.variable} dark [--eo-hud-h:6rem] relative isolate min-h-dvh touch-manipulation bg-[#02030a] pt-[var(--eo-hud-h)] text-amber-50 lg:flex lg:h-dvh lg:pt-0`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_30%,rgba(251,191,36,0.1),transparent_62%)]"
      >
        <CrtOverlay />
      </div>
      <div
        inert={overlay !== null}
        className="sticky top-[var(--eo-hud-h)] z-20 h-[24dvh] min-h-36 w-full lg:top-0 overflow-hidden border-b-4 border-amber-500/80 bg-slate-950 lg:h-dvh lg:w-[55%] lg:shrink-0 lg:border-r-4 lg:border-b-0"
      >
        <div data-testid="lm-scene-frame" className="h-full">
          <Scene run={run} lastBuy={lastBuy} />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          <CrtOverlay isSubtle />
        </div>
      </div>
      <main
        inert={overlay !== null}
        className="mx-auto w-full max-w-xl space-y-4 px-4 pt-4 pb-[calc(9.5rem+env(safe-area-inset-bottom))] lg:h-dvh lg:overflow-y-auto lg:pt-[calc(var(--eo-hud-h)+1rem)]"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className={`${retroLabelClass} leading-normal`}>
              {def.title}
              <span aria-hidden="true"> · </span>
              <span className="block text-slate-300">
                Part {run.phase + 1} of {def.phases.length}
              </span>
            </p>
            <RetroHeading as="h1" className="mt-2 text-base sm:text-lg">
              {phase.title}
            </RetroHeading>
          </div>
          <div className="flex shrink-0 gap-2 [&_button]:rounded-none! [&_button]:border-2! [&_button]:shadow-[2px_2px_0_#78350f] [&_button]:active:translate-y-0.5">
            <SoundControls />
            {showsEmbersButton && (
              <button
                ref={emberButtonRef}
                type="button"
                data-testid="lm-ember-button"
                aria-haspopup="dialog"
                aria-expanded={isEmberDialogOpen}
                aria-label={
                  waitingEmbers > 0
                    ? `${label}: ${waitingEmbers} waiting, ${universe.embers} saved`
                    : `${label}: ${universe.embers} saved`
                }
                onClick={handleOpenEmbers}
                className={`${retroSecondaryButtonClass} shrink-0 gap-1.5 px-2.5! text-orange-200!`}
              >
                <ui.PrestigeIcon className="h-4" />
                <span aria-hidden="true">
                  {waitingEmbers > 0 ? `+${waitingEmbers}` : universe.embers}
                </span>
              </button>
            )}
            <button
              type="button"
              aria-expanded={isMenuOpen}
              aria-controls="lm-menu"
              onClick={() => setIsMenuOpen((open) => !open)}
              className={`${retroSecondaryButtonClass} shrink-0`}
            >
              Menu
            </button>
          </div>
        </header>

        {isMenuOpen && (
          <nav
            id="lm-menu"
            aria-label="Game menu"
            className={`${retroPanelClass} space-y-3 p-4`}
          >
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onLeave}
                className={retroSecondaryButtonClass}
              >
                Back to all universes
              </button>
              <Link
                href="/ever-onward/versions"
                className={retroSecondaryButtonClass}
              >
                What&apos;s new
              </Link>
            </div>
            <p className="font-mono text-xs text-slate-300">
              Your game saves on this device and pauses when you leave.
            </p>
            <Logbook def={def} run={run} />
            <PlayOnSilentToggle />
            <NarrationSettings />
            <BackupPanel
              save={currentSave}
              isDisabled={overlay !== null}
              onReplaceSave={onReplaceSave}
            />
          </nav>
        )}

        <StoryTicker
          def={def}
          run={run}
          endingIds={ui.ending.storyIds}
          isCovered={overlay !== null}
        />

        {showsEmberTip && (
          <EmberTip
            def={def}
            onShow={handleOpenEmbers}
            onDismiss={onDismissEmberTip}
          />
        )}

        {run.complete ? (
          <EmberPanel
            def={def}
            universe={universe}
            onBuy={onBuyEmber}
            onRestart={onRestart}
          />
        ) : (
          <p className={`${bodyClass} text-slate-300`}>
            <span aria-hidden="true" className="mr-2 text-amber-300">
              ▶︎
            </span>
            Tap the button at the bottom to {phase.manualLabel.toLowerCase()}.
          </p>
        )}
        {visitors.map((v) => (
          <VisitorCard
            key={v.id}
            universeId={def.id}
            visitor={v}
            text={storyText.get(v.id) ?? ""}
            giftText={v.giftText(run)}
            onGreet={handleGreet}
          />
        ))}
        <ActionPanel def={def} run={run} onAct={onAction} />
        {ui.panels.map((Panel, i) => (
          <Panel key={i} def={def} run={run} onAct={onAction} />
        ))}
        {alert && (
          <p
            role="alert"
            data-testid="lm-alert"
            className={`${pixelClass} animate-pulse border-4 border-red-500 bg-red-950/90 p-3 text-[10px] leading-relaxed text-red-100 motion-reduce:animate-none`}
          >
            ⚠ {alert}
          </p>
        )}
        <Resources def={def} run={run} primaryId={primaryId} />
        {countdown && <CountdownBar view={countdown} />}
        {!run.complete && (
          <div className="space-y-2">
            <UpgradeList
              key={run.phase}
              def={def}
              run={run}
              onBuy={handleBuy}
            />
          </div>
        )}
        <p className="text-center font-mono text-xs text-slate-300">
          <Link
            href="/"
            className={`rounded px-1 py-1 underline decoration-slate-600 underline-offset-4 hover:text-amber-200 ${retroFocusClass}`}
          >
            gentryriggen.com
          </Link>
        </p>
      </main>

      {!run.complete && (
        <TapButton
          label={phase.manualLabel}
          look={ui.tapLooks[Math.min(run.phase, ui.tapLooks.length - 1)]}
          isStorm={isStorm}
          isCovered={overlay !== null}
          onTap={onTap}
        />
      )}

      {!run.complete && (
        <StickyHud
          hudRef={hudRef}
          isCovered={overlay !== null}
          resourceId={primaryId}
          resourceLabel={primaryLabel}
          value={primaryValue}
          rate={rate}
          trend={trend}
          spend={spend}
          effect={effect}
          next={next}
          alert={alert}
          onSelectNext={handleSelectNext}
        />
      )}

      {isEmberDialogOpen && (
        <EmberDialog
          def={def}
          universe={universe}
          onBuy={onBuyEmber}
          onRestart={onRestart}
          onClose={handleCloseEmbers}
        />
      )}

      <NarrationLayer def={def} run={run} isSuppressed={overlay !== null} />
      {overlay === "phase" && (
        <PhaseCutscene
          def={def}
          phaseIndex={run.phase}
          Scene={Scene}
          onContinue={onDismissOverlay}
          opening={
            // The very start of a run may ask the player to choose.
            Opening && run.phase === 0 && run.time === 0 ? (
              <Opening run={run} onChoose={onChooseLantern} />
            ) : undefined
          }
        />
      )}
      {overlay === "ending" && (
        <EndingOverlay
          lines={endingLines}
          embers={emberReward(def, run)}
          label={label}
          labelSingular={prestigeSingular(def)}
          Icon={ui.PrestigeIcon}
          art={EndingArt ? <EndingArt run={run} /> : undefined}
          afterword={ui.ending.afterword?.(currentSave) ?? null}
          onContinue={onDismissOverlay}
        />
      )}
    </div>
  );
}
