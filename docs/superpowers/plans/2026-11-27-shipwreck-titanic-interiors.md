# Shipwreck 1.15: Go inside the Titanic — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Gentry's CLAUDE.md overrides apply: overlap task N's review with task N+1's implementer, one implementer at a time, one combined review per ordinary task, Minor findings folded into the next task's brief.

**Goal:** Walk in through glowing doors on the Titanic's deck, down the Grand Staircase (Boat, A, B decks), into a B deck corridor with three suites, by lift to Scotland Road on E deck and a third-class cabin, with the sea rising inside room by room, lights failing, and a joystick that feels right in narrow halls.

**Architecture:** Rooms are walk areas (2D outlines on decks, as the open decks are) from per-ship data on a room kit (`lib/shipwreck/interior/`), merged into the Titanic's `WalkMap`. `stepWalker` gains ramps (stairs you walk down), seams (open edges between rooms), tagged links (deck doors, a lift), interior-only feel rules and a water callback. The look is merged kit geometry with one custom shader (baked lamp light, per-room power, a torch), drawn by `components/shipwreck/interior/Interior.tsx` only while the walker is inside (current zone plus seamed zones). Water per room stands at the sea's level above the bulkhead deck (X-ray compartment level below it), eased, drawn with X-ray's clip-above-level approach.

