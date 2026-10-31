# Leaderboard Seasons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-game leaderboard seasons (Plane Builder, Ship Builder) started from `/admin`, past seasons kept and viewable, admin delete / ban / rename per entry, and a daily-run reward modal that explains why no coins are paid.

**Architecture:** A public `seasons/{game}` doc holds the current season number. Entries for season N ≥ 2 live in `planeSeasons/{N}/entries/{uid}` / `shipSeasons/{N}/entries/{uid}`; season 1 is the existing `leaderboard` / `shipLeaderboard` collections, frozen for players. Each game's save keeps season stats that reset when the game sees a newer season number, and the board entry is built from those stats, so every existing anti-cheat rule keeps working unchanged.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, Zustand, Firestore REST (games) + Firebase SDK (`/admin` only), Firestore rules + `@firebase/rules-unit-testing`, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-30-leaderboard-seasons-design.md`

## Global Constraints

- Players are children: entries hold nickname + numbers only; no new personal data.
- Everything read from Firestore in `/admin` is attacker-controlled: render as text only.
- Never weaken an existing anti-cheat rule (`validLeaderboard`, `validLeaderboardCreate`, `validLeaderboardUpdate`, `coherent`, `notBanned`, `validShipLeaderboard`, `validShipCreate`, `validShipUpdate`). New season paths reuse them verbatim.
- Season numbers: int ≥ 2 in `seasons/{game}`; a missing doc means the current season is 1.
- `seasons/{game}` writable only by `isAdmin()`, and only as `number == old + 1` (or `2` when the doc does not exist) with `startedAt == request.time`; never deletable.
- Bans (`leaderboardBans/{uid}`) apply to every season of both games.
- Tailwind only, light + dark, mobile-first; `export default function`; `interface` for props.
- Plane Builder and Ship Builder each get a release: version bump + plain-words changelog entry (see CLAUDE.md).
- Security/data-boundary work: Task 1 and Task 5 get spec review + adversarial quality review; others get one combined review.

## Review Focus

1. A player with years of progress (prestige 7, 900 km) on first load after a new season: their next write must be accepted (season stats are zero), never refused forever. → Task 2 test `startSeason zeroes season stats but keeps lifetime progress` + Task 1 rules test `fresh season entry from a veteran is accepted`.
2. Season doc read fails (offline, blocked): the game must not submit and must not reset season stats. → Task 2/3 tests `no season read, no submit`.
3. An old cached build (service worker) still writing `leaderboard/{uid}` after the cutover: refused, no crash. → Task 1 rules test `legacy collections refuse player writes`.
4. A run started before the season and finished after it: must not produce a `fastestRun` the `coherent()` rule refuses forever. → Task 2 test `run started before the season does not count as a season fastest run`.
5. Admin presses Start new season twice quickly / in two tabs: exactly one increment each, never a skipped or repeated number. → Task 1 rules test `season must go up by exactly one` + Task 5 uses a transaction.

---

### Task 1: Season docs, season paths, rules, and REST client (security)

**Files:**

- Create: `lib/leaderboard/season.ts`, `lib/leaderboard/__tests__/season.test.ts`
- Modify: `firestore.rules` (new `seasons`, `planeSeasons`, `shipSeasons` blocks; legacy `leaderboard` / `shipLeaderboard` create/update → `false`, admin update allowed)
- Modify: `lib/leaderboard/client.ts` (`submitEntry`, `fetchBoard`, `buildBoardQuery` take a season), `lib/leaderboard/shipBoard.ts` (same for ship)
- Modify: `firestore-tests/rules.test.ts`, `lib/leaderboard/__tests__/client.test.ts`, `lib/leaderboard/__tests__/shipBoard.test.ts`, `lib/leaderboard/__tests__/rulesSync.test.ts` if it pins collection names

**Interfaces (Produces):**

