# Inside her: the scene side

Draws the rooms of `lib/shipwreck/interior/` (the data, water and light
rules: see its README). 1.15: the Titanic only. The design:
`docs/superpowers/specs/2026-11-27-shipwreck-titanic-interiors-design.md`.

## Files

| File           | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Interior.tsx` | Mounted beside `XRay` in `NightScene` (keyed by ship). Nothing until walk first starts on a ship with rooms; then builds the kit and its water once (in an effect that also disposes it), warms them with `gl.compile`, and each frame (priority −1.4, after `WalkRunner`) copies her `whole` part's world matrix onto its group, shows the walker's room's zone plus the zones it has doorways to (`zonesSeen`) and eases their rooms' water levels. On the open deck only the door glow (hidden inside); nothing off the walk camera or after the break. Disposes on unmount or a ship change. |
| `kit.ts`       | `buildInterior(map, spec)`: one merged, vertex-coloured `BufferGeometry` per zone in the part's local frame (three.js axes: ship x, z, −y). See below.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `water.ts`     | `interiorWater(map, spec)`: per zone one water surface and one body, every vertex tagged with its room's slot (`aRoom`); `waterMaterials(count)`: their shaders, sharing the level and room-power uniforms. See "Water" below.                                                                                                                                                                                                                                                                                                                                                                   |
| `doorGlow.ts`  | `doorGlowGeometry`: each deck door's warm lit doorway (frame, light, the open leaf's edge) on the house face, one mesh, HDR so bloom catches it.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## The blockout kit (`kit.ts`)

Every face is single-sided and faces into its room. One plain unlit
material (`MeshBasicMaterial`, vertex colours, no fog); colours are picked
in sRGB per finish (`RoomLook`) and shaded by face: floors, ceilings,
risers and soffits each a set share; walls by which way they face, darker
toward the floor, in 2.4 m panels (every other one a shade darker) on a
dark skirting.

- **Floors** follow the deck and her sheer (outlines cut at the panel
  joints, so a long hall never sags off its walls). A **flight** is treads
  and risers: `round(drop / 0.18)` risers, each tread's nosing on the
  walker's ramp (`floorZ`), its back one riser under it, the last level
  with the foot.
- **Ceilings** at `ceilingM` over the floor (a flight's over its top),
  except where another room's floor comes down through it (a stair under a
  stair): there the **soffit** under every flight and landing shows.
- **Edges**: a seam is open, with a **lintel** from the door's head (2.1 m)
  to the higher ceiling unless one side is a flight or landing. An edge
  level with a drawn-only (`noWalk`) room is open too (the roped B → C
  flight and the C landing: the rope keeps you out, the walker has no seam
  there), even where a room stacked above makes it a balustrade. An edge
  that runs opposite another room's edge (side by side, not stacked) at a
  different floor height with open height shared between them is a
  **balustrade** (1 m, its inner face 6 cm into the room, its outer face
  down to the slab under it); every other edge is a full **wall**.

**Inside wins**: while a room is drawn, an empty mesh drawn just before the
rooms (`renderOrder` 9, the rooms 10) clears the depth, so her exterior's
decks, roofs and walls that run through a room never show in it. Never in
the sea's reflection (`runtime.reflecting`).

Budget: each zone under `ZONE_TRIANGLE_BUDGET` (20k) in the blockout; the
Titanic's zones are about 1k triangles each (`__tests__/kit.test.ts` prints
them). Task 6 replaces the material with the room shader and adds the
pieces.

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
- **Light**: `uRoomPower[]` (all 1 for now) and the torch uniforms
  (`uTorchOn` 0, `uTorchPos`, `uTorchDir`) for Task 6. No three.js lights,
  no fog. Every pow/sqrt/division guarded (`shaderGuards.test.ts`).
