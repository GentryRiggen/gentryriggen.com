# Shipwreck — Costa Concordia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Costa Concordia (13 January 2012, Isola del Giglio) as the sixth playable ship in Shipwreck: the real night from the strike to her rest on her side on the rocks, a What if, her paint box, analytics, e2e and perf; released by this branch as 1.9.0 (or the next free minor).

**Architecture:** The ship format (`lib/shipwreck/ships/`) stays the single source of truth for the sim, model, X-ray, diagram and scene. This plan widens it for a ship that ends on a shallow, sloping shelf instead of a deep flat floor: a seabed that varies with position (shared by sim, scene and camera), a scripted drift path, external heeling moments (wind, the rock), a blackout from the water, a rule-based rest aground with its own time scale and outcome, and a `"rocks"` cause that reuses the iceberg What-if on her port side. Then her data, a new cruise-ship recipe with her real paint and a cruise fun-paint set, the night scene off Giglio, the UI, the analytics value and the release.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, React Three Fiber / three.js r186, zustand, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-shipwreck-concordia-design.md` (read it first; its north-star goals are re-read at the start of every task). The earlier Shipwreck specs and plans (`docs/superpowers/{specs,plans}/2026-11-2[0-2]-shipwreck*.md`) hold where this plan is silent. `lib/shipwreck/sim/README.md`, `components/shipwreck/model/README.md` and `components/shipwreck/scene/README.md` explain what exists.

## Global Constraints

- Everything in the earlier Shipwreck plans' Global Constraints applies: Prettier, `export default function`, `interface` props, Tailwind only, Safari 15.0 floor via `lib/game-kit/compat.ts` (no `Object.hasOwn`, no `.at()`, no `structuredClone`), static export, no people shown, pure deterministic sim (no `Math.random`), ship frame (x forward, y to port, z up from the keel; `roll`/`listDeg` + to starboard), budgets ≤ 160 draw calls and ≤ 450k triangles for the scene at the top tier, her model at `high` ≤ 100 calls and ≤ 330k triangles, no frame blocked > 8 ms.
- Worktree `/Users/griggen/dev/code/personal/gr-shipwreck-concordia`, branch `feat/shipwreck-concordia` off `origin/main` (1.8.0). Commit on it. **Never push, open PRs or merge** unless the controller says so. Use `npx next build --webpack` / `npx next dev --webpack` if Turbopack complains. Node 24 via mise (fix mise, never code around an old Node).
- **No other ship changes.** The Titanic, Lusitania and Fitzgerald goldens and the new Carpathia and Britannic goldens (Task 1, Step 1) pass after every task; every existing recipe snapshot deep-equals; other ships' `SCENE_SETTINGS` deep-equal; `e2e/perf-budget.json` changes only by added `shipwreck-concordia-*` entries.
- **Release:** only Task 8 bumps `SHIPWRECK_VERSION` (next free minor: 1.9.0 if main is still 1.8.0) and adds the `CHANGELOG` entry (from the spec's draft and the commits since 1.8.0, per CLAUDE.md "Shipwreck releases"). Never touch the icon v1 files. `public/shipwreck-sw.js` is generated: run its script, never edit it.
- Shared files: minimal, additive edits. `ShipId` union and `SHIP_IDS` append `"concordia"` after `"britannic"`; `cause` appends `"rocks"`; `SimEventKind` appends `"aground"`; `SimTrack.outcome` and `OUTCOME_IDS` append `"aground"`; analytics and rules lists append `'concordia'`. No reformatting or reordering of neighbours.
- Save key stays `shipwreck:v1`; new fields optional with defaults (no reset, no new key). Tests that use `"concordia"` as an unknown ship id switch to `"andrea-doria"`.
- Conventional commits `feat(shipwreck): …` / `fix(shipwreck): …` / `test(shipwreck): …`, each with the trailer `Assisted-by: Claude`. Each task: `npm run lint`, `npm run type-check`, the tests it touched, then `npm test`. Full e2e, perf and build only where a task says (Task 6 for perf, Task 8 for everything).
- Sources: cite every Concordia figure (dimensions, subdivision, damage, times, speeds, positions, depths, heel readings, weather) in `lib/shipwreck/sim/README.md`, every visible feature (paint, funnel and "C", boats, balconies, spa, pool roof, slide, bridge, masts, name) in `components/shipwreck/model/README.md`, every scene fact (coast, harbour lights, lighthouse, moon, seabed, seagrass) in `components/shipwreck/scene/README.md`, with the spec's source keys ([MIT], [SaS], [WPD], [WPS], [WPC], [WPP], [WC], [EMO], [OSM], [IIM]). The [MIT] report: download the gCaptain mirror (URL in the spec) into the session scratchpad, `pdftotext -layout` it, read figures with the Read tool's `pages`. Where sources disagree, pick one and say why.
- Kindness: no people, no voices, no blame, no captain, no "salute", captions never mention deaths. The parent line is the spec's exact copy.
- **Honest physics beats a test band** (the Britannic rule): bands are targets; if honest values (each inside a stated, sourced range) cannot reach a band, the builder stops and reports the numbers; the controller widens the band and the README says why. No parameter leaves its range to pass. Every rule is named "a rule, not physics" in the README.
- **Screenshot rule (every task that changes something visible):** PNGs (chromium 1133×744, plus 744×1133 where a task says) copied to `/Users/griggen/dev/code/personal/shipwreck-shots/concordia/NN-descriptive-name.png`, NN continuing the folder's numbering (create the folder and `captions.txt` if missing), and for each one a line `<filename> — what it shows` appended to `/Users/griggen/dev/code/personal/shipwreck-shots/concordia/captions.txt`. The report lists the absolute paths.
- Every report ends with a "Slowdowns" line and the screenshot list.

## Model per task and review depth (per the user's CLAUDE.md)

| Task | What                                   | Implementer | Review                                                    |
| ---- | -------------------------------------- | ----------- | --------------------------------------------------------- |
| 1    | Sim format: seabed, path, heel, rest   | Opus        | one combined review (spec + quality), Opus                |
| 2    | Her data, the real night, What-if sim  | Opus        | one combined review; then drift audit A (Opus, read-only) |
| 3    | Her model and paint box                | Opus        | one combined review                                       |
| 4    | Choosing her: UI, words, save, places  | Sonnet      | one combined review                                       |
| 5    | Analytics `ship` value (data boundary) | Sonnet      | spec review + adversarial review, re-review after fixes   |
| 6    | The night scene off Giglio + perf      | Opus        | one combined review                                       |
| 7    | e2e and offline                        | Sonnet      | one combined review                                       |
| 8    | Release 1.9.0 and full verification    | Sonnet      | controller spot-checks; full verification is the review   |

Reviews overlap the next implementer (read-only); only implementers commit, one at a time. Minor findings go to the ledger or fold into the next task's instructions.

## Review Focus

1. **Another ship regresses through shared code** (a seabed lookup, a path, a heel moment, a blackout rule or the aground rule that is `undefined` for them still changes a path; the floor lookup in `floorContact`/`stepFall`/`touch`/`sternDown`): pinned by five goldens (Task 1) and the perf budget (Tasks 6, 8).
2. **The floor on screen is the floor that holds her**: one `floorAt` for sim, scene mesh and camera clamp; her hull never through the shelf or the island; no camera under the shelf or inside the terrain. Pinned in Task 1 (`seabed.test.ts`), Task 6 (scene/camera tests, screenshots above and below water).
3. **A What-if that never settles or ends wrong**: blown out to sea with the real gash (capsize in deep water, landing on a sloping floor), two spots out to sea (floats far from land), no spots (no strike, sails on), WTC 5 and 6 whole (no blackout, keeps way): ends inside `endT` with an outcome, finite poses, the right end card. Pinned by Task 2's matrix and Task 4's end-card tests.
4. **Rule vs physics honesty**: the README marks the path, the blackout threshold, the aground roll and the emergency light level as rules; the list to grounding, the fill times and the stern touch come from physics with sourced inputs. The drift audit after Task 2 re-runs the sim and checks each claim.
5. **Switching ships** (title → Concordia → title → Titanic → Britannic): right model, paint box, scene (Giglio only for her, iceberg only for the Titanic), What-if editor and its toggle; old model disposed. Pinned in Task 4 (unit) and Task 7 (e2e).

---

## Task 1: Widen the ship format and the sim (no new ship yet) — Opus

Everything the Concordia needs from the physics, proven on test ships, every other ship unchanged.

**Files:**

- Create: `lib/shipwreck/sim/seabed.ts` (`floorAt`, shore distance, profile, rocks), `lib/shipwreck/sim/__tests__/carpathiaGolden.test.ts`, `lib/shipwreck/sim/__tests__/britannicGolden.test.ts` (+ fixtures per arch, as `lusitaniaGolden`), `lib/shipwreck/sim/__tests__/{seabedFloor,driftPath,heelMoments,blackout,aground,superstructureGz}.test.ts`
- Modify: `lib/shipwreck/ships/types.ts`, `lib/shipwreck/sim/{body,descent,headway,run,track,events,constants}.ts` as needed, `lib/shipwreck/types.ts` (`OUTCOME_IDS` append `"aground"`), `lib/shipwreck/sim/__tests__/testShips.ts`, `lib/shipwreck/sim/README.md`, `scripts/shipwreck-sim.ts` (`--to-sea`)

**Interfaces (Produces):**

```ts
// types.ts (additive)
cause: "iceberg" | "torpedo" | "storm" | "mine" | "rocks";

