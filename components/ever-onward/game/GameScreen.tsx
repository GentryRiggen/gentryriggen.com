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
  isProjectId,
  manualAction,
  performAction,
  previewUpgrade,
  startProject,
  upgradeCost,
  waitingVisitors,
} from "@/lib/ever-onward/engine/engine";
import { describeChanges, formatGain } from "@/lib/ever-onward/engine/changes";
import { formatNumber } from "@/lib/ever-onward/engine/format";
import { primaryResourceId } from "@/lib/ever-onward/engine/pull";
import { upkeepRate } from "@/lib/ever-onward/engine/rate";
import { hasAnyUpgrade } from "@/lib/ever-onward/engine/ownedUpgrades";
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
import SoundControls from "../audio/SoundControls";
import useEverOnwardAudio from "../audio/useEverOnwardAudio";
import NarrationLayer from "../narration/NarrationLayer";
import { uiFor } from "../universes";
import scrollToTop from "../scrollToTop";
import type { LastBuy } from "../universes/types";
import ActionPanel from "./ActionPanel";
import CountdownBar from "./CountdownBar";
import { type Effect } from "./EffectFloater";
import EmberDialog from "./EmberDialog";
import EmberPanel from "./EmberPanel";
import EmberTip from "./EmberTip";
import EndingOverlay from "./EndingOverlay";
import MenuDialog, { type MenuTestMode } from "./MenuDialog";
import PhaseCutscene from "./PhaseCutscene";
import Resources from "./Resources";
import type { Spend } from "./SpendFloater";
import useCompactHud from "./useCompactHud";
import StickyHud, { FOLD_EASE } from "./StickyHud";
import LogToast from "./LogToast";
import StoryTicker from "./StoryTicker";
import TapButton from "./TapButton";
import UpgradeList, { upgradeElementId } from "./UpgradeList";
import UpgradesDialog from "./UpgradesDialog";
import UpgradesIcon from "./UpgradesIcon";
import VisitorCard from "./VisitorCard";
import CrtOverlay from "./retro/CrtOverlay";
import RetroHeading from "./retro/RetroHeading";
import {
  bodyClass,
  pixelFont,
  retroFocusClass,
  retroLabelClass,
  retroSecondaryButtonClass,
  pixelClass,
} from "./retro/retroStyles";
import type { Overlay } from "./useGame";
import { useNetRate } from "./useNetRate";
import { useNextUpgrade } from "./useNextUpgrade";
import { useReducedMotion } from "./useAnimatedNumber";

/** How long a later part's tap hint stays up, in seconds of play. */
const TAP_HINT_SECONDS = 150;

