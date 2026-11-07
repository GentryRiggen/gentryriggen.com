# Ever Onward prestige map (engine + Light) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Light's ember shop with a Paperclips-style 8 × 8 map of squares and hidden artifacts. The engine supports maps for any universe; Grow, Higher and Smile keep their shops until their maps ship.

**Architecture:** `UniverseDef.map?: MapDef` is static data. `UniverseSave.map?: MapState` is saved progress. One pure module, `engine/map.ts`, builds fresh runs on a square (keepsake + active artifacts + square changes, all applied through the `apply(run)` pattern on `run.mods` / `run.owned` / `run.flags`) and moves the player. The UI is a map dialog (view / choose / reveal), a shelf, a header button, an artifact layer in Light's scene, a hub stat and Test mode presets.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, Tailwind 4, Jest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-ever-onward-prestige-map-design.md`

## Global Constraints

- The start square (0,0) changes nothing, so run 1 on a map is exactly today's run 1.
- Pacing for Light, with the route bot: run 2 is 85–97% of run 1; run 10 is 65–80%; every artifact on is 45–55% and never under 40%.
- Map 8 × 8, about 14 artifacts, the last square (7,7) has no artifact.
- Artifact name, effect and catch are never rendered or labelled before it's found ("Something strange is here").
- Catch toggles apply to the next run only.
- Restart partway: a fresh run on the same square, no reward, no move.
- Save: an optional `map` per universe. Invalid map data drops to a fresh map and never drops the universe. Old prestige levels keep applying (the Keepsake).
- Retro pixel UI with a pixel font of at least 10px, every overlay pads `env(safe-area-inset-*)`, and the layout works on iPhone portrait and iPad landscape.
- Ship as an Ever Onward release: bump `lib/ever-onward/version.ts` (minor) and add a top `changelog.ts` entry in plain words.

## Review Focus

1. A save from before maps (Light with embers and levels) loads, starts at (0,0), keeps the old level effects, and the next run is no slower. (Task 1 test: `keepsake keeps old levels`.)
2. A damaged `map` in storage (bad key, square off the board, an unknown artifact id) still loads the universe. (Task 1 test: `parse drops a bad map, keeps the universe`.)
3. Choosing while the run isn't complete, or choosing a square that isn't allowed, does nothing. (Task 1 test: `stepMap ignores illegal targets`.)
4. Toggling a no-catch artifact or an unfound one does nothing. (Task 1 test.)
5. The map dialog in choose mode closed without choosing: the run stays complete, and reopening offers the same choice (the reveal plays again). (Task 3 test.)

---

### Task 1: Engine: map types, fresh runs, moving, save

**Files:**
- Modify: `lib/ever-onward/engine/types.ts` (MapDef, ArtifactDef, SquareChange, MapState; `UniverseDef.map?`, `UniverseSave.map?`)
- Modify: `lib/ever-onward/engine/engine.ts` (`newRun(def, levels, seed, shape?)`)
- Create: `lib/ever-onward/engine/map.ts`
- Modify: `lib/ever-onward/engine/prestige.ts` (`newUniverseSave` adds `map` when `def.map`; `startOver` for map universes means the same square with no reward)
- Modify: `lib/ever-onward/engine/save.ts` (parse the optional map)
- Test: `lib/ever-onward/engine/__tests__/map.test.ts` (a tiny 3 × 3 fixture def)

