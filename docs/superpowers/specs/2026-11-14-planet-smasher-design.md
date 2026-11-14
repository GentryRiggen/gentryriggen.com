# Planet Smasher — design

Date: 2026-11-14 · Status: approved

## Intent

A new 3D game on gentryriggen.com for Gentry's sons, ages 6 and 8, played on
their iPads. It's in the spirit of Solar Smash and the planet-destroyer games
they already enjoy: pick a planet, then wreck it with a growing arsenal of
space rocks, bombs, natural disasters, alien tech and moon collisions.

**The main show is watching the planet get destroyed in many different
ways.** Progression exists so they keep reaching for bigger, wilder tools. It
is not meant to make them grind.

## Goals

- Every tool looks and sounds different and is worth firing just to see what
  it does.
- Damage builds up and stays visible. Small hits leave marks: craters,
  scorch, burning cities, cracks, lights going dark. Past a threshold, the
  planet reaches a dramatic ending.
- A big population counter, the full 10-digit number, rolls down like an
  odometer as hits land. It is the score. Gentry asked for the full
  animated number, not a shortened "7.3 billion".
- An unlock path: the first new tool comes within a minute or two, and the
  big finishers come later.
- It plays well with fingers on an iPad. A 6-year-old can play without
  reading.

## Non-goals (v1)

- No accounts, leaderboards or cloud saves. Progress lives on the iPad.
- No multiplayer.
- No gameplay analytics yet. `trackGame` needs schema, rules and dashboard
  edits; that's a follow-up once the game settles.
- No free sandbox mode with everything unlocked. Could come later as a
  parent toggle.

## Anti-goals (a failure even if it works)

- **Gore or depicted people.** Population is a number only. Damage shows as
  fire, darkened cities and craters, never bodies or screaming.
- **Reading walls.** Anything a 6-year-old needs is an icon, an animation or
  a number.
- **Grind or dead time.** No energy meters or waiting. The starter tools
  never run out.
- **Stutter on iPad.** Choppy explosions kill the spectacle.
- **Purchases, ads or nag screens.**

## Constraints

- It lives in this repo as a static export: Next.js 16, React 19, React Three
  Fiber and three.js, the same stack as Ship Builder and Plane Builder. No
  server.
- Route `/planet-smasher`, a full-screen, add-to-home-screen app with its own
  webmanifest and apple-web-app metadata, scoped to that route as Ship Builder
  does (`app/ship-builder/page.tsx`). It **works offline** once added, with
  its own service worker on the Ship and Plane Builder pattern
  (`public/ship-builder-sw.js`), caching the textures. _(Builder-check call:
  match the sibling games.)_
- Any textures must be public domain or licensed for reuse (for example NASA
  Blue Marble and Black Marble city lights).
- Tailwind for the UI chrome. Repo conventions apply (see CLAUDE.md).
- It's a release-tracked game like Plane Builder: `PLANET_SMASHER_VERSION`,
  a `CHANGELOG`, a `/planet-smasher/versions` page and the
  version/changelog test. 1.0.0 is the first release; until it ships, keep
  editing the 1.0.0 entry instead of bumping.

## Approaches considered

- **A. Painted damage and a pre-cracked planet (chosen).** The planet is a
  globe. Hits paint into damage maps and dent the surface. Each weapon is its
  own hand-made effect. At the threshold, the globe swaps to a version that's
  already cut into chunks, which fly apart. It runs smoothly on iPad and every
  weapon gets its own show. Breakups follow a few prepared crack patterns
  rather than being truly unique.
- B. True physical destruction (thousands of chunks, real physics). Rejected:
  it would stutter on iPad, look blocky and take much more work.
- C. A 2D game. Rejected: it loses the spinning-globe wow, which is the whole
  point.

Gentry picked A.

## How it plays

### Screen (iPad landscape first; portrait must still work)

