# Trial Focus Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While a sea trial runs or shows its result, clear the screen so the sinking is visible on small screens (phones, iPad mini).

**Architecture:** One derived flag (`trial.status` is `running` or `result`) puts the builder in "focus mode". `ShipBuilder` hides the header, drawers and floating controls; the status pill and Below deck inset shrink to edge pieces; the big result card becomes a slim bottom bar plus an opt-in Details sheet. Spec: `docs/superpowers/specs/2026-10-05-trial-focus-mode-design.md`.

**Tech Stack:** Next.js 16 / React 19, Tailwind 4, Zustand store (`lib/ship-builder/state/store`), Jest + RTL, Playwright (visual baselines).

**Deliberate refinements of the spec (decided while planning):**

- The bar is always compact (two rows on phones, one row at `sm:`) instead of shrinking while scrubbing; the scrub flag is not reactive state.
- Back to building lives only in the bar, not duplicated in the Details sheet.
- Follow her down, Watch again and the sound toggle sit in the bar, since they are what you want mid-replay. Details holds the message, extra lines, tips, Try again and Try another spot.
- Escape keeps its current meaning (it ends the trial, `useKeyboardShortcuts`), so the sheet closes with its Close button only.

**Working notes:** Waves (non-iceberg) results also get the slim bar, just without the slider row. "Aiming" is not focus mode: the player still needs the chrome there. Before writing UI code, skim `node_modules/next/dist/docs/` only if you touch anything Next-specific (this plan does not). Run `npm test -- --testPathPattern=<Name>` for single files.

---

## File structure

- Modify `components/ship-builder/ShipBuilder.tsx` — compute `inFocus`, hide chrome.
- Modify `components/ship-builder/ui/Drawer.tsx` — `hidden` prop.
- Modify `components/ship-builder/ui/SeaTrialStatus.tsx` — top-edge compact strip.
- Modify `components/ship-builder/ui/BelowDeckInset.tsx` — corner thumbnail, tap to enlarge.
- Modify `components/ship-builder/ui/TrialScrubber.tsx` — `compact` prop.
- Modify `components/ship-builder/ui/SeaTrialResult.tsx` — slim bar.
- Create `components/ship-builder/ui/ResultDetails.tsx` — the sheet.
- Modify `lib/ship-builder/version.ts`, `lib/ship-builder/changelog.ts` — release.
- Tests under `components/ship-builder/**/__tests__/`; visual baselines in `e2e/ship-builder-visual.spec.ts-snapshots`.

---

### Task 1: Focus mode hides the chrome

**Goal:** Header, both drawers, view controls, undo/redo and help disappear while a trial runs or shows its result.

**Files:**

- Modify: `components/ship-builder/ShipBuilder.tsx`
- Modify: `components/ship-builder/ui/Drawer.tsx`
- Test: `components/ship-builder/__tests__/ShipBuilder.test.tsx`, `components/ship-builder/ui/__tests__/Drawer.test.tsx`

**Acceptance Criteria:**

- [ ] With trial `running` or `result`, the header, both drawers (and their toggles), view controls, undo/redo and help are not visible.
- [ ] In `idle` and `aiming` everything is visible as before.
- [ ] Drawers stay mounted (their inner state survives) and the collapsed-panel setting is untouched.

**Verify:** `npm test -- --testPathPattern="ShipBuilder|Drawer"` → pass

**Steps:**

- [ ] **Step 1: Failing tests.** In `Drawer.test.tsx` add a test rendering `<Drawer side="left" label="Parts" open={false} onOpenChange={() => {}} hidden>…</Drawer>` and assert `screen.queryByRole("button", { name: "Parts" })` and `screen.queryByRole("complementary", { name: "Parts" })` are both `null` (hidden elements are excluded from role queries). In `ShipBuilder.test.tsx` (follow its existing render/mocking setup) add:

```tsx
it("clears the chrome while a trial runs and brings it back after", () => {
  render(<ShipBuilder />);
  expect(screen.getByRole("group", { name: "Camera" })).toBeVisible();
  act(() => useShipBuilderStore.getState().startTrial("calm", 12));
  expect(screen.queryByRole("group", { name: "Camera" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Parts" })).toBeNull();
  expect(screen.queryByRole("banner")).toBeNull();
  act(() => useShipBuilderStore.getState().endTrial());
  expect(screen.getByRole("group", { name: "Camera" })).toBeVisible();
});
```

