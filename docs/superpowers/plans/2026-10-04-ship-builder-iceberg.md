# Ship Builder v2.6 "Iceberg!" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kids add watertight bulkheads below deck, aim an iceberg at the
hull, and watch the compartments flood until she settles or sinks bow-first.

**Architecture:** Spec:
`docs/superpowers/specs/2026-10-04-ship-builder-iceberg-design.md`. The
contract is already committed (`1a0e008`): `Bulkhead` on `Hull`,
`model/bulkheads.ts` (`cycleBulkhead`, `cleanBulkheads`, `bulkheadAt`),
`sim/compartments.ts` (`compartmentSpecsOf`, `gashOf`, `openedBy`,
`BULKHEAD_FRACTION`, `GASH_LENGTH`), `sim/story.ts` (`storyMinutes`,
`formatStoryTime`, `STORY_MINUTES_PER_SIM_SECOND`), the new sim types
(`IcebergInput`, `CompartmentSpec`, `Compartment.opened`, outcomes `afloat`
/ `sank`, reasons `held` / `spilled` / `no-bulkheads` / `too-many-opened`,
events `flooding` / `spilled`), and store actions `cycleBulkhead(at)` and
`startTrial(sea, impactX?)`. Tasks 1–3 build against that contract in
parallel worktrees; Task 4 integrates.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, zustand,
react-three-fiber, zod, Jest + RTL, Playwright.

**Conventions (all tasks):** read `CLAUDE.md`. `export default function`
components, `interface` props, Tailwind only with light and dark variants,
Prettier, conventional commits ending with the `Claude-Session:` line. Kid
tone: plain words, never about people aboard. Do not bump the version (Task
4 does).

**Worktree setup (Tasks 1–3):** first `git reset --hard ship-builder-iceberg`
and confirm `git log --oneline -1` shows the contract commit or later.
Symlink `node_modules` from the main checkout if missing. Use
`npx next build --webpack` / `npx next dev --webpack`. Playwright locally:
`--project=chromium --project=webkit --project=ipad` (Firefox can't launch
locally; CI covers it).

---

### Task 1: Bulkhead persistence, Below deck editor, stats row

**Goal:** Bulkheads save, load, share and can be edited by tapping walls in a
cut-away diagram.

**Files:**

- Modify: `lib/ship-builder/persist/schema.ts` (hull schema + `repairShip`)
- Modify/Create: `lib/ship-builder/persist/__tests__/*`,
  `lib/ship-builder/persist/__fixtures__/` (a v6 ship with bulkheads; follow
  the fixtures README)
- Create: `components/ship-builder/ui/BelowDeckDiagram.tsx`
- Create: `components/ship-builder/ui/BelowDeck.tsx` (Hull panel section)
- Modify: `components/ship-builder/ui/CatalogPanel.tsx` (render `BelowDeck`
  after `HullSizeControls`)
- Modify: `lib/ship-builder/model/stats.ts` + `StatsPanel.tsx` (row)
- Tests: `components/ship-builder/ui/__tests__/BelowDeck*.test.tsx`

**Acceptance Criteria:**

- [ ] Schema: `bulkheads: z.array(z.object({ at: z.number().int(), height:
z.enum(BULKHEAD_HEIGHTS) })).max(MAX_SEGMENTS).optional()` on the hull.
      `repairShip` runs `cleanBulkheads` so out-of-range / duplicate walls are
      dropped, not rejected. Ship version stays 6.
