---
name: game-release-review
description: Use before shipping any change to a game (Ship Builder, Plane Builder, Planet Smasher, Ever Onward, Flamelings or a new one): walks docs/games/foundation.md against the diff and checks it on iPad, pinned-app insets, audio, multi-tab, compat and updates.
---

# Game release review

Run this on every game change before it ships, as its own pass (not folded
into the implementation). Read `docs/games/foundation.md`; report each item
**pass / fail / not applicable** with evidence, fix failures, then re-check.

## 1. Walk the checklist against the diff

`git diff origin/main...HEAD -- <game dirs>`. For each area in the foundation
(home-screen metadata, safe areas, touch, audio, updates, compat, saves and
tabs, visibility and perf, analytics, test hooks, releases), find the code the
diff touches and confirm the rule still holds. Anything new that is pinned,
sounds, saves, polls or hides needs its rule applied.

## 2. Mechanical checks (all must pass)

- `npm run lint` (this includes the Safari 15.0 compat ban)
- `npm run format:check`, `npm run type-check`, `npm test`
- `lib/game-kit/__tests__/safeAreaGuard.test.ts` includes the game
- `npx next build --webpack`
- the game's e2e on chromium plus its `@smoke` on webkit and `ipad`:
  `npx playwright test e2e/<slug>.spec.ts --project=chromium --project=webkit --project=ipad`
- `npm run test:rules` if analytics, schema or rules changed

## 3. Release rules

Version bumped and changelog entry written in plain words for a child or
parent (every shipped change, compat fixes included); changelog test green; the
Versions page lists it.

## 4. Look at it (screenshots, then open and read them)

- iPad portrait 744x1133 and landscape 1133x744, and a phone 390x844.
- **Pinned-app insets**: simulate the notch and home bar with CDP
  (`Emulation.setSafeAreaInsetsOverride`, e.g. top 47, bottom 34, left/right 0
  and landscape 0/0/47/47) and confirm the top bar, bottom bar and every
  overlay clear them.
- No horizontal scroll at any of those sizes; no text under the status bar.
- Light and dark where the chrome has both; reduced motion on (`emulateMedia`).
- Night/empty/error/first-run states, not just the happy path.

## 5. Behaviour that only shows when it breaks

- **Audio**: first tap unlocks; hide the page -> silent and suspended; show ->
  sound returns; simulate an interruption (the context state `"interrupted"`)
  and confirm the next tap rebuilds it; sound toggle off is silent.
- **Multi-tab**: open the game in two tabs; the second shows the "open in another
  tab" screen and the first keeps saving; "Play here" takes over; no save is
  lost.
- **Saves**: put an unknown id, a broken entry and garbage JSON in the save; the
  rest survives and a backup exists; an unreadable storage never overwrites.
- **Updates**: bump the build id in `version.json`; the update pill appears and a
  tap saves then reloads. Check the hosting headers are `no-cache`.
- **Time**: skip the clock days ahead through the test hook; the model
  behaves.
- **Offline / slow network** if the game claims offline play.

## 6. Report

Findings first, grouped by area, each with file and line, severity and the fix.
State what you could not check (a real old iPad, real iOS audio) so a human can.
