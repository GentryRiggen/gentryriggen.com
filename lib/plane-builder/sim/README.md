# Plane Builder flight sim

A pure, deterministic flight model. No `Math.random`, no `Date.now`, no
React or three.js. The same level, stats, aim and stick inputs always give the
same state, which is what lets the balance pilot and the tests trust it.

## Coordinates

- `x` is forward, toward the finish, and is 0 at the slingshot.
- `y` is up. `z` is sideways; the corridor is `|z| <= corridorHalfWidth`.
- `heading` 0 flies along +x; positive turns toward +z.
- `pitch` is the flight-path angle, up positive.

## Fixed step

`step` advances exactly `STEP` (1/60 s). The scene runs as many steps as the
real frame time needs, so frame rate never changes the result. It plays
flights `GAME_SPEED` times faster than real time; sim seconds (and the balance
numbers) are unaffected.

## Model

- **Lift:** the elevator asks for the lift needed to chase the target pitch,
  but lift is capped at `lift x v^2 x LIFT_HEADROOM` (0.45). A slow plane
  cannot make enough lift, so the nose drops and it comes down within about
  15 s, even with the best wings.
- **Thin air:** climbing fades out over `CEILING_FADE` metres below
  `CEILING` (height above the ground), and above it the plane noses down to
  glide back, unless it is over a hard obstacle (so a shield bounce clears the
  box). The elevator can push down as hard as it can pull up, so even a fast
  climb levels off near the ceiling.
- **Swoop:** out of fuel, a hard dive (stick past `SWOOP_STICK` down) cuts
  drag to `SWOOP_DRAG`, and a hard pull-up multiplies lift by `SWOOP_LIFT`, so
  a dive then pull-up glides a little further than hands-off (about +25% for
  an early plane, less for a strong one). Gentle steering and hands-off
  gliding are unchanged.
- **Energy trade:** gravity acts along the flight path, so climbing costs
  speed and diving gains it. Drag is `drag x v^2`.
- **Engine:** thrust runs while there is fuel. Boost doubles thrust and burns
  fuel 3x faster.
- **Boost rings:** flying through a ring adds `RING_BOOST` m/s (capped at
  `MAX_SPEED`) on top of its coins.
- **Fuel cans:** planes with an engine collect a can they fly near and refill
  `FUEL_CAN_SECONDS` of fuel (never past full), the same for every tank size,
  so a big tank can't refill as fast as it burns. Gliders ignore them.
- **Milestones:** crossing 25%, 50% and 75% of the finish distance fires one
  `milestone` event each, once per flight (based on the furthest point reached,
  so a bounce back never repeats one).
- **Steering:** the stick sets a bank angle, and bank turns the heading. With
  no input the plane levels out, and holds the launch angle for `LAUNCH_HOLD`.
- **Corridor wind:** past the edge, a crosswind turns the heading back toward
  the middle and nudges the plane in.

## Ending a flight

- **Landing vs crash:** touching down shallower than `LAND_ANGLE` (-0.9 rad,
  about 52 degrees, so a dead-stick glide still lands) and slower than
  `LAND_SPEED` (55 m/s) slides to a stop and lands. Steeper or faster is a hard
  hit, the same as hitting a hard obstacle.
- **Shields and grace:** a hard hit spends a shield (bounce, slow down) and
  starts `SHIELD_GRACE` seconds in which further hard hits are ignored. With no
  shield left it is a crash. A shield spent on an obstacle lifts the plane
  clear over that box (so one wide peak costs one shield), and the ground
  always keeps the plane above it, even during grace. Obstacles also count
  while sliding. Soft obstacles slow the plane once each and never
  end the flight.
- **Finish and runout:** `finish` fires once when `maxX` crosses
  `finishDistance`. The flight ends as `runout` at `finishDistance + RUNOUT`.
- **Stall stop:** under `STALL_PROGRESS` metres of new `maxX` for
  `STALL_WINDOW` seconds ends the flight as `stalled`. `MAX_FLIGHT_TIME` is a
  final safety net.

## State

`step` mutates the `FlightState` it is given and returns the events that
happened. The scene only reads that state; it never writes to it.
