# Planet Smasher 1.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship Planet Smasher 1.2.0. It adds four tools (Giant monster, Tsunami,
Sun dive, Planet collision), two endings (Vaporized, Collided), slow-motion
endings, orbiting debris and a trophy shelf.

**Architecture:** Extend 1.1 in place. Rules and stats live in
`lib/planet-smasher/`. Each tool gets an effect in `scene/effects/`. Endings go
in `scene/endings/` and are registered in `EndingStage`. Slow motion works
through `fxClock.timeScale`, which is applied in `stepDt`. Trophies are judged by
a pure evaluator, and the UI lives in `ui/`.

**Spec:** `docs/superpowers/specs/2026-11-14-planet-smasher-1.2-design.md` (base
constraints come from the 1.0 and 1.1 specs in the same folder).

## Global Constraints

- Follow the repo conventions in `CLAUDE.md`. Before writing a new effect or
  ending, read the closest existing one and copy its structure:
  - `UfoSwarm.tsx` (newest, follows every performance rule);
  - `Mothership.tsx` (a big object arriving);
  - `MoonRam.tsx` (a body flying into the planet);
  - `Shatter.tsx` / `Consumed.tsx` (endings);
  - `NukeVolley.tsx` (multi-impact).
- iPad mini 6 budgets:
  - particles come only from the shared pools in `scene/effects/particles.ts`;
  - at most 12 live effects;
  - no `new`, `clone()` or array literals inside `useFrame`;
  - dispose geometries and materials on unmount;
  - use `InstancedMesh` for anything repeated;
  - use `stepDt(rawDt)` for every animation delta, so slow motion applies.
- Every impact goes through the effect's `onImpact`. Effects stop calling it, and
  stop their looping sounds, once the store phase isn't `"playing"` or they
  unmount.
- No gore: the monster wrecks buildings and lights only.
- Saves from 1.0 and 1.1 must load. New progress fields are optional on load and
  default to empty.
- Version `1.2.0` with a matching top changelog entry (Task 5).
- Commit per task. The message ends with a blank line, then
  `AI-assisted: written with Claude Code.`. Don't push.

## Review Focus

1. **Old saves.**
   - A 1.1 save (no `stats`/`trophies`) loads with empty stats and no trophies.
   - Nothing is awarded retroactively except what the evaluator can prove from
     the saved data: "reach N stars" may award on load.
   - Owned by Task 1, with a test.
2. **Trophy double-pay.** Each trophy pays +150 exactly once, even when two
   conditions complete on the same hit or the page reloads. Owned by Task 1,
   with a test.
3. **Slow motion stuck on.** `timeScale` always returns to 1 after the ending,
   and on New planet, planet switch and unmount, even if the ending is cut short.
   Owned by Task 4, with a test.
4. **"Only meteors" / "only laser" trophies.** The per-planet tool set resets on
   New planet and planet switch, and a hit from any other tool disqualifies the
   planet. Owned by Task 1, with a test.
5. **Collision on Mars or Frostia.** The incoming body is Earth when the current
   planet isn't Earth, and Mars when it is. Textures load before the effect needs
   them, with no crash while loading. Owned by Task 3.

---

### Task 1: Rules — tools, endings, star path, stats, trophies, time scale

**Files:**

- Modify: `lib/planet-smasher/{tools,unlocks,progress,store,testHooks,fxClock}.ts`
- Create: `lib/planet-smasher/trophies.ts`
- Modify (compile-only placeholders): `scene/effects/EffectLayer.tsx`,
  `audio/sfx.ts` (`TOOL_CUES`, `ENDING_CUES` if present), `ui/EndingOverlay.tsx`
  (`EMOJI`), `scene/endings/EndingStage.tsx`
- Test: `lib/planet-smasher/__tests__/{tools12,trophies,stats,fxClock}.test.ts`

**Interfaces:**

