"use client";

import { useEffect, useState } from "react";
import {
  deleteLeaderboardEntry,
  fetchLeaderboardTop,
  type LeaderboardAdminRow,
} from "@/lib/firebase/client";

/** Everything shown here was written by players, so it is rendered as text. */
export default function LeaderboardAdmin() {
  const [rows, setRows] = useState<LeaderboardAdminRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    fetchLeaderboardTop()
      .then((top) => {
        if (!isCancelled) setRows(top);
      })
      .catch(() => {
        if (!isCancelled) setError("Couldn't load the leaderboard.");
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  const handleDelete = async (row: LeaderboardAdminRow) => {
    if (!window.confirm(`Delete "${row.nickname}" from the leaderboard?`)) {
      return;
    }
    try {
      await deleteLeaderboardEntry(row.uid);
      setRows((current) => current?.filter((r) => r.uid !== row.uid) ?? null);
    } catch {
      setError("Couldn't delete that entry.");
    }
  };

  return (
    <section
      aria-labelledby="leaderboard-admin-title"
      className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
    >
      <h2
        id="leaderboard-admin-title"
        className="text-sm font-medium text-gray-600 dark:text-gray-400"
      >
        Plane Builder leaderboard (top 50)
      </h2>
      {error && (
        <p role="alert" className="mt-2 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {rows === null && !error && (
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
              <span className="min-w-0 flex-1 truncate font-medium">
                {row.nickname}
              </span>
              <span className="tabular-nums">Prestige {row.prestige}</span>
              <span className="tabular-nums">
                {(row.lifetimeDistance / 1000).toFixed(1)} km
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                {row.updatedAt ? row.updatedAt.toLocaleString() : "unknown"}
              </span>
              <button
                type="button"
                onClick={() => void handleDelete(row)}
                className="rounded-md border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
