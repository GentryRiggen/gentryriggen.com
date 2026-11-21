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
| `run.ts`          | `simulate`, `createSimRunner` (`advance(budgetMs)` for the UI), `whatIfOpenings` / `whatIfSpots`, the story's watchers.                                                  |
| `constants.ts`    | Physical constants and every tuned parameter.                                                                                                                            |

`scripts/shipwreck-sim.ts` prints a run's timeline:
`npx tsx scripts/shipwreck-sim.ts` (the real night),
`npx tsx scripts/shipwreck-sim.ts hold1 br4` or `--first=5` (What if), add
`--water` for each compartment's fill every 10 minutes.
`--ship=lusitania` runs her afternoon (a line a minute), `--shut` with
the portholes shut.

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

**Wing cells (1.1).** A compartment with a `span` is only part of each
section: `centre` is |y| ≤ y, `port` y ≥ y, `starboard` y ≤ −y (the
Lusitania's longitudinal coal bunkers beside her boiler rooms). Each
section polygon keeps its 28 vertices with the side's half-breadths clamped
at the bulkhead (`centre`: min(hb, y); a wing: max(hb, y) against y), so
sections still blend vertex by vertex, a wing has no width where the hull
is narrower than its bulkhead, and centre + port + starboard add up to the
whole section exactly (`wingCells.test.ts`, to 0.5%). A spanned slice also
carries its transverse centre (a full wing's water sits off centre, so it
lists her) and its own breadth. Quantities that do not add across a
longitudinal bulkhead (waterplane inertia for roll damping, strip added
mass, the axial front) come from a full-breadth stand-in over every
stretch of spanned cells (`Body.cuts`). The deck edge belongs to the
centre cell (hatches and stairways lead into the main space): it takes the
downflooding at the hull's own deck edges, a wing takes none (its deck
corner still counts toward the burst vents). Spill over a bulkhead top
joins any two cells end to end over the breadth they share at the top.

**Cross flow (1.1).** Cells side by side whose spans meet at a
longitudinal bulkhead exchange water through `crossFlowM2` (coal doors,
leaks), the larger of what either declares, prorated to the length they
share: `q = Cd·A·√(2g·Δh)`, `Δh` the higher surface less the lower one (or
less the doors, if those are higher), both directions, capped like a spill
to half-equalise per step. The doors sit `CROSS_DOOR_Z_M` (1.5 m, the
stokehold plates) over the section's bottom.

**Portholes (1.1).** Each `PortholeRow` is let in as pieces at most
`PORTHOLE_PIECE_M` (5 m) long, each an opening `PORTHOLE_HEIGHT_M` (0.4 m)
tall at the row's height on its side of the hull with `openM2PerM` × its
length of area, in the outermost cell at that x on that side (the wing if
there is one: the scuttles are in its shell). They take the orifice law like
any opening, so a row floods only once the list or trim puts it under, bit
by bit along its length. A row with `followsSheer` rises with the decks:
its `z` is its height at its middle, and at x it is
z + sheerZ(x) − sheerZ(middle) (the Lusitania's rows; the model draws the
same). `SimOptions.portholesOpen: false` leaves them shut.

**Timed openings (1.1).** An opening with `t` opens when the shown time
reaches it (the step from `t` lets water in), into whichever cell holds
that compartment at its x then (after a break too). The second explosion.

**Headway (1.1).** `spec.headway` is a forward speed that decays,
`u = u₀·2^(−t/T½)` over real time, integrated exactly per step
(`u₀T½/ln2 · (2^(−t₀/T½) − 2^(−t₁/T½))`) into the earth x of every body
afloat or falling, until any part first touches the floor; then her way
is gone for good (not again for the halves after a break). It is
kinematic: no
propulsion and no effect on flooding (the same run without it has the same
events at the same times). The Titanic has none.

