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
| `headway.ts`      | `headwayRun`: how far her way carries her over a step (decaying, 1.1, or steady, 1.3).                                                                                                            |
| `waveRide.ts`     | Her ride on the waves (1.3): `waveRide` (quasi-static heave, pitch, roll on the wave field), `rideDz`, `rideWeight`; the deck openings and the scene share it.                                    |

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
mud not modelled). A ship with a surveyed wreck (`spec.wreck`: the
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
second.

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
| Lusitania tracks as 1.1                             | 3 runs, every 50th frame to 1e-9: same              |
| Storm field: 4σ of a 6 h record                     | within 5% of Hs at three places                     |
| Fresh water: same mass floats deeper                | 1025/1000 by volume                                 |
| Box laker: calmer ships less, worse more            | < 0.5×, > 1.5× the real storm's water in 30 min     |
| Box laker: a hatch fails under its head of water    | `hatch-fails`, then > 5× the inflow                 |
| Box in 120 m: bow upright, stern upside down        | bow 0°, stern 180°, 5 m apart, none in the floor    |
| Fitzgerald: LOA, beam, depth, displacement, GM      | 222.2 m, 22.86 m, 11.89 m; 34,750 t, 3.80 m         |
| Fitzgerald: freeboard 3.2–3.8 m, cargo 26,535 t     | 3.56 m; 26,535 t (41.1/15.5/43.4% by hold)          |
| Fitzgerald: starboard list 1–8° at 5:30 PM (R14)    | 5.0° (topside alone: 0.0°)                          |
| Fitzgerald: water rising, afloat at 7:10            | 754 / 1,349 / 1,795 / 2,031+ t at 4:30–7:10         |
| Fitzgerald: storm's water over her deck, by 7:00    | 490 m³ (her holds'); the graze the tanks'           |
| Fitzgerald: still water, all damage: afloat 9:00 PM | floats, 1,568 t, list 6.0°                          |
| Fitzgerald: sisters' time inside 7:00–7:15 PM (R15) | 7:11:55 PM (re-locked); the table above             |
| Fitzgerald: still water sinks nothing by 9:00 PM    | floats, no cover fails                              |
| Fitzgerald: a cover fails, bow under 7:10–7:25      | first cover 7:11:37 PM, bow under 7:12:03 PM        |
| Fitzgerald: bow lands ≤ 3 min, stern top ≥ −5 m     | 7:12:44 PM (41 s), house +2.6 m, hull +0.8 m        |
| Fitzgerald: stern under ≤ 5 s after the bow lands   | 1.7 s                                               |
| Fitzgerald: breaks after the bow lands              | as it strikes, x = 17.9 m, before the stern lands   |
| Fitzgerald: stern rolls in the water (R10)          | 180° as it first touches; 0° more on the floor      |
| Fitzgerald: rests                                   | bow 0.1°, stern 180°; sections 35 m apart           |
| Green water: on and off her deck in seconds         | a 4.2 m swell: yes; still water, a 1 m sea: none    |
| Fitzgerald: funnel stays; dive in real time (R11)   | no `funnel-falls`; shown t = real t                 |
| Fitzgerald ride: pitch ≤ 6°, roll ≤ 10°             | at most 2.0°, 0.6°                                  |
| Fitzgerald What-if: 24 runs                         | all finite, inside endT; no damage sinks later      |
| Fitzgerald: real spots = real run; none + calmer    | identical tracks; she reaches Whitefish Bay         |

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
