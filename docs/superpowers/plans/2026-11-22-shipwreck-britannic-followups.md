# Shipwreck — Britannic follow-ups — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Britannic items cut from 1.4.0 (Walk, her own sounds, boats on the water, the foremast on the floor, Kea at true height, the list ruling, review minors) as one Shipwreck release.

**Architecture:** Each item is local to an existing seam: `walkMapFor` (walk maps), `eventCuesFor` + `beds.ts` (sound per ship), `afternoonEffects.ts` mine-ship boats, the model's fallen-part path (funnels already fall and lie via `funnelWreck.ts`), `KEA_HEIGHT_SCALE` in `Coast.tsx`. No format changes.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, R3F / three.js, zustand, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-shipwreck-britannic-design.md` ("Walk the decks", "Later", rulings R15, R20, R21) and its plan `docs/superpowers/plans/2026-11-22-shipwreck-britannic.md` (Tasks 7, 8: the deferred steps, followed here). Earlier Shipwreck plans' Global Constraints still hold.

## Global Constraints

- Branch `feat/shipwreck-britannic-followups` in this worktree, off main 4ae63186. Implementers commit; never push, PR or merge (controller does).
- **Carpathia coordination:** `feat/shipwreck-carpathia` (1.5.0) owns the paint toggle and livery. Do not touch `materials.ts` paint/band shaders, the `shipModel.ts` recipe cache, `britannicLivery.ts` or any paint/livery code. Edits to `Shipwreck.tsx`, `Hud.tsx`, `ShipRig.tsx` and shared walk code are small and additive.
- **No other ship changes:** the Titanic, Lusitania and Fitzgerald golden tests and recipe snapshots stay equal; other ships' sound mappings unchanged; `e2e/perf-budget.json` changes only for Britannic entries.
- Do not bump `SHIPWRECK_VERSION` or edit the changelog (Task 6 does).
- Kid UI: big picture buttons, no reading. Kindness: no voices, no people, nothing about deaths.
- Safari 15.0 floor (`lib/game-kit/compat.ts`), pure deterministic sim, Prettier, `export default function`, `interface` props.
- Conventional commits `feat(shipwreck): …` / `fix(shipwreck): …` with trailer `Assisted-by: Claude`. Each task: `npm run lint`, `npm run type-check`, touched tests, then `npm test`.
- Screenshots: the moment a PNG exists, copy it to `/Users/griggen/dev/code/personal/shipwreck-shots/britannic/NN-descriptive-name.png`, numbering after the highest there (77 at plan time), and append `NN-name.png — what it shows` to `captions.txt` in that folder. List them by absolute path in the report. At least one per task that changes anything visible.
- Every report ends with a "Slowdowns" line and the screenshot list.

## Review Focus

1. **Walking on her while she lies on her side / grounded**: the walker must fall into the water (float) rather than stand on a vertical deck; same rules as the Titanic and Lusitania (fun over realism, 1.3.2). Task 1 e2e walks her at a late time.
2. **Gantry davits in the walk map vs the model**: blockers must sit where `britannicRecipe.ts` draws them (shared constants), or the boy walks through steel. Task 1 maps test.
3. **The 9:00 whistle in a What if** where she is already under or the event never fires: no cue after she is gone, no crash. Task 2 cue test.
4. **Many boats on the water and frame rate** on iPad medium tier: 35 boats are instanced; no new draw calls per boat. Task 3 perf spec.
5. **The foremast on the floor in a What if where she floats or breaks**: the mast only lies down on her side on the floor; otherwise it stays on her. Task 4 test.

---

## Task 1: Walk the decks on her (Sonnet)

**Files:** Create `lib/shipwreck/walk/britannicDecks.ts`; modify `lib/shipwreck/walk/index.ts` (append `britannic: BRITANNIC_WALK`), `lib/shipwreck/walk/__tests__/maps.test.ts`, `lib/shipwreck/walk/README.md`, `e2e/shipwreck-walk.spec.ts` (flip the "no Walk button on the HMHS Britannic" test into a walk case), and export the gantry/davit/boat x-positions from `lib/shipwreck/ships/britannic.ts` or `britannicRecipe.ts` if they are not already exported.

**Interfaces:** Produces `BRITANNIC_WALK: WalkMap`; `walkMapFor("britannic")` returns it.

- [ ] Step 1: failing tests in `maps.test.ts`: `walkMapFor("britannic")` is non-null; every area sits inside her deck edge at her beam (94 ft); a blocker covers each gantry davit, boat stack, house and funnel casing the recipe draws (assert against the shared constants, not copied numbers); every area reachable by stairs from the boat deck; the existing generic map tests run for her.
- [ ] Step 2: implement from `titanicDecks.ts` (same open decks: boat deck, forward well, forecastle, after well, poop) with `deckEdgeOf(britannic, …)` and her own fittings. PASS.
- [ ] Step 3: e2e: Britannic shows the Walk button, `startWalk` puts the camera in `walk`, the walker moves on the boat deck; at a late time (after she lies on her side) the walker ends in the water. Run `npx playwright test e2e/shipwreck-walk.spec.ts --project=chromium`.
- [ ] Step 4: screenshots: walking her boat deck by a gantry davit; one in the forward well. Copy per the rule.
- [ ] Step 5: commit `feat(shipwreck): walk the Britannic's decks`.

## Task 2: Her own sounds (Sonnet)

