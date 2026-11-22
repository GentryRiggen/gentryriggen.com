# Shipwreck 1.1 — the Lusitania — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RMS Lusitania (7 May 1915) as a second, fully playable ship in Shipwreck, released as 1.1.0.

**Architecture:** The ship format (`lib/shipwreck/ships/`) is already the single source of truth that the sim, model, X-ray and diagram read. This plan widens that format for what the Lusitania needs (wing bunkers, open portholes, timed openings, headway, a sea floor she reaches while still afloat, a daytime setting and a torpedo story), adds her data and a detail recipe, and makes every Titanic-only place in the game read the chosen ship.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, React Three Fiber / three.js r186, zustand, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-shipwreck-lusitania-design.md` (read it first; its north-star goals are re-read at the start of every task). The 1.0 spec `docs/superpowers/specs/2026-11-20-shipwreck-design.md` and plan `docs/superpowers/plans/2026-11-20-shipwreck.md` still hold where this plan is silent.

## Global Constraints

- Everything in the 1.0 plan's Global Constraints applies (Prettier, `export default function`, `interface` props, Tailwind only, Safari 15.0 floor via `lib/game-kit/compat.ts`, static export, no people shown, pure deterministic sim, coordinate frames, performance budgets: ≤ 160 draw calls, ≤ 450k triangles at the top tier, no frame blocked > 8 ms).
- Worktree `/Users/griggen/dev/code/personal/gr-shipwreck`, branch `feat/shipwreck-lusitania` off `origin/main`. Use `npx next build --webpack` / `npx next dev --webpack` if Turbopack complains.
- **The Titanic must not change.** The golden test from Task 1 (`lib/shipwreck/sim/__tests__/titanicGolden.test.ts`) must pass after every task.
- Ship ids: `"titanic" | "lusitania"`. Titanic stays the default.
- Release: `SHIPWRECK_VERSION` `1.1.0`, one new top changelog entry (Task 8). Do not bump earlier.
- Save key stays `shipwreck:v1`; new fields are optional and parsed with defaults (no reset, no new key).
- Conventional commits `feat(shipwreck): ...` / `fix(shipwreck): ...`. Run `npm run lint`, `npm run type-check` and the tests you touched each task, `npm test` at the end of each task. Full e2e only in Task 8.
- Screenshots to `/Users/griggen/dev/code/personal/gr-shipwreck/.screenshots/lusitania-task-<N>/`, listed in the report.
- Sources: cite every Lusitania figure (dimensions, bulkheads, bunkers, deck heights, boat count, times) in `lib/shipwreck/sim/README.md` (sim) or `components/shipwreck/model/README.md` (look). Where sources disagree, pick one, say which and why.

## Review Focus

1. **Titanic regression through shared code** (a default that is `undefined` for Titanic but changes a code path): the Titanic track, look and performance are unchanged. Pinned by Task 1's golden test and Task 8's perf budget.
2. **A What-if Lusitania run that never settles** (torpedo aft, portholes shut: she may float listing, or hit the floor and stay partly up): the run must end (`floating-steady` or rest) inside `endT`, the end card must make sense, and no NaN poses. Pinned in Task 2 (`whatIf` matrix test) and Task 4 (end card).
3. **Switching ships mid-session** (title → Lusitania → back to title → Titanic): the right model, scene, story, places and What-if editor; the old model disposed (no GPU leak, no Titanic iceberg in a daytime scene). Pinned in Task 4 (unit) and Task 8 (e2e).
4. **An old 1.0 save** (no `ship` field, `lastWhatIf` holding Titanic compartment ids): loads, defaults to Titanic, and Titanic ids never leak into a Lusitania What-if. Pinned in Task 4 (`save.test.ts`).
5. **Camera under the shallow sea and at the seabed** (93 m floor, ship lying across it, stern still out of the water): no camera through the floor, underwater fog colour right for daylight, the stern visible above water at the right moment. Pinned in Task 6 (camera math test) and Task 8 (perf/e2e scene).

---

## Task 1: Widen the ship format and the sim (no new ship yet)

Everything the Lusitania needs from the physics, built and proven on test ships, with the Titanic unchanged.

**Files:**

- Modify: `lib/shipwreck/ships/types.ts`, `lib/shipwreck/ships/titanic.ts` (only to add the new required fields with Titanic's values), `lib/shipwreck/sim/{geometry,hydrostatics,flooding,body,descent,events,run,track,constants}.ts` as needed, `lib/shipwreck/sim/README.md`
- Create: `lib/shipwreck/sim/__tests__/titanicGolden.test.ts`, `lib/shipwreck/sim/__tests__/fixtures/titanicGolden.json`, `lib/shipwreck/sim/__tests__/wingCells.test.ts`, `lib/shipwreck/sim/__tests__/seabed.test.ts`, `lib/shipwreck/sim/__tests__/testShips.ts` (box-hull test ships)

**Interfaces (Produces):**

```ts
export type ShipId = "titanic" | "lusitania";

