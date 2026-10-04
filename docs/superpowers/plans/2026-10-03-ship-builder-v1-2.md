# Ship Builder v1.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Longer hulls, large lifeboats and funnels, propellers with an underwater view, and icons throughout, per `docs/superpowers/specs/2026-10-03-ship-builder-v1-2-design.md`.

**Architecture:** The pure model (`lib/ship-builder/model`) gains attach-point _claims_, three new part types, propeller hull points and a power/propeller speed model. The scene gains a `below` camera view, a see-through ocean and new meshes. The UI gains an SVG `PartIcon` per part and `lucide-react` icons for actions, stats and warnings.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, three / @react-three/fiber / drei, zustand, zod, Jest + RTL, Playwright.

**Execution waves** (tasks in a wave run in parallel worktrees):

- Wave 1: Task 1 (model) ‖ Task 2 (below camera)
- Wave 2 (after wave 1 merges): Task 3 (meshes) ‖ Task 4 (icons)
- Wave 3: Task 5 (e2e + full validate)

Conventions for every task: read `CLAUDE.md`; `export default function` components; `interface` props; Tailwind only, light + dark; Prettier (double quotes, 80 cols). Run `npm test -- <paths>`, `npm run type-check`, `npm run lint` before committing. Conventional commits, scope `ship-builder`.

---

### Task 1: Model — 20 segments, claims, large funnel, large lifeboat, propellers, speed

**Goal:** All gameplay rules for v1.2 in the pure model, fully unit tested.

**Files:**

- Modify: `lib/ship-builder/model/grid.ts` (MAX_SEGMENTS)
- Modify: `lib/ship-builder/model/types.ts` (PART_TYPES, PartCategory, AttachPointType, AttachPoint.claims, PartDefBase.power)
- Modify: `lib/ship-builder/model/catalog.ts`
- Modify: `lib/ship-builder/model/attach.ts`
- Modify: `lib/ship-builder/model/placement.ts` (`holdsFunnel`, `canPlaceAttach`)
- Modify: `lib/ship-builder/model/stats.ts`
- Test: `lib/ship-builder/model/__tests__/{attach,placement,stats,catalog,grid}.test.ts`, plus any existing test that hard-codes 12 segments or `computeSpeed`'s old signature.

**Acceptance Criteria:**

- [ ] `MAX_SEGMENTS === 20`; schema accepts a 20-segment ship and rejects 21.
- [ ] New part types `funnel-large`, `lifeboat-large`, `propeller`; new category `propulsion` ("Propulsion") listed last in `CATEGORIES`.
- [ ] Claims prevent: small + large funnel over the same deck top; two large funnels overlapping; a small boat on a davit already holding a large boat (and vice versa).
- [ ] Large funnel point appears for any 2×2 of uncovered deck-role tops at one level (four 1×1s, two 2×1s, mixed); not over cabins/bridge; disappears (and the funnel cascades) when any block under it is removed or covered.
- [ ] No grid part can be placed on top of a cell under a small _or_ large funnel (generalise `holdsFunnel`).
- [ ] Large boat point appears on davit D when another davit on the same side, same level sits at `x + 1`; removing either davit cascades the boat.
- [ ] Hull exposes `prop:0..n-1` points: beam 3 → 2, 4 → 3, ≥5 → 4.
- [ ] Speed: 0 with no funnels or no propellers; Titanic-like ship (20 segments, beam 4, 3 large funnels on deck blocks, 3 propellers) is 19–23 kn; warnings `no-propellers` and `needs-propellers` per spec.
- [ ] Existing saves (no new parts) still validate.

**Verify:** `npm test -- lib/ship-builder && npm run type-check` → all pass.

**Steps:**

- [ ] **Step 1: Types**

In `types.ts`: append `"funnel-large"`, `"lifeboat-large"`, `"propeller"` to `PART_TYPES` (after their siblings is fine; `propeller` last). Add `"propulsion"` to `PartCategory`. Add `"large-funnel-mount" | "big-boat-mount" | "prop-mount"` to `AttachPointType`. Add to `AttachPoint`:

```ts
  /**
   * What this point occupies. Two points conflict when they share a claim.
   * Defaults to one key unique to the point (see claimsOf in attach.ts).
   */
  claims?: string[];
```

Add `power?: number;` to `PartDefBase` (engine power units a funnel provides).

- [ ] **Step 2: Catalog**

`CATEGORIES` gains `{ id: "propulsion", name: "Propulsion" }` last. `ATTACH_POINT_LABELS` gains:

```ts
  "large-funnel-mount": "2×2 of deck blocks with nothing on top",
  "big-boat-mount": "pair of side-by-side davits",
  "prop-mount": "propeller spot under the stern",
```

`funnel` gains `power: 1`. New entries:

```ts
  "funnel-large": {
    type: "funnel-large",
    category: "funnels",
    name: "Large funnel",
    description: "Sits on a 2×2 of deck blocks · 75 stokers",
    placement: "attach",
    attachTo: "large-funnel-mount",
    mass: 4,
    height: 4.2,
    stokers: 75,
    power: 2,
    emptyHint: "Make a 2×2 of deck blocks with nothing on top",
  },
  "lifeboat-large": {
    type: "lifeboat-large",
    category: "lifeboats",
    name: "Large lifeboat",
    description: "90 seats · hangs between two davits",
    placement: "attach",
    attachTo: "big-boat-mount",
    mass: 0.4,
    height: 0.5,
    seats: 90,
    emptyHint: "Put two davits side by side on the same deck edge",
  },
  propeller: {
    type: "propeller",
    category: "propulsion",
    name: "Propeller",
    description: "Mounts under the stern · pushes the ship",
    placement: "attach",
    attachTo: "prop-mount",
    mass: 0.3,
    height: 0.5,
    emptyHint: "Every propeller spot is taken",
  },
```

- [ ] **Step 3: Claims in attach.ts**

Add and export:

```ts
export function claimsOf(parentId: string, point: AttachPoint): string[] {
  return point.claims ?? [`${parentId}/${point.id}`];
}

const topClaim = (cell: Cell) => `top:${cell.level}:${cell.x}:${cell.z}`;
const davitClaim = (davitId: string) => `davit:${davitId}`;
```

