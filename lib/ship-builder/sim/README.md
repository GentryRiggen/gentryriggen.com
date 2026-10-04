# Ship simulation

A small, deterministic, fixed-step model of how a ship behaves at sea. Pure
TypeScript (no React, no three.js, no `Math.random`): the 3D scene only reads
the `SimPose` it produces. Every run of the same ship in the same sea is
identical.

- `types.ts`: the contract (state, pose, input, events, reserved slots).
- `seaTrial.ts`: `createTrial`, `stepTrial` (one `SIM_STEP_S` step, returns a
  new state), `runTrial` (headless, for tests).
- `simShip.ts`: `simShipFromStats(stats, beam)`.
- `explain.ts`: `explainTrial(state, ship, sea)` for the result card.

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
