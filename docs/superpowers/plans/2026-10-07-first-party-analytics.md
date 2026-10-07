# First-party analytics and /admin dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Privacy-friendly pageview analytics for `/` and `/ship-builder`, stored in Firestore, with a Google-sign-in `/admin` dashboard (per-site tabs plus a timezone-based visitor map) restricted to `gentry.riggen@gmail.com`.

**Architecture:** Public pages send one pageview per route change straight to the Firestore **REST API** (`documents:commit`, unauthenticated, no Firebase SDK in the visitor bundle). Firestore security rules allow only schema-valid creates from anyone and reads only for the admin email. `/admin` is a client-rendered page that loads the Firebase SDK (Auth + Firestore) lazily, gates on Google sign-in, fetches raw docs for a date window and aggregates them in the browser.

**Tech Stack:** Next.js 16 static export, React 19, Tailwind 4, Firebase JS SDK 13 (admin only), Firestore REST (tracker), `@firebase/rules-unit-testing` + Firestore emulator, `world-atlas` + `topojson-client` (map outline), Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-first-party-analytics-design.md`

## Spec amendments (applied in Task 1)

Two refinements discovered while planning; both are simplifications:

1. The tracker uses the Firestore REST `commit` endpoint, not the SDK. Public pages ship ~0 KB extra JS and the SDK loads only on `/admin`. The same security rules apply to REST.
2. The dashboard fetches all docs for the window by `ts` only and filters `site` in the browser. That needs only the automatic single-field index, so there is no `firestore.indexes.json` and no `count()` queries. Totals are computed from the fetched docs.

## Conventions (read before starting)

- Run `npx prettier --write <files>` before every commit. The lefthook pre-commit runs eslint, `prettier --check` and `tsc --noEmit`, and rejects unformatted files.
- `export default function` for components, `interface` for props, Tailwind only (no inline styles, every element works in light and dark), `"use client"` only where needed.
- Unit tests live in `__tests__/` beside the code. Run one with `npm test -- --testPathPattern=<name>`.
- Next.js 16 differs from older versions. Before using `usePathname` or the metadata API, skim `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-pathname.md`.
- Firebase JS SDK is on a new major (13). If an import or signature in this plan doesn't type-check, check the installed package's types or Context7 before improvising. The modular API (`firebase/app`, `firebase/auth`, `firebase/firestore`) is expected to be unchanged.
- ESLint's `react-hooks` rules forbid synchronous `setState` in effects. The code below only sets state inside async callbacks or initializers; keep it that way.

## Execution notes

- Task 0 (owner) can happen any time before Task 9. Until `lib/firebase/config.ts` holds real values the tracker and admin both no-op safely, so every earlier task is safe to merge.
- After Task 1, Tasks 2, 3, 5 and 6 touch disjoint files and can run in parallel.
- Review depth: **Tasks 3 and 7 are security boundaries** (rules and the auth gate) and need a spec review plus an adversarial review. Other tasks need one combined review.
- Run the slow checks (`npm run build`, Playwright) once at Task 9, not per task.

## File structure

```
lib/firebase/config.ts            Firebase web config + isFirebaseConfigured()
lib/firebase/client.ts            Lazy SDK: auth watch/sign-in/out, fetchPageviews (admin only)
lib/analytics/types.ts            Site, PageviewEvent, PageviewDoc
lib/analytics/site.ts             normalizePath, siteForPath
lib/analytics/ua.ts               parseBrowser/Os/Device, isBot, screenBucket
lib/analytics/storage.ts          safeLocalStorage()
lib/analytics/visitor.ts          utcDay, getVisitorId (daily-rotating)
lib/analytics/exclude.ts          own-traffic flag
lib/analytics/event.ts            buildPageview(env) -> event | null
lib/analytics/send.ts             Firestore REST commit body + sendPageview
lib/analytics/admin.ts            ADMIN_EMAIL, isAdminUser
lib/analytics/aggregate.ts        summarize(), pctChange()
lib/analytics/geo.ts              tz -> coordinates, projection, land path
components/analytics/AnalyticsTracker.tsx
components/admin/AdminGate.tsx    auth state machine
components/admin/Dashboard.tsx    tabs, range, data load
components/admin/SummaryView.tsx  tiles + chart + breakdowns + map for one Summary
components/admin/StatTile.tsx, TimeSeriesChart.tsx, BreakdownList.tsx, VisitorMap.tsx
app/admin/page.tsx
firestore.rules
firestore-tests/rules.test.ts     emulator tests (separate jest config)
jest.rules.config.js
```

---

### Task 0: Firebase console setup (owner, manual)

**Goal:** Everything that can only be done in the Firebase / Google Cloud consoles.

**Acceptance Criteria:**

- [ ] Firestore database exists in the `gentryriggen` project (production mode)
- [ ] Google sign-in provider enabled
- [ ] Authorized domains include `gentryriggen.com` (and `www.` if used)
- [ ] A Web app is registered and its config object is available
- [ ] The CI service account can deploy Firestore rules

**Steps:**

- [ ] **Step 1:** Firebase console → project `gentryriggen` → Build → Firestore Database → Create database → production mode → pick a location (cannot be changed later).
- [ ] **Step 2:** Build → Authentication → Get started → Sign-in method → Google → Enable → set a support email → Save.
- [ ] **Step 3:** Authentication → Settings → Authorized domains → add `gentryriggen.com` (and `www.gentryriggen.com` if it serves the site). `localhost` is there by default.
- [ ] **Step 4:** Project settings → Your apps → Add app → Web → register. Copy the `firebaseConfig` object (apiKey, authDomain, projectId, appId, and optionally storageBucket, messagingSenderId). These values are public by design.
- [ ] **Step 5:** Google Cloud console → IAM → find the service account stored in the GitHub secret `FIREBASE_SERVICE_ACCOUNT` → add the role **Firebase Rules Admin** (needed so CI can run `firebase deploy --only firestore:rules`). Also confirm the Cloud Firestore API is enabled.
- [ ] **Step 6 (optional hardening):** Cloud console → APIs & Services → Credentials → the browser API key → Application restrictions → HTTP referrers: `https://gentryriggen.com/*`, `https://www.gentryriggen.com/*`, `http://localhost:3000/*`. Test sign-in and a pageview afterwards; if something breaks, loosen it.

Hand the config object to the implementer for Task 9 (or paste it into `lib/firebase/config.ts` yourself).

---

### Task 1: Dependencies, config scaffold, spec amendments

**Goal:** Install packages, add the Firebase config module (empty values, safe no-op) and shared types, and amend the spec.

**Files:**

- Modify: `package.json`, `package-lock.json`
- Create: `lib/firebase/config.ts`, `lib/analytics/types.ts`
- Modify: `docs/superpowers/specs/2026-10-07-first-party-analytics-design.md`
- Test: `lib/firebase/__tests__/config.test.ts`

**Acceptance Criteria:**

- [ ] `firebase`, `world-atlas`, `topojson-client` are dependencies; `@firebase/rules-unit-testing`, `@types/topojson-client`, `@types/topojson-specification` are devDependencies
- [ ] `isFirebaseConfigured()` is false while `apiKey`/`projectId` are empty
- [ ] Spec reflects the two amendments above

**Verify:** `npm test -- --testPathPattern=config && npm run type-check` → PASS

**Steps:**

- [ ] **Step 1: Install**

```bash
npm install firebase world-atlas topojson-client
npm install -D @firebase/rules-unit-testing @types/topojson-client @types/topojson-specification
```

- [ ] **Step 2: Write the failing test** `lib/firebase/__tests__/config.test.ts`

```ts
import { isFirebaseConfigured } from "../config";

describe("isFirebaseConfigured", () => {
  const base = {
    apiKey: "key",
    authDomain: "x.firebaseapp.com",
    projectId: "proj",
    appId: "1:2:web:3",
  };

  it("is true when apiKey and projectId are set", () => {
    expect(isFirebaseConfigured(base)).toBe(true);
  });

  it("is false when apiKey is empty", () => {
    expect(isFirebaseConfigured({ ...base, apiKey: "" })).toBe(false);
  });

  it("is false when projectId is empty", () => {
    expect(isFirebaseConfigured({ ...base, projectId: "" })).toBe(false);
  });
});
```

- [ ] **Step 3: Run it, expect FAIL** (`Cannot find module '../config'`)

Run: `npm test -- --testPathPattern=config`

- [ ] **Step 4: Create `lib/firebase/config.ts`**

```ts
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

/**
 * Firebase web config. These values are public by design (they identify the
 * project; access is enforced by firestore.rules). While apiKey/projectId are
 * empty, the tracker and /admin do nothing.
 */
export const firebaseConfig: FirebaseWebConfig = {
  apiKey: "",
  authDomain: "gentryriggen.firebaseapp.com",
  projectId: "gentryriggen",
  appId: "",
};

export function isFirebaseConfigured(
  config: FirebaseWebConfig = firebaseConfig
): boolean {
  return Boolean(config.apiKey && config.projectId);
}
```

- [ ] **Step 5: Create `lib/analytics/types.ts`**

```ts
export type Site = "home" | "ship-builder";
export const SITES: readonly Site[] = ["home", "ship-builder"];

export type Device = "mobile" | "tablet" | "desktop";
export type ScreenBucket = "<640" | "640-1023" | "1024-1439" | "1440+";

/** The fields stored in a pageviews doc (besides the server timestamp). */
export interface PageviewEvent {
  site: Site;
  path: string;
  ref: string;
  device: Device;
  browser: string;
  os: string;
  screen: ScreenBucket;
  tz: string;
  vid: string;
}

/** A pageviews doc as the dashboard reads it. */
export interface PageviewDoc extends PageviewEvent {
  ts: Date;
}
```

- [ ] **Step 6: Amend the spec.** In `docs/superpowers/specs/2026-10-07-first-party-analytics-design.md`:
  - Under "Collection", replace the sentence about lazy-loading the Firebase SDK after idle with: "It sends each view to the Firestore REST API (`documents:commit`, unauthenticated), so public pages ship no Firebase SDK. The SDK loads only on `/admin`."
  - Under "Dashboard", replace "with Firestore `count()` for totals" with "totals are computed from the fetched docs, which are queried by `ts` only (site is filtered in the browser, so no composite index is needed)", and in "Code layout" delete `firestore.indexes.json` and its mention in `firebase.json` updates.
  - Under "Dashboard", note that "visitors" means daily-unique visitors (summed across days), since the id rotates daily.

- [ ] **Step 7: Verify, format, commit**

```bash
npm test -- --testPathPattern=config && npm run type-check
npx prettier --write lib docs/superpowers/specs
git add -A && git commit -m "feat(analytics): add firebase config scaffold, types and deps"
```

---

### Task 2: Pure analytics logic (collection side)

**Goal:** Everything the tracker needs to build and send an event, as small pure tested modules.

**Files:**

- Create: `lib/analytics/site.ts`, `ua.ts`, `storage.ts`, `visitor.ts`, `exclude.ts`, `event.ts`, `send.ts`
- Test: `lib/analytics/__tests__/site.test.ts`, `ua.test.ts`, `visitor.test.ts`, `event.test.ts`, `send.test.ts`

**Acceptance Criteria:**

- [ ] `siteForPath` maps `/` → home, `/ship-builder*` → ship-builder, anything else → null
- [ ] UA parsing identifies browser, OS, device (incl. iPadOS desktop-mode) and bots
- [ ] The visitor id is stable within a UTC day, new on the next, and survives storage failure
- [ ] `buildPageview` returns null in non-production, on localhost, for excluded browsers, bots and untracked paths
- [ ] `ref` is recorded only for the first view of a page load and never for same-host referrers
- [ ] `buildCommitBody` yields a Firestore `commit` payload with `ts` as a REQUEST_TIME transform and a create-only precondition

