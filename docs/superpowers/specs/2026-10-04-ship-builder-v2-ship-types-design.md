# Ship Builder v2 — Ship types (Phase 2)

**Date:** 2026-10-04
**Status:** Approved

## Framework (wave 2a)

- `Ship.kind: "liner" | "cruise" | "navy" | "cargo"`. Save v6: `MIGRATIONS[5]`
  adds `kind: "liner"`. Older builds back up v6 saves they can't read.
- Chosen only when starting a ship: **New** opens a "New ship" dialog with
  four large picture cards (icon + name + one line): Ocean liner (1910s),
  Cruise ship, Navy ship, Cargo ship. Cancel keeps the current ship. Picking
  one creates `emptyShip(kind)` with that kind's defaults. The current
  "unsaved changes" behaviour of New (if any) is kept.
- Kind defaults (`KIND_DEFAULTS` in `lib/ship-builder/model/kinds.ts`):
  - liner: straight bow, counter stern, default paint
  - cruise: bulbous bow, transom stern, white topsides, navy bottom
  - navy: clipper bow, transom stern, grey topsides, grey bottom
  - cargo: bulbous bow, transom stern, navy topsides, red bottom
- Every part def gains `kinds?: ShipKind[]`. Absent means shared (deck
  blocks, cabins, bridge sizes, masts, propellers, rudders, davits,
  standard lifeboats). Existing liner-only parts (funnel, funnel-large,
  lifeboat-collapsible, lifeboat-large) are `["liner"]`.
- Parts panel shows the ship's kind's parts plus shared ones. A "Show all
  parts" switch (remembered per device, try/catch localStorage) shows every
  part. Search (v1.5) searches whatever is visible.
- Comparison box in Stats is per kind (approximate real figures):
  - liner: RMS Titanic (1912) — as today
  - cruise: Wonder of the Seas (2022) — 236,857 GT, 22 kn, 5,734 passengers,
    2,300 crew
  - navy: Arleigh Burke destroyer — 9,200 t, 30+ kn, about 300 crew
  - cargo: Ever Given (2018) — 219,079 GT, 22.8 kn, 20,124 TEU, 25 crew
- Bridge rule: on cargo ships the bridge may be in either half (real
  container ships have it aft). Other kinds keep "forward half".
- Rules otherwise don't depend on kind: a mixed ship (Show all parts) is
  valid.

## Parts (wave 2b)

Shared new attach type `edge-mount`: the same deck-edge positions as davit
points, but a davit and an edge part on the same cell edge conflict (shared
claim `edge:<level>:<x>:<z>`).

### Cruise (`kinds: ["cruise"]`)

- `cabin-balcony`: cabin, 1×1, 40 passengers (class second), balconies on
  outward faces.
- `pool`: grid 2×2 on top of blocks or the main deck, height 0.3, nothing
  builds on it, blue water. Stats: amenity only (no rule effect).
- `waterslide`: attach on a block top (top claim), a curling tube down the
  outboard side. Decorative.
- `climbing-wall`: attach on a block top (top claim), a tall wall with holds.
  Decorative.
- `lifeboat-enclosed`: boat-mount, 150 seats, orange enclosed hull.
- `raft-canister` (also navy): edge-mount, 25 seats, white canister.
- `funnel-modern`: funnel-mount, power 1, 0 stokers (diesel), raked,
  tapered, single colour.
- `azipod`: prop-mount, counts as a propeller **and** a rudder for speed and
  warnings, a pod with a propeller that spins.

### Navy (`kinds: ["navy"]`)

- `turret-small`: top-mount (block top, top claim), rotates slowly for looks.
- `turret-large`: 2×2 top-mount (like the large funnel), rotates slowly.
- `radar-mast`: mast-mount, lattice mast with a spinning radar.
- `helipad`: 2×2 top-mount, flat pad with an H; exposes a `heli` point.
- `helicopter`: attach on a helipad's `heli` point; spinning rotor.
- `rib-boat`: boat-mount, 15 seats, small grey inflatable.
- `raft-canister`: shared with cruise.

### Cargo (`kinds: ["cargo"]`)

- `container`: grid 2×1, role `cargo`, stacks up to the level cap on the
  main deck, hatch covers or other containers only; random-ish colour from
  the paint palette by id unless painted. `teu: 2`. Stats show a "Cargo"
  row (TEU) whenever it's non-zero. Cargo cells expose no davit, funnel or
  edge points.
- `hatch-cover`: grid 2×2, role `deck`, height 0.3, containers may stack on
  it.
- `cargo-crane`: top-mount, a pedestal crane with a slowly turning jib.
- `lifeboat-freefall`: hull point `freefall` at the stern (one), 40 seats,
  orange boat on a ramp angled down to the sea.

## Templates (Phase 4)

The New ship dialog offers, per type, "Blank" plus templates that load as
ordinary editable ships (block-built approximations, not replicas):

- liner: Titanic, Olympic, Britannic, Carpathia, Lusitania
- cruise: Wonder of the Seas, a smaller classic cruise ship
- navy: Arleigh Burke destroyer, Coast Guard cutter
- cargo: Ever Given, a small feeder container ship
