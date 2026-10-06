# Walk on the Sinking Ship Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player walk the decks while the ship sinks, and sink her with one tap from walk mode (Ship Builder 2.13.0, stage 1 of the spec).

**Architecture:** The walker already lives in ship coordinates inside `BobGroup`, so the sim's roll/pitch/sink already carry her; no change to `stepWalker`. Work is: store transitions (walk and a running trial coexist, a one-tap iceberg from walk mode, the walk ends with the trial), a camera that follows the deck fully and tilts as the trial pose blends in, and two UI entry points (Sink button in the walk HUD, Walk button mid-trial).

**Tech Stack:** Next.js 16 / React 19 / TypeScript, zustand store, react-three-fiber, Jest + RTL, Playwright.

Spec: `docs/superpowers/specs/2026-10-06-ship-builder-walk-while-sinking-design.md`.

**Deviations from the spec (found while planning):**

- `startTrial` keeps its walk guard. A separate `sinkWhileWalking()` starts the trial, so nothing else can start one mid-walk. `startWalk` is what loses its guard (it may start while a trial is `running`; still not while aiming or at a result).
- The reduced-motion tilt cap is dropped. Reduced-motion trials are instant (`InstantIcebergTrial` finishes at once), so there is never a sinking to ride and nothing to cap. A reduced-motion player who presses Sink gets the result card straight away, like every other reduced-motion trial.
- `SeaTrialStatus` must not steal focus when the run starts while walking: Space is the jump key and would press its focused Stop button.

**Review depth (per global CLAUDE.md):** ordinary UI/plumbing, so one combined review per task at most; Tasks 1 to 4 are small enough that the controller can spot-check diffs and run tests. Run the expensive e2e and `npm run validate` once, in Task 5.

---

## File Structure

- `lib/ship-builder/state/store.ts`: transitions (modify).
- `lib/ship-builder/state/__tests__/walk.test.ts`: store tests (modify).
- `components/ship-builder/scene/walkCamera.ts`: `WALK_SWAY_SHARE` moves here, plus `swayShare(blend)` (modify).
- `components/ship-builder/scene/trialPlayback.ts`: new `blend` field (modify).
- `components/ship-builder/scene/BobGroup.tsx`: writes `trialPlayback.blend` (modify).
- `components/ship-builder/scene/WalkEyes.tsx`: uses the blend (modify).
- `components/ship-builder/scene/WalkRunner.tsx`: ends the walk at the break (modify).
- `components/ship-builder/ui/SeaTrialStatus.tsx`: no focus steal while walking (modify).
- `components/ship-builder/ui/WalkHud.tsx`: Sink button (modify).
- `components/ship-builder/ui/TrialWalkButton.tsx`: Walk button mid-trial (create).
- `components/ship-builder/ShipBuilder.tsx`: mounts `TrialWalkButton` (modify).
- `e2e/ship-builder-walk-sinking.spec.ts` (create); `lib/ship-builder/version.ts`, `changelog.ts`, `lib/ship-builder/walk/README.md`, the spec (modify).

---

### Task 1: Store: walk with a running trial, sink from walking, trial ends the walk

**Goal:** `startWalk` works while a trial runs, `sinkWhileWalking()` starts the iceberg trial without touching the walk, and `finishTrial` ends the walk.

**Files:**

- Modify: `lib/ship-builder/state/store.ts` (action types ~line 215; `startTrial` ~line 608; `startWalk` ~line 662; `finishTrial` ~line 712)
- Test: `lib/ship-builder/state/__tests__/walk.test.ts`

**Acceptance Criteria:**

- [ ] `startWalk` starts when `trial.status` is `idle` or `running`, and is refused while aiming, at a result, during drive setup/sailing, or already walking.
- [ ] `sinkWhileWalking` does nothing unless `walk.status === "walking"` and `trial.status === "idle"`; otherwise it starts a `running` iceberg trial with `impactX = 0.2 * gridLength(ship)`, `descending: false`, `from: "start"`, and leaves `walk` untouched.
- [ ] `finishTrial` also leaves walk mode (walk idle, `getWalkState()` null, input reset).
- [ ] `startTrial` still refuses while walking; building stays frozen while walking.

**Verify:** `npm test -- --testPathPattern="state/__tests__/(walk|store.trial|store.aim|drive)"` → all pass.

**Steps:**

