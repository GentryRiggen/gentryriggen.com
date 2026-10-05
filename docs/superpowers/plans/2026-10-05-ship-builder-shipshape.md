# Ship Builder v2.7 "Shipshape" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A polished-toy detail pass on every 3D asset, within a 15% draw-call
budget.

**Architecture:** Spec:
`docs/superpowers/specs/2026-10-05-ship-builder-shipshape-design.md` (its
Invariants section is binding for every task). Groundwork is committed
(`cc60c10`): `scene/RenderInfoProbe.tsx` (`window.__shipBuilderRenderInfo()`),
`scripts/ship-builder-shots.mjs` (screenshots + draw calls), `Surface`
`finish` prop (`paint` | `glass` | `metal` | `wood`), and
`scene/roundedBox.ts` (`roundedBox(w, h, d, radius?, segments?)`, cached,
exact outer size). Tasks 1–4 run in parallel worktrees, each owning its own
files; Task 5 integrates.

**Baseline (before any change, software WebGL, 1280×800):** Titanic day
1,497 draw calls / 120k triangles; Titanic night 1,579; Wonder of the Seas
day 3,058 / 172k. Budget: at most +15% on each.

**Measure:** run a dev server on your own port
(`npx next dev --webpack -p <port>`), then
`node scripts/ship-builder-shots.mjs http://localhost:<port> <dir> <label>`;
it prints draw calls per look and saves screenshots (day, night, side,
zoomed in, cruise). Look at the screenshots yourself before reporting.

**Tech Stack:** three 0.186, @react-three/fiber 9, drei 10, Jest, Playwright.

---

### Task 1: Lighting and materials

**Files:** `package.json` (add `@react-three/postprocessing` ^3.1 and
`postprocessing` ^6.36), `scene/Scene.tsx`, new `scene/PostEffects.tsx`,
`scene/Environment.tsx`, `scene/environmentModel.ts` (+ tests),
`scene/Surface.tsx` (internals only; keep its props), `scene/GlowSurface.tsx`
if it needs the same finish handling, `scene/testClock.ts` (an `ao?: boolean`
test flag).

- [ ] N8AO via `EffectComposer` at half resolution, time-of-day tinted, behind
      drei `PerformanceMonitor` (decline → AO off for the session). Test flag
      `window.__SHIP_BUILDER_TEST__.ao` forces it on/off (dev only).
- [ ] Code-generated Lightformer environment (no downloads), re-rendered on
      time-of-day change, low `environmentIntensity`.
- [ ] Day hemisphere fill (sky blue / sea blue) replacing the flat white
      ambient at similar brightness; environmentModel tests updated.
- [ ] `Surface` shares materials from a cache keyed by colour, finish, tint,
      emphasis, opacity and side (use `<primitive object attach="material">`);
      ghosts and emphasis unchanged. Dispose nothing that is shared.
- [ ] Hull raw materials get the paint finish (coordinate by only touching
      material props in Hull.tsx if needed — Task 2 owns its geometry; prefer
      leaving Hull.tsx alone and reporting).
- [ ] Draw calls within budget (AO passes included). Commit per item.

### Task 2: Hull and railings

**Files:** `scene/Hull.tsx`, `scene/hullGeometry.ts`, `scene/hullShapes.ts`,
`scene/HullDetails.tsx`, `scene/Railings.tsx`, `scene/railRuns.ts`, their
tests; touch `HullGash.tsx` / `IcebergAimLayer.tsx` / `anchors.ts` only if the
hull change requires it.

- [ ] Shared cross-section with rounded bilge for the middle and the ends (no
      seams), bow flare, bulwark sweep (+0.35 bow, +0.2 stern, flat deck), boot
      -top stripe, rubbing strake, rounded deck edge, rimmed portholes
      (instanced). Hull materials use `finish` values from `FINISHES` in
      Surface.tsx.
- [ ] Railings: round instanced stanchions, round top rail, continue around
      bow/stern curves and up onto the bulwark sweep.
- [ ] Tap-to-paint bands and iceberg aim still work; unit tests for the
      cross-section and loft (bounds, no NaN, no seam gap). Budget held.

### Task 3: Superstructure

**Files:** `scene/PartMesh.tsx` (the grid-block section only),
`scene/BlockDetails.tsx`, `scene/blockDetailGeometry.ts`, `cruiseParts.tsx`
(`Balconies` / `PoolMesh` only if they must follow the new block shape), tests.

- [ ] Deck, cabin and bridge bodies use `roundedBox` at the same outer size.
- [ ] Windows recessed (frame proud of glass) with a sill line, still ≤ 4
      merged meshes per block; glass uses `finish="glass"`.
- [ ] Bridge wings and a darker window band on bridges.
- [ ] Trim (class stripe, deck line) still sits flush on the rounded body.
      Tests for the window builder. Budget held.

### Task 4: Funnels, masts, lifeboats and fittings

**Files:** `scene/FunnelMesh.tsx`, `scene/LifeboatMesh.tsx`,
`scene/DavitMesh.tsx`, `scene/fittingDecor.tsx`, `scene/deckDecor.tsx`,
`scene/cargoParts.tsx`, `scene/navyParts.tsx`, `scene/cruiseParts.tsx`
(`ModernFunnel`, `EnclosedLifeboat` only), `scene/PartMesh.tsx` (funnel, mast,
lifeboat sections only), tests.

- [ ] Funnels: rolled rim, smoke-top with dark opening, two bands; liner
      funnels get a steam pipe and whistle; modern funnel rounded top and
      grille band. Body size and smoke anchors unchanged.
- [ ] Masts tapered with rings; wires slightly thicker.
- [ ] Lifeboats lofted from a boat profile (pointed bow, round stern, sheer),
      gunwale, ridged cover; shared cached geometry; same outer size.
- [ ] Davits thicker with a tip block; reach/height unchanged.
- [ ] Rounding pass on ventilators, deck chairs, benches, cranes, turrets,
      hatch covers, containers (merged where they were merged).
- [ ] Metal fittings `finish="metal"`, deck wood `finish="wood"`. Tests for the
      lifeboat loft and funnel rim. Budget held.

### Task 5: Integrate and release (controller)

- [ ] Merge 1 → 4 into `ship-builder-shipshape`, resolve PartMesh hunks.
- [ ] Shots + draw calls vs baseline; fix overruns.
- [ ] One combined review; fix Critical/Important.
- [ ] Regenerate the 10 visual baselines in Docker; `npm run validate`;
      Playwright chromium/webkit/ipad.
- [ ] Before/after screenshots to the user for sign-off, then 2.7.0 version +
      changelog, push to main, watch CI.
