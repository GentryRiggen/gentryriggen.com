# Shipwreck 1.3 Walk the Decks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first-person walk mode on the Titanic's and the Lusitania's open decks: walk while she sinks, slide when it gets steep, end up floating at sea level, and look under to watch her go down.

**Architecture:** Pure, headless walk rules in `lib/shipwreck/walk/` (hand-marked deck maps per ship, a fixed-step walker, a swimmer) that read the sim's `BodyPose` and never write the sim. A `walk` slice in the playback store holds the phase; a mutable `walkInput` object carries joystick and look input without React. `CameraRig` gains a walk branch that places the camera from the walker; a new `WalkHud` replaces the rail while walking.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, three.js via @react-three/fiber, zustand store (`lib/shipwreck/playback.ts`), Tailwind 4, Jest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-shipwreck-walk-design.md` (read it first; its north-star goals are re-read before every task).

## Global Constraints

- First person only: no body, hands, character or shadow drawn. No people shown anywhere.
- Walk is offered on the Titanic and the Lusitania only; ships without a walk map (the Edmund Fitzgerald) never show the Walk button.
- View stays level with the horizon: camera yaw/pitch come from the player's look only, never from her pitch or roll. No head bob.
- Slope thresholds: below 10° walk normally; 10°–20° pushed downhill and slower uphill; above 20° slide, cannot climb. Constants `WALK_PUSH_FROM_DEG = 10`, `WALK_SLIDE_FROM_DEG = 20`.
- Eye height 1.6 m (`WALK_EYE_M = 1.6`). Into the water at waist depth: 1.0 m of water over the feet (`WALK_IN_WATER_DEPTH_M = 1.0`). Wading: half speed at knee depth (0.5 m).
- Railings are walls below the slide threshold; once sliding, the downhill railing lets you over. Open ends (the break, a submerged deck edge) never hold.
- Swimmer paddles at 0.5 m/s (`SWIM_SPEED_MS = 0.5`), never goes under except Look under, which puts the eyes 1 m under the surface.
- Walking runs in real time at any playback speed. Seeking puts you on the boat deck at that time, or in the water if the boat deck is under.
- Kids who don't read: every walk control is a picture button ≥ 64 px (`size-16`), words only in `aria-label`; no text pop-ups. Joystick is drawn (ring, knob, four chevrons) and always visible while walking or swimming.
- Perf: walk adds no draw calls beyond its DOM overlay; no per-frame raycasts against model meshes; no physics engine. 1.0 budget: ≤ 160 draw calls, ≤ 450k triangles at the top tier.
- Every 1.0–1.2 unit test, golden track and e2e passes unchanged.
- Analytics: string props are closed enums; adding `"walk"` to `CAMERA_IDS` means editing `firestore.rules`, the rules test and the dashboard together.
- Do not modify `components/ship-builder` or `lib/ship-builder` (that would force a Ship Builder release). Borrowing ideas or copying small helpers (e.g. `stickValue` from `components/ship-builder/ui/WalkJoystick.tsx`) into Shipwreck files is fine.
- Release: `SHIPWRECK_VERSION = "1.3.0"` with a matching top `CHANGELOG` entry; this branch rebases on the Edmund Fitzgerald 1.2.0 when it merges.
- Commits end with `Assisted-by: Claude`. Prettier: double quotes, semicolons, es5 trailing commas, 80 cols.

## Review Focus

1. **×100 playback while walking**: the pose jumps a lot per frame; the walker must not tunnel through a railing or blocker. Fixed 1/60 s real-time substeps with the pose sampled once per frame (test in Task 2: `does not cross a railing at ×100`).
2. **Seeking backwards after going in**: dragging the timeline back to before she sank must put the walker back on the boat deck, and forward past "boat deck under" must put them in the water (test in Task 4: `seek re-places the walker`).
3. **The break under your feet**: a walker exactly at `breakX` is assigned to one part deterministically and slides toward the open end, never left floating in the gap (test in Task 2: `walker at breakX joins the part on their side`).
4. **Leaving walk mid-drag or mid-slide**, or the run restarting / switching ship / What-if: input resets to zero, camera returns to `"orbit"`, walk state clears (test in Task 4: `restart and ship change clear walk`; Task 6: joystick unmount zeroes `walkInput`).
5. **Before the track is computed or after the end card**: the Walk button is disabled while `frame` is null and hidden under the end card (test in Task 6: `walk button disabled without a frame`).

