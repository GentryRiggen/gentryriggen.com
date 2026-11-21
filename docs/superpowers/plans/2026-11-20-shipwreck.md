# Shipwreck 1.0 — implementation plan

**Spec:** `docs/superpowers/specs/2026-11-20-shipwreck-design.md` (read it; it is the authority).

**Worktree:** `/Users/griggen/dev/code/personal/gr-shipwreck`, branch
`feat/shipwreck` off `origin/main`. Its own `node_modules` (npm ci). Use
`npx next build --webpack` / `npx next dev --webpack` if Turbopack complains.

## Global Constraints

- Follow `CLAUDE.md`, `docs/games/foundation.md` and `.claude/skills/new-game/SKILL.md`.
  Prettier: double quotes, semicolons, trailing commas (es5), 80 cols.
  `export default function` components, `interface` for props, `@/` alias,
  Tailwind only (no inline styles, no CSS modules; dynamic per-frame values
  in 3D are fine as three.js uniforms/props). Light and dark mode for any
  DOM UI (the game itself is a dark night scene; DOM panels may be dark in
  both, but write `dark:` variants where colours differ).
- Target Safari 15.0: no `Object.hasOwn`, `structuredClone`, `.at()`,
  `.findLast()`, `.toSorted()` etc. (ESLint enforces; use `lib/game-kit/compat.ts`).
- Static export: no API routes, no SSR-only APIs.
- **No people shown in danger.** No figures, no death counts, no screams or
  cries in sound. Lifeboats leave with lanterns and no visible figures.
- Sim is pure TypeScript in `lib/shipwreck/sim/`, deterministic, no
  `Math.random`, no React/three imports.
- **Coordinate conventions (shared by every task):** ship frame: metres,
  origin on the keel line at midships (half of LBP), `x` forward (+ toward the
  bow), `y` to port, `z` up from the keel. Earth frame: `x` east-ish along the
  ship's initial heading, `z` up with `z = 0` the still sea surface, `y` to port
  of the initial heading. three.js mapping: `three.x = x`, `three.y = z`,
  `three.z = -y` (right-handed). Time `t` = seconds after the collision;
  `CLOCK_START_S = 23*3600 + 40*60` (11:40 PM); the clock shown is
  `(CLOCK_START_S + t) mod 86400`.
- Slug `shipwreck`, title `Shipwreck`, version `1.0.0`, save key `shipwreck:v1`,
  test hooks `createTestHooks("__shipwreck", ...)`, analytics site `shipwreck`.
- Release rule: until 1.0.0 ships, keep editing the 1.0.0 changelog entry.
- Each task: conventional commits (`feat(shipwreck): ...`), one or more per
  task; run `npm run lint`, `npm run type-check`, and the tests you touched
  (plus `npm test` at the end of the task). Do not run the full e2e suite
  except where the task says so.
- Screenshots: save to `/Users/griggen/dev/code/personal/gr-shipwreck/.screenshots/task-<N>/`
  (git-ignored: add `.screenshots/` to `.gitignore` in Task 1) and list the
  file paths in your report.
- Performance: an iPad mini 6 (A15) must hold 60 fps in normal views and
  never drop below 30 fps; whole scene ≤ 160 draw calls and ≤ 450k triangles
  at the top quality tier; never block the main thread for more than 8 ms in
  one frame (chunk long sim work).

---

## Task 1: Scaffold the game on the game kit

Do every step of `.claude/skills/new-game/SKILL.md` for slug `shipwreck`,
title `Shipwreck`, with offline play (step 8b). Read
`docs/games/foundation.md` first. Use Flamelings (`app/flamelings`,
`components/flamelings`, `lib/flamelings`) as the reference implementation of
every step; grep for `flamelings` across `lib/theme`, `lib/game-kit`,
`lib/analytics`, `firestore.rules`, `firestore-tests`, `components/admin`,
`firebase.json`, `app/sitemap.ts`, `app/__tests__`, `components/designs/design1`,
`playwright.config.ts`, `.github/workflows/ci.yml`, `CLAUDE.md` and mirror
each place for shipwreck.

Specifics:

- Description: "A realistic sinking-ship simulator. Watch the Titanic's last
  night unfold, or open the hull yourself and see if she stays afloat."
- Theme colour `SHIPWRECK_THEME_COLOR = "#05080f"` (near-black night blue).
  `statusBar: "black"`.
- Icons: `scripts/shipwreck-icons.mjs` renders the four versioned PNGs from an
  inline SVG (dark navy night sky with a few stars, a four-funnel liner
  silhouette tilted bow-down into a glassy sea with a warm porthole row and a
  reflection). Use whatever the Flamelings icon script uses to rasterise.
