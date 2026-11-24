# Shipwreck — Poseidon

Seventh ship for `/shipwreck`, and the first made-up one: the **Poseidon**, a
modern cruise ship of our own design that evokes the one in the 2006 film
_Poseidon_. On New Year's Eve, near midnight, in the open North Atlantic, a
giant rogue wave hits her side-on and rolls her over, keel up. Then physics:
the sea pours in through her smashed windows, she floats upside down on the
air trapped inside her, and as the air leaks out she sinks. Builds on the 1.0
spec (`2026-11-20-shipwreck-design.md`) and every later Shipwreck spec
(`2026-11-2[0-3]-shipwreck*-design.md`, the Concordia's above all), which
still hold for everything this document does not change.

This branch (`feat/shipwreck-poseidon`, off main at 1.10.0) owns the whole
release: it **bumps `SHIPWRECK_VERSION` to the next free minor (1.11.0
assumed; the release task re-checks `origin/main`)** and writes the
changelog entry (draft at the end). The icon v1 files never change.

## Why

Gentry's son (young, iPad mini 6, loves ships) asked for the Poseidon by
name. What he wants from every ship is the same: "zoom in and fly around",
"see things as it sinks". This one gives him something no other ship in the
game does: a ship turned completely upside down, her propellers and red
bottom up in the air, floating, and then going down keel first. Gentry
picked "her own cruise ship built from the Concordia's kit" and said "get it
deployed": no questions, MVP first, every call is ours and listed in
"Rulings Gentry may revisit".

Her lesson for a boy is real physics, even though the ship is made up. A
ship floats because she pushes water aside. Turned upside down, she can still
float, because air is caught inside her like air in an upside-down cup
pushed into a bath. Every broken window lets a little air out and a little
water in. When enough air has gone, she sinks. What if lets him make the
wave smaller (she leans far over and stands up again), send it from in front
(she climbs over it), or keep some windows from breaking (she floats upside
down longer).

## North-star goals (every builder re-reads these)

1. **The wave and the roll-over are stated rules; everything after is
   physics.** At the wave a stated rule rolls her past 180° in about half a
   minute (like the Concordia's rest on the rocks or the Lusitania's rest
   on her side: a rule, named as one in the README). From the moment the
   rule lets go, physics owns her: water in through the openings the wave
   smashed, by the orifice law; the air caught in each space squeezed by
   Boyle's law and leaking out through stated paths; her keel-up attitude
   from honest hydrostatics; her sinking when the trapped air can no longer
   carry her; the dive and the rest on the floor. Every assumption is
   documented in the sim README.
2. **She is her own ship, not a copy.** An original modern cruise-ship
   design that evokes the film's: long and tall, white, rows of balconies,
   orange lifeboats in a recess, one tall raked funnel aft, and on top
   amidships **the ballroom under a big glass dome**, the room people
   remember. Nothing is copied from the film's art, logos, layout or exact
   silhouette; her name "POSEIDON" is on her bows and stern in our own
   lettering. She is built from the Concordia's kit (balconies, window
   bands, boat recess, boats and davits, rails, glass, lights, funnel
   builders) so she looks as good as the Concordia, with her own silhouette.
3. **It looks as good as the other ships and runs at 60 fps on an iPad
   mini 6.** The scene ≤ 160 draw calls, ≤ 450k triangles at the top tier,
   no frame blocked > 8 ms. Her model alone at `high` ≤ 100 draw calls,
   ≤ 300k triangles (30k lower than the Concordia's cap: the storm sea's
   ring mesh costs more than the flat sea). `e2e/perf-budget.json` gains
   Poseidon scenes only; nothing else moves.
4. **A different night: the open ocean and one giant wave.** New Year's Eve
   in the North Atlantic, a clear starry night, a long swell, nothing in
   sight, the ship lit end to end. The wave is seen coming (a dark wall
   with a breaking white crest, taller than her balconies), hits her side,
   and she rolls over. Keel up: her red bottom, propellers and rudders in
   the air, her emergency lights glowing under the water. Under water: her
   upside-down decks, the ballroom's dome facing the deep, and the long
   dive to the dark floor.
5. **No ship regresses.** The six existing ships' golden fixtures (a new
   Concordia real-night golden written first), every recipe snapshot (a new
   Concordia recipe snapshot written before the kit is lifted out of her
   recipe), every other ship's `SCENE_SETTINGS` and perf entries pass
   unchanged; every existing test passes.
6. **Kind to a young player.** No people shown, no death counts, no
   screams or voices, no party-goers. The film's story (its characters, its
   deaths, its escape) is never told in play. The parent line says plainly
   that she is made up (the exact copy below wins). Kid UI is big picture
   buttons, no reading needed.
7. **Short enough to scrub.** About 12 shown minutes for the real night
   from the first frame to her rest on the floor; What-ifs that do not roll
   her over end within 6 shown minutes of the wave (Gentry found long
   timelines "way too long"). Every What-if ends with an outcome.

## Her first-ship-made-up rule

Every other ship's realism comes from sourced history and photographs. Hers
comes from physics and from real cruise ships of her size and era. So:

- **Her particulars are ours**, chosen in the range real cruise ships of
  2000–2010 have (sourced ranges, our numbers, stated as ours).
