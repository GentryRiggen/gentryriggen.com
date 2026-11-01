"use client";

import { useEffect } from "react";
import { reloadPage } from "@/lib/jim/reload";
import {
  claimReload,
  isAppScriptLoadFailure,
  isChunkLoadFailure,
} from "@/lib/jim/staleChunk";

/**
 * Self-heals a page that outlived a deploy: when one of the app's chunks is
 * gone, reload once (at most once a minute). Jim keeps nothing unsaved.
 */
export default function useJimStaleChunkRecovery(): void {
  useEffect(() => {
    const recover = () => {
      if (!claimReload(window.sessionStorage, Date.now())) return;
      reloadPage();
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
  }, []);
}
