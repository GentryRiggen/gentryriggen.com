# Plane Builder Prestige and Leaderboards Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Prestige with an infinite Sky Map of stacking bonuses, plus three
worldwide Firestore leaderboards with kid-safe nicknames.

**Spec:** `docs/superpowers/specs/2026-10-17-plane-builder-prestige-leaderboard-design.md`

**Tech:** Next.js 16 static export, React 19, TypeScript, Tailwind 4,
zustand, three.js, and the Firestore and Identity Toolkit REST APIs.

## Global Constraints

- The sim and the board stay deterministic: no `Math.random` in
  `lib/plane-builder` sim, board or bonus code. The nickname reroll may use
  `crypto.getRandomValues`.
- No Firebase SDK on `/plane-builder`. Use REST only, like
  `lib/analytics/send.ts`.
- The balance suite is unchanged and runs at prestige 0.
- `SAVE_VERSION` becomes 3, with a migration from v2 to v3. No reset.
- Tailwind only, light and dark, `export default function`, `interface`
  props. Follow Prettier and CLAUDE.md.
- Per-task verification is unit-level only. The controller runs validate,
  e2e, the rules emulator and the deploy at the end.

## Review Focus

- A prestige taken with a move still unspent (closing the tab on the map):
  the move must persist and the map must reopen.
- An old v2 save with all 10 worlds finished: it migrates, and Prestige is
  offered.
- A leaderboard write before anonymous sign-in succeeds, or with Anonymous
  disabled: the game must not throw, and the leaderboard hides.
- A rules bypass: writing another player's document, a free-text nickname,
  a prestige jump of more than 1, an impossible best time, or extra fields.
- A board square far from the start (`|x|` around 1e6): generation stays
  finite and fast.

## Dependency graph

- **Wave 1, in parallel:** Task 1 (prestige core) and Task 3 (leaderboard
  backend).
- **Wave 2, in parallel:** Task 2 (prestige UI, needs Task 1) and Task 4
  (leaderboard UI, submit and admin, needs Tasks 1 and 3).
- **Wave 3:** Task 5 (adversarial security review, then fixes), then
  Task 6 (release and verify).

---

### Task 1: Prestige core (lib)

**Files:**

- New: `lib/plane-builder/prestige/{board,bonuses,index}.ts`, with tests.
- Modify:
  - `economy/progress.ts`
  - `economy/payout.ts`
  - `persist/schema.ts`
  - `sim/flight.ts` (`finishTime`)
  - `minigame/gauge.ts` (`greenHalf`)
  - `state/store.ts`

**Produces (exact names):**

- **Board and bonuses:**
  - `type BonusKind = "coins"|"fuel"|"lift"|"launch"|"clover"|"shield"|"treasure"|"star"`
  - `squareAt(x: number, y: number): BonusKind | null`
  - `type Bonuses = Record<BonusKind, number>`
  - `emptyBonuses(): Bonuses`
  - `BONUS_INFO: Record<BonusKind, { emoji: string; name: string; effect: string }>`
  - `applyBonuses(stats: PlaneStats, b: Bonuses): PlaneStats` (with the caps)
  - `coinFactor(b: Bonuses): number`
  - `greenHalf(clovers: number): number`
  - `TREASURE_COINS = 100`
- **`Progress` gains:**
  - `prestige: { level: number; x: number; y: number; visited: string[]; bonuses: Bonuses; movePending: boolean }`
  - `lifetimeDistance: number`
  - `runFlights: number`
  - `fastestRun: number | null`
  - `bestTimes: Partial<Record<LevelId, number>>`
  - `nickname: string | null` (set later by Task 4; it's only parsed and
    migrated here)
- **Progress functions:**
  - `canPrestige(p)`: `islands` is finished and no move is pending.
  - `prestige(p): Progress`: resets the worlds, adds treasure coins, sets
    `level + 1` and `movePending: true`, sets `runFlights` to 0, and keeps
    everything else.
  - `moveOnMap(p, dx, dy): { ok: true; progress; collected: BonusKind | null } | { ok: false }`:
    only when a move is pending and the step is adjacent. Collects
    `squareAt` if the square is unvisited, then clears `movePending`.
  - `recordFlight` also updates `lifetimeDistance`, `runFlights`,
    `bestTimes` (from `result.finishTime`) and `fastestRun` (when this
    flight makes all 10 worlds finished within the run).
- **Payout:**
  - `payout(level, result, multiplier, previousBest = 0, coinFactor = 1)`:
    `coinFactor` multiplies the total, after `minPayout`.
- **Sim:**
  - `FlightResult.finishTime: number | null`: the sim time when `finished`
    first became true.
- **Store:**
  - It builds stats with `applyBonuses(planeStats(...), progress.prestige.bonuses)`
    everywhere stats are made for flight (FlightRunner, HUD, store payout).
  - It passes `coinFactor(...)` to payout.
  - `TimingGauge` and its consumers use `greenHalf(...)`.
  - New actions:
    - `doPrestige()` sets `screen: "map"`.
    - `openMap()`.
    - `move(dx, dy)` returns the collected kind.
  - `Screen` adds `"map"`.
