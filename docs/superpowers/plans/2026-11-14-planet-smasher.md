# Planet Smasher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1.0.0 of Planet Smasher at `/planet-smasher`: a 3D, iPad-first
planet-wrecking toy with a growing arsenal, lasting damage, a rolling
population odometer, four dramatic endings and unlocks.

**Architecture:** Pure, tested game rules in `lib/planet-smasher/` (tools,
planets, population, damage, progress) drive a React Three Fiber scene in
`components/planet-smasher/`. Hits paint into canvas textures that a patched
`MeshStandardMaterial` blends over the planet (scorch, lava glow, darkened
city lights, crater height). Weapon visuals are short-lived effect
components. Endings swap the globe for a chunked copy or animate shader
uniforms.

**Tech Stack:** Next.js 16 (static export), React 19, TypeScript, Tailwind 4,
three 0.186, @react-three/fiber 9, @react-three/drei 10, zustand 5, Jest +
RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-planet-smasher-design.md` (read
it first: intent, anti-goals, endings and tool table live there).

## Global Constraints

- Repo rules in `CLAUDE.md`: `export default function` components,
  `interface` for props, `@/` imports, Tailwind only for JSX styling (writing
  `el.style.transform` from a rAF loop through a ref is fine and is how the
  odometer animates), Prettier style, `"use client"` only where needed.
- Before writing Next-specific code, read the relevant guide in
  `node_modules/next/dist/docs/` (Next 16 differs from training data).
- Target device: **iPad mini 6 (A15, 4 GB)**. Canvas `dpr={[1, 2]}`. Day
  texture 4096×2048 JPEG or smaller, night 2048×1024, damage canvases at the
  sizes given below. At most 12 live effects; at most ~600 live particles
  total.
- Players are 6 and 8: icons and numbers, no reading needed. **No gore or
  depicted people.** No purchases, ads or nags.
- Game chrome is always a dark space look (it is not driven by the site
  theme), but any Tailwind colour classes still include `dark:` pairs when
  they are not on the always-dark canvas overlay. (The game root sets
  `bg-black text-white` for both themes.)
- Release tracking: `PLANET_SMASHER_VERSION = "1.0.0"` and the matching
  `CHANGELOG` top entry; until 1.0.0 ships, edit that entry rather than
  bumping.
- localStorage reads and writes are wrapped in try/catch; the game must work
  with storage unavailable.
- Every new `e2e/*.spec.ts` must be listed in a `.github/workflows/ci.yml`
  e2e group (CI fails otherwise).
- Commit after each task with a conventional message
  (`feat(planet-smasher): …`). Do not push.

## Review Focus

1. **A drag fires a shot.** A finger that rotates the planet must never fire
   on release: movement > 8 px or press > 400 ms = no tap (Task 3 test).
2. **The u = 0/1 seam and the poles.** A hit at u = 0.995 must paint and
   count damage on both sides of the seam, and a hit near a pole must not
   blow up the ellipse width (Task 1 and Task 4 tests).
3. **Rapid tapping.** Ten taps in a second must not stack more than the
   tool's cooldown allows or exceed 12 live effects (Task 3 and Task 6
   tests).
4. **Hits during or after an ending.** Taps while the ending plays or after
   it are ignored, and points for the ending are paid exactly once (Task 1
   and Task 7 tests).
5. **Storage blocked or corrupt.** Bad JSON or a throwing `localStorage`
   gives fresh progress and no crash (Task 2 test).

---

## File map

```
lib/planet-smasher/
  sphere.ts          uv ↔ direction, angular distance (pure)
  tools.ts           TOOLS catalog + ToolId
  planets.ts         PLANETS catalog + PlanetId
  population.ts      PopulationGrid from luminance; loss at a hit
  damage.ts          PlanetState, applyHit, ending selection
  progress.ts        Progress (points, unlocks, endings seen), load/save
  unlocks.ts         UNLOCK_PATH, unlocksBetween(prevPts, nextPts)
  store.ts           zustand game store (UI-facing state + actions)
  testHooks.ts       TEST_HOOKS_ENABLED + window.__planetSmasher typing
  version.ts / changelog.ts
  __tests__/*.test.ts
components/planet-smasher/
  PlanetSmasher.tsx  client root (WebGL check, SW, sound unlock, layout)
  VersionHistory.tsx
  scene/Stage.tsx         Canvas, camera, controls, stars, lights, input
  scene/tapGesture.ts     pure tap-vs-drag classifier
  scene/Planet.tsx        globe mesh + patched material
  scene/DamagePainter.ts  canvas layers + stamp()
  scene/planetTextures.ts load Earth textures; procedural Mars/Ice
  scene/Moon.tsx
  scene/effects/EffectLayer.tsx + one file per effect
  scene/endings/*.tsx
  scene/RenderInfoProbe.tsx
  ui/Hud.tsx ui/Odometer.tsx ui/HealthBar.tsx ui/Arsenal.tsx
  ui/PlanetPicker.tsx ui/EndingOverlay.tsx ui/UnlockToast.tsx ui/SoundToggle.tsx
  audio/sfx.ts audio/soundSetting.ts audio/useSoundUnlock.ts
  hooks/useServiceWorker.ts
app/planet-smasher/page.tsx, app/planet-smasher/versions/page.tsx
public/planet-smasher/textures/*, public/planet-smasher-icons/*,
public/planet-smasher.webmanifest, public/planet-smasher-sw.js
e2e/planet-smasher.spec.ts (+ scenes in e2e/perf.spec.ts)
```

---

### Task 1: Game rules core (sphere, tools, planets, population, damage)

**Files:**

- Create: `lib/planet-smasher/{sphere,tools,planets,population,damage}.ts`
- Test: `lib/planet-smasher/__tests__/{sphere,population,damage}.test.ts`

**Interfaces (Produces):**

```ts
// sphere.ts — matches three.js SphereGeometry uv: u = longitude 0..1, v = 1 at north pole
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export function uvToDir(u: number, v: number): Vec3; // unit vector; x = -cos(2πu)·sin(π(1-v)), y = cos(π(1-v)), z = sin(2πu)·sin(π(1-v))
export function angularDistance(a: Vec3, b: Vec3): number; // radians, clamp dot to [-1,1]

// tools.ts
export type ToolId =
  | "asteroid"
  | "meteorShower"
  | "megaBomb"
  | "nuke"
  | "supervolcano"
  | "earthquake"
  | "alienLaser"
  | "freezeRay"
  | "moonRam"
  | "blackHole";
export type EndingFamily = "shatter" | "molten" | "frozen";
export type EndingKind = EndingFamily | "swallowed";
export interface ToolSpec {
  id: ToolId;
  icon: string /* emoji */;
  family: EndingFamily;
  power: number; // health % removed per hit (before wreck scaling)
  radius: number; // angular radius, radians
  lethality: number; // 0..1 share of people in radius lost
  cooldownMs: number;
  mode: "tap" | "hold";
  finisher?: EndingKind; // always ends the planet with this ending
  stamp: "crater" | "scorch" | "lava" | "crack" | "ice" | "trench" | "none";
}
export const TOOLS: Record<ToolId, ToolSpec>;
export const TOOL_ORDER: readonly ToolId[]; // spec table order
// planets.ts
export type PlanetId = "earth" | "mars" | "ice";
export interface PlanetSpec {
  id: PlanetId;
  name: string;
  icon: string;
  population: number;
  peopleIcon: string;
  hasMoon: boolean;
}
export const PLANETS: Record<PlanetId, PlanetSpec>;
export const PLANET_ORDER: readonly PlanetId[];
// population.ts
export const POP_W = 256,
  POP_H = 128;
