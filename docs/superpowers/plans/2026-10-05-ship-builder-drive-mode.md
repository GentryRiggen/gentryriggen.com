# Ship Builder Drive Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player drive the ship they built through an endless sea of chosen obstacles, from chase, top-down and bridge views, with class-specific controls; a hard hit hands off to the existing sinking sequence.

**Architecture:** A pure-TS sail model (`lib/ship-builder/sail/`) steps ship position/heading/speed and detects collisions. A live (non-React) sail state is published to the scene each step, like `liveTrialState`. The scene keeps the ship at the origin and scrolls the world around it. A hard hit calls the existing `startTrial(sea, impactX)`, which already accepts an arbitrary strike spot, so no sim refactor is needed.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, react-three-fiber, zustand, Jest + RTL, Playwright.

Spec: `docs/superpowers/specs/2026-10-05-ship-builder-drive-mode-design.md`

## Conventions (all tasks)

- Read `CLAUDE.md` first. `export default function` for components, `interface` for props, Tailwind only, light and dark mode on every element, prettier formatting, `@/` alias.
- Pure model code: no React, no three.js, no `Math.random`, fixed step `SIM_STEP_S` from `@/lib/ship-builder/sim/types`.
- World frame: the bow faces **+X**, starboard is **+Z** (see `modelToWorld`). Sail heading `h` (radians): forward = `(cos h, sin h)` in `(x, z)`; positive `h` turns to starboard. three.js `rotation.y` is `-h`.
- Units: positions in cells (1 cell = 1 world unit).
- Run one test file: `npm test -- --testPathPatterns=<name>`. Commit per task; lefthook runs format, type-check and lint on commit.
- Do NOT bump `SHIP_BUILDER_VERSION` until Task 10.
- Worktree agents: first `git reset --hard <branch>`, symlink node_modules from the main checkout, build with `--webpack`, skip local Firefox (see memory `worktree-agent-setup`).

## File structure

```
lib/ship-builder/sail/
  types.ts        Obstacle, SailInput, SailShip, Handling, SailState, SailImpact
  handling.ts     handlingFromShip(ship): Handling
  step.ts         createSail, stepSail (motion + collisions)
  collide.ts      hullHit(...) circle-vs-oriented-box test
  field.ts        sectors, deterministic obstacle seeding, syncField
  index.ts        re-exports
  __tests__/      handling, step, collide, field tests
lib/ship-builder/state/
  sailLive.ts     external live store (publish/subscribe/get), like liveTrialState
  sailInput.ts    mutable throttle/rudder shared by controls and runner
  store.ts        + drive slice and actions
components/ship-builder/scene/
  SailRunner.tsx          steps the model each frame, publishes live state
  SailWorld.tsx           obstacle meshes + ocean scroll offset
  ObstacleMesh.tsx        iceberg/rock/buoy/ship low-poly meshes
  driveCamera.ts          pure camera placement per view (chase/top/bridge)
components/ship-builder/ui/
  DriveButton.tsx, DrivePicker.tsx, DriveHud.tsx, SteeringWheel.tsx,
  ThrottleLever.tsx, DriveViewSwitch.tsx, controlsForKind.ts
e2e/ship-builder-drive.spec.ts
```

---

## Stage 1: Sail model

### Task 1: Types and handling

**Goal:** Define the sail types and `handlingFromShip`.

**Files:**

- Create: `lib/ship-builder/sail/types.ts`, `lib/ship-builder/sail/handling.ts`, `lib/ship-builder/sail/index.ts`
- Test: `lib/ship-builder/sail/__tests__/handling.test.ts`

**Acceptance Criteria:**

- [ ] `handlingFromShip` returns finite positive numbers for every `ShipKind`.
- [ ] A navy ship turns faster than a cargo ship of the same size; a longer ship of the same kind turns slower.
- [ ] Heavier ships (more `grossTonnage`) take longer to reach top speed.
- [ ] Top speed scales with `topSpeedKnots`.

**Verify:** `npm test -- --testPathPatterns=sail/__tests__/handling` → all pass

**Steps:**

- [ ] **Step 1: Write `types.ts`**