```ts
// tools.ts
ToolId += "monster" | "tsunami" | "sunDive" | "planetCollision"
EndingKind = EndingFamily | "swallowed" | "vaporized" | "collided"
ToolSpec.stamp += "flood"
// fxClock.ts
fxClock.timeScale: number  // default 1; stepDt returns min(rawDt, maxDt) * timeScale
export function setTimeScale(s: number): void   // clamps to [0.05, 1]
// progress.ts (Progress gains, optional on load)
stats: { planetsEnded: number; endedByPlanet: Partial<Record<PlanetId, number>>; endedBy: Partial<Record<EndingKind, number>>;
         shots: Partial<Record<ToolId, number>>; peopleLost: number; bestCombo: number; fastestEndMs: number | null }
trophies: TrophyId[]
// trophies.ts
export type TrophyId = (see table)
export interface TrophySpec { id: TrophyId; icon: string; name: string; goal?: number }
export const TROPHIES: readonly TrophySpec[]   // table order
export const TROPHY_REWARD = 150;
export interface PlanetRun { toolsUsed: ToolId[]; startedAt: number }
export function progressToward(id: TrophyId, p: Progress): number | null  // count for goal trophies, null otherwise
export function newlyEarned(p: Progress, run: PlanetRun | null, endedNow: { ending: EndingKind; planetId: PlanetId; at: number } | null): TrophyId[]
// store.ts
lastTrophies: TrophyId[]; clearTrophies(): void;  // UI queue, like lastUnlocks
planetRun: PlanetRun  // reset on init / newPlanet / selectPlanet
```

Tool specs (verbatim):

| id              | name             | icon | family  | power                                 | radius | lethality | cooldownMs | mode | stamp  | finisher  |
| --------------- | ---------------- | ---- | ------- | ------------------------------------- | ------ | --------- | ---------- | ---- | ------ | --------- |
| monster         | Giant monster    | 🦖   | shatter | 3 per stomp (4) + 2 per laser hit (2) | 0.07   | 0.8       | 7000       | tap  | crater |           |
| tsunami         | Tsunami          | 🌊   | shatter | 1 per wave hit (16)                   | 0.09   | 0.6       | 5000       | tap  | flood  |           |
| sunDive         | Sun dive         | ☀️   | molten  | 100                                   | 0.5    | 1         | 8000       | tap  | scorch | vaporized |
| planetCollision | Planet collision | 🪐   | shatter | 100                                   | 0.6    | 1         | 8000       | tap  | crater | collided  |

- **The monster's eye laser hits** use the stamp `"trench"`. Pass it through the
  impact opts: add `stamp?: StampKind` to `ImpactOpts`, which `PlanetSmasher`
  honours over the tool's stamp.
- **`TOOL_ORDER`:** append in this order: monster, tsunami, sunDive,
  planetCollision.
- **`UNLOCK_PATH`:** append monster 14500, tsunami 16000, sunDive 18000,
  planetCollision 20000.
- **Endings and bonuses:** `ENDINGS` (progress) gains vaporized and collided.
  The first-ending bonus applies to them as to the others.
- **Combo cap:** the per-planet combo cap of 300 is unchanged.

Stats are updated in `store.hit` and at the ending:

- `shots[toolId]` goes up once per player fire. Use the fireId rule from the combo:
  a hit with no fireId counts once per call.
- `peopleLost` adds each hit's people lost.
- `bestCombo` keeps the maximum combo count reached.
- At the ending:
  - `planetsEnded` goes up by 1, and so do `endedByPlanet[planetId]` and
    `endedBy[ending]`;
  - `fastestEndMs` is the minimum of the current value and `now − planetRun.startedAt`.
- `planetRun.toolsUsed` gains the tool on its first hit this planet.
- After each hit, call `newlyEarned`. For each id returned, push it onto
  `progress.trophies` and `lastTrophies`, and add `TROPHY_REWARD` to the points.
  Those points also go through `unlocksBetween`.
- Save progress.

Trophies (in this order; `name` verbatim):

