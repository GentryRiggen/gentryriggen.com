---
name: new-game
description: Use when starting a new game (or a new home-screen app) on this site. Scaffolds it on the game kit (lib/game-kit, components/game-kit, components/game-audio) so it gets iOS home-screen metadata, safe areas, touch handling, resilient audio, updates, compat lint, saves, analytics, release plumbing and e2e right from the first commit.
---

# New game

A new game **must** be built on the game kit. Read `docs/games/foundation.md`
first: it is the checklist (with the why) this skill scaffolds. Use
`<slug>` for the URL slug (`flamelings`), `<Name>` for the title.

Work in a worktree off `origin/main`, one conventional commit per step.

## Scaffold, in this order

1. **Route** `app/<slug>/page.tsx`: `export const { metadata, viewport } =
gameMetadata({ slug, title, description, themeColor, statusBar: "black",
iconVersion: 1 })` from `@/lib/game-kit/metadata`; render one client
   component. `statusBar: "black"` unless nothing is pinned to the top.
   `app/<slug>/versions/page.tsx` renders the changelog.
2. **Theme colour**: add the game to `lib/theme/themeScript.ts` (constant,
   `is<Name>Path`, `fixedThemeColor`, the inline script) and its test.
3. **Home-screen files**: `public/<slug>.webmanifest` (scope and start_url
   `/<slug>`, standalone) and `scripts/<slug>-icons.mjs` that renders
   `public/<slug>-icons/` with the versioned names from `gameIconPaths()`
   (`apple-touch-icon-v1.png`, `icon-192-v1.png`, `icon-512-v1.png`,
   `icon-512-maskable-v1.png`). Add a test like
   `lib/game-kit/__tests__/flamelingsHomeScreen.test.ts`.
4. **Shell**: root component wrapped in `<GameShell>`. Every overlay, top bar
   and bottom bar pads with `SAFE_INSETS` / `SAFE_TOP` / `SAFE_BOTTOM` /
   `SAFE_SIDES` (`@/lib/game-kit/safeArea`). Add `components/<slug>` to
   `GAME_DIRS` in `lib/game-kit/__tests__/safeAreaGuard.test.ts`.
5. **Model** in `lib/<slug>/`: pure and tested; an injectable clock if time
   matters; a versioned, validated, salvaging save (copy
   `lib/flamelings/save.ts`) and, if it must not be overwritten, the tab lock
   (`lib/flamelings/tabLock.ts`).
6. **Hooks**: `useVisibilityPause` (pause loops, persist on hidden and
   pagehide), `usePrefersReducedMotion` or CSS reduced motion, `hasOwn` / `at`
   from `lib/game-kit/compat.ts` (ESLint fails on the originals).
7. **Sound** (if any): `useResilientAudio()` and voices from
   `components/game-audio/primitives.ts`; a sound toggle with
   `createChannelSettings`. No `<audio>` elements.
8. **Updates**: `app/<slug>/version.json/route.ts` (`export const dynamic =
"force-static"; export const GET = versionRoute(VERSION)`), then
   `useGameUpdate("<slug>", { saveNow })` and `<UpdatePill>` in the root.
   8b. **Offline play** (only if the game needs it): add the game to
   `GENERATED_GAME_WORKERS` in `lib/game-kit/serviceWorker/generate.ts`, run
   `npx tsx scripts/generate-game-sw.ts`, call `useGameServiceWorker("<slug>")`
   and pass `serviceWorker: true` to `useGameUpdate`; add
   `e2e/<slug>-offline.spec.ts` (copy `e2e/flamelings-offline.spec.ts`). Never
   hand-write a worker.
9. **`firebase.json` headers**: `no-cache` for `/<slug>`, `/<slug>.html`,
   `/<slug>/versions(.html)`, `/<slug>.webmanifest`, `/<slug>/version.json`,
   `/<slug>-icons/**` (and `/<slug>-sw.js` with offline play), after the generic year-long image rule. Add a test in
   `app/__tests__/jimHosting.test.ts` like the Flamelings ones.
10. **Release plumbing**: `lib/<slug>/version.ts` (`1.0.0`), `changelog.ts`, a
    changelog test, a "`<Name>` releases" section in `CLAUDE.md`, a "What's
    new" link in the game.
11. **Site links**: `app/sitemap.ts` (and its test), a home-page line in
    `components/designs/design1/Hobbies.tsx`, a terminal command in
    `commandResponses.tsx` with tests.
12. **Analytics**: a `site` in `lib/analytics/{types,site}.ts`, events in
    `lib/analytics/gameEvents.ts`, mirrored in `firestore.rules`,
    `firestore-tests`, the admin Games tab; a `lib/<slug>/analytics.ts`
    wrapper. Never a name or typed text. Run `npm run test:rules`.
13. **Test hooks**: `createTestHooks("__<slug>", {...})`.
14. **e2e**: `e2e/<slug>.spec.ts` (core loop on chromium, one `@smoke` layout
    test), added to a group in `.github/workflows/ci.yml` and to the `ipad`
    project's `testMatch` in `playwright.config.ts`.

## Before the first PR

Run the `game-release-review` skill against the whole game, then
`npm run lint && npm run format:check && npm run type-check && npm test`,
`npx next build --webpack` and the game's e2e. Screenshot iPad portrait
(744x1133) and landscape (1133x744).
