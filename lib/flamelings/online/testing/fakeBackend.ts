import type { PetCard } from "../../types";
import type { OnlineDeps } from "../client";

type Fields = Record<string, unknown>;

/**
 * An in-memory stand-in for the friend cards and visit inboxes on Firestore
 * (no rules: those are tested against the emulator). It speaks the REST
 * shapes client.ts uses.
 */
export function fakeBackend(uid = "me") {
  const docs = new Map<string, Fields>();
  const calls: { method: string; path: string }[] = [];
  let offline = false;
  /** Fake server time: each stamp is a millisecond later. */
  let clock = Date.UTC(2026, 10, 17, 12);

  const reply = (status: number, body: unknown = {}) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as Response;

  const pathOf = (url: string) =>
    decodeURIComponent(url.split("/documents/")[1].split("?")[0]);

  async function fetchImpl(url: string, init: RequestInit = {}) {
    if (offline) throw new TypeError("offline");
    const method = init.method ?? "GET";
    if (method === "POST" && url.includes(":runQuery")) {
      const parent = pathOf(url.replace(":runQuery", ""));
      calls.push({ method: "QUERY", path: parent });
      const q = JSON.parse(init.body as string).structuredQuery as {
        where: { fieldFilter: { value: { timestampValue: string } } };
        offset: number;
        limit: number;
      };
      const since = Date.parse(q.where.fieldFilter.value.timestampValue);
      const rows = [...docs.entries()]
        .filter(([key]) => key.startsWith(`${parent}/visits/`))
        .map(([key, fields]) => ({
          name: `projects/p/databases/(default)/documents/${key}`,
          fields,
          at: Date.parse(
            (fields.createdAt as { timestampValue: string }).timestampValue
          ),
        }))
        .filter((r) => r.at >= since)
        .sort((a, b) => a.at - b.at)
        .slice(q.offset, q.offset + q.limit)
        .map(({ name, fields }) => ({ document: { name, fields } }));
      return reply(200, rows.length ? rows : [{}]);
    }
    if (method === "POST") {
      const write = JSON.parse(init.body as string).writes[0] as {
        update: { name: string; fields: Fields };
        updateMask?: { fieldPaths: string[] };
        updateTransforms?: { fieldPath: string }[];
        currentDocument: { exists: boolean };
      };
      const path = write.update.name.split("/documents/")[1];
      calls.push({ method: "COMMIT", path });
      const exists = docs.has(path);
      if (write.currentDocument.exists !== exists) {
        return reply(409, { error: { status: "ALREADY_EXISTS" } });
      }
      const stamped: Fields = {};
      for (const t of write.updateTransforms ?? []) {
        stamped[t.fieldPath] = {
          timestampValue: new Date(clock++).toISOString(),
        };
      }
      // A mask keeps the stored fields it does not name (createdAt).
      docs.set(
        path,
        write.updateMask
          ? { ...docs.get(path), ...write.update.fields, ...stamped }
          : { ...write.update.fields, ...stamped }
      );
      return reply(200);
    }
    const path = pathOf(url);
    calls.push({ method, path });
    if (method === "DELETE") {
      docs.delete(path);
      return reply(200);
    }
    const found = docs.get(path);
    return found ? reply(200, { fields: found }) : reply(404);
  }

  const deps: OnlineDeps = {
    config: { apiKey: "KEY", authDomain: "x", projectId: "p", appId: "x" },
    fetchImpl: fetchImpl as unknown as typeof fetch,
    getSession: async () => ({ uid, idToken: "tok" }),
    getAppCheckHeaders: async () => ({}),
  };

  const s = (stringValue: string) => ({ stringValue });
  return {
    deps,
    calls,
    docs,
    setOffline(value: boolean) {
      offline = value;
    },
    /** Puts a friend's card online under `code`. */
    putCard(code: string, card: PetCard, owner = "them") {
      docs.set(`flPets/${code}`, {
        uid: s(owner),
        look: {
          mapValue: {
            fields: Object.fromEntries(
              Object.entries(card.look).map(([k, v]) => [k, s(v)])
            ),
          },
        },
        level: { integerValue: String(card.level) },
        stage: s(card.stage),
        form: s(card.form),
        nameId: { integerValue: String(card.nameId) },
        createdAt: { timestampValue: new Date(CARD_MS).toISOString() },
      });
    },
    /** A visit from `from` waiting in `to`'s inbox. */
    /** `order` makes later visits sort later (the fake server sorts by time). */
    putVisit(to: string, from: string, day = "2026-11-17", order = 0) {
      docs.set(`flPets/${to}/visits/${from}_${day}`, {
        from: s(from),
        day: s(day),
        createdAt: {
          timestampValue: new Date(VISIT_MS + order).toISOString(),
        },
      });
    },
    hasVisit(to: string, from: string, day = "2026-11-17") {
      return docs.has(`flPets/${to}/visits/${from}_${day}`);
    },
    cardCodes: () =>
      [...docs.keys()]
        .filter((k) => /^flPets\/[A-Z0-9]{6}$/.test(k))
        .map((k) => k.split("/")[1]),
  };
}

const CARD_MS = Date.UTC(2026, 10, 17, 11);
/** Visits sort after every card the fake server stamps. */
const VISIT_MS = Date.UTC(2026, 10, 17, 12) + 1_000_000;

export const FRIEND_CARD: PetCard = {
  look: {
    colour: "violet",
    shape: "puff",
    eyes: "dots",
    hat: "crown",
    face: "none",
    neck: "none",
  },
  level: 6,
  stage: "flame",
  form: "none",
  nameId: 12,
};