export interface PopulationGrid {
  w: number;
  h: number;
  weights: Float32Array;
} // sums to 1
export function gridFromLuminance(
  lum: ArrayLike<number>,
  w: number,
  h: number,
  floor?: number
): PopulationGrid;
export function cellsWithin(
  grid: { w: number; h: number },
  center: Vec3,
  radius: number
): number[]; // cell indices, seam-safe
// damage.ts
export interface PlanetState {
  planetId: PlanetId;
  health: number /*0..100*/;
  population: number;
  startPopulation: number;
  remaining: Float32Array /* per-cell people */;
  wreck: Float32Array /* per-cell 0..1 */;
  familyDamage: Record<EndingFamily, number>;
  ended: EndingKind | null;
}
export interface HitResult {
  peopleLost: number;
  healthLost: number;
  points: number;
  ending: EndingKind | null;
}
export function createPlanetState(
  planetId: PlanetId,
  grid: PopulationGrid
): PlanetState;
export function applyHit(
  state: PlanetState,
  toolId: ToolId,
  u: number,
  v: number
): HitResult; // mutates state
export function chooseEnding(
  state: PlanetState,
  finisher?: EndingKind
): EndingKind;
export function pointsFor(peopleLost: number, startPopulation: number): number; // 1% of start = 5 pts, Math.round
export const ENDING_BONUS = 100;
```

Tool values (tune later, but start here):

| id           | icon | family  | power                        | radius              | lethality | cooldownMs | mode | stamp  | finisher  |
| ------------ | ---- | ------- | ---------------------------- | ------------------- | --------- | ---------- | ---- | ------ | --------- |
| asteroid     | ☄️   | shatter | 4                            | 0.08                | 0.6       | 350        | tap  | crater |           |
| meteorShower | 🌠   | shatter | 1.2 (per meteor, 10 meteors) | 0.04                | 0.5       | 1800       | tap  | crater |           |
| megaBomb     | 💣   | molten  | 7                            | 0.12                | 0.8       | 700        | tap  | scorch |           |
| nuke         | ☢️   | molten  | 12                           | 0.2                 | 0.95      | 1500       | tap  | scorch |           |
| supervolcano | 🌋   | molten  | 10                           | 0.15                | 0.7       | 2000       | tap  | lava   |           |
| earthquake   | ⚡   | shatter | 11                           | 0.1 (along a crack) | 0.6       | 2000       | tap  | crack  |           |
| alienLaser   | 🛸   | molten  | 0.8 per tick (8 ticks/s)     | 0.04                | 0.9       | 125        | hold | trench |           |
| freezeRay    | ❄️   | frozen  | 14                           | 0.35                | 0.5       | 2000       | tap  | ice    |           |
| moonRam      | 🌙   | shatter | 100                          | 0.5                 | 1         | 0          | tap  | crater | shatter   |
| blackHole    | 🕳️   | shatter | 100                          | 0.3                 | 1         | 0          | tap  | none   | swallowed |

Planets: earth 🌍 population 8_000_000_000 people 🧍 hasMoon true; mars 🔴
"Mars" 3_000_000 👽 hasMoon false; ice 🧊 "Frostia" 450_000_000 🐧 hasMoon
false. (The moon ram works on every planet: the effect brings its own moon
when `hasMoon` is false.)

Rules:

- `applyHit`: ignored (all-zero result, `ending: null`) if `state.ended`. Cells =
  `cellsWithin(center, radius)`. Mean wreck of those cells = `w`.
  `healthLost = power × (1 − 0.7·w)` clamped to the remaining health. Each cell
  loses `remaining[c] × lethality` people, and its wreck goes up by
  `0.5 × lethality` (capped at 1). `familyDamage[family] += healthLost`. If
  health ≤ 0 or `finisher`: `ending = chooseEnding(state, finisher)`, every
  remaining person counts as lost, population = 0, health = 0.
  `points = pointsFor(peopleLost, startPopulation) + (ending ? ENDING_BONUS : 0)`.
  `population` is rounded to a whole number and never negative.
- `chooseEnding`: finisher wins; otherwise the family with the most damage.
  Ties go shatter > molten > frozen.
- `createPlanetState`: `remaining[c] = weights[c] × population`, health 100.
- `gridFromLuminance`: weight = max(lum, floor (default 0.02 × max lum)) for
  land-ish pixels; normalise so the weights sum to 1. (The floor keeps oceans
  and dark land slightly populated, so every hit counts a little.)

- [ ] **Step 1: Write the failing tests**

`sphere.test.ts`: `uvToDir(0.25, 0.5)` ≈ `{x:0, y:0, z:1}`; `uvToDir(*, 1)`
≈ north `{0,1,0}`; `angularDistance` of `uvToDir(0.999,0.5)` and
`uvToDir(0.001,0.5)` < 0.02.

`population.test.ts`: the weights sum to 1 (±1e-6); a bright pixel gets more
weight than a dark one; `cellsWithin` at u = 0.998 includes cells in both
column 0 and column `w-1`; `cellsWithin` at the north pole with radius 0.1
returns every cell in row 0 and no cells below row ~5.

`damage.test.ts`:

- `pointsFor(80_000_000, 8_000_000_000) === 5`.
- An asteroid on a fresh Earth (a uniform grid) lowers health by 4 and
  population by > 0; `points ≥ 0`.
- The same spot hit 10 times loses less health on hit 10 than hit 1.
- Enough asteroids → `ending === "shatter"`, population 0, health 0, the
  ending hit's points include `ENDING_BONUS`.
- Nukes until the end → `"molten"`; freeze rays → `"frozen"`.
- `moonRam` on a fresh planet → `"shatter"`; `blackHole` → `"swallowed"`.
- A hit after the ending returns `{peopleLost:0, healthLost:0, points:0, ending:null}`.
- The sum of every hit's `peopleLost` across a full run equals
  `startPopulation` (±1).

- [ ] **Step 2: Run** `npm test -- --testPathPatterns=planet-smasher`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement the five modules** to the interfaces above.
- [ ] **Step 4: Run** the same command. Expected: PASS. Run `npm run type-check`.
- [ ] **Step 5: Commit** `feat(planet-smasher): game rules core`.

---

### Task 2: Progress, unlocks, store, version and test hooks

**Files:**

- Create: `lib/planet-smasher/{progress,unlocks,store,testHooks,version,changelog}.ts`
- Test: `lib/planet-smasher/__tests__/{progress,unlocks,store,changelog}.test.ts`
  (copy `lib/plane-builder/__tests__/changelog.test.ts`, change the imports)

**Interfaces (Consumes):** Task 1.
**Produces:**

```ts
// unlocks.ts — points are a lifetime total and are never spent; crossing a threshold unlocks
export type Unlockable =
  { kind: "tool"; id: ToolId } | { kind: "planet"; id: PlanetId };
