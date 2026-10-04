# Ship Builder v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development. Tasks in the same wave run in parallel worktrees (see the user's standing preference). Steps use checkbox syntax.

**Goal:** Ship v1.1 per `docs/superpowers/specs/2026-10-04-ship-builder-v1-1-design.md`: adjustable beam, side-supported blocks and wings, press-and-hold delete, two-finger pan, collapsible sidebars, main-site links, and an offline iPad home-screen app.

**Architecture:** Model changes stay in `lib/ship-builder/model` (pure TS). Support becomes a derived, BFS-computed property. The save format moves to v2 with a migration. UI and scene changes stay in their existing folders. The PWA is static files plus a hand-written service worker registered in production only.

**Tech stack:** as v1. `sharp` (already installed via Next) renders the icons.

**Plan style note:** unlike the v1 plan, tasks here give precise specs, algorithms, interfaces and test cases rather than full code listings, because they modify existing, well-tested code that implementers must read first. Every task is TDD, one commit per numbered item, and must pass `npm run lint`, `npm run type-check`, `npx jest` and `npm run format:check`.

---

## Waves

| Wave | Tasks (parallel)                                                      | Depends on |
| ---- | --------------------------------------------------------------------- | ---------- |
| 1    | T1 Model, T2 Site link, T3 iPad app, T4 Long-press + pan, T5 Sidebars | main       |
| 2    | T6 Beam and wings in UI and scene                                     | T1, T4     |
| 3    | T7 E2E, offline check, ship                                           | all        |

**Reviews:**

- T1 changes the rules and the save format, so it gets a combined review plus an adversarial pass on the v1→v2 migration and parsing.
- T3 adds a service worker, so its review must cover cache-poisoning and stale-cache risks.
- T2, T4, T5 and T6 get one combined review each.

---

### T1: Model — beam, wings, side support, davits, save v2

**Files:** `lib/ship-builder/model/{types,grid,attach,placement,stats}.ts`, `lib/ship-builder/persist/schema.ts`, `lib/ship-builder/state/store.ts`, `lib/ship-builder/testing.ts`, and their tests (including `store.invariant.test.ts`).

1. **Beam in the data model.**
   - `Ship = { v: 2; name; hull: { lengthSegments; beam }; parts }`.
   - Add `MIN_BEAM = 3`, `MAX_BEAM = 7` and `DEFAULT_BEAM = 4` in grid.ts.
   - `testShip(parts, lengthSegments = 8, beam = 4)`.
   - `emptyShip()` sets beam 4.
   - Remove ship-specific uses of `GRID_WIDTH`. Keep `GRID_WIDTH` only if something truly needs a constant; otherwise delete it and add `beamOf(ship)`.
2. **Schema v2 and migration.**
   - `CURRENT_VERSION = 2`, and the schema validates `beam` as an integer 3–7.
   - `MIGRATIONS[1] = raw => ({ ...raw, v: 2, hull: { ...hull, beam: 4 } })`, where `hull` must be a record; otherwise return it unchanged so parse fails.
   - Tests: v1 JSON → v2 with beam 4; old share-link fixtures still decode; beam 2 and 8 are rejected; v2 round-trips.
3. **Bounds and wings.**
   - `WING_REACH = 2`.
   - `inBounds(ship, cell)`: level 0–3, x in hull length, `z ∈ [−WING_REACH, beam−1+WING_REACH]`.
   - Add `isInsideHull(ship, cell)`.
4. **Support rule.** Add `supportMap(ship, occupancy): Map<cellKey, distance>` (distance to the nearest grounded cell). Per level: multi-source BFS from grounded cells, 4-neighbour, through occupied cells only.
   - A cell is grounded if it's at level 0 inside the hull, or if `occupancy.has(cellBelow)`.
   - `MAX_OVERHANG = 2`.
   - In `canPlaceGrid`, replace the per-cell "needs below" check with one that evaluates the ship plus the candidate. If every candidate cell has distance ≤ 2, it passes. Otherwise:
     - if the candidate has no cell that is grounded or adjacent to an occupied same-level cell, reject with `"Needs a deck beneath every cell"`;
     - otherwise reject with `"Too far from a support (max 2 cells)"`.
   - Keep the rule-6 checks (bridge, funnel, davit below) for cells that have a part below.
   - `isStillSupported` in the cascade uses the same rule. Compute `supportMap` once per fixpoint pass, not once per part.
   - **Tests:**
     - level-0 wing block next to a hull block: ok;
     - level-0 wing block 3 out: rejected (out of bounds, since reach is 2);
     - a level-1 cantilever 1 and 2 cells from a supported block: ok; 3 cells: "Too far…";
     - a 4-cell bridge between two pillars: ok, because each middle cell is ≤ 2 from a pillar;
     - a 2×1 with one cell over a block: ok;
     - removing a pillar cascades the far end of the bridge but keeps cells still within 2 of the other pillar;
     - a bridge 1×4 on beam 3 places, with its 4th cell in a wing;
     - every existing placement test still passes, updating messages only where the spec says they change.
