# Pirate Ships (Ship Builder 2.13.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifth ship kind, `pirate`: wooden sailing ships driven by sail area, with new hull ends, ~23 new parts, four templates and the rules, UI and save-format changes to match.

**Architecture:** Pirate is one more `ShipKind` in the v2 ship-types framework (kind defaults, per-kind parts via `kinds`, per-kind reference ship and drivetrain). Sails attach to new `sail-mount` points that wooden masts expose (slot count = mast capacity), so "too much sail" is impossible by construction. Speed comes from total `sailArea` through a new `computeSailSpeed`. Meshes are procedural three.js grouped in four files behind a registry so the mesh tasks run in parallel with no shared-file conflicts.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, react-three-fiber/three, Tailwind 4, zod, Jest + RTL, Playwright. Spec: `docs/superpowers/specs/2026-10-06-ship-builder-pirate-ships-design.md`.

## Deviations from the spec (found while reading the code)

Each one is small and is mirrored back into the spec in Task 1.

1. **Sail capacity** is enforced by placement (each wooden mast exposes 1, 2 or 3 `sail:<n>` spots), so there is no "Too many sails for your masts" check. The warnings are `no-sails`, `no-rudder`, plus the shared ones.
2. **Helm anywhere:** the helm wheel (role `bridge`) may go in either half like cargo bridges, because a real quarterdeck is aft. Rule in `isBridgeSpotAllowed`.
3. **Decor is decor:** crew, parrot, anchor, barrels, crates and chest are 1×1 grid decor like deck chairs (they block their own cell in walk mode, as all decor does). The parrot is therefore deck decor, not a rail perch.
4. **Rowboat** holds 12 seats (not 8) and pirate crew is 5 per segment (not 60), so lifeboat and berth checks stay reachable on a wooden ship.
5. **Tap to fire:** cannons recoil and puff when tapped via a bubbling `onClick`, with no change to selection handling.
6. Shared parts that make no sense on a pirate ship (`bridge*`, `mast`, `propeller`) get `kinds` listing the other four kinds.

## Task graph and execution notes

```
T1 (kind, save v7, hull ends, kind tables) -> T2 (rules + part registry)
T2 -> T3 sails/masts meshes  \
T2 -> T4 cannon meshes        \  parallel, each owns its own files
T2 -> T5 deco meshes           /
T2 -> T6 crew/plank/parrot    /
T2 -> T7 templates + fixtures /
T3..T7 -> T8 (dialog layout polish, drive HUD label, help, e2e, release 2.13.0)
```

- T1 and T2 are sequential, one implementer, one commit per sub-step. They change the save format and the rules, so they get a spec review plus an adversarial review (global CLAUDE.md: data-boundary work).
- T3-T7 run in parallel worktrees (user preference). Merge in order T3, T4, T5, T6, T7. Each agent prompt must say: `git reset --hard worktree-pirate-ships`, symlink `node_modules` from the main checkout, use `npx next build --webpack`, skip local Firefox (`--project=chromium --project=webkit --project=ipad`).
- Reviews: one combined review per mesh task, fix Critical/Important only. Sonnet for implementers and reviewers.
- Expensive verification (`npm run validate`, full e2e) runs once now as a baseline, and once at the end of T8.

## File structure

| File                                                                    | Responsibility                                                                     |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `lib/ship-builder/model/kinds.ts`                                       | kind list, defaults, reference ship (modify)                                       |
| `lib/ship-builder/model/paint.ts`                                       | oak / dark-oak / weathered (modify)                                                |
| `lib/ship-builder/model/types.ts`                                       | ids, `PIRATE_PART_TYPES`, point types, `sailArea`, `cannons`, `sailSlots` (modify) |
| `lib/ship-builder/model/hullEnds.ts`                                    | beakhead + galleon defs (modify)                                                   |
| `lib/ship-builder/model/catalog.ts`                                     | pirate part defs, categories, labels (modify)                                      |
| `lib/ship-builder/model/attach.ts`                                      | sail, masthead and bow points (modify)                                             |
| `lib/ship-builder/model/stats.ts`                                       | sail speed, cannons, pirate checks, crew per segment (modify)                      |
| `lib/ship-builder/persist/schema.ts`                                    | v7 migration (modify)                                                              |
| `components/ship-builder/scene/hullShapes.ts`                           | beakhead + galleon sections (modify)                                               |
| `components/ship-builder/scene/pirate/shared.ts`                        | `PirateMeshProps`, wood/canvas colours (create)                                    |
| `components/ship-builder/scene/pirate/fallback.tsx`                     | crate mesh used until a group is finished (create)                                 |
| `components/ship-builder/scene/pirate/{sails,cannons,deco,crew}.tsx`    | one mesh group each (create; T3-T6 own one each)                                   |
| `components/ship-builder/scene/pirate/registry.tsx`                     | merges groups, `renderPirateFitting`, `renderPirateDecor` (create)                 |
| `components/ship-builder/ui/icons/pirate/{sails,cannons,deco,crew}.tsx` | one icon group each (create)                                                       |
| `components/ship-builder/ui/icons/pirateIcons.tsx`                      | merges icon groups (create)                                                        |
| `lib/ship-builder/templates/pirate.ts`                                  | four templates (create in T1 empty, filled in T7)                                  |

---

### Task 1: Register the pirate kind (foundation)

**Goal:** `"pirate"` is a valid kind everywhere: save format v7, hull ends, paint, every `Record<ShipKind, …>` table, kind icon, dialog card, with the repo type-checking and all tests green.

**Files:**

- Modify: `lib/ship-builder/model/kinds.ts`, `lib/ship-builder/model/paint.ts`, `lib/ship-builder/model/types.ts`, `lib/ship-builder/model/hullEnds.ts`, `lib/ship-builder/model/stats.ts` (DRIVETRAINS only), `lib/ship-builder/model/placement.ts` (`v: 7`), `lib/ship-builder/persist/schema.ts`, `lib/ship-builder/persist/local.ts` (check), `lib/ship-builder/testing.ts` (`v: 7`), `lib/ship-builder/templates/liner.ts` (two `v: 6` → `v: 7`), `lib/ship-builder/templates/index.ts`, `lib/ship-builder/sail/handling.ts`
- Modify: `components/ship-builder/scene/hullShapes.ts`, `components/ship-builder/ui/icons/HullEndIcon.tsx`, `components/ship-builder/ui/icons/ShipKindIcon.tsx`, `components/ship-builder/ui/controlsForKind.ts`, `components/ship-builder/ui/NewShipDialog.tsx` (card text only)
- Create: `lib/ship-builder/templates/pirate.ts`
- Test: `lib/ship-builder/model/__tests__/{hullEnds,catalog,stats}.test.ts`, `lib/ship-builder/persist/__tests__/schema.test.ts`, new `lib/ship-builder/model/__tests__/pirateKind.test.ts`

**Acceptance Criteria:**

- [ ] `SHIP_KINDS` is `["liner","cruise","navy","cargo","pirate"]`; `emptyShip("pirate")` is oak topsides, dark-oak bottom, `beakhead` bow, `galleon` stern, named "Untitled pirate ship".
- [ ] `CURRENT_VERSION` is 7; a v6 ship migrates to v7 unchanged; a v7 pirate ship round-trips through `parseShip`.
- [ ] `BOW_IDS` gains `beakhead`, `STERN_IDS` gains `galleon`, both with hull-end defs, section functions and icons.
- [ ] `DRIVETRAINS.pirate`, handling `AGILITY.pirate`, `controlsForKind.pirate`, `ShipKindIcon` pirate and `KIND_CARDS.pirate` exist; `TEMPLATES.pirate` is `[]`.
- [ ] Spec updated with the deviations list.
- [ ] `npm run type-check` and `npm test` pass; template fixtures regenerated (`v: 7`).

**Verify:** `npm run type-check && npm test` → all pass

**Steps:**

- [ ] **Step 1: Write the failing tests** in `lib/ship-builder/model/__tests__/pirateKind.test.ts`:

```ts
import { emptyShip } from "../placement";
import {
  isShipKind,
  KIND_DEFAULTS,
  REFERENCE_SHIPS,
  SHIP_KINDS,
} from "../kinds";
import { BOW_SHAPES, STERN_SHAPES } from "../hullEnds";
import { paintHex } from "../paint";
import { CURRENT_VERSION, migrate, parseShip } from "../../persist/schema";

describe("pirate kind", () => {
  it("is a registered kind with wooden defaults", () => {
    expect(SHIP_KINDS).toContain("pirate");
    expect(isShipKind("pirate")).toBe(true);
    const ship = emptyShip("pirate");
    expect(ship.name).toBe("Untitled pirate ship");
    expect(ship.hull).toMatchObject({
      bow: "beakhead",
      stern: "galleon",
      paint: { topsides: "oak", bottom: "dark-oak" },
    });
    expect(KIND_DEFAULTS.pirate.name).toBe("Untitled pirate ship");
  });

  it("has hull ends and wood paints", () => {
    expect(BOW_SHAPES.beakhead.length).toBeGreaterThan(2);
    expect(STERN_SHAPES.galleon.speedModifier).toBe(-0.5);
    for (const id of ["oak", "dark-oak", "weathered"] as const) {
      expect(paintHex(id)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("compares against Queen Anne's Revenge", () => {
    expect(REFERENCE_SHIPS.pirate.title).toBe("Queen Anne's Revenge (1718)");
    expect(REFERENCE_SHIPS.pirate.figures.map((f) => f.metric)).toEqual([
      "speed",
      "crew",
      "cannons",
    ]);
  });

  it("saves as v7 and reads v6 saves", () => {
    expect(CURRENT_VERSION).toBe(7);
    const ship = emptyShip("pirate");
    const parsed = parseShip(JSON.parse(JSON.stringify(ship)));
    expect(parsed.ok).toBe(true);
    const v6 = { ...emptyShip("liner"), v: 6 };
    expect(migrate(v6)).toEqual({ ...v6, v: 7 });
  });
});
```

- [ ] **Step 2: Run it to see it fail:** `npx jest pirateKind` → FAIL (`pirate` not a kind).

- [ ] **Step 3: `kinds.ts`.** Make these edits:

```ts
export const SHIP_KINDS = [
  "liner",
  "cruise",
  "navy",
  "cargo",
  "pirate",
] as const;
```

In `KIND_DEFAULTS` add:

```ts
  pirate: {
    name: "Untitled pirate ship",
    bow: "beakhead",
    stern: "galleon",
    paint: { topsides: "oak", bottom: "dark-oak" },
  },
```

