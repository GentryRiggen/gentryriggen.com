import type { Page } from "@playwright/test";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
};

export const FRIEND_CODE = "GHJKMN";
const FRIEND_DOC = {
  uid: { stringValue: "friend-uid" },
  look: {
    mapValue: {
      fields: {
        colour: { stringValue: "violet" },
        shape: { stringValue: "puff" },
        eyes: { stringValue: "dots" },
        hat: { stringValue: "crown" },
        face: { stringValue: "none" },
        neck: { stringValue: "none" },
      },
    },
  },
  level: { integerValue: "6" },
  stage: { stringValue: "flame" },
  form: { stringValue: "none" },
  nameId: { integerValue: "12" },
};

export async function mockFriends(
  page: Page,
  opts: { offline?: boolean; isOffline?: () => boolean } = {}
) {
  const down = () => Boolean(opts.offline || opts.isOffline?.());
  const docs = new Map<string, Record<string, unknown>>();
  docs.set(`flPets/${FRIEND_CODE}`, FRIEND_DOC);
  await page.route("https://identitytoolkit.googleapis.com/**", (route) =>
    down()
      ? route.abort()
      : route.fulfill({
          headers: CORS,
          json: {
            idToken: "id",
            refreshToken: "refresh",
            localId: "me-uid",
            expiresIn: "3600",
          },
        })
  );
  await page.route("https://securetoken.googleapis.com/**", (route) =>
    down()
      ? route.abort()
      : route.fulfill({
          headers: CORS,
          json: {
            id_token: "id",
            refresh_token: "refresh",
            user_id: "me-uid",
            expires_in: "3600",
          },
        })
  );
  await page.route("https://firestore.googleapis.com/**", async (route) => {
    if (down()) return route.abort();
    const request = route.request();
    const method = request.method();
    if (method === "OPTIONS") return route.fulfill({ headers: CORS });
    const json = (status: number, body: unknown = {}) =>
      route.fulfill({ status, headers: CORS, json: body });
    if (method === "POST" && request.url().includes(":runQuery")) {
      const parent = decodeURIComponent(
        new URL(request.url()).pathname
          .split("/documents/")[1]
          .replace(":runQuery", "")
      );
      const rows = [...docs.entries()]
        .filter(([key]) => key.startsWith(`${parent}/visits/`))
        .map(([key, fields]) => ({
          document: { name: `x/documents/${key}`, fields },
        }));
      return json(200, rows.length ? rows : [{}]);
    }
    if (method === "POST") {
      const write = request.postDataJSON().writes[0] as {
        update: { name: string; fields: Record<string, unknown> };
        updateMask?: unknown;
        updateTransforms?: { fieldPath: string }[];
        currentDocument: { exists: boolean };
      };
      const path = write.update.name.split("/documents/")[1];
      if (docs.has(path) !== write.currentDocument.exists) {
        return json(409, { error: { status: "ALREADY_EXISTS" } });
      }
      const stamped: Record<string, unknown> = {};
      for (const t of write.updateTransforms ?? []) {
        stamped[t.fieldPath] = { timestampValue: new Date().toISOString() };
      }
      docs.set(path, {
        ...(write.updateMask ? docs.get(path) : {}),
        ...write.update.fields,
        ...stamped,
      });
      return json(200);
    }
    const path = decodeURIComponent(
      new URL(request.url()).pathname.split("/documents/")[1]
    );
    if (method === "DELETE") {
      docs.delete(path);
      return json(200);
    }
    const found = docs.get(path);
    return found ? json(200, { fields: found }) : json(404);
  });
  return {
    docs,
    myCode: () =>
      [...docs.keys()]
        .find(
          (k) => /^flPets\/[A-Z0-9]{6}$/.test(k) && !k.endsWith(FRIEND_CODE)
        )
        ?.split("/")[1],
    putVisit(to: string, from: string) {
      const day = new Date().toISOString().slice(0, 10);
      docs.set(`flPets/${to}/visits/${from}_${day}`, {
        from: { stringValue: from },
        day: { stringValue: day },
        createdAt: { timestampValue: new Date().toISOString() },
      });
    },
  };
}
