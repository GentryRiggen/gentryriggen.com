# Planet Smasher 1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Planet Smasher 1.1.0 with six new tools (Twin nuke, Nuke rain, UFO
swarm, Gravity beam, Nanobot swarm, Mothership), a Consumed ending, a combo
counter and a longer star path.

**Architecture:** Extend 1.0 in place. New entries go in `lib/planet-smasher/tools.ts`
and the unlock path, the combo goes in the store, each tool gets an effect
component registered in `EffectLayer`, and the new ending is registered in
`EndingStage`.

**Tech Stack:** As in 1.0: Next 16 static export, React 19, R3F 9, three 0.186,
zustand 5, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-planet-smasher-1.1-design.md` (1.1)
and `docs/superpowers/specs/2026-11-14-planet-smasher-design.md` (1.0 base: anti-goals,
constraints).

## Global Constraints

- Follow the repo conventions in `CLAUDE.md`. Read the existing file you're
  extending before you write, and copy its patterns: a new effect starts from the
  closest existing effect (`Blast.tsx`, `LaserBeam.tsx`, `MeteorShower.tsx`,
  `Projectile.tsx`).
- iPad mini 6 limits:
  - particles come only from the shared pools in `scene/effects/particles.ts`
    (≤ 600 live), with ≤ 12 live effects;
  - no `new Vector3`, `clone()` or array literals inside `useFrame`; use module or
    ref scratch objects;
  - dispose your geometries and materials on unmount;
  - use one `InstancedMesh` for repeated meshes (the 12 saucers, the 8 rock chunks).
- Every impact goes through the effect's `onImpact(u, v, point, opts?)`. Never
  call the store or the painter directly from an effect. `PlanetSmasher` already
  skips impacts when the phase isn't `"playing"`.
- No gore: UFOs beam up glowing light, never people.
- Release tracking: `PLANET_SMASHER_VERSION = "1.1.0"`, with a matching top
  `CHANGELOG` entry (Task 5).
- Commit per task with a conventional message ending in the trailer line
  `AI-assisted: written with Claude Code.`. Don't push.

## Review Focus

1. **The Consumed ending on a finished planet.** Nanobots keep spreading for 10 s.
   After the planet ends, or a New planet is made, they must stop stamping (Task 4
   test).
2. **Combo across a planet change.** The combo resets on New planet and on a planet
   switch, and the bonus is capped at ×10 (Task 1 test).
3. **The star path stays monotonic.** `UNLOCK_PATH` is sorted ascending,
   `unlockAll` reaches the last entry, and saved progress from 1.0 (with
   `endingsSeen` lacking "consumed") still loads (Task 1 test).
4. **UFO targeting on an empty area.** A tap in the ocean, or on an already wiped
   region, still picks targets (the nearest cells by population, falling back to
   points around the tap). It never returns an empty list or NaN (Task 1 test).
5. **Tray length.** 16 tiles still scroll at 820 px wide, and the selected tile
   scrolls into view when it's chosen (Task 2 visual check).

---

### Task 1: Rules: new tools, Consumed, combo, star path, targeting

**Files:**

- Modify: `lib/planet-smasher/tools.ts`, `unlocks.ts`, `damage.ts`, `progress.ts`, `store.ts`, `testHooks.ts`
- Create: `lib/planet-smasher/targets.ts`
- Modify (placeholders only, so the build stays green): `components/planet-smasher/scene/effects/EffectLayer.tsx`, `audio/sfx.ts` (`TOOL_CUES`), `ui/EndingOverlay.tsx` (`EMOJI`), `scene/endings/EndingStage.tsx`
- Test: `lib/planet-smasher/__tests__/{tools11,combo,targets,unlocks}.test.ts` (new or extended)

**Interfaces (Produces):**

```ts
// tools.ts
export type ToolId = /* 1.0 ids */ | "nukeTwin" | "nukeRain" | "ufoSwarm" | "gravityBeam" | "nanobots" | "mothership";
export type EndingFamily = "shatter" | "molten" | "frozen" | "consumed";
export type EndingKind = EndingFamily | "swallowed";
ToolSpec.stamp gains "goo" | "abduct";
// targets.ts
export function pickTargets(state: PlanetState, u: number, v: number, radius: number, n: number): { u: number; v: number }[];
  // the n distinct cells within radius with the most remaining people (ties → nearer first); if fewer than n cells have people,
  // fill with evenly spread points on a circle of radius·0.6 around (u,v); never empty; all values finite, u wrapped into [0,1)
