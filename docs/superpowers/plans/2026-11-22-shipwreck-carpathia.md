# Shipwreck — the Carpathia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RMS Carpathia (torpedoed by U-55, 17 July 1918) as a fourth fully playable ship in Shipwreck, with Walk the decks and a multi-select What if, ready for the parent to release as part of 1.4.0.

**Architecture:** The ship format (`lib/shipwreck/ships/`) is the single source of truth for the sim, model, X-ray, diagram, walk map and scene. This plan generalises the torpedo What-if per ship (side, hit order, stagger, one torpedo's hole, a later "finishing" torpedo as its own spot) with the Lusitania's 1.1 rule as the default when the new field is missing, then adds her data, a model recipe with dazzle paint, her UI words and places, analytics, a summer-morning Atlantic scene, sound, a walk map and e2e/perf.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, React Three Fiber / three.js r186, zustand, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-shipwreck-carpathia-design.md` (read it first; its north-star goals are re-read at the start of every task). The 1.0, Lusitania, Fitzgerald and Walk specs and plans (`docs/superpowers/{specs,plans}/2026-11-2[01]-shipwreck*.md`) hold where this plan is silent. `lib/shipwreck/sim/README.md` and `components/shipwreck/scene/README.md` explain the existing sim and scene.

## Global Constraints

- Everything in the earlier Shipwreck plans' Global Constraints applies: Prettier, `export default function`, `interface` props, Tailwind only, Safari 15.0 floor via `lib/game-kit/compat.ts` (no `Object.hasOwn`, no `.at()`, no `structuredClone`), static export, no people shown, pure deterministic sim (no `Math.random`), coordinate frames (ship frame: x forward, y to port, z up from the keel; `roll`/`listDeg` + to starboard), budgets: ≤ 160 draw calls and ≤ 450k triangles for the scene at the top tier, her model at `high` ≤ 90 draw calls and ≤ 300k triangles, no frame blocked > 8 ms.
- Worktree `/Users/griggen/.t3/worktrees/gentryriggen.com/t3-31001dda-84331ec5d0f65385`, branch `feat/shipwreck-carpathia` (off origin/main c6fed161). Commit on it; **never push, open a PR or merge**. Use `npx next build --webpack` / `npx next dev --webpack` if Turbopack complains.
- **Do NOT bump `SHIPWRECK_VERSION` or edit `lib/shipwreck/changelog.ts`** (the parent releases 1.4.0 with the sibling's Britannic). `changelog.test.ts` must still pass unchanged.
- **The other ships must not change.** `titanicGolden.test.ts`, `lusitaniaGolden.test.ts` and the Fitzgerald's real-storm tests pass after every task; their recipes deep-equal, their `SCENE_SETTINGS` and `e2e/perf-budget.json` entries do not move.
- Ship ids: `"titanic" | "lusitania" | "fitzgerald" | "carpathia"`, in that order in `SHIP_IDS` (the sibling adds `"britannic"` after `carpathia`). Shared-file edits (ShipId union, `SHIP_IDS`, `SHIPS`, title cards, analytics enums, rules, e2e helpers) are minimal and additive: add one line/entry after the Fitzgerald's, never reorder or reformat neighbours. Leave the Britannic "Coming soon" card alone.
- Save key stays `shipwreck:v1`; no new save fields (her What-if lives in `whatIfByShip.carpathia.ids`, the finishing torpedo as the pseudo-spot `FINISHER_SPOT`).
- Kindness: no people, no voices, no U-boat or Snowdrop model, no death counts in play; captions never mention the crew's fate. Parent line exact copy is in the spec.
- Kid UI: big picture buttons, no reading needed to play; every HUD item explains itself on tap (`help.ts`).
- Sources: every Carpathia figure is cited in `lib/shipwreck/sim/README.md` (sim) or `components/shipwreck/model/README.md` (look); where sources disagree, say which you picked and why (the spec lists the known disagreements).
- Conventional commits `feat(shipwreck): …` / `fix(shipwreck): …`, one or more per task. Each task: `npm run lint`, `npm run type-check`, the tests it touched, then `npm test`. Full e2e/perf only where a task says.
- Screenshots to `/Users/griggen/.t3/worktrees/gentryriggen.com/t3-31001dda-84331ec5d0f65385/.screenshots/carpathia-task-<N>/` (gitignored? check `.gitignore`; never commit them), PNG, listed with absolute paths in the report.
- Every report ends with a "Slowdowns" line and the screenshot list.

## Review Focus

1. **Lusitania regression through the generalised torpedo code** (her spots, real ids, hit order, 3 s stagger, starboard side, `torpedoHitXs`, captions): pinned by `lusitaniaGolden.test.ts`, `torpedoHits.test.ts` and `whatIf.test.ts` unchanged, plus a new test that `torpedo` missing gives byte-identical `whatIfOpenings` for every Lusitania spot subset of size ≤ 3 (Task 1).
2. **A What-if run that never ends or ends wrong**: one hit forward only, every spot at once, the finishing torpedo alone (no early hits: she is hit at 10:50 AM only, so the run must still play the quiet ~95 min and end), finisher after she already sank (ignored, no NaN): finite poses, inside `endT` (Task 2 matrix).
3. **Port vs starboard everywhere downstream**: the torpedo wake comes from her port side, the hit spray on the port side, the hull diagram highlights the port side, the X-ray shows the port holes, the list goes to port (negative). A test per layer (Tasks 2, 4, 6).
4. **The long quiet middle** (≈95 min between the second and third hit): the timeline, speed controls and captions keep a young player oriented (a caption while waiting, the boats away, the convoy gone); the e2e at top speed reaches the end card within the test timeout (Task 4 copy test, Task 8 e2e).
5. **Switching ships** (title → Carpathia → title → Lusitania → Fitzgerald → Carpathia): right model, paint, scene, convoy on/off, sound bed, What-if editor, walk map; old model disposed (Task 4 unit, Task 8 e2e).

---

## Task 1: Per-ship torpedoes in the sim (no new ship yet)

**Files:**

- Modify: `lib/shipwreck/ships/types.ts`, `lib/shipwreck/sim/run.ts` (`whatIfSpots`, `whatIfOpenings`, `whatIfRealIds`, `torpedoHitXs`, new `torpedoHits`), `lib/shipwreck/sim/events.ts`, `lib/shipwreck/sim/README.md`, `lib/shipwreck/sim/__tests__/testShips.ts`
- Create: `lib/shipwreck/sim/__tests__/torpedoSpec.test.ts`

**Interfaces (Produces):**

```ts
// types.ts
export interface TorpedoSpec {
  side: "port" | "starboard";
  /** Order hits land along her length in a run with several. */
  order: "aft-first" | "fwd-first";
  /** Seconds between successive hits (hit k lands k·staggerS after the first). */
  staggerS: number;
  /** One torpedo's hole in her side: total area, its heights above the keel,
   *  and its length along her side. A hole across a bulkhead opens both
   *  spaces, the area shared by overlap length. */
  hole: { areaM2: number; zLow: number; zHigh: number; lengthM: number };
  /** Where a hit at a spot strikes (ship-frame x of the hole's middle).
   *  Missing for a spot: the spot's compartment middle. */
  hitX?: Readonly<Record<string, number>>;
  /** A later torpedo, offered as its own What-if spot (FINISHER_SPOT):
   *  strikes compartment `spotId` at shown `t`. */
  finisher?: { spotId: string; t: number };
  /** The What-if spots that give her real run (FINISHER_SPOT included if real). */
  realSpots: readonly string[];
}
// ShipSpec gains:
/** Torpedo ship's hits (side, order, hole). Missing: the 1.1 rule (the real
 *  hit moved along her starboard side, aft first, HIT_STAGGER_S apart). */
torpedo?: TorpedoSpec;

// run.ts
export const FINISHER_SPOT = "finisher";
export interface TorpedoHit { x: number; t: number; side: "port" | "starboard"; finisher: boolean }
/** Every torpedo of a run, in landing order (Lusitania: same xs as torpedoHitXs, t = hitTimeS). */
export function torpedoHits(spec: ShipSpec, ids: readonly string[]): TorpedoHit[];
```

- `events.ts`: `SIM_EVENT_KINDS` gains `"torpedo-hit"` (append at the end of the list); the sim emits one per hit after the first, at its time, `index` = hit number from 2, **only for ships with `spec.torpedo`** (so Lusitania events are unchanged). The story map test requires every kind to have a caption or explicit null per ship: add explicit nulls for the other ships now (Task 4 writes the Carpathia words).
- `whatIfSpots` for a `spec.torpedo` ship: every compartment without a side `span` (centre or full breadth), aft to forward, then `FINISHER_SPOT` if `finisher`.
- `whatIfOpenings` for a `spec.torpedo` ship: for each chosen compartment spot, one hit at `hitX[id] ?? middle`, its hole split across compartments by overlap of `[x − lengthM/2, x + lengthM/2]` (each piece's `x` clamped 0.5 m inside its compartment, `side` = `torpedo.side`), hits ordered by `order` and timed `k · staggerS` (k from 0); `FINISHER_SPOT` adds one hit at `finisher.spotId` at `finisher.t`. `whatIfRealIds` returns `torpedo.realSpots`.

- [ ] **Step 1: Failing tests** in `torpedoSpec.test.ts` with a 150 m box test ship (`testShips.ts`: nine full-breadth compartments, `cause: "torpedo"`, a `torpedo` spec on the port side, `fwd-first`, `staggerS: 8`, `hole: { areaM2: 6, zLow: 3, zHigh: 7, lengthM: 8 }`, a `hitX` on one spot that sits 1 m from a bulkhead, a `finisher` at t = 600):
  - `"spots are the compartments then the finisher"`: `whatIfSpots` = the nine ids + `"finisher"`.
  - `"a hole across a bulkhead opens both spaces"`: the `hitX` spot gives two openings whose areas sum to 6 and split 5:3 by overlap (±1e-9), both `side: "port"`.
  - `"hits land forward first, staggerS apart"`: three spots give openings at t 0, 8, 16, the most forward at 0.
  - `"the finisher lands at its own time"`: `["finisher"]` alone gives one hit at t = 600.
  - `"real ids give the real run"`: `whatIfRealIds` = `realSpots`; a spec whose `realNight` is `whatIfOpenings(spec, realSpots)` round-trips.
  - `"a port hit lists her to port"`: simulate a single amidships hit: `listDeg < 0` at the end, finite poses.
  - `"torpedo-hit events"`: two spots + finisher give `torpedo-hit` with index 2 at t = 8 and index 3 at t = 600; a ship without `torpedo` never emits one.
  - `"the Lusitania rule is untouched"`: for every Lusitania spot subset of size 1–3 (all combinations), `whatIfOpenings` deep-equals a fixture generated from the unchanged code (`UPDATE_GOLDEN=1`; write the fixture before touching run.ts), `torpedoHits(lusitania, ids).map(h=>h.x)` equals `torpedoHitXs`, and `t` equals `hitTimeS`.
- [ ] **Step 2: Implement** until PASS. All three goldens, `torpedoHits.test.ts`, `whatIf.test.ts`, `robustness.test.ts` PASS unchanged.
- [ ] **Step 3: README** ("Torpedo ships": the format, the split-by-overlap rule, the finisher) and **commit** (`feat(shipwreck): torpedo hits per ship in the sim`).

## Task 2: The Carpathia's data and her last morning

**Files:**

- Create: `lib/shipwreck/ships/carpathia.ts`, `lib/shipwreck/sim/__tests__/carpathia.test.ts`, `lib/shipwreck/sim/__tests__/realMorning.test.ts`
- Modify: `lib/shipwreck/ships/types.ts` (`ShipId` gains `"carpathia"`), `lib/shipwreck/ships/index.ts` (export, `SHIP_IDS` and `SHIPS` with `carpathia` after `fitzgerald`), `lib/shipwreck/sim/README.md` ("Carpathia's data": every source, figure, disagreement and tuned value), `scripts/shipwreck-sim.ts` (`--ship=carpathia`, `--no-finisher`, `--spots=a,b`), `lib/shipwreck/sim/__tests__/perf.test.ts` (her real run). Anything that switches exhaustively on `ShipId` and now fails type-check gets a minimal placeholder (for example `PARENT_LINES.carpathia` with the spec's exact copy, `SCENE_SETTINGS.carpathia` copied from the Lusitania's with `coast: false`, `PLACES_BY_SHIP.carpathia: []`) that Tasks 4 and 6 replace.

**Interfaces:**

- Consumes: Task 1's `TorpedoSpec`, `FINISHER_SPOT`, `whatIfOpenings`.
- Produces: `carpathia: ShipSpec`; `CARPATHIA_DECKS` (forecastle, bridge deck, boat deck, poop, the four steel decks, orlop, tank top, with z); `CARPATHIA_BOATS: readonly CarpathiaBoat[]` (`{ index; label; side; x; z }`, her 1918 boats from photos/sources; the model and Effects read them); `CARPATHIA_SUPERSTRUCTURE` names (`forecastle`, `bridgeDeck` (the 290 ft house), `boatDeckHouse`, `poop`: indices into `spec.superstructure`, which the model and walk map read); `CARPATHIA_MASTS: readonly number[]` (four x values); `CARPATHIA_WELLS` (forward and after well deck x ranges and deck z); `CARPATHIA_PAINT: "dazzle" | "grey" | "cunard"` (default `"dazzle"`) and `CARPATHIA_FUNNEL_PAINT` (grey for dazzle/grey, Cunard red `0xb5461f` / black top `0x141416` for cunard); `CARPATHIA_HIT_T = { second: 8, third: 5700 }`.
- Her values: `clockStartS: 9*3600 + 15*60`; `cause: "torpedo"`; `seaDepthM: 150`; `torpedo: { side: "port", order: "fwd-first", staggerS: 8, hole: <a 1918 torpedo hole, cite: about 5–8 m long, ~15–25 m², its depth from a U-boat torpedo's running depth>, hitX: { boiler: <the boiler room's forward bulkhead> }, finisher: { spotId: "hold5", t: 5700 }, realSpots: ["boiler", "engine", FINISHER_SPOT] }` (ids may differ if her compartments are named otherwise; keep `realSpots` consistent); `realNight = whatIfOpenings(...)` of those (built in the file, no duplication); nine compartments from eight bulkheads (forepeak, hold1, hold2, hold3, boiler, engine, hold4, hold5, after peak / shaft tunnel — confirm from her general arrangement and the 1902 _Engineer_ description; bulkhead tops cited or argued); `headway: { startMs: 10 * 0.514444, halfLifeS: 60 }` (R9: an assumption); no `portholes` (R10); `wreck: { restDeg: <a few degrees to port, negative>, minListDeg: 0 }` or whatever the rule needs so she rests within 15° of upright listed to port (read the rule in `descent.ts`; R8); `funnels`: one, `falls` per the sim's stays rule (document); `scripted`: `steam-start` just after the second hit and `steam-stop` some minutes later, 3–6 `rocket`s in the first 20 minutes (R13), 11 `boat-lowered` from about 9:25 to 9:55 AM (GOL: eleven boats; spread both sides, the port boats nearest the hits not first), no `radio` (R14); draught and displacement for her ballast voyage (uboat.net "in ballast") derived and argued in the README from her lightship, coal and ballast, with the load draught 34 ft 7 in as the upper bound.

- [ ] **Step 1: Data tests first** (`carpathia.test.ts`): LOA 170.1 m ±0.5, LBP (registered 540 ft) 164.6 ±1.0, beam 19.66 ±0.1, ≥ 41 stations aft to forward, hydrostatic displacement at her draught within 2 % of `displacementT`, upright GM positive and in a liner's range (0.3–1.5 m), exactly one funnel, nine compartments, `torpedo.side === "port"`, `whatIfRealIds(carpathia)` = `realSpots`, `whatIfOpenings(carpathia, realSpots)` deep-equals `realNight`, every opening's `side` is `"port"`, `SHIP_IDS` = `["titanic","lusitania","fitzgerald","carpathia"]`.
- [ ] **Step 2: Write `carpathia.ts`** from the sources (research her general arrangement / profile and cite it). PASS.
- [ ] **Step 3: The real morning, failing tests** (`realMorning.test.ts`, `simulate(carpathia)`):
  - openings at t 0, 8 and 5700 only; `torpedo-hit` events index 2 at 8 and index 3 at 5700;
  - `listDeg` between −10 and −0.5 at t = 600; never below −15 before t = 5700;
  - trim bow down from t = 600 to t = 5700;
  - still afloat at t = 5700 with the forecastle deck edge above the still water (probe the hull's highest forward point);
  - `stern-under` (`sankAtT`) between 6000 and 9300;
  - no `breakup` before the ship is fully under;
  - rests with `|roll|` ≤ 15° and `roll < 0` (to port);
  - What-if matrix: every single spot; every pair of spots; all nine; each of those with and without `FINISHER_SPOT`; the finisher alone: finite poses, ends inside `endT`; without the finisher she sinks no earlier than the real run (or floats; report which in the README); any single hit floats or sinks no earlier than the real run; three or more compartment hits sink no later than the same set's first two;
  - perf: her real run simulates within 1.5× the Titanic perf test's budget.
- [ ] **Step 4: Calibrate** inside honest ranges (hole area and depth, bulkhead tops, permeabilities, KG) until PASS; log every tuned value and its reasoning in the README. All three goldens PASS.
- [ ] **Step 5: Commit** (`feat(shipwreck): RMS Carpathia's data and her last morning`).