export interface Compartment {
  // ...existing fields
  /** Transverse extent. Missing = the full breadth (the 1.0 behaviour).
   *  centre: |y| <= y; port: y >= y; starboard: y <= -y (y > 0, metres). */
  span?: { side: "centre" | "port" | "starboard"; y: number };
  /** Open area (m²) joining this cell to the cell(s) beside it across a
   *  longitudinal bulkhead at the same x (coal doors, leaks). Default 0. */
  crossFlowM2?: number;
}

export interface Opening {
  // ...existing fields
  /** Shown seconds after the first event when it opens (default 0). */
  t?: number;
}

/** A row of side scuttles (portholes) that lets water in once under. */
export interface PortholeRow {
  z: number;
  fromX: number;
  toX: number;
  side: "port" | "starboard";
  /** Open area per metre of row when the portholes are open (m²/m). */
  openM2PerM: number;
}

export interface ShipSpec {
  // ...existing fields
  /** Seconds after midnight of the first event (Titanic 23*3600+40*60). */
  clockStartS: number;
  /** What opened the hull: drives words, scene and What-if. */
  cause: "iceberg" | "torpedo";
  portholes?: readonly PortholeRow[];
  /** Forward speed at the first event and its decay (no propulsion model). */
  headway?: { startMs: number; halfLifeS: number };
}

