import { getIdToken } from "@/lib/firebase/client";
import {
  isJimConnected,
  isOffline,
  JIM_API,
  JimError,
  tokenErrorKind,
} from "@/lib/jim/api";

/**
 * The Notes tab's data: `GET /api/view` on Jim's server, built from his notes
 * at request time. Everything here is shape only; no note content lives in
 * this repo.
 */

export interface ViewTodo {
  /** The todo line without its checkbox and trailing tags. */
  text: string;
  /** YYYY-MM-DD, or "" when it has no date. */
  due: string;
  path: string;
  /** "work", "personal" or "". */
  area: string;
  /** The basename of the note it is about, or "". */
  project: string;
  done: boolean;
  done_on: string;
  /** Line number in the todo list (file order). */
  order: number;
}

export interface CalendarEvent {
  subject: string;
  /** ISO time in UTC (an all-day event's date is its first 10 characters). */
  start: string;
  end: string;
  allDay: boolean;
  where?: string;
  /** A company-wide event, shown quieter. */
  company?: boolean;
  showAs?: string;
}

export interface CalendarSnapshot {
  fetchedAt?: string;
  events: CalendarEvent[];
}

export interface Injection {
  date: string;
  time: string;
  mg: number | null;
  ml: string;
  note: string;
}

export interface LabRow {
  lab: string;
  marker: string;
  range: string;
  values: { date: string; raw: string }[];
}

export interface LabDraw {
  date: string;
  lab: string;
  approx: boolean;
}

export interface HealthData {
  injections: Injection[];
  labs: LabRow[];
  draws: LabDraw[];
  prescribedWeekly: number | null;
  actualWeekly?: number | null;
  nextDraw: string | null;
  /** Markers set aside until a draw after `until`. */
  hold?: { markers: string[]; until: string };
}

export interface Lift {
  /** YYYY-MM-DD, or YYYY-MM when the day wasn't recorded. */
  date: string;
  movement: string;
  weight: number | null;
  unit: string;
  reps: number | null;
  repUnit: string;
  sets: number;
  kind: string;
  note: string;
}

export interface Workout {
  date: string;
  type: string;
  workout: string;
  score: string;
  rx: string;
  note: string;
}

export interface TrainingData {
  lifts: Lift[];
  workouts: Workout[];
}

export interface GolfRound {
  date: string;
  course: string;
  holes: number;
  /** False for a scramble or another non-stroke format. */
  counts: boolean;
  format: string;
  tee: string;
  yards: number | null;
  score: number | null;
  toPar: number | null;
  putts: number | null;
  fw: number | null;
  gir: number | null;
  note: string;
}

export interface Birth {
  y: number | null;
  m: number;
  d: number | null;
  unsure?: boolean;
}

export interface Person {
  path: string;
  name: string;
  tags: string[];
  strengths: string[];
  strengthTips: { label: string; text: string }[];
  about: string;
  birth: Birth | null;
  zodiac: string | null;
  died: string | null;
  /** The server's grouping; when absent the page groups by tags. */
  group?: "family" | "friends" | "work" | "other";
  /** The person file's Markdown body. */
  body: string;
  updated: string;
}

export interface ViewData {
  /** Gentry's local date on the server, YYYY-MM-DD. */
  today: string;
  todos: ViewTodo[];
  doneTodos: ViewTodo[];
  calendar: CalendarSnapshot | null;
  health: HealthData;
  training: TrainingData;
  golf: GolfRound[];
  people: Person[];
  sha?: string;
  /** The server couldn't sync, so this may be behind. */
  stale?: boolean;
}

/** A Cloud Run cold start plus a sync fits well inside this. */
export const VIEW_TIMEOUT_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * The payload with every list present, or null when it isn't a view at all.
 * Rendering then never trips on a key the server left out.
 */
export function normalizeView(raw: unknown): ViewData | null {
  if (!isRecord(raw) || typeof raw.today !== "string") return null;
  const health = isRecord(raw.health) ? raw.health : {};
  const training = isRecord(raw.training) ? raw.training : {};
  const calendar =
    isRecord(raw.calendar) && Array.isArray(raw.calendar.events)
      ? (raw.calendar as unknown as CalendarSnapshot)
      : null;
  return {
    today: raw.today,
    todos: list<ViewTodo>(raw.todos),
    doneTodos: list<ViewTodo>(raw.doneTodos),
    calendar,
    health: {
      injections: list<Injection>(health.injections),
      labs: list<LabRow>(health.labs),
      draws: list<LabDraw>(health.draws),
      prescribedWeekly:
        typeof health.prescribedWeekly === "number"
          ? health.prescribedWeekly
          : null,
      actualWeekly:
        typeof health.actualWeekly === "number" ? health.actualWeekly : null,
      nextDraw: typeof health.nextDraw === "string" ? health.nextDraw : null,
      hold:
        isRecord(health.hold) &&
        Array.isArray(health.hold.markers) &&
        typeof health.hold.until === "string"
          ? (health.hold as HealthData["hold"])
          : undefined,
    },
    training: {
      lifts: list<Lift>(training.lifts),
      workouts: list<Workout>(training.workouts),
    },
    golf: list<GolfRound>(raw.golf),
    people: list<Person>(raw.people),
    sha: typeof raw.sha === "string" ? raw.sha : undefined,
    stale: raw.stale === true,
  };
}