```ts
import type { ShipKind } from "../model/kinds";

export type ObstacleKind = "iceberg" | "rock" | "buoy" | "ship";

/** Only buoys are soft: a bump with no damage. */
export const SOFT_OBSTACLES: readonly ObstacleKind[] = ["buoy"];

export interface Obstacle {
  id: string;
  kind: ObstacleKind;
  x: number;
  z: number;
  /** Collision radius in cells. */
  radius: number;
  /** Other ships only: heading (radians) and speed (cells/s). */
  heading?: number;
  speed?: number;
  /** Sector this obstacle was seeded in, "sx:sz" (see field.ts). */
  sector: string;
}

export interface SailInput {
  /** -0.3 (slow reverse) to 1 (full ahead). */
  throttle: number;
  /** -1 (port) to 1 (starboard). */
  rudder: number;
}

/** What the sail model needs to know about the ship. */
export interface SailShip {
  kind: ShipKind;
  /** Hull length and width in cells. */
  length: number;
  beam: number;
  topSpeedKnots: number;
  grossTonnage: number;
}

export interface Handling {
  /** Cells per second at full throttle. */
  topSpeed: number;
  /** Seconds from stop to top speed. */
  accelSeconds: number;
  /** Radians per second at full rudder and full speed. */
  maxTurnRate: number;
  /** Rudder units per second (how fast the rudder follows the input). */
  rudderRate: number;
}

export type HullPart = "bow" | "side" | "stern";

export interface SailImpact {
  obstacleId: string;
  kind: ObstacleKind;
  /** Cells from the bow, 0..length (matches `impactX` of the sea trial). */
  impactX: number;
  part: HullPart;
  /** Cells per second the hull and obstacle were closing at. */
  closingSpeed: number;
  at: number;
}

export interface SailState {
  time: number;
  x: number;
  z: number;
  heading: number;
  /** Signed cells per second along the heading; negative is reversing. */
  speed: number;
  /** The rudder as it is (it follows the input at `rudderRate`). */
  rudder: number;
  obstacles: Obstacle[];
  /** Sector keys already seeded. */
  sectors: string[];
  /** Set by the last soft bump (a buoy); the HUD can flash on a change. */
  bump: { id: string; at: number } | null;
  /** Set on a hard hit; the model stops moving once it is set. */
  impact: SailImpact | null;
}
```

- [ ] **Step 2: Write the failing handling tests**

```ts
import { SHIP_KINDS } from "../../model/kinds";
import { handlingFromShip } from "../handling";
import type { SailShip } from "../types";

const base: SailShip = {
  kind: "liner",
  length: 20,
  beam: 5,
  topSpeedKnots: 20,
  grossTonnage: 20000,
};

describe("handlingFromShip", () => {
  it("is finite and positive for every kind", () => {
    for (const kind of SHIP_KINDS) {
      const h = handlingFromShip({ ...base, kind });
      for (const v of Object.values(h)) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThan(0);
      }
    }
  });
  it("turns navy faster than cargo of the same size", () => {
    const navy = handlingFromShip({ ...base, kind: "navy" });
    const cargo = handlingFromShip({ ...base, kind: "cargo" });
    expect(navy.maxTurnRate).toBeGreaterThan(cargo.maxTurnRate);
  });
  it("turns a longer ship more slowly", () => {
    const short = handlingFromShip({ ...base, length: 12 });
    const long = handlingFromShip({ ...base, length: 36 });
    expect(long.maxTurnRate).toBeLessThan(short.maxTurnRate);
  });
  it("takes a heavier ship longer to get up to speed", () => {
    const light = handlingFromShip({ ...base, grossTonnage: 2000 });
    const heavy = handlingFromShip({ ...base, grossTonnage: 90000 });
    expect(heavy.accelSeconds).toBeGreaterThan(light.accelSeconds);
  });
  it("scales top speed with knots", () => {
    const slow = handlingFromShip({ ...base, topSpeedKnots: 10 });
    const fast = handlingFromShip({ ...base, topSpeedKnots: 20 });
    expect(fast.topSpeed).toBeCloseTo(slow.topSpeed * 2);
  });
});
```

