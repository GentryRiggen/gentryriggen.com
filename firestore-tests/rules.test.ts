import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { buildCommitBody, commitUrl, sendPageview } from "@/lib/analytics/send";
import type { PageviewEvent } from "@/lib/analytics/types";

const PROJECT_ID = "demo-gentryriggen";
const [HOST, PORT] = (
  process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080"
).split(":");

const valid: PageviewEvent = {
  site: "ship-builder",
  path: "/ship-builder",
  ref: "google.com",
  device: "desktop",
  browser: "Chrome",
  os: "macOS",
  screen: "1440+",
  tz: "America/Denver",
  vid: "0123456789abcdef",
};

const homeEvent: PageviewEvent = { ...valid, site: "home", path: "/" };

const config = {
  apiKey: "emulator",
  authDomain: "x",
  projectId: PROJECT_ID,
  appId: "x",
};
const baseUrl = `http://${HOST}:${PORT}`;
const ADMIN_EMAIL = "gentry.riggen@gmail.com";
// Keep in sync with ADMIN_UID in lib/analytics/admin.ts and firestore.rules.
const ADMIN_UID = "nmt3n9sdfCX2NfzVlTdyXsWzHqm2";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: HOST,
      port: Number(PORT),
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

type Provider = "google.com" | "password" | "anonymous";

/**
 * Firestore client for a signed-in user. The emulator takes the uid directly
 * and merges the token claims below into request.auth.token, so
 * `firebase: { sign_in_provider }` mirrors a real Firebase ID token.
 * Pass `provider: null` to omit the firebase claim entirely.
 */
function signedIn(
  uid: string,
  opts: {
    email?: string;
    verified?: boolean;
    provider?: Provider | null;
  } = {}
) {
  const { email, verified = true, provider = "password" } = opts;
  return env
    .authenticatedContext(uid, {
      ...(email === undefined ? {} : { email, email_verified: verified }),
      ...(provider === null
        ? {}
        : { firebase: { sign_in_provider: provider } }),
    })
    .firestore();
}

const anon = () => env.unauthenticatedContext().firestore();
const admin = () => signedIn(ADMIN_UID, { email: ADMIN_EMAIL });

const stamped = (patch: Record<string, unknown> = {}) => ({
  ...valid,
  ts: serverTimestamp(),
  ...patch,
});

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "pageviews/seed"), {
      ...valid,
      ts: new Date(),
    });
  });
}