- **Save:**
  - v3, with a migration from v2 that adds defaults.
  - The parser validates the new fields: bonuses are non-negative integers,
    `visited` is limited to 100k entries, and so on.

**Tests:**

- Board determinism, (0, 0) empty, the frequency bands, and far coordinates.
- Bonus math and caps.
- `prestige` and `moveOnMap` rules.
- Stats tracking.
- The v2 to v3 migration.
- `finishTime`.
- The store flow.
- The balance suite still passes.

**Commit:** `feat(plane-builder): prestige core and the Sky Map board`

### Task 2: Prestige UI

**Files:**

- New: `components/plane-builder/ui/SkyMap.tsx`, plus a prestige confirm
  dialog.
- Modify: `LevelSelect.tsx`, `PlaneBuilder.tsx` (the map screen inside the
  safe-area frame), and `Hangar.tsx` (the prestige chip).

**Build** (per spec §2):

- The 7×7 window, with adjacent squares focusable when a move is pending,
  and arrow keys to move.
- The collect pop-up.
- The bonus summary.
- Start run and Back buttons.
- The Prestige card with confirmation.
- The Sky Map button.

**Tests:** RTL tests for the flows.

**Commit:** `feat(plane-builder): Sky Map and prestige screens`

### Task 3: Leaderboard backend

**Files:**

- New: `lib/leaderboard/{auth,client,nickname,types}.ts`, with tests.
- Modify: `firestore.rules` and `firestore-tests/rules.test.ts`.

**Produces:**

- **Nicknames:**
  - `ADJECTIVES` and `ANIMALS`: 40 words each, exported.
  - `randomNickname(rng?): string`
  - `isValidNickname(s): boolean`
- **Auth:**
  - `getIdToken(): Promise<{ uid: string; idToken: string } | null>`: an
    anonymous sign-up or a refresh, with the refresh token in localStorage
    under `plane-builder:lb-auth`. Returns null on any failure.
- **Entries:**
  - `interface LeaderboardEntry { nickname; prestige; score; lifetimeDistance; bestTimes; fastestRun }`
  - `scoreFor(prestige, lifetimeDistance)`
- **Client:**
  - `submitEntry(entry: LeaderboardEntry): Promise<boolean>`: REST `commit`
    to `leaderboard/{uid}` with the `updatedAt` server transform. Never
    throws.
  - `fetchBoard(kind: "prestige" | "fastestRun" | { world: LevelId }): Promise<LeaderboardRow[] | null>`:
    REST `runQuery`, limit 50. Rows are `{ uid, nickname, value }`.
- **Rules:** per spec §3.
  - Minimum times come from each world's `finishDistance / MAX_SPEED`.
    Hard-code them in the rules with a test that keeps them in sync.
  - The word lists are inlined in the rules, with a test that the rules and
    `nickname.ts` agree.

**Tests:**

- Request builders.
- Nickname validity.
- Rules emulator tests: run `npm run test:rules` locally (Java 21 is
  available) and include the result in the report.

**Commit:** `feat(leaderboard): anonymous auth, REST client and Firestore rules`

### Task 4: Leaderboard UI, submit and admin

**Files:**

- New: `components/plane-builder/ui/Leaderboards.tsx` (tabs for Prestige,
  Fastest run and Per world with a world picker) and a nickname card (shows
  the nickname, Reroll).
- Modify:
  - The store or a hook: submit (throttled to 30 s) after a flight and on
    prestige.
  - `LevelSelect` (a "🏆 Leaderboards" button).
  - `components/admin/` (a leaderboard section: list and delete).

**Behaviour:**

- When `getIdToken()` returns null, hide the button.
- The nickname lives in the save. Add `Progress.nickname: string | null`
  through the v3 parser and migration if Task 1 didn't add it.
- Highlight your own row.
- `Progress.nickname` already exists from Task 1. Set it with a new store
  action, `setNickname`.

**Tests:** RTL tests with a mocked client, and admin delete with a mocked
SDK.

**Commit:** `feat(plane-builder): worldwide leaderboards`

### Task 5: Adversarial security review

- A fresh reviewer attacks `firestore.rules`, `lib/leaderboard/*` and the
  admin delete:
  - writing other UIDs
  - field injection
  - nickname free text
  - score forgery beyond the limits
  - query limit bypass
  - denial of service through `visited` or large maps
  - token storage
  - privacy
- Fix Critical and Important findings, with rules tests for each.

### Task 6: Release and verify (controller)

- Version 1.6.0 and the changelog.
- Run `npm run validate`, `npm run test:rules`, and the Plane Builder e2e
  on Chromium, WebKit and iPad.
- Push to `main` and watch CI through the deploy, which includes the rules
  deploy. Refresh any visual baselines from CI's own render.
- Check the live site: the leaderboard renders (or hides if Anonymous is
  disabled).
