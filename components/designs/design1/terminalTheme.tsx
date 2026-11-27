"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTheme } from "@/components/ThemeProvider";
import {
  TERMINAL_THEMES,
  TERM_THEME_KEY,
  type TerminalTheme,
} from "@/lib/theme/terminalThemes";

export { TERMINAL_THEMES, type TerminalTheme };

function isSiteMode(id: string): boolean {
  return id === "light" || id === "dark";
}

/** The theme a typed name means (`ayu`, `Ayu Mirage`, `solarized`…), if any. */
export function findTerminalTheme(query: string): TerminalTheme | undefined {
  const q = query.trim().toLowerCase().replace(/\s+/g, "-");
  if (!q) return undefined;
  return (
    TERMINAL_THEMES.find((t) => t.id === q) ??
    TERMINAL_THEMES.find((t) => t.id.startsWith(q))
  );
}

interface TerminalThemeContextValue {
  themeId: string;
  setThemeId: (id: string) => void;
}

const TerminalThemeContext = createContext<TerminalThemeContextValue>({
  themeId: "dark",
  setThemeId: () => {},
});

export function useTerminalTheme(): TerminalThemeContextValue {
  return useContext(TerminalThemeContext);
}

/** Saves a named theme (or clears it for Light/Dark) and paints it. */
function applyToDocument(id: string) {
  const root = document.documentElement;
  const named = !isSiteMode(id);
  try {
    if (named) localStorage.setItem(TERM_THEME_KEY, id);
    else localStorage.removeItem(TERM_THEME_KEY);
  } catch {
    // Private mode: the theme still applies for this visit.
  }
  if (named) root.setAttribute("data-term-theme", id);
  else root.removeAttribute("data-term-theme");
  // iOS tints its browser chrome with theme-color. ThemeProvider sets it too
  // when the mode flips; this covers switches that keep the mode.
  const theme = TERMINAL_THEMES.find((t) => t.id === id);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme?.page ?? "#030712");
}

interface TerminalThemeProviderProps {
  children: ReactNode;
}

/** Homepage only: owns the terminal theme and keeps the site mode in step. */
export function TerminalThemeProvider({
  children,
}: TerminalThemeProviderProps) {
  const { theme: siteTheme, setTheme: setSiteTheme } = useTheme();
  const [namedId, setNamedId] = useState<string | null>(null);

  // THEME_SCRIPT already painted the saved theme; sync state for the menus.
  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-term-theme");
    const known = TERMINAL_THEMES.find(
      (t) => t.id === saved && !isSiteMode(t.id)
    );
    // eslint-disable-next-line -- setState in effect required for hydration
    if (known) setNamedId(known.id);
  }, []);

  const setThemeId = useCallback(
    (id: string) => {
      const theme = TERMINAL_THEMES.find((t) => t.id === id);
      if (!theme) return;
      setNamedId(isSiteMode(theme.id) ? null : theme.id);
      applyToDocument(theme.id);
      setSiteTheme(theme.mode);
    },
    [setSiteTheme]
  );

  const value = useMemo(
    () => ({ themeId: namedId ?? siteTheme, setThemeId }),
    [namedId, siteTheme, setThemeId]
  );

  return (
    <TerminalThemeContext.Provider value={value}>
      {children}
    </TerminalThemeContext.Provider>
  );
}
