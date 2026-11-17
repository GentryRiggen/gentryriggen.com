import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase/config";
import { getIdToken } from "@/lib/leaderboard/auth";
import {
  documentsUrl,
  commitUrl,
  int,
  leaderboardAppCheckHeaders,
  type ClientDeps,
  type FirestoreValue,
} from "@/lib/leaderboard/client";
import type { PetCard } from "../types";
import { isCode, parseCard } from "./card";

/** The anonymous account Flamelings friends use (not shared with the leaderboards). */
export const FLAMELINGS_AUTH_KEY = "flamelings:auth";
const DEFAULT_BASE_URL = "https://firestore.googleapis.com";

/**
 * How a write ended: accepted, refused by the rules (403), already there
 * (a code taken, a visit already left today), or not delivered at all.
 */
export type WriteResult = "ok" | "refused" | "conflict" | "error";

export type OnlineDeps = ClientDeps & { now?: () => number };

interface Session {
  uid: string;
  idToken: string;
}

interface Ready {
  config: typeof firebaseConfig;
  session: Session;
  fetchImpl: typeof fetch;
  base: string;
  headers: Record<string, string>;
}

/** The pieces every call needs, or null when offline, unconfigured or signed out. */
async function prepare(deps: OnlineDeps): Promise<Ready | null> {
  const config = deps.config ?? firebaseConfig;
  if (!isFirebaseConfigured(config)) return null;
  const session = await (
    deps.getSession ?? (() => getIdToken({ storageKey: FLAMELINGS_AUTH_KEY }))
  )();
  if (!session) return null;
  return {
    config,
    session,
    fetchImpl: deps.fetchImpl ?? ((...args) => fetch(...args)),
    base: documentsUrl(config, deps.baseUrl ?? DEFAULT_BASE_URL),
    headers: {
      Authorization: `Bearer ${session.idToken}`,
      ...(await leaderboardAppCheckHeaders(deps)),
    },
  };
}

const str = (stringValue: string): FirestoreValue => ({ stringValue });

function cardFields(
  card: PetCard,
  uid: string
): Record<string, FirestoreValue> {
  return {
    uid: str(uid),
    look: {
      mapValue: {
        fields: {
          colour: str(card.look.colour),
          shape: str(card.look.shape),
          eyes: str(card.look.eyes),
          hat: str(card.look.hat),
          face: str(card.look.face),
          neck: str(card.look.neck),
        },
      },
    },
    level: int(card.level),
    stage: str(card.stage),
    form: str(card.form),
    nameId: int(card.nameId),
  };
}

function resultOf(status: number, body: unknown): WriteResult {
  if (status >= 200 && status < 300) return "ok";
  if (status === 403) return "refused";
  const code = (body as { error?: { status?: unknown } } | null)?.error?.status;
  if (
    status === 409 ||
    code === "ALREADY_EXISTS" ||
    code === "FAILED_PRECONDITION"
  ) {
    return "conflict";
  }
  return "error";
}

/** One commit of a single document write. Never throws. */
async function commitOne(
  path: string,
  fields: Record<string, FirestoreValue>,
  stamps: readonly ("updatedAt" | "createdAt")[],
  exists: boolean,
  deps: OnlineDeps,
  /** Only these fields change (the rest of the document stays as it is). */
  mask?: readonly string[]
): Promise<WriteResult> {
  try {
    const ready = await prepare(deps);
    if (!ready) return "error";
    const body = {
      writes: [
        {
          update: {
            name: `projects/${ready.config.projectId}/databases/(default)/documents/${path}`,
            fields,
          },
          ...(mask ? { updateMask: { fieldPaths: [...mask] } } : {}),
          updateTransforms: stamps.map((fieldPath) => ({
            fieldPath,
            setToServerValue: "REQUEST_TIME",
          })),
          currentDocument: { exists },
        },
      ],
    };
    const response = await ready.fetchImpl(
      commitUrl(ready.config, deps.baseUrl),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...ready.headers },
        body: JSON.stringify(body),
      }
    );
    let json: unknown = null;
    if (!response.ok) {
      try {
        json = await response.json();
      } catch {
        // Not JSON.
      }
    }
    return resultOf(response.status, json);
  } catch {
    return "error";
  }
}