**Verify:** `npm test -- --testPathPattern=lib/analytics` → all PASS

**Steps:**

- [ ] **Step 1: Write the failing tests**

`lib/analytics/__tests__/site.test.ts`

```ts
import { normalizePath, siteForPath } from "../site";

describe("siteForPath", () => {
  it.each([
    ["/", "home"],
    ["/ship-builder", "ship-builder"],
    ["/ship-builder/", "ship-builder"],
    ["/ship-builder/versions", "ship-builder"],
    ["/admin", null],
    ["/nope", null],
    ["/ship-builders", null],
  ])("%s -> %s", (path, site) => {
    expect(siteForPath(path)).toBe(site);
  });
});

describe("normalizePath", () => {
  it("strips trailing slashes but keeps the root", () => {
    expect(normalizePath("/a/b/")).toBe("/a/b");
    expect(normalizePath("/")).toBe("/");
  });

  it("caps the length at 200", () => {
    expect(normalizePath("/" + "a".repeat(500))).toHaveLength(200);
  });
});
```

`lib/analytics/__tests__/ua.test.ts`

```ts
import { isBot, parseBrowser, parseDevice, parseOs, screenBucket } from "../ua";

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const EDGE = CHROME_WIN + " Edg/126.0.0.0";
const FIREFOX_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const SAFARI_IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("parseBrowser", () => {
  it.each([
    [CHROME_WIN, "Chrome"],
    [EDGE, "Edge"],
    [FIREFOX_MAC, "Firefox"],
    [SAFARI_IPHONE, "Safari"],
    [ANDROID_PHONE, "Chrome"],
    ["curl/8.0", "Other"],
  ])("%s", (ua, browser) => {
    expect(parseBrowser(ua)).toBe(browser);
  });
});

describe("parseOs", () => {
  it.each([
    [CHROME_WIN, 0, "Windows"],
    [FIREFOX_MAC, 0, "macOS"],
    [SAFARI_IPHONE, 5, "iOS"],
    [SAFARI_IPAD_DESKTOP_MODE, 5, "iOS"],
    [SAFARI_IPAD_DESKTOP_MODE, 0, "macOS"],
    [ANDROID_PHONE, 5, "Android"],
    ["Mozilla/5.0 (X11; Linux x86_64)", 0, "Linux"],
  ])("%s touch=%s", (ua, touch, os) => {
    expect(parseOs(ua, touch)).toBe(os);
  });
});

describe("parseDevice", () => {
  it.each([
    [CHROME_WIN, 0, "desktop"],
    [SAFARI_IPHONE, 5, "mobile"],
    [SAFARI_IPAD_DESKTOP_MODE, 5, "tablet"],
    [ANDROID_PHONE, 5, "mobile"],
    [ANDROID_TABLET, 5, "tablet"],
  ])("%s touch=%s", (ua, touch, device) => {
    expect(parseDevice(ua, touch)).toBe(device);
  });
});

describe("isBot", () => {
  it("flags crawlers, headless browsers, webdriver and empty UAs", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("Mozilla/5.0 HeadlessChrome/126.0.0.0")).toBe(true);
    expect(isBot(CHROME_WIN, true)).toBe(true);
    expect(isBot("")).toBe(true);
  });

  it("lets real browsers through", () => {
    expect(isBot(CHROME_WIN)).toBe(false);
    expect(isBot(SAFARI_IPHONE)).toBe(false);
  });
});

describe("screenBucket", () => {
  it.each([
    [320, "<640"],
    [639, "<640"],
    [640, "640-1023"],
    [1023, "640-1023"],
    [1024, "1024-1439"],
    [1439, "1024-1439"],
    [1440, "1440+"],
    [3840, "1440+"],
  ])("%s -> %s", (w, bucket) => {
    expect(screenBucket(w)).toBe(bucket);
  });
});
```

`lib/analytics/__tests__/visitor.test.ts`

```ts
import { getVisitorId, utcDay } from "../visitor";
import { isExcluded, setExcluded } from "../exclude";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe("getVisitorId", () => {
  const day1 = new Date("2026-10-07T01:00:00Z");
  const day1Late = new Date("2026-10-07T23:59:00Z");
  const day2 = new Date("2026-10-08T00:01:00Z");

  it("is stable within a UTC day", () => {
    const storage = fakeStorage();
    const a = getVisitorId(storage, day1);
    expect(getVisitorId(storage, day1Late)).toBe(a);
  });

  it("rotates on the next UTC day", () => {
    const storage = fakeStorage();
    const a = getVisitorId(storage, day1);
    expect(getVisitorId(storage, day2)).not.toBe(a);
  });

  it("returns a usable id when storage is missing or throws", () => {
    expect(getVisitorId(null, day1).length).toBeGreaterThanOrEqual(8);
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(getVisitorId(broken, day1).length).toBeGreaterThanOrEqual(8);
  });

  it("ignores corrupt stored values", () => {
    const storage = fakeStorage({ "analytics-vid": "{not json" });
    expect(getVisitorId(storage, day1).length).toBeGreaterThanOrEqual(8);
  });
});

describe("utcDay", () => {
  it("formats as YYYY-MM-DD in UTC", () => {
    expect(utcDay(new Date("2026-10-07T23:59:59Z"))).toBe("2026-10-07");
  });
});

describe("exclude flag", () => {
  it("round-trips", () => {
    const storage = fakeStorage();
    expect(isExcluded(storage)).toBe(false);
    setExcluded(storage);
    expect(isExcluded(storage)).toBe(true);
  });

  it("is false when storage is unavailable", () => {
    expect(isExcluded(null)).toBe(false);
  });
});
```

`lib/analytics/__tests__/event.test.ts`

```ts
import { buildPageview, type PageviewEnv } from "../event";

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function env(overrides: Partial<PageviewEnv> = {}): PageviewEnv {
  return {
    pathname: "/",
    hostname: "gentryriggen.com",
    referrer: "https://www.google.com/search?q=x",
    userAgent: CHROME_WIN,
    webdriver: false,
    maxTouchPoints: 0,
    screenWidth: 1920,
    timeZone: "America/Denver",
    isProduction: true,
    storage: null,
    firstView: true,
    now: new Date("2026-10-07T12:00:00Z"),
    ...overrides,
  };
}

describe("buildPageview", () => {
  it("builds the event", () => {
    const e = buildPageview(env());
    expect(e).toMatchObject({
      site: "home",
      path: "/",
      ref: "google.com",
      device: "desktop",
      browser: "Chrome",
      os: "Windows",
      screen: "1440+",
      tz: "America/Denver",
    });
    expect(e?.vid.length).toBeGreaterThanOrEqual(8);
  });

  it("classifies ship builder paths", () => {
    expect(
      buildPageview(env({ pathname: "/ship-builder/versions" }))?.site
    ).toBe("ship-builder");
  });

  it("returns null outside production", () => {
    expect(buildPageview(env({ isProduction: false }))).toBeNull();
  });

  it.each(["localhost", "127.0.0.1", "::1"])(
    "returns null on %s",
    (hostname) => {
      expect(buildPageview(env({ hostname }))).toBeNull();
    }
  );

  it("returns null for untracked paths, bots and excluded browsers", () => {
    expect(buildPageview(env({ pathname: "/admin" }))).toBeNull();
    expect(buildPageview(env({ webdriver: true }))).toBeNull();
    const storage = {
      getItem: (k: string) => (k === "analytics-exclude" ? "1" : null),
      setItem: () => {},
    };
    expect(buildPageview(env({ storage }))).toBeNull();
  });

  it("drops the referrer after the first view and for the same host", () => {
    expect(buildPageview(env({ firstView: false }))?.ref).toBe("");
    expect(
      buildPageview(env({ referrer: "https://gentryriggen.com/x" }))?.ref
    ).toBe("");
    expect(
      buildPageview(env({ referrer: "https://www.gentryriggen.com/" }))?.ref
    ).toBe("");
    expect(buildPageview(env({ referrer: "not a url" }))?.ref).toBe("");
  });
});
```

`lib/analytics/__tests__/send.test.ts`

```ts
import type { PageviewEvent } from "../types";
import { buildCommitBody, commitUrl, sendPageview } from "../send";

const event: PageviewEvent = {
  site: "home",
  path: "/",
  ref: "",
  device: "desktop",
  browser: "Chrome",
  os: "macOS",
  screen: "1440+",
  tz: "America/Denver",
  vid: "abcdef12-0000",
};

const config = {
  apiKey: "KEY",
  authDomain: "x.firebaseapp.com",
  projectId: "proj",
  appId: "1:2:web:3",
};

describe("buildCommitBody", () => {
  const body = buildCommitBody("proj", "doc1", event);
  const write = body.writes[0];

  it("targets a new pageviews doc", () => {
    expect(write.update.name).toBe(
      "projects/proj/databases/(default)/documents/pageviews/doc1"
    );
    expect(write.currentDocument).toEqual({ exists: false });
  });

  it("stores every field as a string value", () => {
    expect(write.update.fields.site).toEqual({ stringValue: "home" });
    expect(write.update.fields.tz).toEqual({ stringValue: "America/Denver" });
    expect(Object.keys(write.update.fields).sort()).toEqual([
      "browser",
      "device",
      "os",
      "path",
      "ref",
      "screen",
      "site",
      "tz",
      "vid",
    ]);
  });

  it("sets ts from the server request time", () => {
    expect(write.updateTransforms).toEqual([
      { fieldPath: "ts", setToServerValue: "REQUEST_TIME" },
    ]);
  });
});

describe("commitUrl", () => {
  it("uses the project and key", () => {
    expect(commitUrl(config)).toBe(
      "https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents:commit?key=KEY"
    );
  });
});

describe("sendPageview", () => {
  it("POSTs the commit body and reports success", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const ok = await sendPageview(event, { config, fetchImpl, docId: "d1" });
    expect(ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(commitUrl(config));
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body).writes[0].update.name).toMatch(
      /pageviews\/d1$/
    );
  });

  it("does nothing when the config is empty", async () => {
    const fetchImpl = jest.fn();
    const ok = await sendPageview(event, {
      config: { ...config, apiKey: "" },
      fetchImpl,
    });
    expect(ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("swallows network errors", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("offline"));
    await expect(sendPageview(event, { config, fetchImpl })).resolves.toBe(
      false
    );
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (modules not found)

Run: `npm test -- --testPathPattern=lib/analytics`

- [ ] **Step 3: Implement**

`lib/analytics/site.ts`

```ts
import type { Site } from "./types";

export function normalizePath(path: string): string {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return trimmed.slice(0, 200) || "/";
}

/** Which tracked part of the site a path belongs to, or null if untracked. */
export function siteForPath(pathname: string): Site | null {
  const path = normalizePath(pathname);
  if (path === "/") return "home";
  if (path === "/ship-builder" || path.startsWith("/ship-builder/")) {
    return "ship-builder";
  }
  return null;
}
```

`lib/analytics/ua.ts`

```ts
import type { Device, ScreenBucket } from "./types";

export function parseBrowser(ua: string): string {
  if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}