- [ ] **Step 3: Run, expect FAIL** (`handlingFromShip` not defined)

- [ ] **Step 4: Implement `handling.ts`**

```ts
import type { ShipKind } from "../model/kinds";
import type { Handling, SailShip } from "./types";

/** Cells per second for one knot. */
export const CELLS_PER_KNOT = 0.2;

/** Turning agility by kind: navy nimble, cargo ponderous. */
const AGILITY: Record<ShipKind, number> = {
  navy: 1.3,
  cruise: 0.95,
  liner: 0.85,
  cargo: 0.6,
};

const BASE_TURN_RATE = 0.5;
/** A ship this long turns at the base rate; longer is slower, shorter faster. */
const REFERENCE_LENGTH = 14;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

export function handlingFromShip(ship: SailShip): Handling {
  return {
    topSpeed: ship.topSpeedKnots * CELLS_PER_KNOT,
    accelSeconds: clamp(4 + ship.grossTonnage / 5000, 4, 22),
    maxTurnRate:
      BASE_TURN_RATE *
      AGILITY[ship.kind] *
      clamp(REFERENCE_LENGTH / ship.length, 0.4, 1.4),
    rudderRate: 1.5,
  };
}
```

- [ ] **Step 5: `index.ts` re-exports** (`export * from "./types"; export * from "./handling";`). Run tests → PASS.

- [ ] **Step 6: Commit** `feat(ship-builder): sail model types and handling`

### Task 2: Collision test

**Goal:** `hullHit`: does a circle touch the hull's oriented rectangle, and where.

**Files:**

- Create: `lib/ship-builder/sail/collide.ts`
- Test: `lib/ship-builder/sail/__tests__/collide.test.ts`

**Acceptance Criteria:**

- [ ] Returns `null` when the circle is clear of the hull.
- [ ] A circle ahead of the bow gives `part: "bow"`, `impactX` 0; one off the stern gives `part: "stern"`, `impactX` = length.
- [ ] A circle beside amidships gives `part: "side"` and `impactX` ≈ length / 2.
- [ ] Works when the ship is rotated (heading ≠ 0).
- [ ] `closingSpeed` is positive when approaching and 0 when moving apart.

**Verify:** `npm test -- --testPathPatterns=sail/__tests__/collide` → pass

**Steps:**

- [ ] **Step 1: Write the tests** (ship at origin, length 20, beam 6, heading 0; hull spans x in [-10, 10], z in [-3, 3]):

