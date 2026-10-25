# Funnels Break Off Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every ship with funnels loses at least one funnel during a sinking. The funnel snaps at its base, topples into the sea with a splash, floats for a moment, then sinks and lands on the sea floor near the wreck.

**Architecture:**

- **The sim decides when and which funnel falls.** It's deterministic and scrubbable, and works for iceberg and weather trials alike. `TrialInput` gains a list of funnels (their positions in the ship's resting world frame). The sim records each break in a new `SimState.funnelFalls` list, with a `funnel-broke` event, carrying the world transform at the moment of the break.
- **A pure function animates a fall.** `fallingFunnelPose(fall, t)` lives in the same lib module.
- **The scene follows the playback.** It hides the attached funnel once its fall has begun, and draws the falling one in world space from that pose.

**Tech Stack:** TypeScript (pure sim, no three in `lib/`), three / @react-three/fiber, Jest.

**Spec:** `docs/superpowers/specs/2026-10-25-ship-builder-life-aboard-design.md` (section 4)

## Global Constraints

- **Every** ship with one or more funnels loses at least one during a sinking (any trial that sinks: iceberg or weather capsize). No funnels means no change.
- The first to fall is the funnel nearest the end that goes under first. On a ship with **three or more** funnels, a second one falls later.
- It's deterministic: no `Math.random`, and the same ship gives the same falls. It's scrubbable both ways because it's driven by sim time.
- When she breaks in two, a fall starts from whichever half carried that funnel.
- Broken funnels sink and land on the sea floor near the wreck, at `FLOOR_DEPTH` (from `sim/descent.ts`).
- Applies to `funnel`, `funnel-large` and `funnel-modern`. The falling funnel keeps its livery (colours and mark).
- This is a Ship Builder release: `SHIP_BUILDER_VERSION` becomes `2.20.0`, with a matching top `CHANGELOG` entry.
- Per-task checks are `npm test`, `npm run type-check` and `npm run lint`. No e2e and no `npm run build`, unless a task says otherwise.

## Review Focus

1. A sinking where no funnel base ever reaches the water before she's under (a level sinking): one funnel still falls (fallback). Pinned in Task 1.
2. A trial that doesn't sink (afloat, recovered or steady): no falls, even if water reaches a funnel base briefly. Pinned in Task 1.
3. Scrubbing back before a fall: the funnel is back on the ship and the falling copy is gone. Pinned in Task 2.
4. "Try again" after a sinking: every funnel is back on the ship. Pinned in Task 2.
5. Break in two with funnels on both halves: each fall starts from its own half's pose. Pinned in Task 1.

## Execution notes (cost)

- Task 1 (sim, **Sonnet**: the rules below are exact). Task 2 (scene, **Opus**: world-space handoff between moving groups is the hard part). They run in sequence. There's one combined review (Sonnet) after Task 2.

---

### Task 1: Funnel falls in the sim (Sonnet)

**Files:**

- Create: `lib/ship-builder/sim/funnelFall.ts`
- Create: `lib/ship-builder/sim/__tests__/funnelFall.test.ts`
- Modify: `lib/ship-builder/sim/types.ts`. Add `TrialFunnel`, `FunnelFall`, `TrialInput.funnels`, `SimState.funnelFalls`, and a `"funnel-broke"` event kind with an optional `funnelId`.
- Modify: `lib/ship-builder/sim/seaTrial.ts`. Initialise `funnelFalls: []` in `createTrial`. After every step that's in `sinking` or `descending`, or that's a plunge, run `stepFunnelFalls`.
- Modify: `lib/ship-builder/state/store.ts`. `beginTrial` fills `funnels` from the ship (see below).
- Modify: `components/ship-builder/scene/coords.ts`. Move `DECK_Y` and `LEVEL_HEIGHT` to `lib/ship-builder/model/grid.ts` (or a new `lib/ship-builder/model/worldFrame.ts`) and re-export them from `coords.ts`, so lib can compute world heights. Every existing import keeps working.
- Modify: every `TrialInput` literal in tests (TypeScript lists them) and the `driveHit` path.

**Interfaces (produces):**