// iPadOS Safari reports a Macintosh UA; touch support tells them apart.
function isIpadOs(ua: string, maxTouchPoints: number): boolean {
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

export function parseOs(ua: string, maxTouchPoints = 0): string {
  if (/iPhone|iPad|iPod/.test(ua) || isIpadOs(ua, maxTouchPoints)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux|X11/.test(ua)) return "Linux";
  return "Other";
}

export function parseDevice(ua: string, maxTouchPoints = 0): Device {
  if (/iPad/.test(ua) || isIpadOs(ua, maxTouchPoints)) return "tablet";
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return "tablet";
  if (/iPhone|iPod|Android|Mobile/.test(ua)) return "mobile";
  return "desktop";
}

export function isBot(ua: string, webdriver = false): boolean {
  return (
    webdriver ||
    !ua ||
    /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|preview|monitor/i.test(
      ua
    )
  );
}

export function screenBucket(width: number): ScreenBucket {
  if (width < 640) return "<640";
  if (width < 1024) return "640-1023";
  if (width < 1440) return "1024-1439";
  return "1440+";
}
```

`lib/analytics/storage.ts`

```ts
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** localStorage, or null when blocked (private mode, disabled storage). */
export function safeLocalStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
```

`lib/analytics/visitor.ts`

```ts
import type { KeyValueStorage } from "./storage";

const KEY = "analytics-vid";

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Anonymous visitor id that regenerates every UTC day, so a visitor can be
 * counted once per day but never followed across days.
 */
export function getVisitorId(
  storage: KeyValueStorage | null,
  now: Date = new Date()
): string {
  const day = utcDay(now);
  try {
    const raw = storage?.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { d?: unknown; id?: unknown };
      if (
        saved.d === day &&
        typeof saved.id === "string" &&
        saved.id.length >= 8
      ) {
        return saved.id;
      }
    }
  } catch {
    // Corrupt or unreadable value: fall through and mint a new id.
  }
  const id = newId();
  try {
    storage?.setItem(KEY, JSON.stringify({ d: day, id }));
  } catch {
    // Storage blocked: the id lasts for this page load only.
  }
  return id;
}
```

`lib/analytics/exclude.ts`

```ts
import type { KeyValueStorage } from "./storage";

const KEY = "analytics-exclude";

/** Set when the owner signs in to /admin, so their own visits go uncounted. */
export function setExcluded(storage: KeyValueStorage | null): void {
  try {
    storage?.setItem(KEY, "1");
  } catch {
    // Storage blocked: nothing to do.
  }
}

