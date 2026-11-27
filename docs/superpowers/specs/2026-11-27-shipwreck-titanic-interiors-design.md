# Shipwreck 1.15 — Go inside the Titanic

Date: 2026-11-27. Status: scope approved by Gentry (Titanic only, the rooms
below); the rulings at the end are open for him to revisit.

Builds on the walk spec (`2026-11-21-shipwreck-walk-design.md`, with its
1.3.2 "fun over realism" change), the lifeboat ride and the 1.13 jump. They
still hold for everything this document does not change.

## Why

Gentry's sons (6 and 8, iPad mini 6) want to explore inside the ships: walk
into rooms, go down the Grand Staircase, wander the halls. The walk spec
named this as the long-term goal ("go inside certain places, see things as
it sinks"). The headline moment is watching the sea come down a hallway and
up the staircase while you stand in it.

## Goals

- **Doors from the open deck.** On the Titanic's deck a few doors glow warm.
  Walk into one (or tap the big door button beside it) and you are inside.
- **The forward Grand Staircase** under its glass dome, walkable across three
  decks: the Boat deck entrance, A deck and B deck. The flight on down to C
  deck is drawn but roped off, so you can look down the well and watch the
  water climb toward you.
- **A first-class corridor on B deck** with three suites you can walk into
  (beds, wardrobe, washstand, oak or white panelling, a sofa, portholes).
- **Scotland Road**, the long working passage on E deck, port side, plus a
  **third-class cabin** with bunks off its forward end, reached by the
  third-class stairs from the forward well deck.
- **A first-class lift** from the B deck foyer down to E deck, beside
  Scotland Road (a ruling: it is the only dry way back to E deck once the
  forward stairs flood).
- **Every other door shut.** Painted closed doors line the corridors, so it
  reads as a big ship without hundreds of rooms.
- **Water inside**, level with the sea, rising room by room as she settles
  (see "Water inside" for why the sea's level and not the compartment fill).
- **Lights**: the sim's own power (flicker from trim 10°, out at the
  break), each room's lamps dying as the water reaches them, and a torch
  that comes on by itself in a dark room.
- **The joystick feels right in narrow halls**: you slide along walls at
  speed, doorways pull you through, corridors keep you straight, and a bot
  test walks every corridor and doorway.
- **The camera works in tight spaces**: no clipping, a wider view inside.
- **Big picture buttons**, no reading.
- **Reusable**: rooms, doors and furniture are per-ship data on a room kit,
  so later ships (with invented layouts where plans are thin) are data, not
  code. Only Titanic data in this release.

## Non-goals

- Other ships' interiors (the kit is ready; their data is later).
- The rest of the ship: dining saloons, the gym, the bridge inside, boiler
  rooms on foot. Places and the X-ray still show them from outside.
- Swimming inside, diving, holding your breath, or walking under water.
- Floating furniture, debris or luggage; doors that open and close; lifts
  with buttons; new sounds.
- Walking after the break (inside or on the pieces as interiors).
- Changing the sim, its tracks or any golden test. The interior only reads
  the sim.
- New analytics events or save fields.

## Anti-goals

- **No people**, no bodies, no belongings in the water, nothing scary. Dark
  rooms are never pitch black. Water is just water.
- **No cost when you are not inside.** The orbit, cinematic, X-ray and
  open-deck walk views draw exactly what they draw today; the interior is
  not even built until you walk on the Titanic.
- **No getting stuck or lost.** Every room is reachable from a deck door, a
  Go outside button is always there, and no spot can trap the walker against
  a wall corner.
- **No words in the kid UI.**

## Constraints

- iPad mini 6 at 60 fps. The interior is merged geometry with one cheap
  custom shader (no new three.js lights: adding a light recompiles every
  material in the scene and costs per pixel everywhere). See "Performance".
- Safari 15 compat lint; no per-frame allocations in frame-loop code.
- CI stays small: new unit tests are pure maths and fast; the e2e spec and
  the perf scenes run locally.
- Shipwreck release rules: bump `SHIPWRECK_VERSION` to 1.15.0 and add the
  changelog entry.
- `lib/` never imports `components/`.

## Approaches

1. **Picked (Gentry approved): a separate interior, drawn only while
   inside, on the walk maps, water from the sim.** Rooms are walk areas
   (2D outlines on a deck, as the open decks are) with a few additions
   (ramps for stairs, open "seam" edges between rooms, interior rules). The
   look is a merged room kit drawn only while you are inside or at a door.
   Water is a level plane per room from the sim. It reuses the walker, its
   tests, the eyes, the HUD and X-ray's water shaders, and costs nothing
   outside.
2. **Model the interior into the ship and cut the hull away (X-ray style).**
   One model, interiors visible from outside. Dropped: it adds cost to every
   outside view, multiplies the model's build time, and the hull would have
   to be hidden or ghosted to see in, which the kids would not want.
3. **Load a separate "inside" scene (a level change).** Easiest to make
   cheap. Dropped: you would lose the sinking ship around you (her pitch,
   the sea outside the portholes, water coming in at the sim's pace), which
   is the whole point.

## The design

### The frame, and where the interior lives

The ship frame as everywhere else (metres, keel at midships, `x` forward,
`y` to port, `z` up). Interior rooms are walk areas on the `whole` piece,
so they pitch and list with her exactly as the deck does. Interiors exist
only while she is whole (see "At the break").

### Data model: the room kit (`lib/shipwreck/interior/`)

Pure TypeScript, no three.js, one file of data per ship.

```ts
interface InteriorMap {
  ship: ShipId;
  rooms: readonly Room[];
  seams: readonly Seam[]; // open edges between rooms
  links: readonly InteriorLink[]; // deck doors and lifts (Stair-shaped)
  shutDoors: readonly ShutDoor[]; // painted closed doors on walls
  furniture: readonly Furniture[]; // kit pieces; some block the walker
}

interface Room {
  id: string; // "gs-boat", "gs-a", "gs-b", "gs-flight-a1", "b-corridor",
  // "suite-1", "scotland-road", "third-cabin", "lift-b", ...
  kind:
    "foyer" | "flight" | "landing" | "corridor" | "cabin" | "passage" | "lift";
  deck: string; // spec.decks name; floor = deckZAt(deck, x) + raiseM
  raiseM?: number;
  outline: readonly V2[]; // CCW, every edge a wall unless it is a seam
  ramp?: { from: V2; to: V2; dropM: number }; // a flight: the floor falls dropM from `from` to `to`
  ceilingM: number; // ceiling over the floor (a flight: over its higher end)
  zone: string; // drawn together: "gs", "b-deck", "e-deck", "third-stairs"
  look: RoomLook; // finish: "oak" | "white-panel" | "enamel" | "steel"; floor:
  // "lino" | "carpet" | "mosaic" | "steel"; lamps; portholes side
  axis?: readonly [V2, V2]; // a corridor's centre line (hall assist)
  water?: "sea" | "compartment"; // default from the bulkhead rule below
  noWalk?: boolean; // drawn, not walkable (the roped-off C landing)
}

interface Seam {
  a: string;
  b: string;
  at: readonly [V2, V2];
} // a shared outline segment
type InteriorLink = Stair & { kind: "door" | "lift" }; // the walk map's Stair, tagged
interface ShutDoor {
  room: string;
  at: V2;
  facing: number;
  style: "oak" | "white" | "steel";
}
interface Furniture {
  room: string;
  piece: PieceId;
  at: V2;
  yaw: number;
  blocks?: boolean;
}
```

Kit helpers build the outlines so the data stays short and correct:
`corridor(id, from, to, width)`, `cabin(id, along, door)`, `flight(id, top,
bottom, width)`, `doorway(a, b, at, width)` (cuts the opening into both
outlines and adds the seam). They also chamfer every reflex corner of a
walkable outline by 0.15 m (no corner traps) and widen doorways to 1.1 m
(real ones were about 0.75 m: fun over realism).

`withInterior(deckMap, interior)` merges it into the ship's `WalkMap`:
rooms become areas (flagged `interior`), blocking furniture becomes
blockers, links join `stairs`, seams join a new `WalkMap.seams`.
`walkMapFor("titanic")` returns the merged map; `TITANIC_WALK` (the open
decks) is unchanged. `interiorFor(ship)` returns the data (null for every
other ship).

### Titanic's rooms (`lib/shipwreck/interior/titanic.ts`)

Positions roughly right from the general arrangement and the model's
recipe; the exact numbers are the builder's within these, checked by the
map tests. Bulkheads for reference: D 70.7, E 54.3, F 36.9, G 19.5, H 2.1,
J −16.2.

| Room(s)                                      | Where                                                                  | Notes                                                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grand Staircase, Boat deck (`gs-boat`)       | inside the staircase house (x 33.2–41.6, y ±5)                         | landing round the well, the dome over it; doors in the house's port and starboard sides near x 35.5                                                  |
| Flights Boat→A, A→B                          | in the well, about x 34–41                                             | each deck: one broad flight (3 m) down forward to a half landing, then twin flights (1.5 m) port and starboard back aft. About 1.5 m drop per flight |
| A deck foyer (`gs-a`), B deck foyer (`gs-b`) | about x 31–44, y ±7 (A) and ±8 (B)                                     | oak panelling, the carved clock panel on the A deck half landing, the cherub lamp on the B deck newel                                                |
| C deck landing (`gs-c`, `noWalk`)            | under the B foyer                                                      | the B→C flight is drawn behind a rope: look down and see the water come                                                                              |
| B deck corridor (`b-corridor`)               | starboard, aft from the B foyer, about x 31→14, 1.4 m wide             | shut doors inboard and further aft                                                                                                                   |
| Suites 1–3                                   | outboard of the corridor, about 4–5 m each                             | a brass bed and wardrobe; twin beds and a washstand; a sitting room with sofa and table. Modelled on the B deck parlour suites, not a copy           |
| Lift car, B and E (`lift-b`, `lift-e`)       | just forward of the well, about x 42–44                                | a `lift` link between them                                                                                                                           |
| E deck lift lobby and cross passage          | about x 41–44, to Scotland Road                                        |                                                                                                                                                      |
| Scotland Road (`scotland-road`)              | E deck, port, x +70 → −16 (to bulkhead J), y about +3.0 to +5.6        | 86 m: steel painted cream, pipes, caged bulbs, lino; shut steel doors both sides every ~4 m                                                          |
| Third-class stairs (`third-stairs-*`)        | from a door in the forward well's after wall (x 76.2, port) down C→D→E | two steep flights and a landing, ending at Scotland Road's forward end                                                                               |
| Third-class cabin (`third-cabin`)            | E deck, forward, port, about x 72–76, y 5.6–8.6                        | two pairs of steel bunks, a washbasin, a porthole, white enamel                                                                                      |

Deck doors: two at the Grand Staircase house (port and starboard, Boat
deck), one at the forward well (third class). Each is a `door` link whose
outside end stands just off the house face on the open-deck area and whose
inside end is just inside: walking into it moves you through (the existing
stair rule). The spawn is unchanged (starboard boat deck at x 10, facing
the bow): the starboard staircase door is about 25 m ahead on the left.

### How interiors plug into the walker (`lib/shipwreck/walk/`)

`stepWalker` stays the one stepper. Additions, none of which change a deck
area's behaviour (every existing walk test passes unchanged):

- **Floors with y.** `floorZ(map, area, x, spec, y = 0)`: a ramp's floor
  falls linearly along `from → to`. `deckEyes`, `depthAt` and `placeWalker`
  pass y.
- **Seams.** In `moveInOutline`, an edge that is a seam is open: the move
  crosses it into the neighbouring room and carries on inside that room's
  outline. `resolveBody` never pushes off a seam edge. The "never leave the
  outline" check accepts the room the walker is now in. Seams join rooms at
  equal floor height (a test holds them within 2 cm), so the eyes never
  jump.
- **Links.** Deck doors and lifts are `Stair`s with a `kind`. A door does
  nothing while interiors are closed (after the break). A lift does not go
  while its arrival is deeper than the knee (0.5 m); it just stays put.
  `StepResult.via` reports a link taken (door id or lift) so the scene can
  remember the door you came in by and play the lift's wipe.
- **Interior rules** (only in `interior` areas): no jumping, the inside
  speed and the feel helpers below, and deep water as a wall.
- **Water from the context.** `StepContext.waterZ?(areaId, x, y)` gives the
  water's earth level over a point; the default is the sea (`seaZ`), so
  deck areas are unchanged. The scene passes the rooms' levels.
- **Blockers by area**: precomputed per area at merge time, so many
  furniture blockers do not slow the deck.

### The joystick in narrow halls (Gentry's emphasis)

All in `stepWalker`, interior areas only, as named constants in
`types.ts` with tests:

1. **Inside speed 3 m/s** (`WALK_INSIDE_SPEED_MS`; the deck keeps 4), with
   a 0.15 s ease-in from standing (`WALK_INSIDE_EASE_S`; stopping is
   instant). 4 m/s in a 1.4 m corridor reads as darting.
2. **Wall slide keeps speed.** The existing slide keeps only the motion
   along the wall, so pushing 30° into a wall loses half your speed and
   feels sticky. Inside, the slid motion is scaled back up to at least
   `SLIDE_KEEP` (0.75) of the stick's speed when the stick is within 60° of
   the wall's direction, fading linearly to nothing from 60° to 90° (no
   speed cliff at 60°). Pushing straight into a wall still stops you. It is
   measured after the move, so it covers furniture and jambs too.
3. **Hall assist.** In a room with an `axis`, a stick within 25° of the
   axis is steered onto it (fully within 10°, fading out at 25°), so a
   corridor walk does not zig-zag or scrape. Only the walk direction is
   steered, never the camera.
4. **Door funnel.** Within 1.5 m of a doorway (a seam between a corridor
   and a room) and heading within 40° of it, the walk direction bends
   toward the doorway's centre line (up to half the sideways part), so a
   child aiming roughly at a door goes through it instead of catching on
   the jamb (full to 30°, fading out at 40°, and over the last 0.4 m of
   reach). Doorways are seams with a `corridor` or `cabin` either side.
   **Pass-by** (built in Task 4, a ruling: a child aiming at a door must
   get in): walking by a doorway in a hall's side, the part of the walk
   toward it goes only when the walk's line misses the opening (fully
   0.3 m past the jamb, `DOOR_PASS_MISS_M`) or the walk is within 15° of
   the hall (`DOOR_PASS_DEG` 75° off straight through). Aiming at the door
   goes in; scraping the wall beside it stays in the hall.
