# Planet Smasher 1.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship 1.3.0:

- a sim-tuned star path;
- arsenal tabs;
- a next-unlock bar;
- three new worlds;
- wreck counts in the planet picker;
- a first-play hint.

**Spec:** `docs/superpowers/specs/2026-11-14-planet-smasher-1.3-design.md`. The
base constraints come from the 1.0–1.2 specs in the same folder.

## Global Constraints

- Repo conventions are in `CLAUDE.md`. Copy existing patterns:
  - `ui/PlanetPicker.tsx`, `ui/Arsenal.tsx`, `ui/UnlockToast.tsx`, `ui/TrophyShelf.tsx`;
  - `scene/planetTextures.ts` (`marsWorld`, `iceWorld`);
  - `scene/Planet.tsx` (`ATMOSPHERE`).
- Kids are 6 and 8, on an iPad mini 6:
  - icon-first;
  - tiles ≥ 64 px;
  - no horizontal scroll in the tray at 1180×820 or 820×1180.
- Old saves (1.0, 1.1 and 1.2) must load. `unlocksBetween` only celebrates
  thresholds crossed by a hit, so a save already past items on the new path just
  has them, with no toasts.
- Commit per task. The message ends with a blank line, then
  `AI-assisted: written with Claude Code.`. Don't push.
- Version `1.3.0`, with a top changelog entry (Task 5).

## Review Focus

1. **Old save with 13,000 stars.**
   - Loads with no toast flood.
   - Every item at or below 13,000 on the new path is unlocked.
   - A saved `planetId` or `toolId` that is now locked falls back safely.
   - Owned by Task 2; test it.
2. **Tabs with a selected tool.**
   - The selected tool's tab is the one shown on load.
   - Selecting a tool through the test hook switches tabs.
   - Owned by Task 3; test it.
3. **The next-unlock bar at the end of the path.**
   - It shows a "everything unlocked" state (a 🏆 and the stars total), not NaN
     or an empty bar.
   - Owned by Task 2; test it.
4. **New planets in every system.**
   - Collision body: on a non-Earth planet, the body is Earth.
   - The Moon ram brings its own moon.
   - Population grid, atmosphere, `endedByPlanet` and trophies all work.
   - Owned by Task 4; test it.
5. **Simulator determinism.** Same seed gives the same trace. Owned by Task 1;
   test it.

---

### Task 1: Progression simulator, scorecard, lab notebook (baseline)

**Files:**

- Create: `lib/planet-smasher/sim/{simulate,bots,scorecard}.ts`
- Create: `lib/planet-smasher/sim/__tests__/sim.test.ts`
- Create: `scripts/planet-smasher-sim.ts`, run with `npx tsx scripts/planet-smasher-sim.ts`. Check that `tsx` exists in node_modules; otherwise use the same runner the repo's other scripts use (look in `package.json` scripts and `scripts/`).
- Create: `docs/planet-smasher/lab-notebook.md`

**What it models:** a player wrecking planets one after another, using the **real**
rules through the real store (`useGameStore`, `hit(toolId, u, v, now, fireId)`,
`newPlanet`, `selectPlanet`, `endingShown`), with simulated time.

- **Population grid:** a synthetic, seeded `PopulationGrid` (256×128). Use
  clustered "cities" (about 40 gaussian blobs) over a 0.02 floor, so hits on
  blobs kill many people and hits elsewhere kill few. Use the same grid for
  every planet.
- **Time model:**
  - Each fire happens at `max(prev + tapGap, toolReadyAt)`.
  - The effect's impact lands after a per-tool flight delay, from a table in
    `simulate.ts`.
  - For multi-impact tools, the impacts are spread over the effect's duration
    with the counts from the tool table: meteor 10, nukeTwin 2, nukeRain 6,
    ufoSwarm 12, nanobots 40, monster 6, tsunami 16, laser 8 per second of
    hold.
  - Use fireIds exactly as the game does: one per fire.
  - The ending takes 4 s, then the New planet button is pressed after 2 s more.
- **Bots** (`bots.ts`), each `pickTool(unlocked: ToolId[], rng)`:
  - `nukeLover`: picks the highest nuke-family tool unlocked 70% of the time,
    otherwise the newest unlocked tool. tapGap 0.5 s.
  - `explorer`: cycles through the unlocked tools, newest first. tapGap 0.9 s.
  - `casual`: random unlocked tool. tapGap 1.5 s. Switches planet to a random
    unlocked one every 3 planets.
  - Aim: 60% of the time at a random blob centre, otherwise uniformly random.