5. **Davits.** Implement the spec's outermost-cell-in-row rule, using `z` that may be negative. Starboard position `z` is the cell's z (outward face); port is `z + 1`. Boat mount offsets are unchanged.
   Tests: a davit on a wing block at z = −2 (starboard) and at z = beam+1 (port); no davit on an inner cell when a wing block is outboard of it.
6. **Stats.** Hull cells = `length × beam`, stability ratio ÷ beam, tonnage uses beam.
   Tests: the same blocks are less stable on beam 3 than on 7; empty-hull tonnage scales with beam.
7. **Store.**
   - Add `changeBeam(delta)`, mirroring `changeHullLength`: clamp, preview via `previewHullChange(ship, { lengthSegments, beam })`, commit or set `pendingRemoval`.
   - Generalise `pendingRemoval.kind "hull"` to carry `{ lengthSegments, beam }`, and `confirmRemoval` applies both.
   - In the model, replace `setHullLength` and `previewHullLength` with `setHullSize` and `previewHullSize` taking `{ lengthSegments?, beam? }`, or keep the old names as wrappers. Update callers and tests.
   - Extend the invariant fuzz with `changeBeam(±1)` and with anchors in the wing range.

### T2: Main-site link

**Files:** `components/designs/design1/{commandResponses.tsx,constants.ts,Terminal.tsx}` (boot line), `app/page.tsx` (footer), and their tests (`app/__tests__/page.test.tsx`; add a commandResponses test if none exists).

1. Add a `ships` / `ship-builder` command. It returns the blurb "A ship-building game I made for my boys ⚓" plus a link to `/ship-builder`, then navigates there after about 1.2 s. Use the existing response shape. If responses can't trigger side effects, add a minimal `navigateTo` field handled by `InteractivePrompt`, using `window.location.assign`. Add it to `help`.
2. Add a boot sequence line, in the style of the existing lines, mentioning `ships`.
3. Add a footer link "⚓ Ship Builder" next to the copyright, styled like the footer text, in both themes.
4. **Tests:** the command output and its delayed navigation (fake timers, mocked `location.assign`); `help` lists `ships`; the footer link has `href="/ship-builder"`; the existing home e2e still passes (update `e2e/home.spec.ts` only if boot text timing changes).

### T3: iPad home-screen app (PWA) and touch polish

**Files:**

- `public/ship-builder.webmanifest`
- `public/ship-builder-icons/*.png`
- `scripts/ship-builder-icons.mjs`
- `public/ship-builder-sw.js`
- `components/ship-builder/hooks/useServiceWorker.ts` and its test
- `app/ship-builder/page.tsx`
- `firebase.json`
- `components/ship-builder/ShipBuilder.tsx` (root classes, safe-area header, SW hook): **minimal edits; T5 also edits this file**
- `components/ship-builder/ui/Toolbar.tsx` (safe-area padding only; T6 adds beam controls later)
- `components/ship-builder/ui/styles.ts` (`touch-manipulation` on button classes)
- `scripts/check-ship-builder-offline.mjs`

