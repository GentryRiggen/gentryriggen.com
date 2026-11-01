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
import {
  Briefcase,
  HeartPulse,
  House,
  RefreshCw,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import NotesGolf from "@/components/jim/notes/NotesGolf";
import NotesHealth from "@/components/jim/notes/NotesHealth";
import NotesHome from "@/components/jim/notes/NotesHome";
import NotesMoney from "@/components/jim/notes/NotesMoney";
import NotesNote from "@/components/jim/notes/NotesNote";
import NotesPeople from "@/components/jim/notes/NotesPeople";
import NotesPerson from "@/components/jim/notes/NotesPerson";
import NotesSearch, { SearchField } from "@/components/jim/notes/NotesSearch";
import { Empty } from "@/components/jim/notes/NotesUi";
import NotesTraining from "@/components/jim/notes/NotesTraining";
import NotesWork from "@/components/jim/notes/NotesWork";
import { DirectoryCard } from "@/components/jim/notes/WorkDirectory";
import useTodoSaves from "@/components/jim/notes/useTodoSaves";
import { JimError, type JimErrorKind } from "@/lib/jim/api";
import { useMoney } from "@/lib/jim/money";
import { localDay, timeLabel } from "@/lib/jim/notesData";
import { loadView } from "@/lib/jim/offlineStore";
import { fmtShort } from "@/lib/jim/todos";
import { fetchView, getCachedView, type ViewData } from "@/lib/jim/view";

interface NotesShellProps {
  /** The signed-in user, whose last payload is kept on this device. */
  uid: string;
  /** The server's base URL. */
  api: string;
  getToken: (force?: boolean) => Promise<string | null>;
  /** The Notes tab is showing: load (or refresh stale data) then. */
  active: boolean;
  /** Sends a quick-log sentence as a chat message and switches to Chat. */
  onLog: (text: string) => void;
  /** Puts outside-sourced text in the chat box, unsent, and switches to Chat. */
  onDraft: (text: string) => void;
}

type Page = "home" | "work" | "money" | "health" | "people";

const PAGES: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "work", label: "Work", icon: Briefcase },
  { id: "money", label: "Money", icon: Wallet },
  { id: "health", label: "Health", icon: HeartPulse },
  { id: "people", label: "People", icon: Users },
];

/** What Work shows over its list: a meeting note, a directory card, or
 * the people note opened from that card. */
type WorkView =
  | { kind: "meeting"; path: string }
  | { kind: "person"; id: number }
  | { kind: "profile"; path: string; id: number };

const NO_DIRECTORY = { updated: "", people: [] };

/** Health's own pages, picked by the switch at its top. */
type HealthPage = "health" | "training" | "golf";

const HEALTH_PAGES: { id: HealthPage; label: string }[] = [
  { id: "health", label: "Health" },
  { id: "training", label: "Training" },
  { id: "golf", label: "Golf" },
];

interface HealthSwitchProps {
  value: HealthPage;
  onChange: (next: HealthPage) => void;
}

