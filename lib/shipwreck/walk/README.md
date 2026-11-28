# Walk the decks: the rules

Pure TypeScript (no React, no three.js, no randomness) for walking the open
decks of a sinking ship in first person, and for floating in the sea once
you go in. The scene and the controls live elsewhere; this folder is the
rules, and it only reads the sim (poses from a `SimFrame`), never writes it.

## The frame

The ship frame, as the rest of the game: metres, origin on the keel at
midships, `x` forward, `y` to port, `z` up from the keel. A walker lives in
the ship frame of the piece they stand on (`part`: whole, or after the break
the bow, `x >= breakX`, or the stern), with feet on an area's floor,
`floorZ` (the deck's height plus her sheer, `deckZAt`, plus `raiseM`), so
they cannot fall through a deck. `yaw` is a heading in that frame (0 faces
the bow, + turns to port). `slope.ts` turns ship points into the sim's earth
axes (`shipToEarth`, `earthToShip`: the same rotation as `shipToThreeInto` in
`components/shipwreck/scene/cameraMath.ts`, ported because `lib/` does not
import from `components/`). A swimmer lives in the earth frame (sim `x`, `y`;
the sea is `z`).

## The maps

`titanicDecks.ts`, `lusitaniaDecks.ts`, `britannicDecks.ts`, `carpathiaDecks.ts` and `concordiaDecks.ts` (`walkMapFor(ship)` from `registry.ts`, whose `SHIP_WALKS` lists each ship's deck map and interior; null for a
ship you cannot walk on, such as the Edmund Fitzgerald) mark, per ship:

- **areas**: counter-clockwise outlines on a named deck. Their sides follow
  the deck edge as the 3D model draws it (`deckEdge.ts`, a port of the
  model's `topHalfBreadth`), 10 cm inboard, so the railings stand where the
  drawn ones do. Every edge holds; `wallEdges` marks the ones that are a
  house side, or a rail over a lower deck rather than the sea.
- **blockers**: circles and boxes (funnels, houses, casings, hatches,
  masts, cranes, ventilators, benches, davits), copied from where the
  model's recipes draw them. Boats are not blockers: they leave (but the
  Concordia's, which fill her boat deck by her rail: see below).
- **stairs**: two-way links between areas of different heights. Walking
  into either end (within half its width, from outside) moves you to the
  other end; arriving inside an end does not send you back. (The
  Lusitania's `aft-gangway` instead joins two decks at one height across
  her mast gap, so getting aft takes one step.) Each end leaves room for
  the walker's body (0.3 m) clear of every blocker.
- **spawn**: on the boat deck (the Concordia: her pool hall), where Walk
  and Back on deck put you.

Titanic: boat deck, forward well, forecastle, after well, poop. Britannic:
the same five decks on her 94 ft beam (her own deck edge), with her
gantry davits (each set's two arms and the bay of boats between them, from
the constants in `ships/britannic.ts` the recipe also reads) and Welin davit
feet as blockers; `maps.test.ts` checks every house, funnel, davit and bench
her recipe draws. Lusitania:
boat deck (two promenades beside its long house), foredeck (`forecastle`),
the mainmast's gap, the second class house's deck (`aft-deck`) and the
stern. Carpathia: forecastle, forward well, the bridge deck forward of the
boat deck, the boat deck, a covered promenade down each side under it (a
ladder from the boat deck; closed at both ends) and the open after deck
(no poop) by the white stern deckhouse. Costa Concordia (1.17; game decks,
the model's numbering, with Costa's in the file's comments): the pool hall
under the glass roof (deck 12, where you start, starboard of the pool), the
aft and forward lidos either side of it (deck 13: the aft pool, its glass
houses, the funnel; the forward pool and the water slide), the terrace
under the aft lido (deck 12), the sports deck over the spa (deck 14, round
the radar mast) and the boat deck's promenade each side (deck 4, between
the recess wall, deepened to 7.4 m for it, and her 26 boats, which are
blockers there all night). Stairs join the lidos to the pool hall, the
terrace and the sports deck, and stair towers join each lido to each side's
boat deck (doors in the recess wall). The recipe and the map read the same
numbers, `ships/concordiaLayout.ts`. Boarding: a recess boat's spot is its
inboard side (`boatSpot` in `boatRide.ts`), so the promenade reaches it,
and only a walker on its own deck gets it (`nearestBoardable` takes the
walker's floor), never one on the lidos over it.
`deckZAt` measures sheer from
`spec.sheerRefDeck` (the Concordia's deck 3), else the C deck, or `Upper` on a
ship (the Carpathia) with no C deck.

## The walker (`step.ts`, `stepWalker`)

Each call turns by the look drag once, then runs `ceil(dt / WALK_DT)`
substeps of 1/60 s (dt clamped to 0.25 s). Each substep:

Fun over realism (Gentry, 2026-11-22: "just walking is the whole idea of
it"): the slope never pushes you or slows you, every edge holds, and you
go in only when the sea reaches your waist. 1.2.0's slope push, slide and
railings that gave way were removed in 1.3.2.

1. The stick in the ship frame at 4 m/s (`WALK_SPEED_MS`), slowed by
   water on the deck (to 0.6 of full speed at the waist, by depth).
2. The move against the outline: every edge (railing, wall, ladder
   mouth) stops you and keeps the motion along it. After the break,
   crossing `breakX` off your piece is undone too.
3. The body (radius 0.3 m) is pushed out of blockers and off the edges;
   a substep that would still end outside the outline is undone, so the
   walker never leaves the deck except by going in.
4. The stairs, then the water: 1 m over the feet (`WALK_IN_WATER_DEPTH_M`,
   the waist) is `inWater: "deep"`.

**Jumping** (1.13.0): `input.jump` starts a hop of `JUMP_S` (0.6 s) and
`JUMP_HEIGHT_M` (0.8 m) from the floor (`jumpHeight`, `WalkerState.jumpS`);
the eyes rise with it. In the air, running at a railing over the sea
(within a few cm past the body, facing it squarely; never a `wallEdges`
edge) goes over the side: `overboard` with `inWater` "deep", and the scene
plays the fall to the sea before the splash. Walking into a rail without
jumping still holds. Jumping onto roofs or over benches needs blocker
heights the maps do not have yet.

`inWaterFromDepth` is the one decision that ends a walk. **"Go down with
the ship"** (the next ask) changes only that decision in `stepWalker`.

## Inside (interiors, 1.15)

Rooms inside her are walk areas too, on the `whole` piece, so they pitch
and list with her as the deck does. Everything below is keyed on the
area's flags or the map's extra fields; a deck map without them walks
exactly as before.

- **Interior areas** (`interior: true`): every edge is a wall unless it is
  a seam. No jump starts there (one already in the air lands), the walker
  goes at `WALK_INSIDE_SPEED_MS` (3 m/s) and never goes over a rail.
  `kind` names the room for the scene, `axis` is a corridor's centre line
  and `noWalk` marks a room that is drawn but not walked.
- **Ramps** (`ramp: { from, to, dropM }`): a flight of stairs as a slope.
  `floorZ(map, area, x, spec, y = 0)` is the deck's height plus `raiseM`,
  less `dropM · u`, where `u` is (x, y) projected on `from → to` and
  clamped to 0..1. Every caller that knows y passes it (`depthAt`,
  `placeWalker`, `swimmerFrom`, the scene's `deckEyes`).
- **Seams** (`WalkMap.seams`, `{ a, b, at }`): an open edge (a doorway)
  between two areas at equal floor height. `at` matches an edge of both
  outlines, either way round, within 1 mm (looked up once per map). The
  move crosses a seam into the next area and carries on inside its
  outline (still four passes in all); the body is never pushed off a
  seam; the "never leave the outline" undo tests the area the walker
  ended in.
- **Links** (`Stair.kind`): `"stair"` (the default) as before; a `"door"`
  (deck door) does nothing while `StepContext.interiorsOpen` is false
  (after the break); a `"lift"` stays put while the water at its arrival
  is deeper than `WALK_LIFT_MAX_DEPTH_M` (the knee, 0.5 m).
  `StepResult.via` (`{ kind, id }`) reports a link taken that step.
- **Riding a glass lift** (`WalkerState.ride`, a map with `lifts`): the
  look turns and nothing else moves the walker (no stick, drift, jump or
  link); at the ride's end their area is the car at the arrival stop.
  `walkerFloorZ(map, w, spec)` is the floor under them (the car's as it
  rides), for the eyes and the water over the feet. The runner starts a
  ride from `WalkInput.lift`; anything that re-places the walker ends it.
- **Her rooms (the Concordia, 1.18)** walk by the same rules: her map is
  `withInterior(CONCORDIA_WALK, CONCORDIA_INTERIOR)` from `registry.ts`
  (her pool hall a deck room, `deckRoomWalk`), with `lifts` for the glass
  lifts. The rules never close a room themselves: the runner puts the
  walker back on deck when her rooms close at `closeAtHeelDeg` (30°).
- **Water** (`StepContext.waterZ?(area, x, y)`): the earth level of the
  water over a ship-frame point, so a room can hold its own level. Without
  it, the depth is the sea (`seaZ`) at the feet, as on deck.
- **Blockers by area**: looked up per area (built once per map on first
  use), so many furniture blockers inside do not slow the deck.
- **The joystick in narrow halls** (inside only, all in `stepWalker`;
  `hallFeel.test.ts` is the bot that walks the real Titanic rooms):
  - **Ease-in**: the speed share (`WalkerState.moveShare`, missing = 1, so
    a deck state never carries it) climbs from 0 to 1 over
    `WALK_INSIDE_EASE_S` (0.15 s) while the stick is pushed and drops to 0
    the moment it is let go (stopping is instant).
  - **Hall assist**: in an area with an `axis`, a walk direction within
    `HALL_FADE_DEG` (25°) of it (either way) turns toward it, fully onto
    it within `HALL_SNAP_DEG` (10°). Only the walk direction: never `yaw`.
  - **Door funnel**: doorways are seams with a `corridor` or `cabin` on
    either side (precomputed per map, `doorsOf`). Within `DOOR_ASSIST_M`
    (1.5 m) of the nearest one you are heading toward, and within
    `DOOR_ASSIST_DEG` (40°) of straight through it (full to 30°), up to
    `DOOR_ASSIST_SHARE` (half) of the sideways part bends toward its centre
    line (aiming 0.5 m past it). **Pass-by**: walking by a doorway in a
    hall's side, the part of the walk toward it goes when the walk's line
    misses the opening (fully once it misses by `DOOR_PASS_MISS_M`, 0.3 m,
    past the jamb), or whatever the line once the walk is within 15° of the
    hall (`DOOR_PASS_DEG`, 75° off straight through, fading in over 10°).
    So aiming at a door always goes in (ruling: a child aiming at a door
    must get in), and a walk scraping the wall beside it stays in the
    hall. Both rules fade in over the last `DOOR_ASSIST_FADE_M` (0.4 m) of
    reach, so neither kinks the walk when a doorway comes in reach. A
    corridor walk at ±30° toward the doors' wall may end in the first
    door (its line meets the opening once it scrapes the wall); ±20° and
    less walks on past them (the hall assist turns it to within 15°).
  - **Wall slide keeps speed**: after a move, if the body slid (walls,
    jambs or furniture) to under `SLIDE_KEEP` (0.75) of the stick's move
    while the stick is within `SLIDE_KEEP_DEG` (60°) of the slide, it
    moves on along the slide to make it up; past 60° the share fades to 0
    square on, so pushing straight into a wall still stops you.
  - **Round wall ends**: the body is pushed straight away from the end of
    a wall (a jamb, a corner the kit kept unchamfered) instead of along
    the wall's normal, so it rolls round instead of catching or
    shuddering on the spot (the deck keeps the normal push).
  - **Deep water is a wall**: a move ending in water deeper than
    `WALK_WADE_STOP_M` (0.8 m) and deeper than where the walker stood is
    undone and retried along x, then y, so the walker slides along the
    edge. Standing in deep water you can still move to water no deeper.
- **The rooms' data** is `lib/shipwreck/interior/` (the room kit, its
  README): `walkMapFor("titanic")` is `TITANIC_WALK` with her interior
  merged in (`withInterior`, built once on first use).

## Her lean (the Concordia, 1.17)

The walker copes with any heel mechanically (feet on the floor in her
frame), but lying right over as she does, three things go wrong past about
20°. Four `WalkMap` flags fix them; only her map sets them, so every other
ship walks exactly as before. Tests key on her heel, never the clock
(`heelFeel.test.ts`).

- **Eyes along her up** (`eyesShipUp`): on her decks, as inside, the eyes
  stand 1.6 m along her own up axis, not true up (which at 40° is a metre
  toward the high side, through any house wall beside you). The view
  still never rolls: it stays level with the horizon and the deck tilts
  under you (`deckEyes`).
- **The heel feel** (`heelFeel`): `heelDrift(pose)` gives `k`, 0 up to
  `HEEL_FEEL_FROM_DEG` (8°) of deck slope (`deckSlope`), 1 from
  `HEEL_FEEL_FULL_DEG` (30°), linear between, and her downhill direction.
  Each substep the stick's uphill part is scaled by
  `1 − HEEL_UPHILL_LOSS·k` (0.45: lean into it) and, after the stick's
  move, a drift of `HEEL_DRIFT_MS·k` (0.8 m/s) downhill moves the walker,
  standing or walking, both slowed by wading. The drift is a move like any
  other: rails and walls hold and slide it along them (so you gather
  against the low wall and can always walk out along it), blockers push
  back, the break holds. It never takes a stair, door or lift on its own:
  links are checked once per substep, after the stick's move and the
  drift, and only when the stick itself moved the walker (so the drift
  can never carry them over an end's edge unchecked either). It never wades
  into water deeper than `WALK_WADE_STOP_M` and deeper than here (on deck
  too: the drift alone never puts you in the sea), and stops while
  `StepContext.driftOff` (the end card's input off, the lift's wipe) and
  through a glass lift ride. `StepContext.seamShut(from, to)` makes a
  doorway a wall while it says so (her glass lifts' landing doors, until
  the car has arrived); missing, every seam is open.
  Straight uphill always nets at least 0.6 m/s: on deck at full feel
  4 × 0.55 − 0.8 = 1.4, inside 3 × 0.55 − 0.8 = 0.85.
- **The swimmer and her superstructure** (`swimAroundSuperstructure`):
  lying over, her superstructure is in the sea, so the runner hands each
  `HullPiece` her `spec.superstructure` and the swimmer keeps off its
  boxes too (each from its `baseZ`, else her deck edge, to its `topZ`, its
  `halfBreadthM`, else her footprint, either side).
- **Where walking ends** (`walkEndsAtHeelDeg`, her 40°, midnight): at
  that list either way a walker on her slides off into the sea on her low
  side (the runner's splash, `swimmerFrom` with that side, facing out to
  sea), and `placeWalker` returns null, so Back on deck and the picker's
  walk buttons go, as after a break. A seek straight past it floats them
  where the spawn meets the sea (the "nowhere to stand" rule, pushed clear
  of her boxes), not on her low side. A seek to before it stands them on
  the spawn again.

`withInterior` carries the deck map's flags into the merged map.

**Her boats** are blockers tagged with their index (`Blocker.boat`): the
walker skips one once `StepContext.boatLowered(index)` says that boat is
lowered (WalkRunner reads the track's `boat-lowered` events), so the gap
it leaves is walkable out to her rail. No other map tags a boat.

**Her pool hall** is a deck room (`Room.deckRoom`, the room kit's data in
`interior/concordia.ts`): an open-deck area (deck speed, jumping, every
edge a wall, never closed: its ways in are stairs, not doors).
`deckRoomWalk` puts it and its pool and loungers in her deck map, and
`withInterior` replaces it from the same data, so the merged map has it
once.

## The swimmer (`swim.ts`)

`swimmerFrom` floats a walker who has just gone in off the side they were
nearer, level with where they went in, 3 m clear of her footprint (her
widest half-breadth at that x). `stepSwimmer` paddles at 2 m/s
(`SWIM_SPEED_MS`) and pushes the swimmer back out of each piece's footprint
where that piece is at the surface (`hullClearanceM`; a piece held up in the
air or sunk below is no obstacle). `placeWalker` stands them on the spawn for
a frame, on the piece the spawn's x is on, or returns null when that piece
is gone or the spawn is not dry by a knee's depth (0.5 m) on the sea it is
given (`seaZ`, as `stepWalker`'s; flat by default) (`canReboard` drives
Back on deck).

`walkInput.ts` is the mutable controls singleton: the joystick, the look
layer and the keys write it; the walk runner reads it each frame and zeroes
`lookDx`/`lookDy` once read.

## Constants

All in `types.ts`: `WALK_EYE_M` 1.6, `WALK_IN_WATER_DEPTH_M` 1.0, `WALK_KNEE_DEPTH_M` 0.5,
`WALK_SPEED_MS` 4, `WALK_TURN_PER_PX` 0.005 (dragging right turns right),
`WALK_RADIUS_M` 0.3, `WALK_INSIDE_SPEED_MS` 3, `WALK_LIFT_MAX_DEPTH_M`
(the knee), and inside: `WALK_INSIDE_EASE_S` 0.15, `SLIDE_KEEP` 0.75 within
`SLIDE_KEEP_DEG` 60, `HALL_SNAP_DEG` 10, `HALL_FADE_DEG` 25,
`DOOR_ASSIST_M` 1.5, `DOOR_ASSIST_DEG` 40, `DOOR_ASSIST_SHARE` 0.5,
`DOOR_PASS_DEG` 75, `DOOR_PASS_MISS_M` 0.3, `DOOR_ASSIST_FADE_M` 0.4,
`WALK_WADE_STOP_M` 0.8; her lean: `HEEL_FEEL_FROM_DEG` 8,
`HEEL_FEEL_FULL_DEG` 30, `HEEL_UPHILL_LOSS` 0.45, `HEEL_DRIFT_MS` 0.8;
`SWIM_SPEED_MS` 2 in
`swim.ts`. They are tuning: change them here and the tests say what moved.

## Where the rest lives

- The store's walk slice (`startWalk`, `wentInWater`, `backOnDeck`,
  `setLookUnder`): `lib/shipwreck/playback.ts`.
- The scene side: `components/shipwreck/scene/WalkRunner.tsx` places and
  steps the walker or the swimmer each frame and reads the keys;
  `scene/walkCamera.ts` turns that into the eyes (deck, float, Look under)
  that `CameraRig` stands the camera at.
- The controls: `components/shipwreck/ui/Walk*` (`WalkButton`, `WalkHud`
  with Fly, Back on deck and Look under, `WalkJoystick`, `WalkLookLayer`).

Tests: `__tests__/maps.test.ts` (the maps hold together), `slope.test.ts`,
`step.test.ts` (every rule above), `interiorStep.test.ts` (the inside
rules on small maps), `hallFeel.test.ts` (the joystick bot on the real
Titanic rooms) and `swim.test.ts` (the swimmer, and
`placeWalker` on the real night's track).