**Files:** `components/shipwreck/audio/{beds,cues}.ts` (+ `useShipwreckSound.ts` only if needed), tests in `components/shipwreck/audio/__tests__/`.

**Interfaces:** `eventCuesFor("britannic")` returns `BRITANNIC_EVENT_CUES`; beds read `ship === "britannic"`.

- [ ] Step 1: failing tests: Britannic gets a morning bed (calm sea, gulls, engine hum following her speed via the existing power/speed input), a mine cue on `explosion` (deeper and shorter than the torpedo's), two long whistle blasts on her 09:00 `radio` event (index 0), funnel-fall cues; no rocket cue; no cue fires for events after she is gone; other ships' mappings deep-equal to before; the no-voice guard covers her.
- [ ] Step 2: implement (procedural Web Audio like the others; reuse existing synth helpers). PASS.
- [ ] Step 3: commit `feat(shipwreck): the Britannic's morning sounds`.

## Task 3: Her boats on the water, Kea at true height (Opus, scene math)

**Files:** `components/shipwreck/scene/afternoonEffects.ts` (mine-ship boats), its test, `components/shipwreck/scene/Coast.tsx` (`KEA_HEIGHT_SCALE`), `components/shipwreck/scene/README.md`.

- [ ] Step 1: diagnose (superpowers:systematic-debugging) why only 2–3 of the 35 launched boats (scripted `boat-lowered` 8:25–8:50) show on the water around 8:40–8:50 (suspects: boats with neither davits nor gantry stowed forever, `w.y < -2` stow, boats lowered after she lists, launch position, instanced count). Write the failing test that pins it: at 8:45 on the real morning, at least 25 boats are afloat (float called, finite pose, y near sea level, outside her hull, no two within 4 m).
- [ ] Step 2: fix; PASS; boats still never row toward her screws (R15).
- [ ] Step 3: set `KEA_HEIGHT_SCALE` to 1 (true heights); screenshot the same views as shots 56/76 before/after. Keep 1.0 unless Kea vanishes from the frame; if it does, keep 1.5 and say why in the README and report.
- [ ] Step 4: perf spec Britannic scenes within budget (`npx playwright test e2e/perf.spec.ts --project=chromium`).
- [ ] Step 5: screenshots: boats on the water at 8:45 (re-shoot of 77), Kea at true height. Commit `fix(shipwreck): the Britannic's boats on the water, Kea at true height`.

## Task 4: The foremast on the floor (Opus, model/scene)

**Files:** the Britannic's model build (`britannicRecipe.ts` / `buildShip.ts` / `TitanicModel.tsx` handles) and the scene's wreck path (`funnelWreck.ts` pattern, `Wreckage.tsx` or `ShipRig.tsx`), tests beside them. Not the recipe cache or materials.

- [ ] Step 1: failing test: when she lies on her side on the floor (her wreck pose), the foremast's top is within 2 m of the floor (120 m) and it does not pass through the floor or the hull; before the bow lands, and in What-if runs where she floats or breaks, it stands on her as now.
- [ ] Step 2: implement: split her foremast into its own part (as funnels are), and lay it down on the floor beside her bow (bent, [WP]) once she lies there, eased like `layFunnel`. Titanic/Lusitania recipe snapshots stay equal; draw calls +1 at most (update perf budget for Britannic only).
- [ ] Step 3: screenshot the wreck from the underwater camera. Commit `feat(shipwreck): the Britannic's foremast lies on the floor`.

## Task 5: List asymmetry ruling and review minors (Sonnet)

**Files:** as each item needs; `lib/shipwreck/sim/README.md`, the spec's R21.

- [ ] Step 1 (R21): search for a sourced asymmetry (coal in starboard bunkers, stores, hospital fittings) for her on 21 Nov 1916. Only if a source gives a side and a magnitude, replace `tcg: -0.02` with it (Opus re-dispatch for recalibration). Otherwise leave the 2 cm seed and record in R21 and the sim README what was searched and why it stays.
- [ ] Step 2: minors from the ledger, each a small commit or skipped with a reason: model README "Medium and low drop the rivets" bullet misplaced; analytics rules sync test asserts each id in its own enum list (not just anywhere in the file); `britannicStory`/realMorning `it.each` `else` → `else if (t.outcome !== "floated")`; unit test of the turn + speed profile through bow-under (yaw holds, way along heading); test that a door link ends at a break; mine-time cache keyed on the live events array (key on the track). Skip (Carpathia owns livery): HullPaint rules in 3 places, funnel black-top vertex colour test, first-swap GPU hitch, shot 47 grey wash.
- [ ] Step 3: commit(s) `fix(shipwreck): …` / `test(shipwreck): …`.

## Task 6: Verify and release (controller)

- [ ] Version: if Carpathia 1.5.0 is not on main, `SHIPWRECK_VERSION` 1.5.0 (Walk + sounds are features; Carpathia takes the next after); if it is, rebase onto it and take the next minor. Changelog entry in plain words for a young player.
- [ ] `npm run lint`, `npm run type-check`, `npm test`, `npm run build`, `npx playwright test e2e/shipwreck*.spec.ts --project=chromium`, perf spec.
- [ ] Squash to one commit (trailer `Assisted-by: Claude`), PR with AI-assistance footer, squash-merge on green, confirm `https://gentryriggen.com/shipwreck/version.json`.
