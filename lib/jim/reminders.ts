import { getIdToken } from "@/lib/firebase/client";
import { JIM_API, JimError } from "@/lib/jim/api";
import { CALL_TIMEOUT_MS, callJim } from "@/lib/jim/view";

/** A reminder as the server sends it. `when` is ready to show. */
export interface Reminder {
  /** 12 lowercase hex. */
  id: string;
  /** ISO time with offset, minute precision. */
  at: string;
  text: string;
  created: string;
  /** The `at` it was sent for, or null. */
  sent: string | null;
  rev: number;
  /** "Today 3:30 PM". */
  when: string;
}

export type Snooze = "10m" | "1h" | "tomorrow";

/** Exactly one field. */
export type ReminderPatch =
  { at: string } | { snooze: Snooze } | { text: string };

type GetToken = (force?: boolean) => Promise<string | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** The text the server gave for a refusal, or a fallback. */
async function refusal(res: Response, fallback: string): Promise<Error> {
  const body = await readJson(res);
  const text =
    isRecord(body) && typeof body.error === "string" && body.error.trim()
      ? body.error
      : fallback;
  return new Error(text);
}

export function toReminder(v: unknown): Reminder | null {
  if (!isRecord(v)) return null;
  if (
    typeof v.id !== "string" ||
    typeof v.at !== "string" ||
    typeof v.text !== "string" ||
    typeof v.created !== "string" ||
    typeof v.when !== "string"
  ) {
    return null;
  }
  return {
    id: v.id,
    at: v.at,
    text: v.text,
    created: v.created,
    sent: typeof v.sent === "string" ? v.sent : null,
    rev: typeof v.rev === "number" ? v.rev : 0,
    when: v.when,
  };
}

/**
 * One reminders call. Throws JimError for waking / denied / server (a 5xx is
 * "server"), and a plain Error carrying the server's own words for a 400.
 */
async function call(
  path: string,
  init: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown },
  getToken: GetToken,
  fetchFn: typeof fetch | undefined,
  api: string,
  fallback: string
): Promise<Response> {
  const res = await callJim(
    path,
    init,
    getToken,
    fetchFn,
    api,
    CALL_TIMEOUT_MS
  );
  if (res.status >= 500) throw new JimError("server");
  if (res.status === 404) throw new Error("not found");
  if (!res.ok) throw await refusal(res, fallback);
  return res;
}

export async function listReminders(
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API
): Promise<Reminder[]> {
  const res = await call(
    "/api/reminders",
    { method: "GET" },
    getToken,
    fetchFn,
    api,
    "Couldn't load reminders."
  );
  const body = await readJson(res);
  const rows =
    isRecord(body) && Array.isArray(body.reminders) ? body.reminders : [];
  return rows.map(toReminder).filter((r): r is Reminder => r !== null);
}

/** One reminder, or null when it's gone. */
export async function getReminder(
  id: string,
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API
): Promise<Reminder | null> {
  try {
    const res = await call(
      `/api/reminders/${id}`,
      { method: "GET" },
      getToken,
      fetchFn,
      api,
      "Couldn't load that reminder."
    );
    return toReminder(await readJson(res));
  } catch (err) {
    if (err instanceof Error && err.message === "not found") return null;
    throw err;
  }
}

/** `at` is "YYYY-MM-DDTHH:MM" (the server's time zone) or an ISO time with offset. */
export async function addReminder(
  at: string,
  text: string,
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API
): Promise<Reminder> {
  const res = await call(
    "/api/reminders",
    { method: "POST", body: { at, text } },
    getToken,
    fetchFn,
    api,
    "Couldn't add that reminder."
  );
  const reminder = toReminder(await readJson(res));
  if (!reminder) throw new JimError("server");
  return reminder;
}

export async function patchReminder(
  id: string,
  body: ReminderPatch,
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API
): Promise<Reminder> {
  const res = await call(
    `/api/reminders/${id}`,
    { method: "PATCH", body },
    getToken,
    fetchFn,
    api,
    "Couldn't change that reminder."
  );
  const reminder = toReminder(await readJson(res));
  if (!reminder) throw new JimError("server");
  return reminder;
}

/** "Done": the server removes it (absent is fine too). */
export async function doneReminder(
  id: string,
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API
): Promise<void> {
  try {
    await call(
      `/api/reminders/${id}`,
      { method: "DELETE" },
      getToken,
      fetchFn,
      api,
      "Couldn't finish that reminder."
    );
  } catch (err) {
    if (err instanceof Error && err.message === "not found") return;
    throw err;
  }
}
