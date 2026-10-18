"use client";

import { useEffect, useRef, useState } from "react";
import { fetchBoard } from "@/lib/leaderboard/client";
import { randomNickname } from "@/lib/leaderboard/nickname";
import { SCORE_PRESTIGE_UNIT } from "@/lib/leaderboard/types";
import type { BoardKind, LeaderboardRow } from "@/lib/leaderboard/types";
import { LEVEL_ORDER, LEVELS } from "@/lib/plane-builder/levels";
import type { LevelId } from "@/lib/plane-builder/levels/types";
import { requestLeaderboardSubmit } from "@/lib/plane-builder/state/leaderboardSync";
import { usePlaneBuilderStore } from "@/lib/plane-builder/state/store";
import {
  cardClass,
  focusRingClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "./styles";
import { medalFor } from "./standing";

type Tab = "prestige" | "fastestRun" | "world";

const TABS: { id: Tab; label: string }[] = [
  { id: "prestige", label: "Prestige" },
  { id: "fastestRun", label: "Fastest run" },
  { id: "world", label: "Per world" },
];

const FOCUSABLE = "button:not([disabled]), select";

interface LeaderboardsProps {
  /** The signed-in anonymous uid, used to highlight your own row. */
  uid: string;
  onClose: () => void;
  /** Which tab to open on; defaults to prestige. */
  initialTab?: Tab;
  /** Which world to open the per-world tab on; defaults to the first. */
  initialWorld?: LevelId;
}

/** Row values are displayed as text only; nicknames come from the database. */
function formatValue(tab: Tab, value: number): string {
  if (tab === "prestige") {
    const level = Math.floor(value / SCORE_PRESTIGE_UNIT);
    const km = (value % SCORE_PRESTIGE_UNIT) / 1000;
    return `⭐ ${level} · ${km.toFixed(1)} km`;
  }
  if (tab === "fastestRun") {
    return `${value} ${value === 1 ? "flight" : "flights"}`;
  }
  return `${value.toFixed(1)} s`;
}

interface Loaded {
  key: string;
  rows: LeaderboardRow[] | null;
}

export default function Leaderboards({
  uid,
  onClose,
  initialTab = "prestige",
  initialWorld = LEVEL_ORDER[0],
}: LeaderboardsProps) {
  const nickname = usePlaneBuilderStore((s) => s.progress.nickname);
  const setNickname = usePlaneBuilderStore((s) => s.setNickname);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [world, setWorld] = useState<LevelId>(initialWorld);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const latestClose = useRef(onClose);

  useEffect(() => {
    latestClose.current = onClose;
  });

  // First use of the leaderboards gives the player a generated name.
  useEffect(() => {
    if (usePlaneBuilderStore.getState().progress.nickname === null) {
      usePlaneBuilderStore.getState().setNickname(randomNickname());
      requestLeaderboardSubmit();
    }
  }, []);

  const key = tab === "world" ? `world:${world}` : tab;
  useEffect(() => {
    let isCancelled = false;
    const kind: BoardKind = tab === "world" ? { world } : tab;
    fetchBoard(kind)
      .then((rows) => {
        if (!isCancelled) setLoaded({ key, rows });
      })
      .catch(() => {
        if (!isCancelled) setLoaded({ key, rows: null });
      });
    return () => {
      isCancelled = true;
    };
  }, [tab, world, key]);

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        latestClose.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      );
      if (items.length === 0) return;
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
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previous instanceof HTMLElement && document.contains(previous)) {
        previous.focus();
      }
    };
  }, []);

  // Data for a different tab is stale: treat it as still loading.
  const current = loaded !== null && loaded.key === key ? loaded : null;

  // Bring your own row into view once the board is there.
  const hasRows = current !== null && current.rows !== null;
  useEffect(() => {
    if (!hasRows) return;
    dialogRef.current
      ?.querySelector("[data-own='true']")
      ?.scrollIntoView?.({ block: "center" });
  }, [hasRows, key]);

  const handleReroll = () => {
    setNickname(randomNickname());
    requestLeaderboardSubmit();
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-stretch justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboards-title"
        className={`flex h-full w-full flex-col overflow-hidden p-4 sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:p-5 ${cardClass} rounded-none sm:rounded-2xl`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="leaderboards-title" className="text-xl font-bold">
            🏆 Leaderboards
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={secondaryButtonClass}
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sky-50 p-3 dark:bg-slate-800">
          <p>
            You are <strong data-testid="my-nickname">{nickname ?? "…"}</strong>
          </p>
          <button
            type="button"
            onClick={handleReroll}
            className={primaryButtonClass}
          >
            New name 🎲
          </button>
        </div>

        <div role="tablist" aria-label="Board" className="mt-3 flex gap-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-semibold ${focusRingClass} ${
                tab === id
                  ? "bg-sky-600 text-white dark:bg-sky-500"
                  : "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "world" ? (
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
            World
            <select
              value={world}
              onChange={(event) => setWorld(event.target.value as LevelId)}
              className={`min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-base dark:border-slate-600 dark:bg-slate-800 ${focusRingClass}`}
            >
              {LEVEL_ORDER.map((id) => (
                <option key={id} value={id}>
                  {LEVELS[id].name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {!current ? (
            <p role="status" className="py-6 text-center">
              Loading…
            </p>
          ) : current.rows === null ? (
            <p role="alert" className="py-6 text-center">
              Couldn&apos;t load the board. Try again in a bit.
            </p>
          ) : current.rows.length === 0 ? (
            <p className="py-6 text-center">
              No one is here yet. Be the first!
            </p>
          ) : (
            <ol className="space-y-1">
              {current.rows.map((row, index) => (
                <li
                  key={row.uid}
                  data-own={row.uid === uid ? "true" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                    row.uid === uid
                      ? "bg-amber-100 font-bold dark:bg-amber-900/60"
                      : "odd:bg-slate-50 dark:odd:bg-slate-800/60"
                  }`}
                >
                  <span className="w-8 shrink-0 tabular-nums">
                    {medalFor(index + 1) ? (
                      <>
                        <span aria-hidden="true">{medalFor(index + 1)}</span>
                        <span className="sr-only">{index + 1}</span>
                      </>
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {row.nickname}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatValue(tab, row.value)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
