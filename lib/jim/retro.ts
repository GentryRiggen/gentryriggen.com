import { JimError } from "@/lib/jim/api";
import type { RetroKind } from "@/lib/jim/routes";
import { CALL_TIMEOUT_MS, callJim } from "@/lib/jim/view";

export interface RetroSave {
  kind: RetroKind;
  /** The day the page loaded with (an evening saved after midnight keeps its day). */
  day: string;
  /** By position, matching the server's questions; "" for a skipped one. */
  answers: string[];
}

export const RETRO_MESSAGES = {
  unavailable: "Your retro isn't available yet.",
  failed: "Couldn't save. Try again in a moment.",
  denied: "Jim didn't accept your sign-in. Sign out and back in.",
};

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

function serverWords(body: unknown): string | null {
  return isRecord(body) && typeof body.error === "string" && body.error.trim()
    ? body.error
    : null;
}

/**
 * Saves one retro. Throws a plain Error whose message is ready to show:
 * the server's own words for a refusal, or one of RETRO_MESSAGES.
 */
export async function saveRetro(
  getToken: GetToken,
  api: string,
  body: RetroSave,
  fetchFn?: typeof fetch
): Promise<{ sha: string | null }> {
  let res: Response;
  try {
    res = await callJim(
      "/api/retro",
      {
        method: "POST",
        body: { kind: body.kind, day: body.day, answers: body.answers },
      },
      getToken,
      fetchFn,
      api,
      CALL_TIMEOUT_MS
    );
  } catch (err) {
    const denied = err instanceof JimError && err.kind === "denied";
    throw new Error(denied ? RETRO_MESSAGES.denied : RETRO_MESSAGES.failed);
  }
  if (res.status === 404) throw new Error(RETRO_MESSAGES.unavailable);
  const json = await readJson(res);
  if (!res.ok) throw new Error(serverWords(json) ?? RETRO_MESSAGES.failed);
  return {
    sha: isRecord(json) && typeof json.sha === "string" ? json.sha : null,
  };
}