export function isExcluded(storage: KeyValueStorage | null): boolean {
  try {
    return storage?.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
```

`lib/analytics/event.ts`

```ts
import { isExcluded } from "./exclude";
import { normalizePath, siteForPath } from "./site";
import type { KeyValueStorage } from "./storage";
import type { PageviewEvent } from "./types";
import { isBot, parseBrowser, parseDevice, parseOs, screenBucket } from "./ua";
import { getVisitorId } from "./visitor";

export interface PageviewEnv {
  pathname: string;
  hostname: string;
  referrer: string;
  userAgent: string;
  webdriver: boolean;
  maxTouchPoints: number;
  screenWidth: number;
  timeZone: string;
  isProduction: boolean;
  storage: KeyValueStorage | null;
  /** True only for the first view of this page load (the referrer is only meaningful then). */
  firstView: boolean;
  now?: Date;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function bareHost(host: string): string {
  return host.replace(/^www\./, "");
}

function referrerHost(referrer: string, hostname: string): string {
  if (!referrer) return "";
  try {
    const host = bareHost(new URL(referrer).hostname);
    return host === bareHost(hostname) ? "" : host.slice(0, 100);
  } catch {
    return "";
  }
}

/** The event to record for this view, or null if it should not be tracked. */
export function buildPageview(env: PageviewEnv): PageviewEvent | null {
  if (!env.isProduction) return null;
  if (LOCAL_HOSTS.has(env.hostname)) return null;
  if (isExcluded(env.storage)) return null;
  if (isBot(env.userAgent, env.webdriver)) return null;
  const site = siteForPath(env.pathname);
  if (!site) return null;

  return {
    site,
    path: normalizePath(env.pathname),
    ref: env.firstView ? referrerHost(env.referrer, env.hostname) : "",
    device: parseDevice(env.userAgent, env.maxTouchPoints),
    browser: parseBrowser(env.userAgent),
    os: parseOs(env.userAgent, env.maxTouchPoints),
    screen: screenBucket(env.screenWidth),
    tz: env.timeZone.slice(0, 64),
    vid: getVisitorId(env.storage, env.now),
  };
}
```

`lib/analytics/send.ts`

```ts
import {
  firebaseConfig,
  isFirebaseConfigured,
  type FirebaseWebConfig,
} from "@/lib/firebase/config";
import type { PageviewEvent } from "./types";

const DEFAULT_BASE_URL = "https://firestore.googleapis.com";

export function commitUrl(
  config: FirebaseWebConfig,
  baseUrl: string = DEFAULT_BASE_URL
): string {
  return `${baseUrl}/v1/projects/${config.projectId}/databases/(default)/documents:commit?key=${config.apiKey}`;
}

/**
 * A Firestore REST `commit` that creates one pageviews doc. `ts` is set by the
 * server (REQUEST_TIME), which is what firestore.rules require.
 */
export function buildCommitBody(
  projectId: string,
  docId: string,
  event: PageviewEvent
) {
  const fields: Record<string, { stringValue: string }> = {};
  for (const [key, value] of Object.entries(event)) {
    fields[key] = { stringValue: value };
  }
  return {
    writes: [
      {
        update: {
          name: `projects/${projectId}/databases/(default)/documents/pageviews/${docId}`,
          fields,
        },
        updateTransforms: [
          { fieldPath: "ts", setToServerValue: "REQUEST_TIME" },
        ],
        currentDocument: { exists: false },
      },
    ],
  };
}

function newDocId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface SendOptions {
  config?: FirebaseWebConfig;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  docId?: string;
}

/** Fire-and-forget: never throws, resolves to whether the write was accepted. */
export async function sendPageview(
  event: PageviewEvent,
  {
    config = firebaseConfig,
    baseUrl,
    fetchImpl = fetch,
    docId = newDocId(),
  }: SendOptions = {}
): Promise<boolean> {
  if (!isFirebaseConfigured(config)) return false;
  try {
    const response = await fetchImpl(commitUrl(config, baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCommitBody(config.projectId, docId, event)),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run, expect PASS; format; commit**

```bash
npm test -- --testPathPattern=lib/analytics && npm run type-check
npx prettier --write lib
git add -A && git commit -m "feat(analytics): pageview event building and Firestore REST sender"
```

---

### Task 3: Firestore security rules and emulator tests (SECURITY)

**Goal:** `firestore.rules` that let anyone create a schema-valid pageview and nobody but the admin read anything, verified against the Firestore emulator, including through the real REST path the tracker uses.

**Files:**

- Create: `firestore.rules`, `firestore-tests/rules.test.ts`, `jest.rules.config.js`
- Modify: `firebase.json`, `jest.config.js`, `package.json`, `.github/workflows/ci.yml`
- Depends on: Task 1 (deps), Task 2 (`send.ts`)

**Acceptance Criteria:**

- [ ] Anonymous create of a valid doc succeeds via the SDK and via `sendPageview` (REST)
- [ ] Extra field, missing field, bad `site`/`device`/`screen`, oversized strings, non-server `ts` and wrong types are all rejected
- [ ] Anonymous reads, other accounts, and the admin email without `email_verified` are rejected; the verified admin can read
- [ ] Update and delete are rejected for everyone, including the admin
- [ ] `npm run test:rules` runs in CI; `npm test` does not run the emulator tests

**Verify:** `npm run test:rules` → all PASS (needs Java 21+; locally `brew install openjdk`)

**Steps:**

- [ ] **Step 1: Create `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Keep in sync with ADMIN_EMAIL in lib/analytics/admin.ts.
    function isAdmin() {
      return request.auth != null
        && request.auth.token.email == "gentry.riggen@gmail.com"
        && request.auth.token.email_verified == true;
    }

    function validPageview() {
      let d = request.resource.data;
      return d.keys().hasOnly(['ts', 'site', 'path', 'ref', 'device', 'browser', 'os', 'screen', 'tz', 'vid'])
        && d.keys().hasAll(['ts', 'site', 'path', 'ref', 'device', 'browser', 'os', 'screen', 'tz', 'vid'])
        && d.ts == request.time
        && d.site in ['home', 'ship-builder']
        && d.path is string && d.path.size() > 0 && d.path.size() <= 200
        && d.ref is string && d.ref.size() <= 100
        && d.device in ['mobile', 'tablet', 'desktop']
        && d.browser is string && d.browser.size() > 0 && d.browser.size() <= 30
        && d.os is string && d.os.size() > 0 && d.os.size() <= 30
        && d.screen in ['<640', '640-1023', '1024-1439', '1440+']
        && d.tz is string && d.tz.size() <= 64
        && d.vid is string && d.vid.size() >= 8 && d.vid.size() <= 64;
    }

    match /pageviews/{id} {
      allow read: if isAdmin();
      allow create: if validPageview();
      allow update, delete: if false;
    }

    // Everything else is closed.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Wire Firebase config.** Edit `firebase.json`: add these top-level keys beside `"hosting"` (keep hosting untouched):

```json
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "firestore": { "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": false
  }
```

- [ ] **Step 3: Jest split.** In `jest.config.js` add `"<rootDir>/firestore-tests/"` to `testPathIgnorePatterns`. Create `jest.rules.config.js`:

```js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

// Run via `npm run test:rules`; needs the Firestore emulator (Java 21+).
module.exports = createJestConfig({
  testEnvironment: "node",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testMatch: ["<rootDir>/firestore-tests/**/*.test.ts"],
  testTimeout: 20000,
});
```

In `package.json` scripts add:

```json
"test:rules": "firebase emulators:exec --only firestore --project demo-gentryriggen \"jest --config jest.rules.config.js\"",
```

- [ ] **Step 4: Write the tests** `firestore-tests/rules.test.ts`

```ts
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
```

- [ ] **Step 5: Run the rules tests**

Run: `npm run test:rules`
Expected: all PASS. **If the "exact REST request" test fails** because `ts == request.time` is not satisfied by the `REQUEST_TIME` transform, stop and report: the fallback is to drop the `d.ts == request.time` clause in favour of `d.ts is timestamp` plus a server-side-only guarantee, which weakens the rules, so the owner must decide.

- [ ] **Step 6: Run the normal suite to confirm the split.** `npm test` should not execute `firestore-tests`.

- [ ] **Step 7: CI.** In `.github/workflows/ci.yml`, in the `validate` job after the "Unit tests" step add:

```yaml
- name: ☕ Setup Java (Firestore emulator)
  uses: actions/setup-java@v5
  with:
    distribution: temurin
    java-version: "21"

- name: 🔐 Firestore rules tests
  run: npm run test:rules
```

Also add `firestore.rules` and `firestore-tests` awareness only if needed: the `changes` filter does not need updating (rules tests run in `validate`, which always runs).

- [ ] **Step 8: Format and commit**

```bash
npx prettier --write firestore-tests jest.rules.config.js jest.config.js firebase.json package.json .github/workflows/ci.yml
git add -A && git commit -m "feat(analytics): firestore rules with emulator tests"
```

---

### Task 4: AnalyticsTracker and layout wiring

**Goal:** Fire one pageview per route change from the root layout.

**Files:**

- Create: `components/analytics/AnalyticsTracker.tsx`
- Modify: `app/layout.tsx`
- Test: `components/analytics/__tests__/AnalyticsTracker.test.tsx`
- Depends on: Task 2

**Acceptance Criteria:**

- [ ] A view is built and sent on mount and again on each pathname change
- [ ] Only the first view of a page load is flagged `firstView`
- [ ] When `buildPageview` returns null nothing is sent
- [ ] The tracker renders nothing

**Verify:** `npm test -- --testPathPattern=AnalyticsTracker` → PASS

**Steps:**

- [ ] **Step 1: Failing test** `components/analytics/__tests__/AnalyticsTracker.test.tsx`

```tsx
import { render } from "@testing-library/react";
import AnalyticsTracker from "../AnalyticsTracker";
import { buildPageview } from "@/lib/analytics/event";
import { sendPageview } from "@/lib/analytics/send";

let pathname = "/";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));
jest.mock("@/lib/analytics/event");
jest.mock("@/lib/analytics/send");

const mockBuild = jest.mocked(buildPageview);
const mockSend = jest.mocked(sendPageview);
const fakeEvent = { site: "home" } as ReturnType<typeof buildPageview>;

beforeEach(() => {
  jest.clearAllMocks();
  pathname = "/";
  mockBuild.mockReturnValue(fakeEvent);
  mockSend.mockResolvedValue(true);
});

it("sends a view on mount and renders nothing", () => {
  const { container } = render(<AnalyticsTracker />);
  expect(container).toBeEmptyDOMElement();
  expect(mockBuild).toHaveBeenCalledWith(
    expect.objectContaining({ pathname: "/", firstView: true })
  );
  expect(mockSend).toHaveBeenCalledWith(fakeEvent);
});

it("sends another view on navigation, no longer first", () => {
  const { rerender } = render(<AnalyticsTracker />);
  pathname = "/ship-builder";
  rerender(<AnalyticsTracker />);
  expect(mockBuild).toHaveBeenLastCalledWith(
    expect.objectContaining({ pathname: "/ship-builder", firstView: false })
  );
  expect(mockSend).toHaveBeenCalledTimes(2);
});

it("sends nothing when the view should not be tracked", () => {
  mockBuild.mockReturnValue(null);
  render(<AnalyticsTracker />);
  expect(mockSend).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `components/analytics/AnalyticsTracker.tsx`

```tsx
"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { buildPageview } from "@/lib/analytics/event";
import { sendPageview } from "@/lib/analytics/send";
import { safeLocalStorage } from "@/lib/analytics/storage";

/** Records one pageview per route change. Renders nothing. */
export default function AnalyticsTracker() {
  const pathname = usePathname();
  const firstView = useRef(true);

  useEffect(() => {
    const event = buildPageview({
      pathname,
      hostname: window.location.hostname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      webdriver: navigator.webdriver === true,
      maxTouchPoints: navigator.maxTouchPoints ?? 0,
      screenWidth: window.screen.width,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
      isProduction: process.env.NODE_ENV === "production",
      storage: safeLocalStorage(),
      firstView: firstView.current,
    });
    firstView.current = false;
    if (event) void sendPageview(event);
  }, [pathname]);

  return null;
}
```

- [ ] **Step 4: Wire into `app/layout.tsx`.** Add `import AnalyticsTracker from "@/components/analytics/AnalyticsTracker";` and change the body to:

```tsx
<body className="antialiased">
  <AnalyticsTracker />
  <ThemeProvider>{children}</ThemeProvider>
</body>
```

- [ ] **Step 5: Verify, format, commit**

```bash
npm test -- --testPathPattern="AnalyticsTracker|app/__tests__" && npm run type-check
npx prettier --write components app
git add -A && git commit -m "feat(analytics): track pageviews from the root layout"
```

---

### Task 5: Aggregation

**Goal:** Pure function turning raw pageview docs into everything the dashboard shows.

**Files:**

- Create: `lib/analytics/aggregate.ts`
- Test: `lib/analytics/__tests__/aggregate.test.ts`
- Depends on: Task 1 (types), Task 2 (`utcDay`)

**Acceptance Criteria:**

- [ ] Totals count views and daily-unique visitors (same `vid` on two UTC days counts twice, within a day once)
- [ ] The `site` filter works, `"all"` includes both sites
- [ ] `previous` covers the equally long window before the current one
- [ ] `series` has exactly `days` points, oldest first, zero-filled
- [ ] Breakdowns are sorted by views desc then key, capped at 8, with empty referrer shown as `(direct)`
- [ ] `places` groups by timezone
- [ ] `pctChange` is null when the previous value is 0

**Verify:** `npm test -- --testPathPattern=aggregate` → PASS

**Steps:**

- [ ] **Step 1: Failing test** `lib/analytics/__tests__/aggregate.test.ts`

```ts
import { pctChange, summarize } from "../aggregate";
import type { PageviewDoc } from "../types";

const NOW = new Date("2026-10-07T12:00:00Z");

function view(ts: string, overrides: Partial<PageviewDoc> = {}): PageviewDoc {
  return {
    ts: new Date(ts),
    site: "home",
    path: "/",
    ref: "",
    device: "desktop",
    browser: "Chrome",
    os: "macOS",
    screen: "1440+",
    tz: "America/Denver",
    vid: "visitor-a",
    ...overrides,
  };
}

describe("summarize totals", () => {
  it("counts views and daily-unique visitors", () => {
    const docs = [
      view("2026-10-07T01:00:00Z", { vid: "a" }),
      view("2026-10-07T02:00:00Z", { vid: "a" }),
      view("2026-10-07T03:00:00Z", { vid: "b" }),
      view("2026-10-06T03:00:00Z", { vid: "a" }),
    ];
    const s = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(s.totals).toEqual({ views: 4, visitors: 3 });
  });

  it("filters by site", () => {
    const docs = [
      view("2026-10-07T01:00:00Z", { site: "home" }),
      view("2026-10-07T01:00:00Z", { site: "ship-builder", vid: "b" }),
    ];
    expect(
      summarize(docs, { site: "home", days: 7, now: NOW }).totals.views
    ).toBe(1);
    expect(
      summarize(docs, { site: "ship-builder", days: 7, now: NOW }).totals.views
    ).toBe(1);
    expect(
      summarize(docs, { site: "all", days: 7, now: NOW }).totals.views
    ).toBe(2);
  });

  it("splits the current and previous windows", () => {
    const docs = [
      view("2026-10-07T01:00:00Z"), // current (window 10-01..10-07)
      view("2026-10-01T00:00:00Z"), // current, first instant
      view("2026-09-30T23:59:59Z"), // previous
      view("2026-09-24T00:00:00Z"), // previous, first instant
      view("2026-09-23T23:59:59Z"), // outside both
      view("2026-10-08T00:00:00Z"), // future, outside
    ];
    const s = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(s.totals.views).toBe(2);
    expect(s.previous.views).toBe(2);
  });
});

describe("summarize series", () => {
  it("has one zero-filled point per day, oldest first", () => {
    const docs = [view("2026-10-07T01:00:00Z"), view("2026-10-05T01:00:00Z")];
    const { series } = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(series.map((p) => p.date)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
    ]);
    expect(series.map((p) => p.views)).toEqual([0, 0, 0, 0, 1, 0, 1]);
  });
});

describe("summarize breakdowns", () => {
  it("sorts by views then key and labels empty referrers", () => {
    const docs = [
      view("2026-10-07T01:00:00Z", { ref: "" }),
      view("2026-10-07T01:00:00Z", { ref: "" }),
      view("2026-10-07T01:00:00Z", { ref: "b.com" }),
      view("2026-10-07T01:00:00Z", { ref: "a.com" }),
    ];
    const { breakdowns } = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(breakdowns.referrers).toEqual([
      { key: "(direct)", views: 2 },
      { key: "a.com", views: 1 },
      { key: "b.com", views: 1 },
    ]);
  });

  it("caps each list at 8 entries", () => {
    const docs = Array.from({ length: 12 }, (_, i) =>
      view("2026-10-07T01:00:00Z", { path: `/p${i}` })
    );
    const { breakdowns } = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(breakdowns.paths).toHaveLength(8);
  });

  it("covers devices, browsers, systems and screens", () => {
    const docs = [
      view("2026-10-07T01:00:00Z", { device: "mobile", os: "iOS" }),
    ];
    const { breakdowns } = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(breakdowns.devices).toEqual([{ key: "mobile", views: 1 }]);
    expect(breakdowns.systems).toEqual([{ key: "iOS", views: 1 }]);
    expect(breakdowns.browsers).toEqual([{ key: "Chrome", views: 1 }]);
    expect(breakdowns.screens).toEqual([{ key: "1440+", views: 1 }]);
  });
});

describe("summarize places", () => {
  it("groups by timezone with views and daily visitors", () => {
    const docs = [
      view("2026-10-07T01:00:00Z", { tz: "Europe/Paris", vid: "a" }),
      view("2026-10-07T02:00:00Z", { tz: "Europe/Paris", vid: "a" }),
      view("2026-10-07T03:00:00Z", { tz: "Asia/Tokyo", vid: "b" }),
    ];
    const { places } = summarize(docs, { site: "all", days: 7, now: NOW });
    expect(places).toEqual([
      { tz: "Europe/Paris", views: 2, visitors: 1 },
      { tz: "Asia/Tokyo", views: 1, visitors: 1 },
    ]);
  });
});

describe("pctChange", () => {
  it("is null when there is no previous value", () => {
    expect(pctChange(5, 0)).toBeNull();
  });

  it("rounds the percentage change", () => {
    expect(pctChange(15, 10)).toBe(50);
    expect(pctChange(5, 10)).toBe(-50);
    expect(pctChange(10, 10)).toBe(0);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `lib/analytics/aggregate.ts`

```ts
import type { PageviewDoc, Site } from "./types";
import { utcDay } from "./visitor";

const DAY_MS = 86_400_000;
const TOP_N = 8;

export interface Totals {
  views: number;
  visitors: number;
}
export interface DayPoint extends Totals {
  date: string;
}
export interface Count {
  key: string;
  views: number;
}
export interface Place extends Totals {
  tz: string;
}
export type BreakdownKey =
  "paths" | "referrers" | "devices" | "browsers" | "systems" | "screens";

export interface Summary {
  totals: Totals;
  previous: Totals;
  series: DayPoint[];
  breakdowns: Record<BreakdownKey, Count[]>;
  places: Place[];
}

export interface SummarizeOptions {
  site: Site | "all";
  days: number;
  now: Date;
}

/**
 * Visitors are daily-unique: the visitor id rotates every UTC day, so one
 * person on two days counts twice. Keys are therefore (day, id) pairs.
 */
function totalsOf(docs: PageviewDoc[]): Totals {
  const visitors = new Set(docs.map((d) => `${utcDay(d.ts)}|${d.vid}`));
  return { views: docs.length, visitors: visitors.size };
}

function top(docs: PageviewDoc[], pick: (d: PageviewDoc) => string): Count[] {
  const counts = new Map<string, number>();
  for (const d of docs) {
    const key = pick(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, views]) => ({ key, views }))
    .sort((a, b) => b.views - a.views || a.key.localeCompare(b.key))
    .slice(0, TOP_N);
}

/** Aggregates raw docs over `days` UTC days ending today, plus the prior window. */
export function summarize(
  docs: PageviewDoc[],
  { site, days, now }: SummarizeOptions
): Summary {
  const end = now.getTime() - (now.getTime() % DAY_MS) + DAY_MS;
  const start = end - days * DAY_MS;
  const previousStart = start - days * DAY_MS;

  const scoped = site === "all" ? docs : docs.filter((d) => d.site === site);
  const inRange = (d: PageviewDoc, from: number, to: number) => {
    const t = d.ts.getTime();
    return t >= from && t < to;
  };
  const current = scoped.filter((d) => inRange(d, start, end));
  const previous = scoped.filter((d) => inRange(d, previousStart, start));

  const byDay = new Map<string, PageviewDoc[]>();
  for (const d of current) {
    const key = utcDay(d.ts);
    const list = byDay.get(key);
    if (list) list.push(d);
    else byDay.set(key, [d]);
  }
  const series = Array.from({ length: days }, (_, i) => {
    const date = utcDay(new Date(start + i * DAY_MS));
    return { date, ...totalsOf(byDay.get(date) ?? []) };
  });

  const byTz = new Map<string, PageviewDoc[]>();
  for (const d of current) {
    const list = byTz.get(d.tz);
    if (list) list.push(d);
    else byTz.set(d.tz, [d]);
  }
  const places = [...byTz]
    .map(([tz, list]) => ({ tz, ...totalsOf(list) }))
    .sort((a, b) => b.views - a.views || a.tz.localeCompare(b.tz));

  return {
    totals: totalsOf(current),
    previous: totalsOf(previous),
    series,
    breakdowns: {
      paths: top(current, (d) => d.path),
      referrers: top(current, (d) => d.ref || "(direct)"),
      devices: top(current, (d) => d.device),
      browsers: top(current, (d) => d.browser),
      systems: top(current, (d) => d.os),
      screens: top(current, (d) => d.screen),
    },
    places,
  };
}

/** Percentage change vs the previous period, or null when there is no baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
```

- [ ] **Step 4: Verify, format, commit**

```bash
npm test -- --testPathPattern=aggregate && npm run type-check
npx prettier --write lib
git add -A && git commit -m "feat(analytics): aggregate pageviews into dashboard summaries"
```

---

### Task 6: Geo (timezone to map coordinates)

**Goal:** Resolve a timezone string to coordinates, project to SVG space, and turn the world-atlas land outline into an SVG path.

**Files:**

- Create: `lib/analytics/geo.ts`
- Test: `lib/analytics/__tests__/geo.test.ts`
- Depends on: Task 1 (deps)

**Acceptance Criteria:**

- [ ] `locate("America/Denver")` returns a city and lat/lng; aliases resolve; unknown or empty strings return null
- [ ] `project` maps lat/lng to the 1000x500 equirectangular space
- [ ] `geometryPath` turns Polygon and MultiPolygon coordinates into a compact SVG path
- [ ] `landPath` converts a TopoJSON topology to a path string

**Verify:** `npm test -- --testPathPattern=geo` → PASS

**Steps:**

- [ ] **Step 1: Failing test** `lib/analytics/__tests__/geo.test.ts`

```ts
import type { Topology } from "topojson-specification";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  geometryPath,
  landPath,
  locate,
  project,
} from "../geo";

describe("locate", () => {
  it("finds a known zone", () => {
    expect(locate("America/Denver")).toMatchObject({ city: "Denver" });
  });

  it("resolves aliases to the canonical zone", () => {
    expect(locate("Asia/Calcutta")).toEqual(locate("Asia/Kolkata"));
    expect(locate("Europe/Kiev")).toEqual(locate("Europe/Kyiv"));
  });

  it("returns null for unknown or empty zones", () => {
    expect(locate("Mars/Olympus_Mons")).toBeNull();
    expect(locate("")).toBeNull();
    expect(locate("UTC")).toBeNull();
  });
});

describe("project", () => {
  it("maps the corners and centre of the world", () => {
    expect(project(0, 0)).toEqual([MAP_WIDTH / 2, MAP_HEIGHT / 2]);
    expect(project(90, -180)).toEqual([0, 0]);
    expect(project(-90, 180)).toEqual([MAP_WIDTH, MAP_HEIGHT]);
  });
});

describe("geometryPath", () => {
  it("draws a polygon ring as a closed path", () => {
    const path = geometryPath(
      {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 10],
          ],
        ],
      },
      360,
      180
    );
    expect(path).toBe("M180 90L190 90L190 80Z");
  });

  it("draws every polygon of a multipolygon", () => {
    const path = geometryPath(
      {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [10, 0],
              [10, 10],
            ],
          ],
          [
            [
              [20, 0],
              [30, 0],
              [30, 10],
            ],
          ],
        ],
      },
      360,
      180
    );
    expect(path.match(/M/g)).toHaveLength(2);
  });

  it("ignores other geometry", () => {
    expect(geometryPath(null, 360, 180)).toBe("");
    expect(geometryPath({ type: "Point", coordinates: [0, 0] }, 360, 180)).toBe(
      ""
    );
  });
});

describe("landPath", () => {
  it("converts a topology's land object to a path", () => {
    const topology = {
      type: "Topology",
      arcs: [
        [
          [0, 0],
          [10, 0],
          [0, 10],
          [-10, 0],
          [0, -10],
        ],
      ],
      objects: {
        land: {
          type: "GeometryCollection",
          geometries: [{ type: "Polygon", arcs: [[0]] }],
        },
      },
    } as unknown as Topology;
    const path = landPath(topology);
    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `lib/analytics/geo.ts`

```ts
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 500;

export interface Spot {
  city: string;
  lat: number;
  lng: number;
}

// [IANA zone, principal city, lat, lng]. Region-level on purpose: the browser
// timezone is all we know about where a visitor is.
const ZONES: [string, string, number, number][] = [
  ["America/New_York", "New York", 40.71, -74.01],
  ["America/Chicago", "Chicago", 41.88, -87.63],
  ["America/Denver", "Denver", 39.74, -104.99],
  ["America/Phoenix", "Phoenix", 33.45, -112.07],
  ["America/Los_Angeles", "Los Angeles", 34.05, -118.24],
  ["America/Anchorage", "Anchorage", 61.22, -149.9],
  ["Pacific/Honolulu", "Honolulu", 21.31, -157.86],
  ["America/Detroit", "Detroit", 42.33, -83.05],
  ["America/Indiana/Indianapolis", "Indianapolis", 39.77, -86.16],
  ["America/Boise", "Boise", 43.62, -116.2],
  ["America/Toronto", "Toronto", 43.65, -79.38],
  ["America/Vancouver", "Vancouver", 49.28, -123.12],
  ["America/Edmonton", "Edmonton", 53.55, -113.49],
  ["America/Winnipeg", "Winnipeg", 49.9, -97.14],
  ["America/Regina", "Regina", 50.45, -104.62],
  ["America/Halifax", "Halifax", 44.65, -63.57],
  ["America/St_Johns", "St. John's", 47.56, -52.71],
  ["America/Mexico_City", "Mexico City", 19.43, -99.13],
  ["America/Monterrey", "Monterrey", 25.69, -100.32],
  ["America/Tijuana", "Tijuana", 32.51, -117.04],
  ["America/Cancun", "Cancún", 21.16, -86.85],
  ["America/Guatemala", "Guatemala City", 14.63, -90.51],
  ["America/Costa_Rica", "San José", 9.93, -84.08],
  ["America/Panama", "Panama City", 8.98, -79.52],
  ["America/Havana", "Havana", 23.11, -82.37],
  ["America/Jamaica", "Kingston", 18.0, -76.79],
  ["America/Puerto_Rico", "San Juan", 18.47, -66.11],
  ["America/Bogota", "Bogotá", 4.71, -74.07],
  ["America/Lima", "Lima", -12.05, -77.04],
  ["America/Caracas", "Caracas", 10.48, -66.9],
  ["America/Guayaquil", "Guayaquil", -2.17, -79.92],
  ["America/La_Paz", "La Paz", -16.5, -68.15],
  ["America/Asuncion", "Asunción", -25.26, -57.58],
  ["America/Santiago", "Santiago", -33.45, -70.67],
  ["America/Argentina/Buenos_Aires", "Buenos Aires", -34.6, -58.38],
  ["America/Montevideo", "Montevideo", -34.9, -56.16],
  ["America/Sao_Paulo", "São Paulo", -23.55, -46.63],
  ["Atlantic/Reykjavik", "Reykjavík", 64.15, -21.94],
  ["Atlantic/Azores", "Azores", 37.74, -25.67],
  ["Europe/London", "London", 51.51, -0.13],
  ["Europe/Dublin", "Dublin", 53.35, -6.26],
  ["Europe/Lisbon", "Lisbon", 38.72, -9.14],
  ["Europe/Madrid", "Madrid", 40.42, -3.7],
  ["Europe/Paris", "Paris", 48.86, 2.35],
  ["Europe/Brussels", "Brussels", 50.85, 4.35],
  ["Europe/Amsterdam", "Amsterdam", 52.37, 4.9],
  ["Europe/Berlin", "Berlin", 52.52, 13.41],
  ["Europe/Zurich", "Zurich", 47.38, 8.54],
  ["Europe/Vienna", "Vienna", 48.21, 16.37],
  ["Europe/Rome", "Rome", 41.9, 12.5],
  ["Europe/Prague", "Prague", 50.08, 14.44],
  ["Europe/Warsaw", "Warsaw", 52.23, 21.01],
  ["Europe/Budapest", "Budapest", 47.5, 19.04],
  ["Europe/Stockholm", "Stockholm", 59.33, 18.07],
  ["Europe/Oslo", "Oslo", 59.91, 10.75],
  ["Europe/Copenhagen", "Copenhagen", 55.68, 12.57],
  ["Europe/Helsinki", "Helsinki", 60.17, 24.94],
  ["Europe/Athens", "Athens", 37.98, 23.73],
  ["Europe/Bucharest", "Bucharest", 44.43, 26.1],
  ["Europe/Sofia", "Sofia", 42.7, 23.32],
  ["Europe/Belgrade", "Belgrade", 44.79, 20.45],
  ["Europe/Zagreb", "Zagreb", 45.81, 15.98],
  ["Europe/Vilnius", "Vilnius", 54.69, 25.28],
  ["Europe/Riga", "Riga", 56.95, 24.11],
  ["Europe/Tallinn", "Tallinn", 59.44, 24.75],
  ["Europe/Kyiv", "Kyiv", 50.45, 30.52],
  ["Europe/Istanbul", "Istanbul", 41.01, 28.98],
  ["Europe/Moscow", "Moscow", 55.76, 37.62],
  ["Africa/Casablanca", "Casablanca", 33.57, -7.59],
  ["Africa/Algiers", "Algiers", 36.75, 3.06],
  ["Africa/Tunis", "Tunis", 36.81, 10.18],
  ["Africa/Cairo", "Cairo", 30.04, 31.24],
  ["Africa/Lagos", "Lagos", 6.52, 3.38],
  ["Africa/Accra", "Accra", 5.6, -0.19],
  ["Africa/Addis_Ababa", "Addis Ababa", 9.03, 38.74],
  ["Africa/Khartoum", "Khartoum", 15.5, 32.56],
  ["Africa/Nairobi", "Nairobi", -1.29, 36.82],
  ["Africa/Kinshasa", "Kinshasa", -4.44, 15.27],
  ["Africa/Harare", "Harare", -17.83, 31.05],
  ["Africa/Johannesburg", "Johannesburg", -26.2, 28.05],
  ["Asia/Jerusalem", "Jerusalem", 31.77, 35.22],
  ["Asia/Beirut", "Beirut", 33.89, 35.5],
  ["Asia/Amman", "Amman", 31.95, 35.93],
  ["Asia/Baghdad", "Baghdad", 33.31, 44.36],
  ["Asia/Riyadh", "Riyadh", 24.71, 46.68],
  ["Asia/Kuwait", "Kuwait City", 29.38, 47.99],
  ["Asia/Qatar", "Doha", 25.29, 51.53],
  ["Asia/Dubai", "Dubai", 25.2, 55.27],
  ["Asia/Tehran", "Tehran", 35.69, 51.39],
  ["Asia/Baku", "Baku", 40.41, 49.87],
  ["Asia/Tbilisi", "Tbilisi", 41.72, 44.79],
  ["Asia/Yerevan", "Yerevan", 40.18, 44.51],
  ["Asia/Kabul", "Kabul", 34.53, 69.17],
  ["Asia/Karachi", "Karachi", 24.86, 67.01],
  ["Asia/Tashkent", "Tashkent", 41.3, 69.24],
  ["Asia/Almaty", "Almaty", 43.24, 76.89],
  ["Asia/Kolkata", "Kolkata", 22.57, 88.36],
  ["Asia/Kathmandu", "Kathmandu", 27.72, 85.32],
  ["Asia/Dhaka", "Dhaka", 23.81, 90.41],
  ["Asia/Colombo", "Colombo", 6.93, 79.86],
  ["Asia/Yangon", "Yangon", 16.84, 96.17],
  ["Asia/Bangkok", "Bangkok", 13.76, 100.5],
  ["Asia/Ho_Chi_Minh", "Ho Chi Minh City", 10.82, 106.63],
  ["Asia/Jakarta", "Jakarta", -6.21, 106.85],
  ["Asia/Kuala_Lumpur", "Kuala Lumpur", 3.14, 101.69],
  ["Asia/Singapore", "Singapore", 1.35, 103.82],
  ["Asia/Manila", "Manila", 14.6, 120.98],
  ["Asia/Hong_Kong", "Hong Kong", 22.32, 114.17],
  ["Asia/Shanghai", "Shanghai", 31.23, 121.47],
  ["Asia/Taipei", "Taipei", 25.03, 121.57],
  ["Asia/Seoul", "Seoul", 37.57, 126.98],
  ["Asia/Tokyo", "Tokyo", 35.68, 139.69],
  ["Asia/Ulaanbaatar", "Ulaanbaatar", 47.89, 106.91],
  ["Asia/Yekaterinburg", "Yekaterinburg", 56.84, 60.61],
  ["Asia/Novosibirsk", "Novosibirsk", 55.01, 82.93],
  ["Asia/Vladivostok", "Vladivostok", 43.12, 131.89],
  ["Australia/Perth", "Perth", -31.95, 115.86],
  ["Australia/Darwin", "Darwin", -12.46, 130.84],
  ["Australia/Adelaide", "Adelaide", -34.93, 138.6],
  ["Australia/Brisbane", "Brisbane", -27.47, 153.03],
  ["Australia/Sydney", "Sydney", -33.87, 151.21],
  ["Australia/Melbourne", "Melbourne", -37.81, 144.96],
  ["Australia/Hobart", "Hobart", -42.88, 147.33],
  ["Pacific/Auckland", "Auckland", -36.85, 174.76],
  ["Pacific/Fiji", "Suva", -18.14, 178.44],
  ["Pacific/Guam", "Guam", 13.44, 144.79],
  ["Pacific/Port_Moresby", "Port Moresby", -9.44, 147.18],
];

const ALIASES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Dacca": "Asia/Dhaka",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Montreal": "America/Toronto",
  "Australia/Canberra": "Australia/Sydney",
};

const SPOTS = new Map<string, Spot>(
  ZONES.map(([tz, city, lat, lng]) => [tz, { city, lat, lng }])
);

/** Where an IANA timezone sits on the map, or null if we don't know it. */
export function locate(tz: string): Spot | null {
  return SPOTS.get(ALIASES[tz] ?? tz) ?? null;
}

/** Equirectangular projection into the 1000x500 SVG space. */
export function project(
  lat: number,
  lng: number,
  width: number = MAP_WIDTH,
  height: number = MAP_HEIGHT
): [number, number] {
  return [((lng + 180) / 360) * width, ((90 - lat) / 180) * height];
}

const round = (n: number) => Number(n.toFixed(1));

function ringsToPath(rings: number[][][], width: number, height: number) {
  return rings
    .map((ring) => {
      const points = ring.map(([lng, lat]) => {
        const [x, y] = project(lat, lng, width, height);
        return `${round(x)} ${round(y)}`;
      });
      return `M${points.join("L")}Z`;
    })
    .join("");
}

/** SVG path for a GeoJSON Polygon or MultiPolygon; empty for anything else. */
export function geometryPath(
  geometry: { type: string; coordinates?: unknown } | null,
  width: number = MAP_WIDTH,
  height: number = MAP_HEIGHT
): string {
  if (!geometry) return "";
  if (geometry.type === "Polygon") {
    return ringsToPath(geometry.coordinates as number[][][], width, height);
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as number[][][][])
      .map((polygon) => ringsToPath(polygon, width, height))
      .join("");
  }
  return "";
}

/** SVG path of the `land` object of a world-atlas topology. */
export function landPath(topology: Topology): string {
  const land = feature(topology, topology.objects.land);
  const features = land.type === "FeatureCollection" ? land.features : [land];
  return features.map((f) => geometryPath(f.geometry)).join("");
}
```

- [ ] **Step 4: Verify, format, commit.** If `feature(...)` typing complains about `topology.objects.land`, cast it to the `GeometryCollection | GeometryObject` type from `topojson-specification` rather than using `any`.

```bash
npm test -- --testPathPattern=geo && npm run type-check
npx prettier --write lib
git add -A && git commit -m "feat(analytics): timezone to map coordinates and land outline"
```

---

### Task 7: Admin auth gate and page (SECURITY)

**Goal:** `/admin` route that shows only a sign-in screen until a verified `gentry.riggen@gmail.com` Google account is signed in, plus the lazy Firebase client it needs.

**Files:**

- Create: `lib/analytics/admin.ts`, `lib/firebase/client.ts`, `components/admin/AdminGate.tsx`, `app/admin/page.tsx`
- Modify: `app/robots.ts`
- Test: `lib/analytics/__tests__/admin.test.ts`, `components/admin/__tests__/AdminGate.test.tsx`, `app/__tests__/robots.test.ts`, `e2e/admin.spec.ts`
- Depends on: Task 2 (`exclude`, `storage`). `components/admin/Dashboard.tsx` (Task 8) is imported by the gate: create a one-line placeholder `export default function Dashboard() { return null; }` here so this task type-checks, and Task 8 replaces it.

**Acceptance Criteria:**

- [ ] Unconfigured Firebase shows a "not configured" message and never touches the SDK
- [ ] Signed out shows a "Sign in with Google" button and no dashboard
- [ ] A signed-in non-admin (or unverified admin email) sees "Not authorized", is signed out immediately, and the dashboard never renders
- [ ] A verified admin sees the dashboard and the exclude-own-traffic flag is set in localStorage
- [ ] `/admin` is `noindex` and disallowed in `robots.txt`, absent from the sitemap

**Verify:** `npm test -- --testPathPattern="admin|robots" && npm run type-check` → PASS

**Steps:**

- [ ] **Step 1: Failing tests**

`lib/analytics/__tests__/admin.test.ts`

```ts
import { ADMIN_EMAIL, isAdminUser } from "../admin";

describe("isAdminUser", () => {
  it("accepts only the verified admin email", () => {
    expect(isAdminUser({ email: ADMIN_EMAIL, emailVerified: true })).toBe(true);
    expect(isAdminUser({ email: ADMIN_EMAIL, emailVerified: false })).toBe(
      false
    );
    expect(isAdminUser({ email: "other@gmail.com", emailVerified: true })).toBe(
      false
    );
    expect(isAdminUser({ email: null, emailVerified: true })).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });

  it("is case-insensitive on the email", () => {
    expect(
      isAdminUser({ email: "Gentry.Riggen@Gmail.com", emailVerified: true })
    ).toBe(true);
  });
});
```

`app/__tests__/robots.test.ts`

```ts
import robots from "../robots";
import sitemap from "../sitemap";

describe("robots", () => {
  it("disallows /admin", () => {
    const rules = robots().rules;
    const first = Array.isArray(rules) ? rules[0] : rules;
    expect(first.disallow).toContain("/admin");
  });

  it("keeps /admin out of the sitemap", () => {
    expect(sitemap().some((entry) => entry.url.includes("/admin"))).toBe(false);
  });
});
```

`components/admin/__tests__/AdminGate.test.tsx`

```tsx
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminGate from "../AdminGate";
import * as client from "@/lib/firebase/client";
import * as config from "@/lib/firebase/config";

jest.mock("@/lib/firebase/client");
jest.mock("@/lib/firebase/config");
jest.mock("../Dashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard" />,
}));

const mockClient = jest.mocked(client);
const mockConfig = jest.mocked(config);

let emit: (user: client.AuthUser | null) => void;

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockConfig.isFirebaseConfigured.mockReturnValue(true);
  mockClient.signOutUser.mockResolvedValue();
  mockClient.signInWithGoogle.mockResolvedValue();
  mockClient.watchAuth.mockImplementation(async (cb) => {
    emit = cb;
    return () => {};
  });
});