5. **No corner traps.** The kit chamfers reflex corners. Inside, where the
   body's nearest point on a wall is that wall's end (a doorway's jamb, a
   seam-end corner the kit kept unchamfered, as at the A and B foyers'
   twin-flight landings), the push-out is straight away from that end
   point (disc against segment end), so the walker rolls round it. The
   inward normal there acts as if the wall went on past its end and holds
   the walker shuddering at a kept corner. The deck keeps the inward
   normal.
6. **Deep water is a wall.** A move into water deeper than 0.8 m
   (`WALK_WADE_STOP_M`) that is deeper than where you stand is refused, one
   axis at a time, so you still slide along the water's edge. You can wade
   to the edge and watch.

**The feel test** (`lib/shipwreck/walk/__tests__/hallFeel.test.ts`, fast
lane): a bot holds the stick and walks the real Titanic interior.

- Every corridor end to end with the view turned 0°, ±10°, ±20° and ±30°
  off the axis: arrives within its length ÷ (0.8 × inside speed) + 1 s, and
  never spends 0.5 s with under 0.5 m of progress. At ±30° toward the wall
  with side doors it may instead go in by the first of them (the ruling
  above).
- Every side doorway from 1 m along the corridor either side, aimed at it
  within −10°..+30° (and from 1.5 m, 0°..+30°; + is steeper at the door):
  through within 1.5 s. Aims nearer the corridor's axis than that miss the
  opening and are walks down the corridor (the hall assist governs); at
  −30° the walker stays in the hall. Every doorway also from 1 m straight
  out either side within ±30°, crossing clear of the jambs.