- **Trace:** for each bot, an array of `{ t, kind: "tool"|"planet"|"trophy", id }`
  unlock events, the planets wrecked, the stars over time (sampled every 30 s),
  and the time to unlock everything.
- **Scorecard** (`scorecard.ts`), with metrics per bot. Each has a target band, a
  gate and a weight:

  | metric                                             | target band | gate  | weight |
  | -------------------------------------------------- | ----------- | ----- | ------ |
  | firstUnlockSec                                     | ≤ 60        | ≤ 120 | 15     |
  | maxGapMin (first 90 min, any new thing)            | ≤ 5         | ≤ 8   | 25     |
  | allToolsMin                                        | 60–90       | ≤ 150 | 25     |
  | nukeFamilyByMin (nuke+twin+rain all unlocked)      | ≤ 25        | ≤ 45  | 15     |
  | alienByMin (laser+ufo+gravity+nanobots+mothership) | ≤ 70        | ≤ 110 | 10     |
  | newThingsFirst30Min                                | ≥ 8         | ≥ 5   | 10     |
  - Inside the band a metric scores full points, and it falls off linearly to 0 at
    the gate. The total is 0–100.
  - If any gate fails, cap the total at 59.
  - Report a score per bot and the mean, and print the worst metric.

- **The script** runs the 3 bots × 3 seeds for 150 simulated minutes. It prints a
  table and writes `docs/planet-smasher/sim-latest.json`.
- **Lab notebook:** create `docs/planet-smasher/lab-notebook.md` with:
  - a header explaining the method (a short version of the fun-loop skill);
  - Gentry's directions so far, quoted:
    - "They reach for nukes a lot. They want tons more alien tech."
    - "rethink gameplay, progression, design, capabilities".
  - **Round 0, baseline:** the current path's score table and the worst metrics.

Steps:

- [ ] **Step 1: Write the failing test** (`sim.test.ts`):
  - the same seed gives an identical trace (deep equal);
  - `scorecard` on a hand-made trace with first unlock at 30 s and a max gap of
    4 min scores those metrics in full;
  - a gate failure caps the total at 59;
  - the simulation of 10 minutes with the explorer bot unlocks at least
    `meteorShower`.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=planet-smasher/sim`. Expect
      FAIL.
- [ ] **Step 3: Implement.** The sim must not import React or three. If
      `store.ts` pulls in browser-only modules, inject `localStorage` as null (progress
      already supports a null storage).
- [ ] **Step 4: Run** the script. Paste the baseline table into the notebook as
      Round 0.
- [ ] **Step 5: Commit** `feat(planet-smasher): progression simulator and lab notebook`.

---

### Task 2: Retune the star path + next-unlock bar

**Files:**

- Modify: `lib/planet-smasher/unlocks.ts`, `docs/planet-smasher/lab-notebook.md`
- Create: `components/planet-smasher/ui/NextUnlock.tsx`
- Modify: `ui/Hud.tsx` (mount), `ui/EndingOverlay.tsx`
- Test: `lib/planet-smasher/__tests__/unlocks13.test.ts`, `ui/__tests__/NextUnlock.test.tsx`

**Starting path** (stars). The tool and planet ids for the new worlds are
`lava`, `candy` and `ocean`. Task 4 adds them to `PlanetId`. In this task, add
the three ids and specs to `planets.ts` with placeholder textures: reuse
`marsWorld` for lava, and `iceWorld` for candy and ocean, so it compiles. Task 4
replaces them.

```
meteorShower 25, megaBomb 80, nuke 160, alienLaser 300, nukeTwin 480, supervolcano 700,
ufoSwarm 950, planet lava 1250, earthquake 1550, nukeRain 1900, gravityBeam 2300,
planet mars 2700, tsunami 3150, freezeRay 3650, nanobots 4200, planet candy 4800,
monster 5450, moonRam 6150, blackHole 6900, planet ice 7700, mothership 8550,
planet ocean 9450, sunDive 10400, planetCollision 11500
```

Planet specs (verbatim):

| id    | name      | icon | population    | peopleIcon | hasMoon |
| ----- | --------- | ---- | ------------- | ---------- | ------- |
| lava  | Magmar    | 🌋   | 600_000_000   | 🔥         | false   |
| candy | Sweetopia | 🍭   | 2_500_000_000 | 🍬         | false   |
| ocean | Aquaria   | 🌊   | 1_200_000_000 | 🐙         | false   |

`PLANET_ORDER`: earth, lava, mars, candy, ice, ocean.

**Then run the fun loop for up to 3 rounds** with the simulator:

- Run it and read the worst metric.
- Adjust only the `at` values (ordering may move, but keep the nuke family and
  the aliens early).
- Re-run, and append each round to the notebook: the hypothesis, the change,
  the before/after table and the keep/revert decision.
- Stop when the mean score is ≥ 85 with no gate failing, or after round 3.
- If the economy, not the path, is the blocker (for example a planet pays too
  little), note it in the notebook as a bold idea. Don't change damage or point
  rules in this task.

**NextUnlock**:

- Subscribe to `progress.points`.
- Show the `nextUnlock(points)` item's emoji as a dark silhouette (CSS
  `grayscale brightness-0` with a light outline/drop-shadow so it reads on
  black), a 120 px bar, and the label `⭐ {points} / {at}` with comma grouping.
  Place it under the points chip, top-right.
- When there's no next unlock: 🏆 and "All unlocked!".
- **EndingOverlay:** show the same bar, animating from the pre-ending points to
  the current points over 1.2 s.

Steps:

- [ ] **Step 1: Write the failing tests.**
  - `unlocks13`: the path is strictly ascending; it includes all 20 tools minus
    asteroid, plus 5 planets; `nextUnlock(0)` is meteorShower; a 1.2 save with
    13,000 points loads with every item ≤ 13,000 unlocked and
    `lastUnlocks` empty after `init`.
  - `NextUnlock`: at 100 points it shows the megaBomb silhouette and
    "⭐ 100 / 160"; at 20,000 it shows "All unlocked!".
- [ ] **Step 2: Run.** Expect FAIL.
- [ ] **Step 3: Implement the path, the placeholder planets and the bar.**
- [ ] **Step 4: Run the tuning rounds.** Tests, type-check and lint pass.
      Screenshot the bar in the HUD and on the ending overlay.
- [ ] **Step 5: Commit** `feat(planet-smasher): sim-tuned star path and next-unlock bar`.

---

### Task 3: Arsenal tabs

**Files:**

- Modify: `lib/planet-smasher/tools.ts` (add `category`), `ui/Arsenal.tsx`
- Test: `ui/__tests__/Arsenal.test.tsx` (rewrite for tabs)

`ToolSpec.category: "space" | "bombs" | "nature" | "aliens"`. Exported
`CATEGORIES` (tab order, verbatim):

- space 🌠 "Space": asteroid, meteorShower, moonRam, blackHole, sunDive, planetCollision
- bombs 💣 "Bombs": megaBomb, nuke, nukeTwin, nukeRain
- nature 🌋 "Nature": supervolcano, earthquake, tsunami, freezeRay, monster
- aliens 👽 "Aliens": alienLaser, ufoSwarm, gravityBeam, nanobots, mothership

Arsenal layout:

- **Tab row.** Above the tiles, 4 round tab buttons (56 px) with the category
  emoji. The active tab has a ring. `aria-label` is the category name.
- **Tiles.** Only the active tab's tools appear, in the order above, as a single
  row with no scroll. Tiles are 72 px, or 64 px below `sm`.
- **Fresh-unlock dot.** A tab with a fresh, untapped unlock (`freshItems`) shows
  a pulsing dot.
- **Locked tiles.** Keep the 🔒 and star cost, and add a thin conic progress ring
  of `points/at`. Write the angle through a ref and a CSS variable, as the
  cooldown sweep does.
- **Active tab.**
  - On load, it's the tab of the selected tool.
  - Selecting a tool from anywhere (the test hook, a restore) switches to its
    tab.
  - Tapping a tab only switches the tab; the selected tool stays.
- **Unlock jump.** When an unlock toast shows a tool, the tray switches to that
  tool's tab and highlights the tile.

Steps:

- [ ] **Step 1: Write the failing tests.**
  - 4 tabs render.
  - The Bombs tab shows 4 tiles.
  - A restored `toolId` of "ufoSwarm" opens the Aliens tab.
  - Tapping the Space tab shows asteroid first.
  - Every `TOOL_ORDER` id belongs to exactly one category.
  - A fresh unlock in Aliens shows a dot on the Aliens tab.
- [ ] **Step 2: Run.** Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Check.**
  - Tests, type-check and lint pass.
  - Screenshots at 1180×820 and 820×1180: no scroll, tabs visible, locked rings
    visible.
- [ ] **Step 5: Commit** `feat(planet-smasher): arsenal tabs`.

---

### Task 4: Three new worlds + wreck counts

**Files:**

- Modify: `scene/planetTextures.ts` (`lavaWorld`, `candyWorld`, `oceanWorld`), `scene/Planet.tsx` (`ATMOSPHERE` entries), `ui/PlanetPicker.tsx`, `scene/endings/collisionBody.ts` (verify)
- Test: `scene/__tests__/planetTextures13.test.ts`, `ui/__tests__/PlanetPicker.test.tsx`

Procedural, seeded 1024×512 worlds. Copy the structure of `marsWorld` and
`iceWorld`: value noise, settlement blobs for population, and a night canvas
with warm dots.

- **Magmar (lava):**
  - Black-red basalt crust with bright orange-yellow lava rivers (noise
    thresholded into veins).
  - The lava gets a strong glow; reuse the glow path the planet already
    supports, or paint the veins brighter.
  - Atmosphere: hot orange.
  - Settlements on the dark crust.
- **Sweetopia (candy):**
  - Pastel pink, mint and lemon swirled bands (sine of noise).
  - Chocolate-brown "seas" and sprinkle dots.
  - Atmosphere: pink.
  - Settlements as candy-coloured blobs.
- **Aquaria (ocean):**
  - Deep teal ocean covering about 85%, with small sandy-green islands
    (noise thresholded high) and white reef rings.
  - Atmosphere: aqua.
  - Settlements on the islands only, so most taps in open ocean kill few. That's
    intended: the tsunami and nanobots shine here.

PlanetPicker: each planet bubble shows a small `💥 N` badge from
`progress.stats.endedByPlanet[id]`, hidden when it's 0.

Check that every per-planet map covers the new ids. TypeScript should force
this; also grep for `PlanetId` records:

- `collisionBody`: non-Earth → earth;
- Moon ram: `hasMoon` false brings its own moon;
- trophies: only mars and ice have trophies. Don't add new ones.

Steps:

- [ ] **Step 1: Write the failing tests.**
  - Each new world generator is deterministic (same pixels for two calls; sample
    a few pixels).
  - Population weights sum to 1.
  - Aquaria has more than 70% of its weight on less than 20% of cells.
  - The PlanetPicker shows "💥 3" for `endedByPlanet.lava` = 3, and no badge for 0.
- [ ] **Step 2: Run.** Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Check.**
  - Tests, type-check and lint pass.
  - Screenshots of each new world (unlockAll, then select through the picker),
    plus one nuke on each.
  - The new worlds must look distinct and appealing.
- [ ] **Step 5: Commit** `feat(planet-smasher): Magmar, Sweetopia and Aquaria`.

---

### Task 5: First-play hint + release 1.3.0

**First-play hint.** Show `ui/TapHint.tsx` while `progress.points === 0` and
there has been no hit this session:

- a big 👆 pulsing over the planet centre (`@keyframes ps-tap` in globals.css);
- a short "Tap!" under it;
- `pointer-events-none`;
- it disappears on the first `lastHit` or when points are > 0.

Test: it renders at 0 points and hides after a store hit.

**Release.**

- Version `1.3.0`, changelog dated 2026-11-14, titled "New worlds and a faster
  path!". Kid-word highlights:
  - three new worlds;
  - the tools sorted into tabs;
  - a bar that shows your next unlock;
  - nukes and alien tech unlock much sooner;
  - wreck counts on each planet.
- e2e (chromium):
  - Update the existing tests for tabs. Tools are now found by switching tabs:
    use the aria-labels.
  - Add a test: pick each new world through the picker after `unlockAll`, fire a
    nuke, and see the population drop with no page errors.
- Build and run as before:
  - `NEXT_PUBLIC_E2E=1 npx next build --webpack`, then
    `E2E_PREBUILT=1 npx playwright test e2e/planet-smasher.spec.ts --project=chromium`;
  - the full jest suite.
- Append a final notebook entry: the shipped path's score, and next ideas.
- Commit `feat(planet-smasher): release 1.3.0`.
