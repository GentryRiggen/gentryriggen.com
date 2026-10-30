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
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { buildCommitBody, commitUrl, sendPageview } from "@/lib/analytics/send";
import type { PageviewEvent } from "@/lib/analytics/types";
import { fetchBoard, runQueryUrl, submitEntry } from "@/lib/leaderboard/client";
import { fetchDailyBoard, submitDaily } from "@/lib/leaderboard/daily";
import { LEVELS, LEVEL_ORDER } from "@/lib/plane-builder/levels";
import { scoreFor } from "@/lib/leaderboard/types";

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
    [
      "a plane-builder event",
      { site: "plane-builder", path: "/plane-builder" },
    ],
    [
      "a plane-builder subpath",
      { site: "plane-builder", path: "/plane-builder/versions" },
    ],
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
    [
      "plane-builder with a ship-builder path",
      { site: "plane-builder", path: "/ship-builder" },
    ],
    [
      "ship-builder with a plane-builder path",
      { site: "ship-builder", path: "/plane-builder" },
    ],
    [
      "home with a plane-builder path",
      { site: "home", path: "/plane-builder" },
    ],
    ["plane-builder with the home path", { site: "plane-builder", path: "/" }],
    [
      "a plane-builder lookalike path",
      { site: "plane-builder", path: "/plane-builderx" },
    ],
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

