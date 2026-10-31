"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RefreshCw } from "lucide-react";
import NotesGolf from "@/components/jim/notes/NotesGolf";
import NotesHealth from "@/components/jim/notes/NotesHealth";
import NotesHome from "@/components/jim/notes/NotesHome";
import NotesNote from "@/components/jim/notes/NotesNote";
import NotesPeople from "@/components/jim/notes/NotesPeople";
import NotesPerson from "@/components/jim/notes/NotesPerson";
import NotesSearch, { SearchField } from "@/components/jim/notes/NotesSearch";
import NotesTraining from "@/components/jim/notes/NotesTraining";
import useTodoSaves from "@/components/jim/notes/useTodoSaves";
import { JimError, type JimErrorKind } from "@/lib/jim/api";
import { timeLabel } from "@/lib/jim/notesData";
import { fetchView, getCachedView, type ViewData } from "@/lib/jim/view";

interface NotesShellProps {
  /** The server's base URL. */
  api: string;
  getToken: (force?: boolean) => Promise<string | null>;
  /** The Notes tab is showing: load (or refresh stale data) then. */
  active: boolean;
  /** Sends a quick-log sentence as a chat message and switches to Chat. */
  onLog: (text: string) => void;
}

type Page = "home" | "health" | "training" | "golf" | "people";

const PAGES: { id: Page; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "health", label: "Health" },
  { id: "training", label: "Training" },
  { id: "golf", label: "Golf" },
  { id: "people", label: "People" },
];

/** A cached payload younger than this is shown without refetching. */
const FRESH_MS = 60_000;

const LOAD_ERRORS: Record<JimErrorKind, string> = {
  waking: "Jim is waking up. Try again in a moment.",
  uncertain: "Jim is waking up. Try again in a moment.",
  denied: "Jim didn't accept your sign-in. Sign out and back in.",
  server: "Couldn't load your notes.",
  rejected: "Couldn't load your notes.",
};

function Skeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <p className="sr-only" role="status">
        Loading notes…
      </p>
      <div className="h-6 w-48 animate-pulse rounded bg-ayu-panel" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-ayu-panel" />
      ))}
    </div>
  );
}

/**
 * The Notes tab: its page bar, the data, and the five read-only pages.
 * Memoized: it sits (hidden) beside a chat that redraws every streamed frame.
 */
