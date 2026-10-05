# Ship Builder: Breakup, Blackout and the Long Way Down (2.8.0)

## Goal

Make the iceberg trial's sinking dramatic and teachable: long ships crack in
half the way the Titanic did, the lights flicker and die, and the player can
follow the wreck all the way to the sea floor, with slow-mo at the break,
procedural sound, replay with a scrubber, and a wreck that stays to explore.

## Decisions (from brainstorming)

- **When she breaks:** the build decides by default (strain from length and
  stern lift), and the player can override it. A three-way switch on the
  iceberg aim panel: **Real** (default) / **Break her** / **Hold together**.
- **Night:** an iceberg trial forces night (sky fades), restored afterwards.
- **To the floor:** offered, not forced. A "Follow her down" button appears on
  the `sunk` event; skipping ends the trial as today.
- **Extras:** slow-mo at the break, sound (muted by default), replay +
  scrubber, wreck stays on the floor until the player leaves the result.
- **Rendering approach A:** parts are partitioned whole to a half by centre x;
  only the hull (and railings) are clipped, with a torn-edge cap. Before the
  break the scene is unchanged.

## 1. Simulation (`lib/ship-builder/sim/`, pure and deterministic)

### Strain and break

- Each plunge step: `strain = |pitch| * (length / REF_LENGTH)^2`.
- Breaks when `strain >= strengthFor(mode)`:
  - `real`: `HULL_STRENGTH` (tuned so tug/small templates never break, the
    liner always does, mid-size ships depend on how steep the plunge gets)
  - `always`: threshold such that any ship breaks once |pitch| reaches
    `ALWAYS_BREAK_PITCH` (about 12 degrees)
  - `never`: `Infinity` (today's plunge)
- **Where:** the stern wall of the stern-most flooded compartment (water >
  `FLOODED_WATER`), clamped to [0.35, 0.7] of length. With no bulkheads, 0.6.
- On break: `breakup = { at, atX, angle }`, a `broke` event, and `halves` are
  created. Power goes out a moment before (see Power).

### Two bodies

`halves: { bow: HalfPose, stern: HalfPose }`. A `HalfPose` rotates its half
about a fixed pivot on the keel line at `pivotX` (cells from the bow, set to
`atX` for both halves), then shifts it by `driftX` (world units toward the
bow) and `sink`. Continuity at the break: with the whole ship at pitch θ and
sink s, and `px = length/2 - atX` (pivot's world x), each half starts at
pitch θ, `driftX = px * (cos θ - 1)`, `sink = s - px * sin θ`, same roll.

- **Bow:** loses the stern's support; pitch eases to `BOW_FINAL_PITCH`
  (about -60 degrees) while sinking fast.
- **Stern:** settles back toward level (about 2 s), floods, then rises about
  its broken end to `STERN_FINAL_PITCH` (about +80 degrees, the stern up),
  hangs briefly, then slides straight down.
- `sunk` fires when both halves are below `PLUNGE_DEPTH`; the trial is
  `done`. Unbroken ships keep using `pose` exactly as today.

### Power

`power: "on" | "flickering" | "out"` in `SimState`.

- `flickering` when the flooded fraction reaches `FLICKER_FLOODED` (~0.2) or
  water reaches the middle compartment (the "engine room"), whichever first.
- `out`: `POWER_OUT_LEAD_S` before the break when she breaks (strain reaching
  `POWER_OUT_STRAIN` of the threshold triggers it), else once sink reaches a
  third of `PLUNGE_DEPTH`.
- Events: `power-flicker`, `power-out`. The flicker pattern itself is a
  deterministic noise curve of time in the scene, under 3 flashes per second
  (WCAG); reduced motion dims smoothly.

### Descent

- `startDescent(state)`: from a `done` + `sank` state, returns phase
  `descending`. `stepTrial` steps it with `stepDescent`.
- Each body (whole ship or each half) sinks toward `FLOOR_DEPTH` (about 45)
  with a terminal speed, its pitch easing toward a resting angle (bow digs
  in, stern lands near level); `touched-bottom` per body on landing; phase
  `done` once all have settled.

### Explain

`explainTrial` gains lines for: lights failing, the break ("She was too long to
take the strain and broke in two at 19 degrees, just behind your third wall"
vs "Short and sturdy, she held together"), and landing on the floor.

## 2. Rendering (`components/ship-builder/scene/`)

- `ShipAnimation` renders `BobGroup` until `trialPlayback.halves` exists, then
  `BrokenShip`: two `HalfGroup`s reading their `HalfPose`.
- Each half: `Hull` + `Railings` with a cloned material carrying one world-space
  clipping plane updated each frame from the half's matrix
  (`gl.localClippingEnabled = true`), `side: DoubleSide` so the dark interior
  shows; `ShipParts filter` by part centre x (attached parts follow parent);
  `TornEdge` (jagged cap from the hull cross-section at `atX`, deterministic
  sawtooth, outer torn plating rim, dark inner face, a few protruding deck
  plates; halves mirrored).
- Break burst via the existing particle field: dark debris, a few orange
  sparks, bubble gush and spray. Funnel smoke stops at `power-out`.
- `PoweredGlow`: the glow controller provided to lit parts is sky glow x power
  level (flicker curve). The iceberg trial forces night via a time-of-day
  override.
- `SeaFloor` (sandy, gently bumpy plane at `FLOOR_DEPTH`) mounts only during
  descent and wreck view. Underwater depth fog when the camera is below the
  surface. Bubble trails while descending; silt puff on `touched-bottom`.
- Wreck stays in the result state; leaving pops the ship back whole.
- Reduced motion: jump to end; halves shown at their final poses, no slow-mo,
  no flicker.

## 3. Sound (`components/ship-builder/audio/`)

- Web Audio, all synthesized. Muted by default; speaker toggle in trial
  controls, persisted (try/catch). AudioContext created on the enabling tap.
  Hidden when Web Audio is missing.
- Pure `cuesFor(prev, next)` maps playback changes to cues (`impact`,
  `creak(intensity)`, `flicker`, `power-out`, `break`, `gurgle`,
  `touchdown`, `sea`); unit-tested. A synth module renders them. Scrubbing is
  silent.
- Sounds: sea bed noise; iceberg scrape; strain creaks rising with strain;
  hum while powered, buzz/click on flicker, wind-down on power out; crack,
  boom and tearing groan at the break; gurgles while flooding/sinking; muffled
  lowpass underwater; thud on touchdown; slow-mo lowers and muffles.

## 4. Timeline, slow-mo, camera, controls

- **Timeline:** at iceberg trial start, precompute every step with the sim into
  a module-level timeline (about 7k states); "Follow her down" appends the
  descent. Playback reads by index.
- **Slow-mo:** playback speed eases to 0.25 about 0.6 s before `broke` and
  back up about 2 s after.
- **Camera:** once sinking, the orbit target eases toward the ship (or the
  halves' midpoint); orbit and zoom stay free. During slow-mo it eases to
  frame the split side-on. During descent it rides down, then settles into a
  low wreck view. Reduced motion snaps.
- **Controls:** break-mode switch on the aim panel (session-remembered);
  "Follow her down" in the status bar on `sunk`; result card gains the new
  explanation lines, **Watch again**, and a scrubber marked with impact,
  flicker, power out, break, sunk, bottom (scrubbing pauses and is silent);
  speaker toggle.
- **Store:** `trial.breakMode`, a `descend` action, descending state; the
  timeline lives outside React like `trialPlayback`.

## Testing

Sim outcome tables per mode across templates, break position follows walls,
power event order, descent lands both bodies, determinism. Timeline slow-mo
window and scrub lookup. Cue logic. UI for the switch, Follow her down, result
card, scrubber. One e2e: liner hits the iceberg, breaks, is followed down, and
the wreck shows.

## Release

Ship Builder 2.8.0 with a plain-words changelog entry.
