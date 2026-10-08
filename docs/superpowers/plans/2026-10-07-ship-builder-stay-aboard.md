# Ship Builder: Stay Aboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A walker aboard the sinking ship stays aboard the whole time: they ride whichever half they stand on when she breaks, ride her down to the sea floor (the descent starts on its own), and keep walking the wreck until they press Stop, which then shows the result card.

**Architecture:** This is stage 2 of `docs/superpowers/specs/2026-10-06-ship-builder-walk-while-sinking-design.md`. The walk model stays pure. A new `halfWalkGrid` wraps a `WalkGrid` so that only one half's columns are walkable, which means the break line works like a rail. The scene mounts a `WalkEyes` in each broken half, and the one on the walker's half drives the camera. The store's `finishTrial` keeps the walk going and rolls a sunk iceberg trial straight into its descent. The result card waits until the walk stops.

**Tech Stack:** Next.js 16, React 19, @react-three/fiber, zustand, Jest + RTL, Playwright.

**Design decisions (approved in conversation, no spec file):**

- Break: you ride the half you stand on. A column belongs to the bow half when its centre `x + 0.5 < atX`, which is the same rule `partHalves` uses (`halfOfX`). You cannot walk or jump across the break.
- Going under: the walk never ends on its own. If she sinks with you aboard (iceberg trial, `sunk` event, not yet descending), the descent to the sea floor starts right away, with no result card in between.
- Finished: while walking, the result card stays hidden and the walk HUD shows a short outcome note. Stop shows the card.
- The Walk button still hides once she has broken or gone under. Boarding a wreck stays out of scope.
- Release 2.14.0.

---

### Task 1: Half walk grid (pure model)

**Goal:** `halfWalkGrid(grid, side, atX)` and `walkHalfOf(x, atX)` in the walk model.

**Files:**

- Create: `lib/ship-builder/walk/halfGrid.ts`
- Modify: `lib/ship-builder/walk/index.ts` (export it), `lib/ship-builder/walk/README.md` (one bullet)
- Test: `lib/ship-builder/walk/__tests__/halfGrid.test.ts`

**Acceptance Criteria:**

- [ ] `walkHalfOf(x, atX)` returns `"bow"` when `Math.floor(x) + 0.5 < atX`, else `"stern"`.
- [ ] On the wrapped grid, every column on the other half is not walkable, has no `floorLevel`, no `dropLevel`, no `obstructionAt` (so `entering` in `step.ts` treats it as closed, even when airborne), and `stepLevel` into it is `null`. Stair links touching the other half are dropped, and so are blocker circles whose centre is on the other half.
- [ ] Columns on the walker's half behave exactly like the original grid.
- [ ] A `stepWalker` test: a walker on the bow half walking toward the stern stops at the break, and a jump toward it doesn't carry them over.

**Verify:** `npm test -- --testPathPattern=walk/__tests__/halfGrid` → PASS

**Steps:**

- [ ] **Step 1: Write the failing tests.** Build a simple flat ship the way `walkGrid.test.ts` / `step.test.ts` do (reuse their helpers or fixtures), wrap with `halfWalkGrid(grid, "bow", 4)`, and assert the criteria above (for example `isWalkable(3, 1, 0)` true, `isWalkable(4, 1, 0)` false, `stepLevel(3, 1, 0, 4, 1)` null, `dropLevel(4, 1, 1)` null). For the step test, start at `{ x: 3.5, z: 1.5, yaw: Math.PI, level: 0, time: 0 }` (yaw PI faces the stern, so +x in the model) and run `stepWalker` with `forward: 1` for 120 steps, once with `jump: true` held. Assert `x < 4`.
- [ ] **Step 2: Run them and see them fail** (module not found).
- [ ] **Step 3: Implement.**