If `ShipBuilder.test.tsx` mocks WebGL so `webgl` is falsy, note that `webgl === false` ends the trial immediately (see the effect in `ShipBuilder.tsx`); mock `useWebGLSupport` to `true` for this test and mock `./scene/Scene` as the file already does.

- [ ] **Step 2: Run, confirm fail** (`hidden` prop unknown / controls still visible).

- [ ] **Step 3: Drawer.** Add `hidden?: boolean` to `DrawerProps` (doc: "Takes the drawer and its toggle out of the layout without unmounting it."). Destructure with default `false`. Put `hidden={hidden}` on the toggle `<button>` and on the `<aside>`. The HTML `hidden` attribute is forced to `display: none` by Tailwind preflight, which beats `lg:static`/`lg:visible` classes. Check by eye in step 6.

- [ ] **Step 4: ShipBuilder.** Add next to `isTrialActive`:

```tsx
// The sinking is the show: clear everything that is not part of it.
const inFocus = useShipBuilderStore(
  (s) => s.trial.status === "running" || s.trial.status === "result"
);
```

Wrap the header: `<div hidden={inFocus}><AppHeader /></div>` (a wrapper, not unmounting, so a half-typed ship name survives). Pass `hidden={inFocus}` to both `<Drawer>`s. Render `{!inFocus && <ViewControls />}`, `{!inFocus && <HelpButton />}`, `{!inFocus && <UndoRedo />}` (these hold only throwaway state). Leave `SeaTrialButton` as is (it already only shows when idle). The backdrop `drawer-backdrop` also needs `!inFocus &&`; also call `setOpenDrawer(null)` in an effect when `inFocus` becomes true:

```tsx
useEffect(() => {
  if (inFocus) setOpenDrawer(null);
}, [inFocus]);
```

- [ ] **Step 5: Run tests, fix.** `npm test -- --testPathPattern="ShipBuilder|Drawer|FloatingControls|ViewControls|AppHeader"`. Existing tests that render `ShipBuilder` during a trial may need adjusting; keep the behaviour, change only the assertions that expected chrome to stay.

- [ ] **Step 6: Commit.**

```bash
git add components/ship-builder
git commit -m "feat(ship-builder): clear the chrome while a trial plays"
```

---

### Task 2: Compact top strip and corner thumbnail

**Goal:** The status pill is a slim strip on the top edge at every size; Below deck is a small corner thumbnail you can tap to enlarge, shown during the result too.

**Files:**

- Modify: `components/ship-builder/ui/SeaTrialStatus.tsx`
- Modify: `components/ship-builder/ui/BelowDeckInset.tsx`
- Test: `components/ship-builder/ui/__tests__/IcebergTrialPanels.test.tsx`, `components/ship-builder/ui/__tests__/SeaTrialStatus.test.tsx`

**Acceptance Criteria:**

- [ ] The status strip sits at the top edge (`top-3`, no `top-[11.5rem]`) and its name text is hidden below `sm`.
- [ ] The inset is visible during `running` and `result` for iceberg trials, and never for Waves trials.
- [ ] Tapping the inset enlarges it, and it shrinks again after about four seconds or another tap.

**Verify:** `npm test -- --testPathPattern="IcebergTrialPanels|SeaTrialStatus"` → pass

**Steps:**

- [ ] **Step 1: Replace the "on phones" test** in `IcebergTrialPanels.test.tsx` (the one asserting `hidden`/`lg:top-36`) with:

```tsx
describe("BelowDeckInset thumbnail", () => {
  it("stays up through the result and enlarges when tapped", async () => {
    const user = userEvent.setup();
    render(<BelowDeckInset />);
    act(() => store().startTrial("calm", 12));
    act(() => store().finishTrial(stateAt(10)));
    const inset = screen.getByTestId("below-deck-inset");
    expect(inset).not.toHaveClass("hidden");
    expect(inset).toHaveAttribute("data-enlarged", "false");
    await user.click(screen.getByRole("button", { name: /Below deck/ }));
    expect(screen.getByTestId("below-deck-inset")).toHaveAttribute(
      "data-enlarged",
      "true"
    );
  });
});
```

(import `userEvent` if the file lacks it). Keep the "shows only during an iceberg trial" test. In `SeaTrialStatus.test.tsx` add an assertion that the status element has class `top-3` and not `top-[11.5rem]` if a convenient test exists; otherwise skip.

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: SeaTrialStatus.** Change the root class from `top-[11.5rem] … lg:top-3` to `top-[max(0.75rem,env(safe-area-inset-top))]` and drop `lg:top-3`. Change the name span class to always hide on small screens: `whitespace-nowrap max-sm:hidden` (remove the `canFollow` conditional). Keep everything else.

