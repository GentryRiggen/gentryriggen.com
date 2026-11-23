# Shipwreck — HMHS Britannic

Fifth ship for `/shipwreck`: HMHS Britannic, the Titanic's younger sister,
serving as a hospital ship in the First World War, sunk by a mine in the
Kea Channel, Aegean Sea, on the morning of 21 November 1916. Builds on the
1.0 spec (`2026-11-20-shipwreck-design.md`), the Lusitania spec
(`2026-11-21-shipwreck-lusitania-design.md`), the walk spec
(`2026-11-21-shipwreck-walk-design.md`) and the Fitzgerald spec
(`2026-11-21-shipwreck-edmund-fitzgerald-design.md`), which still hold for
everything this document does not change.

Built in parallel with RMS Carpathia (sibling branch
`feat/shipwreck-carpathia`). This branch owns only the Britannic. The parent
integrates both ships into one 1.4.0 release, so this branch does **not**
bump `SHIPWRECK_VERSION` or edit `lib/shipwreck/changelog.ts`; the draft
changelog entry is at the end of this document.

## Why

Gentry's son (iPad mini 6) wants a realistic sinking he can "zoom in and fly
around", "go inside certain places, see things as it sinks". "Realism can be
really good in place of high fidelity." The title screen promises the
Britannic as "Coming soon". Gentry said to dive in, so every call below is
ours; he may revisit any of them (see "Rulings Gentry may revisit").

She is the best lesson in the game. She was built after the Titanic with
everything the Titanic lacked: taller bulkheads, a double skin, giant davits
and boats for everyone. She was built to float with six compartments
flooded, and the mine flooded about six. What sank her was everything
around the damage: watertight doors that did not close, portholes left open
to air the wards, and a brave run for the shore that pushed the sea in
faster. What if lets you undo each one.

## North-star goals (every builder re-reads these)

1. **She sinks the way she really did, from physics, not a script.** A mine
   on the starboard bow, the forward compartments filling, a door that does
   not shut letting boiler room 5 fill, open portholes going under as she
   settles and lists to starboard, her run toward Kea pushing water in
   faster, the bow striking a 120 m sea floor while her stern is still in
   the air, and the roll onto her starboard side. About 55 minutes. Tuning
   stays inside honest ranges; every assumption is documented in the sim
   README.
2. **She looks like the Britannic, not a white Titanic.** A boy who knows
   ships will spot a wrong feature, so every visible feature is sourced:
   the hospital livery, the gantry davits, the wider hull, the bridge
   number, the funnels (fourth a dummy), masts, portholes, superstructure.
3. **It looks as good as the other ships and runs at 60 fps on an iPad mini 6.** The 1.0 budgets apply (≤ 160 draw calls, ≤ 450k triangles at the top
   tier, no frame blocked > 8 ms). `e2e/perf-budget.json` gains Britannic
   scenes only; nothing else moves.
4. **A different morning, not a recoloured Lusitania afternoon.** Low
   November morning sun from the east-south-east over a calm, deep-blue
   Aegean; the brown-green hills of Kea on her starboard bow, the Attica
   coast faint to port; the water column of the mine; her curving wake as
   she turns for Kea; clear blue water below and a pale sand-and-mud floor.
5. **No ship regresses.** Titanic, Lusitania and Fitzgerald golden fixtures
   and every existing test pass unchanged.
6. **Kind to a young player.** No people shown, no death counts in play, no
   screams or voices. The propeller incident (two boats drawn into her
   turning screws) is never shown or named in play or in the parent line
   (the exact parent-line copy below wins); the parent line tells
   the adults. Kid UI is big picture buttons, no reading needed.

## History the sim and scene aim at

Sources, abbreviated in the README tables: Chirnside, _The 'Olympic' Class
Ships_ and _HMHS Britannic FAQ_ (markchirnside.co.uk) [CH]; Wikipedia,
"HMHS Britannic" (largely drawn from Chirnside) [WP]; Great Ocean Liners
[GOL]; Atlantic Liners [AL]; White Star History [WSH]; Titanic Inquiry
Project ship record [TIP]; PBS _Lost Liners_ [PBS]; Kea Divers [KD]. Builders
verify and cite; where a source disagrees, pick one, say which and why.

