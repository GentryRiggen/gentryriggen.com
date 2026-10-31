"use client";

import { useEffect, useState } from "react";
import {
  banAndDeleteEverywhere,
  deleteBoardEntry,
  fetchAdminBoard,
  fetchAdminBoardHidden,
  fetchAdminSeason,
  renameBoardEntry,
  setBoardHidden,
  startNewSeason,
  type AdminBoardRow,
} from "@/lib/firebase/client";
import type { SeasonGame, SeasonInfo } from "@/lib/leaderboard/season";
import { randomNickname } from "@/lib/leaderboard/nickname";

interface SeasonBoardAdminProps {
  game: SeasonGame;
}

const GAME_NAMES: Record<SeasonGame, string> = {
  plane: "Plane Builder",
  ship: "Ship Builder",
};

const SAVE_ERROR = "Couldn't save that change.";
const LOAD_ERROR = "Couldn't load the leaderboard.";

const buttonClass =
  "rounded-md border px-2 py-1 disabled:opacity-50 border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800";
const dangerClass =
  "rounded-md border px-2 py-1 disabled:opacity-50 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950";

/** The result of loading one season's board: its rows, or null on failure. */
interface LoadedBoard {
  season: number;
  rows: AdminBoardRow[] | null;
}

/**
 * One game's board for the admin: its seasons, the top entries of a chosen
 * season, and tools to rename, delete or ban. Everything shown from an entry
 * was written by a player, so it is rendered as text only.
 */