**The floor while afloat (1.1).** A hull can ground before it sinks (the
Lusitania, 240 m long in 93 m of sea). Every hull vertex of a floating
body below `−seaDepthM` pushes back with a spring and damper per metre of
hull it stands for, `f = k·d − c·u` (`d` its depth into the mud, `u` its
vertical speed), `k = lightship·g / (2·L·FLOOR_SINK_M)` (the whole weight
laid on the whole keel would sink `FLOOR_SINK_M` = 1 m), `c = FLOOR_DAMP_S`
(3 s) × `k`, and drags along the floor with regularised Coulomb friction
(`FLOOR_FRICTION` 0.5, linear below `FLOOR_SLIP_MS` 0.05 m/s). The contact
is applied implicitly to the velocities the step has just found: with
`q = (vx, vz, wp, wr)` and each contact's Jacobians `Jz = (0, 1, −rx,
cos θ·ry)`, `Jx = (1, 0, rz, sin θ·ry)` (r from G, earth),
`(M + dt·Σ[(k·dt + c)·Jz·Jzᵀ + cf·Jx·Jxᵀ]) q' = M·q + dt·Σ k·d·Jz`, M the
hull's axial and normal masses (with added mass) turned to earth plus the
pitch and roll inertias; a contact that would pull is dropped and the
system solved again. So the stem can ground and the hull pivots about it
under buoyancy and weight while she floods; the floor forces go into the
girder's load. Roll: the contact forces act in roll like any other, with
no rule by list. There is no friction across the hull: with no sway in
the model it could only lock her roll, not let her turn about the keel
where it touches (a first version of 1.1 had it, and it held the
Lusitania at 24° against the roll physics gives her). So a flat box rights
itself on the floor, and the Lusitania, her narrow bow on the floor and
her flooded hull going under at about 25°, rolls further to starboard in
her last minute: 25°–77° at the moment she is gone across the calibration
sweep below. That roll is touchy (it turns on which dry spaces are left
aft and when), so her rest is the survey's rule (below), not this. Once she is
wholly under she goes straight to the landing from where she lies (no
fall), her contact as deep in the mud as it already is, and ploughs no
deeper (`seated`). She settles along the floor (rest pitch 0) and turns to
her rest about that contact; each step re-seats her so her lowest hull
point stays at the depth the contact had (turning about the keel would
otherwise swing her other side most of a beam into the floor: the
Lusitania's lowest point went from −94.4 m to −115.3 m in 5 s; now it stays
at about −95 m). A body that falls (the Titanic's halves) ploughs and rests
as in 1.0. Any contact puts
the run in fast steps.

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
(its after end bedded 3 m), the stern level (the 1.0 rest: a rule, the
mud not modelled). A ship with a surveyed wreck (`spec.wreck`: the
Lusitania lies on her starboard side) rests by that survey instead, **a
rule, not physics**: landing listed at least `minListDeg` (10°) toward
the wreck's side, she eases over to `restDeg` (75°) or keeps her list if
that is more; landing any other way, she keeps the list she landed with.
The physics brings the Lusitania down listed 25°–77° to starboard; the
rule settles the rest. The Titanic has no `wreck`, so her rests are
1.0's. Terminal speeds come out about
13 m/s (bow) and 10 m/s (stern). The run ends when every part rests, or at
`END_T` (`t = 22800`, 6 h 20 min after the first event: 6:00 AM for the
Titanic, 8:30 PM for the Lusitania) if any part still floats. Each floating body freezes
once it has stopped moving and taking water for 5 minutes (after a break,
each half on its own; for a torpedo ship the water also counts as still
when its net flow averaged over about `STEADY_AVG_S`, 2 minutes, is under
0.05 m³/s: a 24 m² torpedo hole trades a cubic metre or two with the sea
in a slow cycle of tiny steps around her level, which never lets the
instant value settle. An iceberg ship keeps the 1.0 test exactly: on it,
boiler room 5's What-if never settles because of its pump, and 1.0 holds
it that way); when every part is frozen or on the floor the run
logs `floating-steady` and holds its pose to `END_T` at one frame a
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
of her goes under (`sankAtT`). `bow-lands` / `stern-lands` when each end
first touches the floor, which may be while she is still afloat (a whole
hull: a contact forward of its middle is the bow's, aft the stern's); a
hull that sinks in one piece logs both at the same moment. `explosion` is
a scripted event (the Lusitania's second explosion). Events found during a
step carry the time at its start; the first frame after shows them.
`SimFrame.groundedParts` lists the parts touching the floor (afloat or
landed), empty while none do. Every event carries `t` (shown) and `realT` (real) seconds after the
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
- 1.1 additions: `Compartment.span` / `crossFlowM2`, `Opening.t`,
  `ShipSpec.portholes` / `headway` (optional), `ShipSpec.clockStartS` and
  `cause` (required; the Titanic's are 11:40 PM and `"iceberg"`),
  `SimOptions.portholesOpen`, `SimProbe.lowestZ` (earth z of the lowest hull
  vertex of any body), `SimFrame.groundedParts`, `ShipSpec.wreck`
  (optional), `PortholeRow.followsSheer` (optional), `whatIfSpots`.
- `__tests__/titanicGolden.test.ts` freezes the Titanic's real night and six
  What-ifs (every event, every 50th frame's poses, water, list and trim, to
  1e-9) as written by the 1.0 sim: hold 1 + boiler room 4, the first five,
  boiler room 5 alone, and the three most listed a search of 1.0 What-ifs
  found (up to 19°; one breaks, one sinks whole, one floats); a change that moves them is wrong for
  the Titanic. `UPDATE_GOLDEN=1` rewrites the fixture, only on purpose.
  `__tests__/testShips.ts` has the box ships the 1.1 tests use.
- `whatIfSpots(spec)`: the compartments a What-if offers (every one for an
  iceberg ship; for a torpedo ship the twelve main spaces, not the side
  bunkers). `whatIfOpenings` for a torpedo ship moves the real hit: each
  real opening keeps its area, heights and time and goes as many spaces
  forward or aft of the chosen one as it was of the real one (No. 1 boiler
  room, the room beside the first bunker it opened). There it goes into the
  space's starboard bunker, if it has one and the opening was in a bunker
  or is the torpedo's own hole in the shell (t = 0: it cannot reach the
  room behind a bunker without opening it); else into the space (the
  second explosion, inside). Openings that would fall off either end are
  dropped. So
  `whatIfOpenings(lusitania, ["br1"])` is her real afternoon, and a hit at
  any boiler room opens its starboard bunker and the room (ruling R1). An
  iceberg ship's What-if is exactly 1.0's.

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

## Lusitania's data and sources

Sources: the Mersey inquiry's report ("The ship", "The torpedoing of the
ship"; rmslusitania.info and titanicinquiry.org transcriptions); Thomas
Galbraith's evidence to it (Q 6–21: LOA 785 ft, LBP 760 ft, breadth
88 ft, depth 60 ft 4½ in, draught 36 ft, displacement 41,440 tons, 12
transverse bulkheads, heavy plating to the shelter deck); rmslusitania.info
"Facts and figures" (LOA 787 ft, LBP 760 ft, beam 87 ft 6 in, draught
33 ft 6 in, depth 60 ft 4¼ in, displacement 38,000, 22 lifeboats and 26
collapsibles in May 1915); Peeke, Jones & Walsh-Johnson, "The Lusitania
Story", and Ramsay, "Lusitania: Saga and Myth" (trials at 33 ft and
31 ft 6 in, the layout, the afternoon), as cited by Wikipedia's "RMS
Lusitania" and "Sinking of the RMS Lusitania"; Ballard, "Exploring the
Lusitania" (the hit by the forward boiler room, a nearly empty starboard
bunker, the bow on the floor, the wreck on her starboard side in 93 m);
Schwieger's war diary (starboard "right behind the bridge", running
depth 3 m). Where they disagree:

- **Length and breadth.** LOA 787 ft (239.88 m) and LBP 760 ft (231.65 m)
  (Galbraith's 785 ft and Mersey's 755 ft are other measures). Beam 87 ft
  8 in (26.72 m), the moulded figure most plans give; 87 ft 6 in and 88 ft
  (extreme) are within 0.05 m and 0.1 m of it.
- **Decks.** Her own letters: Boat (A), Promenade (B), Shelter (C), Upper
  (D), Main (E), Lower (F), the orlop and the tank top. The hull's top is
  the Shelter deck at 18.40 m (the 60 ft 4½ in depth); the decks below about
  9 ft apart (D 15.60, E 12.95, F 10.40, orlop 7.80, tank top 1.52 m over a
  5 ft double bottom); B 21.15 m, Boat 24.0 m. Sheer 3.0 m forward and
  1.3 m aft (estimates from her profile).
- **Displacement and draught.** Sources give 38,000, 41,440 and 44,060
  tons. 44,060 tons at 33 ft 6 in would need a block coefficient of 0.69,
  the Titanic's fullness, impossible for a 25-knot hull (Froude number
  0.27); 38,000–41,440 tons at 33–36 ft gives 0.60–0.61. The hull here is
  fitted to Cb 0.610 at 33 ft 6 in (39,485 t, between the two). On 7 May,
  six days out of New York at 21 knots with six boilers shut, she had
  burnt about 4,000 t of coal (about 700 t a day): at about 4,500 t per
  metre that is 0.9 m off her load draught, so 9.35 m (30 ft 8 in), where
  the hull displaces 35,654 t (`displacementT` 35,650; the 31 ft 6 in
  trial draught is close).