export interface SimOptions {
  // ...existing
  /** Whether `spec.portholes` are open (default true). */
  portholesOpen?: boolean;
}
```

- `ScriptedEvent.kind` gains `"explosion"`; `SIM_EVENT_KINDS` gains `"explosion"` (story text in Task 4).
- `bow-lands` / `stern-lands` keep their meaning (first floor contact of that end) but may now fire while the body is still afloat. New `SimFrame.groundedParts: ("whole" | "bow" | "stern")[]` (empty while nothing touches).
- `story.ts`'s `CLOCK_START_S` stays exported for Titanic but `clockText(secondsAfter, startS = CLOCK_START_S)` gains the optional start (callers move in Task 4).

- [ ] **Step 1: Golden Titanic test.** Before touching the sim, write `titanicGolden.test.ts`: run `simulate(titanic, titanic.realNight)` and two What-if runs (`["hold1","br4"]`, the first five compartments) and compare against `fixtures/titanicGolden.json`: frame count, every event `{kind,t,realT,index}`, `outcome`, `sankAtT`, `brokeAtT`, `breakX`, and every 50th frame's poses, `water`, `listDeg`, `trimDeg` to 1e-9. Generate the fixture from the unchanged code (`UPDATE_GOLDEN=1` writes it). Run it: PASS. Commit.
- [ ] **Step 2: Wing cells, failing tests.** In `wingCells.test.ts`, with a 100 m box ship (`testShips.ts`) holding a centre cell and port and starboard wing cells over the same x range:
  - `"a starboard wing opening lists the ship to starboard"`: open the starboard wing only; at the end `listDeg > 5` (starboard is + per `track.ts`) and the port wing and centre stay dry (`water[...] < 0.01`).
  - `"cross flow fills the centre slowly"`: with `crossFlowM2: 0.05` the centre cell has water at the end and less than the wing.
  - `"wing and centre volumes add up to the full section"`: the volumes of the three cells at a level equal one full-breadth cell to 0.5 %.
  - `"porthole rows flood once under"`: with a starboard row at a height that goes under only past 10° list, inflow starts after the list passes it; with `portholesOpen: false` it never does.
  - `"a timed opening waits"`: an opening with `t: 30` lets no water in before 30 s.
- [ ] **Step 3: Implement** wing cells (clip each section polygon at the `span` plane before integrating), cross flow (orifice law between cells at the same x, both directions), porthole rows (orifice per metre of row under the sea, side aware), timed openings, `portholesOpen`. Run the tests: PASS; the golden test still PASSES.
- [ ] **Step 4: Seabed while afloat, failing tests.** In `seabed.test.ts`, a 200 m box ship flooded at the bow in a sea `seaDepthM: 60`:
  - `"the bow grounds while the stern still floats"`: a `bow-lands` event fires while `stern-under` has not; at that frame some stern point is above z = 0 and `groundedParts` holds `"whole"`.
  - `"nothing goes through the floor"`: every frame, no hull point below `-seaDepthM - ploughDepth` (expose the lowest point via the probe).
  - `"a grounded hull comes to rest"`: the run ends with `outcome` set, finite poses and `endT` ≤ the default.
  - `"a listed hull lies over on its low side"`: with a 20° starboard list at grounding, the resting `roll` is to starboard and larger than at grounding.
  - `"headway moves her forward and decays"`: with `headway: { startMs: 9, halfLifeS: 120 }` the body's earth x advances about `9 × 120 / ln 2` m (±10 %) over the run; Titanic (no headway) has x unchanged (the golden test).
- [ ] **Step 5: Implement** floor contact for a floating body: a stiff, well-damped normal force plus friction at hull points below `-seaDepthM` (reuse `descent.ts`'s plough depth idea), so the stem can ground and the hull pivots about it under buoyancy and weight; the sinking-body descent keeps working when the floor is reached later. Headway: integrate a kinematic forward speed into the earth x of every body's pose (no effect on flooding). Run all sim tests and the golden test: PASS.
- [ ] **Step 6: README.** Document the new cells, cross flow, portholes, timed openings, grounding and headway, each with its formula and tuned value in `constants.ts`.
- [ ] **Step 7: Commit** (`feat(shipwreck): wing bunkers, portholes, timed openings and grounding in the sim`).

## Task 2: The Lusitania's data and her afternoon

**Files:**

- Create: `lib/shipwreck/ships/lusitania.ts`, `lib/shipwreck/sim/__tests__/lusitania.test.ts`, `lib/shipwreck/sim/__tests__/realAfternoon.test.ts`
- Modify: `lib/shipwreck/ships/index.ts` (`SHIPS = { titanic, lusitania }`, `export const SHIP_IDS = ["titanic","lusitania"] as const`), `lib/shipwreck/sim/README.md` (sources and every assumption), `scripts/shipwreck-sim.ts` (`--ship=lusitania`)

**Interfaces:**

- Consumes: Task 1's format.
- Produces: `lusitania: ShipSpec`, `LUSITANIA_DECKS`, `LUSITANIA_BOATS` (index, side, x, kind: 22 wooden on davits, 26 collapsibles), `lusitania.realNight` (the torpedo hit, starboard, near the forward boiler room below the waterline, `t: 0`; the second explosion, `t` a few seconds later, and its `ScriptedEvent { kind: "explosion" }`), `clockStartS: 14*3600 + 10*60`, `cause: "torpedo"`, `seaDepthM: 93`, `headway` from 18 kn, `portholes` (rows on the lower decks, both sides), `scripted` boat launches from the history.

- [ ] **Step 1: Data tests first** (`lusitania.test.ts`): LOA 239.9 m ±0.5, LBP 231.6 ±0.5, beam 26.7 ±0.1, at least 41 stations aft to forward, hydrostatic displacement at her draught within 2 % of `displacementT`, upright GM positive and within the source's range, four funnels all `dummy: false`, wing bunker cells on both sides of every boiler room, starboard and port wing cells mirror each other, 48 boats.
- [ ] **Step 2: Write `lusitania.ts`** from the sources (hull offsets, sheer, decks, superstructure boxes, transverse bulkheads and tops, wing bunkers with their inboard `y`, funnels, masses). Run: PASS.
- [ ] **Step 3: The real afternoon, failing tests** (`realAfternoon.test.ts`, `simulate(lusitania, lusitania.realNight)`):
  - the starboard list reaches ≥ 12° by t = 300 s and its maximum before `bow-lands` is 15°–30°;
  - she is down by the head (trim bow down) from 120 s on;
  - `bow-lands` fires before `stern-under`, and at `bow-lands` some stern point is above the sea;
  - `sankAtT` (stern under) between 900 and 1320 s (real: 18 min);
  - no `breakup` before `bow-lands`;
  - she rests with `roll` to starboard ≥ 45°;
  - `explosion` fires within 30 s of `collision`.
  - `whatIf` matrix: for each torpedo spot (every starboard compartment the editor offers) × portholes open/shut: finite poses, the run ends inside `endT`, portholes shut never sinks faster than open for the real spot.
  - perf: the real afternoon runs in under the Titanic perf test's budget.
- [ ] **Step 4: Calibrate** inside honest ranges (opening areas, bunker permeability, cross flow, porthole open area) until PASS. Log every tuned value and its source or reasoning in the README. Golden Titanic still PASSES.
- [ ] **Step 5: Commit** (`feat(shipwreck): RMS Lusitania's data and the real afternoon`).

