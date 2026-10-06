# Ship Builder 2.13 — Pirate ships

**Date:** 2026-10-06
**Status:** Approved (brainstorm), awaiting spec review

A fifth ship kind, `pirate`: wooden sailing ships driven by sails instead of
funnels and propellers. New parts, new hull shapes, new templates, and the
rules to match. Builds on the v2 ship-types framework
(`2026-10-04-ship-builder-v2-ship-types-design.md`).

## 1. Framework and rules

### Kind

- `SHIP_KINDS` gains `"pirate"`. Save version bumps with a migration; saves
  from before load as they do today, and older builds back up saves they
  can't read.
- `KIND_DEFAULTS.pirate`: name "Untitled pirate ship", bow `beakhead`, stern
  `galleon`, paint topsides `oak`, bottom `dark-oak`.
- New hull shapes in `hullShapes.ts`, added to the bow and stern pickers:
  - `beakhead` bow: a raked bow with a bowsprit spar.
  - `galleon` stern: raised, with a window castle.
- New paint colours `oak`, `dark-oak` and `weathered`. They are available on
  every kind.

### Sails replace power

- New part role `sail`. A sail part has `sailArea`; a mast has a sail
  capacity (short, tall, main).
- Top speed comes from total sail area, capped by total mast capacity, minus
  the existing weight loss. Pirate ships have no `power`, `stokers` or
  propellers.
- Wind is steady with no direction. Sail trim does not exist.
- A rudder is still required to steer.
- Rules checklist for pirate ships:
  - "Sails for speed": no sails means "No sails, she can't move".
  - "Masts for your sails": too much sail for the masts warns.
  - "No rudder": "No rudder, she can't steer" (unchanged text).
- Bridge rule: the `helm-wheel` has the `bridge` role, so the existing
  bridge rule applies unchanged (forward-half rule as for non-cargo kinds).
- Handling: agility sits between navy and cargo.
- Sea trial and Drive reuse the wheel and throttle; the Drive HUD labels the
  throttle "Sails" for pirate ships. Sails billow while under way.
- Sinking and breakup reuse the existing flooding sim unchanged.

### Cannons stat and reference ship

- New `cannons` stat. Cannon parts add to it. Stats shows a Cannons row
  whenever it is non-zero (like TEU), and `ReferenceMetric` gains `cannons`.
- Reference ship: Queen Anne's Revenge (1718): about 11 kn, about 150 crew,
  40 cannons, with the displacement of about 300 tons as a note (gross
  tonnage is not meaningful at that scale).

## 2. Parts and assets

All parts are `kinds: ["pirate"]` (except where noted). Meshes are
procedural three.js in a new `components/ship-builder/scene/pirateParts.tsx`,
in the style of `navyParts.tsx`. The only image asset is the picker icon.

### Sails and masts

- `mast-wood-short`, `mast-wood-tall`, `mast-wood-main`: mast-mount, with
  differing heights and sail capacity. Tall and main masts have a crow's nest.
- `sail-square` (small, medium, large by `sailArea`), `sail-jib` (bowsprit
  mount), `sail-lateen` (mizzen mast). They billow gently. Colour follows
  paint: default off-white, with black sails available.
- `flag-jolly-roger`: the topmost mast point, waves, decorative.

### Cannons

- `cannon-deck`: edge-mount at deck-edge positions (shares the
  `edge:<level>:<x>:<z>` claim with davits, rafts and the plank), counts to
  the cannons stat, tap for a small recoil and smoke puff.
- `cannon-chaser`: bow hull point.
- `cannon-swivel`: rail-mounted, decorative, cheap.

### Wooden deco

- `cabin-captain`: a cabin block with stern windows (a normal cabin for
  crew and berths).
- `helm-wheel`: `bridge` role, a wheel with a binnacle, on a quarterdeck.
- `figurehead`: bow hull point, a mermaid.
- `anchor`, `barrel-stack`, `crate-stack`, `treasure-chest`: small deck decor
  following the `deckDecor.tsx` pattern.
