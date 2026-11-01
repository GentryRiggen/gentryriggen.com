/**
 * Jim's addresses. Everything lives in the one /jim page; the path under it
 * names the page showing, and nothing more: never a search, never note text.
 * A person or note appears only by the path it already has in the repo
 * (`people/andrew-jenkins.md` → /jim/notes/people/andrew-jenkins).
 *
 *   /jim, /jim/chat                 Chat
 *   /jim/notes                      Notes home
 *   /jim/notes/<page>               work, money, people, health, training, golf
 *   /jim/notes/people/<slug>        a person's profile
 *   /jim/notes/directory/<id>       a JBREC directory card
 *   /jim/notes/note/<repo path>     a note, without its .md
 *   /jim/reminders                  the reminders list
 *   /jim/reminders/<12 hex>         one reminder
 *   /jim/meeting/<16 hex>           a meeting card
 */

export const JIM_BASE = "/jim";

export type NotesPage =
  "home" | "work" | "money" | "people" | "health" | "training" | "golf";

export type JimRoute =
  | { kind: "chat" }
  | { kind: "page"; page: NotesPage }
  | { kind: "person"; slug: string }
  | { kind: "directory"; id: number }
  /** `path` is the repo path without ".md" (`home/garden`). */
  | { kind: "note"; path: string }
  | { kind: "reminders" }
  | { kind: "reminder"; id: string }
  | { kind: "meeting"; id: string }
  | { kind: "notFound" };

/** Every route but Chat: what the Notes side shows. */
export type NotesRoute = Exclude<JimRoute, { kind: "chat" }>;

/** In the order the navigation lists them. */
export const NOTES_PAGES: readonly NotesPage[] = [
  "home",
  "work",
  "money",
  "people",
  "health",
  "training",
  "golf",
];

export const PAGE_LABELS: Record<NotesPage, string> = {
  home: "Home",
  work: "Work",
  money: "Money",
  people: "People",
  health: "Health",
  training: "Training",
  golf: "Golf",
};

export const CHAT_ROUTE: JimRoute = { kind: "chat" };
export const HOME_ROUTE: NotesRoute = { kind: "page", page: "home" };

/** One lowercase path segment: letters, digits and dashes. */
const SEGMENT = /^[a-z0-9][a-z0-9-]*$/;
/** Longest note path the address carries. */
const MAX_NOTE_PATH = 200;
const MAX_NOTE_DEPTH = 8;
/** Directory ids are small whole numbers. */
const DIRECTORY_ID = /^[0-9]{1,6}$/;
const REMINDER_ID = /^[a-f0-9]{12}$/;
const MEETING_ID = /^[a-f0-9]{16}$/;

function isNotesPage(value: string): value is NotesPage {
  return (NOTES_PAGES as readonly string[]).includes(value) && value !== "home";
}

/**
 * True when a repo path (without .md) can sit in the address as is: only
 * lowercase segments of [a-z0-9-], so never `..`, a dot, or an encoded byte.
 */
export function isRoutableNotePath(path: string): boolean {
  if (path.length === 0 || path.length > MAX_NOTE_PATH) return false;
  const segments = path.split("/");
  return (
    segments.length <= MAX_NOTE_DEPTH &&
    segments.every((segment) => SEGMENT.test(segment))
  );
}

/**
 * True for a repo path the app may ask the server for but that can't sit in
 * the address (`INDEX`, `notes/2026_q4`): it rides in the history entry
 * instead. Still never `..`, a leading slash or a backslash.
 */
export function isSafeNotePath(path: string): boolean {
  if (path.length === 0 || path.length > MAX_NOTE_PATH) return false;
  const segments = path.split("/");
  return (
    segments.length <= MAX_NOTE_DEPTH &&
    segments.every(
      (segment) =>
        /^[A-Za-z0-9_][A-Za-z0-9 ._-]*$/.test(segment) &&
        !segment.includes("..")
    )
  );
}

/** `people/sam-okafor.md` → its profile; any other note → the note. */
export function routeForNote(repoPath: string): NotesRoute | null {
  const person = /^people\/([a-z0-9][a-z0-9-]*)\.md$/.exec(repoPath);
  if (person) return { kind: "person", slug: person[1] };
  const path = repoPath.replace(/\.md$/, "");
  return isSafeNotePath(path) ? { kind: "note", path } : null;
}

/** The repo path behind a person's slug. */
export function personPath(slug: string): string {
  return `people/${slug}.md`;
}

/**
 * The route for an address under /jim. `notePath` is the note a history
 * entry carries when its path couldn't sit in the address.
 */