```
┌──────────────────────────────────────────────────────────────┐
│ 🌍 7,912,334,120  ↓ (rolling)          ⭐ 1,240 pts   ⚙       │
│ ████████████░░░░  planet health                               │
│                                                              │
│                    [ spinning Earth ]                        │
│              drag = rotate · pinch = zoom · tap = fire       │
│                                                              │
│ ┌──────────────────── arsenal (scrolls) ───────────────────┐ │
│ │ ☄️  🌠  💣  ☢️  🌋  ⚡  🌙  🔒  🔒  🔒                    │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- Big icon tiles, at least 64px. Locked tiles show a lock and the point
  cost as a number.
- A **tap on the planet fires** the selected tool at that spot. A drag
  rotates the planet and a pinch zooms. A tap must not fire after a drag
  (the usual threshold).
- Some tools keep firing while you hold (the laser beam sweeps, the meteor
  shower rains). The rest fire once per tap, with a short per-tool cooldown
  so taps can't be spammed into a frame-rate collapse.
- The population counter is the hero number: a 10-digit odometer whose digits
  roll as people are lost, with a little red "−1,204,883" pop-off near the
  hit.

### Tools (v1 arsenal, in unlock order; costs are the builder's to tune)

| #   | Tool               | What you see                                        | Ending it drives     |
| --- | ------------------ | --------------------------------------------------- | -------------------- |
| 1   | Asteroid (free)    | rock streaks in, flash, crater + ring of fire       | shatter              |
| 2   | Meteor shower      | many small streaks over an area, pockmarks          | shatter              |
| 3   | Mega bomb          | bright flash, shockwave ring, scorched crater       | molten               |
| 4   | Nuke               | mushroom glow, big shockwave, cities go dark wide   | molten               |
| 5   | Supervolcano       | ground bulges, erupts, lava spreads, ash cloud      | molten               |
| 6   | Earthquake crack   | a glowing crack zips across the crust and widens    | shatter              |
| 7   | Alien laser (hold) | a beam from a saucer above, carves a glowing trench | molten               |
| 8   | Freeze ray         | ice spreads across the oceans and land              | frozen               |
| 9   | Moon ram           | the Moon swings in from orbit and smashes in        | shatter (finisher)   |
| 10  | Black hole         | a tiny black hole lands, pulls the crust in         | swallowed (finisher) |

The Moon ram and the Black hole are **finishers**. They always push the planet
past the threshold, at the top of the unlock path.

### Damage and the threshold

- The planet has **health** (100% → 0%). Each hit takes off its tool's
  power, scaled down when the hit lands on an already wrecked area so a
  single spot can't be farmed.
- **Below the threshold** the damage only marks the planet. Marks stay for
  the rest of that planet: craters and dents, scorch, lava, ice, cracks, and
  city lights going out on the night side.
- **At 0% health** an ending plays. Which one depends on which family of
  tools did most of the damage, and a finisher overrides that:
  - **Shatter**: the planet cracks along glowing seams and bursts into
    tumbling chunks and debris.
  - **Molten**: the crust goes red-hot and turns into a glowing lava ball.
  - **Frozen**: it frosts over, then cracks and splinters like ice.
  - **Swallowed**: it stretches and spirals into the black hole and is gone.
- After the ending, a big **New planet** button rebuilds Earth, or the
  selected planet, fresh, with a quick reform effect.

### Population

- Earth starts at about 8,000,000,000. Each hit removes people based on how
  much populated area it covers, using a low-res population map baked from
  the city-lights texture. Oceans cost almost nothing, cities a lot. At an
  ending the counter rolls down to 0.
- Other planets have made-up silly populations: "Martians: 3,000,000", and so
  on.

### Progression

- **Destruction points** are their own small numbers, not people lost. A
  hit earns points for the _share_ of the planet's population it removes
  (for example 1% of the population = 10 pts), so Earth and Mars pay the
  same. Each ending pays a bonus on top. _(Builder-check call.)_ The first ending of each type pays extra, which
  pushes them to try every ending.
- Points unlock tools in a fixed order, cheapest first. The first unlock
  should come within about two minutes of play, and the full arsenal over a
  few sessions.
- **Planets** unlock later: Earth (start), then Mars, then an ice planet,
  priced near the finishers. _(Builder-check call: v1 keeps to rocky planets
  so every tool and ending works unchanged. A gas giant would need its own
  effects, so it's a later idea.)_ Each planet reuses the damage system with
  its own textures, colours, population name and population map (painted
  "settlement" spots on Mars and the ice planet, since they have no real
  city lights).
- Unlocking is a celebration: the tile flies into the tray with a sound and
  a little "NEW!" sparkle.
- Saved in localStorage: points, unlocks, which endings have been seen,
  the selected planet and the sound setting. Damage is not saved: every
  visit starts with a fresh planet.

### Sound

Every tool has its own whoosh and boom, and every ending has a big stinger.
Use the shared `components/game-audio` primitives (synth based, like Ship
Builder). A sound on/off toggle stays visible. iOS needs a first tap to
unlock audio, as in `useSoundUnlock`.

## Technical shape (decided)

- A React Three Fiber scene. The planet is a sphere mesh with day and night
  textures, plus damage data that hits write into:
  - a **damage canvas** (or render target) painted per hit with scorch,
    lava, ice and crater stamps, blended in the planet shader. City lights
    are masked out where the planet is damaged.
  - **surface dents** for craters (vertex displacement or a height map,
    whichever performs on iPad).
- Weapon effects are separate short-lived effect components: projectile,
  flash, shockwave ring, particles and debris, pooled where needed.
- Endings use a planet that's **already cut into chunks** (generated at load
  or baked offline; builder's call), swapped in at the threshold and blown
  apart with simple scripted motion or light physics. That means no full
  physics engine.
- Plain game state (health, population, points, unlocks) lives outside
  React rendering so the counter and effects don't re-render the scene.

## Quality bar

- **Target device: iPad mini 6 (A15, 4 GB RAM, 2266×1488).** Cap the device
  pixel ratio at 2, keep textures at 4K or below (2K for the night/damage
  maps), and size particle and chunk counts for it.
- A smooth frame rate on an iPad during the busiest moments (meteor shower,
  nuke, endings). Add Planet Smasher scenes to `e2e/perf.spec.ts` and the
  perf budget like the other builders.
- Unit tests for the game rules: damage, threshold, which ending wins,
  population loss, points, unlock order and persistence. Playwright smoke
  tests (tagged `@smoke`, so they run on the iPad project) cover tapping to
  fire, a drag not firing, and reaching an ending.
- Before calling v1 done, Gentry plays it on an iPad (and ideally the boys
  do).

## Left to the builder

- Exact costs, power numbers, cooldowns and the points curve, within the
  pacing above.
- How the chunked planet is made, the shader details, particle techniques
  and texture resolutions.
- The visual style of the UI chrome, as long as it's bold, icon-first and
  works in the game's dark space setting. The game is always dark (space), so
  the site light/dark toggle doesn't apply inside the canvas. The chrome
  still follows repo conventions.
- Whether `/` links to the game.
