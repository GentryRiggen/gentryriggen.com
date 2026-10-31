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
  type Firestore,
} from "firebase/firestore";
import { buildCommitBody, commitUrl, sendPageview } from "@/lib/analytics/send";
import type { PageviewEvent } from "@/lib/analytics/types";
import { fetchBoard, runQueryUrl, submitEntry } from "@/lib/leaderboard/client";
import { fetchDailyBoard, submitDaily } from "@/lib/leaderboard/daily";
import { dailyFor } from "@/lib/plane-builder/daily/daily";
import { fetchSeason } from "@/lib/leaderboard/season";
import { fetchShipBoard, submitShipEntry } from "@/lib/leaderboard/shipBoard";
import { LEVELS, LEVEL_ORDER } from "@/lib/plane-builder/levels";
import { scoreFor } from "@/lib/leaderboard/types";
import { randomNickname } from "@/lib/leaderboard/nickname";
import {
  banDeletePaths,
  banEverywhere,
  deleteEntry,
  readBoard,
  readBoardHidden,
  readSeason,
  renameEntry,
  SeasonChangedError,
  startSeason,
  writeBoardHidden,
} from "@/lib/firebase/adminBoard";

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

const DAY_MS = 86_400_000;

/**
 * Seeds the season docs (null leaves one out), started `startedAgoMs` ago: a
 * day by default, so the time-since-start create cap is out of the way.
 */
async function seedSeasons(
  plane: number | null = 2,
  ship: number | null = 2,
  startedAgoMs = DAY_MS
) {
  const startedAt = new Date(Date.now() - startedAgoMs);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    if (plane !== null) {
      await setDoc(doc(db, "seasons/plane"), { number: plane, startedAt });
    }
    if (ship !== null) {
      await setDoc(doc(db, "seasons/ship"), { number: ship, startedAt });
    }
  });
}

/** Clears everything and seeds season 2 for both games again. */
async function resetFirestore() {
  await env.clearFirestore();
  await seedSeasons();
}

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

