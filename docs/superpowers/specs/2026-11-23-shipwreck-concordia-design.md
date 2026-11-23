# Shipwreck — Costa Concordia

Sixth ship for `/shipwreck`: the cruise ship Costa Concordia, on the night of
13 January 2012, when she struck the Le Scole rocks off Isola del Giglio,
lost all power, drifted back to the island and came to rest on her starboard
side on the rocks beside Giglio Porto. Builds on the 1.0 spec
(`2026-11-20-shipwreck-design.md`), the Lusitania, walk, Fitzgerald,
Carpathia and Britannic specs (`2026-11-2[0-2]-shipwreck*-design.md`), which
still hold for everything this document does not change.

This branch (`feat/shipwreck-concordia`, off main at 1.8.0) owns the whole
release: it **bumps `SHIPWRECK_VERSION` to the next free minor (1.9.0
assumed; the release task re-checks main)** and writes the changelog entry
(draft at the end). The icon v1 files never change.

## Why

Gentry's son (iPad mini 6) knows ships and wants the real thing, "zoom in and
fly around", "see things as it sinks". Every other ship in the game ends on a
deep, flat sea floor. The Concordia is the modern one, and the one that did
not sink out of sight: she ended half out of the water, lying on her side
beside a harbour, for two and a half years. Gentry said to dive in and get it
deployed, so every call below is ours; he may revisit any of them (see
"Rulings Gentry may revisit"). MVP first: sounds and Walk the decks for her
are in "Later".

Her lesson is a good one for a boy. She was built to float with any two
neighbouring watertight compartments flooded. The rock tore open four, and a
fifth leaked. Those five held almost every machine she had: the engines,
the electric motors, the switchboard. So she lost her lights, her engines and
her steering within a minute. The wind and her jammed rudder turned her back
to the island, and the shallow rocks there are what held her up. What if
lets him tear fewer compartments (she floats), or let the wind blow her out
to deep water instead (she rolls over and sinks).

## North-star goals (every builder re-reads these)

1. **She floods and lists from physics; the track and the final roll are
   honest rules.** A port-side gash along five compartments aft at 21:45,
   the two machinery rooms filling in minutes, the next ones in about forty,
   water spreading along the bulkhead deck, the list going from a little to
   port to more and more to starboard, down by the stern, the stern touching
   the rocks at about 22:39. Her drift path and the roll from about 20° to
   her rest at 65° on the rocks are stated rules, like the Lusitania's rest
   on her side. Every assumption is documented in the sim README.
2. **She looks like the Costa Concordia, not a generic cruise ship.** A boy
   who knows ships will spot a wrong feature, so every visible feature is
   sourced from photographs: white hull with the blue line at the waterline,
   dark red bottom, the tall superstructure, rows of balconies, 26 orange
   lifeboats along her sides, the one big yellow funnel aft with the blue
   "C", the bridge and its wings, the glass-sided spa forward, the glass roof
   over the main pool, the water slide, the name on the bow.
3. **It looks as good as the other ships and runs at 60 fps on an iPad mini 6.** ≤ 160 draw calls, ≤ 450k triangles at the top tier, no frame blocked
   > 8 ms. Her model alone at `high` ≤ 100 draw calls, ≤ 330k triangles.
   > `e2e/perf-budget.json` gains Concordia scenes only; nothing else moves.
4. **A different night: an island close by.** A January night with the
   island of Giglio a few hundred metres off her starboard side, Giglio
   Porto's harbour lights and lighthouse, houses lit on the hillside, the
   dark rocks of Le Scole, a light chop from the north-east wind. She is lit
   from end to end until the blackout; then only her emergency lights. Under
   water, a granite shelf with seagrass, sloping to deep water.
5. **No ship regresses.** The Titanic, Lusitania and Fitzgerald golden
   fixtures, and new Carpathia and Britannic goldens written before any sim
   change, pass unchanged; every existing test passes.
6. **Kind to a young player.** No people shown, no death counts in play, no
   screams or voices, nothing about the captain's conduct (no "salute", no
   blame) in play. The parent line states the facts plainly and kindly (the
   exact copy below wins). Kid UI is big picture buttons, no reading needed.

## History the sim and scene aim at

Sources, abbreviated in the README tables:

- [MIT] Italian Ministry of Infrastructures and Transports, Marine Casualties
  Investigative Body, _Cruise Ship Costa Concordia, Marine casualty on
  January 13, 2012: Report on the safety technical investigation_ (2013).
  Copy used: gCaptain's mirror,
  `https://gcaptain.com/wp-content/uploads/2013/05/Costa_Concordia_-_Full_Investigation_Report.pdf`
  (7.3 MB; `pdftotext -layout` reads it; the figures are images, read them
  with the Read tool's `pages`). Page numbers below are the report's own.
- [SaS] Safety at Sea Ltd, "Costa Concordia – Flooding simulations" (5 Sep
  2012), as quoted in [MIT] §4.7.9.
- [WPD] Wikipedia, "Costa Concordia disaster"; [WPS] Wikipedia, "Costa
  Concordia" (ship); [WPC] Wikipedia, "Concordia-class cruise ship";
  [WPP] Wikipedia, "Parbuckle salvage".
- [WC] Wikimedia Commons, "Category:Costa Concordia (ship, 2006)" and its
  sisters' categories (Costa Serena, Pacifica, Favolosa, Fascinosa; Carnival
  Splendor): the photographs every visible feature is checked against.
