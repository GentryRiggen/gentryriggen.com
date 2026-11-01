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
  /** Repeats ("every 1 week"). Absent from an older server. */
  recurring?: boolean;
}

export interface CalendarEvent {
  subject: string;
  /** ISO time in UTC (an all-day event's date is its first 10 characters). */
  start: string;
  end: string;
  allDay: boolean;
  where?: string;
  /** Stable id (the meeting page's address). Absent from an older server. */
  id?: string;
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

/** One row of Home's "needs you" list; every string is ready to show. */
export interface ViewAction {
  /** What it is, e.g. "Todo", "Email", "1:1". */
  kind: string;
  title: string;
  /** When, worded: "1d late", "Tue, Nov 3 · in 3d". */
  when: string;
  /** "over" (late), "soon" (today or tomorrow) or "". */
  tone: "over" | "soon" | "";
  area: "work" | "personal" | "";
  /** The phrase to send to Jim in Chat. */
  ask: string;
  /** An https link to open it, or "". */
  link: string;
}

/** The daily word, sent only when it is dated today. */
export interface DailyWord {
  kind: string;
  title: string;
  text: string;
  source: string;
  apply: string;
}

/** A birthday, anniversary or renewal in the next 60 days. */
export interface UpcomingDate {
  kind: "birthday" | "anniversary" | "renewal";
  name: string;
  /** YYYY-MM-DD. */
  on: string;
  /** Days from today (0 is today). */
  days: number;
  /** The note it comes from. */
  path: string;
  /** The age a birthday turns, when the year is known. */
  turns: number | null;
}

export interface TeamWin {
  date: string;
  text: string;
}

export interface TeamMember {
  name: string;
  path: string;
  about: string;
  /** YYYY-MM-DD, or "". */
  nextOneOnOne: string;
  wins: number;
  /** The latest three, newest first. */
  recentWins: TeamWin[];
}

export interface WinsWeek {
  /** The Monday it starts, YYYY-MM-DD. */
  week: string;
  /** Wins per key in `winsKeys`. */
  counts: Record<string, number>;
}

export interface WorkMeeting {
  path: string;
  title: string;
  date: string;
  people: string[];
  projects: string[];
  /** The first summary bullets. */
  summary: string[];
}

export interface DirectoryStrength {
  name: string;
  gloss: string;
}

export interface DirectoryPerson {
  /** Row index, the key for managerId and reportIds. */
  id: number;
  name: string;
  title: string;
  team: string;
  location: string;
  email: string;
  cell: string;
  birthday: string;
  anniversary: string;
  disc: string;
  discGloss: string;
  strengths: DirectoryStrength[];
  managerId: number | null;
  managerName: string;
  reportIds: number[];
  /** Their people note, or "" when there is none. */
  path: string;
}

export interface WorkDirectory {
  updated: string;
  people: DirectoryPerson[];
}

export interface WorkData {
  team: TeamMember[];
  /** Twelve weeks, oldest first. */
  winsByWeek: WinsWeek[];
  /** "You" then up to two team members' first names. */
  winsKeys: string[];
  /** Newest first. */
  meetings: WorkMeeting[];
  directory: WorkDirectory;
}

export interface Noticed {
  kind: string;
  title: string;
  when: string;
  tone: "over" | "soon" | "";
  ask: string;
}

export interface MeetingAttendee {
  name: string;
  role: string;
  /** Repo path of their person note, or "". */
  path: string;
  /** When they last came up, or "". */
  last: string;
  todos: string[];
}

export interface MeetingCard {
  id: string;
  subject: string;
  start: string;
  end: string;
  where: string;
  attendees: MeetingAttendee[];
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
  /** The newer fields: absent from an older server. */
  actions?: ViewAction[];
  /** When the inbox and task snapshots were taken (ISO), or "". */
  actionsAsOf?: string;
  daily?: DailyWord | null;
  dates?: UpcomingDate[];
  work?: WorkData;
  /** Things the server noticed; each one is a prompt for Chat. */
  noticed?: Noticed[];
  /** Meeting cards by event id (today and tomorrow). */
  meetingCards?: Record<string, MeetingCard>;
  /** Tonight's reflection question. */
  reflection?: { question: string };
  /** Wins logged today. */
  winsToday?: number;
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

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

/** The entries of `value` that pass `ok`; [] when it isn't a list. */
function keep<T>(value: unknown, ok: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    const kept = ok(item);
    if (kept !== null) out.push(kept);
  }
  return out;
}

/** True when every named key of `r` is a string. */
function strings(r: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((k) => isString(r[k]));
}

const TONES = ["over", "soon", ""];
const AREAS = ["work", "personal", ""];
const DATE_KINDS = ["birthday", "anniversary", "renewal"];

function toAction(v: unknown): ViewAction | null {
  if (!isRecord(v) || !strings(v, ["kind", "title", "when", "ask", "link"])) {
    return null;
  }
  if (!TONES.includes(v.tone as string) || !AREAS.includes(v.area as string)) {
    return null;
  }
  const link = v.link as string;
  return {
    kind: v.kind as string,
    title: v.title as string,
    when: v.when as string,
    tone: v.tone as ViewAction["tone"],
    area: v.area as ViewAction["area"],
    ask: v.ask as string,
    // Rendered as a link: never anything but https.
    link: link.startsWith("https://") ? link : "",
  };
}

function toDaily(v: unknown): DailyWord | null {
  if (!isRecord(v)) return null;
  const text = (k: string) => (isString(v[k]) ? v[k] : "");
  const word = {
    kind: text("kind"),
    title: text("title"),
    text: text("text"),
    source: text("source"),
    apply: text("apply"),
  };
  return word.title || word.text ? word : null;
}

function toDate(v: unknown): UpcomingDate | null {
  if (
    !isRecord(v) ||
    !DATE_KINDS.includes(v.kind as string) ||
    !strings(v, ["name", "on", "path"]) ||
    !isNumber(v.days)
  ) {
    return null;
  }
  return {
    kind: v.kind as UpcomingDate["kind"],
    name: v.name as string,
    on: v.on as string,
    days: v.days,
    path: v.path as string,
    turns: isNumber(v.turns) ? v.turns : null,
  };
}

function toWin(v: unknown): TeamWin | null {
  return isRecord(v) && strings(v, ["date", "text"])
    ? { date: v.date as string, text: v.text as string }
    : null;
}

function toMember(v: unknown): TeamMember | null {
  if (
    !isRecord(v) ||
    !strings(v, ["name", "path", "about", "nextOneOnOne"]) ||
    !isNumber(v.wins)
  ) {
    return null;
  }
  return {
    name: v.name as string,
    path: v.path as string,
    about: v.about as string,
    nextOneOnOne: v.nextOneOnOne as string,
    wins: v.wins,
    recentWins: keep(v.recentWins, toWin),
  };
}

function toWeek(v: unknown): WinsWeek | null {
  if (!isRecord(v) || !isString(v.week) || !isRecord(v.counts)) return null;
  if (!Object.values(v.counts).every(isNumber)) return null;
  return { week: v.week, counts: v.counts as Record<string, number> };
}

function toMeeting(v: unknown): WorkMeeting | null {
  if (
    !isRecord(v) ||
    !strings(v, ["path", "title", "date"]) ||
    !isStrings(v.people) ||
    !isStrings(v.projects) ||
    !isStrings(v.summary)
  ) {
    return null;
  }
  return {
    path: v.path as string,
    title: v.title as string,
    date: v.date as string,
    people: v.people,
    projects: v.projects,
    summary: v.summary,
  };
}

const PERSON_TEXT = [
  "name",
  "title",
  "team",
  "location",
  "email",
  "cell",
  "birthday",
  "anniversary",
  "disc",
  "discGloss",
  "managerName",
  "path",
] as const;

function toStrength(v: unknown): DirectoryStrength | null {
  return isRecord(v) && strings(v, ["name", "gloss"])
    ? { name: v.name as string, gloss: v.gloss as string }
    : null;
}

function toDirectoryPerson(v: unknown): DirectoryPerson | null {
  if (
    !isRecord(v) ||
    !isNumber(v.id) ||
    !strings(v, [...PERSON_TEXT]) ||
    !(v.managerId === null || isNumber(v.managerId)) ||
    !Array.isArray(v.reportIds) ||
    !v.reportIds.every(isNumber)
  ) {
    return null;
  }
  const text = Object.fromEntries(
    PERSON_TEXT.map((k) => [k, v[k] as string])
  ) as Record<(typeof PERSON_TEXT)[number], string>;
  return {
    id: v.id,
    ...text,
    strengths: keep(v.strengths, toStrength),
    managerId: v.managerId as number | null,
    reportIds: v.reportIds as number[],
  };
}

function toWork(v: unknown): WorkData | undefined {
  if (!isRecord(v)) return undefined;
  const dir = isRecord(v.directory) ? v.directory : {};
  return {
    team: keep(v.team, toMember),
    winsByWeek: keep(v.winsByWeek, toWeek),
    winsKeys: keep(v.winsKeys, (k) => (isString(k) ? k : null)),
    meetings: keep(v.meetings, toMeeting),
    directory: {
      updated: isString(dir.updated) ? dir.updated : "",
      people: keep(dir.people, toDirectoryPerson),
    },
  };
}

/**
 * The payload with every list present, or null when it isn't a view at all.
 * Rendering then never trips on a key the server left out.
 */
function toNoticed(v: unknown): Noticed | null {
  if (!isRecord(v) || !strings(v, ["kind", "title", "when", "ask"]))
    return null;
  if (!TONES.includes(v.tone as string)) return null;
  if (v.title === "") return null;
  return {
    kind: v.kind as string,
    title: v.title as string,
    when: v.when as string,
    tone: v.tone as Noticed["tone"],
    ask: v.ask as string,
  };
}

function toAttendee(v: unknown): MeetingAttendee | null {
  if (!isRecord(v) || !isString(v.name) || v.name === "") return null;
  return {
    name: v.name,
    role: isString(v.role) ? v.role : "",
    path: isString(v.path) ? v.path : "",
    last: isString(v.last) ? v.last : "",
    todos: Array.isArray(v.todos) ? v.todos.filter(isString) : [],
  };
}

function toMeetingCard(v: unknown): MeetingCard | null {
  if (!isRecord(v) || !strings(v, ["id", "subject", "start", "end"])) {
    return null;
  }
  return {
    id: v.id as string,
    subject: v.subject as string,
    start: v.start as string,
    end: v.end as string,
    where: isString(v.where) ? v.where : "",
    attendees: keep(v.attendees, toAttendee),
  };
}

function toMeetingCards(v: unknown): Record<string, MeetingCard> | undefined {
  if (!isRecord(v)) return undefined;
  const out: Record<string, MeetingCard> = {};
  for (const [key, value] of Object.entries(v)) {
    const card = toMeetingCard(value);
    if (card) out[key] = card;
  }
  return out;
}

function toReflection(v: unknown): { question: string } | undefined {
  return isRecord(v) && isString(v.question) && v.question !== ""
    ? { question: v.question }
    : undefined;
}

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
    // The newer fields stay absent when an older server leaves them out;
    // inside them, a malformed entry is dropped and the rest kept.
    actions: "actions" in raw ? keep(raw.actions, toAction) : undefined,
    actionsAsOf:
      "actionsAsOf" in raw
        ? isString(raw.actionsAsOf)
          ? raw.actionsAsOf
          : ""
        : undefined,
    daily: "daily" in raw ? toDaily(raw.daily) : undefined,
    dates: "dates" in raw ? keep(raw.dates, toDate) : undefined,
    work: toWork(raw.work),
    noticed: "noticed" in raw ? keep(raw.noticed, toNoticed) : undefined,
    meetingCards: toMeetingCards(raw.meetingCards),
    reflection: toReflection(raw.reflection),
    winsToday: isNumber(raw.winsToday) ? raw.winsToday : undefined,
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

/** Keeps each good payload on the device too (set while signed in). */
let saver: ((data: ViewData) => void) | null = null;

export function setViewSaver(next: ((data: ViewData) => void) | null): void {
  saver = next;
}

export function clearViewCache(): void {
  cache = null;
  inflight = null;
  saver = null;
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
    if (startedIn === generation) {
      cache = { data, at: Date.now() };
      saver?.(data);
    }
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
 * `signal` lets the caller drop the call (it then throws waking).
 */
export async function callJim(
  path: string,
  init: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
  getToken: GetToken,
  fetchFn: typeof fetch | undefined,
  api: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<Response> {
  if (!isJimConnected(api)) throw new JimError("server");
  if (signal?.aborted) throw new JimError("waking");
  const doFetch = fetchFn ?? fetch;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dropped: () => void = () => {};
  const timedOut = new Promise<never>((_resolve, reject) => {
    dropped = () => {
      controller.abort();
      reject(new JimError("waking"));
    };
    timer = setTimeout(dropped, timeoutMs);
  });
  signal?.addEventListener("abort", dropped, { once: true });
  // Also after this resolves: the body may still be streaming in, and the
  // caller's abort must stop that too.
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

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
    signal?.removeEventListener("abort", dropped);
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
