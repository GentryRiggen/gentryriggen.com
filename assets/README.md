# Asset loop

Remakes 3D game parts (Ship Builder / Plane Builder) in headless Blender and
scores them against reference images. Task 5 completes this document.

## Commands

- `npm run assets:test` runs the Blender-side unit tests (Blender's bundled Python).
- `scripts/assets/blender.sh <args>` runs Blender headless (`$BLENDER` overrides the binary).
- `npm run assets:score -- <part> [--round-note "text"] [--spec path]` builds a part, gates it, renders it and scores it against `assets/refs/manifest.json`. Output goes to `assets/out/<part>/`. Funnel wall time with an empty manifest: about 2-3s (Blender 5.2.3, Apple silicon).
