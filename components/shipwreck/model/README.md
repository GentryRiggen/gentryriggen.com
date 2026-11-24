# Shipwreck model

The procedural ships: each built at load from its ship data
(`lib/shipwreck/ships/titanic.ts`, `lusitania.ts`, `fitzgerald.ts`,
`carpathia.ts`, `britannic.ts`, `concordia.ts`) and a detail recipe
(`titanicRecipe.ts`, `lusitaniaRecipe.ts`, `fitzgeraldRecipe.ts`,
`carpathiaRecipe.ts`, `britannicRecipe.ts`, `concordiaRecipe.ts`,
`poseidonRecipe.ts` on the cruise kit; `recipeFor(spec, livery?)` picks by `spec.id`, and by
livery for a ship with more than one: see "Liveries" below). Nothing is
downloaded: every texture is drawn into a canvas once.

## Files

| File                  | What                                                                                                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hullSurface.ts`      | The hull from the spec's offsets, interpolated with monotone cubics (smooth, exact at the stations); rounds the counter in plan.                                                                                                                                                                |
| `titanicRecipe.ts`    | Where everything goes: decks, houses, funnels, masts, boats, davits, 2,000+ portholes and windows, fittings, rails, wires, underwater gear. The recipe types.                                                                                                                                   |
| `lusitaniaRecipe.ts`  | The Lusitania's: her tiers (`blocks`), houses, funnels, 48 boats, 44 davits, lights, the forest of ventilators, four propellers; her liveries `war-1915` and `cunard-1907`.                                                                                                                     |
| `fitzgeraldRecipe.ts` | The Edmund Fitzgerald's: forecastle, texas house and pilothouse, the after house, 21 hatch covers on coamings, the hatch crane, one funnel, boats, one propeller; `FENCE_GAP`.                                                                                                                  |
| `carpathiaRecipe.ts`  | The Carpathia's: forecastle, two wells, the bridge deck house and promenade, the boat deck and its houses, one funnel, four masts with derricks, 20 boats, twin screws, the stern gun; liveries `dazzle-1918`, `cunard-1912` (and `grey-1918`, a recipe option).                                |
| `dazzle.ts`           | Her 1918 dazzle scheme as shapes (pure data; port and starboard differ).                                                                                                                                                                                                                        |
| `britannicRecipe.ts`  | The Britannic's: her sister's recipe with the hospital paint (`bandPaintAt`), five gantry davit sets, Welin davits, A/B deck screens, "G.618", the bow's hinge.                                                                                                                                 |
| `britannicLivery.ts`  | Her two paints on one built model (R23): `britannicModelRecipe`, `attachBritannicLivery`, her `handles.setLivery("hospital" \| "liner")`.                                                                                                                                                       |
| `concordiaRecipe.ts`  | The Costa Concordia's: her tiers, boat recess, balconies, stepped front and terraces, bridge wings, spa, pool glass, slide, radar mast and domes, one funnel with the "C", 26 boats, twin screws and rudders, the rock's place.                                                                 |
| `cruiseKit.ts`        | The cruise kit: the Concordia recipe's builders lifted out and parametrised (tiers, balconies, panes, boats and davits, rafts, rails, the funnel, the mast, the slide, twin screws, names, the emergency mask), so the Poseidon is built from the same parts.                                   |
| `poseidonRecipe.ts`   | The Poseidon's (made up, ours): her tiers on the cruise kit, balconies decks 7–11, the boat recess on deck 4 with 24 boats, the stepped front and bridge on deck 9, one raked tapering funnel with a fin and the gold wave, the ballroom's drum and ribbed glass dome, twin screws and rudders. |
| `rock.ts`             | The rock stuck in her side (R21): `createRockMesh`, `disposeRockMesh`.                                                                                                                                                                                                                          |
| `bowBend.ts`          | The bent bow (R12): `hardLandingAt`, `bowBend(t, landedAt)`, `bendShipPoint`, `applyBowBend`.                                                                                                                                                                                                   |
| `breakCut.ts`         | The jagged tear through `breakX` and which half a point belongs to.                                                                                                                                                                                                                             |
| `buildShip.ts`        | Recipe to merged triangle lists per material, instance lists and line lists, for the whole ship or one half; quality tiers.                                                                                                                                                                     |
| `partGeometry.ts`     | Funnels, boats, cowl vents, benches, bitts, rail posts, porthole and window panes.                                                                                                                                                                                                              |
| `materials.ts`        | Hull paint by height in the shader, painted steel (vertex colours), planks, bronze, the name boards, the lit panes and their uniforms.                                                                                                                                                          |
| `textures.ts`         | Plate seams and rivets (normal map), weathering, planks, the name; the dazzle texture (`acquireDazzleTexture`).                                                                                                                                                                                 |
| `shipModel.ts`        | Assembles the three.js tree and the handles.                                                                                                                                                                                                                                                    |
| `TitanicModel.tsx`    | The R3F component (any ship: `spec`).                                                                                                                                                                                                                                                           |
| `pose.ts`             | `applyBodyPose`: a sim `BodyPose` onto a part.                                                                                                                                                                                                                                                  |
| `ModelViewer.tsx`     | The checking stage at `/shipwreck?model` (`&ship=lusitania`, `fitzgerald`, `carpathia`, `britannic`, `concordia` or `poseidon`, `&livery=<id>`, e.g. `cunard-1907` or `grey-1918`; `setModelView({ livery })` repaints live; dev and e2e builds only).                                          |

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
| `foremast`, `showForemastWires(show)`     | The Britannic's foremast as its own part (`{ group, mast }`: origin at its foot, length up local +y, in `mats.paint` with her mast paint as the merged masts), and its wires (stays, shrouds, the aerial) on/off. Missing for the other ships. `scene/mastWreck.ts` lays it on the floor.                       |
| `setPower(p)`                             | 0..1, every lit pane (the sim's `power`).                                                                                                                                                                                                                                                                       |
| `setDeckPower(deck, p)`                   | 0..1 per deck, index as `spec.decks` (0 Boat, 1 A, 2 B, 3 C, 4 D, 5 E, 6 F, 7 G). Dim a deck as the water reaches it.                                                                                                                                                                                           |
| `setFlicker(a)`                           | 0..1: circuits (a deck's run of cabins) dip together, about 11 times a second. The component advances the clock (`setTime`).                                                                                                                                                                                    |
| `light`                                   | The shared uniforms (`uPower`, `uDeckPower`, `uFlicker`, `uTime`, `uIntensity`), if you prefer to write them directly. `uIntensity` (default 5) sets how hard lit panes bloom.                                                                                                                                  |
| `boats.stow(i)`                           | Boat `i` (0..19, `TITANIC_BOATS` order, as the sim's `boat-lowered` index) in its chocks.                                                                                                                                                                                                                       |
| `boats.lower(i, dropM, swing = 1)`        | Swung out (`swing` 0..1) and lowered `dropM` metres down the side, riding with its part.                                                                                                                                                                                                                        |
| `boats.float(i, matrix)`                  | Free of the ship: `matrix` (position and rotation, no scale) of its keel centre in `root` space, i.e. three.js earth space when `root` is at the origin.                                                                                                                                                        |
| `boats.hide(i)`, `info(i)`, `holderOf(i)` | Hide it; its kind, side, stowed place and size; the part group it rides on while aboard.                                                                                                                                                                                                                        |
| `bend`                                    | The bow forward of the recipe's `hinge` (a child of `whole`), or null: pose it with `applyBowBend(bend, bowBend(t, hardLandingAt(track)), recipe.hinge)`.                                                                                                                                                       |
| `recipe`                                  | The detail recipe (positions of everything, for effects: funnel tops for steam, davit heads, boat lanterns).                                                                                                                                                                                                    |
| `setLivery(id)`, `livery`, `liveries`     | Repaint her live (see "Liveries"): an id in `liveries` (empty for a ship with one paint); others are ignored. `livery` is the one shown.                                                                                                                                                                        |
| `warmLiveries(compile, upload?)`          | Shows every livery's own parts while `compile` runs (`gl.compile(scene, camera)`), then hands their textures to `upload` (`gl.initTexture`), so a first swap compiles and uploads nothing big. The scene calls it once per built model.                                                                         |

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
bitts, rail posts); the Britannic's gantries and crosses stay; low also drops the cowl vents and coarsens the hull,
funnels and boats.

## Checking it

`npx next dev --webpack`, then `/shipwreck?model` (orbit with the mouse) or
`node scripts/shipwreck-model-shots.mjs http://localhost:3000 .screenshots/task-3`
for the standard views and the draw counts (add `lusitania`,
`fitzgerald` or `carpathia` as a third argument, and `&ship=<id>` to the
viewer's URL, for them; a fourth argument is a livery id, `&livery=`,
e.g. `cunard-1907`, `cunard-1912` or `grey-1918`; the Carpathia does
not break, so her set has no broken views).