- [ ] **Step 1: Update and add tests in `walk.test.ts`**

Add imports at the top:

```ts
import { gridLength } from "../../model/grid";
import { createTrial } from "../../sim/seaTrial";
```

Replace the existing test `"does not start during setup, sailing or a trial"` with:

```ts
it("does not start during setup, sailing, an aim or a result", () => {
  load();
  act(() => store().openDrive());
  act(() => store().startWalk());
  expect(store().walk.status).toBe("idle");
  act(() => store().startDrive({ seed: 1, kinds: [], density: "few" }));
  act(() => store().startWalk());
  expect(store().walk.status).toBe("idle");
  act(() => store().endDrive());

  act(() => store().aimIceberg());
  act(() => store().startWalk());
  expect(store().walk.status).toBe("idle");
  act(() => store().cancelAim());

  act(() => store().startTrial("calm", 5));
  const { trial } = store();
  if (trial.status !== "running") throw new Error("expected running");
  act(() => store().finishTrial(createTrial(trial.input)));
  act(() => store().startWalk());
  expect(store().walk.status).toBe("idle");
});

it("starts while a trial is running", () => {
  load();
  act(() => store().startTrial("calm", 5));
  act(() => store().startWalk());
  expect(store().walk.status).toBe("walking");
  expect(store().trial.status).toBe("running");
});
```

Add a new `describe` at the end of the file:

```ts
describe("sinking while walking", () => {
  it("starts an iceberg trial, keeps the walk, and the result ends the walk", () => {
    load();
    act(() => store().startWalk());
    act(() => store().sinkWhileWalking());
    expect(store().walk.status).toBe("walking");
    const { trial } = store();
    expect(trial).toMatchObject({
      status: "running",
      descending: false,
      from: "start",
    });
    if (trial.status !== "running") throw new Error("expected running");
    expect(trial.input.iceberg?.impactX).toBeCloseTo(
      0.2 * gridLength(testShip())
    );

    act(() => store().finishTrial(createTrial(trial.input)));
    expect(store().trial.status).toBe("result");
    expect(store().walk).toEqual({ status: "idle" });
    expect(getWalkState()).toBeNull();
  });

  it("does nothing unless walking with no trial", () => {
    load();
    act(() => store().sinkWhileWalking());
    expect(store().trial.status).toBe("idle");

    act(() => store().startWalk());
    act(() => store().sinkWhileWalking());
    const first = store().trial;
    act(() => store().sinkWhileWalking());
    expect(store().trial).toBe(first);
  });

  it("stopping the trial leaves the walk going", () => {
    load();
    act(() => store().startWalk());
    act(() => store().sinkWhileWalking());
    act(() => store().endTrial());
    expect(store().trial.status).toBe("idle");
    expect(store().walk.status).toBe("walking");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --testPathPattern="state/__tests__/walk"`
Expected: FAIL (`sinkWhileWalking is not a function`; "starts while a trial is running" fails).

- [ ] **Step 3: Implement in `store.ts`**

In the actions interface next to `startWalk`/`stopWalk` (~line 215) add:

```ts
  /**
   * While walking with no trial on, starts an iceberg trial at a fixed spot
   * and keeps walking; the walk ends when the trial's result arrives.
   */
  sinkWhileWalking(): void;
```

Near the top of the store file (after the `HISTORY_LIMIT`-style constants) add:

```ts
/** Where "Sink the ship" strikes her: this share of her length from the bow. */
const SINK_IMPACT_FRACTION = 0.2;
```

Inside the store closure, next to `isTrialActive`, extract the body of `startTrial` after its guard into a function, so both entry points share it:

```ts
/** Starts the trial (the caller has checked it may); walking is untouched. */
function beginTrial(sea: SimSea, impactX?: number) {
  const { ship, breakMode } = get();
  const { stats } = analyzeShip(ship);
  const input: TrialInput = {
    ship: simShipFromStats(stats, ship.hull.beam),
    sea,
    ...(impactX === undefined
      ? {}
      : {
          iceberg: {
            compartments: compartmentSpecsOf(ship.hull),
            length: gridLength(ship),
            impactX,
            breakMode,
          },
        }),
  };
  runId += 1;
  set({
    trial: {
      status: "running",
      input,
      runId,
      descending: false,
      from: "start",
    },
    tool: { kind: "none" },
    ...CLEARED,
  });
}
```

