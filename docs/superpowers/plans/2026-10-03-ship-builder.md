# Ship Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a client-only `/ship-builder` route where players snap together a Titanic-era liner in a 3D scene, see live stats, autosave and share designs by URL.

**Architecture:** A pure-TypeScript model (`lib/ship-builder/model`) owns every rule: grid, attach points, placement, cascade, stats. A Zustand store (`lib/ship-builder/state`) wraps the model with tools, selection and undo/redo. Persistence (`lib/ship-builder/persist`) validates all loaded data with zod, then re-checks the rules. React UI panels and a React Three Fiber scene (`components/ship-builder`) only read the store and call store actions. The scene loads with `next/dynamic` and `ssr: false`.

**Tech Stack:** Next.js 16 (static export), React 19, TypeScript, Tailwind 4, three + @react-three/fiber 9 + @react-three/drei 10, zustand 5, zod 4, lz-string 1.5, Jest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-03-ship-builder-design.md`

---

## Decisions made while planning (spec interpretations)

These fill gaps in the spec. Reviewers should treat them as intended behavior.

1. **Coordinates.** In model space, `x` runs along the length in cells, starting at the bow (`x = 0`) and increasing toward the stern. `z` runs across the beam, with `z = 0` on the starboard edge and `z = 3` on the port edge. `y` is in deck levels above the main deck. "Forward half" means every cell has `x < length / 2`. The scene maps model space to world space with a 180° turn about Y, so the bow points toward world +X.
2. **Geometry builders live in the scene, not in `PartDef`.** The spec's own rule says `model/` depends on nothing. The catalog therefore carries data only, and `components/ship-builder/scene/PartMesh.tsx` maps each part type to geometry.
3. **Masts mount on the prow and stern extensions,** forward of `x = 0` and aft of the last cell. They never collide with grid cells. The fore mast only fits the `mast-fore` mount and the aft mast only fits `mast-aft`.
4. **Bridge footprint is 1×4 (full beam),** and rotates to 4×1.
5. **Rule 6 also covers davits.** You can't build a block over a cell that holds a bridge, a funnel (any cell of the funnel's parent deck block), or a davit (the davit's cell).
6. **Attach points exist only when they're structurally open.** A deck block has a `funnel-mount` only while nothing sits on top of it. Davit points appear only on uncovered outboard cells at level 1 or higher, and never on a bridge.
7. **Delete confirmation only appears for cascades.** Removing a part that has no dependents happens immediately (it's undoable). When the cascade would also remove other parts, those parts are highlighted red and a confirm bar appears.
8. **Renaming isn't an undo step,** and undo/redo keep the current name.
9. **New ship is undoable:** it commits an empty hull to history.
10. **Autosave stores `{ ship, savedId }`,** so a reload remembers which My Ships entry is open.
11. **E2E drives placement through a dev-only store hook** (`window.__shipBuilderStore`, absent in production builds). It doesn't rely on pixel coordinates, so every browser runs the e2e suite. Only the canvas-renders check is limited to Chromium.
12. **Firebase needs `cleanUrls: true`.** Static export writes `out/ship-builder.html`, and without clean URLs Firebase returns 404 for `/ship-builder`.

## Tunable constants (from the spec's ≈ values)

| Constant                                 | Value                                                                                                                      | Calibration                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Passengers per cabin cell                | 1st 30, 2nd 50, 3rd 120                                                                                                    | spec                                                           |
| `CREW_PER_SEGMENT`                       | 60                                                                                                                         | 12 segments + 4 funnels → 880 crew                             |
| `STOKERS_PER_FUNNEL` (catalog `stokers`) | 40                                                                                                                         |                                                                |
| Seats                                    | standard 65, collapsible 47                                                                                                | spec                                                           |
| `HULL_DEPTH` × `GRT_PER_UNIT`            | 4 × 63                                                                                                                     | 12 segments + ~150 block cells ≈ 46k GRT                       |
| Speed                                    | `14 + 2.2·min(funnels,6) + 0.25·segments − GRT/10000`, clamped 8–30, and 0 with no funnels                                 | 12 seg, 4 funnels, 36.5k GRT → 22.1 kn                         |
| Stability                                | hull mass 1/cell at y = −1; blocks mass 1/cell; ratio = COM height ÷ beam (4). Stable < 0.15 ≤ Top-heavy < 0.3 ≤ Dangerous | 4-segment hull: 2 full levels Stable, 3 Top-heavy, 4 Dangerous |

## File structure

```
app/ship-builder/page.tsx                         server: metadata + <ShipBuilder />
app/sitemap.ts                                    + /ship-builder entry
firebase.json                                     + cleanUrls
lib/ship-builder/
  testing.ts                                      test fixtures (gridPart, attachPart, testShip)
  model/types.ts                                  Ship, PlacedPart, anchors, PartDef, PART_TYPES
  model/catalog.ts                                CATALOG, CATEGORIES, labels, lookups
  model/grid.ts                                   grid constants, footprints, occupancy
  model/attach.ts                                 attach points, resolution, open points
  model/placement.ts                              canPlace, place, cascade, hull length, validateShip
  model/stats.ts                                  computeStats, constants, Titanic reference
  model/ids.ts                                    newId()
  model/__tests__/*.test.ts
  persist/schema.ts                               zod schema, migrate, parseShip
  persist/share.ts                                encode/decode #ship= hash
  persist/local.ts                                localStorage: autosave + My Ships
  persist/__tests__/*.test.ts
  state/store.ts                                  Zustand store
  state/__tests__/store.test.ts
components/ship-builder/
  ShipBuilder.tsx                                 client root layout
  hooks/useKeyboardShortcuts.ts
  hooks/useShipPersistence.ts
  hooks/useWebGLSupport.ts
  hooks/useTestHook.ts
  hooks/__tests__/*.test.tsx
  ui/styles.ts                                    shared Tailwind class strings
  ui/Drawer.tsx  CatalogPanel.tsx  StatsPanel.tsx  Toolbar.tsx
  ui/ShareButton.tsx  MyShipsDialog.tsx  RemovalConfirm.tsx
  ui/PlacementHint.tsx  Notice.tsx  WebGLFallback.tsx
  ui/__tests__/*.test.tsx
  scene/coords.ts  palette.ts                     pure helpers (coords tested in Jest)
  scene/Scene.tsx  Ocean.tsx  Hull.tsx  PartMesh.tsx  ShipParts.tsx
  scene/GridTargets.tsx  AttachMarkers.tsx  GhostPreview.tsx  CameraRig.tsx
  scene/__tests__/coords.test.ts
e2e/ship-builder.spec.ts
```

## Execution notes for the controller

- **Review depth** (per the user's global CLAUDE.md):
  - Task 5 (persistence) decodes untrusted URL and localStorage data. That makes it data-boundary work: it gets a spec review plus an adversarial quality review, and a re-review after fixes.
  - Tasks 2, 3, 4, 6, 7, 8, 9 and 10 get one combined review each.
  - Task 1 (deps and types) and Task 11 (e2e) get a controller spot-check only.
- **Batching:** Tasks 1–2 can run in one implementer run (same directory, two commits). So can Tasks 9–10 (scene). Overlap each review with the next implementer.
- **Expensive verification:** run `npm run validate` at the baseline (Task 1, Step 1) and at ship time (Task 11). Run `npm run build` after Task 6 too, because that task changes the route and build output.
- **No native task tools** were available in the planning session. `.tasks.json` sits next to this plan for resume.

---

### Task 1: Dependencies, types, catalog, ids

**Goal:** Install the new packages and add the model's types, part catalog and id helper, with catalog tests.

**Files:**

- Modify: `package.json`, `package-lock.json` (via npm)
- Create: `lib/ship-builder/model/types.ts`
- Create: `lib/ship-builder/model/catalog.ts`
- Create: `lib/ship-builder/model/ids.ts`
- Create: `lib/ship-builder/testing.ts`
- Test: `lib/ship-builder/model/__tests__/catalog.test.ts`

**Acceptance Criteria:**

- [ ] `three`, `@react-three/fiber`, `@react-three/drei`, `zustand`, `zod`, `lz-string` are in `dependencies`, and `@types/three` is in `devDependencies`
- [ ] Every `PART_TYPES` entry has a catalog def whose `type` matches its key
- [ ] Every category has at least one part

**Verify:** `npm test -- --testPathPatterns=ship-builder/model/__tests__/catalog` → PASS

**Steps:**

- [ ] **Step 1: Baseline.** Run `npm run validate`. Expected: all green. If anything fails, stop and report; don't fix unrelated breakage.

- [ ] **Step 2: Install.**

```bash
npm install three @react-three/fiber @react-three/drei zustand zod lz-string
npm install -D @types/three
```

- [ ] **Step 3: Write `lib/ship-builder/model/types.ts`.**

```ts
export const PART_TYPES = [
  "deck-1x1",
  "deck-2x1",
  "cabin-1st",
  "cabin-2nd",
  "cabin-3rd",
  "bridge",
  "funnel",
  "mast-fore",
  "mast-aft",
  "davit",
  "lifeboat-standard",
  "lifeboat-collapsible",
] as const;

export type PartType = (typeof PART_TYPES)[number];

export type PartCategory =
  | "decks"
  | "cabins"
  | "command"
  | "funnels"
  | "masts"
  | "lifeboats";

export type AttachPointType =
  | "funnel-mount"
  | "mast-mount"
  | "davit-point"
  | "boat-mount";

export type Rotation = 0 | 90 | 180 | 270;

export type CabinClass = "first" | "second" | "third";

/** Parent id used for attach points that belong to the hull itself. */
export const HULL_ID = "hull";

export interface GridAnchor {
  kind: "grid";
  level: number;
  x: number;
  z: number;
}

export interface AttachAnchor {
  kind: "attach";
  /** A part id, or HULL_ID. */
  parentId: string;
  pointId: string;
}

export type Anchor = GridAnchor | AttachAnchor;

export interface PlacedPart {
  id: string;
  type: PartType;
  anchor: Anchor;
  rotation: Rotation;
}

export interface Ship {
  v: 1;
  name: string;
  hull: { lengthSegments: number };
  parts: PlacedPart[];
}

export interface Cell {
  level: number;
  x: number;
  z: number;
}

/**
 * Model-space position. x: cells from the bow toward the stern. y: levels
 * above the main deck. z: cells from the starboard edge toward port.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Side = "starboard" | "port";

export interface AttachPoint {
  id: string;
  type: AttachPointType;
  position: Vec3;
  side?: Side;
}

interface PartDefBase {
  type: PartType;
  category: PartCategory;
  name: string;
  description: string;
  /** Stability mass; per occupied cell for grid parts. */
  mass: number;
  /** Height in levels, used for the part's center of mass. */
  height: number;
  passengers?: { cabinClass: CabinClass; count: number };
  seats?: number;
  stokers?: number;
}

export interface GridPartDef extends PartDefBase {
  placement: "grid";
  role: "deck" | "cabin" | "bridge";
  /** Size at rotation 0: x along the length, z across the beam. */
  footprint: { x: number; z: number };
}

export interface AttachPartDef extends PartDefBase {
  placement: "attach";
  attachTo: AttachPointType;
  /** Restricts which point ids of the right type this part may use. */
  allowedPointIds?: string[];
  /** Shown when there's nowhere free to put this part. */
  emptyHint: string;
}

export type PartDef = GridPartDef | AttachPartDef;
```

- [ ] **Step 4: Write `lib/ship-builder/model/catalog.ts`.**

```ts
import {
  PART_TYPES,
  type AttachPointType,
  type PartCategory,
  type PartDef,
  type PartType,
} from "./types";

export const CATEGORIES: readonly { id: PartCategory; name: string }[] = [
  { id: "decks", name: "Decks" },
  { id: "cabins", name: "Cabins" },
  { id: "command", name: "Command" },
  { id: "funnels", name: "Funnels" },
  { id: "masts", name: "Masts" },
  { id: "lifeboats", name: "Lifeboat gear" },
];

export const ATTACH_POINT_LABELS: Record<AttachPointType, string> = {
  "funnel-mount": "funnel mount on a deck block",
  "mast-mount": "mast mount",
  "davit-point": "boat-deck edge",
  "boat-mount": "davit",
};

export const CATALOG: Record<PartType, PartDef> = {
  "deck-1x1": {
    type: "deck-1x1",
    category: "decks",
    name: "Deck block 1×1",
    description: "Superstructure · stacks four high",
    placement: "grid",
    role: "deck",
    footprint: { x: 1, z: 1 },
    mass: 1,
    height: 1,
  },
  "deck-2x1": {
    type: "deck-2x1",
    category: "decks",
    name: "Deck block 2×1",
    description: "Superstructure · stacks four high",
    placement: "grid",
    role: "deck",
    footprint: { x: 2, z: 1 },
    mass: 1,
    height: 1,
  },
  "cabin-1st": {
    type: "cabin-1st",
    category: "cabins",
    name: "First-class cabins",
    description: "30 passengers",
    placement: "grid",
    role: "cabin",
    footprint: { x: 1, z: 1 },
    mass: 1,
    height: 1,
    passengers: { cabinClass: "first", count: 30 },
  },
  "cabin-2nd": {
    type: "cabin-2nd",
    category: "cabins",
    name: "Second-class cabins",
    description: "50 passengers",
    placement: "grid",
    role: "cabin",
    footprint: { x: 1, z: 1 },
    mass: 1,
    height: 1,
    passengers: { cabinClass: "second", count: 50 },
  },
  "cabin-3rd": {
    type: "cabin-3rd",
    category: "cabins",
    name: "Third-class berths",
    description: "120 passengers",
    placement: "grid",
    role: "cabin",
    footprint: { x: 1, z: 1 },
    mass: 1,
    height: 1,
    passengers: { cabinClass: "third", count: 120 },
  },
  bridge: {
    type: "bridge",
    category: "command",
    name: "Bridge",
    description: "Full beam · forward half, top of its stack",
    placement: "grid",
    role: "bridge",
    footprint: { x: 1, z: 4 },
    mass: 1,
    height: 1,
  },
  funnel: {
    type: "funnel",
    category: "funnels",
    name: "Funnel",
    description: "Sits on a deck block · 40 stokers",
    placement: "attach",
    attachTo: "funnel-mount",
    mass: 2,
    height: 3.2,
    stokers: 40,
    emptyHint: "Place a deck block with nothing on top of it first",
  },
  "mast-fore": {
    type: "mast-fore",
    category: "masts",
    name: "Fore mast",
    description: "Mounts on the forecastle",
    placement: "attach",
    attachTo: "mast-mount",
    allowedPointIds: ["mast-fore"],
    mass: 0.5,
    height: 7,
    emptyHint: "The forward mast mount is taken",
  },
  "mast-aft": {
    type: "mast-aft",
    category: "masts",
    name: "Aft mast",
    description: "Mounts on the stern",
    placement: "attach",
    attachTo: "mast-mount",
    allowedPointIds: ["mast-aft"],
    mass: 0.5,
    height: 7,
    emptyHint: "The aft mast mount is taken",
  },
  davit: {
    type: "davit",
    category: "lifeboats",
    name: "Davit",
    description: "Boat-deck edge, level 1 or higher",
    placement: "attach",
    attachTo: "davit-point",
    mass: 0.1,
    height: 1,
    emptyHint: "Build a block on an outer edge at level 1 or higher",
  },
  "lifeboat-standard": {
    type: "lifeboat-standard",
    category: "lifeboats",
    name: "Lifeboat",
    description: "65 seats · hangs from a davit",
    placement: "attach",
    attachTo: "boat-mount",
    mass: 0.2,
    height: 0.4,
    seats: 65,
    emptyHint: "Every davit has a boat — add another davit",
  },
  "lifeboat-collapsible": {
    type: "lifeboat-collapsible",
    category: "lifeboats",
    name: "Collapsible lifeboat",
    description: "47 seats · hangs from a davit",
    placement: "attach",
    attachTo: "boat-mount",
    mass: 0.2,
    height: 0.4,
    seats: 47,
    emptyHint: "Every davit has a boat — add another davit",
  },
};

export function getPartDef(type: PartType): PartDef {
  return CATALOG[type];
}

export function partsInCategory(category: PartCategory): PartDef[] {
  return PART_TYPES.map((type) => CATALOG[type]).filter(
    (def) => def.category === category
  );
}
```

- [ ] **Step 5: Write `lib/ship-builder/model/ids.ts`.**

```ts
export function newId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}-${random}${time}`;
}
```

- [ ] **Step 6: Write `lib/ship-builder/testing.ts`.** These are shared test fixtures. They live outside `__tests__/` because Jest treats every file in there as a test suite.

```ts
import type { PartType, PlacedPart, Rotation, Ship } from "./model/types";

export function gridPart(
  id: string,
  type: PartType,
  level: number,
  x: number,
  z: number,
  rotation: Rotation = 0
): PlacedPart {
  return { id, type, anchor: { kind: "grid", level, x, z }, rotation };
}

export function attachPart(
  id: string,
  type: PartType,
  parentId: string,
  pointId: string
): PlacedPart {
  return {
    id,
    type,
    anchor: { kind: "attach", parentId, pointId },
    rotation: 0,
  };
}

export function testShip(parts: PlacedPart[] = [], lengthSegments = 8): Ship {
  return { v: 1, name: "Test", hull: { lengthSegments }, parts };
}
```

- [ ] **Step 7: Write the failing test `lib/ship-builder/model/__tests__/catalog.test.ts`.**

```ts
import { CATALOG, CATEGORIES, getPartDef, partsInCategory } from "../catalog";
import { newId } from "../ids";
import { PART_TYPES } from "../types";

describe("catalog", () => {
  it("has a def for every part type, keyed by its own type", () => {
    for (const type of PART_TYPES) {
      expect(CATALOG[type].type).toBe(type);
      expect(getPartDef(type)).toBe(CATALOG[type]);
    }
  });

  it("puts at least one part in every category", () => {
    for (const category of CATEGORIES) {
      expect(partsInCategory(category.id).length).toBeGreaterThan(0);
    }
  });

  it("gives grid parts positive footprints and attach parts a target", () => {
    for (const type of PART_TYPES) {
      const def = CATALOG[type];
      if (def.placement === "grid") {
        expect(def.footprint.x).toBeGreaterThan(0);
        expect(def.footprint.z).toBeGreaterThan(0);
      } else {
        expect(def.attachTo).toBeTruthy();
        expect(def.emptyHint).toBeTruthy();
      }
    }
  });
});

describe("newId", () => {
  it("prefixes ids and does not repeat", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId("p")));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id.startsWith("p-")).toBe(true);
  });
});
```

- [ ] **Step 8: Run the tests.** `npm test -- --testPathPatterns=ship-builder/model/__tests__/catalog`. They should PASS, because the implementation was written in Steps 3–5. If the Jest version rejects `--testPathPatterns`, use `--testPathPattern`.

- [ ] **Step 9: Type-check and commit.**

```bash
npm run type-check
git add package.json package-lock.json lib/ship-builder
git commit -m "feat(ship-builder): add deps, model types, and parts catalog"
```

---

### Task 2: Grid math and attach points

**Goal:** Pure grid helpers (footprints, bounds, occupancy, column tops) and attach-point generation for the hull, blocks and davits.

**Files:**

- Create: `lib/ship-builder/model/grid.ts`
- Create: `lib/ship-builder/model/attach.ts`
- Test: `lib/ship-builder/model/__tests__/grid.test.ts`
- Test: `lib/ship-builder/model/__tests__/attach.test.ts`

**Acceptance Criteria:**

- [ ] The grid is 3 cells per segment long and 4 wide, with levels 0–3
- [ ] Rotating by 90/270 swaps the footprint
- [ ] The hull exposes `mast-fore` and `mast-aft`
- [ ] A deck block exposes `funnel-mount` only when uncovered
- [ ] Davit points appear only on uncovered `z = 0`/`z = 3` cells at level ≥ 1, never on a bridge
- [ ] A davit exposes one `boat-mount`, offset outboard

**Verify:** `npm test -- --testPathPatterns="ship-builder/model/__tests__/(grid|attach)"` → PASS

**Steps:**

- [ ] **Step 1: Write the failing test `lib/ship-builder/model/__tests__/grid.test.ts`.**

```ts
import { getPartDef } from "../catalog";
import {
  buildOccupancy,
  cellKey,
  footprintCells,
  gridLength,
  inBounds,
  isForwardHalf,
  partCells,
  rotatedFootprint,
  topLevel,
} from "../grid";
import type { GridPartDef } from "../types";
import { attachPart, gridPart, testShip } from "../../testing";

const deck2 = getPartDef("deck-2x1") as GridPartDef;

describe("grid", () => {
  it("is three cells per hull segment", () => {
    expect(gridLength(testShip([], 4))).toBe(12);
    expect(gridLength(testShip([], 12))).toBe(36);
  });

  it("rotates footprints by swapping axes at 90 and 270", () => {
    expect(rotatedFootprint({ x: 2, z: 1 }, 0)).toEqual({ x: 2, z: 1 });
    expect(rotatedFootprint({ x: 2, z: 1 }, 90)).toEqual({ x: 1, z: 2 });
    expect(rotatedFootprint({ x: 2, z: 1 }, 180)).toEqual({ x: 2, z: 1 });
    expect(rotatedFootprint({ x: 2, z: 1 }, 270)).toEqual({ x: 1, z: 2 });
  });

  it("lists footprint cells from the anchor corner", () => {
    const anchor = { kind: "grid", level: 1, x: 3, z: 2 } as const;
    expect(footprintCells(deck2, anchor, 0)).toEqual([
      { level: 1, x: 3, z: 2 },
      { level: 1, x: 4, z: 2 },
    ]);
    expect(footprintCells(deck2, anchor, 90)).toEqual([
      { level: 1, x: 3, z: 2 },
      { level: 1, x: 3, z: 3 },
    ]);
  });

  it("checks bounds on every axis", () => {
    const ship = testShip([], 4);
    expect(inBounds(ship, { level: 0, x: 0, z: 0 })).toBe(true);
    expect(inBounds(ship, { level: 3, x: 11, z: 3 })).toBe(true);
    expect(inBounds(ship, { level: 4, x: 0, z: 0 })).toBe(false);
    expect(inBounds(ship, { level: -1, x: 0, z: 0 })).toBe(false);
    expect(inBounds(ship, { level: 0, x: 12, z: 0 })).toBe(false);
    expect(inBounds(ship, { level: 0, x: 0, z: 4 })).toBe(false);
    expect(inBounds(ship, { level: 0, x: -1, z: 0 })).toBe(false);
  });

  it("treats cells below half the length as the forward half", () => {
    const ship = testShip([], 4);
    expect(isForwardHalf(ship, 5)).toBe(true);
    expect(isForwardHalf(ship, 6)).toBe(false);
  });

  it("maps occupied cells to parts and ignores attach parts", () => {
    const block = gridPart("a", "deck-2x1", 0, 0, 0);
    const funnel = attachPart("f", "funnel", "a", "funnel");
    const occ = buildOccupancy(testShip([block, funnel]));
    expect(occ.size).toBe(2);
    expect(occ.get(cellKey({ level: 0, x: 1, z: 0 }))).toBe(block);
    expect(partCells(funnel)).toEqual([]);
  });

  it("finds the top occupied level of a column", () => {
    const occ = buildOccupancy(
      testShip([
        gridPart("a", "deck-1x1", 0, 2, 1),
        gridPart("b", "deck-1x1", 1, 2, 1),
      ])
    );
    expect(topLevel(occ, 2, 1)).toBe(1);
    expect(topLevel(occ, 0, 0)).toBe(-1);
  });
});
```

