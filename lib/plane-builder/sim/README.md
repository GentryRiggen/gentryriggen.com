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
real frame time needs, so frame rate never changes the result.

## Model

- **Lift:** the elevator asks for the lift needed to chase the target pitch,
  but lift is capped at `lift x v^2 x LIFT_HEADROOM`. A slow plane cannot make
  enough lift, so the nose drops and it sinks gently.
- **Energy trade:** gravity acts along the flight path, so climbing costs
  speed and diving gains it. Drag is `drag x v^2`.
- **Engine:** thrust runs while there is fuel. Boost doubles thrust and burns
  fuel 3x faster.
- **Steering:** the stick sets a bank angle, and bank turns the heading. With
  no input the plane levels out, and holds the launch angle for `LAUNCH_HOLD`.
- **Corridor wind:** past the edge, a crosswind turns the heading back toward
  the middle and nudges the plane in.

## Ending a flight

- **Landing vs crash:** touching down shallower than `LAND_ANGLE` and slower
  than `LAND_SPEED` slides to a stop and lands. Steeper or faster is a hard
  hit, the same as hitting a hard obstacle.
- **Shields and grace:** a hard hit spends a shield (bounce, slow down) and
  starts `SHIELD_GRACE` seconds in which further hard hits are ignored. With no
  shield left it is a crash. Soft obstacles slow the plane once each and never
  end the flight.
- **Finish and runout:** `finish` fires once when `maxX` crosses
  `finishDistance`. The flight ends as `runout` at `finishDistance + RUNOUT`.
- **Stall stop:** under `STALL_PROGRESS` metres of new `maxX` for
  `STALL_WINDOW` seconds ends the flight as `stalled`. `MAX_FLIGHT_TIME` is a
  final safety net.

## State

`step` mutates the `FlightState` it is given and returns the events that
happened. The scene only reads that state; it never writes to it.
