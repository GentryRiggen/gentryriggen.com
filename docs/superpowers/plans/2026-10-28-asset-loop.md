# Asset Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A scored, repeatable loop for remaking Ship Builder and Plane Builder parts in Blender: script a part, export `.glb`, gate it, score it against reference images, and show the user a contact sheet at each check-in. Proven on the ship funnel through its first check-in.

**Architecture:** Each part has a JSON spec (dimensions, paint slots, budgets, camera views) and a Blender Python build script. A headless Blender runner builds every variant, exports `.glb`, runs pass/fail gates, renders the views, and scores them against masked reference images in about 5s. That's the inner loop. At a check-in, a dev-only Next route (`/asset-studio`) renders the old procedural part and the new `.glb` with the game's own lights and materials. A Node script screenshots both and composes a contact sheet PNG, which is opened for the user.

**Tech Stack:** Blender 5.2.3 (headless, bundled Python 3.13 + numpy 2.3), Next.js 16 / React 19 / R3F 9 / drei 10 (`useGLTF`), Playwright `chromium` (script, not test runner), Jest.

**Spec:** No separate spec. The user skipped brainstorming, and the agreed design is in the conversation, summarized in "Decisions" below.

## Decisions (from the conversation)

- Judge is Claude, in-session. The score steers between check-ins. Nothing goes into Ship Builder or Plane Builder without the user's 👍 on a contact sheet.
- Reference images are **local only, gitignored** (`assets/refs/**` except `manifest.json`). The manifest (file, source URL, view, crop, mask settings) is committed.
- Speed: the inner loop runs in Blender only, with no browser. The browser runs only at check-ins.
- Check-ins: after the framework works (the funnel's first sheet), whenever a part's score plateaus or hits the round cap, and before anything is wired into a game.
- Style: polished-stylized, not photoreal. Parts stay paintable through the game's `Surface` materials.
- Round cap: 8 rounds per check-in, or stop early when the score gains < 0.01 over 3 rounds.

## Global Constraints

- Blender binary: `$BLENDER`, default `/Applications/Blender.app/Contents/MacOS/Blender`. Always run `-b --factory-startup`.
- Blender is Z-up, glTF and three.js are Y-up. Export with the glTF exporter's default `export_yup=True`. Spec JSON and views are in **three.js coordinates** (Y-up; the funnel's aft is -X).
- Nothing in `components/ship-builder`, `lib/ship-builder`, `app/ship-builder`, `components/plane-builder`, `lib/plane-builder` or `app/plane-builder` changes in this plan. Those are read-only imports, so there's no release bump.
- `/asset-studio` must not exist in the production build: no `out/asset-studio*` after `npm run build`.
- Work-in-progress `.glb` files the studio serves go in `public/asset-studio/` (gitignored). The loop's own outputs go in `assets/out/` (gitignored).
- TS/TSX follows CLAUDE.md patterns (`export default function`, `interface` props, Prettier). Python: 4-space indent, type hints, no third-party packages beyond Blender's bundled numpy.

## Review Focus

- Reference with no mask (a photo): it must be skipped by the silhouette score and still shown on the sheet, not crash the run or count as IoU 0.
- A gate failure (wrong bounds, missing slot, over budget) must force the score to 0 and print _which_ gate failed, so a pretty model can't hide a broken fit.
- Reference aspect ratio differs from the game's fixed proportions: masks are compared after stretching both to a unit box, so the score measures shape, not proportions the game doesn't allow.
- `.glb` missing or failing to load in the studio: the check-in must report "load gate failed" on the sheet, not screenshot an empty canvas as if it passed.
- Prod build: the dev-only route must not leak into `out/`.

---

## File Structure