```ts
import type { WalkGrid } from "./types";

/** Which half of a broken ship a column rides with (see partHalves' halfOfX). */
export type WalkHalf = "bow" | "stern";

/**
 * The half the column under model `x` belongs to when she breaks `atX` cells
 * from the bow: a column goes by its centre, as a grid part does.
 */
export function walkHalfOf(x: number, atX: number): WalkHalf {
  return Math.floor(x) + 0.5 < atX ? "bow" : "stern";
}

/**
 * `grid` cut at the break: only `side`'s columns are left, so the torn edge is
 * a rail like the hull's, and a walker can neither walk nor jump across it.
 */
export function halfWalkGrid(
  grid: WalkGrid,
  side: WalkHalf,
  atX: number
): WalkGrid {
  const keeps = (x: number) => walkHalfOf(x, atX) === side;
  const blockers = grid.blockers.filter((b) => keeps(b.x));
  const stairs = grid.stairs.filter(
    (link) => keeps(link.from.x) && keeps(link.to.x)
  );
  return {
    length: grid.length,
    beam: grid.beam,
    blockers,
    stairs,
    blockersAt: (level) => grid.blockersAt(level).filter((b) => keeps(b.x)),
    floorLevel: (x, z) => (keeps(x) ? grid.floorLevel(x, z) : null),
    isWalkable: (x, z, level) => keeps(x) && grid.isWalkable(x, z, level),
    obstructionAt: (x, z, level) =>
      keeps(x) ? grid.obstructionAt(x, z, level) : null,
    dropLevel: (x, z, level) => (keeps(x) ? grid.dropLevel(x, z, level) : null),
    surfaceHeight: (x, z, level) => grid.surfaceHeight(x, z, level),
    isBlocked: (x, z, level) => !keeps(x) || grid.isBlocked(x, z, level),
    stepLevel: (fromX, fromZ, fromLevel, toX, toZ) =>
      keeps(toX) ? grid.stepLevel(fromX, fromZ, fromLevel, toX, toZ) : null,
  };
}
```

`blockersAt` filters on every call. If profiling shows it matters, precompute a `Map` per level. Not needed for v1.

- [ ] **Step 4: Run the tests and see them pass.** Also run `npm test -- --testPathPattern=lib/ship-builder/walk`.
- [ ] **Step 5: Commit** `feat(ship-builder): a walk grid for one half of a broken ship`

---

### Task 2: Ride the half in the scene

**Goal:** The walk keeps going through the break and the descent. After the break the walker is confined to their half, and the camera rides that half.

**Files:**

- Modify: `components/ship-builder/scene/WalkRunner.tsx`, `components/ship-builder/scene/WalkEyes.tsx`, `components/ship-builder/scene/BrokenShip.tsx`, `components/ship-builder/scene/walkOver.ts` (+ its test), `components/ship-builder/ui/TrialWalkButton.tsx`

**Acceptance Criteria:**

- [ ] `WalkRunner` no longer calls `stopWalk` when she breaks or goes under. The `isWalkOver` import and the early return go away.
- [ ] Once `trialPlayback.breakup` is set, `WalkRunner` steps the walker on `halfWalkGrid(walkGridOf(ship), walkHalfOf(walker.x, breakup.atX), breakup.atX)`. The side is picked once, at the first frame that sees the breakup, and kept in a ref for the rest of that walk. It's cleared if `breakup` goes back to null (a new run).
- [ ] `WalkEyes` takes an optional `half?: "bow" | "stern"` prop. With no `half` (the one in `BobGroup`), it drives the camera only while `trialPlayback.breakup` is null. With a `half`, it drives the camera only while broken and `walkHalfOf(walker.x, breakup.atX) === half`. Otherwise it returns early and leaves the camera alone.
- [ ] `HalfGroup` in `BrokenShip.tsx` renders `<WalkEyes half={side} />` inside its inner group, which is the half's pose. Its `useFrame(place)` becomes `useFrame(place, -1)` so the half is placed before the child `WalkEyes` reads its matrix, the same reason `BobGroup` uses -1 (see the comment there). The inner group already carries the ship-frame coordinates `walkCamera` returns, because the half's children are drawn in the whole ship's frame.
- [ ] Rename `isWalkOver` to `isPastBoarding`, and its file to `pastBoarding.ts`, with the test moved too. Rewrite the doc comment: it now only says the Walk button hides once she has broken or gone under, because there is no climbing aboard a wreck. `TrialWalkButton` uses the new name.

**Verify:** `npm test -- --testPathPattern="scene|TrialWalkButton"` → PASS; `npm run type-check` → clean.

**Steps:**

- [ ] **Step 1:** Rename `walkOver.ts` to `pastBoarding.ts` (`git mv`, both the file and its test), rename the function, update the comment and `TrialWalkButton`. Run its tests.
- [ ] **Step 2:** `WalkRunner`:

```ts
const halfGrid = useRef<{ atX: number; grid: WalkGrid } | null>(null);
// in useFrame, before stepping:
const { breakup } = trialPlayback;
if (!breakup) halfGrid.current = null;
else if (halfGrid.current?.atX !== breakup.atX) {
  // She has broken: the walker rides the half under their feet, for good.
  halfGrid.current = {
    atX: breakup.atX,
    grid: halfWalkGrid(grid, walkHalfOf(current.x, breakup.atX), breakup.atX),
  };
}
const stepGrid = halfGrid.current?.grid ?? grid;
```

Then `stepWalker(next, walkInput, stepGrid)`. Remove the `stopWalk` selector if nothing else uses it.

- [ ] **Step 3:** `WalkEyes`: add `interface WalkEyesProps { half?: WalkHalf }` and the drive check right after the existing early return:

```ts
const { breakup } = trialPlayback;
const ridden = breakup ? walkHalfOf(walk.x, breakup.atX) : undefined;
if (ridden !== half) return;
```

(With no `half` that is `undefined === undefined` while whole.) Update the doc comment to say a broken ship has one per half.

- [ ] **Step 4:** `BrokenShip.tsx`: import `WalkEyes`, render `<WalkEyes half={side} />` after `<TornEdge … />` inside the inner `group`, and change `useFrame(place)` to `useFrame(place, -1)` with a one-line comment.
- [ ] **Step 5:** Run `npm test -- --testPathPattern=components/ship-builder` and `npm run type-check`. Fix anything that breaks.
- [ ] **Step 6: Commit** `feat(ship-builder): ride your half when she breaks in two`

---

### Task 3: Store: the walk outlives the trial

**Goal:** `finishTrial` never ends a walk. If she sank with a walker aboard and the trial isn't descending yet, it goes straight into the descent.

**Files:**

- Modify: `lib/ship-builder/state/store.ts` (`finishTrial`, around line 739)
- Test: `lib/ship-builder/state/__tests__/walk.test.ts`

**Acceptance Criteria:**

- [ ] While walking, `finishTrial(state)` on a running iceberg trial with `!descending` whose `state.events` include `sunk` sets `trial` to `{ status: "running", input, runId: <new>, descending: true, from: "end" }` and leaves `walk` as is. There's no intermediate `result` state (one `set`).
- [ ] While walking, any other finish (survived, capsized, a waves trial, or the end of a descent) sets `result` as today and leaves `walk` walking.
- [ ] Not walking: behaviour unchanged (result; `descend()` still available).
- [ ] The existing test that expects `finishTrial` to stop the walk is updated to the new behaviour.

**Verify:** `npm test -- --testPathPattern=lib/ship-builder/state` → PASS

**Steps:**

- [ ] **Step 1: Write the failing tests** in `walk.test.ts`, following the existing walk + `sinkWhileWalking` tests there. Use `runTrial(input)` (see `store.breakup.test.ts` / `store.trial.test.ts`) to get a finished sunk state for a ship that sinks, as those files do. Three cases: sank → descending running and still walking; finish of the descending run → result and still walking; then `stopWalk()` → walk idle and trial still `result`.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement:**

```ts
finishTrial(state) {
  const { trial, walk } = get();
  if (trial.status !== "running") return;
  // A walker aboard rides her all the way: a sinking goes on down to the
  // sea floor, and the result waits until they stop walking.
  const ridesDown =
    walk.status === "walking" &&
    trial.input.iceberg !== undefined &&
    !trial.descending &&
    state.events.some((event) => event.kind === "sunk");
  if (ridesDown) {
    runId += 1;
    set({
      trial: {
        status: "running",
        input: trial.input,
        runId,
        descending: true,
        from: "end",
      },
    });
    return;
  }
  set({
    trial: {
      status: "result",
      input: trial.input,
      state,
      runId: trial.runId,
      descending: trial.descending,
    },
  });
},
```

Update the `descend` / `TrialSlice` doc comments to mention it.

- [ ] **Step 4: Run** `npm test -- --testPathPattern=lib/ship-builder/state` → PASS.
- [ ] **Step 5: Commit** `feat(ship-builder): a walker rides her down to the sea floor`

---

### Task 4: UI: result waits for Stop, outcome note in the HUD

**Goal:** While walking, the result card is hidden and the HUD says how she did.

**Files:**

- Modify: `components/ship-builder/ui/SeaTrialResult.tsx`, `components/ship-builder/ui/WalkHud.tsx`
- Test: `components/ship-builder/ui/__tests__/SeaTrialResult.test.tsx`, `components/ship-builder/ui/__tests__/WalkHud.test.tsx`

