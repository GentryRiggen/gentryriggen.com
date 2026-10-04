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
- Sinking: once the flooded fraction reaches `RESERVE` (0.2) the outcome is
  `sank`, the phase becomes `sinking` and `stepPlunge` takes her bow-first to
  a pitch of `PLUNGE_PITCH` and down to `PLUNGE_DEPTH`; the `sunk` event ends
  the trial.
- Afloat: when inflow and spill both fall under `SETTLED_EPS` (checked each
  step, not over a window, because `SimState` has no slot for a settle
  clock), or `ICEBERG_MAX_S` (90 s) after impact with the flooded fraction under
  `RESERVE`, the outcome is `afloat`. A settled ship has draft under 1.5 and
  `|pitch|` under 0.12.

`reason`: `no-bulkheads` when the hull has no walls, otherwise `spilled` if a
`spilled` event happened before she sank, else `too-many-opened`; `held` when
she stays afloat.

Story time: `STORY_MINUTES_PER_SIM_SECOND` is 5, counted from impact
(`storyMinutesSinceImpact`), so the Titanic (about 31.75 sim seconds after the
strike) sinks in 159 story minutes.

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
