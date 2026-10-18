# Plane Builder: Prestige, the Sky Map and worldwide leaderboards

**Date:** 2026-10-17
**Status:** Approved in chat

## Intent

- After beating all 10 worlds, players can **prestige**: reset every world
  for a permanent, stacking bonus collected by moving one square on an
  infinite board, the **Sky Map**. This can be repeated forever.
- Three **worldwide leaderboards**, with generated kid-safe nicknames:
  1. Prestige level (ties: lifetime distance).
  2. Fastest finish per world.
  3. Fastest full run (fewest flights to beat all 10 worlds in one run).
- **Constraints:**
  - Static export with no server. Firestore is written over REST, with no
    Firebase SDK on the game page.
  - No personal data is collected.
  - The plain first run's balance is unchanged; the balance suite stays at
    prestige 0.
  - Existing saves migrate; they don't reset.

## 1. Prestige and the Sky Map (`lib/plane-builder/prestige/`)

### Prestiging

- The Prestige action is available once `islands` (world 10) is finished.
- It resets every world to `newLevelProgress()` and `unlocked` to
  `["meadow"]`.
- It increments `prestige.level` and grants one Sky Map move. The move must
  be spent before the new run starts, so the map screen opens straight
  after prestiging.
- It keeps the map position, the visited squares, the collected bonuses and
  the lifetime stats.

### The board

- The board is an infinite grid of integer `(x, y)` squares. The start is
  `(0, 0)`, which is empty.
- A move goes to an orthogonally adjacent square.
- **Generation:** `squareAt(x, y)` is a pure, deterministic hash of the
  coordinates, the same for every player. With `d = |x| + |y|` (distance
  from the start):
  - About 35% of squares are empty.
  - Otherwise the square holds a bonus kind, weighted. Common kinds dominate
    near the start; `star` has a weight of about `min(8%, 1% + 0.5% × d)` of bonus squares (rare).
- A visited square is collected once and is empty after that. Visited
  squares are stored as `"x,y"` strings, one added per prestige.

### Bonuses

All bonuses stack, and they apply to every world in every run:

| Kind       | Name              | Effect per copy                              | Cap                    |
| ---------- | ----------------- | -------------------------------------------- | ---------------------- |
| `coins`    | 🪙 Golden Wind    | +10% coins (additive multiplier)             | none                   |
| `fuel`     | ⛽ Rocket Fuel    | +10% fuel                                    | none                   |
| `lift`     | 🪶 Feather Wings  | +5% lift                                     | +100%                  |
| `launch`   | 🚀 Turbo Spring   | +5% launch speed                             | +100%                  |
| `clover`   | 🍀 Lucky Clover   | green zone on both timing bars 10% wider     | green half-width ≤ 0.2 |
| `shield`   | 🛡️ Shield Charm   | +1 shield                                    | +5                     |
| `treasure` | 💰 Treasure Chest | each world starts with +100 coins on a reset | none                   |
| `star`     | ⭐ Star           | ×2 coins (multiplicative)                    | ×64                    |

Caps keep the sim sane. The sim's speed is still clamped to `MAX_SPEED`.

### Applying bonuses

- `applyBonuses(stats, bonuses)` returns new `PlaneStats`.
- `payout` takes an extra `coinFactor`, which is `(1 + 0.1 × coins) × 2^stars`.
- The gauge's green half-width comes from `greenHalf(clovers)`.
- Treasure coins are added by `prestige()` to each world's fresh wallet.
- The store applies bonuses where it builds stats and pays out. `planeStats`
  itself is unchanged, so the balance pilot and its tests see no bonuses.

### Run and lifetime stats (in `Progress`)

- `lifetimeDistance`: the sum of every flight's distance.
- `runFlights`: flights flown since the last prestige (or since starting).
- `fastestRun`: the smallest `runFlights` at the moment all 10 worlds were
  first finished within a run, or null.