- [ ] **Step 2: Write the failing test `lib/ship-builder/model/__tests__/attach.test.ts`.**

```ts
import {
  attachPointsOf,
  isPointTaken,
  openAttachPoints,
  resolveAttachPoint,
} from "../attach";
import { getPartDef } from "../catalog";
import { HULL_ID, type AttachPartDef } from "../types";
import { attachPart, gridPart, testShip } from "../../testing";

describe("attach points", () => {
  it("gives the hull fore and aft mast mounts that track the stern", () => {
    const short = attachPointsOf(testShip([], 4), HULL_ID);
    expect(short.map((p) => p.id)).toEqual(["mast-fore", "mast-aft"]);
    expect(short[0].position).toEqual({ x: -1, y: 0, z: 2 });
    expect(short[1].position).toEqual({ x: 12.75, y: 0, z: 2 });
    const long = attachPointsOf(testShip([], 8), HULL_ID);
    expect(long[1].position.x).toBe(24.75);
  });

  it("gives an uncovered deck block a centered funnel mount", () => {
    const ship = testShip([gridPart("a", "deck-2x1", 0, 4, 1)]);
    expect(attachPointsOf(ship, "a")).toEqual([
      {
        id: "funnel",
        type: "funnel-mount",
        position: { x: 5, y: 1, z: 1.5 },
      },
    ]);
  });

  it("removes the funnel mount when something sits on the block", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 4, 1),
      gridPart("b", "deck-1x1", 1, 4, 1),
    ]);
    expect(attachPointsOf(ship, "a")).toEqual([]);
  });

  it("does not give cabins a funnel mount", () => {
    const ship = testShip([gridPart("c", "cabin-1st", 0, 4, 1)]);
    expect(attachPointsOf(ship, "c")).toEqual([]);
  });

  it("puts davit points on outboard edges at level 1 and up", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 0),
      gridPart("b", "deck-1x1", 1, 2, 0),
      gridPart("c", "deck-1x1", 0, 2, 3),
      gridPart("d", "cabin-2nd", 1, 2, 3),
    ]);
    expect(attachPointsOf(ship, "a").map((p) => p.type)).not.toContain(
      "davit-point"
    );
    const starboard = attachPointsOf(ship, "b").find(
      (p) => p.type === "davit-point"
    );
    expect(starboard).toEqual({
      id: "davit:2:0",
      type: "davit-point",
      position: { x: 2.5, y: 2, z: 0 },
      side: "starboard",
    });
    const port = attachPointsOf(ship, "d")[0];
    expect(port).toMatchObject({ id: "davit:2:3", side: "port" });
    expect(port.position.z).toBe(4);
  });

  it("does not put davit points on interior cells, covered cells, or bridges", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 1),
      gridPart("b", "deck-1x1", 1, 2, 1),
      gridPart("c", "deck-1x1", 0, 3, 0),
      gridPart("d", "deck-1x1", 1, 3, 0),
      gridPart("e", "deck-1x1", 2, 3, 0),
    ]);
    expect(
      attachPointsOf(ship, "b").filter((p) => p.type === "davit-point")
    ).toEqual([]);
    expect(
      attachPointsOf(ship, "d").filter((p) => p.type === "davit-point")
    ).toEqual([]);
    expect(attachPointsOf(ship, "e").map((p) => p.id)).toContain("davit:3:0");

    const bridgeShip = testShip([
      gridPart("l0", "deck-1x1", 0, 1, 0),
      gridPart("l1", "deck-1x1", 0, 1, 1),
      gridPart("l2", "deck-1x1", 0, 1, 2),
      gridPart("l3", "deck-1x1", 0, 1, 3),
      gridPart("br", "bridge", 1, 1, 0),
    ]);
    expect(attachPointsOf(bridgeShip, "br")).toEqual([]);
  });

  it("gives a davit one boat mount hanging outboard", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 0),
      gridPart("b", "deck-1x1", 1, 2, 0),
      attachPart("dv", "davit", "b", "davit:2:0"),
    ]);
    const [mount] = attachPointsOf(ship, "dv");
    expect(mount.id).toBe("boat");
    expect(mount.type).toBe("boat-mount");
    expect(mount.side).toBe("starboard");
    expect(mount.position.x).toBeCloseTo(2.5);
    expect(mount.position.y).toBeCloseTo(2.8);
    expect(mount.position.z).toBeCloseTo(-0.6);
  });

  it("returns nothing for unknown parents", () => {
    expect(attachPointsOf(testShip(), "missing")).toEqual([]);
  });

  it("resolves anchors and reports taken points", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 1),
      attachPart("f", "funnel", "a", "funnel"),
    ]);
    expect(
      resolveAttachPoint(ship, {
        kind: "attach",
        parentId: "a",
        pointId: "funnel",
      })?.type
    ).toBe("funnel-mount");
    expect(isPointTaken(ship, "a", "funnel")).toBe(true);
    expect(isPointTaken(ship, HULL_ID, "mast-fore")).toBe(false);
  });

  it("lists open points of the right type, honoring allowedPointIds", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 1),
      gridPart("b", "deck-1x1", 0, 3, 1),
      attachPart("f", "funnel", "a", "funnel"),
      attachPart("m", "mast-fore", HULL_ID, "mast-fore"),
    ]);
    const funnelDef = getPartDef("funnel") as AttachPartDef;
    expect(openAttachPoints(ship, funnelDef)).toEqual([
      { parentId: "b", point: expect.objectContaining({ id: "funnel" }) },
    ]);
    const foreDef = getPartDef("mast-fore") as AttachPartDef;
    expect(openAttachPoints(ship, foreDef)).toEqual([]);
    const aftDef = getPartDef("mast-aft") as AttachPartDef;
    expect(openAttachPoints(ship, aftDef).map((o) => o.point.id)).toEqual([
      "mast-aft",
    ]);
  });
});
```

- [ ] **Step 3: Run both tests.** `npm test -- --testPathPatterns="ship-builder/model/__tests__/(grid|attach)"`. Expected: FAIL (cannot find module `../grid` / `../attach`).

- [ ] **Step 4: Write `lib/ship-builder/model/grid.ts`.**

```ts
import { getPartDef } from "./catalog";
import type {
  Cell,
  GridAnchor,
  GridPartDef,
  PlacedPart,
  Rotation,
  Ship,
} from "./types";

export const CELLS_PER_SEGMENT = 3;
export const GRID_WIDTH = 4;
export const MAX_LEVEL = 3;
export const MIN_SEGMENTS = 4;
export const MAX_SEGMENTS = 12;

/** Cell key → the grid part occupying it. */
export type Occupancy = Map<string, PlacedPart>;

export function gridLength(ship: Ship): number {
  return ship.hull.lengthSegments * CELLS_PER_SEGMENT;
}

export function cellKey(cell: Cell): string {
  return `${cell.level}:${cell.x}:${cell.z}`;
}

export function rotatedFootprint(
  footprint: { x: number; z: number },
  rotation: Rotation
): { x: number; z: number } {
  return rotation === 90 || rotation === 270
    ? { x: footprint.z, z: footprint.x }
    : footprint;
}

export function footprintCells(
  def: GridPartDef,
  anchor: GridAnchor,
  rotation: Rotation
): Cell[] {
  const size = rotatedFootprint(def.footprint, rotation);
  const cells: Cell[] = [];
  for (let dx = 0; dx < size.x; dx++) {
    for (let dz = 0; dz < size.z; dz++) {
      cells.push({ level: anchor.level, x: anchor.x + dx, z: anchor.z + dz });
    }
  }
  return cells;
}

export function partCells(part: PlacedPart): Cell[] {
  const def = getPartDef(part.type);
  if (def.placement !== "grid" || part.anchor.kind !== "grid") return [];
  return footprintCells(def, part.anchor, part.rotation);
}

export function inBounds(ship: Ship, cell: Cell): boolean {
  return (
    cell.level >= 0 &&
    cell.level <= MAX_LEVEL &&
    cell.x >= 0 &&
    cell.x < gridLength(ship) &&
    cell.z >= 0 &&
    cell.z < GRID_WIDTH
  );
}

export function isForwardHalf(ship: Ship, x: number): boolean {
  return x < gridLength(ship) / 2;
}

export function buildOccupancy(ship: Ship): Occupancy {
  const occupancy: Occupancy = new Map();
  for (const part of ship.parts) {
    for (const cell of partCells(part)) occupancy.set(cellKey(cell), part);
  }
  return occupancy;
}

/** Highest occupied level in a column, or -1 when the column is empty. */
export function topLevel(occupancy: Occupancy, x: number, z: number): number {
  for (let level = MAX_LEVEL; level >= 0; level--) {
    if (occupancy.has(cellKey({ level, x, z }))) return level;
  }
  return -1;
}
```

- [ ] **Step 5: Write `lib/ship-builder/model/attach.ts`.**

```ts
import { getPartDef } from "./catalog";
import {
  buildOccupancy,
  cellKey,
  GRID_WIDTH,
  gridLength,
  partCells,
  rotatedFootprint,
  type Occupancy,
} from "./grid";
import {
  HULL_ID,
  type AttachAnchor,
  type AttachPartDef,
  type AttachPoint,
  type PlacedPart,
  type Ship,
} from "./types";

/** Prow extends forward of x = 0; stern extends aft of the last cell. */
export const PROW_LENGTH = 2;
export const STERN_LENGTH = 1.5;
const DAVIT_HEIGHT = 0.8;
const DAVIT_REACH = 0.6;

function hullPoints(ship: Ship): AttachPoint[] {
  const length = gridLength(ship);
  return [
    {
      id: "mast-fore",
      type: "mast-mount",
      position: { x: -PROW_LENGTH / 2, y: 0, z: GRID_WIDTH / 2 },
    },
    {
      id: "mast-aft",
      type: "mast-mount",
      position: { x: length + STERN_LENGTH / 2, y: 0, z: GRID_WIDTH / 2 },
    },
  ];
}

function isCovered(part: PlacedPart, occupancy: Occupancy): boolean {
  return partCells(part).some((cell) =>
    occupancy.has(cellKey({ ...cell, level: cell.level + 1 }))
  );
}

function blockPoints(part: PlacedPart, occupancy: Occupancy): AttachPoint[] {
  const def = getPartDef(part.type);
  if (def.placement !== "grid" || part.anchor.kind !== "grid") return [];
  const { level, x, z } = part.anchor;
  const points: AttachPoint[] = [];

  if (def.role === "deck" && !isCovered(part, occupancy)) {
    const size = rotatedFootprint(def.footprint, part.rotation);
    points.push({
      id: "funnel",
      type: "funnel-mount",
      position: { x: x + size.x / 2, y: level + 1, z: z + size.z / 2 },
    });
  }

  if (def.role !== "bridge" && level >= 1) {
    for (const cell of partCells(part)) {
      const outboard = cell.z === 0 || cell.z === GRID_WIDTH - 1;
      const covered = occupancy.has(
        cellKey({ ...cell, level: cell.level + 1 })
      );
      if (!outboard || covered) continue;
      const starboard = cell.z === 0;
      points.push({
        id: `davit:${cell.x}:${cell.z}`,
        type: "davit-point",
        position: {
          x: cell.x + 0.5,
          y: level + 1,
          z: starboard ? 0 : GRID_WIDTH,
        },
        side: starboard ? "starboard" : "port",
      });
    }
  }

  return points;
}

function davitPoints(
  ship: Ship,
  part: PlacedPart,
  occupancy: Occupancy
): AttachPoint[] {
  if (part.anchor.kind !== "attach") return [];
  const base = resolveAttachPoint(ship, part.anchor, occupancy);
  if (!base) return [];
  // Starboard is z = 0, so outboard is -z there and +z on the port side.
  const outward = base.side === "starboard" ? -1 : 1;
  return [
    {
      id: "boat",
      type: "boat-mount",
      position: {
        x: base.position.x,
        y: base.position.y + DAVIT_HEIGHT,
        z: base.position.z + outward * DAVIT_REACH,
      },
      side: base.side,
    },
  ];
}

/** Every attach point a parent currently exposes, taken or not. */
export function attachPointsOf(
  ship: Ship,
  parentId: string,
  occupancy: Occupancy = buildOccupancy(ship)
): AttachPoint[] {
  if (parentId === HULL_ID) return hullPoints(ship);
  const part = ship.parts.find((p) => p.id === parentId);
  if (!part) return [];
  if (part.type === "davit") return davitPoints(ship, part, occupancy);
  return blockPoints(part, occupancy);
}

export function resolveAttachPoint(
  ship: Ship,
  anchor: AttachAnchor,
  occupancy: Occupancy = buildOccupancy(ship)
): AttachPoint | undefined {
  return attachPointsOf(ship, anchor.parentId, occupancy).find(
    (point) => point.id === anchor.pointId
  );
}

export function isPointTaken(
  ship: Ship,
  parentId: string,
  pointId: string
): boolean {
  return ship.parts.some(
    (part) =>
      part.anchor.kind === "attach" &&
      part.anchor.parentId === parentId &&
      part.anchor.pointId === pointId
  );
}

export function pointFitsPart(def: AttachPartDef, point: AttachPoint): boolean {
  return (
    point.type === def.attachTo &&
    (!def.allowedPointIds || def.allowedPointIds.includes(point.id))
  );
}

/** Free points this attach part could go on right now. */
export function openAttachPoints(
  ship: Ship,
  def: AttachPartDef
): { parentId: string; point: AttachPoint }[] {
  const occupancy = buildOccupancy(ship);
  const parentIds = [HULL_ID, ...ship.parts.map((part) => part.id)];
  return parentIds.flatMap((parentId) =>
    attachPointsOf(ship, parentId, occupancy)
      .filter(
        (point) =>
          pointFitsPart(def, point) && !isPointTaken(ship, parentId, point.id)
      )
      .map((point) => ({ parentId, point }))
  );
}
```

- [ ] **Step 6: Run the tests.** Same command as Verify. Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add lib/ship-builder/model
git commit -m "feat(ship-builder): add grid math and attach points"
```

---

### Task 3: Placement rules, cascade removal, hull length, ship validation

**Goal:** Implement every building rule as a pure function, plus cascade removal, hull resize and whole-ship validation.

**Files:**

- Create: `lib/ship-builder/model/placement.ts`
- Test: `lib/ship-builder/model/__tests__/placement.test.ts`

**Acceptance Criteria:**

- [ ] Rules 1–6 each reject with the reason strings shown in the test
- [ ] Removal cascades through supported blocks and attached parts (transitively)
- [ ] A 2×1 block loses support if either cell beneath goes
- [ ] Shrinking the hull removes out-of-bounds parts plus their dependents; growing removes nothing
- [ ] `validateShip` rejects duplicate ids, out-of-order parents, invalid parts and an out-of-range hull

**Verify:** `npm test -- --testPathPatterns=ship-builder/model/__tests__/placement` → PASS

**Steps:**

- [ ] **Step 1: Write the failing test `lib/ship-builder/model/__tests__/placement.test.ts`.**

```ts
import {
  canPlace,
  cascadeIds,
  emptyShip,
  place,
  previewHullLength,
  removeParts,
  removeWithCascade,
  setHullLength,
  validateShip,
  type PartCandidate,
} from "../placement";
import { HULL_ID, type PartType, type Rotation } from "../types";
import { attachPart, gridPart, testShip } from "../../testing";

function gridCandidate(
  type: PartType,
  level: number,
  x: number,
  z: number,
  rotation: Rotation = 0
): PartCandidate {
  return { type, anchor: { kind: "grid", level, x, z }, rotation };
}

function attachCandidate(
  type: PartType,
  parentId: string,
  pointId: string
): PartCandidate {
  return { type, anchor: { kind: "attach", parentId, pointId }, rotation: 0 };
}

const fail = (reason: string) => ({ ok: false, reason });
const OK = { ok: true };

/** Two-level stack at (2, 0) with a davit and a boat on the top block. */
function boatDeckShip() {
  return testShip([
    gridPart("a", "deck-1x1", 0, 2, 0),
    gridPart("b", "deck-1x1", 1, 2, 0),
    attachPart("dv", "davit", "b", "davit:2:0"),
    attachPart("lb", "lifeboat-standard", "dv", "boat"),
  ]);
}

describe("canPlace — grid parts", () => {
  it("allows a block on the main deck", () => {
    expect(canPlace(testShip(), gridCandidate("deck-1x1", 0, 0, 0))).toEqual(
      OK
    );
  });

  it("rejects cells outside the hull", () => {
    const ship = testShip(); // 24 x 4
    expect(canPlace(ship, gridCandidate("deck-1x1", 0, 24, 0))).toEqual(
      fail("Outside the hull")
    );
    expect(canPlace(ship, gridCandidate("deck-1x1", 0, 0, 4))).toEqual(
      fail("Outside the hull")
    );
    expect(canPlace(ship, gridCandidate("deck-1x1", 4, 0, 0))).toEqual(
      fail("Outside the hull")
    );
    expect(canPlace(ship, gridCandidate("deck-2x1", 0, 23, 0))).toEqual(
      fail("Outside the hull")
    );
    expect(canPlace(ship, gridCandidate("deck-2x1", 0, 0, 3, 90))).toEqual(
      fail("Outside the hull")
    );
  });

  it("rejects overlapping parts (rule 2)", () => {
    const ship = testShip([gridPart("a", "deck-2x1", 0, 4, 1)]);
    expect(canPlace(ship, gridCandidate("cabin-3rd", 0, 5, 1))).toEqual(
      fail("That space is taken")
    );
  });

  it("requires support under every cell above level 0 (rule 1)", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 4, 1)]);
    expect(canPlace(ship, gridCandidate("deck-1x1", 1, 4, 1))).toEqual(OK);
    expect(canPlace(ship, gridCandidate("deck-1x1", 1, 6, 1))).toEqual(
      fail("Needs a deck beneath every cell")
    );
    expect(canPlace(ship, gridCandidate("deck-2x1", 1, 4, 1))).toEqual(
      fail("Needs a deck beneath every cell")
    );
  });

  it("refuses to build over a bridge, funnel or davit (rule 6)", () => {
    const fullBeam = [0, 1, 2, 3].map((z) =>
      gridPart(`l${z}`, "deck-1x1", 0, 1, z)
    );
    const withBridge = testShip([
      ...fullBeam,
      gridPart("br", "bridge", 1, 1, 0),
    ]);
    expect(canPlace(withBridge, gridCandidate("deck-1x1", 2, 1, 2))).toEqual(
      fail("Can't build on top of the bridge")
    );

    const withFunnel = testShip([
      gridPart("a", "deck-2x1", 0, 4, 1),
      attachPart("f", "funnel", "a", "funnel"),
    ]);
    expect(canPlace(withFunnel, gridCandidate("deck-1x1", 1, 5, 1))).toEqual(
      fail("Can't build over a funnel")
    );

    expect(
      canPlace(boatDeckShip(), gridCandidate("deck-1x1", 2, 2, 0))
    ).toEqual(fail("Can't build over a davit"));
  });

  it("keeps the bridge in the forward half (rule 3)", () => {
    const ship = testShip(); // length 24, half = 12
    expect(canPlace(ship, gridCandidate("bridge", 0, 11, 0))).toEqual(OK);
    expect(canPlace(ship, gridCandidate("bridge", 0, 12, 0))).toEqual(
      fail("The bridge must be in the forward half")
    );
    expect(canPlace(ship, gridCandidate("bridge", 0, 8, 0, 90))).toEqual(OK);
    expect(canPlace(ship, gridCandidate("bridge", 0, 9, 0, 90))).toEqual(
      fail("The bridge must be in the forward half")
    );
  });

  it("keeps the bridge on top of its stack (rule 3)", () => {
    // Hand-built, inconsistent ship: something floats above the target cells.
    const ship = testShip([gridPart("float", "deck-1x1", 1, 2, 2)]);
    expect(canPlace(ship, gridCandidate("bridge", 0, 2, 0))).toEqual(
      fail("The bridge must be on top of its stack")
    );
  });

  it("rejects a grid part given an attach anchor", () => {
    expect(
      canPlace(testShip(), attachCandidate("deck-1x1", HULL_ID, "mast-fore"))
    ).toEqual(fail("Place this on the deck grid"));
  });
});

