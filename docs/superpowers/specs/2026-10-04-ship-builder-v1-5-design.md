# Ship Builder v1.5 — Design (Phase 1 of the ship-types roadmap)

**Date:** 2026-10-04
**Status:** Approved

Roadmap: Phase 1 (this doc) → Phase 2 ship types (ocean liner, modern
cruise ship, navy ship, cargo ship) with type-specific parts → Phase 3
aesthetic parts → Phase 4 templates (Titanic, Olympic, Britannic, Carpathia,
Lusitania, one starter per type).

## Sidebars

- Each side panel's top bar (close / collapse button, and the panel title) is
  `sticky top-0` inside the panel's scroll area, with an opaque background in
  both themes, so the close button never scrolls away.
- Parts panel: a search box in that sticky bar ("Search parts", with a
  magnifier icon and a clear button). Fuzzy matching over part name,
  description and category name, plus hull shape names, tolerant of
  typos. Implemented in-house (no dependency): case-insensitive, matching
  subsequences and single-edit typos per word, ranked by score. Empty query
  shows everything. No results shows "No parts match".

## Crew quarters

- Part `cabin-crew`: category cabins, "Crew quarters", "60 crew berths",
  1×1, role `cabin` (same placement rules as other cabins), `crewBerths: 60`
  per cell.
- Stats gain `crewBerths`. Warning `crew-berths` when
  `crewBerths < crew`: "Crew need beds: {berths} of {crew}". Its own icon.
- Stats panel shows a "Crew beds" row.

## Waves

- Sea state `calm | choppy | stormy`, default `calm`, chosen with a "Sea"
  control (three icon buttons) next to the camera buttons, remembered per
  device in localStorage (wrapped in try/catch), not saved with the ship.
- The ocean surface animates with a vertex-shader displacement (sum of a few
  sines) whose amplitude and speed scale with the sea state; calm is a gentle
  swell, stormy is clearly rough. No per-vertex CPU work per frame.
- The ship's bob and roll amplitude scale with the sea state (calm = today).
  Top-heavy ships still roll more than stable ones in every sea.
- Reduced motion: the sea is static and the ship doesn't move, whatever the
  setting.
