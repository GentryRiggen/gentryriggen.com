/**
 * The homepage terminal's colour themes. The colours themselves live in
 * app/globals.css (`[data-term-theme]`); `page` repeats the page colour for the
 * iOS browser chrome (theme-color), which CSS can't reach.
 */

export type SiteMode = "light" | "dark";

export interface TerminalTheme {
  id: string;
  name: string;
  /** The site's light/dark mode this theme pairs with. */
  mode: SiteMode;
  /** `--term-page`, for theme-color. */
  page: string;
}

/**
 * Light and Dark are the site's own modes (nothing saved); the rest paint the
 * homepage terminal and set the site mode to match.
 */
export const TERMINAL_THEMES: readonly TerminalTheme[] = [
  { id: "light", name: "Light", mode: "light", page: "#ffffff" },
  { id: "dark", name: "Dark", mode: "dark", page: "#030712" },
  { id: "ayu-mirage", name: "Ayu Mirage", mode: "dark", page: "#171b24" },
  { id: "dracula", name: "Dracula", mode: "dark", page: "#1e1f29" },
  { id: "nord", name: "Nord", mode: "dark", page: "#242933" },
  { id: "gruvbox", name: "Gruvbox", mode: "dark", page: "#1d2021" },
  { id: "catppuccin", name: "Catppuccin Mocha", mode: "dark", page: "#11111b" },
  {
    id: "solarized-light",
    name: "Solarized Light",
    mode: "light",
    page: "#eee8d5",
  },
];

/** localStorage key for the saved named theme. */
export const TERM_THEME_KEY = "term-theme";

export function isHomePath(p: string): boolean {
  return p === "/" || p === "/index.html";
}

/** theme-color for the named theme painted on <html>, on the homepage only. */
export function terminalThemeColor(pathname: string): string | null {
  if (!isHomePath(pathname) || typeof document === "undefined") return null;
  const id = document.documentElement.getAttribute("data-term-theme");
  return TERMINAL_THEMES.find((t) => t.id === id)?.page ?? null;
}
