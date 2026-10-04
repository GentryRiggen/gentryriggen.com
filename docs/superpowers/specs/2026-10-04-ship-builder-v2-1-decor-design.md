# Ship Builder v2.1 — Decorative parts (Phase 3)

**Date:** 2026-10-04
**Status:** Approved

New category `decor` ("Decorations"), listed after the existing categories
except Propulsion, which stays last. Kinds: shared unless marked _liner_.

## Deck items (grid, wave A)

- New grid role `decor`: 1×1, may be rotated, sits on the open main deck
  (level 0, inside the hull) or on top of a deck-role block. It needs a part
  (or the main deck) **directly** below it: no overhangs or wings. Nothing
  builds on it, and it exposes no attach points. It doesn't count as support
  for neighbours.
- `deckchair`, `bench`, `deck-lamp`: shared, decor role, small meshes that
  fill a fraction of the cell. Mass 0.05.
- `ventilator` (_liner_): decor role, the curved cowl air scoop, turned by
  rotation.
- `stairs`: decor role with one extra rule. The cell it faces (per rotation)
  must hold a deck or cabin block at the same level, so the stairs climb up
  against it to that block's top. Mesh: a flight of steps rising from the
  stairs' level to the next, with a handrail. The rotation preview shows
  which way it climbs.

## Fittings (attach, wave B)

- `dome` (_liner_): the Grand Staircase glass dome, on a block top
  (`funnel-mount`, claims the top). Glass panes and a white frame.
- `searchlight`: each bridge exposes one `searchlight` point on its roof
  (new attach type `searchlight-mount`), and each `mast` and `radar-mast`
  exposes one too, near the top. A small lamp on a stand.
- `crows-nest`: each `mast` exposes a `nest` point at about 60% of its
  height (new attach type `nest-mount`). A small round lookout basket.
- `stern-flag`: one hull point `flag` at the stern (new attach type
  `flag-mount`). A pole plus a flag that waves via `useFrame` (cheap: a few
  segments, vertex update or shader; no allocations; reduced motion keeps it
  still; ghosts don't animate). Its colour follows paint.
- `wireless-aerial` (_liner_): attaches to a mast's `aerial` point (new
  attach type `aerial-mount`), which exists only while another mast or radar
  mast is on the ship. It draws two thin wires from the top of this mast to
  the top of the nearest other mast. If the other mast goes, the point
  disappears and the aerial cascades away.

A searchlight, crow's nest and aerial on the same mast don't conflict, since
each has its own point.

Removing a bridge or mast cascades its fittings, through the existing
attach-point cascade.
