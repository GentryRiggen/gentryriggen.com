# Shipwreck 1.17 and 1.18: Walk the Costa Concordia, then go inside her — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Gentry's CLAUDE.md overrides apply: overlap task N's review with task N+1's implementer, one implementer at a time, one combined review per task, Minor findings folded into the next task's brief, an Opus final review of the whole branch before each release PR.

**Goal:** 1.17.0 lets kids walk the Concordia's open decks (pool hall, lidos, water slide, sports deck, boat deck with boarding) while she leans; 1.18.0 takes them inside (atrium with a visible glass-lift ride, a balcony stateroom, low deck 1 cabins that flood slowly, the theatre, the Squok club), with rooms open to 30° of heel.

**Architecture:** Her open decks are a `WalkMap` (`concordiaDecks.ts`) like the other ships', plus four map flags only she sets (`eyesShipUp`, `heelFeel`, `swimAroundSuperstructure`, `walkEndsAtHeelDeg`). Her rooms are 1.15 room-kit data (`interior/concordia.ts`) with new vocabulary and three new mechanisms behind her interior's fields: deck rooms (`deckRoom`), slow seep (`seep`), the heel close (`closeAtHeelDeg`), emergency flicker and glass lift shafts with a ride (`lifts`). The Titanic's data sets none of them, so her output is unchanged.

