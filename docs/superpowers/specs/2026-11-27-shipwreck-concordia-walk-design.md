# Shipwreck 1.17 and 1.18 — Walk the Costa Concordia, then go inside her

Date: 2026-11-27. Status: scope decided by Gentry (and by the coordinator on
his behalf, recorded below as decisions); the rulings at the end are open
for him to revisit.

Builds on the walk spec (`2026-11-21-shipwreck-walk-design.md`, with its
1.3.2 "fun over realism" change), the Titanic interiors spec
(`2026-11-27-shipwreck-titanic-interiors-design.md`, 1.15) and the "finding
the way inside" spec (1.16, on the parallel branch
`gr-shipwreck-interiors`: `docs/superpowers/specs/2026-11-27-shipwreck-find-inside-design.md`).
They still hold for everything this document does not change.

## Why

Gentry's kids want to explore a cruise ship the way they now can the
Titanic, especially the staterooms ("estate rooms"). Their favourites in
1.15 were **the lift**, **the lower rooms flooding slowly** and **the
tension of the sinking while you are inside**. Gentry: "Lean into it and
make it all great." So the Concordia is built around those three: a glass
lift you ride up through a three-storey atrium watching the decks go by,
low cabins where the sea comes in slowly and gathers on the low side, and
rooms that stay open while she leans further and further, with walking
getting harder and the emergency lights flickering.

## Decisions (made before this design; not open)

1. **Two releases from one plan.** **1.17.0 = walking her open decks.**
   **1.18.0 = her rooms.** Each ends in its own release task (version,
   changelog in plain words, e2e, perf scenes, screenshots) and ships on
   its own.
2. **1.17 open decks**: the pool decks with the glass-roofed pool, the
   water slide area, the boat deck with the lifeboats (boarding as on the
   other ships), the top sports deck. Spawn on the pool deck. The
   `deckZAt` reference bug is fixed first, with tests, without changing any
   other ship's numbers.
3. **1.18 rooms**, believable modern cruise-ship rooms modelled on hers,
   invented where sources are thin, every invention written down: a
   balcony stateroom you can step out of onto its balcony, a cabin
   corridor with an inside cabin, the Atrio Europa (three decks, glass
   lifts), the Teatro Atene (stage and seat rows) and the Squok kids'
   club. Deck doors on her open decks lead in. Room picture buttons
   (1.16 `entries`) for the camera picker.