async function renderGate() {
  render(<AdminGate />);
  await waitFor(() => expect(mockClient.watchAuth).toHaveBeenCalled());
}

it("explains when Firebase is not configured and never loads the SDK", () => {
  mockConfig.isFirebaseConfigured.mockReturnValue(false);
  render(<AdminGate />);
  expect(screen.getByText(/not configured/i)).toBeInTheDocument();
  expect(mockClient.watchAuth).not.toHaveBeenCalled();
});

it("shows only the sign-in button when signed out", async () => {
  await renderGate();
  act(() => emit(null));
  expect(
    await screen.findByRole("button", { name: /sign in with google/i })
  ).toBeInTheDocument();
  expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
});

it("starts the Google sign-in when the button is clicked", async () => {
  await renderGate();
  act(() => emit(null));
  await userEvent.click(
    await screen.findByRole("button", { name: /sign in with google/i })
  );
  expect(mockClient.signInWithGoogle).toHaveBeenCalled();
});

it("rejects another account and signs it out", async () => {
  await renderGate();
  act(() => emit({ email: "someone@gmail.com", emailVerified: true }));
  expect(await screen.findByText(/not authorized/i)).toBeInTheDocument();
  expect(mockClient.signOutUser).toHaveBeenCalled();
  expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  // The sign-out echo must not wipe the explanation.
  act(() => emit(null));
  expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
});

