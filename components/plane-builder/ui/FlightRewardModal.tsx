"use client";

import { useEffect, useRef, useState } from "react";
import usePrefersReducedMotion from "@/components/ship-builder/hooks/usePrefersReducedMotion";
import { LEADERBOARDS_ENABLED } from "@/lib/plane-builder/state/leaderboardSync";
import { LEVELS } from "@/lib/plane-builder/levels";
import { comboMultiplier } from "@/lib/plane-builder/sim/flight";
import type { LevelId } from "@/lib/plane-builder/levels/types";
import {
  gaugeZone,
  greenHalf as greenHalfFor,
} from "@/lib/plane-builder/minigame/gauge";
import type { GaugeZone } from "@/lib/plane-builder/minigame/gauge";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import type { FlightSummary } from "@/lib/plane-builder/state/store";
import useLeaderboardStanding from "../hooks/useLeaderboardStanding";
import { planeSynth } from "../audio/planeSynth";
import { endLineFor } from "./endLines";
import FinishCard from "./FinishCard";
import FinishStanding from "./FinishStanding";
import { formatCoins, percentOf } from "./format";
import Leaderboards from "./Leaderboards";
import { cardClass, coinButtonClass, primaryButtonClass } from "./styles";
import TimingGauge from "./TimingGauge";

/** Reveal timeline after Stop, in ms. */
export const MULTIPLIER_AT = 300;
export const COUNT_START = 300;
export const REVEAL_END = 1200;

const BONUS_LABELS: Record<GaugeZone, string> = {
  green: "Jackpot!",
  yellow: "Nice!",
  red: "Kept your coins!",
};

const FOCUSABLE = "button:not([disabled])";

function isFocusedControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["BUTTON", "A", "INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

interface FlightRewardModalProps {
  levelId: LevelId;
  flight: FlightSummary;
  /** Off in tests and e2e by default; see LEADERBOARDS_ENABLED. */
  leaderboardsEnabled?: boolean;
}

/** After a flight: stop the coin gauge, watch the coins add up, continue. */
export default function FlightRewardModal({
  levelId,
  flight,
  leaderboardsEnabled = LEADERBOARDS_ENABLED,
}: FlightRewardModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const seeBoardRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const gaugePosition = useRef(0);
  const isReducedMotion = usePrefersReducedMotion();
  const claimCoinBonus = usePlaneBuilderStore((s) => s.claimCoinBonus);
  const dismiss = usePlaneBuilderStore((s) => s.dismissFlightReward);
  const greenHalf = usePlaneBuilderStore((s) =>
    greenHalfFor(s.progress.prestige.bonuses.clover)
  );
  const [elapsed, setElapsed] = useState(0);
  const [isBoardOpen, setIsBoardOpen] = useState(false);

  const { bonus, result, payout } = flight;
  const isDaily = usePlaneBuilderStore((s) => s.daily !== null);
  const { uid, standing } = useLeaderboardStanding(
    leaderboardsEnabled && result.finished && !isDaily,
    result.finished ? levelId : null
  );
  const hasBonus = bonus !== null;
  const time = isReducedMotion ? REVEAL_END : elapsed;
  const isDone = hasBonus && time >= REVEAL_END;
  const level = LEVELS[levelId];
  const percent = percentOf(result.distance, level.finishDistance);

  // Drives the reveal clock from the moment the bonus is claimed.
  useEffect(() => {
    if (!hasBonus) return;
    const startedAt = performance.now();
    let frame = 0;
    function tick(now: number) {
      const next = Math.min(REVEAL_END, now - startedAt);
      setElapsed(next);
      if (next < REVEAL_END) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hasBonus]);

  // Focus starts on the heading, not Stop: Space is the flight's boost key, so
  // a Space still held from the flight would otherwise "click" Stop on release.
  // A fresh press stops the gauge through the key handler (repeats are
  // ignored). Continue takes focus once the reveal is done.
  useEffect(() => {
    if (isDone) continueRef.current?.focus();
    else if (!hasBonus) headingRef.current?.focus();
  }, [hasBonus, isDone]);

  function handleStop() {
    if (hasBonus) return;
    const zone = gaugeZone(gaugePosition.current, greenHalf);
    planeSynth.play(zone === "green" ? "cheer" : "coin");
    claimCoinBonus(zone);
  }

  const latest = useRef({ handleStop, dismiss, hasBonus, isDone, isBoardOpen });
  useEffect(() => {
    latest.current = { handleStop, dismiss, hasBonus, isDone, isBoardOpen };
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // The leaderboards sit on top and handle their own keys.
      if (latest.current.isBoardOpen) return;
      if (event.key === "Tab") {
        const items = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
        );
        if (items.length === 0) {
          event.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        const isInside =
          active instanceof Node && dialogRef.current?.contains(active);
        if (!isInside || (event.shiftKey && active === first)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key !== " " && event.key !== "Enter") return;
      if (event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // A focused button handles Space and Enter itself.
      if (isFocusedControl(event.target)) return;
      event.preventDefault();
      const state = latest.current;
      if (!state.hasBonus) state.handleStop();
      else if (state.isDone) state.dismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const extra = bonus?.extra ?? 0;
  const countShare = Math.min(
    1,
    Math.max(0, (time - COUNT_START) / (REVEAL_END - COUNT_START))
  );
  const shownTotal = Math.round(payout.total + extra * countShare);
  const bonusLabel = bonus ? BONUS_LABELS[bonus.zone] : "";

  return (
    <>
      <div
        inert={isBoardOpen}
        className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/40 p-4"
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="flight-reward-title"
          className={`flex max-h-full w-full max-w-sm flex-col gap-2 overflow-y-auto p-4 text-center ${cardClass}`}
        >
          {result.finished ? <FinishCard unlocked={flight.unlocked} /> : null}
          <h2
            ref={headingRef}
            id="flight-reward-title"
            tabIndex={-1}
            className="text-xl font-bold focus:outline-none"
          >
            {endLineFor(result.endReason)}
            {flight.isNewBest ? (
              <span className="ml-2 font-extrabold text-sky-700 dark:text-sky-300">
                New best!
              </span>
            ) : null}
          </h2>
          <p className="text-2xl font-extrabold">
            {Math.round(result.distance)} m{" "}
            <span className="text-base font-semibold text-slate-600 dark:text-slate-300">
              ({percent}% of the way)
            </span>
          </p>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
            <span aria-hidden="true">🪙 </span>
            Coins earned +{formatCoins(payout.total)}
          </p>
          {(result.nearMisses ?? 0) > 0 ? (
            <p
              data-testid="reward-near-misses"
              className="text-base font-bold text-sky-800 dark:text-sky-200"
            >
              <span aria-hidden="true">🔥 </span>
              Close calls {result.nearMisses}
              <span aria-hidden="true"> · </span>
              <span className="sr-only">, </span>
              Best combo ×{comboMultiplier(result.bestCombo ?? 0)}
              {(payout.nearMissEarned ?? 0) > 0 && payout.total > 0 ? (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">, </span>+
                  {formatCoins(payout.nearMissEarned ?? 0)} coins
                </>
              ) : null}
            </p>
          ) : null}
          <TimingGauge
            isRunning={!hasBonus}
            positionRef={gaugePosition}
            ariaLabel="Coin bonus timing"
            greenHalf={greenHalf}
          />
          {bonus && time >= MULTIPLIER_AT ? (
            <>
              <p
                data-testid="reward-multiplier"
                className="pb-pop text-xl font-extrabold text-emerald-700 dark:text-emerald-300"
              >
                {bonusLabel} ×{bonus.multiplier}
              </p>
              <p
                data-testid="reward-total"
                aria-hidden="true"
                className="pb-pop text-4xl font-extrabold text-amber-700 dark:text-amber-300"
              >
                Total +{formatCoins(shownTotal)}
              </p>
            </>
          ) : null}
          <p aria-live="polite" className="sr-only">
            {isDone && bonus
              ? `${bonusLabel} Coins times ${bonus.multiplier}. Total ${formatCoins(payout.total + extra)} coins.`
              : null}
          </p>
          {bonus ? (
            isDone ? (
              <button
                ref={continueRef}
                type="button"
                onClick={dismiss}
                className={`${primaryButtonClass} pb-pop min-h-14 text-2xl font-extrabold`}
              >
                Continue
              </button>
            ) : null
          ) : (
            <button
              ref={stopRef}
              type="button"
              onClick={handleStop}
              className={`${coinButtonClass} min-h-14 text-2xl font-extrabold`}
            >
              Stop!
            </button>
          )}
          {hasBonus && result.finished && uid !== null && standing ? (
            <FinishStanding
              levelId={levelId}
              standing={standing}
              buttonRef={seeBoardRef}
              onOpenBoard={() => setIsBoardOpen(true)}
            />
          ) : null}
        </div>
      </div>
      {isBoardOpen && uid !== null ? (
        <Leaderboards
          uid={uid}
          initialTab="world"
          initialWorld={levelId}
          onClose={() => {
            setIsBoardOpen(false);
            // Inert may have blurred the button; put focus back on purpose.
            requestAnimationFrame(() => seeBoardRef.current?.focus());
          }}
        />
      ) : null}
    </>
  );
}