```
assets/
  README.md                 how to run the loop, round cap, check-in rules
  RUBRIC.md                 the judge checklist Claude fills in per check-in
  parts/funnel.json         part spec (variants, dims, expected bounds, slots, budgets, views, weights)
  __tests__/funnelSpec.test.ts   spec bounds == procedural geometry bounds
  refs/manifest.json        committed; images beside it are gitignored
  blender/
    lib/metrics.py          mask + score math (pure numpy)
    lib/gates.py            bounds / slots / triangles / bytes gates
    lib/render.py           camera from a view, silhouette + look renders
    parts/funnel.py         build(dims) -> {slot: bpy Object}
    score.py                the runner (entry point)
    tests/run.py            unittest entry: blender -b -P assets/blender/tests/run.py
    tests/test_metrics.py
    tests/test_gates.py
  out/                      gitignored: <part>/renders, score.json, history.jsonl
scripts/assets/
  blender.sh                resolves $BLENDER, runs it headless with args
  fetch-refs.mjs            downloads manifest entries missing locally
  checkin.mjs               studio screenshots + contact sheet + open
app/asset-studio/page.dev.tsx    dev-only route
components/asset-studio/
  AssetStudio.tsx           Canvas with the ship scene's lights and post effects
  studioParams.ts           parse ?part=&variant=&build=&view=
  __tests__/studioParams.test.ts
  studioParts.tsx           part id -> old (procedural) and new (glb) renderers
  GlbPart.tsx               loads a .glb, draws each slot mesh with Surface
next.config.ts              pageExtensions adds "dev.tsx" only in development
.gitignore, package.json    entries and scripts
```

---

### Task 1: Blender runner, metrics and gates (with tests)

**Files:**

- Create: `scripts/assets/blender.sh`, `assets/blender/lib/metrics.py`, `assets/blender/lib/gates.py`, `assets/blender/tests/run.py`, `assets/blender/tests/test_metrics.py`, `assets/blender/tests/test_gates.py`, `assets/README.md` (stub: purpose + commands; Task 5 completes it)
- Modify: `.gitignore` (add `/assets/out/`, `/assets/refs/*`, `!/assets/refs/manifest.json`, `/public/asset-studio/`), `package.json` (scripts below)

**Interfaces:**

- Produces (`metrics.py`, all arrays `numpy.ndarray`):
  - `normalize_mask(mask: ndarray[bool], size: int = 128) -> ndarray[bool]`: crop to the mask's bounding box, then resize (nearest) to `size x size`, a non-uniform stretch. An empty mask returns all-False.
  - `iou(a: ndarray[bool], b: ndarray[bool]) -> float`: 0.0 when both are empty.
  - `mask_from_rgba(rgba: ndarray[float], mode: str, threshold: float, invert: bool) -> ndarray[bool]`: `mode="alpha"` uses alpha > threshold. `mode="luma"` uses luminance (0.2126/0.7152/0.0722) < threshold, flipped when `invert`.
  - `edge_density(rgba: ndarray[float], mask: ndarray[bool]) -> float`: mean Sobel gradient magnitude of luminance inside `mask` (numpy only, no scipy).
  - `detail_score(render_density: float, ref_density: float) -> float`: `exp(-abs(ln(r/f)))`, and 0.0 when either is 0.
  - `composite(silhouette: float | None, detail: float | None, weights: dict[str, float]) -> float`: weighted mean over the terms that are not None, re-normalized. All None gives 0.0.
- Produces (`gates.py`): `GateResult = {"name": str, "ok": bool, "detail": str}` (a dict).
  - `bounds_gate(actual_min: list[float], actual_max: list[float], expected_min, expected_max, tolerance: float) -> GateResult`: each axis's extent and centre must be within `tolerance` x the expected extent on that axis.
  - `slots_gate(actual: set[str], required: list[str]) -> GateResult`: exact set equality, with the missing and extra names in `detail`.
  - `budget_gate(name: str, value: int, limit: int) -> GateResult`
- Produces `scripts/assets/blender.sh "$@"`, which runs `"${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --factory-startup "$@"` and exits with its status. Blender exits 0 even when a Python script raises, so every entry script calls `sys.exit(1)` on failure.
- Produces npm scripts: `"assets:test": "scripts/assets/blender.sh -P assets/blender/tests/run.py"`.