it("rejects the admin email when it is unverified", async () => {
  await renderGate();
  act(() => emit({ email: "gentry.riggen@gmail.com", emailVerified: false }));
  expect(await screen.findByText(/not authorized/i)).toBeInTheDocument();
  expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
});

it("shows the dashboard for the admin and excludes their own traffic", async () => {
  await renderGate();
  act(() => emit({ email: "gentry.riggen@gmail.com", emailVerified: true }));
  expect(await screen.findByTestId("dashboard")).toBeInTheDocument();
  expect(window.localStorage.getItem("analytics-exclude")).toBe("1");
});
```

`e2e/admin.spec.ts`

```ts
import { test, expect } from "@playwright/test";

test.describe("Admin", () => {
  test("signed out visitors see no dashboard", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveCount(0);
  });

  test("is not indexable", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/
    );
  });
});
```

- [ ] **Step 2: Run unit tests, expect FAIL.**

- [ ] **Step 3: Implement**

`lib/analytics/admin.ts`

```ts
import type { AuthUser } from "@/lib/firebase/client";

/** Keep in sync with isAdmin() in firestore.rules (the real enforcement). */
export const ADMIN_EMAIL = "gentry.riggen@gmail.com";

export function isAdminUser(user: AuthUser | null): boolean {
  return (
    user !== null &&
    user.emailVerified &&
    user.email?.toLowerCase() === ADMIN_EMAIL
  );
}
```

`lib/firebase/client.ts`

```ts
import type { FirebaseApp } from "firebase/app";
import type { PageviewDoc } from "@/lib/analytics/types";
import { firebaseConfig } from "./config";

