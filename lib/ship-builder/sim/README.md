# Ship simulation

A small, deterministic, fixed-step model of how a ship behaves at sea. Pure
TypeScript (no React, no three.js, no `Math.random`): the 3D scene only reads
the `SimPose` it produces. Every run of the same ship in the same sea is
identical.

- `types.ts`: the contract (state, pose, input, events, reserved slots).
- `seaTrial.ts`: `createTrial`, `stepTrial` (one `SIM_STEP_S` step, returns a
  new state), `runTrial` (headless, for tests).
- `simShip.ts`: `simShipFromStats(stats, beam)`.
- `flooding.ts`: Level 2, `stepFlooding` and `stepPlunge` plus the tuned
  constants.
- `compartments.ts`, `story.ts`: the hull's compartments and the story clock.
- `breakup.ts`, `power.ts`, `descent.ts`: Level 2b, breaking in two, the
  lights, and the way down to the sea floor.
- `explain.ts`: `explainTrial(state, input)` for the result card.

## The model

Roll is a damped oscillator (`NATURAL_FREQ` 3 rad/s, damping 0.35) pushed by
three summed sine waves (same weights and frequencies as the scene's sea,
scaled by the sea's speed; they fade in over 1.5 s). Its righting torque is
proportional up to a knee (60% of the capsize angle), fades to nothing at the
capsize angle and pushes her over beyond it. The ship rests at her `listAngle`.

Both the push and the capsize angle come from one severity number
(`severityOf`), 0 to 4:

- stability class: 0 stable, +1 top-heavy, +2 dangerous (steep blends around
  `STABILITY_THRESHOLDS`)
- list at or past `LOPSIDED_LIST` (8 degrees): +1, capped at 3
- list at or past `HEAVY_LIST` (18 degrees): 4, which is below her own resting
  list, so she goes over in any sea

| tier | push (x wave slope) | capsize angle |
| ---- | ------------------- | ------------- |
| 0    | 1.25                | 75 deg        |
| 1    | 5                   | 70 deg        |
| 2    | 24                  | 60 deg        |
| 3    | 55                  | 35 deg        |
| 4    | 70                  | 8 deg         |

Wave slope per sea: calm 0.039, choppy 0.15, stormy 0.315 rad.

A port-listing ship is simulated as the exact mirror of a starboard one.

## Phases and events

`sailing` (up to 9 s) -> either `done` (outcome `steady` or `recovered`) or,
once the roll passes the capsize angle (not before 1 s), `capsizing`: the
outcome and reason are set at that moment, she rolls to 170 degrees, then
`sinking`: `sink` grows to `SINK_DEPTH` with a slight bow-down pitch, then
`done`. Events: `big-roll` (20 degrees from her resting list), `recovered`
(back within 10 degrees), `capsized`, `sunk`.

## Outcomes (enforced by `__tests__/seaTrial.test.ts`)

| ship                     | calm                                | choppy    | stormy    |
| ------------------------ | ----------------------------------- | --------- | --------- |
| Stable and level         | steady                              | steady    | recovered |
| Top-heavy                | steady                              | recovered | capsized  |
| Dangerous                | recovered                           | capsized  | capsized  |
| Lopsided (list >= 8 deg) | one step worse than its class above |
| Heavy list (>= 18 deg)   | capsized                            | capsized  | capsized  |

`reason` is `lopsided` when the list tipped it past what its class alone would
do, `rough-sea` for a stable ship's recovered stormy run, else the class.
Outcomes are only guaranteed away from the class edges (within about 0.02 of a
threshold the blend between tiers applies).

## Where later levels plug in

`stepTrial` picks a small step function by phase (`stepSailing`,
`stepCapsizing`, `stepSinking`), each `(input, params, state) => state`.

- **Level 2, flooding.** Fill `SimState.compartments` and add a flooding step
  that runs before the phase step. It turns water into: `pose.pitch` (trim),
  `pose.sink` (draft) and a lower capsize angle / higher push (adjust the
  `TrialParams` that `paramsOf` builds, e.g. subtract from `capsizeAngle`). The
  phase steps already read those params, so they need no change. A ship that
  floods but doesn't capsize would need a `sinking` entry that doesn't require
  `capsizing` first.
- **Level 3, actions and events.** `SimAction` becomes a union (launch
  lifeboat, start pump, send distress call). `stepTrial` already receives
  `actions`: apply them first (before the phase step) to change the state or
  params, and record what happened with new `SimEvent` kinds for the result
  screen.

## Level 2: the iceberg trial

`input.iceberg` (`IcebergInput`) holds the hull's compartments
(`compartmentSpecsOf`), its length and where she was struck (`impactX`, cells
from the bow). `createTrial` makes one `Compartment` per spec, dry, with
`opened` set for those the gash overlaps (`openedBy`). While she is `sailing`,
`stepTrial` runs `stepFlooding` before the roll step; the waves still roll her
and a wave capsize still wins, but the waves trial's 9 s timeout does not end
an iceberg trial.

Each fixed step in `flooding.ts` (constants are exported and tuned there):

- Inflow: an opened compartment gains `INFLOW x (cells of gash inside it) x
(sea level - water) / its length` per second. The sea level is `SEA_LEVEL`
  (0.6 of the hull's depth) plus her draft, so a contained compartment
  settles near 0.6 instead of filling.
- Trim and draft: `pitch = -PITCH_GAIN x sum(water x length x (middle -
centre)) / L^2` (bow down is negative); `sink = SINK_GAIN x sum(water x
length) / L`.
- Walls: a wall's height is its fraction (`low` 0.45, `waterline` 0.75, `deck`
  1. minus the trim drop at its x (`TRIM_LEVER` per radian per cell from
     midships, so a bow-down ship lowers the bow walls) minus draft in depth
     units (`SINK_TO_DEPTH`). Water above a wall pours into the lower neighbour at
     `SPILL_RATE`; the first time any wall overflows she logs a `spilled` event.
- Nothing floods until `ICEBERG_IMPACT_S` (1.5 s), when the scene's iceberg
  touches the hull. `flooding` is logged at the first inflow.
- Sinking: once the flooded fraction reaches `RESERVE` (0.3) the outcome is
  `sank`, the phase becomes `sinking` and `stepPlunge` takes her bow-first to
  a pitch of `PLUNGE_PITCH` and down to `PLUNGE_DEPTH`; the `sunk` event ends
  the trial. A long ship may break in two on the way (Level 2b below).
- Afloat: when inflow and spill both fall under `SETTLED_EPS` (checked each
  step, not over a window, because `SimState` has no slot for a settle
  clock), or `ICEBERG_MAX_S` (90 s) after impact with the flooded fraction under
  `RESERVE`, the outcome is `afloat`. A settled ship has draft under 1.5 and
  `|pitch|` under 0.12.

`reason`: `no-bulkheads` when the hull has no walls, otherwise `spilled` if a
`spilled` event happened before she sank, else `too-many-opened`; `held` when
she stays afloat.

Story time: `STORY_MINUTES_PER_SIM_SECOND` is 5, counted from impact
(`storyMinutesSinceImpact`), so the Titanic (about 32.3 sim seconds after the
strike, breaking in two on the way) sinks in 161 story minutes.

Tuning: `INFLOW` 5 (raised from 3 so the Titanic's breakup, which adds about
10 s after the plunge starts, still ends under 170 story minutes), `SPILL_RATE` 20, `SINK_TO_DEPTH` 0.1, `TRIM_LEVER` 0.12,
`RESERVE` 0.3. Together they keep any hull of 8 or more segments with deck-high
walls on every boundary afloat wherever the iceberg strikes (swept in the
tests), while the Titanic's low walls still overflow.

### Outcomes (enforced by `__tests__/flooding.test.ts`)

| ship and hit                                     | outcome | reason            |
| ------------------------------------------------ | ------- | ----------------- |
| No bulkheads, any hit                            | sank    | `no-bulkheads`    |
| 10 segments, deck-high walls, hit at x=9         | afloat  | `held`            |
| Same, every wall `low`                           | sank    | `spilled`         |
| Walls too far apart, gash opens most of the hull | sank    | `too-many-opened` |
| Titanic and Olympic, hit at x=5                  | sank    | `spilled`         |
| Britannic (deck-high walls), hit at x=5          | afloat  | `held`            |
| Every template, hit at its middle, calm sea      | afloat  | `held`            |

Titanic and Olympic have 15 walls, but the nine forward ones only reach the
waterline, so the flooded bow spills over them aft; Britannic has the same 15
at deck height.

## Level 2b: breakup, power, descent

### Breaking in two (`breakup.ts`)

Each plunge step sets `strain = |pitch| x (length / REF_LENGTH)^2`
(`REF_LENGTH` 60, the liner). At the start of the next step, if the strain has
reached `strengthFor(breakMode)` she breaks:

- `real` (also when `breakMode` is absent): `HULL_STRENGTH` 0.3. The plunge
  only reaches `PLUNGE_PITCH` (-0.35), so hulls shorter than about 56 cells
  can never break; a 60-cell liner breaks at about 17 degrees.
- `always`: the strain at `ALWAYS_BREAK_PITCH` (0.21 rad, 12 degrees), so any
  ship breaks once she tips that far.
- `never`: `Infinity`; the plunge is exactly Level 2's.

Where: at the wall nearest the point where her main deck (`DECK_HEIGHT` 1.2
above the keel line, the scene's `DECK_Y`) meets the sea in the pose she
breaks from (`deckWaterlineX`); with no walls, at that point itself. Clamped
to `BREAK_MIN_FRACTION`..`BREAK_MAX_FRACTION` (0.35..0.7) of her length. So
the crack opens at the surface, where the player can see it. The break step logs `broke`, sets `breakup = { at, atX, angle }` and
`halves`, puts the lights out if they were not already, and sets `strain` back
to 0. `pose` then stays where she broke.

### Two bodies

A `HalfPose` rotates its half about a pivot on the keel line at `pivotX`
(cells from the bow, `atX` for both halves), then moves it `driftX` toward the
bow and `sink` down: `T(driftX, -sink, 0) T(px, 0, 0) R(roll, 0, pitch)
T(-px, 0, 0)` with `px = length / 2 - pivotX`. Both halves start from the
whole ship's pose of the step before the break: pitch and roll unchanged,
`driftX = px (cos pitch - 1)`, `sink = pose.sink - px sin pitch`, so nothing
jumps (exact for zero roll; the plunge has damped her roll to a few
thousandths by then).

A half's pitch lifts its own bow end, so:

- Bow: eases to `BOW_FINAL_PITCH` (-1.05, about 60 degrees bow down) and sinks
  at up to 4 units/s. It waits with its deepest point no lower than
  `BOW_HOLD_DEPTH` (40), above the floor, flattening a long bow if needed.
- Stern: for `STERN_SETTLE_S` (1.8 s) it eases back to level and bobs up to a
  1-unit draft; over `STERN_RISE_S` (2.4 s) it rears to `STERN_FINAL_PITCH`
  (-1.4: the broken end down, the stern about 80 degrees up); it hangs for
  `STERN_HANG_S` (1.4 s), sinking slowly; then it slides straight down,
  speeding up (4 units/s each second) to 10 units/s.
- `sunk` (and `done`) once the stern has played its whole part and both
  halves' highest points are `HALF_UNDER_DEPTH` (2) under.

The stern sequence is short in sim seconds because the scene plays the break
in slow motion.

### Lights (`power.ts`)

`power` goes `on` -> `flickering` -> `out`, never back, logging
`power-flicker` and `power-out` once each (both, in order, if they happen in
one step).

- Flickering: the flooded fraction reaches `FLICKER_FLOODED` (0.2), or the
  compartment holding the middle of the hull (the engine room) has more than
  `FLOODED_WATER`. Checked while flooding and while plunging, so every sinking
  flickers first.
- Out: while plunging, once the strain reaches `POWER_OUT_STRAIN` (0.85) of
  her strength (a moment before the break) or her sink reaches a third of
  `PLUNGE_DEPTH`, whichever comes first.

Waves trials never touch the lights.

### The way down (`descent.ts`)

`startDescent` turns a finished `sank` state into `descending`; `stepTrial`
then runs `stepDescent`. Each body (the whole `pose`, or each half) falls at
up to `DESCENT_SPEED` (4 units/s, reached over 1 s) toward `FLOOR_DEPTH` (45).
Its pitch turns toward `REST_PITCH_BOW` (-0.25, nose dug in; whole ship and
bow) or `REST_PITCH_STERN` (0.1), and its roll toward a `REST_ROLL` (0.08)
list, spread over the time it has left to fall. A body touches down (one
`touched-bottom` each) when its deepest keel point reaches the floor, then
stays on the sand while it finishes turning. Phase `done` once every body has
landed and settled, or `SETTLE_S` (1.5 s) after the last touchdown.

### Tuning table (enforced by `__tests__/breakup.test.ts`)

Calm sea. The smallest template, the coast guard cutter, keeps the water out
wherever she is struck, so she sails without her walls here (as do the
Ever Given and Arleigh Burke rows).

| ship (length)                     | hit  | mode   | breaks |
| --------------------------------- | ---- | ------ | ------ |
| Titanic (60)                      | x=5  | real   | yes    |
| Titanic (60)                      | x=5  | always | yes    |
| Titanic (60)                      | x=5  | never  | no     |
| Titanic (60)                      | x=55 | real   | no     |
| Ever Given, no walls (60)         | x=5  | real   | yes    |
| Lusitania (54)                    | x=49 | real   | no     |
| Lusitania (54)                    | x=49 | always | yes    |
| Arleigh Burke, no walls (42)      | x=5  | real   | no     |
| Coast guard cutter, no walls (24) | x=5  | real   | no     |
| Coast guard cutter, no walls (24) | x=5  | always | yes    |
| Coast guard cutter, no walls (24) | x=5  | never  | no     |

The Titanic struck at the stern starts her plunge stern-down and is not yet
steep enough by the time she is under, so she holds together.

Timings for the Titanic struck at x=5 (`real`, sim seconds): flooding 1.5,
lights flicker 11.6, lights out 24.6, breaks 25.1 (17 degrees, at wall 13,
x=39, where her deck meets the sea at about x=38), sunk 33.7; followed down,
the halves land 5.5 s and 7.6 s after `startDescent`. In `never` mode she is sunk at 28.5.
