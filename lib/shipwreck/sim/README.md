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
  part is under, the way down plays `DESCENT_TIME_SCALE` (6) times faster
  (per ship: `ShipSpec.descentTimeScale`; the Fitzgerald's is 1, her short
  dive in real time, ruling R11): each frame also carries `realT`, the real
  time, so the UI can say how long the fall really took.

## Files

| File              | What                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geometry.ts`     | The hull resampled to 128 stations × 14 offsets (any two sections blend vertex by vertex); slices between two x (sections clipped there); superstructure boxes.                                   |
| `hydrostatics.ts` | Volume, centre and cut of a slice under any plane: each section polygon clipped (Sutherland–Hodgman), shoelace, trapezoid along x, intervals the plane crosses split 8×.                          |
| `mass.ts`         | The lightship as mass per station: hull steel by section area, superstructure by its boxes, machinery, coal and cargo by compartment kind, tilted to `lcg`.                                       |
| `flooding.ts`     | Cells (compartments, part-compartments after the break, boxes): level solve, orifice inflow, weir spill, downflooding, burst vents, flow caps.                                                    |
| `body.ts`         | Rigid-body motion (heave/surge of G, pitch, roll), strip-theory added mass, linear + quadratic damping, implicit; the flows and pumps applied each step.                                          |
| `girder.ts`       | Shear and bending moment along the length; strength profile.                                                                                                                                      |
| `descent.ts`      | The fall (drag, glide, tumble), the bow ploughing in, the stern landing.                                                                                                                          |
| `events.ts`       | The closed `SimEventKind` set and event thresholds.                                                                                                                                               |
| `track.ts`        | `SimTrack`, `SimFrame`, `BodyPose`; `sampleTrack` and `eventsBetween`.                                                                                                                            |
| `run.ts`          | `simulate`, `createSimRunner` (`advance(budgetMs)` for the UI), `whatIfOpenings` / `whatIfSpots`, the story's watchers.                                                                           |
| `constants.ts`    | Physical constants and every tuned parameter.                                                                                                                                                     |
| `waves.ts`        | The storm's wave field (1.3): `waveElevation`, `boardingElevation` / `boardingRow` (second order), `waveField` (for the shader), `significantHeight`, `stormComponents`, `lockGroups`, `stormOf`. |
| `deckWater.ts`    | Green water on her open deck (1.3): bays along her deck, onto and off it over the edges, along it with her trim; `deckFlows` (every deck opening's flow).                                         |
| `headway.ts`      | `headwayRun`: how far her way carries her over a step (decaying, 1.1, steady, 1.3, or a speed profile, 1.4); `speedAt`, `headingAt` (her turn), `headwayOf` (engines stopped).                    |
| `doors.ts`        | Watertight doors and torn bulkheads between neighbouring compartments (1.4): `openDoors`, `doorLinks`, `doorFlow`.                                                                                |
| `mine.ts`         | A mine ship's What-if (1.4): `mineOpenings` (her real spot is her real damage; any other spot one hole of the same area, in its void if it has one), `holdsRealMine`.                             |
| `waveRide.ts`     | Her ride on the waves (1.3): `waveRide` (quasi-static heave, pitch, roll on the wave field), `rideDz`, `rideWeight`; the deck openings and the scene share it.                                    |

`scripts/shipwreck-sim.ts` prints a run's timeline:
`npx tsx scripts/shipwreck-sim.ts` (the real night),
`npx tsx scripts/shipwreck-sim.ts hold1 br4` or `--first=5` (What if), add
`--water` for each compartment's fill every 10 minutes.
`--ship=lusitania` runs her afternoon (a line a minute), `--shut` with
the portholes shut. `--ship=carpathia` runs her morning; `--spots=a,b`
names What-if spots (as the bare ids do) and `--no-finisher` leaves out
her third torpedo (`FINISHER_SPOT`), from her real spots when none are
named. `--ship=britannic` runs her morning (a line a minute);
`--doors-closed` shuts every watertight door and `--engines-stopped` stops
her engines at the mine (no run for Kea).

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

**Fresh water (1.3).** `spec.waterDensity` (kg/m³, default `RHO` 1025)
is the density of the water she floats in and floods with: every use of
the density in buoyancy, flood water's mass, added mass, damping, drag, the
girder's loads, the way down and `waterAboardT` reads the body's own
`rho`. The same mass floats 1025/1000 deeper by volume in fresh water
(`boardingSeas.test.ts`). The Titanic and the Lusitania keep 1025.

**Storms (1.3).** `spec.storm` is one deterministic wave field (`waves.ts`),
the same the sea shader draws, so the waves on screen are the waves that
flood her. Linear (Airy) components in deep water,
`η = Σ a·cos(k·(x·cos θ + y·sin θ) − ω·t + φ)`, `ω = 2π/T`, `k = ω²/g` (a
10 s wave is 156 m long; deep water needs only half that, and Lake
Superior is 162 m where the Fitzgerald lies). θ is the direction a wave
travels toward, from her heading at the first event, + toward port; x, y
are earth metres, t real seconds after the first event (shown time while
she floats). `significantHeight` is `4·√(Σa²/2)`. `stormComponents` builds
a sea for a given Hs and peak period: a JONSWAP spectrum (γ 3.3, a
fetch-limited lake sea) cut into 24 bins from 0.65 to 2.2 times the peak
frequency, each bin's frequency jittered inside it (equal bins would
repeat the record every 1/Δf, about 150 s), directions spread ±30° about
the mean by a golden-ratio walk, phases from a fixed integer hash, and the
amplitudes scaled so 4σ is exactly Hs (a 6-hour record at any point is
within 5%: `waves.test.ts`).

A wave group (`storm.groups`, the "three sisters") is a packet on top:
`η = A·exp(−½((s − c_g·τ)/L)²)·cos(k₀·s − ω₀·τ)`, s the distance along its
direction from where its biggest crest passes at its time, τ the time
since, `A = heightM/2` (`heightM` is crest to trough), `c_g = g/(2ω₀)` and
`2.355·L = count·λ₀` (its `count` waves stand within the half-height
width). Its envelope does not spread (a few minutes either side is what it
is for), and past 8 L it adds nothing. A group with no position is
locked onto the sea's own highest crest within half its period of its
time, the sea sampled where she is at each candidate time and the group
placed there (`lockGroups` on a path), so its biggest wave rides on a
crest under her: otherwise the sea's phases alone decide whether it lands
on a crest or in a trough, and a 4 m group could lower the waves there.
Before a run (`stormOf`) her path is predicted (her headway along x, the
drift along y); in the run, `GROUP_RELOCK_S` (300 s) before the group,
the sim locks it again on her real path (her position then, her way and
her surge), and `SimTrack.storm` is the field as run, the one the scene
draws. So early the group's envelope at her is under 0.2% of its height,
and the re-lock moves the waves she has already met by millimetres.

Buoyancy, the hull's openings and the deck edges still see the still
sea (the waves' mean): only the deck openings see the waves.

**Riding the waves (1.3, `waveRide.ts`).** A ship in a storm rides the
waves: `waveRide(storm, scale, x, y, spec, t, out)` gives her heave (m,
up positive), pitch and roll (as `BodyPose`) on the field at real time t, her
midships at earth (x, y), allocating nothing (its per-component terms
are cached per storm). It is her quasi-static, hydrostatic (Froude–Krylov)
equilibrium on the wave, the long-wave limit of strip theory: each
component (and each group's carrier, at her middle's envelope) adds

- heave `a·e^(−kT)·sinc(kx·L/2)·sinc(ky·B/2)·cos ψ`: the wave's pressure
  under her bottom (a draught T down, decaying as e^(kz) in deep water:
  the Smith effect; Journée & Massie, _Offshore Hydromechanics_, TU Delft
  2001, the Froude–Krylov force on a wall-sided body) averaged over a
  rectangular waterplane L × B (her LBP and beam), sinc u = sin u / u;
- pitch `atan` of its least-squares slope along her,
  `−kx·P(kx·L/2)·sinc(ky·B/2)·a·e^(−kT)·sin ψ`, P(u) = 3(sin u − u cos u)/u³
  (→ 1 for a long wave);
- roll `atan` of the surface's least-squares slope across her times the
  effective wave slope coefficient r = 0.73 + 0.6·(KG − T)/T (IMO 2008
  Intact Stability Code, Part A, 2.3; clamped to [0, 1]): 0.52 for her.

So a long swell lifts her nearly whole, and a sea about her length nearly
cancels in heave (sinc(3.3) ≈ −0.06 for her 11 s peak, 202 m along her)
and pitches her about a quarter of its slope (P(3.3) ≈ 0.25): the
"response factor for a long laker in waves shorter than her". It is
quasi-static because she meets her following sea slowly: the peak's
encounter period is about 16 s (ω_e = ω − k·U·cos 21° at 5.7 m/s), well
over her heave (≈ 7.5 s: 2π√(T·Cb/Cw·(1 + added mass)/g)) and roll
(≈ 9 s: 2π·0.38·B/√(g·GM)) periods; the dynamic magnification it leaves
out is about 1.3 undamped and less with her damping. In her real storm
(along her path, 3:30–7:30 PM) she pitches at most 2.0°, rolls at most
0.6° and heaves at most 0.8 m (0.24 m rms) (`waveRide.test.ts` holds
pitch ≤ 6°, roll ≤ 10°).

The ride is a kinematic offset, not physics fed back: buoyancy, the
water inside, the girder and her pose stay on the still-water state. A
ship-frame point (x, y) of hers rides up by `rideDz` = heave − x·pitch +
y·roll. The deck openings see the relative head over the riding lip
(`DeckSea.ride`, one heave, pitch and roll per deck sample), and the
water inside rides with her, so its head over the lip is unchanged. Only
the whole hull afloat rides; `rideWeight` eases it to 0 over
`RIDE_FADE_S` (10 s) from the step her bow goes under. The scene (her
pose, the green water drawn over her hatches) calls the same functions
with `SimTrack.storm`, `stormScale` and the frame's `realT`, so the water
on screen is the water that floods her.

What the ride does to her: it takes water away. Over 4–7 PM in her real
storm, sampled every 0.25 s on her predicted path, the sea is over her
starboard deck edge forward 1.15% of the time on her still-water pose
and 0.08% riding (her sheer, a crest under a point lifts it); over a
hatch coaming at midships 0.11% and 0.07%. Her relative motion is less
than the sea's own at every point along her (tested: x −95, 0, 62, 95 m).

**Boarding seas (1.3).** `spec.deckOpenings` are hatches, vents and other
openings in her deck, each at a ship-frame point (its lip: the coaming's
or the vent's top) into a compartment. Each step, each opening's lip is
placed in the earth frame from the pose, η sampled over it every
`DECK_SAMPLE_S` (0.25 s: four samples a 1 s step, as a crest over a hatch
lasts only a few seconds; the 0.1 s fast steps take one), and the orifice
law applied as for any opening: the sea's head `max(0, η − z)` (with her
ride, `max(0, η − (z + rideDz))`; η the second-order `boardingElevation`,
below; and on an open deck the larger of that and the green water's
level less the lip, `deckWater.ts`) less the water's inside
`max(0, level − z)`, `q = Cd·A·√(2g·Δh)`, both directions,
the mean over the samples. One step may fill the cell to the brim or
empty it, no more (the sea level does not cap water from over the deck).
An opening with `t` leaks from then. A hatch cover with `failHeadM` gives
way at the first sample with that head of green water over its lip
(`hatch-fails`, its number from 1 in spec order: list No. 1 first), and
`failedAreaM2` opens from the next sample: a rule, the head a stated
assumption in the ship's data. Without a storm the openings see the still
sea, so they take water only once she is under. With the storm 1 s steps
are kept (a 9.5 s wave has nine steps a period, more as she is overtaken
from astern: about 18 s between crests at 7 m/s), and the deck flow alone
is sub-sampled, so the Titanic's and the Lusitania's steps are unchanged.

**Crests for boarding (1.3).** Linear waves have crests as high as their
troughs are deep; a storm's crests stand higher and sharper. The deck
sees `boardingElevation`: the linear η with Tayfun's narrow-band
second-order correction, η + (k_m/2)(η² − ζ²), ζ the Hilbert transform
(each component's a·sin of its phase), k_m = Σa²k/Σa² (Tayfun,
"Narrow-band nonlinear sea waves", J. Geophys. Res. 85(C3), 1980). For a
single wave it is Stokes' second order, a·cos θ + (k·a²/2)·cos 2θ; the
mean is unchanged (`waves.test.ts`). In her storm (k_m 0.045 /m, a
140 m mean wave) it lifts the sea over 3 m by 0.23 m in the median, at
most 0.69 m (her afternoon's highest crest, 5.55 m, to 6.24 m).
`waveField` packs `meanK` so the shader draws the same crests;
`boardingRow` samples a row of points by phase rotation (no trigonometry
per point). Buoyancy, the ride and the group lock stay linear.

**Green water on deck (1.3, `deckWater.ts`).** A laker's spar deck has
open rails and no bulwark: a sea that tops her edge pours on, stands round
the coamings and vents, and runs off in seconds. `ShipSpec.openDeck` is a
row of bays (the Fitzgerald: one a hatch, 24 ft, from the after house to
the forecastle), each holding water under a level surface on her
cambered deck (straight from each edge to the centre line, `camberM`
higher), tilted with her list, trim and ride. Each deck sample: onto the
deck over an edge as a dam break, q = (8/27)·√g·h^1.5 per metre, h the
second-order sea's height over the riding edge (Ritter's dam-break
discharge, the flow-onto-deck model of Goda, Miyamoto & Yamamoto 1976,
Zhou, De Kat & Buchner 1999, Buchner's thesis, TU Delft 2002); off it at
critical depth, q = √g·(2h/3)^1.5 per metre (a broad-crested weir, free
overfall); both drowned by the other side (Villemonte); between
neighbouring bays the same weir over the low deck edge at their
boundary (water runs down her trim). A hatch-cover gap or vent standing
in it sees the deck water's head if that is the larger, and what flows in
leaves the bay; a split in the side shell (kind `split`) does not. Its
weight is left out of her trim and list (it averages 27–43 m³ from 6:00
to 7:10 PM in the real storm, the deck wet 48–65% of the time; leaving it
out omits about 0.2° of heel);
the coamings' footprint is not taken out of a bay's area. The rows of sea
along both edges and the centre line are sampled by `boardingRow` at the
bays' points (the hatches' own, so a hatch reads its row).

A ship in a storm never freezes as steady (the next big wave over her deck
can always come): she runs to `shelter.t` or `END_T`.

**Pumps (1.3).** `spec.pumpsM3s` replaces the 1.0 pumps: that many m³/s
in all, from the first event while the lights are on, working every hull
space (holds and tanks: a laker's ballast and bilge pumps reach them all),
aftmost wet space first, at any depth, except a compartment marked
`pumped: false` (a laden ore hold: the pellets choke the suction).
Missing: the 1.0 pumps (`PUMP_M3S` from the machinery spaces under
`PUMP_DEPTH_M`).

**Shelter (1.3).** `spec.shelter`: if she is still afloat and whole at
shown time `shelter.t`, the run logs `sheltered` and ends there,
`floated` (she reached Whitefish Bay).

**Steady headway (1.3).** `headway` without `halfLifeS`: u₀ (her engine
still turning) until the step after `bow-under`, then
`u₀·2^(−(t − t_under)/HEADWAY_LOST_HALF_LIFE_S)` (45 s: a flooded hull
of about 40,000 t with its added mass, against the drag of its whole
section, about 250 m² at Cd 1, 6 MN at 7 m/s), integrated exactly; lost
for good at the first touch of the floor, as 1.1. A settled hull still
carries steady way. With `halfLifeS` it is 1.1's decay exactly.

**Watertight doors (1.4).** `spec.doors`: each `BulkheadDoor` is an
opening of `areaM2` from `zLow` to `zHigh` in the transverse bulkhead at
`x` between two neighbouring compartments (`aftId`, `fwdId`), on the
centre line: the fore-and-aft analogue of cross flow. Water runs either
way by the orifice law on the head difference over four strips of its
height, as a hull opening's,
`q = Σₖ Cd·(A/4)·√(2g·|hₐ,ₖ − h_b,ₖ|)·sign`, `h·,ₖ = max(0, surface −
z_k)` (a full cell's head as for a spill), capped like a spill to
half-equalise per step (`doorFlow`, `CD_OPENING` 0.6, `FLOW_CAP` 0.5). A
`kind: "door"` door is a watertight door: `SimOptions.doorsClosed` shuts
it. A `kind: "damage"` one is a bulkhead torn by the blast and never
shuts. Each body links a door whose two compartments both have a cell in
it at the door's x, so a break at the door ends it. No `doors`: no links,
the same code path as before (`doors.test.ts`).

**A speed profile (1.4).** `headway.profile`: [shown s, m/s] pairs, t
ascending, linear between, held past the ends. While she floats it
replaces `startMs`/`halfLifeS`: `u(t)` from the table, integrated
exactly per step (trapezoids on each linear piece) into her earth
distance; once she is under (the step after `bow-under`) her way decays
from `u(t_under)` with `HEADWAY_LOST_HALF_LIFE_S`, as steady way does. A
settled hull is still carried. `speedAt(h, t, opts, lostAt)` is the rate
`headwayRun` integrates. `SimOptions.enginesStopped` (`headwayOf`) drops
the profile and the turn at the first event: she coasts from her speed
then, `u = u₀·2^(−t/T½)` with `HEADWAY_STOP_HALF_LIFE_S` (150 s, or her
own `halfLifeS`): a 53,000 t liner (about 56,000 t with her surge added
mass) at 21 kn meets about 2 MN of resistance (22 MW of effective power,
60 % of 50,000 shp), an initial slowing of 0.036 m/s², an exponential
half-life of about 210 s from that start; her stopped screws dragging and
a bow trimmed down by the flooding add about 40 % to the drag.

**A turn (1.4).** `headway.turn`: [shown s, yaw deg] pairs (+ to port: a
turn to starboard is −), linear, held past the ends; `headingAt` gives
radians. Pose and position only: each step her way (`headwayRun`) is
laid along the heading at the step's middle into earth x and y
(`Δx = d·cos ψ`, `Δy = d·sin ψ`; held at its value when she went under),
and every floating body is turned to the heading about its centre of
mass (`turnTo`: earth x and y only). `stepFloat` places the origin with
the yaw and lays her surge along it; the drift stays earth y. Flooding,
heave, pitch and roll never see yaw, so a turning run's are a straight
run's to 1e-9 (`turn.test.ts`). Once a body is under, the descent's own
yaw (the stern's spin) takes over from the last heading. With her
engines stopped there is no turn. Not for storm ships (the wave ride and
the re-locked groups assume her heading is 0).

**Ram head (1.4).** `headway.ram: { cp, fromX }`: while she has way, the
sea's head at each submerged strip of a hull opening or porthole piece at
x ≥ `fromX` gains the dynamic head `Cp·u²/2g` (`u = speedAt`, her speed
magnitude; 0 once she has touched the floor), so it floods as the orifice
law gives for the larger head: by `√((h + Cp·u²/2g)/h)` against the same
opening at rest (`ramHead.test.ts`). Strips above the sea gain nothing;
openings aft of `fromX` are untouched. The head is set on each body
(`Body.ramHead`) every step and read by `seaInflow` for openings marked
`ram`.

**What-ifs for a storm (1.3).** `SimOptions.storm` scales the field's
heights (`STORM_SCALE`: calmer 0.6, Hs 7.6 → 4.6 m, a hard autumn gale
the lakers sailed through; worse 1.25, 9.5 m, about the highest
hindcast on Superior); `hatchesTight` (Kestner clamps all done up) gives
every hatch no leak while it holds and `HATCH_TIGHT_FAIL_FACTOR` (2)
times its failure head; `topsideDamage: false` leaves out the deck
openings of kind `vent` and `split` (her topside damage; hull openings the
run is given stay); `shoal` adds `spec.shoalOpenings` (a grounding's hull
damage, each strip once: her real run already holds them, R14) to the
openings. Each cell counts the water let in through its
deck openings (`deckIn`, m³) and through everything else (`seaIn`), for
the storm's share (`realStorm.test.ts`).

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
mud not modelled). A whole hull that falls onto its after half (1.4: a
stern-first plunge in water shallower than she is long: some Carpathia
What-ifs) lands as a stern does, crushed 4 m in and settling along the floor
(`sternFirst`); the bow's nose-down rest about its stern would swing her
bow some 60 m into the floor. **Her way down is seen (R22, `pivotDrag`,
the Carpathia only).** A whole hull that lands on its bow in water
shallower than she is long (170 m in 150 m) would, by the plough rule's
5 s ease, swing from 57° to level in a couple of seconds, her stern's top
at some 75 m/s. With `pivotDrag` it swings about the contact no faster
than the water lets it: her weight in water W′ = m g (1 − 0.2) acts at
her centre of mass, an arm d = |x_G − x_c| cos θ from the contact, and
each metre of hull r out from the contact meets pressure drag ½ ρ Cd B
(ω r)² (B her mean breadth, plan area over length, Cd `DRAG_CD` 1), whose
moment over her length L is ⅛ ρ Cd B ω² L⁴. They balance at
ω = √(8 W′ d / (ρ Cd B L⁴)) (`pivotRate` in `descent.ts`): for her
about 0.06 rad/s at 57°, 0.08 at level, so her stern's top comes down at
up to about 12 m/s (its terminal speed; added mass only shortens the
approach to it), and the 1.0 ease takes over within a few degrees of
rest. Her `stern-lands` then comes when the lowest point of her after
quarter reaches the floor (16 s after stern-under), not as her bow
touches; with `descentTimeScale` 1 (the Fitzgerald's R11) the way down
plays in real time: 31 s from stern-under to rest on the real morning.
Missing `pivotDrag`, every other ship keeps the plough rule exactly
(`seabed.test.ts`: a 200 m box in 150 m of sea, with and without). A hull already on the floor when she went
under keeps the 1.0 rule, and no other ship's real run lands this way
(`seabed.test.ts`: a 200 m box flooded aft through 250 m of sea). The rule
is not hers alone: any ship's What-if hull that lands whole and stern first
in `touch()` (`descent.ts`) now rests this way too, and the goldens do not
pin those runs (they cover the real runs only). A ship with a surveyed wreck (`spec.wreck`: the
Lusitania lies on her starboard side) rests by that survey instead, **a
rule, not physics**: landing listed at least `minListDeg` (10°) toward
the wreck's side, she eases over to `restDeg` (75°) or keeps her list if
that is more; landing any other way, she keeps the list she landed with.
After a break, `spec.wreckParts` gives each part its own rule (1.3), also
**a rule, not physics**: `bow` is the `wreck` rule's terms for the bow
(missing: `wreck`, else the 1.0 rest); `stern.capsize` makes the stern,
once wholly under, roll toward the side it leans (starboard if level) at
`STERN_CAPSIZE_DEG_S` (10° a real second: over in 18 s, about its fall of
160 m at 10 m/s) until it lies at `restDeg` (about 180°: upside down),
then land so. A stern that reaches the floor still rolling (or was already
on it) finishes its roll there at the same rate, re-seated each step so
its deck swings onto the floor, not into it. A 200 m box in 120 m of sea,
flooded at the bow, strikes the floor with her stern up and breaks 150 s
later; her bow rests upright and her stern upside down, about 5 m apart
(`wreckParts.test.ts`).
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
second. Not while a torpedo is still to come (1.4: openings with a later
`t` not yet open, the Carpathia's `finisher`): a frozen hull would never
take its water, so the U-boat's return alone, at 10:50 AM, did nothing.
The Lusitania's last timed hole opens at 8 s, long before the 30-minute
earliest freeze, so her runs are unchanged.

**Events.** `forecastle-under`: the deck of the foremost superstructure box
(the forecastle), at its middle, reaches the sea. `bridge-under`: the boat
deck at the forward end of the longest box (the bridge). `funnel-falls`:
the sea reaches the funnel's base (the wave up the boat deck), or its part
leans past its stays (22° for the forward funnel, 6° more for each one
aft); on the real night funnel 0 goes just before the break, the rest
after it, one by one. A funnel with `falls: false` never falls (the
Fitzgerald's welded stack: the stays rule is the liners'). `lights-flicker`: trim 10° or a funnel down;
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
- 1.3 additions: `ShipSpec.waterDensity`, `storm`, `deckOpenings`,
  `shoalOpenings`, `pumpsM3s`, `shelter`, `wreckParts` (all optional),
  `headway.halfLifeS` optional; `SimOptions.storm` / `hatchesTight` /
  `topsideDamage` / `shoal`; events `hatch-fails` (index: the hatch
  number) and `sheltered`. `waveElevation(storm, x, y, t, scale)` allocates
  nothing; `waveField(storm, scale)` packs the same field for the shader
  (Float32Arrays: amplitude, k, direction cos and sin, ω, phase; and
  `GROUP_STRIDE` values per group). The sim and the scene take the storm
  through `stormOf(spec)` (groups placed and locked), scaled by
  `STORM_SCALE[opts.storm]`.
- 1.3, the Fitzgerald (Task 2): `StormSpec.ramp` (the sea building through
  time: [t, factor] pairs on the components, linear between, held beyond;
  `rampAt(storm, t)`, `significantHeight(storm, scale, t)`, and
  `waveField` packs it as `ramp`/`rampCount` for the shader);
  `Compartment.cargoT` (declared cargo, laid along the space first; the
  kind shares then split the rest of the displacement), `pumped` (overrides
  which spaces the pumps reach: a laden ore hold cannot be pumped) and
  `burstM2` (the opening once the space's deck is `VENT_BURST_M` under:
  default `VENT_BURST_M2`; a ballast tank's own vent pipes);
  `DeckOpening.tight` (a clamped cover: no leak, `HATCH_TIGHT_FAIL_FACTOR`
  × the head, as `hatchesTight` does); `cause: "storm"`; the scripted and
  event kind `radio` (a message: index in the ship's own numbering);
  `lockGroups(storm, path?)` locks a group with no place of its own onto
  the crest along a `ShipPath`; `stormOf` uses `predictedPath(spec)`, and
  the sim re-locks on her real path `GROUP_RELOCK_S` before each group and
  returns the field it ran as `SimTrack.storm` (the scene must draw that);
  `wreckParts.stern.rollDegS`;
  `RunOpening = Opening | DeckOpening` with `isDeckOpening` and
  `hullOpenings`. `simulate` / `createSimRunner` take run openings: the
  hull ones, and deck openings, which replace the ship's own
  `deckOpenings` if the run gives any (none given: hers, as Task 1).
- 1.3, the Fitzgerald's storm (Task 2b): `waveRide.ts` (`waveRide`,
  `rideDz`, `rideWeight`, `RIDE_FADE_S`, `rollSlopeFactor`) and
  `DeckSea.ride`/`rideN` (the deck samples' ride); `DeckOpening.kind`
  `"split"` (topside damage, with `"vent"`); `ShipSpec.funnels[i].falls`
  (`false`: never `funnel-falls`); `ShipSpec.descentTimeScale` (default
  `DESCENT_TIME_SCALE`); `SimTrack.stormScale` (the run's `STORM_SCALE`
  beside the unscaled `storm`); `Cell.deckIn` / `seaIn`. The script takes
  `--storm=none` (still water, no shelter, to 9:00 PM) and calibration
  overrides (`--fail-head`, `--leak`, `--split`, `--vent`, `--sisters`,
  `--sisters-at`); `--no-damage` leaves out all of her damage.
  Round 2 (R13): `boardingElevation`, `boardingRow`, `WaveFieldArrays.meanK`;
  `deckWater.ts` (`makeDeckWater`, `deckFlows`, `deckWaterVolume`,
  `DECK_ON_CW`, `DECK_OFF_CW`); `ShipSpec.openDeck`; `Body.deckWater`;
  `DeckCellOpening.onDeck` / `bay` / `row`; `orifice` exported.
  1.3 (task 6): every frame of a ship with an open deck carries
  `SimFrame.deckWater`, each bay's green water (m³, aft to forward, as
  `openDeck.bayX`) while she is whole, interpolated by `sampleTrack`; the
  scene draws it at the level the sim's `deckLevel` gives (exported from
  `deckWater.ts`; `levelFor` calls it). Ships without an open deck (the
  liners) record none, so their tracks and goldens are unchanged.
- 1.4 additions (the Britannic, Task 1): `cause: "mine"`; `BulkheadDoor`
  and `ShipSpec.doors`; `headway.profile` / `turn` / `ram`;
  `SimOptions.doorsClosed` / `enginesStopped`; `HEADWAY_STOP_HALF_LIFE_S`;
  `speedAt`, `headingAt` and `headwayOf` beside `headwayRun` (which takes
  an optional `opts` last); `Body.doors` / `ramHead`, `turnTo`;
  `CellOpening.ram`; `seaInflow`'s optional `ram` head. All optional and
  `undefined` for the other ships, whose tracks are pinned by the three
  golden tests.
- 1.4, the Britannic (Task 2): `ShipId` `"britannic"` (last in
  `SHIP_IDS`); `PortholeRow.inboard` (a row above an inner skin opens into
  the room, not its wing void); `cause: "mine"` What-ifs: `whatIfSpots`
  gives the main spaces (not the voids), `whatIfOpenings` →
  `mineOpenings` (her real spot `hold3` is `realNight` exactly; any other
  spot one hole of the real hole's area and heights at its middle, in its
  starboard void if it has one; several spots three seconds apart, aft
  first, as torpedoes), `whatIfRealIds` → `["hold3"]`, `torpedoHitXs`
  gives the mines' x too. The `kind: "damage"` doors (her torn bulkheads)
  open only in a run that holds her real hole (`holdsRealMine`;
  `openDoors(doors, closed, damage)`); the 6/5 door in every run unless
  `doorsClosed`. A mine ship counts as steady on the averaged inflow (as a
  torpedo ship) and with a roll rate under `STEADY_MINE_ROLL_RADS`.
- What if is multi-select for every ship. A storm ship's `whatIfSpots`
  are each hatch's deck-opening id (No. 1 first), `VENTS_SPOT` ("vents":
  her topside damage, the broken vents and the split at her deck edge,
  with any hull damage of hers that is not a grounding strip) and
  `shoalSpot(k)` per strip of `shoalOpenings`. `whatIfOpenings` gives
  every hatch in her order, chosen ones as they are and the rest `tight`,
  the vents, splits and that hull damage if "vents" is chosen, and each
  chosen strip. Her real run holds the strips (R14), so her real ids
  include every `shoal-k`; `SimOptions.shoal` adds each strip the run does
  not already hold.
  `whatIfRealIds(spec)` gives the spots of the real damage for every ship
  (iceberg: the compartments opened; torpedo: the spot of the real hit;
  storm: every hatch, "vents" and the strips her real run holds), and the editor's `realWhatIfIds` uses
  it. The ids agree with Task 1's flags: her real ids run exactly as her
  real afternoon, and no ids run exactly as `hatchesTight` with
  `topsideDamage: false` and no hull openings (both tested).
- `__tests__/lusitaniaGolden.test.ts` holds the Lusitania's real afternoon
  and two What-ifs (the hit at the turbine room and at the real spot, both
  with the portholes shut) to the 1.1 sim: every event, the outcome, and
  every 50th frame's poses, water, trim and list to 1e-9, against
  `fixtures/lusitaniaGolden.json` (`UPDATE_GOLDEN=1` rewrites it; only for
  a change meant to move her).
- `__tests__/titanicGolden.test.ts` runs the Titanic's real night and six
  What-ifs through both the current sim and `__tests__/v1_0/`, a frozen copy
  of the 1.0 sim and Titanic (never edit it), and requires identical tracks:
  every event and every frame, to the last bit. Comparing on the same machine
  keeps it exact across V8 versions and OSes. The What-ifs: hold 1 + boiler
  room 4, the first five, boiler room 5 alone, and the three most listed a
  search of 1.0 What-ifs found (up to 19°; one breaks, one sinks whole, one
  floats); a change that moves them is wrong for the Titanic.
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
  Several chosen spots are several torpedoes: hit k of n (aft first,
  `torpedoHitXs`) lands `hitTimeS(k, n) = k·HIT_STAGGER_S` (3 s) after
  the first, which lands at 0, and each of its openings opens that much
  later (`Opening.t`), so the scene's water columns and the flooding
  agree. One hit is untouched (the real afternoon stays bit-identical:
  `lusitaniaGolden`).
  `torpedoHits(spec, ids)` gives every torpedo of a run in landing order
  (`x`, `t`, `side`, `finisher`); for the Lusitania it is `torpedoHitXs`
  at `hitTimeS`, on her starboard side.
- **Torpedo ships with their own hits** (`spec.torpedo`, a `TorpedoSpec`;
  the Carpathia's). Missing on a torpedo ship: the rule above, unchanged
  (`__tests__/torpedoSpec.test.ts` holds `whatIfOpenings` for every
  Lusitania set of one to three spots to `fixtures/lusitaniaWhatIf.json`,
  written by the 1.3 code). The format: the `side` she was struck on,
  the `order` hits land along her length (`aft-first` or `fwd-first`),
  `staggerS` between them, one torpedo's `hole` (`areaM2`, `zLow`,
  `zHigh` above the keel, and `lengthM` along her side), an optional
  `hitX` per spot (the ship-frame x of the hole's middle; missing, the
  compartment's middle), an optional `finisher` (a later torpedo:
  `spotId`, the compartment it strikes, and its shown time `t`) and the
  `realSpots` that give her real run.
  - `whatIfSpots`: every compartment without a side span (full breadth or
    centre), aft to forward, then `FINISHER_SPOT` ("finisher") if she has
    a `finisher`. `whatIfRealIds` is `realSpots`, so her `realNight` is
    `whatIfOpenings(spec, realSpots)` and her real ids give it back.
  - `whatIfOpenings`: one hit per chosen compartment spot (repeats and
    unknown ids add none), ordered by `order` and hit k landing
    `k·staggerS` after the first (which lands at 0); `FINISHER_SPOT` adds
    one hit at `finisher.spotId` at `finisher.t`. Each hit's hole runs
    `lengthM` centred on its x and is **split by overlap**: every
    compartment on the struck side it overlaps (full breadth, or a wing on
    that side; not a centre space behind a wing) gets a piece with the
    hole's heights and side and the area shared by overlap length (they
    sum to `areaM2`), at the middle of its overlap and at least 0.5 m
    inside the compartment. A hole across a bulkhead opens both spaces.
    A hole off her ends (overlapping nothing) opens the hit's own space.
    Pieces open at their hit's time (`Opening.t`, none at 0).
  - Events: for these ships only, the sim logs `torpedo-hit` when a later
    hit lands (each distinct later time her holes open is one torpedo),
    while some part of her still floats; `index` is the hit number, the
    hit at the first event being 1 (`collision`), so the second torpedo is 2. A run whose only hit comes later (the finisher alone) logs it as 1.
    The Lusitania and the other ships never log one.
  - A full-breadth hold floods level, so a hit there gives her no list of
    its own: a list toward the struck side needs a wing on that side (or
    her own `tcg`); `torpedoSpec.test.ts` checks a port wing lists her to
    port and the mirror to starboard.
- `__tests__/fitzgeraldGolden.test.ts` holds the Fitzgerald's real
  afternoon and one What-if (her real damage with `hatchesTight`) to the
  1.3 sim the same way, against `fixtures/fitzgeraldGolden.<arch>.json`
  (arm64 and x64; the x64 one was written in a `linux/amd64` Node 24
  container, which also passes the Lusitania's x64 fixture).

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

## The Fitzgerald's data and sources

Sources: the U.S. Coast Guard Marine Board of Investigation's report
(16732/S.S. EDMUND FITZGERALD, 15 April 1977, with the Commandant's
action; transcribed at us-data.org): vessel data (LBP 711 ft, LOA 729 ft,
breadth 75 ft, depth 39 ft, 13,632 gross tons, 7,500 hp steam turbine),
the holds, hatches, coamings, covers and clamps, the ballast tanks and
their vents, the pumps, the cargo and its loading, the load lines, the
last voyage minute by minute, the weather reports, the wreck survey; the
NTSB's Marine Accident Report NTSB-MAR-78-3 (4 May 1978): Figure 2 (the
inboard profile, the tank-top plan with ballast tanks 1–8 a side, the
midship section with the hopper-sided hold, the L-shaped tanks and the
tunnel under the spar deck), the taconite's weight and voids, the hatch
covers' 4 ft design head, the analysis of the sinking; Hultquist, Dutter
& Schwab, "Reexamination of the 9–10 November 1975 'Edmund Fitzgerald'
Storm Using Today's Technology", Bull. Amer. Meteor. Soc. 87(5), May
2006 (NOAA/GLERL's hindcast); her 1958 general arrangement (Great Lakes
Engineering Works hull 301, Detroit Historical Society 2013.042.192:
the houses' tiers and lengths, read off a low-resolution scan);
Wikipedia, "SS Edmund Fitzgerald" (the 1969 record cargo, DWT). Where
they disagree, or say nothing:

**What floods her, in plain words (ruling R14).** Her real run is the
sim's best reconstruction of all the damage reported or argued: her
topside damage (two broken vents, a split along her starboard deck edge
where the fence rail went down), her leaking hatch covers, a graze on Six
Fathom Shoal (three 0.05 m² strips along her forward bottom, into the
ballast tanks), and the storm. Each can be switched off in What if. The
graze floods her forward tanks faster than her two pumps clear them: she
lists 1.6° by 4 PM, 5.0° by 5:30, 7.1° by 7:00, and settles 0.4 m. The
storm's waves come over her deck through the covers, vents and split
(about 490 m³ by 7:00 PM, all of her holds' water); riding the waves, a
222 m laker with 3.6 m of freeboard ships green water rarely. What sinks
her is the three sisters: they put more than 3.5 m of water over her
coamings at 7:11:37 PM, the covers give way, and she dives. **The storm
is what sinks her:** in still water all of her damage leaves her
floating at 9:00 PM (6.0° of list); without the sisters she reaches
Whitefish Bay. **Topside damage alone gives no list** (riding, the sea
tops her deck edge too rarely for the vents and split to out-run her
pumps: rulings R12, R13); **the graze gives the reported list.** Why the
graze is in the real run: the list she reported at 3:30 PM, before any
cover gave way, needs water in her tanks faster than her pumps, which
only damage under the water gives here. Experts still disagree on the
cause: the USCG Marine Board found the hatch covers' leakage the cause
and did not accept a grounding; the Lake Carriers' Association and her
master's track past Caribou Island argue for the shoal (below); the NTSB
put it to the covers collapsing under boarding seas.

- **Size and frame.** LBP 711 ft (216.71 m), LOA 729 ft (222.2 m): a
  nearly upright stem (her photographs: the 1971 bow slide, USACE
  "underway"), raked 0.5 m from the waterline (the forward perpendicular)
  to the spar deck and straight on down to a tight forefoot (1.5 m round),
  and a round stern 5.0 m past the after perpendicular, which takes most
  of the 18 ft between LOA and LBP. Beam 75 ft (22.86 m), depth 39 ft
  (11.89 m) to the spar deck at side. Sheer 0.9 m forward and 0.45 m aft
  (an estimate: a laker's nearly straight deck). Camber 18 in, coamings
  24 in (3 ft 6 in over the deck at side at the centre line, USCG).
- **Draught and displacement.** 27 ft 2 in forward, 27 ft 6 in aft at
  Superior (the bill of lading): 8.33 m mean, trim 0.10 m by the stern
  (she settles 0.12 m by the stern). Winter freeboard 11 ft 6 in (the 1973
  load line): 3.56 m here. No source gives her displacement or lightship.
  The hull is a full laker's, block coefficient 0.842 with the bluff,
  nearly plumb bow (0.835 with the first data's raked bow), which gives
  34,750 t in fresh water; less the cargo (26,535 t) and about 130–180 t
  of fuel (50,013 gallons taken on, a day burnt) that leaves about
  8,050 t of lightship, which Watson's steel estimate for her size (about
  6,000 t at ocean scantlings, a laker needing about half the ocean ship's
  girder) plus her machinery and outfit agrees with. LCG 1.32 m forward
  (LCB 1.53 m): she settles 0.11 m by the stern, as she left Superior.
- **KG and GM.** The USCG: no inclining was ever done, no stability
  booklet existed, a laden ore carrier being "very high" in inherent
  stability (dense cargo carried low). KG 5.40 m: the taconite's centre
  about 4.8 m up (12,750 m³ of pellets in the hopper-sided holds, about
  half full, piled under the hatches), a lightship centre about 7.5 m.
  GM 3.80 m (KM 9.21 m); the test keeps 2.5–5 m.
- **Holds.** Three, 177, 144 and 198 ft, joined by non-watertight screen
  bulkheads between hatches 7 and 8 and 13 and 14 (sluices in their lower
  part let water drain aft): in the sim each screen is a weir at the tank
  top. 860,950 ft³ (24,379 m³) moulded. 21 hatches, 11 × 48 ft, on 24 ft
  centres; No. 1 is put 87 ft aft of the forward perpendicular so that the
  wreck's bow section (276 ft from the stem) ends between hatches 8 and 9,
  as surveyed; that puts the collision bulkhead (the holds' forward end)
  66 ft from the forward perpendicular and the engine room's forward
  bulkhead 18 ft aft of No. 21. The after peak's bulkhead 20 ft forward of
  the after perpendicular (an estimate).
- **Ballast tanks.** Eight a side, L-shaped: under the hold's hopper to
  the centre line and up the side under the tunnel (NTSB Figure 2). A
  cell here is a whole-depth column, so each side's tanks by a hold (Nos.
  1–3, 4–5, 6–8) and its tunnel are one wing outboard of y = 7.43 m. That
  y makes the hold cells hold the holds' 24,379 m³ plus the double bottom
  under them (3,875 m³, which the holds' permeability leaves out), and it
  gives a flooded wing about the heeling moment the real L-tank and
  tunnel would (the wing's water sits further out; the double bottom's
  share, near the centre line, is left dry). Permeability 0.95.
- **Cargo.** 26,116 long tons (26,535 t) of taconite (USCG; the figure is
  approximate: half was weighed). Stowed by the normal profile (USCG:
  about 28% in the middle half of the hold's length, 36% in each end
  quarter): 41.1% in No. 1, 15.5% in No. 2, 43.4% in No. 3. Bulk density
  130 lb/ft³ (2.08 t/m³, USCG; the NTSB says 127–140), and the voids hold
  up to 27.5 lb of water in a cubic foot (NTSB): a void share of 0.44. The
  pellets' own pores (6–7% water by weight, NTSB) fill too slowly to count.
  So each hold's permeability is its share of 860,950 ft³ less the
  pellets' solid volume, over its cell: 0.563, 0.721, 0.574.
- **Hatch covers.** One-piece steel covers on gaskets, 68 Kestner clamps
  each; the survey found nearly all the clamps it saw undamaged, so most
  were not done up (USCG). Leak 0.30 m² a cover (tuned, below): 7.5 mm
  round the cover's 40 m gasket. They were
  designed for a 4 ft head (46 CFR 45.145); the NTSB found 12.5 ft of
  static head enough to fail one: failure at 3.5 m of green water over the
  coaming here (about three times the design head, a little under the
  NTSB's; tuned, below). A failed cover opens the whole 49.05 m² hatch.
- **Vents, the deck-edge split, and the damage nobody saw.** Each
  ballast tank had two 8 in vents, 18 in over the deck (with their
  mushroom caps). She lost two: at the starboard deck edge over the No. 1
  tanks (the USCG thought the damage most likely forward; the survey found
  a vent torn away, with a hole in the deck at its base, on the starboard
  side of the bow section), 0.05 m² each. With them "a fence rail down":
  here a split along her starboard sheer strake where the fence rail went
  (the model's `FENCE_GAP`, from No. 5 hatch's vent to just aft of No. 3
  hatch), a crack 5 mm wide on average over 20 m, its middle 0.3 m under
  the deck edge: 0.1 m² in four deck openings of kind `split` into the
  No. 1 starboard tanks. All see the second-order sea with her ride; the
  vents stand in the green water on her deck too. The NTSB:
  with four 7,000 gpm and two 2,000 gpm pumps, "the flooding must have
  been occurring through openings other than just the damaged ballast
  tank vents". In this model no topside opening of an honest size can
  out-run her two pumps: riding her following sea (the linear sea here;
  second order adds about 0.2 m to these crests), the sea stands over
  her starboard deck edge forward 0.08% of the time (0.98% at a 5° list),
  which takes 682 m² of opening (57 m² at 5°) to match 0.88 m³/s; on her
  still-water pose 44 m² (8 m² at 5°). With the deck water and the
  second-order crests, splits of 0.05 to 3 m² and vents of 0.03 to 0.1 m²
  still leave her tanks dry by 7:00 PM. The first data
  put the undetected damage under the waterline (0.30 m² into the No. 1
  tanks, 0.02 m² into the forepeak) as a stand-in, which flooded her the
  same in calm water (69% of her water by 7:00 PM); that is gone. Her
  real run's hull damage is the shoal graze (next).
- **The graze on Six Fathom Shoal (R14).** About 2:45 PM she passed
  north of Caribou Island close to Six Fathom Shoal, inside the course the
  Anderson held off it (the Anderson's master's testimony, USCG); the
  Canadian Hydrographic Service's 1976 survey found the shoal reaching
  about a mile further east than charted (the Lake Carriers'
  Association's case for a grounding). Here: three 0.05 m² splits along
  her forward bottom (0–0.6 m up), into the No. 1 starboard and port
  tanks at No. 4 hatch and the No. 2 starboard tanks at No. 10:
  `shoalOpenings`, and `realNight` the same strips. Their size is tuned
  to her 3:30 PM list against her pumps (about 5° by 5:30 PM; on the
  first data 0.03 m² the pumps held and 0.3 m² sank her by 4:30); their
  places follow a rake along
  her forward bottom. Each is a What-if spot; `--no-damage` or no shoal
  spots leaves them out. The strips open at 3:30 PM (shown 0), not at the
  graze about 2:45 PM, so the sim's list lags the record (a list reported
  by 3:30) by about 30–45 minutes.
- **Pumps.** "Yes, both of them": two of her four 7,000 gpm main ballast
  pumps, 0.883 m³/s. They work the tanks, the peaks and the engine room;
  not the holds (a laden hold cannot be pumped: the pellets choke the
  suction, USCG and NTSB testimony).
- **Deep down.** A ballast tank has no hatch or skylight to burst; its
  trapped air leaves by its own vents: `burstM2` two 8 in bores per tank
  (0.195 m² for the wings of three tanks, 0.130 m² for two) instead of
  the 1.0 rule's 3 m².
- **Houses.** From the general arrangement: aft, a house from the stern to
  just aft of No. 21 hatch (x −69 m), a second tier under the funnel
  (x −106 to −76 m); forward, the raised forecastle from the collision
  bulkhead to the stem, the texas tier on it (x 90 to 104 m) and the
  pilothouse on top (left out: its void and glass). Boxes are full
  breadth, flat at their tiers' decks (8 ft 6 in apart, an estimate). The
  Pilothouse deck (its floor) is 0.7 m over the texas deck: the
  pilothouse stands one tall tier on it (the 1971 bow slide: about as tall
  as the forecastle tier, 3.3 m to its visor, its windows in the upper
  third), its floor a step up on its void. The decks are named for her (no "Boat" deck, so the liner's `bridge-under`
  landmark does not fire). Lifeboats on the poop deck aft, one raft on
  the texas deck aft of the forward house, starboard, one aft of the
  after house (USCG).
- **Water.** Lake Superior in November, fresh: its surface about 6–7 °C
  on 10 November (NOAA CoastWatch GLSEA, the 1995–2025 average), the deep
  lake about 4 °C, the density of fresh water there 999.9–1,000.0: 1,000
  kg/m³. Floor at 530 ft (162 m), the wreck's depth.
- **Speed and shelter.** The Anderson made 14.6 mph throughout; it closed
  from about 17 miles astern at 3:35 PM to 9–10 at 7:00–7:10 and told her
  it was "gaining about a mile and a half an hour": she made about
  12.8 mph (5.72 m/s), held steady (`headway` without a half-life). At
  7:10 she was about 16 miles from Whitefish Point: there by 8:25 PM
  (`shelter`, t = 17,700 s).
- **The clock and her messages.** Shown time 0 is 3:30 PM, her first
  report (the vents, the fence rail, the list). Scripted `radio` 0 at
  4:10 PM (both radars gone) and 1 at 7:10 PM ("We are holding our own"),
  for the story's words; neither changes the physics.
- **Wreck.** USCG survey: the bow section (276 ft) upright, the stern
  (253 ft) upside down, 170 ft (52 m) apart at their closest, the middle
  broken up between them over about 200 ft. `wreckParts.stern`: capsize
  to 180°; the bow keeps the 1.0 rest (upright). Her funnel has
  `falls: false` (a welded stack; no source has it coming off), and her
  dive plays in real time (`descentTimeScale` 1, ruling R11).
- **Girder.** About 8 m³ of section modulus (a laker needs about half an
  ocean ship's girder, USCG; ocean rules give about 15–16 m³ at her size)
  at 235–250 MPa: 2.0 GN·m hog and sag. Afloat the real afternoon uses at
  most 0.25 of it (the NTSB: no failure on the surface); she breaks as
  her bow strikes the floor at any strength from 1.6 to 3.0 GN·m (at
  2.0, at most 0.19 of it afloat to 7:10 PM).

### The Fitzgerald's storm

- **Height.** The hindcast (GLERL–Donelan wave model driven by RAMS
  winds): about 4 m at 1 PM, approaching 6 m over south-east Lake
  Superior at 4 PM, over 7 m at 7 PM, over 7.5 m at 8 PM (7.8 m in the raw
  output), the worst of it where and when she was lost. Fitted to 7.6 m,
  ramped: 5.7 m at 3:30 PM, 6.0 at 4:00, 7.1 at 7:00, 7.6 by 8:00. The
  Anderson logged 12–16 ft at 3:20 PM, 12–18 ft at 4:52 and some waves
  of 25 ft about 6 PM (visual heights read low against the hindcast).
  The real run's scale is recorded on the track (`SimTrack.stormScale`)
  so the scene draws the What-if's calmer or worse sea.
- **Period.** 11 s peak: JONSWAP's fetch-limited growth for 25 m/s over
  about 300 km gives Hs 7.0 m and a peak near 12 s; the paper calls the
  waves steep and short; 11 s is a 189 m wave, a little shorter than she
  is.
- **Direction.** The hindcast's waves ran west to east, "nearly
  perpendicular" to her track; the Anderson logged the wind at 304° and
  300° (58 and 50 kt) and the seas from the north-west. The wind sea is
  taken from the Anderson's 300°: toward 120°, 21° to port of her 141°
  heading, over her starboard quarter, spread ±30°. Seed 1975.
- **The three sisters.** A group of three (`count` 3) at about 7:12 PM,
  5 m crest to trough on top of the sea. `stormOf` locks it onto the
  sea's crest along her predicted path; the sim re-locks it on where she
  really is `GROUP_RELOCK_S` (300 s) before (her own position, way and
  surge: she runs about 37 m ahead of the headway alone by then, and a
  lock at a fixed point put the crest 72 m astern of her). Locked so, its
  biggest crest passes her at 7:11:55 PM, 2.8 m from her midships (the
  biggest waves she meets in it, crest to trough at her midships, are
  15.2, 13.6 and 12.8 m linear (15.4 m to second order), a little over
  the paper's 14 m Rayleigh maximum for 7 m seas; the largest earlier in
  the afternoon are 10.9, 9.8 and 9.8 m). With the green water and the
  second-order crests, a failure head of 2.6 m fails covers at 4:57 PM
  and one of 5.0 m none at the sisters: the afternoon's worst head over a
  coaming is about 2.6–2.7 m, the sisters' 4.5–5.0 m.

## The Carpathia's data and sources

Sources: _The Engineer_, 8 August 1902, p. 136, "A floating dock and a new
Cunarder" (the launch report, read from the page scan on Grace's Guide:
558 ft long by 64 ft 3 in beam, about 12,900 tons gross, "four complete
steel decks, a steel orlop deck in Nos. 1 and 2 holds, and a bridge deck
290 ft long" with "a boat deck" above it, third-class cabins "on the main
deck" in "the whole of the space forward of the boiler-room", "about
12,000 tons dead weight", two quadruple-expansion engines, "seven large
single-ended boilers" with Howden's forced draught at 210 lb);
titanicinquiry.org's particulars (540.0 ft, 64.2 ft, "Draft (or Depth):
37.4 ft", 13,603 gross, "one funnel, four masts; twin screws; 3 decks, 8
bulkheads", funnel red with a black top and three black rings); Tyne
Built Ships (540.0 × 64.5 × 37.4 ft, 13,555 grt; her last voyage
"Liverpool to Boston in ballast", torpedoed "170 miles WxN of Bishop
Rock"); Maritimequest (558 ft, 64 ft 5 in, "41 (depth)", 13,555 grt);
Wikipedia, "RMS Carpathia" (LOA 558 ft, beam 64 ft 6 in, load draught
34 ft 7 in, 20 lifeboats in 1912, seven single-ended boilers, four masts
with cranes; the morning: the torpedo track on the port side, the hit
"near the No. 3 hatch", the engines disabled by the second, the wireless
and two boats wrecked, rockets, "settle by the head and list to port", 11
boats, a third torpedo "near the gunner's rooms", sunk at 11:00 AM, upright
in about 150 m); thegreatoceanliners.com (GOL: between "No. 4 hold and the
stoke hold", the second "within seconds" in the engine room, rockets, the
convoy scattering, eleven boats, two wrecked, the third "near No. 5 hatch"
an hour later, "about ten minutes" to sink); _Advanced Diver Magazine_,
"RMS Carpathia: the last voyage of Titanic's rescuer" (a narrative; used
only for the bunker beside the struck hold and the watertight doors
"ordered closed"); **the one photograph of her sinking** ("R.m.s
carpathia Sinking.jpg", Wikimedia Commons, public domain, very likely
taken from U-55's deck): she goes down **by the head**, her forward part
under with only a mast top showing, the funnel low, the two after masts
upright, the stern raised clear, no list to see; her photographs on
Wikimedia Commons: "RMS-Carpathia.jpg"
(starboard side, before 1914, nearly broadside), "Steamship CARPATHIA -
broadside view.png" (port side, 19 April 1912, Library of Congress),
"RMS Carpathia.jpg" (starboard bow quarter) and "Carpathia Malta.jpg"
(1912, from aft), with a 2017 profile drawing ("RMS Carpathia
drawing.png", not a primary source) to cross-check. Her general
arrangement (Swan, Hunter & Wigham Richardson, 1903) is in the Osher Map
Library's Morse collection (University of Southern Maine, barcodes
2000043 and 2000228), not online; where it would settle a figure, ours is
argued below and marked as an estimate. Where they disagree:

- **Length and breadth.** LOA 558 ft (170.08 m: _The Engineer_,
  Wikipedia, Maritimequest); LBP 540 ft (164.59 m), the registered length
  (titanicinquiry, Tyne Built Ships). Beam 64 ft 6 in (19.66 m: Wikipedia,
  Tyne Built Ships' 64.5 ft); _The Engineer_'s 64 ft 3 in at launch and
  titanicinquiry's 64.2 ft are within 0.08 m. The stem stands 1 m before
  the forward perpendicular at the upper deck; the counter overhangs the
  after one by 4.5 m (her photographs).
- **Depth and decks.** Three figures: 37.4 ft (titanicinquiry, Tyne Built
  Ships), 41 ft (Maritimequest) and her 34 ft 7 in load draught. 37.4 ft
  leaves under 3 ft of freeboard at 34 ft 7 in, so it is not a depth to her
  top deck: we read it as the registered depth of hold, and 41 ft (12.50 m)
  as her moulded depth to the **main deck**, her freeboard deck (6 ft 5 in
  of freeboard at load, with a long bridge deck and a forecastle). The main
  deck must be above the waterline, since _The Engineer_ puts third-class
  cabins on it; her photographs show two rows of ports in the black hull
  under the white bridge deck house, one 'tween deck each. So her four
  complete steel decks are, from the top: **Upper** 15.10 m (the top of the
  hull and the well decks), **Main** 12.50 m (41 ft), **Lower** 9.90 m and a
  **Fourth** deck 7.30 m, 8 ft 6 in apart; the **Orlop** (holds 1 and 2)
  4.50 m; the **Tank top** 1.52 m over a 5 ft double bottom. The
  forecastle and the **Bridge** deck are one tier over the upper deck
  (17.70 m), the **Boat** deck one more (20.30 m). She has no poop (R21,
  below): abaft the bridge deck house the upper deck runs open to the
  stern. "Main" and "Bridge"
  are her names (_The Engineer_); "Upper", "Lower", "Fourth" and the deck
  spacing are ours. Sheer 1.8 m forward and 0.9 m aft (estimates from her
  photographs).
- **Hull form.** Generated in `carpathia.ts` like the Lusitania's: a
  14-knot intermediate liner (Froude number 0.18), parallel middle body
  x −30…+22 m, fuller ends than the express ships, a 2 m bilge radius, a
  nearly plumb stem with a rounded forefoot, a counter stern. Block
  coefficient 0.717 at her 34 ft 7 in load draught (25,074 t), 0.698 at her
  ballast draught; KM 7.74 m there, the waterplane 2,479 m², LCB −0.91 m.
- **Lightship and her ballast draught.** No source gives her
  displacement (an "8,600 tons" in some infoboxes is her net tonnage,
  8,660). At her load draught the hull displaces 25,074 t; less her
  12,000 tons (12,192 t) dead weight (_The Engineer_) her lightship is
  about 12,880 t. On 17 July she was two days out of Liverpool for Boston
  "in ballast" (Tyne Built Ships; uboat.net, as the spec cites it) with 57 passengers: about
  1,500 t of coal (some 10 days' steaming at 14 knots and 110–160 t a day,
  less two days burnt), about 700 t of fresh water, stores and people, and
  her double-bottom and peak tanks full of water ballast (about 3,400 t:
  the double bottom under the holds is about 2,600 m³ at 5 ft deep, the
  peaks most of the rest). That is 18,500 t, a draught of 8.00 m (26 ft
  3 in) on an even keel, under the
  load draught (the upper bound) and a ballast ship's usual 0.7 of it. The
  draught is a tuned value inside the 7.4–8.4 m these estimates allow
  (calibration below).
- **Stability.** No source gives her GM. KG 6.60 m gives GM 1.14 m in
  ballast (the test allows a liner's 0.3–1.5 m): her lightship's centre
  (about 0.54 of the 15.1 m depth, 8.2 m) brought down by some 5,600 t of
  water ballast, coal and stores low in her. LCG −0.91 m, over the centre
  of buoyancy (no trim in still water). TCG 0.02 m to port (see the
  calibration): undamaged she floats 1.0° to port.
- **Her profile** (measured off the photographs, scaled to the 290 ft
  bridge deck, each to about ±5 m; feet aft of the stem head): forecastle
  0–42 ft (to x 70.48 m; the 1912 starboard view gives about 42 ft, the
  2017 drawing about 26 ft; Task 2's 60 ft was at the README's ±5 m edge);
  the forward well to 145 ft (39.08 m), the foremast in it at 95 ft
  (54.32 m); the 290 ft bridge deck house from 145 to 435 ft (39.08 to
  −49.31 m), the mainmast on it at 200 ft (22.32 m) and the mizzen at
  382 ft (−33.15 m); the bridge house on the boat deck from 217 to 262 ft
  (17.14 to 3.42 m: its front some 17 ft abaft the mainmast, 45 ft long, a
  gap of about 16 ft with cowls before the funnel's casing, as the 1912
  starboard view and the LoC broadside show; Task 2 had the bridge at
  250 ft, hard against the funnel), the boat deck from its front aft to
  the house's end; the funnel at 290 ft (−5.11 m; the photographs put it
  0.47–0.50 of her length from the stern).
- **No raised poop (R21).** Three photographs agree (the 1912 starboard
  view, "RMS-Carpathia.jpg"; the Malta view from aft, "Carpathia
  Malta.jpg"; the 2017 drawing): abaft the bridge deck house one
  continuous planked deck at the upper deck's height runs to the stern
  behind open rails, and the black hull stops at it. On it stand the
  jigger mast at 493 ft (−66.99 m; the LoC broadside gives about 493 ft,
  the drawing 497 ft; Task 2 had 470 ft), a boat platform on stanchions
  just forward of it (488–467 ft, −65.46 to −59.06 m, a tier up: the
  Malta view), No. 5 hatch forward of that (x −57) and a white deckhouse
  at the stern, 510–540 ft (−72.17 to −81.31 m), one tier high, its walls
  4.6 m either side of the centre line with a walkway outside them (the
  Malta view; its length from the drawing, about 30 ft; ours to ±2 m).
  `CARPATHIA_BRIDGE_DECK`, `CARPATHIA_BOAT_DECK`, `CARPATHIA_BRIDGE_HOUSE`,
  `CARPATHIA_WELLS` (the forward well), `CARPATHIA_AFTER_DECK`,
  `CARPATHIA_STERN_HOUSE`, `CARPATHIA_BOAT_PLATFORM`, `CARPATHIA_MASTS`
  and `CARPATHIA_SUPERSTRUCTURE` export them for the model and the walk
  map. Sim boxes (they may not overlap: each runs up from the upper deck
  edge): the stern deckhouse to the bridge deck, at its own footprint
  (`halfBreadthM` 4.6: a deckhouse inboard of an open deck; the sim's
  hull is finer at the counter than the model's, so the box is clipped to
  the sim's deck abaft about −76 m: about 175 m³, the house's own
  9.1 × 9.2 × 2.6 m is 218 m³); the house forward of the bridge to the
  bridge deck; the house under the boat deck half a tier higher (the
  boat deck's houses); the forecastle to its deck. The bridge house
  itself and the boat platform are look only.
- **Funnel.** One, on the boat deck at x −5.11 m, its top 41 m over the
  keel (about 20 m from its base: in the photographs her tall, slender
  funnel stands some 3.4 times its 19½ ft width over the boat deck, and
  its top about 0.7 of the way from the water to the main truck; an
  estimate, ±2 m; the model README has the measurements). `topZ` is look
  only: the sim reads the funnel's `baseZ` (the funnel-falls rule), so
  Task 3 raised it from the first draft's 36 m without moving the sim.
  Stayed, so the liners' stays rule applies
  (`falls` missing): on the real morning it goes at 11:02:22 (10° by
  the head), as the sea reaches its base on the boat deck. Paint (`CARPATHIA_LIVERIES`, `CARPATHIA_FUNNEL_PAINTS`): her default
  livery `dazzle-1918` (the model's README cites the 1918 dazzle;
  Wikipedia: her funnel "apparently painted battle grey") with a dark
  battle-grey funnel `0x4a4f55` (the 1918 sinking photograph shows it
  nearly black against her hull); `cunard-1912` Cunard red `0xcc5a28`
  with a black top `0x141416` (titanicinquiry; the shade after Layton,
  model README "Liveries"); the recipe's `grey-1918` a lighter battle
  grey `0x7d8289` all over.
- **Subdivision.** Eight bulkheads, nine compartments (titanicinquiry: "8
  bulkheads"). The general arrangement is not online, so the positions are
  ours, argued from her hatches, masts and machinery and the accounts:
  collision bulkhead 74.0 (5% of LBP from the FP); No. 1 hold to 52.0 and
  No. 2 to 33.0 (their hatches either side of the foremast in the forward
  well, the orlop in both); No. 3 to 12.0 (its hatch under the mainmast's
  derricks through the house front); the boiler room to −8.0 (seven large
  single-ended boilers in two rows, 20 m, under the bridge and the funnel:
  GOL's "stoke hold below the bridge"); the engine room (two
  quadruple-expansion sets side by side, 17 m) to −25.0; No. 4 hold to
  −48.0 (under the mizzen's derricks); No. 5 to −62.0 (its hatch on the
  after deck, x −57); the after peak from there to the stern, under the
  boat platform and the stern deckhouse, with the steering gear: 25 m (a
  tuned value, below; the first draft's −73.0 made No. 5 25 m long and
  the after peak 14 m). Hold numbering: holds
  1–3 forward and 4–5 aft. GOL's "between the No. 4 hold and the stoke
  hold" for the first hit would number the holds 1–4 forward of the boiler
  room; Wikipedia's "near the No. 3 hatch" fits ours, and two holds aft fit
  her length (one hold from the engine room to the after peak would be
  48 m). Ruling R3 is kept: the first hit at the boiler room's forward
  bulkhead, opening No. 3 hold (Wikipedia's hatch) and the stokehold
  (GOL's); GOL's "No. 4" is noted as the disagreement. The third torpedo
  strikes "about No. 5 hatch" (GOL), aft under the after deck, near "the
  gunners' rooms" (Wikipedia), which we put in the stern deckhouse.
- **Bulkhead tops.** None is sourced. Forward of the engine room they stop
  at the main deck (12.50 m plus sheer): the 'tween deck over Nos. 1–3 and
  the boiler room is one third-class space (_The Engineer_: "the whole of
  the space forward of the boiler-room on the main deck"). The collision
  bulkhead, and the bulkheads abaft the engine room under her after cargo
  'tween decks, go to the upper deck (an assumption the calibration needs:
  below).
- **Side bunkers.** Seven large single-ended boilers (a 1903 Scotch boiler
  of 210 lb is about 15½ ft across) cannot stand four abreast inside her
  64½ ft, so they stand at most three abreast (about 50 ft with their
  gaps), leaving about 6 ft each side: the side coal bunkers usual beside
  a single-ended boiler room of the day (the Lusitania's; _Advanced Diver_
  also has "the adjacent coal bunker" beside the struck hold). The boiler
  room is a centre cell with a port and a starboard wing, the inner
  bulkheads 7.9 m from the centre line (`CARPATHIA_WING_Y`), mirroring each
  other. Bunker permeability 0.4: two days out the bunkers were nearly full
  and only the voids between the coal take water. Coal doors open while
  she steamed and jammed by the coal (the Lusitania's; Mersey: they could
  not be closed) leave 0.07 m² per bunker (`crossFlowM2`): the room and
  then the starboard bunker fill slowly through them, which is her settle
  through the morning (GOL: "now sinking more rapidly") and why her port
  list eases to about 1° by 10:50 (the photograph shows none). This is how
  she lists to port: the hit floods the port bunker and the starboard
  bunker stays dry (Task 1: a full-breadth space floods level and gives no
  list).
- **Permeability.** Holds 0.95: empty in ballast (void spaces; her
  refrigerated holds' insulation is not counted). Boiler room 0.8 and
  engine room 0.85 (the defaults). Peaks 0.95.
- **The torpedoes** (`torpedo`): port side, forward first, 8 s apart
  (R4: GOL "just seconds later"). One 1918 torpedo's hole (a First World War
  U-boat torpedo's warhead of about 200 kg: an estimate): 20 m² over 7 m of her side
  (inside the 15–25 m² and 5–8 m of a merchant ship's torpedo damage),
  4 m high, centred at a U-boat's usual 3 m running depth below her
  waterline (Schwieger set 3 m for the Lusitania): 3.00–7.00 m over the
  keel. `hitX`: the first at the boiler room's forward bulkhead (12.0: 10 m²
  into No. 3 hold, 10 m² into the port bunker), the third about No. 5 hatch
  (−57). The second strikes the engine room's middle (−16.5, 20 m²). The
  third (`finisher`) at 10:50 AM (R5): `realSpots` boiler, engine,
  `FINISHER_SPOT`, and `realNight` is `whatIfOpenings(carpathia,
realSpots)`, built in her file.
- **Headway.** 10 knots (5.14 m/s), halving every 60 s (R9: an assumption;
  she was zig-zagging at convoy speed, her engine room flooded by the
  second hit): about 450 m before she stops.
- **No portholes** (R10): a darkened ship in convoy, her side scuttles shut.
- **Boats.** Twenty lifeboats, ten a side (Wikipedia, 1912; her 1918 count
  is not in our sources), odd numbers to starboard, 1 and 2 forward: a pair
  on the bridge deck's forward house (x 30), seven pairs along the boat
  deck from the bridge aft (x 2 to −45), a pair on the boat platform
  forward of the jigger (x −62.26: the Malta view and the 1912 starboard
  view show a boat there) and the tenth pair on the stern deckhouse's
  roof (x −77: no photograph shows where it went; ours); each boat's keel
  1 m over its deck, the forward pair's deck the forward house's roof,
  level with the boat deck (as the photographs show them; Task 3 moved
  them up from the bridge deck), the after pairs' a tier over the after
  deck (`CARPATHIA_BOATS`; the model may refine them from photographs,
  keeping the indices). Eleven away (GOL, Wikipedia) from 9:25 to
  9:55 AM, both sides: 13, 15, 1, 16, 11, 3, 14, 2, 5, 12, 4. Two were
  wrecked by the second hit (GOL): we mark port boats 8 and 10, abreast
  the engine room where it struck (`wreckedAtT` 8 s, the second hit's
  time in the real morning; ours, the accounts do not number them) for
  the scene to hide or break. Those, port boat 6 and the two after pairs
  are not lowered. Order and times are ours. In a What if whose first
  torpedo comes late (the U-boat's return alone) her steam, rockets and
  boats count from that hit (`scriptedFromFirstHit`), not from 9:15 AM.
- **Steam and rockets.** `steam-start` at 10 s, `steam-stop` at 9:25 AM
  (her broken boilers and lines: no source times it). Four `rocket`s at
  9:17, 9:20, 9:24 and 9:29 AM (GOL: rockets to call the patrol vessels;
  R13). No `radio` (R14: the wireless was wrecked).
- **Floor and clock.** 150 m of sea (Wikipedia, ET; cunardshipwrecks.com
  150 m, the stern shallowest at 143 m; GOL 514 ft). The clock from 9:15 AM
  (R6 reads it as British Summer Time). Her wreck is upright with the stern
  "perfectly intact with a list to port" (cunardshipwrecks.com): `wreck:
{ restDeg: -4, minListDeg: 0 }`, a rule: landing listed to port at all,
  she lies at 4° (or her list, if more); landing to starboard she would
  keep it (the TCG below decides it). **The 4° is ours**: no source gives
  her list in degrees.
- **How deep she lies in the floor** (the real morning at rest, roll
  −4.0°, 4.3° bow down: the bow plough rule puts her stem 15 m into the
  mud and her after end bedded): her keel is about 11.3 m under the floor
  amidships, 17.4 m at the stem and 5.2 m at the sternpost; the screw
  hubs about 1.9 m under, so her screws, rudder and bilge are hidden in
  the wreck shot. Her main deck stands about 1.1 m over the floor
  amidships, the boat deck about 8.9 m (the survey: midships "nearly 10 m
  off the sea bed", a match), the stern's top about 13 m (about 137 m
  deep; the survey has the stern the shallowest part at 143 m: ours is
  about 6 m shallower). The mud is not modelled (a rule, like the rest).
- **Girder.** hog 1.9 GN·m, sag 1.7 GN·m: the Lusitania's scaled by her
  section (breadth × depth², 0.50) and mild steel's 250 MPa for the
  Lusitania's 330. The real morning's peak afloat is 0.88 of it (10:59 AM,
  as her bow goes): she does not break.

## The Britannic's data and sources

Sources (keys as in the spec): Chirnside, "The 'Olympic' Class Ships"
and his HMHS Britannic FAQ and "Would higher watertight bulkheads have
saved Titanic?" (markchirnside.co.uk) [CH]; Wikipedia, "HMHS Britannic",
largely after Chirnside [WP]; Atlantic Liners [AL]; White Star History
[WSH]; Kea Divers (keadivers.com) [KD]; titanicology.com, "Modifications
to Olympic following the Titanic disaster" (the 1913 inner skin) [TI];
Encyclopedia Titanica's watertight-door analysis and its forum on the
firemen's passage (the Titanic's layout, which the sisters shared) [ET];
the Formal Investigation's reconstruction of her position (Encyclopedia
Titanica transcription) [FI]; MarineTraffic's light list (Agios Nikolaos
light, 37.6673° N 24.3139° E) [MT]. Where they disagree:

- **Length and breadth (R2).** LOA 882 ft 9 in (269.1 m) and the LBP of
  her sisters (259.08 m) [CH: "all of Harland & Wolff's documentation is
  in agreement"; the "903 ft" is a newspaper error]. Breadth 94 ft
  extreme (28.65 m) [CH, WP], 18 in more than the Titanic's 92 ft 6 in.
  The hull is the Titanic's offsets copied (never shared: the Titanic's
  arrays stay hers), every half-breadth scaled about the centre line by
  94/92.5, the same frames and the same deck heights and sheer
  (`britannic.ts`).
- **Load (R4).** Her load condition: 34 ft 7 in (10.54 m), 53,200 long
  tons [WP]; this hull displaces 54,053 t (53,200 long tons) there, so the
  widened Titanic lines agree with her figures. On 21 November she was
  outbound from Naples (two days, about 1,100 t of coal at her sisters'
  650 t a day at service speed) with no patients aboard (about 250 t of
  people and their kit less than a full hospital ship): about 52,700 t,
  so `draught` 10.30 m (33 ft 9 in), where the hull displaces 52,653 t
  (`displacementT` 52,650). An assumption from the coal, not a measured
  draught.
- **Stability.** No source gives her GM. KM at 10.30 m is 11.73 m (0.20 m
  more than the Titanic's at the same draught: the wider beam). KG
  10.93 m gives GM 0.80 m, the Olympic's from her inclining (Hackett &
  Bedford, as the Titanic's): her extra beam is offset by her higher
  weights (the gantry davits) and the low coal burnt since Naples. Range
  0.7–1.3 m. TCG 0.02 m to starboard (coal drawn unevenly, as the
  Titanic's 0.02 m to port): 1.4° to starboard at rest. LCG −2.78 m, over
  the centre of buoyancy (level trim).
- **Subdivision and the raised bulkheads (R3).** The Titanic's fifteen
  bulkheads at the same frames. Six raised to B deck (WP's design
  section; its sinking section and AL say five): D (forward of boiler
  room 6), F (boiler rooms 5/4: "the stepped-up extension ... to the
  underside of B-deck" [CH's FAQ]) and K (aft of boiler room 1), the three
  CH names in his FAQ and forum notes, with E, G and H, the boiler-room
  bulkheads between them (our assumption, the "six" of most sources).
  The rest as the Titanic's: A to C deck, B to D, C and J to E, L–P to D.
  A top above C deck (the hull's top) never spills: water reaching C
  deck goes on into the superstructure boxes, as for every ship.
- **Inner skin.** Along all six boiler rooms and the reciprocating and
  turbine engine rooms [WP, AL, WSH]; on the Olympic of 1913, about 30 in
  inboard of the shell below G deck and 36 in above it, tank top to F
  deck [TI]. Each such space is a centre cell with a narrow starboard and
  port void (`span`, no cross flow: the skin is watertight), `span.y` the
  hull's half-breadth at the space's middle at her waterline less 0.85 m
  (so boiler room 6's void follows the narrowing hull). Void permeability
  0.95. The void cells run full height (the skin stops at F deck): above F
  deck that is about 0.85 m of her cabins at the side, a few per cent of
  the room's volume.
- **The mine (`realNight`).** "Between holds two and three" on the
  starboard side [WP]: one hole in hold 3's shell 2 m aft of the hold 2/3
  bulkhead, 2.5–7.0 m over the keel (a moored mine at 5–7 m under the
  sea), 12 m² (range 5–25 m², a 1916 moored mine's charge of about
  150–200 kg; its size moves her time by about a minute across 5–25 m²:
  the doors and the tunnel set her pace). The wreck lies on that side, so
  the hole has not been seen [WP].
- **Torn bulkheads and the door (`doors`, R7).** All with the real mine
  only (`kind: "damage"`), except the 6/5 door:
  - hold 2/3 bulkhead (C), torn where the mine went off against it: 1 m²
    at 2.5–7 m (range 0.5–5);
  - the firemen's tunnel: a watertight passage on the tank top from the
    stair tower aft of bulkhead B through holds 2 and 3 to a door at the
    foot of bulkhead D into boiler room 6 [ET], "seriously damaged", the
    water flowing into boiler room 6 [WP]: 1.5 m² at the tank top (1.6–3.6
    m; range 0.5–3: the tunnel's section is about 3 m²);
  - the stair tower, which rises from the tunnel aft of B and opens at G
    deck into the crew spaces over hold 1 [ET]: 0.5 m² at G deck (range
    0.3–2). With the torn tunnel it is how hold 1 fills: "the first four
    watertight compartments were filling rapidly" [WP], hold 1 among them;
  - the forepeak bulkhead (A), damaged [WP]: 0.5 m² at 3–7 m (range 0.2–2);
  - the boiler room 6/5 watertight door (`kind: "door"`), which "failed to
    close properly" [WP]: a sliding door stopped short, the gap under it
    0.5 m² (1.1 m wide, 0.45 m high; range 0.1–1.0 m², a full door about
    2 m²). Divers later found several doors open [KD/WP]; the sim has
    only this one, and `doorsClosed` shuts it.
- **Portholes (R8).** "Most of the lower-deck portholes forward" were
  opened by the nurses to air the wards, against orders; those on E deck
  went under about 15 minutes after the mine [WP]. A row 1 m over E deck
  from bulkhead G (about amidships) to the forepeak bulkhead, and 1 m over
  F deck over the holds (D to A), both sides, following the sheer;
  0.02 m² per metre (16-inch scuttles, 0.126 m², about every 3 m, about
  half of them open; range 0.015–0.045). Above the inner skin's top, so
  `inboard`: they open into the room, not the void (`PortholeRow.inboard`,
  1.4). Her other scuttles shut.
- **Her run for Kea (R9, R10, R11).** About 20 knots at the mine, the
  most allowed in coastal waters [FI] (service speed 21 kn [WP]). The
  speed profile: 20 kn at 8:12; 14 kn by 8:15 through her turn (her
  steering gone, she steered on her shafts, the port one faster [WP]);
  2 kn by 8:18, slow enough to lower boats (they were lowered with her
  screws still turning [WP]); stopped at about 8:35 (no source gives the
  time, R9), coasting (`HEADWAY_STOP_HALF_LIFE_S`); slow ahead, 3 kn,
  again at 8:50 [WP]; stopped at 9:00 [WP], coasting. 4.73 km (2.6 nmi)
  by 9:06. Her strike was "about 3 miles off Port St Nikolo light,
  bearing N 48° W" [FI] (Bartlett: Kea about 3 miles), or 4 nmi
  (Divernet, Greeka); the wreck (37°42′05″ N 24°17′02″ E [WP]) lies 1.5
  nmi off Kea's north-west point [KD], so she covered 1.5–2.5 nmi:
  ours is at the top of that. A faster run for Kea does not fit the
  wreck's place. The turn: from her course for Mudros up the channel
  (N 18° E, the bearing of Mudros) to about east (the wreck lies about
  east of the [FI] position, toward Kea's nearest shore): 70° to
  starboard over 8:12:30–8:16 (`headway.turn`). The ram head forward of
  x = 63 m (her forward quarter, the stem at 130 m): Cp 0.5 (range
  0.2–1.0: the bow's pressure field on a hole in a moving hull, 1 at the
  stagnation point).
- **Shelter (R18).** None. On her R9 profile she stops at 9:00 with
  4.7 km run and 1.5 nmi still to go to Kea [KD]: no run that follows
  the profile reaches the beach, so `shelter` would never fire (with her
  engines stopped she coasts 2.2 km). A What if that keeps her going
  after 9:00 would need its own profile (controller's call).
- **Boats (R5).** 48 [WP]: five gantry sets of six [WP: each could handle
  six; eight designed, five fitted], one to starboard forward abreast
  the first funnel by the officers' quarters (x 54 m) and four aft by
  the fourth funnel (x −38 and −61 m, a pair each side); a set's six
  boats share its x (two rows across, three tiers high: the model
  README). Welin davits for the rest, double-banked: six at the port
  forward position (its gantry never fitted; x 42, 53, 63.5 m) and six
  a side amidships between the second and third funnels (x −11, 0.5,
  12 m). Positions measured off her photographs (model README). 35 launched and stayed
  afloat [WP]: `boat-lowered` from 8:25 to 8:50, one about every 44 s,
  aft first. Which boats went when is not in our sources.
- **Funnels.** The Titanic's positions and heights; the fourth a dummy
  (as her sisters'). All four may fall: they "collapsed one after the
  other" as she capsized [WP].
- **Floor, clock, wreck.** 120 m (400 ft, 122 m [WP, GOL]; 119 m in one
  dive guide), the clock from 8:12 AM. `wreck: { restDeg: 90,
minListDeg: 10 }`: she lies on her starboard side [WP, WSH].
- **Girder.** hog 6.0 GN·m, sag 5.5 GN·m. The Titanic's 4.9 GN·m is
  about 18 m³ of section modulus at about 250 MPa; the Britannic's wider
  beam (+1.6%) and inner skin (two 12.7 mm plates 9.6 m deep low in the
  section, about +2.5% of the second moment) make about 18.75 m³, and the
  warm Aegean (about 18 °C, against the Titanic's −2 °C) leaves the
  same riveted steel tougher: 250–320 MPa, 4.7–6.0 GN·m. She did not
  break (her bow bent on the floor [WP, GOL]); her peak is 0.97 of 6.0
  GN·m (9:03:19, as her bow strikes); at 5.3 GN·m she breaks 21 s before
  the bow lands. The top of the range: a concern (see "Known limits").

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

### The Fitzgerald's calibration

Tuned against the history (a starboard list by 3:30 PM, a "bad list" by
5:30, water rising all evening, still afloat and "holding our own" at
7:10, gone a few minutes later bow first with no call for help, the bow
on the floor, the stern upside down) and the brief's checks, everything
else fixed. Her real run has all the reported damage (R14: topside, the
covers, the shoal graze), she rides the waves, their crests are second
order and green water stands on her deck.

**The sisters' time decides the outcome (ruling R15).** Robustness to
the sisters' time (R13's check: sink her by 7:45 PM from any time in
7:06–7:18) asked for more than the physics gives, and is dropped: the
real loss was itself contingent on the big seas, which is what the
"three sisters" account says. Instead `realStorm.test.ts` pins the data's
time inside the window the record gives. Captain Cooper of the Anderson
reported two very large seas overtaking his ship about 6:30 PM, roughly
10 miles astern of her, about 30 minutes of group travel before they
would reach her: the re-locked group (`track.storm.groups[0].t`) must
sit in 7:00–7:15 PM. Her own outcome
with the group moved (`npx tsx scripts/shipwreck-sim.ts --ship=fitzgerald
--sisters-at=<h:mm>`, the real run otherwise):

| Sisters at | First cover | Outcome                         |
| ---------- | ----------- | ------------------------------- |
| 7:06 PM    | none        | **floats**: Whitefish Bay 8:25  |
| 7:08 PM    | 7:08:03     | sinks 7:17:30                   |
| 7:10 PM    | none        | **floats**: Whitefish Bay 8:25  |
| 7:12 PM    | 7:11:37     | sinks 7:12:45 (the data's time) |
| 7:14 PM    | none        | **floats**: Whitefish Bay 8:25  |
| 7:16 PM    | 7:16:14     | sinks 7:17:45                   |
| 7:18 PM    | none        | **floats**: Whitefish Bay 8:25  |

So 7:06, 7:10, 7:14 and 7:18 float and 7:08, 7:12 and 7:16 sink her. At
the floating times the sea under the group is in a lull (at 7:10 the
highest crest under her midships within a period of the lock is 0.6 m,
against 3.1 m at 7:12); on the topside damage alone even 8 m sisters
(waves over 17 m) fail no cover at 7:10. The story may say she very
nearly made it.

| Parameter       | Value                                | Why                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The sea's ramp  | 5.7 m → 7.6 m, 3:30 → 8 PM           | The hindcast, not tuned. The worse storm (9.5 m at its height) fails a cover at 4:57 PM.                                                                                                                                                                                    |
| Hatch leak      | 0.30 m² a cover                      | About a 7.5 mm average gap round the cover's 40 m edge (11 ft 7 in × 54 ft), inside the 2–10 mm kept as honest for covers with most clamps undone. Not tuned: 0.1–0.5 m² let in 40–206 t by 7:00 PM and the bow goes under at 7:13:23–7:13:32 in each.                      |
| Failure head    | 3.5 m                                | About three times the 4 ft design head, under the NTSB's 12.5 ft (3.81 m). 2.6 m fails covers at 4:57 PM (she sinks at 6:41); 2.8–4.5 m put the bow under at 7:12:05–7:16:30; 5.0 m fails none. Tuned: about the middle of that window.                                     |
| Deck-edge split | 0.1 m², 0.3 m under the deck edge    | A 5 mm crack over 20 m of sheer strake where the fence rail went (the USCG's "fence rail down"). Not tuned: 0.05–3 m² all leave the tanks dry (the pumps win) and the bow under at 7:13:18–7:13:27.                                                                         |
| Broken vents    | 0.05 m² each                         | An 8 in pipe torn off with the deck round its base. 0.03–0.1 m² change nothing.                                                                                                                                                                                             |
| Three sisters   | 5 m on top of the sea, 3 waves, 7:12 | Kept. None and she reaches Whitefish Bay, graze and all. Their time decides whether (above). With the topside damage alone (round 2): at 6 m 7:08, 7:12, 7:14 and 7:16 sink her (7:14 not until 7:53); at 7 m and 8 m all but 7:10, the waves she meets then 17 m and more. |
| Deck water      | dam break on, critical flow off      | Not tuned: (8/27)·√g and √g·(2/3)^1.5, the textbook discharges (Ritter; Goda et al. 1976; Buchner 2002).                                                                                                                                                                    |
| Crests          | Tayfun second order                  | Not tuned: k_m from the spectrum.                                                                                                                                                                                                                                           |
| Tank burst      | their vents (0.13–0.195 m²)          | Physical, not a tuning knob: deep down a tank's air leaves by its own two vents, not the 1.0 rule's 3 m².                                                                                                                                                                   |
| Shoal strips    | 0.05 m² each, 3 strips               | In her real run (R14). Tuned to her reported list against her pumps: 5.0° by 5:30 (1,349 t aboard) and she sinks at 7:12:45; in still water 4.8° at 5:30, 6.0° at 9:00 PM, and she floats. (First data: 0.03 m² the pumps held; 0.3 m² sank her by 4:30.)                   |
| Girder          | 2.0 GN·m                             | Not tuned to timing: 1.6–3.0 GN·m all break as the bow strikes, none afloat.                                                                                                                                                                                                |
| Hull            | Cb 0.842, 34,750 t, LCG 1.32 m       | The nearly plumb stem (photographs); the displacement follows the hull at her draught, trim 0.11 m by the stern.                                                                                                                                                            |

The first data's README claims the drift audit found wrong, corrected:
without the sisters she went down at 7:27:55 PM (not 7:21); a 3.3 m
failure head failed cover No. 7 at 6:42:02 PM (not "3.4–3.6 all pass");
only 0.25–0.35 m² of the old shell split met the window (0.2 floated,
0.4 sank at 7:04:49, 0.5 at 6:57:24). Those runs used the still-water
pose and the underwater splits, which are both gone.

**Sweeps (this data, R14).** Each line is one run of
`npx tsx scripts/shipwreck-sim.ts --ship=fitzgerald <flags>`:

| Flags                                    | First cover | Bow under | Outcome                                |
| ---------------------------------------- | ----------- | --------- | -------------------------------------- |
| (none: the real run)                     | 7:11:37     | 7:12:03   | sank 7:12:45, broke as the bow lands   |
| `--sisters=none`                         | none        |           | Whitefish Bay 8:25                     |
| `--sisters-at=7:06` `7:10` `7:14` `7:18` | none        |           | Whitefish Bay                          |
| `--sisters-at=7:08`                      | 7:08:03     | 7:16:47   | sank 7:17:30                           |
| `--sisters-at=7:16`                      | 7:16:14     | 7:17:04   | sank 7:17:45                           |
| `--storm=none`                           | none        |           | floats to 9:00 PM (1,568 t, list 6.0°) |
| `--no-damage` (no graze, no topside)     | 7:11:37     | 7:13:27   | sank 7:15:16 (121 t by 7:00, no list)  |
| `--tight`, `--storm=calmer`              | none        |           | Whitefish Bay                          |
| `--storm=worse`                          | 4:56:55     |           | sinks 5:01:54                          |

Round 2's sweeps (topside damage alone, which `--no-damage` plus the
flags below with the shoal spots off reproduce): failure head 2.6 m
fails covers at 4:57 PM (sinks 6:41), 2.8–4.5 m put the bow under at
7:12:05–7:16:30, 5.0 m none; leak 0.1 / 0.5 m² let in 40 / 206 t by 7:00;
splits of 1 and 3 m² and vents of 0.1 m² change nothing before 7:00.

### The Britannic's calibration

Every value is physical and inside its stated range ("The Britannic's
data"); nothing is scripted but the explosion, the boats and her 9:00
whistle (a `radio` 0 event, "engines stopped; two long blasts on the
whistle" [WP]; a signal with no physics, for the caption and the sound).
Against the history (E-deck portholes under about 15 min after the mine, a list to
starboard, the bow on the 120 m floor before the stern is under, gone in
55 min, on her starboard side), one at a time from the chosen values
(real morning: under at 54:01; bow lands 51:55):

| Parameter           | Value                 | Sensitivity (stern under after the mine)                                                                                                                                                 |
| ------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mine hole           | 12 m²                 | 5 m² → 55:21, 25 m² → 53:54: the holds fill in minutes either way.                                                                                                                       |
| 6/5 door gap        | 0.5 m²                | 0.1 → 78:26, 1.0 → 50:47. Shut (`doorsClosed`): she floats (five spaces).                                                                                                                |
| Tunnel              | 1.5 m²                | 0.5 → 70:48, 3 → 50:38.                                                                                                                                                                  |
| Torn 2/3 bulkhead   | 1 m²                  | 5 → 53:14.                                                                                                                                                                               |
| Stair tower         | 0.5 m²                | 2 → 53:29.                                                                                                                                                                               |
| Porthole open area  | 0.02 m²/m             | 0.015 → 63:13, 0.045 → 37:46. Shut: she floats (trim 5.1°, 26,500 t). The E-deck row over boiler room 4 is what sinks her (rows from F, 36.9 m, forward only: she floats, in the sweep). |
| KG (GM)             | 10.93 m (0.80 m)      | Sets the capsize: GM 1.00 m: at most 11.5° before the bow lands; 0.60 m: 67.5°. At GM 1.0 m she breaks even at 5.8 GN·m.                                                                 |
| TCG                 | 0.02 m to starboard   | 0.01 → at most 17.8°, 0.04 → 37.5° before the bow lands. 0: she never rolls (a symmetric hull with full-breadth spaces).                                                                 |
| Ram Cp              | 0.5                   | 0.2 → 54:09, 1.0 → 54:00: her way is gone by 8:18, so the ram works only in the first minutes.                                                                                           |
| Girder              | hog 6.0, sag 5.5 GN·m | Peak 0.97 as the bow strikes. 5.3 GN·m: breaks at 49:48, 21 s before the bow lands.                                                                                                      |
| Steady (mine ships) | roll rate 2e-4 rad/s  | Not timing: a mine in a double-skin void trades water in pulses that rock her by about 1e-4 rad/s; at 1e-5 four of the six boiler-room spots never log `floating-steady`.                |

What if (her real spot, multi-select toggles; `realMorning.test.ts`):

| Portholes | Doors      | Engines | Outcome                            |
| --------- | ---------- | ------- | ---------------------------------- |
| open      | stuck open | run     | sinks 54:01 (the real morning)     |
| open      | stuck open | stopped | sinks 54:03                        |
| open      | closed     | run     | floats, steady at 35:00 (14,170 t) |
| open      | closed     | stopped | floats, steady at 35:00            |
| shut      | stuck open | run     | floats, steady at 64:38 (26,500 t) |
| shut      | stuck open | stopped | floats, steady at 66:36            |
| shut      | closed     | run     | floats, steady at 40:51            |
| shut      | closed     | stopped | floats, steady at 40:45            |

A mine at any boiler or engine room fills only its starboard void and
she floats (list about 3–4°); a mine at hold 1 or the forepeak alone,
without the real mine's torn bulkheads, floats too.

### Storm parameters (1.3)

Shared by any ship with a storm; the Fitzgerald's own values are hers.

| Parameter             | Value                                | Why                                                                                                                                                                                                                          |
| --------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deck samples          | every 0.25 s                         | A crest over a hatch lasts a few seconds; four samples a 1 s step follow it without a smaller step for the whole ship.                                                                                                       |
| Spectrum              | JONSWAP γ 3.3, 24 bins, 0.65–2.2 fp  | A fetch-limited wind sea (Superior's long north-west fetch); 24 jittered bins keep a long record from repeating.                                                                                                             |
| Directional spread    | ±30°                                 | A short-crested wind sea (a cos²-like spread is about this wide).                                                                                                                                                            |
| What-if storms        | calmer × 0.6, worse × 1.25           | 4.6 m: a gale the lakers took routinely; 9.5 m: about the most hindcast for Superior.                                                                                                                                        |
| Tight hatch covers    | no leak, × 2 the failure head        | An assumption: all Kestner clamps done up and the gaskets whole hold about twice the head that a cover with clamps missing does.                                                                                             |
| Way after going under | halves in 45 s                       | Drag of the flooded hull's section against its mass and added mass (above).                                                                                                                                                  |
| Stern capsize         | 10°/s real, or the ship's `rollDegS` | A rule, from when the stern is wholly under. The Fitzgerald's 50°/s: her stern is wholly under as she breaks and strikes the floor about 4 s later (real), so it is over (180°) in the water, not on the floor (ruling R10). |
| Ride                  | quasi-static Froude–Krylov           | Her heave, pitch, roll on the waves for the deck openings and the scene (above). Not tuned: L, B, T are her LBP, beam, draught.                                                                                              |
| Roll slope factor     | r = 0.73 + 0.6·OG/d, in [0, 1]       | IMO 2008 IS Code's effective wave slope coefficient: 0.52 for her (KG 5.40 m, draught 8.33 m).                                                                                                                               |
| Ride fade             | 10 s from bow under                  | Her waterplane goes as the bow dips; the ride is hers only while she floats.                                                                                                                                                 |
| Crests for boarding   | Tayfun's second order                | η + (k_m/2)(η² − ζ²): storm crests stand higher than linear ones (above). The deck openings and the deck water see it; buoyancy, the ride and the lock stay linear.                                                          |
| Green water on deck   | bays, dam break on, critical off     | A laker's open deck (`openDeck`): onto it over the edge (8/27)·√g·h^1.5 per metre, off it √g·(2h/3)^1.5, along it by the same weir; its weight not in her trim and list.                                                     |
| Ramp                  | the ship's own (`StormSpec.ramp`)    | A storm builds: the Fitzgerald's follows the hindcast. The groups keep their own heights.                                                                                                                                    |

### The Carpathia's calibration

Every value below is physical; no time is scripted but the steam, the
rockets and the boats. Tuned against the history (a list to port of a few
degrees, settled by the head, afloat 95 minutes until the third torpedo,
then gone **bow first** within minutes, as the sinking photograph shows,
upright on the floor listed to port) and the spec's pass criteria, all
other things fixed. The first draft (ballast draught 7.44 m, KG 7.2 m,
holds 0.85, bunkers 0.6, coal doors 0.1 m², the boiler room at −12…8 m,
every bulkhead to the main deck, No. 5 hold to −73 m) listed 20° 13 s
after the hit, trimmed 0.3° by the head, and after the third torpedo went
down stern first in under 3 minutes (10:53 AM), breaking as her stern
struck the floor. A second round (7.80 m, coal doors shut, No. 5 hold to
−73 m) met every criterion but went down stern first at −58° (11:00:27
AM): the photograph rules that out. The table's alternatives change one
value from the final set.

**What decides which end goes first.** No. 5 hold's water (the third
torpedo's) is about 2,000–3,000 t abaft her centre of flotation and comes
in within a minute; what is left forward of the boiler room (Nos. 1 and 2,
the peak) is buoyant and dry unless the water in No. 3 has started over
its forward bulkhead. So she goes bow first only if her forward holds are
already filling when the third torpedo comes, and her end then has to be
steep enough to beat the stern down but not so steep that her bow strikes
the 150 m floor (she is 170 m long) while her stern still floats: a plunge
past about 58° does that, and the impact breaks her girder at any honest
strength (it takes over 4 times hers). Her settle through the coal doors
times the first; the length of No. 5 hold sets the second.

| Parameter           | Value                     | Why                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ballast draught     | 8.00 m (18,500 t)         | Inside the 7.4–8.4 m her lightship, coal, stores and tanks allow. 7.9 m: gone at 11:04:08 (doors 0.08); 8.1 m: her forward holds overflow before 10:50 and she is gone at 10:50:16 (bow strike, breaks).                                                                                                                                                                                                      |
| Coal doors          | 0.07 m² per bunker        | Jammed open with coal (the Lusitania's 0.1). They settle her through the morning (sinkage 11.15 m at 9:25, 12.38 at 10:50, No. 3's water just under its forward bulkhead's top). 0.06: gone at 11:04:17; 0.08: 10:59:46; 0.088: 10:55:15 and the dip down to 0.05°, but no later than without the third torpedo (and with No. 5 a metre shorter her bow strikes the floor and she breaks); shut: stern first. |
| After peak bulkhead | −62 m (No. 5 hold 14 m)   | Under the boat platform (Task 2 had it near a poop front at −64.6, which R21 removed). At −64.5 she goes down stern first at −48°; at −73 (the first draft), −55°. A shorter No. 5 (G at −50 or −51) takes the dip away but steepens her end past 60°: her bow strikes the floor and she breaks.                                                                                                              |
| KG (GM)             | 6.60 m (1.14 m)           | The first minute's list (the port bunker floods in seconds): 9.7° at 6.60 m; at 7.80 m draught (the second round) 9.0° at 6.5 m, 12.7° at 6.75 m, 15.6° at 6.9 m (past the spec's 15°).                                                                                                                                                                                                                       |
| Bunker permeability | 0.4                       | Nearly full of coal two days out. At 0.6 (second round): 13.3° in the first minute, and she lands listed to starboard.                                                                                                                                                                                                                                                                                        |
| Hold permeability   | 0.95                      | Empty in ballast. At 0.85 (second round) she trims 0.6° by the head (0.8° at 0.95) and the third torpedo does not sink her.                                                                                                                                                                                                                                                                                   |
| Machinery positions | boiler room −8…12 m       | The first draft (−12…8) trimmed her 0.3° by the head; 4 m forward (still under the bridge and the funnel) 0.8°.                                                                                                                                                                                                                                                                                               |
| After bulkhead tops | the upper deck (F, G, H)  | At the main deck No. 5 hold's water spills into No. 4 and the after peak at once and she goes down by the stern.                                                                                                                                                                                                                                                                                              |
| TCG                 | 0.02 m to port            | She lands with almost no list; without it she lands to starboard (the rule keeps it). Coal drawn from her starboard bunkers first, or stores: an assumption. Undamaged she floats 1.0° to port.                                                                                                                                                                                                               |
| Torpedo hole        | 20 m², 7 m long, 4 m high | Not tuned: 15 m² ends within 2 minutes of 20 m², and the dip after the third torpedo is the same (the hold fills in about a minute either way).                                                                                                                                                                                                                                                               |
| Rest                | `wreck`: −4°, from 0°     | A rule, not tuned: upright, a little to port (cunardshipwrecks.com).                                                                                                                                                                                                                                                                                                                                          |

**Fourth round (Task 4b: R21 and R22).** Her boxes changed with her
profile: the poop box (full breadth, −86.8 to −64.55 m, 22 m) became the
stern deckhouse (−81.31 to −72.17 m, 4.6 m either side); the forecastle
box shortened from 60 to 42 ft (its after end 64.99 → 70.48 m); the
boat deck's front (the box boundary under it) moved from 250 to 217 ft
(7.08 → 17.14 m). No tuned value moved: the boxes only bear once she is
going, and the ending barely changes (stern-under 6,469.2 → 6,468.0 s,
57.2° by the head at it both times, the dip the same 0.77° for 494 s,
peak girder use 0.87 → 0.88). One at a time from the final set: no stern
house at all 6,468.0 s and 57.7°; the stern house at full breadth
6,467.9 s and 57.4°; the old poop box 6,468.1 s and 57.6°; the 60 ft
forecastle 6,472.2 s and 56.9°; the bridge at 250 ft 6,465.0 s and
56.7°. None breaks her. The way down is the new `pivotDrag` rule (see
"The way down") with `descentTimeScale` 1.

The real morning: −3.6° at 9:25, easing to −1.0° by 10:50; 0.8–1.0° by
the head until 10:50 (sinkage 12.38 m); the third torpedo brings her to
**0.8° by the stern from 10:50:13 to 10:58:26** while No. 5 hold fills
and her forward holds start to take No. 3's water; by the head again from
10:58:26, her bow under at 11:00:48, the forecastle at 11:01:33, the
bridge at 11:02:08, the funnel at 11:02:22, and her stern the last part
under at 11:02:48 AM (6,468 s) with her bow down 57°; her bow strikes
the floor as her stern goes, and her stern comes down to it 16 s later
(at most about 12 m/s), at rest 31 s after stern-under. No breakup (peak
0.88). At rest −4.0° to port, 4.3° bow down (her stem in the mud), the
lowest point at −167 m. Without the third torpedo she goes down by the
head at 11:15:51 AM (in that What-if her bow strikes the floor first and
she breaks at 11:15:35).

The spec's bow-first criterion first asked for her by the head at every
frame; the eight minutes at up to 0.8° by the stern after the third
torpedo did not meet it. No configuration we found inside honest ranges
met it and the rest together: a by-the-head trim before 10:50 large
enough to absorb No. 5's water (about 1.7°) comes only in the last few
minutes before her forward holds overflow, so she sinks before 10:55 or
before the third torpedo, and a shorter No. 5 hold makes her end steep
enough to strike the floor. Ruling R20 allows the dip (up to 1° by the
stern for at most 10 minutes after the third torpedo): **met**, 0.77°
for 8 min 14 s (`carpathiaMorning.test.ts`, the R20 envelope).

The two shared changes she needed (no-ops for the other ships: every golden
and their What-if tests pass unchanged): a run does not freeze as steady
while a torpedo is still to come (the U-boat's return alone was otherwise
never taken in; `torpedoSpec.test.ts` checks it on the torpedo test ship),
and a whole hull that falls onto its after half settles as a stern does
(`sternFirst`; `seabed.test.ts` on a box). Her bow-first end no longer
uses `sternFirst`. See "The way down".

## Pass criteria (enforced by `__tests__/`)

| Criterion                                           | Result                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Undamaged: floats at her draught ±0.1 m, trim ±0.2° | 9.82 m, trim 0.00° (list 1.4° to port from the TCG)                                     |
| Displacement within 3%, GM 0.6–2.5 m                | +0.1%, GM 0.80 m                                                                        |
| Breakup 2:05–2:25 AM                                | 2:14:01 AM (±5% strength: 2:12:06, 2:15:51)                                             |
| Break 35–45% of LBP from the stern, funnels 3–4     | x = −27.1 m, 39.5%                                                                      |
| Trim at the break 8°–25°                            | 10.8°                                                                                   |
| Stern under 2:10–2:30 AM                            | 2:15:52 AM                                                                              |
| List under 10° before the break                     | at most 1.5° (to port)                                                                  |
| What if 1–4 forward (every subset): afloat, whole   | all 15 float, steady by 12:30 AM                                                        |
| What if 5 forward: later than the real night        | sinks 2:52:48 AM (breaks 2:50:58)                                                       |
| What if 7 forward: sooner                           | sinks 1:12:23 AM                                                                        |
| Every single compartment, first 1–8, mixed sets     | float steady, or sink with every part on the floor                                      |
| Deterministic                                       | two runs deep-equal                                                                     |
| Whole real night `simulate`                         | about 0.8–1.2 s (test allows 3 s and logs it)                                           |
| `advance(8)`                                        | slowest call about 8.5 ms                                                               |
| Lusitania: displacement within 2%, GM 0.5–1.2 m     | 35,654 t (+0.0%), GM 0.84 m; Cb 0.610 at load                                           |
| Lusitania: list ≥ 12° by 2:15, at most 15–30°       | 21.7° at 2:15, at most 24.8°                                                            |
| Lusitania: down by the head from 2:12               | trim > 0 from 2:12 on (1.5° then)                                                       |
| Lusitania: bow on the floor, stern in the air       | bow lands 2:27:25 PM, trim 26°                                                          |
| Lusitania: gone at 2:25–2:32 PM (real 2:28)         | 2:28:05 PM, no breakup                                                                  |
| Lusitania: at rest on her starboard side (≥ 45°)    | 75° (she goes under at 59°; the survey's rule)                                          |
| Titanic What-ifs as 1.0                             | 83 checked frame by frame against e5fd6da4: same                                        |
| Lusitania: explosion within 30 s                    | 8 s                                                                                     |
| Lusitania What-if: 12 spots × portholes open/shut   | all finite, all float steady or rest on the floor                                       |
| Lusitania portholes shut at the real spot           | floats (open: sinks at 2:28:05 PM)                                                      |
| Lusitania real afternoon `simulate`                 | about 0.5–0.9 s (the Titanic's 3 s budget)                                              |
| Lusitania tracks as 1.1                             | 3 runs, every 50th frame to 1e-9: same                                                  |
| Storm field: 4σ of a 6 h record                     | within 5% of Hs at three places                                                         |
| Fresh water: same mass floats deeper                | 1025/1000 by volume                                                                     |
| Box laker: calmer ships less, worse more            | < 0.5×, > 1.5× the real storm's water in 30 min                                         |
| Box laker: a hatch fails under its head of water    | `hatch-fails`, then > 5× the inflow                                                     |
| Box in 120 m: bow upright, stern upside down        | bow 0°, stern 180°, 5 m apart, none in the floor                                        |
| Fitzgerald: LOA, beam, depth, displacement, GM      | 222.2 m, 22.86 m, 11.89 m; 34,750 t, 3.80 m                                             |
| Fitzgerald: freeboard 3.2–3.8 m, cargo 26,535 t     | 3.56 m; 26,535 t (41.1/15.5/43.4% by hold)                                              |
| Fitzgerald: starboard list 1–8° at 5:30 PM (R14)    | 5.0° (topside alone: 0.0°)                                                              |
| Fitzgerald: water rising, afloat at 7:10            | 754 / 1,349 / 1,795 / 2,031+ t at 4:30–7:10                                             |
| Fitzgerald: storm's water over her deck, by 7:00    | 490 m³ (her holds'); the graze the tanks'                                               |
| Fitzgerald: still water, all damage: afloat 9:00 PM | floats, 1,568 t, list 6.0°                                                              |
| Fitzgerald: sisters' time inside 7:00–7:15 PM (R15) | 7:11:55 PM (re-locked); the table above                                                 |
| Fitzgerald: still water sinks nothing by 9:00 PM    | floats, no cover fails                                                                  |
| Fitzgerald: a cover fails, bow under 7:10–7:25      | first cover 7:11:37 PM, bow under 7:12:03 PM                                            |
| Fitzgerald: bow lands ≤ 3 min, stern top ≥ −5 m     | 7:12:44 PM (41 s), house +2.6 m, hull +0.8 m                                            |
| Fitzgerald: stern under ≤ 5 s after the bow lands   | 1.7 s                                                                                   |
| Fitzgerald: breaks after the bow lands              | as it strikes, x = 17.9 m, before the stern lands                                       |
| Fitzgerald: stern rolls in the water (R10)          | 180° as it first touches; 0° more on the floor                                          |
| Fitzgerald: rests                                   | bow 0.1°, stern 180°; sections 35 m apart                                               |
| Green water: on and off her deck in seconds         | a 4.2 m swell: yes; still water, a 1 m sea: none                                        |
| Fitzgerald: funnel stays; dive in real time (R11)   | no `funnel-falls`; shown t = real t                                                     |
| Fitzgerald ride: pitch ≤ 6°, roll ≤ 10°             | at most 2.0°, 0.6°                                                                      |
| Fitzgerald What-if: 24 runs                         | all finite, inside endT; no damage sinks later                                          |
| Fitzgerald: real spots = real run; none + calmer    | identical tracks; she reaches Whitefish Bay                                             |
| Carpathia: LOA, LBP, beam; displacement, GM         | 170.08, 164.59, 19.66 m; 18,509 t (+0.0%), 1.14 m                                       |
| Carpathia: hits at 0, 8 and 5,700 s, port side      | `torpedo-hit` 2 at 8 s, 3 at 5,700 s (10:50 AM)                                         |
| Carpathia: list to port 0.5–10° at 9:25, ≤ 15°      | 3.6° at 9:25 (1.0° by 10:50); at most 9.7° (15 s)                                       |
| Carpathia: down by the head 9:25–10:50              | 0.82° at 9:25, 1.02° at 10:50                                                           |
| Carpathia: afloat at 10:50, forecastle edge out     | sinkage 12.38 m (from 8.00), 11,387 t aboard                                            |
| Carpathia: stern under 10:55–11:50 AM               | 11:02:48 AM (6,468 s)                                                                   |
| Carpathia: bow first, stern last (the photograph)   | bow down 57° at stern-under; met under R20 (≤ 0.8° by the stern, 8 min 14 s)            |
| Carpathia: her way down is seen (R22)               | 31 s stern-under to rest in real time; stern ≤ 12.2 m/s; stern lands 16 s after the bow |
| Carpathia: no breakup afloat; rests upright to port | none; roll −4.0°, pitch +4.3°, lowest −167.1 m                                          |
| Carpathia: without the third torpedo                | sinks later, 11:15:51 AM; all nine single hits float                                    |
| Carpathia What-if: 97 runs (sims lane)              | all finite, inside `END_T`; 3+ hits ≤ the first two                                     |
| Carpathia real morning `simulate`                   | about 0.45 s (the test allows 4.5 s)                                                    |
| Britannic: LOA, beam; displacement, GM              | 269.1 m, 28.65 m; 52,653 t (+0.0%), 0.80 m                                              |
| Britannic: explosion at the mine                    | 8:12:01 AM (1 s)                                                                        |
| Britannic: added list ≥ 2° by 8:30, growing to 8:55 | not met (−0.7°, −0.9°): `it.failing`, Known limits                                      |
| Britannic: adds 8–30° of list before the bow lands  | 25.0° (as the bow strikes, 9:03:55)                                                     |
| Britannic: down by the head from 8:17 AM            | yes (1.5° at 8:17, 3.4° at 8:27)                                                        |
| Britannic: E-deck portholes under 10–22 min         | 12:28 after the mine (real about 15)                                                    |
| Britannic: bow lands before the stern is under      | bow 9:03:55, stern 9:06:01 (up then)                                                    |
| Britannic: gone in 45–65 min (real 55), whole       | 54:01 (9:06:01 AM); girder peak 0.97                                                    |
| Britannic: rests on her starboard side (≥ 60°)      | 89.9°                                                                                   |
| Britannic: funnels fall one after another           | 9:00:26, 9:02:33, 9:03:29 (dummy 9:04:05)                                               |
| Britannic What-if: 8 toggle combinations            | all finite, in endT; any one fixed: later                                               |
| Britannic: a mine in a boiler room's double skin    | floats steady (each of the six)                                                         |

## Known limits

- The list stays small (about 1–1.5° to port all night); her real list
  reached several degrees late on. In this model flooding to the sea's level
  does not take away enough stability to make her loll.
- Surge and sway are only G's own motion and a 0.02 m/s drift; no yaw while
  afloat. Waves (1.3) reach only the deck openings, which see them
  relative to her quasi-static ride (`waveRide.ts`); the ride is not fed
  back into buoyancy, the water inside or the girder. Buoyancy, the
  hull's side openings and the deck edges see the still sea.
- A wave group's envelope does not disperse; it is meant for the minutes
  around its time.
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
- The Fitzgerald's boarding seas are second-order crests against her
  quasi-static ride, with green water standing on her deck: no dynamic
  magnification (about 1.3 at most in her following sea), no bow
  swell-up, no impact of green water on the covers (only its static
  head), and the deck water's weight is not in her trim and list. Her
  deck is wet far less than the accounts ("heavy seas over the deck")
  suggest, and no topside damage of an honest size floods her tanks
  faster than her pumps (on the linear sea 682 m² of opening would be
  needed at the deck edge, 57 m² at a 5° list). So topside damage alone
  gives no list; the graze on Six Fathom Shoal in her real run (R14)
  gives the reported list (5.0° by 5:30 PM; 4.8° in still water). The
  graze is a reconstruction, not a finding: the USCG did not accept a
  grounding, and the cause is still argued.
- What sinks her is the three sisters: the graze lists and settles her,
  the covers let the storm's water into her holds, the sisters fail a
  cover at 7:11:37, and without them she reaches Whitefish Bay. Whether
  they do depends on the sea under them: of 7:06–7:18 every two minutes
  only 7:08, 7:12 and 7:16 sink her by 7:45 (a lull in the sea at the
  others; ruling R15 and the sensitivity table under "The Fitzgerald's
  calibration").
- Her storm's direction is the Anderson's wind (the sea over her
  starboard quarter); the hindcast's west-to-east waves would come more
  across her.
- She goes down within a minute of the first cover failing, in 41 s from
  bow under to the floor. As the bow strikes, her stern is just out of
  the water: the after house's top 2.6 m and her hull's top aft 0.8 m
  above the still water, and she is wholly under 1.7 s later (ruling R9;
  the USCG: "the submerged stern section"). The physics here decides it;
  nothing is tuned to hold the stern up.
- Her stern section lands about 6 s after the break: in the shallow lake
  the broken stern is already deep. So its capsize rule runs at 50°/s to
  be over before it lands (R10); her dive plays in real time (R11), so
  that is about 3.6 s on screen. It lies nearly in line with the bow (the
  wreck's lie 50° apart); measured as the survey did (ruling R8), between
  the sections with the torn middle (the 25 m either side of the break,
  `BREAK_DAMAGE_M`) between them, 35 m (real 52 m). Her break is at
  x = 17.9 m, near No. 10 hatch; the survey put the stern
  section's broken end near No. 18.
- The screen bulkheads are a weir at the tank top (their sluices), so
  the holds' water levels out in minutes; real sluices clogged with
  pellets would be slower.
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
- After the Carpathia's third torpedo she lies up to 0.8° by the stern for
  about eight minutes (10:50:13–10:58:26) while No. 5 hold fills and her
  forward holds begin to take No. 3's water, then goes down by the head
  (the sinking photograph shows her by the head; ruling R20 allows the
  dip). See "The Carpathia's calibration" for why no honest set found
  avoids it. Her end is near two edges: a little more settling
  before 10:50 and she sinks before the third torpedo; a shorter No. 5
  hold and her bow strikes the floor while her stern floats, which breaks
  her (as it does in the What-if without the third torpedo).
- Her bow strikes the 150 m floor as her stern goes under (she is 170 m
  long): her wreck's flattened bow (cunardshipwrecks.com) fits that, but
  the bow's collapse is not modelled (the spec's non-goal). Her stern then
  swings down about it at the water's pace (`pivotDrag`, R22): the mud's
  resistance to her ploughing stem, the water squeezed from under her as
  she nears the floor, and the ballast water in her (neutral in the sea,
  counted as steel by `STEEL_BUOYANCY`) are not modelled. Her stern's top
  still comes down at up to about 12 m/s: a hull pivoting on one end
  moves fastest at the other.
- She rests deep in the floor (her keel 11 m under it amidships, the
  screws hidden; "How deep she lies in the floor" under her data), from
  the plough rule; her stern's top is about 6 m shallower than the
  survey's 143 m.
- Her bulkhead positions and tops, her profile and her ballast condition
  are estimates (her general arrangement is not online): see "The
  Carpathia's data". The ending is sensitive to the draught and the coal
  doors (7.9 m: gone at 11:04; 8.0 m: 11:03; 8.1 m: 10:50, before the
  third torpedo).
- Fourteen of her What-ifs never log `floating-steady`: thirteen with a
  torpedo in the forward peak (the hole fills a small, fine-ended space
  that trades water with the sea in a slow cycle, her pitch rate just over
  the steady test's 1e-5 rad/s) and boiler room plus No. 3 (the coal doors
  still letting water through). Each holds its pose afloat to `END_T`
  (3:35 PM on her clock; `carpathiaWhatIf.test.ts` checks that she does
  not move in its last hour). A fix needs the shared steady test changed.
- Her three torpedoes make the same hole. The third strikes the run of
  her hull aft, where it is narrower; its area is not reduced.
- The Britannic lists only from her 2 cm TCG until her last minutes
  (0.77° at 8:27 AM, at most 1.9°, against "a serious list to starboard"
  [WP]): her forward spaces are full breadth, so the water levels across
  them and flooding by the head stiffens her. Her roll to starboard
  (26° as the bow strikes, then onto her side) comes from 9:02 AM as her
  decks go under. What gave her real early list (water held on her
  starboard side in her E- and F-deck wards and cabins, the hole's side)
  needs water that stays on its side between decks, which the sim does
  not have. "A serious list" [WP] is unquantified; the sim's list stays
  small until the final capsize because her forward spaces flood full
  breadth; between-deck water held to starboard is not modelled (a
  follow-up). Her list tests measure the list the flooding adds (each
  frame's list less her dry list at 8:12): 25.0° at most before the bow
  lands (8–30°). From 8:12 to 8:50 the added list is negative (−0.4° at
  8:22, −0.7° at 8:30, −0.9° at 8:45): she rights herself from the TCG's heel
  as her low spaces fill.
- Task 2b tried between-deck cells (R21) and found the honest physics
  does not give a list that grows (`it.failing` in `realMorning.test.ts`
  holds the three tests R21 asks for; the sweeps and the prototype patch
  are kept outside the repository). With `tcg` 0, starboard and port
  wings in holds 1–3 (3–6 m in from the shell, the cabins' and wards'
  partitions; the Titanic's E deck had rooms against the shell on both
  sides, BOT report "Accommodation"), the hole into the starboard wing and
  the torn 2/3 bulkhead wing to wing, 0.5–4 m² across to the hold, and
  bands of wards inside the boiler rooms' inner skin (`span.toY`, 3–6 m,
  0.03–1 m²) fed by their own side's portholes, about 4,000 runs over the
  honest ranges of every value (hole, doors, tunnel, portholes, GM): she
  lists 2–5° to starboard in her first ten minutes (the hole's side
  floods first), and the filling holds take it back by about 8:35. By
  then every open porthole forward is under on both sides, so the held
  water evens out, and as her low spaces fill her GM rises, so no
  steady heeling moment grows her list. Her capsize side at about 9:00 is
  then set by a list of a few hundredths of a degree: often port. Narrow cross flow keeps the list longer but holds her spaces
  back (sunk at 9:20–10:40) and in most such runs her girder breaks just
  before her bow lands. Floors under the between-deck spaces (cells cut at
  F deck, so their water lies shallow on the deck) did not change this in the runs tried.
  So her starboard side and her capsize stay seeded by the 2 cm TCG
  until a source or a better model gives more.
- Her run for Kea barely matters here: with her way taken off by 8:18 (to
  fit the wreck's place, 1.5 nmi short of Kea [KD]) the ram head works
  only in her first minutes, and her engines stopped at the mine sink her
  2 s later (Cp 0.2–1.0 moves her by 9 s). The stronger effect R11 hoped
  for would need her to have run much faster for much longer, which the
  wreck's place rules out. No run that follows her profile reaches Kea
  (no `shelter`). The honest finding: her engines stopped change her
  sinking by seconds (Cp 0.2–1.0 moves it by at most 9 s); the strike to
  wreck distance wins over full speed for the nearest shore. The toggle
  stays; its test asks that engines stopped alone sinks her no sooner
  than the real run (1 s slack).
- Her girder (6.0 GN·m, the top of the honest range) clears her peak by
  3%: below about 5.8 GN·m she breaks just before her bow lands.
- Her capsize takes about 2 minutes (9:02–9:04); she "gradually
  capsized" from 9:00 to 9:07 [WP].
