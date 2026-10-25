# Side Davits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Side davit" that mounts on the outer side wall of a deck or cabin block and holds a lifeboat snug against the ship's side, under any decks above. This is how lifeboats sit on modern cruise ships.

**Architecture:** There's a new attach part `davit-side` with a new point type, `side-davit-point`. Its points are generated in `blockPoints` (`lib/ship-builder/model/attach.ts`), next to the existing deck-edge davit points. It exposes `"davit"`, so every existing lifeboat, the big-boat pairing and the seat counting work unchanged. Reach and height are looked up per davit type. The scene gets a compact wall-bracket mesh.

**Tech Stack:** TypeScript, three / @react-three/fiber, Jest.

**Spec:** `docs/superpowers/specs/2026-10-25-ship-builder-life-aboard-design.md` (section 2)

## Global Constraints

- The davit must not poke out far. The boat sits close to the wall: reach `0.32` from the wall face, and the arm tip `0.15` above the mount.
- Side-davit lifeboats behave like today's: they count toward lifeboat seats, and any lifeboat that hangs from a davit can hang from one. Paired side davits carry the large lifeboat. Launching comes later, in feature 5, and is out of scope here.
- The wall must face open air: the cell is the outermost one of its row on that side, at or past the hull edge (use the existing `davitSide`). A block above is fine and expected.
- Existing point ids (`davit:x:z`, `edge:x:z`, …) must not change, because saves store them.
- No schema version bump is needed. `PART_TYPES` gains a member, which the schema's enum picks up, and no existing data changes. An older build will reject a save that contains `davit-side`. That's acceptable, as it was for earlier part additions.
- Not available on pirate ships (`kinds: NOT_PIRATE`).
- This is a Ship Builder release: `SHIP_BUILDER_VERSION` becomes `2.18.0`, with a matching top `CHANGELOG` entry.
- Per-task checks are `npm test`, `npm run type-check` and `npm run lint` only. No e2e and no `npm run build`.

## Review Focus

1. Loading an old save that uses deck-edge davits: it loads with all its parts and looks the same. Pinned in Task 1 (fixtures test unchanged, except the templates touched in Task 2).
2. A covered cell, with a block above it: it offers a side-davit point but no deck-edge davit point. Pinned in Task 1.
3. A side davit beside a deck-edge davit's cell: the large lifeboat never pairs a side davit with a deck-edge davit. Pinned in Task 1.
4. A `cabin-balcony` block: its open faces already carry balconies, so it offers no side-davit points (a hanging boat would clip the balconies). Pinned in Task 1.
5. A pirate ship: `davit-side` isn't in its catalog. Pinned in Task 1.

## Execution notes (cost)

- Two tasks run in sequence, both on **Sonnet**. There's one combined review (Sonnet) after Task 2.

---

### Task 1: Side-davit model (Sonnet)

**Files:**

- Modify: `lib/ship-builder/model/types.ts`. Add `"davit-side"` to `PART_TYPES` right after `"davit"`, and `"side-davit-point"` to `AttachPointType`.
- Modify: `lib/ship-builder/model/catalog.ts`. Add the part def and both point-label records (near lines 33 and 57).
- Modify: `lib/ship-builder/model/attach.ts`. Change `blockPoints`, `davitPoints` and `nextDavit`.
- Test: `lib/ship-builder/model/__tests__/attach.test.ts`, `lib/ship-builder/model/__tests__/stats.test.ts`, `lib/ship-builder/model/__tests__/catalog.test.ts`

**Interfaces (produces):**