async function rest(docId: string, event: unknown, precondition = true) {
  const body = buildCommitBody(PROJECT_ID, docId, event as PageviewEvent);
  if (!precondition) {
    delete (body.writes[0] as { currentDocument?: unknown }).currentDocument;
  }
  return fetch(commitUrl(config, baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("create", () => {
  it("allows a valid pageview from anyone (SDK)", async () => {
    await assertSucceeds(addDoc(collection(anon(), "pageviews"), stamped()));
  });

  it.each([
    ["a home event", { site: "home", path: "/" }],
    ["a ship-builder subpath", { path: "/ship-builder/versions" }],
  ])("allows %s", async (_label, patch) => {
    await assertSucceeds(
      addDoc(collection(anon(), "pageviews"), stamped(patch))
    );
  });

  it("allows the exact REST request the tracker sends", async () => {
    const before = Date.now();
    const ok = await sendPageview(valid, { config, baseUrl });
    expect(ok).toBe(true);
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDocs(collection(ctx.firestore(), "pageviews"));
      expect(snap.size).toBe(1);
      const ts = snap.docs[0].data().ts;
      expect(typeof ts.toMillis).toBe("function");
      expect(Math.abs(ts.toMillis() - before)).toBeLessThan(10_000);
    });
  });

  it("allows the REST request for a home event", async () => {
    expect(await sendPageview(homeEvent, { config, baseUrl })).toBe(true);
  });

  it("rejects an invalid REST request with 403 PERMISSION_DENIED", async () => {
    const response = await rest("bad1", { ...valid, extra: "nope" });
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("PERMISSION_DENIED");
  });

  it("rejects a REST overwrite of an existing id (no precondition)", async () => {
    await seed();
    const response = await rest(
      "seed",
      { ...valid, path: "/ship-builder/x" },
      false
    );
    expect(response.status).toBe(403);
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(doc(ctx.firestore(), "pageviews/seed"));
      expect(snap.data()?.path).toBe(valid.path);
    });
  });

  const reject: [string, Record<string, unknown>][] = [
    ["an extra field", { extra: "x" }],
    ["a client-supplied timestamp", { ts: new Date() }],
    ["a null timestamp", { ts: null }],
    ["a string timestamp", { ts: "now" }],
    ["an unknown site", { site: "blog" }],
    ["an unknown device", { device: "fridge" }],
    ["an unknown screen bucket", { screen: "huge" }],
    ["an empty path", { path: "" }],
    ["a path not starting with a slash", { site: "home", path: "x" }],
    ["home with a ship-builder path", { site: "home", path: "/ship-builder" }],
    ["ship-builder with the home path", { site: "ship-builder", path: "/" }],
    ["a ship-builder lookalike path", { path: "/ship-builderx" }],
    ["an oversized path", { path: "/ship-builder/" + "a".repeat(250) }],
    ["a short visitor id", { vid: "short" }],
    ["an empty browser", { browser: "" }],
    ["an empty os", { os: "" }],
    ["a non-string path", { path: 42 }],
    ["site as a list", { site: ["home"] }],
    ["site as a map", { site: { a: "home" } }],
    ["site as null", { site: null }],
    ["device as a number", { device: 1 }],
    ["screen as a number", { screen: 1 }],
    ["ref as a number", { ref: 1 }],
    ["tz as a number", { tz: 1 }],
    ["vid as a number", { vid: 12345678 }],
    ["browser as a list", { browser: ["Chrome"] }],
    ["os as a map", { os: { a: "b" } }],
  ];
  it.each(reject)("rejects %s", async (_label, patch) => {
    await assertFails(addDoc(collection(anon(), "pageviews"), stamped(patch)));
  });

  const lengths: [string, Record<string, unknown>, boolean][] = [
    ["path 200", { path: "/ship-builder/" + "a".repeat(186) }, true],
    ["path 201", { path: "/ship-builder/" + "a".repeat(187) }, false],
    ["ref 100", { ref: "a".repeat(100) }, true],
    ["ref 101", { ref: "a".repeat(101) }, false],
    ["empty ref", { ref: "" }, true],
    ["browser 30", { browser: "a".repeat(30) }, true],
    ["browser 31", { browser: "a".repeat(31) }, false],
    ["os 30", { os: "a".repeat(30) }, true],
    ["os 31", { os: "a".repeat(31) }, false],
    ["tz 64", { tz: "a".repeat(64) }, true],
    ["tz 65", { tz: "a".repeat(65) }, false],
    ["empty tz", { tz: "" }, true],
    ["vid 8", { vid: "a".repeat(8) }, true],
    ["vid 7", { vid: "a".repeat(7) }, false],
    ["vid 64", { vid: "a".repeat(64) }, true],
    ["vid 65", { vid: "a".repeat(65) }, false],
  ];
  it.each(lengths)("length boundary: %s", async (_label, patch, accepted) => {
    const write = addDoc(collection(anon(), "pageviews"), stamped(patch));
    await (accepted ? assertSucceeds(write) : assertFails(write));
  });

  it("accepts a 64-char doc id and rejects 65", async () => {
    await assertSucceeds(
      setDoc(doc(anon(), "pageviews/" + "a".repeat(64)), stamped())
    );
    await assertFails(
      setDoc(doc(anon(), "pageviews/" + "a".repeat(65)), stamped())
    );
  });

  it("rejects a missing field", async () => {
    const { tz: _tz, ...withoutTz } = valid;
    void _tz;
    await assertFails(
      addDoc(collection(anon(), "pageviews"), {
        ...withoutTz,
        ts: serverTimestamp(),
      })
    );
  });

  it("rejects writes to any other collection", async () => {
    await assertFails(addDoc(collection(anon(), "other"), stamped()));
  });

  it("rejects a valid write to a subcollection of pageviews", async () => {
    await assertFails(setDoc(doc(anon(), "pageviews/x/sub/y"), stamped()));
  });

  it("rejects overwriting an existing id as anonymous", async () => {
    await seed();
    await assertFails(setDoc(doc(anon(), "pageviews/seed"), stamped()));
  });

  it("rejects a batch of one valid and one invalid create, writing neither", async () => {
    const db = anon();
    const batch = writeBatch(db);
    batch.set(doc(db, "pageviews/good"), stamped());
    batch.set(doc(db, "pageviews/bad"), stamped({ extra: "x" }));
    await assertFails(batch.commit());
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDocs(collection(ctx.firestore(), "pageviews"));
      expect(snap.size).toBe(0);
    });
  });

  // Intended: creating is open to everyone, signed in or not.
  it("allows a signed-in non-admin to create", async () => {
    await assertSucceeds(
      addDoc(
        collection(
          signedIn("uid-someone-else", { email: "someone.else@gmail.com" }),
          "pageviews"
        ),
        stamped()
      )
    );
  });
});