4. **The lift is a highlight** (the kids' favourite in 1.15). The Atrio
   Europa's glass lifts are a real, visible ride: the car moves up and down
   the atrium and you see the decks go by through the glass, in place of
   the Titanic's dark wipe. The cabin decks open onto the lift, so the lift
   is on the natural route.
5. **Slow flooding is a highlight** (the kids' favourite in 1.15). The
   inside cabin and its corridor are low, on deck 1 (deck 0 if the track
   says deck 1 stays dry too long), where her real flooding was; they fill
   slowly and visibly, eased as on the Titanic, and as she heels the water
   gathers on the low (starboard) side of a tilted room and creeps across
   it.
6. **Tension inside is the point** (the kids' favourite in 1.15). Rooms
   close at **30°** of heel (23:11:24 on the real night), not the 20°
   first proposed (about 22:53), which cut the best part. Walking gets
   harder as she leans: slower uphill, a slide downhill, always within what
   the walker can safely hold. The lights fail at 21:45 (21:46:05 in the
   game) and the emergency lights flicker more as she leans; creaks and
   distant water build. Scary-fun, never grim.
7. **Lights**: main power out at her blackout (game: 58 s after the strike,
   21:46:05; real 21:45:58); before it the rooms are lit, after it the
   emergency light (`blackout.emergencyLight` 0.25) and the torch, through
   1.15's per-room power.
8. **The room kit gets modern vocabulary** (room kinds, finishes, pieces)
   as data and pieces, with the Titanic's output unchanged (her tests and
   perf budgets untouched). The Titanic special cases in `walkMapFor` and
   `interiorFor` become a per-ship registry.
9. **Non-goals**: floating furniture; swimming inside; the casino,
   restaurants, spa and bridge inside; any sim, track or golden change; new
   analytics. ("No new sounds" is dropped: decision 6 adds cheap cues from
   the existing voices.)
10. **Execution**: subagent-driven, Sonnet implementers by default, Opus
    where a task needs design judgment (named per task), one combined
    review per task, an Opus final review. The plan's first task rebases
    onto `main` once 1.16.0 has landed.

## Goals

### 1.17 — Walk her open decks

- **Walk her**: the Walk button and "Walk the deck" appear for the
  Concordia (she has had none: `walkMapFor("concordia")` is null today).
- **The pool hall**: the midships pool under its glass vault (the model's
  `pool-glass` block on deck 12, x −2..34, and its dome), walkable, with
  the pool, its tiled edge, loungers and the glass seen from inside. The
  pool's water stays level with the sea's horizon as she leans, dropping
  to the height of its low rim (it spilled).
- **The lido decks** on deck 13 either side of it: aft (x −97..−2, the
  aft pool, the glass houses round the funnel), forward (x 34..58, the
  forward pool and the yellow water slide's tower).
- **The aft terrace** on deck 12 (x −115..−97) and **the sports deck** on
  deck 14 over the spa (x 58.5..100).
- **The boat deck** (deck 4, the recess, x −101..104, both sides) with her
  26 boats: board one before it is lowered, as on the other ships.
- **Her lean**: walking carries on as she rolls, slower uphill and
  sliding a little downhill, until 40° (00:00 on the real night), when you
  slide off into the sea beside her and float, watching her settle.
- **Her creaks**: her hull creaks as she leans (today her creaks follow
  trim only, so she is nearly silent).

### 1.18 — Go inside her

- **Doors from her decks**: on the boat deck, port and starboard, a door
  into the Atrio Europa; in the pool hall, a door into the Squok club.
- **The Atrio Europa**: three storeys (floor on deck 3, galleries on 4
  and 5, a glass roof over 5), a curving stair from 3 to 4, the lobby bar.
- **The glass lifts**: two glass cars on the atrium's after wall, shafts
  from deck 1 to deck 7, stops at 1, 3, 4, 5 and 7. Step in, tap up or
  down, and ride: the car glides, you watch the decks slide past through
  the glass and come out on another deck.
- **The balcony stateroom** (deck 7, starboard): bed, sofa, desk, a
  bathroom door, the glass balcony door, and the balcony with its rail and
  two chairs, looking out at the sea and Giglio.
- **The low cabin deck** (deck 1, starboard): a wide lift lobby, a
  corridor, an inside cabin (two beds, no window) and an ocean-view cabin
  (a window low over the sea), shut doors down the corridor. This is where
  the sea comes in.
- **The Teatro Atene**: the stage with its curtain, raked stalls with seat
  rows and two aisles, a balcony on deck 5.
- **The Squok club**: soft play, a little pirate ship, a castle tower,
  beanbags, low tables, toy shelves (the club was the kids' place aboard;
  the name is hers).
- **Slow flooding**: deck 1 floods slowly from about the time she touches
  the rocks; the water lies against the low side and creeps across as she
  leans. Lamps die under it; the torch comes on.
- **Tension**: rooms stay open to 30°; uphill is hard work, downhill
  slides; emergency lights flicker more as she leans; creaks and the slosh
  of water around you.
- **Room picture buttons** in the camera picker (1.16 `entries`): Atrium,
  Stateroom, Low cabin, Theatre, Kids' club.

## Non-goals

- Floating furniture, debris, luggage; doors that open and close.
- Swimming or diving inside; walking under water.
- The casino, restaurants, spa, bridge, discotheque, shops inside (the
  places and the X-ray still show some of them from outside).
- Riding the water slide (a fine follow-up; the tower is a blocker here).
- Any sim, track, event or golden change. The interior only reads the sim.
- New analytics events or save fields.
- Changing any other ship's walking, rooms, look or sound.

## Anti-goals

- **No people**, no bodies, nothing scary. Dark rooms are never pitch
  black; water is just water; the lean is "whoa", not peril. No sound is a
  scream, a voice or an alarm.
- **No cost when not walking on her.** Every other view, and walking any
  other ship, draws and runs exactly what it does today.
- **No getting stuck or lost**: every room is reachable from a deck door
  or the picker, Go outside is always there, the slide downhill can never
  pin the walker in a corner, carry them through a door or over a rail.
- **No words in the kid UI.**

## Constraints

- Every other ship's deck behaviour is unchanged: every existing test in
  `lib/shipwreck/walk/__tests__/`, `lib/shipwreck/interior/__tests__/`,
  `components/shipwreck/interior/__tests__/` and
  `components/shipwreck/scene/__tests__/` passes unchanged. New behaviour
  is keyed on per-map or per-interior flags only her data sets.
- The sim is never written (`lib/shipwreck/sim/` untouched; no
  `test:sims` needed).
- `lib/` never imports `components/`. Safari 15 compat lint. No per-frame
  allocations in frame-loop code. No new three.js lights.
- Picture buttons only; words only in `aria-label`.
- Nothing of hers is built when not walking on her. Existing
  `e2e/perf-budget.json` entries do not change.
- New unit tests are fast (normal lane) or go in `jest.sims.js`.
- Shipwreck release rules: 1.17.0 and 1.18.0, each with its changelog
  entry. Conventional commits with `Assisted-by: Claude`.

## Approaches

1. **Picked: her decks as a walk map, her rooms as 1.15 room-kit data,
   plus three new mechanisms (the visible lift ride, slow seep, the heel
   feel) behind her flags.** Everything 1.15 built (seams, ramps, links,
   hall assist, water planes, per-room power, the torch, door exit) is
   reused; the Titanic keeps exactly her behaviour.
2. **A whole-ship interior (all 14 decks).** Dropped: 290 m by 14 decks is
   far beyond the Titanic's 793-line interior; the kids want a few great
   rooms, not corridors.
3. **Cut her model open** so rooms show from outside. Dropped for the
   reasons 1.15 gave (cost on every view; her superstructure is solid
   blocks with about 1,600 window panes).

## Her clock and heel (the numbers everything keys on)

From `ships/concordia.ts` and `sim/README.md`. Clock zero is the strike,
21:45:07 (40 s pre-roll before it). Shown time equals real time until she
touches; after that `agroundTimeScale` 6 runs shown time six times faster
than the clock (the HUD shows the real clock).

| Moment                         | Real clock | Shown time after strike | Heel    |
| ------------------------------ | ---------- | ----------------------- | ------- |
| Blackout (game; real 21:45:58) | 21:46:05   | 0:58                    | ~0°     |
| Listing to starboard           | 22:20      | 35:00                   | 5°      |
|                                | 22:30      | 45:00                   | 8.5°    |
| Touches the rocks (`aground`)  | 22:39:32   | 54:25                   | 12.9°   |
| (20°, the first close idea)    | ~22:52:46  | ~56:37                  | 20°     |
| **Rooms close**                | 23:11:24   | ~59:44                  | **30°** |
| **Deck walking ends**          | 00:00:00   | ~67:50                  | **40°** |
| At rest                        | 00:41      | ~74:45                  | 65°     |

20° is interpolated along `aground.pace` (12.9° at the touch to 30° at
23:11:24, linear). At 1× play the kids get about 5.3 minutes inside
between the touch and the close (2.2 of them past 20°), and 8 more on deck.
Tests key on the heel (`frame.listDeg`), never on the clock.

## The design: 1.17, her open decks

### `deckZAt` fixed for her

`deckZAt(deck, x, spec)` (places.ts) measures sheer from the deck named
"C" (else "Upper"). Her decks include a low deck "C" at 2.2 m while her
sheer is a flat `DECK3_Z` (19.78), so `deckZAt("4", x, concordia)` is
about 40 m instead of 22.58. `ShipSpec` gains optional
`sheerRefDeck?: string` (the deck her `sheerZ` is the edge of); her spec
sets `"3"`; `deckZAt` uses it when present, else today's rule. A test
pins `deckZAt` for every deck of every other ship at five x values to the
old formula (so no other number moves), and hers to `deck.z` exactly.
`places.ts`'s private `cDeckZ` becomes `deckZAt` (same numbers).

### The per-ship registry

`walkMapFor(ship)` and `interiorFor(ship)` read one registry
(`lib/shipwreck/walk/registry.ts`): per ship, its deck map and optional
interior, merged once on first use (`withInterior`). The Titanic's entry
reproduces today's merged map exactly (a test compares the two).

### Her deck map (`lib/shipwreck/walk/concordiaDecks.ts`)

All heights are game decks (`spec.decks`, the model's numbering), not
Costa's: the model's pool decks are 12/13 where Costa's Lido was deck 9
and her Belvedere pool deck 11. Each area notes its Costa deck in a
comment. Positions come from `concordiaRecipe.ts` (its blocks and rails),
checked by `maps.test.ts` as for the other ships.

| Area                | Deck (z)   | Where                                              | Notes                                                                                                                                  |
| ------------------- | ---------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `lido-aft`          | 13 (47.78) | x −96.8..−2, y ±15.4 (the rails)                   | the pine deck on `deck-12-aft`; blockers: both aft glass houses (hw 13), the funnel casing (hw 6) and funnel, the radomes' feet if low |
| `pool-hall`         | 12 (44.98) | x −2..34, y ±13.5 (inside `pool-glass`)            | a deck area drawn by the room kit (below); the pool basin is a blocker with its edge walkable                                          |
| `lido-fwd`          | 13         | x 34..58, y ±15.4                                  | the forward pool (blocker) and the slide tower (blocker, x 42 y −8)                                                                    |
| `aft-terrace`       | 12         | x −114.8..−97, rail at the edge                    | under the lido's after end                                                                                                             |
| `sports-deck`       | 14 + 0.35  | x 58.7..100, y ±(edge − 4.1)                       | the court; the radar mast's feet (x 80) block                                                                                          |
| `boat-deck-p`, `-s` | 4 (22.58)  | x −101..104, between the recess wall and the boats | see the recess ruling                                                                                                                  |

Links (`Stair`s, the existing teleport with the eyes eased): `lido-aft` ↔
`pool-hall` (aft glass doors, a short stair down, x −2), `pool-hall` ↔
`lido-fwd` (x 34), `lido-aft` ↔ `aft-terrace`, `lido-fwd` ↔ `sports-deck`,
and a stair tower from each lido to each boat deck side (the walk spec's
stair rule: real ships do this inside; it is a long way down, so the eyes
ease as on any stair). **Spawn**: in the pool hall, starboard of the pool,
facing forward (1.18 puts the Squok club's door there; 1.16 wants spawns
facing a door).

**The boat recess ruling.** The model's recess on decks 4–5 is 4.8 m deep
and her boats fill it (each 3.9 m wide, set 0.35 m in from her edge),
leaving 0.55 m by the wall: too narrow for the walker (0.3 m body). The
model's `RECESS_INSET` becomes 7.4 m, so a 2.6 m promenade runs inboard of
the boats (on the real ship deck 4 was the wide promenade where people
mustered). Only box sizes change: the draw count and triangle count of
her model stay the same (checked by her three perf scenes, unchanged).
Boats are blockers on the boat deck only until lowered (the walk spec's
rule: they leave). **Boarding**: the generic ride (`Effects.tsx` builds
boat spots 1 m inboard of each boat's deck edge; `BOARD_REACH_M` 3 m).
From the promenade's middle the spot is about 3.5 m away; if the test
shows any boat unreachable, her spots use the boat's inboard side
(keyed on the boat recipe's recess flag, so no other ship's spots move).

### The pool hall: a deck room drawn by the kit

The model's `pool-glass` block is solid dark glass; from inside it shows
nothing useful. So the room kit learns **deck rooms**: a `Room` with
`deckRoom: true` merges as an ordinary deck area (deck speed, jumping,
never closes) but is drawn by the kit, whenever walking on her, with
1.15's shader and her power. Her `InteriorMap` in 1.17 holds only the
pool hall (and its pieces): glass walls (a new `glass` finish: tinted,
see-through, double-sided), a tiled floor, the pool basin (`pool-edge`
piece, tiled), the water (the kit's water, its level the low rim's earth
height: full on an even keel, spilling as she leans), loungers, the vault
seen from below. The kit's floor sits 2 cm over the model's deck-11 roof
(or uses polygon offset) so the two never fight. Built on the first walk
frame on her, as 1.15's interior is.

### Walking as she leans (her map's flags)

The walker already copes mechanically with any heel (feet follow the
floor in her frame; `slopeDeg` is HUD only). Three problems appear on her
past about 20°, each fixed by a flag only her map sets:

1. **The eyes clip uphill walls.** On deck the eyes stand 1.6 m along
   true up, which at heel θ is 1.6·sin θ toward the high side of the feet
   in her frame: 0.8 m at 30°, 1.0 m at 40°, through any house wall the
   walker stands beside on its low side. `WalkMap.eyesShipUp: true` puts
   her deck eyes along her own up axis, as 1.15 already does inside. The
   view stays level with the horizon (no roll: a rolling view on an iPad
   is a sickness risk), so the deck reads as tilting under you.
2. **The heel feel** (decision 6). `WalkMap.heelFeel: true`. From
   `deckSlope(pose)` (slope.ts: degrees and the downhill direction in her
   frame), with k = clamp((slope − 8°) / (30° − 8°), 0, 1):
   - the stick's uphill component is scaled by 1 − 0.45k (lean into it);
   - a drift of 0.8k m/s downhill is added every substep, standing or
     walking (you slide);
   - the drift is a move like any other: rails and walls hold (never
     overboard: only a jump goes over a sea rail), blockers push back,
     deep water is a wall (inside), it never takes a stair, door or lift
     (links fire only from stick motion), and it is off during a lift
     ride and while the HUD has input off;
   - straight uphill always nets at least 0.6 m/s (inside at 30°:
     3 × 0.55 − 0.8 = 0.85; deck at 40°: 4 × 0.55 − 0.8 = 1.4);
   - the corner rule: drift into a wall slides along it (1.15's slide),
     so the walker gathers against the low wall, which is the point, and
     can always walk out along it.
3. **The swimmer and her superstructure.** A swimmer is kept off her
   hull's footprint below `sheerZ`; lying over, her superstructure is in
   or over the water and a swimmer could paddle into it.
   `WalkMap.swimAroundSuperstructure: true`: the swimmer's clearance also
   counts each `spec.superstructure` box (its `halfBreadthM` or her
   breadth, to its `topZ`).

**Where walking ends** (decision on the cut-off, a ruling). Past 30° the
deck is very steep in view but walkable with the feel above; past 40° her
port side is high in the air and the sports deck is a wall. So
`WalkMap.walkEndsAtHeelDeg: 40`: at 40° (00:00) a walker on her deck
slides off (the existing fall-and-splash path, `goInSea`) into the sea on
her low side, clear of her superstructure, and floats beside her;
`placeWalker` returns null past it (Back on deck and the picker's walk
buttons hide, as after a break). A seek to before 40° puts them back on
the spawn as usual.

### Her creaks (decision 6)

`audio/cues.ts`'s strain follows trim only (`CREAK_FROM_DEG` 2 →
`CREAK_FULL_DEG` 25), so her roll makes no sound. For ships in
`LIST_CREAK_SHIPS` (only `"concordia"`), strain is the larger of the trim
strain and a list strain (5° → 40°). This is in every view of her, not
just walking (she has creaked silently until now). No new voices.

## The design: 1.18, her rooms

### The room kit's modern vocabulary (`lib/shipwreck/interior/types.ts`)

Added (all additive; the Titanic's data and output do not change):

- `RoomKind`: `atrium`, `gallery`, `stateroom`, `balcony`, `lobby`,
  `theatre`, `stage`, `club`, `lift-car`, `pool-hall`.
- `WallFinish`: `cabin-veneer`, `cream`, `marble`, `glass`, `kids`
  (bright murals), `theatre` (dark red). `FloorFinish`: `cabin-carpet`,
  `marble`, `tile`, `teak`, `soft` (play mat), `stage-wood`.
  `LampStyle`: `downlight`, `strip`, `chandelier`.
- `PieceId`: `glass-lift-car` (drawn by the lift, not placed), `lift-shaft`,
  `glass-rail`, `theatre-seat-row`, `stage-curtain`, `stage-lights`,
  `pool-edge`, `lounger`, `cabin-bed`, `cabin-sofa`, `desk`, `tv`,
  `balcony-door`, `balcony-rail`, `balcony-chair`, `cabin-door`,
  `bar-counter`, `bar-stool`, `atrium-stair`, `pirate-ship`, `castle-tower`,
  `beanbag`, `kids-table`, `toy-shelf`, `soft-play`, `exit-sign`,
  `emergency-lamp`.
- `Room.deckRoom?: true` (1.17), `Room.seep?: true` (below).
- `InteriorMap` gains `closeAtHeelDeg?: number` (her 30), `lifts?:
LiftShaft[]`, `emergencyFlicker?: true`, and 1.16's `entries`.

Each new piece has a footprint in `PIECE_FOOTPRINT` if it blocks.
Pieces are low-poly with good proportions and colour, as 1.15's.

### Her rooms (`lib/shipwreck/interior/concordia.ts`)

Layouts invented on her known plan (CruiseMapper's deck pages, Wikipedia's
spaces list; research notes in the plan's references), every invention
listed in the file header as a ruling. Positions are game decks and must
fit inside her model's solid blocks (main block x −112..112 to deck 11;
decks 4–5 set in by the recess wall at y ±(edge − 7.4) ≈ ±10.3 between
x −101 and 104; balconies set in 1.8 m from her side on decks 7–10 between
x −100 and 96). The builder's exact numbers are checked by the map tests.

| Room(s)                                    | Deck   | Where (about)                                                 | Notes                                                                                                                                                           |
| ------------------------------------------ | ------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atrio Europa floor (`atrium-3`)            | 3      | x 62..80, y ±9                                                | marble, the lobby bar, the foot of the curving stair; the well over it x 65..77, y ±6 (Costa: deck 3 forward)                                                   |
| Galleries (`atrium-4`, `atrium-5`)         | 4, 5   | rings round the well, 3 m wide, glass rails                   | `noWalk` edges are the glass rails into the well (walls to the walker)                                                                                          |
| Atrium stair (`atrium-stair`)              | 3→4    | a ramp along the starboard side of the well                   | 1.15's flight rules                                                                                                                                             |
| Glass roof                                 | over 5 | ceiling at deck 6 + 1                                         | drawn, glass                                                                                                                                                    |
| Lifts (`lift-a`, `lift-b`)                 | 1→7    | after wall, x 62..64.2, y +1.5..+3.7 and −3.7..−1.5           | stops 1, 3, 4, 5, 7; glass in the atrium, glass-fronted shafts through the lobbies (see "The glass lift")                                                       |
| Boat-deck entrances (`entry-p`, `entry-s`) | 4      | x 70..73, from the recess wall to the gallery                 | deck doors from `boat-deck-p`/`-s`                                                                                                                              |
| Deck 1 lift lobby (`lobby-1`)              | 1      | x 56..62, y −12..+6                                           | wide across her, so the water visibly creeps across it                                                                                                          |
| Deck 1 corridor (`corridor-1`)             | 1      | starboard, x 56 → 30, y −10.6..−9.2                           | cream walls, cabin carpet, downlights, shut cabin doors every 3.6 m both sides                                                                                  |
| Inside cabin (`cabin-inside`)              | 1      | inboard of the corridor, x 44..47.6, y −9.2..−5               | two beds, a desk, a TV, no window (Costa: inside cabins on 1–2; invented here)                                                                                  |
| Ocean-view cabin (`cabin-ocean`)           | 1      | outboard, x 40..43.6, y −16..−10.6                            | a bed, a sofa, a big window low over the sea                                                                                                                    |
| Deck 7 lift lobby (`lobby-7`)              | 7      | x 56..62, y −6..+6                                            |                                                                                                                                                                 |
| Deck 7 corridor (`corridor-7`)             | 7      | starboard, x 56 → 44, y −9.2..−7.8                            |                                                                                                                                                                 |
| Balcony stateroom (`stateroom`)            | 7      | x 49..52.6, y −15.9..−9.2                                     | bed, sofa, desk, TV, bathroom door (shut), glass balcony door; Costa: balcony cabins on 6–10                                                                    |
| Its balcony (`balcony`)                    | 7      | x 49..52.6, y −17.6..−15.9                                    | `kind: balcony`: open above the rail (the walker's wall), the balcony over it as a ceiling, two chairs; starboard, so she leans you toward the sea              |
| Teatro Atene stalls (`theatre`)            | 3      | x 84..100, y ±10, raked: floor 2.0 m up at x 84 to 0 at x 100 | seat rows as blockers with two aisles (y ±3.5), the stage beyond; door at its back to an atrium passage (`theatre-passage`, x 80..84); Costa: decks 3–5 forward |
| Stage (`stage`)                            | 3 +1.0 | x 100..108, y ±9                                              | steps up at both sides; curtain, stage lights                                                                                                                   |
| Theatre balcony (`theatre-balcony`)        | 5      | x 84..90, y ±10, a short rake                                 | from `atrium-5` by a passage                                                                                                                                    |
| Squok club (`squok`)                       | 12     | x 36..56, y ±13 (inside `deck-12-fwd`)                        | soft play floor, pirate ship, castle tower, beanbags, tables, shelves; door from the pool hall's forward glass wall (x 34) (Costa: Squok on deck 10)            |

All the 1.18 rooms are `interior`. The pool hall stays a deck room. Deck
doors: `entry-p`, `entry-s` (boat deck), `squok` (pool hall). With the
spawn facing the Squok door, a kid's first room is a few steps away.

**Entries (1.16 picker buttons)**: `atrium` (atrium floor, facing the
lifts), `stateroom` (inside it, facing the balcony door), `low-cabin`
(lobby-1, facing the corridor), `theatre` (stalls aisle, facing the stage),
`squok` (inside, facing the pirate ship). Hidden when rooms are closed
(30°) or the spot's water is over wading depth, as 1.16 rules.

### The glass lift (decision 4)

Data: `LiftShaft { id; car: { min: V2; max: V2 }; stops: { deck; landing:
roomId; door: [V2, V2] }[] }`. `withInterior` makes one `lift-car` area per
stop (`lift-a@3`, …) seamed to its landing by `door`, all sharing the car's
plan.

**The ride** (`lib/shipwreck/interior/lift.ts`, pure):

- In a car, the HUD shows two big buttons, ▲ and ▼ (`aria-label` "Lift
  up", "Lift down"), each only when there is a stop that way it may go to.
- A stop whose landing is deeper than the knee (`WALK_LIFT_MAX_DEPTH_M`) is
  skipped: the car rides past it to the next dry stop; ▼ hides when no dry
  stop is below. ("Get to the lift before the water!")
- `WalkerState.ride?: { lift: string; from: number; to: number; s: number }`.
  `liftRideZ(lift, spec, from, to, s)` is the car floor's ship-frame z
  along the shaft: ease in over 1 s, 1.5 m/s, ease out over 1 s (deck 1 to
  deck 7, 16.8 m: about 12.5 s, which is the fun). `liftRideS` its length.
- While riding, the stick does not move the walker (look still turns and
  tilts; the drift is off); `walkerFloorZ(map, w, spec)` returns the ride
  z, used by the eyes, water depth and the HUD. At the end the walker's
  area becomes the car at the arrival stop; the doors "open" (the seam).
- A seek, Back on deck, Go outside or the rooms closing ends a ride at once
  (the walker is placed by that rule).
- Lifts run after the blackout (a ruling: on the real night they stopped;
  the kids' favourite stays).

**The scene**: each shaft's car is drawn at its z (your car at your ride
z; the other car rides a slow loop as a pure function of shown time, so the
atrium has life). While riding, every zone the shaft passes is drawn
(lobby-1, the atrium with its galleries and stair, lobby-7: at most three
zones), so through the glass you see the deck 1 lobby drop away, the
atrium open out three storeys above you, the galleries slide down past,
and the deck 7 lobby close round you. The shaft's slab edges are drawn
where the car passes each deck. No wipe on her (the Titanic keeps hers).

### Slow flooding (decision 5)

**What 1.15 already does, checked**: a room's water is a level plane in
earth z (three's y) per room, clipped to the room's box in her frame; the
walker's depth is that level minus the feet's earth height. So in a
heeled room the plane meets the floor along a line parallel to her
centreline, the low (starboard) side is deep while the high side is dry,
and as she heels further the line creeps uphill across the floor. Water
gathers on the low side and creeps across **naturally**; nothing new is
needed for that.

**What is new: seep.** Under 1.15's rule a room above the bulkhead deck
fills to the sea's level as soon as the sea is over its lowest point
(eased at 0.5 m per real second for show): a quick fill, not a slow
flood. Rooms with `seep: true` (deck 1's lobby, corridor and cabins) take
water through her doors and vents instead: once the sea is over a room's
lowest floor point, its level rises from there toward the sea's at most
`ROOM_SEEP_M_PER_S` = 0.005 m per shown second (0.3 m a shown minute; a
tuning value), never above the sea. `seepLevels(interior, frames, spec)`
integrates this once over the run's frames (pure, deterministic under
seeks: the level at t is a lookup), built when walking on her starts. The
scene's 0.5 m/s ease stays on top.

**Which deck**: the low rooms must be wet before the close. A test on
her real night (her track, or a fixture of her poses if simulating is
slow) puts lobby-1's starboard edge wet at least two shown minutes before
30°, knee deep somewhere in `cabin-ocean` before the close, and dry before
the touch. If deck 1 cannot meet that, the low rooms and the lift's lowest
stop move to deck 0 (11.2 m, the bulkhead deck), and the file header says
so.

### Rooms close at 30° (decision 6)

`interior.closeAtHeelDeg` (30). While `|frame.listDeg| ≥ 30` (or she is
broken, for ships that break): deck doors do not open, entries hide, and a
walker inside is **walked out** onto the nearest dry deck door's outside
(`doorExit`, the existing Go outside path, ripple wipe), not into the sea:
the deck carries on to 40°. If no deck door is dry, the spawn; else the
sea (as Back on deck). The Titanic's interior has no `closeAtHeelDeg`;
she still closes on the break only.

### Lights inside her

- Ship power: `frame.power`, 1 until her blackout at 58 s, then 0.25
  (`emergencyLight`). Room power and the torch are 1.15's (`roomPower`,
  torch under 0.35): from the blackout on, the torch is on in every room
  of hers. That is nearly all of her night: rooms are fully lit only in
  the first minute, or in a What if that spares her switchboard room (her
  drift and blackout only come with her real openings).
- So her rooms carry visible emergency lights: `emergency-lamp` strips at
  floor and ceiling edges and green `exit-sign`s, HDR so bloom catches
  them, lit at the emergency power regardless of the room lamps. Never
  black.
- `emergencyFlicker: true`: while on emergency power, deterministic
  flicker dips (as `lights.ts`'s `dip`) whose rate grows from none at 10°
  to about one a second at 30°, never below 0.1. The torch itself never
  flickers (it is yours).
- Water over a room's lamps (0.3–0.6 m) flickers and kills them, as 1.15.

### Sound inside (decision 6)

Cheap and from the existing voices only:

- Her list creaks (1.17's `LIST_CREAK_SHIPS`).
- `WalkCueInput` gains `inside: boolean` and `wet: number` (0..1, the
  water around the walker: the deepest of the walker's room and seamed
  rooms, 0 at dry, 1 at 1 m). Inside her, the `wash` bed follows `wet`
  (water sloshing nearby), and `creakFar` plays every 4–8 s while her
  heel is over 15° (the ship groaning around you).
- Nothing new for the Titanic (follow-up list).

### Rendering and performance

`Interior.tsx` is already ship-generic; it gains: the deck room zone
(drawn whenever walking on her), the lift cars (one small merged mesh per
car, moved by matrix), the riding zone rule, her emergency lamps. Not
walking on her: nothing is built. Budgets (unit-tested triangle counts;
perf scenes local):

| Scene                                             | Target                       |
| ------------------------------------------------- | ---------------------------- |
| `shipwreck-walk-concordia-pool` (1.17)            | ≤ 62 draws, ≤ 430k triangles |
| `shipwreck-walk-concordia-atrium` (1.18, riding)  | ≤ 70 draws, ≤ 470k triangles |
| `shipwreck-walk-concordia-cabin` (1.18, flooding) | ≤ 66 draws, ≤ 440k triangles |

(Her orbit scenes are about 50 draws and 375k triangles.) Whole interior
of hers at most 140k triangles in memory; the atrium zone at most 50k.
First lever if over: skip the sea's planar reflection while inside, as
1.15.

### Save, analytics, hooks

- Save: nothing new. Analytics: nothing new.
- Test hooks (dev and `NEXT_PUBLIC_E2E=1`): `getWalk()` gains `ride`
  (lift id or null) and `heelDeg`; `rideLift(dir)` (as the buttons);
  1.15's `placeWalk`, `enterDoor`, `goOutside` work on her.

## Risks

- **Room fit**: rooms must sit inside her model's solid blocks and below
  their roofs (map tests check each room's box against the recipe's
  blocks).
- **Glass from inside**: her model's faces seen from inside a block
  (culled back faces) may show odd slivers; screenshot each room.
- **The heel feel on her lido at 35–40°** may still read as climbing a
  wall; the cut-off angle is a ruling and moves easily.
- **Seep timing** depends on her track; the test decides deck 1 or 0.
- **1.16 lands with its own data shapes** (`entries`, icons, the arrow):
  the first task adapts to what actually merged.

## Follow-ups for the Titanic (not in this plan)

- A visible lift ride for her B ↔ E lift (the shaft between, a lit car).
- Seep for her lower rooms (Scotland Road, the third-class cabin) so they
  fill more slowly and visibly.
- Her creaks and the slosh inside (the `inside`/`wet` cue input).
- Emergency-style flicker as her bow goes down, before the break.
- The heel feel keyed on trim for her last minutes (a forward slide).

## Left to the builder

- Exact outlines, the rake profiles, furniture placement and the look,
  within the tables and the map tests.
- Piece art, emergency lamp spacing, the button icons (`Icon.tsx`
  style), the other car's loop.
- The seep rate and heel-feel numbers within their tests.

## Rulings Gentry may revisit

1. **Rooms close at 30°** (23:11:24); anyone inside walks out onto the
   nearest open deck. Deck walking ends at **40°** (00:00) with a slide
   into the sea beside her; Back on deck is gone after that.
2. **The heel feel**: from 8°, uphill slower (to 55% at 30°), a downhill
   slide up to 0.8 m/s; never overboard, never through a door, always able
   to walk uphill. Her map only.
3. **No view roll**: the view stays level with the horizon; the deck and
   rooms tilt around you (iPad motion sickness).
4. **Her deck eyes along her own up**, as inside, so a lean never pushes
   the view through a wall.
5. **The glass lifts run all night** (on emergency power, fun over
   realism), stop at decks 1, 3, 4, 5 and 7, skip flooded stops, and take
   about 12 s from bottom to top.
6. **The low cabins are on deck 0 plus 0.4 m** (Task 7: deck 1 could not
   pass the water test: from the touch her lobby's starboard edge sits
   2.8 m over the sea and her heel shortens a lowered floor by cos(heel)),
   forward of midships at the lift, the lobby reaching y −13.5, and fill by
   seep at 0.3 m a shown minute. The seep is the depth over each room's
   lowest floor point (see `seep.ts`), not an earth-fixed plane that starts
   at the sea's level.
7. **The boat recess is deepened** in her model from 4.8 m to 7.4 m so a
   promenade runs inboard of the boats.
8. **Game deck numbers** (the model's) are used everywhere, with Costa's
   noted alongside; the model's pool decks (12/13) are about three above
   her real Lido.
9. **The pool hall is a deck room**: drawn by the room kit, walked with
   deck rules, never closes.
10. **Room layouts are invented** on her real spaces (each listed in
    `concordia.ts`'s header): a starboard balcony stateroom on deck 7,
    deck 1 cabins, a three-storey atrium (3–5) where the real one's height
    is unknown, the theatre's stalls and balcony, the Squok club in the
    block under the forward lido.
11. **Her creaks follow her list in every view**, not just inside.
12. **No analytics event, no save change.**

## Changelog drafts

```ts
{
  version: "1.17.0",
  date: "<ship date>",
  title: "Walk the Costa Concordia",
  highlights: [
    "Walk the Costa Concordia's top decks, around her pools and the yellow water slide",
    "Stand by the pool under the big glass roof",
    "Go down to the lifeboats and climb into one before it goes",
    "Feel her lean: walking uphill is hard work, and you slide downhill",
    "Listen to her creak as she tips over",
  ],
}
{
  version: "1.18.0",
  date: "<ship date>",
  title: "Go inside the Costa Concordia",
  highlights: [
    "Walk through a door from her deck into the big three-floor hall",
    "Ride the glass lift and watch the floors go by",
    "Visit a cabin with its own balcony, and the kids' club with a pirate ship",
    "Sit in the theatre and walk up on the stage",
    "Watch the sea come into the low cabins and creep across the floor as she leans",
    "When the lights go out, the emergency lights flicker and your torch comes on",
  ],
}
```