| id          | icon | name            | earned when                                                                            |
| ----------- | ---- | --------------- | -------------------------------------------------------------------------------------- |
| firstSmash  | 💥   | First smash     | planetsEnded ≥ 1                                                                       |
| smash10     | 🔟   | 10 planets      | planetsEnded ≥ 10 (goal 10)                                                            |
| smash50     | 🏅   | 50 planets      | planetsEnded ≥ 50 (goal 50)                                                            |
| nuke25      | ☢️   | Nuke fan        | shots of nuke+nukeTwin+nukeRain ≥ 25 (goal 25)                                         |
| nuke100     | 🚀   | Nuke master     | same ≥ 100 (goal 100)                                                                  |
| allEndings  | 🌈   | Every ending    | endingsSeen has all 7 (goal 7)                                                         |
| meteorsOnly | ☄️   | Rock storm      | a planet ends with toolsUsed ⊆ {asteroid, meteorShower}                                |
| laserOnly   | 🔫   | Laser show      | a planet ends with toolsUsed = {alienLaser}                                            |
| aliens      | 👽   | Alien friend    | shots > 0 for each of alienLaser, ufoSwarm, gravityBeam, nanobots, mothership (goal 5) |
| combo10     | 🔥   | Combo ×10       | bestCombo ≥ 10                                                                         |
| mars        | 🔴   | Mars smasher    | endedByPlanet.mars ≥ 1                                                                 |
| frostia     | 🧊   | Frostia smasher | endedByPlanet.ice ≥ 1                                                                  |
| everyTool   | 🧰   | Every tool      | shots > 0 for every ToolId (goal = TOOL_ORDER.length)                                  |
| blackHole   | 🕳️   | Swallowed whole | endedBy.swallowed ≥ 1                                                                  |
| monster     | 🦖   | Monster mash    | shots.monster ≥ 10 (goal 10)                                                           |
| sunDive     | ☀️   | Too hot         | endedBy.vaporized ≥ 1                                                                  |
| collision   | 🪐   | Crash!          | endedBy.collided ≥ 1                                                                   |
| speedy      | ⚡   | Speed smash     | fastestEndMs ≤ 20000                                                                   |
| billions    | 🌍   | 100 billion     | peopleLost ≥ 100_000_000_000 (goal 100_000_000_000)                                    |
| stars10k    | ⭐   | Star collector  | points ≥ 10000 (goal 10000)                                                            |

- `newlyEarned` returns trophies whose condition holds and which aren't already
  in `p.trophies`, in table order.
- `meteorsOnly` and `laserOnly` need `endedNow` and that planet's `run`.
  `toolsUsed` must not be empty.

Test hooks:

- `unlockAll` sets the points to the last `UNLOCK_PATH` entry.
- `forceEnding` accepts `"vaporized"` and `"collided"`. Fire sunDive or
  planetCollision through the hook, mirroring the existing kinds.

Placeholders, so the build compiles:

- `EffectLayer`: monster and tsunami → `Blast`; sunDive and planetCollision → `MoonRam`.
- `EMOJI`: vaporized "☀️", collided "🪐".
- `EndingStage`: vaporized → Molten, collided → Shatter.
- `DamagePainter`: "flood" behaves like "scorch".
- Cues: reuse existing ones.

**Steps:**