---

## File Structure

- `lib/shipwreck/walk/types.ts`: `WalkMap`, `WalkArea`, `Blocker`, `Stair`, `WalkerState`, `SwimmerState`, `WalkInput`, constants.
- `lib/shipwreck/walk/titanicDecks.ts`, `lusitaniaDecks.ts`: each ship's hand-marked map, citing the general arrangement plans.
- `lib/shipwreck/walk/index.ts`: `walkMapFor(ship: ShipId): WalkMap | null`.
- `lib/shipwreck/walk/slope.ts`: gravity in the ship frame, slope angle, downhill direction.
- `lib/shipwreck/walk/step.ts`: `stepWalker`, collision, railings, stairs, wading, in-water checks.
- `lib/shipwreck/walk/swim.ts`: `stepSwimmer`, `canReboard`, `placeWalker`.
- `lib/shipwreck/walk/walkInput.ts`: the mutable input object.
- `lib/shipwreck/walk/README.md`: frame, rules, where things live.
- `lib/shipwreck/walk/__tests__/*.test.ts`.
- Modify `lib/shipwreck/types.ts` (`CAMERA_IDS`), `lib/shipwreck/playback.ts` (walk slice), `lib/analytics/gameEvents.ts` (only if not derived), `firestore.rules`, `firestore-tests/gameEvents.test.ts`, the admin Games dashboard if it lists cameras.
- `components/shipwreck/scene/walkCamera.ts` (pure camera placement) + `WalkRunner.tsx` (steps the walker each frame) + `CameraRig.tsx` walk branch; `Environment.tsx` and `ShipRig.tsx` read `runtime.walkLookUnder`.
- `components/shipwreck/ui/WalkButton.tsx`, `WalkHud.tsx`, `WalkJoystick.tsx`, `WalkLookLayer.tsx`; `Icon.tsx` new icons; `Hud.tsx` hides the rail and side panel while walking.
- `components/shipwreck/audio/cues.ts` + `voices.ts`: `splash` cue, slide scrape.
- `lib/shipwreck/testHooks.ts`, `e2e/shipwreck-walk.spec.ts`, `e2e/perf.spec.ts`, `e2e/perf-budget.json`.
- `lib/shipwreck/version.ts`, `changelog.ts`, `help.ts`, `components/shipwreck/parentLine.ts`.

---

### Task 1: Walk maps for both ships

**Files:**

- Create: `lib/shipwreck/walk/types.ts`, `lib/shipwreck/walk/titanicDecks.ts`, `lib/shipwreck/walk/lusitaniaDecks.ts`, `lib/shipwreck/walk/index.ts`
- Test: `lib/shipwreck/walk/__tests__/maps.test.ts`

**Interfaces:**

- Produces (ship frame: x forward from midships, y to port, z up from the keel; metres):

  ```ts
  export type V2 = readonly [x: number, y: number];
  export interface WalkArea {
    id: string; // "boat-deck", "forward-well", "forecastle", "aft-well", "poop"
    deck: string; // a name in spec.decks, height via deckZAt(deck, x, spec)
    /** Extra height above that deck (e.g. a house roof); default 0. */
    raiseM?: number;
    /** Closed polygon, counter-clockwise; edges are railings unless listed in openEdges. */
    outline: readonly V2[];
    /** Indices i of edges outline[i]→outline[i+1] that are not railings (a ladder mouth). */
    openEdges?: readonly number[];
  }
  export type Blocker =
    | { kind: "circle"; area: string; at: V2; r: number } // funnel bases, ventilators
    | { kind: "box"; area: string; min: V2; max: V2 }; // deckhouses, skylights, davits
  export interface Stair {
    id: string;
    from: { area: string; at: V2 };
    to: { area: string; at: V2 };
    widthM: number;
  }
  export interface WalkMap {
    ship: ShipId;
    areas: readonly WalkArea[];
    blockers: readonly Blocker[];
    stairs: readonly Stair[];
    spawn: { area: string; at: V2; yaw: number };
  }
  export function walkMapFor(ship: ShipId): WalkMap | null; // null for any ship without one
  export function floorZ(
    map: WalkMap,
    areaId: string,
    x: number,
    spec: ShipSpec
  ): number;
  ```

  Plus the constants listed in Global Constraints, exported from `types.ts`.

