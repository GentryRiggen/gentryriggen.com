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
  makes a box blocker from `PIECE_FOOTPRINT`, or for her modern pieces
  `MODERN_PIECE_FOOTPRINT` (`pieceFootprint`; a blocking piece is square
  to the ship).
- **deck rooms** (`deckRoom: true`, 1.17: the Concordia's pool hall):
  walked as an open deck (no `interior` flag: deck speed, jumping, every
  edge a wall, never closed) but drawn by the kit whenever walking on
  her. Its `glass` finish is glass sides (`look.solidEdges` solid), a flat
  glass roof at `ceilingM` and `look.dome`, her model's glass dome. A deck
  map takes it with `deckRoomWalk(interior)`; `withInterior` replaces an
  area of its id, so it merges once.

- **lifts** (hers, 1.18): `LiftShaft`s, a car's plan and its stops
  (deck, landing room, the door: an edge of both the landing's outline
  and the car's plan). `liftCars(interior)` makes a `lift-car` room per
  stop (`lift-a@3`), in its landing's zone, seamed to the landing, and no
  links: `withInterior` puts the shafts on the walk map (`WalkMap.lifts`)
  and the cars ride (`lift.ts`: `liftRideS`/`liftRideZ` ease in over 1 s,
  1.5 m/s, ease out over 1 s, about 14 s from the low lobby to deck 7;
  `nextStop` rides past a stop whose car would be over the knee;
  `otherCarZ` the car nobody rides, on a loop, over a run of stops: the
  scene keeps it to the atrium's, and parks it only for a walker within
  3 m of its door). A car at a stop holds its
  landing's water; riding, the higher of its two ends' (the shaft's rule).
- **seep** (`Room.seep`), **closeAtHeelDeg** and **emergencyFlicker**
  (hers): the slow flooding (`seep.ts`), the 30° close (`open.ts`) and the
  flicker (`lights.ts`).

`withInterior(deckMap, interior)` (`merge.ts`) merges it into the ship's
`WalkMap`: rooms become `interior` areas, blocking furniture becomes
blockers, links join `stairs`, seams join `seams`. `walkMapFor("titanic")`
returns the merged map (built once); `TITANIC_WALK` stays the open decks.
`interiorFor(ship)` returns the data, null for a ship without rooms.

## The modern vocabulary (hers, 1.18)

Additive: the Titanic's data and output do not change.

- `RoomKind`: `atrium` (her atrium's floor and well), `gallery` (its
  galleries), `stateroom`, `balcony` (the scene draws its outboard side
  as a rail, open above), `lobby`, `theatre` (the stalls and balcony),
  `stage`, `club`, `lift-car`, `pool-hall`. A seam between two of
  `atrium`, `gallery`, `theatre` is open plan: no lintel over it.
- `WallFinish`: `cabin-veneer`, `cream`, `marble`, `glass`, `kids`,
  `theatre`. `FloorFinish`: `cabin-carpet`, `marble`, `tile`, `teak`,
  `soft`, `stage-wood`. `LampStyle`: `downlight`, `strip`, `chandelier`.
  The scene kit draws them with her tiles (`modernTextures.ts`) and her
  look: glass rails over her well and stair (a velvet parapet in the
  theatre, a teak-capped glass rail on a balcony), her cabins' veneer
  doors for her shut doors, a lit glass roof over a well 6 m or more
  high, a big window on a `portholes` side, downlights about 3.5 m apart
  (along a corridor's axis; a tall room's reach its floor), cove strips
  for `strip`, the chandelier over a well. Emergency path lights run
  along the walls of her corridors, lobbies, atrium, theatre and club
  (and short white lamps high in corridors and lobbies), with exit
  signs from the data; their light is baked into `aGlow` (under 0) and
  shows as her lamps run low on the emergency supply (`uEmergency`, fed
  from `runtime.interiorEmergency`). Inside her, a zone's see-through
  panes draw last in its glass mesh (blended); a deck room keeps a pane
  mesh. The atrium's after wall is glass across both lift shafts, to the
  cove and over the doors (`liftGlassWalls`), so the cars are seen
  gliding; the moving cars carry their own glass (`liftCar.ts`), their
  ends a hand inside the wall so the two never lie on one another.
- `EntryIcon` adds her pictures: `atrium`, `stateroom`, `low-cabin`,
  `theatre`, `kids-club`.
- `PieceId` is the Edwardian pieces plus `ModernPieceId`
  (`modernPieces.ts`'s `MODERN_PIECE_IDS`: one list). A blocking modern
  piece's footprint is `MODERN_PIECE_FOOTPRINT` (`pieceFootprint`); a
  `theatre-seat-row` takes `Furniture.seats` (default ten,
  `furnitureFootprint`).

## Her rooms (`concordia.ts`)

The pool hall (a deck room) first, then the rooms inside her, each inside
her model's solid blocks (`concordiaMap.test.ts` checks every room's box
against `concordiaRecipe.ts`'s blocks and her hull, under their roofs):

| Zone         | Rooms (deck)                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atrium`     | `atrium-3`, `atrium-3-fwd`, `atrium-well` (3); `atrium-4`, `atrium-4-fwd`, `entry-p`, `entry-s` (4); `atrium-5`, `atrium-5-fwd` (5); `atrium-stair` |
| `low-cabins` | `lobby-1`, `corridor-1`, `cabin-inside`, `cabin-ocean` (0 + 0.4 m, `seep`)                                                                          |
| `stateroom`  | `lobby-7`, `corridor-7`, `stateroom`, `balcony` (7)                                                                                                 |
| `theatre`    | `theatre-passage`, `theatre-back`, `theatre`, `stage-steps-p`/`-s`, `stage` (3); `theatre-passage-5`, `theatre-balcony` (5)                         |
| `squok`      | `squok` (12)                                                                                                                                        |
| `pool-hall`  | `pool-hall` (12, a deck room)                                                                                                                       |

Deck doors: `entry-p`, `entry-s` (from each boat deck's promenade, in the
recess wall) and `squok` (the pool hall's forward wall). Two glass lifts
(`lift-a`, `lift-b`) stop at deck 0 (the low lobby, + 0.4 m), 3, 4, 5 and 7. Entries: `atrium`,
`stateroom`, `low-cabin`, `theatre`, `squok`. Every invention is a ruling
in the file's header. `walk/__tests__/concordiaHallFeel.test.ts` walks
them as `hallFeel.test.ts` walks the Titanic's.

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

## Seep and closing (`seep.ts`, `open.ts`, hers)

- A room with `seep` takes the sea slowly: once the sea is over its
  lowest floor point the water over that point starts at nothing and rises
  toward the sea's depth there at most `ROOM_SEEP_M_PER_S` (0.005 m per
  shown second), never above the sea, never draining. `seepLevels(interior,
frames, spec)` integrates it once over a run's frames (`seepFor` caches it
  per track and extends it as the frames grow), so `seepLevelAt(table,
room, t)` is a lookup, the same played or seeked. Interior and WalkRunner
  use it as the room's target (`seepTarget`); the scene's 0.5 m/s ease stays
  on top, and the lean makes the water gather low and creep across.
- `roomsOpen(interior, frame, broken)`: false when she is broken, or when
  `closeAtHeelDeg` is set and `|frame.listDeg| ≥` it. Closed: deck doors do
  not open, the arrow and entries hide, Interior draws only deck rooms, and
  a walker inside is walked out onto the nearest dry deck door's outside
  (`doorExit`: the spawn, else the sea). The Titanic has no
  `closeAtHeelDeg`.

## Doors (`doorExit.ts`)

- `doorToEnter(map, area, at, depthAt, id?)`: the door button. The nearest
  deck door whose outside end is within `DOOR_REACH_M` (4 m) of the walker
  on the same area, or door `id` from anywhere (the test hook); only when
  its inside end is dry (`depthAt` < 0). Returns where to stand inside,
  facing on in.
- `doorExit(map, cameInBy, depthAt, near?)`: Go outside. The outside end of
  the door they came in by when it is dry, else the nearest dry deck door,
  else null (the scene then tries the spawn, else the sea). Facing out.

## Start inside (`entries.ts`, 1.16)

`InteriorMap.entries` are the rooms the camera picker can start a walk in:
an id, a label (only ever an `aria-label`, "Walk inside: …"), an
`EntryIcon` the HUD draws, the room and a spot and yaw in it (on a level
floor, clear of the walls and furniture: `__tests__/entries.test.ts`).
`openEntries(interior, ctx)` is the ones you can stand in now: none
without a frame or once the rooms have closed (`roomsOpen`: she broke, or
leans to her `closeAtHeelDeg`), none whose spot is under more than
wading depth (`WALK_WADE_STOP_M`). A room you cannot stand in is left out,
never greyed. The HUD starts the walk and stands the walker there with
`requestWalkPlace` (the test hooks' path), so a room start is the same as
walking in. A new ship adds entries as data.

## Lights (`lights.ts`)

`roomPower(power, depthM, t)`: the ship's power (the sim's `frame.power`)
while the water over the room's floor is under 0.3 m, flickering
(deterministic dips, the sim's own flicker, keyed on the time and depth)
from 0.3 to 0.6 m, and out from 0.6 m (the water reached the wiring).
`torchOn(roomPower)` is true under 0.35: the torch comes on by itself.

Hers: `roomPower(..., soft)` keys on a slower clock (2.5 a second) and coarser
depth, and `emergencyFlicker(power, emergencyLight, t, heelDeg)` is her
emergency lamps' multiplier (1 none): at the emergency power, none under 10°
of heel, one dip a second at 30° (0.2 s, soft edges, at least 0.4 s apart:
never faster than about 3 Hz), never under 0.1. Interior writes it to
`runtime.interiorEmergency` (reduced motion keeps 35% of each dip) and skips
the sim's 14 Hz shimmer for her.
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
3. Add her to `interiorFor` and merge her map in `walkMapFor`. Give her
   `entries` (the camera picker's room buttons) if she has rooms worth
   starting in.
4. Copy `__tests__/titanicMap.test.ts` for her (or make it table-driven):
   outlines, seams, reachability from a deck door, link ends, ceilings,
   water. Measure her water timeline the way `water.test.ts` does.
