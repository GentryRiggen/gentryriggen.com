# Shipwreck model

The procedural Titanic: built at load from the ship data
(`lib/shipwreck/ships/titanic.ts`) and a detail recipe
(`titanicRecipe.ts`). Nothing is downloaded: every texture is drawn into a
canvas once.

## Files

| File               | What                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `hullSurface.ts`   | The hull from the spec's offsets, interpolated with monotone cubics (smooth, exact at the stations); rounds the counter in plan.            |
| `titanicRecipe.ts` | Where everything goes: decks, houses, funnels, masts, boats, davits, 2,000+ portholes and windows, fittings, rails, wires, underwater gear. |
| `breakCut.ts`      | The jagged tear through `breakX` and which half a point belongs to.                                                                         |
| `buildShip.ts`     | Recipe to merged triangle lists per material, instance lists and line lists, for the whole ship or one half; quality tiers.                 |
| `partGeometry.ts`  | Funnels, boats, cowl vents, benches, bitts, rail posts, porthole and window panes.                                                          |
| `materials.ts`     | Hull paint by height in the shader, painted steel (vertex colours), planks, bronze, the name boards, the lit panes and their uniforms.      |
| `textures.ts`      | Plate seams and rivets (normal map), weathering, planks, the name.                                                                          |
| `shipModel.ts`     | Assembles the three.js tree and the handles.                                                                                                |
| `TitanicModel.tsx` | The R3F component.                                                                                                                          |
| `pose.ts`          | `applyBodyPose`: a sim `BodyPose` onto a part.                                                                                              |
| `ModelViewer.tsx`  | The checking stage at `/shipwreck?model` (dev and e2e builds only).                                                                         |

Frames: built in the ship frame (x forward, y to port, z up from the keel at
midships) and written in three.js axes (`three.x = x`, `three.y = z`,
`three.z = -y`). Every group below is in the ship frame, so a part posed with
`applyBodyPose` lands where the sim puts it.

## Using it

```tsx
const ship = useRef<TitanicHandles | null>(null);
<TitanicModel ref={ship} breakX={breakX} quality="high" />;

useFrame(() => {
  const h = ship.current;
  if (!h) return;
  for (const body of frame.bodies) applyBodyPose(h[body.part], body);
  h.setPower(frame.power);
});
```

`breakX` (ship-frame x, or null) and `quality` rebuild the model on the
main thread: about 60 ms the first time (recipe and textures) and 20–25 ms
after that at high on an M-series laptop (`handles.stats.buildMs`); expect
two to three times that on the iPad, so build at load or behind a
transition, never mid-scene. Everything per frame goes through the handles,
never through props.

**The break.** With `breakX` null the ship is one group, `whole`; `bow` and
`stern` are empty. With a number she is built as two halves split along the
jagged tear, `whole` empty. Set `breakX` as soon as the sim's track knows
where she breaks (it runs well ahead of playback) and pose both halves with
the whole ship's pose until the break: they fit together exactly, so the
rebuild never shows. The halves are open at the tear: dark inside, torn deck
ledges, a dark bulkhead a few metres in.

## Handles (`TitanicHandles`)

| Handle                                    | What                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root`                                    | Parent of everything. Leave it at the scene origin (identity).                                                                                                                                                                                                                                                  |
| `whole`, `bow`, `stern`                   | Ship-frame groups. Pose with `applyBodyPose(group, pose)` each frame.                                                                                                                                                                                                                                           |
| `breakX`                                  | What it was built with.                                                                                                                                                                                                                                                                                         |
| `funnels[0..3]`                           | One group per funnel, origin at the centre of its foot, a child of the part it stands on. Topple funnel 0 by turning it about its foot: `funnels[0].rotation.x` tips it sideways (positive: to starboard), `.rotation.z` fore and aft (negative: forward). Reparent with `Object3D.attach` to let it fall free. |
| `funnelGuys[i]`                           | That funnel's guy wires (`LineSegments`, or null at medium/low). Hide them when it falls.                                                                                                                                                                                                                       |
| `setPower(p)`                             | 0..1, every lit pane (the sim's `power`).                                                                                                                                                                                                                                                                       |
| `setDeckPower(deck, p)`                   | 0..1 per deck, index as `spec.decks` (0 Boat, 1 A, 2 B, 3 C, 4 D, 5 E, 6 F, 7 G). Dim a deck as the water reaches it.                                                                                                                                                                                           |
| `setFlicker(a)`                           | 0..1: circuits (a deck's run of cabins) dip together, about 11 times a second. The component advances the clock (`setTime`).                                                                                                                                                                                    |
| `light`                                   | The shared uniforms (`uPower`, `uDeckPower`, `uFlicker`, `uTime`, `uIntensity`), if you prefer to write them directly. `uIntensity` (default 5) sets how hard lit panes bloom.                                                                                                                                  |
| `boats.stow(i)`                           | Boat `i` (0..19, `TITANIC_BOATS` order, as the sim's `boat-lowered` index) in its chocks.                                                                                                                                                                                                                       |
| `boats.lower(i, dropM, swing = 1)`        | Swung out (`swing` 0..1) and lowered `dropM` metres down the side, riding with its part.                                                                                                                                                                                                                        |
| `boats.float(i, matrix)`                  | Free of the ship: `matrix` (position and rotation, no scale) of its keel centre in `root` space, i.e. three.js earth space when `root` is at the origin.                                                                                                                                                        |
| `boats.hide(i)`, `info(i)`, `holderOf(i)` | Hide it; its kind, side, stowed place and size; the part group it rides on while aboard.                                                                                                                                                                                                                        |
| `recipe`                                  | The detail recipe (positions of everything, for effects: funnel tops for steam, davit heads, boat lanterns).                                                                                                                                                                                                    |

The lit panes are HDR (`uIntensity` 5): with a bloom pass (threshold 1) the
windows glow. The scene should not tone-map the panes away: use the
composer's `ToneMapping` after `Bloom`, as the viewer does.

## Quality and budget

| Tier   | Draws (whole) | Draws (broken) | Triangles (whole) |
| ------ | ------------- | -------------- | ----------------- |
| high   | 24            | 36             | about 147k        |
| medium | 16            |                | about 101k        |
| low    | 15            |                | about 80k         |

Measured with `scripts/shipwreck-model-shots.mjs` (day stage, no
post-processing; the night stage's bloom adds about 17 draws). Medium and
low drop the rivet normal map, rails, rigging and small fittings (benches,
bitts, rail posts); low also drops the cowl vents and coarsens the hull,
funnels and boats.

## Checking it

`npx next dev --webpack`, then `/shipwreck?model` (orbit with the mouse) or
`node scripts/shipwreck-model-shots.mjs http://localhost:3000 .screenshots/task-3`
for the standard views and the draw counts.

## Departures from the ship data

- The drawn counter is rounder in plan than the offsets above the night's
  waterline: the offsets' run narrows from the engine room aft all the way
  up to the deck, which puts a pointed stern under the poop. The drawn hull
  takes the larger of the offsets and a superellipse from x = −62 m, faded
  in between 11.2 and 16 m above the keel. Below 11 m it is the offsets
  exactly (tested). The sim's volumes are unchanged; adopting the rounder
  counter there would add a little reserve buoyancy aft late in the sinking.
- Paint: red antifouling below the 10.54 m load waterline (the real paint
  line), a white boot-top, black to the C deck edge, the gilt line just
  under it, white above.