/** Only used by /admin; public pages talk to Firestore over REST instead. */

export interface AuthUser {
  email: string | null;
  emailVerified: boolean;
}

export const MAX_DOCS = 20_000;

let appPromise: Promise<FirebaseApp> | null = null;

function getApp(): Promise<FirebaseApp> {
  appPromise ??= import("firebase/app").then(
    ({ getApps, initializeApp }) =>
      getApps()[0] ?? initializeApp(firebaseConfig)
  );
  return appPromise;
}

async function authModule() {
  const [app, mod] = await Promise.all([getApp(), import("firebase/auth")]);
  return { mod, auth: mod.getAuth(app) };
}

/** Subscribes to auth changes; resolves to the unsubscribe function. */
export async function watchAuth(
  onChange: (user: AuthUser | null) => void
): Promise<() => void> {
  const { mod, auth } = await authModule();
  return mod.onAuthStateChanged(auth, (user) =>
    onChange(
      user ? { email: user.email, emailVerified: user.emailVerified } : null
    )
  );
}

export async function signInWithGoogle(): Promise<void> {
  const { mod, auth } = await authModule();
  const provider = new mod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await mod.signInWithPopup(auth, provider);
}

export async function signOutUser(): Promise<void> {
  const { mod, auth } = await authModule();
  await mod.signOut(auth);
}

export interface PageviewsResult {
  docs: PageviewDoc[];
  /** True when the fetch hit MAX_DOCS, so the oldest views are missing. */
  truncated: boolean;
}

export async function fetchPageviews(
  sinceMs: number,
  max: number = MAX_DOCS
): Promise<PageviewsResult> {
  const [app, fs] = await Promise.all([getApp(), import("firebase/firestore")]);
  const db = fs.getFirestore(app);
  const snapshot = await fs.getDocs(
    fs.query(
      fs.collection(db, "pageviews"),
      fs.where("ts", ">=", fs.Timestamp.fromMillis(sinceMs)),
      fs.orderBy("ts", "desc"),
      fs.limit(max)
    )
  );
  const docs = snapshot.docs.map((d) => {
    const data = d.data();
    return {
      site: data.site,
      path: data.path,
      ref: data.ref,
      device: data.device,
      browser: data.browser,
      os: data.os,
      screen: data.screen,
      tz: data.tz,
      vid: data.vid,
      ts: data.ts.toDate(),
    } as PageviewDoc;
  });
  return { docs, truncated: snapshot.size >= max };
}
```

`components/admin/AdminGate.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import Dashboard from "@/components/admin/Dashboard";
import { isAdminUser } from "@/lib/analytics/admin";
import { setExcluded } from "@/lib/analytics/exclude";
import { safeLocalStorage } from "@/lib/analytics/storage";
import {
  signInWithGoogle,
  signOutUser,
  watchAuth,
} from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";

type State =
  | { kind: "loading" }
  | { kind: "unconfigured" }
  | { kind: "signedOut" }
  | { kind: "denied"; email: string }
  | { kind: "admin"; email: string };

