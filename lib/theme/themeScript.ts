/** /jim's status bar: Ayu Mirage in light and dark alike. */
export const JIM_THEME_COLOR = "#1f2430";

/** Ever Onward's status bar: the top bar's slate, in light and dark alike. */
export const EVER_ONWARD_THEME_COLOR = "#020617";

/** Flamelings' status bar: the night-purple of its home-screen icon. */
export const FLAMELINGS_THEME_COLOR = "#2a1a4a";

/** Shipwreck's status bar: the near-black night blue of its icon. */
export const SHIPWRECK_THEME_COLOR = "#05080f";

/**
 * True on /jim, which is always Ayu Mirage, so the site's light/dark
 * theme-color must not apply there. Plain string checks (no regex): the same
 * test is inlined in THEME_SCRIPT, where escapes are easy to lose.
 */
export function isJimPath(p: string): boolean {
  return p === "/jim" || p === "/jim.html" || p.indexOf("/jim/") === 0;
}

/** True on /ever-onward and its pages (always dark, like /jim). */
export function isEverOnwardPath(p: string): boolean {
  return (
    p === "/ever-onward" ||
    p === "/ever-onward.html" ||
    p.indexOf("/ever-onward/") === 0
  );
}

/** True on /flamelings and its pages (always its own purple). */
export function isFlamelingsPath(p: string): boolean {
  return (
    p === "/flamelings" ||
    p === "/flamelings.html" ||
    p.indexOf("/flamelings/") === 0
  );
}

/** True on /shipwreck and its pages (always its own night blue). */
export function isShipwreckPath(p: string): boolean {
  return (
    p === "/shipwreck" ||
    p === "/shipwreck.html" ||
    p.indexOf("/shipwreck/") === 0
  );
}

/**
 * The theme-color a page always uses whatever the site theme, or null. iOS
 * tints the top of a home-screen app with it, so a site color there shows
 * as a haze over a dark game.
 */
export function fixedThemeColor(p: string): string | null {
  if (isJimPath(p)) return JIM_THEME_COLOR;
  if (isEverOnwardPath(p)) return EVER_ONWARD_THEME_COLOR;
  if (isFlamelingsPath(p)) return FLAMELINGS_THEME_COLOR;
  if (isShipwreckPath(p)) return SHIPWRECK_THEME_COLOR;
  return null;
}

/** localStorage key for the homepage terminal's theme (see terminalTheme.tsx). */
export const TERM_THEME_KEY = "term-theme";

/**
 * Runs before paint on every page (app/layout.tsx): applies the saved or
 * system theme and sets the theme-color for iOS Safari's browser chrome.
 * lib/theme/__tests__/themeScript.test.ts runs this exact string.
 */
export const THEME_SCRIPT = `
(function() {
  var savedTheme = localStorage.getItem('theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var theme = savedTheme || (prefersDark ? 'dark' : 'light');
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  // The homepage terminal's colour theme (/theme); CSS ignores unknown ids.
  var termTheme = localStorage.getItem('${TERM_THEME_KEY}');
  if (termTheme) {
    document.documentElement.setAttribute('data-term-theme', termTheme);
  }
  var p = location.pathname;
  var jim = p === '/jim' || p === '/jim.html' || p.indexOf('/jim/') === 0;
  var eo = p === '/ever-onward' || p === '/ever-onward.html' || p.indexOf('/ever-onward/') === 0;
  var fl = p === '/flamelings' || p === '/flamelings.html' || p.indexOf('/flamelings/') === 0;
  var sw = p === '/shipwreck' || p === '/shipwreck.html' || p.indexOf('/shipwreck/') === 0;
  var themeColorMeta = document.querySelector('meta[name="theme-color"]');
  // The root layout's theme-color can come before a page's own (the order is
  // up to the build), and Safari uses the first one, so set it either way.
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', jim ? '${JIM_THEME_COLOR}' : eo ? '${EVER_ONWARD_THEME_COLOR}' : fl ? '${FLAMELINGS_THEME_COLOR}' : sw ? '${SHIPWRECK_THEME_COLOR}' : theme === 'dark' ? '#030712' : '#ffffff');
  }
})();
`;
