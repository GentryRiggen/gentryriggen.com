# Make It Grow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Make It Grow, the second Ever Onward universe (a garden robot told to _make it grow_, from one window box to a green planet and back to one pot), on the existing engine and at the same quality bar as Keep the Light On v1.13.

**Architecture:** A new content module `lib/ever-onward/universes/grow/` (mirroring `light/`) defines `growUniverse: UniverseDef`. A small per-universe UI registry (`components/ever-onward/universes/`) supplies the scene, side panels, opening, ending, tap looks, hub sprite, prestige icon and audio, so `GameScreen`, `Hub` and the audio hook stop hardcoding Light. The universe ships dark: playable only in dev and the e2e build until the launch task flips it on behind an unlock (finish Keep the Light On).

**Tech Stack:** Next.js 16 static export, React 19, TypeScript, Tailwind 4, Jest + RTL, Playwright, the Ever Onward engine (`lib/ever-onward/engine/`), the headless simulator and the Engagement Scorecard.

**Spec:** `docs/superpowers/specs/2026-11-01-make-it-grow-design.md` (approved 2026-11-01). Also read `docs/ever-onward/lab-notebook.md` (Round 4 and its review fixes) and `docs/superpowers/specs/2026-11-01-ever-onward-engagement-research.md` (M1–M15).

## Global Constraints