## Task 3: The Carpathia model

**Files:**

- Create: `components/shipwreck/model/carpathiaRecipe.ts`, `components/shipwreck/model/__tests__/carpathiaRecipe.test.ts`
- Modify: `components/shipwreck/model/shipModel.ts` (`recipeFor` dispatch), `buildShip.ts` / `materials.ts` / `textures.ts` / `partGeometry.ts` only where a recipe field is needed (well decks open between houses, cargo masts with derricks/cranes, a single tall funnel, a dazzle texture on the hull and houses), `ModelViewer.tsx` (`?model&ship=carpathia&paint=dazzle|grey|cunard`), `components/shipwreck/model/README.md` ("Carpathia": every feature with its source), `scripts/shipwreck-model-shots.mjs` (her shots)

**Interfaces:**

- Consumes: Task 2's `carpathia`, `CARPATHIA_DECKS`, `CARPATHIA_BOATS`, `CARPATHIA_MASTS`, `CARPATHIA_WELLS`, `CARPATHIA_PAINT`, `CARPATHIA_FUNNEL_PAINT`.
- Produces: `carpathiaRecipe(spec: ShipSpec, paint?: CarpathiaPaint): ShipRecipe`; handles unchanged so the scene poses her like the others. Titanic, Lusitania and Fitzgerald recipes deep-equal snapshots taken before this task.