**Build and particulars.** Harland & Wolff, Belfast, yard no. 433; launched
26 February 1914; completed as a hospital ship December 1915. LOA 882 ft
9 in (269.1 m) and LBP the same as her sisters [CH: "all of Harland &
Wolff's documentation is in agreement"; the "903 ft" figure is a newspaper
error]. Breadth 93 ft 6 in moulded, 94 ft extreme (28.5 / 28.65 m), 18 in
more than her sisters, confirmed by October 1911, before the Titanic
disaster [CH]. Design draught 34 ft 7 in (10.5 m), displacement about
53,200 long tons, 48,158 GRT [WP]. Height keel to funnel tops about 53 m.

**Differences from the Titanic that matter here** (all cited in the spec's
tables in the READMEs):

- Six (or five) of the fifteen transverse bulkheads raised to B deck
  [WP design section: six; WP explosion section and AL: five]. **Disagreement.**
- A double skin (inner skin) along the boiler and engine rooms [WP, AL, WSH].
- Gantry davits: eight sets designed, **five fitted** before war service, the
  rest made up with Welin davits as on the Titanic [WP, AL]; each set could
  handle six boats [WP]. 48 lifeboats, room for at least 3,600 [WP]. Where
  the five stood is disputed: planned layout "one on either side of the
  forward funnel, two on either side of the aft funnel, and two astern on
  the shade deck" [AL]; fitted: one by the officers' quarters (starboard)
  and four aft by the fourth funnel, the port forward set never completed
  [Britannic fan wiki, Encyclopedia Titanica thread, Remco Hillen's
  drawings]. **Disagreement**; ruling R5.
- Hospital ship livery (below), wider hull, the fourth funnel a dummy (as
  on her sisters), no B-deck private promenades. The model builder checks
  photographs (Wikimedia Commons "Britannic (ship, 1915)") for the forward
  A/B deck screens and windows and any other visible difference, and lists
  each in the model README.

**Livery as a hospital ship (November 1916).** White hull and superstructure;
a green band along the hull from stem to stern, broken by three large red
crosses on each side [WSH, PBS]; two more red crosses on each side of the
boat deck, lit at night [WSH]; the boot-topping red below the waterline.
Funnels buff with black tops [TIP, PBS] (one source and a rigging plan say
"yellow" [Steamship Mutual, ShipsOfScale forum]: we read that as White
Star buff, an ochre yellow). The bridge front carried her transport number,
"G.618" by October 1916 (it was G.608 early in 1916) [CH, AL]. Masts buff.
The real paint soon looked grubby with coal dust [CH]: a light weathering is
right, not a gleaming white.