- [ ] **Step 1: Write the failing tests** (`unittest`, imported by `tests/run.py`, which adds `assets/blender` to `sys.path`, discovers `test_*.py`, and calls `sys.exit(0 if ok else 1)`)
  - `test_normalize_mask_is_offset_and_scale_invariant`: a 10x20 filled rect at (5,5) in a 64x64 image and a 30x60 rect at (0,2) in a 100x100 image normalize to identical masks.
  - `test_normalize_empty_mask`: all-False in, all-False `128x128` out.
  - `test_iou`: identical masks give 1.0, disjoint give 0.0, half-overlapping rects give 1/3, both empty give 0.0.
  - `test_mask_from_rgba_luma_invert`: a black shape on white with `mode="luma", threshold=0.5, invert=False` is True on the shape. Inverted, it's True on the background.
  - `test_edge_density_flat_is_zero`: a uniform image gives 0.0. A checkerboard inside the mask gives > 0.1.
  - `test_detail_score`: equal densities give 1.0, a 2x ratio gives 0.5 (either direction), and a zero density gives 0.0.
  - `test_composite_skips_none`: `composite(0.8, None, {"silhouette":0.6,"detail":0.4})` is 0.8, and all None is 0.0.
  - `test_bounds_gate`: exact passes. An extent off by 2% with tolerance 0.03 passes, off by 5% fails, and `detail` names the axis.
  - `test_slots_gate`: an exact set passes, and a missing `"pipe"` fails with `"missing: pipe"` in `detail`.
  - `test_budget_gate`: equal to the limit passes, limit + 1 fails.
- [ ] **Step 2: Run** `npm run assets:test`. Expected: FAIL (import errors).
- [ ] **Step 3: Implement** `metrics.py`, `gates.py`, `blender.sh` (`chmod +x`), the `.gitignore` entries and the npm script.
- [ ] **Step 4: Run** `npm run assets:test`. Expected: all tests pass, exit 0. Also check `scripts/assets/blender.sh --python-expr "import sys; sys.exit(3)"; echo $?` prints 3.
- [ ] **Step 5: Commit** `feat(assets): Blender runner with scoring metrics and gates`

### Task 2: Funnel spec, build script and score runner

**Files:**

- Create: `assets/parts/funnel.json`, `assets/__tests__/funnelSpec.test.ts`, `assets/blender/lib/render.py`, `assets/blender/parts/funnel.py`, `assets/blender/score.py`, `assets/refs/manifest.json` (`{"funnel": []}`)
- Modify: `package.json` (`"assets:score": "scripts/assets/blender.sh -P assets/blender/score.py --"`)

**Interfaces:**

- Consumes: Task 1's `metrics`, `gates`, `blender.sh`.
- Produces `assets/parts/funnel.json` (shape shared by every future part):
  ```json
  {
    "id": "funnel",
    "script": "funnel",
    "slots": ["body", "bands", "cap", "opening", "pipe"],
    "budget": { "maxTriangles": 4000, "maxBytes": 200000 },
    "boundsTolerance": 0.03,
    "weights": { "silhouette": 0.6, "detail": 0.4 },
    "variants": [
      {
        "name": "funnel",
        "dims": {
          "baseRadius": 0.42,
          "topRadius": 0.38,
          "bodyHeight": 2.6,
          "capHeight": 0.6
        },
        "expectedBounds": { "min": [0, 0, 0], "max": [0, 0, 0] }
      },
      {
        "name": "funnel-large",
        "dims": {
          "baseRadius": 0.71,
          "topRadius": 0.65,
          "bodyHeight": 3.4,
          "capHeight": 0.8
        },
        "expectedBounds": { "min": [0, 0, 0], "max": [0, 0, 0] }
      }
    ],
    "views": [
      { "name": "side", "azimuthDeg": 90, "elevationDeg": 0, "ortho": true },
      { "name": "front", "azimuthDeg": 0, "elevationDeg": 0, "ortho": true },
      {
        "name": "three-quarter",
        "azimuthDeg": 35,
        "elevationDeg": 20,
        "ortho": false
      }
    ],
    "scoreVariant": "funnel"
  }
  ```
  `expectedBounds` placeholders get filled with the real numbers in Step 3. Bounds are in the **un-raked** local frame (origin at body base centre, Y up), because the rake is a group rotation in `FunnelMesh.tsx` that the game keeps applying. Azimuth 0 looks from +Z toward the origin and 90 looks from +X. Views frame the variant's expected bounds with 10% margin.
- Produces `funnel.py`: `build(dims: dict) -> dict[str, bpy.types.Object]`, one object per slot, each named and with a material named exactly as its slot. Round 0 is a faithful Blender port of `components/ship-builder/scene/funnelGeometry.ts` plus the body cylinder in `FunnelMesh.tsx` (same radii, heights, band drops 0.3/0.52 x 0.1 tall, rim tube 0.03, pipe on -X), so the first score is the baseline.
- Produces `render.py`:
  - `place_camera(view: dict, bounds_min, bounds_max) -> bpy Object` (three.js coords converted to Blender Z-up)
  - `render_silhouette(path: str, res: int = 256)`: Workbench engine, flat, transparent film. The alpha channel is the mask.
  - `render_look(path: str, res: int = 512)`: EEVEE, a three-point light rig, a neutral grey world.
