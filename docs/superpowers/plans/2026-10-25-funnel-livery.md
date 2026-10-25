# Funnel Livery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship-wide funnel colours (body, bands, top) and a per-funnel mark (one or two letters, or a logo), edited from a Style panel on a selected funnel.

**Architecture:** Pure data and rules in `lib/ship-builder/model/funnelLivery.ts`. They're saved on the ship (`Ship.funnelPaint`) and on each funnel part (`PlacedPart.mark`), behind a v7→v8 schema bump. Store actions `paintFunnels` and `setFunnelMark` go through `commit`, so undo works. The scene draws the mark as a `CanvasTexture` on two flat decal planes, one per side. A `FunnelStylePanel` opens from `SelectionBar`.

**Tech Stack:** Next 16, React 19, TypeScript, three 0.186 / @react-three/fiber 9, zustand 5, zod 4, Tailwind 4, Jest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-ship-builder-life-aboard-design.md` (section 1, plus the cost constraint)

## Global Constraints

- Funnel colours are **uniform across the ship**. Letters and logos are **per funnel**.
- A mark is either 1–2 characters (A–Z, 0–9, stored uppercase) or one logo. It's never both, and it has its own colour.
- Logos (fixed set, drawn by us, no real company logos): `star`, `anchor`, `heart`, `wave`, `crown`, `compass`, `sun`.
- Applies to `funnel`, `funnel-large` and `funnel-modern`. `funnel-modern` has no bands; its "top" colour paints the grille.
- Old saves must load and look the same. A funnel's existing per-part `color` stays as a body override. Setting the body colour ship-wide clears every funnel's override.
- Colours come only from `PAINT_COLORS` (`lib/ship-builder/model/paint.ts`).
- Tailwind only, light and dark mode on every element, mobile first, tap targets of at least 44px (`min-h-11`).
- `export default function` for components, `interface` for props, `@/` imports, Prettier style.
- This is a Ship Builder release: `SHIP_BUILDER_VERSION` becomes `2.17.0`, with a matching top `CHANGELOG` entry.
- Don't run e2e or `npm run build` per task. Run them once, in Task 4.

## Review Focus

1. Loading an existing v7 save or share link (including templates with painted funnels): it must look identical. Pinned in Task 1 (migration test).
2. Typing lowercase, a symbol, an emoji or 3+ characters into the letters box: it must end up as at most 2 uppercase A–Z/0–9 characters, and an empty result clears the mark. Pinned in Task 1 (`normalizeMarkText`) and Task 3.
3. Undo after a Style change: one undo reverts exactly that change. Pinned in Task 1 (store test).
4. A Style change during a sea trial: ignored, like every other edit. Pinned in Task 1.
5. jsdom or a browser with no 2D canvas context: the mark is skipped and nothing crashes. Pinned in Task 2.

## Execution notes (cost)

- Four tasks. Tasks 1 and 4 touch data and templates; tasks 2 and 3 are visual.
- Models: **Task 1 Sonnet**, **Task 2 Sonnet**, **Task 3 Sonnet**, **Task 4 Haiku**.
- One combined spec and quality review (Sonnet) after Task 3, covering Tasks 1–3. The controller spot-checks Task 4.
- Tasks 2 and 3 both consume Task 1's interfaces but don't touch each other's files. They may run in parallel worktrees (see memory `parallel-implementers`).

---

### Task 1: Livery model, save format and store actions (Sonnet)

**Files:**

- Create: `lib/ship-builder/model/funnelLivery.ts`
- Create: `lib/ship-builder/model/__tests__/funnelLivery.test.ts`
- Modify: `lib/ship-builder/model/types.ts`. `Ship.v` becomes `8`. Add `funnelPaint?` to `Ship` and `mark?` to `PlacedPart`.
- Modify: `lib/ship-builder/persist/schema.ts`. Set `CURRENT_VERSION = 8`. Add the fields to the zod schema and a `7: addFunnelLivery` migration.
- Modify: every non-fixture `v: 7` literal. Run `grep -rl "v: 7" lib components e2e | grep -v __fixtures__` to find them; it lists 10 files today, including `testing.ts`, `model/placement.ts`, `templates/liner.ts` and `e2e/ship-builder-walk.spec.ts`.
- Modify: `lib/ship-builder/state/store.ts`. Add the `paintFunnels` and `setFunnelMark` actions.
- Test: `lib/ship-builder/persist/__tests__/schema.test.ts`, `lib/ship-builder/state/__tests__/store.test.ts`

**Interfaces (produces):**

```ts
// lib/ship-builder/model/funnelLivery.ts
export const FUNNEL_TYPES = [
  "funnel",
  "funnel-large",
  "funnel-modern",
] as const;
export type FunnelType = (typeof FUNNEL_TYPES)[number];
export function isFunnelType(type: PartType): type is FunnelType;