export interface SeabedSpec {
  /** Shoreline near her track, earth metres (x along her heading at the
   *  first event, y to port), in order along the coast. */
  shore: readonly (readonly [x: number, y: number])[];
  /** Which side of the polyline is sea (+1: left of its direction). */
  seaSide: 1 | -1;
  /** [metres offshore, depth m] pairs, ascending, linear, held past the end. */
  profile: readonly (readonly [offshoreM: number, depthM: number])[];
  /** Rock bumps: depth min(profile, topDepthM + (r/radiusM)²·rise) inside radiusM. */
  rocks?: readonly { x: number; y: number; radiusM: number; topDepthM: number }[];
}
// ShipSpec (all optional, undefined for every existing ship):
seabed?: SeabedSpec;
gash?: { side: "port" | "starboard"; zLow: number; zHigh: number; areaM2: number };
heel?: {
  wind?: { fromDeg: number; kn: number; areaM2: number; leverM: number; cd: number };
  rock?: { t: number; massT: number; x: number; y: number; z: number };
};
blackout?: { compartmentId: string; depthM: number; emergencyLight: number };
aground?: {
  restDeg: number;
  minListDeg: number;
  /** [real s after the first event, roll deg] pace, ascending. */
  pace: readonly (readonly [realT: number, deg: number])[];
};
agroundTimeScale?: number;
headway?: { …existing;
  /** [shown s, earth x, earth y, heading deg (+ to port, 0 at the first event)]. */
  path?: readonly (readonly [t: number, x: number, y: number, yawDeg: number])[];
  /** The same until it diverges; used with SimOptions.toSea. */
  pathToSea?: readonly (readonly [t: number, x: number, y: number, yawDeg: number])[];
};

