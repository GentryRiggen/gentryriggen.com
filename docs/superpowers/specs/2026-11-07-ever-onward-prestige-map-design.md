# Ever Onward: the prestige map

**Date:** 2026-11-07
**Status:** Draft, waiting on Gentry's approval

## Why

Gentry says prestige has "too many options, all revealed immediately". Today
every universe has the same flat shop of six or seven upgrades: faster, bigger
taps, cheaper, a head start, a helper. All of them show from the first restart,
and each one goes up to five levels. Players buy the cheapest one, so there's
no decision, no mystery and nothing to look forward to.

He wants the map from the Universal Paperclips **mobile app** (it isn't in the
browser game):

- A 10 × 10 grid. Columns are "World" (the universe next door) and rows are
  "Simulation level" (the universe within). Finishing a universe moves you one
  square right or one square down.
- Some squares have a strange icon floating slowly on them. That's an
  **artifact**. You can see where it is but not what it does until you finish a
  universe on that square.
- Visited squares are hatched. "Tap a visited square to return to it." Moves only
  go right or down, so collecting artifacts becomes a route puzzle (a fan's
  route takes 61 universes).
- Many squares have nothing on them. Finishing one just moves you on.

What Gentry said hooked him, in his words:

- "The mystery of the next upgrade and the look of the artifact intrigued me."
- "It was so satisfying when you found an artifact that was a good one, but not
  all of them are awesome."
- "The journey through the map is fun."
- "We should always be able to go look at the map."
- On length: "as long as Paperclips, which is a long time… the more artifacts
  you acquire, the faster you can go through each level, thus travelling the
  map faster." A Paperclips run with no artifacts was 4–5 hours, and artifacts
  eventually brought it to "maybe half or less", **not** a few minutes.
- One map **per universe**. One shared map across all four would clash with the
  different themes.

Plane Builder's Sky Map is "close but not quite". It's an endless grid where
every square with something on it looks like the same gift box, the prizes are
small stat bumps, and nothing on the board is worth heading for. This design
fixes those gaps: there's an end, items are distinct and visible from afar, some
are clearly worth the trip, and the route is a choice.

## Goals

1. One map per universe, always one tap away, drawn in that universe's style.
2. Progress is the trip: each finished run is one step, and you choose where.
3. Artifacts are visible as strange icons and unknown until found. Finding one
   is a big, satisfying reveal **in the scene at the top**, not only in a panel.
4. Artifacts vary: some great, some modest, some odd or with a catch.
5. Runs slowly get shorter as artifacts pile up, down to about half the first
   run, not to minutes.
6. The map takes Paperclips-scale time: many runs over weeks.
7. Reaching the far corner is a real ending for that universe's map.

## Non-goals