describe("plane season entries (season 2)", () => {
  const UID = "player-1";
  beforeEach(() => seedSeasons());
  const player = (uid = UID, provider: Provider | null = "anonymous") =>
    signedIn(uid, { provider });
  const lbDoc = (db: ReturnType<typeof anon>, uid = UID) =>
    doc(db, `planeSeasons/2/entries/${uid}`);

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
    const col = (db: ReturnType<typeof anon>) =>
      collection(db, "planeSeasons/2/entries");

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
      fetch(runQueryUrl(config, baseUrl, "planeSeasons/2"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "entries" }],
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
      expect(await submitEntry(restEntry, 2, deps(UID))).toBe(true);
      await env.withSecurityRulesDisabled(async (ctx) => {
        const snap = await getDoc(lbDoc(ctx.firestore()));
        expect(snap.data()?.score).toBe(1_000_001_000);
        expect(snap.data()?.fastestRun).toBeNull();
      });
    });

    it("rejects an immediate rewrite (rate limit) and a forged score", async () => {
      expect(await submitEntry(restEntry, 2, deps(UID))).toBe(true);
      expect(await submitEntry(restEntry, 2, deps(UID))).toBe(false);
      expect(
        await submitEntry({ ...restEntry, score: 9e12 }, 2, deps("player-9"))
      ).toBe(false);
    });

    it("reads boards back through runQuery", async () => {
      await submitEntry(restEntry, 2, deps(UID));
      await submitEntry(
        {
          ...restEntry,
          nickname: "Brave Fox 3",
          score: scoreFor(1, FULL_RUN),
          lifetimeDistance: FULL_RUN,
          bestTimes: allTimes,
          fastestRun: 700,
        },
        2,
        deps("player-2")
      );
      const prestige = await fetchBoard("prestige", 2, { config, baseUrl });
      expect(prestige?.map((r) => r.uid)).toEqual(["player-2", UID]);
      const fastest = await fetchBoard("fastestRun", 2, { config, baseUrl });
      expect(fastest).toEqual([
        { uid: "player-2", nickname: "Brave Fox 3", value: 700 },
      ]);
      const meadow = await fetchBoard({ world: "meadow" }, 2, {
        config,
        baseUrl,
      });
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

  /** The day's world, from the same plan the rules hold. */
  const worldOn = (date: string) => dailyFor(date).world;
  const otherWorld = (date: string) =>
    LEVEL_ORDER.find((id) => id !== worldOn(date))!;
  const entry = (patch: Record<string, unknown> = {}, date = dayKey()) => ({
    nickname: "Happy Otter 7",
    world: worldOn(date),
    time: 80.25,
    updatedAt: serverTimestamp(),
    ...patch,
  });
  /** Yesterday's board is only open in the first 15 minutes of the UTC day. */
  const isYesterdayOpen = () => Date.now() % 86_400_000 < 900_000;

  async function seedEntry(
    patch: Record<string, unknown> = {},
    agoMs = 60_000,
    date = dayKey()
  ) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(entryDoc(ctx.firestore(), date), {
        nickname: "Happy Otter 7",
        world: worldOn(date),
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

    it("opens yesterday's board only in the first 15 minutes of the day", async () => {
      const write = setDoc(
        entryDoc(player(), dayKey(-1)),
        entry({}, dayKey(-1))
      );
      if (isYesterdayOpen()) await assertSucceeds(write);
      else await assertFails(write);
    });

    it.each([
      ["tomorrow", 1],
      ["two days ago", -2],
      ["a week ago", -7],
    ])("rejects %s", async (_label, offset) => {
      await assertFails(
        setDoc(entryDoc(player(), dayKey(offset)), entry({}, dayKey(offset)))
      );
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

    it("accepts the day's world at its exact minimum and rejects one below", async () => {
      const world = worldOn(dayKey());
      await assertFails(
        setDoc(entryDoc(player()), entry({ time: minimum(world) - 0.01 }))
      );
      await assertSucceeds(
        setDoc(entryDoc(player()), entry({ time: minimum(world) }))
      );
    });

    it("rejects any world but the day's, even an easier one", async () => {
      for (const world of LEVEL_ORDER) {
        if (world === worldOn(dayKey())) continue;
        await assertFails(
          setDoc(entryDoc(player()), entry({ world, time: 600 }))
        );
      }
    });

    it("pins the world by the path date, not by what the client says", async () => {
      const yesterday = worldOn(dayKey(-1));
      if (isYesterdayOpen() && yesterday !== worldOn(dayKey())) {
        await assertFails(
          setDoc(
            entryDoc(player(), dayKey(-1)),
            entry({ world: worldOn(dayKey()) }, dayKey(-1))
          )
        );
      }
      if (yesterday !== worldOn(dayKey())) {
        await assertFails(
          setDoc(entryDoc(player()), entry({ world: yesterday }))
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
      const noWorld: Record<string, unknown> = entry();
      delete noWorld.world;
      await assertFails(setDoc(entryDoc(player()), noWorld));
      const noNickname: Record<string, unknown> = entry();
      delete noNickname.nickname;
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
      await seedEntry({ time: 90 }, 15_000);
      await assertSucceeds(setDoc(entryDoc(player()), entry({ time: 79.5 })));
    });

    it("rejects a slower time", async () => {
      await seedEntry({ time: 90 }, 15_000);
      await assertFails(setDoc(entryDoc(player()), entry({ time: 90.5 })));
    });

    it("rejects an update less than 10 s after the last write", async () => {
      await seedEntry({ time: 90 }, 2_000);
      await assertFails(setDoc(entryDoc(player()), entry({ time: 79 })));
    });

    it("rejects updating someone else's entry", async () => {
      await seedEntry({ time: 90 }, 15_000);
      await assertFails(
        setDoc(entryDoc(player("other"), dayKey(), UID), entry({ time: 79 }))
      );
    });

    it("rejects changing a board that is more than a day old", async () => {
      await seedEntry({ time: 90 }, 15_000, dayKey(-3));
      await assertFails(
        setDoc(entryDoc(player(), dayKey(-3)), entry({ time: 79 }, dayKey(-3)))
      );
    });

    it("rejects switching the world on an update", async () => {
      await seedEntry({ time: 90 }, 15_000);
      await assertFails(
        setDoc(
          entryDoc(player()),
          entry({ world: otherWorld(dayKey()), time: 79 })
        )
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
          { nickname: "Happy Otter 7", world: worldOn(day), time: 79.4 },
          deps(UID)
        )
      ).toBe(true);
      expect(
        await submitDaily(
          day,
          { nickname: "Brave Fox 3", world: worldOn(day), time: 77 },
          deps("p2")
        )
      ).toBe(true);
      expect(await fetchDailyBoard(day, { config, baseUrl })).toEqual([
        { uid: "p2", nickname: "Brave Fox 3", value: 77 },
        { uid: UID, nickname: "Happy Otter 7", value: 79.4 },
      ]);
    });

    it("is refused for a forged time and for an old day", async () => {
      expect(
        await submitDaily(
          dayKey(),
          { nickname: "Happy Otter 7", world: worldOn(dayKey()), time: 1 },
          deps(UID)
        )
      ).toBe(false);
      expect(
        await submitDaily(
          dayKey(-5),
          { nickname: "Happy Otter 7", world: worldOn(dayKey(-5)), time: 90 },
          deps(UID)
        )
      ).toBe(false);
    });
  });
});

describe("ship season entries (season 2)", () => {
  const UID = "sailor-1";
  beforeEach(() => seedSeasons());
  const player = (uid = UID, provider: Provider | null = "anonymous") =>
    signedIn(uid, { provider });
  const shipDoc = (db: ReturnType<typeof anon>, uid = UID) =>
    doc(db, `shipSeasons/2/entries/${uid}`);

  const baseEntry = {
    nickname: "Happy Otter 7",
    totalStars: 3,
    bests: { outlast: 170, evacuation: 50 } as Record<string, unknown>,
  };
  const entry = (patch: Record<string, unknown> = {}) => ({
    ...baseEntry,
    updatedAt: serverTimestamp(),
    ...patch,
  });

  /** Seeds the player's doc as written `agoMs` milliseconds ago. */
  async function seedPlayer(
    patch: Record<string, unknown> = {},
    agoMs = 60_000
  ) {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(shipDoc(ctx.firestore()), {
        ...baseEntry,
        ...patch,
        updatedAt: new Date(Date.now() - agoMs),
      });
    });
  }

  describe("create", () => {
    it("allows the owner (anonymous provider) to create a valid entry", async () => {
      await assertSucceeds(setDoc(shipDoc(player()), entry()));
    });

    it("allows every best at its limit", async () => {
      await assertSucceeds(
        setDoc(
          shipDoc(player()),
          entry({
            totalStars: 12,
            bests: {
              outlast: 1440,
              evacuation: 100,
              shipshape: 3,
              smooth: 350,
            },
          })
        )
      );
    });

    it("rejects stars with no best to explain them", async () => {
      await assertFails(
        setDoc(shipDoc(player()), entry({ totalStars: 0, bests: {} }))
      );
      await assertFails(
        setDoc(shipDoc(player()), entry({ totalStars: 1, bests: {} }))
      );
      await assertSucceeds(
        setDoc(
          shipDoc(player()),
          entry({ totalStars: 1, bests: { outlast: 60 } })
        )
      );
    });

    it("rejects someone else's uid, a signed-out user, and other providers", async () => {
      await assertFails(setDoc(shipDoc(player("other"), UID), entry()));
      await assertFails(setDoc(shipDoc(anon()), entry()));
      await assertFails(setDoc(shipDoc(player(UID, "password")), entry()));
      await assertFails(setDoc(shipDoc(player(UID, "google.com")), entry()));
      await assertFails(setDoc(shipDoc(player(UID, null)), entry()));
    });

    const reject: [string, Record<string, unknown>][] = [
      ["an extra field", { extra: "x" }],
      ["a client-supplied updatedAt", { updatedAt: new Date() }],
      ["a free-text nickname", { nickname: "Evil Hacker 1" }],
      ["an html nickname", { nickname: "<b>Happy</b> Otter 7" }],
      ["a nickname number of 0", { nickname: "Happy Otter 0" }],
      ["a nickname number of 100", { nickname: "Happy Otter 100" }],
      ["a very long nickname", { nickname: `Happy Otter ${"7".repeat(60)}` }],
      ["a non-string nickname", { nickname: 7 }],
      ["a float total", { totalStars: 3.5 }],
      ["a string total", { totalStars: "3" }],
      ["a negative total", { totalStars: -1 }],
      ["a zero total", { totalStars: 0, bests: {} }],
      ["a total above 60 on first write", { totalStars: 61 }],
      ["bests that is not a map", { bests: [170] }],
      ["an unknown challenge in bests", { bests: { outlast: 170, cheat: 1 } }],
      ["a float outlast", { bests: { outlast: 170.5 } }],
      ["an outlast above a day", { bests: { outlast: 1441 }, totalStars: 9 }],
      ["a negative outlast", { bests: { outlast: -1 } }],
      [
        "an evacuation above 100",
        { bests: { evacuation: 101 }, totalStars: 9 },
      ],
      ["a shipshape above 3", { bests: { shipshape: 4 }, totalStars: 9 }],
      ["a smooth above 350", { bests: { smooth: 351 }, totalStars: 9 }],
      ["a negative smooth", { bests: { smooth: -1 }, totalStars: 9 }],
      ["a float smooth", { bests: { smooth: 100.5 }, totalStars: 9 }],
      [
        "a total lower than a smooth best needs",
        { totalStars: 2, bests: { smooth: 350 } },
      ],
      ["a string best", { bests: { outlast: "170" } }],
      [
        "a total lower than the bests need",
        { totalStars: 2, bests: { outlast: 170, evacuation: 50 } },
      ],
    ];
    it.each(reject)("rejects %s", async (_label, patch) => {
      await assertFails(setDoc(shipDoc(player()), entry(patch)));
    });

    it("rejects a missing nickname, bests or total", async () => {
      for (const key of ["nickname", "bests", "totalStars"]) {
        const { [key]: _omitted, ...rest } = entry() as Record<string, unknown>;
        void _omitted;
        await assertFails(setDoc(shipDoc(player()), rest));
      }
    });

    it.each([
      [100, 1],
      [199, 1],
      [200, 2],
      [349, 2],
      [350, 3],
    ])(
      "needs a smooth best of %i to carry %i star(s)",
      async (smooth, stars) => {
        const bests = { smooth };
        await assertSucceeds(
          setDoc(shipDoc(player()), entry({ totalStars: stars, bests }))
        );
        await resetFirestore();
        if (stars > 1) {
          await assertFails(
            setDoc(shipDoc(player()), entry({ totalStars: stars - 1, bests }))
          );
        }
      }
    );

    it("accepts a total higher than the bests need (more designs)", async () => {
      await assertSucceeds(
        setDoc(shipDoc(player()), entry({ totalStars: 40 }))
      );
    });

    it("rejects an update-style partial write that leaves fields out", async () => {
      await assertFails(
        setDoc(shipDoc(player()), {
          nickname: "Happy Otter 7",
          updatedAt: serverTimestamp(),
        })
      );
    });
  });

  describe("update", () => {
    it("allows a valid improvement after 10 s", async () => {
      await seedPlayer({}, 15_000);
      await assertSucceeds(
        setDoc(
          shipDoc(player()),
          entry({ totalStars: 6, bests: { outlast: 1440, evacuation: 50 } })
        )
      );
    });

    it("lets the total fall (a ship was deleted)", async () => {
      await seedPlayer({ totalStars: 20 }, 15_000);
      await assertSucceeds(setDoc(shipDoc(player()), entry()));
    });

    it("rejects a jump in stars faster than the game can award", async () => {
      await seedPlayer({}, 15_000);
      // 3 + 6 + 15/5 = 12 is the most allowed.
      await assertFails(setDoc(shipDoc(player()), entry({ totalStars: 13 })));
      await assertSucceeds(
        setDoc(shipDoc(player()), entry({ totalStars: 12 }))
      );
    });

    it("caps one write's rise at 9 stars, however long the gap", async () => {
      await seedPlayer({}, 600_000);
      // The old doc holds 3 stars, so 12 is the most one write may reach.
      await assertFails(setDoc(shipDoc(player()), entry({ totalStars: 13 })));
      await assertFails(setDoc(shipDoc(player()), entry({ totalStars: 100 })));
      await assertSucceeds(
        setDoc(shipDoc(player()), entry({ totalStars: 12 }))
      );
    });

    it("accepts a smooth best on update, and refuses one that outruns its total", async () => {
      await seedPlayer({}, 15_000);
      await assertSucceeds(
        setDoc(
          shipDoc(player()),
          entry({ totalStars: 5, bests: { outlast: 170, smooth: 350 } })
        )
      );
      await resetFirestore();
      await seedPlayer({}, 15_000);
      // 2 (outlast 170) + 3 (smooth 350) = 5 stars needed, 4 sent.
      await assertFails(
        setDoc(
          shipDoc(player()),
          entry({ totalStars: 4, bests: { outlast: 170, smooth: 350 } })
        )
      );
      // A smooth above its range is refused on update too.
      await assertFails(
        setDoc(
          shipDoc(player()),
          entry({ totalStars: 9, bests: { smooth: 351 } })
        )
      );
    });

    it("caps the total at 6000: 6000 is accepted and 6001 refused", async () => {
      await seedPlayer({ totalStars: 5995 }, 15_000);
      await assertFails(setDoc(shipDoc(player()), entry({ totalStars: 6001 })));
      await assertSucceeds(
        setDoc(shipDoc(player()), entry({ totalStars: 6000 }))
      );
    });

    it("rejects an update by another player", async () => {
      await seedPlayer({}, 15_000);
      await assertFails(setDoc(shipDoc(player("other"), UID), entry()));
      await assertFails(setDoc(shipDoc(anon()), entry()));
    });

    it("rejects invalid data on update too", async () => {
      await seedPlayer({}, 15_000);
      await assertFails(
        setDoc(shipDoc(player()), entry({ nickname: "Evil 1" }))
      );
      await assertFails(
        setDoc(shipDoc(player()), entry({ bests: { outlast: 9999 } }))
      );
      await assertFails(setDoc(shipDoc(player()), entry({ extra: 1 })));
    });

    it("rejects partial updates (updateDoc) that skip validation", async () => {
      await seedPlayer({}, 15_000);
      await assertFails(updateDoc(shipDoc(player()), { totalStars: 6000 }));
    });

    it("checks a partial write with a server time against the merged doc", async () => {
      await seedPlayer({}, 15_000);
      // The merged doc would hold 1 star for bests worth 3: refused even
      // though the new fields alone look fine.
      await assertFails(
        updateDoc(shipDoc(player()), {
          totalStars: 1,
          updatedAt: serverTimestamp(),
        })
      );
      // A bad nickname in the same shape is refused too.
      await assertFails(
        updateDoc(shipDoc(player()), {
          nickname: "Evil Hacker 1",
          updatedAt: serverTimestamp(),
        })
      );
      // The merge only stands when the whole merged doc is valid.
      await assertSucceeds(
        updateDoc(shipDoc(player()), {
          totalStars: 4,
          updatedAt: serverTimestamp(),
        })
      );
    });
  });

  describe("rate limit", () => {
    it("rejects an update less than 10 s after the last write", async () => {
      await seedPlayer({}, 2_000);
      await assertFails(setDoc(shipDoc(player()), entry()));
    });

    it("rejects two quick writes in a row", async () => {
      await assertSucceeds(setDoc(shipDoc(player()), entry()));
      await assertFails(setDoc(shipDoc(player()), entry()));
    });
  });

  describe("bans", () => {
    const ban = (db: ReturnType<typeof anon>) =>
      doc(db, `leaderboardBans/${UID}`);
    const banPlayer = () =>
      env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(ban(ctx.firestore()), { bannedAt: new Date() });
      });

    it("stops a banned uid creating or updating", async () => {
      await banPlayer();
      await assertFails(setDoc(shipDoc(player()), entry()));
    });

    it("stops a banned uid updating an entry", async () => {
      await seedPlayer({}, 15_000);
      await banPlayer();
      await assertFails(setDoc(shipDoc(player()), entry()));
    });

    it("does not stop other players", async () => {
      await banPlayer();
      await assertSucceeds(
        setDoc(shipDoc(player("sailor-2"), "sailor-2"), entry())
      );
    });
  });

  describe("read", () => {
    beforeEach(() => seedPlayer());
    const col = (db: ReturnType<typeof anon>) =>
      collection(db, "shipSeasons/2/entries");

    it("lets anyone get a single entry", async () => {
      await assertSucceeds(getDoc(shipDoc(anon())));
      await assertSucceeds(getDoc(shipDoc(player("someone-else"))));
    });

    it("lets anyone list with a limit of 50 or less", async () => {
      await assertSucceeds(
        getDocs(query(col(anon()), orderBy("totalStars", "desc"), limit(50)))
      );
      await assertSucceeds(getDocs(query(col(anon()), limit(20))));
    });

    it("rejects unlimited lists, big limits and offsets", async () => {
      await assertFails(getDocs(col(anon())));
      await assertFails(getDocs(query(col(anon()), limit(51))));
      await assertFails(getDocs(query(col(anon()), orderBy("totalStars"))));
    });
  });

  describe("delete", () => {
    beforeEach(() => seedPlayer());

    it("allows the admin", async () => {
      await assertSucceeds(deleteDoc(shipDoc(admin())));
    });

    it("rejects the owner and everyone else", async () => {
      await assertFails(deleteDoc(shipDoc(player())));
      await assertFails(deleteDoc(shipDoc(player("someone-else"))));
      await assertFails(deleteDoc(shipDoc(anon())));
      await assertFails(
        deleteDoc(shipDoc(signedIn(ADMIN_UID, { provider: "anonymous" })))
      );
    });
  });

  describe("other collections stay closed", () => {
    it("does not let a player write a plane leaderboard entry shape here", async () => {
      await assertFails(
        setDoc(shipDoc(player()), {
          ...baseEntry,
          prestige: 1,
          updatedAt: serverTimestamp(),
        })
      );
    });

    it("does not open sibling collections", async () => {
      await assertFails(
        setDoc(doc(player(), `shipLeaderboardX/${UID}`), entry())
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
      totalStars: 3,
      bests: { outlast: 170, evacuation: 50 },
    };

    it("creates the doc with the exact body the game sends", async () => {
      expect(await submitShipEntry(restEntry, 2, deps(UID))).toBe("ok");
      await env.withSecurityRulesDisabled(async (ctx) => {
        const snap = await getDoc(shipDoc(ctx.firestore()));
        expect(snap.data()?.totalStars).toBe(3);
        expect(snap.data()?.bests).toEqual({ outlast: 170, evacuation: 50 });
      });
    });

    it("rejects an immediate rewrite and a forged total", async () => {
      expect(await submitShipEntry(restEntry, 2, deps(UID))).toBe("ok");
      expect(await submitShipEntry(restEntry, 2, deps(UID))).toBe("refused");
      expect(
        await submitShipEntry(
          { ...restEntry, totalStars: 4000 },
          2,
          deps("sailor-9")
        )
      ).toBe("refused");
    });

    it("reads the board back ordered by stars", async () => {
      await submitShipEntry(restEntry, 2, deps(UID));
      await submitShipEntry(
        {
          nickname: "Brave Fox 3",
          totalStars: 9,
          bests: { outlast: 1440, evacuation: 100, shipshape: 3 },
        },
        2,
        deps("sailor-2")
      );
      const board = await fetchShipBoard(2, { config, baseUrl });
      expect(board).toEqual([
        { uid: "sailor-2", nickname: "Brave Fox 3", value: 9 },
        { uid: UID, nickname: "Happy Otter 7", value: 3 },
      ]);
    });
  });
});

describe("seasons", () => {
  const seasonDoc = (db: ReturnType<typeof anon>, game = "plane") =>
    doc(db, `seasons/${game}`);
  const season = (number: unknown, patch: Record<string, unknown> = {}) => ({
    number,
    startedAt: serverTimestamp(),
    ...patch,
  });
  const nonAdmins: [string, () => ReturnType<typeof anon>][] = [
    ["a signed-out user", () => anon()],
    ["a player", () => signedIn("player-1", { provider: "anonymous" })],
    [
      "the admin uid via anonymous sign-in",
      () => signedIn(ADMIN_UID, { provider: "anonymous" }),
    ],
    ["another password user", () => signedIn("uid-someone-else")],
  ];

  it("lets anyone get a season doc, but not list them", async () => {
    await seedSeasons();
    await assertSucceeds(getDoc(seasonDoc(anon())));
    await assertSucceeds(getDoc(seasonDoc(anon(), "ship")));
    await assertFails(getDocs(query(collection(anon(), "seasons"), limit(5))));
    await assertFails(getDocs(query(collection(admin(), "seasons"), limit(5))));
  });

  it("lets anyone get a missing season doc", async () => {
    await assertSucceeds(getDoc(seasonDoc(anon())));
  });

  it.each(nonAdmins)("refuses create and update by %s", async (_l, client) => {
    await assertFails(setDoc(seasonDoc(client()), season(2)));
    await seedSeasons();
    await assertFails(setDoc(seasonDoc(client()), season(3)));
    await assertFails(updateDoc(seasonDoc(client()), { number: 3 }));
    await assertFails(deleteDoc(seasonDoc(client())));
  });

  it("lets the admin create season 2 for each game, and nothing else", async () => {
    await assertFails(setDoc(seasonDoc(admin()), season(1)));
    await assertFails(setDoc(seasonDoc(admin()), season(3)));
    await assertFails(setDoc(seasonDoc(admin()), season("2")));
    await assertFails(setDoc(seasonDoc(admin()), season(2.5)));
    await assertSucceeds(setDoc(seasonDoc(admin()), season(2)));
    await assertSucceeds(setDoc(seasonDoc(admin(), "ship"), season(2)));
    await assertFails(setDoc(seasonDoc(admin(), "boat"), season(2)));
    await assertFails(setDoc(seasonDoc(admin(), "daily"), season(2)));
  });

  it("refuses a client-supplied startedAt and extra or missing keys", async () => {
    await assertFails(
      setDoc(seasonDoc(admin()), season(2, { startedAt: new Date() }))
    );
    await assertFails(setDoc(seasonDoc(admin()), season(2, { extra: 1 })));
    await assertFails(setDoc(seasonDoc(admin()), { number: 2 }));
    await assertFails(
      setDoc(seasonDoc(admin()), { startedAt: serverTimestamp() })
    );
    await seedSeasons();
    await assertFails(setDoc(seasonDoc(admin()), season(3, { extra: 1 })));
    await assertFails(
      setDoc(seasonDoc(admin()), season(3, { startedAt: new Date() }))
    );
    await assertFails(updateDoc(seasonDoc(admin()), { number: 3 }));
  });

  it("season must go up by exactly one", async () => {
    await seedSeasons();
    await assertFails(setDoc(seasonDoc(admin()), season(4)));
    await assertFails(setDoc(seasonDoc(admin()), season(2)));
    await assertFails(setDoc(seasonDoc(admin()), season(1)));
    await assertFails(setDoc(seasonDoc(admin()), season(3.0001)));
    await assertSucceeds(setDoc(seasonDoc(admin()), season(3)));
    await assertSucceeds(
      updateDoc(seasonDoc(admin(), "ship"), {
        number: 3,
        startedAt: serverTimestamp(),
      })
    );
  });

  it("refuses delete, even for the admin", async () => {
    await seedSeasons();
    await assertFails(deleteDoc(seasonDoc(admin())));
    await assertFails(deleteDoc(seasonDoc(anon())));
  });

  it("does not open subcollections of a season doc", async () => {
    await seedSeasons();
    await assertFails(setDoc(doc(admin(), "seasons/plane/x/y"), season(2)));
  });
});

describe("season paths", () => {
  const PLAYER = "player-1";
  const player = (uid = PLAYER) => signedIn(uid, { provider: "anonymous" });
  const planeEntry = (patch: Record<string, unknown> = {}) => ({
    nickname: "Happy Otter 7",
    prestige: 1,
    score: scoreFor(1, 1000.5),
    lifetimeDistance: 1000.5,
    bestTimes: { meadow: 20 },
    fastestRun: null,
    updatedAt: serverTimestamp(),
    ...patch,
  });
  const shipEntry = (patch: Record<string, unknown> = {}) => ({
    nickname: "Happy Otter 7",
    totalStars: 3,
    bests: { outlast: 170, evacuation: 50 },
    updatedAt: serverTimestamp(),
    ...patch,
  });
  const planePath = (season: number | string, uid = PLAYER) =>
    `planeSeasons/${season}/entries/${uid}`;
  const shipPath = (season: number | string, uid = PLAYER) =>
    `shipSeasons/${season}/entries/${uid}`;
  /** Seeds a doc as written a minute ago. */
  const seedAt = (path: string, data: Record<string, unknown>) =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), path), {
        ...data,
        updatedAt: new Date(Date.now() - 60_000),
      });
    });
  const stored = async (path: string) => {
    let data: Record<string, unknown> | undefined;
    await env.withSecurityRulesDisabled(async (ctx) => {
      data = (await getDoc(doc(ctx.firestore(), path))).data();
    });
    return data;
  };

  it("writes to a past season are refused", async () => {
    await seedSeasons(3, 3);
    await assertFails(setDoc(doc(player(), planePath(2)), planeEntry()));
    await assertFails(setDoc(doc(player(), shipPath(2)), shipEntry()));
    await assertFails(setDoc(doc(player(), planePath(1)), planeEntry()));
    await assertFails(setDoc(doc(player(), planePath(4)), planeEntry()));
    await assertSucceeds(setDoc(doc(player(), planePath(3)), planeEntry()));
    await assertSucceeds(setDoc(doc(player(), shipPath(3)), shipEntry()));
  });

  it("refuses updates to an entry in a past season", async () => {
    await seedSeasons(3, 3);
    await seedAt(planePath(2), planeEntry());
    await seedAt(shipPath(2), shipEntry());
    await assertFails(
      setDoc(
        doc(player(), planePath(2)),
        planeEntry({ lifetimeDistance: 2000, score: scoreFor(1, 2000) })
      )
    );
    await assertFails(
      setDoc(doc(player(), shipPath(2)), shipEntry({ totalStars: 4 }))
    );
  });

  it("refuses a season path that only looks like the current number", async () => {
    await seedSeasons();
    await assertFails(setDoc(doc(player(), planePath("02")), planeEntry()));
    await assertFails(setDoc(doc(player(), shipPath("2.0")), shipEntry()));
  });

  it("each game has its own season number", async () => {
    await seedSeasons(3, 2);
    await assertSucceeds(setDoc(doc(player(), planePath(3)), planeEntry()));
    await assertFails(setDoc(doc(player(), shipPath(3)), shipEntry()));
    await assertSucceeds(setDoc(doc(player(), shipPath(2)), shipEntry()));
  });

  it("no season doc → season-path writes refused", async () => {
    for (const season of [1, 2]) {
      await assertFails(setDoc(doc(player(), planePath(season)), planeEntry()));
      await assertFails(setDoc(doc(player(), shipPath(season)), shipEntry()));
    }
    // One game's season doc does not open the other.
    await seedSeasons(2, null);
    await assertSucceeds(setDoc(doc(player(), planePath(2)), planeEntry()));
    await assertFails(setDoc(doc(player(), shipPath(2)), shipEntry()));
  });

  it("legacy collections refuse player writes", async () => {
    await seedSeasons();
    await assertFails(
      setDoc(doc(player(), `leaderboard/${PLAYER}`), planeEntry())
    );
    await assertFails(
      setDoc(doc(player(), `shipLeaderboard/${PLAYER}`), shipEntry())
    );
    await seedAt(`leaderboard/${PLAYER}`, planeEntry());
    await seedAt(`shipLeaderboard/${PLAYER}`, shipEntry());
    await assertFails(
      setDoc(
        doc(player(), `leaderboard/${PLAYER}`),
        planeEntry({ lifetimeDistance: 2000, score: scoreFor(1, 2000) })
      )
    );
    await assertFails(
      setDoc(
        doc(player(), `shipLeaderboard/${PLAYER}`),
        shipEntry({ totalStars: 4 })
      )
    );
    // Even the admin cannot create legacy entries.
    await assertFails(
      setDoc(doc(admin(), "leaderboard/new-player"), planeEntry())
    );
  });

  it("legacy collections stay readable", async () => {
    await seedAt(`leaderboard/${PLAYER}`, planeEntry());
    await seedAt(`shipLeaderboard/${PLAYER}`, shipEntry());
    await assertSucceeds(getDoc(doc(anon(), `leaderboard/${PLAYER}`)));
    await assertSucceeds(
      getDocs(query(collection(anon(), "shipLeaderboard"), limit(50)))
    );
    await assertFails(
      getDocs(query(collection(anon(), "leaderboard"), limit(51)))
    );
  });

  it("fresh season entry from a veteran is accepted", async () => {
    await seedSeasons();
    // A big season-1 standing does not carry over.
    await seedAt(
      `leaderboard/${PLAYER}`,
      planeEntry({
        prestige: 40,
        score: scoreFor(40, 5e6),
        lifetimeDistance: 5e6,
      })
    );
    await assertSucceeds(
      setDoc(
        doc(player(), planePath(2)),
        planeEntry({
          prestige: 1,
          lifetimeDistance: 120000,
          score: scoreFor(1, 120000),
        })
      )
    );
    // The create limits still hold in a new season.
    await assertFails(
      setDoc(
        doc(player("player-2"), planePath(2, "player-2")),
        planeEntry({ prestige: 2, score: scoreFor(2, 1000.5) })
      )
    );
    await assertFails(
      setDoc(
        doc(player("player-2"), shipPath(2, "player-2")),
        shipEntry({ totalStars: 61 })
      )
    );
  });

  describe("admin can rename an entry, nothing else", () => {
    const renamed = { nickname: "Brave Fox 3", updatedAt: serverTimestamp() };
    const cases: [string, string, Record<string, unknown>][] = [
      ["plane season 2", planePath(2), planeEntry()],
      ["ship season 2", shipPath(2), shipEntry()],
      ["plane season 1 (legacy)", `leaderboard/${PLAYER}`, planeEntry()],
      ["ship season 1 (legacy)", `shipLeaderboard/${PLAYER}`, shipEntry()],
    ];

    it.each(cases)("on %s", async (_label, path, data) => {
      await seedSeasons(3, 3);
      await seedAt(path, data);
      const before = await stored(path);
      await assertSucceeds(updateDoc(doc(admin(), path), renamed));
      const after = await stored(path);
      expect(after?.nickname).toBe("Brave Fox 3");
      const { nickname: _a, updatedAt: _b, ...restBefore } = before!;
      const { nickname: _c, updatedAt: _d, ...restAfter } = after!;
      void [_a, _b, _c, _d];
      expect(restAfter).toEqual(restBefore);
    });

    it.each(cases)(
      "refuses other changes on %s",
      async (_label, path, data) => {
        await seedSeasons(3, 3);
        await seedAt(path, data);
        const ref = () => doc(admin(), path);
        const isPlane = "score" in data;
        const scoreChange = isPlane
          ? { score: scoreFor(1, 2000), lifetimeDistance: 2000 }
          : { totalStars: 9 };
        const bestsChange = isPlane
          ? { bestTimes: { meadow: 16 } }
          : { bests: { outlast: 1440 } };
        await assertFails(updateDoc(ref(), { ...renamed, ...scoreChange }));
        await assertFails(updateDoc(ref(), { ...renamed, ...bestsChange }));
        await assertFails(
          updateDoc(ref(), { ...renamed, nickname: "Rude Name 7" })
        );
        await assertFails(updateDoc(ref(), { ...renamed, nickname: "Bob" }));
        await assertFails(updateDoc(ref(), { nickname: "Brave Fox 3" }));
        await assertFails(
          updateDoc(ref(), { nickname: "Brave Fox 3", updatedAt: new Date() })
        );
        await assertFails(updateDoc(ref(), { ...renamed, extra: 1 }));
        await assertFails(setDoc(ref(), { nickname: "Brave Fox 3" }));
        // Not the admin: no rename.
        await assertFails(
          updateDoc(doc(signedIn("uid-someone-else"), path), renamed)
        );
        await assertFails(
          updateDoc(
            doc(signedIn(ADMIN_UID, { provider: "anonymous" }), path),
            renamed
          )
        );
      }
    );

    it("cannot create an entry in the current season", async () => {
      await seedSeasons();
      await assertFails(setDoc(doc(admin(), planePath(2)), planeEntry()));
      await assertFails(setDoc(doc(admin(), shipPath(2)), shipEntry()));
    });
  });

  it("admin can delete any season's entry; players cannot", async () => {
    await seedSeasons(3, 3);
    const paths = [
      `leaderboard/${PLAYER}`,
      `shipLeaderboard/${PLAYER}`,
      planePath(2),
      planePath(3),
      shipPath(2),
      shipPath(3),
    ];
    for (const path of paths) {
      await seedAt(path, path.startsWith("ship") ? shipEntry() : planeEntry());
      await assertFails(deleteDoc(doc(player(), path)));
      await assertFails(deleteDoc(doc(anon(), path)));
      await assertFails(
        deleteDoc(doc(signedIn(ADMIN_UID, { provider: "anonymous" }), path))
      );
      await assertSucceeds(deleteDoc(doc(admin(), path)));
      expect(await stored(path)).toBeUndefined();
    }
  });

  it("lists a season's entries with a limit and no offset", async () => {
    await seedSeasons(3, 3);
    await seedAt(planePath(2), planeEntry());
    const board = (db: ReturnType<typeof anon>, path: string) =>
      collection(db, path);
    for (const path of ["planeSeasons/2/entries", "shipSeasons/3/entries"]) {
      await assertSucceeds(getDocs(query(board(anon(), path), limit(50))));
      await assertFails(getDocs(query(board(anon(), path), limit(51))));
      await assertFails(getDocs(board(anon(), path)));
    }
    await assertSucceeds(getDoc(doc(anon(), planePath(2))));
  });

  it("ban blocks writes in every season of both games", async () => {
    for (const season of [2, 3, 4]) {
      await resetFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, `leaderboardBans/${PLAYER}`), {
          bannedAt: new Date(),
        });
        await setDoc(doc(db, "seasons/plane"), {
          number: season,
          startedAt: new Date(),
        });
        await setDoc(doc(db, "seasons/ship"), {
          number: season,
          startedAt: new Date(),
        });
      });
      await assertFails(setDoc(doc(player(), planePath(season)), planeEntry()));
      await assertFails(setDoc(doc(player(), shipPath(season)), shipEntry()));
      // An existing entry cannot be updated either.
      await seedAt(planePath(season), planeEntry());
      await seedAt(shipPath(season), shipEntry());
      await assertFails(
        setDoc(
          doc(player(), planePath(season)),
          planeEntry({ lifetimeDistance: 2000, score: scoreFor(1, 2000) })
        )
      );
      await assertFails(
        setDoc(doc(player(), shipPath(season)), shipEntry({ totalStars: 4 }))
      );
      // Other players are unaffected.
      await assertSucceeds(
        setDoc(
          doc(player("player-2"), planePath(season, "player-2")),
          planeEntry()
        )
      );
    }
  });

  it("fetchSeason reads the season over REST without auth", async () => {
    const deps = { config, baseUrl, getAppCheckHeaders: async () => ({}) };
    expect(await fetchSeason("plane", deps)).toEqual({
      number: 1,
      startedAt: null,
    });
    await seedSeasons(3, 2);
    const plane = await fetchSeason("plane", deps);
    expect(plane?.number).toBe(3);
    expect(plane?.startedAt).toBeInstanceOf(Date);
    expect((await fetchSeason("ship", deps))?.number).toBe(2);
  });
});