// SimOptions (additive)
/** Drift by `headway.pathToSea` (the What if "blown out to sea"). */
toSea?: boolean;

// seabed.ts
export function floorAt(spec: ShipSpec, x: number, y: number): number; // earth z (negative), −seaDepthM without a seabed
// events.ts: SIM_EVENT_KINDS append "aground"; track.ts: outcome "sank" | "floated" | "aground"
```

- [ ] **Step 1: Pin the unpinned ships first.** Before touching the sim, write `carpathiaGolden.test.ts` and `britannicGolden.test.ts` mirroring `fitzgeraldGolden.test.ts` (real run + one What-if each: the Carpathia without the finisher, the Britannic with doors closed), fixtures by `UPDATE_GOLDEN=1` from the unchanged code, both arches if the existing goldens carry both (generate the other in CI or note it as the existing goldens do). Run all five goldens: PASS. Commit (`test(shipwreck): pin the Carpathia's and the Britannic's tracks`).
- [ ] **Step 2: Failing tests** on box test ships (`testShips.ts` gains a 200 m box with a 30 m deckhouse box):
  - `superstructureGz.test.ts`: the box-on-box's righting lever at 0–90° in 10° steps matches the analytic GZ (wall-sided hull plus deckhouse, computed in the test) within 3%, dry deckhouse buoyant, flooded deckhouse not.
  - `seabedFloor.test.ts`: `floorAt` without `seabed` is exactly `−seaDepthM` everywhere; with a straight shore and profile `[[0,0],[100,25],[300,100]]` it gives 25 m at 100 m offshore and interpolates; a rock bump lifts the floor inside its radius only; a box flooded aft drifting toward the shelf touches the floor first at its stern, at the floor depth under that point (not `seaDepthM`), loses its way at that step, and holds still on the contact (no creep > 0.1 m over 600 s); a box sinking past the shelf lands on the deep floor under it.
  - `driftPath.test.ts`: a path `[[0,0,0,0],[600,4000,0,0],[1200,4000,-1500,-120]]` puts the earth origin within 1 m of each point at its time and the heading at −120° at 1200 s; pitch, roll, heave and flooding identical to the same run without a path to 1e-9; way lost at the first floor touch (position frozen after); `toSea` follows `pathToSea`; no `path` → existing headway tests unchanged.
  - `heelMoments.test.ts`: a beam wind on an intact box heels it to the static angle M/(Δ·g·GM) ± 5% (small angle); wind dead ahead gives no heel; the rock mass at y = +10 m lists it to port by the expected angle from t; neither present → identical track.
  - `blackout.test.ts`: `lights-out` fires the step the named compartment's water reaches `depthM`; `power` after it is `emergencyLight`, never 0; pumps stop; without `blackout` the 1.0 dynamo rule is unchanged.
  - `aground.test.ts`: a flooded box resting on a 25 m shelf listed 15° eases to `restDeg` along `pace`, never decreasing, its lowest point at the floor depth under it ± 0.3 m every frame, logs `aground` once, then `floating-steady`, outcome `"aground"`; with `agroundTimeScale: 6` shown time after `aground` advances 1/6 of real time and frames carry `realT`; listed less than `minListDeg` or not touching: no rule; no `aground` field: no change.
- [ ] **Step 3: Implement** until PASS: `seabed.ts` (pure, allocation-free per call; shore distance by segment projection, sign by side); `floorContact` looks up `floorZ` per contact point at its earth x, y (the body's earth origin plus its yaw-rotated ship x, y), normal vertical; `stepFall`/`touch`/`sternDown` read the floor under the lowest point; the path through `headway.ts` (`pathAt(h, t, opts)` → x, y, yaw; speed from its derivative for the existing users of `speedAt`); heel moments added to the roll equation in `body.ts` (the rock as mass from `t`); the blackout rule beside the dynamo rule; the aground rule beside `seated` in `descent.ts` (or a new `aground.ts`); `aground` event and outcome. Every new path gated on its field. All sim tests and the five goldens PASS.
- [ ] **Step 4: README**: the seabed (formula, sources to come in Task 2), the path, heel moments, blackout, the aground rule and time scale; each marked physics or "a rule, not physics"; the known limits (vertical contact normal, no sway, no slide).
- [ ] **Step 5: Commit** (`feat(shipwreck): a sloping seabed, a drift path, heel moments and a rest aground in the sim`).

## Task 2: Her data, the real night and the What-if sim — Opus

**Files:**

- Create: `lib/shipwreck/ships/concordia.ts`, `lib/shipwreck/sim/__tests__/concordia.test.ts`, `lib/shipwreck/sim/__tests__/concordiaNight.test.ts`, `lib/shipwreck/sim/__tests__/concordiaWhatIf.test.ts`
- Modify: `lib/shipwreck/ships/types.ts` (`ShipId` += `"concordia"`), `lib/shipwreck/ships/index.ts` (append to `SHIP_IDS`, `SHIPS`; export `CONCORDIA_BOATS`, `CONCORDIA_DECKS`), `lib/shipwreck/sim/run.ts` (`whatIfSpots`/`whatIfOpenings`/`whatIfRealIds` for `"rocks"`: the iceberg path with `spec.gash`), `lib/shipwreck/sim/README.md` ("The Concordia's data and sources", "The Concordia's calibration", pass criteria), `scripts/shipwreck-sim.ts` (`--ship=concordia`), `jest.sims.js` if a file runs > 45 s
- Every `Record<ShipId, …>` the type-check flags gets a **placeholder Concordia entry that a later task replaces** (`// Task N` comment), so each commit compiles.