## Task 3: The Lusitania model

**Files:**

- Create: `components/shipwreck/model/lusitaniaRecipe.ts`, `components/shipwreck/model/__tests__/lusitaniaRecipe.test.ts`
- Modify: `components/shipwreck/model/shipModel.ts` (`recipeFor(spec)` dispatches on `spec.id`), `titanicRecipe.ts` / `buildShip.ts` / `materials.ts` / `textures.ts` only where a Titanic constant must become a recipe field (funnel colours and bands, name text, hull paint heights, boat layout), `TitanicModel.tsx` (render any ship; keep the export name or rename to `ShipModel.tsx` with every import updated), `ModelViewer.tsx` (`?model&ship=lusitania`), `components/shipwreck/model/README.md`

**Interfaces:**

- Consumes: `lusitania`, `LUSITANIA_DECKS`, `LUSITANIA_BOATS` (Task 2).
- Produces: `lusitaniaRecipe(spec: ShipSpec): ShipRecipe`; `ShipRecipe` gains whatever paint fields were Titanic constants (e.g. `paint: { funnel: string; funnelTop: string; bands: number; name: string | null; port: string }`); handles unchanged so the scene poses either ship the same way. `recipeFor` must still return the identical Titanic recipe.

- [ ] **Step 1: Research the look** for 7 May 1915 (funnel paint, name painted out or not, superstructure, the large cowl ventilators, boat deck layout with collapsibles, the enclosed and open promenades, masts, four propellers) and write it with sources in the model README. Keep a `PEACETIME_PAINT` switch (Cunard red, black tops and bands, name boards) as one recipe constant.
- [ ] **Step 2: Failing tests**: every placement inside the hull's bounds; four funnels; boats and davits match `LUSITANIA_BOATS`; four propellers and one rudder; porthole rows match `lusitania.portholes`; the Titanic recipe deep-equals a snapshot taken before this task.
- [ ] **Step 3: Write the recipe** and the shared-code generalisations. PASS.
- [ ] **Step 4: Budget and look**: at `high` ≤ 90 draw calls and ≤ 300k triangles (`handles.stats`), build time ≤ the Titanic's +20 %. Screenshots in the model viewer (chromium 1133×744): bow 3/4, stern 3/4 (props and rudder), side profile, top-down, close on the boat deck, lights at power 1 and 0, and the same views for Titanic to show it unchanged.
- [ ] **Step 5: Commit** (`feat(shipwreck): the Lusitania model`).

## Task 4: Choosing a ship, her story, her places, What-if

**Files:**

- Modify: `components/shipwreck/ui/TitleScreen.tsx` (Lusitania card selectable; Britannic and Edmund Fitzgerald stay "Coming soon"), `components/shipwreck/Shipwreck.tsx`, `lib/shipwreck/playback.ts` (store holds `ship: ShipId`), `lib/shipwreck/story.ts` (per-ship words), `components/shipwreck/parentLine.ts` (per ship), `lib/shipwreck/places.ts` (per ship), `lib/shipwreck/help.ts`, `lib/shipwreck/xray.ts` and `components/shipwreck/scene/XRay.tsx` (wing cells drawn as their own volumes), `components/shipwreck/ui/{HullDiagram,WhatIfEditor,EndCard,NightPanels,Timeline,Hud}.tsx` (read the ship), `lib/shipwreck/save.ts` (optional `ship`, What-if per ship), `lib/shipwreck/testHooks.ts` (`setShip`, `ship`)
- Tests: `lib/shipwreck/__tests__/{story,save,help,xray,playback}.test.ts`, `components/shipwreck/__tests__/Shipwreck.test.tsx`, `components/shipwreck/ui/__tests__/*`

