# Asset loop

Remakes 3D game parts (Ship Builder / Plane Builder) in headless Blender and
scores them against reference images.

## Commands

- `npm run assets:test` runs the Blender-side unit tests (Blender's bundled Python).
- `scripts/assets/blender.sh <args>` runs Blender headless (`$BLENDER` overrides the binary).
- `npm run assets:score -- <part> [--round-note "text"] [--spec path]` builds a part, gates it, renders it and scores it against `assets/refs/manifest.json`. Output goes to `assets/out/<part>/`. Funnel wall time with an empty manifest: about 2-3s (Blender 5.2.3, Apple silicon).
- `npm run assets:score -- <part> --blocker "text"` (repeatable) records what slowed the round. A run with `--spec path` writes to `assets/out/<part>/override/` and never touches the real score log.
- `npm run assets:refs [-- <part>]` downloads manifest references that are missing under `assets/refs/<part>/` (never overwrites). Prints `fetched N, kept M, failed K`.
- `npm run assets:checkin -- <part> [--base url] [score args]` scores the part, screenshots the old and new part in the game's lighting (via the dev-only `/asset-studio` route) and builds `assets/out/<part>/checkin/sheet.png`, then opens it. It reuses a dev server at `--base` (default `http://localhost:3000`), otherwise starts `next dev -p 3123` and stops it afterwards. Exits 1 if any new part fails to load. `--skip-score` reuses the existing `score.json` and glbs; `--keep-glb` leaves `public/asset-studio/<part>/` in place (otherwise it is removed, so a local build never ships WIP glbs). Score args such as `--round-note` and `--blocker` pass through. The reference cell of each view shows every reference for that view (crop, mask thumbnail, file name), and a "general refs" row shows the `view: null` ones.
- `npm run assets:ship -- <part> [score args]` scores the part and, when every gate passes, copies its variant glbs to `public/ship-builder/models/<part>/<variant>.glb` (committed; the game loads them). Exits 1 if the score run or any gate fails. `assets/__tests__/shippedModels.test.ts` checks each committed glb's slot names and bounds against the spec, so re-run this after changing a part's build script.

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

1. A spec `assets/parts/<part>.json` (variants, expected bounds, slots, views, budget, weights, `scoreVariant`).
2. A build script `assets/blender/parts/<script>.py` exposing `build(dims)`.
3. An entry in `STUDIO_PARTS` (`components/asset-studio/studioParts.tsx`) for the old and new renderers.
4. A bounds Jest test next to the existing ones in `assets/__tests__/`.
5. References in `assets/refs/manifest.json` (each entry: `file`, `url`, `license`, `view`, `crop`, `mask`).

## Timings (Blender 5.2.3, Apple silicon)

- Score run, funnel, empty manifest: about 1-3s.
- Check-in with no dev server running: about 20s, most of it the first Next compile.