**The morning of 21 November 1916** (EET, ship's time as reported):

| Time          | What                                                                                                                                                                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| before 08:12  | Outbound Naples → Mudros (Lemnos), no patients yet aboard, "steaming at full speed into the Kea Channel" [WP]; service speed 21 kn. Calm after a storm at Naples [WP].                                                                                                                                               |
| 08:12         | Explosion: a mine laid by U-73 (mine anchors found by sonar off the wreck [WP]). Starboard side, "between holds two and three" [WP]; the bulkhead between hold 1 and the forepeak damaged; the firemen's tunnel to boiler room 6 damaged [WP]. The steering gear was put out; Bartlett steered with the shafts [WP]. |
| ~08:14        | Boiler rooms 6 and 5 abandoned [WP]. The door between boiler rooms 6 and 5 "failed to close properly"; the bulkhead and door between 5 and 4 held [WP]. Divers later found several watertight doors open (possibly a watch change) [KD/WP].                                                                          |
| 08:12 →       | "The first four watertight compartments were filling rapidly" [WP]: forepeak, holds 1–3, plus boiler room 6 through the tunnel and boiler room 5 through the door: six spaces. She could float with six flooded [WP]. Bartlett turned to starboard for Kea to beach her [WP].                                        |
| ~08:27        | The open portholes on E deck forward under water, about 15 min after the strike [WP]. Nurses had opened most of the lower-deck portholes forward to air the wards, against orders [WP]. List to starboard ("a serious list", no angle given) [WP].                                                                   |
| ~08:30–08:45  | Boats lowered (35 launched and stayed afloat [WP]). Two port boats launched early without orders were drawn into the still-turning propellers (parent line only; never shown). Bartlett stopped the engines [WP] (no clock time: ruling R9).                                                                         |
| 08:50         | Most people away; engines restarted to try to reach the shore [WP].                                                                                                                                                                                                                                                  |
| 09:00         | Flooding "had increased due to the ship's forward motion" and reached D deck [WP]; engines stopped; two long blasts on the whistle: abandon ship [WP].                                                                                                                                                               |
| 09:00 → 09:07 | She "gradually capsized to starboard, and the funnels collapsed one after the other" [WP]. "By the time the stern was out of the water, the bow had already slammed into the seabed" [WP; GOL: the bow "hit the sea floor before the stern became submerged"].                                                       |
| 09:07         | Gone, 55 minutes after the explosion [WP, WSH, AL].                                                                                                                                                                                                                                                                  |

People aboard 1,066 (1,065 or 1,062 in other sources) [WP, GOL, AL]; 30
died [all]. The parent line says so; play never does.

**Wreck.** About 120 m (400 ft, 122 m [WP, GOL]; 119 m in one dive guide):
the sea is shorter than she is long. She lies on her starboard side,
relatively intact [WP, WSH]; the bow heavily deformed, joined to the hull
only by parts of C deck [WP] ("severely bent up" [GOL]); a large hole under
the forward well deck [WP]. The funnels fell as she capsized: funnel 1 lies
a few metres from the boat deck, 2–4 in the debris field off the stern
[WP]; the foremast lies bent on the floor [WP]. Found by Cousteau in 1975
[WP]; owned by Simon Mills since 1996 [WP]. (The prompt's "funnels gone"
means gone from the hull: they lie beside her.)

## The sim (what changes, all gated so other ships are untouched)

Reuse first: the Lusitania's portholes, timed openings, grounding while
afloat, headway and the rest-on-side rule (`ShipSpec.wreck`). New format
pieces, each optional and `undefined` for every existing ship:

- **`cause: "mine"`.** Words, scene and What-if read it like `"torpedo"`
  (an explosion low on the starboard side) but there is no run-in streak;
  a short `preRollS` of her steaming before the blast is allowed.
- **Watertight doors in transverse bulkheads** (`ShipSpec.doors`): an
  opening at a height in the bulkhead between two neighbouring
  compartments, flowing by the orifice law on the head difference (like
  `crossFlowM2`, but fore-and-aft). The real run has the boiler room 6 → 5
  door partly open (area calibrated within a stated range) and the damaged
  firemen's tunnel joining hold 3 (or the hold it runs under: builder
  checks) to boiler room 6. `SimOptions.doorsClosed` (What if) shuts every
  door; the tunnel's damage is mine damage, not a door, unless a source
  says the tunnel door itself failed (ruling R7).
- **A speed profile** (`headway.profile`: [shown s, m/s] pairs, linear),
  replacing the single half-life where present: about 20 kn at 08:12, full
  ahead toward Kea, engines stopped (R9), coasting down, slow ahead again
  at 08:50, stopped at 09:00. `SimOptions.enginesStopped` (What if) stops
  her engines at the blast: she coasts to rest with the default half-life.
- **Forward speed pushes water in** (the physics behind "increased due to
  the ship's forward motion" [WP]): while she has way, the head at a hull
  opening or an open porthole row in the forward part of the hull gains a
  dynamic term Cp·u²/2g (u her speed), Cp from a stated range for a hole in
  the side of a moving hull plus her bow wave over the forward portholes.
  Documented in the README with the chosen value. Zero for every other ship
  (no field, no term).
- **The turn for Kea**: a kinematic heading change (`headway.turn`: [shown
  s, yaw degrees] pairs) applied to every body's earth pose and to the
  headway's direction, so her wake curves and Kea swings ahead. Yaw stays
  exactly 0 for other ships. The angle comes from her course up the Kea
  Channel and the wreck's position relative to the island (builder
  measures; R10).