// store.ts additions
combo: { count: number; lastAt: number };  // count 0 = none
export const COMBO_WINDOW_MS = 1200, COMBO_MIN = 3, COMBO_CAP = 10;
hit(toolId, u, v, now?: number)  // now defaults to performance.now() (Date.now() in tests is fine — pick one and inject it)
```

Tool specs (verbatim):

| id          | name          | icon                                | family   | power                             | radius | lethality | cooldownMs | mode | stamp  | finisher |
| ----------- | ------------- | ----------------------------------- | -------- | --------------------------------- | ------ | --------- | ---------- | ---- | ------ | -------- |
| nukeTwin    | Twin nuke     | ☢️ (the tile shows two, see Task 2) | molten   | 10 per warhead (2)                | 0.18   | 0.95      | 1800       | tap  | scorch |          |
| nukeRain    | Nuke rain     | 🚀                                  | molten   | 7 per warhead (6)                 | 0.14   | 0.9       | 3000       | tap  | scorch |          |
| ufoSwarm    | UFO swarm     | 👾                                  | molten   | 1.5 per beam (12)                 | 0.05   | 1         | 3500       | tap  | abduct |          |
| gravityBeam | Gravity beam  | 🧲                                  | shatter  | 9                                 | 0.13   | 0.8       | 1500       | tap  | crater |          |
| nanobots    | Nanobot swarm | 🤖                                  | consumed | 1.1 per tick (40 ticks over 10 s) | 0.07   | 0.7       | 4000       | tap  | goo    |          |
| mothership  | Mothership    | 🛸                                  | shatter  | 100                               | 0.5    | 1         | 0          | tap  | scorch | shatter  |

- The 1.0 alien laser icon is 🛸. Change it to 🔫 so the Mothership owns 🛸.
- `TOOL_ORDER`: asteroid, meteorShower, megaBomb, nuke, nukeTwin, nukeRain,
  supervolcano, earthquake, alienLaser, ufoSwarm, gravityBeam, nanobots, freezeRay,
  moonRam, blackHole, mothership.
- `UNLOCK_PATH`: append nukeTwin 6000, ufoSwarm 7000, gravityBeam 8200, nukeRain
  9500, nanobots 11000, mothership 13000.
- `chooseEnding`: ties go shatter > molten > frozen > consumed, and
  `familyDamage` gains `consumed`.
- `progress.ts`: the list of valid endings gains `"consumed"`. Old saves load
  unchanged.
- Combo: on each hit with `peopleLost > 0 || healthLost > 0` while
  `phase === "playing"`:
  - if `now − lastAt ≤ 1200`, then `count += 1`; otherwise `count = 1`;
  - set `lastAt = now`;
  - when `count ≥ 3`, add `min(count, 10)` whole bonus points to `progress.points`,
    and to `unlocksBetween`.

  Reset `combo` to `{count:0,lastAt:0}` on `newPlanet`, `selectPlanet` and
  `init`. `lastHit` gains `combo: number` (the count after this hit) so the HUD can
  show it.

- `testHooks.unlockAll()` sets points to the last `UNLOCK_PATH.at`.
  `forceEnding` accepts `"consumed"` (fire nanobots/goo the way the existing ones
  fire their tools; mirror the current implementation).
- Placeholders so it compiles:
  - `EffectLayer`: nukeTwin and nukeRain → `Blast`; ufoSwarm, gravityBeam and
    mothership → `Blast`; nanobots → `FreezeWave`.
  - `TOOL_CUES`: reuse the nuke and laser cues.
  - `EMOJI.consumed = "🤖"`.
  - `EndingStage`: `consumed` → the Molten component for now.
  - `DamagePainter`: treat "goo" like "ice" and "abduct" like "scorch" for now.

  Tasks 2–4 replace these.

- [ ] **Step 1: Write the failing tests.**
  - `tools11`:
    - every `TOOL_ORDER` id has a spec, and the order has 16 unique entries;
    - every non-free tool appears in `UNLOCK_PATH` exactly once;
    - `UNLOCK_PATH` is strictly ascending;
    - `nextUnlock(13000) === null`;
    - `chooseEnding` with only consumed damage gives `"consumed"`;
    - `mothership` on a fresh planet ends `"shatter"`.
  - `combo`, with injected `now`:
    - hits at 0, 500 and 1000 ms make `count` 3, and the third hit adds 3 bonus
      points;
    - a hit at 2500 ms resets `count` to 1;
    - 15 quick hits never add more than 10 bonus points per hit;
    - `newPlanet` resets `count` to 0;
    - hits during `"ending"` change nothing.
  - `targets`:
    - on a grid with one hot cell inside the radius, the result includes that cell
      first;
    - on an all-zero grid it returns n points, all finite;
    - at u = 0.995 every returned u is in [0,1);
    - no duplicate cells.
  - `progress`: a 1.0 save JSON (with no "consumed" anywhere) loads unchanged.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=planet-smasher`. Expect
      failures.