export interface CachedView {
  data: ViewData;
  /** When it arrived (Date.now()). */
  at: number;
}

/** The last good payload, kept in memory for this page load only. */
let cache: CachedView | null = null;

export function getCachedView(): CachedView | null {
  return cache;
}

/** Bumped on sign-out, so a fetch still out then can't refill the cache. */
let generation = 0;

/** The fetch out now, shared: the early wake-up's and Notes' are one call. */
let inflight: {
  api: string;
  generation: number;
  promise: Promise<ViewData>;
} | null = null;

export function clearViewCache(): void {
  cache = null;
  inflight = null;
  generation += 1;
}

/**
 * Fetches the Notes data. On a 401 the ID token is force-refreshed and the
 * request is tried once more, like chat. A good payload also becomes the
 * cached one. A call while another for the same server is out joins it.
 * Throws JimError: waking (offline, a 503, a dropped connection or the
 * timeout; trying again is safe), denied, or server.
 */
export function fetchView(
  getToken: (force?: boolean) => Promise<string | null> = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API,
  timeoutMs: number = VIEW_TIMEOUT_MS
): Promise<ViewData> {
  if (inflight && inflight.api === api && inflight.generation === generation) {
    return inflight.promise;
  }
  const promise = loadView(getToken, fetchFn, api, timeoutMs, generation);
  const entry = { api, generation, promise };
  inflight = entry;
  const settle = () => {
    if (inflight === entry) inflight = null;
  };
  promise.then(settle, settle);
  return promise;
}

