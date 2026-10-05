# Breakup, Blackout and the Long Way Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Iceberg sinkings can break the ship in two, black out its lights,
and follow the wreck to the sea floor, with slow-mo, sound, replay and a
scrubber (Ship Builder 2.8.0).

**Architecture:** The pure sim (`lib/ship-builder/sim`) gains strain, power,
two-body halves and a descent phase. The scene reads them through
`trialPlayback` (no React re-renders). A precomputed timeline drives
playback, slow-mo and scrubbing. Sound is Web Audio, driven by a pure cue
function.

**Tech Stack:** TypeScript, React 19, three 0.186, @react-three/fiber 9,
drei, zustand store, Jest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-04-titanic-breakup-design.md`

---

## Shared contract (Task 0, done by the controller, already committed)

Every task codes against these. Do not change their shape; add to them only
if your task says so.

- `lib/ship-builder/sim/types.ts`: `BreakMode`, `IcebergInput.breakMode?`,
  `HalfPose { roll, pitch, sink, pivotX, driftX }`, `SimHalves { bow, stern }`,
  `SimBreakup { at, atX, angle }`, `PowerState`, phase `"descending"`, events
  `power-flicker | power-out | broke | touched-bottom`, and on `SimState`:
  `strain`, `power`, `breakup`, `halves`.
- `lib/ship-builder/sim/descent.ts`: `FLOOR_DEPTH = 45`,
  `startDescent(state)`, `stepDescent(state)` (stub), wired into `stepTrial`.
- `components/ship-builder/scene/trialPlayback.ts`: `TrialPlayback` gains
  `strain`, `power`, `breakup`, `halves`, `events`, `speed`, `scrubbing`;
  `writePlayback` copies the sim fields.

**Coordinates:** one cell is one world unit. A cell `x` (from the bow) is
world `lengthCells / 2 - x`, so the bow points toward +X. The ship group's
`rotation.z = pitch` (positive lifts the bow), `rotation.x = roll`, and
`position.y = -sink`. A `HalfPose` places its half at
`T(driftX, -sink, 0) · T(px, 0, 0) · R(roll, 0, pitch) · T(-px, 0, 0)` where
`px = lengthCells / 2 - pivotX` and R uses three's default Euler order.
Continuity at the break (whole ship at pitch θ, sink s; both halves pivot at
`atX`): each half starts with pitch θ, the same roll,
`driftX = px * (cos θ - 1)`, `sink = s - px * sin θ`.

## Dependency graph

Tasks 1 to 6 run **in parallel** (each in its own worktree). Each task owns
its files; the controller merges, resolves the small `Scene.tsx` overlap,
mounts the sound toggle, and runs the full validation. Then Task 7 (tuning,
e2e, release), then one combined review (Task 8).

---

### Task 1: Sim breakup, power and descent

**Goal:** The deterministic sim breaks long plunging ships in two at the
flooded/dry wall, runs the lights through on → flickering → out, takes the
wreck to the floor on request, and explains what happened.

**Files:**

- Create: `lib/ship-builder/sim/breakup.ts`, `lib/ship-builder/sim/power.ts`
- Modify: `lib/ship-builder/sim/descent.ts` (replace the stub),
  `lib/ship-builder/sim/flooding.ts` (`stepPlunge` and constants),
  `lib/ship-builder/sim/seaTrial.ts` (only if wiring needs it),
  `lib/ship-builder/sim/explain.ts`, `lib/ship-builder/sim/README.md`
- Test: `lib/ship-builder/sim/__tests__/breakup.test.ts`, `power.test.ts`,
  `descent.test.ts`, extend `explain` tests

**Acceptance Criteria:**

- [ ] `strain = |pitch| * (length / REF_LENGTH)^2` each plunge step;
      `strengthFor(mode)`: `real` uses `HULL_STRENGTH`, `always` makes any
      ship break once |pitch| reaches `ALWAYS_BREAK_PITCH` (≈0.21 rad),
      `never` is `Infinity`. Absent `breakMode` is `real`.
- [ ] Break position: the stern wall (`toX`) of the stern-most compartment
      with water > `FLOODED_WATER`, clamped to [0.35, 0.7] × length; 0.6 ×
      length when the hull has one compartment.
- [ ] On break: `breakup`, a `broke` event, `halves` created with the
      continuity formula from the contract (a test checks that a bow-tip
      point and a stern-tip point are in the same world place one step before
      and at the break, within 1e-6).
- [ ] Bow half eases to `BOW_FINAL_PITCH` (≈ -1.05 rad) and sinks fast; stern
      half settles toward level for ≈2 s, then rises to `STERN_FINAL_PITCH`
      (≈ +1.4 rad), hangs ≈1.5 s, then sinks; `sunk` once both are below
      `PLUNGE_DEPTH`, then `done`.
- [ ] To make the plunge steep enough to break, the bow-first plunge may
      need a steeper final pitch for long ships; keep the unbroken (`never`)
      result visually the same as today (existing tests keep passing).
- [ ] Power: `flickering` at flooded fraction ≥ `FLICKER_FLOODED` (0.2) or
      water > `FLOODED_WATER` in the middle compartment (the one containing
      length / 2); `out` when strain ≥ `POWER_OUT_STRAIN` (0.85) × strength
      (so it precedes the break) or, unbroken, at sink ≥ PLUNGE_DEPTH / 3.
      Events `power-flicker` and `power-out` once each, flicker before out.
- [ ] Descent: `stepDescent` sinks each body (the whole `pose`, or each half)
      to `FLOOR_DEPTH` with terminal speed `DESCENT_SPEED` (≈4 u/s), eases
      pitch to a rest angle (whole ship / bow ≈ -0.25 rad, nose dug in;
      stern ≈ +0.1), logs `touched-bottom` per body when its lowest point
      would reach the floor (use the body's pivot sink, minus half its length
      × |sin pitch| for its low end, so it never visibly sinks into the sand),
      and returns phase `done` when all have landed and eased (≤ ~1.5 s after
      the last touch). Roll eases to a small resting list.
- [ ] Waves trial and every existing sim test unchanged.
- [ ] Same input twice → identical states (determinism test).
- [ ] `explainTrial` adds: a power line ("The lights flickered, then went out
      as she went down."), a break line naming the angle in whole degrees
      and the nearest wall ("…broke in two at 19°, just behind wall 3." /
      "Short and sturdy, she held together." for a sank-but-unbroken ship in
      `real` mode / "You told her to hold together." for `never`), and,
      when the state has `touched-bottom` events, a floor line. Match the
      existing `TrialSummary` shape; add fields rather than rename.
- [ ] Constants exported and documented in README like the existing ones,
      with a new "Level 2b: breakup, power, descent" section.
- [ ] Tuning table test using the real templates
      (`lib/ship-builder/templates`): in `real` mode the liner breaks and the
      smallest template does not. Pick impact spots that sink each. Record the
      resulting table in README.

**Verify:** `npx jest lib/ship-builder/sim` → all pass; `npx tsc --noEmit -p .`

**Steps:**

- [ ] Write failing tests for strain/strength, break position, continuity,
      power order, descent landing, determinism.
- [ ] Implement `breakup.ts` (strain, strength, break position, half init,
      half steps) and `power.ts` (power transitions), call them from
      `stepPlunge` / `stepFlooding`.
- [ ] Implement `stepDescent`.
- [ ] Extend `explain.ts`, README.
- [ ] Run tests, type-check, prettier, eslint. Commit:
      `feat(ship-builder): ships can break in two, lose power and sink to the floor`

---

### Task 2: Sound

**Goal:** Procedural Web Audio for the iceberg trial, muted by default, driven
by a pure cue function.

**Files:**

- Create: `components/ship-builder/audio/cues.ts` (pure),
  `components/ship-builder/audio/synth.ts` (Web Audio),
  `components/ship-builder/audio/soundSetting.ts` (persisted on/off, follow
  the pattern of the existing time-of-day setting in
  `components/ship-builder/hooks/useTimeOfDay.ts`),
  `components/ship-builder/audio/TrialSound.tsx` (inside the Canvas; reads
  `trialPlayback` each frame in `useFrame`, keeps the previous snapshot,
  calls `cuesFor`, feeds the synth; also reads camera y for underwater
  muffling), `components/ship-builder/ui/SoundToggle.tsx`
- Test: `components/ship-builder/audio/__tests__/cues.test.ts`,
  `components/ship-builder/ui/__tests__/SoundToggle.test.tsx`

**Acceptance Criteria:**

- [ ] `cuesFor(prev: PlaybackSnapshot, next: PlaybackSnapshot): Cue[]` where
      a snapshot is the needed subset of `TrialPlayback` (time, phase,
      strain, power, events length/kinds, speed, scrubbing). Cues:
      `impact` (first `flooding` event), `creak` with intensity 0-1 from
      strain (rate-limited by sim time so creaks come more often as strain
      rises), `flicker` (power is flickering: emit at a capped rate),
      `power-out`, `break`, `gurgle` (flooding/sinking, rate-limited),
      `touchdown` (each new `touched-bottom` event), and continuous params
      `{ sea: boolean, hum: boolean }`. Returns no one-shot cues when
      `next.scrubbing` or when time went backwards (replay start) — it just
      resyncs.
- [ ] Synth: lazily creates an `AudioContext` only from `enable()` (called
      from the toggle's click); master gain + lowpass for underwater/slow-mo
      (`setMuffle(0..1)`), noise buffer generated once; each cue a short
      graph of oscillators/noise/filters/envelopes that disconnects itself
      when done. No audio files.
- [ ] Sounds per spec: sea bed noise, iceberg scrape + rumble, creak groans,
      hum + buzz/click on flicker + wind-down on power out, crack + boom +
      tearing groan on break, gurgles, muffled underwater, thud on touchdown,
      slow-mo (speed < 1) lowers and muffles.
- [ ] `SoundToggle`: speaker icon button with `aria-pressed` and an
      accessible label ("Sound on"/"Sound off"), Tailwind with light/dark
      variants like the other trial buttons (see `ui/styles.ts`). Renders
      nothing when `window.AudioContext` (or webkit) is missing. Off by
      default; persisted in localStorage with try/catch.
- [ ] Everything is silent and allocation-free when sound is off.
- [ ] Do not mount `TrialSound` or `SoundToggle` anywhere; the controller
      mounts them at merge time. Export them as default exports.

**Verify:** `npx jest components/ship-builder/audio components/ship-builder/ui/__tests__/SoundToggle` → pass

**Steps:**

- [ ] Failing cue tests (impact once, creak rate rises with strain, break once,
      touchdown per event, nothing while scrubbing, resync on time going
      backwards). Implement `cues.ts`. Pass.
- [ ] Implement `synth.ts`, `soundSetting.ts`, `TrialSound.tsx`.
- [ ] Toggle test (hidden without AudioContext, toggles aria-pressed,
      persists). Implement. Pass.
- [ ] tsc, eslint, prettier. Commit: `feat(ship-builder): sound for the iceberg trial`

---

### Task 3: Draw the broken ship

**Goal:** After the break the ship is drawn as two halves following their
`HalfPose`, with clipped hull and railings, parts split by position, a torn
edge, and a burst at the moment of the break.

**Files:**

- Create: `components/ship-builder/scene/halfTransform.ts` (pure: apply a
  `HalfPose` to an `Object3D` / build its matrix),
  `components/ship-builder/scene/partHalves.ts` (pure: which half each part
  belongs to; attached parts follow their root grid part),
  `components/ship-builder/scene/tornEdgeGeometry.ts` (pure geometry),
  `components/ship-builder/scene/TornEdge.tsx`,
  `components/ship-builder/scene/BrokenShip.tsx`,
  `components/ship-builder/scene/BreakBurst.tsx`
- Modify: `components/ship-builder/scene/ShipAnimation.tsx` (swap BobGroup
  for BrokenShip while `trialPlayback.halves` is set; check each frame or
  subscribe cheaply, never re-render at 60 Hz), `Hull.tsx` and
  `Railings.tsx` (optional `clip?: Plane` prop → cloned material with
  `clippingPlanes`, `side: DoubleSide`), `ShipParts.tsx` (optional
  `filter?: (part) => boolean`), `Scene.tsx` (`gl.localClippingEnabled`,
  pass the same children to BrokenShip)
- Test: `components/ship-builder/scene/__tests__/halfTransform.test.ts`,
  `partHalves.test.ts`, `tornEdgeGeometry.test.ts`

**Acceptance Criteria:**

- [ ] `halfTransform` matches the contract formula; test: a pose with
      pivot at atX and the continuity values maps points the same as the
      whole-ship transform.
- [ ] Each half's clip plane is recomputed every frame in world space from
      the half's matrix so the cut stays on the break line as it moves.
- [ ] Parts: centre x < atX → bow, else stern; attach-anchored parts follow
      their parent chain to a grid part. Unknown → stern.
- [ ] Torn edge: cap following the hull cross-section at `atX` (read how
      `hullGeometry.ts` builds the section; reuse its profile function rather
      than duplicating), outline displaced by a deterministic sawtooth (no
      `Math.random`; seed from atX), outer rim in hull paint colour, dark
      inner face, 2-4 short protruding deck plates; bow and stern edges
      mirrored. Light and dark scenes both read well.
- [ ] BreakBurst: on the first frame `breakup` exists, spawn dark debris, a
      few orange sparks and a bubble/spray gush through the existing
      `ParticleField` system (see `SeaTrialEffects.tsx`, `trialEffects.ts`);
      effects are functions of `trialPlayback.time - breakup.at` so a scrub
      shows the right moment.
- [ ] Before the break nothing in the scene graph changes; the hull is drawn
      twice only after it. Tap targets, ghost preview and grid targets are
      not rendered inside the halves (the ship is frozen during a trial).
- [ ] HullGash goes with whichever half contains the gash centre.
- [ ] Reduced motion: halves simply render at their final poses (the runner
      writes them).

**Verify:** `npx jest components/ship-builder/scene` → pass; `npx tsc --noEmit -p .`; visually check with `npx next dev --webpack` by starting an iceberg trial on the liner template with the sim stub (temporarily force halves in a dev-only scratch, do not commit it) or after merging Task 1.

**Steps:**

- [ ] Failing tests for halfTransform, partHalves, tornEdgeGeometry
      (vertex count > 0, all cap vertices at x = atX ± jag depth, no NaN).
- [ ] Implement the pure modules, then the components and the
      ShipAnimation swap.
- [ ] tsc, eslint, prettier. Commit: `feat(ship-builder): draw a ship broken in two`

---

### Task 4: Sea floor, underwater and descent effects

**Goal:** A sand floor at `FLOOR_DEPTH`, depth fog when the camera is
underwater, bubble trails while descending and silt puffs on landing.

**Files:**

- Create: `components/ship-builder/scene/seaFloorGeometry.ts` (pure, bumpy
  plane with deterministic noise), `components/ship-builder/scene/SeaFloor.tsx`,
  `components/ship-builder/scene/UnderwaterFog.tsx`,
  `components/ship-builder/scene/DescentEffects.tsx`,
  `components/ship-builder/scene/descentEffects.ts` (pure particle maths)
- Modify: `components/ship-builder/scene/Scene.tsx` (mount the three)
- Test: `components/ship-builder/scene/__tests__/seaFloorGeometry.test.ts`,
  `descentEffects.test.ts`

**Acceptance Criteria:**

- [ ] SeaFloor imports `FLOOR_DEPTH` from `lib/ship-builder/sim/descent`; a
      large (≈400×400) plane at y = -FLOOR_DEPTH, gentle bumps (±0.6), sandy
      colour that darkens with distance; `visible` only when some body's sink
      is past `PLUNGE_DEPTH * 0.5` or phase is `descending` (read
      `trialPlayback` in `useFrame`, set `visible` directly), so building
      costs nothing.
- [ ] UnderwaterFog: when the camera's y < the water surface, set scene fog
      (deep blue, density rising with depth) and blend the background colour
      toward the existing underwater colour (`Environment.tsx`); restore the
      previous fog/background when back above. No React state per frame.
- [ ] DescentEffects: while phase is `descending`, bubble trails rising from
      each body (whole ship or each half; use `HalfPose` → world via the
      contract formula); on each new `touched-bottom` event a tan silt puff
      that spreads and settles over ≈3 s at that body's landing x. Driven by
      `trialPlayback.time` so scrubbing works. Reuse `ParticleField`.
- [ ] Respects reduced motion (no particles, floor still shows).

**Verify:** `npx jest components/ship-builder/scene/__tests__/seaFloorGeometry components/ship-builder/scene/__tests__/descentEffects` → pass; tsc.

**Steps:**

- [ ] Failing tests for floor geometry (bounds, determinism) and particle
      maths (puff spreads then fades, trail positions follow the body).
- [ ] Implement, mount in Scene.tsx.
- [ ] tsc, eslint, prettier. Commit: `feat(ship-builder): a sea floor to sink to`

---

### Task 5: Timeline, slow-mo, store and trial controls

**Goal:** Iceberg trials play from a precomputed timeline with slow-mo at the
break; the player picks a break mode, can follow her down, watch again and
scrub.

**Files:**

- Create: `lib/ship-builder/sim/timeline.ts` (pure),
  `components/ship-builder/scene/trialTimeline.ts` (module-level timeline
  holder, like `trialPlayback`), `components/ship-builder/ui/TrialScrubber.tsx`,
  `components/ship-builder/ui/BreakModeSwitch.tsx`
- Modify: `lib/ship-builder/state/store.ts`, `SeaTrialRunner.tsx`,
  `trialPlayback.ts` (write `speed`, `scrubbing`), `ui/IcebergAimHint.tsx`
  (mount BreakModeSwitch), `ui/SeaTrialStatus.tsx` (Follow her down),
  `ui/SeaTrialResult.tsx` (new explanation fields, Watch again, scrubber),
  `ui/seaTrialText.ts`
- Test: `lib/ship-builder/sim/__tests__/timeline.test.ts`, store tests
  (`lib/ship-builder/state/__tests__/store.breakup.test.ts`), UI tests in
  `components/ship-builder/ui/__tests__/`

**Acceptance Criteria:**

- [ ] `buildTimeline(input): Timeline` runs the sim to done and keeps every
      state (`states: SimState[]`, index i is time i × SIM_STEP_S after the
      first); `extendWithDescent(timeline, input)` appends `startDescent` +
      steps to done; `stateAt(timeline, simTime)` clamps and indexes;
      `slowMoSpeed(timeline, simTime)` returns 1, easing (smoothstep) to
      `SLOW_MO_SPEED` 0.25 over the `SLOW_MO_LEAD_S` 0.6 s before `broke`,
      holding through `SLOW_MO_HOLD_S` 0.8 s after, then easing back to 1 by
      2 s after; 1 everywhere when there is no break.
- [ ] Store: `trial.breakMode` lives outside the trial status union
      (session-remembered, default `real`), `setBreakMode(mode)`; iceberg
      `startTrial` puts `breakMode` into `input.iceberg`. Add a
      `descending: boolean` to the running/result slices and a
      `descend()` action valid only on a finished `sank` result: it goes
      back to `running` with `descending: true` (same runId bumped) so the
      runner continues from the end state; `replay()` restarts from time 0
      of the existing timeline (new runId, keeps descent if it was taken).
      The result screen keeps the ship where it ended (wreck stays). Leaving
      (`endTrial`, `aimIceberg`, `cancelAim`) clears everything as today.
- [ ] Runner: for iceberg trials, build the timeline once per input (cache
      it in `trialTimeline.ts`, keyed by the input object), play it by
      advancing a playback sim-time with frame delta × slow-mo speed ×
      test speed; on `descend` extend the timeline and continue; write
      `trialPlayback.speed`. Waves trials keep today's path untouched.
      Reduced motion: jump to the last state (including descent if taken).
      `testTrialSeconds` / `testTrialSpeed` keep working.
- [ ] Scrubber (result screen, iceberg only): a range input over the
      timeline's duration with tick marks at `flooding` (impact),
      `power-flicker`, `power-out`, `broke`, `sunk`, `touched-bottom`;
      dragging sets `trialPlayback.scrubbing = true` and writes the state at
      that time to `trialPlayback`; releasing clears scrubbing and leaves the
      ship at that moment. Keyboard accessible, labelled, light/dark.
- [ ] BreakModeSwitch: segmented control "Real / Break her / Hold together"
      with short helper text, `aria-pressed`, in the aim panel.
- [ ] "Follow her down" button in the status bar appears once the `sunk`
      event has happened in an iceberg trial that is not already descending;
      tapping it calls `descend()`. If the player ignores it the result card
      appears as today.
- [ ] Result card: renders the new explanation fields from `explainTrial`
      (Task 1 adds them; render them only when present so this task works
      before Task 1 merges), a **Watch again** button (`replay()`), and the
      scrubber.

**Verify:** `npx jest lib/ship-builder components/ship-builder` → pass; tsc.

**Steps:**

- [ ] Failing timeline tests (stateAt clamps, slow-mo window shape using a
      hand-built timeline with a `broke` event, extendWithDescent appends).
- [ ] Implement timeline, then store actions with tests, then runner, then
      UI with tests.
- [ ] tsc, eslint, prettier. Commit: `feat(ship-builder): replay, slow-mo and follow her down`

---

### Task 6: Camera follow, power-driven lights and night

**Goal:** The camera follows the sinking and the descent, lights follow the
ship's power with a safe flicker, and iceberg trials happen at night.

**Files:**

- Create: `components/ship-builder/scene/powerFlicker.ts` (pure),
  `components/ship-builder/scene/PoweredGlow.tsx`,
  `components/ship-builder/scene/cameraFollow.ts` (pure)
- Modify: `components/ship-builder/scene/CameraRig.tsx`, `Scene.tsx` (wrap
  the glow controller passed to Hull and ShipParts), `FunnelSmoke.tsx`
  (stop emitting when power is out), `hooks/useTimeOfDay.ts` (night
  override while an iceberg trial is running or showing its result)
- Test: `components/ship-builder/scene/__tests__/powerFlicker.test.ts`,
  `cameraFollow.test.ts`, extend useTimeOfDay tests if present

**Acceptance Criteria:**

- [ ] `powerLevel(power, time, flickerStartedAt, reducedMotion): number`
      0-1: `on` → 1; `flickering` → a deterministic curve from time (sum of
      sines/hash, no Math.random) that dips to near 0 at most 3 times per
      second (test samples 10 s at 120 Hz and counts falling edges through
      0.5: ≤ 3 per any 1 s window); `out` → 0 after a short (≈0.3 s) fade;
      reduced motion: a smooth ramp from 1 to 0.4 while flickering, never
      flashing. Flicker start comes from the `power-flicker` event time.
- [ ] `PoweredGlow`: a derived `GlowController` (reuse
      `createGlowController`) set each frame to sky glow × power level;
      provided instead of the raw one in Scene.tsx for the Hull and
      ShipParts. Building and waves trials are unaffected (power is `on`).
- [ ] Night: during an iceberg trial (status running or result with an
      iceberg input) `useTimeOfDay` reports `night` without changing the
      saved setting; afterwards the player's setting returns (the existing
      sky fade handles the transition).
- [ ] `cameraFollow`: pure function giving the orbit target for a playback
      (null while not sinking): whole ship → its sunk position; broken →
      midpoint of the halves' centres; during slow-mo (speed < 1) also a
      preferred side-on camera direction; during `descending` and after
      landing → follow down then a low wreck framing near the floor.
      CameraRig eases `controls.target` (and, for the side-on/wreck framing,
      the camera position by keeping the current offset but lowering it)
      toward it; user orbit/zoom still work. Reduced motion snaps.
- [ ] FunnelSmoke stops spawning once `trialPlayback.power === "out"`.

**Verify:** `npx jest components/ship-builder/scene/__tests__/powerFlicker components/ship-builder/scene/__tests__/cameraFollow` → pass; tsc.

**Steps:**

- [ ] Failing tests for powerLevel (on/out/flicker rate/reduced motion) and
      cameraFollow (null when idle, follows sink, midpoint when broken).
- [ ] Implement, wire into Scene.tsx, CameraRig, FunnelSmoke, useTimeOfDay.
- [ ] tsc, eslint, prettier. Commit: `feat(ship-builder): lights fail, night falls and the camera follows her down`

---

### Integration (controller)

- [ ] Cherry-pick tasks 1-6 onto `ship-builder-breakup`, resolve
      `Scene.tsx`, mount `TrialSound` in the Canvas and `SoundToggle` in the
      trial status / result controls.
- [ ] `npm run validate`.

### Task 7: Tuning, e2e and release

**Goal:** It looks and plays right on the real templates; an e2e covers the
whole flow; version 2.8.0.

**Files:**

- Modify: sim constants (tuning only), `e2e/ship-builder-iceberg.spec.ts`
  (or a new `e2e/ship-builder-breakup.spec.ts`),
  `lib/ship-builder/version.ts`, `lib/ship-builder/changelog.ts`

**Acceptance Criteria:**

- [ ] Watched in the browser on the liner and smallest templates in each
      break mode; constants adjusted so the break is dramatic and the stern
      rise reads clearly; screenshots checked.
- [ ] e2e: load the liner, aim an iceberg near the bow, start, wait for the
      break (use the existing test clock helpers), tap Follow her down, wait
      for the result, assert the result text mentions breaking in two and the
      floor, and that Watch again restarts.
- [ ] Version `2.8.0`, changelog entry in plain words for young builders.
- [ ] `npm run validate` and
      `npx playwright test --project=chromium --project=webkit --project=ipad` green.

### Task 8: Combined review

One reviewer over the whole branch diff (spec + quality). Fix Critical and
Important findings directly; list Minor ones as follow-ups.