`ReferenceMetric` gains `"cannons"`. In `REFERENCE_SHIPS` add:

```ts
  pirate: {
    title: "Queen Anne's Revenge (1718)",
    figures: [
      { metric: "speed", label: "Top speed", value: 11, unit: "kn" },
      { metric: "crew", label: "Crew", value: 150 },
      { metric: "cannons", label: "Cannons", value: 40 },
    ],
    // Gross tonnage means little for a ship this size.
    note: "Displaced about 300 tons",
  },
```

- [ ] **Step 4: `paint.ts`.** Append to `PAINT_COLORS`:

```ts
  { id: "oak", name: "Oak", hex: "#9a6b3f" },
  { id: "dark-oak", name: "Dark oak", hex: "#5a3a22" },
  { id: "weathered", name: "Weathered", hex: "#8b8479" },
```

Fix any test that hard-codes the colour count (`grep -rn "PAINT_COLORS" lib components --include=*.test.*`).

- [ ] **Step 5: `types.ts`.** `BOW_IDS` gains `"beakhead"`, `STERN_IDS` gains `"galleon"`, and `Ship.v` becomes `7`. Change the literal `v: 6` to `v: 7` in `placement.ts`, `testing.ts`, `templates/liner.ts` (2×), `model/__tests__/bulkheads.test.ts`, `persist/__tests__/local.test.ts` and any other type error `tsc` reports (do not touch `__fixtures__/legacy` or `e2e/ship-builder-walk.spec.ts`, which are raw old saves).

- [ ] **Step 6: `hullEnds.ts`.** Add to `BOW_SHAPES` and `STERN_SHAPES`:

```ts
  beakhead: {
    id: "beakhead",
    name: "Beakhead",
    description: "A long beak under a bowsprit, like a galleon",
    length: 3,
    speedModifier: 0,
  },
```

```ts
  galleon: {
    id: "galleon",
    name: "Galleon",
    description: "Tall and square with a window castle · a little slower",
    length: 1.4,
    speedModifier: -0.5,
  },
```

- [ ] **Step 7: `hullShapes.ts`.** Add the sections:

```ts
  // A full, raked stem with the deck reaching well ahead of the waterline.
  beakhead: (y, length) => ({
    reach: length * (0.55 + 0.45 * heightFraction(y) ** 1.2),
    exponent: 1.2,
  }),
```

```ts
  // A tall flat stern that overhangs: the castle leans out above the water.
  galleon: (y, length) => ({
    reach: length * (0.6 + 0.4 * heightFraction(y)),
    exponent: 5,
  }),
```