Replace the `startTrial` implementation with:

```ts
    startTrial(sea, impactX) {
      if (get().walk.status !== "idle") return;
      beginTrial(sea, impactX);
    },

    sinkWhileWalking() {
      if (get().walk.status !== "walking") return;
      if (get().trial.status !== "idle") return;
      beginTrial(getSeaState(), gridLength(get().ship) * SINK_IMPACT_FRACTION);
    },
```

Replace the guard at the top of `startWalk`:

```ts
    startWalk() {
      const { trial, drive, walk } = get();
      if (drive.status !== "idle" || walk.status !== "idle") return;
      // She can be walked while a trial runs, not while it is aiming or done.
      if (trial.status !== "idle" && trial.status !== "running") return;
      const spawn = spawnOf(get().ship);
```

(keep the rest of `startWalk` as is). In `finishTrial`, after the `set({...})` that writes the result, add:

```ts
// The walker rode her down; the result card takes over.
get().stopWalk();
```

Update the `TrialSlice` doc comment only if it contradicts (it says anything but idle freezes the ship; still true).

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --testPathPattern="state/__tests__"` and `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ship-builder/state/store.ts lib/ship-builder/state/__tests__/walk.test.ts
git commit -m "feat(ship-builder): walk with a running trial and sink from walk mode"
```

---

### Task 2: Camera follows the deck fully and tilts as she goes down

**Goal:** The eyes follow 25% of the ship's motion in calm water and ramp to 100% (with the camera's up vector rolling with the deck) as the trial pose blends in.

**Files:**

- Modify: `components/ship-builder/scene/walkCamera.ts` (add constant and `swayShare`)
- Modify: `components/ship-builder/scene/trialPlayback.ts` (`blend` field)
- Modify: `components/ship-builder/scene/BobGroup.tsx` (write the blend)
- Modify: `components/ship-builder/scene/WalkEyes.tsx` (use it)
- Test: `components/ship-builder/scene/__tests__/walkCamera.test.ts`, `trialPlayback.test.ts` (if it compares the whole playback object)

**Acceptance Criteria:**

- [ ] `swayShare(0) === 0.25`, `swayShare(1) === 1`, values between are linear, and out-of-range or non-finite blends are clamped (non-finite reads as 0).
- [ ] `WALK_SWAY_SHARE` lives in `walkCamera.ts` and every importer still compiles.
- [ ] `trialPlayback.blend` (0 to 1) is written by `BobGroup` every frame and reset by `resetPlayback`.
- [ ] `WalkEyes` uses `swayShare(trialPlayback.blend)` and sets `camera.up` to world-up blended toward the bob group's up by the same blend; at blend 0 behaviour is exactly as before.

**Verify:** `npm test -- --testPathPattern="scene/__tests__/(walkCamera|trialPlayback)"` and `npm run type-check` → pass.

**Steps:**

- [ ] **Step 1: Failing test in `walkCamera.test.ts`**

Add `swayShare, WALK_SWAY_SHARE` to the import from `"../walkCamera"` and append:

```ts
describe("swayShare", () => {
  it("is the calm share with no trial pose and the whole motion at full blend", () => {
    expect(swayShare(0)).toBe(WALK_SWAY_SHARE);
    expect(swayShare(1)).toBe(1);
    expect(swayShare(0.5)).toBeCloseTo((WALK_SWAY_SHARE + 1) / 2);
  });

  it("holds out-of-range and non-finite blends to the ends", () => {
    expect(swayShare(-3)).toBe(WALK_SWAY_SHARE);
    expect(swayShare(4)).toBe(1);
    expect(swayShare(Number.NaN)).toBe(WALK_SWAY_SHARE);
  });
});
```

Run: `npm test -- --testPathPattern="walkCamera"` → FAIL (not exported).

- [ ] **Step 2: Implement `swayShare` and move the constant**

In `walkCamera.ts` add (after `LOOK_DISTANCE`):

```ts
/**
 * How much of the ship's own motion the eyes follow in calm water (0 is a
 * perfectly level view, 1 is bolted to the deck). The eyes sit only 0.45 cells
 * above the deck, so the full rise, fall and roll of a bobbing ship (up to
 * about 0.16 cells at the eye) would swing the view like a boat ride; a
 * quarter of it keeps a gentle sway that still moves with the ship.
 */