- [ ] **Step 1: Write the failing tests** in `maps.test.ts`, for each of `titanic` and `lusitania`:
  - `walkMapFor("titanic")` and `("lusitania")` are non-null; any other `ShipId` (cast) returns `null`.
  - every area's `deck` is in `spec.decks`; every outline has ≥ 3 points, is counter-clockwise (positive signed area), lies within `|y| ≤ spec.beam / 2` and `|x| ≤ spec.loa / 2`.
  - Titanic has areas `boat-deck`, `forward-well`, `forecastle`, `aft-well`, `poop`; Lusitania has `boat-deck`, `forecastle`, `stern`.
  - every blocker's `area` exists and its centre is inside that area; each funnel in `spec.funnels` sits inside a circle blocker on `boat-deck` (`|blocker.at[0] - funnel.x| < 2`).
  - every stair's `from`/`to` points are inside their areas, and `|floorZ(to) - floorZ(from)| > 1`.
  - the spawn is inside its area, not inside any blocker, and ≥ 1 m from every railing edge.
  - every area is reachable from the spawn's area through stairs (graph walk).
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=walk/__tests__/maps` and expect FAIL (module not found).
- [ ] **Step 3: Implement** the types and the two maps from the general arrangement plans (cite the plan and sheet in a file comment, as `places.ts` does). Funnels from `spec.funnels`; deckhouses from the superstructure boxes; boat-deck railings at the deck edge. Titanic ladders: forecastle↔forward well, forward well↔boat-deck front (B deck stairs at the bridge front stand in), aft well↔poop, aft well↔boat deck aft end. `floorZ` = `deckZAt(area.deck, x, spec) + (area.raiseM ?? 0)`.
- [ ] **Step 4: Run** the test and expect PASS.
- [ ] **Step 5: Commit** `feat(shipwreck): walk maps for the Titanic and the Lusitania`.

---

### Task 2: The walker (slope, collision, slide, water)

**Files:**

- Create: `lib/shipwreck/walk/slope.ts`, `lib/shipwreck/walk/step.ts`
- Test: `lib/shipwreck/walk/__tests__/slope.test.ts`, `step.test.ts`

**Interfaces:**

- Consumes: Task 1 types; `BodyPose` from `lib/shipwreck/sim/track.ts`; `shipToThree` from `components/shipwreck/scene/cameraMath.ts` (three axes: y up = earth z; sea surface at y = 0). Move the pure rotation into `lib/shipwreck/walk/slope.ts` if importing from `components/` into `lib/` is awkward; leave `cameraMath`'s export as is.
- Produces:

  ```ts
  // slope.ts
  /** Gravity's direction in the ship frame for this pose (unit). */
  export function gravityInShip(
    pose: BodyPose
  ): readonly [number, number, number];
  /** Deck slope in degrees and the unit downhill direction on the deck plane (ship x, y). */
  export function deckSlope(pose: BodyPose): { deg: number; downhill: V2 };
  // step.ts
  export interface WalkerState {
    part: "whole" | "bow" | "stern";
    area: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    yaw: number;
    sliding: boolean;
  }
  export interface WalkInput {
    forward: number;
    strafe: number;
    lookDx: number;
    lookDy: number;
  } // stick −1..1, look in px since last read
  export interface StepContext {
    map: WalkMap;
    spec: ShipSpec;
    pose: BodyPose;
    breakX: number | null;
    /** Earth z of the sea surface at an earth (x, y). */ seaZ(
      x: number,
      y: number
    ): number;
  }
  export type StepResult = {
    state: WalkerState;
    inWater: null | "deep" | "railing" | "open-end";
    depthM: number;
    slopeDeg: number;
  };
  export const WALK_DT = 1 / 60;
  export function stepWalker(
    s: WalkerState,
    input: WalkInput,
    ctx: StepContext,
    dt: number
  ): StepResult; // runs ceil(dt / WALK_DT) substeps, dt clamped to 0.25 s
  export function partFor(
    x: number,
    breakX: number | null,
    broken: boolean
  ): "whole" | "bow" | "stern"; // x >= breakX → bow
  ```

  Walking speed 1.4 m/s, yaw turned by `lookDx * 0.005` rad/px (yaw 0 faces the bow). Uphill speed scales down linearly from 1 at 10° to 0 at 20°; downhill push accelerates at `9.81 * sin(slope)` minus friction (μ 0.35) from 10°, sliding with no friction cap above 20°.

- [ ] **Step 1: Write failing tests**:
  - `slope.test.ts`: level pose → 0°; `pitch = 15°` → 15°, downhill `[1, 0]` (bow down); `roll = 25°` (list to starboard) → 25°, downhill `[0, -1]`.
  - `step.test.ts`, on the Titanic map, at the spawn with a level pose:
    - `walks forward at 1.4 m/s`: forward 1 for 1 s moves 1.4 ± 0.05 m along yaw.
    - `stops at a funnel`: walking into the first funnel's circle never enters it (distance ≥ r) and keeps sliding along its edge.
    - `railing holds below the slide threshold`: roll 15°, standing still 5 s next to the starboard railing: stays inside the outline, `inWater` null.
    - `goes over the downhill railing once sliding`: roll 25°: within 10 s `inWater === "railing"`.
    - `cannot climb above 20°`: pitch 22°, forward toward the stern for 3 s: x decreases (slides toward the bow).
    - `wades at half speed at knee depth`: `seaZ` set so 0.5 m of water over the feet: speed 0.7 ± 0.05 m/s.
    - `water on deck pushes downhill`: 0.5 m of water, pitch 5°, no input: the walker drifts toward the bow.
    - `in the water at waist depth`: 1.0 m over the feet → `inWater === "deep"`.
    - `open end at the break`: part bow, `breakX = 10`, walker at x 11 walking aft: `inWater === "open-end"` once x < 10.
    - `walker at breakX joins the part on their side`: `partFor(10, 10, true) === "bow"`, `partFor(9.99, 10, true) === "stern"`, `partFor(x, null, false) === "whole"`.
    - `takes the stairs`: walking into a stair's `from` point moves the walker to its `to` area within 3 s.
    - `does not cross a railing at ×100`: dt 0.25 s per call, pose changing 2° roll per call, 200 calls standing next to a railing with roll < 20°: never outside the outline.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=walk/__tests__` and expect FAIL.