- A shared map across universes.
- An infinite map (Plane Builder's approach).
- Real-money or timer-gated moves.
- Changing what happens inside a run's parts (the "dials" rollout owns that).

## Anti-goals (it fails even if it technically works when)

- Every artifact is labelled or described before you get it.
- All artifacts are plain "+X% speed" bumps, so finding one is never exciting.
- A run with every artifact takes minutes (it breaks the parts and the dials).
- The map shows only between runs.
- A find only changes a number in a panel and nothing visible in the scene.
- An existing player loses progress or finds their next run slower than their
  current one.

## Constraints

- Static export, no server. The map is generated from fixed data in code and
  saved in the existing local save (`lib/ever-onward/engine/save.ts`, which has
  a migration hook). `SAVE_VERSION` goes from 1 to 2.
- Players include children: no free text, and analytics stay on the closed-enum
  schema (`lib/analytics/gameEvents.ts` plus `firestore.rules`) if events are
  added.
- Retro CRT pixel look everywhere: the shared `retro/` primitives and a pixel
  font of at least 10px.
- iPad landscape and iPhone portrait both matter. Overlays pad the safe area
  (`SAFE_INSETS`).
- Engine rule from `prestige.ts`: an artifact may only set numbers the tick
  already reads (`run.mods`), starting stock, or flags. Fresh runs stay honest.
- The headless scorecard is a guardrail, not the goal. Nothing ships without a
  real playthrough with screenshots (Test mode) and Gentry's feel check.

## The design

### The map

- **Size: 8 × 8 per universe** (my call). That's 64 squares and 14 steps to the
  far corner. Paperclips' 10 × 10 with 1–2 hour runs, times four universes,
  would be far longer than Paperclips. 8 × 8 with about 14 artifacts keeps a
  "collect them all" route at roughly 30–40 runs per universe. Size and artifact
  count are data, so tuning can change them.
- **Two directions, named per universe** (my call). Right is "next door" and
  down is "within":

  | Universe | Right ("next door")                 | Down ("within")                  |
  | -------- | ----------------------------------- | -------------------------------- |
  | Light    | Farther coast (the next lighthouse) | Deeper dream (the lamp's memory) |
  | Grow     | Next valley                         | Deeper soil                      |
  | Higher   | Next town                           | Inside the blueprint             |
  | Smile    | Next street                         | Inside the smile                 |

- **You start at the top-left.** The bottom-right corner is the **last square**.
- **Every square is a slightly different world.** Each column and row adds one
  small, readable change to runs played there. The change shows on the square
  before you step:
  - Going right tunes the economy, for example "Oil costs more, storms are
    rarer" or "Seeds are cheap, winters are long". These are small, around
    ±10–20%.
  - Going down makes things stranger: the scene palette shifts, eerie beats show
    up more often, and one rule twist per row (for example "Keepers work only
    at night"). This is where "sinister at times" lives.
  - Squares are data (`MapDef`), hand-authored per universe, not hashed, so
    each map has a shape: clusters, a far-off prize, and a deliberate detour.
- **Empty squares are most of the map** (about 75%). They're the "map move with
  no upgrades". Stepping onto one still matters, because it's a new world and
  it's on the way to something.

### Moving

The save holds `map: { at: "x,y", visited: string[], found: string[], off: string[] }`
per universe. A run is always played **on** `at`.

1. **Playing.** You can open the map and look, but you can't move.
2. **A run finishes on square S.** If S has an unfound artifact, it's found
   (the reveal plays). S joins `visited`. The map opens in **choose** mode.
3. **Choose.** You can pick the square right of S or below S (if it's on the
   map), which is a new square. Or you can pick **any visited square** to play
   it again, S included. Whatever you pick becomes `at`, and the next run starts
   there. There's no step budget: every finished run gives exactly one choice.
   Going back costs nothing extra, but it uses that run's choice, and the next
   new square you reach has to be right of or below the square you went back
   to. That's how routes branch.
4. **Restarting partway** (from the Menu, at any time) starts a fresh run on the
   same square. You get no reward and no move. It stays as the way out of a bad
   run. Today's "restart for embers from part 2 on" goes away.

- Revisiting a square never gives its artifact twice.
- `best` stays per universe (fastest finish on any square).
- The hub unlock chain still uses `completions > 0`.

### Artifacts

- **About 14 per map, 56 in all.** Each has a unique pixel-art glyph that
  floats slowly on its square (Paperclips style) from the moment you open the
  map. Its name, what it does and its catch stay hidden until it's found. Even
  the accessible label just says "something strange".
- **Found artifacts are permanent and stack.** A shelf on the map screen shows
  every found glyph with its name and effect in plain words (the clarity rules:
  name the stat, say why it matters).
- **Artifacts with a catch can be switched off** on the shelf. That's the one
  ongoing decision the shelf adds. A switch takes effect on the **next** run,
  so you can't flip it back and forth mid-run.
- **How effects reach the run (my call):** an artifact is
  `{ id, glyph, name, effect, catch?, tier, apply(run) }`, applied at run start
  the same way `PrestigeUpgradeDef.apply` is today. Effects that today's tick
  already reads (`mods.speed`, `tapMult`, `costMult`, `headStart`, starting
  stock) need no engine work. Effects that need new behaviour (storms twice as
  often, a side machine running itself) add a named mod or flag that the
  universe's tick reads, the same way `calm` and `bright` were added. That's
  fine, as long as each one is unit-tested and the scorecard still passes with
  it on and off.
- Square changes (the next door / within tweaks) work the same way: they're
  `apply(run)` functions on the square. **The start square (top-left) changes
  nothing**, so run 1 plays exactly like today.
- **The mix per map:**
  - **Big ones (about 3):** clearly worth a detour, for example "every part's
    goal is 15% smaller", "start each run with the first part's machine already
    built", or "the side machine runs on its own". They're placed far from the
    start or behind a detour.
  - **Modest ones (about 6):** small speed, tap, cost or head-start effects.
    This is where today's shop effects end up, folded in.
  - **Odd ones (about 5):** a real upside with a catch, or a change that's mostly
    for fun and visible. For example "storms come twice as often but pay
    triple", "a ghost keeper walks the cliff (no effect, just there)", or "taps
    are worth 3×, but the auto-tappers are gone".
- **Every artifact shows in the scene.** Each one adds or changes something you
  can see in the mini world at the top for every run after it's found (a lantern
  on the cliff, a strange flower in the beds, a crooked flag on the tower). This
  follows the house rule from the dials work. **First pass (my call):** each
  universe's scenes get one shared `ArtifactLayer` with fixed slots per part,
  and every artifact is a pixel sprite placed in a slot with its own idle
  animation. Bespoke scene changes (a palette shift, a ghost walking) are added
  where they're cheap, and are required for the big artifacts.
- **The reveal moment:** when a run ends on an artifact square, the scene dims,
  the glyph rises out of the map square into the scene, flips, and its name and
  effect type on in the retro font with a sound. Strong finds get a bigger burst
  than so-so ones, because "not all of them are awesome" should read honestly
  too.

### Pacing

- **Run 1** on a map is today's full length (Light is about 1.5 h for an eager
  player, Grow about 2 h).
- **Each artifact makes later runs a bit faster.** With every artifact on a map,
  a run is about **45–55% of run 1**, never less than 40%.
- The scorecard's M13 ("Prestige speedup") currently expects run 2 to be
  50–70% of run 1, which is the old shop's pace. It changes to a gentle curve:
  run 2 is 85–97% of run 1, run 10 on a sensible route is 65–80%, and a full
  collection is 45–55%. The bots need a route policy (greedy toward the nearest
  unfound artifact) to measure it.
- Every other scorecard metric keeps running on the neutral start square with
  no artifacts. Only M13 follows the route bot.
- **Steps to the corner:** 14 at the least. A route that collects everything
  takes about 30–40 runs (tuned after it's built).

### The ending

- Finishing a run on the **last square** (bottom-right) is the map's ending: a
  short closing film in the intro-film style, and the map is marked complete
  with that universe's final glyph on the hub card.
- The last square holds no artifact. Getting there **is** the win, which is
  Gentry's "sometimes beating the game is just a map move".
- You can keep playing afterwards: every square stays revisitable, and unfound
  artifacts are still out there.

### Always one tap away

- A **Map** button sits on the top bar next to Menu, in every part of every run.
  It opens a full-screen overlay showing: you are here, this square's changes,
  the glyphs ahead and the shelf.
- During a run, you can look at the map but not move. Moving happens only at a
  run's end.
- The hub card for each universe shows a tiny version of its map (visited
  squares and found glyphs).

### Look

- Each universe's map is drawn in its own theme, while borrowing Paperclips'
  feel (dark field, hatched visited squares, floating glyphs):
  - **Light:** a night sea chart with a star field, coastlines and a compass
    rose.
  - **Grow:** a seed-catalogue plot of soil squares, with roots going down.
  - **Higher:** a blueprint, white lines on blue.
  - **Smile:** a crayon town map that gets more uncanny the deeper you go.
- Glyphs are pixel art, 16–24 px drawn at 2× or 3×, slow float plus a shimmer.
  Unvisited empty squares are plain. Visited squares are hatched. The current
  square has a pulsing marker.

### What happens to Embers, the shop and existing saves

- The ember shop and ember currencies (Embers, Acorns, Gold stars, Stickers) are
  removed, along with `EmberPanel`'s shop and restart-for-embers.
- **The swap happens per universe (my call):** a universe moves to the map only
  when its map ships. Until then it keeps today's shop. `UniverseDef` gets an
  optional `map`. The ember UI shows when `map` is missing, and the map UI when
  it's there.
- **Save migration, my call:** the save gets an optional per-universe `map`
  field (`SAVE_VERSION` 2). When a universe first loads with a `map` def:
  - The player starts at the top-left square of that universe's map.
  - If the universe has `prestigeUpgrades`, it gets a **"Keepsake"** artifact on
    its shelf (one per universe, its own glyph). It's applied by running the
    old upgrade defs' `apply(run, level)` with the saved levels, so the old
    upgrade defs stay in code as Keepsake data. It always reproduces exactly
    what the player had (the start square is neutral), so nobody's next run is
    slower. It can't be switched off.
  - Leftover unspent embers are dropped. (Kids won't notice. The Keepsake covers
    what they bought.)
  - `completions` and `best` stay, and so does the hub unlock chain
    (`completions > 0`).
- The prestige scorecard and the skeleton tests that call `buyPrestigeUpgrade`
  are rewritten against the map.

### Test mode

- Add map jumps to Test mode: "map at start", "map half explored" and "one
  step from the last square", each with a sensible set of found artifacts. Add
  a "reveal this artifact now" button to preview every reveal and scene change
  without playing.

## Left to the builder

- Exact square changes, artifact effects, names and glyph art for all 56 (after
  this design is approved, a per-universe artifact list goes to Gentry before
  art is drawn).
- Exact map layout (where artifacts sit), as long as each map has a long detour
  to a big artifact and a direct route to the corner that skips most finds.
- Tuning the pacing numbers against the bots.
- Component split, file layout, and whether the shelf is a tab of the map
  overlay or a separate panel.
- Whether to log artifact finds to game analytics (if so, follow the
  enum-schema rules).

## Rollout (my call)

1. Engine and save: `MapDef`, moving, artifacts, migration, bots and scorecard
   M13, with tests but no UI yet. Universes without a `map` are unchanged.
2. Light's map end to end: overlay, shelf, reveal, scene changes, ending and
   Test mode. Gentry's feel check on the iPad.
3. Grow, Higher and Smile maps, one at a time, after the dials rollout for that
   universe ships.