- [ ] **Step 1: Write failing tests.**
  - **tools12:** TOOL_ORDER has 20 unique entries; every non-free tool is in
    UNLOCK_PATH exactly once; UNLOCK_PATH is strictly ascending;
    `nextUnlock(20000) === null`; sunDive ends "vaporized" and planetCollision
    ends "collided".
  - **trophies:**
    - each condition at its threshold earns and one below doesn't;
    - meteorsOnly with toolsUsed [asteroid, meteorShower] earns, and with
      [asteroid, nuke] doesn't;
    - an empty toolsUsed earns neither meteorsOnly nor laserOnly;
    - an already-held trophy is never returned again;
    - `progressToward("nuke25")` counts all three nuke tools.
  - **stats** (store, with injected `now` and fireIds):
    - ending a planet updates planetsEnded, endedByPlanet, endedBy and
      fastestEndMs;
    - the trophy reward is paid once even when two trophies complete on one hit
      (firstSmash + blackHole: +300 total);
    - a reload (saveProgress → loadProgress → init) doesn't pay again;
    - planetRun resets on newPlanet and selectPlanet;
    - a 1.1 save JSON with no stats or trophies loads with empty stats and no
      trophies, and 10000 points there earns stars10k on the first hit after
      init.
  - **fxClock:** with timeScale 0.25, `stepDt(0.016)` returns 0.004;
    `setTimeScale(0)` clamps to 0.05; `setTimeScale(2)` clamps to 1.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=planet-smasher`. Expect FAIL.
- [ ] **Step 3: Implement**, including the placeholders. Update the 1.1 tests
      that assert 16 tools or `nextUnlock(13000) === null` to the new truth.
- [ ] **Step 4:** Tests, type-check and lint pass.
- [ ] **Step 5: Commit** `feat(planet-smasher): 1.2 rules (new tools, endings, stats, trophies)`.

---

### Task 2: Giant monster + Tsunami

**Files:**

- Create: `scene/effects/{Monster,Tsunami}.tsx`
- Modify: `EffectLayer.tsx`, `scene/DamagePainter.ts` (real "flood" stamp), `audio/sfx.ts`
- Test: `scene/effects/__tests__/{monsterPath,tsunamiRing}.test.ts`, extend `DamagePainter.test.ts`

**Monster** (about 7 s):

- **Model.** Build it from primitives: a green capsule body, a head, a tail,
  dorsal spikes in one `InstancedMesh`, little arms, and glowing yellow eyes.
  Its height is 0.5 planet radii. Stand it on the surface, oriented to the
  local normal.
- **Path.** Pure, exported `monsterPath(seed): { u, v }[]` returns 4 stomp
  points. The first point is the tap; each next point is about 0.12 rad further
  in a consistent random heading. All u values are wrapped into [0,1).
- **Timeline:**
  - 0–1 s: rises out of the ground at the tap, with a splash and dust ring.
  - 1–1.5 s: roars (head tilts back, `monsterRoar` cue, small shake).
  - 1.5–4.5 s: walks the 4 stomp points. On each stomp, call
    `onImpact(stomp, {})`, with a dust ring and shake 0.015.
  - 4.5–5.5 s: two eye-laser blasts. Red beams from the eyes to points about
    0.2 rad ahead; `onImpact(point, { stamp: "trench", length: 0.25, angle })`.
  - 5.5–7 s: sinks back down.
- **Damage.** Each stomp uses the spec power. The 2 laser hits pass the trench
  stamp through opts; the store applies the monster's power per call, which is
  acceptable. Document it.

**Tsunami** (about 4 s):

- **Ring.** A translucent blue-white ring of foam particles plus a shader ring
  mesh hugging the sphere at radius 1.005. It grows from the tap to 1.2 rad
  over 3 s, fading at the end.
- **Hits.** Pure, exported `tsunamiHits(u, v, seed): { u, v, t }[]` returns 16
  points on rings at increasing radius (0.2 → 1.2 rad), with spread angles and
  hit times t over 0.4–3 s. At each t, call `onImpact`, which applies the
  "flood" stamp.
- **"flood" stamp.** A muddy brown-blue wash at alpha 0.5 on the damage layer,
  lights erased, no height change.

**Sounds:** `monsterRoar`, `monsterStomp` (a deep thud) and `tsunamiRush`
(swelling filtered noise). Wire them into `TOOL_CUES` and the effects.

**Steps:**

- [ ] **Step 1: Write failing tests.**
  - `monsterPath`: 4 finite points, the first equals the tap, consecutive
    distance ≈ 0.12 ± 0.03 rad (using `angularDistance`), u in [0,1) at the
    seam.
  - `tsunamiHits`: 16 points, t strictly increasing within [0.4, 3], all
    finite, radius from the origin non-decreasing.
  - `DamagePainter`: "flood" bumps the version, touches damage and lights, not
    height.
- [ ] **Step 2: Run.** Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify.**
  - Tests, type-check and lint pass.
  - Screenshots: the monster mid-walk and firing its eye laser; the tsunami ring
    at 1.5 s and the flood marks after.
  - Render calls with both live are ≤ idle + 14.
- [ ] **Step 5: Commit** `feat(planet-smasher): giant monster and tsunami`.

---

### Task 3: Sun dive + Vaporized; Planet collision + Collided

**Files:**

- Create: `scene/effects/{SunDive,PlanetCollision}.tsx`, `scene/endings/{Vaporized,Collided}.tsx`
- Modify: `EffectLayer.tsx`, `EndingStage.tsx`, `scene/Planet.tsx` / `planetFx.ts` (a `uVapor` uniform), `audio/sfx.ts`
- Test: `scene/endings/__tests__/collisionBody.test.ts`

**SunDive effect** (about 2.5 s, then the ending takes over):

- A big Sun (radius 2.5) slides in from screen-right at about 6 units away.
  It's an emissive sphere with a corona sprite and a flickering surface shader
  or noise texture.
- The planet's light turns warm.
- At 2.5 s, call `onImpact` (the finisher).

**Vaporized ending** (3 s):

- The planet drifts toward the Sun.
- `uVapor` 0 → 1 pushes the surface to orange, then white-hot.
- Plasma particles stream off the planet toward the Sun, from the shared pool:
  orange to white, about 200.
- The planet shrinks to 0 and a flash fires.
- The Sun slides back out.
- Call `endingShown()`.
- `uVapor` resets wherever `uMolten` does.

**PlanetCollision effect** (about 2.5 s):

- The incoming body is chosen by pure, exported `collisionBody(current: PlanetId): PlanetId`.
  It returns `"mars"` for Earth and `"earth"` otherwise.
- Use `loadPlanetTextures` (cached) for that body. Start loading on mount, and
  show a plain coloured sphere until the textures arrive.
- The body is sized 0.6 radii. It flies in from far off-screen on a curved path,
  growing in apparent size, and contacts at 2.5 s, where it calls `onImpact`
  (the finisher).

**Collided ending** (3 s):

- Run the existing Shatter ending for the main planet; reuse `Shatter` as a
  child.
- Also burst the incoming body into its own 12 chunks, built with the same
  chunk builder at radius 0.6 with its own material, flying off the other way.
- Add a giant flash and shake 0.05.

**Sounds:**

- `sunRoar`: a low roar with crackle.
- `endVaporized`: rising hiss into a whoosh.
- `incomingWhoosh`, and `endCollided`, a double boom.
- Wire them into `TOOL_CUES` and `ENDING_CUES`.

**Steps:**

- [ ] **Step 1: Write failing tests.** `collisionBody("earth") === "mars"`;
      `collisionBody("mars") === "earth"`; `collisionBody("ice") === "earth"`.
- [ ] **Step 2: Run.** Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify.**
  - Tests, type-check and lint pass.
  - Screenshots:
    - Sun dive arriving;
    - `forceEnding("vaporized")` mid and at the end;
    - collision incoming on Earth;
    - collision on Mars (after `selectPlanet` via the store with unlockAll);
    - `forceEnding("collided")` mid-burst.
  - New planet after each gives a normal planet.
- [ ] **Step 5: Commit** `feat(planet-smasher): sun dive and planet collision`.

---

### Task 4: Slow-motion endings, orbiting debris, trophy shelf

**Files:**

- Create: `scene/endings/SlowMo.tsx`, `scene/DebrisRing.tsx`
- Create: `ui/{TrophyShelf,TrophyToast}.tsx`
- Modify: `EndingStage.tsx`, `PlanetSmasher.tsx`, `lib/planet-smasher/store.ts` (only if needed to carry debris intent), `audio/sfx.ts`, `app/globals.css`
- Test: `scene/endings/__tests__/slowMo.test.ts`, `ui/__tests__/{TrophyShelf,TrophyToast}.test.tsx`

**Slow motion:**

- Pure, exported `slowMoScale(t: number): number`, where t is real seconds since
  the ending began:
  - 0.25 for t < 0.8;
  - a linear ramp to 1 by t = 1.2;
  - 1 after that.
- `SlowMo` is mounted by `EndingStage` while the phase is `"ending"`. Each frame
  it calls `setTimeScale(slowMoScale(t))`, using raw real time rather than
  `stepDt`.
- It dollies the camera 15% closer during t < 1.2, then eases back. Skip the
  dolly when reduced motion is on, but keep the slow motion.
- On unmount, phase change, New planet or planet switch, it calls
  `setTimeScale(1)` and restores the camera. That holds even if the ending was
  cut short.
- The ending's sound cue still plays at real time.

**DebrisRing:**

- When an ending of kind shatter, frozen or collided finishes, the store or the
  EndingStage records `debris = { count: 60, seed }` for the next planet.
  Pick the simplest seam and say which you used.
- On the next "playing" phase, `DebrisRing` renders one `InstancedMesh` of up to
  60 jittered icosahedron rocks:
  - grey-brown, with frozen endings tinted icy;
  - orbiting in a tilted ring at radius 1.6–2.3 with varied speeds and tumble.
- The next New planet replaces it: it's fresh after the next ending, or cleared
  if the next ending isn't shatter, frozen or collided.
- It's never more than one ring, and it's disposed on change.

**Trophy shelf:**

- A 🏆 button, 56 px, under the planet picker. A small badge shows
  earned/total.
- It opens a full-screen overlay: a dark translucent backdrop with a grid
  (4 columns on phones, 5 from `sm:`) of 20 tiles at least 72 px.
  - Earned tiles: the emoji, a gold ring and the name.
  - Locked tiles: the emoji as a dark silhouette (`grayscale brightness-0
