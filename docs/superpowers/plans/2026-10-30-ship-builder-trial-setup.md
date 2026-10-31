# Ship Builder trial setup, Shipwreck storm, speed and lifeboats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-trial setup cards (sea, time, lifeboats, break), a new always-sinking Shipwreck storm trial in a wild sea, a 1x/2x/3x speed control, and a "Fill every seat" lifeboat mode.

**Architecture:** The sim gains a `storm` trial input that reuses the iceberg flooding pipeline with a storm water source, and a `wild` sea with extra, cross-directional wave components mirrored in the scene shader. Trial choices (sea, time, lifeboats, speed) live in a device-remembered setting plus the trial slice; the scene reads the trial's sea and time while a trial is open. Fill mode is a branch in `planEvacuation`.

**Tech Stack:** Next.js 16, React 19, TypeScript, zustand, react-three-fiber, Tailwind 4, Jest + RTL, Playwright, Firestore rules.

**Spec:** `docs/superpowers/specs/2026-10-30-ship-builder-trial-setup-design.md`

## Global Constraints

- Sim and crowd: pure TypeScript, deterministic, no `Math.random`, fixed `SIM_STEP_S`.
- Every choice segment shows an icon AND a word, `min-h-11`, light and dark mode, fits a 360px-wide viewport.
- Icons (lucide): Waves `Waves`, Shipwreck storm `Tornado`, Iceberg `Snowflake`; Calm `Sailboat`, Choppy `Wind`, Stormy `CloudLightning`; Day `Sun`, Sunset `Sunset`, Night `Moon`; Like the Titanic `Ship`, Fill every seat `Users`; 1x `Play`, 2x `FastForward`, 3x `ChevronsRight`, 5x `Rabbit`, 10x `Rocket`, 20x `Zap`.
- Storm: sinks every template and degenerate build; `sunk` between 60 and 120 sim s at 1x; no capsize before 30 s; a storm capsize still ends `sank` with evacuation.
- Lifeboat default: `fill`. Main-screen sea/time chips unchanged and never written by a trial.
- Analytics: only `kind: "storm"` and `sea: "wild"` added to `trial_run`; no new props.
- Tailwind only, `interface` for props, `export default function` components, Prettier style.
- Ship Builder minor release (version + changelog) in the last task.

## Review Focus

1. Switching sea in the Waves setup card then cancelling: scene must return to the main-screen sea and time (Task 5 test `cancel restores main look`).
2. A trial started from Drive (hard hit) or a challenge never shows a setup card and uses main time (Task 5 test `driveHit skips setup`).
3. Speed changed mid-trial must not change outcome or events (Task 3 test `same timeline at 1x and 3x`).
4. Fill mode on a ship with lifeboats but no stairs (Titanic template): every figure boards (Task 4 test `titanic fill boards everyone`).
5. Storm on a one-block ship with no lifeboats and no walls: still sinks inside the window, no crash in evacuation (Task 1 and Task 4 tests).

---

### Task 1: Sim: wild sea and the storm trial

**Files:**

- Modify: `lib/ship-builder/sim/types.ts` (SimSea, StormInput, TrialInput, TrialReason)
- Create: `lib/ship-builder/sim/trialKind.ts`
- Modify: `lib/ship-builder/sim/seaTrial.ts`, `lib/ship-builder/sim/flooding.ts`, `lib/ship-builder/sim/timeline.ts`, `lib/ship-builder/sim/explain.ts`, `lib/ship-builder/sim/funnelFall.ts` (if it keys off `iceberg`)
- Modify: `lib/ship-builder/sim/README.md`
- Test: `lib/ship-builder/sim/__tests__/storm.test.ts`, `lib/ship-builder/sim/__tests__/trialKind.test.ts`

**Interfaces:**

- Produces:
  - `SimSea = "calm" | "choppy" | "stormy" | "wild"`
  - `interface StormInput { compartments: CompartmentSpec[]; length: number; breakMode?: BreakMode }`
  - `TrialInput.storm?: StormInput` (never set together with `iceberg`)
  - `TrialInput.lifeboats?: LifeboatMode` where `type LifeboatMode = "titanic" | "fill"` (exported from `types.ts`; the sim ignores it; absent means `"titanic"`)
  - `TrialReason` adds `"storm"`
  - `trialKind.ts`: `type TrialKind = "waves" | "storm" | "iceberg"`; `trialKindOf(input: TrialInput): TrialKind`; `floodOf(input: TrialInput): { compartments: CompartmentSpec[]; length: number; breakMode: BreakMode } | null` (iceberg or storm; breakMode defaults `"real"`); `isTimelineTrial(input): boolean` (iceberg or storm)
  - Exported constants in `seaTrial.ts`: `STORM_NO_CAPSIZE_S = 30`; in `flooding.ts`: `STORM_INFLOW` and `STORM_START_S` (tuned)
  - `WILD_WAVES` component list exported from a new `lib/ship-builder/sim/seaWaves.ts` together with the existing three `WAVES` (moved there), so Task 2's scene can mirror them by test.