In `HullEndIcon.tsx` add drawings to `BOW_DRAWINGS` (`beakhead`: `<path d="M3 12 H46 Q40 26 30 38 H3 Z" fill={PALETTE.hull} />` plus a short bowsprit `<line x1={44} y1={13} x2={47} y2={9} stroke={PALETTE.hull} strokeWidth={2} />`) and the stern drawing record (copy the transom/counter drawings' structure from the file; the galleon is a tall square back with a lip: `<path d="M45 12 H8 L4 6 H2 V38 H45 Z" fill={PALETTE.hull} />`). Keep stems pointing the way the neighbouring drawings do.

- [ ] **Step 8: Schema.** In `schema.ts` set `CURRENT_VERSION = 7` and add:

```ts
/**
 * v6 to v7 adds the pirate kind, its hull ends, parts and paint colours and
 * changes no data. The bump makes older builds back up v7 saves instead of
 * rejecting them as invalid.
 */
const addPirates: Migration = (raw) => ({ ...raw, v: 7 });
```

and `6: addPirates,` in `MIGRATIONS`. Update `schema.test.ts` expectations that name `v: 6` as the current version (`migrated ... v: 6` → `v: 7`; the `5: (raw) => ({ ...raw, v: 6 })` custom-migration test stays). Check `persist/local.ts` for any key or backup logic tied to the version number and keep behaviour identical (older-version backup naming must still work for v6 → v7).

- [ ] **Step 9: Kind-keyed tables.**
  - `stats.ts`: add `crewPerSegment: number` to `Drivetrain`; give every existing entry `crewPerSegment: CREW_PER_SEGMENT`; add `pirate: { powerPerProp: 0, lossPer10kTons: 0.6, crewPerSegment: 5 }`; in `computeStats` use `DRIVETRAINS[ship.kind].crewPerSegment` in place of `CREW_PER_SEGMENT`.
  - `sail/handling.ts`: `AGILITY.pirate = 1.05`.
  - `controlsForKind.ts`: add

```ts
  pirate: {
    label: "Pirate helm",
    wheelStyle: {
      variant: "spoked",
      sizeClass: "h-28 w-28 sm:h-36 sm:w-36",
      rimClass: "stroke-amber-900 dark:stroke-amber-500",
      spokeClass: "stroke-amber-800 dark:stroke-amber-400",
      hubClass: "fill-amber-700 dark:fill-amber-300",
      backingClass: "bg-amber-100/70 dark:bg-stone-900/70",
    },
    leverStyle: {
      trackClass: "bg-amber-950/70 dark:bg-stone-950/80",
      knobShapeClass: "h-9 w-12 rounded-md",
      knobClass:
        "bg-amber-700 border-amber-900 dark:bg-amber-400 dark:border-amber-200",
    },
    cockpit: {
      consoleClass:
        "border-t-4 border-amber-800 bg-gradient-to-t from-stone-950/90 to-amber-950/80 dark:border-amber-600 dark:from-stone-950/95 dark:to-stone-900/85",
      readoutClass:
        "border-amber-700 bg-amber-100 text-amber-950 dark:border-amber-500 dark:bg-stone-950 dark:text-amber-200",
      gaugeClass: "stroke-amber-700 dark:stroke-amber-400",
      needleClass: "stroke-red-800 dark:stroke-red-400",
      instrumentName: "Sail trim",
      captionClass: "text-amber-100 dark:text-amber-200",
      wheelSizeClass: "h-32 w-32 sm:h-44 sm:w-44",
    },
  },
```

- `ShipKindIcon.tsx`: add a `pirate` drawing, three masts with cream sails, a black flag and a brown hull:

```tsx
  // Three masts of cream sails over a brown wooden hull, a black flag on top.
  pirate: () => (
    <g>
      {[28, 50, 72].map((x, i) => (
        <g key={x}>
          <line x1={x} y1={4 + i * 2} x2={x} y2={40} strokeWidth={1.6} />
          <path
            d={`M${x - 10} ${10 + i * 2} Q${x} ${14 + i * 2} ${x + 10} ${10 + i * 2} V${27} Q${x} ${31} ${x - 10} ${27} Z`}
            fill="#efe6cf"
          />
        </g>
      ))}
      <path d="M72 4 H84 V9 H72 Z" fill="#1c1c1f" />
      <path d="M6 38 H94 L88 52 H16 Q8 48 6 38 Z" fill="#8a5a31" />
      <path d="M16 52 H88 L89 48 H10 Z" fill="#4a2f18" stroke="none" />
      {WATER_STRIP}
    </g>
  ),
```

- `NewShipDialog.tsx`: add to `KIND_CARDS`: `pirate: { name: "Pirate ship", blurb: "Masts, sails and cannons, with a Jolly Roger." }`.
- `templates/pirate.ts`: `import type { ShipTemplate } from "./types"; export const PIRATE_TEMPLATES: readonly ShipTemplate[] = [];` (filled in Task 7). `templates/index.ts`: import it and add `pirate: PIRATE_TEMPLATES` to `TEMPLATES`.
- `StatsPanel.tsx` `yourValue`: add `case "cannons": return stats.cannons;` ONLY after Task 2 adds `Stats.cannons`; in this task add `case "cannons": return 0;` and let Task 2 replace it.

- [ ] **Step 10: Run** `npm run type-check` and fix every remaining exhaustiveness error (the compiler lists all missing `Record<ShipKind, …>` entries). Then `npm test`, regenerate template fixtures with `UPDATE_FIXTURES=1 npx jest fixtures`, and re-run `npm test` until green. Inspect `git diff --stat lib/ship-builder/persist/__fixtures__` — only `v` should change in templates.

- [ ] **Step 11: Spec sync.** Append the "Deviations" list above to the end of the spec under `## Amendments (from the plan)`, and fix the spec sentences they contradict (cannon capacity warning, forward-half bridge rule, walk behaviour, rowboat seats).

- [ ] **Step 12: Commit** (run `npx prettier --write` on changed files first; lefthook checks format):

```bash
git add -A
git commit -m "feat(ship-builder): register the pirate kind, save v7 and hull ends"
```

---

### Task 2: Pirate rules and part registry

**Goal:** Every pirate part exists in the model (catalog, points, rules, stats) and renders as a placeholder crate with a generic icon, so the group tasks can fill in meshes in parallel without touching shared files.

**Files:**

- Modify: `lib/ship-builder/model/types.ts`, `catalog.ts`, `attach.ts`, `stats.ts`, `placement.ts`, `lib/ship-builder/walk/walkGrid.ts`
- Modify: `components/ship-builder/scene/PartMesh.tsx`, `components/ship-builder/scene/deckDecor.tsx`, `components/ship-builder/ui/icons/PartIcon.tsx`, `components/ship-builder/ui/icons/warningIcons.ts`, `components/ship-builder/ui/StatsPanel.tsx`
- Create: `components/ship-builder/scene/pirate/{shared.ts,fallback.tsx,sails.tsx,cannons.tsx,deco.tsx,crew.tsx,registry.tsx}`, `components/ship-builder/ui/icons/pirate/{sails.tsx,cannons.tsx,deco.tsx,crew.tsx}`, `components/ship-builder/ui/icons/pirateIcons.tsx`
- Test: `lib/ship-builder/model/__tests__/pirateParts.test.ts`, `lib/ship-builder/model/__tests__/pirateStats.test.ts`, existing catalog/attach/stats/walk tests

**Acceptance Criteria:**

- [ ] `PIRATE_PART_TYPES` (23 ids) is spread into `PART_TYPES`; each has a catalog def listed for `pirate` only, in the right categories (`sails`, `weapons` are new).
- [ ] Wooden masts expose `sail:0..n-1` (`sail-mount`) and `masthead` (`masthead-mount`); the hull exposes `figurehead`, `jib`, `bowgun` (`bow-mount`).
- [ ] Top speed for a pirate ship comes from sail area; no sails → 0 kn and a failing `no-sails` check; a rudder is required once there is a sail; the helm counts as the bridge.
- [ ] `Stats` has `cannons` and `sailArea`; StatsPanel shows Cannons and Sail area rows when non-zero.
- [ ] `bridge*`, `mast`, `propeller` are hidden for pirate ships; the helm may go in either half.
- [ ] Every new part type renders (crate) and has an icon; type-check and tests pass.

**Verify:** `npm run type-check && npm test` → all pass

**Steps:**

- [ ] **Step 1: Types.** In `types.ts` add before `PART_TYPES`:

```ts
/** Parts only pirate ships list; each task that draws them owns one group. */
export const PIRATE_PART_TYPES = [
  // sails.tsx
  "mast-wood-short",
  "mast-wood-tall",
  "mast-wood-main",
  "sail-square-small",
  "sail-square",
  "sail-square-large",
  "sail-jib",
  "sail-lateen",
  "flag-jolly-roger",
  // cannons.tsx
  "cannon-deck",
  "cannon-chaser",
  "cannon-swivel",
  // deco.tsx
  "cabin-captain",
  "helm-wheel",
  "figurehead",
  "ship-anchor",
  "barrel-stack",
  "crate-stack",
  "treasure-chest",
  "rowboat",
  // crew.tsx
  "plank",
  "pirate-crew",
  "parrot",
] as const;
```

End `PART_TYPES` with `...PIRATE_PART_TYPES,` (keep `as const`). Add `"sails" | "weapons"` to `PartCategory`; `"sail-mount" | "masthead-mount" | "bow-mount"` to `AttachPointType`; `sailArea?: number` and `cannons?: number` to `PartDefBase`; `sailSlots?: number` to `AttachPartDef` (doc: "Sail spots a wooden mast offers, lowest first").

- [ ] **Step 2: Failing tests.** `pirateParts.test.ts`:

```ts
import { CATALOG, CATEGORIES, getPartDef, visibleParts } from "../catalog";
import { attachPointsOf } from "../attach";
import { canPlace, emptyShip } from "../placement";
import { PIRATE_PART_TYPES, HULL_ID, type PartType } from "../types";
import { attachPart, gridPart } from "../../testing";

const pirate = () => emptyShip("pirate", "P", 8, 4);

describe("pirate catalog", () => {
  it("lists every pirate part for pirate ships only", () => {
    for (const type of PIRATE_PART_TYPES) {
      expect(CATALOG[type].kinds).toEqual(["pirate"]);
    }
    const listed = visibleParts("pirate", false).map((d) => d.type);
    for (const type of PIRATE_PART_TYPES) expect(listed).toContain(type);
    for (const gone of [
      "mast",
      "propeller",
      "bridge",
      "bridge-5",
    ] as PartType[]) {
      expect(listed).not.toContain(gone);
    }
    expect(visibleParts("liner", false).map((d) => d.type)).not.toContain(
      "sail-square"
    );
  });

  it("has sail and cannon categories with parts", () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["sails", "weapons"]));
  });

  it("gives masts slots and sails an area", () => {
    expect(getPartDef("mast-wood-short")).toMatchObject({ sailSlots: 1 });
    expect(getPartDef("mast-wood-tall")).toMatchObject({ sailSlots: 2 });
    expect(getPartDef("mast-wood-main")).toMatchObject({ sailSlots: 3 });
    expect(getPartDef("sail-square").sailArea).toBe(3);
    expect(getPartDef("cannon-deck").cannons).toBe(1);
  });
});

describe("pirate attach points", () => {
  it("exposes bow spots on the hull", () => {
    const ids = attachPointsOf(pirate(), HULL_ID)
      .filter((p) => p.type === "bow-mount")
      .map((p) => p.id);
    expect(ids.sort()).toEqual(["bowgun", "figurehead", "jib"]);
  });

  it("exposes one sail spot per slot plus a masthead", () => {
    const ship = {
      ...pirate(),
      parts: [attachPart("m", "mast-wood-tall", HULL_ID, "mast-fore")],
    };
    const ids = attachPointsOf(ship, "m").map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(["sail:0", "sail:1", "masthead"])
    );
    expect(ids).not.toContain("sail:2");
  });

  it("lets a sail go on a free spot only", () => {
    const base = {
      ...pirate(),
      parts: [attachPart("m", "mast-wood-short", HULL_ID, "mast-fore")],
    };
    const sail = attachPart("s", "sail-square", "m", "sail:0");
    expect(canPlace(base, sail).ok).toBe(true);
    const full = { ...base, parts: [...base.parts, sail] };
    expect(
      canPlace(full, attachPart("s2", "sail-square-small", "m", "sail:0")).ok
    ).toBe(false);
    expect(
      canPlace(base, attachPart("s3", "sail-square", "m", "sail:1")).ok
    ).toBe(false);
  });

  it("keeps the jib on the jib spot and the lateen on the lowest spot", () => {
    const ship = pirate();
    expect(canPlace(ship, attachPart("j", "sail-jib", HULL_ID, "jib")).ok).toBe(
      true
    );
    expect(
      canPlace(ship, attachPart("j", "sail-jib", HULL_ID, "bowgun")).ok
    ).toBe(false);
  });

  it("lets the helm go in the aft half", () => {
    const ship = {
      ...pirate(),
      parts: [
        gridPart("d1", "deck-1x1", 0, 20, 0),
        gridPart("d2", "deck-1x1", 0, 20, 1),
      ],
    };
    expect(canPlace(ship, gridPart("h", "helm-wheel", 1, 20, 0)).ok).toBe(true);
  });
});
```

Run `npx jest pirateParts` → FAIL.

- [ ] **Step 3: Catalog.** In `catalog.ts`:
  - Add categories `{ id: "sails", name: "Sails" }` (after `masts`) and `{ id: "weapons", name: "Cannons" }` (after `naval`) to `CATEGORIES`.
  - Add the two label records' entries: `ATTACH_NEEDS_LABELS`: `"sail-mount": "Needs a wooden mast"`, `"masthead-mount": "Needs a wooden mast"`, `"bow-mount": "No free bow spot"`; `ATTACH_POINT_LABELS`: `"sail-mount": "free sail spot on a wooden mast"`, `"masthead-mount": "top of a wooden mast"`, `"bow-mount": "spot on the bow"`.
  - Add constants and helpers above `CATALOG`:

```ts
const PIRATE: ShipKind[] = ["pirate"];
/** Parts that make no sense on a wooden sailing ship. */
const NOT_PIRATE: ShipKind[] = ["liner", "cruise", "navy", "cargo"];

function woodMastDef(
  type: PartType,
  name: string,
  height: number,
  sailSlots: number,
  mass: number
): PartDef {
  return {
    type,
    kinds: PIRATE,
    category: "masts",
    name,
    description: `Wooden mast · ${sailSlots} sail spot${sailSlots === 1 ? "" : "s"} · bow, stern or on a deck block`,
    placement: "attach",
    attachTo: "mast-mount",
    mass,
    height,
    emptyHint: "Every mast spot is taken",
    exposes: "mast",
    hasCrowsNest: true,
    sailSlots,
  };
}

function sailDef(
  type: PartType,
  name: string,
  sailArea: number,
  height: number,
  extra: Partial<AttachPartDef> = {}
): PartDef {
  return {
    type,
    kinds: PIRATE,
    category: "sails",
    name,
    description: `Sail area ${sailArea} · more sail, more speed`,
    placement: "attach",
    attachTo: "sail-mount",
    mass: 0.05 * sailArea,
    height,
    sailArea,
    emptyHint: "Build a wooden mast with a free sail spot first",
    ...extra,
  };
}
```

(import `AttachPartDef` from `./types`.)

- Add `kinds: NOT_PIRATE` to `bridgeDef`'s returned object, and to the `mast` and `propeller` defs.
- Add entries to `CATALOG` (grouped in the order of `PIRATE_PART_TYPES`):

```ts
  "mast-wood-short": woodMastDef("mast-wood-short", "Short mast", 5, 1, 0.4),
  "mast-wood-tall": woodMastDef("mast-wood-tall", "Tall mast", 7, 2, 0.5),
  "mast-wood-main": woodMastDef("mast-wood-main", "Main mast", 9, 3, 0.6),
  "sail-square-small": sailDef("sail-square-small", "Small square sail", 2, 1.2),
  "sail-square": sailDef("sail-square", "Square sail", 3, 1.6),
  "sail-square-large": sailDef("sail-square-large", "Large square sail", 4, 2),
  "sail-jib": sailDef("sail-jib", "Jib", 2, 1.4, {
    attachTo: "bow-mount",
    allowedPointIds: ["jib"],
    emptyHint: "The jib spot at the bow is taken",
  }),
  "sail-lateen": sailDef("sail-lateen", "Lateen sail", 3, 1.6, {
    allowedPointIds: ["sail:0"],
    description: "Sail area 3 · triangular · on the lowest spot of a mast",
  }),
  "flag-jolly-roger": {
    type: "flag-jolly-roger",
    kinds: PIRATE,
    category: "decor",
    name: "Jolly Roger",
    description: "The pirate flag · flies from the top of a wooden mast",
    placement: "attach",
    attachTo: "masthead-mount",
    mass: 0.02,
    height: 0.8,
    emptyHint: "Build a wooden mast first",
  },
  "cannon-deck": {
    type: "cannon-deck",
    kinds: PIRATE,
    category: "weapons",
    name: "Deck cannon",
    description: "Counts toward your cannons · sits on a deck edge · tap to fire",
    placement: "attach",
    attachTo: "edge-mount",
    mass: 0.25,
    height: 0.4,
    cannons: 1,
    emptyHint: "Build a block on an outer edge of the ship",
    holdsEdge: true,
  },
  "cannon-chaser": {
    type: "cannon-chaser",
    kinds: PIRATE,
    category: "weapons",
    name: "Bow chaser",
    description: "A long gun in the bow · counts toward your cannons",
    placement: "attach",
    attachTo: "bow-mount",
    allowedPointIds: ["bowgun"],
    mass: 0.3,
    height: 0.4,
    cannons: 1,
    emptyHint: "The bow gun spot is taken",
  },
  "cannon-swivel": {
    type: "cannon-swivel",
    kinds: PIRATE,
    category: "weapons",
    name: "Swivel gun",
    description: "A small rail gun · just for show · tap to fire",
    placement: "attach",
    attachTo: "edge-mount",
    mass: 0.08,
    height: 0.4,
    emptyHint: "Build a block on an outer edge of the ship",
    holdsEdge: true,
  },
  "cabin-captain": {
    type: "cabin-captain",
    kinds: PIRATE,
    category: "cabins",
    name: "Captain's cabin",
    description: "20 crew berths · stern windows",
    placement: "grid",
    role: "cabin",
    footprint: { x: 1, z: 1 },
    mass: 1,
    height: 1,
    crewBerths: 20,
  },
  "helm-wheel": {
    type: "helm-wheel",
    kinds: PIRATE,
    category: "command",
    name: "Ship's wheel",
    description: "The helm on a quarterdeck · top of its stack · anywhere on deck",
    placement: "grid",
    role: "bridge",
    footprint: { x: 1, z: 2 },
    mass: 0.6,
    height: 1,
  },
  figurehead: {
    type: "figurehead",
    kinds: PIRATE,
    category: "decor",
    name: "Figurehead",
    description: "A carved mermaid at the very front",
    placement: "attach",
    attachTo: "bow-mount",
    allowedPointIds: ["figurehead"],
    mass: 0.1,
    height: 0.8,
    emptyHint: "The figurehead spot is taken",
  },
  "ship-anchor": { ...decorDef("ship-anchor", "Anchor", "A heavy iron anchor", 0.5), kinds: PIRATE },
  "barrel-stack": { ...decorDef("barrel-stack", "Barrels", "Rum, we hope", 0.6), kinds: PIRATE },
  "crate-stack": { ...decorDef("crate-stack", "Crates", "Stacked supplies", 0.6), kinds: PIRATE },
  "treasure-chest": { ...decorDef("treasure-chest", "Treasure chest", "Gold, jewels and a lock", 0.35), kinds: PIRATE },
  rowboat: {
    type: "rowboat",
    kinds: PIRATE,
    category: "lifeboats",
    name: "Rowboat",
    description: "12 seats · hangs from a davit",
    placement: "attach",
    attachTo: "boat-mount",
    mass: 0.2,
    height: 0.4,
    seats: 12,
    emptyHint: "Every davit has a boat — add another davit",
  },
  plank: {
    type: "plank",
    kinds: PIRATE,
    category: "decor",
    name: "Plank",
    description: "Walk it, if you dare · sits on a deck edge",
    placement: "attach",
    attachTo: "edge-mount",
    mass: 0.1,
    height: 0.1,
    emptyHint: "Build a block on an outer edge of the ship",
    holdsEdge: true,
  },
  "pirate-crew": { ...decorDef("pirate-crew", "Pirate", "A crewmate with a sword", 1), kinds: PIRATE },
  parrot: { ...decorDef("parrot", "Parrot", "Squawks quietly", 0.4), kinds: PIRATE },
```

Run `npx jest catalog` and fix the pre-existing catalog assertions that this legitimately changes (the hidden-for-pirate lists).

- [ ] **Step 4: Attach points.** In `attach.ts` add constants near the others:

```ts
/** Sails hang at these fractions of a wooden mast's height, lowest first. */
const SAIL_BASE_FRACTION = 0.3;
const SAIL_STEP_FRACTION = 0.22;
```

In `hullPoints` append to the returned array:

```ts
    {
      id: "figurehead",
      type: "bow-mount",
      position: { x: -bowLength(ship.hull.bow) * 0.9, y: 0.4, z: centerline },
    },
    {
      id: "jib",
      type: "bow-mount",
      position: { x: -bowLength(ship.hull.bow) * 0.75, y: 0.9, z: centerline },
    },
    {
      id: "bowgun",
      type: "bow-mount",
      position: { x: -bowLength(ship.hull.bow) * 0.35, y: 0.3, z: centerline },
    },
```

In `mastPoints`, after the `light` point is created and before the crow's-nest block, add:

```ts
const mastDef = getPartDef(part.type);
const slots = mastDef.placement === "attach" ? (mastDef.sailSlots ?? 0) : 0;
for (let i = 0; i < slots; i++) {
  points.push({
    id: `sail:${i}`,
    type: "sail-mount",
    position: at(height * (SAIL_BASE_FRACTION + SAIL_STEP_FRACTION * i)),
  });
}
if (slots > 0) {
  points.push({ id: "masthead", type: "masthead-mount", position: at(height) });
}
```

Run `npx jest attach pirateParts fixtures`; existing hull-point snapshots/lists may need the three new ids added (that is expected, not a regression). Do NOT rename existing ids.

- [ ] **Step 5: Stats.** In `stats.ts`:
  - `WarningCode` gains `"no-sails"`; `Stats` gains `cannons: number; sailArea: number;`.
  - Add:

```ts
/** Pirate speed: steady wind, so only sail area, length and weight matter. */
export const SAIL_SPEED = {
  base: 3,
  perArea: 0.4,
  perSegment: 0.2,
  min: 3,
  max: 14,
};

export function computeSailSpeed(
  sailArea: number,
  segments: number,
  grossTonnage: number,
  hullModifier = 0,
  drivetrain: Drivetrain = DRIVETRAINS.pirate
): number {
  if (sailArea === 0) return 0;
  const raw =
    SAIL_SPEED.base +
    sailArea * SAIL_SPEED.perArea +
    segments * SAIL_SPEED.perSegment -
    (grossTonnage / 10000) * drivetrain.lossPer10kTons +
    hullModifier;
  const clamped = Math.min(SAIL_SPEED.max, Math.max(SAIL_SPEED.min, raw));
  return Math.round(clamped * 10) / 10;
}
```

- In `computeStats`: add `let cannons = 0; let sails = 0; let sailArea = 0;`; in the part loop `if (def.cannons) cannons += def.cannons; if (def.sailArea) { sails += 1; sailArea += def.sailArea; }`; compute `const isPirate = ship.kind === "pirate";` and

```ts
const hullModifier = hullSpeedModifier(ship.hull.bow, ship.hull.stern);
const topSpeedKnots = isPirate
  ? computeSailSpeed(
      sailArea,
      ship.hull.lengthSegments,
      grossTonnage,
      hullModifier
    )
  : computeSpeed(
      power,
      propellers,
      ship.hull.lengthSegments,
      grossTonnage,
      hullModifier,
      DRIVETRAINS[ship.kind]
    );
```

- Replace the checks block's first four `addCheck` calls with:

```ts
addCheck(
  "no-bridge",
  isPirate ? "Helm to steer from" : "Bridge to steer from",
  bridges === 0
    ? isPirate
      ? "No helm — someone has to steer"
      : "No bridge — someone has to steer"
    : null
);
if (isPirate) {
  addCheck(
    "no-sails",
    "Sails for speed",
    sails === 0 ? "No sails — she isn't going anywhere" : null
  );
  if (sails > 0) {
    addCheck(
      "no-rudder",
      "Rudder to steer",
      rudders === 0 ? "No rudder — she can't steer" : null
    );
  }
} else {
  // existing funnel / propeller / needs-propellers / rudder checks, unchanged
}
```

Move the existing non-pirate checks into the `else` verbatim (including their conditions). Return `cannons` and `sailArea` in the result.

- `warningIcons.ts`: import `Wind` from lucide-react and add `"no-sails": Wind`.

- [ ] **Step 6: Stats tests** in `pirateStats.test.ts`:

```ts
import { computeSailSpeed, computeStats } from "../stats";
import { emptyShip } from "../placement";
import { HULL_ID } from "../types";
import { attachPart, gridPart } from "../../testing";

function sloop() {
  const ship = emptyShip("pirate", "S", 6, 3);
  return {
    ...ship,
    parts: [
      gridPart("d0", "deck-1x1", 0, 8, 1),
      gridPart("helm", "helm-wheel", 1, 8, 0),
      attachPart("m", "mast-wood-tall", "d0", "mast"),
      attachPart("s0", "sail-square-large", "m", "sail:0"),
      attachPart("s1", "sail-square", "m", "sail:1"),
      attachPart("jib", "sail-jib", HULL_ID, "jib"),
      attachPart("r", "rudder", HULL_ID, "rudder"),
      attachPart("c", "cannon-chaser", HULL_ID, "bowgun"),
    ],
  };
}

describe("pirate stats", () => {
  it("has no speed and a failing sails check without sails", () => {
    const stats = computeStats(emptyShip("pirate"));
    expect(stats.topSpeedKnots).toBe(0);
    expect(stats.checks.find((c) => c.code === "no-sails")?.ok).toBe(false);
    expect(stats.checks.map((c) => c.code)).not.toContain("no-funnels");
  });

  it("moves on sail area alone and counts cannons", () => {
    const stats = computeStats(sloop());
    expect(stats.sailArea).toBe(9);
    expect(stats.cannons).toBe(1);
    expect(stats.topSpeedKnots).toBeGreaterThan(5);
    expect(stats.checks.find((c) => c.code === "no-sails")?.ok).toBe(true);
    expect(stats.checks.find((c) => c.code === "no-bridge")?.ok).toBe(true);
  });

  it("asks for a rudder once there is a sail", () => {
    const noRudder = sloop();
    noRudder.parts = noRudder.parts.filter((p) => p.id !== "r");
    expect(computeStats(noRudder).warnings.map((w) => w.code)).toContain(
      "no-rudder"
    );
  });

  it("is faster with more sail and clamps", () => {
    expect(computeSailSpeed(4, 6, 10000)).toBeLessThan(
      computeSailSpeed(20, 6, 10000)
    );
    expect(computeSailSpeed(200, 20, 0)).toBe(14);
    expect(computeSailSpeed(0, 6, 0)).toBe(0);
  });

  it("scales crew with the hull, 5 a segment", () => {
    expect(computeStats(emptyShip("pirate", "x", 10, 4)).crew).toBe(50);
  });
});
```

- [ ] **Step 7: Placement rule.** In `placement.ts` change `isBridgeSpotAllowed` to:

```ts
/** Cargo and pirate ships may keep the bridge or helm aft; the rest, forward. */
function isBridgeSpotAllowed(ship: Ship, x: number): boolean {
  return (
    ship.kind === "cargo" || ship.kind === "pirate" || isForwardHalf(ship, x)
  );
}
```

- [ ] **Step 8: Walk mode.** In `walkGrid.ts` add to `NON_BLOCKING_ATTACH` (sails and flags hang overhead, the figurehead is beyond the rail, boats and the plank are over the side): `"sail-square-small"`, `"sail-square"`, `"sail-square-large"`, `"sail-jib"`, `"sail-lateen"`, `"flag-jolly-roger"`, `"figurehead"`, `"rowboat"`, `"plank"`. Wooden masts and cannons block, as masts and rafts do. Add a test to the walk-grid test file: a pirate ship with a mast on a deck block has a blocker at the mast, and none for the sail.

- [ ] **Step 9: Mesh registry (placeholder crates).** Create `components/ship-builder/scene/pirate/shared.ts`:

```ts
import type { ReactNode } from "react";
import type { Side } from "@/lib/ship-builder/model/types";
import type { PartEmphasis, PartTint } from "../Surface";

/** What every pirate fitting mesh receives; origin is the part's attach point. */
export interface PirateMeshProps {
  /** Paint colour for the part's main surface; absent means the default. */
  painted?: string;
  tint: PartTint;
  emphasis: PartEmphasis;
  /** Side of the ship the point is on, for edge parts. */
  side?: Side;
}

export type PirateMesh = (props: PirateMeshProps) => ReactNode;

/** Grid decor gets a colour override and the rotation the player chose. */
export interface PirateDecorProps {
  color?: string;
  rotation: import("@/lib/ship-builder/model/types").Rotation;
  tint: PartTint;
  emphasis: PartEmphasis;
}

export type PirateDecor = (props: PirateDecorProps) => ReactNode;

/** Wood, rope, cloth and iron shared across the pirate meshes. */
export const WOOD = {
  oak: "#9a6b3f",
  dark: "#5a3a22",
  pale: "#c9a56b",
  rope: "#cdb98a",
  canvas: "#efe6cf",
  iron: "#33383d",
  black: "#1c1c1f",
  bone: "#f1ede0",
} as const;
```

Create `pirate/fallback.tsx`:

```tsx
"use client";

import Surface from "../Surface";
import { WOOD, type PirateMeshProps, type PirateDecorProps } from "./shared";

/** A small wooden crate: stands in until a group draws its own mesh. */
export function CrateMesh({ painted, tint, emphasis }: PirateMeshProps) {
  return (
    <mesh position={[0, 0.2, 0]} castShadow>
      <boxGeometry args={[0.4, 0.4, 0.4]} />
      <Surface
        color={painted ?? WOOD.oak}
        finish="wood"
        tint={tint}
        emphasis={emphasis}
      />
    </mesh>
  );
}

export function CrateDecor({ color, tint, emphasis }: PirateDecorProps) {
  return <CrateMesh painted={color} tint={tint} emphasis={emphasis} />;
}
```

Create the four group files, each exactly one `satisfies`-typed record using the crate for every id it owns. Example `pirate/sails.tsx`:

```tsx
import { CrateMesh } from "./fallback";
import type { PirateMesh } from "./shared";

/** Task 3 replaces these crates with masts, sails and the flag. */
export const SAIL_MESHES = {
  "mast-wood-short": CrateMesh,
  "mast-wood-tall": CrateMesh,
  "mast-wood-main": CrateMesh,
  "sail-square-small": CrateMesh,
  "sail-square": CrateMesh,
  "sail-square-large": CrateMesh,
  "sail-jib": CrateMesh,
  "sail-lateen": CrateMesh,
  "flag-jolly-roger": CrateMesh,
} satisfies Record<string, PirateMesh>;
```

`cannons.tsx` exports `CANNON_MESHES` (`cannon-deck`, `cannon-chaser`, `cannon-swivel`); `deco.tsx` exports `DECO_MESHES` (`figurehead`, `rowboat`) and `DECO_DECOR` (`ship-anchor`, `barrel-stack`, `crate-stack`, `treasure-chest`, typed `PirateDecor` using `CrateDecor`) plus `export const HelmWheelMesh` and `CaptainCabinTrim` as `null`-returning stubs (see Step 10); `crew.tsx` exports `CREW_MESHES` (`plank`) and `CREW_DECOR` (`pirate-crew`, `parrot`). Create `pirate/registry.tsx`:

```tsx
import type { ReactNode } from "react";
import { CANNON_MESHES } from "./cannons";
import { CREW_DECOR, CREW_MESHES } from "./crew";
import { DECO_DECOR, DECO_MESHES } from "./deco";
import { SAIL_MESHES } from "./sails";
import type { PirateDecorProps, PirateMesh, PirateMeshProps } from "./shared";

export const PIRATE_FITTINGS = {
  ...SAIL_MESHES,
  ...CANNON_MESHES,
  ...DECO_MESHES,
  ...CREW_MESHES,
} satisfies Record<string, PirateMesh>;
export type PirateFittingType = keyof typeof PIRATE_FITTINGS;

export const PIRATE_DECOR = {
  ...DECO_DECOR,
  ...CREW_DECOR,
} satisfies Record<string, (props: PirateDecorProps) => ReactNode>;
export type PirateDecorType = keyof typeof PIRATE_DECOR;

export function isPirateFitting(type: string): type is PirateFittingType {
  return type in PIRATE_FITTINGS;
}

export function isPirateDecor(type: string): type is PirateDecorType {
  return type in PIRATE_DECOR;
}

export function renderPirateFitting(
  type: PirateFittingType,
  props: PirateMeshProps
): ReactNode {
  const Mesh = PIRATE_FITTINGS[type];
  return <Mesh {...props} />;
}

export function renderPirateDecor(
  type: PirateDecorType,
  props: PirateDecorProps
): ReactNode {
  const Decor = PIRATE_DECOR[type];
  return <Decor {...props} />;
}
```

- [ ] **Step 10: Wire the registry in.**
  - `PartMesh.tsx`, `Fitting`: in the existing "grid parts" `case` list that returns `null` add `"cabin-captain"`, `"helm-wheel"`, `"ship-anchor"`, `"barrel-stack"`, `"crate-stack"`, `"treasure-chest"`, `"pirate-crew"`, `"parrot"`. Replace the `default:` branch with:

```tsx
    default:
      return isPirateFitting(type)
        ? renderPirateFitting(type, { painted, tint, emphasis, side })
        : assertNever(type);
```

(`assertNever` will compile only if every remaining type is a pirate fitting; if TS cannot narrow through the type guard, change `assertNever(type: never)` call to `assertNever(type as never)`.)

- `PartMesh.tsx`, grid branch: give `cabin-captain` and `helm-wheel` an oak default via the `color` prop already passed to `Block`: `color={color ?? (part.type === "cabin-captain" || part.type === "helm-wheel" ? "oak" : undefined)}`. After the `<Block … />` for `helm-wheel`, render `<HelmWheelMesh tint={tint} emphasis={emphasis} />` positioned on the roof (`<group position={[0, BRIDGE_HEIGHT, 0]}>`), importing `HelmWheelMesh` from `./pirate/deco`; for `cabin-captain` render `<CaptainCabinTrim size={size} tint={tint} emphasis={emphasis} />` (stern windows). Both export from `deco.tsx` as `() => null` in this task (Task 5 draws them).
- `deckDecor.tsx`: in `DeckDecorMesh`'s `default:` return `isPirateDecor(type) ? renderPirateDecor(type, { color: props.color, rotation: props.rotation, tint: props.tint, emphasis: props.emphasis }) : null` (read the component's props type to pass the right fields).
- `PartIcon.tsx`: `DRAWINGS` spreads `...PIRATE_ICONS` (import from `./pirateIcons`). Create the four icon group files exporting `SAIL_ICONS`, `CANNON_ICONS`, `DECO_ICONS`, `CREW_ICONS` as `Record<…, () => ReactNode>` literals using one shared `CrateIcon` (a 48×48 oak box drawn with the same `Box` helper style as other icons, or a plain `<rect x={14} y={18} width={20} height={20} fill="#9a6b3f" />`). `pirateIcons.tsx` merges them into `PIRATE_ICONS` typed `Record<(typeof PIRATE_PART_TYPES)[number], () => ReactNode>` so a missing id is a compile error.