opacity-40`), the name, and, for goal trophies, a thin progress bar from
    `progressToward`.
- A big ✕ closes it.
- Taps on the overlay never reach the planet.

**Trophy toast:**

- When `lastTrophies` is non-empty, show a gold card with "TROPHY!", the emoji
  growing in, the name, "+150 ⭐", and a sparkle burst.
- It lasts 2.5 s each and plays them in sequence, then calls `clearTrophies()`.
- It uses the same sequencing approach as `UnlockToast`, and if both are
  pending they don't overlap: queue trophies after unlocks.
- Cue: `trophy`, a fanfare arpeggio.

**Steps:**

- [ ] **Step 1: Write failing tests.**
  - `slowMoScale`: 0 → 0.25, 0.79 → 0.25, 1.0 → about 0.625, 1.2 → 1, 5 → 1.
  - A test proving `setTimeScale(1)` is called when `SlowMo` unmounts early.
    Render it in an R3F test harness if one exists; otherwise extract the
    lifecycle into a pure controller and test that.
  - `TrophyShelf`: shows 20 tiles; earned ones are labelled earned, via
    `aria-label` including "earned"; nuke25 shows a progress bar at 10/25.
  - `TrophyToast`: shows "TROPHY!" and the name for a pending trophy and calls
    `clearTrophies` after its timers (fake timers).
- [ ] **Step 2: Run.** Expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify.**
  - Tests, type-check and lint pass.
  - Screenshots:
    - an ending at about 0.5 s showing slow motion and the dolly;
    - the debris ring on the next planet;
    - the trophy shelf at 1180×820 and 820×1180;
    - the trophy toast.
- [ ] **Step 5: Commit** `feat(planet-smasher): slow-mo endings, orbiting debris and trophies`.

---

### Task 5: Release 1.2.0

- Set the version to `1.2.0`, with a top changelog entry dated 2026-11-14,
  titled "Monsters and trophies!". The highlights, in kid words:
  - Giant monster, Tsunami, Sun dive, Planet collision;
  - two new endings;
  - slow-motion endings;
  - rocks left orbiting after a smash;
  - a trophy shelf with 20 trophies, each worth bonus stars;
  - new unlocks up to 20,000 stars.
- e2e (Chromium only):
  - `unlockAll()`, then fire each of the four new tools in turn at the canvas
    centre. Each one waits until the population drops or the planet ends,
    pressing New planet when it ends, with no page errors.
  - Open the trophy shelf: 20 tiles are visible. Close it.
- Run e2e the way 1.1 did (`NEXT_PUBLIC_E2E=1 npx next build --webpack`, then
  `E2E_PREBUILT=1 npx playwright test e2e/planet-smasher.spec.ts --project=chromium`),
  and run the full jest suite.
- Commit `feat(planet-smasher): release 1.2.0`.