describe("a new season's first writes are capped by time since it began", () => {
  const UID = "player-1";
  const player = (uid = UID) => signedIn(uid, { provider: "anonymous" });
  const planeDoc = (uid = UID) =>
    doc(player(uid), `planeSeasons/2/entries/${uid}`);
  const shipDoc = (uid = UID) =>
    doc(player(uid), `shipSeasons/2/entries/${uid}`);
  const plane = (distance: number) => ({
    nickname: "Happy Otter 7",
    prestige: 1,
    score: scoreFor(1, distance),
    lifetimeDistance: distance,
    bestTimes: {},
    fastestRun: null,
    updatedAt: serverTimestamp(),
  });
  const ship = (totalStars: number) => ({
    nickname: "Happy Otter 7",
    totalStars,
    bests: { outlast: 1440, evacuation: 100, shipshape: 3, smooth: 350 },
    updatedAt: serverTimestamp(),
  });

  it("refuses a create at the old caps right after the season starts", async () => {
    await seedSeasons(2, 2, 0);
    await assertFails(setDoc(planeDoc(), plane(150_000)));
    await assertFails(setDoc(shipDoc(), ship(60)));
    // Just over one flight's worth, and just over 6 stars.
    await assertFails(setDoc(planeDoc("p2"), plane(12_000)));
    await assertFails(setDoc(shipDoc("p2"), ship(13)));
  });

  it("accepts a modest create right after the season starts", async () => {
    await seedSeasons(2, 2, 0);
    await assertSucceeds(setDoc(planeDoc(), plane(5000)));
    await assertSucceeds(
      setDoc(shipDoc(), { ...ship(3), bests: { outlast: 170, evacuation: 50 } })
    );
  });

  it("allows 200 m and a fifth of a star per second since the start", async () => {
    // 60 s in: up to 200 * 60 + 9100 = 21100 m and 6 + 12 = 18 stars.
    await seedSeasons(2, 2, 60_000);
    await assertFails(setDoc(planeDoc("p2"), plane(21_500)));
    await assertSucceeds(setDoc(planeDoc(), plane(21_000)));
    await assertFails(setDoc(shipDoc("p2"), ship(19)));
    await assertSucceeds(setDoc(shipDoc(), ship(18)));
  });

  it("accepts the full create caps well after the start", async () => {
    await seedSeasons(2, 2, 3_600_000);
    await assertSucceeds(setDoc(planeDoc(), plane(150_000)));
    await assertSucceeds(setDoc(shipDoc(), ship(60)));
    // The old caps still hold.
    await assertFails(setDoc(planeDoc("p2"), plane(150_001)));
    await assertFails(setDoc(shipDoc("p2"), ship(61)));
  });

  it("leaves updates to the per-write limits", async () => {
    await seedSeasons(2, 2, 0);
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `planeSeasons/2/entries/${UID}`), {
        ...plane(5000),
        updatedAt: new Date(Date.now() - 60_000),
      });
    });
    // 5000 + 200 * 60 + 9100 allows 25000 on update.
    await assertSucceeds(setDoc(planeDoc(), plane(25_000)));
  });
});