- [ ] **Step 11: Stats panel.** In `StatsPanel.tsx` replace `case "cannons": return 0;` with `return stats.cannons;`, and add after the Cargo row (import `Crosshair`, `Wind` from lucide-react):

```tsx
{
  stats.sailArea > 0 && (
    <StatRow
      Icon={Wind}
      label="Sail area"
      testId="stat-sail-area"
      value={fmt(stats.sailArea)}
    />
  );
}
{
  stats.cannons > 0 && (
    <StatRow
      Icon={Crosshair}
      label="Cannons"
      testId="stat-cannons"
      value={fmt(stats.cannons)}
    />
  );
}
```

Add a test to `StatsPanel.test.tsx`: a pirate ship with a sail and a cannon shows both rows and the Queen Anne's Revenge reference title.

- [ ] **Step 12: Verify.** `npx prettier --write` the changed files, then `npm run type-check && npm test`. All existing tests must pass; update only assertions this change legitimately alters (hull-point lists, part counts, visible-part lists). Regenerate fixtures only if `fixtures.test.ts` says template saves changed (they should not).

- [ ] **Step 13: Commit.**

```bash
git add -A
git commit -m "feat(ship-builder): pirate rules, sail speed and part registry"
```

---

### Task 3: Sails and masts meshes (parallel)