- **The bent bow**: when the bow strikes the floor hard (`bow-lands` with
  the stern still above water), the model bends the forward part of the hull
  up and to port (a documented visual rule, like the rest on her side; the
  sim is unchanged). R12.

Her data (`lib/shipwreck/ships/britannic.ts`): Titanic's hull lines with the
half-breadths widened to 94 ft extreme (scaled about the centre line, not
added at the side), Titanic's deck heights, Titanic's 15 transverse bulkhead
positions with the raised ones at B deck (R3), inner-skin wing cells along
the boiler and engine rooms on both sides (narrow `span` cells, so a mine
there fills only the void: the lesson of the double skin), open porthole
rows on the lower decks forward (E deck and below as sources say), both
sides, plus closed rows elsewhere, her outbound load (no patients, coal
since Naples: draught and displacement derived and documented, R4), her
48 boats, funnels (the fourth a dummy; all four `falls` during the
capsize), `seaDepthM: 120`, `clockStartS: 8*3600 + 12*60`,
`wreck: { restDeg: ~90 to starboard, minListDeg }` (she lies on her side).
Real damage (`realNight`): an opening low on the starboard side at the
hold 2/3 bulkhead, the forepeak/hold 1 bulkhead damage (a door-like
opening or a small hole into the forepeak: builder's call), the tunnel to
boiler room 6, all `t: 0`; one `explosion` scripted event.

**Pass criteria (real morning, enforced by tests):**

- `explosion` at t = 0 (± a few s); she lists to starboard (> 0.5° by 15 min,
  never to port; widened from ≥ 3° after Task 2: see R20; maximum before `bow-lands` between 8° and 30°: builder reports
  the value; no source gives an angle);
- down by the head from 5 min on; E-deck forward portholes under between
  10 and 22 min (real ~15);
- `bow-lands` fires before `stern-under`, with some stern point above the
  sea at that frame;
- `sankAtT` (stern under) between 45 and 65 min (real 55);
- no `breakup` (she did not break; the bow is bent, not severed);
- she rests with `roll` to starboard ≥ 60° (on her side);
- funnels fall one after another during the roll;
- deterministic; finite poses; the run ends inside `endT`.

**What if (multi-select, like the others).** Spots are the starboard
compartments a mine could hit (as the Lusitania's torpedo spots; more than
one allowed; mines under the double skin fill only the void), plus three
toggles with picture buttons, all on = the real morning:

- **Portholes open** (default on).
- **Doors stuck open** (default on; off = every watertight door closes).
- **Run for Kea** (default on; off = engines stopped at once, no turn).

Expected (tests): real spot with all three off → floats (outcome
`floated`, "She stayed afloat."); portholes shut alone → sinks later than
the real morning or floats; doors closed alone → sinks later; engines
stopped alone → sinks later; a mine under a boiler room (double skin) →
floats. The words for the result never blame anyone.

**Builder's calls settled before planning** (from the builder check):

- **Honest physics beats a test band.** The bands are targets. If honest
  values (each inside a stated, sourced range) cannot reach a band, the
  builder stops and reports the numbers; the controller then widens the
  band and the README says why. No parameter goes outside its range to pass.
- **The real damage as sourced is the fixed point.** With all three toggles
  off she is expected to float (built to float with six flooded); if
  honest physics says she still sinks, "sinks at least twice as late as the
  real morning" is accepted and documented.
- **The real mine is one What-if spot that bundles its damage**: choosing
  her real spot (hold 2/3) brings back every real opening: the hole, the
  forepeak bulkhead damage and the tunnel damage into boiler room 6 (those
  last two are `kind: "damage"` doors tied to that spot). Any other spot
  gets one hole of the same area at that compartment and nothing else, as
  the Lusitania's torpedo spots do. The boiler room 6/5 door is a
  watertight door, present in every run unless "Doors stuck open" is off.
- **The turn is pose and position only.** The physics sees a straight
  course: the ram term uses her speed, not her heading; yaw changes no
  pitch, roll or flooding. It is applied to every body's earth pose and to
  the direction her way carries her.
- **Shared files with Carpathia**: assume Carpathia may touch any shared
  Shipwreck file (`types.ts`, `run.ts`, `settings.ts`, `Coast.tsx`,
  `story.ts`, the analytics lists). Put new logic in new files where it is
  reasonable (`sim/doors.ts`, the Britannic's coastline in its own module),
  append to unions and lists, never reorder or reformat.
- **R18 She can reach Kea**: if she is still afloat when her run for Kea
  would put her on the beach (the shelter time from her speed profile and
  the distance), the run ends `sheltered`: "She reached Kea." With the
  engines stopped she never does.

## Look and scene

- **Model** `components/shipwreck/model/britannicRecipe.ts`, built from the
  Titanic recipe where the sisters match (hull, plating, portholes, decks,
  houses, funnels, masts, cranes, propellers and rudder: three screws, the
  centre one turbine-driven), with the cited differences: hospital livery
  (white hull, green band broken by three red crosses a side, red crosses on
  the boat deck sides, buff funnels with black tops, "G.618" on the bridge
  front, name "BRITANNIC" at the bow if photographs show it), the five
  gantry davit sets (R5) with their boats, Welin davits elsewhere, 48
  boats, the wider beam, the forward screens/windows as photographs show.
  Titanic's recipe output stays deep-equal to its snapshot.
- **Scene settings** `britannic`: `timeOfDay: "morning"` (new value;
  rendered like the afternoon with the sun from the settings), the sun
  computed for 37.7° N 24.3° E at 08:12 EET on 21 November 1916 (about 9°
  up, ESE: builder computes and cites), deep-blue Aegean sea and haze,
  `coast: true` with Kea's hills (Port St Nikolo bay) ahead to starboard
  and a low Attica/Makronisos silhouette to port, clear blue underwater fog,
  a sand-and-mud floor at 120 m. The Lusitania's `Coast.tsx` grows a
  per-ship coastline rather than a copy. The mine: a white water column and
  spray at the starboard bow at t = 0, no mine or U-boat shown. Smoke from
  three funnels thinning when the engines stop.
- **Sound**: a calm morning bed (sea, gulls, engines), the mine's boom
  (deeper and shorter than the torpedo's), engines stopping and starting,
  two long whistle blasts at 09:00, funnels falling. No voices.
- **Camera**: the 120 m floor, the hull lying across it, the stern up while
  the bow is grounded: no camera through the floor (as the Lusitania).

## Walk the decks

`lib/shipwreck/walk/britannicDecks.ts` from `titanicDecks.ts`: the same
open decks (boat deck, forward well, forecastle, after well, poop) at
Britannic's beam, with the gantry davits, boats, houses and funnel casings
as blockers where the recipe draws them. `walkMapFor("britannic")` returns
it; the walk e2e gets a Britannic case.

## UI, words, analytics

- **Title screen**: the "Coming soon" Britannic card becomes the real one,
  last after Carpathia (`SHIP_IDS` order titanic, lusitania, fitzgerald,
  carpathia, britannic: this branch appends `britannic` after
  `fitzgerald`; the merge places Carpathia before it).
- **Words** (story captions, `sinceText` "12 min after the mine", places,
  help, end card): calm and factual. Places: the bridge, the forward hold
  where the mine struck, boiler room 6, the open portholes on E deck, the
  gantry davits, the turbine engine room.
- **Parent line** (exact copy): "This is the Britannic in 1916, a hospital
  ship in the First World War. A mine sank her in 55 minutes, and 30 people
  died. This game shows only the ship."
- **Save**: `whatIfByShip.britannic` with `{ ids, portholesOpen,
doorsClosed, enginesStopped }` (optional fields; no reset). Tests that
  use `"britannic"` as an unknown ship id switch to another unknown id.
- **Analytics** (data boundary: spec review + adversarial review): the
  closed `ship` enum gains `britannic` in `lib/analytics/gameEvents.ts`,
  `firestore.rules`, `firestore-tests/gameEvents.test.ts` and the admin
  dashboard together; no new props beyond that unless a What-if toggle is
  already counted for another ship as an enum (never free text).
  `npm run test:rules` must pass.

## Non-goals

People, the U-boat or a visible mine, the propeller incident, the patients
and wards inside, walk-in interiors beyond the X-ray blockouts, a version
bump or changelog edit (the parent does it), Carpathia.

## Anti-goals (fail even if it technically works)

- A white-painted Titanic: Britannic without her gantry davits, green band
  and red crosses, or with the wrong beam.
- A canned roll or bow strike pretending to be physics.
- Any other ship's track, look or performance changing.
- Shared-file edits that are not minimal and additive (they must merge
  cleanly with the Carpathia branch).

## Rulings Gentry may revisit

- **R1 Ship id `britannic`**, shown as "Britannic" (card) and "the
  Britannic" in words; "HMHS Britannic" on the end card.
- **R2 Same length as her sisters, 94 ft extreme beam** [CH], the Titanic's
  lines widened. The "903 ft" figure is rejected [CH].
- **R3 Raised bulkheads**: sources say five or six raised to B deck; the
  sim uses the number and positions the builder finds best sourced (else
  five, the amidships bulkheads that on the Titanic stopped at E deck), and
  the README says which.
- **R4 Her load**: outbound, no patients; draught and displacement derived
  from coal used since Naples, documented as an assumption.
- **R5 Gantry davits**: five sets, one starboard forward by the officers'
  quarters and four aft by the fourth funnel (two each side), the port
  forward position on Welin davits; photographs win if they disagree.
- **R6 Funnels plain buff, no black tops** (revised in Task 3): the two
  1916 photographs on Wikimedia Commons ("HMHS Britannic.jpg", "Britannic
  in Naples for Coaling.jpg") show one tone to the rim with only a thin
  sooty lip; the reviewer measured the pixels and confirmed it. A boy who
  knows the Titanic may expect black tops: this is the photographs' answer.
- **R7 Watertight doors**: the boiler room 6/5 door partly open in the real
  run (area calibrated); "Doors stuck open" off closes every door. The
  tunnel damage stays as mine damage.
- **R8 Portholes**: open on the forward lower decks (E deck and the deck
  below where the wards were), both sides; closed elsewhere.
- **R9 Engine times**: no source gives a clock time for the first stop; we
  stop them at about 08:35 (after the first boats), restart at 08:50, stop
  at 09:00. Speed about 20 kn at the blast (service 21 kn).
- **R10 The turn**: a kinematic swing to starboard toward Kea, its angle
  from the channel's course and the wreck's position.
- **R11 Forward speed's dynamic head** Cp·u²/2g on forward openings, Cp
  from a stated honest range; it is what makes "Run for Kea" matter.
- **R12 The bent bow** is a visual rule on a hard bow landing, not physics.
- **R13 Bridge number "G.618"** (October 1916 photo [CH]).
- **R14 What-if toggles**: Portholes open, Doors stuck open, Run for Kea;
  mine spots multi-select like the torpedo spots.
- **R15 No people, no propeller incident**, boats shown leaving only from
  the davits in calm order; the morning ends when she is gone.
- **R16 "Morning"** is a new `timeOfDay` value drawn like the afternoon,
  with its own sun, sea colour and coast.
- **R17 Not shown**: the patients' wards inside, the U-boat, the mine.
- **R18 She can reach Kea** (not delivered: see R20c; the end-card words
  exist but no run reaches shelter) in a What if (ends "She reached Kea."), from
  the shelter time her speed profile and the distance give.
- **R19 All three toggles off may still sink her** very slowly if honest
  physics says so (accepted at ≥ 2× the real time, documented). In the
  event every fix alone keeps her afloat except "Run for Kea".
- **R20 What the sim found (Task 2)**: (a) her list stays small (about
  1–2°) until the final capsize, because her forward spaces flood full
  breadth; "a serious list" [WP] has no angle, and water held to starboard
  between decks is not modelled (follow-up). (b) Her strike-to-wreck
  distance (about 4.7 km) means she lost most of her way within minutes
  (20 kn → 2 kn by 8:18, stopped 8:35, 3 kn 8:50–9:00), so the forward
  speed's push is small and "Run for Kea" changes the sinking by seconds;
  the toggle stays because it was asked for, and its honest lesson is that
  the portholes and doors mattered. (c) She cannot reach Kea on that
  profile, so R18's "She reached Kea." never happens. (d) Her girder is at
  the top of its honest range (6.0 GN·m hogging); lower, she breaks before
  the bow lands. (e) Raised bulkheads D, F, K [CH] plus E, G, H (assumed).

- **R21 Her list (Task 2b, revisit)**: the midway audit found the
  starboard list and the capsize are set by an assumed 2 cm off-centre
  weight (`tcg: -0.02`, the Titanic's precedent is 2 cm to port), not by
  the mine. Task 2b tried about 4,000 honest between-deck models: the
  starboard hole gives a 2–5° list early that the filling holds take back
  by about 8:35; narrow cross-flow holds the list but sinks her at
  9:20–10:40 and usually breaks the girder first; with no offset she often
  capsizes to port. So the 2 cm offset stays, unsourced and stated; the
  list tests measure only the list the flooding adds, and three tests of
  the wished-for behaviour are kept as `it.failing` alarms. A sourced
  asymmetry (coal, stores, the wards) is the follow-up.
- **R22 Hull band 1.7 m** deep, about as deep as the cross arm, measured
  from the same photograph as the crosses (the crosses measure about 6 m).

- **R23 Two liveries (Gentry, 2026-11-22)**: every ship gets a live
  toggle between its default paint and its original paint. The
  Britannic's default is the hospital ship (as she sank); her second
  livery is her intended White Star liner paint (black hull, white
  superstructure, gold sheer line, red boot-top, buff funnels with black
  tops), cited from H&W/White Star sources and the Olympic, with a note
  that she never sailed as a liner. Her model swaps paint at runtime
  without rebuilding geometry (Task 3b). The shared toggle (liveries list,
  HUD picture button, save field) is built on the Carpathia branch and
  wired to the Britannic by the parent at integration.

## Later (MVP cut, Gentry 2026-11-22: "ship MVP and iterate")

She ships alone as 1.4.0, ahead of the Carpathia. Moved out of this
release, to come next:

- **Her own sounds** (plan Task 7): a calm morning bed with gulls, the
  mine's boom, engines following her speed, the two long whistle blasts at
  09:00 (the 09:00 `radio` event is already in her track for it). She uses
  the shared beds and cues as they are.
- **Walk the decks on her** (plan Task 8): `britannicDecks.ts` from the
  Titanic's walk map at her beam, with the gantry davits as blockers. Her
  Walk button stays hidden until then (`walkMapFor` returns null).
- **The bent foremast on the floor** [WP]: her foremast is merged into the
  model mesh, so while she lies on her side it stands about 14 m off the
  floor; laying it down needs a shared model-build change.
- **A list from the flooding** (R21): a sourced asymmetry instead of the
  2 cm offset.
- The follow-up list in the ledger (minor review findings).

## Draft changelog entry (for the parent's 1.4.0)

"**The Britannic.** Titanic's little sister is here! She was a hospital ship
in the First World War, painted white with a green stripe and big red
crosses, with giant crane-like davits for her lifeboats. Watch her strike a
mine near the island of Kea, try to race for the shore, roll onto her side
and touch the bottom before her back end is even under. Then try What if:
shut her portholes, close her doors, or stop her engines, and see if she
stays afloat. You can walk her decks too."
