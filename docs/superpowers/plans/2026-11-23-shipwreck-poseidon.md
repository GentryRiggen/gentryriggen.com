# Shipwreck — Poseidon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Poseidon, a made-up modern cruise ship that evokes the 2006 film's, as the seventh playable ship in Shipwreck: a rogue wave on New Year's Eve rolls her keel up (a stated rule), then physics floods her, holds her up on trapped air and sinks her; a What if, her paint box, analytics, e2e and perf; released by this branch as 1.11.0 (or the next free minor).

**Architecture:** The ship format (`lib/shipwreck/ships/`) stays the single source of truth for the sim, model, X-ray, diagram and scene. This plan widens it for a ship that floats upside down: trapped air in every space (Boyle and the orifice laws), superstructure boxes as named spaces with their own openings, a wave roll rule with a `"wave"` cause and its What-if spots and chip, blackout by list, a `capsized` event, outcome and time scale, a short end for runs that ride the wave out, and a dive that keeps her keel up. Then her data, a cruise kit lifted out of the Concordia's recipe, her own model on it, the UI (playable end to end there), the analytics value, the wave night scene and perf, e2e, and the release.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, React Three Fiber / three.js r186, zustand, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-shipwreck-poseidon-design.md` (read it first; its north-star goals are re-read at the start of every task; its "Seams and risks" table is the checklist). The earlier Shipwreck specs and plans (`docs/superpowers/{specs,plans}/2026-11-2[0-3]-shipwreck*.md`, the Concordia's above all) hold where this plan is silent. `lib/shipwreck/sim/README.md`, `components/shipwreck/model/README.md` and `components/shipwreck/scene/README.md` explain what exists.

## Global Constraints

