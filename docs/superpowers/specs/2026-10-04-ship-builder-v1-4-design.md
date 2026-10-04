# Ship Builder v1.4 — Design

**Date:** 2026-10-04
**Status:** Approved

## Paint

- 12 preset colours, `PAINT_COLORS` in `lib/ship-builder/model/paint.ts`:
  buff, black, white, red, navy, sky, green, yellow, orange, pink, purple,
  grey. Each has an id, a display name and a hex value.
- `PlacedPart.color?: PaintColor` and
  `Hull.paint?: { topsides?: PaintColor; bottom?: PaintColor }`. Absent means
  the default look.
- Save format v5. `MIGRATIONS[4]` only bumps the version: no data changes.
  The bump makes older builds treat v5 saves as unreadable (and back them up)
  instead of silently dropping colours on their next autosave.
- Store: tool `{ kind: "paint", color }`. Painting a part or a hull area sets
  its colour; painting it with the colour it already has resets it to the
  default. Undoable. Esc leaves the tool.
- Each part has one main surface that takes the colour:
  - blocks: the superstructure (windows and the cabin stripe stay)
  - funnels: the body (the black top and band stay)
  - masts, davits, lifeboat hulls, propellers, rudders: the whole part
- The hull has two areas: topsides (the black band) and bottom (the red
  antifouling). The deck stays wood. Each hull area takes a tap only in paint
  mode.
- UI: a paintbrush button in the toolbar ("Paint") enters paint mode and shows
  a swatch bar above the canvas: 12 round swatches of at least 44 px, each with
  an aria-label of its colour name, plus a close button. The placement hint
  reads "Painting · tap a part or the hull".

## Version

- `SHIP_BUILDER_VERSION` in `lib/ship-builder/version.ts`, set to `"1.4.0"`.
  It is bumped by hand.
- Shown as small muted text beside the "Ship Builder" title.