export const FUNNEL_AREAS = ["body", "bands", "top"] as const;
export type FunnelArea = (typeof FUNNEL_AREAS)[number];
export type FunnelPaint = Partial<Record<FunnelArea, PaintColor>>;

export const FUNNEL_LOGOS = [
  { id: "star", name: "Star" },
  { id: "anchor", name: "Anchor" },
  { id: "heart", name: "Heart" },
  { id: "wave", name: "Wave" },
  { id: "crown", name: "Crown" },
  { id: "compass", name: "Compass" },
  { id: "sun", name: "Sun" },
] as const;
export type FunnelLogo = (typeof FUNNEL_LOGOS)[number]["id"];
export const FUNNEL_LOGO_IDS: readonly [FunnelLogo, ...FunnelLogo[]];

export type FunnelMark =
  | { kind: "letters"; text: string; color: PaintColor }
  | { kind: "logo"; logo: FunnelLogo; color: PaintColor };

export const MARK_TEXT_PATTERN = /^[A-Z0-9]{1,2}$/;
/** Uppercases, drops anything outside A–Z/0–9, keeps the first two. */
export function normalizeMarkText(input: string): string;

/** A funnel's colours: body is its own `color` override, else the ship's. */
export function funnelColors(
  ship: Ship,
  part: { color?: PaintColor }
): FunnelPaint;
```

```ts
// types.ts additions
interface Ship { v: 8; /* … */ funnelPaint?: FunnelPaint }
interface PlacedPart { /* … */ mark?: FunnelMark }

// store actions (ShipBuilderActions)
/** Sets one funnel area ship-wide; null resets it. Body also clears per-funnel `color`. */
paintFunnels: (area: FunnelArea, color: PaintColor | null) => void;
/** Sets or clears (null) the mark on one funnel part. Ignores non-funnels. */
setFunnelMark: (id: string, mark: FunnelMark | null) => void;
```

Import types into `types.ts` with `import type` from `./funnelLivery`, which must import its `PartType`/`Ship` types with `import type` too, so there are no runtime cycles.

- [ ] **Step 1: Write failing model tests** in `model/__tests__/funnelLivery.test.ts`:
  - `normalizeMarkText("ab")` → `"AB"`; `"a-b!c"` → `"AB"`; `"7"` → `"7"`; `"🚢x"` → `"X"`; `""` → `""`; `"abc"` → `"AB"`.
  - `isFunnelType("funnel-modern")` → true; `isFunnelType("mast")` → false.
  - `funnelColors({ ...ship, funnelPaint: { body: "red", top: "black" } }, {})` → `{ body: "red", top: "black" }`.
  - `funnelColors(sameShip, { color: "buff" })` → `{ body: "buff", top: "black" }` (override wins).
  - `funnelColors(shipWithoutFunnelPaint, {})` → `{}`.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=funnelLivery`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `funnelLivery.ts`** to the interface above. `funnelColors` omits keys that are undefined.
- [ ] **Step 4: Write failing schema tests** in `schema.test.ts`:
  - A v7 ship with a painted funnel (`color: "red"`) parses to v8 with that part's `color` still `"red"` and no `funnelPaint`.
  - A v8 ship with `funnelPaint: { body: "red", bands: "black" }` and a funnel `mark: { kind: "letters", text: "WS", color: "white" }` round-trips.
  - `mark.text: "abc"` and `mark.text: "w"` (lowercase) are rejected. `mark: { kind: "logo", logo: "skull", color: "red" }` is rejected.