- Everything in the earlier Shipwreck plans' Global Constraints applies: Prettier, `export default function`, `interface` props, Tailwind only, Safari 15.0 floor via `lib/game-kit/compat.ts` (no `Object.hasOwn`, no `.at()`, no `structuredClone`), static export, no people shown, pure deterministic sim (no `Math.random`), ship frame (x forward, y to port, z up from the keel; `roll`/`listDeg` + to starboard, unwrapped: keel up is about +180), budgets ≤ 160 draw calls and ≤ 450k triangles for the scene at the top tier, her model at `high` ≤ 100 calls and ≤ 300k triangles, no frame blocked > 8 ms.
- Worktree `/Users/griggen/dev/code/personal/gr-shipwreck-poseidon`, branch `feat/shipwreck-poseidon` off `origin/main` (1.10.0). Commit on it. **Never push, open PRs or merge** unless the controller says so. Use `npx next build --webpack` / `npx next dev --webpack` if Turbopack complains. Node 24 via mise (fix mise, never code around an old Node).
- **No other ship changes.** The six goldens (Titanic, Lusitania, Fitzgerald, Carpathia, Britannic, and the Concordia real-night golden from Task 1) and `concordiaToSeaFixture` pass after every task; every recipe snapshot deep-equals (the Concordia's from Task 1 included); other ships' `SCENE_SETTINGS` deep-equal; `e2e/perf-budget.json` changes only by added `shipwreck-poseidon-*` entries. Every new sim path is gated on a new optional field.
- **Release:** only Task 11 bumps `SHIPWRECK_VERSION` (next free minor: 1.11.0 if `origin/main` is still 1.10.0) and adds the `CHANGELOG` entry (from the spec's draft and the commits since 1.10.0, per CLAUDE.md "Shipwreck releases"). Never touch the icon v1 files. `public/shipwreck-sw.js` is generated: run its script, never edit it.
- Shared files: minimal, additive edits. `ShipId` union and `SHIP_IDS` append `"poseidon"` after `"concordia"`; `cause` appends `"wave"`; `SimEventKind` appends `"capsized"`; `SimTrack.outcome` and `OUTCOME_IDS` append `"capsized"`; analytics and rules lists append `'poseidon'`. No reformatting or reordering of neighbours.
- Save key stays `shipwreck:v1`; new fields optional with defaults (no reset, no new key).
- **Shaders (1.8.2 lesson):** every `pow()`/`sqrt()`/`log()` argument in new or changed GLSL is clamped (`max(x, 0.0)` or `max(x, 1e-6)`), every division guarded. A new unit test (Task 9) scans the shader strings the Poseidon path adds for unguarded calls.
- Conventional commits `feat(shipwreck): …` / `fix(shipwreck): …` / `test(shipwreck): …` / `refactor(shipwreck): …`, each with the trailer `Assisted-by: Claude`. Each task: `npm run lint`, `npm run type-check`, the tests it touched, then `npm test`; `npm run test:sims` in every task that changes the sim or her data (Tasks 1–4). Full e2e, perf and build only where a task says (Task 9 for perf, Task 11 for everything).
- Sources: cite every wave, air, machinery and ocean figure in `lib/shipwreck/sim/README.md` ("The Poseidon"), every look reference in `components/shipwreck/model/README.md` ("The Poseidon"), every scene fact in `components/shipwreck/scene/README.md`, with the spec's keys ([DRA], [QE2], [ND], [LM], [ROG], [SOL], [BOY], [SEW], [CR], [WC], [ATL]). Her particulars are ours: say so beside each one. Nothing from the film's art.
- Kindness: no people, no voices, no film plot, no deaths, no "survivors". The parent line is the spec's exact copy.
- **Honest physics beats a test band** (the Britannic rule): bands are targets; if honest values (each inside a stated range) cannot reach a band, the builder stops and reports the numbers; the controller widens the band and the README says why. No parameter leaves its range to pass. Every rule is named "a rule, not physics" in the README.
- **Every What-if ends** (the Carpathia pose-box lesson): every run in the What-if matrix ends inside `endS` with an outcome; a test asserts it for the whole matrix, not a sample.
- **Screenshot rule (every task that changes something visible):** PNGs (chromium 1133×744, plus 744×1133 where a task says) copied to `/Users/griggen/dev/code/personal/shipwreck-shots/poseidon/NN-descriptive-name.png`, NN continuing the folder's numbering (create the folder and `captions.txt` if missing), and for each one a line `<filename> — what it shows` appended to `/Users/griggen/dev/code/personal/shipwreck-shots/poseidon/captions.txt`. The report lists the absolute paths.
- Every report ends with a "Slowdowns" line and the screenshot list.

## Model per task, kind and review depth (per the user's CLAUDE.md)

| Task | What                                                 | Kind            | Implementer | Review                                                    | Batch            |
| ---- | ---------------------------------------------------- | --------------- | ----------- | --------------------------------------------------------- | ---------------- |
| 1    | Pins: Concordia golden and recipe snapshot           | test only       | Sonnet      | controller spot-check (trivial)                           | with Task 2      |
| 2    | Sim: trapped air, boxes as spaces, keel-up tests     | sim             | Opus        | one combined review (spec + quality), Opus                | with Task 1      |
| 3    | Sim: the wave rule, capsized, ends, the dive keel up | sim             | Opus        | one combined review, Opus                                 |                  |
| 4    | Her data, the real night, the What-if matrix         | sim / data      | Opus        | one combined review; then drift audit A (Opus, read-only) |                  |
| 5    | The cruise kit out of the Concordia's recipe         | model plumbing  | Opus        | one combined review                                       | may batch with 6 |
| 6    | Her model and paint box                              | model           | Opus        | one combined review                                       | may batch with 5 |
| 7    | Choosing her: UI, words, save, places (MVP playable) | UI / plumbing   | Sonnet      | one combined review                                       |                  |
| 8    | Analytics `ship` value (data boundary)               | data boundary   | Sonnet      | spec review + adversarial review, re-review after fixes   |                  |
| 9    | The wave night: sea, lights, camera, X-ray, perf     | scene           | Opus        | one combined review                                       |                  |
| 10   | e2e and offline                                      | test / plumbing | Sonnet      | one combined review                                       |                  |
| 11   | Release 1.11.0 and full verification                 | release         | Sonnet      | controller spot-checks; full verification is the review   |                  |

Reviews overlap the next implementer (read-only); only implementers commit, one at a time. Task 8's two reviews run while Task 9's implementer works. Minor findings go to the ledger or fold into the next task's instructions. **MVP milestone:** after Task 7 she is playable end to end (title card, real night, What if, end card, paint box) on the Fitzgerald's storm sea at night; Tasks 8–11 make her shippable.

## Review Focus

1. **Another ship regresses through shared code** (trapped air, box flood points, the steady test in a storm, the dive's roll, `waveRide` exclusions, the cruise kit): pinned by seven goldens/fixtures (Task 1), every recipe snapshot (Task 1 for the Concordia) and the perf budget (Tasks 9, 11).
2. **Keel up is honest and finite**: she floats keel up only because air is caught in her; no NaN pose, no Infinity in the hull diagram, no camera inside her inverted hull, no turning upright in the dive. Pinned in Task 2 (box ships), Task 4 (her night), Task 7 (diagram, words), Task 9 (camera, X-ray).
3. **A What-if that never ends or ends wrong**: smaller wave (rights herself, `rideOut`), from ahead (rides over), real wave with no spots (keel up to `endS`, `capsized`), single spots: every run ends inside `endS` with the right end card. Pinned by Task 4's full matrix and Task 7's end-card tests.
4. **Rule vs physics honesty**: the README marks the roll, the blackout threshold, `rideOut`, `endS`, the dive's roll and the keel-up rest as rules; flooding, trapped air, the keel-up attitude and the sinking come from physics with stated inputs. Drift audit A re-runs the sim and checks each claim.
5. **Her look is hers**: not the film's, not the Concordia's; the dome and the raked funnel read at a glance; budgets met. Pinned in Task 6.
6. **Switching ships** (title → Poseidon → title → Fitzgerald → Concordia): right model, paint box, scene (storm sea for her and the Fitzgerald, Giglio only for the Concordia), What-if editor and its chip; old model disposed. Task 7 (unit) and Task 10 (e2e).

---

## Task 1: Pin the Concordia before anything moves — Sonnet (batched with Task 2)

**Files:**

- Create: `lib/shipwreck/sim/__tests__/concordiaGolden.test.ts` (+ fixtures per arch, as `britannicGolden`), `components/shipwreck/model/__tests__/concordiaRecipeSnapshot.test.ts` (+ fixture, as `titanicRecipeSnapshot`)
- Modify: `jest.sims.js` (the golden, if it runs > 45 s)

- [ ] **Step 1:** Write `concordiaGolden.test.ts` mirroring `britannicGolden.test.ts` (real night only; the to-sea fixture exists). Generate its fixture with `UPDATE_GOLDEN=1 npx jest lib/shipwreck/sim/__tests__/concordiaGolden.test.ts` from the unchanged code; both arches if the existing goldens carry both (else note it as they do).
- [ ] **Step 2:** Write `concordiaRecipeSnapshot.test.ts` mirroring `titanicRecipeSnapshot.test.ts`: `concordiaRecipe(concordia)` and each fun paint's recipe serialised and deep-equal to a fixture written now.
- [ ] **Step 3:** Run all goldens and snapshots: `npx jest lib/shipwreck/sim/__tests__/ -t Golden` and `npx jest components/shipwreck/model/__tests__/` → PASS. `npm run test:sims` → PASS.
- [ ] **Step 4:** Commit (`test(shipwreck): pin the Concordia's night and recipe`).

## Task 2: Trapped air and boxes as spaces (no new ship yet) — Opus

Everything an upside-down ship needs from the flooding, proven on box test ships, every other ship unchanged.

**Files:**

- Create: `lib/shipwreck/sim/air.ts` (Boyle head, sealed test, gas orifice), `lib/shipwreck/sim/__tests__/{trappedAir,boxSpaces,keelUpGz}.test.ts`
- Modify: `lib/shipwreck/ships/types.ts` (`trappedAir?`, `superstructure[i].id?`), `lib/shipwreck/sim/{flooding,body,run,track,constants}.ts`, `lib/shipwreck/sim/__tests__/testShips.ts` (a 200 m box hull with a 30 m deckhouse box, ids on its boxes), `lib/shipwreck/sim/README.md`

**Interfaces (Produces):**

```ts
// types.ts (additive)
superstructure: { fromX: number; toX: number; topZ: number; halfBreadthM?: number;
  /** A named space: openings may name it (`Opening.compartmentId`), its
   *  water is in `SimFrame.boxWater`. */
  id?: string }[];
/** Air caught in her spaces (physics: Boyle, orifice laws). Missing: none
 *  (the 1.0 flooding: a space fills to the sea's level). */
trappedAir?: {
  /** Stated slow leak per space (m²), by kind; boxes use `box`. */
  leakM2: Partial<Record<Compartment["kind"] | "box", number>>;
};

// track.ts (additive)
SimFrame.boxWater?: number[]; // fraction full per box, only when a box has an id

// air.ts
export function airHeadM(massAtmM3: number, volM3: number, rho: number): number; // gauge head, m
export function gasOutflow(areaM2: number, dpPa: number, pAbsPa: number): number; // atm·m³/s
```

- [ ] **Step 1: Failing tests** on box test ships:
  - `trappedAir.test.ts`: a sealed box cell held upside down with its open face 10 m down has its water surface and air head at the Boyle answer (computed in the test) ± 1% once at rest; a box ship turned keel up (pose set, then free) floats at the Boyle draught ± 2%; a leak of 0.01 m² at 5 m head empties the pocket at the gas orifice rate ± 5%; air never enters under water; total air mass never rises; without `trappedAir` every existing flooding test and the seven goldens are unchanged.
  - `boxSpaces.test.ts`: an `Opening` naming a box id floods that box; box flood points are its lowest edge at the pose for a `trappedAir` ship (keel up: its roof edges), its ship-frame lower corners otherwise (unchanged); `boxWater` reported only when a box has an id.
  - `keelUpGz.test.ts`: the box-on-box's GZ at 0–180° in 10° steps against the analytic wall-sided GZ (computed in the test) within 3%; keel up with the deckhouse flooded and the hull's air sealed is stable (perturbed 5° in roll and 2° in pitch it returns within 120 s); finite poses throughout.
- [ ] **Step 2: Implement** until PASS: `air.ts` pure and allocation-free; per-body `Float64Array` of air masses; `seaInflow` takes the cell's air head (0 for ships without `trappedAir`, so the old path is byte-identical); air outflow per step through openings in contact with the air and under the sea, plus `leakM2`; vent bursts count as air openings for her; `cellAt` resolves box ids; `frame()` adds `boxWater`. `npx jest lib/shipwreck/sim` and `npm run test:sims` PASS (goldens included).
- [ ] **Step 3: README**: trapped air (formulas, assumptions: isothermal, one pocket per cell, no air between cells, leaks stated), boxes as spaces; physics vs rules; limits.
- [ ] **Step 4: Commit** (`feat(shipwreck): trapped air and named superstructure spaces in the sim`).

## Task 3: The wave rule, capsized, short ends, the dive keel up — Opus

**Files:**

- Create: `lib/shipwreck/sim/wave.ts` (the roll rule, variants, spots → openings), `lib/shipwreck/sim/__tests__/{waveRule,capsizeEnds,diveKeelUp}.test.ts`
- Modify: `lib/shipwreck/ships/types.ts` (`cause` += `"wave"`, `wave?`, `blackout.listDeg?`, `capsizeTimeScale?`, `rideOut?`, `endS?`), `lib/shipwreck/sim/{run,descent,waves,waveRide,events,track,constants}.ts`, `lib/shipwreck/types.ts` (`OUTCOME_IDS` append `"capsized"`), `components/shipwreck/scene/stormRide.ts` (the ride's exclusions, same function the sim uses), `lib/shipwreck/sim/__tests__/testShips.ts`, `lib/shipwreck/sim/README.md`, `scripts/shipwreck-sim.ts` (`--wave=real|smaller|ahead`)

**Interfaces (Produces):**

```ts
// types.ts (additive)
cause: "iceberg" | "torpedo" | "storm" | "mine" | "rocks" | "wave";
export interface WaveSpot { id: string; label: string; openings: readonly Opening[] }
wave?: {
  group: WaveGroup;             // joins her storm; left out of her waveRide
  peakDeg: number;              // the roll rule's peak (+ to starboard)
  rollS: number;                // its duration (smoothstep)
  smaller: { heightM: number; peakDeg: number };
  ahead: { dirDeg: number };    // no roll rule; the group is in her ride
  /** "fwd" spots only from ahead (it breaks over her bow). */
  spots: readonly (WaveSpot & { fwd?: true })[];
};
blackout?: { …existing; /** Out once |roll| passes this (a rule). */ listDeg?: number };
capsizeTimeScale?: number;
rideOut?: { afterS: number; maxListDeg: number };
endS?: number;
WaveGroup.ride?: false;         // left out of waveRide (her rogue wave)

// run.ts SimOptions (additive)
/** The wave ship's wave (`spec.wave`). Default "real". */
wave?: "real" | "smaller" | "ahead";

// events.ts SIM_EVENT_KINDS append "capsized"; track.ts outcome append "capsized"
// whatIfSpots / whatIfOpenings / whatIfRealIds: cause "wave" → wave.spots
```

- [ ] **Step 1: Failing tests** on a box test ship with `trappedAir`, a `wave` and a storm swell:
  - `waveRule.test.ts`: from `group.t` the roll follows the smoothstep to `peakDeg` over `rollS` (± 0.5° each step), then physics owns it with `wr` = 0 at the hand-off; heave, pitch and flooding run during the rule; `smaller` peaks at its own degrees and physics rights her (|roll| < 10° within 120 s); `ahead`: no rule, |roll| < 15° throughout, the group in her ride; the group is never in her ride for `real`/`smaller`, and the swell ride fades to 0 over `rollS`; `lights-out` the step |roll| passes `blackout.listDeg`, power then `emergencyLight`; `capsized` once when the rule lets go past 150°; with `capsizeTimeScale: 6` shown time after `capsized` runs at 1/6 of real and frames carry `realT`; `whatIfSpots` gives `wave.spots` ids, `whatIfRealIds` all of them, `whatIfOpenings` the chosen spots' openings (only `fwd` ones `ahead`).
  - `capsizeEnds.test.ts`: `rideOut` ends a never-capsized whole floating run `floated` with `sheltered` at `afterS` once within `maxListDeg`, never a capsized one; at `endS` a keel-up floating body ends `capsized`; the steady test runs in her storm once the group has passed (pose-box on), and every other storm ship's steady test is unchanged (Fitzgerald golden).
  - `diveKeelUp.test.ts`: a whole box ship that goes under keel up with `wreck.restDeg` 180 keeps |roll| ≥ 150° on the way down and lands at 180 ± 10; without it (or `restDeg` < 150) the 1.0 dive is unchanged (Titanic, Lusitania goldens).
- [ ] **Step 2: Implement** until PASS, every path gated on its field: the rule beside `stepAground` in `run.ts` (or `wave.ts`), `stormOf` adding the group, `waveRide` skipping `ride: false` groups and taking a fade weight, the blackout by list beside the Concordia's, the event and outcome, the time scale beside `agroundScale`, `rideOut`/`endS` beside `shelter`/`endT`, the steady gate, the dive's roll in `descent.ts`. All sim tests and the seven goldens/fixtures PASS; `npm run test:sims` PASS.
- [ ] **Step 3: README**: the wave (a rule, its inputs and sources), blackout by list (a rule), `capsized` and its time scale, `rideOut` and `endS` (rules), the dive keel up (a rule), the steady test in her storm; limits (no breaking-wave impact model; the wave's water on her deck not modelled).
- [ ] **Step 4: Commit** (`feat(shipwreck): a wave roll rule, capsized runs and a dive keel up in the sim`).

## Task 4: Her data, the real night and the What-if matrix — Opus

**Files:**

- Create: `lib/shipwreck/ships/poseidon.ts`, `lib/shipwreck/sim/__tests__/poseidon.test.ts`, `lib/shipwreck/sim/__tests__/poseidonNight.test.ts`, `lib/shipwreck/sim/__tests__/poseidonWhatIf.test.ts`
- Modify: `lib/shipwreck/ships/types.ts` (`ShipId` += `"poseidon"`), `lib/shipwreck/ships/index.ts` (append to `SHIP_IDS`, `SHIPS`; export `POSEIDON_BOATS`, `POSEIDON_DECKS`, `POSEIDON_LIVERIES`), `lib/shipwreck/sim/README.md` ("The Poseidon's data", "The Poseidon's calibration", pass criteria), `scripts/shipwreck-sim.ts` (`--ship=poseidon`), `jest.sims.js` (her night and What-if files)
- Every `Record<ShipId, …>` the type-check flags gets a **placeholder Poseidon entry that a later task replaces** (`// Task N` comment), so each commit compiles. `recipeFor` falls back to a plain box-hull recipe for her until Task 6 (never the Concordia's).

**Interfaces:**

- Consumes: Tasks 2–3's format.
- Produces: `poseidon: ShipSpec` (`cause: "wave"`, `clockStartS: 23*3600 + 58*60`, `preRollS: 60`, `seaDepthM: 4000`, `storm` (swell Hs 3 m, `windKn` 20) with the wave group, `wave`, `trappedAir`, `blackout` (`listDeg` 60), `capsizeTimeScale: 6`, `rideOut`, `endS`, `wreck: { restDeg: 180, minListDeg: 120 }`, boxes with ids incl. `ballroom`, one funnel `falls: false`, 24 boats in `POSEIDON_BOATS` `{ index, side, x }`, `POSEIDON_DECKS` 0–14), a placeholder single real livery (Task 6 fills the paint).

- [ ] **Step 1: Research and data tests first.** Read [CR] for real ranges (length, beam, draught, Cb, GM, deck heights, boat counts) and [DRA]/[QE2]/[ROG] for the wave; [ATL] for the swell and depth; [SOL] for the heel limit. `poseidon.test.ts`: LOA 305 ± 0.5, LBP 265 ± 0.1, beam 36.0 ± 0.05; ≥ 41 stations; displacement at 8.4 m within 2% of 57,500 t; intact GM 1.5–3 m; about 20 compartments with deck 0 tops at 14.5 m; boxes cover decks 1–13 with ids, `ballroom` a box 28–32 m long on decks 12–13 forward of the funnel; seven spots, each opening inside its compartment or box, on her port side; 24 boats, 12 a side; the wave group 30 m, count 1, from her port beam.
- [ ] **Step 2: Write `poseidon.ts`** (her particulars marked "ours" beside each). PASS.
- [ ] **Step 3: The real night, failing tests** (`poseidonNight.test.ts`, `simulate(poseidon, poseidon.realNight)`): exactly the spec's pass criteria (roll ≥ 90° by 15 s, ≥ 150° by `rollS`; `capsized` once; `lights-out` 3–20 s and emergency power after; keel up 165°–195° and her keel and propellers above water for ≥ 20 real min; ballroom ≥ 90% full within 5 real min; air aboard never rises; the hull's air carries ≥ 50% of her weight at 10 real min; `bow-under`/`stern-under` at 35–60 real min; lands at 180 ± 10 on the 4,000 m floor; no `breakup`; outcome `sank`; first frame to rest ≤ 15 shown min; deterministic; no NaN in any frame; inside `endS`).
- [ ] **Step 4: What-if matrix, failing tests** (`poseidonWhatIf.test.ts`): **every** subset size 0, 1 and 7 of the spots for each of the three waves, plus `ballroom`+`vents` and `fwd-win`+`lobby` for the real wave: real/all → `sank`; real/none → `capsized` at `endS`; real/single → `sank` or `capsized` (physics; both inside `endS`); smaller/any → `floated` by `rideOut`; ahead/any → `floated`, never past 15°; every run ends inside `endS` with an outcome and finite poses; runs that do not capsize end within 6 shown min of the wave.
- [ ] **Step 5: Calibrate** inside honest ranges (the spots' areas, `trappedAir.leakM2` within R8, KG within R3, the rule's `rollS` 20–30 s, girder within R17) until PASS; log each tuned value and why in the README calibration section; report the keel-up attitude, trim, the float time, the ballroom fill time, and every matrix outcome. Goldens PASS. If a band cannot be met honestly, stop and report.
- [ ] **Step 6:** `npx tsx scripts/shipwreck-sim.ts --ship=poseidon`, `--wave=smaller`, `--wave=ahead`: paste the summaries in the report. Commit (`feat(shipwreck): the Poseidon's data and her night`).

**Drift audit A (Opus, read-only) after Task 4:** re-read the north stars and rulings; run the sim script for the real night, both other waves and three spot sets; check every README claim and test number against the output; confirm each rule is named a rule and each input is stated; confirm no other ship's track moved (goldens). Findings fold into Task 5's or Task 7's instructions.

## Task 5: The cruise kit out of the Concordia's recipe — Opus (may batch with Task 6)

**Files:**

- Create: `components/shipwreck/model/cruiseKit.ts`, `components/shipwreck/model/__tests__/cruiseKit.test.ts`
- Modify: `components/shipwreck/model/concordiaRecipe.ts` (rebuilt on the kit), `components/shipwreck/model/README.md` ("The cruise kit")

**Interfaces (Produces):** pure builders that return recipe parts (`Block[]`, `BoatRecipe[]`, `DavitRecipe[]`, `LightSpot[]`, `RailRun[]`, `BoxPart[]`, `Propeller[]`, `NameBoard[]`, `FunnelRecipe`, the emergency mask), each taking the layout numbers the Concordia's recipe hard-codes today (tier ends per deck, balcony and recess spans, boat size and positions, deck heights, funnel x and shape, slide and dome options off by default).

- [ ] **Step 1: Failing tests**: `cruiseKit.test.ts` — each builder on a small made-up layout gives parts inside the given bounds, counts that match the inputs (boats per side, balcony panels per deck), lit panes only on window faces; the Concordia snapshot (Task 1) still deep-equal (it is the real test).
- [ ] **Step 2: Lift** the builders out one group at a time (tiers, balconies and windows, boats and davits, rails, glass and boxes, masts and domes, under-water parts, names, lights and mask), rerunning `npx jest components/shipwreck/model/__tests__/concordiaRecipeSnapshot.test.ts` after each; never change a number.
- [ ] **Step 3:** All model tests PASS; the Concordia model viewer (`/shipwreck?model&ship=concordia`) bow 3/4 screenshot unchanged against a shot taken before (screenshot rule).
- [ ] **Step 4: Commit** (`refactor(shipwreck): lift a cruise-ship kit out of the Concordia's recipe`).

## Task 6: Her model and paint box — Opus (may batch with Task 5)

**Files:**

- Create: `components/shipwreck/model/poseidonRecipe.ts`, `components/shipwreck/model/__tests__/poseidonRecipe.test.ts`
- Modify: `components/shipwreck/model/cruiseKit.ts` (two new builders: the raked tapering funnel; the ballroom drum and glass dome with ribs), `components/shipwreck/model/{shipModel,buildShip,partGeometry,materials,textures}.ts` only additively where a new part needs it, `components/shipwreck/model/ModelViewer.tsx` (`?model&ship=poseidon`), `scripts/shipwreck-model-shots.mjs`, `components/shipwreck/model/README.md` ("The Poseidon"), `lib/shipwreck/ships/poseidon.ts` (`liveries`, `funnelPaint`), `lib/shipwreck/__tests__/liveries.test.ts` (her real id)

**Interfaces:**

- Consumes: `poseidon`, `POSEIDON_DECKS`, `POSEIDON_BOATS` (Task 4), the kit (Task 5).
- Produces: `poseidonRecipe(spec: ShipSpec, livery?: string): ShipRecipe`; her livery `poseidon` default plus `cruiseFun()`; `handles.setLivery(id)` repaints without rebuilding geometry (the 1.7 mechanism); her emergency mask.

- [ ] **Step 1: Look notes** in the model README: her silhouette (ours) against [CR]/[WC] photographs of real ships of her era for believability (how a raked funnel, a glass dome and a boat recess are really built), with a one-line "not from the film" check per feature.
- [ ] **Step 2: Failing tests**: placements inside her hull and boxes; one funnel at the spec's x, raked 12°–18°; the ballroom drum and dome inside the `ballroom` box, dome ≤ 6k triangles and ≤ 3 draws; 24 boats and davits matching `POSEIDON_BOATS`; two propellers, two rudders; balcony rows decks 7–11 and window bands decks 1–6 on both sides; "POSEIDON" on both bows and the stern; real livery default with the gold stripe only in it; ≥ 5 fun paints from `cruiseFun()`, none a copy of hers, under the saturation cap; `setLivery` round-trips without new geometry; every other recipe snapshot deep-equal.
- [ ] **Step 3: Write the recipe.** PASS.
- [ ] **Step 4: Budget and look**: at `high` ≤ 100 draw calls, ≤ 300k triangles (`handles.stats`), build time ≤ the Concordia's + 20%. Model-viewer shots (screenshot rule): bow 3/4 starboard, side profile, stern 3/4 (propellers, rudders), top-down, close on the dome, close on the funnel, keel up from below (posed 180°: the red bottom, props and rudders read), two fun paints; and the Concordia bow 3/4 unchanged.
- [ ] **Step 5: Commit** (`feat(shipwreck): the Poseidon model and her paint box`).

## Task 7: Choosing her, her story, What if — Sonnet (MVP: playable end to end)

**Files:**

- Modify: `components/shipwreck/ui/TitleScreen.tsx` (her card after the Concordia, the "made-up ship" mark, a `"wave"` cause icon), `components/shipwreck/ui/{WhatIfEditor,HullDiagram,EndCard,Captions,Hud}.tsx` as needed, `components/shipwreck/ui/Icon.tsx` (wave, film-strip, the three wave-chip pictures, spot pictures), `lib/shipwreck/{story,places,help,whatIf,save,playback,times,xray,testHooks}.ts`, `components/shipwreck/parentLine.ts`, `components/shipwreck/Shipwreck.tsx` (title camera, `wave` option to `simulate`), `components/shipwreck/audio/cues.ts` (empty cue map for her), `components/shipwreck/scene/settings.ts` (her minimal entry: `storm-dusk`, `storm: true`, `stormLight: 0`, no coast; Task 9 finishes it), `lib/shipwreck/walk/index.ts` (null for her, if not already)
- Tests: `lib/shipwreck/__tests__/{story,save,help,xray,playback,analytics,liveries,times}.test.ts`, new `lib/shipwreck/__tests__/poseidonStory.test.ts`, `components/shipwreck/__tests__/Shipwreck.test.tsx`, `components/shipwreck/ui/__tests__/{TitleScreen,WhatIfEditor,EndCard,HullDiagram}.test.tsx`, `components/shipwreck/audio/__tests__/*` (her empty map)

**Interfaces:**

- Consumes: `SHIPS`, `poseidon`, `whatIfSpots` (Task 4), her recipe (Task 6).
- Produces: save `ShipWhatIf.wave?: "real" | "smaller" | "ahead"`; `SAVE_SHIP_IDS` appends `"poseidon"`; playback passes `wave` to `simulate`; `PARENT_LINES.poseidon` (spec's exact copy); `PLACES_BY_SHIP.poseidon`; spot words for `"wave"`; end-card words for `capsized`; `leanText` bands; times: real night + "by day" (`STORM_SHIPS` gains her, her own label).

- [ ] **Step 1: Failing tests**:
  - story: every `SimEventKind` (with `capsized`) has a Poseidon caption or explicit null; the 1.0 word guard (no deaths, no people in danger) plus hers (no "captain", "passenger", "survivor", "party-goer", "film" in play captions); `sinceText(120, poseidon)` = `"2 min after the wave"`; `clockText(0, poseidon.clockStartS)` = `"11:58 PM"`; captions for the wave coming, the hit, rolling, `lights-out`, `capsized`, the air holding her, the ballroom full, sinking, her rest; the clock after `capsized` shows real time.
  - help: `leanText` at 185° reads "upside down", at 95° "on her side", at 10° unchanged.
  - HullDiagram: finite SVG (no `NaN`/`Infinity` in any attribute) for her poses at roll 0°, 45°, 90°, 135°, 180°, 190°.
  - save: `whatIfByShip.poseidon` round-trips `{ ids, wave }`; an old save without it defaults to the real night; `capsized` in `seen.endings` parses.
  - places: the bridge, the ballroom under its dome, the lobby, an engine room, the funnel, a propeller, a lifeboat: inside her hull or boxes.
  - WhatIfEditor for a wave ship: seven spot pictures (multi-select) plus the three-way wave chip (testids `whatif-wave-real|smaller|ahead`, aria labels, help line); other ships' editors unchanged.
  - EndCard: real "Upside down, she floated for N minutes, then sank at H:MM AM." (from the run), smaller "She leaned far over, then stood up again.", ahead "She rode over the wave.", `capsized` "Upside down, she was still floating."
  - Shipwreck: title → Poseidon → back → Fitzgerald builds the right model and disposes the other (spy on `dispose`); her paint box opens with one real and ≥ 5 fun paints; her Walk button hidden; her time button offers two times.
  - audio: `eventCuesFor("poseidon")` is empty; other ships' maps unchanged.
- [ ] **Step 2: Implement** until PASS. Replace every Task 4 placeholder this task owns.
- [ ] **Step 3: Play it end to end** in `npx next dev --webpack`: real night at ×10 to the end card, one What-if per wave. Screenshots (screenshot rule): title screen with seven cards (1133×744 and 744×1133), the wave coming, her keel up, the What-if editor, each end card, the hull diagram at 180°.
- [ ] **Step 4: Commit** (`feat(shipwreck): choose the Poseidon`).

## Task 8: Analytics `ship` value (data boundary: spec review + adversarial review) — Sonnet

**Files:** `lib/analytics/gameEvents.ts` (`SHIPWRECK_SHIPS`), `firestore.rules` (both `p.ship in [...]` lists), `firestore-tests/gameEvents.test.ts`, `lib/analytics/gameAggregate.ts` and `components/admin/GamesView.tsx` (+ `components/admin/__tests__/GamesView.test.tsx`, `lib/analytics/__tests__/gameAggregate.test.ts`), `lib/shipwreck/__tests__/analytics.test.ts`, `lib/analytics/__tests__/gameRulesSync.test.ts` if it needs the new value

- [ ] **Step 1: Failing tests**: `shipwreck_start` and `shipwreck_end` accept `ship: "poseidon"` in the schema and the rules; the rules still reject `"andrea-doria"`, a number and an extra prop (e.g. `wave`); `trackEnd(…, "capsized", …)` sends `outcome: "sank"` (pinned) and the rules' outcome list is unchanged; the dashboard shows Poseidon starts and ends; existing values unchanged; `SHIPWRECK_SHIPS` equals `SHIP_IDS`; her seven spots ≤ `SHIPWRECK_MAX_OPENED`. No new props (the wave chip is not counted).
- [ ] **Step 2: Implement** schema, rules and dashboard together, appending only. `npm run test:rules` (Java 21+; if it cannot run, say so verbatim and the controller runs it in Task 11).
- [ ] **Step 3: Commit** (`feat(shipwreck): count Poseidon runs`). Then spec review and adversarial review (read-only, in parallel with Task 9), fixes, re-review.

## Task 9: The wave night, her lights, camera, X-ray and perf budget — Opus

**Files:**

- Create: `components/shipwreck/scene/__tests__/shaderGuards.test.ts` (scans the GLSL strings the Poseidon path adds or changes for unguarded `pow(`, `sqrt(`, `log(`, `/`), `components/shipwreck/scene/poseidonShots.ts` if her shots outgrow `cameraMath.ts`
- Modify: `components/shipwreck/scene/settings.ts` (finish `poseidon`: stars, no moon, her lights, `stormLight: 0`, "by day" via `sceneSettingsFor`), `seaWaves.ts` / `StormSea.tsx` (crest sharpening for a group flagged `ride: false`, steepness capped; the breaking-lip foam band; her lamps on the water; the Fitzgerald's output unchanged), `Effects.tsx` (the spray sheet at `collision`, foam where she rolled, air bubbles rising from her openings while keel up: instanced, cheap), `ShipRig.tsx` (lights to her emergency mask at `lights-out`; dim lit panes under water), `CameraRig.tsx` / `cameraMath.ts` (her hull boxes posed at any roll; bridge/lifeboat cameras to orbit at `capsized`; her shots), `XRay.tsx` / `xrayGeometry.ts` (her compartments and boxes, the ballroom drum, `boxWater`; correct upside down), `SceneCheck.tsx` (`&ship=poseidon`), `components/shipwreck/scene/README.md` ("The Poseidon's night"), `e2e/perf.spec.ts` + `e2e/perf-budget.json` (three Poseidon scenes)
- Tests: `components/shipwreck/scene/__tests__/{settings,cameraMath,ShipRig,seaWaves}.test.ts(x)`, `shaderGuards.test.ts`

**Interfaces:**

- Consumes: her track (storm with the group, events, `boxWater`), her recipe and mask (Task 6).
- Produces: `SCENE_SETTINGS.poseidon`; perf scenes `shipwreck-poseidon-party` (lit on the swell, the wave rising behind), `shipwreck-poseidon-wave` (mid-roll at the crest, spray), `shipwreck-poseidon-keelup` (keel up, propellers in the air, bubbles).

- [ ] **Step 1: Failing tests**: other ships' settings deep-equal; the Fitzgerald's sea uniforms and wave packing unchanged; her group's sharpening is 0 at every other group; the camera never inside her hull at roll 0°, 90°, 180° (sampled orbits) and never under the floor; the bridge camera switches to orbit at `capsized`; the X-ray's water planes for her boxes stay inside them at 180°; `shaderGuards` passes; the spray fires once at `collision` on her port side.
- [ ] **Step 2: Build** the night (stars, the swell, her lit decks, the wave rising out of the dark with its breaking lip, the hit and spray, the roll, the blackout to emergency lights, keel up with bubbles, under water the dome facing the deep, the dive, the floor keel up).
- [ ] **Step 3: Budgets**: run the three scenes on `high`; ≤ 160 calls, ≤ 450k triangles each; if over, cut her model's low-value parts first (rails, ribs), never the Fitzgerald's ring counts. Record with `PERF_UPDATE=1 npx playwright test e2e/perf.spec.ts --project=chromium`; check in the diff that every existing entry is unchanged.
- [ ] **Step 4: Real-GPU check**: open `/shipwreck?scene&ship=poseidon&quality=medium` and `&quality=high` in a GPU-backed Chrome (headed Playwright with `--use-angle=metal`, or the user's Chrome) at the party, wave and keel-up moments; no black frames, no NaN warnings in the console. Report what was seen; if no real GPU is reachable, say so verbatim and the controller does it in Task 11.
- [ ] **Step 5: Screenshots** (1133×744 and 744×1133; screenshot rule): lit on the swell, the wave coming, the hit, on her side, keel up (above), keel up (below, dome), the dive, at rest; by day keel up; the Fitzgerald storm and the Concordia drift unchanged.
- [ ] **Step 6: Commit** (`feat(shipwreck): the wave night for the Poseidon`).

## Task 10: e2e and offline — Sonnet

**Files:** `e2e/shipwreck.spec.ts`, `e2e/shipwreck-offline.spec.ts`, `e2e/support/*` helpers only additively, `lib/shipwreck/testHooks.ts` if a hook needs her outcome or roll, `public/shipwreck-sw.js` (regenerated by its script only if precache lists change)

- [ ] **Step 1: e2e**: `@smoke` pick the Poseidon → real night → end card at ×100 reads "Upside down, she floated for … then sank"; mid-run `window.__shipwreck` reports |roll| > 150° after `capsized`; What-if smaller wave → "She leaned far over, then stood up again."; from ahead → "She rode over the wave."; real wave, no spots → "Upside down, she was still floating."; her paint box repaints her live (one fun paint, back to hers); switch to the Fitzgerald then the Concordia (Giglio only for her); offline start after one visit loads the Poseidon; her Walk button is hidden.
- [ ] **Step 2: Run** `npx playwright test e2e/shipwreck.spec.ts e2e/shipwreck-offline.spec.ts --project=chromium`; `@smoke` on webkit and iPad for the new cases. Screenshots of any failure, per the screenshot rule.
- [ ] **Step 3: Commit** (`test(shipwreck): the Poseidon end to end`).

## Task 11: Release 1.11.0 and full verification — Sonnet (controller spot-checks)

**Files:** `lib/shipwreck/version.ts`, `lib/shipwreck/changelog.ts`, the sim, model and scene READMEs (final numbers), `CLAUDE.md` only if a Shipwreck rule changed (it should not)

- [ ] **Step 1: Version**: `git fetch origin && git show origin/main:lib/shipwreck/version.ts`; bump `SHIPWRECK_VERSION` to the next free minor after main's (1.11.0 if main is 1.10.0); if main moved, rebase or merge first and rerun the goldens and `npm run test:sims`.
- [ ] **Step 2: Changelog**: a new top entry (title "The Poseidon") from the spec's draft and `git log 2d58af51..HEAD -- lib/shipwreck components/shipwreck app/shipwreck public/shipwreck-icons public/shipwreck-sw.js`, in plain words a young player or their parent would follow; `npx jest lib/shipwreck/__tests__/changelog.test.ts` PASS. Icon v1 files untouched (`git diff --stat origin/main -- public/shipwreck-icons` empty).
- [ ] **Step 3: Full verification once**: `npm run validate`; `npm run test:sims`; `npm run test:rules` (Java 21+; report verbatim if unavailable); `npx playwright test e2e/shipwreck*.spec.ts --project=chromium`; `@smoke` on webkit and iPad; `npx playwright test e2e/perf.spec.ts --project=chromium` (only `shipwreck-poseidon-*` entries new); `npm run build`. Record failures verbatim; list any known red tests on main separately.
- [ ] **Step 4: Real-GPU check** if Task 9 could not: her scene at medium and high in a GPU-backed Chrome (party, wave, keel up); no black frames. Note for Gentry: check once on the iPad mini 6 after deploy (Safari, home-screen app) at the wave and keel up.
- [ ] **Step 5: Final screenshots** (screenshot rule): the Versions page with 1.11.0, the title screen with her card, her keel up at night.
- [ ] **Step 6: Commit** (`feat: Shipwreck 1.11.0 — the Poseidon`).
