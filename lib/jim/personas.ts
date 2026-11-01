import { getIdToken } from "@/lib/firebase/client";
import { JIM_API, JimError } from "@/lib/jim/api";
import { callJim, CALL_TIMEOUT_MS } from "@/lib/jim/view";

/**
 * Jim's personas (his voices, from cloud Jim): the list and the switch.
 * Switching commits and pushes on the server, so it can take a while.
 */

type GetToken = (force?: boolean) => Promise<string | null>;

export interface Persona {
  id: string;
  name: string;
  summary: string;
  examples: string[];
  /** The TTS voice this persona speaks in, when the server says. */
  voice: string | null;
}

export interface PersonaList {
  active: string;
  /** The active one first. */
  personas: Persona[];
  /** The server answered from an older copy of the list. */
  stale: boolean;
}

export type SwitchResult =
  { ok: true; active: string } | { ok: false; message: string };

/** A switch commits and pushes: up to ~20 s on a cold server, with room. */
export const SWITCH_TIMEOUT_MS = 45_000;

const NAME_KEY = "jim:persona-name";

export const PERSONA_MESSAGES = {
  load: "Couldn't load the personas. Try again.",
  denied: "Jim didn't accept your sign-in. Sign out and back in.",
  unknown: "Jim doesn't have that persona anymore.",
  busy: "Jim is busy. Try again in a moment.",
  unreachable: "Couldn't reach Jim. Try again.",
  failed: "Couldn't switch personas. Try again.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toPersona(value: unknown): Persona | null {
  if (!isRecord(value)) return null;
  const { id, name, summary, examples, voice } = value;
  if (typeof id !== "string" || !id) return null;
  return {
    id,
    name: typeof name === "string" && name ? name : id,
    summary: typeof summary === "string" ? summary : "",
    examples: Array.isArray(examples)
      ? examples.filter((e): e is string => typeof e === "string" && !!e)
      : [],
    voice: typeof voice === "string" && voice ? voice : null,
  };
}

/** Puts the active persona first, keeping the rest in order. */
export function activeFirst(list: PersonaList): PersonaList {
  const active = list.personas.filter((p) => p.id === list.active);
  const rest = list.personas.filter((p) => p.id !== list.active);
  return { ...list, personas: [...active, ...rest] };
}

/** The server's list, checked: malformed entries are dropped. */
export function parsePersonas(body: unknown): PersonaList | null {
  if (!isRecord(body) || !Array.isArray(body.personas)) return null;
  const personas = body.personas
    .map(toPersona)
    .filter((p): p is Persona => p !== null);
  const active = typeof body.active === "string" ? body.active : "";
  return activeFirst({ active, personas, stale: body.stale === true });
}

/** `POST /api/personas`. Throws JimError. */
export async function fetchPersonas(
  getToken: GetToken = getIdToken,
  api: string = JIM_API,
  fetchFn?: typeof fetch
): Promise<PersonaList> {
  const res = await callJim(
    "/api/personas",
    { method: "POST", body: {} },
    getToken,
    fetchFn,
    api,
    CALL_TIMEOUT_MS
  );
  if (res.status === 503) throw new JimError("waking");
  if (!res.ok) throw new JimError("server");
  const list = parsePersonas(await res.json().catch(() => null));
  if (!list) throw new JimError("server");
  return list;
}

async function errorText(res: Response): Promise<string | null> {
  const body: unknown = await res.json().catch(() => null);
  const error = isRecord(body) ? body.error : undefined;
  return typeof error === "string" && error.trim() ? error.trim() : null;
}

/** `POST /api/persona`: makes `id` the active persona. Never throws. */
export async function switchPersona(
  id: string,
  getToken: GetToken = getIdToken,
  api: string = JIM_API,
  fetchFn?: typeof fetch
): Promise<SwitchResult> {
  let res: Response;
  try {
    res = await callJim(
      "/api/persona",
      { method: "POST", body: { id } },
      getToken,
      fetchFn,
      api,
      SWITCH_TIMEOUT_MS
    );
  } catch (err) {
    const denied = err instanceof JimError && err.kind === "denied";
    return {
      ok: false,
      message: denied ? PERSONA_MESSAGES.denied : PERSONA_MESSAGES.unreachable,
    };
  }
  if (res.status === 404)
    return { ok: false, message: PERSONA_MESSAGES.unknown };
  if (res.status === 503) {
    return {
      ok: false,
      message: (await errorText(res)) ?? PERSONA_MESSAGES.busy,
    };
  }
  if (!res.ok) return { ok: false, message: PERSONA_MESSAGES.failed };
  const body: unknown = await res.json().catch(() => null);
  const active =
    isRecord(body) && typeof body.active === "string" && body.active
      ? body.active
      : id;
  return { ok: true, active };
}

/** The active persona's name as last seen on this device (for the menu). */
export function loadPersonaName(): string | null {
  try {
    return window.localStorage.getItem(NAME_KEY) || null;
  } catch {
    return null;
  }
}

export function savePersonaName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // Not remembered; the menu says "Persona" until the list loads again.
  }
}