1. **Icons.** The script draws an SVG liner (black hull, red boot-top, white superstructure, two buff funnels with black tops, on sea blue `#1f4e6e`). It writes `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` and `icon-512-maskable.png` (with 20% safe padding). Commit the PNGs.
2. **Manifest and metadata.** Write the manifest per the spec. On the page, set metadata `manifest`, `appleWebApp` and `icons.apple`, plus a `viewport` export with `themeColor` `#1f4e6e`. Extend the route test.
3. **Service worker** (`ship-builder-sw.js`, plain JS):
   - `CACHE = "ship-builder-v1"`.
   - `install`: `skipWaiting()`.
   - `activate`: delete other `ship-builder-*` caches, then `clients.claim()`.
   - `message {type:"CACHE_URLS", urls}`: cache-add same-origin URLs, ignoring failures.
   - `fetch`, for same-origin GET only:
     - navigations within `/ship-builder`: network-first, falling back to cached `/ship-builder` (store the response under the request URL and under `/ship-builder`);
     - `/_next/static/`: cache-first, populating the cache on a miss;
     - everything else: pass through.
4. **Registration** (`useServiceWorker`):
   - Only when `process.env.NODE_ENV === "production"` and `"serviceWorker" in navigator`.
   - `register("/ship-builder-sw.js", { scope: "/ship-builder" })`.
   - Then, once `navigator.serviceWorker.ready` resolves, post `CACHE_URLS` with the same-origin resource entries plus `location.href`.
   - Swallow errors.
   - Test with a mocked navigator.
5. **Hosting.** In `firebase.json`, add header rules (before the 1-year rule) giving `Cache-Control: no-cache` to `/ship-builder-sw.js` and `/ship-builder.webmanifest`. Firebase uses the first matching rule per header key, so verify the order works, or exclude via glob.
6. **Touch polish.**
   - Root: `h-[100dvh] overflow-hidden overscroll-none`.
   - Header: `pt-[env(safe-area-inset-top)]`.
   - Toolbar: `pb-[max(0.5rem,env(safe-area-inset-bottom))]`.
   - Buttons: `touch-manipulation`.
7. **Offline check script:** run `next build`; serve `out/` with a tiny `http` static server (cleanUrls: `/ship-builder` → `ship-builder.html`) on port 3199. Then, in Playwright Chromium (swiftshader):
   - load the page;
   - wait for the SW to be ready and its URLs cached;
   - `context.setOffline(true)` and reload;
   - assert the heading and `[data-testid="ship-canvas"] canvas` are present;
   - exit non-zero on failure.

   Document it in the script header.

### T4: Press-and-hold delete and two-finger pan