```ts
// types.ts
/** A funnel as the sim sees it, in the ship's resting world frame (bow to +X, sink 0). */
export interface TrialFunnel {
  id: string;
  /** Cells from the bow, of its base centre. */
  cellX: number;
  /** World y of its base (DECK_Y + mount level * LEVEL_HEIGHT). */
  baseY: number;
  /** World z of its base (beam / 2 - model z). */
  baseZ: number;
  /** Body height above its base (getPartDef(type).height). */
  height: number;
}
export interface FunnelFall {
  funnelId: string;
  /** Sim seconds when it snapped. */
  at: number;
  /** World position of its base at that moment. */
  origin: { x: number; y: number; z: number };
  /** The carrying body's roll and pitch at that moment (radians). */
  roll: number;
  pitch: number;
  /** Which way it topples across the ship: +1 toward +Z, -1 toward -Z. */
  side: 1 | -1;
}
interface TrialInput {
  /* … */ funnels: TrialFunnel[];
}
interface SimState {
  /* … */ funnelFalls: FunnelFall[];
}

// funnelFall.ts
/** World y of a resting-frame point under a body pose (same transform as the scene's ship group / applyHalfPose). */
export function poseWorldPoint(
  pose: {
    roll: number;
    pitch: number;
    sink: number;
    pivotX?: number;
    driftX?: number;
  },
  lengthCells: number,
  point: { x: number; y: number; z: number }
): { x: number; y: number; z: number };
/** Adds any falls that start this step; returns the state unchanged when none. */
export function stepFunnelFalls(state: SimState, input: TrialInput): SimState;
export const SECOND_FALL_GAP_S = 2;
export const TOPPLE_S = 1.2;
export const FLOAT_S = 2.5;
/** World transform of a fallen funnel's base at `t` seconds after it snapped. */
export function fallingFunnelPose(
  fall: FunnelFall,
  t: number
): {
  position: { x: number; y: number; z: number };
  /** Euler XYZ, radians. */
  rotation: { x: number; y: number; z: number };
};
```

`poseWorldPoint` must be the pure-trig twin of what the scene does. For the whole ship, check how the ship group applies `roll`/`pitch`/`sink` (look in `ShipAnimation.tsx` / `BobGroup.tsx`): Euler `(roll, 0, pitch)` about the origin, then `y -= sink`. For a half, use `applyHalfPose` in `components/ship-builder/scene/halfTransform.ts` (pivot at `worldXOf(pivotX)`, then the drift). Write a test that compares it against three's `Euler` and `Vector3` for a few poses (tests may import three).

**Rules for `stepFunnelFalls` (exact):**

- It only acts when `state.outcome` is `"sank"` or `"capsized"`, and the state's `phase` is `sinking` or `descending`, or the `sunk` event has happened. It never acts once `funnelFalls.length` has reached `targetCount` or more.
- `targetCount` is `0` with no funnels, `1` with one or two funnels, and `2` with three or more.
- **Order:** the sinking end is the bow if `pitch < 0` at the first step where this function acts (bow down), otherwise the stern. Use the whole-ship pose, or the bow half's pose when broken. Sort funnels by distance from that end (`cellX` ascending for the bow, descending for the stern). Ties are broken by id.
- **Carrying body:** with `state.halves`, the half that holds `cellX` (bow if `cellX < breakup.atX`). Otherwise the whole ship.
- **Trigger for the next funnel in order:**
  - Its base (`poseWorldPoint` of `(worldXOf(cellX), baseY, baseZ)`) reaches world `y <= 0`.
  - **Or**, for a weather capsize (no `input.iceberg`), `|roll| >= 100°`.
  - **Or** the fallback: for the first funnel, the `sunk` event is in `state.events`; for the second, `SECOND_FALL_GAP_S` after the first fall.
  - In every case, the second never falls earlier than `first.at + SECOND_FALL_GAP_S`.
- **Recording:** push a `FunnelFall` with `origin` set to the base's world point, `roll`/`pitch` from the carrying body, and `side = roll >= 0 ? -1 : 1` (it topples toward the low side). Positive roll is starboard, so check that sign against `poseWorldPoint`, and pin it in a test. Also push the event `{ at: state.time, kind: "funnel-broke", funnelId }`.

**`fallingFunnelPose(fall, t)` (exact shape, the numbers are free to tune):**

- `0 ≤ t < TOPPLE_S`: the funnel pivots about its base edge on `side`. Its tilt eases (smoothstep) from the carrying body's tilt to lying flat (90° about X, signed by `side`). The base drops to `y = 0` (the water) by the end.
- `TOPPLE_S ≤ t < TOPPLE_S + FLOAT_S`: it lies flat at `y = 0` and bobs gently (`0.05 * sin`).
- Later: it sinks at `DESCENT_SPEED` (from `descent.ts`) until `y = -FLOOR_DEPTH`, then stays there. It drifts a little toward `side` the whole time, about 1.5 world units total, so it lands beside the wreck, not inside it.