```ts
import { hullHit } from "../collide";

const hull = { x: 0, z: 0, heading: 0, length: 20, beam: 6, vx: 0, vz: 0 };
const rock = (x: number, z: number, radius = 1) => ({
  x,
  z,
  radius,
  vx: 0,
  vz: 0,
});

describe("hullHit", () => {
  it("misses a clear obstacle", () => {
    expect(hullHit(hull, rock(20, 0))).toBeNull();
  });
  it("hits the bow", () => {
    const hit = hullHit({ ...hull, vx: 4 }, rock(10.5, 0));
    expect(hit?.part).toBe("bow");
    expect(hit?.impactX).toBeCloseTo(0);
    expect(hit?.closingSpeed).toBeCloseTo(4);
  });
  it("hits the stern", () => {
    const hit = hullHit(hull, rock(-10.5, 0));
    expect(hit?.part).toBe("stern");
    expect(hit?.impactX).toBeCloseTo(20);
  });
  it("hits the side amidships", () => {
    const hit = hullHit(hull, rock(0, 3.5));
    expect(hit?.part).toBe("side");
    expect(hit?.impactX).toBeCloseTo(10);
  });
  it("handles a turned ship", () => {
    // Heading +90° points the bow at +Z.
    const hit = hullHit({ ...hull, heading: Math.PI / 2 }, rock(0, 10.5));
    expect(hit?.part).toBe("bow");
  });
  it("reports no closing speed when moving apart", () => {
    const hit = hullHit({ ...hull, vx: -2 }, rock(10.5, 0));
    expect(hit?.closingSpeed).toBe(0);
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement.** Signature:

```ts
export interface HullBody {
  x: number;
  z: number;
  heading: number;
  length: number;
  beam: number;
  /** World velocity, cells per second. */
  vx: number;
  vz: number;
}
export interface CircleBody {
  x: number;
  z: number;
  radius: number;
  vx: number;
  vz: number;
}
export interface HullHit {
  impactX: number;
  part: HullPart;
  closingSpeed: number;
}
export function hullHit(hull: HullBody, c: CircleBody): HullHit | null;
```

Algorithm: `dx = c.x - hull.x`, `dz = c.z - hull.z`; `u = dx*cos h + dz*sin h` (along bow), `v = -dx*sin h + dz*cos h`. Closest point on the rectangle `[-L/2, L/2] x [-B/2, B/2]`: `(cu, cv) = clamp`. Distance from `(u, v)` to `(cu, cv)`; if `> c.radius` return `null`. `part`: `u > L/2` → `"bow"`, `u < -L/2` → `"stern"`, else `"side"`. `impactX = clamp(L/2 - cu, 0, L)`. Normal: from the closest point toward the circle centre, rotated back to world (if the distance is 0, use the hull's forward vector); `closingSpeed = max(0, (hullV - circleV) · n)` where `n` points from hull to obstacle.

- [ ] **Step 4: Run → PASS. Commit** `feat(ship-builder): sail hull collision test`

### Task 3: Stepping the sail model

**Goal:** `createSail` and `stepSail`: throttle, rudder, motion, soft and hard hits.

**Files:**

- Create: `lib/ship-builder/sail/step.ts`
- Test: `lib/ship-builder/sail/__tests__/step.test.ts`

**Acceptance Criteria:**

- [ ] Held full throttle, speed rises smoothly to `topSpeed` in about `accelSeconds` and never exceeds it.
- [ ] Zero throttle brings her to rest; negative throttle reverses at no more than 0.3 x top speed.
- [ ] At a standstill the rudder does not turn her; at speed positive rudder increases `heading` (starboard) with the rudder easing in at `rudderRate`.
- [ ] Reversing inverts the turn direction.
- [ ] A hard obstacle (iceberg, rock, ship) in her path sets `impact` with the right `impactX`/`part` and freezes the model (further steps return the same state).
- [ ] A buoy sets `bump`, slows her by 20%, pushes the buoy clear, and does not set `impact` (and does not re-trigger next step).
- [ ] Other ships move along their heading each step.
- [ ] Stepping is deterministic (same inputs, same state).

**Verify:** `npm test -- --testPathPatterns=sail/__tests__/step` → pass

**Steps:**

- [ ] **Step 1: Write failing tests** covering each criterion above using `runSail(state, input, ship, handling, seconds)` helper in the test file that loops `stepSail`. Use `ship = { kind: "liner", length: 20, beam: 6, topSpeedKnots: 20, grossTonnage: 20000 }` and `handlingFromShip(ship)`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.**

```ts
export function createSail(
  obstacles: Obstacle[] = [],
  sectors: string[] = []
): SailState;
// time 0, x 0, z 0, heading 0, speed 0, rudder 0, bump null, impact null

