# Game foundation

What every game on this site must get right, learned the hard way by Ship
Builder, Plane Builder, Planet Smasher, Ever Onward and Flamelings. The code is
in `lib/game-kit/`, `components/game-kit/` and `components/game-audio/`. **New
games start from the game kit** (see `.claude/skills/new-game`), and every game
change is reviewed against this list (`.claude/skills/game-release-review`).

Our players are children on iPads and phones, often on older iPads, often as a
home-screen app. When in doubt, test on that.

Commit references are `git show <sha>`.

## iOS home-screen app

- [ ] **Page metadata from `gameMetadata()`** (`lib/game-kit/metadata.ts`): its
      own manifest (only this route links it), `appleWebApp` capable, the legacy
      `apple-mobile-web-app-capable` tag (older iOS only reads that), a versioned
      apple icon, `viewportFit: "cover"`, no zoom.
- [ ] **Status bar: `"black"` (opaque) unless nothing is pinned to the top.**
      `"black-translucent"` runs the page under the bar and iOS blurs the top of
      it, which smeared Ever Onward's pinned HUD (59beb3fc, 9d18bc5f).
- [ ] **A fixed `theme-color` for the game**, in `lib/theme/themeScript.ts`
      (`fixedThemeColor` and the inline script). iOS tints the top of the app with
      the root layout's light/dark colour otherwise: a pale haze over a dark game
      (0034ee4c).
- [ ] **Versioned icon names** (`apple-touch-icon-v1.png`; bump `iconVersion`
      with the file). iOS and Safari keep an icon by URL (59b9b2f0). A page cannot
      override a layout-level `<link rel="apple-touch-icon">`, so none lives there.
- [ ] **Manifest** `public/<slug>.webmanifest` with `scope`/`start_url`
      `/<slug>`, standalone, 192, 512 and a maskable 512 icon, rendered by a
      script (`scripts/<slug>-icons.mjs`).
- [ ] No service worker unless the game needs offline play. Without one, updates
      come from version polling (below).
- [ ] **A game that plays offline uses the kit's worker, never a hand-written
      one.** Add the game to `GENERATED_GAME_WORKERS`
      (`lib/game-kit/serviceWorker/generate.ts`: slug, title, non-hashed asset
      folders and files such as `/<slug>-icons/` and `/<slug>.webmanifest`), run
      `npx tsx scripts/generate-game-sw.ts` to write `public/<slug>-sw.js` from
      `lib/game-kit/serviceWorker/template.sw.txt` (edit the template, never the
      output; a drift test fails if they differ), call `useGameServiceWorker(slug)`
      in the root and pass `serviceWorker: true` to `useGameUpdate` so "update
      ready" still works. Policy: navigations network-first with a 3 s timeout then
      cache; `/_next/static/` cache-first; only ok, same-origin, non-redirected
      responses cached; `version.json` never cached; old caches pruned;
      `CACHE_URLS` and `SKIP_WAITING` messages. The hook registers in production
      only and skips the e2e build unless the page has `?offline`.
- [ ] Offline e2e like `e2e/flamelings-offline.spec.ts`: load online, go offline,
      reload, play, and check the save persists. Network-only features show a
      calm offline state and recover on retry.
- [ ] `firebase.json` also needs `no-cache` for `/<slug>-sw.js`.

## Safe areas (notch, home bar)

- [ ] Every `fixed inset-0` overlay and every bar pinned to the top or bottom
      pads with `SAFE_INSETS` / `SAFE_TOP` / `SAFE_BOTTOM` / `SAFE_SIDES`
      (`lib/game-kit/safeArea.ts`). The page runs edge to edge, so otherwise the
      buttons sit under the clock (the Ever Onward intro films did).
- [ ] Add the game's folder to `GAME_DIRS` in
      `lib/game-kit/__tests__/safeAreaGuard.test.ts`: the test fails on any
      unpadded overlay. Mark a layer that holds nothing touchable with a
      `safe-area-ok: why` comment.
- [ ] Check landscape too: the notch moves to the side.

## Touch and iOS quirks