describe("canPlace — attach parts (rules 4 and 5)", () => {
  it("puts a funnel on a deck block, not on a cabin", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 4, 1),
      gridPart("c", "cabin-1st", 0, 6, 1),
    ]);
    expect(canPlace(ship, attachCandidate("funnel", "a", "funnel"))).toEqual(
      OK
    );
    expect(canPlace(ship, attachCandidate("funnel", "c", "funnel"))).toEqual(
      fail("Needs a free funnel mount on a deck block")
    );
  });

  it("allows one part per attach point", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 4, 1),
      attachPart("f", "funnel", "a", "funnel"),
    ]);
    expect(canPlace(ship, attachCandidate("funnel", "a", "funnel"))).toEqual(
      fail("That spot is taken")
    );
  });

  it("matches masts to their own mount", () => {
    const ship = testShip();
    expect(
      canPlace(ship, attachCandidate("mast-fore", HULL_ID, "mast-fore"))
    ).toEqual(OK);
    expect(
      canPlace(ship, attachCandidate("mast-fore", HULL_ID, "mast-aft"))
    ).toEqual(fail("Needs a free mast mount"));
  });

  it("puts davits only on boat-deck edges at level 1 or higher", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 0),
      gridPart("b", "deck-1x1", 1, 2, 0),
    ]);
    expect(canPlace(ship, attachCandidate("davit", "a", "davit:2:0"))).toEqual(
      fail("Needs a free boat-deck edge")
    );
    expect(canPlace(ship, attachCandidate("davit", "b", "davit:2:0"))).toEqual(
      OK
    );
  });

  it("hangs one lifeboat per davit and only from davits", () => {
    const ship = testShip([
      gridPart("a", "deck-1x1", 0, 2, 0),
      gridPart("b", "deck-1x1", 1, 2, 0),
      attachPart("dv", "davit", "b", "davit:2:0"),
    ]);
    expect(
      canPlace(ship, attachCandidate("lifeboat-collapsible", "dv", "boat"))
    ).toEqual(OK);
    expect(
      canPlace(
        boatDeckShip(),
        attachCandidate("lifeboat-standard", "dv", "boat")
      )
    ).toEqual(fail("That spot is taken"));
    expect(
      canPlace(ship, attachCandidate("lifeboat-standard", HULL_ID, "mast-fore"))
    ).toEqual(fail("Needs a free davit"));
  });

  it("rejects an attach part given a grid anchor", () => {
    expect(canPlace(testShip(), gridCandidate("funnel", 0, 0, 0))).toEqual(
      fail("Needs a free funnel mount on a deck block")
    );
  });
});

describe("place", () => {
  it("appends a valid part without mutating the input", () => {
    const ship = testShip();
    const result = place(ship, gridPart("a", "deck-1x1", 0, 0, 0));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ship.parts).toHaveLength(1);
    expect(ship.parts).toHaveLength(0);
  });

  it("returns the rule's reason for an invalid part", () => {
    expect(place(testShip(), gridPart("a", "deck-1x1", 1, 0, 0))).toEqual(
      fail("Needs a deck beneath every cell")
    );
  });

  it("rejects duplicate ids", () => {
    const ship = testShip([gridPart("a", "deck-1x1", 0, 0, 0)]);
    expect(place(ship, gridPart("a", "deck-1x1", 0, 1, 0))).toEqual(
      fail("Duplicate part id")
    );
  });
});

describe("cascade removal", () => {
  it("removes everything supported by or attached to a part", () => {
    const ship = testShip([
      ...boatDeckShip().parts,
      gridPart("other", "deck-1x1", 0, 10, 1),
    ]);
    expect(cascadeIds(ship, ["a"])).toEqual(["a", "b", "dv", "lb"]);
    expect(removeWithCascade(ship, "a").parts.map((p) => p.id)).toEqual([
      "other",
    ]);
  });

  it("removes a 2x1 block when either supporting cell goes", () => {
    const ship = testShip([
      gridPart("l", "deck-1x1", 0, 4, 1),
      gridPart("r", "deck-1x1", 0, 5, 1),
      gridPart("top", "deck-2x1", 1, 4, 1),
    ]);
    expect(cascadeIds(ship, ["r"])).toEqual(["r", "top"]);
  });

  it("removing a leaf removes only the leaf", () => {
    expect(cascadeIds(boatDeckShip(), ["lb"])).toEqual(["lb"]);
  });

  it("removeParts drops exactly the given ids", () => {
    expect(removeParts(boatDeckShip(), ["lb", "dv"]).parts).toHaveLength(2);
  });
});

describe("hull length", () => {
  it("previews and removes parts beyond the new stern, with cascade", () => {
    const ship = testShip([
      gridPart("fwd", "deck-1x1", 0, 2, 1),
      gridPart("aft", "deck-1x1", 0, 20, 1),
      gridPart("aftTop", "deck-1x1", 1, 20, 1),
      gridPart("edge", "deck-2x1", 0, 11, 2), // covers x 11-12
      attachPart("mast", "mast-aft", HULL_ID, "mast-aft"),
    ]);
    expect(previewHullLength(ship, 4)).toEqual(["aft", "aftTop", "edge"]);
    const shrunk = setHullLength(ship, 4);
    expect(shrunk.hull.lengthSegments).toBe(4);
    expect(shrunk.parts.map((p) => p.id)).toEqual(["fwd", "mast"]);
  });

  it("growing keeps every part", () => {
    const ship = boatDeckShip();
    expect(previewHullLength(ship, 12)).toEqual([]);
    expect(setHullLength(ship, 12).parts).toHaveLength(4);
  });
});

describe("validateShip", () => {
  it("accepts a ship built through valid placements", () => {
    expect(validateShip(boatDeckShip())).toEqual(OK);
    expect(validateShip(emptyShip())).toEqual(OK);
  });

  it("rejects a hull outside 4-12 segments", () => {
    expect(validateShip(testShip([], 3)).ok).toBe(false);
    expect(validateShip(testShip([], 13)).ok).toBe(false);
  });

  it("rejects parts listed before their parent", () => {
    const [a, b, dv, lb] = boatDeckShip().parts;
    expect(validateShip(testShip([a, b, lb, dv])).ok).toBe(false);
  });

  it("rejects floating blocks and duplicate ids", () => {
    expect(
      validateShip(testShip([gridPart("a", "deck-1x1", 1, 0, 0)])).ok
    ).toBe(false);
    expect(
      validateShip(
        testShip([
          gridPart("a", "deck-1x1", 0, 0, 0),
          gridPart("a", "deck-1x1", 0, 1, 0),
        ])
      ).ok
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test.** Expected: FAIL, cannot find module `../placement`.

- [ ] **Step 3: Write `lib/ship-builder/model/placement.ts`.**

```ts
import { attachPointsOf, isPointTaken, pointFitsPart } from "./attach";
import { ATTACH_POINT_LABELS, getPartDef } from "./catalog";
import {
  buildOccupancy,
  cellKey,
  footprintCells,
  inBounds,
  isForwardHalf,
  MAX_SEGMENTS,
  MIN_SEGMENTS,
  partCells,
  type Occupancy,
} from "./grid";
import type { AttachPartDef, GridPartDef, PlacedPart, Ship } from "./types";

export type RuleResult = { ok: true } | { ok: false; reason: string };
export type PartCandidate = Omit<PlacedPart, "id">;

export const MAX_NAME_LENGTH = 60;
export const DEFAULT_SEGMENTS = 8;

const OK: RuleResult = { ok: true };
const fail = (reason: string): RuleResult => ({ ok: false, reason });

export function emptyShip(
  name = "Untitled liner",
  lengthSegments = DEFAULT_SEGMENTS
): Ship {
  return { v: 1, name, hull: { lengthSegments }, parts: [] };
}

function holdsFunnel(ship: Ship, block: PlacedPart): boolean {
  return ship.parts.some(
    (p) =>
      p.type === "funnel" &&
      p.anchor.kind === "attach" &&
      p.anchor.parentId === block.id
  );
}

function holdsDavitAt(
  ship: Ship,
  block: PlacedPart,
  x: number,
  z: number
): boolean {
  return ship.parts.some(
    (p) =>
      p.type === "davit" &&
      p.anchor.kind === "attach" &&
      p.anchor.parentId === block.id &&
      p.anchor.pointId === `davit:${x}:${z}`
  );
}

function canPlaceGrid(
  ship: Ship,
  def: GridPartDef,
  candidate: PartCandidate,
  occupancy: Occupancy
): RuleResult {
  if (candidate.anchor.kind !== "grid") {
    return fail("Place this on the deck grid");
  }
  const cells = footprintCells(def, candidate.anchor, candidate.rotation);

  if (cells.some((cell) => !inBounds(ship, cell))) {
    return fail("Outside the hull");
  }
  if (cells.some((cell) => occupancy.has(cellKey(cell)))) {
    return fail("That space is taken");
  }

  if (candidate.anchor.level > 0) {
    for (const cell of cells) {
      const below = occupancy.get(cellKey({ ...cell, level: cell.level - 1 }));
      if (!below) return fail("Needs a deck beneath every cell");
      if (below.type === "bridge") {
        return fail("Can't build on top of the bridge");
      }
      if (holdsFunnel(ship, below)) return fail("Can't build over a funnel");
      if (holdsDavitAt(ship, below, cell.x, cell.z)) {
        return fail("Can't build over a davit");
      }
    }
  }

  if (def.role === "bridge") {
    if (cells.some((cell) => !isForwardHalf(ship, cell.x))) {
      return fail("The bridge must be in the forward half");
    }
    const covered = cells.some((cell) =>
      occupancy.has(cellKey({ ...cell, level: cell.level + 1 }))
    );
    if (covered) return fail("The bridge must be on top of its stack");
  }

  return OK;
}

function canPlaceAttach(
  ship: Ship,
  def: AttachPartDef,
  candidate: PartCandidate,
  occupancy: Occupancy
): RuleResult {
  const missing = fail(`Needs a free ${ATTACH_POINT_LABELS[def.attachTo]}`);
  if (candidate.anchor.kind !== "attach") return missing;
  const { parentId, pointId } = candidate.anchor;
  const point = attachPointsOf(ship, parentId, occupancy).find(
    (p) => p.id === pointId
  );
  if (!point || !pointFitsPart(def, point)) return missing;
  if (isPointTaken(ship, parentId, pointId)) return fail("That spot is taken");
  return OK;
}

export function canPlace(
  ship: Ship,
  candidate: PartCandidate,
  occupancy: Occupancy = buildOccupancy(ship)
): RuleResult {
  const def = getPartDef(candidate.type);
  return def.placement === "grid"
    ? canPlaceGrid(ship, def, candidate, occupancy)
    : canPlaceAttach(ship, def, candidate, occupancy);
}

export function place(
  ship: Ship,
  part: PlacedPart
): { ok: true; ship: Ship } | { ok: false; reason: string } {
  if (ship.parts.some((p) => p.id === part.id)) {
    return { ok: false, reason: "Duplicate part id" };
  }
  const result = canPlace(ship, part);
  if (!result.ok) return result;
  return { ok: true, ship: { ...ship, parts: [...ship.parts, part] } };
}

/**
 * Structural check only (bounds, support, attach point exists). Used to find
 * parts left dangling after a removal or a hull shrink.
 */
function isStillSupported(
  ship: Ship,
  part: PlacedPart,
  occupancy: Occupancy
): boolean {
  if (part.anchor.kind === "attach") {
    const { parentId, pointId } = part.anchor;
    return attachPointsOf(ship, parentId, occupancy).some(
      (p) => p.id === pointId
    );
  }
  return partCells(part).every(
    (cell) =>
      inBounds(ship, cell) &&
      (cell.level === 0 ||
        occupancy.has(cellKey({ ...cell, level: cell.level - 1 })))
  );
}

/** Root ids plus everything that loses support without them, in ship order. */
export function cascadeIds(ship: Ship, rootIds: string[]): string[] {
  const removed = new Set(rootIds);
  let changed = true;
  while (changed) {
    changed = false;
    const remaining: Ship = {
      ...ship,
      parts: ship.parts.filter((p) => !removed.has(p.id)),
    };
    const occupancy = buildOccupancy(remaining);
    for (const part of remaining.parts) {
      if (!isStillSupported(remaining, part, occupancy)) {
        removed.add(part.id);
        changed = true;
      }
    }
  }
  return ship.parts.filter((p) => removed.has(p.id)).map((p) => p.id);
}

export function removeParts(ship: Ship, ids: string[]): Ship {
  const drop = new Set(ids);
  return { ...ship, parts: ship.parts.filter((p) => !drop.has(p.id)) };
}

export function removeWithCascade(ship: Ship, partId: string): Ship {
  return removeParts(ship, cascadeIds(ship, [partId]));
}

function withLength(ship: Ship, lengthSegments: number): Ship {
  return { ...ship, hull: { lengthSegments } };
}

export function previewHullLength(
  ship: Ship,
  lengthSegments: number
): string[] {
  return cascadeIds(withLength(ship, lengthSegments), []);
}

export function setHullLength(ship: Ship, lengthSegments: number): Ship {
  const resized = withLength(ship, lengthSegments);
  return removeParts(resized, cascadeIds(resized, []));
}

/** Re-applies every placement in order; used on loaded or shared data. */
export function validateShip(ship: Ship): RuleResult {
  const { lengthSegments } = ship.hull;
  if (
    !Number.isInteger(lengthSegments) ||
    lengthSegments < MIN_SEGMENTS ||
    lengthSegments > MAX_SEGMENTS
  ) {
    return fail("Hull length out of range");
  }
  let built: Ship = { ...ship, parts: [] };
  for (const part of ship.parts) {
    const result = place(built, part);
    if (!result.ok) return fail(`Part ${part.id}: ${result.reason}`);
    built = result.ship;
  }
  return OK;
}
```

- [ ] **Step 4: Run the test.** Expected: PASS. If `previewHullLength` returns ids in a different order, check that `cascadeIds` filters in ship order. Don't change the test to fit.

- [ ] **Step 5: Commit.**

```bash
git add lib/ship-builder/model
git commit -m "feat(ship-builder): add placement rules, cascade removal, and hull resize"
```

---

### Task 4: Live stats

**Goal:** Build `computeStats(ship)` with passengers, crew, lifeboat coverage, tonnage, speed, stability, warnings, and a Titanic reference.

**Files:**

- Create: `lib/ship-builder/model/stats.ts`
- Test: `lib/ship-builder/model/__tests__/stats.test.ts`

**Acceptance Criteria:**

- [ ] Every formula matches the constants table at the top of this plan
- [ ] Coverage thresholds: red < 50%, amber 50–99%, green ≥ 100%
- [ ] Warnings appear in this order: lifeboats, no-bridge, no-funnels, top-heavy
- [ ] `TITANIC_REFERENCE` = 46,328 GRT, 21 kn, 20 boats, 1,178 seats, 2,224 aboard

**Verify:** `npm test -- --testPathPatterns=ship-builder/model/__tests__/stats` → PASS

**Steps:**

- [ ] **Step 1: Write the failing test `lib/ship-builder/model/__tests__/stats.test.ts`.**

```ts
import { computeStats, coverageLevel, TITANIC_REFERENCE } from "../stats";
import { GRID_WIDTH } from "../grid";
import type { PlacedPart } from "../types";
import { attachPart, gridPart, testShip } from "../../testing";

function fillLevel(level: number, lengthCells: number): PlacedPart[] {
  const parts: PlacedPart[] = [];
  for (let x = 0; x < lengthCells; x++) {
    for (let z = 0; z < GRID_WIDTH; z++) {
      parts.push(gridPart(`L${level}-${x}-${z}`, "deck-1x1", level, x, z));
    }
  }
  return parts;
}

describe("computeStats", () => {
  it("reports an empty 8-segment hull", () => {
    const stats = computeStats(testShip());
    expect(stats.passengers).toEqual({
      first: 0,
      second: 0,
      third: 0,
      total: 0,
    });
    expect(stats.crew).toBe(480);
    expect(stats.peopleAboard).toBe(480);
    expect(stats.lifeboats).toBe(0);
    expect(stats.lifeboatSeats).toBe(0);
    expect(stats.coverage).toBe(0);
    expect(stats.coverageLevel).toBe("red");
    expect(stats.grossTonnage).toBe(24192);
    expect(stats.topSpeedKnots).toBe(0);
    expect(stats.stability).toBe("Stable");
  });

  it("counts passengers per cabin class", () => {
    const stats = computeStats(
      testShip([
        gridPart("a", "cabin-1st", 0, 0, 0),
        gridPart("b", "cabin-2nd", 0, 1, 0),
        gridPart("c", "cabin-3rd", 0, 2, 0),
        gridPart("d", "cabin-3rd", 0, 3, 0),
      ])
    );
    expect(stats.passengers).toEqual({
      first: 30,
      second: 50,
      third: 240,
      total: 320,
    });
    expect(stats.peopleAboard).toBe(800);
  });

  it("adds stokers per funnel and computes speed", () => {
    const parts = [0, 1, 2, 3].flatMap((i) => [
      gridPart(`d${i}`, "deck-1x1", 0, i * 3, 1),
      attachPart(`f${i}`, "funnel", `d${i}`, "funnel"),
    ]);
    const stats = computeStats(testShip(parts, 12));
    expect(stats.crew).toBe(12 * 60 + 4 * 40);
    expect(stats.grossTonnage).toBe((576 + 4) * 63);
    // 14 + 4*2.2 + 12*0.25 - 36540/10000 = 22.146
    expect(stats.topSpeedKnots).toBe(22.1);
  });

  it("clamps speed to the sane range", () => {
    const parts = Array.from({ length: 10 }, (_, i) => [
      gridPart(`d${i}`, "deck-1x1", 0, i, 0),
      attachPart(`f${i}`, "funnel", `d${i}`, "funnel"),
    ]).flat();
    expect(computeStats(testShip(parts, 12)).topSpeedKnots).toBeLessThanOrEqual(
      30
    );
  });

  it("sums lifeboat seats and coverage", () => {
    const stats = computeStats(
      testShip([
        gridPart("a", "deck-1x1", 0, 2, 0),
        gridPart("b", "deck-1x1", 1, 2, 0),
        attachPart("dv", "davit", "b", "davit:2:0"),
        attachPart("lb", "lifeboat-standard", "dv", "boat"),
        gridPart("c", "deck-1x1", 0, 3, 0),
        gridPart("e", "deck-1x1", 1, 3, 0),
        attachPart("dv2", "davit", "e", "davit:3:0"),
        attachPart("lb2", "lifeboat-collapsible", "dv2", "boat"),
      ])
    );
    expect(stats.lifeboats).toBe(2);
    expect(stats.lifeboatSeats).toBe(112);
    expect(stats.coverage).toBeCloseTo(112 / 480);
  });

  it("classifies stability by center of mass vs beam", () => {
    const len = 12; // 4 segments
    const two = [...fillLevel(0, len), ...fillLevel(1, len)];
    const three = [...two, ...fillLevel(2, len)];
    const four = [...three, ...fillLevel(3, len)];
    expect(computeStats(testShip(two, 4)).stability).toBe("Stable");
    expect(computeStats(testShip(three, 4)).stability).toBe("Top-heavy");
    expect(computeStats(testShip(four, 4)).stability).toBe("Dangerous");
  });

  it("warns about lifeboats, bridge, funnels in order", () => {
    expect(computeStats(testShip()).warnings).toEqual([
      {
        code: "lifeboats",
        message: "Lifeboats seat 0 of 480 aboard (480 short)",
      },
      { code: "no-bridge", message: "No bridge — someone has to steer" },
      { code: "no-funnels", message: "No funnels — she isn't going anywhere" },
    ]);
  });

  it("warns when top-heavy", () => {
    const len = 12;
    const parts = [0, 1, 2, 3].flatMap((level) => fillLevel(level, len));
    const codes = computeStats(testShip(parts, 4)).warnings.map((w) => w.code);
    expect(codes).toContain("top-heavy");
  });
});

describe("coverageLevel", () => {
  it("uses red / amber / green thresholds", () => {
    expect(coverageLevel(0.49)).toBe("red");
    expect(coverageLevel(0.5)).toBe("amber");
    expect(coverageLevel(0.99)).toBe("amber");
    expect(coverageLevel(1)).toBe("green");
  });
});

describe("TITANIC_REFERENCE", () => {
  it("matches the historical figures", () => {
    expect(TITANIC_REFERENCE).toEqual({
      grossTonnage: 46328,
      topSpeedKnots: 21,
      lifeboats: 20,
      lifeboatSeats: 1178,
      peopleAboard: 2224,
    });
  });
});
```

- [ ] **Step 2: Run the test.** Expected: FAIL, cannot find module `../stats`.

- [ ] **Step 3: Write `lib/ship-builder/model/stats.ts`.**

```ts
import { resolveAttachPoint } from "./attach";
import { getPartDef } from "./catalog";
import {
  buildOccupancy,
  GRID_WIDTH,
  gridLength,
  partCells,
  type Occupancy,
} from "./grid";
import type { PlacedPart, Ship } from "./types";

// Tunable constants — see the plan's calibration table.
export const CREW_PER_SEGMENT = 60;
export const HULL_DEPTH = 4;
export const GRT_PER_UNIT = 63;
export const SPEED = {
  base: 14,
  perFunnel: 2.2,
  maxFunnelsCounted: 6,
  perSegment: 0.25,
  lossPer10kTons: 1,
  min: 8,
  max: 30,
};
export const HULL_MASS_PER_CELL = 1;
export const HULL_CENTROID_Y = -1;
export const STABILITY_THRESHOLDS = { topHeavy: 0.15, dangerous: 0.3 };

export const TITANIC_REFERENCE = {
  grossTonnage: 46328,
  topSpeedKnots: 21,
  lifeboats: 20,
  lifeboatSeats: 1178,
  peopleAboard: 2224,
};

export type CoverageLevel = "red" | "amber" | "green";
export type Stability = "Stable" | "Top-heavy" | "Dangerous";
export type WarningCode =
  | "lifeboats"
  | "no-bridge"
  | "no-funnels"
  | "top-heavy";

export interface StatWarning {
  code: WarningCode;
  message: string;
}

export interface Stats {
  passengers: { first: number; second: number; third: number; total: number };
  crew: number;
  peopleAboard: number;
  lifeboats: number;
  lifeboatSeats: number;
  coverage: number;
  coverageLevel: CoverageLevel;
  grossTonnage: number;
  topSpeedKnots: number;
  stability: Stability;
  stabilityRatio: number;
  warnings: StatWarning[];
}

export function coverageLevel(coverage: number): CoverageLevel {
  if (coverage < 0.5) return "red";
  if (coverage < 1) return "amber";
  return "green";
}

function partBaseY(ship: Ship, part: PlacedPart, occupancy: Occupancy): number {
  if (part.anchor.kind === "grid") return part.anchor.level;
  return resolveAttachPoint(ship, part.anchor, occupancy)?.position.y ?? 0;
}

function computeSpeed(
  funnels: number,
  segments: number,
  grossTonnage: number
): number {
  if (funnels === 0) return 0;
  const raw =
    SPEED.base +
    Math.min(funnels, SPEED.maxFunnelsCounted) * SPEED.perFunnel +
    segments * SPEED.perSegment -
    (grossTonnage / 10000) * SPEED.lossPer10kTons;
  const clamped = Math.min(SPEED.max, Math.max(SPEED.min, raw));
  return Math.round(clamped * 10) / 10;
}

function classifyStability(ratio: number): Stability {
  if (ratio >= STABILITY_THRESHOLDS.dangerous) return "Dangerous";
  if (ratio >= STABILITY_THRESHOLDS.topHeavy) return "Top-heavy";
  return "Stable";
}

export function computeStats(ship: Ship): Stats {
  const occupancy = buildOccupancy(ship);
  const length = gridLength(ship);
  const passengers = { first: 0, second: 0, third: 0, total: 0 };
  let lifeboats = 0;
  let lifeboatSeats = 0;
  let stokers = 0;
  let funnels = 0;
  let bridges = 0;
  let blockCells = 0;

  const hullMass = length * GRID_WIDTH * HULL_MASS_PER_CELL;
  let mass = hullMass;
  let moment = hullMass * HULL_CENTROID_Y;

  for (const part of ship.parts) {
    const def = getPartDef(part.type);
    const cells = partCells(part).length;
    blockCells += cells;
    if (def.passengers) {
      passengers[def.passengers.cabinClass] += def.passengers.count * cells;
    }
    if (def.seats) {
      lifeboats += 1;
      lifeboatSeats += def.seats;
    }
    if (def.stokers) stokers += def.stokers;
    if (part.type === "funnel") funnels += 1;
    if (part.type === "bridge") bridges += 1;

    const partMass = def.placement === "grid" ? def.mass * cells : def.mass;
    mass += partMass;
    moment += partMass * (partBaseY(ship, part, occupancy) + def.height / 2);
  }

  passengers.total = passengers.first + passengers.second + passengers.third;
  const crew = ship.hull.lengthSegments * CREW_PER_SEGMENT + stokers;
  const peopleAboard = passengers.total + crew;
  const coverage = peopleAboard > 0 ? lifeboatSeats / peopleAboard : 1;
  const grossTonnage = Math.round(
    (length * GRID_WIDTH * HULL_DEPTH + blockCells) * GRT_PER_UNIT
  );
  const topSpeedKnots = computeSpeed(
    funnels,
    ship.hull.lengthSegments,
    grossTonnage
  );
  const stabilityRatio = moment / mass / GRID_WIDTH;
  const stability = classifyStability(stabilityRatio);

  const warnings: StatWarning[] = [];
  if (coverage < 1) {
    warnings.push({
      code: "lifeboats",
      message: `Lifeboats seat ${lifeboatSeats.toLocaleString("en-US")} of ${peopleAboard.toLocaleString("en-US")} aboard (${(peopleAboard - lifeboatSeats).toLocaleString("en-US")} short)`,
    });
  }
  if (bridges === 0) {
    warnings.push({
      code: "no-bridge",
      message: "No bridge — someone has to steer",
    });
  }
  if (funnels === 0) {
    warnings.push({
      code: "no-funnels",
      message: "No funnels — she isn't going anywhere",
    });
  }
  if (stability !== "Stable") {
    warnings.push({
      code: "top-heavy",
      message:
        stability === "Dangerous"
          ? "Dangerously top-heavy — she'll capsize"
          : "Top-heavy — lower the superstructure or lengthen the hull",
    });
  }

  return {
    passengers,
    crew,
    peopleAboard,
    lifeboats,
    lifeboatSeats,
    coverage,
    coverageLevel: coverageLevel(coverage),
    grossTonnage,
    topSpeedKnots,
    stability,
    stabilityRatio,
    warnings,
  };
}
```

- [ ] **Step 4: Run the test.** Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add lib/ship-builder/model
git commit -m "feat(ship-builder): add live stats and warnings"
```

---

### Task 5: Persistence — schema, share links, localStorage ⚠️ data boundary

**Goal:** Load untrusted ship data (share hash, localStorage) safely: migrate, validate with zod, re-check the rules, and never throw.

**Files:**

- Create: `lib/ship-builder/persist/schema.ts`
- Create: `lib/ship-builder/persist/share.ts`
- Create: `lib/ship-builder/persist/local.ts`
- Test: `lib/ship-builder/persist/__tests__/schema.test.ts`
- Test: `lib/ship-builder/persist/__tests__/share.test.ts`
- Test: `lib/ship-builder/persist/__tests__/local.test.ts`

**Acceptance Criteria:**

- [ ] `parseShip` returns `{ ok: false }` instead of throwing for any input: non-objects, wrong version, unknown part type, out-of-range hull, overlong name or too many parts, and rule violations
- [ ] Unknown keys are stripped
- [ ] Migrations run from older `v` up to `CURRENT_VERSION`
- [ ] Share encode → decode round-trips. Malformed, oversize and non-JSON hashes return `invalid`, and no `ship=` key returns `none`
- [ ] The hash is parsed without `URLSearchParams` (lz-string output contains `+`)
- [ ] Every `localStorage` call is wrapped in try/catch: writes return `false` on failure, and reads return `null` / `[]` for corrupt data

**Verify:** `npm test -- --testPathPatterns=ship-builder/persist` → PASS

**Steps:**

- [ ] **Step 1: Write the failing test `lib/ship-builder/persist/__tests__/schema.test.ts`.**

```ts
import { CURRENT_VERSION, MAX_PARTS, migrate, parseShip } from "../schema";
import { attachPart, gridPart, testShip } from "../../testing";

const validShip = testShip([
  gridPart("a", "deck-1x1", 0, 2, 0),
  gridPart("b", "deck-1x1", 1, 2, 0),
  attachPart("dv", "davit", "b", "davit:2:0"),
]);

describe("parseShip", () => {
  it("accepts a valid ship", () => {
    expect(parseShip(validShip)).toEqual({ ok: true, ship: validShip });
  });

  it("strips unknown keys", () => {
    const result = parseShip({ ...validShip, extra: "x" });
    expect(result.ok && "extra" in result.ship).toBe(false);
  });

  it.each([
    ["null", null],
    ["a string", "ship"],
    ["an array", []],
    ["the wrong version", { ...validShip, v: 2 }],
    [
      "an unknown part type",
      { ...validShip, parts: [{ ...validShip.parts[0], type: "cannon" }] },
    ],
    ["a hull too long", { ...validShip, hull: { lengthSegments: 99 } }],
    ["a fractional hull", { ...validShip, hull: { lengthSegments: 6.5 } }],
    ["a long name", { ...validShip, name: "x".repeat(61) }],
    [
      "a bad rotation",
      { ...validShip, parts: [{ ...validShip.parts[0], rotation: 45 }] },
    ],
    [
      "too many parts",
      {
        ...validShip,
        parts: Array.from({ length: MAX_PARTS + 1 }, (_, i) =>
          gridPart(`p${i}`, "deck-1x1", 0, 0, 0)
        ),
      },
    ],
  ])("rejects %s", (_label, raw) => {
    expect(parseShip(raw).ok).toBe(false);
  });

  it("rejects data that breaks the building rules", () => {
    const floating = testShip([gridPart("a", "deck-1x1", 2, 0, 0)]);
    expect(parseShip(floating)).toEqual({
      ok: false,
      error: "Part a: Needs a deck beneath every cell",
    });
  });
});

describe("migrate", () => {
  it("runs migrations up to the current version", () => {
    const migrated = migrate(
      { v: 0, title: "Old", hull: { lengthSegments: 6 }, parts: [] },
      {
        0: (raw) => ({
          v: 1,
          name: raw.title,
          hull: raw.hull,
          parts: raw.parts,
        }),
      }
    );
    expect(migrated).toEqual({
      v: CURRENT_VERSION,
      name: "Old",
      hull: { lengthSegments: 6 },
      parts: [],
    });
  });

  it("leaves current and unknown data alone", () => {
    expect(migrate(validShip)).toBe(validShip);
    expect(migrate("nope")).toBe("nope");
    expect(migrate({ v: -5 })).toEqual({ v: -5 });
  });
});
```

- [ ] **Step 2: Write the failing test `lib/ship-builder/persist/__tests__/share.test.ts`.**

```ts
import { compressToEncodedURIComponent } from "lz-string";
import {
  buildShareUrl,
  decodeShareHash,
  encodeShip,
  MAX_SHARE_LENGTH,
} from "../share";
import { attachPart, gridPart, testShip } from "../../testing";

const ship = testShip(
  [
    gridPart("a", "deck-2x1", 0, 2, 0, 90),
    gridPart("b", "deck-1x1", 1, 2, 0),
    attachPart("dv", "davit", "b", "davit:2:0"),
    attachPart("lb", "lifeboat-standard", "dv", "boat"),
  ],
  10
);

describe("share links", () => {
  it("round-trips a ship through the hash", () => {
    expect(decodeShareHash(`#ship=${encodeShip(ship)}`)).toEqual({
      kind: "ok",
      ship,
    });
  });

  it("finds the ship key among other params", () => {
    expect(decodeShareHash(`#foo=1&ship=${encodeShip(ship)}`).kind).toBe("ok");
  });

  it("builds a /ship-builder URL", () => {
    expect(buildShareUrl(ship, "https://gentryriggen.com")).toBe(
      `https://gentryriggen.com/ship-builder#ship=${encodeShip(ship)}`
    );
  });

  it("returns none without a ship key", () => {
    expect(decodeShareHash("")).toEqual({ kind: "none" });
    expect(decodeShareHash("#other=1")).toEqual({ kind: "none" });
  });

  it.each([
    ["garbage", "#ship=%%%not-lz%%%"],
    ["empty", "#ship="],
    ["non-JSON", `#ship=${compressToEncodedURIComponent("not json")}`],
    [
      "invalid ship",
      `#ship=${compressToEncodedURIComponent(JSON.stringify({ v: 1 }))}`,
    ],
    ["oversize", `#ship=${"A".repeat(MAX_SHARE_LENGTH + 1)}`],
  ])("returns invalid for %s", (_label, hash) => {
    expect(decodeShareHash(hash)).toEqual({ kind: "invalid" });
  });
});
```

- [ ] **Step 3: Write the failing test `lib/ship-builder/persist/__tests__/local.test.ts`.**

```ts
import {
  AUTOSAVE_KEY,
  deleteShip,
  listShips,
  loadAutosave,
  renameShip,
  saveAutosave,
  saveShip,
  SHIPS_KEY,
} from "../local";
import { gridPart, testShip } from "../../testing";

const ship = testShip([gridPart("a", "deck-1x1", 0, 0, 0)]);

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe("autosave", () => {
  it("round-trips the ship and savedId", () => {
    expect(saveAutosave(ship, "ship-1")).toBe(true);
    expect(loadAutosave()).toEqual({ ship, savedId: "ship-1" });
  });

  it("returns null for missing, corrupt or invalid data", () => {
    expect(loadAutosave()).toBeNull();
    localStorage.setItem(AUTOSAVE_KEY, "{not json");
    expect(loadAutosave()).toBeNull();
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ ship: { v: 9 } }));
    expect(loadAutosave()).toBeNull();
  });

  it("returns false when storage throws", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveAutosave(ship, null)).toBe(false);
  });

  it("returns null when reading throws", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(loadAutosave()).toBeNull();
    expect(listShips()).toEqual([]);
  });
});

