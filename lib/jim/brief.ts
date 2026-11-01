import { getIdToken } from "@/lib/firebase/client";
import { JIM_API, JimError } from "@/lib/jim/api";
import { callJim } from "@/lib/jim/view";

export interface BriefScript {
  /** YYYY-MM-DD the script is for. */
  day: string;
  text: string;
}

type GetToken = (force?: boolean) => Promise<string | null>;

/** Writing a script can take a model call: longer than a todo tick. */
const BRIEF_TIMEOUT_MS = 60_000;

/**
 * The morning brief as plain text to read aloud. `fresh` asks for a rewrite
 * (limited per day: the server's 429 text comes back as the Error message).
 */
export async function fetchBriefScript(
  getToken: GetToken = getIdToken,
  { fresh = false }: { fresh?: boolean } = {},
  fetchFn?: typeof fetch,
  api: string = JIM_API
): Promise<BriefScript> {
  const res = await callJim(
    "/api/brief/script",
    { method: "POST", body: fresh ? { fresh: true } : {} },
    getToken,
    fetchFn,
    api,
    BRIEF_TIMEOUT_MS
  );
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  const rec =
    typeof json === "object" && json !== null
      ? (json as Record<string, unknown>)
      : {};
  if (res.status === 429 || res.status === 400) {
    throw new Error(
      typeof rec.error === "string" && rec.error.trim()
        ? rec.error
        : "Couldn't get the brief."
    );
  }
  if (!res.ok) throw new JimError("server");
  if (typeof rec.day !== "string" || typeof rec.text !== "string") {
    throw new JimError("server");
  }
  return { day: rec.day, text: rec.text };
}