- [EMO] EMODnet Bathymetry DTM (outer depths); [OSM] OpenStreetMap coastline
  of Isola del Giglio (© OpenStreetMap contributors, ODbL; attribute in the
  scene README); [IIM] Istituto Idrografico della Marina chart 122 (as
  quoted by [MIT]) for the shore and rocks if a builder can reach it.

Builders verify and cite; where sources disagree, pick one, say which and
why.

**Build and particulars.** Fincantieri, Sestri Ponente (Genoa), yard no.
6122; keel laid 8 November 2004 [MIT p.67], launched 2 September 2005,
delivered 30 June 2006 [WPS]. LOA 290.20 m, LBP 247.4 m, beam 35.50 m, depth
14.18 m (to deck 0, the bulkhead deck), 114,147 GT [MIT §2.1, WPS]. Departure
draught 8.12 m even keel [MIT §4.7.2], displacement about 56,600 t [MIT
§4.7.1]. Diesel-electric: six Wärtsilä 12V46C generating sets (three in WTC 6,
three in WTC 7), two 21 MW propulsion electric motors (WTC 5), two shafts,
two fixed-pitch propellers, two rudders, three bow and three stern thrusters
[MIT §2.1, WPS]. Service 19.6 kn, 21.5 kn maximum [MIT, WPS]. About 1,500
cabins, 505 with balconies; 13 passenger decks [WPS]. 26 lifeboats and 69
liferafts [MIT §4.5]. Built to the SOLAS deterministic rules of her keel
date: survives any two neighbouring compartments flooded [MIT §4.7.8]. The
class is built on Carnival's Conquest-class design; the main difference is
the structure around the main pool, glass-sided on both sides [WPC].

**Subdivision** [MIT §4.7.6, table]: watertight compartments (WTC) numbered
from aft; frame spacing 0.725 m in the damaged zone.

| WTC | Frames (max)          | At the side shell | What                                                |
| --- | --------------------- | ----------------- | --------------------------------------------------- |
| 4   | 36–60                 | 44–60             | reefer compressor room (shaft bearings, hydraulics) |
| 5   | 60–76                 | 60–76             | propulsion electric motors (PEM), fire/bilge pumps  |
| 6   | 74–102                | 76–100            | diesel generators 4–6, main switchboard             |
| 7   | 100–126               | 100–116           | diesel generators 1–3                               |
| 8   | (to frame ~140 at DB) | 116–?             | ballast and bilge pumps, evaporators                |
| 3   | aft of 36             |                   | stores; flooded later from deck 0 by stairways      |

The rest (about 19–20 WTCs in all [MIT §4.7.7 names pairs to 18/19]) come
from the general arrangement figures in [MIT] (builder reads the pages),
else are spaced by the floodable-length rule and stated.

**The night of 13 January 2012** (CET, VDR times [MIT §2.4.5, §3]):