describe("leaderboard", () => {
  const UID = "player-1";
  const player = (uid = UID, provider: Provider | null = "anonymous") =>
    signedIn(uid, { provider });
  const lbDoc = (db: ReturnType<typeof anon>, uid = UID) =>
    doc(db, `leaderboard/${uid}`);

  const baseEntry = {
    nickname: "Happy Otter 7",
    prestige: 1,
    score: 1_000_001_000,
    lifetimeDistance: 1000.5,
    bestTimes: { meadow: 20, islands: 80.5 } as Record<string, unknown>,
    fastestRun: null as number | null,
  };
  const entry = (patch: Record<string, unknown> = {}) => ({
    ...baseEntry,
    updatedAt: serverTimestamp(),
    ...patch,
  });

  const FULL_RUN = LEVEL_ORDER.reduce(
    (sum, id) => sum + LEVELS[id].finishDistance,
    0
  );
  const allTimes = Object.fromEntries(
    LEVEL_ORDER.map((id) => [id, Math.floor(LEVELS[id].finishDistance / 120)])
  );

  /** Seeds the player's doc as written `agoMs` milliseconds ago. */
  async function seedPlayer(
    patch: Record<string, unknown> = {},
    agoMs = 60_000
  ) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(lbDoc(ctx.firestore()), {
        ...baseEntry,
        ...patch,
        updatedAt: new Date(Date.now() - agoMs),
      });
    });
  }

  describe("create", () => {
    it("allows the owner (anonymous provider) to create a valid entry", async () => {
      await assertSucceeds(setDoc(lbDoc(player()), entry()));
    });

    it("allows prestige 0 with empty bestTimes", async () => {
      await assertSucceeds(
        setDoc(
          lbDoc(player()),
          entry({
            prestige: 0,
            score: 5,
            lifetimeDistance: 5.9,
            bestTimes: {},
          })
        )
      );
    });

    it("allows a full run: every world, a fastestRun and 68800 m", async () => {
      await assertSucceeds(
        setDoc(
          lbDoc(player()),
          entry({
            score: scoreFor(1, FULL_RUN),
            lifetimeDistance: FULL_RUN,
            bestTimes: allTimes,
            fastestRun: 600,
          })
        )
      );
    });

    it("allows exactly 150000 m", async () => {
      await assertSucceeds(
        setDoc(
          lbDoc(player()),
          entry({ score: scoreFor(1, 150000), lifetimeDistance: 150000 })
        )
      );
    });

    it("accepts the exact physical minimum for every world", async () => {
      await assertSucceeds(
        setDoc(
          lbDoc(player()),
          entry({
            bestTimes: {
              meadow: 16,
              canyon: 33,
              mountains: 50,
              beach: 58,
              jungle: 61,
              city: 65,
              glacier: 68,
              volcano: 70,
              storm: 73,
              islands: 75,
            },
          })
        )
      );
    });

    const rejected: [string, () => ReturnType<typeof anon>, object][] = [
      ["another uid", () => player("someone-else"), {}],
      ["a non-anonymous provider", () => player(UID, "password"), {}],
      ["google sign-in", () => player(UID, "google.com"), {}],
      ["no provider claim", () => player(UID, null), {}],
      ["a signed-out user", () => anon(), {}],
      ["an extra field", () => player(), { extra: 1 }],
      ["a missing field", () => player(), { fastestRun: undefined }],
      ["a free-text nickname", () => player(), { nickname: "Bad Word" }],
      ["an unlisted adjective", () => player(), { nickname: "Rude Otter 7" }],
      ["an unlisted animal", () => player(), { nickname: "Happy Dragon 7" }],
      ["nickname number 0", () => player(), { nickname: "Happy Otter 0" }],
      ["nickname number 100", () => player(), { nickname: "Happy Otter 100" }],
      ["a four-part nickname", () => player(), { nickname: "Happy Otter 7 x" }],
      ["a non-string nickname", () => player(), { nickname: 7 }],
      ["negative prestige", () => player(), { prestige: -1, score: -1e9 }],
      [
        "prestige over 10000",
        () => player(),
        { prestige: 10001, score: 10_001_000_001_000 },
      ],
      ["a float prestige", () => player(), { prestige: 1.5 }],
      [
        "prestige 2 on create",
        () => player(),
        { prestige: 2, score: 2_000_001_000 },
      ],
      [
        "distance over 150000 on create",
        () => player(),
        { lifetimeDistance: 150001, score: 1_000_150_001 },
      ],
      [
        "a fastestRun without every best time",
        () => player(),
        {
          lifetimeDistance: FULL_RUN,
          score: scoreFor(1, FULL_RUN),
          fastestRun: 600,
        },
      ],
      [
        "a fastestRun with less than a full run of distance",
        () => player(),
        { bestTimes: allTimes, fastestRun: 600 },
      ],
      ["a wrong score", () => player(), { score: 5_000_001_000 }],
      ["a float score", () => player(), { score: 1_000_001_000.5 }],
      [
        "an uncapped score",
        () => player(),
        { lifetimeDistance: 5e11, score: 1_000_000_000 + 5e11 },
      ],
      ["negative distance", () => player(), { lifetimeDistance: -1 }],
      [
        "distance over 1e12",
        () => player(),
        { lifetimeDistance: 2e12, score: 1_999_999_999 },
      ],
      ["string distance", () => player(), { lifetimeDistance: "9" }],
      ["a too-fast best time", () => player(), { bestTimes: { meadow: 15.9 } }],
      [
        "a too-fast best time on another world",
        () => player(),
        { bestTimes: { islands: 74 } },
      ],
      ["a best time over 600", () => player(), { bestTimes: { meadow: 601 } }],
      ["an unknown world key", () => player(), { bestTimes: { moon: 100 } }],
      [
        "a non-number best time",
        () => player(),
        { bestTimes: { meadow: "20" } },
      ],
      ["a non-map bestTimes", () => player(), { bestTimes: [20] }],
      ["fastestRun below 10", () => player(), { fastestRun: 9 }],
      ["fastestRun above 100000", () => player(), { fastestRun: 100001 }],
      ["a float fastestRun", () => player(), { fastestRun: 20.5 }],
      ["a string fastestRun", () => player(), { fastestRun: "20" }],
      [
        "a client-supplied updatedAt",
        () => player(),
        { updatedAt: new Date() },
      ],
    ];
    it.each(rejected)("rejects %s", async (_label, client, patch) => {
      const data: Record<string, unknown> = { ...entry(), ...patch };
      for (const [k, v] of Object.entries(data)) {
        if (v === undefined) delete data[k];
      }
      await assertFails(setDoc(lbDoc(client()), data));
    });

    it("rejects a document whose id belongs to another player", async () => {
      await assertFails(setDoc(lbDoc(player(), "player-2"), entry()));
    });
  });

  describe("update", () => {
    beforeEach(() => seedPlayer());

    it("allows the same prestige with more distance", async () => {
      await assertSucceeds(
        setDoc(
          lbDoc(player()),
          entry({ lifetimeDistance: 5000.2, score: 1_000_005_000 })
        )
      );
    });

    it("allows a gain the elapsed time supports and a changed nickname", async () => {
      await assertSucceeds(
        setDoc(
          lbDoc(player()),
          entry({
            nickname: "Brave Fox 3",
            lifetimeDistance: 20_000.5,
            score: scoreFor(1, 20_000.5),
          })
        )
      );
    });

    it("allows updateDoc with a valid merged result", async () => {
      await assertSucceeds(
        updateDoc(lbDoc(player()), {
          lifetimeDistance: 1001,
          score: 1_000_001_001,
          updatedAt: serverTimestamp(),
        })
      );
    });

    it("rejects prestige earned without distance", async () => {
      await assertFails(
        setDoc(lbDoc(player()), entry({ prestige: 2, score: 2_000_001_000 }))
      );
    });

    it("rejects a prestige decrease", async () => {
      await assertFails(
        setDoc(lbDoc(player()), entry({ prestige: 0, score: 1000 }))
      );
    });

    it("rejects a wrong score", async () => {
      await assertFails(
        setDoc(lbDoc(player()), entry({ score: 9_000_001_000 }))
      );
    });

    it("rejects decreasing distance", async () => {
      await assertFails(
        setDoc(
          lbDoc(player()),
          entry({ lifetimeDistance: 999, score: 1_000_000_999 })
        )
      );
    });

    it("rejects a distance jump beyond 200 * secs + 9100", async () => {
      // Seeded 60 s ago: at most 1000.5 + 12000 + 9100.
      await assertFails(
        setDoc(
          lbDoc(player()),
          entry({ lifetimeDistance: 22_200, score: scoreFor(1, 22_200) })
        )
      );
    });

    it("rejects another uid, a non-anonymous provider and a signed-out user", async () => {
      await assertFails(setDoc(lbDoc(player("someone-else")), entry()));
      await assertFails(setDoc(lbDoc(player(UID, "password")), entry()));
      await assertFails(setDoc(lbDoc(anon()), entry()));
    });

    it("rejects an extra field and a free-text nickname", async () => {
      await assertFails(setDoc(lbDoc(player()), entry({ extra: 1 })));
      await assertFails(setDoc(lbDoc(player()), entry({ nickname: "Hello" })));
    });
  });

  describe("prestige tied to distance and time", () => {
    it("allows prestige +3 when distance and elapsed time support it", async () => {
      // 10 minutes ago: up to 200 * 600 + 9100 m more.
      await seedPlayer(
        { prestige: 1, lifetimeDistance: 200_000, score: scoreFor(1, 200_000) },
        600_000
      );
      const distance = 3 * 68_800 + 100;
      await assertSucceeds(
        setDoc(
          lbDoc(player()),
          entry({
            prestige: 4,
            lifetimeDistance: distance,
            score: scoreFor(4, distance),
          })
        )
      );
    });

    it("allows the one free prestige of a migrated save", async () => {
      await seedPlayer({ prestige: 0, lifetimeDistance: 0, score: 0 });
      await assertSucceeds(
        setDoc(
          lbDoc(player()),
          entry({ prestige: 1, lifetimeDistance: 10, score: scoreFor(1, 10) })
        )
      );
    });

    it("rejects prestige 3 with only one lap of distance", async () => {
      await seedPlayer(
        { prestige: 1, lifetimeDistance: 68_800, score: scoreFor(1, 68_800) },
        600_000
      );
      await assertFails(
        setDoc(
          lbDoc(player()),
          entry({
            prestige: 3,
            lifetimeDistance: 70_000,
            score: scoreFor(3, 70_000),
          })
        )
      );
    });

    it("rejects a distance jump the elapsed time cannot support", async () => {
      await seedPlayer(
        { prestige: 1, lifetimeDistance: 1000, score: scoreFor(1, 1000) },
        600_000
      );
      await assertFails(
        setDoc(
          lbDoc(player()),
          entry({
            lifetimeDistance: 1000 + 200 * 700 + 9100,
            score: scoreFor(1, 1000 + 200 * 700 + 9100),
          })
        )
      );
    });

    it("rejects a fastestRun update without a full run of distance", async () => {
      await assertFails(
        setDoc(lbDoc(player()), entry({ bestTimes: allTimes, fastestRun: 600 }))
      );
    });
  });

  describe("bans", () => {
    const ban = (db: ReturnType<typeof anon>, uid = UID) =>
      doc(db, `leaderboardBans/${uid}`);
    const banPlayer = () =>
      env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(ban(ctx.firestore()), { bannedAt: new Date() });
      });

    it("stops a banned uid creating an entry", async () => {
      await banPlayer();
      await assertFails(setDoc(lbDoc(player()), entry()));
    });

    it("stops a banned uid updating an entry", async () => {
      await seedPlayer();
      await banPlayer();
      await assertFails(setDoc(lbDoc(player()), entry()));
    });

    it("does not stop other players", async () => {
      await banPlayer();
      await assertSucceeds(
        setDoc(lbDoc(player("player-2"), "player-2"), entry())
      );
    });

    it("lets the admin write and read bans", async () => {
      await assertSucceeds(
        setDoc(ban(admin()), { bannedAt: serverTimestamp() })
      );
      await assertSucceeds(getDoc(ban(admin())));
      await assertSucceeds(deleteDoc(ban(admin())));
    });

    it("lets the admin ban and delete in one batch", async () => {
      await seedPlayer();
      const db = admin();
      const batch = writeBatch(db);
      batch.set(ban(db), { bannedAt: serverTimestamp() });
      batch.delete(lbDoc(db));
      await assertSucceeds(batch.commit());
    });

    it("stops players and everyone else reading or writing bans", async () => {
      await banPlayer();
      for (const db of [player(), player("someone-else"), anon()]) {
        await assertFails(getDoc(ban(db)));
        await assertFails(setDoc(ban(db), { bannedAt: new Date() }));
        await assertFails(deleteDoc(ban(db)));
      }
      await assertFails(
        setDoc(ban(signedIn(ADMIN_UID, { provider: "anonymous" })), {
          bannedAt: new Date(),
        })
      );
    });
  });

  describe("rate limit", () => {
    it("rejects an update less than 10 s after the last write", async () => {
      await seedPlayer({}, 2_000);
      await assertFails(setDoc(lbDoc(player()), entry()));
    });

    it("allows an update more than 10 s after the last write", async () => {
      await seedPlayer({}, 15_000);
      await assertSucceeds(setDoc(lbDoc(player()), entry()));
    });

    it("rejects two quick writes in a row", async () => {
      await assertSucceeds(setDoc(lbDoc(player()), entry()));
      await assertFails(
        setDoc(
          lbDoc(player()),
          entry({ lifetimeDistance: 2000, score: 1_000_002_000 })
        )
      );
    });
  });

  describe("read", () => {
    beforeEach(() => seedPlayer());
    const col = (db: ReturnType<typeof anon>) => collection(db, "leaderboard");

    it("lets anyone get a single entry", async () => {
      await assertSucceeds(getDoc(lbDoc(anon())));
      await assertSucceeds(getDoc(lbDoc(player("someone-else"))));
    });

    it("lets anyone list with a limit of 50 or less", async () => {
      await assertSucceeds(getDocs(query(col(anon()), limit(50))));
      await assertSucceeds(
        getDocs(query(col(anon()), orderBy("score", "desc"), limit(50)))
      );
      await assertSucceeds(
        getDocs(query(col(anon()), orderBy("bestTimes.meadow"), limit(10)))
      );
      await assertSucceeds(
        getDocs(
          query(
            col(anon()),
            where("fastestRun", ">", 0),
            orderBy("fastestRun"),
            limit(50)
          )
        )
      );
    });

    it("rejects a list with a limit over 50", async () => {
      await assertFails(getDocs(query(col(anon()), limit(51))));
    });

    const runQuery = (structuredQuery: Record<string, unknown>) =>
      fetch(runQueryUrl(config, baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "leaderboard" }],
            ...structuredQuery,
          },
        }),
      });

    it("accepts a REST list without an offset and with offset 0", async () => {
      expect((await runQuery({ limit: 50 })).status).toBe(200);
      expect((await runQuery({ limit: 50, offset: 0 })).status).toBe(200);
    });

    it("rejects a list with an offset above 0", async () => {
      expect((await runQuery({ limit: 50, offset: 1 })).status).toBe(403);
      expect((await runQuery({ limit: 10, offset: 40 })).status).toBe(403);
    });

    it("rejects an unlimited list", async () => {
      await assertFails(getDocs(col(anon())));
      await assertFails(getDocs(query(col(anon()), orderBy("score"))));
    });
  });

  describe("delete", () => {
    beforeEach(() => seedPlayer());

    it("allows the admin", async () => {
      await assertSucceeds(deleteDoc(lbDoc(admin())));
    });

    it("rejects the owner and everyone else", async () => {
      await assertFails(deleteDoc(lbDoc(player())));
      await assertFails(deleteDoc(lbDoc(player("someone-else"))));
      await assertFails(deleteDoc(lbDoc(anon())));
      await assertFails(
        deleteDoc(lbDoc(signedIn(ADMIN_UID, { provider: "anonymous" })))
      );
    });
  });

  describe("REST client", () => {
    // The emulator accepts unsigned JWTs carrying the claims rules read.
    const unsignedToken = (uid: string) => {
      const part = (o: object) =>
        Buffer.from(JSON.stringify(o)).toString("base64url");
      return `${part({ alg: "none", typ: "JWT" })}.${part({
        user_id: uid,
        sub: uid,
        aud: PROJECT_ID,
        firebase: { sign_in_provider: "anonymous", identities: {} },
      })}.`;
    };
    const deps = (uid: string) => ({
      config,
      baseUrl,
      getSession: async () => ({ uid, idToken: unsignedToken(uid) }),
    });
    const restEntry = {
      nickname: "Happy Otter 7",
      prestige: 1,
      score: scoreFor(1, 1000.5),
      lifetimeDistance: 1000.5,
      bestTimes: { meadow: 20, islands: 80.5 },
      fastestRun: null,
    };

    it("creates the doc with the exact body the game sends", async () => {
      expect(await submitEntry(restEntry, deps(UID))).toBe(true);
      await env.withSecurityRulesDisabled(async (ctx) => {
        const snap = await getDoc(lbDoc(ctx.firestore()));
        expect(snap.data()?.score).toBe(1_000_001_000);
        expect(snap.data()?.fastestRun).toBeNull();
      });
    });

    it("rejects an immediate rewrite (rate limit) and a forged score", async () => {
      expect(await submitEntry(restEntry, deps(UID))).toBe(true);
      expect(await submitEntry(restEntry, deps(UID))).toBe(false);
      expect(
        await submitEntry({ ...restEntry, score: 9e12 }, deps("player-9"))
      ).toBe(false);
    });

    it("reads boards back through runQuery", async () => {
      await submitEntry(restEntry, deps(UID));
      await submitEntry(
        {
          ...restEntry,
          nickname: "Brave Fox 3",
          score: scoreFor(1, FULL_RUN),
          lifetimeDistance: FULL_RUN,
          bestTimes: allTimes,
          fastestRun: 700,
        },
        deps("player-2")
      );
      const prestige = await fetchBoard("prestige", { config, baseUrl });
      expect(prestige?.map((r) => r.uid)).toEqual(["player-2", UID]);
      const fastest = await fetchBoard("fastestRun", { config, baseUrl });
      expect(fastest).toEqual([
        { uid: "player-2", nickname: "Brave Fox 3", value: 700 },
      ]);
      const meadow = await fetchBoard({ world: "meadow" }, { config, baseUrl });
      expect(meadow).toHaveLength(2);
    });
  });
});