export const WALK_SWAY_SHARE = 0.25;

/**
 * The share of the ship's motion the eyes follow, given how much of the sea
 * trial's pose is showing (0 to 1). A sinking ship is no gentle sway: the eyes
 * must stay on the deck, so the share climbs to the whole motion.
 */
export function swayShare(blend: number): number {
  const weight = Number.isFinite(blend) ? Math.min(1, Math.max(0, blend)) : 0;
  return WALK_SWAY_SHARE + (1 - WALK_SWAY_SHARE) * weight;
}
```

In `WalkEyes.tsx` delete the local `WALK_SWAY_SHARE` doc comment and export (the one in the file), and run `grep -rn "WALK_SWAY_SHARE" components lib e2e` to repoint any importer (tests included) at `./walkCamera`.

- [ ] **Step 3: `trialPlayback.blend`**

In `TrialPlayback` add:

```ts
/**
 * How much of the pose above shows on the ship (0 to 1), written by the
 * ship's group each frame; the walker's eyes read it to follow the deck.
 */
blend: number;
```

and `blend: 0,` in `createPlayback()` (after `sink: 0`). If `trialPlayback.test.ts` deep-compares a reset playback, add `blend: 0` there.

In `BobGroup.tsx`, right after `const weight = blend.current;` add:

```ts
trialPlayback.blend = weight;
```

- [ ] **Step 4: `WalkEyes` uses it**

Imports: `import { swayShare, walkCamera } from "./walkCamera";` and `import { trialPlayback } from "./trialPlayback";`. Add a module-level scratch `const shipUp = new Vector3();`. Replace the two `lerpVectors(..., WALK_SWAY_SHARE)` lines and the camera block with:

```ts
const weight = trialPlayback.blend;
const share = swayShare(weight);
eye.lerpVectors(levelEye, eye, share);
look.lerpVectors(levelLook, look, share);
// Level horizon while the sea is calm; once she goes down, the view rolls
// and pitches with the deck.
shipUp.set(0, 1, 0).transformDirection(holder.matrixWorld);
const { camera } = get();
camera.position.copy(eye);
camera.up.set(0, 1, 0).lerp(shipUp, weight).normalize();
camera.lookAt(look);
```

(The `holder.localToWorld(eye/look)` calls stay before this and the old `camera.up.set(0, 1, 0)` line goes.) Update the component doc comment: "...then eased back toward the still ship's view (see `swayShare`) so a calm sea's sway stays gentle; during a sea trial the view follows the deck fully."

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --testPathPattern="scene/__tests__"` and `npm run type-check` → PASS.

```bash
git add components/ship-builder/scene lib
git commit -m "feat(ship-builder): walker's eyes follow the deck as she sinks"
```

---

### Task 3: The walk ends at the break; the trial's Stop keeps its hands off the jump key

**Goal:** Stage 1 has no half to ride, so a walk ends when she breaks; and starting a run while walking never moves focus onto the trial's Stop button.

**Files:**

- Modify: `components/ship-builder/scene/WalkRunner.tsx`
- Modify: `components/ship-builder/ui/SeaTrialStatus.tsx` (the focus effect, ~line 28)
- Test: `components/ship-builder/ui/__tests__/SeaTrialStatus.test.tsx`

**Acceptance Criteria:**

- [ ] While a trial is running, `WalkRunner`'s frame stops the walk as soon as `trialPlayback.breakup !== null`.
- [ ] `SeaTrialStatus` focuses its Stop button on a new run only when not walking.

**Verify:** `npm test -- --testPathPattern="SeaTrialStatus"` → pass; `npm run type-check`.

**Steps:**

- [ ] **Step 1: Failing test** (append to `SeaTrialStatus.test.tsx`; add `import { testShip } from "@/lib/ship-builder/testing";` if absent)

```tsx
describe("SeaTrialStatus focus", () => {
  it("leaves focus alone when the run starts while walking", () => {
    render(<SeaTrialStatus />);
    act(() => {
      store().loadShip(testShip(), null);
      store().startWalk();
    });
    act(() => store().sinkWhileWalking());
    expect(document.body).toHaveFocus();
  });

  it("still focuses Stop when a run starts from building", () => {
    render(<SeaTrialStatus />);
    act(() => store().startTrial("calm", 5));
    expect(document.body).not.toHaveFocus();
  });
});
```

Run → first test FAILS (Stop is focused).