- Universe id `grow`, title "Make It Grow", hub goal "Help one small seed grow, and then keep helping." (the existing locked card's copy). Catchphrase: "Ever onward."
- Phase ids, in order: `yard` ("The Backyard"), `farm` ("The Farms"), `world` ("The Green World"), `seed` ("The Last Seed").
- Resource ids: `seeds` (yard), `harvest` (farm), `green` (world), `care` (seed), `water` (every phase). Side-machine state lives in resources prefixed `be` (bees), `fr` (fair), `mg` (migration), `wb` (window box), each with its own RNG state resource (`beRng`, `frRng`, `mgRng`); `run.rng` is never advanced by a side machine.
- Prestige reuses the `embers` save field. Display name "Acorns" (`PrestigeDef.label`). No save schema change; `SAVE_VERSION` stays 1; Light saves are never rewritten by Grow code.
- Universe 1 does not change behaviour: its unit tests, e2e and `npm run score:ever-onward` output (minus the `Runtime:` line) stay byte-identical through every task.
- Engine changes only where something is missing, generic, and covered by an engine test.
- Water: free and weather-driven; storage is built (barrel, wells, irrigation, rivers/clouds). A dry garden earns exactly 50% of its watered income (`DRY_FLOOR = 0.5`), shows `def.alert`, and a tap always earns.
- Seasons (yard): a slow clock of phase time. Every seasonal multiplier is ≥ 1; winter is exactly 1. Nothing pauses, nothing is lost by ignoring them.
- Hands-on then helpers: from minute 6 of any phase a tap is ≤ 12% of income for the eager bot (gate 20%) and ≤ 15% for the realistic bot; taps ≥ 60% of income at minutes 0.5–3 (not the last phase).
- Targets for the realistic bot: yard ~30 min, farm ~35, world ~35, seed ~20; whole run 2–3 h; idle bot finishes within 4 h and never sooner than the eager bot; zero failing gates; floor set at launch (launch score − 1).
- Side machines: automation adds to hand play and never replaces it (hand-tended payout > helper-only payout); payouts in flight finish after a phase ends; reveals are staggered; result copy is kind (never "lose", "fail", "wrong", "bad"); one decision every couple of minutes, not taps; the helper upgrade appears mid-machine-life.
- The people moving out is narrative only: no resource, countdown or label counts people, towns or population.
- Kid guardrails: no timers that punish, streaks, loot boxes, monetisation; nothing can be missed; never stuck; no file under `grow/` imports `lib/analytics`; nothing scary, nobody hurt.
- Narration: every story line and phase intro gets a clip in Jim's voice (`en-US-Chirp3-HD-Aoede`). Builders never run TTS. The controller runs `npm run narration:ever-onward` and commits `public/ever-onward/voice/grow/*` plus `lib/ever-onward/narration/manifest.json` after each task that adds or edits lines. Until then the only acceptable failures in `npm test` are `narration manifest › grow/... has a current clip`.
- Scenes: SVG, retro CRT, the existing scene band (top on phones, left 55% on iPad landscape); `sceneInfo` is quantized (no 10 Hz re-renders); every upgrade lands with a callout or a caption change.
- Do not copy Universal Paperclips' or any game's text, names or progression. Not a Lighthouse reskin.
- Repo conventions: `export default function` components, `interface` props, Tailwind only, Prettier (double quotes, 80 cols), tests in `__tests__/` next to code.
- Tuning numbers are the builder's and the scorecard loop's call; this plan pins names, targets and tests, not constants.
- Review depth (CLAUDE.md): every task here is ordinary UI or plumbing, so one combined review each; Task 1 and Task 2 are refactors whose review must confirm the identical-scorecard check.

## Review Focus

1. **A Grow save meets a build where Grow is hidden** (a dev or e2e save opened in production, or production before launch): the hub renders, Light plays, and the `grow` entry is kept, not dropped or "recovered". Test in Task 2.
2. **A player who never builds water storage**: income sits at the 50% floor, the alert shows, taps earn, and the run still finishes (idle bot within 4 h). Test in Task 4.
3. **A phase ends while a side machine pays out** (bees mid-dance, pumpkin being judged, flock in flight): the payout still lands after the phase change (as Light's tide catch does) and nothing is lost. Test in Tasks 5, 8 and 11.
4. **Unlock edge cases**: a Light save from before the unlock existed with `completions > 0` opens Grow; a Light run that is mid-way with `completions: 0` sees the locked card and its hint; a Light restart for embers never re-locks Grow. Test in Task 17.
5. **A finished Grow run reloaded later**: no second ending overlay, the finished panel says "Acorns" (not "Embers") with a restart button, and the Story drawer still lists the ending lines. Test in Task 14.

---

## File map

```
lib/ever-onward/
  engine/types.ts            + PrestigeDef.label, UniverseDef.requires (T1, T17)
  engine/prestige.ts         + prestigeLabel(def)                       (T1)
  engine/progress.ts         + isUniverseUnlocked(def, save)            (T17)
  universes/staging.ts       SHOWS_UNRELEASED, playableUniverses(), lockedUniverses()  (T2)
  universes/scored.ts        SCORED_UNIVERSES, parseScoreArgs()        (T2)
  universes/index.ts         PLAYABLE_UNIVERSES / LOCKED_UNIVERSES from staging (T2)
  narration/lines.ts         narrationLines() reads playableUniverses(true) (T2)
  universes/grow/
    index.ts resources.ts phases.ts tuning.ts upgrades.ts tick.ts prestige.ts
    hooks.ts alerts.ts visitors.ts scene.ts bots.ts
    water.ts seasons.ts market.ts biomes.ts
    bees.ts fair.ts migration.ts windowbox.ts
    story/index.ts story/yard.ts story/farm.ts story/world.ts story/seed.ts
    __tests__/ (fixtures.ts + one file per task)
components/ever-onward/
  universes/types.ts index.ts light.tsx grow.tsx                         (T1, T3)
  scenes/grow/ GrowScene.tsx YardLayer.tsx FarmLayer.tsx WorldLayer.tsx SeedLayer.tsx callouts.ts captions.ts
  game/grow/ BeeDance.tsx CountyFair.tsx SeedMigration.tsx WindowBox.tsx SeasonDial.tsx GrowEndingArt.tsx
  audio/growScores.ts                                                    (T15)
scripts/ever-onward-score.ts  takes a universe id                        (T2)
e2e/ever-onward.spec.ts       + Make It Grow tests                       (T3, T17)
```

## Order and parallelism

- **Wave 1 (parallel worktrees):** Task 1 ‖ Task 2. No shared files.
- **Task 3** after both: the playable skeleton.
- **Lib lane (sequential; shares `grow/tuning.ts`, `upgrades.ts`, `tick.ts`, `hooks.ts`, `bots.ts`, `index.ts`):** T4 → T5 → T7 → T8 → T10 → T11 → T13.
- **UI lane (sequential; shares `grow/scene.ts`, `grow/visitors.ts`, `scenes/grow/*`, `components/ever-onward/universes/grow.tsx`):** T6 (after T5) → T9 (after T8) → T12 (after T11) → T14 (after T13) → T15. Each UI task may run in its own worktree alongside the next lib task; the only cross-lane file is `story/<phase>.ts`, which only the UI lane writes (lib tasks add no story lines).
- **Finish:** T16 (tuning loop) after T15. T17 (launch) may run alongside T16 (no shared files) but merges last; its version bump is the final commit.
- **Staged PRs:** PR 1 = T1–T2 (no behaviour change, merges to main). PR 2 = T3–T6. PR 3 = T7–T9. PR 4 = T10–T12. PR 5 = T13–T15. PR 6 = T16–T17 (launch, one Ever Onward minor release). Production keeps Grow on "coming soon" until PR 6.
- **Baseline before Task 1:** `npm run score:ever-onward > /tmp/eo-light-before.txt` and `npm run test:e2e -- e2e/ever-onward.spec.ts --project=chromium` on main. Full `npm run validate` and e2e again only at each PR and at launch.

---

### Task 1: Per-universe UI registry (Light moves behind it, no behaviour change)

**Files:**

- Create: `components/ever-onward/universes/types.ts`, `components/ever-onward/universes/index.ts`, `components/ever-onward/universes/light.tsx`
- Delete: `components/ever-onward/scenes/index.tsx` (replaced by the registry)
- Modify: `components/ever-onward/game/GameScreen.tsx`, `TapButton.tsx`, `PhaseOverlay.tsx`, `EndingOverlay.tsx`, `Logbook.tsx`, `EmberPanel.tsx`, `EmberDialog.tsx`, `EmberTip.tsx`, `WeatherDesk.tsx`, `TideClock.tsx`, `ProbeRaces.tsx`, `MemoryGarden.tsx`, `components/ever-onward/Hub.tsx`, `audio/useEverOnwardAudio.ts`, `audio/everOnwardSynth.ts`, `audio/scores.ts`, `scenes/light/callouts.ts` (LastBuy moves out), `lib/ever-onward/engine/types.ts`, `lib/ever-onward/engine/prestige.ts`, `lib/ever-onward/universes/light/prestige.ts`
- Test: `components/ever-onward/universes/__tests__/registry.test.tsx`, `lib/ever-onward/engine/__tests__/prestige.test.ts`

**Interfaces:**

- Consumes: `UniverseDef`, `RunState`, `SaveData` (`engine/types.ts`); `MusicSpec` (`components/game-audio/music`); `UneaseSpec`, `CueName`; `PixelIconName`; `Palette` (`lib/ever-onward/start/sprites.ts`).
- Produces (`components/ever-onward/universes/types.ts`):
  ```ts
  export interface LastBuy {
    id: number;
    upgradeId: string;
    n: number;
  }
  export interface SceneProps {
    run: RunState;
    lastBuy?: LastBuy | null;
  }
  export interface PanelProps {
    def: UniverseDef;
    run: RunState;
    onAct: (id: string) => void;
  }
  export interface TapLook {
    icon: PixelIconName;
    classes: string;
  }
  export interface UniverseAudio {
    scores: readonly MusicSpec[]; // one per phase index
    unease: readonly (UneaseSpec | null)[];
    titleScore?: MusicSpec; // a hub theme (Grow, T15/T17)
    isStormy?(run: RunState): boolean; // storm bed + tap button storm look
    cuesBetween?(before: RunState, now: RunState): CueName[];
  }
  export interface UniverseEnding {
    storyIds: readonly string[]; // closing lines, in order
    Art?: ComponentType<{ run: RunState }>; // drawn above the lines
    afterword?(save: SaveData): string | null; // not narrated (T17 uses it)
  }
  export interface UniverseUi {
    Scene: ComponentType<SceneProps>;
    panels: readonly ComponentType<PanelProps>[]; // rendered in order after ActionPanel
    Opening?: ComponentType<{
      run: RunState;
      onChoose: (value: number) => void;
    }>;
    ending: UniverseEnding;
    tapLooks: readonly TapLook[]; // per phase index
    hubSprite: { rows: readonly string[]; lit: Palette; dim: Palette };
    PrestigeIcon: ComponentType<{ className?: string }>;
    Keepsakes?: ComponentType<{ run: RunState }>; // extra logbook block
    copy: { logbookEmpty: string; stillGoing: string };
    audio: UniverseAudio;
  }
  ```
- Produces (`components/ever-onward/universes/index.ts`): `UNIVERSE_UI: Readonly<Record<string, UniverseUi>>`, `uiFor(id: string): UniverseUi` (throws `Error("No UI for universe <id>")`).
- Produces (engine): `PrestigeDef.label?: string` (plural display name, default "Embers"); `prestigeLabel(def: UniverseDef): string` in `engine/prestige.ts`.
- Produces (synth): `everOnwardSynth.setPhase(next: number | null, audio?: Pick<UniverseAudio, "scores" | "unease">)`; omitting `audio` keeps today's Light scores. `TitleScore` selection: `everOnwardSynth.setTitle(on: boolean, spec?: MusicSpec)`.

- [ ] **Step 1: Write the failing tests**

`registry.test.tsx`:

```ts
it("has a UI for every playable universe", () => {
  for (const def of PLAYABLE_UNIVERSES)
    expect(() => uiFor(def.id)).not.toThrow();
});
it("keeps Light's side panels in today's order", () => {
  expect(uiFor("light").panels).toEqual([
    TideClock,
    ProbeRaces,
    WeatherDesk,
    MemoryGarden,
  ]);
});
it("keeps Light's ending lines", () => {
  expect(uiFor("light").ending.storyIds).toEqual([
    "last-remember",
    "last-end-1",
    "last-end-2",
  ]);
});
it("gives Light a lantern opening and four tap looks", () => {
  expect(uiFor("light").Opening).toBeDefined();
  expect(uiFor("light").tapLooks).toHaveLength(4);
});
it("throws for an unknown universe", () => {
  expect(() => uiFor("nope")).toThrow("No UI for universe nope");
});
```

`prestige.test.ts` adds: `prestigeLabel(lightUniverse)` is `"Embers"`; a def with `prestige.label: "Acorns"` gives `"Acorns"`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- --testPathPatterns="universes/__tests__/registry|engine/__tests__/prestige"`
Expected: FAIL, `Cannot find module '../index'` and `prestigeLabel is not a function`.

- [ ] **Step 3: Build the registry and move Light behind it**

- `light.tsx` builds Light's `UniverseUi` from what is hardcoded today: `LightScene`, the four panels, `LanternPicker` as `Opening` (wired to the existing `onChooseLantern`, still shown only when `run.phase === 0 && run.time === 0`), `ENDING_STORY_IDS`, `LOOKS` from `TapButton`, the lighthouse sprites, `EmberIcon`, Logbook keepsakes (`keepsakeNames`, `picksSoFar`), the Light copy ("Visitors stop by as your lights grow. They wait for you, so none can be missed." and "The light is still on."), `COAST/NIGHT/SKY/LAST_SCORE`, `UNEASE`, `isStormy`, and the wxFronts/tdHauls/prLaunches/prRuns/gdPicks cue logic as `cuesBetween`.
- `GameScreen` reads `const ui = uiFor(def.id)` and renders `ui.Scene`, `ui.panels.map(...)`, `ui.Opening`, `ui.ending`; `TapButton` takes `look: TapLook` and `isStorm` from `ui.audio.isStormy?.(run) ?? false`; `Hub` takes the sprite from `uiFor(def.id).hubSprite` and the stat label from `prestigeLabel(def)`; `EmberPanel`/`EmberDialog`/`EmberTip` and the header button's aria-label use `prestigeLabel(def)` and `ui.PrestigeIcon` (test ids unchanged).
- The four panels drop their `def.id !== "light"` checks (the registry decides where they render; their open/closed checks stay).
- `useEverOnwardAudio` keeps the previous run in its ref and asks `ui.audio.cuesBetween`; `isStormy` moves to `light.tsx` (re-export from the hook file for existing imports).

- [ ] **Step 4: Run all Ever Onward tests and the identical-scorecard check**

Run: `npm test -- --testPathPatterns=ever-onward && npm run type-check && npm run score:ever-onward | grep -v '^Runtime' > /tmp/eo-light-after.txt && diff <(grep -v '^Runtime' /tmp/eo-light-before.txt) /tmp/eo-light-after.txt`
Expected: all PASS, no type errors, empty diff.

- [ ] **Step 5: Run the Ever Onward e2e**

Run: `npm run test:e2e -- e2e/ever-onward.spec.ts --project=chromium`
Expected: PASS, unchanged spec.

- [ ] **Step 6: Commit**

`git commit -m "refactor(ever-onward): per-universe UI registry, Light behind it"`

---

### Task 2: Per-universe scorecard script and dev-only staging

**Files:**

- Create: `lib/ever-onward/universes/staging.ts`, `lib/ever-onward/universes/scored.ts`
- Modify: `lib/ever-onward/universes/index.ts`, `lib/ever-onward/narration/lines.ts`, `scripts/ever-onward-score.ts`, `docs/ever-onward/lab-notebook.md` ("How to run")
- Test: `lib/ever-onward/universes/__tests__/staging.test.ts`, `lib/ever-onward/universes/__tests__/scored.test.ts`, `lib/ever-onward/engine/__tests__/save.test.ts`

**Interfaces:**

- Produces (`staging.ts`):
  - `SHOWS_UNRELEASED: boolean` = `process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1"` (the `lib/ship-builder/testHooks.ts` pattern).
  - `UNRELEASED_IDS: readonly string[]` (empty here; Task 3 adds `"grow"`, Task 17 empties it).
  - `ALL_UNIVERSES: readonly UniverseDef[]` (Light here; Task 3 appends Grow).
  - `playableUniverses(showsUnreleased: boolean): readonly UniverseDef[]`.
  - `lockedUniverses(showsUnreleased: boolean): readonly LockedUniverse[]`: the announced list minus whatever is playable.
- `index.ts`: `PLAYABLE_UNIVERSES = playableUniverses(SHOWS_UNRELEASED)`, `LOCKED_UNIVERSES = lockedUniverses(SHOWS_UNRELEASED)`; `getPlayableUniverse` unchanged.
- `lines.ts`: `narrationLines()` iterates `playableUniverses(true)` so clips exist before release.
- Produces (`scored.ts`): `SCORED_UNIVERSES: Readonly<Record<string, { def: UniverseDef; bots: () => BotSet }>>` (Light here; Task 3 adds Grow); `parseScoreArgs(argv: readonly string[]): { universeId: string; isJson: boolean }` (default `"light"`, throws `Error("Unknown universe x. Known: light, ...")`).
- Script usage: `npm run score:ever-onward -- grow [--json]`.

- [ ] **Step 1: Write the failing tests**

```ts
// staging.test.ts
it("shows only released universes in production", () => {
  expect(playableUniverses(false).map((u) => u.id)).toEqual(["light"]);
  expect(lockedUniverses(false).map((u) => u.id)).toEqual([
    "grow",
    "higher",
    "smile",
  ]);
});
it("never lists a universe as both playable and locked", () => {
  for (const shows of [true, false]) {
    const playable = new Set(playableUniverses(shows).map((u) => u.id));
    expect(lockedUniverses(shows).filter((l) => playable.has(l.id))).toEqual(
      []
    );
  }
});
// scored.test.ts
it("defaults to light", () =>
  expect(parseScoreArgs([])).toEqual({ universeId: "light", isJson: false }));
it("reads an id and --json in any order", () =>
  expect(parseScoreArgs(["--json", "light"])).toEqual({
    universeId: "light",
    isJson: true,
  }));
it("names the known ids for an unknown one", () =>
  expect(() => parseScoreArgs(["nope"])).toThrow(/Known: light/));
// save.test.ts (Review Focus 1)
it("keeps a universe entry no playable universe knows about", () => {
  // a valid UniverseSave (newUniverseSave(lightUniverse)) stored under an id no universe has
  const raw = {
    ...newSave(),
    universes: { grow: newUniverseSave(lightUniverse) },
  };
  expect(parseSave(raw)?.universes.grow).toBeDefined();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- --testPathPatterns="universes/__tests__/(staging|scored)|engine/__tests__/save"`
Expected: FAIL on the missing modules (the save test may already pass; keep it as a guard).

- [ ] **Step 3: Implement `staging.ts`, `scored.ts`, rewire `index.ts`, `lines.ts` and the script**

The script prints exactly what it prints today for Light (title line unchanged), using `SCORED_UNIVERSES[universeId]`.

- [ ] **Step 4: Verify tests and the identical scorecard**

Run: `npm test -- --testPathPatterns=ever-onward && diff <(npm run -s score:ever-onward | grep -v '^Runtime') <(grep -v '^Runtime' /tmp/eo-light-before.txt)`
Expected: PASS; empty diff.

- [ ] **Step 5: Commit**

`git commit -m "feat(ever-onward): score any universe, stage unreleased ones in dev and e2e"`

---

### Task 3: Make It Grow skeleton, playable end to end in dev and e2e

**Files:**

- Create: `lib/ever-onward/universes/grow/{index,resources,phases,tuning,upgrades,tick,prestige,hooks,alerts,visitors,scene,bots}.ts`, `grow/story/{index,yard,farm,world,seed}.ts`, `grow/__tests__/fixtures.ts`, `components/ever-onward/universes/grow.tsx`, `components/ever-onward/scenes/grow/GrowScene.tsx`, `scenes/grow/captions.ts`
- Modify: `lib/ever-onward/universes/staging.ts` (`ALL_UNIVERSES` + `UNRELEASED_IDS = ["grow"]`), `scored.ts`, `components/ever-onward/universes/index.ts`, `e2e/ever-onward.spec.ts`
- Test: `grow/__tests__/skeleton.test.ts`, `grow/__tests__/guardrails.test.ts`

**Interfaces:**

- Consumes: Task 1 `UniverseUi`, `uiFor`; Task 2 `ALL_UNIVERSES`, `SCORED_UNIVERSES`; engine `genericBots`, `simulate`, `scoreUniverse`, `visitorHereFlag`.
- Produces:
  - `growUniverse: UniverseDef` (`grow/index.ts`), `maxVisible: 3`, `alert: growAlert`, `prestige: PRESTIGE` with `label: "Acorns"`.
  - `grow/resources.ts`: `PHASE_YARD = "yard"`, `PHASE_FARM = "farm"`, `PHASE_WORLD = "world"`, `PHASE_SEED = "seed"`, `type GrowPhaseId`, `RESOURCES`.
  - `grow/tick.ts`: `tickGrow(run, dt): void`, `manualGrow(run): void`, `isGrowComplete(run): boolean` (= `run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true`), `incomePerSecond(run): number` (the phase's manual resource per second from helpers, for panels and bots).
  - `grow/visitors.ts`: `RETURN_VISITOR_ID = "seed-return"`, `VISITORS`, `TEASERS`, `growCountdown`.
  - `grow/story/index.ts`: `STORY`, `ENDING_STORY_IDS = ["seed-return", "seed-end-1", "seed-end-2"]`.
  - `grow/scene.ts`: `interface GrowSceneInfo { phase: GrowPhaseId; ... }`, `sceneInfo(run): GrowSceneInfo`, `isSameSceneInfo(a, b): boolean`.
  - `grow/hooks.ts`: `growPlates`, `GROW_PLATE_ACTIONS`, `GROW_CONSUMABLES`, `growIncomeView`, `growSceneDiff` (= `!isSameSceneInfo(sceneInfo(a), sceneInfo(b))`).
  - `grow/bots.ts`: `growBots(): BotSet` (starts as `genericBots(growUniverse)`; later tasks add policies).
  - `grow/__tests__/fixtures.ts`: `def = growUniverse`, `runAtPhaseStart(index: number): RunState` (driven by the tapper bot, like Light's fixture).
  - `components/ever-onward/universes/grow.tsx`: `GROW_UI: UniverseUi` (no panels yet, placeholder hub sprite reusing the padlock-free robot palette, `EmberIcon` until Task 14 draws an acorn, Light's scores as placeholders until Task 15).

Skeleton content: each phase has an `intro` (2–4 vivid sentences; yard opens "This is one small seed, and you are its gardener…"), a `goal`, a manual action that always earns, one helper, one scaling upgrade and one phase-ending purchase (`isDone`). The seed phase: tending grows one pot; at full growth the `seed-return` visitor arrives and the run completes. One hello line per phase plus the three ending lines.

- [ ] **Step 1: Write the failing tests**

```ts
// skeleton.test.ts
it("is registered as id grow with four phases in order", () =>
  expect(def.phases.map((p) => p.id)).toEqual([
    "yard",
    "farm",
    "world",
    "seed",
  ]));
it.each([0, 1, 2, 3])(
  "a tap earns the phase's resource in phase %i, even from nothing",
  (i) => {
    const run = {
      ...runAtPhaseStart(i),
      resources: {
        ...runAtPhaseStart(i).resources,
        [def.phases[i].manualResource]: 0,
      },
    };
    expect(manualGain(def, run)).toBeGreaterThan(0);
  }
);
it("finishes for the eager, realistic and idle bots within 8 hours", () => {
  for (const s of [growBots().tapper, growBots().realistic, growBots().idle])
    expect(simulate(def, { strategy: s, maxSeconds: 8 * 3600 }).finished).toBe(
      true
    );
});
it("completes when the visitor comes back", () => {
  const end = simulate(def, {
    strategy: growBots().tapper,
    maxSeconds: 8 * 3600,
  }).finalRun;
  expect(end.flags[visitorHereFlag("seed-return")]).toBe(true);
});
it("calls its prestige Acorns", () =>
  expect(prestigeLabel(def)).toBe("Acorns"));
it("never touches the Light save", () => {
  /* save with light + grow; endRun(grow); light entry deep-equals before */
});
it("is listed by the scorecard script", () =>
  expect(parseScoreArgs(["grow"]).universeId).toBe("grow"));

// guardrails.test.ts
it("imports nothing from lib/analytics", () => {
  /* read every file under grow/, scenes/grow, game/grow; none matches /analytics/ */
});
it("counts no people", () =>
  expect(
    def.resources.filter((r) =>
      /people|population|resident|town/i.test(r.label + r.id)
    )
  ).toEqual([]));
it("keeps every line gentle", () =>
  expect(
    def.story.filter((m) =>
      /\b(die|dead|death|kill|hurt|scared|blood)\b/i.test(m.text)
    )
  ).toEqual([]));
it("ends the run in the last phase and nowhere else", () => {
  /* isComplete false at phases 0-2 starts */
});
```

e2e (`e2e/ever-onward.spec.ts`, tag `@smoke`): "Make It Grow plays in the e2e build": open hub, `lm-play-grow` visible, click, phase overlay contains "The Backyard", Continue, tap `lm-tap`, a `+N` floater shows, `lm-scene` visible.

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- --testPathPatterns=universes/grow`
Expected: FAIL, `Cannot find module '..'`.

- [ ] **Step 3: Implement the skeleton files listed above and register Grow**

`GrowScene` draws one simple SVG per phase (window box, field, globe, one pot) from `sceneInfo` with `data-testid="lm-scene"` and a caption from `captions.ts` `captionFor(info: GrowSceneInfo): string`.

- [ ] **Step 4: Run tests, score and e2e**

Run: `npm test -- --testPathPatterns=ever-onward && npm run score:ever-onward -- grow && npm run test:e2e -- e2e/ever-onward.spec.ts --project=chromium`
Expected: PASS except `narration manifest › grow/...`; the scorecard prints four phases and a finish for every bot (score itself not judged yet).

- [ ] **Step 5: Controller records narration**

Controller runs `npm run narration:ever-onward`; manifest test passes.

- [ ] **Step 6: Commit**

`git commit -m "feat(ever-onward): Make It Grow skeleton, four phases end to end (dev and e2e only)"`

---

### Task 4: Backyard mechanics: seeds, helpers, water and seasons (lib lane)

**Files:**

- Create: `grow/water.ts`, `grow/seasons.ts`
- Modify: `grow/tuning.ts`, `upgrades.ts`, `tick.ts`, `alerts.ts`, `hooks.ts`, `bots.ts`, `index.ts` (actions)
- Test: `grow/__tests__/water.test.ts`, `grow/__tests__/seasons.test.ts`, `grow/__tests__/yard.test.ts`

**Interfaces:**

- Produces (`water.ts`): `DRY_FLOOR = 0.5`; `waterCapacity(run): number`; `waterLevel(run): number` (0–1); `rainOutlook(run): number` (0 = dry spell, 1 = rainy; drifts like the oil price, own stream `wtRng`); `waterFactor(run): number` (1 when water > 0, else `DRY_FLOOR`); `tickWater(run, dt): void`; `isDry(run): boolean`; storage upgrade ids `rain-barrel`, `garden-hose` (yard; later tasks add `well`, `irrigation`, `river-bend`, `cloud-seeder`).
- Produces (`seasons.ts`): `type Season = "spring" | "summer" | "autumn" | "winter"`; `SEASONS`; `seasonOf(run): Season` (from yard phase time, `TUNING.seasons.seconds` each); `seasonSecondsLeft(run): number`; `seasonBoost(run, stream: "plant" | "grow" | "harvest"): number`.
- Produces: yard actions `yard-harvest` (collect ripe produce into seeds; ripe produce waits forever, never spoils; autumn pays more) and a basket helper that harvests at the base rate mid-phase.
- `growAlert(run)`: when `isDry(run)`, a kind line like "The garden is thirsty! Plants grow at half speed until it rains or you build more water storage."; null otherwise and when complete.
- `GROW_CONSUMABLES`: `{ id: "water", label: "Water", level: waterLevel (null in phases without water) }`. `growPlates` adds `"water"` when low or storage is affordable, `"harvest"` when ripe produce waits.
- Fixture helpers (`grow/__tests__/fixtures.ts`): `withWater(run, amount): RunState`, `inSeason(season): RunState` (a yard run at that season's start), `neverBuys(ids: readonly string[]): Strategy` (the tapper, skipping those upgrades).
- `growBots()`: `skill[0] = { naive, careful }` where `careful` buys storage when `rainOutlook` turns dry and `naive` buys storage only after running dry; both use `yard-harvest` (careful waits for autumn when within one season).

- [ ] **Step 1: Write the failing tests**

```ts
// water.test.ts
it("earns exactly half when dry", () => {
  const wet = withWater(runAtPhaseStart(0), 10),
    dry = withWater(runAtPhaseStart(0), 0);
  expect(incomePerSecond(dry)).toBeCloseTo(incomePerSecond(wet) * 0.5);
});
it("still pays a tap when dry", () =>
  expect(manualGain(def, withWater(runAtPhaseStart(0), 0))).toBeGreaterThan(0));
it("warns only while dry", () => {
  expect(growAlert(withWater(runAtPhaseStart(0), 0))).toMatch(/thirsty/i);
  expect(growAlert(withWater(runAtPhaseStart(0), 5))).toBeNull();
});
it("drifts rain on its own stream, leaving run.rng alone", () => {
  /* tick 600 s; run.rng unchanged by water */
});
it("never needs storage to finish (Review Focus 2)", () => {
  const r = simulate(def, {
    strategy: neverBuys(["rain-barrel", "garden-hose"]),
    maxSeconds: 4 * 3600,
  });
  expect(r.finished).toBe(true);
});
// seasons.test.ts
it("cycles spring, summer, autumn, winter on phase time", () => {
  /* seasonOf at 0, s, 2s, 3s, 4s */
});
it("never punishes: every boost is at least 1 and winter is exactly 1", () => {
  for (const season of SEASONS)
    for (const stream of ["plant", "grow", "harvest"] as const)
      expect(seasonBoost(inSeason(season), stream)).toBeGreaterThanOrEqual(1);
  for (const stream of ["plant", "grow", "harvest"] as const)
    expect(seasonBoost(inSeason("winter"), stream)).toBe(1);
});
it("rewards planning: a season-aware player clears the yard at least 3% sooner", () => {
  /* careful vs season-blind harvester */
});
it("survives a save round trip on the same season", () => {
  /* parseSave(JSON) -> seasonOf equal */
});
// yard.test.ts
it("hands over to helpers: eager tap share is under 12% from minute 6", () => {
  /* clickCurve(trace)[0].late < 0.12 */
});
it("opens hands-on: taps are over 60% of income at minutes 0.5-3", () => {
  /* clickCurve early >= 0.6 */
});
it("clears the yard in 20 to 45 minutes for the realistic bot", () => {
  /* phase span */
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- --testPathPatterns="universes/grow/__tests__/(water|seasons|yard)"`
Expected: FAIL on missing modules.

- [ ] **Step 3: Implement `water.ts`, `seasons.ts` and the yard upgrades, actions, tick, alert, hooks and bots**

Upgrades tag `kind` (mechanic/scale/filler) for the scorecard. Sprinklers, bees-as-helpers and gardener bots are the yard's helpers; a single small tap upgrade, never outpacing helpers (Round 4 lesson).

- [ ] **Step 4: Run tests and the yard rows of the scorecard**

Run: `npm test -- --testPathPatterns=universes/grow && npm run score:ever-onward -- grow`
Expected: PASS; yard has no failing gate in M1, M9, M11.

- [ ] **Step 5: Commit**

`git commit -m "feat(ever-onward): Make It Grow backyard, water and seasons"`

---

### Task 5: Bee dances side machine (lib lane)

**Files:**

- Create: `grow/bees.ts`, `components/ever-onward/game/grow/BeeDance.tsx`
- Modify: `grow/tuning.ts`, `upgrades.ts`, `tick.ts`, `hooks.ts`, `bots.ts`, `index.ts`, `components/ever-onward/universes/grow.tsx` (panels)
- Test: `grow/__tests__/bees.test.ts`, `components/ever-onward/game/grow/__tests__/BeeDance.test.tsx`

**Interfaces:**

- Produces (`bees.ts`): `BEES_OPEN_FLAG = "bees-open"`; `PATCHES` (3–4 named flower patches); `isBeesOpen(run)`; `danceHint(run): number` (the patch the dance points at, read from the dance's angle and length, shown, never a coin flip); `followActionId(patch: number): string` (`bees-follow-<n>`); `BEE_ACTION_IDS`; `BEE_KEEPER_ID = "bee-keeper"` (helper: follows the dance at a lower payout, appears after 2 dances); `tickBees(run, dt)`; `beeResultLine(run): string | null`; `withoutBees(run): RunState` (for `incomeView`). State: `beStage`, `beDances`, `bePending`, `beRng`.
- Plate `"bees"`, `GROW_PLATE_ACTIONS.bees = BEE_ACTION_IDS`. Bots: tapper/realistic follow the hinted patch; idle never; `claim[0]` = ignores / claims pair.
- Panel `BeeDance` (`PanelProps`): shows the dance, patch buttons, a staggered reveal and the kind result line; returns null unless open and not complete. Test id `lm-bees`.

- [ ] **Step 1: Write the failing tests**

```ts
it("opens on a milestone with a story-free flag, never on a timer", ...);
it("points honestly: following the dance pays the most of any patch", ...);
it("offers one decision every couple of minutes", () => { /* dance cycle >= 90 s */ });
it("lets the bee keeper add to hand play, never replace it", () => { /* hand + keeper > keeper alone, hand alone > keeper alone */ });
it("shows the bee keeper mid-life, after two dances", ...);
it("finishes a pollination in flight when the yard ends (Review Focus 3)", ...);
it("uses its own random stream", () => { /* run.rng unchanged by bees */ });
it("keeps result copy kind", () => { /* every beeResultLine variant !~ /lose|fail|wrong|bad/i */ });
// BeeDance.test.tsx
it("renders nothing until the bees arrive", ...);
it("follows a patch on click and calls onAct with bees-follow-<n>", ...);
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- --testPathPatterns="grow/__tests__/bees|BeeDance"`
Expected: FAIL on missing modules.

- [ ] **Step 3: Implement `bees.ts`, wire tick/hooks/bots/actions, build `BeeDance`, add it to `GROW_UI.panels`**

- [ ] **Step 4: Verify**

Run: `npm test -- --testPathPatterns=universes/grow && npm run score:ever-onward -- grow`
Expected: PASS; yard M15 busiest minute ≤ 6, M11 yard still passes.

- [ ] **Step 5: Commit**

`git commit -m "feat(ever-onward): Make It Grow bee dances"`

---

### Task 6: Backyard scene and story (UI lane)

**Files:**

- Create: `components/ever-onward/scenes/grow/YardLayer.tsx`, `scenes/grow/callouts.ts`, `components/ever-onward/game/grow/SeasonDial.tsx`
- Modify: `grow/scene.ts`, `grow/story/yard.ts`, `grow/visitors.ts`, `scenes/grow/GrowScene.tsx`, `scenes/grow/captions.ts`, `components/ever-onward/universes/grow.tsx` (SeasonDial panel)
- Test: `grow/__tests__/scene.test.ts`, `components/ever-onward/scenes/grow/__tests__/callouts.test.ts`, `grow/__tests__/story.test.ts`

**Interfaces:**

- Produces (`scenes/grow/callouts.ts`): `calloutFor(lastBuy: LastBuy, info: GrowSceneInfo): Callout | null`; `CAPTION_ONLY: ReadonlySet<string>` (upgrades whose landing is a caption change).
- `GrowSceneInfo` gains yard fields (quantized): `beds`, `bloom` (0–1), `waterFraction`, `season`, `sprinklers`, `bees`, `gardeners`, `isDry` (dry soil colour change in the scene).
- Story: 10–16 yard lines (joyful) including NEWS lines in the existing `NEWS:` format, plus 1–2 milestone visitors in `VISITORS` (phase `yard`, `arrivesWhen` a milestone, small gift) with their same-id story lines.
- `SeasonDial` panel: the current season, what it boosts, time to the next one; test id `lm-season`.

- [ ] **Step 1: Write the failing tests**

```ts
// scene.test.ts
it("returns finite, 0-1 fractions through the yard", ...);           // the Light scene.test pattern
it("is quantized: one 0.1 s tick in steady play leaves sceneInfo equal", ...);
it("shows dry soil when the barrel is empty", () => expect(sceneInfo(dryRun).isDry).toBe(true));
// callouts.test.ts
it("lands every yard upgrade visibly", () => {
  for (const u of def.upgrades.filter((u) => u.phases?.includes("yard")))
    expect(calloutFor({ id: 1, upgradeId: u.id, n: 1 }, sceneInfo(runAtPhaseStart(0))) !== null || CAPTION_ONLY.has(u.id)).toBe(true);
});
// story.test.ts
it("reaches every yard line in a realistic run", () => { /* all yard ids in finalRun.story */ });
it("has unique ids and every visitor has its line", ...);
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- --testPathPatterns="grow/__tests__/(scene|story)|scenes/grow"`
Expected: FAIL.

- [ ] **Step 3: Draw `YardLayer` (window box opening out into the backyard, CRT palette), callouts and caption; write the yard story, visitors and `SeasonDial`**

- [ ] **Step 4: Verify tests and look at it**

Run: `npm test -- --testPathPatterns=ever-onward`, then `npm run dev` and screenshot `/ever-onward` at 390×844 and iPad landscape (controller check-in with Gentry per the asset-loop memory).
Expected: PASS except `narration manifest › grow/...`.

- [ ] **Step 5: Controller records narration; commit**

`git commit -m "feat(ever-onward): Make It Grow backyard scene and story"`

---

### Task 7: Farm mechanics: harvest, the market, wells and irrigation (lib lane)

**Files:**

- Create: `grow/market.ts`
- Modify: `grow/tuning.ts`, `upgrades.ts`, `tick.ts`, `water.ts` (well, irrigation), `alerts.ts`, `hooks.ts`, `bots.ts`, `index.ts`
- Test: `grow/__tests__/market.test.ts`, `grow/__tests__/farm.test.ts`

**Interfaces:**

- Produces (`market.ts`): `CROPS = ["tomato", "corn", "pumpkin"] as const`, `type Crop`; `demandOf(run, crop): number` (towns' asks drift on their own stream `mkRng`, shown as orders); `plantedCrop(run): Crop`; `cropPrice(run, crop): number`; `plantActionId(crop): string` (`market-plant-<crop>`); `bestCrop(run): Crop`.
- Seeds convert to harvest at the phase change (like coins → power). Helpers: tractors, greenhouses, seed drones; a market agent upgrade mid-phase that re-plants to demand at a lower rate than a player choosing well.
- Bots: `cropPolicy` (plants `bestCrop` when it beats the current crop by ≥ 15%) used by tapper, realistic and dawdler; `skill[1]` water pair (wells/irrigation storage policy).

- [ ] **Step 1: Write the failing tests**

```ts
it("pays at least 1.3x more for the crop in demand than the least wanted", ...);
it("moves demand so no crop is always best over a 30-minute farm", () => { /* bestCrop changes >= 3 times */ });
it("rewards choosing: the crop-policy bot clears the farm at least 8% sooner than always-corn", ...);
it("keeps the market agent below a player choosing well", ...);
it("still earns half when dry, and a tap always pays harvest", ...);
it("hands over by minute 6 and opens hands-on (M11 rows for farm)", ...);
it("clears the farm in 25 to 50 minutes for the realistic bot", ...);
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- --testPathPatterns="grow/__tests__/(market|farm)"`
Expected: FAIL.

- [ ] **Step 3: Implement the market, farm helpers, water storage and bots**

- [ ] **Step 4: Verify**

Run: `npm test -- --testPathPatterns=universes/grow && npm run score:ever-onward -- grow`
Expected: PASS; farm has no failing gate; M2/M4 farm rows show crop decisions.

- [ ] **Step 5: Commit**

`git commit -m "feat(ever-onward): Make It Grow farms and the market"`

---

### Task 8: County fair side machine (lib lane)

**Files:**

- Create: `grow/fair.ts`, `components/ever-onward/game/grow/CountyFair.tsx`
- Modify: `grow/tuning.ts`, `upgrades.ts`, `tick.ts`, `hooks.ts`, `bots.ts`, `index.ts`, `components/ever-onward/universes/grow.tsx`
- Test: `grow/__tests__/fair.test.ts`, `components/ever-onward/game/grow/__tests__/CountyFair.test.tsx`

**Interfaces:**

- Produces (`fair.ts`): `FAIR_OPEN_FLAG = "fair-open"`; `isFairOpen(run)`; `pumpkinsOnOffer(run): readonly { size: number; shine: number }[]`; `placeChances(run, pick): readonly number[]` (honest odds, shown before entering); `enterActionId(pick: number): string` (`fair-enter-<n>`); `FAIR_ACTION_IDS`; `FAIR_HAND_ID = "fair-hand"` (helper that enters the likeliest pumpkin, from the second fair); `tickFair(run, dt)`; `fairResultLine(run)`; `withoutFair(run)`. State `frStage`, `frFairs`, `frPending`, `frRng`.
- Every placing pays something (no loss); a better pick pays more on average. Bots enter the pumpkin with the best expected payout; `claim[1]` pair.
- Panel `CountyFair`, test id `lm-fair`.

- [ ] **Step 1: Write the failing tests**

Same rule set as Task 5 (opens on a milestone; honest odds: the shown chances match 2,000 seeded draws within 3 points; no placing pays zero; decision every couple of minutes; helper adds, never replaces; helper appears mid-life; in-flight judging pays after the farm ends; own stream; kind copy), plus panel render and `onAct("fair-enter-<n>")` tests.

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- --testPathPatterns="grow/__tests__/fair|CountyFair"`
Expected: FAIL.

- [ ] **Step 3: Implement `fair.ts`, wiring and `CountyFair`**

- [ ] **Step 4: Verify**

Run: `npm test -- --testPathPatterns=universes/grow && npm run score:ever-onward -- grow`
Expected: PASS; farm M15 within band.

- [ ] **Step 5: Commit**

`git commit -m "feat(ever-onward): Make It Grow county fair"`

---

### Task 9: Farm scene and story (UI lane)

**Files:**

- Create: `components/ever-onward/scenes/grow/FarmLayer.tsx`
- Modify: `grow/scene.ts`, `grow/story/farm.ts`, `grow/visitors.ts`, `scenes/grow/GrowScene.tsx`, `callouts.ts`, `captions.ts`
- Test: extend `grow/__tests__/scene.test.ts`, `scenes/grow/__tests__/callouts.test.ts`, `grow/__tests__/story.test.ts`

**Interfaces:**

- `GrowSceneInfo` gains farm fields (quantized): `fields`, `crop`, `tractors`, `greenhouses`, `townFed` (0–1), `wells`, `isDry`.
- Story: 10–16 farm lines (the robot is a hero; NEWS lines cheerful), 1–2 farm visitors.

- [ ] **Step 1: Write the failing tests** — the Task 6 tests for the `farm` phase (finite fractions, quantized, every farm upgrade lands, every farm line reached, visitors have lines), plus `it("shows the planted crop in the fields", ...)`.
- [ ] **Step 2: Run them to verify they fail** — `npm test -- --testPathPatterns="grow/__tests__/(scene|story)|scenes/grow"`; FAIL.
- [ ] **Step 3: Draw `FarmLayer` (fields and a town), callouts, caption; write farm story and visitors.**
- [ ] **Step 4: Verify** — `npm test -- --testPathPatterns=ever-onward` PASS except new manifest entries; screenshots at phone and iPad widths.
- [ ] **Step 5: Controller records narration; commit** — `feat(ever-onward): Make It Grow farm scene and story`.

---

### Task 10: Green World mechanics: green, biomes, rivers and clouds (lib lane)

**Files:**

- Create: `grow/biomes.ts`
- Modify: `grow/tuning.ts`, `upgrades.ts`, `tick.ts`, `water.ts` (river-bend, cloud-seeder), `alerts.ts`, `hooks.ts`, `bots.ts`, `index.ts`
- Test: `grow/__tests__/biomes.test.ts`, `grow/__tests__/world.test.ts`

**Interfaces:**

- Produces (`biomes.ts`): `BIOMES = ["forest", "jungle", "meadow", "wetland"] as const`, `type Biome`; `biomeShare(run, biome): number` (0–1 of the planet); `spreadActionId(biome): string` (`world-spread-<biome>`); `biomePerk(run, biome): number`; `bestBiome(run): Biome`. Perks differ in kind: forest steady green; jungle fastest but thirstiest; meadow feeds pollinators (more seeds for migration); wetland stores water.
- Harvest converts to green at the phase change. Helpers: seed drones, planting rovers, the planet's weather.
- Bots: `biomePolicy` picks `bestBiome`; `skill[2]` water pair.

- [ ] **Step 1: Write the failing tests**

```ts
it("gives each biome a different perk", ...);
it("makes every biome the best pick somewhere: each is bestBiome for some reachable state", ...);
it("rewards choosing: the biome-policy bot clears the world at least 8% sooner than forest-only", ...);
it("still earns half when dry, and a tap always pays green", ...);
it("hands over by minute 6 and opens hands-on (M11 rows for world)", ...);
it("clears the world in 25 to 50 minutes for the realistic bot", ...);
```

- [ ] **Step 2–5:** run (FAIL), implement, verify (`npm run score:ever-onward -- grow`, world has no failing gate), commit `feat(ever-onward): Make It Grow green world and biomes`.

---

### Task 11: Seed migration side machine (lib lane)

**Files:**

- Create: `grow/migration.ts`, `components/ever-onward/game/grow/SeedMigration.tsx`
- Modify: `grow/tuning.ts`, `upgrades.ts`, `tick.ts`, `hooks.ts`, `bots.ts`, `index.ts`, `components/ever-onward/universes/grow.tsx`
- Test: `grow/__tests__/migration.test.ts`, `components/ever-onward/game/grow/__tests__/SeedMigration.test.tsx`

**Interfaces:**

- Produces (`migration.ts`): `MIGRATION_OPEN_FLAG = "migration-open"`; `REGIONS` (4–5 named regions); `isMigrationOpen(run)`; `regionWelcome(run, region): number` (what a flock would grow there, shown; meadow share raises it); `sendActionId(region: number): string` (`migration-send-<n>`); `MIGRATION_ACTION_IDS`; `FLOCK_LEADER_ID = "flock-leader"` (helper, after two flights); `tickMigration(run, dt)`; `migrationResultLine(run)`; `withoutMigration(run)`. State `mgStage`, `mgFlights`, `mgPending`, `mgRng`.
- Panel `SeedMigration` (a small map; staggered spread reveal), test id `lm-migration`. Bots send to the most welcoming region; `claim[2]` pair.

- [ ] **Step 1: Write the failing tests** — the Task 5 rule set for migration (milestone open, honest welcome, decision cadence, helper adds and appears mid-life, in-flight flock lands after the world ends, own stream, kind copy) plus panel tests.
- [ ] **Step 2–5:** run (FAIL), implement, verify (world M15 in band), commit `feat(ever-onward): Make It Grow seed migration`.

---

### Task 12: Green World scene and story, the darker turn (UI lane)

**Files:**

- Create: `components/ever-onward/scenes/grow/WorldLayer.tsx`
- Modify: `grow/scene.ts`, `grow/story/world.ts`, `grow/visitors.ts`, `scenes/grow/GrowScene.tsx`, `callouts.ts`, `captions.ts`
- Test: extend `scene.test.ts`, `callouts.test.ts`, `story.test.ts`, `guardrails.test.ts`

**Interfaces:**

- `GrowSceneInfo` gains world fields (quantized): `greenFraction` (0–1 of the globe), per-biome shares, `rivers`, `clouds`, `flocks`, `roadsLeft` and `townsLeft` (0–1, drawn only: roads become meadows, towns become forests; never shown as numbers or labels).
- Story: 12–18 world lines. The turn is told only here and in NEWS lines: cheerful headlines that darken subtly ("The mayor has relocated the town hall. Again."), the robot calling it success. Never scary, nobody hurt; people _move_.

- [ ] **Step 1: Write the failing tests** — the Task 6 tests for `world`, plus:
  ```ts
  it("turns the globe green as green grows", () => expect(sceneInfo(late).greenFraction).toBeGreaterThan(sceneInfo(early).greenFraction));
  it("tells the move-out only in story lines, never in a resource, countdown or caption", ...);
  it("keeps NEWS lines in the NEWS: format and gentle", ...);
  ```
- [ ] **Step 2–5:** run (FAIL), draw the globe pull-back and the quiet roads, write the story, verify with screenshots, controller narration, commit `feat(ever-onward): Make It Grow green world scene and story`.

---

### Task 13: The Last Seed: tending one pot, the old window box, Acorns (lib lane)

**Files:**

- Create: `grow/windowbox.ts`, `components/ever-onward/game/grow/WindowBox.tsx`
- Modify: `grow/tuning.ts`, `upgrades.ts`, `tick.ts`, `water.ts` (one small can), `alerts.ts`, `hooks.ts`, `bots.ts`, `prestige.ts`, `index.ts`, `components/ever-onward/universes/grow.tsx`
- Test: `grow/__tests__/seed.test.ts`, `grow/__tests__/prestige.test.ts`, `components/ever-onward/game/grow/__tests__/WindowBox.test.tsx`

**Interfaces:**

- Produces (`windowbox.ts`): `potGrowth(run): number` (0–1); `potStage(run): "soil" | "sprout" | "bud" | "bloom"`; `isSeedBloomed(run): boolean`; `WINDOWBOX_ACTION_IDS` (small tending choices, e.g. turn the pot to the sun, sing to it, water from the can; decisions, not taps); `tickWindowBox(run, dt)`; `windowBoxLine(run)`. The old window box side machine merges into this panel.
- Shop stays: a few small `care`-priced upgrades. `RETURN_VISITOR_ID` arrives when `isSeedBloomed(run)` (a milestone, never a timer); the run completes on arrival (idle bots need no greeting).
- `PRESTIGE` (Acorns): `completionEmbers`, `phaseEmbers`, and 4–6 upgrades shaping a fresh run (a head start per phase, a bigger first barrel); builder sets numbers.

- [ ] **Step 1: Write the failing tests**

```ts
it("grows the pot by tending, and a tap always earns care", ...);
it("blooms, then the visitor comes back, then the run is complete", ...);
it("never completes on a timer: an untended pot still blooms, only later", ...);
it("keeps the shop: the last phase offers care upgrades", ...);
it("lasts 12 to 30 minutes for the realistic bot", ...);
it("makes run 2 at least 25% quicker with typical Acorns", () => { /* scoreUniverse run2/run1 <= 0.75 */ });
// WindowBox.test.tsx
it("shows the pot's stage and calls onAct for a tending choice", ...);
```

- [ ] **Step 2–5:** run (FAIL), implement, verify (`npm run score:ever-onward -- grow`: seed has no failing gate, M13 in band), commit `feat(ever-onward): Make It Grow last seed and acorns`.

---

### Task 14: Last Seed scene, story and the ending (UI lane)

**Files:**

- Create: `components/ever-onward/scenes/grow/SeedLayer.tsx`, `components/ever-onward/game/grow/GrowEndingArt.tsx`, `components/ever-onward/game/grow/AcornIcon.tsx`
- Modify: `grow/scene.ts`, `grow/story/seed.ts`, `grow/visitors.ts`, `scenes/grow/GrowScene.tsx`, `callouts.ts`, `captions.ts`, `components/ever-onward/universes/grow.tsx` (`ending.Art`, `PrestigeIcon: AcornIcon`, `hubSprite`), `lib/ever-onward/start/sprites.ts` (`SEEDLING_ROWS`, `SEEDLING_LIT`, `SEEDLING_DIM`)
- Test: extend `scene.test.ts`, `callouts.test.ts`, `story.test.ts`; `components/ever-onward/game/__tests__/GrowEnding.test.tsx`

**Interfaces:**

- `GrowSceneInfo` gains seed fields: `potStage`, `isNight`, `windowLit`, `visitorHere`.
- `GROW_UI.ending = { storyIds: ENDING_STORY_IDS, Art: GrowEndingArt }`: one window at night, the grown-up kid with their own child, tender and hopeful.
- Story: 8–12 quiet lines (the world green and silent; the empty window box; planting again "in case they come back"), and the three ending lines.

- [ ] **Step 1: Write the failing tests**

The Task 6 tests for `seed`, plus `GrowEnding.test.tsx`:

```ts
it("shows the someone-comes-back art and the three ending lines in order", ...);
it("says Acorns on the finished panel and offers a restart (Review Focus 5)", ...);
it("does not show the ending again when a finished save is reopened (Review Focus 5)", ...);
it("lists the ending lines in the Story drawer after reload", ...);
```

`callouts.test.ts`: every Grow upgrade in every phase lands visibly (the full sweep).

- [ ] **Step 2–5:** run (FAIL), draw and write, verify with screenshots, controller narration, commit `feat(ever-onward): Make It Grow last seed scene and ending`.

---

### Task 15: Make It Grow sound (UI lane)

**Files:**

- Create: `components/ever-onward/audio/growScores.ts`
- Modify: `components/ever-onward/universes/grow.tsx` (`audio`), `audio/everOnwardSynth.ts` (new cue names), `audio/voices.ts` (their voices)
- Test: `components/ever-onward/audio/__tests__/growScores.test.ts`, extend `audio/__tests__/everOnwardSynth.test.tsx`

**Interfaces:**

- Produces: `YARD_SCORE`, `FARM_SCORE`, `WORLD_SCORE`, `SEED_SCORE`, `GROW_TITLE_SCORE: MusicSpec`; `GROW_SCORES`, `GROW_UNEASE` (none in the yard; faint from the farm; the world's unease the strongest, never scary; the seed sparse and warm); `areGrowScoresValid(): boolean`.
- New `CueName`s: `"buzz"` (bees follow), `"ribbon"` (fair placing), `"flutter"` (flock lands), `"bloom"` (pot stage up). `GROW_UI.audio.cuesBetween` fires them from `beDances`, `frFairs`, `mgFlights` and `potStage` changes. `GROW_UI.audio.titleScore = GROW_TITLE_SCORE` (used by the hub in Task 17).

- [ ] **Step 1: Write the failing tests**

```ts
it("has four valid phase scores and a valid title theme", () => expect(areGrowScoresValid()).toBe(true));
it("is its own music, not Light's", () => expect(GROW_SCORES.map((s) => s.id)).not.toContain("eo-coast"));
it("switches to Grow's score when a Grow phase is set", ...);   // synth.setPhase(0, GROW_UI.audio)
it("cues buzz when a dance is followed and bloom when the pot grows", ...);
```

- [ ] **Step 2–5:** run (FAIL), compose specs and cue voices, verify (`npm test -- --testPathPatterns=audio`), listen in dev, commit `feat(ever-onward): Make It Grow music and sounds`.

---

### Task 16: Scorecard tuning loop and the regression floor

**Files:**

- Create: `lib/ever-onward/universes/grow/__tests__/scorecard.test.ts`
- Modify: `grow/tuning.ts`, `upgrades.ts` (numbers and gating only), `grow/bots.ts` if an instrument is wrong, `docs/ever-onward/lab-notebook.md` (new section "Universe 2: Make It Grow")

**Interfaces:**

- Consumes: `scoreUniverse(growUniverse, { bots: growBots() })`, `clickCurve`, the `fun-loop` skill.
- Produces: `SCORE_FLOOR` and `UNCAPPED_FLOOR` for Grow (launch score − 1).

- [ ] **Step 1: Write the failing floor test**

```ts
const SCORE_FLOOR = 0; // raised in step 4
it("has no failing gate", () => expect(card.failingGates).toEqual([]));
it("scores at least the floor", () => { expect(card.total).toBeGreaterThanOrEqual(SCORE_FLOOR); expect(card.uncapped).toBeGreaterThanOrEqual(UNCAPPED_FLOOR); });
it("takes 2 to 3 hours for the realistic bot", () => { expect(card.runs.realisticFinish! / 3600).toBeGreaterThanOrEqual(2); expect(card.runs.realisticFinish! / 3600).toBeLessThanOrEqual(3); });
it("lets the idle bot finish within 4 hours, never before the eager bot", ...);
it("keeps phase lengths near 30/35/35/20 minutes (each within 30%)", ...);
```

- [ ] **Step 2: Run the baseline and record Round 0 in the lab notebook**

Run: `npm run score:ever-onward -- grow` and the floor test.
Expected: the gate/length tests likely FAIL; write the Round 0 table (per metric, per phase, click curves, finish times) under the new section.

- [ ] **Step 3: Tune in rounds (fun-loop method)**

One focused change per round; score before and after; an Opus reviewer retro per round; keep or revert; stop when no gate fails and the targets hold. Story text must not change here (or the controller re-records). Check in with Gentry with a screenshot at each round per the asset-loop memory.

- [ ] **Step 4: Set the floor and verify**

Set `SCORE_FLOOR`/`UNCAPPED_FLOOR` to the final score − 1. Run: `npm test -- --testPathPatterns=universes && npm run score:ever-onward | grep -v '^Runtime' | diff - <(grep -v '^Runtime' /tmp/eo-light-before.txt)`
Expected: PASS; Light unchanged.

- [ ] **Step 5: Commit** — `tune(ever-onward): Make It Grow scorecard rounds, floor <n>`.

---

### Task 17: Launch: unlock after the Lighthouse, hub card, home copy, release

**Files:**

- Modify: `lib/ever-onward/engine/types.ts` (`UniverseDef.requires`), `engine/progress.ts`, `lib/ever-onward/universes/grow/index.ts`, `universes/staging.ts` (`UNRELEASED_IDS = []`), `components/ever-onward/Hub.tsx`, `components/ever-onward/EverOnward.tsx`, `components/ever-onward/game/useGame.ts` (`open` refuses a locked universe), `components/ever-onward/universes/light.tsx` (`ending.afterword`), `components/ever-onward/game/EndingOverlay.tsx` (`afterword` prop), `components/ever-onward/audio/useTitleMusic.ts` (`spec` argument), `components/designs/design1/Hobbies.tsx`, `components/designs/design1/commandResponses.tsx`, `lib/ever-onward/version.ts`, `lib/ever-onward/changelog.ts`, `e2e/ever-onward.spec.ts`
- Test: `lib/ever-onward/engine/__tests__/progress.test.ts`, `components/ever-onward/__tests__/Hub.test.tsx`, `components/designs/design1/__tests__/commandResponses.test.tsx`, `lib/ever-onward/__tests__/changelog.test.ts` (existing)

**Interfaces:**

- Produces: `UniverseDef.requires?: { universeId: string; hint: string }`; Grow sets `{ universeId: "light", hint: "Opens when you finish Keep the Light On." }`. `isUniverseUnlocked(def: UniverseDef, save: SaveData): boolean` (true without `requires`; else `save.universes[requires.universeId]?.completions > 0`).
- Hub: a playable-but-locked universe shows a locked card with the hint (test id `lm-locked-grow`, no play button); once unlocked, the Grow card with `lm-play-grow` and the seedling sprite. The hub plays `GROW_TITLE_SCORE` while Grow is unlocked and not yet finished, else `TITLE_SCORE` (`hubTitleScore(save): MusicSpec` in `components/ever-onward/universes/index.ts`).
- Light's `ending.afterword(save)` returns "A new universe has opened: Make It Grow." (shown under the ending lines, not narrated, so no Light clip changes).
- Release: one Ever Onward minor (`1.14.0` if nothing else shipped first), changelog entry in plain words for a young player or their parent.

- [ ] **Step 1: Write the failing tests**

```ts
// progress.test.ts (Review Focus 4)
it("unlocks Grow once Light has been finished", ...);            // completions: 1 -> true
it("keeps Grow locked for a Light run in progress", ...);         // completions: 0, phase 2 -> false
it("never re-locks after a Light restart", ...);                  // endRun(light) keeps completions > 0
it("unlocks for an old Light save with completions and no other fields", ...);
// Hub.test.tsx
it("shows Grow locked with its hint before the Lighthouse is finished", ...);
it("shows the Grow play button after it", ...);
it("never lists Grow as coming soon in production", () => expect(lockedUniverses(false).map((l) => l.id)).not.toContain("grow"));
// commandResponses.test.tsx
it("mentions the garden robot in the onward output", ...);
```

e2e: "Make It Grow is locked until the Lighthouse is finished" (fresh save: `lm-locked-grow` visible with the hint); "a finished Lighthouse unlocks Make It Grow" (seed `localStorage["ever-onward:save"]` with Light `completions: 1` via `page.addInitScript`; `lm-play-grow` visible; play; tap earns seeds).

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- --testPathPatterns="progress|Hub|commandResponses"`
Expected: FAIL.

- [ ] **Step 3: Implement the gate, the hub card and hint, the Light afterword, the hub theme, home-site copy (Hobbies and `onward` command: a lighthouse robot and now a garden robot), version bump and changelog**

- [ ] **Step 4: Full verification (ship time)**

Run: `npm run validate && npm run test:e2e -- e2e/ever-onward.spec.ts && npm run score:ever-onward && npm run score:ever-onward -- grow`
Expected: all PASS; Light's scorecard identical to the baseline; Grow at or above its floor with no failing gate.

- [ ] **Step 5: Commit**

`git commit -m "feat(ever-onward): Make It Grow opens after the Lighthouse (1.14.0)"`

---

## Self-review

- **Spec coverage.** Story arc and phase lengths: T3–T14, T16. Core loop and hands-on-then-helpers: T4, T7, T10, T13, gated in T16. Water (free, weather-driven, built storage, 50% floor, alert, scene change): T4, T6, T7, T10, T13. Seasons: T4, T6. Market: T7. Biomes: T10. Last Seed tending and shop: T13. Side machines and their rules: T5, T8, T11, T13. HUD: existing, unchanged. Phase intros with Listen: T3 (intros) plus narration steps. Story ticker, drawer, NEWS, Jim's voice: T3, T6, T9, T12, T14 plus controller steps. Living scene, callouts, captions, quantized `sceneInfo`: T3, T6, T9, T12, T14. Sound and title theme: T15, T17. Guardrails: T3. Registry: T1. Per-universe scorecard and own floor and notebook section: T2, T16. Prestige "Acorns" on `embers`: T1, T3, T13. Saves untouched: T2, T3. Staged release, dev and e2e only: T2, T3, T17. Unlock and hint and the Light ending pointing to it: T17. Home-site copy and changelog: T17. Out of scope per the spec: a Make It Grow start-screen variant, cross-universe bonuses, universes 3–4.
- **Interpretations to confirm with Gentry:** "a title theme for the hub card" is read as the hub playing `GROW_TITLE_SCORE` while Grow is unlocked and unfinished (T17). The Light ending "points to" Grow with an un-narrated afterword line rather than a new story line, so no Light narration changes.
- **Type consistency.** Names checked across tasks: `uiFor`, `UniverseUi.panels`, `LastBuy`, `prestigeLabel`, `playableUniverses`, `lockedUniverses`, `SCORED_UNIVERSES`, `parseScoreArgs`, `growUniverse`, `growBots`, `GrowSceneInfo`, `sceneInfo`, `RETURN_VISITOR_ID`, `ENDING_STORY_IDS`, `DRY_FLOOR`, `waterFactor`, `seasonBoost`, `bestCrop`, `bestBiome`, `isSeedBloomed`, `isUniverseUnlocked`, `hubTitleScore`.
- **Proportion.** The spec is 174 lines; this plan carries signatures, test names and assertions, no bodies.