**Interfaces:**

- Consumes: `SHIPS`, `SHIP_IDS`, `getShip` (Task 2); `clockText(s, startS)` (Task 1); recipe dispatch (Task 3).
- Produces: `playback.getState().ship`, `setShip(id: ShipId)`; `captionText(e, ship: ShipSpec)`, `sinceText(s, ship)` ("12 min after the torpedo"); `PARENT_LINES: Record<ShipId, string>`; `PLACES_BY_SHIP: Record<ShipId, readonly Place[]>`; save shape `{ ...v1, ship?: ShipId, lastWhatIf: string[], whatIfByShip?: Partial<Record<ShipId, { ids: string[]; portholesOpen?: boolean }>> }`.

- [ ] **Step 1: Failing tests**:
  - story: every `SimEventKind` (with `explosion`) has a Lusitania caption or an explicit null; no caption contains numbers of deaths or words for people in danger (reuse the 1.0 word list test); `sinceText(720, lusitania)` = `"12 min after the torpedo"`; `clockText(0, lusitania.clockStartS)` = `"2:10 PM"`.
  - save: a 1.0 save loads with `ship` undefined → Titanic; its `lastWhatIf` stays Titanic's; a Lusitania What-if is saved under `whatIfByShip.lusitania`; unknown ship ids are dropped.
  - places: Lusitania places (bridge, first-class dining saloon, the forward boiler room where the torpedo hit, a starboard coal bunker, the turbine engine room) sit inside her hull and their compartments exist.
  - Shipwreck: picking Lusitania then going back and picking Titanic builds the right model and disposes the other (spy on `dispose`).
  - What-if editor for a torpedo ship: offers starboard compartments for the hit plus a "Portholes open" toggle (default on); for Titanic it is unchanged.
- [ ] **Step 2: Implement** until PASS. Lusitania parent line (exact copy): "This is the Lusitania in 1915. A torpedo sank her in 18 minutes during the First World War, and more than 1,190 people died. This game shows only the ship."
- [ ] **Step 3: Screenshots** of the title screen with the picker, the Lusitania HUD mid-afternoon, the X-ray with flooded starboard bunkers, the What-if editor, the end card.
- [ ] **Step 4: Commit** (`feat(shipwreck): choose the Lusitania`).

## Task 5: Analytics `ship` prop (data boundary: spec review + adversarial review)

**Files:** `lib/shipwreck/analytics.ts`, `lib/analytics/gameEvents.ts`, `firestore.rules`, `firestore-tests/gameEvents.test.ts`, the Games tab of the admin dashboard (`components/admin/`), `lib/shipwreck/__tests__/analytics.test.ts`

- [ ] **Step 1: Failing tests**: `trackStart(mode, opened, ship)` and `trackEnd(mode, outcome, minutes, ship)` send `ship: "titanic" | "lusitania"`; the rules test feeds both values for both events and rejects `"britannic"`, a number, and an extra prop; the dashboard splits Shipwreck starts and ends by ship.
- [ ] **Step 2: Implement** schema, rules and dashboard together; `opened` max rises if Lusitania's compartment count needs it (mirror in rules). `npm run test:rules` (needs Java 21+; report if it cannot run).
- [ ] **Step 3: Commit** (`feat(shipwreck): count runs per ship`).

## Task 6: The afternoon scene

**Files:**

- Create: `components/shipwreck/scene/settings.ts` (per-ship scene settings), `components/shipwreck/scene/Coast.tsx`, `components/shipwreck/scene/Torpedo.tsx`
- Modify: `Sky.tsx`, `Sea.tsx`, `Environment.tsx`, `Effects.tsx` (four smoking funnels, the hit's water column and smoke, the second explosion's burst, steam), `NightScene.tsx` (pick by setting; rename only if trivial), `Iceberg.tsx` (only for iceberg ships), `CameraRig.tsx` / `cameraMath.ts` (93 m floor, ship lying across it), `ShipRig.tsx` (boats: starboard swing out, port swing in against the hull with the list), `components/shipwreck/scene/README.md`
- Test: `components/shipwreck/scene/__tests__/cameraMath.test.ts`, `components/shipwreck/scene/__tests__/settings.test.ts`