**Interfaces (produces):**
```ts
type SquareKey = string; // "x,y"
interface SquareChange { text: string; apply?(run: RunState): void }
type ArtifactTier = "big" | "modest" | "odd";
interface ArtifactDef { id: string; x: number; y: number; name: string; effect: string;
  catch?: string; tier: ArtifactTier; glyph: readonly string[]; palette: Palette;
  apply(run: RunState): void }
interface MapDef { cols: number; rows: number; title: string; rightLabel: string; downLabel: string;
  columns: readonly SquareChange[]; rowsChanges: readonly SquareChange[];
  artifacts: readonly ArtifactDef[]; keepsake: { name: string; glyph: readonly string[]; palette: Palette } }
interface MapState { at: SquareKey; visited: SquareKey[]; found: string[]; off: string[]; done?: boolean }
// map.ts
squareKey(x, y): SquareKey; parseSquare(key): {x,y} | null
newMapState(): MapState
mapOf(def, save): MapState                 // save.map ?? newMapState()
lastSquare(map: MapDef): SquareKey
squareChanges(def, key): SquareChange[]    // column change + row change, skipping empty
artifactAt(def, key): ArtifactDef | undefined
activeArtifacts(def, state): ArtifactDef[] // found, not in off
hasKeepsake(save): boolean                 // any prestigeUpgrades level > 0
freshRun(def, save, seed?): RunState       // newRun(def, save.prestigeUpgrades, seed, shape)
choices(def, state): { ahead: SquareKey[]; back: SquareKey[] } // right/down of `at` (on board), visited
pendingFind(def, save): ArtifactDef | undefined // run complete, square's artifact not found yet
stepMap(def, save, target, seed?): UniverseSave
toggleArtifact(def, save, id): UniverseSave
```
- `freshRun`'s shape applies, in order: active artifacts' `apply` and `flags["art:<id>"] = true`; then the square changes; then `mods.depth = y`.
- `stepMap` (only when `run.complete` and `target` is in `ahead` ∪ `back` ∪ `{at}`) does: best = min; completions + 1; the artifact at `at` is added to found; `at` is added to visited; `done` is set if `at` is the last square; then `at = target` and `run = freshRun`.

- [ ] Write failing tests: start square neutral (freshRun at (0,0) with no finds deep-equals `newRun(def, levels)`); choices at (0,0), at the board edge and with back squares; stepMap finds the artifact, adds the visit, and adds a completion; stepMap ignores illegal targets and incomplete runs; the artifact isn't found twice; toggleArtifact flips only found catch artifacts; activeArtifacts excludes off; the keepsake keeps old levels (`mods.speed` from levels); `done` at the last square; save round-trip keeps the map; parse drops a bad map and keeps the universe.
- [ ] Implement until they're green: `npx jest lib/ever-onward/engine/__tests__/map.test.ts`.
- [ ] Run all the engine tests: `npx jest lib/ever-onward/engine` must pass.
- [ ] Commit `feat(ever-onward): map engine`.

### Task 2: Light's map data, the route bot, scorecard M13 and the pacing test

**Files:**
- Create: `lib/ever-onward/universes/light/map.ts` (MAP: columns and rows from the spec's tables, 14 artifacts: big Brass Heart (6,2), Keeper's Lantern (2,6), Star Chart (5,5); modest Gull Feather (1,0), Driftwood Charm (0,2), Tin of Biscuits (2,1), Salt-Cured Coin (3,3), Ship in a Bottle (4,1), Warm Wick (1,4); odd Storm Glass (6,0), Cracked Lens (0,5), Ghost Keeper (3,5), Black Pearl (7,4), Moth Jar (4,7)). Effects multiply onto mods (`speed`, `tapMult`, `costMult`), `calm` and `bright` add, and `headStart` adds. Catches use negative calm or bright, or a lower speed or tapMult.
- Modify: `lib/ever-onward/universes/light/index.ts` (`map: MAP`)
- Create: `lib/ever-onward/engine/mapRoute.ts` (`routeStep(def, state): SquareKey`: greedy toward the nearest reachable unfound artifact, otherwise back to the visited square closest to one, otherwise toward the last square)
- Modify: `lib/ever-onward/engine/score.ts` (map universes: run2 and run3 start from `freshRun` after 1 and 2 route steps. M13 bands for maps: r21 0.85–0.97, r32 0.85–1.0, gate r21 0.75–1.05.)
- Test: `lib/ever-onward/universes/light/__tests__/map.test.ts`: every artifact is on the board and on a unique square, none at (0,0) or the last square, 14 in all, every glyph is 12 × 12 with palette keys present; the pacing test (route bot, tapper): run 2 is 85–97%, run 10 is 65–80%, all-on is 45–55%, and every run is at least 40%.
- [ ] Write the tests, tune the effect numbers until the pacing passes, and run the Light scorecard tests (`npx jest lib/ever-onward/universes/light`).
- [ ] Commit `feat(ever-onward): Light map data and pacing`.

