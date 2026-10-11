# Plane Builder 1.0 — Design

**Date:** 2026-10-11
**Status:** Approved

A new game at `/plane-builder`, a sibling of Ship Builder, inspired by Epic
Plane Evolution. Players launch a plane from a slingshot and fly it in 3D
toward a finish line far down a level. They earn coins for distance and pickups,
and spend them on upgrades. Finishing a level unlocks the next level and its
plane. There is no real money, no ads, no tickets and no daily limit.

## 1. Game loop and screens

1. **Level select.** Three cards: Meadow, Canyon, Mountains.
   - A locked card shows a padlock and "Reach the finish in <previous> to
     unlock".
   - Each card shows the best distance as a percentage of the finish.
   - Each card has three buttons:
     - **Play** for a level that isn't finished yet.
     - **Replay** for a finished level.
     - **Restart**, which asks for confirmation first.
2. **Hangar.**
   - The level's plane turns slowly on a stand, with six upgrade tracks below
     it: Launcher, Wings, Engine, Fuel, Body, Coin multiplier.
   - Each track shows its tier dots, the next price, and a kid-friendly effect
     line, for example "Wings 3 → glide further".
   - Buying a tier swaps the part on the model straight away, with a sparkle
     and a sound.
   - The level's coin wallet is shown, with a big **Launch!** button.
3. **Launch.**
   - The chase camera sits behind the plane in the slingshot.
   - **Touch or mouse:** drag back to aim (up/down/left/right). The drag
     distance sets the power, capped by the Launcher tier. Release to fire.
   - **Keyboard:** arrows aim, holding Space pulls, releasing Space fires.
4. **Flight.**
   - **Steering:** dragging anywhere, or arrows/WASD, pitches the plane and
     banks it. Releasing makes it level itself.
   - **Engine:** burns fuel automatically. The boost button, or Shift, burns
     fuel faster for more push.
   - **HUD:**
     - a fuel bar
     - a distance bar running from start to finish, with a marker at the best
       distance
     - the flight's coins
     - the bump shields left
5. **Results.**
   - Shows the distance reached, the pickup coins, the multiplier and the
     total earned.
   - Shows "New best!" when the record is beaten, and an "Almost there!" hint
     within 10% of the finish.
   - Buttons: **Upgrade** goes to the hangar, **Fly again** goes back to
     launch.
6. **Finish.**
   - Crossing the finish line plays confetti and a "Level complete!" card, and
     unlocks the next level.
   - The flight keeps going until it ends normally, and the results screen
     follows.

### Replay and Restart

- **Replay** a finished level: the player goes back to its hangar with all
  upgrades and coins kept.
- **Restart** a level: its tiers, coins, best distance and finished flag are
  reset to zero.
  - Other levels are untouched.
  - Unlocks stay unlocked, so restarting the Meadow does not lock the Canyon.

### Money

- Each level has its own coin wallet and its own plane, with its own tiers.
- Coins never move between levels.

## 2. Architecture

The game is a standalone sibling of Ship Builder. It imports general-purpose
Ship Builder modules and never changes them, so building Plane Builder never
triggers a Ship Builder release.

### `lib/plane-builder/` (pure TypeScript, no React or three.js)

- `levels/`
  - `types.ts`, plus `meadow.ts`, `canyon.ts` and `mountains.ts`.
  - Each `LevelDef` holds:
    - `id`, `name`
    - `finishDistance`, `corridorHalfWidth`
    - `terrain`: a seeded height function's parameters
    - `obstacles: {kind, position, size, hard}[]`
    - coin trails and rings
    - wind zones and updrafts
    - `plane`: the level's tier catalog
    - a palette
  - Contents are generated from a fixed seed with a seeded PRNG, so every
    session gets the same level. No `Math.random`.
  - `index.ts` exports `LEVELS` in order.
- `plane/`
  - `catalog.ts`: tier types. `TrackId` is
    `launcher | wings | engine | fuel | body | multiplier`, with 8 tiers per
    track.
  - Each tier has a `price` and stat contributions.
  - `stats.ts`: `planeStats(level, tiers): PlaneStats`, where `PlaneStats` is
    `{launchPower, lift, thrust, fuel, drag, shields, multiplier}`.