async function withUid(deps: OnlineDeps): Promise<{ uid: string } | null> {
  try {
    const session = await (
      deps.getSession ?? (() => getIdToken({ storageKey: FLAMELINGS_AUTH_KEY }))
    )();
    return session ? { uid: session.uid } : null;
  } catch {
    return null;
  }
}

/** Creates the card at `code`; "conflict" or "refused" mean the code is taken. */
export async function createCard(
  code: string,
  card: PetCard,
  deps: OnlineDeps = {}
): Promise<WriteResult> {
  if (!isCode(code)) return "error";
  const who = await withUid(deps);
  if (!who) return "error";
  return commitOne(
    `flPets/${code}`,
    cardFields(card, who.uid),
    ["updatedAt", "createdAt"],
    false,
    deps
  );
}

/** Replaces the card's fields (the owner only, at most every 10 seconds). */
export async function updateCard(
  code: string,
  card: PetCard,
  deps: OnlineDeps = {}
): Promise<WriteResult> {
  if (!isCode(code)) return "error";
  const who = await withUid(deps);
  if (!who) return "error";
  return commitOne(
    `flPets/${code}`,
    cardFields(card, who.uid),
    ["updatedAt"],
    true,
    deps,
    // createdAt is set once at create and the rules keep it unchanged.
    ["uid", "look", "level", "stage", "form", "nameId"]
  );
}

/** Claims a fresh code for the card, retrying when a code is taken. Null when it could not. */
export async function registerCard(
  card: PetCard,
  generate: () => string,
  deps: OnlineDeps = {},
  tries = 5
): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    const code = generate();
    const result = await createCard(code, card, deps);
    if (result === "ok") return code;
    // "error" is offline or a server fault: another code will not help.
    if (result === "error") return null;
  }
  return null;
}

export type CardLookup =
  { kind: "found"; card: PetCard } | { kind: "missing" } | { kind: "error" };

function stringOf(field: unknown): string | null {
  const v = (field as { stringValue?: unknown } | undefined)?.stringValue;
  return typeof v === "string" ? v : null;
}

function mapFields(field: unknown): Record<string, unknown> | null {
  const f = (field as { mapValue?: { fields?: unknown } } | undefined)?.mapValue
    ?.fields;
  return typeof f === "object" && f !== null
    ? (f as Record<string, unknown>)
    : null;
}

function intOf(field: unknown): number | null {
  const v = (field as { integerValue?: unknown } | undefined)?.integerValue;
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
}

/** A stored card document's fields as a checked PetCard, or null. */
export function cardFromFields(
  fields: Record<string, unknown>
): PetCard | null {
  const look = mapFields(fields.look);
  if (!look) return null;
  return parseCard({
    look: {
      colour: stringOf(look.colour),
      shape: stringOf(look.shape),
      eyes: stringOf(look.eyes),
      hat: stringOf(look.hat),
      face: stringOf(look.face),
      neck: stringOf(look.neck),
    },
    level: intOf(fields.level),
    stage: stringOf(fields.stage),
    form: stringOf(fields.form),
    nameId: intOf(fields.nameId),
  });
}

/** Reads one card by code. Never throws. */
export async function getCard(
  code: string,
  deps: OnlineDeps = {}
): Promise<CardLookup> {
  if (!isCode(code)) return { kind: "missing" };
  try {
    const ready = await prepare(deps);
    if (!ready) return { kind: "error" };
    const response = await ready.fetchImpl(
      `${ready.base}/flPets/${code}?key=${ready.config.apiKey}`,
      { method: "GET", headers: ready.headers }
    );
    if (response.status === 404) return { kind: "missing" };
    if (!response.ok) return { kind: "error" };
    const json = (await response.json()) as { fields?: unknown } | null;
    const fields = json?.fields;
    if (typeof fields !== "object" || fields === null) {
      return { kind: "error" };
    }
    const card = cardFromFields(fields as Record<string, unknown>);
    // A card this build cannot read (a newer catalog) is shown as missing.
    return card ? { kind: "found", card } : { kind: "missing" };
  } catch {
    return { kind: "error" };
  }
}

