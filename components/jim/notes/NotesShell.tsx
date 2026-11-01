"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
import NotesReminder from "@/components/jim/notes/NotesReminder";
import NotesReminders from "@/components/jim/notes/NotesReminders";
import NotesSearch, { SearchField } from "@/components/jim/notes/NotesSearch";
import { BackLink, Empty, onPlainClick } from "@/components/jim/notes/NotesUi";
import NotesTraining from "@/components/jim/notes/NotesTraining";
import NotesWork from "@/components/jim/notes/NotesWork";
import { DirectoryCard } from "@/components/jim/notes/WorkDirectory";
import useTodoSaves from "@/components/jim/notes/useTodoSaves";
import useBasePage from "@/components/jim/useBasePage";
import useJimRouter, {
  type JimNavigate,
  type JimNavType,
} from "@/components/jim/useJimRouter";
import { JimError, type JimErrorKind } from "@/lib/jim/api";
import { useMoney } from "@/lib/jim/money";
import { localDay, timeLabel } from "@/lib/jim/notesData";
import { loadView } from "@/lib/jim/offlineStore";
import {
  formatJimPath,
  HOME_ROUTE,
  isDetail,
  PAGE_LABELS,
  personPath,
  routeForNote,
  routeTitle,
  sameRoute,
  type JimRoute,
  type NotesPage,
  type NotesRoute,
} from "@/lib/jim/routes";
import { fmtShort } from "@/lib/jim/todos";
import { fetchView, getCachedView, type ViewData } from "@/lib/jim/view";

/**
 * Where Notes is and how it moves: the route, the history entry showing,
 * and the search (kept here, never in the address). JimChat passes it; a
 * Notes shell on its own runs its own router.
 */
export interface NotesRouting {
  /** What Notes shows (while Chat shows, the last Notes route). */
  route: NotesRoute;
  /** The list a profile, card or note opened over. */
  basePage: NotesPage;
  /** The history entry showing, for its scroll position. */
  entryKey: string;
  navType: JimNavType;
  /** The back link's label and address, when the entry names them. */
  backLabel: string | null;
  backFrom: string | null;
  navigate: JimNavigate;
  goBack: (fallback: JimRoute) => void;
  search: string;
  onSearch: (value: string) => void;
  /** The desktop layout: the sidebar has the pages and the search. */
  wide: boolean;
}

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
  routing?: NotesRouting;
}

/** The pills along the top on a phone: Health holds Training and Golf. */
type Pill = "home" | "work" | "money" | "health" | "people";

const PILLS: { id: Pill; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "work", label: "Work", icon: Briefcase },
  { id: "money", label: "Money", icon: Wallet },
  { id: "health", label: "Health", icon: HeartPulse },
  { id: "people", label: "People", icon: Users },
];

const NO_DIRECTORY = { updated: "", people: [] };

/** Health's own pages, picked by the switch at its top. */
type HealthPage = "health" | "training" | "golf";

const HEALTH_PAGES: { id: HealthPage; label: string }[] = [
  { id: "health", label: "Health" },
  { id: "training", label: "Training" },
  { id: "golf", label: "Golf" },
];

function isHealthPage(page: NotesPage): page is HealthPage {
  return page === "health" || page === "training" || page === "golf";
}

function pillOf(page: NotesPage): Pill {
  return isHealthPage(page) ? "health" : page;
}

/** Pages that use the room a desktop gives them. */
const WIDE_PAGES: ReadonlySet<NotesPage> = new Set([
  "work",
  "money",
  "health",
  "training",
]);

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

interface NotFoundProps {
  onHome: () => void;
}

/** An address under /jim that names nothing. */
function NotFound({ onHome }: NotFoundProps) {
  return (
    <div className="jim-rise space-y-3 py-10 text-center">
      <p className="text-xl font-semibold text-ayu-text">
        Nothing lives at this address
      </p>
      <p className="text-ayu-subtle">
        It may have moved, or the link was cut short.
      </p>
      <a
        href={formatJimPath(HOME_ROUTE)}
        onClick={onPlainClick(onHome)}
        className="jim-glow inline-flex min-h-11 items-center rounded-full px-5 font-medium text-ayu-bg hover:brightness-110"
      >
        Go to Notes home
      </a>
    </div>
  );
}