**Interfaces:**

- Produces: `SCENE_SETTINGS: Record<ShipId, { timeOfDay: "night" | "afternoon"; sun: { elevationDeg: number; azimuthDeg: number } | null; fog: string; underwaterFog: string; coast: boolean; iceberg: boolean }>`.

- [ ] **Step 1: Failing tests**: settings for Titanic equal the 1.0 constants (night, no sun, iceberg); camera math clamps above `-seaDepthM + 2` for Lusitania and never below the floor near the hull lying on its side.
- [ ] **Step 2: Build** the sunlit sky (sun about 50° up, south-west at 2 PM in May at 51.4° N; check), light haze, a calm sunlit sea with the ship's wake while she has way, the low green coast and the Old Head of Kinsale headland with its lighthouse on the northern horizon, the torpedo's white bubble track running in from starboard and the water column at the hit, the second explosion, smoke from all four funnels thinning as steam fails, boats per side, the green shallow underwater with light shafts and a sand-and-shingle floor. Lights by deck still follow `power` (they barely show in daylight; portholes read dark).
- [ ] **Step 3: Budgets** at the top tier for 3 Lusitania scenes (the hit, the list at 10 min, the bow grounded with the stern up) and the 4 existing Titanic scenes; Titanic numbers unchanged.
- [ ] **Step 4: Screenshots** (1133×744 and iPad mini portrait 744×1133): torpedo track approaching, the hit, the list with boats, stern up with bow grounded (above and below water), the wreck on the floor, and the Titanic 11:45 PM shot unchanged.
- [ ] **Step 5: Commit** (`feat(shipwreck): a May afternoon off the Old Head of Kinsale`).

## Task 7: Sound for the afternoon

**Files:** `components/shipwreck/audio/{beds,cues,voices,useShipwreckSound}.ts(x)` and tests.

- [ ] **Step 1: Failing tests**: the bed and cue set are chosen by ship; Lusitania has an afternoon bed (open sea, distant gulls, engines), a muffled torpedo thud, a deeper second explosion, steam roar, no rocket cue (she fired none); Titanic's mapping is unchanged; no voice or scream samples (reuse the 1.0 guard).
- [ ] **Step 2: Implement** (procedural Web Audio like 1.0). PASS.
- [ ] **Step 3: Commit** (`feat(shipwreck): the afternoon's sounds`).

## Task 8: e2e, performance, release 1.1.0

**Files:** `e2e/shipwreck.spec.ts`, `e2e/shipwreck-offline.spec.ts`, `e2e/perf.spec.ts` + `e2e/perf-budget.json` (three Lusitania scenes added via `PERF_UPDATE=1`), `lib/shipwreck/version.ts` (`1.1.0`), `lib/shipwreck/changelog.ts` (new top entry), `public/shipwreck-sw.js` (regenerated by its script, never by hand).

- [ ] **Step 1: e2e**: `@smoke` pick Lusitania → real afternoon → reaches the end card at speed ×100; switch back to Titanic and see the iceberg; What-if with portholes shut; offline start after one visit loads the Lusitania too.
- [ ] **Step 2: Perf**: add the Lusitania scenes, run `PERF_UPDATE=1 npx playwright test e2e/perf.spec.ts --project=chromium`, check Titanic entries did not move, commit the budget.
- [ ] **Step 3: Release**: version `1.1.0`; changelog entry in plain words for a young player and their parent, from `git log e5fd6da4..HEAD -- lib/shipwreck components/shipwreck app/shipwreck public/shipwreck-icons public/shipwreck-sw.js`.
- [ ] **Step 4: `npm run validate`** and the full Shipwreck e2e on chromium + `@smoke` on webkit and iPad: PASS (the known red flamelings / jim tests on main are not ours; list them if they fail).
- [ ] **Step 5: Commit** (`feat(shipwreck): release 1.1.0 with the Lusitania`).