/** Space left between the HUD and an element scrolled to. */
const HUD_GAP = 12;

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
  /** Starts the universe again from its first part (the menu's Start over). */
  onStartOver: () => void;
  onLeave: () => void;
  currentSave: SaveData;
  onReplaceSave: (save: SaveData) => void;
  onDismissOverlay: () => void;
  /** Present for the owner only: Test mode in the Menu. */
  testMode?: MenuTestMode;
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
  onStartOver,
  onLeave,
  currentSave,
  onReplaceSave,
  onDismissOverlay,
  testMode,
}: GameScreenProps) {
  const { run } = universe;
  useEverOnwardAudio(def, run);
  const phase = def.phases[run.phase];
  const ui = uiFor(def.id);
  const { Scene, Opening } = ui;
  const EndingArt = ui.ending.Art;
  const label = prestigeLabel(def);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
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
  const [isUpgradesOpen, setIsUpgradesOpen] = useState(false);
  const upgradesButtonRef = useRef<HTMLButtonElement>(null);
  // What opened Your upgrades (the header button or "See all"), for focus.
  const upgradesOpenerRef = useRef<HTMLElement | null>(null);
  // A new part's intro covers everything: close the dialogs behind it.
  if (isEmberDialogOpen && overlay !== null) setIsEmberDialogOpen(false);
  if (isUpgradesOpen && overlay !== null) setIsUpgradesOpen(false);
  if (isMenuOpen && overlay !== null) setIsMenuOpen(false);
  // Anything modal (cutscene, ending, either dialog) makes the game behind it
  // inert: no clicks, no focus, hidden from screen readers.
  const isCovered =
    overlay !== null || isEmberDialogOpen || isUpgradesOpen || isMenuOpen;
  const showsUpgradesButton = hasAnyUpgrade(def, universe);

  const primaryId = primaryResourceId(def, run);
  const primaryValue = run.resources[primaryId] ?? 0;
  const primaryDef = def.resources.find((r) => r.id === primaryId);
  const primaryLabel = primaryDef?.label ?? primaryId;
  const { rate, trend } = useNetRate(
    primaryValue,
    primaryId,
    upkeepRate(def, run, primaryId)
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const isReduced = useReducedMotion();
  const next = useNextUpgrade(def, run);
  const [spend, setSpend] = useState<Spend | null>(null);
  const [effect, setEffect] = useState<Effect | null>(null);
  const [lastBuy, setLastBuy] = useState<LastBuy | null>(null);

  const { isCompact, isFolded, togglePeek } = useCompactHud(!run.complete);
  // The HUD's height goes into CSS variables on the root before the first
  // paint: `--eo-hud-now` (its height right now) pins the scene just below
  // it, and `--eo-hud-h` (its full, open height) spaces the page. The page's
  // spacing never changes while the bar folds or opens, so nothing jumps:
  // the details keep their natural height inside a shrinking clip, so the
  // open height is the bar's height plus whatever the clip hides right now.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const hud = hudRef.current;
    if (!root) return;
    if (!hud) {
      root.style.setProperty("--eo-hud-now", "0px");
      root.style.setProperty("--eo-hud-h", "0px");
      return;
    }
    const clip = hud.querySelector<HTMLElement>("[data-hud-clip]");
    const details = hud.querySelector<HTMLElement>("[data-hud-details]");
    const height = (el: HTMLElement | null) =>
      el ? el.getBoundingClientRect().height : 0;
    const measure = () => {
      const now = height(hud);
      const open = now - height(clip) + height(details);
      root.style.setProperty("--eo-hud-now", `${now}px`);
      root.style.setProperty("--eo-hud-h", `${open}px`);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(hud);
    if (details) observer.observe(details);
    return () => observer.disconnect();
  }, [run.complete]);

  // Opening a universe, or finishing one, starts at the top of the page.
  useLayoutEffect(() => {
    scrollToTop();
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [def.id]);
  const previousOverlay = useRef(overlay);
  useEffect(() => {
    if (previousOverlay.current === "ending" && overlay === null) {
      scrollToTop();
      if (mainRef.current) mainRef.current.scrollTop = 0;
    }
    previousOverlay.current = overlay;
  }, [overlay]);

  // Behind the game, overscroll and the iPad's spare pixels stay dark.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const before = [html.style.backgroundColor, body.style.backgroundColor];
    html.style.backgroundColor = "#02030a";
    body.style.backgroundColor = "#02030a";
    return () => {
      html.style.backgroundColor = before[0];
      body.style.backgroundColor = before[1];
    };
  }, []);

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

  // A tap names what it earned and what else it moved ("+3 resolve",
  // "Flame 42% → 57%"), so every tap shows its effect.
  const handleTap = (): string[] => {
    const lines = describeChanges(def, run, manualAction(def, run), primaryId);
    const gain = onTap();
    if (lines.length > 0) return lines;
    return gain > 0 ? [`+${formatGain(gain)}`] : [];
  };

  // A button press says what it changed up in the bar ("+75 power").
  const handleAction = (id: string) => {
    const after = isProjectId(def, id)
      ? startProject(def, run, id)
      : performAction(def, run, id);
    const lines = after === run ? [] : describeChanges(def, run, after);
    if (lines.length > 0)
      setEffect((e) => ({ id: (e?.id ?? 0) + 1, text: lines.join("\n") }));
    onAction(id);
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

  const handleOpenUpgrades = () => {
    const active = document.activeElement;
    upgradesOpenerRef.current =
      active instanceof HTMLElement && active !== document.body
        ? active
        : upgradesButtonRef.current;
    setIsUpgradesOpen(true);
  };
  const handleCloseUpgrades = useCallback(() => {
    setIsUpgradesOpen(false);
    window.setTimeout(() => {
      const opener = upgradesOpenerRef.current;
      (opener?.isConnected ? opener : upgradesButtonRef.current)?.focus();
    }, 0);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false);
    window.setTimeout(() => menuButtonRef.current?.focus(), 0);
  }, []);

  // Scrolls the one real scroller (main on wide screens, the page otherwise)
  // so the element sits just under the HUD. scrollIntoView would also move
  // the window on wide screens and tear the fixed layout.
  const scrollToElement = (element: HTMLElement | null) => {
    if (!element) return;
    const behavior = isReduced ? "auto" : "smooth";
    const hudHeight = hudRef.current?.offsetHeight ?? 0;
    const top = element.getBoundingClientRect().top;
    const main = mainRef.current;
    if (main && window.matchMedia("(min-width: 1024px)").matches) {
      main.scrollTo({
        top: main.scrollTop + top - hudHeight - HUD_GAP,
        behavior,
      });
      return;
    }
    const sceneHeight = sceneRef.current?.offsetHeight ?? 0;
    window.scrollTo({
      top: top + window.scrollY - hudHeight - sceneHeight - HUD_GAP,
      behavior,
    });
  };

  const handleSelectNext = () => {
    if (!next) return;
    scrollToElement(document.getElementById(upgradeElementId(next.upgrade.id)));
  };

  const handleSelectAlert = () => {
    scrollToElement(
      // The Coast keeps its oil in the lamp panel.
      rootRef.current?.querySelector<HTMLElement>('[data-testid="lm-lamp"]') ??
        rootRef.current?.querySelector<HTMLElement>(
          'section[aria-label="Actions"]'
        ) ??
        rootRef.current?.querySelector<HTMLElement>(
          '[data-testid="lm-alert"]'
        ) ??
        null
    );
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

  // Every part's tap does something new: say what, for its first minutes
  // (the very first part, until the button is learned).
  const phaseStart = run.transitions.at(-1)?.at ?? 0;
  const showsTapHint =
    !run.complete &&
    (run.phase === 0
      ? run.taps < 25
      : run.time - phaseStart < TAP_HINT_SECONDS);
  const countdown = def.countdown?.(run) ?? null;
  const goal = def.goalMeter?.(run) ?? null;
  const gauge = def.gauge?.(run) ?? null;
  const hasDetails = def.resources.some(
    (r) =>
      r.id !== primaryId &&
      (!r.phases || r.phases.includes(phase.id)) &&
      (goal || r.id !== countdown?.resourceId)
  );
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
      className={`${pixelFont.variable} dark [--eo-hud-h:6rem] relative isolate min-h-dvh touch-manipulation overflow-x-clip bg-[#02030a] pt-[var(--eo-hud-h)] text-amber-50 lg:flex lg:h-dvh lg:overflow-hidden lg:pt-0`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_30%,rgba(251,191,36,0.1),transparent_62%)]"
      >
        <CrtOverlay />
      </div>
      <div
        ref={sceneRef}
        inert={isCovered}
        data-folded={isFolded}
        className={`sticky top-[var(--eo-hud-now,var(--eo-hud-h))] z-20 w-full transition-[height,margin] ${FOLD_EASE} lg:top-0 lg:transition-none ${
          isFolded
            ? // Half height on screen; the margin keeps its full height in
              // the page so the content below never moves.
              "mb-[calc(max(24dvh,9rem)-max(12dvh,5.5rem))] h-[max(12dvh,5.5rem)]"
            : "h-[max(24dvh,9rem)]"
        } overflow-hidden border-b-4 border-amber-500/80 bg-slate-950 lg:h-dvh lg:w-[45%] lg:shrink-0 lg:border-r-4 lg:border-b-0`}
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
        ref={mainRef}
        inert={isCovered}
        className="mx-auto w-full max-w-xl lg:max-w-2xl space-y-4 px-4 pt-4 pb-[calc(10rem+env(safe-area-inset-bottom))] lg:h-dvh lg:overflow-y-auto lg:pt-[calc(var(--eo-hud-h)+1rem)]"
      >
        <header className="flex flex-col gap-3 sm:flex-row-reverse sm:items-start sm:justify-between">
          <div className="flex w-full shrink-0 justify-end gap-2 sm:w-auto [&_button]:rounded-none! [&_button]:border-2! [&_button]:shadow-[2px_2px_0_#78350f] [&_button]:active:translate-y-0.5">
            <SoundControls />
            {showsUpgradesButton && (
              <button
                ref={upgradesButtonRef}
                type="button"
                data-testid="lm-upgrades-button"
                aria-haspopup="dialog"
                aria-expanded={isUpgradesOpen}
                aria-label="Your upgrades"
                onClick={handleOpenUpgrades}
                className={`${retroSecondaryButtonClass} min-w-11 shrink-0 px-2.5!`}
              >
                <UpgradesIcon className="h-4" />
              </button>
            )}
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
                className={`${retroSecondaryButtonClass} min-w-11 shrink-0 gap-1.5 px-2.5! text-orange-200!`}
              >
                <ui.PrestigeIcon className="h-4" />
                <span aria-hidden="true">
                  {waitingEmbers > 0 ? `+${waitingEmbers}` : universe.embers}
                </span>
              </button>
            )}
            <button
              ref={menuButtonRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen(true)}
              className={`${retroSecondaryButtonClass} shrink-0`}
            >
              Menu
            </button>
          </div>
          <div>
            <p className={`${retroLabelClass} leading-normal`}>
              {def.title}
              <span aria-hidden="true">
                {" "}
                · Part {run.phase + 1}/{def.phases.length}
              </span>
              <span className="sr-only">
                , Part {run.phase + 1} of {def.phases.length}
              </span>
              {testMode && (testMode.speed != null || testMode.isJumping) && (
                <span
                  data-testid="eo-test-badge"
                  className="ml-2 bg-fuchsia-700 px-1 text-fuchsia-50"
                >
                  {testMode.isJumping
                    ? "Getting there…"
                    : `Test ${testMode.speed}×`}
                </span>
              )}
            </p>
            <RetroHeading as="h1" className="mt-2 text-base sm:text-lg">
              {phase.title}
            </RetroHeading>
          </div>
        </header>

        <StoryTicker
          def={def}
          run={run}
          endingIds={ui.ending.storyIds}
          isCovered={isCovered}
        />

        {showsEmberTip && (
          <EmberTip
            def={def}
            onShow={handleOpenEmbers}
            onDismiss={onDismissEmberTip}
          />
        )}

        {run.complete && (
          <EmberPanel
            def={def}
            universe={universe}
            onBuy={onBuyEmber}
            onRestart={onRestart}
          />
        )}
        {showsTapHint && (
          <p className={`${bodyClass} text-slate-300`}>
            <span aria-hidden="true" className="mr-2 text-amber-300">
              ▶︎
            </span>
            Tap the button at the bottom to{" "}
            {phase.tapDoes ?? phase.manualLabel.toLowerCase()}.
          </p>
        )}
        {ui.topPanels?.map((Panel, i) => (
          <Panel key={i} def={def} run={run} onAct={handleAction} />
        ))}
        {!run.complete && (
          <div className="space-y-2">
            <UpgradeList
              key={run.phase}
              def={def}
              run={run}
              onBuy={handleBuy}
              onShowBought={handleOpenUpgrades}
              pinnedId={next?.upgrade.id}
              compact
            />
          </div>
        )}
        <ActionPanel def={def} run={run} onAct={handleAction} />
        {ui.primaryPanels?.map((Panel, i) => (
          <Panel key={i} def={def} run={run} onAct={handleAction} />
        ))}
        {!goal && countdown && <CountdownBar view={countdown} />}
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
        {ui.panels.map((Panel, i) => (
          <Panel key={i} def={def} run={run} onAct={handleAction} />
        ))}
        {/* Below every button, so a warning that comes and goes never pushes
            one (Buy Oil, Steady) out from under the player's thumb. The HUD
            keeps a chip in sight and the gauge shows what is running out. */}
        {alert && (
          <p
            role="alert"
            data-testid="lm-alert"
            className={`${pixelClass} animate-pulse border-4 border-red-500 bg-red-950/90 p-3 text-[10px] leading-relaxed text-red-100 motion-reduce:animate-none`}
          >
            ⚠ {alert}
          </p>
        )}
        {hasDetails && (
          <details
            key={`${def.id}-${run.phase}`}
            className="border-2 border-slate-700 bg-slate-950/70 p-3"
          >
            <summary
              className={`min-h-8 cursor-pointer font-mono text-sm text-slate-300 ${retroFocusClass}`}
            >
              More details
            </summary>
            <div className="mt-3">
              <Resources
                def={def}
                run={run}
                primaryId={primaryId}
                hiddenIds={
                  !goal && countdown?.resourceId ? [countdown.resourceId] : []
                }
              />
            </div>
          </details>
        )}
        <p className="text-center font-mono text-xs text-slate-300">
          <Link
            href="/"
            className={`inline-flex min-h-11 items-center rounded px-1 py-1 underline decoration-slate-600 underline-offset-4 hover:text-amber-200 ${retroFocusClass}`}
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
          isCovered={isCovered}
          onTap={handleTap}
        />
      )}

      {!run.complete && (
        <StickyHud
          hudRef={hudRef}
          isCovered={isCovered}
          resourceId={primaryId}
          resourceLabel={primaryLabel}
          resourcePurpose={primaryDef?.purpose}
          value={primaryValue}
          rate={rate}
          trend={trend}
          spend={spend}
          effect={effect}
          next={next}
          goal={goal}
          gauge={gauge}
          alert={alert}
          onSelectNext={handleSelectNext}
          onSelectAlert={handleSelectAlert}
          isCompact={isCompact}
          isFolded={isFolded}
          onToggleCompact={togglePeek}
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

      {isMenuOpen && (
        <MenuDialog
          def={def}
          run={run}
          currentSave={currentSave}
          isBackupDisabled={overlay !== null || testMode?.speed != null}
          onLeave={onLeave}
          onReplaceSave={onReplaceSave}
          onStartOver={onStartOver}
          onClose={handleCloseMenu}
          testMode={testMode}
        />
      )}

      {isUpgradesOpen && (
        <UpgradesDialog
          def={def}
          universe={universe}
          onClose={handleCloseUpgrades}
        />
      )}

      <NarrationLayer def={def} run={run} isSuppressed={overlay !== null} />
      <LogToast run={run} isSuppressed={isCovered} />
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