- [ ] **Step 1: Write failing tests** in `funnelFall.test.ts`:
  - `poseWorldPoint` matches three's transform within 1e-9, for the whole ship and for a half pose.
  - Make an iceberg `TrialInput` from the Titanic template (use `simShipFromStats` plus the template's funnels through the same helper `beginTrial` uses; export that helper as `trialFunnelsOf(ship)` from the store module or a lib model file). Its `runTrial(input, …)` with the descent (`startDescent`) gives `funnelFalls.length === 2`, and the first fall's `funnelId` is the funnel with the smallest `cellX` (bow down).
  - The same ship with `breakMode: "never"` and a hit that floods only one compartment ends `afloat` with `funnelFalls.length === 0`.
  - A one-funnel ship that sinks gives exactly one fall. A two-funnel ship gives exactly one.
  - A weather capsize of a top-heavy ship with funnels gives at least one fall, at a time when `|roll| >= 100°`, or at `sunk`.
  - Running the same input twice gives deep-equal `funnelFalls`.
  - `fallingFunnelPose(fall, 0).position` equals `fall.origin`. At `TOPPLE_S` its `y ≈ 0`. At a large `t` its `y === -FLOOR_DEPTH`.
  - Broken ship: with `breakMode: "always"` and funnels on both sides of the break, each fall's `roll`/`pitch` equals the carrying half's pose at `fall.at`.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=funnelFall`. Expected: FAIL.
- [ ] **Step 3: Implement** the types, `funnelFall.ts`, the wiring in `seaTrial.ts`, and `trialFunnelsOf` plus its use in `beginTrial`. Also move the `DECK_Y`/`LEVEL_HEIGHT` constants. Check that the sim README's outcome table is unchanged.
- [ ] **Step 4: Run** `npm test`, `npm run type-check` and `npm run lint`. Expected: all pass. If `fixtures.test.ts` cares about the trial, it won't, because saves don't hold trials.
- [ ] **Step 5: Add** a short "Funnel falls" paragraph to `lib/ship-builder/sim/README.md`.
- [ ] **Step 6: Commit** `feat(ship-builder): the sim decides which funnels break off in a sinking`

---

### Task 2: Draw the falling funnels, and release (Opus)

**Files:**

- Modify: `components/ship-builder/scene/trialPlayback.ts`. `TrialPlayback` gains `funnelFalls: readonly FunnelFall[]`, written wherever `events`/`halves` are written (the iceberg timeline driver, the weather driver, the instant drivers and the scrubber). Reset it to `[]` in `resetPlayback`.
- Create: `components/ship-builder/scene/FallingFunnels.tsx`. For each fall with `fall.at <= playback.time`, it draws the funnel's mesh in world space, at `fallingFunnelPose(fall, playback.time - fall.at)`. Use the same mesh the part uses (`PartMesh`/`Fitting` for that part, with its livery: `funnelColors` and `mark`). Set the transform imperatively in `useFrame` (no React state per frame). Add a one-shot splash when `t` crosses `TOPPLE_S`, reusing the splash helpers in `SeaTrialEffects.tsx` / `particles.ts` where they fit.
- Modify: `components/ship-builder/scene/ShipParts.tsx` and `BrokenShip.tsx` (wherever funnels render on the ship or a half). Hide a funnel part whose id has a fall with `fall.at <= playback.time`. That covers anything attached to it (string lights or aerial wires to a fallen funnel). Treat those like `snappedWires` in `partHalves.ts`, or just hide wires to a fallen funnel. The visibility must follow playback time, so scrubbing back restores it. Prefer toggling `visible` in `useFrame` over re-rendering.
- Modify: the trial scene wherever `SeaTrialEffects` is mounted. Mount `FallingFunnels` there, only while a trial is running or showing a result.
- Modify: `lib/ship-builder/version.ts` (`"2.20.0"`) and the top of `lib/ship-builder/changelog.ts`.
- Test: `components/ship-builder/scene/__tests__/` (pure helpers only, such as a `fallenIdsAt(falls, time)` helper), plus a store or playback test that "Try again" resets `funnelFalls`.

**Interfaces:**

- Consumes (Task 1): `FunnelFall`, `SimState.funnelFalls`, `fallingFunnelPose`, `TOPPLE_S`.
- Produces: `export function fallenIdsAt(falls: readonly FunnelFall[], time: number): Set<string>` in `FallingFunnels.tsx` or a small `funnelFallView.ts`.

- [ ] **Step 1: Write failing tests**:
  - `fallenIdsAt(falls, t)` holds exactly the falls with `at <= t`. That covers scrubbing back.
  - `resetPlayback()` leaves `funnelFalls` empty.
  - The drivers' write path copies `funnelFalls` from the state (test whichever pure function does the copy).
- [ ] **Step 2: Implement** the playback field, the hiding, `FallingFunnels` and the splash.
- [ ] **Step 3: Do a real-app check.** This is the one place where looking matters. Take at most three screenshots, in the scratchpad directory the controller gives you, using the e2e test hooks (`lib/ship-builder/testHooks.ts`, `scene/testClock.ts`; see `e2e/ship-builder-iceberg.spec.ts`):
  - Sink the Titanic with an iceberg, and capture one frame just after the first funnel snaps.
  - Capture one frame of it lying in the water.
  - Capture one frame of the wreck on the floor with the funnels beside it.
    Confirm that no funnel is doubled (still on the ship and falling at once) and that it topples to the low side.
- [ ] **Step 4: Bump the version and add the changelog entry.** Date `2026-10-25`, title "Funnels break off". Highlights in plain words, for example:
  - "When a ship with funnels sinks, a funnel snaps off and crashes into the sea, just like on the Titanic"
  - "Big ships with three or more funnels lose a second one too"
  - "The broken funnels sink and land on the sea floor beside the wreck"
- [ ] **Step 5: Run** `npm test`, `npm run type-check` and `npm run lint`. Expected: all pass.
- [ ] **Step 6: Commit** in two commits: `feat(ship-builder): funnels snap off and fall into the sea`, then `chore(ship-builder): release 2.20.0 — funnels break off`.