export const UNLOCK_PATH: readonly { at: number; item: Unlockable }[];
export function isUnlocked(item: Unlockable, points: number): boolean; // asteroid & earth at 0
export function unlocksBetween(prev: number, next: number): Unlockable[];
export function nextUnlock(
  points: number
): { at: number; item: Unlockable } | null;
// progress.ts
export const PROGRESS_KEY = "planet-smasher:progress:v1";
export interface Progress {
  points: number;
  endingsSeen: EndingKind[];
  planetId: PlanetId;
  toolId: ToolId;
}
export const FIRST_ENDING_BONUS = 300;
export function freshProgress(): Progress; // 0 pts, [], "earth", "asteroid"
export function loadProgress(storage?: Storage | null): Progress; // bad/missing → fresh; never throws
export function saveProgress(p: Progress, storage?: Storage | null): void; // never throws
// store.ts (zustand, `create` from "zustand")
export type Phase = "playing" | "ending" | "ended";
export interface GameStore {
  progress: Progress;
  planet: PlanetState | null;
  phase: Phase;
  ending: EndingKind | null;
  lastUnlocks: Unlockable[];
  lastHit: { peopleLost: number; u: number; v: number; seq: number } | null;
  init(grid: PopulationGrid): void; // loads progress, creates planet
  selectTool(id: ToolId): void; // only if unlocked
  selectPlanet(id: PlanetId, grid: PopulationGrid): void; // only if unlocked; fresh planet
  hit(toolId: ToolId, u: number, v: number): HitResult; // applyHit + points + unlocks + save
  endingShown(): void; // "ending" → "ended"
  newPlanet(grid: PopulationGrid): void; // fresh state for the current planet, phase "playing"
  clearUnlocks(): void;
}
export const useGameStore: UseBoundStore<StoreApi<GameStore>>;
// testHooks.ts — mirror lib/plane-builder/testHooks.ts
export const TEST_HOOKS_ENABLED: boolean;
// window.__planetSmasher?: { fire(toolId, u, v): void; forceEnding(kind: EndingKind): void; state(): GameStore }
// version.ts
export const PLANET_SMASHER_VERSION = "1.0.0";
```

`UNLOCK_PATH` (lifetime points): meteorShower 30, megaBomb 120, nuke 300,
supervolcano 600, earthquake 1000, alienLaser 1500, planet mars 2000,
freezeRay 2600, moonRam 3400, planet ice 4200, blackHole 5200.

`hit` rules: when the hit returns an ending, phase → `"ending"`, and if this
ending kind isn't in `endingsSeen`, add it and add `FIRST_ENDING_BONUS`. While
the phase isn't `"playing"`, `hit` is a no-op that returns zeros. Points go up
by the result's points (plus the first-ending bonus). `lastUnlocks` gets
`unlocksBetween(old, new)` appended. `lastHit.seq` increments on every hit
with `peopleLost > 0` (the HUD pop-off watches it). Progress saves after
each hit that changed points.

Changelog 1.0.0 entry: date `2026-11-14`, title "Planet Smasher is here!",
highlights written for kids and parents (a full list is finalised in Task 9).

- [ ] **Step 1: Write the failing tests.** `unlocks`: `unlocksBetween(25, 130)`
      → `[meteorShower, megaBomb]`; `isUnlocked(asteroid, 0)`;
      `nextUnlock(5200) === null`. `progress`: a round trip through a fake
      Storage; `loadProgress` with `"{bad"` → fresh; with a storage whose
      `getItem` throws → fresh; `saveProgress` with a throwing `setItem` doesn't
      throw; an unknown `toolId` or `planetId` in storage falls back to the
      defaults. `store`: hitting until an ending sets phase `"ending"`, adds the
      first-ending bonus once, and a second planet ended the same way gets no
      bonus; `hit` during `"ending"` returns zeros and doesn't change points;
      `selectTool("nuke")` at 0 points is ignored. `changelog`: the copied
      test.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=planet-smasher`. Expected: FAIL.