- [ ] **Step 5: Implement the schema.** `funnelPaint` is an optional object with optional `body`/`bands`/`top` from `PAINT_COLOR_IDS`. `mark` is an optional `z.discriminatedUnion("kind", …)` with `text: z.string().regex(MARK_TEXT_PATTERN)` and `logo: z.enum(FUNNEL_LOGO_IDS)`. The migration is `const addFunnelLivery: Migration = (raw) => ({ ...raw, v: 8 });`, with a doc comment in the style of `addPirates`. Bump every `v: 7` literal found by the grep.
- [ ] **Step 6: Write failing store tests** in `store.test.ts`:
  - `paintFunnels("top", "black")` sets `ship.funnelPaint.top`. Calling `paintFunnels("top", null)` removes the key, and removes `funnelPaint` entirely when it's empty.
  - With two funnels where one has `color: "red"`, `paintFunnels("body", "buff")` sets `funnelPaint.body = "buff"` and removes `color` from both funnels. A non-funnel part's `color` is untouched.
  - `setFunnelMark(funnelId, { kind: "logo", logo: "star", color: "yellow" })` sets it, and `setFunnelMark(funnelId, null)` removes the `mark` key. `setFunnelMark(mastId, …)` leaves the ship unchanged.
  - After `setFunnelMark`, `undo()` restores the previous ship (one history entry per call).
  - While a trial is active (use whatever the existing trial tests use to start one), both actions leave the ship unchanged.
- [ ] **Step 7: Implement both actions**, modelled on `paintHull` (`isTrialActive()` guard, `commit`).
- [ ] **Step 8: Run** `npm test -- --testPathPatterns="funnelLivery|schema|store|fixtures"`, then `npm run type-check`. Expected: all pass. If `fixtures.test.ts` fails only because the version moved 7→8, regenerate with `UPDATE_FIXTURES=1 npx jest fixtures`. Check with `git diff --stat lib/ship-builder/persist/__fixtures__` that only templates and expectations changed, never the `legacy/` inputs.
- [ ] **Step 9: Commit** `feat(ship-builder): save funnel colours and marks`

---

### Task 2: Draw the livery on funnels (Sonnet)

**Files:**

- Create: `components/ship-builder/scene/funnelMarkTexture.ts`
- Create: `components/ship-builder/scene/FunnelMarkDecals.tsx`
- Create: `components/ship-builder/scene/__tests__/funnelMarkTexture.test.ts`
- Modify: `components/ship-builder/scene/FunnelMesh.tsx`. Add `bandColor?`, `topColor?` and `mark?` props.
- Modify: `components/ship-builder/scene/cruiseParts.tsx`. `ModernFunnel` gets `topColor?` (applied to the grille in place of `MODERN_GRILLE_COLOR`) and `mark?`.
- Modify: `components/ship-builder/scene/funnelGeometry.ts`. Export `modernFunnelRadiusAt(height: number): number`, the taper used by `buildModernFunnelGrille`, and reuse it there.
- Modify: `components/ship-builder/scene/PartMesh.tsx`. Add `mark?: FunnelMark` to `PartMeshProps` and pass it plus `funnelColors(ship, { color })` into `Fitting` for the three funnel cases.
- Modify: `components/ship-builder/scene/ShipParts.tsx`. Pass `mark={part.mark}`.

**Interfaces:**

- Consumes (Task 1): `FunnelMark`, `FunnelLogo`, `FUNNEL_LOGOS`, `funnelColors`, `paintHex`.
- Produces:

```ts
// funnelMarkTexture.ts
/** 24×24 viewBox filled SVG path per logo; also drawn by the UI (Task 3). */
export const FUNNEL_LOGO_PATHS: Record<FunnelLogo, string>;
/** Cached per mark (key: kind|text-or-logo|color). null when there is no 2D context. */
export function getFunnelMarkTexture(mark: FunnelMark): CanvasTexture | null;

// FunnelMarkDecals.tsx
interface FunnelMarkDecalsProps {
  mark: FunnelMark;
  /** Height of the decal centre above the funnel base. */
  height: number;
  /** Body radius across the ship (world Z) at that height. */
  radius: number;
  /** Side length of the square decal. */
  size: number;
}
export default function FunnelMarkDecals(
  props: FunnelMarkDecalsProps
): JSX.Element | null;
```

- [ ] **Step 1: Write failing tests** in `funnelMarkTexture.test.ts`:
  - `Object.keys(FUNNEL_LOGO_PATHS)` equals `FUNNEL_LOGOS.map(l => l.id)`, and each path is a non-empty string starting with `M`.
  - In jsdom (where `getContext("2d")` returns null), `getFunnelMarkTexture({ kind: "letters", text: "WS", color: "white" })` returns `null` and doesn't throw.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns=funnelMarkTexture`. Expected: FAIL.