- Every reflex corner probed at ±20° and ±40°, and pushed square into and
  backed out of.
- Every flight up and down: the floor under the walker never changes by
  more than 0.1 m in a substep, and the walker stays inside some room.
- A random walk (seeded, 2 minutes of turning and pushing; a stopped
  walker turns away after 0.5 s) in every zone: never outside every
  outline, never stuck for 3 s, under a quarter of new directions forced
  by stopping.
- Deep water as a wall: the edge holds, sliding along it moves, and
  wading in deep water still moves.

### Rendering (`components/shipwreck/interior/`)

- **`Interior.tsx`**, mounted in `NightScene` next to `XRay`. It renders
  nothing unless walking on a ship with interior data. It builds the
  interior once, the first time walk starts on the Titanic (behind the walk
  start's camera cut), then warms the shader with `gl.compile` so the first
  door does not hitch. Each frame it copies the `whole` part's world matrix
  onto its group (as XRay does) and sets which zones are drawn.
- **Zones drawn**: the walker's room's zone and the zones seamed to it
  (the Grand Staircase zone and the B deck zone see each other; E deck is
  its own). On the open deck, nothing but the door glows. After the break,
  nothing.
- **The kit** (`kit.ts`): rooms to merged geometry, one mesh per material
  per zone: shell (walls, floor, ceiling from the outline and `ceilingM`,
  with mouldings, skirting and panel frames), panelling and furniture
  pieces (bed, bunk, wardrobe, washstand, sofa, table, chair, balustrade,
  newel and cherub lamp, dome, clock panel, pipes, caged bulb, sconce,
  porthole, shut door, rope), glass and lamps (HDR, so bloom makes them
  glow), and water. Low poly with good proportions and colour: realism of
  look over fidelity.
- **The shader** (`materials.ts`): one `ShaderMaterial` family. Light is
  baked into vertex colours at build time from each room's lamps (pools
  under sconces, darker corners), then scaled per frame by the room's power
  (`uRoomPower[]`, indexed by a vertex attribute), plus a faint blue night
  light (never black) and the torch: a warm cone from the eyes, computed in
  the shader (no three.js light). Procedural canvas textures (oak grain and
  panels, lino tiles, carpet) drawn once, as `model/textures.ts` does.