/** The UTC day, as the rules compare it with the server's. */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Leaves a playdate visit in `to`'s inbox, from the pet with code `from`. */
export async function createVisit(
  from: string,
  to: string,
  deps: OnlineDeps = {}
): Promise<WriteResult> {
  if (!isCode(from) || !isCode(to) || from === to) return "error";
  const day = utcDay((deps.now ?? Date.now)());
  return commitOne(
    `flPets/${to}/visits/${from}_${day}`,
    { from: str(from), day: str(day) },
    ["createdAt"],
    false,
    deps
  );
}

export interface Visit {
  /** The visit document's id, `<from>_<day>`. */
  id: string;
  from: string;
}

/** Documents read per request, and per inbox scan (a flood is drained over several opens). */
export const INBOX_PAGE = 250;
export const INBOX_SCAN_MAX = 1000;

/**
 * The visits waiting in `code`'s inbox (the owner only), oldest first, up to
 * `max` of them, or null on failure. Only visits left since the card was
 * created are listed (the rules require the query to say so). Never throws.
 */
export async function listVisits(
  code: string,
  deps: OnlineDeps = {},
  max = INBOX_SCAN_MAX
): Promise<Visit[] | null> {
  if (!isCode(code)) return null;
  try {
    const ready = await prepare(deps);
    if (!ready) return null;
    const own = await ready.fetchImpl(
      `${ready.base}/flPets/${code}?key=${ready.config.apiKey}`,
      { method: "GET", headers: ready.headers }
    );
    if (!own.ok) return null;
    const created = (
      (await own.json()) as {
        fields?: { createdAt?: { timestampValue?: unknown } };
      } | null
    )?.fields?.createdAt?.timestampValue;
    if (typeof created !== "string") return null;
    const visits: Visit[] = [];
    for (let offset = 0; offset < max; offset += INBOX_PAGE) {
      const response = await ready.fetchImpl(
        `${ready.base}/flPets/${code}:runQuery?key=${ready.config.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...ready.headers },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: "visits" }],
              where: {
                fieldFilter: {
                  field: { fieldPath: "createdAt" },
                  op: "GREATER_THAN_OR_EQUAL",
                  value: { timestampValue: created },
                },
              },
              orderBy: [
                { field: { fieldPath: "createdAt" }, direction: "ASCENDING" },
              ],
              offset,
              limit: Math.min(INBOX_PAGE, max - offset),
            },
          }),
        }
      );
      if (!response.ok) return offset === 0 ? null : visits;
      const rows = (await response.json()) as unknown;
      const docs = (Array.isArray(rows) ? rows : []).flatMap(
        (r: { document?: { name?: unknown; fields?: unknown } }) =>
          r.document ? [r.document] : []
      );
      for (const d of docs) {
        const id = typeof d.name === "string" ? d.name.split("/").pop() : null;
        const fields = d.fields as Record<string, unknown> | undefined;
        const from = stringOf(fields?.from);
        const day = stringOf(fields?.day);
        if (id && isCode(from) && day && id === `${from}_${day}`) {
          visits.push({ id, from });
        }
      }
      if (docs.length < INBOX_PAGE) break;
    }
    return visits;
  } catch {
    return null;
  }
}

/** Removes a visit from the inbox (the owner only). True when it is gone. */
export async function deleteVisit(
  code: string,
  id: string,
  deps: OnlineDeps = {}
): Promise<boolean> {
  if (!isCode(code) || !/^[A-Z0-9]{6}_\d{4}-\d{2}-\d{2}$/.test(id)) {
    return false;
  }
  try {
    const ready = await prepare(deps);
    if (!ready) return false;
    const response = await ready.fetchImpl(
      `${ready.base}/flPets/${code}/visits/${id}?key=${ready.config.apiKey}`,
      { method: "DELETE", headers: ready.headers }
    );
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}