- [ ] **Step 2: Fix the focus effect**

```tsx
useEffect(() => {
  // Space jumps while walking: a focused Stop button would take it as a press.
  const isWalking = useShipBuilderStore.getState().walk.status === "walking";
  if (isRunning && !isWalking) stopButton.current?.focus();
}, [isRunning, runId]);
```

Update the comment above it to mention the walking case.

- [ ] **Step 3: End the walk at the break in `WalkRunner.tsx`**

Import `trialPlayback` from `"./trialPlayback"`. In `Walking`, add `const stopWalk = useShipBuilderStore((s) => s.stopWalk);` and at the top of the `useFrame` callback:

```ts
// She has broken in two and there is no half to ride yet (a later
// release): the walk ends and the trial plays on.
if (
  trialPlayback.breakup !== null &&
  useShipBuilderStore.getState().trial.status === "running"
) {
  stopWalk();
  return;
}
```

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --testPathPattern="SeaTrialStatus|scene/__tests__"` and `npm run type-check` → PASS.

```bash
git add components/ship-builder
git commit -m "feat(ship-builder): end the walk at the break and keep focus off Stop"
```

---

### Task 4: UI: "Sink the ship" in the walk HUD, Walk during a trial

**Goal:** A Sink button in the walk HUD, and a Walk button that shows while a trial runs.

**Files:**

- Modify: `components/ship-builder/ui/WalkHud.tsx`
- Create: `components/ship-builder/ui/TrialWalkButton.tsx`
- Modify: `components/ship-builder/ShipBuilder.tsx` (import, and `{webgl && <TrialWalkButton />}` after `<WalkHud />`, ~line 160)
- Test: `components/ship-builder/ui/__tests__/WalkHud.test.tsx`, create `components/ship-builder/ui/__tests__/TrialWalkButton.test.tsx`

**Acceptance Criteria:**

- [ ] While walking with no trial, WalkHud shows a "Sink the ship" button beside "Stop walking"; clicking starts the iceberg trial; once a trial exists the button is gone.
- [ ] `TrialWalkButton` renders the existing `WalkButton` only while `trial.status === "running"`, walk and drive idle, and the live trial state is neither `done` nor broken in two.
- [ ] Both buttons meet the 44px target, light and dark classes, visible focus ring.

**Verify:** `npm test -- --testPathPattern="WalkHud|TrialWalkButton"` and `npm run lint` → pass.

**Steps:**

- [ ] **Step 1: Failing tests**

Append to `WalkHud.test.tsx` (inside or after the main `describe`; `startWalking()` already exists):

```tsx
describe("WalkHud Sink the ship", () => {
  it("sinks the ship from walk mode, then goes away", async () => {
    const user = userEvent.setup();
    startWalking();
    render(<WalkHud />);
    await user.click(screen.getByRole("button", { name: "Sink the ship" }));
    expect(store().trial).toMatchObject({ status: "running" });
    expect(store().walk.status).toBe("walking");
    expect(
      screen.queryByRole("button", { name: "Sink the ship" })
    ).not.toBeInTheDocument();
  });
});
```

Create `TrialWalkButton.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { createTrial } from "@/lib/ship-builder/sim/seaTrial";
import type { TrialInput } from "@/lib/ship-builder/sim/types";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { testShip } from "@/lib/ship-builder/testing";
import { clearLiveTrial, publishLiveTrial } from "../../scene/liveTrial";
import TrialWalkButton from "../TrialWalkButton";

const store = () => useShipBuilderStore.getState();

const INPUT: TrialInput = {
  ship: { stabilityRatio: 0, listAngle: 0, beam: 5 },
  sea: "calm",
};

const walkButton = () => screen.queryByRole("button", { name: "Walk" });

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
  act(() => {
    clearLiveTrial();
    store().loadShip(testShip(), null);
  });
});

describe("TrialWalkButton", () => {
  it("shows only while a trial is running", () => {
    render(<TrialWalkButton />);
    expect(walkButton()).toBeNull();
    act(() => store().startTrial("calm", 5));
    expect(walkButton()).toBeVisible();
  });

  it("starts the walk and then goes away", () => {
    render(<TrialWalkButton />);
    act(() => store().startTrial("calm", 5));
    act(() => walkButton()!.click());
    expect(store().walk.status).toBe("walking");
    expect(walkButton()).toBeNull();
  });

  it("hides once she has gone under", () => {
    render(<TrialWalkButton />);
    act(() => store().startTrial("calm", 5));
    act(() =>
      publishLiveTrial({ ...createTrial(INPUT), phase: "done" }, 0, true)
    );
    expect(walkButton()).toBeNull();
  });
});
```

Run → FAIL (module missing, no Sink button).

- [ ] **Step 2: `TrialWalkButton.tsx`**

```tsx
"use client";