- `rowboat`: boat-mount, 8 seats. It counts toward lifeboat seats and
  replaces lifeboats for pirate ships.

### Plank and crew

- `plank`: edge-mount, a board over the sea.
- `pirate-crew`: a small standing figure on a deck cell, several poses and
  colour variants (capsule body, hat and sword; no rig). Decorative.
- `parrot`: a small bird on a rail or mast point.
- Walk mode: crew and parrot do not block walking; the plank is walkable at
  the edge. The plan verifies this against the walk-grid code.

### Assets

- One picker icon (SVG) in the style of the existing four.

## 3. Templates and UI

### Templates

`lib/ship-builder/templates/pirate.ts`, registered in `TEMPLATES`. They load
as ordinary editable ships, block-built approximations, not replicas.

| Template                  | Year      | Size       | Build                                                       |
| ------------------------- | --------- | ---------- | ----------------------------------------------------------- |
| Small sloop               | 1700      | about 8×3  | One mast, square sail and jib, 4 cannons, a rowboat         |
| Whydah Gally              | 1717      | about 12×4 | Three masts, 28 cannons, a Jolly Roger                      |
| Queen Anne's Revenge      | 1718      | about 14×5 | Three masts, 40 cannons, figurehead, captain's cabin        |
| Black Pearl-style galleon | fictional | about 16×5 | Three masts with black sails, tall stern castle, 36 cannons |

Each has a one-line blurb; the galleon's says it is a fictional homage. Each
gets a JSON fixture in `persist/__fixtures__/templates/`.

### New ship dialog

- A fifth card, "Pirate ship", with the new icon. The picker grid is checked
  at phone and iPad widths (likely two columns with the last card spanning).
- The pirate template list is Blank plus the four templates.

### Parts panel and Stats

- The panel shows pirate parts plus shared ones; "Show all parts" works as
  before. Per-kind icon and label tables get a pirate entry.
- Stats: Cannons row, Queen Anne's Revenge comparison box, a Speed row that
  explains "driven by sails", and the swapped Rules checklist rows.
- The help text mentions pirate ships.

## 4. Testing, release and delivery

### Tests

- **Model:** pirate kind defaults, `isShipKind`, the save migration (old save
  loads, pirate save round-trips), catalog consistency (every pirate part
  has a mesh and a kind).
- **Stats:** speed from sail area is capped by mast capacity, with the
  weight loss; the no-sails, too-much-sail and no-rudder warnings; the
  cannons stat; a mixed ship (Show all parts) stays valid.
- **Placement:** edge-mount conflicts (cannon, plank, davit, raft), mast and
  sail attach rules, crew and parrot do not block walking.
- **Templates:** all four build, place cleanly and pass the stats-in-range
  checks; fixtures match the schema.
- **UI:** the New ship dialog (five cards, pirate template list), parts panel
  kind filter, Stats rows and reference box.
- **Sim:** a pirate sea trial and drive run end to end; sails make the ship
  move; a breach still floods and sinks it.
- **E2E (Playwright):** create a pirate ship from the dialog, load the Whydah
  Gally and see sails (`@smoke`, so WebKit and iPad cover the five-card
  layout); one short drive on a pirate template. The full build and e2e run
  at baseline and at ship time only.

### Release

Minor release **2.13.0**: bump `SHIP_BUILDER_VERSION`, add the top
`CHANGELOG` entry in plain words, and bump the service worker cache version
if past releases do.

### Delivery

- Branch `worktree-pirate-ships`, PR to `main` at the end.
- Plan shape: (1) model, rules, save migration, hull shapes, paint
  (sequential foundation); (2) in parallel: sails and masts, cannons and
  wooden deco, crew/plank/parrot; (3) templates and UI; (4) release and e2e.
- Review depth: model, rules and migration get a spec review plus an
  adversarial review; meshes and UI get one combined review; templates are
  covered by tests plus a spot-check.
