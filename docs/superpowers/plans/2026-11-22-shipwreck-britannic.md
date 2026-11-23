# Shipwreck — HMHS Britannic — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HMHS Britannic (21 November 1916, Kea Channel) as a fully playable ship in Shipwreck: real morning, What if, Walk the decks; integrated later by the parent into 1.4.0 with RMS Carpathia.

**Architecture:** The ship format (`lib/shipwreck/ships/`) is the single source of truth the sim, model, X-ray, diagram, walk map and scene read; the Lusitania and Fitzgerald work made every place read the chosen ship. This plan widens the format for what the Britannic needs (a mine cause, watertight doors between compartments, a speed profile with a turn, forward speed's dynamic head, engines-stopped and doors-closed options, a shelter she can reach), adds her data, a recipe built on the Titanic's, a morning scene off Kea, sound, a walk map and the analytics value.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, React Three Fiber / three.js r186, zustand, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-shipwreck-britannic-design.md` (read it first; its north-star goals are re-read at the start of every task). The 1.0, Lusitania, walk and Fitzgerald specs and plans (`docs/superpowers/{specs,plans}/2026-11-2[01]-shipwreck*.md`) still hold where this plan is silent.

## Global Constraints

- Everything in the earlier Shipwreck plans' Global Constraints applies: Prettier, `export default function`, `interface` props, Tailwind only, Safari 15.0 floor via `lib/game-kit/compat.ts` (no `Object.hasOwn`, no `.at()`, no `structuredClone`), static export, no people shown, pure deterministic sim (no `Math.random`), ship-frame coordinates (`x` forward, `y` port, `z` up from keel), budgets ≤ 160 draw calls, ≤ 450k triangles at the top tier, no frame blocked > 8 ms.
- Worktree `/Users/griggen/.t3/worktrees/gentryriggen.com/t3-01b5a33f-27a75bcd3626a4fc`, branch `feat/shipwreck-britannic` off `origin/main` c6fed161. Commit on it. **Never push, open PRs or merge.** Use `npx next build --webpack` / `npx next dev --webpack` if Turbopack complains.
- **No other ship changes.** `titanicGolden.test.ts`, `lusitaniaGolden.test.ts` and the new `fitzgeraldGolden.test.ts` (Task 1) pass after every task; the Titanic and Lusitania recipe snapshots stay deep-equal; `e2e/perf-budget.json` changes only by added Britannic entries.
- **Do not bump `SHIPWRECK_VERSION` or edit `lib/shipwreck/changelog.ts`** (the parent integrates 1.4.0). The draft changelog entry lives at the end of the spec.
- **Shared files: minimal, additive edits** (they merge with `feat/shipwreck-carpathia`): `ShipId` union and `SHIP_IDS` append `"britannic"` after `"fitzgerald"`; `cause` union appends `"mine"`; analytics enum/rules lists append `'britannic'`; title-screen `COMING` loses "Britannic" and her card becomes real; e2e helpers gain cases, never reshaped. No reformatting or reordering of shared code.
- Ship id `"britannic"`; Titanic stays the default ship.
- Save key stays `shipwreck:v1`; new fields optional, parsed with defaults (no reset, no new key). Tests that use `"britannic"` as an unknown ship id switch to `"andrea-doria"`.
- Conventional commits `feat(shipwreck): ...` / `fix(shipwreck): ...`, with the trailer `Assisted-by: Claude` (as every commit on main). Run `npm run lint`, `npm run type-check` and the touched tests each task; `npm test` at the end of each task. Full e2e only in Task 9 (and after Task 6 for the perf spec).
- Screenshots (PNG) to `/Users/griggen/.t3/worktrees/gentryriggen.com/t3-01b5a33f-27a75bcd3626a4fc/.screenshots/britannic-task-<N>/` (gitignored: check `.gitignore`, add `.screenshots/` only if missing), listed by absolute path in the report.
- Sources: cite every Britannic figure (dimensions, bulkheads, double skin, deck heights, door, portholes, load, times, speeds, depth) in `lib/shipwreck/sim/README.md` and every visible feature (livery, davits, funnels, masts, screens, bridge number, boats) in `components/shipwreck/model/README.md`, with the source keys of the spec ([CH], [WP], …). Where sources disagree, pick one and say why.
- Kindness: no voices, no blame, captions never mention deaths or the propeller incident.
- Every report ends with a "Slowdowns" line and the screenshot list.

## Review Focus

1. **Another ship regresses through shared code** (a new field `undefined` for them still changes a path: the dynamic head, the yaw, door flow, the speed profile): pinned by the three golden tests (Task 1) and the perf budget (Task 9).
2. **A What-if Britannic run that never settles** (doors closed + portholes shut while still running for Kea; a mine under the double skin; every toggle off): ends inside `endT` with an outcome, finite poses, a sensible end card. Pinned by Task 2's matrix and Task 4's end-card test.
3. **Yaw everywhere downstream**: a turning ship's earth pose must stay right for the camera, wake, boats, X-ray, walk camera and the descent (`descent.ts` already integrates yaw). Pinned in Task 1 (`turn.test.ts`) and Task 6 (camera math with yaw).
4. **The 120 m floor with a ship on her side**: no camera through the floor, the stern visible above water while the bow is grounded, funnels lying beside her, the bent bow not poking through the floor. Pinned in Task 6 (camera math) and Task 3 (bent-bow bounds).
5. **Switching ships** (title → Britannic → title → Titanic → Lusitania): the right model, scene (no iceberg, Kea coast only for her), What-if editor and its toggles, walk map; old models disposed. Pinned in Task 4 (unit) and Task 9 (e2e).

---

## Task 1: Widen the ship format and the sim (no new ship yet)

Everything the Britannic needs from the physics, proven on test ships, every other ship unchanged.

**Files:**

- Create: `lib/shipwreck/sim/__tests__/fitzgeraldGolden.test.ts` (+ fixtures, per-arch as `lusitaniaGolden` does), `lib/shipwreck/sim/__tests__/doors.test.ts`, `lib/shipwreck/sim/__tests__/speedProfile.test.ts`, `lib/shipwreck/sim/__tests__/turn.test.ts`, `lib/shipwreck/sim/__tests__/ramHead.test.ts`
- Modify: `lib/shipwreck/ships/types.ts`, `lib/shipwreck/sim/{headway,flooding,run,body,constants}.ts` as needed, `lib/shipwreck/sim/__tests__/testShips.ts`, `lib/shipwreck/sim/README.md`

**Interfaces (Produces):**

```ts
// types.ts (additive)
cause: "iceberg" | "torpedo" | "storm" | "mine";

/** A watertight door (or other opening) in the transverse bulkhead between
 *  two neighbouring compartments; orifice flow on the head difference. */
export interface BulkheadDoor {
  id: string;
  aftId: string; // compartment ids, neighbours
  fwdId: string;
  x: number;
  zLow: number;
  zHigh: number;
  areaM2: number;
  /** "door": a watertight door (SimOptions.doorsClosed shuts it);
   *  "damage": a bulkhead torn by the blast (never shuts). */
  kind: "door" | "damage";
}
// ShipSpec:
doors?: readonly BulkheadDoor[];
headway?: {
  startMs: number;
  halfLifeS?: number;
  /** [shown s, m/s] pairs, t ascending, linear, held past the ends;
   *  overrides startMs/halfLifeS while she is afloat. */
  profile?: readonly (readonly [t: number, ms: number])[];
  /** [shown s, yaw deg] pairs (+ to port, i.e. a turn to starboard is −),
   *  linear; the heading her way carries her along. */
  turn?: readonly (readonly [t: number, yawDeg: number])[];
  /** Dynamic head factor Cp on hull openings and porthole rows with
   *  x ≥ fromX: head += Cp·u²/2g. */
  ram?: { cp: number; fromX: number };
};

// SimOptions (additive):
/** Every `kind: "door"` door shut (default false). */
doorsClosed?: boolean;
/** Engines stopped at the first event: no profile, no turn; she coasts
 *  with HEADWAY_STOP_HALF_LIFE_S (default false). */
enginesStopped?: boolean;
```

`headwayRun` keeps its signature; add `headingAt(h, t, opts): number` (radians) and `speedAt(h, t, opts): number` exported from `headway.ts`.

- [ ] **Step 1: Fitzgerald golden first.** Before touching the sim, write `fitzgeraldGolden.test.ts` mirroring `lusitaniaGolden.test.ts` (real run + one What-if: hatches tight), fixtures written by `UPDATE_GOLDEN=1` from the unchanged code. Run titanic/lusitania/fitzgerald golden: PASS. Commit (`test(shipwreck): pin the Fitzgerald's track`).
- [ ] **Step 2: Failing tests** on box test ships (`testShips.ts` gains a three-compartment ship):
  - `doors.test.ts`: `"an open door fills the next compartment"` (flood A, door A→B at the bottom, `areaM2: 0.05`: B has water at 300 s, less than A); `"doorsClosed shuts doors"` (B stays dry, `< 0.01`); `"damage never shuts"` (`kind: "damage"` with `doorsClosed: true`: B still fills); `"no doors, no change"` (spec without `doors` gives the same track as before to 1e-12).
  - `speedProfile.test.ts`: profile `[[0,10],[600,10],[700,0],[900,4],[1000,0]]`: earth distance by 600 s = 6,000 m ± 1 %, speed at 650 s = 5 ± 0.1; `enginesStopped: true` → distance follows the stop half-life; no `profile` → `headwayRun` unchanged (existing headway tests still pass).
  - `turn.test.ts`: turn `[[0,0],[300,-40]]` with 10 m/s: earth heading at 400 s = −40° ± 0.5, the track bends to starboard (earth y < 0 at 400 s), pitch/roll/flooding identical to the no-turn run to 1e-9 (yaw changes no physics), `enginesStopped` → yaw stays 0.
  - `ramHead.test.ts`: a bow opening on a box ship with `ram: { cp: 0.8, fromX }` at 10 m/s floods faster than at 0 m/s, by the ratio the orifice law gives (√((h+Cp·u²/2g)/h) ± 5 % early on); an opening aft of `fromX` is unchanged; `enginesStopped` removes the gain once she has lost way.
- [ ] **Step 3: Implement** until PASS: door flow as a fore-and-aft analogue of `crossFlowM2` (orifice both ways on the head difference, using the door's z range); the speed profile and turn integrated in earth x/y and applied to every body's yaw while afloat (after she goes under, the existing descent yaw takes over from the last heading); the ram term in the head of qualifying hull openings and porthole rows; `HEADWAY_STOP_HALF_LIFE_S` in `constants.ts` (a 53,000 t liner losing way: document the value, ~90–180 s). Run all sim tests and the three golden tests: PASS.
- [ ] **Step 4: README**: doors, speed profile, turn, ram head, each with its formula and constant.
- [ ] **Step 5: Commit** (`feat(shipwreck): watertight doors, a speed profile, a turn and ram head in the sim`).

## Task 2: The Britannic's data and the real morning

**Files:**

- Create: `lib/shipwreck/ships/britannic.ts`, `lib/shipwreck/sim/__tests__/britannic.test.ts`, `lib/shipwreck/sim/__tests__/realMorning.test.ts`
- Modify: `lib/shipwreck/ships/types.ts` (`ShipId` += `"britannic"`), `lib/shipwreck/ships/index.ts` (append to `SHIP_IDS` and `SHIPS`, export `BRITANNIC_BOATS`, `BRITANNIC_DECKS`, `type BritannicBoat`), `lib/shipwreck/sim/run.ts` (`whatIfSpots`/`whatIfOpenings` for `"mine"`: reuse the torpedo path), `lib/shipwreck/sim/README.md`, `scripts/shipwreck-sim.ts` (`--ship=britannic`, `--doors-closed`, `--engines-stopped`), `jest.sims.js` if a new file runs > 45 s
- Every `Record<ShipId, …>` the type-check flags gets a **placeholder Britannic entry that later tasks replace** (say so in a `// Task N` comment), so each commit compiles.

**Interfaces:**

- Consumes: Task 1's format.
- Produces: `britannic: ShipSpec` (`cause: "mine"`, `clockStartS: 8*3600 + 12*60`, `seaDepthM: 120`, `wreck` to starboard, `doors`, `portholes`, `headway` with `profile`/`turn`/`ram`, `shelter` (spec R18), 48 boats in `BRITANNIC_BOATS` with `{ index, side, x, kind: "gantry" | "welin" }`, `BRITANNIC_DECKS`, inner-skin wing cells along the boiler and engine rooms on both sides).

- [ ] **Step 1: Data tests first** (`britannic.test.ts`): LOA 269.1 ± 0.3, LBP = Titanic's ± 0.01, beam 28.65 ± 0.05 (extreme) and every station's half-breadth = Titanic's × (beam ratio) ± 1 %; ≥ 41 stations aft to forward; hydrostatic displacement at her draught within 2 % of `displacementT`; upright GM positive and plausible (0.5–3 m); the raised bulkheads' tops at B deck height (R3); inner-skin wing cells mirror port/starboard; four funnels, the fourth `dummy: true`; 48 boats, gantry boats only at the five R5 sets; porthole rows inside the hull at deck heights; `doors` neighbours exist and lie on a bulkhead x.
- [ ] **Step 2: Write `britannic.ts`** from Titanic's data (import Titanic's offsets and scale breadth; copy, don't edit, Titanic's arrays) and the cited sources. PASS.
- [ ] **Step 3: The real morning, failing tests** (`realMorning.test.ts`, `simulate(britannic, britannic.realNight)`): exactly the spec's pass criteria (explosion t ≈ 0; list to starboard ≥ 3° by 900 s, max before `bow-lands` 8°–30°; bow down from 300 s; forward E-deck porthole row under between 600 and 1,320 s; `bow-lands` before `stern-under` with a stern point above z = 0 at that frame; `sankAtT` 2,700–3,900 s; no `breakup`; resting roll to starboard ≥ 60°; `funnel-falls` for every working funnel, at increasing t; finite poses; ends inside `endT`).
  - What-if matrix (multi-select): real spots × {portholesOpen, doorsClosed, enginesStopped} all 8 combinations: every run ends with an outcome inside `endT`, finite poses; all three fixed → `floating-steady` or `sheltered`; each one fixed alone → `sankAtT` later than the real run's or floats; a single mine on a boiler room's inner-skin cell → floats.
- [ ] **Step 4: Calibrate** inside honest ranges (hole area, damage areas, door area, porthole open area, Cp, the R9 profile, the R10 turn) until PASS; log each tuned value and its reasoning in the README; report the max list and E-deck porthole time. Golden tests still PASS.
- [ ] **Step 5: Commit** (`feat(shipwreck): HMHS Britannic's data and the real morning`).

## Task 2b: Her list comes from the flooding (added after drift audit 1)

The midway audit found her starboard list and capsize were set by an assumed `tcg: -0.02` (README: "0: she never rolls"), the list tests passed on the initial heel at t = 0, and she rights herself from 1.9° to 0.4° while history says "a serious list" (spec R21).

**Files:** Modify `lib/shipwreck/ships/britannic.ts` (between-deck starboard cells and their feeds), `lib/shipwreck/sim/run.ts` / `flooding.ts` only if the existing `span` cells, `crossFlowM2` and porthole `inboard` routing cannot express it (additive, gated), `lib/shipwreck/sim/__tests__/realMorning.test.ts`, `lib/shipwreck/sim/README.md`, `lib/shipwreck/story.ts` + `components/shipwreck/ui/EndCard.tsx` (+ tests) for the Run-for-Kea lesson line.

- [ ] **Step 1: Failing tests** (`realMorning.test.ts`): every list assertion measures the list the flooding adds (frame `listDeg` minus the t = 0 frame's); added list to starboard ≥ 2° by 8:30 and growing (non-decreasing within 0.5° slack) to 8:55; max before `bow-lands` 8°–30°; with `tcg` set to 0 she still lists and capsizes to starboard; with the starboard portholes shut (`portholesOpen: false`) the added list at 8:45 is less than half the real run's; a What-if that freezes as `floating-steady` has |roll rate| < 1e-4 rad/s over its last 60 s (bounds `STEADY_MINE_ROLL_RADS`).
- [ ] **Step 2: Implement** with the existing format: starboard between-deck cells (span starboard, E deck and below in the flooded forward spaces, inboard y from her deck layout: the wards/cabins' longitudinal partitions) fed by the starboard damage and starboard porthole rows, joined to the full-breadth spaces by `crossFlowM2` (stated range); `tcg` 0 unless a source gives one. Recalibrate inside honest ranges; the spec's pass criteria (sank 45–65 min, bow-lands before stern-under, no breakup, rest ≥ 60° starboard) still hold; report the new What-if matrix. Three golden tests unchanged.
- [ ] **Step 3: Run-for-Kea lesson**: when the run's options differ from the real morning only by `enginesStopped` and she sinks within 2 min of the real time, the end card adds one line: "Stopping her engines changed little. Her open portholes and the door that did not shut mattered most." (test).
- [ ] **Step 4: README** (the cells, cross-flow value, why, the new numbers) and **commit** (`feat(shipwreck): the Britannic lists as her starboard decks flood`).

## Task 3: The Britannic model

**Files:**

- Create: `components/shipwreck/model/britannicRecipe.ts`, `components/shipwreck/model/__tests__/britannicRecipe.test.ts`
- Modify: `components/shipwreck/model/shipModel.ts` (`recipeFor` dispatch), `buildShip.ts` / `materials.ts` / `textures.ts` / `partGeometry.ts` / `hullSurface.ts` only where a Titanic constant must become a recipe field (hull band and crosses, gantry davit part, bridge number text), `ModelViewer.tsx` (`?model&ship=britannic`), `scripts/shipwreck-model-shots.mjs`, `components/shipwreck/model/README.md`, `components/shipwreck/scene/ShipRig.tsx` (the bent bow on a hard bow landing, R12)

**Interfaces:**

- Consumes: `britannic`, `BRITANNIC_DECKS`, `BRITANNIC_BOATS` (Task 2).
- Produces: `britannicRecipe(spec: ShipSpec): ShipRecipe`; any new recipe fields optional (Titanic/Lusitania/Fitzgerald recipes deep-equal their snapshots); `bowBend(t: number, landedAt: number | null): number` (radians, 0 until a hard landing, easing to the rest bend) exported from `components/shipwreck/model/pose.ts` or a new `bowBend.ts`.

- [ ] **Step 1: Research the look** from photographs (Wikimedia Commons "Britannic (ship, 1915)", Atlantic Liners captions, Chirnside) and write the model README section: hull band height and the three crosses' positions per side, boat-deck crosses, funnels and masts paint, the five gantry sets and the Welin davits (R5, photographs win), the forward A/B deck screens and windows, bridge front "G.618", name at the bow, anything else that differs from the Titanic recipe.
- [ ] **Step 2: Failing tests**: placements inside the hull's bounds; four funnels (fourth dummy, no smoke); five gantry sets at R5 positions, boats and davits match `BRITANNIC_BOATS`; three propellers, one rudder; porthole rows match `britannic.portholes` (open rows drawn as open); the hull band and crosses present on both sides; other ships' recipe snapshots deep-equal; `bowBend` 0 before landing, monotonic to its rest value, never bends the bow below the floor plane in the test pose.
- [ ] **Step 3: Write the recipe** from the Titanic's (call its builders, override parts; no copy-paste of Titanic geometry code) and the bent-bow rule. PASS.
- [ ] **Step 4: Budget and look**: at `high` ≤ 95 draw calls and ≤ 320k triangles (`handles.stats`), build time ≤ Titanic's + 20 %. Model-viewer screenshots (chromium 1133×744): bow 3/4 starboard, bow 3/4 port, stern 3/4 (props, rudder), side profile, top-down, close on the gantry davits, the bridge front, the bent bow pose; plus Titanic bow 3/4 to show it unchanged.
- [ ] **Step 5: Commit** (`feat(shipwreck): the Britannic model in her hospital ship colours`).

## Task 3b: Her intended White Star liner paint (second livery, added at Gentry's request)

Gentry wants every ship to have a live toggle (a big picture button that works mid-game) between its default paint and its original paint. The Carpathia branch builds the shared toggle (ShipSpec liveries list, HUD button, save field); the parent wires the Britannic in at integration. This task makes her model support a second livery and swap it at runtime; it does **not** build the HUD toggle, save field or liveries list.

**Files:** Modify `lib/shipwreck/ships/britannic.ts` (`BRITANNIC_PAINT`, `BRITANNIC_FUNNEL_PAINTS`), `components/shipwreck/model/britannicRecipe.ts`, `components/shipwreck/model/shipModel.ts` / `buildShip.ts` / `materials.ts` / `textures.ts` (only the minimal, additive hooks the swap needs), `components/shipwreck/model/ModelViewer.tsx` (`?model&ship=britannic&paint=liner`), `components/shipwreck/model/README.md`, `components/shipwreck/model/__tests__/britannicRecipe.test.ts`.

**Interfaces (Produces):**

```ts
// lib/shipwreck/ships/britannic.ts — mirrors the Carpathia branch's CARPATHIA_PAINT
export const BRITANNIC_PAINT: "hospital" | "liner" = "hospital";
export const BRITANNIC_FUNNEL_PAINTS: Record<"hospital" | "liner", { funnel: number; top: number }>;
// britannicRecipe.ts
export type BritannicPaint = "hospital" | "liner";
export function britannicRecipe(spec: ShipSpec, look: BritannicPaint = BRITANNIC_PAINT): ShipRecipe;
// built model handles (buildShip): swap paint in place, no geometry rebuilt
setPaint?(look: string): void; // no-op for ships with one livery
```

- [ ] **Step 1: Research and cite** (model README): her intended White Star liner colours as Harland & Wolff and White Star would have finished her, with the Olympic (1911–1914) as the reference: black hull, white superstructure, a gold/yellow sheer line (cove line), red boot-topping (anti-fouling) up to the load line, buff funnels with black tops, buff masts, the name "BRITANNIC" and "LIVERPOOL" in white/gold as on her sisters, no green band, no crosses, no "G.618". Note plainly that she never sailed as a liner (completed as a hospital ship, December 1915). Cite sources (Chirnside, Olympic photographs on Wikimedia Commons, White Star livery references); say where sources disagree.
- [ ] **Step 2: Failing tests**: `britannicRecipe(britannic)` deep-equals the current hospital recipe (snapshot taken before any change); `britannicRecipe(britannic, "liner")` has no band, no crosses, no bridge number, a black hull above the boot-top, a sheer line, black-topped funnels; `setPaint("liner")` then `setPaint("hospital")` on a built model leaves every mesh's `geometry` object identical (same references) and restores the hospital materials' colours exactly; other ships' recipe snapshots unchanged; `setPaint` on a one-livery ship is a no-op.
- [ ] **Step 3: Implement** as a recipe/material parameter: both looks' materials or uniforms prepared once, swapped by `setPaint` (colours, band/cross uniforms, name and number textures), no geometry rebuilt; `recipeFor(spec, paint?)` keyed like the Carpathia branch's `byPaint` cache only if needed for the initial build. Measure: the swap takes < 4 ms on the Britannic perf scenes (report), and draw calls/triangles are identical in both looks.
- [ ] **Step 4: Screenshots** of her in liner colours (model viewer bow 3/4 starboard, side profile, stern 3/4; one scene shot if Task 6 has landed), copied to the shared folder per the screenshot rule.
- [ ] **Step 5: Commit** (`feat(shipwreck): the Britannic in her intended White Star colours`).

## Task 4: Choosing her, her story, her places, What if

**Files:**

- Modify: `components/shipwreck/ui/TitleScreen.tsx` (real Britannic card, `COMING` empties), `components/shipwreck/ui/{WhatIfEditor,HullDiagram,EndCard,Captions,NightPanels,Hud}.tsx` as needed, `components/shipwreck/ui/Icon.tsx` (porthole, door, engine picture icons), `lib/shipwreck/{story,places,help,whatIf,save,playback,xray,testHooks}.ts`, `components/shipwreck/parentLine.ts`, `components/shipwreck/Shipwreck.tsx`
- Tests: `lib/shipwreck/__tests__/{story,save,help,xray,playback,analytics}.test.ts` (switch the unknown-ship example to `"andrea-doria"`), new `lib/shipwreck/__tests__/britannicStory.test.ts`, `components/shipwreck/__tests__/Shipwreck.test.tsx`, `components/shipwreck/ui/__tests__/{TitleScreen,WhatIfEditor,EndCard}.test.tsx`

**Interfaces:**

- Consumes: `SHIPS`, `britannic`, `whatIfSpots` (Task 2).
- Produces: save `ShipWhatIf` gains `doorsClosed?: boolean; enginesStopped?: boolean`; playback passes them to `simulate` as `SimOptions.doorsClosed` / `enginesStopped`; `PARENT_LINES.britannic` (spec's exact copy); `PLACES_BY_SHIP.britannic`; `spotAria` for `"mine"` ("Hold 2: a mine hits here" / "no mine").

- [ ] **Step 1: Failing tests**:
  - story: every `SimEventKind` has a Britannic caption or explicit null; the 1.0 word-list test (no deaths, no people in danger) covers her; `sinceText(720, britannic)` = `"12 min after the mine"`; `clockText(0, britannic.clockStartS)` = `"8:12 AM"`; a caption at the 09:00 whistle ("Two long blasts on her whistle.") and none for the propeller incident.
  - save: `whatIfByShip.britannic` round-trips `{ ids, portholesOpen, doorsClosed, enginesStopped }`; an old save without them defaults to the real morning; unknown ship `"andrea-doria"` is dropped.
  - places: bridge, hold 2 (the mine), boiler room 6, the E-deck portholes forward, a gantry davit, the turbine engine room: inside her hull, compartments exist.
  - WhatIfEditor for a mine ship: starboard spots (multi-select) plus three picture toggles (testids `whatif-portholes`, `whatif-doors`, `whatif-engines`), each with an aria label and a help line; Titanic, Lusitania and Fitzgerald editors unchanged (their existing tests).
  - EndCard: `sheltered` reads "She reached Kea." and `floating-steady` "She stayed afloat."; the real morning ends "She sank at 9:07 AM, 55 minutes after the mine."
  - Shipwreck: title → Britannic → back → Titanic builds the right model and disposes the other (spy on `dispose`).
- [ ] **Step 2: Implement** until PASS.
- [ ] **Step 3: Screenshots**: title screen with five cards (four if Carpathia is not on this branch: Britannic last), the Britannic HUD at 8:30, the X-ray with the forward compartments and boiler room 5 filling, the What-if editor, the end card.
- [ ] **Step 4: Commit** (`feat(shipwreck): choose the Britannic`).

## Task 5: Analytics `ship` value (data boundary: spec review + adversarial review)

**Files:** `lib/shipwreck/analytics.ts` (if it lists ships), `lib/analytics/gameEvents.ts`, `firestore.rules` (both `p.ship in [...]` lists), `firestore-tests/gameEvents.test.ts`, `lib/analytics/gameAggregate.ts` and `components/admin/GamesView.tsx` (+ tests) only if they list ships, `lib/shipwreck/__tests__/analytics.test.ts`

- [ ] **Step 1: Failing tests**: `shipwreck_start` / `shipwreck_end` accept `ship: "britannic"` in the schema and the rules (both events); rules still reject `"andrea-doria"`, a number and an extra prop; the dashboard shows Britannic's starts and ends; existing values unchanged. No new props (the What-if toggles are not counted).
- [ ] **Step 2: Implement** schema, rules and dashboard together, appending only. `npm run test:rules` (Java 21+; report verbatim if it cannot run).
- [ ] **Step 3: Commit** (`feat(shipwreck): count Britannic runs`).

## Task 6: The morning scene off Kea

**Files:**

- Modify: `components/shipwreck/scene/settings.ts` (`timeOfDay` += `"morning"`, `britannic` entry, `BRITANNIC_HEADING_DEG`, sun for 37.7° N 24.3° E at 08:12 EET 21 Nov 1916), `Sky.tsx`, `Sea.tsx`, `Environment.tsx`, `Coast.tsx` (per-ship coastline: Kea's hills and Port St Nikolo bay; Attica/Makronisos low to port), `Effects.tsx` / `afternoonEffects.ts` (the mine's water column and spray at the starboard bow at t = 0, smoke from three funnels thinning with speed), `Torpedo.tsx` only to skip for mines, `CameraRig.tsx` / `cameraMath.ts` (120 m floor, yawed ship), `ShipRig.tsx` (yaw from the track, boats leaving from the davits, curving wake), `Wreckage.tsx` (fallen funnels beside her if not already from the sim), `components/shipwreck/scene/README.md`, `e2e/perf.spec.ts` + `e2e/perf-budget.json` (three Britannic scenes)
- Tests: `components/shipwreck/scene/__tests__/{settings,cameraMath,afternoonEffects}.test.ts`

**Interfaces:**

- Consumes: track yaw (Task 1), `britannic` (Task 2), recipe and `bowBend` (Task 3).
- Produces: `SCENE_SETTINGS.britannic` (`timeOfDay: "morning"`, `sun`, `fog`, `underwaterFog`, `coast: true`, `iceberg: false`, `headingDeg`).

- [ ] **Step 1: Failing tests**: settings for the other ships unchanged (deep-equal to current values); Britannic sun elevation 5°–15°, azimuth 110°–135° (computed, cited); camera clamps above the 120 m floor and never inside the hull lying on its side, with a yawed pose; the mine effect fires once at the explosion event and is not a torpedo streak.
- [ ] **Step 2: Build** the morning: low warm sun, long reflections, deep-blue calm sea, Kea and Attica coasts, the mine's column, curving wake, smoke thinning, boats leaving, clear blue underwater with light shafts, pale floor.
- [ ] **Step 3: Budgets**: three Britannic scenes in the perf spec (the blast, 8:40 listing with boats out, bow grounded with stern up) via `PERF_UPDATE=1 npx playwright test e2e/perf.spec.ts --project=chromium`; check every existing entry is unchanged in the diff.
- [ ] **Step 4: Screenshots** (1133×744 and 744×1133): the blast, the turn toward Kea, the list with boats, bow on the floor with stern up (above and below water), her on her side on the floor, Titanic 11:45 PM unchanged.
- [ ] **Step 5: Commit** (`feat(shipwreck): a November morning in the Kea Channel`).

## Task 7: Sound for the morning (DEFERRED: MVP cut, see the spec's Later)

**Files:** `components/shipwreck/audio/{beds,cues,voices,useShipwreckSound}.ts(x)` and tests.

- [ ] **Step 1: Failing tests**: Britannic gets a morning bed (calm sea, gulls, engines that follow her speed profile), a mine cue (deeper and shorter than the torpedo's), two long whistle blasts at the 09:00 event, funnel falls; no rocket cue; other ships' mappings unchanged; the no-voice guard covers her.
- [ ] **Step 2: Implement** (procedural Web Audio like the others). PASS.
- [ ] **Step 3: Commit** (`feat(shipwreck): the Britannic's morning sounds`).

## Task 8: Walk the decks on her (DEFERRED: MVP cut, see the spec's Later)

**Files:** Create `lib/shipwreck/walk/britannicDecks.ts`; modify `lib/shipwreck/walk/index.ts` (append `britannic`), `lib/shipwreck/walk/__tests__/maps.test.ts`, `e2e/shipwreck-walk.spec.ts` (a Britannic case), `lib/shipwreck/walk/README.md`.

- [ ] **Step 1: Failing tests**: `walkMapFor("britannic")` returns a map whose areas sit inside her deck edges at her beam; gantry davits, boats, houses and funnel casings are blockers where the recipe draws them (shared constants, not copied numbers); every area reachable by stairs from the boat deck; the existing maps tests pass for her.
- [ ] **Step 2: Implement** from `titanicDecks.ts` (import shared helpers; Britannic's own constants). PASS.
- [ ] **Step 3: Screenshot** walking her boat deck by a gantry davit.
- [ ] **Step 4: Commit** (`feat(shipwreck): walk the Britannic's decks`).

## Task 9: e2e, performance and full verification (no release)

**Files:** `e2e/shipwreck.spec.ts`, `e2e/shipwreck-offline.spec.ts`, `public/shipwreck-sw.js` (regenerated by its script only if precache lists change), the sim and model READMEs (final numbers).

- [ ] **Step 1: e2e**: `@smoke` pick Britannic → real morning → end card at ×100; What-if with all three toggles off → "She stayed afloat." or "She reached Kea."; switch back to Titanic and see the iceberg; offline start after one visit loads her.
- [ ] **Step 2: Full verification once**: `npm run validate`; `npx playwright test e2e/shipwreck*.spec.ts --project=chromium`; `@smoke` on webkit and iPad; `npx playwright test e2e/perf.spec.ts --project=chromium`; `npm run test:rules`. Record failures verbatim (known unrelated red tests on main: list them).
- [ ] **Step 3: Commit** (`test(shipwreck): the Britannic end to end`).
