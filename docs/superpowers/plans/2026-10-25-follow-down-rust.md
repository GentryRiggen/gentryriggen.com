# Always Follow Her Down, and Rust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every trial that ends with her sunk carries on to the sea floor automatically, with no "Follow her down" button. Once she lands, rust creeps over her.

**Architecture:**

- **Iceberg trials:** these already precompute a timeline. They now always run with `descending: true`, so the descent is appended whenever she sank. The `descend` action, the button and the walker special case go away.
- **Weather capsizes:** these step live. On sinking they move to the existing `"descending"` phase instead of `"done"`, using a new `TrialInput.length` for the body span.
- **Rust:** a scene-only effect. Every shared ship material (`Surface`'s cache, plus the hull's own materials) gets one `onBeforeCompile` patch that reads a single module uniform, `RUST.value` (0–1). A `RustDriver` sets that value each frame from the live trial state: it ramps up after the first `touched-bottom` event.

**Tech Stack:** TypeScript, zustand, three / @react-three/fiber (GLSL `onBeforeCompile`), Jest, Playwright (specs updated, not run).

**Spec:** `docs/superpowers/specs/2026-10-25-ship-builder-life-aboard-design.md` (section 3)

## Global Constraints

- There's no "Follow her down" button anywhere. Whenever a trial ends `sank`, she always goes to the sea floor.
- This covers iceberg sinkings and weather capsizes alike. If the weather part turns out to be a lot of work, land the iceberg part and report the gap. Don't quietly leave it out.
- The result card shows once she's on the bottom. The scrubber and timeline cover the whole descent.
- Rust creeps in over **4 seconds** after the first touchdown, never all at once. Her paint stays faintly visible underneath (the rust mix tops out at **0.8**). It covers the hull, decks, superstructure and funnels.
- Rust is a look only. It doesn't change the saved ship. "Try again" and going back to building show her clean.
- The sim stays deterministic and pure (no `Math.random` in `lib/`).
- This is a Ship Builder release: `SHIP_BUILDER_VERSION` becomes `2.19.0`, with a matching top `CHANGELOG` entry.
- Per-task checks are `npm test`, `npm run type-check` and `npm run lint` only. Update the e2e specs that reference the removed button, but don't run e2e or `npm run build`.

## Review Focus

1. An iceberg trial where she **doesn't** sink: it still ends normally with no descent, and the result card shows at the same moment as before. Pinned in Task 1.
2. "Try again" after a sinking: she starts clean, at the surface, with no rust. Pinned in Task 3 (rust resets when the trial restarts or ends) and Task 1 (replay starts from the start).
3. Scrubbing the timeline back to before touchdown: the rust fades back out. It follows the playback time, not wall-clock time. Pinned in Task 3.
4. A walker aboard during a sinking: they still ride her down, and the result waits until they stop walking. Pinned in Task 1.
5. A weather trial that only rolls hard and recovers: no descent. Pinned in Task 2.

## Execution notes (cost)

- Tasks 1 and 2 run in sequence: both touch the store and the sim. **Both Sonnet.**
- Task 3 (rust and release, **Sonnet**) touches only scene files and the version/changelog. It runs in parallel with Task 1 in a worktree.
- One combined review (Sonnet) after all three.

---

### Task 1: Iceberg trials always descend (Sonnet)

**Files:**