- **Her look is ours**, in the visual language of her era's cruise ships
  (balconies, glass, a big funnel), checked against photographs of real
  ships for believability ([WC] categories below), not against the film.
- **The wave's size is sourced** from real rogue waves; its effect on her (the
  roll-over) is a stated rule, because no real cruise ship has been rolled
  over by one and the sim cannot honestly compute a breaking wave's impact.
- **Everything after the roll** is the same honest physics every ship uses,
  plus one new honest piece (trapped air).

## What the sim and scene aim at

Sources, abbreviated in the README tables. Builders verify and cite; where
sources disagree, pick one, say which and why.

- [DRA] Haver, S., "A possible freak wave event measured at the Draupner
  Jacket, January 1 1995" (Statoil, 2004): 25.6 m crest-to-trough in a sea
  of Hs ≈ 12 m, on New Year's Day in the North Sea.
- [QE2] The _Queen Elizabeth 2_'s 1995 encounter (Hurricane Luis): a wave
  reported at about 29 m (Wikipedia, "Rogue wave", and its sources).
- [ND] The _Norwegian Dawn_, 16 April 2005: a wave of about 21 m broke
  windows on decks 9 and 10 and flooded cabins (NTSB/press; Wikipedia,
  "Rogue wave"). [LM] The _Louis Majesty_, 3 March 2010: waves of about 8 m
  smashed forward windows on deck 5 (Wikipedia). Both: real cruise ships,
  windows broken high above the waterline, upright afterwards.
- [ROG] Kharif, Pelinovsky & Slunyaev, _Rogue Waves in the Ocean_
  (Springer, 2009): definitions (H > 2·Hs), shapes, breaking.
- [SOL] SOLAS II-1 Reg. 26 / IACS UR M46: machinery must work at 15° static
  and 22.5° dynamic heel (why her power fails as she rolls far over).
- [BOY] Boyle's law for the air caught in an upturned hull (any physics
  text); [SEW] the MV _Sewol_ (16 April 2014) and the _Princess of the
  Stars_ (21 June 2008) floating keel-up for hours before sinking: real
  ships held up by trapped air (Wikipedia and the cited reports). Never
  named in play.
- [CR] Real cruise ships of her size and era for particulars and look:
  Wikipedia pages for the Concordia class, the Carnival Conquest class, the
  Grand class and the Voyager class (lengths, beams, draughts, tonnages,
  decks, boats); [WC] their Wikimedia Commons categories for how a glass
  dome, a raked funnel and a boat recess really look.
- [ATL] The North Atlantic in winter: GEBCO for an abyssal depth of about
  4,000 m; a winter swell of 3–4 m significant height (any wave atlas, e.g.
  the ECMWF ERA5 climatology), stated.

**Her particulars (ours, R3).** LOA 305 m, LBP 265 m, beam 36.0 m, depth to
the bulkhead deck (deck 0) 14.5 m, draught 8.4 m even keel, block
coefficient 0.70, so about 57,500 t displacement (265 × 36 × 8.4 × 0.70 ×
1.025); KG for an intact GM in an honest range (1.5–3 m); 14 passenger
decks; diesel-electric, two shafts, two propellers, two rudders, three bow
thrusters; 24 lifeboats (12 a side) in a recess on deck 4. The Concordia's
numbers ([MIT] in her spec) are the yardstick: about 15 m longer, a little
beamier, a little deeper.

**Subdivision (ours, R4).** About 20 watertight compartments under deck 0,
spaced by the floodable-length rule for a two-compartment ship (as the
Concordia's unsourced ones were), the engine rooms amidships aft. Deck 0 is
every bulkhead's top. Above it the superstructure boxes, each now with an
`id`, in tiers fore and aft (forward, midships, aft; lower decks 1–6 and
upper decks 7–11), plus **`ballroom`**: a round room two decks tall on decks
12–13 forward of the funnel, about 30 m across, under a glass dome about 9 m
high.

**The night (R2, R13)** (shown clock, `clockStartS` = 23:58:00 on 31
December; the year is never shown):

| Shown      | What                                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| −60 s      | Pre-roll: lit end to end, a long swell; the wave rises out of the dark on her port side.                                                                                                |
| 0 (23:58)  | The wave's breaking crest hits her port side (`collision`): windows and doors on that side smash (her `wave.openings`, by spot).                                                        |
| 0–~25 s    | The roll rule takes her over to starboard: 30°, 90° (on her side), past 180°. Her power fails past 60° (`lights-out`): emergency lights only.                                           |
| ~25 s      | The rule lets go (`capsized`). Physics: she finds her own keel-up attitude on the air caught inside her (expected 170°–190°, a little down by the bow or stern where the water got in). |
| ~25 s–45 m | Keel up: water pours in through the smashed openings; the air squeezes and leaks; she settles lower and her trim grows (shown ×6: about 7 shown minutes).                               |
| ~45–55 m   | One end goes under, then the rest (`bow-under`, `stern-under`): she dives, still upside down.                                                                                           |
| after      | She lands keel up on the floor 4,000 m down (`wreck` rule, `restDeg` 180), shown ×6 on the way down as every ship.                                                                      |

Real times are a ruling (R13): how long she floats keel up comes out of the
physics of her stated air leaks, calibrated into a band (35–60 real minutes)
that plays in about 6–10 shown minutes at ×6.

## The sim (what changes, all gated so other ships are untouched)

Reuse first: the storm's wave field and wave groups (`waves.ts`, the
Fitzgerald), the Concordia's `blackout`/emergency lights, time scale after
an event (`agroundTimeScale`), `preRollS`, the `wreck` rest, the Carpathia's
pose-box steady test. New format pieces, each optional and `undefined` (so no
change) for every existing ship.

