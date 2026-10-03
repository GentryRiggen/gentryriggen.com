"use client";

import { useEffect } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { panelClass } from "./styles";

const NOTICE_MS = 5000;

export default function Notice() {
  const notice = useShipBuilderStore((s) => s.notice);
  const setNotice = useShipBuilderStore((s) => s.setNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);

  // The live region stays mounted so screen readers are already watching it
  // when text arrives; a region that mounts with its text may go unannounced.
  // Below lg it sits under the drawer toggles instead of covering them.
  return (
    <div
      className={`absolute left-1/2 top-14 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 lg:top-3 ${
        notice
          ? `rounded-lg border px-4 py-2 text-sm shadow-lg ${panelClass}`
          : "pointer-events-none"
      }`}
    >
      <div role="status" aria-live="polite">
        {notice}
      </div>
      {notice && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setNotice(null)}
          className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}
