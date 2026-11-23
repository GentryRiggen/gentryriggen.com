# Shipwreck — the Carpathia

A fourth playable ship for `/shipwreck`: RMS Carpathia, the Cunard liner that
rescued the Titanic's survivors in April 1912, torpedoed by U-55 in the
Atlantic west of Fastnet on the morning of 17 July 1918. Builds on the 1.0
spec (`2026-11-20-shipwreck-design.md`), the Lusitania spec
(`2026-11-21-shipwreck-lusitania-design.md`), the Fitzgerald spec
(`2026-11-21-shipwreck-edmund-fitzgerald-design.md`) and Walk the decks
(`2026-11-21-shipwreck-walk-design.md`), which still hold for everything
this document does not change.

Built in parallel with HMHS Britannic (a sibling branch). Britannic ships
first on her own (1.4.0); the parent releases the Carpathia with the paint
toggle for every ship as 1.5.0: this branch does **not** bump
`SHIPWRECK_VERSION` or edit `lib/shipwreck/changelog.ts`; a draft
changelog entry is at the end of this document.

## Why

Gentry's son (iPad mini 6) wants a realistic sinking he can "zoom in and fly
around", "go inside certain places, see things as it sinks". "Realism can
be really good in place of high fidelity." He knows the Titanic story, so
the Carpathia is the ship he has already met as the rescuer: her own loss
six years later is a new story with a familiar name. Gentry said to dive in,
so the calls below are ours; he may revisit any of them.

She is a slow wreck, unlike the Lusitania's 18 minutes: two torpedoes at
once, a ship settling by the head with a slight list to port, an orderly
abandonment into boats, a long wait, then a third torpedo and the end.

## North-star goals (every builder re-reads these)

1. **She sinks the way she really did, from physics, not a script.** Two
   torpedoes into her port side seconds apart (forward boiler room / No. 3
   hold, and the engine room), a slow settle by the head with a slight
   port list, still afloat when the third torpedo strikes aft about 1 h
   35 min later, then gone within minutes. She lands upright on a 150 m
   floor. Tuning stays inside honest ranges; every assumption is
   documented in the sim README.
2. **She looks right.** He notices wrong features. One tall funnel, four
   masts with derricks, a long midships house between two well decks, a
   forecastle and an open after deck with a deckhouse, her lifeboats under davits, her 1918 dazzle
   paint. Every visible feature is sourced and cited in the model README.
3. **It is a different morning, not a reskinned afternoon.** Open
   Atlantic, no coast, a summer morning sun in the east, a deeper blue
   sea with a long swell, her convoy's other ships scattering on the
   horizon, a darker, bluer underwater on the way down to 150 m.
4. **It runs on an iPad mini 6.** The 1.0 budgets apply (≤ 160 draw calls,
   ≤ 450k triangles at the top tier, no frame blocked > 8 ms; her model at
   `high` ≤ 90 draw calls, ≤ 300k triangles). `e2e/perf-budget.json` gains
   her scenes only; no other entry moves.
5. **The other ships do not regress.** The Titanic, Lusitania and
   Fitzgerald goldens pass unchanged after every task; their recipes,
   settings and budgets are unchanged.
6. **Kind to a young player.** No people shown, no death counts in play,
   no screams, no voices. No U-boat model. Five crew died: the parent line
   says so; play never does.

## History the sim and scene aim at (with sources and disagreements)

Builders verify, cite in the sim/model READMEs and correct this list where
a better source disagrees.

### The ship

- Cunard, built by C. S. Swan & Hunter, Wallsend; launched 6 August 1902,
  maiden voyage 5 May 1903 (titanicinquiry.org; Graces Guide quoting _The
  Engineer_, 8 Aug 1902).
- **Length 558 ft overall** (170.1 m; _The Engineer_ 1902 via Graces Guide,
  Wikipedia), **540 ft registered** (164.6 m; titanicinquiry.org,
  chriscunard.com: the "540 ft" figures are the registered length, not
  LOA). **Beam 64 ft 3 in at launch** (_The Engineer_) / 64 ft 6 in
  (Wikipedia, chriscunard): we use 64.5 ft (19.66 m). Depth: "37.4 ft"
  (titanicinquiry, "Draft (or Depth)": read by the sim README as depth of hold; it uses a moulded depth of 41 ft from Maritimequest, with reasons). Load
  draught 34 ft 7 in (10.54 m, Wikipedia). GRT 13,555 as built, later
  13,603 (cunardshipwrecks.com).
