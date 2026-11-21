# Shipwreck model

The procedural ships: each built at load from its ship data
(`lib/shipwreck/ships/titanic.ts`, `lusitania.ts`) and a detail recipe
(`titanicRecipe.ts`, `lusitaniaRecipe.ts`; `recipeFor(spec)` picks by
`spec.id`). Nothing is downloaded: every texture is drawn into a canvas
once.

## Files

| File                 | What                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hullSurface.ts`     | The hull from the spec's offsets, interpolated with monotone cubics (smooth, exact at the stations); rounds the counter in plan.                              |
| `titanicRecipe.ts`   | Where everything goes: decks, houses, funnels, masts, boats, davits, 2,000+ portholes and windows, fittings, rails, wires, underwater gear. The recipe types. |
| `lusitaniaRecipe.ts` | The Lusitania's: her tiers (`blocks`), houses, funnels, 48 boats, 44 davits, lights, the forest of ventilators, four propellers; `PEACETIME_PAINT`.           |
| `breakCut.ts`        | The jagged tear through `breakX` and which half a point belongs to.                                                                                           |
| `buildShip.ts`       | Recipe to merged triangle lists per material, instance lists and line lists, for the whole ship or one half; quality tiers.                                   |
| `partGeometry.ts`    | Funnels, boats, cowl vents, benches, bitts, rail posts, porthole and window panes.                                                                            |
| `materials.ts`       | Hull paint by height in the shader, painted steel (vertex colours), planks, bronze, the name boards, the lit panes and their uniforms.                        |
| `textures.ts`        | Plate seams and rivets (normal map), weathering, planks, the name.                                                                                            |
| `shipModel.ts`       | Assembles the three.js tree and the handles.                                                                                                                  |
| `TitanicModel.tsx`   | The R3F component (any ship: `spec`).                                                                                                                         |
| `pose.ts`            | `applyBodyPose`: a sim `BodyPose` onto a part.                                                                                                                |
| `ModelViewer.tsx`    | The checking stage at `/shipwreck?model` (`&ship=lusitania` for her; dev and e2e builds only).                                                                |

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
for the standard views and the draw counts (add `lusitania` as a third
argument, and `/shipwreck?model&ship=lusitania`, for her).

The Titanic's recipe is frozen: `__tests__/titanicRecipeSnapshot.test.ts`
compares it field by field with a fixture written before the Lusitania
touched the shared code. Everything a second ship needed is an optional
recipe field (`paint`, `blocks`, `boxes`, `drums`, `ledgeDecks`,
`staffs`, the rudder's `centre` and `posts`) whose absence builds the
Titanic exactly as before.

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

## The Lusitania

`lusitaniaRecipe.ts`, as she was on the afternoon of 7 May 1915.

| Tier   | Draws (whole) | Draws (broken) | Triangles (whole) |
| ------ | ------------- | -------------- | ----------------- |
| high   | 25            | 38             | about 145k        |
| medium | 17            |                | about 95k         |
| low    | 15            |                | about 72k         |

Build times (`handles.stats.buildMs`, same laptop and script as the
Titanic's): 59 ms the first time (Titanic 64), 18 ms after (Titanic 21),
24 ms broken (Titanic 27).

### Her paint in May 1915

`PEACETIME_PAINT` (one constant at the top of the recipe) switches to her
1907–1914 colours. Off, she is painted as on the day:

- **Funnels painted out dark.** Schwieger's war diary (U-20, 7 May): "The
  funnels were painted black, no flag was set astern." Wikipedia's
  "Sinking of the RMS Lusitania" (citing Layton): in 1915 "her funnels were
  most likely painted a dark grey to help make her less visible to enemy
  submarines"; the Illustrated War News (12 May 1915) shows the funnels
  being painted "war-grey" at sea; rmslusitania.info ("Lusitania at war"):
  in April 1915 "her funnels were changed from the distinctive Cunard
  red-orange to black". The last photograph of her leaving New York
  (1 May 1915, Wikimedia "Lusitania Leaving NY Harbor on Last Voyage")
  shows four uniformly dark funnels. We use a very dark grey with the tops
  and bands a shade darker (barely there, as painted over).
- **Name not painted out**, in gilt. Schwieger: "on the bow the name
  'Lusitania' becomes visible in golden letters"; Wikipedia: "no attempt
  was made to paint out the ship's name at the prow", "her name was picked
  out in gilt"; linerdesigns.com ("Lusitania 1915"): "her name was not
  removed from her bow or stern". On the foredeck's plating just above the
  Shelter deck about 73 ft from the stem (her profile), and on the counter
  with LIVERPOOL.
- **Superstructure white again**, with "a bronze/gold coloured band around
  the base of the superstructure" (Wikipedia after Layton, _Lusitania: An
  Illustrated Biography_, 2010): the gilt line along the Shelter deck
  edge. (rmslusitania.info says the superstructure went grey in April 1915;
  the 1 May photograph shows it white, so white it is.)
- **Hull** black to the Shelter deck (to the Promenade deck forward of the
  bridge), red antifouling to the 33 ft 6 in load line with a thin white
  boot-top (both visible in the 1 May photograph and her peacetime ones).

Peacetime (switch on): Cunard red-orange funnels with black tops and three
thin black bands, no gilt band.

### Her shape (from her plans and photographs)

Sources: the general arrangement published in 1907 (profile and every
deck; Wikimedia "RMS Lusitania deck plans"), photographs on Wikimedia
(Library of Congress Bain collection: "Lusitania New York 1914 Lifeboats",
the 1907 maiden arrival broadside and stern views, "RMS Lusitania coming
into port … 1907–13", the 1915 departure), Wikipedia "RMS Lusitania",
rmslusitania.info (Mauretania "Design and construction"), linerdesigns.com
("Lusitania 1907 sea trials", "Lusitania 1915").

- **A long foredeck at Promenade (B) level**, plated black from the stem
  to the bridge (no well deck): the black steps down to the Shelter deck at
  the bridge front, the "stepped" forward superstructure that tells her
  from the Mauretania. Capstans, windlasses, the hatch and the anchor crane
  (her B deck plan), a V breakwater ahead of the bridge, derricks on the
  foremast.
- **The bridge**: the boat deck and the Promenade deck end in shallow
  rounded fronts (the observation room); the boat deck house's front is
  rounded too; the officers' house and wheelhouse on its roof, the bridge
  wings out to the ship's sides with cabs at their ends.
- **Open promenades**: the Shelter deck (C to B) open between stanchions,
  then a white bulwark, then the Promenade deck open above it under the
  boat deck (the 1914 lifeboats photograph). A long house on the boat deck,
  set in from the edge, its roof carrying the funnels' casings, the
  skylights of the smoke room, lounge and writing room, the main
  companionway's dome, and the ventilators.
- **Funnels**: four working, 25 by 21 ft, raked aft 7.5° (her profile
  measures about 7–8°; photographs agree), black-topped, steam pipes up the
  forward faces, whistles on the first two. They stand at `spec.funnels`.
- **Ventilators**: a forest of tall cowls round every funnel, mouths
  forward and aft, and the flat drum ("oil-drum") ventilators beside the
  casings. Her drum vents were her mark against the Mauretania's cowls
  (rmslusitania.info; Wikipedia: "the flat-topped ventilators used on
  Lusitania"); some were replaced by cowls over the years (linerdesigns),
  and the 1914 photograph shows both: we show both.
- **Boats**: 22 wooden lifeboats in radial davits along the boat deck's
  edges (11 a side, odd numbers to starboard), each over a collapsible (the
  1914 photograph shows them stacked); eight collapsibles on the 2nd class
  house's deck aft, two rows a side. `LUSITANIA_BOATS` order and x.
- **Aft**: the mainmast in the gap between the boat deck and the 2nd class
  house (her boat deck plan), the house with its own promenades and boat
  deck, a lounge on top and the docking bridge across its after end, the
  open Shelter deck over the counter.
- **Masts** raked like the funnels, aerials about 165 ft over the water
  (her profile), a crow's nest halfway up the foremast.
- **Under water**: four four-bladed propellers (three-bladed as built,
  four-bladed from 1909: Wikipedia), the inner pair just forward of the
  rudder, the outer pair further forward on long bossings; one rudder
  under the counter abaft the sternpost.
- **Portholes**: the Upper (D) deck row end to end, and every porthole
  row the sim floods through (`spec.portholes`, Main and Lower decks),
  exactly at the row's height at its middle and following the sheer from
  there (the sim's row is level; the drawn row keeps to its deck).

### Departures from the ship data

- **The bridge and funnels sit further aft in `lusitania.ts` than on her
  plans.** Measured off the 1907 profile, the deck plans and the 1907
  broadside: bridge front about x 73–76 m (about 140 ft from the stem),
  funnels at about 48–52, 23–24, −1 to −4 and −26 to −30 m; the data has
  the bridge at 57.9 m (190 ft from the forward perpendicular, flagged
  there as an assumption) and the funnels at 41.2, 17.6, −8.3, −34.2 m.
  The model keeps the data's funnels and boats (the sim and the scene read
  them) and puts the bridge 24 m ahead of the first funnel (x 65.2), as on
  her plans, so the bridge-to-funnel look is right. Moving the funnels and
  the bridge forward in the data would carry the model with it.
- **No forward well deck**: the data's superstructure boxes have a 95 ft
  forecastle and an open well between it and the bridge; her plans have
  the Promenade deck running from the stem to the bridge. The drawn
  foredeck is at Promenade level; the sim's volumes are unchanged.
- **The after house** is drawn from x −104 to −66.5 (her plans), the open
  stern deck at Shelter level abaft it; the data's boxes raise the poop to
  B + 0.6 m.
- The drawn counter is rounder in plan above 10.5 m than the offsets (an
  ellipse from x −85 m, as for the Titanic), and the stern decks' rails
  follow it.