describe("My Ships", () => {
  it("saves, lists newest first, and updates in place", () => {
    const first = saveShip({ ...ship, name: "One" }, null, 1000);
    const second = saveShip({ ...ship, name: "Two" }, null, 2000);
    expect(first && second).toBeTruthy();
    expect(listShips().map((s) => s.name)).toEqual(["Two", "One"]);

    saveShip({ ...ship, name: "One v2" }, first!.id, 3000);
    const names = listShips().map((s) => s.name);
    expect(names).toEqual(["One v2", "Two"]);
  });

  it("renames and deletes", () => {
    const saved = saveShip(ship, null)!;
    expect(renameShip(saved.id, "Olympic")).toBe(true);
    expect(listShips()[0].name).toBe("Olympic");
    expect(listShips()[0].ship.name).toBe("Olympic");
    expect(deleteShip(saved.id)).toBe(true);
    expect(listShips()).toEqual([]);
  });

  it("skips corrupt entries", () => {
    localStorage.setItem(
      SHIPS_KEY,
      JSON.stringify([
        { id: "ok", name: "Fine", savedAt: 1, ship },
        { id: "bad", name: "Broken", savedAt: 2, ship: { v: 1 } },
        "junk",
      ])
    );
    expect(listShips().map((s) => s.id)).toEqual(["ok"]);
  });

  it("returns null when saving fails", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveShip(ship, null)).toBeNull();
  });
});
```

- [ ] **Step 4: Run the tests.** Expected: FAIL (modules missing).

- [ ] **Step 5: Write `lib/ship-builder/persist/schema.ts`.**

```ts
import { z } from "zod";
import { MAX_SEGMENTS, MIN_SEGMENTS } from "../model/grid";
import { MAX_NAME_LENGTH, validateShip } from "../model/placement";
import { PART_TYPES, type Ship } from "../model/types";

export const CURRENT_VERSION = 1;
export const MAX_PARTS = 1000;
const MAX_ID_LENGTH = 64;

const gridAnchor = z.object({
  kind: z.literal("grid"),
  level: z.number().int(),
  x: z.number().int(),
  z: z.number().int(),
});

const attachAnchor = z.object({
  kind: z.literal("attach"),
  parentId: z.string().min(1).max(MAX_ID_LENGTH),
  pointId: z.string().min(1).max(MAX_ID_LENGTH),
});

const placedPart = z.object({
  id: z.string().min(1).max(MAX_ID_LENGTH),
  type: z.enum(PART_TYPES),
  anchor: z.discriminatedUnion("kind", [gridAnchor, attachAnchor]),
  rotation: z.union([
    z.literal(0),
    z.literal(90),
    z.literal(180),
    z.literal(270),
  ]),
});

export const shipSchema = z.object({
  v: z.literal(CURRENT_VERSION),
  name: z.string().max(MAX_NAME_LENGTH),
  hull: z.object({
    lengthSegments: z.number().int().min(MIN_SEGMENTS).max(MAX_SEGMENTS),
  }),
  parts: z.array(placedPart).max(MAX_PARTS),
});

type RawShip = Record<string, unknown>;
export type Migration = (raw: RawShip) => RawShip;

/** MIGRATIONS[n] upgrades a version-n ship to version n + 1. */
const MIGRATIONS: Record<number, Migration> = {};

export function migrate(
  raw: unknown,
  migrations: Record<number, Migration> = MIGRATIONS
): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  let current = raw as RawShip;
  while (typeof current.v === "number" && current.v < CURRENT_VERSION) {
    const step = migrations[current.v];
    if (!step) break;
    const next = step(current);
    if (typeof next.v !== "number" || next.v <= current.v) break;
    current = next;
  }
  return current;
}

export type ParseResult =
  | { ok: true; ship: Ship }
  | { ok: false; error: string };

export function parseShip(raw: unknown): ParseResult {
  const parsed = shipSchema.safeParse(migrate(raw));
  if (!parsed.success) return { ok: false, error: "Invalid ship data" };
  const ship: Ship = parsed.data;
  const valid = validateShip(ship);
  if (!valid.ok) return { ok: false, error: valid.reason };
  return { ok: true, ship };
}
```

- [ ] **Step 6: Write `lib/ship-builder/persist/share.ts`.**

```ts
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import type { Ship } from "../model/types";
import { parseShip } from "./schema";

export const MAX_SHARE_LENGTH = 20000;
export const SHARE_PATH = "/ship-builder";

export type HashResult =
  | { kind: "none" }
  | { kind: "ok"; ship: Ship }
  | { kind: "invalid" };

const INVALID: HashResult = { kind: "invalid" };

export function encodeShip(ship: Ship): string {
  return compressToEncodedURIComponent(JSON.stringify(ship));
}

export function buildShareUrl(ship: Ship, origin: string): string {
  return `${origin}${SHARE_PATH}#ship=${encodeShip(ship)}`;
}

/**
 * Parsed by hand: lz-string's URI-safe alphabet includes "+", which
 * URLSearchParams would turn into a space.
 */
export function decodeShareHash(hash: string): HashResult {
  const match = /(?:^#?|&)ship=([^&]*)/.exec(hash);
  if (!match) return { kind: "none" };
  const encoded = match[1];
  if (!encoded || encoded.length > MAX_SHARE_LENGTH) return INVALID;

  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(encoded);
  } catch {
    return INVALID;
  }
  if (!json) return INVALID;

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return INVALID;
  }

  const result = parseShip(raw);
  return result.ok ? { kind: "ok", ship: result.ship } : INVALID;
}
```

- [ ] **Step 7: Write `lib/ship-builder/persist/local.ts`.**

```ts
import { newId } from "../model/ids";
import type { Ship } from "../model/types";
import { parseShip } from "./schema";

export const AUTOSAVE_KEY = "ship-builder:autosave";
export const SHIPS_KEY = "ship-builder:ships";

export interface SavedShip {
  id: string;
  name: string;
  savedAt: number;
  ship: Ship;
}

export interface Autosave {
  ship: Ship;
  savedId: string | null;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  try {
    const text = storage()?.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadAutosave(): Autosave | null {
  const raw = readJson(AUTOSAVE_KEY);
  if (!isRecord(raw)) return null;
  const parsed = parseShip(raw.ship);
  if (!parsed.ok) return null;
  const savedId = typeof raw.savedId === "string" ? raw.savedId : null;
  return { ship: parsed.ship, savedId };
}

export function saveAutosave(ship: Ship, savedId: string | null): boolean {
  return writeJson(AUTOSAVE_KEY, { ship, savedId });
}

export function listShips(): SavedShip[] {
  const raw = readJson(SHIPS_KEY);
  if (!Array.isArray(raw)) return [];
  const ships: SavedShip[] = [];
  for (const entry of raw) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.name !== "string" ||
      typeof entry.savedAt !== "number"
    ) {
      continue;
    }
    const parsed = parseShip(entry.ship);
    if (!parsed.ok) continue;
    ships.push({
      id: entry.id,
      name: entry.name,
      savedAt: entry.savedAt,
      ship: parsed.ship,
    });
  }
  return ships.sort((a, b) => b.savedAt - a.savedAt);
}

export function saveShip(
  ship: Ship,
  id: string | null,
  now: number = Date.now()
): SavedShip | null {
  const entry: SavedShip = {
    id: id ?? newId("ship"),
    name: ship.name,
    savedAt: now,
    ship,
  };
  const others = listShips().filter((s) => s.id !== entry.id);
  return writeJson(SHIPS_KEY, [entry, ...others]) ? entry : null;
}

export function deleteShip(id: string): boolean {
  return writeJson(
    SHIPS_KEY,
    listShips().filter((s) => s.id !== id)
  );
}

export function renameShip(id: string, name: string): boolean {
  return writeJson(
    SHIPS_KEY,
    listShips().map((s) =>
      s.id === id ? { ...s, name, ship: { ...s.ship, name } } : s
    )
  );
}
```

- [ ] **Step 8: Run the tests.** Expected: PASS. If zod 4 rejects `z.enum(PART_TYPES)` on a readonly tuple, use `z.enum([...PART_TYPES] as [PartType, ...PartType[]])`. If the inferred type isn't assignable to `Ship`, fix the schema shape rather than casting.

- [ ] **Step 9: Commit.**

```bash
git add lib/ship-builder/persist
git commit -m "feat(ship-builder): add validated persistence and share links"
```

---

### Task 6: Game store

**Goal:** A Zustand store that wraps the model with tools, hover preview, selection, cascade confirmation, hull resizing, undo/redo (capped at 100), load/new and camera presets.

**Files:**

- Create: `lib/ship-builder/state/store.ts`
- Test: `lib/ship-builder/state/__tests__/store.test.ts`

**Acceptance Criteria:**

- [ ] `placeAt` uses the active tool. Grid parts use the tool's rotation and attach parts are forced to 0. It returns the rule result and commits only on success
- [ ] Selecting the active catalog item again cancels the tool (touch cancel)
- [ ] Delete removes leaves immediately and asks for confirmation (`pendingRemoval`) when the cascade removes more
- [ ] Growing the hull commits. Shrinking commits directly when nothing is lost, and otherwise asks for confirmation
- [ ] Undo/redo work, are capped at 100, keep the current name, and clear redo on a new commit
- [ ] `loadShip` resets history and tools

**Verify:** `npm test -- --testPathPatterns=ship-builder/state` → PASS

**Steps:**

- [ ] **Step 1: Write the failing test `lib/ship-builder/state/__tests__/store.test.ts`.**

```ts
import { act } from "react";
import {
  createInitialState,
  HISTORY_LIMIT,
  useShipBuilderStore,
} from "../store";
import type { GridAnchor } from "../../model/types";
import { gridPart, testShip } from "../../testing";

const store = () => useShipBuilderStore.getState();
const cell = (level: number, x: number, z: number): GridAnchor => ({
  kind: "grid",
  level,
  x,
  z,
});

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("tools", () => {
  it("selects a tool and toggles it off when chosen again", () => {
    store().selectTool("deck-1x1");
    expect(store().tool).toEqual({
      kind: "place",
      type: "deck-1x1",
      rotation: 0,
    });
    store().selectTool("deck-1x1");
    expect(store().tool).toEqual({ kind: "none" });
  });

  it("rotates grid tools only", () => {
    store().selectTool("deck-2x1");
    store().rotate();
    store().rotate();
    expect(store().tool).toMatchObject({ rotation: 180 });
    store().selectTool("funnel");
    store().rotate();
    expect(store().tool).toMatchObject({ rotation: 0 });
  });

  it("previews hover validity", () => {
    store().selectTool("deck-1x1");
    store().hoverAt(cell(1, 0, 0));
    expect(store().hover?.result).toEqual({
      ok: false,
      reason: "Needs a deck beneath every cell",
    });
    store().hoverAt(null);
    expect(store().hover).toBeNull();
  });

  it("cancel clears tool, hover and selection", () => {
    store().selectTool("deck-1x1");
    store().hoverAt(cell(0, 0, 0));
    store().cancel();
    expect(store().tool).toEqual({ kind: "none" });
    expect(store().hover).toBeNull();
  });
});