- [ ] **Step 3: Implement** the step: per substep apply input in the ship frame, add the slope push, resolve blockers (push out of circles and boxes along the normal), resolve the outline (railing edges clamp unless sliding and the edge faces downhill; open edges and a break edge flag `inWater`), check stairs, then compute feet earth z via the pose and `depthM = seaZ - feetZ`.
- [ ] **Step 4: Run** the tests and expect PASS.
- [ ] **Step 5: Commit** `feat(shipwreck): walker rules: slope, railings, wading, in the water`.

---

### Task 3: The swimmer and placing the walker

**Files:**

- Create: `lib/shipwreck/walk/swim.ts`, `lib/shipwreck/walk/walkInput.ts`, `lib/shipwreck/walk/README.md`
- Test: `lib/shipwreck/walk/__tests__/swim.test.ts`

**Interfaces:**

- Consumes: Task 2 `WalkerState`, `WalkInput`, `StepContext`, `partFor`.
- Produces:
  ```ts
  export interface SwimmerState {
    x: number;
    y: number;
    yaw: number;
  } // earth frame (sim x, y), z is the sea
  export const SWIM_SPEED_MS = 0.5;
  export function stepSwimmer(
    s: SwimmerState,
    input: WalkInput,
    dt: number,
    hull: { pose: BodyPose; spec: ShipSpec }[]
  ): SwimmerState; // pushed out of hull footprints at the surface
  export function swimmerFrom(
    w: WalkerState,
    pose: BodyPose,
    spec: ShipSpec,
    map: WalkMap
  ): SwimmerState; // where they went in, moved 3 m clear of the hull
  /** Spawn on the boat deck for this frame, or null when the boat deck at the spawn is under water. */
  export function placeWalker(
    map: WalkMap,
    spec: ShipSpec,
    frame: SimFrame,
    breakX: number | null
  ): WalkerState | null;
  export const canReboard: (
    map: WalkMap,
    spec: ShipSpec,
    frame: SimFrame,
    breakX: number | null
  ) => boolean; // placeWalker !== null
  // walkInput.ts
  export const walkInput: WalkInput; // mutable singleton; consumers read lookDx/lookDy and zero them
  export function resetWalkInput(): void;
  ```
