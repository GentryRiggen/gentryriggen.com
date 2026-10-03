# Ship Builder — Design

**Date:** 2026-10-03
**Status:** Draft, awaiting review
**Route:** `gentryriggen.com/ship-builder`

## Summary

A browser game for building custom Titanic-era (c. 1900–1915) ocean liners from
snap-together parts, including lifeboats on davits. Players build freely in a
3D scene while a live stats panel shows passenger capacity, lifeboat coverage,
tonnage, speed, and stability. Ships are saved in the browser and shared via
URL. It ships as a new route inside this static-export Next.js site.

## Goals (v1)

- Build a liner by choosing a hull length and placing parts on a grid and on
  attach points.
- Live stats with warnings, with the real Titanic as a reference row.
- Works on desktop; tablet-compatible input model (polish later).
- Save locally, autosave, and share by link. No backend.

## Non-goals (v1)

- Sailing, physics, water simulation, sinking.
- Accounts, cloud saves, public gallery, per-ship link previews.
- Challenges or goal-based modes (stats are designed so these can be added).
- Phone layout.
- Cranes, ventilators, cargo holds, interiors, paint customization.
- Imported 3D models (all parts are procedural low-poly geometry in v1).

## Fit with the existing site

This site is `output: "export"` on Firebase Hosting: no SSR, no API routes.
The game is entirely client-side, so it fits as-is.

- New route `app/ship-builder/page.tsx` (server component: metadata + shell)
  rendering a `"use client"` game root. The 3D canvas is loaded with
  `next/dynamic` and `ssr: false` so Three.js never runs at build time and its
  bundle only loads on this route.
- Existing conventions apply: `export default function` components,
  `interface` for props, `@/` imports, Tailwind only (no inline styles, no CSS
  modules), light and dark mode for all UI chrome, Prettier settings, Jest +
  RTL for unit tests, Playwright for e2e.
- The 3D scene itself uses its own fixed palette (sea, sky, Edwardian livery
  colors) regardless of site theme; panels and toolbar follow the theme.
- Add the route to `app/sitemap.ts`.

## Stack additions

- `three`, `@react-three/fiber`, `@react-three/drei` — rendering, OrbitControls.
- `zustand` — game state store.
- `zod` — validating loaded/shared ship data.
- `lz-string` — compressing ship data into share URLs.

## Architecture

```
app/ship-builder/
  page.tsx                 server component: metadata, renders <ShipBuilder />
lib/ship-builder/
  model/                   pure TS — no React, no Three
    types.ts               Ship, PlacedPart, Anchor, PartDef
    catalog.ts             part definitions
    grid.ts                hull → deck grid, cell math
    placement.ts           canPlace(), place(), remove() with cascade
    stats.ts               computeStats(ship) → Stats + warnings
  state/
    store.ts               Zustand: ship, selected tool, selection, history
  persist/
    schema.ts              zod schema, versioning, migrations
    local.ts               localStorage: My Ships + autosave
    share.ts               encode/decode #ship= hash
components/ship-builder/
  ShipBuilder.tsx          client root; layout; loads scene dynamically
  scene/                   R3F: Scene, Ocean, Hull, PartMesh, GhostPreview,
                           CameraRig, part geometry builders
  ui/                      CatalogPanel, StatsPanel, Toolbar, Drawer,
                           MyShipsDialog, ShareButton
```

Rule: `model/` depends on nothing. `state/` depends on `model/`. `persist/`
depends on `model/`. Scene and UI read from the store and call store actions;
they never mutate the ship directly or compute rules themselves.

## 1. Data model and parts catalog

```ts
interface Ship {
  v: 1;
  name: string;
  hull: { lengthSegments: number }; // 4–12
  parts: PlacedPart[];
}

interface PlacedPart {
  id: string;
  type: PartType;
  anchor: GridAnchor | AttachAnchor;
  rotation: 0 | 90 | 180 | 270;
}

type GridAnchor = { kind: "grid"; level: number; x: number; z: number };
type AttachAnchor = {
  kind: "attach";
  parentId: string | "hull";
  pointId: string;
};
```

Each `PartDef` in the catalog declares: category, display name, footprint
(grid parts) or required attach-point type (attach parts), attach points it
exposes, geometry builder, and stat contributions.

| Category      | Parts                                   | Placement                                  |
| ------------- | --------------------------------------- | ------------------------------------------ |
| Hull          | Bow, midsection (repeated), stern       | Derived from `lengthSegments`, not placed  |
| Decks         | Superstructure block 1×1, 2×1           | Grid, levels 0–3 (0 = on the main deck)    |
| Cabins        | 1st, 2nd, 3rd class blocks (1×1)        | Grid, any level                            |
| Command       | Bridge / wheelhouse                     | Grid, top of its stack, forward half       |
| Funnels       | Funnel                                  | Attach: `funnel-mount` on deck blocks      |
| Masts         | Fore mast, aft mast                     | Attach: `mast-mount` on hull deck          |
| Lifeboat gear | Davit; lifeboat (standard, collapsible) | Davit on `davit-point`; boat on davit only |

Visual style: procedural low-poly geometry; black hull with red antifouling
below the waterline, white superstructure, buff funnels with black tops.

## 2. Building rules and placement

**Grid.** Main deck (level 0) is the hull top: 3 cells per hull segment long,
4 cells wide. Levels 1–3 stack above.