- **Portholes** show the night sky colour (or the day's, with the time
  button), and dark green once the sea outside is above them (the fragment's
  earth height against the sea).
- **Door glow on deck**: a warm lit doorway, door swung in, proud of the
  house wall at each deck door, drawn only while walking on her and she is
  whole. Not see-through (the exterior wall stays). One draw.
- **The exterior model is unchanged** except, if the builder's screenshot
  from inside the well shows the boat deck's roof plane across it, a hole in
  that roof (and any deck roof below) over the well in `titanicRecipe.ts`
  (same draws, a few triangles).

### Water inside

Measured on the real night (the sim's track, sea over each floor): the
compartments under the rooms never fill before the break (boiler room 5
reaches 0.97), while the sea outside climbs over E deck forward from about
0:18 AM. On the real ship the water above the watertight bulkheads (their
tops are E deck forward) spread along E deck, up stairs and through broken
scuttles, standing at about the sea's level.

So, per room (`lib/shipwreck/interior/water.ts`, `roomWaterLevel`):

- **A room on or above its compartment's bulkhead top** (its floor no more
  than 1 m under the top, `compartmentTopZ`): the water stands at the sea's
  level. Every room in 1.15 is one.
- **A room inside the watertight envelope** (future ships, lower decks):
  its compartment's level from the sim's fill, X-ray's `waterLevel`, never
  above the sea.