/** A note's (or person's) address from its repo path. */
function hrefForNote(path: string): string | null {
  const route = routeForNote(path);
  return route ? formatJimPath(route) : null;
}

/** A directory card's address. */
function hrefForCard(id: number): string {
  return formatJimPath({ kind: "directory", id });
}

/** A person's address from their note's path ("people/x.md"). */
function hrefForPerson(path: string): string {
  const route = routeForNote(path);
  return formatJimPath(route ?? { kind: "page", page: "people" });
}

/**
 * The Notes tab: its page bar, the data, and the read-only pages.
 * Memoized: it sits (hidden) beside a chat that redraws every streamed frame.
 */
export default memo(function NotesShell(props: NotesShellProps) {
  return props.routing ? (
    <NotesShellView {...props} routing={props.routing} />
  ) : (
    <StandaloneNotesShell {...props} />
  );
});

/** Notes on its own (no chat around it): its own router and search. */
function StandaloneNotesShell(props: NotesShellProps) {
  const { location, navigate, goBack } = useJimRouter();
  const route: NotesRoute =
    location.route.kind === "chat" ? HOME_ROUTE : location.route;
  const basePage = useBasePage(route);
  const [search, setSearch] = useState("");
  const routing = useMemo<NotesRouting>(
    () => ({
      route,
      basePage,
      entryKey: location.key,
      navType: location.nav,
      backLabel: location.back,
      backFrom: location.from,
      navigate,
      goBack,
      search,
      onSearch: setSearch,
      wide: false,
    }),
    [route, basePage, location, navigate, goBack, search]
  );
  return <NotesShellView {...props} routing={routing} />;
}