export default function SeasonBoardAdmin({ game }: SeasonBoardAdminProps) {
  const gameName = GAME_NAMES[game];
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [board, setBoard] = useState<LoadedBoard | null>(null);
  const [seasonFailed, setSeasonFailed] = useState(false);
  /** Bumped by Try again to read the season (and switch) once more. */
  const [seasonAttempt, setSeasonAttempt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    let isCancelled = false;
    fetchAdminSeason(game)
      .then((info) => {
        if (isCancelled) return;
        setSeason(info);
        setSelected(info.number);
      })
      .catch(() => {
        if (!isCancelled) setSeasonFailed(true);
      });
    if (game === "plane") {
      // On failure the switch stays disabled and unchecked (hidden === null).
      fetchAdminBoardHidden("plane")
        .then((value) => {
          if (!isCancelled) setHidden(value);
        })
        .catch(() => {});
    }
    return () => {
      isCancelled = true;
    };
  }, [game, seasonAttempt]);

  const retrySeason = () => {
    setSeasonFailed(false);
    setSeasonAttempt((n) => n + 1);
  };

  useEffect(() => {
    if (selected === null) return;
    let isCancelled = false;
    fetchAdminBoard(game, selected)
      .then((rows) => {
        if (!isCancelled) setBoard({ season: selected, rows });
      })
      .catch(() => {
        if (!isCancelled) setBoard({ season: selected, rows: null });
      });
    return () => {
      isCancelled = true;
    };
  }, [game, selected]);

  /** Runs a write; on refusal shows the save error and returns false. */
  const save = async (write: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setSaveError(null);
    try {
      await write();
      return true;
    } catch {
      setSaveError(SAVE_ERROR);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const removeRow = (uid: string) =>
    setBoard((current) =>
      current?.rows
        ? { ...current, rows: current.rows.filter((r) => r.uid !== uid) }
        : current
    );

  const handleStartSeason = async () => {
    if (!season) return;
    const next = season.number + 1;
    const message = `Start Season ${next} for ${gameName}? Everyone starts from zero. Season ${season.number} stays viewable.`;
    if (!window.confirm(message)) return;
    let started: number | null = null;
    // Refused when the stored season is no longer the one shown (started
    // elsewhere); either way, reload the season as it now stands.
    await save(async () => {
      started = await startNewSeason(game, season.number);
    });
    try {
      const info = await fetchAdminSeason(game);
      setSeason(info);
      setSelected(info.number);
    } catch {
      if (started !== null) {
        setSeason({ number: started, startedAt: null });
        setSelected(started);
      }
    }
  };

  const handleRename = async (row: AdminBoardRow, shown: number) => {
    if (!window.confirm(`Give ${row.nickname} a new random name?`)) return;
    const nickname = randomNickname();
    const ok = await save(() =>
      renameBoardEntry(game, shown, row.uid, nickname)
    );
    if (!ok) return;
    setBoard((current) =>
      current?.rows
        ? {
            ...current,
            rows: current.rows.map((r) =>
              r.uid === row.uid ? { ...r, nickname } : r
            ),
          }
        : current
    );
  };

  const handleDelete = async (row: AdminBoardRow, shown: number) => {
    const message = `Remove ${row.nickname} from Season ${shown}? They'll climb back as they keep playing.`;
    if (!window.confirm(message)) return;
    if (await save(() => deleteBoardEntry(game, shown, row.uid))) {
      removeRow(row.uid);
    }
  };

  const handleBan = async (row: AdminBoardRow) => {
    const message = `Ban ${row.nickname}? They'll be removed from every board in both games and can't post again.`;
    if (!window.confirm(message)) return;
    if (await save(() => banAndDeleteEverywhere(row.uid))) {
      removeRow(row.uid);
    }
  };

  const handleShowChange = async (show: boolean) => {
    const previous = hidden;
    setHidden(!show);
    if (!(await save(() => setBoardHidden("plane", !show)))) {
      setHidden(previous);
    }
  };

  const titleId = `season-board-admin-${game}`;
  const current = board !== null && board.season === selected ? board : null;
  const loading = !seasonFailed && current === null;
  const loadFailed = seasonFailed || current?.rows === null;
  const rows = current?.rows ?? null;
  const shownSeason = current?.season ?? 0;
  const seasonNumbers = season
    ? Array.from({ length: season.number }, (_, i) => season.number - i)
    : [];

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
    >
      <h2
        id={titleId}
        className="text-sm font-medium text-gray-600 dark:text-gray-400"
      >
        {gameName} leaderboard
      </h2>
      {season && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <p className="text-gray-900 dark:text-gray-100">
            {season.startedAt
              ? `Season ${season.number}, started ${season.startedAt.toLocaleDateString()}`
              : `Season ${season.number}`}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleStartSeason()}
            className={buttonClass}
          >
            Start new season
          </button>
          <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            Season
            <select
              value={selected ?? season.number}
              onChange={(e) => setSelected(Number(e.target.value))}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {seasonNumbers.map((n) => (
                <option key={n} value={n}>
                  Season {n}
                </option>
              ))}
            </select>
          </label>
          {game === "plane" && (
            <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={hidden === false}
                disabled={hidden === null || busy}
                onChange={(e) => void handleShowChange(e.target.checked)}
                className="h-4 w-4 accent-blue-600 dark:accent-blue-400"
              />
              Show leaderboard to players
            </label>
          )}
        </div>
      )}
      {(loadFailed || saveError) && (
        <p role="alert" className="mt-2 text-red-600 dark:text-red-400">
          {[loadFailed && LOAD_ERROR, saveError].filter(Boolean).join(" ")}
        </p>
      )}
      {seasonFailed && (
        <button
          type="button"
          onClick={retrySeason}
          className={`mt-2 ${buttonClass}`}
        >
          Try again
        </button>
      )}
      {loading && (
        <p className="mt-2 text-gray-600 dark:text-gray-400">Loading…</p>
      )}
      {rows?.length === 0 && (
        <p className="mt-2 text-gray-600 dark:text-gray-400">No entries yet.</p>
      )}
      {rows && rows.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-800">
          {rows.map((row) => (
            <li
              key={row.uid}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-gray-100">
                {row.nickname}
              </span>
              {row.prestige !== undefined && (
                <span className="tabular-nums">Prestige {row.prestige}</span>
              )}
              {row.lifetimeDistance !== undefined && (
                <span className="tabular-nums">
                  {(row.lifetimeDistance / 1000).toFixed(1)} km
                </span>
              )}
              {row.totalStars !== undefined && (
                <span className="tabular-nums">{row.totalStars} stars</span>
              )}
              <span className="text-gray-600 dark:text-gray-400">
                {row.updatedAt ? row.updatedAt.toLocaleString() : "unknown"}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRename(row, shownSeason)}
                className={buttonClass}
              >
                New name
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete(row, shownSeason)}
                className={dangerClass}
              >
                Delete
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleBan(row)}
                className={dangerClass}
              >
                Delete and ban
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