That gives, on the real night: the third-class cabin wet from about 0:15,
waist deep by 0:40; Scotland Road wet at its forward end from 0:18, at
midships about 1:08, at its after end about 1:57; the Grand Staircase from
below: C landing about 2:05, B foyer 2:10, A foyer 2:12; the Boat deck
entrance dry until the break (2:14).

The scene eases each room's shown level toward that target (at most 0.5 m
per real second), and the walker's depth reads the eased level, so a room
never pops full. Drawn with XRay's approach: per room a box clipped above
the level (body) and a level surface clipped to the room (ripples, a
greenish dark teal, slightly see-through, lit by the room's lamps and the
torch). Water down a sloping corridor or a flight is one flat plane against
a tilted floor: it creeps along the hall by itself as she settles.

### Lighting and lights-out

- **Ship power**: the sim's `frame.power` (the same that lights the
  portholes outside): flicker from the bow 10° down (2:13 on the real
  night), out at the break (2:14). The game's break is 2:14 where the real
  lights failed about 2:18, just before she broke: the game's lights-out is
  its own break, consistent with the rest of the game.
- **Room power**: each room's lamps flicker as its water passes 0.3 m and
  die at 0.6 m (water reached the wiring). So the lights going out inside is
  something you see, room by room, ahead of the break.