**Goal:** Wooden masts, six sails and the Jolly Roger are drawn and have real icons.

**Files:**

- Modify: `components/ship-builder/scene/pirate/sails.tsx` (replace its crates), `components/ship-builder/ui/icons/pirate/sails.tsx`
- Test: `components/ship-builder/scene/__tests__/pirateSails.test.tsx` (render each type without crashing), `components/ship-builder/ui/__tests__/pirateIcons.test.tsx` shared with other groups (create if absent, otherwise extend)

**Acceptance Criteria:**

- [ ] Each of the 9 ids in `SAIL_MESHES` has its own mesh; each id in `SAIL_ICONS` has a distinct icon.
- [ ] Sails billow (static belly plus a gentle wobble); still under `reducedMotion` and for ghost previews.
- [ ] Sail cloth takes `painted` (black sails possible), default `WOOD.canvas`; masts default `WOOD.oak`.
- [ ] No file outside the two files above (and tests) is edited.

**Verify:** `npx jest pirateSails pirateIcons && npm run type-check` → pass

**Steps:**

- [ ] **Step 1: Test first.** Mirror the existing mesh render tests (look at `components/ship-builder/scene/__tests__/` for how `navyParts`/`cruiseParts` are rendered: they use a react-three test renderer or a shallow harness). Write a test that renders every `SAIL_MESHES[type]` with `{ tint: null, emphasis: null }` and expects no throw, and one that checks `SAIL_ICONS` has all nine keys, each returning a non-null node.

- [ ] **Step 2: Meshes.** Coordinate conventions (read `navyParts.tsx` header): origin is the attach point; `+Y` up; `+X` is toward the bow; `Z` runs across the ship. Write `sails.tsx` as follows (adapt imports to what `fittingDecor.tsx` uses: `useFrame` from `@react-three/fiber`, `useShipAnimation`, `sceneTime` from `../testClock`, `Surface` from `../Surface`).

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  PlaneGeometry,
  type BufferAttribute,
  type Mesh,
} from "three";
import { useShipAnimation } from "../ShipAnimationContext";
import { sceneTime } from "../testClock";
import Surface from "../Surface";
import { WOOD, type PirateMesh, type PirateMeshProps } from "./shared";