- `bestTimes`: for each world, the fastest sim seconds from launch to
  crossing the finish (the new `FlightResult.finishTime`, null when the
  finish wasn't reached).

### Save

- `SAVE_VERSION` becomes 3.
- The migration from v2 to v3 adds the default prestige data and stats.
  It's a migration, not a reset.
- `RESET_BELOW` stays 2.

## 2. UI

- **Level select:** once world 10 is finished, a "Prestige ⭐" card explains
  the trade and asks for confirmation (the `ConfirmRestart` pattern). A
  "Sky Map" button is always visible once the prestige level is 1 or more.
- **Map screen** (`screen: "map"`):
  - A 7×7 window of squares centred on the player, each with its icon. The
    four adjacent squares are tappable or keyboard-focusable when a move is
    pending.
  - A move animates the collect and shows "+1 🍀 Lucky Clover!".
  - A summary of the collected bonuses and their total effects.
  - Buttons: "Start run" (back to the level list) or "Back".
  - It works on phones, stays inside the safe area, and supports dark mode.
- **Hangar:** a small "Prestige N ⭐" chip, which opens the bonus summary.

## 3. Leaderboards

### Identity

- **Anonymous Firebase Auth** over REST (Identity Toolkit
  `accounts:signUp?key=`, then a token refresh through
  `securetoken.googleapis.com`). The refresh token is stored in
  localStorage.
- The UID is the leaderboard document ID. There's no SDK on the game page.
- If sign-up fails (for example, Anonymous is disabled in the console),
  leaderboard features hide quietly.

### Nickname

- `"<Adjective> <Animal> <n>"`, built from fixed word lists of 40 adjectives
  and 40 animals, both friendly, with `n` from 1 to 99.
- The player can reroll it but can never type it.
- The rules accept only words from the same lists.

### Document `leaderboard/{uid}`

| Field              | Type                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| `nickname`         | string                                                                               |
| `prestige`         | int                                                                                  |
| `score`            | `prestige × 1e9 + min(lifetimeDistance, 999999999)` (one-field ordering for board 1) |
| `lifetimeDistance` | number                                                                               |
| `bestTimes`        | map from world id to number                                                          |
| `fastestRun`       | int or null                                                                          |
| `updatedAt`        | `request.time`                                                                       |

### Writes

- Throttled on the client: on the hangar arriving after a flight, at most
  once every 30 s, and on prestige.
- Writes use a REST `commit` with `updateTransforms` for `updatedAt`.

### Reads

- REST `runQuery`:
  - Board 1: `orderBy score desc, limit 50`.
  - Board 2: for each world, `orderBy bestTimes.<id> asc, limit 50`.
  - Board 3: `orderBy fastestRun asc, limit 50`, with a filter that
    `fastestRun` is above 0.
- No composite indexes are needed.

### `firestore.rules` (security boundary)

- **Read:** anyone, with `request.query.limit <= 50` and
  `request.query.offset == 0` (no paging past the top 50). Only public,
  non-personal fields are stored.
- **Create and update:**
  - `request.auth.uid == uid`, and the sign-in provider is `anonymous`.
  - The keys are exactly the listed fields.
  - The nickname is three space-separated parts, with words from the
    allowed lists and the number from 1 to 99.
  - `prestige` is an int from 0 to 10,000, and never decreases.
  - `score` matches the formula.
  - `lifetimeDistance` is a number from 0 to 1e12, never decreasing.
  - Each `bestTimes` entry is a known world id, with a value at least that
    world's `finishDistance / MAX_SPEED` (rounded down, the physical
    minimum) and at most 600.
  - `fastestRun` is null or an int from 10 to 100,000. Coherence: a
    non-null `fastestRun` needs all 10 worlds in `bestTimes` and
    `lifetimeDistance >= 68800` (the sum of every `finishDistance`; a sync
    test checks the constant).
  - `updatedAt == request.time`.
  - Not banned: no `leaderboardBans/{uid}` document exists.
- **Create only:** `prestige <= 1` and `lifetimeDistance <= 150000`.
- **Update only:**
  - `(prestige - 1) * 68800 <= lifetimeDistance`: prestige must be earned
    by distance. The `- 1` is the one free prestige a migrated v2 save
    gets.
  - With `secs = (request.time - old.updatedAt) / 1000`, `secs >= 10` and
    `lifetimeDistance <= old.lifetimeDistance + 200 * secs + 9100`. A
    flight adds at most 9,100 m, and flying is capped at 180 m per real
    second (`MAX_SPEED` 120 m/s times `GAME_SPEED` 1.5). There is no
    per-write prestige or distance cap, so a legit player who was offline
    can always catch up.
- **Delete:** admin only (the existing `isAdmin()`).
- **Bans:** `leaderboardBans/{uid}` is readable and writable by the admin
  only. A ban stops that uid creating or updating its leaderboard doc.
- **Tests:** rules tests in `firestore-tests/` cover each accept and reject
  case.

### Admin

- A new section in `/admin` (`components/admin/`) lists the top leaderboard
  rows, with a "Delete and ban" button on each. It confirms first, then in one
  batch deletes the row and writes `leaderboardBans/{uid}`, so the player
  can't post again.

### Accepted risk

- A determined player could forge plausible scores within the rule limits.
  That's mitigated by the sanity limits, the rate limit and admin deletes,
  and accepted for a kids' game.

## Testing

- **Unit:**
  - The board is deterministic and has no bonus at the start.
  - Bonus math and caps.
  - Prestige resets correctly and keeps the right things.
  - The v2 to v3 save migration.
  - `finishTime`.
  - The run and lifetime stats.
  - The nickname generator.
  - The REST request builders for auth, commit and query.
  - The UI for the map and the prestige flow.
- **Rules:** emulator tests for every rule.
- **Balance:** the existing suite, unchanged (prestige 0).
- **E2E:** the Plane Builder spec still passes. The leaderboard UI is hidden
  in e2e when not configured, or mocked.
- **Security:** an adversarial review of the rules and the client before
  shipping.

## Release

- Plane Builder 1.6.0, with a changelog entry in kid words.