- [ ] Round-trips through local save and share links (test both).
- [ ] `BelowDeckDiagram` props (exactly; Task 3 reuses it read-only):
  ```ts
  interface BelowDeckDiagramProps {
    hull: Hull;
    /** Water per compartment id (0..1), for the trial inset. */
    water?: Record<string, number>;
    /** Opened compartment ids, drawn with a gash mark. */
    opened?: readonly string[];
    /** Given: wall slots are buttons that call this with the boundary. */
    onCycle?: (at: number) => void;
    className?: string;
  }
  ```
  SVG, bow on the left, viewBox scales to `lengthSegments`; hull outline,
  main deck line on top, dashed waterline at 0.6 depth, walls drawn to their
  `BULKHEAD_FRACTION` height, empty slots as faint dashed lines. Uses
  `compartmentSpecsOf` for water fills (blue, both themes). Hit targets at
  least 44 px tall via transparent rects. Accessible: when editable, each
  slot is a `<button>`-equivalent (`role="button"`, `tabIndex=0`, Enter /
  Space) with label `Wall {at}: none|low|up to the waterline|up to the deck.
Tap to change.`; read-only it is `role="img"` with a summary label.
- [ ] `BelowDeck` section: heading "Below deck", one-line help ("Tap a wall
      to add it or make it taller. Walls keep water out if the hull is
      holed."), the diagram wired to `cycleBulkhead`, disabled during a trial.
- [ ] Stats: `watertightCompartments = (hull.bulkheads?.length ?? 0) + 1`;
      Stats panel row "Watertight compartments" in the Ship group.
- [ ] `npm test`, `npm run type-check`, `npm run lint` pass.

**Verify:** `npx jest lib/ship-builder/persist components/ship-builder/ui` →
all pass.

**Steps:** TDD each criterion (failing test → implement → pass), one commit
for persistence, one for the diagram + section, one for the stats row.

---

### Task 2: Flooding engine, iceberg summaries, template bulkheads

**Goal:** `runTrial` / `stepTrial` play an iceberg trial deterministically to
`afloat` or `sank`, with kid-friendly result text and tuned templates.

**Files:**

- Create: `lib/ship-builder/sim/flooding.ts` (`stepFlooding`, constants)
- Modify: `lib/ship-builder/sim/seaTrial.ts` (`createTrial` fills
  `compartments` from `input.iceberg` with `opened` from `openedBy`; run
  `stepFlooding` before the phase step when `input.iceberg` is set; new
  bow-first sinking entry; iceberg end conditions)
- Modify: `lib/ship-builder/sim/explain.ts` (replace the placeholder `afloat`
  / `sank` cases)
- Modify: `lib/ship-builder/sim/README.md` (Level 2 section: model, table)
- Modify: `lib/ship-builder/templates/liner.ts` and the other templates
  (bulkheads)
- Tests: `lib/ship-builder/sim/__tests__/flooding.test.ts`,
  `explain.test.ts`, `lib/ship-builder/templates/__tests__/*`

**Model (tune the constants; keep the shape):**

- Each compartment: `water` 0..1 of hull depth. Opened compartments gain
  `INFLOW` per second (scaled down as water nears the outside sea level,
  which rises with `sink`, so a contained compartment settles).
- Trim: `pitch = -PITCH_GAIN * Σ(water_i × len_i × (mid − centre_i)) / L²`
  (bow down negative). `sink = SINK_GAIN * Σ(water_i × len_i) / L`.
- A wall's effective height = its fraction minus the trim drop at its x
  (bow-down lowers walls toward the bow) minus `sink` in depth units. Water
  above it in the forward compartment spills aft (and forward if the aft
  side is higher) at `SPILL_RATE`, emitting one `spilled` event the first
  time any wall overflows.
- `flooding` event at the first inflow. Flooded fraction
  `Σ(water_i × len_i) / L` past `RESERVE` → phase `sinking` via a bow-first
  plunge (pitch to about −0.35 rad, sink to `SINK_DEPTH`), outcome `sank`,
  then `sunk`. Inflow and spill both under `SETTLED_EPS` for 1 s while below
  `RESERVE` → `done`, outcome `afloat`. Hard cap: 90 s sim time → `afloat`
  if still under `RESERVE`.
- Wave roll keeps running (`stepSailing`) but its 9 s `done` timeout must not
  end an iceberg trial; a wave capsize still wins (outcome `capsized`).
- Reason: `no-bulkheads` (no walls), `too-many-opened` (sank without any
  `spilled` event), `spilled` (sank after a spill), `held` (afloat).
- Pose limits: afloat settles with `sink <= 1.5` and `|pitch| <= 0.12`.

**Acceptance Criteria (each a test):**

- [ ] No bulkheads, any impact → `sank`, reason `no-bulkheads`.
- [ ] 10-segment hull, deck-high walls at every boundary, impact x=9 (opens 2)
      → `afloat`, reason `held`.
- [ ] Same with every wall `low` → `sank`, reason `spilled`, has `spilled`.
- [ ] Titanic template, impact x=5 (starboard bow) → `sank` with
      `storyMinutes(time of sunk) ` within 160 ± 10. Tune
      `STORY_MINUTES_PER_SIM_SECOND` in `sim/story.ts` (sim should take 25–45 s).
- [ ] Britannic template, same impact → `afloat` (raised walls).
- [ ] Olympic (same layout as Titanic) → `sank`.
- [ ] Every other template has bulkheads and, struck at its middle, stays
      `afloat` in calm seas.
- [ ] Deterministic: two runs deep-equal. A waves trial (no `iceberg`)
      behaves exactly as before (existing tests untouched and passing).
- [ ] `explainTrial` text, following the existing tone:
  - afloat: title "She stayed afloat!", message "The walls kept the water in
    {n} compartment(s)." tips [].
  - sank: title "She sank", message starts "She stayed afloat for
    {formatStoryTime(...)}." then by reason: spilled → "Water spilled over
    the low walls near the bow." tips ["Make the walls near the bow taller.",
    "Add more walls so each compartment is smaller."]; no-bulkheads → "She
    had no walls below deck, so the water filled her." tips ["Add walls in
    Below deck, in the Hull panel."]; too-many-opened → "The iceberg opened
    {n} compartments at once." tips ["Add more walls so each compartment is
    smaller."].
  - `explainTrial` needs the trial input for counts: change its signature to
    `explainTrial(state, input)` (TrialInput) and update the one caller
    `components/ship-builder/ui/SeaTrialResult.tsx` (only that line).
- [ ] README Level 2 section documents the model and the outcome table.

**Verify:** `npx jest lib/ship-builder` → all pass; `npm run type-check`.

**Steps:** TDD: write the outcome tests first, implement `flooding.ts`, wire
it in, tune constants until the table passes, then templates, then explain
and README. Commit per step group.