```ts
// lib/leaderboard/season.ts
export type SeasonGame = "plane" | "ship";
export const FIRST_SEASON = 1;
export interface SeasonInfo {
  number: number;
  startedAt: Date | null;
}
/** GET seasons/{game} over REST, no auth. Missing doc → { number: 1, startedAt: null }; any failure → null. */
export function fetchSeason(
  game: SeasonGame,
  deps?: ClientDeps
): Promise<SeasonInfo | null>;
/** Collection path holding entries: season 1 → "leaderboard" | "shipLeaderboard"; else "planeSeasons/{n}/entries" | "shipSeasons/{n}/entries". */
export function seasonCollection(game: SeasonGame, season: number): string;
// lib/leaderboard/client.ts
export function submitEntry(
  entry: LeaderboardEntry,
  season: number,
  deps?: ClientDeps
): Promise<boolean>;
export function fetchBoard(
  kind: BoardKind,
  season: number,
  deps?: ClientDeps
): Promise<LeaderboardRow[] | null>;
// lib/leaderboard/shipBoard.ts
export function submitShipEntry(
  entry: ShipBoardEntry,
  season: number,
  deps?: ClientDeps
): Promise<CommitResult>;
export function fetchShipBoard(
  season: number,
  deps?: ClientDeps
): Promise<LeaderboardRow[] | null>;
```

Subcollection queries use the parent-path runQuery URL the way `lib/leaderboard/daily.ts` already does (`documents/planeSeasons/{n}:runQuery`, `from: [{ collectionId: "entries" }]`).

**Rules (exact behaviour):**

- `match /seasons/{game}`: `get: if true`; `create: if isAdmin() && game in ['plane','ship'] && keys exactly ['number','startedAt'] && number == 2 && startedAt == request.time`; `update: if isAdmin() && same keys && number == resource.data.number + 1 && startedAt == request.time`; no delete, no list.
- `function currentSeason(game) { return get(/databases/$(database)/documents/seasons/$(game)).data.number; }`
- `match /planeSeasons/{season}/entries/{uid}`: get true; list limit ≤ 50 offset 0; `create: if isPlayer(uid) && season == string(currentSeason('plane')) && validLeaderboard() && validLeaderboardCreate(uid)`; `update: if (isPlayer(uid) && season == string(currentSeason('plane')) && validLeaderboard() && validLeaderboardUpdate(uid)) || adminRename()`; `delete: if isAdmin()`.
- `match /shipSeasons/{season}/entries/{uid}`: same shape with the ship functions and `'ship'`.
- `function adminRename() { return isAdmin() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['nickname','updatedAt']) && validNickname(request.resource.data.nickname) && request.resource.data.updatedAt == request.time; }` — the admin may only rename (Gentry: Edit is names only).
- `leaderboard/{uid}` / `shipLeaderboard/{uid}`: player create/update removed; `update: if adminRename()`; get/list/delete unchanged.
- The catch-all `match /{document=**}` stays closed.

- [ ] **Step 1: Write failing rules tests** in `firestore-tests/rules.test.ts`. Move the existing `leaderboard` and `shipLeaderboard` create/update/rate-limit/bans/REST suites to target season 2 (seed `seasons/plane` and `seasons/ship` with `{ number: 2, startedAt }` via `withSecurityRulesDisabled` in `beforeEach`). Add:
  - `seasons: anyone can get; non-admin create/update refused; admin create must be 2; admin update must be old + 1 ("season must go up by exactly one": 2→4 refused, 2→2 refused, 2→3 ok); delete refused; extra keys refused`
  - `writes to a past season are refused` (season doc at 3, player creates in `planeSeasons/2/entries/{uid}` → fail; same for ship)
  - `no season doc → season-path writes refused`
  - `legacy collections refuse player writes` (create and update on `leaderboard/{uid}` and `shipLeaderboard/{uid}` → fail)
  - `fresh season entry from a veteran is accepted` (create with prestige 1, distance 120000 in season 2 → ok)
  - `admin can rename an entry, nothing else` (nickname change ok; any score/stars/bests change refused; non-generated nickname refused), on season path and legacy
  - `admin can delete any season's entry; players cannot`
  - `ban blocks writes in every season of both games`