describe("boardSettings", () => {
  const settings = (db: ReturnType<typeof anon>, game = "plane") =>
    doc(db, `boardSettings/${game}`);

  it("lets anyone get the settings, but not list them", async () => {
    await assertSucceeds(getDoc(settings(anon())));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(settings(ctx.firestore()), { hidden: true });
    });
    await assertSucceeds(getDoc(settings(anon())));
    await assertSucceeds(
      getDoc(settings(signedIn("player-1", { provider: "anonymous" })))
    );
    await assertFails(
      getDocs(query(collection(anon(), "boardSettings"), limit(5)))
    );
  });

  it("lets the admin create and update the plane switch", async () => {
    await assertSucceeds(setDoc(settings(admin()), { hidden: true }));
    await assertSucceeds(setDoc(settings(admin()), { hidden: false }));
    await assertSucceeds(updateDoc(settings(admin()), { hidden: true }));
  });

  it.each([
    ["a signed-out user", () => anon()],
    ["a player", () => signedIn("player-1", { provider: "anonymous" })],
    [
      "the admin uid via anonymous sign-in",
      () => signedIn(ADMIN_UID, { provider: "anonymous" }),
    ],
    ["another password user", () => signedIn("uid-someone-else")],
  ])("refuses writes by %s", async (_label, client) => {
    await assertFails(setDoc(settings(client()), { hidden: false }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(settings(ctx.firestore()), { hidden: true });
    });
    await assertFails(setDoc(settings(client()), { hidden: false }));
    await assertFails(deleteDoc(settings(client())));
  });

  it("refuses extra keys, missing keys and a non-bool", async () => {
    for (const data of [
      { hidden: true, extra: 1 },
      {},
      { shown: true },
      { hidden: "false" },
      { hidden: 0 },
      { hidden: null },
    ]) {
      await assertFails(setDoc(settings(admin()), data));
    }
  });

  it("refuses any game but plane, and delete", async () => {
    await assertFails(setDoc(settings(admin(), "ship"), { hidden: true }));
    await assertFails(setDoc(settings(admin(), "daily"), { hidden: true }));
    await assertSucceeds(setDoc(settings(admin()), { hidden: true }));
    await assertFails(deleteDoc(settings(admin())));
  });
});