### 1. Trapped air (`ShipSpec.trappedAir?`) — physics

Today a space's water stops rising when its level reaches the sea's (head
inside = head outside). That is right for a ship the right way up, whose air
escapes upward through her decks; upside down it would flood every space
to the sea level and she would sink at once. So, for a ship with
`trappedAir`, each cell (hull compartment and superstructure box) carries an
**air mass** (in atmosphere·m³) once it is sealed:

- **Sealed** when no opening of the cell, no deck-edge or lower-edge flood
  point and no stated vent is both in contact with its air (above its water
  surface, earth z) and above the sea. A sealed cell's gauge air head is
  h = p_atm/(ρg) · (m / V_air − 1) (isothermal Boyle, V_air = cap − water);
  an unsealed one has h = 0 and its air mass follows its volume.
- **Water** through any opening (hull openings, deck-edge and box flood
  points, bursts) by the existing orifice law with the inside head raised by
  h: q = Cd·A·√(2g·Δh), Δh = sea head − (inside head + h). So a sealed
  space's water stands below the sea level by its air's head, and her
  buoyancy comes out of the hydrostatics unchanged (the dry part of each
  cell is displaced sea).
- **Air out** where an opening touching the air is under the sea and the
  air's pressure beats the sea's there: the orifice law for gas,
  ṁ = Cd·A·√(2·Δp/ρ_air) (with ρ_air from the pocket's pressure), plus her
  stated slow leaks (`trappedAir.leakM2` per cell, by kind: the ducts,
  stairways and door seals a real ship is full of; R8, calibrated in a
  stated range 0.001–0.05 m² per cell). Air never comes back in under
  water.
- **Deep**, Boyle squeezes the air and she loses lift as she goes down:
  honest, no rule. The existing vent-burst at `VENT_BURST_M` stays for
  every ship; for her it counts as an opening that lets air out.
- **Allocation-free**, one more `Float64Array` per body; the flood loop
  (`seaInflow`, `capSeaFlow`, `roomToSea`) reads h for her cells only.

Missing `trappedAir`: exactly today's code path (the goldens prove it).

### 2. Superstructure boxes as spaces (`superstructure[i].id?`, `.hb`) — format

- A box may have an `id`; an `Opening.compartmentId` may name a box id (the
  ballroom's dome, a tier's windows). `cellAt` resolves it.
- A box's flood points are its lowest edge **at the pose**, not its
  ship-frame lower corners: upside down, its roof's edges are lowest. Today's
  corners stay for every ship without `trappedAir` (gated, so the goldens
  hold).
- `SimFrame.boxWater?: number[]` (fraction full per box, only when a box has
  an `id`) so the X-ray can fill the ballroom.

### 3. The wave and the roll-over (`ShipSpec.wave?`, `cause: "wave"`) — a rule

```ts
wave?: {
  /** The rogue wave as a wave group on her storm (drawn and sampled by the
   *  same field), its biggest crest at her at shown `t`. */
  group: WaveGroup;               // heightM 30, count 1, periodS ~15, dirDeg −90 (from port)
  /** The roll rule: from `t`, her roll eases (smoothstep) to `peakDeg` over
   *  `rollS`, then lets go to physics with her roll rate zeroed. */
  peakDeg: number;                // 190 (past keel up, to starboard)
  rollS: number;                  // ~25
  /** What-if variants: the smaller wave and the wave from ahead. */
  smaller: { heightM: number; peakDeg: number };   // 15 m, 45°
  ahead: { dirDeg: number };      // 0: from ahead, no roll rule
  /** The spots: what the wave smashes (ids, labels, openings), aft to fwd. */
  spots: readonly { id: string; label: string; openings: readonly Opening[] }[];
};
```

- **During the rule** (`t` to `t + rollS`) her roll is set by it each step
  (as `stepAground` sets the Concordia's); heave, pitch, flooding, trapped
  air, the girder and everything else are physics around it. Her yaw holds.
  The rule's pace is a smoothstep (no kick at either end); `wr` = 0 when it
  lets go.
- **After it** physics owns her roll. Expected: with the real wave she stays
  keel up (an upturned ship with air in her hull and water in her upper
  decks is stable keel up); with the smaller wave she rights herself; from
  ahead she never rolls. If physics disagrees, the builder stops and reports
  numbers (the Britannic rule); no rule is added to make it so.
- **The wave group** joins her storm (her swell, Hs 3 m, components fitted as
  the Fitzgerald's). It is drawn by `StormSea` and seen by any deck opening.
  **It is left out of her `waveRide`** (a quasi-static, small-angle ride on a
  30 m breaking wave would be nonsense, and the rule owns her roll); the
  swell's ride stays and fades out over `rollS` from the wave (her ride is
  for a ship right way up). From ahead the group is in her ride (she
  pitches up and over it: kinematic, as the Fitzgerald's seas).
- **`SimOptions.wave?: "real" | "smaller" | "ahead"`** (default real) picks
  the variant. Openings are the chosen spots' (a smaller wave smashes the
  same chosen openings; from ahead, only the chosen spots forward of
  midships: it breaks over her bow).
- **`cause: "wave"`** (appended): words, scene, What-if read it. Spots are
  `wave.spots` (not compartments); real ids = every spot.

### 4. Power, events, time, ends

- **Blackout by list** (`blackout.listDeg?`, a rule with a sourced
  threshold): `lights-out` once |roll| > 60° (past [SOL]'s 22.5° design
  heel, generators trip and lubrication fails: calibrated to the rule, not
  to a source), then `emergencyLight` (her batteries), as the Concordia's.
  Pumps stop with it.
- **`capsized`** (`SimEventKind`, appended) when the roll rule lets go with
  |roll| > 150°, or whenever physics takes any ship with `wave` past 150°.
- **`capsizeTimeScale?`** (6): once `capsized` fires, shown time runs ×6 (as
  `agroundTimeScale`); frames carry `realT`; the clock stays true.
- **`rideOut?: { afterS, maxListDeg }`**: a run whose ship is whole, afloat,
  never `capsized` and within `maxListDeg` from `afterS` shown seconds after
  the wave on ends `floated` (event `sheltered` reused: "She rode it out").
  `afterS` 300.
- **`endS?`** (shown seconds after the first event; her endT): about 1:25
  AM real once scaled (the builder sets it so a run that floats keel up
  ends inside 15 shown minutes). At `endS` a body afloat keel up ends with
  the new outcome **`capsized`** (appended to `SimTrack.outcome` and
  `OUTCOME_IDS`).
- **The steady test in a storm.** Today it never runs in a storm (`!w.sea
.storm`). For her (gated on `wave`) it runs once the wave group has passed
  (`t > wave.group.t + 8·envelope`), with the Carpathia's pose-box fallback
  (`settled`) on, because a hull rocking on the swell never passes the rate
  test. Every What-if is pinned to end (Task 4's matrix).
- **The dive upside down.** Today a whole hull that goes under relaxes its
  roll to 0 and its pitch to 40° bow down (`descent.ts`): she would turn
  right way up on the way down. For a ship with `wreck.restDeg` ≥ 150 the
  whole hull keeps its roll as it falls (eased toward `restDeg`, never back
  through 90°) and lands keel up. Fitzgerald's stern capsize is untouched.
- **`wreck: { restDeg: 180, minListDeg: 120 }`**: she rests keel up, `seaDepthM`
  4,000 (flat floor: no `seabed`).

**What is physics, what is a rule.** Physics: flooding through the smashed
openings and her deck edges, trapped air and its leaks, her keel-up
attitude, trim and sinking, the girder, the dive's speed. Rules: the wave's
roll (peak and pace), the blackout threshold, `rideOut`'s end, `endS`, the
dive keeping its roll, the rest keel up, the air leak areas (stated,
calibrated in range).

**Does the sim handle 180°?** The hydrostatics clip each section with any
plane, so volume and moments are correct at any roll; the roll equation
does not assume small angles; but nothing has ever floated past 90°. Task 2
adds a box-on-box test ship (a 200 m box hull with a deckhouse box) and
checks: GZ at 0–180° in 10° steps against the analytic wall-sided GZ within
3%; a sealed upside-down box with trapped air floats at the Boyle answer
(draught within 2%); an air pocket at 10 m depth has its gauge head 10 m ±
1%; a leak of known area empties it at the orifice law's rate ± 5%; keel up
with the deckhouse flooded is stable (perturbed 5° it returns).

**Her data** (`lib/shipwreck/ships/poseidon.ts`): hull stations from a
cruise ship's lines at her particulars (a full midbody, a bulbous bow, a
transom stern; ≥ 41 stations), `sheerZ`, deck heights (deck 0 at 14.5 m,
2.8 m steps above as the Concordia's), compartments (R4), superstructure
boxes with ids (lower tiers, upper tiers, `ballroom`), `trappedAir`,
`wave` (group, rule, variants, spots), `storm` (her swell plus the wave
group), `blackout` (by list), `capsizeTimeScale`, `rideOut`, `endS`,
`wreck`, `seaDepthM: 4000`, `clockStartS: 23*3600 + 58*60`, `preRollS: 60`,
one funnel (`falls: false`), 24 boats in `POSEIDON_BOATS` (no
`boat-lowered`: there is no time and no people, R16), `POSEIDON_DECKS`,
`girder` from IACS UR S11 for her size times a stated ultimate factor (she
does not break: R17), `realNight` = every spot's openings, `liveries`.

**Her spots (R9)** (`wave.spots`, aft to forward, all on her port side,
the side the wave hit; areas stated, calibrated):

| Spot id    | Picture / label     | Openings (ours)                                                                                            |
| ---------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `stern`    | "The back doors"    | the aft mooring and marina doors, decks 1–2 (hull, aft compartments)                                       |
| `aft-win`  | "Back windows"      | window rows decks 3–6, aft tier                                                                            |
| `mid-win`  | "Middle windows"    | window rows decks 3–6, midships tier                                                                       |
| `vents`    | "Engine air vents"  | the funnel casing and engine-room air intakes (into the engine rooms, honest: inverted they open downward) |
| `ballroom` | "The ballroom dome" | the dome's glass, about 40 m², into `ballroom`                                                             |
| `fwd-win`  | "Front windows"     | window rows decks 3–6 and the bridge front, forward tier                                                   |
| `lobby`    | "The lobby doors"   | the deck 5 atrium doors and gangway doors, midships                                                        |

**Pass criteria (real night, enforced by tests):**

- `collision` at t = 0; roll ≥ 90° by 15 s, ≥ 150° by `rollS`; `capsized`
  once; `lights-out` between 3 and 20 s, power after it her emergency
  level, never 0;
- after the rule, keel up: |roll| in 165°–195° for at least 20 real
  minutes; her keel and propellers above water for at least 20 real
  minutes; water in the ballroom ≥ 90% within 5 real minutes;
- trapped air holds her: total air aboard falls monotonically after the
  wave (no air in from the sea); the hull's air carries ≥ 50% of her weight
  10 real minutes after the wave;
- sinks: `bow-under` or `stern-under` between 35 and 60 real minutes; she
  lands keel up (`restDeg` 180 ± 10) on the 4,000 m floor; no `breakup`;
  outcome `sank`;
- shown time from the first frame to her rest ≤ 15 min (target 12);
- deterministic; finite poses (no NaN anywhere in frames); ends inside
  `endS`.

**What if (multi-select, like the others).** Spots are `wave.spots` (picture
buttons on the hull diagram, more than one allowed; real = all seven). One
chip, like the Fitzgerald's storm chip: **Real wave / Smaller wave / Wave
from ahead**. Expected (tests):

- real wave, all spots → capsizes, floats keel up, sinks (`sank`);
- real wave, no spots → capsizes, floats keel up on her trapped air, still
  afloat at `endS` → `capsized` ("Upside down, she was still floating.");
- real wave, `ballroom` only, or `vents` only → capsizes; sinks later than
  real or ends `capsized` (physics decides; both end inside `endS`);
- smaller wave, any spots → leans to about 45° and rights herself; `rideOut`
  ends `floated` ("She leaned far over, then stood up again.");
- wave from ahead, any spots → never rolls past 15°; `floated` ("She rode
  over the wave.");
- every run ends inside `endS` with an outcome and finite poses.

If honest physics disagrees with an expectation, the builder stops and
reports numbers; the controller widens the band and the README says why. No
parameter leaves its stated range to pass.

## Look and scene

- **The cruise kit** (`components/shipwreck/model/cruiseKit.ts`): the
  Concordia recipe's builders lifted out and parametrised (tiers and their
  ends, balcony rows, window bands and lit panes, the boat recess with boats
  and davits, liferaft racks, rails, glass boxes, radar mast and domes,
  propellers, shafts and rudders, name boards, the emergency-light mask),
  with the Concordia's recipe rebuilt on it and its output **deep-equal** to
  the snapshot taken before (no visible change to her).
- **Her model** `components/shipwreck/model/poseidonRecipe.ts` on the kit,
  her own silhouette (R5): a long, sleek profile with a raked bow and a
  rounded, stepped stern; balconies decks 7–11 for most of her length;
  window bands decks 1–6; the boat recess on deck 4 (24 orange boats); the
  bridge on deck 9 with wings across her beam; **one tall funnel aft, raked
  back about 15°, tapering, with a wing-like top** (a new kit funnel shape:
  an oval section swept and tapered along a raked axis, not the Concordia's
  upright oval); **the ballroom on decks 12–13 forward of the funnel: a round
  drum of tall windows under a ribbed glass dome** (a new kit part: a
  lat-long dome of panes merged into one mesh, ribs as one instanced or
  merged mesh, lit warm from inside until `lights-out`); a sun deck aft of
  the funnel with a pool; masts and radar domes over the bridge; bow
  thrusters; two propellers, two rudders (seen in the air keel up, so they
  get the same care as the funnel). "POSEIDON" on both bows and the stern,
  our own lettering (no film logo, no trident badge).
  Budget at `high` ≤ 100 calls, ≤ 300k triangles (dome ≤ 6k triangles,
  ≤ 3 calls); low tiers drop rails, dome ribs and glass first. Other
  recipes' snapshots deep-equal.
- **Liveries (paint box, 1.7 rule).** One real livery, `poseidon` (default,
  R6): white hull and superstructure, a deep sea-blue band along the hull at
  deck 3 (`sheerLine`), a deep blue boot-top, dark red bottom, white funnel
  with a deep blue top and a gold wave stripe, orange boats, the name in deep
  blue. Fun paints: the existing `cruiseFun()` set (her kind is the
  Concordia's), with `liveries.test.ts` listing her real id; its checks (≥ 5
  fun, none a copy of hers, saturation) cover her. The gold wave stripe shows
  only in her real paint (as the Concordia's "C").
- **Scene settings** `poseidon` (R12): `timeOfDay: "storm-dusk"` with
  `storm: true` and `stormLight: 0` pinned (the Fitzgerald's storm pipeline
  held at night: her wave field drawn by `StormSea`), clear sky with stars,
  no moon (made-up date), no coast, no iceberg, her deck and window lights
  through `StormSea`'s lamp slots, a faint glow on the water around her. The
  time button offers her real night and "by day" (`stormLight: 1`, her own
  label); she joins `STORM_SHIPS`.
- **The wave on screen.** The linear packet the sim uses looks like a smooth
  hill, not a breaking wall, so the scene adds (look only, R10): extra
  horizontal crest displacement for her group only (a Gerstner-style
  sharpening in `seaWaves.ts`, its steepness capped), a white breaking-lip
  foam band along the crest for its last ~150 m before her, a sheet of
  spray over her as it hits (`Effects.tsx`), foam on the water where she
  rolled. **Every `pow()`/`sqrt()` argument in new GLSL is clamped
  (`max(x, 0.0)` / `max(x, 1e-6)`) and every division guarded** (1.8.2:
  NaN is a black screen on real GPUs, invisible in SwiftShader).
- **Her lights.** All windows and decks lit (a party night, no people) until
  `lights-out`; then the Concordia's emergency mask from the kit. Under
  water, lit panes keep glowing dimly (the under-light).
- **Camera** (`cameraMath.ts`, `CameraRig.tsx`): never inside her hull at
  any roll (her hull boxes posed by the full rotation, tested at 0°, 90°,
  180°); the bridge and lifeboat cameras switch to the orbit once
  `capsized` (no camera upside down inside a flooded bridge); her shots:
  the lit ship on the swell, the wave coming from her port beam (camera off
  her starboard quarter, low), the roll-over from ahead, keel up with
  propellers in the air, under water looking up at the dome, the dive.
- **X-ray**: her compartments and boxes (the ballroom as a round blockout);
  water fills them from `water` and `boxWater`; checked upside down.
- **Hull diagram** (`HullDiagram.tsx`): her side view and spots; the sea
  line today divides by cos(pitch)·cos(roll), which is 0 at 90° roll
  (Infinity in the SVG). For |roll| > 80° it draws no sea line (or the
  inverted one past 100°); finite always (tested).

## Walk the decks

Later (MVP). `walkMapFor("poseidon")` returns null, so her Walk button stays
hidden.

## UI, words, analytics

- **Title screen**: her card after the Concordia (`SHIP_IDS` append
  `"poseidon"`). Card name "Poseidon", a small "made-up ship" mark
  (picture: a film strip; aria "A made-up ship from a film"), her side
  picture (white, raked funnel, the dome). Year shown: none (R1).
- **Words** (story captions, `sinceText` "2 min after the wave", places,
  help, end card), calm and plain:
  - before: "It's New Year's Eve. The Poseidon is lit up from end to end."
    / "A giant wave is coming!";
  - `collision`: "The wave hits her side! Windows break.";
  - rolling: "She's rolling over…"; on her side; `lights-out`: "Her lights
    go out. Only her emergency lights are on.";
  - `capsized`: "She's upside down! Air caught inside is holding her up.";
  - keel up: "Water is coming in through the broken windows. Air is
    bubbling out."; the ballroom full: "The ballroom has filled with water.";
  - going down: "Not enough air is left. She's sinking."; under; landing:
    "She rests upside down on the ocean floor, 4,000 metres down.";
  - What-if ends: "She leaned far over, then stood up again.", "She rode
    over the wave.", "Upside down, she was still floating.";
  - `leanText` reads "upside down" past 135° and "on her side" 60°–120°,
    never "185.0° to starboard".
  - No captain, no passengers, no party-goers, no film characters, no
    "survivors", no deaths. A word guard test lists these.
- **End card**: real: "Upside down, she floated for 47 minutes, then sank
  at 12:45 AM." (time and minutes from the run).
- **Parent line** (exact copy): "The Poseidon is not a real ship. She is a
  made-up cruise ship from a 2006 film, rolled over by a giant wave on New
  Year's Eve. Real ships have met waves nearly this big. This game shows
  what physics says could happen to a ship turned upside down, and it shows
  only the ship."
- **Places**: the bridge, the ballroom under its dome, the lobby, an
  engine room, the funnel, a propeller, a lifeboat (inside her hull or
  boxes; tested).
- **Help** (`help.ts`): a wave ship's cards: the wave, upside down, trapped
  air ("like a cup pushed upside down into the bath"), sinking.
- **Save**: `whatIfByShip.poseidon` with `{ ids, wave? }` (optional, no
  reset, no new key); `SAVE_SHIP_IDS` appends `poseidon`; `OUTCOME_IDS`
  appends `capsized` (old saves parse; unknown endings fall back).
- **Analytics** (data boundary: spec review + adversarial review): the
  closed `ship` enum gains `poseidon` in `lib/analytics/gameEvents.ts`
  (`SHIPWRECK_SHIPS`), both `p.ship in [...]` lists in `firestore.rules`,
  `firestore-tests/gameEvents.test.ts`, `lib/analytics/gameAggregate.ts`
  and the admin Games tab, together. No new props: `trackEnd` maps every
  outcome but `floated` to `sank`, so `capsized` sends `sank` (pinned by a
  test; the rules' outcome enum does not change). The wave chip is not
  counted. Seven spots stay under `SHIPWRECK_MAX_OPENED` (25). `npm run
test:rules` must pass.

## Seams and risks

**Where a ship id is enumerated** (the type-check finds every
`Record<ShipId, …>`; the rest are lists a test must catch):
`lib/shipwreck/ships/{types,index}.ts` (`ShipId`, `SHIP_IDS`, `SHIPS`),
`lib/shipwreck/save.ts` (`SAVE_SHIP_IDS`), `lib/shipwreck/types.ts`
(`OUTCOME_IDS`), `lib/shipwreck/{times,story,places,help,whatIf,xray}.ts`,
`components/shipwreck/parentLine.ts`, `components/shipwreck/Shipwreck.tsx`
(title camera), `ui/TitleScreen.tsx` (card, cause icon), `ui/WhatIfEditor.tsx`
(per-cause editor), `model/shipModel.ts` (`recipeFor`),
`model/ModelViewer.tsx`, `scene/{settings,NightScene,Environment,CameraRig,
cameraMath,xrayGeometry,SceneCheck}.tsx/ts`, `audio/cues.ts`
(`eventCuesFor`), `lib/shipwreck/walk/index.ts`, `scripts/shipwreck-sim.ts`,
`scripts/shipwreck-model-shots.mjs`, `jest.sims.js`; analytics in
`lib/analytics/{gameEvents,gameAggregate}.ts`, `firestore.rules` (two
lists), `firestore-tests/gameEvents.test.ts`, `components/admin/GamesView`
and its tests, `lib/analytics/__tests__/gameRulesSync.test.ts`; e2e in
`e2e/{shipwreck,shipwreck-offline,perf}.spec.ts` and `e2e/perf-budget.json`.

**What keel up breaks, and the plan:**

| Risk                                                                                                                                  | Where                                        | Plan                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| No trapped air: inverted spaces flood to the sea level, she sinks at once                                                             | `flooding.ts` `seaInflow`, `capSeaFlow`      | Trapped air (sim §1), gated; box-ship tests first                                                                    |
| Boxes flood only at their ship-frame lower corners: upside down they would be sealed air tanks forever; boxes have no ids or openings | `flooding.ts`, `types.ts` superstructure     | Box ids, box openings, flood points at the posed lowest edge (sim §2), gated                                         |
| Nothing has floated past 90°; GZ 90°–180° and keel-up stability untested; roll damping tuned near upright                             | `body.ts`, `hydrostatics.ts`                 | GZ 0–180° and keel-up stability tests on box ships before her data                                                   |
| A whole hull going under relaxes roll to 0, pitch to 40°: she would turn upright in the dive                                          | `descent.ts` `stepFall` (bow/whole branch)   | Keep roll for `wreck.restDeg` ≥ 150 (sim §4), gated; Fitzgerald golden pins the stern capsize                        |
| The steady test never runs in a storm; What-ifs that float would run to 6:20 AM                                                       | `run.ts` steady block                        | Steady + pose-box after the wave group passes, `rideOut`, `endS`; matrix test that every run ends                    |
| `waveRide` is small-angle and would add a 30 m wave's roll on top of the rule                                                         | `waveRide.ts`, `stormRide.ts`                | Group left out of her ride; swell ride fades over `rollS`; ride off once `capsized`                                  |
| Hull diagram's sea line divides by cos(roll): Infinity at 90°                                                                         | `ui/HullDiagram.tsx`                         | No sea line 80°–100°, inverted past; finite-output test at 0–180°                                                    |
| `leanText` and list captions read "185.0° to starboard"                                                                               | `help.ts`, `story.ts`                        | "on her side" / "upside down" bands; tests                                                                           |
| Bridge/lifeboat cameras upside down under water; camera inside her inverted hull                                                      | `cameraMath.ts`, `CameraRig.tsx`             | Switch to orbit at `capsized`; hull-box clamp tested at 0/90/180°                                                    |
| Storm sea ring mesh + a 300k ship can pass 450k triangles                                                                             | `StormSea.tsx`, her recipe                   | Her model cap 300k; measure Task 9; ring counts per tier unchanged for the Fitzgerald                                |
| New wave-crest GLSL: NaN from pow/sqrt is a black screen on real GPUs only                                                            | `seaWaves.ts`, `StormSea.tsx`, `Effects.tsx` | Clamp every argument; a unit test greps new GLSL for unguarded `pow(`/`sqrt(`; one real-GPU check at medium and high |
| Lifting the kit out of the Concordia's recipe changes her                                                                             | `concordiaRecipe.ts`                         | Snapshot first (Task 1), deep-equal after                                                                            |
| The default audio cues play the iceberg scrape at the wave                                                                            | `audio/cues.ts`                              | Empty cue map for her (R19)                                                                                          |

## Approaches considered

1. **Her own ship from the Concordia's kit (picked).** Lift the Concordia's
   builders into a cruise kit and build her silhouette on it: a new look a
   boy can tell apart (the dome, the raked funnel, longer), at the
   Concordia's quality, for about half the cost of a new model. Costs a
   refactor of a 935-line recipe, guarded by a snapshot written first.
2. **The Concordia repainted and renamed.** Cheapest, but a boy who knows
   ships sees the Concordia at once; no ballroom dome, the room the film is
   remembered for; and it blurs a real ship with a made-up one. Rejected.
3. **A brand-new model from scratch.** Most freedom, but doubles the model
   work and the perf risk for no gain the kit cannot give. Rejected.

The sim has the same three choices in small: a canned "upside-down then
sink" animation (rejected: north star 1), a physics-only capsize from a wave
impact (rejected: the sim has no honest breaking-wave impact model, and
faking one as physics breaks the honesty rule), or a stated roll rule with
honest physics after (picked).

## Non-goals

People, passengers, crew, the party; the film's story, characters, rescue
or escape through the hull; the ship's interiors beyond X-ray blockouts and
the ballroom drum; any real ship's name in play; a coast, rescue ships or
helicopters; sound; Walk the decks; the dive's debris field.

## Anti-goals (fail even if it technically works)

- She looks like the film's ship (its art, logo, livery or exact profile),
  or like the Concordia with another name.
- A canned keel-up float or sinking pretending to be physics, or a rule not
  named as a rule in the README.
- She turns right way up on the way down, floats with a NaN pose, or the
  camera sits inside her upside-down hull.
- A black screen on a real GPU from an unguarded shader.
- Any other ship's track, look, words or performance changing.
- Anything in play about people, deaths or blame.

## Rulings Gentry may revisit

- **R1 Ship id `poseidon`**, "Poseidon" on the card and end card, "the
  Poseidon" in words; a "made-up ship" mark on her card; no year shown.
- **R2 Scope**: about a minute before the wave to her rest on the floor. No
  escape, no rescue.
- **R3 Particulars (ours)**: LOA 305 m, LBP 265 m, beam 36.0 m, deck 0 at
  14.5 m, draught 8.4 m, Cb 0.70, about 57,500 t; KG for GM 1.5–3 m.
- **R4 Subdivision (ours)**: about 20 compartments by the floodable-length
  rule; superstructure boxes by tier plus the ballroom.
- **R5 Her look**: original, from the Concordia's kit; the dome, a raked
  funnel, longer; nothing from the film's art.
- **R6 Liveries**: one real (`poseidon`: white, sea-blue band, white funnel
  with a blue top and a gold wave stripe); fun paints are the Concordia's
  `cruiseFun()` set.
- **R7 The wave**: 30 m crest to trough, breaking, one crest, ~15 s period,
  from her port beam ([DRA] 25.6 m and [QE2] ~29 m measured or reported);
  a swell of Hs 3 m around it.
- **R8 Trapped air** is physics (Boyle, orifice laws); its slow leaks are
  stated areas (0.001–0.05 m² per space), calibrated so she floats keel up
  35–60 real minutes ([SEW] ships floated hours; she has far more broken
  glass than they did).
- **R9 What if**: seven spots (what the wave smashes), multi-select, plus
  one chip: real / smaller (15 m, rule peak 45°) / from ahead (no roll
  rule). No doors or portholes toggle: her spots already are her openings.
- **R10 The wave's look**: crest sharpening, foam lip and spray are look
  only; the sim's wave is the linear group.
- **R11 Blackout at 60° list** (a rule; [SOL]'s 22.5° is the design limit,
  60° a stated margin); emergency lights stay on dimly to the end.
- **R12 Scene**: the Fitzgerald's storm sea at night, clear, stars, no moon;
  "by day" offered on the time button.
- **R13 Time**: real time to the roll-over, then ×6 keel up and on the way
  down; the clock always shows real time; the wave at 11:58 PM on New
  Year's Eve (the year never shown).
- **R14 Outcomes**: `sank` (real); `capsized` (new: afloat keel up at the
  end) sent to analytics as `sank`; `floated` for the smaller wave and from
  ahead.
- **R15 Depth 4,000 m**, flat floor; she rests keel up (`restDeg` 180).
- **R16 Lifeboats**: 24 shown in their recess, never lowered (no time, no
  people).
- **R17 Girder**: IACS UR S11 for her size times a stated ultimate factor;
  she does not break (the dive keel up reads better whole).
- **R18 Words**: no people, no film plot; "made-up ship" on the card and in
  the parent line.
- **R19 Sound and Walk** are Later. MVP: `eventCuesFor("poseidon")` returns
  an empty map (today an unknown ship falls back to the Titanic's cues, so
  the wave would play the iceberg's scrape); the shared beds follow her
  storm's `windKn` (20 kn) as they do for any storm ship.
- **R20 Version**: 1.11.0 if `origin/main` is still at 1.10.0 when the
  release task runs; else the next free minor.

## Later

- Her own sounds (the wave's roar, glass, the hull groaning, air rushing
  out); no voices.
- Walk the decks on her: the promenade, the ballroom under the dome (right
  way up, before the wave).
- An air-pocket view: the X-ray showing each space's trapped air bubble
  shrinking.
- Debris on the water after she goes under; her wreck's floor scar.
- More waves (a "two waves" What if), or the wave from astern.
- The follow-up list (minor review findings) in the ledger.

## Draft changelog entry (1.11.0)

"**The Poseidon.** A new cruise ship joins the game, and she is a made-up
one, from a film: long and white, with rows of balconies, orange lifeboats,
a tall swept-back funnel and a ballroom under a big glass dome on top. On
New Year's Eve a giant wave hits her side and rolls her right over, upside
down. Watch her float on the air caught inside her, her propellers up in the
air, while water pours in through the broken windows, until she sinks. Then
try What if: make the wave smaller and see her stand back up, send it from
the front and watch her climb over it, or keep some windows from breaking.
Pick paint for her in the paint box too."
