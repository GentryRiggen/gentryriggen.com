# Asset loop

Remakes 3D game parts (Ship Builder / Plane Builder) in headless Blender and
scores them against reference images. Task 5 completes this document.

## Commands

- `npm run assets:test` runs the Blender-side unit tests (Blender's bundled Python).
- `scripts/assets/blender.sh <args>` runs Blender headless (`$BLENDER` overrides the binary).
