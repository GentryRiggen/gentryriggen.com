# Asset loop

Remakes 3D game parts (Ship Builder / Plane Builder) in headless Blender and
scores them against reference images.

## Commands

- `npm run assets:test` runs the Blender-side unit tests (Blender's bundled Python).
- `scripts/assets/blender.sh <args>` runs Blender headless (`$BLENDER` overrides the binary).
- `npm run assets:score -- <part> [--round-note "text"] [--spec path]` builds a part, gates it, renders it and scores it against `assets/refs/manifest.json`. Output goes to `assets/out/<part>/`. Funnel wall time with an empty manifest: about 2-3s (Blender 5.2.3, Apple silicon).
- `npm run assets:score -- <part> --blocker "text"` (repeatable) records what slowed the round. A run with `--spec path` writes to `assets/out/<part>/override/` and never touches the real score log.
- `npm run assets:refs [-- <part>]` downloads manifest references that are missing under `assets/refs/<part>/` (never overwrites). Prints `fetched N, kept M, failed K`.
- `npm run assets:checkin -- <part> [--base url] [score args]` scores the part, screenshots the old and new part in the game's lighting (via the dev-only `/asset-studio` route) and builds `assets/out/<part>/checkin/sheet.png`, then opens it. It reuses a dev server at `--base` (default `http://localhost:3000`), otherwise starts `next dev -p 3123` and stops it afterwards. Exits 1 if any new part fails to load.

`assets/out/` holds `score.json`, `history.jsonl` (one line per round: scores, `timestamp`, `runSeconds`, `sinceLastSeconds`, `blockers`), the `.glb` files, renders, and optional hand-written `judge.md` and `process.md` (shown on the sheet).

## The loop

1. `npm run assets:score -- <part> --round-note "what changed"`.
2. Edit `assets/blender/parts/<part>.py`, score again.
3. Stop after 8 rounds, or when the last 3 rounds gained less than 0.01.
4. Write `judge.md` from `assets/RUBRIC.md`, run `npm run assets:checkin -- <part>`, and wait for the user to approve the sheet.

## Adding a part

1. A spec `assets/parts/<part>.json` (variants, expected bounds, slots, views, budget, weights, `scoreVariant`).
2. A build script `assets/blender/parts/<script>.py` exposing `build(dims)`.
3. An entry in `STUDIO_PARTS` (`components/asset-studio/studioParts.tsx`) for the old and new renderers.
4. A bounds Jest test next to the existing ones in `assets/__tests__/`.
5. References in `assets/refs/manifest.json` (each entry: `file`, `url`, `license`, `view`, `crop`, `mask`).

## Timings (Blender 5.2.3, Apple silicon)

- Score run, funnel, empty manifest: about 1-3s.
- Check-in with no dev server running: about 20s, most of it the first Next compile.