export default memo(function NotesShell({
  api,
  getToken,
  active,
  onLog,
}: NotesShellProps) {
  const [data, setData] = useState<ViewData | null>(
    () => getCachedView()?.data ?? null
  );
  const [loadedAt, setLoadedAt] = useState<number | null>(
    () => getCachedView()?.at ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<JimErrorKind | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [person, setPerson] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  /** The search across all notes; while it has text it replaces the page. */
  const [search, setSearch] = useState("");
  /** A note opened from the search results. */
  const [found, setFound] = useState<string | null>(null);
  const searching = search.trim() !== "";

  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedTabRef = useRef<HTMLButtonElement>(null);
  const inflight = useRef<Promise<ViewData | null> | null>(null);
  /** A change landed while a load was out: load once more after it. */
  const again = useRef(false);
  /** Where the People list (or the results) was scrolled to before a
   * profile or note opened. */
  const listTop = useRef(0);
  const restoreTop = useRef<number | null>(null);

  /**
   * Loads the notes; a call while a load is out joins it. Resolves to the
   * payload the last round fetched, or null when that round failed.
   */
  const load = useCallback((): Promise<ViewData | null> => {
    if (inflight.current) return inflight.current;
    setLoading(true);
    setError(null);
    const run = (async () => {
      let latest: ViewData | null = null;
      try {
        do {
          again.current = false;
          try {
            latest = await fetchView(getToken, undefined, api);
            setData(latest);
            setLoadedAt(getCachedView()?.at ?? Date.now());
            setError(null);
          } catch (err) {
            latest = null;
            setError(err instanceof JimError ? err.kind : "server");
          }
        } while (again.current);
        return latest;
      } finally {
        inflight.current = null;
        setLoading(false);
      }
    })();
    inflight.current = run;
    return run;
  }, [api, getToken]);

  /**
   * A todo was saved: refetch in the background, once more after any load
   * now out (it may predate the save). Resolves to the fresh payload.
   */
  const reload = useCallback((): Promise<ViewData | null> => {
    if (!inflight.current) return load();
    again.current = true;
    return inflight.current;
  }, [load]);

  const saves = useTodoSaves({ data, api, getToken, onChanged: reload });

  // Load on the first open, and again on a later open once the data is old.
  useEffect(() => {
    if (!active) return;
    const cached = getCachedView();
    if (cached && Date.now() - cached.at < FRESH_MS) return;
    void load();
  }, [active, load]);

  // A new page starts at the top; back from a profile returns to the spot.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    const top = restoreTop.current ?? 0;
    restoreTop.current = null;
    // Instant: the site-wide smooth scrolling would show the old spot first.
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo({ top, behavior: "instant" });
    }
  }, [page, person, searching, found]);

  // Keep the selected pill in view when the row is scrolled sideways.
  useEffect(() => {
    const tab = selectedTabRef.current;
    if (tab && typeof tab.scrollIntoView === "function") {
      tab.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }, [page]);

  function goTo(next: Page) {
    if (searching) {
      setSearch("");
      setFound(null);
    } else if (next === page && person === null) return;
    if (person !== null && next === "people")
      restoreTop.current = listTop.current;
    setPerson(null);
    setPage(next);
  }

  function openPerson(path: string) {
    listTop.current = scrollerRef.current?.scrollTop ?? 0;
    setPerson(path);
  }

  function closePerson() {
    restoreTop.current = listTop.current;
    setPerson(null);
  }

  function onSearch(value: string) {
    setSearch(value);
    if (!value.trim()) setFound(null);
  }

  function openFound(path: string) {
    listTop.current = scrollerRef.current?.scrollTop ?? 0;
    setFound(path);
  }

  function closeFound() {
    restoreTop.current = listTop.current;
    setFound(null);
  }

  let body: ReactNode;
  if (searching) {
    // A person in the payload opens as their profile; anything else is
    // fetched as a note. The results stay mounted, so back is instant.
    const foundPerson =
      found?.startsWith("people/") && data
        ? data.people.find((p) => p.path === found)
        : undefined;
    body = (
      <>
        <div hidden={found !== null}>
          <NotesSearch
            query={search}
            api={api}
            getToken={getToken}
            onOpen={openFound}
          />
        </div>
        {found !== null &&
          (foundPerson && data ? (
            <NotesPerson
              person={foundPerson}
              today={data.today}
              onBack={closeFound}
              backLabel="Results"
            />
          ) : (
            <NotesNote
              key={found}
              path={found}
              api={api}
              getToken={getToken}
              onBack={closeFound}
            />
          ))}
      </>
    );
  } else if (!data) {
    body =
      error && !loading ? (
        <div className="space-y-3 py-8 text-center">
          <p role="alert" className="text-ayu-text">
            {LOAD_ERRORS[error]}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-11 rounded-full bg-ayu-accent px-5 font-medium text-ayu-bg hover:bg-ayu-orange"
          >
            Try again
          </button>
        </div>
      ) : (
        <Skeleton />
      );
  } else if (page === "home") {
    body = <NotesHome data={data} saves={saves} onLog={onLog} />;
  } else if (page === "health") {
    body = <NotesHealth data={data} />;
  } else if (page === "training") {
    body = <NotesTraining data={data} />;
  } else if (page === "golf") {
    body = <NotesGolf data={data} />;
  } else {
    const open = person ? data.people.find((p) => p.path === person) : null;
    body = open ? (
      <NotesPerson person={open} today={data.today} onBack={closePerson} />
    ) : (
      <NotesPeople
        data={data}
        query={query}
        onQuery={setQuery}
        onOpen={openPerson}
      />
    );
  }

  const updated = loadedAt ? timeLabel(new Date(loadedAt).toISOString()) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-ayu-line">
        {/* Pills size to their text and the row scrolls sideways on its own
            when they don't fit; the page never does. */}
        <div
          role="tablist"
          aria-label="Notes pages"
          className="mx-auto flex w-full max-w-[45rem] scroll-px-4 gap-1 overflow-x-auto overscroll-x-contain py-1.5 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {PAGES.map((p) => {
            const selected = p.id === page;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                id={`jim-notes-tab-${p.id}`}
                aria-selected={selected}
                aria-controls="jim-notes-page"
                ref={selected ? selectedTabRef : undefined}
                onClick={() => goTo(p.id)}
                className={`min-h-11 shrink-0 rounded-full px-3.5 text-sm font-medium whitespace-nowrap ${
                  selected
                    ? "bg-ayu-accent text-ayu-bg"
                    : "text-ayu-subtle hover:bg-ayu-panel hover:text-ayu-text"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={scrollerRef}
        data-notes-scroller
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div
          id="jim-notes-page"
          role="tabpanel"
          aria-labelledby={`jim-notes-tab-${page}`}
          className="mx-auto w-full max-w-[45rem] pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:pt-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          {/* People has its own search. */}
          {found === null && (searching || page !== "people") && (
            <div className="mb-4">
              <SearchField value={search} onChange={onSearch} />
            </div>
          )}
          {data && !searching && (
            <div className="mb-5 flex items-center justify-between gap-3 text-sm text-ayu-subtle">
              <p className="min-w-0" aria-live="polite">
                {error === "denied"
                  ? LOAD_ERRORS.denied
                  : error
                    ? `Couldn't refresh. Showing what loaded${updated ? ` at ${updated}` : ""}.`
                    : data.stale
                      ? "Jim couldn't sync, so these may be behind."
                      : updated
                        ? `Updated ${updated}`
                        : null}
              </p>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="-mr-2 flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 font-medium text-ayu-accent hover:bg-ayu-panel disabled:text-ayu-subtle"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={`size-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}
                />
                Refresh
              </button>
            </div>
          )}
          {body}
        </div>
      </div>
    </div>
  );
});