- [ ] **Step 3: Implement `funnelMarkTexture.ts`.** Use a 256×256 transparent canvas. Draw letters in bold sans-serif, sized so two letters fill about 80% of the width. Draw logos by scaling the 24-unit path to about 200px, centred, and filling `new Path2D(path)`, all with `paintHex(mark.color)`. Set `colorSpace = SRGBColorSpace`. Cache textures in a module `Map` (session-lived, never disposed, like `armCache` in `DavitMesh.tsx`). The paths are simple filled silhouettes that read at small size: a five-point star, an anchor, a heart, two stacked waves, a three-point crown, a compass rose and a sun with rays.
- [ ] **Step 4: Implement `FunnelMarkDecals`.** Draw two `planeGeometry` meshes of `size`×`size` at `[0, height, ±(radius + 0.01)]`. The +Z plane faces +Z and the −Z plane is rotated `π` about Y, so both read correctly from outside. Use `meshStandardMaterial` with `map`, `transparent`, `depthWrite={false}` and `polygonOffset`. Pass `noRaycast` so taps fall through (see `noRaycast.ts`). Return `null` when the texture is null.
- [ ] **Step 5: Wire up the meshes.** Inside each funnel's raked group:
  - `FunnelMesh`: use `bandColor ?? PALETTE.funnelBand` and `topColor ?? PALETTE.funnelTop`. Put the mark at `height = bodyHeight * 0.55`, with `radius = funnelRadiusAt(dims, height)` and `size = radius * 1.3`.
  - `ModernFunnel`: put the mark at `height = MODERN_FUNNEL_HEIGHT * 0.45`, with `radius = modernFunnelRadiusAt(height)` and `size = radius * 1.4`. Z isn't stretched; only X is.
  - In `PartMesh`'s `Fitting`, `bodyColor` comes from `funnelColors(...).body`, and the other areas come from the same call through `paintHex`.
- [ ] **Step 6: Run** `npm test -- --testPathPatterns="funnelMarkTexture|PartMesh|ShipParts"` and `npm run type-check`. Expected: pass.
- [ ] **Step 7: Check it in the real app.** Run `npm run dev`. In the browser console, set a mark through the store hook the e2e tests use (`window.__shipBuilder…` in `lib/ship-builder/testHooks.ts`), or wait for Task 3. Confirm the letters read the right way round on both sides and that funnel taps still select the funnel.
- [ ] **Step 8: Commit** `feat(ship-builder): paint funnel bands and tops, draw letters and logos`

---

### Task 3: Style panel (Sonnet)

**Files:**

- Create: `components/ship-builder/ui/FunnelStylePanel.tsx`
- Create: `components/ship-builder/ui/__tests__/FunnelStylePanel.test.tsx`
- Modify: `components/ship-builder/ui/SelectionBar.tsx`. Add a "Style" button (lucide `Palette` icon) for funnel selections that toggles the panel.

**Interfaces:**

- Consumes (Task 1): `paintFunnels`, `setFunnelMark`, `isFunnelType`, `FUNNEL_AREAS`, `FUNNEL_LOGOS`, `normalizeMarkText`, `PAINT_COLORS`. From `PaintPanel.tsx`: `SWATCH_FILL`. From Task 2: `FUNNEL_LOGO_PATHS`, imported from `@/components/ship-builder/scene/funnelMarkTexture`. If that import drags three into the UI bundle, move the constant into `lib/ship-builder/model/funnelLogoPaths.ts` and import it from both places.
- Produces: `export default function FunnelStylePanel({ partId, onClose }: { partId: string; onClose: () => void })`

**Panel contents (copy is fixed):**

- Heading **"Funnel style"**, with a close button labelled "Close".
- Section **"Colours for every funnel"**, with three rows labelled **Body**, **Bands** and **Top**. Each row is a horizontally scrolling swatch row: a **"Default"** swatch (calls `paintFunnels(area, null)`), then every `PAINT_COLORS` swatch. The current swatch has `aria-pressed`. Reuse `SWATCH_FILL` and the ring style from `PaintPanel`. When the selected part is `funnel-modern`, the Bands row shows the note "Modern funnels have no bands".
- Section **"This funnel"**, with a three-button segmented control: **None**, **Letters**, **Logo**.
  - **Letters:** a text input labelled "Letters", `maxLength={2}`, `autoCapitalize="characters"`. Every change runs through `normalizeMarkText`. An empty value calls `setFunnelMark(id, null)`; otherwise it calls `setFunnelMark(id, { kind: "letters", text, color })`. Below it is a **"Letter colour"** swatch row (default `white`).
  - **Logo:** a grid of buttons, one per `FUNNEL_LOGOS` entry, each showing an inline `<svg viewBox="0 0 24 24"><path d=…/></svg>`, with `aria-label` set to the logo name. Below it is a **"Logo colour"** swatch row (default `white`).
  - **None** calls `setFunnelMark(id, null)`.
