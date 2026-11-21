# Shipwreck simulation

A physical, deterministic model of a ship sinking: hydrostatics from the
hull's own offsets, water through the holes by the orifice law, over the
bulkhead tops by the weir law, down through the decks once the sea is over
them, a hull girder that breaks where its bending moment beats its strength,
two bodies after the break, a dynamic plunge, and the fall to the sea floor.
Pure TypeScript (no React, no three.js, no `Math.random`): the same ship and
openings always give the same track. Historical events that are not physics
(steam, rockets, lifeboats) come from the ship's data at their clock times
while she is afloat and in one piece.

## Units and frames

- SI throughout: metres, seconds, kilograms (tonnes only in `waterAboardT`
  and `ShipSpec.displacementT`), newton-metres, radians in poses.
- **Ship frame:** origin on the keel at midships (half of LBP), `x` forward,
  `y` to port, `z` up.
- **Earth frame:** `z = 0` the still sea, `z` up, `x` along her heading,
  `y` to port. A `BodyPose` is the earth position of the body's ship-frame
  origin plus angles; ship to earth is `Rz(yaw)·Ry(pitch)·Rx(roll)`.
  `pitch` + is bow down, `roll` + lifts the port side (a list to starboard),
  so a port list is a negative `listDeg`. Yaw is 0 while afloat; the stern
  spins on the way down.
- **Time:** `t` is shown seconds after the collision (11:40 PM). Once every
  part is under, the way down plays `DESCENT_TIME_SCALE` (6) times faster:
  each frame also carries `realT`, the real time, so the UI can say how long
  the fall really took.

## Files

| File              | What                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `geometry.ts`     | The hull resampled to 128 stations × 14 offsets (any two sections blend vertex by vertex); slices between two x (sections clipped there); superstructure boxes.          |
| `hydrostatics.ts` | Volume, centre and cut of a slice under any plane: each section polygon clipped (Sutherland–Hodgman), shoelace, trapezoid along x, intervals the plane crosses split 8×. |
| `mass.ts`         | The lightship as mass per station: hull steel by section area, superstructure by its boxes, machinery, coal and cargo by compartment kind, tilted to `lcg`.              |
| `flooding.ts`     | Cells (compartments, part-compartments after the break, boxes): level solve, orifice inflow, weir spill, downflooding, burst vents, flow caps.                           |
| `body.ts`         | Rigid-body motion (heave/surge of G, pitch, roll), strip-theory added mass, linear + quadratic damping, implicit; the flows and pumps applied each step.                 |
| `girder.ts`       | Shear and bending moment along the length; strength profile.                                                                                                             |
| `descent.ts`      | The fall (drag, glide, tumble), the bow ploughing in, the stern landing.                                                                                                 |
| `events.ts`       | The closed `SimEventKind` set and event thresholds.                                                                                                                      |
| `track.ts`        | `SimTrack`, `SimFrame`, `BodyPose`; `sampleTrack` and `eventsBetween`.                                                                                                   |
| `run.ts`          | `simulate`, `createSimRunner` (`advance(budgetMs)` for the UI), `whatIfOpenings`, the story's watchers.                                                                  |
| `constants.ts`    | Physical constants and every tuned parameter.                                                                                                                            |

`scripts/shipwreck-sim.ts` prints a run's timeline:
`npx tsx scripts/shipwreck-sim.ts` (the real night),
`npx tsx scripts/shipwreck-sim.ts hold1 br4` or `--first=5` (What if), add
`--water` for each compartment's fill every 10 minutes.

## The model

**Hydrostatics.** For a body at (heave, pitch, roll) the sea plane in the ship
frame is `n·p + heave < 0`, `n` the earth's up. Every cell's envelope is
clipped section by section and integrated: volume, centre of buoyancy, and
the cut (chord integrals give the waterplane area and its inertias). Where
the plane crosses the length between two stations (a steep pitch, sections
going wholly in or out), the interval is split into 8 blended sub-sections,
so volume stays smooth to 90°; a box hull matches the analytic answers level,
trimmed, heeled, at 60° and at 90° (`hydrostatics.test.ts`).

**Flooding.** Each cell holds water whose surface is a level earth plane:
volume(level) = water / permeability, solved by Newton on the free-surface
area with a bracketed secant/bisection fallback. Water moves by:

- openings: `q = Cd·A·√(2g·Δh)`, `Cd = 0.6`, each opening in 4 strips, `Δh`
  the sea's head less the water's inside (outflow allowed);
