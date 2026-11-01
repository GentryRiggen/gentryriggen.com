"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Empty, Rows } from "@/components/jim/notes/NotesUi";
import { JimError, type JimErrorKind } from "@/lib/jim/api";
import { stripMd } from "@/lib/jim/todos";
import { searchNotes, type SearchResult } from "@/lib/jim/view";

/** Wait this long after the last keystroke before searching. */
export const SEARCH_DEBOUNCE_MS = 300;
/** Shorter queries match too much to be useful. */
export const SEARCH_MIN = 2;

const ERRORS: Record<JimErrorKind, string> = {
  waking: "Couldn't search. Try again.",
  uncertain: "Couldn't search. Try again.",
  server: "Couldn't search. Try again.",
  rejected: "Couldn't search. Try again.",
  denied: "Jim didn't accept your sign-in. Sign out and back in.",
};

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/** The search box at the top of Notes, with a clear button. */
export function SearchField({ value, onChange }: SearchFieldProps) {
  return (
    <div role="search" className="relative">
      <label htmlFor="jim-notes-search" className="sr-only">
        Search notes
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ayu-subtle"
      />
      <input
        id="jim-notes-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search all notes"
        maxLength={100}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        className="min-h-11 w-full rounded-2xl border border-white/[0.08] bg-ayu-panel/70 py-2 shadow-[inset_0_1px_2px_rgb(0_0_0/0.25)] backdrop-blur pr-11 pl-10 text-base text-ayu-text placeholder:text-ayu-subtle focus:border-ayu-accent/60 focus:ring-4 focus:ring-ayu-accent/10 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-full text-ayu-subtle hover:text-ayu-text"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}

interface Outcome {
  query: string;
  results: SearchResult[] | null;
  error: JimErrorKind | null;
}

interface NotesSearchProps {
  /** The text in the field; results show for its trimmed form. */
  query: string;
  api: string;
  getToken: (force?: boolean) => Promise<string | null>;
  onOpen: (path: string) => void;
}

/** Results for the search field: title, path and a snippet per note. */
export default function NotesSearch({
  query,
  api,
  getToken,
  onOpen,
}: NotesSearchProps) {
  const q = query.trim();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (q.length < SEARCH_MIN) return;
    // A newer query (or unmount) makes this one's answer irrelevant.
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const results = await searchNotes(q, getToken, undefined, api);
        if (current) setOutcome({ query: q, results, error: null });
      } catch (err) {
        if (current) {
          setOutcome({
            query: q,
            results: null,
            error: err instanceof JimError ? err.kind : "server",
          });
        }
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q, api, getToken, attempt]);

  if (q.length < SEARCH_MIN) {
    return <Empty>Type at least {SEARCH_MIN} letters.</Empty>;
  }

  const settled = outcome?.query === q ? outcome : null;
  // While a new search runs, the last results stay up, quieter.
  const results = settled ? settled.results : (outcome?.results ?? null);
  const status = !settled
    ? "Searching…"
    : settled.error
      ? null
      : `${settled.results?.length ?? 0} note${settled.results?.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-3">
      <p role="status" className="text-sm text-ayu-subtle">
        {status}
      </p>
      {settled?.error ? (
        <div className="space-y-3">
          <p role="alert" className="text-ayu-text">
            {ERRORS[settled.error]}
          </p>
          {settled.error !== "denied" && (
            <button
              type="button"
              onClick={() => {
                setOutcome(null);
                setAttempt((n) => n + 1);
              }}
              className="min-h-11 rounded-full jim-glow px-5 font-medium text-ayu-bg hover:brightness-110"
            >
              Try again
            </button>
          )}
        </div>
      ) : settled && results?.length === 0 ? (
        <Empty>No notes match.</Empty>
      ) : results && results.length > 0 ? (
        <div className={settled ? "" : "opacity-60"} aria-busy={!settled}>
          <Rows>
            {results.map((r) => (
              <li key={r.path}>
                <button
                  type="button"
                  onClick={() => onOpen(r.path)}
                  className="block min-h-11 w-full px-4 py-2.5 text-left hover:bg-ayu-raised"
                >
                  <span className="block font-medium text-ayu-text [overflow-wrap:anywhere]">
                    {r.title || r.path}
                  </span>
                  <span className="block text-sm text-ayu-subtle [overflow-wrap:anywhere]">
                    {r.path}
                  </span>
                  {r.snippet && (
                    <span className="mt-1 line-clamp-2 block text-sm text-ayu-text/80 [overflow-wrap:anywhere]">
                      {stripMd(r.snippet)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </Rows>
        </div>
      ) : null}
    </div>
  );
}