import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { useLiveTrialState } from "../scene/liveTrial";
import WalkButton from "./WalkButton";

/**
 * The Walk button while a sea trial plays (the Sea trial button, which
 * normally carries it, is hidden then). It goes away once she has broken in two
 * or gone under: there is nothing left to walk on.
 */
export default function TrialWalkButton() {
  const isShown = useShipBuilderStore(
    (s) =>
      s.trial.status === "running" &&
      s.walk.status === "idle" &&
      s.drive.status === "idle"
  );
  const live = useLiveTrialState();
  if (!isShown) return null;
  if (live && (live.phase === "done" || live.breakup !== null)) return null;
  return (
    <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2">
      <WalkButton />
    </div>
  );
}
```

- [ ] **Step 3: Sink button in `WalkHud.tsx`**

Add `Snowflake` to the lucide import and this component above `WalkingControls`:

```tsx
/** Strikes an iceberg at a fixed spot and keeps walking while she goes down. */
function SinkShipButton() {
  const canSink = useShipBuilderStore((s) => s.trial.status === "idle");
  const sinkWhileWalking = useShipBuilderStore((s) => s.sinkWhileWalking);
  if (!canSink) return null;
  return (
    <button
      type="button"
      onClick={sinkWhileWalking}
      className="pointer-events-auto inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-full bg-rose-700 px-4 text-sm font-semibold text-white shadow-lg hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 dark:bg-rose-500 dark:text-slate-900 dark:hover:bg-rose-400 dark:focus-visible:outline-rose-300"
    >
      <Snowflake aria-hidden="true" className="h-5 w-5 shrink-0" />
      Sink the ship
    </button>
  );
}
```

In `WalkingControls` change the top row to:

```tsx
<div className="flex items-start justify-end gap-2">
  <SinkShipButton />
  <StopWalkingButton />
</div>
```

- [ ] **Step 4: Mount it in `ShipBuilder.tsx`**

Import `TrialWalkButton from "./ui/TrialWalkButton"` and add `{webgl && <TrialWalkButton />}` right after `{webgl && <WalkHud />}`.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --testPathPattern="ui/__tests__"`, `npm run lint`, `npm run format`, `npm run type-check` → PASS.

```bash
git add components/ship-builder
git commit -m "feat(ship-builder): Sink the ship while walking, and Walk during a trial"
```

---

### Task 5: E2E, release 2.13.0, docs, one full validation

**Goal:** Prove the flow in a browser, ship the release entry, and run the expensive checks once.

**Files:**

- Create: `e2e/ship-builder-walk-sinking.spec.ts`
- Modify: `lib/ship-builder/version.ts`, `lib/ship-builder/changelog.ts`, `lib/ship-builder/walk/README.md`, `docs/superpowers/specs/2026-10-06-ship-builder-walk-while-sinking-design.md`

**Acceptance Criteria:**

- [ ] E2E: walk, press "Sink the ship", still walking and trial running; wait for the result bar; walk is idle.
- [ ] E2E: start a trial from the store, press Walk mid-trial, walking.
- [ ] `SHIP_BUILDER_VERSION` is `2.13.0` with a matching top changelog entry in plain words.
- [ ] `npm run validate` and the new e2e file pass.

**Verify:** `npm run test:e2e -- e2e/ship-builder-walk-sinking.spec.ts` then `npm run validate` → pass.

**Steps:**

- [ ] **Step 1: Write the e2e**

