# Shipwreck 1.3 — the Edmund Fitzgerald — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SS Edmund Fitzgerald (10 November 1975, Lake Superior) as a third, fully playable ship in Shipwreck, released as 1.3.0 (1.2.0 is "Walk the decks", PR #558).

**Architecture:** The ship format (`lib/shipwreck/ships/`) is the single source of truth that the sim, model, X-ray and diagram read; 1.1 already made every Titanic-only place read the chosen ship. This plan widens the format for what the Fitzgerald needs (fresh water, a storm wave field shared by the sim and the sea shader, deck openings flooded by boarding seas, hatch covers that give way, pumps per ship, steady headway, a shelter she can reach, a wreck in two parts lying differently), adds her data and a detail recipe, and adds a storm scene and sound.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, React Three Fiber / three.js r186, zustand, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-shipwreck-edmund-fitzgerald-design.md` (read it first; its north-star goals are re-read at the start of every task). The 1.0 and 1.1 specs and plans (`2026-11-20-shipwreck*.md`, `2026-11-21-shipwreck-lusitania*.md`) still hold where this plan is silent.

## Global Constraints

- Everything in the 1.0 and 1.1 plans' Global Constraints applies (Prettier, `export default function`, `interface` props, Tailwind only, Safari 15.0 floor via `lib/game-kit/compat.ts` (no `Object.hasOwn`, no `.at()`, no `structuredClone`), static export, no people shown, pure deterministic sim, coordinate frames, performance budgets: ≤ 160 draw calls, ≤ 450k triangles at the top tier, no frame blocked > 8 ms).
- Worktree `/Users/griggen/dev/code/personal/gr-shipwreck`, branch `feat/shipwreck-edmund-fitzgerald` off `origin/main`. Use `npx next build --webpack` / `npx next dev --webpack` if Turbopack complains.
- **The Titanic and the Lusitania must not change.** `titanicGolden.test.ts` and the new `lusitaniaGolden.test.ts` (Task 1) pass after every task.
- Ship ids: `"titanic" | "lusitania" | "fitzgerald"`. Titanic stays the default. Britannic stays "Coming soon".
- Release: `SHIPWRECK_VERSION` `1.3.0`, one new top changelog entry above 1.2.0 "Walk the decks" (Task 8). Do not bump earlier. Rebase on `main` once PR #558 (walk the decks) merges, before Task 8; expect conflicts in `lib/shipwreck/version.ts`, `changelog.ts`, `lib/shipwreck/types.ts` (`CAMERA_IDS` gains `"walk"`), `firestore.rules` (camera list gains `'walk'` next to our ship list) and maybe `Hud.tsx`. Walk is deliberately unavailable on the Fitzgerald (`walkMapFor` returns null without a map).
- Save key stays `shipwreck:v1`; new fields are optional and parsed with defaults (no reset, no new key).
- Conventional commits `feat(shipwreck): ...` / `fix(shipwreck): ...`. Run `npm run lint`, `npm run type-check` and the tests you touched each task, `npm test` at the end of each task. Full e2e only in Task 8.
- Screenshots to `/Users/griggen/dev/code/personal/gr-shipwreck/.screenshots/fitzgerald-task-<N>/`, listed in the report.
- Sources: cite every Fitzgerald figure (dimensions, tanks, hatches, deck heights, cargo, draught, times, storm) in `lib/shipwreck/sim/README.md` (sim) or `components/shipwreck/model/README.md` (look). Where sources disagree, pick one, say which and why.
- Kindness: no voices, no song, no blame; captions never mention the crew's fate.
- Every report ends with a "Slowdowns" line (what cost you time) and the screenshot list.

## Review Focus

1. **Titanic or Lusitania regression through shared code** (a new field `undefined` for them that still changes a code path, `RHO` moved from a constant to a per-ship value, the step size changed for everyone): pinned by both golden tests and Task 8's perf budget.
2. **The storm field drifting between the sim and the shader** (the waves on screen are not the waves that flood her): one source of truth in `lib/shipwreck/sim/waves.ts`, the shader's constants generated from it, a unit test that samples both (Task 6).
3. **A What-if run that never settles or ends wrong** (tight hatches, calm storm: she must reach shelter and end `floated`; shoal plus worst storm: she must still end inside `endT` with finite poses).
4. **Wreck parts**: bow upright and buried, stern upside down, parts a plausible distance apart, nothing through the floor, the camera never inside the clay or below the waves' troughs wrongly.
5. **Frame rate in the storm on the iPad mini 6**: wave vertex count, spray and snow particles tiered; no per-frame allocation in the wave sampler.
6. **Switching ships** (title → Fitzgerald → title → Lusitania → Titanic): the right model, scene, storm on or off, sound bed, What-if editor; old models disposed.

---

## Task 1: Widen the ship format and the sim (no new ship yet)

Everything the Fitzgerald needs from the physics, built and proven on test ships, with the Titanic and the Lusitania unchanged.

**Files:**

- Modify: `lib/shipwreck/ships/types.ts`, `lib/shipwreck/sim/{constants,body,flooding,hydrostatics,descent,girder,run,track,events}.ts` as needed, `lib/shipwreck/sim/README.md`
- Create: `lib/shipwreck/sim/waves.ts`, `lib/shipwreck/sim/__tests__/lusitaniaGolden.test.ts` + `fixtures/lusitaniaGolden.json`, `lib/shipwreck/sim/__tests__/waves.test.ts`, `lib/shipwreck/sim/__tests__/boardingSeas.test.ts`, `lib/shipwreck/sim/__tests__/wreckParts.test.ts`; extend `testShips.ts`

**Interfaces (Produces):**

```ts
export type ShipId = "titanic" | "lusitania" | "fitzgerald";