// The /admin board tools run these exact functions against the SDK, so the
// rules must accept every write they make, and refuse them for anyone else.
describe("admin board tools", () => {
  const UID = "player-1";
  const adminDb = () => admin() as unknown as Firestore;
  const seedDoc = (path: string, data: Record<string, unknown>) =>
    env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), path), data);
    });
  const exists = async (path: string) => {
    let found = false;
    await env.withSecurityRulesDisabled(async (ctx) => {
      found = (await getDoc(doc(ctx.firestore(), path))).exists();
    });
    return found;
  };
  const planeEntry = {
    nickname: "Happy Otter 7",
    prestige: 1,
    score: scoreFor(1, 1000.5),
    lifetimeDistance: 1000.5,
    bestTimes: { meadow: 20 },
    fastestRun: null,
    updatedAt: new Date(Date.now() - 60_000),
  };
  const shipEntry = {
    nickname: "Happy Otter 7",
    totalStars: 3,
    bests: { outlast: 170 },
    updatedAt: new Date(Date.now() - 60_000),
  };

  it("startSeason creates season 2, then adds one each time", async () => {
    expect(await startSeason(adminDb(), "plane", 1)).toBe(2);
    expect(await startSeason(adminDb(), "plane", 2)).toBe(3);
    expect(await startSeason(adminDb(), "ship", 1)).toBe(2);
    const plane = await readSeason(adminDb(), "plane");
    expect(plane.number).toBe(3);
    expect(plane.startedAt).toBeInstanceOf(Date);
    expect((await readSeason(adminDb(), "ship")).number).toBe(2);
  });

  it("startSeason only starts the season after the one confirmed", async () => {
    await seedSeasons(2, null);
    expect(await startSeason(adminDb(), "plane", 2)).toBe(3);
    // A second click, or a stale tab that still shows season 2.
    await expect(startSeason(adminDb(), "plane", 2)).rejects.toThrow(
      SeasonChangedError
    );
    expect((await readSeason(adminDb(), "plane")).number).toBe(3);
    // A tab that thinks no season was started yet.
    await expect(startSeason(adminDb(), "ship", 2)).rejects.toThrow(
      SeasonChangedError
    );
    await expect(startSeason(adminDb(), "plane", 1)).rejects.toThrow(
      SeasonChangedError
    );
    expect((await readSeason(adminDb(), "ship")).number).toBe(1);
    expect((await readSeason(adminDb(), "plane")).number).toBe(3);
  });

  it("startSeason is refused for anyone but the admin", async () => {
    const player = signedIn(UID, { provider: "anonymous" });
    await assertFails(startSeason(player as unknown as Firestore, "plane", 1));
    await assertFails(
      startSeason(
        signedIn("uid-someone-else") as unknown as Firestore,
        "plane",
        1
      )
    );
  });

  it("reads, renames and deletes entries in season 1 and later seasons", async () => {
    await seedSeasons(2, 2);
    await seedDoc(`leaderboard/${UID}`, planeEntry);
    await seedDoc(`planeSeasons/2/entries/${UID}`, planeEntry);
    await seedDoc(`shipLeaderboard/${UID}`, shipEntry);
    await seedDoc(`shipSeasons/2/entries/${UID}`, shipEntry);
    for (const game of ["plane", "ship"] as const) {
      for (const season of [1, 2]) {
        const rows = await readBoard(adminDb(), game, season);
        expect(rows.map((r) => r.uid)).toEqual([UID]);
        const nickname = randomNickname();
        await assertSucceeds(
          renameEntry(adminDb(), game, season, UID, nickname)
        );
        expect((await readBoard(adminDb(), game, season))[0].nickname).toBe(
          nickname
        );
        await assertSucceeds(deleteEntry(adminDb(), game, season, UID));
        expect(await readBoard(adminDb(), game, season)).toEqual([]);
      }
    }
  });

  it("banEverywhere bans and clears every board in one batch, missing docs included", async () => {
    await seedSeasons(3, 2);
    const now = new Date();
    const paths = banDeletePaths(UID, 3, 2, now);
    // Seed only some of the paths: deleting the missing ones is fine.
    await seedDoc(`leaderboard/${UID}`, planeEntry);
    await seedDoc(`planeSeasons/3/entries/${UID}`, planeEntry);
    await seedDoc(`shipSeasons/2/entries/${UID}`, shipEntry);
    // Daily entries from two days ago through tomorrow, by this clock.
    const dailyPaths = paths.filter((p) => p.startsWith("planeDaily/"));
    expect(dailyPaths).toHaveLength(4);
    for (const path of dailyPaths) {
      await seedDoc(path, {
        nickname: "Happy Otter 7",
        world: "meadow",
        time: 30,
        updatedAt: new Date(),
      });
    }
    await seedDoc(`planeSeasons/3/entries/player-2`, planeEntry);
    await assertSucceeds(banEverywhere(adminDb(), UID, now));
    for (const path of paths) expect(await exists(path)).toBe(false);
    expect(await exists(`leaderboardBans/${UID}`)).toBe(true);
    expect(await exists(`planeSeasons/3/entries/player-2`)).toBe(true);
  });

  it("banEverywhere is refused for anyone but the admin", async () => {
    await seedSeasons(2, 2);
    await seedDoc(`planeSeasons/2/entries/${UID}`, planeEntry);
    await assertFails(
      banEverywhere(signedIn("uid-someone-else") as unknown as Firestore, UID)
    );
    expect(await exists(`planeSeasons/2/entries/${UID}`)).toBe(true);
  });

  it("reads and writes the plane board's hidden switch", async () => {
    expect(await readBoardHidden(adminDb(), "plane")).toBe(true);
    await assertSucceeds(writeBoardHidden(adminDb(), "plane", false));
    expect(await readBoardHidden(adminDb(), "plane")).toBe(false);
    await assertSucceeds(writeBoardHidden(adminDb(), "plane", true));
    expect(await readBoardHidden(adminDb(), "plane")).toBe(true);
  });
});