**Tech Stack:** Next 16, React 19, react-three-fiber, three.js, zustand, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-27-shipwreck-concordia-walk-design.md` (read it first; its Decisions are fixed, its Rulings are decisions until Gentry changes them). Also read the 1.15 spec (`2026-11-27-shipwreck-titanic-interiors-design.md`), `lib/shipwreck/walk/README.md`, `lib/shipwreck/interior/README.md` and, after the rebase, the 1.16 spec (`2026-11-27-shipwreck-find-inside-design.md`).

**Branch:** `feat/shipwreck-concordia` in `/Users/griggen/dev/code/personal/gr-shipwreck-concordia`, off `main` 96cb7308 (1.15.0). **Task 1 rebases onto `main` after 1.16.0 lands**; do not start Task 1 before it has.

## Global constraints (every task)

- Every other ship's behaviour is unchanged: every existing test in `lib/shipwreck/walk/__tests__/`, `lib/shipwreck/interior/__tests__/`, `components/shipwreck/interior/__tests__/`, `components/shipwreck/scene/__tests__/` and `components/shipwreck/audio/__tests__/` passes **unchanged** (diff them: the only allowed edit is adding cases). New behaviour is keyed on fields only her data sets.
- The sim is never written: `lib/shipwreck/sim/`, `lib/shipwreck/ships/concordia.ts`'s physics data and every golden test stay as they are (`sheerRefDeck` is the one field added to her spec; it is read only by `deckZAt`).
- `lib/` never imports `components/`. Safari 15 compat lint (`lib/game-kit/compat.ts`). No per-frame allocations in `useFrame` or `stepWalker` paths (scratch objects).
- No new three.js lights. Her rooms use 1.15's interior shader.
- Kid UI: picture buttons only, words only in `aria-label`; the walk HUD's 80 px round buttons; safe areas (`lib/game-kit/__tests__/safeAreaGuard.test.ts`).
- Nothing of hers is built when not walking on her. Existing `e2e/perf-budget.json` entries do not change (new keys only; `PERF_UPDATE=1` rewrites the file, so restore every old entry by hand and diff).
- New unit tests run under ~2 s each, or go in `jest.sims.js`.
- Tests key on her heel (`frame.listDeg`), never on clock strings.
- Commits: conventional, one per task, trailer `Assisted-by: Claude`.

## Expensive checks (run once, not per task)

- **Baseline (controller, after Task 1's rebase):** `npx playwright test e2e/shipwreck-walk.spec.ts e2e/shipwreck-interiors.spec.ts --project=chromium` and `npx playwright test e2e/perf.spec.ts --project=chromium` (keep `perf-results.json`).
- **After Task 3** (heel rules rewire `WalkRunner`): `npx playwright test e2e/shipwreck-walk.spec.ts --project=chromium`.
- **Release 1.17 (Task 5)** and **release 1.18 (Task 10)**: `npm run validate`, the walk, interiors and new Concordia specs, the perf spec.
- Sims: not needed (no sim, engine or balance change).

## Review focus (for every reviewer)

1. **Another ship changed.** Any diff in an existing test file, a Titanic triangle count, a perf budget, or a code path that runs without one of her flags. Reviewers diff `__tests__` and grep new branches for the flag that guards them.
2. **The drift is unsafe.** A walker carried by the heel drift through a door or lift link, over a sea rail, into a blocker, or pinned in a corner; the stick unable to walk uphill at 30° inside or 40° on deck. Task 3's tests pin these.
3. **The lift ride breaks the walker.** A seek, close, Go outside or Back on deck during a ride leaves `ride` set, the walker frozen, or the eyes at the wrong height; a ride to a flooded stop. Task 8's tests pin these.
4. **Seep is not deterministic.** The level at a shown time depends on how you got there (playing vs seeking), or rises above the sea. Task 7's test seeks both ways.
5. **Closing at 30° strands someone.** A walker inside at 30° lands in water, in a room, or nowhere; entries or door buttons still show past 30°. Task 7's tests pin these.

---

## Release 1.17.0 — walk her open decks

### Task 1: Rebase, `deckZAt` for her, the per-ship registry

**Model:** Sonnet. **Review:** one combined review.

**Files:**

- Modify: `lib/shipwreck/ships/types.ts` (`ShipSpec.sheerRefDeck?: string`, documented), `lib/shipwreck/ships/concordia.ts` (`sheerRefDeck: "3"` only), `lib/shipwreck/places.ts` (`deckZAt` reads it; `cDeckZ` replaced by `deckZAt(…, concordia)`), `lib/shipwreck/walk/index.ts`, `lib/shipwreck/interior/index.ts`
- Create: `lib/shipwreck/walk/registry.ts`, `lib/shipwreck/__tests__/deckZAt.test.ts`, `lib/shipwreck/walk/__tests__/registry.test.ts`
- Modify: `lib/shipwreck/walk/README.md` (the `deckZAt` paragraph)

**Interfaces (produces):**

- `deckZAt(deck, x, spec: Pick<ShipSpec, "decks" | "sheerZ" | "sheerRefDeck">)`: reference = `spec.sheerRefDeck ?? ("C" present ? "C" : "Upper")`.
- `registry.ts`: `interface ShipWalk { deck: WalkMap; interior?: InteriorMap }`; `const SHIP_WALKS: Partial<Record<ShipId, ShipWalk>>`; `walkMapFor(ship)` returns `deck` or `withInterior(deck, interior)` memoised per ship; `interiorFor(ship)` returns `interior ?? null`. `interior/index.ts` re-exports `interiorFor` from there, or the registry imports interiors lazily: avoid an import cycle (`walk/types.ts` imports `places.ts`; `interior/merge.ts` imports walk types). Put the registry where the cycle check (`npm run type-check` plus a Jest import of both indexes) is clean.

**Steps:**

- [ ] `git fetch && git rebase origin/main` (1.16.0 must be on `main`: `grep SHIPWRECK_VERSION lib/shipwreck/version.ts` shows `1.16.0`). Read the 1.16 spec and the merged `entries` type and icons; note their names in the PR description for Tasks 6 and 9.
- [ ] Write `deckZAt.test.ts`: for titanic, britannic, lusitania, carpathia, fitzgerald, poseidon, every deck × x in [−100, −40, 0, 40, 100], equals the old formula (copied into the test as `oldDeckZAt`); for concordia every deck at every x equals `deck.z` (flat sheer); `deckZAt("4", 0, concordia)` is 22.58.
- [ ] Write `registry.test.ts`: `walkMapFor("titanic")` deep-equals `withInterior(TITANIC_WALK, TITANIC_INTERIOR)` and is the same object on a second call; lusitania, britannic, carpathia unchanged; `interiorFor` null for every ship but titanic.
- [ ] Run `npx jest lib/shipwreck/__tests__/deckZAt.test.ts lib/shipwreck/walk/__tests__/registry.test.ts`: the concordia cases fail.
- [ ] Implement. Run `npx jest lib/shipwreck` and `npm run type-check`: green; the Concordia places test (if any pins her place heights) unchanged.
- [ ] Commit: `refactor(shipwreck): deckZAt sheer reference per ship, walk registry`.

---

### Task 2: Her open-deck walk map

**Model:** Opus (geometry from the recipe, the recess ruling, boarding). **Review:** one combined review; the reviewer walks her in the dev server.

**Files:**

- Create: `lib/shipwreck/walk/concordiaDecks.ts` (`CONCORDIA_WALK`)
- Modify: `lib/shipwreck/walk/registry.ts` (her entry, deck only), `lib/shipwreck/walk/index.ts` (export), `components/shipwreck/model/concordiaRecipe.ts` (`RECESS_INSET` 4.8 → 7.4; export the constants the map reads: `RECESS`, `RECESS_INSET`, `SPA`, the block spans, the slide centre, the pools), `lib/shipwreck/walk/__tests__/maps.test.ts` (her cases), `lib/shipwreck/walk/README.md` (her decks)
- Maybe modify: `components/shipwreck/scene/Effects.tsx` (recess boats' boarding spot, only if the reach test fails)

**Data:** the spec's "Her deck map" table: areas `lido-aft`, `pool-hall`, `lido-fwd`, `aft-terrace`, `sports-deck`, `boat-deck-p`, `boat-deck-s`; blockers for the aft glass houses, funnel casing and funnel, radomes whose feet are on a walkable area, both pools' basins, the slide tower, the radar mast's feet, the spa's front where it rises from `lido-fwd`, liferaft racks, the boats (box per boat, on the boat decks); stairs as listed; spawn in `pool-hall` starboard of the pool, yaw 0. `lib/` cannot import `components/`: if the recipe's constants are needed in `lib/`, move them into `lib/shipwreck/ships/concordiaLayout.ts` and have the recipe import them (same values).

**Steps:**

- [ ] Add her cases to `maps.test.ts` first (as the Britannic's): every outline CCW and simple; every blocker matches what the recipe draws (glass houses, casing, funnel, slide tower, pools, mast); rails at `edge(x) − 0.1` where the recipe's `edgeRun`s are; every stair's ends inside their areas with 0.3 m clear; every area reachable from the spawn; boat-deck promenade at least 2.2 m wide between the recess wall and the boats along x −101..104; spawn in `pool-hall` and dry at t 0.
- [ ] Add a boarding case (in `lib/shipwreck/__tests__/boatRide.test.ts`): for each of her 26 boats, a walker on the promenade's centre line beside the boat's middle gets that boat from `nearestBoardable` with spots built as `Effects.tsx` builds them.
- [ ] Run them: fail (no map).
- [ ] Implement the map and the recess change. If the boarding case fails, change her spots in `Effects.tsx` to the boat's inboard side for recess boats only (a flag on the boat recipe from `recessBoats`), and keep every other ship's spot identical.
- [ ] Run `npx jest lib/shipwreck components/shipwreck/model` and `npm run type-check`. Run `node scripts/shipwreck-model-shots.mjs` (her views): draw and triangle counts unchanged from before the recess change.
- [ ] Manual (`npx next dev --webpack`, `/shipwreck`, Concordia, Walk at 22:00): walk the pool hall to every area, board a starboard boat at 22:50. Screenshots to `.screenshots/concordia-task-2/` (not committed).
- [ ] Commit: `feat(shipwreck): walk the Costa Concordia's open decks`.

