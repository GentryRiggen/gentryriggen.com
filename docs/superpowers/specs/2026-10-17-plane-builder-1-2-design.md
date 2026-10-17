# Plane Builder 1.2 — More to do in every flight

**Date:** 2026-10-17
**Status:** Draft

A game-design pass on Plane Builder 1.1. Keep the long upgrade grind, give the
player more to do in every flight, and end the long, empty glide at the end of
a flight.

## Intent

- **Who:** young kids, with a parent nearby.
- **Keep:** the grind. A hands-off, no-skill flight style (the balance pilot)
  still takes 22–40 flights to finish each level.
- **Change:** each flight has things to chase (boost rings, fuel cans,
  updrafts, milestone flags), and good flying (chasing them, landing well)
  finishes a level sooner than the balance pilot.
- **Fix:** once the fuel is gone, the plane drifts down at stall speed for
  20–35 sim seconds. That tail should be short and still end in a landing.
- **Constraints:** saves keep working (no save-version bump), the sim stays
  deterministic, and the ship-builder code is untouched.
- **Out of scope:** new upgrade tracks, a new level, upgrade recommendations,
  and save-format changes.

## 1. Shorter glide, forgiving landings

- Lower `LIFT_HEADROOM` from 1.5 (start at 1.1 and tune). That raises the
  stall speed and lowers the best glide ratio, so an unpowered plane comes down
  sooner and a little faster.
- Widen the landing window so the steeper glide still lands: `LAND_ANGLE` goes
  from -0.35 to -0.55 (tune), and `LAND_SPEED` stays 45 unless the tests need
  more.
- **Target, as a new balance test:** for every level and every uniform tier set
  (0, 2, 4, 6, 8), a plane at the ceiling with no fuel, flying hands-off, takes
  at most 15 sim seconds to touch down, and touches down as `landed`, not
  `crash`, over flat ground.
- Re-tune the level catalogs (prices, ladders) so the existing balance tests
  pass with their current ranges.

## 2. More to do in the air

### Boost rings

- Flying through a ring adds `RING_BOOST` (8 m/s, tune) to the speed, capped at
  `MAX_SPEED`, on top of its `RING_COINS`. The `ring` event is unchanged.
- **Ring chains:** the generator places a chain of 3–5 rings every `ringEvery`
  metres, 40 m apart along x. Each chain follows one gentle curve: z and the
  height above ground each drift by up to 8 m between rings, staying inside the
  corridor and 12–40 m above the ground.
- The `Ring` type is unchanged; chains are only a placement pattern.

### Fuel cans

- New `LevelDef.fuelCans: Vec3[]`, placed every `fuelEvery` metres (a new
  `LevelSpec` field) at 15–40 m above the ground, from x = 300.
- Pickup radius `FUEL_CAN_RADIUS` (3 m). Taking one adds `FUEL_CAN_SHARE` (25%)
  of the tank, capped at the full tank.
- They only exist for a plane with an engine: when `stats.thrust` is 0 the sim
  ignores them and the scene does not draw them.
- New `FlightState.canTaken: Uint8Array` and a new event
  `{ type: "fuel"; index: number }`.

### Updrafts everywhere, and visible

- **Meadow:** three warm-air updrafts (lift 2.5 m/s, 80 m long), at about 30%,
  55% and 80% of the way.
- **Canyon:** keep its three updrafts.
- **Mountains:** keep the crosswinds, and add one updraft (lift 3 m/s, 150 m
  long) just before the pass at 5,300 m.
- A new `Winds` scene component draws every wind zone:
  - **Lift zones:** translucent rising streaks.
  - **Push zones:** streaks drifting sideways in the push direction.
  - It uses one instanced mesh per kind, animated in `useFrame`, with colours
    from the level palette.

### The balance pilot

- Stays passive. It never steers for rings or cans, so the hands-off pace (and
  the grind) is unchanged, and skill is a bonus on top. It still collects what
  it happens to fly through.

## 3. Rewards for flying well

### Milestone flags

- Milestones sit at 25%, 50% and 75% of `finishDistance` (`MILESTONES` in
  `economy/payout.ts`).