const isGhost = (tint: PirateMeshProps["tint"]) =>
  tint === "ghost-ok" || tint === "ghost-bad";

/** How far a square sail bellies forward at its middle. */
const BELLY = 0.28;
const WOBBLE = 0.04;

interface SquareSailProps extends PirateMeshProps {
  width: number;
  height: number;
}

/** A yard across the ship with a sail hanging below it, bellying toward the bow. */
function SquareSail({
  width,
  height,
  painted,
  tint,
  emphasis,
}: SquareSailProps) {
  const { reducedMotion } = useShipAnimation();
  const cloth = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(width, height, 8, 6);
    plane.rotateY(Math.PI / 2); // spans Z, billows along X
    plane.translate(0, -height / 2, 0);
    return plane;
  }, [width, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (isGhost(tint) || reducedMotion || !cloth.current) return;
    const position = cloth.current.geometry.attributes
      .position as BufferAttribute;
    const t = sceneTime(clock.elapsedTime);
    for (let i = 0; i < position.count; i++) {
      const across = (position.getZ(i) / (width / 2)) ** 2;
      const down = ((position.getY(i) + height / 2) / (height / 2)) ** 2;
      const belly = BELLY * (1 - across) * (1 - down);
      position.setX(
        i,
        belly + WOBBLE * Math.sin(t * 1.4 + position.getZ(i) * 2) * (1 - down)
      );
    }
    position.needsUpdate = true;
  });

  const surface = { tint, emphasis };
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, width + 0.3, 8]} />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
      <mesh ref={cloth} geometry={geometry} castShadow>
        <Surface color={painted ?? WOOD.canvas} doubleSided {...surface} />
      </mesh>
    </group>
  );
}

interface TriangleSailProps extends PirateMeshProps {
  /** Corners in the ship's X-Y plane: tack, clew, head. */
  corners: [[number, number], [number, number], [number, number]];
}

/** A fore-and-aft triangular sail (jib, lateen) with a slight belly across Z. */
function TriangleSail({ corners, painted, tint, emphasis }: TriangleSailProps) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const [a, b, c] = corners;
    g.setAttribute(
      "position",
      new Float32BufferAttribute(
        [a[0], a[1], 0, b[0], b[1], 0.1, c[0], c[1], 0.18],
        3
      )
    );
    g.computeVertexNormals();
    return g;
  }, [corners]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <Surface
        color={painted ?? WOOD.canvas}
        doubleSided
        tint={tint}
        emphasis={emphasis}
      />
    </mesh>
  );
}

/** A tapered mast with a cap; sails and the flag hang off its points. */
function WoodMast({
  height,
  painted,
  tint,
  emphasis,
}: PirateMeshProps & { height: number }) {
  const surface = { tint, emphasis };
  return (
    <group>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.1, height, 10]} />
        <Surface color={painted ?? WOOD.oak} finish="wood" {...surface} />
      </mesh>
      <mesh position={[0, height + 0.04, 0]} castShadow>
        <sphereGeometry args={[0.07, 10, 8]} />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
    </group>
  );
}