export default function AdminGate() {
  const [state, setState] = useState<State>(() =>
    isFirebaseConfigured() ? { kind: "loading" } : { kind: "unconfigured" }
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void watchAuth((user) => {
      if (cancelled) return;
      if (!user) {
        // Keep the "Not authorized" message when our own sign-out echoes back.
        setState((prev) =>
          prev.kind === "denied" ? prev : { kind: "signedOut" }
        );
      } else if (isAdminUser(user)) {
        setExcluded(safeLocalStorage());
        setState({ kind: "admin", email: user.email ?? "" });
      } else {
        setState({ kind: "denied", email: user.email ?? "unknown account" });
        void signOutUser();
      }
    }).then((stop) => {
      if (cancelled) stop();
      else unsubscribe = stop;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  function signIn() {
    setError(null);
    setState((prev) => (prev.kind === "denied" ? { kind: "signedOut" } : prev));
    signInWithGoogle().catch(() =>
      setError("Sign-in failed or was cancelled. Try again.")
    );
  }

  if (state.kind === "admin") {
    return (
      <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-xl font-semibold">Admin</h1>
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <span className="hidden sm:inline">{state.email}</span>
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>
        </header>
        <Dashboard />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Admin</h1>
        {state.kind === "loading" && (
          <p className="text-gray-600 dark:text-gray-400">Checking sign-in…</p>
        )}
        {state.kind === "unconfigured" && (
          <p className="text-gray-600 dark:text-gray-400">
            Firebase is not configured for this build.
          </p>
        )}
        {state.kind === "denied" && (
          <p role="alert" className="text-red-600 dark:text-red-400">
            Not authorized: {state.email} is not an admin account.
          </p>
        )}
        {(state.kind === "signedOut" || state.kind === "denied") && (
          <button
            type="button"
            onClick={signIn}
            className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            Sign in with Google
          </button>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
```

`components/admin/Dashboard.tsx` (placeholder, replaced in Task 8)

```tsx
export default function Dashboard() {
  return null;
}
```

`app/admin/page.tsx`

```tsx
import type { Metadata } from "next";
import AdminGate from "@/components/admin/AdminGate";

export const metadata: Metadata = {
  title: "Admin | Gentry Riggen",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminGate />;
}
```

`app/robots.ts` rules become:

```ts
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    },
```

- [ ] **Step 4: Run unit tests, expect PASS; run the e2e spec**

```bash
npm test -- --testPathPattern="admin|robots" && npm run type-check
npx playwright test e2e/admin.spec.ts --project=chromium
```

Note: in Next 16 the page's `robots` metadata renders `<meta name="robots" content="noindex, nofollow">`; if the e2e assertion on it fails, inspect the rendered head before changing the test.

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write lib components app e2e
git add -A && git commit -m "feat(admin): google sign-in gate restricted to the admin email"
```

---

### Task 8: Dashboard

**Goal:** The tabbed dashboard: Overview, Home, Ship Builder, with range picker, totals, time series, breakdowns and the visitor map.

**Files:**

- Create: `components/admin/StatTile.tsx`, `TimeSeriesChart.tsx`, `BreakdownList.tsx`, `VisitorMap.tsx`, `SummaryView.tsx`
- Modify (replace placeholder): `components/admin/Dashboard.tsx`
- Test: `components/admin/__tests__/Dashboard.test.tsx`
- Depends on: Tasks 5, 6, 7

**Acceptance Criteria:**

- [ ] Tabs "Overview", "Home (/)" and "Ship Builder" switch the scope; range picker offers 7/30/90 days and refetches
- [ ] Each tab shows views, daily visitors with change vs previous period, a per-day chart, breakdowns (paths, referrers, devices, browsers, systems, screens) and the map
- [ ] Overview additionally shows a card per site
- [ ] Loading, error, empty-range and truncated-data states are visible
- [ ] Works in light and dark mode and at phone width

**Verify:** `npm test -- --testPathPattern=Dashboard && npm run type-check && npm run lint` → PASS

**Steps:**

- [ ] **Step 1: Failing test** `components/admin/__tests__/Dashboard.test.tsx`

```tsx
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../Dashboard";
import * as client from "@/lib/firebase/client";
import type { PageviewDoc } from "@/lib/analytics/types";

jest.mock("@/lib/firebase/client");
jest.mock("../VisitorMap", () => ({
  __esModule: true,
  default: () => <div data-testid="map" />,
}));

const mockClient = jest.mocked(client);

function view(overrides: Partial<PageviewDoc>): PageviewDoc {
  return {
    ts: new Date(),
    site: "home",
    path: "/",
    ref: "",
    device: "desktop",
    browser: "Chrome",
    os: "macOS",
    screen: "1440+",
    tz: "America/Denver",
    vid: "a",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.fetchPageviews.mockResolvedValue({
    docs: [
      view({ vid: "a" }),
      view({ vid: "b", path: "/ship-builder", site: "ship-builder" }),
      view({ vid: "c", path: "/ship-builder/versions", site: "ship-builder" }),
    ],
    truncated: false,
  });
});

it("loads data and shows the overview totals", async () => {
  render(<Dashboard />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
  const views = await screen.findByTestId("stat-views");
  expect(within(views).getByText("3")).toBeInTheDocument();
  expect(screen.getByTestId("map")).toBeInTheDocument();
});

it("switches scope with the tabs", async () => {
  render(<Dashboard />);
  await screen.findByTestId("stat-views");
  await userEvent.click(screen.getByRole("tab", { name: "Ship Builder" }));
  expect(
    within(screen.getByTestId("stat-views")).getByText("2")
  ).toBeInTheDocument();
  expect(screen.getByText("/ship-builder/versions")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "Home (/)" }));
  expect(
    within(screen.getByTestId("stat-views")).getByText("1")
  ).toBeInTheDocument();
});

it("refetches when the range changes", async () => {
  render(<Dashboard />);
  await screen.findByTestId("stat-views");
  expect(mockClient.fetchPageviews).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "30 days" }));
  await waitFor(() =>
    expect(mockClient.fetchPageviews).toHaveBeenCalledTimes(2)
  );
});

it("shows an error when loading fails", async () => {
  mockClient.fetchPageviews.mockRejectedValue(new Error("permission-denied"));
  render(<Dashboard />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t load/i);
});

it("warns when the data was truncated", async () => {
  mockClient.fetchPageviews.mockResolvedValue({ docs: [], truncated: true });
  render(<Dashboard />);
  expect(
    await screen.findByText(/older views are missing/i)
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run, expect FAIL** (placeholder renders null).

- [ ] **Step 3: Implement the leaf components**

`components/admin/StatTile.tsx`

```tsx
import { pctChange } from "@/lib/analytics/aggregate";

interface StatTileProps {
  label: string;
  value: number;
  previous: number;
  testId?: string;
}

export default function StatTile({
  label,
  value,
  previous,
  testId,
}: StatTileProps) {
  const change = pctChange(value, previous);
  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
    >
      <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </div>
      <div
        className={
          change === null
            ? "mt-1 text-sm text-gray-500 dark:text-gray-500"
            : change >= 0
              ? "mt-1 text-sm text-green-600 dark:text-green-400"
              : "mt-1 text-sm text-red-600 dark:text-red-400"
        }
      >
        {change === null
          ? "no prior data"
          : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% vs previous period`}
      </div>
    </div>
  );
}
```

`components/admin/TimeSeriesChart.tsx`

```tsx
import type { DayPoint } from "@/lib/analytics/aggregate";

const W = 600;
const H = 160;
const PAD = 4;

export default function TimeSeriesChart({ series }: { series: DayPoint[] }) {
  const max = Math.max(1, ...series.map((p) => p.views));
  const step = W / Math.max(1, series.length);
  const barWidth = Math.max(1, step - 2);
  const y = (value: number) => H - PAD - (value / max) * (H - 2 * PAD);
  const line = series
    .map(
      (p, i) =>
        `${(i * step + step / 2).toFixed(1)},${y(p.visitors).toFixed(1)}`
    )
    .join(" ");

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Views and visitors per day"
        className="h-40 w-full"
      >
        {series.map((p, i) => (
          <rect
            key={p.date}
            x={i * step + 1}
            y={y(p.views)}
            width={barWidth}
            height={H - PAD - y(p.views)}
            className="fill-blue-500/70 dark:fill-blue-400/70"
          >
            <title>{`${p.date}: ${p.views} views, ${p.visitors} visitors`}</title>
          </rect>
        ))}
        <polyline
          points={line}
          fill="none"
          strokeWidth={2}
          className="stroke-emerald-500 dark:stroke-emerald-400"
        />
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-blue-500 dark:bg-blue-400" />
          Views
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-emerald-500 dark:bg-emerald-400" />
          Daily visitors
        </span>
        <span className="ml-auto">UTC days</span>
      </figcaption>
    </figure>
  );
}
```

`components/admin/BreakdownList.tsx`

```tsx
import type { Count } from "@/lib/analytics/aggregate";

interface BreakdownListProps {
  title: string;
  rows: Count[];
}

export default function BreakdownList({ title, rows }: BreakdownListProps) {
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="mb-3 text-sm font-medium text-gray-600 dark:text-gray-400">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No data</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate">{row.key}</span>
                <span className="tabular-nums text-gray-600 dark:text-gray-400">
                  {row.views.toLocaleString()}
                </span>
              </div>
              <progress
                className="mt-1 block h-1 w-full overflow-hidden rounded [&::-moz-progress-bar]:bg-blue-500 [&::-webkit-progress-bar]:bg-gray-100 dark:[&::-webkit-progress-bar]:bg-gray-800 [&::-webkit-progress-value]:bg-blue-500 dark:[&::-webkit-progress-value]:bg-blue-400"
                value={row.views}
                max={max}
                aria-label={`${row.key}: ${row.views} views`}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

`components/admin/VisitorMap.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import type { Topology } from "topojson-specification";
import type { Place } from "@/lib/analytics/aggregate";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  landPath,
  locate,
  project,
} from "@/lib/analytics/geo";

export default function VisitorMap({ places }: { places: Place[] }) {
  const [land, setLand] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("world-atlas/land-110m.json").then((module) => {
      if (!cancelled) setLand(landPath(module.default as unknown as Topology));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dots = places.flatMap((place) => {
    const spot = locate(place.tz);
    return spot ? [{ place, spot }] : [];
  });
  const unplaced = places
    .filter((place) => !locate(place.tz))
    .reduce((sum, place) => sum + place.visitors, 0);
  const max = Math.max(1, ...dots.map((d) => d.place.visitors));

  return (
    <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <h3 className="mb-3 text-sm font-medium text-gray-600 dark:text-gray-400">
        Where visitors are (by browser timezone)
      </h3>
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="img"
        aria-label="World map of visitors by timezone region"
        className="w-full rounded bg-gray-50 dark:bg-gray-900"
      >
        {land && <path d={land} className="fill-gray-300 dark:fill-gray-700" />}
        {dots.map(({ place, spot }) => {
          const [x, y] = project(spot.lat, spot.lng);
          const radius = 4 + 12 * Math.sqrt(place.visitors / max);
          return (
            <circle
              key={place.tz}
              cx={x}
              cy={y}
              r={radius}
              className="fill-blue-500/60 stroke-blue-600 dark:fill-blue-400/60 dark:stroke-blue-300"
            >
              <title>{`${spot.city}: ${place.visitors} visitors, ${place.views} views`}</title>
            </circle>
          );
        })}
      </svg>
      {unplaced > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {unplaced.toLocaleString()} visitor-days from timezones not on the
          map.
        </p>
      )}
    </section>
  );
}
```

`components/admin/SummaryView.tsx`

```tsx
import type { Summary } from "@/lib/analytics/aggregate";
import BreakdownList from "./BreakdownList";
import StatTile from "./StatTile";
import TimeSeriesChart from "./TimeSeriesChart";
import VisitorMap from "./VisitorMap";

export default function SummaryView({ summary }: { summary: Summary }) {
  const { totals, previous, series, breakdowns, places } = summary;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Views"
          value={totals.views}
          previous={previous.views}
          testId="stat-views"
        />
        <StatTile
          label="Daily visitors"
          value={totals.visitors}
          previous={previous.visitors}
          testId="stat-visitors"
        />
      </div>
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <TimeSeriesChart series={series} />
      </div>
      <VisitorMap places={places} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BreakdownList title="Top pages" rows={breakdowns.paths} />
        <BreakdownList title="Referrers" rows={breakdowns.referrers} />
        <BreakdownList title="Devices" rows={breakdowns.devices} />
        <BreakdownList title="Browsers" rows={breakdowns.browsers} />
        <BreakdownList title="Operating systems" rows={breakdowns.systems} />
        <BreakdownList title="Screen widths" rows={breakdowns.screens} />
      </div>
    </div>
  );
}
```

`components/admin/Dashboard.tsx` (replace the placeholder)

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { summarize } from "@/lib/analytics/aggregate";
import type { PageviewDoc, Site } from "@/lib/analytics/types";
import { fetchPageviews } from "@/lib/firebase/client";
import SummaryView from "./SummaryView";

type Tab = "overview" | Site;
type Range = 7 | 30 | 90;

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "home", label: "Home (/)" },
  { id: "ship-builder", label: "Ship Builder" },
];
const RANGES: Range[] = [7, 30, 90];
const DAY_MS = 86_400_000;

interface Loaded {
  days: Range;
  docs: PageviewDoc[];
  truncated: boolean;
  error: boolean;
  /** When the data was fetched; the summary windows end on this day. */
  at: Date;
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [days, setDays] = useState<Range>(7);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Two windows (current + previous) plus a day of slack for UTC rounding.
    const since = Date.now() - (2 * days + 1) * DAY_MS;
    fetchPageviews(since)
      .then((result) => {
        if (!cancelled) {
          setLoaded({ days, ...result, error: false, at: new Date() });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded({
            days,
            docs: [],
            truncated: false,
            error: true,
            at: new Date(),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  // Data for a different range is stale: treat it as still loading.
  const current = loaded !== null && loaded.days === days ? loaded : null;
  const summaries = useMemo(() => {
    if (!current || current.error) return null;
    const options = { days: current.days, now: current.at };
    return {
      all: summarize(current.docs, { site: "all", ...options }),
      home: summarize(current.docs, { site: "home", ...options }),
      "ship-builder": summarize(current.docs, {
        site: "ship-builder",
        ...options,
      }),
    };
  }, [current]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Site" className="flex gap-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? "rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white dark:bg-blue-500"
                  : "rounded-md px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={days === range}
              onClick={() => setDays(range)}
              className={
                days === range
                  ? "rounded-md border border-blue-600 px-3 py-1.5 text-sm text-blue-700 dark:border-blue-400 dark:text-blue-300"
                  : "rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              }
            >
              {range} days
            </button>
          ))}
        </div>
      </div>

      {!current && <p className="text-gray-600 dark:text-gray-400">Loading…</p>}
      {current?.error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          Couldn&apos;t load analytics. Check that you are signed in as the
          admin and that Firestore is set up.
        </p>
      )}
      {current?.truncated && (
        <p className="text-amber-700 dark:text-amber-400">
          Showing the newest views only; older views are missing for this range.
        </p>
      )}
      {summaries && tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["home", "ship-builder"] as const).map((site) => (
              <section
                key={site}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
              >
                <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {site === "home" ? "Home (/)" : "Ship Builder"}
                </h2>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {summaries[site].totals.views.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-gray-600 dark:text-gray-400">
                    views · {summaries[site].totals.visitors.toLocaleString()}{" "}
                    visitors
                  </span>
                </p>
              </section>
            ))}
          </div>
          <SummaryView summary={summaries.all} />
        </div>
      )}
      {summaries && tab !== "overview" && (
        <SummaryView summary={summaries[tab]} />
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run tests, type-check and lint.** Fix lint findings properly (e.g. if `react-hooks` flags the `useMemo` for `now`, derive `now` inside the `summaries` memo from a timestamp stored in `Loaded` instead).

```bash
npm test -- --testPathPattern="Dashboard|AdminGate" && npm run type-check && npm run lint
```

- [ ] **Step 5: Look at it.** Run `npm run dev`, open `/admin`; with a mocked or real signed-in session confirm layout at 375px and 1280px in light and dark. (Real data needs Task 9. A quick visual check can use the Dashboard test fixtures via a temporary story-less page; do not commit that.)

- [ ] **Step 6: Format and commit**

```bash
npx prettier --write components
git add -A && git commit -m "feat(admin): analytics dashboard with per-site tabs and visitor map"
```

---

### Task 9: Go live: config, rules deploy in CI, docs, full verification

**Goal:** Real Firebase config in place, CI deploys rules with the site, docs updated, everything verified end to end.

**Files:**

- Modify: `lib/firebase/config.ts`, `.github/workflows/ci.yml`, `CLAUDE.md`
- Depends on: Tasks 0 to 8

**Acceptance Criteria:**

- [ ] `firebaseConfig` holds the real values from Task 0
- [ ] The deploy job deploys `firestore.rules` after hosting
- [ ] `npm run validate` and `npm run test:rules` pass; relevant Playwright specs pass
- [ ] After deploy: a visit to `/` and `/ship-builder` creates `pageviews` docs; `/admin` signs in as the admin and shows them; a second Google account is refused

**Verify:** see steps

**Steps:**

- [ ] **Step 1: Fill the config.** Paste the Task 0 values into `lib/firebase/config.ts` (`apiKey`, `authDomain`, `projectId`, `appId`, plus `storageBucket`/`messagingSenderId` if provided). Update `lib/firebase/__tests__/config.test.ts` only if its assumptions changed (it passes explicit configs, so it should not).

- [ ] **Step 2: Deploy rules from CI.** In `.github/workflows/ci.yml`, in the `deploy` job after the "Deploy to Firebase" step add:

```yaml
- name: 🔐 Deploy Firestore rules
  env:
    FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
    FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
  run: |
    printf '%s' "$FIREBASE_SERVICE_ACCOUNT" > "$RUNNER_TEMP/sa.json"
    GOOGLE_APPLICATION_CREDENTIALS="$RUNNER_TEMP/sa.json" \
      npx --yes firebase-tools@15 deploy --only firestore:rules --project "$FIREBASE_PROJECT_ID"
    rm -f "$RUNNER_TEMP/sa.json"
```

- [ ] **Step 3: Document it.** Add to `CLAUDE.md` under Architecture a short "Analytics" subsection: tracker sends views to the Firestore REST API (no SDK on public pages); `firestore.rules` is the security boundary and is tested with `npm run test:rules` (needs Java 21+); `/admin` is Google sign-in restricted to the admin email, with the Firebase SDK loaded only there; `lib/firebase/config.ts` is public config; tracking is skipped on localhost, in dev and in browsers that have signed in to `/admin`.

- [ ] **Step 4: Full verification (once)**

```bash
npm run validate
npm run test:rules
npx playwright test e2e/home.spec.ts e2e/admin.spec.ts --project=chromium
```

Expected: all green. (`validate` includes the production build; confirm `out/admin.html` exists.)

- [ ] **Step 5: Format and commit**

```bash
npx prettier --write lib CLAUDE.md .github
git add -A && git commit -m "feat(analytics): go live config, rules deploy in CI, docs"
```

- [ ] **Step 6: Push and verify in production (owner + implementer).** After CI deploys:
  1. Open `https://gentryriggen.com/` and `/ship-builder` in a private window (not signed in to `/admin`).
  2. Firebase console → Firestore → `pageviews`: confirm two docs with the expected `site`, `tz` and a `ts`.
  3. Open `/admin`, sign in with `gentry.riggen@gmail.com`: dashboard shows the views and a dot for your timezone. Then browse the site in that same browser and confirm no new docs appear (own-traffic exclusion).
  4. Sign in with a different Google account: "Not authorized", and the account is signed out.
  5. From an unauthenticated shell, confirm reads are refused:
     `curl -s "https://firestore.googleapis.com/v1/projects/gentryriggen/databases/(default)/documents/pageviews?key=<API_KEY>"` → a `PERMISSION_DENIED` error.