/** Health | Training | Golf: a segmented control above the page. */
function HealthSwitch({ value, onChange }: HealthSwitchProps) {
  return (
    <div
      role="tablist"
      aria-label="Health pages"
      className="jim-card mb-5 grid grid-cols-3 gap-1 p-1"
    >
      {HEALTH_PAGES.map((p) => {
        const selected = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(p.id)}
            className={`min-h-11 min-w-0 truncate rounded-xl px-2 text-sm font-medium transition-colors duration-200 ${
              selected
                ? "bg-ayu-accent/12 text-ayu-accent ring-1 ring-ayu-accent/30 ring-inset"
                : "text-ayu-subtle hover:bg-white/[0.06] hover:text-ayu-text"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/** A cached payload younger than this is shown without refetching. */
const FRESH_MS = 60_000;

const LOAD_ERRORS: Record<JimErrorKind, string> = {
  waking: "Jim is waking up. Try again in a moment.",
  uncertain: "Jim is waking up. Try again in a moment.",
  denied: "Jim didn't accept your sign-in. Sign out and back in.",
  server: "Couldn't load your notes.",
  rejected: "Couldn't load your notes.",
};

/** "9:14am" today, "Oct 30, 9:14am" before. */
function asOfLabel(at: number): string {
  const iso = new Date(at).toISOString();
  const time = timeLabel(iso);
  return localDay(iso) === localDay(new Date().toISOString())
    ? time
    : `${fmtShort(localDay(iso))}, ${time}`;
}

function Skeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <p className="sr-only" role="status">
        Loading notes…
      </p>
      <div className="h-6 w-48 animate-pulse rounded-lg bg-white/[0.05]" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.04]"
        />
      ))}
    </div>
  );
}

/**
 * The Notes tab: its page bar, the data, and the read-only pages.
 * Memoized: it sits (hidden) beside a chat that redraws every streamed frame.
 */
export default memo(function NotesShell({
  uid,
  api,
  getToken,
  active,
  onLog,
  onDraft,
}: NotesShellProps) {
  const [data, setData] = useState<ViewData | null>(
    () => getCachedView()?.data ?? null
  );
  const [loadedAt, setLoadedAt] = useState<number | null>(
    () => getCachedView()?.at ?? null
  );
  /** What shows came from this device, not the server (no signal). */
  const [fromDevice, setFromDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<JimErrorKind | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [healthPage, setHealthPage] = useState<HealthPage>("health");
  const [person, setPerson] = useState<string | null>(null);
  const [workView, setWorkView] = useState<WorkView | null>(null);
  const [query, setQuery] = useState("");
  /** The search across all notes; while it has text it replaces the page. */
  const [search, setSearch] = useState("");
  /** A note opened from the search results. */
  const [found, setFound] = useState<string | null>(null);
  const searching = search.trim() !== "";
  /** Money: fetched only while its page shows, held in memory only. */
  const money = useMoney(
    getToken,
    api,
    active && page === "money" && !searching
  );

  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedTabRef = useRef<HTMLButtonElement>(null);
  const inflight = useRef<Promise<ViewData | null> | null>(null);
  /** Whether anything is showing, for the offline fallback. */
  const hasData = useRef(data !== null);
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
            hasData.current = true;
            setData(latest);
            setLoadedAt(getCachedView()?.at ?? Date.now());
            setFromDevice(false);
            setError(null);
          } catch (err) {
            latest = null;
            const kind = err instanceof JimError ? err.kind : "server";
            setError(kind);
            // Nothing showing yet (no signal on opening): the last payload
            // kept on this device. Not when the sign-in itself was refused.
            if (!hasData.current && kind !== "denied") {
              const saved = await loadView(uid);
              if (saved && !hasData.current) {
                hasData.current = true;
                setData(saved.payload);
                setLoadedAt(saved.savedAt);
                setFromDevice(true);
              }
            }
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
  }, [api, getToken, uid]);

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
  // Fresh data a load elsewhere fetched (the sign-in prefetch) after this
  // mounted is taken as is: otherwise the page would wait on a load that
  // never runs, skeletons forever.
  useEffect(() => {
    if (!active) return;
    const cached = getCachedView();
    if (cached && Date.now() - cached.at < FRESH_MS) {
      hasData.current = true;
      setData((current) => current ?? cached.data);
      setLoadedAt((current) => current ?? cached.at);
      return;
    }
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
  }, [page, healthPage, person, workView, searching, found]);

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
    } else if (next === page && person === null && workView === null) return;
    if (
      (person !== null && next === "people") ||
      (workView !== null && next === "work")
    )
      restoreTop.current = listTop.current;
    setPerson(null);
    setWorkView(null);
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

  /** Opens something over the Work list, keeping the list's spot once. */
  function openWork(next: WorkView) {
    if (workView === null)
      listTop.current = scrollerRef.current?.scrollTop ?? 0;
    setWorkView(next);
  }

  function closeWork() {
    restoreTop.current = listTop.current;
    setWorkView(null);
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
  } else if (page === "money") {
    // Its own data and its own Refresh: it doesn't wait on the notes.
    body = <NotesMoney money={money} />;
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
            className="min-h-11 rounded-full jim-glow px-5 font-medium text-ayu-bg hover:brightness-110"
          >
            Try again
          </button>
        </div>
      ) : (
        <Skeleton />
      );
  } else if (page === "home") {
    body = (
      <NotesHome data={data} saves={saves} onLog={onLog} onDraft={onDraft} />
    );
  } else if (page === "work") {
    const profile =
      workView?.kind === "profile"
        ? data.people.find((p) => p.path === workView.path)
        : undefined;
    // The list stays mounted under what opened, so back is instant and
    // its searches keep their text.
    body = (
      <>
        <div hidden={workView !== null}>
          <NotesWork
            data={data}
            onOpenMeeting={(path) => openWork({ kind: "meeting", path })}
            onOpenPerson={(id) => openWork({ kind: "person", id })}
          />
        </div>
        {workView?.kind === "meeting" && (
          <NotesNote
            key={workView.path}
            path={workView.path}
            api={api}
            getToken={getToken}
            onBack={closeWork}
            backLabel="Work"
          />
        )}
        {workView?.kind === "person" && (
          <DirectoryCard
            directory={data.work?.directory ?? NO_DIRECTORY}
            id={workView.id}
            people={data.people}
            onOpen={(id) => openWork({ kind: "person", id })}
            onProfile={(path) =>
              openWork({ kind: "profile", path, id: workView.id })
            }
            onBack={closeWork}
          />
        )}
        {workView?.kind === "profile" &&
          (profile ? (
            <NotesPerson
              person={profile}
              today={data.today}
              onBack={() => openWork({ kind: "person", id: workView.id })}
              backLabel="Directory"
            />
          ) : (
            <Empty>That profile isn&apos;t here anymore.</Empty>
          ))}
      </>
    );
  } else if (page === "health") {
    body = (
      <>
        <HealthSwitch value={healthPage} onChange={setHealthPage} />
        {healthPage === "health" ? (
          <NotesHealth data={data} />
        ) : healthPage === "training" ? (
          <NotesTraining data={data} />
        ) : (
          <NotesGolf data={data} />
        )}
      </>
    );
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
  const offlineLine =
    fromDevice && loadedAt
      ? `${error === "server" || error === "rejected" ? "Couldn't refresh" : "Offline"} · as of ${asOfLabel(loadedAt)}`
      : null;

  return (
    <div className="flex h-full flex-col">
      <div className="jim-glass relative z-10 shrink-0 border-b border-white/[0.06]">
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
                className="group flex min-h-11 shrink-0 items-center"
              >
                <span
                  className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap ring-1 transition-colors duration-200 ring-inset ${
                    selected
                      ? "bg-ayu-accent/12 text-ayu-accent ring-ayu-accent/30"
                      : "text-ayu-subtle ring-transparent group-hover:bg-white/[0.06] group-hover:text-ayu-text"
                  }`}
                >
                  <p.icon
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={selected ? 2.25 : 2}
                  />
                  {p.label}
                </span>
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
          {/* People has its own search; an open Work item hides it. */}
          {found === null &&
            (searching ||
              (page !== "people" && !(page === "work" && workView))) && (
              <div className="mb-4">
                <SearchField value={search} onChange={onSearch} />
              </div>
            )}
          {data && !searching && page !== "money" && (
            <div className="mb-6 flex items-center justify-between gap-3 text-sm text-ayu-subtle">
              <p className="flex min-w-0 items-center gap-2" aria-live="polite">
                <span
                  aria-hidden="true"
                  className={`size-1.5 shrink-0 rounded-full ${
                    error || offlineLine || data.stale
                      ? "bg-ayu-orange"
                      : "bg-ayu-green shadow-[0_0_8px_rgb(213_255_128/0.6)]"
                  }`}
                />
                {error === "denied"
                  ? LOAD_ERRORS.denied
                  : offlineLine
                    ? offlineLine
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
                className="-mr-2 flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 font-medium text-ayu-accent hover:bg-white/[0.06] disabled:text-ayu-subtle"
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