- spill over a bulkhead top into the neighbour: `q = Cw·b·h^1.5`, Villemonte's
  drowned-weir factor once the far side is over the top too, `b` the breadth
  at the top times `SPILL_BREADTH`;
- downflooding: every deck-edge point (C deck, the sheer) under the sea lets
  water in through `DOWNFLOOD_M2_PER_M` of open area per metre of edge;
  superstructure boxes fill the same way over their lower edge
  (`BOX_FLOOD_M2_PER_M`) and are buoyant only while they are still dry;
- burst vents: once a cell's deck edge is 20 m under, its vents, skylights
  and hatch covers give way (3 m² more), so no air stays trapped deep down;
- pumps: 0.45 m³/s from the aftmost wet machinery space while the lights
  are on and the water there is under 3 m deep;
- each flow is capped so one step can only half-close the level difference it
  drives (no overshoot at a fixed step).

**Motion.** Weight (lightship + water) acts at G, buoyancy at B; G moves
under the net vertical force and drag, the hull turns about G (pitch and
roll). Added mass and pitch inertia are strip theory (0.7 × ρπs²/8 per metre
of submerged breadth s); damping is linear (a fraction of critical from the
waterplane's own stiffness) plus quadratic drag at every station; both are
applied implicitly. Fixed steps: `SIM_STEP_S` 1 s while slow, `FAST_STEP_S`
0.1 s once the lights flicker, the trim passes 8°, the pitch rate climbs or
she breaks (frames follow: 1 s then 0.1 s). Water in the superstructure is
not allowed to run across the ship (cabins and corridors cut it up); water in
the hull is.

**Girder and breakup.** Load per station = buoyancy − (lightship + water) ×
(g + the station's own acceleration), normal to the hull's axis; shear is its
running sum, the bending moment the running integral, with a linear closure
correction. Strength is `girder.hogMaxNm` / `sagMaxNm` over the middle half,
falling to 30% at the ends, and 0.85 of that over the engine spaces (their
casings cut through every deck). The hull breaks at the station where
moment/strength first reaches 1; a bulkhead within 2.5 m takes the break.
Then there are two bodies, `stern` and `bow`, each with its own cells (the
compartment at the break split by x, its water split by the level), its own
lightship slice and the whole ship's motion at that moment. The broken face
is open to the sea (40% of the section), and the hull is torn for 25 m either
side: each cell with an end within 25 m gets an opening there, the nearer the
larger. The bow plunges; the stern settles back, floods, rises nearly
vertical and goes.

**The way down.** A body whose highest point is under the sea is flooded: it
falls under its lightship weight less what its steel displaces
(`STEEL_BUOYANCY` 0.2), against drag on the area it shows the flow, carrying
its water. The bow keeps its nose down (40°) and glides forward (0.16 m per
m down: the wreck's bow lies about 600 m from the stern); the stern tumbles
slowly toward level and spins. Every turn of the fall is about the body's
own centre of mass (the flooded hull's), as afloat: the origin is placed to
match, so nothing circles an empty point. At the floor the first point to
touch (the stem, for the bow) is held where it went in while its plough
depth eases in over a couple of seconds (15 m for the bow, 4 m for the
stern; `PLOUGH_TIME_S` 5 s real, about 0.8 s on screen at the ×6 descent); the rest of the body turns about that
point and comes down. The bow settles upright with a slight bow-down rest
(its after end bedded 3 m), the stern level. Terminal speeds come out about
13 m/s (bow) and 10 m/s (stern). The run ends when every part rests, or at
6:00 AM (`t = 22800`) if any part still floats. Each floating body freezes
once it has stopped moving and taking water for 5 minutes (after a break,
each half on its own); when every part is frozen or on the floor the run
logs `floating-steady` and holds its pose to 6:00 AM at one frame a
second.

**Events.** `forecastle-under`: the deck of the foremost superstructure box
(the forecastle), at its middle, reaches the sea. `bridge-under`: the boat
deck at the forward end of the longest box (the bridge). `funnel-falls`:
the sea reaches the funnel's base (the wave up the boat deck), or its part
leans past its stays (22° for the forward funnel, 6° more for each one
aft); on the real night funnel 0 goes just before the break, the rest
after it, one by one. `lights-flicker`: trim 10° or a funnel down;
`lights-out`: the breakup, or 4 m of water in the aftmost engine space (the
dynamos).

`bow-under` fires once, the first of: every compartment of the whole hull
forward of midships under the sea (before a break: the bow has gone from
view; on the real night 31 s before the break), or the bow body wholly under
after a break (if the first never fired). `stern-under` fires when the last
of her goes under (`sankAtT`). `bow-lands` / `stern-lands` when each half
touches the floor; a hull that sinks in one piece logs both at the same
moment. Every event carries `t` (shown) and `realT` (real) seconds after the
collision. Scripted events fire only while she is afloat and whole;
`last-boat` follows the last `boat-lowered`.

**Lights.** `power` is 1, then from `lights-flicker` a fixed pattern of dips
(a hash of the time, ten frames a second), then 0.

## API notes

- A track always has at least one frame (the ship at t = 0, a placeholder
  until she has settled); `sampleTrack` throws on a track with none.
- `sampleTrack(track, t)`: binary search; a frame's own time returns that
  frame, before the first or after the last returns those; otherwise
  positions, water and HUD values are lerped and angles turned the short way.
  At the break (one body to two) it returns the nearer frame's bodies.
- `eventsBetween(track, t0, t1)`: events with `t0 < t ≤ t1`, so
  consecutive windows see each event exactly once (`(-1, 0]` has the
  collision).
- `trimDeg` / `listDeg` are the whole ship's, after the break the stern's.
- `createSimRunner(spec, openings).advance(budgetMs)` builds the ship on the
  first call and then steps until the budget is spent, checked after every
  step, so a call can run one step (at most about 0.5 ms here) past it. For
  a hard 8 ms ceiling per frame the UI passes 6. `track()` is the track so
  far (live arrays; `outcome` is only meaningful once `done`).
- `SimOptions.probe` (tools and calibration only) is called after every step
  with the bodies and the girder's state; `scripts/shipwreck-sim.ts` does
  not need it.
- `ShipSpec` additions beyond the brief, both optional physical data:
  `Compartment.permeability` (default by kind, below) and `ShipSpec.tcg`
  (transverse centre of mass, + to port).

## Titanic's data and sources

- Particulars: LBP 850 ft (259.08 m), LOA 269.1 m, beam 92 ft 6 in
  (28.19 m), depth to C deck 64 ft 6 in (19.66 m).
- The night's condition (S. Halpern, "A Matter of Stability and Trim", after
  Wilding): mean draught 32 ft 3 in (9.83 m), 48,300 long tons (49,075 t);
  the load condition was 34 ft 7 in, 52,310 tons. GM 2 ft 7.5 in (0.80 m,
  Hackett & Bedford 1996 from Olympic's inclining), so KG = this hull's KM
  (11.58 m) − 0.80 = 10.78 m (Halpern: KM 11.68 m, KG 10.88 m).
- Hull form: generated in `titanic.ts` (parallel middle body x −62…+55 m,
  hollow fine ends, flare, a 4.4 m bilge radius, plumb stem, counter stern
  overhanging 9 m) and fitted to Halpern's figures: at 9.83 m it displaces
  49,124 t (+0.1%), waterplane 5,564 m² (Halpern 5,564), LCF −3.2 m (−3.05),
  KB 5.26 m (5.32), BM 6.32 m (6.36); Cb 0.674 at the load draught (H&W's
  0.684 is on slightly different dimensions).
- Subdivision (British Wreck Commissioner's report, compartment table, feet
  from the forward perpendicular): A 46, B 91, C 142, D 193, E 247, F 304,
  G 361, H 418, J 478, K 514, L 583, M 640, N 703, O 757, P 814. Bulkhead A
  to C deck, B to D, C–J to E, K–P to D (the report; the spec's sketch had A
  to D). Deck heights: Halpern (F deck 36 ft 9 in), the report (D–C 10 ft
  6 in, boat deck 92 ft 6 in), the usual 9 ft spacings; sheer 3.4 m forward
  and 1.2 m aft at C deck (E deck meets the stem about 58 ft up), a little
  more on D and E.
- Superstructure (the report): forecastle 125 ft and poop 105 ft on B deck,
  bridge deck 550 ft with 50 ft wells, the boat and A decks 500 ft from the
  bridge, 190 ft from the bow. Funnels about 34.7 m apart from x = +54 m
  (over boiler rooms 6/5) to −50 m (the dummy, over the turbine room).
- Damage: 1.15 m² (12.4 ft²: Wilding's 12 ft², the 1996 sonar survey's six
  thin openings), 1.5–7 m above the keel along the starboard bow from the
  front peak to boiler room 5's forward bunker. The split between
  compartments is an estimate that fits how fast each one filled.
- Rockets every 7 minutes from 12:45 AM; 20 boats from Boat 7 at 12:45 to
  Collapsible A at 2:05 (A and B actually floated off; they close the
  list); steam venting 11:50 PM to 12:30 AM.

## Calibration

Everything tuned is a physical quantity; no timing is scripted.

| Parameter              | Value                                                                                     | Why                                                                                                                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Opening areas, heights | 1.15 m², 1.5–7 m                                                                          | Inside the documented 1.1–1.2 m² and the spec's 1–7 m band.                                                                                                                                                                                                  |
| Permeability           | peak 0.95, hold 0.75, boiler 0.8, engine 0.85, shaft 0.8, stern 0.95; superstructure 0.95 | Boilers, coal, cargo and machinery fill part of each space (SOLAS-style values). Without it she settled about an hour early: empty compartments take more water before they reach the sea's level.                                                           |
| Pumps                  | 0.45 m³/s, under 3 m                                                                      | Titanic's five 250 t/h ballast and three 150 t/h bilge pumps. They hold boiler room 5's small leak, as they did that night, until boiler room 6 spills into it.                                                                                              |
| Spill breadth          | 0.1 of the beam, Cw 1.0                                                                   | Water reached the next room along passages and stairs (Scotland Road), not over the whole width of E deck.                                                                                                                                                   |
| Downflooding           | 0.02 m²/m of deck edge; boxes 0.035                                                       | Hatches, stairways, doors and portholes; sets how fast the last 20 minutes go.                                                                                                                                                                               |
| Burst vents            | 20 m, 3 m²                                                                                | Air does not stay trapped deep down; keeps any What-if from leaving a hull hanging vertical.                                                                                                                                                                 |
| Girder strength        | hog 4.9 GN·m, sag 4.5 GN·m                                                                | Of the order of a 1911 riveted section (about 18 m³ of section modulus at about 250 MPa). The real night's peak moment clears it by more than 5%: ±5% strength still breaks inside 2:05–2:25.                                                                |
| Engine casing factor   | 0.85                                                                                      | The casings over the engines cut through every deck. The moment is nearly flat from x −30 to −5 m late in the night; this puts the break at the engine room's forward bulkhead (K), between funnels 3 and 4, where she broke, instead of over boiler room 2. |
| Torn zone at the break | 25 m, 40% of the section                                                                  | The fracture tore shell, decks and bulkheads either side. Without it the bow floated vertically for hours on air in its dry after boiler rooms.                                                                                                              |
| TCG                    | 0.02 m to port                                                                            | Coal drawn unevenly and stores: enough to pick a side when flooding takes her stability away (she leaned to port). The damage is to starboard but the water inside lies level, so it gives no starboard list.                                                |
| Damping                | heave and pitch 0.5, roll 0.15 of critical, Cd 1.0                                        | Strong, as the brief asks; the slow phases are effectively quasi-static.                                                                                                                                                                                     |

## Pass criteria (enforced by `__tests__/`)

| Criterion                                           | Result                                              |
| --------------------------------------------------- | --------------------------------------------------- |
| Undamaged: floats at her draught ±0.1 m, trim ±0.2° | 9.82 m, trim 0.00° (list 1.4° to port from the TCG) |
| Displacement within 3%, GM 0.6–2.5 m                | +0.1%, GM 0.80 m                                    |
| Breakup 2:05–2:25 AM                                | 2:14:01 AM (±5% strength: 2:12:06, 2:15:51)         |
| Break 35–45% of LBP from the stern, funnels 3–4     | x = −27.1 m, 39.5%                                  |
| Trim at the break 8°–25°                            | 10.8°                                               |
| Stern under 2:10–2:30 AM                            | 2:15:52 AM                                          |
| List under 10° before the break                     | at most 1.5° (to port)                              |
| What if 1–4 forward (every subset): afloat, whole   | all 15 float, steady by 12:30 AM                    |
| What if 5 forward: later than the real night        | sinks 2:52:48 AM (breaks 2:50:58)                   |
| What if 7 forward: sooner                           | sinks 1:12:23 AM                                    |
| Every single compartment, first 1–8, mixed sets     | float steady, or sink with every part on the floor  |
| Deterministic                                       | two runs deep-equal                                 |
| Whole real night `simulate`                         | about 0.8–1.2 s (test allows 3 s and logs it)       |
| `advance(8)`                                        | slowest call about 8.5 ms                           |

## Known limits

- The list stays small (about 1–1.5° to port all night); her real list
  reached several degrees late on. In this model flooding to the sea's level
  does not take away enough stability to make her loll.
- Surge and sway are only G's own motion and a 0.02 m/s drift; no yaw while
  afloat; no waves.
- After the break the two halves do not touch each other.