- **Torch**: in a room whose power is under 0.35, a warm torch beam comes on
  from the eyes, by itself. With the faint night light, no room is ever
  black.

### Entry, exit and the kid UI

- **Go in**: walk into a glowing door, or tap the big amber door button
  (picture: an open door) that shows while you are within 4 m of one and its
  inside is dry, as the lifeboat button does.
- **Go outside**: inside, a big button (picture: a door with an arrow out)
  takes you to the outside of the door you came in by; if that is flooded,
  the nearest dry deck door; else the spawn; else the sea (as Back on deck
  decides). Walking back out through the door works too.
- **No jump button inside.** Fly stays.
- **Lift**: walk into the car; a short dark wipe (the ripple wipe's
  sibling, a CSS animation keyed by a counter) covers the ride and you step
  out on the other deck. No buttons.
- `aria-label`s: "Go inside", "Go outside". The help card's walk line and
  the parent line mention the rooms in a few plain words.

### The camera in tight spaces

- Eyes as now (1.6 m over the floor, level with the horizon, no bob). The
  walker's 0.3 m body keeps the eyes 0.3 m off every wall; the walk near
  plane (0.1 m) is well inside that at any FOV used, so walls never clip.
- **Wider view inside**: the field of view eases from 42° to 65° on entering
  (0.4 s) and back on leaving or leaving walk. CameraRig restores the
  scene's FOV whenever walk ends.
- Ceilings: every walkable point keeps at least 2.1 m clear over the floor
  (a map test), so the eyes never meet a ceiling; no jumping inside.
- Crossing a deck door the feet move about 0.7 m; the eyes ease over
  0.12 s so it reads as a step, not a cut.

### At the break, flooded rooms, seeks

- **Inside at the break**: a splash (the ripple wipe) and you are floating
  in the sea beside her, as going in from the deck (`swimmerFrom` from where
  you were). Interiors close: doors stop glowing and do not open.
- **Water over the waist where you stand** (1 m, the deck rule): the same,
  washed out into the sea beside her. Deep water being a wall means you only
  get there if the water rises over you.
- **A seek** (or Back on deck) puts you on the boat deck spawn, as now.
- **Any wreck**: interiors work whenever the Titanic is the ship and she is
  whole (her iceberg, the torpedoes, the storm, the wave). A wreck that
  never breaks keeps them open to the end.

### Performance

- Not walking on the Titanic: the interior is not built, nothing is drawn,
  nothing runs per frame. Open-deck walking: one extra draw (the door
  glows) and a few cheap checks. `e2e/perf.spec.ts`'s existing budgets must
  not change.