- [ ] **Step 3: Implement** the six modules.
- [ ] **Step 4: Run** the tests and `npm run type-check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(planet-smasher): progress, unlocks and store`.

---

### Task 3: Route, home-screen app, textures and the interactive globe

**Files:**

- Create: `app/planet-smasher/page.tsx`, `app/planet-smasher/versions/page.tsx`
  (model them on `app/ship-builder/page.tsx` and `app/plane-builder/versions/page.tsx`;
  title "Planet Smasher", themeColor `#05060f`, manifest `/planet-smasher.webmanifest`,
  appleWebApp capable, apple-touch-icon `/planet-smasher-icons/apple-touch-icon.png`)
- Create: `components/planet-smasher/PlanetSmasher.tsx`, `VersionHistory.tsx` (copy
  Plane's, swapping the imports and wording), `scene/Stage.tsx`,
  `scene/tapGesture.ts`, `scene/planetTextures.ts`, `scene/Planet.tsx` (plain
  textured for now), `scene/Moon.tsx`
- Create: `public/planet-smasher.webmanifest` (copy the Ship one; landscape,
  `#05060f`), `public/planet-smasher-icons/{icon-192,icon-512,icon-512-maskable,apple-touch-icon}.png`
- Create: `public/planet-smasher/textures/{earth-day.jpg,earth-night.jpg}`,
  `public/planet-smasher/textures/CREDITS.md`
- Modify: `app/sitemap.ts` (add `/planet-smasher`, priority 0.8)
- Test: `components/planet-smasher/scene/__tests__/tapGesture.test.ts`,
  `components/planet-smasher/__tests__/PlanetSmasher.test.tsx`

**Interfaces:**

```ts
// tapGesture.ts
export const TAP_MAX_MOVE_PX = 8,
  TAP_MAX_MS = 400;
export function isTap(
  down: { x: number; y: number; t: number },
  up: { x: number; y: number; t: number }
): boolean;
// planetTextures.ts
export interface PlanetTextures {
  day: HTMLImageElement | HTMLCanvasElement;
  night: HTMLImageElement | HTMLCanvasElement | null;
  population: PopulationGrid;
}
export function loadPlanetTextures(id: PlanetId): Promise<PlanetTextures>; // cached per id
// Stage.tsx props
interface StageProps {
  onFire(u: number, v: number, point: Vec3): void;
  onHoldStart?(u: number, v: number, point: Vec3): void;
  onHoldMove?(u: number, v: number, point: Vec3): void;
  onHoldEnd?(): void;
  holdMode: boolean;
}
```

Textures (NASA, public domain): download Blue Marble NG
`https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg`
and Black Marble 2016
`https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg`
into the scratchpad. Resize with `sips -z 2048 4096` (day, `-s formatOptions 80`)
and `sips -z 1024 2048` (night, 75). Keep each under ~2 MB. CREDITS.md
names the source pages and says "NASA Earth Observatory, public domain".
The population grid comes from the night image drawn at 256×128
(`getImageData` luminance → `gridFromLuminance`). Mars and Frostia are
procedural in `planetTextures.ts`: a 1024×512 canvas filled with seeded
fractal value noise (a fixed seed, wrapping in u). Mars: rust tones with
dark maria and white polar caps. Frostia: pale blue-white with cyan cracks
and darker seas. Their population is noise-based "settlement" blobs (the
noise thresholded high) fed through `gridFromLuminance`, and a night canvas
with warm dots on those blobs.

Icons: draw a 512×512 SVG (a cracked Earth with a comet, on a dark
background) and rasterise it at 180, 192 and 512 with a throwaway Playwright
script in the scratchpad (`page.setContent` + `screenshot`). The maskable
version keeps the art inside the middle 80%.

Stage: an R3F `<Canvas dpr={[1,2]} camera={{position:[0,0,3.2], fov:45}}>` with
`<Stars>` (drei, count 3000), an ambient light of 0.15, and a directional
"sun" from the left `(-5, 1.5, 2)` at intensity 2.2, so a night side is
visible. drei `<OrbitControls enablePan={false} minDistance={1.6}
maxDistance={6} enableDamping autoRotate autoRotateSpeed={0.3}>`, with
autoRotate off for 4 s after any touch. Input: pointer down/up on the planet
mesh uses `isTap` → `onFire(uv)`. In `holdMode`, a press on the planet
disables the controls until release and streams `onHoldMove`. The Moon
(radius 0.27, grey, orbit radius 4, 60 s per lap) shows when `hasMoon`.
Load Stage with `next/dynamic` and `ssr: false` from `PlanetSmasher.tsx`.
Use `useWebGLSupport` from
`components/ship-builder/hooks/useWebGLSupport`; if WebGL is missing, show a
friendly full-screen message. For now `onFire` calls `useGameStore.getState().hit("asteroid", u, v)`.

Root layout: `fixed inset-0 bg-black text-white select-none touch-none overflow-hidden`,
and pad overlays with `env(safe-area-inset-*)` (Tailwind arbitrary values,
e.g. `pt-[env(safe-area-inset-top)]`).

- [ ] **Step 1: Write the failing tests.** `tapGesture`: 0 px in 100 ms → tap;
      9 px → not a tap; 0 px in 450 ms → not a tap. `PlanetSmasher.test.tsx`:
      with WebGL mocked off, it renders the fallback message; with it on (mock
      `next/dynamic` to render a stub), it renders `data-testid="planet-stage"`.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** the files above, add the textures and icons.
- [ ] **Step 4: Verify.** `npm test -- --testPathPatterns=planet-smasher`
      PASS, `npm run type-check`, `npm run lint`. Run `npm run dev`, open
      `/planet-smasher` with Playwright (scratch script, Chromium with
      `--use-angle=swiftshader`), take a screenshot, and look at it: a lit
      Earth, a night side, stars, the Moon. Fix it if not.
- [ ] **Step 5: Commit** `feat(planet-smasher): route, home-screen app and interactive globe`.

---

### Task 4: Lasting damage on the globe + HUD (odometer, health, points)

**Files:**

- Create: `components/planet-smasher/scene/DamagePainter.ts`, modify `scene/Planet.tsx`
- Create: `components/planet-smasher/ui/{Hud,Odometer,HealthBar}.tsx`
- Test: `scene/__tests__/DamagePainter.test.ts`, `ui/__tests__/Odometer.test.tsx`, `ui/__tests__/Hud.test.tsx`

**Interfaces:**

```ts
// DamagePainter.ts — owns the canvases; pure 2D canvas, no three imports except CanvasTexture wrappers
export type StampKind =
  "crater" | "scorch" | "lava" | "crack" | "ice" | "trench";
export interface StampEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
} // canvas px
export function stampEllipses(
  u: number,
  v: number,
  radius: number,
  width: number,
  height: number
): StampEllipse[];
// rx = radius/(2π)·W / max(cos(lat), 0.15), ry = radius/π·H; extra copies at cx±W when it crosses the seam
export class DamagePainter {
  constructor(lights: CanvasImageSource | null);
  readonly damage: HTMLCanvasElement; // 2048×1024 RGBA: colour of the wreck, alpha = coverage
  readonly glow: HTMLCanvasElement; // 1024×512 RGB: lava/fire glow (emissive, both sides)
  readonly lights: HTMLCanvasElement; // 2048×1024 city lights, erased (destination-out) where hit
  readonly height: HTMLCanvasElement; // 512×256 grey, 128 = flat, darker = crater
  stamp(
    kind: StampKind,
    u: number,
    v: number,
    radius: number,
    opts?: { angle?: number; length?: number }
  ): void;
  reset(lights: CanvasImageSource | null): void;
  version: number; // ++ per stamp; Planet sets texture.needsUpdate when it changes
}
```

Stamp looks: crater = dark brown rim ring plus a dark centre, height dip, and
lights erased. Scorch = soft black-brown radial with lights erased and a
little glow at the edge. Lava = orange-red blotches on damage and strong
glow. Crack = a jagged polyline of `length` (default 0.6 rad of arc) along
`angle`, glowing orange core, height groove. Ice = white-blue radial on
damage, lights erased. Trench = a short glowing line segment (the laser
calls it every tick). Use radial gradients and seeded jitter so stamps don't
look stamped. After every stamp, `version++`.

Planet material: `MeshStandardMaterial({ map: day, roughness: 0.9, metalness: 0, bumpMap: heightTex, bumpScale: 4, displacementMap: heightTex, displacementScale: 0.03, displacementBias: -0.015 })`
on a `SphereGeometry(1, 192, 96)`, patched in `onBeforeCompile`. Add uniforms
`damageMap`, `glowMap` and `lightsMap`. After `#include <map_fragment>`:
`vec4 dm = texture2D(damageMap, vMapUv); diffuseColor.rgb = mix(diffuseColor.rgb, dm.rgb, dm.a);`.
Before `#include <emissivemap_fragment>`, add lights × night factor
(night = `smoothstep(0.1, -0.2, dot(normal, sunDirView))`, so pass the sun
direction in view space as a uniform each frame) plus glow × 1.5 to
`totalEmissiveRadiance`. Wrap each canvas in a `CanvasTexture` (sRGB for
damage/lights/glow, linear for height). When `painter.version` changes,
update in `useFrame` (at most once per frame).

Odometer: `Odometer({ value })` shows the planet's population as a
comma-grouped number with one column per digit (10 digits for Earth; leading
zero columns are hidden). Each column is a 0–9 strip that slides with
`transform: translateY(-n·10%)` and a 350 ms ease-out CSS transition. It
subscribes through `useGameStore.subscribe`, writes to refs (not React
state), and so doesn't re-render on hits. The digits use `font-mono
tabular-nums text-3xl sm:text-5xl font-black`. Next to it goes the planet's
people icon. A red "−1,204,883" pop-off floats up and fades whenever
`lastHit.seq` changes (a CSS keyframe in `app/globals.css`, `@keyframes
ps-popoff`).
HealthBar: a thick rounded bar, green → yellow → red by health. Points: ⭐ +
the number, top-right.

Wire it up: `Planet` owns a `DamagePainter`. When `onFire` hits, the store
`hit` runs and `painter.stamp(TOOLS[tool].stamp, u, v, radius)` is called,
unless the stamp is `"none"`. (Task 6 moves both calls to impact time.)

- [ ] **Step 1: Write the failing tests.** `stampEllipses(0.999, 0.5, 0.1,
2048, 1024)` returns 2 ellipses, one with `cx > 2000` and one with `cx < 50`.
      At v = 0.98 the rx is capped (`rx ≤ 0.1/(2π)·2048/0.15 + 1`). At v = 0.5,
      `ry ≈ 0.1/π·1024`. `DamagePainter.stamp` bumps `version` (jsdom: mock
      `getContext` with `jest-canvas-mock` if it's in devDependencies; otherwise
      stub the 2D context methods used). `Odometer` with `value=8_000_000_000`
      renders 10 digit columns and the text `8,000,000,000` for screen readers
      (`aria-label`). `Hud` shows the points.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify.** Unit tests, type-check and lint PASS. Dev-server
      screenshot after 6 scripted taps (`window.__planetSmasher.fire`; wire the
      test hook in `PlanetSmasher.tsx` now, behind `TEST_HOOKS_ENABLED`): craters
      and darkened lights show, the odometer is lower, the health bar is shorter.
      Include one hit at u = 0.999 and check that both seam sides are marked.
- [ ] **Step 5: Commit** `feat(planet-smasher): lasting damage and population odometer`.

---

### Task 5: Arsenal, planet picker and unlock celebration

**Files:**

- Create: `components/planet-smasher/ui/{Arsenal,PlanetPicker,UnlockToast}.tsx`
- Modify: `PlanetSmasher.tsx` (layout and wiring)
- Test: `ui/__tests__/{Arsenal,PlanetPicker,UnlockToast}.test.tsx`

Arsenal: a bottom tray that scrolls sideways (`overflow-x-auto snap-x`).
One tile per `TOOL_ORDER` entry: `min-w-[72px] h-[72px] rounded-2xl`, the
emoji at `text-4xl`. Selected tile: a thick ring and a scale-up. Locked: dimmed,
🔒 overlay and the `at` value under it as `⭐ 600`. `aria-label` = the tool's
name, words allowed for screen readers (add `name` to `ToolSpec` if Task 1
didn't). A tile in cooldown shows a radial sweep (a conic-gradient overlay
with the angle via a CSS variable set on the ref). A tap on a locked tile
gives a little shake (`@keyframes ps-shake`) and no change.

PlanetPicker: a top-left button showing the current planet icon. It opens a
row of planet bubbles (locked ones show 🔒 ⭐cost). Choosing one loads its
textures and calls `selectPlanet`. The painter resets.

UnlockToast: when `lastUnlocks` is non-empty, show a big centre card for
2.5 s: the item's emoji growing in with a sparkle burst and "NEW!". Several
unlocks show one after another. Then `clearUnlocks()`. The new arsenal tile
pulses until it's tapped once (a session-only flag is fine).

`Stage.holdMode` = the selected tool's mode is `"hold"`. Each fire respects
`cooldownMs`: a tap during cooldown does nothing.

- [ ] **Step 1: Write the failing tests.** With 0 points, the Arsenal shows
      one unlocked tile (asteroid) and nine locked ones; a click on a locked
      tile doesn't change `progress.toolId`; with 700 points, the supervolcano
      tile is enabled. PlanetPicker with 2000 points: Mars is enabled and Frostia
      is locked. UnlockToast shows "NEW!" for a pending unlock and calls
      `clearUnlocks` after the timers (`jest.useFakeTimers`).
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify.** Tests, type-check and lint. Dev-server screenshot
      at 1180×820 (iPad mini landscape) and 820×1180 (portrait): the tray,
      odometer and picker don't overlap and the tiles are ≥ 64 px.
- [ ] **Step 5: Commit** `feat(planet-smasher): arsenal, planets and unlocks`.

---

### Task 6: Weapon effects (all ten tools)

**Files:**

- Create: `components/planet-smasher/scene/effects/{EffectLayer,effectQueue,Projectile,Blast,MeteorShower,Eruption,Quake,LaserBeam,FreezeWave,MoonRam,BlackHoleDrop,particles}.ts(x)`
- Modify: `Stage.tsx` / `PlanetSmasher.tsx` so fires go through the queue
- Test: `scene/effects/__tests__/effectQueue.test.ts`

**Interfaces:**

```ts
// effectQueue.ts — pure
export interface ActiveEffect {
  id: number;
  toolId: ToolId;
  u: number;
  v: number;
  point: Vec3;
  startedAt: number;
}
export const MAX_EFFECTS = 12;
export function pushEffect(
  list: ActiveEffect[],
  e: Omit<ActiveEffect, "id">,
  nextId: number
): ActiveEffect[]; // drops the oldest beyond MAX
// Each effect component:
interface EffectProps {
  effect: ActiveEffect;
  planetRadius: number;
  onImpact(u: number, v: number, point: Vec3): void;
  onDone(): void;
}
```

Damage moves to impact time. `onImpact` calls the store `hit(toolId, u, v)` and
`painter.stamp(...)`. The meteor shower calls `onImpact` 10 times at jittered
points within 0.25 rad. The laser calls it each 125 ms tick at the current
aim. The earthquake stamps a crack with a random angle. The effects
(world units, planet radius 1, all particles in one pooled
`InstancedMesh`/`Points` per effect with additive blending and no shadows):

- **Projectile** (asteroid): a lumpy rock (an icosahedron with jittered vertices),
  flying from off-screen toward the point in 0.6 s with a glowing tail. On
  impact: a white flash sprite, a shockwave ring (a flat ring on the surface
  tangent plane, growing to radius 0.25 and fading over 0.8 s) and 60 debris
  particles.
- **MeteorShower**: 10 small streaks staggered over 1.5 s, each with a
  mini-flash.
- **Blast** (megaBomb, nuke): a falling dot, then a big flash. The nuke adds
  a rising glowing mushroom (two stretched spheres, orange → grey, 2 s) and
  a ring to radius 0.45.
- **Eruption** (supervolcano): the surface bulge glows for 0.8 s, then a
  column of lava particles and an ash cloud puff.
- **Quake**: the crack stamp glows in along its length over 1 s with a slight
  camera shake (≤ 0.02 units, 0.6 s).
- **LaserBeam**: a saucer (a flat cylinder + dome, glowing rim) hovering at
  1.8 × the aim direction, with a cylinder beam to the surface. It's mounted
  while held, follows the aim, and fades out on release.
- **FreezeWave**: a bluish expanding cap glow over 1.2 s.
- **MoonRam**: the Moon (or a spawned one) leaves orbit and flies into the
  point over 2.5 s, growing in size. Impact at contact.
- **BlackHoleDrop**: a tiny black sphere with a swirling accretion ring
  drops in over 1 s. Impact on arrival.
  Camera shake is shared: `shake(amount, seconds)` exported from
  `effects/particles.ts`. If the user prefers reduced motion, skip the shake
  (`prefersReducedMotion` from `components/game-audio/channels`).

- [ ] **Step 1: Write the failing test.** `pushEffect` with 12 live effects
      plus one more → length 12 and the oldest id gone.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the effects and the layer, and move hits to impact time.
- [ ] **Step 4: Verify.** Tests, type-check and lint. Dev-server: fire every
      tool through the test hook (add `window.__planetSmasher.unlockAll()` in dev
      and e2e only) and screenshot each mid-effect. Check that each one is
      visibly distinct. Fire ten asteroid taps in 1 s and check that the
      cooldown limits the shots to 3.
- [ ] **Step 5: Commit** `feat(planet-smasher): weapon effects`.

---

### Task 7: The four endings and New planet

**Files:**

- Create: `components/planet-smasher/scene/endings/{chunks,Shatter,Molten,Frozen,Swallowed,EndingStage}.ts(x)`
- Create: `components/planet-smasher/ui/EndingOverlay.tsx`
- Test: `scene/endings/__tests__/chunks.test.ts`, `ui/__tests__/EndingOverlay.test.tsx`

**Interfaces:**

```ts
// chunks.ts — builds the pre-cracked planet once per planet (cache it)
export const CHUNK_COUNT = 24;
export function assignChunks(
  positions: Float32Array,
  seeds: Vec3[]
): Uint16Array; // nearest seed per triangle (by centroid)
export function fibonacciSeeds(n: number, jitter: number, seed: number): Vec3[];
export function buildChunkGeometries(
  radius: number,
  seeds: Vec3[]
): THREE.BufferGeometry[];
// non-indexed SphereGeometry(1, 96, 48) split per chunk + a closed inner face per chunk (a dark molten-orange fan to the centre) so the chunks look solid
```

`EndingStage` reads `phase` and `ending`. When phase becomes `"ending"`:

- **Shatter** (2.5 s): glowing seams (a bright orange crack stamp along seed
  borders, or a glow pulse) for 0.7 s, then the globe hides and the chunks,
  sharing the planet material, fly outward with spin (velocity along the
  seed direction 0.6–1.4 + random spin) and fade at distance. Plus a
  big flash, 300 debris particles and a ring shockwave.
- **Molten** (2.5 s): uniforms ramp the whole surface to red-hot (`uMolten`
  0 → 1 mixes in an orange-red noise pattern and strong emissive), with a
  heat-glow halo sprite. It ends as a glowing lava ball (it stays).
- **Frozen** (2.5 s): `uFrozen` 0 → 1 frosts the surface white-blue with a
  sparkle, then shatters like Shatter with icy chunks (the chunk material is
  tinted ice).
- **Swallowed** (3 s): the black hole grows to radius 0.4, and the planet
  stretches (scale toward the hole on one axis), spirals and shrinks into it
  with an accretion ring. Then only the hole remains, then it pops away.
  After the animation, call `endingShown()`. EndingOverlay (phase `"ended"`): a
  big ending emoji (💥 shatter, 🌋 molten, 🧊 frozen, 🕳️ swallowed), the
  points earned for this planet counting up, and a huge **🔄 New planet**
  button (≥ 88 px). The button calls `newPlanet` and resets the painter, and
  the globe scales in from 0 with a sparkle (0.8 s). Taps on the planet during
  `"ending"`/`"ended"` are ignored (the store already no-ops; also skip the
  effects).

- [ ] **Step 1: Write the failing tests.** `fibonacciSeeds(24, 0.2, 1)`
      returns 24 unit vectors, the same for the same seed. `assignChunks` gives
      every triangle a chunk index < 24 and uses every chunk.
      `buildChunkGeometries(1, seeds)` returns 24 geometries with position counts
  > 0. EndingOverlay in phase `"ended"` shows the New planet button and
  > clicking it calls `newPlanet`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify.** Tests, type-check and lint. Dev-server:
      `forceEnding` for each of the four endings, with screenshots mid and end,
      and New planet afterwards gives an undamaged Earth and a full odometer.
- [ ] **Step 5: Commit** `feat(planet-smasher): four endings and new planet`.

---

### Task 8: Sound

**Files:**

- Create: `components/planet-smasher/audio/{sfx,soundSetting,useSoundUnlock}.ts`, `ui/SoundToggle.tsx`
- Test: `audio/__tests__/sfx.test.ts`

Mirror `components/plane-builder/audio/soundSetting.ts` (key
`planet-smasher:ui:sound`, but **default on**: `parse: raw => raw !== "off"`,
`serialize: v => v ? null : "off"`) and `useSoundUnlock.ts`. Read
`components/game-audio/primitives.ts` and `components/plane-builder/audio/planeSynth.ts`
for how a `VoiceEngine` is built. Produce:

```ts
export type Cue =
  | "launch"
  | "impactSmall"
  | "impactBig"
  | "nuke"
  | "rumble"
  | "zapStart"
  | "zapStop"
  | "freeze"
  | "moonWhoosh"
  | "blackHoleHum"
  | "endShatter"
  | "endMolten"
  | "endFrozen"
  | "endSwallowed"
  | "unlock"
  | "uiTap"
  | "newPlanet";
export function playCue(cue: Cue, intensity?: number): void; // no-op when sound is off or no AudioContext
export const TOOL_CUES: Record<ToolId, { launch: Cue | null; impact: Cue }>;
```

Make the booms brown-noise bursts through a lowpass sweep plus a sine
sub-drop. Zaps are a saw tone with vibrato, looping while held. The freeze is
high filtered noise with a glassy tinkle. Endings are a layered big boom
(shatter), a rumble swell (molten), a crackle and tinkle (frozen), and a
descending whoosh (swallowed). The unlock is a happy arpeggio. Put the
SoundToggle (🔊/🔇, 56 px) top-right. Wire the cues into the effects, the
endings, the UnlockToast and the New planet button.

- [ ] **Step 1: Write the failing test.** Every `ToolId` has an entry in
      `TOOL_CUES`; `playCue` with sound off doesn't touch `AudioContext` (mock).
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4:** Tests,
      type-check and lint PASS.
- [ ] **Step 5: Commit** `feat(planet-smasher): sound`.

---

### Task 9: Offline, e2e, perf budget, CI and the 1.0.0 notes

**Files:**

- Create: `public/planet-smasher-sw.js` (copy `public/plane-builder-sw.js`,
  replace the prefix/path with `planet-smasher`, and the model prefix with
  `/planet-smasher/textures/`), `components/planet-smasher/hooks/useServiceWorker.ts`
  (copy Plane's; precache the two texture URLs instead of the models)
- Create: `components/planet-smasher/scene/RenderInfoProbe.tsx` (copy Plane's,
  exposing `window.__planetSmasherRenderInfo`)
- Create: `e2e/planet-smasher.spec.ts`; Modify: `e2e/perf.spec.ts`,
  `e2e/perf-budget.json`, `.github/workflows/ci.yml`, `lib/planet-smasher/changelog.ts`

e2e (`e2e/planet-smasher.spec.ts`, software WebGL launch args as in
`e2e/plane-builder.spec.ts`):

- `@smoke` "loads the globe and arsenal": the canvas is visible, the asteroid
  tile is selected and the odometer reads `8,000,000,000`.
- `@smoke` "tapping the planet fires and drops the population": tap at the
  canvas centre and wait until the odometer's aria-label number is <
  8,000,000,000.
- `@smoke` "dragging rotates without firing": a drag of 120 px across the
  planet leaves the population unchanged after 1.5 s.
- "reaching an ending shows New planet": `forceEnding("shatter")` → the New
  planet button is visible; click it → the odometer is back at 8,000,000,000.
- "progress survives a reload": fire until points > 0, reload, and the points
  are the same.
  CI: add a matrix entry "WebGL planet smasher" (`files:
e2e/planet-smasher.spec.ts`, `args: --project=chromium --project=webkit
--project=ipad`, workers 1, browsers `chromium webkit`), modelled on the
  Plane entry.
  Perf: add the scenes `planet-earth-idle` (after the load settles) and
  `planet-earth-shatter` (`forceEnding("shatter")`, measured 1.2 s in) to
  `e2e/perf.spec.ts` using `__planetSmasherRenderInfo`, then run
  `PERF_UPDATE=1 npx playwright test e2e/perf.spec.ts --project=chromium -g planet`
  and commit the new budget keys only (don't let it rewrite other scenes'
  numbers. Check the diff).
  Changelog 1.0.0 highlights (kid-friendly): pick a planet and smash it with 10
  tools, from asteroids to a black hole; every hit leaves marks and the
  population counter rolls down; four ways for a planet to end; earn stars to
  unlock new tools and new planets (Mars and Frostia); works offline once added
  to the home screen.

- [ ] **Step 1:** Write the e2e spec. Run
      `npx playwright test e2e/planet-smasher.spec.ts --project=chromium`. Expected:
      PASS (the features exist; fix any gaps found).
- [ ] **Step 2:** Add the SW and hook, the probe, the perf scenes and the CI
      entry. Run the perf command above; check the budget diff only adds planet
      keys.
- [ ] **Step 3:** Run `npm run validate`. Expected: all green.
- [ ] **Step 4: Commit** `feat(planet-smasher): offline, e2e, perf budget and 1.0.0 notes`.

---

## Ship

After Task 9 and the whole-branch review: push the branch, open a PR (with
the AI-disclosure footer), wait for CI, and merge when it's green. The deploy
runs from `main`.
