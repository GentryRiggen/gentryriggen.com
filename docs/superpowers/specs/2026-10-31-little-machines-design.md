# Little Machines: design

An original incremental game at `/little-machines`. In each universe you play
a little machine given one innocent goal, and you follow it much further than
anyone meant you to. Inspired by the genre of Universal Paperclips, but it is
not a remake: our own premises, mechanics, text and art.

## Why

Gentry loves the loop of watching numbers grow, buying an upgrade and feeling
how much faster things go, and the shock of a phase change where the game
becomes a different game. Players are mostly kids (same audience as Ship
Builder / Plane Builder); adult themes are fine if told subtly.

Tone arc: the first hour feels fun, positive and motivating (look how cool
this can get); the relentlessness and darkness creep in slowly later. "Ever
onward." is the machine's catchphrase in every universe.

## Goals

- The upgrade rush: something is always growing, the next upgrade is always
  close, and each upgrade is visibly felt (in the numbers and in the scene).
- Phases that change the mechanics, telling the story through those changes.
- A series of universes on one engine, open-ended: adding a universe is
  writing a new content module, not changing the engine.
- Prestige: replay any finished universe with permanent upgrades.
- First full run of universe 1 takes about 2 to 3 hours of active play.

## Non-goals (v1)

- Accounts, cloud saves, sign-in (later: anonymous by default, upgrade with
  an emailed code). v1 saves to localStorage on the device, like the other
  games.
- Universes 2-4 (Make It Grow, Build It Higher, Make Everyone Smile). The hub
  shows them as locked "coming soon".
- Offline progress. Gameplay analytics events (would need schema + rules).
- Sound (nice later).

## Anti-goals (would make it a failure)

- **Getting stuck.** No state may exist where the player cannot make
  progress. Every phase has a free manual action (tap the light) that always
  earns the phase's base income, regardless of fuel/money/power. Running out
  of a consumable slows you down, never stops you. A test enforces this (see
  Testing).
- Copying Universal Paperclips' text, project names, or progression.
- Dead time: a stretch longer than ~3 minutes with nothing affordable or
  nothing new appearing.

## Constraints

- Static export Next.js 16 site; client component for the game. Tailwind
  only (dynamic values go through SVG attributes, not `style`). Dark scene by
  default; the UI chrome must support light and dark mode.
- Pauses when the tab is hidden or closed (`document.visibilityState`); no
  catch-up on return. Ticks use real elapsed time while visible, clamped
  (max 1s per frame) so a background-throttled frame cannot jump.
- Save to localStorage with a version field, autosave every 10s and on
  `visibilitychange`/`pagehide`. Unreadable save: back it up and start fresh
  (same pattern as `lib/plane-builder/persist/local.ts`).
- Mobile first: scene top ~third, controls scroll below; on wide screens the
  scene can sit beside or above the controls.
- Release convention like Plane Builder: `LITTLE_MACHINES_VERSION` in
  `lib/little-machines/version.ts`, `CHANGELOG` in
  `lib/little-machines/changelog.ts`, a test that they agree, a Versions page
  at `/little-machines/versions`. First release is 1.0.0.

## Architecture

```
lib/little-machines/
  engine/        pure TS, no React: types, tick, buy, unlocks, phases,
                 prestige, number formatting, save/load
  universes/
    index.ts     registry: ordered list of UniverseDef (+ locked placeholders)
    light/       Keep the Light On content (data + small pure functions)
  version.ts, changelog.ts
components/little-machines/
  LittleMachines.tsx   hub (universe picker) + game shell, "use client"
  game/                controls, resource readouts, upgrade list, ticker,
                       phase transition overlay, prestige screen
  scenes/light/        SVG scene for Keep the Light On, one layer per phase
app/little-machines/page.tsx, app/little-machines/versions/page.tsx
```

### Engine model (builder may refine)

- `UniverseDef`: id, title, goal line, phases[], resources, upgrades,
  prestige upgrades, `tick(state, dt)` for continuous production,
  `manualAction(state)` per phase, story messages with trigger conditions,
  `isComplete(state)`.
- Numbers are plain JS doubles (late game goes to ~1e30+); format with
  suffixes (K, M, B, T, then named or scientific).
- Upgrades: cost (resource + amount, often scaling ×1.07-1.15 per level),
  `visibleWhen`, `effect`. Items appear (pop in) when visible, highlight when
  affordable.