/** One wave component of a storm (deterministic: no Math.random). */
export interface WaveComponent {
  amplitudeM: number;
  periodS: number; // deep-water dispersion gives the wavelength (or finite depth if the builder shows it matters at 162 m)
  /** Direction the wave travels toward, degrees from the ship's +x at the first event, + toward port. */
  dirDeg: number;
  phase: number; // radians
}

export interface StormSpec {
  components: readonly WaveComponent[];
  /** Significant height the components were fitted to (m), for tests and words. */
  hsM: number;
  /** Extra wave groups (the "three sisters"): centred at shown time t, at the ship's position. */
  groups?: readonly {
    t: number;
    heightM: number;
    count: number;
    periodS: number;
    dirDeg: number;
  }[];
  windKn: number; // for the scene (spray, snow drift) and words
}

/** An opening in the deck that the sea reaches only when a wave puts water over it. */
export interface DeckOpening {
  id: string;
  compartmentId: string;
  kind: "hatch" | "vent" | "other";
  x: number;
  /** + to port (ship frame). */
  y: number;
  /** Height of the opening's lip above the keel (coaming or vent top), m. */
  z: number;
  /** Leak area while intact (gaps under a hatch cover, a broken vent's pipe), m². */
  areaM2: number;
  /** A hatch cover gives way once the water over it reaches this head (m); then `failedAreaM2` opens. */
  failHeadM?: number;
  failedAreaM2?: number;
  /** Seconds after the first event it starts to leak (default 0). */
  t?: number;
}