async function loadView(
  getToken: (force?: boolean) => Promise<string | null>,
  fetchFn: typeof fetch | undefined,
  api: string,
  timeoutMs: number,
  startedIn: number
): Promise<ViewData> {
  if (!isJimConnected(api)) throw new JimError("server");
  // Looked up here, so a missing fetch rejects instead of throwing.
  const doFetch = fetchFn ?? fetch;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new JimError("waking"));
    }, timeoutMs);
  });
  try {
    const data = await Promise.race([
      requestView(getToken, doFetch, api, controller.signal),
      timedOut,
    ]);
    // Signed out meanwhile: hand it back, but don't keep it.
    if (startedIn === generation) cache = { data, at: Date.now() };
    return data;
  } catch (err) {
    if (controller.signal.aborted) throw new JimError("waking");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function requestView(
  getToken: (force?: boolean) => Promise<string | null>,
  fetchFn: typeof fetch,
  api: string,
  signal: AbortSignal
): Promise<ViewData> {
  async function get(force: boolean): Promise<Response> {
    let token: string | null;
    try {
      token = await getToken(force);
    } catch (err) {
      throw new JimError(tokenErrorKind(err));
    }
    if (!token) throw new JimError("denied");
    if (isOffline()) throw new JimError("waking");
    try {
      return await fetchFn(`${api}/api/view`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
    } catch {
      throw new JimError("waking");
    }
  }

  let res = await get(false);
  if (res.status === 401) res = await get(true);
  if (res.status === 401 || res.status === 403) throw new JimError("denied");
  if (res.status === 503) throw new JimError("waking");
  if (!res.ok) throw new JimError("server");

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new JimError("waking");
  }
  const data = normalizeView(body);
  if (!data) throw new JimError("server");
  return data;
}

// ---------- writes, search and single notes ----------

/** Todo, search and note calls are small: past this the server is gone. */
export const CALL_TIMEOUT_MS = 15_000;

type GetToken = (force?: boolean) => Promise<string | null>;

/**
 * One signed-in call to Jim's server: the bearer token, a forced refresh and
 * one more try on a 401, and a time limit. Resolves to the response for any
 * other status. Throws JimError: waking (offline, no connection, the time
 * limit), denied (no user, a second 401, or a 403) or server (no URL).
 */
async function callJim(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
  getToken: GetToken,
  fetchFn: typeof fetch | undefined,
  api: string,
  timeoutMs: number
): Promise<Response> {
  if (!isJimConnected(api)) throw new JimError("server");
  const doFetch = fetchFn ?? fetch;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new JimError("waking"));
    }, timeoutMs);
  });

  async function send(force: boolean): Promise<Response> {
    let token: string | null;
    try {
      token = await getToken(force);
    } catch (err) {
      throw new JimError(tokenErrorKind(err));
    }
    if (!token) throw new JimError("denied");
    if (isOffline()) throw new JimError("waking");
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    try {
      return await doFetch(`${api}${path}`, {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });
    } catch {
      throw new JimError("waking");
    }
  }

  async function run(): Promise<Response> {
    let res = await send(false);
    if (res.status === 401) res = await send(true);
    if (res.status === 401 || res.status === 403) {
      throw new JimError("denied");
    }
    return res;
  }

  try {
    return await Promise.race([run(), timedOut]);
  } catch (err) {
    if (controller.signal.aborted) throw new JimError("waking");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export type TodoResult =
  | { ok: true; sha: string | null }
  | { ok: false; reason: "changed" | "failed" | "denied"; message: string };

export const TODO_MESSAGES = {
  changed: "That todo changed. Pull to refresh.",
  failed: "Couldn't save. Try again.",
  denied: "Jim didn't accept your sign-in. Sign out and back in.",
};

/**
 * Checks a todo off (or back on). The server finds the line by the
 * payload's `order`, `text`, `area` and `project` and refuses (409) if it
 * changed, so a stale list can never tick a different line. Never throws.
 */
export async function toggleTodo(
  todo: Pick<ViewTodo, "order" | "text" | "area" | "project">,
  done: boolean,
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API,
  timeoutMs: number = CALL_TIMEOUT_MS
): Promise<TodoResult> {
  let res: Response;
  try {
    res = await callJim(
      "/api/todo",
      {
        method: "POST",
        body: {
          order: todo.order,
          text: todo.text,
          // Tell apart lines whose text differs only in their tags.
          area: todo.area ?? "",
          project: todo.project ?? "",
          done,
        },
      },
      getToken,
      fetchFn,
      api,
      timeoutMs
    );
  } catch (err) {
    const reason =
      err instanceof JimError && err.kind === "denied" ? "denied" : "failed";
    return { ok: false, reason, message: TODO_MESSAGES[reason] };
  }
  if (res.status === 409) {
    const body = await readJson(res);
    const message =
      isRecord(body) && typeof body.error === "string" && body.error.trim()
        ? body.error
        : TODO_MESSAGES.changed;
    return { ok: false, reason: "changed", message };
  }
  if (!res.ok) {
    return { ok: false, reason: "failed", message: TODO_MESSAGES.failed };
  }
  const body = await readJson(res);
  return {
    ok: true,
    sha: isRecord(body) && typeof body.sha === "string" ? body.sha : null,
  };
}

export interface SearchResult {
  /** Repo-relative, e.g. "home/garden.md". */
  path: string;
  title: string;
  snippet: string;
}

/** The server takes at most this many characters. */
export const SEARCH_MAX = 100;

/**
 * Keyword search across the notes. Throws JimError: waking (a 503, offline,
 * the time limit), denied, or server.
 */
export async function searchNotes(
  query: string,
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API,
  timeoutMs: number = CALL_TIMEOUT_MS
): Promise<SearchResult[]> {
  // In the body, not the URL: request logs keep full URLs.
  const res = await callJim(
    "/api/search",
    { method: "POST", body: { q: query.slice(0, SEARCH_MAX) } },
    getToken,
    fetchFn,
    api,
    timeoutMs
  );
  if (res.status === 503) throw new JimError("waking");
  if (!res.ok) throw new JimError("server");
  const body = await readJson(res);
  if (!isRecord(body) || !Array.isArray(body.results)) {
    throw new JimError("server");
  }
  return body.results
    .filter(
      (r): r is SearchResult =>
        isRecord(r) &&
        typeof r.path === "string" &&
        typeof r.title === "string" &&
        typeof r.snippet === "string"
    )
    .map(({ path, title, snippet }) => ({ path, title, snippet }));
}

export interface Note {
  path: string;
  title: string;
  /** YYYY-MM-DD from the frontmatter, or "". */
  updated: string;
  /** The Markdown body, frontmatter removed. */
  body: string;
}

/**
 * One note by its repo-relative path; null when it isn't there (404).
 * Throws JimError: waking, denied, or server.
 */
export async function fetchNote(
  path: string,
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API,
  timeoutMs: number = CALL_TIMEOUT_MS
): Promise<Note | null> {
  const res = await callJim(
    "/api/note",
    { method: "POST", body: { path } },
    getToken,
    fetchFn,
    api,
    timeoutMs
  );
  if (res.status === 404) return null;
  if (res.status === 503) throw new JimError("waking");
  if (!res.ok) throw new JimError("server");
  const body = await readJson(res);
  if (
    !isRecord(body) ||
    typeof body.path !== "string" ||
    typeof body.title !== "string" ||
    typeof body.body !== "string"
  ) {
    throw new JimError("server");
  }
  return {
    path: body.path,
    title: body.title,
    updated: typeof body.updated === "string" ? body.updated : "",
    body: body.body,
  };
}