- Inside: at most about 14 extra draws (6 materials over two zones, water,
  glass) and 60k triangles drawn. The whole interior about 120k triangles in
  memory; build under 40 ms on a laptop. New local perf scenes:
  `shipwreck-walk-staircase` (A deck foyer looking down the well at 2:10)
  and `shipwreck-walk-scotland-road` (1:30, water ahead), budgets near
  75 draws and 350k triangles (the open-deck walk is 61 and 290k).
- If an inside scene goes over, the first lever is skipping the sea's
  planar reflection while inside (`runtime.reflecting` is already a hook).
- Per frame inside: a handful of room levels (one sea height each, and the
  rare compartment level, X-ray's sorted samples), a uniform array, zone
  flags. No allocations.

### Save and analytics

- **Save**: nothing new (`shipwreck:v1` unchanged).
- **Analytics**: no new event. "How often do they go inside?" would be one
  enum value; adding it means the schema, the rules and the dashboard
  together, so it is a follow-up.

### Test hooks

`getWalk()` gains `area` and `inside`; new `placeWalk(area, x, y, yaw)` for
e2e and perf scenes, `enterDoor(id?)` (as the door button) and
`goOutside()`. Dev and `NEXT_PUBLIC_E2E=1` only, as the rest.

## Left to the builder

- Exact outlines, flight geometry, furniture placement and the look, within
  the table above and the map tests.
- Piece art (proportions, colours, how many mouldings), the shut door
  spacing, the door glow and button icons (`Icon.tsx` style).
- Whether the exterior roof needs the hole over the well (screenshot it).
- The torch cone and night light values (screenshot dark rooms on a real
  GPU).

## Rulings Gentry may revisit

1. **Rooms**: the Grand Staircase Boat → A → B (C landing roped off), one
   B deck starboard corridor with three suites (modelled on the parlour
   suites, not a copy), Scotland Road from x +70 to bulkhead J (86 m of
   it), the third-class stairs and one four-berth cabin. Layout roughly
   right; invented where the plans are thin.
2. **A first-class lift** (B deck ↔ E deck) was added: the forward
   third-class stairs flood from about 0:40, and the lift is the only dry
   way back to Scotland Road's after part. It will not go down once E deck
   there is knee deep.
3. **Water above the watertight bulkheads stands at the sea's level**, not
   at the X-ray compartment's level (those compartments never fill before
   the break). Compartment levels drive rooms inside the watertight
   envelope, which 1.15 does not have.
4. **Deep water is a wall at 0.8 m**; water over your waist where you stand
   washes you out into the sea beside her. No swimming inside.
5. **Lights**: the game's own power (flicker 2:13, out at the break, 2:14,
   standing in for the real 2:18), plus each room going dark as its water
   reaches 0.6 m; a torch comes on by itself; never pitch black.
6. **Inside at the break**: splash, floating in the sea beside her.
   Interiors close after the break.
7. **Inside speed 3 m/s** (the deck stays 4), a 0.15 s ease-in, hall and
   door assist steer the walk, never the camera.
8. **No jumping inside.**
9. **Doors from the deck glow but are not see-through.**
10. **Field of view 65° inside** (42° outside).
11. **A seek puts you back on the boat deck**, as now.
12. **No analytics event, no save change.**
13. **Works in every wreck** while she is whole.

## Changelog draft (1.15.0)

```ts
{
  version: "1.15.0",
  date: "<ship date>",
  title: "Go inside the Titanic",
  highlights: [
    "Walk up to a glowing door on the Titanic's deck and step inside",
    "Walk down the Grand Staircase under its glass dome, from the top deck down to B deck",
    "Visit first class rooms with big beds and wooden walls, and a third class cabin with bunk beds",
    "Ride the lift down to Scotland Road, the long hallway the crew used",
    "Watch the sea come down the hallway and up the stairs as she sinks. When the lights go out, a torch comes on",
    "Tap the door button to go back out on deck",
  ],
}
```