- Modify: `lib/ship-builder/state/store.ts`. In `beginTrial`, set `descending: input.iceberg !== undefined`. Delete the `descend` action (type and implementation) and the `ridesDown` branch in `finishTrial`. If nothing else sets `from: "end"` after these changes, remove the `from` field from `TrialSlice` and every reader. Otherwise leave it.
- Modify: `components/ship-builder/ui/SeaTrialResult.tsx` and `components/ship-builder/ui/SeaTrialStatus.tsx`. Remove `canFollow` and the button.
- Modify: `components/ship-builder/ui/seaTrialText.ts`. Remove `FOLLOW_HER_DOWN`.
- Modify: comments that mention "Follow her down" in `scene/SeaTrialRunner.tsx`, `scene/BobGroup.tsx` and `scene/trialPlayback.ts`, plus the store's `TrialSlice` doc comment. Rewrite them to describe the new behaviour.
- Modify: `e2e/ship-builder-breakup.spec.ts` (~L105–125). Instead of clicking the button, wait for the descent (the result card appears once she's on the floor). Run `grep -rn "descend\|Follow her down" e2e` to find any others.
- Test: `lib/ship-builder/state/__tests__/store.trial.test.ts`, `store.breakup.test.ts`, `components/ship-builder/ui/__tests__/SeaTrialResult.test.tsx`, `SeaTrialStatus.test.tsx`, `IcebergTrialPanels.test.tsx` and `scene/__tests__` (whatever references `descend` or `descending`).

**Interfaces (produces):** Every running iceberg trial has `descending === true`. `useShipBuilderStore.getState().descend` no longer exists.

- [ ] **Step 1: Update and write tests first.**
  - Starting an iceberg trial gives `trial.descending === true`. Starting a weather trial gives `false` for now (Task 2 changes this).
  - `trialTimelineFor(input, true)` for an iceberg input where she **doesn't** sink has the same final `time` and `outcome` as `trialTimelineFor(input, false)`. Put this test in `components/ship-builder/scene/__tests__/` beside the existing timeline tests.
  - Neither `SeaTrialResult` nor `SeaTrialStatus` ever renders a button named "Follow her down".
  - With a walker aboard, `finishTrial(sunkState)` on an iceberg trial sets `status: "result"`. The descent was already part of the run, and the result still waits for the walk to end, if that's how today's code gates the card (read the existing walk/trial tests and keep that behaviour).
  - Delete or rewrite every test of `descend()`.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns="store|SeaTrial|IcebergTrial|trialTimeline"`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the changes listed under Files.
- [ ] **Step 4: Run** `npm test`, `npm run type-check` and `npm run lint`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(ship-builder): iceberg sinkings always follow her down`

---

### Task 2: Weather capsizes descend too (Sonnet)

**Files:**

- Modify: `lib/ship-builder/sim/types.ts`. Add a required `length: number` to `TrialInput` (cells, bow to stern; the same value as `iceberg.length`).
- Modify: `lib/ship-builder/state/store.ts`. Have `beginTrial` set `length: gridLength(ship)`, and set `descending: true` for every trial.
- Modify: `lib/ship-builder/sim/descent.ts`. Use `input.length` in place of `input?.iceberg?.length ?? 0`. Make `input` required if every caller passes it.
- Modify: `lib/ship-builder/sim/seaTrial.ts`. Where a weather (non-iceberg) sinking finishes (`stepSinking` reaching the end of `SINK_DEPTH` with outcome `sank`), return `startDescent(...)` of the finished state rather than leaving it `done`. Raise `runTrial`'s weather `maxSeconds` from `30` to `60`.
- Modify: every `TrialInput` literal in tests and the `driveHit` path. TypeScript will list them.
- Modify: the weather trial's scene driver in `components/ship-builder/scene/SeaTrialRunner.tsx`, and `cameraFollow.ts` if needed, so the camera follows a weather descent the same way it follows an iceberg one. Read how the iceberg path shows the sea floor and follows `descending`, and mirror it.
- Modify: `lib/ship-builder/sim/README.md`. In "Phases and events", say that a weather `sank` goes on to `descending`.
- Test: `lib/ship-builder/sim/__tests__/seaTrial.test.ts`, `lib/ship-builder/sim/__tests__/descent.test.ts`

- [ ] **Step 1: Write failing tests.**
  - A weather trial that capsizes (use the existing outcome-table fixtures for a dangerous ship in a stormy sea) ends `phase: "done"` with `outcome: "sank"`. Its events include `touched-bottom`, and its final `pose.sink` puts the deepest point on the floor: compare against `FLOOR_DEPTH` the way `descent.test.ts` does.
  - A weather trial that rolls and recovers ends with no `touched-bottom` event, at the same `time` as before this change.
  - The README outcome table is still enforced by `seaTrial.test.ts`: outcomes are unchanged.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns="sim"`. Expected: FAIL.
- [ ] **Step 3: Implement.** She capsized to about 170°. `stepBody` eases roll toward `±REST_ROLL`, so she rolls back toward upright as she falls. That's acceptable: the spec allows "rolls partway back". Don't add a new resting angle.
- [ ] **Step 4: Run** `npm test`, `npm run type-check` and `npm run lint`. Expected: all pass.
- [ ] **Step 5: Do a cheap real-app check** (at most one screenshot, in the scratchpad directory the controller gives you). Run a stormy trial on a top-heavy ship and confirm the camera follows her down. If this gets fiddly, skip it and say so.
- [ ] **Step 6: Commit** `feat(ship-builder): capsized ships go to the sea floor too`

---

### Task 3: Rust on the sea floor, and release (Sonnet, parallel worktree)

**Files:**

- Create: `components/ship-builder/scene/rust.ts`
- Create: `components/ship-builder/scene/RustDriver.tsx`
- Create: `components/ship-builder/scene/__tests__/rust.test.ts`
- Modify: `components/ship-builder/scene/Surface.tsx`. `createMaterial` passes the new material through `withRust`.
- Modify: `components/ship-builder/scene/Hull.tsx` and `HullDetails.tsx` (any `MeshStandardMaterial` or `meshStandardMaterial` the ship's own body uses, but not the ocean, sea floor, sky or particles). Apply `withRust` to each. For JSX materials, use a `ref` or `onUpdate`.
- Modify: `components/ship-builder/scene/Scene.tsx`. Mount `<RustDriver />` once.
- Modify: `lib/ship-builder/version.ts` (`"2.19.0"`) and the top of `lib/ship-builder/changelog.ts`.

**Interfaces (produces):**

```ts
// rust.ts
/** 0 = clean, 1 = fully rusted. Shared by every patched material. */
export const RUST: { value: number };
export const RUST_IN_S = 4;
export const RUST_MAX_MIX = 0.8;
/** Patches a material once (idempotent) to mix toward rust by RUST.value. */
export function withRust<T extends MeshStandardMaterial>(material: T): T;
/** Rust amount for a trial state: 0 before the first touched-bottom, then a smoothstep to 1 over RUST_IN_S of sim time. */
export function rustAmount(state: SimState | null): number;
```

The shader patch: in `onBeforeCompile`, add `uniform float uRust;` bound to the `RUST` object itself, so all materials share one uniform. After `#include <color_fragment>`, mix `diffuseColor.rgb` toward a rust colour by `uRust * RUST_MAX_MIX * blotch`. Use two rust tones (about `#8b3a1a` and `#5a2a14`). `blotch` is a cheap value-noise of world position, so the rust is patchy, not flat. Pass world position from the vertex shader with a varying. Also raise `roughness` toward 1 by `uRust`. Set `material.customProgramCacheKey = () => "rust"` so patched and unpatched programs don't collide. When `uRust` is 0 the output must be identical to today's.

- [ ] **Step 1: Write failing tests** in `rust.test.ts` (pure functions only, no WebGL):
  - `rustAmount(null)` → 0.
  - A state with no `touched-bottom` event → 0.
  - A state with `touched-bottom` at time 10 and `time: 10` → 0. `time: 12` → strictly between 0 and 1. `time: 14` → 1. `time: 20` → 1.
  - Calling `withRust(m)` twice registers the patch once: `m.onBeforeCompile` is the same function after the second call.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=rust`. Expected: FAIL.
- [ ] **Step 3: Implement** `rust.ts`. Then add `RustDriver`, which in `useFrame` sets `RUST.value = rustAmount(<the live trial state>)`, reading it the way other scene components do (`scene/liveTrial.ts` / `useLiveTrialState`, or the non-hook getter used inside `useFrame` elsewhere). It sets `0` when there's no running or result trial. Wire it into `Surface`, the hull materials and `Scene`.
- [ ] **Step 4: Bump the version and add the changelog entry.** Date `2026-10-25`, title "All the way down". Highlights in plain words, for example:
  - "When your ship sinks, the camera now always follows her down to the sea floor — no button needed"
  - "Ships that tip over in a storm sink to the bottom too"
  - "Once she settles on the sand, rust slowly creeps over her, just like a real shipwreck"
- [ ] **Step 5: Run** `npm test`, `npm run type-check` and `npm run lint`. Expected: all pass. Do a cheap real-app check (at most one screenshot, in the scratchpad directory the controller gives you): sink a template with an iceberg, wait for her to settle, and confirm she's patchy rust with her colours faintly showing. If this gets fiddly, skip it and say so.
- [ ] **Step 6: Commit** in two commits: `feat(ship-builder): rust creeps over a ship on the sea floor`, then `chore(ship-builder): release 2.19.0 — all the way down`.
