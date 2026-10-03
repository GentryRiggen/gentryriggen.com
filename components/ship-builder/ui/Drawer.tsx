"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { panelClass } from "./styles";

interface DrawerProps {
  side: "left" | "right";
  label: string;
  children: ReactNode;
}

export default function Drawer({ side, label, children }: DrawerProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const left = side === "left";
  const closed = left ? "-translate-x-full" : "translate-x-full";

  function handleClose() {
    setOpen(false);
    toggleRef.current?.focus();
  }

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={`absolute top-3 z-20 rounded-md border border-slate-300 bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur lg:hidden dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 ${
          left ? "left-3" : "right-20"
        }`}
      >
        {label}
      </button>
      <aside
        id={id}
        aria-label={label}
        className={`absolute inset-y-0 z-30 w-72 overflow-y-auto transition-[transform,visibility] lg:static lg:z-auto lg:translate-x-0 ${panelClass} ${
          left ? "left-0 border-r" : "right-0 border-l"
        } ${open ? "visible translate-x-0" : `invisible lg:visible ${closed}`}`}
      >
        {/* On the right, keep ✕ clear of the fixed ThemeToggle. */}
        <div
          className={`flex justify-end p-2 lg:hidden ${left ? "" : "pr-20"}`}
        >
          <button
            type="button"
            aria-label={`Close ${label}`}
            onClick={handleClose}
            className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}