- Placement: above the `SelectionBar`, centred, `max-w-sm`, `max-h-[60vh] overflow-y-auto`, using `panelClass` from `styles.ts`. Escape and Close call `onClose`. It closes itself when the selection changes or a trial starts. `SelectionBar` already unmounts when there's no selection, so render the panel from `SelectionBar`.

- [ ] **Step 1: Write failing RTL tests** in `FunnelStylePanel.test.tsx`. Seed the store with a ship that has one `funnel` and one `funnel-modern`, as other ui tests do.
  - Clicking Body → "Red" calls through: the store's `ship.funnelPaint.body === "red"`.
  - Clicking Letters, then typing `"w$s"`, gives the input the value `"WS"` and the part `mark` `{ kind: "letters", text: "WS", color: "white" }`.
  - Clearing the input removes `mark`.
  - Clicking Logo → "Anchor" sets `mark.logo === "anchor"`. Clicking None removes `mark`.
  - For the `funnel-modern` part, the text "Modern funnels have no bands" is shown.
  - Pressing Escape calls `onClose`.
  - `SelectionBar` shows a "Style" button for a funnel selection and none for a mast selection.
- [ ] **Step 2: Run** `npm test -- --testPathPatterns="FunnelStylePanel|SelectionBar"`. Expected: FAIL.
- [ ] **Step 3: Implement the panel and the `SelectionBar` button.**
- [ ] **Step 4: Run** the same tests, plus `npm run lint` and `npm run type-check`. Expected: pass.
- [ ] **Step 5: Commit** `feat(ship-builder): Style panel for funnel colours, letters and logos`

**→ Dispatch one combined spec and quality review (Sonnet) covering Tasks 1–3 now.** Fix Critical and Important findings. Fold Minor findings into Task 4.

---

### Task 4: Period liveries, release, ship-time checks (Haiku)

**Files:**

- Modify: `lib/ship-builder/templates/liner.ts`. Add `funnelPaint?: FunnelPaint` to the template spec and copy it onto the ship.
  - Titanic, Olympic and Britannic: `{ body: "buff", bands: "buff", top: "black" }`. White Star has no visible bands, so the bands match the body.
  - Lusitania and Carpathia: `{ body: "red", bands: "black", top: "black" }` (Cunard).
- Modify: `lib/ship-builder/templates/cruise.ts`. Give the cruise template's funnel(s) `mark: { kind: "logo", logo: "wave", color: "navy" }`, plus a `funnelPaint` that looks good on white (the implementer's choice from `PAINT_COLORS`).
- Modify: `lib/ship-builder/version.ts` (`"2.17.0"`) and the top of `lib/ship-builder/changelog.ts`.

- [ ] **Step 1: Make the template edits.** Then run `UPDATE_FIXTURES=1 npx jest fixtures` and `npm test -- --testPathPatterns="fixtures|templates"`. Expected: pass. The fixture diff touches only `templates/` and expectations.
- [ ] **Step 2: Bump the version and add the changelog entry.** Date `2026-10-25`, title "Funnel colours, letters and logos". Highlights in plain words, for example:
  - "Tap a funnel and press Style to paint its body, bands and top"
  - "Every funnel on your ship wears the same colours, just like real ships"
  - "Put one or two letters, or a logo like a star or an anchor, on each funnel"
  - "Titanic and her sisters now have their buff and black funnels, and Lusitania and Carpathia have Cunard red"
- [ ] **Step 3: Run ship-time checks once.** Run `npm run validate`, then `npm run test:e2e -- --project=chromium e2e/ship-builder.spec.ts e2e/ship-builder-visual.spec.ts`. The visual snapshots of templates will change on purpose. The baselines are Linux-only, from CI (memory `visual-baselines-from-ci`), so don't regenerate them locally. Note the expected diffs in the PR instead.
- [ ] **Step 4: Commit** `chore(ship-builder): release 2.17.0 — funnel colours, letters and logos`
