"use client";

import { useEffect } from "react";
import {
  claimReload,
  isAppScriptLoadFailure,
  isChunkLoadFailure,
} from "@/lib/ever-onward/staleChunk";

/**
 * Self-heals a tab that outlived a deploy: when one of the app's chunks is
 * gone, save the game and reload once (at most once a minute).
 */
export function useStaleChunkRecovery(saveNow: () => void): void {
  useEffect(() => {
    const recover = () => {
      if (!claimReload(window.sessionStorage, Date.now())) return;
      saveNow();
      window.location.reload();
    };
    // Script load failures don't bubble, so listen while capturing.
    const handleError = (event: ErrorEvent | Event) => {
      if (isAppScriptLoadFailure(event.target)) recover();
      else if (event instanceof ErrorEvent && isChunkLoadFailure(event.error))
        recover();
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadFailure(event.reason)) recover();
    };
    window.addEventListener("error", handleError, true);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError, true);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [saveNow]);
}