**Tech Stack:** Next 16, React 19, react-three-fiber, three.js, zustand, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-27-shipwreck-titanic-interiors-design.md` (read it first; its rulings are decisions, not suggestions).

## Global constraints (every task)

- Deck behaviour must not change: every existing test in `lib/shipwreck/walk/__tests__/` and `components/shipwreck/scene/__tests__/` passes **unchanged**. New behaviour is keyed on `area.interior`.
- The sim is never written; no golden track or sim test changes. `lib/shipwreck/sim/` is untouched (so `npm run test:sims` is not needed for this feature).
- `lib/` never imports `components/`. Safari 15 compat lint (`lib/game-kit/compat.ts` for `at`, `findLast` …; no `requestIdleCallback`). No per-frame allocations in `useFrame` code (scratch objects, as `WalkRunner.tsx`).
- No new three.js lights (they recompile every material). Interior lighting lives in its own shader.
- Kid UI: picture buttons only, words only in `aria-label`; the walk HUD's 80 px round buttons (`BIG_OFF`, `BOARD` in `WalkHud.tsx`).
- Not walking on the Titanic = the interior is not built and costs nothing. Existing `e2e/perf-budget.json` entries must not change.
- New unit tests are pure and fast (normal lane). If one takes over ~2 s, move it to `jest.sims.js`.
- Commits: conventional, one per task, trailer `Assisted-by: Claude`.

## Expensive checks (run once, not per task)

- **Baseline (controller, before Task 1):** `npx playwright test e2e/shipwreck-walk.spec.ts --project=chromium` and `npx playwright test e2e/perf.spec.ts --project=chromium` (keep `perf-results.json` as the baseline).
- **After Task 3** (it rewires `WalkRunner` and `CameraRig`): `npx playwright test e2e/shipwreck-walk.spec.ts --project=chromium`.
- **Ship time (Task 9):** full `npm run validate`, the walk spec plus the new interior spec, and the perf spec (existing budgets unchanged, two new scenes added).
- Sims: not needed (no sim, engine or balance change).

## Review focus (for every reviewer)

1. A deck area behaves exactly as before (seams, ramps, links, feel rules and `waterZ` only touch interior areas or default to the old maths).
2. The walker can never end outside every outline, cross a seam into a room at a different height, or be held in a corner.
3. Nothing interior is built, drawn or stepped when not walking on the Titanic; nothing interior shows after the break.
4. `CameraRig` always restores the scene FOV when walk ends or the walker leaves the interior.
5. No allocations or `find` over all blockers per substep in hot paths.

---

### Task 1: The walker learns ramps, seams, links and interior areas

**Model:** Opus. **Review:** ordinary (one combined spec + quality review). Extra check for the reviewer: diff `step.test.ts` is unchanged and green.

**Files:**

- Modify: `lib/shipwreck/walk/types.ts` (types, `floorZ` with `y`, tuning constants), `lib/shipwreck/walk/step.ts`, `lib/shipwreck/walk/swim.ts` (`placeWalker` passes y), `components/shipwreck/scene/walkCamera.ts` (`deckEyes` passes y)
- Create: `lib/shipwreck/walk/__tests__/interiorStep.test.ts` (small synthetic maps, not the Titanic data)
- Modify: `lib/shipwreck/walk/README.md` (a new "Inside" section)

**Interfaces (produces):**

- `WalkArea` gains optional `interior?: true`, `ramp?: { from: V2; to: V2; dropM: number }`, `axis?: readonly [V2, V2]`, `kind?: string`, `noWalk?: true`.
- `floorZ(map, areaId, x, spec, y = 0)`: a ramp's floor is `deckZAt + raiseM − dropM · u`, `u` the clamped projection of (x, y) on `from → to`.
- `Seam { a: string; b: string; at: readonly [V2, V2] }`; `WalkMap.seams?: readonly Seam[]`.
- `Stair.kind?: "stair" | "door" | "lift"` (missing = stair).
- `WalkMap.blockersByArea?` (or a module-level `WeakMap<WalkMap, Map<string, Blocker[]>>` built on first use) so `resolveBody` loops only its area's blockers.
- `StepContext` gains `waterZ?(areaId: string, x: number, y: number): number` (earth level of water over that point; default: `seaZ` at the feet, today's maths) and `interiorsOpen?: boolean` (default true).
- `StepResult.via?: { kind: "door" | "lift" | "stair"; id: string }`.
- Constants (feel numbers are added in Task 4): `WALK_INSIDE_SPEED_MS = 3`, `WALK_LIFT_MAX_DEPTH_M = WALK_KNEE_DEPTH_M`.

**Rules to build:**

- `moveInOutline`: a hit on a seam edge (match the segment both ways, 1 mm tolerance; precompute edge → neighbour per area once per map) crosses into the neighbour: switch `sub.area`, continue the remaining motion in the neighbour's outline (keep the 4-pass limit across both).
- `resolveBody` skips seam edges. The "never leave the outline" undo tests the area the walker is in now.
- `takeStairs`: `door` links do nothing when `interiorsOpen === false`; a `lift` does nothing when the arrival's water depth (via `waterZ`) is over `WALK_LIFT_MAX_DEPTH_M`; set `via` when a link is taken.
- In an `interior` area: `input.jump` is ignored (no jump starts; one in progress lands), speed is `WALK_INSIDE_SPEED_MS`, `overSeaRail` never runs.
- `depthAt` uses `ctx.waterZ` when given, and `floorZ` with y.

**Steps:**

- [ ] Write `interiorStep.test.ts` first (two rooms joined by a seam at equal height; a ramp room between two floors; a door link and a lift link; a blocker in one room):
  - walking across a seam changes `area` and keeps moving at full speed; the eyes' floor does not jump at the seam;
  - walking down a ramp lowers `floorZ` smoothly (no substep change over 0.1 m);
  - a wall edge still stops and slides (old behaviour) while a seam edge does not;
  - a door link moves the walker and reports `via`; with `interiorsOpen: false` it does not;
  - a lift with deep water at the arrival does not move the walker;
  - no jump starts in an interior area; deck areas still jump;
  - inside speed is 3 m/s, deck speed 4 m/s;
  - `waterZ` drives `depthM` inside; without it, `depthM` equals the old sea maths;
  - a blocker in room A does not affect room B.
- [ ] Run `npx jest lib/shipwreck/walk` — new tests fail, old ones pass.
- [ ] Implement. Run `npx jest lib/shipwreck/walk components/shipwreck/scene/__tests__/walkCamera.test.ts components/shipwreck/scene/__tests__/WalkRunner.test.tsx` and `npm run type-check` — all green, old test files untouched.
- [ ] README "Inside" section (ramps, seams, links, interior rules, `waterZ`).
- [ ] Commit: `feat(shipwreck): walker ramps, seams, links and interior areas`.

---

### Task 2: The room kit and the Titanic's rooms (blockout data)

**Model:** Opus. **Review:** ordinary.

**Files:**

- Create: `lib/shipwreck/interior/types.ts` (`InteriorMap`, `Room`, `RoomLook`, `InteriorLink`, `ShutDoor`, `Furniture`, `PieceId`), `lib/shipwreck/interior/kit.ts` (`corridor`, `cabin`, `flight`, `doorway`, `chamferReflex`), `lib/shipwreck/interior/merge.ts` (`withInterior(deckMap, interior): WalkMap`), `lib/shipwreck/interior/titanic.ts` (`TITANIC_INTERIOR`), `lib/shipwreck/interior/water.ts` (`roomWaterTarget`, `floodsFromSea`), `lib/shipwreck/interior/lights.ts` (`roomPower`, `torchOn`), `lib/shipwreck/interior/index.ts` (`interiorFor(ship)`), `lib/shipwreck/interior/README.md`
- Create tests: `lib/shipwreck/interior/__tests__/kit.test.ts`, `titanicMap.test.ts`, `water.test.ts`, `lights.test.ts`
- Modify: `lib/shipwreck/walk/index.ts` (`walkMapFor("titanic")` returns `withInterior(TITANIC_WALK, TITANIC_INTERIOR)`, memoised; `TITANIC_WALK` export unchanged)
- Modify: `lib/shipwreck/walk/titanicDecks.ts` only if a door needs a blocker gap (prefer not)

**Data:** the rooms in the spec's table, with real coordinates from `ships/titanic.ts` (decks, bulkheads `bulkheadX`), `titanicDecks.ts` (house blockers: the staircase house x 33.2–41.6, y ±5; the forward well's after wall at `BRIDGE_DECK_TO`, 76.2) and `places.ts` (`STAIR_X` 37.4). Three deck doors (GS port, GS starboard, third class), one lift link (`lift-b` ↔ `lift-e`), shut doors along every corridor (positions only), furniture (positions and `blocks` only; the art is Task 7). `gs-c` is `noWalk` (the roped flight's foot; drawn only).

**Pure functions:**

- `floodsFromSea(room, spec)`: true when the room's lowest floor point is no more than 1 m under its compartment's bulkhead top (`compartmentTopZ` from `xray.ts`, the compartment holding the room's middle x).
- `roomWaterTarget(room, ctx)` → earth z: sea rooms `seaZ` (flat 0 for the walk); compartment rooms `min(seaZ, waterLevel(samples, pose, fill))` with X-ray's samples (cached per compartment by the caller).
- `roomPower(power, depthM)`: `power` × (1 under 0.3 m, a flicker band 0.3–0.6 m from `flicker`-style deterministic dips, 0 at 0.6 m and over). `torchOn(roomPowerValue) = roomPowerValue < 0.35`.

**Steps:**

- [ ] Write the tests first:
  - `kit.test.ts`: `corridor` outline is CCW with the given width; `doorway` cuts matching segments into both outlines and returns the seam; `chamferReflex` cuts every reflex corner by 0.15 m and leaves convex ones; doorways are at least 1.1 m.
  - `titanicMap.test.ts` ("the interior holds together", the `maps.test.ts` of the inside): every outline CCW and simple; every seam segment is an edge of both rooms and the floors match within 2 cm along it; every room except `noWalk` is reachable from a deck door (BFS over seams and links); every link end is inside its area with 0.3 m clear of blockers; deck door outside ends are on the open-deck area within 0.5 m of the house face; every walkable point (sampled on a 0.25 m grid) has at least 2.1 m to the ceiling; every room with `water: "compartment"` lies inside one compartment's x range; every room in 1.15 floods from the sea; Scotland Road runs from x ≥ 69 to x ≤ −15 on E deck port; the spawn is unchanged.
  - `water.test.ts`: on the real night's track (`simulate(titanic, titanic.realNight)` once in `beforeAll`), the depth over each room's floor matches the spec's timeline within ±10 min (third cabin wet by 0:20 and waist deep by 0:45; Scotland Road forward wet by 0:25, midships (x 20) by 1:15, after end by 2:05; `gs-b` wet by 2:12; `gs-boat` dry before the break). A synthetic compartment room returns its compartment level, never above the sea. If simulating makes this file slow, use a precomputed fixture as `components/shipwreck/scene/__tests__/fixtures` does.
  - `lights.test.ts`: `roomPower` bands and `torchOn` threshold.
- [ ] Implement; `npx jest lib/shipwreck/interior lib/shipwreck/walk` and `npm run type-check` green.
- [ ] `lib/shipwreck/interior/README.md`: the kit, the data format, the water and light rules, "adding a ship's rooms" (for later ships, where layouts may be invented: write them as rulings in that ship's file header).
- [ ] Commit: `feat(shipwreck): room kit and the Titanic's interior map`.