export interface ShipSpec {
  // ...existing fields
  /** Water density (kg/m³). Missing: RHO (1025, sea water). */
  waterDensity?: number;
  storm?: StormSpec;
  deckOpenings?: readonly DeckOpening[];
  /** Bilge pumps (m³/s, total) that start at the first event. Missing: the 1.0 behaviour. */
  pumpsM3s?: number;
  /** She reaches shelter at this shown time if still afloat: the run ends `floated`. */
  shelter?: { t: number; name: string };
  /** Per-part wreck rules after a break (bow and stern), each the 1.1 rule or a capsize. */
  wreckParts?: {
    bow?: { restDeg: number; minListDeg: number };
    stern?: { capsize: true; restDeg: number }; // rolls over during the fall and lands at restDeg (≈180)
  };
}
```

- `headway` gains optional `halfLifeS` (missing = constant way until she goes under; the run's headway then decays as 1.1 does).
- `SimOptions` gains `storm?: "real" | "calmer" | "worse"` (scales the field's heights by documented factors: e.g. 0.6 and 1.25), `hatchesTight?: boolean` (hatch `areaM2` → 0, `failHeadM` raised by a stated factor), `topsideDamage?: boolean` (vent openings omitted), `shoal?: boolean` (adds the ship's `shoalOpenings`, a new optional `ShipSpec.shoalOpenings?: readonly Opening[]`).
- `waves.ts`: `waveElevation(storm, xEarth, yEarth, t, scale = 1): number`, `waveField(storm, scale)` returning packed `Float32Array`s (amplitude, k, dir cos/sin, omega, phase) for the shader, and `significantHeight(storm)`. Allocation-free in the hot path.
- New `SimEventKind`s: `"hatch-fails"` (index = hatch number), `"sheltered"`; add their thresholds to `events.ts`. The story text comes in Task 4 (captions may be null until then, but every kind must exist in the story map test).

- [ ] **Step 1: Lusitania golden.** Before touching the sim, write `lusitaniaGolden.test.ts` like `titanicGolden.test.ts`: the real afternoon plus two What-ifs (a torpedo spot aft with portholes shut, the real spot with portholes shut), every event, outcome, and every 50th frame's poses, water, list and trim to 1e-9 from the unchanged code (`UPDATE_GOLDEN=1`). PASS. Commit.
- [ ] **Step 2: Waves, failing tests** (`waves.test.ts`): a field fitted to `hsM: 7.6` has `4·σ(η)` within 5 % of 7.6 over a long record; the same inputs give the same elevation (no randomness); a group at `t` raises the local crest maximum near `t` by about `heightM`; `scale` 0.6 scales σ by 0.6; sampling 1e6 points allocates nothing (spy or a heap check is fine to skip; no `new` inside `waveElevation`).
- [ ] **Step 3: Implement `waves.ts`.** PASS.
- [ ] **Step 4: Boarding seas, failing tests** (`boardingSeas.test.ts`, a 200 m box test ship with a hold, side tanks and three hatches, in fresh water):
  - `"fresh water floats her deeper"`: the same ship at the same mass sits deeper by 1025/1000 in volume.
  - `"no storm, no water"`: with `storm` missing, deck openings let in nothing.
  - `"a lower deck ships more water"`: the same storm on the same ship loaded deeper gives more inflow.
  - `"water through a vent fills its tank and lists her"`: a starboard vent into a starboard side tank gives a starboard list.
  - `"a hatch gives way under enough green water"`: a hatch with `failHeadM` fails (event `hatch-fails`) once the field puts that head over it, and then the hold floods much faster.
  - `"pumps hold off a small leak"`: inflow below `pumpsM3s` never accumulates.
  - `"she reaches shelter"`: with `shelter.t` and no damage the run ends at that t, `outcome: "floated"`, event `sheltered`.
  - `"steady way"`: `headway` without `halfLifeS` keeps her speed until she goes under.
- [ ] **Step 5: Implement**: per-ship density threaded through every `RHO` use (default 1025 so goldens hold), deck openings (each step: the opening's earth z from the pose, the local η from the field at its earth x/y and t, head = η − z, orifice law while head > 0, both directions handled as 1.0 does for openings), hatch failure, pumps, shelter end, steady headway, the What-if options. Run all sim tests and both goldens: PASS.
- [ ] **Step 6: Wreck parts, failing tests** (`wreckParts.test.ts`): a 200 m box ship in 120 m of water, flooded at the bow so it dives and breaks on striking the floor: the bow part rests within 20° of upright; with `wreckParts.stern.capsize` the stern lands with `|roll|` ≥ 150°; nothing goes through the floor; the parts' resting x differ by less than the ship's length; finite poses throughout. Without `wreckParts` the 1.0/1.1 rest holds (both goldens).
- [ ] **Step 7: Implement** (a rule in the descent, documented as a rule: the stern part, once fully under after a break, rolls toward `restDeg` over its fall at a rate the README states, then lands). PASS.
- [ ] **Step 8: README** (every new formula, tuned value and why) and **commit** (`feat(shipwreck): storms, boarding seas, fresh water and wrecks in two parts in the sim`).

## Task 2: The Fitzgerald's data and her last afternoon

**Files:**

- Create: `lib/shipwreck/ships/fitzgerald.ts`, `lib/shipwreck/sim/__tests__/fitzgerald.test.ts`, `lib/shipwreck/sim/__tests__/realStorm.test.ts`
- Modify: `lib/shipwreck/ships/index.ts` (`SHIPS`, `SHIP_IDS` with `fitzgerald` last), `lib/shipwreck/sim/README.md` (sources and every assumption), `scripts/shipwreck-sim.ts` (`--ship=fitzgerald`, `--storm=calmer|worse`, `--tight`, `--no-damage`, `--shoal`), `lib/shipwreck/sim/__tests__/perf.test.ts` (her run)

**Interfaces:**

- Consumes: Task 1's format.
- Produces: `fitzgerald: ShipSpec`, `FITZGERALD_DECKS` (spar deck, forecastle deck, texas deck, pilothouse, the aft deckhouse decks, tank top), `FITZGERALD_BOATS` (two lifeboats aft, two rafts), `FITZGERALD_HATCHES` (21, number, x, the hatch's deck opening id), `cause: "storm"` (widen the `cause` union; update every `switch`/`if` on it), `clockStartS: 15*3600 + 30*60`, `waterDensity: 1000` (cite the temperature), `seaDepthM: 162`, `storm` (NOAA hindcast, waves from astern: she steered about south-east, seas from the north-west; the "three sisters" group just after 7:10 PM), `deckOpenings` (21 hatches, the two broken starboard vents into the starboard side tank(s) from t = 0, other vents intact), `shoalOpenings` (a bottom rake under the forward side tanks, What-if only), `pumpsM3s` (her two pumps at their rated capacity, cited), `headway` (her speed toward Whitefish from the Anderson's plot), `shelter` (Whitefish Bay at her speed), `wreckParts` (bow upright, stern capsized), `scripted` (radars lost 4:10 PM as a scripted event if the story needs it, else none), compartments: three cargo holds (one cell each joined by open screen bulkheads, permeability from taconite's bulk density and porosity, cited), side tanks port and starboard per hold (`span`), double bottom tanks, forepeak, the engine room and the aft peak.

- What if is multi-select for every ship (Gentry's ask): `whatIfSpots(fitzgerald)` returns one id per hatch, one for the damaged vents, and one per shoal strip; `whatIfOpenings(fitzgerald, ids)` returns exactly the chosen deck openings (hatches leak only if chosen; unchosen hatch covers tight) and shoal openings; the real damage = `whatIfRealIds(fitzgerald)`. Task 1's option flags (`hatchesTight`, `topsideDamage`, `shoal`) stay for the script and tests and must agree with the id form (a test: all hatch ids + vents = the real run; no ids + `storm: "calmer"` reaches shelter).

- [ ] **Step 1: Data tests first** (`fitzgerald.test.ts`): LOA 222.2 m ±0.5, beam 22.9 ±0.1, depth 11.9 ±0.1, at least 41 stations aft to forward, hydrostatic displacement at her draught (in fresh water) within 2 % of `displacementT`, upright GM positive and in the source's range for a loaded laker, freeboard at midships 3.2–3.8 m, 21 hatches between the forecastle and the aft house, side tank cells mirror port and starboard, one funnel, `cargo` mass equals 26,116 long tons (26,535 t) ±0.5 %.
- [ ] **Step 2: Write `fitzgerald.ts`** from the sources. PASS.
- [ ] **Step 3: The real storm, failing tests** (`realStorm.test.ts`, `simulate(fitzgerald)` with its real damage):
  - a starboard list between 1° and 8° by 5:30 PM (t = 7,200 s);
  - water aboard rises through the evening; still afloat with the bow's deck above the still-water line at 7:10 PM (t = 13,200 s);
  - `bow-under` between 7:10 and 7:25 PM (13,200–14,100 s); `bow-lands` within 180 s of `bow-under`, while some stern point is above the still water;
  - `breakup` at or after `bow-lands` and before `stern-lands`;
  - the bow part rests within 20° of upright, the stern part with `|roll|` ≥ 150°; the parts' resting positions 25–150 m apart (real about 52 m);
  - at least one `hatch-fails` before `bow-under`;
  - What-if matrix (storm real/calmer/worse × hatches tight/leaking × damage yes/no × shoal yes/no = 24 runs): finite poses, every run ends inside `endT`; tight hatches + no damage + calmer reaches shelter (`sheltered`, `floated`); every run with more damage sinks no later than the same run with less, all else equal.
  - perf: her real run simulates within 1.5× the Titanic perf test's budget (the run is longer).
- [ ] **Step 4: Calibrate** inside honest ranges (hatch leak areas, the failure head, vent areas, tank sizes, wave spectrum shape) until PASS. Log every tuned value and its source or reasoning in the README. Both goldens still PASS.
- [ ] **Step 5: Commit** (`feat(shipwreck): SS Edmund Fitzgerald's data and her last afternoon`).

