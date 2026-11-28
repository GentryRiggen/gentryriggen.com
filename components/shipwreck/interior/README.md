# Inside her: the scene side

Draws the rooms of `lib/shipwreck/interior/` (the data, water and light
rules: see its README). 1.15: the Titanic only. The design:
`docs/superpowers/specs/2026-11-27-shipwreck-titanic-interiors-design.md`.

## Files

| File            | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Interior.tsx`  | Mounted beside `XRay` in `NightScene` (keyed by ship). Nothing until walk first starts on a ship with rooms; then builds the kit and its water once (in an effect that also disposes it; the build time is logged in dev), warms them with `gl.compile`, and each frame (priority −1.4, after `WalkRunner`) copies her `whole` part's world matrix onto its group, shows the walker's room's zone plus the zones it has doorways to (`zonesSeen`), eases their rooms' water levels, sets their lamps (`roomPower` from `frame.power` and the water at the room's middle, a flight's head; a dark room keeps 0.22 of a lit neighbour's light) and the lamps' shimmer while the power dips, and eases the torch on in a dim room (held 0.5 s, so a flicker does not blink it), aimed from the eyes. On the open deck only the door glow (hidden inside); nothing off the walk camera or after the break. Disposes on unmount or a ship change. |
| `kit.ts`        | `buildInterior(map, spec)`: per zone one merged geometry per layer (`shell`, `wood`, `metal`, `glass`) in the part's local frame (three.js axes: ship x, z, −y), the lamps' light baked in. See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `pieces.ts`     | The geometry `Builder` (every attribute the room shader reads) and the pieces: lamps (sconce, caged bulb, ceiling lamp), the dome and its chandelier, newel and cherub lamp, the clock panel, the rope, portholes, shut doors, balustrades, and the rooms' furniture (`FURNITURE`) and wall pieces (pipes, fire buckets, hose reel).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `materials.ts`  | `roomMaterials(count, shared, detail)`: the rooms' one shader family, a layer each. See "The look" below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `textures.ts`   | `detailTexture()`: the oak panel, grain, lino and carpet detail, one repeating tile drawn once.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `water.ts`      | `interiorWater(map, spec)`: per zone one water surface and one body, every vertex tagged with its room's slot (`aRoom`); `waterMaterials(count)`: their shaders, sharing the level and room-power uniforms. See "Water" below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `doorGlow.ts`   | `doorGlowGeometry`: each deck door's warm lit doorway (frame, light, the open leaf's edge) on the house face, one mesh, HDR so bloom catches it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `DoorArrow.tsx` | The way in (1.16), beside `Interior` in `NightScene`: built only while walking on a ship with rooms, one unlit billboard mesh (the arrow and its dark rim, `doorArrowGeometry`) over `runtime.walkArrow`'s deck door, its tip 2.6 m over the deck, 1.6 m tall and grown with distance (up to 4×) so it reads from anywhere on the deck, turned about the vertical to face the eyes, bobbing (still with reduced motion). Hidden inside, after the break and off her deck.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## The kit (`kit.ts`, `pieces.ts`)

Every face is single-sided and faces into its room. Colours are picked in
sRGB per finish (`RoomLook`), all under 1 (only glass glows, by `aGlow`).

- **Floors** follow the deck and her sheer, cut into 0.75 m cells for the
  light. A **flight** is treads and risers: `round(drop / 0.18)` risers,
  each tread's nosing on the walker's ramp (`floorZ`), its back one riser
  under it, the last level with the foot; brass nosings on oak stairs.
- **Walls** in 0.75 m columns and rows (skirting with a lip, dado, panels,
  a cove to the ceiling); oak or white panelling from the detail texture.
- **Ceilings** at `ceilingM` over the floor (a flight's over its top),
  except where another room's floor comes down through it (a stair under
  a stair: the soffit under every flight and landing shows, oak panelled
  on the Grand Staircase) and under the dome.
- **Edges**: a seam is open, with a **lintel** from the door's head
  (2.1 m) to the higher ceiling unless one side is a flight or landing.
  An edge level with a drawn-only (`noWalk`) room is open too (the roped
  B → C flight: the rope keeps you out). An edge beside another room at a
  different height with open height between is a **balustrade** (oak with
  iron balusters, or steel plate), with the slab's edge under it; over a
  void (no room stacked under it, as under the A → B twin flights) its
  outer face goes on down to the floor beside (a cheek), so nothing shows
  under the stair. A chamfer's short edge between open edges (the well's
  corners) is a balustrade too. Every other edge is a full **wall**. The
  C landing's after edge is split where the flight's foot meets it, so
  only the foot is open.
- **Pieces** (`pieces.ts`): the dome over the well (panes and lattice
  drawn by the glass shader, a gilt ring, the ceiling round it, the
  chandelier), the cherub lamp and newels, the clock panel, the rope,
  sconces, caged bulbs and ceiling lamps, portholes, shut doors (oak,
  white, steel) along walls from `shutDoors`; the furniture: the brass bed,
  oak twin beds, steel bunks with striped wool blankets and a ladder, the
  wardrobe (one mirrored door), the washstand (marble top, basin, jug,
  mirror), third class's enamel washbasin, the green velvet sofa, a round
  table with flowers, chairs; on walls, pipe runs (8 m each, end to end),
  fire buckets and hose reels. A blocking piece is centred on its
  `PIECE_FOOTPRINT` (lib's kit.ts), back to −x, and stays inside it (a
  pieces test). A room without a lamp of its own (and every
  foyer, over its floor) gets ceiling lamps (caged bulbs in steel rooms).
- **The light**, baked per vertex (`aLight`): an ambient share, then each
  lamp in the room or a room open to it (a seam, a stair, the well; the
  dome's over the zone) by distance, facing and not through a wall (for a
  lamp through a doorway), darker into corners and toward the floor.
  Pieces (furniture, flagged with `Layers.pieces`) are lit per 0.3 m
  cell, as one, without the walls' corner darkening.
- **Long halls in parts**: after the bake, a long hall's vertices move to
  their part's slot (`segments`, slots after the rooms'), so each part's
  lamps go by the water at its middle; the parts share the hall's level.
- **Doorways** get a frame (oak, white or steel by the finish); the lift
  car's opening its folded brass gates. A seam with no lintel between
  ceilings at different heights (the third-class landing and its passage)
  closes the step between them. A balustrade edge backed by another
  zone's room on the same line is a wall instead (no z-fighting).

**Inside wins**: while a room is drawn, an empty mesh drawn just before the
rooms (`renderOrder` 9, the rooms 10) clears the depth, so her exterior's
decks, roofs and walls that run through a room never show in it. The clear
and the rooms are in the transparent pass (the rooms with blending off, so
opaque), after every exterior piece of either pass: nothing outside (her
rigging lines, see-through decals) draws over a room. Never in the sea's
reflection (`runtime.reflecting`). Anything drawn in a room is at
`renderOrder` 10 or more.

**Budgets** (`__tests__/kit.test.ts`, which prints them with
`SHIPWRECK_PRINT_TRIANGLES=1`): the Grand Staircase zone at most 45k
triangles, every other zone 40k, each zone at most 6 meshes (4 layers and
the water's 2), the whole interior 120k. `buildInterior` takes about
20 ms warm in Chrome on a laptop (about 50 ms the first time).

## The look (`materials.ts`)

One `ShaderMaterial` family, no three.js lights, no fog: vertex colour
(times the detail texture's tint on panelling, lino and carpet) times the
baked light times the room's power (`uRoomPower[aRoom]`, read in the
vertex shader) and the ship's flicker (`uFlicker`), plus a faint blue
night light (never black) and the torch (a warm cone from under the eyes,
`uTorchPos`/`uTorchDir`, eased by `uTorchOn`). Wood and metal catch a
highlight from the lamps above and the torch. Glass glows (lamps HDR over
bloom's threshold; dull glass when out); the dome's panes glow warm in an
iron lattice; portholes show the scene's sky (`uSky`, the haze) or dark
sea green under earth y 0. Under its room's water level (`uLevel`) a
surface goes murky green, so a drowned room seen from above reads as
under water. The room power, levels, torch and time uniforms are the
water's own objects (one source of truth).

## Water (`water.ts`)

Per drawn room, X-ray's approach: a level **surface** and a **body**, see-through,
drawn after the rooms (`renderOrder` 11 and 12, over the depth clear's 10).

- **Levels**: each frame Interior takes each drawn room's target
  (`roomWaterTargets`: the sea, or a compartment room's level from the sim's
  fill) and eases the shown level toward it (`easeLevel`, at most 0.5 m per
  real second; a room just come into view starts at its target) into the
  `uLevel` uniform and `runtime.interiorLevels`. WalkRunner's `waterZ` (the
  walker's depth, the deep-water wall, the doors) reads the eased level, or
  the target for a room not drawn.
- **Surface**: the room's plan, triangulated as its floor; the vertex shader
  climbs her up axis from each plan point to the level, so the polygon lies
  exactly in the level plane however she trims, and the fragment keeps what
  is over the floor and under the ceiling. Dark greenish teal, murkier the
  deeper the water under it and the flatter the look, a soft lighter edge
  where it meets a sloping floor (the creeping waterline), gentle ripples, a
  little of the lamps' sheen at a grazing look.
- **Body**: each wall and balustrade face (seams are open) inset 2 cm, only
  under the level: walls darken under the water, with a wet line.
- **Light**: `uRoomPower[]` and the torch uniforms (`uTorchOn` 0..1,
  `uTorchPos`, `uTorchDir`), shared with the rooms' shader. No three.js
  lights, no fog. Every pow/sqrt/division guarded (`shaderGuards.test.ts`).