describe("plane daily challenge", () => {
  const UID = "daily-player";
  const player = (uid = UID, provider: Provider | null = "anonymous") =>
    signedIn(uid, { provider });
  const dayKey = (offsetDays = 0) =>
    new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
  const entryDoc = (db: ReturnType<typeof anon>, date = dayKey(), uid = UID) =>
    doc(db, `planeDaily/${date}/entries/${uid}`);
  const minimum = (world: string) =>
    Math.floor(LEVELS[world as keyof typeof LEVELS].finishDistance / 120);

  const entry = (patch: Record<string, unknown> = {}) => ({
    nickname: "Happy Otter 7",
    world: "city",
    time: 80.25,
    updatedAt: serverTimestamp(),
    ...patch,
  });

  async function seedEntry(
    patch: Record<string, unknown> = {},
    agoMs = 60_000,
    date = dayKey()
  ) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(entryDoc(ctx.firestore(), date), {
        nickname: "Happy Otter 7",
        world: "city",
        time: 80.25,
        ...patch,
        updatedAt: new Date(Date.now() - agoMs),
      });
    });
  }

  describe("create", () => {
    it("allows a valid entry for today", async () => {
      await assertSucceeds(setDoc(entryDoc(player()), entry()));
    });

    it("allows yesterday's board (a flight that ended after midnight)", async () => {
      await assertSucceeds(setDoc(entryDoc(player(), dayKey(-1)), entry()));
    });

    it.each([
      ["tomorrow", 1],
      ["two days ago", -2],
      ["a week ago", -7],
    ])("rejects %s", async (_label, offset) => {
      await assertFails(setDoc(entryDoc(player(), dayKey(offset)), entry()));
    });

    it("rejects a date that is not a plain day string", async () => {
      await assertFails(setDoc(entryDoc(player(), `${dayKey()}x`), entry()));
    });

    it("rejects someone else's uid, signed-out and non-anonymous callers", async () => {
      await assertFails(setDoc(entryDoc(player("other")), entry()));
      await assertFails(setDoc(entryDoc(anon()), entry()));
      await assertFails(setDoc(entryDoc(player(UID, "password")), entry()));
      await assertFails(setDoc(entryDoc(player(UID, null)), entry()));
    });

    it("accepts each world's exact minimum and rejects one below", async () => {
      for (const world of LEVEL_ORDER) {
        const uid = `p-${world}`;
        const min = minimum(world);
        await assertFails(
          setDoc(
            entryDoc(player(uid), dayKey(), uid),
            entry({ world, time: min - 0.01 })
          )
        );
        await assertSucceeds(
          setDoc(
            entryDoc(player(uid), dayKey(), uid),
            entry({ world, time: min })
          )
        );
      }
    });

    it("rejects a time over 600, zero, negative or not a number", async () => {
      for (const time of [600.5, 0, -3, "50", null]) {
        await assertFails(setDoc(entryDoc(player()), entry({ time })));
      }
      await assertSucceeds(setDoc(entryDoc(player()), entry({ time: 600 })));
    });

    it("rejects an unknown world", async () => {
      for (const world of ["moon", "", 3, null]) {
        await assertFails(setDoc(entryDoc(player()), entry({ world })));
      }
    });

    it("rejects a made-up nickname", async () => {
      for (const nickname of ["Bob", "Happy Otter", "Happy Otter 100", 5]) {
        await assertFails(setDoc(entryDoc(player()), entry({ nickname })));
      }
    });

    it("rejects extra and missing fields", async () => {
      await assertFails(setDoc(entryDoc(player()), entry({ admin: true })));
      const { world: _world, ...noWorld } = entry();
      await assertFails(setDoc(entryDoc(player()), noWorld));
      const { nickname: _nickname, ...noNickname } = entry();
      await assertFails(setDoc(entryDoc(player()), noNickname));
    });

    it("rejects a forged updatedAt", async () => {
      await assertFails(
        setDoc(entryDoc(player()), entry({ updatedAt: new Date(0) }))
      );
    });

    it("rejects a banned player", async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `leaderboardBans/${UID}`), {
          reason: "cheating",
        });
      });
      await assertFails(setDoc(entryDoc(player()), entry()));
    });

    it("rejects writes elsewhere under planeDaily", async () => {
      await assertFails(
        setDoc(doc(player(), `planeDaily/${dayKey()}`), entry())
      );
      await assertFails(
        setDoc(doc(player(), `planeDaily/${dayKey()}/other/${UID}`), entry())
      );
      await assertFails(
        setDoc(
          doc(player(), `planeDaily/${dayKey()}/entries/${UID}/deep/x`),
          entry()
        )
      );
    });
  });

  describe("update", () => {
    it("allows a faster time after 10 s", async () => {
      await seedEntry({ time: 80 }, 15_000);
      await assertSucceeds(setDoc(entryDoc(player()), entry({ time: 79.5 })));
    });

    it("rejects a slower time", async () => {
      await seedEntry({ time: 80 }, 15_000);
      await assertFails(setDoc(entryDoc(player()), entry({ time: 80.5 })));
    });

    it("rejects an update less than 10 s after the last write", async () => {
      await seedEntry({ time: 80 }, 2_000);
      await assertFails(setDoc(entryDoc(player()), entry({ time: 70 })));
    });

    it("rejects updating someone else's entry", async () => {
      await seedEntry({ time: 80 }, 15_000);
      await assertFails(
        setDoc(entryDoc(player("other"), dayKey(), UID), entry({ time: 70 }))
      );
    });

    it("rejects changing a board that is more than a day old", async () => {
      await seedEntry({ time: 80 }, 15_000, dayKey(-3));
      await assertFails(
        setDoc(entryDoc(player(), dayKey(-3)), entry({ time: 70 }))
      );
    });

    it("rejects an update that sneaks below the new world's minimum", async () => {
      await seedEntry({ time: 80 }, 15_000);
      await assertFails(
        setDoc(entryDoc(player()), entry({ world: "islands", time: 70 }))
      );
    });
  });

  describe("read and delete", () => {
    beforeEach(() => seedEntry());
    const board = (db: ReturnType<typeof anon>, date = dayKey()) =>
      collection(db, `planeDaily/${date}/entries`);

    it("lets anyone read an entry and the top of a board", async () => {
      await assertSucceeds(getDoc(entryDoc(anon())));
      await assertSucceeds(
        getDocs(query(board(anon()), orderBy("time"), limit(20)))
      );
    });

    it("rejects an unlimited or over-limit board query", async () => {
      await assertFails(getDocs(query(board(anon()), orderBy("time"))));
      await assertFails(
        getDocs(query(board(anon()), orderBy("time"), limit(51)))
      );
    });

    it("rejects collection-group reads of entries", async () => {
      await assertFails(
        getDocs(query(collectionGroup(anon(), "entries"), limit(10)))
      );
    });

    it("lets only the admin delete", async () => {
      await assertFails(deleteDoc(entryDoc(player())));
      await assertFails(deleteDoc(entryDoc(anon())));
      await assertSucceeds(deleteDoc(entryDoc(admin())));
    });
  });

  describe("REST client", () => {
    const unsignedToken = (uid: string) => {
      const part = (o: object) =>
        Buffer.from(JSON.stringify(o)).toString("base64url");
      return `${part({ alg: "none", typ: "JWT" })}.${part({
        user_id: uid,
        sub: uid,
        aud: PROJECT_ID,
        firebase: { sign_in_provider: "anonymous", identities: {} },
      })}.`;
    };
    const deps = (uid: string) => ({
      config,
      baseUrl,
      getSession: async () => ({ uid, idToken: unsignedToken(uid) }),
    });

    it("submits with the exact body the game sends and reads it back", async () => {
      const day = dayKey();
      expect(
        await submitDaily(
          day,
          { nickname: "Happy Otter 7", world: "city", time: 71.4 },
          deps(UID)
        )
      ).toBe(true);
      expect(
        await submitDaily(
          day,
          { nickname: "Brave Fox 3", world: "meadow", time: 30 },
          deps("p2")
        )
      ).toBe(true);
      expect(await fetchDailyBoard(day, { config, baseUrl })).toEqual([
        { uid: "p2", nickname: "Brave Fox 3", value: 30 },
        { uid: UID, nickname: "Happy Otter 7", value: 71.4 },
      ]);
    });

    it("is refused for a forged time and for an old day", async () => {
      expect(
        await submitDaily(
          dayKey(),
          { nickname: "Happy Otter 7", world: "city", time: 1 },
          deps(UID)
        )
      ).toBe(false);
      expect(
        await submitDaily(
          dayKey(-5),
          { nickname: "Happy Otter 7", world: "city", time: 90 },
          deps(UID)
        )
      ).toBe(false);
    });
  });
});
