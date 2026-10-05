# Ship Builder Walk Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player walk their ship in first person over decks and stairs.

**Architecture:** A pure-TS walker (`lib/ship-builder/walk/`) over a walk grid derived from the ship's occupancy. A live state and input module (same pattern as `sailLive`/`sailInput`) connects HUD controls to a scene runner. A `walk` store slice mirrors the `drive` slice. The camera sits inside the ship's bob group.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, react-three-fiber, zustand, Jest + RTL, Playwright.

Spec: `docs/superpowers/specs/2026-10-05-ship-builder-walk-mode-design.md`

## Conventions (all tasks)

- Read `CLAUDE.md` first. Study the Drive implementation as the pattern to follow: `lib/ship-builder/sail/*`, `lib/ship-builder/state/{sailLive,sailInput}.ts`, the `drive` slice in `state/store.ts`, `components/ship-builder/ui/{DriveButton,DrivePicker,DriveHud,SteeringWheel}.tsx`, `components/ship-builder/scene/{SailRunner,CameraRig,SailBank}.tsx`, `components/ship-builder/hooks/useDriveKeys.ts`, and how `ShipBuilder.tsx` and `useKeyboardShortcuts.ts` treat drive (inFocus, frozen building, Escape).
- `export default function` components, `interface` for props, Tailwind only (inline `style` only for continuously changing geometry), light and dark mode, `@/` alias, prettier formatting.
- Pure model: no React, no three.js, no `Math.random`, fixed step `SIM_STEP_S`.
- World frame: bow toward +X, starboard +Z, 1 cell = 1 world unit; main deck floor at `DECK_Y`, each level `LEVEL_HEIGHT` higher (`components/ship-builder/scene/coords.ts`). A part at grid level L occupies the slab from level L; its top surface is level L + 1.
- Commit per task; lefthook runs on commit. Do NOT push. Do NOT bump the version until the release task. Never add the untracked `.agents/`, `AGENTS.md`, `dev3123.log`.
- Worktree agents: first `git reset --hard <base commit given in the prompt>`, symlink node_modules from the main checkout, build with `--webpack`, skip local Firefox.

## File structure

```
lib/ship-builder/walk/
  types.ts      WalkState, WalkInput, WalkGrid, constants
  walkGrid.ts   walkGridOf(ship)
  step.ts       stepWalker(state, input, grid)
  spawn.ts      spawnOf(ship)
  index.ts
  __tests__/    walkGrid, step, spawn
lib/ship-builder/state/
  walkLive.ts   getWalkState/publishWalk/subscribeWalk
  walkInput.ts  mutable { move: {x,z}, turn }, resetWalkInput
  store.ts      + walk slice
components/ship-builder/scene/  WalkRunner.tsx, walkCamera.ts, (+ CameraRig branch)
components/ship-builder/ui/     WalkButton.tsx, WalkHud.tsx, WalkJoystick.tsx
components/ship-builder/hooks/  useWalkKeys.ts
e2e/ship-builder-walk.spec.ts
```

---

### Task 1: Walk model

**Goal:** `walkGridOf`, `stepWalker`, `spawnOf` with tests.

**Files:** create `lib/ship-builder/walk/{types,walkGrid,step,spawn,index}.ts` and tests under `__tests__/`.

**Acceptance Criteria:**

