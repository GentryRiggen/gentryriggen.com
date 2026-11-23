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

`titanicDecks.ts`, `lusitaniaDecks.ts` and `britannicDecks.ts` (`walkMapFor(ship)`, null for a
ship you cannot walk on, such as the Edmund Fitzgerald) mark, per ship:

- **areas**: counter-clockwise outlines on a named deck. Their sides follow
  the deck edge as the 3D model draws it (`deckEdge.ts`, a port of the
  model's `topHalfBreadth`), 10 cm inboard, so the railings stand where the
  drawn ones do. Every edge holds; `wallEdges` marks the ones that are a
  house side, or a rail over a lower deck rather than the sea.
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

Titanic: boat deck, forward well, forecastle, after well, poop. Britannic:
the same five decks on her 94 ft beam (her own deck edge), with her
gantry davits (each set's two arms and the bay of boats between them, from
the constants in `ships/britannic.ts` the recipe also reads) and Welin davit
feet as blockers; `maps.test.ts` checks every house, funnel, davit and bench
her recipe draws. Lusitania:
boat deck (two promenades beside its long house), foredeck (`forecastle`),
the mainmast's gap, the second class house's deck (`aft-deck`) and the
stern.

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

`inWaterFromDepth` is the one decision that ends a walk. **"Go down with
the ship"** (the next ask) changes only that decision in `stepWalker`.

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
`WALK_RADIUS_M` 0.3; `SWIM_SPEED_MS` 2 in
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
`step.test.ts` (every rule above) and `swim.test.ts` (the swimmer, and
`placeWalker` on the real night's track).