- Two quadruple-expansion engines, twin screws (two three-bladed:
  thegreatoceanliners.com); seven single-ended boilers (Wikipedia); 14 kn
  service, about 15.5 kn trial.
- "Four complete steel decks", an orlop in holds 1 and 2, a 290 ft bridge
  deck and a boat deck above it (_The Engineer_ 1902). "Steel hull; one
  funnel, four masts; twin screws; 3 decks, 8 bulkheads"
  (titanicinquiry.org): **eight bulkheads, nine compartments** (forepeak,
  holds 1–3, boiler room, engine room, holds 4–5, after peak/tunnel; the
  data builder confirms against her general arrangement).
- Funnel (peacetime): Cunard red, black top, three narrow black rings
  (titanicinquiry.org). Four masts fitted with cargo cranes/derricks
  (Wikipedia).
- 20 lifeboats in 1912 (Wikipedia); 11 boats lowered in 1918, two wrecked
  by the explosion (thegreatoceanliners.com). Her 1918 boat count and
  davit layout come from photographs; the model builder cites them.

### Her paint in July 1918

- Wikipedia: "Sometime prior to March 1918, the entire ship was painted in
  wartime dazzle camouflage", citing the IWM film _The Way of a Ship on the
  Sea_ (IWM 552, March 1918), whose catalogue record tags "Carpathia"; and
  "her long-faded red Cunard funnel was apparently painted battle grey".
  Metalship repeats it. No photograph of her dazzle pattern was found.
- **Ruling:** she wears dazzle with a grey funnel. The pattern itself is
  ours, in the style of 1918 British merchant dazzle (black, white, greys,
  a blue-grey), since her own scheme is undocumented. The model README
  says so. A one-line paint switch keeps `"grey"` (plain battle grey) and
  `"cunard"` (1912: black hull, white house, red/black funnel).

### 17 July 1918

- Left Liverpool 15 July (Wikipedia; uboat.net says 16 July, convoy OL 24)
  for Boston, in ballast (uboat.net), 57 passengers and 166 crew
  (Wikipedia; other sources 218 crew in the boats: we name no count in
  play).
- The escort left early on 17 July and the convoy split; she was commodore
  ship of the remaining seven (thegreatoceanliners.com, Wikipedia).