- Root client component `components/shipwreck/Shipwreck.tsx` inside
  `<GameShell>`, for now a placeholder title screen: "Shipwreck" title, the
  parent line from the spec, a disabled-looking "Start" (Task 5 builds the
  real UI), the UpdatePill, and a "What's new" link to `/shipwreck/versions`.
  All bars use `SAFE_*`. Add `components/shipwreck` to `GAME_DIRS`.
- `lib/shipwreck/version.ts` (`SHIPWRECK_VERSION = "1.0.0"`),
  `lib/shipwreck/changelog.ts` with a 1.0.0 entry (title "The Titanic's last
  night", plain-words bullets for a child or parent: watch the real night,
  try What if?, speed and camera controls, works offline) and its test;
  `app/shipwreck/versions/page.tsx` (copy Flamelings'), `app/shipwreck/version.json/route.ts`.
- `lib/shipwreck/save.ts`: versioned, validated, salvaging save under
  `shipwreck:v1`, modelled on `lib/flamelings/save.ts` (backups, never throw,
  never overwrite main on failed read). Shape v1:
  `{ v: 1, settings: { sound: boolean, speed: 1|10|30|100, camera: CameraId },
seen: { realNight: boolean, endings: OutcomeId[] }, lastWhatIf: string[] }`
  where `CameraId = "orbit"|"bridge"|"stern"|"lifeboat"|"underwater"|"cinematic"`
  and `OutcomeId = "sank"|"floated"|"broke-in-two"`. Unknown values default.
  Persist through `useVisibilityPause({ onPersist })`. No tab lock (the save
  is settings and a few flags; last writer wins) — note that in a code comment.
- CLAUDE.md: a "### Shipwreck releases" section like Planet Smasher's, paths
  `components/shipwreck`, `lib/shipwreck`, `app/shipwreck`, `public/shipwreck-icons`,
  `public/shipwreck-sw.js`.
- Analytics: site `shipwreck`; events in `lib/analytics/gameEvents.ts`:
  - `shipwreck_start`: `{ mode: enum ["real","whatif"], opened: int 0..16 }`
  - `shipwreck_end`: `{ mode: enum ["real","whatif"], outcome: enum ["sank","floated"], minutes: int 0..600 }` (minutes after the collision when she sank, or when the player left / reached 6:00 AM if she floated).
  - `shipwreck_camera`: `{ camera: enum ["orbit","bridge","stern","lifeboat","underwater","cinematic"] }`, sampled lower than the others (follow the existing sample-rate conventions).
    Mirror in `firestore.rules`, `firestore-tests/gameEvents.test.ts` (every
    event and enum value through the rules), the admin Games tab, and
    `lib/shipwreck/analytics.ts` wrapper functions. Run `npm run test:rules`
    (needs Java 21+; if Java is missing, say so in the report).
- Test hooks: `lib/shipwreck/testHooks.ts` with `createTestHooks("__shipwreck", {...})`;
  for now expose `getScreen()`. Later tasks extend it.
- e2e: `e2e/shipwreck.spec.ts` (loads `/shipwreck`, title visible, no console
  errors; one `@smoke` layout test: no horizontal scroll at 744, 1133, 390
  widths) and `e2e/shipwreck-offline.spec.ts` (copy Flamelings' offline spec:
  load online, go offline, reload, the title screen shows). Add both to a CI
  group in `.github/workflows/ci.yml` (a new "WebGL shipwreck" group next to
  planet smasher's is fine) and `shipwreck` to the `ipad` project's
  `testMatch`. Also make sure the `changes` job's path filters include the
  shipwreck paths if it lists game paths.
- Terminal command `shipwreck` in `commandResponses.tsx` (+ tests) and a line in
  `components/designs/design1/Hobbies.tsx`; sitemap entry (+ test); hosting
  headers (+ test in `app/__tests__/jimHosting.test.ts`).
- Add `.screenshots/` to `.gitignore`.
- Run the game's two e2e specs on chromium locally and report the result.

## Task 2: The physics sim (hydrostatics, flooding, breakup, descent)

Pure TypeScript in `lib/shipwreck/sim/` and the ship data in
`lib/shipwreck/ships/`. Read `lib/ship-builder/sim/README.md` for this repo's
sim style (deterministic fixed step, events), but write a new, physical model.

### Ship data — `lib/shipwreck/ships/types.ts`, `titanic.ts`, `index.ts`

```ts
export type ShipId = "titanic";
export interface HullStation {
  x: number;
  offsets: readonly (readonly [z: number, halfBreadth: number])[];
}
export interface Compartment {
  id: string;
  label: string;
  kind: "peak" | "hold" | "boiler" | "engine" | "shaft" | "stern";
  fromX: number;
  toX: number;
  aftBulkheadTopZ: number;
  fwdBulkheadTopZ: number;
}
export interface Opening {
  compartmentId: string;
  areaM2: number;
  zLow: number;
  zHigh: number;
  x: number;
  side: "port" | "starboard";
}
export interface ScriptedEvent {
  t: number;
  kind: "steam-start" | "steam-stop" | "rocket" | "boat-lowered";
  index?: number;
}
export interface ShipSpec {
  id: ShipId;
  name: string;
  year: number;
  lbp: number;
  loa: number;
  beam: number;
  depth: number;
  draught: number;
  displacementT: number;
  kg: number;
  lcg: number; // mass and its centre (ship frame)
  stations: readonly HullStation[]; // ≥ 41 stations, aft to fwd, the full hull to the top of the shelter deck
  sheerZ: (x: number) => number; // height of the uppermost continuous deck edge at x
  superstructure: { fromX: number; toX: number; topZ: number }[]; // buoyant volume above the hull once sealed decks submerge (coarse boxes)
  compartments: readonly Compartment[]; // the 16 watertight compartments, aft to fwd
  realNight: readonly Opening[]; // the iceberg damage
  girder: { hogMaxNm: number; sagMaxNm: number }; // hull girder strength
  scripted: readonly ScriptedEvent[]; // historical non-physics events (t seconds after collision)
  funnels: { x: number; baseZ: number; topZ: number; dummy: boolean }[];
  decks: { name: string; z: number }[]; // Boat, A, B, C, D, E, F, G, Orlop, Tank top (for lights by deck and the diagram)
  seaDepthM: number; // 3,800 for Titanic
}
```

Titanic values: research and approximate (spec has the particulars). The
offset table should describe a fine bow, parallel mid-body (~half the length),
a counter stern with overhang, flat bottom with bilge radius; block
coefficient ≈ 0.68–0.70 at the design draught. Bulkhead positions and tops
from the plans (D/E deck); compartment labels in plain words ("Front peak",
"Hold 1", "Boiler room 6", ... "Engine room", "Turbine room", "Shaft tunnel",
"Back peak"). Scripted: steam venting 11:50 PM → 12:30 AM; 8 rockets from
12:45 AM about every 7 min; 20 boats lowered between 12:45 AM and 2:05 AM in
historical order (Boat 7 first). The model's funnels/decks come from this
spec too (Task 3), so keep it the single source of truth.

### Model — `lib/shipwreck/sim/`

- `hydrostatics.ts`: for a body (a slice of the hull between `xFrom` and `xTo`,
  sections clipped there) at pose `(heave, pitch, roll)` compute submerged
  volume, centre of buoyancy (ship frame), and waterplane area, by clipping
  each station's section polygon (both sides) against the sea plane expressed
  in the ship frame, integrating along x (trapezoid/Simpson). Must work at any
  pitch up to ±90° (sections become wholly in or out; fine stations keep it
  smooth — resample the offset table to ≥ 120 stations at load). Include the
  superstructure boxes as buoyant volume **only while sealed** (a box floods
  once its lower edge is below the sea for long enough; model it as one more
  compartment-like volume that fills through a large opening).
- `flooding.ts`: each compartment holds a water volume; its free surface is a
  horizontal earth-frame plane, found by solving volume(level) inside the
  compartment's clipped sections (bisection is fine). Inflow per opening:
  `q = Cd * A * sqrt(2 g Δh)` with `Cd ≈ 0.6`, `Δh` = sea head over the
  opening minus inside head (use the opening's submerged part; negative →
  outflow is allowed but rare). Spill: when a compartment's water surface
  rises above a bulkhead top at that bulkhead's x, water flows over into the
  neighbour (weir law `q = Cw * b * h^1.5`, `b` = beam at that height). Downflooding: once the sea reaches the
  sheer (deck edge) over a compartment, it floods from above through hatches,
  doors and portholes at a large effective area (tune). Optional pumps
  (≤ 0.5 m³/s in boiler rooms while lights are on) if they help calibration.
- `body.ts`: rigid-body motion in heave, pitch and roll (surge/sway ignored
  except a small drift; yaw fixed) with weight = lightship + water,
  buoyancy from hydrostatics, added mass and strong damping. Quasi-static is
  acceptable while slow, but the final plunge, the stern settling back after
  the break and the stern going vertical must be dynamic. Fixed step
  `SIM_STEP_S` (choose; e.g. 0.25 s, finer during fast phases is fine as long
  as it is deterministic).
- `girder.ts`: shear force and bending moment along the length from the
  difference of weight per metre (lightship distribution + water) and
  buoyancy per metre. Breakup when |moment| at any station exceeds
  `girder.hogMaxNm` (hogging) or `sagMaxNm`. Calibrate Titanic's strength so
  the real night breaks between 2:05 and 2:25 AM at a station between funnels
  3 and 4. After the break: two bodies (`bow`, `stern`) each with its own
  slice of hull, compartments (the compartment at the break is split by x),
  mass, and a huge opening at the break face. Bow sinks steeply; stern settles
  back, floods, rises near vertical, sinks.
- `descent.ts`: once a body is fully under, it falls to `seaDepthM` with
  drag (terminal speed ~ 10–15 m/s for the bow, the stern tumbling more
  slowly with some spin), and lands: the bow ploughs into the mud nose first
  and settles upright; the stern lands hard. Descent may be compressed in time
  (e.g., ×6) — expose the real time and the shown time separately in the
  track so the UI can say "falling 3,800 m".
- `run.ts`: `simulate(spec, openings, opts?): SimTrack` and an incremental
  `createSimRunner(spec, openings)` with `advance(budgetMs)` that appends
  frames until done (for the UI to compute in chunks without blocking a frame
  > 8 ms). Run until both bodies rest on the floor, or until 6:00 AM
  > (`t = 22800`) if she still floats ("floated").
- `track.ts`: `SimTrack = { frames: SimFrame[]; events: SimEvent[]; outcome:
"sank" | "floated"; sankAtT: number | null; brokeAtT: number | null; breakX: number | null; endT: number }`.
  Frames every 1 s of sim time while slow and every 0.1 s during fast phases.
  `SimFrame = { t; bodies: BodyPose[]; water: number[] (0..1 fill per
compartment, aft→fwd, same order as spec.compartments; after the break,
still one entry per original compartment); waterAboardT; trimDeg; listDeg;
power: number (0..1, flickers before failing) }`.
  `BodyPose = { part: "whole" | "bow" | "stern"; x; y; z; pitch; roll; yaw }`
  (earth frame position of the body's ship-frame origin, radians; pitch
  positive = bow down). `sampleTrack(track, t): SimFrame` interpolates
  (binary search, lerp, slerp-equivalent for angles). `eventsBetween(track, t0, t1)`.
- `events.ts`: closed `SimEventKind` = `"collision" | "steam-start" |
"steam-stop" | "rocket" | "boat-lowered" | "last-boat" | "forecastle-under"
| "bridge-under" | "funnel-falls" | "lights-flicker" | "lights-out" |
"breakup" | "bow-under" | "stern-under" | "bow-lands" | "stern-lands" |
"floating-steady"`, each `{ t, kind, index? }`. Scripted events fire only
  while she is afloat and unbroken. `funnel-falls` (index 0..3) when that
  funnel's base x is well under water or the pitch past its stays' limit
  (funnel 1 first, ~2:15 AM on the real night). Lights flicker from ~2:15
  and go out at the breakup (or when the engine/turbine room floods to its
  dynamos).
- `lib/shipwreck/sim/README.md`: the model, the units, the calibration and
  the pass criteria table.

### Tests (Jest, in `lib/shipwreck/sim/__tests__/`)

- Hydrostatics: a box hull's volume, centre of buoyancy and waterplane area
  match the analytic values (level, trimmed, heeled, pitched 60° and 90°).
- Titanic upright and undamaged floats level within ±0.1 m of `draught` and
  ±0.2° trim, displacement within 3% of `displacementT`, GM positive
  (≈ 0.6–2.5 m).
- All pass criteria in the spec's sim table (real night timings, break
  location and trim, list, What-if 1–4 floats, 5 later or floats, 7 sooner,
  determinism).
- `sampleTrack` interpolation and `eventsBetween` edges.
- A whole real-night `simulate` finishes in < 2 s on the test machine
  (print the time), and `advance(8)` never runs past ~10 ms.
- Add `scripts/shipwreck-sim.ts` (`npx tsx scripts/shipwreck-sim.ts [ids...]`)
  that prints the timeline of events with clock times, trim/list samples
  every 10 min, the break station and the outcome. Paste its real-night output
  in your report.

## Task 3: The Titanic 3D model

`components/shipwreck/model/`. Procedural (no downloaded models: licences),
built at load from `lib/shipwreck/ships/titanic.ts` plus a detail recipe
`components/shipwreck/model/titanicRecipe.ts`. Use three.js r186 via R3F.
Read Ship Builder's `components/ship-builder/scene/` for batching/instancing
patterns (`PartBatcher.ts`, `KitInstances.tsx`) but write fresh code.

- **Hull** from the same offsets (resampled, smooth, with sheer, the counter
  stern overhang and flare at the bow). Black topsides, a thin gold/buff sheer line along the
  shelter deck, red antifouling below the load waterline, white boot-top line.
  Procedural textures generated once into canvases (no network):
  plate seams (strakes and butts), rivet rows as a normal map, subtle
  weathering. Anchor recesses and anchors at the bow, the name "TITANIC" at
  bow and "TITANIC / LIVERPOOL" at the stern (a canvas text texture is fine).
- **Superstructure** decks Boat, A, B, C with the white house walls, the
  enclosed forward A-deck promenade windows, B-deck windows, the bridge and
  wheelhouse, officers' quarters, the gymnasium, the grand-staircase dome and
  the aft first-class lounge skylights, the 2nd-class staircase house, docking
  bridge aft. Wooden deck planks (tan, plank lines) on exposed decks.
- **Portholes and windows**: thousands, instanced (one `InstancedMesh` per
  type), emissive warm light (2700 K-ish, slightly varied per window) driven
  by a shared uniform `uPower` (0..1) and a per-instance `deck` attribute so
  lights can die deck by deck and flicker. Lit windows must drive bloom.
- **Funnels**: four raked (~ 2°) elliptical funnels, White Star buff with black
  tops, the thin black bands, steam pipes and whistles on the front of each,
  the 4th a dummy (no smoke). Each funnel its own group so Task 4 can make the
  first one fall (pivot at its base).
- **Masts** fore (crow's nest) and main, the wireless aerial wires between
  them, the funnel guy wires, stays (thin lines, `LineSegments`, few draw calls).
- **Davits and lifeboats**: 16 Welin davits with wooden lifeboats (white hulls,
  wooden gunwales, covers) and 4 collapsibles; each boat addressable by index
  0..19 for Task 4 (stowed → lowered → afloat).
- **Deck fittings**: cowl ventilators (instanced), cargo cranes in the fore and
  aft well decks, hatches, bollards/bitts, the forward mast's crow's nest,
  capstans, benches (instanced), railings (instanced posts + line rails).
- **Underwater gear**: rudder, the centre 4-blade and two 3-blade wing
  propellers with shaft bossings (visible when the stern rises).
- **Breakup**: `<TitanicModel breakX={number | null} />` renders either one
  group or two (`bow`, `stern`) split at `breakX` (ship frame): geometry is
  built in ~1.5 m slices or with clipping planes so any `breakX` works; the
  break faces show a jagged torn edge with dark interior decks (a simple
  procedural ragged cap is fine). Expose refs/handles so the scene can pose
  `whole`, `bow` and `stern` from `BodyPose` each frame (no React re-render
  per frame).
- **LOD / quality tiers**: `quality: "high" | "medium" | "low"`; medium and low
  drop small instanced fittings, rivet normal detail, railings and rigging.
  At `high` the whole ship ≤ 90 draw calls and ≤ 300k triangles. Merge static
  geometry per material.
- **Model viewer for checking**: do not add a route. Add a dev/e2e-only query
  `?model` on `/shipwreck` (off in the shipped build) that shows the model on a neutral stage with orbit controls and
  `window.__shipwreck.setModelView({ breakX, power, quality })`.
- Screenshots (Playwright script or e2e with `PWDEBUG` off, chromium,
  1133×744): bow 3/4 day-lit neutral stage, stern 3/4 showing rudder and props,
  side profile, top-down, broken at breakX with both halves, lights at power 1
  and 0. Save to `.screenshots/task-3/` and list them.
- Unit tests for the recipe math (positions within the hull's bounds, counts
  of portholes/boats/funnels, break split puts every slice on one side).

## Task 4: The night scene, cameras and effects

`components/shipwreck/scene/`. Drives the Task 3 model from a playback store
and the Task 2 track. Ship from the dev `?model` stage to the real scene.

- **Playback store** `lib/shipwreck/playback.ts` (zustand vanilla store or a
  tiny subscribe/getSnapshot store): `{ track | null, runner progress, t,
playing, speed: 1|10|30|100, camera: CameraId, quality }` and actions
  `play/pause/setSpeed/seek(t)/setCamera`. The R3F frame loop advances `t` by
  `delta * speed` (clamped at the computed end of the track; `seek` clamps
  to computed frames) and reads `sampleTrack` per frame via refs, never React
  state per frame. Speed drops to ×1 automatically for the breakup and the
  final plunge on the cinematic camera (a "slow-mo" window around `brokeAtT`
  and `sankAtT`, restoring the chosen speed after), unless the player has
  touched the speed in the last 10 s.
- **Renderer**: `<Canvas>` with `dpr={[1, 2]}`, ACES or AgX tone mapping, sRGB
  output, `gl={{ antialias: true, powerPreference: "high-performance" }}`;
  drei `PerformanceMonitor` steps quality `high → medium → low` (and DPR) on
  sustained low fps and back up when fast; expose current tier in the store.
  A `RenderInfoProbe` like Ship Builder's writes
  `window.__shipwreckRenderInfo` (draw calls, triangles incl. passes) in
  dev/e2e only.
- **Sky**: moonless starlit night — a large star dome (thousands of stars,
  points with size/colour variety, gentle twinkle), a faint Milky Way band,
  a very faint horizon glow; deep blue-black gradient. No moon.
- **Sea**: flat calm "like glass": a large ocean with a custom shader —
  low-amplitude long swell (a few cm), fine ripple normals (procedural noise,
  no network), Fresnel, a planar reflection (drei `MeshReflectorMaterial` or a
  hand-rolled half-resolution reflector with blur) that mirrors the ship's
  lit windows and rockets, fog to the horizon. Quality tiers lower the
  reflection resolution/disable blur. A foam/disturbance ribbon along the
  ship's waterline (from the hull sections and the body pose each frame, or a
  depth-based intersection in the shader) and white water where decks
  submerge; spray and turbulence at the break and when the stern goes under.
- **Iceberg**: a large, irregular, dark iceberg (procedural noisy geometry,
  subtle subsurface-blue tint) drifting slowly astern of the starboard side
  after the collision, out of view by ~12:30 AM.
- **Lighting**: very low cool ambient/hemisphere starlight; the ship lit
  by its own windows (bloom) plus a few cheap point/spot lights near the decks
  (≤ 4 real lights), fading with `power`. Rocket flashes light the whole scene
  briefly (white).
- **Effects**: steam venting from funnels 1–3 between `steam-start` and
  `steam-stop` (dense white plumes, roar handled by Task 6), thin smoke at
  other times; distress rockets (a trail rising ~ 200 m and a burst of white
  stars falling, on each `rocket` event); lifeboats (Task 3 boats) lowered on
  `boat-lowered` (swing out, descend the falls over ~ 2 min of sim time) and
  then rowing slowly away to a ring 200–800 m out, each with a lantern; the
  first funnel falling (pivot, splash, wave) on `funnel-falls`; sparks and
  debris at `breakup` (deck chairs/planks as instanced debris floating
  after); bubbles and air-burst boils where the ship goes under; the stern's
  propellers and rudder rising clear.
- **Underwater**: when the camera is under `z = 0`: dark blue-black fog with
  depth, the sea surface seen from below, marine snow particles, the ship's
  lights glowing under then dying, rising bubbles. Sea floor at
  `seaDepthM`: dark mud with noise, the bow ploughing in with a slow mud cloud,
  the stern landing; a faint light cone from the camera ("submersible
  lamp") so the wreck is readable.
- **Cameras** (`CameraId`): `orbit` (drag to orbit, pinch/scroll to zoom,
  bounded, never below the sea floor), `bridge` (near the starboard bridge
  wing looking aft along the boat deck), `stern` (poop deck looking forward),
  `lifeboat` (low at water level ~ 400 m off the port quarter, slow drift — the
  classic view), `underwater` (follows the bow down), `cinematic` (default:
  scripted shots per phase — wide establishing, along the hull, rocket
  close-up, lifeboat view, the break, the plunge from the boats, follow the
  bow down, wreck reveal). Smooth transitions (critically damped), camera
  never inside geometry.
- **Calm-sea clipping**: the sea must not show inside the hull from above (the
  decks occlude) — check it, including at the break faces (render a dark
  interior cap or use a stencil so the sea surface isn't visible inside the
  open hull).
- Test hooks: extend `__shipwreck` with `seek(t)`, `setSpeed`, `setCamera`,
  `getState()` (t, phase, events seen, quality tier), `getRenderInfo()`.
- Screenshots (chromium, 1133×744 and 744×1133, cinematic and lifeboat
  cameras): the spec's list (11:45 PM, 1:00 AM rocket + boats, 2:10 AM, 2:18 AM
  breakup, underwater descent, wreck on the floor). For this task the scene can
  be reached through the `?model`-style dev entry or a temporary dev entry; Task 5
  wires the real UI. Save to `.screenshots/task-4/`.

### Task 4 amendments (2026-11-21, the user's V1 asks — these win over the text above)

- **Fly around, zoom in.** The `orbit` camera is a free camera: one-finger
  drag orbits, pinch / scroll zooms from ~3 m to ~3 km, two-finger drag pans
  (and right-drag / shift-drag on desktop), double-tap a spot on the ship to
  fly the camera to look at it closely. Damped and smooth. Never below the sea
  floor, never inside the hull (except X-ray). Touching the scene while on a
  preset or cinematic camera switches to `orbit` from the current view (no
  jump).
- **X-ray cutaway mode** (`xray: boolean` in the playback store): the hull and
  superstructure go translucent (cheap: a fresnel ghost material, depth-write
  off, rendered after the opaque interior), the 16 watertight compartments and
  bulkheads show as faint outlines, and each compartment's water shows as a
  blue volume whose free surface level comes from the sim each frame (from
  `SimFrame.water[i]` and the body pose: a box/prism clipped to the hull
  section at that level is fine; the free surface stays level with the sea,
  not with the ship). Openings show as red glowing gashes. Works on both
  halves after the break. Sea surface fades so the hull below the waterline is
  visible.
- **Place pins** (`PlaceId = "bridge" | "grand-staircase" | "boiler-room-6" |
"engine-room"`, data in `lib/shipwreck/places.ts` with ship-frame positions
  from the real plans and a short kid-friendly fact each): tap a pin to fly
  the camera there (it turns X-ray on for the interior places) and show the
  water level at that place live ("Water here: 2.1 m deep"). Each place has a
  simple readable interior blockout visible in X-ray (Bridge: wheelhouse
  with the wheel and telegraphs; Grand Staircase: the stairs and the glass
  dome; Boiler Room 6: boilers in a row with furnace doors glowing; Engine
  Room: two big reciprocating engines and the turbine) — realism of
  placement and scale beats detail. Pins ride with the ship (and with the
  right half after the break).
- Sound is deferred to 1.1 unless time remains; skip Task 6 for V1.
- Deadline: this task must finish by ~03:30 MST; prioritise the real night
  looking right + free camera + X-ray + pins over secondary effects (iceberg
  drift, debris, marine snow come last).

## Task 5: Game UI and flow

`components/shipwreck/ui/`, `components/shipwreck/Shipwreck.tsx`. Icon-first,
64 px targets for the main controls, every HUD item explains itself on tap
(copy the `HelpCard` pattern and `lib/flamelings/help.ts` idea into
`lib/shipwreck/help.ts`). Dark translucent panels (night theme), legible on
the dark scene, `dark:` variants where colours differ.

- **Title screen**: the scene behind (a slow orbit of the lit, undamaged ship
  at 11:39 PM), "Shipwreck" title, the parent line from the spec (small),
  ship picker: a Titanic card (name, "1912", length 269 m) selected, then
  three greyed silhouette cards "Britannic", "Lusitania", "Edmund Fitzgerald"
  marked "Coming soon". Two big buttons: **The real night** (clock icon) and
  **What if?** (iceberg icon). "What's new" link (version label) to
  `/shipwreck/versions`.
- **What if? editor**: a side-profile hull diagram (SVG from the spec's
  compartments, with the bulkheads, decks, funnels outline) — tap
  compartments to toggle a hole (red jagged mark), presets "Like the real
  night" and "Clear", a count "4 holes", a **Go** button. Opening sizes:
  each tapped compartment gets the real night's opening for that
  compartment if it had one, otherwise a 0.2 m² hole at ~3 m above the keel
  on the starboard side. The last choice is remembered (`lastWhatIf`).
- **Computing**: start the sim runner when the player picks a mode; advance it
  in chunks (≤ 8 ms per frame) while a short 11:40 PM intro plays (the berg
  scraping past, a brief caption "11:40 PM — The iceberg scrapes along the
  starboard side"). Playback can begin once ~ 10 min of track exist; the
  timeline shows computed vs not-yet-computed.
- **HUD** (all pad with `SAFE_*`):
  - Top bar: back (to title), ship clock big ("1:47 AM"), the time since the
    iceberg ("2 h 07 min after the iceberg"), sound toggle, help (?).
  - Speed buttons ×1 ×10 ×30 ×100 (current highlighted) and play/pause.
  - Timeline scrubber along the bottom, from 11:40 PM to the end, with event
    icons (rockets, first boat, lights out, break, sinks), drag to seek
    (within computed), tap an icon to jump there.
  - Camera buttons (icons for the six cameras).
  - Compartment diagram (collapsible, starts open on landscape, closed on
    phone portrait): the side profile with water filling each compartment
    live (blue), holes marked, the sea level line tilted with trim.
  - Stat chips: water aboard ("12,400 t of water"), bow down ("4.2°"), lean
    ("1.1° to port"), power ("Lights on/flickering/out"). Each chip opens a
    HelpCard ("Bow down: how far the front of the ship tips down. Titanic
    broke apart at about 15°.").
  - Event captions: a calm caption for each event with the clock time
    (e.g. "12:45 AM — The first lifeboat is lowered", "2:18 AM — The lights
    go out. The ship breaks in two."), auto-hiding, never covering the main
    controls.
- **End card**: for "sank": "Titanic sank at 2:20 AM, 2 hours 40 minutes
  after hitting the iceberg. She lies 3,800 m (2.4 miles) down." plus a short
  "What really happened" note: the Carpathia arrived at 4:10 AM and picked up
  the lifeboats; and buttons Watch again / Try What if? / Look at the wreck
  (free orbit on the floor). For "floated": "She stayed afloat! With N holes,
  her bulkheads held." Endings recorded in `seen.endings`; first-time endings
  get a small celebration.
- **Analytics**: `shipwreck_start` on Go/Real night, `shipwreck_end` on end
  card (or on leaving after ≥ 1 min), `shipwreck_camera` on camera change.
- **Test hooks**: extend `__shipwreck` with `startReal()`, `startWhatIf(ids)`,
  `getScreen()`, `getOutcome()`.
- **Keyboard**: Space play/pause, 1–4 speeds, ←/→ seek 1 min (desktop nicety).
- Reduced motion: cinematic camera cuts instead of moving shots, fewer
  particles, no screen shake.
- e2e (`e2e/shipwreck.spec.ts`): real night reaches the end card through
  `seek` (no `waitForTimeout`), What if with holes 1–4 ends "floated", camera
  buttons switch, help chip opens; `@smoke` layout at 744, 1133, 390 with the
  HUD open (no sideways scroll, controls not under the safe areas).
- Screenshots of title, editor, HUD at 1:00 AM and the end card (iPad portrait
  and landscape, phone 390×844) to `.screenshots/task-5/`.

### Task 5 amendments (2026-11-21, after audit #1 — these win over the text above)

- **Priority (cut from the bottom if late; feature freeze 05:00):** (1) title
  with The real night + What if?; (2) HUD: clock, play/pause, speeds,
  timeline scrub with event icons, **X-ray toggle button** and **place pin
  buttons** (Bridge, Grand Staircase, Boiler Room 6, Engine Room) that call
  the scene store's `setXray` / `flyToPlace`, camera buttons for the cameras
  the store lists; (3) end card; (4) What if? editor; (5) compartment
  diagram, stat chips + help cards; (6) captions. Drop the ship picker's
  "Coming soon" cards and keyboard shortcuts if short on time.
- **Every time shown comes from the sim** (frame time / event `realT`; the
  end card uses the track's real sank time, e.g. "2:15 AM"), never a
  hard-coded historical time. Historical facts in text are fine ("the real
  Titanic sank at 2:20 AM") when labelled as history.
- `trackEnd` maps the `broke-in-two` ending to outcome `sank`; derive
  `SHIPWRECK_CAMERAS` from `CAMERA_IDS` (Task 1 adversarial review minors).
- Sim follow-up: `PLOUGH_TIME_S` in `lib/shipwreck/sim` is 0.8 real seconds
  (~0.5 s on screen at the ×6 descent); raise to ~5 s real and update its test.
  Make `lib/shipwreck/sim/__tests__/perf.test.ts` log-only when
  `process.env.CI` is set (keep the assertion locally).
- Version: bump to `1.0.0` with a new top changelog entry (0.1.0 "Coming
  soon" is live on main and stays below it). Never change the icon files.

## Task 6: Sound

`components/shipwreck/audio/` on `useResilientAudio()` and
`components/game-audio/primitives.ts` (read `components/planet-smasher/audio/`
for this repo's style). Toggle via the save's `settings.sound` and
`createChannelSettings` as the other games do. Nothing before the first tap;
ambient session; reduced motion softens; all voices well under 0.2 gain,
rate-limited, through `audio.engine()`.

- Beds: gentle lapping of a calm sea; the faint hum of the ship's machinery
  (stops when power fails); a cold, quiet night tone. Underwater: muffled low
  rumble, distant creaks.
- Cues: the iceberg scrape (long grinding), steam venting roar (loud,
  continuous between steam-start/stop, ducked at speeds > ×10), rocket whoosh
  and pop, davit falls creaking as boats lower, rising hull creaks and groans
  with trim, rushing water as decks submerge, the funnel falling (crash +
  splash), the breakup (deep tearing, booms), the final plunge (rushing,
  bubbling), the bow landing (distant thud). No human voices of any kind.
- Speed-aware: at ×30/×100 compress or skip short cues and keep beds; events
  skipped by a seek never fire sounds.
- Tests for the cue scheduler (which events make which cue, rate limiting,
  seek skipping) with the existing audio test helpers.

## Task 7: Performance budget, release review, polish and ship prep

- Add Shipwreck scenes to `e2e/perf.spec.ts` (read how it handles Ship Builder
  and Plane Builder): at least "11:45 PM cinematic" and "2:18 AM breakup"
  at the high tier, reading `window.__shipwreckRenderInfo`; run
  `PERF_UPDATE=1 npx playwright test e2e/perf.spec.ts --project=chromium`
  and commit the updated `e2e/perf-budget.json`. Confirm ≤ 160 draw calls
  and ≤ 450k triangles; if over, optimise (merge, instance, tier) before
  updating the budget.
- Run the `game-release-review` skill (`.claude/skills/game-release-review/SKILL.md`)
  against the whole game and fix what it finds.
- Run `npm run lint && npm run format:check && npm run type-check && npm test`,
  `npm run test:rules`, `npx next build --webpack`, and the shipwreck e2e
  specs on chromium, webkit (`@smoke`) and the ipad project. Report every
  result.
- Final screenshots: iPad mini portrait 744×1133 and landscape 1133×744 of
  every spec moment, plus phone 390×844 HUD, to `.screenshots/final/`.
- Update the 1.0.0 changelog entry to match what shipped.