- [ ] **Step 2: Run** `npm run test:rules` — new tests FAIL.
- [ ] **Step 3: Implement the rules** above.
- [ ] **Step 4: Write failing unit tests** in `season.test.ts` (`seasonCollection("plane", 1) === "leaderboard"`, `("ship", 1) === "shipLeaderboard"`, `("plane", 3) === "planeSeasons/3/entries"`, `("ship", 2) === "shipSeasons/2/entries"`; `fetchSeason` → `{number:1,startedAt:null}` on 404, parsed number on 200, `null` on network error / 500 / non-int number) and update `client.test.ts` / `shipBoard.test.ts` for the season parameter (query URL for season 3 contains `documents/planeSeasons/3:runQuery`; season 1 uses the root runQuery URL and collectionId `leaderboard`).
- [ ] **Step 5: Implement** `season.ts` and the client/shipBoard signature changes; fix all callers to compile (callers may pass a placeholder until Tasks 2–4 wire the real number; `npm run type-check` must pass).
- [ ] **Step 6: Run** `npm test -- --testPathPatterns=leaderboard` and `npm run test:rules` — PASS.
- [ ] **Step 7: Commit** `feat(leaderboard): seasons in rules and REST client`

### Task 2: Plane Builder season stats and sync

**Files:**

- Modify: `lib/plane-builder/economy/progress.ts`, `lib/plane-builder/persist/schema.ts` (SAVE_VERSION 5), `lib/plane-builder/state/store.ts`, `lib/plane-builder/state/leaderboardSync.ts`, `components/plane-builder/hooks/useLeaderboardStanding.ts`
- Test: `lib/plane-builder/economy/__tests__/progress.test.ts` (or the existing progress test file), `lib/plane-builder/persist/__tests__/schema.test.ts`, `lib/plane-builder/state/__tests__/leaderboardSync.test.ts`

**Interfaces:**

- Consumes: `fetchSeason`, `submitEntry(entry, season)`, `fetchBoard(kind, season)` (Task 1).
- Produces:

```ts
export interface PlaneSeason {
  number: number; // 0 = never seen a season
  prestiges: number;
  distance: number;
  bestTimes: Partial<Record<LevelId, number>>;
  fastestRun: number | null;
  /** True when the current run began inside this season (only then can it set fastestRun). */
  runCounts: boolean;
}
// Progress gains: season: PlaneSeason
export function startSeason(p: Progress, number: number): Progress; // zeroes season stats, runCounts = p.runFlights === 0
export function seasonEntry(p: Progress): LeaderboardEntry; // nickname + season stats, score = scoreFor(prestiges, distance)
// store: currentSeason: number | null (null until read); newSeasonNote: boolean; applySeason(n: number): void; dismissNewSeasonNote(): void
```