---

### Task 3: Walking her as she leans

**Model:** Opus (feel rules and their safety). **Review:** one combined review; the reviewer plays her at 25°, 35° and 39° (seek, then walk with the on-screen stick).

**Files:**

- Modify: `lib/shipwreck/walk/types.ts` (`WalkMap.eyesShipUp?`, `heelFeel?`, `swimAroundSuperstructure?`, `walkEndsAtHeelDeg?`; constants `HEEL_FEEL_FROM_DEG = 8`, `HEEL_FEEL_FULL_DEG = 30`, `HEEL_UPHILL_LOSS = 0.45`, `HEEL_DRIFT_MS = 0.8`), `lib/shipwreck/walk/step.ts`, `lib/shipwreck/walk/swim.ts`, `components/shipwreck/scene/walkCamera.ts`, `components/shipwreck/scene/WalkRunner.tsx`, `lib/shipwreck/walk/concordiaDecks.ts` (sets all four: 40 for the end), `components/shipwreck/audio/cues.ts` (`LIST_CREAK_SHIPS = ["concordia"]`, `LIST_CREAK_FROM_DEG = 5`, `LIST_CREAK_FULL_DEG = 40`), `lib/shipwreck/walk/README.md` ("Her lean")
- Create: `lib/shipwreck/walk/__tests__/heelFeel.test.ts`
- Modify tests (add cases only): `components/shipwreck/scene/__tests__/walkCamera.test.ts`, `WalkRunner.test.tsx`, `lib/shipwreck/walk/__tests__/swim.test.ts`, `components/shipwreck/audio/__tests__/cues.test.ts`

**Interfaces (produces):**