- Part type `"davit-side"`. Its catalog def: `category: "lifeboats"`, `name: "Side davit"`, `description: "Tucks a boat against the ship's side · fits under decks above"`, `placement: "attach"`, `attachTo: "side-davit-point"`, `mass: 0.1`, `height: 0.4`, `emptyHint: "Build a block on an outer edge of the ship"`, `exposes: "davit"`, `kinds: NOT_PIRATE`. There's no `holdsEdge`, because it doesn't stand on the deck edge.
- Point-label entries: the hint `"side-davit-point": "Needs an outer wall"` and the description `"side-davit-point": "outer side wall of a block"`.
- Point id `side-davit:${x}:${z}` on the block, type `"side-davit-point"`. Its `position` is `{ x: cell.x + 0.5, y: level + SIDE_DAVIT_MOUNT_Y, z: <outer face, as the davit point does> }`, with `side` set and `claims: [`side:${level}:${x}:${z}`]`.
- Export `SIDE_DAVIT_MOUNT_Y = 0.85` from attach.ts (the scene's DavitMesh comment refers to these numbers).
- In `davitPoints`, replace the fixed `DAVIT_HEIGHT`/`DAVIT_REACH` with a per-type lookup: `davit → { height: 0.8, reach: 0.6 }` and `davit-side → { height: 0.15, reach: 0.32 }`. Point ids `boat` and `big-boat` stay the same.

- [ ] **Step 1: Write failing tests** in `attach.test.ts`. Build the ships with the helpers the file already uses.
  - Take a beam-4 ship with a level-0 `cabin-1st` at z 0 and another block on top of it at level 1. The level-0 block's points include `side-davit:x:0` (side `starboard`) and exclude `davit:x:0`. The level-1 block includes both `davit:x:0` and `side-davit:x:0`.
  - A `davit-side` on `side-davit:x:0` exposes `boat`. Its position is the mount + `{ y: 0.15 }`, with z 0.32 outboard (toward −z on starboard).
  - Take two `davit-side`s on adjacent cells x and x+1, same side and level. The first exposes `big-boat`. A `davit-side` at x next to a deck-edge `davit` at x+1 produces no `big-boat` on either.
  - A `cabin-balcony` at the hull edge offers no `side-davit:` points.
  - An inner cell (not outermost in its row) offers no `side-davit:` point.
- [ ] **Step 2: Write failing tests** in `stats.test.ts` and `catalog.test.ts`:
  - A ship with one `davit-side` holding a `lifeboat-standard` reports `lifeboats: 1` and the same `lifeboatSeats` as the same boat on a deck-edge davit.
  - Use whatever the existing kind tests use to list the catalog for a kind: `davit-side` is available for `liner` and `cruise` and absent for `pirate`.
- [ ] **Step 3: Run** `npm test -- --testPathPatterns="attach|stats|catalog"`. Expected: FAIL.
- [ ] **Step 4: Implement.** In `blockPoints`, for `deck`/`cabin` roles other than `cabin-balcony`, add the side-davit point for every cell where `davitSide(...)` is defined, whether or not the cell is covered. In `nextDavit`, take the id prefix from `anchor.pointId` (the text before the first `:`), look for a neighbour at `${prefix}:${x + 1}:${z}`, and require the neighbour's part type to equal this davit's type.
- [ ] **Step 5: Run** the same tests, then `npm test` (everything, including `fixtures`, which must pass unchanged), `npm run type-check` and `npm run lint`. Expected: all pass. TypeScript will flag any exhaustive `Record<PartType, …>` or `switch` that needs a `davit-side` case. Handle each one like `davit`, except in `PartMesh` (Task 2). There, add a temporary `case "davit-side": return null;`, which Task 2 replaces.
- [ ] **Step 6: Commit** `feat(ship-builder): side davit attach points`

---

### Task 2: Side-davit mesh, cruise templates, release (Sonnet)

**Files:**

- Modify: `components/ship-builder/scene/DavitMesh.tsx`. Add `export function SideDavitMesh({ outward, color, tint, emphasis })`, with the same props as `DavitMesh`.
- Modify: `components/ship-builder/scene/PartMesh.tsx`. Make `case "davit-side"` render `SideDavitMesh`, the same way `davit` renders `DavitMesh`.
- Modify: the part icon map, if there is one (`components/ship-builder/ui/icons/PartIcon.tsx`). Give `davit-side` its own small icon, or reuse the davit icon.
- Modify: `lib/ship-builder/templates/modernBuilder.ts`. Change the signature to `boat(boat: PartType, level: number, x: number, z: number, davit: "davit" | "davit-side" = "davit")`. A side davit attaches at `side-davit:${x}:${z}`.
- Modify: `lib/ship-builder/templates/cruise.ts`. Wonder of the Seas and Ocean Breeze hang their `lifeboat-enclosed` boats from side davits.
- Modify: `lib/ship-builder/version.ts` (`"2.18.0"`) and the top of `lib/ship-builder/changelog.ts`.

**Mesh:** the mesh is merged once per direction and cached for the session, like `getArm`. It has a wall plate (about 0.08 × 0.3 × 0.3, flat against the wall at local z 0), a short arm that runs straight out to `outward * 0.32` at height `0.15`, a small diagonal brace beneath the arm, and a pulley block at the tip. Use the `PALETTE.davit` default and `finish="metal"`. The local origin is the mount point. Update the file's top comment to name `SIDE_DAVIT_MOUNT_Y` and the 0.32 / 0.15 numbers.

- [ ] **Step 1: Make the mesh and PartMesh changes.** Check them in the app: `npm run dev`, open the Ocean Breeze template, and confirm the boats hang against the wall, clear of the hull side and the water, and under the deck above. Also check that tapping a side davit selects it.
- [ ] **Step 2: Update the templates.** Change `modernBuilder.boat` and the cruise templates. Run `UPDATE_FIXTURES=1 npx jest fixtures`, and confirm with `git status --short lib/ship-builder/persist/__fixtures__` that only the two cruise template fixtures (and their share expectations) changed. If anything under `legacy/` changed, stop and report BLOCKED.
- [ ] **Step 3: Bump the version and add the changelog entry.** Date `2026-10-25`, title "Side davits". Highlights in plain words, for example:
  - "New Side davit: hang a lifeboat right against the side of your ship, like on today's cruise ships"
  - "It fits under the decks above, so boats tuck in neatly instead of sticking out"
  - "Two side davits next to each other can hold a big lifeboat"
  - "Wonder of the Seas and Ocean Breeze now keep their lifeboats tucked along their sides"
- [ ] **Step 4: Run** `npm test`, `npm run type-check` and `npm run lint`. Expected: all pass, including `changelog.test.ts`.
- [ ] **Step 5: Commit** in two commits: `feat(ship-builder): side davit mesh, cruise ships use side davits`, then `chore(ship-builder): release 2.18.0 — side davits`.
