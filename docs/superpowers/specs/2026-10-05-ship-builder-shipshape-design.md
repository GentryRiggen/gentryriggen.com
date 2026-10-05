# Ship Builder v2.7 "Shipshape" — polished-toy detail pass

**Date:** 2026-10-05
**Status:** Approved

Make every asset look like a premium toy: rounded, crisp, softly shaded, still
chunky and easy for kids to read. Everything stays generated in code (no model
or texture downloads; offline still works). Outer dimensions, attach points,
anchors and the sims are unchanged.

## Invariants (all areas)

- Keep `DECK_Y`, `HULL_DRAFT`, `BOOT_TOP`, `LEVEL_HEIGHT`, `BRIDGE_HEIGHT`, the
  0.96 block footprint, the 0.975 trim and `FACE_INSET` 0.48, funnel body
  radius/height (smoke anchors in `effectAnchors.ts`), `DAVIT_HEIGHT` /
  `DAVIT_REACH`, `HANG_OFFSET`, and every attach point position.
- Every visible sub-mesh of a part goes through `Surface` (or takes `tint` and
  `emphasis` the same way) so paint, ghost previews (0.55 alpha), hover and
  selection keep working. Ghosts must not show double layers.
- Hull bands keep their `onTap` / raycast handlers (tap-to-paint, iceberg aim).
- Geometry is cached per shape key and disposed per the existing pattern
  (shared module caches are never disposed; per-component geometry is
  disposed in effects).
- **Budget:** Titanic draw calls (`renderer.info.render.calls`, day calm,
  three-quarter view) may grow at most 15% over the pre-change baseline. New
  detail is merged into a part's existing meshes or instanced.

## 1. Lighting and materials

- Add `@react-three/postprocessing` (^3.1, with `postprocessing` ^6.36) and an
  `EffectComposer` with `N8AO` at half resolution (`halfRes`, quality
  "performance", modest radius/intensity, colour slightly tinted by time of
  day). Wrapped in drei `PerformanceMonitor`: on decline it switches AO off
  for the session. Reduced-motion has no effect on AO. Tests/visual runs can
  force it on or off through `window.__SHIP_BUILDER_TEST__.ao` (dev only,
  like the test clock).
- A code-generated environment for reflections: drei `<Environment
resolution={64} frames={1}>` built from `Lightformer`s (no HDR download),
  re-rendered when time of day changes, tinted day / sunset / night.
  `environmentIntensity` low so colours don't wash out.
- Day fill: replace pure white ambient with a hemisphere light (sky-blue
  top, sea-blue ground) at similar total brightness; sunset and night keep
  their mood. Values live in `environmentModel.ts` with its tests updated.
- `Surface` finishes: `paint` (roughness 0.55), `glass` (roughness 0.1),
  `metal` (roughness 0.4, metalness 0.6), `wood` (roughness 0.8), default
  `paint`. Materials are shared from a cache keyed by colour + finish + tint +
  emphasis + transparency, never mutated per mesh.

## 2. Hull

- One cross-section function `hullHalfWidth(y)` with a rounded bilge (radius
  about 0.35 of draft) used by both the middle section (now a lofted /
  extruded mesh instead of a box) and the bow/stern lofts, so they meet with
  no seam. `halfWidthAt` / `endSectionAt` callers (anchors) keep working;
  update `hullShapes.test.ts`.
- Bow flare: bow sections widen slightly toward the deck.
- Bulwark sweep: a thin bulwark strip along each side that rises from flush
  amidships to about +0.35 at the bow and +0.2 at the stern, above a flat
  deck. Painted with the topsides; railings sit on top of it where it rises.
- Trim: boot-top stripe (dark band at the waterline), a rubbing strake
  (small rounded band) along each side, a rounded deck edge.
- Portholes: instanced rims (torus) plus glass discs; still 2–3 instanced
  meshes total.

## 3. Superstructure

- A shared `roundedBox(width, height, depth, radius, segments)` geometry
  builder (cached by key, bevel radius about 0.06, 2 segments) used for deck,
  cabin and bridge blocks at the same outer size.
- Windows: a slight recess (frame proud of the glass) and a sill line, still
  merged into at most 4 meshes per block.
- Bridges: small bridge wings each side (within the block's footprint at
  the top level) and a darker window band.
- Railings: round stanchions (instanced cylinders) and a round top rail
  (tube or cylinder per run) that continues around the bow and stern curves
  and steps up onto the bulwark sweep.

## 4. Funnels and masts

- Funnel: same body; add a rolled rim at the top, a black smoke-top with a
  dark inner disc (opening), two bands. Liner funnels (`funnel`,
  `funnel-large`) get a thin steam pipe and whistle on the aft side. Modern
  funnel gets a rounded top and a grille band.
- Masts: tapered body, two or three rings; rigging/aerial wires slightly
  thicker so they read at default zoom.

## 5. Lifeboats and fittings

- Lifeboat hull built by lofting a boat profile (pointed bow, rounded stern,
  sheer) along its length; gunwale band; cover with a ridge line. Shared
  cached geometry per lifeboat type, same outer size.
- Davits: thicker arm, a small block (pulley) at the tip.
- Light rounding pass (using `roundedBox` or more segments) on ventilator
  cowls, deck chairs, benches, cranes, turrets, hatch covers and containers
  where it reads at default zoom. No new parts.

## 6. Checks

- A dev/test-only perf probe: `window.__shipBuilderRenderInfo()` returning
  `renderer.info.render.calls` and triangles; a Playwright script records the
  Titanic baseline before changes and after each area.
- Unit tests for new builders: `roundedBox`, hull cross-section and loft,
  lifeboat loft, funnel rim (vertex counts, bounds equal the old outer size,
  no NaN).
- All 10 visual baselines regenerated in Docker; the controller shares
  before / after screenshots (Titanic day and night, a modern ship, a
  lifeboat close-up) before shipping.
- Existing unit and e2e suites pass.

## Release

2.7.0 "Shipshape" with a changelog entry.
