# Ship Builder v2.6 — Iceberg! (sinking Level 2)

**Date:** 2026-10-04
**Status:** Approved

Level 2 of the sinking roadmap (Level 1 is the v2.5 sea trial, Level 3 is
rescue actions; see `lib/ship-builder/sim/README.md`). The kid adds
watertight bulkheads below deck, aims an iceberg at the hull, and watches the
water fill compartments, spill over walls that are too low, and either stay
contained or sink her bow-first. Tone stays gentle: no people shown, no
peril words beyond "sank".

## Data

- `Hull.bulkheads?: Bulkhead[]`, `Bulkhead = { at: number; height:
BulkheadHeight }`, `BulkheadHeight = "low" | "waterline" | "deck"`.
- `at` is a segment boundary, `1 <= at <= lengthSegments - 1` (the wall sits
  at cell `x = at * CELLS_PER_SEGMENT`). At most one bulkhead per boundary.
  The list is kept sorted by `at`.
- Optional field: no ship version bump. The schema accepts it; on load,
  out-of-range or duplicate entries are dropped (like 2.4.1's leftover
  parts), and an empty list is removed.
- Shortening the hull drops walls past the new end. Share links carry them.
- Bulkheads have no mass and don't change stability stats. Stats panel gets
  a "Watertight compartments" row (`bulkheads.length + 1`). The ready-to-sail
  checklist is unchanged.

## Bulkhead editor

- A "Below deck" section in the Hull panel: an SVG cut-away of the hull from
  the side (bow on the right, matching the side view), main deck line on top, waterline dashed, a slot at
  each segment boundary.
- Tapping a slot cycles none → low → waterline → deck → none. Each slot is a
  button with an accessible label ("Wall 3: up to the waterline. Tap to
  make it taller."). One undoable store action per tap.
- Disabled while a trial runs (like every other edit).

## Iceberg trial

- The Sea trial button opens a small menu: "Waves" (today's trial) and
  "Iceberg".
- Iceberg: the camera switches to the side view and a hint says "Tap where
  the iceberg hits". The kid taps the hull; Esc or a Cancel button backs
  out. The tap's x (cells from the bow) is the middle of a gash
  `GASH_LENGTH` cells long (6 cells, about 2 segments), clamped inside the
  hull. Every compartment the gash overlaps is opened.
- She sails in the current sea; a simple low-poly iceberg slides past the
  struck side and a dark gash mark shows on the hull. Wave roll runs as in
  Level 1 (flooding does not change roll in this release).
- A "Below deck" inset (the same cut-away, read-only) shows the water level
  per compartment live, plus a story-time clock.

## Sim

- `TrialInput.iceberg?: { compartments: CompartmentSpec[]; impactX: number
}`. `CompartmentSpec = { id, fromX, toX, bowWall, sternWall }` with wall
  heights as a fraction of hull depth (hull ends = 1, sealed). Heights:
  low 0.45, waterline 0.75, deck 1. Built by `compartmentSpecsOf(hull)`.
- `Compartment` (in `SimState.compartments`) gains `opened: boolean`.
  `water` is 0..1 of hull depth.
- `stepFlooding` runs before the phase step: opened compartments fill at a
  fixed rate; bow-down trim lowers the effective height of each wall
  (more toward the bow); water above a wall's effective top spills into the
  neighbour. Total water sets `pose.sink`, the water's moment about midship
  sets `pose.pitch` (bow down is negative).
- Flooded volume past the reserve buoyancy fraction → `sinking` (bow-first
  plunge, no capsize first), outcome `sank`. Inflow stops (opened
  compartments full, nothing spilling) below that → `done`, outcome
  `afloat`. A wave capsize can still happen first (outcome `capsized`).
- New outcomes `afloat`, `sank`; reasons `held`, `spilled`, `no-bulkheads`,
  `too-many-opened`; events `flooding`, `spilled`, `sunk`.
- Story time: `storyMinutes(simSeconds)`, a fixed scale tuned so the Titanic
  template struck at the starboard bow sinks in about 2 h 40 min.

## Result card

- Afloat: "She stayed afloat! The walls kept the water in 2 compartments."
- Sank: "She stayed afloat for 1 hour 50 minutes. Water spilled over the low
  walls near the bow. Try making them taller." / "...had no walls below deck,
  so the water filled her. Add some in Below deck." / "...the iceberg opened
  5 compartments. Add more walls so each one is smaller."
- Buttons: Try again (same spot), Try another spot, Back to building.

## Templates

- Titanic and Olympic: 15 bulkheads; the forward ones only to the
  waterline, so the historical bow hit sinks them.
- Britannic: walls raised to the deck (her post-Titanic refit).
- Other templates: sensible defaults (a wall every 2–3 segments, deck high).

## Tests

- Sim: no walls → sank; deck-high walls with 2 opened → afloat; Titanic bow
  hit → sank at 2 h 40 min ± 10 min story time; determinism; mirrored
  impact behaves the same.
- Persist: schema, sanitising, fixtures, share round-trip.
- Editor component tests; store action + undo.
- E2E: build, add walls, iceberg flow to both endings. Visual baseline of a
  bow-down sink.

## Release

2.6.0 "Iceberg!" with a changelog entry.