describe("placement and history", () => {
  it("places with the active tool and keeps the tool selected", () => {
    store().selectTool("deck-2x1");
    store().rotate();
    expect(store().placeAt(cell(0, 0, 0))).toEqual({ ok: true });
    const [part] = store().ship.parts;
    expect(part).toMatchObject({ type: "deck-2x1", rotation: 90 });
    expect(store().tool.kind).toBe("place");
    expect(store().past).toHaveLength(1);
  });

  it("returns the reason and does not commit invalid placements", () => {
    store().selectTool("deck-1x1");
    expect(store().placeAt(cell(2, 0, 0)).ok).toBe(false);
    expect(store().ship.parts).toHaveLength(0);
    expect(store().past).toHaveLength(0);
  });

  it("requires a tool", () => {
    expect(store().placeAt(cell(0, 0, 0))).toEqual({
      ok: false,
      reason: "Pick a part first",
    });
  });

  it("undoes and redoes, keeping the current name", () => {
    store().selectTool("deck-1x1");
    store().placeAt(cell(0, 0, 0));
    store().rename("Olympic");
    store().undo();
    expect(store().ship.parts).toHaveLength(0);
    expect(store().ship.name).toBe("Olympic");
    store().redo();
    expect(store().ship.parts).toHaveLength(1);
  });

  it("clears redo on a new commit", () => {
    store().selectTool("deck-1x1");
    store().placeAt(cell(0, 0, 0));
    store().undo();
    store().placeAt(cell(0, 1, 0));
    expect(store().future).toHaveLength(0);
  });

  it("caps history", () => {
    // Hull resizes on an empty ship always commit.
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      store().changeHullLength(i % 2 === 0 ? 1 : -1);
    }
    expect(store().past).toHaveLength(HISTORY_LIMIT);
  });
});

describe("removal", () => {
  beforeEach(() => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([
          gridPart("a", "deck-1x1", 0, 2, 1),
          gridPart("b", "deck-1x1", 1, 2, 1),
        ]),
      })
    );
  });

  it("removes a leaf immediately", () => {
    store().select("b");
    store().requestDelete();
    expect(store().ship.parts.map((p) => p.id)).toEqual(["a"]);
    expect(store().selectedId).toBeNull();
  });

  it("asks before a cascade and removes on confirm", () => {
    store().select("a");
    store().requestDelete();
    expect(store().pendingRemoval).toEqual({ kind: "part", ids: ["a", "b"] });
    expect(store().ship.parts).toHaveLength(2);
    store().confirmRemoval();
    expect(store().ship.parts).toHaveLength(0);
    expect(store().pendingRemoval).toBeNull();
  });

  it("cancels a pending removal", () => {
    store().select("a");
    store().requestDelete();
    store().cancelRemoval();
    expect(store().pendingRemoval).toBeNull();
    expect(store().ship.parts).toHaveLength(2);
  });
});

describe("hull length", () => {
  it("grows immediately and clamps to range", () => {
    store().changeHullLength(+1);
    expect(store().ship.hull.lengthSegments).toBe(9);
    for (let i = 0; i < 10; i++) store().changeHullLength(+1);
    expect(store().ship.hull.lengthSegments).toBe(12);
  });

  it("shrinks immediately when nothing is lost", () => {
    store().changeHullLength(-1);
    expect(store().ship.hull.lengthSegments).toBe(7);
  });

  it("asks before shrinking past parts", () => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([gridPart("aft", "deck-1x1", 0, 23, 0)]),
      })
    );
    store().changeHullLength(-1);
    expect(store().pendingRemoval).toEqual({
      kind: "hull",
      lengthSegments: 7,
      ids: ["aft"],
    });
    store().confirmRemoval();
    expect(store().ship.hull.lengthSegments).toBe(7);
    expect(store().ship.parts).toHaveLength(0);
  });
});

describe("load, new, save, camera", () => {
  it("loadShip resets history and tools", () => {
    store().selectTool("deck-1x1");
    store().placeAt(cell(0, 0, 0));
    store().loadShip(testShip([], 5), "ship-9");
    expect(store().ship.hull.lengthSegments).toBe(5);
    expect(store().savedId).toBe("ship-9");
    expect(store().past).toHaveLength(0);
    expect(store().tool).toEqual({ kind: "none" });
  });

  it("newShip is undoable and clears savedId", () => {
    store().markSaved("ship-1");
    store().selectTool("deck-1x1");
    store().placeAt(cell(0, 0, 0));
    store().newShip();
    expect(store().ship.parts).toHaveLength(0);
    expect(store().savedId).toBeNull();
    store().undo();
    expect(store().ship.parts).toHaveLength(1);
  });

  it("truncates long names", () => {
    store().rename("x".repeat(80));
    expect(store().ship.name).toHaveLength(60);
  });

  it("bumps the camera nonce on every preset", () => {
    store().setCameraView("side");
    store().setCameraView("side");
    expect(store().camera).toEqual({ view: "side", nonce: 2 });
  });
});
```

- [ ] **Step 2: Run the test.** Expected: FAIL, module missing.

- [ ] **Step 3: Write `lib/ship-builder/state/store.ts`.**

```ts
import { create } from "zustand";
import { getPartDef } from "../model/catalog";
import { MAX_SEGMENTS, MIN_SEGMENTS } from "../model/grid";
import { newId } from "../model/ids";
import {
  canPlace,
  cascadeIds,
  emptyShip,
  MAX_NAME_LENGTH,
  place,
  previewHullLength,
  removeParts,
  setHullLength,
  type PartCandidate,
  type RuleResult,
} from "../model/placement";
import type { Anchor, PartType, Rotation, Ship } from "../model/types";

export const HISTORY_LIMIT = 100;

export type Tool =
  | { kind: "none" }
  | { kind: "place"; type: PartType; rotation: Rotation };

export type PendingRemoval =
  | { kind: "part"; ids: string[] }
  | { kind: "hull"; lengthSegments: number; ids: string[] };

export interface HoverState {
  candidate: PartCandidate;
  result: RuleResult;
}

export type CameraView = "side" | "top" | "three-quarter";

interface ShipBuilderData {
  ship: Ship;
  savedId: string | null;
  tool: Tool;
  selectedId: string | null;
  hover: HoverState | null;
  pendingRemoval: PendingRemoval | null;
  past: Ship[];
  future: Ship[];
  notice: string | null;
  camera: { view: CameraView; nonce: number };
}

export interface ShipBuilderState extends ShipBuilderData {
  selectTool: (type: PartType) => void;
  cancel: () => void;
  rotate: () => void;
  hoverAt: (anchor: Anchor | null) => void;
  placeAt: (anchor: Anchor) => RuleResult;
  select: (id: string | null) => void;
  requestDelete: () => void;
  confirmRemoval: () => void;
  cancelRemoval: () => void;
  changeHullLength: (delta: number) => void;
  rename: (name: string) => void;
  undo: () => void;
  redo: () => void;
  loadShip: (ship: Ship, savedId: string | null) => void;
  newShip: () => void;
  markSaved: (savedId: string) => void;
  setNotice: (notice: string | null) => void;
  setCameraView: (view: CameraView) => void;
}

export function createInitialState(): ShipBuilderData {
  return {
    ship: emptyShip(),
    savedId: null,
    tool: { kind: "none" },
    selectedId: null,
    hover: null,
    pendingRemoval: null,
    past: [],
    future: [],
    notice: null,
    camera: { view: "three-quarter", nonce: 0 },
  };
}

const NEXT_ROTATION: Record<Rotation, Rotation> = {
  0: 90,
  90: 180,
  180: 270,
  270: 0,
};

function candidateFor(tool: Tool, anchor: Anchor): PartCandidate | null {
  if (tool.kind !== "place") return null;
  const rotation =
    getPartDef(tool.type).placement === "grid" ? tool.rotation : 0;
  return { type: tool.type, anchor, rotation };
}

function hoverFor(ship: Ship, tool: Tool, anchor: Anchor): HoverState | null {
  const candidate = candidateFor(tool, anchor);
  return candidate ? { candidate, result: canPlace(ship, candidate) } : null;
}

const CLEARED = {
  selectedId: null,
  hover: null,
  pendingRemoval: null,
} satisfies Partial<ShipBuilderData>;

export const useShipBuilderStore = create<ShipBuilderState>()((set, get) => {
  function commit(next: Ship, extra: Partial<ShipBuilderData> = {}) {
    const { ship, past } = get();
    set({
      ship: next,
      past: [...past, ship].slice(-HISTORY_LIMIT),
      future: [],
      ...extra,
    });
  }

  return {
    ...createInitialState(),

    selectTool(type) {
      const { tool } = get();
      if (tool.kind === "place" && tool.type === type) {
        set({ tool: { kind: "none" }, hover: null });
        return;
      }
      set({ tool: { kind: "place", type, rotation: 0 }, ...CLEARED });
    },

    cancel() {
      set({ tool: { kind: "none" }, ...CLEARED });
    },

    rotate() {
      const { tool, hover, ship } = get();
      if (tool.kind !== "place" || getPartDef(tool.type).placement !== "grid") {
        return;
      }
      const rotated: Tool = { ...tool, rotation: NEXT_ROTATION[tool.rotation] };
      set({
        tool: rotated,
        hover: hover ? hoverFor(ship, rotated, hover.candidate.anchor) : null,
      });
    },

    hoverAt(anchor) {
      const { ship, tool } = get();
      set({ hover: anchor ? hoverFor(ship, tool, anchor) : null });
    },

    placeAt(anchor) {
      const { ship, tool } = get();
      const candidate = candidateFor(tool, anchor);
      if (!candidate) return { ok: false, reason: "Pick a part first" };
      const result = place(ship, { id: newId("p"), ...candidate });
      if (!result.ok) return { ok: false, reason: result.reason };
      commit(result.ship, { hover: null });
      return { ok: true };
    },

    select(id) {
      set({ selectedId: id, pendingRemoval: null });
    },

    requestDelete() {
      const { ship, selectedId } = get();
      if (!selectedId) return;
      const ids = cascadeIds(ship, [selectedId]);
      if (ids.length === 1) {
        commit(removeParts(ship, ids), CLEARED);
        return;
      }
      set({ pendingRemoval: { kind: "part", ids } });
    },

    confirmRemoval() {
      const { ship, pendingRemoval } = get();
      if (!pendingRemoval) return;
      const next =
        pendingRemoval.kind === "part"
          ? removeParts(ship, pendingRemoval.ids)
          : setHullLength(ship, pendingRemoval.lengthSegments);
      commit(next, CLEARED);
    },

    cancelRemoval() {
      set({ pendingRemoval: null });
    },

    changeHullLength(delta) {
      const { ship } = get();
      const current = ship.hull.lengthSegments;
      const target = Math.min(
        MAX_SEGMENTS,
        Math.max(MIN_SEGMENTS, current + delta)
      );
      if (target === current) return;
      const ids = target < current ? previewHullLength(ship, target) : [];
      if (ids.length === 0) {
        commit(setHullLength(ship, target), { pendingRemoval: null });
        return;
      }
      set({ pendingRemoval: { kind: "hull", lengthSegments: target, ids } });
    },

    rename(name) {
      set({ ship: { ...get().ship, name: name.slice(0, MAX_NAME_LENGTH) } });
    },

    undo() {
      const { ship, past, future } = get();
      const previous = past.at(-1);
      if (!previous) return;
      set({
        ship: { ...previous, name: ship.name },
        past: past.slice(0, -1),
        future: [ship, ...future],
        ...CLEARED,
      });
    },

    redo() {
      const { ship, past, future } = get();
      const [next, ...rest] = future;
      if (!next) return;
      set({
        ship: { ...next, name: ship.name },
        past: [...past, ship].slice(-HISTORY_LIMIT),
        future: rest,
        ...CLEARED,
      });
    },

    loadShip(ship, savedId) {
      const { camera, notice } = get();
      set({ ...createInitialState(), ship, savedId, camera, notice });
    },

    newShip() {
      commit(emptyShip(), {
        savedId: null,
        tool: { kind: "none" },
        ...CLEARED,
      });
    },

    markSaved(savedId) {
      set({ savedId });
    },

    setNotice(notice) {
      set({ notice });
    },

    setCameraView(view) {
      set({ camera: { view, nonce: get().camera.nonce + 1 } });
    },
  };
});
```

- [ ] **Step 4: Run the test.** Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add lib/ship-builder/state
git commit -m "feat(ship-builder): add game store with undo/redo and cascade confirm"
```

---

### Task 7: Route, layout shell, catalog and stats panels

**Goal:** `/ship-builder` renders the full layout: a header, a left catalog drawer, a canvas area (placeholder until Task 9), a right stats drawer and toolbar slot. The CatalogPanel and StatsPanel have RTL tests. The route is added to the sitemap and the Firebase clean-URLs fix ships.

**Files:**

- Create: `app/ship-builder/page.tsx`
- Modify: `app/sitemap.ts`
- Modify: `firebase.json`
- Create: `components/ship-builder/ShipBuilder.tsx`
- Create: `components/ship-builder/hooks/useWebGLSupport.ts`
- Create: `components/ship-builder/hooks/useTestHook.ts`
- Create: `components/ship-builder/ui/styles.ts`
- Create: `components/ship-builder/ui/Drawer.tsx`
- Create: `components/ship-builder/ui/CatalogPanel.tsx`
- Create: `components/ship-builder/ui/StatsPanel.tsx`
- Create: `components/ship-builder/ui/WebGLFallback.tsx`
- Test: `components/ship-builder/ui/__tests__/CatalogPanel.test.tsx`
- Test: `components/ship-builder/ui/__tests__/StatsPanel.test.tsx`
- Test: `app/__tests__/sitemap.test.ts`

**Acceptance Criteria:**

- [ ] `app/ship-builder/page.tsx` is a server component that exports `metadata` and renders `<ShipBuilder />`
- [ ] The catalog groups parts by category. Each button reflects selection with `aria-pressed`, and clicking an active item cancels it
- [ ] The stats panel shows every stat with a `data-testid`, colored coverage, the warnings list, and the Titanic reference row
- [ ] Side panels are inline at `lg` and slide-out drawers below `lg`
- [ ] All chrome supports light and dark mode
- [ ] The sitemap includes `https://gentryriggen.com/ship-builder`, and `firebase.json` has `"cleanUrls": true`
- [ ] `npm run build` produces `out/ship-builder.html`

**Verify:** `npm test -- --testPathPatterns="(ship-builder/ui|sitemap)"` → PASS; `npm run build && ls out/ship-builder.html`

**Steps:**

- [ ] **Step 1: Write the failing test `components/ship-builder/ui/__tests__/CatalogPanel.test.tsx`.**

```tsx
import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CatalogPanel from "../CatalogPanel";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("CatalogPanel", () => {
  it("groups parts under category headings", () => {
    render(<CatalogPanel />);
    for (const heading of [
      "Decks",
      "Cabins",
      "Command",
      "Funnels",
      "Masts",
      "Lifeboat gear",
    ]) {
      expect(
        screen.getByRole("heading", { name: heading })
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: /Collapsible lifeboat/ })
    ).toBeInTheDocument();
  });

  it("selects a part and toggles it off on a second click", async () => {
    const user = userEvent.setup();
    render(<CatalogPanel />);
    const funnel = screen.getByRole("button", { name: /^Funnel/ });
    await user.click(funnel);
    expect(funnel).toHaveAttribute("aria-pressed", "true");
    expect(useShipBuilderStore.getState().tool).toMatchObject({
      type: "funnel",
    });
    await user.click(funnel);
    expect(funnel).toHaveAttribute("aria-pressed", "false");
    expect(useShipBuilderStore.getState().tool).toEqual({ kind: "none" });
  });
});
```

- [ ] **Step 2: Write the failing test `components/ship-builder/ui/__tests__/StatsPanel.test.tsx`.**

```tsx
import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import StatsPanel from "../StatsPanel";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { attachPart, gridPart, testShip } from "@/lib/ship-builder/testing";

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("StatsPanel", () => {
  it("renders stats for the store's ship", () => {
    render(<StatsPanel />);
    expect(screen.getByTestId("stat-passengers")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-crew")).toHaveTextContent("480");
    expect(screen.getByTestId("stat-people")).toHaveTextContent("480");
    expect(screen.getByTestId("stat-seats")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-coverage")).toHaveTextContent("0%");
    expect(screen.getByTestId("stat-tonnage")).toHaveTextContent("24,192");
    expect(screen.getByTestId("stat-speed")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-stability")).toHaveTextContent("Stable");
  });

  it("updates when the ship changes", () => {
    render(<StatsPanel />);
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([
          gridPart("a", "deck-1x1", 0, 2, 0),
          gridPart("b", "deck-1x1", 1, 2, 0),
          attachPart("dv", "davit", "b", "davit:2:0"),
          attachPart("lb", "lifeboat-standard", "dv", "boat"),
          gridPart("c", "cabin-1st", 0, 3, 0),
        ]),
      })
    );
    expect(screen.getByTestId("stat-passengers")).toHaveTextContent("30");
    expect(screen.getByTestId("stat-seats")).toHaveTextContent("65");
    expect(screen.getByTestId("stat-coverage")).toHaveTextContent("13%");
  });

  it("lists warnings and the Titanic reference", () => {
    render(<StatsPanel />);
    const warnings = screen.getByRole("list", { name: "Warnings" });
    expect(
      within(warnings).getByText(/Lifeboats seat 0 of 480/)
    ).toBeInTheDocument();
    expect(within(warnings).getByText(/No bridge/)).toBeInTheDocument();
    expect(screen.getByText("46,328")).toBeInTheDocument();
    expect(screen.getByText("2,224")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Write the failing test `app/__tests__/sitemap.test.ts`.**

```ts
import sitemap from "../sitemap";

describe("sitemap", () => {
  it("lists the home page and the ship builder", () => {
    expect(sitemap().map((entry) => entry.url)).toEqual([
      "https://gentryriggen.com",
      "https://gentryriggen.com/ship-builder",
    ]);
  });
});
```

- [ ] **Step 4: Run the tests.** Expected: FAIL (modules missing, and the sitemap has only one entry).

- [ ] **Step 5: Write `components/ship-builder/ui/styles.ts`.**

```ts
export const buttonClass =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

export const primaryButtonClass =
  "rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400";

export const dangerButtonClass =
  "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400";

export const panelClass =
  "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";

export const inputClass =
  "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
```

- [ ] **Step 6: Write `components/ship-builder/ui/CatalogPanel.tsx`.**

```tsx
"use client";

import { CATEGORIES, partsInCategory } from "@/lib/ship-builder/model/catalog";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