---

### Task 3: Iceberg trial in the scene and UI

**Goal:** Kids pick "Iceberg", tap the hull to aim, watch it flood with an
iceberg, gash and a live below-deck inset, and see story time.

**Files:**

- Modify: `lib/ship-builder/state/store.ts`: add `{ status: "aiming" }` to
  `TrialSlice` (freezes building like other non-idle statuses), actions
  `aimIceberg()` (idle → aiming, switches camera to side view via
  `setCameraView("side")`) and `cancelAim()` (aiming → idle). `startTrial`
  accepts being called from aiming. The existing `startTrial(sea, impactX?)`
  stays as is. Store the last `impactX` in the running/result slices (it is
  in `input.iceberg.impactX` already) so "Try again" reuses it.
- Modify: `components/ship-builder/ui/SeaTrialButton.tsx`: becomes a menu
  button (aria-haspopup="menu") with items "Waves" (`startTrial(seaState)`)
  and "Iceberg" (`aimIceberg()`); arrow keys, Esc closes.
- Create: `components/ship-builder/ui/IcebergAimHint.tsx`: bottom-centre
  "Tap where the iceberg hits" + Cancel button; Esc cancels.
- Modify: scene hull click handling (see `scene/Hull.tsx`,
  `scene/clickGuard.ts`, `scene/coords.ts`): while aiming, a tap on the hull
  converts the hit point to cells from the bow and calls
  `startTrial(seaState, x)`. Show a hover marker on the hull while aiming.
- Create: `components/ship-builder/scene/Iceberg.tsx`: a low-poly white/pale
  blue iceberg that slides past the struck (starboard) side during the first
  ~3 s of an iceberg trial; then drifts away. Respect reduced motion (static,
  no slide).
- Create: `components/ship-builder/scene/HullGash.tsx`: a dark jagged strip on
  the starboard hull below the waterline spanning `gashOf(impactX, length)`;
  rides with the ship pose.
- Modify: `scene/SeaTrialRunner.tsx` / `trialPlayback.ts`: publish the live
  `SimState` (throttled to ~10 Hz) through a tiny external store
  `components/ship-builder/scene/liveTrial.ts` with
  `useLiveTrialState(): SimState | null` (useSyncExternalStore).
- Modify: `components/ship-builder/ui/SeaTrialStatus.tsx`: in an iceberg
  trial show the story clock (`formatStoryTime(storyMinutes(time))`).
- Create: `components/ship-builder/ui/BelowDeckInset.tsx`: a small panel
  (top-left on desktop, top on phones) titled "Below deck" that renders
  `BelowDeckDiagram` (Task 1, read-only: `hull`, `water`, `opened`) from the
  live state. Task 1 builds the diagram in parallel: until it lands, import
  it from `./BelowDeckDiagram` and add a minimal placeholder file with the
  exact props interface from Task 1 if it doesn't exist in your worktree;
  note this in your report (the controller keeps Task 1's version on merge).
- Modify: `components/ship-builder/ui/SeaTrialResult.tsx`: for iceberg
  results the buttons are "Try again" (same impactX), "Try another spot"
  (`aimIceberg()`), "Back to building".
- Tests: store aiming tests; SeaTrialButton menu; aim hint; result buttons;
  liveTrial store.

**Acceptance Criteria:**

- [ ] Menu works by mouse, touch and keyboard; Waves behaves exactly as v2.5.
- [ ] Aiming freezes building, Esc / Cancel returns to building.
- [ ] A tap on the hull while aiming starts the iceberg trial at that x
      (unit test the hit → cells conversion).
- [ ] Iceberg, gash and inset show during iceberg trials only.
- [ ] Reduced motion: no iceberg slide; trial still plays.
- [ ] Unit tests, type-check and lint pass. Existing sea trial e2e passes:
      `npx playwright test e2e/ship-builder --project=chromium` (filter to the
      sea trial spec file).

**Verify:** `npx jest components/ship-builder lib/ship-builder/state` → pass.

---

### Task 4: Integrate, e2e, release (controller + one agent)

**Goal:** Merge Tasks 1–3, wire the inset to the real diagram, add e2e and
visual coverage, release 2.6.0.

**Steps:**

- [ ] Merge task branches into `ship-builder-iceberg` in order 1, 2, 3;
      resolve the diagram placeholder in favour of Task 1.
- [ ] E2E `e2e/ship-builder-iceberg.spec.ts`: add walls in Below deck (check
      Watertight compartments count), Iceberg → tap hull → result
      "She stayed afloat!" for a well-walled ship; a no-wall ship → "She
      sank" with the no-walls tip; Try another spot returns to aiming. Use
      the frozen test clock pattern from the sea trial spec.
- [ ] Visual baseline of a bow-down sink (follow the capsize baseline).
- [ ] Bump `SHIP_BUILDER_VERSION` to 2.6.0; changelog entry "Iceberg!".
- [ ] One combined review (spec + quality) of the whole branch; fix Critical
      and Important findings.
- [ ] `npm run validate` and the Playwright suite (chromium, webkit, ipad).
- [ ] Fast-forward `main` to the branch and push; watch CI to green.