- [ ] **Step 3: Implement**, including the placeholders.
- [ ] **Step 4: Run** the tests, `npm run type-check` and `npm run lint`. Expect
      PASS.
- [ ] **Step 5: Commit** `feat(planet-smasher): 1.1 rules (new tools, consumed ending, combo)`.

---

### Task 2: Nuke upgrades + combo HUD + tray polish

**Files:**

- Create: `components/planet-smasher/scene/effects/NukeVolley.tsx`
- Create: `components/planet-smasher/ui/ComboBadge.tsx`
- Modify: `EffectLayer.tsx`, `ui/Arsenal.tsx`, `PlanetSmasher.tsx` (to mount the badge), `audio/sfx.ts`, `app/globals.css`
- Test: `ui/__tests__/ComboBadge.test.tsx`, `ui/__tests__/Arsenal.test.tsx` (extended)

NukeVolley handles both tools and reuses `Blast`'s nuke visuals, extracted into a
shared function or child component (refactor `Blast` minimally so both use it):

- **nukeTwin:** two warheads, landing 0.15 rad apart along a random tangent, 0.2 s
  apart. Each calls `onImpact` with its own (u,v) and has its own mushroom and ring.
- **nukeRain:** six warheads, streaking in from above at random points within
  0.35 rad of the tap, landing 0.25 s apart. Each has a flash, a mushroom (60%
  scale) and a ring. Camera shake ramps up with each impact (0.01 → 0.03).

ComboBadge: subscribe to `lastHit` (same pattern as the Odometer pop-off).

- When `combo ≥ 3`, show "COMBO ×N!" top-centre, just under the health bar:
  `text-4xl sm:text-6xl font-black`, an amber→red gradient text, a pop-in scale
  and a wiggle (`@keyframes ps-combo`), and "+N ⭐" in smaller text under it.
- It fades out 1.2 s after the last hit.
- `aria-live="polite"`.

Combo sound: add a `combo` cue, a short bright "ding" whose pitch rises a
semitone per count from 3 (capped at ×10). Play it from the badge's trigger.

Arsenal:

- The Twin nuke tile shows the ☢️ emoji twice, overlapped (two spans, one offset
  and scaled 0.8).
- When a tile is selected, call `scrollIntoView({inline:"nearest", block:"nearest",
behavior:"smooth"})` on it.
- Locked tiles show the star cost as now.

Swap the placeholders for the two nuke tools in `EffectLayer` and `TOOL_CUES` (use
the nuke cue per warhead impact, plus a falling whistle "launch" for the rain).

- [ ] **Step 1: Write the failing tests.**
  - ComboBadge:
    - after a store `lastHit` with combo 4, it shows "COMBO ×4!" and "+4";
    - with combo 2 it shows nothing;
    - after 1300 ms (fake timers) it's gone.
  - Arsenal:
    - 16 tiles render;
    - the Twin nuke tile has two ☢️;
    - clicking a tile calls `scrollIntoView` (mock it on
      `HTMLElement.prototype`).
