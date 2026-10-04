# Ship Builder v1.1 — Design

**Date:** 2026-10-04
**Status:** Approved
**Builds on:** `2026-10-03-ship-builder-design.md` (v1, shipped)

## Summary

v1.1 makes Ship Builder a proper iPad app and adds the features the boys asked
for after playing v1:

1. Adjustable beam (ship width), so funnels can sit on a true centerline.
2. Blocks supported from the side: overhangs and bridges inside the hull, and
   wings that stick out past the hull edge.
3. Press-and-hold to delete.
4. Collapsible sidebars on wide screens.
5. Two-finger pan (and right/Shift-drag) instead of orbiting only the center.
6. Links to the game from the main site.
7. Home-screen install on iPad, working offline.

## Non-goals

- Heel/list physics from off-center weight (wings count toward stability only
  through their height, as blocks do today).
- Wings or beam changes beyond 2 cells or 3–7 cells respectively.
- A long-press context menu (hold deletes directly).
- Offline support for the rest of the site.
- Running the offline check in CI.

## 1. Model and data

### Beam

- `Ship.hull` gains `beam: number`, an integer in 3–7, default 4.
- Save format becomes **v2**: `{ v: 2, name, hull: { lengthSegments, beam },
parts }`. A real migration `MIGRATIONS[1]` adds `beam: 4`. v1 autosaves,
  My Ships entries and share links keep loading.
- `GRID_WIDTH` stops being a constant for anything ship-specific. Everything
  that used it reads the ship's beam: grid bounds, stability ratio
  (centre-of-mass height ÷ beam), gross tonnage (hull volume), hull/prow/stern
  geometry, mast mount centerline (`z = beam / 2`), davit sides and camera
  framing.
- Beam changes alter the **port** side (highest `z`). Parts keep their cell
  coordinates. Narrowing previews and confirms removed parts exactly like
  shortening the hull (`pendingRemoval.kind === "hull"` gains `beam`), and the
  support cascade removes anything left unsupported.
- Toolbar: a Beam −/+ group next to Hull length, labelled "N wide".

### Wings

- Blocks may occupy two wing columns past each hull edge:
  `z ∈ [−WING_REACH, beam − 1 + WING_REACH]` with `WING_REACH = 2`, at any
  level 0–3.
- Inside-hull cells are `0 ≤ z < beam`. Wing cells are the rest.
- The scene draws no hull under wing cells.

### Support rule (replaces rule 1)

- A cell is **grounded** when it has a grid part directly below it, or it is a
  level-0 inside-hull cell.