- [ ] **Step 4: BelowDeckInset.** Remove the `isResult` store read and its comment. Add state and timer, and make the section a tappable thumbnail:

```tsx
const [enlarged, setEnlarged] = useState(false);

// Shrink back after a moment so it never keeps covering the ship.
useEffect(() => {
  if (!enlarged) return;
  const timer = setTimeout(() => setEnlarged(false), 4000);
  return () => clearTimeout(timer);
}, [enlarged]);
```

Render (still `return null` when not iceberg; hooks stay above that early return):

```tsx
<section
  aria-label="Below deck"
  data-testid="below-deck-inset"
  data-enlarged={enlarged}
  className={`absolute left-3 top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] z-10 rounded-xl border p-1 shadow-lg transition-[width] ${
    enlarged ? "w-[min(24rem,calc(100%-1.5rem))]" : "w-[28%] min-w-28 max-w-56"
  } ${panelClass}`}
>
  <button
    type="button"
    aria-label={enlarged ? "Below deck, shrink" : "Below deck, enlarge"}
    aria-expanded={enlarged}
    onClick={() => setEnlarged((value) => !value)}
    className="block w-full touch-manipulation"
  >
    <BelowDeckDiagram
      hull={hull}
      water={water}
      opened={opened}
      className="h-auto w-full"
    />
  </button>
</section>
```

