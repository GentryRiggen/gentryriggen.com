/** Messages a notification may put in the box (/jim?say=…), and nothing else. */
export const SAY_ALLOWLIST: readonly string[] = [
  "quiz me",
  "keep going",
  "teach me something new",
];

const SAY_PARAM = "say";

/** `value` if it is exactly an allowed text, else null. */
export function allowedSay(value: unknown): string | null {
  return typeof value === "string" && SAY_ALLOWLIST.includes(value)
    ? value
    : null;
}

/** The allowed `say` text in a query string, or null (anything else is ignored). */
export function sayFromSearch(search: string): string | null {
  return allowedSay(new URLSearchParams(search).get(SAY_PARAM));
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
  // Without Next's own fields (it copies them back), so Next's router takes
  // the new address too and doesn't write `say` back later.
  const kept = { ...(window.history.state as Record<string, unknown> | null) };
  delete kept.__NA;
  delete kept.__PRIVATE_NEXTJS_INTERNALS_TREE;
  window.history.replaceState(
    kept,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}
