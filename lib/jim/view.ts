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

export function clearViewCache(): void {
  cache = null;
}

/**
 * Fetches the Notes data. On a 401 the ID token is force-refreshed and the
 * request is tried once more, like chat. A good payload also becomes the
 * cached one. Throws JimError: waking (offline, a 503, a dropped connection
 * or the timeout; trying again is safe), denied, or server.
 */
export async function fetchView(
  getToken: (force?: boolean) => Promise<string | null> = getIdToken,
  fetchFn: typeof fetch = fetch,
  api: string = JIM_API,
  timeoutMs: number = VIEW_TIMEOUT_MS
): Promise<ViewData> {
  if (!isJimConnected(api)) throw new JimError("server");
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
      requestView(getToken, fetchFn, api, controller.signal),
      timedOut,
    ]);
    cache = { data, at: Date.now() };
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