- [ ] **`<GameShell>`** (`components/game-kit/GameShell.tsx`) as the root: `100dvh`
      (no Safari-toolbar gap), `overscroll-none`, `touch-manipulation` (no double-tap
      zoom, no 300 ms delay), `select-none`, `[-webkit-touch-callout:none]` (the
      long-press callout and selection cancelled a hold, 6bba51d1), no tap highlight.
- [ ] **Pinch zoom is blocked in script**, not only in the viewport: iOS ignores
      `user-scalable=no`. GameShell does it (`useBlockPinchZoom`); pass `allowZoom`
      for a viewer that needs it.
- [ ] Targets at least 64 px for a young child (44 px minimum anywhere). Icon-first.
- [ ] No horizontal page scroll at 744 px (iPad mini portrait), 1133 px (landscape)
      and 390 px (phone). Test all three.
- [ ] Never rely on hover. Never rely on a drag that an iOS edge gesture steals.

## Audio

- [ ] **Use `useResilientAudio()` / `createResilientAudioContext()`**
      (`components/game-audio/`). It carries what Ever Onward learned (15d23605,
      d7542e7e): unlock on `touchend`/`click` (iOS counts only those); set the audio
      session **before** creating the context (`"ambient"` by default, so a
      podcast or music keeps playing; `"playback"` plays on silent but pauses
      others); suspend on hidden, resume on visible and `pageshow`; detect a dead
      context (`"interrupted"` state, or "running" with a frozen clock after the
      app switcher) and rebuild it on the next gesture.
- [ ] **Never an `<audio>` element for effects or speech.** It takes over Now
      Playing and pauses the player's podcast (4c8ac886). Web Audio only.
- [ ] Synthesize with `components/game-audio/primitives.ts` (`tone`, `noise`), keep
      every voice short and well below 0.2 gain, rate-limit repeats.
- [ ] A big on/off toggle (`createChannelSettings`); nothing sounds before the
      first tap; reduced motion softens the mix (`softnessGain`).
- [ ] Voices play through `audio.engine()`, never a cached engine: a rebuild
      replaces it.

## Updates and offline

- [ ] **`useGameUpdate(slug, { saveNow })`** plus `<UpdatePill>`: polls
      `/<slug>/version.json` every 60 s **while visible** (an idle iPad fires no
      visibility events, 846091b7), recovers from a stale chunk after a deploy, and
      reloads only when the player taps.
- [ ] `app/<slug>/version.json/route.ts` is two lines with `versionRoute()`
      (`export const dynamic = "force-static"` must stay literal in the file).
- [ ] **`firebase.json` headers**: `no-cache` for `/<slug>`, `.html`,
      `/<slug>/versions`(+`.html`), `/<slug>.webmanifest`, `/<slug>/version.json`
      and `/<slug>-icons/**`. Order matters: the generic year-long image rule comes
      first and the specific rules after it, or `**/*.png` wins (59b9b2f0).
- [ ] If the game has a service worker, it never caches `version.json`.

## Compatibility (older iPads)

- [ ] Target **Safari 15.0**. ESLint bans `Object.hasOwn`, `structuredClone`,
      `.at()`, `.findLast()`, `.findLastIndex()`, `.toSorted()`, `.toReversed()`,
      `.toSpliced()`, `Object.groupBy`, `Promise.withResolvers`,
      `requestIdleCallback` and friends in shipped code. Use `hasOwn`, `at`,
      `findLast`, `sorted` from `lib/game-kit/compat.ts`, or a plain loop.
- [ ] `matchMedia().addEventListener` is missing before Safari 14: use
      `usePrefersReducedMotion`, which falls back to `addListener`.
- [ ] `crypto.randomUUID` needs a fallback (Safari 15.4 on insecure contexts, none
      before): see `newId` in `lib/flamelings/store.ts`.
- [ ] Do not trust a feature check you have not run on an old iPad or an old
      WebKit: say so in the PR if you could not.

## Saves and multiple tabs

- [ ] **A versioned save key** (`<slug>:v1`), validated on load, never throwing.
- [ ] **Salvage, do not wipe**: an unknown id from a newer build is dropped or
      defaulted, only an unreadable entry is skipped, and the original is backed
      up first (timestamped slots, keep three). If a read or a backup fails, never
      overwrite the main key (`lib/flamelings/save.ts`).