- `sim/`
  - A fixed-step flight sim (`STEP = 1/60` s) that gives the same result
    every run.
  - **Inputs:** `PlaneStats`, `LevelDef`, the launch aim and power, and stick
    input `{pitch, bank, boost}` each tick.
  - **Each step:**
    - gravity, and lift proportional to speed squared × the lift stat
    - drag, and thrust while there is fuel
    - pitch clamped to ±35°, and banking turns the heading
    - auto-level when there is no input
    - soft corridor walls: a crosswind toward the middle that grows past the
      edge
    - wind zones and updrafts
    - collisions against obstacle boxes and spheres, and against the terrain
      height
  - **Output:** a `FlightPose` with position, orientation, speed, fuel,
    shields, coins, distance, and `done`.
  - **Events:** `coin`, `ring`, `bump`, `shield`, `crash`, `landed`, `finish`,
    `stalled`.
  - Includes a `README.md` like Ship Builder's sim README.
- `economy/`
  - `payout(distance, coins, multiplier)`, with a guaranteed minimum payout.
  - `buy(progress, levelId, track)`, which returns new progress or an error
    reason.
  - Prices rise about 1.5× per tier.
- `balance/`
  - A scripted "average pilot" that launches at full power at a fixed angle,
    flies straight and boosts early.
  - Between flights it buys the upgrade that adds the most distance per coin.
  - It repeats until it crosses the finish and reports the number of flights
    and each flight's earnings.
  - Used by the balance tests and as a tuning tool.
- `state/`
  - A zustand store holding the screen, the current level, progress, and the
    last flight's result.
  - Stick and boost input that changes every frame lives in a separate mutable
    module, like Ship Builder's `sailInput`, and stays out of the store.
- `persist/`
  - `schema.ts`: a versioned `SaveV1` with `{version, levels: Record<LevelId,
{tiers, coins, best, finished}>, unlocked}`, and `parseSave` with a
    migration hook.
  - `local.ts`: one key, `plane-builder:save`. An unreadable save is copied to
    `plane-builder:save:backup:<ts>` and the game starts fresh, the same
    pattern as Ship Builder.
- `version.ts` (`PLANE_BUILDER_VERSION`), `changelog.ts`, `testHooks.ts`.

### `components/plane-builder/`

- `PlaneBuilder.tsx`: a client root that switches between screens and wraps
  them in the WebGL check.
- `scene/`
  - the terrain mesh, built from the level's height function
  - obstacle meshes, coins and rings, and the finish gate
  - `PlaneModel`, built from the parts of the owned tiers in simple shapes
  - the slingshot model, which follows the Launcher tier
  - the chase camera, and the sky and clouds
  - `FlightRunner`, which steps the sim inside `useFrame` (with a capped time
    step) and copies the pose onto the meshes
  - the hangar turntable scene
- `ui/`: `LevelSelect`, `Hangar`, `UpgradeTrack`, `LaunchOverlay`, `FlightHud`,
  `Results`, `FinishCard`, and `ConfirmRestart`.
- `audio/`: plane cues (engine hum, coin, ring, bump, crash, launch, cheer),
  built on Ship Builder's `audio/synth.ts`.

### Routes and site links

- `app/plane-builder/page.tsx` and `app/plane-builder/versions/page.tsx`.
- Added to `app/sitemap.ts`, the design1 `Hobbies.tsx` and
  `commandResponses.tsx`, and an analytics site tab in the admin `Dashboard`.

### Borrowed from Ship Builder (import only)

- `createStoredSetting`, `useWebGLSupport` and `usePrefersReducedMotion`
- the test-hook pattern

Ship Builder's synthesizer, `WebGLFallback`, `SkyDome` and `Clouds` are tied
to ships (sea-trial cues, ship text, the sea environment), so Plane Builder
has its own small versions that follow the same patterns.

## 3. Flight feel, planes and numbers

Every value here is a starting point that the balance script tunes.

### Physics

- **Launch:** the slingshot sets the starting speed (power × the
  `launchPower` stat) and the angle you aimed at.
- **Lift:** grows with speed and the lift stat. Below the stall speed the nose
  drops, which gives a gentle glide down, never a sudden drop.