- **9:15 AM**, first torpedo, **port side** (Wikipedia; GOL: the track was
  seen "bearing down on the ship's port side"; she put the helm over and
  the port engine full astern, too late).
  - Where: Wikipedia "near the No. 3 hatch"; GOL "between the No. 4 hold
    and the stoke hold below the bridge". **Ruling:** the forward end of
    the boiler room at its bulkhead with No. 3 hold (Wikipedia's hatch
    number, GOL's stokehold), both spaces opened. GOL's "No. 4" is noted as
    a disagreement (No. 4 lies aft of the engine room on our reading).
- **Seconds later**, second torpedo into the **engine room** (GOL "just
  seconds later"; Wikipedia), engines disabled, wireless and two boats
  wrecked; five crew in the engine spaces killed (three firemen and two
  trimmers, or two and three: sources differ; GOL "five firemen").
- She settled "at the head with a slight list to port" (GOL; Wikipedia:
  "settled by the head and listed to port"). Abandon ship; 11 boats; rockets
  fired to call patrol vessels and flags to the convoy, which scattered at
  full speed (GOL).
- **Third torpedo** "an hour later" than the abandonment, after U-55
  surfaced, about **No. 5 hatch** (GOL) / "near the gunners' rooms"
  (Wikipedia: aft, where her gun crew lived).
- **Sinking**: 11:00 AM (Wikipedia, with HMS Snowdrop's recorded position)
  vs "ten minutes" after the third torpedo and "some two and a half hours"
  after the first (GOL, about 11:45) vs "12:40" (Encyclopedia Titanica,
  read as PM). **Ruling:** third torpedo 10:50 AM, sinking about 11:00 AM
  (Wikipedia's time with GOL's ten minutes); the sim's pass window is
  10:55 AM–11:50 AM so either source's time passes.
- HMS Snowdrop drove the U-boat off and picked up the boats about 1 PM
  (GOL, Wikipedia). Survivors landed at Liverpool 18 July.
- **Position** (sources disagree): 49°25′ N 10°25′ W (Snowdrop, Wikipedia);
  50°25′ N 10°49′ W, "170 miles WxN of Bishop Rock" (uboat.net); the wreck
  at 49°30.03′ N 10°43.04′ W (cunardshipwrecks.com dive data); GOL's
  "49.28 N 19.46 W" (a typo for 10°46′). **Ruling:** the scene sits at the
  wreck's surveyed position (divers found her there); the others are
  listed in the README.
- Ship's time: **ruling** 9:15 AM is British Summer Time (GMT+1, in force
  in 1918) for the sun; the README gives the sun's place for GMT too.
- **The one photograph of her sinking** ("R.m.s carpathia Sinking.jpg",
  Wikimedia Commons, public domain, author unknown; reproduced by Osprey
  Publishing's blog, 17 July 2016), taken from low on a vessel's deck with a
  rail in the foreground (very likely U-55's own deck): she is going down
  **bow first**, the forward part already under (only a mast top shows),
  the funnel low in the water, the two after masts upright and the **stern
  raised** clear of the sea, with no visible list. Sky of broken grey cloud,
  a moderate sea with small whitecaps.
- Weather: no written source; the photograph shows broken cloud and a
  moderate sea with whitecaps. **Ruling:** a cloudy-bright summer morning,
  a fresh breeze, a moderate sea (visual only: the sim's water is calm).

### The wreck

- Found by NUMA (Clive Cussler's team, Mike Fletcher) and announced in
  2000 (Wikipedia; a 1999 Argosy/NUMA find in 600 ft turned out to be the
  liner _Isis_). Upright (Wikipedia, NUMA, GOL: "sitting upright").
- Depth: about 500 ft / 150 m (Wikipedia, ET), 514 ft (GOL), "150m
  (492ft)" with the stern the shallowest part at 143 m (cunardshipwrecks).
  **Ruling:** `seaDepthM: 150`.
- Condition (cunardshipwrecks): the bow "very flat with just the winches
  standing off the sea bed", midships "nearly 10m off the sea bed", the
  stern "perfectly intact with a list to port". **Ruling:** she rests
  upright with a few degrees of port list (a `wreck` rule); the bow's later
  collapse is not modelled.

## Approaches

1. **Generalise the torpedo What-if per ship (chosen).** Today
   `torpedoOpenings` moves the Lusitania's real hit along her starboard
   side and lands several hits aft-first, 3 s apart. Add a per-ship
   torpedo description (side, the hole one torpedo makes, hit order and
   stagger, an optional later "finishing" torpedo as its own spot), with
   the Lusitania's values defaulting to today's behaviour so her golden
   holds. The Carpathia's `realNight` is built from the same function, so
   her real ids give exactly her real run.
2. Carpathia-only code paths (`if (spec.id === "carpathia")`) in run.ts,
   Torpedo.tsx and the editor. Faster to write, but leaves the next
   torpedo ship (Britannic's mine is a sibling; future ships) with a
   tangle. Rejected.
3. A scripted settle. Violates north star 1. Rejected.

## Rulings Gentry may revisit

- **R1 Ship id `carpathia`**, shown as "Carpathia"; title card order
  titanic, lusitania, fitzgerald, carpathia (Britannic's card is the
  sibling's).
- **R2 Dazzle paint with a grey funnel**, the pattern ours (her own is
  undocumented); paint switch keeps grey and 1912 Cunard looks.
- **R3 First hit** at the boiler room / No. 3 hold bulkhead (Wikipedia's
  "No. 3 hatch" + GOL's "stoke hold below the bridge"; GOL's "No. 4 hold"
  set aside).
- **R4 Second hit 8 s after the first** ("just seconds later").
- **R5 Third torpedo at 10:50 AM at No. 5 hold, sinking about 11:00 AM**
  (Wikipedia/Snowdrop), pass window to 11:50 AM (GOL's 2½ h).
- **R6 Scene at the wreck's surveyed position**; 9:15 AM read as BST.
- **R7 Weather from the sinking photograph**: broken cloud, a moderate sea
  with whitecaps (visual only; no written source).
- **R8 Wreck rests upright with a slight port list**; bow collapse not
  shown.
- **R9 Headway**: she was zig-zagging at convoy speed; no source gives the
  speed. Assume about 10 kn, lost within a couple of minutes (engine room
  flooded), documented as an assumption.
- **R10 Portholes shut** (darkened ship in convoy, wartime): no porthole
  rows, so no porthole toggle in her What-if.
- **R11 No U-boat model, no HMS Snowdrop model.** The torpedo wakes and
  hits are shown. Snowdrop appears only in the end card's words.
- **R12 Her convoy is shown** as a few distant low-detail steamers in grey
  and dazzle on the horizon, steaming away after the hit (GOL: they
  scattered at full speed). Cheap silhouettes, tiered off at low quality.
- **R13 Daytime distress rockets** fire as scripted `rocket` events after
  the hits (GOL: rockets to attract patrol vessels), drawn as daytime
  bursts with smoke.
- **R14 No wireless captions** (her wireless was wrecked by the hit).
- **R15 What if** = tap one or more torpedo spots along her **port** side
  (each a torpedo, the hole the real one made), plus one extra toggle,
  "The U-boat comes back" (the third torpedo at 10:50 AM at No. 5 hold;
  on in the real run). Hits land forward first, 8 s apart (her real order
  and gap); the Lusitania's order and gap are unchanged. The toggle is a
  pseudo-spot id in `ShipWhatIf.ids` (like the Fitzgerald's `vents`): no
  save-shape change.
- **R16 Walk the decks on her: dropped from this release** (parent,
  2026-11-22, to ship sooner). Follow-up: forecastle, forward well deck,
  the bridge-deck promenade and boat deck, the aft well and the open after
  deck with its deckhouse (R21), joined by ladders. Until then her Walk
  button is hidden (`walkMapFor` returns null).
- **R17 The Titanic nod**: the parent line names the rescue, and one
  Place, "Wireless room", carries the caption "In 1912 her wireless
  operator heard the Titanic's call for help here." Nothing extra on the
  title card (kid UI: no reading). No rescue mode.
- **R18 Sound**: reuse the Lusitania's daytime bed and torpedo cues with
  her own mix (no coast surf, deeper swell, gulls rarer offshore), plus
  the rocket cue in daylight. No voices.
- **R20 A brief stern dip**: after the aft torpedo she trims up to about
  0.8° by the stern for some minutes before the forward holds overflow and
  she plunges bow first. About 120 calibration runs found no honest set
  without the dip that keeps the other criteria (README).
- **R21 No raised poop** (drift audit A, from three photographs: the 1912
  starboard view, the Malta view from aft, the 2017 drawing): aft of the
  after well her hull is not carried up a tier; an open after deck at
  upper-deck level carries a white stern deckhouse, the jigger mast (at
  about 493 ft from the stem, not 470) and a boat platform. The bridge
  house sits about 217–259 ft from the stem with a gap before the funnel;
  the forecastle is about 42 ft long.
- **R22 Her way down is seen**: a 170 m hull in 150 m of water lands its
  bow as the stern goes under; the stern then settles to the floor at a
  rate the water allows (no swinging down like a door), and her descent
  plays in real time (`descentTimeScale: 1`, as the Fitzgerald).
- **R19 Analytics**: the closed `ship` enum gains `carpathia` (schema,
  rules, rules test, dashboard together).

## Liveries for every ship (Gentry, 2026-11-22)

Gentry: ship the 1918 dazzle as the Carpathia's default, but his son must be
able to switch to her **original paint** (1912 Cunard: black hull, white
houses, red funnel with black top and bands) **live, while the game is
playing**, and the same for **every ship**.

- **R23 Liveries are ship data.** `ShipSpec.liveries?: readonly Livery[]`
  with `{ id, label, year, default?: true, sources }` (one default per
  ship; missing or one entry = no choice). The recipe maps a livery id to
  its paint (colours, textures, which details show: e.g. name boards, gilt
  band, dazzle). The API is documented in
  `components/shipwreck/model/README.md` so the parent can wire the
  sibling's Britannic ("liner", White Star) at integration.
- **R24 One big picture button** in the in-game HUD (kid UI: no reading: a
  paint-brush with two swatches showing the next livery's colours), hidden
  for a ship with one livery; the title screen gets the same button beside
  the ship's picture if cheap. Every HUD item explains itself on tap
  (`help.ts`).
- **R25 The swap is instant** mid-run: no restart, no sim state lost, no
  rebuild hitch on an iPad mini 6. Swap material colours, uniforms and
  textures (and visibility of small paint-only parts), never rebuild hull
  geometry. Measured: the swap's frame cost is reported (target under
  8 ms on the dev machine's throttled run), and the perf budget's draw
  calls and triangles do not rise.
- **R26 The choice is remembered** per ship in the save
  (`liveryByShip`), with a migration test: an older save loads with each
  ship's default livery, never a reset; unknown ids fall back to the
  default.
- **R27 No analytics** for liveries (no new enum, no rules change).
- **R28 The liveries** (each researched and cited in the model README):
  - **Carpathia**: `dazzle-1918` (default), `cunard-1912` (original). The
    plain-grey variant stays a recipe option, not offered in the game.
  - **Lusitania** (the son's favourite: get it exactly right): `war-1915`
    (default, as on 7 May 1915: funnels painted dark, name painted out,
    as 1.1 built it) and `cunard-1907` (original: Cunard red funnels with
    black tops and black bands, her name and gilt details, white
    superstructure, black hull, red boot-top; cite photographs and the
    1907 sources for every detail).
  - **Titanic**: research; she had one livery in service (1912), so most
    likely no toggle (note the finding in the README).
  - **Edmund Fitzgerald**: research whether her 1958 launch colours
    differ from 1975 (hull, stack, cabins); add an `original-1958` only if
    sources support it, else no toggle (note the finding).
  - **Britannic**: the sibling branch adds a "liner" (intended White Star)
    livery with the same API; not wired here.

## Parent line (exact copy)

"This is the Carpathia, the ship that rescued the Titanic's survivors in 1912. During the First World War, on 17 July 1918, a U-boat's torpedoes
sank her off Ireland, and five of her crew died. This game shows only the
ship."

## Pass criteria for the sim (real run, enforced by tests)

- Hits: two openings sets at t = 0 and t = 8 s on the port side; a third at
  t = 5,700 s (10:50 AM).
- List to port (negative `listDeg` per `track.ts`'s sign: the builder
  states the sign) between 0.5° and 10° at 10 min, never past 15° before
  the third torpedo.
- Down by the head from 10 min on.
- Still afloat at t = 5,700 s with her forecastle deck edge above the still
  water.
- Stern under between t = 6,000 s (10:55 AM) and t = 9,300 s (11:50 AM).
- **Bow first** (the sinking photograph): trim by the head throughout,
  and when the stern goes under her bow is down (trim by the head, stern
  the last part under). Allowed (ruling R20): up to 1° by the stern for at
  most 10 minutes after the third torpedo while No. 5 hold fills; her bow
  and forecastle still go under first.
- No breakup while afloat.
- She rests within 15° of upright, listed to port.
- What if: without the third torpedo she sinks no earlier than the real
  run (or floats: the physics decides; the README reports which); one
  hit anywhere floats or sinks later than the real run; three or more
  hits sink no slower than two; every combination ends inside `endT`
  with finite poses.
- The Titanic, Lusitania and Fitzgerald goldens unchanged.

## Pass criteria for the look

- Model viewer screenshots: bow 3/4, stern 3/4 (twin screws, rudder),
  side profile, top-down, the boat deck close, funnel close, each paint.
- Scene screenshots (1133×744 and 744×1133): the first wake running in,
  the two hits, settling with boats away and the convoy on the horizon,
  the third hit, the bow under, the descent, the wreck upright on the
  floor; each ship in each livery and the paint toggle mid-sinking.
- Budgets as north star 4.

## Non-goals

- People, a U-boat or Snowdrop model, a rescue mode, the 1912 rescue
  itself, the bow's collapse on the wreck.

## Anti-goals (fail even if it technically works)

- A scripted settle pretending to be physics.
- The Lusitania's afternoon with the coast removed: it must read as a
  different morning, a different ship (one funnel, wells, dazzle).
- Wrong features: four funnels, no wells, Titanic davits copied over,
  peacetime paint by default.
- Any other ship's track, look or budget moving.

## Draft changelog entry (for the parent's 1.5.0)

> **The Carpathia.** Play the Carpathia, the ship that saved the Titanic's
> survivors. In 1918, during a war, torpedoes hit her side on a summer
> morning. Watch her settle slowly, her boats row away and her convoy
> steam off, then see her go down and land upright on the sea floor.
> She wears her wartime "dazzle" stripes. In What if, tap where torpedoes
> hit, and choose whether the last torpedo comes.
>
> **New paint button.** Tap the paint brush while a ship sinks to swap
> her paint: the Carpathia's 1912 colours from the Titanic rescue, the
> Lusitania's red Cunard funnels from before the war, and back again.
