# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build (static export)
npm run lint             # ESLint
npm run format           # Prettier (write)
npm run format:check     # Prettier (check)
npm run type-check       # TypeScript --noEmit
npm test                 # Jest unit tests
npm test -- --testPathPatterns=ComponentName  # Run single test file
npm run test:watch       # Jest watch mode
npm run test:e2e         # Playwright E2E tests (auto-starts dev server)
npm run test:e2e:ui      # Playwright UI mode
npm run test:all         # Unit + E2E tests
npm run validate         # Full CI check (lint + format + types + tests + build)
```

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4

**Static export site** (`output: "export"` in next.config.ts). No API routes, no SSR, no middleware, no `next/headers`. All data must be available at build time. Images use `unoptimized: true`.

**Deployment:** Firebase Hosting (static files). CI/CD via GitHub Actions.

### Structure

- `app/` — Single-page app. Root layout handles fonts, metadata, ThemeProvider, and a hydration-prevention inline script for theme.
- `components/` — All components. The current design lives in `components/designs/design1/`.
- `components/designs/design1/` — Interactive terminal UI: `Terminal.tsx` orchestrates a boot sequence of typing animations, then hands off to `InteractivePrompt.tsx` for command input. Commands are resolved via `commandResponses.tsx` (centralized command→response map supporting JSX, `shouldClear`, `shouldConfetti` flags).
- `components/ThemeProvider.tsx` — React Context for dark/light mode. Class-based dark mode (`.dark` on `<html>`). Persists to localStorage.
- `e2e/` — Playwright tests.

### Analytics

- `components/analytics/AnalyticsTracker.tsx` (in the root layout) records one pageview per route change by POSTing to the Firestore REST API (`lib/analytics/send.ts`). Public pages ship no Firebase SDK. Tracking is skipped on localhost, in dev builds, for bots, and in browsers that have signed in to `/admin`.
- `firestore.rules` is the security boundary: anyone may create a schema-valid `pageviews` doc, only the admin (Firebase UID `ADMIN_UID` in `lib/analytics/admin.ts`, email/password sign-in) may read. Test rules with `npm run test:rules` (Firestore emulator, needs Java 21+). CI deploys them after hosting.
- Gameplay analytics: games call `trackGame(name, props)` (`lib/analytics/trackGame.ts`), the one helper, which POSTs anonymous events to the `gameEvents` collection. The schema (event names, enum/number-only props, sample rates) lives in `lib/analytics/gameEvents.ts`; `firestore.rules` mirrors it, and `firestore-tests/gameEvents.test.ts` feeds every event and enum value through the rules. Players are children: never add user ids, session ids, free text or device data to an event. Sampled, capped at 50 per page load, skipped in dev/e2e/bots/admin. Every string prop is a closed enum (template ids too: `TEMPLATE_IDS`, checked against the registry and the rules by `lib/analytics/__tests__/gameRulesSync.test.ts`); doc ids must be UUIDv4; `createdAt` is only the UTC day's midnight (no finer time) and `day` must be the server's UTC day; the dashboard queries by `day` (last 30 days by default). Adding an event or enum value means editing the schema, the rules and the dashboard together.
  - App Check rollout (rules cannot rate-limit): (1) the web app is registered with reCAPTCHA Enterprise and Firestore is on Monitor (done); (2) ship `lib/firebase/appCheck.ts`, which lazily loads the reCAPTCHA script only when a write is about to happen (never in dev/e2e, localhost, for bots or the owner) and sends `X-Firebase-AppCheck` on every Firestore REST call, failing open to no header; (3) watch the App Check verified-request ratio in the Firebase console for a few days; (4) switch Firestore to Enforce (leaderboard reads and writes also load reCAPTCHA for any real browser, owner and bots included, so they pass Enforce; analytics skips excluded browsers entirely); (5) consider Auth later (the identitytoolkit anonymous-auth calls in `lib/leaderboard/auth.ts` carry no token yet). /admin initialises App Check in the SDK path (`lib/firebase/client.ts`, production only). CI deploys `firestore.indexes.json` after the rules (its own step; the service account needs Cloud Datastore Index Admin), which exempts the `gameEvents` fields `props`, `site` and `name` from indexing.
- `/admin` (`components/admin/`) is client-rendered email/password sign-in plus a dashboard (a Games tab shows gameplay events). The Firebase SDK (`lib/firebase/client.ts`) loads only there. Everything shown from stored docs (paths, referrers) is attacker-controlled: render as text only.
- `lib/firebase/config.ts` holds the public Firebase web config. While `apiKey` is empty the tracker and admin do nothing.

### Key Patterns

- **Server components by default.** Only add `"use client"` when the component uses hooks, event handlers, or browser APIs.
- **`export default function` for components** (not arrow functions).
- **`interface` for props** (not `type`).
- **Path alias:** `@/` maps to project root (e.g., `@/components/...`).
- **Tailwind only** for styling — no inline styles, no CSS modules. Every element must support both light and dark mode.
- **Mobile-first responsive:** base → `sm:` → `md:` → `lg:`.
- **Custom animations** defined as `@keyframes` in `app/globals.css`.

### Testing

- **Unit tests:** Jest + React Testing Library. Tests live alongside code in `__tests__/` directories. Components needing ThemeProvider use a `renderWithTheme()` helper. Next Image is mocked in tests.
- **E2E tests:** Playwright in `e2e/`. Chromium runs every test; WebKit and the iPad project run only tests tagged `{ tag: "@smoke" }` (touch, pointer and layout checks), and CI skips Firefox. `E2E_FULL=1` runs everything on every project. CI skips e2e when a change touches nothing the browser tests cover (see the `changes` job in `.github/workflows/ci.yml`). To skip them on purpose, put `[skip e2e]` in a commit message or the PR title (a squash merge carries the title to `main`, so the deploy skips them too). Unit tests, rules tests and the build still run. A push to `main` whose git tree already passed a pull request run (a squash merge of an up-to-date branch) skips the checks and e2e too, and only builds and deploys.
- **Performance budget:** `e2e/perf.spec.ts` renders fixed Ship Builder and Plane Builder scenes and fails if draw calls or triangles (shadow passes included, read from `window.__shipBuilderRenderInfo` / `__planeBuilderRenderInfo`) go more than 5% over `e2e/perf-budget.json`. Frame times are only reported; the table and `perf-results.json` show them (CI shards the perf spec, so the artifacts are `perf-results-1-of-2` and `perf-results-2-of-2`, half the scenes each).
- **Changing the budget:** after an intended change, run `PERF_UPDATE=1 npx playwright test e2e/perf.spec.ts --project=chromium` and commit the rewritten `e2e/perf-budget.json`; lower it when an optimisation lands.

### Formatting

Prettier: double quotes, semicolons, trailing commas (es5), 80 char width, 2-space indent.

### Ship Builder releases

Every Ship Builder change that ships to users (anything in `components/ship-builder`, `lib/ship-builder`, `app/ship-builder`, `public/ship-builder/models` or `public/ship-builder-sw.js`) is a release:

1. Bump `SHIP_BUILDER_VERSION` in `lib/ship-builder/version.ts` (semver: patch for fixes, minor for features, major for big new modes).
2. Add a matching entry at the top of `CHANGELOG` in `lib/ship-builder/changelog.ts`, written from the commits since the last release (`git log <last version commit>..HEAD -- lib/ship-builder components/ship-builder app/ship-builder public/ship-builder/models`), in plain words a young builder or their parent would follow.

The Versions page (`/ship-builder/versions`, linked from the version label) renders the changelog. `lib/ship-builder/__tests__/changelog.test.ts` fails if the version and the top entry disagree.

### Plane Builder releases

Every Plane Builder change that ships to users (anything in `components/plane-builder`, `lib/plane-builder` or `app/plane-builder`) is a release:

1. Bump `PLANE_BUILDER_VERSION` in `lib/plane-builder/version.ts` (semver: patch for fixes, minor for features, major for big new modes).
2. Add a matching entry at the top of `CHANGELOG` in `lib/plane-builder/changelog.ts`, written from the commits since the last release (`git log <last version commit>..HEAD -- lib/plane-builder components/plane-builder app/plane-builder`), in plain words a young pilot or their parent would follow.

The Versions page (`/plane-builder/versions`) renders the changelog. `lib/plane-builder/__tests__/changelog.test.ts` fails if the version and the top entry disagree. 1.0.0 is the first release: until it ships, keep editing the 1.0.0 entry instead of bumping.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
