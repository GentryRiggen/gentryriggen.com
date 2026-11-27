"use client";

import { useEffect, useRef, useState } from "react";
import ThemeSwatch from "./ThemeSwatch";
import { TERMINAL_THEMES, useTerminalTheme } from "./terminalTheme";

/** The homepage's top-corner button: a menu of every terminal theme. */
export default function ThemeMenu() {
  const { themeId, setThemeId } = useTerminalTheme();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on a tap outside or Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={rootRef}
      className="fixed top-[calc(1.5rem+env(safe-area-inset-top))] right-6 z-50 font-mono"
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Choose theme"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="p-3 rounded-full bg-term-bar/80 hover:bg-term-bar border border-term-border backdrop-blur-sm shadow-sm text-term-accent cursor-pointer"
      >
        {/* Palette icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3a9 9 0 0 0 0 18c1 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.2-4-7.8-9-7.8Z"
          />
          <circle cx="7.5" cy="11.5" r="1" fill="currentColor" />
          <circle cx="10" cy="7.5" r="1" fill="currentColor" />
          <circle cx="14.5" cy="7.5" r="1" fill="currentColor" />
          <circle cx="17" cy="11" r="1" fill="currentColor" />
        </svg>
      </button>

      {isOpen && (
        <ul
          aria-label="Themes"
          className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-lg border border-term-border bg-term-bar p-1 shadow-xl animate-fadeIn"
        >
          {TERMINAL_THEMES.map((theme) => {
            const isCurrent = theme.id === themeId;
            return (
              <li key={theme.id}>
                <button
                  type="button"
                  aria-pressed={isCurrent}
                  onClick={() => {
                    setThemeId(theme.id);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-term-faint/15 ${isCurrent ? "text-term-accent" : "text-term-text"}`}
                >
                  <ThemeSwatch themeId={theme.id} />
                  <span className="flex-1">{theme.name}</span>
                  <span className="w-3" aria-hidden="true">
                    {isCurrent ? "✓" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