**Acceptance Criteria:**

- [ ] `SeaTrialResult` renders nothing while `walk.status === "walking"`, and renders the card once the walk stops.
- [ ] `WalkHud` shows a `role="status"` pill while `trial.status === "result"`. Text by `trial.state.outcome`: `"sank"` → "She sank. Explore the wreck, or tap Stop walking to see how she did"; `"capsized"` → "She rolled over. Tap Stop walking to see how she did"; anything else → "She made it! Tap Stop walking to see how she did". Use the `TrialOutcome` union from `lib/ship-builder/sim/types.ts` and check its members before writing the mapping. Style it like `WalkHint` but kept visible, with light and dark variants, placed under the top buttons (it must not cover the joystick).
- [ ] Stop walking then shows the result card. `focusWalkButton()` is a no-op when there is no Walk button, so check that it doesn't throw.

**Verify:** `npm test -- --testPathPattern="SeaTrialResult|WalkHud"` → PASS

**Steps:**

- [ ] **Step 1: Write the failing tests:** card hidden while walking at result, then visible after `stopWalk()`; note text for sank and for a steady result.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.** In `SeaTrialResult` add `const isWalking = useShipBuilderStore((s) => s.walk.status === "walking");` and return `null` while walking (before the card). In `WalkHud` add `function OutcomeNote()` reading `s.trial.status === "result" ? s.trial.state.outcome : null`, and render it in `WalkingControls`.
- [ ] **Step 4: Run the tests.** PASS.
- [ ] **Step 5: Commit** `feat(ship-builder): the result waits until you stop walking`

---

### Task 5: E2E, docs, release 2.14.0

**Goal:** The browser test covers the whole ride, and the release is recorded.

**Files:**

- Modify: `e2e/ship-builder-walk-sinking.spec.ts`, `lib/ship-builder/version.ts`, `lib/ship-builder/changelog.ts`, `lib/ship-builder/walk/README.md`, `components/ship-builder/ui/HelpButton.tsx` (walking help line, if it mentions the walk ending), `docs/superpowers/specs/2026-10-06-ship-builder-walk-while-sinking-design.md` (one line under Stage 2: "Shipped in 2.14.0, with the walk continuing to the sea floor; see plan 2026-10-07-ship-builder-stay-aboard.")

**Acceptance Criteria:**