describe("read", () => {
  beforeEach(seed);

  it("allows the admin uid with password sign-in", async () => {
    await assertSucceeds(getDocs(collection(admin(), "pageviews")));
    await assertSucceeds(getDoc(doc(admin(), "pageviews/seed")));
  });

  it("allows the admin uid regardless of email claims", async () => {
    const noEmail = () => signedIn(ADMIN_UID);
    await assertSucceeds(getDocs(collection(noEmail(), "pageviews")));
    await assertSucceeds(getDoc(doc(noEmail(), "pageviews/seed")));
  });

  const denied: [string, () => ReturnType<typeof anon>][] = [
    ["anonymous", () => anon()],
    [
      "another uid with password sign-in",
      () => signedIn("uid-someone-else", { email: "someone.else@gmail.com" }),
    ],
    [
      "another uid with the admin email, verified, password sign-in",
      () =>
        signedIn("uid-impostor", {
          email: ADMIN_EMAIL,
          verified: true,
          provider: "password",
        }),
    ],
    [
      "another uid with the admin email, verified, google sign-in",
      () =>
        signedIn("uid-impostor", {
          email: ADMIN_EMAIL,
          verified: true,
          provider: "google.com",
        }),
    ],
    [
      "the admin uid via google sign-in",
      () => signedIn(ADMIN_UID, { email: ADMIN_EMAIL, provider: "google.com" }),
    ],
    [
      "the admin uid via anonymous sign-in",
      () => signedIn(ADMIN_UID, { email: ADMIN_EMAIL, provider: "anonymous" }),
    ],
    [
      "the admin uid with no provider claim",
      () => signedIn(ADMIN_UID, { email: ADMIN_EMAIL, provider: null }),
    ],
  ];
  it.each(denied)("rejects list for %s", async (_label, client) => {
    await assertFails(getDocs(collection(client(), "pageviews")));
  });
  it.each(denied)("rejects single get for %s", async (_label, client) => {
    await assertFails(getDoc(doc(client(), "pageviews/seed")));
  });

  it("rejects collection-group queries, even for the admin", async () => {
    await assertFails(getDocs(collectionGroup(admin(), "pageviews")));
    await assertFails(getDocs(collectionGroup(anon(), "pageviews")));
  });
});

describe("update and delete", () => {
  beforeEach(seed);

  it("rejects update for everyone, including the admin", async () => {
    await assertFails(updateDoc(doc(anon(), "pageviews/seed"), { path: "/x" }));
    await assertFails(
      updateDoc(doc(admin(), "pageviews/seed"), { path: "/x" })
    );
  });

  it("rejects delete for everyone, including the admin", async () => {
    await assertFails(deleteDoc(doc(anon(), "pageviews/seed")));
    await assertFails(deleteDoc(doc(admin(), "pageviews/seed")));
  });
});