- [ ] **Step 1: Write failing tests** in `storm.test.ts`:
  - `it.each(templates)("storm sinks %s inside the window")`: build input via the same helper the iceberg tests use (find it in `lib/ship-builder/sim/__tests__/` or `lib/ship-builder/testing.ts`), set `storm` from `compartmentSpecsOf(ship.hull)`, `sea: "wild"`; `runTrial` → `outcome === "sank"`; `sunk` event `at` between 60 and 120.
  - `"storm sinks degenerate builds"`: one-block hull, no walls; all walls deck-high; minimal and maximal hull length → same assertions.
  - `"no capsize before 30 s"`: a dangerous, heavily listing SimShip → first `capsized` event (if any) `at >= 30`; outcome `sank`.
  - `"storm is deterministic"`: two `buildTimeline` runs deep-equal.
  - `"wild sea rolls harder than stormy"`: max |roll| over the first 20 s for a stable ship, wild > stormy.
  - `trialKind.test.ts`: `trialKindOf` for the three inputs; `floodOf` returns null for waves, the storm/iceberg specs otherwise; breakMode default `"real"`.
- [ ] **Step 2:** `npm test -- --testPathPatterns="sim/__tests__/(storm|trialKind)"` → FAIL.
- [ ] **Step 3: Implement.** Wild sea: a `SEAS.wild` entry steeper and faster than stormy (start from slope ~0.5, speed ~2.0) and `WILD_WAVES` of 5 to 6 components with incommensurate omegas and varied directions (the scene's `dirX/dirY` matter only to the shader; the sim uses weight, omega, phase). `wave()` uses `WILD_WAVES` when `sea === "wild"`. Storm: route every `input.iceberg` check in sim through `floodOf`/`isTimelineTrial`, keeping impact-specific bits (gash, `ICEBERG_IMPACT_S`, `openedBy`) iceberg-only. Storm water: from `STORM_START_S`, every compartment takes inflow from above proportional to `STORM_INFLOW` (deck wash, so walls slow but never stop it; tune so the window holds for all templates). In the storm, `sailing` never ends on the 9 s timeout, capsize is suppressed before `STORM_NO_CAPSIZE_S`, and a later capsize sets outcome `sank`, reason `"storm"`, and goes on to `sinking`/descent like an iceberg sinking. `reason` for a storm sinking is `"storm"`. `MAX_TRIAL_S` in `timeline.ts` must cover the storm. `explain.ts` gains kid copy for `"storm"`: "The storm was too strong. Waves filled her up until she sank."
- [ ] **Step 4:** run the two test files plus all of `lib/ship-builder/sim` → PASS (existing iceberg/waves tests untouched).
- [ ] **Step 5:** README: add "The storm trial" and "The wild sea" sections (constants, window, capsize rule).
- [ ] **Step 6: Commit** `feat(ship-builder): storm trial and wild sea in the sim`.

### Task 2: Scene: storm plays like an iceberg run, wild sea, trial look

**Files:**

- Modify: every non-test `components/ship-builder/**` and `lib/ship-builder/**` use of `input.iceberg` (store.ts, evacuation.ts aside — Task 4 owns evacuation): SeaTrialRunner, trialTimeline, SeaTrialStatus, SeaTrialResult, ResultDetails, BelowDeckInset, TrialSound, HullGash, Iceberg, ObstacleMesh, LaunchedBoats, useTimeOfDay
- Modify: `components/ship-builder/scene/seaState.ts`, `Ocean.tsx`, `bob.ts`, `environmentModel.ts`, `lightParts.tsx`, `ShipAnimation.tsx`, `Scene.tsx`, `IcebergAimLayer.tsx`, `audio/WorldSound.tsx`
- Modify: `components/ship-builder/hooks/useSeaState.ts`, `useTimeOfDay.ts`
- Test: `components/ship-builder/scene/__tests__/seaState.test.ts` (extend or create), `components/ship-builder/hooks/__tests__/trialLook.test.ts`

**Interfaces:**

- Consumes: Task 1 `trialKindOf`, `floodOf`, `isTimelineTrial`, `WILD_WAVES`, `SimSea`.
- Produces:
  - `scene/seaState.ts`: `type SceneSea = SeaState | "wild"`; `seaParams(sea: SceneSea)`; `SEA_STATES` stays the three chip values; the wave-component list the shader and `seaHeight` use includes the wild components (weights 0 unless wild, so other seas look identical).
  - Store trial slice field (added in this task, used by Task 5): every non-idle status except `aiming` carries `look: TrialLook` where `interface TrialLook { sea: SimSea; time: TimeOfDay }`; `aiming` carries `look` too. `beginTrial` fills `look` from options or from `getSeaState()`/`getTimeOfDay()`.
  - `useSeaState()` returns `seaState: SceneSea` = the trial's `look.sea` while trial status is not idle, else the stored main value; `setSeaState` unchanged. Same for `useTimeOfDay()` with `look.time`; the forced-night rule is deleted. Add `getTimeOfDay()` beside `getSeaState()`.
  - `TrialStatus`/result headings name the storm "Shipwreck storm".

- [ ] **Step 1: Failing tests:** `seaState.test.ts`: `seaParams("wild").amplitude > seaParams("stormy").amplitude`; the scene's wild components have the same weights/omegas/phases as `WILD_WAVES` (mirror check, like any existing calm/choppy/stormy mirror test); non-wild seas' wave height unchanged at sample points. `trialLook.test.ts` (renderHook with the store): idle → main values; running with `look: {sea:"choppy", time:"sunset"}` → those; iceberg running with `look.time: "day"` → `"day"` (no forced night).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** SeaTrialRunner picks the timeline driver (`IcebergDriver`, rename to `TimelineDriver`) when `isTimelineTrial(input)`; instant (reduced-motion) path likewise uses the timeline end. Iceberg mesh, gash, aim layer stay iceberg-only. Ocean shader: wave weights become a uniform array lerped like `uAmplitude` so switching sea animates; keep one mesh (no draw-call change).
- [ ] **Step 4:** `npm test -- --testPathPatterns="ship-builder"` and `npm run type-check` → PASS.
- [ ] **Step 5: Commit** `feat(ship-builder): play the storm trial and show the wild sea`.

### Task 3: Speed 1x / 2x / 3x

**Files:**

- Create: `components/ship-builder/hooks/useTrialSpeed.ts`, `components/ship-builder/ui/TrialSpeedSwitch.tsx`
- Modify: `components/ship-builder/scene/SeaTrialRunner.tsx`, `components/ship-builder/ui/SeaTrialStatus.tsx`, `SeaTrialResult.tsx` (or wherever replay status shows)
- Test: `components/ship-builder/ui/__tests__/TrialSpeedSwitch.test.tsx`, `components/ship-builder/scene/__tests__/trialPlayback.test.ts` (extend)

**Interfaces:**

- Produces: `type TrialSpeed = 1 | 2 | 3`; `useTrialSpeed(): { speed: TrialSpeed; setSpeed(next: TrialSpeed): void }`; `getTrialSpeed(): TrialSpeed` (for frame callbacks); stored with `createStoredSetting`, key `ship-builder:ui:trial-speed`, default 1. `<TrialSpeedSwitch />` (no props): `role="group"` `aria-label="Speed"`, three `aria-pressed` buttons labelled "1x", "2x", "3x" with the Global Constraints icons.

- [ ] **Step 1: Failing tests:** `"same timeline at 1x and 3x"`: drive `advanceTrial` for a waves input with 60 frames of 1/60 at speed 1 vs 20 frames at speed 3 → identical `state.time`, events and pose; same for `advanceTimelineClock` on a storm timeline. Switch test: renders three buttons with names "1x" "2x" "3x"; clicking "3x" sets `aria-pressed` and `getTrialSpeed() === 3`; arrow keys move between them.
- [ ] **Step 2:** run → FAIL (switch missing).
- [ ] **Step 3: Implement.** Runner multiplies `getTrialSpeed()` into the existing `testSpeed`/`speed` arguments each frame (read per frame so a mid-trial change applies at once). Show the switch in the running trial status and while a replay plays.
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5: Commit** `feat(ship-builder): fast-forward trials at 2x and 3x`.

### Task 4: Lifeboats: storm evacuation and Fill every seat

**Files:**

- Modify: `lib/ship-builder/crowd/evacuation.ts`, `lib/ship-builder/crowd/README.md`, `components/ship-builder/scene/trialTimeline.ts`, `LaunchedBoats.tsx`, `Crowd.tsx`/`crowdView.ts` if boat seating needs more slots
- Create: `lib/ship-builder/crowd/lifeboatCount.ts`
- Test: `lib/ship-builder/crowd/__tests__/evacuation.test.ts` (extend), `lib/ship-builder/crowd/__tests__/lifeboatCount.test.ts`

**Interfaces:**

- Consumes: Task 1 `floodOf`, `TrialInput.lifeboats`, `LifeboatMode`.
- Produces:
  - `lifeboatCount(ship: Ship, stats: ShipStats): { seats: number; people: number }` (real counts: seats of davit-hung lifeboats; people = passengers + crew berths from stats).
  - `planEvacuation` runs for any trial with `floodOf(input) !== null` that ends `sank`; doom for a storm is the first `flooding` event as for an iceberg. `input.lifeboats === "fill"` selects fill mode; absent/`"titanic"` is today's path, byte-for-byte unchanged.
  - `EvacuationPlan` gains `leftAboard: number` (figures assigned to no boat at doom) for Task 5's result line.

- [ ] **Step 1: Failing tests:**
  - `lifeboatCount` on the Titanic and a no-lifeboat template.
  - `"titanic fill boards everyone"`: Titanic template, iceberg sank, `lifeboats: "fill"`, seats >= people? If the Titanic template has fewer seats than people, use a template with enough seats (or add lifeboats to a copy) for this case and keep the Titanic for the shortfall case. Assert every figure's `fateAt(end)` is in a boat and `leftAboard === 0`.
  - `"fill leaves the shortfall aboard"`: seats < people → `leftAboard === crowdSize - round(crowdSize * seats / people)`.
  - `"every boat launches in both modes"`: every lifeboat id has a launch time `< end`.
  - `"storm gets an evacuation"`: storm sank → plan not null.
  - `"no lifeboats storm"`: one-block hull storm → plan with no boats, no throw.
  - Existing evacuation tests pass unchanged (titanic mode).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement fill mode:** saved figures = all if seats >= people else `round(figures * seats / people)`, nearest first; per-boat share by seats (largest remainder), no `BOAT_SHOWN_MAX` cap and no odd-hash halving; boats wait for all riders but still launch when water reaches the spot; routing uses the crowd graph plus jump links between decks (add them for fill mode only) and, for a figure still unreachable, a fade-out/fade-in transfer to its boat at doom + walk time estimate. Boat drawing packs extra riders (rows) so all show. Cache key in `trialTimeline.ts` includes `lifeboats`.
- [ ] **Step 4:** run crowd + scene tests → PASS.
- [ ] **Step 5:** README fill-mode section.
- [ ] **Step 6: Commit** `feat(ship-builder): fill every lifeboat seat and evacuate in the storm`.

### Task 5: Trial setup cards and the lifeboat result line

**Files:**

- Modify: `lib/ship-builder/state/store.ts` (setup status, actions), `lib/ship-builder/challenges/*` only to pass `look`
- Create: `components/ship-builder/hooks/useTrialChoices.ts`, `components/ship-builder/ui/TrialSetupCard.tsx`, `components/ship-builder/ui/ChoiceRow.tsx`, `components/ship-builder/ui/LifeboatSwitch.tsx`
- Modify: `SeaTrialButton.tsx` (three items), `IcebergAimHint.tsx` (time + lifeboat rows), `BreakModeSwitch.tsx` (reuse `ChoiceRow` if it fits), `ShipBuilder.tsx` (mount card), `hooks/useKeyboardShortcuts.ts` (Esc cancels setup), `SeaTrialResult.tsx`/`ResultDetails.tsx` (lifeboat line), `seaTrialText.ts` (copy)
- Test: `components/ship-builder/ui/__tests__/TrialSetupCard.test.tsx`, `SeaTrialButton.test.tsx` (extend), `lib/ship-builder/state/__tests__/` store test (extend), result card test (extend)

**Interfaces:**

- Consumes: Task 2 `TrialLook`, `getTimeOfDay`; Task 4 `lifeboatCount`, `EvacuationPlan.leftAboard`; Task 1 `LifeboatMode`.
- Produces:
  - `TrialSlice` adds `{ status: "setup"; kind: "waves" | "storm"; look: TrialLook }`.
  - Store actions: `openTrialSetup(kind: "waves" | "storm")` (look = remembered sea for waves / `"wild"` for storm, time = main time), `setTrialLook(patch: Partial<TrialLook>)` (setup or aiming only), `cancelTrialSetup()`, `startSetupTrial()` (waves → `beginTrial(look.sea)`, storm → storm input with `breakMode` and `lifeboats`), `aimIceberg()` now sets `look` too. `beginTrial` options gain `look?: TrialLook`, `storm?: boolean`, `lifeboats?: LifeboatMode`.
  - `useTrialChoices()`: remembered `waveSea: "calm"|"choppy"|"stormy"` (default main sea) and `lifeboats: LifeboatMode` (default `"fill"`), key `ship-builder:ui:trial-choices`.
  - `<ChoiceRow<T>>` props `{ label: string; options: { value: T; label: string; Icon: LucideIcon }[]; value: T; onChange(v: T): void }`.

- [ ] **Step 1: Failing tests:**
  - Menu: three menu items "Waves", "Shipwreck storm", "Iceberg".
  - Waves card: rows "Sea" (Calm/Choppy/Stormy) and "Time"; choosing Stormy calls `setTrialLook({sea:"stormy"})` and is remembered; Go starts a running waves trial with `input.sea === "stormy"` and `look.time` as picked.
  - Storm card: rows "Time", "Lifeboats", "How she breaks"; Go → running trial with `input.storm` set, `input.sea === "wild"`, `input.lifeboats` as picked.
  - Iceberg aim card shows "Time" and "Lifeboats" rows plus the break switch; striking keeps the chosen time.
  - `cancel restores main look`: open waves setup, pick Night/Stormy, Cancel → status idle, `useTimeOfDay()`/`useSeaState()` back to main, main stored settings unchanged.
  - Esc cancels setup; focus returns to the Sea trial button.
  - `driveHit skips setup`: `driveHit` → status running, `look.time` = main time, `input.lifeboats` = remembered choice.
  - Result line: sank storm in fill mode with enough seats → "Everyone fit in the lifeboats!"; shortfall → "Not enough lifeboats: K people were left on board." (K = people - seats, real counts); titanic mode → "Some boats left half-empty, like the Titanic."; always "Lifeboat seats: N. People aboard: M." with `toLocaleString` numbers; no line when she didn't sink.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement** to the Interfaces; card sits in the IcebergAimHint slot, keyboard as the menu (arrows inside a row, Tab between rows), Cancel X button and a big Go (`Play` icon, "Go!").
- [ ] **Step 4:** `npm test -- --testPathPatterns="ship-builder"`, `npm run type-check`, `npm run lint` → PASS.
- [ ] **Step 5: Commit** `feat(ship-builder): pick sea, time and lifeboats when you start a trial`.

### Task 6: Analytics enums (security boundary)

**Files:**

- Modify: `lib/analytics/gameEvents.ts`, `firestore.rules`, `firestore-tests/gameEvents.test.ts`, `components/admin/GamesView.tsx` (labels if it maps kinds/seas), `lib/ship-builder/analytics.ts`
- Test: rules test, `lib/analytics/__tests__/` sync tests

**Interfaces:**

- Consumes: Task 1 `trialKindOf`.
- Produces: `trackTrialRun(state: SimState, sea: SimSea, kind: "weather" | "storm" | "iceberg")` (store passes `trialKindOf(input)` mapped waves→weather).

- [ ] **Step 1:** extend tests: `trial_run` with `kind: "storm"` and `sea: "wild"` accepted; an unknown value (`kind: "tornado"`) rejected.
- [ ] **Step 2:** `npm test -- --testPathPatterns=analytics` → FAIL; `npm run test:rules` → FAIL (needs Java 21; if unavailable locally, say so and rely on CI).
- [ ] **Step 3:** add the enum values in schema and rules (mirror exactly), dashboard labels.
- [ ] **Step 4:** both test commands → PASS.
- [ ] **Step 5: Commit** `feat(analytics): record storm trials and the wild sea`.

### Task 7: Release, e2e smoke, full validation

**Files:**

- Modify: `lib/ship-builder/version.ts`, `lib/ship-builder/changelog.ts`
- Create/Modify: `e2e/ship-builder-trial-setup.spec.ts` (or extend the existing sea trial spec)

- [ ] **Step 1:** e2e `@smoke` test: open Sea trial → Shipwreck storm → card shows Time/Lifeboats rows → Go → "Speed" group visible → pick 3x. Use the existing test hooks (`lib/ship-builder/testHooks.ts`) to jump time if needed.
- [ ] **Step 2:** bump minor version, changelog entry in kid-and-parent words (new storm trial, pick sea and time when you start, fast-forward, fill every lifeboat seat, iceberg not stuck at night).
- [ ] **Step 3:** `npm run validate` and `npx playwright test e2e/ship-builder-trial-setup.spec.ts e2e/perf.spec.ts --project=chromium` → PASS.
- [ ] **Step 4: Commit** `Ship Builder <version>: Shipwreck storm, trial setup, fast-forward, full lifeboats`.