---

### Task 3: First playable slice — blockout rooms in the scene

**Model:** Opus. **Review:** ordinary. **Then:** controller runs `npx playwright test e2e/shipwreck-walk.spec.ts --project=chromium`.

After this task a player can walk in through a door, down the staircase, along Scotland Road and out again, in grey boxes.

**Files:**

- Create: `components/shipwreck/interior/kit.ts` (rooms → merged `BufferGeometry` per zone: floor, walls from outlines, ceiling; a ramp's floor and stepped sides; one plain material for now, vertex-colour shaded by face direction so it reads), `components/shipwreck/interior/Interior.tsx`, `components/shipwreck/interior/doorGlow.ts` (the deck doors' warm lit doorway quads, one merged mesh), `components/shipwreck/interior/README.md`
- Create tests: `components/shipwreck/interior/__tests__/kit.test.ts` (each zone's geometry is finite, non-empty, triangle count per zone recorded; a ramp's floor vertices match `floorZ`)
- Modify: `components/shipwreck/scene/NightScene.tsx` (mount `<Interior>` next to `<XRay>`), `components/shipwreck/scene/runtime.ts` (`walkInside: boolean`, `walkRoom: string | null`, `walkLift: number` counter, `walkCameInBy: string | null`; `WalkInfo.area` already exists, add `inside`), `components/shipwreck/scene/WalkRunner.tsx`, `components/shipwreck/scene/CameraRig.tsx` (FOV), `components/shipwreck/scene/walkCamera.ts` (`WALK_INSIDE_FOV = 65`, `insideFov(current, inside, dt)` easing; eyes easing over 0.12 s after a door link), `lib/shipwreck/testHooks.ts` + `components/shipwreck/scene/sceneHooks.ts` (`getWalk().area`, `.inside`; `placeWalk(area, x, y, yaw)`, `enterDoor(id?)`, `goOutside()`)
- Modify tests: `components/shipwreck/scene/__tests__/walkCamera.test.ts` (FOV easing), `WalkRunner.test.tsx` (inside flag, break → sea, washed out)