/** The Jolly Roger: a black flag streaming toward the stern, with a skull. */
function JollyRoger({ tint, emphasis }: PirateMeshProps) {
  const { reducedMotion } = useShipAnimation();
  const cloth = useRef<Mesh>(null);
  const length = 0.9;
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(length, 0.55, 8, 2);
    plane.translate(-length / 2, 0.3, 0);
    return plane;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (isGhost(tint) || reducedMotion || !cloth.current) return;
    const position = cloth.current.geometry.attributes
      .position as BufferAttribute;
    const t = sceneTime(clock.elapsedTime) * 4;
    for (let i = 0; i < position.count; i++) {
      const u = -position.getX(i) / length;
      position.setZ(i, Math.sin(t - u * 5) * 0.08 * u);
    }
    position.needsUpdate = true;
  });
  const surface = { tint, emphasis };
  return (
    <group>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.02, 0.6, 6]} />
        <Surface color={WOOD.dark} finish="wood" {...surface} />
      </mesh>
      <mesh ref={cloth} geometry={geometry} castShadow>
        <Surface color={WOOD.black} doubleSided {...surface} />
      </mesh>
      {[1, -1].map((side) => (
        <group key={side} position={[-length * 0.4, 0.3, side * 0.012]}>
          <mesh>
            <circleGeometry args={[0.08, 12]} />
            <meshBasicMaterial color={WOOD.bone} side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const square = (width: number, height: number): PirateMesh =>
  function Sail(props) {
    return <SquareSail width={width} height={height} {...props} />;
  };

const mast = (height: number): PirateMesh =>
  function Mast(props) {
    return <WoodMast height={height} {...props} />;
  };

const JIB_CORNERS: TriangleSailProps["corners"] = [
  [0.25, 0],
  [-2.0, 0.1],
  [-1.9, 3.2],
];
const LATEEN_CORNERS: TriangleSailProps["corners"] = [
  [0.9, 0.1],
  [-1.2, 0],
  [-0.7, 2.3],
];

export const SAIL_MESHES = {
  "mast-wood-short": mast(5),
  "mast-wood-tall": mast(7),
  "mast-wood-main": mast(9),
  "sail-square-small": square(1.1, 1.2),
  "sail-square": square(1.6, 1.6),
  "sail-square-large": square(2.1, 2.0),
  "sail-jib": function Jib(props) {
    return <TriangleSail corners={JIB_CORNERS} {...props} />;
  },
  "sail-lateen": function Lateen(props) {
    return <TriangleSail corners={LATEEN_CORNERS} {...props} />;
  },
  "flag-jolly-roger": JollyRoger,
} satisfies Record<string, PirateMesh>;
```

Heights `5/7/9` must equal the catalog's mast heights (so sail spots line up with the mast). Run the app (`npx next dev --webpack`), start a pirate ship, place a main mast with three sails and a flag, and adjust sizes so a large sail at `sail:0` does not collide with the next sail at `sail:1` (spots are `height × 0.22` apart ≈ 2.0 for the main mast; the large sail is 2.0 tall: shrink to 1.8 if they touch). Check light and dark mode, and a 3-mast ship from the side and top views.

- [ ] **Step 3: Icons.** Replace the crates in `ui/icons/pirate/sails.tsx` with distinct 48×48 drawings (same stroke conventions as `PartIcon` neighbours): masts as brown tapered poles of three heights, square sails as cream trapezoids of three sizes on a yard, jib and lateen as triangles, flag as a black pennant with a white dot.

- [ ] **Step 4: Verify and commit.** `npx prettier --write` the files, `npx jest pirateSails pirateIcons && npm run type-check`, then:

```bash
git add -A
git commit -m "feat(ship-builder): wooden masts, sails and the Jolly Roger"
```

---

### Task 4: Cannon meshes (parallel)

**Goal:** Deck cannon, bow chaser and swivel gun are drawn, recoil and puff when tapped, and have real icons.

**Files:**

- Modify: `components/ship-builder/scene/pirate/cannons.tsx`, `components/ship-builder/ui/icons/pirate/cannons.tsx`
- Test: `components/ship-builder/scene/__tests__/pirateCannons.test.tsx`

**Acceptance Criteria:**

- [ ] Three distinct meshes (carriage + barrel; long barrel pointing forward on the chaser; small pivot gun on a post).
- [ ] Deck and swivel guns point outboard using `side` (`starboard` → world +Z, as `RaftCanister` does).
- [ ] A tap on a real (non-ghost) gun triggers a short recoil and a smoke puff (scale-only, no material mutation: materials are shared); the click still bubbles to the group, so selection is unaffected.
- [ ] Still under `reducedMotion` (no recoil, no puff animation) and for ghosts.

**Verify:** `npx jest pirateCannons && npm run type-check` → pass

**Steps:**

- [ ] **Step 1: Test.** Render the three meshes; assert no throw, and that firing (simulate `onClick` on the root mesh via the harness used by neighbouring tests, or unit-test the pure helper `recoilOffset(elapsed)` below) moves the barrel back and then returns it to rest.

- [ ] **Step 2: Implement** `cannons.tsx`. Pure helpers first so they are testable:

```tsx
"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { useShipAnimation } from "../ShipAnimationContext";
import Surface from "../Surface";
import { WOOD, type PirateMesh, type PirateMeshProps } from "./shared";

/** Seconds a shot lasts: a fast kick back, then a slow slide home. */
export const SHOT_SECONDS = 0.9;
const KICK = 0.22;

/** How far back the barrel sits `elapsed` seconds into a shot (0 at rest). */
export function recoilOffset(elapsed: number): number {
  if (elapsed < 0 || elapsed >= SHOT_SECONDS) return 0;
  const kick = 0.12;
  if (elapsed < kick) return KICK * (elapsed / kick);
  return KICK * (1 - (elapsed - kick) / (SHOT_SECONDS - kick));
}

/** Smoke scale 0..1.6 over the shot, then hidden. */
export function puffScale(elapsed: number): number {
  if (elapsed < 0 || elapsed >= SHOT_SECONDS) return 0;
  return 1.6 * Math.sin((elapsed / SHOT_SECONDS) * Math.PI);
}
```

`GunBody` takes `length`, `radius`, `outward` (+1/−1 world Z multiplier, or `0` for the bow chaser which points along +X) and renders: a carriage (two wheels = cylinders, one box), a barrel cylinder rotated to point along its direction, and a muzzle ring. A `useRef<Group>` barrel group is offset by `-recoilOffset(t)` along the barrel direction inside `useFrame`; a `useRef<Mesh>` puff sphere at the muzzle scaled by `puffScale(t)` with colour `WOOD.bone`. Firing: the root `<group onClick={() => { if (!ghost && !reducedMotion) shot.current = clock time }}>`; use a `useRef<number | null>` for the start time stored from `useFrame`'s `clock.elapsedTime` (set a `fire` flag on click, consume it in the next frame). Do not call `event.stopPropagation()`.

Exports:

```tsx
export const CANNON_MESHES = {
  "cannon-deck": ({ side, ...props }) => (
    <Gun side={side} length={0.7} radius={0.07} {...props} />
  ),
  "cannon-swivel": ({ side, ...props }) => (
    <Gun side={side} length={0.4} radius={0.045} post {...props} />
  ),
  "cannon-chaser": (props) => (
    <Gun side={undefined} length={1.0} radius={0.08} forward {...props} />
  ),
} satisfies Record<string, PirateMesh>;
```

(Write `Gun` with the props above; `post` replaces the wheeled carriage with a short post and pivot; `forward` points the barrel along +X and ignores `side`.) Colours: carriage `WOOD.dark`, barrel `WOOD.iron` with `finish="metal"`.

Run the app and check each gun sits on the deck edge / bow, points the right way on both sides, and fires on tap in light and dark mode.

- [ ] **Step 3: Icons.** Three distinct drawings: wheeled cannon in profile, a long gun, a small post gun.

- [ ] **Step 4: Verify and commit.**

```bash
git add -A
git commit -m "feat(ship-builder): pirate cannons that fire when tapped"
```

---

### Task 5: Wooden deco meshes (parallel)

**Goal:** Captain's cabin trim, ship's wheel, figurehead, anchor, barrels, crates, treasure chest and rowboat are drawn, with real icons.

**Files:**

- Modify: `components/ship-builder/scene/pirate/deco.tsx`, `components/ship-builder/ui/icons/pirate/deco.tsx`
- Test: `components/ship-builder/scene/__tests__/pirateDeco.test.tsx`

**Acceptance Criteria:**

- [ ] `CaptainCabinTrim({ size, tint, emphasis })` draws stern-facing window frames on the cabin block; `HelmWheelMesh({ tint, emphasis })` draws a spoked wheel on a binnacle, standing on the quarterdeck roof (its origin is the roof centre).
- [ ] `DECO_MESHES.figurehead` is a carved mermaid at the bow tip leaning forward; `DECO_MESHES.rowboat` is a wooden boat hanging from the davit (reuse `LifeboatMesh`'s hull approach, planked colours).
- [ ] `DECO_DECOR` has an anchor, a barrel stack (3 barrels), a crate stack (3 boxes) and a treasure chest with gold; decor faces its `rotation` via `facingYaw` from `../deckDecor`.
- [ ] Icons are distinct and match.

**Verify:** `npx jest pirateDeco && npm run type-check` → pass

**Steps:**

- [ ] **Step 1: Test** each export renders without throwing (decor with `rotation: 0`, `color: undefined`).

- [ ] **Step 2: Implement.** Follow `deckDecor.tsx` for decor (wrap in a `Facing` group using `facingYaw(rotation)`; export `facingYaw` already exists). Dimensions (cell is 1×1 and a level is `LEVEL_HEIGHT`): anchor ≈ 0.6 wide, 0.5 tall; barrel radius 0.16, height 0.34, three barrels in a triangle; crates 0.34 cubes, two below one on top, rotated 12°; chest 0.5×0.28×0.32 with an arched lid (half-cylinder) and a gold lock (`#e8b923`, `finish="metal"`). Wheel: ring (`torusGeometry [0.28, 0.025, 8, 24]`) with eight spokes and handle pegs, standing upright facing the bow, on a 0.5 tall binnacle box. Figurehead: a tapered body, a sphere head and swept-back arms in `WOOD.pale`, tilted forward 25° about Z. Cabin trim: for each of the cabin block's stern-facing (+X) face windows, a pale frame and a dark-glass inset (use `Surface finish="glass"`), sized from the `size` prop (`size.x`, `size.z`). Rowboat: a lens-shaped hull from a scaled sphere half, two benches, two oars.

  Check in the running app: stern windows only on the +X face; the wheel is on top of the helm block and not floating; the figurehead sits at the bow tip on a beakhead bow.

- [ ] **Step 3: Icons** (eight distinct 48×48 drawings).

- [ ] **Step 4: Verify and commit.**

```bash
git add -A
git commit -m "feat(ship-builder): pirate deck decor, helm, figurehead and rowboat"
```

---

### Task 6: Crew, plank and parrot (parallel)

**Goal:** The plank, the pirate figure and the parrot are drawn, with real icons.

**Files:**

- Modify: `components/ship-builder/scene/pirate/crew.tsx`, `components/ship-builder/ui/icons/pirate/crew.tsx`
- Test: `components/ship-builder/scene/__tests__/pirateCrew.test.tsx`

**Acceptance Criteria:**

- [ ] `CREW_MESHES.plank` is a board that extends outboard over the sea from a deck edge (uses `side`), with a rope rail stub and a slight downward tilt at the tip.
- [ ] `CREW_DECOR["pirate-crew"]` is a capsule body, round head, tricorn hat and a thin sword; four colour variants chosen deterministically from `rotation` and the colour override (the prop is all this component receives, so vary by `rotation`, which the player can set), facing its `rotation`.
- [ ] `CREW_DECOR.parrot` is a small colourful bird on a short perch.
- [ ] Nothing in the model changes: walk-mode behaviour is already handled in Task 2.

**Verify:** `npx jest pirateCrew && npm run type-check` → pass

**Steps:**

- [ ] **Step 1: Test** each renders without throwing for both sides and all four rotations.

- [ ] **Step 2: Implement.** Plank: box 1.4 long × 0.34 wide × 0.04 thick, pivot at the deck edge, extending outward by `outward = side === "starboard" ? 1 : -1` along world Z (same convention as `RaftCanister`), tilted `-0.12` rad at the tip; add two short rope posts. Crew: body capsule (`capsuleGeometry [0.09, 0.3]`) in one of `["#7a1f1f", "#1f3a6b", "#3c5a3c", "#5a4a1f"]` chosen by `(rotation / 90) % 4`, head sphere r 0.08 in `#e4b88a`, hat two flattened cones in `WOOD.black`, a sword (thin box in `finish="metal"`) at the hip. Parrot: body sphere (red `#c8312b`), wing (blue `#2f7fc1`), beak (yellow cone), tail (green box), on a 0.2 tall perch.

- [ ] **Step 3: Icons** (three distinct drawings).

- [ ] **Step 4: Verify and commit.**

```bash
git add -A
git commit -m "feat(ship-builder): pirate crew, parrot and plank"
```

---

### Task 7: Pirate templates and fixtures (parallel)

**Goal:** Four ready-made pirate ships in the New ship dialog: Small sloop, Whydah Gally, Queen Anne's Revenge and a Black Pearl-style galleon, each valid, able to sail and warning-free.

**Files:**

- Modify: `lib/ship-builder/templates/pirate.ts`, `lib/ship-builder/templates/modernBuilder.ts` (two helpers), `lib/ship-builder/templates/__tests__/modernTemplates.test.ts`
- Create: `lib/ship-builder/templates/__tests__/pirateTemplates.test.ts`, fixtures via `UPDATE_FIXTURES=1 npx jest fixtures`
- Test: as above, plus the existing `templates.test.ts` which loops over `SHIP_KINDS`

**Acceptance Criteria:**

- [ ] `TEMPLATES.pirate` ids are `small-sloop`, `whydah-gally`, `queen-annes-revenge`, `black-pearl-galleon` with names, years (1700, 1717, 1718, 1720), blurbs under 80 chars; the galleon's blurb says it is made up.
- [ ] Each builds a ship that passes `validateShip`, has `stats.warnings` equal to `[]`, `topSpeedKnots` in 6..14, and uses unique part ids.
- [ ] Cannon counts: sloop 4, Whydah ≥ 20, Queen Anne's Revenge ≥ 30, galleon ≥ 28; Queen Anne's Revenge and the galleon have three masts, the sloop one tall mast plus a bow mast.
- [ ] Hull sizes (segments × beam): sloop 6×3, Whydah 10×4, Queen Anne's Revenge 12×5, galleon 14×5.
- [ ] Share link builds for each; fixtures are written and `npm test` is green.

**Verify:** `npx jest templates fixtures` → pass

**Steps:**

- [ ] **Step 1: Builder helper.** Add to `ShipBuilder` in `modernBuilder.ts`:

```ts
  /** A deck cannon on a block's outer edge. */
  cannon(level: number, x: number, z: number): string {
    return this.attach("cannon-deck", this.blockAt(level, x, z), `edge:${x}:${z}`);
  }

  /** A sail on a free spot of a wooden mast. */
  sail(type: PartType, mastId: string, slot: number): string {
    return this.attach(type, mastId, `sail:${slot}`);
  }
```

- [ ] **Step 2: Tests first** in `pirateTemplates.test.ts`:

```ts
import { computeStats } from "../../model/stats";
import { validateShip } from "../../model/placement";
import { MAX_PARTS } from "../../persist/schema";
import { buildShareUrl } from "../../persist/share";
import { TEMPLATES } from "..";

const count = (id: string, type: string) =>
  TEMPLATES.pirate
    .find((t) => t.id === id)!
    .build()
    .parts.filter((p) => p.type === type).length;

describe("pirate templates", () => {
  it("offers the four ships in order", () => {
    expect(TEMPLATES.pirate.map((t) => t.id)).toEqual([
      "small-sloop",
      "whydah-gally",
      "queen-annes-revenge",
      "black-pearl-galleon",
    ]);
  });

  it.each(TEMPLATES.pirate.map((t) => [t.id, t] as const))(
    "%s is valid, sails and has no warnings",
    (_id, template) => {
      const ship = template.build();
      expect(ship.kind).toBe("pirate");
      expect(validateShip(ship).ok).toBe(true);
      expect(ship.parts.length).toBeLessThanOrEqual(MAX_PARTS);
      expect(new Set(ship.parts.map((p) => p.id)).size).toBe(ship.parts.length);
      const stats = computeStats(ship);
      expect(stats.warnings).toEqual([]);
      expect(stats.topSpeedKnots).toBeGreaterThanOrEqual(6);
      expect(stats.topSpeedKnots).toBeLessThanOrEqual(14);
      expect(buildShareUrl(ship, "https://example.com")).not.toBeNull();
    }
  );

  it("sizes the hulls and arms them as planned", () => {
    const hull = (id: string) =>
      TEMPLATES.pirate.find((t) => t.id === id)!.build().hull;
    expect(hull("small-sloop")).toMatchObject({ lengthSegments: 6, beam: 3 });
    expect(hull("whydah-gally")).toMatchObject({ lengthSegments: 10, beam: 4 });
    expect(hull("queen-annes-revenge")).toMatchObject({
      lengthSegments: 12,
      beam: 5,
    });
    expect(hull("black-pearl-galleon")).toMatchObject({
      lengthSegments: 14,
      beam: 5,
    });
    expect(
      count("small-sloop", "cannon-deck") +
        count("small-sloop", "cannon-chaser")
    ).toBe(4);
    expect(count("whydah-gally", "cannon-deck")).toBeGreaterThanOrEqual(20);
    expect(count("queen-annes-revenge", "cannon-deck")).toBeGreaterThanOrEqual(
      30
    );
    expect(count("black-pearl-galleon", "cannon-deck")).toBeGreaterThanOrEqual(
      28
    );
  });

  it("gives the big ships three masts and black sails on the galleon", () => {
    for (const id of ["queen-annes-revenge", "black-pearl-galleon"]) {
      const masts = [
        "mast-wood-short",
        "mast-wood-tall",
        "mast-wood-main",
      ].reduce((sum, type) => sum + count(id, type), 0);
      expect(masts).toBe(3);
    }
    const galleon = TEMPLATES.pirate
      .find((t) => t.id === "black-pearl-galleon")!
      .build();
    const sails = galleon.parts.filter((p) => p.type.startsWith("sail-square"));
    expect(sails.length).toBeGreaterThan(0);
    expect(sails.every((p) => p.color === "black")).toBe(true);
  });
});
```

Run → FAIL (no templates).

- [ ] **Step 3: Build the templates** in `pirate.ts` using the navy/cruise files as the pattern (same `ShipBuilder`, `range`, `ShipTemplate` shape). Layout recipe, all in cell units (3 cells per segment, so the sloop is 18 cells long, rows `z` 0..beam-1):
  - **Gunwale strips:** `b.decks(0, x0, x1, [0, beam - 1])` along the sides give the edge points for cannons and davits.
  - **Quarterdeck aft:** `b.decks(0, xAft, length, ALL_ROWS)`, then `b.cells("cabin-captain", 1, …)` over it (3 cells for the sloop, 3 for the Whydah and 4 for the two big ships to cover crew berths: crew is `segments × 5`, berths `20 per cabin cell`), and `b.grid("helm-wheel", 1, x, 0)` (it is 1×2 so it occupies z 0..1; leave rows free at that x).
  - **Masts:** the foremast on the bow hull point (`b.hull("mast-wood-short", "mast-fore")`), further masts on deck blocks mid-ship (`b.decks(0, x, x + 2, [centreRow])` then `b.onMast("mast-wood-tall" | "mast-wood-main", 0, x, centreRow)`). Hang sails with `b.sail("sail-square-large", mastId, 0)`, `b.sail("sail-square", mastId, 1)`, etc.; the mizzen (aftmost) mast gets `b.sail("sail-lateen", mizzenId, 0)`. Flag: `b.attach("flag-jolly-roger", mainMastId, "masthead")`.
  - **Bow:** `b.hull("sail-jib", "jib")`, `b.hull("figurehead", "figurehead")` (big ships), `b.hull("cannon-chaser", "bowgun")`; stern `b.hull("rudder", "rudder")`.
  - **Cannons:** `b.cannon(0, x, z)` for `z` in the two edge rows over a run of `x` values, skipping the cells used by davits; boats: `b.boat("rowboat", 0, x, z)` on strips (one rowboat per 12 people aboard: crew is `segments × 5`).
  - **Decor:** a few `b.grid("barrel-stack" | "crate-stack" | "treasure-chest" | "ship-anchor" | "pirate-crew" | "parrot", 0, x, z)` on open main-deck cells that no other part uses (decor needs the main deck inside the hull or a deck block), including a pirate or two near the helm; `b.attach("plank", blockId, "edge:x:z")` on the Queen Anne's Revenge starboard strip.
  - **Paint:** Queen Anne's Revenge `withPaint({ topsides: "dark-oak", bottom: "black" })`; galleon `withPaint({ topsides: "black", bottom: "dark-oak" })` and every square sail `.color = "black"` (set via the placed part: add an optional `color` argument to your local `sail` call sites, or map the built ship's sail parts to `{ ...part, color: "black" }` before returning `b.build()`).
  - Years and blurbs: sloop 1700 "A small fast ship for your first pirate crew"; Whydah 1717 "A real pirate ship that sank with its treasure"; Queen Anne's Revenge 1718 "Blackbeard's flagship, with forty cannons"; galleon 1720 "A made-up ghostly ship with black sails".

  Then iterate until `pirateTemplates.test.ts` passes. Failure messages from `validateShip` name the offending part. If a ship is top-heavy, widen the gunwale strips, drop the main mast to tall, or lower the quarterdeck; if berths or seats fail, add a cabin cell or a davit and rowboat; if `topSpeedKnots` is outside 6..14, adjust sail count (not the formula).

- [ ] **Step 4: Fixtures.** `UPDATE_FIXTURES=1 npx jest fixtures` writes `persist/__fixtures__/templates/*.json` and expectations; confirm only four new fixture pairs appear (`git status`), then `npx jest templates fixtures` → pass.

- [ ] **Step 5: Verify and commit.**

```bash
git add -A
git commit -m "feat(ship-builder): four pirate ship templates"
```

---

### Task 8: UI polish, e2e, release (after T3-T7)

**Goal:** The five-card picker lays out well on phone and iPad, Drive says "Sails" for pirate ships, help mentions pirates, e2e covers the new kind, and 2.13.0 is released.

**Files:**

- Modify: `components/ship-builder/ui/NewShipDialog.tsx`, `components/ship-builder/ui/DriveHud.tsx` and/or `ThrottleLever.tsx`, `components/ship-builder/ui/HelpButton.tsx`, `lib/ship-builder/version.ts`, `lib/ship-builder/changelog.ts`
- Create: `e2e/ship-builder-pirate.spec.ts`
- Test: `components/ship-builder/ui/__tests__/NewShipDialog.test.tsx`, `ThrottleLever.test.tsx`

**Acceptance Criteria:**

- [ ] In `NewShipDialog` the last card spans both columns when the item count is odd (kind step: 5 cards; template step: Blank + 4 templates = 5 for pirate), and the pirate card shows the pirate icon; unit tests cover five kind cards and the pirate template list.
- [ ] For `kind === "pirate"` the throttle's accessible label and visible caption read "Sails" (other kinds unchanged).
- [ ] Help text lists pirate ships among the ship types.
- [ ] `e2e/ship-builder-pirate.spec.ts` (tagged `@smoke` on the picker test): new pirate ship from the dialog; loading `whydah-gally` shows sails and a speed above 0; a short drive on a pirate template moves the ship.
- [ ] `SHIP_BUILDER_VERSION = "2.13.0"` and a matching top `CHANGELOG` entry in plain words.
- [ ] `npm run validate` and `npm run test:e2e -- --project=chromium --project=webkit --project=ipad` pass.

**Verify:** `npm run validate` → pass

**Steps:**

- [ ] **Step 1: Dialog layout.** On each `<li>` in both grids add `className="[&:last-child:nth-child(odd)]:col-span-2"`. Add tests to `NewShipDialog.test.tsx`: five `[data-card][data-kind]` buttons including `pirate`; choosing pirate lists Blank plus the four templates (`[data-template]` ids); clicking `whydah-gally` creates a pirate ship in the store.

- [ ] **Step 2: Throttle label.** In `ThrottleLever.tsx` read how the visible/accessible text is built (`aria-label={`${label} throttle`}`); add a small `throttleWord(kind)` returning `"Sails"` for pirate and `"Throttle"` otherwise, and use it in the label and any visible caption. Unit test both words.

- [ ] **Step 3: Help.** In `HelpButton.tsx` find where the four ship types are listed and add pirate ships ("Pirate ships sail on wind: more sail means more speed").

- [ ] **Step 4: E2E.** Model on `e2e/ship-builder.spec.ts` (see the existing cargo test around line 494: `window.__shipBuilderStore!.getState().newShip("cargo")`) and the drive tests for how to start a drive. Tests: (a) `{ tag: "@smoke" }` open New ship, assert five kind cards, pick Pirate ship, pick the Whydah Gally, assert `ship.kind === "pirate"` and `stat-sail-area` / `stat-cannons` visible after opening the stats tab; (b) start a drive with the Small sloop and assert the speed readout rises above 0 after holding the throttle (follow the existing drive e2e for key handling).

- [ ] **Step 5: Release.** Set `SHIP_BUILDER_VERSION = "2.13.0"`. Add the top `CHANGELOG` entry (match the existing entry shape in `changelog.ts`; get the commit list with `git log ee131a4..HEAD -- lib/ship-builder components/ship-builder app/ship-builder`) written for a young builder, e.g. "Pirate ships! Start a new pirate ship and build with wooden masts, sails, cannons you can tap to fire, a captain's cabin, a ship's wheel and even a parrot. More sail makes her faster. Try the four ready-made ships, including a ghostly black-sailed galleon." Run `npx jest changelog`.

- [ ] **Step 6: Full verification (the one expensive run).** `npm run validate`, then `npm run test:e2e -- --project=chromium --project=webkit --project=ipad`. Do a manual pass in `npx next dev --webpack`: all four templates, a blank pirate ship, drive and walk a pirate ship, sink one in a sea trial, light and dark mode, phone width and iPad width.

- [ ] **Step 7: Commit.**

```bash
git add -A
git commit -m "feat(ship-builder): pirate ships (2.13.0)"
```

## Self-review against the spec

| Spec item                                                                             | Where                                                                                                |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Kind, defaults, save bump, paint, hull ends                                           | Task 1                                                                                               |
| Sails replace power, no-sails/no-rudder checks, helm as bridge, handling, drive reuse | Task 2 (rules), Task 1 (handling, controls), Task 8 (label)                                          |
| Cannons stat, reference ship                                                          | Tasks 1, 2                                                                                           |
| Sails/masts/flag                                                                      | Tasks 2, 3                                                                                           |
| Cannons (deck, chaser, swivel, tap to fire)                                           | Tasks 2, 4                                                                                           |
| Wooden deco (cabin, helm, figurehead, anchor, barrels, crates, chest, rowboat)        | Tasks 2, 5                                                                                           |
| Plank, crew, parrot, walk mode                                                        | Tasks 2, 6                                                                                           |
| Picker icon                                                                           | Task 1                                                                                               |
| Templates (4) and fixtures                                                            | Tasks 1, 7                                                                                           |
| Dialog five cards + phone/iPad layout                                                 | Tasks 1, 8                                                                                           |
| Parts panel per kind, Stats rows, reference box, help                                 | Tasks 2, 8                                                                                           |
| Tests (model, stats, placement, templates, UI, sim, e2e)                              | Tasks 1-8; sim check: Task 8 manual sea-trial plus the existing sim suite (sinking is kind-agnostic) |
| Release 2.13.0, no service worker bump                                                | Task 8                                                                                               |

Sim coverage note: sinking and breakup read only hull shape, parts mass and compartments, none of which are kind-specific, so the existing sim tests remain the guard; Task 7's template tests run `computeStats`, and Task 8's e2e drives a pirate ship.