- A grid part is **supported** when every one of its cells is within
  `MAX_OVERHANG = 2` steps of a grounded cell, walking 4-neighbour through
  occupied cells on the same level (the part's own cells included).
- Computed per ship by a multi-source BFS from grounded cells over occupied
  cells per level. `canPlace` evaluates the candidate's cells against the ship
  plus the candidate.
- New rejection reason: `"Too far from a support (max 2 cells)"`. The old
  `"Needs a deck beneath every cell"` remains for a single block with nothing
  below and nothing beside it, so existing tests and copy keep their meaning.
- Rules that stay: nothing builds on a bridge, funnel or davit; bridge in the
  forward half and on top of its stack. The 1×4 bridge on a 3-wide ship puts its
  4th cell in a wing, which side support allows.
- `cascadeIds` keeps its fixpoint loop. Its structural check uses the new
  support rule, so removing an anchor brings down what hangs off it.
- `validateShip` replays placements in order, so a ship is valid only if it can
  be built in that order. Overhangs and wings therefore must be saved after
  their supports, which the store guarantees.

### Davits

- A davit point exists on a non-bridge grid part cell at level ≥ 1 that is
  uncovered above and is the outermost occupied cell of its row (same level,
  same `x`) on one side:
  - **starboard:** the lowest occupied `z` in the row, and `z ≤ 0`;
  - **port:** the highest occupied `z` in the row, and `z ≥ beam − 1`.
- Point id stays `davit:x:z` (now `z` may be negative), position on the outward
  face. Boat mounts hang outboard as before.

### Stats

Formulas unchanged except the beam substitutions above. Titanic row unchanged.

## 2. Interaction, UI and site link

### Press-and-hold delete

- `pointerdown` on a part starts a 600 ms timer and shows a filling ring at the
  pointer (DOM overlay, Tailwind, both themes).
- Cancel on: pointer moves > 8 px, `pointerup` before the timer, a second
  pointer down, `pointercancel`.
- On fire: `select(id)` then `requestDelete()` (lone part removed and undoable;
  stacks show the red highlight and Remove/Keep bar). The click that follows
  the release is swallowed so it doesn't place or select.
- Works with and without an active tool, mouse and touch.
- The canvas wrapper sets `select-none`, `[-webkit-touch-callout:none]`,
  `touch-none`.

### Pan

- OrbitControls: pan on, screen-space panning, touches `{ ONE: ROTATE,
TWO: DOLLY_PAN }`, mouse right button pans, Shift + left drag pans.
- On every controls change, clamp the target to the ship box: `x` within
  ±(length/2 + PROW_LENGTH + 3), `z` within ±(beam/2 + WING_REACH + 3), `y`
  within [0.5, 6]. The camera keeps `maxPolarAngle`, so it stays above water.
- Camera presets recenter on the ship.

### Collapsible sidebars

- At `lg` and up, each Drawer header gets a chevron button that collapses the
  aside to a 40 px rail showing its label vertically; the rail expands on tap.
- Collapsed state per side persists in localStorage under
  `ship-builder:ui:collapsed` (try/catch; works without storage).
- Below `lg`, the slide-out drawers stay. Selecting a catalog part closes the
  Parts drawer.

### Main-site link

- Terminal command `ships` (alias `ship-builder`): prints a short blurb
  ("A ship-building game I made for my boys ⚓"), a link to `/ship-builder`,
  then navigates there after ~1.2 s.
- Listed in the `help` output.
- One line in the boot sequence pointing at `ships`.
- A small "⚓ Ship Builder" link beside the footer copyright.
- Styles match the existing terminal and footer.

## 3. iPad home-screen app

- **Manifest:** static `public/ship-builder.webmanifest`, linked only from the
  ship-builder page metadata (`manifest: "/ship-builder.webmanifest"`). Name
  and short name "Ship Builder", `start_url` and `scope` `/ship-builder`,
  `display: "standalone"`, `orientation: "landscape"`, sea-blue theme and
  background colours, icons 192, 512 and 512 maskable.
- **iOS metadata:** `appleWebApp: { capable: true, title: "Ship Builder",
statusBarStyle: "black-translucent" }` and `icons.apple` →
  `/ship-builder-icons/apple-touch-icon.png` (180×180) on the page.
- **Icon:** procedural liner silhouette on sea blue. `scripts/ship-builder-icons.mjs`
  renders an SVG to PNGs with `sharp` (already a Next dependency). Script and
  PNGs committed under `public/ship-builder-icons/`.
- **Offline:** hand-written `public/ship-builder-sw.js`, registered from
  `ShipBuilder` in production only, with scope `/ship-builder`.
  - Navigations under scope: network-first, fall back to cached page.
  - `/_next/static/*`: cache-first (hashed, immutable).
  - On install/activate, the page posts `performance.getEntriesByType("resource")`
    URLs (same-origin) to the worker, which caches them, so the first visit is
    enough to play offline.
  - Versioned cache name; old caches deleted on activate.
- **Hosting:** `firebase.json` gets `Cache-Control: no-cache` for
  `/ship-builder-sw.js` and `/ship-builder.webmanifest`, ahead of the existing
  1-year rule.
- **Full-screen polish:** `touch-manipulation` on buttons, safe-area padding on
  header (`pt-[env(safe-area-inset-top)]`) and toolbar
  (`pb-[env(safe-area-inset-bottom)]`), `overscroll-none` and fixed height on
  the page root.

## Error handling

- Invalid beam or v2 data → same "Couldn't load that ship" path as today.
- Service worker registration failures are ignored (the game works online).
- Storage failures for the sidebar state fall back to expanded.

## Testing

- **Unit:** beam bounds and changeBeam/preview; wing bounds; support BFS
  (grounded, 1- and 2-step overhangs, 3-step rejection, bridges between two
  supports, 2×1 half-grounded, cascade when an anchor is removed); davits on
  wing blocks; v1→v2 migration and old share links; stats with beam 3/7;
  long-press timing and cancel rules (fake timers); pan clamp maths; Drawer
  collapse persistence; terminal `ships` command, help entry and footer link;
  store invariant fuzz extended with beam changes and wing anchors.
- **E2E:** add an `ipad` Playwright project (`devices["iPad Pro 11 landscape"]`,
  WebKit) running the ship-builder spec; tests for long-press delete, beam
  change, a wing block, and the home `ships` command.
- **Offline:** `scripts/check-ship-builder-offline.mjs` builds, serves `out/`
  with a tiny static server, loads the page in Chromium, goes offline, reloads
  and asserts the canvas renders. Run manually; not in CI.