**Files:** `components/ship-builder/scene/{ShipParts.tsx,PartMesh.tsx (only if needed),CameraRig.tsx,cameraViews.ts,Scene.tsx}`, new `scene/longPress.ts` (pure state machine) and `scene/LongPressRing.tsx` (DOM overlay, rendered inside Scene's wrapper div), and tests.

1. **Long-press state machine** (`longPress.ts`, pure, testable):
   - `start(pointerId, x, y, t)`, `move(pointerId, x, y)`, `secondPointer()`, `end(pointerId)`, `tick(t)` → `"fire"`.
   - Constants: `LONG_PRESS_MS = 600`, `MOVE_CANCEL_PX = 8`.
   - Fake-timer tests cover the timer firing, cancelling on move over 8 px, cancelling on early pointer-up, cancelling on a second pointer, and cancelling on pointercancel.
2. **Wiring in ShipParts:**
   - `onPointerDown` on a part (in both the interactive and the tool-active handler sets) starts a press for that part id.
   - Window `pointermove`, `pointerup` and `pointercancel` listeners feed the machine.
   - On fire: `select(id)`, `requestDelete()`, and a short-lived "suppress next click" flag that both the part click handlers and the GridTargets/AttachMarkers click handlers respect. Put the flag in a tiny shared module, `scene/clickGuard.ts`; don't add it to the store.
   - The ring shows at the pointer while pressing (CSS conic or SVG ring, animated with a Tailwind/`@keyframes` fill in `globals.css`, both themes).
   - Canvas wrapper: `select-none [-webkit-touch-callout:none] touch-none`.
3. **Pan:**
   - OrbitControls: `enablePan`, `screenSpacePanning`, `touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}`, `mouseButtons` with RIGHT = PAN. For Shift + left-drag pan, use the controls' `keyPanSpeed`/modifier support if present; otherwise handle `pointerdown` with shiftKey by temporarily setting `mouseButtons.LEFT = PAN`.
   - `onChange`: `clampTarget(target, bounds)`, where `bounds = panBounds(lengthCells, beam)` in cameraViews.ts. For now, read beam as the ship's `hull.beam ?? 4`; T6 tightens this.
   - Presets reset the target.
   - Tests for `clampTarget` and `panBounds`.

### T5: Collapsible sidebars and auto-close

**Files:** `components/ship-builder/ui/Drawer.tsx`, `components/ship-builder/ShipBuilder.tsx` (wiring only), `components/ship-builder/ui/CatalogPanel.tsx` (callback prop), new `components/ship-builder/hooks/useCollapsedPanels.ts`, and tests.

1. **`useCollapsedPanels()`:** `{ left: boolean; right: boolean; toggle(side) }`, persisted to `ship-builder:ui:collapsed` in localStorage with try/catch. Initialise via `useSyncExternalStore` or a lazy `useState` reading storage on the client. Avoid hydration mismatch: the server renders expanded.
2. **Drawer at `lg`:**
   - A collapse chevron button (aria-label "Collapse Parts" / "Expand Parts", `aria-expanded`), `hidden lg:inline-flex`.
   - Collapsed means `lg:w-10`, content hidden (`lg:hidden` plus `inert` on the content wrapper), with a vertical rail label (`[writing-mode:vertical-rl]`) that expands on click.
   - Below `lg`, behaviour is unchanged.
3. **Auto-close:** CatalogPanel gets an optional `onPick` callback, called after `selectTool`. ShipBuilder passes `() => setOpenDrawer(d => d === "left" ? null : d)`, which only affects below-lg drawers. At `lg` the drawers aren't overlays, so closing the state is harmless.
4. **Tests:** collapse and expand toggle classes and aria; persistence across remounts; storage throwing → expanded; picking a part closes the Parts drawer.

### T6: Beam and wings in the UI and scene (after T1 and T4)

**Files:** `components/ship-builder/ui/Toolbar.tsx`, `components/ship-builder/scene/{coords.ts,Hull.tsx,GridTargets.tsx,cameraViews.ts,CameraRig.tsx,AttachMarkers.tsx,PartMesh.tsx}`, and tests.

1. **Toolbar:** a Beam group with "Narrower" and "Wider" buttons (aria-labels), the text `N wide` (`data-testid="beam-width"`), and disabled states at 3 and 7. It wires `changeBeam`.
2. **coords:** `modelToWorld(lengthCells, beam, p)` → `z = beam/2 − p.z`. Update every caller.
3. **Hull:** box width, prow triangle half-width and stern radius use beam/2; the deck plate matches.
4. **GridTargets:** iterate `z` from −WING_REACH to beam−1+WING_REACH. Show a target only where `canPlace` could plausibly succeed: the column's next level is inside bounds, and the cell is inside the hull OR adjacent to an occupied cell at that level. That keeps the water from being covered in targets. Wing targets use a dashed-look outline: a different colour from the palette (`gridTargetWing`).
5. **cameraViews and CameraRig:** framing distance and `panBounds` use the real beam, and reframe when the beam changes by more than 2.
6. **AttachMarkers and PartMesh:** verify davit outward directions with negative z (starboard = world +z).
7. **Tests:** coords with beam 3 and 7; Toolbar beam buttons and the disabled state; GridTargets anchor generation (extract it as a pure function `gridTargetAnchors(ship)` and test it).
8. **Browser check:** screenshots of a beam-7 ship with wings, a beam-3 ship with a centered funnel on the centre column, a bridge spanning between two towers, and a lifeboat on a wing block.

### T7: E2E, offline check, ship

**Files:** `playwright.config.ts`, `e2e/ship-builder.spec.ts`, `e2e/home.spec.ts`.

1. Add the Playwright project `{ name: "ipad", use: { ...devices["iPad Pro 11 landscape"] }, testMatch: /ship-builder/ }`.
2. **New e2e tests:**
   - long-press a placed block (mouse down 700 ms) → it's removed;
   - Wider → `beam-width` shows "5 wide", and stats tonnage goes up;
   - place a wing block via the store hook at z = −1, and the stats update;
   - the home `ships` command navigates to /ship-builder;
   - the footer link exists.
3. Run `npm run validate`, the e2e suite (chromium, webkit, ipad) and `node scripts/check-ship-builder-offline.mjs`.
4. Final whole-branch review, then fix anything blocking.
5. Push `main` to origin (the user authorised this) and watch CI and the deploy.