function NotesShellView({
  uid,
  api,
  getToken,
  active,
  onLog,
  onDraft,
  routing,
}: NotesShellProps & { routing: NotesRouting }) {
  const {
    route,
    basePage,
    entryKey,
    navType,
    backLabel,
    backFrom,
    navigate,
    goBack,
    search,
    onSearch,
    wide,
  } = routing;
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
  const [query, setQuery] = useState("");
  /** The open note's title, for the browser tab. */
  const [noteTitle, setNoteTitle] = useState<{
    path: string;
    title: string;
  } | null>(null);
  /** The Health pill returns to the Health page last shown. */
  const [lastHealth, setLastHealth] = useState<HealthPage>(
    isHealthPage(basePage) ? basePage : "health"
  );
  if (isHealthPage(basePage) && basePage !== lastHealth) {
    setLastHealth(basePage);
  }
  const searching = search.trim() !== "";
  const detail = isDetail(route) || route.kind === "reminders" ? route : null;
  /** "Done" after finishing a reminder, shown on the list for a moment. */
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  const notFound = route.kind === "notFound";
  /** The list showing, or the one a detail opened over. */
  const listPage: NotesPage = route.kind === "page" ? route.page : basePage;
  /** Money: fetched only while its page shows, held in memory only. */
  const money = useMoney(
    getToken,
    api,
    active && route.kind === "page" && route.page === "money" && !searching
  );

  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedTabRef = useRef<HTMLButtonElement>(null);
  const inflight = useRef<Promise<ViewData | null> | null>(null);
  /** Whether anything is showing, for the offline fallback. */
  const hasData = useRef(data !== null);
  /** A change landed while a load was out: load once more after it. */
  const again = useRef(false);
  /** Each history entry's scroll position, for Back and Forward. */
  const entryTops = useRef(new Map<string, number>());
  /** Each list page's scroll position, for its pill tapped from a profile. */
  const pageTops = useRef(new Map<NotesPage, number>());
  /** What showed at the last scroll reset. */
  const shown = useRef({ route, searching });
  /** The latest entry and page, for the scroll handler. */
  const latest = useRef({ entryKey, route, searching });
  useLayoutEffect(() => {
    latest.current = { entryKey, route, searching };
  });

  /**
   * Loads the notes; a call while a load is out joins it. Resolves to the
   * payload the last round fetched, or null when that round failed.
   */
  const load = useCallback((): Promise<ViewData | null> => {
    if (inflight.current) return inflight.current;
    setLoading(true);
    setError(null);
    const run = (async () => {
      let latestData: ViewData | null = null;
      try {
        do {
          again.current = false;
          try {
            latestData = await fetchView(getToken, undefined, api);
            hasData.current = true;
            setData(latestData);
            setLoadedAt(getCachedView()?.at ?? Date.now());
            setFromDevice(false);
            setError(null);
          } catch (err) {
            latestData = null;
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
        return latestData;
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

  // A new page starts at the top. Back and Forward return to where that
  // entry was; a list's pill tapped from a profile returns to the list's
  // spot. The same page again (back from Chat) stays where it was.
  useLayoutEffect(() => {
    const before = shown.current;
    shown.current = { route, searching };
    if (sameRoute(before.route, route) && before.searching === searching) {
      return;
    }
    let top = 0;
    if (navType === "pop") top = entryTops.current.get(entryKey) ?? 0;
    else if (route.kind === "page" && isDetail(before.route) && !searching) {
      top = pageTops.current.get(route.page) ?? 0;
    }
    const el = scrollerRef.current;
    // Instant: the site-wide smooth scrolling would show the old spot first.
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo({ top, behavior: "instant" });
    }
  }, [route, searching, entryKey, navType]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const now = latest.current;
    entryTops.current.set(now.entryKey, el.scrollTop);
    if (now.route.kind === "page" && !now.searching) {
      pageTops.current.set(now.route.page, el.scrollTop);
    }
  }

  // Keep the selected pill in view when the row is scrolled sideways.
  useEffect(() => {
    const tab = selectedTabRef.current;
    if (tab && typeof tab.scrollIntoView === "function") {
      tab.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }, [listPage]);

  // The browser tab names the page (a person by name: only on this device).
  const person =
    route.kind === "person" && data
      ? data.people.find((p) => p.path === personPath(route.slug))
      : undefined;
  const card =
    route.kind === "directory"
      ? data?.work?.directory?.people.find((p) => p.id === route.id)
      : undefined;
  const titleName =
    route.kind === "meeting"
      ? data?.meetingCards?.[route.id]?.subject
      : route.kind === "person"
        ? person?.name
        : route.kind === "directory"
          ? card?.name
          : route.kind === "note" && noteTitle?.path === route.path
            ? noteTitle.title
            : null;
  useEffect(() => {
    if (!active) return;
    document.title =
      searching && !detail ? "Search · Jim" : routeTitle(route, titleName);
  }, [active, route, titleName, searching, detail]);

  const onNoteTitle = useCallback(
    (title: string) => {
      if (route.kind === "note") setNoteTitle({ path: route.path, title });
    },
    [route]
  );

  /** A page from the pills or the sidebar: leaves any search for it. */
  function goTo(next: NotesPage) {
    if (searching) onSearch("");
    navigate({ kind: "page", page: next });
  }

  /** Opens a note or person by repo path, with Back labelled `back`. */
  function openPath(path: string, back?: string) {
    const next = routeForNote(path);
    if (next) navigate(next, back ? { back } : undefined);
  }

  /** A search hit: a person in the payload opens as their profile. */
  const routeForHit = useCallback(
    (path: string): NotesRoute | null => {
      const next = routeForNote(path);
      if (
        next?.kind === "person" &&
        !data?.people.some((p) => p.path === personPath(next.slug))
      ) {
        return { kind: "note", path: path.replace(/\.md$/, "") };
      }
      return next;
    },
    [data]
  );
  const hrefForHit = useCallback(
    (path: string) => {
      const next = routeForHit(path);
      return next ? formatJimPath(next) : null;
    },
    [routeForHit]
  );

  function openFound(path: string) {
    const next = routeForHit(path);
    if (next) navigate(next, { back: "Results" });
  }

  const listRoute: NotesRoute = { kind: "page", page: basePage };
  const back = () => goBack(listRoute);
  // "Results" means nothing once the search is gone (a reload).
  const backText =
    backLabel && !(backLabel === "Results" && !searching)
      ? backLabel
      : PAGE_LABELS[basePage];
  const backHref = backFrom ?? formatJimPath(listRoute);

  const loadState: ReactNode =
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

  let pageBody: ReactNode;
  if (listPage === "money") {
    // Its own data and its own Refresh: it doesn't wait on the notes.
    pageBody = <NotesMoney money={money} />;
  } else if (!data) {
    pageBody = loadState;
  } else if (listPage === "home") {
    pageBody = (
      <NotesHome
        data={data}
        saves={saves}
        onLog={onLog}
        onDraft={onDraft}
        reminders={{
          api,
          getToken,
          onOpen: (id) =>
            navigate(id ? { kind: "reminder", id } : { kind: "reminders" }, {
              back: "Home",
            }),
          hrefFor: (id) =>
            formatJimPath(
              id ? { kind: "reminder", id } : { kind: "reminders" }
            ),
        }}
      />
    );
  } else if (listPage === "work") {
    pageBody = (
      <NotesWork
        data={data}
        onOpenMeeting={(path) => openPath(path, "Work")}
        onOpenPerson={(id) =>
          navigate({ kind: "directory", id }, { back: "Work" })
        }
        meetingHref={hrefForNote}
        personHref={hrefForCard}
      />
    );
  } else if (isHealthPage(listPage)) {
    pageBody = (
      <>
        {!wide && (
          <HealthSwitch
            value={listPage}
            onChange={(next) => navigate({ kind: "page", page: next })}
          />
        )}
        {listPage === "health" ? (
          <NotesHealth data={data} />
        ) : listPage === "training" ? (
          <NotesTraining data={data} />
        ) : (
          <NotesGolf data={data} />
        )}
      </>
    );
  } else {
    pageBody = (
      <NotesPeople
        data={data}
        query={query}
        onQuery={setQuery}
        onOpen={(path) => openPath(path)}
        hrefFor={hrefForPerson}
      />
    );
  }

  const updated = loadedAt ? timeLabel(new Date(loadedAt).toISOString()) : null;
  const offlineLine =
    fromDevice && loadedAt
      ? `${error === "server" || error === "rejected" ? "Couldn't refresh" : "Offline"} · as of ${asOfLabel(loadedAt)}`
      : null;
  const showStatus =
    data !== null &&
    !searching &&
    !notFound &&
    !(route.kind === "page" && route.page === "money");
  const statusRow: ReactNode = showStatus ? (
    <>
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
    </>
  ) : null;
  /** On a desktop, a profile, card or note shows Updated · Refresh beside
   * its back link; the pages show it in their header row. */
  const detailAside: ReactNode =
    wide && statusRow ? (
      <div className="flex min-w-0 items-center gap-3 text-sm text-ayu-subtle">
        {statusRow}
      </div>
    ) : undefined;
  let detailBody: ReactNode = null;
  if (route.kind === "note") {
    detailBody = (
      <NotesNote
        key={route.path}
        path={`${route.path}.md`}
        api={api}
        getToken={getToken}
        onBack={back}
        backLabel={backText}
        backHref={backHref}
        backAside={detailAside}
        onTitle={onNoteTitle}
      />
    );
  } else if (route.kind === "person") {
    detailBody = !data ? (
      loadState
    ) : person ? (
      <NotesPerson
        person={person}
        today={data.today}
        onBack={back}
        backLabel={backText}
        backHref={backHref}
        backAside={detailAside}
      />
    ) : (
      <article className="space-y-5">
        <BackLink
          label={backText}
          onBack={back}
          href={backHref}
          aside={detailAside}
        />
        <Empty>That profile isn&apos;t here anymore.</Empty>
      </article>
    );
  } else if (route.kind === "reminders") {
    detailBody = (
      <NotesReminders
        api={api}
        getToken={getToken}
        onBack={() => goBack(HOME_ROUTE)}
        backLabel={backLabel ?? "Home"}
        backHref={backFrom ?? formatJimPath(HOME_ROUTE)}
        backAside={detailAside}
        onOpen={(id) =>
          navigate({ kind: "reminder", id }, { back: "Reminders" })
        }
        hrefFor={(id) => formatJimPath({ kind: "reminder", id })}
        notice={notice}
      />
    );
  } else if (route.kind === "reminder") {
    detailBody = (
      <NotesReminder
        key={route.id}
        id={route.id}
        api={api}
        getToken={getToken}
        onBack={() => goBack({ kind: "reminders" })}
        backLabel={backLabel ?? "Reminders"}
        backHref={backFrom ?? formatJimPath({ kind: "reminders" })}
        backAside={detailAside}
        onDone={() => {
          setNotice("Done");
          navigate({ kind: "reminders" }, { replace: true });
        }}
        listHref={formatJimPath({ kind: "reminders" })}
        onList={() => navigate({ kind: "reminders" }, { replace: true })}
      />
    );
  } else if (route.kind === "directory") {
    detailBody = !data ? (
      loadState
    ) : (
      <DirectoryCard
        directory={data.work?.directory ?? NO_DIRECTORY}
        id={route.id}
        people={data.people}
        // One card to the next replaces it: Back (and "Work") still
        // return to the list, not the card before.
        onOpen={(id) => navigate({ kind: "directory", id }, { replace: true })}
        onProfile={(path) => openPath(path, "Directory")}
        hrefFor={hrefForCard}
        profileHref={hrefForNote}
        onBack={back}
        backHref={backHref}
        backAside={detailAside}
      />
    );
  }

  const showSearchField =
    !wide && !detail && !notFound && (searching || listPage !== "people");
  const wideTitle =
    !wide || detail || notFound
      ? null
      : searching
        ? "Search"
        : PAGE_LABELS[listPage];
  const pill = pillOf(listPage);

  return (
    <div className="flex h-full flex-col">
      {!wide && (
        <div className="jim-glass relative z-10 shrink-0 border-b border-white/[0.06]">
          {/* Pills size to their text and the row scrolls sideways on its own
              when they don't fit; the page never does. */}
          <div
            role="tablist"
            aria-label="Notes pages"
            className="mx-auto flex w-full max-w-[45rem] scroll-px-4 gap-1 overflow-x-auto overscroll-x-contain py-1.5 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {PILLS.map((p) => {
              const selected = p.id === pill;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  id={`jim-notes-tab-${p.id}`}
                  aria-selected={selected}
                  aria-controls="jim-notes-page"
                  ref={selected ? selectedTabRef : undefined}
                  onClick={() => goTo(p.id === "health" ? lastHealth : p.id)}
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
      )}

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        data-notes-scroller
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div
          id="jim-notes-page"
          role={wide ? undefined : "tabpanel"}
          aria-labelledby={wide ? undefined : `jim-notes-tab-${pill}`}
          className={
            wide
              ? `@container mx-auto w-full px-8 pt-7 pb-12 ${
                  WIDE_PAGES.has(listPage) && !detail
                    ? "max-w-[72rem]"
                    : "max-w-[55rem]"
                }`
              : "mx-auto w-full max-w-[45rem] pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:pt-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          }
        >
          {wide && !detail && (wideTitle || statusRow) && (
            // One header row: the page's name, and how fresh it is.
            <div className="mb-6 flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-1">
              {wideTitle && (
                <h1 className="text-[2rem] leading-tight font-semibold tracking-tight text-ayu-text">
                  {wideTitle}
                </h1>
              )}
              {statusRow && (
                <div
                  className={`flex min-w-0 items-center gap-3 text-sm text-ayu-subtle ${
                    wideTitle ? "" : "flex-1 justify-between"
                  }`}
                >
                  {statusRow}
                </div>
              )}
            </div>
          )}
          {/* People has its own search; an open page hides it. */}
          {showSearchField && (
            <div className="mb-4">
              <SearchField value={search} onChange={onSearch} />
            </div>
          )}
          {!wide && statusRow && (
            <div className="mb-6 flex items-center justify-between gap-3 text-sm text-ayu-subtle">
              {statusRow}
            </div>
          )}
          {/* The list stays mounted under what opened from it, so Back is
              instant and its searches keep their text. */}
          {/* A search replaces the page; its results stay under what
              opened from them. */}
          {!searching && (
            <div hidden={detail !== null || notFound}>{pageBody}</div>
          )}
          {searching && (
            <div hidden={detail !== null || notFound}>
              <NotesSearch
                query={search}
                api={api}
                getToken={getToken}
                onOpen={openFound}
                hrefFor={hrefForHit}
              />
            </div>
          )}
          {detailBody}
          {notFound && (
            <NotFound
              onHome={() => {
                if (searching) onSearch("");
                navigate(HOME_ROUTE);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