- Produces `score.py` CLI: `npm run assets:score -- <part> [--round-note "text"]`:
  1. Load the spec and `parts/<script>.py`, and clear the scene per variant.
  2. Per variant: `build`, export `assets/out/<part>/<variant>.glb` (`use_selection`, `export_apply=True`, materials exported), compute world bounds and the triangle count from evaluated meshes, read the `.glb` size, and run the gates (bounds, slots, triangles, bytes).
  3. For `scoreVariant`: render each view's silhouette and look into `assets/out/<part>/renders/<view>-{sil,look}.png`.
  4. Per manifest entry for the part with `view` and `mask` set: load the image (`bpy.data.images.load`, pixels to numpy, flip rows), apply `crop` `[x,y,w,h]` in pixels if present, `mask_from_rgba`, normalize both masks, `iou`, and `detail_score` from `edge_density` of the ref vs the look render. Entries with `mask: null` are skipped for scoring.
  5. Silhouette and detail are each the mean over the scored refs, or None when there are none. Total = `composite(...)`, forced to 0.0 if any gate failed.
  6. Write `assets/out/<part>/score.json` (`{round, total, silhouette, detail, gates: [...], perRef: [...], triangles, bytes, note}`), append one line to `history.jsonl` (`round` = previous + 1), and print one summary line: `funnel r3 total=0.712 sil=0.801 det=0.578 gates=OK (tris 2140/4000)`, or `gates=FAIL bounds[funnel-large]: y extent 4.10 vs 4.25`.
  7. Exit 1 on an exception, 0 otherwise (a gate failure is a result, not a crash).

- [ ] **Step 1: Write the failing Jest test** `assets/__tests__/funnelSpec.test.ts`: for each spec variant, build the procedural parts in three.js (`new CylinderGeometry(topRadius, baseRadius, bodyHeight, 16)` translated up `bodyHeight/2`, plus `buildFunnelBands`, `buildFunnelCap`, `buildFunnelOpening`, `buildSteamPipe` from `@/components/ship-builder/scene/funnelGeometry`), union their `boundingBox`es, and `expect` each of `expectedBounds.min/max` `toBeCloseTo(actual, 3)`. Note in a comment that the dims are copied from `PartMesh.tsx`'s `funnel` and `funnel-large` cases.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=funnelSpec`. Expected: FAIL (the placeholder zeros).
- [ ] **Step 3: Fill in** `expectedBounds` with the numbers the failing test printed. Re-run: PASS.
- [ ] **Step 4: Implement** `render.py`, `funnel.py`, `score.py` and the npm script.
- [ ] **Step 5: Run** `npm run assets:score -- funnel`. Expected: exit 0 and a summary line with `gates=OK` (a faithful port must pass its own bounds), `sil=` and `det=` shown as `n/a` (empty manifest), and three `*-sil.png` and three `*-look.png` plus two `.glb` files in `assets/out/funnel/`. Wall time under 15s (`time` it, record it in the README).
- [ ] **Step 6: Gate failure check.** Temporarily set the large variant's `bodyHeight` to 3.0 in a copy of the spec passed via `--spec /tmp-scratch-path.json` (add the `--spec` override flag). Expected: `gates=FAIL bounds[funnel-large] ...` and `total=0.000`.
- [ ] **Step 7: Commit** `feat(assets): funnel spec, Blender build script and score runner`

### Task 3: Dev-only asset studio route

**Files:**

- Modify: `next.config.ts`
- Create: `app/asset-studio/page.dev.tsx`, `components/asset-studio/AssetStudio.tsx`, `components/asset-studio/studioParams.ts`, `components/asset-studio/__tests__/studioParams.test.ts`, `components/asset-studio/studioParts.tsx`, `components/asset-studio/GlbPart.tsx`

**Interfaces:**