**Behaviour:**

- `Interior.tsx` renders nothing unless `camera === "walk"` on a ship with `interiorFor(ship)`. Builds on the first walk frame on the Titanic, then `gl.compile(scene, camera)` with the interior visible once. Each frame: copy `runtime.part("whole")`'s world matrix onto its group; visible zones = the walker's room's zone plus zones seamed to it; nothing on the open deck except the door glow; nothing after the break (`runtime.broken`). Disposes geometry and materials on unmount or ship change.
- `WalkRunner`: passes `interiorsOpen: !broken` and a `waterZ` (Task 5 makes it the eased room level; for now `roomWaterTarget`). Writes `runtime.walkInside`, `walkRoom`; on `via.kind === "door"` into the interior, records `walkCameInBy`; on `via.kind === "lift"` bumps `walkLift`. Inside when she breaks (`broken` and the walker's area is interior): splash and float, exactly the existing "went in" path (`swimmerFrom`, `walkSplash`, `wentInWater`). Washed out (`inWater` inside): the same path.
- `walkInput.door` / `walkInput.outside` flags (like `jump`): the runner handles them (door: nearest deck door within 4 m whose inside is dry → its inside end; outside: pure helper `doorExit(map, cameInBy, depthAt)` in `lib/shipwreck/interior/` → the came-in door's outside end, else the nearest dry deck door, else `placeWalker`, else the sea). Unit-test `doorExit`.
- `CameraRig`: in walk, ease `cam.fov` toward 65 while `runtime.walkInside`, else 42 (the Canvas FOV); restore it whenever walk ends. `updateProjectionMatrix` only while it changes.

**Steps:**

- [ ] Tests first (`kit.test.ts`, `walkCamera.test.ts` FOV and eye easing, `doorExit` in `lib/shipwreck/interior/__tests__/doorExit.test.ts`, `WalkRunner.test.tsx` cases); run, see them fail.
- [ ] Implement. `npx jest components/shipwreck lib/shipwreck` and `npm run type-check` green.
- [ ] Manual: `npx next dev --webpack`, `/shipwreck`, Titanic, Walk; walk through the starboard staircase door, down to B, along the corridor; `placeWalk` to Scotland Road from the console. Screenshot the B foyer and Scotland Road into `.screenshots/interiors-task-3/` (not committed).
- [ ] Commit: `feat(shipwreck): walk into the Titanic's rooms (blockout)`.

---

### Task 4: The joystick in narrow halls

**Model:** Opus. **Review:** ordinary; the reviewer also plays the blockout in the dev server with the on-screen stick (touch emulation) and notes anything sticky.

**Files:**

- Modify: `lib/shipwreck/walk/step.ts`, `lib/shipwreck/walk/types.ts` (constants), `lib/shipwreck/walk/README.md`
- Create: `lib/shipwreck/walk/__tests__/hallFeel.test.ts` (the bot, on the real merged Titanic map)

**Rules (interior areas only; constants in `types.ts`):**

- `WALK_INSIDE_EASE_S = 0.15`: speed ramps from 0 to full over this from standing; stopping is instant. Needs the walker's current speed share in `WalkerState` (`moveShare?: number`, default 1 so deck states are unchanged).
- `SLIDE_KEEP = 0.75`, within 60° of the wall: after the slide, scale the motion back up to at least that share of the stick speed.
- Hall assist in rooms with `axis`: `HALL_SNAP_DEG = 10` (full), `HALL_FADE_DEG = 25` (none).
- Door funnel: `DOOR_ASSIST_M = 1.5`, `DOOR_ASSIST_DEG = 40`, up to half the sideways component toward the doorway's centre line (doorways = seams with a `corridor` or `cabin` on either side).
- Deep water wall: `WALK_WADE_STOP_M = 0.8`; a move into deeper water that is deeper than where the walker stands is undone, retried per axis (x, then y) so the walker slides along the edge.
- Never steer `yaw`.

**Steps:**

- [ ] Write `hallFeel.test.ts` first (the spec's "feel test" list: every corridor at 0°, ±10°, ±20°, ±30°; every doorway from ±1 m at ±30°; every flight up and down with the 0.1 m floor check; a seeded 2-minute random walk per zone, never outside, never stuck 3 s; plus a deep-water case with a synthetic `waterZ` showing the edge holds and sliding along it still moves). Keep it under ~2 s; fixed `dt` of 1/60 s.
- [ ] Run: expect failures on the doorway and angled-corridor cases before the helpers.
- [ ] Implement; tune the constants until green; existing `step.test.ts` unchanged and green.
- [ ] `npx jest lib/shipwreck/walk lib/shipwreck/interior`; `npm run type-check`.
- [ ] Commit: `feat(shipwreck): hall assist, door funnel and wall slide inside`.

---

### Task 5: Water inside

**Model:** Opus. **Review:** ordinary.

**Files:**

- Create: `components/shipwreck/interior/water.ts` (per-room water body and surface geometry with an `aRoom` attribute; shaders adapted from `XRay.tsx`'s `waterVertex`/`surfaceFragment`: discard above the room's level, surface clipped to the room's box in the ship frame, dark greenish teal, gentle ripples, slightly see-through, lit by `uRoomPower` and the torch uniforms Task 6 adds — stub them at 1 and off now), `lib/shipwreck/interior/easeLevel.ts` (`easeLevel(shown, target, dtReal, maxRate = 0.5)`, Infinity and −Infinity safe)
- Create tests: `lib/shipwreck/interior/__tests__/easeLevel.test.ts`, `components/shipwreck/interior/__tests__/water.test.ts` (one surface and one body per walkable or `noWalk` room in a zone; attributes in range)
- Modify: `components/shipwreck/interior/Interior.tsx` (per frame, for rooms in drawn zones plus the walker's room: target level → eased shown level, into a `Float32Array` uniform; a shared `runtime.interiorLevels` lookup the runner's `waterZ` reads), `components/shipwreck/scene/WalkRunner.tsx` (`waterZ` reads the eased level; falls back to the target when the room is not drawn), `components/shipwreck/scene/runtime.ts`

**Steps:**

- [ ] Tests first; run, fail; implement; `npx jest components/shipwreck lib/shipwreck`, `npm run type-check`.
- [ ] Manual check (dev server, real night): `placeWalk` into Scotland Road at x 20 and seek to 1:20: water across the floor ahead, creeping aft as time runs (try 10x). `placeWalk` to the B foyer at 2:08 looking down the roped flight: water climbing to the C landing. Screenshots to `.screenshots/interiors-task-5/`.
- [ ] Commit: `feat(shipwreck): the sea rises inside the Titanic's rooms`.

---

### Task 6: The look, part 1 — shader, lights-out, torch, and the Grand Staircase

**Model:** Opus. **Review:** ordinary (the reviewer looks at the screenshots against the spec's look notes and the perf budget).

**Files:**

- Create: `components/shipwreck/interior/materials.ts` (the `ShaderMaterial` family: vertex colour × baked lamp light × `uRoomPower[aRoom]` + night light floor + torch cone from `uEye`/`uLook`; lamp bulbs and glass HDR so bloom catches them; `uFlicker`/`uTime`; porthole glass tinted by sky colour uniform or sea green below earth y 0), `components/shipwreck/interior/textures.ts` (canvas: oak panel and grain, lino tiles, carpet, white panel moulding; drawn once, as `model/textures.ts`), `components/shipwreck/interior/pieces.ts` (the kit pieces as small geometry builders: balustrade, newel and cherub lamp, dome with iron lattice, clock panel relief, sconce, ceiling lamp, rope and posts, shut door, porthole, skirting and panel frames)
- Modify: `components/shipwreck/interior/kit.ts` (bake lamp light into vertex colours from `RoomLook.lamps`; group by material per zone: shell, wood, metal, glass/lamps, water), `Interior.tsx` (uniforms each frame: `frame.power`, flicker, per-room `roomPower(power, depth)`, torch on when `torchOn(walker's room power)`, eye and look direction, sky colour from the scene settings), the Grand Staircase dressing in `TITANIC_INTERIOR` (`look` fields)
- Maybe modify: `components/shipwreck/model/titanicRecipe.ts` (a hole in the boat deck roof, and any deck roof below, over the well) only if the screenshot from inside the well shows the exterior roof across it; check the draw count is unchanged with `scripts/shipwreck-model-shots.mjs`
- Create tests: `components/shipwreck/interior/__tests__/materials.test.ts` (uniform array sizes match room count limits; shader strings pass `components/shipwreck/scene/__tests__/shaderGuards.test.ts`'s rules if it scans folders, else add the folder), `pieces.test.ts` (finite, triangle counts)

**Budget (unit-tested in `kit.test.ts`):** the Grand Staircase zone at most 45k triangles and 6 meshes; whole interior at most 120k triangles; `buildInterior` logs its time (target under 40 ms on a laptop; note the number in the PR).

**Steps:**

- [ ] Tests first; implement; `npx jest components/shipwreck lib/shipwreck`; `npm run type-check`; `npm run lint`.
- [ ] Manual (dev server, real GPU, medium tier): the B foyer lit at 11:50 PM; the same at 2:13 (flicker); a flooded room at 0:45 in the third-class cabin (dark, torch on, never black). Screenshots `.screenshots/interiors-task-6/`.
- [ ] Commit: `feat(shipwreck): Grand Staircase look, lamps, lights-out and the torch`.

---

### Task 7: The look, part 2 — suites, third class, Scotland Road, shut doors

**Model:** Opus. **Review:** ordinary.

**Files:**

- Modify: `components/shipwreck/interior/pieces.ts` (brass bed, twin beds, wardrobe, washstand with marble top and basin, sofa, table, chairs, steel bunks with blankets, enamel washbasin, pipe runs, caged bulbs, steel doors, fire buckets or a hose reel), `components/shipwreck/interior/kit.ts` (shut doors along walls from `shutDoors`; furniture from `furniture`), `lib/shipwreck/interior/titanic.ts` (`look`, furniture and shut doors filled in for the suites, the cabin, the corridor and Scotland Road)
- Modify tests: `components/shipwreck/interior/__tests__/kit.test.ts` (B deck zone and E deck zone budgets: each at most 40k triangles and 6 meshes; whole interior still at most 120k), `lib/shipwreck/interior/__tests__/titanicMap.test.ts` (every blocking piece leaves every doorway and corridor passable: re-run the BFS with the body radius)
- Re-run `hallFeel.test.ts` (furniture blockers must not break it)

**Steps:**

- [ ] Tests first; implement; `npx jest components/shipwreck lib/shipwreck`; `npm run type-check`; `npm run lint`.
- [ ] Manual screenshots (`.screenshots/interiors-task-7/`): each suite, the third-class cabin, Scotland Road dry (11:50 PM) and flooding (1:30).
- [ ] Commit: `feat(shipwreck): first class suites, third class cabin and Scotland Road`.

---

### Task 8: Kid UI — go in, go outside, the lift

**Model:** Sonnet. **Review:** ordinary.

**Files:**

- Modify: `components/shipwreck/ui/WalkHud.tsx` (`Feel` gains `door: number` (the deck door within reach, −1 none: written by `WalkRunner` into `runtime.walkDoor` a few times a second) and `inside: boolean`; on deck with a door: the amber `BOARD`-style door button, `aria-label="Go inside"`, `data-testid="shipwreck-go-inside"`, sets `walkInput.door`; inside: no jump button, a big `aria-label="Go outside"` button, `data-testid="shipwreck-go-outside"`, sets `walkInput.outside`; the lift wipe: a dark CSS wipe keyed by `runtime.walkLift`, as the ripple keys on `walkSplash`, its keyframes in `app/globals.css`, respecting reduced motion), `components/shipwreck/ui/Icon.tsx` (`door-in`, `door-out` icons), `components/shipwreck/scene/runtime.ts` (`walkDoor`), `components/shipwreck/scene/WalkRunner.tsx` (writes `walkDoor`), `lib/shipwreck/help.ts` (the walk line mentions doors in plain words, Titanic only), `components/shipwreck/parentLine.ts` (Titanic: "You can walk her open decks and some of her rooms.")
- Modify tests: `components/shipwreck/ui/__tests__/WalkHud.test.tsx` (door button shows only with a door in reach and sets the flag; inside shows Go outside and hides jump; the lift wipe appears on a `walkLift` bump), the help and parent line tests if they pin the text

**Steps:**

- [ ] Tests first; implement; `npx jest components/shipwreck lib/shipwreck`; `npm run type-check`; `npm run lint`.
- [ ] Manual on the iPad emulation (dev server, 1024×768 touch): the buttons sit clear of the stick, the timeline and the safe areas (`lib/game-kit/__tests__/safeAreaGuard.test.ts` green).
- [ ] Commit: `feat(shipwreck): go inside and go outside buttons, the lift wipe`.

---

### Task 9: Release 1.15.0 — e2e, perf, screenshots

**Model:** Sonnet (Opus if the perf budget needs optimising). **Review:** ordinary; run the `game-release-review` skill before opening the PR.

**Files:**

- Modify: `lib/shipwreck/version.ts` → `"1.15.0"`; `lib/shipwreck/changelog.ts` (the spec's draft at the top, dated the ship day, checked against `git log` of the branch)
- Create: `e2e/shipwreck-interiors.spec.ts` (Chromium, not `@smoke`):
  1. Real night, compute ahead (`pump`), Walk, walk to the starboard staircase door with `setWalkInput` and `turnWalk` (or `enterDoor`), `getWalk().inside === true`, area `gs-boat`; walk down to `gs-b` (area changes through the flights); the camera's FOV is 65 (`getRenderInfo` or a hook).
  2. `placeWalk` to Scotland Road at x 20, seek to 1:30: `getWalk().depthM > 0` ahead after walking forward; the walker never goes deeper than 0.8 m (the wall holds).
  3. The lift from `gs-b` to `lift-e` at 11:50 PM moves the walker to E deck; at 1:30 it does not.
  4. Inside at 2:13:50, run past the break: `getWalk().phase === "water"`.
  5. `goOutside()` from `suite-2` puts the walker on the boat deck.
- Modify: `e2e/perf.spec.ts` (two scenes, `shipwreck-walk-staircase` and `shipwreck-walk-scotland-road`, via `placeWalk`), `e2e/perf-budget.json` (only those two keys added: `PERF_UPDATE=1` rewrites the file, so restore every existing entry by hand and diff it)
- Modify: `lib/shipwreck/walk/README.md`, `components/shipwreck/scene/README.md` (Interior row), `components/shipwreck/model/README.md` (if the roof hole landed), `CLAUDE.md` Shipwreck section (one line: interiors live in `lib/shipwreck/interior/` and `components/shipwreck/interior/`, built only while walking on a ship that has them)

**Steps:**

- [ ] Version and changelog; `npx jest lib/shipwreck/__tests__/changelog.test.ts` green.
- [ ] Write the e2e spec; `npx playwright test e2e/shipwreck-interiors.spec.ts e2e/shipwreck-walk.spec.ts --project=chromium` green.
- [ ] Perf: `npx playwright test e2e/perf.spec.ts --project=chromium`. Every existing scene within its unchanged budget (compare with the baseline results); the two new scenes under about 75 draws and 350k triangles. If over: skip the sea's planar reflection while inside first.
- [ ] `npm run validate` green.
- [ ] Screenshots (dev server, real GPU, medium tier, iPad landscape size) to `/Users/griggen/dev/code/personal/shipwreck-shots/interiors/NN-name.png` with `captions.txt`: 01 the glowing door on deck, 02 Boat deck entrance under the dome, 03 down the staircase to A, 04 the A deck clock, 05 B deck foyer, 06 the corridor, 07–09 the three suites, 10 Scotland Road dry, 11 the third-class cabin, 12 water coming down Scotland Road, 13 water climbing the staircase from below, 14 lights out with the torch, 15 the lift wipe or E deck lobby.
- [ ] Commit: `feat: Shipwreck 1.15.0 — go inside the Titanic`.