- [ ] **Step 1: Research the look** from photographs (Wikimedia Commons, the 1912 rescue photos, Library of Congress / Bain, the 1902–1903 builder's photos) and write it with sources in the model README: straight stem, forecastle, forward well with foremast and derricks, the long bridge-deck house with promenade windows/portholes, navigating bridge and wheelhouse at its front, the boat deck with its boats and davit type, cowl ventilators, the one tall funnel (and its height/rake), the four masts' places and heights, the after well, the poop, counter stern, twin screws and rudder, the 1918 stern gun platform if sourced (gun crew's quarters aft, Wikipedia), and the dazzle (R2: our pattern, documented as such).
- [ ] **Step 2: Failing tests**: every placement inside the hull's bounds; one funnel; four masts at `CARPATHIA_MASTS`; boats match `CARPATHIA_BOATS`; two propellers and one rudder; the wells have no house over them; each paint gives the right funnel colours (`CARPATHIA_FUNNEL_PAINT`); the default paint is dazzle; other ships' recipe snapshots unchanged.
- [ ] **Step 3: Write the recipe** and the shared-code generalisations. The dazzle is one procedural texture (canvas or data texture, built once, deterministic, ≤ 1024×256) mapped along the hull and houses: bold black/white/grey/blue-grey slanted bands, not stripes per mesh. PASS.
- [ ] **Step 4: Budget and look**: at `high` ≤ 90 draw calls and ≤ 300k triangles (`handles.stats`), build time ≤ the Titanic's. Model viewer screenshots (chromium 1133×744): bow 3/4, stern 3/4 (screws, rudder), side profile (each paint), top-down, boat deck close, funnel and bridge close, lights at power 1 and 0, and the other three ships' side profiles unchanged.
- [ ] **Step 5: Commit** (`feat(shipwreck): the Carpathia model`).

**Drift audit A (Opus, read-only) after Task 3:** re-read the spec's north stars and rulings; rerun `scripts/shipwreck-sim.ts --ship=carpathia` for the real run, `--no-finisher`, and two What-ifs; check the README's claims and the tests' numbers against the output; look at Task 3's screenshots against reference photographs (funnel, masts, wells, davits, paint); list drift. Findings fold into Task 4's instructions.

## Task 4: Choosing her, her story, her places, What if

**Files:**

- Modify: `components/shipwreck/ui/TitleScreen.tsx` (her card after the Fitzgerald's, a picture of her; Britannic's "Coming soon" untouched), `components/shipwreck/Shipwreck.tsx`, `lib/shipwreck/story.ts` (her words for every `SimEventKind` incl. `torpedo-hit`, `sinceText` "1 h 35 min after the first torpedo", end card words naming Snowdrop picking up her boats), `components/shipwreck/parentLine.ts` (spec's exact copy), `lib/shipwreck/places.ts` (bridge, the boiler room where the first torpedo hit, the engine room, No. 5 hold where the last hit, the dining saloon, the wireless room with the caption "In 1912 her wireless operator heard the Titanic's call for help here."), `lib/shipwreck/help.ts`, `lib/shipwreck/xray.ts` + `components/shipwreck/scene/XRay.tsx` (port-side holes), `lib/shipwreck/whatIf.ts` (`spotLabel`/`spotAria` for `FINISHER_SPOT`: "The U-boat comes back" / "a last torpedo at 10:50 AM"), `components/shipwreck/ui/{HullDiagram,WhatIfEditor,EndCard,NightPanels,Timeline,Hud}.tsx` (port side; the finisher as a separate big toggle with a torpedo-and-clock picture, not a hull spot; no portholes toggle for a ship without `portholes`), `lib/shipwreck/save.ts` (only if her ids need validating: `FINISHER_SPOT` must survive the round trip), `lib/shipwreck/testHooks.ts`
- Tests: the matching `__tests__` files.

**Interfaces:**

- Consumes: `SHIPS`, `SHIP_IDS`, `FINISHER_SPOT`, `torpedoHits` (Tasks 1–2), recipe dispatch (Task 3).
- Produces: her captions, `PARENT_LINES.carpathia`, `PLACES_BY_SHIP.carpathia`; the editor's torpedo words read the ship's side ("Tap where torpedoes hit her port side" style lead; the Lusitania's starboard copy unchanged).

- [ ] **Step 1: Failing tests**: every `SimEventKind` has a Carpathia caption or explicit null; the word-list test covers her captions (no deaths, no people in danger); `clockText(0, carpathia.clockStartS)` = `"9:15 AM"`; a caption exists for the quiet middle (for example at `last-boat`: her boats are away and she waits) so a player at ×1 is told what is happening; her torpedo captions say "port side" and the Lusitania's still say "starboard"; a save with her ids incl. `FINISHER_SPOT` round-trips and junk ids drop; places sit inside her hull and their compartments exist; the editor shows her nine spots plus the finisher toggle (defaults = the real run: boiler, engine, finisher on), Go with only the finisher is allowed, Clear clears spots and the finisher; the end card for her real run reads her sinking time and Snowdrop; switching Carpathia → Lusitania → Carpathia disposes the old model (spy); the title screen lists four playable ships in `SHIP_IDS` order and Britannic still "Coming soon".
- [ ] **Step 2: Implement** until PASS.
- [ ] **Step 3: Screenshots**: title screen, her HUD at 9:30 AM, the X-ray with water in the boiler and engine rooms, the What-if editor, the end card.
- [ ] **Step 4: Commit** (`feat(shipwreck): choose the Carpathia`).

## Task 4b: Corrections from drift audit A (inserted by the controller)

Brief: `.superpowers/sdd/2026-11-22-shipwreck-carpathia/task-4b-brief.md` (spec R21 no raised poop, R22 her way down is seen; three-bladed screws; darker battle-grey funnel; README fixes; the finisher-only What-if's scripted events).

## Task 4c: Liveries for every ship, switched live (Gentry, 2026-11-22)

Brief: `.superpowers/sdd/2026-11-22-shipwreck-carpathia/task-4c-brief.md` (spec "Liveries for every ship", R23–R28). Ordinary UI/model plumbing: one combined review.

## Task 5: Analytics `ship` value (data boundary: spec review + adversarial review)

**Files:** `lib/shipwreck/analytics.ts` (if it lists ships), `lib/analytics/gameEvents.ts` (`SHIPWRECK_SHIPS` gains `"carpathia"` after `"fitzgerald"`), `lib/analytics/gameAggregate.ts` (`SHIPWRECK_SHIP_ORDER`), `firestore.rules` (both `p.ship in [...]` lists), `firestore-tests/gameEvents.test.ts`, the Games tab (`components/admin/`) if it names ships, `lib/shipwreck/__tests__/analytics.test.ts`

- [ ] **Step 1: Failing tests**: `ship: "carpathia"` accepted for `shipwreck_start` and `shipwreck_end`; the rules test feeds all four ships for both events and still rejects `"britannic"`, `"Carpathia"`, a number and an extra prop; the dashboard splits by all four; `opened` for her stays within the schema's max (her spots + finisher ≤ the current max; count the finisher as a spot opened and say so in the schema comment).
- [ ] **Step 2: Implement** schema, rules and dashboard together; run `npm run test:rules` (Java 21+; report verbatim if it cannot run).
- [ ] **Step 3: Commit** (`feat(shipwreck): count Carpathia runs`).

## Task 6: The summer morning scene (MVP cut, 2026-11-22: reuse the Lusitania's daylight scene, sea and torpedo effects with her sun and position, port-side wakes; convoy and rockets visuals are follow-ups)

**Files:**

- Create: `components/shipwreck/scene/Convoy.tsx` (R12), `components/shipwreck/scene/__tests__/convoy.test.ts`
- Modify: `settings.ts` (`SCENE_SETTINGS.carpathia`: `timeOfDay: "afternoon"` (the daylight pipeline; document that the name is legacy) or a new value if cleaner — the builder decides and keeps the other ships' settings deep-equal; her sun from `sunPosition` at the wreck's position (spec R6) at 9:15 AM BST (08:15 UTC) on 17 July 1918, `headingDeg` west-ish for Boston (document the assumption), `coast: false`, a new optional `convoy?: true`, deeper Atlantic sea and underwater colours), `Sky.tsx`, `Sea.tsx` (open-ocean colour, small ripple normals: R7, visual only), `Environment.tsx` (a darker, bluer descent to 150 m), `Effects.tsx` / `afternoonEffects.ts` (one funnel smoking then thinning as steam fails, steam venting, daytime rocket bursts with smoke trails (R13), the port-side hit columns at each `torpedoHits` time), `Torpedo.tsx` / `torpedoPose.ts` (wakes from `torpedoHits`: the side and each hit's own time, so the third wake runs in just before 10:50 AM; the Lusitania's unchanged), `CameraRig.tsx` / `cameraMath.ts` (150 m floor, upright wreck), `ShipRig.tsx` (her boats lowered on both sides; R8 rest), `NightScene.tsx` (mount `Convoy` when `settings.convoy`), `components/shipwreck/scene/README.md`
- Tests: `settings.test.ts` (other ships' settings deep-equal; her sun elevation and azimuth equal `sunPosition` for the stated place/time), `cameraMath.test.ts` (camera above `−150 + 2`, never inside the upright wreck), `convoy.test.ts` (ships' positions deterministic, they steam away after the first hit and are out of sight (beyond the fog) by about 30 min; zero ships at low quality), a Torpedo test that her wakes approach from port (negative scene z… use the scene's axis convention) and land at 0, 8 and 5700 s.

- [ ] **Step 1: Failing tests** as listed. Note `torpedoHits` gives time per hit; the preroll (`preRollS`) only covers the first: the third wake must appear `preRollS` before its own hit.
- [ ] **Step 2: Build**: a clear summer morning in the open Atlantic, sun low-ish in the east, no land, deep blue sea; six grey/dazzle convoy steamers (instanced low-poly hulls with one funnel each, ≤ 6 draw calls total) on the horizon, scattering away after the hit; the two port-side hits' water columns, steam from her funnel's waste pipe and a dying funnel smoke, daytime rockets, her boats rowing clear, the long settle by the head, the third wake and hit at 10:50 AM, the bow going under, the descent through blue to dark, the upright wreck on a grey-brown floor at 150 m.
- [ ] **Step 3: Budgets** at the top tier for three Carpathia scenes (the first hit, 10:00 AM settled with boats away, the wreck on the floor) ≤ 160 draw calls / 450k triangles; other ships' numbers unchanged; convoy and particle counts tiered (iPads start at medium).
- [ ] **Step 4: Screenshots** (1133×744 and 744×1133): the first wake running in, the two hits, 9:45 AM with boats away and the convoy on the horizon, the third hit, the bow under, the descent, the wreck upright; the Lusitania hit shot unchanged.
- [ ] **Step 5: Commit** (`feat(shipwreck): a July morning west of Fastnet`).

**Drift audit B: skipped (parent, 2026-11-22).** Was: the spec's anti-goals against Task 6's screenshots and a live run in the dev server (does it read as a different morning and a different ship, is the port side right everywhere, frame-rate risks at medium tier); findings fold into Task 7.

## Task 7: Moved to follow-ups (parent MVP cut, 2026-11-22): her own sound and Walk the decks

**Files:**

- Modify: `components/shipwreck/audio/{beds,cues,useShipwreckSound}.ts(x)` and tests (her bed: open Atlantic swell, a light breeze, her engines until the hit, no coast surf; cues: a torpedo thud per `torpedo-hit` and the first hit, steam roar, daytime rocket bangs, the hull's groan, the plunge; no voices: the existing guard); `lib/shipwreck/walk/index.ts` (`carpathia: CARPATHIA_WALK`), `components/shipwreck/scene/WalkRunner.tsx` / `walkCamera.ts` only if a liner assumption breaks on her wells
- Create: `lib/shipwreck/walk/carpathiaDecks.ts`, `lib/shipwreck/walk/__tests__/carpathiaDecks.test.ts`

**Interfaces:**

- Consumes: `carpathia`, `CARPATHIA_DECKS`, `CARPATHIA_BOATS`, `CARPATHIA_SUPERSTRUCTURE`, `CARPATHIA_WELLS`, `CARPATHIA_MASTS`, the recipe's fittings (Task 3).
- Produces: `CARPATHIA_WALK: WalkMap` (the same shape as `LUSITANIA_WALK`): forecastle, forward well, bridge-deck promenade (around the house), boat deck (between the boats and the funnel casing), after well, poop, joined by ladders (R16), blockers where the model draws masts, hatches, winches, ventilators, the funnel and davits.

- [ ] **Step 1: Failing tests**: the bed and cue set chosen by ship (hers as above, the others' mappings unchanged); `walkMapFor("carpathia")` is her map; every walk area lies inside her deck edge at its height; every area is reachable from the spawn via stairs; blockers cover each mast, the funnel and each hatch the recipe draws (read the recipe, keep them in step); the walk spec's slope/swim rules work on her (a walker on the forecastle at 11:00 AM ends up swimming, not inside the hull).
- [ ] **Step 2: Implement** until PASS.
- [ ] **Step 3: Screenshots**: walking her boat deck at 9:20 AM, the forward well looking up at the bridge, the poop looking forward at the funnel.
- [ ] **Step 4: Commit** (`feat(shipwreck): the Carpathia's sounds and decks to walk`).

## Task 8: e2e, performance, offline, final verification

**Files:** `e2e/shipwreck.spec.ts`, `e2e/shipwreck-walk.spec.ts`, `e2e/shipwreck-offline.spec.ts`, `e2e/perf.spec.ts` + `e2e/perf-budget.json` (her three scenes via `PERF_UPDATE=1`), `public/shipwreck-sw.js` (regenerate with its script only if the precache list changes; never by hand), `CLAUDE.md` only if a documented rule changed. No version bump, no changelog edit.

- [ ] **Step 1: e2e** (additive cases): `@smoke` pick the Carpathia → real run → reaches the end card at top speed; What-if with one forward spot and no finisher → end card (floats or sinks, assert it ends); her Walk button walks the boat deck; switch Carpathia → Lusitania → Carpathia shows the right scenes; offline start after one visit loads her.
- [ ] **Step 2: Perf**: add her scenes, `PERF_UPDATE=1 npx playwright test e2e/perf.spec.ts --project=chromium`, check no other entry moved (diff), commit the budget.
- [ ] **Step 3: Full verification**: `npm run validate`; `npm run test:rules`; `npx playwright test e2e/shipwreck*.spec.ts --project=chromium`; `@smoke` on webkit and the iPad project; `e2e/perf.spec.ts` on chromium. All PASS (list any failure outside Shipwreck as pre-existing with evidence from origin/main).
- [ ] **Step 4: Commit** (`test(shipwreck): e2e and perf for the Carpathia`).

**Drift audit C: skipped (parent will spot-check).** Was: the whole branch against the spec (every ruling implemented or noted), the sim rerun to spot-check README and test claims, the screenshots against references; findings fixed or listed as follow-ups.