export function stepSail(
  state: SailState,
  input: SailInput,
  ship: SailShip,
  handling: Handling
): SailState;
```

Per step (`dt = SIM_STEP_S`):

1. If `state.impact` return `state`.
2. `throttle = clamp(input.throttle, -0.3, 1)`; `target = throttle * handling.topSpeed`.
3. Ease `speed` toward `target` by `(handling.topSpeed / handling.accelSeconds) * dt` (use 1.6x that rate when slowing, i.e. when `|target| < |speed|`); snap when within one increment.
4. Ease `rudder` toward `clamp(input.rudder, -1, 1)` by `handling.rudderRate * dt`.
5. `turn = rudder * handling.maxTurnRate * clamp(speed / handling.topSpeed, -1, 1)`; `heading += turn * dt`.
6. `x += cos(heading) * speed * dt`, `z += sin(heading) * speed * dt`.
7. Move other-ship obstacles: `x += cos(o.heading) * o.speed * dt`, same for z (create new objects; state is immutable).
8. For each obstacle call `hullHit` (hull velocity `speed * (cos, sin)`, obstacle velocity from its own heading/speed, or 0). First hit wins:
   - Soft (`SOFT_OBSTACLES`): `speed *= 0.8`; push the obstacle along the contact normal until clear (`distance = radius + small epsilon` from the closest point); `bump = { id, at: time }`. Because it is pushed clear, it does not hit again.
   - Hard: `impact = { obstacleId, kind, impactX, part, closingSpeed, at: time }`.
9. `time += dt`.

- [ ] **Step 4: Run → PASS. Commit** `feat(ship-builder): sail motion, steering and collisions`

### Task 4: Obstacle field (endless sea)

**Goal:** Deterministic obstacle seeding by sector, and `syncField` to add and recycle sectors around the ship.

**Files:**

- Create: `lib/ship-builder/sail/field.ts`
- Test: `lib/ship-builder/sail/__tests__/field.test.ts`
- Modify: `lib/ship-builder/sail/index.ts` (re-export `step`, `field`, `collide`)

**Acceptance Criteria:**

- [ ] Same `(seed, config, sector)` always produces the same obstacles (ids included); different seeds differ.
- [ ] Only kinds enabled in the config appear; with no kinds enabled, nothing appears.
- [ ] More density gives more obstacles on average (few < some < many) across 200 sectors.
- [ ] Nothing is seeded within 30 cells of the start `(0, 0)`.
- [ ] `syncField` seeds the sectors within `FIELD_RING` (3) sectors of the ship that are not yet seeded and drops obstacles in sectors beyond `FIELD_KEEP` (5) sectors; it keeps `sectors` in step and never re-seeds a dropped sector the ship is not near, nor duplicates a sector.
- [ ] Other ships get a heading and a speed of 1 to 3 cells per second; the others have none.

**Verify:** `npm test -- --testPathPatterns=sail/__tests__/field` → pass

**Steps:**

- [ ] **Step 1: Write failing tests** for each criterion.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** Exports:

```ts
export const SECTOR_SIZE = 40;
export const FIELD_RING = 3;
export const FIELD_KEEP = 5;
export const START_CLEAR_RADIUS = 30;
export type Density = "few" | "some" | "many";
export interface FieldConfig {
  seed: number;
  kinds: ObstacleKind[];
  density: Density;
}
/** Expected obstacles per sector: few 1, some 2, many 4. */
export const DENSITY_COUNT: Record<Density, number>;

export function sectorKey(sx: number, sz: number): string;
export function obstaclesForSector(
  config: FieldConfig,
  sx: number,
  sz: number
): Obstacle[];
export function syncField(state: SailState, config: FieldConfig): SailState; // returns same object if nothing changed
```

Use a string hash of `${seed}:${sx}:${sz}` into mulberry32 for the PRNG. Per sector: count = `DENSITY_COUNT[density]` plus or minus one at random (never below 0); choose kind uniformly from `config.kinds`; position uniform in the sector; radii: iceberg 3 to 5, rock 1.5 to 3, buoy 0.8, ship 4; ids `${key}:${i}`. Skip any obstacle whose centre is within `START_CLEAR_RADIUS` of the origin. `syncField` converts the ship's `(x, z)` to its sector, seeds missing sectors in the ring, then drops obstacles whose sector is more than `FIELD_KEEP` sectors away (Chebyshev) and removes those sector keys from `sectors`.

- [ ] **Step 4: Run all sail tests** (`npm test -- --testPathPatterns=lib/ship-builder/sail`) → pass; `npm run type-check`.
- [ ] **Step 5: Commit** `feat(ship-builder): deterministic endless obstacle field`

---

## Stage 2: Sail scene and chase view, picker, hand-off

Stage 2 splits into 2A (state, hand-off and UI) and 2B (scene). They agree on the interfaces below, so they can run in parallel worktrees and then merge.

### Shared interfaces (written by Task 5, used by 5, 6, 7)

```ts
// lib/ship-builder/state/sailLive.ts  (same pattern as liveTrialState.ts)
getSailState(): SailState | null
publishSail(state: SailState | null): void
subscribeSail(listener: () => void): () => void