- [ ] **Step 1: Write failing tests**: paddles at 0.5 ± 0.02 m/s; a swimmer paddling into the hull footprint stays outside it; `swimmerFrom` lands ≥ 3 m from the hull; `placeWalker` on the real Titanic track (golden fixture or a `runSim` call as other tests do) returns a state at t = 0 and `null` 30 s after `sankAtT`; after the break `placeWalker` puts the walker on the stern if the boat-deck spawn's x is aft of `breakX`, else the bow; `resetWalkInput` zeroes every field.
- [ ] **Step 2: Run** the tests and expect FAIL.
- [ ] **Step 3: Implement**, then write the README: frame, rules, the constants, where the scene and UI live, and that "go down with the ship" changes only the `inWater` decision in `stepWalker`.
- [ ] **Step 4: Run** the tests and expect PASS.
- [ ] **Step 5: Commit** `feat(shipwreck): swimmer and walker placement`.

---

### Task 4: Store, camera id, analytics rules

**Files:**

- Modify: `lib/shipwreck/types.ts`, `lib/shipwreck/playback.ts`, `lib/analytics/gameEvents.ts` (if needed), `firestore.rules:594-596`, `firestore-tests/gameEvents.test.ts`, the admin Games tab if it maps camera labels, `components/shipwreck/ui/Hud.tsx` (`CAMERA_LABEL` / `CAMERA_ICON` gain `walk`)
- Test: `lib/shipwreck/__tests__/playback.test.ts`, `lib/shipwreck/__tests__/analytics.test.ts`, `lib/analytics/__tests__/gameRulesSync.test.ts` (existing, must pass)

**Interfaces:**

- Consumes: Task 3 `placeWalker`, `resetWalkInput`; `walkMapFor`.
- Produces on `PlaybackState`:
  ```ts
  walk: {
    phase: "off" | "deck" | "water";
    lookUnder: boolean;
    seq: number;
  } // seq++ whenever the walker must be re-placed (start, seek, back on deck)
  ```
  and `PlaybackActions`: `startWalk(): void` (camera `"walk"`, phase `"deck"`, seq+1; no-op when the ship has no map), `leaveWalk(): void` (camera `"orbit"`, phase `"off"`, lookUnder false, `resetWalkInput()`), `wentInWater(): void` (phase `"water"`), `backOnDeck(): void` (phase `"deck"`, lookUnder false, seq+1), `setLookUnder(on: boolean): void`. `seek` bumps `walk.seq` while phase ≠ `"off"`; the scene decides deck vs water from `placeWalker`. `setCamera(other)` and `takeControl()` call through to `leaveWalk` semantics. Starting a run, switching ship, or opening the What-if editor resets `walk` to off.
  `CAMERA_IDS` gains `"walk"` (last). `CAMERA_LABEL.walk = "Walk the deck"`, icon `"walk"`.
- [ ] **Step 1: Write failing tests** in `playback.test.ts`: `startWalk` sets camera and phase; `startWalk` on a ship with no map does nothing (use a cast id); `leaveWalk` returns to orbit and zeroes `walkInput`; `seek re-places the walker` (seq increments, phase unchanged by the store); `restart and ship change clear walk`; `setCamera("bridge")` while walking turns walk off.
- [ ] **Step 2: Run** them and expect FAIL.
- [ ] **Step 3: Implement** the slice; add `'walk'` to the `shipwreck_camera` list in `firestore.rules`; add a rules test case sending `camera: "walk"`; add `walk` wherever the dashboard labels cameras.
- [ ] **Step 4: Run** `npm test -- --testPathPatterns="playback|analytics|gameRulesSync"` and `npm run test:rules`; expect PASS.
- [ ] **Step 5: Commit** `feat(shipwreck): walk state in the playback store`.

