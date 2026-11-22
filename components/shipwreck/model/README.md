# Shipwreck model

The procedural ships: each built at load from its ship data
(`lib/shipwreck/ships/titanic.ts`, `lusitania.ts`, `fitzgerald.ts`) and a
detail recipe (`titanicRecipe.ts`, `lusitaniaRecipe.ts`,
`fitzgeraldRecipe.ts`; `recipeFor(spec)` picks by `spec.id`). Nothing is downloaded: every texture is drawn into a canvas
once.

## Files

| File                  | What                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hullSurface.ts`      | The hull from the spec's offsets, interpolated with monotone cubics (smooth, exact at the stations); rounds the counter in plan.                                               |
| `titanicRecipe.ts`    | Where everything goes: decks, houses, funnels, masts, boats, davits, 2,000+ portholes and windows, fittings, rails, wires, underwater gear. The recipe types.                  |
| `lusitaniaRecipe.ts`  | The Lusitania's: her tiers (`blocks`), houses, funnels, 48 boats, 44 davits, lights, the forest of ventilators, four propellers; `PEACETIME_PAINT`.                            |
| `fitzgeraldRecipe.ts` | The Edmund Fitzgerald's: forecastle, texas house and pilothouse, the after house, 21 hatch covers on coamings, the hatch crane, one funnel, boats, one propeller; `FENCE_GAP`. |
| `breakCut.ts`         | The jagged tear through `breakX` and which half a point belongs to.                                                                                                            |
| `buildShip.ts`        | Recipe to merged triangle lists per material, instance lists and line lists, for the whole ship or one half; quality tiers.                                                    |
| `partGeometry.ts`     | Funnels, boats, cowl vents, benches, bitts, rail posts, porthole and window panes.                                                                                             |
| `materials.ts`        | Hull paint by height in the shader, painted steel (vertex colours), planks, bronze, the name boards, the lit panes and their uniforms.                                         |
| `textures.ts`         | Plate seams and rivets (normal map), weathering, planks, the name.                                                                                                             |
| `shipModel.ts`        | Assembles the three.js tree and the handles.                                                                                                                                   |
| `TitanicModel.tsx`    | The R3F component (any ship: `spec`).                                                                                                                                          |
| `pose.ts`             | `applyBodyPose`: a sim `BodyPose` onto a part.                                                                                                                                 |
| `ModelViewer.tsx`     | The checking stage at `/shipwreck?model` (`&ship=lusitania` or `&ship=fitzgerald`; dev and e2e builds only).                                                                   |

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
for the standard views and the draw counts (add `lusitania` or
`fitzgerald` as a third argument, and `&ship=<id>` to the viewer's URL,
for them).

The Titanic's and the Lusitania's recipes are frozen:
`__tests__/titanicRecipeSnapshot.test.ts` compares each field by field
with a fixture (the Titanic's written before the Lusitania touched the
shared code, the Lusitania's before the Fitzgerald did). Everything a
later ship needed is an optional recipe field (`paint`, `blocks`, `boxes`,
`drums`, `ledgeDecks`, `staffs`, the rudder's `centre` and `posts`; for
the Fitzgerald `bells`, a block's `wallColor`, `roofColor` and `camber`,
a hatch's `color` and `coaming`, a funnel's `stripes` and `emblem`, a
rail's `color`, the paint's `port`, `letters`, `hull` and `boat`, a
centre-line boat, a name board's `rows`, `createHullSurface`'s bow
rounding with its `tip` and its propeller `aperture`) whose absence
builds the earlier ships exactly as before.

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

`LUSITANIA_PEACETIME_PAINT` (one constant in her data,
`lib/shipwreck/ships/lusitania.ts`, re-exported by the recipe as
`PEACETIME_PAINT`) switches to her 1907–1914 colours. Her funnel colours
live there too (`LUSITANIA_FUNNEL_PAINT`, `spec.funnelPaint`), so the hull
diagram and the model paint them alike. Off, she is painted as on the day:

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
- Estimates: funnel section 25 × 21 ft, three thin bands in peacetime,
  boats 30, 27 and 23 ft, propellers 4.7 m across.

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
  `0x611f1f`, darker below her 27 ft 6 in draught (an assumption). She
  was launched with a black hull (1958 photographs, the builder's model);
  by 1971 she was red (the slides), and divers describe the wreck's
  stern as deep red, so red it is ("launched black": a Finescale forum
  thread on her launching film).
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
