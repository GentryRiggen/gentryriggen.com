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
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
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

const anon = () => env.unauthenticatedContext().firestore();
const admin = () =>
  env
    .authenticatedContext("admin-uid", {
      email: "gentry.riggen@gmail.com",
      email_verified: true,
    })
    .firestore();

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "pageviews/seed"), {
      ...valid,
      ts: new Date(),
    });
  });
}

describe("create", () => {
  it("allows a valid pageview from anyone (SDK)", async () => {
    await assertSucceeds(
      addDoc(collection(anon(), "pageviews"), {
        ...valid,
        ts: serverTimestamp(),
      })
    );
  });

  it("allows the exact REST request the tracker sends", async () => {
    const ok = await sendPageview(valid, {
      config: {
        apiKey: "emulator",
        authDomain: "x",
        projectId: PROJECT_ID,
        appId: "x",
      },
      baseUrl: `http://${HOST}:${PORT}`,
    });
    expect(ok).toBe(true);
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDocs(collection(ctx.firestore(), "pageviews"));
      expect(snap.size).toBe(1);
      expect(snap.docs[0].data().ts).toBeDefined();
    });
  });

  it("rejects an invalid REST request too", async () => {
    const config = {
      apiKey: "emulator",
      authDomain: "x",
      projectId: PROJECT_ID,
      appId: "x",
    };
    const body = buildCommitBody(PROJECT_ID, "bad1", {
      ...valid,
      extra: "nope",
    } as PageviewEvent);
    const response = await fetch(commitUrl(config, `http://${HOST}:${PORT}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.ok).toBe(false);
  });

  const reject: [string, Record<string, unknown>][] = [
    ["an extra field", { extra: "x" }],
    ["a client-supplied timestamp", { ts: new Date() }],
    ["an unknown site", { site: "blog" }],
    ["an unknown device", { device: "fridge" }],
    ["an unknown screen bucket", { screen: "huge" }],
    ["an empty path", { path: "" }],
    ["an oversized path", { path: "/" + "a".repeat(250) }],
    ["an oversized referrer", { ref: "a".repeat(101) }],
    ["a short visitor id", { vid: "short" }],
    ["a non-string path", { path: 42 }],
  ];
  it.each(reject)("rejects %s", async (_label, patch) => {
    await assertFails(
      addDoc(collection(anon(), "pageviews"), {
        ...valid,
        ts: serverTimestamp(),
        ...patch,
      })
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
    await assertFails(
      addDoc(collection(anon(), "other"), { ...valid, ts: serverTimestamp() })
    );
  });
});

describe("read", () => {
  beforeEach(seed);

  it("rejects anonymous reads", async () => {
    await assertFails(getDocs(collection(anon(), "pageviews")));
  });

  it("rejects other signed-in accounts", async () => {
    const other = env
      .authenticatedContext("u2", {
        email: "someone.else@gmail.com",
        email_verified: true,
      })
      .firestore();
    await assertFails(getDocs(collection(other, "pageviews")));
  });

  it("rejects the admin email when it is not verified", async () => {
    const unverified = env
      .authenticatedContext("u3", {
        email: "gentry.riggen@gmail.com",
        email_verified: false,
      })
      .firestore();
    await assertFails(getDocs(collection(unverified, "pageviews")));
  });

  it("allows the verified admin", async () => {
    await assertSucceeds(getDocs(collection(admin(), "pageviews")));
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