- Small funnel point (`blockPoints`): `claims: partCells(part).map(topClaim)`.
- Davit `boat` point: `claims: [davitClaim(part.id)]`.
- Replace `isPointTaken(ship, parentId, pointId)` with a claims-based check. Keep the exported name and signature but add an optional `occupancy` param; implementation: resolve the point; collect claims of every placed attach part (resolve each part's own point via `attachPointsOf(ship, p.anchor.parentId, occupancy)`; skip unresolved); return true if any overlap. Build the claimed set once in `openAttachPoints` (helper `claimedKeys(ship, occupancy): Set<string>`) so marker computation stays O(parts).

- [ ] **Step 4: Large funnel points**

In `blockPoints`, for deck-role parts, for every cell `c` of the part that is the lowest-x, lowest-z corner of a 2×2 square (`c`, `c+x`, `c+z`, `c+x+z`) at `c.level` where each cell's occupant is a deck-role grid part and `level + 1` above it is empty: push

```ts
{
  id: `funnel-lg:${c.x}:${c.z}`,
  type: "large-funnel-mount",
  position: { x: c.x + 1, y: c.level + 1, z: c.z + 1 },
  claims: square.map(topClaim),
}
```

Only the part occupying corner cell `c` exposes it (so each square has exactly one point).

- [ ] **Step 5: Large boat points**

In `davitPoints`, after `boat`: find a davit part whose resolved point has the same `side`, same `position.y`, same `position.z`, and `position.x === base.position.x + 1`. If found, push

```ts
{
  id: "big-boat",
  type: "big-boat-mount",
  position: { x: base.position.x + 0.5, y: <boat y>, z: <boat z> },
  side: base.side,
  claims: [davitClaim(part.id), davitClaim(neighbour.id)],
}
```

(boat y/z exactly as the `boat` point computes them).

- [ ] **Step 6: Propeller hull points**

In `hullPoints`:

```ts
/** Model y of a propeller shaft: below the keel (deck is y 0, keel ≈ −2.8). */
export const PROP_MOUNT_Y = -3.1;
/** Propellers sit this far forward of the hull's last cell. */
const PROP_SETBACK = 0.5;

export function propCount(beam: number): number {
  return beam <= 3 ? 2 : beam === 4 ? 3 : 4;
}
```

Push `prop:${i}` for `i < propCount(beam)` at `{ x: length - PROP_SETBACK, y: PROP_MOUNT_Y, z: (beam * (i + 1)) / (propCount(beam) + 1) }`, type `"prop-mount"`.

- [ ] **Step 7: Placement**

- `holdsFunnel` → `isUnderFunnel(ship, cell, occupancy)`: true if any part with `def.attachTo` of `"funnel-mount"` or `"large-funnel-mount"` claims `top:` of the cell directly below. Update its call site in `canPlaceGrid` so the rule is per cell.
- `canPlaceAttach`: pass `occupancy` to `isPointTaken`.
- `validateShip` / `planBuild` need no change beyond working with claims (a large funnel must be saved after its blocks; the store guarantees order).

- [ ] **Step 8: Stats**

```ts
export const SPEED = {
  base: 14,
  perPower: 1.5,
  powerPerProp: 2,
  maxPowerCounted: 8,
  perSegment: 0.25,
  lossPer10kTons: 1,
  min: 8,
  max: 30,
};

export function computeSpeed(
  power: number,
  propellers: number,
  segments: number,
  grossTonnage: number
): number {
  if (power === 0 || propellers === 0) return 0;
  const usable = Math.min(
    power,
    propellers * SPEED.powerPerProp,
    SPEED.maxPowerCounted
  );
  ...same clamp/round as today with usable * SPEED.perPower
}
```

In `computeStats`: `power += def.power ?? 0`; `funnels` counts any part whose `def.power` is set; `propellers` counts `propeller`. `WarningCode` gains `"no-propellers" | "needs-propellers"`. After the no-funnels warning:

```ts
if (funnels > 0 && propellers === 0) {
  warnings.push({
    code: "no-propellers",
    message: "No propellers — she can't move",
  });
} else if (propellers > 0 && power > propellers * SPEED.powerPerProp) {
  warnings.push({
    code: "needs-propellers",
    message: "Not enough propellers for your funnels",
  });
}
```

Tune `perPower` only if the Titanic-like test lands outside 19–23 kn.

- [ ] **Step 9: Tests (write first for each step above where practical)**

Use `lib/ship-builder/testing.ts` helpers. Cover each acceptance criterion with a named test. Update tests broken by the `computeSpeed` signature, the 12-segment bound, or existing ships now reading 0 kn (add a propeller to those fixtures rather than weakening assertions).

- [ ] **Step 10: Commit** — one commit per logical piece is fine (e.g. claims+funnel, boat, props+speed).

---

### Task 2: Below camera view and see-through ocean

**Goal:** A "Below" camera preset that looks up at the hull from under the water.

**Files:**

- Modify: `lib/ship-builder/state/store.ts` (`CameraView` adds `"below"`)
- Modify: `components/ship-builder/scene/cameraViews.ts`
- Modify: `components/ship-builder/scene/CameraRig.tsx`
- Modify: `components/ship-builder/scene/Ocean.tsx`, `components/ship-builder/scene/Scene.tsx`
- Modify: `components/ship-builder/ui/Toolbar.tsx` (add `{ view: "below", label: "Below", ariaLabel: "Below view" }` to `CAMERA_VIEWS` — text only; Task 4 adds icons)
- Modify: `components/ship-builder/hooks/useKeyboardShortcuts.ts` only if camera views have shortcuts there (check; if 1/2/3 select views, add 4 = below)
- Test: `components/ship-builder/scene/__tests__/cameraViews.test.ts`, `components/ship-builder/ui/__tests__/Toolbar.test.tsx`

**Acceptance Criteria:**

- [ ] `viewTarget(view)` returns `CAMERA_TARGET` for existing views and `BELOW_TARGET = [0, -1.2, 0]` for below.
- [ ] `viewPosition("below", …)` is below the waterline (y < −2), toward the stern (x < 0, stern is world −X), and within `MAX_VIEW_DISTANCE` for every length up to `MAX_SEGMENTS`.
- [ ] `maxPolarAngleFor(view)`: `MAX_POLAR_ANGLE` normally, `Math.PI - 0.1` for below. `panBounds(lengthCells, beam, view)` y range is `[-4, 6]` for below.
- [ ] CameraRig applies the view's target, polar limit and pan bounds; switching back to another preset restores them.
- [ ] Ocean is `side={DoubleSide}`; with the below view it renders with opacity ≈ 0.35 and `depthWrite={false}` so the hull is visible through it.
- [ ] Toolbar shows a "Below view" button that sets the view.

**Verify:** `npm test -- components/ship-builder && npm run type-check && npm run lint`

**Steps:**

- [ ] Write tests in `cameraViews.test.ts` for `viewTarget`, `viewPosition("below")`, `maxPolarAngleFor`, `panBounds(..., "below")`; run → fail.
- [ ] Implement in `cameraViews.ts`. Suggested below position: `[-d * 0.55, BELOW_TARGET[1] - d * 0.35, d * 0.6]` with `d = viewDistance(lengthCells, beam)` capped so `hypot ≤ MAX_VIEW_DISTANCE`.
- [ ] CameraRig: read `view` from the store; replace `orbit.target.set(...CAMERA_TARGET)` with `viewTarget(camera.view)`; pass `maxPolarAngle={maxPolarAngleFor(view)}`; `panBounds(lengthCells, beam, view)` in `handleChange` (add `view` to deps).
- [ ] Ocean takes `seeThrough: boolean` prop; Scene passes `camera.view === "below"`.
- [ ] Toolbar entry + test; tests pass; commit `feat(ship-builder): add an underwater camera view`.
- [ ] Manually confirm with `npm run dev` that the hull's underside is visible; if the stern/prow have open bottoms, close them (e.g. a flat bottom plate at `-HULL_DRAFT` in `Hull.tsx`).

---

### Task 3: Meshes for the new parts

**Goal:** Large funnel, large lifeboat and propeller render in the scene.

**Files:**

- Modify: `components/ship-builder/scene/PartMesh.tsx` (`Fitting`)
- Modify: `components/ship-builder/scene/palette.ts` (add `propeller` bronze colour if needed)

**Acceptance Criteria:**

- [ ] `funnel-large`: same style as `funnel`, ≈1.7× radius, total height ≈ 4.2 (body + coloured top), centred on its point.
- [ ] `lifeboat-large`: like the standard boat but ≈1.9 long × 0.45 wide × 0.35 tall, `PALETTE.lifeboat`, hanging at the same offset.
- [ ] `propeller`: hub cylinder along world X (radius 0.12, length 0.4) plus 3 blades (thin boxes ≈0.5 long) around it, bronze.
- [ ] Ghost preview and tints work (they reuse `Fitting`).

**Verify:** `npm run type-check && npm run lint && npm test -- components/ship-builder/scene`; then `npm run dev`, place each part, screenshot from three-quarter and below views.

**Steps:** add `case`s to `Fitting`, run checks, commit `feat(ship-builder): draw large funnels, large lifeboats and propellers`.

---

### Task 4: Icons everywhere

**Goal:** A non-reader can tell every part, action, stat and warning apart by its icon.

**Files:**

- Run: `npm install lucide-react`
- Create: `components/ship-builder/ui/icons/PartIcon.tsx`
- Create: `components/ship-builder/ui/icons/warningIcons.ts` (`Record<WarningCode, LucideIcon>`)
- Create: `components/ship-builder/ui/icons/__tests__/PartIcon.test.tsx`
- Modify: `components/ship-builder/ui/CatalogPanel.tsx`, `PlacementHint.tsx`, `Toolbar.tsx`, `StatsPanel.tsx`, `ShareButton.tsx`, `MyShipsDialog.tsx`, `RemovalConfirm.tsx` (buttons)
- Test: existing UI tests in `components/ship-builder/ui/__tests__/`

**Acceptance Criteria:**

- [ ] `PartIcon({ type, className })` renders an `aria-hidden` 48×48-viewBox SVG for every `PartType` (exhaustive `Record<PartType, …>`, so a new type fails type-check). Each drawing resembles its 3D part: deck blocks as white boxes (2×1 wider), cabins as boxes with a coloured window band in the cabin's palette colour, bridge as a long low box with blue windows, funnel/large funnel as buff funnel with black top (large visibly bigger), masts as a tall thin pole (fore/aft distinguished by a small arrow pointing left/right), davit as a crane arm, lifeboats as hull shapes (collapsible flatter, large longer), propeller as three blades. Use colours from `scene/palette.ts` so they match the scene in both themes.
- [ ] Catalog buttons show the icon (h-10 w-10) left of name + description; button min height 56px.
- [ ] PlacementHint shows the selected part's icon before its text.
- [ ] Toolbar: every button has a lucide icon plus its text (text may be `sr-only` below `sm:` only where the button already has an `aria-label`). Suggested: Minus/Plus (length), ChevronsLeftRight-style arrows for beam (`MoveHorizontal`/`ArrowLeftToLine`…, pick clear ones), Undo2, Redo2, RotateCw, Trash2, camera views (`Eye` side, `ArrowDownToLine` top, `Box` ¾, `Waves` below), `FilePlus` new, `Save`, `Share2`, `Ship` my ships.
- [ ] Stats rows each have a small icon (`Users` passengers, `HardHat` crew, `UsersRound` people, `LifeBuoy` seats, `ShieldCheck` coverage, `Weight` tonnage, `Gauge` speed, `Scale` stability).
- [ ] Warnings render `warningIcons[code]` before the message (e.g. `LifeBuoy` lifeboats, `Navigation` no-bridge, `Factory` no-funnels, `Fan` no-propellers / needs-propellers with distinct second icon such as `CirclePlus`, `TriangleAlert` top-heavy).
- [ ] All icons `aria-hidden`; accessible names unchanged so existing tests and e2e selectors pass.

**Verify:** `npm test -- components/ship-builder && npm run type-check && npm run lint`

**Steps:**

- [ ] Test: PartIcon renders an svg for every `PART_TYPES` entry; CatalogPanel renders one icon per part; StatsPanel renders an icon per warning (`data-testid="warning-icon"`). Run → fail.
- [ ] Implement PartIcon, warningIcons, panel changes. Keep components server-compatible where they already are (most are client already).
- [ ] Tests pass; commit `feat(ship-builder): add icons for parts, actions, stats and warnings`.

---

### Task 5: E2E and full validation

**Goal:** One e2e path covering the new parts and the Below view; full CI check green.

**Files:**

- Modify: `e2e/ship-builder.spec.ts`

**Acceptance Criteria:**

- [ ] E2E (follow the file's existing helpers for placing blocks and attach parts via the test hook): build a 2×2 of deck blocks and place a large funnel; place two adjacent level-1 davits and a large lifeboat; switch to Below view and place a propeller; stats show non-zero speed and no `no-propellers` warning.
- [ ] `npm run validate` passes; `npm run test:e2e -- e2e/ship-builder.spec.ts` passes on all browsers.

**Verify:** `npm run validate && npm run test:e2e -- e2e/ship-builder.spec.ts`

**Steps:** write the test, run, fix, commit `test(e2e): cover large parts, propellers and the below view`.