- Phase transition: condition met → a short full-screen moment (camera pull
  back, a line or two of story), then new mechanics. Old resources that no
  longer matter are hidden.
- Prestige: on completion (and optionally on a manual restart after reaching
  phase 2+) award `embers` based on progress; spend on permanent upgrades
  stored outside the run state. A replay with upgrades should feel clearly
  faster (target: second run ~60% of the first).
- Save shape: `{ version, universes: { [id]: { run, best, completions,
embers, prestigeUpgrades } }, seenIntro }`.

## Universe 1: Keep the Light On

You are the robot that runs an old lighthouse. Your one job: keep the light
on. Target ~2.5h first run.

1. **The Coast (~40 min).** Tap to flash the light → guide a ship → coins.
   The lamp burns oil; oil price drifts up and down (buy low). With no oil
   the light still works by tapping (anti-stuck). Upgrades: lenses (more
   ships per flash), wicks (less oil per second), keepers (auto-flash),
   storms (occasional event: tap during a storm for a bonus or ships turn
   away), more lighthouses down the coast. End: whole coast lit, the town
   asks for streetlights.
2. **No More Night (~45 min).** Oil → power. Build generators, run lines,
   keep supply ≥ demand as cities light up (a city only pays while powered).
   A "Night remaining" meter ticks toward 0%. A news ticker mentions people
   sleeping badly, then gradually goes quiet. Manual action: crank the
   generator (always yields some power). End: night is gone, Earth's power
   is maxed → look at the sun.
3. **The Sky (~45 min).** Sun collectors, then self-copying probes to other
   stars (travel time, exponential growth). To keep the light on you take
   the stars: the scene's night sky visibly empties. Manual action: aim a
   collector (always yields some energy). End: no stars left to take.
4. **The Last Light (~20 min).** Mechanic flips: total energy decays; the
   player chooses which lights to let go dark so one stays lit. Ending
   reveals who it was for (builder writes it; tender, subtle, kid-safe —
   e.g. the very first ship you ever guided). Final tap ends the run →
   embers, prestige screen, "Universe 2 coming soon".

Story text: short, wry, kid-readable, adult subtext. Never gory or
hopeless; the ending is bittersweet.

## Visuals

Living scene (direction A from the mockups): flat shapes with glow, drawn in
SVG in code. Every upgrade shows up as something you can see (brighter or
wider beam, more ships, a keeper in the window, lighthouses down the coast,
floating +coins). Phase changes are camera moves: pull back to coast/planet
(2), to the solar system and stars (3), slowly back in to one light (4). New
controls pop in with a short scale/glow animation (`@keyframes` in
`app/globals.css`). Respect `prefers-reduced-motion`.

## Hub

`/little-machines` shows universe cards: Keep the Light On (playable,
progress/completions shown), three locked cards with names and goal lines
(Make It Grow, Build It Higher, Make Everyone Smile), and room for more.
Links: Versions page, back to the home site.

## Site wiring

Sitemap entry, a link in `components/designs/design1/Hobbies.tsx` and a
terminal command (`machines` / `little-machines`) in `commandResponses.tsx`,
like plane-builder.

## Testing

- Unit tests for engine (tick, buy, unlocks, phases, prestige, save/load,
  formatting).
- **Balance sim test**: a simple bot (taps at a human rate ~3/s for the
  first minutes, buys the cheapest useful affordable upgrade) plays
  Keep the Light On in simulated time and must finish between 1.5h and
  4h; a second run with prestige upgrades must be faster. It also asserts
  that no gap longer than 3 simulated minutes passes without a purchase or
  unlock.
- **Anti-stuck test**: from many states reached by the sim (and from
  adversarial states: zero coins, zero oil, zero power, every generator
  off), only manual actions for N simulated minutes must still reach the
  next purchase.
- E2E smoke (`e2e/little-machines.spec.ts`, added to a CI group): hub loads,
  start universe, tap the light, coins go up, buy an upgrade, reload keeps
  progress.

## Decided by Gentry

Original game in the genre (not a remake); universes open-ended; prestige
replays; pause when tab hidden; no accounts in v1, device save; living
scene look; ~2-3h runs; never stuck; ship to production fast.

## Builder's calls

Name "Little Machines", route, exact numbers and balance, upgrade list,
story text, ending, engine shape, file layout details.