- [ ] **Step 2: Run.** Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify.**
  - Tests, type-check and lint pass.
  - Dev-server screenshots (system Chrome via `channel:"chrome"`, swiftshader
    args), using `__planetSmasher.unlockAll()` and `fire()`:
    - Twin nuke mid-flight and at impact;
    - Nuke rain with 3+ warheads landed;
    - the combo badge after 4 quick asteroid fires (`setMaxFrameStep` if needed).
  - At 820×1180 the tray scrolls, and the selected tile is in view.
  - Look at each screenshot.
- [ ] **Step 5: Commit** `feat(planet-smasher): nuke upgrades and combo counter`.

---

### Task 3: UFO swarm + Gravity beam

**Files:**

- Create: `components/planet-smasher/scene/effects/{UfoSwarm,GravityBeam}.tsx`
- Modify: `EffectLayer.tsx`, `scene/DamagePainter.ts` (real "abduct" stamp), `audio/sfx.ts`
- Test: `scene/effects/__tests__/ufoSchedule.test.ts`, `scene/__tests__/DamagePainter.test.ts` (extended)

**UfoSwarm** (total about 6 s). At spawn, call
`pickTargets(useGameStore.getState().planet!, u, v, 0.35, 12)`. Then:

- 12 saucers in one `InstancedMesh`: a flattened sphere hull plus a dome. Their
  rims glow cyan-green with an emissive colour that varies per instance.
- They fly in from off-screen on curved paths, staggered 0.15 s apart, and park at
  1.15 × each target's direction.
- Each one turns on a translucent green cone beam to the surface (additive, one
  shared cone geometry), for 0.9 s per target.
- At the end of each beam, call `onImpact(target)` (stamp "abduct"), and spawn 6
  green sparkle particles rising up the beam.
- After its beam, each saucer zips off. Saucers bob gently while hovering.

Export `ufoSchedule(i: number): { arriveAt: number; beamAt: number; leaveAt: number }`
from the file. It's pure, so it can be tested. All 12 beams finish by 6 s.

The "abduct" stamp: erase the lights in a soft circle of radius r. Paint a faint
green ring at 0.25 alpha on damage, with no height change.

**GravityBeam** (about 3.5 s):

- A purple-white beam column comes down from 2.2 × the direction to the surface,
  with a swirling helix of particles.
- At 0.6 s, call `onImpact` (stamp crater).
- At 0.7 s, 8 rock chunks rise out of the crater in one `InstancedMesh`:
  icosahedrons with jittered vertices, brown-grey with glowing orange undersides.
  They tumble, rise to 1.6–2.2 × radius, then drift away and fade by 3.5 s.
- Shake 0.015.

Sounds:

- `ufoWarble`: a wobbly sine with a fast LFO, one per arrival, cheap.
- `tractorBeam`: a filtered noise swell per beam, capped by the voice limit.
- `gravityHum`: a low rising saw with a lowpass sweep.
- Wire them through `TOOL_CUES` and the effects.

- [ ] **Step 1: Write the failing tests.**
  - `ufoSchedule`: for every i, `arriveAt < beamAt < leaveAt`; `beamAt` is
    increasing in i; the max `leaveAt` is ≤ 6.
  - DamagePainter: an "abduct" stamp bumps `version`, touches the lights layer and
    doesn't touch height (use the existing dirty-flags API).
- [ ] **Step 2: Run.** Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify.**
  - Tests, type-check and lint pass.
  - Screenshots of the UFO swarm mid-beam (several saucers, green beams, lights
    going out), and of the Gravity beam with the chunks rising.
  - With `unlockAll` and both tools fired together, `__planetSmasherRenderInfo().calls`
    rises by ≤ 12 over idle.
- [ ] **Step 5: Commit** `feat(planet-smasher): UFO swarm and gravity beam`.

---

### Task 4: Nanobot swarm + Consumed ending + Mothership

**Files:**

- Create: `components/planet-smasher/scene/effects/{Nanobots,Mothership}.tsx`
- Create: `components/planet-smasher/scene/endings/Consumed.tsx`
- Modify: `EffectLayer.tsx`, `EndingStage.tsx`, `scene/DamagePainter.ts` (real "goo" stamp), `scene/Planet.tsx` (`uConsumed` uniform), `audio/sfx.ts`
- Test: `scene/effects/__tests__/nanobotSpread.test.ts`, `DamagePainter.test.ts` (extended)

**Nanobots** (10 s):

