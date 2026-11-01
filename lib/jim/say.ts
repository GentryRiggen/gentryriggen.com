/** Messages a notification may put in the box (/jim?say=…), and nothing else. */
export const SAY_ALLOWLIST: readonly string[] = [
  "quiz me",
  "keep going",
  "teach me something new",
];

const SAY_PARAM = "say";

/** The allowed `say` text in a query string, or null (anything else is ignored). */
export function sayFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get(SAY_PARAM);
  return value !== null && SAY_ALLOWLIST.includes(value) ? value : null;
}

/** The `say` text in this page's URL, if allowed. */
export function sayFromLocation(): string | null {
  return sayFromSearch(window.location.search);
}

/** Drops `say` from the address bar so a reload doesn't put it back. */
export function clearSayFromLocation(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(SAY_PARAM)) return;
  url.searchParams.delete(SAY_PARAM);
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}