- `heelDrift(pose: BodyPose): { k: number; downhill: V2 }` (pure; k per the spec's formula from `deckSlope`).
- `stepWalker`, when `ctx.map.heelFeel` and not riding: the stick's uphill component scaled by `1 − HEEL_UPHILL_LOSS·k`; `HEEL_DRIFT_MS·k` downhill added through the same `moveInOutline`/`resolveBody` path; links fire only when the stick's own motion reaches them (track whether a substep's motion had stick input).
- `deckEyes`: ship-up eyes when `map.eyesShipUp` (the interior branch's maths).
- `placeWalker` returns null when `map.walkEndsAtHeelDeg` and `|frame.listDeg| ≥` it.
- `WalkRunner`: on her deck at `|listDeg| ≥ walkEndsAtHeelDeg`, the fall-and-splash path (`goInSea`) toward her low side.
- `HullPiece.superstructure?: readonly { fromX; toX; topZ; halfBreadthM? }[]`; `pieceClearance` counts them when set; `WalkRunner` passes `spec.superstructure` only for maps with `swimAroundSuperstructure`.

**Steps:**

- [ ] Write `heelFeel.test.ts` (synthetic poses on her real map, fixed dt 1/60):
  - level pose: walking matches a map without `heelFeel` exactly;
  - 30° list: standing still for 5 s moves the walker downhill and stops against the low rail or wall, inside every outline; straight uphill nets ≥ 1.4 m/s on deck at 40° (k capped at 1) and ≥ 0.6 m/s on a synthetic interior area at 30°;
  - drift alone never takes a stair link (stand 0.2 m uphill of a link's `from`, downhill of nothing else: 10 s, `via` never set), never goes overboard (`inWater` null against a sea rail for 10 s), never enters a blocker;
  - a seeded 60 s random walk at 35° on every area: never outside every outline, never stuck 3 s;
  - `HEEL_FEEL_FROM_DEG`: at 7° no drift.
- [ ] Add: `walkCamera.test.ts` (with `eyesShipUp` at 40° the eyes are 1.6 m along her up from the feet; without it, unchanged); `swim.test.ts` (at 65° a swimmer paddling at her superstructure's side is held clear of its boxes; without the flag, unchanged); `WalkRunner.test.tsx` (her deck at 40.1°: phase becomes water; `canReboard` false; at 39° still on deck); `cues.test.ts` (Concordia at 0° trim and 30° list has strain > 0.5; the Titanic at 30° list keeps today's strain).
- [ ] Run: fail. Implement. `npx jest lib/shipwreck/walk components/shipwreck/scene components/shipwreck/audio`; `npm run type-check`.
- [ ] Commit: `feat(shipwreck): walking the Concordia as she leans`.

---

### Task 4: The pool hall, drawn by the room kit

**Model:** Opus (look). **Review:** one combined review with the screenshots.

**Files:**

- Modify: `lib/shipwreck/interior/types.ts` (`Room.deckRoom?: true`; `WallFinish` + `glass`; `FloorFinish` + `tile`, `teak`; `PieceId` + `pool-edge`, `lounger`; `RoomKind` + `pool-hall`), `lib/shipwreck/interior/merge.ts` (a `deckRoom` merges as a non-interior area: no `interior` flag, keeps `kind`), `lib/shipwreck/interior/kit.ts` (footprints), `components/shipwreck/interior/kit.ts` (glass finish: double-sided tinted in the glass group; tile and teak textures; deck-room zones always drawn while walking on the ship; floors 2 cm over the deck), `components/shipwreck/interior/pieces.ts` (`pool-edge` with its basin, `lounger`), `components/shipwreck/interior/textures.ts`, `components/shipwreck/interior/Interior.tsx` (draw deck-room zones on deck; the pool's water level = the basin's low rim's earth z, clamped to the basin), `components/shipwreck/interior/water.ts` (a basin's water uses the same surface shader)
- Create: `lib/shipwreck/interior/concordia.ts` (`CONCORDIA_INTERIOR` with the pool hall only; header listing her rulings so far), tests `lib/shipwreck/interior/__tests__/concordiaMap.test.ts`
- Modify: `lib/shipwreck/walk/registry.ts` (her interior), `lib/shipwreck/walk/concordiaDecks.ts` (the pool hall area now comes from the interior: remove the duplicate; the merged map's `pool-hall` keeps its id), `components/shipwreck/interior/__tests__/kit.test.ts`, `pieces.test.ts` (add cases)

**Steps:**

- [ ] Tests first: `concordiaMap.test.ts` (the pool hall merges as a non-interior area; walking into it keeps deck speed and jumping; it never closes: `interiorsOpen` false still lets a walker in); `kit.test.ts` (Titanic zones' triangle counts and mesh counts identical to before; her pool-hall zone ≤ 25k triangles and ≤ 6 meshes); `pieces.test.ts` (new pieces finite, counts recorded).
- [ ] Run, fail; implement; `npx jest lib/shipwreck components/shipwreck/interior`; `npm run type-check`; `npm run lint`.
- [ ] Manual: the pool hall at 22:00 (lit, then emergency after 21:46), at 23:00 (water down at the low rim), from the lido looking in. Screenshots `.screenshots/concordia-task-4/`.
- [ ] Commit: `feat(shipwreck): the Concordia's glass-roofed pool hall`.

---

### Task 5: Release 1.17.0

**Model:** Sonnet. **Review:** one combined review; run the `game-release-review` skill before the PR.

**Files:**

- Modify: `lib/shipwreck/version.ts` → `"1.17.0"`; `lib/shipwreck/changelog.ts` (the spec's 1.17.0 draft, ship-dated, checked against `git log` of the branch); `lib/shipwreck/help.ts` and `components/shipwreck/parentLine.ts` (her walk line in plain words: "You can walk her top decks and board a lifeboat."); their tests if they pin text
- Create: `e2e/shipwreck-concordia.spec.ts` (Chromium, not `@smoke`): (1) real night, Walk at 22:00: `getWalk().area === "pool-hall"`; walk into `lido-fwd`; (2) `placeWalk` on `boat-deck-s` beside boat 0 at 22:50, board: phase `"boat"`; (3) seek to 30° (`heelDeg` ≥ 30), stand 3 s: the walker moved downhill and is on deck; (4) seek past 40°: phase `"water"`, Back on deck hidden.
- Modify: `e2e/perf.spec.ts` + `e2e/perf-budget.json` (new key `shipwreck-walk-concordia-pool`, target ≤ 62 draws, ≤ 430k triangles; old keys unchanged); `lib/shipwreck/testHooks.ts` + `components/shipwreck/scene/sceneHooks.ts` (`getWalk().heelDeg`); `components/shipwreck/model/README.md` (the deeper recess); `CLAUDE.md` Shipwreck section only if a rule changed

**Steps:**

- [ ] Version, changelog: `npx jest lib/shipwreck/__tests__/changelog.test.ts` green.
- [ ] e2e: `npx playwright test e2e/shipwreck-concordia.spec.ts e2e/shipwreck-walk.spec.ts e2e/shipwreck-interiors.spec.ts --project=chromium` green.
- [ ] Perf: `npx playwright test e2e/perf.spec.ts --project=chromium`; every old scene within its unchanged budget (compare to the baseline); the new one under target.
- [ ] `npm run validate` green.
- [ ] Screenshots (iPad landscape, medium tier) to `/Users/griggen/dev/code/personal/shipwreck-shots/concordia-1.17/NN-name.png` with `captions.txt`: pool hall, the slide, the aft lido and funnel, the sports deck, the boat deck promenade, boarding, the deck at 25° and at 38°, floating beside her after 40°.
- [ ] Commit: `feat: Shipwreck 1.17.0 — walk the Costa Concordia`.

---

## Release 1.18.0 — go inside her

### Task 6: Her rooms (blockout) and the modern vocabulary

**Model:** Opus (layout inventions, fit inside her blocks). **Review:** one combined review; the reviewer walks every room in the dev server.

**Files:**

- Modify: `lib/shipwreck/interior/types.ts` (the spec's full vocabulary list; `LiftShaft`; `InteriorMap.lifts?`, `closeAtHeelDeg?`, `emergencyFlicker?`; `Room.seep?`), `lib/shipwreck/interior/merge.ts` (one `lift-car` area per stop, seamed to its landing; **for now** `lift` links between consecutive stops, so every room is reachable; Task 8 replaces them), `lib/shipwreck/interior/kit.ts` (footprints for blocking pieces), `lib/shipwreck/interior/concordia.ts` (the spec's room table, deck doors `entry-p`, `entry-s`, `squok`, shut doors, furniture positions, `lifts`, `closeAtHeelDeg: 30`, `emergencyFlicker: true`, `seep` on deck 1's rooms, the 1.16 `entries`; header listing every invention), `lib/shipwreck/interior/README.md` ("Her rooms", the new vocabulary)
- Modify tests: `lib/shipwreck/interior/__tests__/concordiaMap.test.ts`; `lib/shipwreck/walk/__tests__/hallFeel.test.ts` (parameterise over every ship in the registry with rooms; Titanic cases unchanged; if her run pushes the file over ~2 s, put hers in `concordiaHallFeel.test.ts` in `jest.sims.js`)
- Modify: `components/shipwreck/interior/kit.ts` only so new kinds and finishes build as plain blockout (flat colours per finish); the art is Task 9

**Steps:**

- [ ] Tests first, `concordiaMap.test.ts` (as `titanicMap.test.ts`): outlines CCW and simple; seams are edges of both rooms with floors within 2 cm; every room except `noWalk` reachable from a deck door (BFS over seams, links and lift stops); link ends 0.3 m clear; deck door outside ends on her deck areas within 0.5 m of the wall; 2.1 m headroom on a 0.25 m grid; **every room's box lies inside one of her model's blocks and under its roof** (from `concordiaLayout.ts`'s spans) except the balcony (inside her edge, outside the balcony back wall) and the pool hall; the atrium's well has no walkable floor at decks 4–5; theatre aisles 1.1 m clear past every seat row; every entry's spawn inside its room, dry at 22:00, facing within 90° of its named target; the Titanic interior object is unchanged (snapshot of `TITANIC_INTERIOR` and its merged map).
- [ ] `hallFeel` on her corridors, doorways, the atrium stair, the theatre aisles and a random walk per zone.
- [ ] Run, fail; implement; `npx jest lib/shipwreck components/shipwreck/interior`; `npm run type-check`.
- [ ] Manual: walk in from the boat deck, down the atrium stair, take the stopgap lift to deck 1 and deck 7, out onto the balcony, into the theatre, into the Squok club from the pool hall; the picker's room buttons start in each room. Screenshots `.screenshots/concordia-task-6/`.
- [ ] Commit: `feat(shipwreck): the Concordia's rooms (blockout)`.

---

### Task 7: Rooms that close, seep and flicker; sound inside

**Model:** Sonnet. **Review:** one combined review.

**Files:**

- Create: `lib/shipwreck/interior/seep.ts` (`ROOM_SEEP_M_PER_S = 0.005`; `seepLevels(interior, frames, spec): SeepTable`; `seepLevelAt(table, roomIndex, t): number` earth z or `-Infinity` dry), `lib/shipwreck/interior/open.ts` (`roomsOpen(interior, frame, broken): boolean`: false when broken, or when `closeAtHeelDeg` and `|frame.listDeg| ≥` it)
- Modify: `lib/shipwreck/interior/lights.ts` (`emergencyFlicker(power, emergencyLight, t, heelDeg): number`: deterministic dips while `power ≤ emergencyLight + 0.01`, none under 10°, about one a second at 30°, never under 0.1), `components/shipwreck/interior/Interior.tsx` (uses `roomsOpen` instead of `!runtime.broken`; seep rooms' target from the table; flicker on her room power; emergency lamps lit at emergency power), `components/shipwreck/scene/WalkRunner.tsx` (`ctx.interiorsOpen = roomsOpen(...)`; inside and not open and not broken → walked out with `doorExit`, else spawn, else sea, the ripple wipe; broken → today's sea path), the 1.16 entries' hide rule (uses `roomsOpen`), `components/shipwreck/audio/cues.ts` (`WalkCueInput.inside`, `wet`; inside her: `wash` bed follows `wet`, `creakFar` every 4–8 s over 15°), `components/shipwreck/audio/useShipwreckSound.ts` (passes them from the runtime), `components/shipwreck/scene/runtime.ts` (`walkWet`)
- Create tests: `lib/shipwreck/interior/__tests__/seep.test.ts`, `open.test.ts`, her timeline test `concordiaWater.test.ts` (normal lane with a fixture of her poses if simulating is slow; else `jest.sims.js`)
- Modify tests (add): `lights.test.ts`, `WalkRunner.test.tsx`, `cues.test.ts`, `Interior.test.tsx`

**Steps:**

- [ ] Tests first:
  - `seep.test.ts`: a synthetic room under a sea rising 2 m in 10 s rises at most 0.005 m/s, never above the sea, starts at the room's lowest floor point when first wet; `seepLevelAt` at t is the same whether reached by playing or by seeking (pure lookup); rooms without `seep` are absent from the table.
  - `concordiaWater.test.ts` (her real night): `lobby-1`'s starboard edge dry before the touch (12.9°), wet at least two shown minutes before 30°; `cabin-ocean` knee deep (0.5 m) somewhere before 30°; at 25° the water in `lobby-1` covers its starboard side and not its port side (it gathers low). If deck 1 cannot pass, move the low rooms and the lift's lowest stop to deck 0 in `concordia.ts`, note it in the header and the spec's ruling 6.
  - `open.test.ts`: her rooms open at 29.9°, closed at 30°; the Titanic's open until broken, whatever her list.
  - `lights.test.ts`: `emergencyFlicker` returns `power` above emergency; none under 10°; mean dips per second near 1 at 30°; never under 0.1.
  - `WalkRunner.test.tsx`: inside her at 30°: on her deck at a door's outside end, phase `"deck"`; Titanic inside at a 30° list stays inside.
  - `cues.test.ts`: `wash` follows `wet` only inside her; the Titanic's beds unchanged.
- [ ] Run, fail; implement; `npx jest lib/shipwreck components/shipwreck`; `npm run type-check`; `npm run lint`.
- [ ] Manual: `placeWalk` to `lobby-1` at 22:45 and run at 1×: water arrives starboard and creeps across; lamps die; torch on; walked out at 30°. Screenshots `.screenshots/concordia-task-7/`.
- [ ] Commit: `feat(shipwreck): the Concordia's rooms flood slowly, flicker and close at 30 degrees`.

---

### Task 8: The glass lift ride

**Model:** Opus (walker state, camera and scene timing). **Review:** one combined review; the reviewer rides every stop pair.

**Files:**

- Create: `lib/shipwreck/interior/lift.ts` (`LIFT_SPEED_MS = 1.5`, `LIFT_EASE_S = 1`; `liftRideS(lift, spec, from, to)`, `liftRideZ(lift, spec, from, to, s)`, `nextStop(lift, at, dir, dry: (stop) => boolean): number | null`, `otherCarZ(lift, spec, t)` the ambient loop), tests `lib/shipwreck/interior/__tests__/lift.test.ts`
- Modify: `lib/shipwreck/interior/merge.ts` (no stopgap `lift` links for shafts), `lib/shipwreck/walk/step.ts` (`WalkerState.ride?`; while riding: turn only, no move, no drift; at the end, area = car at `to`, ride cleared; `walkerFloorZ(map, w, spec)` exported), `lib/shipwreck/walk/walkInput.ts` (`lift?: "up" | "down"`), `components/shipwreck/scene/walkCamera.ts` (`deckEyes` uses `walkerFloorZ`), `components/shipwreck/scene/WalkRunner.tsx` (starts rides from `walkInput.lift`; seek, Back on deck, Go outside, close, `placeWalk` clear `ride`; `runtime.walkRide`), `components/shipwreck/interior/Interior.tsx` and a new `components/shipwreck/interior/liftCar.ts` (the glass car mesh per shaft, moved by matrix; the riding zone rule: every zone the shaft passes drawn while riding), `components/shipwreck/ui/WalkHud.tsx` (▲ ▼ in a car, `aria-label` "Lift up" / "Lift down", `data-testid` `shipwreck-lift-up` / `-down`, shown only when `nextStop` exists that way; no wipe on her), `components/shipwreck/ui/Icon.tsx` (`lift-up`, `lift-down`), `lib/shipwreck/testHooks.ts` + `sceneHooks.ts` (`getWalk().ride`, `rideLift(dir)`)
- Modify tests (add): `lib/shipwreck/walk/__tests__/interiorStep.test.ts`, `WalkRunner.test.tsx`, `walkCamera.test.ts`, `WalkHud.test.tsx`, `Interior.test.tsx`

**Steps:**

- [ ] Tests first:
  - `lift.test.ts`: `liftRideZ` starts at the `from` stop's floor and ends at `to`'s; speed never over 1.5 m/s; deck 1→7 takes 11–14 s; monotonic; `nextStop` skips a wet stop and returns null with no dry stop that way.
  - `interiorStep.test.ts`: riding ignores the stick, still turns; at the end the area is the arrival car and the walker can walk out through its seam; the Titanic's lift link still teleports with `via.kind === "lift"`.
  - `WalkRunner.test.tsx`: a seek mid-ride, Go outside mid-ride and the 30° close mid-ride each leave `ride` unset and the walker placed by that rule.
  - `walkCamera.test.ts`: mid-ride the eyes are 1.6 m over `liftRideZ` along her up.
  - `WalkHud.test.tsx`: ▲▼ only in a car and only toward a dry stop; tapping sets `walkInput.lift`.
  - `Interior.test.tsx`: riding draws the lobby-1, atrium and lobby-7 zones; parked, only the car's zone and its seamed zones.
- [ ] Run, fail; implement; `npx jest lib/shipwreck components/shipwreck`; `npm run type-check`; `npm run lint`.
- [ ] Manual (real GPU): ride 1 → 7 and back at 22:00; at 23:05 with deck 1 flooded (▼ skips it). Record a short screen capture for the PR. Screenshots `.screenshots/concordia-task-8/`.
- [ ] Commit: `feat(shipwreck): ride the Concordia's glass lifts`.

---

### Task 9: Her rooms' look

**Model:** Opus (look). **Review:** one combined review with the screenshots against the spec's look notes and the budgets.

**Files:**

- Modify: `components/shipwreck/interior/pieces.ts` (every new `PieceId` from the spec's list), `components/shipwreck/interior/textures.ts` (cabin veneer, cream, marble, theatre red, kids murals, cabin carpet, soft play, stage wood), `components/shipwreck/interior/kit.ts` (finishes and lamp styles `downlight`, `strip`, `chandelier`; emergency lamps and exit signs HDR), `lib/shipwreck/interior/concordia.ts` (looks, furniture, shut doors filled in), `components/shipwreck/ui/Icon.tsx` (entry icons per 1.16's style: atrium-lift, stateroom bed, low cabin, theatre, kids' club), the 1.16 entries' icon ids in `concordia.ts`
- Modify tests (add): `components/shipwreck/interior/__tests__/kit.test.ts` (her atrium zone ≤ 50k triangles and ≤ 7 meshes, each other zone ≤ 40k and ≤ 6; her whole interior ≤ 140k; every Titanic zone count identical), `pieces.test.ts`, `concordiaMap.test.ts` (blocking pieces leave every doorway, aisle and the lift doors passable: BFS with the body radius), `hallFeel` re-run

**Steps:**

- [ ] Tests first; implement; `npx jest components/shipwreck lib/shipwreck`; `npm run type-check`; `npm run lint`.
- [ ] Manual screenshots (`.screenshots/concordia-task-9/`, medium tier): atrium from the floor and from a gallery; the stateroom and its balcony at 22:00 and 23:05; lobby-1 and the ocean-view cabin flooding; the theatre from the stage and the stalls; the Squok club; a room in emergency light with the torch.
- [ ] Commit: `feat(shipwreck): the Concordia's cabins, atrium, theatre and kids' club`.

---

### Task 10: Release 1.18.0

**Model:** Sonnet. **Review:** one combined review; run the `game-release-review` skill before the PR.

**Files:**

- Modify: `lib/shipwreck/version.ts` → `"1.18.0"`; `lib/shipwreck/changelog.ts` (the spec's 1.18.0 draft, ship-dated, checked against `git log`); `lib/shipwreck/help.ts`, `components/shipwreck/parentLine.ts` ("You can walk her top decks and go inside some of her rooms."); their tests if they pin text
- Modify: `e2e/shipwreck-concordia.spec.ts` (add): (1) walk to the starboard boat-deck door, `enterDoor`: `inside`, area `entry-s`; (2) the picker's Atrium button: area `atrium-3`; `rideLift("down")` to deck 1 then `rideLift("up")` to deck 7: `ride` set mid-ride, area `lift-a@7` after; (3) `placeWalk` to `lobby-1` at 22:55, run to 29°: `depthM > 0` somewhere on the starboard side, never over 0.8 m where the walker stands; (4) at 30°: on deck, `inside === false`; (5) the stateroom entry, walk out onto `balcony`.
- Modify: `e2e/perf.spec.ts` + `e2e/perf-budget.json` (new keys `shipwreck-walk-concordia-atrium` (riding, mid-atrium) and `shipwreck-walk-concordia-cabin` (lobby-1 at 23:05), targets from the spec; old keys unchanged)
- Modify: `lib/shipwreck/walk/README.md`, `lib/shipwreck/interior/README.md`, `components/shipwreck/interior/README.md`, `components/shipwreck/scene/README.md`, `CLAUDE.md` Shipwreck section (one line: her interior flags and the registry)

**Steps:**

- [ ] Version, changelog: `npx jest lib/shipwreck/__tests__/changelog.test.ts` green.
- [ ] `npx playwright test e2e/shipwreck-concordia.spec.ts e2e/shipwreck-walk.spec.ts e2e/shipwreck-interiors.spec.ts --project=chromium` green.
- [ ] Perf: `npx playwright test e2e/perf.spec.ts --project=chromium`; old scenes within unchanged budgets; new under targets (if over: skip the sea's planar reflection while inside).
- [ ] `npm run validate` green.
- [ ] Screenshots to `/Users/griggen/dev/code/personal/shipwreck-shots/concordia-1.18/NN-name.png` with `captions.txt`: the boat-deck door, the atrium from the floor, the lift mid-ride (three frames: deck 1 lobby, the atrium opening, a gallery passing), the stateroom, the balcony looking down at the sea at 28°, the deck 1 lobby flooding at 25° (water on the low side), the ocean-view window with the sea outside, the theatre, the Squok club, emergency light with the torch, walked out at 30°.
- [ ] Commit: `feat: Shipwreck 1.18.0 — go inside the Costa Concordia`.

---

## References

- Research notes (code findings, her real spaces, sources): `/private/tmp/claude-1345853698/-Users-griggen-dev-code-personal-gentryriggen-com/9a723882-57bb-4bdb-aca8-a143daeaffa8/scratchpad/concordia-research.md` (scratch; the spec carries what matters).
- Her data: `lib/shipwreck/ships/concordia.ts` (decks, boats, `aground.pace`, `blackout`), `lib/shipwreck/sim/README.md` ("The Concordia's data and sources"), `components/shipwreck/model/concordiaRecipe.ts` (blocks, rails, pools, slide).
- 1.15 code: `lib/shipwreck/interior/`, `components/shipwreck/interior/`, `lib/shipwreck/walk/step.ts`, `components/shipwreck/scene/WalkRunner.tsx`, `walkCamera.ts`.