- A silver droplet falls in, and a goo spot starts at the tap.
- Export a pure `nanobotTick(k: number, seed: number): { du: number; dv: number }`:
  the offset of tick k (0..39) from the origin. It's a random walk with outward
  drift; the distance grows roughly √k × 0.06 rad, deterministic per seed. Every
  250 ms, call `onImpact` at origin + offset (stamp "goo").
- While spreading, there's a faint silver shimmer of particles at the leading tick
  point.
- It stops early, with no more `onImpact`, as soon as the store phase isn't
  `"playing"` or the effect unmounts.

The "goo" stamp:

- a metallic silver-grey blob (radial gradient with a lighter centre highlight and a
  darker rim);
- a little cyan on the glow layer (thin, faint);
- lights erased.

**Consumed ending** (2.5 s; register it in `EndingStage` like Molten):

- `uConsumed` 0 → 1 mixes the surface into brushed silver, using a world-space
  noise for streaks. Roughness 0.35, metalness 0.9 for that mix only (ramp them via
  uniforms in the patch).
- Pulsing blue emissive seams come from a cellular/Voronoi-ish noise, or reuse the
  shatter seed borders if simpler.
- A cyan halo sprite.
- It ends as a metal ball (it stays, like Molten), then calls `endingShown()`.
- `newPlanet` and `painter.reset` must reset `uConsumed` to 0, like `uMolten`.

**Mothership** (about 4.5 s):

- A huge saucer: a flattened disc of radius 0.9 with an underside light ring.
  Instanced little lights are fine.
- It descends from far above to 2.4 × the direction, blotting out the stars behind
  it (it's opaque).
- It charges for 2 s, with the ring lights chasing faster, a glow building at the
  centre, and a rising whine.
- Then it fires a thick white-cyan beam to the surface for 0.6 s, with a huge flash
  and shake 0.04, and calls `onImpact` (the finisher, so the shatter ending follows).
- It hovers while the ending plays, then rises away.

Sounds:

- `gooCrawl`: a bubbly filtered noise loop for 10 s; stop it when the effect
  unmounts.
- `mothershipCharge`: a rising whine, then a huge `impactBig`.
- `endConsumed`: a metallic shimmer, then a deep clang.

- [ ] **Step 1: Write the failing tests.**
  - `nanobotSpread`:
    - same seed → same offsets;
    - the mean distance at k = 39 is > the mean at k = 9, over 50 seeds;
    - all offsets are finite.
  - DamagePainter: a "goo" stamp bumps `version` and marks damage, glow and lights
    as touched.
  - A test (at the cleanest seam, e.g. a component test with a mocked store or the
    pure ticker) proving nanobot ticks stop once the phase leaves `"playing"`.
- [ ] **Step 2: Run.** Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify.**
  - Tests, type-check and lint pass.
  - Screenshots:
    - nanobots at 3 s and 8 s, with the goo visibly spreading;
    - `forceEnding("consumed")` mid-ending and at the end (a metal ball);
    - the Mothership charging and firing.
  - New planet after Consumed gives a normal Earth.
- [ ] **Step 5: Commit** `feat(planet-smasher): nanobots, consumed ending and mothership`.

---

### Task 5: Release 1.1.0

**Files:** `lib/planet-smasher/version.ts`, `lib/planet-smasher/changelog.ts`, `e2e/planet-smasher.spec.ts`

- Set the version to `1.1.0`. Add a new top entry (date 2026-11-14) titled "Alien
  invasion!". Highlights, in kid words:
  - six new tools: Twin nuke, Nuke rain, UFO swarm, Gravity beam, Nanobot swarm,
    Mothership;
  - the new Consumed ending turns a planet into a metal ball;
  - smash fast for COMBO bonus stars;
  - more stars to earn, with new unlocks going all the way to 13,000.
- e2e: add a test that runs `unlockAll()`, then fires each of the six new tools in
  turn at the canvas centre through the test hook. For each, it waits until the
  population drops or the planet has ended (call New planet if it ended) and checks
  there are no page errors (`page.on("pageerror")`). Chromium only (no `@smoke`
  tag).
- Run `npx playwright test e2e/planet-smasher.spec.ts --project=chromium` and
  `npm run validate`. Both pass.
- Commit `feat(planet-smasher): release 1.1.0`.