The visible "Below deck" heading goes (the section's `aria-label` and the button name carry it). `data-enlarged` renders as the string `"true"`/`"false"`. The test's first assertion `getByRole("region", { name: "Below deck" })` in "shows only during an iceberg trial" still works because of the `aria-label`.

- [ ] **Step 5: Run tests, fix; run `npm run type-check`.**

- [ ] **Step 6: Commit.**

```bash
git add components/ship-builder
git commit -m "feat(ship-builder): top-edge status strip and corner Below deck thumbnail"
```

---

### Task 3: Slim result bar and Details sheet

**Goal:** The result is a slim bottom bar; the full summary opens only on request.

**Files:**

- Modify: `components/ship-builder/ui/TrialScrubber.tsx`
- Modify: `components/ship-builder/ui/SeaTrialResult.tsx`
- Create: `components/ship-builder/ui/ResultDetails.tsx`
- Test: `components/ship-builder/ui/__tests__/SeaTrialResult.test.tsx`, `components/ship-builder/ui/__tests__/TrialScrubber.test.tsx`

**Acceptance Criteria:**

- [ ] After a trial the bar shows the outcome title, Back to building, and Details; iceberg results add the Look back slider, Watch again, sound and (when she sank) Follow her down.
- [ ] The summary message, extra lines, tips, Try again and Try another spot appear only after pressing Details, in a dialog with a Close button that returns focus to Details.
- [ ] No Below deck copy inside the result.
- [ ] `TrialScrubber compact` hides the mark legend and the visible "Look back" label (label stays for screen readers).

**Verify:** `npm test -- --testPathPattern="SeaTrialResult|TrialScrubber"` → pass

**Steps:**

- [ ] **Step 1: Rewrite tests** in `SeaTrialResult.test.tsx`:
  - "offers only Try again and Back to building after a Waves trial" becomes: the bar shows Back to building and Details; Try again and Try another spot are absent until Details is pressed; after pressing Details, Try again is visible and Try another spot is absent (Waves).
  - Replace the "read-only below-deck picture" test with: `expect(screen.queryByTestId("result-below-deck")).toBeNull()` for an iceberg result.
  - "Try again…" and "Try another spot…" tests: click `Details` first (`await user.click(screen.getByRole("button", { name: "Details" }))`).
  - "Back to building ends the trial" is unchanged.
  - Replay tests (Watch again, slider, Follow her down) are unchanged and must still pass, since those live in the bar.
  - Add:

```tsx
it("opens the summary from Details and Close hands focus back", async () => {
  const user = userEvent.setup();
  finishTrial(14);
  render(<SeaTrialResult />);
  expect(screen.queryByRole("dialog")).toBeNull();
  const details = screen.getByRole("button", { name: "Details" });
  await user.click(details);
  expect(screen.getByRole("dialog")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(details).toHaveFocus();
});
```

The `extraSummaryLines` tests are unchanged. In `TrialScrubber.test.tsx` add a test that with `compact` the mark legend `<ul>` is absent and `getByRole("slider", { name: "Look back" })` still resolves.

- [ ] **Step 2: Run, confirm fail.**

- [ ] **Step 3: TrialScrubber.** Add `compact?: boolean` to `TrialScrubberProps` (default `false`). The `<label>` gets `className={compact ? "sr-only" : "text-xs …existing…"}`. Render the legend `<ul>` only when `marks.length > 0 && !compact`. The outer `<div>` becomes `<div className={compact ? "min-w-0 flex-1" : undefined}>`.

- [ ] **Step 4: ResultDetails.tsx** (new file):

```tsx
"use client";

import { Crosshair, RotateCcw, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { TrialSummary } from "@/lib/ship-builder/sim/explain";
import {
  useShipBuilderStore,
  type TrialSlice,
} from "@/lib/ship-builder/state/store";
import { SEA_LABELS } from "./seaTrialText";
import { buttonClass, panelClass } from "./styles";

type ResultTrial = Extract<TrialSlice, { status: "result" }>;

interface ResultDetailsProps {
  input: ResultTrial["input"];
  summary: TrialSummary;
  extraLines: string[];
  onClose: () => void;
}

/** The full explanation, opened from the result bar and put away again. */
export default function ResultDetails({
  input,
  summary,
  extraLines,
  onClose,
}: ResultDetailsProps) {
  const startTrial = useShipBuilderStore((s) => s.startTrial);
  const aimIceberg = useShipBuilderStore((s) => s.aimIceberg);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sheet.current?.focus();
  }, []);

  return (
    <div
      ref={sheet}
      role="dialog"
      aria-labelledby="sea-trial-title"
      aria-describedby="sea-trial-message"
      tabIndex={-1}
      className={`absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl border p-4 shadow-xl outline-none sm:max-w-md ${panelClass}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Sea trial · {SEA_LABELS[input.sea]}
          </p>
          <h2 id="sea-trial-title" className="text-lg font-semibold">
            {summary.title}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <p
        id="sea-trial-message"
        className="mt-2 text-sm text-slate-700 dark:text-slate-300"
      >
        {summary.message}
      </p>
      {extraLines.length > 0 && (
        <ul
          data-testid="sea-trial-extra-lines"
          className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300"
        >
          {extraLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {summary.tips.length > 0 && (
        <div className="mt-3 rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Try this
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-800 dark:text-slate-200">
            {summary.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => startTrial(input.sea, input.iceberg?.impactX)}
          className={`${buttonClass} min-h-11 flex-1`}
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4 shrink-0" />
          Try again
        </button>
        {input.iceberg && (
          <button
            type="button"
            onClick={aimIceberg}
            className={`${buttonClass} min-h-11 flex-1`}
          >
            <Crosshair aria-hidden="true" className="h-4 w-4 shrink-0" />
            Try another spot
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: SeaTrialResult.tsx.** Keep `OUTCOME_LOOKS`, `SUMMARY_CORE_FIELDS`, `extraSummaryLines`, `SeaTrialResult` and the keyed `ResultCard` wrapper. Rewrite `ResultCard`'s body: remove the `BelowDeckDiagram`/`belowDeckWater`/`hull`/`startTrial`/`aimIceberg` uses and their imports (`Crosshair`, `RotateCcw`, `useMemo` for below-deck, `primaryButtonClass` stays, `buttonClass` stays). New body:

```tsx
const [detailsOpen, setDetailsOpen] = useState(false);
const detailsButton = useRef<HTMLButtonElement>(null);
// … endTrial, replay, descend, card ref, input/state, summary, extraLines,
// timeline, canFollow, look: unchanged …

function closeDetails() {
  setDetailsOpen(false);
  detailsButton.current?.focus();
}

return (
  <>
    <div
      ref={card}
      role="region"
      aria-label="Sea trial result"
      tabIndex={-1}
      className={`absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto flex flex-col gap-2 rounded-2xl border p-2 shadow-xl outline-none sm:max-w-2xl ${panelClass}`}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${look.badge}`}
        >
          <look.Icon className="h-5 w-5" />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {summary.title}
        </p>
        <button
          ref={detailsButton}
          type="button"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen(true)}
          className={`${buttonClass} min-h-11`}
        >
          Details
        </button>
        <button
          type="button"
          onClick={handleBackToBuilding}
          className={`${primaryButtonClass} min-h-11`}
        >
          Back to building
        </button>
      </div>
      {timeline && (
        <div className="flex items-center gap-2">
          <TrialScrubber timeline={timeline} compact />
          <button
            type="button"
            onClick={replay}
            className={`${buttonClass} min-h-11`}
          >
            <Repeat aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="max-sm:sr-only">Watch again</span>
          </button>
          <SoundToggle />
          {canFollow && (
            <button
              type="button"
              onClick={descend}
              className={`${buttonClass} min-h-11`}
            >
              <ArrowDownToLine
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
              <span className="max-sm:sr-only">{FOLLOW_HER_DOWN}</span>
            </button>
          )}
        </div>
      )}
    </div>
    {detailsOpen && (
      <ResultDetails
        input={input}
        summary={summary}
        extraLines={extraLines}
        onClose={closeDetails}
      />
    )}
  </>
);
```

Add `useState` to the react import and `import ResultDetails from "./ResultDetails";`. Delete the `sea-trial-title`/`message` ids from the bar (they live in the sheet now). The existing `useEffect(() => card.current?.focus(), [])` stays. On a narrow phone "Back to building" may crowd the title row; if it wraps awkwardly, let the title row `flex-wrap` — judge by looking at it in step 7.

- [ ] **Step 6: Run** `npm test -- --testPathPattern="SeaTrialResult|TrialScrubber|IcebergTrialPanels"` and `npm run type-check`; fix.

- [ ] **Step 7: Look at it.** `npm run dev`, open `/ship-builder`, run an iceberg trial at about 744×1133 (iPad mini portrait), 1133×744 (landscape) and 390×844. Confirm: chrome gone during the run, thumbnail in the corner, top strip fits, bar slim, Details opens and closes, the thumbnail follows the slider while scrubbing. Fix class tweaks as needed.

- [ ] **Step 8: Commit.**

```bash
git add components/ship-builder
git commit -m "feat(ship-builder): slim result bar with an optional Details sheet"
```

---

### Task 4: e2e, baselines and release

**Goal:** E2E and visual tests match the new flow, and the change ships as a release.

**Files:**

- Modify: `e2e/ship-builder-trial.spec.ts` (and any other spec that fails)
- Modify: `e2e/ship-builder-visual.spec.ts-snapshots/*` (regenerated)
- Modify: `lib/ship-builder/version.ts`, `lib/ship-builder/changelog.ts`

**Acceptance Criteria:**

- [ ] `npm run validate` passes.
- [ ] `npm run test:e2e` passes on all three browsers (see the `worktree-agent-setup` memory: webpack builds, skip local Firefox if it cannot run).
- [ ] Version `2.8.1` with a matching top changelog entry.

**Verify:** `npm run validate` → all green; `npm run test:e2e` → pass

**Steps:**

- [ ] **Step 1:** Run `npm run test:e2e -- e2e/ship-builder-trial.spec.ts e2e/ship-builder-iceberg.spec.ts e2e/ship-builder-breakup.spec.ts`. Update selectors that expected the old card: the summary text, Try again and Try another spot now need a click on `Details` first; `dialog` role now appears only after Details; the Below deck copy in the result is gone. Fix each failure by changing the test to the new flow, not by loosening assertions.
- [ ] **Step 2:** Regenerate visual baselines for the affected states only: `npx playwright test e2e/ship-builder-visual.spec.ts --update-snapshots`, then `git diff --stat e2e` and open the changed images to confirm they show the cleared screen and the slim bar (add a small-viewport iPad-mini case to the visual spec if none covers a mid-sinking frame).
- [ ] **Step 3: Release.** Set `SHIP_BUILDER_VERSION = "2.8.1"` and add this at the top of `CHANGELOG` (date from `date +%F`):

```ts
{
  version: "2.8.1",
  date: "2026-10-05",
  title: "A clear view of the sinking",
  highlights: [
    "When a sea trial starts, the menus and buttons tuck away so you can see the whole ship, even on a small tablet",
    "The Below deck picture is a small corner thumbnail now. Tap it to make it bigger for a moment",
    "After a trial, a slim bar at the bottom lets you scrub back through it and watch again without covering the ship",
    "Tap Details on that bar when you want to read what happened and get tips",
  ],
},
```

- [ ] **Step 4:** `npm run validate`.
- [ ] **Step 5: Commit.**

```bash
git add -A e2e lib/ship-builder components/ship-builder
git commit -m "chore(ship-builder): release 2.8.1, clear view of the sinking"
```