export function parseJimPath(pathname: string, notePath?: unknown): JimRoute {
  let path = pathname.replace(/\/+$/, "");
  if (path === `${JIM_BASE}.html`) path = JIM_BASE;
  if (path === JIM_BASE) return CHAT_ROUTE;
  if (!path.startsWith(`${JIM_BASE}/`)) return { kind: "notFound" };
  const [section, ...rest] = path.slice(JIM_BASE.length + 1).split("/");
  if (section === "chat") {
    return rest.length === 0 ? CHAT_ROUTE : { kind: "notFound" };
  }
  if (section === "reminders") {
    if (rest.length === 0) return { kind: "reminders" };
    return rest.length === 1 && REMINDER_ID.test(rest[0])
      ? { kind: "reminder", id: rest[0] }
      : { kind: "notFound" };
  }
  if (section === "meeting") {
    return rest.length === 1 && MEETING_ID.test(rest[0])
      ? { kind: "meeting", id: rest[0] }
      : { kind: "notFound" };
  }
  if (section !== "notes") return { kind: "notFound" };
  const [first, ...more] = rest;
  if (first === undefined) return HOME_ROUTE;
  if (first === "note") {
    if (more.length > 0) {
      const note = more.join("/");
      return isRoutableNotePath(note)
        ? { kind: "note", path: note }
        : { kind: "notFound" };
    }
    return typeof notePath === "string" && isSafeNotePath(notePath)
      ? { kind: "note", path: notePath }
      : { kind: "notFound" };
  }
  if (first === "people" && more.length === 1) {
    return SEGMENT.test(more[0])
      ? { kind: "person", slug: more[0] }
      : { kind: "notFound" };
  }
  if (first === "directory" && more.length === 1) {
    return DIRECTORY_ID.test(more[0])
      ? { kind: "directory", id: Number(more[0]) }
      : { kind: "notFound" };
  }
  if (more.length === 0 && isNotesPage(first)) {
    return { kind: "page", page: first };
  }
  return { kind: "notFound" };
}

/** The address for a route (a note that can't sit in it: /jim/notes/note). */
export function formatJimPath(route: JimRoute): string {
  switch (route.kind) {
    case "chat":
      return `${JIM_BASE}/chat`;
    case "page":
      return route.page === "home"
        ? `${JIM_BASE}/notes`
        : `${JIM_BASE}/notes/${route.page}`;
    case "person":
      return `${JIM_BASE}/notes/people/${route.slug}`;
    case "directory":
      return `${JIM_BASE}/notes/directory/${route.id}`;
    case "note":
      return isRoutableNotePath(route.path)
        ? `${JIM_BASE}/notes/note/${route.path}`
        : `${JIM_BASE}/notes/note`;
    case "reminders":
      return `${JIM_BASE}/reminders`;
    case "reminder":
      return `${JIM_BASE}/reminders/${route.id}`;
    case "meeting":
      return `${JIM_BASE}/meeting/${route.id}`;
    case "notFound":
      return `${JIM_BASE}/notes`;
  }
}

export function sameRoute(a: JimRoute, b: JimRoute): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "page":
      return a.page === (b as typeof a).page;
    case "person":
      return a.slug === (b as typeof a).slug;
    case "directory":
      return a.id === (b as typeof a).id;
    case "note":
      return a.path === (b as typeof a).path;
    case "reminder":
    case "meeting":
      return a.id === (b as typeof a).id;
    default:
      return true;
  }
}

/**
 * The list page a route belongs to when opened straight from its address
 * (a reload, a new tab): a person sits under People, a card under Work.
 */
export function homePageOf(route: JimRoute): NotesPage {
  switch (route.kind) {
    case "page":
      return route.page;
    case "person":
      return "people";
    case "directory":
    case "meeting":
      return "work";
    case "note":
      return route.path.startsWith("meetings/") ? "work" : "home";
    default:
      return "home";
  }
}

/** True for a page opened over a list: a person, a card, a note. */
export function isDetail(route: JimRoute): boolean {
  return (
    route.kind === "person" ||
    route.kind === "directory" ||
    route.kind === "note" ||
    route.kind === "reminder" ||
    route.kind === "meeting"
  );
}

/**
 * The browser tab's title. `name` is what the page is about (a person's
 * name, a note's title) once it is known.
 */
export function routeTitle(route: JimRoute, name?: string | null): string {
  const label = (() => {
    switch (route.kind) {
      case "chat":
        return "Chat";
      case "page":
        return PAGE_LABELS[route.page];
      case "person":
        return name || "People";
      case "directory":
        return name || "Directory";
      case "note":
        return name || "Note";
      case "reminders":
      case "reminder":
        return "Reminders";
      case "meeting":
        return name || "Meeting";
      case "notFound":
        return "Not found";
    }
  })();
  return `${label} · Jim`;
}