- [ ] **One writing tab**: a localStorage heartbeat lock, re-read before every
      write, adopt other tabs' saves on the `storage` event, "open in another
      tab" screen with "Play here" (`lib/flamelings/tabLock.ts`). Without it two
      tabs overwrite each other. Copy that pattern for any save that matters.
- [ ] Persist on `visibilitychange` hidden **and** `pagehide`
      (`useVisibilityPause({ onPersist })`): iOS may not run a later handler.
- [ ] Simple settings: `createStoredSetting` (cross-tab, throws-safe).

## Performance and visibility

- [ ] Pause animation loops, timers and simulations while hidden, catch up when
      visible (`useVisibilityPause`). A hidden iPad tab must cost nothing.
- [ ] Honour reduced motion in CSS (`@media (prefers-reduced-motion)`) and in script
      (`usePrefersReducedMotion`).
- [ ] No WebGL unless the game is 3D; SVG + CSS animation is smooth on an iPad mini.
- [ ] Time lives behind an injectable clock so a long absence is testable.

## Analytics for children

- [ ] Only through `trackGame` with closed enums and small integers; no user or
      session ids, no free text, **never a typed name**. Schema in
      `lib/analytics/gameEvents.ts`, mirrored in `firestore.rules`, the rules
      tests and the admin dashboard, all in one change. See CLAUDE.md.
- [ ] A pageview `site` for the game in `lib/analytics/site.ts`, `types.ts` and
      the rules.

## Test hooks and e2e

- [ ] Expose test state only through `createTestHooks("__<slug>", {...})`
      (`lib/game-kit/testHooks.ts`): on in dev and `NEXT_PUBLIC_E2E=1`, off in the
      build that ships.
- [ ] `e2e/<slug>.spec.ts`: a core-loop test on chromium and one `@smoke` layout
      test (no sideways scroll) for webkit and the iPad project; add the spec to a
      group in `.github/workflows/ci.yml` and to the `ipad` project `testMatch`.
- [ ] Moving the clock in e2e through the hook, not `waitForTimeout`.

## Releases and changelog

- [ ] `lib/<slug>/version.ts`, `changelog.ts` (plain words for a child or parent), a
      changelog test, a `/versions` page linked from the game, and a "<Game>
      releases" section in CLAUDE.md. Bump on every shipped change, including
      compatibility fixes.
- [ ] Sitemap entry, a link from the home page, a terminal command if it fits.

## Follow-ups (not done: the games have not moved onto the kit yet)

- Migrate Ship Builder, Plane Builder, Planet Smasher and Ever Onward to
  `gameMetadata()` (their `page.tsx` files repeat it), `GameShell`, and
  `useVisibilityPause`.
- Replace the four copies of `useSoundUnlock` / `useEverOnwardAudio` unlock code
  with `useResilientAudio`, and move Ever Onward's synth onto
  `createResilientAudioContext` (its logic was extracted from there; its tests
  must stay green).
- Move Ever Onward onto `useGameUpdate` (it uses `useUpdateCheck` directly) and
  its `version.json` route onto `versionRoute`.
- Add Ship Builder, Plane Builder and Planet Smasher to `GAME_DIRS` in the
  safe-area guard and fix what it finds.
- Replace the per-game test-hook gates (`TEST_HOOKS_ENABLED`) with
  `createTestHooks`.
- Version the other games' icons (`iconVersion`).
- Move Ship Builder, Plane Builder and Planet Smasher onto the generated
  service worker (`GENERATED_GAME_WORKERS`) and `useGameServiceWorker`. Their
  hand-written workers differ (Plane Builder has the lie-fi timeout and pruning,
  Ship Builder lacks them and adds `voice/`, Planet Smasher lacks `SKIP_WAITING`
  and the version.json guard), so the generator does not reproduce them byte for
  byte; move each with its own behaviour test and the offline e2e, then delete
  `serviceWorkerDrift.test.ts`.
- Fold the per-path theme-colour checks in `lib/theme/themeScript.ts` into one
  game registry.