- **In flight:** the sim emits `{ type: "milestone"; share: number }` once per
  flight when `maxX` first crosses each one.
- **Bonus:** paid only the first time a milestone is ever passed, worked out
  from the previous best: a milestone at distance `m` pays when
  `previousBest < m <= result.distance`. Each one pays
  `round(finishDistance × payPerMeter × MILESTONE_SHARE)` with
  `MILESTONE_SHARE = 0.1` (tune). No save change is needed.
- **In the world:** a flag pole beside the corridor at each milestone, with a
  canvas-texture flag reading "25%", "Halfway!" or "75%" (the same no-font
  approach as the finish banner).

### Landing bonus

- A flight ending `landed` earns `LANDING_BONUS = 0.25` × `distancePay` extra.

### Payout

- `payout(level, result, multiplier, previousBest)` returns
  `{ distancePay, coinPay, landingBonus, milestoneBonus, multiplier, total }`,
  with `total = max(minPayout, round((distancePay + coinPay + landingBonus +
milestoneBonus) × multiplier))`.
- The store and the balance pilot pass `previousBest`.
- **Results card:** adds "Nice landing +N" and "Milestone flags +N" lines when
  they are non-zero.

## 4. Level design

### Set pieces

- A new `LevelSpec.setPieces` holds hand-placed obstacles, rings and fuel cans,
  added after generation. Each set piece also has a clear window `[fromX, toX]`
  where generated hard obstacles are not placed.
- **Meadow (finish 2,000 m):**
  - **Barn gate, 1,000 m:** two barns at z = ±18, with a 3-ring chain through
    the gap 12 m up.
  - **Balloon arch, 1,500 m:** soft balloons in an arch across the corridor,
    with a ring chain over the top.
- **Canyon (finish 4,000 m):**
  - **Arch gauntlet, 1,950–2,250 m:** four arches alternating sides, with a
    ring chain threading through them.
  - **Updraft climb, 3,000 m:** an updraft with a rising ring chain.
- **Mountains (finish 6,000 m):**
  - **Twin peaks, 3,000 m:** two peaks with a 40 m gap and a ring chain through
    it.
  - **Before the pass, 5,300 m:** the new updraft, plus a fuel can.

### Difficulty ramp

- A new optional `FeatureSpec.ramp: true` scales a feature's spacing from 1.5×
  `every` at the start to 0.75× at the end, so the early level is gentle.
- On by default for hard features. Soft features keep even spacing.

### Distance signs

- Render-only: a small sign every 500 m beside the corridor ("500 m",
  "1000 m", ...), skipping the milestone and finish positions. It uses a
  canvas texture.

## 5. Flight feedback

- Short HUD pop-ups (about 1.2 s, top-centre, `aria-hidden`, with a polite
  live-region line for screen readers):
  - "Boost!" on a ring
  - "+Fuel" on a fuel can
  - "25%!", "Halfway!" or "75%!" on a milestone
- **Sounds:** new synth cues `fuel` and `flag`. Boost rings keep the `ring` cue.
- The HUD reads the pop-up events from a small store fed by `onEvents`, not
  from the sim state.

## Release

- Plane Builder 1.2.0, with a changelog entry in plain words.
- Update the sim `README.md`.

## Testing

- **Sim unit tests:**
  - A ring adds speed.
  - A fuel can adds 25% of the tank (capped), and is ignored with no engine.
  - The `milestone` event fires once per milestone per flight.
  - A steep-ish glide touchdown lands.
- **Level tests:**
  - Ring chains stay in the corridor and 12–40 m up.
  - Set-piece windows have no generated hard obstacles.
  - The ramp spaces hard obstacles wider at the start than at the end.
  - Fuel cans exist from 300 m.
- **Economy tests:**
  - Each milestone bonus is paid once, only for newly passed milestones.
  - The landing bonus is paid only for `landed`.
- **Balance tests:**
  - The existing suite still passes: 22–40 flights, dry-flight streaks, the
    starter plane under 10%, no flight over 90 s, and a maxed plane reaches the
    runout.
  - Plus the new glide-tail test.
- **UI tests:**
  - The results card shows the new lines.
  - HUD pop-ups appear for each event.
- **E2E:** the existing Plane Builder spec still passes.
