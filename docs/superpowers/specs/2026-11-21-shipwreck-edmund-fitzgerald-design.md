# Shipwreck 1.3 — the Edmund Fitzgerald

Third ship for `/shipwreck`: SS Edmund Fitzgerald, the Great Lakes ore
carrier lost with all hands in a November storm on Lake Superior on
10 November 1975, about 17 miles from shelter in Whitefish Bay. Builds on
the 1.0 spec (`2026-11-20-shipwreck-design.md`) and the 1.1 spec
(`2026-11-21-shipwreck-lusitania-design.md`), which still hold for
everything this document does not change.

## Why

Gentry's son (iPad mini 6) wants a realistic sinking he can "zoom in and fly
around", "go inside certain places, see things as it sinks". The title
screen promises the Edmund Fitzgerald as "Coming soon". Gentry said to dive
in, so the calls below are ours; he may revisit any of them.

She is a very different wreck from the two liners, and that difference is
the point: no hole at the start, a storm that slowly beats her down over
hours, then a sudden end so fast that no call for help was made.

## North-star goals (every builder re-reads these)

1. **The storm sinks her, from physics, not a script.** The waves you see
   are the waves that flood her: one deterministic storm wave field drives
   both the water shipped over her low deck and the sea drawn on screen.
   Topside damage and leaking hatch covers let it in; she settles and lists
   over hours; then the bow goes under a big sea and she dives. Her bow hits
   the bottom (162 m, shorter than she is long) as her stern goes under,
   the hull breaks, and the stern lands upside down. Tuning stays inside
   honest ranges; every assumption is documented in the sim README.
2. **It looks as good as the Titanic and the Lusitania and still runs at
   60 fps on an iPad mini 6.** The 1.0 budgets apply (≤ 160 draw calls,
   ≤ 450k triangles at the top tier, no frame blocked > 8 ms). Storm waves,
   spray and snow are tiered like the Lusitania's smoke.
3. **It is a storm, not a reskinned night or afternoon.** Grey late
   afternoon light fading to black night, huge grey-green waves rolling in
   from astern, spray and green water sweeping her deck, snow squalls, her
   deck and cabin lights glowing, a dark Whitefish Point light far ahead,
   the Arthur M. Anderson's lights far astern when the snow lifts. Under the
   surface: cold, dark fresh water and a grey clay floor.
4. **The Titanic and the Lusitania do not regress.** Every 1.0 and 1.1 test
   and scenario passes unchanged; both real runs give the same track as
   before (golden fixtures for both).
5. **Kind to a young player.** The 1.0 rule holds: no people shown, no death
   counts in play, no screams, no voices. A parent line tells the adults.
   This is a recent loss with living families: no blame, no dwelling on the
   last moments, no use of the famous song.

## History the sim and scene aim at