export default function CatalogPanel() {
  const tool = useShipBuilderStore((s) => s.tool);
  const selectTool = useShipBuilderStore((s) => s.selectTool);

  return (
    <nav aria-label="Parts catalog" className="space-y-5 p-4">
      {CATEGORIES.map((category) => (
        <section key={category.id}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {category.name}
          </h2>
          <ul className="mt-2 space-y-1">
            {partsInCategory(category.id).map((def) => {
              const active = tool.kind === "place" && tool.type === def.type;
              return (
                <li key={def.type}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectTool(def.type)}
                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950"
                        : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="block text-sm font-medium">
                      {def.name}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {def.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
```

- [ ] **Step 7: Write `components/ship-builder/ui/StatsPanel.tsx`.**

```tsx
"use client";

import { useMemo } from "react";
import {
  computeStats,
  TITANIC_REFERENCE,
  type CoverageLevel,
  type Stability,
} from "@/lib/ship-builder/model/stats";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

const COVERAGE_CLASSES: Record<CoverageLevel, string> = {
  red: "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-emerald-600 dark:text-emerald-400",
};

const STABILITY_CLASSES: Record<Stability, string> = {
  Stable: "text-emerald-600 dark:text-emerald-400",
  "Top-heavy": "text-amber-600 dark:text-amber-400",
  Dangerous: "text-red-600 dark:text-red-400",
};

const fmt = (n: number) => n.toLocaleString("en-US");

interface StatRowProps {
  label: string;
  testId: string;
  value: string;
  unit?: string;
  detail?: string;
  valueClass?: string;
}

function StatRow({
  label,
  testId,
  value,
  unit,
  detail,
  valueClass,
}: StatRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="text-right">
        <span
          data-testid={testId}
          className={`font-mono text-sm font-semibold ${valueClass ?? ""}`}
        >
          {value}
        </span>
        {unit && (
          <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        )}
        {detail && (
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {detail}
          </span>
        )}
      </dd>
    </div>
  );
}

export default function StatsPanel() {
  const ship = useShipBuilderStore((s) => s.ship);
  const stats = useMemo(() => computeStats(ship), [ship]);
  const { passengers } = stats;

  return (
    <section aria-label="Ship stats" className="space-y-5 p-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Stats
        </h2>
        <dl className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
          <StatRow
            label="Passengers"
            testId="stat-passengers"
            value={fmt(passengers.total)}
            detail={`1st ${fmt(passengers.first)} · 2nd ${fmt(passengers.second)} · 3rd ${fmt(passengers.third)}`}
          />
          <StatRow label="Crew" testId="stat-crew" value={fmt(stats.crew)} />
          <StatRow
            label="People aboard"
            testId="stat-people"
            value={fmt(stats.peopleAboard)}
          />
          <StatRow
            label="Lifeboat seats"
            testId="stat-seats"
            value={fmt(stats.lifeboatSeats)}
            detail={`${stats.lifeboats} boats`}
          />
          <StatRow
            label="Coverage"
            testId="stat-coverage"
            value={`${Math.round(stats.coverage * 100)}%`}
            valueClass={COVERAGE_CLASSES[stats.coverageLevel]}
          />
          <StatRow
            label="Gross tonnage"
            testId="stat-tonnage"
            value={fmt(stats.grossTonnage)}
            unit="GRT"
          />
          <StatRow
            label="Top speed"
            testId="stat-speed"
            value={String(stats.topSpeedKnots)}
            unit="kn"
          />
          <StatRow
            label="Stability"
            testId="stat-stability"
            value={stats.stability}
            valueClass={STABILITY_CLASSES[stats.stability]}
          />
        </dl>
      </div>

      {stats.warnings.length > 0 && (
        <ul aria-label="Warnings" className="space-y-1.5">
          {stats.warnings.map((warning) => (
            <li
              key={warning.code}
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
            >
              {warning.message}
            </li>
          ))}
        </ul>
      )}

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          RMS Titanic (1912)
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          <dt>Tonnage</dt>
          <dd className="text-right font-mono">
            {fmt(TITANIC_REFERENCE.grossTonnage)}
          </dd>
          <dt>Speed</dt>
          <dd className="text-right font-mono">
            {TITANIC_REFERENCE.topSpeedKnots} kn
          </dd>
          <dt>Lifeboats</dt>
          <dd className="text-right font-mono">
            {TITANIC_REFERENCE.lifeboats} (
            {fmt(TITANIC_REFERENCE.lifeboatSeats)} seats)
          </dd>
          <dt>Aboard</dt>
          <dd className="text-right font-mono">
            {fmt(TITANIC_REFERENCE.peopleAboard)}
          </dd>
        </dl>
      </div>
    </section>
  );
}
```

> The test asserts `getByText("46,328")` and `getByText("2,224")`. Those `dd` elements must hold only the number, so don't add units inside them.

- [ ] **Step 8: Write `components/ship-builder/ui/Drawer.tsx`.**

```tsx
"use client";

import { useId, useState, type ReactNode } from "react";
import { panelClass } from "./styles";

interface DrawerProps {
  side: "left" | "right";
  label: string;
  children: ReactNode;
}

export default function Drawer({ side, label, children }: DrawerProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const left = side === "left";
  const closed = left ? "-translate-x-full" : "translate-x-full";

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className={`absolute top-3 z-20 rounded-md border border-slate-300 bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur lg:hidden dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 ${
          left ? "left-3" : "right-3"
        }`}
      >
        {label}
      </button>
      <aside
        id={id}
        aria-label={label}
        className={`absolute inset-y-0 z-30 w-72 overflow-y-auto transition-transform lg:static lg:z-auto lg:translate-x-0 ${panelClass} ${
          left ? "left-0 border-r" : "right-0 border-l"
        } ${open ? "translate-x-0" : closed}`}
      >
        <div className="flex justify-end p-2 lg:hidden">
          <button
            type="button"
            aria-label={`Close ${label}`}
            onClick={() => setOpen(false)}
            className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}
```

- [ ] **Step 9: Write `components/ship-builder/hooks/useWebGLSupport.ts`.** It uses `useSyncExternalStore`, so there's no setState-in-effect (the react-hooks v7 lint rule).

```ts
"use client";

import { useSyncExternalStore } from "react";

let cached: boolean | undefined;

function detect(): boolean {
  if (cached === undefined) {
    try {
      const canvas = document.createElement("canvas");
      cached = Boolean(
        canvas.getContext("webgl2") ?? canvas.getContext("webgl")
      );
    } catch {
      cached = false;
    }
  }
  return cached;
}

function subscribe(): () => void {
  return () => {};
}

/** null during SSR / before hydration, then whether WebGL is available. */
export default function useWebGLSupport(): boolean | null {
  return useSyncExternalStore(subscribe, detect, () => null);
}
```

- [ ] **Step 10: Write `components/ship-builder/hooks/useTestHook.ts`.**

```ts
"use client";

import { useEffect } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

declare global {
  interface Window {
    __shipBuilderStore?: typeof useShipBuilderStore;
  }
}

/** Exposes the store to Playwright in non-production builds only. */
export default function useTestHook() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    window.__shipBuilderStore = useShipBuilderStore;
    return () => {
      delete window.__shipBuilderStore;
    };
  }, []);
}
```

- [ ] **Step 11: Write `components/ship-builder/ui/WebGLFallback.tsx`.** This is a server-compatible component with no hooks.

```tsx
export default function WebGLFallback() {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div className="max-w-sm space-y-2">
        <p className="text-lg font-semibold">3D isn&apos;t available here</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your browser doesn&apos;t support WebGL, so the shipyard can&apos;t
          draw your liner. Try a recent version of Chrome, Firefox or Safari.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Write `components/ship-builder/ShipBuilder.tsx`.** The scene import is temporarily a placeholder `div`; Task 9 swaps in the dynamic import. Task 8 adds the toolbar and overlays.

```tsx
"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import useTestHook from "./hooks/useTestHook";
import useWebGLSupport from "./hooks/useWebGLSupport";
import CatalogPanel from "./ui/CatalogPanel";
import Drawer from "./ui/Drawer";
import StatsPanel from "./ui/StatsPanel";
import WebGLFallback from "./ui/WebGLFallback";

export default function ShipBuilder() {
  useTestHook();
  const webgl = useWebGLSupport();

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white py-3 pl-4 pr-20 dark:border-slate-800 dark:bg-slate-900">
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← gentryriggen.com
        </Link>
        <h1 className="text-lg font-semibold">Ship Builder</h1>
      </header>
      <ThemeToggle />

      <div className="relative flex min-h-0 flex-1">
        <Drawer side="left" label="Parts">
          <CatalogPanel />
        </Drawer>
        <main className="relative min-w-0 flex-1">
          {webgl === false ? (
            <WebGLFallback />
          ) : (
            <div data-testid="scene-placeholder" className="h-full w-full" />
          )}
        </main>
        <Drawer side="right" label="Stats">
          <StatsPanel />
        </Drawer>
      </div>
    </div>
  );
}
```

- [ ] **Step 13: Write `app/ship-builder/page.tsx`.**

```tsx
import type { Metadata } from "next";
import ShipBuilder from "@/components/ship-builder/ShipBuilder";

const description =
  "Build your own Titanic-era ocean liner from snap-together parts, then check whether there are enough lifeboats.";

export const metadata: Metadata = {
  title: "Ship Builder | Gentry Riggen",
  description,
  alternates: { canonical: "https://gentryriggen.com/ship-builder" },
  openGraph: {
    title: "Ship Builder",
    description,
    url: "https://gentryriggen.com/ship-builder",
    siteName: "Gentry Riggen",
    type: "website",
  },
};

export default function ShipBuilderPage() {
  return <ShipBuilder />;
}
```

- [ ] **Step 14: Update `app/sitemap.ts`.** Add a second entry after the home entry:

```ts
    {
      url: "https://gentryriggen.com/ship-builder",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
```

- [ ] **Step 15: Update `firebase.json`.** Add `"cleanUrls": true,` as the first key inside `"hosting"`, before `"public"`.

- [ ] **Step 16: Run the tests and the build.**

Run: `npm test -- --testPathPatterns="(ship-builder/ui|sitemap)"` → PASS
Run: `npm run lint && npm run type-check` → clean
Run: `npm run build && ls out/ship-builder.html` → file exists

- [ ] **Step 17: Smoke-check in the dev server.** Run `npm run dev` and open `http://localhost:3000/ship-builder`. Toggle the theme and check both panels at 1280px and 800px wide (drawers).

- [ ] **Step 18: Commit.**

```bash
git add app components/ship-builder firebase.json
git commit -m "feat(ship-builder): add route, layout shell, catalog and stats panels"
```

---

### Task 8: Toolbar, overlays, shortcuts, persistence, sharing

**Goal:** Wire the toolbar (name, hull −/+, undo, redo, rotate, delete, camera presets, new, save, share, My Ships). Add the removal confirm bar, placement hint and notices, keyboard shortcuts, autosave/restore, and share-hash loading.

**Files:**

- Create: `components/ship-builder/ui/Toolbar.tsx`
- Create: `components/ship-builder/ui/ShareButton.tsx`
- Create: `components/ship-builder/ui/MyShipsDialog.tsx`
- Create: `components/ship-builder/ui/RemovalConfirm.tsx`
- Create: `components/ship-builder/ui/PlacementHint.tsx`
- Create: `components/ship-builder/ui/Notice.tsx`
- Create: `components/ship-builder/hooks/useKeyboardShortcuts.ts`
- Create: `components/ship-builder/hooks/useShipPersistence.ts`
- Modify: `components/ship-builder/ShipBuilder.tsx`
- Test: `components/ship-builder/ui/__tests__/Toolbar.test.tsx`
- Test: `components/ship-builder/ui/__tests__/ShareButton.test.tsx`
- Test: `components/ship-builder/ui/__tests__/MyShipsDialog.test.tsx`
- Test: `components/ship-builder/ui/__tests__/overlays.test.tsx`
- Test: `components/ship-builder/hooks/__tests__/useKeyboardShortcuts.test.tsx`
- Test: `components/ship-builder/hooks/__tests__/useShipPersistence.test.tsx`

**Acceptance Criteria:**

- [ ] Keyboard: `R` rotates, Del/Backspace deletes, Esc cancels (or cancels a pending removal), Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes. Shortcuts are ignored while typing in inputs
- [ ] On mount, a valid `#ship=` loads as an unsaved design and the hash is cleared. An invalid one shows "Couldn't load that ship" and keeps a fresh hull. With no hash, the autosave is restored
- [ ] Autosave is debounced (500 ms) and flushed on unmount. A failure shows a notice once
- [ ] Share copies the link when the clipboard is available, and always shows it in a read-only input
- [ ] My Ships lists, loads, renames, and deletes (two-step)
- [ ] The removal bar shows how many parts will go, with Remove/Keep buttons

**Verify:** `npm test -- --testPathPatterns=components/ship-builder` → PASS

**Steps:**

- [ ] **Step 1: Write the failing test `components/ship-builder/hooks/__tests__/useKeyboardShortcuts.test.tsx`.**

```tsx
import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import useKeyboardShortcuts from "../useKeyboardShortcuts";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

function Harness() {
  useKeyboardShortcuts();
  return <input aria-label="Ship name" />;
}

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("useKeyboardShortcuts", () => {
  it("rotates with R and cancels with Escape", () => {
    render(<Harness />);
    act(() => store().selectTool("deck-2x1"));
    fireEvent.keyDown(window, { key: "r" });
    expect(store().tool).toMatchObject({ rotation: 90 });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(store().tool).toEqual({ kind: "none" });
  });

  it("undoes and redoes with Ctrl/Cmd+Z", () => {
    render(<Harness />);
    act(() => {
      store().selectTool("deck-1x1");
      store().placeAt({ kind: "grid", level: 0, x: 0, z: 0 });
    });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(store().ship.parts).toHaveLength(0);
    fireEvent.keyDown(window, { key: "Z", metaKey: true, shiftKey: true });
    expect(store().ship.parts).toHaveLength(1);
  });

  it("deletes the selection with Delete or Backspace", () => {
    render(<Harness />);
    act(() => {
      store().selectTool("deck-1x1");
      store().placeAt({ kind: "grid", level: 0, x: 0, z: 0 });
      store().cancel();
      store().select(store().ship.parts[0].id);
    });
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(store().ship.parts).toHaveLength(0);
  });

  it("ignores keys typed into inputs", () => {
    render(<Harness />);
    act(() => store().selectTool("deck-2x1"));
    fireEvent.keyDown(screen.getByLabelText("Ship name"), { key: "r" });
    expect(store().tool).toMatchObject({ rotation: 0 });
  });
});
```

- [ ] **Step 2: Write the failing test `components/ship-builder/hooks/__tests__/useShipPersistence.test.tsx`.**

```tsx
import { act } from "react";
import { render } from "@testing-library/react";
import useShipPersistence, { AUTOSAVE_DELAY_MS } from "../useShipPersistence";
import { AUTOSAVE_KEY, saveAutosave } from "@/lib/ship-builder/persist/local";
import { encodeShip } from "@/lib/ship-builder/persist/share";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { gridPart, testShip } from "@/lib/ship-builder/testing";

function Harness() {
  useShipPersistence();
  return null;
}

const store = () => useShipBuilderStore.getState();
const shared = testShip([gridPart("a", "deck-1x1", 0, 0, 0)], 6);

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  window.history.replaceState(null, "", "/ship-builder");
  act(() => useShipBuilderStore.setState(createInitialState()));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("useShipPersistence", () => {
  it("loads a shared ship from the hash and clears it", () => {
    window.history.replaceState(
      null,
      "",
      `/ship-builder#ship=${encodeShip(shared)}`
    );
    render(<Harness />);
    expect(store().ship).toEqual(shared);
    expect(store().savedId).toBeNull();
    expect(window.location.hash).toBe("");
  });

  it("shows a notice for an invalid hash and keeps a fresh hull", () => {
    saveAutosave(shared, null);
    window.history.replaceState(null, "", "/ship-builder#ship=garbage");
    render(<Harness />);
    expect(store().notice).toBe("Couldn't load that ship");
    expect(store().ship.parts).toHaveLength(0);
  });

  it("restores the autosave when there is no hash", () => {
    saveAutosave(shared, "ship-3");
    render(<Harness />);
    expect(store().ship).toEqual(shared);
    expect(store().savedId).toBe("ship-3");
  });

  it("autosaves after changes, debounced", () => {
    render(<Harness />);
    act(() => store().rename("Britannic"));
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull();
    act(() => jest.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(JSON.parse(localStorage.getItem(AUTOSAVE_KEY)!).ship.name).toBe(
      "Britannic"
    );
  });

  it("flushes a pending save on unmount", () => {
    const { unmount } = render(<Harness />);
    act(() => store().rename("Flushed"));
    unmount();
    expect(JSON.parse(localStorage.getItem(AUTOSAVE_KEY)!).ship.name).toBe(
      "Flushed"
    );
  });

  it("warns once when storage fails", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    render(<Harness />);
    act(() => store().rename("One"));
    act(() => jest.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(store().notice).toMatch(/won't be saved/);
    act(() => store().setNotice(null));
    act(() => store().rename("Two"));
    act(() => jest.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(store().notice).toBeNull();
  });
});
```

- [ ] **Step 3: Write the failing test `components/ship-builder/ui/__tests__/Toolbar.test.tsx`.**

```tsx
import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Toolbar from "../Toolbar";
import { listShips } from "@/lib/ship-builder/persist/local";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  localStorage.clear();
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("Toolbar", () => {
  it("changes hull length", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.click(screen.getByRole("button", { name: "Lengthen hull" }));
    expect(screen.getByTestId("hull-length")).toHaveTextContent("9 segments");
    await user.click(screen.getByRole("button", { name: "Shorten hull" }));
    expect(screen.getByTestId("hull-length")).toHaveTextContent("8 segments");
  });

  it("enables undo after a change and renames the ship", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Lengthen hull" }));
    expect(undo).toBeEnabled();
    const name = screen.getByLabelText("Ship name");
    await user.clear(name);
    await user.type(name, "Olympic");
    expect(store().ship.name).toBe("Olympic");
  });

  it("only enables rotate for grid tools and delete with a selection", () => {
    render(<Toolbar />);
    expect(screen.getByRole("button", { name: "Rotate" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    act(() => store().selectTool("deck-2x1"));
    expect(screen.getByRole("button", { name: "Rotate" })).toBeEnabled();
  });

  it("saves to My Ships", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(listShips()).toHaveLength(1);
    expect(store().savedId).toBe(listShips()[0].id);
    expect(store().notice).toBe("Saved to My Ships");
  });

  it("sets camera presets", async () => {
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.click(screen.getByRole("button", { name: "Top view" }));
    expect(store().camera.view).toBe("top");
  });
});
```

- [ ] **Step 4: Write the failing test `components/ship-builder/ui/__tests__/ShareButton.test.tsx`.**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShareButton from "../ShareButton";

describe("ShareButton", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
  });

  it("copies the link and shows it", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ShareButton />);
    // userEvent.setup() installs its own clipboard stub, so override it afterwards.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await user.click(screen.getByRole("button", { name: "Share" }));
    const input = screen.getByLabelText("Share link URL") as HTMLInputElement;
    expect(input.value).toMatch(/\/ship-builder#ship=/);
    expect(writeText).toHaveBeenCalledWith(input.value);
    expect(
      await screen.findByText("Link copied to clipboard")
    ).toBeInTheDocument();
  });

  it("still shows the link without clipboard access", async () => {
    const user = userEvent.setup();
    render(<ShareButton />);
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByLabelText("Share link URL")).toBeInTheDocument();
    expect(
      await screen.findByText("Copy this link to share your ship")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Write the failing test `components/ship-builder/ui/__tests__/MyShipsDialog.test.tsx`.**

```tsx
import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyShipsDialog from "../MyShipsDialog";
import { listShips, saveShip } from "@/lib/ship-builder/persist/local";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { testShip } from "@/lib/ship-builder/testing";

beforeEach(() => {
  localStorage.clear();
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("MyShipsDialog", () => {
  it("shows an empty state", () => {
    render(<MyShipsDialog onClose={jest.fn()} />);
    expect(screen.getByText(/No saved ships yet/)).toBeInTheDocument();
  });

  it("loads a saved ship and closes", async () => {
    const saved = saveShip({ ...testShip([], 10), name: "Olympic" }, null)!;
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<MyShipsDialog onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Load Olympic" }));
    expect(useShipBuilderStore.getState().ship.hull.lengthSegments).toBe(10);
    expect(useShipBuilderStore.getState().savedId).toBe(saved.id);
    expect(onClose).toHaveBeenCalled();
  });

  it("renames a saved ship", async () => {
    saveShip({ ...testShip(), name: "Olympic" }, null);
    const user = userEvent.setup();
    render(<MyShipsDialog onClose={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: "Rename Olympic" }));
    const input = screen.getByLabelText("New name for Olympic");
    await user.clear(input);
    await user.type(input, "Britannic{Enter}");
    expect(listShips()[0].name).toBe("Britannic");
    expect(screen.getByText("Britannic")).toBeInTheDocument();
  });

  it("deletes only after confirming", async () => {
    saveShip({ ...testShip(), name: "Olympic" }, null);
    const user = userEvent.setup();
    render(<MyShipsDialog onClose={jest.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "My Ships" });
    await user.click(
      within(dialog).getByRole("button", { name: "Delete Olympic" })
    );
    expect(listShips()).toHaveLength(1);
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm delete Olympic" })
    );
    expect(listShips()).toHaveLength(0);
  });
});
```

- [ ] **Step 6: Write the failing test `components/ship-builder/ui/__tests__/overlays.test.tsx`.**

```tsx
import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlacementHint from "../PlacementHint";
import RemovalConfirm from "../RemovalConfirm";
import Notice from "../Notice";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import { gridPart, testShip } from "@/lib/ship-builder/testing";

const store = () => useShipBuilderStore.getState();

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("PlacementHint", () => {
  it("is hidden without a tool and shows the rule reason on a bad hover", () => {
    const { container } = render(<PlacementHint />);
    expect(container).toBeEmptyDOMElement();
    act(() => {
      store().selectTool("deck-1x1");
      store().hoverAt({ kind: "grid", level: 1, x: 0, z: 0 });
    });
    expect(screen.getByTestId("placement-reason")).toHaveTextContent(
      "Needs a deck beneath every cell"
    );
  });

  it("explains when an attach part has nowhere to go", () => {
    render(<PlacementHint />);
    act(() => store().selectTool("lifeboat-standard"));
    expect(screen.getByText(/Every davit has a boat/)).toBeInTheDocument();
  });
});

describe("RemovalConfirm", () => {
  it("confirms a cascade removal", async () => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([
          gridPart("a", "deck-1x1", 0, 2, 1),
          gridPart("b", "deck-1x1", 1, 2, 1),
        ]),
        selectedId: "a",
      })
    );
    act(() => store().requestDelete());
    const user = userEvent.setup();
    render(<RemovalConfirm />);
    expect(
      screen.getByText(/also removes 1 attached part/)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(store().ship.parts).toHaveLength(0);
  });
});

describe("Notice", () => {
  it("shows and dismisses the notice", async () => {
    const user = userEvent.setup();
    render(<Notice />);
    act(() => store().setNotice("Saved to My Ships"));
    expect(screen.getByRole("status")).toHaveTextContent("Saved to My Ships");
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(store().notice).toBeNull();
  });
});
```

- [ ] **Step 7: Run the tests.** Expected: FAIL (modules missing).

- [ ] **Step 8: Write `components/ship-builder/hooks/useKeyboardShortcuts.ts`.**

```ts
"use client";

import { useEffect } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export default function useKeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      const state = useShipBuilderStore.getState();
      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (key === "r") {
        state.rotate();
      } else if (key === "delete" || key === "backspace") {
        event.preventDefault();
        state.requestDelete();
      } else if (key === "escape") {
        if (state.pendingRemoval) state.cancelRemoval();
        else state.cancel();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
```

- [ ] **Step 9: Write `components/ship-builder/hooks/useShipPersistence.ts`.**

```ts
"use client";

import { useEffect } from "react";
import { loadAutosave, saveAutosave } from "@/lib/ship-builder/persist/local";
import { decodeShareHash } from "@/lib/ship-builder/persist/share";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

export const AUTOSAVE_DELAY_MS = 500;
const STORAGE_NOTICE =
  "Browser storage is unavailable — your ship won't be saved";

export default function useShipPersistence() {
  useEffect(() => {
    const store = useShipBuilderStore;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let warned = false;

    function flush() {
      timer = undefined;
      const { ship, savedId } = store.getState();
      if (!saveAutosave(ship, savedId) && !warned) {
        warned = true;
        store.getState().setNotice(STORAGE_NOTICE);
      }
    }

    // Subscribe first so a ship loaded below is autosaved too.
    const unsubscribe = store.subscribe((state, prev) => {
      if (state.ship === prev.ship && state.savedId === prev.savedId) return;
      clearTimeout(timer);
      timer = setTimeout(flush, AUTOSAVE_DELAY_MS);
    });

    function loadFromHash(): boolean {
      const result = decodeShareHash(window.location.hash);
      if (result.kind === "none") return false;
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
      if (result.kind === "ok") {
        store.getState().loadShip(result.ship, null);
      } else {
        store.getState().setNotice("Couldn't load that ship");
      }
      return true;
    }

    if (!loadFromHash()) {
      const saved = loadAutosave();
      if (saved) store.getState().loadShip(saved.ship, saved.savedId);
    }

    window.addEventListener("hashchange", loadFromHash);
    return () => {
      window.removeEventListener("hashchange", loadFromHash);
      unsubscribe();
      // Flush instead of dropping: StrictMode remounts would otherwise lose
      // a just-loaded shared ship.
      if (timer !== undefined) {
        clearTimeout(timer);
        flush();
      }
    };
  }, []);
}
```

- [ ] **Step 10: Write `components/ship-builder/ui/ShareButton.tsx`.**

```tsx
"use client";

import { useState } from "react";
import { buildShareUrl } from "@/lib/ship-builder/persist/share";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { buttonClass, inputClass, panelClass } from "./styles";

export default function ShareButton() {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = buildShareUrl(
      useShipBuilderStore.getState().ship,
      window.location.origin
    );
    setLink(url);
    setCopied(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={handleShare} className={buttonClass}>
        Share
      </button>
      {link && (
        <div
          role="dialog"
          aria-label="Share link"
          className={`absolute bottom-full right-0 z-40 mb-2 w-80 space-y-2 rounded-lg border p-3 shadow-lg ${panelClass}`}
        >
          <input
            readOnly
            aria-label="Share link URL"
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            className={`w-full font-mono text-xs ${inputClass}`}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {copied
                ? "Link copied to clipboard"
                : "Copy this link to share your ship"}
            </p>
            <button
              type="button"
              onClick={() => setLink(null)}
              className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-400"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 11: Write `components/ship-builder/ui/MyShipsDialog.tsx`.** The parent mounts it only while open, so the `useState` initializer re-reads storage on every open.

```tsx
"use client";

import { useState } from "react";
import {
  deleteShip,
  listShips,
  renameShip,
  type SavedShip,
} from "@/lib/ship-builder/persist/local";
import { MAX_NAME_LENGTH } from "@/lib/ship-builder/model/placement";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import {
  buttonClass,
  dangerButtonClass,
  inputClass,
  panelClass,
} from "./styles";

interface MyShipsDialogProps {
  onClose: () => void;
}

export default function MyShipsDialog({ onClose }: MyShipsDialogProps) {
  const [ships, setShips] = useState<SavedShip[]>(() => listShips());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const loadShip = useShipBuilderStore((s) => s.loadShip);
  const rename = useShipBuilderStore((s) => s.rename);
  const savedId = useShipBuilderStore((s) => s.savedId);

  function handleLoad(entry: SavedShip) {
    loadShip(entry.ship, entry.id);
    onClose();
  }

  function commitRename(entry: SavedShip) {
    const name = draftName.trim().slice(0, MAX_NAME_LENGTH) || entry.name;
    if (renameShip(entry.id, name)) {
      if (entry.id === savedId) rename(name);
      setShips(listShips());
    }
    setRenamingId(null);
  }

  function handleDelete(entry: SavedShip) {
    if (deleteShip(entry.id)) setShips(listShips());
    setConfirmingId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="My Ships"
        className={`w-full max-w-md rounded-lg border p-4 shadow-xl ${panelClass}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Ships</h2>
          <button type="button" onClick={onClose} className={buttonClass}>
            Close
          </button>
        </div>

        {ships.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No saved ships yet. Use Save to keep a design here.
          </p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {ships.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-800"
              >
                {renamingId === entry.id ? (
                  <input
                    autoFocus
                    aria-label={`New name for ${entry.name}`}
                    value={draftName}
                    maxLength={MAX_NAME_LENGTH}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitRename(entry);
                      if (event.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => commitRename(entry)}
                    className={`flex-1 ${inputClass}`}
                  />
                ) : (
                  <span className="flex-1 truncate text-sm font-medium">
                    {entry.name}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Load ${entry.name}`}
                  onClick={() => handleLoad(entry)}
                  className={buttonClass}
                >
                  Load
                </button>
                <button
                  type="button"
                  aria-label={`Rename ${entry.name}`}
                  onClick={() => {
                    setRenamingId(entry.id);
                    setDraftName(entry.name);
                  }}
                  className={buttonClass}
                >
                  Rename
                </button>
                {confirmingId === entry.id ? (
                  <button
                    type="button"
                    aria-label={`Confirm delete ${entry.name}`}
                    onClick={() => handleDelete(entry)}
                    className={dangerButtonClass}
                  >
                    Confirm
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={`Delete ${entry.name}`}
                    onClick={() => setConfirmingId(entry.id)}
                    className={buttonClass}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Write `components/ship-builder/ui/RemovalConfirm.tsx`.**

```tsx
"use client";

import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { buttonClass, dangerButtonClass, panelClass } from "./styles";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function RemovalConfirm() {
  const pending = useShipBuilderStore((s) => s.pendingRemoval);
  const confirmRemoval = useShipBuilderStore((s) => s.confirmRemoval);
  const cancelRemoval = useShipBuilderStore((s) => s.cancelRemoval);
  if (!pending) return null;

  const message =
    pending.kind === "part"
      ? `Removing this part also removes ${plural(pending.ids.length - 1, "attached part")}.`
      : `Shortening the hull removes ${plural(pending.ids.length, "part")}.`;

  return (
    <div
      role="alertdialog"
      aria-label="Confirm removal"
      className={`absolute left-1/2 top-16 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${panelClass}`}
    >
      <p className="text-sm">{message}</p>
      <button
        type="button"
        onClick={confirmRemoval}
        className={dangerButtonClass}
      >
        Remove
      </button>
      <button type="button" onClick={cancelRemoval} className={buttonClass}>
        Keep
      </button>
    </div>
  );
}
```

- [ ] **Step 13: Write `components/ship-builder/ui/PlacementHint.tsx`.**

```tsx
"use client";

import { useMemo } from "react";
import { openAttachPoints } from "@/lib/ship-builder/model/attach";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";

export default function PlacementHint() {
  const tool = useShipBuilderStore((s) => s.tool);
  const hover = useShipBuilderStore((s) => s.hover);
  const ship = useShipBuilderStore((s) => s.ship);

  const noRoom = useMemo(() => {
    if (tool.kind !== "place") return null;
    const def = getPartDef(tool.type);
    if (def.placement !== "attach") return null;
    return openAttachPoints(ship, def).length === 0 ? def.emptyHint : null;
  }, [ship, tool]);

  if (tool.kind !== "place") return null;
  const def = getPartDef(tool.type);
  const rotateHint =
    def.placement === "grid" ? ` · R to rotate (${tool.rotation}°)` : "";

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-1.5 text-sm text-white shadow dark:bg-slate-100/90 dark:text-slate-900">
      {hover && !hover.result.ok ? (
        <span
          data-testid="placement-reason"
          className="font-medium text-red-300 dark:text-red-700"
        >
          {hover.result.reason}
        </span>
      ) : noRoom ? (
        <span>{noRoom}</span>
      ) : (
        <span>
          Placing {def.name}
          {rotateHint} · Esc to cancel
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 14: Write `components/ship-builder/ui/Notice.tsx`.**

```tsx
"use client";

import { useEffect } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { panelClass } from "./styles";

const NOTICE_MS = 5000;

export default function Notice() {
  const notice = useShipBuilderStore((s) => s.notice);
  const setNotice = useShipBuilderStore((s) => s.setNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);

  if (!notice) return null;
  return (
    <div
      role="status"
      className={`absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-2 text-sm shadow-lg ${panelClass}`}
    >
      <span>{notice}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setNotice(null)}
        className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 15: Write `components/ship-builder/ui/Toolbar.tsx`.**

```tsx
"use client";

import { useState } from "react";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { MAX_SEGMENTS, MIN_SEGMENTS } from "@/lib/ship-builder/model/grid";
import { MAX_NAME_LENGTH } from "@/lib/ship-builder/model/placement";
import { saveShip } from "@/lib/ship-builder/persist/local";
import {
  useShipBuilderStore,
  type CameraView,
} from "@/lib/ship-builder/state/store";
import MyShipsDialog from "./MyShipsDialog";
import ShareButton from "./ShareButton";
import {
  buttonClass,
  inputClass,
  panelClass,
  primaryButtonClass,
} from "./styles";

const CAMERA_VIEWS: { view: CameraView; label: string; ariaLabel: string }[] = [
  { view: "side", label: "Side", ariaLabel: "Side view" },
  { view: "top", label: "Top", ariaLabel: "Top view" },
  { view: "three-quarter", label: "¾", ariaLabel: "Three-quarter view" },
];

export default function Toolbar() {
  const [shipsOpen, setShipsOpen] = useState(false);
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const savedId = useShipBuilderStore((s) => s.savedId);
  const selectedId = useShipBuilderStore((s) => s.selectedId);
  const canUndo = useShipBuilderStore((s) => s.past.length > 0);
  const canRedo = useShipBuilderStore((s) => s.future.length > 0);
  const rename = useShipBuilderStore((s) => s.rename);
  const changeHullLength = useShipBuilderStore((s) => s.changeHullLength);
  const undo = useShipBuilderStore((s) => s.undo);
  const redo = useShipBuilderStore((s) => s.redo);
  const rotate = useShipBuilderStore((s) => s.rotate);
  const requestDelete = useShipBuilderStore((s) => s.requestDelete);
  const setCameraView = useShipBuilderStore((s) => s.setCameraView);
  const newShip = useShipBuilderStore((s) => s.newShip);
  const markSaved = useShipBuilderStore((s) => s.markSaved);
  const setNotice = useShipBuilderStore((s) => s.setNotice);

  const segments = ship.hull.lengthSegments;
  const canRotate =
    tool.kind === "place" && getPartDef(tool.type).placement === "grid";

  function handleSave() {
    const saved = saveShip(ship, savedId);
    if (saved) {
      markSaved(saved.id);
      setNotice("Saved to My Ships");
    } else {
      setNotice("Couldn't save — browser storage is unavailable");
    }
  }

  return (
    <footer
      className={`flex flex-wrap items-center gap-2 border-t px-3 py-2 ${panelClass}`}
    >
      <input
        aria-label="Ship name"
        value={ship.name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(event) => rename(event.target.value)}
        className={`w-44 ${inputClass}`}
      />

      <div
        role="group"
        aria-label="Hull length"
        className="flex items-center gap-1"
      >
        <button
          type="button"
          aria-label="Shorten hull"
          disabled={segments <= MIN_SEGMENTS}
          onClick={() => changeHullLength(-1)}
          className={buttonClass}
        >
          −
        </button>
        <span
          data-testid="hull-length"
          className="w-24 text-center text-sm tabular-nums"
        >
          {segments} segments
        </span>
        <button
          type="button"
          aria-label="Lengthen hull"
          disabled={segments >= MAX_SEGMENTS}
          onClick={() => changeHullLength(1)}
          className={buttonClass}
        >
          +
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!canUndo}
          onClick={undo}
          className={buttonClass}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={redo}
          className={buttonClass}
        >
          Redo
        </button>
        <button
          type="button"
          disabled={!canRotate}
          onClick={rotate}
          className={buttonClass}
        >
          Rotate
        </button>
        <button
          type="button"
          disabled={!selectedId}
          onClick={requestDelete}
          className={buttonClass}
        >
          Delete
        </button>
      </div>

      <div role="group" aria-label="Camera" className="flex items-center gap-1">
        {CAMERA_VIEWS.map(({ view, label, ariaLabel }) => (
          <button
            key={view}
            type="button"
            aria-label={ariaLabel}
            onClick={() => setCameraView(view)}
            className={buttonClass}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" onClick={newShip} className={buttonClass}>
          New
        </button>
        <button
          type="button"
          onClick={handleSave}
          className={primaryButtonClass}
        >
          Save
        </button>
        <ShareButton />
        <button
          type="button"
          onClick={() => setShipsOpen(true)}
          className={buttonClass}
        >
          My Ships
        </button>
      </div>

      {shipsOpen && <MyShipsDialog onClose={() => setShipsOpen(false)} />}
    </footer>
  );
}
```

- [ ] **Step 16: Wire into `components/ship-builder/ShipBuilder.tsx`.** Add these imports:

```tsx
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import useShipPersistence from "./hooks/useShipPersistence";
import Notice from "./ui/Notice";
import PlacementHint from "./ui/PlacementHint";
import RemovalConfirm from "./ui/RemovalConfirm";
import Toolbar from "./ui/Toolbar";
```

Call `useShipPersistence();` and `useKeyboardShortcuts();` next to `useTestHook();`. Inside `<main>`, after the scene/fallback conditional, add:

```tsx
          <Notice />
          <RemovalConfirm />
          <PlacementHint />
```

Then add `<Toolbar />` as the last child of the outer `div`, after the panels row.

- [ ] **Step 17: Run the tests.** `npm test -- --testPathPatterns=components/ship-builder` → PASS. Then `npm run lint && npm run type-check` → clean.

- [ ] **Step 18: Commit.**

```bash
git add components/ship-builder
git commit -m "feat(ship-builder): add toolbar, shortcuts, autosave, share links, and My Ships"
```

---

### Task 9: 3D scene — ocean, hull, part meshes, camera

**Goal:** Render the ship with a sea, sky, lights and a clamped orbit camera with presets. Parts are procedural low-poly meshes in Edwardian livery. The scene loads only on this route, and never at build time.

**Files:**

- Create: `components/ship-builder/scene/coords.ts`
- Create: `components/ship-builder/scene/palette.ts`
- Create: `components/ship-builder/scene/Scene.tsx`
- Create: `components/ship-builder/scene/Ocean.tsx`
- Create: `components/ship-builder/scene/Hull.tsx`
- Create: `components/ship-builder/scene/PartMesh.tsx`
- Create: `components/ship-builder/scene/ShipParts.tsx`
- Create: `components/ship-builder/scene/CameraRig.tsx`
- Modify: `components/ship-builder/ShipBuilder.tsx`
- Test: `components/ship-builder/scene/__tests__/coords.test.ts`

**Acceptance Criteria:**

- [ ] `modelToWorld` puts the bow at world +X, starboard (`z = 0`) at world +Z, and the main deck at `DECK_Y`
- [ ] The hull is black above a red antifouling band that shows above the waterline, with a pointed prow and a rounded stern
- [ ] Every part type renders at its model position. Clicking a part with no tool selects it, hover highlights it, and clicking empty space deselects
- [ ] Parts pending removal are tinted red
- [ ] The camera can't go below the water, and the Side/Top/¾ presets move it
- [ ] The scene is imported with `next/dynamic` and `ssr: false`, and `npm run build` still succeeds

**Verify:** `npm test -- --testPathPatterns=scene/__tests__/coords` → PASS; `npm run build` → success. Then check manually in `npm run dev`.

**Steps:**

- [ ] **Step 1: Write the failing test `components/ship-builder/scene/__tests__/coords.test.ts`.**

```ts
import { DECK_Y, footprintBase, modelToWorld } from "../coords";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import type { GridPartDef } from "@/lib/ship-builder/model/types";

describe("modelToWorld", () => {
  it("puts the bow at +X, starboard at +Z, and the deck at DECK_Y", () => {
    expect(modelToWorld(24, { x: 0, y: 0, z: 0 })).toEqual([12, DECK_Y, 2]);
    expect(modelToWorld(24, { x: 24, y: 2, z: 4 })).toEqual([
      -12,
      DECK_Y + 2,
      -2,
    ]);
  });
});

describe("footprintBase", () => {
  it("centers a rotated footprint on its cells", () => {
    const def = getPartDef("deck-2x1") as GridPartDef;
    expect(
      footprintBase(def, { kind: "grid", level: 1, x: 3, z: 0 }, 90)
    ).toEqual({
      center: { x: 3.5, y: 1, z: 1 },
      size: { x: 1, z: 2 },
    });
  });
});
```

- [ ] **Step 2: Run the test.** Expected: FAIL (module missing).

- [ ] **Step 3: Write `components/ship-builder/scene/coords.ts`.**

```ts
import { GRID_WIDTH, rotatedFootprint } from "@/lib/ship-builder/model/grid";
import type {
  GridAnchor,
  GridPartDef,
  Rotation,
  Vec3,
} from "@/lib/ship-builder/model/types";

/** Main deck height above the waterline (world y = 0). */
export const DECK_Y = 1.2;
export const HULL_DRAFT = 1.6;
/** Red antifouling shows this far above the waterline. */
export const BOOT_TOP = 0.25;
export const LEVEL_HEIGHT = 1;

export type WorldPosition = [number, number, number];

/** Model → world: a 180° turn about Y so the bow faces +X. */
export function modelToWorld(lengthCells: number, p: Vec3): WorldPosition {
  return [
    lengthCells / 2 - p.x,
    DECK_Y + p.y * LEVEL_HEIGHT,
    GRID_WIDTH / 2 - p.z,
  ];
}

export function footprintBase(
  def: GridPartDef,
  anchor: GridAnchor,
  rotation: Rotation
): { center: Vec3; size: { x: number; z: number } } {
  const size = rotatedFootprint(def.footprint, rotation);
  return {
    center: {
      x: anchor.x + size.x / 2,
      y: anchor.level,
      z: anchor.z + size.z / 2,
    },
    size,
  };
}
```

- [ ] **Step 4: Run the test.** Expected: PASS.

- [ ] **Step 5: Write `components/ship-builder/scene/palette.ts`.** This is the scene's fixed palette, used regardless of the site theme.

```ts
export const PALETTE = {
  sky: "#bcd4e6",
  sea: "#1f4e6e",
  hull: "#15171a",
  antifouling: "#8e2a22",
  deck: "#c9a878",
  superstructure: "#f3efe4",
  bridgeWindows: "#2c3e50",
  funnel: "#d39b45",
  funnelTop: "#141414",
  mast: "#5b4632",
  davit: "#e8e4d8",
  lifeboat: "#f7f7f2",
  collapsible: "#c8b78e",
  cabin: { first: "#b8912a", second: "#3f6fa8", third: "#6f7f5c" },
  tint: { "ghost-ok": "#22c55e", "ghost-bad": "#ef4444", removal: "#ef4444" },
  emphasis: { hover: "#facc15", selected: "#38bdf8" },
  gridTarget: "#38bdf8",
  attachMarker: "#facc15",
} as const;
```

- [ ] **Step 6: Write `components/ship-builder/scene/Ocean.tsx`.**

```tsx
"use client";

import { PALETTE } from "./palette";

export default function Ocean() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[600, 600]} />
      <meshStandardMaterial
        color={PALETTE.sea}
        roughness={0.35}
        metalness={0.1}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}
```

- [ ] **Step 7: Write `components/ship-builder/scene/Hull.tsx`.**

```tsx
"use client";

import { useMemo } from "react";
import { Shape } from "three";
import { PROW_LENGTH, STERN_LENGTH } from "@/lib/ship-builder/model/attach";
import { GRID_WIDTH } from "@/lib/ship-builder/model/grid";
import { BOOT_TOP, DECK_Y, HULL_DRAFT } from "./coords";
import { PALETTE } from "./palette";

interface HullProps {
  lengthCells: number;
}

interface HullBandProps {
  lengthCells: number;
  bottom: number;
  top: number;
  color: string;
  prow: Shape;
}

function HullBand({ lengthCells, bottom, top, color, prow }: HullBandProps) {
  const height = top - bottom;
  const half = lengthCells / 2;
  const radius = GRID_WIDTH / 2;
  return (
    <group>
      <mesh position={[0, bottom + height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[lengthCells, height, GRID_WIDTH]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Prow: triangle in XY, extruded along Z, turned so Z becomes up. */}
      <mesh
        position={[half, bottom, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
      >
        <extrudeGeometry
          args={[prow, { depth: height, bevelEnabled: false }]}
        />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Stern: half cylinder facing -X, squashed to STERN_LENGTH. */}
      <mesh
        position={[-half, bottom + height / 2, 0]}
        scale={[STERN_LENGTH / radius, 1, 1]}
        castShadow
      >
        <cylinderGeometry
          args={[radius, radius, height, 24, 1, false, Math.PI, Math.PI]}
        />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

export default function Hull({ lengthCells }: HullProps) {
  const prow = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, -GRID_WIDTH / 2);
    shape.lineTo(PROW_LENGTH, 0);
    shape.lineTo(0, GRID_WIDTH / 2);
    shape.closePath();
    return shape;
  }, []);

  return (
    <group>
      <HullBand
        lengthCells={lengthCells}
        bottom={-HULL_DRAFT}
        top={BOOT_TOP}
        color={PALETTE.antifouling}
        prow={prow}
      />
      <HullBand
        lengthCells={lengthCells}
        bottom={BOOT_TOP}
        top={DECK_Y}
        color={PALETTE.hull}
        prow={prow}
      />
      <mesh position={[0, DECK_Y + 0.01, 0]} receiveShadow>
        <boxGeometry args={[lengthCells, 0.02, GRID_WIDTH]} />
        <meshStandardMaterial color={PALETTE.deck} />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 8: Write `components/ship-builder/scene/PartMesh.tsx`.**

```tsx
"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { resolveAttachPoint } from "@/lib/ship-builder/model/attach";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { gridLength } from "@/lib/ship-builder/model/grid";
import type { PartCandidate } from "@/lib/ship-builder/model/placement";
import type {
  GridPartDef,
  PartType,
  Ship,
  Side,
} from "@/lib/ship-builder/model/types";
import { footprintBase, modelToWorld } from "./coords";
import { PALETTE } from "./palette";

export type PartTint = keyof typeof PALETTE.tint | null;
export type PartEmphasis = keyof typeof PALETTE.emphasis | null;

interface PartMeshProps {
  ship: Ship;
  part: PartCandidate;
  tint?: PartTint;
  emphasis?: PartEmphasis;
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

interface SurfaceProps {
  color: string;
  tint: PartTint;
  emphasis: PartEmphasis;
}

function Surface({ color, tint, emphasis }: SurfaceProps) {
  const ghost = tint === "ghost-ok" || tint === "ghost-bad";
  return (
    <meshStandardMaterial
      color={tint ? PALETTE.tint[tint] : color}
      transparent={ghost}
      opacity={ghost ? 0.55 : 1}
      emissive={emphasis ? PALETTE.emphasis[emphasis] : "#000000"}
      emissiveIntensity={emphasis ? 0.4 : 0}
    />
  );
}

interface BlockProps {
  def: GridPartDef;
  size: { x: number; z: number };
  tint: PartTint;
  emphasis: PartEmphasis;
}

function Block({ def, size, tint, emphasis }: BlockProps) {
  const surface = { tint, emphasis };
  const height = def.role === "bridge" ? 0.8 : 0.95;
  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[size.x * 0.96, height, size.z * 0.96]} />
        <Surface color={PALETTE.superstructure} {...surface} />
      </mesh>
      {def.passengers && (
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[size.x * 0.98, 0.12, size.z * 0.98]} />
          <Surface
            color={PALETTE.cabin[def.passengers.cabinClass]}
            {...surface}
          />
        </mesh>
      )}
      {def.role === "bridge" && (
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[size.x * 0.98, 0.15, size.z * 0.98]} />
          <Surface color={PALETTE.bridgeWindows} {...surface} />
        </mesh>
      )}
    </group>
  );
}

interface FittingProps {
  type: PartType;
  side?: Side;
  tint: PartTint;
  emphasis: PartEmphasis;
}

function Fitting({ type, side, tint, emphasis }: FittingProps) {
  const surface = { tint, emphasis };
  // Starboard is world +Z (see coords.ts), so outboard is +Z there.
  const outward = side === "starboard" ? 1 : -1;
  switch (type) {
    case "funnel":
      return (
        <group>
          <mesh position={[0, 1.3, 0]} castShadow>
            <cylinderGeometry args={[0.38, 0.42, 2.6, 16]} />
            <Surface color={PALETTE.funnel} {...surface} />
          </mesh>
          <mesh position={[0, 2.9, 0]} castShadow>
            <cylinderGeometry args={[0.39, 0.39, 0.6, 16]} />
            <Surface color={PALETTE.funnelTop} {...surface} />
          </mesh>
        </group>
      );
    case "mast-fore":
    case "mast-aft":
      return (
        <mesh position={[0, 3.5, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.08, 7, 8]} />
          <Surface color={PALETTE.mast} {...surface} />
        </mesh>
      );
    case "davit":
      return (
        <group>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.08, 0.8, 0.08]} />
            <Surface color={PALETTE.davit} {...surface} />
          </mesh>
          <mesh position={[0, 0.8, outward * 0.3]}>
            <boxGeometry args={[0.08, 0.08, 0.6]} />
            <Surface color={PALETTE.davit} {...surface} />
          </mesh>
        </group>
      );
    case "lifeboat-standard":
    case "lifeboat-collapsible": {
      const collapsible = type === "lifeboat-collapsible";
      const height = collapsible ? 0.2 : 0.3;
      return (
        <mesh position={[0, -0.1 - height / 2, 0]} castShadow>
          <boxGeometry args={[0.9, height, 0.35]} />
          <Surface
            color={collapsible ? PALETTE.collapsible : PALETTE.lifeboat}
            {...surface}
          />
        </mesh>
      );
    }
    default:
      return null;
  }
}

export default function PartMesh({
  ship,
  part,
  tint = null,
  emphasis = null,
  onPointerOver,
  onPointerOut,
  onClick,
}: PartMeshProps) {
  const def = getPartDef(part.type);
  const length = gridLength(ship);
  const handlers = { onPointerOver, onPointerOut, onClick };

  if (def.placement === "grid") {
    if (part.anchor.kind !== "grid") return null;
    const { center, size } = footprintBase(def, part.anchor, part.rotation);
    return (
      <group position={modelToWorld(length, center)} {...handlers}>
        <Block def={def} size={size} tint={tint} emphasis={emphasis} />
      </group>
    );
  }

  if (part.anchor.kind !== "attach") return null;
  const point = resolveAttachPoint(ship, part.anchor);
  if (!point) return null;
  return (
    <group position={modelToWorld(length, point.position)} {...handlers}>
      <Fitting
        type={part.type}
        side={point.side}
        tint={tint}
        emphasis={emphasis}
      />
    </group>
  );
}
```

- [ ] **Step 9: Write `components/ship-builder/scene/ShipParts.tsx`.**

```tsx
"use client";

import { useState } from "react";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import PartMesh from "./PartMesh";

export default function ShipParts() {
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const selectedId = useShipBuilderStore((s) => s.selectedId);
  const pendingRemoval = useShipBuilderStore((s) => s.pendingRemoval);
  const select = useShipBuilderStore((s) => s.select);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Parts only take pointer events with no tool active, so they never steal
  // clicks from grid targets or attach markers.
  const interactive = tool.kind === "none";
  const removing = new Set(pendingRemoval?.ids ?? []);

  return (
    <group>
      {ship.parts.map((part) => (
        <PartMesh
          key={part.id}
          ship={ship}
          part={part}
          tint={removing.has(part.id) ? "removal" : null}
          emphasis={
            selectedId === part.id
              ? "selected"
              : interactive && hoveredId === part.id
                ? "hover"
                : null
          }
          {...(interactive && {
            onPointerOver: (event) => {
              event.stopPropagation();
              setHoveredId(part.id);
            },
            onPointerOut: () =>
              setHoveredId((current) => (current === part.id ? null : current)),
            onClick: (event) => {
              event.stopPropagation();
              select(part.id);
            },
          })}
        />
      ))}
    </group>
  );
}
```

- [ ] **Step 10: Write `components/ship-builder/scene/CameraRig.tsx`.**

```tsx
"use client";

import { useEffect, useRef, type ComponentRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { gridLength } from "@/lib/ship-builder/model/grid";
import {
  useShipBuilderStore,
  type CameraView,
} from "@/lib/ship-builder/state/store";
import { DECK_Y } from "./coords";

const TARGET: [number, number, number] = [0, DECK_Y + 1.5, 0];

function viewPosition(
  view: CameraView,
  lengthCells: number
): [number, number, number] {
  const distance = lengthCells * 0.9 + 12;
  switch (view) {
    case "side":
      return [0, DECK_Y + 3, distance];
    case "top":
      return [0, distance * 1.2, 0.01];
    case "three-quarter":
      return [distance * 0.65, distance * 0.45, distance * 0.65];
  }
}

export default function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const get = useThree((state) => state.get);
  const camera = useShipBuilderStore((s) => s.camera);

  useEffect(() => {
    const lengthCells = gridLength(useShipBuilderStore.getState().ship);
    get().camera.position.set(...viewPosition(camera.view, lengthCells));
    controls.current?.target.set(...TARGET);
    controls.current?.update();
  }, [camera, get]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={TARGET}
      minDistance={6}
      maxDistance={90}
      maxPolarAngle={Math.PI / 2 - 0.08}
    />
  );
}
```

> If `react-hooks/immutability` flags the mutation inside the effect, keep the `get()` access pattern. Add a one-line `// eslint-disable-next-line react-hooks/immutability -- imperative three.js camera move` on that line rather than restructuring.

- [ ] **Step 11: Write `components/ship-builder/scene/Scene.tsx`.** Task 10 adds the interaction layers.

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import CameraRig from "./CameraRig";
import Hull from "./Hull";
import Ocean from "./Ocean";
import { PALETTE } from "./palette";
import ShipParts from "./ShipParts";

export default function Scene() {
  const lengthCells = useShipBuilderStore((s) => gridLength(s.ship));
  const select = useShipBuilderStore((s) => s.select);

  return (
    <div data-testid="ship-canvas" className="h-full w-full">
      <Canvas
        shadows
        camera={{ position: [24, 16, 24], fov: 45 }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={[PALETTE.sky]} />
        <fog attach="fog" args={[PALETTE.sky, 80, 260]} />
        <Sky sunPosition={[100, 40, 80]} distance={450} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[30, 40, 20]} intensity={1.4} castShadow />
        <Ocean />
        <Hull lengthCells={lengthCells} />
        <ShipParts />
        <CameraRig />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 12: Load the scene dynamically in `ShipBuilder.tsx`.** Add:

```tsx
import dynamic from "next/dynamic";

const Scene = dynamic(() => import("./scene/Scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
      Launching the shipyard…
    </div>
  ),
});
```

Replace `<div data-testid="scene-placeholder" className="h-full w-full" />` with `webgl ? <Scene /> : null`. The conditional becomes `webgl === false ? <WebGLFallback /> : webgl ? <Scene /> : null`.

- [ ] **Step 13: Verify.**

Run: `npm test -- --testPathPatterns=scene/__tests__/coords` → PASS
Run: `npm run lint && npm run type-check && npm run build` → success. Also confirm `three` isn't in the home page chunk: `grep -l "WebGLRenderer" out/_next/static/chunks/*.js` should list only route-specific chunks, not ones referenced by `out/index.html`.
Manual: `npm run dev` → `/ship-builder`. Check the hull, sea and sky render. Drag to orbit and confirm you can't go below the water. Click Side/Top/¾. Then add parts through the dev console (`window.__shipBuilderStore.getState()`) and confirm every type renders where expected.

- [ ] **Step 14: Commit.**

```bash
git add components/ship-builder
git commit -m "feat(ship-builder): render ocean, hull, parts, and orbit camera"
```

---

### Task 10: Scene interaction — grid targets, attach markers, ghost preview

**Goal:** Implement tap-to-place in the scene. With a grid tool, each column shows a target at its next free level. With an attach tool, every open point shows a marker. Hovering shows a green or red ghost (the reason appears in `PlacementHint`), and clicking places.

**Files:**

- Create: `components/ship-builder/scene/GridTargets.tsx`
- Create: `components/ship-builder/scene/AttachMarkers.tsx`
- Create: `components/ship-builder/scene/GhostPreview.tsx`
- Modify: `components/ship-builder/scene/Scene.tsx`

**Acceptance Criteria:**

- [ ] The grid overlay is visible only while a grid part is selected
- [ ] Attach markers are visible only while an attach part is selected, and only at open points that fit it
- [ ] The ghost snaps to the hovered cell or point: green when valid, red when not, and it rotates with `R`
- [ ] Clicking places through `placeAt`. The scene never calls `place`/`canPlace` itself

**Verify:** `npm run lint && npm run type-check`. Then run manually in `npm run dev`: place a deck block, stack a second, add a davit and a lifeboat, add a funnel, and hover an invalid cell to see the red ghost and its reason.

**Steps:**

- [ ] **Step 1: Write `components/ship-builder/scene/GridTargets.tsx`.**

```tsx
"use client";

import { useMemo } from "react";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import {
  buildOccupancy,
  GRID_WIDTH,
  gridLength,
  MAX_LEVEL,
  topLevel,
} from "@/lib/ship-builder/model/grid";
import type { GridAnchor } from "@/lib/ship-builder/model/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { modelToWorld } from "./coords";
import { PALETTE } from "./palette";

export default function GridTargets() {
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const hoverAt = useShipBuilderStore((s) => s.hoverAt);
  const placeAt = useShipBuilderStore((s) => s.placeAt);

  const anchors = useMemo<GridAnchor[]>(() => {
    if (tool.kind !== "place" || getPartDef(tool.type).placement !== "grid") {
      return [];
    }
    const occupancy = buildOccupancy(ship);
    const list: GridAnchor[] = [];
    for (let x = 0; x < gridLength(ship); x++) {
      for (let z = 0; z < GRID_WIDTH; z++) {
        const level = topLevel(occupancy, x, z) + 1;
        if (level <= MAX_LEVEL) list.push({ kind: "grid", level, x, z });
      }
    }
    return list;
  }, [ship, tool]);

  const length = gridLength(ship);
  return (
    <group>
      {anchors.map((anchor) => {
        const [x, y, z] = modelToWorld(length, {
          x: anchor.x + 0.5,
          y: anchor.level,
          z: anchor.z + 0.5,
        });
        return (
          <mesh
            key={`${anchor.level}:${anchor.x}:${anchor.z}`}
            position={[x, y + 0.03, z]}
            onPointerOver={(event) => {
              event.stopPropagation();
              hoverAt(anchor);
            }}
            onPointerOut={() => hoverAt(null)}
            onClick={(event) => {
              event.stopPropagation();
              placeAt(anchor);
            }}
          >
            <boxGeometry args={[0.94, 0.06, 0.94]} />
            <meshBasicMaterial
              color={PALETTE.gridTarget}
              transparent
              opacity={0.18}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
```

- [ ] **Step 2: Write `components/ship-builder/scene/AttachMarkers.tsx`.**

```tsx
"use client";

import { useMemo } from "react";
import { openAttachPoints } from "@/lib/ship-builder/model/attach";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import { gridLength } from "@/lib/ship-builder/model/grid";
import type { AttachAnchor } from "@/lib/ship-builder/model/types";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { modelToWorld } from "./coords";
import { PALETTE } from "./palette";

export default function AttachMarkers() {
  const ship = useShipBuilderStore((s) => s.ship);
  const tool = useShipBuilderStore((s) => s.tool);
  const hoverAt = useShipBuilderStore((s) => s.hoverAt);
  const placeAt = useShipBuilderStore((s) => s.placeAt);

  const open = useMemo(() => {
    if (tool.kind !== "place") return [];
    const def = getPartDef(tool.type);
    return def.placement === "attach" ? openAttachPoints(ship, def) : [];
  }, [ship, tool]);

  const length = gridLength(ship);
  return (
    <group>
      {open.map(({ parentId, point }) => {
        const anchor: AttachAnchor = {
          kind: "attach",
          parentId,
          pointId: point.id,
        };
        return (
          <mesh
            key={`${parentId}/${point.id}`}
            position={modelToWorld(length, point.position)}
            onPointerOver={(event) => {
              event.stopPropagation();
              hoverAt(anchor);
            }}
            onPointerOut={() => hoverAt(null)}
            onClick={(event) => {
              event.stopPropagation();
              placeAt(anchor);
            }}
          >
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshBasicMaterial color={PALETTE.attachMarker} />
          </mesh>
        );
      })}
    </group>
  );
}
```

- [ ] **Step 3: Write `components/ship-builder/scene/GhostPreview.tsx`.**

```tsx
"use client";

import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import PartMesh from "./PartMesh";

export default function GhostPreview() {
  const hover = useShipBuilderStore((s) => s.hover);
  const ship = useShipBuilderStore((s) => s.ship);
  if (!hover) return null;
  return (
    <PartMesh
      ship={ship}
      part={hover.candidate}
      tint={hover.result.ok ? "ghost-ok" : "ghost-bad"}
    />
  );
}
```

- [ ] **Step 4: Add the layers to `Scene.tsx`.** Import `GridTargets`, `AttachMarkers` and `GhostPreview`, and render them after `<ShipParts />`:

```tsx
        <ShipParts />
        <GridTargets />
        <AttachMarkers />
        <GhostPreview />
        <CameraRig />
```

- [ ] **Step 5: Verify.** Run `npm run lint && npm run type-check`. Then in `npm run dev`:
  1. Select "Deck block 1×1": targets appear. Hover a cell for a green ghost, and click to place it.
  2. Stack a second block on it, select Davit, click the yellow marker on its outer edge. Then select Lifeboat and click the marker under the davit arm.
  3. Hover a level-0 cell with the bridge in the aft half: the ghost turns red and the hint reads "The bridge must be in the forward half".
  4. Press `R` with "Deck block 2×1": the ghost turns 90°.
  5. Press Esc: targets disappear. Click a part to select it, then press Delete.

- [ ] **Step 6: Commit.**

```bash
git add components/ship-builder/scene
git commit -m "feat(ship-builder): add tap-to-place targets, attach markers, and ghost preview"
```

---

### Task 11: End-to-end tests and ship-time validation

**Goal:** A Playwright spec covering the spec's e2e scenario (place a deck block, davit and lifeboat; stats update; the share link round-trips) plus invalid share links, autosave, undo and the rejection reason. After that, full validation.

**Files:**

- Create: `e2e/ship-builder.spec.ts`

**Acceptance Criteria:**

- [ ] The spec passes on Chromium, Firefox and WebKit. Only "renders the 3D scene" is skipped outside Chromium
- [ ] `npm run validate` passes
- [ ] `npm run test:e2e` passes, including the existing home spec

**Verify:** `npm run test:e2e -- e2e/ship-builder.spec.ts` → all pass; `npm run validate` → green

**Steps:**

- [ ] **Step 1: Write `e2e/ship-builder.spec.ts`.**

```ts
import { test, expect, type Page } from "@playwright/test";
import type { Anchor } from "@/lib/ship-builder/model/types";

async function openBuilder(page: Page, hash = "") {
  await page.goto(`/ship-builder${hash}`);
  await expect(
    page.getByRole("heading", { name: "Ship Builder" })
  ).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
}

async function place(page: Page, partName: RegExp, anchor: Anchor) {
  const button = page.getByRole("button", { name: partName });
  if ((await button.getAttribute("aria-pressed")) !== "true")
    await button.click();
  const result = await page.evaluate(
    (a) => window.__shipBuilderStore!.getState().placeAt(a),
    anchor
  );
  expect(result).toEqual({ ok: true });
}

async function partId(page: Page, index: number): Promise<string> {
  return page.evaluate(
    (i) => window.__shipBuilderStore!.getState().ship.parts[i].id,
    index
  );
}

async function buildBoatDeck(page: Page) {
  await place(page, /Deck block 1×1/, { kind: "grid", level: 0, x: 0, z: 0 });
  await place(page, /Deck block 1×1/, { kind: "grid", level: 1, x: 0, z: 0 });
  const upper = await partId(page, 1);
  await place(page, /^Davit/, {
    kind: "attach",
    parentId: upper,
    pointId: "davit:0:0",
  });
  const davit = await partId(page, 2);
  await place(page, /^Lifeboat/, {
    kind: "attach",
    parentId: davit,
    pointId: "boat",
  });
  await place(page, /First-class cabins/, {
    kind: "grid",
    level: 0,
    x: 1,
    z: 0,
  });
}

async function expectBoatDeckStats(page: Page) {
  await expect(page.getByTestId("stat-people")).toHaveText("510");
  await expect(page.getByTestId("stat-seats")).toHaveText("65");
  await expect(page.getByTestId("stat-coverage")).toHaveText("13%");
}

test.describe("Ship Builder", () => {
  test("builds a boat deck and updates stats", async ({ page }) => {
    await openBuilder(page);
    await expect(page.getByTestId("stat-people")).toHaveText("480");
    await expect(page.getByTestId("stat-seats")).toHaveText("0");
    await buildBoatDeck(page);
    await expectBoatDeckStats(page);
  });

  test("share link reopens the same ship", async ({ page, browser }) => {
    await openBuilder(page);
    await buildBoatDeck(page);
    await page.getByRole("button", { name: "Share" }).click();
    const link = await page.getByLabel("Share link URL").inputValue();
    expect(link).toContain("/ship-builder#ship=");

    const context = await browser.newContext();
    const fresh = await context.newPage();
    await fresh.goto(link);
    await expect(
      fresh.getByRole("heading", { name: "Ship Builder" })
    ).toBeVisible();
    await expectBoatDeckStats(fresh);
    await expect(fresh).toHaveURL(/\/ship-builder$/);
    await context.close();
  });

  test("an invalid share link shows a notice and a fresh hull", async ({
    page,
  }) => {
    await openBuilder(page, "#ship=not-a-ship");
    await expect(page.getByRole("status")).toHaveText(
      /Couldn't load that ship/
    );
    await expect(page.getByTestId("stat-people")).toHaveText("480");
  });

  test("autosaves and restores after reload", async ({ page }) => {
    await openBuilder(page);
    await place(page, /Deck block 1×1/, { kind: "grid", level: 0, x: 3, z: 1 });
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("ship-builder:autosave"))
      )
      .toContain("deck-1x1");
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__shipBuilderStore));
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__shipBuilderStore!.getState().ship.parts.length
        )
      )
      .toBe(1);
  });

  test("undo with the keyboard and lengthen the hull", async ({ page }) => {
    await openBuilder(page);
    await place(page, /Deck block 1×1/, { kind: "grid", level: 0, x: 0, z: 0 });
    await page.getByRole("heading", { name: "Ship Builder" }).click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+z");
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__shipBuilderStore!.getState().ship.parts.length
        )
      )
      .toBe(0);
    await page.getByRole("button", { name: "Lengthen hull" }).click();
    await expect(page.getByTestId("hull-length")).toHaveText("9 segments");
  });

  test("shows the rule reason for an invalid placement", async ({ page }) => {
    await openBuilder(page);
    await page.getByRole("button", { name: /Deck block 1×1/ }).click();
    await page.evaluate(() =>
      window
        .__shipBuilderStore!.getState()
        .hoverAt({ kind: "grid", level: 1, x: 5, z: 1 })
    );
    await expect(page.getByTestId("placement-reason")).toHaveText(
      "Needs a deck beneath every cell"
    );
  });

  test("renders the 3D scene", async ({ page, browserName }) => {
    test.skip(
      browserName !== "chromium",
      "WebGL is only reliable in headless Chromium"
    );
    await openBuilder(page);
    await expect(
      page.locator('[data-testid="ship-canvas"] canvas')
    ).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the spec.** `npm run test:e2e -- e2e/ship-builder.spec.ts`. Expected: all pass, with "renders the 3D scene" skipped on Firefox and WebKit.
  - If the share-link test fails because the new context lands on the WebGL fallback, that's fine. The stats panel renders either way, so check the assertions instead.
  - If the autosave test is flaky under StrictMode, check that `useShipPersistence` flushes on cleanup (Task 8, Step 9).

- [ ] **Step 3: Ship-time validation.**

Run: `npm run validate` → lint, format, types, unit tests and build all green. If Prettier complains, run `npm run format` and include the changes.
Run: `npm run test:e2e` → the full suite passes (home + ship builder).

- [ ] **Step 4: Commit.**

```bash
git add e2e/ship-builder.spec.ts
git commit -m "test(ship-builder): add end-to-end coverage for building and sharing"
```

---

## Self-review notes

- **Spec coverage:**

  | Spec item                                                                   | Task |
  | --------------------------------------------------------------------------- | ---- |
  | Data model and catalog                                                      | 1    |
  | Grid and attach points                                                      | 2    |
  | Placement rules 1–6, cascade, hull shrink                                   | 3    |
  | Undo/redo                                                                   | 6    |
  | Stats, warnings, Titanic row                                                | 4    |
  | Desktop layout and drawers                                                  | 7    |
  | Toolbar, controls and keyboard                                              | 8    |
  | Scene, camera clamp and presets                                             | 9    |
  | Ghost preview, grid overlay, tap-to-place                                   | 10   |
  | My Ships, autosave, share link, versioning, invalid data, storage try/catch | 5, 8 |
  | WebGL fallback                                                              | 7    |
  | Sitemap                                                                     | 7    |
  | RTL tests                                                                   | 7, 8 |
  | Playwright                                                                  | 11   |

- **Interpretations** are listed at the top. These were not in the spec: rule 6 covers davits, masts sit on the hull extensions, the bridge is 1×4, delete confirmation only appears for cascades, and Firebase gets `cleanUrls`.
- **Out of scope (spec non-goals and follow-ups):** tablet polish, phone layout, challenges, cloud saves, and the home-page terminal command.