| Time          | What                                                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19:18         | Leaves Civitavecchia for Savona; 3,206 passengers, 1,023 crew [MIT §3].                                                                                                                                                                                       |
| 21:39–21:44   | A turn to starboard toward the island, much wider than planned, at 15.4–16 kn, 0.5 nm off the coast [MIT §3] (never shown or named in play).                                                                                                                  |
| 21:45:07      | Her port side, aft, strikes the easternmost rock of Le Scole at 15.5 kn. Speed drops at once to 8.3 kn; she runs on heading about 350° [MIT §3]. A rock about the size of a car stays stuck in her side at frame 52 [MIT §4.7.2 photos; WPD photo].           |
| 21:45:33–48   | Watertight doors ordered closed; the VDR shows them all closed at the contact except two in the laundry, outside the damage [MIT §4.7.3]. At 21:45:46 a crew member opens the main door into the PEM room and water floods WTC 4 through it [SaS keypoint 1]. |
| 21:45:58      | Blackout: generators and engines lost. The emergency generator starts at 21:46:05 but cannot hold the load and runs only in fits; batteries keep emergency lighting [MIT §3, §4.9]. Both rudders stay jammed hard to starboard from 21:46:58 [MIT §4.6].      |
| ~21:48–21:52  | WTC 5 full in about 3 min, WTC 6 in about 7 [MIT §4.7.1]. "The ship lists to the left side" [MIT §3].                                                                                                                                                         |
| 22:11         | Practically stopped (0.3 kn) off Punta Lazzaretto, then drifting, her bow swinging to starboard to head SW under the north-east wind and her jammed rudder [MIT §3]. AIS 22:14: 42°22.1′ N 010°55.32′ E [MIT §2.4.5].                                         |
| 22:10–22:15   | The list goes over from port to starboard [MIT §3].                                                                                                                                                                                                           |
| ~22:25–22:30  | WTC 4 and 7 full (about 40 min); water on deck 0 aft at 22:27; WTC 3 and 8 taking water [MIT §1, §4.7.1]. 10° to starboard 45 min after the contact [MIT §1].                                                                                                 |
| 22:39         | First patrol boat alongside: "visibly down by the stern"; her stern has touched the rocks [MIT §2.4.5, §4.6].                                                                                                                                                 |
| 22:44         | "Resting on the starboard side on the bottom" [MIT §2.4.5]. 15° at 22:46:07; 11° read at 22:48:32; about 18–20° "just before grounded" [MIT §1, §4.5] (the readings disagree; see R11).                                                                       |
| 22:47 / 22:55 | Starboard anchor let go, then the port [MIT §3, §4.6] (she had already stopped).                                                                                                                                                                              |
| 22:54–22:55   | Abandon ship; the first lifeboats go down from the starboard side at 22:55; at 23:10 they head for the harbour [MIT §1, §3]. 23 of 26 lifeboats are used [MIT §2.4.6].                                                                                        |
| 22:58         | "Practically still in its final position": 42°21′50.76″ N 010°55′17.40″ E, Cala del Lazzaretto [MIT §2.4.5].                                                                                                                                                  |
| 23:11         | List 25–30° and more [MIT §3]. 15 min after grounding "more than 30°" [MIT §1].                                                                                                                                                                               |
| ~00:00        | 40° [MIT §1].                                                                                                                                                                                                                                                 |
| 00:41         | "Heeling of the ship reaches 80°" [MIT §4.6 table] (see R11 for the 65° we use).                                                                                                                                                                              |
| 06:17         | Rescue complete: 4,194 saved that night [MIT §1].                                                                                                                                                                                                             |

Weather [MIT §2.3]: wind E-NE 17 kn (18 kn in [SaS]), "rough sea NE 4",
partly cloudy. Depth where she lay: about 27 m [MIT §2.4.5, 04:39], about
20 m [WPD]; the ledge built for her after parbuckling at 30 m [WPP]; a trough
of about 70 m beside her [WPS]; about 100 m where the first anchor was tried
at 22:13–22:17 [MIT §4.6]. She lay starboard side to the seaward face of a
small outcrop, on two rock spurs that deformed her side, on an incline to
deeper water; her starboard side faced the coast, her port side deeper
water; the salvors rotated her 65° to upright [WPP]. Seagrass (Posidonia)
meadows on the seabed around her [WPS: environmental concerns; builder
cites a source].

People aboard 4,229 [MIT]; 32 died [MIT, WPD]. The parent line says so; play
never does.

**The damage** [MIT §4.7.2, §4.7.6]. Deformed shell from 330 mm aft of frame
52 to 413 mm forward of frame 124: 52.9 m. The main breach 35.9 m, frames
52–101; four smaller breaches inside it and one (A) across frame 116, about
1.1 m × 0.05 m, into WTC 8's double bottom. Vertically from the bilge strake
up to about 1 m under the waterline (the blue line); deck 0 not opened.
"Some square metres" of opening into WTCs 4, 5 and 6; WTC 7 through its
ladder space (progressive); the bilge keel torn off from frame 82/83 to 106;
the double bottoms SDB6C, WBDB10C–12C flooded. "At the epilogue the flooding
is, in total, amounting to over 20,000 tons" [MIT §4.7.1]. [MIT]'s own
stability study: with WTC 4–8 flooded she has no range of stability and
capsizes; three neighbouring compartments she survives (GM 0.67–1.19 m), four
are marginal [MIT §4.7.10].

## The sim (what changes, all gated so other ships are untouched)

Reuse first: the iceberg's What-if by compartment, the Lusitania's grounding
while afloat and rest rule, the Britannic's doors, speed profile and turn,
`descentTimeScale`. New format pieces, each optional and `undefined` (so no
change) for every existing ship:

- **`cause: "rocks"`** (appended). The scene, words and What-if read it like
  `"iceberg"` (a scraping strike along one side, the spots are her
  compartments) on her own side. `ShipSpec.gash?: { side, zLow, zHigh,
areaM2 }`: the hole a What-if gives a compartment the real night did not
  tear (the iceberg path's fixed 0.2 m² starboard hole stays the default).
  A short `preRollS` (about 40 s) shows her sailing in, lit, before the
  strike.
- **A seabed that varies with position** (`ShipSpec.seabed?`): earth depth
  from the shore. `shore`: a polyline (earth metres, from [OSM] around the
  island near the track); `profile`: [metres offshore, depth] pairs, linear
  (from the cited depths: the rocks at the shore, the shelf she lay on at
  20–30 m some 50–150 m off, 70 m in the trough beside her, 100 m by the
  anchor point, [EMO] beyond); `rocks`: a few bumps (centre, radius, top
  depth) for the two spurs and the Le Scole islets. `floorAt(seabed, x, y)`
  is pure and shared: the sim's floor, the scene's floor mesh and the
  camera's floor clamp all read it, so the floor on screen is the floor that
  holds her. Missing: the flat floor at `seaDepthM` exactly. The contact
  model is the 1.1 one with `floorZ` looked up per hull point at its earth
  x, y; the contact normal stays vertical (no sway in the model, so a slope
  cannot push her sideways or let her slide: stated as a limit; she did not
  slide in fact). The fall and landing code (`stepFall`, `touch`,
  `sternDown`) reads the floor under the body's lowest point.
- **A scripted drift path** (`headway.path?`): [shown s, earth x, earth y,
  heading°] points from the report's positions and times, smoothed
  (Catmull-Rom on position, shortest-way on heading). Pose and position
  only, a rule, not physics, exactly as the Britannic's turn is: flooding,
  heave, pitch and roll never see it. Her way through the water is the
  path's speed (for the drag-free headway the sim already has); way is lost
  for good at the first floor touch (1.1). Leeway (the wind pushing her
  sideways) is folded into the heading, stated. `SimOptions.toSea` uses
  `headway.pathToSea` instead: the same first 26 minutes, then a drift away
  from the island into deep water (the What if "blown out to sea"). Missing:
  the 1.4 profile/turn or 1.1 decay.
- **External heeling moments** (`ShipSpec.heel?`), physics with cited
  inputs, applied in roll like any moment: `wind: { fromDeg, kn, areaM2,
leverM }` (the beam wind on her side area,
  M = ½ ρ_air C_d A V² cos(β)·|cos β|·h, β the wind's angle off her beam
  from the path's heading, C_d 1.0–1.2 stated) and `rock: { t, massT, x, y,
z }` (the 97 t rock stuck in her side, 10.7 m to port, from 213 s [SaS]).
  These two are what [SaS] applied ("wind, turning, final grounding and the
  rock" [MIT §4.7.9]). A stated `tcg` seed is allowed only if honest physics
  cannot give the starboard list (the Britannic's R21 precedent), reported.
- **Blackout from the water** (`ShipSpec.blackout?: { compartmentId, depthM
}`): `lights-out` when that compartment's water reaches `depthM` (WTC 6,
  the main switchboard; the depth calibrated so it comes at about 51 s),
  replacing the 1.0 dynamo rule for her; pumps stop with it (hers were in
  the flooded rooms [MIT §1 i]). `SimFrame.power` after it is her
  `emergencyLight` level (a constant, about 0.25), not 0: her batteries kept
  emergency lighting, and night photographs show her lit on her side. A
  What-if that leaves WTC 5 and 6 whole keeps her lights and engines: no
  blackout, she keeps her heading and way (steady headway), no drift to the
  island.
- **Aground rest** (`ShipSpec.aground?: { restDeg, minListDeg, at: [[clock
s, deg]...] }`), a rule, not physics, like `wreck`: once a floating body
  has touched the floor and lost its way, and lists at least `minListDeg` to
  her side, its roll follows the report's pace (30° at 23:11, 40° at 00:00,
  `restDeg` 65° by 00:41: R11) from wherever physics left it, never
  decreasing; pitch eases to what the floor contact gives; the body is
  re-seated each step so its lowest hull point stays at the floor depth
  under it (the Lusitania's `seated` rule). Water already aboard stays (the
  X-ray shows it); the free surfaces follow the pose. It logs `aground`
  (a new `SimEventKind`, appended) when it begins and `floating-steady`
  when she reaches `restDeg`; the run then ends with `SimTrack.outcome:
"aground"` (appended: a lost ship that did not go under). Missing: no
  change.
- **Time after grounding** (`ShipSpec.agroundTimeScale?`, 6): once `aground`
  fires, shown time runs that many times faster than real (as
  `descentTimeScale` does under water), so the two hours from grounding to
  rest play in about 20 shown minutes; frames carry `realT` so the clock and
  words stay true. Before it, real time (55 minutes, like the Britannic's
  morning). No `timelineTail`.

**What is physics, what is a rule.** Physics: the gash's inflow by the
orifice law, the door, spill along deck 0 over the bulkhead tops (the
splashtight doors are the weir), free surfaces, the list and trim, the wind
and rock moments, downflooding at the deck edges and the superstructure
boxes, the floor contact while afloat (stern first, down by the stern),
the girder. Rules: the drift path (positions from the report), the blackout
threshold (calibrated to the VDR's 51 s), the roll from grounding to rest
(the report's pace, the salvors' 65°), the emergency lighting level.

**Do the hydrostatics and roll handle 65° and her superstructure?**
Volume is smooth to 90° and a box matches the analytic answers at 60° and 90°
(`hydrostatics.test.ts`); superstructure boxes are buoyant while dry and
fill over their lower edge. That is enough to bring her from upright to
about 20–30° with the floor under her stern, which is all physics must do in
the real run. Her superstructure is most of her height (keel to the top
about 52 m over a 14 m hull), so Task 1 adds a box-on-box test (a 14 m hull
with a 35 m deckhouse box) at 0–90° against the analytic GZ curve, and a
check that the floor contact holds a heeled box resting on a 25 m floor
without creeping. Past grounding the rule owns the roll, so the sim never
has to settle a 65° hull on a rock by physics (no sway, vertical contact
normals and coarse boxes would make that number a tuning accident). In the
"blown out to sea" What-if physics runs all the way: with WTC 4–8 open she
is expected to capsize and sink, as [MIT]'s NAPA study says; her deep-water
landing uses `wreck: { restDeg: 65, minListDeg: 10 }` (stated: no survey;
the same side and angle as the real wreck).

**Her data** (`lib/shipwreck/ships/concordia.ts`): hull stations from her
lines (LBP 247.4, beam 35.5, draught 8.12, a cruise ship's full midbody,
block coefficient about 0.68–0.72 from her displacement: derived and
stated), the hull envelope to deck 3 (the top of the steel side shell under
the lifeboat deck: builder checks the deck heights from [MIT] figures or the
class's deck plans), deck 0 at 14.18 m as every bulkhead's top; the
superstructure as boxes over her length (forward, midships and aft tiers,
stepped as photographs show); about 20 WTCs with 4–8 per [MIT]'s table, WTC
5's bulkhead door to WTC 4 open (`doors`, `kind: "door"`, from 0: [SaS]); the
mooring deck openings aft at deck 1 (`Opening`s high in the stern, both
sides, wet only once immersed: [SaS] keypoint 10); KG for an intact GM in an
honest range (1.5–3 m; unsourced, stated); girder strength from IACS UR S11's
rule bending moments for her size (about 3 GN·m wave hogging) times an
ultimate-strength factor in a stated range, so she does not break (she did
not); `seaDepthM` 30 (the words' depth); `seabed`, `headway.path`,
`pathToSea`, `heel`, `blackout`, `aground`, `agroundTimeScale`, `gash`
(port, bilge strake to 1 m under the waterline, area per metre from the real
gash); `clockStartS: 21*3600 + 45*60 + 7`; 26 lifeboats (13 a side) with
`boat-lowered` from 22:55 starboard, then port, three port boats never
lowered (R19); one funnel (`falls: false`). Real damage (`realNight`): the
gash as openings per compartment along frames 52–124, opening forward first
over about 7 s (the rock running aft along her side at about 8 m/s:
`Opening.t`), plus the small tear A into WTC 8, areas calibrated (below).

Earth frame: origin at her midships at the strike, x along her heading then
(about 350°). The path, shore and rocks are in that frame (converted once
from latitude and longitude in the data file, documented).

**Pass criteria (real night, enforced by tests):**

- `collision` at t = 0; WTC 5 full (≥ 95% of its volume below deck 0)
  between 2 and 6 min, WTC 6 between 4 and 12 min, WTC 4 and 7 between 30
  and 50 min (real ~3, ~7, ~40);
- `lights-out` between 30 and 90 s (real 51 s); power after it equals her
  emergency level, never 0;
- a small list to port first (port, ≤ 5°, sometime in the first 20 min),
  then to starboard by 22:20 (t = 35 min) and never back to port after;
  10° ± 4 to starboard at 22:30 (45 min); 12°–25° when the floor is first
  touched;
- down by the stern from 10 min on;
- the first floor touch is aft of midships (`stern-lands`, afloat) between
  48 and 62 min (real 22:39 = 54 min), at a point whose floor depth is
  between 12 and 35 m;
- `aground` fires; at rest `listDeg` 65 ± 2 to starboard, her lowest hull
  point 20–32 m down, her whole port side shell and at least a third of
  her superstructure above the sea, her heading 180°–220°, her position
  within 150 m of the report's 22:58 fix; rest reached (shown) within 25
  min after `aground`; real time at rest 00:30–01:00;
- no `breakup`, no `stern-under`; outcome `aground`;
- deterministic; finite poses; the run ends inside `endT`.

**What if (multi-select, like the Titanic's).** Spots are her watertight
compartments along her port side (picture: the rock's tear), more than one
allowed; real = WTC 4, 5, 6, 7, 8 (the real gash bundles tear A). One toggle
with a picture button, off = the real night:

- **Blown out to sea** (picture: wind arrow away from the island; default
  off). On: the `pathToSea` drift into deep water.

Expected (tests): any one or two neighbouring spots → floats (`floated`,
"She stayed afloat.") [built for two]; three neighbouring spots (4–6, 5–7,
6–8) → floats [MIT §4.7.10]; the real five → aground (real) or, blown out to
sea, capsizes and sinks (`sank`) [MIT: DS04-08 capsizes]; no spots → no
strike, "She sailed safely past the island." (`floated`); a What-if that
keeps WTC 5 and 6 whole keeps her lights and engines and sails on. Every run
ends inside `endT` with an outcome and finite poses. If honest physics
disagrees with an expectation, the builder stops and reports numbers (the
Britannic rule: honest physics beats a test band; the controller widens it
and the README says why). No parameter leaves its stated range to pass.

## Look and scene

- **Model** `components/shipwreck/model/concordiaRecipe.ts`, a new recipe
  (the liners' parts — portholes, boats, davits, rails — reused through
  `partGeometry.ts` where they fit; a cruise ship's own parts added:
  balcony rows, window bands, glass, the funnel shape, the slide). Every
  visible feature sourced from [WC] photographs of her (her sisters only
  where hers are missing, stated, as they differ):
  - hull white, the blue boot-top line at the waterline ("blue stripe"
    [MIT §4.7.2]), dark red antifouling below; "COSTA CONCORDIA" on each
    bow and the stern;
  - the superstructure: cabin windows on the lower decks, balcony rows
    (glass fronts, partitions) for most of her length on the upper decks,
    the stepped aft terraces, the long open deck 9–11 with the pool and its
    glass roof (sliding "magrodome") and glass sides [WPC], the spa forward
    on the top decks with its big curved windows [WPS: Samsara Spa], the
    sports deck, the water slide near the funnel (verify colour and shape),
    the bridge with its two wings across her full beam (verify deck);
  - 26 lifeboats (orange: verify) in recesses along deck 3/4 under the
    promenade, 13 a side, with their davits; liferaft canisters;
  - one funnel aft: yellow with the blue "C" on each side [Costa's livery
    since the 1940s: cited], its top and exhausts as photographed;
  - masts (radar and signal masts over the bridge), bow thruster tunnels,
    two propellers, two rudders, stabiliser fins if photographs show them,
    the rock stuck at frame 52 on the port side from the strike on (the
    famous photograph).
    Budget: balconies, windows and lit panes as textures on merged panels
    (one draw per material), boats and davits instanced, the slide a single
    tube mesh; at `high` ≤ 100 calls, ≤ 330k triangles; low tiers drop the
    rails and glass first. Other ships' recipe snapshots deep-equal.
- **Liveries (paint box, 1.7 rule).** One real livery, `costa-2012`
  (default): white hull and superstructure, blue waterline, red bottom,
  yellow funnel with the blue "C" (`funnelPaint` = the yellow, `top` = the
  cap colour photographs show). Fun paints: a new `cruiseFun()` in
  `funPaints.ts` (her kind is a modern cruise ship, not a 1912 liner), at
  least five believable looks real cruise ships wore, generic labels, no
  current company names: "Navy blue hull", "Black hull, red funnel", "Dark
  blue hull, white funnel", "White hull, blue funnel", "White hull, red
  funnel", "Green hull" (pick five or six that pass the saturation cap,
  `vivid < 0.65`). Fun paints change the hull (to deck 3), bottom, boot-top,
  funnel and its top, and the boats; the superstructure stays white (stated).
  The "C" shows only in her real paint. `liveries.test.ts` lists her real id;
  its other checks (≥ 5 fun, no copy of hers, saturation) cover her.
- **Scene settings** `concordia`: `timeOfDay: "night"` (the Titanic's night
  look with its own values), stars, partly cloudy (a thin cloud layer if
  cheap), the moon as it really stood at 42.36° N 10.92° E on 13 January
  2012 21:45–00:45 CET (builder computes and cites; a waning gibbous rising
  in the east-south-east is expected: if up, it lights the sea to the east,
  away from the island), a light north-east chop on the sea shader (still
  water for the physics: no storm field), `coast: true` with **Giglio**:
  the east coast from Punta Lazzaretto to past Giglio Porto as a low-poly
  granite island with macchia-dark slopes (heights from [EMO]/SRTM, drawn
  true), Giglio Porto's houses as lit windows climbing the hill, the two
  harbour moles with their red and green lights, the lighthouse on the mole
  (verify which light and its character), Giglio Castello's lights on the
  ridge, the Le Scole rocks just south. Under water: the `floorAt` mesh
  (granite and sand shading, seagrass patches as instanced cards), dark
  blue-black night water with her emergency lights glowing in it. The coast
  is a per-ship module like Kea's (`Coast.tsx` grows a third coastline).
- **Her lights.** All windows and decks lit until `lights-out`, then a short
  flicker and her emergency level: a sparse, fixed pattern of lit windows,
  corridor and deck lights (a mask texture), as night photographs show. A
  searchlight-free scene (no boats' lights beyond her own lifeboats' small
  lamps).
- **Effects**: the strike (a short white rush of water and spray along her
  port side aft; no rock explosion), the stuck rock, her wake fading as she
  slows, lifeboats lowering from the starboard side and motoring to the
  harbour (no people).
- **Camera**: never below `floorAt`, never inside the island's terrain,
  never inside her hull lying at 65° (her hull boxes for the camera clamp
  in `cameraMath.ts`, as the Britannic's); her shots: the lit ship
  passing the island, the strike from the port quarter, the drift with the
  harbour behind, her on her side with the harbour lights.

## Walk the decks

Later (MVP). `walkMapFor("concordia")` returns null, so her Walk button
stays hidden.

## UI, words, analytics

- **Title screen**: her card after the Britannic (`SHIP_IDS` order
  titanic, lusitania, fitzgerald, carpathia, britannic, concordia). Card
  name "Costa Concordia", year 2012, her little side picture (white, yellow
  funnel).
- **Words** (story captions, `sinceText` "12 min after the rocks", places,
  help, end card): calm and factual, never naming the captain, the "salute"
  or blame. Her course is "close to the island". Captions for: sailing in
  lit up; the strike ("She scrapes rocks! A long tear opens in her left
  side."); the blackout ("Her lights go out. Her engines and rudder stop.");
  emergency lights; WTC 5/6 full; drifting and turning back to the island;
  the list growing to the right (starboard); down by the stern; the stern
  touching the rocks; lifeboats going down; her rest ("She lies on her side
  on the rocks, half out of the water, right by the harbour."). Places: the
  bridge, the rock in her side, the electric motor room (WTC 5), the
  generator rooms (WTC 6/7), a lifeboat, the funnel, the pool under its
  glass roof.
- **End card**: real night "She came to rest on her side by Giglio's
  harbour at 12:41 AM, 3 hours after the rocks." (the builder makes the time
  read right); What-ifs "She stayed afloat.", "She sailed safely past the
  island.", "Blown out to sea, she rolled over and sank."
- **Parent line** (exact copy): "This is the Costa Concordia, a cruise ship,
  in January 2012. At night she sailed too close to the island of Giglio,
  struck rocks and rolled onto her side beside the harbour. Most of the
  4,229 people aboard were rescued, but 32 people died. This game shows only
  the ship."
- **Save**: `whatIfByShip.concordia` with `{ ids, toSea? }` (optional, no
  reset, no new key); `SAVE_SHIP_IDS` appends `concordia`; `OUTCOME_IDS`
  appends `aground` (old saves parse; unknown endings still fall back).
  Tests that use `"concordia"` as an unknown ship id switch to
  `"andrea-doria"`.
- **Analytics** (data boundary: spec review + adversarial review): the
  closed `ship` enum gains `concordia` in `lib/analytics/gameEvents.ts`
  (`SHIPWRECK_SHIPS`), both `p.ship in [...]` lists in `firestore.rules`,
  `firestore-tests/gameEvents.test.ts`, `lib/analytics/gameAggregate.ts`
  and the admin Games tab, together. No new props: `trackEnd` already maps
  every outcome but `floated` to `sank`, so `aground` sends `sank` (the
  outcome enum and its rule do not change; a test pins it). The What-if
  toggle is not counted. `npm run test:rules` must pass.

## Non-goals

People; the passengers' and crew's night; the captain, the bridge team or
the "salute"; the rescue boats, helicopters and the islanders; the 2013
parbuckling and the 2014 refloat; walk-in interiors beyond the X-ray
blockouts; the departure from Civitavecchia.

## Anti-goals (fail even if it technically works)

- A generic white cruise ship: no yellow funnel with the blue "C", wrong
  lifeboat count, wrong length or one funnel too many.
- A canned list or grounding pretending to be physics, or a rule not named
  as a rule in the README.
- The ship floating at 65° in mid-water, a floor on screen that is not the
  floor that holds her, or the camera or her hull inside the island.
- Any other ship's track, look, words or performance changing.
- Anything in play that blames anyone or counts the dead.

## Rulings Gentry may revisit

- **R1 Ship id `concordia`**, "Costa Concordia" on the card and end card,
  "the Concordia" in words.
- **R2 Scope**: the wreck night only, from about 40 s before the strike to
  her rest on her side; parbuckling and refloat are Later.
- **R3 Particulars**: LBP 247.4 m, LOA 290.2 m, beam 35.5 m, deck 0 at
  14.18 m, draught 8.12 m even keel, about 56,600 t [MIT]; KG set for an
  intact GM of 1.5–3 m (unsourced, stated).
- **R4 Subdivision**: WTC 4–8 from [MIT]'s table; the rest from [MIT]'s
  general arrangement figures, else spaced by the floodable-length rule.
- **R5 The gash**: frames 52–124, forward first over about 7 s, bilge strake
  to 1 m under the waterline, plus tear A into WTC 8; areas calibrated to
  the report's fill times.
- **R6 Doors**: all closed except the door into the PEM room (WTC 5 → 4)
  opened at 21:45:46 [SaS]; no doors toggle (the report found them closed).
- **R7 Blackout from the water** in WTC 6 (calibrated to 51 s); emergency
  lights stay on to the end at a fixed dim level, as night photographs show.
- **R8 The drift path is a rule**: positions and headings from the report's
  VDR/AIS times, leeway folded into the heading; physics never sees it.
- **R9 Seabed**: depth by distance offshore from a traced shoreline, two
  rock spurs and Le Scole, depths from [MIT], [WPD], [WPP], [EMO];
  vertical contact normals (no sideways push or slide: stated limit).
- **R10 Heel moments**: the beam wind (17 kn NE) and the 97 t rock as [SaS]
  applied them; a `tcg` seed only if physics cannot list her to starboard,
  reported.
- **R11 Her rest at 65°**, the salvors' rotation to upright [WPP], over
  Wikipedia's ~70° and the report's 80°; the roll from grounding to rest is
  the `aground` rule on the report's pace (30° 23:11, 40° 00:00, rest by
  00:41). The heel readings near grounding disagree (11°–20°): physics may
  land anywhere in 12°–25°.
- **R12 Rest heading about 200°**: bow toward Giglio Porto, starboard side to
  the island, port side to deep water [WPP diagrams, MIT positions].
- **R13 Time**: real time to grounding (about 55 min), then ×6 to rest;
  the clock always shows real time.
- **R14 Outcome `aground`** (new) for the real night; analytics sends it as
  `sank` (she was a total loss) so the rules' outcome enum stays as it is.
- **R15 What if**: her port-side compartments (multi-select) plus one toggle,
  "Blown out to sea"; no spots means she misses the rocks. No doors, power
  or anchors toggles (each changes little or nothing honest).
- **R16 Blown out to sea** is a counterfactual drift (the real wind blew her
  toward the island); its result is physics (expected: capsizes and sinks);
  in deep water she lands on her starboard side at 65° (a rule; no survey).
- **R17 Cause `"rocks"`** reuses the iceberg's What-if, on her port side,
  with her own gash size for compartments the real night did not tear.
- **R18 Liveries**: one real (`costa-2012`); fun paints from a new cruise set
  with generic labels (no current company names); fun paints recolour the
  hull, funnel and boats, never the white superstructure; the "C" only in
  her real paint.
- **R19 Lifeboats**: 26, starboard ones lowered from 22:55, then port; three
  port boats never lowered (23 of 26 used [MIT]); no people in them.
- **R20 Words**: her course is "close to the island"; no captain, no
  "salute", no blame, no deaths in play. The parent line says "sailed too
  close" and "32 people died", once.
- **R21 The rock stays in her side** from the strike on (a well-known
  photograph; no people in it).
- **R22 Sound and Walk** are Later; she uses the shared night bed and the
  iceberg's scrape for the strike (checked to sound like rock, not ice;
  else silence).
- **R23 Weather**: partly cloudy, NE wind 17 kn as a light chop drawn, still
  water in the physics (the report's "rough sea" was force 4 at most).
- **R24 Girder**: IACS UR S11 moments times a stated ultimate factor; she
  does not break.
- **R25 Version**: 1.9.0 if main is still at 1.8.0 when the release task
  runs; else the next free minor.

## Later

- **The parbuckling (16–17 September 2013)**: the sponsons, the underwater
  platforms, her rotation 65° to upright over 19 hours, the stained side.
  Then **the refloat (July 2014)** and the tow to Genoa. A later release.
- **Her own sounds**: a night bed with the island close (water on rocks, a
  harbour), the long scrape and the rock, engines and air handling dying at
  the blackout, the anchors' chains. No voices.
- **Walk the decks on her**: deck 4's promenade with the lifeboats, the pool
  deck under its roof, the sports deck; a cruise ship's walk map.
- **The anchors** dropped at 22:47 and 22:55 shown on the bow.
- **Sliding on the slope**: a contact with a real slope normal and sway, if
  the sim ever gains sway.
- The follow-up list (minor review findings) in the ledger.

## Draft changelog entry (1.9.0)

"**The Costa Concordia.** A giant modern cruise ship joins the game: white,
with rows of balconies, orange lifeboats and a big yellow funnel with a blue
C. One January night she sailed close past the island of Giglio and scraped
rocks that tore a long hole in her side. Watch her lights go out, see her
drift back to the island, lean over and come to rest on her side on the
rocks right beside the harbour, half out of the water. Then try What if:
tear fewer rooms and see her float, or let the wind blow her out to sea.
Pick paint for her in the paint box too."