// lib/ship-builder/state/sailInput.ts
export const sailInput: { throttle: number; rudder: number }  // mutable, read per frame
export function resetSailInput(): void

// store.ts drive slice
export type DriveView = "chase" | "top" | "bridge";
export interface DriveConfig { seed: number; kinds: ObstacleKind[]; density: Density }
drive:
  | { status: "idle" }
  | { status: "setup" }                       // the picker is open
  | { status: "sailing"; config: DriveConfig; runId: number; view: DriveView }
actions: openDrive(), startDrive(config), endDrive(), setDriveView(v),
         driveHit(impact: SailImpact)  // ends drive, calls startTrial(sea, impact.impactX)
```

### Task 5 (2A): Drive state, hand-off and picker

**Goal:** The store's drive slice, live state, input module, and the picker.

**Files:**

- Create: `lib/ship-builder/state/sailLive.ts`, `lib/ship-builder/state/sailInput.ts`, `components/ship-builder/ui/DrivePicker.tsx`, `components/ship-builder/ui/DriveButton.tsx`, `lib/ship-builder/sail/driveConfig.ts` (default config, localStorage load/save wrapped in try/catch)
- Modify: `lib/ship-builder/state/store.ts` (slice + actions; `isTrialActive`-style guard so building freezes while driving), `components/ship-builder/ShipBuilder.tsx` (mount `DriveButton`, `DrivePicker`; hide drawers via the same `inFocus` mechanism the sea trial uses)
- Test: `lib/ship-builder/state/__tests__/drive.test.ts`, `components/ship-builder/ui/__tests__/DrivePicker.test.tsx`

**Acceptance Criteria:**

- [ ] `openDrive` shows the picker; `startDrive` sets `sailing` with a new `runId`; `endDrive` returns to `idle`.
- [ ] While `setup` or `sailing`, edits to the ship do nothing (same as during a trial).
- [ ] `driveHit` ends the drive and starts the sea trial at `impact.impactX` (the store's `trial.status` becomes `running`, with an iceberg input at that spot).
- [ ] The picker has toggles for iceberg, rock, buoy, ship (at least one required to enable Set sail unless "no obstacles" is intended; allow zero, it is valid open water), a Few/Some/Many density control, and a Set sail button; choices persist in local storage (read and write guarded for throwing storage) and the picker still renders with storage blocked.
- [ ] Buttons are at least 44px tall; the picker works in light and dark mode.
- [ ] The Drive button is beside the Sea Trial button, disabled with a hint when the ship has no engine (use the same readiness check the Sea Trial button uses).

**Verify:** `npm test -- --testPathPatterns="drive|DrivePicker"` and `npm run type-check`

**Steps:** Write the store tests first (fail), implement the slice following `startTrial`/`cancelTrial` patterns, then the live and input modules, then the picker tests and components. Commit per piece: `feat(ship-builder): drive state and hand-off`, `feat(ship-builder): drive picker and button`.

### Task 6 (2B): Scene: sail runner, obstacles, scrolling sea, chase camera

**Goal:** The ship sails in the scene, obstacles scroll past, the chase camera follows, and a hit hands off to the trial.

**Files:**

- Create: `components/ship-builder/scene/SailRunner.tsx`, `SailWorld.tsx`, `ObstacleMesh.tsx`, `driveCamera.ts`
- Modify: `components/ship-builder/scene/Scene.tsx` (mount `SailRunner`, `SailWorld` beside `SeaTrialRunner`), `CameraRig.tsx` (drive-mode branch using `driveCamera`; no OrbitControls while sailing), `Ocean.tsx` (accept a world-offset to scroll the wave and colour pattern), wake/propeller bubbles speed scaling in `PropellerBubbles.tsx`
- Test: `components/ship-builder/scene/__tests__/driveCamera.test.ts`, plus a lightweight render test for `ObstacleMesh` kinds if the existing scene tests render r3f pieces (follow their pattern; otherwise cover through the e2e in Task 10)

**Acceptance Criteria:**

- [ ] `SailRunner` steps `stepSail` with a fixed-step accumulator (`MAX_FRAME_DELTA` clamp), reads `sailInput`, calls `syncField` each step, publishes with `publishSail`, and on `impact` calls the store's `driveHit`. It builds `SailShip` from the store's ship stats (`stats.topSpeedKnots`, `grossTonnage`, `kind`, hull length and beam).
- [ ] The ship stays at the origin; `SailWorld` renders each obstacle at `(o.x - sail.x, 0, o.z - sail.z)` rotated by `-sail.heading` around the ship (the world turns around her), and the ocean scrolls by the same offset.
- [ ] The ship group does not yaw; it banks a little (visual only) into turns based on `rudder * speed`.
- [ ] `driveCamera.ts` exports `chaseCamera(sail, shipLength)` returning position and target: behind and above, further back as speed rises; unit-tested for sane values (camera behind the bow axis, height above deck, distance grows with speed, finite for every input).
- [ ] `prefers-reduced-motion` removes camera sway and cuts wake effects.
- [ ] Obstacle meshes: iceberg reuses the existing `Iceberg` geometry/material look; rock, buoy and other ship are low-poly, light and dark safe.

**Verify:** `npm test -- --testPathPatterns=driveCamera`, `npm run type-check`, and `npx next build --webpack` succeeds.

**Steps:** pure `driveCamera.ts` with tests first, then runner, world, mesh, camera branch, ocean offset. Commit: `feat(ship-builder): sail scene with obstacles and chase camera`.

### Task 7: Merge and wire controls (wheel, lever, keyboard, HUD)

**Goal:** Working controls: the drive HUD with steering wheel, throttle lever, view switch (chase only for now), keyboard.

**Files:**

- Create: `components/ship-builder/ui/DriveHud.tsx`, `SteeringWheel.tsx`, `ThrottleLever.tsx`, `DriveViewSwitch.tsx`, `controlsForKind.ts`, `components/ship-builder/hooks/useDriveKeys.ts`
- Modify: `ShipBuilder.tsx` (mount `DriveHud` when sailing), `SeaTrialStatus`/focus mechanism so the builder chrome tucks away while driving
- Test: `components/ship-builder/ui/__tests__/SteeringWheel.test.tsx`, `ThrottleLever.test.tsx`, `hooks/__tests__/useDriveKeys.test.tsx`

**Acceptance Criteria:**

- [ ] The wheel is draggable by pointer (pointer capture, `touch-action: none`), maps drag angle to `sailInput.rudder` (-1..1, 270 degrees lock to lock), and springs back to centre on release.
- [ ] The lever drags vertically between reverse (-0.3), stop (0) and full ahead (1), with a detent at stop; hit area at least 44px wide.
- [ ] Arrow keys and WASD steer and throttle, Space sets throttle to 0, Escape ends the drive (and does not also clear tools, mirroring the HelpButton Escape handling).
- [ ] An "End drive" button (clear, 44px) returns to the builder.
- [ ] `controlsForKind[kind]` returns `{ wheelStyle, leverStyle, label }` for all four kinds; the HUD wheel uses it (visual variants can be class-name and SVG differences; liner wood and brass, cruise modern and glass, navy compact grey, cargo large plain).
- [ ] Reduced motion respected; all elements light and dark.

**Verify:** `npm test -- --testPathPatterns="SteeringWheel|ThrottleLever|useDriveKeys"`; then in the main checkout `npm run validate`.

**Steps:** tests first for each control; commit per control: `feat(ship-builder): steering wheel and throttle lever`, `feat(ship-builder): drive keys and HUD`.

---

## Stage 3: Top-down view

### Task 8: Top-down camera and obstacle markers

**Goal:** A top-down view that follows the ship, with markers so hazards show early.

**Files:**

- Modify: `components/ship-builder/scene/driveCamera.ts` (add `topCamera`), `CameraRig.tsx` (use per view), `SailWorld.tsx` (marker rings for obstacles within range when in top view), `DriveViewSwitch.tsx` (enable Top)
- Test: extend `driveCamera.test.ts`

**Acceptance Criteria:**

- [ ] `topCamera(sail, shipLength)` places the camera straight above the ship looking down, with up-vector along the heading (heading-up), height scaling with length and a little with speed.
- [ ] Obstacles show a ring marker in top view, coloured by kind (buoy soft, others warning), readable in light and dark, sized at least a minimum screen size.
- [ ] The view switch changes the camera immediately and the choice survives a restart within the session.

**Verify:** `npm test -- --testPathPatterns=driveCamera`, `npm run type-check`.
**Commit:** `feat(ship-builder): top-down drive view`

---

## Stage 4: Bridge view, class wheels, release

### Task 9: Bridge view and class cockpits

**Goal:** First-person bridge view with the wheel and instruments for each class.

**Files:**

- Modify: `driveCamera.ts` (add `bridgeCamera(ship layout)`, with a default near the front of the superstructure when no bridge part exists; unit-test the fallback), `CameraRig.tsx`, `DriveHud.tsx` (render the class cockpit overlay in bridge view: bigger wheel, class instruments), `controlsForKind.ts` (instrument sets)
- Create: `components/ship-builder/ui/CockpitOverlay.tsx`
- Test: extend `driveCamera.test.ts`; `CockpitOverlay.test.tsx` renders for all four kinds

**Acceptance Criteria:**

- [ ] The bridge camera sits at the bridge part's position (or the fallback), eye height above its floor, looking along the heading, with the near hull hidden or clipped so it does not block the view.
- [ ] Each kind shows its distinct overlay: liner (wood wheel, brass telegraph), cruise (modern wheel, glass console), navy (compact helm, joystick lever), cargo (large plain wheel, industrial lever), plus a speed readout in knots.
- [ ] The wheel in the overlay is the same interactive control as the HUD wheel (single source), 44px targets, light and dark safe.
- [ ] View switch offers all three views.

**Verify:** `npm test`, `npm run type-check`.
**Commit:** `feat(ship-builder): bridge view with class cockpits`

### Task 10: E2E, docs and release 2.9.0

**Goal:** Cover the main path, update docs, ship the release.

**Files:**

- Create: `e2e/ship-builder-drive.spec.ts` (tag `{ tag: "@smoke" }`)
- Modify: `lib/ship-builder/version.ts` (`2.9.0`), `lib/ship-builder/changelog.ts` (top entry: title "Take the wheel"; plain-words highlights for Drive, the three views, the wheel that matches your ship, picking icebergs and rocks to dodge; date 2026-10-05), `components/ship-builder/ui/HelpButton.tsx` cheat sheet if it lists controls, `lib/ship-builder/sim/README.md` (one line pointing to `sail/`)
- Test: the e2e plus `lib/ship-builder/__tests__/changelog.test.ts`

**Acceptance Criteria:**

- [ ] E2E: open Drive, pick icebergs and many density, set sail, steer and throttle, switch the three views, sail into an iceberg, and reach the sinking result card. Use the existing e2e test hooks (`lib/ship-builder/testHooks.ts`) and helpers; to make the hit deterministic, seed a fixed obstacle dead ahead through a test hook rather than relying on random placement.
- [ ] `npm run validate` passes in the main checkout; the e2e passes on chromium, webkit and the iPad project.

**Verify:** `npm run validate` and `npm run test:e2e -- e2e/ship-builder-drive.spec.ts --project=chromium --project=webkit --project=ipad`.
**Commit:** `chore(ship-builder): release 2.9.0, take the wheel`

---

## Execution order

1. Task 1 to 4: one Sonnet implementer (pure TypeScript), one commit per task, then one combined review.
2. Tasks 5 and 6 in parallel worktrees (independent apart from the shared interface above), then merge in order 5, 6.
3. Task 7 (needs both), then one combined review of stage 2.
4. Tasks 8 and 9 in order (both touch `driveCamera.ts` and `CameraRig.tsx`), then Task 10.
5. Expensive verification (`npm run validate`, e2e) once after Task 7 and once at ship time.
