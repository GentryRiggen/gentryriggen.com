# Trial focus mode

## Problem

On small screens (phones, iPad mini) the sinking is hard to watch. During an
iceberg trial the header, drawer toggles, view controls, status pill and a
full-width Below deck diagram all sit on the 3D view. When the trial ends, the
result card covers most of what is left, so Look back and Watch again show
nothing. An iPad mini in landscape (~1133px) is `lg`, so both side panels are
docked (~288px each) and take about half the width.

## Design

One switch, applied at every screen size: while a trial is `running` or showing
its `result`, the builder is in **focus mode**. The saved collapsed-panel
preference is not touched, so building returns as the user left it.

### While the trial runs or replays

- Both drawers slide away fully and the scene takes the full width.
- Hidden: app header, drawer toggles, view controls, undo/redo, help, Sea trial
  button and the iceberg aim hint.
- The status pill becomes one compact strip pinned to the top edge: story
  clock, Stop, Follow her down, sound. The trial name text drops on narrow
  screens.
- The Below deck diagram becomes a small corner thumbnail at the screen edge
  (about 28% of the width, height capped), clear of the middle of the view.
  Tapping it enlarges it briefly.

### After the trial (result)

- The big card is replaced by a slim bottom bar: outcome icon and title, Look
  back slider, Watch again, a **Details** button and a small Back to building.
- Details opens the full summary (message, extra lines, tips, Try again, Try
  another spot, Back to building) as a dismissable sheet. Closed by default.
- The result card's own Below deck copy is removed; the corner thumbnail
  covers it.
- While scrubbing or replaying, the bar shrinks to the slider alone and the
  thumbnail follows the scrub position.

### Implementation shape

- `ShipBuilder.tsx`: hide drawers and chrome when `isTrialActive`.
- `SeaTrialResult.tsx`: split into `ResultBar` (always shown) and
  `ResultDetails` (sheet) reusing the existing content.
- `SeaTrialStatus.tsx`, `BelowDeckInset.tsx`: new position and size.
- Update existing tests, add tests for hidden chrome and the bar/sheet toggle,
  refresh visual baselines.
- Ship Builder release: bump `SHIP_BUILDER_VERSION` and add a changelog entry.

## Out of scope

Camera buttons during a trial (can be added later if wanted), changes to the
sim or camera work.