- Consumes: `assets/parts/funnel.json` (imported as JSON), `FunnelMesh`, `Surface`, `PALETTE`, `FUNNEL_RAKE_RADIANS`, `Environment`, `ReflectionEnvironment`, `PostEffects`, `environmentFor`, `toRuntimeEnvironment`, `createGlowController`, `glowFor` from `components/ship-builder/scene/` (read-only).
- `next.config.ts`: `pageExtensions: process.env.NODE_ENV === "development" ? ["dev.tsx", "tsx", "ts", "jsx", "js"] : ["tsx", "ts", "jsx", "js"]`. Read `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/pageExtensions.md` first.
- Produces `studioParams.ts`: `parseStudioParams(search: string) -> StudioParams | { error: string }`, with `interface StudioParams { part: string; variant: string; build: "old" | "new"; view: string; time: "Day" | "Sunset" | "Night" }`. `time` defaults to `"Day"`. Unknown part, variant or view (checked against the part spec registry) returns `{ error }`.
- Produces `studioParts.tsx`: `STUDIO_PARTS: Record<string, { spec: PartSpec; Old: (props: { variant: string }) => JSX.Element; glbPath: (variant: string) => string }>`. Funnel: `Old` renders `<FunnelMesh>` with the variant's dims and default colours (`tint={null} emphasis={null}`), and `glbPath` gives `/asset-studio/funnel/<variant>.glb`. `New` is generic: `<GlbPart url={glbPath(variant)} slotColors={...} rakeRadians={FUNNEL_RAKE_RADIANS} />`, with slot colours matching `FunnelMesh` defaults (body `PALETTE.funnel`, bands `PALETTE.funnelBand`, cap `PALETTE.funnelTop`, opening `#050505`, pipe `#b08d57` metal).
- Produces `GlbPart.tsx` (`"use client"`): `useGLTF(url)`, traverses meshes, and renders each as `<mesh geometry=... castShadow><Surface color={slotColors[name]} .../></mesh>`, keyed by mesh or material name. An unknown slot name throws (it surfaces in the console, which the load gate reads).
- Produces `AssetStudio.tsx` (`"use client"`): a full-viewport `<Canvas shadows="percentage" gl={{ preserveDrawingBuffer: true }}>` with the same lights and post effects as `Scene.tsx` (Environment, ReflectionEnvironment, PostEffects; no ocean or ship store). The camera is placed from the view exactly as `render.py` does (same azimuth/elevation/margin rule; `OrthographicCamera` when `ortho`). The part sits at the origin with transparent-free solid sky. It sets `document.body.dataset.studioReady = "1"` after the first frame with the model loaded, and `data-studio-error` with the message on a load error (error boundary around `Suspense`). If `Environment` or `PostEffects` turns out to need the ship store, wrap it in that store's default state rather than editing ship-builder code, and say so in the commit body.
- `page.dev.tsx`: a client page reading `window.location.search` and rendering `<AssetStudio>` or the error text.

