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

`titanicDecks.ts` and `lusitaniaDecks.ts` (`walkMapFor(ship)`, null for a
ship you cannot walk on, such as the Edmund Fitzgerald) mark, per ship:

- **areas**: counter-clockwise outlines on a named deck. Their sides follow
  the deck edge as the 3D model draws it (`deckEdge.ts`, a port of the
  model's `topHalfBreadth`), 10 cm inboard, so the railings stand where the
  drawn ones do. Edges are railings unless listed in `wallEdges` (always
  hold: a house side, or a rail over a lower deck rather than the sea) or
  `openEdges` (a mouth you walk off).
- **blockers**: circles and boxes (funnels, houses, casings, hatches,
  masts, cranes, ventilators, benches, davits), copied from where the
  model's recipes draw them. Boats are not blockers: they leave.
- **stairs**: two-way links between areas of different heights. Walking
  into either end (within half its width, from outside) moves you to the
  other end; arriving inside an end does not send you back. (The
  Lusitania's `aft-gangway` instead joins two decks at one height across
  her mast gap, so getting aft takes one step.) Each end leaves room for
  the walker's body (0.3 m) clear of every blocker.
- **spawn**: on the boat deck, where Walk and Back on deck put you.

Titanic: boat deck, forward well, forecastle, after well, poop. Lusitania:
boat deck (two promenades beside its long house), foredeck (`forecastle`),
the mainmast's gap, the second class house's deck (`aft-deck`) and the
stern.

## The walker (`step.ts`, `stepWalker`)

Each call turns by the look drag once, then runs `ceil(dt / WALK_DT)`
substeps of 1/60 s (dt clamped to 0.25 s). Each substep:

1. The stick in the ship frame at 1.4 m/s (`WALK_SPEED_MS`), slowed by
   water on the deck (`1 - depth / 1 m`: half speed at knee depth, 0.5 m).
2. The slope from the piece's pose (`deckSlope`): below 10°
   (`WALK_PUSH_FROM_DEG`) nothing. From 10° to 20° the uphill part of
   walking scales from full to nothing, and a push downhill ramps in
   (`g sin θ` times 0 at 10° to 1 at 20°) against friction (μ 0.35 as a
   drag, so it is a drift, never a run away). From 20° (`WALK_SLIDE_FROM_DEG`)
   you slide: `g sin θ` with no friction and no way uphill, capped at
   10 m/s (`WALK_MAX_SLIP_MS`). Water on the
   deck adds a gentle push downhill in proportion to its depth.
3. The move against the outline: a held edge stops you and keeps the motion
   along it. A railing gives way when you are sliding and it faces downhill
   (`inWater: "railing"`), or when the sea is knee deep over it, or for an
   open edge (`"open-end"`). After the break, crossing `breakX` from your
   piece is an open end too.
4. The body (radius 0.3 m) is pushed out of blockers and off held edges;
   a substep that would still end outside the outline is undone, so the
   walker never leaves the deck except by going in.
5. The stairs, then the water: 1 m over the feet (`WALK_IN_WATER_DEPTH_M`,
   the waist) is `inWater: "deep"`.

`inWaterFromDepth` is the one decision that ends a walk because of the
water. **"Go down with the ship"** (the next release) changes only that
decision in `stepWalker`; railings and open ends stay as they are.

## The swimmer (`swim.ts`)

`swimmerFrom` floats a walker who has just gone in off the side they were
nearer, level with where they went in, 3 m clear of her footprint (her
widest half-breadth at that x). `stepSwimmer` paddles at 0.5 m/s
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

All in `types.ts`: `WALK_PUSH_FROM_DEG` 10, `WALK_SLIDE_FROM_DEG` 20,
`WALK_EYE_M` 1.6, `WALK_IN_WATER_DEPTH_M` 1.0, `WALK_KNEE_DEPTH_M` 0.5,
`WALK_SPEED_MS` 1.4, `WALK_TURN_PER_PX` 0.005 (dragging right turns right),
`WALK_FRICTION_MU` 0.35, `WALK_RADIUS_M` 0.3; `SWIM_SPEED_MS` 0.5 in
`swim.ts`. They are tuning: change them here and the tests say what moved.

## Where the rest lives

The store's walk slice, the walk controller in `CameraRig` (camera id
`"walk"`, eyes `WALK_EYE_M` over the feet, head level with the horizon), the
sea-level float and Look under, and the controls (Walk button, joystick,
look layer, Fly, Back on deck, Look under) are wired in later 1.3 tasks
under `components/shipwreck/` (`scene/` and `ui/`).

Tests: `__tests__/maps.test.ts` (the maps hold together), `slope.test.ts`,
`step.test.ts` (every rule above) and `swim.test.ts` (the swimmer, and
`placeWalker` on the real night's track).
