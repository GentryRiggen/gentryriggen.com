# Ship Builder v1.3 — Design

**Date:** 2026-10-04
**Status:** Approved

## Hull ends

- `Hull` gains `bow: BowShape` and `stern: SternShape`.
  - Bows: `straight` (default, Titanic), `clipper`, `bulbous`, `icebreaker`.
  - Sterns: `counter` (default, Titanic), `cruiser`, `transom`, `canoe`.
- Save format v4: `MIGRATIONS[3]` adds `bow: "straight", stern: "counter"`.
- Store actions `setBow` / `setStern`, undoable.
- Each shape has a model-level length (`bowLength(bow)`, `sternLength(stern)`)
  replacing the `PROW_LENGTH` / `STERN_LENGTH` constants wherever geometry,
  attach points or camera bounds depend on them. Clipper is longest.
- Speed modifiers (knots, added before clamping, only when the ship can move):
  bulbous +1, cruiser +0.5, icebreaker −1.5. Others are cosmetic.
- UI: a "Hull" group at the top of the Parts panel with picture tiles for each
  bow and stern (selected state shown), each with an SVG icon.

## Rudder

- Part `rudder` (category propulsion): "Rudder", "Under the stern · steers
  the ship". One hull point `rudder` on the centreline, aft of the propellers,
  below the waterline.
- Warning `no-rudder`: "No rudder — she can't steer", shown when the ship has
  propellers and no rudder.

## Fidelity

- Hull: a row of portholes along both sides, railings along open main-deck
  edges, an anchor at the bow. Instanced meshes.
- Parts: cabin windows, funnel bands, rounded lifeboats, curved davits.
- No change to stats or rules.