The Titanic's, the Lusitania's and the Fitzgerald's recipes are frozen:
`__tests__/titanicRecipeSnapshot.test.ts` compares each field by field
with a fixture (the Titanic's written before the Lusitania touched the
shared code, the Lusitania's before the Fitzgerald did, the Fitzgerald's
before the Carpathia did). Everything a
later ship needed is an optional recipe field (`paint`, `blocks`, `boxes`,
`drums`, `ledgeDecks`, `staffs`, the rudder's `centre` and `posts`; for
the Fitzgerald `bells`, a block's `wallColor`, `roofColor` and `camber`,
a hatch's `color` and `coaming`, a funnel's `stripes` and `emblem`, a
rail's `color`, the paint's `port`, `letters`, `hull` and `boat`, a
centre-line boat, a name board's `rows`, `createHullSurface`'s bow
rounding with its `tip` and its propeller `aperture`; for the Carpathia
the paint's `dazzle`, `fittings`, `vent` and the hull's `boot`, a block's
or house's `dazzle`, a house's `wallColor`, an anchor's `stockless`, the
masts' `mizzen` and `jigger` ids, `ventGeometry`'s body colour, and the
part's `dazzle` list) whose absence builds the earlier ships exactly as
before.

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
| high   | 25            | 38             | about 147k        |
| medium | 17            |                | about 97k         |
| low    | 15            |                | about 73k         |

Build times (`handles.stats.buildMs`, same laptop and script as the
Titanic's): 61 ms the first time (Titanic 68), 20 ms after (Titanic 24),
23 ms broken (Titanic 30).

**She follows her data.** Funnels and boats stand where `lusitania.ts`
puts them; every tier's ends are its superstructure boxes (`[2]` the long
house, its front the bridge's; `[1]` the foredeck plated to B; `[0]` the
2nd class house); porthole rows follow `spec.portholes` (level, or along
the sheer from the row's middle when `followsSheer`). What the data has no
field for is measured off her 1907 profile and plans from the stem, the
forward or the after perpendicular: the foremast (100 ft abaft the FP, its
crow's nest 42 ft up), the mainmast's 1.2 m gap, the foredeck's capstans,
windlasses, hatch and anchor crane, the name (73 ft from the stem) and the
hawse pipes (28 ft), the propellers and rudder (from the AP).

### Her paint in May 1915

Her default livery, `war-1915` (`LUSITANIA_LIVERIES` in her data,
`lib/shipwreck/ships/lusitania.ts`); her 1907 colours are the other
livery, below ("The Lusitania's liveries"). Her funnel colours live there
too (`LUSITANIA_FUNNEL_PAINT`, `spec.funnelPaint` and each livery's
`funnelPaint`), so the hull diagram and the model paint them alike. She
is painted as on the day:

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

Her 1907 livery: see "The Lusitania's liveries" under "Liveries".

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

### Assumptions and departures

- **Masts** buff (`0xa9835a`): the period's practice for Cunard's masts;
  no source gives her shade.
- **Cowl linings** dark red-brown (`0x5a241c`): red lead or red paint
  inside cowls was common practice; no source gives hers (an Encyclopedia
  Titanica thread asks the same and has no answer). The cowls are turned
  as in her photographs, some forward, some aft, some outboard.
- **The gilt band** runs along the Shelter deck edge, round the base of
  the superstructure, and stops at the house front (the foredeck's black
  plating has none): `sheerLineZ`.
- **Bossings** are long cones whose roots lie wholly inside the hull, so
  they swell out of the narrowing run; the rudder has a round stock on the
  sternpost and tapers from 0.55 m to 0.15 m at its trailing edge.
- The data runs the boat deck and the 2nd class house together; the model
  leaves the 1.2 m gap of her plans for the mainmast.
- The drawn counter is rounder in plan above 10.5 m than the offsets (an
  ellipse from x −85 m, as for the Titanic), and the stern decks' rails
  follow it.
- Estimates: funnel section 25 × 21 ft, boats 30, 27 and 23 ft,
  propellers 4.7 m across. The 1915 funnels keep 1.1's band places (an
  estimate, barely seen under the dark paint); the 1907 livery's are
  measured (below).

### The name on the counter

`counterX` (`buildShip.ts`) finds the counter's surface at (y, z) for the
name's letters. On the centre line it looked for any half-breadth ≥ 0,
which is everywhere, and put the middle of the name at the hull's very
end, metres aft: a spike that garbled both ships' names seen from the
quarter ("TITA NIC", "LIVE POOL"). It now looks for the first real
breadth (`__tests__/names.test.ts`).

## The Edmund Fitzgerald

`fitzgeraldRecipe.ts`, as she was on the afternoon of 10 November 1975.

| Tier   | Draws (whole) | Draws (broken) | Triangles (whole) |
| ------ | ------------- | -------------- | ----------------- |
| high   | 17            | 29             | about 74k         |
| medium | 13            |                | about 42k         |
| low    | 11            |                | about 21k         |

Build times (`handles.stats.buildMs`, same laptop and script): 47 ms the
first time (Titanic 62), 15 ms after (Titanic 20–25), 18 ms broken
(Titanic 27). Night (bloom) 34 draws. She is far under the 1.0 budgets:
most of her length is open deck.

**She follows her data.** Her houses are the data's superstructure boxes
(`[3]`–`[5]` the forecastle and the texas tier, `[0]`–`[2]` the after
house and its upper tier); the funnel, the 21 hatches (each cover resting
on its coaming at the sim's opening height) and the four boats stand
where `fitzgerald.ts` puts them. The deck carries its 18 in camber. What
the data has no field for (the pilothouse's size, the masts and radars,
the hatch crane, the steering pole, the anchors, the names) is measured
off her photographs.

**What was gone by 3:30 PM is not there.** The two ballast tank vents the
data opens (`deckOpenings` of kind `vent`, starboard over No. 1 hold's
tanks) are left out: a dark torn patch and a rusted stub stand in each
place, their twins to port intact. The fence rail is down to starboard
over the same tanks (`FENCE_GAP`, from just forward of No. 5 hatch's vent
to just aft of No. 3 hatch: our choice, as no source says which length
went), its posts bent flat or snapped short.

**The break.** Every long surface, the deck, the coamings and the covers
included, is cut by the tear (`breakCut.ts`), so she breaks at any x,
near hatch No. 9 (about x = 18–23 m) as her sim does; the halves are
posed separately like the Titanic's. Torn ledges at the spar deck and the
tank top.

### Her look in November 1975 (sources)

- **Photographs**: Greenmars, "Edmund Fitzgerald, 1971", 1 to 4 of 4
  (Wikimedia Commons, colour slides at the Soo: bow three-quarter, stern,
  passing); U.S. Army Corps of Engineers, "Edmund Fitzgerald in MacArthur
  Lock" and "SS Edmund Fitzgerald underway"; U.S. Coast Guard, "SS Edmund
  Fitzgerald upbound and in ballast" (from above: the hatches, the fence
  rail, the hatch crane parked aft); "EDMUND FITZGERALD Lifeboat Displayed
  on VALLEY CAMP"; the builder's model and the Sault museum model
  (Commons).
- **Hull**: Columbia Transportation's dark brick red to the spar deck
  edge, the same red to the keel (no boot-top shows in any photograph):
  `0x611f1f`, darker below her 27 ft 6 in draught (an assumption). Red
  from her first season (the 1971 slides, and divers describe the
  wreck's stern as deep red); for her launch and fitting out she may
  have worn black and red for the cameras (a fan wiki, below), which is
  not a livery she sailed in. One livery, no paint button: see
  "Liveries".
- **Houses**: off-white (some modellers say "coffee with cream"): the
  forecastle flush with the sides, its plating white over the red, a
  solid bulwark round the bow; the texas house with a rounded front; the
  pilothouse with a wrap-round band of windows under a visor, the radar
  mast on its roof. Aft, the after house flush and white, an upper tier
  set in, the funnel and the after mast on top. House tops grey-green.
- **Deck and hatches**: red oxide (as on nearly all lakers; the museum
  models): 21 one-piece steel covers on 2 ft coamings, 11 ft 7 in by 54 ft
  (USCG; the Wikipedia infobox and Coast Guard summaries give 11 × 48 ft
  for the opening), the covers a shade darker.
- **The hatch crane**: an electric gantry on rails outboard of the
  coamings (Coast Guard _Proceedings_, 1977); drawn cream, parked over
  No. 21 as in the USCG photograph from above.
- **Funnel**: Columbia's stack: dark red, a buff band with a red star and
  a white "C", a black top. A company history in the Maritime History of
  the Great Lakes collection gives "dark red with buff band, red star and
  white C"; _Maritime Reporter_ (June 1981) "a bright red star on their
  stacks"; the 1971 slides show the black top and a band that reads yellow
  (we take buff-gold, `0xd9a53a`).
- **Names**: "EDMUND FITZGERALD" in big black block capitals on the
  forecastle's white plating near the red (about 0.75 m tall, drawn heavy
  and condensed to fit the board: `letters.weight`), and on the after
  house's sides;
  "EDMUND FITZGERALD / MILWAUKEE" in white on the red counter (her port of
  registry, the 1971 stern slide and the MacArthur Lock photograph).
- **Bell**: bronze, on the pilothouse roof (recovered from there on
  4 July 1995: Great Lakes Shipwreck Historical Society; WXYZ, Fox 17).
- **Boats**: two 50-person lifeboats ("500 cu ft, 50 persons" on the No. 2
  boat), white over red, on the poop deck in davits beside the upper tier;
  two 25-person rafts (data). Stowed: she launched none.
- **Anchors**: housed in square pockets in the bow plating, about halfway
  between the water and the deck, a few metres from the stem (the 1971
  bow slide; USACE "underway") (`anchors[].pocket`).
- **Under water**: one propeller 19.5 ft across (Wikipedia, from the USCG
  report; four blades assumed) in an open aperture between the sternpost
  and the rudder post, closed below by the sole piece the rudder's heel
  stands on, one rudder hung on its stock at the after perpendicular, its
  trailing edge under the counter's end (a laker's stern; the 1971 stern
  slide shows the rudder's head under the counter).
- **Masts**: the radar mast on the pilothouse: a pole on four splayed legs
  from the roof, a railed platform with the second radar, the long slotted
  scanner on top (she had two radars, both lost at 4:10 PM; the 1971 bow
  slide); no yard (`MastRecipe.yard`). The tall after mast abaft the
  funnel; the steering pole over the stem.

### Assumptions and departures

- **The bow and the counter are fuller above the water than the offsets.**
  The data's entrance and run narrow to the stem and the sternpost all
  the way up (fine for the sim's volumes); her photographs show a bluff
  forecastle and a broad round stern with nearly upright sides. The drawn
  hull flares to a superellipse from x = 80 m forward (exponent 2, faded
  in from 8.75 to 11.5 m above the keel; over the last 4.5 m it narrows
  to a point at the stem, `tip`, so her sharp stem rises straight from
  the water to the forecastle) and from x = −84 m aft (exponent 2.8, from
  8.6 to 11.7 m, up to the round counter), both above her 8.33 m
  draught. At and below the draught the drawn hull is the offsets' own
  to within 5 cm, and exactly so below 6 m, everywhere but the propeller
  aperture (tested), so the water plane cuts the drawn hull where it cuts
  the sim's. The sim's volumes are unchanged.
- **How the flares are drawn without a crease** (`createHullSurface`
  with a rounding's `blend`; the liners' hulls are built as before).
  Three things made creases, each fixed and tested: the hull took the
  larger of the offsets and a rounding, which creases where the two
  cross (now a soft blend over 3.5 m aft and 2.5 m forward, faded in with
  the rounding); the roundings were sampled at a section's 14 heights,
  too few for a flare 3 m tall, and the monotone curve through them
  kinked (now worked out exactly at every drawn row); and the rows were
  spread from each section's own bottom, so where the bottom climbs to
  the stem, the counter or the aperture's top a row jumped metres from
  one section to the next and the mesh sheared (now rows stand at the
  same heights in every section and fold up onto its bottom). Each
  rounding also starts from the offsets' breadth at its own height and
  fades out near a section's bottom, so the stem and the counter's rim
  stay sharp lines. What is left at the bow is the flare itself: the
  data's waterline is fine (2.5 m half-breadth 5 m from the stem) and her
  forecastle bluff, so the plating between them leans out and faces
  down, and reads darker in the viewer's overhead light
  (`.screenshots/fitzgerald-task-3/bow-flare-closeup.png`: smooth, no
  edge). A fuller entrance in the data would shrink it.
- **The stem is the data's**: since the sim task's correction (`stemX`
  in `fitzgerald.ts`), nearly upright with a 0.5 m rake from the
  waterline to the spar deck and a tight forefoot, as her photographs
  show (USACE "underway", the 1971 bow slide). The 18 ft between LOA and
  LBP is now mostly her round stern's overhang.
- **The pilothouse stands on the data's Pilothouse deck**
  (`FITZGERALD_DECKS`, as corrected by the sim task: a step of 0.7 m on
  its void over the texas deck), one tier to the visor: 3.3 m over the texas deck, its
  glass at an officer's eye from that floor, as the 1971 bow slide shows
  (the pilothouse about as tall as the forecastle tier). Tested.
- **The pilothouse's glass is dark** (painted panes, not lights): a
  pilothouse is kept dark at night. Cabin portholes, the after tier and
  floodlights on the houses' faces and the masts light up.
- **The propeller aperture is cut from the drawing only.** The data's run
  is closed down to the sternpost (the sim's offsets have no aperture),
  so the drawn hull starts at 6.8 m over the keel from 2.7 m forward of
  the after perpendicular aft (`APERTURE`, `createHullSurface`'s
  `aperture`): the blades turn in open water between the sternpost and
  the rudder, a sole piece closing it below. It is the one place the
  drawn hull departs from the sim's below the water (a few cubic metres
  of deadwood the sim keeps; tested, like the flare).
- **The name on the counter** is drawn in six rows up its height
  (`NameBoard.rows`), so its letters follow the counter's flare.
- **The fence rail's wire** is dull steel (`RailRun.color`), so it does not
  glow white along her length at night as the liners' white rails do.
- **The tank vents**: two to each of her 16 ballast tanks (USCG), 32 in
  all, less the two lost: eight tanks a side, three, two and three beside
  the holds (NTSB Figure 2; the data's tank compartments split evenly),
  each tank's pair at the deck edge between the hatches nearest its ends.
  Mushroom vents, 18 in high (data), drawn as small drum vents.
- **Plating**: welded, so the seams' relief is a third of the liners'.

## The Carpathia

`carpathiaRecipe.ts`, as she was on the morning of 17 July 1918, in a
livery (`CARPATHIA_LIVERIES`: `dazzle-1918`, the default, and
`cunard-1912`; the recipe also knows `grey-1918`, plain battle grey). The house ends, wells, masts,
funnel and boats are her data's (`CARPATHIA_*`, `carpathia.funnels`),
so the model moves with the data; the rest is measured off the
photographs below. At `high`: 16 draws (day stage, no post; 15 before
the stern gun got its own list, Task 6), about 81k triangles, built in about 45 ms (the Titanic's 76 ms) on an M-series
laptop.

### Sources (photographs and plans)

- **P1** Wikimedia Commons, "RMS-Carpathia.jpg": starboard side at sea,
  before 1914. Her profile: the forecastle, the wells, the bridge deck
  house with its row of portholes and the open promenade over it, the
  boat deck from the bridge aft, the bridge house and wheelhouse just
  forward of the funnel, the forward deckhouse with boats on its roof,
  four masts, the funnel's height and width.
- **P2** Commons, "Carpathia Malta.jpg" (1912, from aft, starboard
  quarter): the open after deck at the upper deck's height (no poop: the
  black hull stops at it), the white stern deckhouse with a walkway
  outside it, the jigger, a boat on a platform on stanchions forward of
  the jigger, the bridge deck house's after end, boats along the whole
  boat deck under curved (radial) davits, the mizzen on the boat deck's
  after part, the big cowls round the funnel, four masts nearly upright.
- **P3** Commons, "Steamship CARPATHIA - broadside view.png" (Library of
  Congress, Bain, 29 April 1912, port side) and "Steamship CARPATHIA -
  bow view with 2 tugboats at bow" (LoC LCCN2001704339): the same
  profile from the port side and the bow.
- **P4** Commons, "Carpathia port.jpg" (at Pier 54, New York): the bow
  close: the forecastle's black plating with two rows of portholes, the
  stockless anchor hove up in its hawse pipe near the stem, the
  foremast's crow's nest and derricks.
- **P5** Commons, "Color postcard of R. M. S Carpathia, ca. 1912" (DPLA):
  1912 colours: black hull, red bottom, white houses, red funnel with a
  black top, buff masts.
- **P6** Commons, "RMS Carpathia drawing.png" (a modern profile
  drawing, not a builder's plan): the four masts' derricks topped up, the
  stays from each mast to the deck fore and aft, the aerial between the
  main and mizzen mastheads, the funnel's two thin bands. Used only where
  the photographs agree with it (its boat deck has gaps the photographs do
  not show: set aside).
- **P7** The only photograph of her sinking (1918, from U-55's deck:
  `.superpowers/sdd/2026-11-22-shipwreck-carpathia/ref-carpathia-sinking-1918.jpg`):
  one funnel (dark, nearly black against her hull), the two after masts
  upright, a raised stern. Funnel to mizzen, mizzen to jigger and jigger
  to stern read about equal (135, 145 and 120 px in a 5× crop), as the
  data's 28.0, 26.8 and 26.8 m.
- **Text**: Wikipedia, "RMS Carpathia" ("four masts fitted with cranes",
  "a boat deck located right above the bridge deck", "the forward
  deckhouse on the bridge (A) deck", 20 lifeboats in 1912, "sometime prior
  to March 1918, the entire ship was painted in wartime dazzle
  camouflage", "her long-faded red funnel, custom of the Cunard Line, was
  painted in battle grey", the third torpedo "near the gunner's rooms");
  titanicinquiry.org's particulars (one funnel, four masts, twin screws;
  funnel "red; black top; 3 narrow black rings").

### Her shape

- **Hull and tiers.** Straight, nearly plumb stem and a counter stern
  (the data). The forecastle (stem to 42 ft: P1; the drawing P6 has
  about 26 ft) is her plating carried up a tier (`wall: "plating"`, the
  hull material); the forward well (42–145 ft) is the upper deck behind
  waist-high bulwarks; the 290 ft bridge deck house is flush with her
  sides (P1, P3: white in 1912, a row of portholes). **No raised poop
  (R21; P1, P2, P6):** abaft the house the upper deck runs open to the
  stern behind rails, the black hull stopping at it, with the white stern
  deckhouse (510–540 ft from the stem, one tier, its walls 4.6 m either
  side of the centre line, a walkway outside: P2), the jigger at 493 ft
  (P3; P6 497 ft) and a boat platform on stanchions just forward of it
  (about 467–488 ft off P2, drawn 466–489 ft for its 24 ft boat; one a
  side, a tier up). Task 3's poop (its plating a
  tier up from 485 ft, a third porthole row aft) was wrong against all
  three. Over it, from the bridge aft, the bridge deck
  promenade (open between stanchions, closed at both ends, its front
  rounded) under the boat deck (P1). Forward of the bridge the bridge
  deck is open, with No. 3 hatch, the mainmast and the forward deckhouse
  (148–192 ft from the stem, ±5 m: P1; Wikipedia's officers' house) with
  a pair of boats on its roof (P1).
- **Boat deck.** The bridge house (chart room) at its front, 217–262 ft
  from the stem (P1, P3: its front about 17 ft abaft the mainmast, 45 ft
  long), the navigating bridge on its roof with wings out to the sides
  and the wheelhouse on that; a gap of about 16 ft with cowls (P1) before
  the funnel's casing (Task 3 had the bridge at 250 ft, hard against
  it); a long deckhouse abaft the funnel with a skylight (P2); the
  mizzen on the open after part; a small after deckhouse (P2). Positions
  of the houses on the boat deck are ours, ±3 m.
- **The funnel** (R2, P1, P2): one, tall and slender, nearly round. P1
  and P2 put its height over the boat deck at 2.9–3.6 times its width
  (the ratio is the one measure a round funnel keeps in any view), and
  its top about 0.7 of the way from the water to the main truck (P1:
  0.70; P2: 0.73). No source gives a dimension, so the width is 19½ by
  18½ ft (P1 against the masts' spacing, ±2 ft) and the height about
  20 m over the boat deck (ratio 3.4): its top 41 m over the keel. The
  first draft's 36 m read short and stubby; `carpathia.funnels[0].topZ`
  is look only (the sim's funnel-falls rule reads `baseZ`), so it was
  raised in the data. Raked 4° (P1). Two steam pipes and a whistle on its
  front.
- **Masts and derricks.** Four at the data's places: the fore in the
  forward well (crow's nest, P4), the main on the bridge deck forward of
  the bridge, the mizzen through the boat deck's after part (P2), the
  jigger on the after deck at 493 ft; nearly upright (3°, P1–P3). Trucks 52, 54,
  52 and 45 m over the keel: P1 and P2 put the main truck about 1.4
  times the funnel top's height over the water. Two derricks at each
  mast ("four masts fitted with cranes", Wikipedia; P4, P6), fore and
  aft, topped up where nothing is below (the jigger's steeply, clear of
  the boat platform), winches at their heels, a topping lift to each
  head.
- **Rigging** (P1, P6):
  shrouds from each mast to the deck edge abaft it; the forestay from
  the fore to the stem; the main's stay down forward to the bridge deck,
  the mizzen's down aft to the boat deck, the jigger's backstay to the
  after deck at the stern; the wireless aerial between the main and mizzen mastheads (P6)
  with its lead down to the long deckhouse (its place ours). No stays
  from masthead to masthead but the aerial (the first draft's looked
  wrong against P1).
- **Boats.** The data's twenty (`CARPATHIA_BOATS`, Wikipedia 1912), in
  its order: the forward pair on the forward deckhouse's roof (P1: Task 3
  moved their keels there from the bridge deck, in the data), seven pairs
  along the boat deck's edges from the bridge aft, a pair on the boat
  platform forward of the jigger (P1, P2) and the tenth pair on the stern
  deckhouse's roof (no photograph shows where it went: ours). Port boats
  8 and 10 carry `wreckedAtT` (the second torpedo wrecked two, GOL: the
  scene's to hide or break). **True size (Task B4):** 26 ft by 7½ ft by
  3 ft. No source we have gives her own boats' length; 26–28 ft is the
  usual wooden lifeboat on a liner of her date (the Lusitania's were 30,
  27 and 23 ft, above; the Titanic's 30 ft, her cutters 25 ft), so 26 ft
  is ours, at the short end, because seven a side must fit between her
  bridge and the boat deck's after end. They stand 8.6 m apart there
  (P1–P2 show them close together, end to end), the aftmost at the
  deck's after end, the foremost alongside the bridge house clear of the
  bridge's wings (the 1.5.0 build had them about 20 ft long,
  6.5 m apart). The pair on the boat platform is 24 ft (the after boats a
  size smaller, as the Lusitania's), the platform drawn 466–489 ft (P2's
  467–488 ft, ±) so their davits stand on it, still clear of the jigger
  and No. 5 hatch. Two davits each, curved (radial) davits (P2); swung
  out in 1918 (the war zone's practice, an assumption).
- **Under water.** Twin screws (titanicinquiry), three-bladed
  (thegreatoceanliners.com: "two three-bladed"; Task 3's four blades
  contradicted it), 2.3 m radius on short bossings, the hubs 3.6 m forward of
  the after perpendicular; one rudder hung on the sternpost under the
  counter, a round stock up its leading edge. The counter is drawn
  rounder in plan than the data's offsets (a superellipse from x −58 m,
  faded in from 9.5 to 13 m over the keel, above her 8 m draught).
- **Anchors.** Stockless (P4), about 3 m from the hawse pipe's lip to
  the crown (a 7 t anchor's size, an estimate), hove up near the stem
  (`anchors[].stockless`): the lip and its dark mouth, the shank, the
  crown, two flukes with their palms. The first draft's simple anchor
  read as a "T" on the pale dazzle.
- **The stern gun** (1918 looks only; in `variantBoxes`, so her 1912
  colours hide it): a gun on a platform on the stern
  deckhouse's roof, aft. Her gunners are in the accounts (Wikipedia: "the gunners",
  "the gunner's rooms"; merchant ships in convoy then carried a stern
  gun); the gun, its size and place are ours.
- **Fittings.** Big cowls beside the funnel and before it (P1, P2),
  smaller ones in the well, on the forecastle, the after deck and the
  stern house; hatches Nos. 1 and 2 either side of the foremast, No. 3 on
  the bridge deck between the bridge and the mainmast, No. 5 on the after
  deck just forward of the boat platform (the data's No. 5 hatch); bitts,
  the windlass and capstans (the stern's on the after deck abaft the
  stern house); rails on every open deck edge; portholes in two rows
  along her 'tween decks, in the bridge deck house and the forecastle,
  windows in the promenade's inner wall and the deckhouses.

### Her paint

- **1918: dazzle (R2), the pattern ours.** Wikipedia (citing the IWM film
  _The Way of a Ship on the Sea_, March 1918) says the entire ship was in
  dazzle; no photograph of her scheme is known, so `dazzle.ts` is a scheme
  in the style of 1918 British merchant dazzle (Norman Wilkinson's Dazzle
  Section): big hard-edged slanted bands in fans, cut by wedges, in black,
  white, two greys and a blue-grey, her two sides different, as the real
  schemes were. **It is ours, not hers.** One texture (1024 × 256, port
  over starboard, drawn once from the shapes, deterministic) mapped by
  ship x and height over the hull's topsides (in the hull's shader) and
  every house wall (`dazzle` walls drawn into their own list with a
  dazzle material), so the shapes run on unbroken from the hull across
  the houses. Roofs and decks stay unpainted. The masts and derricks are
  battle grey; the funnel a darker battle grey, `0x4a4f55` (Wikipedia:
  "her long-faded red funnel ... was painted in battle grey"; P7 shows it
  nearly black against her hull; `CARPATHIA_FUNNEL_PAINTS.dazzle`), the
  boats
  and fittings a lighter grey. Along the waterline a dark grey boot-top
  (7.5–8.6 m, over her 8.0 m ballast draught) with the dazzle down to it
  and dark red-brown antifouling under it: the usual finish of 1918
  dazzle ships (the dazzle to the waterline over a dark boot-top; the
  bottom colour an assumption). Her name and port painted out (wartime
  practice; an assumption: no photograph shows her in 1918).
- **`grey-1918`**: the same, plain battle grey (`0x7d8289`, the funnel
  too) instead of the dazzle.
- **`cunard-1912` (her other livery, P1–P5; see "Liveries"):** black
  hull to the upper deck (and the forecastle's plating), red antifouling
  under the 34 ft 7 in load line (Wikipedia's draught) with a white
  boot-top (P1), white bridge deck house and deckhouses, buff masts and
  derricks (P5), the Cunard red funnel with a black top and three narrow
  black rings, her name in gilt on the bows and with LIVERPOOL on the
  counter. **The rings, settled (Task 4c):** P1, enlarged, shows the
  black top over about the top fifth of the funnel above the boat deck
  and three narrow rings below it, at about 39, 59 and 79 % of the way
  down (the lowest faint); titanicinquiry says "3 narrow black rings";
  the 1912 colour postcard (P5) shows a deeper black top (about 27 %) and
  two rings above its boats (a third would be behind them); the modern
  drawing P6 draws two. We follow P1 and titanicinquiry: three rings at
  0.21, 0.41 and 0.61 of the funnel's height from its foot, the black top
  4.2 m (Task 3 had 3.6 m and rings at 0.36–0.64, from P6).
- **`grey-1918`**: a recipe option only (the viewer's `&livery=grey-1918`),
  not offered in the game.
- **One shape for every livery, but the gun.** The livery is paint
  only: her davits are swung out in 1912 colours too (the 1918 ship
  repainted). In 1912 photographs (P1, P3) they stand in over the boats,
  stowed; Task B4 left them out because it is not cheap: the davits are
  merged into the paint list, and the morning's boats hang from
  swung-out heads from the start, so stowed davits would need the boats
  stowed until their turn and each pair of davits swinging out as its
  boat goes (the davits are not separate parts), or the boats would hang
  from nothing. A follow-up. Her walls are
  drawn into the dazzle list in every livery (white in 1912, the dazzle
  switched off by a uniform), so a swap rebuilds nothing. The 1918 stern
  gun is the one part only some liveries carry: it is drawn from its own
  small list (`variantBoxes`), empty in `cunard-1912`, so a swap only
  hides that mesh (the 1912 ship had no gun). (Task 3's 1912 look had
  the davits in over the boats and no gun.)

### Assumptions and departures

- The forward pair of boats moved from the bridge deck to the forward
  deckhouse's roof (a look-only change to `CARPATHIA_BOATS`; the sim reads
  only their indices) and the funnel top from 36 to 41 m (look only, see
  above): both in her data so the walk map and the scene agree.
- The well bulwarks are painted strips (`strip`), not the hull's plating
  (the inside faces would read black in the plating material).
- No portholes are left out for R10 (her scuttles shut in convoy): that
  rule is the sim's; the model's panes light only with `setPower`.

## Liveries (paint switched live)

R23–R28 of the Carpathia spec. A ship may be shown in more than one
paint (a livery), switched by the paint button while she sinks, with no
rebuild and no hitch.

### The API (for a new ship, e.g. the Britannic's "liner")

1. **Data.** List them on the spec: `liveries: readonly Livery[]`
   (`lib/shipwreck/ships/types.ts`): `{ id, label, year, default?: true,
sources, swatches, funnelPaint? }`, exactly one `default`, the
   default first. `label` is what the button says (aria) and the help
   card's title; `swatches` are the button's two colour dots (sRGB);
   `funnelPaint` paints the hull diagram's and the title picture's
   funnels. Missing, or one entry: no choice, no button.
   `defaultLivery`, `resolveLivery` (an unknown id gives the default),
   `nextLivery` and `funnelPaintOf` are the helpers.
2. **Recipe.** Give her recipe a second argument, the livery id
   (defaulting to her default), and map it to paint:
   `myRecipe(spec, livery = "war-1916")`. Add her to `recipeFor` in
   `shipModel.ts` (it passes the id and caches a recipe per livery). The
   default livery's recipe must stay exactly the old one (the recipe
   fixtures).
3. **Paint only.** A livery may change any colour (`ShipPaint`, a
   block's or house's `wallColor`, `roofColor`, a box's or hatch's or
   rail's `color`), the hull's paint (`paint.hull`, `sheerLine`,
   `layout.loadWaterline` and `bootTop`, which are uniforms),
   `paint.dazzle` (switched by a uniform; put every wall that is ever
   dazzled into the dazzle list in every livery with `dazzle: true`),
   the funnels (`blackTop`, `bands`, colours), the name boards
   (`names`: present or not) and the `variantBoxes` (painted boxes only
   some liveries carry, in their own small list: the Carpathia's 1918
   stern gun, empty in 1912). It must not move the boats, the davits'
   boats, the instanced fittings (vents, drums, benches, bitts, posts,
   portholes, windows: their counts are checked), the rails and rigging
   (`lines`) or the funnel guys, and the name's text, letters and port
   must match (one name texture); `createTitanicModel` throws if one
   does ("a livery is paint only").
4. **Nothing else to wire.** The store (`playback.livery`,
   `setLivery`), the save (`liveryByShip`, never a reset: an older save
   or an unknown id shows the default), the HUD's and the title's paint
   button (`ui/LiveryButton.tsx`), the help words (`liveryHelp` in
   `lib/shipwreck/help.ts`: add a line to `LIVERY_WORDS` for each new id,
   else a plain "as she was in <year>" line shows), the hull diagram and
   the scene (`ShipRig` repaints both models on a change, and warms each
   model's livery parts at build) all read `spec.liveries`.

### Fun paints (1.7)

Every ship also lists paints just for fun after her real ones (the paint
tray's two rows: `realLiveries`, `funLiveries`). A fun livery carries
`fun: { from?, paint: FunPaint }` (`lib/shipwreck/ships/funPaints.ts`:
the liners' set from the big lines of 1900–1920, the laker's from Great
Lakes fleets; a ship skips the ones that are really hers). `recipeFor`
paints it over her recipe in livery `from` (default her default) with
`withFunPaint` (`funPaint.ts`): the hull's topsides, bottom, boot-top and
sheer line, the funnels, masts and boats, and walls painted her topsides'
colour; the dazzle off. The shape is that livery's, so the swap is the
same colours-only swap, but a fun livery is prepared the first time she
wears it (one part build, tens of ms), never at load: a long fun list
costs no load time or memory until used. The Britannic's fun paints are
over her liner look (`britannicLivery.ts` makes each one's hull paint and
funnel colours on first wear; her masts and boats keep the liner's).
Every `Livery` has a `look` (hull, funnel, top; a band or dazzle) the
tray draws as a little ship.

### How the swap works (`shipModel.ts`)

`createTitanicModel` builds her default livery exactly as before (the
same meshes, draw calls and triangles), then builds each other livery's
recipe and triangle lists to take what differs: for each list of the
same shape, its vertex colours (kept as a `Float32Array` per livery); for
a list whose shape differs (a funnel with other bands, the name boards),
a hidden mesh of its own, shown only in that livery; and the hull's
paint (`HullPaint`) per livery. `setLivery(id)` copies the colour arrays
into the attributes (`needsUpdate`), flips those meshes' visibility and
sets the hull's uniforms (`materials.setHullPaint`; the dazzle by
`uDazzleOn`). No geometry is made or freed and no object is added
(tested); the first swap uploads the swapped colours and the hidden
parts' small buffers (`warmLiveries` compiles their shaders and uploads
their textures at build).

| Ship      | Liveries                     | Extra build (high) | Hidden parts              | Swap, CPU  | First swap, frame (M4 Pro) |
| --------- | ---------------------------- | ------------------ | ------------------------- | ---------- | -------------------------- |
| Lusitania | `war-1915`, `cunard-1907`    | about +25 ms       | 4 funnels (1907 bands)    | ≈ 0.1 ms   | none measurable (8.2 ms)   |
| Carpathia | `dazzle-1918`, `cunard-1912` | about +15–20 ms    | 1 funnel, the name boards | ≈ 0.1 ms   | 14.9 ms once, then 8 ms    |
| Britannic | `hospital`, `liner`          | her own swap       | the hospital marks        | ≈ 0.004 ms | not measured               |

Measured in the dev server: `handles.stats.buildMs` 85–89 ms for the
Lusitania (61 before) and 61–65 ms for the Carpathia (45 before), each
first build in a fresh page; the swap's main-thread time
(`stats.liveryMs`) about 0.1 ms; frame gaps on a 120 Hz M4 Pro in Chrome
(Metal) with the game running: about 8.3 ms with or without a swap, the
Carpathia's first swap 14.9 ms (her names and 1912 funnel uploaded).
The default draw calls and triangles are unchanged (day stage, high:
Titanic 24 / 146,576, Lusitania 25 / 146,940, Fitzgerald 17 / 74,270,
Carpathia 15 / 80,932); the Carpathia in 1912 draws one more (her names,
16 / 81,508). Since Task 6 her 1918 stern gun is its own small list
(`ShipRecipe.variantBoxes`, the mesh "livery-parts"), so the Carpathia
draws 16 in both paints (the gun's in 1918, her names in 1912; same
triangles in 1918). The iPad mini 6 is not measured here (expect two to three
times the build; the swap is a buffer copy).

### Each ship's liveries (R28, the research)

**The Titanic: one livery.** She sailed only in April 1912, in White
Star's colours (black hull, white superstructure, buff funnels with black
tops), the look 1.0 built. The one other paint in her story is her
sister's: the Olympic was launched in 1910 in a light (grey or white)
paint for the photographers (Irish Times, "The launch of a leviathan";
Wikimedia Commons' Olympic launch captions disagree on the shade); the
Titanic was launched in her black (Wikimedia Commons, "RMS Titanic ready
for launch, 1911"; Naval Marine Archive, "Titanic in white", which itself
warns its white photograph may show the Olympic). No toggle.

**The Edmund Fitzgerald: one livery.** No source found shows a different
paint in service: she sailed for Columbia Transportation (Oglebay
Norton) in their red hull and red stack with the buff band and star from
her first season to 1975 (the 1971 slides; the company history above).
For her launch on 7 June 1958 and fitting out, a fan wiki (boatnerd,
"Edmund Fitzgerald") says she was "painted black and red to be seen on
camera easier" and then "painted red" with "a yellow-red funnel"; the
Detroit Historical Society holds the launch film (silent, colour) but
its catalogue does not describe the paint. A launch paint for the
cameras is not a livery she sailed in, and no photograph we could see
shows it, so: no toggle. (The 1.3 README's "launched with a black hull"
rested on one forum thread; this replaces it.)

**The Lusitania: `war-1915` (default) and `cunard-1907`.** Her default
is 1.1's look, unchanged (fixture). Her first colours, as she entered
service in September 1907, each detail from a source:

- **Photographs used**: Library of Congress LCCN2013646024 ("Lusitania",
  American Photograph Co., 1907; the panorama, both ends' funnels sharp);
  Wikimedia Commons "RMS Lusitania coming into port, possibly in New
  York, 1907-13" and "RMS Lusitania docks in New York, September 13,
  1907"; "14 10 1907 lusitania postcard" (a postcard of her trials paint).
- **Funnels: Cunard red.** "Vermilion red with black bands and a black
  top" (rmslusitania.info, "The Cunard Company"); "Red; black top; three
  narrow black bands" (titanicinquiry.org, Lusitania particulars). The
  shade: J. Kent Layton ("Building the Lusitania – A Modeler's Guide",
  TRMA) takes R234 G114 B48 from hand-tinted 1907 postcards and says the
  old Cunard red was "not really red, as it is today", "something like a
  basketball". In the model's daylight that value washed to peach, so we
  keep its hue a shade deeper: `0xcc5a28` (also the Carpathia's 1912).
- **The black top and bands, measured.** In the LoC panorama the
  funnels show, over the boat deck house, a black top of about 26 % of
  the visible funnel, then three narrow black bands at about 45, 64 and
  83 % of the way down, evenly spaced (the forward and the after funnel
  agree). Drawn: the black top 5.6 m (of 21.7 m over the house) and the
  bands at 0.23, 0.41 and 0.58 of the funnel's height from its foot.
  (1.1's 1915 funnels keep their 4.4 m top and 0.36–0.68 bands, painted
  over.) The funnel guys stay where 1.1 has them (rigging, not paint).
- **Hull and boot-top.** Black topsides; in service the black ran up to
  the B deck bulwark (her C deck plating was painted black at her
  pre-maiden-voyage drydocking; the white C deck strip to the prow was
  her trials paint only: Layton; linerdesigns.com, "Lusitania 1907 sea
  trials"); red antifouling below a thin white waterline band (Layton's
  "waterline white band"; the 1907–13 photograph shows the white line).
  The model's hull paint already runs this way (1.1).
- **No gilt band.** The bronze/gold band round the base of the
  superstructure was an addition of 1914–15 ("a gold-colored band was
  added", rmslusitania.info, "Lusitania at war"; "One alteration was the
  addition of a bronze/gold coloured band", Wikipedia "RMS Lusitania";
  Layton: painted when she was "repainted in more traditional colors"
  in the autumn of 1914). So `sheerLine` is off in 1907.
- **White superstructure** (Layton; every photograph) and white rails
  ("All of the rails along the ship were painted white from 1907-1914",
  Layton).
- **Her name**: LUSITANIA in gilt letters on the bows near the stem
  (the 1907–13 photograph shows the light letters on the black plating,
  as 1.1 places them) and with LIVERPOOL on the counter; the same boards
  in both liveries.
- Masts buff, as 1.1 (no source for the shade).

**The Carpathia: `dazzle-1918` (default) and `cunard-1912`.** See "Her
paint" above (the 1912 rings settled there).

**The Britannic: `hospital` (default) and `liner`** (1.5, from the
1.4 branch's swap): `BRITANNIC_LIVERIES` in her data (labels, sources,
swatches and funnel paints from "Her intended liner paint (R23)" below).
Her ids are her looks' own names (the model's `BritannicPaint`), not
`<name>-<year>`. Her model does not use the generic builder above (her
liner's funnels are cut differently and her hull carries the hospital
band): `createTitanicModel` attaches her own swap (`britannicLivery.ts`)
and exposes it through the same handles, so `setLivery`, `livery`,
`liveries` and `warmLiveries` (which uploads the gilt name board) work as
for every ship, and the store, the save, the paint button, the help words
and `ShipRig`'s repaint after a rebuild need nothing of their own.

## The Britannic

`britannicRecipe.ts`, as she was on the morning of 21 November 1916:
her sister's recipe (`titanicRecipe(spec)`, so the same frames, decks,
houses, funnels, masts, cranes, propellers and rudder, here on her 94 ft
hull from `britannic.ts`) with what her photographs show was hers.

| Tier   | Draws (hospital / liner) | Triangles (hospital / liner) |
| ------ | ------------------------ | ---------------------------- |
| high   | 32 / 31                  | 161,690 / 161,270            |
| medium | 21 / 20                  | 110,206 / 109,786            |
| low    | 19 / 18                  | 89,472 / 89,052              |

Night (bloom) 48 draws. The one draw and 420 triangles between the looks
are the hospital ship's painted boxes (their own mesh, hidden as a liner:
"Her intended liner paint" below). The whole ship is built in two groups
(the bow forward of the hinge in its own, `bend`), which is most of the
draws over the Titanic's 24. She never breaks (no split model). Build
times (`handles.stats.buildMs`, high, the median of six rebuilds, same
laptop and script, two runs each): 27 and 26 ms (Titanic 25 and 21 ms),
about 15 % more: the cut at the hinge and her boats and gantries. First
build 75–103 ms (Titanic 64–92; textures, noisy).

### Sources

Photographs on Wikimedia Commons, "Category:Britannic (ship, 1915)":
"HMHS Britannic" (starboard broadside under way, the clearest: [P1]),
"Britannic in Naples for Coaling" (starboard bow, bridge front, early
1916: [P2]), "HMHS Britannic at Moudros, October 1916" (bow on: [P3]),
"Britannic during WWI" (dead astern: [P4]), "Lifeboats of HMHS Britannic"
(a gantry arm and its boats close up: [P5]), "HMHS Britannic arriving in
Moudros", "HMHS Britannic Sailing", "Hmhs britannic departing from
naples" (port side: [P6]), "HMHS Britannic Colourized" (a modern
colourisation, for colour only where the others agree), "RMS Britannic
1914 Model" (the builder's model with all eight gantry sets: [M]);
Wikipedia "HMHS Britannic" [WP]; the spec's [WSH], [PBS], [TIP], [CH],
[AL]; the 1907 Hague Convention X, art. 5 [HC] ("painted white outside
with a horizontal band of green about a metre and a half in breadth").
Measurements off [P1] and [P2] take the boat deck (28.19 m) and her
waterline (about 10.3 m) as the vertical scale and the funnels'
positions (`britannic.ts`) as the horizontal: about ±1 m.

### What is hers

- **Hull white**, a little grubby (`topsides 0xd9d5c9` under the shared
  weathering) [WSH, PBS; CH: grubby with coal dust]; red boot-topping and
  bottom, the paint line 10.9 m, about 0.6 m above her waterline that
  morning ([P1] shows a dark band at the waterline); no gilt line.
- **The green band** from stem to stern and round the counter [P1, P4,
  WSH], 1.7 m deep, its middle 3.5 m under the sheer (between the D and
  E deck rows of portholes: [P1], [P2]). Measured off [P1], the
  photograph the crosses are measured from (the crosses about 6 m), it is
  about as deep as a cross's arm (1.9 m): R22. [HC] says about 1.5 m.
  Painted by the hull's shader (`HullBand`), the rule in code
  `bandPaintAt`.
- **Three red crosses a side** breaking the band [WSH, PBS, P1, P6],
  each a Greek cross 6.0 m tip to tip, arms 1.9 m, on a white gap 8.4 m
  long (the band stops either side), centred on the band: forward under
  the foremast (x 84 m), amidships just forward of the third funnel (x
  −12 m) and aft by the poop (x −114 m), the same each side ([P1]
  starboard, [P6] port). [P1] measures the cross 5.9 m tall. Hull
  portholes that would fall on a cross are left out (the crosses read
  unbroken in [P1]).
- **Two red crosses a side on the boat deck** [WSH], on white boards
  3.2 m square at the deck edge: x 35 m (between the forward gantry and
  the Welin boats, [P1]) and x −24 m (between the Welin boats and the aft
  gantries: our assumption, as no photograph shows the second clearly).
  Lit at night [WSH]: not drawn (her scene is the morning).
- **Funnels plain buff**, the guy bands thin and dark, a sooty lip
  (`blackTop` 0.45 m). **Photographs win over R6 here**: [P1] and [P2]
  show the funnels one tone from foot to rim, with the guy bands but no
  black top, where the Olympic's and the Titanic's black tops show
  plainly in every photograph of the time. The "yellow" the spec set
  aside [Steamship Mutual, ShipsOfScale] agrees with the photographs on
  this. White Star buff `0xbb7f3a` (the Titanic's); the fourth a dummy
  (no whistle, one pipe, no smoke: `afternoonEffects`).
- **Masts buff** (spec), crow's nest white [P1, P2].
- **Gantry davits (R5)**: five sets [WP], one to starboard forward
  abreast the first funnel (x 54 m, not the 62 m first in the data:
  [P1] puts the forward set's arms at about x 48 and 60 m, [P2] the same;
  WP: "several of these davits were placed abreast of funnels"; the data
  was corrected in its own commit) and four aft by the fourth funnel at x
  −38 and −61 m, a pair each side ([P1] measures about −35 and −61). No
  set to port forward (Welin davits there, R5) and none on the poop
  (designed, never fitted: [M] shows them, [P1] does not). Each set two
  arms 11.2 m apart, tapering square plate girders on white pedestals at
  the deck edge, leaning 4.4 m inboard to 9.6 m over the deck, their tops
  bent over into a beam fore and aft between them ([M]; in [P1] and [P2]
  the arms' heads curl toward each other). Painted a deep buff
  (`0x8a6d4a`): in the photographs a shade darker than the funnels; no
  source gives the colour. Six boats a set in the bay between the arms,
  two rows across, three tiers high ([M], [P5]).
- **Welin davits** for the rest [WP, AL]: three double-banked pairs at
  the port forward position (x 42, 53, 63.5 m) and three a side amidships
  between the second and third funnels (x −11, 0.5, 12 m; [P1] shows a
  single row of boats there at about 11.5 m spacing). Davits turned in
  over the outboard boat; the inboard boat under the same pair.
- **48 boats** [WP], 30 ft wooden lifeboats as her sisters' (assumed: no
  source gives hers), white.
- **A deck enclosed end to end**: the after half a promenade behind big
  windows, the forward half cabins with small windows flush with the
  side, and at its forward end (from x 65.5 m to the house front) big
  open screens [P1, P2]; the same open screens at the forward end of B
  deck [P1, P2]. The Titanic's open after promenade and its rail are
  gone.
- **"G.618"** (R13) in white on a black board on the navigating bridge's
  front, under the wheelhouse windows, where [P2] shows "G.608" early in
  1916 [CH, AL: G.618 by October 1916]. Block strokes (boxes), no
  texture.
- **Names** in black, not gilt: "BRITANNIC" on the bows under the
  forecastle rail [P2], "BRITANNIC / LIVERPOOL" on the counter over the
  band [P4].
- **Anchors** hang dark from the hawse pipes, the pipe's mouth over the
  band and the crown under it ([P1], [P3]); no dark recess round them
  (on her white bows the Titanic's recess read as a black "T"). The
  side bowers about 4.4 m from pipe to crown: 7¾ tons each (Encyclopedia
  Titanica, "Bower anchor chain link size"), scaled by the cube root of
  the weight from the 15.6-ton centre anchor's 18 ft 6 in (Black Country
  Living Museum).
- **Open portholes**: the sim's open rows (`britannic.portholes`, R8) at
  their exact heights, her sister's spacing, about half swung open (dark
  holes, no glass: the data's area assumes about half open); the rest of
  her scuttles shut. Where a row runs, her sister's row there is left
  out.

### The bent bow (R12)

`recipe.hinge` (x 87 m, under the forward well deck between its hatch
and the forecastle front, at the C deck) cuts the whole ship's geometry
in two by where each triangle's middle is (`splitAtHinge`): the bow
forward of it is the `bend` group inside `whole`. When her bow strikes
the floor while her stern is still up (`hardLandingAt`: the first
`bow-lands` before `sankAtT`, 9:03:55 on the real morning), `bowBend`
eases over 40 s to 0.2 rad, about two thirds of it lifting the stem
about the C deck at the hinge and a third turning it to port, so the
bottom at the hinge opens (the "large hole under the forward well deck"
[WP]) and the bow stays joined at the C deck ("attached to the rest of
the hull only by some pieces of C-Deck" [WP]; "severely bent up"
[GOL]). Tested on her real track from the landing to the end: the bent
bow never goes lower than the floor (or the straight hull, where the
sim's contact lets it touch). The sim is unchanged.

### Assumptions and departures

- The aft hull cross sits on the counter's turn in the drawn hull (the
  drawn counter rounds from x −62 m, as the Titanic's): from the
  quarter it wraps a little.
- The four portholes across the counter in [P4] are not drawn (the
  Titanic's counter has none either).
- The boat-deck crosses' second position (x −24 m), the boats' size and
  the gantry colour are ours.

### Her intended liner paint (R23)

**She never sailed as a liner.** Requisitioned on 13 November 1915 and
completed as a hospital ship (fit for service 12 December 1915), she
sank on 21 November 1916 before she could enter transatlantic service
[WP]. Her second look is the White Star finish Harland & Wolff would have
given her, taken from her sisters as they were in 1911–1914 and from her
own builder's model.

Sources: [M] (above: "RMS Britannic 1914 Model", the builder's model
under a "WHITE STAR LINE / R.M.S. BRITANNIC" board: black hull, white
superstructure, black-topped funnels); [O1] "RMS Olympic Sea Trials in
1911" (Wikimedia Commons, starboard broadside: black hull to the shelter
deck, white above, funnels with deep black tops); [O2] "Olympicincolour1b"
(Commons, a modern colourisation of the Olympic at a pier, for colour
only: gold line at the top of the black, red boot-topping straight under
the black, buff funnels and masts, "OLYMPIC" in yellow on the bows);
[TIP] Titanic Inquiry Project ship records, Olympic and Titanic: funnels
"Buff; black top"; [WP-MV] Wikipedia "MV Britannic (1929)": White Star
colours "black hull with a gold line, white superstructure and
ventilators, red boot-topping and buff funnels with a black top"; [TRMA]
"White Star Buff: Weighing the Evidence" (trmaarchive.com): the buff a
darker, browner shade, "not yellow"; [WP]: a contemporary postcard after
a painting by Charles Dixon shows her "in her intended White Star
livery". (The "RMS Britannic" image on Commons is a retouched photograph
of the hospital ship, an artist's impression, not a source.)

- **Hull black** (the model's liner black, `0x121315`, as the Titanic's)
  to the shelter deck edge, white above [M, O1, O2, WP-MV].
- **Gold line** at the top of the black, under the sheer (`0xc9a03a`,
  the Titanic's gilt line) [O2, WP-MV]. Sources disagree on when White
  Star painted it: forum readings of the Olympic's 1911 photographs see a
  line between the black and white; [TRMA] ties a change of the sheer
  stripe to the Olympic's 1921 refit (the line moved down). We follow the
  colourisation and the company's later description, and the Titanic
  model, which draws it.
- **Red antifouling** to her 34 ft 7 in load line (10.54 m, the paint
  line her sisters were finished to) with no white boot-top line: [O2]
  shows the red straight under the black, and [O1] shows no light line
  there. The Titanic model draws a thin white boot-top; we do not copy
  it. The hospital ship's paint line stays at 10.9 m (her photographs).
- **Funnels buff, black tops** 5.4 m deep, the Titanic model's ([O1]
  measures about 5.1 m on the first funnel, 24.5 ft wide for scale),
  over the same guy bands [M, O1, TIP]; buff `0xbb7f3a` as in both looks
  (`BRITANNIC_FUNNEL_PAINTS`). The fourth is still the dummy.
- **Masts buff** [O2], as the hospital ship's.
- **Names gilt**: "BRITANNIC" on the bows and "BRITANNIC / LIVERPOOL" on
  the counter in her sisters' gilt serif (the default board) [O2].
- **No green band, no crosses, no "G.618"**.
- **Everything else is the ship she was**: her gantry davits (fitted as
  she was built: [M] shows them on the liner), A deck enclosed, the
  forward screens, her boats, her open portholes. A
  porthole or two is missing where the hospital ship's crosses were (the
  hull's rows are hers in both looks; on the black hull they barely
  show).

**The swap** (`britannicLivery.ts`): the model is built once from
`britannicModelRecipe` (the hospital recipe with each funnel cut at both
looks' black tops, and the painted boxes taken out), and
`handles.setLivery(look)` changes, in place, the hull shader's uniforms
(`mats.setHullPaint` in `materials.ts`: colours, paint line, gold line, the
band and crosses turned off by a negative half height and no crosses),
the funnels' vertex colours (copied from arrays made at build), the
painted boxes' mesh (shown only as a hospital ship) and the name boards'
texture (gilt, metallic, as the Titanic's). No geometry is made or
replaced, the shaders are not recompiled (the hull is always built with
the band's program), and `handles.recipe` becomes the look's
(`recipeFor(spec, look)`). A swap takes about 0.004 ms (median of 200 in
node, 0.03 ms worst); the gilt board uploads to the GPU on the first
frame after the first swap (`warmLiveries` uploads it at build).
`createTitanicModel(spec, { livery })` builds in either look;
`?model&ship=britannic&livery=liner` (or 1.4's `&paint=liner`) shows it,
and `setModelView({ livery })` swaps it live.

- **Her foremast is its own part** (`handles.foremast`), so it can lie on
  the floor by her wreck [WP] (`scene/mastWreck.ts`): `buildShipPart`'s
  `apartMasts` leaves it out of the paint mesh and `mastGeometry` builds
  it (the same code, colours and `mats.paint`, its pole in 1.5 m lengths
  so it bends); its wires go to the end of the part's line mesh, hidden
  by a draw range. One draw more. A paint that recolours her masts must
  also reach this mesh (`foremast.group`, mesh `"mast"`): both looks'
  masts are buff today, so the swap leaves it alone.

## The cruise kit

`cruiseKit.ts` holds a modern cruise ship's builders, lifted out of
`concordiaRecipe.ts` (Poseidon plan, Task 5). Each is pure and takes the
numbers the Concordia's recipe hard-coded before:

| Builder                              | Returns                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `cruiseFrame(spec)`                  | Her hull, `deckIndex`, `deckZ`, `Z` (amidships) and the deck edge.                                                     |
| `flushTier`, `lowerTiers`            | The base tier, the bow's plating and foredeck, the boat recess between flush ends, the tier over the boats.            |
| `balconyTiers`, `balconyFronts`      | Each balcony deck's after and forward ends (the bridge on its deck), floors, the back wall; glass runs and partitions. |
| `bridgeWings`                        | The wings out to her full beam.                                                                                        |
| `ovalFunnels`                        | Upright oval funnels with a dark top and a letter in her real paint only.                                              |
| `radarMast`, `radarMastBoxes`        | The radar mast, its legs, platforms and scanners.                                                                      |
| `recessBoats`, `boatDavits`          | Her data's boats at her side on the recess deck, two davits each.                                                      |
| `liferaftRacks`                      | Canisters in racks, two high, both sides.                                                                              |
| `createPanes`                        | Her lit panes: `sideLight` (in the hull or a tier's side), `row`, `frontLights` (a rounded front), `aftFace`.          |
| `emergencyMask`                      | The sparse share of panes lit on emergency power (R7).                                                                 |
| `railKit`                            | Rail runs along her edges and across.                                                                                  |
| `waterSlide`                         | A slide coiling down from its tower.                                                                                   |
| `twinScrews`                         | Two propellers on open shafts, A-brackets and struts, twin rudders.                                                    |
| `bowAnchors`, `nameBoards`, `staffs` | Stockless anchors, the name on the bows (and sides) and stern, the jack and ensign staffs.                             |

Every builder keeps the Concordia's arithmetic exactly (the same sums in
the same order, the same loop order, so the panes' seeds and the emergency
mask fall on the same panes): her recipe rebuilt on the kit deep-equals
its 1.10 snapshot (`concordiaRecipeSnapshot.test.ts`, numbers to 1e-9),
and her bow 3/4 in the model viewer is pixel-identical to before the
lift. `cruiseKit.test.ts` runs each builder on a small made-up ship.

## The Costa Concordia

`concordiaRecipe.ts`, as she was on the night of 13 January 2012: a
modern cruise ship, so most of her parts are her own (`slides`,
`radomes`, `canisters`, `thrusters`, `rock`, the rudder's `ys`, a
funnel `emblem`'s `letterOnly` and `realOnly`, a lifeboat paint's
`cover`, a light's `emergency`: all optional recipe fields, so every
other recipe builds exactly as before; the fixtures pass). Her hull,
decks, funnel and boats come from her data (`concordia.ts`); the rest is
measured off the photographs below.

| Tier   | Draws (day / night) | Triangles | Build (first, dev server) |
| ------ | ------------------- | --------- | ------------------------- |
| high   | 12 / 29             | 156,904   | 64–73 ms (Titanic 63 ms)  |
| medium | 10                  | 93,356    | 21–23 ms (Titanic 15–16)  |
| low    | 10                  | 65,822    |                           |

Her budget at high is 100 draws and 330k triangles. Her part build in
node (median of 12, high): 16.9 ms against the Titanic's 15.1 ms (+12 %);
medium 11.4 against 8.9 ms (+28 %). Balcony glass and partitions are
painted boxes in the one paint list, her 1,609 windows and doors one
instanced pane mesh, her boats one instanced mesh, the slide one tube in
the paint list. Medium and low drop her rails (as every ship's).

### Sources

Photographs on Wikimedia Commons, "Category:Costa Concordia (ship,
2006)":

- **[M]** "Cruise ship Costa Concordia scale model (on board of the same
  cruise ship)": the builder's model, a near-true broadside of her
  starboard side. Every length and height below is measured off it
  (290.2 m stem head to stern over 912 px: about ±1.5 m), and checked
  against [P1]–[P3].
- **[P1]** "Costa Concordia in Palma, Majorca, Spain" (starboard bow
  quarter, 2007): the hull's window rows, the boat recess and its 13
  boats, the name over the boats, the balcony rows, the stepped front.
- **[P2]** "Costa Concordia in 2009" (starboard bow, Barcelona): the
  blue line at her waterline, the bow name, the bridge and its wings out
  to her full beam, the spa's dark glass front over it, the radar mast,
  the radomes, the black top of the funnel.
- **[P3]** "Costa Concordia - Vollansicht" (port side from aft, Savona):
  the funnel's black exhaust top over the yellow (about 30 % of what
  shows), the "C", the yellow water slide forward, the stepped stern
  terraces, the name on the stern.
- **[P4]** "CostaConcordiaLasPalmas" (starboard broadside, Palma): the
  dark glass roof sloping down fore and aft of the funnel, the dark glass
  sides of the midships pool, the slide forward of midships.
- **[P5]** "Costa Concordia at Valletta" and "Costa Concordia 2011-10-07"
  (bow on, Malta): the stepped front, deck by deck, the bridge's band of
  windows on the sixth tier over her hull, the spa's curved front.
- **[P6]** "Costa Concordia - Rettungsboot" (a lifeboat close): white
  lower hull, orange upper hull and canopy, hung in its davits under the
  deck over it.
- **[P7]** "Costa Concordia - Der Bug" (the bow close): the liferaft
  canisters in their rack at the forward end of the boat recess, the
  window pairs, the blue-tinted balcony glass.
- **[P8]** "Cruise ship Costa Concordia lido deck (detail)": the teak pool
  deck, the funnel's black cage top, the open lido under its roof.
- **[P9]** "Costa Concordia - fährt rückwärts aus dem Hafen" (bow on,
  Savona): the stepped front's tiers and the bridge wings.
- **[W]** the wreck from the sea, "Costa Concordia Wreck 11sept2012":
  the funnel, the radomes and the stepped tiers on her side.
- Text: Wikipedia "Costa Concordia" [WPC]: 13 public decks (deck 0 the
  engine room), about 1,500 cabins of which 505 with balconies, the
  two-level Samsara Spa, four pools of which two under retractable
  roofs, two fixed-pitch propellers on two 21 MW motors.

### What is hers

- **Hull** (her data's lines): white over a dark blue line at her
  waterline over the red antifouling ([P2], [M]; the "blue stripe"
  [MIT §4.7.2]): red to 7.6 m, blue to 9.0 m (the 8.12 m waterline in
  its middle), white above; a welded hull, so the plating's relief is a
  quarter of the liners'.
- **Name**: "COSTA CONCORDIA" in blue serif capitals on both bows (low on
  the flare, [P2]), along both sides over the boat recess forward of
  midships ([P1], [M]), and on the stern over "GENOVA" ([P3]).
- **Windows**: decks 1–3 small square cabin windows about 3 m apart in
  the hull ([P1], [P2]); big restaurant windows in her stern on decks
  3–5 and across its after face (the two dark bands aft in [M]); deck 6
  over the boats windows in threes ([P1], [P7]).
- **Balconies** (`CONCORDIA_BALCONY_DECKS`): decks 7–10 from x −100 to
  +96 ([M]: the four blue rows from aft of the funnel to the forward
  cabins), each cabin 3.6 m wide with white partitions, its door set
  1.8 m in and a blue-tinted glass front at her side ([P7]). Forward and
  aft of them, cabin windows.
- **Stepped terraces aft**: decks 7–11 each end a few metres further
  forward than the one below ([P3], [M]), teak on top.
- **Stepped front, bridge and wings**: decks 6–11 end at 138, 136, 132,
  128, 124 and 120 m (the superstructure reaches to 11 m aft of the stem
  head at deck 6, [M]), each rounded; the bridge on deck 8 (the sixth
  tier over her hull top at deck 3, [P5]) with a band of big windows and
  its wings out to her full beam ([P2], [P9]).
- **Spa** (the Samsara Spa, two levels [WPC]): decks 12–13 over the
  bridge, x 58–116, its rounded front in big dark windows ([P2], [P5]);
  the sports deck on its roof (a blue court) with the radar mast.
- **Pools and glass roofs**: the midships pool's dark glass sides and its
  glass dome (a retractable roof [WPC]) at x −2 to 34 ([M], [P4]); the
  aft pool's dark glass roof sloping down fore and aft of the funnel
  ([P4]: drawn as a low glass house under a glass vault fore and aft of
  the funnel); an open pool aft and one forward ([P8]).
- **Water slide**: yellow, coiling down from a white tower on the pool
  deck at x 42, to starboard of the middle ([M], [P3], [P4]).
- **Funnel**: one, an upright oval 15 m long and about 9 m wide, its
  middle 87 m from her stern (x −52) and its top 66.5 m over the keel
  ([M]: 18.7 m showing over the top deck, black top 32 % of it), Costa
  yellow with a black exhaust top ([P2], [P3], [P8]) and the big blue "C"
  on both sides, half as tall as the yellow, in her real paint only.
- **Lifeboats**: 26, 13 a side ([MIT §4.5]; [P1] counts 13 starboard),
  x −84 to +84 about 14 m apart ([M]), 10.8 by 3.9 m (150-person
  boats: an assumption from their size against the deck in [P6]), in the
  recess on deck 4 (set in 4.8 m) under deck 6, each in a pair of
  davits, their recess wall in shade; white lower hull, orange above
  under a rounded orange canopy (`paint.boat.cover`) ([P6]). Liferaft canisters in
  racks at both ends of the rows ([P7]).
- **Masts and domes**: one white radar mast over the spa (x 80) with its
  platforms and scanners ([P2], [M]); five white radomes on the top deck
  ([M], [P2], [P4]).
- **Under water**: two five-bladed screws about 5.4 m across ([WPC]: two
  fixed-pitch propellers; the size and blades assumed, no photograph of
  them found) as far aft as her run leaves room over them, each on an
  open shaft with an A-bracket just ahead of it and a strut further
  forward; each rudder right behind its screw, from inside the hull down
  to the screw's lower third (her twin rudders, `rudder.ys`). Three bow
  thruster tunnels and two stern ones (placed where her hull is deep
  enough). A bulbous bow (`bulb`, the bow-on photographs [P5], [P9] show
  it red under the water) drawn on the model only: her data's stem has
  none and the sim's offsets stay as they are. No stabiliser fins: none
  show in any photograph (retracted).
- **The rock** (R21): a lumpy granite block about 4 m across (her data's
  97 t rock), stuck in her port side at frame 52 (`heel.rock.x`) at 4 m
  over the keel, where the gash ended ([MIT §4.7.2]; the well-known
  photograph of it, not reproduced). Its own small mesh (`rock.ts`): the
  scene (`ShipRig`) shows it in a run whose gash opens WTC 4 from when Le
  Scole's tip, which she runs on past, reaches frame 52
  (`rockLodgedT`, about 13 s after the strike at her sim's 8.3 kn; never
  before the gash's 7 s, `fromT`), so it reads as the islet's rock; the
  viewer always.
- **Emergency lights** (R7): about 7 % of her panes, a fixed hashed
  pattern, carry `emergency: true`. The pane shader reads them
  (`aEmergency`) and keeps them lit at `uEmergency` whatever the power
  (`handles.setEmergency(level)`; default 0, so off until the scene's
  blackout sets her level; the model viewer sets 1 on its night stage).
  `DECK_SLOTS` (the pane shader's deck array) grew from 10 to 20 for her
  18 decks; the other ships use their first ten as before.

### Her paint box (R18)

One real paint, `costa-2012` (default): `CONCORDIA_PAINT`. Her fun paints
are `cruiseFun()` (`lib/shipwreck/ships/funPaints.ts`): "Navy blue
hull", "Black hull, red funnel", "Dark blue hull, white funnel", "White
hull, blue funnel", "White hull, red funnel", "Green hull": looks the
big cruise fleets wore, by colour, never by company. A fun paint
recolours her hull to deck 3 (the hull material), its bottom and blue
line, the funnel and its top, and the boats' lower hulls (their orange
stays: SOLAS); her superstructure stays white (its walls are a white
that is not her hull's, so `withFunPaint` leaves them), and the "C"
comes off (`emblem.realOnly`: the funnel is its own hidden mesh in each
fun paint, made the first time she wears it).

### Assumptions and departures

- Her data moved (look only; the sim does not read them): the funnel
  from x −78 to −52 and its top from 60.6 to 66.5 m, the boats from
  x −64…76 to −84…84 (both measured off [M]).
- The hull is her data's (Task 2): her stern is squarer in plan than her
  rounded counter. The model's counter rounding can only widen a hull
  (it takes the larger of the two), and narrowing the offsets would
  change her sim; so it stays. Her stem's top edge shows a fine dark
  seam in close views (her data's stem sections).
- Deck numbers on the outside are ours where no deck plan was at hand:
  the bridge on deck 8, balconies on 7–10, the boats on 4, the spa on
  12–13.

## The Poseidon

`poseidonRecipe.ts`: a made-up modern cruise ship of our own design (the
first ship in the game that never sailed), built from the cruise kit on her
data (`poseidon.ts`: hull, decks, superstructure boxes, funnel, 24 boats).
Her particulars and her look are ours; every feature below was checked for
believability against photographs of real cruise ships of her size and era
([CR]: the Concordia, Carnival Conquest, Grand and Voyager classes; [WC]:
their Wikimedia Commons categories), never against the 2006 film's art.
New optional recipe fields, so every other recipe builds exactly as before
(their snapshots pass): `ballrooms`, and a funnel's `taper`, `wing` and
`wave`.

| Tier   | Draws (day / night) | Triangles | Build (first, dev server)  |
| ------ | ------------------- | --------- | -------------------------- |
| high   | 11 / 28             | 166,482   | 76 ms (Concordia 77–89 ms) |
| medium | 9                   | 108,564   | 23 ms                      |
| low    | 9                   | 82,132    |                            |

Her budget at high is 100 draws and 300k triangles. Part build in node
(median of 12, high): 30.0 ms against the Concordia's 28.8 ms (+4 %). The
ballroom adds 2,640 triangles at high (816 at low, ribs off) and no draw
call: its glass, drum and ribs are in the paint list, its 144 lit panes in
the one instanced pane mesh. 2,200 panes in all, 161 on emergency power.

### Look notes (ours; believability against [CR]/[WC])

Each feature: what real ships of her era do, what we drew, and the "not
from the film" check.

- **Silhouette.** Real 290–311 m cruise ships of 2000–2010 run a long
  straight sheer with the superstructure almost to the bow and stern, a
  stepped front over the bridge and stepped terraces aft ([CR] Grand and
  Voyager classes, [WC]). Ours: 305 m, lower tiers to 20 m short of the
  stem, decks 7–11 stepping back fore and aft, a raked stem, a square
  stepped stern. Not from the film: our own tier ends from her own boxes.
- **Balconies decks 7–11, window bands decks 0–6.** Real ships of her era
  carry balcony rows over the boats and window rows below them ([WC]
  Concordia, Conquest classes). Ours: the kit's balcony tiers and glass,
  sea-blue glass, 3.6 m cabins; hull and tier windows, big promenade
  windows on the recess wall behind the boats. Not from the film: the
  Concordia's kit, our spans.
- **The boat recess on deck 4.** Real ships hang their boats in a recess
  set in from the side, under the deck over them ([WC] Concordia and
  Grand classes). Ours: the kit's recess, 24 orange boats in davits,
  liferaft racks at its ends. Not from the film: her data's boat places.
- **One tall raked funnel aft, tapering, with a fin across its top.**
  Raked, tapering funnels with side fins or wings at the top are a common
  2000s look ([WC] the Conquest class's winged funnel, Voyager class).
  Ours: an oval 16 × 8.8 m at its foot, raked 15°, narrowing to 70 % at
  the top, a flat fin either side in the top's colour, white under a deep
  blue top, a gold wave stripe (her real paint only). Not from the film:
  our own proportions and paint, no badge or logo.
- **The ballroom under a glass dome.** Real ships put glass domes and
  roofs over pools and atria (the Concordia's sliding glass roof, the
  Grand class's glass-roofed pool and atrium domes, [WC]). Ours: a round
  drum two decks tall (12–13) of 24 tall windows between white piers,
  29 m across, a cornice, a lat-long glass dome of 24 × 6 panes with ribs
  on every meridian and parallel and a small lantern at its crown, lit
  warm from inside until lights-out. Not from the film: a plain domed
  rotunda, our size and pane count.
- **Bridge on deck 9 with wings to her beam; radar mast and domes over
  it.** As every ship in [CR]. Ours: the kit's wings and mast, three
  radomes.
- **Under water: twin screws on open shafts, A-brackets, twin rudders,
  bow and stern thrusters.** As the Concordia and Grand classes ([CR]).
  Ours: 5.6 m screws as far aft as her run leaves room (x −134), rudders
  right behind them; seen in the air keel up.
- **"POSEIDON" on both bows and across her stern.** Plain sans capitals
  in deep blue (our lettering), no port of registry (she is made up), no
  trident or logo.

### Her paint box (R6)

- `poseidon` (default, ours): white hull (`0xf1f1ec`, not quite the
  superstructure's `0xf4f4f0`, so a fun paint leaves her houses white), a
  sea-blue line along her hull's top (`sheerLine`), a deep blue boot-top
  over a dark red bottom, a white funnel with a deep blue top and the gold
  wave (`wave.realOnly`, as the Concordia's "C"), orange boats.
- Fun paints: the cruise set (`cruiseFun()`), painted over hers by
  `withFunPaint`, which also takes the gold wave off; `setLivery` swaps
  colours only (the 1.7 mechanism; tested).

### Assumptions and departures

- Ruling: the sea-blue band sits at her hull's top (deck 1, the
  `sheerLine`) rather than the spec's "deck 3": her data puts the hull's
  top at deck 1, and `sheerLine` is the paint a fun paint swaps.
- Ruling: the dome's crown is 9 m over deck 14 (her data's ballroom
  comment), above the `ballroom` box's top (deck 14 + 4 m): that top is
  the dome's volume as a slab, not its crown. The drum and dome sit inside
  the box in plan and from its floor; tested.
- Her stern is stepped but square, not rounded in plan (the kit's tiers
  round only forward).
- Keel-up check in the model viewer: `setModelView({ roll: 180, camera:
"keel" })`.
