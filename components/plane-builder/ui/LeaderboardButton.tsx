"use client";

import { useEffect, useState } from "react";
import { getIdToken } from "@/lib/leaderboard/auth";
import { LEADERBOARDS_ENABLED } from "@/lib/plane-builder/state/leaderboardSync";
import Leaderboards from "./Leaderboards";
import { secondaryButtonClass } from "./styles";

interface LeaderboardButtonProps {
  /** Off in tests and e2e by default; see LEADERBOARDS_ENABLED. */
  enabled?: boolean;
}

export default function LeaderboardButton({
  enabled = LEADERBOARDS_ENABLED,
}: LeaderboardButtonProps) {
  const [uid, setUid] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Resolved once; no token (offline, sign-in off) means no button.
  useEffect(() => {
    if (!enabled) return;
    let isCancelled = false;
    getIdToken()
      .then((session) => {
        if (!isCancelled) setUid(session?.uid ?? null);
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [enabled]);

  if (!enabled || uid === null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={secondaryButtonClass}
      >
        🏆 Leaderboards
      </button>
      {isOpen ? (
        <Leaderboards uid={uid} onClose={() => setIsOpen(false)} />
      ) : null}
    </>
  );
}