- [ ] The first e2e test (break mode `never`) now expects: after Hit with an iceberg, still walking when the trial reaches `result` with `descending: true` (poll the store); the "She sank" HUD note visible; the result region hidden; press "Stop walking", then the result region is visible and walk is `idle`.
- [ ] A new `{ tag: "@smoke" }` test sets break mode to `always` (check `setBreakMode`'s accepted values in the store), walks, hits, and polls until the trial is `result` while `walk` is still `walking` and `window.__shipBuilderWalk` (the existing hook) reports a position. Then Stop shows the result.
- [ ] `SHIP_BUILDER_VERSION = "2.14.0"`. The top changelog entry is dated 2026-10-07, titled "Stay aboard to the end", with plain-words highlights: ride your half when she breaks; ride her all the way to the sea floor and walk the wreck; tap Stop walking to see how she did. The 2.13.0 entry is left as is.
- [ ] The README's walk paragraph mentions `halfWalkGrid`, and that a walk outlives the trial.

**Verify:** `npx playwright test e2e/ship-builder-walk-sinking.spec.ts --project=chromium` → PASS; `npm test -- --testPathPattern=changelog` → PASS

**Steps:**

- [ ] Update the spec, version, changelog and docs as above.
- [ ] Run the e2e test (chromium) and the changelog test.
- [ ] **Commit** `chore(ship-builder): release 2.14.0, stay aboard to the end`

---

## Execution notes

- Tasks 1 and 3 are independent. Task 2 needs Task 1. Task 4 needs Task 3. Task 5 needs everything.
- Run Tasks 1→2 and 3→4 as two parallel implementers, then Task 5 on the merged branch, then `npm run validate` once.
- Manual check (`npm run dev`, Titanic, Walk, Hit with an iceberg): the view stays on the deck through the break and under the water, and nothing flashes when the descent picks up.

---

### Task 6: Choose where to start walking (added 2026-10-07)

**Goal:** Tapping Walk opens a small pop-up card asking "Where do you want to start?" with three big picture buttons, Front (bow), Middle and Back (stern). Each shows a side-view ship with a glowing marker where you'll start. Picking one starts the walk there.

**Files:**

- Modify: `lib/ship-builder/walk/spawn.ts`, `lib/ship-builder/walk/types.ts` (or spawn.ts) for `WalkStart`, `lib/ship-builder/state/store.ts` (`startWalk(start?)`), `components/ship-builder/ui/WalkButton.tsx`
- Create: `components/ship-builder/ui/WalkStartPicker.tsx` (card + `WalkStartPicture` SVG)
- Tests: `lib/ship-builder/walk/__tests__/spawn.test.ts`, `lib/ship-builder/state/__tests__/walk.test.ts`, `components/ship-builder/ui/__tests__/WalkButton.test.tsx` (+ a picker test), `e2e/ship-builder-walk.spec.ts`, `e2e/ship-builder-walk-sinking.spec.ts`
- Docs: `lib/ship-builder/changelog.ts` (one more highlight in the unreleased 2.15.0 entry), `components/ship-builder/ui/HelpButton.tsx` walking line, walk `README.md`

**Acceptance Criteria:**

- [ ] `export type WalkStart = "bow" | "middle" | "stern"`. `spawnOf(ship, grid?, start = "middle")`: `middle` is exactly today's behaviour (nearest the bridge, else mid-ship). `bow` targets `{ x: 0, z: beam / 2 }`, and `stern` targets `{ x: grid.length, z: beam / 2 }`. The same rules apply as today: lowest level, useful regions, clear of blockers. Heading: a bow start tries facing aft (yaw PI) first; middle and stern keep the bow-first order. The existing spawn tests still pass, and new ones show bow spawns land near x=0 facing aft and stern spawns near the far end.
- [ ] `startWalk(start?: WalkStart)` passes it to `spawnOf`. The default is `"middle"`, so existing callers and tests keep working.
- [ ] `WalkButton`: when walking is possible, tapping it toggles the card (`aria-expanded`, `aria-controls`) instead of starting right away. The disabled "Add a deck to walk on" behaviour is unchanged. The card is `role="dialog"` with `aria-label="Where do you want to start?"` and a visible heading. It holds three `<button>`s with accessible names "Front (bow)", "Middle" and "Back (stern)". Picking one calls `startWalk(start)` and closes the card. Esc closes it and returns focus to Walk, and it must not reach the global Escape handler in `useKeyboardShortcuts` (stop propagation, or check what that handler does while idle). A pointerdown outside closes it. Focus goes to the Middle option on open. Works for the in-trial Walk button (`TrialWalkButton` renders `WalkButton`). The card opens upward from the button and is positioned so it stays on screen at 375px width (the Walk button is at the bottom; it sits right of Sea trial normally and bottom-centre in a trial).
- [ ] `WalkStartPicture`: an inline SVG, about 96x40, `aria-hidden`. It shows a simple side-view ship with the bow pointing RIGHT (pointed bow, square stern, a small superstructure and funnel mid-ship, a water line), and a glowing marker (a filled circle with a soft ring) at the start spot: near the right tip for bow, mid-ship for middle, near the left end for stern. Colours come from Tailwind classes (`fill-slate-700 dark:fill-slate-300`, marker `fill-amber-500`), with light and dark variants and no inline styles. Each option button shows the picture above its two-line label (big word "Front", "Middle" or "Back", and small "bow", "bridge" or "stern"). Hit targets are at least 44px, using the existing `panelClass` styles for the card.
- [ ] `prefers-reduced-motion`: no animation on the card. Otherwise a quick fade/scale-in is fine, using the existing keyframes in `app/globals.css` if one fits.
- [ ] E2E: every `getByRole("button", { name: "Walk", exact: true }).click()` is followed by choosing a start (a small helper `startWalking(page, "Middle")` in each spec). Add one test to `ship-builder-walk.spec.ts`: choosing Front puts the walker (via `window.__shipBuilderWalk`) in the front quarter (`x < length / 4`), and Back puts them in the back quarter.
- [ ] Changelog 2.15.0 gets a highlight: "When you tap Walk you can now pick where to start: at the front, in the middle or at the back of your ship". The help text's walking line mentions it.

**Verify:** `npm test -- --testPathPatterns="walk|Walk"`, `npm run type-check`, `npm run lint`, `npx playwright test e2e/ship-builder-walk.spec.ts e2e/ship-builder-walk-sinking.spec.ts --project=chromium`

Commit as `feat(ship-builder): choose where to start walking`.