### Task 3: Map UI: dialog, shelf, reveal, header button, end-of-run panel

**Files:**
- Create: `components/ever-onward/game/map/MapDialog.tsx` (portal overlay; `mode: "view" | "choose"`; grid, square details, Go button in choose mode, shelf below; reveal first when `pendingFind`)
- Create: `components/ever-onward/game/map/MapGrid.tsx` (CSS grid of square buttons: hatched visited, pulsing current, floating glyph for an unfound artifact labelled "Something strange is here", the found glyph dimmed, choosable squares outlined)
- Create: `components/ever-onward/game/map/Glyph.tsx` (SVG from `spriteRects`)
- Create: `components/ever-onward/game/map/ArtifactShelf.tsx` (Keepsake + found: glyph, name, effect, catch, an On/Off toggle for catch artifacts, "Applies from your next run")
- Create: `components/ever-onward/game/map/ArtifactReveal.tsx` (dim, glyph rises, flips, the name types on, a bigger burst for `big`, a cue sound)
- Modify: `GameScreen.tsx` (with `def.map`: a Map button replaces the ember button; `run.complete` shows MapEndPanel instead of EmberPanel; no ember tip; `EndingOverlay` gets `embers={0}` and hides the embers block when 0)
- Modify: `useGame.ts` (`stepTo(key)`, `toggleArtifact(id)`; `startOverRun` uses map rules)
- Modify: `app/globals.css` (`eo-map-*` keyframes: float, pulse, rise and flip, burst)
- Test: `components/ever-onward/game/map/__tests__/MapDialog.test.tsx`: an unfound artifact never shows its name; choose mode offers only legal squares and calls `onStep`; the reveal shows the name after the find; closing without choosing calls nothing.
- [ ] Tests first, then the components. `npx jest components/ever-onward` must pass.
- [ ] Commit `feat(ever-onward): map dialog, shelf and reveal`.

### Task 4: Artifacts and depth in Light's scene, hub stat, Test mode presets

**Files:**
- Create: `components/ever-onward/scenes/light/ArtifactLayer.tsx` (each active artifact's glyph floats at its own spot in the 400 × 300 viewBox, drawn over every part; the Ghost Keeper walks; row depth adds a violet dream tint, from 0 to 0.35 opacity across rows 0–7)
- Modify: `LightScene.tsx` (render the layer from a stable key of `art:` flags and `mods.depth`)
- Modify: `components/ever-onward/Hub.tsx` (stat "Map": "`visited.length` of 64 squares · `found.length` of 14 found")
- Create: `lib/ever-onward/test/mapJump.ts` (`mapPreset(def, "start" | "half" | "end"): MapState` and a complete run on a square holding an unfound artifact)
- Modify: `TestModePanel.tsx` and `useGame.ts` (`jumpToMap(universeId, preset)`; the buttons are shown only for universes with a map)
- Test: unit tests for `mapPreset`; an e2e in `e2e/ever-onward-map.spec.ts`: Test mode → Light map half → the reveal shows a name → choose a square → a new run, with the Map button showing the shelf.
- [ ] Implement, run the unit tests, the e2e (`npx playwright test e2e/ever-onward-map.spec.ts --project=chromium`), and take screenshots on iPhone and iPad.
- [ ] Release: version bump and changelog. `npm run validate`.
- [ ] Commit `feat(ever-onward): map in the scene, hub and Test mode`.

### Then

- One whole-branch review (Opus subagent), fix the findings, open the PR, CI, merge (deploys).
