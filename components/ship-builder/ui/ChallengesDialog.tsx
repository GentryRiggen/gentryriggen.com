"use client";

import { Play, X } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  CHALLENGES,
  starsFor,
} from "@/lib/ship-builder/challenges/definitions";
import {
  describeGoal,
  describeValue,
} from "@/lib/ship-builder/challenges/format";
import {
  bestValue,
  designKeyOf,
  totalStars,
} from "@/lib/ship-builder/challenges/progress";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { challengeProgress } from "@/lib/ship-builder/challenges/progressStore";
import ChallengeStars from "./ChallengeStars";
import ShipLeaderboard from "./ShipLeaderboard";
import { buttonClass, panelClass, primaryButtonClass } from "./styles";
import trapTab from "./trapTab";

interface ChallengesDialogProps {
  onClose: () => void;
}

type Tab = "challenges" | "board";

const TAB_CLASS =
  "min-h-11 flex-1 touch-manipulation rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:focus-visible:outline-sky-400";
const TAB_ON_CLASS = "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200";
const TAB_OFF_CLASS =
  "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";

/**
 * The Challenges panel: each goal with the stars this ship has earned and a
 * button that runs its trial, plus the leaderboard of total stars.
 */
export default function ChallengesDialog({ onClose }: ChallengesDialogProps) {
  const [tab, setTab] = useState<Tab>("challenges");
  const progress = challengeProgress.useValue();
  const savedId = useShipBuilderStore((s) => s.savedId);
  const shipName = useShipBuilderStore((s) => s.ship.name);
  const startChallenge = useShipBuilderStore((s) => s.startChallenge);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const designKey = designKeyOf(savedId);
  const total = totalStars(progress);

  const handleDocumentKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Tab" && dialogRef.current) {
      trapTab(dialogRef.current, event);
    }
  });

  useEffect(() => {
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      handleDocumentKeyDown(event);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleRun(id: (typeof CHALLENGES)[number]["id"]) {
    onClose();
    startChallenge(id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Challenges"
        className={`flex max-h-[90dvh] w-full max-w-lg flex-col rounded-lg border p-4 shadow-xl ${panelClass}`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Challenges</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <span data-testid="total-stars">{total}</span>{" "}
              {total === 1 ? "star" : "stars"} across all your ships
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className={`${buttonClass} min-h-11`}
          >
            <X aria-hidden="true" className="h-4 w-4 shrink-0" />
            Close
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Challenges view"
          className="mb-3 flex gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-800"
        >
          {(
            [
              ["challenges", "Challenges"],
              ["board", "Leaderboard"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`${TAB_CLASS} ${tab === id ? TAB_ON_CLASS : TAB_OFF_CLASS}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 overflow-y-auto">
          {tab === "board" ? (
            <ShipLeaderboard />
          ) : (
            <>
              <p className="mb-2 truncate text-sm font-medium">
                Stars for {shipName || "this ship"}
              </p>
              <ul className="space-y-2">
                {CHALLENGES.map((challenge) => {
                  const best = bestValue(progress, designKey, challenge.id);
                  const stars =
                    best === null ? 0 : starsFor(challenge.id, best);
                  const goal = describeGoal(challenge.id, best ?? -1);
                  return (
                    <li
                      key={challenge.id}
                      className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                          {challenge.title}
                        </h3>
                        <ChallengeStars stars={stars} />
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {challenge.blurb}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {best === null
                          ? "Not tried yet."
                          : `Best: ${describeValue(challenge.id, best)}.`}
                        {goal ? ` Next star: ${goal.toLowerCase()}.` : ""}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRun(challenge.id)}
                        className={`${primaryButtonClass} min-h-11 self-start`}
                      >
                        <Play aria-hidden="true" className="h-4 w-4 shrink-0" />
                        {best === null ? "Start" : "Try again"}
                        <span className="sr-only"> {challenge.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {designKey === "unsaved" && (
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                  Save this ship to keep its stars with it.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