**Rules** (pure functions in `placement.ts`, each returning
`{ ok: true } | { ok: false; reason: string }`):

1. **Support:** every cell a block occupies at level _n_ > 0 has a block
   beneath at level _n_ − 1. Level 0 is supported by the hull.
2. **No overlap:** no two parts share a cell or an attach point.
3. **Bridge:** must be on the top occupied level of its column(s) and in the
   forward half of the ship.
4. **Boat deck:** davit points are generated on the outboard edge cells
   (z = 0 and z = 3) of the topmost block in each column, level ≥ 1. One
   lifeboat per davit.
5. **Mounts:** deck blocks expose one `funnel-mount`; the hull exposes
   `mast-mount`s near bow and stern.
6. A block can't be placed on top of a cell that holds a bridge or funnel.

**Placement flow.** Select a part → a ghost preview snaps to the nearest valid
cell/point under the pointer; green when valid, red with the rule's reason
when not → click/tap to place. `R` or the Rotate button rotates 90°.

**Removal cascades:** removing a part removes everything supported by or
attached to it. The affected set is highlighted before confirm.

**Undo/redo:** history stack of Ship snapshots in the store (cap ~100).

**Hull length:** growing always succeeds. Shrinking previews and confirms the
removal of parts beyond the new stern (with cascade).

## 3. Live stats

`computeStats(ship)` returns:

| Stat              | Formula (tunable constants in `stats.ts`)                                     |
| ----------------- | ----------------------------------------------------------------------------- |
| Passengers        | Per cabin cell: 1st ≈ 30, 2nd ≈ 50, 3rd ≈ 120; reported by class              |
| Crew              | Base per hull segment + stokers per funnel                                    |
| People aboard     | Passengers + crew                                                             |
| Lifeboat seats    | Standard 65, collapsible 47                                                   |
| Coverage          | seats ÷ people; red < 50%, amber 50–99%, green ≥ 100%                         |
| Gross tonnage     | Enclosed volume (hull + blocks) × constant                                    |
| Top speed (knots) | f(funnels ↑, tonnage ↓, length ↑ slightly), clamped to a sane range           |
| Stability         | Weighted center-of-mass height vs. hull beam → Stable / Top-heavy / Dangerous |

**Warnings:** insufficient lifeboats (with numbers), no bridge, no funnels,
top-heavy.

**Titanic reference row:** ~46,000 GRT, 21 kn, 20 lifeboats (1,178 seats),
2,224 aboard.

## 4. Layout, scene, controls

**Desktop layout:** left catalog panel (grouped by category), center canvas,
right stats + warnings panel, bottom toolbar (ship name, hull length −/+,
undo, redo, rotate, delete, save, share, My Ships). At `md` and below, the
side panels become slide-out drawers.

**Scene:** flat ocean plane with gradient, sky backdrop, directional sun +
ambient light, ship sitting at waterline. Grid overlay visible only while a
part is selected for placement. Hover highlights parts; click selects.

**Camera:** drei `OrbitControls` (mouse + touch built in), clamped so it can't
go below the water; preset buttons Side / Top / ¾.

| Action      | Mouse/keyboard                | Touch                       |
| ----------- | ----------------------------- | --------------------------- |
| Place       | Select part, click            | Select part, tap            |
| Rotate      | R                             | Rotate button               |
| Delete      | Del / Backspace               | Delete button               |
| Cancel      | Esc                           | Tap the active catalog item |
| Undo / Redo | Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z | Buttons                     |

Input uses pointer events + tap-to-place (no drag-to-place), so the same model
works on touch. v1 is tested on desktop; tablet polish is a follow-up.

## 5. Persistence and sharing

- **My Ships:** named designs in `localStorage`; load, rename, delete.
- **Autosave:** current ship persisted on change (debounced); restored on load.
- **Share link:** `/ship-builder#ship=<lz-string compressed JSON>`. Opening it
  loads the ship as a new unsaved design and clears the hash.
- **Versioning:** `v` field; `schema.ts` migrates older versions forward.
- **Invalid data:** zod validation + rule re-check on load. Failures show
  "Couldn't load that ship" and start a fresh hull. Never crash.
- All `localStorage` access is wrapped in try/catch; the game works without it.

## Error handling

- Placement failures are expected states (red ghost + reason), not errors.
- Persistence failures degrade silently to in-memory with a one-time notice.
- WebGL unavailable: render a friendly message in place of the canvas.

## Testing

- **Jest (unit), in `__tests__/` next to code:** grid math, every placement
  rule, cascade removal, hull shrink, stats formulas and warnings, undo/redo,
  schema validation, share encode → decode round trip, corrupted input.
  The model is pure TS, so no Three.js in Jest.
- **RTL:** StatsPanel and CatalogPanel render from store state.
- **Playwright (`e2e/ship-builder.spec.ts`):** load route, place a deck block,
  davit, and lifeboat; assert stats update; copy share link, open it, assert
  the same stats. Scene interactions use test hooks (e.g. `data-testid` cells
  or a store-driven placement helper) rather than pixel coordinates. If WebGL
  is unreliable in a CI browser, scope the scene-dependent spec to Chromium.

## Follow-ups (not v1)

- Tablet polish; phone layout.
- Challenges mode on top of stats.
- Cloud saves / gallery (would need a backend; this site is static export).
- Terminal command on the home page that links to the game.
- More parts, paint, better models.
