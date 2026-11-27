# Inside her: the room kit

Pure TypeScript (no React, no three.js) for the rooms you can walk into
(1.15: the Titanic only). The rooms are walk areas, so the walker in
`lib/shipwreck/walk/` walks them with its usual rules plus the "Inside"
rules in its README. This folder is the data and the rules for water and
light; the scene draws it (`components/shipwreck/interior/`).

The design: `docs/superpowers/specs/2026-11-27-shipwreck-titanic-interiors-design.md`.

## The data (`types.ts`)

One `InteriorMap` per ship, in the ship frame (metres, keel at midships,
`x` forward, `y` to port, `z` up):

- **rooms**: `Room`s. Each is an outline on a named deck (the floor is
  `deckZAt(deck, x) + raiseM`, as a walk area's), counter-clockwise, every
  edge a wall unless a seam opens it. A flight of stairs is a room with a
  `ramp` (`from → to`, falling `dropM`). `ceilingM` is the ceiling over the
  floor (a flight's over its higher end). `zone` groups rooms drawn
  together. `look` is the finish (walls, floor, lamp style, the porthole
  side). `axis` is a corridor's or flight's centre line (the hall assist).
  `noWalk` rooms are drawn only (no seam or link leads in). `water`
  overrides the bulkhead rule below.
- **seams**: doorways, `{ a, b, at }`, where `at` is an edge of both
  outlines (the walker crosses it). Rooms either side are at one floor
  height there.
- **links**: deck doors (`kind: "door"`, from an open-deck area to just
  inside) and lifts (`kind: "lift"`), shaped as the walk map's `Stair`.
- **shutDoors**: painted closed doors on walls (position and facing only).
- **furniture**: kit pieces (`PieceId`) with a position and yaw; `blocks`
  makes a box blocker from `PIECE_FOOTPRINT` (a blocking piece is square
  to the ship).

`withInterior(deckMap, interior)` (`merge.ts`) merges it into the ship's
`WalkMap`: rooms become `interior` areas, blocking furniture becomes
blockers, links join `stairs`, seams join `seams`. `walkMapFor("titanic")`
returns the merged map (built once); `TITANIC_WALK` stays the open decks.
`interiorFor(ship)` returns the data, null for a ship without rooms.

## The kit (`kit.ts`)

Helpers that keep a ship's data short and correct:

- `corridor(id, from, to, width)`, `cabin(id, min, max)`,
  `flight(id, top, bottom, width, dropM)` build outlines (and the axis,
  and a flight's ramp).
- `doorway(a, b, at, width)` cuts an opening centred on `at` into the wall
  two rooms share, as matching edges in both outlines, and returns the
  seam. Doorways are at least `DOOR_MIN_M` (1.1 m; real ones were about
  0.75 m: fun over realism). An opening can be a whole edge (a flight onto
  a landing); corners are reused, never doubled. It throws when the rooms
  share no wall there.
- `chamferReflex(outline, keep)` cuts every reflex corner back by
  `CHAMFER_M` (0.15 m) along both edges, so no corner can hold the walker,
  except the corners in `keep` (a seam's ends, which must still match).
  Run it after the doorways.

## Water inside (`water.ts`)

- **A room on or above its compartment's bulkhead tops** (its lowest
  floor point no more than 1 m under `compartmentTopZ` of the compartment
  holding its middle x: `floodsFromSea`): the water stands at the sea's
  level (`roomWaterTarget` returns `seaZ`, flat 0 for the walk). On the
  real ship the water above the watertight bulkheads spread along E deck
  and up the stairs at about the sea's level; the compartments under these
  rooms never fill before the break. Every room in 1.15 is one.
- **A room inside the watertight envelope**: its compartment's level from
  the sim's fill (X-ray's `waterLevel`, the caller caching the samples per
  compartment), never above the sea.

The real night, as `__tests__/water.test.ts` measures it (sea over the
floor): the third-class cabin wet at 0:13 and waist deep at 0:31; Scotland
Road wet at its forward end at 0:15, at x 20 at 1:07 and at its after end
at 2:01; the staircase from below: the C landing at 2:07, the B foyer at
2:09, the A foyer at 2:12; the Boat deck entrance dry until the break
(2:14). The scene eases each room's shown level toward its target
(`easeLevel.ts`: at most `LEVEL_EASE_M_PER_S`, 0.5 m per real second; a dry
room or a first sight snaps). `roomWaterTargets(spec)` is the scene's
per-frame target: each room's rule worked out once, each compartment's
X-ray samples built the first time a room in it asks, the fill from the sim
frame's `water`.

## Doors (`doorExit.ts`)

- `doorToEnter(map, area, at, depthAt, id?)`: the door button. The nearest
  deck door whose outside end is within `DOOR_REACH_M` (4 m) of the walker
  on the same area, or door `id` from anywhere (the test hook); only when
  its inside end is dry (`depthAt` < 0). Returns where to stand inside,
  facing on in.
- `doorExit(map, cameInBy, depthAt, near?)`: Go outside. The outside end of
  the door they came in by when it is dry, else the nearest dry deck door,
  else null (the scene then tries the spawn, else the sea). Facing out.

## Lights (`lights.ts`)

`roomPower(power, depthM, t)`: the ship's power (the sim's `frame.power`)
while the water over the room's floor is under 0.3 m, flickering
(deterministic dips, the sim's own flicker, keyed on the time and depth)
from 0.3 to 0.6 m, and out from 0.6 m (the water reached the wiring).
`torchOn(roomPower)` is true under 0.35: the torch comes on by itself.
The scene reads the depth at the room's floor middle (a flight's head)
and gives a dark room a little of a lit neighbour's light
(`components/shipwreck/interior/README.md`). A hall longer than 12 m
(`LONG_ROOM_M`: Scotland Road, the B deck corridor) has its lamps in parts
of at most 8 m (`lightSegments`), each going out by the water at its own
middle, so the dark creeps along the hall with the water; `segmentAt`
finds the part a point (the walker, for the torch) is in.

## Adding a ship's rooms

1. Write `<ship>.ts` beside `titanic.ts`: shapes from the kit, doorways
   between them, then the rooms' info (deck, kind, ceiling, zone, look),
   chamfered with their seam ends kept. Take positions from her ship data
   (`ships/<ship>.ts`: decks, bulkheads) and her walk map (houses, the
   open-deck areas the doors stand on).
2. Where her plans are thin, invent a plausible layout and write each
   invention as a ruling in the file's header comment, so it can be
   revisited.
3. Add her to `interiorFor` and merge her map in `walkMapFor`.
4. Copy `__tests__/titanicMap.test.ts` for her (or make it table-driven):
   outlines, seams, reachability from a deck door, link ends, ceilings,
   water. Measure her water timeline the way `water.test.ts` does.