(Builders verify and cite sources in the sim and model READMEs: the USCG
Marine Board report (1977), the NTSB report (1978), NOAA's 2005 storm
hindcast, the Great Lakes Shipwreck Historical Society, Thompson's and
Stonehouse's books. Correct this list where a source disagrees.)

- Built 1958 by Great Lakes Engineering Works, River Rouge, Michigan, for
  Northwestern Mutual; run by Oglebay Norton's Columbia Transportation
  fleet. The largest ship on the Lakes when launched.
- LOA 729 ft (222.2 m), beam 75 ft (22.9 m), moulded depth 39 ft
  (11.9 m). Straight-sided laker: a long box hull, raked bow, round stern.
  Forward: forecastle with crew cabins, the pilothouse on top, a mast.
  Spar deck: 21 hatches (about 11 × 48 ft), each with a one-piece steel
  hatch cover held by Kestner clamps, a travelling hatch crane on rails,
  ballast-tank vents along the deck edges, wire "fence" rails. Aft: a
  deckhouse over the engine room (steam turbine, one propeller, one
  rudder), one funnel, two lifeboats and life rafts.
- Inside: three cargo holds joined by non-watertight screen bulkheads, a
  double bottom and side ballast tanks along the holds, a tunnel each side.
- Last voyage: loaded 26,116 long tons of taconite pellets at Superior,
  Wisconsin, 9 November 1975; draught about 27 ft 2 in forward, 27 ft 6 in
  aft. Her load line had been raised in the years before, so she rode with
  little freeboard (about 11–12 ft).
- 10 November, Eastern time. About 3:30 PM, after passing near Caribou
  Island and Six Fathom Shoal, Captain McSorley radioed the Arthur M.
  Anderson that a fence rail was down, two vents were lost or damaged, she
  had a list, and she was slowing to let the Anderson close. About 4:10 PM
  both radars were lost. Whitefish Point's light and radio beacon were out
  for part of the evening. About 5:30 PM she reported a bad list, heavy seas
  over the deck. Both pumps were running. At 7:10 PM her last message:
  "We are holding our own." Within minutes she vanished from the Anderson's
  radar, about 17 miles from Whitefish Point.
- Storm: north-west winds 50 knots gusting higher, waves about 25 ft
  (NOAA's hindcast puts the significant height near 7.6 m around the time
  she sank, with occasional larger waves). The Anderson reported very large
  seas overtaking from astern ("three sisters" in later accounts) shortly
  before she was lost. Snow squalls; dark from about 5:30 PM.
- Wreck at about 530 ft (162 m), in Canadian waters: the bow section
  (about 276 ft) upright, buried deep in the clay; the stern section (about
  253 ft) upside down about 170 ft away; the middle of the ship broken up
  between them with taconite spread around.
- Causes argued: hatch covers leaking and boarding seas flooding the hold
  (USCG), grounding on Six Fathom Shoal (Lake Carriers' Association), huge
  waves, structural failure. Our real run is the sim's best reconstruction
  of all the reported damage together (topside damage, leaking hatch
  covers, a graze on Six Fathom Shoal) in the storm: the sim found that
  topside damage alone leaves her level with little water aboard, while the
  shoal graze gives the reported list (about 5° by 5:30 PM) and she goes at
  about 7:13 PM; in still water she floats, so the storm still sinks her.
  What if lets you switch each cause off. The words say experts still
  argue, and never blame anyone.
- 29 crew died. The parent line says so; play never does.

## Calls made without asking (Gentry may revisit)

- **Ship id `fitzgerald`**, shown as "Edmund Fitzgerald" (title card) and
  "the Fitzgerald" in words.
- **The real run starts at 3:30 PM**, with the vents and fence rail already
  gone and the list beginning (the first report), and lasts to about
  7:15 PM: about 3 h 45 min of play at ×1, so the speed controls matter.
- **The storm is data, like the iceberg's holes.** A deterministic wave
  field (fixed spectrum, fixed phases) with significant height from NOAA's
  hindcast and one group of three big waves reaching her shortly after
  7:10 PM. The sim and the sea shader read the same field.
- **The hatch covers fail by a rule**: a cover lets go when the green water
  over it passes a stated head (documented in the README as an assumption).
- **The stern rolls over and lands upside down by a rule**, like the
  Lusitania's rest on her side, gated on `ShipSpec.wreck`.
- **The ship rides the waves on screen** (heave, pitch, roll from the same
  wave field, added to the sim's pose as a documented visual layer, faded
  out as she goes under). The flooding and the sinking stay physics.
- **Her last message is shown as a caption**, with no words about what
  happened next: "7:10 PM. Her captain radios the Anderson: 'We are
  holding our own.'"
- **No Gordon Lightfoot song**, no lyrics, no title references to it.
- **What if is multi-select for every ship** (Gentry, 2026-11-21): tap
  one or more spots on any ship. The Lusitania can take more than one
  torpedo (1.1 allowed one). The Fitzgerald's spots are her hatches (which
  covers leak), the broken vents, and strips of Six Fathom Shoal under her
  forward tanks; the storm (real, calmer, worse) is a separate setting.
  If she is still afloat when she would reach Whitefish Bay, the run ends
  with her in shelter: "She made it to Whitefish Bay." (outcome `floated`).
- **Release**: Shipwreck 1.3.0 (minor; 1.2.0 is "Walk the decks", which ships first; no Walk on the Fitzgerald), with a changelog entry in plain
  words. Titanic stays the default ship; Britannic stays "Coming soon".
- **Analytics**: the closed `ship` enum gains `fitzgerald`; schema, rules
  and dashboard change together.

## Non-goals

- People, a model of the Anderson beyond distant lights, a radio voice,
  the song, blame.
- Walk-in interiors beyond the X-ray blockouts (still the long-term goal).
- Britannic (stays "Coming soon").

## Anti-goals (fail even if it technically works)

- A canned dive pretending to be physics, or waves on screen that have
  nothing to do with the water that floods her.
- The Titanic's or the Lusitania's track, look or performance changing.
- A storm that looks like the Titanic's calm night with grey fog.
- A frame rate that falls apart in the storm on an iPad mini 6.