- [ ] **Step 1: Write the failing test** `studioParams.test.ts`: `parseStudioParams("?part=funnel&variant=funnel-large&build=new&view=side")` equals `{ part:"funnel", variant:"funnel-large", build:"new", view:"side", time:"Day" }`. `part=nope` gives `{ error: expect.stringContaining("nope") }`, `view=top` gives an error, and `build=mid` gives an error.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=studioParams`. Expected: FAIL.
- [ ] **Step 3: Implement** the config change and the studio files.
- [ ] **Step 4: Run** the test (PASS), `npm run type-check`, `npm run lint`.
- [ ] **Step 5: Manual check:** copy `assets/out/funnel/*.glb` to `public/asset-studio/funnel/`, run `npm run dev`, and open `/asset-studio?part=funnel&variant=funnel&build=old&view=three-quarter` and the same with `build=new`. Both show a lit funnel, raked, with no console errors. `build=new` with the glb deleted sets `data-studio-error`.
- [ ] **Step 6: Commit** `feat(assets): dev-only asset studio route for in-game renders`

### Task 4: Check-in script and contact sheet

**Files:**

- Create: `scripts/assets/checkin.mjs`, `scripts/assets/fetch-refs.mjs`, `assets/RUBRIC.md`
- Modify: `package.json` (`"assets:refs": "node scripts/assets/fetch-refs.mjs"`, `"assets:checkin": "node scripts/assets/checkin.mjs"`), `assets/README.md` (complete it)

**Interfaces:**

- Consumes: `score.py` outputs (`score.json`, renders, `.glb`), studio URL params (Task 3), `assets/refs/manifest.json`.
- `fetch-refs.mjs [part]`: for each manifest entry whose `file` is missing under `assets/refs/<part>/`, `fetch(url)` with a browser-like `User-Agent` and write the file. Print `fetched N, kept M, failed K` and list the failures. Never overwrite existing files.
- `checkin.mjs <part> [--base http://localhost:3000]`, modelled on `scripts/ship-builder-shots.mjs`:
  1. Run `npm run assets:score -- <part>` (inherit stdio) and stop on a non-zero exit.
  2. Copy `assets/out/<part>/*.glb` to `public/asset-studio/<part>/`.
  3. Use the dev server at `--base` if it answers. Otherwise spawn `npx next dev -p 3123` and wait for it.
  4. Launch `chromium` with the visual tests' SwiftShader flags, viewport 512x512. For `scoreVariant` and each view, load `old` and `new`, wait for `data-studio-ready` or `data-studio-error` (30s), and screenshot to `assets/out/<part>/checkin/<view>-<build>.png`. Collect console errors per page. The **load gate** fails if any `new` page errors or times out.
  5. Write `assets/out/<part>/checkin/sheet.html`: one row per view with columns **reference** (first manifest image for that view, or "no ref"), **old (in game)**, **new (Blender)** (`*-look.png`), **new (in game)**. Below that, a footer with round, total/sil/det (and the change from the previous `history.jsonl` line), every gate with ✓/✗ plus the load gate, triangles and bytes, and the contents of `assets/out/<part>/judge.md` if present. Use plain inline CSS (a scratch file, not site code) and `file://` image paths.
  6. Screenshot `sheet.html` full-page to `assets/out/<part>/checkin/sheet.png`, `open` it (macOS), and print its absolute path.
  7. Kill a server it spawned. Exit 1 if the load gate failed.
- `RUBRIC.md`: the judge checklist, five lines scored 1–5: proportions vs refs, silhouette details (rim, bands, pipe, base), surface detail (bevels, seams, rivets), finish and style fit next to neighbouring procedural parts, and reads well at game camera distance. Claude writes `judge.md` from it before each check-in.
- README: commands, the loop (score → edit `parts/<part>.py` → score; max 8 rounds or < 0.01 gain over 3 rounds; then `judge.md` + `assets:checkin` and wait for the user), how to add a part (spec JSON + build script + `STUDIO_PARTS` entry + bounds Jest test), and the measured timings.

- [ ] **Step 1: Implement** both scripts and the docs. These are I/O-only scripts covered by Step 2's run instead of unit tests.
- [ ] **Step 2: Run** `npm run assets:checkin -- funnel` with no dev server running. Expected: score line printed, server spawned, six screenshots, `sheet.png` opens showing three rows, "no ref" in the reference column, the load gate ✓, and exit 0. Then delete `public/asset-studio/funnel/funnel.glb` and break the copy step (temporary edit). Expected: load gate ✗ and exit 1. Revert.
- [ ] **Step 3: Run** `npm run build` and check that `ls out | grep -i asset-studio` prints nothing. Run `npm run lint && npm run format:check && npm run type-check && npm test`. All pass.
- [ ] **Step 4: Commit** `feat(assets): check-in script with contact sheet`

### Task 5: First funnel check-in (controller, not a subagent)

- [ ] **Step 1:** Web-search references: liner funnel photos (Titanic and Olympic-class, Queen Mary, Normandie, SS United States) and side-elevation drawings or blueprints with plain backgrounds. Add 6–10 entries to `manifest.json` with `view`, `crop` and `mask` for drawings (`mode:"luma"`), and `mask:null` for photos. Run `npm run assets:refs -- funnel`.
- [ ] **Step 2:** Run `npm run assets:score -- funnel --round-note "r0 baseline port"`. Record the baseline score.
- [ ] **Step 3:** Up to 8 improvement rounds on `parts/funnel.py` (flared base and skirt, rolled rim, band seams, rivet lines, bevels, smooth shading, a proper whistle and pipe brackets), scoring each round and keeping the gates green.
- [ ] **Step 4:** Write `assets/out/funnel/judge.md` from `RUBRIC.md`, then run `npm run assets:checkin -- funnel`, show the user `sheet.png` (absolute path) with the score history, and **stop for their 👍 or notes**.
- [ ] **Step 5:** Commit the improved `funnel.py` and manifest: `feat(assets): funnel round N`. Wiring the funnel into Ship Builder is a separate plan, after the 👍.
