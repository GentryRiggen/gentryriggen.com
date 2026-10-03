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

  if (!notice) return null;
  return (
    <div
      role="status"
      className={`absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-2 text-sm shadow-lg ${panelClass}`}
    >
      <span>{notice}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setNotice(null)}
        className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        ✕
      </button>
    </div>
  );
}