---

### Task 5: Walking in the scene (camera, water, look under)

**Files:**

- Create: `components/shipwreck/scene/walkCamera.ts`, `components/shipwreck/scene/WalkRunner.tsx`
- Modify: `components/shipwreck/scene/CameraRig.tsx` (walk branch), `components/shipwreck/scene/runtime.ts` (`walkLookUnder: boolean`, `walker: WalkerView | null`), `components/shipwreck/scene/Environment.tsx` (both environments), `components/shipwreck/scene/ShipRig.tsx`, `components/shipwreck/scene/NightScene.tsx` (mount `WalkRunner`)
- Test: `components/shipwreck/scene/__tests__/walkCamera.test.ts`

**Interfaces:**

- Consumes: Tasks 2–4 (`stepWalker`, `stepSwimmer`, `swimmerFrom`, `placeWalker`, `walkInput`, store `walk` slice and actions).
- Produces:
  ```ts
  // walkCamera.ts (pure)
  export interface WalkerView {
    pos: V3;
    yaw: number;
    pitch: number;
  } // three.js world, level head
  export function deckEyes(
    w: WalkerState,
    pose: BodyPose,
    spec: ShipSpec,
    map: WalkMap,
    lookPitch: number
  ): WalkerView; // feet floorZ + 1.6 m through the pose; yaw = pose.yaw + w.yaw; no roll
  export function waterEyes(
    s: SwimmerState,
    wallT: number,
    lookPitch: number,
    lookUnder: boolean
  ): WalkerView; // y = bob(wallT) + 0.3, or −1.0 under
  export function followShipPitch(
    eye: V3,
    target: V3,
    minPitch: number
  ): number; // auto tilt down to keep her centre in frame while looking under
  export function bob(wallT: number): number; // 0.25 m, 7 s period, matches the low swell term in Sea.tsx's height()
  ```
  `runtime.walker` is written by `WalkRunner` (priority −1.5, after the ship rig, before `CameraRig`); `CameraRig`, when `camera === "walk"`, sets the camera from it, disables `OrbitControls`, skips `keepClear`/`reanchor`, and keeps `nearFor(0.5)`.
  `WalkRunner` each frame: on `walk.seq` change, call `placeWalker` (null → `wentInWater()` with a swimmer at the spawn's earth point); on deck, `stepWalker` with real `dt` and the walker's part pose; on `inWater`, call `swimmerFrom` and `wentInWater()`, and fire the splash (Task 7 hooks in); in water, `stepSwimmer`. It writes `runtime.walkLookUnder = walk.lookUnder` and `runtime.walkSlide` (0..1 for the HUD arrows) and exposes `{ phase, part, x, y, slopeDeg, depthM }` for the test hook.
  Look under: `Environment` uses fog density `0.0018` (night) / its day value × 0.35 (afternoon) when `runtime.walkLookUnder`; `ShipRig` keeps `power ≥ 0.12` for her hull lights while `walkLookUnder`, so she stays a dim lit shape; while walking on deck the scene's ambient light gets a faint lift (×1.25, `runtime.walker` set) so a child can see the deck; the camera pitch follows her centre with `followShipPitch` until she is out of sight.
- [ ] **Step 1: Write failing tests** in `walkCamera.test.ts`: level pose → eye y = floorZ + 1.6 − keel draught offset (compute via `shipToThree`); `roll = 20°` → returned view has no roll (only yaw/pitch fields exist) and pitch equals the look pitch; `waterEyes` y stays within 0.3 ± 0.25 above water and is −1.0 with lookUnder; `bob` has period 7 s; `followShipPitch` points down at a target 200 m below and ahead.
- [ ] **Step 2: Run** them and expect FAIL.
- [ ] **Step 3: Implement** `walkCamera.ts`, `WalkRunner.tsx`, the `CameraRig` branch and the look-under changes. Keyboard: `useWalkKeys` inside `WalkRunner` (WASD/arrows → `walkInput.forward/strafe`, only while walking).
- [ ] **Step 4: Run** the tests, then `npm run type-check`, and expect PASS. Check by hand: `npm run dev`, `/shipwreck?scene`, `window.__shipwreck.startWalk()` (Task 8 adds the hook; until then call the store action from the console) and look around the boat deck.
- [ ] **Step 5: Commit** `feat(shipwreck): walk the deck in the scene, float and look under`.

---

### Task 6: Kid-first walk controls

**Files:**

- Create: `components/shipwreck/ui/WalkButton.tsx`, `WalkHud.tsx`, `WalkJoystick.tsx`, `WalkLookLayer.tsx`
- Modify: `components/shipwreck/ui/Icon.tsx` (icons `walk`, `on-deck`, `look-under`, `drag-look`, `slide`), `components/shipwreck/ui/Hud.tsx`, `components/shipwreck/Shipwreck.tsx` (mount `WalkHud`)
- Test: `components/shipwreck/ui/__tests__/WalkHud.test.tsx`

**Interfaces:**

- Consumes: store `walk` slice and actions; `walkInput`; `runtime.walkSlide`; `walkMapFor`; `canReboard` (via a `canReboard` boolean the runner publishes on the store or runtime; builder's choice).
- Produces: `<WalkButton store />` on the right rail (top, above sound), `size-20` round, `aria-label="Walk on the deck"`, `data-testid="shipwreck-walk"`, pulses (`animate-pulse` or a keyframe in `globals.css`) until first tapped; the tap is remembered in `localStorage` key `shipwreck:walk-seen` inside try/catch. `<WalkHud store runtime />` while `walk.phase !== "off"`:
  - deck: `WalkJoystick` bottom-left above the timeline (`data-testid="shipwreck-walk-stick"`, ring ≥ 128 px, knob, four chevrons), `WalkLookLayer` filling the rest (drag writes `walkInput.lookDx/lookDy`; `drag-look` hint pictogram fades after the first drag), Fly button top-right (`aria-label="Fly"`, icon `orbit`, calls `leaveWalk`), slide arrows at the downhill screen edge while `walkSlide > 0`.
  - water: the joystick stays; `Back on deck` (`aria-label="Back on deck"`, icon `on-deck`, only while `canReboard`), `Look under` (`aria-label`s `"Look under the water"` / `"Come up"`, icon `look-under`, `aria-pressed`).
  - While walking, `Hud` hides X-ray, places and cameras buttons and the `side` panel; play/pause, speeds and the timeline stay.
- [ ] **Step 1: Write failing tests**: `walk button disabled without a frame`; it is absent for a ship with no map; tapping it calls `startWalk`; while walking the X-ray/places/cameras buttons are not rendered and Fly, the stick and the look layer are; Fly calls `leaveWalk`; in water `Back on deck` shows only when `canReboard` and calls `backOnDeck`; `Look under` toggles `setLookUnder`; unmounting the joystick mid-drag zeroes `walkInput`; every walk button is ≥ `size-16` and has an `aria-label`; no walk control renders visible text (pictures only).
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=WalkHud` and expect FAIL.
- [ ] **Step 3: Implement.** Tailwind only, both light and dark mode (the night HUD styles in `ui/styles.ts`), safe-area padding as `Hud` does, portrait and landscape. Copy `stickValue` from the Ship Builder joystick rather than importing it.
- [ ] **Step 4: Run** the tests and expect PASS.
- [ ] **Step 5: Commit** `feat(shipwreck): big picture controls for walking`.

---

### Task 7: Feel: slide scrape, splash, ripple

**Files:**

- Modify: `components/shipwreck/audio/cues.ts`, `components/shipwreck/audio/voices.ts`, `components/shipwreck/audio/useShipwreckSound.ts`, `components/shipwreck/ui/WalkHud.tsx`, `app/globals.css` (ripple keyframes)
- Test: `components/shipwreck/audio/__tests__/cues.test.ts` (existing file, add cases)

**Interfaces:**

- Consumes: `runtime.walkSlide`, the phase change deck→water.
- Produces: `Cue` gains `"splash"`; `CUE_GAP_S.splash = 2`. The existing `"scrape"` cue plays at `walkSlide` level while sliding (gap ≥ 1.5 s). A ripple wipe (`@keyframes shipwreck-ripple`, 600 ms, skipped with reduced motion) shows on going in.
- [ ] **Step 1: Write failing tests**: going in fires `splash` once; sliding fires `scrape` no more than once per 1.5 s; no walk cues when walk is off.
- [ ] **Step 2: Run** and expect FAIL.
- [ ] **Step 3: Implement** the synthesized splash in `voices.ts` in the existing style (no new audio files), within `VOICE_PEAK_MAX`.
- [ ] **Step 4: Run** and expect PASS.
- [ ] **Step 5: Commit** `feat(shipwreck): splash and scrape while walking`.

---

### Task 8: Test hooks, e2e and the perf budget

**Files:**

- Modify: `lib/shipwreck/testHooks.ts`, wherever `ShipwreckSceneHooks` is implemented (the scene), `e2e/perf.spec.ts`, `e2e/perf-budget.json`
- Create: `e2e/shipwreck-walk.spec.ts`

**Interfaces:**

- Produces on `ShipwreckSceneHooks`: `startWalk(): void`, `setWalkInput(forward: number, strafe: number): void`, `getWalk(): { phase: string; part: string; x: number; y: number; slopeDeg: number; depthM: number; lookUnder: boolean } | null`, `setLookUnder(on: boolean): void`.
- [ ] **Step 1: Write the e2e** (`{ tag: "@smoke" }` on the touch test): the Walk button is visible on the Titanic and absent on the Edmund Fitzgerald once it exists (skip that case until rebased); tap it → the stick shows and the rail buttons are gone; drag the stick up 1 s → `getWalk().x` changes; seek to 2:18 AM (Titanic) → within 20 s `phase === "water"`; tap Look under → `getRenderInfo().camera[1] < 0`; tap Fly → camera `"orbit"`.
- [ ] **Step 2: Add perf scenes** `shipwreck-walk-boat-deck` (startWalk at 1:30 AM, look aft) and `shipwreck-walk-look-under` (water, look under 60 s after `stern-under`) to the Titanic block and its `SCENES` list; include them in the ≤ 160 / ≤ 450k ceiling loop.
- [ ] **Step 3: Run** `npx playwright test e2e/shipwreck-walk.spec.ts --project=chromium` and expect PASS; then `PERF_UPDATE=1 npx playwright test e2e/perf.spec.ts --project=chromium -g Shipwreck`, check the new scenes are within the ceilings and the old ones did not move by more than 5 %, and commit the budget.
- [ ] **Step 4: Commit** `test(shipwreck): walk e2e and perf scenes`.

---

### Task 9: Release 1.3.0

**Files:**

- Modify: `lib/shipwreck/version.ts`, `lib/shipwreck/changelog.ts`, `lib/shipwreck/help.ts`, `components/shipwreck/parentLine.ts`
- Test: `lib/shipwreck/__tests__/changelog.test.ts`, `help.test.ts` (existing)

- [ ] **Step 1:** Bump `SHIPWRECK_VERSION` to `"1.3.0"` (or the next minor after whatever is on `main` once 1.2.0 merges), and add the top `CHANGELOG` entry in plain words a young sailor or their parent would follow, from `git log` since the last release commit: walk the decks of the Titanic and the Lusitania, the deck tilts and you slide, end up floating, look under to watch her go down.
- [ ] **Step 2:** Help: the controls topic gains one line about the walk button (for parents reading). Parent lines for both ships gain: "You can walk her open decks; no people are shown."
- [ ] **Step 3: Run** `npm run validate` and expect PASS.
- [ ] **Step 4: Commit** `feat(shipwreck): 1.3.0, walk the decks`.

---

## Execution notes

- Screenshot check-in with Gentry after Task 6 (the controls on an iPad-sized viewport, deck and water), before Task 7.
- Before the PR: rebase on `main` after the Edmund Fitzgerald 1.2.0 merges; resolve `firestore.rules`, `CAMERA_IDS`/ship lists and the changelog; confirm the Walk button is absent on the Fitzgerald.
- Real-iPad checks pending after release: joystick feel, frame rate while walking at the break, look-under visibility.
