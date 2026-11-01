import { getIdToken } from "@/lib/firebase/client";
import { JIM_API, JimError } from "@/lib/jim/api";
import { CALL_TIMEOUT_MS, callJim } from "@/lib/jim/view";

export interface PushKind {
  id: string;
  label: string;
  on: boolean;
}

export interface PushSettings {
  kinds: PushKind[];
  /** "HH:MM", 17:00 to 21:45. */
  eveningTime: string;
  /** "HH:MM", 06:30 to 21:45. */
  lessonTime: string;
}

export interface PushSettingsPatch {
  kinds?: Record<string, boolean>;
  eveningTime?: string;
  lessonTime?: string;
}

type GetToken = (force?: boolean) => Promise<string | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSettings(v: unknown): PushSettings | null {
  if (!isRecord(v) || !Array.isArray(v.kinds)) return null;
  if (typeof v.eveningTime !== "string" || typeof v.lessonTime !== "string") {
    return null;
  }
  const kinds: PushKind[] = [];
  for (const k of v.kinds) {
    if (
      isRecord(k) &&
      typeof k.id === "string" &&
      typeof k.label === "string" &&
      typeof k.on === "boolean"
    ) {
      kinds.push({ id: k.id, label: k.label, on: k.on });
    }
  }
  return { kinds, eveningTime: v.eveningTime, lessonTime: v.lessonTime };
}

async function run(
  method: "GET" | "PUT",
  body: PushSettingsPatch | undefined,
  getToken: GetToken,
  fetchFn: typeof fetch | undefined,
  api: string
): Promise<PushSettings> {
  const res = await callJim(
    "/api/push/settings",
    { method, body },
    getToken,
    fetchFn,
    api,
    CALL_TIMEOUT_MS
  );
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (res.status >= 500) throw new JimError("server");
  if (!res.ok) {
    const text =
      isRecord(json) && typeof json.error === "string" && json.error.trim()
        ? json.error
        : "Couldn't save that setting.";
    throw new Error(text);
  }
  const settings = toSettings(json);
  if (!settings) throw new JimError("server");
  return settings;
}

export function getPushSettings(
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API
): Promise<PushSettings> {
  return run("GET", undefined, getToken, fetchFn, api);
}

export function putPushSettings(
  patch: PushSettingsPatch,
  getToken: GetToken = getIdToken,
  fetchFn?: typeof fetch,
  api: string = JIM_API
): Promise<PushSettings> {
  return run("PUT", patch, getToken, fetchFn, api);
}