- **Engine:** thrust runs while there is fuel. Boost gives 2× thrust and 3×
  fuel burn.
- **Drag:** falls as the Body tier rises.
- **Steering:** pitch is limited to ±35°. Bank turns the heading. With no
  input, the plane eases back to level.
- **Corridor:** past `corridorHalfWidth`, a crosswind pushes the plane back
  toward the middle.

### Ending a flight

- **Landed:** the plane touches the ground while slow and fairly level. It
  slides to a stop and the flight ends.
- **Crash:** a hard obstacle, or the ground at a steep angle or high speed,
  spends a shield if one is left, with a wobble and a short period where
  further hits are ignored. With no shields left, the plane crashes: parts
  scatter and the flight ends.
- **Soft obstacles** (trees, birds, balloons): they cost speed and shake the
  camera. They never end the flight.
- **Stalled:** less than 1 m of forward progress in 3 s ends the flight.

### Pay and distance

- Pay is for **progress toward the finish**: the furthest forward distance
  reached, not the total path flown.
- A flight earns `(distancePay + coins) × multiplier`, never less than the
  minimum.

### Planes per level (each tier is visibly different)

- **Meadow:** a folded paper plane → a balsa glider → a glider with a little
  propeller.
- **Canyon:** a propeller plane, from a single wing → a biplane → a twin
  engine.
- **Mountains:** a jet, from a trainer → swept wings → afterburners.
- **Slingshot:** wood → metal → a powered catapult, following the Launcher
  tier.

### Levels

| Level     | Finish | Features                                                  |
| --------- | ------ | --------------------------------------------------------- |
| Meadow    | 2 km   | rolling hills, trees (soft), a barn (hard), rings, coins  |
| Canyon    | 4 km   | canyon walls (hard), rock arches, updrafts, birds (soft)  |
| Mountains | 6 km   | peaks (hard), crosswinds, a narrow pass before the finish |

### Balance targets

These are enforced by tests.

- Every level takes **30–40 flights** for the average pilot.
- Until every track is maxed, each flight earns at least the price of the
  cheapest upgrade left.
- A starter plane (all tiers 0) lands at about 5% of the finish and never
  reaches it.
- Best distance never gets worse by more than 10% from one flight to the next
  for the average pilot.

## 4. Errors, testing and scope

### Errors and edge cases

- **No WebGL:** `WebGLFallback`.
- **Unreadable or newer save:** back it up and start fresh.
- **Tab hidden:** the flight pauses. The time step is capped at 0.1 s, and the
  sim sub-steps at `STEP`.
- **Leaving mid-flight:** that flight's earnings are lost and nothing else
  changes.
- **Restart:** needs confirmation and can't be undone.

### Testing

- **Unit tests (Jest):**
  - the sim gives the same result twice from the same inputs
  - lift, drag and fuel behave as expected
  - landing vs crash, shields, soft hits, the corridor wind, the stall stop
    and the finish event
  - `planeStats` combining tiers, payout and buy
  - save parsing with fixtures, and the backup when a save can't be read
  - Replay and Restart do what they say
  - the version and changelog agree
- **Balance tests** for the targets in section 3.
- **Playwright:**
  - a smoke test (`@smoke`): load, buy an upgrade, launch, see results,
    reload and confirm the progress was kept
  - a test hook that forces a finish and checks the next level unlocks
  - touch launch and steering on the iPad project
  - visual snapshots of the hangar and the flight HUD

### Scope of 1.0.0

- **In:** 3 levels, 6 tracks × 8 tiers, Replay and Restart, saving, sound,
  keyboard, mouse and touch, light and dark mode on the menu screens, the
  Versions page, site links, and the analytics tab.
- **Out:**
  - share links
  - PWA install
  - ghost replay (only a best-distance marker)
  - more levels
  - music

### Release rule

A "Plane Builder releases" section in CLAUDE.md, matching the Ship Builder
rule:

1. Bump `PLANE_BUILDER_VERSION` in `lib/plane-builder/version.ts`.
2. Add a matching entry at the top of `CHANGELOG` in
   `lib/plane-builder/changelog.ts`.