- [ ] Types: `WalkState { x, z, yaw, level, time }` (x, z in cells in the ship's own model frame, same axes as the grid cells: x along the length, z across the beam; document the conversion to world in a comment, using `modelToWorld` conventions), `WalkInput { forward: number; strafe: number; turn: number }` (each -1..1), `WalkGrid`.
- [ ] `walkGridOf(ship)` exposes `floorLevel(x, z)` (the walkable surface height in levels at a cell column, or null when not walkable), `isBlocked(x, z, level)`, stair links, and blocker circles. Main-deck cells inside the hull (0 <= z < beam, inside the length) are walkable at level 0. A deck or cabin block at level L makes its column's top surface walkable at level L + 1 only if that column's top part is a deck or cabin (roof) block; otherwise it is solid or decor-blocked. Pools, deck chairs and other decor, cargo, bridge blocks and any cell under a blocker circle block movement. Wing columns (outside 0..beam-1) are walkable only on top of a deck block.
- [ ] Stairs: a stairs part at level L facing a block whose top is L + 1 links that column to the block's top surface in both directions (climb up, step down); no other level changes are possible, and roof edges without stairs are walls.
- [ ] Attach parts (funnel, mast, radar mast, turrets, cranes, davits, helipad props, etc., whatever `placement === "attach"` with a physical presence): a blocking circle of about 0.45 cells at their resolved position (`resolveAttachPoint`); lights and flags (nav-lights, string-lights, stern-flag, underwater-light, searchlight, wireless-aerial) do not block.
- [ ] `stepWalker`: fixed step; yaw += turn * TURN_RATE * dt; move at WALK_SPEED (about 1.6 cells/s, diagonal not faster) relative to yaw; collision with a radius of about 0.25 cells against solid cells and circles with sliding along walls (not sticking); level changes only via stairs; returns a new state; deterministic; never leaves the walkable region.
- [ ] `spawnOf(ship)`: a clear main-deck position preferring near the bridge part (`bridge` role) else near mid-length on the centreline, never inside a blocked cell, returns `null` when no clear deck exists.
- [ ] Tests (not tautological): blocked by a cabin; walks open deck; slides along a wall; cannot step off a roof edge; stairs go up onto a deck block and back down; stairs facing nothing do nothing; a wing column without a deck is not walkable; a funnel blocks; a nav-light does not; spawn avoids blocked cells and returns null on a ship with every deck cell blocked; determinism; non-finite input handled (treated as 0).

**Verify:** `npm test -- --testPathPatterns=lib/ship-builder/walk` then `npm run type-check` and `npm run lint`.

**Steps:** TDD per file (grid, step, spawn), one commit each: `feat(ship-builder): walk grid`, `feat(ship-builder): walker step`, `feat(ship-builder): walk spawn`.

### Task 2: Walk state, store slice and button

**Goal:** The `walk` slice, live state, input module, `WalkButton`, and the freezes, mirroring Drive.

**Files:** create `lib/ship-builder/state/{walkLive,walkInput}.ts`, `components/ship-builder/ui/WalkButton.tsx`; modify `state/store.ts`, `ShipBuilder.tsx`, `ui/SeaTrialButton.tsx` (hide while walking like it does for Drive), `ui/DriveButton.tsx` (same), `hooks/useKeyboardShortcuts.ts` (Escape ends walk; swallow edit shortcuts while walking); tests under `state/__tests__/walk.test.ts` and `ui/__tests__/WalkButton.test.tsx`.

**Interfaces (binding for later tasks):**

```ts
// walkLive.ts
getWalkState(): WalkState | null
publishWalk(state: WalkState | null): void
subscribeWalk(listener: () => void): () => void
// walkInput.ts
export const walkInput: { forward: number; strafe: number; turn: number }  // mutable
export function resetWalkInput(): void
// store
export type WalkSlice = { status: "idle" } | { status: "walking"; runId: number };
actions: startWalk(), stopWalk()
```

**Acceptance Criteria:**

- [ ] `startWalk` works only from idle (no trial, no drive, no walk) and only when `spawnOf(ship)` is non-null; it publishes the spawn state, resets input, and sets `walking`. `stopWalk` clears everything and returns to idle. Building is frozen while walking (extend the same `isTrialActive`-style guard Drive uses). `startTrial`/`openDrive` do nothing while walking.
- [ ] `WalkButton` sits beside Drive and Sea trial (follow how `DriveButton` is passed through `SeaTrialButton`'s `beside` prop), disabled with a hint when there is no clear deck ("Add a deck to walk on"), 44px, light and dark. It is hidden while a trial, drive or walk is active, and the chrome tucks away while walking (`inFocus` includes walking). Focus returns to the Walk button on exit.
- [ ] Escape stops walking; Delete, Backspace and undo shortcuts do nothing while walking.
- [ ] A minimal temporary "Stop walking" button (44px) exists so the mode can be left before the HUD lands (Task 4 replaces it).
- [ ] Tests for the slice and the button.

**Verify:** `npm test`, `npm run type-check`, `npm run lint`. **Commits:** `feat(ship-builder): walk state and button`.

### Task 3: Scene (parallel with Task 4)

**Goal:** First-person camera and runner.

**Files:** create `components/ship-builder/scene/{WalkRunner.tsx,walkCamera.ts}` and `__tests__/walkCamera.test.ts`; modify `Scene.tsx`, `CameraRig.tsx`.

**Acceptance Criteria:**

- [ ] `WalkRunner` runs only while `walk.status === "walking"`, steps `stepWalker` with a fixed-step accumulator and `MAX_FRAME_DELTA` clamp, reads `walkInput`, publishes with `publishWalk`, and builds the grid once per ship via `walkGridOf` (memoised on the ship object).
- [ ] `walkCamera.ts`: pure `walkCamera(state, ship)` returns eye position and look target in the ship's frame: eye at floor height of the current level plus an eye height constant `EYE_HEIGHT` (start at 0.45 cells; tune against real screenshots), looking along yaw; finite for all inputs; tested.
- [ ] The camera lives in the ship's bob group (so the player moves with the ship's bob); it is ignored if the ship is not bobbing. A small near plane (0.05) so nearby railings do not clip. No OrbitControls while walking. Head-bob is skipped under `prefers-reduced-motion`.
- [ ] The camera is placed in the ship frame using the same `modelToWorld` conversion the scene uses for parts, so a part you stand next to appears next to you.
- [ ] When the walk ends the builder camera is restored (same effect Drive uses).

**Verify:** `npm test -- --testPathPatterns=walkCamera`, `npm run type-check`, `npm run lint`, `npx next build --webpack`. **Commit:** `feat(ship-builder): first-person walk scene`.

### Task 4: Controls and HUD (parallel with Task 3)

**Goal:** Joystick, look-drag, keys and the HUD.

**Files:** create `components/ship-builder/ui/{WalkJoystick.tsx,WalkHud.tsx}`, `hooks/useWalkKeys.ts` and tests; modify `ShipBuilder.tsx` (mount `WalkHud`, replace the temporary stop button).

**Acceptance Criteria:**

- [ ] `WalkJoystick`: pointer-capture drag at bottom-left, `touch-action: none`, writes `walkInput.forward/strafe` (-1..1, circular clamp, small dead zone), springs to centre on release, 44px+ targets, light and dark.
- [ ] Look: a transparent full-screen layer behind the joystick; dragging on it writes `walkInput.turn` proportional to horizontal drag speed, then 0 on release (touch and mouse). Vertical look is out of scope (level horizon).
- [ ] `useWalkKeys`: W/A/S/D and arrows (left/right turn with arrows, strafe with A/D, forward/back with W/S or up/down), Q/E turn; resets input on unmount; Escape is handled by `useKeyboardShortcuts` (do not double-handle).
- [ ] `WalkHud` has the joystick, a "Stop walking" button top-right (44px), and a short first-time hint ("Drag to look · stick to walk") that fades; `pointer-events-none` overlay with controls re-enabled.
- [ ] Tests for joystick, keys and HUD (follow Drive's tests).

**Verify:** `npm test`, `npm run type-check`, `npm run lint`. **Commits:** `feat(ship-builder): walk joystick and keys`, `feat(ship-builder): walk HUD`.

### Task 5: Verify in a real browser, e2e, release 2.10.0

**Goal:** Real-render check, e2e, release.

**Acceptance Criteria:**

- [ ] Run `next dev --webpack` and use a throwaway Playwright script (scratchpad dir) to walk Titanic, a cruise ship and a cargo ship at 1024x768 and 390x844; LOOK at the screenshots and fix visible defects (camera inside geometry, wrong eye height or scale, HUD overlap, walking through walls, can't climb stairs, spawn in a bad place). Report findings.
- [ ] `e2e/ship-builder-walk.spec.ts` tagged `{ tag: "@smoke" }`: Walk disabled with hint on a ship with no deck; load a template, tap Walk, HUD appears, move with keys and see state change through a test hook (extend `scene/testClock.ts` hooks the way Drive's e2e did, gated by `TEST_HOOKS_ENABLED`), stop walking and builder returns.
- [ ] `SHIP_BUILDER_VERSION` to 2.10.0 and a top `CHANGELOG` entry ("Walk the decks", date 2026-10-05, plain-words highlights); update the HelpButton tips; add a README line in `lib/ship-builder/sail/` or a new `walk/README.md` pointing to the model.
- [ ] `npm run validate` and the e2e on chromium, webkit and ipad pass; related ship-builder e2e specs pass on chromium.

**Commits:** `test(e2e): walk the decks`, `fix(...)` as needed, `chore(ship-builder): release 2.10.0, walk the decks`.

## Execution order

1. Task 1 (one Sonnet implementer, main checkout).
2. Task 2 (one Sonnet implementer, main checkout).
3. Tasks 3 and 4 in parallel worktrees, merged in order 3, 4.
4. Task 5 (one Sonnet implementer, main checkout), then one combined review and `npm run validate` by the controller.