**Interfaces:**

- Consumes: Task 1's format.
- Produces: `concordia: ShipSpec` (`cause: "rocks"`, `clockStartS: 21*3600 + 45*60 + 7`, `preRollS` ~40, `seaDepthM: 30`, `seabed`, `headway.path`/`pathToSea`, `heel`, `blackout`, `aground`, `agroundTimeScale: 6`, `gash`, `doors`, `wreck`, one funnel `falls: false`, 26 boats in `CONCORDIA_BOATS` `{ index, side, x }`, `CONCORDIA_DECKS` named 0, 1–14 as her deck plan has them), her liveries (Task 3 fills the paint; a placeholder single real livery here).

- [ ] **Step 1: Research and data tests first.** Read [MIT] §2–4 (positions, times, heel readings, the damage table, the WTC figures) and the parbuckling sources; trace the shore near the track from [OSM] (simplify to about 20 m) and convert lat/lon to her earth frame (origin her midships at the strike, x along 350°: document the projection); build the depth profile from the cited depths ([MIT] 27 m at rest and 100 m at the anchor, [WPD] 20 m, [WPP] 30 m ledge, [WPS] 70 m trough, [EMO] outer). `concordia.test.ts`: LOA 290.2 ± 0.3, LBP 247.4 ± 0.1, beam 35.5 ± 0.05; ≥ 41 stations; hydrostatic displacement at 8.12 m even keel within 2% of 56,600 t; intact GM 1.5–3 m; WTC 4–8 at [MIT]'s frames (0.725 m spacing, frame 0 at the AP unless the figures say otherwise) with deck 0 tops at 14.18 m; door WTC 5 → 4 on their shared bulkhead; the gash openings lie between frames 52 and 124, port side, from the bilge strake to 1 m under the 8.12 m waterline; 26 boats, 13 a side; `floorAt` at the report's 22:58 fix (converted) gives 20–32 m and at the 22:13 anchor point ≥ 80 m; the path passes within 100 m of the AIS 22:14 fix at 22:14 and ends at the 22:58 fix.
- [ ] **Step 2: Write `concordia.ts`** from the cited sources. PASS.
- [ ] **Step 3: The real night, failing tests** (`concordiaNight.test.ts`, `simulate(concordia, concordia.realNight)`): exactly the spec's pass criteria (fill times of WTC 5, 6, 4 and 7; `lights-out` 30–90 s and the emergency level after; port list first then starboard by 35 min and never back; 10° ± 4 at 45 min; down by the stern from 10 min; first floor touch aft of midships at 48–62 min where the floor is 12–35 m deep, list 12°–25° then; `aground`; rest 65° ± 2, lowest point 20–32 m, port shell and a third of the superstructure above water, heading 180°–220°, within 150 m of the 22:58 fix, rest within 25 shown min of `aground` and at real 00:30–01:00; no `breakup`, no `stern-under`; outcome `aground`; deterministic; finite; inside `endT`).
- [ ] **Step 4: What-if matrix, failing tests** (`concordiaWhatIf.test.ts`): spots are her compartments; real ids = WTC 4–8; each single spot and each neighbouring pair → `floated` ("She stayed afloat."); neighbouring triples 4–6, 5–7, 6–8 → `floated`; real five + `toSea` → capsizes and `sank` (rests on the deep floor by her `wreck` rule); a pair + `toSea` → `floated`; no spots → no strike, `floated`, no `lights-out`; any set without WTC 5 and 6 → no blackout, she keeps her way; every run ends inside `endT` with an outcome and finite poses.
- [ ] **Step 5: Calibrate** inside honest ranges (gash areas per compartment, the PEM door's area, wind C_d and area from her profile, the blackout depth, KG within R3, girder within R24) until PASS; log each tuned value and its reasoning in the README calibration section; report the list at 22:20/22:30/22:39, the touch time and depth, the fill times and the What-if outcomes. Goldens PASS. If a band cannot be met honestly, stop and report (Global Constraints).
- [ ] **Step 6: Commit** (`feat(shipwreck): the Costa Concordia's data and her real night`).

**Drift audit A (Opus, read-only) after Task 2:** re-read the north stars and rulings; run `npx tsx scripts/shipwreck-sim.ts --ship=concordia`, `--to-sea` and three What-ifs; check every README claim and test number against the output; confirm each rule is named a rule and each physics input has a source; list drift. Findings fold into Task 3's or Task 4's instructions.

## Task 3: Her model and paint box — Opus

**Files:**

- Create: `components/shipwreck/model/concordiaRecipe.ts`, `components/shipwreck/model/__tests__/concordiaRecipe.test.ts`
- Modify: `components/shipwreck/model/shipModel.ts` (`recipeFor` dispatch), `partGeometry.ts` / `buildShip.ts` / `materials.ts` / `textures.ts` only where a cruise part needs a new builder (balcony and window-band panels, glass, the funnel shape and "C" decal, the slide tube) and only additively, `components/shipwreck/model/ModelViewer.tsx` (`?model&ship=concordia`), `scripts/shipwreck-model-shots.mjs`, `components/shipwreck/model/README.md` ("The Costa Concordia"), `lib/shipwreck/ships/concordia.ts` (her `liveries`, `funnelPaint`), `lib/shipwreck/ships/funPaints.ts` (`cruiseFun()`), `lib/shipwreck/__tests__/liveries.test.ts` (her real id), `components/shipwreck/scene/ShipRig.tsx` only to show the rock stuck in her side from the strike

**Interfaces:**

- Consumes: `concordia`, `CONCORDIA_DECKS`, `CONCORDIA_BOATS` (Task 2).
- Produces: `concordiaRecipe(spec: ShipSpec, livery?: string): ShipRecipe`; any new recipe fields optional (other recipes deep-equal their snapshots); `cruiseFun(): readonly Livery[]`; her `handles.setLivery(id)` repaints without rebuilding geometry (the 1.7 mechanism); her emergency-light mask (which panes stay lit after `lights-out`) as a recipe field the scene reads in Task 6.

- [ ] **Step 1: Research the look** from [WC] photographs of her (sisters only where hers are missing, named) and write the model README section with a source per feature: hull white, the blue waterline line, red bottom and their heights; the name on bow and stern; window bands and balcony rows by deck and their extent fore and aft; the stepped aft terraces; the bridge and wings (deck, width); radar and signal masts; the spa forward (windows, shape); the pool's glass roof and glass sides; the sports deck; the water slide (where, colour, shape); the funnel (shape, height, the yellow, the blue "C" on each side, the cap and exhausts); 26 lifeboats (colour, recess, davits); liferaft canisters; thrusters, two propellers, two rudders, stabilisers if visible; the rock at frame 52.
- [ ] **Step 2: Failing tests**: placements inside her hull and superstructure bounds; one funnel at the spec's x with the "C" on both sides in her real paint only; 26 boats and davits matching `CONCORDIA_BOATS`; two propellers, two rudders; balcony and window panels on both sides covering the decks the README lists; the hull's paint bands at the README's heights; her real livery `costa-2012` default; ≥ 5 fun paints from `cruiseFun()`, none copying hers, each under the saturation cap (`liveries.test.ts` extended with her id; its other checks cover her); `setLivery` round-trips without new geometry; other ships' recipe snapshots deep-equal.
- [ ] **Step 3: Write the recipe and `cruiseFun()`** (generic labels, no current company names; recolour hull to deck 3, bottom, boot-top, funnel and top, boats; the superstructure stays white). PASS.
- [ ] **Step 4: Budget and look**: at `high` ≤ 100 draw calls and ≤ 330k triangles (`handles.stats`), build time ≤ the Titanic's + 30%. Model-viewer screenshots: bow 3/4 starboard, bow 3/4 port (with the rock), stern 3/4 (props, rudders, terraces), side profile, top-down, close on the funnel and "C", close on a lifeboat row, the bridge front, two fun paints; plus the Titanic bow 3/4 unchanged. Screenshot rule.
- [ ] **Step 5: Commit** (`feat(shipwreck): the Costa Concordia model and her paint box`).

## Task 4: Choosing her, her story, her places, What if — Sonnet

**Files:**

- Modify: `components/shipwreck/ui/TitleScreen.tsx` (her card after the Britannic), `components/shipwreck/ui/{WhatIfEditor,HullDiagram,EndCard,Captions,NightPanels,Hud}.tsx` as needed, `components/shipwreck/ui/Icon.tsx` (a rock-tear spot picture and a wind-out-to-sea picture), `lib/shipwreck/{story,places,help,whatIf,save,playback,xray,testHooks}.ts`, `components/shipwreck/parentLine.ts`, `components/shipwreck/Shipwreck.tsx`, `components/shipwreck/scene/xrayGeometry.ts` (her X-ray blockouts) if the X-ray needs her
- Tests: `lib/shipwreck/__tests__/{story,save,help,xray,playback,analytics,liveries}.test.ts` (unknown-ship example → `"andrea-doria"`), new `lib/shipwreck/__tests__/concordiaStory.test.ts`, `components/shipwreck/__tests__/Shipwreck.test.tsx`, `components/shipwreck/ui/__tests__/{TitleScreen,WhatIfEditor,EndCard}.test.tsx`

**Interfaces:**

- Consumes: `SHIPS`, `concordia`, `whatIfSpots` (Task 2), her recipe (Task 3).
- Produces: save `ShipWhatIf.toSea?: boolean`; `SAVE_SHIP_IDS` appends `"concordia"`; playback passes `toSea` to `simulate`; `PARENT_LINES.concordia` (spec's exact copy); `PLACES_BY_SHIP.concordia`; spot words for `"rocks"` ("The generator room: the rock tears it open" / "not torn"); end-card words for `aground`.

- [ ] **Step 1: Failing tests**:
  - story: every `SimEventKind` (with `aground`) has a Concordia caption or explicit null; the 1.0 word-list guard (no deaths, no people in danger) plus a new guard for her (no "captain", "salute", "inchino", "fault", "blame"); `sinceText(720, concordia)` = `"12 min after the rocks"`; `clockText(0, concordia.clockStartS)` = `"9:45 PM"`; captions for the blackout, the emergency lights, the drift back to the island, touching the rocks, lifeboats, her rest; the clock after `aground` shows real time.
  - save: `whatIfByShip.concordia` round-trips `{ ids, toSea }`; an old save without them defaults to the real night; `aground` in `seen.endings` parses; unknown ship `"andrea-doria"` dropped.
  - places: the bridge, the rock in her side, the electric motor room, a generator room, a lifeboat, the funnel, the pool under its roof: inside her hull or superstructure; compartments exist.
  - WhatIfEditor for a rocks ship: port-side compartment spots (multi-select) plus one picture toggle (testid `whatif-to-sea`, aria label, help line); other ships' editors unchanged (their tests).
  - EndCard: real night reads "She came to rest on her side by Giglio's harbour at 12:41 AM, …" (the time from the run), `floated` "She stayed afloat.", no spots "She sailed safely past the island.", to sea and sank "Blown out to sea, she rolled over and sank."
  - Shipwreck: title → Concordia → back → Titanic builds the right model and disposes the other (spy on `dispose`); her paint box opens with one real and ≥ 5 fun paints.
- [ ] **Step 2: Implement** until PASS.
- [ ] **Step 3: Screenshots** (screenshot rule): title screen with six cards (1133×744 and 744×1133), her HUD at 22:15, the X-ray with WTC 5–7 full and water on deck 0, the What-if editor, each end card.
- [ ] **Step 4: Commit** (`feat(shipwreck): choose the Costa Concordia`).

## Task 5: Analytics `ship` value (data boundary: spec review + adversarial review) — Sonnet

**Files:** `lib/analytics/gameEvents.ts` (`SHIPWRECK_SHIPS`), `firestore.rules` (both `p.ship in [...]` lists), `firestore-tests/gameEvents.test.ts`, `lib/analytics/gameAggregate.ts` and `components/admin/GamesView.tsx` (+ tests) where they list ships, `lib/shipwreck/__tests__/analytics.test.ts`, `lib/analytics/__tests__/gameRulesSync.test.ts` if it needs the new value

- [ ] **Step 1: Failing tests**: `shipwreck_start` and `shipwreck_end` accept `ship: "concordia"` in the schema and the rules; rules still reject `"andrea-doria"`, a number and an extra prop; `trackEnd(…, "aground", …)` sends `outcome: "sank"` (pinned) and the rules' outcome list is unchanged; the dashboard shows Concordia starts and ends; existing values unchanged; `SHIPWRECK_SHIPS` equals `SHIP_IDS`. No new props (the toggle is not counted).
- [ ] **Step 2: Implement** schema, rules and dashboard together, appending only. `npm run test:rules` (Java 21+; if it cannot run, say so verbatim and the controller runs it in Task 8).
- [ ] **Step 3: Commit** (`feat(shipwreck): count Costa Concordia runs`). Then spec review and adversarial review (read-only, in parallel with Task 6), fixes, re-review.

## Task 6: The night off Giglio, and her perf budget — Opus

**Files:**

- Create: `components/shipwreck/scene/giglio.ts` (her coastline, terrain heights, harbour, lights, Le Scole: data and geometry builders) and its test
- Modify: `components/shipwreck/scene/settings.ts` (`concordia` entry: `timeOfDay: "night"`, moon, cloud, chop, `coast: true`, heading), `Sky.tsx` (the moon if it was up: computed for 42.36° N 10.92° E, 13 Jan 2012, 21:45–00:45 CET, cited), `Sea.tsx` (a light NE chop for her only), `Coast.tsx` (third coastline: Giglio, lit windows, mole lights, the lighthouse, Castello), `Environment.tsx` (the `floorAt` floor mesh with granite/sand shading and instanced seagrass cards; the flat floor for every other ship unchanged), `Effects.tsx` (the strike's spray along her port side aft; her lifeboats' small lamps), `ShipRig.tsx` (lights to the emergency mask after `lights-out`; lifeboats lowering from the starboard side then port, three port boats staying), `CameraRig.tsx` / `cameraMath.ts` (floor clamp by `floorAt`, terrain clamp, her hull boxes at 65°, her shots), `SceneCheck.tsx` (`&ship=concordia`), `components/shipwreck/scene/README.md` ("The Concordia's night", OSM attribution), `e2e/perf.spec.ts` + `e2e/perf-budget.json` (three Concordia scenes)
- Tests: `components/shipwreck/scene/__tests__/{settings,cameraMath,giglio}.test.ts`

**Interfaces:**

- Consumes: `floorAt` and her `seabed` (Tasks 1–2), her recipe and emergency mask (Task 3), the track's path and events.
- Produces: `SCENE_SETTINGS.concordia`; `buildGiglioGeometry()`; perf scenes `shipwreck-concordia-salute` (lit, passing the island before the strike), `shipwreck-concordia-drift` (after the blackout, listing about 10°, harbour behind), `shipwreck-concordia-aground` (at rest on her side, harbour lights).

- [ ] **Step 1: Failing tests**: other ships' settings deep-equal; her moon azimuth/elevation match the computed values (or no moon if it was down) with the source in a comment; the Giglio terrain's shoreline matches `seabed.shore` within 5 m (one source of truth: build both from the same data); the floor mesh's height at sample points equals `floorAt` ± 0.2 m; the camera never goes under `floorAt` or inside the terrain or inside her hull at the rest pose (sampled orbits); the strike spray fires once at `collision` on her port side.
- [ ] **Step 2: Build** the night: the island close by with its lights, the harbour and lighthouse, Le Scole, stars and moon, the chop, her lit passage, the blackout to emergency lights, the drift, the lifeboats, her rest half out of the water, under water the shelf, the spurs and seagrass with her side on them.
- [ ] **Step 3: Budgets**: run the three scenes on `high`; ≤ 160 calls, ≤ 450k triangles each; record with `PERF_UPDATE=1 npx playwright test e2e/perf.spec.ts --project=chromium`; check in the diff that every existing entry is unchanged.
- [ ] **Step 4: Screenshots** (1133×744 and 744×1133; screenshot rule): passing the island lit; the strike; the blackout; drifting with the harbour behind; listing as the stern touches; lifeboats going down; at rest on her side with the harbour lights (above water); under water on the shelf (her side on the spurs); the Titanic at 11:45 PM unchanged.
- [ ] **Step 5: Commit** (`feat(shipwreck): a January night off Giglio`).

## Task 7: e2e and offline — Sonnet

**Files:** `e2e/shipwreck.spec.ts`, `e2e/shipwreck-offline.spec.ts`, `e2e/support/*` helpers only additively, `lib/shipwreck/testHooks.ts` if a hook needs her outcome, `public/shipwreck-sw.js` (regenerated by its script only if precache lists change)

- [ ] **Step 1: e2e**: `@smoke` pick the Costa Concordia → real night → end card at ×100 reads her rest by the harbour; What-if with WTC 5 and 6 only → "She stayed afloat."; What-if real spots + blown out to sea → "Blown out to sea, she rolled over and sank."; her paint box repaints her live (one fun paint, back to hers); switch back to the Titanic and see the iceberg and no Giglio; offline start after one visit loads her; her Walk button is hidden.
- [ ] **Step 2: Run** `npx playwright test e2e/shipwreck.spec.ts e2e/shipwreck-offline.spec.ts --project=chromium`; `@smoke` on webkit and iPad for the new cases. Screenshots of any failure, per the screenshot rule.
- [ ] **Step 3: Commit** (`test(shipwreck): the Costa Concordia end to end`).

## Task 8: Release 1.9.0 and full verification — Sonnet (controller spot-checks)

**Files:** `lib/shipwreck/version.ts`, `lib/shipwreck/changelog.ts`, the sim, model and scene READMEs (final numbers), `CLAUDE.md` only if a Shipwreck rule changed (it should not)

- [ ] **Step 1: Version**: `git fetch origin && git show origin/main:lib/shipwreck/version.ts`; bump `SHIPWRECK_VERSION` to the next free minor after main's (1.9.0 if main is 1.8.0); if main moved, rebase or merge first and rerun Task 1's goldens.
- [ ] **Step 2: Changelog**: a new top entry from the spec's draft and `git log <1.8.0 commit>..HEAD -- lib/shipwreck components/shipwreck app/shipwreck public/shipwreck-icons public/shipwreck-sw.js`, in plain words a young player or their parent would follow (title "The Costa Concordia"); `changelog.test.ts` PASS. Icon v1 files untouched (`git diff --stat origin/main -- public/shipwreck-icons` empty).
- [ ] **Step 3: Full verification once**: `npm run validate`; `npm run test:rules` (Java 21+; report verbatim if unavailable); `npx playwright test e2e/shipwreck*.spec.ts --project=chromium`; `@smoke` on webkit and iPad; `npx playwright test e2e/perf.spec.ts --project=chromium` (only `shipwreck-concordia-*` entries new); `npm run build`. Record failures verbatim; list any known red tests on main separately.
- [ ] **Step 4: Final screenshots** (screenshot rule): the Versions page with 1.9.0, the title screen with her card, her rest on the rocks at night.
- [ ] **Step 5: Commit** (`feat: Shipwreck 1.9.0 — the Costa Concordia`).