- **Stability.** No source gives her GM. Wikipedia (after Peeke et al.)
  says flooding three coal bunkers on one side could make it negative:
  three side bunkers' waterplane here (about 245 m² at 11.4 m out) takes
  about 1.0 m off BM, so her intact GM was under about 1.2 m; liners of
  her day were not under about 0.5 m. KM at 9.35 m is 10.54 m; KG 9.70 m
  gives GM 0.84 m: about 17° within the first minute and up to about 25°,
  as the survivors described (calibration below). LCG −2.6 m,
  over the centre of buoyancy, so she floats level; no TCG.
- **Hull form.** Generated in `lusitania.ts` like the Titanic's: parallel
  middle body x −34…+24 m, long hollow entrance and run, a 3.6 m bilge
  radius, a nearly plumb stem with a rounded forefoot, a counter stern
  overhanging 7.4 m. Waterplane 4,324 m², KB 5.03 m, BM 5.51 m at 9.35 m.
- **Her plans.** Positions along her length (bulkheads, funnels, the
  superstructure's ends, boats) are measured off the profile and hold
  plan of her general arrangement as reproduced on Wikimedia Commons ("RMS
  Lusitania deck plans", public domain; the file notes alterations during
  construction and later changes to the boats). Scale: AP and FP (frames 0
  and 300) are 2,155 px apart for 760 ft, 2.84 px per foot; the stern and
  stem then measure 786 ft overall (787). Each feature to about ±3 px,
  ±1 m. The profile's LWL is 95 px (33.5 ft) over the keel line: her load
  waterline.
- **Subdivision.** Twelve bulkheads on the hold plan (Galbraith's count;
  Mersey's "eleven principal" sections leave one out), at x (m): collision
  bulkhead 102.2; trimming tank or cargo to 90.9; chain locker to 86.7;
  magazine, reserve coal or cargo to 74.9; the transverse coal bunker to
  65.7; No. 1 boiler room to 36.5; No. 2 to 12.4; No. 3 to −10.9; No. 4 to
  −36.3; the L.P. engine (turbine) room, with the H.P. engine rooms in its
  wings, to −63.5; the condenser room to −71.5; the auxiliary machinery
  room to −81.1; the steering gear (with the tunnels' after ends) to
  −111.7; the after peak. Each boiler room is centred under its funnel
  (51.1, 24.5, 0.8, −23.6 against funnels at 51.2, 25.3, −0.6, −26.4). The
  sim joins the chain locker to hold 1 and the condenser and auxiliary
  rooms into one (twelve sections, as Mersey) and keeps the turbine room
  full breadth. The collision bulkheads reach the Shelter deck, the rest
  the Upper deck (D): an assumption, no source found gives their tops.
- **Side bunkers.** The longitudinal bulkheads 9.5 m from the centre line
  (the boiler rooms 62 ft across, the bunkers about 3.9 m wide at the
  waterline), each boiler room a centre cell with a port and a starboard
  wing the same length; the wings mirror each other. Coal doors open
  while steaming and jammed by coal (Mersey/Wikipedia: they could not be
  closed) leave 0.1 m² per wing (`crossFlowM2`). Side bunker permeability
  0.9 (nearly empty at the end of the crossing, Ballard); the transverse
  bunker, still holding coal for the last of the crossing, 0.6 (an
  estimate).
- **Superstructure.** Off the profile: the house front (the navigating
  bridge over the Promenade deck's front) at x 72.0 m, about 45 m from the
  stem head, as photographs show; the boat deck's after end at −63.2 m; the
  second class house's after end at −104.3 m. Forward of the house front
  her side is plated up to the Promenade (B) deck all the way to the stem
  (a long foredeck, no well); aft of the second class house the Shelter
  deck is open to the stern (no raised poop). Sim boxes: the second class
  house (−104.3 to −63.2) and the foredeck (72.0 to the stem) to the B
  deck at their middles, and the house under the boat deck (−63.2 to 72.0)
  to halfway between B and the boat deck. Funnels at x 51.2, 25.3, −0.6,
  −26.4 m (their bases), 23.5 m from their bases on the boat-deck casings
  to the top (estimated from the profile's height to the aerials,
  165 ft over the waterline), all working.
- **Her name in May 1915.** Disputed: Schwieger's war diary says he read
  "Lusitania" in golden letters on her bow; popular accounts say Cunard
  had painted her name out for the war. The data carries no paint; the
  model follows its own README.
- **The real afternoon.** The torpedo (one hole across bulkhead D, into
  the transverse bunker, 8 m², and No. 1's starboard bunker, 6 m², 4–8.5 m
  over the keel) at 2:10 PM; the second explosion at t = 8 s (scripted
  `explosion`, and timed openings: No. 1 boiler room 6 m² and No. 2's
  starboard bunker 4 m², 2–6 m). About 24 m² in all, inside the 10–30 m²
  a 1915 torpedo and an explosion inside the hull make. Where: the Mersey
  report says between the third and fourth funnels (from Captain Turner),
  Schwieger "right behind the bridge", most survivors between the first
  and second funnels, rmslusitania.info's notes "under the bridge and
  forward of the first boiler room"; Ballard by No. 1 boiler room. We take
  the bridge and No. 1, the account the wreck and the U-boat agree on. The
  second explosion's cause is not named; that it reached No. 2's
  starboard bunker is our assumption (an explosion low in the hull, on
  the side the hit opened).
- **Portholes.** Rows 1 m over the Lower (F) deck forward (over the holds)
  and aft (over the after spaces), and over the Main (E) deck from the
  after peak to the collision bulkhead, both sides, following the sheer
  (`followsSheer`; her plan: "all the portholes further forward are a few
  feet higher from the water line owing to the sheer of the decks"; at
  the ends the rows are up to 2.4 m above their middles). Captain Turner
  ordered them closed (Mersey); survivors and the wreck say many were
  open on the warm afternoon. 0.025 m² per metre: a 16-inch scuttle
  (0.126 m²) about every 2 m, about 40% open. `portholesOpen: false`
  shuts them. Her plan also says that amidships the ports are about 9 ft
  (F), 18 ft (E) and 26 ft (D) above the water line; if that is her load
  line (the profile's LWL) our rows are 1.5–1.8 m low (see "Known
  limits").
- **Headway.** 18 knots (9.26 m/s) at the hit, halving every 300 s: she
  carried her way about 2 nautical miles (Wikipedia: about 2 nmi from the
  hit to the wreck), 3,600 m by the time her bow touched.
- **Boats.** 48: 22 wooden lifeboats on davits, 11 a side (odd numbers to
  starboard, 1 and 2 forward), evenly from x 56 m (just aft of the
  bridge) to −52 m, as the profile's boats run from abreast the bridge to
  abaft the fourth funnel; and 26 collapsibles: 18 under the wooden
  boats 3–19 and 4–20 (labelled `3A`…`20A`), 8 on the after deck four a
  side (`S1`–`S4`, `P1`–`P4`; their real numbers are not in our sources).
  The six that got away, all from starboard, as `boat-lowered`: 1 at
  2:15, 9 at 2:17, 11 at 2:18, 13 at 2:19:30, 15 at 2:21, 21 at 2:24
  (order from the survivors' accounts; the times are estimates within the
  18 minutes). The hit broke No. 5 to splinters (Mersey).
- **Steam.** `steam-start` at t = 10 s (just after the second explosion)
  and `steam-stop` at 2:14 PM. Lookout Leslie Morton saw "a cloud of coal
  dust and steam" shoot up at the hit; her steam pressure fell from
  195 psi to 50 psi and falling after the explosions (No. 1 boiler room's
  lines and boilers flooded and broken), and her power failed at about
  2:14 (Wikipedia, "Sinking of the RMS Lusitania", after the survivors'
  and engineers' accounts). After the second explosion, accounts also
  have thick grey smoke pouring from her funnels and ventilators. The
  times are estimates; the venting is sourced, its exact end is not.
- **Floor and clock.** 93 m of sea (Ballard), the clock from 2:10 PM.
  `wreck: { restDeg: 75, minListDeg: 10 }`: her wreck lies on its
  starboard side (Ballard), a rule for her rest (see "The way down").
- **Girder.** hog 5.0 GN·m, sag 4.6 GN·m: her shallower section (18.4 m by
  26.7 m) gives about 15 m³ of section modulus at the Titanic's
  proportions, in the high-tensile steel of her upper strakes and decks
  (about 330 MPa). The real afternoon's peak is 0.50 of it afloat and 0.82
  with the bow on the floor, so she does not break, as she did not.

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
| Coal doors             | 1.5 m over the bottom                                                                     | Doors from the wing bunkers to the stokeholds opened at the plates, a double bottom's height over the keel.                                                                                                                                                  |
| Portholes              | 5 m pieces, 0.4 m tall                                                                    | A 16-inch scuttle; short pieces so a row goes under progressively as she lists and trims.                                                                                                                                                                    |
| Floor stiffness        | lightship on the keel sinks 1 m; damping 3 s × k                                          | Soft mud: a stem alone ploughs a few metres (about 4–6 m in the box tests) before enough hull bears. 3 s is about critical for a short contact and over-damped for a long one.                                                                               |
| Floor friction         | μ 0.5 below 0.05 m/s                                                                      | Steel on clay mud; regularised so the implicit solve stays smooth.                                                                                                                                                                                           |
| Rest on the floor      | 1.0: upright; `wreck`: her survey's side (a rule)                                         | The Titanic's halves land within a few degrees of upright and rest as 1.0. The Lusitania comes down listed to starboard and lies over to 75° (Ballard: on her starboard side).                                                                               |

### The Lusitania's calibration

Every value below is physical; no time is scripted but the explosion and
the boats. Tuned against the history (list about 15° within minutes, up to
about 25°; down by the head; the bow on the floor with the stern up; gone
in 18 minutes; at rest on her starboard side), all other things fixed:

| Parameter                | Value                                  | Why                                                                                                                                                                                                                                                                                |
| ------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hit and second explosion | 8 + 6 m² at t = 0, 6 + 4 m² at t = 8 s | 24 m² in all, inside 10–30 m². With only No. 1's bunker and room open (12 + 6 m²) she lists at most 4.2° and floats: the list needs more than one starboard bunker ("three bunkers on one side").                                                                                  |
| Coal doors               | 0.1 m² per side bunker                 | Jammed open with coal. At 1 m² (doors wide open) the port bunkers fill through the rooms: 11° at 2:15 and at most 16°, under the survivors' 15° within minutes.                                                                                                                    |
| Side bunker permeability | 0.9                                    | Nearly empty bunkers (Ballard). The transverse bunker 0.6.                                                                                                                                                                                                                         |
| KG (GM)                  | 9.70 m (0.84 m)                        | Inside the 0.5–1.2 m the bunkers allow. With her plans' layout: GM 1.09 m gave 17° at 2:15 and a landing list that ranged 0°–42° with the smallest changes; 1.24 m 14°; 0.84 m: 17.6° at one minute, 21.7° at 2:15, at most 24.8°, and 25°–77° as she goes under across the sweep. |
| Porthole open area       | 0.025 m²/m                             | Sets the time (after the hit, GM 0.84): 0.008 → 31:46, 0.016 → 21:39, 0.020 → 19:35, 0.025 → 18:05, 0.030 → 17:07. Shut, she floats upright.                                                                                                                                       |
| Girder                   | hog 5.0, sag 4.6 GN·m                  | At 4.0/3.7 GN·m she breaks at 2:27:25, as the bow lands (peak use 0.82 at 5.0/4.6); she did not break.                                                                                                                                                                             |
| Headway half-life        | 300 s                                  | 18 knots carried about 2 nautical miles (3,680 m to 18 minutes).                                                                                                                                                                                                                   |
| Rest                     | `wreck`: 75°, from 10°                 | A rule, not tuned: her survey's side. Her last-minute roll is touchy (25°–77° at going under across the sweep; 0°–40° at GM 1.09 m), so physics alone would not reliably lay her on her side.                                                                                      |
| Steady average           | 2 minutes                              | Not tuned to her timing, torpedo ships only: lets a big hole's slow exchange with the sea count as still (without it the What-ifs that float, such as hold 1, never log `floating-steady` and run to `END_T`, 8:30 PM on her clock).                                               |

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
| Lusitania: displacement within 2%, GM 0.5–1.2 m     | 35,654 t (+0.0%), GM 0.84 m; Cb 0.610 at load       |
| Lusitania: list ≥ 12° by 2:15, at most 15–30°       | 21.7° at 2:15, at most 24.8°                        |
| Lusitania: down by the head from 2:12               | trim > 0 from 2:12 on (1.5° then)                   |
| Lusitania: bow on the floor, stern in the air       | bow lands 2:27:25 PM, trim 26°                      |
| Lusitania: gone at 2:25–2:32 PM (real 2:28)         | 2:28:05 PM, no breakup                              |
| Lusitania: at rest on her starboard side (≥ 45°)    | 75° (she goes under at 59°; the survey's rule)      |
| Titanic What-ifs as 1.0                             | 83 checked frame by frame against e5fd6da4: same    |
| Lusitania: explosion within 30 s                    | 8 s                                                 |
| Lusitania What-if: 12 spots × portholes open/shut   | all finite, all float steady or rest on the floor   |
| Lusitania portholes shut at the real spot           | floats (open: sinks at 2:28:05 PM)                  |
| Lusitania real afternoon `simulate`                 | about 0.5–0.9 s (the Titanic's 3 s budget)          |

## Known limits

- The list stays small (about 1–1.5° to port all night); her real list
  reached several degrees late on. In this model flooding to the sea's level
  does not take away enough stability to make her loll.
- Surge and sway are only G's own motion and a 0.02 m/s drift; no yaw while
  afloat; no waves.
- After the break the two halves do not touch each other.
- The rest on the floor is a rule either way: 1.0 eases a landed body
  upright (the Titanic), `wreck` lays her over to her survey's side (the
  Lusitania). Neither models the mud's give under a bilge.
- A hull held still on the floor while partly under can keep exchanging
  water between deeply submerged, nearly full cells (a 1.0 flooding
  behaviour: one fills to the brim, spills, refills). It then never logs
  `floating-steady` and runs fast steps to `END_T` (about 25 s of compute
  for a 200 m box). A sinking hull is not affected, and no Lusitania
  What-if does it (each one floats steady or sinks).
- The Lusitania's forecastle goes under at 2:23 PM; some accounts have it
  awash within about six minutes of the hit. Her early trim here comes
  only from the water in her forward spaces; the way she still had (18
  knots, the bow down and the holes forward) would have driven water in
  faster than the still-water orifice law, and the sim has no ram
  pressure.
- The Lusitania's lights go out at 2:12 PM (4 m of water in her aftmost
  engine space, the 1.0 dynamo rule, reached early because of her list);
  the power failed at about 2:14 PM. Her steam and power failed as No. 1
  boiler room flooded and steam pressure fell, which the sim does not
  model.
- The Lusitania's porthole rows sit 1 m over her decks, and her decks
  below the Shelter deck are about 9 ft apart (estimates). Her plan says
  her portholes amidships are about 9 ft (F), 18 ft (E) and 26 ft (D)
  above the water line. Measured from the profile's load waterline that
  puts the E and F rows about 1.6 m higher than ours; measured from her
  7 May waterline, about 0.8 m. With rows 1.6 m higher she sinks in
  35 minutes at 0.025 m²/m, and in about 17 minutes only with about 80% of
  the ports open (0.05 m²/m) and GM 0.69 m. The decks and rows are kept as
  they are until her deck heights are measured too (the model draws
  them).
- The Lusitania's lower spaces under the bulkhead deck are whole
  compartments: water through an E-deck porthole goes straight into the
  compartment (or side bunker) under it, not onto E deck first.
