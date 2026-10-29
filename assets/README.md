# Asset loop

Remakes 3D game parts (Ship Builder / Plane Builder) in headless Blender and
scores them against reference images.

## Commands

- `npm run assets:test` runs the Blender-side unit tests (Blender's bundled Python).
- `scripts/assets/blender.sh <args>` runs Blender headless (`$BLENDER` overrides the binary).
- `npm run assets:score -- <part> [--round-note "text"] [--spec path]` builds a part, gates it, renders it and scores it against `assets/refs/manifest.json`. Output goes to `assets/out/<part>/`. Funnel wall time with an empty manifest: about 2-3s (Blender 5.2.3, Apple silicon).
- `npm run assets:score -- <part> --blocker "text"` (repeatable) records what slowed the round. A run with `--spec path` writes to `assets/out/<part>/override/` and never touches the real score log.
- `npm run assets:refs [-- <part>]` downloads manifest references that are missing under `assets/refs/<part>/` (never overwrites). Prints `fetched N, kept M, failed K`.
- `npm run assets:checkin -- <part> [--base url] [score args]` scores the part, screenshots the old and new part in the game's lighting (via the dev-only `/asset-studio` route, which draws the part through the game's own `PartMesh`) and builds `assets/out/<spec>/checkin/sheet.png`, then opens it. A part id is a spec id or one of its variants (`funnel-large`). It starts its own `next dev` (see Ports and worktrees) unless `--base` names a running server. Exits 1 if any new part fails to load (error, timeout, console error, or a model that fell back to the procedural mesh). `--skip-score` reuses the existing `score.json` and glbs; `--keep-glb` leaves `public/asset-studio/<spec>/` in place (otherwise it is removed, so a local build never ships WIP glbs). Score args such as `--round-note` and `--blocker` pass through.
- `npm run assets:checkin -- <id> <id> ...` (several parts, or a non-scoring variant) builds ONE family sheet, a row per part, at `assets/out/_family/<first-id>-<n>.png`. Columns: refs (up to 3 crops with masks), old in game, new in Blender, new in game (all three-quarter), and a score cell (total, sil, det, tris, a check or cross per gate, load gate). Each spec is scored once; a variant that is not the spec's `scoreVariant` shows the spec's total and gets its own Blender look render (`renders/variant-<name>-look.png`).
- `npm run assets:measure -- <part-id...> | --all` loads the studio's old (procedural) build per part and reads its bounding box, then updates `expectedBounds` in `assets/parts/<spec>.json`, or writes a skeleton spec for a new part: id, script name, one variant, three default views, budget, tolerance, weights, `slots` and `slotColors` derived from the old mesh's `Surface` paints (one per colour and finish, named after the palette key or `paint-<hex>`), and a `todo` list for what only the modeller can fill in. Bounds are in the part's local frame: origin at the part's anchor (a fitting's attach point; a grid block's footprint centre on its level's floor), world axes (Y up, bow toward +X, starboard toward +Z), before transforms the game applies outside the mesh code (a funnel's rake is turned back out via the spec's `rakeRadians`). Spinning sub-parts are read at the studio's settle frame; wires to other masts and bridge-wide lights depend on the studio ship, so those specs carry a todo. It also regenerates `assets/parts/index.ts` (the studio's list of specs). Existing specs only have the bounds touched, and only when they moved.
- `npm run assets:ship -- <part> [score args]` scores the part and, when every gate passes, copies its variant glbs to `public/ship-builder/models/<part>/<variant>.glb` (committed; the game loads them). Exits 1 if the score run or any gate fails. `assets/__tests__/shippedModels.test.ts` checks each committed glb's slot names and bounds against the spec, so re-run this after changing a part's build script. The test covers every spec that has a shipped directory.

`assets/out/` holds `score.json`, `history.jsonl` (one line per round: scores, `timestamp`, `runSeconds`, `sinceLastSeconds`, `blockers`), the `.glb` files, renders, and optional hand-written `judge.md` and `process.md` (shown on the sheet).

## Scoring

- **Fresh clone:** reference images are not committed. Start the loop with `npm run assets:refs -- <part>`; scoring stops with a "missing ref" error until they are downloaded.
- **Silhouette:** IoU of the normalised masks. A reference may be a photo from either side of the ship, so a mirrored reference scores as well as the original.
- **Detail:** mean edge strength measured on the mask's bounding box scaled to 128px tall, with the mask hole-filled and eroded by 2px so the part-versus-background edge never counts, only interior surface detail. `score.json` records `renderDensity` and `refDensity` per reference, so you can tell whether the render needs more or less detail.
- **Masks:** photos with clear sky can be luma-masked (with a `crop`), but drawings and renders on plain backgrounds mask best.
- **Scorer versions:** `SCORER_VERSION` (in `lib/scoring.py`) is recorded on every history line. When it changes, the next run moves `history.jsonl` to `assets/out/<part>/archive/history-v<old>-<timestamp>.jsonl` and restarts at round 1; the sheet heading reads "round N (scorer vN)". Bump it whenever a scoring change makes old scores incomparable.
- **Flags:** `--blocker "text"` (repeatable) records what slowed the round; `--skip-score` and `--keep-glb` are check-in flags (see Commands).

## The loop

0. On a fresh clone, `npm run assets:refs -- <part>`.
1. `npm run assets:score -- <part> --round-note "what changed"`.
2. Edit `assets/blender/parts/<part>.py`, score again.
3. Stop after 8 rounds, or when the last 3 rounds gained less than 0.01.
4. Write `judge.md` from `assets/RUBRIC.md`, run `npm run assets:checkin -- <part>`, and wait for the user to approve the sheet.
5. Once approved, `npm run assets:ship -- <part>` and commit the glbs.

## Adding a part

1. `npm run assets:measure -- <id>` writes `assets/parts/<id>.json` (bounds, default views, derived slots, todo list). Rename or merge the slots, fill `variants[].dims` if the size comes from props, and clear the todos.
2. Add references to `assets/refs/manifest.json` (each entry: `file`, `url`, `license`, `view`, `crop`, `mask`), then `npm run assets:refs -- <id>`.
3. Write `assets/blender/parts/<id>.py` exposing `build(dims)` from the shapes library (below); one object per slot, named by slot.
4. Loop: `npm run assets:score -- <id> --round-note "..."`, then `npm run assets:checkin -- <id>` (or the whole family) and get the sheet approved.
5. `npm run assets:ship -- <id>` and commit the glbs.
6. Add one entry to `GLB_PARTS` in `components/ship-builder/scene/glbRegistry.tsx` (below). A part with no entry keeps its procedural mesh.

### The in-game registry

`GLB_PARTS` maps a Ship Builder part id to `{ model, variant, rakeRadians?, slots(context), subParts?(context) }`: draw `public/ship-builder/models/<model>/<variant>.glb` (variant is the part id for a single-variant part), `slots` gives each slot's colour, finish, `castShadow` and `aoOccluder` from the part's paint, and the procedural mesh is the fallback while the file loads or if it fails. `PartMesh` wraps every part in `GlbRegistryPart`, so ghosts, tints, emphasis, shadows and the baked-AO vertex colours work with no per-part code.

Procedural sub-parts: anything the glb does not hold because it moves or varies at run time (a propeller's spin group, a flag, wires to another mast, glow lights, funnel decals fitted to the surface) goes in `subParts(context)`. It returns JSX drawn with the loaded model, inside the entry's rake; while the fallback shows, the fallback (the whole procedural part) draws them instead. Draw them with `Surface` and the tint and emphasis from the part so ghosts still work. For example, a propeller entry draws the hub and blades from the glb's slots and returns `<Spinner>`-wrapped geometry only if the spin group stays procedural; the funnel entry's `subParts` returns its mark decals.

### The asset studio

`/asset-studio?part=<id>&variant=&build=old|new&view=&time=` (dev only) builds a minimal ship and candidate for any part (`studioShip.ts` adds scaffold parts as needed, such as a deck under a funnel or two masts under a wire) and draws it through `PartMesh`. `build=old` forces the procedural look; `build=new` draws the work-in-progress glb through the part's registry entry (or one built from the spec's `slotColors`). `variant` defaults to the spec's scoring variant, or the part id; `view` defaults to `three-quarter`. The page publishes `data-studio-ready`, `data-studio-error`, `data-studio-bounds` and `data-studio-slots` on `<body>`.

### Shapes library

`assets/blender/lib/shapes.py`, all numpy, in three.js coordinates (Y up) unless noted. See the module docstrings for arguments.

- `lathe(profile, seg)`: revolve (radius, y) points about Y into a capped solid.
- `round_hoop(...)`: a lathe profile for a half-round hoop standing proud of a tapered wall (rims, bands).
- `cylinder(...)`: capped cylinder about Y, optionally tilted about Z.
- `disc(radius, y, seg)`: a flat fan facing +Y.
- `box(cx, cy, cz, sx, sy, sz)`: axis-aligned box.
- `rounded_box(...)`: a box with every edge and corner bevelled (cabins, hulls of small boats).
- `loft(...)`: skin closed 2D profiles placed along an axis (a hull cross-section changing along its length).
- `extrude(...)`: push one closed 2D profile straight along an axis.
- `tube(...)`: a round tube through a polyline (rails, pipes, stays, wires).
- `array_line(mesh, count, step)` and `array_circle(mesh, count, start)`: repeat a mesh along a line or around +Y.
- `merge(parts)`, `translate(mesh, dx, dy, dz)`, `rotate_y(mesh, angle)`: combine and move meshes.
- `signed_volume(mesh)`, `outward(mesh)`: check and fix winding of a closed mesh.
- `make_object(...)`: link a smooth-shaded painted object named by its slot into the scene (the only helper that touches Blender).
- `linear`, `hex_linear`, `srgb_to_linear`, `three_to_blender`: colour and frame conversion (three Y-up to Blender Z-up).
- Baked ambient occlusion (`lib/ao.py`) runs for every part automatically; tune or disable it per slot with an `ao` block in the spec.

## Ports and worktrees

Checkout-safe by design:

- Dev servers: `checkin` and `measure` take their port from `ASSETS_PORT`, else a free one is picked; nothing assumes 3123 or 3000. A server is reused only when you pass `--base <url>` (or set `ASSETS_BASE`).
- They stop only the server they spawned (its own process group); nothing uses `pkill`.
- If `node_modules` is a symlink (a worktree), Next starts with `--webpack`, because Turbopack refuses to follow it. This is detected automatically (`scripts/assets/devServer.mjs`).
- `scripts/assets/worktree.sh <name>` creates `.claude/worktrees/<name>` (gitignored) on a new branch `assets/<name>` from HEAD, symlinks `node_modules` and the downloaded `assets/refs/<part>/` folders from the main checkout, and prints how to run there. Remove it with `git worktree remove --force .claude/worktrees/<name> && git branch -D assets/<name>`.

### Parallel modelling

Two different parts can score at the same time. Everything a run writes is under `assets/out/<id>/`, Blender runs with `--factory-startup` (no shared preferences) and renders and exports to explicit paths, so nothing else is shared: no temp files, no global state. Two runs of the same part collide on `assets/out/<id>/`. Check-ins in the same checkout share `public/asset-studio/<spec>/` and one `.next`, so run them one at a time per checkout, or give each its own worktree (and port).

## Baked ambient occlusion

`score.py` bakes Cycles AO into a vertex colour attribute on every slot
(`lib/ao.py`); the glb export writes it as `COLOR_0` and the game multiplies
the slot's paint by it. It needs nothing in the part script. Tune it with an
optional `ao` block in the spec:

```json
"ao": { "strength": 0.7, "distance": 0.4, "samples": 128, "ground": true,
        "slots": { "opening": 0 } }
```

- `strength`: how dark the darkest corners get (0 off, 1 the raw bake).
- `distance`: metres a surface looks for something shading it.
- `samples`: Cycles samples per vertex (keep the bake under ~10s).
- `ground`: a deck plane at y = 0 is added while baking, so parts that stand
  on the deck darken at their foot. Set `false` for parts that hang off the
  hull or sit below the deck.
- `slots`: per-slot strength. A slot at 0 gets no `COLOR_0` and draws flat.

## Timings (Blender 5.2.3, Apple silicon)

- Score run, funnel, empty manifest: about 1-3s.
- Check-in with no dev server running: about 20s, most of it the first Next compile.