## Task 3: The Fitzgerald model

**Files:**

- Create: `components/shipwreck/model/fitzgeraldRecipe.ts`, `components/shipwreck/model/__tests__/fitzgeraldRecipe.test.ts`
- Modify: `components/shipwreck/model/shipModel.ts` (`recipeFor` dispatch), `buildShip.ts` / `materials.ts` / `textures.ts` / `partGeometry.ts` only where a liner assumption must become a recipe field (a hull with no superstructure amidships, hatch covers and coamings, a hatch crane on rails, a pilothouse forward, one funnel aft, a laker's straight sides and raked bow), `ModelViewer.tsx` (`?model&ship=fitzgerald`), `components/shipwreck/model/README.md`

**Interfaces:**

- Consumes: `fitzgerald`, `FITZGERALD_DECKS`, `FITZGERALD_BOATS`, `FITZGERALD_HATCHES` (Task 2).
- Produces: `fitzgeraldRecipe(spec): ShipRecipe`; the recipe's damaged vents and fence rail are absent from the start (they were gone by 3:30 PM); handles unchanged so the scene poses her like the others. The Titanic and Lusitania recipes deep-equal snapshots taken before this task.

- [ ] **Step 1: Research the look** for November 1975 (Columbia Transportation hull colours and boot topping, white forecastle and pilothouse, the stack's colours and emblem, the hatch crane's shape and colour, the name on the bow and stern, her bell's place, the lifeboats' davits, the radar mast, deck lights) from photos and the GLSHS, and write it with sources in the model README.
- [ ] **Step 2: Failing tests**: every placement inside the hull's bounds; one funnel; 21 hatch covers matching `FITZGERALD_HATCHES`; boats match `FITZGERALD_BOATS`; one propeller and one rudder; the two lost vents missing; Titanic and Lusitania recipe snapshots unchanged.
- [ ] **Step 3: Write the recipe** and the shared-code generalisations. PASS.
- [ ] **Step 4: Budget and look**: at `high` ≤ 90 draw calls and ≤ 300k triangles (`handles.stats`), build time ≤ the Titanic's. Screenshots in the model viewer (chromium 1133×744): bow 3/4, stern 3/4 (prop and rudder), side profile, top-down along the hatches, close on the pilothouse, close on the aft house and funnel, lights at power 1 and 0, and the Titanic and Lusitania side profiles to show them unchanged.
- [ ] **Step 5: Commit** (`feat(shipwreck): the Edmund Fitzgerald model`).

**Drift audit A (Opus, read-only) after Task 3:** re-read the spec's north-star goals; rerun the sim script for her real run and two What-ifs and check the README's claims against the output; look at the Task 3 screenshots against reference photos; list anything that has drifted. Its findings fold into Task 4's instructions.

## Task 4: Choosing her, her story, her places, What if

**Files:**

- Modify: `components/shipwreck/ui/TitleScreen.tsx` (Edmund Fitzgerald card selectable; `COMING = ["Britannic"]`), `components/shipwreck/Shipwreck.tsx`, `lib/shipwreck/story.ts` (her words; `sinceText` for a storm ship: "2 h 10 min into the storm report" or simply the clock; pick one and test it), `components/shipwreck/parentLine.ts`, `lib/shipwreck/places.ts`, `lib/shipwreck/help.ts`, `lib/shipwreck/xray.ts` + `components/shipwreck/scene/XRay.tsx` (holds with the taconite drawn as a dense layer, side tanks, double bottom), `components/shipwreck/ui/{HullDiagram,WhatIfEditor,EndCard,NightPanels,Timeline,Hud}.tsx`, `lib/shipwreck/save.ts` (her What-if toggles under `whatIfByShip.fitzgerald`), `lib/shipwreck/testHooks.ts`
- Tests: the matching `__tests__` files.

**Interfaces:**

- Consumes: `SHIPS`, `SHIP_IDS`, the What-if options (Task 1), recipe dispatch (Task 3).
- Produces: her captions (`hatch-fails`, `sheltered`, `bow-under`, `breakup`, `stern-lands`, the 3:30 PM report, 4:10 PM radars, the 7:10 PM message: exact copy "7:10 PM. Her captain radios the Anderson: “We are holding our own.”"), `PARENT_LINES.fitzgerald` (exact copy: "This is the Edmund Fitzgerald, an ore carrier on Lake Superior. She sank in a storm on 10 November 1975, and all 29 of her crew died. This game shows only the ship."), `PLACES_BY_SHIP.fitzgerald` (the pilothouse, her bell, cargo hold no. 1 with its taconite, a starboard ballast tank where the vents broke, the engine room, the hatch crane), save shape: her chosen spots in `ShipWhatIf.ids` like the other ships, plus `ShipWhatIf.storm?: "real" | "calmer" | "worse"`.

**Multi-select What if for every ship (Gentry, 2026-11-21: "All ships should be able to select one or more what if options"; the Lusitania only allows one torpedo today).** The editor's selection is a set for every ship, shared code, no per-ship radio picker: tap any number of spots, Go needs at least one (or any toggle off the real night).

- Lusitania: tap one or more torpedo hits along her starboard side (`torpedoOpenings` already maps each chosen compartment; drop the one-spot rule in `WhatIfEditor.tsx` and `save.ts`'s `slice(0, 1)`), `role="group"` with checkboxes instead of a radiogroup, words "Tap where torpedoes hit" (one hit still reads "the torpedo"), the "real" check unchanged (exactly the real spot + portholes open), `Torpedo.tsx` draws one wake and water column per hit (hits staggered a few seconds apart in the run-in, deterministic), story captions for more than one hit. Add a sim test: two and three hits end inside `endT` with finite poses and sink no slower than one.
- Fitzgerald: the same hull tap picker over her spots from Task 2 (`whatIfSpots`: each hatch, the vents, the shoal strip), multi-select, defaults = the real damage; the storm (real / calmer / worse) is a separate three-way setting, not a spot.
- Titanic: unchanged behaviour (already multi-select); it now runs through the shared selection code.

- [ ] **Step 1: Failing tests**: the editor allows two or more spots for each of the three ships and Go builds openings for all of them; a 1.1 save holding one Lusitania spot still loads; a save with three Lusitania spots round-trips; every `SimEventKind` has a Fitzgerald caption or an explicit null; the 1.0 word-list test covers her captions (no deaths, no people in danger, no song lyrics: add "fitzgerald" lyric phrases to the banned list: "the lake, it is said", "gales of November", "witch of November"); `clockText(0, fitzgerald.clockStartS)` = `"3:30 PM"`; a save with Fitzgerald spots and storm round-trips and junk values default; places sit inside her hull; the What-if editor for a storm ship shows her multi-select spot picker plus the storm setting (defaults = the real night); the end card for `floated` + `sheltered` reads "She made it to Whitefish Bay."; switching Fitzgerald → Lusitania → Titanic disposes the old model (spy).
- [ ] **Step 2: Implement** until PASS.
- [ ] **Step 3: Screenshots**: title screen with three playable ships, her HUD at 5:30 PM, the X-ray with water in the starboard tank and the holds, the What-if editor, both end cards (sank, sheltered).
- [ ] **Step 4: Commit** (`feat(shipwreck): choose the Edmund Fitzgerald`).

## Task 5: Analytics `ship` value (data boundary: spec review + adversarial review)

**Files:** `lib/shipwreck/analytics.ts`, `lib/analytics/gameEvents.ts`, `firestore.rules`, `firestore-tests/gameEvents.test.ts`, the Games tab (`components/admin/`), `lib/shipwreck/__tests__/analytics.test.ts`

- [ ] **Step 1: Failing tests**: `ship: "fitzgerald"` accepted for `shipwreck_start` and `shipwreck_end`; the rules test feeds all three ships for both events and still rejects `"britannic"`, a number and an extra prop; the dashboard splits by all three. If `opened` (compartments opened) has no meaning for a storm ship, send 0 and say so in the schema comment (no new prop).
- [ ] **Step 2: Implement** schema, rules and dashboard together; `npm run test:rules` (Java 21+; report if it cannot run).
- [ ] **Step 3: Commit** (`feat(shipwreck): count Edmund Fitzgerald runs`).

## Task 6: The storm scene

**Files:**

- Create: `components/shipwreck/scene/Snow.tsx`, `components/shipwreck/scene/Spray.tsx` (or fold into `Effects.tsx`), `components/shipwreck/scene/stormMotion.ts` (the visual ride on the waves), `components/shipwreck/scene/__tests__/stormMotion.test.ts`, `components/shipwreck/scene/__tests__/waveShader.test.ts`
- Modify: `settings.ts` (`timeOfDay` gains `"storm-dusk"`; Fitzgerald settings: no sun disc, overcast light fading from 3:30 PM to full dark by about 5:45 PM local, snow, `storm: true`, the Whitefish Point light position, the Anderson's position astern), `Sky.tsx`, `Sea.tsx` (the storm waves from `waveField`, foam on crests, the sea's colour for Lake Superior), `Environment.tsx`, `Effects.tsx` (spray from the bow and green water over the deck where the sim's deck openings are under, funnel smoke torn by the wind), `NightScene.tsx`, `ShipRig.tsx` (adds `stormMotion` to the pose while afloat, fades out as she goes under; deck and cabin lights by `power`), `CameraRig.tsx` / `cameraMath.ts` (camera above the local wave surface, not z = 0; 162 m floor; parts lying apart), `Coast.tsx` only if a far dark shore helps, `components/shipwreck/scene/README.md`

**Interfaces:**

- Consumes: `waveField`, `waveElevation` (Task 1), `fitzgerald.storm`.
- Produces: `stormMotion(storm, scale, shipX, t, out)` writing heave, pitch and roll offsets into `out` (no allocation); `SCENE_SETTINGS.fitzgerald`.

- [ ] **Step 1: Failing tests**: the shader's wave constants equal `waveField(fitzgerald.storm)` (one source of truth); the CPU elevation at 20 sample points equals the formula the shader uses (port the shader's formula into the test, or generate the GLSL from a TS template the test also evaluates); `stormMotion` is zero with no storm and bounded (|pitch| ≤ 6°, |roll| ≤ 10° for a laker in these seas: cite); camera math keeps the camera above the local wave surface and above `-162 + 2`; Titanic and Lusitania settings unchanged.
- [ ] **Step 2: Build** the storm: low grey overcast light, then dusk, then night (lights on deck and in the pilothouse and aft house carry the scene), waves rolling up from astern, foam and spray, green water across the deck at the hatches the sim floods, snow squalls drifting with the wind (tiered), the Whitefish Point light far ahead (dark for the real night as the light was reported out; a What-if storm may show it lit, the builder's call, documented), the Anderson's masthead and range lights far astern when snow is thin, under the surface dark cold water and a grey clay floor, a debris field and spilled taconite around the break on the floor.
- [ ] **Step 3: Budgets** at the top tier for 3 Fitzgerald scenes (5:30 PM on deck in the storm, the dive at about 7:15 PM, the wreck on the floor) and the 4 Titanic + 4 Lusitania scenes; Titanic and Lusitania numbers unchanged. Particle counts tiered at medium and low (iPads start at medium).
- [ ] **Step 4: Screenshots** (1133×744 and iPad mini portrait 744×1133): 3:30 PM grey storm from astern, 5:30 PM night on the deck with spray, a hatch failing (X-ray), the dive, the bow striking the floor with the stern up, the stern rolling over, both parts on the floor, and the Titanic 11:45 PM and Lusitania hit shots unchanged.
- [ ] **Step 5: Commit** (`feat(shipwreck): a November storm on Lake Superior`).

**Drift audit B (Opus, read-only) after Task 6:** the spec's anti-goals against the screenshots and a live run (does it look like a storm, do the waves on screen flood her, any frame-rate risk at medium tier); findings fold into Task 7.

## Task 7: Sound for the storm

**Files:** `components/shipwreck/audio/{beds,cues,voices,useShipwreckSound}.ts(x)` and tests.

- [ ] **Step 1: Failing tests**: the bed and cue set are chosen by ship; the Fitzgerald has a storm bed (howling wind that rises with `storm.windKn`, breaking waves, the engine's low thrum, the deck washing), cues for a hatch giving way, a wave group's crash, the hull's groan and break, the dive's rush; no rocket, no whistle, no voices (reuse the 1.0 guard); Titanic and Lusitania mappings unchanged.
- [ ] **Step 2: Implement** (procedural Web Audio like 1.0). PASS.
- [ ] **Step 3: Commit** (`feat(shipwreck): the storm's sounds`).

## Task 8: e2e, performance, release 1.3.0

**Files:** `e2e/shipwreck.spec.ts`, `e2e/shipwreck-offline.spec.ts`, `e2e/perf.spec.ts` + `e2e/perf-budget.json` (three Fitzgerald scenes via `PERF_UPDATE=1`), `lib/shipwreck/version.ts` (`1.3.0`), `e2e/shipwreck-walk.spec.ts` (after the rebase: a case asserting no Walk button, testid `shipwreck-walk`, on the Edmund Fitzgerald), `lib/shipwreck/changelog.ts` (new top entry), `public/shipwreck-sw.js` (regenerated by its script, never by hand), `CLAUDE.md` only if a documented rule changed.

- [ ] **Step 1: e2e**: `@smoke` pick the Edmund Fitzgerald → real storm → reaches the end card at the top speed; What-if with tight hatches, no damage, calmer storm → "She made it to Whitefish Bay."; switch to Lusitania and Titanic and see their scenes; offline start after one visit loads her too.
- [ ] **Step 2: Perf**: add her scenes, `PERF_UPDATE=1 npx playwright test e2e/perf.spec.ts --project=chromium`, check the Titanic and Lusitania entries did not move, commit the budget.
- [ ] **Step 3: Release**: version `1.3.0`; changelog entry in plain words for a young player and their parent, from `git log <the 1.2.0 release commit>..HEAD -- lib/shipwreck components/shipwreck app/shipwreck public/shipwreck-icons public/shipwreck-sw.js`.
- [ ] **Step 4: `npm run validate`** and the full Shipwreck e2e on chromium + `@smoke` on webkit and iPad: PASS (list any failure outside Shipwreck as pre-existing with evidence from `main`).
- [ ] **Step 5: Commit** (`feat(shipwreck): release 1.3.0 with the Edmund Fitzgerald`).