- [ ] **Step 1: Failing tests**:
  - `startSeason zeroes season stats but keeps lifetime progress` (prestige.level 7, lifetimeDistance 900000 unchanged; season = {number: n, prestiges 0, distance 0, bestTimes {}, fastestRun null})
  - `recordFlight adds distance and min best time to the season`
  - `prestige bumps season.prestiges and sets runCounts`
  - `run started before the season does not count as a season fastest run` (startSeason mid-run → complete run → season.fastestRun null; next full run after prestige → set)
  - `recordDailyFlight leaves the season alone`
  - schema: v4 save migrates to v5 with `season.number 0` and empty stats; bad season field → save rejected like other bad fields
  - sync: `refused first write climbs back` (doc missing, local season prestige 4 / 600 km: after a refusal it sends prestige ≤ 1, distance ≤ 150000, fastestRun null, then each later write rises within `old + 200*secs + 9100` and `(prestige-1)*68800 <= distance` until it reaches the real stats — mirror Ship's `createBoardSync` climb, using `commitDocumentResult` so a refusal is distinguishable from a network error)
  - sync: `adopts a name the admin set` (server entry nickname differs from the last nickname this client sent → `setNickname(server)`; equal → untouched; a just-rerolled local name not yet sent is not reverted)
  - sync: `no season read, no submit`; `newer season resets stats once and sets newSeasonNote`; `same season does not reset`; `submit carries seasonEntry and the season number`
- [ ] **Step 2: Run** the three test files — FAIL.
- [ ] **Step 3: Implement.** Reading the player's own entry is a REST GET of `seasonCollection("plane", n)/{uid}` (add `fetchOwnEntry` next to `fetchBoard`; Ship gets the same in `shipBoard.ts`). `leaderboardSync.start()` reads the season (`fetchSeason("plane")`) before its first submit and again before a submit when the last read is older than 10 minutes; if `number > progress.season.number` call `applySeason`. `useLeaderboardStanding` and anything else feeding a board rank uses season stats and `currentSeason`.
- [ ] **Step 4: Run** the test files + `npm run type-check` — PASS.
- [ ] **Step 5: Commit** `feat(plane-builder): season stats feed the leaderboard`

### Task 3: Ship Builder season stars and sync

**Files:**

- Modify: `lib/ship-builder/challenges/progress.ts`, `lib/ship-builder/persist/challenges.ts` (format bump), `lib/ship-builder/challenges/progressStore.ts`, `lib/ship-builder/challenges/boardSync.ts`, `components/ship-builder/hooks/shipBoardSync.ts`
- Test: matching `__tests__` files

**Interfaces:**

- Consumes: `fetchSeason("ship")`, `submitShipEntry(entry, season)` (Task 1).
- Produces:

```ts
// ChallengeProgress gains: season: { number: number; designs: Record<string, DesignBests> }
export function startShipSeason(
  p: ChallengeProgress,
  number: number
): ChallengeProgress; // season.designs = {}
// recordBest / adoptUnsaved / dropDesign apply to designs AND season.designs
// entryOf(progress, nickname) builds from season.designs (all-time designs still drive the in-game stars)
export function applyShipSeason(number: number): boolean; // progressStore: resets if newer, returns whether it did
```

- [ ] **Step 1: Failing tests**: `startShipSeason empties season stars, keeps all-time stars`; `recordBest records into both`; `dropDesign drops from both`; `adoptUnsaved merges in both`; `entryOf uses season stars only` (all-time 40 stars, season 3 → totalStars 3); persist: old format parses with `season.number 0`; boardSync: `adopts a name the admin set` (same rule as Plane: server name ≠ last sent name → adopt via `setChallengeNickname`), `no season read, no submit`, `newer season resets accepted/refusals climb state`, submit passes the season number.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** Board sync reads the season before its first submit and when the last read is older than 10 minutes, like Task 2; a reset also clears `accepted` and `refusals`.
- [ ] **Step 4: Run** tests + type-check — PASS.
- [ ] **Step 5: Commit** `feat(ship-builder): season stars feed the leaderboard`

### Task 4: Season label, picker and new-season note on both boards

**Files:**

- Create: `components/leaderboard/SeasonPicker.tsx` (shared), its test
- Modify: `components/plane-builder/ui/Leaderboards.tsx`, `components/ship-builder/ui/ShipLeaderboard.tsx`, their tests; any e2e that stubs board fetches

**Interfaces:**

```tsx
interface SeasonPickerProps {
  current: number;
  value: number;
  onChange: (season: number) => void;
}
export default function SeasonPicker(props: SeasonPickerProps); // <select> labelled "Season", options current..1, current one reads "Season N (now)"
```

- [ ] **Step 1: Failing tests**: picker lists `Season 3 (now)`, `Season 2`, `Season 1`; choosing 2 calls `onChange(2)`. Plane `Leaderboards`: tabs fetch with the selected season (mock `fetchBoard` called with `(kind, 2)`); the "Daily" tab has no picker; own row still highlighted on a past season; when the store's `newSeasonNote` is true the board shows "New season! Everyone starts from zero. Fly to get on the board." and dismissing clears it. Ship board: same with `fetchShipBoard(2)` and copy "New season! Everyone starts from zero. Earn stars to get on the board." While the season is unknown (`null`) the board shows today's loading state, not an error.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(leaderboard): season picker and new-season note`

### Task 5: Admin seasons and board tools (security)

**Files:**

- Modify: `lib/firebase/client.ts` (replace `fetchLeaderboardTop` / `banAndDeleteLeaderboardEntry` with the functions below)
- Create: `components/admin/SeasonBoardAdmin.tsx` (replaces `LeaderboardAdmin.tsx`, delete the old file), test in `components/admin/__tests__/`
- Modify: `components/admin/Dashboard.tsx` (render `<SeasonBoardAdmin game="plane" />` and `<SeasonBoardAdmin game="ship" />`)

**Interfaces:**

```ts
export interface AdminBoardRow {
  uid: string;
  nickname: string;
  updatedAt: Date | null;
  // plane
  prestige?: number;
  lifetimeDistance?: number;
  // ship
  totalStars?: number;
}
export function fetchAdminSeason(game: SeasonGame): Promise<SeasonInfo>;
/** Transaction: reads seasons/{game}, writes number + 1 (2 if missing), startedAt serverTimestamp. Returns the new number. */
export function startNewSeason(game: SeasonGame): Promise<number>;
export function fetchAdminBoard(
  game: SeasonGame,
  season: number
): Promise<AdminBoardRow[]>; // top 50: plane by score desc, ship by totalStars desc
export function deleteBoardEntry(
  game: SeasonGame,
  season: number,
  uid: string
): Promise<void>;
/** One batch: ban doc + delete uid from every season 1..current of BOTH games (reads both season numbers first) + planeDaily today and yesterday (UTC). Deleting a missing doc is fine. */
export function banAndDeleteEverywhere(uid: string): Promise<void>;
/** updateDoc({ nickname, updatedAt: serverTimestamp() }) — the rules allow nothing else. */
export function renameBoardEntry(
  game: SeasonGame,
  season: number,
  uid: string,
  nickname: string
): Promise<void>;
```

UI per game: heading "Plane Builder leaderboard" / "Ship Builder leaderboard"; "Season N, started <date>" (or "Season 1" with no date); **Start new season** with `window.confirm("Start Season N+1 for <Game>? Everyone starts from zero. Season N stays viewable.")`; season `<select>` (current..1); rows with **New name** (confirm "Give <name> a new random name?", sets `randomNickname()`; the rules only accept generated names, and the player's game adopts it), **Delete** (confirm "Remove <name> from Season N? They'll climb back as they keep playing."), **Delete and ban** (confirm "Ban <name>? They'll be removed from every board in both games and can't post again."). On a refused write show "Couldn't save that change." All player-written values rendered as text.

- [ ] **Step 1: Failing tests** (mock `@/lib/firebase/client`): shows season and start date; Start new season confirms then calls `startNewSeason("plane")` and reloads to the new season; cancel does nothing; picker switches `fetchAdminBoard` season; Delete calls `deleteBoardEntry` and removes the row; Delete and ban calls `banAndDeleteEverywhere(uid)`; New name calls `renameBoardEntry` with a valid generated name and updates the row; a nickname containing `<img src=x>` renders as literal text.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** tests + type-check — PASS.
- [ ] **Step 5: Commit** `feat(admin): leaderboard seasons, delete and edit`

### Task 6: Daily-run reward modal

**Files:**

- Modify: `components/plane-builder/ui/FlightRewardModal.tsx`, its test

- [ ] **Step 1: Failing tests** with `daily` set in the store:
  - no coins line, no timing gauge, no "Jackpot", no "Total"; shows `Daily challenge: no coins today, just your best time`
  - finished run: shows the run's time (same formatter the daily board uses) and `#<rank> today` from the daily board (mock `fetchDailyBoard`; rank via `standingOn(rows, uid, time, "asc", DAILY_BOARD_LIMIT)`); hidden when leaderboards are off or the fetch fails
  - crashed run: distance and % as today plus `Reach the finish to set a time!`
  - Continue is shown immediately and focused; Space/Enter dismiss (no Stop step)
  - non-daily flights unchanged (existing tests pass)
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** If `dismissFlightReward` requires a claimed bonus, add a store path that lets a daily flight dismiss without one (test it). **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(plane-builder): daily runs explain why no coins`

### Task 7: Releases, docs, ship

**Files:** `lib/plane-builder/version.ts`, `lib/plane-builder/changelog.ts`, `lib/ship-builder/version.ts`, `lib/ship-builder/changelog.ts`, `CLAUDE.md` (Analytics section: seasons, admin tools)

- [ ] **Step 1:** Minor bump both games; changelog entries in plain words, e.g. Plane: "Leaderboards now have seasons! When a new season starts, everyone begins at zero, and you can still look back at old seasons." and "Daily challenge flights now say why they don't pay coins, and show your time and rank for today." Ship: the seasons line with stars.
- [ ] **Step 2:** Add to CLAUDE.md: seasons live in `seasons/{game}`; entries in `planeSeasons|shipSeasons/{n}/entries`; season 1 is the legacy collections; the reset is "Start new season" in `/admin`.
- [ ] **Step 3: Run** `npm run validate`, `npm run test:rules`, `npm run test:e2e` — all PASS.
- [ ] **Step 4: Commit** `chore: Plane Builder <v> / Ship Builder <v> releases`
