/** /jim's status bar: Ayu Mirage in light and dark alike. */
export const JIM_THEME_COLOR = "#1f2430";

/**
 * True on /jim, which is always Ayu Mirage, so the site's light/dark
 * theme-color must not apply there. Plain string checks (no regex): the same
 * test is inlined in THEME_SCRIPT, where escapes are easy to lose.
 */
export function isJimPath(p: string): boolean {
  return p === "/jim" || p === "/jim.html" || p.indexOf("/jim/") === 0;
}

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
  var p = location.pathname;
  var jim = p === '/jim' || p === '/jim.html' || p.indexOf('/jim/') === 0;
  var themeColorMeta = document.querySelector('meta[name="theme-color"]');
  // The root layout's theme-color can come before /jim's own (the order is
  // up to the build), and Safari uses the first one, so set it either way.
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', jim ? '${JIM_THEME_COLOR}' : theme === 'dark' ? '#030712' : '#ffffff');
  }
})();
`;
