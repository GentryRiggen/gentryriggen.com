# Leaderboard seasons, admin board tools, daily-run reward modal

Date: 2026-10-30

## Why

Gentry wants to wipe the leaderboards and let everyone start over. A plain
delete does not do that: the games re-send each player's whole saved
progress, and the first-write anti-cheat rule (`validLeaderboardCreate`:
prestige ≤ 1, distance ≤ 150 km; Ship: ≤ 60 stars) refuses every experienced
player, so a wipe would silently drop the best players off the board for
good. Seasons give a real fresh start: the board counts only what a player
does after the season begins, so everyone starts from zero and the existing
anti-cheat limits keep working unchanged.

Separately: on a Plane Builder daily-challenge run the reward modal still
shows the coin gauge, "Jackpot ×2" and "Total +0", which reads as a bug.
Daily runs pay no coins by design; the modal should say so.

## Goals

- Plane Builder and Ship Builder leaderboards have seasons, each game with
  its **own** season counter (Gentry: separate).
- Starting a new season is a button in `/admin`, per game.
- Past seasons are **kept** (Gentry) and players can look back at them.
- `/admin` can, per entry and per season: Delete, Delete and ban (exists
  today for Plane), and Edit.
- Daily runs show a daily-specific modal (Gentry approved the wording idea).

## Non-goals

- The Plane daily-challenge board (`planeDaily/{date}`) is untouched: it
  already resets every day and has no season.
- No change to anything in a player's saved game other than what seasons
  need (planes, ships, coins, upgrades, prestige, world best times shown in
  the game all stay as they are).
- No accounts, no new personal data. Players are children: entries stay
  nickname + numbers only, uid is the anonymous Firebase uid as today.

## Anti-goals

- A new season must never lock a player out of the board (the failure the
  plain wipe would cause).
- Never weaken the anti-cheat rules to make seasons work.
- An empty board must not look broken to a kid.

## How it works

### Season number

- `seasons/plane` and `seasons/ship` docs: `{ number: int, startedAt:
timestamp }`. Public `get`, admin-only write (`isAdmin()`).
- The games read their doc when the board sync starts (and when the
  leaderboard screen opens). If the read fails, the game does not submit
  (no guessing a season).

### Where entries live

- New entries: `planeSeasons/{n}/entries/{uid}` and
  `shipSeasons/{n}/entries/{uid}`, same shape as today's `leaderboard` /
  `shipLeaderboard` docs, mirroring the `planeDaily/{date}/entries/{uid}`
  pattern.
- Rules: create/update only when `n == get(seasons/<game>).data.number`,
  plus every existing check (`validLeaderboard`, create caps, update rate
  limits, `notBanned`, the Ship equivalents). Past seasons are therefore
  frozen for players. `get`/`list` as today (limit ≤ 50). Admin may delete
  and update (see Admin).
- **Season 1 = today's `leaderboard` and `shipLeaderboard` collections**,
  read in place as the Season 1 archive (no data migration). Their
  create/update rules become `false` at deploy; admin delete/update stays.
- Cutover: the deploy ships with no season docs. Until Gentry presses
  "Start new season" once per game (creating `number: 2`), submits fail
  quietly as any failed submit does today. That button press is the reset
  he asked for.
- Bans (`leaderboardBans/{uid}`) stay global: a banned uid can't post in
  any season of either game, as today.

### What a season counts (client)

The client keeps a per-game season record in its save:
`{ season: number, ...season stats }`. When it reads a season number newer
than the stored one, it resets the season stats to zero and stores the new
number. Only play after that counts.

- **Plane:** season prestiges earned, season distance flown, season best
  time per world, season fastest full run. Score = `scoreFor(seasonPrestige,
seasonDistance)`. These are what the board entry carries (same fields as
  today). The rule `(prestige - 1) * 68800 <= lifetimeDistance` holds for
  season numbers too (first season prestige may come with little season
  distance; the rule already allows one free one).
- **Ship:** a season copy of `ChallengeProgress.designs` (per-design,
  per-challenge bests) recorded only from trials played this season; season
  stars = `totalStars` of that. The in-game star display per design stays
  all-time.
- Existing saves are migrated with season stats empty and `season: 0`, so
  the first season read resets them.

### What players see

- Each board shows a season label ("Season 2") and a picker listing the
  current and past seasons (1..current). A past season shows its frozen top
  50 the same way the board looks today, with the player's own row marked if
  present.
- The first time a player sees a new season, a short friendly note: "New
  season started! Everyone's back to zero." (wording is the builder's; must
  be plain enough for a young child).
- Existing standing/rank UI (finish standing, leaderboard cards) uses the
  current season.

### Admin (`/admin`)

- Per game: current season number and start date, and a **Start new
  season** button with a confirm ("Everyone starts from zero. Season N stays
  viewable."). It sets `seasons/<game>` to `number + 1`, `startedAt` server
  time. It does not delete anything.
- A board view per game with a season picker (current by default), top 50,
  each row with **Delete**, **Delete and ban**, **Edit**.
- **Edit is names only** (Gentry chose this after the builder check): a
  "New name" button gives the player a fresh generated name. Rules let the
  admin change only `nickname` (+ `updatedAt`). The game adopts it: when the
  name on its board entry differs from the name it last sent, it takes the
  board's name. Scores are never admin-edited: a raised score would lock
  the player out (scores can't go down), a lowered one would creep back.
- **Delete** clears the row; the player climbs back to their real score.
  Plane gets Ship's climb-back (capped first write, then rises within the
  update limits), so Delete never acts as a hidden ban.
- **Delete and ban** removes the uid from every season of both games and
  from today's and yesterday's daily boards, then bans (bans are global).
- Everything shown is player-written: render as text only (existing rule).
- Ship gets the admin board too (today only Plane has one).

### Daily-run reward modal

In `FlightRewardModal`, when `daily !== null`:

- Replace the coins line, the timing gauge, the jackpot label and the Total
  with "Daily challenge: no coins today, just your best time".
- Finished run: show the run's time and the player's rank on today's daily
  board (fetch as the daily board does). Crashed run: show distance / % as
  today plus a nudge to reach the finish to set a time.
- No Stop step: the modal goes straight to Continue.

## Constraints

- Static export; Firestore REST from the games, Firebase SDK only in
  `/admin`.
- `firestore.rules` changes need rules tests (`npm run test:rules`) for:
  season-gated create/update, past-season writes refused, legacy collections
  frozen, admin start-season / edit / delete, non-admin season write refused,
  bans across seasons.
- Releases: bump Plane Builder and Ship Builder versions with changelog
  entries in plain words.
- Any new index needs `firestore.indexes.json`.
- This is security/data-boundary work: spec review plus adversarial quality
  review (per Gentry's defaults).

## Left to the builder

- Exact save-format migration mechanics and store shape.
- Picker and note visuals (follow existing board styling, light and dark).
- How the client caches the season number between reads.
- How admin board rows are fetched and paged.