Create `e2e/ship-builder-walk-sinking.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

/**
 * Walking on the sinking ship: press Sink the ship while walking and keep
 * walking as the trial plays, or press Walk while a trial is already running.
 * `trialSpeed` plays the trial faster so the whole sinking takes moments; the
 * break mode is "never" so she goes down in one piece, the only case the walk
 * rides all the way.
 */

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "WebGL is only reliable in headless Chromium"
);

test.setTimeout(120_000);

async function openTitanic(page: Page) {
  await page.addInitScript(() => {
    window.__SHIP_BUILDER_TEST__ = { trialSpeed: 4 };
  });
  await page.goto("/ship-builder");
  await expect(
    page.getByRole("heading", { name: "Ship Builder" })
  ).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
  await page.getByRole("button", { name: "New", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "New ship" });
  await picker.getByRole("button", { name: /Ocean liner/ }).click();
  await picker.getByRole("button", { name: /RMS Titanic/ }).click();
  await expect(picker).toHaveCount(0);
  await page.evaluate(() =>
    window.__shipBuilderStore!.getState().setBreakMode("never")
  );
}

const status = (page: Page) =>
  page.evaluate(() => {
    const { walk, trial } = window.__shipBuilderStore!.getState();
    return { walk: walk.status, trial: trial.status };
  });

test.describe("Ship Builder walk while sinking", () => {
  test("sink the ship from walk mode and ride her down to the result", async ({
    page,
  }) => {
    await openTitanic(page);
    await page.getByRole("button", { name: "Walk", exact: true }).click();
    await page.getByRole("button", { name: "Sink the ship" }).click();

    await expect
      .poll(() => status(page))
      .toEqual({
        walk: "walking",
        trial: "running",
      });
    await expect(
      page.getByRole("button", { name: "Sink the ship" })
    ).toHaveCount(0);

    await expect(
      page.getByRole("region", { name: "Sea trial result" })
    ).toBeVisible({ timeout: 90_000 });
    expect((await status(page)).walk).toBe("idle");
  });

  test("walk while a trial is already running", async ({ page }) => {
    await openTitanic(page);
    await page.evaluate(() =>
      window.__shipBuilderStore!.getState().startTrial("calm", 20)
    );
    await page.getByRole("button", { name: "Walk", exact: true }).click();
    await expect
      .poll(() => status(page))
      .toEqual({
        walk: "walking",
        trial: "running",
      });
  });
});
```

Run: `npm run test:e2e -- e2e/ship-builder-walk-sinking.spec.ts`. If the first test cannot see "Walk" (the Walk button is only beside the Sea trial button when idle), that is correct for building; if a locator is ambiguous, fix the locator, not the product. If `startTrial("calm", 20)` is not a valid impact for Titanic, use a value within `gridLength`.

- [ ] **Step 2: Eyeball it once**

Start `npm run dev`, load the Titanic, Walk, Sink the ship, and look: the Sink button and Stop walking both clear of the status pill (top centre) and the below-deck inset; the Walk button during a trial sits bottom-centre clear of other controls; the view rolls with the deck and the eye stays on it as she goes down; the result card appears when she is under. Fix any overlap (move `TrialWalkButton`'s position classes) and commit it with the e2e. Report anything odd rather than hiding it.

- [ ] **Step 3: Release 2.13.0**

`version.ts`: `"2.13.0"`. At the top of `CHANGELOG` in `changelog.ts`:

```ts
  {
    version: "2.13.0",
    date: "2026-10-06",
    title: "Walk the sinking ship",
    highlights: [
      "Now you can walk around your ship while she sinks. The deck tilts and the sea rises around you",
      "While you walk there is a new Sink the ship button. Tap it and an iceberg hits her while you stay on deck",
      "Start a sea trial first and tap Walk to climb aboard while she is already going down",
      "If she breaks in two, the walk ends and you watch the rest, since walking on a broken ship is still to come",
    ],
  },
```

Add to the end of the second bullet list in `lib/ship-builder/walk/README.md` (the "Where the rest lives" paragraph) one sentence: "A walk can run during a sea trial: the ship's group carries the walker, and `WalkEyes` follows the deck fully as the trial pose blends in (`swayShare`)." In the spec, add a short "Changes made while planning" list with the three deviations from this plan's header.

- [ ] **Step 4: Full validation (once)**

Run: `npm run validate` → all green; `npm run test:e2e -- e2e/ship-builder-walk.spec.ts e2e/ship-builder-iceberg.spec.ts e2e/ship-builder-walk-sinking.spec.ts` → all pass (walk and iceberg specs guard the behaviour this plan touches).

- [ ] **Step 5: Commit**

```bash
git add e2e lib docs components
git commit -m "feat(ship-builder): walk on the sinking ship (2.13.0)"
```
