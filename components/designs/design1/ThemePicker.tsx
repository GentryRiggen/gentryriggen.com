"use client";

import ThemeSwatch from "./ThemeSwatch";
import { TERMINAL_THEMES, useTerminalTheme } from "./terminalTheme";

/** `/theme`: pick a colour theme, each row previewed in its own colours. */
export default function ThemePicker() {
  const { themeId, setThemeId } = useTerminalTheme();

  return (
    <div>
      <p className="mb-2 text-term-fg">Choose a theme:</p>
      <ul className="space-y-1">
        {TERMINAL_THEMES.map((theme) => {
          const isCurrent = theme.id === themeId;
          return (
            <li key={theme.id}>
              <button
                type="button"
                onClick={(e) => {
                  // Don't focus the input: on phones that pops the keyboard.
                  e.stopPropagation();
                  setThemeId(theme.id);
                }}
                aria-pressed={isCurrent}
                className={`flex w-full items-center gap-3 rounded px-1 py-1.5 text-left hover:bg-term-faint/10 ${isCurrent ? "text-term-accent" : "text-term-text"}`}
              >
                <span className="w-3 shrink-0" aria-hidden="true">
                  {isCurrent ? "❯" : ""}
                </span>
                <ThemeSwatch themeId={theme.id} />
                <span className="min-w-0">{theme.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-term-muted">
        Or type <span className="text-term-accent">theme dracula</span>. The
        button in the top corner has them too.
      </p>
    </div>
  );
}
